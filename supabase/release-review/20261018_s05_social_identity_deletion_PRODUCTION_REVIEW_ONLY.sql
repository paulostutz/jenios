-- JENIOS S05 — PRODUCTION REVIEW ONLY; NOT EXECUTED.
-- Applies ONLY after explicit production-schema approval, post-backup and live-readiness certification.
-- Source: staging identity SQL and staging cancellation SQL, already validated in independent Supabase.
-- No data backfill, payment, deletion, admin or robot changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
 IF to_regclass('public.profiles') IS NULL OR to_regclass('public.posts') IS NULL
   OR to_regclass('auth.users') IS NULL THEN
   RAISE EXCEPTION 'PRODUCTION_EXPECTED_SOCIAL_SCHEMA_MISSING';
 END IF;
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NOT NULL THEN
   RAISE EXCEPTION 'NOT_ALLOWED_ON_ISOLATED_STAGING_PROJECT';
 END IF;
END $preflight$;
-- Existing profiles are never renamed, removed or merged. Abort on case-fold collisions.

DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.profiles WHERE handle IS NOT NULL
            GROUP BY lower(regexp_replace(btrim(handle), '^@', '')) HAVING count(*)>1) THEN
  RAISE EXCEPTION 'SOCIAL_HANDLE_CASE_COLLISION: review existing handles before migration';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_canonical_unique_v1
 ON public.profiles (lower(regexp_replace(btrim(handle), '^@', ''))) WHERE handle IS NOT NULL;

CREATE OR REPLACE FUNCTION public.social_normalize_profile_handle_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.handle IS NOT DISTINCT FROM OLD.handle THEN RETURN NEW; END IF;
 NEW.handle := lower(regexp_replace(btrim(NEW.handle), '^@', ''));
 IF NEW.handle IS NULL OR NEW.handle !~ '^[a-z0-9_]{3,30}$'
    OR NEW.handle=ANY(ARRAY['admin','administrador','api','cadastro','configuracoes','jenios','login','social','suporte','support']) THEN
  RAISE EXCEPTION 'SOCIAL_HANDLE_INVALID' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS social_normalize_profile_handle_v1 ON public.profiles;
CREATE TRIGGER social_normalize_profile_handle_v1 BEFORE INSERT OR UPDATE OF handle ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.social_normalize_profile_handle_v1();

-- Metadata is untrusted. No roles, permission flags or identity values are copied from metadata.
-- Only this Social signup path opts in; unrelated provider/account creation remains untouched.
CREATE OR REPLACE FUNCTION public.social_signup_profile_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE h text; display text;
BEGIN
 IF NEW.is_anonymous IS TRUE OR NEW.raw_user_meta_data->>'registration_source' IS DISTINCT FROM 'social' THEN
  RETURN NEW;
 END IF;
 h:=lower(regexp_replace(btrim(NEW.raw_user_meta_data->>'handle'), '^@', ''));
 display:=btrim(NEW.raw_user_meta_data->>'full_name');
 IF h IS NULL OR h !~ '^[a-z0-9_]{3,30}$' OR display IS NULL OR char_length(display)<2 OR char_length(display)>120 THEN
  RAISE EXCEPTION 'SOCIAL_SIGNUP_PROFILE_INVALID' USING ERRCODE='23514';
 END IF;
 -- The canonical-handle unique index is the final arbiter for simultaneous signups.
 -- Failure aborts the auth insert too; no partial account/profile is reported as a success.
 INSERT INTO public.profiles(id,handle,display_name) VALUES(NEW.id,h,display);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS social_signup_profile_v1 ON auth.users;
CREATE TRIGGER social_signup_profile_v1 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.social_signup_profile_v1();
REVOKE ALL ON FUNCTION public.social_signup_profile_v1() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.social_handle_availability_v1(p_handle text)
RETURNS TABLE(handle text,available boolean,suggestions text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' STABLE AS $$
DECLARE h text; candidate text; choices text[]:='{}'; n integer;
BEGIN
 h:=lower(regexp_replace(btrim(p_handle), '^@', ''));
 IF h IS NULL OR h !~ '^[a-z0-9_]{3,30}$' OR h=ANY(ARRAY['admin','administrador','api','cadastro','configuracoes','jenios','login','social','suporte','support']) THEN
  RAISE EXCEPTION 'SOCIAL_HANDLE_INVALID' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE lower(regexp_replace(btrim(p.handle), '^@', ''))=h) THEN
  RETURN QUERY SELECT h,true,choices; RETURN;
 END IF;
 -- Bounded work; every returned candidate is checked, never a fabricated "available" claim.
 FOR n IN 1..30 LOOP
  candidate:=left(h,27)||'_'||n::text;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE lower(regexp_replace(btrim(p.handle), '^@', ''))=candidate) THEN
   choices:=array_append(choices,candidate);
   EXIT WHEN cardinality(choices)=4;
  END IF;
 END LOOP;
 RETURN QUERY SELECT h,false,choices;
END $$;
REVOKE ALL ON FUNCTION public.social_handle_availability_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.social_handle_availability_v1(text) TO anon,authenticated;

-- Request queue only. Does not erase auth identities, payments, files, posts or subscriptions.
CREATE TABLE IF NOT EXISTS public.social_account_deletion_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','completed','cancelled')),
 confirmation_version text NOT NULL CHECK(confirmation_version='social-deletion-request-v1'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_account_deletion_requests FROM anon,authenticated;
GRANT SELECT(id,user_id,status,created_at) ON public.social_account_deletion_requests TO authenticated;
GRANT INSERT(user_id,confirmation_version) ON public.social_account_deletion_requests TO authenticated;
GRANT ALL ON public.social_account_deletion_requests TO service_role;
CREATE OR REPLACE FUNCTION public.social_has_recent_auth_v1()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
  AND u.is_anonymous IS NOT TRUE
  AND u.last_sign_in_at<=now() AND u.last_sign_in_at>=now()-interval '15 minutes');
$$;
REVOKE ALL ON FUNCTION public.social_has_recent_auth_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_has_recent_auth_v1() TO authenticated;
DROP POLICY IF EXISTS social_deletion_read_self_v1 ON public.social_account_deletion_requests;
CREATE POLICY social_deletion_read_self_v1 ON public.social_account_deletion_requests FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS social_deletion_request_self_v1 ON public.social_account_deletion_requests;
CREATE POLICY social_deletion_request_self_v1 ON public.social_account_deletion_requests FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND status='pending' AND (SELECT public.social_has_recent_auth_v1()));

-- Allows authenticated owners to CANCEL a pending request only; never destroys data.

DO $$ BEGIN
 IF to_regclass('public.social_account_deletion_requests') IS NULL THEN
  RAISE EXCEPTION 'S03 requires reviewed S01 deletion request queue in staging';
 END IF;
END $$;
GRANT UPDATE(status) ON public.social_account_deletion_requests TO authenticated;
DROP POLICY IF EXISTS social_deletion_cancel_pending_self_v1 ON public.social_account_deletion_requests;
CREATE POLICY social_deletion_cancel_pending_self_v1 ON public.social_account_deletion_requests
 FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND status='pending' AND (SELECT public.social_has_recent_auth_v1()))
 WITH CHECK (user_id=(SELECT auth.uid()) AND status='cancelled');


CREATE OR REPLACE FUNCTION public.social_reopen_deletion_request_v1()
RETURNS TABLE(id uuid,status text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid;
BEGIN
 uid:=auth.uid();
 IF auth.role() IS DISTINCT FROM 'authenticated' OR uid IS NULL
    OR NOT public.social_has_recent_auth_v1() THEN
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
