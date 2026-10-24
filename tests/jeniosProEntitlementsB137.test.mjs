import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVerifiedPlan,proPlanAccess,PLATFORM_PAID_TIERS,KNOWN_PLATFORM_PRODUCTS,PRO_MONTHLY_INCLUDED_MICRO_USD} from '../lib/assistant/pro-access.mjs';
const NOW=Date.parse('2026-10-20T12:00:00Z'),start=new Date(NOW-60000).toISOString(),end=new Date(NOW+60000).toISOString();
const products=[{id:'p99',code:'platform-nacional',category:'platform'},{id:'p149',code:'platform-global-crypto',category:'platform'},{id:'p199',code:'platform-internacional-pro',category:'platform'}];
const sub=(product_id,status='active',s=start,e=end)=>({id:product_id,product_id,status,current_period_start:s,current_period_end:e});
test('G45 included ledger allowances match the approved provider budgets and higher plans include University and Pro',()=>{
 assert.deepEqual(PLATFORM_PAID_TIERS,['platform-global-crypto','platform-internacional-pro']);
 assert.deepEqual(KNOWN_PLATFORM_PRODUCTS,['platform-nacional',...PLATFORM_PAID_TIERS]);
 assert.deepEqual(PRO_MONTHLY_INCLUDED_MICRO_USD,{'platform-global-crypto':4_000_000,'platform-internacional-pro':8_000_000});
 for(const code of PLATFORM_PAID_TIERS){
  const plan=classifyVerifiedPlan([sub(code==='platform-global-crypto'?'p149':'p199')],products,NOW);
  const right=proPlanAccess(plan,null,{});
  assert.equal(right.proIncluded,true);assert.equal(right.universityIncluded,true);
  assert.equal(right.allowanceMicroUsd,PRO_MONTHLY_INCLUDED_MICRO_USD[code]);
 }
});
test('B137 Nacional and unauthenticated users do not get paid Pro or University access',()=>{
 for(const plan of [null,classifyVerifiedPlan([sub('p99')],products,NOW)]){
  const right=proPlanAccess(plan,null,{});
  assert.equal(right.proIncluded,false);assert.equal(right.universityIncluded,false);assert.equal(right.allowanceMicroUsd,0);
 }
});
test('B137 expired, canceled, future and client-generated role claims never unlock products',()=>{
 for(const candidate of [sub('p149','canceled'),sub('p149','active',new Date(NOW+1).toISOString(),end),sub('p149','active',start,new Date(NOW).toISOString())]){
  assert.equal(classifyVerifiedPlan([candidate],products,NOW),null);
 }
 assert.equal(proPlanAccess(null,{id:'user',user_metadata:{role:'master'},app_metadata:{}},{}).proIncluded,false);
});
test('B137 overlapping valid plan selects the strongest actual paid tier',()=>{
 const high=classifyVerifiedPlan([sub('p149'),sub('p199'),sub('p99')],products,NOW);
 assert.equal(high.code,'platform-internacional-pro');
});
test('B137 Master has administrative preview, not unlimited paid provider tokens',()=>{
 const r=proPlanAccess(null,{id:'owner',app_metadata:{role:'master'}},{});
 assert.equal(r.master,true);assert.equal(r.universityIncluded,true);
 assert.equal(r.allowanceMicroUsd,0);
});
