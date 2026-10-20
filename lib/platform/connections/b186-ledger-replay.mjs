/** B186: replay deterministic B185 receipts through B152's existing event contract.
 * Caller must have configured and RESERVED the private rehearsal order first.
 * No network, broker authentication, credentials, or production transport.
 */
import {simulatePaperReceipt} from './b185-paper-simulator.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function replaySimulatedPaperOrder({ledger,session,connection,clientOrderId,quantity,scenario,atMs}){
 if(!ledger||typeof ledger.snapshot!=='function'||typeof ledger.event!=='function')deny('DURABLE_RISK_LEDGER_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||!connection||connection.environment!=='paper'||connection.provider!=='alpaca')deny('PRIVATE_PAPER_SCOPE_REQUIRED');
 const existing=ledger.snapshot(session,connection).find(x=>x.client_id===clientOrderId);
 if(!existing||existing.state!=='RESERVED')deny('FRESH_RESERVED_INTENT_REQUIRED');
 const simulation=simulatePaperReceipt({clientOrderId,quantity,scenario,atMs});
 const submitted=ledger.event(session,connection,clientOrderId,{id:'sim-submit-'+clientOrderId,kind:'SUBMITTING',atMs,cumulativeQuantity:'0'});
 const events=[];
 for(const receipt of simulation.events){
  const result=ledger.event(session,connection,clientOrderId,receipt);
  events.push(Object.freeze({kind:receipt.kind,state:result.state,heldRiskUnits:result.heldRiskUnits,duplicate:result.duplicate}));
 }
 const final=ledger.snapshot(session,connection).find(x=>x.client_id===clientOrderId);
 return Object.freeze({scenario,submittedState:submitted.state,events:Object.freeze(events),finalState:final.state,
  heldRiskUnits:final.held,filledUnits:final.filled,needsReconciliation:final.state==='UNKNOWN',
  stopAndTargetBrokerVerified:false,networkCalls:0,ordersSent:0,realExecution:false,performanceProven:false});
}
