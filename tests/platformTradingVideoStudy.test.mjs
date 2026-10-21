import test from 'node:test';import assert from 'node:assert/strict';
import {observeClosedCandleResearch,reviewFrozenResearchProtocol,RESEARCH_FAMILIES,inspectConnorsResearchConditions} from '../lib/platform/research/trading-video-hypotheses.mjs';
const step=3600000,origin=1792500000000-(1792500000000%step);
const bars=Array.from({length:90},(_,i)=>({t:origin+i*step,open:100+i*.05,high:101+i*.05,low:99+i*.05,close:100.5+i*.05,volume:100+i}));
const opts={asOfMs:origin+90*step,intervalMs:step};
const protocol={frozenAtMs:1000000000,trainEndsAtMs:2000000000,holdoutStartsAtMs:2000000000+86400000,
 prospectiveStartsAtMs:2000000000+90000000,costBps:[0,10,30],assets:['BTCUSDT','ETHUSDT','SOLUSDT'],modes:['direct','reverse','hybrid']};
test('five research families are hypotheses, not robot code or claimed video lessons',()=>{
 assert.equal(RESEARCH_FAMILIES.length,7);
 assert.ok(RESEARCH_FAMILIES.every(x=>x.question&&x.pitfall));
});
test('calculates indicators only from finished candles without broker calls',()=>{
 const x=observeClosedCandleResearch(bars,opts);
 assert.equal(x.features.ema12>x.features.ema26,true);
 assert.equal(x.features.rsi14,100);
 assert.ok(x.features.atr14>0&&x.features.stoch14>=0&&x.features.stoch14<=100);
 assert.equal(x.dataDigestSha256.length,64);
 assert.equal(x.ordersSent,0);assert.equal(x.tradingSignalsGenerated,0);
 assert.equal(x.profitabilityDemonstrated,false);
});
test('refuses open future candle, gapped, invalid volume, duplicate, or high-low inconsistency',()=>{
 assert.throws(()=>observeClosedCandleResearch(bars,{...opts,asOfMs:opts.asOfMs-1}),/RESEARCH_OPEN_OR_FUTURE_CANDLE/);
 const broken=[...bars];broken[32]={...broken[32],t:broken[31].t};
 assert.throws(()=>observeClosedCandleResearch(broken,opts),/RESEARCH_INVALID_OHLCV_OR_GAP/);
 for(const patch of [{volume:-1},{open:0},{high:1},{close:Infinity}]){
  const a=bars.map((x,i)=>i===15?{...x,...patch}:x);
  assert.throws(()=>observeClosedCandleResearch(a,opts),/RESEARCH_INVALID_OHLCV_OR_GAP/);
 }
});
test('flat data and no observed volume cannot manufacture stochastic breakouts',()=>{
 const flat=bars.map(x=>({...x,open:100,high:100,low:100,close:100,volume:0}));
 const x=observeClosedCandleResearch(flat,opts);
 assert.equal(x.features.stoch14,50);assert.equal(x.features.rsi14,50);assert.equal(x.features.relativeVolume20,null);
});
test('modifying earlier closed candle changes data fingerprint but never unlocks orders',()=>{
 const x=observeClosedCandleResearch(bars,opts);
 const changed=bars.map((a,i)=>i===0?{...a,volume:a.volume+1}:a);
 const y=observeClosedCandleResearch(changed,opts);
 assert.notEqual(x.dataDigestSha256,y.dataDigestSha256);
 assert.equal(y.coreChanged,false);assert.equal(y.automatedTradingEnabled,false);
});
test('frozen protocol requires embargo, full assets/modes and nontrivial cost regimes',()=>{
 const ok=reviewFrozenResearchProtocol(protocol);assert.equal(ok.valid,true);
 assert.equal(ok.statisticalAdvantageCertified,false);
 for(const patch of [{holdoutStartsAtMs:protocol.trainEndsAtMs+1000},{assets:['BTCUSDT']},{modes:['direct']},{costBps:[0]},{prospectiveStartsAtMs:protocol.holdoutStartsAtMs-1}])
  assert.equal(reviewFrozenResearchProtocol({...protocol,...patch}).valid,false);
});

test('Larry Connors transcript is only a research observation; no-stop original remains NO_GO',()=>{
 const scale=3600000,origin=1792500000000-(1792500000000%scale);
 const entries=Array.from({length:210},(_,i)=>({t:origin+i*scale,open:100+i*.03,high:101+i*.03,low:99+i*.03,close:100.5+i*.03,volume:100+i}));
 const options={asOfMs:origin+210*scale,intervalMs:scale};
 const result=inspectConnorsResearchConditions(entries,options);
 assert.equal(result.classification,'NO_GO_MISSING_HARD_STOP');
 assert.equal(result.sourceTranscriptReviewed,true);
 assert.equal(result.operationalDeploymentAllowed,false);
 assert.equal(result.originalMethodHasPredefinedPriceStop,false);
 assert.equal(result.ordersSent,0);
 const bounded=inspectConnorsResearchConditions(entries,{...options,riskStopPct:0.01});
 assert.equal(bounded.classification,'RISK_BOUNDED_HYPOTHESIS_NEEDS_OOS');
 assert.equal(bounded.performanceCertified,false);assert.equal(bounded.liveTradingAllowed,false);
 assert.throws(()=>inspectConnorsResearchConditions(entries.slice(10),options),/RESEARCH_201_CLOSED_BARS_REQUIRED/);
 assert.throws(()=>inspectConnorsResearchConditions(entries,{...options,asOfMs:options.asOfMs-1}),/RESEARCH_OPEN_OR_FUTURE_CANDLE/);
});
import {describeConnorsMeanReversionContext,describeCandleGeometry,studyRiskRewardExpectancy} from '../lib/platform/research/trading-video-hypotheses.mjs';
test('RSI2 and SMA200/SMA5 require at least 201 closed bars; no orders or trading signal',()=>{
 assert.throws(()=>describeConnorsMeanReversionContext(bars,opts),/RESEARCH_SMA200_HISTORY_REQUIRED/);
 const data=Array.from({length:220},(_,i)=>({t:origin+i*step,open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100.5+i*.1,volume:100}));
 for(let i=218;i<220;i++)data[i]={...data[i],open:101,high:103,low:99,close:100};
 const x=describeConnorsMeanReversionContext(data,{asOfMs:origin+220*step,intervalMs:step});
 assert.equal(x.ordersSent,0);assert.equal(x.brokerConnected,false);
 assert.ok(Number.isFinite(x.rsi2)&&Number.isFinite(x.sma200)&&Number.isFinite(x.sma5));
 assert.equal(x.nextBarRequiredForAnyExecutionStudy,true);
});
test('candle geometry does not claim reversal and is bounded even for zero-range candles',()=>{
 const a=describeCandleGeometry(bars,opts);
 assert.equal(a.ordersSent,0);assert.equal(a.reversalProbabilityCertified,false);
 assert.ok(a.bodyRatio>=0&&a.bodyRatio<=1);
 const flat=bars.map(x=>({...x,open:100,high:100,low:100,close:100,volume:0}));
 const z=describeCandleGeometry(flat,opts);
 assert.equal(z.bodyRatio,0);assert.equal(z.closeLocationRatio,0.5);
});
test('win rate alone is insufficient: positive 30% 3:1 versus negative 70% 1:3',()=>{
 const good=studyRiskRewardExpectancy({winRate:.3,averageWinR:3,averageLossR:1,costR:.1});
 const bad=studyRiskRewardExpectancy({winRate:.7,averageWinR:1,averageLossR:3,costR:.1});
 assert.ok(good.netExpectancyR>0);assert.ok(bad.netExpectancyR<0);
 assert.equal(good.measuredTradeCount,0);assert.equal(bad.ordersSent,0);
 for(const value of [-1,Infinity,NaN,101])assert.throws(()=>studyRiskRewardExpectancy({winRate:value,averageWinR:3,averageLossR:1,costR:0}));
});
