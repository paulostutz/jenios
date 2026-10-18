import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync('supabase/staging/20261018_s05_b44_live_report_isolated.sql','utf8');
const adversarial=readFileSync('supabase/staging/tests/20261018_s05_b44_live_reports_rls_rollback.sql','utf8');
const b43=readFileSync('supabase/staging/tests/20261018_s05_b43_adversarial_rls_rollback.sql','utf8');
const liveApi=readFileSync('app/api/social/lives/route.js','utf8');
const reportApi=readFileSync('app/api/social/reports/route.js','utf8');

test('B44 lives and reports migration absolutely requires isolated staging marker',()=>{
 assert.match(migration,/S05_B44_ISOLATED_STAGING_ONLY/);
 assert.match(migration,/S05_B44_REVIEW_EXISTING_SCHEMA/);
 assert.match(migration,/jenios_s04_staging_guard_20261017/);
 assert.doesNotMatch(migration,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
});
test('B44 live links are YouTube IDs only, not internal streaming or uploaded video objects',()=>{
 assert.match(migration,/youtube_video_id text NOT NULL CHECK\(youtube_video_id ~ '\^\[A-Za-z0-9_-\]\{11\}\$'\)/);
 assert.match(liveApi,/videoId/);
 assert.match(liveApi,/\[A-Za-z0-9_-\]\{11\}/);
 assert.doesNotMatch(migration,/stream_url|rtmp|playback_secret|ingest_key/i);
 assert.match(migration,/UNIQUE\(host_id,youtube_video_id\)/);
});
test('B44 read policy checks private moderation and user blocks with owner-only writes',()=>{
 assert.match(migration,/jenios_social_private\.can_interact\(visible_live\.host_id\)/);
 assert.match(migration,/CREATE POLICY social_lives_visibility ON public\.lives AS RESTRICTIVE/);
 assert.match(migration,/host_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(migration,/REVOKE ALL ON jenios_social_private\.hidden_lives FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/REVOKE ALL ON public\.lives,public\.reports FROM PUBLIC,anon/);
});
test('B44 report queue protects reporter identity and does not let reporters resolve cases',()=>{
 assert.match(reportApi,/\.from\('reports'\)\.insert/);
 assert.match(migration,/CREATE POLICY reports_read_self/);
 assert.match(migration,/reporter_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(migration,/status='pending'/);
 assert.match(migration,/GRANT SELECT,INSERT ON public\.reports TO authenticated/);
 assert.doesNotMatch(migration,/GRANT (ALL|UPDATE|DELETE) ON public\.reports TO authenticated/);
});
test('B43 and B44 adversarial SQL both always roll back all fake identities and records',()=>{
 for(const file of [b43,adversarial]){
  assert.match(file,/^BEGIN;/m);
  assert.match(file,/^ROLLBACK;/m);
  assert.match(file,/jenios_s04_staging_guard_20261017/);
  assert.match(file,/@example\.invalid/);
  assert.doesNotMatch(file,/\bCOMMIT\b|\bDROP TABLE\b/i);
 }
 assert.match(b43,/S05_B43_THREE_USER_RLS_BLOCK_ARCHIVE_CASCADE_ANON_ALL_PASS_ROLLBACK/);
 assert.match(adversarial,/S05_B44_LIVES_REPORTS_OWNER_BLOCK_RLS_ALL_PASS_ROLLBACK/);
});
