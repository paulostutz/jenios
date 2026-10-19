import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSyntheticSubscription} from '../lib/platform/subscription-lifecycle-audit.mjs';
const now=Date.parse('2026-10-19T19:00:00Z');
const subscriber='11111111-1111-4111-8111-111111111111';
const contract='22222222-2222-4222-8222-222222222222';
const event=(n,eventType)=>({id:'33333333-3333-4333-8333-'+String(n).padStart(12,'0'),
 subscriberId:subscriber,contractId:contract,planCode:'platform-nacional',
 scope:'platform',priceCents:9990,currency:'BRL',billingType:'monthly',
 source:'synthetic_qa',eventType,time:new Date(now-100000+n*1000).toISOString()});
test('B86 reversible synthetic lifecycle validates activation renewal and cancellation, without charging',()=>{
 const r=auditSyntheticSubscription([event(1,'requested'),event(2,'activated'),
  event(3,'renewed'),event(4,'cancelled')],{now});
 assert.equal(r.valid,true);assert.equal(r.hypotheticalStatus,'cancelled');
 assert.equal(r.chargesCreated,0);assert.equal(r.entitlementGranted,false);
 assert.equal(r.providerVerified,false);assert.equal(r.realPaymentAuthorized,false);
});
test('B86 duplicate webhook simulations deduplicate and conflicting idempotency fails',()=>{
 const req=event(1,'requested'),active=event(2,'activated');
 const x=auditSyntheticSubscription([req,active,active],{now});
 assert.equal(x.valid,true);assert.equal(x.duplicateIgnored,1);
 const b=auditSyntheticSubscription([req,active,{...active,priceCents:14990}],{now});
 assert.equal(b.valid,false);
});
test('B86 cross-account and price changes are rejected before private status is available',()=>{
 const req=event(1,'requested'),active=event(2,'activated');
 for(const mod of [{subscriberId:'44444444-4444-4444-8444-444444444444'},
   {scope:'social'},{priceCents:0},{source:'provider_live'}]){
  const r=auditSyntheticSubscription([req,{...active,...mod}],{now});
  assert.equal(r.valid,false);assert.equal(r.chargesCreated,0);
 }
});
test('B86 cannot activate before requested or renew after cancelled',()=>{
 assert.equal(auditSyntheticSubscription([event(1,'activated')],{now}).valid,false);
 assert.equal(auditSyntheticSubscription([event(1,'requested'),event(2,'cancelled'),event(3,'renewed')],{now}).valid,false);
});
test('B86 future events and live receipt payloads fail closed',()=>{
 const req=event(1,'requested');
 assert.equal(auditSyntheticSubscription([{...req,time:new Date(now+2000).toISOString()}],{now}).valid,false);
 assert.equal(auditSyntheticSubscription([{...req,providerReceipt:'fake'}],{now}).valid,false);
});
