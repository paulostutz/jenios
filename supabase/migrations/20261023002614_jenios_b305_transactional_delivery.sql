-- B305-R16 — transactional lifecycle and dunning delivery ledger for Social QA.
-- Queues only; never sends email from Postgres. Delivery stays disabled by environment.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_transactional_email_outbox_b305 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('social_welcome','plan_activated')),
  reference_key text NOT NULL CHECK (char_length(reference_key) BETWEEN 1 AND 160),
  subscription_id uuid REFERENCES public.jenios_pay_subscriptions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.jenios_pay_products(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','blocked','uncertain','superseded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0 AND attempts<=5),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  resend_email_id text,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_kind,reference_key),
  CONSTRAINT jenios_b305_transactional_sent_receipt CHECK (status<>'sent' OR (sent_at IS NOT NULL AND resend_email_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS jenios_b305_transactional_due ON public.jenios_transactional_email_outbox_b305(next_attempt_at,created_at) WHERE status IN ('pending','retry','processing');
CREATE INDEX IF NOT EXISTS jenios_b305_transactional_user ON public.jenios_transactional_email_outbox_b305(user_id,event_kind);
ALTER TABLE public.jenios_transactional_email_outbox_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_transactional_email_outbox_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_transactional_email_outbox_b305 TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_queue_social_welcome_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_anonymous IS TRUE OR NEW.email_confirmed_at IS NULL OR COALESCE(NEW.raw_user_meta_data->>'registration_source','') <> 'social' OR NEW.email IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
 INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,status)
 VALUES(NEW.id,'social_welcome',NEW.id::text,'pending') ON CONFLICT(event_kind,reference_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.jenios_queue_social_welcome_b305() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS jenios_b305_social_welcome_insert ON auth.users;
CREATE TRIGGER jenios_b305_social_welcome_insert AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.jenios_queue_social_welcome_b305();
DROP TRIGGER IF EXISTS jenios_b305_social_welcome_confirm ON auth.users;
CREATE TRIGGER jenios_b305_social_welcome_confirm AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
 WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) EXECUTE FUNCTION public.jenios_queue_social_welcome_b305();

CREATE OR REPLACE FUNCTION public.jenios_queue_plan_activated_email_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.jenios_pay_products%ROWTYPE; o public.jenios_pay_orders%ROWTYPE;
BEGIN
 IF NEW.status <> 'active' OR OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.latest_order_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.jenios_pay_products WHERE id=NEW.product_id AND category='platform' AND billing_type='monthly' AND active=true;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=NEW.latest_order_id AND user_id=NEW.user_id AND product_id=NEW.product_id AND status='paid' AND currency='BRL';
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.jenios_pay_entitlements e WHERE e.order_id=o.id AND e.user_id=NEW.user_id AND e.product_id=NEW.product_id AND e.status='active') THEN RETURN NEW; END IF;
 INSERT INTO public.jenios_transactional_email_outbox_b305(user_id,event_kind,reference_key,subscription_id,product_id,status)
 VALUES(NEW.user_id,'plan_activated',NEW.id::text,NEW.id,NEW.product_id,'pending') ON CONFLICT(event_kind,reference_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.jenios_queue_plan_activated_email_b305() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_queue_plan_activated_email_b305() TO service_role;
DROP TRIGGER IF EXISTS jenios_b305_plan_activated_email ON public.jenios_pay_subscriptions;
CREATE TRIGGER jenios_b305_plan_activated_email AFTER UPDATE OF status ON public.jenios_pay_subscriptions FOR EACH ROW
 WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='active') EXECUTE FUNCTION public.jenios_queue_plan_activated_email_b305();

CREATE OR REPLACE FUNCTION public.jenios_claim_transactional_email_b305(p_limit integer DEFAULT 5)
RETURNS SETOF public.jenios_transactional_email_outbox_b305 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_transactional_email_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=now()
 WHERE status IN ('retry','processing') AND first_attempt_at IS NOT NULL AND first_attempt_at < now()-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT q.id FROM public.jenios_transactional_email_outbox_b305 q
  WHERE q.attempts<5 AND q.next_attempt_at<=now() AND (q.status IN ('pending','retry') OR (q.status='processing' AND q.lease_until<now()))
   AND (q.first_attempt_at IS NULL OR q.first_attempt_at>now()-interval '23 hours')
  ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,5),10))
 ) UPDATE public.jenios_transactional_email_outbox_b305 q
 SET status='processing',attempts=q.attempts+1,first_attempt_at=coalesce(q.first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;
CREATE OR REPLACE FUNCTION public.jenios_complete_transactional_email_b305(p_id uuid,p_lease uuid,p_provider_email_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE acknowledged uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF length(coalesce(p_provider_email_id,'')) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_PROVIDER_RECEIPT' USING errcode='22023'; END IF;
 UPDATE public.jenios_transactional_email_outbox_b305 q SET status='sent',resend_email_id=p_provider_email_id,sent_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now(),last_error_code=NULL
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease AND q.lease_until>now() AND q.resend_email_id IS NULL RETURNING q.id INTO acknowledged;
 RETURN acknowledged IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION public.jenios_release_transactional_email_b305(p_id uuid,p_lease uuid,p_error_code text,p_retryable boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE released uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_transactional_email_outbox_b305 q SET status=CASE WHEN p_retryable AND q.attempts<5 AND q.first_attempt_at>now()-interval '23 hours' THEN 'retry' ELSE 'uncertain' END,
 next_attempt_at=now()+make_interval(mins=>least(q.attempts*4,24)),lease_token=NULL,lease_until=NULL,updated_at=now(),last_error_code=left(coalesce(p_error_code,'EMAIL_SEND_UNCONFIRMED'),64)
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease AND q.lease_until>now() RETURNING q.id INTO released;
 RETURN released IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.jenios_claim_transactional_email_b305(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_complete_transactional_email_b305(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_release_transactional_email_b305(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_claim_transactional_email_b305(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_complete_transactional_email_b305(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_release_transactional_email_b305(uuid,uuid,text,boolean) TO service_role;

ALTER TABLE public.jenios_subscription_dunning_outbox_b305
 ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz,
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS lease_token uuid,
 ADD COLUMN IF NOT EXISTS lease_until timestamptz,
 ADD COLUMN IF NOT EXISTS resend_email_id text,
 ADD COLUMN IF NOT EXISTS last_error_code text,
 ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.jenios_subscription_dunning_outbox_b305 DROP CONSTRAINT IF EXISTS jenios_subscription_dunning_outbox_b305_status_check;
ALTER TABLE public.jenios_subscription_dunning_outbox_b305 ADD CONSTRAINT jenios_subscription_dunning_outbox_b305_status_check CHECK (status IN ('pending','processing','retry','sent','blocked','uncertain','superseded'));
ALTER TABLE public.jenios_subscription_dunning_outbox_b305 DROP CONSTRAINT IF EXISTS jenios_b305_dunning_sent_receipt;
ALTER TABLE public.jenios_subscription_dunning_outbox_b305 ADD CONSTRAINT jenios_b305_dunning_sent_receipt CHECK (status<>'sent' OR (sent_at IS NOT NULL AND resend_email_id IS NOT NULL));
DROP INDEX IF EXISTS public.jenios_b305_dunning_pending;
CREATE INDEX IF NOT EXISTS jenios_b305_dunning_delivery_due ON public.jenios_subscription_dunning_outbox_b305(next_attempt_at,created_at) WHERE status IN ('pending','retry','processing');

CREATE OR REPLACE FUNCTION public.jenios_claim_dunning_email_b305(p_limit integer DEFAULT 5)
RETURNS SETOF public.jenios_subscription_dunning_outbox_b305 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_subscription_dunning_outbox_b305 d SET status='superseded',lease_token=NULL,lease_until=NULL,updated_at=now()
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_orders o ON o.id=s.latest_order_id
 WHERE d.subscription_id=s.id AND d.status IN ('pending','retry') AND o.status='paid' AND s.status='active' AND o.updated_at>=d.due_at;
 UPDATE public.jenios_subscription_dunning_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=now()
 WHERE status IN ('retry','processing') AND first_attempt_at IS NOT NULL AND first_attempt_at < now()-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT q.id FROM public.jenios_subscription_dunning_outbox_b305 q
  WHERE q.attempts<5 AND q.next_attempt_at<=now() AND (q.status IN ('pending','retry') OR (q.status='processing' AND q.lease_until<now()))
   AND (q.first_attempt_at IS NULL OR q.first_attempt_at>now()-interval '23 hours')
  ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,5),10))
 ) UPDATE public.jenios_subscription_dunning_outbox_b305 q
 SET status='processing',attempts=q.attempts+1,first_attempt_at=coalesce(q.first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;
CREATE OR REPLACE FUNCTION public.jenios_complete_dunning_email_b305(p_id uuid,p_lease uuid,p_provider_email_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE acknowledged uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF length(coalesce(p_provider_email_id,'')) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_PROVIDER_RECEIPT' USING errcode='22023'; END IF;
 UPDATE public.jenios_subscription_dunning_outbox_b305 q SET status='sent',resend_email_id=p_provider_email_id,sent_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now(),last_error_code=NULL
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease AND q.lease_until>now() AND q.resend_email_id IS NULL RETURNING q.id INTO acknowledged;
 RETURN acknowledged IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION public.jenios_release_dunning_email_b305(p_id uuid,p_lease uuid,p_error_code text,p_retryable boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE released uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_subscription_dunning_outbox_b305 q SET status=CASE WHEN p_retryable AND q.attempts<5 AND q.first_attempt_at>now()-interval '23 hours' THEN 'retry' ELSE 'uncertain' END,
 next_attempt_at=now()+make_interval(mins=>least(q.attempts*4,24)),lease_token=NULL,lease_until=NULL,updated_at=now(),last_error_code=left(coalesce(p_error_code,'EMAIL_SEND_UNCONFIRMED'),64)
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease AND q.lease_until>now() RETURNING q.id INTO released;
 RETURN released IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.jenios_claim_dunning_email_b305(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_complete_dunning_email_b305(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_release_dunning_email_b305(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_claim_dunning_email_b305(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_complete_dunning_email_b305(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_release_dunning_email_b305(uuid,uuid,text,boolean) TO service_role;
COMMIT;
