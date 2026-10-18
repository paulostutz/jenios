-- JENIOS Social S05-B53: additive profile pinned posts, production guard.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
DO $guard$ BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NOT NULL
 THEN RAISE EXCEPTION 'S05_B53_PRODUCTION_GUARD_REFUSES_STAGING'; END IF;
 IF to_regclass('public.posts') IS NULL OR to_regclass('public.profiles') IS NULL
 OR to_regprocedure('jenios_social_private.can_interact(uuid)') IS NULL
 THEN RAISE EXCEPTION 'S05_B53_ORIGINAL_SOCIAL_SCHEMA_MISSING'; END IF;
 IF to_regclass('public.social_pinned_posts') IS NOT NULL
 THEN RAISE EXCEPTION 'S05_B53_ALREADY_INSTALLED'; END IF;
END $guard$;

CREATE TABLE public.social_pinned_posts(
 post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 pinned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_pinned_owner_recent_b53 ON public.social_pinned_posts(owner_id,pinned_at DESC,post_id);

-- Validate ownership, source visibility and the maximum under a per-owner transactional lock.
CREATE FUNCTION jenios_social_private.validate_social_pin_b53()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE existing_count integer;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.owner_id
    OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
 THEN RAISE EXCEPTION 'S05_B53_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.owner_id::text,0));
 IF NOT EXISTS(
  SELECT 1 FROM public.posts p
  WHERE p.id=NEW.post_id AND p.author_id=NEW.owner_id AND p.archived_at IS NULL
 ) THEN RAISE EXCEPTION 'S05_B53_POST_NOT_OWNED_OR_ARCHIVED' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO existing_count FROM public.social_pinned_posts
 WHERE owner_id=NEW.owner_id;
 IF existing_count>=3 THEN RAISE EXCEPTION 'S05_B53_MAX_THREE_PINS' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$body$;
REVOKE ALL ON FUNCTION jenios_social_private.validate_social_pin_b53() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER social_pinned_validate_insert_b53
 BEFORE INSERT ON public.social_pinned_posts
 FOR EACH ROW EXECUTE FUNCTION jenios_social_private.validate_social_pin_b53();
ALTER TABLE public.social_pinned_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_pinned_posts FROM PUBLIC,anon;
GRANT SELECT,INSERT,DELETE ON public.social_pinned_posts TO authenticated;

-- Owners may unpin archived posts; visitors never see them or blocked authors.
CREATE POLICY social_pinned_read_b53 ON public.social_pinned_posts
 FOR SELECT TO authenticated
 USING (
  auth.uid() IS NOT NULL
  AND jenios_social_private.can_interact(owner_id)
  AND (
    owner_id=(SELECT auth.uid())
    OR EXISTS(
      SELECT 1 FROM public.posts p
      WHERE p.id=social_pinned_posts.post_id
       AND p.author_id=social_pinned_posts.owner_id AND p.archived_at IS NULL
    )
  )
 );
CREATE POLICY social_pinned_insert_b53 ON public.social_pinned_posts
 FOR INSERT TO authenticated WITH CHECK(
  owner_id=(SELECT auth.uid())
  AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 );
CREATE POLICY social_pinned_delete_b53 ON public.social_pinned_posts
 FOR DELETE TO authenticated USING(owner_id=(SELECT auth.uid()));
COMMIT;
