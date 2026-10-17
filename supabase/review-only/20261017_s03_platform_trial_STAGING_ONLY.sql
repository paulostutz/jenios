-- S03-B05 PROPOSAL ONLY. DO NOT APPLY TO LIVE DATABASE.
-- Requires signed, independently verified CPF via a server-side identity provider.
-- Review legal basis, purpose, retention/appeal procedures and LGPD compliance before migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_platform_trial_ledger_v1 (
 subject_digest text PRIMARY KEY CHECK (subject_digest ~ '^[0-9a-f]{64}$'),
 user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 started_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 identity_version text NOT NULL DEFAULT 'cpf-hmac-sha256-v1',
 CONSTRAINT trial_exact_seven_days CHECK (expires_at = started_at + interval '7 days')
);
ALTER TABLE public.jenios_platform_trial_ledger_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_platform_trial_ledger_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.jenios_platform_trial_ledger_v1 TO service_role;
-- No DELETE/UPDATE rights for clients or service-role RPC. Retain pseudonymous digest only
-- under a defined retention policy; it is NOT anonymous under the LGPD.
CREATE OR REPLACE FUNCTION public.platform_grant_person_trial_v1(p_user_id uuid,p_subject_digest text)
 RETURNS TABLE(outcome text,started_at timestamptz,expires_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start timestamptz; v_end timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'TRIAL_SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_user_id IS NULL OR p_subject_digest !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND u.is_anonymous IS NOT TRUE) THEN
  RAISE EXCEPTION 'TRIAL_INVALID_SUBJECT' USING ERRCODE='22023';
 END IF;
 v_start:=now();v_end:=v_start+interval '7 days';
 INSERT INTO public.jenios_platform_trial_ledger_v1(subject_digest,user_id,started_at,expires_at)
 VALUES(p_subject_digest,p_user_id,v_start,v_end)
 ON CONFLICT DO NOTHING
 RETURNING jenios_platform_trial_ledger_v1.started_at,jenios_platform_trial_ledger_v1.expires_at
 INTO v_start,v_end;
 IF FOUND THEN
  RETURN QUERY SELECT 'granted'::text,v_start,v_end;
 ELSE
  -- Do not expose another account or person's trial details.
  RETURN QUERY SELECT 'already_claimed'::text,NULL::timestamptz,NULL::timestamptz;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.platform_grant_person_trial_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_grant_person_trial_v1(uuid,text) TO service_role;
COMMIT;
