/**
 * ROBOT R14 post-candle observer.
 * Public, read-only Coinbase + Kraken collection for the exact precommitted H1.
 * No broker transport, orders, Paper, private engine import, paid service, or deployment.
 */
import {createHash} from 'node:crypto';
import {parseR7Coinbase,parseR7Kraken} from './robot-r7-public-h1.mjs';

const die=code=>{throw Object.assign(new Error(code),{code});};
const OPEN=Date.parse('2026-10-22T19:00:00.000Z');
const CLOSE=Date.parse('2026-10-22T20:00:00.000Z');
const EARLIEST=CLOSE+600000;
const PRECOMMIT='94ab2789d74b709fa86d7afaceb767532d1c5e8c39c34fac8ebb9a09981b5fba';
const COMMIT='2875bbf78eec7a9fc49d5695730015b5410aa977';
const CB='https://api.exchange.coinbase.com';
const KR='https://api.kraken.com';
const hash=s=>createHash('sha256').update(s).digest('hex');
const bps=(a,b)=>Math.abs(a-b)/((a+b)/2)*10000;

export const R14_POST_PROTOCOL=Object.freeze({
 schema:'JENIOS_R14_POST_CANDLE_READONLY_V1',
 asset:'BTC-USD',
 openMs:OPEN,
 closeMs:CLOSE,
 earliestObserveMs:EARLIEST,
 privatePrecommitSha256:PRECOMMIT,
 publicPrecommitCommitSha:COMMIT,
 sourceProviders:Object.freeze(['coinbase','kraken']),
 brokerOrdersAllowed:false,
 paperOrdersAllowed:false,
 performanceCertificationAllowed:false
});

export function planR14Observation(nowMs){
 if(!Number.isSafeInteger(nowMs)||nowMs<EARLIEST)
  die('R14_WAIT_UNTIL_2026_10_22_20_10_UTC');
 const cb=new URL(CB+'/products/BTC-USD/candles');
 cb.searchParams.set('start',new Date(OPEN).toISOString());
 cb.searchParams.set('end',new Date(CLOSE).toISOString());
 cb.searchParams.set('granularity','3600');
 const kr=new URL(KR+'/0/public/OHLC');
 kr.searchParams.set('pair','XBTUSD');
 kr.searchParams.set('interval','60');
 kr.searchParams.set('since',String(OPEN/1000));
 return Object.freeze({
  schema:'JENIOS_R14_PUBLIC_OUTCOME_PLAN_V1',
  nowMs,asset:'BTC-USD',openMs:OPEN,closeMs:CLOSE,
  coinbaseUrl:cb.href,krakenUrl:kr.href,
  precommitSha256:PRECOMMIT,precommitCommitSha:COMMIT
 });
}

async function read(url,origin,fetcher){
 const u=new URL(url);
 if(u.origin!==origin||u.protocol!=='https:')die('R14_URL_NOT_ALLOWED');
 let response;
 try{
  response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
   cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
 }catch{die('R14_PUBLIC_GET_FAILED');}
 if(response?.status!==200)die('R14_BAD_PUBLIC_HTTP');
 let text;
 try{text=await response.text();}catch{die('R14_UNREADABLE_HTTP');}
 if(text.length>150000)die('R14_HTTP_TOO_LARGE');
 let json;
 try{json=JSON.parse(text);}catch{die('R14_BAD_HTTP_JSON');}
 return Object.freeze({text,json});
}

export async function captureR14Outcome({plan,observedAtMs,fetcher=fetch}={}){
 if(!plan||!Number.isSafeInteger(observedAtMs)||observedAtMs<plan.nowMs||
  JSON.stringify(plan)!==JSON.stringify(planR14Observation(plan.nowMs)))
  die('R14_CHANGED_OR_EARLY_PLAN');
 const cb=await read(plan.coinbaseUrl,CB,fetcher);
 const kr=await read(plan.krakenUrl,KR,fetcher);
 const coinbase=parseR7Coinbase(cb.json,plan);
 const kraken=parseR7Kraken(kr.json,{...plan,asset:'BTC-USD'});
 const closeDifferenceBps=bps(coinbase.close,kraken.close);
 const ohlcDifferenceBps=Math.max(...['open','high','low'].map(k=>bps(coinbase[k],kraken[k])));
 const identical=['open','high','low','close','volume'].every(k=>coinbase[k]===kraken[k]);
 if(!Number.isFinite(closeDifferenceBps)||!Number.isFinite(ohlcDifferenceBps))
  die('R14_NONFINITE_PRICE_DIFFERENCE');
 const issues=[];
 if(closeDifferenceBps>50)issues.push('CLOSE_DIVERGENCE');
 if(ohlcDifferenceBps>150)issues.push('OHLC_DIVERGENCE');
 if(identical)issues.push('IDENTICAL_UNATTESTED_DATA');
 const observation=Object.freeze({
  schema:'JENIOS_R14_POST_CANDLE_READONLY_V1',
  asset:'BTC-USD',
  precommitSha256:PRECOMMIT,
  precommitCommitSha:COMMIT,
  targetOpenMs:OPEN,targetCloseMs:CLOSE,observedAtMs,
  coinbase,kraken,
  rawResponseSha256:Object.freeze({coinbase:hash(cb.text),kraken:hash(kr.text)}),
  closeDifferenceBps:Number(closeDifferenceBps.toFixed(6)),
  ohlcDifferenceBps:Number(ohlcDifferenceBps.toFixed(6)),
  issues:Object.freeze(issues),
  publicPriceConsistencyPassed:issues.length===0,
  sourceProviderSignaturesVerified:false,
  independentTimestampNotaryVerified:false,
  privateRuntimeIdentityIndependentlyVerified:false,
  brokerOrdersSent:0,paperOrdersSent:0,
  actualBrokerRealizedPnl:null,actualLossesAvoided:null,tradeAccuracy:null,
  commercialPerformanceCertified:false,
  classification:'PUBLIC_READONLY_OUTCOME_EVIDENCE_NOT_BROKER_PERFORMANCE'
 });
 return Object.freeze({
  observation,
  raw:Object.freeze({coinbase:cb.text,kraken:kr.text})
 });
}
