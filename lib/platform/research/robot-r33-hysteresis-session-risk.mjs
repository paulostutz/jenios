/**
 * R33 — hysteresis + cumulative session drawdown.
 * Offline/synthetic only. No real or external Paper execution.
 */
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function hysteresisStep({state='BLOCKED',goodStreak=0,badStreak=0,regime,confirmGood=2,confirmBad=1}={}){
 if(!['BLOCKED','ALLOWED'].includes(state)||
    !Number.isSafeInteger(goodStreak)||goodStreak<0||
    !Number.isSafeInteger(badStreak)||badStreak<0||
    !Number.isSafeInteger(confirmGood)||confirmGood<1||
    !Number.isSafeInteger(confirmBad)||confirmBad<1||
    !regime) fail('R33_INVALID_HYSTERESIS_INPUT');

 const gate=adaptiveBreakevenGate(regime);
 let nextState=state,nextGood=goodStreak,nextBad=badStreak,transition=false;

 if(gate.allow){
   nextGood=goodStreak+1; nextBad=0;
   if(state==='BLOCKED'&&nextGood>=confirmGood){
     nextState='ALLOWED'; transition=true; nextGood=0;
   }
 }else{
   nextBad=badStreak+1; nextGood=0;
   if(state==='ALLOWED'&&nextBad>=confirmBad){
     nextState='BLOCKED'; transition=true; nextBad=0;
   }
 }

 return Object.freeze({
   schema:'JENIOS_R33_HYSTERESIS_STEP_V1',
   state:nextState,goodStreak:nextGood,badStreak:nextBad,transition,
   economicEligible:gate.allow,
   expectedNetBps:gate.expectedNetBps,
   safetyMarginBps:gate.safetyMarginBps,
   ordersSent:0
 });
}

export function runHysteresisTimeline(regimes=[],opts={}){
 if(!Array.isArray(regimes)||regimes.length<2||regimes.length>10000)fail('R33_INVALID_TIMELINE');
 let h={state:'BLOCKED',goodStreak:0,badStreak:0};
 let rawState='BLOCKED',rawTransitions=0,hysteresisTransitions=0,allowed=0,blocked=0;
 const trace=[];
 for(const r of regimes){
   const gate=adaptiveBreakevenGate(r);
   const nextRaw=gate.allow?'ALLOWED':'BLOCKED';
   if(nextRaw!==rawState)rawTransitions++;
   rawState=nextRaw;

   const step=hysteresisStep({...h,regime:r,confirmGood:opts.confirmGood??2,confirmBad:opts.confirmBad??1});
   if(step.transition)hysteresisTransitions++;
   h={state:step.state,goodStreak:step.goodStreak,badStreak:step.badStreak};
   if(step.state==='ALLOWED')allowed++; else blocked++;
   if(trace.length<100) trace.push(Object.freeze({epoch:r.epoch,state:step.state,economicEligible:gate.allow}));
 }
 return Object.freeze({
   schema:'JENIOS_R33_HYSTERESIS_TIMELINE_V1',
   events:regimes.length,rawTransitions,hysteresisTransitions,
   transitionReduction:rawTransitions-hysteresisTransitions,
   allowed,blocked,finalState:h.state,
   trace:Object.freeze(trace),ordersSent:0
 });
}

export function sessionRiskStep({equityR=0,peakR=0,sessionDrawdownR=0,tradeNetR,maxDrawdownR,lossStreak=0,maxLossStreak}={}){
 for(const x of [equityR,peakR,sessionDrawdownR,tradeNetR,maxDrawdownR])
   if(!finite(x))fail('R33_INVALID_SESSION_RISK');
 if(maxDrawdownR<=0||!Number.isSafeInteger(lossStreak)||lossStreak<0||
   !Number.isSafeInteger(maxLossStreak)||maxLossStreak<1)fail('R33_INVALID_SESSION_RISK');

 const nextEquity=equityR+tradeNetR;
 const nextPeak=Math.max(peakR,nextEquity);
 const nextDrawdown=Math.max(sessionDrawdownR,nextPeak-nextEquity);
 const nextLossStreak=tradeNetR<0?lossStreak+1:0;
 const haltReasons=[];
 if(nextDrawdown>=maxDrawdownR)haltReasons.push('SESSION_DRAWDOWN_LIMIT');
 if(nextLossStreak>=maxLossStreak)haltReasons.push('LOSS_STREAK_LIMIT');
 return Object.freeze({
   equityR:Number(nextEquity.toFixed(6)),
   peakR:Number(nextPeak.toFixed(6)),
   sessionDrawdownR:Number(nextDrawdown.toFixed(6)),
   lossStreak:nextLossStreak,
   halted:haltReasons.length>0,
   haltReasons:Object.freeze(haltReasons),
   ordersSent:0
 });
}

export function simulateR33Session({regimes,tradeOutcomes,maxDrawdownR=12,maxLossStreak=8,confirmGood=2,confirmBad=1}={}){
 if(!Array.isArray(regimes)||!Array.isArray(tradeOutcomes)||regimes.length!==tradeOutcomes.length||regimes.length<2)
   fail('R33_INVALID_SESSION');

 let h={state:'BLOCKED',goodStreak:0,badStreak:0};
 let risk={equityR:0,peakR:0,sessionDrawdownR:0,lossStreak:0};
 let trades=0,blockedByEconomics=0,blockedByRisk=0,halted=false;
 for(let i=0;i<regimes.length;i++){
   const step=hysteresisStep({...h,regime:regimes[i],confirmGood,confirmBad});
   h={state:step.state,goodStreak:step.goodStreak,badStreak:step.badStreak};

   if(halted){blockedByRisk++;continue;}
   if(step.state!=='ALLOWED'){blockedByEconomics++;continue;}

   const rr=Number(tradeOutcomes[i]);
   if(!finite(rr))fail('R33_INVALID_OUTCOME');
   risk=sessionRiskStep({...risk,tradeNetR:rr,maxDrawdownR,maxLossStreak});
   trades++;
   if(risk.halted)halted=true;
 }
 return Object.freeze({
   schema:'JENIOS_R33_SESSION_V1',
   events:regimes.length,trades,blockedByEconomics,blockedByRisk,
   finalHysteresisState:h.state,
   halted,
   sessionSyntheticR:risk.equityR,
   maxSyntheticDrawdownR:risk.sessionDrawdownR,
   finalLossStreak:risk.lossStreak,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR33Battery(){
 const regimes=[];
 const outcomes=[];
 for(let i=0;i<2400;i++){
   // First 400 events deliberately oscillate around the eligibility boundary
   // so raw gating chatters while hysteresis requires confirmation.
   const noisyBoundary=i<400;
   const phase=i%24;
   const good=noisyBoundary?(i%2===0):(phase<8 || (phase>=12&&phase<19));
   const nearBoundary=noisyBoundary||phase===7||phase===8||phase===18||phase===19;
   regimes.push({
     epoch:i+1,
     totalCostBps:good?(nearBoundary?1.8:1):(nearBoundary?4.8:6),
     fillProbability:good?.90:.60,
     estimatedWinRate:good?.60:.51,
     grossWinBps:good?14:10,
     grossLossBps:good?9:10
   });
   outcomes.push(i%13===0?-1.8:i%5===0?-.7:.35);
 }
 const h=runHysteresisTimeline(regimes,{confirmGood:2,confirmBad:1});
 const s=simulateR33Session({regimes,tradeOutcomes:outcomes,maxDrawdownR:12,maxLossStreak:8,confirmGood:2,confirmBad:1});
 return Object.freeze({
   schema:'JENIOS_R33_BATTERY_V1',
   events:regimes.length,
   rawTransitions:h.rawTransitions,
   hysteresisTransitions:h.hysteresisTransitions,
   transitionReduction:h.transitionReduction,
   session:s,
   noExecution:true,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
