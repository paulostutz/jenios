/** B300 independent GET-only verification of an EXISTING B293 isolated Vercel Preview.
 * No cookies, tokens, POSTs, database mutations, payments or broker requests.
 * Preview is older B293: this cannot certify B298/B299 code or logged-in sessions.
 */
export const B300_PINNED_PREVIEW='https://jenios-ecossistem-9dgnjtals-jenios.vercel.app';
export const B300_PREVIEW_SHA='b44d43a4fa6ff6249d61bf8b257b1a64105be33d';
const error=code=>Object.assign(new Error(code),{code});
const PUBLIC_PAGES=Object.freeze([
 '/','/lp','/login','/social','/platform/entrar','/platform/recuperar',
 '/platform/redefinir','/platform/assistente','/universidade','/checkout'
]);
const AUTH_REQUIRED=Object.freeze([
 '/api/platform/learning','/api/assistant/pro/access',
 '/api/platform/admin/access','/api/admin/inter/setup'
]);
const EXPECTED_PRICE=Object.freeze({
 'platform-nacional':9990,
 'platform-global-crypto':14990,
 'platform-internacional-pro':19990
});
export function assertB300PinnedPreview(value=B300_PINNED_PREVIEW){
 if(value!==B300_PINNED_PREVIEW)throw error('B300_UNAPPROVED_HOSTED_PREVIEW');
 let u;try{u=new URL(value);}catch{throw error('B300_INVALID_PREVIEW_URL');}
 if(u.protocol!=='https:'||u.origin!==value||u.pathname!=='/'&&u.pathname!==''||
   u.port||u.username||u.password||u.search||u.hash)
  throw error('B300_UNAPPROVED_HOSTED_PREVIEW');
 return u.origin;
}
async function safeSmallJson(response){
 const contentType=response.headers?.get('content-type')||'';
 if(!/^application\/json(?:\s*;|$)/i.test(contentType))
  throw error('B300_UNEXPECTED_JSON_CONTENT_TYPE');
 if(!response.body?.getReader)throw error('B300_JSON_STREAM_REQUIRED');
 const chunks=[];let length=0;const reader=response.body.getReader();
 try{
  while(true){
   const next=await reader.read();
   if(next.done)break;
   length+=next.value.byteLength;
   if(length>65536)throw error('B300_RESPONSE_TOO_LARGE');
   chunks.push(next.value);
  }
 }finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8'));}
 catch{throw error('B300_INVALID_JSON');}
}
export function inspectB300PlatformCatalog(payload){
 if(!payload||payload.checkoutScope!=='platform'||payload.paymentsEnabled!==false||
    payload.checkoutReady!==false||!Array.isArray(payload.products)||
    payload.products.length!==3)
  throw error('B300_PLATFORM_CATALOG_UNSAFE');
 const seen=new Set();
 for(const item of payload.products){
  if(!item||!Object.hasOwn(EXPECTED_PRICE,item.code)||seen.has(item.code)||
    item.price_cents!==EXPECTED_PRICE[item.code]||item.category!=='platform'||
    item.active!==false||item.billing_type!=='monthly'||item.currency!=='BRL')
   throw error('B300_PLATFORM_CATALOG_UNSAFE');
  seen.add(item.code);
 }
 if(payload.catalogStatus==='defaults'&&payload.products.some(x=>x.configured!==false))
  throw error('B300_FALLBACK_CANNOT_BE_CONFIGURED');
 return Object.freeze({
  rows:seen.size,fallbackReported:payload.catalogStatus==='defaults',
  persistedRowsClaimed:payload.products.every(x=>x.configured===true)&&payload.catalogStatus!=='defaults',
  independentDatabaseProven:false,checkoutReady:false,paymentsEnabled:false
 });
}
export function inspectB300SocialCatalog(payload){
 if(!payload||payload.checkoutScope!=='social'||payload.paymentsEnabled!==false||
    payload.checkoutReady!==false||!Array.isArray(payload.products))
  throw error('B300_SOCIAL_CATALOG_UNSAFE');
 const university=payload.products.find(x=>x.code==='social-university-monthly');
 if(!university||university.active!==false||university.price_cents!==4990||
    university.billing_type!=='monthly')
  throw error('B300_UNIVERSITY_QA_PRODUCT_UNSAFE');
 return Object.freeze({universityMonthlyInactive:true,
  universityPriceCents:4990,independentDatabaseProven:false});
}
export async function probeB300HostedPreview({fetcher=fetch,origin=B300_PINNED_PREVIEW,timeoutMs=15000}={}){
 assertB300PinnedPreview(origin);
 if(typeof fetcher!=='function'||!Number.isSafeInteger(timeoutMs)||
   timeoutMs<1000||timeoutMs>20000)throw error('B300_UNSAFE_PROBE_DEPENDENCIES');
 const observed=[];
 async function get(path,expected){
  const uri=new URL(path,origin);
  if(uri.origin!==origin||uri.protocol!=='https:')throw error('B300_CROSS_ORIGIN_DENIED');
  let response;
  try{
   response=await fetcher(uri.toString(),{
    method:'GET',redirect:'manual',cache:'no-store',credentials:'omit',
    headers:{accept:path.startsWith('/api/')?'application/json':'text/html'},
    signal:AbortSignal.timeout(timeoutMs)
   });
  }catch{throw error('B300_HOSTED_NETWORK_UNREACHABLE');}
  if(!response||!Number.isInteger(response.status))
   throw error('B300_HOSTED_INVALID_RESPONSE');
  observed.push({path,status:response.status,expected});
  if(response.status!==expected){
   try{await response.body?.cancel?.();}catch{}
   if([401,403,307,308].includes(response.status)&&expected===200)
    throw error('B300_HOSTED_ACCESS_PROTECTED_OR_REDIRECTED');
   if(expected===401&&response.status===200)
    throw error('B300_PRIVATE_API_EXPOSED');
   throw error('B300_HOSTED_HTTP_UNEXPECTED');
  }
  return response;
 }
 for(const path of PUBLIC_PAGES){
  const r=await get(path,200);
  try{await r.body?.cancel?.();}catch{}
 }
 for(const path of AUTH_REQUIRED){
  const r=await get(path,401);
  try{await r.body?.cancel?.();}catch{}
 }
 const free=await safeSmallJson(await get('/api/assistant/free',200));
 if(free?.ok!==true||free.free!==true||free.paidAi!==false||
    !Array.isArray(free.personas)||!free.personas.includes('genio')||
    !free.personas.includes('genia'))
  throw error('B300_FREE_ASSISTANT_UNSAFE');
 const platform=inspectB300PlatformCatalog(await safeSmallJson(
  await get('/api/jenios-pay/products?scope=platform',200)));
 const social=inspectB300SocialCatalog(await safeSmallJson(
  await get('/api/jenios-pay/products?scope=social',200)));
 return Object.freeze({
  schema:'JENIOS_B300_HOSTED_READONLY_ACCEPTANCE_V1',
  previewOrigin:origin,previewSourceCommit:B300_PREVIEW_SHA,
  observedGetRequests:observed.length,allExpectedStatusesObserved:true,
  hostedAnonymousBoundaryCertified:true,anonymousApiAuthorizationsGranted:0,
  platformCatalog:platform,socialCatalog:social,
  authenticatedUserSessionsCertified:false,integratedB298B299HostedCertified:false,
  bankTransfersMade:0,ordersSent:0,paperOrdersSent:0,paidModelInvocations:0,
  commercialReleaseAuthorized:false
 });
}
