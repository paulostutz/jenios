/** B285-R2 sandbox-only deterministic subscription simulator.
 * No persistence, no database, no provider receipt, no actual entitlement grant.
 * Synthetic fixture events never become production authorizations.
 */
import {createHash} from 'node:crypto';
import {classifyVerifiedPlan,proPlanAccess} from '../assistant/pro-access.mjs';
import {SALES_PLANS} from '../assistant/sales-policy.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const codes=SALES_PLANS.map(x=>x.code);
const events=Object.freeze(['requested','confirmed','renewed','cancelled','expired','refunded','suspended','resumed']);
const allowed=Object.freeze({none:['requested'],pending:['confirmed','cancelled'],active:['renewed','cancelled','expired','refunded','suspended'],suspended:['resumed','cancelled','expired','refunded'],cancelled:['expired'],expired:[],refunded:[]});
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export const B285R2_SANDBOX_POLICY=Object.freeze({schema:'JENIOS_B285R2_SANDBOX_LIFECYCLE_V1',
 provider:'synthetic_qa_only',realEntitlementWritesAllowed:false,realPaymentCallsAllowed:false,
 maxEvents:200,scopes:['platform'],plans:codes,
 testClockRequired:true,simulationOnly:true});
export function simulateB285R2Subscription(stream,{nowMs}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<1||!Array.isArray(stream)||stream.length<1||stream.length>200)
  fail('B285R2_INVALID_FIXTURE');
 let state='none',userId=null,subscriptionId=null,planCode=null,periodStart=null,periodEnd=null,seen=new Map(),last=0;
 const history=[];
 for(const [index,e] of stream.entries()){
  if(!e||typeof e!=='object'||Array.isArray(e)||!uuid(e.eventId)||!uuid(e.userId)||!uuid(e.subscriptionId)||
   !codes.includes(e.planCode)||e.scope!=='platform'||e.source!=='synthetic_qa_only'||
   !events.includes(e.type)||!validTime(e.at)||e.providerReceipt||e.livePayment||e.actualCharge||
   e.isAnonymous===true||e.userMetadataRole||e.providerVerified===true)
   fail('B285R2_UNTRUSTED_EVENT_'+index);
  const at=Date.parse(e.at);
  if(at>nowMs||at<last)fail('B285R2_EVENT_TIME_ORDER');
  const fingerprint=sha(e);
  if(seen.has(e.eventId)){
   if(seen.get(e.eventId)!==fingerprint)fail('B285R2_CONFLICTING_IDEMPOTENCY');
   continue;
  }
  if(userId&&(userId!==e.userId||subscriptionId!==e.subscriptionId||planCode!==e.planCode))
   fail('B285R2_CROSS_USER_OR_PLAN');
  if(!allowed[state]?.includes(e.type))fail('B285R2_INVALID_TRANSITION_'+state+'_'+e.type);
  if(e.type==='requested'){state='pending';userId=e.userId;subscriptionId=e.subscriptionId;planCode=e.planCode;}
  if(['confirmed','renewed','resumed'].includes(e.type)){
   if(!validTime(e.periodStart)||!validTime(e.periodEnd))fail('B285R2_INVALID_PERIOD');
   const start=Date.parse(e.periodStart),end=Date.parse(e.periodEnd);
   if(start>at||end<=at||end<=start||periodEnd&&e.type==='renewed'&&end<=periodEnd)
    fail('B285R2_INVALID_PERIOD');
   if(e.type==='renewed'&&start>periodEnd)fail('B285R2_RENEWAL_GAP');
   state='active';periodStart=start;periodEnd=end;
  }
  if(e.type==='cancelled')state='cancelled';
  if(e.type==='expired')state='expired';
  if(e.type==='refunded')state='refunded';
  if(e.type==='suspended')state='suspended';
  seen.set(e.eventId,fingerprint);last=at;
  history.push(Object.freeze({type:e.type,at:e.at,state}));
 }
 const currentlyActive=state==='active'&&periodStart<=nowMs&&periodEnd>nowMs;
 const product=SALES_PLANS.find(p=>p.code===planCode);
 const syntheticProducts=product?[{id:'qa-'+product.code,code:product.code,category:'platform'}]:[];
 const syntheticSubscriptions=currentlyActive?[{id:subscriptionId,product_id:syntheticProducts[0].id,
  status:'active',current_period_start:new Date(periodStart).toISOString(),current_period_end:new Date(periodEnd).toISOString()}]:[];
 const derived=classifyVerifiedPlan(syntheticSubscriptions,syntheticProducts,nowMs);
 const rights=proPlanAccess(derived,null,{});
 return Object.freeze({
  schema:'JENIOS_B285R2_SANDBOX_RESULT_V1',hypotheticalState:state,
  userId,subscriptionId,planCode,uniqueEvents:history.length,
  duplicatesIgnored:stream.length-history.length,history:Object.freeze(history),
  hypotheticalPeriodStart:periodStart===null?null:new Date(periodStart).toISOString(),
  hypotheticalPeriodEnd:periodEnd===null?null:new Date(periodEnd).toISOString(),
  hypotheticalActive:currentlyActive,
  hypotheticalAdvanced:currentlyActive&&rights.proIncluded,
  hypotheticalUniversityIncluded:currentlyActive&&rights.universityIncluded,
  hypotheticalPlanCode:derived?.code??null,
  realSubscriptionCreated:false,realEntitlementGranted:false,realPaymentConfirmed:false,
  bankCalls:0,aiProviderCalls:0,ordersSent:0,chargesCreated:0,
  eligibleForProduction:false
 });
}
