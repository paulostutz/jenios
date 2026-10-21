import test from 'node:test';import assert from 'node:assert/strict';
import {auditExactPlatformPlanCatalog} from '../lib/platform/release250/b235-commercial-catalog.mjs';
import {reviewSandboxSubscription} from '../lib/platform/release250/b236-sandbox-lifecycle.mjs';
import {exerciseSandboxTrial} from '../lib/platform/release250/b237-trial-sandbox.mjs';
import {inspectPlatformPayerLink} from '../lib/platform/release250/b238-payer-binding.mjs';
import {PLATFORM_PLAN_PREVIEW} from '../lib/platform/subscription-readiness.mjs';
const now=1792540000000;
const product=(p)=>({code:p.code,price_cents:p.priceCents,category:'platform',currency:'BRL',billing_type:'monthly'});
const catalog={checkoutScope:'platform',products:PLATFORM_PLAN_PREVIEW.map(product)};
test('B235 all three exact plan prices retained; no payment authorized',()=>{
 const r=auditExactPlatformPlanCatalog(catalog);assert.equal(r.priceAndScopeConsistent,true);
 assert.deepEqual(r.expectedPlans.map(p=>p.priceCents),[9990,14990,19990]);
 assert.equal(r.chargesCreated,0);assert.equal(r.providerChargeAuthorized,false);
});
test('B235 price drift, duplicate and missing product fail closed',()=>{
 assert.equal(auditExactPlatformPlanCatalog({...catalog,products:[...catalog.products.slice(0,2),{...catalog.products[2],price_cents:1}]}).priceAndScopeConsistent,false);
 assert.equal(auditExactPlatformPlanCatalog({...catalog,products:[...catalog.products.slice(0,2),catalog.products[0]]}).priceAndScopeConsistent,false);
 assert.equal(auditExactPlatformPlanCatalog({...catalog,products:catalog.products.slice(0,2)}).priceAndScopeConsistent,false);
 assert.equal(auditExactPlatformPlanCatalog({...catalog,products:catalog.products.map((x,i)=>i===0?{...x,currency:'USD'}:x)}).priceAndScopeConsistent,false);
});
const customer='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',contract='50b85e9d-339c-4d32-b2bf-82c467673832';
const template={subscriberId:customer,contractId:contract,planCode:'platform-nacional',
 scope:'platform',priceCents:9990,currency:'BRL',billingType:'monthly',source:'synthetic_qa'};
const ev=(n,eventType,t)=>({...template,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,eventType,
 time:new Date(t).toISOString()});
test('B236 request activate renew cancel is synthetic and does not create entitlements',()=>{
 const events=[ev(1,'requested',now-60000),ev(2,'activated',now-50000),ev(3,'renewed',now-40000),ev(4,'cancelled',now-30000)];
 const result=reviewSandboxSubscription([...events,events[2]],{nowMs:now});
 // The original B86 validator refuses out-of-order duplicates when placed after newer timestamp.
 assert.equal(result.syntheticallyValid,true);assert.equal(result.finalStatus,'cancelled');assert.equal(result.duplicateEvents,1);
 assert.equal(result.chargesCreated,0);assert.equal(result.realEntitlementCreated,false);
});
test('B236 cancel then activate and forged provider payment event are rejected',()=>{
 const events=[ev(1,'requested',now-3000),ev(2,'cancelled',now-2000),ev(3,'activated',now-1000)];
 assert.equal(reviewSandboxSubscription(events,{nowMs:now}).syntheticallyValid,false);
 assert.equal(reviewSandboxSubscription([{...ev(1,'requested',now-2000),providerReceipt:'paid'}],{nowMs:now}).syntheticallyValid,false);
});
test('B238 unsigned payer link cannot verify subscriber or charge',()=>{
 const r=inspectPlatformPayerLink({platformOwnerId:customer,payerOwnerId:contract,
 link:{id:customer,platformOwnerId:customer,payerOwnerId:contract,serverSigned:false}});
 assert.equal(r.claimedReadyForControlledQA,false);assert.equal(r.chargesCreated,0);
});
test('B238 even perfect claimed flags are not an external payment certificate',()=>{
 const r=inspectPlatformPayerLink({platformOwnerId:customer,payerOwnerId:contract,
 link:{id:customer,platformOwnerId:customer,payerOwnerId:contract,serverSigned:true},
 lifecycle:{activationVerified:true,renewalVerified:true,cancellationVerified:true,
 idempotencyVerified:true,providerReconciliationVerified:true},
 catalog:{source:'provider_confirmed',scope:'platform',pricesVerified:true}});
 assert.equal(r.claimedReadyForControlledQA,true);assert.equal(r.payerProviderIndependentlyAuthenticated,false);
 assert.equal(r.chargesCreated,0);assert.equal(r.roleEntitlementsGranted,false);
});
test('B237 simulated identity verifier refuses untrusted token and remains a no-charge flow',async()=>{
 const map=new Set(),secret='strong_fake_QA_only_HMAC_secret_20261021';
 const doc='52998224725';const grantDb={rpc:async(_name,args)=>{
  if(map.has(args.p_subject_digest))return {data:{outcome:'already_claimed'}};
  map.add(args.p_subject_digest);return {data:{outcome:'granted',started_at:new Date(now-1000).toISOString(),expires_at:new Date(now-1000+7*86400000).toISOString()}};
 }};
 const verification={verified:true,document:doc,documentType:'CPF',verifiedAt:new Date(now-500).toISOString(),expiresAt:new Date(now+200000).toISOString()};
 const verifier=async({userId,verificationToken})=>{
  if(verificationToken!=='sandbox-verified')throw Error('UNVERIFIED');
  return {...verification,userId};
 };
 const v=(id)=>exerciseSandboxTrial({user:{id,is_anonymous:false},verificationToken:'sandbox-verified',verifyIdentity:verifier,db:grantDb,secret,nowMs:now});
 const a=await v(customer),b=await v(contract);
 assert.equal(a.state,'granted');assert.equal(b.state,'already_claimed');
 for(const exposed of [doc,customer,contract])assert.equal(JSON.stringify(a).includes(exposed),false);
 assert.equal(a.chargeCreated,false);
 await assert.rejects(exerciseSandboxTrial({user:{id:customer},verificationToken:'wrong',verifyIdentity:verifier,db:grantDb,secret,nowMs:now}));
});
