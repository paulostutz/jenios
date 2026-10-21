import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 attestVerifiedPlatformB290,verifiedPlatformEvidenceB290,B290_STRICT_QA_FLAG
} from '../lib/assistant/verified-subscription-b290.mjs';
import {verifiedPlatformPlan,proPlanAccess} from '../lib/assistant/pro-access.mjs';
const NOW=Date.parse('2026-10-21T19:00:00Z'),DAY=86400000;
const u='00000000-0000-4000-8000-000000000101';
const sid='00000000-0000-4000-8000-000000000102';
const oid='00000000-0000-4000-8000-000000000103';
const productId='00000000-0000-4000-8000-000000000104';
const at=x=>new Date(x).toISOString();
const start=NOW-DAY,end=NOW+29*DAY;
function pack(){
 return {
  subscription:{id:sid,user_id:u,product_id:productId,latest_order_id:oid,
   status:'active',cancel_at_period_end:false,current_period_start:at(start),current_period_end:at(end)},
  product:{id:productId,code:'platform-global-crypto',category:'platform'},
  order:{id:oid,user_id:u,product_id:productId,status:'paid',provider:'inter_pix',
   currency:'BRL',amount_cents:14990,created_at:at(start-3600000)},
  receipts:[{id:'r1',order_id:oid,status:'confirmed',provider:'inter_pix',payment_method:'pix',
   amount_cents:14990,provider_payment_id:oid.replaceAll('-',''),
   bank_end_to_end_id:'E'+'A'.repeat(31),confirmed_at:at(start)}],userId:u,now:NOW
 };
}
function mockDb(evidence){
 const rows={...evidence};
 let queries=[];
 const db={
  from(table){
   const q={table,columns:null,where:{},
    select(columns){this.columns=columns;return this},
    eq(key,value){this.where[key]=value;return this},
    in(){return this},
    order(){return this},
    maybeSingle:async function(){
     queries.push({table,columns:this.columns,where:this.where});
     if(table==='jenios_pay_subscriptions')return {data:rows.subscription,error:null};
     if(table==='jenios_pay_orders')return {data:rows.order,error:null};
     return {data:null,error:null};
    },
    limit:async function(){
     queries.push({table,columns:this.columns,where:this.where});
     if(table==='jenios_pay_subscriptions')return {data:[rows.subscription],error:null};
     if(table==='jenios_pay_products')return {data:[rows.product],error:null};
     if(table==='jenios_pay_payments')return {data:rows.receipts,error:null};
     return {data:[],error:null};
    }
   };
   return q;
  }
 };
 return {db,queries};
}
test('B290 a confirmed real-shaped receipt and same-user current subscription is required',()=>{
 const e=pack(),r=attestVerifiedPlatformB290(e);
 assert.equal(r.verified,true);assert.equal(r.planCode,'platform-global-crypto');
 assert.equal(r.userId,u);assert.equal(r.chargesCreated,0);
 assert.equal(r.subscriptionWritten,false);
 assert.equal(r.realBankAuthenticatedByThisCheck,false);
});
test('B290 an active subscription without confirmed provider receipt NEVER grants Pro',()=>{
 const e=pack();e.receipts=[];
 assert.equal(attestVerifiedPlatformB290(e).verified,false);
 assert.equal(attestVerifiedPlatformB290({...e,receipts:[{...pack().receipts[0],status:'pending'}]}).verified,false);
 assert.equal(attestVerifiedPlatformB290({...e,receipts:[{...pack().receipts[0],bank_end_to_end_id:null}]}).verified,false);
});
test('B290 IDs, payment owner and product binding must be identical',()=>{
 const e=pack();
 for(const patch of [
  {userId:'00000000-0000-4000-8000-000000000105'},
  {subscription:{...e.subscription,user_id:'00000000-0000-4000-8000-000000000105'}},
  {order:{...e.order,user_id:'00000000-0000-4000-8000-000000000105'}},
  {subscription:{...e.subscription,latest_order_id:'00000000-0000-4000-8000-000000000105'}},
  {order:{...e.order,product_id:'00000000-0000-4000-8000-000000000105'}},
  {product:{...e.product,code:'social-university-monthly'}},
  {product:{...e.product,category:'other'}}
 ])assert.equal(attestVerifiedPlatformB290({...e,...patch}).verified,false);
});
test('B290 price, Pix provider, txid and bank end-to-end are checked together',()=>{
 const e=pack(),receipt=e.receipts[0];
 for(const change of [
  {order:{...e.order,amount_cents:9900}},
  {order:{...e.order,status:'awaiting_payment'}},
  {order:{...e.order,provider:'not_inter'}},
  {order:{...e.order,currency:'USD'}},
  {receipts:[{...receipt,amount_cents:0}]},
  {receipts:[{...receipt,provider:'another_gateway'}]},
  {receipts:[{...receipt,payment_method:'credits'}]},
  {receipts:[{...receipt,provider_payment_id:'made-up'}]},
  {receipts:[{...receipt,bank_end_to_end_id:'E123'}]}
 ])assert.equal(attestVerifiedPlatformB290({...e,...change}).verified,false);
});
test('B290 cancellation, expiration and non-current periods deny QA access',()=>{
 const e=pack();
 for(const c of [
  {subscription:{...e.subscription,status:'cancelled'}},
  {subscription:{...e.subscription,status:'past_due'}},
  {subscription:{...e.subscription,status:'trialing'}},
  {subscription:{...e.subscription,current_period_end:at(NOW)}},
  {subscription:{...e.subscription,current_period_start:at(NOW+1000)}},
  {subscription:{...e.subscription,current_period_end:at(NOW+90*DAY)}}
 ])assert.equal(attestVerifiedPlatformB290({...e,...c}).verified,false);
});
test('B290 stale, future and reused receipts fail even when subscription row says active',()=>{
 const e=pack(),r=e.receipts[0];
 for(const changed of [
  {receipts:[{...r,confirmed_at:at(NOW+3600000)}]},
  {receipts:[{...r,confirmed_at:at(start-40*DAY)}]},
  {receipts:[{...r,confirmed_at:at(start-3*3600000)}]},
  {order:{...e.order,created_at:at(start-30*DAY)}},
  {order:{...e.order,created_at:at(NOW+3600000)}}
 ])assert.equal(attestVerifiedPlatformB290({...e,...changed}).verified,false);
});
test('B290 strict DB adapter requires ownership-filtered reads and no writes',async()=>{
 const evidence=pack(),{db,queries}=mockDb(evidence);
 const r=await verifiedPlatformEvidenceB290(db,u,{
  code:evidence.product.code,productId,subscriptionId:sid
 },NOW);
 assert.equal(r.verified,true);assert.equal(queries.length,3);
 assert.equal(queries[0].where.user_id,u);
 assert.equal(queries[1].where.user_id,u);
 assert.equal(queries[2].where.order_id,oid);
 assert.ok(queries.every(q=>q.table.startsWith('jenios_pay_')));
});
test('B290 verifiedPlatformPlan strict mode drops pending or unconfirmed subscription',async()=>{
 const e=pack();
 const validDb=mockDb(e).db;
 const valid=await verifiedPlatformPlan(validDb,u,NOW,{strict:true});
 assert.equal(valid?.code,'platform-global-crypto');
 assert.equal(valid?.qaReceiptWitnessed,true);
 const bad=mockDb({...e,receipts:[]}).db;
 assert.equal(await verifiedPlatformPlan(bad,u,NOW,{strict:true}),null);
});
test('B290 strict evidence never changes national user into advanced',async()=>{
 const e=pack();
 e.product.code='platform-nacional';
 e.order.amount_cents=9990;
 e.receipts[0].amount_cents=9990;
 const p=await verifiedPlatformPlan(mockDb(e).db,u,NOW,{strict:true});
 assert.equal(p.code,'platform-nacional');
 assert.equal(proPlanAccess(p,null,{}).proIncluded,false);
});
test('B290 production normal path remains unchanged unless QA flag explicitly enabled',async()=>{
 const e=pack(),mock=mockDb({...e,receipts:[]});
 const existing=await verifiedPlatformPlan(mock.db,u,NOW,{strict:false});
 assert.equal(existing.code,'platform-global-crypto');
 assert.equal(existing.qaReceiptWitnessed,undefined);
 assert.equal(B290_STRICT_QA_FLAG,'JENIOS_QA_STRICT_SUBSCRIPTION_PROOF');
 const src=readFileSync(new URL('../lib/assistant/pro-access.mjs',import.meta.url),'utf8');
 assert.match(src,/JENIOS_QA_STRICT_SUBSCRIPTION_PROOF==='true'/);
 assert.match(src,/verifiedPlatformEvidenceB290/);
});
test('B290 QA proof module has no external provider calls, payment writes or JWT claims',()=>{
 const src=readFileSync(new URL('../lib/assistant/verified-subscription-b290.mjs',import.meta.url),'utf8');
 for(const forbidden of ['fetch(', 'XMLHttpRequest', '.insert(', '.update(', '.delete(', '.rpc(', 'api.openai', 'api.binance', 'api.alpaca', 'user_metadata']) assert.equal(src.includes(forbidden),false,forbidden);
 assert.match(src,/bank_end_to_end_id/);assert.match(src,/status==='confirmed'/);
});
