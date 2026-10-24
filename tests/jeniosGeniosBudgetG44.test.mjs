import test from 'node:test';
import assert from 'node:assert/strict';
import {salesMonthlyBudgetPolicy,SALES_MODEL_SPEND_MICRO_USD} from '../lib/assistant/sales-policy.mjs';
import {salesModelReady,reserveSalesAiBudget,SALES_GENERATION_LIMITS} from '../lib/assistant/sales-provider.mjs';
import {replyWithContext} from '../lib/assistant/conversational-reply.mjs';
import {proWalletConfig} from '../lib/assistant/pro-wallet-contract.mjs';
import {createProQuote,normalizeProInput,verifyProQuote} from '../lib/assistant/pro-input.mjs';
import {handlePro,proRuntimeReady} from '../lib/assistant/pro-service.mjs';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';

const now=Date.parse('2026-10-24T21:00:00Z');
const user='44000000-0000-4000-8000-000000000001';
const sales={JENIOS_SALES_GENERATIVE_ENABLED:'true',JENIOS_SALES_MODEL:'gpt-6-luna',
 OPENAI_API_KEY:'g44-local-fixture-no-provider-credential',JENIOS_SALES_VISITOR_SALT:'g44-local-visitor-salt-never-deployed',
 JENIOS_AI_MONTHLY_BUDGET_MODE:'uncapped'};
const proEnv={OPENAI_API_KEY:sales.OPENAI_API_KEY,JENIOS_PRO_GENERATION_ENABLED:'true',
 JENIOS_PRO_QUOTE_SECRET:'g44-local-quote-signing-material-never-deployed'};
const config=()=>({id:true,monthly_budget_mode:'uncapped',monthly_provider_limit_nano_usd:0,
 generation_enabled:true,payments_enabled:false,requires_reconciliation:false,pricing_version:PRO_PRICING_VERSION,
 pricing_approved:true,rates_verified_at:new Date(now-1000).toISOString(),allowed_models:['gpt-6-luna'],
 max_request_provider_nano_usd:100_000_000,crypto_allowance_nano_usd:2_000_000_000,
 global_allowance_nano_usd:4_000_000_000,topup_currency:null,topup_amount_minor:null,commercial_terms_version:null});
const request=body=>new Request('https://fixture.invalid/api/assistant/pro/quote',{method:'POST',
 headers:{'content-type':'application/json','x-real-ip':'127.0.0.1'},body:JSON.stringify(body)});
const question={persona:'genio',task:'advanced_question',prompt:'Como estudar risco?',source:'included'};

test('G44 capped remains the default and keeps the exact existing amount range',()=>{
 assert.deepEqual(salesMonthlyBudgetPolicy({JENIOS_AI_MONTHLY_BUDGET_USD:'10'}),{mode:'capped',limitMicroUsd:10_000_000});
 assert.deepEqual(salesMonthlyBudgetPolicy({JENIOS_AI_MONTHLY_BUDGET_MODE:'capped',JENIOS_AI_MONTHLY_BUDGET_USD:'1000'}),{mode:'capped',limitMicroUsd:1_000_000_000});
 for(const value of [undefined,'','0','-1','1001','Infinity','not-a-number'])
  assert.equal(salesMonthlyBudgetPolicy({JENIOS_AI_MONTHLY_BUDGET_USD:value}),null);
});
test('G44 uncapped is explicit, has a null cap and does not infer policy from provider credit',()=>{
 assert.deepEqual(salesMonthlyBudgetPolicy(sales),{mode:'uncapped',limitMicroUsd:null});
 assert.deepEqual(salesMonthlyBudgetPolicy({...sales,JENIOS_AI_MONTHLY_BUDGET_USD:'10'}),{mode:'uncapped',limitMicroUsd:null});
 for(const mode of ['','UNCAPPED','unlimited','Infinity',false,1])
  assert.equal(salesMonthlyBudgetPolicy({...sales,JENIOS_AI_MONTHLY_BUDGET_MODE:mode}),null);
 assert.equal(salesModelReady({...sales,JENIOS_AI_MONTHLY_BUDGET_MODE:undefined}),false);
});
test('G44 chooses a server-authorized RPC without changing the legacy capped contract',async()=>{
 const calls=[],db={async rpc(name,args){calls.push({name,args});return {data:true};}};
 const cap={...sales,JENIOS_AI_MONTHLY_BUDGET_MODE:'capped',JENIOS_AI_MONTHLY_BUDGET_USD:'10'};
 const original=structuredClone(sales);
 assert.equal(await reserveSalesAiBudget(db,'a'.repeat(64),cap,now),true);
 assert.equal(await reserveSalesAiBudget(db,'b'.repeat(64),sales,now),true);
 assert.equal(calls[0].name,'jenios_sales_budget_hold_b282');assert.equal(calls[0].args.p_limit_micro_usd,10_000_000);
 assert.equal(calls[0].args.p_budget_mode,undefined);
 assert.equal(calls[1].name,'jenios_sales_budget_hold_g44');assert.equal(calls[1].args.p_limit_micro_usd,null);
 assert.equal(calls[1].args.p_budget_mode,'uncapped');assert.equal(calls[1].args.p_amount_micro_usd,20_000);
 assert.deepEqual(sales,original);
});
for(const result of [{data:false},{data:null},{error:{code:'PGRST202'}},{data:true,error:{message:'unavailable'}}])
test('G44 absent/disabled database policy makes no paid call: '+JSON.stringify(result),async()=>{
 let rpcCalls=0,providerCalls=0;
 const response=await replyWithContext({message:'Como publicar uma foto?',persona:'genia'},
  {env:sales,now,request:request({}),db:{async rpc(){rpcCalls++;return result;}},
   fetcher:async()=>{providerCalls++;throw Error('External transport forbidden');}});
 assert.equal(response.mode,'guided');assert.match(response.explanation,/JPG/);
 assert.equal(rpcCalls,1);assert.equal(providerCalls,0);
});
test('G44 uncapped preserves fixed hold, counted input, output bound and local-only transport',async()=>{
 const calls=[],holds=[];
 const response=await replyWithContext({message:'Como começar na Universidade?',persona:'genia'},
  {env:sales,now,request:request({}),db:{async rpc(name,args){holds.push({name,args});return {data:true};}},
   fetcher:async(url,options)=>{
    assert.equal(holds.length,1);assert.ok(['https://api.openai.com/v1/responses/input_tokens','https://api.openai.com/v1/responses'].includes(url));
    const payload=JSON.parse(options.body);calls.push(payload);
    if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1000});
    assert.equal(payload.store,false);assert.deepEqual(payload.tools,[]);assert.equal(payload.max_output_tokens,900);
    return Response.json({model:'gpt-6-luna',service_tier:'default',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'A Universidade oferece aulas e revisões conforme o conteúdo oficial.',articleIds:['school'],planCode:null})}]}]});
   }});
 assert.equal(holds[0].args.p_amount_micro_usd,SALES_MODEL_SPEND_MICRO_USD);assert.equal(calls.length,2);
 assert.equal(response.mode,'ai');assert.equal(response.modelCalls,1);assert.equal(response.executionEnabled,false);
});
test('G44 uncapped input above the original token bound never reaches inference',async()=>{
 let calls=0;
 const response=await replyWithContext({message:'Como publicar uma foto?',persona:'genio'},
  {env:sales,now,request:request({}),db:{rpc:async()=>({data:true})},fetcher:async url=>{
   calls++;assert.ok(url.endsWith('/input_tokens'));
   return Response.json({object:'response.input_tokens',input_tokens:SALES_GENERATION_LIMITS.maxInputTokens+1});
  }});
 assert.equal(response.mode,'guided');assert.equal(response.modelCalls,0);assert.equal(calls,1);
});
for(const patch of [{JENIOS_SALES_GENERATIVE_ENABLED:'false'},{OPENAI_API_KEY:''},{JENIOS_SALES_MODEL:'unknown'},{JENIOS_SALES_VISITOR_SALT:''}])
test('G44 uncapped does not enable an absent independent gate: '+Object.keys(patch)[0],()=>{
 assert.equal(salesModelReady({...sales,...patch}),false);
});
test('G44 Pro default stays capped; uncapped has no fabricated balance or automatic allowance',()=>{
 const capped={...config(),monthly_budget_mode:undefined};
 assert.equal(proWalletConfig(capped,now).generationEnabled,false);
 assert.equal(proWalletConfig({...capped,monthly_provider_limit_nano_usd:1000},now).generationEnabled,true);
 const raw={...config(),crypto_allowance_nano_usd:0,global_allowance_nano_usd:0};
 const projected=proWalletConfig(raw,now);
 assert.equal(projected.generationEnabled,true);assert.equal(projected.monthlyBudgetMode,'uncapped');
 assert.equal(projected.monthlyProviderLimitNanoUsd,null);assert.deepEqual(Object.values(projected.allowances),[0,0]);
 assert.equal(projected.topupsEnabled,false);assert.equal(raw.monthly_provider_limit_nano_usd,0);
 assert.throws(()=>proWalletConfig({...raw,monthly_budget_mode:'unlimited'},now),/orçamento/);
});
for(const patch of [{generation_enabled:false},{requires_reconciliation:true},{pricing_approved:false},
 {pricing_version:'unreviewed'},{rates_verified_at:'2026-01-01T00:00:00Z'},{rates_verified_at:'2027-01-01T00:00:00Z'},
 {allowed_models:[]},{max_request_provider_nano_usd:0}])
test('G44 Pro uncapped preserves independent activation checks: '+Object.keys(patch)[0],()=>{
 assert.equal(proWalletConfig({...config(),...patch},now).generationEnabled,false);
});
test('G44 Pro still needs runtime enablement, provider credential and quote signing secret',()=>{
 const policy=proWalletConfig(config(),now);
 assert.equal(proRuntimeReady(policy,proEnv),true);
 for(const patch of [{JENIOS_PRO_GENERATION_ENABLED:'false'},{OPENAI_API_KEY:''},{JENIOS_PRO_QUOTE_SECRET:''}])
  assert.equal(proRuntimeReady(policy,{...proEnv,...patch}),false);
});
test('G44 Pro uncapped retains the signed per-request maximum and owner binding',()=>{
 const policy=proWalletConfig(config(),now),input=normalizeProInput(question);
 const quote=createProQuote(input,user,policy,proEnv,now);
 const verified=verifyProQuote(quote.id,input,user,quote.maxRetailNanoUsd,proEnv,now);
 assert.ok(verified.maxProviderNanoUsd>0&&verified.maxProviderNanoUsd<=policy.maxRequestProviderNanoUsd);
 assert.equal(verified.maxRetailNanoUsd,2*verified.maxProviderNanoUsd);
 assert.throws(()=>createProQuote(input,user,{...policy,maxRequestProviderNanoUsd:1},proEnv,now),error=>error.code==='REQUEST_LIMIT');
 assert.throws(()=>verifyProQuote(quote.id,input,'44000000-0000-4000-8000-000000000002',quote.maxRetailNanoUsd,proEnv,now));
 assert.throws(()=>normalizeProInput({...question,monthly_budget_mode:'uncapped'}),/Parâmetro/);
});
for(const scenario of ['no-plan','zero-allowance','master-without-plan','prepaid'])
test('G44 Pro uncapped grants no unearned plan or allowance: '+scenario,async()=>{
 const raw=config();if(scenario==='zero-allowance')raw.crypto_allowance_nano_usd=0;
 const plan=scenario==='zero-allowance'?{code:'platform-global-crypto',periodStart:new Date(now-1000).toISOString(),periodEnd:new Date(now+86400_000).toISOString()}:null;
 let providerCalls=0,reservations=0;
 const response=await handlePro(request({...question,...(scenario==='prepaid'?{source:'prepaid'}:{})}),{
  action:'quote',db:{},env:proEnv,now,planOnly:true,
  authorize:async()=>({id:user,...(scenario==='master-without-plan'?{app_metadata:{role:'master'}}:{})}),
  planResolver:async()=>plan,repository:()=>({config:async()=>proWalletConfig(raw,now),
   reserve:async()=>{reservations++;throw Error('No entitlement');}}),
  provider:async()=>{providerCalls++;throw Error('No external transport');}
 });
 assert.equal(response.status,402);assert.equal(providerCalls,0);assert.equal(reservations,0);
});
