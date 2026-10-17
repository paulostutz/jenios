-- S04-B04 REVIEW / STAGING ONLY. NEVER APPLY TO ACTIVE SUPABASE.
-- Apply after S03 reviewed deletion queue and owner-only cancellation policy.
-- This upgrade is ADDITIVE: original INSERT, SELECT and owner-only pending cancellation remain intact.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.social_account_deletion_requests') IS NULL OR
    to_regprocedure('public.social_has_recent_auth_v1()') IS NULL THEN
  RAISE EXCEPTION 'S04 requires reviewed S03 queue and recent-auth policy';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.social_account_deletion_audit_v1(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid REFERENCES public.social_account_deletion_requests(id) ON DELETE SET NULL,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event text NOT NULL CHECK(event IN('requested','reopened','cancelled')),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_account_deletion_audit_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_account_deletion_audit_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.social_account_deletion_audit_v1 TO service_role;

CREATE OR REPLACE FUNCTION public.social_audit_deletion_state_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE action text;
BEGIN
 IF TG_OP='INSERT' THEN action:='requested';
 ELSIF OLD.status='pending' AND NEW.status='cancelled' THEN action:='cancelled';
 ELSIF OLD.status='cancelled' AND NEW.status='pending' THEN action:='reopened';
 ELSE RETURN NEW; END IF;
 INSERT INTO public.social_account_deletion_audit_v1(request_id,actor_id,event)
  VALUES(NEW.id,NEW.user_id,action);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.social_audit_deletion_state_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS social_audit_deletion_state_v1 ON public.social_account_deletion_requests;
CREATE TRIGGER social_audit_deletion_state_v1
 AFTER INSERT OR UPDATE OF status ON public.social_account_deletion_requests
 FOR EACH ROW EXECUTE FUNCTION public.social_audit_deletion_state_v1();

-- Reopen only own cancelled request; the regular RLS update grant does not allow this.
-- The existing unique(user_id) prevents a second parallel queue row.
CREATE OR REPLACE FUNCTION public.social_reopen_deletion_request_v1()
RETURNS TABLE(id uuid,status text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid;
BEGIN
 uid:=auth.uid();
 IF auth.role() IS DISTINCT FROM 'authenticated' OR uid IS NULL OR NOT public.social_has_recent_auth_v1() THEN
  RAISE EXCEPTION 'SOCIAL_DELETION_REAUTH_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN QUERY UPDATE public.social_account_deletion_requests r
   SET status='pending',updated_at=now()
   WHERE r.user_id=uid AND r.status='cancelled'
   RETURNING r.id,r.status,r.created_at;
END $$;
REVOKE ALL ON FUNCTION public.social_reopen_deletion_request_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_reopen_deletion_request_v1() TO authenticated;
COMMIT;