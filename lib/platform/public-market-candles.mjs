/** B88 — Coinbase Exchange public REST candles, read-only and source-bounded.
 * No brokerage credentials, order routes, user data, billing or authenticated endpoints.
 * Coinbase historical candles can be incomplete; missing buckets are never invented.
 */
import {normalizeHistoricalCandles} from './market-study.mjs';
import {inspectHistoricalBars} from './historical-quality.mjs';
const PRODUCTS=Object.freeze(['BTC-USD','ETH-USD','SOL-USD']);
const GRANULARITIES=Object.freeze([60,300,3600]);
const ORIGIN='https://api.exchange.coinbase.com';
export const PUBLIC_MARKET_PRODUCTS=PRODUCTS;
export const PUBLIC_MARKET_GRANULARITIES=GRANULARITIES;
const fail=(code,codeStatus=503)=>Object.assign(new Error(code),{code,codeStatus});
export function publicCandleQuery(product,granularity,now=Date.now()){
 if(!PRODUCTS.includes(product)||!GRANULARITIES.includes(granularity))
  throw fail('UNSUPPORTED_PUBLIC_MARKET',400);
 if(!Number.isSafeInteger(now)||now<1)throw fail('INVALID_CLOCK',400);
 const duration=granularity*1000,end=Math.floor(now/duration)*duration;
 const start=end-200*duration;
 return {url:ORIGIN+'/products/'+product+'/candles?'+new URLSearchParams({
  granularity:String(granularity),start:new Date(start).toISOString(),
  end:new Date(end).toISOString()
 }),start,end,duration};
}
export function parsePublicCandles(payload,{product,granularity,now=Date.now()}){
 const q=publicCandleQuery(product,granularity,now);
 if(!Array.isArray(payload)||payload.length>305)throw fail('INVALID_PROVIDER_DATA');
 const normalized=payload.map((x,i)=>{
  if(!Array.isArray(x)||x.length<6)throw fail('INVALID_PROVIDER_CANDLE_'+i);
  const [timestamp,low,high,open,close,volume]=x;
  const vals=[low,high,open,close,volume].map(Number);
  if(!Number.isSafeInteger(timestamp)||!vals.every(Number.isFinite))
   throw fail('INVALID_PROVIDER_CANDLE_'+i);
  return {time:new Date(timestamp*1000).toISOString(),low:vals[0],high:vals[1],
   open:vals[2],close:vals[3],volume:vals[4],timestamp:timestamp*1000};
 }).filter(x=>x.timestamp>=q.start&&x.timestamp+q.duration<=q.end)
  .sort((a,b)=>a.timestamp-b.timestamp);
 if(normalized.length<60||normalized.length>200)throw fail('INSUFFICIENT_COMPLETE_CANDLES');
 for(let i=1;i<normalized.length;i++)
  if(normalized[i].timestamp===normalized[i-1].timestamp)throw fail('DUPLICATE_PROVIDER_TIMESTAMP');
 const candles=normalizeHistoricalCandles(normalized,now).map(({time,open,high,low,close,volume})=>({
  time,open,high,low,close,volume
 }));
 const last=Date.parse(candles.at(-1).time);
 const ageMs=q.end-(last+q.duration);
 const quality=inspectHistoricalBars(candles,{now});
 const hasFreshClose=ageMs>=0&&ageMs<=q.duration*3;
 return {
  available:hasFreshClose&&quality.replayEligible,
  provider:'coinbase_exchange_public_rest',product,granularity,
  obtainedAt:new Date(now).toISOString(),lastCompleteCandle:candles.at(-1).time,
  sampleCount:candles.length,ageMs,
  provenance:'provider_http_response_unverified_license',historicalOnly:true,
  liveStream:false,authenticatedFeed:false,brokerConnected:false,
  quality:{replayEligible:quality.replayEligible,gaps:quality.gaps.length,
   zeroVolume:quality.zeroVolume,warnings:quality.warnings},
  candles:hasFreshClose&&quality.replayEligible?candles:[],
  reason:!hasFreshClose?'STALE_CANDLES':!quality.replayEligible?'CANDLE_QUALITY_FAILED':null
 };
}
export async function fetchPublicCandles(product,granularity,{fetchImpl=fetch,now=Date.now()}={}){
 const q=publicCandleQuery(product,granularity,now);
 let response;
 try{
  response=await fetchImpl(q.url,{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'},
   signal:typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(8000):undefined
  });
 }catch{throw fail('MARKET_PROVIDER_UNREACHABLE');}
 if(!response?.ok)throw fail('MARKET_PROVIDER_UNAVAILABLE');
 let body;
 try{body=await response.json();}catch{throw fail('INVALID_PROVIDER_RESPONSE');}
 const result=parsePublicCandles(body,{product,granularity,now});
 if(!result.available)throw fail(result.reason);
 return result;
}
