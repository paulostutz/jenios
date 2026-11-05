import test from 'node:test';import assert from 'node:assert/strict';
import {breakevenWinRate,expectedEdgeAfterCosts,dynamicBreakevenGate,compareGatePolicy,runR27Grid}
 from '../lib/platform/research/robot-r27-dynamic-breakeven.mjs';

test('R27 break-even rises as costs increase',()=>{
 const low=breakevenWinRate({grossWinBps:8,grossLossBps:8,totalCostBps:.5,fillProbability:.95,safetyMarginBps:0});
 const high=breakevenWinRate({grossWinBps:8,grossLossBps:8,totalCostBps:3.5,fillProbability:.95,safetyMarginBps:0});
 assert.ok(high.requiredWinRate>low.requiredWinRate);
});

test('R27 expected edge blocks mathematically bad high-turnover configuration',()=>{
 const e=expectedEdgeAfterCosts({estimatedWinRate:.56,grossWinBps:8,grossLossBps:8,totalCostBps:3.5,fillProbability:.95,safetyMarginBps:1});
 assert.equal(e.allow,false);
 assert.ok(e.requiredWinRate>.56);
});

test('R27 gate allows strong low-cost configuration',()=>{
 const g=dynamicBreakevenGate({estimatedWinRate:.60,grossWinBps:12,grossLossBps:8,totalCostBps:1,fillProbability:.95,safetyMarginBps:1});
 assert.equal(g.allow,true);assert.equal(g.ordersSent,0);assert.equal(g.actualBrokerPnl,null);
});

test('R27 policy comparison blocks all attempts when gate fails',()=>{
 const x=compareGatePolicy({attempts:5000,estimatedWinRate:.52,grossWinBps:8,grossLossBps:8,totalCostBps:5,fillProbability:.75,safetyMarginBps:1});
 assert.equal(x.gate.allow,false);assert.equal(x.gated.trades,0);assert.equal(x.blockedAttempts,5000);
});

test('R27 grid rejects many negative configurations while preserving positive ones',()=>{
 const x=runR27Grid();
 assert.ok(x.total>3000);
 assert.ok(x.blocked>0);assert.ok(x.allowed>0);
 assert.ok(x.gateAvoidedNegative>0);
 assert.ok(x.positiveGated<=x.allowed);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
