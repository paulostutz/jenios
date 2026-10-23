import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runR34IndependentHysteresisHoldout,
  evaluateSessionEntry,
  simulateR34SessionLifecycle,
  runR34Battery
} from '../lib/platform/research/robot-r34-holdout-session-reauth.mjs';

const good=epoch=>({
  regime:'GOOD',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9
});
const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];

test('R34 validates frozen R33 hysteresis across independent switching frequencies',()=>{
  const x=runR34IndependentHysteresisHoldout({events:1200,switchPeriods:[1,2,3,5,8,13,21]});
  assert.equal(x.generatorIndependentFromR33,true);
  assert.equal(x.policyFrozenFromR33,true);
  assert.equal(x.cases.length,7);
  assert.equal(x.allCasesNonIncreasingChatter,true);
  assert.ok(x.aggregateTransitionReduction>=0);
});

test('R34 same halted session remains blocked even when recovery and economics are ready',()=>{
  const x=evaluateSessionEntry({
    sessionId:'S1',authorizationId:'A1',haltedSessionId:'S1',
    recoverySequence:ready,regime:good(10)
  });
  assert.equal(x.allowNewEntries,false);
  assert.equal(x.staleSession,true);
  assert.ok(x.reasons.includes('NEW_SESSION_AUTHORIZATION_REQUIRED'));
});

test('R34 rotated session and authorization may proceed only with recovery plus economics ready',()=>{
  const x=evaluateSessionEntry({
    sessionId:'S2',authorizationId:'A2',haltedSessionId:'S1',
    recoverySequence:ready,regime:good(11)
  });
  assert.equal(x.allowNewEntries,true);
  assert.equal(x.staleSession,false);
});

test('R34 risk halt cannot auto-resume old session and explicit restart rotates session',()=>{
  const regimes=Array.from({length:30},(_,i)=>good(i+1));
  const outcomes=Array.from({length:30},(_,i)=>i<8?(i%2===0?.2:-2):.4);
  const recoverySequences=Array.from({length:30},()=>ready);
  const x=simulateR34SessionLifecycle({
    regimes,tradeOutcomes:outcomes,recoverySequences,
    restartAtIndex:18,restartSessionId:'S2',restartAuthorizationId:'A2',
    maxDrawdownR:4,maxLossStreak:5
  });
  assert.equal(x.haltedSessionId,'S1');
  assert.equal(x.finalSessionId,'S2');
  assert.equal(x.reauthorized,true);
  assert.ok(x.blockedByRiskSession>0);
  assert.equal(x.oldSessionCannotResume,true);
});

test('R34 rejects restart that reuses old session or authorization identifiers',()=>{
  const regimes=Array.from({length:5},(_,i)=>good(i+1));
  const outcomes=[.1,-2,-2,.2,.2];
  const recoverySequences=Array.from({length:5},()=>ready);
  assert.throws(()=>simulateR34SessionLifecycle({
    regimes,tradeOutcomes:outcomes,recoverySequences,
    restartAtIndex:3,restartSessionId:'S1',restartAuthorizationId:'A2',
    maxDrawdownR:2,maxLossStreak:5
  }),/R34_RESTART_MUST_ROTATE_IDENTIFIERS/);
});

test('R34 integrated battery preserves synthetic-only evidence and zero execution',()=>{
  const x=runR34Battery();
  assert.equal(x.holdoutPass,true);
  assert.equal(x.reauthPass,true);
  assert.equal(x.noExecution,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
