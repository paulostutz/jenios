import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLATFORM_PLAN_PREVIEW,formatPlanPreview,evaluateSubscriptionPreflight} from '../lib/platform/subscription-readiness.mjs';
import {DEFAULT_PRODUCTS} from '../lib/pay/catalog.mjs';
test('B81 three plan names and monthly prices match the unchanged JENIOS PAY catalog',()=>{
 assert.equal(PLATFORM_PLAN_PREVIEW.length,3);
 for(const plan of PLATFORM_PLAN_PREVIEW){
  const row=DEFAULT_PRODUCTS.find(x=>x.code===plan.code);
  assert.equal(row.category,'platform');assert.equal(row.billing_type,'monthly');
  assert.equal(row.price_cents,plan.priceCents);
  assert.match(formatPlanPreview(plan.priceCents),/R\$/);
 }
});
test('B81 an unauthenticated subscriber or same-email guess never becomes an authorized payer',()=>{
 const x=evaluateSubscriptionPreflight({platformOwnerId:'11111111-1111-4111-8111-111111111111'});
 assert.equal(x.readyForControlledQA,false);assert.equal(x.clientMayCharge,false);
 assert.equal(x.subscriberStatus,'unverified');
});
test('B81 even all mock readiness checks cannot authorize a checkout in the browser',()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const x=evaluateSubscriptionPreflight({platformOwnerId:a,payerOwnerId:b,
  link:{serverSigned:true,platformOwnerId:a,payerOwnerId:b,id:'33333333-3333-4333-8333-333333333333'},
  lifecycle:{activationVerified:true,renewalVerified:true,cancellationVerified:true,idempotencyVerified:true,providerReconciliationVerified:true},
  catalog:{source:'provider_confirmed',scope:'platform',pricesVerified:true}});
 assert.equal(x.readyForControlledQA,true);assert.equal(x.clientMayCharge,false);
 assert.equal(x.canExecuteReal,false);
});
test('B81 billing component retains Social isolation and never starts payment automatically',()=>{
 const ui=readFileSync('app/components/platform/PlatformBillingStatus.js','utf8');
 assert.match(ui,/O extrato da Social não é utilizado/);
 assert.match(ui,/PLATFORM_PLAN_PREVIEW/);
 assert.doesNotMatch(ui,/fetch\(['"]\/api\/platform\/checkout|checkoutService\(/);
});
