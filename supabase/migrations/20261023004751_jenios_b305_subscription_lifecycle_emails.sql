-- B305-R19 — evidence-backed subscription lifecycle email events.
-- Database only queues durable events. No network/email side effects.
BEGIN;
ALTER TABLE public.jenios_transactional_email_outbox_b305
 ADD COLUMN IF NOT EXISTS previous_product_id uuid REFERENCES public.jenios_pay_products(id) ON DELETE RESTRICT;

ALTER TABLE public.jenios_transactional_email_outbox_b305
 DROP CONSTRAINT IF EXISTS jenios_transactional_email_outbox_b305_event_kind_check;
ALTER TABLE public.jenios_transactional_email_outbox_b305
 ADD CONSTRAINT jenios_transactional_email_outbox_b305_event_kind_check
 CHECK (event_kind IN ('social_welcome','plan_activated','plan_cancel_scheduled','plan_cancelled','plan_reactivated','plan_changed'));

CREATE INDEX IF NOT EXISTS jenios_b305_transactional_previous_product_idx
 ON public.jenios_transactional_email_outbox_b305(previous_product_id)
 WHERE previous_product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jenios_queue_plan_activated_email_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.jenios_pay_products%ROWTYPE; o public.jenios_pay_orders%ROWTYPE;
BEGIN
 IF OLD.status <> 'pending' OR NEW.status <> 'active' OR NEW.latest_order_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.jenios_pay_products WHERE id=NEW.product_id AND category='platform' AND billing_type='monthly' AND active=true;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=NEW.latest_order_id AND user_id=NEW.user_id AND product_id=NEW.product_id AND status='paid' AND currency='BRL';
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.jenios_pay_entitlements e WHERE e.order_id=o.id AND e.user_id=NEW.user_id AND e.product_id=NEW.product_id AND e.status='active') THEN RETURN NEW; END IF;
 INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,status)
 VALUES(NEW.user_id,'plan_activated',NEW.id::text,NEW.id,NEW.product_id,'pending')
 ON CONFLICT(event_kind,reference_key) DO NOTHING;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_queue_subscription_lifecycle_email_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.jenios_pay_products%ROWTYPE; old_p public.jenios_pay_products%ROWTYPE; o public.jenios_pay_orders%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.jenios_pay_products WHERE id=NEW.product_id AND category='platform' AND billing_type='monthly';
 IF NOT FOUND THEN RETURN NEW; END IF;

 IF OLD.cancel_at_period_end IS DISTINCT FROM NEW.cancel_at_period_end AND NEW.cancel_at_period_end=true
   AND NEW.status IN ('active','past_due') AND NEW.current_period_end IS NOT NULL THEN
  INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,status)
  VALUES(NEW.user_id,'plan_cancel_scheduled',NEW.id::text||':'||NEW.current_period_end::text,NEW.id,NEW.product_id,'pending')
  ON CONFLICT(event_kind,reference_key) DO NOTHING;
 END IF;

 IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='cancelled' AND NEW.cancel_at_period_end=true
   AND NEW.current_period_end IS NOT NULL THEN
  INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,status)
  VALUES(NEW.user_id,'plan_cancelled',NEW.id::text||':'||NEW.current_period_end::text,NEW.id,NEW.product_id,'pending')
  ON CONFLICT(event_kind,reference_key) DO NOTHING;
 END IF;

 IF OLD.status IN ('past_due','cancelled') AND NEW.status='active' AND NEW.latest_order_id IS NOT NULL THEN
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=NEW.latest_order_id AND user_id=NEW.user_id
    AND product_id=NEW.product_id AND status='paid' AND currency='BRL';
  IF FOUND AND EXISTS (SELECT 1 FROM public.jenios_pay_entitlements e WHERE e.order_id=o.id AND e.user_id=NEW.user_id AND e.product_id=NEW.product_id AND e.status='active') THEN
   INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,status)
   VALUES(NEW.user_id,'plan_reactivated',NEW.id::text||':'||NEW.latest_order_id::text,NEW.id,NEW.product_id,'pending')
   ON CONFLICT(event_kind,reference_key) DO NOTHING;
  END IF;
 END IF;

 IF OLD.product_id IS DISTINCT FROM NEW.product_id AND NEW.status='active' AND NEW.latest_order_id IS NOT NULL THEN
  SELECT * INTO old_p FROM public.jenios_pay_products WHERE id=OLD.product_id AND category='platform' AND billing_type='monthly';
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=NEW.latest_order_id AND user_id=NEW.user_id
    AND product_id=NEW.product_id AND status='paid' AND currency='BRL';
  IF FOUND AND old_p.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jenios_pay_entitlements e WHERE e.order_id=o.id AND e.user_id=NEW.user_id AND e.product_id=NEW.product_id AND e.status='active') THEN
   INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,previous_product_id,status)
   VALUES(NEW.user_id,'plan_changed',NEW.id::text||':'||NEW.latest_order_id::text,NEW.id,NEW.product_id,OLD.product_id,'pending')
   ON CONFLICT(event_kind,reference_key) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.jenios_queue_subscription_lifecycle_email_b305() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_queue_subscription_lifecycle_email_b305() TO service_role;
DROP TRIGGER IF EXISTS jenios_b305_subscription_lifecycle_email ON public.jenios_pay_subscriptions;
CREATE TRIGGER jenios_b305_subscription_lifecycle_email
 AFTER UPDATE OF status,cancel_at_period_end,product_id,latest_order_id ON public.jenios_pay_subscriptions
 FOR EACH ROW EXECUTE FUNCTION public.jenios_queue_subscription_lifecycle_email_b305();
COMMIT;
