import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedPlanRpcName} from '../lib/platform/reverso/subscription/isolation-rpc-v1.mjs';
import {letterRpc,letterNativeAccess,handleLetterBilling} from '../lib/pay/letter-billing-cb006.mjs';
import {platformMonthlyState} from '../lib/platform/monthly-billing.mjs';
import {classifyVerifiedPlan,proPlanAccess} from '../lib/assistant/pro-access.mjs';
const user='a1111111-1111-4111-8111-111111111111';
const on={JENIOS_REVERSO_PLAN_ISOLATION_V1:'true',JENIOS_LETTER_INTEGRATION_ENABLED:'true'};
test('versioned consumer is off by default, exact opt-in selects successors, and an absent successor never falls back',async()=>{
 for(const env of [{},{JENIOS_REVERSO_PLAN_ISOLATION_V1:'false'},{JENIOS_REVERSO_PLAN_ISOLATION_V1:true}])
  assert.equal(isolatedPlanRpcName('jenios_letter_billing_cb006',env),'jenios_letter_billing_cb006');
 assert.equal(isolatedPlanRpcName('jenios_platform_prepare_g47',on),'jenios_platform_prepare_isolated_revfin001');
 assert.equal(isolatedPlanRpcName('jenios_platform_link_g47',on),'jenios_platform_link_g47');
 const calls=[],db={rpc:async(name,args)=>{calls.push([name,args]);return {error:{code:'42883'}};}};
 await assert.rejects(letterRpc(db,user,'status',{},null,{env:on}),{code:'REQUEST_REFUSED'});
 assert.deepEqual(calls.map(c=>c[0]),['jenios_letter_billing_isolated_revfin001']);
});
test('standalone Reverso cannot be returned as general Platform access, while old Platform rights remain valid',async()=>{
 for(const code of ['platform-reverso-monthly','platform-reverso-annual']){
  const db={rpc:async()=>({data:{access:{active:true,productCode:code}}})};
  await assert.rejects(letterNativeAccess(db,user,{env:on}),{code:'REVFIN001_REVERSO_IS_NOT_GENERAL_PLATFORM_ACCESS'});
 }
 const access={active:true,productCode:'platform-global-crypto',validUntil:'2027-01-01T00:00:00Z',cancelAtPeriodEnd:true};
 assert.deepEqual(await letterNativeAccess({rpc:async()=>({data:{access}})},user,{env:on}),access);
});
test('the existing Platform state fallback and billing handler actually mount the isolated RPC without enabling billing',async()=>{
 const calls=[],rows={jenios_platform_billing_config_g47:{payments_enabled:false},jenios_pay_products:[],jenios_platform_payers_g47:null,jenios_platform_invoices_g47:[]};
 const db={async rpc(name,args){calls.push([name,args]);return {data:{ok:true,available:false,access:null,orders:[]}};},from(table){
  const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},maybeSingle(){return Promise.resolve({data:rows[table]});},then(a,b){return Promise.resolve({data:rows[table]}).then(a,b);}};return q;
 }};
 const view=await platformMonthlyState(db,user,{env:on});assert.equal(view.access,null);assert.equal(view.available,false);
 const response=await handleLetterBilling(new Request('https://jenios.example/api/jenios-pay/letter-billing'),{db,env:on,authorize:async()=>({id:user}),clientFactory:()=>assert.fail('no financial adapter is permitted')});
 assert.equal(response.status,200);assert.equal((await response.json()).available,false);
 assert.equal(calls.length,2);assert.ok(calls.every(([name])=>name==='jenios_letter_billing_isolated_revfin001'));
});
test('existing exact plan classification gives no Pro, University or allowance from Reverso and preserves a coexisting Platform plan',()=>{
 const products=[{id:'reverso',code:'platform-reverso-annual',category:'platform'},{id:'legacy',code:'platform-global-crypto',category:'platform'}];
 const active=id=>({id:'sub-'+id,product_id:id,status:'active',current_period_start:'2026-01-01T00:00:00Z',current_period_end:'2027-01-01T00:00:00Z'});
 const now=Date.parse('2026-11-13T00:00:00Z');
 const absent=classifyVerifiedPlan([active('reverso')],products,now);assert.equal(absent,null);
 const denied=proPlanAccess(absent,null,{});assert.equal(denied.proIncluded,false);assert.equal(denied.universityIncluded,false);assert.equal(denied.allowanceMicroUsd,0);
 const old=classifyVerifiedPlan([active('legacy')],products,now);
 assert.deepEqual(classifyVerifiedPlan([active('reverso'),active('legacy')],products,now),old);
 assert.equal(proPlanAccess(old,null,{}).allowanceMicroUsd,4_000_000);
});
