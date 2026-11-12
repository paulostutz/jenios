/** B152 durable PAPER rehearsal, not a production broker gateway or customer ledger.
 * SQLite BEGIN IMMEDIATE makes duplicate detection and risk reservation atomic across processes.
 * Unknown execution and partial fills retain the entire conservative reservation until closure.
 */
import {DatabaseSync} from 'node:sqlite';
import {openSync,closeSync,lstatSync,chmodSync,constants} from 'node:fs';
import {insist,record,id,units,time,uint,digest,assertRehearsal} from './contracts.mjs';
import {orderRisk} from './risk.mjs';
const TERMINAL=new Set(['FILLED','CANCELLED','REJECTED','CLOSED']);
const ALLOWED={RESERVED:['SUBMITTING','REJECTED','CANCELLED'],SUBMITTING:['ACK','PARTIAL','FILLED','UNKNOWN','REJECTED'],ACK:['PARTIAL','FILLED','CANCELLED','UNKNOWN','REJECTED'],PARTIAL:['PARTIAL','FILLED','CANCELLED','UNKNOWN'],UNKNOWN:['UNKNOWN','RECONCILED'],FILLED:['CLOSED'],CANCELLED:['CLOSED']};
export class PaperLedger {
 #db;
 constructor(path){
  insist(typeof path==='string'&&path.startsWith('/')&&!path.includes('\0'),'ABSOLUTE_PRIVATE_PATH_REQUIRED');
  const fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);closeSync(fd);
  insist(lstatSync(path).isFile(),'REGULAR_FILE_REQUIRED');chmodSync(path,0o600);
  this.#db=new DatabaseSync(path);this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS owners(owner TEXT PRIMARY KEY,currency TEXT NOT NULL,risk_limit TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS accounts(owner TEXT NOT NULL,connection TEXT NOT NULL,binding TEXT NOT NULL,currency TEXT NOT NULL,risk_limit TEXT NOT NULL,order_limit TEXT NOT NULL,notional_limit TEXT NOT NULL,day_limit TEXT NOT NULL,loss TEXT NOT NULL DEFAULT '0',max_orders INTEGER NOT NULL,paused INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,connection));
   CREATE TABLE IF NOT EXISTS intents(owner TEXT NOT NULL,connection TEXT NOT NULL,client_id TEXT NOT NULL,fingerprint TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL,risk TEXT NOT NULL,held TEXT NOT NULL,notional TEXT NOT NULL,quantity TEXT NOT NULL,filled TEXT NOT NULL DEFAULT '0',updated_at INTEGER NOT NULL,PRIMARY KEY(owner,connection,client_id));
   CREATE TABLE IF NOT EXISTS events(owner TEXT NOT NULL,connection TEXT NOT NULL,client_id TEXT NOT NULL,event_id TEXT NOT NULL,fingerprint TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(owner,connection,client_id,event_id));
   CREATE TABLE IF NOT EXISTS intent_symbols(owner TEXT NOT NULL,connection TEXT NOT NULL,client_id TEXT NOT NULL,symbol TEXT NOT NULL,PRIMARY KEY(owner,connection,client_id));
   CREATE TABLE IF NOT EXISTS cancellation_attempts(owner TEXT NOT NULL,connection TEXT NOT NULL,client_id TEXT NOT NULL,broker_digest TEXT NOT NULL,attempted_at INTEGER NOT NULL,PRIMARY KEY(owner,connection,client_id));`);
 }
 #tx(fn){this.#db.exec('BEGIN IMMEDIATE');try{const r=fn();this.#db.exec('COMMIT');return r;}catch(e){this.#db.exec('ROLLBACK');throw e;}}
 #account(session,c){assertRehearsal(session,c);const row=this.#db.prepare('SELECT * FROM accounts WHERE owner=? AND connection=?').get(session.userId,c.id);insist(row&&row.binding===digest(c),'UNKNOWN_OR_CHANGED_CONNECTION');return row;}
 configure(session,c,limits){
  assertRehearsal(session,c);record(limits,['currency','ownerRisk','accountRisk','orderRisk','notional','dailyLoss','maxOrders']);
  insist(/^[A-Z0-9]{2,12}$/.test(limits.currency),'INVALID_CURRENCY');
  for(const k of ['ownerRisk','accountRisk','orderRisk','notional','dailyLoss'])insist(units(limits[k])>0n,'POSITIVE_LIMIT_REQUIRED');uint(limits.maxOrders,100);insist(limits.maxOrders>0,'POSITIVE_ORDER_LIMIT');
  insist(units(limits.ownerRisk)>=units(limits.accountRisk)&&units(limits.accountRisk)>=units(limits.orderRisk),'INCONSISTENT_LIMITS');
  return this.#tx(()=>{
   const owner=this.#db.prepare('SELECT * FROM owners WHERE owner=?').get(session.userId);
   if(owner)insist(owner.currency===limits.currency&&owner.risk_limit===units(limits.ownerRisk).toString(),'OWNER_LIMIT_OR_CURRENCY_CONFLICT');
   else this.#db.prepare('INSERT INTO owners VALUES (?,?,?)').run(session.userId,limits.currency,units(limits.ownerRisk).toString());
   this.#db.prepare('INSERT INTO accounts(owner,connection,binding,currency,risk_limit,order_limit,notional_limit,day_limit,max_orders) VALUES (?,?,?,?,?,?,?,?,?)').run(session.userId,c.id,digest(c),limits.currency,units(limits.accountRisk).toString(),units(limits.orderRisk).toString(),units(limits.notional).toString(),units(limits.dailyLoss).toString(),limits.maxOrders);
   return {configured:true,environment:c.environment,realExecution:false};
  });
 }
 reserve(session,c,{order,meta,costs,quote,now}){
  this.#account(session,c);id(order.clientOrderId);time(now);record(costs,['roundTripFeeBps','slippageBps','fundingCost']);
  insist(session.diagnosticCompleted===true,'DIAGNOSTIC_REQUIRED');
  record(quote,['provider','instrument','receivedAtMs','sourceAtMs','bid','ask']);time(quote.receivedAtMs);time(quote.sourceAtMs);
  insist(quote.provider===meta.provider&&quote.instrument===meta.id&&c.provider===meta.provider,'WRONG_MARKET_SOURCE');
  insist(now-quote.receivedAtMs<=5000&&quote.receivedAtMs<=now&&now-quote.sourceAtMs<=5000&&quote.sourceAtMs<=now+1000,'STALE_OR_FUTURE_QUOTE');
  insist(units(quote.bid)>0n&&units(quote.ask)>=units(quote.bid),'INVALID_QUOTE');
  const risk=orderRisk(order,meta,{now,...costs});
  const fingerprint=digest({order,meta,costs,quote});
  return this.#tx(()=>{
   const account=this.#account(session,c);insist(account.currency===risk.settlement,'CURRENCY_CONVERSION_NOT_IMPLEMENTED');
   const old=this.#db.prepare('SELECT * FROM intents WHERE owner=? AND connection=? AND client_id=?').get(session.userId,c.id,order.clientOrderId);
   if(old){insist(old.fingerprint===fingerprint,'IDEMPOTENCY_CONFLICT');return {id:order.clientOrderId,state:old.state,duplicate:true,realExecution:false};}
   insist(!account.paused,'ACCOUNT_PAUSED');
   const all=this.#db.prepare('SELECT * FROM intents WHERE owner=?').all(session.userId),own=all.filter(x=>x.connection===c.id);
   insist(!own.some(x=>x.state==='UNKNOWN'),'RECONCILIATION_REQUIRED');
   const sum=(rows,key)=>rows.reduce((a,r)=>a+BigInt(r[key]),0n),newRisk=BigInt(risk.riskUnits);
   const owner=this.#db.prepare('SELECT * FROM owners WHERE owner=?').get(session.userId);
   insist(newRisk<=BigInt(account.order_limit),'ORDER_RISK_LIMIT');
   insist(sum(own,'held')+newRisk<=BigInt(account.risk_limit)&&sum(all,'held')+newRisk<=BigInt(owner.risk_limit),'AGGREGATE_RISK_LIMIT');
   insist(BigInt(account.loss)+sum(own,'held')+newRisk<=BigInt(account.day_limit),'DAILY_LOSS_LIMIT');
   insist(sum(own.filter(x=>BigInt(x.held)>0n),'notional')+BigInt(risk.notionalUnits)<=BigInt(account.notional_limit),'NOTIONAL_LIMIT');
   insist(own.filter(x=>BigInt(x.held)>0n).length<account.max_orders,'CONCURRENT_ORDER_LIMIT');
   this.#db.prepare('INSERT INTO intents(owner,connection,client_id,fingerprint,body,state,risk,held,notional,quantity,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(session.userId,c.id,order.clientOrderId,fingerprint,JSON.stringify(order),'RESERVED',risk.riskUnits,risk.riskUnits,risk.notionalUnits,units(order.quantity).toString(),now);
   insist(typeof meta.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(meta.id),'RECOVERY_SYMBOL_INVALID');
   this.#db.prepare('INSERT INTO intent_symbols(owner,connection,client_id,symbol) VALUES (?,?,?,?)').run(session.userId,c.id,order.clientOrderId,meta.id);
   return {id:order.clientOrderId,state:'RESERVED',duplicate:false,risk,realExecution:false};
  });
 }
 event(session,c,clientId,event){
  this.#account(session,c);id(clientId);record(event,['id','kind','atMs','cumulativeQuantity','reconciledState','realizedLoss']);id(event.id);time(event.atMs);
  const hash=digest(event);
  return this.#tx(()=>{
   const account=this.#account(session,c),key=[session.userId,c.id,clientId];
   const row=this.#db.prepare('SELECT * FROM intents WHERE owner=? AND connection=? AND client_id=?').get(...key);insist(row,'UNKNOWN_INTENT');
   const prev=this.#db.prepare('SELECT * FROM events WHERE owner=? AND connection=? AND client_id=? AND event_id=?').get(...key,event.id);
   if(prev){insist(prev.fingerprint===hash,'EVENT_REPLAY_CONFLICT');return {state:row.state,duplicate:true,realExecution:false};}
   insist(event.atMs>=row.updated_at,'OUT_OF_ORDER_EVENT');
   insist(ALLOWED[row.state]?.includes(event.kind),'INVALID_STATE_TRANSITION');
   const cumulative=units(event.cumulativeQuantity);insist(cumulative>=BigInt(row.filled)&&cumulative<=BigInt(row.quantity),'INVALID_CUMULATIVE_FILL');
   let state=event.kind,held=BigInt(row.held);
   if(state==='RECONCILED'){
    insist(['ACK','PARTIAL','FILLED','CANCELLED','REJECTED'].includes(event.reconciledState),'INVALID_RECONCILIATION');state=event.reconciledState;
   }else insist(event.reconciledState===undefined,'UNEXPECTED_RECONCILIATION');
   if(state==='FILLED')insist(cumulative===BigInt(row.quantity),'FILL_NOT_COMPLETE');
   if(state==='PARTIAL')insist(cumulative>0n&&cumulative<BigInt(row.quantity),'INVALID_PARTIAL_FILL');
   if(['ACK','SUBMITTING','REJECTED'].includes(state))insist(cumulative===0n,'UNEXPECTED_FILL');
   if(['REJECTED','CANCELLED'].includes(state)&&cumulative===0n)held=0n;
   if(state==='CLOSED'){
    insist(cumulative>0n&&cumulative===BigInt(row.filled),'CLOSURE_REQUIRES_EXISTING_FILL');
    const loss=units(event.realizedLoss);held=0n;
    this.#db.prepare('UPDATE accounts SET loss=? WHERE owner=? AND connection=?').run((BigInt(account.loss)+loss).toString(),session.userId,c.id);
   }else insist(event.realizedLoss===undefined,'LOSS_ONLY_ON_CLOSURE');
   this.#db.prepare('UPDATE intents SET state=?,held=?,filled=?,updated_at=? WHERE owner=? AND connection=? AND client_id=?').run(state,held.toString(),cumulative.toString(),event.atMs,...key);
   this.#db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(...key,event.id,hash,JSON.stringify(event));
   return {state,heldRiskUnits:held.toString(),duplicate:false,realExecution:false};
  });
 }
 pause(session,c,value=true){insist(typeof value==='boolean','BOOLEAN_REQUIRED');this.#account(session,c);this.#db.prepare('UPDATE accounts SET paused=? WHERE owner=? AND connection=?').run(value?1:0,session.userId,c.id);return {paused:value,positionsClosed:false,ordersCancelled:false};}
 pendingRecovery(session,c){
  this.#account(session,c);
  const rows=this.#db.prepare("SELECT i.client_id,i.state,s.symbol FROM intents i LEFT JOIN intent_symbols s ON s.owner=i.owner AND s.connection=i.connection AND s.client_id=i.client_id WHERE i.owner=? AND i.connection=? AND i.state IN ('SUBMITTING','UNKNOWN','ACK','PARTIAL') ORDER BY i.updated_at,i.client_id LIMIT 31").all(session.userId,c.id);
  insist(rows.length<=30,'RECOVERY_BATCH_REQUIRES_OPERATOR');
  return Object.freeze(rows.map(row=>{
   insist(typeof row.symbol==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(row.symbol),'RECOVERY_SYMBOL_MISSING');
   return Object.freeze({clientOrderId:row.client_id,symbol:row.symbol,previousState:row.state});
  }));
 }
 orderDetails(session,c,clientId){
  this.#account(session,c);id(clientId);
  const row=this.#db.prepare('SELECT i.*,s.symbol FROM intents i LEFT JOIN intent_symbols s ON s.owner=i.owner AND s.connection=i.connection AND s.client_id=i.client_id WHERE i.owner=? AND i.connection=? AND i.client_id=?').get(session.userId,c.id,clientId);
  insist(row&&typeof row.symbol==='string','RECOVERY_SYMBOL_MISSING');
  const order=JSON.parse(row.body);
  insist(order.clientOrderId===clientId&&units(order.quantity).toString()===row.quantity,'CORRUPT_INTENT');
  const attempted=!!this.#db.prepare('SELECT 1 FROM cancellation_attempts WHERE owner=? AND connection=? AND client_id=?').get(session.userId,c.id,clientId);
  return Object.freeze({order:Object.freeze({...order,symbol:row.symbol}),state:row.state,filled:row.filled,held:row.held,fingerprint:row.fingerprint,updatedAtMs:row.updated_at,cancellationAttempted:attempted});
 }
 /** Durable one-shot claim BEFORE DELETE; unknown outcome holds all exposure.
  * Pausing does not prevent owner-authorized cancellation of an unfilled entry.
  */
 claimCancellation(session,c,clientId,{fingerprint,updatedAtMs,brokerDigest,nowMs}){
  time(nowMs);insist(/^[a-f0-9]{64}$/.test(brokerDigest||''),'INVALID_BROKER_DIGEST');
  return this.#tx(()=>{
   const row=this.orderDetails(session,c,clientId);
   if(row.cancellationAttempted)return Object.freeze({claimed:false});
   insist(c.provider==='alpaca'&&c.environment==='paper'&&session.diagnosticCompleted===true,'PAPER_CANCEL_ONLY');
   insist(row.fingerprint===fingerprint&&row.updatedAtMs===updatedAtMs&&row.updatedAtMs<=nowMs,'CANCEL_INTENT_CHANGED');
   insist(row.state==='ACK'&&BigInt(row.filled)===0n&&row.order.side==='buy','CANCEL_REQUIRES_UNFILLED_ACK');
   const key=[session.userId,c.id,clientId];
   this.#db.prepare('INSERT INTO cancellation_attempts VALUES(?,?,?,?,?)').run(...key,brokerDigest,nowMs);
   const event={id:'r103-cancel-'+digest(clientId).slice(0,40),kind:'UNKNOWN',atMs:nowMs,cumulativeQuantity:'0'};
   this.#db.prepare("UPDATE intents SET state='UNKNOWN',updated_at=? WHERE owner=? AND connection=? AND client_id=?").run(nowMs,...key);
   this.#db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(...key,event.id,digest(event),JSON.stringify(event));
   return Object.freeze({claimed:true});
  });
 }
 snapshot(session,c){this.#account(session,c);return this.#db.prepare('SELECT client_id,state,held,filled FROM intents WHERE owner=? AND connection=?').all(session.userId,c.id);}
 close(){this.#db.close();}
}
