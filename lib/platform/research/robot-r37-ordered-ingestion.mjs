/**
 * R37 — ordered ingestion, late-epoch rejection and bounded dedup window.
 * Extends R36 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {createR36State,applyR36Event} from './robot-r36-idempotency-concurrency.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR37State({dedupWindow=512,maxReorderGap=4}={}){
  if(!Number.isSafeInteger(dedupWindow)||dedupWindow<32||dedupWindow>5000||
     !Number.isSafeInteger(maxReorderGap)||maxReorderGap<0||maxReorderGap>64)
    fail('R37_INVALID_CONFIG');
  return {
    r36:createR36State(),
    dedupWindow,
    maxReorderGap,
    seenOrder:[],
    seenSet:new Set(),
    lastCommittedEpoch:0,
    reorderBuffer:new Map(),
    lateEpochBlocks:0,
    excessiveGapBlocks:0,
    duplicateWindowHits:0,
    drainedBuffered:0,
    falseAllows:0
  };
}

function validateEvent(e){
  if(!e||typeof e.eventId!=='string'||!e.eventId||!e.regime||
     !Number.isSafeInteger(e.regime.epoch)||e.regime.epoch<1) fail('R37_INVALID_EVENT');
}

function remember(state,eventId){
  if(state.seenSet.has(eventId)){state.duplicateWindowHits++;return false;}
  state.seenSet.add(eventId);state.seenOrder.push(eventId);
  while(state.seenOrder.length>state.dedupWindow){
    const oldest=state.seenOrder.shift();
    state.seenSet.delete(oldest);
  }
  return true;
}

function commit(state,e){
  const x=applyR36Event(state.r36,e);
  state.lastCommittedEpoch=e.regime.epoch;
  if(x.allow===true && (x.reason==='IDEMPOTENT_REPLAY_IGNORED'||x.reason==='EVENT_ID_REPLAY_CONFLICT')) state.falseAllows++;
  return x;
}

function drain(state){
  const drained=[];
  while(state.reorderBuffer.has(state.lastCommittedEpoch+1)){
    const epoch=state.lastCommittedEpoch+1;
    const e=state.reorderBuffer.get(epoch);
    state.reorderBuffer.delete(epoch);
    const x=commit(state,e);
    state.drainedBuffered++;
    drained.push({epoch,eventId:e.eventId,result:x});
  }
  return drained;
}

export function ingestR37Event(state,event){
  validateEvent(event);
  if(!state||!state.r36||!(state.reorderBuffer instanceof Map)||!(state.seenSet instanceof Set))
    fail('R37_INVALID_STATE');

  if(state.seenSet.has(event.eventId)){
    state.duplicateWindowHits++;
    return Object.freeze({accepted:false,allow:false,reason:'DEDUP_WINDOW_HIT'});
  }

  const epoch=event.regime.epoch;
  if(epoch<=state.lastCommittedEpoch){
    state.lateEpochBlocks++;
    remember(state,event.eventId);
    return Object.freeze({accepted:false,allow:false,reason:'LATE_EPOCH_REJECTED',epoch});
  }

  const expected=state.lastCommittedEpoch+1;
  if(epoch>expected){
    const gap=epoch-expected;
    if(gap>state.maxReorderGap){
      state.excessiveGapBlocks++;
      remember(state,event.eventId);
      return Object.freeze({accepted:false,allow:false,reason:'REORDER_GAP_EXCEEDED',epoch,gap});
    }
    if(state.reorderBuffer.has(epoch)){
      const prior=state.reorderBuffer.get(epoch);
      if(prior.eventId===event.eventId){
        state.duplicateWindowHits++;
        return Object.freeze({accepted:false,allow:false,reason:'BUFFER_DUPLICATE'});
      }
      state.falseAllows++;
      return Object.freeze({accepted:false,allow:false,reason:'EPOCH_COLLISION'});
    }
    remember(state,event.eventId);
    state.reorderBuffer.set(epoch,event);
    return Object.freeze({accepted:true,allow:false,reason:'BUFFERED_OUT_OF_ORDER',epoch});
  }

  remember(state,event.eventId);
  const result=commit(state,event);
  const drained=drain(state);
  return Object.freeze({
    accepted:true,
    allow:result.allow===true,
    reason:result.reason||null,
    epoch,
    drained:Object.freeze(drained)
  });
}

export function runR37Timeline(events,{dedupWindow=512,maxReorderGap=4}={}){
  if(!Array.isArray(events)||events.length<20||events.length>30000) fail('R37_INVALID_TIMELINE');
  const state=createR37State({dedupWindow,maxReorderGap});
  const trace=[];
  for(const e of events){
    const x=ingestR37Event(state,e);
    if(trace.length<240)trace.push(Object.freeze({eventId:e.eventId,epoch:e.regime.epoch,...x}));
  }
  return Object.freeze({
    schema:'JENIOS_R37_TIMELINE_V1',
    events:events.length,
    lastCommittedEpoch:state.lastCommittedEpoch,
    bufferSize:state.reorderBuffer.size,
    dedupRetained:state.seenOrder.length,
    lateEpochBlocks:state.lateEpochBlocks,
    excessiveGapBlocks:state.excessiveGapBlocks,
    duplicateWindowHits:state.duplicateWindowHits,
    drainedBuffered:state.drainedBuffered,
    falseAllows:state.falseAllows+state.r36.falseAllows,
    r36DuplicatesIgnored:state.r36.duplicatesIgnored,
    r36ReplayConflicts:state.r36.replayConflicts,
    r36ConcurrencyConflicts:state.r36.concurrencyConflicts,
    invariantHolds:(state.falseAllows+state.r36.falseAllows)===0,
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
const regime=epoch=>({
  regime:'R37_GOOD',epoch,totalCostBps:1,fillProbability:.95,
  estimatedWinRate:.62,grossWinBps:15,grossLossBps:9
});

function baseEvent(epoch,sessionId='S1',authorizationId='A1'){
  return {
    eventId:`${sessionId}-E${epoch}`,
    sessionId,authorizationId,
    resetComplete:epoch===1,
    recoverySequence:ready(),
    regime:regime(epoch),
    tradeNetR:epoch<10?-1.2:.2
  };
}

export function buildR37Stress({events=5000}={}){
  if(!Number.isSafeInteger(events)||events<500||events>20000) fail('R37_INVALID_STRESS_CONFIG');
  const out=[];
  for(let epoch=1;epoch<=events;epoch++){
    const e=baseEvent(epoch);
    if(epoch%29===0 && epoch+1<=events){
      out.push(baseEvent(epoch+1)); // one-step early
      out.push(e);
      epoch++;
      continue;
    }
    out.push(e);
    if(epoch%67===0) out.push({...e}); // duplicate inside window
    if(epoch%211===0 && epoch>5){
      const late=baseEvent(epoch-3);
      out.push({...late,eventId:`late-${epoch}`}); // fresh id, stale epoch
    }
    if(epoch%503===0 && epoch+20<=events){
      out.push({...baseEvent(epoch+20),eventId:`gap-${epoch}`}); // gap beyond allowed window
    }
  }
  return Object.freeze(out);
}

export function runR37Battery(){
  const events=buildR37Stress({events:5000});
  const result=runR37Timeline(events,{dedupWindow:256,maxReorderGap:4});
  return Object.freeze({
    schema:'JENIOS_R37_BATTERY_V1',
    generatedEvents:events.length,
    result,
    pass:result.invariantHolds===true&&
      result.duplicateWindowHits>0&&
      result.lateEpochBlocks>0&&
      result.excessiveGapBlocks>0&&
      result.drainedBuffered>0&&
      result.dedupRetained<=256,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
