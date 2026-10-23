/**
 * R38 — multi-stream ordered ingestion + expired replay tombstones.
 * Extends R37 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {createR36State,applyR36Event} from './robot-r36-idempotency-concurrency.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

function createStreamState({dedupWindow,maxReorderGap,tombstoneWindow}){
  return {
    r36:createR36State(),
    dedupWindow,maxReorderGap,tombstoneWindow,
    seenOrder:[],seenSet:new Set(),
    tombstoneOrder:[],tombstoneSet:new Set(),
    reorderBuffer:new Map(),
    lastCommittedEpoch:0,
    duplicateHits:0,
    expiredReplayBlocks:0,
    lateEpochBlocks:0,
    excessiveGapBlocks:0,
    drainedBuffered:0,
    falseAllows:0
  };
}

export function createR38State({dedupWindow=128,maxReorderGap=4,tombstoneWindow=4096}={}){
  if(!Number.isSafeInteger(dedupWindow)||dedupWindow<16||dedupWindow>5000||
     !Number.isSafeInteger(maxReorderGap)||maxReorderGap<0||maxReorderGap>64||
     !Number.isSafeInteger(tombstoneWindow)||tombstoneWindow<dedupWindow||tombstoneWindow>50000)
    fail('R38_INVALID_CONFIG');
  return {
    dedupWindow,maxReorderGap,tombstoneWindow,
    streams:new Map(),
    totalFalseAllows:0,
    crossStreamCollisions:0
  };
}

function streamFor(state,streamId){
  let s=state.streams.get(streamId);
  if(!s){
    s=createStreamState(state);
    state.streams.set(streamId,s);
  }
  return s;
}

function validateEvent(e){
  if(!e||typeof e.streamId!=='string'||!e.streamId||
     typeof e.eventId!=='string'||!e.eventId||
     typeof e.sessionId!=='string'||!e.sessionId||
     typeof e.authorizationId!=='string'||!e.authorizationId||
     !e.regime||!Number.isSafeInteger(e.regime.epoch)||e.regime.epoch<1)
    fail('R38_INVALID_EVENT');
}

function rememberActive(s,eventId){
  if(s.seenSet.has(eventId))return;
  s.seenSet.add(eventId);s.seenOrder.push(eventId);
  while(s.seenOrder.length>s.dedupWindow){
    const expired=s.seenOrder.shift();
    s.seenSet.delete(expired);
    if(!s.tombstoneSet.has(expired)){
      s.tombstoneSet.add(expired);s.tombstoneOrder.push(expired);
    }
  }
  while(s.tombstoneOrder.length>s.tombstoneWindow){
    const old=s.tombstoneOrder.shift();
    s.tombstoneSet.delete(old);
  }
}

function commit(s,e){
  const x=applyR36Event(s.r36,e);
  s.lastCommittedEpoch=e.regime.epoch;
  if(x.allow===true&&(x.reason==='EVENT_ID_REPLAY_CONFLICT'||x.reason==='IDEMPOTENT_REPLAY_IGNORED'))s.falseAllows++;
  return x;
}

function drain(s){
  const drained=[];
  while(s.reorderBuffer.has(s.lastCommittedEpoch+1)){
    const epoch=s.lastCommittedEpoch+1;
    const e=s.reorderBuffer.get(epoch);
    s.reorderBuffer.delete(epoch);
    const x=commit(s,e);
    s.drainedBuffered++;
    drained.push(Object.freeze({epoch,eventId:e.eventId,allow:x.allow===true}));
  }
  return Object.freeze(drained);
}

export function ingestR38Event(state,event){
  validateEvent(event);
  if(!state||!(state.streams instanceof Map))fail('R38_INVALID_STATE');

  const s=streamFor(state,event.streamId);
  if(s.seenSet.has(event.eventId)){
    s.duplicateHits++;
    return Object.freeze({accepted:false,allow:false,reason:'ACTIVE_DEDUP_HIT'});
  }
  if(s.tombstoneSet.has(event.eventId)){
    s.expiredReplayBlocks++;
    return Object.freeze({accepted:false,allow:false,reason:'EXPIRED_REPLAY_TOMBSTONE'});
  }

  const epoch=event.regime.epoch;
  if(epoch<=s.lastCommittedEpoch){
    s.lateEpochBlocks++;
    rememberActive(s,event.eventId);
    return Object.freeze({accepted:false,allow:false,reason:'LATE_EPOCH_REJECTED'});
  }

  const expected=s.lastCommittedEpoch+1;
  if(epoch>expected){
    const gap=epoch-expected;
    if(gap>s.maxReorderGap){
      s.excessiveGapBlocks++;
      rememberActive(s,event.eventId);
      return Object.freeze({accepted:false,allow:false,reason:'REORDER_GAP_EXCEEDED'});
    }
    if(s.reorderBuffer.has(epoch)){
      const prior=s.reorderBuffer.get(epoch);
      if(prior.eventId!==event.eventId)state.crossStreamCollisions++;
      return Object.freeze({accepted:false,allow:false,reason:'EPOCH_COLLISION'});
    }
    rememberActive(s,event.eventId);
    s.reorderBuffer.set(epoch,event);
    return Object.freeze({accepted:true,allow:false,reason:'BUFFERED_OUT_OF_ORDER'});
  }

  rememberActive(s,event.eventId);
  const x=commit(s,event);
  const drained=drain(s);
  if(s.falseAllows>0)state.totalFalseAllows+=s.falseAllows;
  return Object.freeze({accepted:true,allow:x.allow===true,reason:x.reason||null,drained});
}

export function runR38Timeline(events,opts={}){
  if(!Array.isArray(events)||events.length<50||events.length>50000)fail('R38_INVALID_TIMELINE');
  const state=createR38State(opts);
  const trace=[];
  for(const e of events){
    const x=ingestR38Event(state,e);
    if(trace.length<250)trace.push(Object.freeze({streamId:e.streamId,eventId:e.eventId,epoch:e.regime.epoch,...x}));
  }
  const streams=[...state.streams.entries()].map(([streamId,s])=>Object.freeze({
    streamId,
    lastCommittedEpoch:s.lastCommittedEpoch,
    bufferSize:s.reorderBuffer.size,
    activeDedupSize:s.seenOrder.length,
    tombstoneSize:s.tombstoneOrder.length,
    duplicateHits:s.duplicateHits,
    expiredReplayBlocks:s.expiredReplayBlocks,
    lateEpochBlocks:s.lateEpochBlocks,
    excessiveGapBlocks:s.excessiveGapBlocks,
    drainedBuffered:s.drainedBuffered,
    falseAllows:s.falseAllows
  }));
  return Object.freeze({
    schema:'JENIOS_R38_TIMELINE_V1',
    events:events.length,
    streams:Object.freeze(streams),
    streamCount:streams.length,
    totalDuplicateHits:streams.reduce((a,x)=>a+x.duplicateHits,0),
    totalExpiredReplayBlocks:streams.reduce((a,x)=>a+x.expiredReplayBlocks,0),
    totalLateEpochBlocks:streams.reduce((a,x)=>a+x.lateEpochBlocks,0),
    totalExcessiveGapBlocks:streams.reduce((a,x)=>a+x.excessiveGapBlocks,0),
    totalDrainedBuffered:streams.reduce((a,x)=>a+x.drainedBuffered,0),
    falseAllows:streams.reduce((a,x)=>a+x.falseAllows,0),
    boundedActiveDedup:streams.every(x=>x.activeDedupSize<=state.dedupWindow),
    boundedTombstones:streams.every(x=>x.tombstoneSize<=state.tombstoneWindow),
    invariantHolds:streams.every(x=>x.falseAllows===0),
    trace:Object.freeze(trace),
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
const regime=(epoch,streamId)=>({
  regime:'R38_'+streamId,epoch,totalCostBps:1,fillProbability:.95,
  estimatedWinRate:.62,grossWinBps:15,grossLossBps:9
});
const make=(streamId,epoch)=>({
  streamId,
  eventId:`${streamId}-E${epoch}`,
  sessionId:`${streamId}-S1`,
  authorizationId:`${streamId}-A1`,
  resetComplete:epoch===1,
  recoverySequence:ready(),
  regime:regime(epoch,streamId),
  tradeNetR:epoch<9?-1.15:.2
});

export function buildR38Stress({streams=4,epochsPerStream=1800}={}){
  if(!Number.isSafeInteger(streams)||streams<2||streams>12||
     !Number.isSafeInteger(epochsPerStream)||epochsPerStream<300||epochsPerStream>5000)
    fail('R38_INVALID_STRESS_CONFIG');

  const perStream=[];
  for(let s=1;s<=streams;s++){
    const sid='STR'+s;
    const arr=[];
    for(let e=1;e<=epochsPerStream;e++){
      const base=make(sid,e);
      if(e%31===0&&e+1<=epochsPerStream){
        arr.push(make(sid,e+1));arr.push(base);e++;continue;
      }
      arr.push(base);
      if(e%83===0)arr.push({...base});
      if(e%257===0&&e>10)arr.push({...make(sid,e-5),eventId:`${sid}-LATE-${e}`});
      if(e%601===0&&e+20<=epochsPerStream)arr.push({...make(sid,e+20),eventId:`${sid}-GAP-${e}`});
    }
    // force expiration then replay an event that left active dedup but remains tombstoned
    arr.push({...make(sid,1),eventId:`${sid}-E1`});
    perStream.push(arr);
  }

  const out=[];
  let remaining=true,idx=0;
  while(remaining){
    remaining=false;
    for(const arr of perStream){
      if(idx<arr.length){out.push(arr[idx]);remaining=true;}
    }
    idx++;
  }
  return Object.freeze(out);
}

export function runR38Battery(){
  const events=buildR38Stress({streams:4,epochsPerStream:1800});
  const result=runR38Timeline(events,{dedupWindow:128,maxReorderGap:4,tombstoneWindow:4096});
  return Object.freeze({
    schema:'JENIOS_R38_BATTERY_V1',
    generatedEvents:events.length,
    result,
    pass:result.streamCount===4&&
      result.invariantHolds===true&&
      result.totalDuplicateHits>0&&
      result.totalExpiredReplayBlocks>=4&&
      result.totalLateEpochBlocks>0&&
      result.totalExcessiveGapBlocks>0&&
      result.totalDrainedBuffered>0&&
      result.boundedActiveDedup===true&&
      result.boundedTombstones===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
