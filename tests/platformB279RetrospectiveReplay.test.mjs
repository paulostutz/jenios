import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 B278_PRODUCTS,buildHistoricalPlan,collectPublicHistoricalPlan
} from '../lib/platform/research/b278-historical-ingest.mjs';
import {
 B279_FROZEN_B278_REFERENCE,B279_FROZEN_PROTOCOL,B279_HYPOTHESES,B279_MODES,
 evaluateB279FrozenHistory,evaluateB279SyntheticFixture
} from '../lib/platform/research/b279-retrospective-replay.mjs';
const H=3600000,START=B279_FROZEN_B278_REFERENCE.startMs;
const END=B279_FROZEN_B278_REFERENCE.endMs,NOW=END+3*H;
function candles(product){
 const base=product==='BTC-USD'?65000:product==='ETH-USD'?3500:145;
 return Array.from({length:960},(_,i)=>{
  const t=START+i*H,open=base*(1+i*.000045+Math.sin(i/8)*.0018);
  const close=base*(1+(i+1)*.000045+Math.sin((i+1)/8)*.0018);
  return {t,open,close,high:Math.max(open,close)*1.016,
   low:Math.min(open,close)*.984,volume:100+i%19};
 });
}
function provider(product){
 const data=candles(product);
 return async(url,options)=>{
  assert.equal(options.method,'GET');
  const u=new URL(url);
  assert.equal(u.origin,'https://api.exchange.coinbase.com');
  assert.equal(u.pathname,'/products/'+product+'/candles');
  const start=Date.parse(u.searchParams.get('start'));
  const end=Date.parse(u.searchParams.get('end'));
  const rows=data.filter(x=>x.t>=start&&x.t<end)
   .map(x=>[x.t/1000,x.low,x.high,x.open,x.close,x.volume]).reverse();
  return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
 };
}
async function dataset(){
 return Promise.all(B278_PRODUCTS.map(async p=>{
  const plan=buildHistoricalPlan({product:p.id,startMs:START,endMs:END,asOfMs:NOW});
  return collectPublicHistoricalPlan(plan,{fetchImpl:provider(p.id),pause:async()=>{},spacingMs:0});
 }));
}
let cache;
async function fixture(){return cache??=await dataset();}
test('B279 freezes three original USD spot SHA identities and never equates USDT',()=>{
 assert.deepEqual(B278_PRODUCTS.map(x=>x.id),['BTC-USD','ETH-USD','SOL-USD']);
 assert.equal(B279_FROZEN_B278_REFERENCE.quoteCurrency,'USD');
 assert.equal(B279_FROZEN_B278_REFERENCE.frozenSha256Rows.length,3);
 assert.equal(B279_FROZEN_B278_REFERENCE.candlesPerAsset,960);
 assert.deepEqual(B279_HYPOTHESES,['EMA_CONTEXT_V1','CLOSED_BREAKOUT_V1']);
 assert.deepEqual(B279_MODES,['direct','reverse','hybrid']);
 assert.equal(B279_FROZEN_PROTOCOL.schema,'JENIOS_B279_FROZEN_RESEARCH_PROTOCOL_V1');
 assert.equal(B279_FROZEN_PROTOCOL.preRegisteredBeforeHistoricalHoldout,false);
 assert.equal(B279_FROZEN_PROTOCOL.originalRobotCodeUsed,false);
 assert.deepEqual(B279_FROZEN_PROTOCOL.costBps,[0,10,30]);
 assert.deepEqual(B279_FROZEN_PROTOCOL.adverseStopSlipBps,[0,10,30]);
 assert.match(B279_FROZEN_PROTOCOL.sha256,/^[a-f0-9]{64}$/);
 assert.equal(B279_FROZEN_PROTOCOL.fixedStopPct,.01);
 assert.equal(B279_FROZEN_PROTOCOL.trainingBars+B279_FROZEN_PROTOCOL.embargoBars+B279_FROZEN_PROTOCOL.holdoutBars,960);
});
test('B279 offline synthetic fixtures produce 162 comparisons without order execution',async()=>{
 const intakes=await fixture();
 const report=evaluateB279SyntheticFixture(intakes);
 assert.equal(report.classification,'SYNTHETIC_FIXTURE_ONLY');
 assert.equal(report.scenarios.length,162);
 assert.equal(report.scenarioRows,162);
 assert.equal(report.samplesThreeAssets,3);
 assert.equal(report.dataSnapshotSha256.length,3);
 assert.equal(report.period.startMs,START);
 assert.equal(report.period.endMs,END);
 assert.equal(report.ordersSent,0);assert.equal(report.paperOrdersSent,0);
 assert.equal(report.originalRobotsModified,false);
 assert.equal(report.prospectiveValidationCompleted,false);
 assert.equal(report.statisticalSignificanceCertified,false);
 assert.equal(report.realDeploymentAllowed,false);
 assert.equal(report.eligibleForOperationalComparison,false);
 assert.equal(report.preRegisteredBeforeHoldout,false);
 for(const p of B278_PRODUCTS){
  assert.equal(report.scenarios.filter(x=>x.product===p.id).length,54);
  for(const hypothesis of B279_HYPOTHESES)
   for(const mode of B279_MODES){
    const cases=report.scenarios.filter(x=>x.product===p.id&&x.hypothesisId===hypothesis&&x.mode===mode);
    assert.equal(cases.length,9);
    assert.ok(cases.every(c=>c.holdoutBars===312));
    assert.ok(cases.every(c=>c.signalCount>=0&&c.signalCount<=312));
    assert.ok(cases.every(c=>c.firstSignalClosedAtMs===null||c.firstSignalClosedAtMs>=report.period.embargoEndMs));
    assert.ok(cases.every(c=>c.lastSignalClosedAtMs===null||c.lastSignalClosedAtMs<report.period.endMs));
    assert.ok(cases.every(c=>c.winCount+c.lossCount+c.flatCount===c.signalCount));
    assert.ok(cases.every(c=>c.actualExecutionObserved===false&&c.capitalProfitObserved===false));
   }
 }
});
test('B279 identical history and protocol yield identical deterministic study rows',async()=>{
 const intakes=await fixture();
 const first=evaluateB279SyntheticFixture(intakes),second=evaluateB279SyntheticFixture(intakes);
 assert.deepEqual(first,second);
 assert.ok(Object.isFrozen(first.scenarios));
 assert.ok(first.scenarios.every(Object.isFrozen));
});
test('B279 increasing cost never improves net expectation within identical trades',async()=>{
 const out=evaluateB279SyntheticFixture(await fixture());
 for(const p of B278_PRODUCTS)for(const hypothesis of B279_HYPOTHESES)for(const mode of B279_MODES)
  for(const slip of B279_FROZEN_PROTOCOL.adverseStopSlipBps){
   const matched=out.scenarios.filter(x=>x.product===p.id&&x.hypothesisId===hypothesis&&x.mode===mode&&x.stopSlipBps===slip)
    .sort((a,b)=>a.costBps-b.costBps);
   assert.equal(matched.length,3);
   assert.equal(matched[0].signalCount,matched[2].signalCount);
   if(matched[0].signalCount>0){
    assert.ok(matched[0].avgNetR>=matched[1].avgNetR-1e-6);
    assert.ok(matched[1].avgNetR>=matched[2].avgNetR-1e-6);
   }
  }
});
test('B279 adverse stop slippage never increases expectancy for identical cost and mode',async()=>{
 const out=evaluateB279SyntheticFixture(await fixture());
 for(const p of B278_PRODUCTS)for(const h of B279_HYPOTHESES)for(const mode of B279_MODES)
  for(const cost of B279_FROZEN_PROTOCOL.costBps){
   const matched=out.scenarios.filter(x=>x.product===p.id&&x.hypothesisId===h&&x.mode===mode&&x.costBps===cost)
    .sort((a,b)=>a.stopSlipBps-b.stopSlipBps);
   assert.equal(matched.length,3);
   assert.equal(matched[0].signalCount,matched[2].signalCount);
   if(matched[0].signalCount>0){
    assert.ok(matched[0].avgNetR>=matched[1].avgNetR-1e-6);
    assert.ok(matched[1].avgNetR>=matched[2].avgNetR-1e-6);
   }
  }
});
test('B279 a synthetic spot fixture can never impersonate B278 frozen real-source hashes',async()=>{
 await assert.rejects(async()=>evaluateB279FrozenHistory(await fixture()),/B279_B278_HISTORICAL_SHA_MISMATCH/);
});
test('B279 modified or incomplete snapshot fails before any historical study',async()=>{
 const original=await fixture();
 const copy=original.map(x=>({...x,candles:[...x.candles]}));
 copy[0].candles[250]={...copy[0].candles[250],close:copy[0].candles[250].close+1};
 assert.throws(()=>evaluateB279SyntheticFixture(copy),/B279_SOURCE_DATA_REWRITTEN/);
 assert.throws(()=>evaluateB279SyntheticFixture(original.slice(0,2)),/B279_THREE_SOURCE_SERIES_REQUIRED/);
 assert.throws(()=>evaluateB279SyntheticFixture([original[0],original[0],original[2]]),/B279_DUPLICATE_ASSET/);
});
test('B279 forged USD-USDT or shifted vintage cannot bypass the research gate',async()=>{
 const records=await fixture();
 const changed=records.map(x=>({...x,manifest:{...x.manifest}}));
 changed[0].manifest.quoteCurrency='USDT';
 assert.throws(()=>evaluateB279SyntheticFixture(changed),/B279_INTAKE_BOUNDARY_FAILED/);
 const redate=records.map(x=>({...x,manifest:{...x.manifest}}));
 redate[1].manifest.startMs+=H;
 assert.throws(()=>evaluateB279SyntheticFixture(redate),/B279_INTAKE_BOUNDARY_FAILED/);
 const synthetic=records.map(x=>({...x,manifest:{...x.manifest}}));
 synthetic[2].manifest.ordersSent=1;
 assert.throws(()=>evaluateB279SyntheticFixture(synthetic),/B279_INTAKE_BOUNDARY_FAILED/);
});
test('B279 any cost, stop, regime or hypothesis change invalidates the frozen specification',async()=>{
 const source=await fixture();
 for(const patch of [
  {fixedStopPct:.015},{costBps:[0,10,20]},{hybridMinEmaGapRatio:.001},
  {trainingBars:599},{preRegisteredBeforeHistoricalHoldout:true},
  {hypothesisIds:['EMA_CONTEXT_V1']},{modes:['reverse']},{quoteCurrency:'USDT'},
  {sha256:'0'.repeat(64)}
 ]){
  assert.throws(()=>evaluateB279SyntheticFixture(source,{protocol:{...B279_FROZEN_PROTOCOL,...patch}}),/B279_PROTOCOL_CHANGED_AFTER_FREEZE/);
 }
});
test('B279 replay module cannot fetch brokers or create an order/payment, and is not connected to app routes',()=>{
 const script=readFileSync(new URL('../lib/platform/research/b279-retrospective-replay.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(script,/\bfetch\s*\(|\bXMLHttpRequest\b|api\.binance|api\.alpaca|orders\/|createOrder|submitOrder|paymentIntent|checkout/);
 assert.match(script,/preRegisteredBeforeHistoricalHoldout:false/);
 assert.match(script,/eligibleForOperationalComparison:false/);
 assert.match(script,/noMarketDepthOrLatencyModel:true/);
 assert.match(script,/originalRobotsModified:false,ordersSent:0/);
});
