import test from 'node:test';import assert from 'node:assert/strict';
import {assessSyntheticCommerceLifecycle} from '../lib/platform/launch/b228-synthetic-lifecycle.mjs';
const ids=['4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7','50b85e9d-339c-4d32-b2bf-82c467673832'];
const nowMs=1792530000000;
const event=(id,type,time)=>({id,subscriberId:ids[0],contractId:ids[1],planCode:'platform-nacional',
 scope:'platform',priceCents:9990,currency:'BRL',billingType:'monthly',source:'synthetic_qa',
 eventType:type,time:new Date(time).toISOString()});
test('B228 valid mock purchase/activation and duplicate do not create Pix or grant access',()=>{
 const events=[event(ids[0],'requested',nowMs-10000),event(ids[0],'requested',nowMs-10000),
  event(ids[1],'activated',nowMs-8000)];
 const r=assessSyntheticCommerceLifecycle(events,{nowMs});
 assert.equal(r.scenarioValid,true);assert.equal(r.hypotheticalStatus,'activated');
 assert.equal(r.duplicatesSuppressed,1);assert.equal(r.realBankPixCreated,0);assert.equal(r.entitlementsCreated,0);
});
test('B228 invalid synthetic lifecycle fails without charges',()=>{
 const r=assessSyntheticCommerceLifecycle([event(ids[0],'activated',nowMs-10000)],{nowMs});
 assert.equal(r.scenarioValid,false);assert.equal(r.chargesCreated,0);
});
