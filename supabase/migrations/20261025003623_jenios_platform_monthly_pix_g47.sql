-- G47: one explicit Pix per calendar month. No automatic debit and no fixtures.
BEGIN;
CREATE TABLE public.jenios_platform_billing_config_g47 (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 payments_enabled boolean NOT NULL DEFAULT false,
 terms_version text NOT NULL DEFAULT 'platform-monthly-manual-2026-10-24'
 CHECK(terms_version='platform-monthly-manual-2026-10-24')
);
INSERT INTO public.jenios_platform_billing_config_g47 DEFAULT VALUES;
CREATE TABLE public.jenios_platform_payers_g47 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
 platform_user_id uuid NOT NULL UNIQUE,
 platform_project text NOT NULL DEFAULT 'xaicvhagftzjkqphnbgx' CHECK(platform_project='xaicvhagftzjkqphnbgx'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.jenios_platform_invoices_g47 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 link_id uuid NOT NULL REFERENCES public.jenios_platform_payers_g47(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 subscription_id uuid NOT NULL REFERENCES public.jenios_pay_subscriptions(id),
 order_id uuid NOT NULL UNIQUE REFERENCES public.jenios_pay_orders(id),
 product_id uuid NOT NULL REFERENCES public.jenios_pay_products(id),
 product_code text NOT NULL CHECK(product_code IN ('platform-nacional','platform-global-crypto','platform-internacional-pro')),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 terms_version text NOT NULL CHECK(terms_version='platform-monthly-manual-2026-10-24'),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','closed','review')),
 receipt_id uuid UNIQUE REFERENCES public.jenios_pay_payments(id),
 paid_at timestamptz,period_start timestamptz,period_end timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key),
 CHECK(status<>'active' OR (receipt_id IS NOT NULL AND paid_at IS NOT NULL AND period_start>=paid_at AND period_end>period_start))
);
CREATE UNIQUE INDEX jenios_platform_one_pending_g47 ON public.jenios_platform_invoices_g47(user_id) WHERE status='pending';
CREATE INDEX jenios_platform_invoice_owner_g47 ON public.jenios_platform_invoices_g47(user_id,created_at DESC);
ALTER TABLE public.jenios_platform_billing_config_g47 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_platform_payers_g47 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_platform_invoices_g47 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_platform_billing_config_g47,public.jenios_platform_payers_g47,public.jenios_platform_invoices_g47 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.jenios_platform_billing_config_g47 TO service_role;
GRANT SELECT,INSERT ON public.jenios_platform_payers_g47 TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.jenios_platform_invoices_g47 TO service_role;
GRANT SELECT ON public.jenios_pay_products TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_subscriptions TO service_role;

INSERT INTO public.jenios_pay_products(code,name,category,price_cents,currency,billing_type,active) VALUES
 ('platform-nacional','Nacional — B3','platform',9990,'BRL','monthly',true),
 ('platform-global-crypto','Global & Crypto','platform',14990,'BRL','monthly',true),
 ('platform-internacional-pro','Internacional Pro','platform',19990,'BRL','monthly',true)
ON CONFLICT(code) DO NOTHING;

CREATE FUNCTION public.jenios_platform_invoice_guard_g47() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (NEW.id,NEW.link_id,NEW.user_id,NEW.subscription_id,NEW.order_id,NEW.product_id,NEW.product_code,
 NEW.request_key,NEW.terms_version,NEW.amount_cents,NEW.currency,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.link_id,OLD.user_id,OLD.subscription_id,OLD.order_id,OLD.product_id,OLD.product_code,
 OLD.request_key,OLD.terms_version,OLD.amount_cents,OLD.currency,OLD.created_at)
 OR (OLD.status IN ('active','review') AND NEW IS DISTINCT FROM OLD)
 THEN RAISE EXCEPTION 'Immutable Platform invoice'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER jenios_platform_invoice_guard_g47 BEFORE UPDATE ON public.jenios_platform_invoices_g47
FOR EACH ROW EXECUTE FUNCTION public.jenios_platform_invoice_guard_g47();

-- The caller verifies both live Auth sessions independently before this RPC.
-- Neither a matching email nor client-supplied IDs are accepted by the route.
CREATE FUNCTION public.jenios_platform_link_g47(p_user_id uuid,p_platform_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE l public.jenios_platform_payers_g47;
BEGIN
 IF p_user_id IS NULL OR p_platform_user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','IDENTITY_REQUIRED'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('platform-payer-g47',0));
 SELECT * INTO l FROM public.jenios_platform_payers_g47 WHERE user_id=p_user_id OR platform_user_id=p_platform_user_id;
 IF FOUND THEN
  IF l.user_id<>p_user_id OR l.platform_user_id<>p_platform_user_id THEN RETURN jsonb_build_object('ok',false,'code','LINK_CONFLICT'); END IF;
 ELSE INSERT INTO public.jenios_platform_payers_g47(user_id,platform_user_id) VALUES(p_user_id,p_platform_user_id) RETURNING * INTO l;
 END IF;
 RETURN jsonb_build_object('ok',true,'link',to_jsonb(l));
END $$;

CREATE FUNCTION public.jenios_platform_prepare_g47(p_user_id uuid,p_platform_user_id uuid,p_product_code text,p_amount bigint,p_request_key text,p_terms text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE l public.jenios_platform_payers_g47; p public.jenios_pay_products; i public.jenios_platform_invoices_g47;
 s public.jenios_pay_subscriptions; o public.jenios_pay_orders;
BEGIN
 IF p_user_id IS NULL OR p_platform_user_id IS NULL OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9_-]{16,100}$'
 OR p_terms IS DISTINCT FROM 'platform-monthly-manual-2026-10-24' THEN RETURN jsonb_build_object('ok',false,'code','CONSENT_REQUIRED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.jenios_platform_billing_config_g47 WHERE singleton AND payments_enabled)
 THEN RETURN jsonb_build_object('ok',false,'code','PAYMENTS_PAUSED'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('platform-g47:'||p_user_id::text,0));
 SELECT * INTO l FROM public.jenios_platform_payers_g47 WHERE user_id=p_user_id AND platform_user_id=p_platform_user_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','LINK_REQUIRED'); END IF;
 SELECT * INTO i FROM public.jenios_platform_invoices_g47 WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF i.product_code IS DISTINCT FROM p_product_code OR i.amount_cents IS DISTINCT FROM p_amount OR i.terms_version IS DISTINCT FROM p_terms
  THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT'); END IF;
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=i.order_id AND user_id=p_user_id;
  RETURN jsonb_build_object('ok',true,'replayed',true,'invoice',to_jsonb(i),'order',to_jsonb(o));
 END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_platform_invoices_g47 WHERE user_id=p_user_id AND status='review')
 THEN RETURN jsonb_build_object('ok',false,'code','PAID_REVIEW_REQUIRED'); END IF;
 SELECT * INTO i FROM public.jenios_platform_invoices_g47 WHERE user_id=p_user_id AND status='pending' FOR UPDATE;
 IF FOUND THEN
  IF i.product_code IS DISTINCT FROM p_product_code OR i.amount_cents IS DISTINCT FROM p_amount
  THEN RETURN jsonb_build_object('ok',false,'code','PENDING_ORDER_EXISTS'); END IF;
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=i.order_id AND user_id=p_user_id;
  RETURN jsonb_build_object('ok',true,'replayed',true,'invoice',to_jsonb(i),'order',to_jsonb(o));
 END IF;
 -- A manual renewal opens at expiry. No overlapping months or prorated upgrades.
 IF EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions WHERE user_id=p_user_id AND status='active' AND current_period_end>now())
 THEN RETURN jsonb_build_object('ok',false,'code','ACTIVE_PERIOD'); END IF;
 SELECT * INTO p FROM public.jenios_pay_products WHERE code=p_product_code AND category='platform'
  AND code IN ('platform-nacional','platform-global-crypto','platform-internacional-pro') AND active
  AND currency='BRL' AND billing_type='monthly' AND price_cents=p_amount AND price_cents BETWEEN 1 AND 100000000;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','PRICE_CHANGED'); END IF;
 SELECT sub.* INTO s FROM public.jenios_pay_subscriptions sub JOIN public.jenios_platform_invoices_g47 prior ON prior.subscription_id=sub.id
 WHERE prior.user_id=p_user_id ORDER BY prior.created_at DESC LIMIT 1 FOR UPDATE OF sub;
 IF NOT FOUND THEN
  INSERT INTO public.jenios_pay_subscriptions(user_id,product_id,status) VALUES(p_user_id,p.id,'pending') RETURNING * INTO s;
 END IF;
 INSERT INTO public.jenios_pay_orders(user_id,product_id,amount_cents,currency,status,provider,idempotency_key,external_reference)
 VALUES(p_user_id,p.id,p_amount,'BRL','pending','inter_pix','platform:'||p_user_id::text||':'||p_request_key,
 jsonb_build_object('scope','platform','productCode',p.code,'billingType','monthly','renewalMode','manual_pix','termsVersion',p_terms,
 'linkId',l.id,'fingerprint','platform:'||p_user_id::text||':'||p_request_key)::text) RETURNING * INTO o;
 INSERT INTO public.jenios_platform_invoices_g47(link_id,user_id,subscription_id,order_id,product_id,product_code,request_key,terms_version,amount_cents)
 VALUES(l.id,p_user_id,s.id,o.id,p.id,p.code,p_request_key,p_terms,p_amount) RETURNING * INTO i;
 RETURN jsonb_build_object('ok',true,'replayed',false,'invoice',to_jsonb(i),'order',to_jsonb(o));
END $$;

-- Called only with a bank response re-read and verified by the server.
-- Reconciliation uses the existing authenticated status path, not browser claims.
CREATE FUNCTION public.jenios_platform_confirm_pix_g47(p_order_id uuid,p_txid text,p_amount integer,p_end_to_end_id text,p_paid_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i public.jenios_platform_invoices_g47; o public.jenios_pay_orders; r public.jenios_pay_payments;
 s public.jenios_pay_subscriptions; end_at timestamptz; local_paid timestamp; month_start timestamp; last_day integer;
BEGIN
 SELECT * INTO i FROM public.jenios_platform_invoices_g47 WHERE order_id=p_order_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Platform invoice not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('platform-g47:'||i.user_id::text,0));
 SELECT * INTO i FROM public.jenios_platform_invoices_g47 WHERE order_id=p_order_id FOR UPDATE;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=i.order_id FOR UPDATE;
 IF o.user_id IS DISTINCT FROM i.user_id OR o.product_id IS DISTINCT FROM i.product_id OR o.amount_cents IS DISTINCT FROM i.amount_cents
 OR o.currency<>'BRL' OR o.provider<>'inter_pix' OR o.status NOT IN ('pending','awaiting_payment','paid')
 OR p_txid IS DISTINCT FROM replace(o.id::text,'-','') OR p_amount IS DISTINCT FROM o.amount_cents
 OR p_end_to_end_id IS NULL OR p_end_to_end_id !~ '^E[a-zA-Z0-9]{31}$'
 OR p_paid_at IS NULL OR p_paid_at<o.created_at-interval '5 minutes' OR p_paid_at>now()
 OR o.idempotency_key IS DISTINCT FROM 'platform:'||i.user_id::text||':'||i.request_key
 OR (o.external_reference::jsonb)->>'scope' IS DISTINCT FROM 'platform'
 OR (o.external_reference::jsonb)->>'linkId' IS DISTINCT FROM i.link_id::text
 OR (o.external_reference::jsonb)->>'productCode' IS DISTINCT FROM i.product_code
 OR (o.external_reference::jsonb)->>'termsVersion' IS DISTINCT FROM i.terms_version
 OR (o.external_reference::jsonb)->>'renewalMode' IS DISTINCT FROM 'manual_pix'
 OR (o.external_reference::jsonb)->>'billingType' IS DISTINCT FROM 'monthly'
 OR (o.external_reference::jsonb)->>'fingerprint' IS DISTINCT FROM o.idempotency_key
 OR NOT EXISTS(SELECT 1 FROM public.jenios_platform_payers_g47 WHERE id=i.link_id AND user_id=i.user_id)
 THEN RAISE EXCEPTION 'Platform payment mismatch'; END IF;
 SELECT * INTO r FROM public.jenios_pay_payments WHERE order_id=o.id AND provider='inter_pix' AND provider_payment_id=p_txid FOR UPDATE;
 IF NOT FOUND OR r.amount_cents<>p_amount OR r.payment_method<>'pix' OR r.status NOT IN ('pending','confirmed')
 OR (r.bank_end_to_end_id IS NOT NULL AND r.bank_end_to_end_id<>p_end_to_end_id)
 OR (r.status='confirmed' AND r.confirmed_at IS DISTINCT FROM p_paid_at)
 THEN RAISE EXCEPTION 'Platform receipt mismatch'; END IF;
 IF i.status IN ('active','review') THEN
  IF o.status<>'paid' OR r.status<>'confirmed' OR i.receipt_id IS DISTINCT FROM r.id OR i.paid_at IS DISTINCT FROM p_paid_at
  THEN RAISE EXCEPTION 'Platform receipt changed'; END IF;
  RETURN jsonb_build_object('ok',i.status='active','replayed',true,'code',CASE WHEN i.status='review' THEN 'PAID_REVIEW_REQUIRED' ELSE 'ACTIVE' END);
 END IF;
 UPDATE public.jenios_pay_payments SET status='confirmed',bank_end_to_end_id=p_end_to_end_id,confirmed_at=p_paid_at,updated_at=now() WHERE id=r.id;
 UPDATE public.jenios_pay_orders SET status='paid',updated_at=now() WHERE id=o.id;
 SELECT * INTO s FROM public.jenios_pay_subscriptions WHERE id=i.subscription_id AND user_id=i.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Platform subscription missing'; END IF;
 -- A delayed receipt overlapping another paid month must be reconciled without
 -- granting a second allowance or discarding the money already received.
 IF s.current_period_end>p_paid_at AND EXISTS(SELECT 1 FROM public.jenios_pay_orders prior WHERE prior.id=s.latest_order_id AND prior.status='paid') THEN
  UPDATE public.jenios_platform_invoices_g47 SET status='review',receipt_id=r.id,paid_at=p_paid_at WHERE id=i.id;
  RETURN jsonb_build_object('ok',false,'code','PAID_REVIEW_REQUIRED');
 END IF;
 local_paid:=p_paid_at AT TIME ZONE 'America/Sao_Paulo';
 month_start:=date_trunc('month',local_paid)+interval '1 month';
 last_day:=extract(day FROM month_start+interval '1 month'-interval '1 day');
 end_at:=(month_start::date+(least(extract(day FROM local_paid)::integer,last_day)-1)+local_paid::time) AT TIME ZONE 'America/Sao_Paulo';
 UPDATE public.jenios_platform_invoices_g47 SET status='active',receipt_id=r.id,paid_at=p_paid_at,period_start=p_paid_at,period_end=end_at WHERE id=i.id;
 UPDATE public.jenios_pay_subscriptions SET product_id=i.product_id,latest_order_id=o.id,status='active',current_period_start=p_paid_at,
 current_period_end=end_at,cancel_at_period_end=false,updated_at=now() WHERE id=s.id;
 RETURN jsonb_build_object('ok',true,'code','ACTIVE','periodEnd',end_at);
END $$;

-- Refund/revocation does not leave the latest paid month granting access.
CREATE FUNCTION public.jenios_platform_revoke_g47() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (TG_TABLE_NAME='jenios_pay_orders' AND NEW.status IN ('refunded','cancelled','expired')) THEN
  UPDATE public.jenios_pay_subscriptions SET status='cancelled',updated_at=now()
  WHERE latest_order_id=NEW.id AND EXISTS(SELECT 1 FROM public.jenios_platform_invoices_g47 WHERE order_id=NEW.id);
 ELSIF TG_TABLE_NAME='jenios_pay_payments' AND OLD.status='confirmed' AND NEW.status<>'confirmed' THEN
  UPDATE public.jenios_pay_subscriptions SET status='cancelled',updated_at=now()
  WHERE latest_order_id=NEW.order_id AND EXISTS(SELECT 1 FROM public.jenios_platform_invoices_g47 WHERE receipt_id=NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER jenios_platform_refund_g47 AFTER UPDATE OF status ON public.jenios_pay_orders
FOR EACH ROW EXECUTE FUNCTION public.jenios_platform_revoke_g47();
CREATE TRIGGER jenios_platform_receipt_revoke_g47 AFTER UPDATE OF status ON public.jenios_pay_payments
FOR EACH ROW EXECUTE FUNCTION public.jenios_platform_revoke_g47();

REVOKE ALL ON FUNCTION public.jenios_platform_invoice_guard_g47(),public.jenios_platform_link_g47(uuid,uuid),
public.jenios_platform_prepare_g47(uuid,uuid,text,bigint,text,text),public.jenios_platform_confirm_pix_g47(uuid,text,integer,text,timestamptz),
public.jenios_platform_revoke_g47() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_platform_link_g47(uuid,uuid),public.jenios_platform_prepare_g47(uuid,uuid,text,bigint,text,text),
public.jenios_platform_confirm_pix_g47(uuid,text,integer,text,timestamptz) TO service_role;
COMMIT;
