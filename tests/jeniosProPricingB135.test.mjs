import test from 'node:test';
import assert from 'node:assert/strict';
import {PRO_PACKS,PRO_TASKS,proPackQuote,proProviderCost,validateProTask,PRO_MIN_TOPUP_CLIENT_MICRO_USD} from '../lib/assistant/pro-pricing.mjs';
const rate={rateSource:'BCB:ptax',rateAt:'2026-10-20T12:00:00.000Z',now:Date.parse('2026-10-20T12:15:00.000Z')};
test('B135 minimum JENIOS top-up is USD 10 retail, USD 5 provider budget',()=>{
 assert.equal(PRO_MIN_TOPUP_CLIENT_MICRO_USD,10_000_000);
 const q=proPackQuote('start',525,rate);
 assert.equal(q.priceCents,5250);
 assert.equal(q.upstreamCapacityMicroUsd,5_000_000);
 assert.equal(q.retailMicroUsd,10_000_000);
 assert.equal(q.productCode,'social-ai-pro-credits');
});
test('B135 only trusted, fresh BRL/USD rates can produce a checkout quote',()=>{
 for(const fx of [NaN,0,99,1.4,100001])assert.throws(()=>proPackQuote('start',fx,rate));
 assert.throws(()=>proPackQuote('start',525,{...rate,rateAt:'2026-10-01T00:00:00Z'}));
 assert.throws(()=>proPackQuote('start',525,{...rate,rateSource:'unknown'}));
 assert.throws(()=>proPackQuote('not-a-pack',525,rate));
});
test('B135 provider input/output and cached tokens are billed at exact approved tariff, sale is double',()=>{
 const a=proProviderCost({input_tokens:3000,output_tokens:600},{model:'gpt-6-luna'});
 assert.equal(a.providerCostMicroUsd,600);assert.equal(a.retailDebitMicroUsd,1200);
 const b=proProviderCost({input_tokens:3000,output_tokens:600,input_tokens_details:{cached_tokens:1000}},{model:'gpt-6-luna'});
 assert.equal(b.providerCostMicroUsd,510);assert.equal(b.retailDebitMicroUsd,1020);
 const sol=proProviderCost({input_tokens:3000,output_tokens:600},{model:'gpt-6.1-sol'});
 assert.equal(sol.providerCostMicroUsd,12000);assert.equal(sol.retailDebitMicroUsd,24000);
});
test('B135 images bill provider input tokens, tool calls are also doubled',()=>{
 const cost=proProviderCost({input_tokens:5200,output_tokens:1200},{model:'gpt-6.1-sol',tools:{web_search:1}});
 assert.equal(cost.providerCostMicroUsd,32400);
 assert.equal(cost.retailDebitMicroUsd,64800);
});
test('B135 missing usage and unquoted models/tools fail closed',()=>{
 assert.throws(()=>proProviderCost({input_tokens:100,output_tokens:100},{model:'gpt-unpriced'}));
 assert.throws(()=>proProviderCost(null,{model:'gpt-6-luna'}));
 assert.throws(()=>proProviderCost({input_tokens:100,output_tokens:100,input_tokens_details:{cached_tokens:101}},{model:'gpt-6-luna'}));
 assert.throws(()=>proProviderCost({input_tokens:100,output_tokens:100},{model:'gpt-6-luna',tools:{unknown:1}}));
});
test('B135 free functions remain separate from Pro and no client can request order execution',()=>{
 assert.ok(PRO_TASKS.chart_screenshot.acceptsImage);
 assert.ok(PRO_TASKS.opportunities.requiresCurrentData);
 assert.throws(()=>validateProTask({task:'execute_trade',prompt:'Execute uma ordem.'}));
 assert.throws(()=>validateProTask({task:'advanced_question',prompt:'Olá',admin:true}));
 const valid=validateProTask({task:'advanced_question',prompt:'Explique a metodologia da JENIOS'});
 assert.equal(valid.executionEnabled,false);assert.equal(valid.autoTrading,false);
});
test('B135 market opportunities require verifiable fresh candles (client claims are not an authorization)',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z');
 assert.throws(()=>validateProTask({task:'opportunities',prompt:'Mostre cenários'}, {now}),{status:422});
 assert.throws(()=>validateProTask({task:'market_moment',prompt:'Quero uma leitura',marketData:{verified:true,candles:Array(30).fill(1),sourceAt:'2026-10-20T12:00:00Z'}},{now}),{status:400});
 assert.throws(()=>validateProTask({task:'market_moment',prompt:'Quero uma leitura'},{now,verifiedMarketData:{verified:true,candles:Array(30).fill(1),sourceAt:'2026-10-18T12:00:00Z'}}),{status:422});
 assert.equal(validateProTask({task:'market_moment',prompt:'Quero uma leitura'},{now,verifiedMarketData:{verified:true,candles:Array(30).fill(1),sourceAt:'2026-10-20T11:59:00Z'}}).requiresCurrentData,true);
});
test('B135 photos are bounded to one private owner-held JPG, PNG or WebP, not an arbitrary URL',()=>{
 const image={mime:'image/png',byteLength:400000,width:1080,height:720,storageId:'11111111-1111-4111-8111-111111111111'};
 assert.equal(validateProTask({task:'chart_screenshot',prompt:'Analise estes candles',image}).acceptsImage,true);
 assert.throws(()=>validateProTask({task:'chart_screenshot',prompt:'Analise',image:{...image,byteLength:8000000}}));
 assert.throws(()=>validateProTask({task:'advanced_question',prompt:'Analise',image}));
});
