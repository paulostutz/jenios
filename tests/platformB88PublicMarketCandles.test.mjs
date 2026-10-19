import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicCandleQuery,parsePublicCandles,fetchPublicCandles}
 from '../lib/platform/public-market-candles.mjs';
const bucket=Math.floor(Date.parse('2026-10-19T18:00:00Z')/300000)*300000;
const now=bucket+120000;
function sample(count=120){
 const lastOpen=Math.floor(bucket/1000)-300;
 return Array.from({length:count},(_,i)=>{
  const p=60000+i*4;return [lastOpen-300*(count-i-1),p-10,p+10,p,p+2,5+i%4];
 }).reverse();
}
test('B88 public candles source only permits fixed exchange host, listed pairs and granularity',()=>{
 const url=publicCandleQuery('BTC-USD',300,now).url;
 assert.match(url,/^https:\/\/api\.exchange\.coinbase\.com\/products\/BTC-USD\/candles\?/);
 for(const bad of ['../orders','https://evil.invalid','WIN1!','BTC-USD?key=x']){
  assert.throws(()=>publicCandleQuery(bad,300,now),/UNSUPPORTED_PUBLIC_MARKET/);
 }
 assert.throws(()=>publicCandleQuery('BTC-USD',123,now),/UNSUPPORTED_PUBLIC_MARKET/);
});
test('B88 validated provider rows are ascending, completed and cannot include the active bucket',()=>{
 const response=parsePublicCandles([...sample(),[Math.floor(bucket/1000),1,3,2,2,99]],
  {product:'BTC-USD',granularity:300,now});
 assert.equal(response.available,true);assert.equal(response.candles.length,120);
 assert.equal(response.lastCompleteCandle,new Date(bucket-300000).toISOString());
 assert.equal(response.candles[0].time,new Date(bucket-120*300000).toISOString());
 assert.equal(response.liveStream,false);assert.equal(response.brokerConnected,false);
});
test('B88 missing provider candles block rather than invent OHLC values',()=>{
 const rows=sample();rows.splice(30,15);
 const out=parsePublicCandles(rows,{product:'BTC-USD',granularity:300,now});
 assert.equal(out.available,false);assert.deepEqual(out.candles,[]);
 assert.equal(out.reason,'CANDLE_QUALITY_FAILED');
});
test('B88 old data block source confirmation and errors remain fail-closed',()=>{
 const rows=sample().map(x=>[x[0]-3600,...x.slice(1)]);
 const result=parsePublicCandles(rows,{product:'BTC-USD',granularity:300,now});
 assert.equal(result.available,false);assert.equal(result.reason,'STALE_CANDLES');
});
test('B88 strictly read-only HTTP provider with no auth, secret or trade endpoint',async()=>{
 let request=null;
 const obj=await fetchPublicCandles('ETH-USD',300,{now,fetchImpl:async(url,options)=>{
  request={url,options};return {ok:true,json:async()=>sample()};
 }});
 assert.equal(obj.product,'ETH-USD');assert.equal(obj.historicalOnly,true);
 assert.equal(request.options.method,'GET');
 assert.equal(request.options.redirect,'error');
 assert.doesNotMatch(JSON.stringify(request),/Authorization|Bearer|api-key|\/orders/);
});
test('B88 server API refuses arbitrary URLs and has no trading or payment methods',()=>{
 const src=readFileSync('app/api/platform/market-observation/route.js','utf8');
 assert.match(src,/export async function GET\(request\)/);
 assert.doesNotMatch(src,/export async function POST|checkoutService|requirePayUser|createClient|service_role/);
 assert.match(src,/PUBLIC_MARKET_PRODUCTS\.includes\(product\)/);
 assert.match(src,/MARKET_UNAVAILABLE/);
});
