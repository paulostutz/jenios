import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayConfig,createGatewayCheckout} from '../lib/pay/gateway.mjs';
import {createInterPixClient,createInterCheckout,interPixConfigured} from '../lib/pay/inter-pix.mjs';
import {checkoutService} from '../lib/pay/checkout.mjs';
const credentials={JENIOS_PAY_PROVIDER:'inter_pix',INTER_CLIENT_ID:'test-r44',INTER_CLIENT_SECRET:'fixture',INTER_CERTIFICATE:'fixture',INTER_PRIVATE_KEY:'fixture',INTER_PIX_KEY:'fixture@example.invalid'};
const order={orderId:'11111111-1111-4111-8111-111111111111',amount_cents:990,scope:'social',billing_type:'one_time'};
test('R44 configured credentials do not enable checkout without an exact activation flag',()=>{
 for(const value of [undefined,'','false','TRUE','1']){
  const env={...credentials,JENIOS_PAY_PAYMENTS_ENABLED:value};
  assert.equal(interPixConfigured(env),true);
  assert.equal(gatewayConfig(env),null);
 }
 assert.deepEqual(gatewayConfig({...credentials,JENIOS_PAY_PAYMENTS_ENABLED:'true'}),{provider:'inter_pix'});
 assert.equal(gatewayConfig({JENIOS_PAY_PAYMENTS_ENABLED:'true'}),null);
});
test('R44 disabled checkout stops before order persistence and external requests',async()=>{
 const env={...credentials,JENIOS_PAY_PAYMENTS_ENABLED:'false'};
 await assert.rejects(checkoutService({body:{productCode:'social-crypto-validator'},user:{id:order.orderId},scope:'social',key:'r44-disabled-checkout',db:{from:()=>assert.fail('must not persist')},configured:()=>gatewayConfig(env),gateway:()=>assert.fail('must not call gateway')}),{status:503});
 await assert.rejects(createGatewayCheckout(order,{env:{JENIOS_PAY_CHECKOUT_URL:'https://pay.example/checkout',JENIOS_PAY_API_TOKEN:'fixture',JENIOS_PAY_PAYMENTS_ENABLED:'false'},fetchImpl:()=>assert.fail('must not fetch')}),{status:503});
});
test('R44 direct Pix creation also stops before database, OAuth or bank access',async()=>{
 const env={...credentials,JENIOS_PAY_PAYMENTS_ENABLED:'false'};
 const client=createInterPixClient({env,request:()=>assert.fail('must not contact bank')});
 await assert.rejects(client.create(order),{status:503});
 await assert.rejects(createInterCheckout(order,{env,db:{from:()=>assert.fail('must not persist')},client:{create:()=>assert.fail('must not create charge')}}),{status:503});
});
test('R44 disabling new charges preserves read-only connection and receipt queries',async()=>{
 const calls=[];
 const client=createInterPixClient({env:{...credentials,INTER_CLIENT_ID:'r44-read-only',JENIOS_PAY_PAYMENTS_ENABLED:'false'},request:async input=>{
  calls.push(input);
  if(input.path==='/oauth/v2/token')return {access_token:'fixture',expires_in:3600};
  return {status:'ATIVA'};
 }});
 assert.deepEqual(await client.read('0'.repeat(32)),{status:'ATIVA'});
 assert.equal(calls.length,2);
 assert.equal(calls[1].method,'GET');
});
