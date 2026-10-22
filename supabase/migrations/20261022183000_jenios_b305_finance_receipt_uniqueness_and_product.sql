-- B305-R7: finance outbox defense-in-depth and genuine product description.
-- This isolated migration applies ONLY to the JENIOS Social QA project.
-- No emails, banking requests, payments or users are created by this migration.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS jenios_b305_unique_bank_receipt
  ON public.jenios_pay_email_outbox_b305(bank_receipt_id,event_kind);

CREATE OR REPLACE FUNCTION public.jenios_queue_paid_pix_email_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  p public.jenios_pay_payments%ROWTYPE;
  product_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status <> 'paid'
     OR NEW.provider <> 'inter_pix' OR NEW.currency <> 'BRL'
     OR NEW.amount_cents < 1 THEN RETURN NEW; END IF;

  SELECT * INTO p FROM public.jenios_pay_payments
  WHERE order_id = NEW.id AND provider = 'inter_pix'
    AND payment_method = 'pix' AND status = 'confirmed'
    AND amount_cents = NEW.amount_cents
    AND provider_payment_id = replace(NEW.id::text,'-','')
    AND bank_end_to_end_id ~ '^E[A-Za-z0-9]{31}$'
    AND confirmed_at IS NOT NULL
  ORDER BY confirmed_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Product description comes from the paid order's own catalog FK, never
  -- caller input. The bank transaction deliberately does not query auth.users.
  SELECT left(nullif(trim(prod.name),''),120)
    INTO product_label
    FROM public.jenios_pay_products prod WHERE prod.id=NEW.product_id;

  INSERT INTO public.jenios_pay_email_outbox_b305 (
    order_id,payment_id,recipient_user_id,bank_receipt_id,amount_cents,
    currency,paid_at,recipient_email,recipient_name,product_name,status
  ) VALUES (
    NEW.id,p.id,NEW.user_id,p.bank_end_to_end_id,NEW.amount_cents,
    NEW.currency,p.confirmed_at,NULL,'Cliente JENIOS',
    coalesce(product_label,'Compra JENIOS'),
    CASE WHEN NEW.user_id IS NOT NULL THEN 'pending' ELSE 'blocked' END
  )
  ON CONFLICT (order_id,event_kind) DO NOTHING;
  RETURN NEW;
END $$;
COMMIT;
