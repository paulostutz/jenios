/**
 * Diário compartilhado exclusivamente por sessão de simulação.
 * Entradas são dados controlados pelo navegador e NUNCA evidência de execução.
 */
export const SIM_JOURNAL_VERSION=1;
const MAX_ENTRIES=40;
const prefix='jenios_platform_sim_journal_v1:';

export function journalKey(userId){
 const id=typeof userId==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(userId)?userId:'guest';
 return prefix+id;
}
function cleanEvent(entry){
 if(!entry||typeof entry!=='object'||entry.source!=='client_simulation'||entry.executed!==false) return null;
 const ativo=String(entry.ativo||'').slice(0,100);
 const direcao=entry.direcao;
 const modo=entry.modo;
 const valor=Number(entry.valor);
 const hora=String(entry.hora||'').slice(0,16);
 const timestamp=Number(entry.timestamp);
 if(!ativo||!['COMPRA','VENDA'].includes(direcao)||!['manual','reversa'].includes(modo)
   ||!Number.isFinite(valor)||valor<=0||valor>100000000
   ||!Number.isSafeInteger(timestamp)||timestamp<0||!hora) return null;
 return {id:String(entry.id||'').slice(0,80),ativo,direcao,modo,valor,capital:valor,
    hora,timestamp,source:'client_simulation',executed:false,verified:false};
}
export function readSimJournal(storage,userId) {
 try {
   if(!storage?.getItem)return [];
   const parsed=JSON.parse(storage.getItem(journalKey(userId))||'null');
   if(parsed?.version!==SIM_JOURNAL_VERSION||!Array.isArray(parsed.events))return [];
   return parsed.events.slice(0,MAX_ENTRIES).map(cleanEvent).filter(Boolean);
 }catch{return [];}
}
export function appendSimIntention(storage,userId,raw,now=new Date()){
 const timestamp=now?.getTime?.();
 if(!Number.isSafeInteger(timestamp)||timestamp<0)return {ok:false,reason:'invalid_clock',events:[]};
 const previous=readSimJournal(storage,userId);
 const direction=String(raw?.direcao||'').toUpperCase();
 const direcao=direction.includes('COMPRA')?'COMPRA':direction.includes('VENDA')?'VENDA':null;
 const item=cleanEvent({
   id:'sim-'+timestamp+'-'+previous.length,
   ativo:raw?.ativo||raw?.asset,
   direcao,modo:raw?.modo,valor:raw?.valor??raw?.capital,
   hora:now.toLocaleTimeString('pt-BR'),
   timestamp,source:'client_simulation',executed:false
 });
 if(!item)return {ok:false,reason:'invalid_intention',events:previous};
 const events=[item,...previous].slice(0,MAX_ENTRIES);
 try {
   storage?.setItem(journalKey(userId),JSON.stringify({version:SIM_JOURNAL_VERSION,events}));
   if(!storage?.setItem)throw Error('unavailable');
   return {ok:true,events};
 }catch{return {ok:false,reason:'storage_unavailable',events:previous};}
}
export function clearSimJournal(storage,userId){
 try {if(!storage?.removeItem)return false;storage.removeItem(journalKey(userId));return true;}catch{return false;}
}
