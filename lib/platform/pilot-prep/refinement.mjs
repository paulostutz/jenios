/** B151 — conservative wrapper; it never invents a signal or removes a core refusal. */
import {insist,record,time,uint} from './contracts.mjs';
export function refineDecision(original,context){
 record(original,['side','action','mayClose','confirmationRequired']);
 insist([null,'buy','sell'].includes(original.side)&&typeof original.action==='string','INVALID_CORE_DECISION');
 record(context,['paused','positionOpen','cooldownUntilMs','nowMs','quoteHealthy','feesVerified','diagnosticCompleted','lossEscalation','contextHash']);
 for(const k of ['paused','positionOpen','quoteHealthy','feesVerified','diagnosticCompleted','lossEscalation'])insist(typeof context[k]==='boolean','MISSING_GUARD_STATE');
 time(context.nowMs);time(context.cooldownUntilMs);insist(/^[a-f0-9]{64}$/.test(context.contextHash),'CONTEXT_HASH_REQUIRED');
 const reasons=[];
 if(context.paused)reasons.push('USER_PAUSED');
 if(context.positionOpen)reasons.push('MANAGE_EXISTING_POSITION');
 if(!context.diagnosticCompleted)reasons.push('DIAGNOSTIC_REQUIRED');
 if(!context.quoteHealthy)reasons.push('MARKET_DATA_UNHEALTHY');
 if(!context.feesVerified)reasons.push('COSTS_UNVERIFIED');
 if(context.nowMs<context.cooldownUntilMs)reasons.push('COOLDOWN');
 if(context.lossEscalation)reasons.push('NO_RISK_ESCALATION_AFTER_LOSS');
 return Object.freeze({side:original.side===null||reasons.length?null:original.side,action:reasons.length?'wait_for_safety':original.action,originalAction:original.action,originalSide:original.side,reasons,mayClose:true,confirmationRequired:original.confirmationRequired===true,contextHash:context.contextHash,liveExecution:false});
}
export function tighteningStop(side,current,candidate){
 insist(['buy','sell'].includes(side)&&[current,candidate].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0),'INVALID_STOP');
 return side==='buy'?Math.max(current,candidate):Math.min(current,candidate);
}
