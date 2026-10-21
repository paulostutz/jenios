/** B272/B273: laboratory-only next-closed-bar walk-forward arithmetic.
 * No access to brokers, user accounts, live execution, private trading engines or payments.
 * All imported OHLCV is explicitly unverified. Synthetic tests are NOT market validation.
 */
import {createHash} from 'node:crypto';
const SHA=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(6));
const ASSETS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
const MODES=Object.freeze(['direct','reverse','hybrid']);
export const OFFLINE_HYPOTHESES=Object.freeze([
 Object.freeze({id:'EMA_CONTEXT_V1',title:'EMA12/EMA26: contexto e continuidade no candle seguinte',source:'original_quantitative_hypothesis',sourceVideoClaim:false}),
 Object.freeze({id:'CLOSED_BREAKOUT_V1',title:'Fechamento acima/abaixo da faixa prévia de 20 candles',source:'original_quantitative_hypothesis',sourceVideoClaim:false})
]);
const core=p=>({
 hypothesisId:p.hypothesisId,asset:p.asset,intervalMs:p.intervalMs,
 trainEndsAtMs:p.trainEndsAtMs,frozenAtMs:p.frozenAtMs,
 holdoutStartsAtMs:p.holdoutStartsAtMs,holdoutEndsAtMs:p.holdoutEndsAtMs,
 prospectiveStartsAtMs:p.prospectiveStartsAtMs,stopPct:p.stopPct,
 costBps:p.costBps,executionModel:'NEXT_BAR_OPEN_SINGLE_BAR_STOP_CONSERVATIVE_COST'
});
export function freezeOfflineStudy(input={}){
 const {hypothesisId,asset,intervalMs,trainEndsAtMs,frozenAtMs,
 holdoutStartsAtMs,holdoutEndsAtMs,prospectiveStartsAtMs,stopPct,costBps}=input;
 if(!OFFLINE_HYPOTHESES.some(x=>x.id===hypothesisId)||!ASSETS.includes(asset)||
 !Number.isSafeInteger(intervalMs)||intervalMs<60000||intervalMs>86400000||
 86400000%intervalMs!==0)fail('B272_UNSUPPORTED_RESEARCH_METHOD');
 const times=[trainEndsAtMs,frozenAtMs,holdoutStartsAtMs,holdoutEndsAtMs,prospectiveStartsAtMs];
 if(!times.every(x=>Number.isSafeInteger(x)&&x>0&&x%intervalMs===0)||
 !(trainEndsAtMs<=frozenAtMs&&frozenAtMs<holdoutStartsAtMs&&
 holdoutStartsAtMs-trainEndsAtMs>=86400000&&
 holdoutEndsAtMs>holdoutStartsAtMs+intervalMs&&
 prospectiveStartsAtMs>holdoutEndsAtMs))fail('B272_INVALID_TEMPORAL_SPLIT_OR_EMBARGO');
 if(!finite(stopPct)||stopPct<=0||stopPct>0.05||
 !Array.isArray(costBps)||costBps.length!==3||
 ![0,10,30].every(v=>costBps.includes(v))||
 new Set(costBps).size!==3)fail('B272_RISK_OR_COST_PROTOCOL_MISSING');
 const values=core({hypothesisId,asset,intervalMs,trainEndsAtMs,frozenAtMs,
  holdoutStartsAtMs,holdoutEndsAtMs,prospectiveStartsAtMs,stopPct,costBps:[...costBps].sort((a,b)=>a-b)});
 return Object.freeze({...values,costBps:Object.freeze(values.costBps),protocolHash:SHA(values),
  design:'PRE_REGISTERED_RESEARCH_ONLY',independentMarketDataCertified:false,
  brokerOrdersPermitted:false,originalRobotChanged:false});
}
function validBars(bars,{intervalMs,asOfMs}){
 if(!Array.isArray(bars)||bars.length<90||bars.length>5000||!Number.isSafeInteger(asOfMs)||asOfMs<=0)
  fail('B272_INSUFFICIENT_OR_INVALID_OFFLINE_BARS');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(!b||!Number.isSafeInteger(b.t)||b.t<=0||b.t%intervalMs!==0||
   ![b.open,b.high,b.low,b.close,b.volume].every(finite)||
   b.open<=0||b.close<=0||b.low<=0||b.volume<0||
   b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||
   (i>0&&b.t!==bars[i-1].t+intervalMs))fail('B272_GAPPED_OR_INVALID_CANDLES');
 }
 if(bars.at(-1).t+intervalMs>asOfMs)fail('B272_FUTURE_OR_OPEN_CANDLE');
}
function emaSeries(bars,period){
 const a=2/(period+1),out=[];let state=bars[0].close;
 for(const b of bars){state=a*b.close+(1-a)*state;out.push(state);}
 return out;
}
function candidate(bars,index,protocol,fast,slow){
 const previous=bars[index-1],spread=fast[index-1]-slow[index-1];
 let direction=0;
 if(protocol.hypothesisId==='EMA_CONTEXT_V1')direction=spread>0?1:spread<0?-1:0;
 else{
  const past=bars.slice(index-21,index-1);
  if(past.length!==20)return {direction:0,hybridAllowed:false};
  const high=Math.max(...past.map(x=>x.high)),low=Math.min(...past.map(x=>x.low));
  direction=previous.close>high?1:previous.close<low?-1:0;
 }
 const strong=Math.abs(spread)/previous.close>=0.0015;
 const hybridAllowed=strong&&(protocol.hypothesisId==='EMA_CONTEXT_V1'||Math.sign(spread)===direction);
 return {direction,hybridAllowed};
}
function score(executions,costBps){
 let netSum=0,peak=0,maxDrawdown=0,wins=0,losses=0,grossSum=0,costSum=0,stops=0;
 let sumPositive=0,sumNegative=0;
 for(const e of executions){
  const risk=Math.abs(e.entry-e.stop);
  const gross=(e.exit-e.entry)*e.direction/risk;
  const cost=(costBps/10000)*e.entry/risk;
  const net=gross-cost;grossSum+=gross;costSum+=cost;netSum+=net;
  if(net>0){wins++;sumPositive+=net;}else if(net<0){losses++;sumNegative-=net;}
  if(e.stopped)stops++;
  peak=Math.max(peak,netSum);maxDrawdown=Math.max(maxDrawdown,peak-netSum);
 }
 const n=executions.length;
 return Object.freeze({roundTripCostBps:costBps,trades:n,wins,losses,stopHits:stops,
  averageGrossR:n?round(grossSum/n):null,averageNetR:n?round(netSum/n):null,
  totalNetR:n?round(netSum):null,winRate:n?round(wins/n):null,
  maxDrawdownR:n?round(maxDrawdown):null,profitFactor:sumNegative>0?round(sumPositive/sumNegative):null,
  executionFeesAndSlippageModeledAsFixedBps:true,
  actualBrokerFillsVerified:false,statisticalSignificanceCertified:false});
}
export function evaluateOfflineHoldout({candles,protocol,asOfMs}={}){
 if(!protocol||typeof protocol!=='object'||!protocol.protocolHash||
 SHA(core(protocol))!==protocol.protocolHash)fail('B272_PROTOCOL_NOT_FROZEN_OR_TAMPERED');
 const clean=freezeOfflineStudy(protocol);
 if(clean.protocolHash!==protocol.protocolHash)fail('B272_PROTOCOL_HASH_MISMATCH');
 validBars(candles,{intervalMs:clean.intervalMs,asOfMs});
 if(candles[0].t+60*clean.intervalMs>clean.trainEndsAtMs||
 clean.holdoutEndsAtMs>asOfMs||
 candles.at(-1).t+clean.intervalMs<clean.holdoutEndsAtMs)
  fail('B272_INSUFFICIENT_TRAIN_OR_HOLDOUT_COVERAGE');
 const fast=emaSeries(candles,12),slow=emaSeries(candles,26);
 const executed=Object.fromEntries(MODES.map(m=>[m,[]]));
 let holdoutCandles=0,earliestObservationMs=null,latestObservationMs=null;
 for(let i=60;i<candles.length;i++){
  const b=candles[i];
  if(b.t<clean.holdoutStartsAtMs||b.t+clean.intervalMs>clean.holdoutEndsAtMs)continue;
  holdoutCandles++;
  const prev=candles[i-1];const signalTime=prev.t+clean.intervalMs;
  if(signalTime>b.t)fail('B272_FUTURE_SIGNAL_LEAKAGE');
  const {direction,hybridAllowed}=candidate(candles,i,clean,fast,slow);
  if(!direction)continue;
  earliestObservationMs??=signalTime;latestObservationMs=signalTime;
  for(const mode of MODES){
   if(mode==='hybrid'&&!hybridAllowed)continue;
   const directionMode=mode==='reverse'?-direction:direction;
   const entry=b.open,stop=entry*(1-directionMode*clean.stopPct);
   const stopped=directionMode>0?b.low<=stop:b.high>=stop;
   // Stops are modeled at the threshold, NOT actual executable fills; gaps and book depth unverified.
   const exit=stopped?stop:b.close;
   executed[mode].push({entry,exit,stop,direction:directionMode,stopped,signalTime,entryTime:b.t});
  }
 }
 if(holdoutCandles===0)fail('B272_EMPTY_HOLDOUT_WINDOW');
 const scenarios=Object.freeze(MODES.flatMap(mode=>clean.costBps.map(costBps=>Object.freeze({
  mode,...score(executed[mode],costBps)
 }))));
 return Object.freeze({schema:'JENIOS_B272_OFFLINE_HOLDOUT_V1',hypothesisId:clean.hypothesisId,asset:clean.asset,
  protocolHash:clean.protocolHash,dataSha256:SHA(candles),closedThroughMs:candles.at(-1).t+clean.intervalMs,
  holdoutStartsAtMs:clean.holdoutStartsAtMs,holdoutEndsAtMs:clean.holdoutEndsAtMs,
  holdoutCandles,firstDecisionAtMs:earliestObservationMs,lastDecisionAtMs:latestObservationMs,
  scenarios,dataProvenance:'CALLER_SUPPLIED_OHLCV_UNVERIFIED',paperOrdersSent:0,
  brokerOrdersSent:0,proprietaryTradingCoreModified:false,
  independentSourceCertified:false,walkForwardProspectiveCertified:false,
  modelIncludesActualOrderbook:false,modelIncludesGapFillGuarantee:false,
  executionModelIsSimplified:true,statisticalAdvantageCertified:false,
  operationsApproved:false,publicationApproved:false,
  caveat:'Resultado numérico de laboratório sobre dados informados; sem origem certificada, fills reais, gap/slippage variável, significância nem evidência prospectiva.'});
}
