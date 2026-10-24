/** Actual PostgreSQL budget/ledger verification. Only an EMPTY disposable
 * loopback database with the dedicated G44 budget prefix is accepted. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PRO_PRICING_VERSION} from '../lib/assistant/pro-pricing.mjs';
import {reserveSalesAiBudget} from '../lib/assistant/sales-provider.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G44_BUDGET_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G44_BUDGET_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G44_BUDGET_TEST_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)||target.search||target.hash||
 !/^jenios_genios_g44_budget_[a-z0-9_]+$/.test(dbName))throw Error('G44_BUDGET_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432','--username',decodeURIComponent(target.username||'postgres'),
 '--dbname',dbName,'--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',PGPASSFILE:'/tmp/jenios-g44-budget-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source,onOutput=null){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;if(onOutput)onOutput(out);});child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G44_BUDGET_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G44_BUDGET_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
const literal=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const json=source=>sql(source).then(JSON.parse);
const file=async path=>sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const fingerprint=key=>createHash('sha256').update(key).digest('hex');
const reserveSql=(owner,key,amount=500,source='included')=>`public.jenios_pro_reserve_b143(${literal(owner)}::uuid,${literal(key)},${literal(fingerprint(key))},'advanced_question','gpt-6-luna',${literal(source)},${amount*2},${amount},${literal(PRO_PRICING_VERSION)})`;
const reserve=(...a)=>json('SET ROLE service_role; SELECT '+reserveSql(...a));
const dispatchSql=(owner,key)=>`public.jenios_pro_dispatch_b143(${literal(owner)}::uuid,${literal(key)},${literal(fingerprint(key))})`;
const release=(owner,key)=>json(`SET ROLE service_role; SELECT public.jenios_pro_release_b143(${literal(owner)}::uuid,${literal(key)},${literal(fingerprint(key))},'Local fixture: inference never dispatched.')`);
const settle=(owner,key,cost,id)=>json(`SET ROLE service_role; SELECT public.jenios_pro_settle_b143(${literal(owner)}::uuid,${literal(key)},${literal(fingerprint(key))},${cost},'{"input_tokens":1,"output_tokens":0}'::jsonb,'{"answer":"Local fixture only"}'::jsonb,${literal(id)})`);
const month="to_char(now() at time zone 'UTC','YYYY-MM')",hour="to_char(now() at time zone 'UTC','YYYY-MM-DD\"T\"HH24')";
const salesSql=(visitor,{mode='uncapped',limit=null,amount=20000,legacy=false}={})=>legacy?
 `public.jenios_sales_budget_hold_b282(${month},${literal(visitor.repeat(64))},${hour},${amount},${literal(limit)}::bigint)`:
 `public.jenios_sales_budget_hold_g44(${month},${literal(visitor.repeat(64))},${hour},${amount},${literal(limit)}::bigint,${literal(mode)})`;
const callSales=(visitor,options)=>sql('SET ROLE service_role; SELECT '+salesSql(visitor,options));
const budget=()=>json(`SELECT to_jsonb(b) FROM public.jenios_pro_budgets_b143 b WHERE month=${month}`);
const A='44000000-0000-4000-8000-000000000001',B='44000000-0000-4000-8000-000000000002',
 C='44000000-0000-4000-8000-000000000003',D='44000000-0000-4000-8000-000000000004';

assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')")));
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing database with existing application objects');
await file('tests/sql/jenios-assistant-conversations-g43-fixture.sql');
await file('supabase/migrations/20261012_jenios_pay_v1.sql');
await file('db/schema/pro-wallet-b143.sql');
await file('supabase/migrations/20261024202054_jenios_assistant_sales_budget_g43.sql');
await sql(`INSERT INTO auth.users(id,email) VALUES ${[A,B,C,D].map((id,i)=>`(${literal(id)},'g44-fixture-${i}@example.invalid')`).join(',')};`);
// Fixture catalog/ownership exists only in this disposable loopback database.
await sql(`INSERT INTO public.jenios_pay_products(code,name,category,price_cents,billing_type)
 VALUES('platform-global-crypto','Local fixture Global Crypto','platform',14990,'monthly');
 GRANT SELECT ON public.jenios_pay_products,public.jenios_pay_subscriptions TO service_role;`);
await sql(`UPDATE public.jenios_pro_config_b143 SET generation_enabled=true,pricing_approved=true,pricing_version=${literal(PRO_PRICING_VERSION)},
 rates_verified_at=now(),allowed_models=ARRAY['gpt-6-luna'],monthly_provider_limit_nano_usd=1000,max_request_provider_nano_usd=500,
 crypto_allowance_nano_usd=4000,global_allowance_nano_usd=4000 WHERE id=true;
 INSERT INTO public.jenios_pay_subscriptions(user_id,product_id,status,current_period_start,current_period_end)
 SELECT u.id,p.id,'active',now()-interval '1 day',now()+interval '29 days' FROM auth.users u CROSS JOIN public.jenios_pay_products p
 WHERE u.id IN (${[A,B,D].map(literal).join(',')}) AND p.code='platform-global-crypto';`);
assert.equal((await reserve(A,'g44_original_hold_001',100)).code,'RESERVED');
const untouched=()=>json("SELECT jsonb_object_agg(proname,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('jenios_pro_settle_b143','jenios_pro_release_b143','jenios_pro_reconcile_b143','jenios_pro_status_b143','jenios_pro_confirm_paid_topup_b143')");
const originalFunctions=await untouched(),originalBudget=await budget();
await file('supabase/migrations/20261024210740_jenios_assistant_operational_budget_g44.sql');
assert.deepEqual(await untouched(),originalFunctions);
const migrated=await budget();assert.equal(migrated.spent_nano_usd,originalBudget.spent_nano_usd);assert.equal(migrated.reserved_nano_usd,100);
assert.equal(migrated.limit_nano_usd,1000);assert.equal(migrated.monthly_budget_mode,'capped');
assert.equal((await reserve(A,'g44_original_hold_001',100)).code,'EXISTING_REQUEST');
assert.equal(await sql('SELECT generation_enabled AND NOT payments_enabled FROM public.jenios_pro_config_b143'),'t');
console.log('G44_EXISTING_LEDGER_AND_FINANCIAL_FUNCTIONS_PRESERVED_PASS');

const privileges=await json(`SELECT jsonb_build_object(
 'anonRpc',has_function_privilege('anon','public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text)','EXECUTE'),
 'authRpc',has_function_privilege('authenticated','public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text)','EXECUTE'),
 'serviceRpc',has_function_privilege('service_role','public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text)','EXECUTE'),
 'anonTable',has_table_privilege('anon','public.jenios_sales_policy_g44','SELECT,UPDATE'),
 'authTable',has_table_privilege('authenticated','public.jenios_sales_policy_g44','SELECT,UPDATE'),
 'invoker',NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text)'::regprocedure),
 'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.jenios_sales_policy_g44'::regclass));`);
assert.deepEqual(privileges,{anonRpc:false,authRpc:false,serviceRpc:true,anonTable:false,authTable:false,invoker:true,rls:true});
await assert.rejects(sql("SET ROLE authenticated; UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='uncapped'"),/permission denied/);
assert.equal(await callSales('a'), 'f');
assert.equal(await sql('SELECT count(*) FROM public.jenios_sales_budget_b282'),'0');
console.log('G44_SERVICE_ONLY_POLICY_AND_MISSING_AUTHORIZATION_REJECTED_PASS');

// The old and new capped RPCs share the same advisory transaction lock.
await sql(`INSERT INTO public.jenios_sales_budget_b282(month,reserved_micro_usd) VALUES(${month},980000)`);
const capRace=await Promise.all([false,true].map(legacy=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${salesSql(legacy?'b':'c',{mode:'capped',limit:1000000,legacy})}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(capRace.sort(),['f','t']);
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'1000000');
console.log('G44_CAPPED_OLD_AND_NEW_RPC_GLOBAL_CONCURRENCY_PASS');

await sql("UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='uncapped',updated_at=now();");
for(const invalid of [{mode:'unlimited'},{mode:'capped',limit:1000000},{limit:1000000},{amount:19999},{amount:20001},{mode:null}])
 assert.equal(await callSales('d',invalid),'f');
await sql(`UPDATE public.jenios_sales_budget_b282 SET reserved_micro_usd=1000000000 WHERE month=${month}`);
assert.equal(await callSales('d'),'t');assert.equal(await callSales('e'),'t');
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'1000040000');
// No historical counter is reset when the operator returns to capped mode.
await sql("UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='capped';");
assert.equal(await callSales('f',{mode:'capped',limit:1000000000}),'f');
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'1000040000');
console.log('G44_UNCAPPED_EXPLICIT_NULL_CAP_AND_CAPPED_RETURN_PRESERVE_USAGE_PASS');

// This is a new fixture state, never an operational counter reset.
await sql(`DELETE FROM public.jenios_sales_visitor_b282; DELETE FROM public.jenios_sales_budget_b282;
 UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='uncapped';
 INSERT INTO public.jenios_sales_budget_b282(month,reserved_micro_usd) VALUES(${month},220000);
 INSERT INTO public.jenios_sales_visitor_b282(month,visitor_hash,hour,calls) VALUES(${month},repeat('a',64),${hour},11);`);
const rateRace=await Promise.all([false,true].map(legacy=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${salesSql('a',{limit:legacy?1000000:null,legacy})}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(rateRace.sort(),['f','t']);
assert.equal(await sql('SELECT calls FROM public.jenios_sales_visitor_b282'),'12');
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'240000');
assert.equal(await callSales('a'),'f');
console.log('G44_TWELVE_PER_HOUR_PRESERVED_ACROSS_CONCURRENT_MODES_PASS');

// A real second session changes policy while holding its row lock. The RPC
// must observe the committed capped policy, never proceed using stale mode.
let announce,failBarrier;
const locked=new Promise((resolve,reject)=>{announce=resolve;failBarrier=reject;});
const changing=sql("BEGIN; UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='capped'; SELECT 'G44_POLICY_LOCKED'; SELECT pg_sleep(0.25); COMMIT;",
 out=>{if(out.includes('G44_POLICY_LOCKED'))announce();});
changing.catch(failBarrier);
await locked;
const whileChanging=callSales('b');
await changing;assert.equal(await whileChanging,'f');
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'240000');
await sql("UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='uncapped';");
console.log('G44_SALES_CONCURRENT_POLICY_CHANGE_SERIALIZES_AUTHORIZATION_PASS');

const runtimeEnv={JENIOS_SALES_GENERATIVE_ENABLED:'true',JENIOS_SALES_MODEL:'gpt-6-luna',JENIOS_AI_MONTHLY_BUDGET_MODE:'uncapped',
 OPENAI_API_KEY:'offline-fixture-not-a-provider-key',JENIOS_SALES_VISITOR_SALT:'offline-fixture-salt-never-used-remotely'};
const db={async rpc(name,p){
 assert.equal(name,'jenios_sales_budget_hold_g44');
 try{return {data:JSON.parse(await sql(`SET ROLE service_role; SELECT to_jsonb(public.jenios_sales_budget_hold_g44(${literal(p.p_month)},${literal(p.p_visitor_hash)},${literal(p.p_hour)},${p.p_amount_micro_usd},${literal(p.p_limit_micro_usd)}::bigint,${literal(p.p_budget_mode)}))`))};}
 catch{return {error:{message:'G44 test RPC rejected'}};}
}};
const serverNow=Number(await sql('SELECT floor(extract(epoch from now())*1000)::bigint'));
assert.equal(await reserveSalesAiBudget(db,'f'.repeat(64),runtimeEnv,serverNow),true);
await sql("UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='capped';");
assert.equal(await reserveSalesAiBudget(db,'f'.repeat(64),runtimeEnv,serverNow),false);
console.log('G44_REAL_JS_TO_SQL_SERVER_POLICY_BINDING_PASS');

assert.equal((await json('SET ROLE service_role; SELECT '+dispatchSql(A,'g44_original_hold_001'))).acquired,true);
assert.equal((await settle(A,'g44_original_hold_001',40,'resp_g44_original')).chargedNanoUsd,80);
const proCap=await Promise.all([A,B].map((owner,i)=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${reserveSql(owner,'g44_capped_race_'+i)}; SELECT pg_sleep(0.1); COMMIT;`)));
const capRows=proCap.map(JSON.parse);assert.equal(capRows.filter(x=>x.ok).length,1);
assert.equal(capRows.find(x=>!x.ok).code,'GLOBAL_BUDGET_EXHAUSTED');
const winner=capRows.findIndex(x=>x.ok);assert.equal((await release([A,B][winner],'g44_capped_race_'+winner)).ok,true);
assert.equal((await budget()).spent_nano_usd,40);assert.equal((await budget()).reserved_nano_usd,0);
console.log('G44_PRO_CAPPED_COMPATIBILITY_GLOBAL_RESERVATION_PASS');

await sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='uncapped',monthly_provider_limit_nano_usd=0;");
assert.equal((await reserve(C,'g44_no_plan_hold_001')).code,'INCLUDED_PLAN_REQUIRED');
assert.equal((await reserve(C,'g44_no_wallet_hold_001',500,'prepaid')).code,'INSUFFICIENT_BALANCE');
assert.equal((await reserve(A,'g44_above_call_limit_001',501)).code,'GENERATION_DISABLED');
const duplicateKey='g44_same_identity_race_001';
const same=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${reserveSql(A,duplicateKey)}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(same.map(JSON.parse).map(x=>x.code).sort(),['EXISTING_REQUEST','RESERVED']);
assert.equal((await budget()).reserved_nano_usd,500);
assert.equal((await budget()).limit_nano_usd,null);assert.equal((await budget()).monthly_budget_mode,'uncapped');
const conflict=await json(`SET ROLE service_role; SELECT public.jenios_pro_reserve_b143(${literal(A)}::uuid,${literal(duplicateKey)},repeat('0',64),'advanced_question','gpt-6-luna','included',1000,500,${literal(PRO_PRICING_VERSION)})`);
assert.equal(conflict.code,'IDEMPOTENCY_CONFLICT');
const dispatchRace=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${dispatchSql(A,duplicateKey)}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.equal(dispatchRace.map(JSON.parse).filter(x=>x.acquired).length,1);
assert.equal((await settle(A,duplicateKey,125,'resp_g44_duplicate')).chargedNanoUsd,250);
assert.equal((await settle(A,duplicateKey,125,'resp_g44_duplicate')).replayed,true);
assert.equal((await budget()).spent_nano_usd,165);assert.equal((await budget()).reserved_nano_usd,0);
console.log('G44_PRO_UNCAPPED_PLAN_CALL_LIMIT_IDEMPOTENCY_AND_SETTLEMENT_PASS');

assert.equal((await reserve(A,'g44_unbounded_a_001')).ok,true);
assert.equal((await reserve(B,'g44_unbounded_b_001')).ok,true);
assert.equal((await reserve(B,'g44_unbounded_b_002')).ok,true);
assert.equal((await budget()).reserved_nano_usd,1500);assert.equal((await budget()).limit_nano_usd,null);
await sql('UPDATE public.jenios_pro_config_b143 SET crypto_allowance_nano_usd=1000;');
const individual=await Promise.all([1,2].map(i=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${reserveSql(D,'g44_individual_race_'+i)}; SELECT pg_sleep(0.1); COMMIT;`)));
assert.deepEqual(individual.map(JSON.parse).map(x=>x.code).sort(),['INCLUDED_ALLOWANCE_EXHAUSTED','RESERVED']);
assert.equal(await sql(`SELECT reserved_nano_usd FROM public.jenios_pro_periods_b143 WHERE user_id=${literal(D)}::uuid`),'1000');
console.log('G44_PRO_UNCAPPED_GLOBAL_USAGE_WITH_INDIVIDUAL_ALLOWANCE_CONCURRENCY_PASS');

const beforeReturn=await budget();
assert.equal((await json('SET ROLE service_role; SELECT '+dispatchSql(B,'g44_unbounded_b_001'))).acquired,true);
await sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='capped',monthly_provider_limit_nano_usd=1;");
assert.equal((await reserve(A,'g44_return_to_low_cap_001',1)).code,'GLOBAL_BUDGET_EXHAUSTED');
assert.equal((await json('SET ROLE service_role; SELECT '+dispatchSql(A,'g44_unbounded_a_001'))).code,'GENERATION_DISABLED');
assert.deepEqual(await budget(),beforeReturn);
// A lower cap cannot erase or prevent accounting for an already-dispatched call.
assert.equal((await settle(B,'g44_unbounded_b_001',50,'resp_g44_after_downgrade')).chargedNanoUsd,100);
assert.equal((await budget()).spent_nano_usd,beforeReturn.spent_nano_usd+50);
assert.equal((await budget()).reserved_nano_usd,beforeReturn.reserved_nano_usd-500);
await sql('UPDATE public.jenios_pro_config_b143 SET monthly_provider_limit_nano_usd=10000;');
assert.equal((await reserve(A,'g44_return_to_cap_ok_001',1)).ok,true);
assert.equal((await budget()).monthly_budget_mode,'capped');assert.equal((await budget()).limit_nano_usd,10000);
assert.equal((await budget()).spent_nano_usd,beforeReturn.spent_nano_usd+50);
assert.equal((await release(A,'g44_return_to_cap_ok_001')).ok,true);
await sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='uncapped',monthly_provider_limit_nano_usd=0;");
console.log('G44_PRO_POLICY_TRANSITION_NEVER_RESETS_OR_FORGIVES_USAGE_PASS');

const beforeReconciliation=await budget();
assert.equal((await json('SET ROLE service_role; SELECT '+dispatchSql(A,'g44_unbounded_a_001'))).acquired,true);
const mark=await json(`SET ROLE service_role; SELECT public.jenios_pro_reconcile_b143(${literal(A)}::uuid,'g44_unbounded_a_001',${literal(fingerprint('g44_unbounded_a_001'))},'mark_unknown',NULL,NULL,NULL,NULL,'{"reason":"Local fixture simulates uncertain provider transport"}'::jsonb)`);
assert.equal(mark.state,'needs_reconciliation');
assert.equal(await sql('SELECT NOT generation_enabled AND requires_reconciliation FROM public.jenios_pro_config_b143'),'t');
assert.equal((await reserve(A,'g44_reconciliation_blocks_001',1)).code,'GENERATION_DISABLED');
await assert.rejects(sql('UPDATE public.jenios_pro_config_b143 SET generation_enabled=true;'),/Resolve Pro reconciliation/);
assert.equal((await budget()).reserved_nano_usd,beforeReconciliation.reserved_nano_usd);
await assert.rejects(sql("UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='unlimited';"),/check constraint/);
console.log('G44_PRO_UNCAPPED_RECONCILIATION_HOLD_AND_REENABLE_GUARD_PASS');
console.log('G44_BUDGET_POSTGRES_ALL_PASS');
