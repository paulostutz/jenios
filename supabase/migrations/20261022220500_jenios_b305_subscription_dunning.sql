-- B305-R13 — Subscription dunning cadence for JENIOS Platform.
-- D-3, D0, D+1 and automatic cancellation at D+7 calendar days.
-- Does not create charges or confirm payments. Delivery remains separately gated.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_subscription_dunning_outbox_b305 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subscription_id uuid NOT NULL REFERENCES public.jenios_pay_subscriptions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.jenios_pay_products(id) ON DELETE RESTRICT,
 event_kind text NOT NULL CHECK (event_kind IN ('due_soon_3d','due_today','past_due_1d','cancelled_7d')),
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','blocked','superseded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(subscription_id,event_kind,due_at)
);
CREATE INDEX IF NOT EXISTS jenios_b305_dunning_pending ON public.jenios_subscription_dunning_outbox_b305(created_at) WHERE status='pending';
ALTER TABLE public.jenios_subscription_dunning_outbox_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_subscription_dunning_outbox_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_subscription_dunning_outbox_b305 TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_process_subscription_dunning_b305(p_now timestamptz DEFAULT now())
RETURNS TABLE(queued integer,marked_past_due integer,cancelled integer,revoked integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q integer:=0; x integer:=0; pd integer:=0; c integer:=0; r integer:=0;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_FINANCE_SERVICE_REQUIRED' USING errcode='42501'; END IF;

 UPDATE public.jenios_subscription_dunning_outbox_b305 d SET status='superseded',updated_at=p_now
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_orders o ON o.id=s.latest_order_id
 WHERE d.subscription_id=s.id AND d.status='pending' AND o.status='paid' AND s.status='active';

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'due_soon_3d',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='active' AND p.category='platform' AND p.billing_type='monthly' AND s.current_period_end IS NOT NULL
  AND p_now>=s.current_period_end-interval '3 days' AND p_now<s.current_period_end-interval '2 days'
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q=q+x;

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'due_today',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='active' AND p.category='platform' AND p.billing_type='monthly' AND s.current_period_end IS NOT NULL
  AND p_now>=s.current_period_end AND p_now<s.current_period_end+interval '1 day'
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q=q+x;

 UPDATE public.jenios_pay_subscriptions s SET status='past_due',updated_at=p_now
 FROM public.jenios_pay_products p
 WHERE p.id=s.product_id AND p.category='platform' AND p.billing_type='monthly'
  AND s.status='active' AND s.current_period_end IS NOT NULL AND p_now>=s.current_period_end+interval '1 day'
  AND NOT EXISTS (SELECT 1 FROM public.jenios_pay_orders o WHERE o.id=s.latest_order_id AND o.status='paid' AND o.updated_at>=s.current_period_end);
 GET DIAGNOSTICS pd=ROW_COUNT;

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'past_due_1d',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='past_due' AND p.category='platform' AND p.billing_type='monthly' AND s.current_period_end IS NOT NULL
  AND p_now>=s.current_period_end+interval '1 day' AND p_now<s.current_period_end+interval '7 days'
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q=q+x;

 WITH due AS (
  SELECT s.id,s.user_id,s.product_id,s.current_period_end
  FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
  WHERE s.status='past_due' AND p.category='platform' AND p.billing_type='monthly'
   AND s.current_period_end IS NOT NULL AND p_now>=s.current_period_end+interval '7 days'
   AND NOT EXISTS (SELECT 1 FROM public.jenios_pay_orders o WHERE o.id=s.latest_order_id AND o.status='paid' AND o.updated_at>=s.current_period_end)
 ), cancelled_rows AS (
  UPDATE public.jenios_pay_subscriptions s SET status='cancelled',updated_at=p_now
  FROM due d WHERE s.id=d.id RETURNING s.id,s.user_id,s.product_id,s.current_period_end
 ), queued_cancel AS (
  INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
  SELECT id,user_id,product_id,'cancelled_7d',current_period_end FROM cancelled_rows ON CONFLICT DO NOTHING RETURNING 1
 ), revoked_rows AS (
  UPDATE public.jenios_pay_entitlements e SET status='revoked'
  FROM cancelled_rows d WHERE e.user_id=d.user_id AND e.product_id=d.product_id AND e.status='active' RETURNING 1
 )
 SELECT (SELECT count(*) FROM cancelled_rows),(SELECT count(*) FROM revoked_rows),(SELECT count(*) FROM queued_cancel) INTO c,r,x;
 q=q+x;
 RETURN QUERY SELECT q,pd,c,r;
END $$;
REVOKE ALL ON FUNCTION public.jenios_process_subscription_dunning_b305(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_process_subscription_dunning_b305(timestamptz) TO service_role;
COMMIT;
