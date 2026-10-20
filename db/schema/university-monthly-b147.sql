-- B147: Universidade independente, R$ 49,90 por mês, renovação manual por Pix.
-- Não cria clientes, pedidos, pagamentos ou créditos. O preço foi aprovado em 20/10/2026.
-- Executar integralmente em uma transação. Objetos privados; nenhuma política de cliente.
INSERT INTO public.jenios_pay_products(code,name,category,price_cents,currency,billing_type,active)
VALUES('social-university-monthly','Universidade JENIOS — mensal','other',4990,'BRL','monthly',true)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.jenios_university_invoices_b147 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 order_id uuid NOT NULL UNIQUE REFERENCES public.jenios_pay_orders(id),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 terms_version text NOT NULL CHECK(terms_version='university-monthly-2026-10-20'),
 amount_cents bigint NOT NULL DEFAULT 4990 CHECK(amount_cents=4990),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','closed')),
 closed_status text CHECK(closed_status IN ('cancelled','expired','refunded')),
 receipt_id uuid UNIQUE REFERENCES public.jenios_pay_payments(id),
 paid_at timestamptz,period_start timestamptz,period_end timestamptz,
 anchor_day integer CHECK(anchor_day BETWEEN 1 AND 31),anchor_time time,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key),
 CHECK((status='active' AND receipt_id IS NOT NULL AND paid_at IS NOT NULL AND period_start IS NOT NULL
  AND period_end>period_start AND anchor_day IS NOT NULL AND anchor_time IS NOT NULL) OR status IN ('pending','closed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS jenios_university_one_pending_b147 ON public.jenios_university_invoices_b147(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS jenios_university_owner_period_b147 ON public.jenios_university_invoices_b147(user_id,period_end DESC);
ALTER TABLE public.jenios_university_invoices_b147 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_university_invoices_b147 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.jenios_university_invoices_b147 TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_university_invoice_guard_b147()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Monthly evidence cannot be deleted';END IF;
 IF OLD.status='active' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Paid monthly evidence is immutable';END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.order_id IS DISTINCT FROM OLD.order_id
  OR NEW.request_key IS DISTINCT FROM OLD.request_key OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
  OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents OR NEW.currency IS DISTINCT FROM OLD.currency
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Monthly identity is immutable';END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.jenios_university_invoice_guard_b147() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS jenios_university_invoice_guard_b147 ON public.jenios_university_invoices_b147;
CREATE TRIGGER jenios_university_invoice_guard_b147 BEFORE UPDATE OR DELETE ON public.jenios_university_invoices_b147
 FOR EACH ROW EXECUTE FUNCTION public.jenios_university_invoice_guard_b147();

CREATE OR REPLACE FUNCTION public.jenios_university_month_end_b147(p_start timestamptz,p_day integer,p_time time)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE m timestamp;last_day integer;
BEGIN
 IF p_start IS NULL OR p_day IS NULL OR p_day NOT BETWEEN 1 AND 31 OR p_time IS NULL THEN RAISE EXCEPTION 'Invalid monthly anchor';END IF;
 m:=date_trunc('month',p_start AT TIME ZONE 'America/Sao_Paulo')+interval '1 month';
 last_day:=extract(day FROM m+interval '1 month'-interval '1 day');
 RETURN (m::date+(least(p_day,last_day)-1)+p_time) AT TIME ZONE 'America/Sao_Paulo';
END;$$;
REVOKE ALL ON FUNCTION public.jenios_university_month_end_b147(timestamptz,integer,time) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_university_month_end_b147(timestamptz,integer,time) TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_university_prepare_b147(p_user_id uuid,p_request_key text,p_terms_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE product public.jenios_pay_products; invoice public.jenios_university_invoices_b147; o public.jenios_pay_orders; included boolean; future_paid boolean;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9_-]{16,100}$'
  OR p_terms_version IS DISTINCT FROM 'university-monthly-2026-10-20' THEN RETURN jsonb_build_object('ok',false,'code','INVALID_CONSENT');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('university-b147:'||p_user_id::text,0));
 SELECT * INTO product FROM public.jenios_pay_products WHERE code='social-university-monthly';
 IF NOT FOUND OR product.active IS DISTINCT FROM true OR product.category<>'other' OR product.currency<>'BRL'
  OR product.billing_type<>'monthly' OR product.price_cents<>4990 THEN RETURN jsonb_build_object('ok',false,'code','PRODUCT_UNAVAILABLE');END IF;
 SELECT EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
  WHERE s.user_id=p_user_id AND s.status IN ('active','trialing') AND s.current_period_start<=now() AND s.current_period_end>now()
  AND p.category='platform' AND p.code IN ('platform-global-crypto','platform-internacional-pro')) INTO included;
 -- A refunded current month must not turn a paid future month into an upsell.
 -- Require review/its scheduled start before accepting another unpaid invoice.
 WITH verified AS (
  SELECT i.period_start,i.period_end FROM public.jenios_university_invoices_b147 i
  JOIN public.jenios_pay_orders po ON po.id=i.order_id AND po.user_id=i.user_id AND po.status='paid'
   AND po.product_id=product.id AND po.amount_cents=4990 AND po.currency='BRL' AND po.provider='inter_pix'
  JOIN public.jenios_pay_payments pp ON pp.id=i.receipt_id AND pp.order_id=i.order_id AND pp.status='confirmed'
   AND pp.provider='inter_pix' AND pp.payment_method='pix' AND pp.amount_cents=4990
   AND pp.provider_payment_id=replace(i.order_id::text,'-','') AND pp.confirmed_at=i.paid_at
  WHERE i.user_id=p_user_id AND i.status='active' AND i.period_end>now()
 ) SELECT EXISTS(SELECT 1 FROM verified WHERE period_start>now())
  AND NOT EXISTS(SELECT 1 FROM verified WHERE period_start<=now()) INTO future_paid;
 SELECT * INTO invoice FROM public.jenios_university_invoices_b147 WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=invoice.order_id AND user_id=p_user_id;
  IF included AND o.status<>'paid' THEN RETURN jsonb_build_object('ok',false,'code','UNIVERSITY_INCLUDED');END IF;
  IF future_paid AND o.status<>'paid' THEN RETURN jsonb_build_object('ok',false,'code','FUTURE_PAID_PERIOD');END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'invoice',to_jsonb(invoice),'order',to_jsonb(o));
 END IF;
 IF included THEN RETURN jsonb_build_object('ok',false,'code','UNIVERSITY_INCLUDED');END IF;
 IF future_paid THEN RETURN jsonb_build_object('ok',false,'code','FUTURE_PAID_PERIOD');END IF;
 -- A different browser/key resumes the same pending charge; a transport retry
 -- must never open a second payable Pix for this member.
 SELECT * INTO invoice FROM public.jenios_university_invoices_b147 WHERE user_id=p_user_id AND status='pending' FOR UPDATE;
 IF FOUND THEN
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=invoice.order_id AND user_id=p_user_id;
  IF o.status IN ('cancelled','expired','refunded') THEN
   UPDATE public.jenios_university_invoices_b147 SET status='closed',closed_status=o.status,updated_at=now() WHERE id=invoice.id;
  ELSE
   RETURN jsonb_build_object('ok',true,'replayed',true,'invoice',to_jsonb(invoice),'order',to_jsonb(o));
  END IF;
 END IF;
 INSERT INTO public.jenios_pay_orders(user_id,product_id,amount_cents,currency,status,provider,idempotency_key,external_reference)
 VALUES(p_user_id,product.id,4990,'BRL','pending','inter_pix','university:'||p_user_id::text||':'||p_request_key,
  jsonb_build_object('productCode','social-university-monthly','scope','social','termsVersion',p_terms_version,'billingType','monthly',
   'renewalMode','manual_pix','fingerprint','university:'||p_user_id::text||':'||p_request_key)::text) RETURNING * INTO o;
 INSERT INTO public.jenios_university_invoices_b147(user_id,order_id,request_key,terms_version)
 VALUES(p_user_id,o.id,p_request_key,p_terms_version) RETURNING * INTO invoice;
 RETURN jsonb_build_object('ok',true,'replayed',false,'invoice',to_jsonb(invoice),'order',to_jsonb(o));
END;$$;
REVOKE ALL ON FUNCTION public.jenios_university_prepare_b147(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_university_prepare_b147(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_university_confirm_b147(p_user_id uuid,p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE invoice public.jenios_university_invoices_b147; prior public.jenios_university_invoices_b147;
 o public.jenios_pay_orders; receipt public.jenios_pay_payments; product public.jenios_pay_products;
 start_at timestamptz; end_at timestamptz; anchor integer; local_time time; local_paid timestamp;
BEGIN
 IF p_user_id IS NULL OR p_order_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','ORDER_NOT_FOUND');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('university-b147:'||p_user_id::text,0));
 SELECT * INTO invoice FROM public.jenios_university_invoices_b147 WHERE user_id=p_user_id AND order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','ORDER_NOT_FOUND');END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
 SELECT * INTO product FROM public.jenios_pay_products WHERE id=o.product_id;
 IF o.status IS DISTINCT FROM 'paid' OR o.provider<>'inter_pix' OR o.currency<>'BRL' OR o.amount_cents<>4990
  OR product.code IS DISTINCT FROM 'social-university-monthly' OR product.category<>'other'
  OR invoice.currency<>o.currency OR invoice.amount_cents<>o.amount_cents
  OR o.idempotency_key IS DISTINCT FROM 'university:'||p_user_id::text||':'||invoice.request_key
  OR (o.external_reference::jsonb)->>'productCode' IS DISTINCT FROM 'social-university-monthly'
  OR (o.external_reference::jsonb)->>'scope' IS DISTINCT FROM 'social'
  OR (o.external_reference::jsonb)->>'termsVersion' IS DISTINCT FROM invoice.terms_version
  OR (o.external_reference::jsonb)->>'billingType' IS DISTINCT FROM 'monthly'
  OR (o.external_reference::jsonb)->>'renewalMode' IS DISTINCT FROM 'manual_pix'
  OR (o.external_reference::jsonb)->>'fingerprint' IS DISTINCT FROM 'university:'||p_user_id::text||':'||invoice.request_key
 THEN RETURN jsonb_build_object('ok',false,'code','PAYMENT_NOT_CONFIRMED');END IF;
 SELECT * INTO receipt FROM public.jenios_pay_payments p WHERE p.order_id=o.id AND p.status='confirmed'
  AND p.provider='inter_pix' AND p.payment_method='pix' AND p.amount_cents=o.amount_cents
  AND p.provider_payment_id=replace(o.id::text,'-','') AND p.confirmed_at>=o.created_at-interval '5 minutes' AND p.confirmed_at<=now()
 ORDER BY p.confirmed_at ASC,p.id ASC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','PAYMENT_NOT_CONFIRMED');END IF;
 IF invoice.status='active' THEN
  IF invoice.receipt_id IS DISTINCT FROM receipt.id OR invoice.paid_at IS DISTINCT FROM receipt.confirmed_at
  THEN RETURN jsonb_build_object('ok',false,'code','RECEIPT_MISMATCH');END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'invoice',to_jsonb(invoice));
 END IF;
 -- A bank-confirmed receipt can arrive after an earlier expiry read. Keep the
 -- same invoice recoverable; a verified payment is never discarded as expired.
 IF invoice.status NOT IN ('pending','closed') THEN RETURN jsonb_build_object('ok',false,'code','ORDER_CLOSED');END IF;
 -- Only still-paid, receipt-matching previous periods may extend this renewal.
 SELECT i.* INTO prior FROM public.jenios_university_invoices_b147 i
 JOIN public.jenios_pay_orders old_order ON old_order.id=i.order_id AND old_order.user_id=i.user_id AND old_order.status='paid'
 JOIN public.jenios_pay_payments p ON p.id=i.receipt_id AND p.order_id=i.order_id AND p.status='confirmed'
  AND p.provider='inter_pix' AND p.payment_method='pix' AND p.provider_payment_id=replace(i.order_id::text,'-','')
  AND p.amount_cents=4990 AND p.confirmed_at=i.paid_at
 WHERE i.user_id=p_user_id AND i.status='active' AND i.period_end>=receipt.confirmed_at
  AND old_order.amount_cents=4990 AND old_order.currency='BRL' AND old_order.product_id=o.product_id
 ORDER BY i.period_end DESC,i.id ASC LIMIT 1;
 IF FOUND THEN start_at:=prior.period_end;anchor:=prior.anchor_day;local_time:=prior.anchor_time;
 ELSE
  start_at:=receipt.confirmed_at;local_paid:=start_at AT TIME ZONE 'America/Sao_Paulo';
  anchor:=extract(day FROM local_paid);local_time:=local_paid::time;
 END IF;
 end_at:=public.jenios_university_month_end_b147(start_at,anchor,local_time);
 UPDATE public.jenios_university_invoices_b147 SET status='active',receipt_id=receipt.id,paid_at=receipt.confirmed_at,
  period_start=start_at,period_end=end_at,anchor_day=anchor,anchor_time=local_time,updated_at=now()
 WHERE id=invoice.id RETURNING * INTO invoice;
 RETURN jsonb_build_object('ok',true,'replayed',false,'invoice',to_jsonb(invoice));
END;$$;
REVOKE ALL ON FUNCTION public.jenios_university_confirm_b147(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_university_confirm_b147(uuid,uuid) TO service_role;
