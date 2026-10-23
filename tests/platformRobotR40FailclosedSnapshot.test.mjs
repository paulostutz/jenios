import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateR40Snapshot,
  restoreR40FailClosed,
  checkpointR40WithBufferedEvents,
  runR40Battery
} from '../lib/platform/research/robot-r40-failclosed-snapshot.mjs';
import {createR38State,ingestR38Event} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';
import {snapshotR39} from '../lib/platform/research/robot-r39-state-restore-session-rotation.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(streamId,epoch,id=null)=>({
  streamId,eventId:id||`${streamId}-E${epoch}`,
  sessionId:`${streamId}-S1`,authorizationId:`${streamId}-A1`,
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R40_'+streamId,epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});

test('R40 accepts a valid R39 snapshot',()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=20;i++)ingestR38Event(s,ev('A',i));
  const snap=snapshotR39(s);
  assert.equal(validateR40Snapshot(snap),true);
  const restored=restoreR40FailClosed(JSON.parse(JSON.stringify(snap)));
  assert.equal(restored.ok,true);
});

test('R40 incompatible snapshot version fails closed',()=>{
  const x=restoreR40FailClosed({schema:'JENIOS_R39_SNAPSHOT_V0'});
  assert.equal(x.ok,false);
  assert.equal(x.failClosed,true);
  assert.equal(x.operationalAuthorization,false);
  assert.equal(x.reason,'R40_INCOMPATIBLE_SNAPSHOT_VERSION');
});

test('R40 corrupt or incomplete snapshot fails closed',()=>{
  const x=restoreR40FailClosed({schema:'JENIOS_R39_SNAPSHOT_V1',dedupWindow:32,maxReorderGap:4,tombstoneWindow:128,streams:null});
  assert.equal(x.ok,false);
  assert.equal(x.failClosed,true);
  assert.equal(x.operationalAuthorization,false);
});

test('R40 rejects stale buffered epochs in persisted state',()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=10;i++)ingestR38Event(s,ev('A',i));
  const snap=JSON.parse(JSON.stringify(snapshotR39(s)));
  snap.streams[0].reorderBuffer=[[5,ev('A',5,'STALE')]];
  const x=restoreR40FailClosed(snap);
  assert.equal(x.ok,false);
  assert.equal(x.reason,'R40_STALE_BUFFER_ENTRY');
});

test('R40 restores a checkpoint taken with an out-of-order event buffered',()=>{
  const x=checkpointR40WithBufferedEvents({
    eventsBefore:[ev('B',1),ev('B',2),ev('B',3)],
    bufferedEvent:ev('B',5),
    eventsAfter:[ev('B',4),ev('B',6),ev('B',7),ev('B',8),ev('B',9)],
    opts:{dedupWindow:32,maxReorderGap:4,tombstoneWindow:128}
  });
  assert.equal(x.restored,true);
  assert.ok(x.drainedBuffered>0);
  assert.equal(x.remainingBuffered,0);
  assert.equal(x.falseAllows,0);
});

test('R40 integrated battery fails closed and preserves zero execution',()=>{
  const x=runR40Battery();
  assert.equal(x.pass,true);
  assert.equal(x.corruptionsBlocked,true);
  assert.equal(x.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
