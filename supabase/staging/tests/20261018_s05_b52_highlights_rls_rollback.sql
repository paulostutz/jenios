-- S05-B52 isolated transaction only; synthetic identities; ROLLBACK always.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.jenios_s04_staging_guard_20261017
   WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'B52_NOT_STAGING'; END IF;
 IF to_regclass('public.social_highlight_collections') IS NULL
 OR to_regclass('public.social_highlight_items') IS NULL THEN
  RAISE EXCEPTION 'B52_HIGHLIGHTS_NOT_INSTALLED'; END IF;
END $guard$;
INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at,raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','s05-b52-a@example.invalid',now(),now(),'{"registration_source":"social","handle":"s05_b52_alpha","full_name":"S05 Synthetic A"}'::jsonb),
('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','s05-b52-b@example.invalid',now(),now(),'{"registration_source":"social","handle":"s05_b52_beta","full_name":"S05 Synthetic B"}'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.stories(id,author_id,media_type,media_path)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','video',
'https://rebzztxlzofxpfwjvbee.supabase.co/storage/v1/object/public/social-media/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.mp4');
INSERT INTO public.social_highlight_collections(id,owner_id,title)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Viagens');
INSERT INTO public.social_highlight_items(id,collection_id,owner_id,source_story_id,media_type,media_path)
VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','image','https://malicious.invalid/evil.jpg');
DO $check$
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM public.social_highlight_items
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND media_type='video'
 AND media_path LIKE '%/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.mp4'
 ) THEN RAISE EXCEPTION 'B52_SNAPSHOT_NOT_IMMUTABLE_OR_NOT_PERSISTED'; END IF;
END $check$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
DO $foreign$
BEGIN
 BEGIN
  INSERT INTO public.social_highlight_items(collection_id,owner_id,source_story_id,media_type,media_path)
  VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','video','https://malicious.invalid');
  RAISE EXCEPTION 'B52_FOREIGN_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL; END;
 IF (SELECT count(*) FROM public.social_highlight_collections
 WHERE owner_id='11111111-1111-4111-8111-111111111111')<>1 THEN
  RAISE EXCEPTION 'B52_AUTHORIZED_VIEW_MISSING'; END IF;
END $foreign$;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
DO $blocked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.social_highlight_collections
 WHERE owner_id='11111111-1111-4111-8111-111111111111')
 OR EXISTS(SELECT 1 FROM public.social_highlight_items
 WHERE owner_id='11111111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'B52_BLOCKED_VIEWER_CAN_READ'; END IF;
END $blocked$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
DELETE FROM public.stories WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $deleted$
BEGIN
 IF EXISTS (SELECT 1 FROM public.social_highlight_items
 WHERE source_story_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
  RAISE EXCEPTION 'B52_DELETED_STORY_HIGHLIGHT_LEAKED'; END IF;
END $deleted$;
RESET ROLE;
ROLLBACK;
SELECT 'S05_B52_HIGHLIGHTS_RLS_PIN_BLOCK_CASCADE_ROLLBACK_PASS' AS status;
