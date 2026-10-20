/** B185 simulator: deterministic, no-network, no-credentials execution receipt sequence.
 * This models broker responses; it does not certify any external broker connection.
 */
const deny=code=>{throw Object.assign(new Error(code),{code});};
const scenarios=new Set(['accepted','partial_then_filled','partial_then_cancelled','rejected','timeout','filled']);
const states={accepted:['ACK'],partial_then_filled:['ACK','PARTIAL','FILLED'],partial_then_cancelled:['ACK','PARTIAL','CANCELLED'],rejected:['REJECTED'],timeout:['UNKNOWN'],filled:['FILLED']};
export function simulatePaperReceipt({clientOrderId,quantity,scenario,atMs}){
 if(typeof clientOrderId!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/).test(clientOrderId)||!scenarios.has(scenario)||!Number.isSafeInteger(atMs)||atMs<=0)deny('INVALID_SIMULATION');
 const qty=Number(quantity);if(!Number.isSafeInteger(qty)||qty<=0||qty>100000)deny('INVALID_SIM_QUANTITY');
 const partial=qty>1?String(Math.max(1,Math.floor(qty/2))):null;
 if(scenario.startsWith('partial')&&!partial)deny('PARTIAL_REQUIRES_MULTIPLE_UNITS');
 const events=states[scenario].map((kind,i)=>Object.freeze({
  id:'sim-'+clientOrderId+'-'+String(i+1),kind,atMs:atMs+i+1,
  cumulativeQuantity:kind==='PARTIAL'||(kind==='CANCELLED'&&scenario==='partial_then_cancelled')?partial:kind==='FILLED'?String(qty):'0'
 }));
 return Object.freeze({schema:'JENIOS_SIMULATOR_B185',clientOrderId,scenario,events:Object.freeze(events),networkCalls:0,ordersSent:0,realExecution:false,brokerAuthenticated:false,performanceProven:false,automaticRetryAllowed:false});
}
