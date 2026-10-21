/**
 * JENIOS B288 — paired offline comparison of frozen manual/hybrid/reverse
 * research signals. No private-engine import, broker, network, order or money.
 * All results are hypothetical descriptive arithmetic on caller supplied
 * UNSIGNED OHLCV, never "losses neutralized" on an actual account.
 */
import {inspectFrozenSignalBatch} from './b287-signal-witness.mjs';
import {createHash} from 'node:crypto';

const fail = code => {throw Object.assign(new Error(code), {code});};
const hash = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');
const finite = n => typeof n === 'number' && Number.isFinite(n);
const fixed = n => Number(n.toFixed(6));
const marketFields = ({asset,targetCloseMs,open,high,low,close,volume}) =>
 ({asset,targetCloseMs,open,high,low,close,volume});
const H = 3600000, GRACE = 300000;
const MODES = Object.freeze(['manual','hybrid','reverse']);
export const B288_FIXED_PROTOCOL = Object.freeze({
 schema:'JENIOS_B288_PAIRED_OFFLINE_PROTOCOL_V1',
 candleMs:H, graceMs:GRACE, riskStopPct:0.01,
 roundTripCostBps:Object.freeze([0,10,30]),
 adverseStopSlipBps:Object.freeze([0,10,30]),
 exactPairedEventsRequired:true, unverifiedSpotUsdOnly:true,
 strictPreCandleSignalFreeze:true, noBrokerOrPaperExecution:true
});
function validObservation(o,s,now){
 if(!o || o.id!==s.id || o.asset!==s.asset || o.targetCloseMs!==s.targetCloseMs ||
 !Number.isSafeInteger(o.observedAtMs) || o.observedAtMs<s.targetCloseMs+GRACE ||
 o.observedAtMs>now || o.signedByIndependentSource!==false ||
 o.orderExecuted!==false || o.quoteCurrency!=='USD' ||
 ![o.open,o.high,o.low,o.close,o.volume].every(finite) ||
 o.open<=0 || o.high<=0 || o.low<=0 || o.close<=0 || o.volume<=0 ||
 o.high<Math.max(o.open,o.close,o.low) ||
 o.low>Math.min(o.open,o.close) || o.high/o.low>1.5)
 fail('B288_INVALID_OR_EARLY_PUBLIC_OHLCV');
}
function evaluateOne(s,o,costBps,slipBps) {
 if(s.direction==='ABSTAIN')return Object.freeze({
  netR:null,decision:'ABSTAIN',stopTouched:false,observedFill:false
 });
 const side=s.direction==='UP'?1:-1,entry=o.open,stop=entry*(1-side*B288_FIXED_PROTOCOL.riskStopPct);
 const touched=side===1?o.low<=stop:o.high>=stop;
 const exit=touched?stop-side*entry*slipBps/10000:o.close;
 const netR=fixed(side*(exit-entry)/(entry*B288_FIXED_PROTOCOL.riskStopPct)-
  costBps/10000/B288_FIXED_PROTOCOL.riskStopPct);
 return Object.freeze({netR,decision:s.direction,stopTouched:touched,
  observedFill:false});
}
export function evaluatePairedFrozenSignals({batch,observations,observedAtMs=Date.now()}={}) {
 const b287=inspectFrozenSignalBatch(batch,{nowMs:observedAtMs});
 if(!Array.isArray(observations) || observations.length!==batch.signals.length ||
 !Number.isSafeInteger(observedAtMs))
 fail('B288_INCOMPLETE_OR_INVALID_OUTCOMES');
 const byId=new Map();
 for(const o of observations){
  if(!o || typeof o.id!=='string' || byId.has(o.id))
   fail('B288_DUPLICATE_OR_MISSING_OUTCOME');
  byId.set(o.id,o);
 }
 const groups=new Map();
 for(const s of batch.signals){
  const targetOpen=s.targetCloseMs-H;
  if(!Number.isSafeInteger(s.targetCloseMs) || s.targetCloseMs%H!==0 ||
  !Number.isSafeInteger(batch.frozenAtMs) || batch.frozenAtMs>=targetOpen ||
  s.signalAtMs>=targetOpen)
   fail('B288_LOOKAHEAD_OR_UNCLOSED_SIGNAL');
  const o=byId.get(s.id);
  validObservation(o,s,observedAtMs);
  const key=s.asset+'|'+s.targetCloseMs;
  if(!groups.has(key))groups.set(key,{key,asset:s.asset,
   targetCloseMs:s.targetCloseMs,signals:{},observations:{}});
  const g=groups.get(key);
  if(g.signals[s.mode])fail('B288_DUPLICATE_MODE_IN_COHORT');
  g.signals[s.mode]=s;g.observations[s.mode]=o;
 }
 const sorted=[...groups.values()].sort((a,b)=>a.targetCloseMs-b.targetCloseMs||a.asset.localeCompare(b.asset));
 for(const g of sorted){
  if(MODES.some(m=>!g.signals[m]))fail('B288_PAIRED_COHORT_INCOMPLETE');
  const a=g.signals.manual.direction,h=g.signals.hybrid.direction,
   r=g.signals.reverse.direction;
  if((a==='ABSTAIN' && (h!=='ABSTAIN'||r!=='ABSTAIN')) ||
   (a!=='ABSTAIN' && h!==a && h!=='ABSTAIN') ||
   (a!=='ABSTAIN' && r!==(a==='UP'?'DOWN':'UP') && r!=='ABSTAIN'))
   fail('B288_NONCOMPARABLE_MODE_DECISIONS');
  const obs=MODES.map(m=>g.observations[m]);
  const signature=hash(marketFields(obs[0]));
  if(obs.some(x=>hash(marketFields(x))!==signature))
   fail('B288_NONMATCHING_MARKET_OBSERVATIONS');
 }
 const scored=[];
 for(const g of sorted)for(const mode of MODES){
  const signal=g.signals[mode],o=g.observations[mode];
  for(const costBps of B288_FIXED_PROTOCOL.roundTripCostBps)
   for(const slipBps of B288_FIXED_PROTOCOL.adverseStopSlipBps)
    scored.push(Object.freeze({key:g.key,asset:g.asset,mode,
     targetCloseMs:g.targetCloseMs,costBps,slipBps,
     ...evaluateOne(signal,o,costBps,slipBps)}));
 }
 const scenarios=[],costPairs=B288_FIXED_PROTOCOL.roundTripCostBps.flatMap(costBps=>
  B288_FIXED_PROTOCOL.adverseStopSlipBps.map(slipBps=>({costBps,slipBps})));
 for(const mode of MODES)for(const {costBps,slipBps} of costPairs){
  const items=scored.filter(x=>x.mode===mode&&x.costBps===costBps&&x.slipBps===slipBps);
  let trades=0,wins=0,losses=0,flat=0,abstained=0,stops=0,sum=0,peak=0,maxDrawdownR=0;
  for(const row of items){
   if(row.netR===null){abstained++;continue;}
   trades++;sum+=row.netR;
   if(row.netR>0)wins++;else if(row.netR<0)losses++;else flat++;
   if(row.stopTouched)stops++;
   peak=Math.max(peak,sum);maxDrawdownR=Math.max(maxDrawdownR,peak-sum);
  }
  scenarios.push(Object.freeze({mode,costBps,slipBps,cohorts:sorted.length,
   trades,wins,losses,flat,abstained,stopTouches:stops,
   hypotheticalWinRatePct:trades?fixed(100*wins/trades):null,
   totalNetR:trades?fixed(sum):null,
   meanNetR:trades?fixed(sum/trades):null,
   maxDrawdownR:trades?fixed(maxDrawdownR):null,
   exposurePct:fixed(100*trades/sorted.length),
   observedTrades:0,observedBrokerFills:0,profitPct:null
  }));
 }
 const avoided={hypotheticalLossesAvoided:0,hypotheticalLossRNotTaken:0,
  hypotheticalGainsMissed:0,hypotheticalGainRForegone:0,neutralFiltered:0,
  filteredSignals:0};
 for(const g of sorted){
  const m=g.signals.manual,h=g.signals.hybrid;
  if(m.direction==='ABSTAIN'||h.direction!=='ABSTAIN')continue;
  const manual=evaluateOne(m,g.observations.manual,30,30);
  avoided.filteredSignals++;
  if(manual.netR<0){avoided.hypotheticalLossesAvoided++;
   avoided.hypotheticalLossRNotTaken+=-manual.netR;}
  else if(manual.netR>0){avoided.hypotheticalGainsMissed++;
   avoided.hypotheticalGainRForegone+=manual.netR;}
  else avoided.neutralFiltered++;
 }
 avoided.hypotheticalLossRNotTaken=fixed(avoided.hypotheticalLossRNotTaken);
 avoided.hypotheticalGainRForegone=fixed(avoided.hypotheticalGainRForegone);
 return Object.freeze({
  schema:'JENIOS_B288_PAIRED_STRESS_AUDIT_V1',
  frozenBatchSha256:b287.sha256, protocolSha256:hash(B288_FIXED_PROTOCOL),
  studiedCohorts:sorted.length,scenarioRows:scored.length,
  scenarios:Object.freeze(scenarios),
  counterfactual30_30:Object.freeze(avoided),
  sourceCandleHashes:Object.freeze(sorted.map(g=>Object.freeze({
   asset:g.asset,targetCloseMs:g.targetCloseMs,ohlcvSha256:hash(g.observations.manual)
  }))),
  signedMarketSource:false,externallyWitnessedPredictionTime:false,
  privateRobotCodeInvoked:false,proprietarySignalOriginVerified:false,
  closedCandleDataSource:'CALLER_SUPPLIED_UNSIGNED_USD_SPOT',
  lossNeutralizationVerified:false,actualWins:0,actualLosses:0,
  ordersSent:0,paperOrdersSent:0,paymentsSent:0,
  executionFillVerified:false,shortBorrowFundingModeled:false,
  liveExecutionEnabled:false,commercialPerformanceClaimAllowed:false,
  prospectiveStatisticalAdvantageCertified:false,
  noAutomatedParameterSelection:true,
  caution:'Contagens e R hipoteticos de sinais fornecidos e dados nao assinados. Nao sao perdas neutralizadas reais, lucro, percentual da conta ou desempenho de robos proprietarios.'
 });
}
