import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateR35MultiSession,
  buildR35LongHoldout,
  runR35Battery
} from '../lib/platform/research/robot-r35-multisession-recovery.mjs';

test('R35 long holdout spans multiple independent sessions and authorizations',()=>{
  const events=buildR35LongHoldout({sessions:6,eventsPerSession:120});
  const x=simulateR35MultiSession({events,maxDrawdownR:4,maxLossStreak:4});
  assert.equal(x.sessions,6);
  assert.equal(x.authorizations,6);
  assert.equal(x.reauthorizations,5);
  assert.equal(x.falseAllows,0);
});

test('R35 partial recovery never authorizes entries prematurely',()=>{
  const events=buildR35LongHoldout({sessions:4,eventsPerSession:120});
  const x=simulateR35MultiSession({events,maxDrawdownR:4,maxLossStreak:4});
  assert.ok(x.blockedPartialRecovery>0);
  assert.equal(x.noStaleAuthorizationLeak,true);
});

test('R35 halted sessions remain blocked until a distinct session and authorization appear',()=>{
  const events=buildR35LongHoldout({sessions:5,eventsPerSession:140});
  const x=simulateR35MultiSession({events,maxDrawdownR:4,maxLossStreak:4});
  assert.ok(x.halts>=4);
  assert.ok(x.blockedStaleSession>0);
  assert.equal(x.noHaltedSessionResume,true);
});

test('R35 refuses session or authorization identifier reuse',()=>{
  const events=buildR35LongHoldout({sessions:4,eventsPerSession:100}).map(x=>({...x}));
  const firstSession2=events.findIndex(x=>x.sessionId==='S2');
  events[firstSession2].sessionId='S1';
  assert.throws(()=>simulateR35MultiSession({events,maxDrawdownR:4,maxLossStreak:4}),/R35_AUTHORIZATION_CHANGED_WITHIN_SESSION|R35_REUSED_SESSION_OR_AUTHORIZATION/);
});

test('R35 integrated battery validates 6000-event multi-session stress with zero execution',()=>{
  const x=runR35Battery();
  assert.equal(x.totalEvents,6000);
  assert.equal(x.expectedSessions,12);
  assert.equal(x.pass,true);
  assert.equal(x.result.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
