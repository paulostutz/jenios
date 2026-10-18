import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('supabase/staging/20261018_s05_b34_comments_rls_recursion_fix.sql','utf8');
const original=readFileSync('supabase/staging/20261018_s05_b16_social_feed_isolated.sql','utf8');
const route=readFileSync('app/api/social/comments/route.js','utf8');

test('B34 migration refuses any project without isolated staging marker',()=>{
 assert.match(sql,/S05_B34_NOT_ISOLATED/);
 assert.match(sql,/jenios_s04_staging_guard_20261017/);
 assert.match(sql,/S05_B34_REQUIRED_SCHEMA_MISSING/);
 assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP TABLE\b|auth\.admin\.deleteUser/i);
});
test('B34 removes self-referential recursive comments INSERT policy',()=>{
 assert.match(original,/FROM public\.comments c WHERE c\.id=parent_id/);
 assert.match(sql,/DROP POLICY IF EXISTS comments_insert_self ON public\.comments/);
 assert.match(sql,/CREATE POLICY comments_insert_self ON public\.comments FOR INSERT TO authenticated/);
 const replacement=sql.slice(sql.indexOf('CREATE POLICY comments_insert_self'));
 assert.doesNotMatch(replacement,/FROM public\.comments/);
 assert.match(replacement,/jenios_social_private\.valid_reply_parent_v1\(post_id,parent_id\)/);
});
test('B34 parent lookup uses a narrowly scoped private helper and cannot expose comment contents',()=>{
 assert.match(sql,/RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/jenios_social_private\.valid_reply_parent_v1/);
 assert.match(sql,/parent\.id=p_parent_id/);
 assert.match(sql,/parent\.post_id=p_post_id/);
 assert.match(sql,/parent\.parent_id IS NULL/);
 assert.match(sql,/REVOKE ALL ON FUNCTION jenios_social_private\.valid_reply_parent_v1/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION jenios_social_private\.valid_reply_parent_v1/);
});
test('B34 every comment insert still requires the session owner and visible post',()=>{
 assert.match(sql,/author_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/is_anonymous','false'\)='false'/);
 assert.match(sql,/EXISTS\(SELECT 1 FROM public\.posts post WHERE post\.id=comments\.post_id\)/);
});
test('B34 existing API restricts replies to the same post and forbids nested replies',()=>{
 assert.match(route,/parent\.post_id !== input\.postId/);
 assert.match(route,/if \(parent\.parent_id\)/);
 assert.match(route,/\.insert\(\{post_id:input\.postId,author_id:ctx\.userId,parent_id:input\.parentId \|\| null/);
});
test('B34 production core APIs and database remain outside this staging migration',()=>{
 assert.doesNotMatch(sql,/\bjenios_pay\b|\bbankscore\b|CREATE\s+TABLE\s+public\.posts|CREATE\s+TABLE\s+public\.profiles/i);
 assert.match(sql,/Never apply this migration to JENIOS production/);
});
