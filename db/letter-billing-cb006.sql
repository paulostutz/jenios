BEGIN;
CREATE SCHEMA IF NOT EXISTS jenios_letter_cb006;
REVOKE ALL ON SCHEMA jenios_letter_cb006 FROM PUBLIC,anon,authenticated;
CREATE TABLE jenios_letter_cb006.config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,receiver_id uuid NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE jenios_letter_cb006.orders(
 id uuid PRIMARY KEY REFERENCES public.jenios_pay_orders(id),user_id uuid NOT NULL,platform_user_id uuid,subscription_id uuid NOT NULL REFERENCES public.jenios_pay_subscriptions(id),
 product_code text NOT NULL,request_key uuid NOT NULL,offer jsonb NOT NULL,input jsonb NOT NULL,receiver_id uuid NOT NULL,
 period_start timestamptz NOT NULL,period_end timestamptz NOT NULL CHECK(period_end>period_start),central_id uuid UNIQUE,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN('prepared','sending','submitted','uncertain','issued','paid','closed','void')),
 receipt jsonb,access_applied boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key),UNIQUE(user_id,product_code,period_start,period_end)
);
CREATE UNIQUE INDEX one_pending ON jenios_letter_cb006.orders(user_id) WHERE state NOT IN('paid','closed','void');
CREATE TABLE jenios_letter_cb006.journal(order_id uuid NOT NULL REFERENCES jenios_letter_cb006.orders(id),operation_key text NOT NULL,phase text NOT NULL CHECK(phase IN('prepare','issue')),fingerprint text NOT NULL,state text NOT NULL DEFAULT 'reserved',PRIMARY KEY(order_id,operation_key,phase));
ALTER TABLE jenios_letter_cb006.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE jenios_letter_cb006.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE jenios_letter_cb006.journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA jenios_letter_cb006 FROM PUBLIC,anon,authenticated;
CREATE FUNCTION jenios_letter_cb006.immutable_order() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FINANCIAL_HISTORY_REQUIRED';END IF;
 IF (to_jsonb(NEW)-ARRAY['central_id','state','receipt','access_applied','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['central_id','state','receipt','access_applied','updated_at']) OR (OLD.central_id IS NOT NULL AND NEW.central_id IS DISTINCT FROM OLD.central_id) OR (OLD.state='paid' AND (NEW.state<>'paid' OR NEW.receipt IS DISTINCT FROM OLD.receipt)) THEN RAISE EXCEPTION 'FINANCIAL_IDENTITY_IMMUTABLE';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER immutable_order BEFORE UPDATE OR DELETE ON jenios_letter_cb006.orders FOR EACH ROW EXECUTE FUNCTION jenios_letter_cb006.immutable_order();
CREATE FUNCTION jenios_letter_cb006.revoke_native() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.status IN('refunded','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE public.jenios_pay_subscriptions SET status='cancelled',cancel_at_period_end=true,updated_at=now() WHERE id IN(SELECT subscription_id FROM jenios_letter_cb006.orders WHERE id=NEW.id);
  UPDATE public.jenios_pay_entitlements SET status='revoked' WHERE order_id=NEW.id AND EXISTS(SELECT 1 FROM jenios_letter_cb006.orders WHERE id=NEW.id);
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER letter_revoke_native_cb006 AFTER UPDATE OF status ON public.jenios_pay_orders FOR EACH ROW EXECUTE FUNCTION jenios_letter_cb006.revoke_native();

CREATE FUNCTION public.jenios_letter_billing_cb006(p_user uuid,p_action text,p_data jsonb DEFAULT '{}'::jsonb,p_platform uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jenios_letter_cb006.config%ROWTYPE;o jenios_letter_cb006.orders%ROWTYPE;j jenios_letter_cb006.journal%ROWTYPE;
 p public.jenios_pay_products%ROWTYPE;s public.jenios_pay_subscriptions%ROWTYPE;n public.jenios_pay_orders%ROWTYPE;
 v_offer jsonb;v_input jsonb;v_receipt jsonb;v_rows jsonb;v_access jsonb;v_start timestamptz;v_end timestamptz;v_id uuid;v_terms text;v_apply boolean:=false;v_purpose text;
BEGIN
 IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user AND deleted_at IS NULL AND is_anonymous IS FALSE AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'USER_REQUIRED';END IF;
 IF p_action IS NULL OR p_action NOT IN('status','quote','prepare','read','claim','journal','receipt','cancel') OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>24000 THEN RAISE EXCEPTION 'REQUEST_INVALID';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('platform-g47:'||p_user::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('university-b147:'||p_user::text,0));
 SELECT * INTO c FROM jenios_letter_cb006.config WHERE singleton;
 IF p_action='status' THEN
  SELECT coalesce(jsonb_agg(v ORDER BY v->>'created_at' DESC),'[]') INTO v_rows FROM(SELECT jsonb_build_object('id',id,'product_code',product_code,'amount_cents',offer->'amount_cents','state',state,'period_start',input->'period_start','period_end',input->'period_end','created_at',created_at,'payment',CASE WHEN state='issued' THEN receipt->'payment' ELSE NULL END,'access_applied',access_applied) v FROM jenios_letter_cb006.orders WHERE user_id=p_user ORDER BY created_at DESC LIMIT 30)a;
  SELECT jsonb_build_object('active',true,'productCode',l.product_code,'startsAt',l.input->'period_start','validUntil',l.input->'period_end','cancelAtPeriodEnd',sub.cancel_at_period_end) INTO v_access FROM jenios_letter_cb006.orders l JOIN public.jenios_pay_orders po ON po.id=l.id JOIN public.jenios_pay_subscriptions sub ON sub.id=l.subscription_id
   WHERE l.user_id=p_user AND l.state='paid' AND l.access_applied AND po.status='paid' AND sub.status='active' AND l.period_start<=now() AND l.period_end>now() AND (coalesce(p_data->>'scope','') NOT IN('platform','university') OR (p_data->>'scope'='platform' AND l.product_code LIKE 'platform-%') OR (p_data->>'scope'='university' AND l.product_code='social-university-monthly')) AND sub.current_period_start=l.period_start AND sub.current_period_end=l.period_end ORDER BY l.period_end DESC LIMIT 1;
  RETURN jsonb_build_object('ok',true,'available',coalesce(c.enabled AND c.expires_at>now(),false),'receiver_id',c.receiver_id,'orders',v_rows,'access',v_access);
 END IF;
 IF p_action IN('quote','prepare') THEN
  IF NOT coalesce(c.enabled AND c.expires_at>now(),false) THEN RAISE EXCEPTION 'BILLING_NOT_READY';END IF;
  SELECT * INTO p FROM public.jenios_pay_products WHERE code=coalesce(p_data->>'product_code',p_data#>>'{offer,product_code}') AND active AND billing_type='monthly' AND currency='BRL'
   AND ((category='platform' AND code IN('platform-nacional','platform-global-crypto','platform-internacional-pro')) OR (category='other' AND code='social-university-monthly' AND price_cents=4990));
  IF p.id IS NULL OR p.price_cents<250 THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';END IF;
  IF p.category='platform' AND (p_platform IS NULL OR NOT EXISTS(SELECT 1 FROM public.jenios_platform_payers_g47 WHERE user_id=p_user AND platform_user_id=p_platform)) THEN RAISE EXCEPTION 'VERIFIED_LINK_REQUIRED';END IF;
  v_terms:=CASE WHEN p.category='platform' THEN 'platform-monthly-manual-2026-10-24' ELSE 'university-monthly-2026-10-20' END;
  IF p_action='prepare' THEN
   SELECT * INTO o FROM jenios_letter_cb006.orders WHERE user_id=p_user AND request_key=(p_data->>'request_key')::uuid;
   IF o.id IS NOT NULL THEN
    IF o.offer IS DISTINCT FROM p_data->'offer' OR o.input->'payer' IS DISTINCT FROM p_data->'payer' OR p_data->'accept' IS DISTINCT FROM 'true'::jsonb OR o.platform_user_id IS DISTINCT FROM p_platform THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN to_jsonb(o);
   END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions sub JOIN public.jenios_pay_products prod ON prod.id=sub.product_id WHERE sub.user_id=p_user AND sub.status='active' AND sub.current_period_end>now() AND (prod.category=p.category OR (p.code='social-university-monthly' AND prod.code IN('platform-global-crypto','platform-internacional-pro')))) THEN RAISE EXCEPTION 'ACTIVE_PERIOD';END IF;
  IF EXISTS(SELECT 1 FROM jenios_letter_cb006.orders WHERE user_id=p_user AND state NOT IN('paid','closed','void')) OR EXISTS(SELECT 1 FROM public.jenios_platform_invoices_g47 WHERE user_id=p_user AND status IN('pending','review')) OR EXISTS(SELECT 1 FROM public.jenios_university_invoices_b147 WHERE user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'EXISTING_INVOICE_REQUIRED';END IF;
  v_start:=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';v_end:=((v_start AT TIME ZONE 'America/Sao_Paulo')+interval '1 month') AT TIME ZONE 'America/Sao_Paulo';
  v_offer:=jsonb_build_object('product_code',p.code,'amount_cents',p.price_cents,'currency','BRL','terms_version',v_terms,'period_start',to_char(v_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'period_end',to_char(v_end AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'auto_renew',false);
  IF p_action='quote' THEN RETURN jsonb_build_object('ok',true,'offer',v_offer);END IF;
  IF p_data->'accept' IS DISTINCT FROM 'true'::jsonb OR p_data->'offer' IS DISTINCT FROM v_offer OR jsonb_typeof(p_data->'payer') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'CONSENT_OR_OFFER_CHANGED';END IF;
  v_id:=gen_random_uuid();
  INSERT INTO public.jenios_pay_orders(id,user_id,product_id,amount_cents,currency,status,provider,idempotency_key,external_reference) VALUES(v_id,p_user,p.id,p.price_cents,'BRL','pending','letter_central','letter:'||p_user::text||':'||(p_data->>'request_key'),'letter:'||v_id::text) RETURNING * INTO n;
  INSERT INTO public.jenios_pay_subscriptions(user_id,product_id,status,latest_order_id,cancel_at_period_end) VALUES(p_user,p.id,'pending',v_id,true) RETURNING * INTO s;
  v_input:=jsonb_build_object('external_invoice_id',v_id,'customer_id',p_user,'amount_cents',p.price_cents,'currency','BRL','due_date',(now() AT TIME ZONE 'America/Sao_Paulo')::date+5,'period_start',v_offer->'period_start','period_end',v_offer->'period_end','terms_sha256',encode(sha256(convert_to(v_terms,'UTF8')),'hex'),'consent_sha256',encode(sha256(convert_to(jsonb_build_object('user',p_user,'platform',p_platform,'offer',v_offer,'accepted',true,'key',p_data->>'request_key')::text,'UTF8')),'hex'),'payer',p_data->'payer');
  INSERT INTO jenios_letter_cb006.orders(id,user_id,platform_user_id,subscription_id,product_code,request_key,offer,input,receiver_id,period_start,period_end) VALUES(v_id,p_user,p_platform,s.id,p.code,(p_data->>'request_key')::uuid,v_offer,v_input,c.receiver_id,v_start,v_end) RETURNING * INTO o;RETURN to_jsonb(o);
 END IF;
 SELECT * INTO o FROM jenios_letter_cb006.orders WHERE id=(p_data->>'order_id')::uuid AND user_id=p_user FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND';END IF;
 SELECT * INTO n FROM public.jenios_pay_orders WHERE id=o.id FOR UPDATE;
 SELECT * INTO s FROM public.jenios_pay_subscriptions WHERE id=o.subscription_id FOR UPDATE;
 IF p_action='read' THEN RETURN to_jsonb(o)||jsonb_build_object('cancelled',s.status='cancelled' OR n.status IN('cancelled','refunded'));END IF;
 IF p_action='cancel' THEN UPDATE public.jenios_pay_subscriptions SET cancel_at_period_end=true,updated_at=now() WHERE id=s.id;RETURN jsonb_build_object('ok',true);END IF;
 IF p_action='claim' THEN
  IF s.status='cancelled' OR n.status IN('cancelled','refunded') OR NOT coalesce(c.enabled AND c.expires_at>now(),false) THEN RAISE EXCEPTION 'ISSUE_DISABLED';END IF;
  IF coalesce(p_data->>'phase','') NOT IN('prepare','issue') OR coalesce(p_data->>'fingerprint','')!~'^[a-f0-9]{64}$' OR p_data->>'operation_key' NOT IN('jenios:'||o.id::text,'issue:'||coalesce(o.central_id::text,'')) THEN RAISE EXCEPTION 'JOURNAL_INVALID';END IF;
  SELECT * INTO j FROM jenios_letter_cb006.journal WHERE order_id=o.id AND operation_key=p_data->>'operation_key' AND phase=p_data->>'phase';
  IF FOUND THEN IF j.fingerprint IS DISTINCT FROM p_data->>'fingerprint' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN jsonb_build_object('created',false);END IF;
  INSERT INTO jenios_letter_cb006.journal(order_id,operation_key,phase,fingerprint) VALUES(o.id,p_data->>'operation_key',p_data->>'phase',p_data->>'fingerprint');RETURN jsonb_build_object('created',true);
 END IF;
 IF p_action='journal' THEN
  IF coalesce(p_data->>'state','') NOT IN('confirmed','unknown') THEN RAISE EXCEPTION 'JOURNAL_INVALID';END IF;
  UPDATE jenios_letter_cb006.journal SET state=p_data->>'state' WHERE order_id=o.id AND operation_key=p_data->>'operation_key' AND phase=p_data->>'phase' AND state<>'confirmed';
  IF p_data->>'invoice_id' IS NOT NULL THEN UPDATE jenios_letter_cb006.orders SET central_id=(p_data->>'invoice_id')::uuid WHERE id=o.id;END IF;RETURN jsonb_build_object('ok',true);
 END IF;
 v_receipt:=p_data->'receipt';v_purpose:=CASE WHEN o.product_code='social-university-monthly' THEN 'jenios_subscription' ELSE 'jenios_platform_subscription' END;
 IF coalesce(v_receipt->>'id','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR v_receipt->>'schema_version' IS DISTINCT FROM '1' OR v_receipt->>'product' IS DISTINCT FROM 'jenios' OR v_receipt->>'company_id' IS DISTINCT FROM 'letter-franqueadora' OR v_receipt->>'purpose' IS DISTINCT FROM v_purpose OR v_receipt->>'legal_entity_id' IS DISTINCT FROM 'br:cnpj:57255607000130' OR v_receipt->>'receiver_id' IS DISTINCT FROM o.receiver_id::text OR v_receipt->>'external_invoice_id' IS DISTINCT FROM o.id::text OR v_receipt->>'customer_id' IS DISTINCT FROM p_user::text OR coalesce(v_receipt->>'state','') NOT IN('prepared','sending','submitted','uncertain','issued','paid','closed','void') OR EXISTS(SELECT 1 FROM unnest(ARRAY['amount_cents','currency','period_start','period_end']) k WHERE v_receipt->k IS DISTINCT FROM o.input->k) THEN RAISE EXCEPTION 'RECEIPT_MISMATCH';END IF;
 IF o.state='paid' THEN IF o.receipt->>'id' IS DISTINCT FROM v_receipt->>'id' OR o.receipt->>'proof_sha256' IS DISTINCT FROM v_receipt->>'proof_sha256' THEN RAISE EXCEPTION 'RECEIPT_CONFLICT';END IF;RETURN jsonb_build_object('ok',true,'replayed',true);END IF;
 IF v_receipt->>'state'='paid' THEN
  IF v_receipt->'verified_paid' IS DISTINCT FROM 'true'::jsonb OR coalesce(v_receipt->>'proof_sha256','')!~'^[a-f0-9]{64}$' OR (v_receipt->>'confirmed_at')::timestamptz IS NULL THEN RAISE EXCEPTION 'UNVERIFIED_PAYMENT';END IF;
  v_apply:=n.status NOT IN('cancelled','refunded') AND s.status<>'cancelled' AND o.period_end>now() AND NOT EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions prior JOIN public.jenios_pay_products prod ON prod.id=prior.product_id WHERE prior.user_id=p_user AND prior.id<>s.id AND prior.status='active' AND prior.current_period_end>o.period_start AND prior.current_period_start<o.period_end AND (prod.category=(CASE WHEN o.product_code='social-university-monthly' THEN 'other' ELSE 'platform' END)));
  IF n.status NOT IN('cancelled','refunded') THEN UPDATE public.jenios_pay_orders SET status='paid',updated_at=now() WHERE id=o.id;END IF;
  IF v_apply THEN
   UPDATE public.jenios_pay_subscriptions SET status='active',current_period_start=o.period_start,current_period_end=o.period_end,updated_at=now() WHERE id=s.id;
   INSERT INTO public.jenios_pay_entitlements(user_id,product_id,order_id,status,granted_at,expires_at) VALUES(p_user,n.product_id,n.id,'active',o.period_start,o.period_end) ON CONFLICT(order_id) DO NOTHING;
  END IF;
 END IF;
 UPDATE jenios_letter_cb006.orders SET central_id=(v_receipt->>'id')::uuid,state=v_receipt->>'state',receipt=v_receipt,access_applied=v_apply,updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('ok',true,'access_applied',v_apply);
END;$$;
REVOKE ALL ON FUNCTION public.jenios_letter_billing_cb006(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_letter_billing_cb006(uuid,text,jsonb,uuid) TO service_role;
COMMIT;
