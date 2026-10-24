/** Real PostgreSQL integration tests. No hosted database is accepted. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_EMAIL_R42_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_EMAIL_R42_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;
try{target=new URL(raw);}catch{throw Error('R42_TEST_DATABASE_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1));
const host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||
 !['127.0.0.1','::1','localhost'].includes(host)||target.search||target.hash||
 !/^jenios_email_r42_[a-z0-9_]+$/.test(dbName))throw Error('R42_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432',
 '--username',decodeURIComponent(target.username||'postgres'),'--dbname',dbName,
 '--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',PGPASSFILE:'/tmp/jenios-email-r42-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',
 PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});
 let out='',err='';
 child.stdout.on('data',data=>{out+=data;});child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('R42_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`R42_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
async function file(path){const result=await sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));
 const lines=result.split('\n').filter(line=>line.trim());if(lines.length)console.log(lines.join('\n'));}

const endpoint=await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')");
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(endpoint),'Server must actually be loopback');
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing a database that already has application objects');

await file('tests/sql/jenios-email-r42-fixture.sql');
await file('supabase/migrations/20261012_jenios_pay_v1.sql');
await file('supabase/migrations/20261015212117_inter_pix_confirmation_r21.sql');
// Baseline backend privileges supplied by the application's Pay foundation.
// New email tables/RPCs must grant their own rights in the actual migrations.
await sql(`GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_products,public.jenios_pay_orders,
 public.jenios_pay_payments,public.jenios_pay_subscriptions,public.jenios_pay_entitlements TO service_role;`);
const migrations=(await readdir(new URL('../supabase/migrations/',import.meta.url)))
 .filter(name=>/^202610(?:22|23)\d{6}_jenios_b305_.*\.sql$/.test(name)).sort();
assert.equal(migrations.length,15,'Load the complete original B305 email migration chain');
for(const name of migrations)await file('supabase/migrations/'+name);
await file('supabase/migrations/20261024175918_jenios_email_newsletter_admin_r42.sql');
await file('supabase/migrations/20261024180008_jenios_email_dispatch_safety_r42.sql');
await file('tests/sql/jenios-email-newsletter-r42.sql');
await file('tests/sql/jenios-email-dispatch-r42.sql');

// These records exist only in the disposable local/CI database. Independent
// PostgreSQL backends test advisory locks and row claims under overlapping calls.
await sql(`
 INSERT INTO auth.users(id,email) VALUES('42000000-0000-4000-8000-000000009001','concurrency-r42@example.invalid');
 INSERT INTO public.jenios_transactional_email_outbox_b305(id,user_id,event_kind,reference_key,status,attempts,first_attempt_at,lease_token,lease_until)
 SELECT ('42000000-0000-4000-8000-00000000900'||n)::uuid,'42000000-0000-4000-8000-000000009001',
 'social_welcome','concurrent-'||n,'processing',1,now(),
 ('42000000-0000-4000-8000-00000000910'||n)::uuid,now()+interval '2 minutes'
 FROM generate_series(2,4) n;
 SET ROLE service_role;
 SELECT reason FROM public.jenios_reserve_email_budget_r42('transactional',
 '42000000-0000-4000-8000-000000009002','42000000-0000-4000-8000-000000009102',repeat('a',64),2,10,1,2);
`);
const concurrentBudget=await Promise.all([3,4].map(n=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT reason FROM public.jenios_reserve_email_budget_r42('transactional',
 '42000000-0000-4000-8000-00000000900${n}','42000000-0000-4000-8000-00000000910${n}',repeat('${n}',64),2,10,1,2);
 SELECT pg_sleep(0.2); COMMIT;`)));
assert.deepEqual(concurrentBudget.map(x=>x.trim()).sort(),['DAILY_LIMIT','RESERVED']);
assert.equal(await sql('SELECT count(*) FROM public.jenios_email_budget_reservations_r42'),'2');
console.log('R42_CONCURRENT_SHARED_QUOTA_PASS');

await sql(`
 INSERT INTO public.jenios_email_preferences_b305(user_id,marketing_opt_in)
 VALUES('42000000-0000-4000-8000-000000009001',true);
 INSERT INTO public.jenios_marketing_email_ledger_b305(id,user_id,campaign_kind,campaign_key,step,due_at,next_attempt_at)
 SELECT ('42000000-0000-4000-8000-00000000920'||n)::uuid,'42000000-0000-4000-8000-000000009001',
 'no_plan_nurture','concurrent-'||n,n,now()-make_interval(mins=>3-n),now()-interval '1 minute'
 FROM generate_series(1,2) n;
`);
const concurrentCadence=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT count(*) FROM public.jenios_claim_marketing_email_r42(1,now()-interval '1 hour',24);
 SELECT pg_sleep(0.2); COMMIT;`)));
assert.deepEqual(concurrentCadence.map(x=>x.trim()).sort(),['0','1']);
assert.equal(await sql(`SELECT count(*) FROM public.jenios_marketing_email_ledger_b305
 WHERE status='planned' AND last_error_code='CADENCE_DEFERRED' AND next_attempt_at>now()
 AND cadence_deferred_until_r42=next_attempt_at AND attempts=0 AND first_attempt_at IS NULL`),'1');
console.log('R42_CONCURRENT_RECIPIENT_CADENCE_PASS');
await file('supabase/migrations/20261024181402_jenios_email_scheduler_r42.sql');
await file('tests/sql/jenios-email-scheduler-r42.sql');
console.log('PASS R42 real PostgreSQL: migration chain, newsletter, dispatch contracts, shared quota/cadence concurrency and scheduler stub.');
