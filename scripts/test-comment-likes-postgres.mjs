const {PGlite}=await import(process.env.JENIOS_PGLITE_MODULE||'@electric-sql/pglite');
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;grant usage on schema auth to authenticated;create table profiles(id uuid primary key);create table comments(id uuid primary key);grant select on comments to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261015164036_social_comment_likes.sql',import.meta.url),'utf8'));
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
await db.query('insert into profiles values($1),($2)',[a,b]);await db.query('insert into comments values($1)',[c]);
async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,is_anonymous:false})]);await db.exec('set role authenticated');}
await as(a);await db.query('insert into comment_likes(comment_id,user_id) values($1,$2)',[c,a]);await assert.rejects(db.query('insert into comment_likes(comment_id,user_id) values($1,$2)',[c,b]));
let rows=(await db.query('select * from jenios_comment_like_stats($1)',[[c]])).rows;assert.equal(Number(rows[0].count),1);assert.equal(rows[0].liked,true);
await as(b);assert.equal((await db.query('delete from comment_likes returning *')).rows.length,0);assert.equal((await db.query('select * from jenios_comment_like_stats($1)',[[c]])).rows[0].liked,false);
await as(a);await db.query('delete from comment_likes where comment_id=$1',[c]);assert.equal(Number((await db.query('select * from jenios_comment_like_stats($1)',[[c]])).rows[0].count),0);
await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from comment_likes'));await assert.rejects(db.query('select * from jenios_comment_like_stats($1)',[[c]]));await db.close();console.log('PASS comment likes: real PostgreSQL ownership, counts, unlike, third-party deletion and anonymous denial');
