// Confirmed Bitcoin outputs, never labelled purchases or attributed to institutions.
const API='https://mempool.space/api';
const HASH=/^[0-9a-f]{64}$/;
export function normalizeWhaleTransfers(transactions,now=Date.now()){
 if(!Array.isArray(transactions))throw Error('INVALID_TRANSACTIONS');
 const seen=new Set();
 return transactions.flatMap(tx=>{
  const at=Number(tx.status?.block_time)*1000;
  if(!HASH.test(tx.txid||'')||seen.has(tx.txid)||!tx.status?.confirmed||!Number.isFinite(at)||at>now||now-at>86400000||!Array.isArray(tx.vin)||tx.vin.some(x=>x.is_coinbase)||!Array.isArray(tx.vout))return [];
  const values=tx.vout.map(x=>x.value).filter(x=>Number.isSafeInteger(x)&&x>=0);
  if(values.length!==tx.vout.length)return [];
  const largest=Math.max(0,...values);
  if(largest<100*1e8||largest>21000000*1e8)return [];
  seen.add(tx.txid);
  return [{id:tx.txid,nome:'Transferência confirmada · Bitcoin',simbolo:'BTC',quantidade:largest/1e8,data:new Date(at).toISOString(),url:'https://mempool.space/tx/'+tx.txid}];
 }).sort((a,b)=>b.quantidade-a.quantidade).slice(0,10);
}
export function createWhaleService({fetchImpl=fetch,now=Date.now}={}){
 let cached=null,nextAt=0,inFlight=null;
 return async function whales(){
  if(cached&&now()<nextAt)return structuredClone(cached);
  if(inFlight)return structuredClone(await inFlight);
  inFlight=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{
    const read=async path=>{const r=await fetchImpl(API+path,{signal:controller.signal,cache:'no-store',redirect:'error'});if(!r.ok)throw Error('PROVIDER_UNAVAILABLE');return r.json();};
    const blocks=await read('/v1/blocks'),block=blocks?.[0];
    if(!HASH.test(block?.id||'')||!Number.isSafeInteger(block?.tx_count)||block.tx_count<1||!Number.isFinite(block.timestamp)||now()-block.timestamp*1000>86400000||block.timestamp*1000>now())throw Error('INVALID_BLOCK');
    const offsets=block.tx_count>25?[0,25]:[0];
    const results=await Promise.allSettled(offsets.map(offset=>read('/block/'+block.id+'/txs/'+offset)));
    const pages=results.filter(x=>x.status==='fulfilled'&&Array.isArray(x.value)).map(x=>x.value);
    if(!pages.length)throw Error('INVALID_TRANSACTIONS');
    const sample=pages.flat();
    cached={rows:normalizeWhaleTransfers(sample,now()),status:{disponivel:true,parcial:pages.length<offsets.length,atualizadoEm:new Date(now()).toISOString(),fonte:'mempool.space',cobertura:'Bitcoin · amostra de até 50 transações do bloco mais recente',amostra:sample.length,bloco:block.height,mensagem:null}};
    nextAt=now()+180000;
   }catch{
    const recent=cached?.status?.atualizadoEm&&now()-Date.parse(cached.status.atualizadoEm)<1800000;
    cached=recent?{...cached,status:{...cached.status,disponivel:false,stale:true,mensagem:'A atualização não respondeu. Exibindo a última leitura válida.'}}:{rows:[],status:{disponivel:false,mensagem:'Transferências indisponíveis nesta atualização. Tente novamente em instantes.'}};nextAt=now()+60000;
   }finally{clearTimeout(timer);}
   return cached;
  })();
  try{return structuredClone(await inFlight);}finally{inFlight=null;}
 };
}
export const getWhaleTransfers=createWhaleService();
