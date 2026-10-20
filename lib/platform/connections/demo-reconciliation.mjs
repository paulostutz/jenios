/** B163 — conservative reconciliation for DEMO/PAPER observations.
 * Missing data is never interpreted as a fill, cancellation, close, profit, or protection.
 */
const KEY=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/;
const DECIMAL=/^-?(?:0|[1-9]\d{0,20})(?:\.\d{1,18})?$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
function time(v){if(!Number.isSafeInteger(v)||v<0)fail('INVALID_OBSERVATION_TIME');return v;}
function key(v){if(typeof v!=='string'||!KEY.test(v))fail('INVALID_EXTERNAL_KEY');return v;}
function decimal(v){if(typeof v!=='string'||!DECIMAL.test(v))fail('INVALID_DECIMAL');return v;}
function environment(provider,env){
 if(provider==='binance'&&env==='testnet')return;
 if(provider==='alpaca'&&env==='paper')return;
 fail('DEMO_ENVIRONMENT_REQUIRED');
}
function list(value,name,project){
 if(!Array.isArray(value)||value.length>5000)fail('INVALID_'+name.toUpperCase());
 const seen=new Set();
 return value.map(item=>{if(!record(item))fail('INVALID_'+name.toUpperCase());const p=project(item);if(seen.has(p.key))fail('DUPLICATE_EXTERNAL_KEY');seen.add(p.key);return p;});
}
function position(item){return {key:key(item.key),symbol:key(item.symbol),side:['long','short','spot'].includes(item.side)?item.side:fail('INVALID_POSITION_SIDE'),quantity:decimal(item.quantity)};}
function order(item){return {key:key(item.key),symbol:key(item.symbol),side:['buy','sell'].includes(item.side)?item.side:fail('INVALID_ORDER_SIDE'),status:key(item.status),quantity:decimal(item.quantity),filledQuantity:decimal(item.filledQuantity)};}
function snapshot(value){
 if(!record(value)||value.complete!==true||value.accountReadConfirmed!==true)fail('COMPLETE_AUTHENTICATED_SNAPSHOT_REQUIRED');
 environment(value.provider,value.environment);const observedAtMs=time(value.observedAtMs);
 return {provider:value.provider,environment:value.environment,observedAtMs,
  positions:list(value.positions,'positions',position),openOrders:list(value.openOrders,'orders',order)};
}
const mapByKey=items=>new Map(items.map(item=>[item.key,item]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function changes(before,after,missingState){
 const old=mapByKey(before),next=mapByKey(after),added=[],changed=[],missing=[];
 for(const [k,value] of next){const prior=old.get(k);if(!prior)added.push(value);else if(!same(prior,value))changed.push({before:prior,after:value});}
 for(const [k,value] of old)if(!next.has(k))missing.push({previous:value,state:missingState});
 return {added,changed,missing};
}
export function reconcileDemoSnapshots(previous,current){
 const before=snapshot(previous),after=snapshot(current);
 if(before.provider!==after.provider||before.environment!==after.environment)fail('SNAPSHOT_SCOPE_MISMATCH');
 if(after.observedAtMs<=before.observedAtMs)fail('NON_MONOTONIC_OBSERVATION');
 const positions=changes(before.positions,after.positions,'no_longer_reported_unclassified');
 const orders=changes(before.openOrders,after.openOrders,'no_longer_open_unclassified');
 const changed=positions.added.length+positions.changed.length+positions.missing.length+orders.added.length+orders.changed.length+orders.missing.length;
 return Object.freeze({
  schema:'JENIOS_DEMO_RECONCILIATION_B163',provider:after.provider,environment:after.environment,
  previousObservedAtMs:before.observedAtMs,currentObservedAtMs:after.observedAtMs,
  positions,orders,changeCount:changed,reconciliationComplete:true,
  missingMeansClosed:false,missingMeansCancelled:false,missingMeansFilled:false,
  protectionVerified:false,performanceVerified:false,liveExecution:false,
  reviewRequired:positions.missing.length>0||orders.missing.length>0
 });
}
