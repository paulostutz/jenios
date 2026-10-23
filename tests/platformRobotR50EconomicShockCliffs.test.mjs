import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateR50ShockSnapshot,
  runR50ShockTimeline,
  runR50Battery
} from '../lib/platform/research/robot-r50-economic-shock-cliffs.mjs';

const base={estimatedWinRate:.62,grossWinBps:15,grossLossBps:9,baseFillProbability:.95};

test('R50 favorable economics remain eligible',()=>{
  const x=evaluateR50ShockSnapshot({
    regime:'GOOD',epoch:1,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:1.2,...base
  });
  assert.equal(x.allow,true);
});

test('R50 fee spike revokes eligibility',()=>{
  const x=evaluateR50ShockSnapshot({
    regime:'FEE',epoch:1,baseFeeBps:10,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:1.2,...base
  });
  assert.equal(x.allow,false);
});

test('R50 liquidity cliff lowers fill and raises effective cost',()=>{
  const good=evaluateR50ShockSnapshot({
    regime:'GOOD',epoch:1,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:1.5,...base
  });
  const bad=evaluateR50ShockSnapshot({
    regime:'BAD',epoch:2,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:.15,...base
  });
  assert.ok(bad.effectiveFillProbability<good.effectiveFillProbability);
  assert.ok(bad.totalCostBps>good.totalCostBps);
  assert.equal(bad.allow,false);
});

test('R50 adverse selection shock revokes authorization',()=>{
  const x=evaluateR50ShockSnapshot({
    regime:'ADVERSE',epoch:1,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:10,depthRatio:1,...base
  });
  assert.equal(x.allow,false);
});

test('R50 timeline revokes and reauthorizes only on fresh epochs',()=>{
  const x=runR50ShockTimeline({snapshots:[
    {regime:'GOOD',epoch:1,baseFeeBps:1,spreadBps:1,slippageBps:1,adverseSelectionBps:.5,depthRatio:1.2,...base},
    {regime:'BAD',epoch:2,baseFeeBps:8,spreadBps:5,slippageBps:3,adverseSelectionBps:2,depthRatio:.5,...base},
    {regime:'RECOVER',epoch:3,baseFeeBps:1,spreadBps:1,slippageBps:1,adverseSelectionBps:.5,depthRatio:1.2,...base}
  ]});
  assert.deepEqual(x.trace.map(r=>r.allow),[true,false,true]);
  assert.equal(x.revocations,1);
  assert.equal(x.reAuthorizations,1);
  assert.equal(x.staleAuthorizationCarryover,false);
});

test('R50 integrated battery preserves zero execution',()=>{
  const x=runR50Battery();
  assert.equal(x.pass,true);
  assert.equal(x.patternMatches,true);
  assert.equal(x.ordersSent,0); assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null); assert.equal(x.actualLossesAvoided,null); assert.equal(x.realTradeAccuracy,null);
});
