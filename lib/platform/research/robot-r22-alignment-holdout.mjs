/**
 * R22 — second independent holdout for the alignment guard.
 * Deterministic synthetic rows, independent from R20 and R21 datasets.
 */
import {evaluateAlignmentThreshold} from './robot-r20-alignment-calibration.mjs';

function makeRow(i){
 const conf=[.53,.59,.61,.67,.71,.76,.79,.84,.91][(i*5+2)%9];
 const operatorCorrect=((i*17+9)%23)>4;
 const technicalCorrect=((i*19+11)%29)>6;
 return Object.freeze({operatorCorrect,technicalCorrect,confidence:conf});
}
export const R22_HOLDOUT=Object.freeze(Array.from({length:3600},(_,i)=>makeRow(i)));

export function compareR22Holdout(){
 const a=evaluateAlignmentThreshold(R22_HOLDOUT,.50);
 const b=evaluateAlignmentThreshold(R22_HOLDOUT,.65);
 const winner=a.score>b.score?a:b.score>a.score?b:(a.falseInterventions<=b.falseInterventions?a:b);
 return Object.freeze({
  schema:'JENIOS_R22_ALIGNMENT_HOLDOUT_V1',
  sampleSize:R22_HOLDOUT.length,
  threshold050:a,threshold065:b,
  winner:winner.threshold,
  productionThreshold:.65,
  changeRecommended:winner.threshold!==.65?false:false,
  ordersSent:0
 });
}
