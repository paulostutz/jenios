import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRODUCTS, mergeCatalog, moneyToCents, normalizePurchase, priceUpdate } from '../lib/pay/catalog.mjs';
import { isFinanceAdmin, requirePayUser } from '../lib/pay/auth.mjs';
import { createGatewayCheckout, safeCheckoutUrl } from '../lib/pay/gateway.mjs';

test('valores aprovados e planos mensais separados', () => {
  assert.deepEqual(DEFAULT_PRODUCTS.filter(p => p.category === 'platform').map(p => p.price_cents), [9990,14990,19990]);
  assert.equal(DEFAULT_PRODUCTS.find(p => p.code === 'social-bankscore-report').price_cents, 990);
  assert.equal(DEFAULT_PRODUCTS.find(p => p.code === 'social-crypto-validator').price_cents, 990);
});
test('preço salvo no banco prevalece inclusive desativação', () => {
  const p = mergeCatalog([{code:'social-bankscore-report',price_cents:1290,active:false}])[0];
  assert.equal(p.price_cents,1290); assert.equal(p.active,false);
});
test('dinheiro sem erro de ponto flutuante e sem casas escondidas', () => {
  assert.equal(moneyToCents('9,90'),990); assert.equal(moneyToCents('10.01'),1001);
  for (const bad of ['-1','9.999','1e5','NaN','']) assert.throws(()=>moneyToCents(bad));
});
test('edição rejeita plano desconhecido e preço arbitrário para ads', () => {
  assert.throws(()=>priceUpdate({code:'evil',price_cents:990,active:true}));
  assert.throws(()=>priceUpdate({code:'social-boost',price_cents:990,active:true}));
  assert.equal(priceUpdate({code:'social-boost',price_cents:0,active:true}).category,'ads');
});
test('preço do cliente é ignorado na consulta fixa', () => {
  const p=DEFAULT_PRODUCTS[0];
  const quote=normalizePurchase({amount_cents:1,target:{codigo:'C123',periodo:'202606'}},p,'social');
  assert.equal(quote.amount_cents,990);
});
test('checkout rejeita produto da outra área', () => {
  assert.throws(()=>normalizePurchase({target:{}},DEFAULT_PRODUCTS[3],'social'));
  assert.throws(()=>normalizePurchase({target:{codigo:'123'}},DEFAULT_PRODUCTS[0],'platform'));
});
test('ads calcula orçamento diário vezes duração no servidor', () => {
  const quote=normalizePurchase({amount_cents:1,target:{postId:'12345678-1234-1234-1234-123456789abc',dailyBudget:'12.35',days:3,objective:'profile'}},DEFAULT_PRODUCTS[2],'social');
  assert.equal(quote.amount_cents,3705);
});
test('ads rejeita orçamento negativo, fração de dia e duração extrema', () => {
  for (const [dailyBudget,days] of [['0',7],['25',1.5],['25',366],['10001',7]]) assert.throws(()=>normalizePurchase({target:{postId:'12345678-1234-1234-1234-123456789abc',dailyBudget,days,objective:'profile'}},DEFAULT_PRODUCTS[2],'social'));
});
test('permissão financeira não aceita user_metadata ou conta anônima', () => {
  assert.equal(isFinanceAdmin({id:'u',user_metadata:{role:'admin'}},{}),false);
  assert.equal(isFinanceAdmin({id:'u',app_metadata:{role:'finance_admin'}},{}),true);
  assert.equal(isFinanceAdmin({id:'u',is_anonymous:true,app_metadata:{role:'admin'}},{}),false);
});
test('API administrativa exige sessão e autorização verificadas', async () => {
  await assert.rejects(()=>requirePayUser(new Request('https://local'),{},true),e=>e.status===401);
  const db={auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})}};
  await assert.rejects(()=>requirePayUser(new Request('https://local',{headers:{authorization:'Bearer jwt'}}),db,true),e=>e.status===403);
});
test('adapter PAY conserva idempotência e valida resposta', async () => {
  const env={JENIOS_PAY_CHECKOUT_URL:'https://pay.example/checkout',JENIOS_PAY_API_TOKEN:'private'};
  let observed;
  const result=await createGatewayCheckout({orderId:'o1',amount_cents:990,currency:'BRL'},{env,fetchImpl:async(_url,opts)=>{observed=opts;return {ok:true,json:async()=>({orderId:'o1',amount_cents:990,currency:'BRL',checkoutUrl:'https://pay.example/pay/1'})}}});
  assert.equal(result.checkoutUrl,'https://pay.example/pay/1'); assert.equal(observed.headers['idempotency-key'],'o1');
});
test('adapter rejeita valor divergente e redirecionamento não autorizado', async () => {
  const env={JENIOS_PAY_CHECKOUT_URL:'https://pay.example/checkout',JENIOS_PAY_API_TOKEN:'private'};
  await assert.rejects(()=>createGatewayCheckout({orderId:'o1',amount_cents:990},{env,fetchImpl:async()=>({ok:true,json:async()=>({orderId:'o1',amount_cents:1,currency:'BRL'})})}));
  assert.throws(()=>safeCheckoutUrl('https://evil.example/','https://pay.example/checkout',{}));
  assert.throws(()=>safeCheckoutUrl('javascript:alert(1)','https://pay.example/checkout',{}));
});
