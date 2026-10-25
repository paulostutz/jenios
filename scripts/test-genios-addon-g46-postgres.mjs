/** G46 actual PostgreSQL verification. Never accepts a hosted/shared database.
 * Creates fixtures only after loopback, dedicated name and empty-schema checks.
 * PostgreSQL 16 is accepted for local checks; release CI certifies PostgreSQL 17.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';
import {PRO_ADDON_PACKS,proAddonAmounts,PRO_ADDON_TERMS} from '../lib/assistant/pro-addon-catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G46_ADDON_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G46_ADDON_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G46_ADDON_TEST_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)
 ||target.search||target.hash||!/^jenios_genios_g46_addon_[a-z0-9_]+$/.test(dbName))
 throw Error('G46_ADDON_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432',
 '--username',decodeURIComponent(target.username||'postgres'),'--dbname',dbName,
 '--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',
 PGPASSFILE:'/tmp/jenios-g46-addon-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',
 PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source,onOutput=null){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;if(onOutput)onOutput(out);});
 child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G46_ADDON_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G46_ADDON_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
const literal=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const json=source=>sql(source).then(JSON.parse);
const file=async path=>sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));

const migration='supabase/migrations/'+(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(name=>name.endsWith('_jenios_pro_addon_catalog_g46.sql'));
const A='46000000-0000-4000-8000-000000000001',B='46000000-0000-4000-8000-000000000002';
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')")));
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing nonempty database');
console.log('G46_POSTGRES_VERSION '+await sql('SHOW server_version'));
for(const path of ['tests/sql/jenios-assistant-conversations-g43-fixture.sql','supabase/migrations/20261012_jenios_pay_v1.sql','db/schema/pro-wallet-b143.sql','supabase/migrations/20261024202054_jenios_assistant_sales_budget_g43.sql','supabase/migrations/20261024210740_jenios_assistant_operational_budget_g44.sql','supabase/migrations/20261024222440_jenios_pro_allowances_g45.sql'])await file(path);
const rows=table=>json(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.${table} t`);
const finance=()=>json("SELECT jsonb_object_agg(proname,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('jenios_pro_settle_b143','jenios_pro_release_b143','jenios_pro_reconcile_b143','jenios_pro_confirm_paid_topup_b143')");
const beforeFunctions=await finance(),beforeConfig=(await rows('jenios_pro_config_b143'))[0];
await file(migration);
const after=(await rows('jenios_pro_config_b143'))[0];
for(const key of Object.keys(beforeConfig).filter(k=>!['topup_currency','topup_amount_minor','commercial_terms_version','updated_at'].includes(k)))assert.deepEqual(after[key],beforeConfig[key],key+' must remain unchanged');
assert.equal(after.commercial_terms_version,PRO_ADDON_TERMS);assert.equal(after.payments_enabled,false);assert.equal(after.generation_enabled,false);
await file(migration);assert.deepEqual((await rows('jenios_pro_config_b143'))[0],after);
assert.deepEqual(await finance(),beforeFunctions);
for(const table of ['jenios_pay_orders','jenios_pay_payments','jenios_pay_subscriptions','jenios_pro_wallets_b143','jenios_pro_quotes_b143'])assert.deepEqual(await rows(table),[]);
const fn='public.jenios_pro_create_addon_quote_g46(uuid,text,text,bigint,text,timestamptz)';
for(const role of ['anon','authenticated'])assert.equal(await sql(`SELECT has_function_privilege('${role}','${fn}','EXECUTE')`),'f');
assert.equal(await sql(`SELECT has_function_privilege('service_role','${fn}','EXECUTE')`),'t');
console.log('G46_MIGRATION_IDEMPOTENT_NO_FINANCIAL_EVENTS_GATES_RLS_AND_FUNCTIONS_PRESERVED_PASS');
await sql(`INSERT INTO auth.users(id,email) VALUES ('${A}','g46-a@example.invalid'),('${B}','g46-b@example.invalid');
 INSERT INTO public.jenios_pay_products(code,name,category,price_cents,billing_type,active) VALUES
 ('platform-global-crypto','Disposable plan','platform',14990,'monthly',true),('social-ai-pro-credits','Disposable additional capacity','other',0,'one_time',true);
 INSERT INTO public.jenios_pay_subscriptions(user_id,product_id,status,current_period_start,current_period_end)
 SELECT '${A}',id,'active',now()-interval '1 day',now()+interval '29 days' FROM public.jenios_pay_products WHERE code='platform-global-crypto';
 GRANT SELECT ON public.jenios_pay_products,public.jenios_pay_subscriptions,public.jenios_pay_payments TO service_role;
 GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_orders TO service_role;
 UPDATE public.jenios_pro_config_b143 SET pricing_approved=true,pricing_version='${PRO_PRICING_VERSION}',rates_verified_at=now(),allowed_models=ARRAY['gpt-6-luna'];`);
const rate=await sql("SELECT to_char(now() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')");
const callSql=(code,key='g46_addon_quote_0001',owner=A,fx=5123456)=>`public.jenios_pro_create_addon_quote_g46('${owner}',${literal(key)},${literal(code)},${fx},'BCB:PTAX_USD_VENDA','${rate}')`;
const call=(...a)=>json('SET ROLE service_role; SELECT '+callSql(...a));
assert.equal((await call('ia-500')).code,'PAYMENTS_NOT_APPROVED');
await sql('UPDATE public.jenios_pro_config_b143 SET payments_enabled=true,monthly_budget_mode='uncapped';');
await assert.rejects(file(migration),/G46_REQUIRES_PAYMENTS_PAUSED/);
assert.equal((await call('ia-500','g46_no_plan_quote_01',B)).code,'ADVANCED_PLAN_REQUIRED');
assert.equal((await call('ia-invalid')).code,'INVALID_QUOTE');
let last;
for(const pack of PRO_ADDON_PACKS){
 const result=await call(pack.code,'g46_pack_'+pack.code+'_0001');assert.equal(result.ok,true,JSON.stringify(result));
 const q=result.quote,expected=proAddonAmounts(pack.code,5123456);
 assert.equal(q.amount_cents,pack.priceCents);assert.equal(q.retail_nano_usd,expected.retailNanoUsd);assert.equal(q.base_amount_minor,pack.providerCapacityBrlCents);last=q;
 const replay=await call(pack.code,q.quote_key,A,6000000);assert.equal(replay.replayed,true);assert.deepEqual(replay.quote,q);
 assert.equal((await call(pack.code==='ia-500'?'ia-1000':'ia-500',q.quote_key)).code,'IDEMPOTENCY_CONFLICT');
 await assert.rejects(sql(`UPDATE public.jenios_pro_quotes_b143 SET amount_cents=1 WHERE id='${q.id}'`),/Immutable Pro financial record/);
}
const race=await Promise.all([1,2].map(()=>call('ia-500','g46_concurrent_quote_01')));assert.equal(race[0].quote.id,race[1].quote.id);assert.equal(race.filter(x=>x.replayed).length,1);
assert.equal((await json(`SET ROLE service_role; SELECT public.jenios_pro_create_quote_b143('${A}','g46_legacy_bypass_01',5000000,'BCB:PTAX_USD_VENDA','${rate}')`)).code,'PAYMENTS_NOT_APPROVED');
const q=last,prepare=`public.jenios_pro_prepare_topup_order_b143('${A}','${q.id}','g46_checkout_order_01')`;
const order=await json('SET ROLE service_role; SELECT '+prepare);assert.equal(order.ok,true);assert.equal(order.order.amount_cents,q.amount_cents);
assert.equal((await json('SET ROLE service_role; SELECT '+prepare)).replayed,true);
const fund=`public.jenios_pro_confirm_paid_topup_b143('${A}','${q.id}','${order.order.id}')`;
assert.equal((await json('SET ROLE service_role; SELECT '+fund)).code,'CONFIRMED_PAYMENT_REQUIRED');
await sql(`UPDATE public.jenios_pay_orders SET status='paid' WHERE id='${order.order.id}';`);
assert.equal((await json('SET ROLE service_role; SELECT '+fund)).code,'CONFIRMED_RECEIPT_REQUIRED');
await sql(`INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at) VALUES('${order.order.id}','inter_pix','g46-disposable-receipt','pix',${q.amount_cents},'confirmed',now());`);
const funded=await Promise.all([1,2].map(()=>json('SET ROLE service_role; SELECT '+fund)));
assert.deepEqual(funded.map(x=>x.code).sort(),['ALREADY_CREDITED','CREDITED']);
assert.equal((await rows('jenios_pro_wallets_b143'))[0].balance_nano_usd,q.retail_nano_usd);
assert.equal((await rows('jenios_pro_funding_b143')).length,1);
console.log('G46_FIVE_PACKS_FX_ROUNDING_CONCURRENT_REPLAY_LEGACY_BLOCK_RECEIPT_AND_ONCE_ONLY_FUNDING_PASS');
await sql("UPDATE public.jenios_pro_config_b143 SET payments_enabled=false;");
assert.equal((await call('ia-500','g46_paused_quote_01')).code,'PAYMENTS_NOT_APPROVED');
assert.deepEqual(await finance(),beforeFunctions);
console.log('G46_ADDON_POSTGRES_ALL_PASS');
