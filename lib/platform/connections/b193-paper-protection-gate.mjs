/** B193: cross-check a risk-ledger row with a simulated broker-bracket inspection.
 * An ACK is not a fill; even verified stop legs cannot guarantee exit execution.
 */
const states=new Set(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED']);
const reject=code=>{throw Object.assign(new Error(code),{code});};
export function inspectPaperProtectionRisk({riskRow,bracketAudit=null}={}){
 if(!riskRow||!states.has(riskRow.state)||typeof riskRow.held!=='string'||typeof riskRow.filled!=='string')
  reject('RISK_SNAPSHOT_REQUIRED');
 if(!/^\d+$/.test(riskRow.held)||!/^\d+$/.test(riskRow.filled))reject('INVALID_RISK_UNITS');
 const held=BigInt(riskRow.held),filled=BigInt(riskRow.filled);
 if(riskRow.state==='UNKNOWN'&&held===0n)reject('UNKNOWN_EXPOSURE_NOT_RESERVED');
 const ambiguous=riskRow.state==='UNKNOWN'||riskRow.state==='SUBMITTING';
 const exposure=filled>0n;
 const parentAndLegsMatch=bracketAudit?.bracketConfirmed===true&&bracketAudit?.reviewRequired===false&&
  bracketAudit?.stopFillGuaranteed===false;
 let disposition='PENDING_ENTRY';
 if(ambiguous)disposition='UNKNOWN_REQUIRES_BROKER_LOOKUP';
 else if(exposure&&!parentAndLegsMatch)disposition='EXPOSED_UNVERIFIED_PROTECTION';
 else if(exposure)disposition='REVIEW_VERIFIED_BRACKET_STILL_AT_RISK';
 else if(riskRow.state==='CLOSED'||riskRow.state==='REJECTED'||riskRow.state==='CANCELLED')
  disposition='NO_KNOWN_OPEN_FILL';
 return Object.freeze({schema:'JENIOS_B193_PROTECTION_REVIEW',
  state:riskRow.state,disposition,
  heldRiskUnits:held.toString(),filledUnits:filled.toString(),
  syntheticBracketLegsObserved:parentAndLegsMatch,
  // Only the broker's own independently authenticated GET can confirm actual protective legs.
  externalBrokerEvidenceAuthenticated:false,actualStopsCertified:false,
  stopExecutionGuaranteed:false,
  manualReconciliationRequired:ambiguous,
  manualPositionProtectionReviewRequired:exposure,
  automaticRetryAllowed:false,ordersSent:0,realExecution:false,
  realOrderPermission:false,profitableStrategyProven:false});
}
