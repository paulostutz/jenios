import test from 'node:test';
import assert from 'node:assert/strict';
import {
 B278_PRODUCTS,B278_TARGET_HOURLY_CANDLES,B278_TRAIN_BARS,B278_EMBARGO_BARS,
 B278_HOLDOUT_BARS,buildHistoricalPlan,planRecentClosedPeriod,
 collectPublicHistoricalPlan,partitionRetrospectiveHistory,summarizeB278Collection
} from '../lib/platform/research/b278-historical-ingest.mjs';

const H=3600000,START=Date.parse('2026-08-01T00:00:00Z');
const END=START+B278_TARGET_HOURLY_CANDLES*H,ASOF=END+3*H;
const instruments=['BTC-USD','ETH-USD','SOL-USD'];
const plan=product=>buildHistoricalPlan({product,startMs:START,endMs:END,asOfMs:ASOF});
function demoBar(i,product='BTC-USD'){
 const base=product==='BTC-USD'?60000:product==='ETH-USD'?3000:100;
 const open=base+i*.2,close=open+(i%3===0?3:-1);
 return [Math.round((START+i*H)/1000),open-12,open+15,open,close,700+i];
}
function mockProvider(product,patch=()=>{}){
 const received=[];
 const fetchImpl=async (url,request)=>{
  received.push({url,request});
  const u=new URL(url),begin=Date.parse(u.searchParams.get('start')),end=Date.parse(u.searchParams.get('end'));
  const start=(begin-START)/H,count=(end-begin)/H;
  const rows=Array.from({length:count},(_,i)=>demoBar(start+i,product)).reverse();
  patch(rows,{begin,end,start,count,request,url});
  return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
 };
 return {received,fetchImpl};
}
const run=async(product='BTC-USD',patch)=>collectPublicHistoricalPlan(plan(product),{
 fetchImpl:mockProvider(product,patch).fetchImpl,pause:async()=>{},spacingMs:0
});
test('B278 restricts research to genuine USD spot instruments and exact 960 closed hourly candles',()=>{
 assert.deepEqual(B278_PRODUCTS.map(x=>x.id),instruments);
 assert.equal(B278_TARGET_HOURLY_CANDLES,960);
 assert.equal(B278_TRAIN_BARS+B278_EMBARGO_BARS+B278_HOLDOUT_BARS,960);
 const p=plan('BTC-USD');
 assert.equal(p.expectedCandles,960);assert.equal(p.quoteCurrency,'USD');
 assert.equal(p.pages.length,5);assert.ok(p.pages.every(x=>x.candles<=200));
 assert.equal(p.pages.reduce((n,x)=>n+x.candles,0),960);
 assert.ok(p.pages.every(x=>new URL(x.url).hostname==='api.exchange.coinbase.com'));
 assert.equal(p.usdtEquivalent,false);assert.equal(p.ordersAllowed,false);
 for(const product of ['BTCUSDT','BTC-USDT','ETHUSDT','SOLUSDT','RANDOM-USD'])
  assert.throws(()=>buildHistoricalPlan({product,startMs:START,endMs:END,asOfMs:ASOF}),/B278_UNSUPPORTED_SPOT_PRODUCT/);
});
test('B278 refuses future bars, fractional windows, under/overlong history and oversized request pages',()=>{
 for(const change of [
  {startMs:START+1},{endMs:END+1},{endMs:START},{endMs:END+H},
  {startMs:START+H},{asOfMs:END+H/2},{maxPageCandles:301},
  {maxPageCandles:30},{maxPageCandles:3.4},{startMs:NaN}
 ]) assert.throws(()=>buildHistoricalPlan({product:'BTC-USD',startMs:START,endMs:END,asOfMs:ASOF,...change}));
 assert.throws(()=>planRecentClosedPeriod('BTC-USD',{now:NaN}),/B278_INVALID_CLOCK/);
 const recent=planRecentClosedPeriod('SOL-USD',{now:ASOF});
 assert.equal(recent.endMs,END+H);
 assert.equal(recent.pages.length,5);
});
test('B278 public GET collector validates 960 contiguous candles and reproducible manifest without any order',async()=>{
 const provider=mockProvider('BTC-USD');
 const pauseTimes=[];
 const result=await collectPublicHistoricalPlan(plan('BTC-USD'),{
  fetchImpl:provider.fetchImpl,pause:async ms=>{pauseTimes.push(ms);},spacingMs:450});
 assert.deepEqual(pauseTimes,[450,450,450,450]);
 assert.equal(provider.received.length,5);
 assert.ok(provider.received.every(x=>x.request.method==='GET'&&x.request.redirect==='error'&&
  x.request.headers.Accept==='application/json'));
 assert.equal(result.candles.length,960);
 assert.equal(result.candles[0].t,START);
 assert.equal(result.candles.at(-1).t,END-H);
 assert.equal(result.manifest.received,960);
 assert.equal(result.manifest.duplicate,0);
 assert.equal(result.manifest.missing,0);
 assert.equal(result.manifest.zeroVolume,0);
 assert.equal(result.manifest.dataQualityChecksPassed,true);
 assert.equal(result.manifest.source,'coinbase_exchange_public_spot_candles');
 assert.equal(result.manifest.sourceLicenseIndependentlyReviewed,false);
 assert.equal(result.manifest.httpTransportSigned,false);
 assert.equal(result.manifest.eligibleForPreliminaryResearchOnly,true);
 assert.equal(result.manifest.eligibleForProductionSignals,false);
 assert.equal(result.manifest.ordersSent,0);
 assert.match(result.manifest.candlesSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.manifest.pages.length,5);
 assert.deepEqual(result.manifest.pages.map(x=>x.count),[200,200,200,200,160]);
 assert.ok(result.manifest.pages.every(x=>x.sha256.length===64));
 const r2=await run();
 assert.equal(r2.manifest.candlesSha256,result.manifest.candlesSha256);
 assert.deepEqual(result.candles,r2.candles);
});
test('B278 missing provider bars fail closed; a 959 bar response cannot become complete',async()=>{
 await assert.rejects(run('BTC-USD',rows=>{rows.pop()}),/B278_PROVIDER_MISSING_CANDLE/);
 await assert.rejects(run('BTC-USD',rows=>{rows.splice(4,1)}),/B278_PROVIDER_MISSING_CANDLE/);
 await assert.rejects(run('BTC-USD',rows=>{rows[5]=rows[6]}),/B278_DUPLICATE_PROVIDER_CANDLE/);
});
test('B278 invalid OHLCV, negative volume, corrupted timestamps and extreme ranges fail closed',async()=>{
 const changes=[
  rows=>{rows[0][3]=0},
  rows=>{rows[0][4]=NaN},
  rows=>{rows[0][5]=-4},
  rows=>{rows[0][2]=rows[0][1]-1},
  rows=>{rows[0][1]=0.01;rows[0][2]=100000},
  rows=>{rows[0][0]+=1}
 ];
 for(const patch of changes)await assert.rejects(run('ETH-USD',patch),/B278_/);
});
test('B278 disallows mutation of allowed domains or data-collection plan via injected URLs',async()=>{
 const p=plan('SOL-USD');
 const modified={...p,pages:[{...p.pages[0],url:'https://evil.example.invalid/products/SOL-USD/candles'},...p.pages.slice(1)]};
 await assert.rejects(collectPublicHistoricalPlan(modified,{fetchImpl:mockProvider('SOL-USD').fetchImpl,pause:async()=>{},spacingMs:0}),/B278_SOURCE_URL_CHANGED/);
 const wrongQuote={...p,quoteCurrency:'USDT'};
 await assert.rejects(collectPublicHistoricalPlan(wrongQuote,{fetchImpl:mockProvider('SOL-USD').fetchImpl,pause:async()=>{},spacingMs:0}),/B278_INVALID_INTAKE_PLAN/);
});
test('B278 network failure, HTTP 429, HTTP 500, bad response and invalid JSON refuse silent acceptance',async()=>{
 const settings={pause:async()=>{},spacingMs:0};
 for(const [fetchImpl,reason] of [
  [async()=>{throw Error('timeout')},'B278_PUBLIC_PROVIDER_NETWORK_UNAVAILABLE'],
  [async()=>new Response('{}',{status:429}),'B278_PUBLIC_PROVIDER_RATE_LIMITED'],
  [async()=>new Response('{}',{status:500}),'B278_PUBLIC_PROVIDER_HTTP_FAILED'],
  [async()=>new Response('not json',{status:200}),'B278_PUBLIC_PROVIDER_INVALID_JSON'],
  [async()=>new Response('{}',{status:200}),'B278_INVALID_PROVIDER_BATCH']
 ])await assert.rejects(collectPublicHistoricalPlan(plan('BTC-USD'),{...settings,fetchImpl}),new RegExp(reason));
});
test('B278 rejects widespread no-tick bars and atypically flat data even when contiguous',async()=>{
 await assert.rejects(run('SOL-USD',(rows,{start})=>{
  // Create >96 consecutive bars of 0 volume across five page windows.
  rows.forEach((r,i)=>{if(start+i<99)r[5]=0;});
 }),/B278_SUSPECT_DATA_QUALITY/);
 await assert.rejects(run('SOL-USD',rows=>{
  rows.forEach(r=>{r[1]=r[2]=r[3]=r[4];});
 }),/B278_SUSPECT_DATA_QUALITY/);
});
test('B278 chronological partition totals 600 training + 48 embargo + 312 holdout, all USD and not prospectively certified',async()=>{
 const snap=await run('BTC-USD'),p=partitionRetrospectiveHistory(snap);
 assert.equal(p.training.count,600);assert.equal(p.embargo.count,48);assert.equal(p.historicalHoldout.count,312);
 assert.equal(p.training.endMs,p.embargo.startMs);
 assert.equal(p.embargo.endMs,p.historicalHoldout.startMs);
 assert.equal(p.historicalHoldout.endMs,END);
 assert.equal(p.futureProspectiveStartsAtMs,END);
 assert.equal(p.preRegisteredBeforeHoldout,false);
 assert.equal(p.splitDesignedAfterHistoricalObservation,true);
 assert.equal(p.historicalOosNotYetEvaluated,true);
 assert.equal(p.b272DirectCompatibility,false);
 assert.equal(p.pairIsUsdNotUsdt,true);
 assert.equal(p.ordersSent,0);
 await assert.rejects(async()=>partitionRetrospectiveHistory({...snap,candles:snap.candles.slice(1)}),/B278_NOT_VERIFIED_LOCAL_SNAPSHOT/);
});
test('B278 BTC, ETH, SOL share the same historical window, but never unlock proprietary USD/USDT adapter',async()=>{
 const results=await Promise.all(instruments.map(x=>run(x)));
 const x=summarizeB278Collection(results);
 assert.equal(x.rows.length,3);
 assert.equal(x.threeAssetsQualityPassed,true);
 assert.equal(x.assetCurrency,'USD');
 assert.equal(x.canMapToUsdtRobot,false);
 assert.equal(x.realBacktestPerformed,false);
 assert.equal(x.prospectiveProof,false);
 assert.equal(x.providerAttestation,false);
 assert.equal(x.ordersSent,0);
 const alternate=await collectPublicHistoricalPlan(
  buildHistoricalPlan({product:'SOL-USD',startMs:START+H,endMs:END+H,asOfMs:ASOF+H}),
  {fetchImpl:async()=>new Response(JSON.stringify(Array.from({length:200},()=>demoBar(1))),{status:200}),pause:async()=>{},spacingMs:0}
 ).catch(()=>null);
 assert.equal(alternate,null); // a mismatched or duplicated candle is rejected before comparison.
 assert.throws(()=>summarizeB278Collection([results[0],results[1],results[1]]),/B278_THREE_SPOT_PRODUCTS_REQUIRED/);
});
