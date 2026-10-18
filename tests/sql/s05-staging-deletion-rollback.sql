-- S05-B05 only in Supabase project rebzztxlzofxpfwjvbee.
-- All synthetic records MUST rollback. No raw secrets or real identities.
BEGIN;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017
               WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'NOT_STAGING_REFUSE_TEST'; END IF;
END $guard$;
INSERT INTO auth.users(id,email,last_sign_in_at,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at)
VALUES
 ('11111111-1111-4111-8111-111111115051','s05-test-51@example.invalid',now(),'{}'::jsonb,'','','','',now(),now()),
 ('11111111-1111-4111-8111-111111115052','s05-test-52@example.invalid',now(),'{}'::jsonb,'','','','',now(),now());
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111115051',true),set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $cases$
DECLARE n int; status_val text;
BEGIN
 INSERT INTO public.social_account_deletion_requests(user_id,confirmation_version)
 VALUES('11111111-1111-4111-8111-111111115051','social-deletion-request-v1');
 IF (SELECT count(*) FROM public.social_account_deletion_requests)<>1 THEN RAISE EXCEPTION 'S05_CASE_OWNER_READ_FAILED'; END IF;
 UPDATE public.social_account_deletion_requests SET status='cancelled'
  WHERE user_id=auth.uid() AND status='pending';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'S05_CASE_CANCEL_FAILED'; END IF;
 PERFORM public.social_reopen_deletion_request_v1();
 SELECT status INTO status_val FROM public.social_account_deletion_requests WHERE user_id=auth.uid();
 IF status_val<>'pending' THEN RAISE EXCEPTION 'S05_CASE_REOPEN_FAILED'; END IF;
END $cases$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111115052',true);
DO $cases$
DECLARE n int;
BEGIN
 IF EXISTS(SELECT 1 FROM public.social_account_deletion_requests)
 THEN RAISE EXCEPTION 'S05_OTHER_OWNER_READABLE'; END IF;
 UPDATE public.social_account_deletion_requests SET status='cancelled';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'S05_OTHER_OWNER_CAN_UPDATE'; END IF;
END $cases$;
RESET ROLE;
SELECT 'PASS' AS s05_staging_deletion,
 (SELECT string_agg(event,',' ORDER BY id) FROM public.social_account_deletion_audit_v1 WHERE actor_id='11111111-1111-4111-8111-111111115051') AS audit_sequence;
ROLLBACK;
