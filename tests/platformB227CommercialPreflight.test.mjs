import test from 'node:test';import assert from 'node:assert/strict';
import {assessPlatformCommercialContract} from '../lib/platform/launch/b227-commercial-preflight.mjs';
test('B227 existing three plans and seven-day trial are still separate from real checkout',()=>{
 const r=assessPlatformCommercialContract();assert.deepEqual(r.plans.map(p=>p.advertisedPriceCents),[9990,14990,19990]);
 assert.equal(r.trialLengthDays,7);assert.equal(r.purchasesCreated,0);assert.equal(r.paymentProviderIndependentlyTested,false);
});
test('B227 a fake configured catalog cannot make this audit charge customers',()=>{
 const products=[['platform-nacional',9990],['platform-global-crypto',14990],['platform-internacional-pro',19990]]
 .map(([code,price_cents])=>({code,price_cents,category:'platform',currency:'BRL',billing_type:'monthly',
  configured:true,active:true,id:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7'}));
 const r=assessPlatformCommercialContract({catalog:{products,paymentsEnabled:true,checkoutReady:true,
  checkoutScope:'platform',catalogStatus:'provider',subscriptionLifecycleReady:true}});
 assert.ok(r.plans.every(p=>p.checkoutClaimedEnabled));assert.equal(r.purchasesCreated,0);
 assert.ok(r.plans.every(p=>p.independentlyVerifiedByThisReview===false));
});
