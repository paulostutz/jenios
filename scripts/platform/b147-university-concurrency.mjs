/** Real PostgreSQL races for monthly education. Disposable local CI fixture only.
 * No bank, model, real account, customer order or production database is used.
 */
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {monthlyAccessFromEvidence,UNIVERSITY_MONTHLY_TERMS} from '../../lib/assistant/university-monthly-access.mjs';

const psql=sql=>new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1'],{env:process.env,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
 child.on('error',reject);child.on('close',code=>code===0?resolve(stdout.trim()):reject(Error('University PostgreSQL fixture failed: '+stderr.slice(0,2500))));
 child.stdin.end(sql);
});
assert.equal(await psql('SELECT current_database();'),'jenios_pro_b143_test','Only the disposable CI database is allowed.');
const member='b1470000-0000-4000-8000-000000000201',other='b1470000-0000-4000-8000-000000000202';
await psql(`INSERT INTO auth.users(id) VALUES('${member}'),('${other}');`);
const productId=await psql("SELECT id FROM public.jenios_pay_products WHERE code='social-university-monthly';");
assert.match(productId,/^[0-9a-f-]{36}$/);
const prepare=(user,key)=>psql(`SET ROLE service_role;SELECT public.jenios_university_prepare_b147('${user}','${key}','${UNIVERSITY_MONTHLY_TERMS}');`).then(JSON.parse);
const confirm=(user,order)=>psql(`SET ROLE service_role;SELECT public.jenios_university_confirm_b147('${user}','${order}');`).then(JSON.parse);
const created=await Promise.all([
 prepare(member,'monthly-race-same-0001'),prepare(member,'monthly-race-same-0001'),
 prepare(member,'monthly-race-other-0002'),prepare(member,'monthly-race-other-0003')
]);
assert.ok(created.every(value=>value.ok===true));
assert.equal(created.filter(value=>value.replayed===false).length,1,'Only one simultaneous request creates an invoice.');
const firstId=created[0].order.id;
assert.ok(created.every(value=>value.order.id===firstId),'Different keys and tabs resume the same pending Pix.');
let count=JSON.parse(await psql(`SELECT jsonb_build_object('orders',(SELECT count(*) FROM public.jenios_pay_orders WHERE user_id='${member}'),'pending',(SELECT count(*) FROM public.jenios_university_invoices_b147 WHERE user_id='${member}' AND status='pending'));`));
assert.deepEqual(count,{orders:1,pending:1});
assert.equal((await confirm(other,firstId)).code,'ORDER_NOT_FOUND','Another member cannot claim this order.');
assert.equal((await confirm(member,firstId)).code,'PAYMENT_NOT_CONFIRMED','A pending order grants no study access.');

async function paid(order){
 await psql(`UPDATE public.jenios_pay_orders SET status='paid' WHERE id='${order}';
 INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES('${order}','inter_pix',replace('${order}','-',''),'pix',4990,'confirmed',now());`);
}
await paid(firstId);
const settled=await Promise.all([confirm(member,firstId),confirm(member,firstId)]);
assert.ok(settled.every(value=>value.ok===true));
assert.equal(settled.filter(value=>value.replayed===false).length,1,'Concurrent payment confirmation grants one period.');
assert.equal(settled.filter(value=>value.replayed===true).length,1);
assert.equal(settled[0].invoice.period_end,settled[1].invoice.period_end);
const first=settled[0].invoice;

const renewals=await Promise.all([prepare(member,'monthly-renew-race-01'),prepare(member,'monthly-renew-race-02')]);
assert.ok(renewals.every(value=>value.ok===true));
assert.equal(renewals[0].order.id,renewals[1].order.id);
assert.notEqual(renewals[0].order.id,firstId);
const secondId=renewals[0].order.id;
await paid(secondId);
const renewed=await Promise.all([confirm(member,secondId),confirm(member,secondId)]);
assert.ok(renewed.every(value=>value.ok===true));
assert.equal(renewed.filter(value=>value.replayed===false).length,1);
const second=renewed[0].invoice;
assert.equal(second.period_start,first.period_end,'Early renewal starts after the already-paid month.');
assert.equal(second.anchor_day,first.anchor_day);
assert.equal(second.anchor_time,first.anchor_time);
assert.ok(Date.parse(second.period_end)>Date.parse(first.period_end));
count=JSON.parse(await psql(`SELECT jsonb_build_object('orders',(SELECT count(*) FROM public.jenios_pay_orders WHERE user_id='${member}'),'active',(SELECT count(*) FROM public.jenios_university_invoices_b147 WHERE user_id='${member}' AND status='active'),'pending',(SELECT count(*) FROM public.jenios_university_invoices_b147 WHERE user_id='${member}' AND status='pending'));`));
assert.deepEqual(count,{orders:2,active:2,pending:0});
const evidence=()=>psql(`SELECT jsonb_build_object('invoices',(SELECT jsonb_agg(i) FROM public.jenios_university_invoices_b147 i WHERE user_id='${member}'),'orders',(SELECT jsonb_agg(o) FROM public.jenios_pay_orders o WHERE user_id='${member}'),'receipts',(SELECT jsonb_agg(p) FROM public.jenios_pay_payments p JOIN public.jenios_pay_orders o ON o.id=p.order_id WHERE o.user_id='${member}'));`).then(JSON.parse);
let e=await evidence();
assert.equal(monthlyAccessFromEvidence(e.invoices,e.orders,e.receipts,member,productId).validUntil,new Date(second.period_end).toISOString());
await psql(`UPDATE public.jenios_pay_orders SET status='refunded' WHERE id='${firstId}';`);
e=await evidence();
assert.equal(monthlyAccessFromEvidence(e.invoices,e.orders,e.receipts,member,productId),null,'A refunded current month cannot bridge access into a future paid renewal.');
const blocked=await prepare(member,'monthly-gap-no-upsell-01');
assert.equal(blocked.code,'FUTURE_PAID_PERIOD','A paid future month blocks a misleading new purchase during a refunded access gap.');
assert.equal(await psql(`SELECT count(*) FROM public.jenios_pay_orders WHERE user_id='${member}';`),'2','The access gap creates no third order.');
assert.equal((await confirm(member,firstId)).code,'PAYMENT_NOT_CONFIRMED');
assert.equal(monthlyAccessFromEvidence(e.invoices,e.orders,e.receipts,other,productId),null,'The other member never inherits these periods.');
console.log('B147_UNIVERSITY_CONCURRENCY_PASS: single pending invoice across keys, single paid period, preserved renewal anchor, refund and owner isolation. Disposable fixture only.');
