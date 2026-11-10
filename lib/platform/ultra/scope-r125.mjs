import {rankUltraCandidates} from './selection.mjs';
import {normalizeUltraConfig} from './policy-r125.mjs';
/** New Ultra scope, not a symbol generator or broker eligibility claim. R53/R18
 * ranking and sizing stay unchanged. Callers still owe native evidence. */
export function ultraInstrumentScopeR125(observation,now){
 const i=observation?.instrument;
 if(!i||i.evidence!=='broker_metadata'||i.symbol!==observation.symbol||!Number.isSafeInteger(now)||!Number.isSafeInteger(i.observedAtMs)||i.observedAtMs>now||now-i.observedAtMs>5000)return {allowed:false,reason:'NATIVE_INSTRUMENT_EVIDENCE_REQUIRED'};
 if(observation.market==='b3'){
  const actual=/^(WIN|WDO)[FGHJKMNQUVXZ][0-9]{2}$/.exec(observation.symbol??'');
  if(!actual||i.venue!=='B3'||i.kind!=='future'||i.family!==(actual[1]==='WIN'?'mini_index':'mini_usd')||!Number.isSafeInteger(i.expiryMs)||i.expiryMs<=now)return {allowed:false,reason:'ONLY_ACTUAL_MINI_INDEX_OR_MINI_USD_CONTRACT'};
  return {allowed:true,family:i.family,executionAuthorized:false};
 }
 if(observation.market==='crypto'&&['spot','future'].includes(i.kind)){const e=i.eligibility,product=i.kind==='spot'?'spot':'usds_m_futures';if(i.venue!=='binance'||!e||e.product!==product||e.status!=='eligible'||! /^[a-f0-9]{64}$/.test(e.accountFingerprint)||!Number.isSafeInteger(e.observedAtMs)||e.observedAtMs>now||now-e.observedAtMs>5000)return {allowed:false,reason:'BINANCE_PRODUCT_ACCOUNT_ELIGIBILITY_REQUIRED'};return {allowed:true,family:i.kind==='spot'?'crypto_spot':'crypto_futures',executionAuthorized:false};}
 return {allowed:false,reason:'OUTSIDE_CURRENT_ULTRA_SCOPE'};
}
export function rankUltraCandidatesR125(config,observations,now){
 const scoped=normalizeUltraConfig(config);if(!Array.isArray(observations)||observations.length>1000||!Number.isSafeInteger(now)||observations.some(o=>!o||typeof o!=='object'||Array.isArray(o)))throw Error('INVALID_OBSERVATIONS');
 const accepted=observations.filter(o=>{const market=scoped.markets.find(m=>m.id===o.market);return market&&!(o.market==='crypto'&&market.provider!=='binance')&&ultraInstrumentScopeR125(o,now).allowed;});
 return rankUltraCandidates({...scoped,markets:scoped.markets.map(({provider,...m})=>m)},accepted,now);
}
