import {createHash} from 'node:crypto';
import {ExecutionLedger} from './execution-ledger.mjs';
const fail=code=>{throw Error(code);};
export function canonicalProtocolJson(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalProtocolJson).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalProtocolJson(value[k])).join(',')+'}';
 fail('R119_NON_JSON_PROTOCOL_DATA');
}
function assertNoCredentials(value){if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(/secret|password|signature|apikey|authorization|token|credential|headers/i.test(key))fail('R119_PROTOCOL_CREDENTIAL_OR_PARAM_REJECTED');assertNoCredentials(child);}}
const decimal18=value=>{if(typeof value!=='string'||! /^(0|[1-9]\d{0,17})(\.\d{1,18})?$/.test(value))fail('R119_NATIVE_QUANTITY_INVALID');const [a,b='']=value.split('.');return BigInt(a)*10n**18n+BigInt(b.padEnd(18,'0'));};
const hash=value=>createHash('sha256').update(canonicalProtocolJson(value)).digest('hex');
export const BINANCE_PROTOCOL_PRODUCTS=Object.freeze(['spot','usds_m_futures']);
const endpoints={spot:{POST:['/api/v3/order','/api/v3/orderList/oco','/api/v3/orderList/otoco'],DELETE:['/api/v3/order','/api/v3/orderList'],GET:['/api/v3/order','/api/v3/orderList']},usds_m_futures:{POST:['/fapi/v1/order','/fapi/v1/algoOrder'],DELETE:['/fapi/v1/order','/fapi/v1/algoOrder'],GET:['/fapi/v1/order','/fapi/v1/algoOrder']}};
/** Only unsigned descriptors. This is not a credential store or HTTP client. */
export function validateSandboxDescriptor(request,product,{lookup=false}={}){
 if(!request||request.product!==product||!BINANCE_PROTOCOL_PRODUCTS.includes(product)||!endpoints[product][request.method]?.includes(request.path)||(lookup?request.method!=='GET':request.method==='GET')||request.signed!==false||!(request.executable===false||request.canSubmit===false))fail('R119_UNSIGNED_PROTOCOL_DESCRIPTOR_REQUIRED');
 if(!request.params||Object.getPrototypeOf(request.params)!==Object.prototype||Object.keys(request.params).length>40)fail('R119_PROTOCOL_PARAMS_INVALID');
 for(const [key,value] of Object.entries(request.params)){
  if(/secret|password|signature|apikey|authorization|token|credential/i.test(key)||!['string','number','boolean'].includes(typeof value)||typeof value==='string'&&value.length>200||typeof value==='number'&&!Number.isSafeInteger(value))fail('R119_PROTOCOL_CREDENTIAL_OR_PARAM_REJECTED');
 }
 if(Object.keys(request).some(key=>/secret|password|signature|apikey|authorization|token|credential|url|origin|host|headers/i.test(key)))fail('R119_PROTOCOL_CREDENTIAL_OR_PARAM_REJECTED');
 if(request.params.recvWindow!==undefined&&(!Number.isSafeInteger(request.params.recvWindow)||request.params.recvWindow<1||request.params.recvWindow>5000))fail('R119_PROTOCOL_WINDOW_INVALID');
 assertNoCredentials(request);if(canonicalProtocolJson(request).length>32000)fail('R119_PROTOCOL_TOO_LARGE');return request;
}
function requestTarget(r){
 if(r.path.endsWith('/algoOrder'))return {kind:'algo',clientId:r.params.clientAlgoId};
 if(r.path.includes('/orderList'))return {kind:'list',clientId:r.params.listClientOrderId??r.params.origClientOrderId};
 return {kind:'order',clientId:r.params.newClientOrderId??r.params.origClientOrderId};
}
/** Durable product-isolated native action journal. Trading remains unavailable. */
export class BinanceActionJournalR119 extends ExecutionLedger {
 constructor(path,binding,{product}){
  if(binding.provider!=='binance'||binding.environment!=='demo'||!BINANCE_PROTOCOL_PRODUCTS.includes(product))fail('R119_OFFLINE_BINANCE_SCOPE_REQUIRED');
  super(path,binding);Object.defineProperty(this,'product',{value:product,enumerable:true});
  this.db.exec(`CREATE TABLE IF NOT EXISTS ultra_r119_scope(id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r119_actions(id TEXT PRIMARY KEY,operation_id TEXT NOT NULL,role TEXT NOT NULL,target_key TEXT NOT NULL UNIQUE,request_digest TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,updated INTEGER NOT NULL,command_id TEXT UNIQUE);
   CREATE TABLE IF NOT EXISTS ultra_r119_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,action_id TEXT NOT NULL,state TEXT NOT NULL,at INTEGER NOT NULL,payload TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_r119_observations(id TEXT PRIMARY KEY,action_id TEXT NOT NULL,payload TEXT NOT NULL);`);
  this.transaction(()=>{const fingerprint=hash({accountBinding:this.binding,product,mode:'offline_fixture'}),old=this.db.prepare('SELECT digest FROM ultra_r119_scope WHERE id=1').get();if(old&&old.digest!==fingerprint)fail('R119_PRODUCT_JOURNAL_MISMATCH');if(!old)this.db.prepare('INSERT INTO ultra_r119_scope VALUES(1,?)').run(fingerprint);});
 }
 nativeAction(id){const row=this.db.prepare('SELECT * FROM ultra_r119_actions WHERE id=?').get(id);return row?{...row,...JSON.parse(row.payload)}:null;}
 nativeActions(){return this.db.prepare('SELECT id FROM ultra_r119_actions ORDER BY rowid').all().map(row=>this.nativeAction(row.id));}
 nativeEvents(id){return this.db.prepare('SELECT * FROM ultra_r119_events WHERE action_id=? ORDER BY seq').all(id).map(r=>({...r,payload:JSON.parse(r.payload)}));}
 prepareNative({operationId,role,request,lookup,expected,commandId=null},now){
  return this.transaction(()=>{
   this.ownsLease();const operation=this.operation(operationId);
   if(!operation||!['entry','stop','target','protection_list','entry_with_protection','cancel','close'].includes(role)||!Number.isSafeInteger(now))fail('R119_NATIVE_INTENT_SCOPE_REQUIRED');
   validateSandboxDescriptor(request,this.product);validateSandboxDescriptor(lookup,this.product,{lookup:true});
   const target=requestTarget(request),queryTarget=requestTarget(lookup);
   if(typeof target.clientId!=='string'||! /^[.A-Za-z0-9_:/-]{1,36}$/.test(target.clientId)||target.kind!==queryTarget.kind||target.clientId!==queryTarget.clientId)fail('R119_NATIVE_LOOKUP_TARGET_MISMATCH');
   if(!expected||expected.product!==this.product||expected.kind!==target.kind||expected.clientId!==target.clientId||expected.symbol!==operation.symbol||Object.keys(expected).some(k=>!['product','kind','clientId','symbol','side','binding','childClientIds'].includes(k)))fail('R119_NATIVE_REFERENCE_REQUIRED');
   const nativeSide=request.params.side??request.params.workingSide;
   if(request.params.symbol&&request.params.symbol!==operation.symbol||lookup.params.symbol&&lookup.params.symbol!==operation.symbol)fail('R119_NATIVE_SYMBOL_MISMATCH');
   if(['entry','entry_with_protection'].includes(role)&&nativeSide!==operation.side.toUpperCase())fail('R119_STRATEGY_DIRECTION_MISMATCH');
   if(['close','stop','target','protection_list'].includes(role)&&nativeSide!==(operation.side==='buy'?'SELL':'BUY'))fail('R119_EXIT_DIRECTION_MISMATCH');
   if(role!=='cancel'&&expected.side!==nativeSide)fail('R119_EXPECTED_SIDE_MISMATCH');
   if(role==='cancel'&&!this.nativeActions().some(a=>a.operation_id===operationId&&a.role!=='cancel'&&a.expected.kind===target.kind&&a.expected.clientId===target.clientId))fail('R119_CANCEL_TARGET_NOT_OWNED');
   if(role==='cancel'&&request.method!=='DELETE'||role!=='cancel'&&request.method!=='POST')fail('R119_NATIVE_ROLE_METHOD_MISMATCH');
   assertNoCredentials(expected);
   if(target.kind==='list'){if(!Array.isArray(expected.childClientIds)||![2,3].includes(expected.childClientIds.length)||new Set(expected.childClientIds).size!==expected.childClientIds.length||expected.childClientIds.some(id=>typeof id!=='string'||! /^[A-Za-z0-9_-]{1,36}$/.test(id)))fail('R119_LIST_CHILD_IDENTITIES_REQUIRED');const children=['workingClientOrderId','aboveClientOrderId','belowClientOrderId','pendingAboveClientOrderId','pendingBelowClientOrderId'].filter(k=>request.params[k]).map(k=>request.params[k]);if(request.method==='POST'&&canonicalProtocolJson(children.slice().sort())!==canonicalProtocolJson(expected.childClientIds.slice().sort()))fail('R119_LIST_CHILD_IDENTITIES_MISMATCH');}
   if(this.product==='usds_m_futures'&&!expected.binding)fail('R119_NATIVE_BINDING_INVALID');
   if(expected.binding){const b=expected.binding;if(Object.keys(b).some(k=>!['product','environment','keyFingerprint'].includes(k))||b.product!==this.product||b.environment!=='demo'||! /^[a-f0-9]{64}$/.test(b.keyFingerprint))fail('R119_NATIVE_BINDING_INVALID');if(canonicalProtocolJson(request.binding)!==canonicalProtocolJson(b)||canonicalProtocolJson(lookup.binding)!==canonicalProtocolJson(b))fail('R119_NATIVE_BINDING_MISMATCH');}
   const quantity=request.params.quantity??request.params.workingQuantity;
   if(['entry','entry_with_protection'].includes(role)){if(this.paused())fail('R119_ENTRY_NOT_ACTIVE');if(decimal18(quantity)!==decimal18(operation.requestedQuantity))fail('R119_NATIVE_ENTRY_QUANTITY_MISMATCH');const originalPrice=this.order(operationId).request.entryPrice;if(originalPrice!==undefined){const text=typeof originalPrice==='number'?originalPrice.toFixed(12):originalPrice;if(decimal18(request.params.price??request.params.workingPrice)!==decimal18(text))fail('R119_NATIVE_ENTRY_PRICE_MISMATCH');}}
   if(['close','stop','target','protection_list'].includes(role)&&(!quantity||decimal18(quantity)<=0n||decimal18(quantity)>decimal18(operation.entryQuantity)-decimal18(operation.exitQuantity)))fail('R119_NATIVE_EXPOSURE_QUANTITY_MISMATCH');
   if(role==='close'){const command=this.commands({pending:false}).find(c=>c.id===commandId);if(!command||command.kind!=='close'||command.operation_id!==operationId||!['prepared','sending','unknown'].includes(command.state)||decimal18(command.request.quantity)!==decimal18(quantity))fail('R119_DURABLE_CLOSE_COMMAND_REQUIRED');}else if(commandId!==null)fail('R119_UNEXPECTED_NATIVE_COMMAND');
   const payload={operationId,role,request,lookup,expected,commandId},targetKey=hash({product:this.product,method:request.method,target});
   const prior=this.db.prepare('SELECT id,request_digest FROM ultra_r119_actions WHERE target_key=?').get(targetKey),digest=hash(payload);
   if(prior){if(prior.request_digest!==digest)fail('R119_NATIVE_INTENT_CONFLICT');return {id:prior.id,created:false};}
   const singleRole=['entry','entry_with_protection'].includes(role)?['entry','entry_with_protection']:[role];
   if(['entry','entry_with_protection','stop','target','protection_list'].includes(role)&&this.nativeActions().some(a=>a.operation_id===operationId&&singleRole.includes(a.role)))fail('R119_OPERATION_ROLE_ALREADY_BOUND');
   if(commandId&&this.nativeActions().some(a=>a.commandId===commandId))fail('R119_CLOSE_COMMAND_ALREADY_BOUND');
   const id='na119_'+targetKey.slice(0,40);
   this.db.prepare('INSERT INTO ultra_r119_actions VALUES(?,?,?,?,?,?,?,?,?)').run(id,operationId,role,targetKey,digest,canonicalProtocolJson(payload),'prepared',now,commandId);
   this.db.prepare('INSERT INTO ultra_r119_events(action_id,state,at,payload) VALUES(?,?,?,?)').run(id,'prepared',now,'{}');
   return {id,created:true};
  });
 }
 transitionNative(id,from,to,{now,payload={}}){
  return this.transaction(()=>{
   this.ownsLease();
   const paths={prepared:['sending','not_sent'],sending:['unknown','observed','rejected'],unknown:['unknown','observed'],observed:['observed','unknown'],rejected:[],not_sent:[]};
   if(!paths[from]?.includes(to)||!Number.isSafeInteger(now))fail('R119_NATIVE_TRANSITION_INVALID');
   const action=this.nativeAction(id);
   if(to==='sending'){const lease=this.db.prepare('SELECT heartbeat FROM runner WHERE id=1').get();if(!lease||now-lease.heartbeat>10000)fail('R119_RUNNER_HEARTBEAT_STALE');const timestamp=action.request.params.timestamp;if(timestamp!==undefined&&(!Number.isSafeInteger(timestamp)||timestamp>now||now-timestamp>(action.request.params.recvWindow??5000)))fail('R119_NATIVE_REQUEST_STALE');if(action.commandId){const command=this.commands().find(c=>c.id===action.commandId);if(command?.state!=='prepared')fail('R119_CLOSE_COMMAND_NOT_PREPARED');this.markCommand(action.commandId,'prepared','sending',now);}if(['entry','entry_with_protection'].includes(action.role)){if(this.paused())fail('R119_ENTRY_NOT_ACTIVE');const state=this.order(action.operation_id).state;if(state==='prepared')this.transition(action.operation_id,'prepared','sending',null,now);else if(state!=='sending')fail('R119_ENTRY_ALREADY_RESOLVED');}}
   if(this.db.prepare('UPDATE ultra_r119_actions SET state=?,updated=? WHERE id=? AND state=?').run(to,now,id,from).changes!==1)fail('R119_NATIVE_ACTION_STATE_CHANGED');
   const encoded=canonicalProtocolJson(payload);
   this.db.prepare('INSERT INTO ultra_r119_events(action_id,state,at,payload) VALUES(?,?,?,?)').run(id,to,now,encoded);
   if(to==='observed')this.db.prepare('INSERT OR IGNORE INTO ultra_r119_observations VALUES(?,?,?)').run(hash({id,payload}),id,encoded);
   if(to==='unknown'){this.pause();if(action.commandId&&this.commands().find(c=>c.id===action.commandId)?.state==='sending')this.markCommand(action.commandId,'sending','unknown',now);if(['entry','entry_with_protection'].includes(action.role)&&this.order(action.operation_id).state==='sending')this.transition(action.operation_id,'sending','unknown',{reason:'NATIVE_RESULT_UNKNOWN'},now);}
  });
 }
 observationsNative(id){return this.db.prepare('SELECT payload FROM ultra_r119_observations WHERE action_id=? ORDER BY rowid').all(id).map(r=>JSON.parse(r.payload));}
}
