/** B278 — read-only historical OHLCV intake for JENIOS research.
 * Coinbase Exchange PUBLIC spot BTC-USD, ETH-USD, SOL-USD. The quote currency is
 * USD, NEVER USDT. No broker auth, orders, payments, live feed or robot imports.
 * HTTP data is unsigned, potentially incomplete and subject to provider terms.
 */
import {createHash} from 'node:crypto';

const HOUR=3600000;
const BASE_URL='https://api.exchange.coinbase.com';
const fail=(code,details)=>{throw Object.assign(new Error(code),{code,...(details?{details}:{})});};
const safe=x=>Number.isSafeInteger(x)&&x>0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const asIso=ms=>new Date(ms).toISOString();
export const B278_PRODUCTS=Object.freeze([
 Object.freeze({id:'BTC-USD',asset:'BTC',quoteCurrency:'USD',unmappedRobotSymbol:'BTCUSDT'}),
 Object.freeze({id:'ETH-USD',asset:'ETH',quoteCurrency:'USD',unmappedRobotSymbol:'ETHUSDT'}),
 Object.freeze({id:'SOL-USD',asset:'SOL',quoteCurrency:'USD',unmappedRobotSymbol:'SOLUSDT'})
]);
export const B278_TARGET_HOURLY_CANDLES=960;
export const B278_TRAIN_BARS=600;
export const B278_EMBARGO_BARS=48;
export const B278_HOLDOUT_BARS=312;
export const B278_MAX_CANDLES_PER_REQUEST=200;
export const B278_SOURCE='coinbase_exchange_public_spot_candles';
const lookup=id=>B278_PRODUCTS.find(row=>row.id===id);

export function buildHistoricalPlan({product,startMs,endMs,asOfMs,maxPageCandles=200}={}){
 const productInfo=lookup(product);
 if(!productInfo)fail('B278_UNSUPPORTED_SPOT_PRODUCT');
 if(![startMs,endMs,asOfMs].every(safe)||[startMs,endMs].some(t=>t%HOUR!==0)||
  startMs>=endMs||endMs>asOfMs-HOUR)fail('B278_INVALID_OR_UNCLOSED_TIME_WINDOW');
 const count=(endMs-startMs)/HOUR;
 if(count!==B278_TARGET_HOURLY_CANDLES)fail('B278_REQUIRE_FIXED_960_CLOSED_CANDLES');
 if(!Number.isSafeInteger(maxPageCandles)||maxPageCandles<48||maxPageCandles>B278_MAX_CANDLES_PER_REQUEST)
  fail('B278_UNSAFE_PAGE_SIZE');
 const pages=[];
 for(let i=0;i<count;i+=maxPageCandles){
  const from=startMs+i*HOUR,to=Math.min(endMs,from+maxPageCandles*HOUR);
  const url=new URL(BASE_URL+'/products/'+product+'/candles');
  url.searchParams.set('granularity','3600');
  url.searchParams.set('start',asIso(from));
  url.searchParams.set('end',asIso(to));
  pages.push(Object.freeze({startMs:from,endMs:to,candles:(to-from)/HOUR,url:url.href}));
 }
 return Object.freeze({schema:'JENIOS_B278_HISTORICAL_PLAN_V1',source:B278_SOURCE,
  product,baseAsset:productInfo.asset,quoteCurrency:'USD',intervalMs:HOUR,
  startMs,endMs,expectedCandles:count,pages:Object.freeze(pages),
  includesLiveQuote:false,brokerAuthRequired:false,ordersAllowed:false,
  usdtEquivalent:false,sourceResponseSigned:false});
}
export function planRecentClosedPeriod(product,{now=Date.now()}={}){
 if(!safe(now))fail('B278_INVALID_CLOCK');
 // The final requested candle closed at least TWO hours before the query.
 const endMs=Math.floor((now-2*HOUR)/HOUR)*HOUR;
 return buildHistoricalPlan({product,startMs:endMs-B278_TARGET_HOURLY_CANDLES*HOUR,
  endMs,asOfMs:now});
}
function parsePage(payload,page,intervalMs=HOUR){
 if(!Array.isArray(payload)||payload.length>B278_MAX_CANDLES_PER_REQUEST+100)
  fail('B278_INVALID_PROVIDER_BATCH');
 const selected=[],seen=new Set();
 for(const source of payload){
  if(!Array.isArray(source)||source.length!==6)fail('B278_INVALID_PROVIDER_RECORD');
  const [seconds,low,high,open,close,volume]=source;
  if(!Number.isSafeInteger(seconds)||seconds<=0||![low,high,open,close,volume].every(finite))
   fail('B278_INVALID_CANDLE_NUMBER');
  const t=seconds*1000;
  if(!Number.isSafeInteger(t)||t%intervalMs!==0)fail('B278_UNALIGNED_CANDLE');
  if(t<page.startMs||t>=page.endMs)continue; // Provider may include adjacent buckets.
  if(seen.has(t))fail('B278_DUPLICATE_PROVIDER_CANDLE');
  seen.add(t);
  if(open<=0||close<=0||low<=0||volume<0||high<Math.max(open,close,low)||
   low>Math.min(open,close)||high/low>1.5)fail('B278_INVALID_OHLCV_OR_EXTREME_RANGE');
  selected.push(Object.freeze({t,open,high,low,close,volume}));
 }
 selected.sort((a,b)=>a.t-b.t);
 if(selected.length!==page.candles)fail('B278_PROVIDER_MISSING_CANDLE',{
  expected:page.candles,received:selected.length,first:page.startMs,last:page.endMs
 });
 for(let i=0;i<selected.length;i++)
  if(selected[i].t!==page.startMs+i*intervalMs)fail('B278_PROVIDER_GAP_OR_MISORDER');
 return selected;
}
/** Public GET is deliberately injectable; tests never contact the provider.
 * The configured runner fetch makes only allowlisted GET requests. No retries of
 * rejected/ambiguous market-data responses; a failure does not produce partial OK.
 */
export async function collectPublicHistoricalPlan(plan,{
 fetchImpl=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 spacingMs=450
}={}){
 if(!plan||plan.schema!=='JENIOS_B278_HISTORICAL_PLAN_V1'||
  plan.quoteCurrency!=='USD'||plan.intervalMs!==HOUR||
  plan.expectedCandles!==B278_TARGET_HOURLY_CANDLES||
  plan.source!==B278_SOURCE||
  !lookup(plan.product))fail('B278_INVALID_INTAKE_PLAN');
 if(typeof fetchImpl!=='function'||typeof pause!=='function'||
  !Number.isSafeInteger(spacingMs)||spacingMs<0||spacingMs>5000)fail('B278_INVALID_FETCH_CONTROLS');
 const all=[],pageEvidence=[];
 for(let index=0;index<plan.pages.length;index++){
  const page=plan.pages[index],u=new URL(page.url);
  if(u.origin!==BASE_URL||u.pathname!==('/products/'+plan.product+'/candles')||
   u.searchParams.get('granularity')!=='3600'||u.searchParams.get('start')!==asIso(page.startMs)||
   u.searchParams.get('end')!==asIso(page.endMs))fail('B278_SOURCE_URL_CHANGED');
  if(index>0&&spacingMs)await pause(spacingMs);
  let response;
  try{response=await fetchImpl(u.href,{method:'GET',redirect:'error',
    headers:{Accept:'application/json'},cache:'no-store',
    signal:typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(10000):undefined});
  }catch{fail('B278_PUBLIC_PROVIDER_NETWORK_UNAVAILABLE');}
  if(!response||response.status===429)fail('B278_PUBLIC_PROVIDER_RATE_LIMITED');
  if(response.ok!==true)fail('B278_PUBLIC_PROVIDER_HTTP_FAILED');
  let raw;
  try{raw=await response.json();}catch{fail('B278_PUBLIC_PROVIDER_INVALID_JSON');}
  const part=parsePage(raw,page);
  const digest=sha(part);
  all.push(...part);
  pageEvidence.push(Object.freeze({
   page:index+1,startMs:page.startMs,endMs:page.endMs,
   count:part.length,sha256:digest,transport:'HTTPS_GET_UNSIGNED',
   sourceUrl:u.href
  }));
 }
 if(all.length!==plan.expectedCandles)fail('B278_INCOMPLETE_TOTAL_COVERAGE');
 for(let i=0;i<all.length;i++)
  if(all[i].t!==plan.startMs+i*HOUR)fail('B278_NONCONTIGUOUS_FINAL_SERIES');
 const zeroVolume=all.filter(x=>x.volume===0).length;
 const suspiciousFlat=all.filter(x=>x.high===x.low).length;
 if(zeroVolume>B278_TARGET_HOURLY_CANDLES*.1||suspiciousFlat>B278_TARGET_HOURLY_CANDLES*.5)
  fail('B278_SUSPECT_DATA_QUALITY');
 const duplicateSha=sha(all);
 const manifest=Object.freeze({
  schema:'JENIOS_B278_DATA_QUALITY_MANIFEST_V1',
  source:B278_SOURCE,product:plan.product,baseAsset:plan.baseAsset,
  quoteCurrency:'USD',interval:'H1',startMs:plan.startMs,endMs:plan.endMs,
  firstCandleOpenMs:all[0].t,lastCandleCloseMs:all.at(-1).t+HOUR,
  expected:plan.expectedCandles,received:all.length,
  pages:Object.freeze(pageEvidence),
  zeroVolume,suspiciousFlat,missing:0,duplicate:0,
  candlesSha256:duplicateSha,
  rawRedistributionApproved:false,sourceLicenseIndependentlyReviewed:false,
  httpTransportSigned:false,secondProviderCrossChecked:false,
  authenticatedBrokerData:false,robotSymbolMappingApproved:false,
  dataQualityChecksPassed:true,externalSourceAuthenticityCertified:false,
  historicalHoldoutPreRegistered:false,
  eligibleForPreliminaryResearchOnly:true,
  eligibleForProductionSignals:false,ordersSent:0
 });
 return Object.freeze({manifest,candles:Object.freeze(all)});
}
export function partitionRetrospectiveHistory(intake){
 const manifest=intake?.manifest,candles=intake?.candles;
 if(manifest?.schema!=='JENIOS_B278_DATA_QUALITY_MANIFEST_V1'||
  manifest.quoteCurrency!=='USD'||manifest.dataQualityChecksPassed!==true||
  !Array.isArray(candles)||candles.length!==B278_TARGET_HOURLY_CANDLES||
  sha(candles)!==manifest.candlesSha256||
  candles[0].t!==manifest.startMs||
  candles.at(-1).t+HOUR!==manifest.endMs)fail('B278_NOT_VERIFIED_LOCAL_SNAPSHOT');
 const start=manifest.startMs,trainEndsAtMs=start+B278_TRAIN_BARS*HOUR;
 const embargoEndsAtMs=trainEndsAtMs+B278_EMBARGO_BARS*HOUR;
 const holdoutEndsAtMs=embargoEndsAtMs+B278_HOLDOUT_BARS*HOUR;
 if(holdoutEndsAtMs!==manifest.endMs)fail('B278_SPLIT_NOT_COMPLETE');
 return Object.freeze({
  schema:'JENIOS_B278_RETROSPECTIVE_SPLIT_V1',
  product:manifest.product,quoteCurrency:'USD',sourceCandlesSha256:manifest.candlesSha256,
  training:Object.freeze({startMs:start,endMs:trainEndsAtMs,count:B278_TRAIN_BARS}),
  embargo:Object.freeze({startMs:trainEndsAtMs,endMs:embargoEndsAtMs,count:B278_EMBARGO_BARS}),
  historicalHoldout:Object.freeze({startMs:embargoEndsAtMs,endMs:holdoutEndsAtMs,count:B278_HOLDOUT_BARS}),
  futureProspectiveStartsAtMs:holdoutEndsAtMs,
  splitDesignedAfterHistoricalObservation:true,preRegisteredBeforeHoldout:false,
  historicalOosNotYetEvaluated:true,prospectiveSampleObserved:false,
  pairIsUsdNotUsdt:true,b272DirectCompatibility:false,ordersSent:0
 });
}
export function summarizeB278Collection(results){
 if(!Array.isArray(results)||results.length!==3||
  new Set(results.map(x=>x?.manifest?.product)).size!==3||
  !B278_PRODUCTS.every(p=>results.some(x=>x?.manifest?.product===p.id)))
  fail('B278_THREE_SPOT_PRODUCTS_REQUIRED');
 const rows=results.map(x=>({product:x.manifest.product,quoteCurrency:'USD',
  startMs:x.manifest.startMs,endMs:x.manifest.endMs,count:x.manifest.received,
  candlesSha256:x.manifest.candlesSha256,source:x.manifest.source,
  qualityPassed:x.manifest.dataQualityChecksPassed,
  split:partitionRetrospectiveHistory(x)}));
 if(new Set(rows.map(x=>x.startMs)).size!==1||new Set(rows.map(x=>x.endMs)).size!==1)
  fail('B278_ASSET_WINDOWS_NOT_ALIGNED');
 return Object.freeze({schema:'JENIOS_B278_COLLECTION_SUMMARY_V1',
  rows:Object.freeze(rows.map(x=>Object.freeze(x))),
  threeAssetsQualityPassed:true,assetCurrency:'USD',canMapToUsdtRobot:false,
  realBacktestPerformed:false,prospectiveProof:false,providerAttestation:false,
  noOperationalPermission:true,ordersSent:0});
}
