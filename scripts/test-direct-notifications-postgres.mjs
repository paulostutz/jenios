const {PGlite}=await import(process.env.JENIOS_PGLITE_MODULE || '@electric-sql/pglite');import {readFile,readdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const root=new URL('../supabase/migrations/',import.meta.url).pathname;
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;` .replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'","select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
create table public.profiles(id uuid primary key,handle text,display_name text);create table public.user_blocks(blocker_id uuid,blocked_id uuid);
create table public.posts(id uuid primary key,author_id uuid);create table public.comments(id uuid,post_id uuid,author_id uuid);create table public.follows(follower_id uuid,following_id uuid);
create table public.jenios_pay_orders(id uuid primary key,user_id uuid not null references auth.users(id));`);
const files=await readdir(root);for(const suffix of ['_direct_notifications_consolidated.sql'])await db.exec(await readFile(root+files.find(x=>x.endsWith(suffix)),'utf8'));
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333',mid='44444444-4444-4444-8444-444444444444';
for(const id of [a,b,c])await db.query('insert into auth.users values($1);',[id]);for(const [id,handle] of [[a,'aaa'],[b,'bbb'],[c,'ccc']])await db.query('insert into profiles values($1,$2,$2)',[id,handle]);
async function as(id,anonymous=false){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,is_anonymous:anonymous})]);await db.exec('set role authenticated');}
await as(a);const tid=(await db.query('select public.jenios_open_direct_v7($1) as id',[b])).rows[0].id;
await db.query('select * from public.jenios_send_direct_v7($1,$2,$3)',[mid,tid,'Mensagem de teste']);
await db.query('select * from public.jenios_send_direct_v7($1,$2,$3)',[mid,tid,'Mensagem de teste']);
await as(b);assert.equal((await db.query('select * from jenios_direct_messages_v7')).rows.length,1);let notices=(await db.query('select * from jenios_social_notifications')).rows;assert.equal(notices.length,1);assert.equal(notices[0].user_id,b);
await db.query('update jenios_social_notifications set read_at=now() where id=$1',[notices[0].id]);await assert.rejects(db.query("update jenios_social_notifications set title='Forged'"));
await as(c);assert.equal((await db.query('select * from jenios_direct_messages_v7')).rows.length,0);assert.equal((await db.query('select * from jenios_social_notifications')).rows.length,0);await assert.rejects(db.query('select * from public.jenios_send_direct_v7($1,$2,$3)',['55555555-5555-4555-8555-555555555555',tid,'intrusion']));
await as(a,true);await assert.rejects(db.query('select public.jenios_open_direct_v7($1)',[b]));await db.exec('reset role');await db.query('insert into user_blocks values($1,$2)',[b,a]);await as(a);await assert.rejects(db.query('select * from public.jenios_send_direct_v7($1,$2,$3)',['55555555-5555-4555-8555-555555555555',tid,'blocked']));
await db.exec('reset role');
const postId='66666666-6666-4666-8666-666666666666';
await db.query('delete from user_blocks');
await db.query('insert into posts(id,author_id) values($1,$2)',[postId,b]);
await db.query('insert into comments(id,post_id,author_id) values(gen_random_uuid(),$1,$2)',[postId,a]);
assert.equal((await db.query("select target_url from jenios_social_notifications where kind='comment'")).rows[0].target_url,'/social?post='+postId);

await db.query('insert into comments(id,post_id,author_id) values(gen_random_uuid(),$1,$2)',[postId,b]);
assert.equal((await db.query("select count(*)::int as n from jenios_social_notifications where kind='comment'")).rows[0].n,1);
await db.query('insert into follows values($1,$2)',[a,b]);
assert.equal((await db.query("select user_id from jenios_social_notifications where kind='follow'")).rows[0].user_id,b);
await as(a);
assert.equal((await db.query('update jenios_social_notifications set read_at=now() returning id')).rows.length,0);
await assert.rejects(db.query("insert into jenios_social_notifications(user_id,kind,title) values($1,'direct','forged')",[b]));
await db.exec('reset role');
await db.exec(await readFile(root+files.find(x=>x.endsWith('_direct_notifications_consolidated.sql')),'utf8'));
await as(b);
assert.equal((await db.query('select * from jenios_direct_messages_v7')).rows.length,1);

console.log('PASS: migrations, two participants, third-party denial, notifications, read-only columns, idempotency, anonymous denial, blocks, comment UUID links, no self-notices, followers, denied forged events, repeatable migration.');await db.close();
