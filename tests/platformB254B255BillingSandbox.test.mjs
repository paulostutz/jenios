import test from 'node:test';import assert from 'node:assert/strict';
import {replayControlledSubscriptionSandbox} from '../lib/platform/release260/b254-payment-sandbox.mjs';
import {OfflinePaymentReplayJournal} from '../lib/platform/release260/b255-idempotency-sandbox.mjs';
const payer='b1234567-1234-4234-8234-123456789012',contract='c1234567-1234-4234-8234-123456789012';
const evt=(n,kind,date,patch={})=>({id:`${String(n).padStart(8,'0')}-1234-4234-8234-123456789012`,
 subscriberId:payer,contractId:contract,planCode:'platform-global-crypto',scope:'platform',
 priceCents:14990,currency:'BRL',billingType:'monthly',source:'synthetic_qa',
 eventType:kind,time:date,providerReceipt:null,livePayment:false,...patch});
const now=1792573200000,t1='2026-10-20T00:00:00Z',t2='2026-10-20T00:01:00Z',t3='2026-10-20T00:02:00Z';
test('B254 rehearsal traverses request, activation, renewal and cancellation without payment',()=>{
 const out=replayControlledSubscriptionSandbox({events:[evt(1,'requested',t1),evt(2,'activated',t2),evt(3,'renewed',t3)],
 nowMs:now,expectedOwnerId:payer,expectedPlanCode:'platform-global-crypto'});
 assert.equal(out.hypotheticalStatus,'renewed');assert.equal(out.externalProviderWebhookVerified,false);
 assert.equal(out.entitlementsGranted,0);assert.equal(out.chargesCreated,0);
});
test('B254 duplicate event is suppressed but a changed idempotency payload is rejected',()=>{
 const a=evt(1,'requested',t1),b=evt(2,'activated',t2);
 const out=replayControlledSubscriptionSandbox({events:[a,a,b],nowMs:now,expectedOwnerId:payer,
 expectedPlanCode:'platform-global-crypto'});
 assert.equal(out.duplicatesSuppressed,1);
 for(const tampered of [[a,{...a,eventType:'cancelled'}],[a,{...b,priceCents:19990}]]){
  const bad=replayControlledSubscriptionSandbox({events:tampered,nowMs:now,expectedOwnerId:payer,expectedPlanCode:'platform-global-crypto'});
  assert.equal(bad.classification,'INVALID_OR_CROSS_OWNER_SANDBOX');
 }
});
test('B254 prevents reopening cancelled subscription, price drift and cross owner',()=>{
 const invalidSets=[[evt(1,'requested',t1),evt(2,'cancelled',t2),evt(3,'activated',t3)],
 [evt(1,'requested',t1),evt(2,'activated',t2,{subscriberId:'d1234567-1234-4234-8234-123456789012'})],
 [evt(1,'requested',t1),evt(2,'activated',t2,{priceCents:9990})]];
 for(const events of invalidSets){const o=replayControlledSubscriptionSandbox({events,nowMs:now,
 expectedOwnerId:payer,expectedPlanCode:'platform-global-crypto'});
 assert.equal(o.chargesCreated,0);assert.equal(o.classification,'INVALID_OR_CROSS_OWNER_SANDBOX');}
});
test('B255 same sandbox receipt cannot be claimed twice or across another payer',()=>{
 const journal=new OfflinePaymentReplayJournal();const row={eventId:'a1234567-1234-4234-8234-123456789012',
 payerId:payer,contractId:contract,planCode:'platform-global-crypto',priceCents:14990,
 kind:'requested',environment:'synthetic_qa',bankReceipt:null,realCharge:false};
 assert.equal(journal.record(row).duplicate,false);assert.equal(journal.record({...row}).duplicate,true);
 assert.throws(()=>journal.record({...row,payerId:'d1234567-1234-4234-8234-123456789012'}),/PAYMENT_IDEMPOTENCY_CONFLICT/);
 assert.throws(()=>journal.record({...row,eventId:'e1234567-1234-4234-8234-123456789012',payerId:'d1234567-1234-4234-8234-123456789012'}),/CONTRACT_PAYER_OR_PLAN_CHANGED/);
 assert.equal(journal.summary().chargesCreated,0);
});
test('B255 rejects real provider input, invalid amount and forgery; never grants access',()=>{
 const ledger=new OfflinePaymentReplayJournal();const row={eventId:'a1234567-1234-4234-8234-123456789012',
 payerId:payer,contractId:contract,planCode:'platform-nacional',priceCents:9990,
 kind:'requested',environment:'synthetic_qa',bankReceipt:null,realCharge:false};
 for(const patch of [{environment:'production'},{bankReceipt:{txid:'abc'}},{realCharge:true},{priceCents:19990},
  {planCode:'social-bankscore-report'}]) assert.throws(()=>ledger.record({...row,...patch}),/UNTRUSTED_SANDBOX_EVENT/);
 assert.equal(ledger.summary().accessGranted,false);
});
