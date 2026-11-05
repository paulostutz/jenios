/**
 * R21 — out-of-sample alignment validation.
 * Frozen deterministic synthetic holdout, separate from R20 calibration rows.
 */
import {evaluateAlignmentThreshold} from './robot-r20-alignment-calibration.mjs';

function row(i){
 const confidence=[.51,.57,.63,.69,.73,.77,.81,.87,.93][(i*7+3)%9];
 const operatorCorrect=((i*13+5)%17)>3;
 const technicalCorrect=((i*11+7)%19)>4;
 return Object.freeze({operatorCorrect,technicalCorrect,confidence});
}
export const R21_OOS_ROWS=Object.freeze(Array.from({length:2400},(_,i)=>row(i)));

export function compareOosThresholds(){
 const a=evaluateAlignmentThreshold(R21_OOS_ROWS,.50);
 const b=evaluateAlignmentThreshold(R21_OOS_ROWS,.65);
 const winner=a.score>b.score?a:b.score>a.score?b:
  (a.falseInterventions<=b.falseInterventions?a:b);
 return Object.freeze({
  schema:'JENIOS_R21_ALIGNMENT_OOS_V1',
  sampleSize:R21_OOS_ROWS.length,
  threshold050:a,
  threshold065:b,
  winner:winner.threshold,
  promoteToProduction:false,
  ordersSent:0
 });
}
