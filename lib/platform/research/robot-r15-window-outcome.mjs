/**
 * ROBOT R15 — generic read-only post-window observer.
 * Accepts only frozen cohort windows and exact public preregistration digests.
 * No broker transport, Paper, paid services, private-core import, or PnL claims.
 */
import {createHash} from 'node:crypto';
import {parseR7Coinbase,parseR7Kraken} from './robot-r7-public-h1.mjs';
import {R15_COHORT,validateR15Outcome} from './robot-r15-multiwindow-protocol.mjs';

const die=code=>{throw Object.assign(new Error(code),{code});};
const CB='https://api.exchange.coinbase.com';
const KR='https://api.kraken.com';
const hash=s=>createHash('sha256').update(s).digest('hex');
const bps=(a,b)=>Math.abs(a-b)/((a+b)/2)*10000;
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);

function getWindow(windowId){
 const w=R15_COHORT.windows.find(x=>x.id===windowId);
 if(!w)die('R15_OUTCOME_UNKNOWN_WINDOW');
 return w;
}

export function planR15WindowOutcome({windowId,precommitSha256,nowMs}={}){
 const w=getWindow(windowId);
 if(!hex64(precommitSha256))die('R15_OUTCOME_BAD_PRECOMMIT');
 if(!Number.isSafeInteger(nowMs)||nowMs<w.closeMs+600000)
  die('R15_OUTCOME_WAIT_UNTIL_CLOSED_PLUS_TEN_MINUTES');
 const cb=new URL(CB+'/products/BTC-USD/candles');
 cb.searchParams.set('start',new Date(w.openMs).toISOString());
 cb.searchParams.set('end',new Date(w.closeMs).toISOString());
 cb.searchParams.set('granularity','3600');
 const kr=new URL(KR+'/0/public/OHLC');
 kr.searchParams.set('pair','XBTUSD');
 kr.searchParams.set('interval','60');
 kr.searchParams.set('since',String(w.openMs/1000));
 return Object.freeze({
  schema:'JENIOS_R15_WINDOW_OUTCOME_PLAN_V1',
  studyId:R15_COHORT.studyId,windowId,asset:'BTC-USD',
  openMs:w.openMs,closeMs:w.closeMs,nowMs,precommitSha256,
  coinbaseUrl:cb.href,krakenUrl:kr.href
 });
}

async function read(url,origin,fetcher){
 const u=new URL(url);
 if(u.origin!==origin||u.protocol!=='https:')die('R15_OUTCOME_URL_NOT_ALLOWED');
 let response;
 try{
  response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
   cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
 }catch{die('R15_OUTCOME_PUBLIC_GET_FAILED');}
 if(response?.status!==200)die('R15_OUTCOME_BAD_HTTP');
 let text;
 try{text=await response.text();}catch{die('R15_OUTCOME_UNREADABLE_HTTP');}
 if(text.length>150000)die('R15_OUTCOME_HTTP_TOO_LARGE');
 let json;
 try{json=JSON.parse(text);}catch{die('R15_OUTCOME_BAD_JSON');}
 return Object.freeze({text,json});
}

export async function captureR15WindowOutcome({plan,observedAtMs,fetcher=fetch}={}){
 if(!plan||!Number.isSafeInteger(observedAtMs)||observedAtMs<plan.nowMs||
  JSON.stringify(plan)!==JSON.stringify(planR15WindowOutcome({
   windowId:plan.windowId,precommitSha256:plan.precommitSha256,nowMs:plan.nowMs
  }))) die('R15_OUTCOME_CHANGED_PLAN');

 const cb=await read(plan.coinbaseUrl,CB,fetcher);
 const kr=await read(plan.krakenUrl,KR,fetcher);
 const coinbase=parseR7Coinbase(cb.json,plan);
 const kraken=parseR7Kraken(kr.json,{...plan,asset:'BTC-USD'});
 const closeDifferenceBps=bps(coinbase.close,kraken.close);
 const ohlcDifferenceBps=Math.max(...['open','high','low'].map(k=>bps(coinbase[k],kraken[k])));
 const identical=['open','high','low','close','volume'].every(k=>coinbase[k]===kraken[k]);
 if(!Number.isFinite(closeDifferenceBps)||!Number.isFinite(ohlcDifferenceBps))
  die('R15_OUTCOME_NONFINITE_DIFFERENCE');
 const issues=[];
 if(closeDifferenceBps>50)issues.push('CLOSE_DIVERGENCE');
 if(ohlcDifferenceBps>150)issues.push('OHLC_DIVERGENCE');
 if(identical)issues.push('IDENTICAL_UNATTESTED_DATA');

 const validated=Object.freeze({
  schema:'JENIOS_R15_WINDOW_OUTCOME_V1',
  studyId:R15_COHORT.studyId,windowId:plan.windowId,
  precommitSha256:plan.precommitSha256,
  observedAtMs,
  coinbaseSha256:hash(cb.text),
  krakenSha256:hash(kr.text),
  publicPriceConsistencyPassed:issues.length===0,
  brokerOrdersSent:0,paperOrdersSent:0,
  actualBrokerPnl:null,actualLossesAvoided:null,
  commercialPerformanceCertified:false
 });
 validateR15Outcome(validated,{reviewedAtMs:observedAtMs});

 return Object.freeze({
  observation:Object.freeze({
   ...validated,
   targetOpenMs:plan.openMs,targetCloseMs:plan.closeMs,
   coinbase,kraken,
   closeDifferenceBps:Number(closeDifferenceBps.toFixed(6)),
   ohlcDifferenceBps:Number(ohlcDifferenceBps.toFixed(6)),
   issues:Object.freeze(issues),
   sourceProviderSignaturesVerified:false,
   independentTimestampNotaryVerified:false,
   tradeAccuracy:null,
   classification:'PUBLIC_READONLY_WINDOW_OUTCOME_NOT_BROKER_PERFORMANCE'
  }),
  raw:Object.freeze({coinbase:cb.text,kraken:kr.text})
 });
}
