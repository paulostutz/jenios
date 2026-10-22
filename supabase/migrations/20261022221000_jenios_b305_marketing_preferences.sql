-- B305-R13 — Marketing consent/preferences and campaign ledger.
-- Does not send emails. Client has no write access to campaign delivery ledger.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_email_preferences_b305 (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 marketing_opt_in boolean NOT NULL DEFAULT true,
 opted_out_at timestamptz,
 complaint_at timestamptz,
 hard_bounce_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_email_preferences_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_email_preferences_b305 FROM PUBLIC,anon;
GRANT SELECT ON public.jenios_email_preferences_b305 TO authenticated;
CREATE POLICY "jenios_email_preferences_self_read"
 ON public.jenios_email_preferences_b305 FOR SELECT TO authenticated
 USING ((select auth.uid())=user_id);

CREATE TABLE IF NOT EXISTS public.jenios_marketing_email_ledger_b305 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 campaign_kind text NOT NULL CHECK (campaign_kind IN ('cart_recovery','no_plan_nurture','newsletter')),
 campaign_key text NOT NULL,
 step integer,
 status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','sent','suppressed','failed')),
 provider_email_id text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,campaign_kind,campaign_key,step)
);
ALTER TABLE public.jenios_marketing_email_ledger_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_marketing_email_ledger_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_marketing_email_ledger_b305 TO service_role;
COMMIT;
