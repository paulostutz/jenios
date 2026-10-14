import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
for(const path of ['/api/jenios-pay/admin','/api/jenios-pay/orders']){
  const response=await fetch(base+path);assert.equal(response.status,401);console.log('PASS unauthorized '+path);
}
for(const path of ['/api/jenios-pay/checkout','/api/platform/checkout']){
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(response.status,401);console.log('PASS unauthorized '+path);
}
for(const [scope,prices] of [['social',[990,990,0]],['platform',[9990,14990,19990]]]){
  const response=await fetch(base+'/api/jenios-pay/products?scope='+scope);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.products.map(p=>p.price_cents),prices);console.log('PASS catalog '+scope);
}
for(const path of ['/admin/cobrancas','/checkout','/impulsionar','/social/cobrancas']){
  const response=await fetch(base+path);assert.equal(response.status,200);console.log('PASS page HTTP '+path);
}
const plans=await fetch(base+'/planos',{redirect:'manual'});assert.equal(plans.status,307);const redirectBody=await plans.text();assert.ok(plans.headers.get('location')==='/checkout'||redirectBody.includes('NEXT_REDIRECT;replace;/checkout;307;'),'Next.js header or streamed redirect');console.log('PASS legacy plans redirect');
