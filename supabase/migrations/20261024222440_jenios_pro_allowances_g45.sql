-- G45: Paulo-approved included allowance: USD 2 / USD 4 provider capacity,
-- represented by USD 4 / USD 8 internal consumption at the existing 2x rate.
-- Idempotent configuration and same-subscription cycle upgrade protection.
-- No subscription, payment, provider call, tariff approval or generation gate
-- is created/enabled. Existing cycle consumption/reservations are preserved.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.jenios_pro_config_b143') IS NULL
  OR to_regclass('public.jenios_pro_periods_b143') IS NULL
  OR to_regclass('public.jenios_pro_requests_b143') IS NULL
  OR to_regclass('public.jenios_pro_budgets_b143') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='jenios_pro_config_b143' AND column_name='monthly_budget_mode')
 THEN RAISE EXCEPTION 'G45_ALLOWANCE_G44_PREREQUISITES_MISSING';END IF;
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G45_ALLOWANCE_CONFIGURATION_MISSING';END IF;
END $$;

-- Existing gates, tariffs, reconciliation and operational budget are untouched.
UPDATE public.jenios_pro_config_b143
 SET crypto_allowance_nano_usd=4000000000,global_allowance_nano_usd=8000000000,updated_at=now()
 WHERE id=true AND (crypto_allowance_nano_usd IS DISTINCT FROM 4000000000
  OR global_allowance_nano_usd IS DISTINCT FROM 8000000000);

-- Raise an already-open, verified current cycle to its absolute approved total.
-- Never add another allowance, erase consumption, shorten/extend its dates,
-- lower a previously granted cycle total or fabricate a subscription/period.
UPDATE public.jenios_pro_periods_b143 per
 SET allowance_nano_usd=greatest(per.allowance_nano_usd,
  CASE p.code WHEN 'platform-global-crypto' THEN c.crypto_allowance_nano_usd ELSE c.global_allowance_nano_usd END)
 FROM public.jenios_pay_subscriptions s
 JOIN public.jenios_pay_products p ON p.id=s.product_id
 CROSS JOIN public.jenios_pro_config_b143 c
 WHERE c.id=true AND per.user_id=s.user_id AND per.subscription_id=s.id
  AND per.start_at=s.current_period_start AND per.start_at<=now() AND per.end_at>now()
  AND s.status IN ('active','trialing') AND s.current_period_start<=now() AND s.current_period_end>now()
  AND p.category='platform' AND p.code IN ('platform-global-crypto','platform-internacional-pro')
  AND per.allowance_nano_usd<CASE p.code WHEN 'platform-global-crypto' THEN c.crypto_allowance_nano_usd ELSE c.global_allowance_nano_usd END;

-- Shared read-only projection. All callers remain service_role-only and use
-- SECURITY INVOKER; no RLS bypass or browser access is introduced.
CREATE OR REPLACE FUNCTION public.jenios_pro_included_state_g45(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;per public.jenios_pro_periods_b143%ROWTYPE;
 s record;cycle_open boolean;transition_required boolean;allowance bigint;available bigint;
BEGIN
 IF p_user_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT x.id,x.current_period_start,x.current_period_end,p.code INTO s
  FROM public.jenios_pay_subscriptions x JOIN public.jenios_pay_products p ON p.id=x.product_id
  WHERE x.user_id=p_user_id AND x.status IN ('active','trialing') AND p.category='platform'
   AND x.current_period_start<=now() AND x.current_period_end>now()
   AND p.code IN ('platform-global-crypto','platform-internacional-pro')
  ORDER BY CASE p.code WHEN 'platform-internacional-pro' THEN 2 ELSE 1 END DESC,
   x.current_period_end DESC,x.current_period_start DESC,x.id ASC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO per FROM public.jenios_pro_periods_b143
  WHERE user_id=p_user_id AND subscription_id=s.id AND start_at=s.current_period_start;
 cycle_open:=FOUND;
 allowance:=greatest(coalesce(per.allowance_nano_usd,0),
  CASE s.code WHEN 'platform-global-crypto' THEN c.crypto_allowance_nano_usd ELSE c.global_allowance_nano_usd END);
 -- A cancelled/replaced subscription can still carry real usage in its live
 -- cycle. Do not infer a paid upgrade or forgive it from status/new IDs alone.
 SELECT EXISTS(SELECT 1 FROM public.jenios_pro_periods_b143 other
  WHERE other.user_id=p_user_id AND other.start_at<=now() AND other.end_at>now()
   AND (other.subscription_id IS DISTINCT FROM s.id OR other.start_at IS DISTINCT FROM s.current_period_start)
   AND (other.spent_nano_usd>0 OR other.reserved_nano_usd>0)) INTO transition_required;
 available:=CASE WHEN transition_required OR (cycle_open AND per.end_at<=now()) THEN 0
  ELSE greatest(0,allowance-coalesce(per.spent_nano_usd,0)-coalesce(per.reserved_nano_usd,0)) END;
 RETURN jsonb_build_object('planCode',s.code,'subscriptionId',s.id,'periodStart',s.current_period_start,
  'periodEnd',coalesce(per.end_at,s.current_period_end),'totalNanoUsd',allowance,
  'spentNanoUsd',coalesce(per.spent_nano_usd,0),'reservedNanoUsd',coalesce(per.reserved_nano_usd,0),
  'availableNanoUsd',available,'periodOpened',cycle_open,'transitionRequired',transition_required,
  'transitionCode',CASE WHEN transition_required THEN 'INCLUDED_PERIOD_TRANSITION_REQUIRED' ELSE NULL END);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_reserve_b143(
 p_user_id uuid,p_request_key text,p_fingerprint text,p_task text,p_model text,p_source text,
 p_max_retail_nano_usd bigint,p_max_provider_nano_usd bigint,p_pricing_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;r public.jenios_pro_requests_b143%ROWTYPE;
 b public.jenios_pro_budgets_b143%ROWTYPE;w public.jenios_pro_wallets_b143%ROWTYPE;
 per public.jenios_pro_periods_b143%ROWTYPE;included jsonb;allowance bigint;month_key text;subscription_key uuid;period_key timestamptz;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9_-]{16,100}$'
 OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' OR p_task IS NULL OR p_task !~ '^[a-z_]{3,45}$'
 OR p_model IS NULL OR p_model !~ '^[a-z0-9.-]{3,50}$' OR p_source IS NULL OR p_source NOT IN ('prepaid','included')
 OR p_max_provider_nano_usd IS NULL OR p_max_provider_nano_usd NOT BETWEEN 1 AND 50000000000
 OR p_max_retail_nano_usd IS DISTINCT FROM p_max_provider_nano_usd*2 OR p_pricing_version IS NULL
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_RESERVATION');END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_PROVISIONED');END IF;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF r.fingerprint IS DISTINCT FROM p_fingerprint OR r.model IS DISTINCT FROM p_model OR r.task IS DISTINCT FROM p_task
   OR r.source IS DISTINCT FROM p_source OR r.held_retail_nano_usd IS DISTINCT FROM p_max_retail_nano_usd
   OR r.held_provider_nano_usd IS DISTINCT FROM p_max_provider_nano_usd OR r.pricing_version IS DISTINCT FROM p_pricing_version
   THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  RETURN jsonb_build_object('ok',true,'code','EXISTING_REQUEST','requestId',r.id,'state',r.state,'replayed',true,
   'result',r.result_data,'chargedNanoUsd',r.charged_nano_usd,'providerNanoUsd',r.provider_nano_usd);
 END IF;
 IF NOT c.generation_enabled OR c.requires_reconciliation OR NOT c.pricing_approved
 OR c.rates_verified_at IS NULL OR c.rates_verified_at>now() OR c.rates_verified_at<now()-interval '30 days' OR c.pricing_version IS DISTINCT FROM p_pricing_version
 OR NOT coalesce(p_model=ANY(c.allowed_models),false)
 OR (c.monthly_budget_mode='capped' AND c.monthly_provider_limit_nano_usd<1)
 OR c.max_request_provider_nano_usd<p_max_provider_nano_usd
 THEN RETURN jsonb_build_object('ok',false,'code','GENERATION_DISABLED');END IF;
 month_key:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM');
 SELECT * INTO b FROM public.jenios_pro_budgets_b143 WHERE month=month_key FOR UPDATE;
 IF c.monthly_budget_mode='capped' AND (
  FOUND AND b.spent_nano_usd+b.reserved_nano_usd+p_max_provider_nano_usd>c.monthly_provider_limit_nano_usd
  OR NOT FOUND AND p_max_provider_nano_usd>c.monthly_provider_limit_nano_usd)
 THEN RETURN jsonb_build_object('ok',false,'code','GLOBAL_BUDGET_EXHAUSTED');END IF;
 IF p_source='prepaid' THEN
  -- An additional balance extends an eligible plan; it never creates a plan.
  -- Existing request replay above remains available after plan expiry.
  IF public.jenios_pro_included_state_g45(p_user_id) IS NULL
  THEN RETURN jsonb_build_object('ok',false,'code','ADVANCED_PLAN_REQUIRED');END IF;
  SELECT * INTO w FROM public.jenios_pro_wallets_b143 WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR w.balance_nano_usd-w.reserved_nano_usd<p_max_retail_nano_usd
  THEN RETURN jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE');END IF;
 ELSE
  -- Configuration lock above serializes every ledger mutation. A replacement
  -- subscription cannot acquire another allowance while a different live
  -- period still carries consumption or reservations, regardless of its status.
  included:=public.jenios_pro_included_state_g45(p_user_id);
  IF included IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_PLAN_REQUIRED');END IF;
  IF (included->>'transitionRequired')::boolean THEN
   RETURN jsonb_build_object('ok',false,'code','INCLUDED_PERIOD_TRANSITION_REQUIRED');
  END IF;
  subscription_key:=(included->>'subscriptionId')::uuid;
  period_key:=(included->>'periodStart')::timestamptz;
  allowance:=(included->>'totalNanoUsd')::bigint;
  SELECT * INTO per FROM public.jenios_pro_periods_b143
   WHERE user_id=p_user_id AND subscription_id=subscription_key AND start_at=period_key FOR UPDATE;
  IF FOUND THEN
   IF per.end_at<=now() OR allowance-per.spent_nano_usd-per.reserved_nano_usd<p_max_retail_nano_usd
   THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_ALLOWANCE_EXHAUSTED');END IF;
  ELSIF allowance<p_max_retail_nano_usd THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_ALLOWANCE_EXHAUSTED');
  END IF;
 END IF;
 -- All eligibility checks precede all balance mutations.
 INSERT INTO public.jenios_pro_budgets_b143(month,monthly_budget_mode,limit_nano_usd,reserved_nano_usd)
  VALUES(month_key,c.monthly_budget_mode,CASE WHEN c.monthly_budget_mode='capped' THEN c.monthly_provider_limit_nano_usd ELSE NULL END,p_max_provider_nano_usd)
  ON CONFLICT(month) DO UPDATE SET monthly_budget_mode=EXCLUDED.monthly_budget_mode,limit_nano_usd=EXCLUDED.limit_nano_usd,
   reserved_nano_usd=jenios_pro_budgets_b143.reserved_nano_usd+EXCLUDED.reserved_nano_usd;
 IF p_source='prepaid' THEN
  UPDATE public.jenios_pro_wallets_b143 SET reserved_nano_usd=reserved_nano_usd+p_max_retail_nano_usd,updated_at=now() WHERE user_id=p_user_id;
 ELSE
  INSERT INTO public.jenios_pro_periods_b143(user_id,subscription_id,start_at,end_at,allowance_nano_usd,reserved_nano_usd)
   VALUES(p_user_id,subscription_key,period_key,(included->>'periodEnd')::timestamptz,allowance,p_max_retail_nano_usd)
   ON CONFLICT(user_id,subscription_id,start_at) DO UPDATE SET
    allowance_nano_usd=greatest(jenios_pro_periods_b143.allowance_nano_usd,EXCLUDED.allowance_nano_usd),
    reserved_nano_usd=jenios_pro_periods_b143.reserved_nano_usd+EXCLUDED.reserved_nano_usd;
 END IF;
 INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,
  subscription_id,period_start,budget_month,held_retail_nano_usd,held_provider_nano_usd)
 VALUES(p_user_id,p_request_key,p_fingerprint,p_task,p_model,p_pricing_version,p_source,
  subscription_key,period_key,
  month_key,p_max_retail_nano_usd,p_max_provider_nano_usd) RETURNING * INTO r;
 INSERT INTO public.jenios_pro_events_b143(request_id,event) VALUES(r.id,'reserved');
 RETURN jsonb_build_object('ok',true,'code','RESERVED','requestId',r.id,'state','reserved','replayed',false);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_dispatch_b143(p_user_id uuid,p_request_key text,p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;r public.jenios_pro_requests_b143%ROWTYPE;included jsonb;
BEGIN
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','REQUEST_NOT_FOUND');END IF;
 IF r.fingerprint IS DISTINCT FROM p_fingerprint THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 IF r.state<>'reserved' THEN RETURN jsonb_build_object('ok',true,'acquired',false,'code','ALREADY_DISPATCHED','state',r.state,'result',r.result_data);END IF;
 IF c.id IS NULL OR NOT c.generation_enabled OR c.requires_reconciliation OR NOT c.pricing_approved
  OR c.rates_verified_at IS NULL OR c.rates_verified_at>now() OR c.rates_verified_at<now()-interval '30 days'
  OR c.pricing_version IS DISTINCT FROM r.pricing_version OR NOT coalesce(r.model=ANY(c.allowed_models),false)
  OR c.max_request_provider_nano_usd<r.held_provider_nano_usd
  OR (c.monthly_budget_mode='capped' AND (c.monthly_provider_limit_nano_usd<1 OR EXISTS(
   SELECT 1 FROM public.jenios_pro_budgets_b143 WHERE month=r.budget_month AND spent_nano_usd+reserved_nano_usd>c.monthly_provider_limit_nano_usd)))
 THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','GENERATION_DISABLED');END IF;
 IF r.reserve_expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','RESERVATION_EXPIRED');END IF;
 IF r.source='prepaid' AND public.jenios_pro_included_state_g45(p_user_id) IS NULL
 THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','ADVANCED_PLAN_REQUIRED');END IF;
 IF r.source='included' AND NOT EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions
  WHERE id=r.subscription_id AND user_id=p_user_id AND status IN ('active','trialing')
  AND current_period_start=r.period_start AND current_period_start<=now() AND current_period_end>now())
 THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','INCLUDED_PLAN_REQUIRED');END IF;
 IF r.source='included' THEN
  included:=public.jenios_pro_included_state_g45(p_user_id);
  IF included IS NULL THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','INCLUDED_PLAN_REQUIRED');END IF;
  IF (included->>'transitionRequired')::boolean
   OR (included->>'subscriptionId')::uuid IS DISTINCT FROM r.subscription_id
   OR (included->>'periodStart')::timestamptz IS DISTINCT FROM r.period_start
  THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','INCLUDED_PERIOD_TRANSITION_REQUIRED');END IF;
 END IF;
 UPDATE public.jenios_pro_requests_b143 SET state='dispatched',dispatched_at=now() WHERE id=r.id;
 INSERT INTO public.jenios_pro_events_b143(request_id,event) VALUES(r.id,'dispatched');
 RETURN jsonb_build_object('ok',true,'acquired',true,'code','DISPATCHED','requestId',r.id,'state','dispatched');
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_status_b143(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;w public.jenios_pro_wallets_b143%ROWTYPE;
 included jsonb:=NULL;history jsonb;pending bigint;
BEGIN
 IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','USER_REQUIRED');END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_PROVISIONED');END IF;
 SELECT * INTO w FROM public.jenios_pro_wallets_b143 WHERE user_id=p_user_id;
 -- Read-only projection uses the same absolute upgrade limit as reservation;
 -- a status refresh never grants credits or changes spent/reserved counters.
 included:=public.jenios_pro_included_state_g45(p_user_id);
 SELECT count(*) INTO pending FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND state IN ('reserved','dispatched','needs_reconciliation');
 SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC),'[]'::jsonb) INTO history FROM (
  SELECT id,request_key,task,model,source,state,held_retail_nano_usd,charged_nano_usd,provider_nano_usd,created_at,completed_at
  FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id ORDER BY created_at DESC,id DESC LIMIT 30) h;
 RETURN jsonb_build_object('ok',true,'config',to_jsonb(c),'wallet',jsonb_build_object(
  'balanceNanoUsd',coalesce(w.balance_nano_usd,0),'totalNanoUsd',coalesce(w.balance_nano_usd,0),'reservedNanoUsd',coalesce(w.reserved_nano_usd,0),
  'availableNanoUsd',coalesce(w.balance_nano_usd-w.reserved_nano_usd,0)),
  'included',included,'allowance',included,'pendingRequestCount',pending,'pendingRequests',pending,'history',history);
END;$$;

-- Optional paid add-on infrastructure keeps every existing approval, amount,
-- quote, provider and receipt gate. An explicitly uncapped operational policy
-- must not fail the old positive-cap check. No top-up price/gate is enabled.
CREATE OR REPLACE FUNCTION public.jenios_pro_create_quote_b143(
 p_user_id uuid,p_quote_key text,p_fx_brl_micros_per_usd bigint,p_rate_source text,p_rate_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;q public.jenios_pro_quotes_b143%ROWTYPE;retail bigint;amount bigint;
BEGIN
 IF p_user_id IS NULL OR p_quote_key IS NULL OR p_quote_key !~ '^[A-Za-z0-9_-]{16,100}$'
 OR p_fx_brl_micros_per_usd IS NULL OR p_fx_brl_micros_per_usd NOT BETWEEN 1000000 AND 100000000
 OR p_rate_source IS NULL OR p_rate_source !~ '^BCB:[a-zA-Z0-9_.-]{1,40}$'
 OR p_rate_at IS NULL OR p_rate_at>now() OR p_rate_at<now()-interval '72 hours'
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_QUOTE');END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 IF NOT FOUND OR NOT c.payments_enabled OR c.requires_reconciliation OR c.topup_currency IS NULL
 OR c.topup_amount_minor IS NULL OR c.commercial_terms_version IS NULL OR c.pricing_version IS NULL
 OR NOT c.pricing_approved OR c.rates_verified_at IS NULL OR c.rates_verified_at>now()
 OR c.rates_verified_at<now()-interval '30 days' OR (c.monthly_budget_mode='capped' AND c.monthly_provider_limit_nano_usd<1)
 THEN RETURN jsonb_build_object('ok',false,'code','PAYMENTS_NOT_APPROVED');END IF;
 SELECT * INTO q FROM public.jenios_pro_quotes_b143 WHERE user_id=p_user_id AND quote_key=p_quote_key;
 IF FOUND THEN
  IF q.fx_brl_micros_per_usd IS DISTINCT FROM p_fx_brl_micros_per_usd OR q.rate_source IS DISTINCT FROM p_rate_source OR q.rate_at IS DISTINCT FROM p_rate_at
  THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  IF q.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_EXPIRED');END IF;
  RETURN jsonb_build_object('ok',true,'quote',to_jsonb(q),'replayed',true);
 END IF;
 IF c.topup_currency='USD' THEN
  retail:=c.topup_amount_minor*10000000;
  amount:=ceil(retail::numeric*p_fx_brl_micros_per_usd/10000000000000)::bigint;
 ELSE
  amount:=c.topup_amount_minor;
  retail:=floor(amount::numeric*10000000000000/p_fx_brl_micros_per_usd)::bigint;
 END IF;
 IF retail NOT BETWEEN 1 AND 1000000000000000 OR amount NOT BETWEEN 1 AND 100000000
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_QUOTE');END IF;
 INSERT INTO public.jenios_pro_quotes_b143(user_id,quote_key,currency,amount_cents,retail_nano_usd,base_currency,
  base_amount_minor,fx_brl_micros_per_usd,rate_source,rate_at,terms_version,pricing_version,expires_at)
 VALUES(p_user_id,p_quote_key,'BRL',amount,retail,c.topup_currency,c.topup_amount_minor,p_fx_brl_micros_per_usd,
  p_rate_source,p_rate_at,c.commercial_terms_version,c.pricing_version,now()+interval '15 minutes') RETURNING * INTO q;
 RETURN jsonb_build_object('ok',true,'quote',to_jsonb(q),'replayed',false);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_prepare_topup_order_b143(p_user_id uuid,p_quote_id uuid,p_order_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;q public.jenios_pro_quotes_b143%ROWTYPE;
 o public.jenios_pay_orders%ROWTYPE;sku public.jenios_pay_products%ROWTYPE;bound uuid;idem text;binding jsonb;
BEGIN
 IF p_user_id IS NULL OR p_quote_id IS NULL OR p_order_key IS NULL OR p_order_key !~ '^[A-Za-z0-9_-]{16,100}$'
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ORDER');END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO q FROM public.jenios_pro_quotes_b143 WHERE id=p_quote_id AND user_id=p_user_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_NOT_FOUND');END IF;
 idem:='pro:'||p_user_id::text||':'||p_order_key;
 SELECT order_id INTO bound FROM public.jenios_pro_quote_orders_b143 WHERE quote_id=q.id;
 IF FOUND THEN
  SELECT * INTO o FROM public.jenios_pay_orders WHERE id=bound AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR o.idempotency_key IS DISTINCT FROM idem THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  IF o.status IN ('cancelled','expired','refunded') THEN RETURN jsonb_build_object('ok',false,'code','ORDER_CLOSED');END IF;
  RETURN jsonb_build_object('ok',true,'order',to_jsonb(o),'quote',to_jsonb(q),'replayed',true);
 END IF;
 IF c.id IS NULL OR NOT c.payments_enabled OR c.requires_reconciliation OR NOT c.pricing_approved
  OR c.rates_verified_at IS NULL OR c.rates_verified_at>now() OR c.rates_verified_at<now()-interval '30 days'
  OR (c.monthly_budget_mode='capped' AND c.monthly_provider_limit_nano_usd<1)
 THEN RETURN jsonb_build_object('ok',false,'code','PAYMENTS_NOT_APPROVED');END IF;
 IF q.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_EXPIRED');END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pay_orders WHERE idempotency_key=idem)
 THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 SELECT * INTO sku FROM public.jenios_pay_products WHERE code='social-ai-pro-credits';
 IF NOT FOUND OR NOT sku.active OR sku.category<>'other' OR sku.currency<>'BRL' OR sku.billing_type<>'one_time'
 THEN RETURN jsonb_build_object('ok',false,'code','PRODUCT_UNAVAILABLE');END IF;
 INSERT INTO public.jenios_pay_orders(user_id,product_id,amount_cents,currency,status,provider,idempotency_key,external_reference)
 VALUES(p_user_id,sku.id,q.amount_cents,'BRL','pending','inter_pix',idem,
  jsonb_build_object('productCode','social-ai-pro-credits','scope','social','proQuoteId',q.id,
   'fingerprint','pro:'||q.id::text,'checkoutKey',idem)::text) RETURNING * INTO o;
 binding:=public.jenios_pro_bind_quote_order_b143(p_user_id,q.id,o.id);
 IF binding->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Pro quote/order atomic binding invariant';END IF;
 RETURN jsonb_build_object('ok',true,'order',to_jsonb(o),'quote',to_jsonb(q),'replayed',false);
END;$$;

-- New helper defaults are revoked explicitly; replacing existing RPCs also
-- restates the established boundary. Financial settlement/release/reconcile
-- and paid-funding functions are intentionally not replaced.
REVOKE ALL ON FUNCTION public.jenios_pro_included_state_g45(uuid),
 public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text),public.jenios_pro_status_b143(uuid),
 public.jenios_pro_create_quote_b143(uuid,text,bigint,text,timestamptz),
 public.jenios_pro_prepare_topup_order_b143(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_pro_included_state_g45(uuid),
 public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text),public.jenios_pro_status_b143(uuid),
 public.jenios_pro_create_quote_b143(uuid,text,bigint,text,timestamptz),
 public.jenios_pro_prepare_topup_order_b143(uuid,uuid,text)
 TO service_role;
COMMIT;
