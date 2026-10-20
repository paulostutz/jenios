/** B176: reconcile official Alpaca PAPER observations into the existing B152 SQLite journal.
 * Private QA only. Does not fetch credentials from users or transmit/retry any orders.
 */
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
import {lookupOwnAlpacaPaperOrder} from './alpaca-native-paper-order-lookup.mjs';
import {unknownPaperOrder} from './paper-order-observation.mjs';
import {decimal,units} from '../pilot-prep/contracts.mjs';

const deny=code=>{throw Object.assign(new Error(code),{code});};
const pending=new Set(['SUBMITTING','ACK','PARTIAL']);
const terminal=new Set(['FILLED','CANCELLED','REJECTED','CLOSED']);
const confirmed=new Set(['ACK','PARTIAL','FILLED','CANCELLED','REJECTED']);

export async function reconcileOwnAlpacaPaperLedger({session,storedConnection,clientOrderId,symbol,credentials,nowMs},
 {ledger,env=process.env,lookup=lookupOwnAlpacaPaperOrder}={}){
 if(env.VERCEL_ENV==='production'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')deny('PRIVATE_REHEARSAL_DISABLED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true)deny('PRIVATE_SESSION_REQUIRED');
 if(!ledger||typeof ledger.snapshot!=='function'||typeof ledger.event!=='function')deny('DURABLE_LEDGER_REQUIRED');
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('INVALID_CLOCK');
 const connection=alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
 const existing=ledger.snapshot(session,connection);
 const row=existing.find(item=>item.client_id===clientOrderId);
 if(!row)deny('ORDER_NOT_IN_PRIVATE_LEDGER');
 if(row.state==='RESERVED')deny('UNEXPECTED_BROKER_ORDER_BEFORE_SEND');
 if(row.state==='CLOSED')return Object.freeze({state:'CLOSED',unchanged:true,manualReview:false,
  riskHeldUnits:row.held,ordersSent:0,automaticResubmissionAllowed:false,realExecution:false});
 let broker;
 try{broker=await lookup({verifiedUserId:session.userId,storedConnection,credentials,clientOrderId,symbol},{env,now:()=>nowMs});}
 catch{broker={found:false,state:'UNKNOWN',manualReview:true};}
 if(!broker?.found||broker.state==='UNKNOWN'||!broker.event||broker.event.kind==='UNKNOWN'){
  if(!pending.has(row.state))return Object.freeze({state:row.state,unchanged:true,manualReview:true,
   riskHeldUnits:row.held,ordersSent:0,automaticResubmissionAllowed:false,realExecution:false});
  const fallback=unknownPaperOrder({clientOrderId,reason:'transport_error',atMs:nowMs,
   knownCumulativeQuantity:decimal(BigInt(row.filled))});
  const event=ledger.event(session,connection,clientOrderId,{id:fallback.id,kind:'UNKNOWN',atMs:nowMs,
   cumulativeQuantity:fallback.cumulativeQuantity});
  return Object.freeze({state:event.state,duplicate:event.duplicate,manualReview:true,
   riskHeldUnits:event.heldRiskUnits??row.held,ordersSent:0,automaticResubmissionAllowed:false,realExecution:false});
 }
 if(!confirmed.has(broker.event.kind)||broker.state!==broker.event.kind)deny('UNSUPPORTED_PAPER_RECEIPT');
 if(terminal.has(row.state))return Object.freeze({state:row.state,unchanged:true,manualReview:true,
  riskHeldUnits:row.held,ordersSent:0,automaticResubmissionAllowed:false,realExecution:false});
 if(row.state===broker.event.kind&&BigInt(row.filled)===units(broker.event.cumulativeQuantity))
  return Object.freeze({state:row.state,unchanged:true,manualReview:!!broker.manualReview,
   riskHeldUnits:row.held,ordersSent:0,automaticResubmissionAllowed:false,realExecution:false});
 const restoring=row.state==='UNKNOWN';
 const event=ledger.event(session,connection,clientOrderId,{
  id:broker.event.id,kind:restoring?'RECONCILED':broker.event.kind,
  ...(restoring?{reconciledState:broker.event.kind}:{}),
  atMs:nowMs,cumulativeQuantity:broker.event.cumulativeQuantity
 });
 return Object.freeze({state:event.state,duplicate:event.duplicate,manualReview:!!broker.manualReview||
  (event.state==='CANCELLED'&&BigInt(row.filled)>0n),
  riskHeldUnits:event.heldRiskUnits??row.held,ordersSent:0,automaticResubmissionAllowed:false,
  realExecution:false,brokerConfirmed:true});
}
export function resubmitAmbiguousPaperOrder(){deny('AUTOMATIC_PAPER_RESUBMISSION_DISABLED');}
