/** B305-R37 — server-side commercial release boundary.
 * Credential presence is not permission to charge. Missing flags fail closed.
 * This module does not grant a subscription, authenticate a user or contact a provider.
 */
import {readBoundedJson} from '../platform/bounded-response.mjs';

const SCOPES=new Set(['social','platform']);
const error=(message,status,code)=>Object.assign(Error(message),{status,code});
export const CHECKOUT_BODY_LIMIT=8192;

export function checkoutReleaseState(scope,env={}){
 const knownScope=SCOPES.has(scope);
 const paymentsEnabled=knownScope&&env.JENIOS_PAY_PAYMENTS_ENABLED==='true';
 const subscriptionLifecycleReady=scope==='platform'&&
  env.JENIOS_PLATFORM_SUBSCRIPTION_LIFECYCLE_CERTIFIED==='true';
 return Object.freeze({
  paymentsEnabled,
  subscriptionLifecycleReady,
  checkoutScope:knownScope?scope:null,
  releaseAllowed:paymentsEnabled&&(scope==='social'||subscriptionLifecycleReady)
 });
}

export function assertCheckoutRelease(scope,env=process.env){
 const state=checkoutReleaseState(scope,env);
 if(!state.checkoutScope)throw error('Checkout inválido.',400,'CHECKOUT_SCOPE_INVALID');
 if(!state.paymentsEnabled)throw error('Contratação temporariamente indisponível.',503,'PAYMENTS_DISABLED');
 if(!state.releaseAllowed)throw error('A contratação de assinaturas ainda está em homologação.',503,'SUBSCRIPTION_LIFECYCLE_NOT_CERTIFIED');
 return state;
}

/** Public booleans only. Does not expose gateway configuration or secrets. */
export function checkoutCatalogReadiness(scope,{env={},gateway=null}={}){
 const state=checkoutReleaseState(scope,env);
 const configured=Boolean(gateway&&(gateway.provider==='inter_pix'||
  (typeof gateway.url==='string'&&gateway.url&&typeof gateway.token==='string'&&gateway.token)));
 const supported=configured&&(scope==='social'||gateway.provider!=='inter_pix');
 return Object.freeze({
  paymentsEnabled:state.paymentsEnabled&&supported,
  checkoutReady:state.releaseAllowed&&supported,
  checkoutScope:state.checkoutScope,
  subscriptionLifecycleReady:state.subscriptionLifecycleReady
 });
}

export async function readCheckoutBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
  throw error('Use JSON nesta solicitação.',415,'CHECKOUT_CONTENT_TYPE_INVALID');
 const length=request.headers.get('content-length');
 if(length&&/^\d+$/.test(length)&&Number(length)>CHECKOUT_BODY_LIMIT){
  void request.body?.cancel().catch(()=>{});
  throw error('Solicitação acima do limite permitido.',413,'CHECKOUT_BODY_TOO_LARGE');
 }
 let body;
 try{body=await readBoundedJson(request,CHECKOUT_BODY_LIMIT);}
 catch{throw error('Solicitação inválida ou acima do limite permitido.',400,'CHECKOUT_BODY_INVALID');}
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.productCode!=='string'||
  !/^[a-z0-9-]{1,100}$/.test(body.productCode)||
  (body.target!==undefined&&(!body.target||typeof body.target!=='object'||Array.isArray(body.target))))
  throw error('Informe um produto e dados válidos.',400,'CHECKOUT_BODY_INVALID');
 return body;
}
