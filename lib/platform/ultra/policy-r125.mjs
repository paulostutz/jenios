import {ULTRA_MARKETS as previousMarkets,normalizeUltraConfig as normalizePrevious,assessUltraLeverage as assessPrevious,ultraOperationalBlockers} from './policy.mjs';
import {ultraRouteForMarket} from './routes-r125.mjs';
export {ultraOperationalBlockers};
export const ULTRA_MARKETS=Object.freeze(previousMarkets.filter(m=>m.id!=='forex').map(m=>Object.freeze({...m,label:m.id==='b3'?'Mini índice e mini dólar · B3':'Cripto · à vista e futuros',provider:m.id==='b3'?'mt5':'pending'})));
export const ULTRA_PRODUCT_SCOPE=Object.freeze(['mini_index','mini_usd','crypto_spot','crypto_futures']);
/** Preserve historical budgets and risk math. An explicit route is new metadata,
 * not a new strategy, trading permission or replacement for account eligibility. */
export function normalizeUltraConfig(input){
 if(!input||!Array.isArray(input.markets))return normalizePrevious(input);
 for(const m of input.markets){if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['id','capital','leverage','currency','provider'].includes(k)))throw Object.assign(Error('Configuração inválida.'),{status:400});if(Object.hasOwn(m,'provider')){if(typeof m.provider!=='string')throw Object.assign(Error('Conector inválido.'),{status:400});try{ultraRouteForMarket(m.id,m.provider);}catch{throw Object.assign(Error('O conector não atende a este mercado.'),{status:400});}}}
 if(input.markets.some(m=>!['b3','crypto'].includes(m.id)))throw Object.assign(Error('O Ultra atual está limitado a mini índice, mini dólar e cripto.'),{status:400});
 const base=normalizePrevious({...input,markets:input.markets.map(({provider,...m})=>m)});
 return {...base,markets:base.markets.map(m=>{const source=input.markets.find(r=>r.id===m.id);return {...m,provider:ultraRouteForMarket(m.id,source.provider).provider};})};
}
export function assessUltraLeverage(input){
 const config=normalizeUltraConfig(input),previous=assessPrevious({...config,markets:config.markets.map(({provider,...m})=>m)});
 return {...previous,policyVersion:config.markets.some(m=>Object.hasOwn(m,'provider'))?'ultra-r125-routes-1':previous.policyVersion,config,markets:previous.markets.map(m=>{const route=config.markets.find(r=>r.id===m.id);return route.provider?{...m,provider:route.provider}:m;})};
}
export function ultraConnectionReadiness(config){
 // Readiness is informational. Historical configurations must remain readable
 // even when they include markets that cannot be selected for a new session.
 const saved=Array.isArray(config?.markets)?config.markets:[];
 return ULTRA_MARKETS.map(m=>{
  const selected=saved.find(r=>r?.id===m.id);
  const provider=selected?.provider??(selected&&m.id==='b3'?'profit':m.provider);
  let route,reviewRequired=saved.some(r=>!['b3','crypto'].includes(r?.id));
  try{route=ultraRouteForMarket(m.id,provider);}catch{route=ultraRouteForMarket(m.id);reviewRequired=true;}
  return {...m,...route,reviewRequired,connected:false,canStart:false,status:'awaiting_connection'};
 });
}
