/** R7: exactly two unauthenticated public GETs for a fully closed H1. No orders. */
import {createHash} from 'node:crypto';
const H=3600000,G=600000;const die=c=>{throw Object.assign(new Error(c),{code:c})};
const PAIRS={'BTC-USD':'XBTUSD','ETH-USD':'ETHUSD','SOL-USD':'SOLUSD'};
const hex=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bps=(a,b)=>Math.abs(a-b)/(a+b)*20000;
export function planR7({nowMs,asset='BTC-USD'}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<3*H||!Object.hasOwn(PAIRS,asset))die('R7_INVALID_INPUT');
 const closeMs=Math.floor((nowMs-G)/H)*H,openMs=closeMs-H;
 const a=new URL('https://api.exchange.coinbase.com/products/'+asset+'/candles');
 a.searchParams.set('start',new Date(openMs).toISOString());a.searchParams.set('end',new Date(closeMs).toISOString());a.searchParams.set('granularity','3600');
 const b=new URL('https://api.kraken.com/0/public/OHLC');
 b.searchParams.set('pair',PAIRS[asset]);b.searchParams.set('interval','60');b.searchParams.set('since',String(openMs/1000));
 return Object.freeze({asset,nowMs,openMs,closeMs,urls:Object.freeze([a.href,b.href])});
}
function ohlc(o,h,l,c,v){
 const a=[o,h,l,c,v].map(Number);
 if(a.some(x=>!Number.isFinite(x)||x<=0)||a[1]<Math.max(a[0],a[2],a[3])||a[2]>Math.min(a[0],a[3])||a[1]/a[2]>1.5)die('R7_INVALID_CANDLE');
 return Object.freeze({open:a[0],high:a[1],low:a[2],close:a[3],volume:a[4]});
}
export function parseR7Coinbase(raw,plan){
 if(!Array.isArray(raw)||raw.length>300||raw.some(x=>!Array.isArray(x)||x.length!==6||!Number.isSafeInteger(x[0])))die('R7_BAD_COINBASE');
 const rows=raw.filter(x=>x[0]*1000===plan.openMs);
 if(rows.length!==1)die('R7_MISSING_COINBASE_HOUR');
 const [t,l,h,o,c,v]=rows[0];return Object.freeze({t:t*1000,...ohlc(o,h,l,c,v)});
}
export function parseR7Kraken(raw,plan){
 if(!raw||!Array.isArray(raw.error)||raw.error.length||!raw.result||typeof raw.result!=='object')die('R7_BAD_KRAKEN');
 const keys=Object.keys(raw.result).filter(k=>k!=='last');
 const allowedPairKeys={'BTC-USD':['XXBTZUSD','XBTUSD'],
  'ETH-USD':['XETHZUSD','ETHUSD'],'SOL-USD':['SOLUSD']};
 if(keys.length!==1||!allowedPairKeys[plan.asset]?.includes(keys[0])||
  !Array.isArray(raw.result[keys[0]])||raw.result[keys[0]].length>720)
  die('R7_KRAKEN_PAIR_AMBIGUOUS');
 const all=raw.result[keys[0]];
 if(all.some(x=>!Array.isArray(x)||x.length!==8||!Number.isSafeInteger(x[0])))die('R7_BAD_KRAKEN_ROW');
 const rows=all.filter(x=>x[0]*1000===plan.openMs);
 if(rows.length!==1)die('R7_MISSING_KRAKEN_HOUR');
 const [t,o,h,l,c,_vwap,v]=rows[0];return Object.freeze({t:t*1000,...ohlc(o,h,l,c,v)});
}
async function readPublic(url,origin,fetcher){
 const u=new URL(url);if(u.origin!==origin||u.protocol!=='https:')die('R7_DENIED_URL');
 let response;
 try{response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});}
 catch{die('R7_NETWORK_UNAVAILABLE')}
 if(response?.status!==200)die('R7_HTTP_ERROR');
 let content;try{content=await response.text()}catch{die('R7_UNREADABLE_RESPONSE')}
 if(content.length>150000)die('R7_OVERSIZED_RESPONSE');
 try{return JSON.parse(content)}catch{die('R7_NON_JSON_RESPONSE')}
}
export async function inspectR7PublicHour({plan,fetcher=fetch,observedAtMs}={}){
 if(!plan||!Number.isSafeInteger(observedAtMs)||observedAtMs<plan.nowMs||
 JSON.stringify(plan)!==JSON.stringify(planR7({nowMs:plan.nowMs,asset:plan.asset})))die('R7_TAMPERED_PLAN');
 const cb=await readPublic(plan.urls[0],'https://api.exchange.coinbase.com',fetcher);
 const kr=await readPublic(plan.urls[1],'https://api.kraken.com',fetcher);
 const a=parseR7Coinbase(cb,plan),b=parseR7Kraken(kr,plan);
 const close=bps(a.close,b.close),other=Math.max(...['open','high','low'].map(k=>bps(a[k],b[k])));
 const issues=[];if(close>50)issues.push('CLOSE_DIVERGENCE');
 if(other>150)issues.push('OHLC_DIVERGENCE');
 if(['open','high','low','close','volume'].every(k=>a[k]===b[k]))issues.push('IDENTICAL_UNATTESTED_DATA');
 return Object.freeze({schema:'JENIOS_R7_PUBLIC_READONLY_H1_V1',asset:plan.asset,openMs:plan.openMs,closeMs:plan.closeMs,localObservedAtMs:observedAtMs,
 responseSha256:{coinbase:hex(cb),kraken:hex(kr)},closeDifferenceBps:Number(close.toFixed(6)),otherDifferenceBps:Number(other.toFixed(6)),
 issues,publicHttpsRequestsObserved:2,sourceProviderSignaturesVerified:false,independentlyWitnessedTimestamp:false,
 originalPrivateEngineSignalsVerified:false,prospectivePredictionVerified:false,realizedPnl:null,actualLossesAvoided:null,
 tradingAuthorized:false,ordersSent:0,paperOrdersSent:0,status:'PUBLIC_PAST_DATA_NOT_TRADING_EVIDENCE'});
}
