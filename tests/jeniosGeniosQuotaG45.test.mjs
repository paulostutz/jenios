import test from 'node:test';
import assert from 'node:assert/strict';
import {PRO_APPROVED_PROVIDER_BUDGETS,proQuotaSummary,proEligibleSubscription} from '../lib/assistant/pro-quota-policy.mjs';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {projectProStatus} from '../lib/assistant/pro-repository.mjs';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';

const NOW=Date.parse('2026-10-24T22:30:00Z');
const USER='45000000-0000-4000-8000-000000000001';
const KEY='45000000-0000-4000-8000-000000000002';
const PLAN={code:'platform-global-crypto',periodStart:'2026-10-20T00:00:00Z',periodEnd:'2026-11-20T00:00:00Z'};
const allowance=(patch={})=>({status:'configured',totalNanoUsd:4_000_000_000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:4_000_000_000,periodEnd:PLAN.periodEnd,...patch});

test('G45 approved budgets mean provider cost, while verified ledger balances retain their 2x denomination',()=>{
 assert.deepEqual(PRO_APPROVED_PROVIDER_BUDGETS,{'platform-global-crypto':2_000_000_000,'platform-internacional-pro':4_000_000_000});
 assert.equal(Object.isFrozen(PRO_APPROVED_PROVIDER_BUDGETS),true);
 assert.deepEqual(proQuotaSummary(allowance()),{state:'available',usedPercent:0,providerLimitNanoUsd:2_000_000_000,providerSpentNanoUsd:0,providerReservedNanoUsd:0,providerAvailableNanoUsd:2_000_000_000,periodEnd:PLAN.periodEnd});
 const higher=proQuotaSummary(allowance({totalNanoUsd:8_000_000_000,availableNanoUsd:8_000_000_000}));
 assert.equal(higher.providerLimitNanoUsd,4_000_000_000);
});

test('G45 warning includes pending reservations without claiming they have already been spent',()=>{
 const summary=proQuotaSummary(allowance({spentNanoUsd:3_000_000_000,reservedNanoUsd:200_000_000,availableNanoUsd:800_000_000}));
 assert.equal(summary.state,'near_limit');assert.equal(summary.usedPercent,80);
 assert.equal(summary.providerSpentNanoUsd,1_500_000_000);assert.equal(summary.providerReservedNanoUsd,100_000_000);
 assert.equal(summary.providerAvailableNanoUsd,400_000_000);
 const below=proQuotaSummary(allowance({spentNanoUsd:3_199_999_999,availableNanoUsd:800_000_001}));
 assert.equal(below.state,'available');assert.equal(below.usedPercent,79.99);
 assert.equal(below.providerSpentNanoUsd,1_599_999_999.5);assert.equal(below.providerAvailableNanoUsd,400_000_000.5);
});

test('G45 exhausted display never replaces an empty or invalid ledger with approved budget',()=>{
 const summary=proQuotaSummary(allowance({spentNanoUsd:4_000_000_000,availableNanoUsd:0}));
 assert.equal(summary.state,'exhausted');assert.equal(summary.usedPercent,100);assert.equal(summary.providerAvailableNanoUsd,0);
 for(const invalid of [undefined,null,{},allowance({status:'unconfigured'}),allowance({totalNanoUsd:0,availableNanoUsd:0}),
  allowance({spentNanoUsd:-1}),allowance({totalNanoUsd:'4e9'}),allowance({availableNanoUsd:null}),allowance({reservedNanoUsd:NaN}),
  allowance({spentNanoUsd:1,availableNanoUsd:4_000_000_000}),allowance({spentNanoUsd:4_000_000_001,availableNanoUsd:0}),
  allowance({periodEnd:'invalid'}),allowance({totalNanoUsd:Number.MAX_SAFE_INTEGER+1}),allowance({availableNanoUsd:' 4000000000'})]){
  const value=proQuotaSummary(invalid);assert.equal(value.state,'unconfigured');
  assert.equal(value.usedPercent,null);assert.equal(value.providerLimitNanoUsd,null);assert.equal(value.providerAvailableNanoUsd,null);
 }
 const text=proQuotaSummary(allowance({totalNanoUsd:'4000000000',spentNanoUsd:'0',reservedNanoUsd:'0',availableNanoUsd:'4000000000'}));
 assert.equal(text.state,'available');assert.equal(text.providerLimitNanoUsd,2_000_000_000);
});

test('G45 eligible subscriptions require a known paid tier and a currently valid cycle',()=>{
 for(const code of Object.keys(PRO_APPROVED_PROVIDER_BUDGETS))assert.equal(proEligibleSubscription({...PLAN,code},NOW),true);
 for(const plan of [null,{}, {...PLAN,code:'platform-nacional'}, {...PLAN,code:'__proto__'}, {...PLAN,periodStart:null},
  {...PLAN,periodStart:new Date(NOW+1).toISOString()}, {...PLAN,periodEnd:new Date(NOW).toISOString()},
  {...PLAN,periodEnd:'invalid'}, {...PLAN,periodStart:PLAN.periodEnd}])assert.equal(proEligibleSubscription(plan,NOW),false);
});

test('G45 status preserves an ambiguous paid-cycle transition without displaying a new allowance',()=>{
 const raw={ok:true,wallet:{totalNanoUsd:200,reservedNanoUsd:0,availableNanoUsd:200},allowance:{totalNanoUsd:8_000_000_000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:0,periodEnd:PLAN.periodEnd,transitionRequired:true,transitionCode:'INCLUDED_PERIOD_TRANSITION_REQUIRED'}};
 const status=projectProStatus(raw),summary=proQuotaSummary(status.allowance);
 assert.equal(status.allowance.status,'pending_transition');assert.equal(status.allowance.transitionRequired,true);
 assert.equal(status.allowance.transitionCode,'INCLUDED_PERIOD_TRANSITION_REQUIRED');assert.equal(status.allowance.availableNanoUsd,0);
 assert.equal(summary.state,'unconfigured');assert.equal(summary.transitionRequired,true);assert.equal(summary.providerLimitNanoUsd,null);
 assert.throws(()=>projectProStatus({...raw,allowance:{...raw.allowance,availableNanoUsd:1}}),{code:'LEDGER_UNAVAILABLE'});
 assert.throws(()=>projectProStatus({...raw,allowance:{...raw.allowance,transitionCode:'UNKNOWN'}}),{code:'LEDGER_UNAVAILABLE'});
});

function fixture({plan=PLAN,walletBalance=4_000_000_000,master=false,included=allowance(),policyPatch={}}={}){
 const calls={status:0,reserve:0,dispatch:0,provider:0,settle:0},rows=new Map();
 const config={installed:true,generationEnabled:true,requiresReconciliation:false,allowedModels:['gpt-6-luna'],
  maxRequestProviderNanoUsd:120_000_000,allowances:{'platform-global-crypto':4_000_000_000,'platform-internacional-pro':8_000_000_000},...policyPatch};
 const repo={
  config:async()=>config,
  status:async()=>{calls.status++;return {ok:true,pendingRequests:0,wallet:{status:'verified',totalNanoUsd:walletBalance,reservedNanoUsd:0,availableNanoUsd:walletBalance},allowance:included};},
  request:async key=>rows.get(key),
  reserve:async(input,quote,key)=>{calls.reserve++;assert.equal(input.source,'prepaid');assert.ok(quote.maxRetailNanoUsd<=walletBalance);
   rows.set(key,{id:key,user_id:USER,request_key:key,source:input.source,task:input.task,fingerprint:input.fingerprint,state:'reserved',created_at:new Date(NOW).toISOString(),provider_nano_usd:0,charged_nano_usd:0});return {ok:true,requestId:key};},
  dispatch:async(input,key)=>{calls.dispatch++;rows.get(key).state='dispatched';return {ok:true,acquired:true};},
  settle:async(input,key,result)=>{calls.settle++;const debit=result.cost.retailDebitNanoUsd;walletBalance-=debit;
   Object.assign(rows.get(key),{state:'settled',provider_nano_usd:result.cost.providerCostNanoUsd,charged_nano_usd:debit,result_data:result.result});return {ok:true};}
 };
 const env={JENIOS_PRO_GENERATION_ENABLED:'true',OPENAI_API_KEY:'g45-local-fixture-not-a-live-key',JENIOS_PRO_QUOTE_SECRET:'g45-local-quote-signing-fixture-not-a-secret'};
 const options={db:{},env,now:NOW,planOnly:true,authorize:async()=>({id:USER,is_anonymous:false,...(master?{app_metadata:{role:'master'}}:{})}),
  repository:()=>repo,planResolver:async()=>plan,passResolver:async()=>null,marketLoader:async()=>null,
  provider:async()=>{calls.provider++;return {kind:'usage_confirmed',cost:{providerCostNanoUsd:100,retailDebitNanoUsd:200},usage:{input_tokens:1,output_tokens:0},result:{answer:'Resposta útil da consulta adicional.',source:null},providerResponseId:'fixture-response'};}};
 return {calls,repo,options,rows,balance:()=>walletBalance};
}
const input={persona:'genia',task:'advanced_question',prompt:'Como funciona o suporte adicional?',source:'prepaid'};
const req=(body,action='quote')=>new Request('https://fixture.invalid/api/assistant/pro/'+action,{method:action==='access'?'GET':'POST',headers:{'content-type':'application/json'},...(action==='access'?{}:{body:JSON.stringify(body)})});

test('G45 access reports verified current consumption rather than silently provisioning the approved allowance',async()=>{
 const f=fixture({included:allowance({totalNanoUsd:2_000_000_000,spentNanoUsd:1_600_000_000,availableNanoUsd:400_000_000})});
 const response=await handlePro(req(null,'access'),{...f.options,action:'access'}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.quota.providerLimitNanoUsd,1_000_000_000);
 assert.equal(data.quota.providerSpentNanoUsd,800_000_000);assert.equal(data.quota.state,'near_limit');
 assert.equal(data.creditsOffer.enabled,false);assert.equal(data.paymentStatus,'not_enabled');
 assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);assert.match(data.terms,/adicional/);
});

test('G45 active eligible subscription can use confirmed additional wallet while included allowance is exhausted',async()=>{
 const included=allowance({spentNanoUsd:4_000_000_000,availableNanoUsd:0});
 const f=fixture({included}),quoteResponse=await handlePro(req(input),{...f.options,action:'quote'}),quoted=await quoteResponse.json();
 assert.equal(quoteResponse.status,200);assert.equal(quoted.quote.source,'prepaid');assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
 const body={...input,quoteId:quoted.quote.id,maxRetailNanoUsd:quoted.quote.maxRetailNanoUsd,requestKey:KEY,consent:true};
 const response=await handlePro(req(body,'chat'),{...f.options,action:'chat'}),result=await response.json();
 assert.equal(response.status,200);assert.equal(result.state,'settled');assert.equal(result.chargedNanoUsd,200);assert.equal(result.providerNanoUsd,100);
 assert.equal(f.balance(),3_999_999_800);assert.equal(included.spentNanoUsd,4_000_000_000);
 const replay=await handlePro(req(body,'chat'),{...f.options,action:'chat'}),again=await replay.json();
 assert.equal(again.replayed,true);assert.equal(again.answer,result.answer);
 assert.deepEqual({...f.calls,status:0},{status:0,reserve:1,dispatch:1,provider:1,settle:1});
 assert.equal(f.balance(),3_999_999_800);
});

test('G45 extra wallet does not create subscription rights, including for a Master without a paid plan',async()=>{
 for(const options of [{plan:null},{plan:null,master:true},{plan:{...PLAN,code:'platform-nacional'}},
  {plan:{...PLAN,periodEnd:new Date(NOW-1).toISOString()}},{plan:{...PLAN,periodStart:new Date(NOW+1).toISOString()}}]){
  const f=fixture(options),response=await handlePro(req(input),{...f.options,action:'quote'}),data=await response.json();
  assert.equal(response.status,402);assert.equal(data.code,'ADVANCED_PLAN_REQUIRED');
  assert.equal(f.calls.status,0);assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
 }
});

test('G45 zero additional balance and low included remainder reject before any generation or reservation',async()=>{
 const f=fixture({walletBalance:0,included:allowance({spentNanoUsd:3_999_999_999,availableNanoUsd:1})});
 for(const source of ['prepaid','included']){
  const response=await handlePro(req({...input,source}),{...f.options,action:'quote'}),data=await response.json();
  assert.equal(response.status,402);assert.equal(data.code,'INSUFFICIENT_BALANCE');
  assert.equal(data.state,'not_started');assert.equal(data.quote,undefined);
 }
 assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
});

test('G45 pending subscription transition reports a reconciliation state instead of selling an exhausted allowance',async()=>{
 const f=fixture({included:allowance({status:'pending_transition',availableNanoUsd:0,transitionRequired:true,transitionCode:'INCLUDED_PERIOD_TRANSITION_REQUIRED'})});
 const response=await handlePro(req({...input,source:'included'}),{...f.options,action:'quote'}),data=await response.json();
 assert.equal(response.status,409);assert.equal(data.code,'INCLUDED_PERIOD_TRANSITION_REQUIRED');assert.equal(data.quote,undefined);
 assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
});

test('G45 history remains readable without a plan or active generation',async()=>{
 const f=fixture({plan:null,policyPatch:{generationEnabled:false}});
 f.repo.history=async()=>({items:[{id:KEY,state:'settled',source:'prepaid'}],hasMore:false});
 const response=await handlePro(new Request('https://fixture.invalid/api/assistant/pro/history'),{...f.options,action:'history'}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.items[0].source,'prepaid');assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
});

test('G45 an expired subscriber can see payment reconciliation readiness without a new purchase offer',async()=>{
 const f=fixture({plan:null,policyPatch:{topupsEnabled:true,pricingVersion:PRO_PRICING_VERSION,
  topup:{baseCurrency:'BRL',amountMinor:2500,termsVersion:'g45-fixture-terms'}}});
 const product={code:'social-ai-pro-credits',active:true,category:'other',currency:'BRL',billing_type:'one_time'};
 let reads=0;
 f.options.db={from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{reads++;return {data:product,error:null};}};return q;}};
 Object.assign(f.options.env,{JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_INTER_CHARGES_ENABLED:'true',JENIOS_PRO_PAYMENTS_ENABLED:'true',JENIOS_PAY_PROVIDER:'inter_pix',INTER_CLIENT_ID:'fixture-id',INTER_CLIENT_SECRET:'fixture-secret',INTER_CERTIFICATE:'fixture-certificate',INTER_PRIVATE_KEY:'fixture-key',INTER_PIX_KEY:'fixture-pix'});
 const response=await handlePro(req(null,'access'),{...f.options,action:'access'}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.proIncluded,false);assert.equal(body.paidGenerationEnabled,false);
 assert.equal(body.creditsOffer.enabled,false);assert.equal(body.creditsOffer.reconciliationEnabled,true);
 assert.equal(body.paymentStatus,'not_enabled');assert.equal(reads,1);assert.equal(f.calls.reserve,0);assert.equal(f.calls.provider,0);
});
