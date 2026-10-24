-- B305-R21 — suppression acknowledgement after claim.
BEGIN;
CREATE OR REPLACE FUNCTION public.jenios_suppress_marketing_email_b305(p_id uuid,p_lease uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE suppressed_id uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_marketing_email_ledger_b305 l
 SET status='suppressed',lease_token=NULL,lease_until=NULL,last_error_code=left(coalesce(p_reason,'MARKETING_SUPPRESSED'),64)
 WHERE l.id=p_id AND l.status='processing' AND l.lease_token=p_lease AND l.lease_until>now()
 RETURNING l.id INTO suppressed_id;
 RETURN suppressed_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.jenios_suppress_marketing_email_b305(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_suppress_marketing_email_b305(uuid,uuid,text) TO service_role;
COMMIT;
