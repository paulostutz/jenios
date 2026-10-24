-- B305 Finance transactional notification outbox.
-- Staged for JENIOS Social QA only; not a payment system, and does not send emails.
BEGIN;

CREATE TABLE IF NOT EXISTS public.jenios_pay_email_outbox_b305 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.jenios_pay_orders(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.jenios_pay_payments(id) ON DELETE RESTRICT,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_kind text NOT NULL DEFAULT 'payment_confirmed' CHECK (event_kind='payment_confirmed'),
  bank_receipt_id text NOT NULL CHECK (bank_receipt_id ~ '^E[A-Za-z0-9]{31}$'),
  amount_cents bigint NOT NULL CHECK (amount_cents>0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency='BRL'),
  paid_at timestamptz NOT NULL,
  recipient_email text,
  recipient_name text NOT NULL,
  product_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','retry','sent','blocked','uncertain')),
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
  CONSTRAINT jenios_b305_once_per_order UNIQUE (order_id,event_kind),
  CONSTRAINT jenios_b305_once_per_payment UNIQUE (payment_id,event_kind),
  CONSTRAINT jenios_b305_sent_only_with_receipt
    CHECK (status<>'sent' OR (sent_at IS NOT NULL AND resend_email_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS jenios_b305_email_queue_due
 ON public.jenios_pay_email_outbox_b305 (next_attempt_at,created_at)
 WHERE status IN ('pending','retry','processing');
ALTER TABLE public.jenios_pay_email_outbox_b305 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_pay_email_outbox_b305 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_email_outbox_b305 TO service_role;
-- No browser RLS policies. No browser table or RPC access.

CREATE OR REPLACE FUNCTION public.jenios_queue_paid_pix_email_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  p public.jenios_pay_payments%ROWTYPE;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status <> 'paid'
     OR NEW.provider <> 'inter_pix' OR NEW.currency <> 'BRL'
     OR NEW.amount_cents < 1 THEN RETURN NEW; END IF;

  -- Confirmed Pix receipt must be linked to this order, amount and txid.
  -- No access to auth.users is needed in the bank transaction: service_role
  -- cannot read it directly. Auth lookup is deferred to the private worker.
  SELECT * INTO p FROM public.jenios_pay_payments
  WHERE order_id = NEW.id AND provider = 'inter_pix'
    AND payment_method = 'pix' AND status = 'confirmed'
    AND amount_cents = NEW.amount_cents
    AND provider_payment_id = replace(NEW.id::text,'-','')
    AND bank_end_to_end_id ~ '^E[A-Za-z0-9]{31}$'
    AND confirmed_at IS NOT NULL
  ORDER BY confirmed_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.jenios_pay_email_outbox_b305 (
    order_id,payment_id,recipient_user_id,bank_receipt_id,amount_cents,
    currency,paid_at,recipient_email,recipient_name,product_name,status
  ) VALUES (
    NEW.id,p.id,NEW.user_id,p.bank_end_to_end_id,NEW.amount_cents,
    NEW.currency,p.confirmed_at,NULL,'Cliente JENIOS','Compra JENIOS',
    CASE WHEN NEW.user_id IS NOT NULL THEN 'pending' ELSE 'blocked' END
  )
  ON CONFLICT (order_id,event_kind) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jenios_b305_paid_pix_email ON public.jenios_pay_orders;
CREATE TRIGGER jenios_b305_paid_pix_email
 AFTER UPDATE OF status ON public.jenios_pay_orders
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='paid')
 EXECUTE FUNCTION public.jenios_queue_paid_pix_email_b305();

-- Atomically claim a limited batch; locks prevent concurrent double workers.
CREATE OR REPLACE FUNCTION public.jenios_claim_pay_email_b305(p_limit integer DEFAULT 5)
RETURNS SETOF public.jenios_pay_email_outbox_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'JENIOS_FINANCE_SERVICE_REQUIRED' USING errcode='42501';
 END IF;
 -- Resend idempotency expires after 24h. Quarantine ambiguous older attempts.
 UPDATE public.jenios_pay_email_outbox_b305
 SET status='uncertain',lease_token=NULL,lease_until=NULL,
  last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=now()
 WHERE status IN ('retry','processing')
  AND first_attempt_at IS NOT NULL AND first_attempt_at < now()-interval '23 hours';
 RETURN QUERY
 WITH candidates AS (
  SELECT q.id FROM public.jenios_pay_email_outbox_b305 q
  WHERE q.attempts<5 AND q.recipient_user_id IS NOT NULL
    AND q.next_attempt_at<=now()
    AND (q.status IN ('pending','retry')
      OR (q.status='processing' AND q.lease_until<now()))
    AND (q.first_attempt_at IS NULL OR q.first_attempt_at>now()-interval '23 hours')
  ORDER BY q.created_at FOR UPDATE SKIP LOCKED
  LIMIT greatest(1,least(coalesce(p_limit,5),10))
 )
 UPDATE public.jenios_pay_email_outbox_b305 q
 SET status='processing',attempts=q.attempts+1,
  first_attempt_at=coalesce(q.first_attempt_at,now()),
  lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
  updated_at=now()
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_complete_pay_email_b305(
 p_id uuid,p_lease uuid,p_provider_email_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE acknowledged uuid;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'JENIOS_FINANCE_SERVICE_REQUIRED' USING errcode='42501';
 END IF;
 IF length(coalesce(p_provider_email_id,'')) NOT BETWEEN 8 AND 200 THEN
  RAISE EXCEPTION 'INVALID_PROVIDER_RECEIPT' USING errcode='22023';
 END IF;
 UPDATE public.jenios_pay_email_outbox_b305 q SET status='sent',
  resend_email_id=p_provider_email_id,sent_at=now(),
  lease_token=NULL,lease_until=NULL,updated_at=now(),last_error_code=NULL
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease
  AND q.lease_until>now() AND q.resend_email_id IS NULL
 RETURNING q.id INTO acknowledged;
 RETURN acknowledged IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_release_pay_email_b305(
 p_id uuid,p_lease uuid,p_error_code text,p_retryable boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE released uuid;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'JENIOS_FINANCE_SERVICE_REQUIRED' USING errcode='42501';
 END IF;
 UPDATE public.jenios_pay_email_outbox_b305 q
 SET status=CASE WHEN p_retryable AND q.attempts<5
    AND q.first_attempt_at>now()-interval '23 hours' THEN 'retry'
    ELSE 'uncertain' END,
  next_attempt_at=now()+make_interval(mins=>least(q.attempts*4,24)),
  lease_token=NULL,lease_until=NULL,updated_at=now(),
  last_error_code=left(coalesce(p_error_code,'EMAIL_SEND_UNCONFIRMED'),64)
 WHERE q.id=p_id AND q.status='processing' AND q.lease_token=p_lease
  AND q.lease_until>now()
 RETURNING q.id INTO released;
 RETURN released IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.jenios_claim_pay_email_b305(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_complete_pay_email_b305(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_release_pay_email_b305(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_claim_pay_email_b305(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_complete_pay_email_b305(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_release_pay_email_b305(uuid,uuid,text,boolean) TO service_role;
COMMIT;
