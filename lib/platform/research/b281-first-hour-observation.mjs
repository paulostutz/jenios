/** B281 read-only forward-hour inspection. Original B280 forecast may only come
 * from the immutable artifact copied into docs/platform/evidence in this branch.
 * Signed GitHub timestamps, independent quote attestation and real fills are NOT
 * implemented or claimed here. No broker, money or proprietary robot import.
 */
import {createHash} from 'node:crypto';
import {inspectB280SealedForecast,scoreB280FutureClosedHour,B280_FROZEN_PROTOCOL}
 from './b280-forward-protocol.mjs';
import {reviewB280ForwardCoverage} from './b280-statistical-gate.mjs';
const H=3600000,GRACE=300000;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=obj=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const PRODUCTS=Object.freeze(['BTC-USD','ETH-USD','SOL-USD']);
const BASE='https://api.exchange.coinbase.com';
export const B281_B280_ANCHOR=Object.freeze({
 sourceCommit:'e5c9671c3e926b380cef91ba5f21c22d59ac22de',
 sourceRunId:39625425333,
 status:'FORWARD_HOUR_HYPOTHESES_SEALED_BEFORE_TARGET',
 sealSha256:'3261fc220699d41c2e07ffd76f8d774b76ff9fd506ffed3e1ac066c2ec23f912',
 recordedAtMs:1792596302989,targetOpenMs:1792598400000,
 targetCloseMs:1792602000000,
 minimumObservationAtMs:1792602300000,
 forecastCount:18,quoteCurrency:'USD',ordersSent:0
});
export function auditB281OriginalSeal(bundle){
 const s=bundle?.sealedResearch,a=B281_B280_ANCHOR;
 if(!bundle||bundle.schema!=='JENIOS_B280_REAL_FORWARD_RESEARCH_CAPTURE_ATTEMPT_V1'||
  bundle.status!==a.status||bundle.source!=='coinbase_exchange_public_spot_candles'||
  bundle.quoteCurrency!==a.quoteCurrency||bundle.githubCommit!==a.sourceCommit||
  bundle.workflowRunId!==a.sourceRunId||
  bundle.futureObserved!==false||
  bundle.brokerOrdersSubmitted!==0||bundle.paperOrdersSubmitted!==0||
  bundle.sourceSigned!==false||bundle.profitabilityVerified!==false||
  !s||s.githubCommit!==a.sourceCommit||s.githubWorkflowRunId!==a.sourceRunId||
  s.sealSha256!==a.sealSha256||s.receivedAtMs!==a.recordedAtMs||
  s.targetCandleOpenMs!==a.targetOpenMs||
  s.targetCandleEndMs!==a.targetCloseMs||
  s.forecasts?.length!==a.forecastCount||
  s.protocolSha256!==B280_FROZEN_PROTOCOL.sha256)
  fail('B281_ORIGINAL_B280_SEAL_NOT_ANCHORED');
 try{inspectB280SealedForecast(s);}
 catch{fail('B281_ORIGINAL_B280_SEAL_NOT_ANCHORED');}
 const count=Object.fromEntries(PRODUCTS.map(id=>[id,0]));
 for(const forecast of s.forecasts){
  if(!PRODUCTS.includes(forecast.product)||
   !['EMA_CONTEXT_V1','CLOSED_BREAKOUT_V1'].includes(forecast.hypothesisId)||
   !['direct','reverse','hybrid'].includes(forecast.mode)||
   forecast.targetCandleOpenMs!==a.targetOpenMs||
   forecast.targetCandleEndMs!==a.targetCloseMs||
   forecast.isTradeSignal!==false||forecast.operationalAdvice!==false||
   forecast.brokerOrderId!==null)
   fail('B281_INVALID_FROZEN_FORECAST_ENTRY');
  count[forecast.product]++;
 }
 if(Object.values(count).some(n=>n!==6))fail('B281_INCOMPLETE_FROZEN_PRODUCT_COVERAGE');
 return Object.freeze({valid:true,sealSha256:a.sealSha256,
  registeredBeforeTarget:true,expectedProducts:PRODUCTS,
  targetOpenMs:a.targetOpenMs,targetCloseMs:a.targetCloseMs,
  independentPriceSignatureVerified:false,
  independentlySignedTimestampVerified:false,
  tradingEnabled:false,ordersSent:0});
}
export function readinessB281OriginalHour(bundle,{nowMs=Date.now()}={}){
 auditB281OriginalSeal(bundle);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('B281_INVALID_OBSERVATION_CLOCK');
 const min=B281_B280_ANCHOR.minimumObservationAtMs;
 const status=nowMs<B281_B280_ANCHOR.targetCloseMs?'PENDING_TARGET_CANDLE_CLOSE':
  nowMs<min?'PENDING_FIVE_MINUTE_SAFETY_WINDOW':'READY_FOR_READ_ONLY_SOURCE_QUERY';
 return Object.freeze({status,nowMs,earliestObservationAtMs:min,
  candidateMayFetch:status==='READY_FOR_READ_ONLY_SOURCE_QUERY',
  outcomeAlreadyVerified:false,profitabilityCertified:false,
  ordersSent:0});
}
export function b281HistoricalCandleUrl(product){
 if(!PRODUCTS.includes(product))fail('B281_UNSUPPORTED_USD_SPOT_PRODUCT');
 const q=new URL(BASE+'/products/'+product+'/candles');
 q.searchParams.set('granularity','3600');
 q.searchParams.set('start',new Date(B281_B280_ANCHOR.targetOpenMs).toISOString());
 // Include one adjacent hour; never assume provider's start/end inclusivity.
 q.searchParams.set('end',new Date(B281_B280_ANCHOR.targetCloseMs+H).toISOString());
 return q.href;
}
export function parseB281PublicClosedHour(payload,{product,observedAtMs}={}){
 if(!PRODUCTS.includes(product))fail('B281_UNSUPPORTED_USD_SPOT_PRODUCT');
 if(!Number.isSafeInteger(observedAtMs)||
  observedAtMs<B281_B280_ANCHOR.minimumObservationAtMs)
  fail('B281_TOO_EARLY_TO_READ_TARGET');
 if(!Array.isArray(payload)||payload.length>10)fail('B281_INVALID_PUBLIC_CANDLE_PAYLOAD');
 let candidate=null;
 for(const row of payload){
  if(!Array.isArray(row)||row.length!==6)fail('B281_INVALID_PROVIDER_CANDLE_ROW');
  const [seconds,low,high,open,close,volume]=row;
  if(!Number.isSafeInteger(seconds)||seconds<=0||
   ![low,high,open,close,volume].every(finite))
   fail('B281_INVALID_PROVIDER_OHLCV');
  const t=seconds*1000;
  if(!Number.isSafeInteger(t)||t%H!==0)fail('B281_INVALID_PROVIDER_CANDLE_TIME');
  if(t!==B281_B280_ANCHOR.targetOpenMs)continue;
  if(candidate)fail('B281_DUPLICATE_TARGET_CANDLE');
  if(open<=0||close<=0||low<=0||volume<=0||
   high<Math.max(open,close,low)||low>Math.min(open,close)||
   high/low>1.5)fail('B281_INVALID_TARGET_CANDLE_OHLCV');
  candidate=Object.freeze({t,open,high,low,close,volume});
 }
 if(!candidate)fail('B281_TARGET_CANDLE_NOT_AVAILABLE');
 return Object.freeze({product,source:'coinbase_exchange_public_spot_candles',
  quoteCurrency:'USD',observedAtMs,
  targetStartMs:candidate.t,targetClosedAtMs:candidate.t+H,
  candleSha256:sha(candidate),candle:candidate,
  sourceSigned:false,secondProviderCrossChecked:false,
  brokerFillVerified:false,ordersSent:0});
}
export async function fetchB281ReadOnlyOutcome(bundle,{
 nowMs=Date.now(),fetchImpl=fetch,pause=()=>Promise.resolve()
}={}){
 const ready=readinessB281OriginalHour(bundle,{nowMs});
 if(!ready.candidateMayFetch)fail('B281_OUTCOME_NOT_READY_FOR_FETCH');
 if(typeof fetchImpl!=='function'||typeof pause!=='function')
  fail('B281_INVALID_PUBLIC_FETCH_CONTROL');
 const evidence=[];
 for(const product of PRODUCTS){
  const url=b281HistoricalCandleUrl(product),parsed=new URL(url);
  if(parsed.origin!==BASE||parsed.pathname!=='/products/'+product+'/candles'||
   parsed.searchParams.get('granularity')!=='3600')
   fail('B281_SOURCE_HOST_NOT_ALLOWED');
  if(evidence.length)await pause();
  let res;
  try{
   res=await fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',
    headers:{Accept:'application/json'},
    signal:typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(10000):undefined});
  }catch{fail('B281_COINBASE_PUBLIC_NETWORK_UNAVAILABLE');}
  if(res?.status===429)fail('B281_COINBASE_PUBLIC_RATE_LIMITED');
  if(!res||res.ok!==true)fail('B281_COINBASE_PUBLIC_HTTP_FAILURE');
  let body;
  try{body=await res.json();}catch{fail('B281_COINBASE_PUBLIC_INVALID_JSON');}
  evidence.push(parseB281PublicClosedHour(body,{product,observedAtMs:nowMs}));
 }
 return Object.freeze(evidence);
}
export function evaluateB281ObservedClosedHour(bundle,sourceResults,{nowMs}={}){
 auditB281OriginalSeal(bundle);
 if(!Number.isSafeInteger(nowMs)||nowMs<B281_B280_ANCHOR.minimumObservationAtMs)
  fail('B281_TOO_EARLY_TO_EVALUATE');
 if(!Array.isArray(sourceResults)||sourceResults.length!==3)
  fail('B281_THREE_PUBLIC_USD_CANDLES_REQUIRED');
 const by=new Map();
 for(const row of sourceResults){
  if(!row||!PRODUCTS.includes(row.product)||by.has(row.product)||
   row.source!=='coinbase_exchange_public_spot_candles'||
   row.quoteCurrency!=='USD'||row.sourceSigned!==false||
   row.secondProviderCrossChecked!==false||row.brokerFillVerified!==false||
   row.ordersSent!==0||row.observedAtMs< B281_B280_ANCHOR.minimumObservationAtMs||
   row.targetStartMs!==B281_B280_ANCHOR.targetOpenMs||
   row.targetClosedAtMs!==B281_B280_ANCHOR.targetCloseMs||
   !row.candle||sha(row.candle)!==row.candleSha256)
   fail('B281_UNVERIFIED_OR_TAMPERED_SOURCE_OBSERVATION');
  by.set(row.product,row);
 }
 if(PRODUCTS.some(id=>!by.has(id)))fail('B281_MISSING_SOURCE_PRODUCT');
 const actual=PRODUCTS.map(product=>({
  product,bar:by.get(product).candle
 }));
 const scored=scoreB280FutureClosedHour(bundle.sealedResearch,actual,{observedAtMs:nowMs});
 if(scored.count!==162||scored.ordersSent!==0)fail('B281_SCORING_INVARIANT_FAILED');
 const conservative=scored.rows.filter(r=>r.costBps===30&&r.slipBps===30);
 if(conservative.length!==18)fail('B281_CONSERVATIVE_SCENARIO_COVERAGE_MISMATCH');
 const stats={positive:0,negative:0,zero:0,abstained:0};
 for(const x of conservative){
  if(x.netR===null)stats.abstained++;
  else if(x.netR>0)stats.positive++;
  else if(x.netR<0)stats.negative++;
  else stats.zero++;
 }
 const evidenceSha=Object.freeze(PRODUCTS.map(product=>Object.freeze({
  product,candleSha256:by.get(product).candleSha256,
  observedAtMs:by.get(product).observedAtMs
 })));
 const review=reviewB280ForwardCoverage([scored]);
 const core={
  schema:'JENIOS_B281_FIRST_FORWARD_CANDLE_REVIEW_V1',
  status:'ONE_HOUR_DESCRIPTIVE_STUDY_ONLY',sealSha256:B281_B280_ANCHOR.sealSha256,
  b280RunId:B281_B280_ANCHOR.sourceRunId,
  targetOpenMs:B281_B280_ANCHOR.targetOpenMs,
  targetCloseMs:B281_B280_ANCHOR.targetCloseMs,observedAtMs:nowMs,
  historicalPredictionCount:18,
  scenarioCount:scored.count,
  sourceCandles:evidenceSha,conservative30_30:stats,
  scenarioRows:scored.rows,
  coverage:review,
  resultFromPublicUsdSpotOnly:true,secondProviderSigned:false,
  preCommitBeforeTargetVerifiedByLocalSnapshot:true,
  independentTimestampSignatureVerified:false,independentPriceSourceSignatureVerified:false,
  brokerFillsObserved:false,
  statisticalAdvantageCertified:false,
  prospectiveLongHorizonValidationComplete:false,
  robotChangesAllowed:false,realExecutionAllowed:false,
  paperOrdersSent:0,ordersSent:0,
  rawOhlcvNotArchived:true,
  disclaimer:'Primeiro candle futuro de 1 hora, observado por REST público não assinado. O modelo não simula empréstimo, liquidez, latência ou fills. Não certifica resultados reais nem vantagem dos robôs proprietários.'
 };
 return Object.freeze({...core,reportSha256:sha(core)});
}
