import {ExecutionLedger} from './execution-ledger.mjs';
import {digest} from './journal.mjs';
import {validateOperation,operationNet} from '../operation.mjs';

const fail=code=>{throw Error('R127_RECORD_'+code);};
const identifier=v=>typeof v==='string'&&/^[-A-Za-z0-9_.:]{1,120}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const strategies=['id','version','configDigest'];
const contextKeys=['sourcePlatform','connectionId','ownerScope','sessionId','strategy','product','evidenceMode'];

function contextFor(binding,context){
 if(!exact(binding,['account','environment','provider'])||typeof binding.account!=='string'||!binding.account||binding.account.length>256||binding.environment!=='demo')fail('DEMO_BINDING_REQUIRED');
 if(!exact(context,contextKeys)||!['jenios','flow'].includes(context.sourcePlatform)||!['connectionId','ownerScope','sessionId'].every(k=>identifier(context[k]))||context.evidenceMode!=='offline_fixture')fail('OFFLINE_CONTEXT_REQUIRED');
 if(!exact(context.strategy,strategies)||!identifier(context.strategy.id)||!identifier(context.strategy.version)||!hash(context.strategy.configDigest))fail('STRATEGY_REQUIRED');
 if(!({binance:['spot','usds_m_futures'],profit:['b3'],mt5:['b3']})[binding.provider]?.includes(context.product))fail('PRODUCT_SCOPE_REQUIRED');
 return freeze({sourcePlatform:context.sourcePlatform,connectionId:context.connectionId,ownerScope:context.ownerScope,sessionId:context.sessionId,strategy:{...context.strategy},product:context.product,evidenceMode:'offline_fixture'});
}

/** Additive local attribution and record handoff over the existing journal.
 * No network, new financial ledger, billing decision, native proof or execution
 * authorization. Only newly prepared offline intents can acquire attribution.
 */
export class AttributedExecutionLedgerR127 extends ExecutionLedger {
 constructor(path,binding,context){
  const checked=contextFor(binding,context);
  super(path,binding);
  this.recordContext=checked;
  this.recordScope=freeze({accountBinding:this.binding,provider:binding.provider,environment:binding.environment,product:checked.product,ownerScope:checked.ownerScope,connectionId:checked.connectionId});
  this.recordFeedId=digest({schema:'JENIOS_ULTRA_RECORD_FEED_R127',...this.recordScope});
  this.db.exec(`CREATE TABLE IF NOT EXISTS ultra_record_scope_r127(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_record_origin_r127(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_record_evidence_r127(operation_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(operation_id,revision));`);
  try{this.transaction(()=>{
   const current=this.db.prepare('SELECT digest FROM ultra_record_scope_r127 WHERE id=1').get();
   if(current&&current.digest!==this.recordFeedId)fail('JOURNAL_SCOPE_MISMATCH');
   this.db.prepare('INSERT OR IGNORE INTO ultra_record_scope_r127 VALUES(1,?,?)').run(JSON.stringify(this.recordScope),this.recordFeedId);
  });}catch(error){this.db.close();throw error;}
 }
 prepare(request,now){return this.transaction(()=>{
  const expectedMarket=this.recordScope.product==='b3'?'b3':'crypto';
  if(request?.market!==expectedMarket)fail('MARKET_SCOPE_MISMATCH');
  const intent=super.prepare(request,now);
  const origin={schema:'JENIOS_ULTRA_LOCAL_ORIGIN_R127',robot:'ultra',...this.recordScope,sourcePlatform:this.recordContext.sourcePlatform,sessionId:this.recordContext.sessionId,strategy:this.recordContext.strategy,evidenceMode:'offline_fixture',intentionDigest:digest(request)};
  const fingerprint=digest(origin),existing=this.db.prepare('SELECT digest FROM ultra_record_origin_r127 WHERE operation_id=?').get(intent.id);
  if(!intent.created){if(!existing||existing.digest!==fingerprint)fail('ATTRIBUTION_CONFLICT');return intent;}
  this.db.prepare('INSERT INTO ultra_record_origin_r127 VALUES(?,?,?)').run(intent.id,JSON.stringify(origin),fingerprint);
  return intent;
 });}
 applyReceipt(receipt,options={}){return this.transaction(()=>{
  const result=super.applyReceipt(receipt,options);
  if(result.operation&&!result.duplicate&&this.db.prepare('SELECT 1 FROM ultra_record_origin_r127 WHERE operation_id=?').get(result.operation.id)){
   const evidence={source:'offline_fixture',receiptId:receipt.receiptId,receiptDigest:digest(receipt),operationDigest:digest(result.operation),observedAtMs:receipt.observedAtMs,positionReconciled:receipt.positionReconciled,protectionConfirmed:receipt.protectionConfirmed,entryRemainderCancelled:receipt.entryRemainderCancelled,brokerAuthenticated:false,nativeValidated:false};
   this.db.prepare('INSERT OR IGNORE INTO ultra_record_evidence_r127 VALUES(?,?,?,?)').run(result.operation.id,result.operation.revision,JSON.stringify(evidence),digest(evidence));
  }
  return result;
 });}
 /** Full revision snapshots, never financial deltas. Cursor and event IDs are
  * stable across restart; platform labels cannot generate a second economic ID.
  */
 recordBatch({cursor=null,limit=100,now=Date.now()}={}){return this.transaction(()=>{
  if(!Number.isSafeInteger(now)||now<=0||!Number.isSafeInteger(limit)||limit<1||limit>1000)fail('INVALID_PAGE');
  if(cursor!==null&&(!exact(cursor,['feedId','sequence'])||cursor.feedId!==this.recordFeedId||!Number.isSafeInteger(cursor.sequence)||cursor.sequence<0))fail('CURSOR_SCOPE_MISMATCH');
  const after=cursor?.sequence??0;
  const maximum=this.db.prepare('SELECT coalesce(max(seq),0) AS seq FROM ultra_operation_audit').get().seq;
  if(after>maximum)fail('CURSOR_AHEAD_OF_JOURNAL');
  const rows=this.db.prepare(`SELECT a.seq,a.operation_id,a.revision,a.payload,
    o.payload AS origin,o.digest AS origin_digest,e.payload AS evidence,e.digest AS evidence_digest
    FROM ultra_operation_audit a LEFT JOIN ultra_record_origin_r127 o ON o.operation_id=a.operation_id
    LEFT JOIN ultra_record_evidence_r127 e ON e.operation_id=a.operation_id AND e.revision=a.revision
    WHERE a.seq>? ORDER BY a.seq LIMIT ?`).all(after,limit+1);
  const examined=rows.slice(0,limit),records=[];let excludedUnattributedCount=0;
  for(const row of examined){
   if(!row.origin){excludedUnattributedCount++;continue;}
   const origin=JSON.parse(row.origin),operation=validateOperation(JSON.parse(row.payload),{market:this.recordScope.product==='b3'?'b3':'crypto',now});
   if(digest(origin)!==row.origin_digest||Object.keys(this.recordScope).some(k=>origin[k]!==this.recordScope[k]))fail('ORIGIN_INTEGRITY_MISMATCH');
   const order=this.order(row.operation_id);
   if(!order||digest(order.request)!==origin.intentionDigest||operation.id!==row.operation_id||operation.revision!==row.revision)fail('INTENTION_LINK_MISSING');
   if(Date.parse(operation.updatedAt)>now)fail('FUTURE_SNAPSHOT');
   let evidence=null;
   if(row.evidence){
    evidence=JSON.parse(row.evidence);
    const receipt=this.db.prepare('SELECT digest FROM ultra_execution_receipts WHERE id=?').get(evidence.receiptId);
    if(digest(evidence)!==row.evidence_digest||evidence.operationDigest!==digest(operation)||receipt?.digest!==evidence.receiptDigest||evidence.source!=='offline_fixture'||evidence.brokerAuthenticated!==false||evidence.nativeValidated!==false)fail('EVIDENCE_INTEGRITY_MISMATCH');
   }
   const locallyConfirmed=evidence!==null&&evidence.positionReconciled===true&&operation.state!=='unknown';
   const operationKey=digest({schema:'JENIOS_ULTRA_OPERATION_KEY_R127',accountBinding:origin.accountBinding,product:origin.product,operationId:operation.id});
   const record={schema:'JENIOS_ULTRA_OPERATION_RECORD_R127',eventKind:'operation_snapshot',eventId:digest({operationKey,revision:operation.revision}),operationKey,sequence:row.seq,
    scope:{...this.recordScope,currency:operation.currency},origin:{robot:origin.robot,sourcePlatform:origin.sourcePlatform,sessionId:origin.sessionId,strategy:origin.strategy,intentionDigest:origin.intentionDigest},
    operation,evidence:{kind:'offline_fixture',localIntentLinked:true,receiptRecorded:evidence!==null,receipt:evidence,brokerAuthenticated:false,nativeValidated:false},
    result:{status:operation.state==='unknown'?'execution_uncertain':operation.state!=='closed'?'not_final':!locallyConfirmed?'unverified_snapshot':operation.costsComplete?'closed_complete':'awaiting_costs',
      afterBrokerCosts:locallyConfirmed?operationNet(operation):null,currency:operation.currency,costsComplete:operation.costsComplete,pendingFields:['gross','fees','financing'].filter(k=>operation[k]===null)},
    billingDecisionIncluded:false,financialActivationAllowed:false};
   records.push(freeze({...record,recordDigest:digest(record)}));
  }
  return freeze({schema:'JENIOS_ULTRA_OPERATION_RECORD_BATCH_R127',feedId:this.recordFeedId,scope:{...this.recordScope},generatedAt:new Date(now).toISOString(),evidenceMode:'offline_fixture',nativeValidated:false,
   records,excludedUnattributedCount,nextCursor:{feedId:this.recordFeedId,sequence:examined.at(-1)?.seq??after},hasMore:rows.length>limit,billingDecisionIncluded:false,financialActivationAllowed:false});
 });}
}
