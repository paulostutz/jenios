import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateClosedBars,multiTimeframeStudy} from '../lib/platform/multi-timeframe-study.mjs';
const base=Date.parse('2026-10-17T00:00:00Z');
const now=base+260*300000;
const rows=(slope=.15,n=210)=>Array.from({length:n},(_,i)=>{
 const p=100+i*slope;return {time:new Date(base+i*300000).toISOString(),
  open:p,high:p+1,low:p-1,close:p+.1,volume:1200};
});
test('B93 aggregates aligned 5m candles into closed 10m and 15m bars without interpolation',()=>{
 const s=rows();
 const x=aggregateClosedBars(s,{baseIntervalMs:300000,group:3,now});
 assert.equal(x.intervalMs,900000);
 assert.equal(x.candles.length,70);
 assert.equal(x.candles[0].open,s[0].open);
 assert.equal(x.candles[0].close,s[2].close);
 assert.equal(x.candles[0].volume,3600);
 assert.equal(x.live,false);
});
test('B93 high/low from all source bars, no lookahead to unfinished aggregates',()=>{
 const s=rows();
 s[2].high+=100;
 const x=aggregateClosedBars(s,{baseIntervalMs:300000,group:3,now:base+209*300000});
 assert.equal(x.candles[0].high,s[2].high);
 assert(x.candles.at(-1).time<new Date(base+209*300000).toISOString());
});
test('B93 missing intermediate candle is rejected rather than fabricated',()=>{
 const s=rows();s.splice(44,1);
 assert.throws(()=>multiTimeframeStudy(s,{baseIntervalMs:300000,now}),/MISSING_BASE_CANDLE/);
});
test('B93 rising and falling histories do not give the same unanimous verdict',()=>{
 const up=multiTimeframeStudy(rows(),{baseIntervalMs:300000,now});
 const down=multiTimeframeStudy(rows(-.15),{baseIntervalMs:300000,now});
 assert.equal(up.series.length,3);assert.equal(down.series.length,3);
 assert.notEqual(up.consensus,down.consensus);
 assert.equal(up.recommendedTrade,null);assert.equal(down.providerVerified,false);
});
test('B93 no bogus certainty from all aligned technical signals',()=>{
 const x=multiTimeframeStudy(rows(),{baseIntervalMs:300000,now});
 assert.equal(x.profitabilityClaim,false);assert.equal(x.realExecutionAllowed,false);
 assert.equal(x.accumulationConfirmed,false);
 assert(x.series.every(r=>r.studiedSignals===10&&r.executionAuthorized===false));
});
test('B93 small data samples cannot masquerade as multi timeframe',()=>{
 assert.throws(()=>multiTimeframeStudy(rows(.1,120),{baseIntervalMs:300000,now}),/INSUFFICIENT_MULTITIMEFRAME_HISTORY/);
});
