/** G45 actual PostgreSQL verification. Never accepts a hosted/shared database.
 * Creates fixtures only after loopback, dedicated name and empty-schema checks.
 * PostgreSQL 16 is accepted for local checks; release CI certifies PostgreSQL 17.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';
import {PRO_ALLOWANCE_APPROVAL_G45} from '../lib/assistant/pro-quota-activation.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G45_QUOTA_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G45_QUOTA_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G45_QUOTA_TEST_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)
 ||target.search||target.hash||!/^jenios_genios_g45_quota_[a-z0-9_]+$/.test(dbName))
 throw Error('G45_QUOTA_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432',
 '--username',decodeURIComponent(target.username||'postgres'),'--dbname',dbName,
 '--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',
 PGPASSFILE:'/tmp/jenios-g45-quota-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',
 PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source,onOutput=null){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;if(onOutput)onOutput(out);});
 child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G45_QUOTA_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G45_QUOTA_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
const literal=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const json=source=>sql(source).then(JSON.parse);
const file=async path=>sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const digest=key=>createHash('sha256').update(key).digest('hex');
const reserveSql=(owner,key,amount=1000,source='included')=>`public.jenios_pro_reserve_b143(${literal(owner)}::uuid,${literal(key)},${literal(digest(key))},'advanced_question','gpt-6-luna',${literal(source)},${amount*2},${amount},${literal(PRO_PRICING_VERSION)})`;
const reserve=(...values)=>json('SET ROLE service_role; SELECT '+reserveSql(...values));
const dispatch=(owner,key)=>json(`SET ROLE service_role; SELECT public.jenios_pro_dispatch_b143(${literal(owner)}::uuid,${literal(key)},${literal(digest(key))})`);
const release=(owner,key)=>json(`SET ROLE service_role; SELECT public.jenios_pro_release_b143(${literal(owner)}::uuid,${literal(key)},${literal(digest(key))},'G45 local fixture: provider never dispatched.')`);
const settle=(owner,key,cost,id)=>json(`SET ROLE service_role; SELECT public.jenios_pro_settle_b143(${literal(owner)}::uuid,${literal(key)},${literal(digest(key))},${cost},'{"input_tokens":1,"output_tokens":0}'::jsonb,'{"answer":"Disposable local G45 fixture"}'::jsonb,${literal(id)})`);
const status=owner=>json(`SET ROLE service_role; SELECT public.jenios_pro_status_b143(${literal(owner)}::uuid)`);
const rows=table=>json(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.${table} t`);
const onePeriod=(owner,subscription)=>json(`SELECT to_jsonb(p) FROM public.jenios_pro_periods_b143 p WHERE user_id=${literal(owner)}::uuid AND subscription_id=${literal(subscription)}::uuid ORDER BY start_at DESC LIMIT 1`);
const functions=()=>json(`SELECT jsonb_object_agg(proname,pg_get_functiondef(oid)) FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname IN
 ('jenios_pro_settle_b143','jenios_pro_release_b143','jenios_pro_reconcile_b143','jenios_pro_confirm_paid_topup_b143')`);
const topupFunctions=()=>json(`SELECT jsonb_object_agg(proname,pg_get_functiondef(oid)) FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname IN
 ('jenios_pro_create_quote_b143','jenios_pro_prepare_topup_order_b143')`);
const strippedConfig=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['crypto_allowance_nano_usd','global_allowance_nano_usd','updated_at'].includes(key)));
const id=index=>'45000000-0000-4000-8000-'+String(index).padStart(12,'0');
const [A,B,C,D,E,F,H]=[1,2,3,4,5,6,7].map(id);
const sub=owner=>id(Number(owner.slice(-12))+100);
const CRYPTO=id(1001),GLOBAL=id(1002),NATIONAL=id(1003);
const migrationFiles=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('_jenios_pro_allowances_g45.sql'));
assert.equal(migrationFiles.length,1,'Exactly one G45 allowance migration is required');
const migration='supabase/migrations/'+migrationFiles[0];

assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')")));
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing database with existing application objects');
console.log('G45_POSTGRES_VERSION '+await sql('SHOW server_version'));
await file('tests/sql/jenios-assistant-conversations-g43-fixture.sql');
await file('supabase/migrations/20261012_jenios_pay_v1.sql');
await file('db/schema/pro-wallet-b143.sql');
await file('supabase/migrations/20261024202054_jenios_assistant_sales_budget_g43.sql');
await file('supabase/migrations/20261024210740_jenios_assistant_operational_budget_g44.sql');
await sql(`INSERT INTO auth.users(id,email) VALUES ${[A,B,C,D,E,F,H].map((owner,i)=>`(${literal(owner)},'g45-quota-${i}@example.invalid')`).join(',')};
 INSERT INTO public.jenios_pay_products(id,code,name,category,price_cents,billing_type) VALUES
 (${literal(CRYPTO)},'platform-global-crypto','Local Crypto','platform',14990,'monthly'),
 (${literal(GLOBAL)},'platform-internacional-pro','Local Global','platform',19990,'monthly'),
 (${literal(NATIONAL)},'platform-nacional','Local Nacional','platform',9990,'monthly');
 GRANT SELECT ON public.jenios_pay_products,public.jenios_pay_subscriptions TO service_role;
 INSERT INTO public.jenios_pay_subscriptions(id,user_id,product_id,status,current_period_start,current_period_end) VALUES
 ${[A,B,D,E,F,H].map(owner=>`(${literal(sub(owner))},${literal(owner)},${literal(owner===B?GLOBAL:CRYPTO)},'active',now()-interval '1 day',now()+interval '29 days')`).join(',')};
 INSERT INTO public.jenios_pro_wallets_b143(user_id,balance_nano_usd) VALUES
 (${literal(A)},100000),(${literal(B)},100000),(${literal(C)},100000);
 UPDATE public.jenios_pro_config_b143 SET generation_enabled=true,payments_enabled=false,pricing_approved=true,
 pricing_version=${literal(PRO_PRICING_VERSION)},rates_verified_at=now(),allowed_models=ARRAY['gpt-6-luna','gpt-6.1-sol'],
 monthly_budget_mode='uncapped',monthly_provider_limit_nano_usd=0,max_request_provider_nano_usd=200000000,
 crypto_allowance_nano_usd=2000000000,global_allowance_nano_usd=4000000000 WHERE id=true;`);

assert.equal((await reserve(A,'g45_existing_settled_01',100000000)).code,'RESERVED');
assert.equal((await dispatch(A,'g45_existing_settled_01')).acquired,true);
assert.equal((await settle(A,'g45_existing_settled_01',40000000,'resp_g45_existing_a')).chargedNanoUsd,80000000);
assert.equal((await reserve(A,'g45_existing_reserved_01',100000000)).code,'RESERVED');
assert.equal((await reserve(B,'g45_existing_global_01',50000000)).code,'RESERVED');
assert.equal((await dispatch(B,'g45_existing_global_01')).acquired,true);
assert.equal((await settle(B,'g45_existing_global_01',20000000,'resp_g45_existing_b')).chargedNanoUsd,40000000);
// G44 historical prepaid entries had no subscription requirement. Preserve
// their accounting, but G45 must block any NEW request without an active plan.
assert.equal((await reserve(C,'g45_old_prepaid_sent_01',1000,'prepaid')).code,'RESERVED');
assert.equal((await dispatch(C,'g45_old_prepaid_sent_01')).acquired,true);
assert.equal((await reserve(C,'g45_old_prepaid_hold_01',1000,'prepaid')).code,'RESERVED');
await sql('UPDATE public.jenios_pro_config_b143 SET generation_enabled=false;');

const originalConfig=(await rows('jenios_pro_config_b143'))[0],originalFunctions=await functions();
const originalTopups=await topupFunctions();
const preserveTables=['jenios_pro_wallets_b143','jenios_pro_requests_b143','jenios_pro_budgets_b143','jenios_pay_subscriptions','jenios_pro_events_b143'];
const before=Object.fromEntries(await Promise.all(preserveTables.map(async table=>[table,await rows(table)])));
await file(migration);
const config=(await rows('jenios_pro_config_b143'))[0];
assert.deepEqual(strippedConfig(config),strippedConfig(originalConfig));
assert.equal(config.crypto_allowance_nano_usd,PRO_ALLOWANCE_APPROVAL_G45.plans['platform-global-crypto'].retailNanoUsd);
assert.equal(config.global_allowance_nano_usd,PRO_ALLOWANCE_APPROVAL_G45.plans['platform-internacional-pro'].retailNanoUsd);
for(const table of preserveTables)assert.deepEqual(await rows(table),before[table],table+' changed during policy migration');
assert.deepEqual(await functions(),originalFunctions);
for(const [name,definition] of Object.entries(await topupFunctions())){
 const oldGate='c.monthly_provider_limit_nano_usd<1';
 const newGate="(c.monthly_budget_mode='capped' AND c.monthly_provider_limit_nano_usd<1)";
 assert.equal(originalTopups[name].split(oldGate).length,2,name+' old cap condition must occur exactly once');
 assert.equal(definition,originalTopups[name].replace(oldGate,newGate),name+' changed outside its cap condition');
}
const aMigrated=await onePeriod(A,sub(A));
assert.equal(aMigrated.allowance_nano_usd,4000000000);assert.equal(aMigrated.spent_nano_usd,80000000);assert.equal(aMigrated.reserved_nano_usd,200000000);
assert.equal((await onePeriod(B,sub(B))).allowance_nano_usd,8000000000);
console.log('G45_APPROVED_POLICY_PRESERVES_EXISTING_USAGE_GATES_AND_HISTORY_PASS');

const twiceTables=[...preserveTables,'jenios_pro_config_b143','jenios_pro_periods_b143'];
const once=Object.fromEntries(await Promise.all(twiceTables.map(async table=>[table,await rows(table)])));
await file(migration);
for(const table of twiceTables)assert.deepEqual(await rows(table),once[table],table+' changed when migration replayed');
assert.equal((await reserve(A,'g45_disabled_new_request')).code,'GENERATION_DISABLED');
assert.equal((await reserve(A,'g45_existing_reserved_01',100000000)).code,'EXISTING_REQUEST');
console.log('G45_MIGRATION_REPLAY_IDEMPOTENT_AND_GENERATION_REMAINS_OFF_PASS');

console.log(await file('tests/sql/jenios-pro-allowances-g45.sql'));
await assert.rejects(sql(`SET ROLE authenticated; SELECT public.jenios_pro_included_state_g45(${literal(A)}::uuid)`),/permission denied/);
await assert.rejects(sql(`SET ROLE anon; SELECT ${reserveSql(A,'g45_anonymous_rejected')}`),/permission denied/);
await sql('UPDATE public.jenios_pro_config_b143 SET generation_enabled=true;');

// Same subscription + same cycle: raise TOTAL, never refill or add a second
// period. Status projects it read-only and reservation persists the same total.
const beforeUpgrade=await onePeriod(A,sub(A));
await sql(`UPDATE public.jenios_pay_subscriptions SET product_id=${literal(GLOBAL)} WHERE id=${literal(sub(A))};`);
const upgraded=(await status(A)).included;
assert.equal(upgraded.totalNanoUsd,8000000000);assert.equal(upgraded.spentNanoUsd,80000000);assert.equal(upgraded.reservedNanoUsd,200000000);
assert.equal(upgraded.availableNanoUsd,7720000000);assert.equal(upgraded.transitionRequired,false);
assert.deepEqual(await onePeriod(A,sub(A)),beforeUpgrade,'Read-only status must not change the ledger');
const upgradeRace=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${reserveSql(A,'g45_same_upgrade_race_01',50000000)}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(upgradeRace.map(JSON.parse).map(value=>value.code).sort(),['EXISTING_REQUEST','RESERVED']);
const afterUpgrade=await onePeriod(A,sub(A));
assert.equal(afterUpgrade.allowance_nano_usd,8000000000);assert.equal(afterUpgrade.spent_nano_usd,80000000);assert.equal(afterUpgrade.reserved_nano_usd,300000000);
assert.equal(await sql(`SELECT count(*) FROM public.jenios_pro_periods_b143 WHERE user_id=${literal(A)}::uuid`),'1');
assert.equal((await reserve(A,'g45_same_upgrade_race_01',50000000)).code,'EXISTING_REQUEST');
await sql(`UPDATE public.jenios_pay_subscriptions SET product_id=${literal(CRYPTO)} WHERE id=${literal(sub(A))};`);
assert.equal((await status(A)).included.totalNanoUsd,8000000000,'Downgrade cannot erase the already-granted cycle total');
assert.equal((await release(A,'g45_same_upgrade_race_01')).ok,true);
assert.equal((await release(A,'g45_existing_reserved_01')).ok,true);
console.log('G45_SAME_CYCLE_UPGRADE_IS_ABSOLUTE_MONOTONIC_AND_CONCURRENTLY_IDEMPOTENT_PASS');

// Near exhaustion: two real PostgreSQL sessions compete for one remaining
// reservation. Exactly one succeeds; settlement debits twice confirmed cost.
assert.equal((await reserve(D,'g45_create_d_period_01')).ok,true);assert.equal((await release(D,'g45_create_d_period_01')).ok,true);
await sql(`UPDATE public.jenios_pro_periods_b143 SET spent_nano_usd=3999999800 WHERE user_id=${literal(D)};`);
const exhaustedRace=await Promise.all([1,2].map(index=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${reserveSql(D,'g45_last_capacity_'+index,100)}; SELECT pg_sleep(0.1); COMMIT;`)));
const raced=exhaustedRace.map(JSON.parse);
assert.deepEqual(raced.map(value=>value.code).sort(),['INCLUDED_ALLOWANCE_EXHAUSTED','RESERVED']);
const winningKey='g45_last_capacity_'+(raced.findIndex(value=>value.ok)+1);
assert.equal((await dispatch(D,winningKey)).acquired,true);assert.equal((await settle(D,winningKey,100,'resp_g45_last_capacity')).chargedNanoUsd,200);
assert.equal((await status(D)).included.availableNanoUsd,0);
const exhaustedSnapshot=await rows('jenios_pro_requests_b143');
assert.equal((await reserve(D,'g45_after_exhaustion_01',1)).code,'INCLUDED_ALLOWANCE_EXHAUSTED');
assert.deepEqual(await rows('jenios_pro_requests_b143'),exhaustedSnapshot);
console.log('G45_EXHAUSTED_INCLUDED_ALLOWANCE_BLOCKS_NEW_CALLS_WITHOUT_DOUBLE_SPEND_PASS');

// A new/replaced subscription is not proof of a paid upgrade. Old current
// consumption must not disappear even when that subscription is cancelled.
assert.equal((await reserve(E,'g45_old_cycle_cost_01')).ok,true);assert.equal((await dispatch(E,'g45_old_cycle_cost_01')).acquired,true);
assert.equal((await settle(E,'g45_old_cycle_cost_01',500,'resp_g45_old_cycle')).chargedNanoUsd,1000);
const newE=id(205);
await sql(`INSERT INTO public.jenios_pay_subscriptions(id,user_id,product_id,status,current_period_start,current_period_end)
 VALUES(${literal(newE)},${literal(E)},${literal(GLOBAL)},'active',now()-interval '12 hours',now()+interval '29 days');`);
const blocked=(await status(E)).included;
assert.equal(blocked.subscriptionId,newE);assert.equal(blocked.totalNanoUsd,8000000000);assert.equal(blocked.availableNanoUsd,0);
assert.equal(blocked.transitionRequired,true);assert.equal(blocked.transitionCode,'INCLUDED_PERIOD_TRANSITION_REQUIRED');
const oldE=await rows('jenios_pro_periods_b143');
assert.equal((await reserve(E,'g45_new_sub_rejected_01')).code,'INCLUDED_PERIOD_TRANSITION_REQUIRED');
assert.deepEqual(await rows('jenios_pro_periods_b143'),oldE);
await sql(`UPDATE public.jenios_pay_subscriptions SET status='cancelled' WHERE id=${literal(sub(E))};`);
assert.equal((await reserve(E,'g45_cancel_not_reset_01')).code,'INCLUDED_PERIOD_TRANSITION_REQUIRED');
assert.equal((await status(E)).included.transitionRequired,true);
assert.equal(await sql(`SELECT count(*) FROM public.jenios_pro_periods_b143 WHERE user_id=${literal(E)}::uuid`),'1');
console.log('G45_REPLACED_SUBSCRIPTION_CANNOT_RESET_CURRENT_CYCLE_USAGE_PASS');

// Old pending holds also block replacement. A denied dispatch is safely
// releasable; no generation, duplicate charge or forged transition is needed.
assert.equal((await reserve(H,'g45_old_hold_overlap_01')).ok,true);
await sql(`INSERT INTO public.jenios_pay_subscriptions(id,user_id,product_id,status,current_period_start,current_period_end)
 VALUES(${literal(id(207))},${literal(H)},${literal(GLOBAL)},'active',now()-interval '12 hours',now()+interval '29 days');`);
assert.equal((await reserve(H,'g45_new_hold_overlap_01')).code,'INCLUDED_PERIOD_TRANSITION_REQUIRED');
assert.equal((await dispatch(H,'g45_old_hold_overlap_01')).code,'INCLUDED_PERIOD_TRANSITION_REQUIRED');
assert.equal((await reserve(H,'g45_old_hold_overlap_01')).code,'EXISTING_REQUEST');
assert.equal((await release(H,'g45_old_hold_overlap_01')).ok,true);
assert.equal((await status(H)).included.transitionRequired,false);
assert.equal((await reserve(H,'g45_new_after_release_01')).ok,true);
assert.equal((await release(H,'g45_new_after_release_01')).ok,true);
console.log('G45_PENDING_TRANSITION_BLOCKS_DISPATCH_AND_RELEASE_PRESERVES_HISTORY_PASS');

// A legitimate nonoverlapping new billing cycle receives a fresh allowance;
// spent history remains attached to the expired previous period.
await sql(`INSERT INTO public.jenios_pro_periods_b143(user_id,subscription_id,start_at,end_at,allowance_nano_usd,spent_nano_usd)
 VALUES(${literal(F)},${literal(sub(F))},now()-interval '31 days',now()-interval '1 day',4000000000,4000000000);`);
assert.equal((await status(F)).included.availableNanoUsd,4000000000);assert.equal((await status(F)).included.transitionRequired,false);
assert.equal((await reserve(F,'g45_legitimate_renewal_01')).ok,true);
assert.equal(await sql(`SELECT count(*) FROM public.jenios_pro_periods_b143 WHERE user_id=${literal(F)}::uuid`),'2');
assert.equal(await sql(`SELECT spent_nano_usd FROM public.jenios_pro_periods_b143 WHERE user_id=${literal(F)}::uuid AND end_at<=now()`),'4000000000');
assert.equal((await release(F,'g45_legitimate_renewal_01')).ok,true);
console.log('G45_NONOVERLAPPING_RENEWAL_PRESERVES_EXPIRED_CYCLE_HISTORY_PASS');

// Paid balance cannot grant eligibility. Historical sent calls remain
// settleable; a still-reserved call after expiry is blocked then releasable.
const oldWallet=(await rows('jenios_pro_wallets_b143')).find(row=>row.user_id===C);
assert.equal((await reserve(C,'g45_new_prepaid_no_plan_01',1000,'prepaid')).code,'ADVANCED_PLAN_REQUIRED');
assert.equal((await dispatch(C,'g45_old_prepaid_hold_01')).code,'ADVANCED_PLAN_REQUIRED');
assert.equal((await settle(C,'g45_old_prepaid_sent_01',300,'resp_g45_prepaid_historical')).chargedNanoUsd,600);
assert.equal((await settle(C,'g45_old_prepaid_sent_01',300,'resp_g45_prepaid_historical')).replayed,true);
assert.equal((await release(C,'g45_old_prepaid_hold_01')).ok,true);
assert.equal((await reserve(C,'g45_old_prepaid_sent_01',1000,'prepaid')).code,'EXISTING_REQUEST');
const afterWallet=(await rows('jenios_pro_wallets_b143')).find(row=>row.user_id===C);
assert.equal(afterWallet.balance_nano_usd,oldWallet.balance_nano_usd-600);assert.equal(afterWallet.reserved_nano_usd,0);
assert.equal((await reserve(B,'g45_prepaid_active_hold_01',1000,'prepaid')).ok,true);
await sql(`UPDATE public.jenios_pay_subscriptions SET status='cancelled' WHERE id=${literal(sub(B))};`);
assert.equal((await dispatch(B,'g45_prepaid_active_hold_01')).code,'ADVANCED_PLAN_REQUIRED');
assert.equal((await release(B,'g45_prepaid_active_hold_01')).ok,true);
await sql(`UPDATE public.jenios_pay_subscriptions SET status='active' WHERE id=${literal(sub(B))};`);
assert.equal((await reserve(B,'g45_prepaid_already_sent_01',1000,'prepaid')).ok,true);
assert.equal((await dispatch(B,'g45_prepaid_already_sent_01')).acquired,true);
await sql(`UPDATE public.jenios_pay_subscriptions SET status='cancelled' WHERE id=${literal(sub(B))};`);
assert.equal((await settle(B,'g45_prepaid_already_sent_01',250,'resp_g45_prepaid_after_expiry')).chargedNanoUsd,500);
console.log('G45_PREPAID_REQUIRES_ELIGIBILITY_WITHOUT_BREAKING_HISTORICAL_SETTLEMENT_PASS');

// This fixture approves a hypothetical amount ONLY in the disposable local
// database. No actual package is approved, no bank/network is contacted.
const quoteKey='g45_fixture_additional_quote_01',orderKey='g45_fixture_additional_order_01';
const rateAt=await sql("SELECT to_char(now() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')");
const quoteSql=key=>`public.jenios_pro_create_quote_b143(${literal(A)}::uuid,${literal(key)},5000000,'BCB:G45_LOCAL_FIXTURE',${literal(rateAt)}::timestamptz)`;
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql(quoteKey))).code,'PAYMENTS_NOT_APPROVED');
await sql(`INSERT INTO public.jenios_pay_products(id,code,name,category,price_cents,billing_type,active)
 VALUES(${literal(id(1004))},'social-ai-pro-credits','Disposable mock add-on','other',0,'one_time',true);
 GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_orders TO service_role;
 GRANT SELECT ON public.jenios_pay_payments TO service_role;
 UPDATE public.jenios_pro_config_b143 SET payments_enabled=true,topup_currency='BRL',topup_amount_minor=2500,
 commercial_terms_version='G45-DISPOSABLE-FIXTURE-NOT-APPROVAL';`);
const quote=await json('SET ROLE service_role; SELECT '+quoteSql(quoteKey));
assert.equal(quote.ok,true);assert.equal(quote.quote.amount_cents,2500);assert.equal(quote.quote.retail_nano_usd,5000000000);
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql(quoteKey))).replayed,true);
const prepareSql=`public.jenios_pro_prepare_topup_order_b143(${literal(A)}::uuid,${literal(quote.quote.id)}::uuid,${literal(orderKey)})`;
const prepared=await json('SET ROLE service_role; SELECT '+prepareSql);
assert.equal(prepared.ok,true);assert.equal(prepared.order.status,'pending');assert.equal(prepared.order.provider,'inter_pix');
assert.equal((await json('SET ROLE service_role; SELECT '+prepareSql)).replayed,true);
const fundSql=`public.jenios_pro_confirm_paid_topup_b143(${literal(A)}::uuid,${literal(quote.quote.id)}::uuid,${literal(prepared.order.id)}::uuid)`;
assert.equal((await json('SET ROLE service_role; SELECT '+fundSql)).code,'CONFIRMED_PAYMENT_REQUIRED');
await sql(`UPDATE public.jenios_pay_orders SET status='paid' WHERE id=${literal(prepared.order.id)};`);
assert.equal((await json('SET ROLE service_role; SELECT '+fundSql)).code,'CONFIRMED_RECEIPT_REQUIRED');
await sql(`INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES(${literal(prepared.order.id)},'inter_pix','g45-disposable-fixture-receipt','pix',2500,'confirmed',now());`);
const beforeFunding=(await rows('jenios_pro_wallets_b143')).find(row=>row.user_id===A).balance_nano_usd;
const fundingRace=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${fundSql}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(fundingRace.map(JSON.parse).map(value=>value.code).sort(),['ALREADY_CREDITED','CREDITED']);
assert.equal((await rows('jenios_pro_wallets_b143')).find(row=>row.user_id===A).balance_nano_usd,beforeFunding+5000000000);
assert.equal(await sql('SELECT count(*) FROM public.jenios_pro_funding_b143'),'1');
// Capped policy with no positive limit still blocks new quotes/orders; stale
// rates, absent amounts and disabled payment gates continue to reject them.
await sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='capped';");
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql('g45_capped_no_limit_quote'))).code,'PAYMENTS_NOT_APPROVED');
await sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='uncapped',topup_amount_minor=NULL;");
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql('g45_no_amount_quote_01'))).code,'PAYMENTS_NOT_APPROVED');
await sql("UPDATE public.jenios_pro_config_b143 SET topup_amount_minor=2500,rates_verified_at=now()-interval '31 days';");
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql('g45_stale_rate_quote_01'))).code,'PAYMENTS_NOT_APPROVED');
await sql("UPDATE public.jenios_pro_config_b143 SET payments_enabled=false,topup_currency=NULL,topup_amount_minor=NULL,commercial_terms_version=NULL,rates_verified_at=now();");
assert.equal((await json('SET ROLE service_role; SELECT '+quoteSql('g45_payments_off_quote_01'))).code,'PAYMENTS_NOT_APPROVED');
console.log('G45_UNCAPPED_ADDON_QUOTE_ORDER_RECEIPT_AND_FUNDING_GATES_PASS');

// No policy replay clears an unknown charge or circumvents the existing
// reconciliation/re-enable guard; no migration ever calls a payment provider.
assert.equal((await reserve(A,'g45_reconcile_unknown_01')).ok,true);assert.equal((await dispatch(A,'g45_reconcile_unknown_01')).acquired,true);
const mark=await json(`SET ROLE service_role; SELECT public.jenios_pro_reconcile_b143(${literal(A)}::uuid,'g45_reconcile_unknown_01',${literal(digest('g45_reconcile_unknown_01'))},'mark_unknown',NULL,NULL,NULL,NULL,'{"reason":"G45 disposable unknown-transport fixture"}'::jsonb)`);
assert.equal(mark.state,'needs_reconciliation');
const reconConfig=(await rows('jenios_pro_config_b143'))[0],reconRequests=await rows('jenios_pro_requests_b143');
const reconBudgets=await rows('jenios_pro_budgets_b143');
await file(migration);
assert.deepEqual((await rows('jenios_pro_config_b143'))[0],reconConfig);
assert.deepEqual(await rows('jenios_pro_requests_b143'),reconRequests);assert.deepEqual(await rows('jenios_pro_budgets_b143'),reconBudgets);
await assert.rejects(sql('UPDATE public.jenios_pro_config_b143 SET generation_enabled=true;'),/Resolve Pro reconciliation/);
assert.equal((await reserve(A,'g45_reconcile_blocked_01')).code,'GENERATION_DISABLED');
assert.deepEqual(await functions(),originalFunctions);
console.log('G45_RECONCILIATION_AND_FINANCIAL_FUNCTIONS_REMAIN_PROTECTED_PASS');
console.log('G45_QUOTA_POSTGRES_ALL_PASS');
