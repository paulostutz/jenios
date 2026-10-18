-- JENIOS S05-B44 — STAGING ONLY: YouTube live links and moderated reports.
-- Never run on JENIOS production. Reproduce current API contracts without internal live streaming.
DO $guard$
BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NULL OR
   NOT EXISTS(SELECT 1 FROM public.jenios_s04_staging_guard_20261017
     WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017'
       AND environment='isolated-test-project')
   THEN RAISE EXCEPTION 'S05_B44_ISOLATED_STAGING_ONLY'; END IF;
 IF to_regclass('public.profiles') IS NULL OR
    to_regclass('public.posts') IS NULL OR
    to_regclass('public.user_blocks') IS NULL OR
    to_regclass('public.lives') IS NOT NULL OR
    to_regclass('public.reports') IS NOT NULL
    THEN RAISE EXCEPTION 'S05_B44_REVIEW_EXISTING_SCHEMA'; END IF;
END $guard$;

CREATE TABLE public.lives (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 120),
 youtube_video_id text NOT NULL CHECK(youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','live','ended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(host_id,youtube_video_id)
);
CREATE INDEX social_lives_feed_b44_idx ON public.lives(created_at DESC,id DESC);
CREATE TABLE jenios_social_private.hidden_lives (
 live_id uuid PRIMARY KEY REFERENCES public.lives(id) ON DELETE CASCADE,
 moderator_id uuid NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jenios_social_private.hidden_lives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jenios_social_private.hidden_lives FROM PUBLIC,anon,authenticated;

CREATE FUNCTION jenios_social_private.visible_live(live_id uuid,host_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jenios_social_private.can_interact(visible_live.host_id)
 AND NOT EXISTS(
  SELECT 1 FROM jenios_social_private.hidden_lives h
  WHERE h.live_id=visible_live.live_id
 );
$$;
REVOKE ALL ON FUNCTION jenios_social_private.visible_live(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION jenios_social_private.visible_live(uuid,uuid) TO authenticated;

CREATE TABLE public.reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK(target_type IN('profile','post','comment','story','live')),
 target_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN('sexual','hate','violence','terrorism','fraud','harassment','other')),
 details text NOT NULL DEFAULT '' CHECK(char_length(details)<=2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','reviewing','resolved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_reports_reporter_b44_idx ON public.reports(reporter_id,created_at DESC);
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lives,public.reports FROM PUBLIC,anon;
GRANT SELECT,INSERT,DELETE ON public.lives TO authenticated;
GRANT SELECT,INSERT ON public.reports TO authenticated;

CREATE POLICY lives_read ON public.lives FOR SELECT TO authenticated USING(true);
CREATE POLICY social_lives_visibility ON public.lives AS RESTRICTIVE
 FOR SELECT TO authenticated USING(jenios_social_private.visible_live(id,host_id));
CREATE POLICY lives_insert_self ON public.lives FOR INSERT TO authenticated
 WITH CHECK(host_id=(SELECT auth.uid())
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND status='scheduled');
CREATE POLICY lives_delete_self ON public.lives FOR DELETE TO authenticated
 USING(host_id=(SELECT auth.uid())
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false');
CREATE POLICY reports_read_self ON public.reports FOR SELECT TO authenticated
 USING(reporter_id=(SELECT auth.uid()));
CREATE POLICY reports_insert_self ON public.reports FOR INSERT TO authenticated
 WITH CHECK(reporter_id=(SELECT auth.uid()) AND status='pending'
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND (
   (target_type='post' AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=target_id))
   OR (target_type='live' AND EXISTS(SELECT 1 FROM public.lives l WHERE l.id=target_id))
 ));
