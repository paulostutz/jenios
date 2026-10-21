/** B291 localhost acceptance: public journeys, auth rejection and disabled checkout.
 * Runs only on localhost. No Supabase accounts, external AI or bank credentials.
 */
import assert from 'node:assert/strict';
const base=new URL(process.env.JENIOS_B291_LOCAL_URL||'http://127.0.0.1:3127');
assert.equal(base.protocol,'http:');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
let checked=0;
const pass=name=>{checked++;console.log('B291_LOCAL_QA_PASS '+name);};
async function get(path){
 const res=await fetch(new URL(path,base),{method:'GET',redirect:'follow',
  signal:AbortSignal.timeout(15000)});
 return {res,text:await res.text()};
}
for(const route of ['/','/lp','/social','/checkout','/universidade',
 '/login','/platform/entrar','/platform/redefinir','/platform/assistente']){
 const {res,text}=await get(route);
 assert.equal(res.status,200,route+' must exist');
 assert.ok(text.includes('<html')&&text.length>1200,'empty SSR page '+route);
 assert.ok(!text.includes('sb_secret_')&&!text.includes('INTER_CLIENT_SECRET'),
  'server-only secret identifier exposed in HTML '+route);
 pass(route+' public SSR 200');
}
for(const route of ['/api/platform/learning','/api/assistant/pro/access',
 '/api/platform/admin/access','/api/admin/inter/setup']){
 const {res}=await get(route);
 assert.equal(res.status,401,'must reject unauthenticated '+route);
 pass(route+' denies anonymous');
}
const publicApi=await get('/api/assistant/free');
assert.equal(publicApi.res.status,200);
const pub=JSON.parse(publicApi.text);
assert.equal(pub.ok,true);
assert.equal(pub.paidAi,false);
assert.deepEqual(pub.personas,['genio','genia']);
pass('public Gênio/Gênia config available without login');

const sell=await fetch(new URL('/api/assistant/free',base),{
 method:'POST',redirect:'error',cache:'no-store',
 headers:{'content-type':'application/json',origin:base.origin},
 body:JSON.stringify({persona:'genia',message:'Quero conhecer o plano de R$ 149,90'}),
 signal:AbortSignal.timeout(15000)
});
assert.equal(sell.status,200,'public guided sales QA response');
const offer=await sell.json();
assert.equal(offer.ok,true);assert.equal(offer.persona,'genia');
assert.equal(offer.paidAi,false);assert.equal(offer.modelCalls,0);
assert.equal(offer.executionEnabled,false);assert.equal(offer.subscriptionGranted,false);
assert.ok(offer.explanation.includes('R$ 149,90'));
assert.ok(offer.links.some(x=>x.href==='/checkout'));
pass('sales chat fallback without model billing, execution or subscription');

const cross=await fetch(new URL('/api/assistant/free',base),{
 method:'POST',redirect:'error',headers:{'content-type':'application/json',origin:'https://untrusted.invalid'},
 body:JSON.stringify({persona:'genio',message:'Quero conhecer a plataforma'}),
 signal:AbortSignal.timeout(10000)
});
assert.equal(cross.status,403,'cross-site solicitation must fail');
pass('cross-origin sales request blocked');

const plans=await get('/api/jenios-pay/products?scope=platform');
assert.equal(plans.res.status,200);
const products=JSON.parse(plans.text);
assert.equal(products.checkoutScope,'platform');
assert.equal(products.paymentsEnabled,false);
assert.equal(products.checkoutReady,false);
const codes=products.products.map(p=>p.code);
assert.ok(['platform-nacional','platform-global-crypto','platform-internacional-pro'].every(c=>codes.includes(c)));
pass('monthly checkout remains disabled pending bank and subscriptions');
const legacy=await get('/planos');
assert.equal(legacy.res.status,200);
assert.equal(new URL(legacy.res.url).pathname,'/checkout');
assert.ok(!legacy.text.includes('000201010211'));
pass('legacy static Pix redirect controlled');
console.log('B291_LOCAL_QA_TOTAL='+checked+'; no external money or user accounts');
