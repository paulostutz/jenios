import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
for(const path of ['/api/jenios-pay/admin','/api/jenios-pay/orders','/api/specialists/orders','/api/social/campaigns','/api/social/profiles']){
  const response=await fetch(base+path);assert.equal(response.status,401);console.log('PASS unauthorized '+path);
}
for(const path of ['/api/jenios-pay/checkout','/api/platform/checkout','/api/jenios-pay/access','/api/crypto-validator/detailed','/api/social/promotions','/api/social/promotions/events']){
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(response.status,401);console.log('PASS unauthorized '+path);
}
for(const [scope,prices] of [['social',[990,990,0,0]],['platform',[9990,14990,19990]]]){
  const response=await fetch(base+'/api/jenios-pay/products?scope='+scope);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.products.map(p=>p.price_cents),prices);console.log('PASS catalog '+scope);
}
for(const path of ['/admin/cobrancas','/checkout','/impulsionar','/social/cobrancas','/social/consulta-detalhada','/especialistas/atendimentos','/impulsionar/campanhas','/social/perfil/11111111-1111-4111-8111-111111111111']){
  const response=await fetch(base+path);assert.equal(response.status,200);console.log('PASS page HTTP '+path);
}
const plans=await fetch(base+'/planos',{redirect:'manual'});assert.equal(plans.status,307);const redirectBody=await plans.text();assert.ok(plans.headers.get('location')==='/checkout'||redirectBody.includes('NEXT_REDIRECT;replace;/checkout;307;'),'Next.js header or streamed redirect');console.log('PASS legacy plans redirect');
for(const path of ['/api/social/posts','/api/social/comments','/api/social/likes','/api/specialists?own=1']){const response=await fetch(base+path);assert.equal(response.status,401);console.log('PASS unauthorized '+path)}
for(const [path,method]of [['/api/social/media','POST'],['/api/social/media','PUT'],['/api/specialists','PUT'],['/api/specialists/orders','PATCH'],['/api/social/campaigns','PATCH']]){const response=await fetch(base+path,{method,headers:{'content-type':'application/json'},body:'{}'});assert.equal(response.status,401);console.log('PASS unauthorized '+method+' '+path)}
for(const path of ['/api/crypto-validator','/api/crypto-validator/pdf']){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'not-a-chain',type:'token',identifier:'invalid'})});assert.equal(response.status,400);console.log('PASS invalid query '+path)}
