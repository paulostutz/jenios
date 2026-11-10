import {createHash} from 'node:crypto';
import {BinanceActionJournalR119,canonicalProtocolJson} from './binance-action-journal-r119.mjs';
import {DurableBinanceAdapterR119} from './binance-durable-adapter-r119.mjs';
import {normalizeBinanceEventR120} from './binance-events-r120.mjs';
const fail=code=>{throw Error(code);};
const hash=value=>createHash('sha256').update(canonicalProtocolJson(value)).digest('hex');
const timestamp=value=>{if(!Number.isSafeInteger(value)||value<=0)fail('R120_INBOX_TIME_INVALID');return value;};
const nativeIdentity=o=>o?.orderId??o?.nativeId??o?.orderListId??null;
const result=extra=>({nativeValidated:false,canSubmit:false,financialRecordPending:true,protectionConfirmed:false,...extra});
/** Offline durable event evidence. It does not connect a stream or advance the
 * financial ledger. A locally synchronized inbox is NOT permission to trade. */
export class BinanceEventInboxR120 {
 constructor({ledger,binding}){
  if(!(ledger instanceof BinanceActionJournalR119)||!binding||Object.keys(binding).sort().join(',')!=='environment,keyFingerprint,mode,product'||binding.product!==ledger.product||binding.environment!=='demo'||binding.mode!=='offline_fixture'||! /^[a-f0-9]{64}$/.test(binding.keyFingerprint))fail('R120_INBOX_OFFLINE_BINDING_REQUIRED');
  Object.defineProperties(this,{ledger:{value:ledger},binding:{value:Object.freeze({...binding})}});
  const db=ledger.db;
  db.exec(`CREATE TABLE IF NOT EXISTS ultra_r120_scope(id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r120_stream(id INTEGER PRIMARY KEY CHECK(id=1),generation INTEGER NOT NULL,session TEXT NOT NULL,started INTEGER NOT NULL,last_received INTEGER NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r120_inbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,identity TEXT NOT NULL UNIQUE,digest TEXT NOT NULL,payload TEXT NOT NULL,session TEXT NOT NULL,received INTEGER NOT NULL,action_ids TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r120_incidents(seq INTEGER PRIMARY KEY AUTOINCREMENT,session TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r120_reconciliations(id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r120_queries(ticket TEXT NOT NULL,action_id TEXT NOT NULL,started INTEGER NOT NULL,completed_seq INTEGER,payload_digest TEXT,status TEXT NOT NULL,PRIMARY KEY(ticket,action_id));`);
  ledger.transaction(()=>{const fingerprint=hash({binding:this.binding,account:ledger.binding}),old=db.prepare('SELECT digest FROM ultra_r120_scope WHERE id=1').get();if(old&&old.digest!==fingerprint)fail('R120_INBOX_SCOPE_MISMATCH');if(!old)db.prepare('INSERT INTO ultra_r120_scope VALUES(1,?)').run(fingerprint);});
 }
 session(){return this.ledger.db.prepare('SELECT * FROM ultra_r120_stream WHERE id=1').get()??null;}
 watermark(){return this.ledger.db.prepare('SELECT coalesce(max(seq),0) AS n FROM ultra_r120_inbox').get().n;}
 incidentWatermark(){return this.ledger.db.prepare('SELECT coalesce(max(seq),0) AS n FROM ultra_r120_incidents').get().n;}
 entries(){return this.ledger.db.prepare('SELECT * FROM ultra_r120_inbox ORDER BY seq').all().map(r=>({...r,payload:JSON.parse(r.payload),action_ids:JSON.parse(r.action_ids)}));}
 incidents(){return this.ledger.db.prepare('SELECT * FROM ultra_r120_incidents ORDER BY seq').all().map(r=>({...r,detail:JSON.parse(r.detail)}));}
 #requireSession(id,now){this.ledger.ownsLease();const session=this.session();timestamp(now);if(!session||session.session!==id||session.status==='disconnected'||now<session.last_received)fail('R120_INBOX_SESSION_INVALID');return session;}
 #invalidate(reason,now,{kind='gap',detail={}}={}){
  const session=this.session();if(!session)fail('R120_INBOX_SESSION_REQUIRED');
  this.ledger.pause();this.ledger.db.prepare("UPDATE ultra_r120_stream SET status='reconcile_required',reason=?,last_received=? WHERE id=1").run(reason,now);
  this.ledger.db.prepare('INSERT INTO ultra_r120_incidents(session,kind,at,detail) VALUES(?,?,?,?)').run(session.session,kind,now,canonicalProtocolJson(detail));
  this.ledger.db.prepare("UPDATE ultra_r120_reconciliations SET status='invalidated' WHERE status='pending'").run();
 }
 startSession({now,reason='startup'}){return this.ledger.transaction(()=>{
  this.ledger.ownsLease();timestamp(now);if(!['startup','reconnect'].includes(reason))fail('R120_SESSION_REASON_INVALID');const old=this.session();if(old&&now<old.last_received)fail('R120_INBOX_TIME_REGRESSED');
  const generation=(old?.generation??0)+1,session='rs120_'+hash({account:this.ledger.binding,binding:this.binding,generation,now}).slice(0,40);
  this.ledger.db.prepare("INSERT INTO ultra_r120_stream VALUES(1,?,?,?,?,'reconcile_required',?) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,session=excluded.session,started=excluded.started,last_received=excluded.last_received,status=excluded.status,reason=excluded.reason").run(generation,session,now,now,reason);
  this.#invalidate(reason,now);return result({sessionId:session,generation,needsReconciliation:true});
 });}
 disconnect({sessionId,now,reason='disconnect'}){return this.ledger.transaction(()=>{this.#requireSession(sessionId,now);if(!['disconnect','listen_key_expired','subscription_ended','heartbeat_expired'].includes(reason))fail('R120_DISCONNECT_REASON_INVALID');this.#invalidate(reason,now);this.ledger.db.prepare("UPDATE ultra_r120_stream SET status='disconnected' WHERE id=1").run();return result({needsReconciliation:true});});}
 #association(event){
  const refs=event.lookupReferences??[],actions=[],conflicts=[];
  for(const action of this.ledger.nativeActions()){
   if(action.role==='cancel'||this.binding.product==='usds_m_futures'&&action.expected.binding?.keyFingerprint!==this.binding.keyFingerprint)continue;
   const expected=action.expected,history=this.ledger.observationsNative(action.id).map(o=>o.nativeObservation),known=history.find(o=>nativeIdentity(o));
   const direct=refs.find(r=>r.kind===expected.kind&&r.clientId===expected.clientId&&(r.symbol===undefined||r.symbol===null||r.symbol===expected.symbol));
   const child=!direct&&expected.kind==='list'?refs.find(r=>r.kind==='order'&&expected.childClientIds?.includes(r.clientId)&&r.symbol===expected.symbol):null;
   const triggered=!direct&&!child&&expected.kind==='algo'&&event.kind==='order'&&event.symbol===expected.symbol&&history.some(o=>o?.actualOrderId&&o.actualOrderId===event.orderId);
   if(!direct&&!child&&!triggered)continue;
   let conflict=['prepared','not_sent','rejected'].includes(action.state)||this.binding.product==='usds_m_futures'&&event.positionSide!=='BOTH';
   if(triggered){conflict ||= event.side!==expected.side||event.positionSide!=='BOTH';}
   else if(child){
    const linked=known?.orders?.find(o=>o.clientOrderId===child.clientId),params=action.request.params;
    const childSide=params.workingClientOrderId===child.clientId?params.workingSide:(params.pendingSide??params.side);
    // A child is owned only when the native list and native child IDs were
    // durably observed together; matching a symbol or client label is not enough.
    if(!linked||!event.orderListId)continue;
    conflict ||= String(event.orderListId)!==String(known.orderListId)||String(child.nativeId)!==String(linked.orderId)||event.side!==childSide;
   }else conflict ||= Boolean(event.side&&expected.side!==event.side||direct.nativeId&&nativeIdentity(known)&&String(direct.nativeId)!==String(nativeIdentity(known)));
   if(expected.kind==='algo'&&event.kind==='algo'&&event.actualOrderId&&history.some(o=>o?.actualOrderId&&o.actualOrderId!==event.actualOrderId))conflict=true;
   if(conflict)conflicts.push(action.id);else actions.push(action.id);
  }
  if(actions.length>1)conflicts.push(...actions);

  return {actions:actions.sort(),conflicts:conflicts.sort()};
 }
 ingest({sessionId,payload,receivedAtMs}){return this.ledger.transaction(()=>{
  this.#requireSession(sessionId,receivedAtMs);let event;
  try{if(canonicalProtocolJson(payload).length>64000)fail('EVENT_TOO_LARGE');event=normalizeBinanceEventR120({binding:this.binding,payload});if(canonicalProtocolJson(event).length>64000)fail('EVENT_TOO_LARGE');const eventTime=event.eventTime;if(eventTime!==null&&eventTime!==undefined&&BigInt(eventTime)>BigInt(receivedAtMs+1000))fail('EVENT_FROM_FUTURE');}
  catch{this.#invalidate('event_unverified',receivedAtMs,{kind:'invalid_event'});return result({accepted:false,reason:'event_unverified',needsReconciliation:true});}
  const encoded=canonicalProtocolJson(event.canonicalPayload),digest=hash(event.canonicalPayload),old=this.ledger.db.prepare('SELECT * FROM ultra_r120_inbox WHERE identity=?').get(event.identityKey);
  if(old){if(old.digest!==digest){this.#invalidate('conflicting_event',receivedAtMs,{kind:'conflict',detail:{identityKey:event.identityKey,previousDigest:old.digest,incomingDigest:digest}});return result({accepted:false,duplicate:false,conflict:true,needsReconciliation:true});}this.ledger.db.prepare('UPDATE ultra_r120_stream SET last_received=? WHERE id=1').run(receivedAtMs);return result({accepted:true,duplicate:true,conflict:false,needsReconciliation:this.session().status!=='locally_synchronized'});}
  const {actions,conflicts}=this.#association(event);
  if(conflicts.length){this.#invalidate('event_identity_or_send_state_conflict',receivedAtMs,{kind:'conflict',detail:{identityKey:event.identityKey,actionIds:conflicts}});return result({accepted:false,conflict:true,needsReconciliation:true});}
  this.ledger.db.prepare('INSERT INTO ultra_r120_inbox(identity,digest,payload,session,received,action_ids) VALUES(?,?,?,?,?,?)').run(event.identityKey,digest,encoded,sessionId,receivedAtMs,canonicalProtocolJson(actions));
  this.#invalidate(actions.length?'event_requires_query':'unowned_or_unknown_event',receivedAtMs,{kind:'event',detail:{identityKey:event.identityKey,matchedActions:actions,eventType:event.eventType}});
  return result({accepted:true,duplicate:false,conflict:false,matchedActionIds:actions,needsReconciliation:true});
 });}
 beginReconciliation({sessionId,now}){return this.ledger.transaction(()=>{
  const session=this.#requireSession(sessionId,now),actions=this.ledger.nativeActions().filter(a=>['sending','unknown','observed'].includes(a.state));
  const scope=actions.map(a=>({actionId:a.id,requestDigest:a.request_digest,expected:a.expected,lookup:a.lookup}));
  const observedWatermarks=Object.fromEntries(actions.map(a=>[a.id,this.ledger.nativeEvents(a.id).at(-1)?.seq??0]));
  const attempt=this.ledger.db.prepare('SELECT count(*) AS n FROM ultra_r120_reconciliations').get().n+1;
  const payload={attempt,sessionId,generation:session.generation,watermark:this.watermark(),incidentWatermark:this.incidentWatermark(),scope,observedWatermarks,startedAtMs:now};
  const id='rr120_'+hash(payload).slice(0,40);this.ledger.db.prepare("UPDATE ultra_r120_reconciliations SET status='invalidated' WHERE status='pending'").run();this.ledger.db.prepare("INSERT OR IGNORE INTO ultra_r120_reconciliations VALUES(?,?,'pending',?)").run(id,canonicalProtocolJson(payload),now);
  return result({ticketId:id,queries:scope.map(s=>{const lookup=structuredClone(s.lookup);if(lookup.params.timestamp!==undefined)lookup.params.timestamp=now;return {actionId:s.actionId,lookup};}),needsReconciliation:true});
 });}
 #pendingTicket(ticketId,now){
  this.ledger.ownsLease();timestamp(now);const row=this.ledger.db.prepare('SELECT * FROM ultra_r120_reconciliations WHERE id=?').get(ticketId);if(!row||row.status!=='pending')fail('R120_RECONCILIATION_TICKET_INVALID');const ticket=JSON.parse(row.payload);this.#requireSession(ticket.sessionId,now);if(now<ticket.startedAtMs||now-ticket.startedAtMs>5000)fail('R120_RECONCILIATION_FENCE_CHANGED');return ticket;
 }
 #queryIdentityConsistent(action,observation){
  const id=nativeIdentity(observation);if(!id||this.binding.product==='usds_m_futures'&&observation.positionSide!=='BOTH')return false;
  for(const prior of this.ledger.observationsNative(action.id).map(o=>o.nativeObservation)){
   if(nativeIdentity(prior)&&String(nativeIdentity(prior))!==String(id))return false;
   if(prior?.actualOrderId&&prior.actualOrderId!==observation.actualOrderId)return false;
   for(const child of prior?.orders??[]){const current=observation.orders?.find(o=>o.clientOrderId===child.clientOrderId);if(!current||current.orderId!==child.orderId)return false;}
  }
  for(const row of this.entries().filter(e=>e.action_ids.includes(action.id))){
   const event=normalizeBinanceEventR120({binding:this.binding,payload:row.payload});
   if(action.expected.kind==='algo'&&event.kind==='algo'&&event.actualOrderId&&event.actualOrderId!==observation.actualOrderId)return false;
   for(const ref of event.lookupReferences){
    if(ref.kind===action.expected.kind&&ref.clientId===action.expected.clientId&&ref.nativeId&&String(ref.nativeId)!==String(id))return false;
    if(action.expected.kind==='list'&&ref.kind==='order'&&action.expected.childClientIds?.includes(ref.clientId)){
     const child=observation.orders?.find(o=>o.clientOrderId===ref.clientId);if(!child||child.orderId!==ref.nativeId||event.orderListId&&String(event.orderListId)!==String(id))return false;
    }
   }
  }
  return true;
 }
 /** This method owns the query invocation. A delayed query begun outside this
  * ticket cannot satisfy the fence simply because its response arrived later. */
 async reconcileTicket({ticketId,adapter}){
  if(!(adapter instanceof DurableBinanceAdapterR119)||adapter.ledger!==this.ledger)fail('R120_OFFLINE_RECONCILER_REQUIRED');
  const ticket=this.ledger.transaction(()=>this.#pendingTicket(ticketId,adapter.now()));
  for(const scoped of ticket.scope){
   const before=this.ledger.transaction(()=>{this.#pendingTicket(ticketId,adapter.now());if(this.ledger.db.prepare('SELECT 1 FROM ultra_r120_queries WHERE ticket=? AND action_id=?').get(ticketId,scoped.actionId))fail('R120_QUERY_ALREADY_STARTED');this.ledger.db.prepare("INSERT INTO ultra_r120_queries VALUES(?,?,?,NULL,NULL,'started')").run(ticketId,scoped.actionId,adapter.now());return this.ledger.nativeEvents(scoped.actionId).at(-1)?.seq??0;});
   const response=await adapter.reconcile(scoped.actionId);
   this.ledger.transaction(()=>{
    this.#pendingTicket(ticketId,adapter.now());const latest=this.ledger.nativeEvents(scoped.actionId).at(-1),observation=latest?.payload;
    if(!latest||latest.seq<=before||latest.state!=='observed'||observation.source!=='rest_query'||response.state!=='observed'||response.actionId!==scoped.actionId||canonicalProtocolJson(response.nativeObservation)!==canonicalProtocolJson(observation.nativeObservation))fail('R120_NATIVE_QUERY_PENDING');
    if(!this.#queryIdentityConsistent(this.ledger.nativeAction(scoped.actionId),observation.nativeObservation))fail('R120_NATIVE_IDENTITY_CONFLICT');
    this.ledger.db.prepare("UPDATE ultra_r120_queries SET completed_seq=?,payload_digest=?,status='complete' WHERE ticket=? AND action_id=?").run(latest.seq,hash(observation),ticketId,scoped.actionId);
   });
  }
  return result({queriesRecorded:ticket.scope.length,needsReconciliation:true});
 }
 /** Consumes already-durable REST observations, never caller booleans or event
  * snapshots. A local race or unresolved identity conflict invalidates the fence. */
 finishReconciliation({ticketId,now}){return this.ledger.transaction(()=>{
  this.ledger.ownsLease();timestamp(now);const row=this.ledger.db.prepare('SELECT * FROM ultra_r120_reconciliations WHERE id=?').get(ticketId);if(!row||row.status!=='pending')fail('R120_RECONCILIATION_TICKET_INVALID');const ticket=JSON.parse(row.payload);this.#requireSession(ticket.sessionId,now);
  const actions=this.ledger.nativeActions().filter(a=>['sending','unknown','observed'].includes(a.state));
  const sameScope=canonicalProtocolJson(actions.map(a=>({actionId:a.id,requestDigest:a.request_digest,expected:a.expected,lookup:a.lookup})))===canonicalProtocolJson(ticket.scope);
  if(now<ticket.startedAtMs||now-ticket.startedAtMs>5000||ticket.watermark!==this.watermark()||ticket.incidentWatermark!==this.incidentWatermark()||!sameScope)fail('R120_RECONCILIATION_FENCE_CHANGED');
  // An unresolved raw-identity conflict cannot be waved away by order status.
  if(this.incidents().some(i=>i.kind==='conflict'))fail('R120_EVENT_CONFLICT_UNRESOLVED');
  if(this.incidents().some(i=>i.kind==='invalid_event'||i.kind==='event'&&!i.detail.matchedActions?.length))fail('R120_UNOWNED_OR_INVALID_EVENT_UNRESOLVED');
  for(const action of actions){const query=this.ledger.db.prepare('SELECT * FROM ultra_r120_queries WHERE ticket=? AND action_id=?').get(ticketId,action.id);const nativeEvent=this.ledger.nativeEvents(action.id).at(-1),observation=nativeEvent?.payload;if(query?.status!=='complete'||query.completed_seq!==nativeEvent?.seq||query.started<ticket.startedAtMs||query.payload_digest!==hash(observation)||nativeEvent?.seq<=ticket.observedWatermarks[action.id]||nativeEvent?.state!=='observed'||action.state!=='observed'||observation?.source!=='rest_query'||observation.observedAtMs<ticket.startedAtMs||observation.observedAtMs>now||!observation.nativeObservation)fail('R120_NATIVE_QUERY_PENDING');}
  this.ledger.db.prepare("UPDATE ultra_r120_reconciliations SET status='complete' WHERE id=?").run(ticketId);
  this.ledger.db.prepare("UPDATE ultra_r120_stream SET status='locally_synchronized',reason='synthetic_queries_recorded',last_received=? WHERE id=1").run(now);
  return result({locallySynchronized:true,needsReconciliation:false,financialReconciliationRequired:true,tradeActivationAllowed:false});
 });}
}
