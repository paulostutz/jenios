import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHistoricalPlan,collectPublicHistoricalPlan,B278_PRODUCTS}
 from '../lib/platform/research/b278-historical-ingest.mjs';
import {
 B280_FROZEN_PROTOCOL,B280_EXPECTED_SCENE_COUNT,sealB280ForwardForecasts,
 inspectB280SealedForecast,scoreB280FutureClosedHour
} from '../lib/platform/research/b280-forward-protocol.mjs';
const H=3600000,AT=Date.parse('2026-10-22T13:08:00Z'),
END=Math.floor(AT/H)*H-H,START=END-960*H;
const SHA='0123456789abcdef0123456789abcdef01234567',RUN=9999991;
function source(product){
 const base=product==='BTC-USD'?50000:product==='ETH-USD'?3000:90;
 return Array.from({length:960},(_,i)=>{
  const trend=i*.00003,cyc=Math.sin(i/7)*.003;
  const open=base*(1+trend+cyc);
  const close=base*(1+(i+1)*.00003+Math.sin((i+1)/7)*.003);
  return {t:START+i*H,open,close,high:Math.max(open,close)*1.005,
   low:Math.min(open,close)*.995,volume:100+(i%13)};
 });
}
async function intake(product){
 const candles=source(product);
 const plan=buildHistoricalPlan({product,startMs:START,endMs:END,asOfMs:AT});
 const fetchImpl=async url=>{
  const q=new URL(url),first=Date.parse(q.searchParams.get('start')),last=Date.parse(q.searchParams.get('end'));
  const rows=candles.filter(b=>b.t>=first&&b.t<last)
   .map(b=>[b.t/1000,b.low,b.high,b.open,b.close,b.volume]);
  return new Response(JSON.stringify(rows),{status:200});
 };
 return collectPublicHistoricalPlan(plan,{fetchImpl,pause:async()=>{},spacingMs:0});
}
let cached;
async function history(){return cached??=await Promise.all(B278_PRODUCTS.map(x=>intake(x.id)));}
async function sealed(){
 return sealB280ForwardForecasts(await history(),{receivedAtMs:AT,
  gitCommitSha:SHA,workflowRunId:RUN});
}
function makeFuture(s){
 return ['BTC-USD','ETH-USD','SOL-USD'].map((product,i)=>{
  const open=[55000,3400,115][i];
  return {product,bar:{t:s.targetCandleOpenMs,open,close:open*1.002,
   high:open*1.015,low:open*.985,volume:10000}};
 });
}
test('B280 freezes future-only spot USD research and locks unqualified live robots',()=>{
 assert.equal(B280_FROZEN_PROTOCOL.parentCommit,'fb9441d3485d0c825cd3e7705c3de33fb1e74515');
 assert.equal(B280_FROZEN_PROTOCOL.quoteCurrency,'USD');
 assert.deepEqual(B280_FROZEN_PROTOCOL.instrumentIds,['BTC-USD','ETH-USD','SOL-USD']);
 assert.equal(B280_FROZEN_PROTOCOL.historyBars,960);
 assert.equal(B280_EXPECTED_SCENE_COUNT,18);
 assert.equal(B280_FROZEN_PROTOCOL.minimumLeadMs,600000);
 assert.equal(B280_FROZEN_PROTOCOL.minimumDistinctForwardDaysBeforeReview,30);
 assert.equal(B280_FROZEN_PROTOCOL.noActualBrokerExecution,true);
 assert.deepEqual(B280_FROZEN_PROTOCOL.roundTripCostBps,[0,10,30]);
 assert.deepEqual(B280_FROZEN_PROTOCOL.adverseStopSlipBps,[0,10,30]);
 assert.match(B280_FROZEN_PROTOCOL.sha256,/^[a-f0-9]{64}$/);
});
test('B280 18 forward research directions are sealed before a genuinely unobserved UTC target candle',async()=>{
 const result=await sealed();
 assert.equal(result.schema,'JENIOS_B280_SEALED_FORWARD_FORECAST_V1');
 assert.equal(result.forecasts.length,18);
 assert.equal(result.forecasts.filter(x=>x.product==='BTC-USD').length,6);
 assert.deepEqual([...new Set(result.forecasts.map(x=>x.mode))],['direct','reverse','hybrid']);
 assert.ok(result.targetCandleOpenMs>result.receivedAtMs);
 assert.ok(result.targetCandleOpenMs-result.receivedAtMs>=600000);
 assert.equal(result.targetCandleEndMs-result.targetCandleOpenMs,H);
 assert.equal(result.sealedBeforeTargetOpened,true);
 assert.equal(result.githubCommit,SHA);
 assert.equal(result.githubWorkflowRunId,RUN);
 assert.equal(result.sourceTransportSigned,undefined);
 assert.equal(result.historicPricesIndependentlyAuthenticated,false);
 assert.equal(result.externalTimestampSignaturePresent,false);
 assert.equal(result.priceProviderSignaturePresent,false);
 assert.equal(result.forwardMarketOutcomeKnown,false);
 assert.equal(result.observedPnl,null);
 assert.equal(result.ordersSent,0);
 assert.equal(result.eligibleForLiveUse,false);
 assert.ok(result.forecasts.every(x=>x.isTradeSignal===false&&
  x.operationalAdvice===false&&x.brokerOrderId===null));
 const audit=inspectB280SealedForecast(result);
 assert.equal(audit.valid,true);
 assert.equal(audit.prospectivelyOutcomeVerified,false);
});
test('B280 generated SHA is reproducible and future timestamp is UTC-hour aligned',async()=>{
 const one=await sealed(),two=await sealed();
 assert.deepEqual(one,two);
 assert.equal(one.sealSha256,two.sealSha256);
 assert.equal(one.targetCandleOpenMs%H,0);
 assert.equal(one.targetCandleOpenMs,Date.parse('2026-10-22T14:00:00Z'));
 assert.ok(one.forecasts.every(x=>x.sourceHistoryEndMs===END));
});
test('B280 rejects retroactive forecasts, invalid runner attestation and incompatible protocol',async()=>{
 const rows=await history();
 const base={receivedAtMs:AT,gitCommitSha:SHA,workflowRunId:RUN};
 for(const changed of [
  {receivedAtMs:Date.parse('2026-10-21T14:59:00Z')},
  {receivedAtMs:0},{gitCommitSha:'abc'},{workflowRunId:0},
  {protocol:{...B280_FROZEN_PROTOCOL,hypotheticalRiskStopPct:.03}},
  {protocol:{...B280_FROZEN_PROTOCOL,quoteCurrency:'USDT'}},
  {protocol:{...B280_FROZEN_PROTOCOL,minimumLeadMs:0}}
 ])assert.throws(()=>sealB280ForwardForecasts(rows,{...base,...changed}),/B280_/);
});
test('B280 refuses stale/gapped/source-mutated and USD-USDT spoofed series',async()=>{
 const originals=await history();
 const copy=originals.map(x=>({...x,manifest:{...x.manifest},candles:[...x.candles]}));
 copy[0].candles[250]={...copy[0].candles[250],close:copy[0].candles[250].close+1};
 assert.throws(()=>sealB280ForwardForecasts(copy,{receivedAtMs:AT,gitCommitSha:SHA,workflowRunId:RUN}),/B280_CANDLE_INTEGRITY_UNVERIFIED/);
 const wrong=originals.map(x=>({...x,manifest:{...x.manifest}}));
 wrong[0].manifest.quoteCurrency='USDT';
 assert.throws(()=>sealB280ForwardForecasts(wrong,{receivedAtMs:AT,gitCommitSha:SHA,workflowRunId:RUN}),/B280_CANDLE_INTEGRITY_UNVERIFIED/);
 assert.throws(()=>sealB280ForwardForecasts(originals.slice(0,2),{receivedAtMs:AT,gitCommitSha:SHA,workflowRunId:RUN}),/B280_THREE_USD_SERIES_REQUIRED/);
 assert.throws(()=>sealB280ForwardForecasts(originals,{receivedAtMs:AT+6*H,gitCommitSha:SHA,workflowRunId:RUN}),/B280_HISTORICAL_NOT_CLOSED_OR_STALE/);
});
test('B280 rejects forged forecast direction, target bar, source hashes and timestamps',async()=>{
 const x=await sealed();
 const tampered=[
  {...x,forecasts:[{...x.forecasts[0],researchDirection:'UP'},...x.forecasts.slice(1)]},
  {...x,targetCandleOpenMs:x.targetCandleOpenMs-H},
  {...x,receivedAtMs:x.targetCandleOpenMs-1000},
  {...x,githubCommit:'0'.repeat(40)},
  {...x,sourceHistoricalProof:'FAKE'}
 ];
 for(const row of tampered)
  assert.throws(()=>inspectB280SealedForecast(row),/B280_FORECAST_TAMPERED_OR_RETROACTIVE/);
});
test('B280 no outcome may be calculated before the future hourly bar closes',async()=>{
 const x=await sealed(),bars=makeFuture(x);
 for(const instant of [
  x.receivedAtMs,x.targetCandleOpenMs,
  x.targetCandleEndMs-1,x.targetCandleEndMs,x.targetCandleEndMs+299999
 ])assert.throws(()=>scoreB280FutureClosedHour(x,bars,{observedAtMs:instant}),/B280_TARGET_HOUR_NOT_CLOSED_OR_REPORTED_TOO_EARLY/);
});
test('B280 future scorer remains non-operational even with injected synthetic candles AFTER closing',async()=>{
 const x=await sealed(),out=scoreB280FutureClosedHour(x,makeFuture(x),{
  observedAtMs:x.targetCandleEndMs+300000});
 assert.equal(out.rows.length,162);
 assert.equal(out.count,162);
 assert.equal(out.observationalForwardHourPassed,true);
 assert.equal(out.outcomeProviderSigned,false);
 assert.equal(out.independentProviderConfirmed,false);
 assert.equal(out.brokerExecutionReconciled,false);
 assert.equal(out.significanceCertified,false);
 assert.equal(out.readyForOperationalChanges,false);
 assert.equal(out.ordersSent,0);
 assert.ok(out.rows.every(r=>r.observedOrder===false&&r.hypotheticalFillVerified===false));
 for(const row of out.rows)assert.ok(row.netR===null||Number.isFinite(row.netR));
});
test('B280 invalid target bars and missing asset cannot produce a prospective result',async()=>{
 const x=await sealed(),bars=makeFuture(x),at=x.targetCandleEndMs+300000;
 const cases=[
  bars.slice(0,2),
  [bars[0],bars[0],bars[2]],
  [{...bars[0],bar:{...bars[0].bar,t:bars[0].bar.t-H}},bars[1],bars[2]],
  [{...bars[0],bar:{...bars[0].bar,high:0}},bars[1],bars[2]],
  [{...bars[0],bar:{...bars[0].bar,volume:-1}},bars[1],bars[2]]
 ];
 for(const items of cases)assert.throws(()=>scoreB280FutureClosedHour(x,items,{observedAtMs:at}),/B280_FUTURE_SOURCE_INVALID_OR_MISSING|B280_THREE_FUTURE_CANDLES_REQUIRED/);
});
test('B280 greater modeled cost never raises same hypothetical forward R',async()=>{
 const x=await sealed(),out=scoreB280FutureClosedHour(x,makeFuture(x),{
  observedAtMs:x.targetCandleEndMs+300000});
 for(const product of B280_FROZEN_PROTOCOL.instrumentIds)
  for(const h of B280_FROZEN_PROTOCOL.hypothesisIds)
   for(const m of B280_FROZEN_PROTOCOL.modes)
    for(const slip of B280_FROZEN_PROTOCOL.adverseStopSlipBps){
     const cases=out.rows.filter(r=>r.product===product&&r.hypothesisId===h&&r.mode===m&&r.slipBps===slip)
      .sort((a,b)=>a.costBps-b.costBps);
     assert.equal(cases.length,3);
     if(cases[0].netR!==null)assert.ok(cases[0].netR>=cases[1].netR&&cases[1].netR>=cases[2].netR);
    }
});
test('B280 app, commerce, broker and historic replay remain disconnected and unchanged',()=>{
 const source=readFileSync(new URL('../lib/platform/research/b280-forward-protocol.mjs',import.meta.url),'utf8');
 const script=readFileSync(new URL('../scripts/platform/research/b280-capture-future-hour.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|\bXMLHttpRequest\b|api\.alpaca|api\.binance|createOrder|submitOrder|checkout|paymentIntent|process\.env/);
 assert.doesNotMatch(script,/api\.alpaca|api\.binance|createOrder|submitOrder|withdraw|paymentIntent/);
 assert.match(script,/GITHUB_SHA/);
 assert.match(script,/GITHUB_RUN_ID/);
 assert.match(script,/FAIL_CLOSED_NO_PROSPECTIVE_PREDICTIONS/);
 assert.match(script,/statisticalSampleSize:0/);
});

import {B280_RESEARCH_ACCEPTANCE_GATES,reviewB280ForwardCoverage}
 from '../lib/platform/research/b280-statistical-gate.mjs';
test('B280 statistical gate starts at zero and never treats the historic B279 holdout as future',()=>{
 const review=reviewB280ForwardCoverage([]);
 assert.equal(review.evaluatedHourlyCohorts,0);
 assert.equal(review.distinctUtcDays,0);
 assert.equal(review.descriptiveCoverageReached,false);
 assert.equal(review.statisticalAdvantageCertified,false);
 assert.equal(review.readyForOperationalRollout,false);
 assert.equal(review.historicalHoldoutCountedAsProspective,false);
 assert.equal(review.remainingBeforeDescriptiveCoverage.utcDays,30);
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumUniqueTargetHours,300);
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumOutcomesPerAssetHypothesisMode,100);
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.multiplicityAdjustmentRequired,true);
});
test('B280 a future result is not a signed independent observation even after hourly scoring',async()=>{
 const forecast=await sealed();
 const evaluated=scoreB280FutureClosedHour(forecast,makeFuture(forecast),{
  observedAtMs:forecast.targetCandleEndMs+300000
 });
 const review=reviewB280ForwardCoverage([evaluated]);
 assert.equal(review.evaluatedHourlyCohorts,1);
 assert.equal(review.distinctUtcDays,1);
 assert.equal(review.descriptiveCoverageReached,false);
 assert.equal(review.externallySignedPredictionWitnessAccepted,false);
 assert.equal(review.independentlySignedMarketSourceAccepted,false);
 assert.equal(review.readyForOperationalRollout,false);
 const again={...evaluated,observedAtMs:evaluated.observedAtMs+1000};
 assert.throws(()=>reviewB280ForwardCoverage([evaluated,again]),/B280_DUPLICATE_TARGET_CANDLE/);
});
test('B280 fake stats cannot waive signed source and human release requirements',async()=>{
 const forecast=await sealed();
 const first=scoreB280FutureClosedHour(forecast,makeFuture(forecast),{
  observedAtMs:forecast.targetCandleEndMs+300000});
 const fakeMonth=Array.from({length:300},(_,i)=>({
  ...first,targetCandleStartMs:first.targetCandleStartMs+i*3*H,
  observedAtMs:first.observedAtMs+i*3*H,
  sealedSha256:(i.toString(16).padStart(64,'0')),
  rows:first.rows.map(x=>({...x,netR:1}))
 }));
 const r=reviewB280ForwardCoverage(fakeMonth);
 assert.equal(r.descriptiveCoverageReached,true);
 assert.equal(r.statisticalAdvantageCertified,false);
 assert.equal(r.providerAndBrokerReconciliationCertified,false);
 assert.equal(r.serialCorrelationAdjusted,false);
 assert.equal(r.multipleTestsCorrected,false);
 assert.equal(r.readyForOperationalRollout,false);
 assert.equal(r.externallySignedPredictionWitnessAccepted,false);
});
test('B280 statistical gate refuses arbitrary or duplicate scenario rows and forged release flags',async()=>{
 const forecast=await sealed();
 const x=scoreB280FutureClosedHour(forecast,makeFuture(forecast),{
  observedAtMs:forecast.targetCandleEndMs+300000});
 for(const patch of [
  {schema:'FAKE'},{outcomeProviderSigned:true},{independentProviderConfirmed:true},
  {readyForOperationalChanges:true},{ordersSent:1},{count:161},
  {rows:x.rows.slice(0,161)},
  {rows:[x.rows[0],x.rows[0],...x.rows.slice(2)]}
 ])assert.throws(()=>reviewB280ForwardCoverage([{...x,...patch}]),/B280_/);
 assert.throws(()=>reviewB280ForwardCoverage('not array'),/B280_INVALID_FUTURE_REVIEW_SET/);
});
