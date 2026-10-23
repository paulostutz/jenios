import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR38State,
  ingestR38Event,
  runR38Timeline,
  buildR38Stress,
  runR38Battery
} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(streamId,epoch,id=`${streamId}-E${epoch}`)=>({
  streamId,eventId:id,
  sessionId:`${streamId}-S1`,authorizationId:`${streamId}-A1`,
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R38_'+streamId,epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});

test('R38 tracks ordering independently per stream',()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:3,tombstoneWindow:64});
  ingestR38Event(s,ev('A',1));
  ingestR38Event(s,ev('B',1));
  const x=ingestR38Event(s,ev('A',3));
  const y=ingestR38Event(s,ev('B',2));
  assert.equal(x.reason,'BUFFERED_OUT_OF_ORDER');
  assert.equal(y.accepted,true);
  assert.equal(s.streams.get('A').lastCommittedEpoch,1);
  assert.equal(s.streams.get('B').lastCommittedEpoch,2);
});

test('R38 expired active dedup entries remain blocked by tombstones',()=>{
  const s=createR38State({dedupWindow:16,maxReorderGap:2,tombstoneWindow:64});
  for(let i=1;i<=30;i++)ingestR38Event(s,ev('A',i));
  assert.equal(s.streams.get('A').seenSet.has('A-E1'),false);
  assert.equal(s.streams.get('A').tombstoneSet.has('A-E1'),true);
  const x=ingestR38Event(s,ev('A',1));
  assert.equal(x.allow,false);
  assert.equal(x.reason,'EXPIRED_REPLAY_TOMBSTONE');
});

test('R38 identical event ids in different streams do not collide',()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:2,tombstoneWindow:64});
  const a=ingestR38Event(s,ev('A',1,'SAME-ID'));
  const b=ingestR38Event(s,ev('B',1,'SAME-ID'));
  assert.equal(a.accepted,true);
  assert.equal(b.accepted,true);
  assert.equal(s.streams.size,2);
});

test('R38 bounded active and tombstone windows hold under stress',()=>{
  const events=buildR38Stress({streams:3,epochsPerStream:500});
  const x=runR38Timeline(events,{dedupWindow:64,maxReorderGap:4,tombstoneWindow:256});
  assert.equal(x.streamCount,3);
  assert.equal(x.boundedActiveDedup,true);
  assert.equal(x.boundedTombstones,true);
  assert.equal(x.invariantHolds,true);
});

test('R38 stress blocks duplicates, stale epochs, excessive gaps and expired replays',()=>{
  const events=buildR38Stress({streams:3,epochsPerStream:800});
  const x=runR38Timeline(events,{dedupWindow:64,maxReorderGap:4,tombstoneWindow:1024});
  assert.ok(x.totalDuplicateHits>0);
  assert.ok(x.totalExpiredReplayBlocks>=3);
  assert.ok(x.totalLateEpochBlocks>0);
  assert.ok(x.totalExcessiveGapBlocks>0);
  assert.ok(x.totalDrainedBuffered>0);
  assert.equal(x.falseAllows,0);
});

test('R38 integrated battery remains synthetic-only and zero execution',()=>{
  const x=runR38Battery();
  assert.equal(x.pass,true);
  assert.equal(x.result.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
