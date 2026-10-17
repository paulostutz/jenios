-- S03-B06 STAGING / REVIEW ONLY. Requires the separately reviewed S01 queue proposal first.
-- Allows authenticated owners to CANCEL a pending request only; never destroys data.
BEGIN;
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
COMMIT;
