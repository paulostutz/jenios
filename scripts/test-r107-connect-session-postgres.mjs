/** Run only against an EMPTY disposable loopback PostgreSQL database. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const target=new URL(process.env.JENIOS_R107_SESSION_TEST_DATABASE_URL||'invalid:');
const name=decodeURIComponent(target.pathname.slice(1));
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||
 target.search||target.hash||!/^jenios_r107_session_[a-z0-9_]+$/.test(name))throw Error('R107_DISPOSABLE_LOOPBACK_REQUIRED');
function sql(source){return new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','--no-password','--host',target.hostname.replace(/^\[|\]$/g,''),'--port',target.port||'5432',
  '--username',decodeURIComponent(target.username||'postgres'),'--dbname',name,'--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'],
  {env:{...process.env,PGPASSWORD:decodeURIComponent(target.password||''),PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c statement_timeout=5000 -c lock_timeout=3000'},stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',v=>{out+=v;});child.stderr.on('data',v=>{err+=v;});
 child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(Error('R107_SQL_FAILED '+err.slice(-2000))));child.stdin.end(source);
});}
const A='47000000-0000-4000-8000-000000000001',B='47000000-0000-4000-8000-000000000002';
const S='47000000-0000-4000-8000-000000000011',X='47000000-0000-4000-8000-000000000012';
const call=(owner,session)=>`public.jenios_r107_session_is_active('${owner}'::uuid,'${session}'::uuid)`;
assert.equal(await sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','public') and c.relkind in ('r','p','v','m')"),'0');
await sql(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
 create schema auth;create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
 insert into auth.sessions values('${S}','${A}',null),('${X}','${A}',now()-interval '1 second');`);
const source=readFileSync(new URL('../supabase/review/jenios_r107_connect_session_check.sql',import.meta.url),'utf8');
await sql(source);await sql(source); // Additive migration is safely repeatable.
for(const role of ['anon','authenticated']){
 await assert.rejects(sql(`set role ${role}; select ${call(A,S)};`),/permission denied/);
 await assert.rejects(sql(`set role ${role}; select jenios_connect_private.r107_session_is_active('${A}','${S}');`),/permission denied/);
}
assert.equal(await sql(`set role service_role;select ${call(A,S)};`),'t');
assert.equal(await sql(`set role service_role;select ${call(B,S)};`),'f');
assert.equal(await sql(`set role service_role;select ${call(A,X)};`),'f');
assert.equal(await sql('set role service_role;select public.jenios_r107_session_is_active(null,null);'),'f');
await assert.rejects(sql('set role service_role;select * from auth.sessions;'),/permission denied/);
assert.equal(await sql(`select ${call(A,S)};`),'f'); // Direct unscoped admin use is not an owner check.
await sql(`delete from auth.sessions where id='${S}';`);
assert.equal(await sql(`set role service_role;select ${call(A,S)};`),'f');
assert.equal(await sql("select prosecdef from pg_proc where oid='public.jenios_r107_session_is_active(uuid,uuid)'::regprocedure"),'f');
assert.equal(await sql("select has_function_privilege('anon','public.jenios_r107_session_is_active(uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.jenios_r107_session_is_active(uuid,uuid)','EXECUTE')"),'f');
console.log('R107_POSTGRES_SESSION_OWNERSHIP_EXPIRY_LOGOUT_AND_PRIVILEGES_PASS');
