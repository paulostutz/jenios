import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapshotR39,
  restoreR39,
  rotateR39Session,
  runR39RestartScenario,
  runR39Battery
} from '../lib/platform/research/robot-r39-state-restore-session-rotation.mjs';
import {createR38State,ingestR38Event} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(streamId,epoch,session='S1',auth='A1',id=null)=>({
  streamId,eventId:id||`${streamId}-${session}-E${epoch}`,
  sessionId:`${streamId}-${session}`,
  authorizationId:`${streamId}-${auth}`,
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R39_'+streamId,epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});

test('R39 snapshot and restore preserve per-stream committed epochs and replay memory',()=>{
  const s=createR38State({dedupWindow:16,maxReorderGap:3,tombstoneWindow:64});
  for(let i=1;i<=40;i++)ingestR38Event(s,ev('A',i));
  const snap=snapshotR39(s);
  const restored=restoreR39(JSON.parse(JSON.stringify(snap)));
  assert.equal(restored.streams.get('A').lastCommittedEpoch,40);
  assert.equal(restored.streams.get('A').tombstoneSet.has('A-S1-E1'),true);
});

test('R39 restart does not forget an expired replay tombstone',()=>{
  const s=createR38State({dedupWindow:16,maxReorderGap:3,tombstoneWindow:64});
  for(let i=1;i<=40;i++)ingestR38Event(s,ev('A',i));
  const restored=restoreR39(JSON.parse(JSON.stringify(snapshotR39(s))));
  const x=ingestR38Event(restored,ev('A',1,'S1','A1','A-S1-E1'));
  assert.equal(x.allow,false);
  assert.equal(x.reason,'EXPIRED_REPLAY_TOMBSTONE');
});

test('R39 session rotation requires complete reset and unique identifiers',()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:3,tombstoneWindow:64});
  ingestR38Event(s,ev('A',1));
  const bad=rotateR39Session(s,{streamId:'A',newSessionId:'A-S2',newAuthorizationId:'A-A2',resetComplete:false});
  assert.equal(bad.rotated,false);
  const ok=rotateR39Session(s,{streamId:'A',newSessionId:'A-S2',newAuthorizationId:'A-A2',resetComplete:true});
  assert.equal(ok.rotated,true);
  const reuse=rotateR39Session(s,{streamId:'A',newSessionId:'A-S3',newAuthorizationId:'A-A2',resetComplete:true});
  assert.equal(reuse.rotated,false);
});

test('R39 restart scenario blocks replay after process restoration',()=>{
  const before=Array.from({length:40},(_,i)=>ev('A',i+1));
  const after=[ev('A',1,'S1','A1','A-S1-E1'),ev('A',41)];
  const x=runR39RestartScenario({before,after,opts:{dedupWindow:16,maxReorderGap:3,tombstoneWindow:64}});
  assert.ok(x.replayBlocksAfterRestart>=1);
  assert.equal(x.falseAllows,0);
});

test('R39 integrated battery preserves state across restart and session rotation',()=>{
  const x=runR39Battery();
  assert.equal(x.streams,3);
  assert.equal(x.snapshotStreams,3);
  assert.equal(x.pass,true);
  assert.equal(x.falseAllows,0);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
