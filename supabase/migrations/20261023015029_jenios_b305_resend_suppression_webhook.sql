-- B305-R25 — Resend bounce/complaint suppression ledger.
-- Signature verification endpoint is intentionally not enabled in this checkpoint.
BEGIN;

CREATE TABLE IF NOT EXISTS public.jenios_resend_webhook_events_b305 (
 event_id text PRIMARY KEY CHECK (char_length(event_id) BETWEEN 8 AND 200),
 event_type text NOT NULL CHECK (event_type IN ('email.bounced','email.complained')),
 recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event_at timestamptz NOT NULL,
 permanent_bounce boolean NOT NULL DEFAULT false,
 disposition text NOT NULL CHECK (disposition IN ('hard_bounce','complaint','ignored_transient','unknown_user')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_resend_webhook_events_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_resend_webhook_events_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.jenios_resend_webhook_events_b305 TO service_role;

CREATE INDEX IF NOT EXISTS jenios_b305_resend_events_user_idx
 ON public.jenios_resend_webhook_events_b305(recipient_user_id)
 WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_b305_resend_events_created_idx
 ON public.jenios_resend_webhook_events_b305(created_at DESC);

CREATE OR REPLACE FUNCTION public.jenios_ingest_resend_suppression_b305(
 p_event_id text,
 p_event_type text,
 p_recipient_email text,
 p_event_at timestamptz,
 p_permanent_bounce boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE target_user uuid; action text; inserted text;
BEGIN
 IF p_event_id IS NULL OR char_length(p_event_id) NOT BETWEEN 8 AND 200
    OR p_event_type NOT IN ('email.bounced','email.complained')
    OR p_recipient_email IS NULL OR char_length(p_recipient_email)>320
    OR p_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR p_event_at IS NULL THEN
  RAISE EXCEPTION 'RESEND_WEBHOOK_EVENT_INVALID' USING errcode='22023';
 END IF;

 SELECT u.id INTO target_user
 FROM auth.users u
 WHERE lower(u.email)=lower(trim(p_recipient_email))
 LIMIT 1;

 action:=CASE
  WHEN target_user IS NULL THEN 'unknown_user'
  WHEN p_event_type='email.complained' THEN 'complaint'
  WHEN p_permanent_bounce THEN 'hard_bounce'
  ELSE 'ignored_transient'
 END;

 INSERT INTO public.jenios_resend_webhook_events_b305(
  event_id,event_type,recipient_user_id,event_at,permanent_bounce,disposition
 ) VALUES (
  p_event_id,p_event_type,target_user,p_event_at,p_permanent_bounce,action
 )
 ON CONFLICT(event_id) DO NOTHING
 RETURNING event_id INTO inserted;

 IF inserted IS NULL THEN
  RETURN jsonb_build_object('ok',true,'duplicate',true,'disposition','duplicate');
 END IF;

 IF target_user IS NOT NULL AND action IN ('complaint','hard_bounce') THEN
  INSERT INTO public.jenios_email_preferences_b305(
   user_id,marketing_opt_in,opted_out_at,complaint_at,hard_bounce_at,updated_at
  ) VALUES (
   target_user,false,NULL,
   CASE WHEN action='complaint' THEN p_event_at ELSE NULL END,
   CASE WHEN action='hard_bounce' THEN p_event_at ELSE NULL END,
   now()
  )
  ON CONFLICT(user_id) DO UPDATE SET
   marketing_opt_in=false,
   complaint_at=CASE WHEN action='complaint'
    THEN coalesce(public.jenios_email_preferences_b305.complaint_at,p_event_at)
    ELSE public.jenios_email_preferences_b305.complaint_at END,
   hard_bounce_at=CASE WHEN action='hard_bounce'
    THEN coalesce(public.jenios_email_preferences_b305.hard_bounce_at,p_event_at)
    ELSE public.jenios_email_preferences_b305.hard_bounce_at END,
   updated_at=now();
 END IF;

 RETURN jsonb_build_object('ok',true,'duplicate',false,'disposition',action,'matchedUser',target_user IS NOT NULL);
END $$;

REVOKE ALL ON FUNCTION public.jenios_ingest_resend_suppression_b305(text,text,text,timestamptz,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_ingest_resend_suppression_b305(text,text,text,timestamptz,boolean)
 TO service_role;

COMMIT;
