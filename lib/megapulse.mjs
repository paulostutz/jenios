// Intraday quotes only: daily futures settlements never enter this panel.
import {currentMarketRow} from './market-freshness.mjs';
export {currentMarketRow} from './market-freshness.mjs';
export const MEGAPULSE_SYMBOLS=['PETR4','VALE3','ITUB4','MGLU3'];
export function normalizeLiveQuotes(payload,allowed=MEGAPULSE_SYMBOLS,now=Date.now()){
 if(!Array.isArray(payload?.results))throw Error('INVALID_QUOTES');
 return payload.results.flatMap(result=>{
  const quote=result.data;
  if(!allowed.includes(result.symbol)||result.changed||result.requestedSymbol!==result.symbol||quote?.currency!=='BRL'||typeof quote.regularMarketTime!=='string'||!Number.isFinite(quote.regularMarketVolume)||quote.regularMarketVolume<=0)return [];
  const row={id:result.symbol,nome:quote.shortName||result.symbol,simbolo:result.symbol,preco:quote.regularMarketPrice,variacao:quote.regularMarketChangePercent,volume:quote.regularMarketVolume,negociadoEm:quote.regularMarketTime};
  return currentMarketRow(row,now)?[row]:[];
 });
}
export function createMegaPulse({fetchImpl=fetch,now=Date.now,env=process.env}={}) {
 let saved=null,next=0,inFlight=null;
 return async function load() {
  if(saved&&now()<next)return {...structuredClone(saved),rows:saved.rows.filter(row=>currentMarketRow(row,now()))};
  if(inFlight)return structuredClone(await inFlight);
  inFlight=(async()=>{
   const symbols=MEGAPULSE_SYMBOLS;
   const groups=env.BRAPI_TOKEN?[symbols]:symbols.map(symbol=>[symbol]);
   const results=await Promise.allSettled(groups.map(async group=>{
    const response=await fetchImpl('https://brapi.dev/api/v2/stocks/quote?symbols='+group.join(','),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7000),headers:{Accept:'application/json',...(env.BRAPI_TOKEN?{Authorization:'Bearer '+env.BRAPI_TOKEN}:{})}});
    if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
    return normalizeLiveQuotes(await response.json(),group,now());
   }));
   const rows=results.flatMap(result=>result.status==='fulfilled'?result.value:[]),responded=results.some(result=>result.status==='fulfilled');
   saved={rows,status:{disponivel:responded,atualizadoEm:new Date(now()).toISOString(),parcial:true,cobertura:'Ações B3 monitoradas. Apenas cotações com até 2 minutos; futuros aguardam cotação intradiária verificável.',maxAgeSeconds:120,mensagem:rows.length?'Cotação recente; variação em relação ao fechamento anterior.':responded?'Sem movimentos recentes confirmados agora.':'Não foi possível confirmar movimentos atuais nesta consulta.'}};
   next=now()+30000;return structuredClone(saved);
  })();
  try{return await inFlight;}finally{inFlight=null;}
 };
}
export const getMegaPulse=createMegaPulse();
