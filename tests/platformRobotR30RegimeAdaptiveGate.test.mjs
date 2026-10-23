import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateRegimeSnapshot,runRegimeSession,runR30ScenarioBattery}
 from '../lib/platform/research/robot-r30-regime-adaptive-gate.mjs';

test('R30 favorable snapshot can allow and cost spike can revoke',()=>{
 const good=evaluateRegimeSnapshot({regime:'GOOD',epoch:1,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9});
 const bad=evaluateRegimeSnapshot({regime:'BAD',epoch:2,totalCostBps:6,fillProbability:.9,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9});
 assert.equal(good.allow,true);assert.equal(bad.allow,false);
});

test('R30 session revokes and reauthorizes only after fresh epoch evaluation',()=>{
 const x=runRegimeSession({attemptsPerRegime:1000,regimes:[
  {regime:'GOOD',epoch:1,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9},
  {regime:'BAD',epoch:2,totalCostBps:6,fillProbability:.9,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9},
  {regime:'RECOVER',epoch:3,totalCostBps:1,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}
 ]});
 assert.equal(x.revocations,1);assert.equal(x.reAuthorizations,1);
 assert.equal(x.staleAuthorizationCarryover,false);
 assert.equal(x.allowedAttempts,2000);assert.equal(x.blockedAttempts,1000);
});

test('R30 rejects repeated authorization epoch',()=>{
 assert.throws(()=>runRegimeSession({attemptsPerRegime:1000,regimes:[
  {regime:'A',epoch:1,totalCostBps:1,fillProbability:.9,estimatedWinRate:.6,grossWinBps:12,grossLossBps:8},
  {regime:'B',epoch:1,totalCostBps:2,fillProbability:.8,estimatedWinRate:.55,grossWinBps:12,grossLossBps:8}
 ]}),/R30_EPOCH_NOT_ADVANCED/);
});

test('R30 scenario battery has multiple revocations/recoveries and zero execution',()=>{
 const x=runR30ScenarioBattery();
 assert.equal(x.sessions,3);
 assert.ok(x.totalAllowed>0);assert.ok(x.totalBlocked>0);
 assert.ok(x.revocations>=2);assert.ok(x.reAuthorizations>=2);
 assert.equal(x.allNoCarryover,true);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
