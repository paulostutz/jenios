/**
 * R39 — per-stream session rotation + restart-safe state persistence.
 * Extends R38 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {createR38State,ingestR38Event} from './robot-r38-multistream-expiry.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function snapshotR39(state){
  if(!state||!(state.streams instanceof Map))fail('R39_INVALID_STATE');
  const streams=[...state.streams.entries()].map(([streamId,s])=>({
    streamId,
    lastCommittedEpoch:s.lastCommittedEpoch,
    seenOrder:[...s.seenOrder],
    tombstoneOrder:[...s.tombstoneOrder],
    reorderBuffer:[...s.reorderBuffer.entries()],
    r36:{
      processedEventIds:[...s.r36.processedEventIds],
      sessionAuthorizations:[...s.r36.sessionAuthorizations.entries()],
      haltedSessions:[...s.r36.haltedSessions],
      currentSession:s.r36.currentSession,
      currentAuthorization:s.r36.currentAuthorization,
      h:{...s.r36.h},
      risk:{...s.r36.risk},
      trades:s.r36.trades,
      duplicatesIgnored:s.r36.duplicatesIgnored,
      replayConflicts:s.r36.replayConflicts,
      concurrencyConflicts:s.r36.concurrencyConflicts,
      incompleteResetBlocks:s.r36.incompleteResetBlocks,
      staleSessionBlocks:s.r36.staleSessionBlocks,
      falseAllows:s.r36.falseAllows,
      fingerprints:Object.fromEntries(Object.entries(s.r36).filter(([k])=>k.startsWith('fp:')))
    },
    duplicateHits:s.duplicateHits,
    expiredReplayBlocks:s.expiredReplayBlocks,
    lateEpochBlocks:s.lateEpochBlocks,
    excessiveGapBlocks:s.excessiveGapBlocks,
    drainedBuffered:s.drainedBuffered,
    falseAllows:s.falseAllows
  }));
  return Object.freeze({
    schema:'JENIOS_R39_SNAPSHOT_V1',
    dedupWindow:state.dedupWindow,
    maxReorderGap:state.maxReorderGap,
    tombstoneWindow:state.tombstoneWindow,
    totalFalseAllows:state.totalFalseAllows,
    crossStreamCollisions:state.crossStreamCollisions,
    streams:Object.freeze(streams)
  });
}

export function restoreR39(snapshot){
  if(!snapshot||snapshot.schema!=='JENIOS_R39_SNAPSHOT_V1'||!Array.isArray(snapshot.streams))
    fail('R39_INVALID_SNAPSHOT');
  const state=createR38State({
    dedupWindow:snapshot.dedupWindow,
    maxReorderGap:snapshot.maxReorderGap,
    tombstoneWindow:snapshot.tombstoneWindow
  });
  state.totalFalseAllows=snapshot.totalFalseAllows||0;
  state.crossStreamCollisions=snapshot.crossStreamCollisions||0;

  for(const x of snapshot.streams){
    const seed={streamId:x.streamId,eventId:'__seed__',sessionId:'__seed__',authorizationId:'__seed__',
      resetComplete:true,recoverySequence:[{transportConnected:true}],regime:{regime:'SEED',epoch:1},tradeNetR:0};
    // instantiate stream lazily through a disposable state then replace all fields
    try{ingestR38Event(state,seed);}catch{}
    const s=state.streams.get(x.streamId);
    if(!s)fail('R39_RESTORE_STREAM_FAILED');
    s.lastCommittedEpoch=x.lastCommittedEpoch;
    s.seenOrder=[...x.seenOrder];s.seenSet=new Set(x.seenOrder);
    s.tombstoneOrder=[...x.tombstoneOrder];s.tombstoneSet=new Set(x.tombstoneOrder);
    s.reorderBuffer=new Map(x.reorderBuffer);
    s.duplicateHits=x.duplicateHits||0;
    s.expiredReplayBlocks=x.expiredReplayBlocks||0;
    s.lateEpochBlocks=x.lateEpochBlocks||0;
    s.excessiveGapBlocks=x.excessiveGapBlocks||0;
    s.drainedBuffered=x.drainedBuffered||0;
    s.falseAllows=x.falseAllows||0;

    const r=s.r36;
    r.processedEventIds=new Set(x.r36.processedEventIds);
    r.sessionAuthorizations=new Map(x.r36.sessionAuthorizations);
    r.haltedSessions=new Set(x.r36.haltedSessions);
    r.currentSession=x.r36.currentSession;
    r.currentAuthorization=x.r36.currentAuthorization;
    r.h={...x.r36.h};r.risk={...x.r36.risk};
    r.trades=x.r36.trades||0;
    r.duplicatesIgnored=x.r36.duplicatesIgnored||0;
    r.replayConflicts=x.r36.replayConflicts||0;
    r.concurrencyConflicts=x.r36.concurrencyConflicts||0;
    r.incompleteResetBlocks=x.r36.incompleteResetBlocks||0;
    r.staleSessionBlocks=x.r36.staleSessionBlocks||0;
    r.falseAllows=x.r36.falseAllows||0;
    for(const [k,v] of Object.entries(x.r36.fingerprints||{}))r[k]=v;
  }
  return state;
}

export function rotateR39Session(state,{streamId,newSessionId,newAuthorizationId,resetComplete=true}={}){
  if(!state||!(state.streams instanceof Map)||typeof streamId!=='string'||!streamId||
     typeof newSessionId!=='string'||!newSessionId||
     typeof newAuthorizationId!=='string'||!newAuthorizationId)
    fail('R39_INVALID_ROTATION');
  const s=state.streams.get(streamId);
  if(!s)fail('R39_UNKNOWN_STREAM');
  if(resetComplete!==true) return Object.freeze({rotated:false,reason:'INCOMPLETE_SESSION_RESET'});
  if(s.r36.sessionAuthorizations.has(newSessionId)||
     [...s.r36.sessionAuthorizations.values()].includes(newAuthorizationId))
    return Object.freeze({rotated:false,reason:'SESSION_OR_AUTH_REUSE'});
  s.r36.currentSession=newSessionId;
  s.r36.currentAuthorization=newAuthorizationId;
  s.r36.sessionAuthorizations.set(newSessionId,newAuthorizationId);
  s.r36.h={state:'BLOCKED',goodStreak:0,badStreak:0};
  s.r36.risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
  return Object.freeze({rotated:true});
}

export function runR39RestartScenario({before=[],after=[],opts={}}={}){
  if(!Array.isArray(before)||!Array.isArray(after)||before.length<10||after.length<5)
    fail('R39_INVALID_SCENARIO');
  const state=createR38State(opts);
  for(const e of before)ingestR38Event(state,e);
  const snap=snapshotR39(state);
  const restored=restoreR39(JSON.parse(JSON.stringify(snap)));
  const results=[];
  for(const e of after)results.push(ingestR38Event(restored,e));
  return Object.freeze({
    schema:'JENIOS_R39_RESTART_SCENARIO_V1',
    snapshotStreams:snap.streams.length,
    afterEvents:after.length,
    replayBlocksAfterRestart:results.filter(x=>x.reason==='EXPIRED_REPLAY_TOMBSTONE'||x.reason==='ACTIVE_DEDUP_HIT'||x.reason==='LATE_EPOCH_REJECTED').length,
    falseAllows:[...restored.streams.values()].reduce((a,s)=>a+s.falseAllows+s.r36.falseAllows,0),
    restored,
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
const event=(streamId,epoch,session='S1',auth='A1',net=.2,id=null)=>({
  streamId,eventId:id||`${streamId}-${session}-E${epoch}`,
  sessionId:`${streamId}-${session}`,
  authorizationId:`${streamId}-${auth}`,
  resetComplete:epoch===1,
  recoverySequence:ready(),
  regime:{regime:'R39_'+streamId,epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:net
});

export function runR39Battery(){
  const before=[];
  for(const streamId of ['A','B','C']){
    for(let e=1;e<=220;e++)before.push(event(streamId,e,'S1','A1',e<8?-1.2:.2));
  }
  const state=createR38State({dedupWindow:64,maxReorderGap:4,tombstoneWindow:512});
  for(const e of before)ingestR38Event(state,e);
  for(const streamId of ['A','B','C']){
    const r=rotateR39Session(state,{streamId,newSessionId:`${streamId}-S2`,newAuthorizationId:`${streamId}-A2`});
    if(!r.rotated)fail('R39_ROTATION_FAILED');
  }
  const snap=snapshotR39(state);
  const restored=restoreR39(JSON.parse(JSON.stringify(snap)));
  const checks=[];
  for(const streamId of ['A','B','C']){
    checks.push(ingestR38Event(restored,event(streamId,1,'S1','A1',.2,`${streamId}-S1-E1`)));
    checks.push(ingestR38Event(restored,event(streamId,221,'S2','A2',.2)));
  }
  const replayBlocks=checks.filter(x=>x.allow===false).length;
  const falseAllows=[...restored.streams.values()].reduce((a,s)=>a+s.falseAllows+s.r36.falseAllows,0);
  return Object.freeze({
    schema:'JENIOS_R39_BATTERY_V1',
    streams:3,
    snapshotStreams:snap.streams.length,
    replayBlocks,
    falseAllows,
    pass:snap.streams.length===3&&replayBlocks>=3&&falseAllows===0,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
