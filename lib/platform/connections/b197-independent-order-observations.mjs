/** B197 — two read-only Alpaca Paper order observations before operator reconciliation.
 * Callers supply raw GET observations; this module does not fetch, trust the caller as an
 * independent witness, mutate the ledger, cancel orders, or authorize resubmission.
 */
import {createHash} from 'node:crypto';
import {units} from '../pilot-prep/contracts.mjs';
import {observeAlpacaPaperOrder} from './paper-order-observation.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const terminal=new Set(['FILLED','REJECTED','CANCELLED']);
export function assessPairedPaperReads({clientOrderId,symbol,expectedQuantity,first,second,nowMs}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||
  !Number.isSafeInteger(first?.receivedAtMs)||!Number.isSafeInteger(second?.receivedAtMs)||
  first.receivedAtMs<=0||second.receivedAtMs-first.receivedAtMs<250||
  second.receivedAtMs-first.receivedAtMs>60000||second.receivedAtMs>nowMs||
  nowMs-second.receivedAtMs>120000)deny('INDEPENDENT_PAPER_OBSERVATION_TIMING_INVALID');
 const qty=units(expectedQuantity);
 if(qty<=0n)deny('INVALID_EXPECTED_PAPER_QUANTITY');
 const rows=[first,second].map(({order,receivedAtMs})=>{
  if(!order||units(order.qty)!==qty)deny('BROKER_QUANTITY_DRIFT');
  const v=observeAlpacaPaperOrder({expectedClientOrderId:clientOrderId,
   expectedSymbol:symbol,environment:'paper',accountMatched:true,
   observation:order,observedAtMs:receivedAtMs});
  return {raw:order,event:v.event,manual:v.manualReconciliationRequired};
 });
 if(rows[0].raw.id!==rows[1].raw.id)deny('BROKER_ORDER_ID_CHANGED');
 const initial=units(rows[0].event.cumulativeQuantity),final=units(rows[1].event.cumulativeQuantity);
 if(final<initial)deny('BROKER_CUMULATIVE_FILL_REGRESSION');
 if(rows[1].event.kind==='REJECTED'&&initial>0n)deny('BROKER_REJECTION_AFTER_FILL_UNSAFE');
 const stable=rows[0].event.kind===rows[1].event.kind&&initial===final;
 const stableTerminal=stable&&terminal.has(rows[1].event.kind);
 const digest=createHash('sha256').update('jenios-b197-private-order-ref\0'+clientOrderId).digest('hex');
 return Object.freeze({schema:'JENIOS_B197_PAIRED_READ_ONLY_REVIEW',
  orderReferenceDigest:digest,firstObservedAtMs:first.receivedAtMs,
  secondObservedAtMs:second.receivedAtMs,
  lastObservedKind:rows[1].event.kind,lastCumulativeQuantity:rows[1].event.cumulativeQuantity,
  assessment:stableTerminal?'STABLE_TERMINAL_OBSERVATIONS':
   stable?'STABLE_NONTERMINAL_OBSERVATIONS':'EVOLVING_OR_AMBIGUOUS',
  explicitBrokerReconciliationReviewRequired:true,
  operatorMayInspectReceipt:stableTerminal,
  // Two caller-supplied GET payloads do not prove separate independently witnessed requests.
  independentExternalWitnessCertified:false,
  ledgerChanged:false,orderStateCommitted:false,ordersSent:0,
  brokerStopFillGuaranteed:false,automaticOrderRetryAllowed:false,
  realExecutionAuthorized:false});
}
