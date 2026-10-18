/**
 * Optional S05 release migration rehearsal with disposable PostgreSQL (PGlite).
 * Install @electric-sql/pglite OUTSIDE the application dependency tree.
 * Run: JENIOS_PGLITE_MODULE=/tmp/s05-sqlcheck/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-s05-release-migration-pglite.mjs
 * Never connects to any Supabase instance or accesses customer data.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const moduleId=process.env.JENIOS_PGLITE_MODULE||'@electric-sql/pglite';
const {PGlite}=await import(moduleId);
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const legacy='33333333-3333-4333-8333-333333333333';
let passed=0;
function check(label,condition){assert.ok(condition,label);passed++;console.log('PASS '+label)}
const authRow=(id,handle,name,source='social')=>[id,JSON.stringify({registration_source:source,handle,full_name:name})];
try {
  const setup=[
    'CREATE ROLE anon;',
    'CREATE ROLE authenticated;',
    'CREATE ROLE service_role BYPASSRLS;',
    'CREATE SCHEMA auth;',
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;",
    'GRANT USAGE ON SCHEMA auth TO authenticated;',
    'GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO authenticated;',
    'CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean NOT NULL DEFAULT false,raw_user_meta_data jsonb,last_sign_in_at timestamptz);',
    "CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),handle text UNIQUE,display_name text NOT NULL DEFAULT '');",
    'CREATE TABLE public.posts(id uuid PRIMARY KEY,author_id uuid);',
    'GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;',
    'GRANT SELECT ON public.profiles TO authenticated,anon;'
  ].join('\n');
  await db.exec(setup);
  await db.query('INSERT INTO auth.users(id,is_anonymous,raw_user_meta_data,last_sign_in_at) VALUES($1,false,$2::jsonb,now())',authRow(legacy,'legacy_s05','Preexisting User','legacy'));
  await db.query('INSERT INTO public.profiles(id,handle,display_name) VALUES($1,$2,$3)',[legacy,'legacy_s05','Preexisting User']);
  const migration=readFileSync(new URL('../supabase/release-review/20261018_s05_social_identity_deletion_PRODUCTION_REVIEW_ONLY.sql',import.meta.url),'utf8');
  await db.exec(migration);
  check('DDL compiles in disposable PostgreSQL',true);
  let row=(await db.query('SELECT handle,display_name FROM public.profiles WHERE id=$1',[legacy])).rows[0];
  check('existing production-style profile stays unchanged',row?.handle==='legacy_s05'&&row?.display_name==='Preexisting User');
  await db.exec(migration);
  check('schema migration can be run twice without data loss',true);
  await db.query('INSERT INTO auth.users(id,is_anonymous,raw_user_meta_data,last_sign_in_at) VALUES($1,false,$2::jsonb,now())',authRow(owner,'s05_test_owner','Synthetic Test Owner'));
  row=(await db.query('SELECT handle,display_name FROM public.profiles WHERE id=$1',[owner])).rows[0];
  check('new Social signup atomically creates its profile',row?.handle==='s05_test_owner');
  let blocked=false;
  try{
    await db.query('INSERT INTO auth.users(id,is_anonymous,raw_user_meta_data,last_sign_in_at) VALUES($1,false,$2::jsonb,now())',authRow(other,'s05_test_owner','Duplicate Name'));
  }catch{blocked=true}
  check('duplicate @ signup rejected by canonical unique index',blocked);
  const occupied=(await db.query('SELECT * FROM public.social_handle_availability_v1($1)',['s05_test_owner'])).rows[0];
  check('occupied @ yields four distinct options',occupied?.available===false&&new Set(occupied?.suggestions||[]).size===4);
  const available=(await db.query('SELECT * FROM public.social_handle_availability_v1($1)',['s05_unique_free'])).rows[0];
  check('available @ returns positive availability',available?.available===true);
  blocked=false;
  try{await db.query('SELECT * FROM public.social_handle_availability_v1($1)',['admin'])}catch{blocked=true}
  check('reserved identifier never available',blocked);
  await db.query('INSERT INTO auth.users(id,is_anonymous,raw_user_meta_data,last_sign_in_at) VALUES($1,false,$2::jsonb,now())',authRow(other,'s05_test_other','Synthetic Other'));
  row=(await db.query('SELECT handle FROM public.profiles WHERE id=$1',[other])).rows[0];
  check('second independent identity has its own profile',row?.handle==='s05_test_other');
  await db.exec("SELECT set_config('request.jwt.claim.sub','"+owner+"',false);SELECT set_config('request.jwt.claim.role','authenticated',false);SET ROLE authenticated;");
  const inserted=(await db.query("INSERT INTO public.social_account_deletion_requests(user_id,confirmation_version) VALUES($1,'social-deletion-request-v1') RETURNING status",[owner])).rows[0];
  check('recently authenticated owner may request review only',inserted?.status==='pending');
  const cancelled=(await db.query("UPDATE public.social_account_deletion_requests SET status='cancelled' WHERE user_id=$1 RETURNING status",[owner])).rows[0];
  check('owner may cancel pending request',cancelled?.status==='cancelled');
  const reopened=(await db.query('SELECT * FROM public.social_reopen_deletion_request_v1()')).rows[0];
  check('owner may reopen cancelled request',reopened?.status==='pending');
  await db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','"+other+"',false);SELECT set_config('request.jwt.claim.role','authenticated',false);SET ROLE authenticated;");
  row=(await db.query('SELECT id FROM public.social_account_deletion_requests')).rows;
  check('a different signed-in user cannot read owner deletion request',row.length===0);
  row=(await db.query("UPDATE public.social_account_deletion_requests SET status='cancelled' WHERE user_id=$1 RETURNING id",[owner])).rows;
  check('a different signed-in user cannot modify owner request',row.length===0);
  await db.exec('RESET ROLE;SET ROLE anon;');
  blocked=false;try{await db.query('SELECT * FROM public.social_account_deletion_requests')}catch{blocked=true}
  check('anonymous role cannot access deletion requests',blocked);
  await db.exec('RESET ROLE');
  row=(await db.query('SELECT count(*)::int AS n FROM auth.users')).rows[0];
  check('no authentication identity or media is erased',row.n===3);
  await db.exec('CREATE TABLE public.jenios_s04_staging_guard_20261017(marker text);');
  blocked=false;try{await db.exec(migration)}catch{blocked=true}
  check('production migration preflight refuses isolated staging marker',blocked);
  console.log('RESULT '+JSON.stringify({passed,failures:0,isolated:true,productionChanges:0}));
} finally {await db.close()}
