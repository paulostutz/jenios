import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIVERSITY_MONTHLY_PRODUCT as PRODUCT,UNIVERSITY_MONTHLY_TERMS as TERMS,UNIVERSITY_MONTHLY_TABLE as TABLE,UNIVERSITY_MONTHLY_RPC as RPC,universityMonthEnd,monthlyAccessFromEvidence,monthlyScheduledFromEvidence,verifiedMonthlyUniversity} from '../lib/assistant/university-monthly-access.mjs';
import {handleUniversitySubscription} from '../lib/assistant/university-subscription.mjs';
import {DEFAULT_PRODUCTS,normalizePurchase,priceUpdate} from '../lib/pay/catalog.mjs';
import {requireLearner} from '../lib/learning/access.mjs';

const A='b1470000-0000-4000-8000-000000000001',B='b1470000-0000-4000-8000-000000000002';
const O='b1470000-0000-4000-8000-000000000011',P='b1470000-0000-4000-8000-000000000012',I='b1470000-0000-4000-8000-000000000013';
const NOW=Date.parse('2026-10-20T12:00:00Z'),paid='2026-10-20T11:00:00Z',key='university-client-key-001';
const sku={id:P,code:PRODUCT,category:'other',price_cents:4990,currency:'BRL',billing_type:'monthly',active:true};
const env={JENIOS_PAY_PROVIDER:'inter_pix',JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_INTER_CHARGES_ENABLED:'true',INTER_CLIENT_ID:'fixture',INTER_CLIENT_SECRET:'fixture',INTER_CERTIFICATE:'fixture',INTER_PRIVATE_KEY:'fixture',INTER_PIX_KEY:'fixture'};
function evidence(){
 const order={id:O,user_id:A,product_id:P,provider:'inter_pix',amount_cents:4990,currency:'BRL',status:'paid',created_at:'2026-10-20T10:59:00Z',idempotency_key:'university:'+A+':'+key,external_reference:JSON.stringify({productCode:PRODUCT,scope:'social',termsVersion:TERMS,billingType:'monthly',renewalMode:'manual_pix',fingerprint:'university:'+A+':'+key})};
 const invoice={id:I,user_id:A,order_id:O,request_key:key,terms_version:TERMS,amount_cents:4990,currency:'BRL',status:'active',receipt_id:'receipt-a',paid_at:paid,period_start:paid,period_end:'2026-11-20T11:00:00Z',anchor_day:20,anchor_time:'08:00:00',created_at:order.created_at};
 const receipt={id:'receipt-a',order_id:O,provider:'inter_pix',payment_method:'pix',provider_payment_id:O.replaceAll('-',''),amount_cents:4990,status:'confirmed',confirmed_at:paid};
 return {invoice,order,receipt};
}
function database({active=false,includePlan=false,failTable=null}={}){
 const e=evidence(),tables={jenios_pay_products:[sku],jenios_pay_subscriptions:[],jenios_pay_entitlements:[],jenios_pay_orders:[],jenios_pay_payments:[],[TABLE]:[]};
 if(active){tables[TABLE].push(e.invoice);tables.jenios_pay_orders.push(e.order);tables.jenios_pay_payments.push(e.receipt);}
 if(includePlan){tables.jenios_pay_products.push({id:'plan',code:'platform-global-crypto',category:'platform'});tables.jenios_pay_subscriptions.push({id:'sub',user_id:A,product_id:'plan',status:'active',current_period_start:'2026-10-01T00:00:00Z',current_period_end:'2026-11-01T00:00:00Z'});}
 let viewer=A;const calls={gateway:0,status:0,prepare:0,confirm:0};
 const db={tables,calls,setViewer(v){viewer=v;},auth:{getUser:async()=>({data:{user:{id:viewer,app_metadata:{}}}})},from(table){
  const filters=[];let limit=Infinity,patch=null,sort=null;
  const execute=()=>{
   if(table===failTable)return {data:null,error:{code:'fixture'}};
   let selected=(tables[table]||[]).filter(row=>filters.every(f=>f(row)));
   if(patch)for(const row of selected)Object.assign(row,structuredClone(patch));
   if(sort)selected.sort((a,b)=>String(a[sort[0]]||'').localeCompare(String(b[sort[0]]||''))*(sort[1]?1:-1));
   return {data:structuredClone(selected.slice(0,limit)),error:null};
  };
  const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>Date.parse(r[k])>Date.parse(v));return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},limit(n){limit=n;return q;},order(k,{ascending=true}={}){sort=[k,ascending];return q;},update(v){patch=v;return q;},then(ok,bad){return Promise.resolve(execute()).then(ok,bad);},async maybeSingle(){const r=execute();return {...r,data:r.data?.[0]||null};}};return q;
 },async rpc(name,args){
  if(name===RPC.prepare){calls.prepare++;
   let invoice=tables[TABLE].find(row=>row.user_id===args.p_user_id&&(row.request_key===args.p_request_key||row.status==='pending'));
   const replayed=Boolean(invoice);
   if(!invoice){
    invoice={...e.invoice,request_key:args.p_request_key,status:'pending',receipt_id:null,paid_at:null,period_start:null,period_end:null};
    const order={...e.order,status:'pending',idempotency_key:'university:'+A+':'+args.p_request_key,external_reference:JSON.stringify({...JSON.parse(e.order.external_reference),fingerprint:'university:'+A+':'+args.p_request_key})};
    tables[TABLE].push(invoice);tables.jenios_pay_orders.push(order);
   }
   return {data:{ok:true,replayed,invoice:structuredClone(invoice),order:structuredClone(tables.jenios_pay_orders.find(o=>o.id===invoice.order_id))}};
  }
  if(name===RPC.confirm){calls.confirm++;
   const invoice=tables[TABLE].find(row=>row.user_id===args.p_user_id&&row.order_id===args.p_order_id),order=tables.jenios_pay_orders.find(o=>o.id===args.p_order_id),receipt=tables.jenios_pay_payments.find(p=>p.order_id===args.p_order_id&&p.status==='confirmed'&&p.amount_cents===4990);
   if(!invoice||order?.status!=='paid'||!receipt)return {data:{ok:false,code:'PAYMENT_NOT_CONFIRMED'}};
   if(invoice.status==='active')return {data:{ok:true,replayed:true,invoice:structuredClone(invoice)}};
   Object.assign(invoice,{...e.invoice,request_key:invoice.request_key});return {data:{ok:true,invoice:structuredClone(invoice)}};
  }
  throw Error('Unexpected RPC');
 }};
 return db;
}
const request=(action,body,orderId=O)=>new Request('https://qa.invalid/api/assistant/university/'+action+(action==='status'?'?orderId='+orderId:''),{method:body?'POST':'GET',headers:{authorization:'Bearer fixture-only',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const consent=(extra={})=>({requestKey:key,acceptTerms:true,amountCents:4990,currency:'BRL',termsVersion:TERMS,...extra});
const options=db=>({db,env,now:NOW,gateway:async payload=>{db.calls.gateway++;assert.equal(payload.billing_type,'one_time');assert.equal(payload.amount_cents,4990);return {checkoutUrl:'/social/pagamento?pedido='+payload.orderId};},paymentStatus:async()=>{db.calls.status++;return {orderId:O,status:'awaiting_payment',amount_cents:4990,currency:'BRL',pixCode:'000201fixture',expiresAt:'2026-10-20T13:00:00Z'};},pixClientFactory:()=>({})});

test('B147 monthly billing clamps short months and preserves the original day/time across renewal',()=>{
 assert.equal(universityMonthEnd('2026-01-31T15:30:00Z',31,'12:30:00'),'2026-02-28T15:30:00.000Z');
 assert.equal(universityMonthEnd('2026-02-28T15:30:00Z',31,'12:30:00'),'2026-03-31T15:30:00.000Z');
 assert.equal(universityMonthEnd('2028-01-31T15:30:00Z',31,'12:30:00'),'2028-02-29T15:30:00.000Z');
 assert.equal(universityMonthEnd('2026-12-31T23:00:00Z',31,'20:00:00'),'2027-01-31T23:00:00.000Z');
 assert.throws(()=>universityMonthEnd(paid,0,'08:00:00'));assert.throws(()=>universityMonthEnd(paid,20,'99:00:00'));
});
test('B147 independent monthly SKU is fixed at approved BRL49.90 and cannot bypass dedicated checkout',()=>{
 const product=DEFAULT_PRODUCTS.find(p=>p.code===PRODUCT);assert.equal(product.price_cents,4990);assert.equal(product.billing_type,'monthly');
 assert.throws(()=>normalizePurchase({},product,'social'),/contratação mensal/);
 assert.throws(()=>priceUpdate({code:PRODUCT,price_cents:5000,active:true}),/49,90/);
 assert.equal(priceUpdate({code:PRODUCT,price_cents:4990,active:false}).active,false);
 assert.equal(DEFAULT_PRODUCTS.find(p=>p.code==='social-university-pass').active,false);
});
test('B147 paid month requires owner, matching durable receipt, exact price and unaltered monthly interval',()=>{
 const e=evidence(),project=(x=e)=>monthlyAccessFromEvidence([x.invoice],[x.order],[x.receipt],A,P,NOW);
 assert.equal(project().validUntil,'2026-11-20T11:00:00.000Z');
 for(const [which,k,v] of [['invoice','user_id',B],['invoice','amount_cents',4991],['invoice','period_end','2027-01-20T11:00:00Z'],['order','status','refunded'],['order','user_id',B],['receipt','status','refunded'],['receipt','amount_cents',4900],['receipt','provider_payment_id','wrong'],['receipt','confirmed_at','2026-10-20T11:01:00Z']]){const x=structuredClone(e);x[which][k]=v;assert.equal(project(x),null,which+'.'+k);}
 assert.equal(monthlyAccessFromEvidence([e.invoice],[e.order],[e.receipt],A,P,Date.parse(e.invoice.period_end)),null);
});
test('B147 future paid renewals extend only contiguous access; a refunded gap is never crossed',()=>{
 const e=evidence(),renew=structuredClone(e);renew.invoice.order_id='b1470000-0000-4000-8000-000000000099';renew.order.id=renew.invoice.order_id;renew.receipt.order_id=renew.order.id;renew.invoice.receipt_id='receipt-b';renew.receipt.id='receipt-b';renew.receipt.provider_payment_id=renew.order.id.replaceAll('-','');
 renew.invoice.period_start=e.invoice.period_end;renew.invoice.period_end='2026-12-20T11:00:00Z';
 assert.equal(monthlyAccessFromEvidence([e.invoice,renew.invoice],[e.order,renew.order],[e.receipt,renew.receipt],A,P,NOW).validUntil,'2026-12-20T11:00:00.000Z');
 assert.equal(monthlyAccessFromEvidence([renew.invoice],[renew.order],[renew.receipt],A,P,NOW),null);
 assert.equal(monthlyScheduledFromEvidence([renew.invoice],[renew.order],[renew.receipt],A,P,NOW).startsAt,'2026-11-20T11:00:00.000Z');
});
test('B147 a paid future month after a refund gap is shown as scheduled and blocks another purchase',async()=>{
 const db=database({active:true}),base=evidence(),renew=structuredClone(base),renewId='b1470000-0000-4000-8000-000000000099';
 db.tables.jenios_pay_orders[0].status='refunded';renew.invoice.id='future-invoice';renew.invoice.order_id=renewId;renew.order.id=renewId;renew.receipt.order_id=renewId;renew.receipt.id='receipt-b';renew.invoice.receipt_id='receipt-b';renew.receipt.provider_payment_id=renewId.replaceAll('-','');
 renew.invoice.period_start=base.invoice.period_end;renew.invoice.period_end='2026-12-20T11:00:00Z';
 db.tables[TABLE].push(renew.invoice);db.tables.jenios_pay_orders.push(renew.order);db.tables.jenios_pay_payments.push(renew.receipt);
 let response=await handleUniversitySubscription(request('access'),{action:'access',...options(db)}),body=await response.json();
 assert.equal(body.access.active,false);assert.equal(body.canPurchase,false);assert.equal(body.scheduled.startsAt,'2026-11-20T11:00:00.000Z');
 response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)});body=await response.json();assert.equal(response.status,409);assert.equal(body.code,'FUTURE_PAID_PERIOD');assert.equal(db.calls.gateway,0);
 response=await handleUniversitySubscription(request('status',null,renewId),{action:'status',...options(db)});body=await response.json();assert.equal(response.status,200);assert.equal(body.state,'scheduled');assert.equal(body.status,'paid');assert.equal(body.scheduled.orderId,renewId);assert.equal(body.access.active,false);
});
test('B147 monthly entitlement works in the existing learner gate without granting Pro credits',async()=>{
 const db=database({active:true});const access=await verifiedMonthlyUniversity(db,A,NOW);assert.equal(access.kind,'university-monthly');
 const learner=await requireLearner(request('access'),db,NOW,{});assert.equal(learner.access.productCode,PRODUCT);
 db.setViewer(B);await assert.rejects(requireLearner(request('access'),db,NOW,{}),{status:402});
 assert.equal(db.calls.gateway,0);
});
test('B147 guest and anonymous requests cannot reach the catalog, bank or ledger',async()=>{
 for(const authorize of [async()=>null,async()=>({id:A,is_anonymous:true})]){let touched=0;const response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',db:{from(){touched++;throw Error();}},authorize,env,now:NOW});assert.equal(response.status,401);assert.equal(touched,0);}
});
test('B147 wrong price, currency, terms, missing consent and unknown fields never create a charge',async()=>{
 for(const patch of [{amountCents:499},{currency:'USD'},{termsVersion:'old'},{acceptTerms:false},{userId:B}]){
  const db=database();const response=await handleUniversitySubscription(request('checkout',consent(patch)),{action:'checkout',...options(db)});
  assert.equal(response.status,400);assert.equal(db.calls.prepare,0);assert.equal(db.calls.gateway,0);
 }
});
test('B147 included plans and admin preview cannot be double-charged for University',async()=>{
 const db=database({includePlan:true});let response=await handleUniversitySubscription(request('access'),{action:'access',...options(db)}),body=await response.json();
 assert.equal(body.access.included,true);assert.equal(body.canPurchase,false);
 response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)});assert.equal(response.status,409);assert.equal(db.calls.prepare,0);
 const admin=database();response=await handleUniversitySubscription(request('access'),{action:'access',...options(admin),env:{...env,JENIOS_ADMIN_MASTER_USER_IDS:A}});body=await response.json();assert.equal(body.access.kind,'admin-preview');assert.equal(body.canPurchase,false);
});
test('B147 non-subscribers can consent once, reload pending order, and resume the same Pix without duplication',async()=>{
 const db=database();let response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.state,'awaiting_payment');assert.equal(body.amountCents,4990);assert.equal(db.calls.gateway,1);
 response=await handleUniversitySubscription(request('checkout',consent({requestKey:'another-browser-key-002'})),{action:'checkout',...options(db)});body=await response.json();assert.equal(body.orderId,O);assert.equal(body.requestKey,key);assert.equal(db.calls.gateway,1);assert.equal(db.tables.jenios_pay_orders.length,1);
 response=await handleUniversitySubscription(request('access'),{action:'access',...options(db)});body=await response.json();assert.equal(body.order.orderId,O);assert.equal(body.order.requestKey,key);assert.equal(body.offer.renewalMode,'manual_pix');
});
test('B147 lost bank response preserves order and retries only its same deterministic reference',async()=>{
 const db=database(),seen=[];const gateway=async p=>{seen.push(p.orderId);if(seen.length===1)throw Object.assign(Error('fixture transport'),{status:502});return {checkoutUrl:'/social/pagamento?pedido='+p.orderId};};
 let response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db),gateway});let body=await response.json();assert.equal(response.status,502);assert.equal(body.orderId,O);assert.equal(body.retrySameOrder,true);
 response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db),gateway});assert.equal(response.status,200);assert.deepEqual(seen,[O,O]);assert.equal(db.tables.jenios_pay_orders.length,1);
});
test('B147 pending payment never unlocks education, and another account cannot inspect its status',async()=>{
 const db=database();await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)});
 let response=await handleUniversitySubscription(request('status'),{action:'status',...options(db)});let body=await response.json();assert.equal(body.state,'awaiting_payment');assert.equal(body.access.active,false);assert.equal(db.calls.confirm,0);
 db.setViewer(B);response=await handleUniversitySubscription(request('status'),{action:'status',...options(db)});assert.equal(response.status,404);assert.equal(db.calls.status,1);
});
test('B147 a paid order with missing proof stays pending access; a verified receipt activates without another bank call',async()=>{
 const db=database();await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)});db.tables.jenios_pay_orders[0].status='paid';
 let response=await handleUniversitySubscription(request('status'),{action:'status',...options(db)});let body=await response.json();assert.equal(response.status,202);assert.equal(body.state,'paid_pending_access');assert.equal(db.calls.status,0);
 db.tables.jenios_pay_payments.push(evidence().receipt);response=await handleUniversitySubscription(request('status'),{action:'status',...options(db)});body=await response.json();assert.equal(response.status,200);assert.equal(body.state,'active');assert.equal(body.access.active,true);assert.equal(db.calls.gateway,1);
});
test('B147 receipt-backed paid access survives a sales pause but new purchases are blocked',async()=>{
 const db=database({active:true});db.tables.jenios_pay_products[0].active=false;
 let response=await handleUniversitySubscription(request('access'),{action:'access',...options(db)}),body=await response.json();assert.equal(body.offer.available,false);assert.equal(body.access.active,true);
 response=await handleUniversitySubscription(request('checkout',consent()),{action:'checkout',...options(db)});assert.equal(response.status,503);assert.equal(db.calls.gateway,0);
});
test('B147 missing database evidence fails closed with no bank dispatch',async()=>{
 const db=database({active:true,failTable:'jenios_pay_payments'});const response=await handleUniversitySubscription(request('access'),{action:'access',...options(db)});assert.equal(response.status,503);assert.equal(db.calls.gateway,0);
});
