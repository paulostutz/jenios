import test from 'node:test';
import assert from 'node:assert/strict';
import {PRO_PRICING_VERSION,PRO_PACKS,proPackQuote,proProviderCost} from '../lib/assistant/pro-pricing.mjs';
import {ledgerInteger,nanoUsdDecimal,proWalletConfig,proReservationMaximum,approvedProTopupQuote} from '../lib/assistant/pro-wallet-contract.mjs';
const NOW=Date.parse('2026-10-20T12:15:00Z');
const FX={brlMicrosPerUsd:5_250_000,source:'BCB:ptax',sourceAt:'2026-10-20T12:00:00Z'};
const cost=(usage,extra={})=>proProviderCost(usage,{model:'gpt-6-luna',...extra});
test('B142 one-token costs keep fractions of a microUSD and exactly 2x in integer nanoUSD',()=>{
 for(const [usage,nano] of [
  [{input_tokens:1,output_tokens:0},100],
  [{input_tokens:1,output_tokens:0,input_tokens_details:{cached_tokens:1}},10],
  [{input_tokens:1,output_tokens:0,input_tokens_details:{cache_write_tokens:1}},125],
  [{input_tokens:0,output_tokens:1},500]
 ]){
  const r=cost(usage);assert.equal(r.providerCostNanoUsd,nano);assert.equal(r.retailDebitNanoUsd,nano*2);
  assert.equal(r.providerCostMicroUsd,nano/1000);assert.ok(Number.isSafeInteger(r.retailDebitNanoUsd));
 }
 assert.equal(nanoUsdDecimal(250),'0.000000250');
});
test('B142 separately billed normal, cache-read, cache-write and output tokens are disjoint',()=>{
 const r=cost({input_tokens:3,output_tokens:1,input_tokens_details:{cached_tokens:1,cache_write_tokens:1}});
 assert.equal(r.providerCostNanoUsd,735);assert.equal(r.retailDebitNanoUsd,1470);
 assert.equal(r.cacheWriteInputTokens,1);
 assert.throws(()=>cost({input_tokens:2,output_tokens:0,input_tokens_details:{cached_tokens:2,cache_write_tokens:1}}));
 assert.throws(()=>cost({input_tokens:1,output_tokens:0,input_tokens_details:{cache_write_tokens:-1}}));
 const sol=cost({input_tokens:1,output_tokens:0,input_tokens_details:{cache_write_tokens:1}},{model:'gpt-6.1-sol'});
 assert.equal(sol.providerCostNanoUsd,2500);assert.equal(sol.retailDebitNanoUsd,5000);
});
test('B142 splitting tiny requests does not create cumulative rounding charges',()=>{
 const tiny=cost({input_tokens:1,output_tokens:0,input_tokens_details:{cached_tokens:1}});
 const bulk=cost({input_tokens:10000,output_tokens:0,input_tokens_details:{cached_tokens:10000}});
 assert.equal(tiny.providerCostNanoUsd*10000,bulk.providerCostNanoUsd);
 assert.equal(tiny.retailDebitNanoUsd*10000,bulk.retailDebitNanoUsd);
});
test('B142 every quoted tool is included in precise 2x debit; unsupported usage fails closed',()=>{
 const r=cost({input_tokens:1,output_tokens:0},{tools:{web_search:1,file_search:1}});
 assert.equal(r.providerCostNanoUsd,12_500_100);assert.equal(r.retailDebitNanoUsd,25_000_200);
 assert.throws(()=>cost({input_tokens:1,output_tokens:0},{tools:null}));
 assert.throws(()=>cost({input_tokens:1,output_tokens:0},{tools:{web_search:0.1}}));
 assert.throws(()=>cost({input_tokens:1,output_tokens:0},{tools:{unpriced:1}}));
 for(const n of [1.5,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>cost({input_tokens:n,output_tokens:0}));
});
test('B142 reservation covers higher-priced cache writes, settlement remains actual usage',()=>{
 const r=proReservationMaximum({model:'gpt-6-luna',maxInputTokens:1000,maxOutputTokens:100});
 assert.equal(r.providerNanoUsd,175000);assert.equal(r.retailNanoUsd,350000);assert.equal(r.pricingVersion,PRO_PRICING_VERSION);
 const actual=cost({input_tokens:1000,output_tokens:100});
 assert.ok(r.providerNanoUsd>=actual.providerCostNanoUsd);
});
test('B142 integer decoding rejects rounded, fractional, exponent and negative ledger values',()=>{
 assert.equal(ledgerInteger('1000000000000000'),1_000_000_000_000_000);
 for(const value of ['1e6',' 1','1.5','-1','9007199254740993',null,undefined,NaN,0.1])assert.throws(()=>ledgerInteger(value));
});
test('B142 B135 legacy package proposals are explicitly not authorized purchases',()=>{
 for(const p of PRO_PACKS){assert.equal(p.proposed,true);assert.equal(p.purchaseAuthorized,false);}
 const p=proPackQuote('start',525,{rateSource:'BCB:ptax',rateAt:FX.sourceAt,now:NOW});
 assert.equal(p.purchaseAuthorized,false);assert.equal(p.approvalRequired,true);
 assert.throws(()=>approvedProTopupQuote({enabled:true},FX,NOW));
});
test('B142 explicit BRL and USD package approvals produce exact immutable snapshots',()=>{
 const brl=approvedProTopupQuote({enabled:true,baseCurrency:'BRL',amountMinor:1000,termsVersion:'test-only-brl'},FX,NOW);
 assert.equal(brl.amountCents,1000);assert.equal(brl.retailNanoUsd,1_904_761_904);assert.equal(brl.currency,'BRL');
 const usd=approvedProTopupQuote({enabled:true,baseCurrency:'USD',amountMinor:1000,termsVersion:'test-only-usd'},FX,NOW);
 assert.equal(usd.amountCents,5250);assert.equal(usd.retailNanoUsd,10_000_000_000);assert.equal(usd.baseCurrency,'USD');
 assert.ok(Object.isFrozen(usd));
 for(const policy of [{enabled:false,baseCurrency:'BRL',amountMinor:1000,termsVersion:'test'},
  {enabled:true,baseCurrency:'EUR',amountMinor:1000,termsVersion:'test'},
  {enabled:true,baseCurrency:'BRL',amountMinor:0,termsVersion:'test'}])assert.throws(()=>approvedProTopupQuote(policy,FX,NOW));
 assert.throws(()=>approvedProTopupQuote({enabled:true,baseCurrency:'BRL',amountMinor:1000,termsVersion:'test'}, {...FX,source:'client'},NOW));
 assert.throws(()=>approvedProTopupQuote({enabled:true,baseCurrency:'BRL',amountMinor:1000,termsVersion:'test'}, {...FX,sourceAt:'2026-09-01T12:00:00Z'},NOW));
});
const config={id:true,generation_enabled:false,payments_enabled:false,requires_reconciliation:false,pricing_version:null,
 pricing_approved:false,rates_verified_at:null,allowed_models:[],monthly_provider_limit_nano_usd:0,max_request_provider_nano_usd:0,
 crypto_allowance_nano_usd:0,global_allowance_nano_usd:0,topup_currency:null,topup_amount_minor:null,commercial_terms_version:null};
test('B142 deployment defaults do not grant allowances, sell packages or enable paid generation',()=>{
 const r=proWalletConfig(config,NOW);assert.equal(r.generationEnabled,false);assert.equal(r.topupsEnabled,false);
 assert.deepEqual(Object.values(r.allowances),[0,0]);assert.equal(r.topup.confirmed,false);
 assert.equal(proWalletConfig(null,NOW).installed,false);
});
test('B142 approval, limits, rate freshness and reconciliation are independent generation gates',()=>{
 const approved={...config,generation_enabled:true,pricing_version:PRO_PRICING_VERSION,pricing_approved:true,
  rates_verified_at:FX.sourceAt,allowed_models:['gpt-6-luna'],monthly_provider_limit_nano_usd:1_000_000_000,max_request_provider_nano_usd:1_000_000};
 assert.equal(proWalletConfig(approved,NOW).generationEnabled,true);
 for(const patch of [{pricing_approved:false},{rates_verified_at:'2026-08-01T00:00:00Z'},
  {rates_verified_at:'2026-10-21T00:00:00Z'},{requires_reconciliation:true},{allowed_models:[]},
  {pricing_version:'old'},{monthly_provider_limit_nano_usd:0},{max_request_provider_nano_usd:0}])
  assert.equal(proWalletConfig({...approved,...patch},NOW).generationEnabled,false);
});
