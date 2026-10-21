/** B280 — research-only, forward-time hypothesis registration and later audit.
 * No private robots, authenticated brokerage, order dispatch or financial action.
 * UTC public spot USD candles are UNSIGNED; GitHub runner provides an externally
 * visible run history, NOT an independent signed market timestamp.
 */
import {createHash} from 'node:crypto';

const H=3600000,fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(6));
const productIds=Object.freeze(['BTC-USD','ETH-USD','SOL-USD']);
const modes=Object.freeze(['direct','reverse','hybrid']);
const hypotheses=Object.freeze(['EMA_CONTEXT_V1','CLOSED_BREAKOUT_V1']);
const baseProtocol=Object.freeze({
 schema:'JENIOS_B280_FORWARD_PROTOCOL_V1',
 parentCommit:'fb9441d3485d0c825cd3e7705c3de33fb1e74515',
 b279RunId:39621762657,b279ScenarioResult:'NEGATIVE_ALL_18_AT_30BPS_30BPS',
 earliestRegistrationMs:Date.parse('2026-10-21T15:09:00Z'),
 instrumentIds:productIds,quoteCurrency:'USD',granularityMs:H,
 historyBars:960,source:'coinbase_exchange_public_spot_candles',
 emaFastPeriod:12,emaSlowPeriod:26,breakoutLookback:20,hybridMinEmaGapRatio:0.0015,
 hypothesisIds:hypotheses,modes,
 targetCandleRule:'FUTURE_HOURLY_BAR_STARTING_AT_LEAST_10_MINUTES_AFTER_SEAL',
 minimumLeadMs:600000,maximumHistoricalAgeMs:4*H,
 hypotheticalRiskStopPct:.01,
 roundTripCostBps:Object.freeze([0,10,30]),
 adverseStopSlipBps:Object.freeze([0,10,30]),
 equalRiskR:true,holdOnlyOneHour:true,
 outcomesRequiredAfterTargetCloses:true,independentSecondProviderRequiredBeforeCertification:true,
 signedPriceFeedRequiredBeforeCertification:true,
 minimumDistinctForwardDaysBeforeReview:30,
 noActualBrokerExecution:true,notInvestmentAdvice:true
});
export const B280_FROZEN_PROTOCOL=Object.freeze({...baseProtocol,sha256:sha(baseProtocol)});
export const B280_EXPECTED_SCENE_COUNT=18;
const checkProtocol=protocol=>{
 if(!protocol||JSON.stringify(protocol)!==JSON.stringify(B280_FROZEN_PROTOCOL)||
  sha(baseProtocol)!==protocol.sha256)fail('B280_PROTOCOL_NOT_FROZEN');
};
function verifyIntakes(intakes,receivedAtMs){
 if(!Number.isSafeInteger(receivedAtMs)||receivedAtMs<B280_FROZEN_PROTOCOL.earliestRegistrationMs)
  fail('B280_RESEARCH_BEFORE_COMMITMENT_FORBIDDEN');
 if(!Array.isArray(intakes)||intakes.length!==productIds.length)fail('B280_THREE_USD_SERIES_REQUIRED');
 const by=new Map();
 for(const item of intakes){
  const m=item?.manifest,bars=item?.candles;
  if(!m||m.schema!=='JENIOS_B278_DATA_QUALITY_MANIFEST_V1'||
   m.source!==baseProtocol.source||m.quoteCurrency!=='USD'||m.interval!=='H1'||
   m.dataQualityChecksPassed!==true||m.ordersSent!==0||m.received!==960||
   !Array.isArray(bars)||bars.length!==960||m.expected!==960||
   sha(bars)!==m.candlesSha256)fail('B280_CANDLE_INTEGRITY_UNVERIFIED');
  if(!productIds.includes(m.product)||by.has(m.product))fail('B280_INVALID_OR_DUPLICATE_PRODUCT');
  if(bars[0].t!==m.startMs||bars.at(-1).t+H!==m.endMs||
   m.endMs>receivedAtMs-H||receivedAtMs-m.endMs>baseProtocol.maximumHistoricalAgeMs)
   fail('B280_HISTORICAL_NOT_CLOSED_OR_STALE');
  for(let i=0;i<bars.length;i++){
   const b=bars[i];
   if(!b||b.t!==m.startMs+i*H||!finite(b.open)||!finite(b.high)||
    !finite(b.low)||!finite(b.close)||!finite(b.volume)||
    b.open<=0||b.close<=0||b.low<=0||b.volume<0||
    b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close))
    fail('B280_GAP_OR_INVALID_OHLCV');
  }
  by.set(m.product,item);
 }
 if(productIds.some(id=>!by.has(id)))fail('B280_MISSING_PUBLIC_USD_PAIR');
 if(new Set([...by.values()].map(x=>x.manifest.endMs)).size!==1)
  fail('B280_ASSET_HISTORY_NOT_ALIGNED');
 return by;
}
function ema(closes,period){
 const alpha=2/(period+1);
 let last=closes[0];
 for(let i=1;i<closes.length;i++)last=alpha*closes[i]+(1-alpha)*last;
 return last;
}
function direction(rows,hypothesisId){
 const closes=rows.map(x=>x.close),last=rows.at(-1);
 const fast=ema(closes,baseProtocol.emaFastPeriod),
  slow=ema(closes,baseProtocol.emaSlowPeriod),spread=fast-slow;
 let dir=0;
 if(hypothesisId==='EMA_CONTEXT_V1')dir=Math.sign(spread);
 else{
  const prev=rows.slice(-21,-1);
  if(prev.length!==20)fail('B280_BREAKOUT_LOOKBACK_MISSING');
  const max=Math.max(...prev.map(x=>x.high)),min=Math.min(...prev.map(x=>x.low));
  dir=last.close>max?1:last.close<min?-1:0;
 }
 const hybridEligible=dir!==0&&Math.abs(spread)/last.close>=baseProtocol.hybridMinEmaGapRatio&&
  (hypothesisId==='EMA_CONTEXT_V1'||Math.sign(spread)===dir);
 return {dir,hybridEligible};
}
export function sealB280ForwardForecasts(intakes,{
 receivedAtMs,gitCommitSha,workflowRunId,protocol=B280_FROZEN_PROTOCOL
}={}){
 checkProtocol(protocol);
 if(!/^[a-f0-9]{40}$/.test(gitCommitSha||'')||
  !Number.isSafeInteger(workflowRunId)||workflowRunId<=0)
  fail('B280_COMMIT_AND_RUN_ATTESTATION_REQUIRED');
 const by=verifyIntakes(intakes,receivedAtMs);
 const targetStartMs=Math.ceil((receivedAtMs+protocol.minimumLeadMs+1)/H)*H;
 if(targetStartMs-receivedAtMs<protocol.minimumLeadMs||
  targetStartMs%H!==0)fail('B280_TARGET_NOT_IN_FUTURE');
 const scenes=[];
 for(const product of productIds){
  const item=by.get(product),lastClose=item.candles.at(-1).close;
  for(const hypothesisId of hypotheses){
   const {dir,hybridEligible}=direction(item.candles,hypothesisId);
   for(const mode of modes){
    const allowed=dir!==0&&(mode!=='hybrid'||hybridEligible);
    const side=!allowed?'ABSTAIN':mode==='reverse'?(dir===1?'DOWN':'UP'):(dir===1?'UP':'DOWN');
    scenes.push(Object.freeze({
     product,hypothesisId,mode,
     observedSourceHash:item.manifest.candlesSha256,
     sourceHistoryEndMs:item.manifest.endMs,
     observedLastCloseUsd:round(lastClose),
     observedAtMs:receivedAtMs,targetCandleOpenMs:targetStartMs,
     targetCandleEndMs:targetStartMs+H,
     researchDirection:side,
     isTradeSignal:false,operationalAdvice:false,
     confidenceProven:false,brokerOrderId:null
    }));
   }
  }
 }
 if(scenes.length!==B280_EXPECTED_SCENE_COUNT)fail('B280_SCENE_REGISTRY_INCOMPLETE');
 const core={
  schema:'JENIOS_B280_SEALED_FORWARD_FORECAST_V1',
  protocolSha256:protocol.sha256,githubCommit:gitCommitSha,
  githubWorkflowRunId:workflowRunId,receivedAtMs,
  historicalSources:Object.freeze(productIds.map(product=>Object.freeze({
   product,sha256:by.get(product).manifest.candlesSha256,
   endMs:by.get(product).manifest.endMs,quoteCurrency:'USD'
  }))),
  targetCandleOpenMs:targetStartMs,targetCandleEndMs:targetStartMs+H,
  forecasts:Object.freeze(scenes),
  sealedBeforeTargetOpened:true,
  historicPricesIndependentlyAuthenticated:false,
  externalTimestampSignaturePresent:false,
  priceProviderSignaturePresent:false,
  forwardMarketOutcomeKnown:false,
  observedPnl:null,statisticalEdgeCertified:false,
  requiresFutureObservation:true,
  noLiveBrokerIntegration:true,
  ordersSent:0,eligibleForLiveUse:false
 };
 return Object.freeze({...core,sealSha256:sha(core)});
}
export function inspectB280SealedForecast(sealed,{protocol=B280_FROZEN_PROTOCOL}={}){
 checkProtocol(protocol);
 if(!sealed||sealed.schema!=='JENIOS_B280_SEALED_FORWARD_FORECAST_V1'||
  sealed.protocolSha256!==protocol.sha256||
  !Array.isArray(sealed.forecasts)||sealed.forecasts.length!==18||
  sealed.sealSha256===undefined||
  sha(Object.fromEntries(Object.entries(sealed).filter(([key])=>key!=='sealSha256')))!==sealed.sealSha256||
  !Number.isSafeInteger(sealed.receivedAtMs)||
  !Number.isSafeInteger(sealed.targetCandleOpenMs)||
  sealed.targetCandleOpenMs-sealed.receivedAtMs<protocol.minimumLeadMs||
  sealed.targetCandleEndMs-sealed.targetCandleOpenMs!==H||
  sealed.githubWorkflowRunId<=0||!/^[a-f0-9]{40}$/.test(sealed.githubCommit||'')||
  sealed.sealedBeforeTargetOpened!==true||
  sealed.ordersSent!==0||sealed.forwardMarketOutcomeKnown!==false)
  fail('B280_FORECAST_TAMPERED_OR_RETROACTIVE');
 return Object.freeze({valid:true,predictions:18,
  targetCandleOpenMs:sealed.targetCandleOpenMs,
  targetCandleEndMs:sealed.targetCandleEndMs,
  sealSha256:sealed.sealSha256,externallyPriceSigned:false,
  prospectivelyOutcomeVerified:false,ordersSent:0});
}
const directionScore=(forecast,bar,costBps,slipBps)=>{
 if(forecast.researchDirection==='ABSTAIN')
  return Object.freeze({researchDirection:'ABSTAIN',netR:null,costBps,slipBps,
   hypotheticalFillVerified:false,observedOrder:false});
 const side=forecast.researchDirection==='UP'?1:-1,
  entry=bar.open,stop=entry*(1-side*baseProtocol.hypotheticalRiskStopPct);
 const hit=side===1?bar.low<=stop:bar.high>=stop;
 const exit=hit?stop-side*entry*slipBps/10000:bar.close;
 const gross=side*(exit-entry)/(entry*baseProtocol.hypotheticalRiskStopPct);
 return Object.freeze({researchDirection:forecast.researchDirection,
  costBps,slipBps,netR:round(gross-costBps/10000/baseProtocol.hypotheticalRiskStopPct),
  stopTouchObserved:hit,
  hypotheticalFillVerified:false,observedOrder:false});
};
/** Scorer can run LATER. It cannot verify independent provider signatures.
 * Synthetic prospective tests use injected future bars, not claimed market results.
 */
export function scoreB280FutureClosedHour(sealed,outcomes,{
 observedAtMs,protocol=B280_FROZEN_PROTOCOL
}={}){
 inspectB280SealedForecast(sealed,{protocol});
 if(!Number.isSafeInteger(observedAtMs)||
  observedAtMs<sealed.targetCandleEndMs+300000)
  fail('B280_TARGET_HOUR_NOT_CLOSED_OR_REPORTED_TOO_EARLY');
 if(!Array.isArray(outcomes)||outcomes.length!==3)fail('B280_THREE_FUTURE_CANDLES_REQUIRED');
 const mapped=new Map();
 for(const x of outcomes){
  const product=x?.product,bar=x?.bar;
  if(!productIds.includes(product)||mapped.has(product)||!bar||
   bar.t!==sealed.targetCandleOpenMs||
   ![bar.open,bar.close,bar.high,bar.low,bar.volume].every(finite)||
   bar.open<=0||bar.close<=0||bar.low<=0||bar.volume<0||
   bar.high<Math.max(bar.open,bar.close,bar.low)||bar.low>Math.min(bar.open,bar.close))
   fail('B280_FUTURE_SOURCE_INVALID_OR_MISSING');
  mapped.set(product,bar);
 }
 const rows=[];
 for(const forecast of sealed.forecasts)
  for(const costBps of baseProtocol.roundTripCostBps)
   for(const slipBps of baseProtocol.adverseStopSlipBps)
    rows.push(Object.freeze({product:forecast.product,
     hypothesisId:forecast.hypothesisId,mode:forecast.mode,
     ...directionScore(forecast,mapped.get(forecast.product),costBps,slipBps)}));
 return Object.freeze({schema:'JENIOS_B280_FUTURE_HOUR_OFFLINE_EVALUATION_V1',
  sealedSha256:sealed.sealSha256,
  observedAtMs,targetCandleStartMs:sealed.targetCandleOpenMs,
  rows:Object.freeze(rows),count:rows.length,
  outcomeProviderSigned:false,independentProviderConfirmed:false,
  brokerExecutionReconciled:false,
  observationalForwardHourPassed:true,
  minimumThirtyIndependentDaysMet:false,
  significanceCertified:false,profitabilityCertified:false,
  readyForOperationalChanges:false,ordersSent:0});
}
