/** B79: deterministic readings of historic OHLCV supplied by the user.
 * No live quotes, forecasts, orders or verified performance.
 */
const invalid=code=>Object.assign(new Error(code),{code});
const avg=x=>x.reduce((a,b)=>a+b,0)/x.length;
const end=x=>x[x.length-1];
const round=(x,dp=2)=>Number.isFinite(x)?Number(x.toFixed(dp)):null;
function ema(values,n) {
 const result=Array(values.length).fill(null);
 if(values.length<n)return result;
 result[n-1]=avg(values.slice(0,n));
 for(let i=n;i<values.length;i++)result[i]=(2/(n+1))*values[i]+(1-2/(n+1))*result[i-1];
 return result;
}
function rsi(prices,n=14) {
 let gain=0,loss=0;
 for(let i=1;i<=n;i++){const x=prices[i]-prices[i-1];gain+=Math.max(0,x);loss+=Math.max(0,-x);}
 gain/=n;loss/=n;
 for(let i=n+1;i<prices.length;i++){
  const x=prices[i]-prices[i-1];
  gain=(gain*(n-1)+Math.max(0,x))/n;
  loss=(loss*(n-1)+Math.max(0,-x))/n;
 }
 return loss===0?(gain===0?50:100):100-100/(1+gain/loss);
}
function trueRanges(rows) {
 return rows.map((r,i)=>i===0?r.high-r.low:
  Math.max(r.high-r.low,Math.abs(r.high-rows[i-1].close),Math.abs(r.low-rows[i-1].close)));
}
function dmiAdx(rows,n=14) {
 const tr=trueRanges(rows),plus=[],minus=[];
 for(let i=1;i<rows.length;i++){
  const up=rows[i].high-rows[i-1].high,down=rows[i-1].low-rows[i].low;
  plus.push(up>down&&up>0?up:0);minus.push(down>up&&down>0?down:0);
 }
 let ts=tr.slice(1,n+1).reduce((a,b)=>a+b,0);
 let ps=plus.slice(0,n).reduce((a,b)=>a+b,0),ms=minus.slice(0,n).reduce((a,b)=>a+b,0);
 const dx=[];
 for(let i=n;i<rows.length;i++){
  if(i>n){ts=ts-ts/n+tr[i];ps=ps-ps/n+plus[i-1];ms=ms-ms/n+minus[i-1];}
  const pd=ts?100*ps/ts:0,md=ts?100*ms/ts:0;
  dx.push(pd+md?100*Math.abs(pd-md)/(pd+md):0);
 }
 let adx=avg(dx.slice(0,n));
 for(let i=n;i<dx.length;i++)adx=(adx*(n-1)+dx[i])/n;
 return {adx,plusDI:ts?100*ps/ts:0,minusDI:ts?100*ms/ts:0};
}
export function normalizeHistoricalCandles(input,now=Date.now()) {
 if(!Array.isArray(input)||input.length<60||input.length>500)throw invalid('UNSUPPORTED_SAMPLE_SIZE');
 let previous=0;
 return input.map((item,i)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw invalid('INVALID_CANDLE');
  const timestamp=typeof item.time==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(item.time)?Date.parse(item.time):NaN;
  const o=Number(item.open),h=Number(item.high),l=Number(item.low),c=Number(item.close),v=Number(item.volume);
  if(!Number.isFinite(timestamp)||timestamp<=previous||timestamp>now||timestamp<1
   ||![o,h,l,c,v].every(Number.isFinite)||o<=0||c<=0||l<=0||l>h
   ||h<Math.max(o,c)||l>Math.min(o,c)||v<0)throw invalid('INVALID_CANDLE_'+i);
  previous=timestamp;
  return {time:new Date(timestamp).toISOString(),open:o,high:h,low:l,close:c,volume:v};
 });
}
export function studyHistoricalCandles(input,{timeframe='swing',now=Date.now()}={}){
 if(!['swing','intraday'].includes(timeframe))throw invalid('INVALID_TIMEFRAME');
 const rows=normalizeHistoricalCandles(input,now);
 const closes=rows.map(x=>x.close),volumes=rows.map(x=>x.volume),price=end(closes);
 const ma20=avg(closes.slice(-20)),ma50=avg(closes.slice(-50));
 const fast=ema(closes,12),slow=ema(closes,26),fastLast=end(fast),slowLast=end(slow);
 const macdSeries=fast.map((v,i)=>v===null||slow[i]===null?null:v-slow[i]).filter(x=>x!==null);
 const macd=end(macdSeries),macdSignal=end(ema(macdSeries,9)),macdHistogram=macd-macdSignal;
 const momentum=rsi(closes),sample=closes.slice(-20),std=Math.sqrt(avg(sample.map(x=>(x-ma20)**2)));
 const upper=ma20+2*std,lower=ma20-2*std;
 const atr=avg(trueRanges(rows).slice(-14)),trend=dmiAdx(rows);
 const previous=rows.slice(-21,-1),resistance=Math.max(...previous.map(x=>x.high)),support=Math.min(...previous.map(x=>x.low));
 const vm=avg(volumes.slice(-21,-1)),ratio=vm?end(volumes)/vm:0;
 const recent=rows.slice(-6),left=recent.slice(0,3),right=recent.slice(3);
 const rising=Math.max(...right.map(x=>x.high))>Math.max(...left.map(x=>x.high))
  &&Math.min(...right.map(x=>x.low))>Math.min(...left.map(x=>x.low));
 const falling=Math.max(...right.map(x=>x.high))<Math.max(...left.map(x=>x.high))
  &&Math.min(...right.map(x=>x.low))<Math.min(...left.map(x=>x.low));
 const direction=(pos,neg)=>pos?'alta':neg?'baixa':'neutro';
 const indicators=[
  {id:'sma',name:'Médias móveis simples (20/50)',direction:direction(ma20>ma50,ma20<ma50),value:round(ma20-ma50)},
  {id:'ema',name:'Médias exponenciais (12/26)',direction:direction(fastLast>slowLast,fastLast<slowLast),value:round(fastLast-slowLast)},
  {id:'rsi',name:'RSI (14)',direction:direction(momentum>=55&&momentum<70,momentum<=45&&momentum>30),value:round(momentum)},
  {id:'macd',name:'MACD e sinal (12/26/9)',direction:direction(macdHistogram>0,macdHistogram<0),value:round(macdHistogram,4)},
  {id:'bollinger',name:'Bandas de Bollinger (20,2)',direction:direction(price>ma20&&price<=upper,price<ma20&&price>=lower),value:round(std?(price-ma20)/(2*std):0,3)},
  {id:'atr',name:'Volatilidade ATR (14)',direction:'neutro',value:round(atr/price*100),unit:'% do preço',riskOnly:true},
  {id:'adx',name:'Direção DMI/ADX (14)',direction:trend.adx>=20?direction(trend.plusDI>trend.minusDI,trend.plusDI<trend.minusDI):'neutro',value:round(trend.adx)},
  {id:'volume',name:'Volume contra média (20)',direction:'neutro',value:round(ratio),unit:'vezes',riskOnly:true},
  {id:'breakout',name:'Máxima e mínima anteriores (20)',direction:direction(price>resistance,price<support),value:round(price>resistance?price-resistance:price<support?price-support:0)},
  {id:'structure',name:'Estrutura máxima/mínima (6)',direction:direction(rising,falling),value:null}
 ];
 const up=indicators.filter(i=>i.direction==='alta').length,down=indicators.filter(i=>i.direction==='baixa').length;
 return {source:'user_supplied_historical_unverified',timeframe,observations:rows.length,
  lastObservation:end(rows).time,latestClose:price,
  indicators,consensus:up>=6&&down<=1?'predominancia_alta':down>=6&&up<=1?'predominancia_baixa':'misto_ou_inconclusivo',
  up,down,volatilityAlert:atr/price>0.06,providerVerified:false,live:false,
  orderAuthorized:false,profitPrediction:null,
  caution:'Análise histórica ilustrativa de dados importados não verificados. Não constitui cotação atual, sinal de operação, promessa de desempenho ou ordem real.'};
}
