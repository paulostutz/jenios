-- JENIOS S05-B52 | additive Highlights for existing Stories; no change to 24h Stories.
-- ISOLATED STAGING ONLY, same contracts as production.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
DO $guard$
BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017 WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017' AND environment='isolated-test-project')
 THEN RAISE EXCEPTION 'S05_B52_ISOLATED_STAGING_REQUIRED'; END IF;
 IF to_regclass('public.stories') IS NULL OR to_regclass('public.profiles') IS NULL
  OR to_regclass('public.user_blocks') IS NULL
  OR to_regprocedure('jenios_social_private.can_interact(uuid)') IS NULL
 THEN RAISE EXCEPTION 'S05_B52_REQUIRED_ORIGINAL_SOCIAL_SCHEMA_MISSING'; END IF;
 IF to_regclass('public.social_highlight_collections') IS NOT NULL
  OR to_regclass('public.social_highlight_items') IS NOT NULL
 THEN RAISE EXCEPTION 'S05_B52_ALREADY_INSTALLED_REVIEW_MANUALLY'; END IF;
END $guard$;

CREATE TABLE public.social_highlight_collections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 40),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id)
);
CREATE UNIQUE INDEX social_highlight_collection_title_unique_b52
 ON public.social_highlight_collections(owner_id,lower(btrim(title)));
CREATE INDEX social_highlight_collections_owner_b52
 ON public.social_highlight_collections(owner_id,created_at DESC);

CREATE TABLE public.social_highlight_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collection_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 source_story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 media_type text NOT NULL CHECK(media_type IN ('image','video','post')),
 media_path text,
 shared_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT highlight_item_collection_owner_b52
 FOREIGN KEY(collection_id,owner_id) REFERENCES public.social_highlight_collections(id,owner_id) ON DELETE CASCADE,
 CONSTRAINT highlight_item_original_shape_b52
 CHECK (
  (media_type IN ('image','video') AND media_path IS NOT NULL AND shared_post_id IS NULL)
  OR (media_type='post' AND media_path IS NULL AND shared_post_id IS NOT NULL)
 ),
 UNIQUE(collection_id,source_story_id)
);
CREATE INDEX social_highlight_items_collection_b52
 ON public.social_highlight_items(collection_id,created_at,id);

-- A private security-definer copies immutable source fields from an ORIGINAL
-- story owned by the acting account; direct clients cannot forge media/owners.
CREATE FUNCTION jenios_social_private.highlight_snapshot_b52()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS DISTINCT FROM NEW.owner_id
  OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
 THEN RAISE EXCEPTION 'S05_HIGHLIGHT_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT s.media_type,s.media_path,s.shared_post_id
 INTO NEW.media_type,NEW.media_path,NEW.shared_post_id
 FROM public.stories s
 WHERE s.id=NEW.source_story_id AND s.author_id=NEW.owner_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'S05_HIGHLIGHT_ORIGINAL_STORY_NOT_OWNED'
  USING ERRCODE='42501'; END IF;
 IF NEW.media_type='post' AND NOT EXISTS(
   SELECT 1 FROM public.posts p
   WHERE p.id=NEW.shared_post_id AND p.archived_at IS NULL
 ) THEN RAISE EXCEPTION 'S05_HIGHLIGHT_POST_NOT_VISIBLE' USING ERRCODE='42501'; END IF;
 IF NEW.media_type IN('image','video') AND (
  NEW.media_path !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/social-media/'
  OR position('/'||NEW.owner_id::text||'/' IN NEW.media_path)=0
 ) THEN RAISE EXCEPTION 'S05_HIGHLIGHT_MEDIA_NOT_FROM_OWNER_BUCKET'
  USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION jenios_social_private.highlight_snapshot_b52()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER highlight_snapshot_insert_b52
 BEFORE INSERT ON public.social_highlight_items
 FOR EACH ROW EXECUTE FUNCTION jenios_social_private.highlight_snapshot_b52();

ALTER TABLE public.social_highlight_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_highlight_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_highlight_collections,public.social_highlight_items FROM PUBLIC,anon;
GRANT SELECT,INSERT,DELETE ON public.social_highlight_collections,public.social_highlight_items TO authenticated;

CREATE POLICY social_highlight_collections_read_b52
 ON public.social_highlight_collections FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL AND jenios_social_private.can_interact(owner_id));
CREATE POLICY social_highlight_collections_insert_b52
 ON public.social_highlight_collections FOR INSERT TO authenticated
 WITH CHECK(owner_id=(SELECT auth.uid())
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false');
CREATE POLICY social_highlight_collections_delete_b52
 ON public.social_highlight_collections FOR DELETE TO authenticated
 USING(owner_id=(SELECT auth.uid()));

CREATE POLICY social_highlight_items_read_b52
 ON public.social_highlight_items FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL AND jenios_social_private.can_interact(owner_id)
 AND (shared_post_id IS NULL OR EXISTS(
  SELECT 1 FROM public.posts p
  WHERE p.id=social_highlight_items.shared_post_id AND p.archived_at IS NULL)));
CREATE POLICY social_highlight_items_insert_b52
 ON public.social_highlight_items FOR INSERT TO authenticated
 WITH CHECK(owner_id=(SELECT auth.uid())
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false');
CREATE POLICY social_highlight_items_delete_b52
 ON public.social_highlight_items FOR DELETE TO authenticated
 USING(owner_id=(SELECT auth.uid()));
COMMIT;
