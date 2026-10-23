/**
 * R36 — idempotency, replay and session/auth concurrency stress.
 * Extends R35 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {hysteresisStep,sessionRiskStep} from './robot-r33-hysteresis-session-risk.mjs';
import {evaluateSessionEntry} from './robot-r34-holdout-session-reauth.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function createR36State(){
  return {
    processedEventIds:new Set(),
    sessionAuthorizations:new Map(),
    haltedSessions:new Set(),
    currentSession:null,
    currentAuthorization:null,
    h:{state:'BLOCKED',goodStreak:0,badStreak:0},
    risk:{equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0},
    trades:0,
    duplicatesIgnored:0,
    replayConflicts:0,
    concurrencyConflicts:0,
    incompleteResetBlocks:0,
    staleSessionBlocks:0,
    falseAllows:0
  };
}

function validateEvent(e){
  if(!e||typeof e.eventId!=='string'||!e.eventId||
     typeof e.sessionId!=='string'||!e.sessionId||
     typeof e.authorizationId!=='string'||!e.authorizationId||
     !Array.isArray(e.recoverySequence)||!e.regime||
     !Number.isSafeInteger(e.regime.epoch)||!finite(Number(e.tradeNetR)))
    fail('R36_INVALID_EVENT');
}

function fingerprint(e){
  return JSON.stringify({
    sessionId:e.sessionId,authorizationId:e.authorizationId,
    recoverySequence:e.recoverySequence,regime:e.regime,tradeNetR:Number(e.tradeNetR),
    resetComplete:e.resetComplete===true
  });
}

export function applyR36Event(state,event){
  validateEvent(event);
  if(!state||!(state.processedEventIds instanceof Set)||!(state.sessionAuthorizations instanceof Map))
    fail('R36_INVALID_STATE');

  const seen=state.processedEventIds;
  const fpKey='fp:'+event.eventId;
  if(seen.has(event.eventId)){
    const prior=state[fpKey];
    if(prior===fingerprint(event)){
      state.duplicatesIgnored++;
      return Object.freeze({allow:false,duplicate:true,reason:'IDEMPOTENT_REPLAY_IGNORED'});
    }
    state.replayConflicts++;
    return Object.freeze({allow:false,duplicate:false,reason:'EVENT_ID_REPLAY_CONFLICT'});
  }
  seen.add(event.eventId);
  state[fpKey]=fingerprint(event);

  const knownAuth=state.sessionAuthorizations.get(event.sessionId);
  if(knownAuth&&knownAuth!==event.authorizationId){
    state.concurrencyConflicts++;
    return Object.freeze({allow:false,reason:'SESSION_AUTHORIZATION_CONFLICT'});
  }

  const switching=state.currentSession!==null&&event.sessionId!==state.currentSession;
  if(state.currentSession===null||switching){
    if(event.resetComplete!==true){
      state.incompleteResetBlocks++;
      return Object.freeze({allow:false,reason:'INCOMPLETE_SESSION_RESET'});
    }
    if([...state.sessionAuthorizations.values()].includes(event.authorizationId)){
      state.concurrencyConflicts++;
      return Object.freeze({allow:false,reason:'AUTHORIZATION_REUSE_CONFLICT'});
    }
    state.currentSession=event.sessionId;
    state.currentAuthorization=event.authorizationId;
    state.sessionAuthorizations.set(event.sessionId,event.authorizationId);
    state.h={state:'BLOCKED',goodStreak:0,badStreak:0};
    state.risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
  } else {
    state.sessionAuthorizations.set(event.sessionId,event.authorizationId);
  }

  const hs=hysteresisStep({...state.h,regime:event.regime,confirmGood:2,confirmBad:1});
  state.h={state:hs.state,goodStreak:hs.goodStreak,badStreak:hs.badStreak};

  const stale=state.haltedSessions.has(event.sessionId);
  const gate=evaluateSessionEntry({
    sessionId:event.sessionId,
    authorizationId:event.authorizationId,
    haltedSessionId:stale?event.sessionId:null,
    recoverySequence:event.recoverySequence,
    regime:event.regime
  });
  const allow=gate.allowNewEntries&&hs.state==='ALLOWED';

  if(stale&&!allow)state.staleSessionBlocks++;
  if(allow&&(stale||gate.recoveryState!=='READY'||hs.state!=='ALLOWED'))state.falseAllows++;
  if(!allow)return Object.freeze({allow:false,reason:stale?'STALE_SESSION_BLOCKED':'INTERLOCK_BLOCKED'});

  state.risk=sessionRiskStep({
    ...state.risk,
    tradeNetR:Number(event.tradeNetR),
    maxDrawdownR:4,
    maxLossStreak:4
  });
  state.trades++;
  if(state.risk.halted)state.haltedSessions.add(event.sessionId);
  return Object.freeze({allow:true,halted:state.risk.halted});
}

export function runR36Timeline(events=[]){
  if(!Array.isArray(events)||events.length<20||events.length>20000)fail('R36_INVALID_TIMELINE');
  const state=createR36State();
  const trace=[];
  for(const e of events){
    const x=applyR36Event(state,e);
    if(trace.length<200)trace.push(Object.freeze({eventId:e.eventId,sessionId:e.sessionId,...x}));
  }
  return Object.freeze({
    schema:'JENIOS_R36_TIMELINE_V1',
    events:events.length,
    uniqueEvents:state.processedEventIds.size,
    sessions:state.sessionAuthorizations.size,
    trades:state.trades,
    duplicatesIgnored:state.duplicatesIgnored,
    replayConflicts:state.replayConflicts,
    concurrencyConflicts:state.concurrencyConflicts,
    incompleteResetBlocks:state.incompleteResetBlocks,
    staleSessionBlocks:state.staleSessionBlocks,
    falseAllows:state.falseAllows,
    invariantHolds:state.falseAllows===0,
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
const partial=()=>[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:false,unknownExposure:true}
];
const regime=(epoch,good=true)=>({
  regime:good?'R36_GOOD':'R36_BAD',
  epoch,totalCostBps:good?1.0:7,
  fillProbability:good?.95:.55,
  estimatedWinRate:good?.62:.50,
  grossWinBps:good?15:10,
  grossLossBps:good?9:10
});

export function buildR36Stress({sessions=10,eventsPerSession=400}={}){
  if(!Number.isSafeInteger(sessions)||sessions<4||sessions>30||
     !Number.isSafeInteger(eventsPerSession)||eventsPerSession<100||eventsPerSession>1000)
    fail('R36_INVALID_STRESS_CONFIG');
  const events=[];
  let epoch=1;
  for(let s=1;s<=sessions;s++){
    const sid='S'+s,aid='A'+s;
    for(let i=0;i<eventsPerSession;i++){
      const base={
        eventId:`S${s}-E${i}`,
        sessionId:sid,authorizationId:aid,
        resetComplete:i===0?true:undefined,
        recoverySequence:(i%47===0)?partial():ready(),
        regime:regime(epoch++,!(i%53>=45&&i%53<49)),
        tradeNetR:i<12?-1.4:.25
      };
      events.push(base);
      if(i%61===0)events.push({...base}); // exact duplicate: must be ignored
      if(i%137===0)events.push({...base,tradeNetR:.99}); // conflicting replay: same eventId
    }
    if(s<sessions){
      // Competing session change with incomplete reset must be blocked before the valid switch.
      events.push({
        eventId:`SWITCH-CONFLICT-${s}`,
        sessionId:'S'+(s+1),authorizationId:'A'+(s+1),
        resetComplete:false,recoverySequence:ready(),regime:regime(epoch++,true),tradeNetR:.2
      });
    }
  }
  return Object.freeze(events);
}

export function runR36Battery(){
  const events=buildR36Stress({sessions:10,eventsPerSession:400});
  const result=runR36Timeline(events);
  return Object.freeze({
    schema:'JENIOS_R36_BATTERY_V1',
    generatedEvents:events.length,
    nominalSessions:10,
    result,
    pass:result.invariantHolds===true&&
      result.duplicatesIgnored>0&&
      result.replayConflicts>0&&
      result.incompleteResetBlocks>0&&
      result.staleSessionBlocks>0,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
