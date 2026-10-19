/** B93 — aligned, fully closed multi-timeframe OHLCV research.
 * Never interpolate missing candles or claim a live feed / execution advice.
 */
import {normalizeHistoricalCandles,studyHistoricalCandles} from './market-study.mjs';
const factors=Object.freeze([1,2,3]);
const validInterval=ms=>Number.isSafeInteger(ms)&&ms>=60000&&ms<=21600000&&ms%60000===0;
const fail=(reason)=>Object.assign(new Error(reason),{reason});
export function aggregateClosedBars(input,{baseIntervalMs,group=2,now=Date.now()}={}){
 if(!validInterval(baseIntervalMs)||!factors.includes(group)||!Number.isFinite(now))
  throw fail('INVALID_TIMEFRAME_CONFIGURATION');
 const rows=normalizeHistoricalCandles(input,now);
 const timestamps=rows.map(x=>Date.parse(x.time));
 for(let i=1;i<rows.length;i++)
  if(timestamps[i]-timestamps[i-1]!==baseIntervalMs)throw fail('MISSING_BASE_CANDLE');
 if(timestamps.some(t=>t%baseIntervalMs!==0))throw fail('UNALIGNED_BASE_CANDLES');
 const targetMs=baseIntervalMs*group;
 const byBucket=new Map();
 for(let i=0;i<rows.length;i++){
  const t=timestamps[i],bucket=Math.floor(t/targetMs)*targetMs;
  const b=byBucket.get(bucket)||[];
  b.push(rows[i]);byBucket.set(bucket,b);
 }
 const keys=[...byBucket.keys()].sort((a,b)=>a-b),candles=[];
 for(let i=0;i<keys.length;i++){
  const bucket=keys[i],bars=byBucket.get(bucket),edge=i===0||i===keys.length-1;
  if(bars.length!==group){
   if(edge)continue; // do not fabricate a partially observed outer bucket
   throw fail('INCOMPLETE_INTERNAL_AGGREGATE');
  }
  if(Date.parse(bars[0].time)!==bucket || Date.parse(bars.at(-1).time)!==bucket+(group-1)*baseIntervalMs)
   throw fail('MISALIGNED_AGGREGATE');
  if(bucket+targetMs>now)continue; // never include incomplete current target candle
  candles.push({
   time:new Date(bucket).toISOString(),open:bars[0].open,
   high:Math.max(...bars.map(b=>b.high)),low:Math.min(...bars.map(b=>b.low)),
   close:bars.at(-1).close,volume:bars.reduce((sum,b)=>sum+b.volume,0)
  });
 }
 if(candles.length<60)throw fail('INSUFFICIENT_AGGREGATED_CANDLES');
 return {candles,baseIntervalMs,intervalMs:targetMs,
  excludedPartial:rows.length-candles.length*group,
  lastClosedAt:new Date(Date.parse(candles.at(-1).time)+targetMs).toISOString(),
  origin:'user_or_public_historical_ohlcv_unverified',live:false,executionAuthorized:false};
}
function scenarioFor(study){
 const signals=study.indicators.filter(x=>!x.riskOnly);
 const up=signals.filter(x=>x.direction==='alta').length;
 const down=signals.filter(x=>x.direction==='baixa').length;
 const bias=up>=4&&up>=down+2?'alta':down>=4&&down>=up+2?'baixa':'lateral_ou_inconclusivo';
 return {bias,up,down,confidenceValidated:false,
  caution:study.volatilityAlert?'Volatilidade histórica elevada; revise o risco.':
   'Leituras históricas não garantem continuidade do movimento.'};
}
export function multiTimeframeStudy(raw,{baseIntervalMs=300000,now=Date.now(),timeframe='swing'}={}){
 if(!Array.isArray(raw)||raw.length<180||raw.length>500)throw fail('INSUFFICIENT_MULTITIMEFRAME_HISTORY');
 const series=factors.map(group=>{
  const aggregated=aggregateClosedBars(raw,{baseIntervalMs,group,now});
  const study=studyHistoricalCandles(aggregated.candles,{now,timeframe});
  const signals=scenarioFor(study);
  const closes=aggregated.candles;
  const prior=closes.slice(-21,-1);
  return {multiple:group,minutes:baseIntervalMs*group/60000,
   closedBars:aggregated.candles.length,lastClosedAt:aggregated.lastClosedAt,
   ...signals,studiedSignals:study.indicators.length,
   support:Math.min(...prior.map(x=>x.low)),resistance:Math.max(...prior.map(x=>x.high)),
   providerVerified:false,executionAuthorized:false};
 });
 const biases=series.map(x=>x.bias);
 const allUp=biases.every(x=>x==='alta');
 const allDown=biases.every(x=>x==='baixa');
 const consensus=allUp?'alta_alinhada':allDown?'baixa_alinhada':'sem_confluencia';
 const comment=consensus==='alta_alinhada'?
  'Três leituras históricas inclinam-se para alta; confirme riscos e invalidações antes de qualquer decisão humana.':
  consensus==='baixa_alinhada'?
  'Três leituras históricas inclinam-se para baixa; a ausência de confirmação prospectiva impede previsão.':
  'Os intervalos divergem ou estão laterais: aguardar mais evidências é uma alternativa prudente.';
 return {origin:'historical_educational_study_only',series,consensus,comment,
  accumulationConfirmed:false,distributionConfirmed:false,
  providerVerified:false,recommendedTrade:null,certainty:null,
  profitabilityClaim:false,realExecutionAllowed:false};
}
