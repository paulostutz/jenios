/** B254: executable subscription rehearsal around existing B86 transitions.
 * This is a deterministic offline assertion, not a Pix webhook or provider token.
 */
import {auditSyntheticSubscription} from '../subscription-lifecycle-audit.mjs';
import {PLATFORM_PLAN_PREVIEW} from '../subscription-readiness.mjs';
const planMap=new Map(PLATFORM_PLAN_PREVIEW.map(x=>[x.code,x.priceCents]));
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function replayControlledSubscriptionSandbox({events,nowMs,expectedOwnerId,expectedPlanCode}={}){
 if(typeof expectedOwnerId!=='string'||!planMap.has(expectedPlanCode)||
    !Number.isSafeInteger(nowMs)||nowMs<=0||!Array.isArray(events)||events.length<1)
    fail('SANDBOX_SUBSCRIPTION_SCOPE_REQUIRED');
 const replay=auditSyntheticSubscription(events,{now:nowMs});
 const sameOwner=events.every(e=>e?.subscriberId===expectedOwnerId&&
   e.planCode===expectedPlanCode&&e.priceCents===planMap.get(expectedPlanCode));
 if(!replay.valid||!sameOwner)return Object.freeze({schema:'JENIOS_B254_SYNTHETIC_SUBSCRIPTION_AUDIT',
   classification:'INVALID_OR_CROSS_OWNER_SANDBOX',reason:replay.reason||'CROSS_OWNER_OR_PRICE',
   hypotheticalStatus:'invalid',duplicatesSuppressed:0,ordersCreated:0,chargesCreated:0,
   entitlementsGranted:0,realProviderVerified:false,liveExecution:false});
 return Object.freeze({schema:'JENIOS_B254_SYNTHETIC_SUBSCRIPTION_AUDIT',
   classification:'OFFLINE_SCENARIO_REQUIRES_PROVIDER_ACCEPTANCE',
   hypotheticalStatus:replay.hypotheticalStatus,eventsApplied:replay.eventsApplied,
   duplicatesSuppressed:replay.duplicateIgnored,expectedPriceCents:planMap.get(expectedPlanCode),
   ownerAndPlanConsistent:true,externalProviderWebhookVerified:false,
   bankSettlementVerified:false,ordersCreated:0,chargesCreated:0,entitlementsGranted:0,
   cashMovementOccurred:false,realProviderVerified:false,liveExecution:false});
}
