import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR48Controller,
  beginR48Reconnect,
  markR48Connected,
  enqueueR48Task,
  consumeR48Budget,
  drainR48Queue,
  authorizeR48Decision,
  runR48Battery
} from '../lib/platform/research/robot-r48-reconnect-backpressure.mjs';

test('R48 reconnect storms increase backoff monotonically up to cap',()=>{
  const c=createR48Controller({baseBackoffMs:100,maxBackoffMs:800});
  const a=beginR48Reconnect(c,{nowMs:0});
  const b=beginR48Reconnect(c,{nowMs:10});
  const d=beginR48Reconnect(c,{nowMs:20});
  assert.ok(a.backoffMs<b.backoffMs);
  assert.ok(b.backoffMs<=d.backoffMs);
  assert.ok(d.backoffMs<=800);
});

test('R48 reconnect epoch invalidates queued work from prior connection',()=>{
  const c=createR48Controller();
  const a=beginR48Reconnect(c,{nowMs:0});
  markR48Connected(c,{nowMs:100});
  const ok=enqueueR48Task(c,{taskId:'a',createdAtMs:100,reconnectEpoch:c.reconnectEpoch});
  assert.equal(ok.queued,true);
  const old=c.reconnectEpoch;
  beginR48Reconnect(c,{nowMs:200});
  const stale=enqueueR48Task(c,{taskId:'b',createdAtMs:190,reconnectEpoch:old});
  assert.equal(stale.queued,false);
  assert.equal(stale.reason,'R48_STALE_RECONNECT_EPOCH');
});

test('R48 queue overflow blocks new work',()=>{
  const c=createR48Controller({maxQueue:4});
  beginR48Reconnect(c,{nowMs:0}); markR48Connected(c,{nowMs:10});
  for(let i=0;i<4;i++)assert.equal(enqueueR48Task(c,{taskId:'q'+i,createdAtMs:10,reconnectEpoch:c.reconnectEpoch}).queued,true);
  const x=enqueueR48Task(c,{taskId:'overflow',createdAtMs:10,reconnectEpoch:c.reconnectEpoch});
  assert.equal(x.queued,false); assert.equal(x.reason,'R48_QUEUE_OVERFLOW');
});

test('R48 request budget prevents retry storm',()=>{
  const c=createR48Controller({requestBudget:2,budgetWindowMs:1000});
  beginR48Reconnect(c,{nowMs:0}); markR48Connected(c,{nowMs:1});
  assert.equal(consumeR48Budget(c,{nowMs:10}).allow,true);
  assert.equal(consumeR48Budget(c,{nowMs:20}).allow,true);
  const x=consumeR48Budget(c,{nowMs:30});
  assert.equal(x.allow,false); assert.equal(x.reason,'R48_RATE_LIMIT_BUDGET_EXHAUSTED');
});

test('R48 drain drops stale tasks rather than processing them late',()=>{
  const c=createR48Controller({maxTaskAgeMs:100,requestBudget:10});
  beginR48Reconnect(c,{nowMs:0}); markR48Connected(c,{nowMs:1});
  enqueueR48Task(c,{taskId:'old',createdAtMs:10,reconnectEpoch:c.reconnectEpoch});
  const x=drainR48Queue(c,{nowMs:200});
  assert.equal(x.processedNow,0);
  assert.equal(x.results[0].reason,'R48_STALE_TASK_DROPPED');
});

test('R48 high queue pressure blocks decision authorization',()=>{
  const c=createR48Controller({maxQueue:8});
  beginR48Reconnect(c,{nowMs:0}); markR48Connected(c,{nowMs:1});
  for(let i=0;i<6;i++)enqueueR48Task(c,{taskId:'q'+i,createdAtMs:10,reconnectEpoch:c.reconnectEpoch});
  const x=authorizeR48Decision(c,{nowMs:20,decisionCreatedAtMs:15,reconnectEpoch:c.reconnectEpoch});
  assert.equal(x.allow,false); assert.equal(x.reason,'R48_BACKPRESSURE_HIGH');
});

test('R48 integrated battery preserves zero execution',()=>{
  const x=runR48Battery();
  assert.equal(x.pass,true);
  assert.equal(x.ordersSent,0); assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null); assert.equal(x.actualLossesAvoided,null); assert.equal(x.realTradeAccuracy,null);
});
