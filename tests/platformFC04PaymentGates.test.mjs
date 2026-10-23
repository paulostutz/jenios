import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayConfig, createGatewayCheckout } from '../lib/pay/gateway.mjs';
import { checkoutService } from '../lib/pay/checkout.mjs';
import { createInterCheckout, createInterPixClient } from '../lib/pay/inter-pix.mjs';
import {handleProTopups,proTopupAvailability} from '../lib/assistant/pro-topups.mjs';
import {handleUniversitySubscription} from '../lib/assistant/university-subscription.mjs';
import {UNIVERSITY_MONTHLY_TERMS} from '../lib/assistant/university-monthly-access.mjs';
import {commercialFixture,NOW} from './fixtures/fc04-commercial.mjs';

const generic = { JENIOS_PAY_CHECKOUT_URL:'https://pay.example.invalid/checkout', JENIOS_PAY_API_TOKEN:'fixture-only-token' };
const pix = { JENIOS_PAY_PROVIDER:'inter_pix', INTER_CLIENT_ID:'fc04-fixture', INTER_CLIENT_SECRET:'fc04-fixture', INTER_CERTIFICATE:'fc04-fixture', INTER_PRIVATE_KEY:'fc04-fixture', INTER_PIX_KEY:'fixture@example.invalid' };
const payload = { orderId:'11111111-1111-4111-8111-111111111111', userId:'fixture-owner', productCode:'social-bankscore-report', amount_cents:990, currency:'BRL', billing_type:'one_time', scope:'social' };

test('FC04 stored generic credentials do not override disabled or missing payment consent', async()=>{
 for(const flag of [undefined,'false','TRUE','1',true]) {
  const env={...generic,JENIOS_PAY_PAYMENTS_ENABLED:flag};
  assert.equal(gatewayConfig(env),null);
  await assert.rejects(createGatewayCheckout(payload,{env,fetchImpl:()=>assert.fail('External payment request')}),{status:503});
 }
});

test('FC04 checkout rejects disabled payments before DB writes or vault reads', async()=>{
 const db={from:()=>assert.fail('Database touched'),rpc:()=>assert.fail('Vault touched')};
 for(const env of [{...generic,JENIOS_PAY_PAYMENTS_ENABLED:'false'},{...pix,JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'true'}]) {
  await assert.rejects(checkoutService({db,user:{id:payload.userId},body:{productCode:payload.productCode},scope:'social',key:'fc04-disabled-000001',env,gateway:()=>assert.fail('Gateway touched')}),{status:503});
 }
});

test('FC04 both Pix creation entry points reject either closed gate before side effects', async()=>{
 for(const flags of [{},{JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_INTER_CHARGES_ENABLED:'false'},{JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'true'}]) {
  const env={...pix,...flags};
  assert.equal(gatewayConfig(env),null);
  await assert.rejects(createInterCheckout(payload,{env,db:{from:()=>assert.fail('Payment row written')},client:{create:()=>assert.fail('Bank touched')}}),{status:503});
  await assert.rejects(createInterPixClient({env,request:()=>assert.fail('Bank touched')}).create(payload),{status:503});
 }
});

test('FC04 explicitly enabled generic fixture retains exact quote and provider idempotency', async()=>{
 let calls=0;
 const env={...generic,JENIOS_PAY_PAYMENTS_ENABLED:'true'};
 const result=await createGatewayCheckout(payload,{env,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,generic.JENIOS_PAY_CHECKOUT_URL);
  assert.equal(options.headers['idempotency-key'],payload.orderId);
  assert.deepEqual(JSON.parse(options.body),payload);
  return Response.json({orderId:payload.orderId,amount_cents:990,currency:'BRL',checkoutUrl:'https://pay.example.invalid/order'});
 }});
 assert.equal(calls,1);assert.equal(result.checkoutUrl,'https://pay.example.invalid/order');
});

test('FC04 direct Platform checkout cannot bypass the unverified recurring lifecycle shown by the catalog',async()=>{
 await assert.rejects(checkoutService({user:{id:payload.userId},body:{productCode:'platform-global-crypto',subscriptionLifecycleReady:true},scope:'platform',key:'fc04-platform-00001',env:{...generic,JENIOS_PAY_PAYMENTS_ENABLED:'true'},db:{from:()=>assert.fail('Order prepared')},gateway:()=>assert.fail('Charge created')}),{status:503,code:'SUBSCRIPTION_LIFECYCLE_UNVERIFIED'});
});

test('FC04 closing charge gates preserves read-only Pix reconciliation', async()=>{
 const env={...pix,INTER_CLIENT_ID:'fc04-readonly-fixture',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'};
 const calls=[];
 const client=createInterPixClient({env,request:async(args)=>{
  calls.push([args.path,args.method]);
  if(args.path==='/oauth/v2/token')return {access_token:'fixture-token',expires_in:3600};
  assert.equal(args.method,'GET');return {status:'ATIVA'};
 }});
 assert.deepEqual(await client.read(payload.orderId.replaceAll('-','')),{status:'ATIVA'});
 assert.equal(calls.filter(([,method])=>method==='PUT').length,0);
});

test('FC04 disabled payments hide Pro sales and reject quote before database or provider access',async()=>{
 const env={...pix,JENIOS_PRO_PAYMENTS_ENABLED:'true',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'true'};
 const db={from:()=>assert.fail('DB touched'),rpc:()=>assert.fail('RPC touched')};
 assert.equal((await proTopupAvailability(db,{topupsEnabled:true},env)).enabled,false);
 const response=await handleProTopups(new Request('https://jenios.example.invalid/fixture'),{action:'quote',db,env,authorize:()=>assert.fail('Identity lookup before closed gate'),now:NOW});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PAYMENT_CREATION_DISABLED');
});

test('FC04 University checkout with disabled payments cannot prepare a monthly invoice',async()=>{
 const f=commercialFixture();
 f.db.tables.jenios_pay_products=[{id:'fc04-university',code:'social-university-monthly',category:'other',currency:'BRL',billing_type:'monthly',price_cents:4990,active:true}];
 const req=new Request('https://jenios.example.invalid/fixture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestKey:'fc04-university-0001',acceptTerms:true,amountCents:4990,currency:'BRL',termsVersion:UNIVERSITY_MONTHLY_TERMS})});
 const response=await handleUniversitySubscription(req,{action:'checkout',db:f.db,env:{...pix,JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'true'},authorize:async()=>f.user,now:NOW});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PAYMENT_CREATION_DISABLED');
 assert.equal(f.db.writes.length,0);assert.equal(f.db.rpcCalls.length,0);
});
