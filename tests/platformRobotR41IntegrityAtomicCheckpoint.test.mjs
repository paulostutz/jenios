import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checksumR41,
  sealR41Snapshot,
  verifyR41SealedSnapshot,
  restoreR41FailClosed,
  createR41CheckpointSlots,
  stageR41Checkpoint,
  commitR41Checkpoint,
  recoverR41Checkpoint,
  simulateR41InterruptedWrite,
  runR41Battery
} from '../lib/platform/research/robot-r41-integrity-atomic-checkpoint.mjs';
import {createR38State,ingestR38Event} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';
import {snapshotR39} from '../lib/platform/research/robot-r39-state-restore-session-rotation.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(epoch)=>({
  streamId:'A',eventId:'A-E'+epoch,sessionId:'A-S1',authorizationId:'A-A1',
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R41_A',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});
const makeState=()=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=50;i++)ingestR38Event(s,ev(i));
  return s;
};

test('R41 checksum is deterministic for equivalent snapshot objects',()=>{
  const snap=snapshotR39(makeState());
  const clone=JSON.parse(JSON.stringify(snap));
  assert.equal(checksumR41(snap),checksumR41(clone));
});

test('R41 detects silent payload modification',()=>{
  const sealed=JSON.parse(JSON.stringify(sealR41Snapshot(snapshotR39(makeState()))));
  sealed.payload.streams[0].lastCommittedEpoch+=1;
  const x=restoreR41FailClosed(sealed);
  assert.equal(x.ok,false);
  assert.equal(x.reason,'R41_CHECKSUM_MISMATCH');
  assert.equal(x.operationalAuthorization,false);
});

test('R41 detects truncation and fails closed',()=>{
  const sealed=JSON.parse(JSON.stringify(sealR41Snapshot(snapshotR39(makeState()))));
  sealed.payload=null;
  const x=restoreR41FailClosed(sealed);
  assert.equal(x.ok,false);
  assert.equal(x.failClosed,true);
  assert.equal(x.operationalAuthorization,false);
});

test('R41 staged but uncommitted checkpoint is never recoverable',()=>{
  const slots=createR41CheckpointSlots();
  stageR41Checkpoint(slots,makeState());
  const x=recoverR41Checkpoint(slots);
  assert.equal(x.ok,false);
  assert.equal(x.reason,'R41_NO_COMMITTED_CHECKPOINT');
});

test('R41 committed checkpoint verifies integrity and restores state',()=>{
  const slots=createR41CheckpointSlots();
  stageR41Checkpoint(slots,makeState());
  commitR41Checkpoint(slots);
  const x=recoverR41Checkpoint(slots);
  assert.equal(x.ok,true);
  assert.equal(x.integrityVerified,true);
  assert.equal(x.state.streams.get('A').lastCommittedEpoch,50);
});

test('R41 interruption model distinguishes stage from commit',()=>{
  const state=makeState();
  const staged=simulateR41InterruptedWrite({state,interruptAt:'after_stage'});
  const committed=simulateR41InterruptedWrite({state,interruptAt:'after_commit'});
  assert.equal(staged.recovery.ok,false);
  assert.equal(committed.recovery.ok,true);
});

test('R41 integrated battery preserves zero execution',()=>{
  const x=runR41Battery(makeState());
  assert.equal(x.pass,true);
  assert.equal(x.tamperBlocked,true);
  assert.equal(x.truncationBlocked,true);
  assert.equal(x.interruptedStageNotRecoverable,true);
  assert.equal(x.committedCheckpointRecoverable,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
