import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POST_FIELDS} from '../../lib/social/schema.mjs';

const source=readFileSync('supabase/staging/20261018_s05_b16_social_feed_isolated.sql','utf8');
const get=(path)=>readFileSync(path,'utf8');

test('B16 SQL cannot be applied without the independent S04 staging marker',()=>{
 assert.match(source,/ONLY isolated project rebzztxlzofxpfwjvbee/);
 assert.match(source,/jenios_s04_staging_guard_20261017/);
 assert.match(source,/S05_NOT_AN_ISOLATED_PROJECT/);
 assert.match(source,/S05_FEED_ALREADY_PRESENT_MANUAL_REVIEW_REQUIRED/);
 assert.doesNotMatch(source,/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bSERVICE_ROLE\b/i);
});
test('B16 stage PostgREST posts contract exactly includes current route fields',()=>{
 assert.equal(POST_FIELDS,'id,author_id,body,media_type,media_path,created_at,archived_at');
 assert.match(source,/CREATE TABLE public\.posts\s*\(/);
 for(const field of POST_FIELDS.split(',')) assert.match(source,new RegExp('\\b'+field+'\\b'));
 for(const table of ['user_blocks','post_likes','comments','comment_likes','follows','saved_posts','stories'])
   assert.match(source,new RegExp('CREATE TABLE public\\.'+table+'\\s*\\('));
 assert.doesNotMatch(source,/CREATE TABLE public\.jenios_social_posts/);
});
test('B16 all eight Social tables enable RLS and exclude anon table grants',()=>{
 const tables=['posts','user_blocks','post_likes','comments','comment_likes','follows','saved_posts','stories'];
 for(const table of tables) assert.match(source,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY'));
 assert.match(source,/REVOKE ALL ON public\.posts,[\s\S]+ FROM PUBLIC,anon/);
 assert.match(source,/GRANT SELECT,INSERT,DELETE ON public\.posts TO authenticated/);
 assert.match(source,/GRANT UPDATE \(archived_at\) ON public\.posts TO authenticated/);
});
test('B16 only the post owner may create, delete, or archive; archived posts are private',()=>{
 for(const op of ['INSERT','DELETE','UPDATE']) assert.match(source,new RegExp('CREATE POLICY posts_\\w+ ON public\\.posts FOR '+op));
 assert.match(source,/posts_archive_private[\s\S]*?archived_at IS NULL OR author_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(source,/posts_visibility[\s\S]*?jenios_social_private\.visible_post/);
 assert.match(source,/coalesce\(auth\.jwt\(\)->>'is_anonymous','false'\)='false'/);
 assert.match(get('app/api/social/posts/route.js'),/ctx\.db\.from\("posts"\)/);
});
test('B16 social isolation includes blocked users, comment authors and 24h stories',()=>{
 assert.match(source,/public\.user_blocks b/);
 assert.match(source,/b\.blocker_id=other_id AND b\.blocked_id=auth\.uid\(\)/);
 assert.match(source,/comments_insert_self[\s\S]*?author_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(source,/stories_visibility[\s\S]*?created_at>now\(\)-interval '24 hours'/);
 assert.match(source,/new\.expires_at:=NEW\.created_at\+interval '24 hours'/i);
 assert.match(source,/SECURITY INVOKER/);
});
test('B16 no production change and critical API hashes remain frozen',async()=>{
 const manifest=JSON.parse(get('docs/s05/CRITICAL-API-SHA256.json'));
 const {createHash}=await import('node:crypto');
 for(const [path,expected] of Object.entries(manifest)) assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),expected,path);
 const middleware=get('middleware.js');
 assert.match(middleware,/stagingRouteDecision/);
 assert.match(get('lib/staging/route-policy.mjs'),/return 'block'/);
});
