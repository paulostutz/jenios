import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=p=>readFileSync(p,'utf8');
const prod=load('supabase/release-review/20261018_s05_b53_profile_pinned_posts.sql');
const stage=load('supabase/staging/20261018_s05_b53_profile_pinned_posts_isolated.sql');
const fixture=load('supabase/staging/tests/20261018_s05_b53_pinned_posts_rls_rollback.sql');
const api=load('app/api/social/pinned-posts/route.js');
const ui=load('app/components/SocialPinnedPosts.js');
const main=load('app/social/page.js');
const publicProfile=load('app/social/perfil/[id]/page.js');

test('B53 isolates pinned posts in additive table; existing financial APIs and feed schema untouched',()=>{
 assert.match(prod,/CREATE TABLE public\.social_pinned_posts\(/);
 assert.match(prod,/REFERENCES public\.posts\(id\) ON DELETE CASCADE/);
 assert.doesNotMatch(prod,/ALTER TABLE public\.posts|DROP TABLE|TRUNCATE|jenios.pay|bankscore|crypto_validator/i);
 assert.match(prod,/S05_B53_PRODUCTION_GUARD_REFUSES_STAGING/);
 assert.match(stage,/S05_B53_ISOLATED_STAGING_REQUIRED/);
 assert.match(stage,/JENIOS-S04-EXPLICIT-STAGING-20261017/);
});
test('B53 ownership, archived posts and maximum 3 pins enforced on database insertion',()=>{
 assert.match(prod,/NEW\.owner_id/);
 assert.match(prod,/p\.author_id=NEW\.owner_id AND p\.archived_at IS NULL/);
 assert.match(prod,/pg_advisory_xact_lock/);
 assert.match(prod,/existing_count>=3/);
 assert.match(prod,/SECURITY DEFINER SET search_path=''/);
 assert.match(prod,/REVOKE ALL ON FUNCTION jenios_social_private\.validate_social_pin_b53/);
});
test('B53 RLS enforces owner writes, blocks and hides archived posts from visitors',()=>{
 assert.match(prod,/ENABLE ROW LEVEL SECURITY/);
 assert.match(prod,/jenios_social_private\.can_interact\(owner_id\)/);
 assert.match(prod,/owner_id=\(SELECT auth\.uid\(\)\)/g);
 assert.match(prod,/p\.archived_at IS NULL/);
 assert.match(prod,/GRANT SELECT,INSERT,DELETE ON public\.social_pinned_posts TO authenticated/);
 assert.doesNotMatch(prod,/GRANT\s+\w+[^;]*\bTO\s+anon/);
});
test('B53 REST endpoints are account-scoped, no secret key or financial changes',()=>{
 assert.match(api,/socialContext\(request\)/g);
 assert.match(api,/validUUID\(ownerId\)/);
 assert.match(api,/\.eq\('owner_id',ctx\.userId\)/g);
 assert.match(api,/\.eq\('author_id',ctx\.userId\)\.is\('archived_at',null\)/);
 assert.match(api,/source\.data/);
 assert.doesNotMatch(api,/service_role|PAY_ADMIN_TOKEN|jenios-pay|SUPABASE_SECRET_KEY/);
});
test('B53 UI isolates session and supports owner pin/unpin in existing profile and public profile route',()=>{
 assert.match(ui,/createSessionFence/);
 assert.match(ui,/supabase\.auth\.getSession/);
 assert.match(ui,/session\?\.user\?\.id!==ticket\.owner/);
 assert.match(ui,/fence\.current\.current\(ticket\)/);
 assert.match(ui,/change\(selected,'POST'\)/);
 assert.match(ui,/change\(p\.id,'DELETE'\)/);
 assert.match(main,/SocialPinnedPosts/);
 assert.match(publicProfile,/SocialPinnedPosts/);
});
test('B53 synthetic RLS test is transactional, confirms owner, block, limit and cascade',()=>{
 assert.match(fixture,/^BEGIN;/m);
 assert.match(fixture,/^ROLLBACK;/m);
 assert.match(fixture,/B53_PIN_LIMIT/);
 assert.match(fixture,/B53_FOREIGN_OWNER_FORBIDDEN/);
 assert.match(fixture,/B53_BLOCKED_VIEWER/);
 assert.match(fixture,/B53_DELETE_CASCADE/);
});
