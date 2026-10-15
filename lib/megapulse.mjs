// First verified coverage: daily WIN/WDO contracts. No intraday or institutional inference.
export function normalizeFutures(payload, asset, now = Date.now()) {
  if (payload?.asset !== asset || !Array.isArray(payload.contracts)) throw Error('INVALID_SOURCE');
  const today = new Date(now).toISOString().slice(0,10);
  return payload.contracts.filter(x => x.underlyingAsset === asset && new RegExp('^'+asset+'[FGHJKMNQUVXZ][0-9]{2}$').test(x.symbol)
    && /^\d{4}-\d{2}-\d{2}$/.test(x.expirationDate) && x.expirationDate >= today
    && Number.isFinite(x.close) && x.close > 0 && Number.isFinite(x.volume) && x.volume > 0
    && Number.isFinite(x.oscillationPct) && Number.isFinite(x.date) && x.date*1000 <= now
    && now-x.date*1000 <= 7*86400000).sort((a,b)=>a.expirationDate.localeCompare(b.expirationDate)).slice(0,1)
    .map(x=>({id:x.symbol,nome:asset==='WIN'?'Mini Ibovespa':'Mini dólar',simbolo:x.symbol,
      fechamento:x.close,variacao:x.oscillationPct,volume:x.volume,dataPregao:new Date(x.date*1000).toISOString().slice(0,10),vencimento:x.expirationDate}));
}
export function createMegaPulse({fetchImpl=fetch,now=Date.now,env=process.env}={}) {
 let saved=null,next=0,inFlight=null;
 return async function load() {
  if(saved && now()<next) return structuredClone(saved);
  if(inFlight) return structuredClone(await inFlight);
  inFlight=(async()=>{
   const results=await Promise.allSettled(['WIN','WDO'].map(async asset=>{
    const response=await fetchImpl('https://brapi.dev/api/v2/futures/term-structure?asset='+asset,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7000),headers:{Accept:'application/json',...(env.BRAPI_TOKEN?{Authorization:'Bearer '+env.BRAPI_TOKEN}:{})}});
    if(!response.ok) throw Error('SOURCE_UNAVAILABLE');
    return normalizeFutures(await response.json(),asset,now());
   }));
   const rows=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
   saved={rows,status:{disponivel:rows.length>0,fonte:'brapi · fechamento diário',atualizadoEm:new Date(now()).toISOString(),parcial:rows.length<2,cobertura:'Mini Ibovespa e mini dólar; ações ainda não incluídas.',mensagem:rows.length?'Leitura diária; não representa cotação em tempo real.':'Não foi possível obter uma leitura diária recente. Tente novamente mais tarde.'}};
   next=now()+(rows.length?15*60000:60000); return structuredClone(saved);
  })();
  try{return await inFlight;}finally{inFlight=null;}
 };
}
export const getMegaPulse=createMegaPulse();
