/** R37: existing business services with an in-memory DB and fake payment transport.
 * This is not bank settlement, hosted Auth, or subscription activation certification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutService} from '../lib/pay/checkout.mjs';
import {requirePaidPurchase} from '../lib/pay/access.mjs';
import {purchaseQuote,purchaseFingerprint} from '../lib/pay/purchase.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333';
const O='44444444-4444-4444-8444-444444444444';
const K='fixture-checkout-key-0001';
const platform={id:P,code:'platform-nacional',category:'platform',active:true,price_cents:9990,currency:'BRL',billing_type:'monthly'};
function fixture(product=platform,initialOrders=[]){
 const orders=structuredClone(initialOrders),calls=[];
 const db={from(table){
  let mode='read',payload=null,filters=[];
  const rows=()=>table==='jenios_pay_products'?[product]:table==='jenios_pay_orders'?orders:[];
  function execute(){
   const selected=rows().filter(row=>filters.every(([key,value])=>row[key]===value));
   if(mode==='insert'){
    const row={id:O,...payload,created_at:'2026-10-24T00:00:00Z'};orders.push(row);return {data:row,error:null};
   }
   if(mode==='update'){for(const row of selected)Object.assign(row,payload);return {data:selected,error:null};}
   return {data:selected[0]||null,error:null};
  }
  const q={
   select(){return q;},eq(key,value){filters.push([key,value]);return q;},
   insert(data){mode='insert';payload=data;calls.push({kind:'insert',data});return q;},
   update(data){mode='update';payload=data;calls.push({kind:'update',data});return q;},
   maybeSingle:async()=>execute(),single:async()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
  };
  return q;
 }};
 const gateway=async payload=>{calls.push({kind:'gateway',payload});return {checkoutUrl:'https://payments.invalid/'+payload.orderId};};
 const configured=()=>({url:'https://payments.invalid/checkout',token:'fixture-only'});
 const run=body=>checkoutService({db,user:{id:A},body:body||{productCode:product.code},scope:'platform',key:K,gateway,configured});
 return {db,orders,calls,run};
}

test('R37 quote uses stored price and authenticated buyer, not injected client fields',async()=>{
 const f=fixture();await f.run({productCode:platform.code,amount_cents:1,currency:'USD',user_id:B});
 assert.equal(f.orders.length,1);assert.equal(f.orders[0].user_id,A);assert.equal(f.orders[0].amount_cents,9990);
 const payload=f.calls.find(x=>x.kind==='gateway').payload;
 assert.equal(payload.amount_cents,9990);assert.equal(payload.currency,'BRL');assert.equal(payload.userId,A);
 assert.equal(f.orders[0].status,'awaiting_payment');
});
test('R37 inactive product cannot create an order or invoke a gateway',async()=>{
 const f=fixture({...platform,active:false});await assert.rejects(f.run());assert.equal(f.orders.length,0);assert.equal(f.calls.length,0);
});
test('R37 cross-scope product cannot enter a Platform order',async()=>{
 const f=fixture({...platform,category:'other',code:'social-university-pass',billing_type:'one_time'});
 await assert.rejects(f.run());assert.equal(f.orders.length,0);assert.equal(f.calls.length,0);
});
test('R37 retry reuses the same order and original price after a catalog price change',async()=>{
 const product={...platform};const f=fixture(product);await f.run();product.price_cents=19990;await f.run();
 assert.equal(f.orders.length,1);assert.equal(f.orders[0].amount_cents,9990);
 const calls=f.calls.filter(x=>x.kind==='gateway');assert.equal(calls.length,2);
 assert.equal(calls[0].payload.orderId,calls[1].payload.orderId);assert.equal(calls[1].payload.amount_cents,9990);
});
test('R37 replay of paid order returns paid without a second gateway request',async()=>{
 const f=fixture();await f.run();f.orders[0].status='paid';
 const r=await f.run();assert.equal(r.status,'paid');assert.equal(r.checkoutUrl,null);
 assert.equal(f.calls.filter(x=>x.kind==='gateway').length,1);
});
test('R37 terminal order cannot restart the same checkout',async()=>{
 for(const status of ['cancelled','expired','refunded']){
  const f=fixture();await f.run();f.orders[0].status=status;
  await assert.rejects(f.run(),{status:409});assert.equal(f.calls.filter(x=>x.kind==='gateway').length,1);
 }
});
test('R37 foreign order is rejected even if a storage response returns it',async()=>{
 const f=fixture();await f.run();f.orders[0].user_id=B;
 await assert.rejects(f.run(),{status:404});assert.equal(f.calls.filter(x=>x.kind==='gateway').length,1);
});
test('R37 mismatched purchase fingerprint prevents replay with altered context',async()=>{
 const f=fixture();await f.run();f.orders[0].external_reference=JSON.stringify({fingerprint:'0'.repeat(64)});
 await assert.rejects(f.run(),{status:409});assert.equal(f.calls.filter(x=>x.kind==='gateway').length,1);
});
function paidSocialFixture(){
 const product={...platform,code:'social-bankscore-report',category:'bankscore',billing_type:'one_time',price_cents:990};
 const target={codigo:'123',periodo:'202609'};
 const quote=purchaseQuote({productCode:product.code,target},product,'social');
 const order={id:O,user_id:A,product_id:P,status:'paid',currency:'BRL',amount_cents:990,
  external_reference:JSON.stringify({scope:'social',productCode:product.code,fingerprint:purchaseFingerprint(quote)})};
 const f=fixture(product,[order]);return {...f,product,target,productCode:product.code};
}
test('R37 paid service survives catalog deactivation without granting another user access',async()=>{
 const f=paidSocialFixture();f.product.active=false;f.product.price_cents=1990;
 const r=await requirePaidPurchase({db:f.db,user:{id:A},orderId:O,productCode:f.productCode,target:f.target});
 assert.equal(r.authorized,true);
 await assert.rejects(requirePaidPurchase({db:f.db,user:{id:B},orderId:O,productCode:f.productCode,target:f.target}),{status:404});
});
test('R37 unpaid or refunded service cannot be delivered',async()=>{
 for(const status of ['pending','awaiting_payment','refunded']){
  const f=paidSocialFixture();f.orders[0].status=status;
  await assert.rejects(requirePaidPurchase({db:f.db,user:{id:A},orderId:O,productCode:f.productCode,target:f.target}),{status:403});
 }
});
test('R37 a paid order for one resource cannot unlock a different resource',async()=>{
 const f=paidSocialFixture();await assert.rejects(requirePaidPurchase({db:f.db,user:{id:A},orderId:O,productCode:f.productCode,target:{...f.target,codigo:'456'}}),{status:403});
});
