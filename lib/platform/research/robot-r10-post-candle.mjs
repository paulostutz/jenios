/** R10 observation of exact precommitted future BTC-USD candle. No orders. */
import {createHash} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';
import {parseR7Coinbase,parseR7Kraken} from './robot-r7-public-h1.mjs';
const die=c=>{throw Object.assign(new Error(c),{code:c});};
const OPEN=Date.parse('2026-10-22T13:00:00Z'),CLOSE=OPEN+3600000;
const DIGEST='2b9734aada05ad3fcbfbcb9f0d24859dfd17547cb9e16d3424c27681fb21a36d';
const hex=x=>createHash('sha256').update(canonical(x)).digest('hex');
export const R10_PROTOCOL=Object.freeze({openMs:OPEN,closeMs:CLOSE,
 earliestObserveMs:CLOSE+600000,precommitDigest:DIGEST,
 publicCommitSha:'8ada1a2a4166f02a88b645e3473543a44197b9ab',
 dataSignedByExchange:false,privateCoreIndependentlyAttested:false});
export function verifyR10Commit(privateRecord,publicRecord){
 if(!privateRecord||!publicRecord||hex(privateRecord)!==DIGEST||
  publicRecord.commitmentSha256!==DIGEST||
  publicRecord.futureTargetOpenMs!==OPEN||
  publicRecord.futureTargetCloseMs!==CLOSE||
  privateRecord.targetOpenMs!==OPEN||privateRecord.targetCloseMs!==CLOSE||
  !Array.isArray(privateRecord.modeResults)||privateRecord.modeResults.length!==6||
  privateRecord.modeResults.some(x=>x.action!=='wait_for_context'||x.side!==null))
  die('R10_PRECOMMIT_INTEGRITY_FAILURE');
 return Object.freeze({digestMatched:true,allModesAbstained:true,
  externalRuntimeAttestation:false,ordersSent:0,actualPnl:null});
}
export function planR10Observation(nowMs){
 if(!Number.isSafeInteger(nowMs)||nowMs<CLOSE+600000)die('R10_WAIT_UNTIL_CLOSED_PLUS_TEN_MINUTES');
 const cb=new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
 cb.searchParams.set('start',new Date(OPEN).toISOString());
 cb.searchParams.set('end',new Date(CLOSE).toISOString());
 cb.searchParams.set('granularity','3600');
 const kr=new URL('https://api.kraken.com/0/public/OHLC');
 kr.searchParams.set('pair','XBTUSD');kr.searchParams.set('interval','60');
 kr.searchParams.set('since',String(OPEN/1000));
 return Object.freeze({nowMs,openMs:OPEN,closeMs:CLOSE,coinbaseUrl:cb.href,krakenUrl:kr.href});
}
async function getJson(url,origin,fetcher){
 if(new URL(url).origin!==origin)die('R10_URL_NOT_ALLOWED');
 let r;try{r=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
 cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});}
 catch{die('R10_PUBLIC_GET_FAILED');}
 if(r?.status!==200)die('R10_BAD_PUBLIC_HTTP');
 let s;try{s=await r.text();}catch{die('R10_UNREADABLE_HTTP');}
 if(s.length>150000)die('R10_HTTP_TOO_LARGE');
 try{return JSON.parse(s);}catch{die('R10_BAD_HTTP_JSON');}
}
export async function inspectR10FutureCandle({plan,observedAtMs,fetcher=fetch}={}){
 if(!plan||!Number.isSafeInteger(observedAtMs)||observedAtMs<plan.nowMs||
  JSON.stringify(plan)!==JSON.stringify(planR10Observation(plan.nowMs)))
  die('R10_CHANGED_PLAN');
 const cb=await getJson(plan.coinbaseUrl,'https://api.exchange.coinbase.com',fetcher);
 const kr=await getJson(plan.krakenUrl,'https://api.kraken.com',fetcher);
 const a=parseR7Coinbase(cb,plan),b=parseR7Kraken(kr,plan);
 const difference=Math.abs(a.close-b.close)/(a.close+b.close)*20000;
 const otherDifference=Math.max(...['open','high','low'].map(field=>
  Math.abs(a[field]-b[field])/(a[field]+b[field])*20000));
 const identical=['open','high','low','close','volume'].every(field=>a[field]===b[field]);
 if(!Number.isFinite(difference)||!Number.isFinite(otherDifference))
  die('R10_NONFINITE_PRICE_DISAGREEMENT');
 const issues=[];
 if(difference>50)issues.push('PRICE_DIVERGENCE');
 if(otherDifference>150)issues.push('OHLC_DIVERGENCE');
 if(identical)issues.push('SUSPICIOUS_IDENTICAL_UNWITNESSED_DATA');
 return Object.freeze({schema:'JENIOS_R10_POST_CANDLE_READ_ONLY_V1',
  precommitDigest:DIGEST,targetOpenMs:OPEN,targetCloseMs:CLOSE,
  observedAtMs,coinbase:a,kraken:b,closeDifferenceBps:Number(difference.toFixed(6)),
  issues,ohlcDifferenceBps:Number(otherDifference.toFixed(6)),priceConsistencyWithinResearchThresholds:issues.length===0,sourceSigned:false,independentSourceAttested:false,
  originalEnginePrivatelyAttested:false,allSixOriginalDecisions:'ABSTAIN',
  entries:0,lossesAvoided:null,tradingProfit:null,
  tradeAccuracy:null,ordersSent:0,paperOrdersSent:0,
  commercialPerformanceCertified:false});
}
