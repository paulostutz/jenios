/** B225 — cost-stressed rolling educational study; cannot certify proprietary robot. */
import {evaluateRollingPaperWindows,FROZEN_STRESS_GRID} from '../rolling-paper-validation.mjs';
export function compileFrozenRollingHoldout(bars,{now,windowSize=100,minWindows=3}={}){
 const r=evaluateRollingPaperWindows(bars,{now,windowSize,minWindows});
 if(!r.valid)return Object.freeze({schema:'JENIOS_B225_ROLLING_HOLDOUT',
  classification:'INVALID_OR_INSUFFICIENT_HOLDOUT',reason:r.reason,brokerVerified:false,
  originalRobotsEvaluated:false,performanceCertified:false,liveExecutionAuthorized:false});
 const byMode=r.modeSummary.map(row=>Object.freeze({mode:row.mode,
  hypotheticalWorstReturnPct:row.hypotheticalWorstReturnPct,
  hypotheticalWorstDrawdownPct:row.hypotheticalWorstDrawdownPct,
  costStressCount:FROZEN_STRESS_GRID.length}));
 return Object.freeze({schema:'JENIOS_B225_ROLLING_HOLDOUT',
  classification:'ILLUSTRATIVE_RESEARCH_REQUIRES_INDEPENDENT_CORE_EVIDENCE',
  nonOverlappingHoldouts:r.windows.length,costStresses:FROZEN_STRESS_GRID.length,
  summaries:Object.freeze(byMode),evaluatedCoreSha256:null,
  originalRobotsEvaluated:false,independentProspectiveData:false,
  statisticallyCertified:false,recommendedMode:null,performanceCertified:false,
  ordersSent:0,liveExecutionAuthorized:false});
}
