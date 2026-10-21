import test from 'node:test';import assert from 'node:assert/strict';
import {observeClosedCandleResearch,reviewFrozenResearchProtocol,RESEARCH_FAMILIES} from '../lib/platform/research/trading-video-hypotheses.mjs';
const step=3600000,origin=1792500000000-(1792500000000%step);
const bars=Array.from({length:90},(_,i)=>({t:origin+i*step,open:100+i*.05,high:101+i*.05,low:99+i*.05,close:100.5+i*.05,volume:100+i}));
const opts={asOfMs:origin+90*step,intervalMs:step};
const protocol={frozenAtMs:1000000000,trainEndsAtMs:2000000000,holdoutStartsAtMs:2000000000+86400000,
 prospectiveStartsAtMs:2000000000+90000000,costBps:[0,10,30],assets:['BTCUSDT','ETHUSDT','SOLUSDT'],modes:['direct','reverse','hybrid']};
test('five research families are hypotheses, not robot code or claimed video lessons',()=>{
 assert.equal(RESEARCH_FAMILIES.length,5);
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
