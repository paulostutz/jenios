// Confirmed Bitcoin outputs. A transfer does not establish a purchase or institutional ownership.
const API='https://mempool.space/api';
const HASH=/^[0-9a-f]{64}$/;
export const WHALE_CURRENT_MS=15*60000;
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
 }).sort((a,b)=>Date.parse(b.data)-Date.parse(a.data)||b.id.localeCompare(a.id)).slice(0,50);
}
export function validWhaleEvent(row,now=Date.now()){
 return HASH.test(row?.id||'')&&Number.isFinite(row.quantidade)&&row.quantidade>=100&&row.quantidade<=21000000&&Number.isFinite(Date.parse(row.data))&&Date.parse(row.data)<=now;
}
export function mergeWhaleHistory(rows,now=Date.now()){
 return [...new Map(rows.filter(row=>validWhaleEvent(row,now)).map(row=>[row.id,{...row,nome:'Transferência confirmada · Bitcoin',simbolo:'BTC',url:'https://mempool.space/tx/'+row.id}])).values()].sort((a,b)=>Date.parse(b.data)-Date.parse(a.data)||b.id.localeCompare(a.id)).slice(0,50);
}
export function createWhaleService({fetchImpl=fetch,now=Date.now}={}){
 let cached=null,nextAt=0,inFlight=null,known=[];
 return async function whales({history}={}){
  if(cached&&now()<nextAt)return structuredClone(cached);
  if(inFlight)return structuredClone(await inFlight);
  inFlight=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
   let available=false,partial=false,sampleSize=0,blocksChecked=0,message=null;
   try{
    // Store keeps the last observed movements across cold starts and deployments.
    if(history){try{known=mergeWhaleHistory([...known,...await history.read()],now());}catch{}}
    const read=async path=>{const r=await fetchImpl(API+path,{signal:controller.signal,cache:'no-store',redirect:'error'});if(!r.ok)throw Error('PROVIDER_UNAVAILABLE');return r.json();};
    const blocks=await read('/v1/blocks');
    if(!Array.isArray(blocks))throw Error('INVALID_BLOCKS');
    const valid=blocks.filter(block=>HASH.test(block?.id||'')&&Number.isSafeInteger(block.tx_count)&&block.tx_count>0&&Number.isFinite(block.timestamp)&&now()-block.timestamp*1000<=86400000&&block.timestamp*1000<=now()).slice(0,3);
    if(!valid.length)throw Error('INVALID_BLOCKS');
    // Compact summaries cover each block; fetch full transactions only for large candidates.
    // Summary totals alone never qualify a movement: every displayed output is verified below.
    const summaries=await Promise.allSettled(valid.map(async block=>({block,rows:await read('/v1/block/'+block.id+'/summary')})));
    const complete=summaries.filter(result=>result.status==='fulfilled'&&Array.isArray(result.value.rows)).map(result=>result.value);
    if(!complete.length)throw Error('INVALID_BLOCK_SUMMARY');
    const candidates=complete.flatMap(({block,rows})=>rows.filter(row=>HASH.test(row.txid||'')&&Number.isSafeInteger(row.value)&&row.value>=100e8).map(row=>({...row,blockTime:block.timestamp})))
      .sort((a,b)=>b.blockTime-a.blockTime||(b.time||0)-(a.time||0)).slice(0,12);
    const verified=await Promise.allSettled(candidates.map(async row=>{const tx=await read('/tx/'+row.txid);if(tx?.txid!==row.txid)throw Error('TRANSACTION_MISMATCH');return tx;}));
    const transactions=verified.filter(result=>result.status==='fulfilled').map(result=>result.value);
    sampleSize=transactions.length;blocksChecked=complete.length;partial=complete.length<valid.length||transactions.length<candidates.length;
    const found=normalizeWhaleTransfers(transactions,now());known=mergeWhaleHistory([...known,...found],now());
    if(found.length&&history){try{await history.save(found);}catch{}}
    available=true;
   }catch{message='A consulta atual não respondeu.';}
   finally{clearTimeout(timer);}
   const current=available?known.filter(row=>now()-Date.parse(row.data)<=WHALE_CURRENT_MS):[];
   const historical=!current.length&&known.length>0;
   cached={rows:current.length?current.slice(0,10):known.slice(0,3),status:{disponivel:available||historical,stale:!available&&historical,historico:historical,parcial:partial,atualizadoEm:new Date(now()).toISOString(),cobertura:'Bitcoin · até 3 blocos recentes; até 12 transações candidatas conferidas',amostra:sampleSize,blocos:blocksChecked,
    mensagem:historical?(available?'Nenhum movimento atual encontrado na cobertura consultada. Exibindo os três últimos registrados.':'Consulta atual indisponível. Exibindo os três últimos movimentos registrados.'):(message||(!current.length?'Nenhum movimento confirmado nos últimos 15 minutos na cobertura consultada.':null))}};
   nextAt=now()+(available?180000:60000);return cached;
  })();
  try{return structuredClone(await inFlight);}finally{inFlight=null;}
 };
}
export const getWhaleTransfers=createWhaleService();
