/** B173: normalize Alpaca Paper order observations for the existing B152 ledger.
 * Read-only input. Never infers execution from disappearance or resends a timed-out order.
 */
import {units,digest} from '../pilot-prep/contracts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const k=v=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(v)?v:fail('INVALID_BROKER_REFERENCE');
export function observeAlpacaPaperOrder({expectedClientOrderId,expectedSymbol,environment,accountMatched,observation,observedAtMs}){
 if(environment!=='paper'||accountMatched!==true)fail('UNVERIFIED_PAPER_ACCOUNT');
 if(!Number.isSafeInteger(observedAtMs)||observedAtMs<=0)fail('INVALID_OBSERVATION_TIME');
 k(expectedClientOrderId);k(expectedSymbol);
 if(!observation||typeof observation!=='object'||Array.isArray(observation))fail('MISSING_BROKER_ORDER');
 if(observation.client_order_id!==expectedClientOrderId||observation.symbol!==expectedSymbol||!observation.id)fail('BROKER_ORDER_MISMATCH');
 k(observation.id);
 const qty=units(observation.qty),filled=units(observation.filled_qty);
 if(qty<=0n||filled>qty)fail('INVALID_BROKER_QUANTITY');
 const status=observation.status;
 const pending=new Set(['accepted','pending_new','new','accepted_for_bidding','pending_replace']);
 const uncertain=new Set(['pending_cancel','stopped','suspended','done_for_day','calculated','replaced']);
 const terminal=new Set(['canceled','cancelled','expired','rejected','filled']);
 if(!pending.has(status)&&!uncertain.has(status)&&!terminal.has(status)&&status!=='partially_filled')fail('UNKNOWN_BROKER_STATUS');
 let kind,manual=false;
 if(status==='filled'){
  if(filled!==qty)fail('INCONSISTENT_FILLED_STATUS');kind='FILLED';
 }else if(status==='partially_filled'){
  if(filled<=0n||filled>=qty)fail('INCONSISTENT_PARTIAL_STATUS');kind='PARTIAL';
 }else if(['canceled','cancelled','expired'].includes(status)){
  kind='CANCELLED';manual=filled>0n; // a partial cancellation retains risk in the B152 ledger
 }else if(status==='rejected'){
  if(filled>0n)fail('INCONSISTENT_REJECTED_STATUS');kind='REJECTED';
 }else if(uncertain.has(status)){
  kind='UNKNOWN';manual=true;
 }else{
  kind=filled>0n?'UNKNOWN':'ACK';manual=filled>0n;
 }
 const cumulativeQuantity=observation.filled_qty;
 // event_id is repeatable for an identical broker observation; B152 enforces replay consistency.
 const eventId='alpaca-'+digest({id:observation.id,client:expectedClientOrderId,status,cumulativeQuantity}).slice(0,40);
 return Object.freeze({event:Object.freeze({id:eventId,kind,atMs:observedAtMs,cumulativeQuantity}),
  observedStatus:status,manualReconciliationRequired:manual,
  terminalReport:terminal.has(status),riskReleased:false,ordersSubmitted:0,liveExecution:false,
  lastKnownOrderRequired:true,noAutomaticResubmission:true});
}
export function unknownPaperOrder({clientOrderId,reason,atMs,knownCumulativeQuantity}){
 k(clientOrderId);if(!['timeout','transport_error','missing_from_open_orders','restart_without_receipt'].includes(reason))fail('INVALID_UNKNOWN_REASON');
 if(!Number.isSafeInteger(atMs)||atMs<=0)fail('INVALID_OBSERVATION_TIME');
 units(knownCumulativeQuantity); // must come from the previous durable ledger, never invent zero
 return Object.freeze({id:'unknown-'+digest({clientOrderId,reason,atMs,knownCumulativeQuantity}).slice(0,40),kind:'UNKNOWN',atMs,cumulativeQuantity:knownCumulativeQuantity,requiresExternalLookup:true,resubmitBlocked:true,liveExecution:false});
}
