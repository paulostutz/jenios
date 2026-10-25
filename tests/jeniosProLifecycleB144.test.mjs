import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {normalizeProInput,createProQuote,verifyProQuote,validateProImage} from '../lib/assistant/pro-input.mjs';
import {invokeProProvider,loadProMarket} from '../lib/assistant/pro-provider.mjs';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';
import {projectProStatus,proRepository} from '../lib/assistant/pro-repository.mjs';
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const key='33333333-3333-4333-8333-333333333333';
const now=Date.parse('2026-10-20T12:00:00Z');
const env={JENIOS_PRO_GENERATION_ENABLED:'true',OPENAI_API_KEY:'fictitious-key-not-a-real-credential',JENIOS_PRO_QUOTE_SECRET:'test-only-signing-material-never-production'};
const input={persona:'genia',task:'advanced_question',prompt:'Como estudar o risco?',source:'prepaid'};
const config={installed:true,generationEnabled:true,allowedModels:['gpt-6-luna','gpt-6.1-sol'],maxRequestProviderNanoUsd:1_000_000_000,allowances:{'platform-global-crypto':2_000_000_000}};
const request=body=>new Request('https://jenios.test/api/assistant/pro/chat',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic'},body:JSON.stringify(body)});
function harness({enabled=true,sourceFailure=false,providerResult=null}={}){
 const rows=new Map();let calls=0,held=0,charged=0,dispatches=0;
 const ledger={wallet:{status:'verified',totalNanoUsd:10_000_000_000,reservedNanoUsd:0,availableNanoUsd:10_000_000_000},allowance:{status:'configured',totalNanoUsd:2_000_000_000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:2_000_000_000,periodEnd:'2026-11-01T00:00:00Z'}};
 const repo={
  config:async()=>({...config,generationEnabled:enabled}),status:async()=>({ok:true,...ledger,pendingRequests:0}),
  request:async k=>rows.get(k)||null,history:async()=>({items:[],hasMore:false}),
  reserve:async(i,q,k)=>{
   if(rows.has(k))return {ok:true,replayed:true,state:rows.get(k).state,requestId:k};
   rows.set(k,{id:k,user_id:user,request_key:k,fingerprint:i.fingerprint,task:i.task,source:i.source,state:'reserved',charged_nano_usd:0,provider_nano_usd:0,created_at:new Date(now).toISOString()});held=q.maxRetailNanoUsd;
   return {ok:true,state:'reserved',requestId:k};
  },
  dispatch:async(i,k)=>{const r=rows.get(k);if(r.state!=='reserved')return {ok:true,acquired:false,state:r.state};r.state='dispatched';dispatches++;return {ok:true,acquired:true,state:r.state};},
  settle:async(i,k,result)=>{const r=rows.get(k);r.state='settled';r.charged_nano_usd=result.cost.retailDebitNanoUsd;r.provider_nano_usd=result.cost.providerCostNanoUsd;r.result_data=result.result;charged+=r.charged_nano_usd;held=0;return {ok:true};},
  reconcile:async(i,k,action,evidence)=>{assert.equal(typeof evidence,'object');const r=rows.get(k);if(action==='confirmed_no_charge'){assert.equal(evidence.verified,true);r.state='released';held=0;}else r.state='needs_reconciliation';return {ok:true};},
  release:async(i,k)=>{rows.get(k).state='released';held=0;return {ok:true};}
 };
 const options={db:{},now,env,authorize:async()=>({id:user}),repository:()=>repo,planResolver:async()=>null,passResolver:async()=>null,marketLoader:async()=>{if(sourceFailure)throw Object.assign(Error('Fonte indisponível'),{status:422});return null;},provider:async()=>{calls++;return providerResult||{kind:'usage_confirmed',providerResponseId:'resp_example',usage:{input_tokens:1,output_tokens:0},cost:{providerCostNanoUsd:100,retailDebitNanoUsd:200},result:{answer:'Estude limites e risco.',persona:'genia',source:null}};}};
 const quote=createProQuote(normalizeProInput(input),user,config,env,now);
 const body={...input,requestKey:key,quoteId:quote.id,consent:true,maxRetailNanoUsd:quote.maxRetailNanoUsd};
 return {options,repo,body,rows,stats:()=>({calls,held,charged,dispatches})};
}
test('B144 signed quote binds person, exact input, source, ceiling, tariff and expiration',()=>{
 const n=normalizeProInput(input),q=createProQuote(n,user,config,env,now);
 assert.equal(verifyProQuote(q.id,n,user,q.maxRetailNanoUsd,env,now).version,PRO_PRICING_VERSION);
 assert.throws(()=>verifyProQuote(q.id,n,other,q.maxRetailNanoUsd,env,now));
 assert.throws(()=>verifyProQuote(q.id,normalizeProInput({...input,prompt:'Outro pedido'}),user,q.maxRetailNanoUsd,env,now));
 assert.throws(()=>verifyProQuote(q.id,n,user,q.maxRetailNanoUsd+1,env,now));
 assert.throws(()=>verifyProQuote(q.id,n,user,q.maxRetailNanoUsd,env,now+300001));
 assert.throws(()=>verifyProQuote(q.id+'x',n,user,q.maxRetailNanoUsd,env,now));
});
test('B144 disabled generation, missing consent and absent identity never reach ledger/provider',async()=>{
 const h=harness({enabled:false});
 let r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,503);assert.equal((await r.json()).state,'not_started');
 assert.deepEqual(h.stats(),{calls:0,held:0,charged:0,dispatches:0});
 const a=harness();r=await handlePro(request({...a.body,consent:false}),{...a.options,action:'chat'});assert.equal(r.status,400);
 r=await handlePro(request(a.body),{...a.options,action:'chat',authorize:async()=>({id:user,is_anonymous:true})});assert.equal(r.status,401);assert.equal(a.stats().calls,0);
});
test('B144 quote is read-only and reserves nothing',async()=>{
 const h=harness();const r=await handlePro(request(input),{...h.options,action:'quote'});
 assert.equal(r.status,200);assert.ok((await r.json()).quote.maxRetailNanoUsd>0);assert.equal(h.rows.size,0);assert.equal(h.stats().calls,0);
});
test('B144 user cannot use included credit without a valid eligible plan',async()=>{
 const h=harness();const r=await handlePro(request({...input,source:'included'}),{...h.options,action:'quote'});
 assert.equal(r.status,402);assert.equal(h.rows.size,0);assert.equal(h.stats().calls,0);
});
test('B144 successful request settles exact 2x sub-micro cost and repeat returns existing answer',async()=>{
 const h=harness();let r=await handlePro(request(h.body),{...h.options,action:'chat'}),b=await r.json();
 assert.equal(r.status,200);assert.equal(b.chargedNanoUsd,200);assert.equal(b.providerNanoUsd,100);assert.equal(b.state,'settled');
 r=await handlePro(request(h.body),{...h.options,action:'chat'});b=await r.json();assert.equal(b.replayed,true);assert.equal(b.answer,'Estude limites e risco.');
 assert.deepEqual(h.stats(),{calls:1,held:0,charged:200,dispatches:1});
});
test('B144 concurrent retries dispatch the same provider operation once',async()=>{
 const h=harness();const results=await Promise.all([handlePro(request(h.body),{...h.options,action:'chat'}),handlePro(request(h.body),{...h.options,action:'chat'})]);
 assert.equal(h.stats().calls,1);assert.equal(h.stats().charged,200);assert.ok(results.every(r=>[200,202].includes(r.status)));
});
test('B144 source failure happens before reservation and provider calls',async()=>{
 const h=harness({sourceFailure:true});const r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,422);assert.equal(h.rows.size,0);assert.equal(h.stats().calls,0);
});
test('B144 unknown provider usage keeps hold and repeat never generates again',async()=>{
 const h=harness({providerResult:{kind:'unknown',reason:'TIMEOUT'}});let r=await handlePro(request(h.body),{...h.options,action:'chat'});
 assert.equal(r.status,202);assert.equal((await r.json()).state,'needs_reconciliation');assert.ok(h.stats().held>0);assert.equal(h.stats().charged,0);
 await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(h.stats().calls,1);
});
test('B144 token preflight never generates and confirmed hold release is visible',async()=>{
 const h=harness({providerResult:{kind:'not_generated',reason:'TOKEN_PREFLIGHT_REJECTED'}});
 const r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,503);assert.equal((await r.json()).state,'released');assert.equal(h.stats().held,0);assert.equal(h.stats().charged,0);
});
test('B144 unknown ledger settlement does not show a successful bill',async()=>{
 const h=harness();h.repo.settle=async()=>{throw Error('lost DB response');};
 const r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,202);assert.equal((await r.json()).state,'needs_reconciliation');assert.equal(h.stats().calls,1);assert.equal(h.rows.get(key).state,'needs_reconciliation');
});
test('B144 rejected dispatch releases an unused hold and never invokes a model',async()=>{
 const h=harness();h.repo.dispatch=async()=>({ok:false,code:'GENERATION_DISABLED'});
 const r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,503);assert.equal((await r.json()).state,'released');assert.deepEqual(h.stats(),{calls:0,held:0,charged:0,dispatches:0});
});
test('B144 lost dispatch response records a durable unknown without resending or releasing',async()=>{
 const h=harness(),dispatch=h.repo.dispatch;h.repo.dispatch=async(...args)=>{await dispatch(...args);throw Error('lost response');};
 const r=await handlePro(request(h.body),{...h.options,action:'chat'});assert.equal(r.status,202);assert.equal(h.rows.get(key).state,'needs_reconciliation');assert.equal(h.stats().calls,0);assert.ok(h.stats().held>0);
});
test('B144 ledger status is projected into verified balances without leaking internal configuration',()=>{
 const s=projectProStatus({ok:true,config:{private_setting:'never expose'},wallet:{balanceNanoUsd:'10000',reservedNanoUsd:'200',availableNanoUsd:'9800'},included:{totalNanoUsd:'5000',spentNanoUsd:'100',reservedNanoUsd:'200',availableNanoUsd:'4700',periodEnd:'2026-11-01T00:00:00Z'},pendingRequestCount:'1'});
 assert.equal(s.wallet.status,'verified');assert.equal(s.wallet.availableNanoUsd,9800);assert.equal(s.allowance.status,'configured');assert.equal(s.pendingRequests,1);assert.equal(s.config,undefined);
 assert.throws(()=>projectProStatus({ok:true,wallet:{balanceNanoUsd:100,reservedNanoUsd:10,availableNanoUsd:100}}));
 assert.equal(projectProStatus({ok:true,wallet:{balanceNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:0}}).allowance.status,'not_included');
});
test('B144 confirmed no-generation reconciliation supplies explicit zero to the financial RPC',async()=>{
 let call;const repo=proRepository({rpc:async(name,args)=>{call={name,args};return {data:{ok:true}};}},user);
 await repo.reconcile(normalizeProInput(input),key,'confirmed_no_charge',{verified:true});assert.equal(call.args.p_provider_nano_usd,0);assert.equal(call.args.p_user_id,user);
 await repo.reconcile(normalizeProInput(input),key,'mark_unknown',{reason:'unknown'});assert.equal(call.args.p_provider_nano_usd,null);
});
test('B144 raw external URLs, private keys, unknown actions and malformed image bytes are rejected',()=>{
 for(const body of [{...input,admin:true},{...input,prompt:'api_key=sk_sensitive_value_12345'},{...input,task:'execute_order'},{...input,task:'constructor'},{...input,task:'toString'},{...input,image:{url:'http://169.254.169.254'}},{...input,task:'chart_screenshot'}])assert.throws(()=>normalizeProInput(body));
 assert.throws(()=>validateProImage({mime:'image/png',base64:Buffer.from('<svg>not PNG</svg>').toString('base64')}));
});
test('B144 provider exact token count enforces upper bound, default tier, no tools, no auto retry',async()=>{
 const n=normalizeProInput(input),q={maxInputTokens:16384,maxOutputTokens:2000};let calls=[];
 const fetcher=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(url.endsWith('input_tokens')?{object:'response.input_tokens',input_tokens:100}:{id:'resp_confirmed',model:'gpt-6-luna',service_tier:'default',status:'completed',usage:{input_tokens:100,output_tokens:1,input_tokens_details:{cached_tokens:0,cache_write_tokens:100}},output:[{type:'message',status:'completed',content:[{type:'output_text',text:'Resposta informativa.'}]}]});};
 const result=await invokeProProvider(n,q,null,{env,fetcher});assert.equal(result.kind,'usage_confirmed');assert.equal(result.cost.retailDebitNanoUsd,26000);assert.equal(calls.length,2);assert.equal(calls[1].body.store,false);assert.equal(calls[1].body.service_tier,'default');assert.deepEqual(calls[1].body.tools,[]);
 const rejected=await invokeProProvider(n,q,null,{env,fetcher:async()=>Response.json({object:'response.input_tokens',input_tokens:999999})});assert.equal(rejected.kind,'not_generated');
});
test('B144 unpriced provider tier or billed tool output is held for reconciliation',async()=>{
 const n=normalizeProInput(input);let i=0;
 const r=await invokeProProvider(n,{maxInputTokens:16384,maxOutputTokens:2000},null,{env,fetcher:async()=>Response.json(++i===1?{object:'response.input_tokens',input_tokens:100}:{id:'resp_wrong_tier',model:n.model,service_tier:'priority',status:'completed',output:[],usage:{input_tokens:100,output_tokens:1}})});
 assert.equal(r.kind,'unknown');
});
test('B144 market adapter refuses stale or missing candles without inventing a series',async()=>{
 // Adapter remains guarded for historical integrations; G49 image tasks never request it.
 const n={requiresCurrentData:true,symbol:'BTC-USD',timeframe:'1m'};
 await assert.rejects(loadProMarket(n,{now,fetcher:async()=>Response.json([])}),{code:'MARKET_UNAVAILABLE'});
 assert.equal(await loadProMarket(normalizeProInput(input),{now,fetcher:()=>{throw Error('not used');}}),null);
});
