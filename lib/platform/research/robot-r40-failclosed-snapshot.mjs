/**
 * R40 — fail-closed snapshot validation and buffered checkpoint recovery.
 * Extends R39 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {createR38State,ingestR38Event} from './robot-r38-multistream-expiry.mjs';
import {snapshotR39,restoreR39} from './robot-r39-state-restore-session-rotation.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

function assertArray(x,c){if(!Array.isArray(x))fail(c);}
function assertInt(x,c){if(!Number.isSafeInteger(x))fail(c);}

export function validateR40Snapshot(snapshot){
  if(!snapshot||snapshot.schema!=='JENIOS_R39_SNAPSHOT_V1')fail('R40_INCOMPATIBLE_SNAPSHOT_VERSION');
  if(!Number.isSafeInteger(snapshot.dedupWindow)||!Number.isSafeInteger(snapshot.maxReorderGap)||
     !Number.isSafeInteger(snapshot.tombstoneWindow)||!Array.isArray(snapshot.streams))
    fail('R40_CORRUPT_SNAPSHOT_HEADER');

  for(const s of snapshot.streams){
    if(!s||typeof s.streamId!=='string'||!s.streamId)fail('R40_CORRUPT_STREAM');
    assertInt(s.lastCommittedEpoch,'R40_CORRUPT_STREAM_EPOCH');
    assertArray(s.seenOrder,'R40_CORRUPT_SEEN_ORDER');
    assertArray(s.tombstoneOrder,'R40_CORRUPT_TOMBSTONES');
    assertArray(s.reorderBuffer,'R40_CORRUPT_REORDER_BUFFER');
    if(!s.r36||typeof s.r36!=='object')fail('R40_CORRUPT_R36_STATE');
    assertArray(s.r36.processedEventIds,'R40_CORRUPT_PROCESSED_IDS');
    assertArray(s.r36.sessionAuthorizations,'R40_CORRUPT_SESSION_AUTHS');
    assertArray(s.r36.haltedSessions,'R40_CORRUPT_HALTED_SESSIONS');

    for(const pair of s.reorderBuffer){
      if(!Array.isArray(pair)||pair.length!==2||!Number.isSafeInteger(pair[0])||!pair[1]?.regime)
        fail('R40_CORRUPT_BUFFER_ENTRY');
      if(pair[0]<=s.lastCommittedEpoch)fail('R40_STALE_BUFFER_ENTRY');
      if(pair[1].regime.epoch!==pair[0])fail('R40_BUFFER_EPOCH_MISMATCH');
    }
  }
  return true;
}

export function restoreR40FailClosed(snapshot){
  try{
    validateR40Snapshot(snapshot);
    const state=restoreR39(snapshot);
    return Object.freeze({ok:true,state,reason:null});
  }catch(error){
    return Object.freeze({
      ok:false,
      state:null,
      reason:error?.code||'R40_SNAPSHOT_RESTORE_FAILED',
      operationalAuthorization:false,
      failClosed:true
    });
  }
}

export function checkpointR40WithBufferedEvents({eventsBefore=[],bufferedEvent,eventsAfter=[],opts={}}={}){
  if(!Array.isArray(eventsBefore)||eventsBefore.length<3||!bufferedEvent||!Array.isArray(eventsAfter))
    fail('R40_INVALID_BUFFERED_CHECKPOINT_SCENARIO');

  const state=createR38State(opts);
  for(const e of eventsBefore)ingestR38Event(state,e);
  const buffered=ingestR38Event(state,bufferedEvent);
  if(buffered.reason!=='BUFFERED_OUT_OF_ORDER')fail('R40_EXPECTED_BUFFERED_EVENT');

  const snap=snapshotR39(state);
  validateR40Snapshot(snap);
  const restored=restoreR40FailClosed(JSON.parse(JSON.stringify(snap)));
  if(!restored.ok)fail('R40_VALID_SNAPSHOT_RESTORE_FAILED');

  const results=[];
  for(const e of eventsAfter)results.push(ingestR38Event(restored.state,e));

  const stream=restored.state.streams.get(bufferedEvent.streamId);
  return Object.freeze({
    schema:'JENIOS_R40_BUFFERED_CHECKPOINT_V1',
    restored:true,
    lastCommittedEpoch:stream?.lastCommittedEpoch??null,
    remainingBuffered:stream?.reorderBuffer?.size??null,
    drainedBuffered:stream?.drainedBuffered??null,
    falseAllows:[...restored.state.streams.values()].reduce((a,s)=>a+s.falseAllows+s.r36.falseAllows,0),
    results:Object.freeze(results),
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}

const ready=()=>[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(streamId,epoch,id=null)=>({
  streamId,eventId:id||`${streamId}-E${epoch}`,
  sessionId:`${streamId}-S1`,authorizationId:`${streamId}-A1`,
  resetComplete:epoch===1,recoverySequence:ready(),
  regime:{regime:'R40_'+streamId,epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});

export function runR40Battery(){
  const state=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=50;i++)ingestR38Event(state,ev('A',i));
  const good=snapshotR39(state);

  const corruptHeader={...good,schema:'JENIOS_R39_SNAPSHOT_V0'};
  const missingStreams={...good,streams:null};
  const staleBuffer=JSON.parse(JSON.stringify(good));
  staleBuffer.streams[0].reorderBuffer=[[1,ev('A',1,'STALE-BUFFER')]];

  const c1=restoreR40FailClosed(corruptHeader);
  const c2=restoreR40FailClosed(missingStreams);
  const c3=restoreR40FailClosed(staleBuffer);

  const before=[ev('B',1),ev('B',2),ev('B',3)];
  const buffered=ev('B',5);
  const after=[ev('B',4),ev('B',6),ev('B',7),ev('B',8),ev('B',9)];
  const mid=checkpointR40WithBufferedEvents({
    eventsBefore:before,bufferedEvent:buffered,eventsAfter:after,
    opts:{dedupWindow:32,maxReorderGap:4,tombstoneWindow:128}
  });

  return Object.freeze({
    schema:'JENIOS_R40_BATTERY_V1',
    corruptionsBlocked:[c1,c2,c3].every(x=>x.ok===false&&x.failClosed===true&&x.operationalAuthorization===false),
    bufferedCheckpointRestored:mid.restored===true,
    bufferedEventEventuallyDrained:(mid.drainedBuffered||0)>0,
    noBufferedResidue:mid.remainingBuffered===0,
    falseAllows:mid.falseAllows,
    pass:[c1,c2,c3].every(x=>x.ok===false&&x.failClosed===true)&&
      mid.restored===true&&(mid.drainedBuffered||0)>0&&mid.remainingBuffered===0&&mid.falseAllows===0,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
