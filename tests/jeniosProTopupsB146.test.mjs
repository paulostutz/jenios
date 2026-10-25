import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {DEFAULT_PRODUCTS,normalizePurchase,priceUpdate} from '../lib/pay/catalog.mjs';
import {createInterPixClient,createInterCheckout,pixTxid} from '../lib/pay/inter-pix.mjs';
import {PRO_ADDON_TERMS,PRO_ADDON_PACKS} from '../lib/assistant/pro-addon-catalog.mjs';
import {validCreditQuote,creditOfferReady,restoreCreditAttempt} from '../app/genios-pro/credits-client.mjs';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';
import {PRO_WALLET_TABLES as T,PRO_WALLET_RPC as R,proWalletConfig,approvedProTopupQuote,approvedProAddonQuote} from '../lib/assistant/pro-wallet-contract.mjs';
import {PRO_TOPUP_PRODUCT,handleProTopups,loadOfficialProFx,projectProTopupQuote,proTopupAvailability} from '../lib/assistant/pro-topups.mjs';

const NOW=Date.now(),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const KEY='test-topup-quote-0001',ORDER_KEY='test-topup-order-0001';
const env={JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_PRO_PAYMENTS_ENABLED:'true',JENIOS_PAY_PROVIDER:'inter_pix',INTER_CLIENT_ID:'test-only-id',INTER_CLIENT_SECRET:'test-only-secret',INTER_CERTIFICATE:'test-only-certificate',INTER_PRIVATE_KEY:'test-only-key',INTER_PIX_KEY:'test-only-pix'};
const fx={brlMicrosPerUsd:5_123_456,source:'BCB:PTAX_USD_VENDA',sourceAt:new Date(NOW-3600_000).toISOString()};
const product={...DEFAULT_PRODUCTS.find(row=>row.code===PRO_TOPUP_PRODUCT),id:'33333333-3333-4333-8333-333333333333',active:true};
const config=()=>({id:true,generation_enabled:false,payments_enabled:true,requires_reconciliation:false,pricing_version:PRO_PRICING_VERSION,pricing_approved:true,rates_verified_at:new Date(NOW-3600_000).toISOString(),allowed_models:['gpt-5.4-nano'],monthly_provider_limit_nano_usd:100_000_000_000,max_request_provider_nano_usd:100_000_000,crypto_allowance_nano_usd:0,global_allowance_nano_usd:0,topup_currency:'BRL',topup_amount_minor:2500,commercial_terms_version:'test-approved-terms-1'});
const json=value=>Response.json(value);
const copy=value=>structuredClone(value);
const uuid=(prefix,index)=>`${prefix}-0000-4000-8000-${String(index).padStart(12,'0')}`;

// These tests cannot reach a real payment provider or FX server, even if a
// dependency accidentally stops honoring its injected transport.
const realFetch=globalThis.fetch,realHttps=https.request;
before(()=>{globalThis.fetch=()=>{throw Error('Real fetch is forbidden in B146 tests');};https.request=()=>{throw Error('Real HTTPS is forbidden in B146 tests');};});
after(()=>{globalThis.fetch=realFetch;https.request=realHttps;});

/** Minimal relational/transaction contract double for the HTTP orchestration.
 * PostgreSQL invariants are separately executed against the actual B143 SQL.
 * This adapter is test-only; it does not represent a production payment. */
function database(){
 const tables={[T.config]:[config()],jenios_pay_products:[copy(product)],[T.quotes]:[],[T.quoteOrders]:[],[T.funding]:[],jenios_pay_orders:[],jenios_pay_payments:[]};
 const db={tables,now:NOW,viewer:A,reads:0,writes:0,rpcs:[],balance:0,failAfterPrepare:false,failAfterQuote:false,afterPrepare:null,
  auth:{getUser:async()=>({data:{user:{id:db.viewer,is_anonymous:false}},error:null})},
  from(table){
   const predicates=[];let write;
   const run=()=>{
    db.reads++;const rows=tables[table]||(tables[table]=[]);let selected=rows.filter(row=>predicates.every(predicate=>predicate(row)));
    if(write?.kind==='update'){db.writes++;for(const row of selected)Object.assign(row,copy(write.value));}
    if(write?.kind==='upsert'){
     db.writes++;const existing=rows.find(row=>row.provider===write.value.provider&&row.provider_payment_id===write.value.provider_payment_id);
     if(existing)selected=[existing];else{const created={id:uuid('70000000',rows.length+1),...copy(write.value)};rows.push(created);selected=[created];}
    }
    return {data:copy(selected),error:null};
   };
   const q={select(){return q;},eq(key,value){predicates.push(row=>row[key]===value);return q;},update(value){write={kind:'update',value};return q;},upsert(value){write={kind:'upsert',value};return q;},then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);},async maybeSingle(){const result=run();return result.data.length>1?{data:null,error:{code:'TEST_TOO_MANY'}}:{data:result.data[0]||null,error:null};}};
   return q;
  },
  async rpc(name,args){
   db.rpcs.push({name,args:copy(args)});
   const okay=data=>({data:{ok:true,...copy(data)},error:null}),no=code=>({data:{ok:false,code},error:null});
   if(name===R.quote||name===R.addonQuote){
    const previous=tables[T.quotes].find(row=>row.user_id===args.p_user_id&&row.quote_key===args.p_quote_key);
    if(previous)return previous.fx_brl_micros_per_usd!==args.p_fx_brl_micros_per_usd?no('IDEMPOTENCY_CONFLICT'):okay({quote:previous,replayed:true});
    const c=tables[T.config][0],quoteFx={brlMicrosPerUsd:args.p_fx_brl_micros_per_usd,source:args.p_rate_source,sourceAt:args.p_rate_at};
    const calculated=name===R.addonQuote?approvedProAddonQuote({enabled:true,baseCurrency:c.topup_currency,amountMinor:c.topup_amount_minor,termsVersion:c.commercial_terms_version},args.p_pack_code,quoteFx,db.now):approvedProTopupQuote({enabled:true,baseCurrency:c.topup_currency,amountMinor:c.topup_amount_minor,termsVersion:c.commercial_terms_version},{brlMicrosPerUsd:args.p_fx_brl_micros_per_usd,source:args.p_rate_source,sourceAt:args.p_rate_at},db.now);
    const quote={id:uuid('50000000',tables[T.quotes].length+1),user_id:args.p_user_id,quote_key:args.p_quote_key,currency:'BRL',amount_cents:calculated.amountCents,retail_nano_usd:calculated.retailNanoUsd,...(name===R.addonQuote?{addon_pack_code:args.p_pack_code}:{}),base_currency:calculated.baseCurrency,base_amount_minor:calculated.baseAmountMinor,fx_brl_micros_per_usd:args.p_fx_brl_micros_per_usd,rate_source:args.p_rate_source,rate_at:args.p_rate_at,terms_version:c.commercial_terms_version,pricing_version:PRO_PRICING_VERSION,created_at:new Date(db.now).toISOString(),expires_at:calculated.expiresAt};
    tables[T.quotes].push(quote);db.writes++;
    if(db.failAfterQuote){db.failAfterQuote=false;return {data:null,error:{code:'LOST_RESPONSE'}};}
    return okay({quote,replayed:false});
   }
   if(name===R.prepareTopup){
    const quote=tables[T.quotes].find(row=>row.id===args.p_quote_id&&row.user_id===args.p_user_id);
    if(!quote)return no('QUOTE_NOT_FOUND');
    const idem='pro:'+args.p_user_id+':'+args.p_order_key,binding=tables[T.quoteOrders].find(row=>row.quote_id===quote.id);
    if(binding){
     const order=tables.jenios_pay_orders.find(row=>row.id===binding.order_id&&row.user_id===args.p_user_id);
     if(!order||order.idempotency_key!==idem)return no('IDEMPOTENCY_CONFLICT');
     if(['cancelled','expired','refunded'].includes(order.status))return no('ORDER_CLOSED');
     return okay({order,quote,replayed:true});
    }
    if(Date.parse(quote.expires_at)<=db.now)return no('QUOTE_EXPIRED');
    if(tables.jenios_pay_orders.some(row=>row.idempotency_key===idem))return no('IDEMPOTENCY_CONFLICT');
    const order={id:uuid('60000000',tables.jenios_pay_orders.length+1),user_id:args.p_user_id,product_id:product.id,provider:'inter_pix',status:'pending',currency:'BRL',amount_cents:quote.amount_cents,idempotency_key:idem,created_at:new Date(db.now).toISOString(),external_reference:JSON.stringify({productCode:PRO_TOPUP_PRODUCT,scope:'social',proQuoteId:quote.id,fingerprint:'pro:'+quote.id,checkoutKey:idem})};
    tables.jenios_pay_orders.push(order);tables[T.quoteOrders].push({quote_id:quote.id,order_id:order.id});db.writes++;
    db.afterPrepare?.();
    if(db.failAfterPrepare){db.failAfterPrepare=false;return {data:null,error:{code:'LOST_RESPONSE'}};}
    return okay({order,quote,replayed:false});
   }
   if(name==='jenios_confirm_inter_pix'){
    const order=tables.jenios_pay_orders.find(row=>row.id===args.p_order_id);
    const receipt=tables.jenios_pay_payments.find(row=>row.order_id===args.p_order_id&&row.provider_payment_id===args.p_txid);
    if(!order||!receipt||order.amount_cents!==args.p_amount)return {data:null,error:{code:'RECEIPT_MISMATCH'}};
    order.status='paid';receipt.status='confirmed';receipt.confirmed_at=args.p_paid_at;db.writes++;
    return okay({});
   }
   if(name===R.fund){
    const funded=tables[T.funding].find(row=>row.order_id===args.p_order_id);
    if(funded)return funded.user_id===args.p_user_id&&funded.quote_id===args.p_quote_id?okay({replayed:true}):no('BOUND_QUOTE_REQUIRED');
    const order=tables.jenios_pay_orders.find(row=>row.id===args.p_order_id&&row.user_id===args.p_user_id&&row.status==='paid');
    const quote=tables[T.quotes].find(row=>row.id===args.p_quote_id&&row.user_id===args.p_user_id);
    const receipt=order&&tables.jenios_pay_payments.find(row=>row.order_id===order.id&&row.status==='confirmed'&&row.amount_cents===quote?.amount_cents&&row.provider_payment_id);
    if(!order||!quote||!receipt||!tables[T.quoteOrders].some(row=>row.order_id===order.id&&row.quote_id===quote.id))return no('CONFIRMED_RECEIPT_REQUIRED');
    tables[T.funding].push({order_id:order.id,quote_id:quote.id,user_id:args.p_user_id});db.balance+=quote.retail_nano_usd;db.writes++;
    return okay({replayed:false,retailNanoUsd:quote.retail_nano_usd});
   }
   throw Error('Unexpected RPC '+name);
  }
 };return db;
}
const request=(action,body)=>new Request('https://qa.invalid/api/assistant/pro/credits/'+action+(action==='status'?body.orderId?'?orderId='+encodeURIComponent(body.orderId):'?quoteId='+encodeURIComponent(body.quoteId)+'&requestKey='+encodeURIComponent(body.requestKey):''),{method:action==='status'?'GET':'POST',headers:{authorization:'Bearer test-only-token',...(action==='status'?{}:{'content-type':'application/json'})},...(action==='status'?{}:{body:JSON.stringify(body)})});
async function call(db,action,body,options={}){const response=await handleProTopups(request(action,body),{action,db,env,now:db.now,fxLoader:async()=>fx,planResolver:async()=>({code:'platform-global-crypto',periodStart:new Date(NOW-86400_000).toISOString(),periodEnd:new Date(NOW+30*86400_000).toISOString()}),...options});return {status:response.status,body:await response.json(),headers:response.headers};}
async function getQuote(db,options={}){const result=await call(db,'quote',{requestKey:KEY},options);assert.equal(result.status,200,JSON.stringify(result.body));return result.body.quote;}
const consent=quote=>({quoteId:quote.id,requestKey:ORDER_KEY,acceptTerms:true,amountCents:quote.amountCents,currency:quote.currency,termsVersion:quote.termsVersion});
function bank({loseFirstPut=false}={}){
 const charges=new Map(),calls=[];let lose=loseFirstPut;
 const client=createInterPixClient({env,request:async input=>{
  calls.push({path:input.path,method:input.method});
  if(input.path==='/oauth/v2/token')return {access_token:'test-only-oauth',expires_in:3600};
  const txid=input.path.split('/').at(-1);
  if(input.method==='PUT'){
   const charge={txid,chave:env.INTER_PIX_KEY,status:'ATIVA',calendario:{criacao:new Date(NOW).toISOString(),expiracao:3600},valor:{original:input.body.valor.original},pixCopiaECola:'000201-test-code'};
   charges.set(txid,charge);
   if(lose){lose=false;throw Object.assign(Error('Test transport lost the response after storing the charge'),{status:502});}
   return copy(charge);
  }
  if(!charges.has(txid))throw Object.assign(Error('Test charge not found'),{status:502,bankStatus:404});
  return copy(charges.get(txid));
 }});
 return {client,charges,calls,gateway:(payload,options)=>createInterCheckout(payload,{...options,client}),pay(orderId){const charge=charges.get(pixTxid(orderId));charge.status='CONCLUIDA';charge.pix=[{txid:charge.txid,valor:charge.valor.original,endToEndId:'E'+'1'.repeat(31),horario:new Date(NOW).toISOString()}];}};
}

test('B146 unapproved Pro SKU cannot be activated or sold through generic PAY; existing purchases keep their rules',()=>{
 const sku=DEFAULT_PRODUCTS.find(row=>row.code===PRO_TOPUP_PRODUCT);
 assert.equal(sku.active,false);assert.equal(sku.price_cents,0);
 assert.throws(()=>priceUpdate({code:sku.code,active:true,price_cents:5000}),/aprovação comercial/);
 assert.equal(priceUpdate({code:sku.code,active:false,price_cents:0}).active,false);
 assert.throws(()=>normalizePurchase({}, {...sku,active:true,price_cents:5000},'social'),/cotação aprovada/);
 const bankscore=DEFAULT_PRODUCTS.find(row=>row.code==='social-bankscore-report');
 assert.equal(normalizePurchase({target:{codigo:'123',periodo:'202610'}},bankscore,'social').amount_cents,990);
 const nacional=DEFAULT_PRODUCTS.find(row=>row.code==='platform-nacional');
 assert.equal(normalizePurchase({},nacional,'platform').amount_cents,9990);
 assert.equal(priceUpdate({code:'social-university-pass',active:true,price_cents:3990}).price_cents,3990);
});

test('B146 disabled environment stops every route before authentication, DB, FX or payment calls',async()=>{
 let calls=0;const forbidden=()=>{calls++;throw Error('Should not be reached');};
 const db={from:forbidden,rpc:forbidden};
 for(const action of ['quote','checkout','status']){
  const response=await handleProTopups(request(action,action==='status'?{orderId:A}:{requestKey:KEY}),{action,db,env:{...env,JENIOS_PRO_PAYMENTS_ENABLED:'false'},authorize:forbidden,fxLoader:forbidden,gateway:forbidden,paymentStatus:forbidden});
  assert.equal(response.status,503);const body=await response.json();assert.equal(body.code,'PRO_PAYMENTS_DISABLED');assert.equal(body.credited,false);assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
 assert.equal(calls,0);
 assert.equal((await proTopupAvailability(db,proWalletConfig(config(),NOW),{})).enabled,false);
 assert.equal(calls,0);
});

test('G45 additional purchase requires a currently eligible plan before FX, quote or order writes',async()=>{
 const empty=null,national={code:'platform-nacional',periodStart:new Date(NOW-1000).toISOString(),periodEnd:new Date(NOW+60000).toISOString()},expired={...national,code:'platform-global-crypto',periodEnd:new Date(NOW-1).toISOString()};
 for(const plan of [empty,national,expired]){
  const db=database();let fxCalls=0,gatewayCalls=0;
  const result=await call(db,'quote',{requestKey:KEY},{planResolver:async()=>plan,fxLoader:async()=>{fxCalls++;return fx;},gateway:async()=>{gatewayCalls++;}});
  assert.equal(result.status,402);assert.equal(result.body.code,'ADVANCED_PLAN_REQUIRED');
  assert.equal(db.writes,0);assert.equal(db.rpcs.length,0);assert.equal(fxCalls,0);assert.equal(gatewayCalls,0);
 }
 const db=database(),quote=await getQuote(db),before=db.writes;
 const result=await call(db,'checkout',consent(quote),{planResolver:async()=>null,gateway:async()=>{throw Error('No bank call for expired subscription');}});
 assert.equal(result.status,402);assert.equal(db.writes,before);assert.equal(db.tables.jenios_pay_orders.length,0);
});

test('G45 the owner can reconcile a paid additional order after the subscription expires',async()=>{
 const db=database(),quote=await getQuote(db),fakeBank=bank();
 const checkout=await call(db,'checkout',consent(quote),{gateway:fakeBank.gateway});
 assert.equal(checkout.status,200);fakeBank.pay(checkout.body.orderId);
 const result=await call(db,'status',{orderId:checkout.body.orderId},{planResolver:async()=>{throw Error('Historical status must not require a current plan');},pixClientFactory:()=>fakeBank.client});
 assert.equal(result.status,200);assert.equal(result.body.state,'credited');assert.equal(db.balance,quote.retailNanoUsd);
 const repeated=await call(db,'status',{orderId:checkout.body.orderId},{planResolver:async()=>null,pixClientFactory:()=>fakeBank.client});
 assert.equal(repeated.body.credited,true);assert.equal(db.balance,quote.retailNanoUsd);
});

test('G45 explicit uncapped topups respect all price and payment gates without inventing a monthly ceiling',async()=>{
 const db=database();Object.assign(db.tables[T.config][0],{monthly_budget_mode:'uncapped',monthly_provider_limit_nano_usd:0});
 const policy=proWalletConfig(db.tables[T.config][0],NOW);
 assert.equal(policy.monthlyProviderLimitNanoUsd,null);assert.equal(policy.topupsEnabled,true);
 const offer=await proTopupAvailability(db,policy,env);assert.equal(offer.enabled,true);
 const quoted=await getQuote(db);assert.equal(quoted.amountCents,2500);assert.equal(quoted.baseCurrency,'BRL');
 for(const patch of [{payments_enabled:false},{pricing_approved:false},{topup_currency:null},{topup_amount_minor:null},
  {commercial_terms_version:null},{requires_reconciliation:true},{allowed_models:[]}]){
  const config=proWalletConfig({...db.tables[T.config][0],...patch},NOW);assert.equal(config.topupsEnabled,false,JSON.stringify(patch));
 }
 const capped=proWalletConfig({...db.tables[T.config][0],monthly_budget_mode:'capped'},NOW);assert.equal(capped.topupsEnabled,false);
 assert.throws(()=>proWalletConfig({...db.tables[T.config][0],monthly_budget_mode:'unknown'},NOW));
});

test('G45 status recovers only the existing paid order by original quote and key after subscription expiry',async()=>{
 const db=database(),quote=await getQuote(db),fakeBank=bank();
 const checkout=await call(db,'checkout',consent(quote),{gateway:fakeBank.gateway});
 assert.equal(checkout.status,200);fakeBank.pay(checkout.body.orderId);
 const before=db.tables.jenios_pay_orders.length,bankPuts=fakeBank.calls.filter(c=>c.method==='PUT').length;
 const response=await call(db,'status',{quoteId:quote.id,requestKey:ORDER_KEY},{
  planResolver:async()=>{throw Error('Expired plan does not block historical reconciliation');},
  fxLoader:async()=>{throw Error('A reference lookup must not fetch FX');},gateway:async()=>{throw Error('A reference lookup must not create a charge');},pixClientFactory:()=>fakeBank.client});
 assert.equal(response.status,200);assert.equal(response.body.state,'credited');assert.equal(response.body.orderId,checkout.body.orderId);
 assert.equal(response.body.quoteId,quote.id);assert.equal(response.body.requestKey,ORDER_KEY);assert.equal(response.body.resolvedExistingOrder,true);
 assert.equal(db.balance,quote.retailNanoUsd);assert.equal(db.tables.jenios_pay_orders.length,before);
 assert.equal(fakeBank.calls.filter(c=>c.method==='PUT').length,bankPuts);
 const again=await call(db,'status',{quoteId:quote.id,requestKey:ORDER_KEY},{planResolver:async()=>null,pixClientFactory:()=>fakeBank.client});
 assert.equal(again.body.replayed,true);assert.equal(db.balance,quote.retailNanoUsd);
});

test('G45 status without a binding preserves the quote reference and never prepares another order',async()=>{
 const db=database(),quote=await getQuote(db),writes=db.writes,rpcs=db.rpcs.length;let external=0;
 const forbidden=async()=>{external++;throw Error('External call prohibited for an unknown order');};
 const response=await call(db,'status',{quoteId:quote.id,requestKey:ORDER_KEY},{planResolver:forbidden,fxLoader:forbidden,gateway:forbidden,paymentStatus:forbidden,pixClientFactory:forbidden});
 assert.equal(response.status,404);assert.equal(response.body.code,'ORDER_REFERENCE_NOT_FOUND');
 assert.equal(response.body.state,'order_unconfirmed');assert.equal(response.body.quoteId,quote.id);assert.equal(response.body.requestKey,ORDER_KEY);
 assert.equal(response.body.referencePreserved,true);assert.equal(response.body.retrySameOrder,false);
 assert.equal(response.body.credited,false);assert.equal(response.body.orderId,undefined);
 assert.equal(db.writes,writes);assert.equal(db.rpcs.length,rpcs);assert.equal(external,0);assert.equal(db.balance,0);
});

test('G45 recovered references must match owner, quote, order key and amount before inspecting a payment',async()=>{
 for(const variant of ['owner','key','quote','amount']){
  const db=database(),quote=await getQuote(db),fakeBank=bank();
  const checkout=await call(db,'checkout',consent(quote),{gateway:fakeBank.gateway});
  assert.equal(checkout.status,200);
  let quoteId=quote.id,key=ORDER_KEY;
  if(variant==='owner')db.viewer=B;
  if(variant==='key')key='another-order-key-0001';
  if(variant==='quote')quoteId=B;
  if(variant==='amount')db.tables.jenios_pay_orders[0].amount_cents++;
  const before=db.writes,rpcs=db.rpcs.length;let calls=0;
  const forbidden=async()=>{calls++;throw Error('Do not contact bank for unmatched reference');};
  const result=await call(db,'status',{quoteId,requestKey:key},{planResolver:forbidden,fxLoader:forbidden,gateway:forbidden,paymentStatus:forbidden,pixClientFactory:forbidden});
  assert.equal(result.body.ok,false);assert.ok([404,503].includes(result.status),variant);assert.equal(result.body.credited,false);
  assert.equal(result.body.orderId,undefined);assert.equal(result.body.referencePreserved,true);assert.equal(result.body.retrySameOrder,false);
  assert.equal(db.writes,before);assert.equal(db.rpcs.length,rpcs);assert.equal(db.balance,0);assert.equal(calls,0);
 }
});

test('G45 lost preparation response can resolve a pending order without authorizing a charge or funding',async()=>{
 const db=database(),quote=await getQuote(db);db.failAfterPrepare=true;
 const attempt=await call(db,'checkout',consent(quote),{gateway:async()=>{throw Error('A lost prepare response must not dispatch');}});
 assert.equal(attempt.status,503);assert.equal(attempt.body.orderId,undefined);assert.equal(db.tables.jenios_pay_orders.length,1);
 const existing=db.tables.jenios_pay_orders[0],writes=db.writes,rpcs=db.rpcs.length;
 const result=await call(db,'status',{quoteId:quote.id,requestKey:ORDER_KEY},{planResolver:async()=>null,
  pixClientFactory:()=>({}),paymentStatus:async({id})=>({orderId:id,currency:'BRL',amount_cents:quote.amountCents,status:'pending'}),
  gateway:async()=>{throw Error('Status cannot dispatch a pending charge');},fxLoader:async()=>{throw Error('Status cannot refresh FX');}});
 assert.equal(result.status,200);assert.equal(result.body.orderId,existing.id);assert.equal(result.body.state,'awaiting_payment');
 assert.equal(result.body.resolvedExistingOrder,true);assert.equal(result.body.requestKey,ORDER_KEY);assert.equal(result.body.credited,false);
 assert.equal(db.writes,writes);assert.equal(db.rpcs.length,rpcs);assert.equal(db.balance,0);
});

test('B146 every policy, pricing, budget and SKU gate is required before a quote can write or fetch FX',async()=>{
 const variants=[{payments_enabled:false},{topup_currency:null},{topup_amount_minor:null},{commercial_terms_version:null},{pricing_approved:false},{pricing_version:'unapproved-version'},{rates_verified_at:new Date(NOW-31*86400_000).toISOString()},{allowed_models:[]},{monthly_provider_limit_nano_usd:0},{requires_reconciliation:true}];
 for(const patch of variants){
  const db=database();Object.assign(db.tables[T.config][0],patch);let external=0;
  const result=await call(db,'quote',{requestKey:KEY},{fxLoader:async()=>{external++;return fx;}});
  assert.equal(result.status,503,JSON.stringify(patch));assert.equal(external,0);assert.equal(db.writes,0);assert.equal(db.rpcs.length,0);
 }
 const inactive=database();inactive.tables.jenios_pay_products[0].active=false;
 assert.equal((await call(inactive,'quote',{requestKey:KEY})).status,503);assert.equal(inactive.writes,0);
 const anonymous=database();assert.equal((await call(anonymous,'quote',{requestKey:KEY},{authorize:async()=>({id:A,is_anonymous:true})})).status,401);assert.equal(anonymous.reads,0);
 const ready=database(),offer=await proTopupAvailability(ready,proWalletConfig(ready.tables[T.config][0],NOW),env);
 assert.deepEqual(offer,{enabled:true,baseCurrency:'BRL',baseAmountMinor:2500,termsVersion:'test-approved-terms-1',settlementCurrency:'BRL',quoteRequired:true});
});

test('B146 official PTAX adapter fixes origin, endpoint and parameters and converts six decimals without floating money',async()=>{
 const now=Date.parse('2026-10-20T16:30:00Z');let observed;
 const rate=await loadOfficialProFx({now,fetchImpl:async(url,options)=>{observed={url:new URL(url),options};return json({value:[{cotacaoVenda:5.123456,dataHoraCotacao:'2026-10-20 13:00:01.1234',tipoBoletim:'Fechamento'}]});}});
 assert.equal(observed.url.origin,'https://olinda.bcb.gov.br');assert.match(observed.url.pathname,/\/PTAX\/versao\/v1\/odata\/CotacaoMoedaPeriodo/);
 assert.ok(!observed.url.href.includes('+'),'Olinda rejects form-encoded spaces in OData expressions');
 assert.match(observed.url.href,/tipoBoletim%20eq%20/);assert.match(observed.url.href,/dataHoraCotacao%20desc/);
 assert.equal(observed.url.searchParams.get('@moeda'),"'USD'");assert.equal(observed.url.searchParams.get('$filter'),"tipoBoletim eq 'Fechamento'");assert.equal(observed.url.searchParams.get('$top'),'1');assert.equal(observed.options.redirect,'error');assert.equal(observed.options.cache,'no-store');
 assert.deepEqual(rate,{brlMicrosPerUsd:5123456,source:'BCB:PTAX_USD_VENDA',sourceAt:'2026-10-20T16:00:01.123Z'});
 const row={cotacaoVenda:5.123456,dataHoraCotacao:'2026-10-20 13:00:01.1234',tipoBoletim:'Fechamento'};
 for(const patch of [{tipoBoletim:'Intermediário'},{dataHoraCotacao:'2026-10-20 14:00:00.0'},{dataHoraCotacao:'2026-10-16 13:00:00.0'},{dataHoraCotacao:'2026-02-30 13:00:00.0'},{cotacaoVenda:5.1234567},{cotacaoVenda:-1}])await assert.rejects(loadOfficialProFx({now,fetchImpl:async()=>json({value:[{...row,...patch}]})}),{code:'FX_UNAVAILABLE'});
 await assert.rejects(loadOfficialProFx({now,fetchImpl:async()=>new Response('redirect',{status:302})}),{code:'FX_UNAVAILABLE'});
 await assert.rejects(loadOfficialProFx({now,fetchImpl:async()=>json({value:[],extra:'x'.repeat(17000)})}),{code:'FX_UNAVAILABLE'});
});

test('B146 quotes are server-priced, private, immutable on retry and recover a committed but lost response',async()=>{
 const db=database();db.failAfterQuote=true;let loads=0;
 const first=await call(db,'quote',{requestKey:KEY},{fxLoader:async()=>{loads++;return fx;}});
 assert.equal(first.status,200);assert.equal(first.body.replayed,true);
 const quote=first.body.quote;assert.equal(quote.amountCents,2500);assert.equal(quote.baseCurrency,'BRL');assert.equal(quote.retailNanoUsd,4_879_518_824);assert.equal(quote.userId,undefined);
 const again=await call(db,'quote',{requestKey:KEY},{fxLoader:async()=>{throw Error('Replay must not ask for new FX');}});
 assert.deepEqual(again.body.quote,quote);assert.equal(loads,1);assert.equal(db.tables[T.quotes].length,1);assert.equal(db.rpcs.length,1);
 const bad=await call(db,'quote',{requestKey:'another-request-key-1',amountMinor:1,fxBrlMicrosPerUsd:1});
 assert.equal(bad.status,400);assert.equal(db.rpcs.length,1);
 db.viewer=B;const other=await call(db,'quote',{requestKey:KEY});assert.equal(other.status,200);assert.notEqual(other.body.quote.id,quote.id);
 assert.throws(()=>projectProTopupQuote(db.tables[T.quotes][0],B,NOW),{status:404});
});

test('B146 an approved USD amount has no implicit package and cents round upward while ledger fractions are retained',async()=>{
 const db=database();Object.assign(db.tables[T.config][0],{topup_currency:'USD',topup_amount_minor:1234});
 const quote=await getQuote(db);assert.equal(quote.baseAmountMinor,1234);assert.equal(quote.retailNanoUsd,12_340_000_000);assert.equal(quote.amountCents,6323);
 db.now=NOW+16*60_000;const expired=await call(db,'quote',{requestKey:KEY});assert.equal(expired.status,409);assert.equal(expired.body.code,'QUOTE_EXPIRED');assert.equal(db.tables[T.quotes].length,1);
 const expiredCheckout=await call(db,'checkout',consent(quote));assert.equal(expiredCheckout.status,409);assert.equal(expiredCheckout.body.state,'not_started');assert.equal(expiredCheckout.body.retrySameOrder,undefined);assert.equal(db.tables.jenios_pay_orders.length,0);
});

test('B146 consent matches the immutable snapshot and atomic binding precedes the existing gateway',async()=>{
 const db=database(),quote=await getQuote(db),body=consent(quote);let calls=0;
 const gateway=async(payload)=>{calls++;assert.equal(db.tables[T.quoteOrders][0].order_id,payload.orderId);assert.equal(payload.amount_cents,quote.amountCents);return {checkoutUrl:'/social/pagamento?pedido='+payload.orderId};};
 for(const patch of [{amountCents:quote.amountCents+1},{termsVersion:'altered-terms'},{acceptTerms:false},{currency:'USD'}]){
  const result=await call(db,'checkout',{...body,...patch},{gateway});assert.ok([400,409].includes(result.status));
 }
 assert.equal(db.tables.jenios_pay_orders.length,0);assert.equal(calls,0);
 const checkout=await call(db,'checkout',body,{gateway});assert.equal(checkout.status,200);assert.equal(checkout.body.credited,false);assert.equal(checkout.body.state,'awaiting_payment');
 const retry=await call(db,'checkout',body,{gateway});assert.equal(retry.status,200);assert.equal(retry.body.orderId,checkout.body.orderId);assert.equal(retry.body.replayed,true);assert.equal(calls,1);assert.equal(db.tables.jenios_pay_orders.length,1);
 assert.equal((await call(db,'checkout',{...body,requestKey:'different-order-key-0001'},{gateway})).status,409);
 db.viewer=B;assert.equal((await call(db,'checkout',body,{gateway})).status,404);assert.equal(calls,1);
});

test('B146 a lost Pix PUT response preserves one order and one txid; retry reads the same bank charge',async()=>{
 const db=database(),quote=await getQuote(db),body=consent(quote),provider=bank({loseFirstPut:true});
 const first=await call(db,'checkout',body,{gateway:provider.gateway});assert.equal(first.status,502);assert.equal(first.body.state,'order_preserved');assert.equal(first.body.retrySameOrder,true);
 const orderId=first.body.orderId;assert.equal(db.tables.jenios_pay_orders.length,1);assert.equal(provider.charges.size,1);assert.equal(db.balance,0);
 // A bound order survives quote expiry without receiving a new price or txid.
 db.now=NOW+16*60_000;
 const retried=await call(db,'checkout',body,{gateway:provider.gateway});assert.equal(retried.status,200);assert.equal(retried.body.orderId,orderId);assert.equal(retried.body.credited,false);
 assert.equal(provider.calls.filter(row=>row.method==='PUT').length,1);assert.equal(provider.calls.filter(row=>row.method==='GET').length,2);
 assert.equal(db.tables.jenios_pay_orders.length,1);assert.equal(db.tables.jenios_pay_payments.length,1);assert.equal(db.tables[T.quoteOrders].length,1);assert.equal(db.balance,0);
});

test('B146 lost atomic-prepare responses and pauses after preparation retain recoverable orders without bank dispatch',async()=>{
 const db=database(),quote=await getQuote(db),body=consent(quote),provider=bank();db.failAfterPrepare=true;
 const lost=await call(db,'checkout',body,{gateway:provider.gateway});assert.equal(lost.status,503);assert.equal(lost.body.state,'order_unconfirmed');assert.equal(lost.body.requestKey,ORDER_KEY);assert.equal(provider.calls.length,0);assert.equal(db.tables.jenios_pay_orders.length,1);
 assert.equal((await call(db,'checkout',body,{gateway:provider.gateway})).status,200);assert.equal(provider.charges.size,1);assert.equal(db.tables.jenios_pay_orders.length,1);
 const paused=database(),q=await getQuote(paused);paused.afterPrepare=()=>{paused.tables[T.config][0].payments_enabled=false;};
 const blocked=await call(paused,'checkout',consent(q),{gateway:async()=>{throw Error('Paused sale must not dispatch');}});
 assert.equal(blocked.status,503);assert.equal(blocked.body.state,'order_preserved');assert.equal(paused.tables.jenios_pay_orders[0].status,'pending');assert.equal(paused.tables.jenios_pay_payments.length,0);
});

test('B146 actual Pix verification precedes funding, receipt retries are idempotent and another account cannot inspect the order',async()=>{
 const db=database(),quote=await getQuote(db),provider=bank();
 const checkout=await call(db,'checkout',consent(quote),{gateway:provider.gateway});assert.equal(checkout.status,200);const orderId=checkout.body.orderId;
 const options={pixClientFactory:()=>provider.client};
 let state=await call(db,'status',{orderId},options);assert.equal(state.body.state,'awaiting_payment');assert.equal(state.body.pixCode,'000201-test-code');assert.equal(db.balance,0);assert.equal(db.rpcs.filter(row=>row.name===R.fund).length,0);
 db.viewer=B;const calls=provider.calls.length;state=await call(db,'status',{orderId},options);assert.equal(state.status,404);assert.equal(provider.calls.length,calls);db.viewer=A;
 provider.pay(orderId);state=await call(db,'status',{orderId},options);assert.equal(state.status,200);assert.equal(state.body.credited,true);assert.equal(state.body.creditedNanoUsd,quote.retailNanoUsd);assert.equal(db.balance,quote.retailNanoUsd);
 const afterPaymentCalls=provider.calls.length;state=await call(db,'status',{orderId},options);assert.equal(state.body.replayed,true);assert.equal(provider.calls.length,afterPaymentCalls);assert.equal(db.balance,quote.retailNanoUsd);assert.equal(db.tables[T.funding].length,1);
});

test('B146 mismatched bank receipts and paid-without-receipt states cannot release credits',async()=>{
 const db=database(),quote=await getQuote(db),provider=bank();const checkout=await call(db,'checkout',consent(quote),{gateway:provider.gateway});const orderId=checkout.body.orderId;
 provider.pay(orderId);provider.charges.get(pixTxid(orderId)).pix[0].valor='1.00';
 const invalid=await call(db,'status',{orderId},{pixClientFactory:()=>provider.client});assert.equal(invalid.status,502);assert.equal(invalid.body.credited,false);assert.equal(db.balance,0);assert.equal(db.rpcs.filter(row=>row.name===R.fund).length,0);
 // Even a durable order status alone is insufficient; funding requires the
 // independently confirmed receipt and immutable quote/order binding.
 db.tables.jenios_pay_orders[0].status='paid';
 const pending=await call(db,'status',{orderId},{pixClientFactory:()=>provider.client});assert.equal(pending.status,202);assert.equal(pending.body.state,'paid_pending_credit');assert.equal(pending.body.credited,false);assert.equal(db.balance,0);
 const reads=db.reads,calls=provider.calls.length,rpcs=db.rpcs.length;
 const paused=await call(db,'status',{orderId},{env:{...env,JENIOS_PRO_PAYMENTS_ENABLED:'false'},pixClientFactory:()=>provider.client});assert.equal(paused.status,503);assert.equal(paused.body.credited,false);assert.equal(db.reads,reads);assert.equal(provider.calls.length,calls);assert.equal(db.rpcs.length,rpcs);
});


function catalogDatabase(){const db=database();Object.assign(db.tables[T.config][0],{commercial_terms_version:PRO_ADDON_TERMS,topup_amount_minor:null,monthly_budget_mode:'uncapped',monthly_provider_limit_nano_usd:0});return db;}
for(const pack of PRO_ADDON_PACKS)test('G46 approved '+pack.code+' quote, receipt, wallet and recovery use the same capacity',async()=>{
 const db=catalogDatabase(),transport=bank();
 const offer=await proTopupAvailability(db,proWalletConfig(db.tables[T.config][0],NOW),env);assert.equal(creditOfferReady(offer),true);
 const got=await call(db,'quote',{requestKey:KEY,packCode:pack.code});assert.equal(got.status,200,JSON.stringify(got.body));const q=got.body.quote;
 assert.equal(q.amountCents,pack.priceCents);assert.equal(q.baseAmountMinor,pack.providerCapacityBrlCents);
 assert.equal(q.retailNanoUsd,2*Number(BigInt(pack.providerCapacityBrlCents)*10000000000000n/BigInt(fx.brlMicrosPerUsd)));
 assert.equal(validCreditQuote(q,{offer,now:NOW}),true);
 for(const field of ['amountCents','retailNanoUsd','providerCapacityNanoUsd','providerCapacityBrlCents','baseAmountMinor'])assert.equal(validCreditQuote({...q,[field]:q[field]+1},{offer,now:NOW}),false,field);
 assert.ok(restoreCreditAttempt({requestKey:'12345678-1234-4123-8123-123456789abc',quote:q,orderId:null},{userId:A,now:NOW}));
 const created=await call(db,'checkout',consent(q),{gateway:transport.gateway});assert.equal(created.status,200,JSON.stringify(created.body));
 assert.equal(db.balance,0);transport.pay(created.body.orderId);
 const options={pixClientFactory:()=>transport.client};
 const paid=await call(db,'status',{orderId:created.body.orderId},options);assert.equal(paid.body.credited,true,JSON.stringify(paid.body));
 assert.equal(db.balance,q.retailNanoUsd);
 await call(db,'status',{orderId:created.body.orderId},options);assert.equal(db.balance,q.retailNanoUsd);
});
test('G46 global payment pause blocks every endpoint and availability before DB, FX or bank',async()=>{
 for(const gate of [undefined,'false','TRUE','1'])for(const action of ['quote','checkout','status']){
  const db=catalogDatabase(),result=await call(db,action,{}, {env:{...env,JENIOS_PAY_PAYMENTS_ENABLED:gate},fxLoader:()=>{throw Error('FX must not run');},gateway:()=>{throw Error('Bank must not run');}});
  assert.equal(result.status,503);assert.equal(result.body.code,'PRO_PAYMENTS_DISABLED');assert.equal(db.reads,0);assert.equal(db.writes,0);assert.equal(db.rpcs.length,0);
  assert.equal((await proTopupAvailability(db,proWalletConfig(db.tables[T.config][0],NOW),{...env,JENIOS_PAY_PAYMENTS_ENABLED:gate})).enabled,false);assert.equal(db.reads,0);
 }
});
test('G46 package choice is server-owned and an idempotency key cannot switch packages',async()=>{
 const db=catalogDatabase();
 for(const packCode of [undefined,null,'ia-1',{},'ia-500 '])assert.equal((await call(db,'quote',{requestKey:KEY,packCode})).status,400);
 assert.equal(db.writes,0);
 db.failAfterQuote=true;const first=await call(db,'quote',{requestKey:KEY,packCode:'ia-500'});assert.equal(first.status,200);assert.equal(first.body.replayed,true);
 const again=await call(db,'quote',{requestKey:KEY,packCode:'ia-500'},{fxLoader:()=>{throw Error('immutable quote must not refetch FX');}});assert.deepEqual(again.body.quote,first.body.quote);
 const conflict=await call(db,'quote',{requestKey:KEY,packCode:'ia-1000'});assert.equal(conflict.status,409);assert.equal(conflict.body.code,'IDEMPOTENCY_CONFLICT');assert.equal(db.tables[T.quotes].length,1);
 const row=db.tables[T.quotes][0];for(const patch of [{addon_pack_code:null},{base_amount_minor:1000},{amount_cents:500},{retail_nano_usd:row.retail_nano_usd+1},{terms_version:'legacy-terms'}])assert.throws(()=>projectProTopupQuote({...row,...patch},A,NOW));
});
