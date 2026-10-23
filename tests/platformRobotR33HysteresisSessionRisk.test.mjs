import test from 'node:test';import assert from 'node:assert/strict';
import {hysteresisStep,runHysteresisTimeline,sessionRiskStep,simulateR33Session,runR33Battery}
 from '../lib/platform/research/robot-r33-hysteresis-session-risk.mjs';

const good=(epoch)=>({epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9});
const bad=(epoch)=>({epoch,totalCostBps:7,fillProbability:.6,estimatedWinRate:.52,grossWinBps:10,grossLossBps:10});

test('R33 requires consecutive good snapshots before enabling',()=>{
 let h={state:'BLOCKED',goodStreak:0,badStreak:0};
 let a=hysteresisStep({...h,regime:good(1),confirmGood:2,confirmBad:1});
 assert.equal(a.state,'BLOCKED');
 let b=hysteresisStep({state:a.state,goodStreak:a.goodStreak,badStreak:a.badStreak,regime:good(2),confirmGood:2,confirmBad:1});
 assert.equal(b.state,'ALLOWED');
});

test('R33 revokes promptly on bad regime while reducing chatter',()=>{
 const regimes=[];
 for(let i=0;i<100;i++)regimes.push(i%2===0?good(i+1):bad(i+1));
 const h=runHysteresisTimeline(regimes,{confirmGood:2,confirmBad:1});
 assert.ok(h.hysteresisTransitions<h.rawTransitions);
 assert.ok(h.transitionReduction>0);
});

test('R33 session drawdown halts even if economics later improve',()=>{
 let r={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
 for(const x of [1,1,-2,-2,-2]){
  r=sessionRiskStep({...r,tradeNetR:x,maxDrawdownR:5,maxLossStreak:10});
 }
 assert.equal(r.halted,true);
 assert.ok(r.haltReasons.includes('SESSION_DRAWDOWN_LIMIT'));
});

test('R33 halted session never resumes just because regime becomes good again',()=>{
 const regimes=[good(1),good(2),good(3),good(4),good(5),good(6),good(7),good(8)];
 const outcomes=[0,-3,-3,-3,1,1,1,1];
 const x=simulateR33Session({regimes,tradeOutcomes:outcomes,maxDrawdownR:5,maxLossStreak:10,confirmGood:2,confirmBad:1});
 assert.equal(x.halted,true);
 assert.ok(x.blockedByRisk>0);
});

test('R33 long battery reduces state churn and preserves zero execution',()=>{
 const x=runR33Battery();
 assert.equal(x.events,2400);
 assert.ok(x.transitionReduction>0);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
