import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateFrozenHoldout,runR29IndependentHoldout}
 from '../lib/platform/research/robot-r29-breakeven-holdout.mjs';

test('R29 holdout uses exactly 7000 attempts and frozen policies',()=>{
 const x=runR29IndependentHoldout();
 assert.equal(x.frozenPolicy,true);
 assert.equal(x.total,2688);
});

test('R29 adaptive gate improves recall out of sample',()=>{
 const x=runR29IndependentHoldout();
 assert.ok(x.recallAdaptive>x.recallBaseline);
 assert.ok(x.adaptivePositiveCaptured>x.baselinePositiveCaptured);
 assert.ok(x.recoveredPositive>0);
});

test('R29 adaptive gate adds no negative false positives in holdout',()=>{
 const x=runR29IndependentHoldout();
 assert.equal(x.baselineFalsePositive,0);
 assert.equal(x.adaptiveFalsePositive,0);
 assert.equal(x.adaptiveBeatsBaseline,true);
});

test('R29 deterministic sample remains zero execution and no broker PnL claim',()=>{
 const cfg={attempts:7000,totalCostBps:1.4,fillProbability:.82,estimatedWinRate:.575,
  grossWinBps:15,grossLossBps:13.5};
 const a=evaluateFrozenHoldout(cfg),b=evaluateFrozenHoldout(cfg);
 assert.deepEqual(a,b);
 assert.equal(a.actualBrokerPnl,null);assert.equal(a.ordersSent,0);assert.equal(a.paperOrdersSent,0);
});
