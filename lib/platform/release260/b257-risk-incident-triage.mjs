/** B257: combine true B152 risk state and synthetic protection review without releasing funds.
 * Read-only QA classification; under no circumstance converts 404/timeout into rejected. */
import {planPrivatePaperProtectionIncident} from '../connections/b198-protection-watchdog.mjs';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function triageExistingPaperRisk({riskRow,bracketAudit,orderLookupStatus='unconfirmed',nowMs}={}){
 if(!['unconfirmed','not_found','acknowledged','filled','rejected'].includes(orderLookupStatus))
   fail('INVALID_PROVIDER_OBSERVATION_STATUS');
 const plan=planPrivatePaperProtectionIncident({riskRow,bracketAudit,nowMs});
 const unknown=orderLookupStatus==='not_found'||orderLookupStatus==='unconfirmed';
 const exposed=BigInt(plan.filledUnits)>0n;
 const pause=unknown||plan.entryPauseRecommended===true;
 return Object.freeze({schema:'JENIOS_B257_RISK_RELEASE_TRIAGE',severity:plan.severity,
   operatorAction:pause?'PAUSE_AND_REVIEW':'MANUAL_RECONCILIATION_REQUIRED',
   brokerLookupStatus:orderLookupStatus,
   unknownOrMissingBrokerEvidence:unknown,
   newEntriesMustStayPaused:pause||exposed,heldRiskUnits:plan.heldRiskUnits,
   noAutoResubmit:true,stopExecutionGuaranteed:false,
   independentlyBrokerVerified:false,positionsClosedByReview:false,
   riskLedgerChanged:false,ordersSent:0,realExecution:false});
}
