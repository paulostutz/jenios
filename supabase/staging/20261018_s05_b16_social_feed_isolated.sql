-- JENIOS S05-B16 | ONLY isolated project rebzztxlzofxpfwjvbee.
-- Match production Social API table/column contracts without copying production data.
-- Intentionally excludes payments, privileged admin access and B52 private robot data.
-- Never apply to jenios-social production (igayfjorjmucthlfoasf).
DO $preflight$
BEGIN
  IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NULL THEN
    RAISE EXCEPTION 'S05_STAGING_GUARD_NOT_FOUND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jenios_s04_staging_guard_20261017
                 WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017'
                   AND environment='isolated-test-project') THEN
    RAISE EXCEPTION 'S05_NOT_AN_ISOLATED_PROJECT';
  END IF;
  IF to_regclass('public.posts') IS NOT NULL THEN
    RAISE EXCEPTION 'S05_FEED_ALREADY_PRESENT_MANUAL_REVIEW_REQUIRED';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'S05_PROFILES_MISSING';
  END IF;
END $preflight$;

CREATE TABLE public.posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL DEFAULT '' CHECK (char_length(body)<=10000),
 media_type text CHECK (media_type IN ('image','video')),
 media_path text,
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 CONSTRAINT post_content_required CHECK (length(btrim(body))>0 OR media_path IS NOT NULL),
 CONSTRAINT post_media_pair CHECK ((media_type IS NULL)=(media_path IS NULL))
);
CREATE INDEX posts_feed_s05_idx ON public.posts(created_at DESC,id DESC) WHERE archived_at IS NULL;
CREATE INDEX posts_author_s05_idx ON public.posts(author_id,created_at DESC,id DESC);
CREATE INDEX posts_archive_s05_idx ON public.posts(author_id,archived_at DESC,id DESC) WHERE archived_at IS NOT NULL;

CREATE TABLE public.user_blocks (
 blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (blocker_id,blocked_id),
 CHECK (blocker_id<>blocked_id)
);
CREATE INDEX user_blocks_blocked_s05_idx ON public.user_blocks(blocked_id,blocker_id);

CREATE SCHEMA IF NOT EXISTS jenios_social_private;
REVOKE ALL ON SCHEMA jenios_social_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA jenios_social_private TO authenticated;
CREATE TABLE jenios_social_private.hidden_posts (
 post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
 moderator_id uuid NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jenios_social_private.hidden_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jenios_social_private.hidden_posts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION jenios_social_private.can_interact(other_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND NOT EXISTS (
   SELECT 1 FROM public.user_blocks b
   WHERE (b.blocker_id=auth.uid() AND b.blocked_id=other_id)
      OR (b.blocker_id=other_id AND b.blocked_id=auth.uid())
 );
$$;
CREATE FUNCTION jenios_social_private.visible_post(post_id uuid,author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jenios_social_private.can_interact(author_id)
  AND NOT EXISTS (SELECT 1 FROM jenios_social_private.hidden_posts h WHERE h.post_id=visible_post.post_id);
$$;
REVOKE ALL ON FUNCTION jenios_social_private.can_interact(uuid),jenios_social_private.visible_post(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION jenios_social_private.can_interact(uuid),jenios_social_private.visible_post(uuid,uuid) TO authenticated;

CREATE TABLE public.post_likes (
 post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (post_id,user_id)
);
CREATE INDEX post_likes_user_s05_idx ON public.post_likes(user_id);

CREATE TABLE public.comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_s05_idx ON public.comments(post_id,created_at);

CREATE TABLE public.comment_likes (
 comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (comment_id,user_id)
);
CREATE TABLE public.follows (
 follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (follower_id,following_id),
 CHECK (follower_id<>following_id)
);
CREATE INDEX follows_following_s05_idx ON public.follows(following_id,created_at DESC);
CREATE TABLE public.saved_posts (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,post_id)
);

CREATE TABLE public.stories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 media_type text NOT NULL CHECK (media_type IN ('image','video','post')),
 media_path text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
 shared_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
 CONSTRAINT stories_share_s05_check CHECK (
   (media_type='post' AND shared_post_id IS NOT NULL AND media_path IS NULL)
   OR (media_type IN ('image','video') AND shared_post_id IS NULL AND media_path IS NOT NULL))
);
CREATE INDEX stories_active_s05_idx ON public.stories(expires_at DESC,created_at DESC);

CREATE FUNCTION public.jenios_stamp_story_lifetime()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 NEW.created_at:=now();
 NEW.expires_at:=NEW.created_at+interval '24 hours';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.jenios_stamp_story_lifetime() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER jenios_story_lifetime BEFORE INSERT ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.jenios_stamp_story_lifetime();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.posts,public.post_likes,public.comments,public.comment_likes,public.follows,public.saved_posts,public.stories,public.user_blocks FROM PUBLIC,anon;
GRANT SELECT,INSERT,DELETE ON public.posts TO authenticated;
GRANT UPDATE (archived_at) ON public.posts TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.post_likes,public.comments,public.comment_likes,public.follows,public.saved_posts,public.stories,public.user_blocks TO authenticated;

CREATE POLICY posts_read ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY posts_archive_private ON public.posts AS RESTRICTIVE FOR SELECT TO authenticated
USING (archived_at IS NULL OR author_id=(SELECT auth.uid()));
CREATE POLICY posts_visibility ON public.posts AS RESTRICTIVE FOR SELECT TO authenticated
USING (jenios_social_private.visible_post(id,author_id));
CREATE POLICY posts_insert_self ON public.posts FOR INSERT TO authenticated
WITH CHECK (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false' AND archived_at IS NULL);
CREATE POLICY posts_update_self ON public.posts FOR UPDATE TO authenticated
USING (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false')
WITH CHECK (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false');
CREATE POLICY posts_delete_self ON public.posts FOR DELETE TO authenticated
USING (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false');

CREATE POLICY blocks_read_self ON public.user_blocks FOR SELECT TO authenticated
USING (blocker_id=(SELECT auth.uid()));
CREATE POLICY blocks_insert_self ON public.user_blocks FOR INSERT TO authenticated
WITH CHECK (blocker_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false');
CREATE POLICY blocks_delete_self ON public.user_blocks FOR DELETE TO authenticated
USING (blocker_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false');

CREATE POLICY likes_read ON public.post_likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY likes_insert_self ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY likes_delete_self ON public.post_likes FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()));

CREATE POLICY comments_read ON public.comments FOR SELECT TO authenticated
USING (jenios_social_private.can_interact(author_id)
 AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY comments_insert_self ON public.comments FOR INSERT TO authenticated
WITH CHECK (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id)
 AND (parent_id IS NULL OR EXISTS
 (SELECT 1 FROM public.comments c WHERE c.id=parent_id AND c.post_id=post_id AND c.parent_id IS NULL)));
CREATE POLICY comments_delete_self ON public.comments FOR DELETE TO authenticated
USING (author_id=(SELECT auth.uid()));

CREATE POLICY comment_likes_read ON public.comment_likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.comments c WHERE c.id=comment_id));
CREATE POLICY comment_likes_insert_self ON public.comment_likes FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND EXISTS (SELECT 1 FROM public.comments c WHERE c.id=comment_id));
CREATE POLICY comment_likes_delete_self ON public.comment_likes FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()));

CREATE POLICY follows_read ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_self ON public.follows FOR INSERT TO authenticated
WITH CHECK (follower_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND jenios_social_private.can_interact(following_id));
CREATE POLICY follows_delete_self ON public.follows FOR DELETE TO authenticated
USING (follower_id=(SELECT auth.uid()));

CREATE POLICY saved_read_self ON public.saved_posts FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY saved_insert_self ON public.saved_posts FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY saved_delete_self ON public.saved_posts FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()));

CREATE POLICY stories_read_active ON public.stories FOR SELECT TO authenticated
USING (expires_at>now());
CREATE POLICY stories_visibility ON public.stories AS RESTRICTIVE FOR SELECT TO authenticated
USING (jenios_social_private.can_interact(author_id) AND created_at<=now()
 AND created_at>now()-interval '24 hours'
 AND (shared_post_id IS NULL OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id=shared_post_id AND p.archived_at IS NULL)));
CREATE POLICY stories_insert_self ON public.stories FOR INSERT TO authenticated
WITH CHECK (author_id=(SELECT auth.uid()) AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
 AND (shared_post_id IS NULL OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id=shared_post_id AND p.archived_at IS NULL)));
CREATE POLICY stories_delete_self ON public.stories FOR DELETE TO authenticated
USING (author_id=(SELECT auth.uid()));

CREATE FUNCTION public.jenios_social_post_stats(p_ids uuid[])
RETURNS TABLE(post_id uuid,count bigint,liked boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.id,count(l.user_id),coalesce(bool_or(l.user_id=(SELECT auth.uid())),false)
 FROM public.posts p LEFT JOIN public.post_likes l ON l.post_id=p.id
 WHERE p.id=ANY(p_ids[1:50]) GROUP BY p.id;
$$;
CREATE FUNCTION public.jenios_comment_like_stats(ids uuid[])
RETURNS TABLE(comment_id uuid,count bigint,liked boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.id,count(l.user_id),coalesce(bool_or(l.user_id=(SELECT auth.uid())),false)
 FROM public.comments c LEFT JOIN public.comment_likes l ON l.comment_id=c.id
 WHERE c.id=ANY(ids[1:100]) GROUP BY c.id;
$$;
REVOKE ALL ON FUNCTION public.jenios_social_post_stats(uuid[]),public.jenios_comment_like_stats(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jenios_social_post_stats(uuid[]),public.jenios_comment_like_stats(uuid[]) TO authenticated;
