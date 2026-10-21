/** JENIOS original research laboratory. Public, deterministic, closed-candle observations ONLY.
 * This module does not import the proprietary robot runtime, send broker orders,
 * claim author approval or use unavailable video transcripts. NEVER a live signal.
 */
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(6));
export const RESEARCH_FAMILIES=Object.freeze([
 Object.freeze({id:'ema-trend-context',question:'Tendência em médias de candles fechados melhora o filtro de contexto?',inputs:['ema12','ema26'],pitfall:'Atraso e mercados laterais'}),
 Object.freeze({id:'momentum-confirmation',question:'IFR e estocástico agregam informação não redundante ao contexto?',inputs:['rsi14','stoch14'],pitfall:'Sobrecompra e sobrevenda não são sinais isolados'}),
 Object.freeze({id:'volatility-liquidity',question:'ATR, dispersão de preços e volume normalizado melhoram o controle de risco?',inputs:['atr14','bollingerWidth20','relativeVolume20'],pitfall:'Spread dinâmico e livro de ofertas não estão representados'}),
 Object.freeze({id:'false-breakout-reversal',question:'Falhas de rompimento e padrões de reversão sobrevivem a custos e validação OOS?',inputs:['priorHigh20','priorLow20'],pitfall:'Viés de olhar para o futuro e sobreajuste'}),
 Object.freeze({id:'multi-timeframe-compatibility',question:'Filtrar direção pelo contexto temporal maior altera resultados líquidos?',inputs:['candleIntervalMs'],pitfall:'Períodos incompletos e desalinhamento de fontes'})
]);
function ema(data,period){const alpha=2/(period+1);let v=data[0];for(let i=1;i<data.length;i++)v=alpha*data[i]+(1-alpha)*v;return v;}
function rsi(data,period=14){let gains=0,losses=0;for(let i=data.length-period;i<data.length;i++){const delta=data[i]-data[i-1];gains+=Math.max(0,delta);losses+=Math.max(0,-delta);}if(gains===0&&losses===0)return 50;if(losses===0)return 100;if(gains===0)return 0;return 100-100/(1+gains/losses);}
export function observeClosedCandleResearch(bars,{asOfMs,intervalMs=3600000}={}){
 if(!Array.isArray(bars)||bars.length<60||bars.length>5000||!Number.isSafeInteger(intervalMs)||intervalMs<60000||intervalMs>86400000||!Number.isSafeInteger(asOfMs)||asOfMs<=0)
  fail('RESEARCH_CLOSED_SERIES_REQUIRED');
 for(let i=0;i<bars.length;i++){
  const x=bars[i];if(!x||!Number.isSafeInteger(x.t)||x.t<=0||x.t%intervalMs!==0||
   ![x.open,x.high,x.low,x.close,x.volume].every(finite)||x.close<=0||x.open<=0||x.low<=0||
   x.high<Math.max(x.open,x.close,x.low)||x.low>Math.min(x.open,x.close)||x.volume<0||
   (i>0&&x.t-bars[i-1].t!==intervalMs))fail('RESEARCH_INVALID_OHLCV_OR_GAP');
 }
 if(bars.at(-1).t+intervalMs>asOfMs)fail('RESEARCH_OPEN_OR_FUTURE_CANDLE');
 const closes=bars.map(x=>x.close),last=bars.at(-1),prev=bars.at(-2);
 const lookback=bars.slice(-14),bb=closes.slice(-20);
 const stochHigh=Math.max(...lookback.map(x=>x.high)),stochLow=Math.min(...lookback.map(x=>x.low));
 const prior=bars.slice(-21,-1);
 const priorHigh=Math.max(...prior.map(x=>x.high)),priorLow=Math.min(...prior.map(x=>x.low));
 const avg=bb.reduce((n,v)=>n+v,0)/bb.length;
 const dev=Math.sqrt(bb.reduce((n,v)=>n+(v-avg)**2,0)/bb.length);
 const tr=bars.slice(-14).map((x,i)=>{
  const p=i===0?bars.at(-15):bars[bars.length-14+i-1];
  return Math.max(x.high-x.low,Math.abs(x.high-p.close),Math.abs(x.low-p.close));
 });
 const volumeBase=bars.slice(-21,-1).reduce((n,x)=>n+x.volume,0)/20;
 const features=Object.freeze({
  ema12:round(ema(closes,12)),ema26:round(ema(closes,26)),rsi14:round(rsi(closes)),
  stoch14:round(stochHigh===stochLow?50:100*(last.close-stochLow)/(stochHigh-stochLow)),
  atr14:round(tr.reduce((n,v)=>n+v,0)/14),bollingerWidth20:round(4*dev/avg),
  relativeVolume20:volumeBase>0?round(last.volume/volumeBase):null,
  priorHigh20:round(priorHigh),priorLow20:round(priorLow)
 });
 const digest=createHash('sha256').update(JSON.stringify(bars)).digest('hex');
 return Object.freeze({schema:'JENIOS_RESEARCH_CLOSED_CANDLE_V1',
  dataDigestSha256:digest,barCount:bars.length,asOfMs,closedThroughMs:last.t+intervalMs,
  candleIntervalMs:intervalMs,features,
  testsSuggested:RESEARCH_FAMILIES.map(x=>x.id),
  observedSourceIndependentlyVerified:false,videoTranscriptVerified:false,
  tradingSignalsGenerated:0,ordersSent:0,automatedTradingEnabled:false,
  coreChanged:false,profitabilityDemonstrated:false,
  notice:'Estudo de indicadores matemáticos com candles fechados; nenhum desempenho ou autorização de negociação foi inferido.'});
}
export function reviewFrozenResearchProtocol({frozenAtMs,trainEndsAtMs,holdoutStartsAtMs,
 prospectiveStartsAtMs,costBps,assets,modes}={}){
 const positive=[frozenAtMs,trainEndsAtMs,holdoutStartsAtMs,prospectiveStartsAtMs].every(x=>Number.isSafeInteger(x)&&x>0);
 const complete=positive&&frozenAtMs<=trainEndsAtMs&&holdoutStartsAtMs>=trainEndsAtMs+86400000&&
  prospectiveStartsAtMs>holdoutStartsAtMs&&Array.isArray(costBps)&&costBps.length>=3&&
  [0,10,30].every(c=>costBps.includes(c))&&costBps.every(c=>Number.isSafeInteger(c)&&c>=0&&c<=500)&&
  Array.isArray(assets)&&['BTCUSDT','ETHUSDT','SOLUSDT'].every(a=>assets.includes(a))&&
  Array.isArray(modes)&&['direct','reverse','hybrid'].every(m=>modes.includes(m));
 return Object.freeze({schema:'JENIOS_RESEARCH_PROTOCOL_V1',valid:!!complete,
  classification:complete?'RESEARCH_ONLY_AWAITING_EXTERNAL_HOLDOUT':'RESEARCH_PROTOCOL_INCOMPLETE',
  independentDataProvenanceCertified:false,privateRobotValidated:false,
  statisticalAdvantageCertified:false,originalCoreUnchanged:true,
  canPublishProfitClaims:false,ordersAuthorized:false,liveTradingAllowed:false});
}
