/**
 * R20 — operator alignment threshold calibration.
 * Synthetic/offline only. No broker transport or market network.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const R20_ALIGNMENT_THRESHOLDS=Object.freeze([0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85]);

export function evaluateAlignmentThreshold(rows,threshold){
 if(!Array.isArray(rows)||!rows.length||!R20_ALIGNMENT_THRESHOLDS.includes(threshold))
  fail('R20_INVALID_ALIGNMENT_DATA');
 let protectedAligned=0,missedCorrections=0,interventions=0,falseInterventions=0,total=0;
 for(const r of rows){
  if(!r||![true,false].includes(r.operatorCorrect)||![true,false].includes(r.technicalCorrect)||
   !finite(r.confidence)||r.confidence<0||r.confidence>1)fail('R20_INVALID_ALIGNMENT_ROW');
  total++;
  const intervene=r.confidence>=threshold && r.operatorCorrect!==r.technicalCorrect;
  if(intervene)interventions++;
  if(r.operatorCorrect&&r.technicalCorrect&&!intervene)protectedAligned++;
  if(!r.operatorCorrect&&r.technicalCorrect&&!intervene)missedCorrections++;
  if(r.operatorCorrect&&!r.technicalCorrect&&intervene)falseInterventions++;
 }
 const score=protectedAligned*2 + (interventions-missedCorrections) - falseInterventions*3;
 return Object.freeze({threshold,total,protectedAligned,missedCorrections,interventions,falseInterventions,score});
}

export function selectAlignmentThreshold(rows){
 const results=R20_ALIGNMENT_THRESHOLDS.map(t=>evaluateAlignmentThreshold(rows,t));
 const best=[...results].sort((a,b)=>b.score-a.score||a.falseInterventions-b.falseInterventions||a.threshold-b.threshold)[0];
 return Object.freeze({schema:'JENIOS_R20_ALIGNMENT_CALIBRATION_V1',best,results:Object.freeze(results),ordersSent:0});
}
