import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(p,'utf8');
const db=src('supabase/release-review/20261018_s05_b52_story_highlights.sql');
const stage=src('supabase/staging/20261018_s05_b52_story_highlights_isolated.sql');
const fixture=src('supabase/staging/tests/20261018_s05_b52_highlights_rls_rollback.sql');
const api=src('app/api/social/highlights/route.js');
const ui=src('app/social/destaques/page.js');
const page=src('app/social/page.js');

test('B52 permanent Highlights are separate from unchanged 24-hour Stories',()=>{
 assert.match(db,/CREATE TABLE public\.social_highlight_collections\(/);
 assert.match(db,/CREATE TABLE public\.social_highlight_items\(/);
 assert.doesNotMatch(db,/ALTER TABLE public\.stories|UPDATE public\.stories|DROP TABLE public\.stories/);
 assert.match(ui,/inclusive após 24 horas/);
 assert.match(ui,/setMyStories\(profileId===ticket\.owner/);
});
test('B52 SQL preflight protects production and staging from cross-deploy',()=>{
 assert.match(db,/S05_B52_PRODUCTION_GUARD_REFUSES_STAGING/);
 assert.match(stage,/S05_B52_ISOLATED_STAGING_REQUIRED/);
 assert.match(stage,/JENIOS-S04-EXPLICIT-STAGING-20261017/);
 assert.doesNotMatch(db,/\bTRUNCATE\b|\bDELETE FROM auth\.users\b|\bDROP TABLE\b/i);
 assert.match(fixture,/^ROLLBACK;/m);
});
test('B52 all Highlights use ownership and block-aware RLS for reading and writing',()=>{
 assert.match(db,/ENABLE ROW LEVEL SECURITY/g);
 assert.match(db,/jenios_social_private\.can_interact\(owner_id\)/g);
 assert.match(db,/owner_id=\(SELECT auth\.uid\(\)\)/g);
 assert.match(db,/REVOKE ALL ON public\.social_highlight_collections,public\.social_highlight_items FROM PUBLIC,anon/);
 assert.match(db,/GRANT SELECT,INSERT,DELETE ON public\.social_highlight_collections,public\.social_highlight_items TO authenticated/);
});
test('B52 no user can forge or link another account original Story to own Highlights',()=>{
 assert.match(db,/CREATE FUNCTION jenios_social_private\.highlight_snapshot_b52\(\)/);
 assert.match(db,/SECURITY DEFINER SET search_path=''/);
 assert.match(db,/s\.id=NEW\.source_story_id AND s\.author_id=NEW\.owner_id/);
 assert.match(db,/auth\.uid\(\) IS DISTINCT FROM NEW\.owner_id/);
 assert.match(db,/INTO NEW\.media_type,NEW\.media_path,NEW\.shared_post_id/);
 assert.match(db,/REVOKE ALL ON FUNCTION jenios_social_private\.highlight_snapshot_b52/);
});
test('B52 archived shared posts are not visible and deleted original stories cascade Highlights',()=>{
 assert.match(db,/p\.archived_at IS NULL/g);
 assert.match(db,/source_story_id uuid NOT NULL REFERENCES public\.stories\(id\) ON DELETE CASCADE/);
 assert.match(db,/shared_post_id uuid REFERENCES public\.posts\(id\) ON DELETE CASCADE/);
 assert.match(fixture,/B52_DELETED_STORY_HIGHLIGHT_LEAKED/);
 assert.match(fixture,/B52_BLOCKED_VIEWER_CAN_READ/);
});
test('B52 server API accesses only authenticated Social context and owner-bound modifications',()=>{
 assert.match(api,/socialContext\(request\)/g);
 assert.match(api,/select\('id,author_id,media_type,expires_at'\)/);
 assert.match(api,/\.eq\('id',storyId\)\.eq\('author_id',ctx\.userId\)/);
 assert.match(api,/\.eq\('id',itemId\)\.eq\('owner_id',ctx\.userId\)/);
 assert.match(api,/\.eq\('id',collectionId\)\.eq\('owner_id',ctx\.userId\)/);
 assert.match(api,/ownerId===ctx\.userId/);
 assert.match(api,/eligibleStories/);
 assert.doesNotMatch(api,/service_role|SUPABASE_SECRET_KEY|pay\\/|jenios-pay|createSignedUploadUrl/);
});
test('B52 authenticated UI prevents stale-session media and reuses safe existing video player',()=>{
 assert.match(ui,/createSessionFence/);
 assert.match(ui,/supabase\.auth\.getUser\(\)/);
 assert.match(ui,/supabase\.auth\.getSession\(\)/);
 assert.match(ui,/fence\.current\.current\(ticket\)/);
 assert.match(ui,/new URLSearchParams\(window\.location\.search\)/);
 assert.match(ui,/<SocialVideo src=\{viewer\.media_path\} postId=\{null\}/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|PAY_ADMIN_TOKEN|INTER_CLIENT_SECRET/);
});
test('B52 Highlights appear from desktop header, mobile quick navigation and visited profiles',()=>{
 assert.equal((page.match(/href="\/social\/destaques"/g)||[]).length,2);
 assert.match(page,/Destaques deste perfil/);
 assert.match(page,/encodeURIComponent\(perfilVisitado\.id\)/);
 assert.match(ui,/Selecione um Story seu \(ativo ou arquivado\)/);
});
test('B52 original critical financial API fingerprints remain intact',()=>{
 const hashes=JSON.parse(src('docs/release/S05-CRITICAL-API-SHA256.json'));
 for(const path of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js','app/api/jenios-pay/checkout/route.js'])
  assert.match(hashes[path],/^[a-f0-9]{64}$/);
});
