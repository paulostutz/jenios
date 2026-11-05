/** R112 / Block 3 — deterministic decision provenance and fail-closed watchdog.
 * Never sends broker commands. Audit payloads must exclude secrets and PII.
 */
import {createHash} from 'node:crypto';
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const f=x=>typeof x==='number'&&Number.isFinite(x);
const hash=s=>createHash('sha256').update(s).digest('hex');
export function buildUltraDecisionChain({sourceDigest,events,rootDigest='0'.repeat(64)}={}){
 if(!/^[a-f0-9]{64}$/.test(sourceDigest||'')||!Array.isArray(events)||events.length<1||
    events.length>2000||!/^[a-f0-9]{64}$/.test(rootDigest))fail('R112_AUDIT_INVALID_INPUT');
 let chain=rootDigest,last=-1;const seen=new Set(),lines=[];
 for(const e of events){
   if(!e||!Number.isSafeInteger(e.timestampMs)||e.timestampMs<last||
      typeof e.id!=='string'||!/^[a-z0-9_-]{3,60}$/i.test(e.id)||seen.has(e.id)||
      !['WAIT','RESEARCH_CANDIDATE','BLOCK','RISK_REVIEW','SIMULATED_RESULT'].includes(e.type)||
      !Array.isArray(e.reasons)||e.reasons.length>30||e.reasons.some(x=>typeof x!=='string'||!/^[A-Z0-9_]{1,80}$/.test(x))||
      typeof e.strategyVersion!=='string'||e.strategyVersion.length>80)
      fail('R112_AUDIT_INVALID_EVENT');
   const canonical=JSON.stringify({id:e.id,timestampMs:e.timestampMs,type:e.type,
     reasons:e.reasons,strategyVersion:e.strategyVersion,sourceDigest});
   chain=hash(chain+'\n'+canonical);last=e.timestampMs;seen.add(e.id);
   lines.push(Object.freeze({id:e.id,type:e.type,timestampMs:e.timestampMs,chainDigest:chain,
    provenance:'HASH_ONLY_NO_PERSONAL_DATA',
    reasonCount:e.reasons.length}));
 }
 return Object.freeze({schema:'JENIOS_R112_DECISION_CHAIN_V1',sourceDigest,
  previousRootDigest:rootDigest,rootDigest:chain,eventCount:events.length,
  events:Object.freeze(lines),immutableCopyMustBePersistedByHost:true,
  signedByExchange:false,ordersSent:0});
}

export function inspectUltraWatchdog({nowMs,lastMarketDataAtMs,lastBrokerStateAtMs,
  maxMarketAgeMs=1000,maxBrokerAgeMs=5000,clockSkewMs=0,maxClockSkewMs=250,
  disconnectCount,brokerErrors,unknownOrderCount,unreconciledFillCount,
  exchangeMaintenance,ownerStopped}={}){
 const fields=[nowMs,lastMarketDataAtMs,lastBrokerStateAtMs,maxMarketAgeMs,maxBrokerAgeMs,
  maxClockSkewMs,disconnectCount,brokerErrors,unknownOrderCount,unreconciledFillCount];
 if(fields.some(x=>!Number.isSafeInteger(x)||x<0)||!Number.isSafeInteger(clockSkewMs)||
  typeof exchangeMaintenance!=='boolean'||typeof ownerStopped!=='boolean'||
  lastMarketDataAtMs>nowMs||lastBrokerStateAtMs>nowMs||maxMarketAgeMs<1||maxBrokerAgeMs<1)
   fail('R112_WATCHDOG_INVALID_INPUT');
 const reasons=[];
 if(nowMs-lastMarketDataAtMs>maxMarketAgeMs)reasons.push('MARKET_DATA_STALE');
 if(nowMs-lastBrokerStateAtMs>maxBrokerAgeMs)reasons.push('BROKER_STATE_STALE');
 if(Math.abs(clockSkewMs)>maxClockSkewMs)reasons.push('CLOCK_SKEW_EXCEEDED');
 if(disconnectCount>=3)reasons.push('REPEATED_DISCONNECTS');
 if(brokerErrors>=3)reasons.push('BROKER_ERRORS');
 if(unknownOrderCount>0)reasons.push('ORDER_STATUS_UNKNOWN');
 if(unreconciledFillCount>0)reasons.push('FILL_RECONCILIATION_REQUIRED');
 if(exchangeMaintenance)reasons.push('EXCHANGE_MAINTENANCE');
 if(ownerStopped)reasons.push('OWNER_STOPPED');
 return Object.freeze({schema:'JENIOS_R112_WATCHDOG_V1',healthy:reasons.length===0,
  reasons:Object.freeze(reasons),requireHumanReset:reasons.length>0,
  allowNewEntries:false, // This module cannot grant permission to place orders.
  brokerOrdersInspectedExternally:false,ordersSent:0});
}

/** Tripped watchdog can resume research ONLY after operator confirms order status.
 * Uncertain orders are never automatically retried/canceled.
 */
export function transitionUltraResearchRecovery({state,event,watchdogHealthy,
  orderReconciliationVerified,ownerApproved}={}){
 if(!['RESEARCH_HEALTHY','HALTED','CHECKING'].includes(state)||
   !['TRIP','BEGIN_REVIEW','SOURCE_RECOVERED','HUMAN_RESET'].includes(event)||
   typeof watchdogHealthy!=='boolean'||typeof orderReconciliationVerified!=='boolean'||
   typeof ownerApproved!=='boolean')fail('R112_RECOVERY_INVALID_INPUT');
 let next=state;const reasons=[];
 if(event==='TRIP'||!watchdogHealthy)next='HALTED';
 else if(state==='HALTED'&&event==='BEGIN_REVIEW')next='CHECKING';
 else if(state==='CHECKING'&&event==='HUMAN_RESET'){
   if(!orderReconciliationVerified)reasons.push('ORDER_RECONCILIATION_REQUIRED');
   if(!ownerApproved)reasons.push('OWNER_REVIEW_REQUIRED');
   next=reasons.length?'CHECKING':'RESEARCH_HEALTHY';
 } else if(state==='HALTED'&&event==='SOURCE_RECOVERED')next='HALTED';
 return Object.freeze({schema:'JENIOS_R112_RECOVERY_V1',state:next,
  nextResearchEvaluationAllowed:next==='RESEARCH_HEALTHY',
  reasons:Object.freeze(reasons),liveOrderEnabled:false,
  autoCancel:false,autoOrderRetry:false,ordersSent:0});
}