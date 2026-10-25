/** G47: actual isolated PostgreSQL tests; refuses hosted or nonempty databases. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G47_MONTHLY_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G47_MONTHLY_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G47_MONTHLY_TEST_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)
 ||target.search||target.hash||!/^jenios_platform_g47_monthly_[a-z0-9_]+$/.test(dbName))
 throw Error('G47_MONTHLY_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432',
 '--username',decodeURIComponent(target.username||'postgres'),'--dbname',dbName,
 '--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',
 PGPASSFILE:'/tmp/jenios-g47-monthly-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',
 PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source,onOutput=null){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;if(onOutput)onOutput(out);});
 child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G47_MONTHLY_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G47_MONTHLY_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
const literal=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const json=source=>sql(source).then(JSON.parse);
const file=async path=>sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')")));
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing nonempty database');
console.log('G47_POSTGRES_VERSION '+await sql('SHOW server_version'));
for(const path of ['tests/sql/jenios-assistant-conversations-g43-fixture.sql','supabase/migrations/20261012_jenios_pay_v1.sql','supabase/migrations/20261015212117_inter_pix_confirmation_r21.sql'])await file(path);
const original=await sql("SELECT pg_get_functiondef('public.jenios_confirm_inter_pix(uuid,text,integer,text,timestamptz)'::regprocedure)");
const migration='supabase/migrations/'+(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(n=>n.endsWith('_jenios_platform_monthly_pix_g47.sql'));
await file(migration);
assert.equal(await sql("SELECT pg_get_functiondef('public.jenios_confirm_inter_pix(uuid,text,integer,text,timestamptz)'::regprocedure)"),original);
for(const table of ['jenios_pay_orders','jenios_pay_payments','jenios_pay_subscriptions','jenios_platform_payers_g47','jenios_platform_invoices_g47'])assert.equal(await sql('SELECT count(*) FROM public.'+table),'0');
assert.equal(await sql('SELECT payments_enabled FROM public.jenios_platform_billing_config_g47'),'f');
for(const role of ['anon','authenticated']){
 assert.equal(await sql(`SELECT has_table_privilege('${role}','public.jenios_platform_invoices_g47','SELECT')`),'f');
 assert.equal(await sql(`SELECT has_function_privilege('${role}','public.jenios_platform_confirm_pix_g47(uuid,text,integer,text,timestamptz)','EXECUTE')`),'f');
}
const A='47000000-0000-4000-8000-000000000001',B='47000000-0000-4000-8000-000000000002',P='47000000-0000-4000-8000-000000000003';
await sql(`INSERT INTO auth.users(id,email) VALUES('${A}','g47-a@example.invalid'),('${B}','g47-b@example.invalid');
GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_orders TO service_role;`);
const link=(user=A,platform=P)=>json(`SET ROLE service_role; SELECT public.jenios_platform_link_g47('${user}','${platform}')`);
assert.equal((await link()).ok,true);assert.equal((await link()).ok,true);assert.equal((await link(B)).code,'LINK_CONFLICT');
const prepareSql=(key='g47_monthly_key_0001',code='platform-global-crypto',amount=14990,user=A)=>`SET ROLE service_role; SELECT public.jenios_platform_prepare_g47('${user}','${P}',${literal(code)},${amount},${literal(key)},'platform-monthly-manual-2026-10-24')`;
assert.equal((await json(prepareSql())).code,'PAYMENTS_PAUSED');
await sql('UPDATE public.jenios_platform_billing_config_g47 SET payments_enabled=true');
assert.equal((await json(prepareSql('g47_monthly_key_0001','platform-global-crypto',1))).code,'PRICE_CHANGED');
assert.equal((await json(prepareSql('g47_monthly_key_0001','platform-global-crypto',14990,B))).code,'LINK_REQUIRED');
const race=await Promise.all([1,2].map(()=>json(prepareSql())));
assert.equal(race[0].ok,true);assert.equal(race[0].order.id,race[1].order.id);assert.equal(race.filter(x=>x.replayed).length,1);
const first=race[0],orderId=first.order.id,invoiceId=first.invoice.id;
assert.equal((await json(prepareSql('g47_another_browser_01'))).order.id,orderId);
assert.equal((await json(prepareSql('g47_another_browser_02','platform-nacional',9990))).code,'PENDING_ORDER_EXISTS');
assert.equal((await json(prepareSql('g47_monthly_key_0001','platform-nacional',9990))).code,'IDEMPOTENCY_CONFLICT');
await sql("UPDATE public.jenios_pay_products SET price_cents=15000 WHERE code='platform-global-crypto'");
assert.equal((await json(prepareSql())).order.amount_cents,14990,'Accepted snapshot survives later price changes');
await assert.rejects(sql(`SET ROLE service_role; UPDATE public.jenios_platform_invoices_g47 SET amount_cents=1 WHERE id='${invoiceId}'`),/Immutable Platform invoice/);
const receipt='E'+'7'.repeat(31);
const confirm=(id=orderId,amount=14990,paid="'2024-01-31T13:00:00Z'",endToEnd=receipt)=>`SET ROLE service_role; SELECT public.jenios_platform_confirm_pix_g47('${id}','${id.replaceAll('-','')}',${amount},'${endToEnd}',${paid})`;
await sql(`UPDATE public.jenios_pay_orders SET created_at='2024-01-31T12:59:00Z' WHERE id='${orderId}';`);
await assert.rejects(json(confirm()),/Platform receipt mismatch/);
await sql(`INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status)
VALUES('${orderId}','inter_pix','${orderId.replaceAll('-','')}','pix',14990,'pending')`);
await assert.rejects(json(confirm(orderId,1)),/Platform payment mismatch/);
await assert.rejects(json(confirm(orderId,14990,"now()+interval '1 minute'")),/Platform payment mismatch/);
const confirmed=await Promise.all([1,2].map(()=>json(confirm())));
assert.ok(confirmed.every(x=>x.ok));assert.equal(confirmed.filter(x=>x.replayed).length,1);
assert.equal(await sql(`SELECT current_period_end AT TIME ZONE 'UTC' FROM public.jenios_pay_subscriptions WHERE id='${first.invoice.subscription_id}'`),'2024-02-29 13:00:00');
await assert.rejects(json(confirm(orderId,14990,"'2024-01-31T13:00:00Z'",'E'+'8'.repeat(31))),/Platform receipt mismatch/);
await assert.rejects(sql(`SET ROLE service_role; UPDATE public.jenios_platform_invoices_g47 SET period_end=now() WHERE id='${invoiceId}'`),/Immutable Platform invoice/);
const second=await json(prepareSql('g47_second_month_0001','platform-global-crypto',15000));assert.equal(second.ok,true);assert.equal(second.invoice.subscription_id,first.invoice.subscription_id);
const sid=second.order.id;
await sql(`INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status)
VALUES('${sid}','inter_pix','${sid.replaceAll('-','')}','pix',15000,'pending');`);
const now=await sql("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')");
assert.equal((await json(confirm(sid,15000,literal(now),'E'+'9'.repeat(31)))).ok,true);
assert.equal((await json(prepareSql('g47_early_renewal_001','platform-global-crypto',15000))).code,'ACTIVE_PERIOD');
assert.equal(await sql('SELECT count(*) FROM public.jenios_pay_subscriptions'),'1','Renewal does not create a second subscription/allowance identity');
await sql(`SET ROLE service_role; UPDATE public.jenios_pay_orders SET status='refunded' WHERE id='${sid}';`);
assert.equal(await sql(`SELECT status FROM public.jenios_pay_subscriptions WHERE id='${first.invoice.subscription_id}'`),'cancelled');
console.log('G47_MONTHLY_OWNER_CONSENT_CONCURRENCY_RECEIPT_CALENDAR_RENEWAL_REFUND_PASS');
// An expired unpaid invoice permits a new request. A late receipt is not lost.
const third=await json(prepareSql('g47_expired_pending_1','platform-nacional',9990));assert.equal(third.ok,true);
await sql(`SET ROLE service_role; UPDATE public.jenios_platform_invoices_g47 SET status='closed' WHERE id='${third.invoice.id}';`);
const fourth=await json(prepareSql('g47_after_expiry_0001','platform-nacional',9990));assert.equal(fourth.ok,true);
for(const entry of [fourth,third])await sql(`INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status)
VALUES('${entry.order.id}','inter_pix','${entry.order.id.replaceAll('-','')}','pix',9990,'pending');`);
const later=await sql("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')");
assert.equal((await json(confirm(fourth.order.id,9990,literal(later),'E'+'a'.repeat(31)))).ok,true);
const review=await json(confirm(third.order.id,9990,literal(later),'E'+'b'.repeat(31)));
assert.equal(review.code,'PAID_REVIEW_REQUIRED');
assert.equal(await sql(`SELECT status FROM public.jenios_pay_orders WHERE id='${third.order.id}'`),'paid');
assert.equal((await json(prepareSql('g47_no_more_charges01','platform-nacional',9990))).code,'PAID_REVIEW_REQUIRED');
await sql(`SET ROLE service_role; UPDATE public.jenios_pay_payments SET status='refunded' WHERE order_id='${fourth.order.id}';`);
assert.equal(await sql(`SELECT status FROM public.jenios_pay_subscriptions WHERE id='${first.invoice.subscription_id}'`),'cancelled');
assert.equal(await sql("SELECT pg_get_functiondef('public.jenios_confirm_inter_pix(uuid,text,integer,text,timestamptz)'::regprocedure)"),original);
console.log('G47_MONTHLY_POSTGRES_ALL_PASS');
