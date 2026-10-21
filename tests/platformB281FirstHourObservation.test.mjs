import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 auditB281OriginalSeal,readinessB281OriginalHour,
 B281_B280_ANCHOR,b281HistoricalCandleUrl,parseB281PublicClosedHour,
 fetchB281ReadOnlyOutcome,evaluateB281ObservedClosedHour
} from '../lib/platform/research/b281-first-hour-observation.mjs';
import {B280_FROZEN_PROTOCOL} from '../lib/platform/research/b280-forward-protocol.mjs';
const bundle=JSON.parse(readFileSync(new URL('../docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json',import.meta.url),'utf8'));
const H=3600000,OPEN=B281_B280_ANCHOR.targetOpenMs,CLOSE=B281_B280_ANCHOR.targetCloseMs;
const READY=B281_B280_ANCHOR.minimumObservationAtMs;
const PRODUCTS=['BTC-USD','ETH-USD','SOL-USD'];
const basePrice=Object.fromEntries(PRODUCTS.map((id,i)=>[id,[83700,3500,100][i]]));
const fixture=(product)=>{const o=basePrice[product];return [OPEN/1000,o*.97,o*1.03,o,o*1.004,14000];};
const makeData=({change,recordAt=READY}={})=>PRODUCTS.map(product=>{
 const rows=[fixture(product),[(OPEN+H)/1000,1,2,1.4,1.5,33]];
 change?.(rows,product);
 return parseB281PublicClosedHour(rows,{product,observedAtMs:recordAt});
});
test('B281 exact 18 forecast entries from frozen B280 public artifact, not regenerated',()=>{
 const checked=auditB281OriginalSeal(bundle);
 assert.equal(checked.valid,true);
 assert.equal(checked.sealSha256,'3261fc220699d41c2e07ffd76f8d774b76ff9fd506ffed3e1ac066c2ec23f912');
 assert.equal(bundle.sealedResearch.githubCommit,'e5c9671c3e926b380cef91ba5f21c22d59ac22de');
 assert.equal(bundle.sealedResearch.githubWorkflowRunId,39625425333);
 assert.equal(bundle.sealedResearch.forecasts.length,18);
 assert.equal(bundle.sealedResearch.protocolSha256,B280_FROZEN_PROTOCOL.sha256);
 assert.equal(bundle.sealedResearch.receivedAtMs,1792596302989);
 assert.equal(bundle.sealedResearch.targetCandleOpenMs,OPEN);
 assert.equal(bundle.sealedResearch.targetCandleEndMs,CLOSE);
 assert.equal(bundle.sealedResearch.forecasts.every(x=>x.brokerOrderId===null&&x.isTradeSignal===false),true);
});
test('B281 refuses regenerated, corrected, unsealed or mixed-asset forecasts',()=>{
 const patches=[
  {status:'SOME_OTHER_STATUS'},
  {githubCommit:'0'.repeat(40)},
  {workflowRunId:100},
  {sealedResearch:{...bundle.sealedResearch,receivedAtMs:READY}},
  {sealedResearch:{...bundle.sealedResearch,targetCandleEndMs:CLOSE+H}},
  {sealedResearch:{...bundle.sealedResearch,forecasts:bundle.sealedResearch.forecasts.slice(1)}},
  {sealedResearch:{...bundle.sealedResearch,forecasts:[{...bundle.sealedResearch.forecasts[0],researchDirection:'DOWN'},...bundle.sealedResearch.forecasts.slice(1)]}}
 ];
 for(const patch of patches)assert.throws(()=>auditB281OriginalSeal({...bundle,...patch}),/B281_ORIGINAL_B280_SEAL_NOT_ANCHORED/);
});
test('B281 explicit time gate prevents response before completion and five-minute grace',()=>{
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:OPEN}).status,'PENDING_TARGET_CANDLE_CLOSE');
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:CLOSE-1}).candidateMayFetch,false);
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:CLOSE}).status,'PENDING_FIVE_MINUTE_SAFETY_WINDOW');
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:READY-1}).candidateMayFetch,false);
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:READY}).status,'READY_FOR_READ_ONLY_SOURCE_QUERY');
 assert.equal(readinessB281OriginalHour(bundle,{nowMs:READY}).outcomeAlreadyVerified,false);
 assert.throws(()=>readinessB281OriginalHour(bundle,{nowMs:NaN}),/B281_INVALID_OBSERVATION_CLOCK/);
});
test('B281 public URLs request only the original UTC target candle and its adjacent completed boundary',()=>{
 for(const product of PRODUCTS){
  const q=new URL(b281HistoricalCandleUrl(product));
  assert.equal(q.origin,'https://api.exchange.coinbase.com');
  assert.equal(q.pathname,'/products/'+product+'/candles');
  assert.equal(q.searchParams.get('granularity'),'3600');
  assert.equal(q.searchParams.get('start'),new Date(OPEN).toISOString());
  assert.equal(q.searchParams.get('end'),new Date(CLOSE+H).toISOString());
 }
 for(const id of ['BTCUSDT','BTC-USDT','ETHUSDT','XRP-USD'])
  assert.throws(()=>b281HistoricalCandleUrl(id),/B281_UNSUPPORTED_USD_SPOT_PRODUCT/);
});
test('B281 rejects fetching before the actual target closes without making network calls',async()=>{
 let network=0;
 const fetchImpl=async()=>{network++;throw Error('should never hit network');};
 for(const instant of [OPEN-1,OPEN,CLOSE-1,CLOSE,READY-1])
  await assert.rejects(fetchB281ReadOnlyOutcome(bundle,{nowMs:instant,fetchImpl}),/B281_OUTCOME_NOT_READY_FOR_FETCH/);
 assert.equal(network,0);
});
test('B281 future read-only provider returns exactly three verified target buckets, GET only',async()=>{
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});
  const name=new URL(url).pathname.split('/')[2];
  const target=fixture(name);
  const next=[(OPEN+H)/1000,4,10,6,7,15];
  return new Response(JSON.stringify([next,target]),{status:200});
 };
 const rows=await fetchB281ReadOnlyOutcome(bundle,{nowMs:READY,fetchImpl,pause:async()=>{}});
 assert.equal(rows.length,3);assert.deepEqual(rows.map(x=>x.product),PRODUCTS);
 assert.equal(calls.length,3);
 assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='error'&&x.options.cache==='no-store'&&
 x.options.headers.Accept==='application/json'));
 assert.ok(rows.every(x=>x.targetStartMs===OPEN&&x.targetClosedAtMs===CLOSE&&
  x.quoteCurrency==='USD'&&x.sourceSigned===false&&x.candleSha256.length===64));
});
test('B281 malformed provider candle, duplicate target, wrong time, bad OHLCV or missing bar fail closed',()=>{
 const good=fixture('BTC-USD');
 const invalid=[
  [],[good,good],
  [[(OPEN+H)/1000,1,5,2,3,10]],
  [[...good.slice(0,5),-1]],
  [[good[0],0,good[2],good[3],good[4],good[5]]],
  [[good[0],good[1],good[2],-1,good[4],good[5]]],
  [[good[0]+1,...good.slice(1)]],
  [good.slice(0,5)],
  [[good[0],good[1],good[2],good[3],Infinity,good[5]]]
 ];
 for(const rows of invalid)
  assert.throws(()=>parseB281PublicClosedHour(rows,{product:'BTC-USD',observedAtMs:READY}),/B281_/);
 assert.throws(()=>parseB281PublicClosedHour([good],{product:'BTC-USD',observedAtMs:READY-1}),/B281_TOO_EARLY_TO_READ_TARGET/);
});
test('B281 HTTP/network/rate-limit/JSON errors never become positive results',async()=>{
 for(const [fetchImpl,reason] of [
  [async()=>{throw Error('no network')},'B281_COINBASE_PUBLIC_NETWORK_UNAVAILABLE'],
  [async()=>new Response('rate limited',{status:429}),'B281_COINBASE_PUBLIC_RATE_LIMITED'],
  [async()=>new Response('{}',{status:500}),'B281_COINBASE_PUBLIC_HTTP_FAILURE'],
  [async()=>new Response('garbage',{status:200}),'B281_COINBASE_PUBLIC_INVALID_JSON'],
  [async()=>new Response('{}',{status:200}),'B281_INVALID_PUBLIC_CANDLE_PAYLOAD']
 ]) await assert.rejects(fetchB281ReadOnlyOutcome(bundle,{nowMs:READY,fetchImpl,pause:async()=>{}}),new RegExp(reason));
});
test('B281 cannot score prior to 17:05 UTC, cannot accept duplicated or spoofed quote',()=>{
 const input=makeData();
 for(const nowMs of [OPEN,CLOSE-1,CLOSE,READY-1])
  assert.throws(()=>evaluateB281ObservedClosedHour(bundle,input,{nowMs}),/B281_TOO_EARLY_TO_EVALUATE/);
 assert.throws(()=>evaluateB281ObservedClosedHour(bundle,input.slice(0,2),{nowMs:READY}),/B281_THREE_PUBLIC_USD_CANDLES_REQUIRED/);
 assert.throws(()=>evaluateB281ObservedClosedHour(bundle,[input[0],input[0],input[2]],{nowMs:READY}),/B281_UNVERIFIED_OR_TAMPERED_SOURCE_OBSERVATION/);
 assert.throws(()=>evaluateB281ObservedClosedHour(bundle,[{...input[0],quoteCurrency:'USDT'},...input.slice(1)],{nowMs:READY}),/B281_UNVERIFIED_OR_TAMPERED_SOURCE_OBSERVATION/);
 assert.throws(()=>evaluateB281ObservedClosedHour(bundle,[{...input[0],candle:{...input[0].candle,close:0}},...input.slice(1)],{nowMs:READY}),/B281_UNVERIFIED_OR_TAMPERED_SOURCE_OBSERVATION/);
});
test('B281 after close scores synthetic one-hour research, 18 conservative cases, never a live trade',()=>{
 const x=evaluateB281ObservedClosedHour(bundle,makeData(),{nowMs:READY});
 assert.equal(x.status,'ONE_HOUR_DESCRIPTIVE_STUDY_ONLY');
 assert.equal(x.scenarioCount,162);
 assert.equal(x.historicalPredictionCount,18);
 assert.equal(x.sourceCandles.length,3);
 assert.equal(x.scenarioRows.length,162);
 assert.equal(x.conservative30_30.positive+x.conservative30_30.negative+
  x.conservative30_30.zero+x.conservative30_30.abstained,18);
 assert.equal(x.coverage.evaluatedHourlyCohorts,1);
 assert.equal(x.coverage.distinctUtcDays,1);
 assert.equal(x.coverage.descriptiveCoverageReached,false);
 assert.equal(x.coverage.statisticalAdvantageCertified,false);
 assert.equal(x.statisticalAdvantageCertified,false);
 assert.equal(x.independentTimestampSignatureVerified,false);
 assert.equal(x.independentPriceSourceSignatureVerified,false);
 assert.equal(x.robotChangesAllowed,false);
 assert.equal(x.realExecutionAllowed,false);
 assert.equal(x.ordersSent,0);
 assert.match(x.reportSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(x,evaluateB281ObservedClosedHour(bundle,makeData(),{nowMs:READY}));
});
test('B281 new modules never connect order, payment, private account or cron route',()=>{
 for(const path of ['../lib/platform/research/b281-first-hour-observation.mjs',
  '../scripts/platform/research/b281-observe-original-hour.mjs']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/api\.alpaca\.markets|api\.binance\.com|submitOrder|createOrder|withdraw|checkout|paymentIntent|autoDebit/);
  assert.match(source,/B281_/);
 }
 const runner=readFileSync(new URL('../scripts/platform/research/b281-observe-original-hour.mjs',import.meta.url),'utf8');
 assert.match(runner,/PENDING/);
 assert.match(runner,/networkRequestsMade:0/);
 assert.match(runner,/realOutcomeRetrieved:false/);
});
