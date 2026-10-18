/** Public handle contract; availability is not a reservation. No user data is returned. */
export const HANDLE_MIN = 3, HANDLE_MAX = 30;
export const RESERVED_HANDLES = Object.freeze(['admin','administrador','api','cadastro','configuracoes','jenios','login','social','suporte','support']);
export function normalizeHandle(value) {
  return typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
}
export function validateHandle(value) {
  const handle = normalizeHandle(value);
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) return {ok:false,handle,error:'Use de 3 a 30 letras, números ou sublinhado (_).'};
  if (RESERVED_HANDLES.includes(handle)) return {ok:false,handle,error:'Este @ é reservado. Escolha outro identificador.'};
  return {ok:true,handle};
}
export function parseAvailability(payload, requested) {
  const handle = normalizeHandle(requested);
  if (!payload || payload.handle !== handle || typeof payload.available !== 'boolean' || !Array.isArray(payload.suggestions)) throw new Error('Não foi possível verificar este @. Tente novamente.');
  const suggestions = [...new Set(payload.suggestions)].filter(x => typeof x==='string' && x===normalizeHandle(x) && validateHandle(x).ok && x!==handle).slice(0,4);
  return {handle,available:payload.available,suggestions};
}
export async function checkHandleAvailability(raw, {fetcher=globalThis.fetch,signal}={}) {
  const result=validateHandle(raw); if(!result.ok)throw new Error(result.error);
  const response=await fetcher('/api/social/handles?handle='+encodeURIComponent(result.handle), {cache:'no-store',signal,credentials:'same-origin'});
  let payload;try{payload=await response.json();}catch{throw new Error('Não foi possível verificar este @. Tente novamente.');}
  if(!response.ok)throw new Error(payload.error||'A verificação de @ está indisponível. Tente novamente.');
  return parseAvailability(payload,result.handle);
}
/** Old network responses can never restore availability for a different input. */
export function createLatestHandleLookup(lookup=checkHandleAvailability) {
  let epoch=0,controller=null;
  return {
    cancel(){epoch++;controller?.abort();controller=null;},
    async check(value,notify){
      const version=++epoch;controller?.abort();controller=new AbortController();
      try{const result=await lookup(value,{signal:controller.signal});if(version===epoch)notify({status:'ready',...result});}
      catch(error){if(version===epoch && error.name!=='AbortError')notify({status:'error',error:error.message});}
    }
  };
}
