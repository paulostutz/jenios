/** G48 actual PostgreSQL 17 verification. Refuses hosted/shared databases. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G48_INTER_VAULT_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G48_INTER_VAULT_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G48_INTER_VAULT_TEST_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)
 ||target.search||target.hash||!/^jenios_inter_g48_vault_[a-z0-9_]+$/.test(dbName))
 throw Error('G48_INTER_VAULT_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432',
 '--username',decodeURIComponent(target.username||'postgres'),'--dbname',dbName,
 '--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',
 PGPASSFILE:'/tmp/jenios-g48-inter-vault-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',
 PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;});child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G48_INTER_VAULT_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G48_INTER_VAULT_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
const file=async path=>sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')")));
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','vault') AND c.relkind IN ('r','p','v','m')"),'0','Refusing nonempty database');
console.log('G48_POSTGRES_VERSION '+await sql('SHOW server_version'));
await sql(`
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA vault;
CREATE TABLE vault.secrets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret text NOT NULL,name text UNIQUE,description text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret,name,description FROM vault.secrets;
CREATE FUNCTION vault.create_secret(new_secret text,new_name text DEFAULT NULL,new_description text DEFAULT '') RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE sid uuid;BEGIN INSERT INTO vault.secrets(secret,name,description) VALUES(new_secret,new_name,new_description) RETURNING id INTO sid;RETURN sid;END $$;
CREATE FUNCTION vault.update_secret(secret_id uuid,new_secret text DEFAULT NULL,new_name text DEFAULT NULL,new_description text DEFAULT '') RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 BEGIN UPDATE vault.secrets SET secret=coalesce(new_secret,secret),name=coalesce(new_name,name),description=coalesce(new_description,description),updated_at=now() WHERE id=secret_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'secret not found';END IF;END $$;
`);
const migration='supabase/migrations/'+(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(name=>name.endsWith('_jenios_g48_inter_vault_setup.sql'));
assert.equal(migration,'supabase/migrations/20261025013000_jenios_g48_inter_vault_setup.sql');
await file(migration);await file(migration);
for(const table of ['jenios_inter_settings_b283','jenios_inter_setup_attempts_r40'])assert.equal(await sql('SELECT count(*) FROM public.'+table),'0');
assert.equal(await sql("SELECT count(*) FROM vault.secrets WHERE name='jenios_g48_inter_pix'"),'0');
for(const role of ['anon','authenticated']){
 assert.equal(await sql(`SELECT has_table_privilege('${role}','public.jenios_inter_settings_b283','SELECT')`),'f');
 assert.equal(await sql(`SELECT has_function_privilege('${role}','public.jenios_inter_load_b283()','EXECUTE')`),'f');
 assert.equal(await sql(`SELECT has_function_privilege('${role}','public.jenios_inter_store_verified_r40(integer,text,text,text,text,text,text,text,timestamptz)','EXECUTE')`),'f');
}
assert.equal(await sql("SELECT has_function_privilege('service_role','public.jenios_inter_load_b283()','EXECUTE')"),'t');
const result=JSON.parse(await file('tests/sql/jenios_inter_setup_g48_regression.sql'));
assert.deepEqual(result,{settings_after_rollback:0,attempts_after_rollback:0,secrets_after_rollback:0});
assert.equal(await sql("SELECT count(*) FROM vault.secrets WHERE name='jenios_g48_inter_pix'"),'0');
console.log('G48_VAULT_IDEMPOTENT_RLS_RATE_LIMIT_CAS_ROTATION_NO_SECRET_LEAK_ROLLBACK_PASS');
