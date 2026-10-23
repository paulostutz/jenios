/**
 * R57 — Hybrid final alignment-guard validation.
 */
import {operatorAlignmentGuard} from './robot-r19-assisted-refinement.mjs';
import {evaluateAlignmentThreshold} from './robot-r20-alignment-calibration.mjs';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export const R57_FROZEN_THRESHOLD=.65;
function makeRows(n,seed){
 return Array.from({length:n},(_,i)=>{
   const confidence=[.51,.57,.61,.65,.69,.73,.79,.84,.91][(i*seed+3)%9];
   const operatorCorrect=((i*(seed+5)+7)%23)>4;
   const technicalCorrect=((i*(seed+7)+11)%29)>6;
   return Object.freeze({operatorCorrect,technicalCorrect,confidence});
 });
}
export function runR57Battery(){
 const datasets=[makeRows(2500,3),makeRows(4000,7),makeRows(6000,11)];
 const comparisons=datasets.map(rows=>({
   threshold050:evaluateAlignmentThreshold(rows,.50),
   threshold065:evaluateAlignmentThreshold(rows,.65)
 }));
 const aligned=operatorAlignmentGuard({operatorSide:'buy',technicalSide:'buy',confidence:.91});
 const disagree=operatorAlignmentGuard({operatorSide:'buy',technicalSide:'sell',confidence:.82});
 const low=operatorAlignmentGuard({operatorSide:'buy',technicalSide:'sell',confidence:.60});
 const protectedAligned=comparisons.every(x=>x.threshold065.falseInterventions<=x.threshold050.falseInterventions);
 return Object.freeze({
   schema:'JENIOS_R57_HYBRID_FINAL_ALIGNMENT_V1',
   datasets:Object.freeze(comparisons),
   threshold:R57_FROZEN_THRESHOLD,
   alignedOperatorProtected:aligned.intervene===false,
   materialDisagreementAdvised:disagree.intervene===true,
   lowConfidenceDoesNotIntervene:low.intervene===false,
   protectedAligned,
   pass:aligned.intervene===false&&disagree.intervene===true&&low.intervene===false&&protectedAligned,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,ordersSent:0,paperOrdersSent:0
 });
}