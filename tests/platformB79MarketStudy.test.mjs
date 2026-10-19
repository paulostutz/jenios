import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHistoricalCandles,studyHistoricalCandles} from '../lib/platform/market-study.mjs';
const anchor=Date.parse('2026-10-18T10:00:00.000Z');
function series(n=90,trend=0.25){
 return Array.from({length:n},(_,i)=>{const p=100+i*trend;return {
  time:new Date(anchor+i*60000).toISOString(),open:p,high:p+1.2,low:p-1.2,close:p+0.2,volume:1000+i%7*10};});
}
const now=anchor+200*60000;
test('B79 accepts ordered OHLCV, computes ten bounded historical readings',()=>{
 const a=studyHistoricalCandles(series(),{now});
 assert.equal(a.indicators.length,10);assert(a.indicators.every(s=>['alta','baixa','neutro'].includes(s.direction)));
 assert.equal(a.providerVerified,false);assert.equal(a.live,false);
 assert.equal(a.orderAuthorized,false);assert.equal(a.profitPrediction,null);
});
test('B79 no future, reverse-order, crossed OHLC or negative volume qualifies',()=>{
 const s=series();
 assert.throws(()=>normalizeHistoricalCandles(s.slice(0,59),now),/UNSUPPORTED_SAMPLE_SIZE/);
 assert.throws(()=>normalizeHistoricalCandles([...s.slice(0,-1),{...s.at(-1),time:s.at(-2).time}],now));
 assert.throws(()=>normalizeHistoricalCandles([...s.slice(0,-1),{...s.at(-1),high:0}],now));
 assert.throws(()=>normalizeHistoricalCandles([...s.slice(0,-1),{...s.at(-1),volume:-1}],now));
 assert.throws(()=>normalizeHistoricalCandles(series(),anchor+1000));
});
test('B79 falling or flat markets are not always classified as rising',()=>{
 const falling=studyHistoricalCandles(series(90,-0.25),{now});
 const rising=studyHistoricalCandles(series(),{now});
 assert.equal(falling.indicators.length,10);
 assert.notEqual(falling.indicators.find(s=>s.id==='sma').direction,rising.indicators.find(s=>s.id==='sma').direction);
});
test('B79 timeframe changes only the label, not the data origin or permissions',()=>{
 const a=studyHistoricalCandles(series(),{timeframe:'intraday',now});
 assert.equal(a.timeframe,'intraday');
 assert.equal(a.source,'user_supplied_historical_unverified');
 assert.equal(a.orderAuthorized,false);
 assert.throws(()=>studyHistoricalCandles(series(),{timeframe:'live',now}),/INVALID_TIMEFRAME/);
});
