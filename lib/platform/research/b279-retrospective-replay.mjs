/** B279 — retrospective USD spot research only; not the proprietary JENIOS robot.
 * Historic source hashes copied from B278 signed-off public HTTP collection evidence.
 * These hashes do NOT sign source authenticity, prove tradability or create OOS proof.
 * Research trades are mathematical one-bar what-ifs, not paper/live orders.
 */
import {createHash} from 'node:crypto';
import {partitionRetrospectiveHistory} from './b278-historical-ingest.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=x=>Number(x.toFixed(6));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const H=3600000;
const REFERENCE_ROWS=Object.freeze([
 Object.freeze({product:'BTC-USD',sha256:'8170a90fb03f458458ce18e798e0c772e7d1862eb9c5baa4dd234b1456d8aad5'}),
 Object.freeze({product:'ETH-USD',sha256:'a2cc69fc747161ad8587c04f6b6b84b55bbd3de4793c455dd200fa93714ce82c'}),
 Object.freeze({product:'SOL-USD',sha256:'cd10d24f978501d93f23eb199ac2e850cc42ff4f3ca734f8139205ea08ac4701'})
]);
export const B279_FROZEN_B278_REFERENCE=Object.freeze({
 source:'coinbase_exchange_public_spot_candles',b278Commit:'e96a98486cd07b8ee8b264f32c2c8f97c77e9958',
 b278RunId:39617307059,b278CollectedAt:'2026-10-21T14:30:07.633Z',
 startMs:1789128000000,trainingEndMs:1791288000000,
 embargoEndMs:1791460800000,endMs:1792584000000,
 quoteCurrency:'USD',intervalMs:H,candlesPerAsset:960,
 frozenSha256Rows:REFERENCE_ROWS
});
export const B279_HYPOTHESES=Object.freeze(['EMA_CONTEXT_V1','CLOSED_BREAKOUT_V1']);
export const B279_MODES=Object.freeze(['direct','reverse','hybrid']);
const CORE=Object.freeze({
 schema:'JENIOS_B279_FROZEN_RESEARCH_PROTOCOL_V1',
 sourceCommit:'e96a98486cd07b8ee8b264f32c2c8f97c77e9958',
 retrospectiveHoldout:true,preRegisteredBeforeHistoricalHoldout:false,
 originalRobotCodeUsed:false,quoteCurrency:'USD',intervalMs:H,
 trainingBars:600,embargoBars:48,holdoutBars:312,
 hypothesisIds:B279_HYPOTHESES,
 modes:B279_MODES,
 emaShortPeriod:12,emaLongPeriod:26,breakoutLookback:20,
 hybridMinEmaGapRatio:0.0015,
 fixedStopPct:0.01,positionSizing:'ONE_R_FIXED_NOMINAL_BUDGET_NO_COMPOUNDING',
 entry:'NEXT_COMPLETE_BAR_OPEN_BASED_ON_PREVIOUS_BAR_CLOSE',
 exit:'ONE_BAR_CLOSE_OR_INTRABAR_STOP_THRESHOLD',
 costBps:Object.freeze([0,10,30]),
 adverseStopSlipBps:Object.freeze([0,10,30]),
 sameCandleExecutionOrderingUnobservable:true,
 stopPriceFillNotGuaranteed:true,
 shortSideBorrowAndFundingNotModeled:true,
 noMarketDepthOrLatencyModel:true
});
export const B279_FROZEN_PROTOCOL=Object.freeze({...CORE,sha256:digest(CORE)});
const checkProtocol=protocol=>{
 if(!protocol||JSON.stringify(protocol)!==JSON.stringify(B279_FROZEN_PROTOCOL)||
  digest(CORE)!==protocol.sha256)fail('B279_PROTOCOL_CHANGED_AFTER_FREEZE');
};
const verifyIntakes=(intakes,{requireB278Sha=true}={})=>{
 if(!Array.isArray(intakes)||intakes.length!==3)fail('B279_THREE_SOURCE_SERIES_REQUIRED');
 const by=new Map();
 for(const intake of intakes){
  const manifest=intake?.manifest,bars=intake?.candles;
  if(!manifest||!Array.isArray(bars)||manifest.schema!=='JENIOS_B278_DATA_QUALITY_MANIFEST_V1'||
   manifest.source!==B279_FROZEN_B278_REFERENCE.source||manifest.quoteCurrency!=='USD'||
   manifest.interval!=='H1'||manifest.dataQualityChecksPassed!==true||
   manifest.received!==960||bars.length!==960||
   manifest.startMs!==B279_FROZEN_B278_REFERENCE.startMs||
   manifest.endMs!==B279_FROZEN_B278_REFERENCE.endMs||
   manifest.expected!==960||manifest.ordersSent!==0)fail('B279_INTAKE_BOUNDARY_FAILED');
  if(by.has(manifest.product))fail('B279_DUPLICATE_ASSET');
  const row=REFERENCE_ROWS.find(x=>x.product===manifest.product);
  if(!row)fail('B279_USD_SPOT_ASSET_ONLY');
  if(digest(bars)!==manifest.candlesSha256)fail('B279_SOURCE_DATA_REWRITTEN');
  const split=partitionRetrospectiveHistory(intake);
  if(split.training.endMs!==B279_FROZEN_B278_REFERENCE.trainingEndMs||
   split.embargo.endMs!==B279_FROZEN_B278_REFERENCE.embargoEndMs||
   split.historicalHoldout.endMs!==B279_FROZEN_B278_REFERENCE.endMs||
   split.quoteCurrency!=='USD'||split.b272DirectCompatibility!==false)
   fail('B279_SPLIT_OR_SOURCE_INCONSISTENT');
  if(requireB278Sha&&manifest.candlesSha256!==row.sha256)
   fail('B279_B278_HISTORICAL_SHA_MISMATCH');
  by.set(manifest.product,{manifest,bars});
 }
 if(REFERENCE_ROWS.some(row=>!by.has(row.product)))fail('B279_MISSING_ASSET');
 return by;
};
const ema=(bars,n)=>{
 const alpha=2/(n+1),values=[];let last=bars[0].close;
 for(const bar of bars){last=alpha*bar.close+(1-alpha)*last;values.push(last);}
 return values;
};
const signal=(bars,index,hypothesisId,fast,slow)=>{
 const prev=bars[index-1],spread=fast[index-1]-slow[index-1];
 let direction=0;
 if(hypothesisId==='EMA_CONTEXT_V1')direction=Math.sign(spread);
 else{
  const history=bars.slice(index-21,index-1);
  if(history.length!==20)fail('B279_BREAKOUT_LOOKBACK_MISSING');
  const ceiling=Math.max(...history.map(x=>x.high));
  const floor=Math.min(...history.map(x=>x.low));
  direction=prev.close>ceiling?1:prev.close<floor?-1:0;
 }
 const hybridEligible=direction!==0&&Math.abs(spread)/prev.close>=CORE.hybridMinEmaGapRatio&&
  (hypothesisId==='EMA_CONTEXT_V1'||Math.sign(spread)===direction);
 return {direction,hybridEligible,signalClosedAtMs:prev.t+H};
};
/** Signals see only previously CLOSED bars; the next bar's open is used for entry.
 * Stop touch is seen from that bar's OHLC (ex post), and the model deliberately
 * penalizes stop fills for adverse slippage. It is still not a real fill simulator.
 */
function explore(bars,hypothesisId,mode,{costBps,stopSlipBps}){
 const fast=ema(bars,CORE.emaShortPeriod),slow=ema(bars,CORE.emaLongPeriod);
 let cumulative=0,peak=0,dd=0,wins=0,losses=0,flats=0,
  stopTouches=0,totalGross=0,worstNet=0,totalProfit=0,totalLoss=0,count=0,
  firstSignalClosedAtMs=null,lastSignalClosedAtMs=null;
 const first=CORE.trainingBars+CORE.embargoBars;
 const last=first+CORE.holdoutBars;
 if(last!==bars.length)fail('B279_HOLDOUT_SIZE_MISMATCH');
 for(let index=first;index<last;index++){
  const {direction,hybridEligible,signalClosedAtMs}=signal(bars,index,hypothesisId,fast,slow);
  if(!direction||(mode==='hybrid'&&!hybridEligible))continue;
  const side=mode==='reverse'?-direction:direction,bar=bars[index],entry=bar.open;
  if(signalClosedAtMs!==bar.t)fail('B279_SIGNAL_AFTER_ENTRY');
  const stop=entry*(1-side*CORE.fixedStopPct);
  const touched=side===1?bar.low<=stop:bar.high>=stop;
  const stressedFill=touched?stop-side*entry*(stopSlipBps/10000):bar.close;
  const risk=entry*CORE.fixedStopPct;
  const gross=(stressedFill-entry)*side/risk;
  const fees=costBps/10000*entry/risk;
  const net=gross-fees;
  if(!finite(net)||!finite(gross))fail('B279_INVALID_SIMULATION_NUMBER');
  count++;cumulative+=net;totalGross+=gross;
  if(net>0){wins++;totalProfit+=net;}else if(net<0){losses++;totalLoss+=-net;}else flats++;
  if(touched)stopTouches++;
  worstNet=Math.min(worstNet,net);
  peak=Math.max(peak,cumulative);dd=Math.max(dd,peak-cumulative);
  firstSignalClosedAtMs??=signalClosedAtMs;lastSignalClosedAtMs=signalClosedAtMs;
 }
 return Object.freeze({
  hypothesisId,mode,costBps,stopSlipBps,holdoutBars:CORE.holdoutBars,
  signalCount:count,winCount:wins,lossCount:losses,flatCount:flats,stopTouches,
  exposureBarsPct:round(count/CORE.holdoutBars*100),
  avgGrossR:count?round(totalGross/count):null,
  avgNetR:count?round(cumulative/count):null,
  totalNetR:count?round(cumulative):null,
  winRatePct:count?round(wins/count*100):null,
  maxDrawdownR:count?round(dd):null,worstTradeNetR:count?round(worstNet):null,
  profitFactor:totalLoss>0?round(totalProfit/totalLoss):null,
  firstSignalClosedAtMs,lastSignalClosedAtMs,
  assumptions:'SIMPLIFIED_ONE_HOUR_STOP_AND_COST_STRESS',
  actualExecutionObserved:false,capitalProfitObserved:false
 });
}
function produce(intakes,protocol,classification){
 checkProtocol(protocol);
 const by=verifyIntakes(intakes,{requireB278Sha:classification!=='SYNTHETIC_FIXTURE_ONLY'});
 const rows=[];
 for(const {product} of REFERENCE_ROWS){
  const barSeries=by.get(product).bars;
  for(const hypothesisId of B279_HYPOTHESES)
   for(const mode of B279_MODES)
    for(const costBps of CORE.costBps)
     for(const stopSlipBps of CORE.adverseStopSlipBps)
      rows.push(Object.freeze({product,quoteCurrency:'USD',
       ...explore(barSeries,hypothesisId,mode,{costBps,stopSlipBps})}));
 }
 return Object.freeze({
  schema:'JENIOS_B279_RETROSPECTIVE_REPLAY_V1',
  classification,protocolSha256:protocol.sha256,
  dataSnapshotSha256:Object.freeze(REFERENCE_ROWS.map(x=>Object.freeze({
   product:x.product,sha256:by.get(x.product).manifest.candlesSha256
  }))),
  period:Object.freeze({startMs:B279_FROZEN_B278_REFERENCE.startMs,
   trainingEndMs:B279_FROZEN_B278_REFERENCE.trainingEndMs,
   embargoEndMs:B279_FROZEN_B278_REFERENCE.embargoEndMs,
   endMs:B279_FROZEN_B278_REFERENCE.endMs}),
  modes:B279_MODES,hypotheses:B279_HYPOTHESES,
  scenarios:Object.freeze(rows),
  samplesThreeAssets:3,scenarioRows:rows.length,
  fixedNotionalRiskEqualAcrossModes:true,transactionCostsSensitivityOnly:true,
  actualLiquidityAndFinancingVerified:false,
  sourceTransportSigned:false,independentDataProviderChecked:false,
  historicalHoldoutRetrospective:true,preRegisteredBeforeHoldout:false,
  trainingWasUsedForOptimization:false,statisticalSignificanceCertified:false,
  prospectiveValidationCompleted:false,profitabilityCertified:false,
  originalRobotsModified:false,ordersSent:0,paperOrdersSent:0,
  realDeploymentAllowed:false,eligibleForOperationalComparison:false,
  caveat:'Dados USD Spot históricos com HTTP não assinado; 13 dias retrospectivos não validam vantagem. Stop é apenas limiar de preço com slippage fixo simulado. Shorts hipotéticos não modelam empréstimo, margem nem financiamento. NENHUMA ordem ou decisão operacional autorizada.'
 });
}
export function evaluateB279FrozenHistory(intakes,{protocol=B279_FROZEN_PROTOCOL}={}){
 return produce(intakes,protocol,'B278_SHA_MATCHED_RETROSPECTIVE_RESEARCH_ONLY');
}
export function evaluateB279SyntheticFixture(intakes,{protocol=B279_FROZEN_PROTOCOL}={}){
 return produce(intakes,protocol,'SYNTHETIC_FIXTURE_ONLY');
}
