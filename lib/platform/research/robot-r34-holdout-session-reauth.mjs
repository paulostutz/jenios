/**
 * R34 — independent hysteresis holdout + session reauthorization after risk halt.
 * Offline/synthetic only. No real or external Paper execution.
 */
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';
import {hysteresisStep,sessionRiskStep} from './robot-r33-hysteresis-session-risk.mjs';
import {evaluateRecoveryRegimeInterlock} from './robot-r31-recovery-regime-interlock.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

function holdoutRegime(epoch,{good=true,boundary=false}={}){
  return Object.freeze({
    epoch,
    totalCostBps:good?(boundary?1.7:1.05):(boundary?4.9:6.4),
    fillProbability:good?(boundary?.89:.94):(boundary?.68:.57),
    estimatedWinRate:good?(boundary?.595:.615):(boundary?.515:.505),
    grossWinBps:good?14.5:10.2,
    grossLossBps:good?9.2:10.1
  });
}

export function runR34IndependentHysteresisHoldout({
  events=3600,
  switchPeriods=[1,2,3,5,8,13,21],
  confirmGood=2,
  confirmBad=1
}={}){
  if(!Number.isSafeInteger(events)||events<500||events>20000||
     !Array.isArray(switchPeriods)||switchPeriods.length<3||
     switchPeriods.some(x=>!Number.isSafeInteger(x)||x<1)||
     !Number.isSafeInteger(confirmGood)||confirmGood<1||
     !Number.isSafeInteger(confirmBad)||confirmBad<1) fail('R34_INVALID_HOLDOUT');

  const cases=[];
  let totalEvents=0,totalRawTransitions=0,totalHysteresisTransitions=0;
  for(const period of switchPeriods){
    let h={state:'BLOCKED',goodStreak:0,badStreak:0};
    let rawState='BLOCKED',rawTransitions=0,hTransitions=0,allowed=0,blocked=0;
    for(let i=0;i<events;i++){
      // Holdout generator differs from R33: alternating blocks with deterministic
      // phase offsets and periodic boundary perturbations, never reusing R33's 24-step pattern.
      const block=Math.floor((i+period*7)/period);
      const good=(block%2===0);
      const boundary=((i*17+period*11)%37)<9;
      const regime=holdoutRegime(i+1,{good,boundary});
      const gate=adaptiveBreakevenGate(regime);
      const nextRaw=gate.allow?'ALLOWED':'BLOCKED';
      if(nextRaw!==rawState)rawTransitions++;
      rawState=nextRaw;
      const step=hysteresisStep({...h,regime,confirmGood,confirmBad});
      if(step.transition)hTransitions++;
      h={state:step.state,goodStreak:step.goodStreak,badStreak:step.badStreak};
      if(step.state==='ALLOWED')allowed++; else blocked++;
    }
    cases.push(Object.freeze({
      switchPeriod:period,events,rawTransitions,
      hysteresisTransitions:hTransitions,
      transitionReduction:rawTransitions-hTransitions,
      allowed,blocked,
      reducedChatter:hTransitions<=rawTransitions
    }));
    totalEvents+=events;
    totalRawTransitions+=rawTransitions;
    totalHysteresisTransitions+=hTransitions;
  }
  return Object.freeze({
    schema:'JENIOS_R34_HYSTERESIS_HOLDOUT_V1',
    policyFrozenFromR33:true,
    generatorIndependentFromR33:true,
    cases:Object.freeze(cases),
    totalEvents,totalRawTransitions,totalHysteresisTransitions,
    aggregateTransitionReduction:totalRawTransitions-totalHysteresisTransitions,
    allCasesNonIncreasingChatter:cases.every(x=>x.reducedChatter),
    ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null
  });
}

export function evaluateSessionEntry({
  sessionId,authorizationId,haltedSessionId=null,recoverySequence,regime
}={}){
  if(typeof sessionId!=='string'||!sessionId||
     typeof authorizationId!=='string'||!authorizationId||
     !Array.isArray(recoverySequence)||!regime) fail('R34_INVALID_SESSION_AUTH_INPUT');
  const interlock=evaluateRecoveryRegimeInterlock({recoverySequence,regime});
  const staleSession=haltedSessionId!==null && sessionId===haltedSessionId;
  const allow=interlock.allowNewEntries===true && !staleSession;
  const reasons=[...interlock.reasons];
  if(staleSession)reasons.push('NEW_SESSION_AUTHORIZATION_REQUIRED');
  return Object.freeze({
    schema:'JENIOS_R34_SESSION_AUTH_GATE_V1',
    sessionId,authorizationId,
    recoveryState:interlock.recoveryState,
    economicRegime:interlock.economicRegime,
    allowNewEntries:allow,
    staleSession,
    reasons:Object.freeze(reasons),
    actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
  });
}

export function simulateR34SessionLifecycle({
  regimes,tradeOutcomes,recoverySequences,
  initialSessionId='S1',initialAuthorizationId='A1',
  restartAtIndex=null,restartSessionId='S2',restartAuthorizationId='A2',
  maxDrawdownR=5,maxLossStreak=5
}={}){
  if(!Array.isArray(regimes)||!Array.isArray(tradeOutcomes)||!Array.isArray(recoverySequences)||
     regimes.length!==tradeOutcomes.length||regimes.length!==recoverySequences.length||regimes.length<3)
    fail('R34_INVALID_LIFECYCLE');
  if(restartAtIndex!==null&&(!Number.isSafeInteger(restartAtIndex)||restartAtIndex<0||restartAtIndex>=regimes.length))
    fail('R34_INVALID_RESTART_INDEX');
  if(!finite(maxDrawdownR)||maxDrawdownR<=0||!Number.isSafeInteger(maxLossStreak)||maxLossStreak<1)
    fail('R34_INVALID_RISK_LIMITS');

  let sessionId=initialSessionId,authorizationId=initialAuthorizationId,haltedSessionId=null;
  let risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
  let h={state:'BLOCKED',goodStreak:0,badStreak:0};
  let trades=0,blockedByRiskSession=0,blockedByRecoveryOrEconomics=0,reauthorized=false,haltedAtIndex=null;
  const trace=[];

  for(let i=0;i<regimes.length;i++){
    if(restartAtIndex===i){
      if(sessionId===restartSessionId||authorizationId===restartAuthorizationId)
        fail('R34_RESTART_MUST_ROTATE_IDENTIFIERS');
      sessionId=restartSessionId;
      authorizationId=restartAuthorizationId;
      risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
      h={state:'BLOCKED',goodStreak:0,badStreak:0};
      reauthorized=true;
    }

    const hs=hysteresisStep({...h,regime:regimes[i],confirmGood:2,confirmBad:1});
    h={state:hs.state,goodStreak:hs.goodStreak,badStreak:hs.badStreak};
    const gate=evaluateSessionEntry({
      sessionId,authorizationId,haltedSessionId,
      recoverySequence:recoverySequences[i],regime:regimes[i]
    });

    const economicAndRecoveryAllow=gate.allowNewEntries && hs.state==='ALLOWED';
    if(!economicAndRecoveryAllow){
      if(gate.staleSession) blockedByRiskSession++;
      else blockedByRecoveryOrEconomics++;
      if(trace.length<120)trace.push(Object.freeze({i,sessionId,allow:false,reasons:gate.reasons,hysteresis:hs.state}));
      continue;
    }

    const rr=Number(tradeOutcomes[i]);
    if(!finite(rr))fail('R34_INVALID_OUTCOME');
    risk=sessionRiskStep({...risk,tradeNetR:rr,maxDrawdownR,maxLossStreak});
    trades++;
    if(risk.halted){ haltedSessionId=sessionId; if(haltedAtIndex===null) haltedAtIndex=i; }
    if(trace.length<120)trace.push(Object.freeze({
      i,sessionId,allow:true,tradeNetR:rr,halted:risk.halted,
      drawdownR:risk.sessionDrawdownR
    }));
  }

  return Object.freeze({
    schema:'JENIOS_R34_SESSION_LIFECYCLE_V1',
    events:regimes.length,trades,blockedByRiskSession,blockedByRecoveryOrEconomics,
    haltedSessionId,finalSessionId:sessionId,reauthorized,
    newSessionRequiredAfterRiskHalt:haltedSessionId!==null,
    oldSessionCannotResume:haltedSessionId===null?true:trace
      .filter(x=>x.sessionId===haltedSessionId&&haltedAtIndex!==null&&x.i>haltedAtIndex)
      .every(x=>x.allow===false),
    trace:Object.freeze(trace),
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}

export function runR34Battery(){
  const holdout=runR34IndependentHysteresisHoldout();
  const ready=[
    {transportConnected:true},
    {marketDataFresh:true,sequenceContinuous:true},
    {openOrdersKnown:true,positionsKnown:true},
    {riskLedgerMatches:true,unknownExposure:false}
  ];
  const regimes=[];
  const outcomes=[];
  const recoverySequences=[];
  for(let i=0;i<80;i++){
    regimes.push(holdoutRegime(i+1,{good:true,boundary:i%11===0}));
    outcomes.push(i<12?(i%3===0?.4:-1.8):.3);
    recoverySequences.push(ready);
  }
  const lifecycle=simulateR34SessionLifecycle({
    regimes,tradeOutcomes:outcomes,recoverySequences,
    restartAtIndex:40,restartSessionId:'S2',restartAuthorizationId:'A2',
    maxDrawdownR:5,maxLossStreak:5
  });
  return Object.freeze({
    schema:'JENIOS_R34_BATTERY_V1',
    holdout,lifecycle,
    holdoutPass:holdout.allCasesNonIncreasingChatter&&holdout.aggregateTransitionReduction>=0,
    reauthPass:lifecycle.blockedByRiskSession>0&&lifecycle.reauthorized===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
