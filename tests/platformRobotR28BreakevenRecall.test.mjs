import test from 'node:test';import assert from 'node:assert/strict';
import {adaptiveSafetyMargin,adaptiveBreakevenGate,compareAdaptivePolicy,runR28Grid}
 from '../lib/platform/research/robot-r28-breakeven-recall.mjs';

test('R28 lowers margin only for favorable economics',()=>{
 const favorable=adaptiveSafetyMargin({totalCostBps:.5,fillProbability:.95,grossWinBps:12,grossLossBps:8,estimatedWinRate:.60});
 const weak=adaptiveSafetyMargin({totalCostBps:5,fillProbability:.5,grossWinBps:8,grossLossBps:8,estimatedWinRate:.60});
 assert.ok(favorable<weak);assert.equal(weak,1);
});

test('R28 adaptive gate remains blocked in clearly bad configuration',()=>{
 const g=adaptiveBreakevenGate({estimatedWinRate:.52,grossWinBps:8,grossLossBps:8,totalCostBps:5,fillProbability:.75});
 assert.equal(g.allow,false);assert.equal(g.ordersSent,0);assert.equal(g.actualBrokerPnl,null);
});

test('R28 recovers at least one positive configuration blocked by R27',()=>{
 const x=runR28Grid();
 assert.ok(x.recoveredPositive>0);
 assert.ok(x.adaptivePositiveCaptured>x.baselinePositiveCaptured);
});

test('R28 does not increase false-positive negative configurations',()=>{
 const x=runR28Grid();
 assert.ok(x.adaptiveFalsePositive<=x.baselineFalsePositive);
});

test('R28 improves positive recall while keeping zero execution',()=>{
 const x=runR28Grid();
 assert.ok(x.recallAdaptive>x.recallBaseline);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});

test('R28 policy comparison is deterministic',()=>{
 const cfg={attempts:5000,estimatedWinRate:.58,grossWinBps:12,grossLossBps:8,totalCostBps:1,fillProbability:.95};
 assert.deepEqual(compareAdaptivePolicy(cfg),compareAdaptivePolicy(cfg));
});
