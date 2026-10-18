-- S05-B44 transactional 3-user YouTube Live and report test (isolated Supabase only).
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017
 WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'S05_B44_NOT_ISOLATED'; END IF;
END $guard$;
INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at,raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','s05-b44-a@example.invalid',now(),now(),'{"registration_source":"social","full_name":"Fake One","handle":"s05_b44_a"}'::jsonb),
('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','s05-b44-b@example.invalid',now(),now(),'{"registration_source":"social","full_name":"Fake Two","handle":"s05_b44_b"}'::jsonb),
('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','s05-b44-c@example.invalid',now(),now(),'{"registration_source":"social","full_name":"Fake Three","handle":"s05_b44_c"}'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),
set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.lives(id,host_id,title,youtube_video_id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Vídeo YouTube de teste','AbCdEfG1234');
DO $owner$ BEGIN
 IF (SELECT count(*) FROM public.lives WHERE host_id='11111111-1111-4111-8111-111111111111')<>1
 THEN RAISE EXCEPTION 'S05_B44_OWNER_LIVE_MISSING'; END IF;
 BEGIN
  INSERT INTO public.lives(host_id,title,youtube_video_id)
  VALUES('11111111-1111-4111-8111-111111111111','Duplicated video','AbCdEfG1234');
  RAISE EXCEPTION 'S05_B44_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.lives(host_id,title,youtube_video_id)
  VALUES('11111111-1111-4111-8111-111111111111','Invalid source','https://youtube.com');
  RAISE EXCEPTION 'S05_B44_INVALID_VIDEO_ACCEPTED';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $owner$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true),
set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
DO $viewer$ BEGIN
 IF (SELECT count(*) FROM public.lives WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
 THEN RAISE EXCEPTION 'S05_B44_VIEWER_CANNOT_SEE_LIVE'; END IF;
 DELETE FROM public.lives WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 IF FOUND THEN RAISE EXCEPTION 'S05_B44_NONOWNER_DELETED_LIVE'; END IF;
END $viewer$;
INSERT INTO public.reports(id,reporter_id,target_type,target_id,reason,details)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','live',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fraud','Live test report');
DO $viewer_report$ BEGIN
 IF (SELECT count(*) FROM public.reports WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1
 THEN RAISE EXCEPTION 'S05_B44_OWN_REPORT_NOT_READABLE'; END IF;
 BEGIN
  INSERT INTO public.reports(reporter_id,target_type,target_id,reason,details,status)
  VALUES('22222222-2222-4222-8222-222222222222','live','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'fraud','forged resolution','resolved');
  RAISE EXCEPTION 'S05_B44_FORGED_RESOLVED_REPORT_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $viewer_report$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true),
set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
DO $third$ BEGIN
 IF EXISTS(SELECT 1 FROM public.reports WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'S05_B44_REPORT_PRIVACY_VIOLATION'; END IF;
END $third$;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
DO $blocker$ BEGIN
 IF EXISTS(SELECT 1 FROM public.lives WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'S05_B44_BLOCKED_LIVE_VISIBLE'; END IF;
 BEGIN
  INSERT INTO public.reports(reporter_id,target_type,target_id,reason,details)
  VALUES('33333333-3333-4333-8333-333333333333','live','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'other','forbidden report');
  RAISE EXCEPTION 'S05_B44_BLOCKED_REPORT_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $blocker$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $guest$ BEGIN
 BEGIN PERFORM 1 FROM public.lives;
  RAISE EXCEPTION 'S05_B44_ANON_LIVES_VISIBLE';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM public.reports;
  RAISE EXCEPTION 'S05_B44_ANON_REPORTS_VISIBLE';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $guest$;
RESET ROLE;
ROLLBACK;
SELECT 'S05_B44_LIVES_REPORTS_OWNER_BLOCK_RLS_ALL_PASS_ROLLBACK' AS result;
