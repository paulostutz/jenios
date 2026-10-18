-- JENIOS S05-B50 — additive post/comment like notifications, PRODUCTION ONLY.
-- Existing notifications for comments, follows, and Direct remain unchanged.
-- Requires a reviewed dry-run/ROLLBACK before production commit.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
DO $preflight$
BEGIN
 IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NOT NULL THEN
   RAISE EXCEPTION 'S05_B50_REFUSE_ISOLATED_STAGING';
 END IF;
 IF to_regclass('public.post_likes') IS NULL
    OR to_regclass('public.comment_likes') IS NULL
    OR to_regclass('public.jenios_social_notifications') IS NULL
    OR to_regclass('public.user_blocks') IS NULL
    OR to_regclass('jenios_social_private.hidden_posts') IS NULL
    OR to_regnamespace('jenios_private') IS NULL THEN
   RAISE EXCEPTION 'S05_B50_REQUIRED_SOCIAL_SCHEMA_MISSING';
 END IF;
 IF to_regprocedure('jenios_private.notify_like_event_v1()') IS NOT NULL
    OR EXISTS(
       SELECT 1 FROM pg_trigger
       WHERE tgname IN ('jenios_notify_post_like_b50','jenios_notify_comment_like_b50')
         AND NOT tgisinternal
    ) THEN
   RAISE EXCEPTION 'S05_B50_ALREADY_INSTALLED_REVIEW_BEFORE_REAPPLY';
 END IF;
END $preflight$;

-- SECURITY DEFINER is confined to the private, non-API schema.
-- This trigger returns no private data to the calling user's session.
CREATE FUNCTION jenios_private.notify_like_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
 recipient uuid;
 actor uuid := NEW.user_id;
 relevant_post uuid;
 event_kind text;
 event_title text;
BEGIN
 -- Notifications never grant rights and do not run for anonymous/service users.
 IF actor IS NULL
    OR auth.uid() IS DISTINCT FROM actor
    OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN
   RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='post_likes' THEN
   SELECT p.author_id,p.id INTO recipient,relevant_post
   FROM public.posts p
   WHERE p.id=NEW.post_id AND p.archived_at IS NULL;
   event_kind:='post_like';
   event_title:='Curtiram sua publicação';
 ELSIF TG_TABLE_NAME='comment_likes' THEN
   SELECT c.author_id,p.id INTO recipient,relevant_post
   FROM public.comments c
   JOIN public.posts p ON p.id=c.post_id
   WHERE c.id=NEW.comment_id AND p.archived_at IS NULL;
   event_kind:='comment_like';
   event_title:='Curtiram seu comentário';
 ELSE
   RETURN NEW;
 END IF;
 IF recipient IS NULL OR recipient=actor OR relevant_post IS NULL THEN
   RETURN NEW;
 END IF;
 IF EXISTS(
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id=recipient AND b.blocked_id=actor)
       OR (b.blocker_id=actor AND b.blocked_id=recipient)
 ) OR EXISTS(
    SELECT 1 FROM jenios_social_private.hidden_posts h
    WHERE h.post_id=relevant_post
 ) THEN
   RETURN NEW;
 END IF;
 BEGIN
   INSERT INTO public.jenios_social_notifications
    (user_id,actor_id,kind,title,body,target_url)
   VALUES(recipient,actor,event_kind,event_title,
    'Você recebeu uma nova curtida.',
    '/social?post='||relevant_post::text);
 EXCEPTION WHEN OTHERS THEN
   -- A notification failure must not break an otherwise valid like.
   -- Never print user IDs, tokens, or private notification content.
   RAISE LOG 'JENIOS_S05_B50_LIKE_NOTIFICATION_FAILED sqlstate=%', SQLSTATE;
 END;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION jenios_private.notify_like_event_v1()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER jenios_notify_post_like_b50
 AFTER INSERT ON public.post_likes
 FOR EACH ROW EXECUTE FUNCTION jenios_private.notify_like_event_v1();
CREATE TRIGGER jenios_notify_comment_like_b50
 AFTER INSERT ON public.comment_likes
 FOR EACH ROW EXECUTE FUNCTION jenios_private.notify_like_event_v1();
COMMIT;
