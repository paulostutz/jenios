/** B293 isolated localhost-only unauthenticated acceptance.
 * No PUT/POST/DELETE, no bank calls, no auth user creation, no real orders.
 */
import assert from 'node:assert/strict';
const origin=new URL(process.env.JENIOS_B293_BASE_URL||'http://127.0.0.1:3127');
assert.equal(origin.protocol,'http:');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
const safe=pathname=>{
 const target=new URL(pathname,origin);
 assert.equal(target.origin,origin.origin);
 return target;
};
let count=0;
async function get(path,expected){
 const response=await fetch(safe(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,expected,'B293 HTTP '+path);
 count++;
 console.log('PASS B293_HTTP '+response.status+' '+path);
 return response;
}
for(const path of ['/', '/lp', '/login','/social','/platform/entrar',
 '/platform/recuperar','/platform/redefinir','/platform/assistente',
 '/universidade','/checkout']){
 await get(path,200);
}
for(const path of ['/api/platform/learning','/api/assistant/pro/access',
 '/api/platform/admin/access','/api/admin/inter/setup']){
 const resp=await get(path,401);
 const data=await resp.json();
 assert.ok(data?.error||data?.code||data?.message);
 count++;
}
const free=await (await get('/api/assistant/free',200)).json();
assert.equal(free.free,true);
assert.equal(free.paidAi,false);
count++;
const catalog=await (await get('/api/jenios-pay/products?scope=platform',200)).json();
assert.equal(catalog.checkoutScope,'platform');
assert.equal(catalog.paymentsEnabled,false);
assert.equal(catalog.checkoutReady,false);
assert.ok(Array.isArray(catalog.products)&&catalog.products.length===3);
assert.ok(catalog.products.every(p=>p.category==='platform'));
assert.ok(catalog.products.every(p=>p.configured===true||p.active===false));
if(catalog.catalogStatus==='defaults')assert.ok(catalog.products.every(p=>p.active===false));
count++;
console.log('B293_QA_NEGATIVE_RUNTIME_PASS='+count);
