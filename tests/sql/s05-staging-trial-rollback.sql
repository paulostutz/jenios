-- S05-B06 requires staging guard. All synthetic trial entries rolled back; never charges or invokes provider.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017 WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'NOT_STAGING_REFUSE_TEST'; END IF;
END $guard$;
INSERT INTO auth.users(id,email,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
VALUES ('11111111-1111-4111-8111-111111115061','s05-test-61@example.invalid',now(),now(),'','','',''),
       ('11111111-1111-4111-8111-111111115062','s05-test-62@example.invalid',now(),now(),'','','','');
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111115061',true);
SET LOCAL ROLE authenticated;
DO $case$ DECLARE denied boolean:=false;BEGIN
 BEGIN PERFORM public.platform_grant_person_trial_v1('11111111-1111-4111-8111-111111115061',repeat('a',64));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'S05_TRIAL_RPC_PUBLICLY_EXECUTABLE'; END IF;
 denied:=false;
 BEGIN
  IF EXISTS(SELECT 1 FROM public.jenios_platform_trial_ledger_v1) THEN
   RAISE EXCEPTION 'S05_TRIAL_LEDGER_PUBLICLY_READABLE';
  END IF;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'S05_TRIAL_LEDGER_NO_RLS_PROOF'; END IF;
END $case$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true);
SET LOCAL ROLE service_role;
DO $case$ DECLARE v text; start_time timestamptz;end_time timestamptz;BEGIN
 SELECT outcome,started_at,expires_at INTO v,start_time,end_time
 FROM public.platform_grant_person_trial_v1('11111111-1111-4111-8111-111111115061',repeat('a',64));
 IF v<>'granted' OR end_time-start_time<>interval '168 hours' THEN RAISE EXCEPTION 'S05_FIRST_GRANT_INVALID'; END IF;
 SELECT outcome INTO v FROM public.platform_grant_person_trial_v1('11111111-1111-4111-8111-111111115062',repeat('a',64));
 IF v<>'already_claimed' THEN RAISE EXCEPTION 'S05_NEW_ACCOUNT_REUSE_ALLOWED'; END IF;
 SELECT outcome INTO v FROM public.platform_grant_person_trial_v1('11111111-1111-4111-8111-111111115061',repeat('b',64));
 IF v<>'already_claimed' THEN RAISE EXCEPTION 'S05_SAME_ACCOUNT_REUSE_ALLOWED'; END IF;
END $case$;
RESET ROLE;
SELECT 'PASS' AS s05_staging_trial, count(*) AS synthetic_rows_created_before_rollback FROM public.jenios_platform_trial_ledger_v1;
ROLLBACK;
