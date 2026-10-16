import test from 'node:test';
import assert from 'node:assert/strict';
import {guestHash,newGuestCookie,requireReportBuyer,ownsOrder} from '../lib/pay/buyer.mjs';
import {requirePaidPurchase} from '../lib/pay/access.mjs';
import {purchaseQuote,purchaseFingerprint} from '../lib/pay/purchase.mjs';
import {DEFAULT_PRODUCTS} from '../lib/pay/catalog.mjs';
const token='a'.repeat(64),hash=guestHash(token),id='11111111-1111-4111-8111-111111111111';
const product={...DEFAULT_PRODUCTS[0],id:'p'},target={codigo:'123',periodo:'202606'};
const quote=purchaseQuote({target},product,'social');
function fixture(overrides={}){const order={id,user_id:null,guest_buyer_hash:hash,status:'paid',product_id:'p',currency:'BRL',amount_cents:quote.amount_cents,external_reference:JSON.stringify({productCode:product.code,scope:'social',fingerprint:purchaseFingerprint(quote)}),...overrides};return {db:{from(table){return {select(){return this;},eq(){return this;},is(){return this;},async maybeSingle(){return {data:table==='jenios_pay_orders'?order:product};}};}},user:{id:null,guestHash:hash},orderId:id,productCode:product.code,target};}
test('guest session is random, private, secure and same-origin',()=>{
 const request=new Request('https://jenios.example/api/guest',{method:'POST',headers:{origin:'https://jenios.example'}});
 const cookie=newGuestCookie(request);assert.match(cookie,/HttpOnly; SameSite=Lax/);assert.match(cookie,/Secure/);assert.notEqual(cookie,newGuestCookie(request));
 assert.throws(()=>newGuestCookie(new Request(request.url,{method:'POST',headers:{origin:'https://evil.example'}})),{status:403});
});
test('cookie buyer creates no account and no user id',async()=>{
 const buyer=await requireReportBuyer(new Request('https://jenios.example/api/report',{method:'POST',headers:{origin:'https://jenios.example',cookie:'jenios_report_buyer='+token}}),{});
 assert.equal(buyer.id,null);assert.equal(buyer.guestHash,hash);
 assert.equal(ownsOrder({user_id:'someone',guest_buyer_hash:hash},buyer),false);
});
test('guest cannot access someone else, unpaid, wrong target, or refunded order',async()=>{
 assert.equal((await requirePaidPurchase(fixture())).authorized,true);
 for(const changes of [{guest_buyer_hash:'b'.repeat(64)},{user_id:'owner'},{status:'pending'},{status:'refunded'}])await assert.rejects(requirePaidPurchase(fixture(changes)));
 await assert.rejects(requirePaidPurchase({...fixture(),target:{...target,codigo:'124'}}),{status:403});
});
