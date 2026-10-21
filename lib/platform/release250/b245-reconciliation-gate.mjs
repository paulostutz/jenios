/** B245: only classify B192 simulated receipts; no order state is changed by this review. */
const accepted=new Set(['ack_then_timeout','partial_then_timeout','duplicate_ack_then_fill','stale_rejection_after_fill','reordered_fill_blocked']);
export function auditSimulatedReceiptResult(result){
 if(!result||result.schema!=='JENIOS_B192_FAULT_REPLAY'||!accepted.has(result.scenario)||
    !['UNKNOWN','ACK','FILLED','PARTIAL','RESERVED'].includes(result.state)||
    typeof result.heldRiskUnits!=='string'||!/^\d+$/.test(result.heldRiskUnits)||
    result.networkCalls!==0||result.ordersSent!==0||result.automaticResubmissionAllowed!==false)
  throw Error('B245_UNTRUSTED_SIMULATED_RECEIPT');
 return Object.freeze({schema:'JENIOS_B245_RISK_RECEIPT_REVIEW',
  scenario:result.scenario,terminalState:result.state,
  riskStillHeld:BigInt(result.heldRiskUnits)>0n,
  requiresIndependentBrokerReview:result.state==='UNKNOWN'||result.needsIndependentReconciliation===true,
  noAutomaticBrokerResubmission:true,actualStopFillVerified:false,
  externalAccountAuthenticated:false,paperOrdersSent:0,realOrdersSent:0});
}
