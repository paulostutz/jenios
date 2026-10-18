-- S05-B50 — run ONLY following the migration with its final COMMIT removed.
-- Always inside the single BEGIN from the migration; final ROLLBACK.
-- All identities/posts/likes/notifications here are synthetic and rolled back.
DO $guard$
BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NOT NULL
 OR to_regprocedure('jenios_private.notify_like_event_v1()') IS NULL
 OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
 )) THEN
   RAISE EXCEPTION 'S05_B50_SYNTHETIC_ID_COLLISION_OR_WRONG_SCOPE';
 END IF;
END $guard$;
INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at,raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000000',
 '11111111-1111-4111-8111-111111111111','authenticated','authenticated',
 's05-b50-owner@example.invalid',now(),now(),
 '{"registration_source":"social","handle":"s05_b50_owner","full_name":"B50 Owner"}'::jsonb),
('00000000-0000-0000-0000-000000000000',
 '22222222-2222-4222-8222-222222222222','authenticated','authenticated',
 's05-b50-commenter@example.invalid',now(),now(),
 '{"registration_source":"social","handle":"s05_b50_commenter","full_name":"B50 Commenter"}'::jsonb),
('00000000-0000-0000-0000-000000000000',
 '33333333-3333-4333-8333-333333333333','authenticated','authenticated',
 's05-b50-blocked@example.invalid',now(),now(),
 '{"registration_source":"social","handle":"s05_b50_blocked","full_name":"B50 Blocked"}'::jsonb);
DO $profiles$
BEGIN
 IF (SELECT count(*) FROM public.profiles
  WHERE handle LIKE 's05_b50_%')<>3
 THEN RAISE EXCEPTION 'S05_B50_TEST_PROFILES_NOT_CREATED'; END IF;
END $profiles$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.posts(id,author_id,body) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111','S05-B50 like notification fixture'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111','S05-B50 archived post fixture');
-- Owner's own like must not notify the same person.
INSERT INTO public.post_likes(post_id,user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.comments(id,post_id,author_id,body)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '22222222-2222-4222-8222-222222222222','S05-B50 comment for like test');
INSERT INTO public.post_likes(post_id,user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');
INSERT INTO public.post_likes(post_id,user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')
 ON CONFLICT DO NOTHING;
-- A self-like on the comment must not notify the commenter.
INSERT INTO public.comment_likes(comment_id,user_id)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.comment_likes(comment_id,user_id)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111');
RESET ROLE;
-- Only fake rows are used. Superuser fixture bypass permits verifying suppression
-- even if RLS already prevents the blocked user's like.
INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true),
set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.post_likes(post_id,user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
UPDATE public.posts SET archived_at=now()
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
INSERT INTO public.post_likes(post_id,user_id)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');

DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.jenios_social_notifications
  WHERE kind='post_like'
    AND user_id='11111111-1111-4111-8111-111111111111'
    AND actor_id='22222222-2222-4222-8222-222222222222'
    AND target_url='/social?post=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 THEN
   RAISE EXCEPTION 'S05_B50_POST_LIKE_NOTIFICATION_MISSING_OR_DUPLICATE';
 END IF;
 IF (SELECT count(*) FROM public.jenios_social_notifications
  WHERE kind='comment_like'
    AND user_id='22222222-2222-4222-8222-222222222222'
    AND actor_id='11111111-1111-4111-8111-111111111111'
    AND target_url='/social?post=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 THEN
   RAISE EXCEPTION 'S05_B50_COMMENT_LIKE_NOTIFICATION_MISSING';
 END IF;
 IF EXISTS (SELECT 1 FROM public.jenios_social_notifications
  WHERE kind IN ('post_like','comment_like')
   AND (user_id=actor_id
     OR actor_id='33333333-3333-4333-8333-333333333333'
     OR target_url='/social?post=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')) THEN
   RAISE EXCEPTION 'S05_B50_SELF_BLOCKED_ARCHIVED_NOTIFICATION_LEAK';
 END IF;
 IF (SELECT count(*) FROM public.jenios_social_notifications
  WHERE kind IN ('post_like','comment_like'))<>2 THEN
   RAISE EXCEPTION 'S05_B50_UNEXPECTED_NOTIFICATION_COUNT';
 END IF;
END $assert$;
ROLLBACK;
SELECT
 to_regprocedure('jenios_private.notify_like_event_v1()') IS NULL AS function_not_committed,
 NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='jenios_notify_post_like_b50' AND NOT tgisinternal) AS trigger_not_committed,
 (SELECT count(*) FROM auth.users WHERE email LIKE 's05-b50-%@example.invalid') AS fake_users_left;
