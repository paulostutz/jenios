import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR37State,
  ingestR37Event,
  runR37Timeline,
  buildR37Stress,
  runR37Battery
} from '../lib/platform/research/robot-r37-ordered-ingestion.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(epoch,id='E'+epoch)=>({
  eventId:id,sessionId:'S1',authorizationId:'A1',resetComplete:epoch===1,
  recoverySequence:ready,
  regime:{regime:'R37_GOOD',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});

test('R37 buffers a near-future event and drains it after the missing epoch arrives',()=>{
  const s=createR37State({dedupWindow:64,maxReorderGap:3});
  const a=ingestR37Event(s,ev(1));
  const b=ingestR37Event(s,ev(3));
  const c=ingestR37Event(s,ev(2));
  assert.equal(a.accepted,true);
  assert.equal(b.reason,'BUFFERED_OUT_OF_ORDER');
  assert.equal(c.drained.length,1);
  assert.equal(c.drained[0].epoch,3);
  assert.equal(s.lastCommittedEpoch,3);
});

test('R37 rejects late epochs even when event id is new',()=>{
  const s=createR37State({dedupWindow:64,maxReorderGap:3});
  ingestR37Event(s,ev(1));
  ingestR37Event(s,ev(2));
  const x=ingestR37Event(s,{...ev(1,'NEW-ID'),regime:{...ev(1).regime,epoch:1}});
  assert.equal(x.allow,false);
  assert.equal(x.reason,'LATE_EPOCH_REJECTED');
  assert.equal(s.lateEpochBlocks,1);
});

test('R37 blocks gaps beyond reorder tolerance',()=>{
  const s=createR37State({dedupWindow:64,maxReorderGap:2});
  ingestR37Event(s,ev(1));
  const x=ingestR37Event(s,ev(10,'GAP-PROBE'));
  assert.equal(x.allow,false);
  assert.equal(x.reason,'REORDER_GAP_EXCEEDED');
  assert.equal(s.excessiveGapBlocks,1);
});

test('R37 bounded dedup window does not grow without limit',()=>{
  const events=Array.from({length:200},(_,i)=>ev(i+1));
  const x=runR37Timeline(events,{dedupWindow:64,maxReorderGap:2});
  assert.equal(x.dedupRetained,64);
  assert.equal(x.lastCommittedEpoch,200);
});

test('R37 stress handles out-of-order, duplicate, stale and excessive-gap events without false allows',()=>{
  const events=buildR37Stress({events:1200});
  const x=runR37Timeline(events,{dedupWindow:128,maxReorderGap:4});
  assert.ok(x.drainedBuffered>0);
  assert.ok(x.duplicateWindowHits>0);
  assert.ok(x.lateEpochBlocks>0);
  assert.ok(x.excessiveGapBlocks>0);
  assert.equal(x.falseAllows,0);
  assert.equal(x.invariantHolds,true);
});

test('R37 integrated battery remains synthetic-only and zero execution',()=>{
  const x=runR37Battery();
  assert.equal(x.pass,true);
  assert.equal(x.result.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
