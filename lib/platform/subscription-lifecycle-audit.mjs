/** B86 — strictly synthetic subscription event-stream audit.
 * No payment provider, signed receipt, real entitlement or database writes.
 */
import {PLATFORM_PLAN_PREVIEW} from './subscription-readiness.mjs';
const prices=new Map(PLATFORM_PLAN_PREVIEW.map(x=>[x.code,x.priceCents]));
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const allowed={
 none:['requested'],
 requested:['activated','cancelled'],
 activated:['renewed','suspended','cancelled','expired'],
 renewed:['renewed','suspended','cancelled','expired'],
 suspended:['activated','cancelled','expired'],
 cancelled:[],expired:[]
};
export function auditSyntheticSubscription(events,{now=Date.now()}={}){
 const fail=(reason,index)=>({valid:false,reason,index,hypotheticalStatus:'invalid',
  subscriberVerified:false,providerVerified:false,chargesCreated:0,entitlementGranted:false});
 if(!Array.isArray(events)||!events.length||events.length>100)return fail('INVALID_EVENT_COUNT',null);
 let status='none',lastTime=0,link=null,duplicateIgnored=0;
 const seen=new Map(),timeline=[];
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(!e||typeof e!=='object'||Array.isArray(e)||!uuid(e.id)||
   !uuid(e.subscriberId)||!uuid(e.contractId)||!prices.has(e.planCode)||
   e.scope!=='platform'||e.priceCents!==prices.get(e.planCode)||
   e.currency!=='BRL'||e.billingType!=='monthly'||e.source!=='synthetic_qa'||
   e.providerReceipt||e.livePayment||!allowed[status])
    return fail('INVALID_EVENT_SCOPE_OR_PRICE',i);
  const timestamp=typeof e.time==='string'?Date.parse(e.time):NaN;
  if(!Number.isFinite(timestamp)||timestamp<1||timestamp>now)return fail('INVALID_EVENT_TIME',i);
  const tuple=[e.subscriberId,e.contractId,e.planCode].join(':');
  if(link&&tuple!==link)return fail('CROSS_SUBSCRIBER_OR_PLAN',i);
  const fingerprint=JSON.stringify([e.id,e.eventType,e.time,e.scope,e.priceCents,tuple]);
  if(seen.has(e.id)){
   if(seen.get(e.id)!==fingerprint)return fail('CONFLICTING_IDEMPOTENCY_KEY',i);
   duplicateIgnored++;continue;
  }
  if(timestamp<lastTime)return fail('OUT_OF_ORDER_EVENT',i);
  if(!allowed[status].includes(e.eventType))return fail('INVALID_LIFECYCLE_TRANSITION',i);
  seen.set(e.id,fingerprint);lastTime=timestamp;link=tuple;status=e.eventType;
  timeline.push({type:status,time:e.time});
 }
 return {valid:true,mode:'synthetic_only',hypotheticalStatus:status,
  eventsApplied:timeline.length,duplicateIgnored,timeline,
  providerVerified:false,subscriberVerified:false,
  signedLinkVerified:false,chargesCreated:0,entitlementGranted:false,
  realPaymentAuthorized:false,realExecutionAllowed:false};
}
