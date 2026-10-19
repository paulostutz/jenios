import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRollingPaperWindows,FROZEN_STRESS_GRID} from '../lib/platform/rolling-paper-validation.mjs';
const base=Date.parse('2026-10-15T00:00:00Z'),now=base+1000*60000;
function prices(n=250,slope=.09){
 return Array.from({length:n},(_,i)=>{
  const p=100+i*slope;return {time:new Date(base+i*60000).toISOString(),
   open:p,high:p+1.1,low:p-0.8,close:p+.2,volume:1200};
 });
}
test('B94 rolling windows do not overlap holdout ranges and modes see the exact same windows',()=>{
 const result=evaluateRollingPaperWindows(prices(),{now,windowSize:100});
 assert.equal(result.valid,true);assert(result.windows.length>=3);
 for(let i=1;i<result.windows.length;i++){
  assert(result.windows[i].evaluationStart>result.windows[i-1].evaluationEnd);
 }
 assert.equal(result.scenarioRows.length,result.windows.length*3*FROZEN_STRESS_GRID.length);
 assert.equal(result.modeSummary.length,3);
 assert.equal(result.originalRobotsEvaluated,false);
 assert.equal(result.performanceCertified,false);
 assert.equal(result.recommendedMode,null);
});
test('B94 changing late future prices cannot change the first already evaluated window',()=>{
 const baseRows=prices(),baseline=evaluateRollingPaperWindows(baseRows,{now,windowSize:100});
 const mutated=prices();
 for(let i=100;i<mutated.length;i++){
  const p=200+i;mutated[i]={...mutated[i],open:p,high:p+1,low:p-1,close:p+.5};
 }
 const later=evaluateRollingPaperWindows(mutated,{now,windowSize:100});
 assert.deepEqual(baseline.scenarioRows.filter(r=>r.windowId===1),
  later.scenarioRows.filter(r=>r.windowId===1));
});
test('B94 predeclared stresses never pick winning mode from the holdout',()=>{
 const result=evaluateRollingPaperWindows(prices(),{now});
 assert.equal(result.protocolFrozen,true);
 assert.equal(result.recommendedMode,null);
 assert(result.scenarioRows.some(r=>r.scenario==='estresse_de_liquidez_e_stop'));
 assert(result.scenarioRows.every(r=>r.realExecutionAllowed===false));
});
test('B94 gapped source, weak sample and unsafe risk settings fail closed',()=>{
 const x=prices();x.splice(64,1);
 assert.equal(evaluateRollingPaperWindows(x,{now}).valid,false);
 assert.equal(evaluateRollingPaperWindows(prices(120),{now}).valid,false);
 assert.equal(evaluateRollingPaperWindows(prices(),{now,allocationPct:.7}).valid,false);
});
test('B94 known backwards or false data cannot claim profitability',()=>{
 const result=evaluateRollingPaperWindows(prices(250,-.1),{now});
 assert.equal(result.valid,true);
 assert.equal(result.confidenceIntervalCertified,false);
 assert.equal(result.providerVerified,false);
 assert.equal(result.prospectiveEvidence,false);
});
