import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHistoricalBars} from '../lib/platform/historical-quality.mjs';
const t=Date.parse('2026-10-17T10:00:00.000Z');
const now=t+250*60_000;
const make=(n=90)=>Array.from({length:n},(_,i)=>{
 const p=100+i*0.09;return {time:new Date(t+i*60_000).toISOString(),
  open:p,high:p+1,low:p-1,close:p+0.2,volume:1000};
});
test('B82 uniformly spaced historical user data can be replayed but never become licensed current prices',()=>{
 const a=inspectHistoricalBars(make(),{now});
 assert.equal(a.typicalIntervalMs,60_000);
 assert.equal(a.gaps.length,0);assert.equal(a.replayEligible,true);
 assert.equal(a.providerVerified,false);assert.equal(a.live,false);assert.equal(a.realExecutionAllowed,false);
});
test('B82 missing time interval must fail closed, without filling synthetic candles',()=>{
 const bars=make();bars[80].time=new Date(t+100*60_000).toISOString();
 for(let i=81;i<90;i++)bars[i].time=new Date(t+(i+20)*60_000).toISOString();
 const a=inspectHistoricalBars(bars,{now});
 assert.equal(a.count,90);assert.equal(a.replayEligible,false);
 assert.equal(a.gaps.length,1);
 assert(a.warnings.some(x=>x.includes('lacunas')));
});
test('B82 flat and zero-volume data are not eligible for replay',()=>{
 const bars=make();bars.forEach((x,i)=>{if(i<20)x.volume=0;});
 assert.equal(inspectHistoricalBars(bars,{now}).replayEligible,false);
});
test('B82 rejects timestamp spoofing and future observations',()=>{
 assert.throws(()=>inspectHistoricalBars(make(),{now:t+1000}),/INVALID_CANDLE/);
 assert.throws(()=>inspectHistoricalBars(make(),{now,gapMultiplier:0}),/INVALID_GAP_MULTIPLIER/);
});
