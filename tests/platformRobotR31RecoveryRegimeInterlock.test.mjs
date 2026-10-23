import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateRecoveryRegimeInterlock,simulateInterlockedTimeline,runR31Battery}
 from '../lib/platform/research/robot-r31-recovery-regime-interlock.mjs';

const ready=[
 {transportConnected:true},
 {marketDataFresh:true,sequenceContinuous:true},
 {openOrdersKnown:true,positionsKnown:true},
 {riskLedgerMatches:true,unknownExposure:false}
];
const unknown=[
 {transportConnected:true},
 {marketDataFresh:true,sequenceContinuous:true},
 {openOrdersKnown:true,positionsKnown:true},
 {riskLedgerMatches:true,unknownExposure:true}
];

test('R31 requires READY and favorable regime simultaneously',()=>{
 const ok=evaluateRecoveryRegimeInterlock({recoverySequence:ready,regime:{regime:'GOOD',epoch:1,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}});
 assert.equal(ok.allowNewEntries,true);
 const blocked=evaluateRecoveryRegimeInterlock({recoverySequence:unknown,regime:{regime:'GOOD',epoch:2,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}});
 assert.equal(blocked.allowNewEntries,false);assert.ok(blocked.reasons.includes('RECOVERY_NOT_READY'));
});

test('R31 READY alone does not authorize bad economics',()=>{
 const x=evaluateRecoveryRegimeInterlock({recoverySequence:ready,regime:{regime:'BAD',epoch:3,totalCostBps:7,fillProbability:.9,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}});
 assert.equal(x.recoveryState,'READY');assert.equal(x.allowNewEntries,false);
 assert.ok(x.reasons.includes('ECONOMIC_REGIME_NOT_ELIGIBLE'));
});

test('R31 timeline never carries old authorization across outage/regime change',()=>{
 const x=runR31Battery();
 assert.equal(x.patternMatches,true);
 assert.deepEqual(x.timeline.trace.map(t=>t.allow),[true,false,false,true]);
 assert.equal(x.timeline.noAuthorizationCarryover,true);
});

test('R31 rejects non-monotonic epochs',()=>{
 assert.throws(()=>simulateInterlockedTimeline([
  {recoverySequence:ready,regime:{regime:'A',epoch:1,totalCostBps:1,fillProbability:.9,estimatedWinRate:.6,grossWinBps:12,grossLossBps:8}},
  {recoverySequence:ready,regime:{regime:'B',epoch:1,totalCostBps:1,fillProbability:.9,estimatedWinRate:.6,grossWinBps:12,grossLossBps:8}}
 ]),/R31_NON_MONOTONIC_EPOCH/);
});

test('R31 remains zero execution and no broker performance claim',()=>{
 const x=runR31Battery();
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
