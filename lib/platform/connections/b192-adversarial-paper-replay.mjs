/** B192 — additive, deterministic fault injection over the unchanged B152 risk ledger.
 * Strictly private/offline: no provider host, user credentials, network, or retry.
 */
import {units,decimal} from '../pilot-prep/contracts.mjs';
const reject=code=>{throw Object.assign(new Error(code),{code});};
const SCENARIOS=new Set(['ack_then_timeout','partial_then_timeout','duplicate_ack_then_fill',
 'stale_rejection_after_fill','reordered_fill_blocked']);
export function replayAdversarialPaper({ledger,session,connection,clientOrderId,quantity,scenario,atMs}){
 if(!ledger||typeof ledger.snapshot!=='function'||typeof ledger.event!=='function')reject('DURABLE_LEDGER_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  !connection||connection.userId!==session.userId||connection.provider!=='alpaca'||
  connection.environment!=='paper')reject('PRIVATE_PAPER_SCOPE_REQUIRED');
 if(!SCENARIOS.has(scenario)||!Number.isSafeInteger(atMs)||atMs<=0)reject('INVALID_FAULT_SCENARIO');
 if(typeof clientOrderId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(clientOrderId))reject('INVALID_ORDER_ID');
 const q=units(quantity);if(q<2n*100000000n||q>100000n*100000000n||q%100000000n!==0n)
  reject('FAULT_SIMULATION_REQUIRES_WHOLE_MULTIPLE_UNITS');
 const row=ledger.snapshot(session,connection).find(r=>r.client_id===clientOrderId);
 if(!row||row.state!=='RESERVED')reject('FRESH_RESERVED_INTENT_REQUIRED');
 const events=[],prefix='b192-'+clientOrderId+'-'+scenario+'-';
 const send=(kind,atMs,cumulativeQuantity,ordinal)=>{
  const receipt={id:prefix+ordinal,kind,atMs,cumulativeQuantity};
  const r=ledger.event(session,connection,clientOrderId,receipt);
  events.push(Object.freeze({kind,state:r.state,duplicate:r.duplicate===true}));
  return receipt;
 };
 let time=atMs;
 send('SUBMITTING',time++,'0',0);
 const ack=send('ACK',time++,'0',1);
 let intentionallyBlocked=null;
 const partial=decimal(q/2n),whole=decimal(q);
 if(scenario==='ack_then_timeout')send('UNKNOWN',time++,'0',2);
 else if(scenario==='partial_then_timeout'){
  send('PARTIAL',time++,partial,2);send('UNKNOWN',time++,partial,3);
 }else if(scenario==='duplicate_ack_then_fill'){
  const duplicate=ledger.event(session,connection,clientOrderId,ack);
  if(duplicate.duplicate!==true)reject('DUPLICATE_DETECTION_FAILED');
  events.push(Object.freeze({kind:'ACK',state:duplicate.state,duplicate:true}));
  send('FILLED',time++,whole,3);
 }else if(scenario==='stale_rejection_after_fill'){
  send('FILLED',time++,whole,2);
  try{send('REJECTED',time++,'0',3);reject('INVALID_TERMINAL_EVENT_ACCEPTED');}
  catch(e){if(e.code==='INVALID_TERMINAL_EVENT_ACCEPTED')throw e;
   if(e.code!=='INVALID_STATE_TRANSITION')throw e;
   intentionallyBlocked=e.code;}
 }else if(scenario==='reordered_fill_blocked'){
  try{send('FILLED',atMs-1,whole,2);reject('INVALID_OUT_OF_ORDER_EVENT_ACCEPTED');}
  catch(e){if(e.code==='INVALID_OUT_OF_ORDER_EVENT_ACCEPTED')throw e;
   if(e.code!=='OUT_OF_ORDER_EVENT')throw e;
   intentionallyBlocked=e.code;}
 }
 const final=ledger.snapshot(session,connection).find(r=>r.client_id===clientOrderId);
 return Object.freeze({schema:'JENIOS_B192_FAULT_REPLAY',scenario,clientOrderId,
  state:final.state,heldRiskUnits:final.held,filledUnits:final.filled,
  needsIndependentReconciliation:final.state==='UNKNOWN',
  blockedInvalidReceipt:intentionallyBlocked,
  events:Object.freeze(events),
  stopAndTargetBrokerVerified:false,automaticResubmissionAllowed:false,
  networkCalls:0,ordersSent:0,liveExecution:false,performanceProven:false});
}
