-- JENIOS S05-B52R2: owner-only Story archive RPC. Preserves restrictive 24h Story RLS.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NOT NULL
 OR to_regclass('public.social_highlight_items') IS NULL
 OR to_regclass('public.stories') IS NULL
 THEN RAISE EXCEPTION 'S05_B52R2_PRODUCTION_SCOPE_FAILED'; END IF;
 IF to_regprocedure('public.social_my_story_archive_for_highlights_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'S05_B52R2_RPC_ALREADY_EXISTS'; END IF;
END $guard$;

CREATE FUNCTION public.social_my_story_archive_for_highlights_v1()
RETURNS TABLE(
 id uuid,author_id uuid,media_type text,
 created_at timestamptz,expires_at timestamptz,shared_post_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $body$
BEGIN
 IF auth.uid() IS NULL
  OR auth.role() IS DISTINCT FROM 'authenticated'
  OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
 THEN RAISE EXCEPTION 'S05_HIGHLIGHT_ARCHIVE_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN QUERY
  SELECT s.id,s.author_id,s.media_type,s.created_at,s.expires_at,s.shared_post_id
  FROM public.stories s
  WHERE s.author_id=auth.uid()
    AND s.created_at<=now()
    AND (s.shared_post_id IS NULL OR EXISTS(
      SELECT 1 FROM public.posts p
      WHERE p.id=s.shared_post_id AND p.archived_at IS NULL
    ))
  ORDER BY s.created_at DESC,s.id DESC
  LIMIT 120;
END
$body$;
REVOKE ALL ON FUNCTION public.social_my_story_archive_for_highlights_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_my_story_archive_for_highlights_v1() TO authenticated;
COMMIT;
