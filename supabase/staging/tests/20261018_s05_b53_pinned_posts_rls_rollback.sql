-- JENIOS Social S05-B53: isolated stage only, synthetic identities, ALWAYS ROLLBACK.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017
  WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'B53_STAGING_REQUIRED'; END IF;
 IF to_regclass('public.social_pinned_posts') IS NULL THEN RAISE EXCEPTION 'B53_MIGRATION_MISSING'; END IF;
END $guard$;
INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at,raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000000','12121212-1212-4212-8212-121212121212','authenticated','authenticated','s05-b53-a@example.invalid',now(),now(),'{"registration_source":"social","handle":"s05_b53_alpha","full_name":"B53 Synthetic A"}'::jsonb),
('00000000-0000-0000-0000-000000000000','34343434-3434-4434-8434-343434343434','authenticated','authenticated','s05-b53-b@example.invalid',now(),now(),'{"registration_source":"social","handle":"s05_b53_beta","full_name":"B53 Synthetic B"}'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','12121212-1212-4212-8212-121212121212',true),
set_config('request.jwt.claims','{"sub":"12121212-1212-4212-8212-121212121212","role":"authenticated","is_anonymous":false}',true);
INSERT INTO public.posts(id,author_id,body) VALUES
('01010101-0101-4101-8101-010101010101','12121212-1212-4212-8212-121212121212','B53 Synthetic Post A1'),
('02020202-0202-4202-8202-020202020202','12121212-1212-4212-8212-121212121212','B53 Synthetic Post A2'),
('03030303-0303-4303-8303-030303030303','12121212-1212-4212-8212-121212121212','B53 Synthetic Post A3'),
('04040404-0404-4404-8404-040404040404','12121212-1212-4212-8212-121212121212','B53 Synthetic Post A4');
INSERT INTO public.social_pinned_posts(owner_id,post_id) VALUES
('12121212-1212-4212-8212-121212121212','01010101-0101-4101-8101-010101010101'),
('12121212-1212-4212-8212-121212121212','02020202-0202-4202-8202-020202020202'),
('12121212-1212-4212-8212-121212121212','03030303-0303-4303-8303-030303030303');
DO $limit$ BEGIN
 IF (SELECT count(*) FROM public.social_pinned_posts WHERE owner_id='12121212-1212-4212-8212-121212121212')<>3
 THEN RAISE EXCEPTION 'B53_THREE_PINS_MISSING'; END IF;
 BEGIN
  INSERT INTO public.social_pinned_posts(owner_id,post_id)
   VALUES('12121212-1212-4212-8212-121212121212','04040404-0404-4404-8404-040404040404');
  RAISE EXCEPTION 'B53_PIN_LIMIT_BYPASSED';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $limit$;
SELECT set_config('request.jwt.claim.sub','34343434-3434-4434-8434-343434343434',true),
set_config('request.jwt.claims','{"sub":"34343434-3434-4434-8434-343434343434","role":"authenticated","is_anonymous":false}',true);
DO $foreign$ BEGIN
 BEGIN
  INSERT INTO public.social_pinned_posts(owner_id,post_id)
   VALUES('34343434-3434-4434-8434-343434343434','04040404-0404-4404-8404-040404040404');
  RAISE EXCEPTION 'B53_FOREIGN_OWNER_FORBIDDEN_BYPASSED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $foreign$;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES('34343434-3434-4434-8434-343434343434','12121212-1212-4212-8212-121212121212');
DO $block$ BEGIN
 IF EXISTS(SELECT 1 FROM public.social_pinned_posts
 WHERE owner_id='12121212-1212-4212-8212-121212121212')
 THEN RAISE EXCEPTION 'B53_BLOCKED_VIEWER_CAN_SEE_PINS'; END IF;
END $block$;
SELECT set_config('request.jwt.claim.sub','12121212-1212-4212-8212-121212121212',true),
set_config('request.jwt.claims','{"sub":"12121212-1212-4212-8212-121212121212","role":"authenticated","is_anonymous":false}',true);
UPDATE public.posts SET archived_at=now() WHERE id='01010101-0101-4101-8101-010101010101';
DO $owner_archive$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.social_pinned_posts WHERE post_id='01010101-0101-4101-8101-010101010101')
 THEN RAISE EXCEPTION 'B53_OWNER_CANNOT_MANAGE_ARCHIVED_PIN'; END IF;
END $owner_archive$;
DELETE FROM public.posts WHERE id='01010101-0101-4101-8101-010101010101';
DO $cascade$ BEGIN
 IF EXISTS(SELECT 1 FROM public.social_pinned_posts WHERE post_id='01010101-0101-4101-8101-010101010101')
 THEN RAISE EXCEPTION 'B53_DELETE_CASCADE_FAILED'; END IF;
END $cascade$;
RESET ROLE;
ROLLBACK;
SELECT 'S05_B53_PIN_LIMIT_FOREIGN_BLOCK_ARCHIVE_CASCADE_ROLLBACK_PASS' AS status;
