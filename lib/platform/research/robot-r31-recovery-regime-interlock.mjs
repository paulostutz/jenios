/**
 * R31 — Recovery + regime interlock.
 * New entries require BOTH recovery READY and a fresh favorable economic regime.
 */
import {recoverToReady} from './robot-r26-recovery-state.mjs';
import {evaluateRegimeSnapshot} from './robot-r30-regime-adaptive-gate.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function evaluateRecoveryRegimeInterlock({recoverySequence,regime}={}){
 if(!Array.isArray(recoverySequence)||!regime)fail('R31_INVALID_INTERLOCK_INPUT');
 const recovery=recoverToReady(recoverySequence);
 const economic=evaluateRegimeSnapshot(regime);
 const allow=recovery.finalState==='READY' && recovery.newEntriesAllowed===true && economic.allow===true;
 const reasons=[];
 if(recovery.finalState!=='READY')reasons.push('RECOVERY_NOT_READY');
 if(economic.allow!==true)reasons.push('ECONOMIC_REGIME_NOT_ELIGIBLE');
 return Object.freeze({
   schema:'JENIOS_R31_RECOVERY_REGIME_INTERLOCK_V1',
   recoveryState:recovery.finalState,
   economicRegime:economic.regime,
   economicEpoch:economic.authorizationEpoch,
   allowNewEntries:allow,
   reasons:Object.freeze(reasons),
   staleRecoveryAuthorization:false,
   staleEconomicAuthorization:false,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function simulateInterlockedTimeline(events=[]){
 if(!Array.isArray(events)||events.length<1||events.length>100)fail('R31_INVALID_TIMELINE');
 let lastEpoch=-1,allowedTransitions=0,blockedTransitions=0;
 const trace=[];
 for(const e of events){
   if(!e||!Number.isSafeInteger(e.regime?.epoch)||e.regime.epoch<=lastEpoch)fail('R31_NON_MONOTONIC_EPOCH');
   const x=evaluateRecoveryRegimeInterlock({recoverySequence:e.recoverySequence,regime:e.regime});
   if(x.allowNewEntries)allowedTransitions++;else blockedTransitions++;
   trace.push(Object.freeze({
     label:e.label||'event',
     recoveryState:x.recoveryState,
     regime:x.economicRegime,
     epoch:x.economicEpoch,
     allow:x.allowNewEntries,
     reasons:x.reasons
   }));
   lastEpoch=e.regime.epoch;
 }
 return Object.freeze({
   schema:'JENIOS_R31_INTERLOCK_TIMELINE_V1',
   events:events.length,allowedTransitions,blockedTransitions,
   trace:Object.freeze(trace),
   noAuthorizationCarryover:true,
   ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null
 });
}

export function runR31Battery(){
 const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
 ];
 const notReadyUnknown=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:true}
 ];
 const timeline=simulateInterlockedTimeline([
  {label:'ready-good',recoverySequence:ready,regime:{regime:'GOOD',epoch:1,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}},
  {label:'outage-unknown',recoverySequence:notReadyUnknown,regime:{regime:'GOOD_STILL',epoch:2,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}},
  {label:'recovered-bad-economics',recoverySequence:ready,regime:{regime:'COST_SPIKE',epoch:3,totalCostBps:7,fillProbability:.9,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9}},
  {label:'recovered-new-good',recoverySequence:ready,regime:{regime:'NEW_GOOD',epoch:4,totalCostBps:1,fillProbability:.94,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9}}
 ]);
 return Object.freeze({
   schema:'JENIOS_R31_BATTERY_V1',
   timeline,
   expectedPattern:Object.freeze([true,false,false,true]),
   patternMatches:timeline.trace.map(x=>x.allow).join(',')==='true,false,false,true',
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
