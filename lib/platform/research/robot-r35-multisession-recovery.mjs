/**
 * R35 — long multi-session recovery/reauthorization stress.
 * Extends R34 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {hysteresisStep,sessionRiskStep} from './robot-r33-hysteresis-session-risk.mjs';
import {evaluateSessionEntry} from './robot-r34-holdout-session-reauth.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

const ready=()=>[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const partial=kind=>{
  if(kind==='transport')return [{transportConnected:false}];
  if(kind==='market')return [{transportConnected:true},{marketDataFresh:true,sequenceContinuous:false}];
  if(kind==='account')return [{transportConnected:true},{marketDataFresh:true,sequenceContinuous:true},{openOrdersKnown:true,positionsKnown:false}];
  return [{transportConnected:true},{marketDataFresh:true,sequenceContinuous:true},{openOrdersKnown:true,positionsKnown:true},{riskLedgerMatches:false,unknownExposure:true}];
};
const regime=(epoch,good=true)=>({
  regime:good?'R35_GOOD':'R35_BAD',
  epoch,
  totalCostBps:good?1.1:6.8,
  fillProbability:good?.94:.58,
  estimatedWinRate:good?.62:.50,
  grossWinBps:good?15:10,
  grossLossBps:good?9:10
});

export function simulateR35MultiSession({
  events,
  maxDrawdownR=4,
  maxLossStreak=4,
  confirmGood=2,
  confirmBad=1
}={}){
  if(!Array.isArray(events)||events.length<20||events.length>20000)fail('R35_INVALID_EVENTS');
  if(!finite(maxDrawdownR)||maxDrawdownR<=0||!Number.isSafeInteger(maxLossStreak)||maxLossStreak<1)
    fail('R35_INVALID_RISK');

  let currentSession=null,currentAuthorization=null;
  let h={state:'BLOCKED',goodStreak:0,badStreak:0};
  let risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
  const haltedSessions=new Set(),usedSessions=new Set(),usedAuthorizations=new Set();
  let halts=0,reauthorizations=0,trades=0,falseAllows=0,blockedPartialRecovery=0,blockedStaleSession=0;
  let previousEpoch=-1;
  const trace=[];

  for(let i=0;i<events.length;i++){
    const e=events[i];
    if(!e||typeof e.sessionId!=='string'||!e.sessionId||typeof e.authorizationId!=='string'||!e.authorizationId||
       !Array.isArray(e.recoverySequence)||!e.regime||!Number.isSafeInteger(e.regime.epoch)||e.regime.epoch<=previousEpoch)
      fail('R35_INVALID_EVENT');

    const switching=currentSession!==null&&e.sessionId!==currentSession;
    if(currentSession===null||switching){
      if(usedSessions.has(e.sessionId)||usedAuthorizations.has(e.authorizationId))
        fail('R35_REUSED_SESSION_OR_AUTHORIZATION');
      currentSession=e.sessionId;
      currentAuthorization=e.authorizationId;
      usedSessions.add(currentSession);usedAuthorizations.add(currentAuthorization);
      h={state:'BLOCKED',goodStreak:0,badStreak:0};
      risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
      if(usedSessions.size>1)reauthorizations++;
    }else if(e.authorizationId!==currentAuthorization){
      fail('R35_AUTHORIZATION_CHANGED_WITHIN_SESSION');
    }

    const hs=hysteresisStep({...h,regime:e.regime,confirmGood,confirmBad});
    h={state:hs.state,goodStreak:hs.goodStreak,badStreak:hs.badStreak};
    const stale=haltedSessions.has(currentSession);
    const gate=evaluateSessionEntry({
      sessionId:currentSession,authorizationId:currentAuthorization,
      haltedSessionId:stale?currentSession:null,
      recoverySequence:e.recoverySequence,regime:e.regime
    });
    const allow=gate.allowNewEntries&&hs.state==='ALLOWED';
    const shouldAllow=!stale&&gate.recoveryState==='READY'&&hs.state==='ALLOWED';

    if(allow&&!shouldAllow)falseAllows++;
    if(!allow){
      if(stale)blockedStaleSession++;
      if(gate.recoveryState!=='READY')blockedPartialRecovery++;
      if(trace.length<160)trace.push(Object.freeze({i,sessionId:currentSession,allow:false,stale,recoveryState:gate.recoveryState}));
      previousEpoch=e.regime.epoch;
      continue;
    }

    const rr=Number(e.tradeNetR);
    if(!finite(rr))fail('R35_INVALID_OUTCOME');
    risk=sessionRiskStep({...risk,tradeNetR:rr,maxDrawdownR,maxLossStreak});
    trades++;
    if(risk.halted&&!haltedSessions.has(currentSession)){
      haltedSessions.add(currentSession);halts++;
    }
    if(trace.length<160)trace.push(Object.freeze({i,sessionId:currentSession,allow:true,halted:risk.halted,drawdownR:risk.sessionDrawdownR}));
    previousEpoch=e.regime.epoch;
  }

  return Object.freeze({
    schema:'JENIOS_R35_MULTISESSION_V1',
    events:events.length,
    sessions:usedSessions.size,
    authorizations:usedAuthorizations.size,
    halts,reauthorizations,trades,
    falseAllows,blockedPartialRecovery,blockedStaleSession,
    noStaleAuthorizationLeak:falseAllows===0,
    noHaltedSessionResume:[...haltedSessions].every(s=>trace.filter(x=>x.sessionId===s&&x.stale===true).every(x=>x.allow===false)),
    trace:Object.freeze(trace),
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}

export function buildR35LongHoldout({sessions=12,eventsPerSession=500}={}){
  if(!Number.isSafeInteger(sessions)||sessions<4||sessions>30||
     !Number.isSafeInteger(eventsPerSession)||eventsPerSession<100||eventsPerSession>1000)
    fail('R35_INVALID_HOLDOUT_CONFIG');
  const events=[];
  let epoch=1;
  for(let s=1;s<=sessions;s++){
    const sid='S'+s,aid='A'+s;
    for(let i=0;i<eventsPerSession;i++){
      const phase=i%50;
      const recoverySequence=
        phase<4?partial(['transport','market','account','risk'][phase]):
        phase>=25&&phase<29?partial(['risk','account','market','transport'][phase-25]):
        ready();
      const good=!(phase>=20&&phase<25);
      const forceLoss=i<18 || (i>=70&&i<78);
      events.push({
        sessionId:sid,authorizationId:aid,
        recoverySequence,
        regime:regime(epoch++,good),
        tradeNetR:forceLoss?-1.35:.28
      });
    }
  }
  return Object.freeze(events);
}

export function runR35Battery(){
  const events=buildR35LongHoldout({sessions:12,eventsPerSession:500});
  const result=simulateR35MultiSession({events,maxDrawdownR:4,maxLossStreak:4});
  return Object.freeze({
    schema:'JENIOS_R35_BATTERY_V1',
    totalEvents:events.length,
    expectedSessions:12,
    result,
    pass:result.falseAllows===0&&
      result.noStaleAuthorizationLeak===true&&
      result.noHaltedSessionResume===true&&
      result.blockedPartialRecovery>0&&
      result.blockedStaleSession>0&&
      result.halts>=4&&result.reauthorizations===11,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
