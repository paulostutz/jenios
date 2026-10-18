-- S05-B34: isolated staging correction for recursive comments RLS.
-- Never apply this migration to JENIOS production. Production has its own reviewed policies.
DO $guard$
BEGIN
  IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.jenios_s04_staging_guard_20261017
       WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017'
         AND environment='isolated-test-project'
     ) THEN RAISE EXCEPTION 'S05_B34_NOT_ISOLATED'; END IF;
  IF to_regclass('public.comments') IS NULL
     OR to_regclass('public.posts') IS NULL
     OR to_regnamespace('jenios_social_private') IS NULL
     THEN RAISE EXCEPTION 'S05_B34_REQUIRED_SCHEMA_MISSING'; END IF;
END $guard$;

-- A narrowly scoped, boolean-only helper avoids the PostgreSQL infinite RLS
-- recursion caused by selecting public.comments from its own INSERT policy.
-- Kept outside the exposed public API schema. Nothing is returned about comment contents.
CREATE OR REPLACE FUNCTION jenios_social_private.valid_reply_parent_v1(
 p_post_id uuid,p_parent_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
   AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
   AND (
     p_parent_id IS NULL
     OR EXISTS(
       SELECT 1 FROM public.comments parent
       WHERE parent.id=p_parent_id
         AND parent.post_id=p_post_id
         AND parent.parent_id IS NULL
     )
   );
$$;
REVOKE ALL ON FUNCTION jenios_social_private.valid_reply_parent_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION jenios_social_private.valid_reply_parent_v1(uuid,uuid)
 TO authenticated;

DROP POLICY IF EXISTS comments_insert_self ON public.comments;
CREATE POLICY comments_insert_self ON public.comments FOR INSERT TO authenticated
 WITH CHECK(
  author_id=(SELECT auth.uid())
  AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
  AND EXISTS(SELECT 1 FROM public.posts post WHERE post.id=comments.post_id)
  AND jenios_social_private.valid_reply_parent_v1(post_id,parent_id)
 );
