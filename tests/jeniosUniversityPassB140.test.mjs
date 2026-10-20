import test from 'node:test';
import assert from 'node:assert/strict';
import {claimVerifiedUniversityPass,UNIVERSITY_PASS_DAYS} from '../lib/assistant/university-pass.mjs';
import {readFileSync} from 'node:fs';
const user='11111111-1111-4111-8111-111111111111';
const order='22222222-2222-4222-8222-222222222222';
const now=Date.parse('2026-10-20T12:00:00Z');
function mock({paid=true,confirmed=true,amount=3990,wrongUser=false,already=false}={}){
 let writes=0;
 const sku={id:'product',code:'social-university-pass',category:'other'};
 const sale={id:order,user_id:wrongUser?'other':user,product_id:sku.id,amount_cents:amount,
  currency:'BRL',status:paid?'paid':'pending',created_at:'2026-10-20T10:00:00Z'};
 const receipt={order_id:order,amount_cents:amount,status:confirmed?'confirmed':'pending',
  provider_payment_id:'bank-proof-1',confirmed_at:'2026-10-20T10:01:00Z'};
 const db={from(table){const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},
  limit:async()=>({data:table==='jenios_pay_products'?[sku]:table==='jenios_pay_orders'?[sale]:table==='jenios_pay_payments'?[receipt]:[],error:null}),
  maybeSingle:async()=>({data:already?{id:'entitlement',status:'revoked'}:null,error:null}),
  upsert:async()=>{writes++;return {error:null};}
 };return q;}};
 return {db,getWrites:()=>writes};
}
test('B140 30-day University pass requires a matching paid order and confirmed bank receipt',async()=>{
 const a=mock();assert.equal(await claimVerifiedUniversityPass(a.db,user,now),true);assert.equal(a.getWrites(),1);
 assert.equal(UNIVERSITY_PASS_DAYS,30);
 for(const opts of [{paid:false},{confirmed:false},{wrongUser:true},{already:true}]){
  const b=mock(opts);assert.equal(await claimVerifiedUniversityPass(b.db,user,now),false);assert.equal(b.getWrites(),0);
 }
});
test('B140 paid add-on is inactive and has no invented price until Master configures JENIOS PAY',()=>{
 const catalog=readFileSync('lib/pay/catalog.mjs','utf8');
 assert.match(catalog,/code:'social-university-pass'/);
 assert.match(catalog,/price_cents:0, billing_type:'one_time', active:false/);
 const sql=readFileSync('supabase/migrations/20261020031500_university_addon_b140_REVIEW_ONLY.sql','utf8');
 assert.match(sql,/ON CONFLICT\(code\) DO NOTHING/);
 assert.match(sql,/one_time',false/);
});
test('B140 reading an entitlement always rechecks associated order paid status',()=>{
 const data=readFileSync('lib/assistant/pro-access.mjs','utf8');
 assert.match(data,/order\.data\?\.status==='paid'/);
 assert.match(data,/\.eq\('user_id',userId\)/);
});
