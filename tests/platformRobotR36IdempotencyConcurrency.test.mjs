import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR36State,
  applyR36Event,
  runR36Timeline,
  buildR36Stress,
  runR36Battery
} from '../lib/platform/research/robot-r36-idempotency-concurrency.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const good=epoch=>({
  regime:'R36_GOOD',epoch,totalCostBps:1,fillProbability:.95,
  estimatedWinRate:.62,grossWinBps:15,grossLossBps:9
});

test('R36 exact duplicate replay is idempotently ignored',()=>{
  const state=createR36State();
  const e={eventId:'E1',sessionId:'S1',authorizationId:'A1',resetComplete:true,recoverySequence:ready,regime:good(1),tradeNetR:.2};
  const a=applyR36Event(state,e);
  const b=applyR36Event(state,{...e});
  assert.equal(b.duplicate,true);
  assert.equal(b.reason,'IDEMPOTENT_REPLAY_IGNORED');
  assert.equal(state.duplicatesIgnored,1);
  assert.equal(state.trades,a.allow?1:0);
});

test('R36 conflicting replay with same event id is blocked',()=>{
  const state=createR36State();
  const e={eventId:'E1',sessionId:'S1',authorizationId:'A1',resetComplete:true,recoverySequence:ready,regime:good(1),tradeNetR:.2};
  applyR36Event(state,e);
  const x=applyR36Event(state,{...e,tradeNetR:2});
  assert.equal(x.allow,false);
  assert.equal(x.reason,'EVENT_ID_REPLAY_CONFLICT');
  assert.equal(state.replayConflicts,1);
});

test('R36 incomplete reset blocks concurrent session switch',()=>{
  const state=createR36State();
  applyR36Event(state,{eventId:'E1',sessionId:'S1',authorizationId:'A1',resetComplete:true,recoverySequence:ready,regime:good(1),tradeNetR:.2});
  const x=applyR36Event(state,{eventId:'E2',sessionId:'S2',authorizationId:'A2',resetComplete:false,recoverySequence:ready,regime:good(2),tradeNetR:.2});
  assert.equal(x.allow,false);
  assert.equal(x.reason,'INCOMPLETE_SESSION_RESET');
  assert.equal(state.incompleteResetBlocks,1);
});

test('R36 authorization cannot change inside the same session',()=>{
  const state=createR36State();
  applyR36Event(state,{eventId:'E1',sessionId:'S1',authorizationId:'A1',resetComplete:true,recoverySequence:ready,regime:good(1),tradeNetR:.2});
  const x=applyR36Event(state,{eventId:'E2',sessionId:'S1',authorizationId:'A2',recoverySequence:ready,regime:good(2),tradeNetR:.2});
  assert.equal(x.allow,false);
  assert.equal(x.reason,'SESSION_AUTHORIZATION_CONFLICT');
  assert.equal(state.concurrencyConflicts,1);
});

test('R36 stress timeline preserves zero false allows under duplicates and races',()=>{
  const events=buildR36Stress({sessions:6,eventsPerSession:160});
  const x=runR36Timeline(events);
  assert.equal(x.sessions,6);
  assert.ok(x.duplicatesIgnored>0);
  assert.ok(x.replayConflicts>0);
  assert.ok(x.incompleteResetBlocks>0);
  assert.equal(x.falseAllows,0);
  assert.equal(x.invariantHolds,true);
});

test('R36 integrated battery remains synthetic-only and zero execution',()=>{
  const x=runR36Battery();
  assert.equal(x.nominalSessions,10);
  assert.equal(x.pass,true);
  assert.equal(x.result.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
