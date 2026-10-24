-- B305-R20 — explicit marketing preferences and private campaign planner.
-- Planner only creates/suppresses ledger rows. It never sends email.
BEGIN;
ALTER TABLE public.jenios_email_preferences_b305
 ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.jenios_marketing_email_ledger_b305
 ADD COLUMN IF NOT EXISTS due_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz,
 ADD COLUMN IF NOT EXISTS lease_token uuid,
 ADD COLUMN IF NOT EXISTS lease_until timestamptz,
 ADD COLUMN IF NOT EXISTS last_error_code text,
 ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.jenios_pay_orders(id) ON DELETE CASCADE,
 ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.jenios_pay_products(id) ON DELETE RESTRICT;

UPDATE public.jenios_marketing_email_ledger_b305 SET step=0 WHERE step IS NULL;
ALTER TABLE public.jenios_marketing_email_ledger_b305 ALTER COLUMN step SET DEFAULT 0;
ALTER TABLE public.jenios_marketing_email_ledger_b305 ALTER COLUMN step SET NOT NULL;

ALTER TABLE public.jenios_marketing_email_ledger_b305 DROP CONSTRAINT IF EXISTS jenios_marketing_email_ledger_b305_status_check;
ALTER TABLE public.jenios_marketing_email_ledger_b305 ADD CONSTRAINT jenios_marketing_email_ledger_b305_status_check
 CHECK (status IN ('planned','processing','retry','sent','suppressed','failed','uncertain'));
ALTER TABLE public.jenios_marketing_email_ledger_b305 DROP CONSTRAINT IF EXISTS jenios_b305_marketing_sent_receipt;
ALTER TABLE public.jenios_marketing_email_ledger_b305 ADD CONSTRAINT jenios_b305_marketing_sent_receipt
 CHECK (status<>'sent' OR (sent_at IS NOT NULL AND provider_email_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS jenios_b305_marketing_due_idx ON public.jenios_marketing_email_ledger_b305(next_attempt_at,created_at) WHERE status IN ('planned','retry','processing');
CREATE INDEX IF NOT EXISTS jenios_b305_marketing_order_idx ON public.jenios_marketing_email_ledger_b305(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_b305_marketing_product_idx ON public.jenios_marketing_email_ledger_b305(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.jenios_newsletter_editions_b305 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 edition_key text NOT NULL UNIQUE CHECK (char_length(edition_key) BETWEEN 3 AND 120),
 subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 180),
 items jsonb NOT NULL CHECK (jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 5),
 scheduled_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_newsletter_editions_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_newsletter_editions_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_newsletter_editions_b305 TO service_role;

ALTER TABLE public.jenios_marketing_email_ledger_b305
 ADD COLUMN IF NOT EXISTS newsletter_edition_id uuid REFERENCES public.jenios_newsletter_editions_b305(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS jenios_b305_marketing_newsletter_idx ON public.jenios_marketing_email_ledger_b305(newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jenios_plan_marketing_emails_b305(p_now timestamptz DEFAULT now())
RETURNS TABLE(planned integer,suppressed integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer:=0; s integer:=0; x integer:=0;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;

 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='PREFERENCE_SUPPRESSED'
 FROM public.jenios_email_preferences_b305 p
 WHERE l.user_id=p.user_id AND l.status IN ('planned','retry')
 AND (p.marketing_opt_in=false OR p.opted_out_at IS NOT NULL OR p.complaint_at IS NOT NULL OR p.hard_bounce_at IS NOT NULL);
 GET DIAGNOSTICS x=ROW_COUNT; s=s+x;

 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='ACTIVE_PLAN'
 WHERE l.campaign_kind='no_plan_nurture' AND l.status IN ('planned','retry')
 AND EXISTS (SELECT 1 FROM public.jenios_pay_subscriptions sub WHERE sub.user_id=l.user_id AND sub.status IN ('active','past_due'));
 GET DIAGNOSTICS x=ROW_COUNT; s=s+x;

 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='CART_CLOSED'
 FROM public.jenios_pay_orders o
 WHERE l.order_id=o.id AND l.campaign_kind='cart_recovery' AND l.status IN ('planned','retry')
 AND o.status IN ('paid','cancelled','expired','refunded');
 GET DIAGNOSTICS x=ROW_COUNT; s=s+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at,order_id,product_id)
 SELECT o.user_id,'cart_recovery',o.id::text,v.step,'planned',o.created_at+v.delay,o.created_at+v.delay,o.id,o.product_id
 FROM public.jenios_pay_orders o
 JOIN public.jenios_pay_products prod ON prod.id=o.product_id
 JOIN public.jenios_email_preferences_b305 p ON p.user_id=o.user_id
 CROSS JOIN (VALUES (1,interval '2 hours'),(2,interval '24 hours'),(3,interval '72 hours')) AS v(step,delay)
 WHERE prod.category='platform' AND prod.billing_type='monthly' AND prod.active=true
 AND o.status='awaiting_payment' AND p.marketing_opt_in=true AND p.opted_out_at IS NULL
 AND p.complaint_at IS NULL AND p.hard_bounce_at IS NULL AND p_now>=o.created_at+v.delay
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n=n+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at)
 SELECT p.user_id,'no_plan_nurture',p.user_id::text,v.step,'planned',p.created_at+v.delay,p.created_at+v.delay
 FROM public.jenios_email_preferences_b305 p
 CROSS JOIN (VALUES (1,interval '3 days'),(2,interval '10 days')) AS v(step,delay)
 WHERE p.marketing_opt_in=true AND p.opted_out_at IS NULL AND p.complaint_at IS NULL AND p.hard_bounce_at IS NULL
 AND p_now>=p.created_at+v.delay
 AND NOT EXISTS (SELECT 1 FROM public.jenios_pay_subscriptions sub WHERE sub.user_id=p.user_id AND sub.status IN ('active','past_due'))
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n=n+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at,newsletter_edition_id)
 SELECT p.user_id,'newsletter',e.edition_key,0,'planned',e.scheduled_at,e.scheduled_at,e.id
 FROM public.jenios_email_preferences_b305 p CROSS JOIN public.jenios_newsletter_editions_b305 e
 WHERE p.marketing_opt_in=true AND p.opted_out_at IS NULL AND p.complaint_at IS NULL AND p.hard_bounce_at IS NULL
 AND e.status='approved' AND p_now>=e.scheduled_at
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n=n+x;
 RETURN QUERY SELECT n,s;
END $$;
REVOKE ALL ON FUNCTION public.jenios_plan_marketing_emails_b305(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_plan_marketing_emails_b305(timestamptz) TO service_role;
COMMIT;
