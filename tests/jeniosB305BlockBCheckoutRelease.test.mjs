/** R37: real HTTP handler bodies with explicit local dependencies.
 * Next.js import wiring is checked separately by the production build.
 * No Auth, database, bank, provider or mail network request is performed here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {checkoutReleaseState,assertCheckoutRelease,checkoutCatalogReadiness,readCheckoutBody} from '../lib/pay/checkout-release.mjs';

const URL='https://qa.invalid';
const enabled={JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_PLATFORM_SUBSCRIPTION_LIFECYCLE_CERTIFIED:'true'};
const provider={url:'https://payments.invalid/checkout',token:'fixture-not-a-real-token'};
const product={id:'fixture-product',code:'platform-nacional',category:'platform',active:true,price_cents:9990,currency:'BRL',billing_type:'monthly'};
const request=(body={productCode:'platform-nacional'},headers={})=>new Request(URL+'/api/platform/checkout',{
 method:'POST',headers:{'content-type':'application/json','authorization':'Bearer fixture-user','idempotency-key':'fixture-order-key-0001',...headers},
 body:typeof body==='string'?body:JSON.stringify(body)
});
function handler(path,deps){
 const base=process.env.R37_BASELINE==='1'?resolve('..','before'):process.cwd();
 const source=readFileSync(resolve(base,path),'utf8')
  .replace(/^import[^\n]+\n/gm,'')
  .replace(/^export const /gm,'const ')
  .replace(/^export async function /gm,'async function ');
 return new Function(...Object.keys(deps),source+'\nreturn typeof POST==="function"?POST:GET;')(...Object.values(deps));
}
function fixture({env=enabled,authError=null,guest=false,free=false,catalogError=false,gatewayError=false}={}){
 const calls={db:0,auth:0,checkout:0,gateway:0,args:null};
 const db={from(){const q={select(){return q;},order(){return q;},async limit(){return {data:[product],error:catalogError?Error('fixture-db-failure'):null};}};return q;}};
 const deps={
  process:{env},Response,NextResponse:Response,
  assertCheckoutRelease,readCheckoutBody,checkoutCatalogReadiness,
  getJeniosPayAdmin(){calls.db++;return db;},
  requirePayToken(req){if(!req.headers.get('authorization')?.startsWith('Bearer '))throw Object.assign(Error('Entre na conta.'),{status:401});},
  async requirePayUser(){calls.auth++;if(authError)throw Object.assign(Error('Sessão inválida.'),{status:401});return {id:'user-a'};},
  async requireReportBuyer(){calls.auth++;if(authError)throw Object.assign(Error('Sessão inválida.'),{status:401});return guest?{id:null,guestHash:'guest-a'}:{id:'user-a'};},
  guestEnabled(){return false;},
  async checkoutService(args){calls.checkout++;calls.args=args;return {orderId:'fixture-order',status:'awaiting_payment'};},
  isPrelaunchReport(){return free;},prelaunchReportHref(){return '/social/relatorio';},
  mergeCatalog(rows){return rows||[{...product,id:undefined}];},productScope(p){return p.category==='platform'?'platform':'social';},withBankscoreAvailability:p=>p,
  gatewayConfig(){calls.gateway++;if(gatewayError)throw Error('invalid gateway fixture');return provider;}
 };
 return {deps,calls};
}

test('R37 missing or noncanonical flags never permit charging',()=>{
 for(const value of [undefined,'false','TRUE',true,1,'1',' true ']){
  const env={JENIOS_PAY_PAYMENTS_ENABLED:value,JENIOS_PLATFORM_SUBSCRIPTION_LIFECYCLE_CERTIFIED:'true'};
  assert.equal(checkoutReleaseState('platform',env).releaseAllowed,false);
  assert.throws(()=>assertCheckoutRelease('platform',env),{code:'PAYMENTS_DISABLED',status:503});
 }
});
test('R37 lifecycle certification is separate from credentials and payment gate',()=>{
 assert.equal(checkoutReleaseState('platform',{JENIOS_PAY_PAYMENTS_ENABLED:'true'}).releaseAllowed,false);
 assert.equal(checkoutReleaseState('social',{JENIOS_PAY_PAYMENTS_ENABLED:'true'}).releaseAllowed,true);
 assert.equal(checkoutReleaseState('platform',enabled).releaseAllowed,true);
 assert.throws(()=>assertCheckoutRelease('platform',{JENIOS_PAY_PAYMENTS_ENABLED:'true'}),{status:503,code:'SUBSCRIPTION_LIFECYCLE_NOT_CERTIFIED'});
 assert.throws(()=>assertCheckoutRelease('unknown',enabled),{status:400,code:'CHECKOUT_SCOPE_INVALID'});
});
test('R37 catalogue readiness is boolean-only and keeps unsupported Inter subscriptions closed',()=>{
 assert.equal(checkoutCatalogReadiness('platform',{env:enabled,gateway:provider}).checkoutReady,true);
 assert.equal(checkoutCatalogReadiness('platform',{env:enabled,gateway:{provider:'inter_pix'}}).checkoutReady,false);
 assert.equal(checkoutCatalogReadiness('social',{env:enabled,gateway:{provider:'inter_pix'}}).checkoutReady,true);
 assert.equal(checkoutCatalogReadiness('platform',{env:enabled,gateway:null}).checkoutReady,false);
 assert.doesNotMatch(JSON.stringify(checkoutCatalogReadiness('platform',{env:enabled,gateway:provider})),/fixture-not-a-real-token|payments.invalid/);
});
test('R37 platform disabled gate blocks before database or checkout',async()=>{
 const {deps,calls}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'false'}});
 const r=await handler('app/api/platform/checkout/route.js',deps)(request());
 assert.equal(r.status,503);assert.equal(calls.db,0);assert.equal(calls.checkout,0);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('R37 platform missing lifecycle certification blocks before database or checkout',async()=>{
 const {deps,calls}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'true'}});
 const r=await handler('app/api/platform/checkout/route.js',deps)(request());
 assert.equal(r.status,503);assert.equal(calls.db,0);assert.equal(calls.checkout,0);
});
test('R37 platform no token returns 401 without touching database',async()=>{
 const {deps,calls}=fixture();const r=await handler('app/api/platform/checkout/route.js',deps)(request(undefined,{authorization:''}));
 assert.equal(r.status,401);assert.equal(calls.db,0);assert.equal(calls.checkout,0);
});
test('R37 platform invalid session cannot reach checkout',async()=>{
 const {deps,calls}=fixture({authError:true});const r=await handler('app/api/platform/checkout/route.js',deps)(request());
 assert.equal(r.status,401);assert.equal(calls.checkout,0);
});
test('R37 platform authenticated fixture preserves server identity and request idempotency key',async()=>{
 const {deps,calls}=fixture();
 const r=await handler('app/api/platform/checkout/route.js',deps)(request({productCode:'platform-nacional',user_id:'user-b',amount_cents:1}));
 assert.equal(r.status,200);assert.equal(calls.checkout,1);assert.equal(calls.args.user.id,'user-a');
 assert.equal(calls.args.scope,'platform');assert.equal(calls.args.key,'fixture-order-key-0001');
});
test('R37 platform malformed JSON returns 400 and never reaches checkout',async()=>{
 const {deps,calls}=fixture();const r=await handler('app/api/platform/checkout/route.js',deps)(request('{'));
 assert.equal(r.status,400);assert.equal(calls.checkout,0);
});
test('R37 social disabled gate blocks before database or checkout',async()=>{
 const {deps,calls}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'false'}});
 const r=await handler('app/api/jenios-pay/checkout/route.js',deps)(request({productCode:'social-specialist-offer'}));
 assert.equal(r.status,503);assert.equal(calls.db,0);assert.equal(calls.checkout,0);
});
test('R37 prelaunch reports remain free and never enter paid checkout',async()=>{
 const {deps,calls}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'false'},free:true});
 const r=await handler('app/api/jenios-pay/checkout/route.js',deps)(request({productCode:'social-bankscore-report'}));
 assert.equal(r.status,409);assert.equal((await r.json()).reportUrl,'/social/relatorio');assert.equal(calls.db,0);assert.equal(calls.checkout,0);
});
test('R37 guest policy is preserved after the operational gate',async()=>{
 const {deps,calls}=fixture({guest:true});const r=await handler('app/api/jenios-pay/checkout/route.js',deps)(request({productCode:'social-specialist-offer'}));
 assert.equal(r.status,503);assert.equal(calls.checkout,0);
});
test('R37 valid social fixture does not require Platform lifecycle certification',async()=>{
 const {deps,calls}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'true'}});const r=await handler('app/api/jenios-pay/checkout/route.js',deps)(request({productCode:'social-specialist-offer'}));
 assert.equal(r.status,200);assert.equal(calls.args.scope,'social');
});
test('R37 catalog disabled gate remains false even with configured gateway',async()=>{
 const {deps}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'false'}});
 const r=await handler('app/api/jenios-pay/products/route.js',deps)(new Request(URL+'/api/jenios-pay/products?scope=platform'));
 const data=await r.json();assert.equal(data.paymentsEnabled,false);assert.equal(data.checkoutReady,false);assert.equal(data.products[0].configured,true);
});
test('R37 catalog missing lifecycle certification does not advertise ready subscriptions',async()=>{
 const {deps}=fixture({env:{JENIOS_PAY_PAYMENTS_ENABLED:'true'}});
 const data=await (await handler('app/api/jenios-pay/products/route.js',deps)(new Request(URL+'?scope=platform'))).json();
 assert.equal(data.paymentsEnabled,true);assert.equal(data.checkoutReady,false);assert.equal(data.subscriptionLifecycleReady,false);
});
test('R37 catalog configured fixture presents consistent explicit certification',async()=>{
 const {deps,calls}=fixture();const data=await (await handler('app/api/jenios-pay/products/route.js',deps)(new Request(URL+'?scope=platform'))).json();
 assert.equal(data.checkoutReady,true);assert.equal(data.subscriptionLifecycleReady,true);assert.equal(calls.gateway,1);
});
test('R37 gateway configuration error does not discard the database catalog',async()=>{
 const {deps}=fixture({gatewayError:true});const data=await (await handler('app/api/jenios-pay/products/route.js',deps)(new Request(URL+'?scope=platform'))).json();
 assert.equal(data.checkoutReady,false);assert.equal(data.products[0].configured,true);assert.notEqual(data.catalogStatus,'defaults');
});
test('R37 database catalog failure remains a nonchargeable fallback',async()=>{
 const {deps}=fixture({catalogError:true});const data=await (await handler('app/api/jenios-pay/products/route.js',deps)(new Request(URL+'?scope=platform'))).json();
 assert.equal(data.checkoutReady,false);assert.equal(data.subscriptionLifecycleReady,false);assert.equal(data.products[0].configured,false);
});
test('R37 body validation rejects arrays, null, bad products and invalid targets',async()=>{
 for(const body of [null,[],{}, {productCode:7},{productCode:'x'.repeat(101)},{productCode:'valid',target:[]},{productCode:'valid',target:null}])
  await assert.rejects(()=>readCheckoutBody(request(body)),{status:400});
});
test('R37 non-JSON and oversized declared body cannot be processed',async()=>{
 await assert.rejects(()=>readCheckoutBody(request(undefined,{'content-type':'text/plain'})),{status:415});
 await assert.rejects(()=>readCheckoutBody(request(undefined,{'content-length':'8193'})),{status:413});
});
test('R37 streaming size limit works without content-length',async()=>{
 await assert.rejects(()=>readCheckoutBody(request({productCode:'valid',target:{note:'x'.repeat(9000)}})),{status:400});
});
test('R37 malformed UTF-8 is rejected before checkout',async()=>{
 const req=new Request(URL,{method:'POST',headers:{'content-type':'application/json'},body:new Uint8Array([123,34,255,34,58,49,125])});
 await assert.rejects(()=>readCheckoutBody(req),{status:400});
});
