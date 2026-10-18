-- JENIOS S05-B43: transactional adversarial RLS certification.
-- Isolated Supabase project rebzztxlzofxpfwjvbee ONLY.
-- All synthetic rows rolled back, no external side effects.
BEGIN;
DO $guard$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.jenios_s04_staging_guard_20261017
   WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017'
     AND environment='isolated-test-project'
 ) THEN RAISE EXCEPTION 'S05_B43_REQUIRES_ISOLATED_STAGING'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
 )) THEN RAISE EXCEPTION 'S05_B43_IDENTITY_COLLISION'; END IF;
END $guard$;
INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at,raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','s05-b43-owner@example.invalid',now(),now(),'{"full_name":"Owner Fixture","handle":"s05_b43_owner","registration_source":"social"}'::jsonb),
('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','s05-b43-follower@example.invalid',now(),now(),'{"full_name":"Follower Fixture","handle":"s05_b43_follower","registration_source":"social"}'::jsonb),
('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','s05-b43-blocker@example.invalid',now(),now(),'{"full_name":"Blocker Fixture","handle":"s05_b43_blocker","registration_source":"social"}'::jsonb);
DO $accounts$
BEGIN
 IF (SELECT COUNT(*) FROM public.profiles WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
 ))<>3 THEN RAISE EXCEPTION 'S05_B43_SIGNUP_PROFILE_MISSING'; END IF;
END $accounts$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
       set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.posts(id,author_id,body)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','S05-B43 owner fixture');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true),
       set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.posts(id,author_id,body)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','S05-B43 blocker fixture');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
       set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.comments(id,post_id,author_id,body)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','S05 B43 permitted comment');
INSERT INTO public.post_likes(post_id,user_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');
INSERT INTO public.saved_posts(post_id,user_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');
INSERT INTO public.follows(follower_id,following_id) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
INSERT INTO public.stories(id,author_id,media_type,shared_post_id)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','post','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
DO $follower$
BEGIN
 IF (SELECT COUNT(*) FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
   OR (SELECT COUNT(*) FROM public.comments WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
   OR (SELECT COUNT(*) FROM public.saved_posts WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
   OR (SELECT COUNT(*) FROM public.stories WHERE shared_post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
 THEN RAISE EXCEPTION 'S05_B43_INTERACTION_NOT_VISIBLE_TO_FOLLOWER'; END IF;
 DELETE FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 IF FOUND THEN RAISE EXCEPTION 'S05_B43_FOREIGN_POST_DELETED'; END IF;
END $follower$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true),
       set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
DO $blocker$
BEGIN
 IF EXISTS(SELECT 1 FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'S05_B43_BLOCKER_SEES_BLOCKED_POST'; END IF;
 BEGIN
   INSERT INTO public.post_likes(post_id,user_id)
     VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
   RAISE EXCEPTION 'S05_B43_BLOCKED_LIKE_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.comments(post_id,author_id,body)
     VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','forbidden');
   RAISE EXCEPTION 'S05_B43_BLOCKED_COMMENT_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.follows(follower_id,following_id)
     VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
   RAISE EXCEPTION 'S05_B43_BLOCKED_FOLLOW_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $blocker$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
       set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
DO $owner_blocked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.posts WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'S05_B43_REVERSE_BLOCK_VISIBILITY_LEAK'; END IF;
END $owner_blocked$;
UPDATE public.posts SET archived_at=now()
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $archive_owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'S05_B43_OWNER_CANNOT_SEE_ARCHIVED_POST'; END IF;
END $archive_owner$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
       set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
DO $archive_follower$
BEGIN
 IF EXISTS(SELECT 1 FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  OR EXISTS(SELECT 1 FROM public.saved_posts WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  OR EXISTS(SELECT 1 FROM public.stories WHERE shared_post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'S05_B43_ARCHIVED_CONTENT_VISIBLE_TO_OTHER_USER'; END IF;
END $archive_follower$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
       set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
DELETE FROM public.posts WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $cascade$
BEGIN
 IF EXISTS(SELECT 1 FROM public.comments WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  OR EXISTS(SELECT 1 FROM public.post_likes WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  OR EXISTS(SELECT 1 FROM public.saved_posts WHERE post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  OR EXISTS(SELECT 1 FROM public.stories WHERE shared_post_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'S05_B43_POST_DELETE_NOT_CASCADED'; END IF;
END $cascade$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $anonymous$
BEGIN
 BEGIN
  PERFORM * FROM public.posts;
  RAISE EXCEPTION 'S05_B43_ANON_READS_PROTECTED_FEED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anonymous$;
RESET ROLE;
ROLLBACK;
SELECT 'S05_B43_THREE_USER_RLS_BLOCK_ARCHIVE_CASCADE_ANON_ALL_PASS_ROLLBACK' AS result;
