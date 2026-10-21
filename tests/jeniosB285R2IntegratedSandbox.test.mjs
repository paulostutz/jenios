import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateB285R2Subscription,B285R2_SANDBOX_POLICY} from '../lib/platform/b285r2-subscription-sandbox.mjs';
import {classifyVerifiedPlan,proPlanAccess} from '../lib/assistant/pro-access.mjs';
import {replySales} from '../lib/assistant/sales-provider.mjs';
import {projectPlatformCatalog} from '../lib/platform/checkout-readiness.mjs';
import {readFileSync} from 'node:fs';
const NOW=Date.parse('2026-10-21T18:00:00Z'),DAY=86400000;
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const uid=uuid(1),sid=uuid(2),at=ms=>new Date(ms).toISOString();
const e=(n,type,planCode='platform-global-crypto',extra={})=>({
 eventId:uuid(n+100),userId:uid,subscriptionId:sid,planCode,
 scope:'platform',source:'synthetic_qa_only',type,at:at(NOW-500000+n*1000),...extra
});
const period={periodStart:at(NOW-DAY),periodEnd:at(NOW+30*DAY)};
const request=(plan='platform-global-crypto')=>e(1,'requested',plan);
const confirm=(plan='platform-global-crypto')=>e(2,'confirmed',plan,period);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('B285-R2 no real writes, bank, AI or orders in sandbox',()=>{
 assert.equal(B285R2_SANDBOX_POLICY.realEntitlementWritesAllowed,false);
 assert.equal(B285R2_SANDBOX_POLICY.realPaymentCallsAllowed,false);
 const result=simulateB285R2Subscription([request(),confirm()],{nowMs:NOW});
 assert.equal(result.hypotheticalAdvanced,true);
 assert.equal(result.hypotheticalUniversityIncluded,true);
 assert.equal(result.realSubscriptionCreated,false);
 assert.equal(result.realEntitlementGranted,false);
 assert.equal(result.realPaymentConfirmed,false);
 assert.equal(result.chargesCreated,0);
 assert.equal(result.ordersSent,0);
});
test('B285-R2 free, Nacional, Crypto and Internacional tiers',()=>{
 for(const [plan,advanced] of [
  ['platform-nacional',false],['platform-global-crypto',true],
  ['platform-internacional-pro',true]
 ]){
  const result=simulateB285R2Subscription([request(plan),confirm(plan)],{nowMs:NOW});
  assert.equal(result.hypotheticalActive,true);
  assert.equal(result.hypotheticalAdvanced,advanced);
  assert.equal(result.hypotheticalUniversityIncluded,advanced);
 }
 assert.equal(proPlanAccess(null,null,{}).proIncluded,false);
});
test('B285-R2 renewals, duplicate events and out-of-order protection',()=>{
 const renewal=e(3,'renewed','platform-global-crypto',{
  periodStart:at(NOW-DAY),periodEnd:at(NOW+59*DAY)
 });
 const stream=[request(),confirm(),renewal,renewal];
 const result=simulateB285R2Subscription(stream,{nowMs:NOW+10000});
 assert.equal(result.duplicatesIgnored,1);
 assert.equal(result.uniqueEvents,3);
 assert.equal(result.hypotheticalAdvanced,true);
 assert.throws(()=>simulateB285R2Subscription([request(),renewal],{nowMs:NOW+10000}),/B285R2_INVALID_TRANSITION/);
 assert.throws(()=>simulateB285R2Subscription([request(),confirm(),{...renewal,planCode:'platform-nacional'}],{nowMs:NOW+10000}),/B285R2_CROSS_USER_OR_PLAN/);
 assert.throws(()=>simulateB285R2Subscription([request(),confirm(),{...renewal,eventId:confirm().eventId}],{nowMs:NOW+10000}),/B285R2_CONFLICTING_IDEMPOTENCY/);
});
test('B285-R2 cancellations, refunds, suspension and expiration remove hypothetical Pro',()=>{
 for(const kind of ['cancelled','refunded','suspended','expired']){
  const result=simulateB285R2Subscription([request(),confirm(),e(3,kind)],{nowMs:NOW+10000});
  assert.equal(result.hypotheticalAdvanced,false);
  assert.equal(result.hypotheticalActive,false);
 }
 const resumed=simulateB285R2Subscription([request(),confirm(),e(3,'suspended'),e(4,'resumed','platform-global-crypto',period)],{nowMs:NOW+10000});
 assert.equal(resumed.hypotheticalAdvanced,true);
 const naturallyExpired=simulateB285R2Subscription([request(),confirm()],{nowMs:NOW+31*DAY});
 assert.equal(naturallyExpired.hypotheticalActive,false);
 assert.equal(naturallyExpired.hypotheticalAdvanced,false);
});
test('B285-R2 forged metadata, foreign user, live provider and unsigned receipts rejected',()=>{
 for(const changed of [
  {source:'inter_pix'}, {livePayment:true},{providerReceipt:{status:'paid'}},
  {actualCharge:true},{providerVerified:true},{userMetadataRole:'master'},
  {scope:'social'},{userId:uuid(3)},{at:at(NOW+DAY)}
 ]){
  const stream=[request(),{...confirm(),...changed}];
  assert.throws(()=>simulateB285R2Subscription(stream,{nowMs:NOW+10000}),/B285R2_/);
 }
});
test('B285-R2 no plan activation from catalog display or checkout disabled state',()=>{
 const catalog={products:[{id:uuid(10),code:'platform-global-crypto',category:'platform',
  billing_type:'monthly',currency:'BRL',price_cents:14990,active:true,configured:true}],
  checkoutScope:'platform',paymentsEnabled:false,checkoutReady:false,
  subscriptionLifecycleReady:false};
 const items=projectPlatformCatalog(catalog);
 assert.equal(items[0].canCheckout,false);
 assert.equal(items[0].price_cents,14990);
});
test('B285-R2 verified subscription plan classification denies expired and trial metadata impersonation',()=>{
 const products=[{id:'paid',code:'platform-global-crypto',category:'platform'}];
 const rows=[{id:'sub',product_id:'paid',status:'active',current_period_start:at(NOW-DAY),current_period_end:at(NOW+DAY)}];
 assert.equal(classifyVerifiedPlan(rows,products,NOW).code,'platform-global-crypto');
 assert.equal(classifyVerifiedPlan([{...rows[0],status:'canceled'}],products,NOW),null);
 assert.equal(classifyVerifiedPlan([{...rows[0],current_period_end:at(NOW)}],products,NOW),null);
 assert.equal(proPlanAccess(null,{id:'person',user_metadata:{role:'master'},app_metadata:{}},{}).master,false);
});
test('B285-R2 sales AI unavailable falls back without model calls and without changing entitlements',async()=>{
 let calls=0;
 const reply=await replySales('Quero conhecer R$ 199,90','genia',{
  env:{JENIOS_SALES_GENERATIVE_ENABLED:'false'},fetcher:async()=>{calls++;throw Error('unreachable');}
 });
 assert.equal(calls,0);assert.equal(reply.mode,'guided');
 assert.equal(reply.paidAi,false);assert.equal(reply.subscriptionGranted,false);
 assert.equal(reply.executionEnabled,false);
 assert.equal(reply.links[0].href,'/checkout');
});
test('B285-R2 University, Social, landing and Platform existing access surfaces preserved',()=>{
 assert.match(read('app/lp/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/social/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/platform/assistente/page.js'),/FreeAssistantRoom/);
 assert.ok(read('app/planos/page.js').includes("redirect('/checkout')"));
 assert.match(read('app/api/platform/learning/route.js'),/handleLearning/);
 assert.match(read('app/api/assistant/pro/chat/route.js'),/planOnly:true/);
});
test('B285-R2 production billing remains blocked until external verification',()=>{
 const checkout=read('lib/pay/checkout.mjs');
 assert.ok(checkout.includes("paymentConfig.provider==='inter_pix'&&scope!=='social'"));
 assert.match(read('lib/platform/checkout-readiness.mjs'),/subscriptionLifecycleReady===true/);
 assert.match(read('lib/assistant/pro-service.mjs'),/ADVANCED_PLAN_REQUIRED/);
});
