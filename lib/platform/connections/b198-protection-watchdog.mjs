/** B198 — fail-closed operational protection incident classifier for PRIVATE PAPER QA.
 * Read-only interpretation of B152+B193. Never calls a broker, cancels orders, closes
 * positions or assumes the presence of stop legs guarantees any future stop execution.
 */
import {inspectPaperProtectionRisk} from './b193-paper-protection-gate.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const ambiguous=new Set(['SUBMITTING','UNKNOWN']);
const exposure=new Set(['PARTIAL','FILLED','CANCELLED']);
export function planPrivatePaperProtectionIncident({riskRow,bracketAudit=null,nowMs}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('INVALID_PROTECTION_REVIEW_TIME');
 const view=inspectPaperProtectionRisk({riskRow,bracketAudit});
 const state=view.state,held=BigInt(view.heldRiskUnits),filled=BigInt(view.filledUnits);
 if(state==='REJECTED'&&filled!==0n)deny('REJECTED_ORDER_HAS_FILL');
 if(['REJECTED','CANCELLED'].includes(state)&&filled===0n&&held!==0n)
  deny('TERMINAL_WITHOUT_FILL_STILL_HOLDS_RISK');
 if(state==='CLOSED'&&filled===0n)deny('CLOSED_WITHOUT_CONFIRMED_FILL');
 if(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','UNKNOWN'].includes(state)&&held<=0n)
  deny('RISK_RESERVATION_NOT_HELD');
 if(exposure.has(state)&&filled>0n&&held<=0n)deny('POSITION_RISK_RELEASED_PREMATURELY');
 if(state==='CLOSED'&&held!==0n)deny('CLOSED_RISK_NOT_RELEASED');
 const uncertainty=ambiguous.has(state);
 const openExposure=state!=='CLOSED'&&filled>0n;
 const observedLegs=view.syntheticBracketLegsObserved===true;
 let severity='review',incident='NO_EXECUTION_EVIDENCE';
 if(uncertainty){severity='critical';incident='UNKNOWN_BROKER_EXECUTION';}
 else if(openExposure&&!observedLegs){severity='critical';incident='PAPER_POSITION_PROTECTION_UNVERIFIED';}
 else if(openExposure){severity='high';incident='PAPER_POSITION_REQUIRES_STOP_SURVEILLANCE';}
 else if(state==='CLOSED'){severity='review';incident='LEDGER_CLOSED_REQUIRES_PROVIDER_CONFIRMATION';}
 else if(state==='ACK'){severity='review';incident='ACK_IS_NOT_EXECUTION';}
 else if(state==='REJECTED'||(state==='CANCELLED'&&filled===0n)){
  severity='low';incident='NO_REPORTED_FILLED_EXPOSURE';
 }
 const shouldPause=uncertainty||openExposure;
 const actions=[];
 if(shouldPause)actions.push('PAUSE_NEW_ENTRIES_LOCALLY');
 if(uncertainty||openExposure||state==='CLOSED')actions.push('VERIFY_ORIGINAL_ORDER_WITH_BROKER_GET');
 if(openExposure)actions.push('VERIFY_POSITION_AND_BOTH_EXIT_LEGS_WITH_BROKER');
 if(state==='CLOSED')actions.push('CONFIRM_EXTERNAL_POSITION_IS_CLOSED');
 actions.push('NEVER_AUTOMATICALLY_RESUBMIT_UNKNOWN_ORDER');
 return Object.freeze({schema:'JENIOS_B198_PROTECTION_WATCHDOG',asOfMs:nowMs,
  severity,incident,state,heldRiskUnits:view.heldRiskUnits,filledUnits:view.filledUnits,
  locallyPausedByThisCheck:false,entryPauseRecommended:shouldPause,
  manualBrokerLookupRequired:uncertainty||openExposure||state==='CLOSED',
  providerStopPresenceObservedInSyntheticEvidence:observedLegs,
  realBrokerProtectionIndependentlyCertified:false,stopExecutionGuaranteed:false,
  actions:Object.freeze(actions),ordersSent:0,brokerCancellationPerformed:false,
  positionsClosedByThisCheck:false,liveExecutionAuthorized:false});
}
