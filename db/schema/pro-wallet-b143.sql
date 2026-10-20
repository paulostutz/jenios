-- B143: reviewed Pro ledger, NOT an automatic production migration.
-- Caller owns transaction boundaries. All generation/payment switches start off.
-- Currency and retail package size are deliberately unset pending approval.
-- Integer nanoUSD preserves 2x pricing without rounding individual calls.
CREATE TABLE IF NOT EXISTS public.jenios_pro_config_b143 (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 generation_enabled boolean NOT NULL DEFAULT false,
 payments_enabled boolean NOT NULL DEFAULT false,
 requires_reconciliation boolean NOT NULL DEFAULT false,
 pricing_version text,
 pricing_approved boolean NOT NULL DEFAULT false,
 rates_verified_at timestamptz,
 allowed_models text[] NOT NULL DEFAULT '{}',
 monthly_provider_limit_nano_usd bigint NOT NULL DEFAULT 0 CHECK(monthly_provider_limit_nano_usd BETWEEN 0 AND 1000000000000),
 max_request_provider_nano_usd bigint NOT NULL DEFAULT 0 CHECK(max_request_provider_nano_usd BETWEEN 0 AND 50000000000),
 crypto_allowance_nano_usd bigint NOT NULL DEFAULT 0 CHECK(crypto_allowance_nano_usd BETWEEN 0 AND 1000000000000),
 global_allowance_nano_usd bigint NOT NULL DEFAULT 0 CHECK(global_allowance_nano_usd BETWEEN 0 AND 1000000000000),
 topup_currency text CHECK(topup_currency IN ('BRL','USD')),
 topup_amount_minor bigint CHECK(topup_amount_minor BETWEEN 1 AND 10000000),
 commercial_terms_version text CHECK(length(commercial_terms_version) BETWEEN 3 AND 100),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.jenios_pro_config_b143(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.jenios_pro_wallets_b143 (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 balance_nano_usd bigint NOT NULL DEFAULT 0 CHECK(balance_nano_usd BETWEEN 0 AND 1000000000000000),
 reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd>=0 AND reserved_nano_usd<=balance_nano_usd),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_periods_b143 (
 user_id uuid NOT NULL REFERENCES auth.users(id),
 subscription_id uuid NOT NULL REFERENCES public.jenios_pay_subscriptions(id),
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL CHECK(end_at>start_at),
 allowance_nano_usd bigint NOT NULL CHECK(allowance_nano_usd BETWEEN 0 AND 1000000000000),
 spent_nano_usd bigint NOT NULL DEFAULT 0 CHECK(spent_nano_usd>=0),
 reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd>=0),
 PRIMARY KEY(user_id,subscription_id,start_at),
 CHECK(spent_nano_usd+reserved_nano_usd<=allowance_nano_usd)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_budgets_b143 (
 month text PRIMARY KEY CHECK(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 limit_nano_usd bigint NOT NULL CHECK(limit_nano_usd BETWEEN 1 AND 1000000000000),
 spent_nano_usd bigint NOT NULL DEFAULT 0 CHECK(spent_nano_usd>=0),
 reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd>=0),
 CHECK(spent_nano_usd+reserved_nano_usd<=limit_nano_usd)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_requests_b143 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 task text NOT NULL CHECK(task ~ '^[a-z_]{3,45}$'),
 model text NOT NULL CHECK(model ~ '^[a-z0-9.-]{3,50}$'),
 pricing_version text NOT NULL,
 source text NOT NULL CHECK(source IN ('prepaid','included')),
 subscription_id uuid REFERENCES public.jenios_pay_subscriptions(id),
 period_start timestamptz,
 budget_month text NOT NULL REFERENCES public.jenios_pro_budgets_b143(month),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','dispatched','settled','released','needs_reconciliation')),
 held_retail_nano_usd bigint NOT NULL CHECK(held_retail_nano_usd BETWEEN 2 AND 100000000000),
 held_provider_nano_usd bigint NOT NULL CHECK(held_provider_nano_usd BETWEEN 1 AND 50000000000),
 charged_nano_usd bigint NOT NULL DEFAULT 0 CHECK(charged_nano_usd>=0),
 provider_nano_usd bigint NOT NULL DEFAULT 0 CHECK(provider_nano_usd BETWEEN 0 AND 1000000000000000),
 provider_response_id text,
 usage_data jsonb,result_data jsonb,reconciliation_evidence jsonb,
 reserve_expires_at timestamptz NOT NULL DEFAULT(now()+interval '5 minutes'),
 created_at timestamptz NOT NULL DEFAULT now(),dispatched_at timestamptz,completed_at timestamptz,
 UNIQUE(user_id,request_key),
 CHECK(held_retail_nano_usd=held_provider_nano_usd*2),
 CHECK(charged_nano_usd<=held_retail_nano_usd),
 CHECK((source='included' AND subscription_id IS NOT NULL AND period_start IS NOT NULL) OR
       (source='prepaid' AND subscription_id IS NULL AND period_start IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS jenios_pro_response_unique_b143 ON public.jenios_pro_requests_b143(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_pro_owner_history_b143 ON public.jenios_pro_requests_b143(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.jenios_pro_events_b143 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.jenios_pro_requests_b143(id),
 event text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jenios_pro_events_request_b143 ON public.jenios_pro_events_b143(request_id,created_at);
CREATE TABLE IF NOT EXISTS public.jenios_pro_quotes_b143 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 quote_key text NOT NULL CHECK(quote_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 currency text NOT NULL CHECK(currency='BRL'),amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 retail_nano_usd bigint NOT NULL CHECK(retail_nano_usd BETWEEN 1 AND 1000000000000000),
 base_currency text NOT NULL CHECK(base_currency IN ('BRL','USD')),
 base_amount_minor bigint NOT NULL CHECK(base_amount_minor BETWEEN 1 AND 10000000),
 fx_brl_micros_per_usd bigint NOT NULL CHECK(fx_brl_micros_per_usd BETWEEN 1000000 AND 100000000),
 rate_source text NOT NULL CHECK(rate_source ~ '^BCB:[a-zA-Z0-9_.-]{1,40}$'),
 rate_at timestamptz NOT NULL,terms_version text NOT NULL,pricing_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 UNIQUE(user_id,quote_key),CHECK(expires_at>created_at)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_quote_orders_b143 (
 quote_id uuid PRIMARY KEY REFERENCES public.jenios_pro_quotes_b143(id),
 order_id uuid NOT NULL UNIQUE REFERENCES public.jenios_pay_orders(id),bound_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_funding_b143 (
 order_id uuid PRIMARY KEY REFERENCES public.jenios_pay_orders(id),
 quote_id uuid NOT NULL UNIQUE REFERENCES public.jenios_pro_quotes_b143(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 retail_nano_usd bigint NOT NULL CHECK(retail_nano_usd BETWEEN 1 AND 1000000000000000),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 currency text NOT NULL CHECK(currency='BRL'),receipt_id text NOT NULL UNIQUE,
 credited_at timestamptz NOT NULL DEFAULT now()
);

-- Serializing the tiny accounting transactions on this config row gives one
-- consistent lock order, atomic global+individual budgets and stable retries.
-- No provider/network call is made while a database transaction holds a lock.
CREATE OR REPLACE FUNCTION public.jenios_pro_reserve_b143(
 p_user_id uuid,p_request_key text,p_fingerprint text,p_task text,p_model text,p_source text,
 p_max_retail_nano_usd bigint,p_max_provider_nano_usd bigint,p_pricing_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;r public.jenios_pro_requests_b143%ROWTYPE;
 b public.jenios_pro_budgets_b143%ROWTYPE;w public.jenios_pro_wallets_b143%ROWTYPE;
 per public.jenios_pro_periods_b143%ROWTYPE;s record;allowance bigint;month_key text;subscription_key uuid;period_key timestamptz;
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
 OR NOT coalesce(p_model=ANY(c.allowed_models),false) OR c.monthly_provider_limit_nano_usd<1
 OR c.max_request_provider_nano_usd<p_max_provider_nano_usd
 THEN RETURN jsonb_build_object('ok',false,'code','GENERATION_DISABLED');END IF;
 month_key:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM');
 SELECT * INTO b FROM public.jenios_pro_budgets_b143 WHERE month=month_key FOR UPDATE;
 IF FOUND AND b.spent_nano_usd+b.reserved_nano_usd+p_max_provider_nano_usd>c.monthly_provider_limit_nano_usd
 OR NOT FOUND AND p_max_provider_nano_usd>c.monthly_provider_limit_nano_usd
 THEN RETURN jsonb_build_object('ok',false,'code','GLOBAL_BUDGET_EXHAUSTED');END IF;
 IF p_source='prepaid' THEN
  SELECT * INTO w FROM public.jenios_pro_wallets_b143 WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR w.balance_nano_usd-w.reserved_nano_usd<p_max_retail_nano_usd
  THEN RETURN jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE');END IF;
 ELSE
  SELECT x.id,x.current_period_start,x.current_period_end,p.code INTO s
   FROM public.jenios_pay_subscriptions x JOIN public.jenios_pay_products p ON p.id=x.product_id
   WHERE x.user_id=p_user_id AND x.status IN ('active','trialing') AND p.category='platform'
   AND x.current_period_start<=now() AND x.current_period_end>now()
   AND p.code IN ('platform-global-crypto','platform-internacional-pro')
   ORDER BY CASE p.code WHEN 'platform-internacional-pro' THEN 2 ELSE 1 END DESC,
    x.current_period_end DESC,x.current_period_start DESC,x.id ASC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_PLAN_REQUIRED');END IF;
  subscription_key:=s.id;period_key:=s.current_period_start;
  allowance:=CASE s.code WHEN 'platform-global-crypto' THEN c.crypto_allowance_nano_usd ELSE c.global_allowance_nano_usd END;
  SELECT * INTO per FROM public.jenios_pro_periods_b143 WHERE user_id=p_user_id AND subscription_id=s.id AND start_at=s.current_period_start FOR UPDATE;
  IF FOUND THEN
   IF per.end_at<=now() OR per.allowance_nano_usd-per.spent_nano_usd-per.reserved_nano_usd<p_max_retail_nano_usd
   THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_ALLOWANCE_EXHAUSTED');END IF;
  ELSIF allowance<p_max_retail_nano_usd THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_ALLOWANCE_EXHAUSTED');
  END IF;
 END IF;
 -- All eligibility checks precede all balance mutations.
 INSERT INTO public.jenios_pro_budgets_b143(month,limit_nano_usd,reserved_nano_usd)
  VALUES(month_key,c.monthly_provider_limit_nano_usd,p_max_provider_nano_usd)
  ON CONFLICT(month) DO UPDATE SET limit_nano_usd=EXCLUDED.limit_nano_usd,
   reserved_nano_usd=jenios_pro_budgets_b143.reserved_nano_usd+EXCLUDED.reserved_nano_usd;
 IF p_source='prepaid' THEN
  UPDATE public.jenios_pro_wallets_b143 SET reserved_nano_usd=reserved_nano_usd+p_max_retail_nano_usd,updated_at=now() WHERE user_id=p_user_id;
 ELSE
  INSERT INTO public.jenios_pro_periods_b143(user_id,subscription_id,start_at,end_at,allowance_nano_usd,reserved_nano_usd)
   VALUES(p_user_id,s.id,s.current_period_start,s.current_period_end,allowance,p_max_retail_nano_usd)
   ON CONFLICT(user_id,subscription_id,start_at) DO UPDATE SET reserved_nano_usd=jenios_pro_periods_b143.reserved_nano_usd+EXCLUDED.reserved_nano_usd;
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
DECLARE c public.jenios_pro_config_b143%ROWTYPE;r public.jenios_pro_requests_b143%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','REQUEST_NOT_FOUND');END IF;
 IF r.fingerprint IS DISTINCT FROM p_fingerprint THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 IF r.state<>'reserved' THEN RETURN jsonb_build_object('ok',true,'acquired',false,'code','ALREADY_DISPATCHED','state',r.state,'result',r.result_data);END IF;
 IF c.id IS NULL OR NOT c.generation_enabled OR c.requires_reconciliation OR NOT c.pricing_approved
  OR c.rates_verified_at IS NULL OR c.rates_verified_at>now() OR c.rates_verified_at<now()-interval '30 days'
  OR c.pricing_version IS DISTINCT FROM r.pricing_version OR NOT coalesce(r.model=ANY(c.allowed_models),false)
  OR c.max_request_provider_nano_usd<r.held_provider_nano_usd OR EXISTS(
   SELECT 1 FROM public.jenios_pro_budgets_b143 WHERE month=r.budget_month AND spent_nano_usd+reserved_nano_usd>c.monthly_provider_limit_nano_usd)
 THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','GENERATION_DISABLED');END IF;
 IF r.reserve_expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','RESERVATION_EXPIRED');END IF;
 IF r.source='included' AND NOT EXISTS(SELECT 1 FROM public.jenios_pay_subscriptions
  WHERE id=r.subscription_id AND user_id=p_user_id AND status IN ('active','trialing')
  AND current_period_start=r.period_start AND current_period_start<=now() AND current_period_end>now())
 THEN RETURN jsonb_build_object('ok',false,'acquired',false,'code','INCLUDED_PLAN_REQUIRED');END IF;
 UPDATE public.jenios_pro_requests_b143 SET state='dispatched',dispatched_at=now() WHERE id=r.id;
 INSERT INTO public.jenios_pro_events_b143(request_id,event) VALUES(r.id,'dispatched');
 RETURN jsonb_build_object('ok',true,'acquired',true,'code','DISPATCHED','requestId',r.id,'state','dispatched');
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_settle_b143(
 p_user_id uuid,p_request_key text,p_fingerprint text,p_provider_nano_usd bigint,
 p_usage jsonb,p_result jsonb,p_provider_response_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.jenios_pro_requests_b143%ROWTYPE;charge bigint;
BEGIN
 IF p_provider_nano_usd IS NULL OR p_provider_nano_usd NOT BETWEEN 0 AND 1000000000000000
 OR p_usage IS NULL OR jsonb_typeof(p_usage)<>'object' OR octet_length(p_usage::text)>32768
 OR p_result IS NULL OR jsonb_typeof(p_result)<>'object' OR octet_length(p_result::text)>65536
 OR p_provider_response_id IS NULL OR length(p_provider_response_id) NOT BETWEEN 6 AND 200
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_SETTLEMENT');END IF;
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND');END IF;
 IF r.fingerprint IS DISTINCT FROM p_fingerprint THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 IF r.state='settled' THEN
  IF r.provider_nano_usd IS DISTINCT FROM p_provider_nano_usd OR r.provider_response_id IS DISTINCT FROM p_provider_response_id
  THEN RETURN jsonb_build_object('ok',false,'code','SETTLEMENT_CONFLICT');END IF;
  RETURN jsonb_build_object('ok',true,'state','settled','replayed',true,'result',r.result_data,'chargedNanoUsd',r.charged_nano_usd,'providerNanoUsd',r.provider_nano_usd);
 END IF;
 IF r.state<>'dispatched' THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_DISPATCHED','state',r.state);END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pro_requests_b143 WHERE provider_response_id=p_provider_response_id AND id<>r.id)
 THEN RETURN jsonb_build_object('ok',false,'code','PROVIDER_RESPONSE_REUSED');END IF;
 charge:=p_provider_nano_usd*2;
 IF charge>r.held_retail_nano_usd OR p_provider_nano_usd>r.held_provider_nano_usd THEN
  UPDATE public.jenios_pro_requests_b143 SET state='needs_reconciliation',provider_nano_usd=p_provider_nano_usd,
   provider_response_id=p_provider_response_id,usage_data=p_usage,result_data=p_result WHERE id=r.id;
  UPDATE public.jenios_pro_config_b143 SET generation_enabled=false,payments_enabled=false,requires_reconciliation=true,updated_at=now() WHERE id=true;
  INSERT INTO public.jenios_pro_events_b143(request_id,event,details) VALUES(r.id,'provider_overrun',jsonb_build_object('providerNanoUsd',p_provider_nano_usd,'maximumProviderNanoUsd',r.held_provider_nano_usd));
  RETURN jsonb_build_object('ok',false,'code','COST_EXCEEDS_RESERVATION','state','needs_reconciliation');
 END IF;
 IF r.source='prepaid' THEN
  UPDATE public.jenios_pro_wallets_b143 SET balance_nano_usd=balance_nano_usd-charge,
   reserved_nano_usd=reserved_nano_usd-r.held_retail_nano_usd,updated_at=now()
   WHERE user_id=p_user_id AND reserved_nano_usd>=r.held_retail_nano_usd;
 ELSE
  UPDATE public.jenios_pro_periods_b143 SET spent_nano_usd=spent_nano_usd+charge,reserved_nano_usd=reserved_nano_usd-r.held_retail_nano_usd
   WHERE user_id=p_user_id AND subscription_id=r.subscription_id AND start_at=r.period_start AND reserved_nano_usd>=r.held_retail_nano_usd;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pro ledger individual reservation invariant';END IF;
 UPDATE public.jenios_pro_budgets_b143 SET spent_nano_usd=spent_nano_usd+p_provider_nano_usd,reserved_nano_usd=reserved_nano_usd-r.held_provider_nano_usd
  WHERE month=r.budget_month AND reserved_nano_usd>=r.held_provider_nano_usd;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pro ledger global reservation invariant';END IF;
 UPDATE public.jenios_pro_requests_b143 SET state='settled',provider_nano_usd=p_provider_nano_usd,charged_nano_usd=charge,
  usage_data=p_usage,result_data=p_result,provider_response_id=p_provider_response_id,completed_at=now() WHERE id=r.id;
 INSERT INTO public.jenios_pro_events_b143(request_id,event,details) VALUES(r.id,'settled',jsonb_build_object('providerNanoUsd',p_provider_nano_usd,'chargedNanoUsd',charge));
 RETURN jsonb_build_object('ok',true,'state','settled','replayed',false,'chargedNanoUsd',charge,'providerNanoUsd',p_provider_nano_usd,'result',p_result);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_release_b143(p_user_id uuid,p_request_key text,p_fingerprint text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.jenios_pro_requests_b143%ROWTYPE;
BEGIN
 IF p_reason IS NULL OR length(p_reason) NOT BETWEEN 3 AND 500 THEN RETURN jsonb_build_object('ok',false,'code','REASON_REQUIRED');END IF;
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND');END IF;
 IF r.fingerprint IS DISTINCT FROM p_fingerprint THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 IF r.state='released' THEN RETURN jsonb_build_object('ok',true,'state','released','replayed',true);END IF;
 IF r.state<>'reserved' THEN RETURN jsonb_build_object('ok',false,'code','DISPATCHED_USAGE_MUST_BE_RECONCILED','state',r.state);END IF;
 IF r.source='prepaid' THEN
  UPDATE public.jenios_pro_wallets_b143 SET reserved_nano_usd=reserved_nano_usd-r.held_retail_nano_usd,updated_at=now()
   WHERE user_id=p_user_id AND reserved_nano_usd>=r.held_retail_nano_usd;
 ELSE
  UPDATE public.jenios_pro_periods_b143 SET reserved_nano_usd=reserved_nano_usd-r.held_retail_nano_usd
   WHERE user_id=p_user_id AND subscription_id=r.subscription_id AND start_at=r.period_start AND reserved_nano_usd>=r.held_retail_nano_usd;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pro ledger individual reservation invariant';END IF;
 UPDATE public.jenios_pro_budgets_b143 SET reserved_nano_usd=reserved_nano_usd-r.held_provider_nano_usd
  WHERE month=r.budget_month AND reserved_nano_usd>=r.held_provider_nano_usd;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pro ledger global reservation invariant';END IF;
 UPDATE public.jenios_pro_requests_b143 SET state='released',completed_at=now() WHERE id=r.id;
 INSERT INTO public.jenios_pro_events_b143(request_id,event,details) VALUES(r.id,'released',jsonb_build_object('reason',p_reason));
 RETURN jsonb_build_object('ok',true,'state','released','replayed',false);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_reconcile_b143(
 p_user_id uuid,p_request_key text,p_fingerprint text,p_action text,p_provider_nano_usd bigint,
 p_usage jsonb,p_result jsonb,p_provider_response_id text,p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.jenios_pro_requests_b143%ROWTYPE;answer jsonb;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('mark_unknown','confirmed_no_charge','confirmed_cost')
 OR p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object' OR octet_length(p_evidence::text)>16384
 OR jsonb_typeof(p_evidence->'reason') IS DISTINCT FROM 'string'
 OR coalesce(length(p_evidence->>'reason'),0) NOT BETWEEN 3 AND 500
 THEN RETURN jsonb_build_object('ok',false,'code','RECONCILIATION_EVIDENCE_REQUIRED');END IF;
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND');END IF;
 IF r.fingerprint IS DISTINCT FROM p_fingerprint THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');END IF;
 IF p_action='mark_unknown' THEN
  IF r.state NOT IN ('dispatched','needs_reconciliation') THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_DISPATCHED','state',r.state);END IF;
  IF r.state='dispatched' THEN
   UPDATE public.jenios_pro_requests_b143 SET state='needs_reconciliation',reconciliation_evidence=p_evidence WHERE id=r.id;
   INSERT INTO public.jenios_pro_events_b143(request_id,event,details) VALUES(r.id,'usage_unknown',p_evidence);
  END IF;
  UPDATE public.jenios_pro_config_b143 SET generation_enabled=false,payments_enabled=false,requires_reconciliation=true,updated_at=now() WHERE id=true;
  RETURN jsonb_build_object('ok',true,'state','needs_reconciliation','replayed',r.state='needs_reconciliation');
 END IF;
 -- No public endpoint may synthesize this evidence. Reconciliation is an
 -- explicit backend/admin action, with the confirmed provider reference.
 IF p_evidence->'verified' IS DISTINCT FROM 'true'::jsonb
 OR jsonb_typeof(p_evidence->'reference') IS DISTINCT FROM 'string' OR jsonb_typeof(p_evidence->'actor') IS DISTINCT FROM 'string'
 OR coalesce(length(p_evidence->>'reference'),0) NOT BETWEEN 3 AND 200
 OR coalesce(length(p_evidence->>'actor'),0) NOT BETWEEN 3 AND 100
 THEN RETURN jsonb_build_object('ok',false,'code','VERIFIED_EVIDENCE_REQUIRED');END IF;
 IF r.state NOT IN ('dispatched','needs_reconciliation') THEN
  IF (p_action='confirmed_no_charge' AND r.state='released') OR (p_action='confirmed_cost' AND r.state='settled' AND r.provider_nano_usd=p_provider_nano_usd AND r.provider_response_id=p_provider_response_id)
  THEN RETURN jsonb_build_object('ok',true,'state',r.state,'replayed',true,'result',r.result_data,'chargedNanoUsd',r.charged_nano_usd);END IF;
  RETURN jsonb_build_object('ok',false,'code','RECONCILIATION_CONFLICT');
 END IF;
 IF p_action='confirmed_no_charge' THEN
  IF p_provider_nano_usd IS DISTINCT FROM 0 OR r.provider_nano_usd>0
  THEN RETURN jsonb_build_object('ok',false,'code','KNOWN_COST_CANNOT_BE_ERASED');END IF;
  UPDATE public.jenios_pro_requests_b143 SET state='reserved',reconciliation_evidence=p_evidence WHERE id=r.id;
  answer:=public.jenios_pro_release_b143(p_user_id,p_request_key,p_fingerprint,p_evidence->>'reason');
 ELSE
  IF p_provider_nano_usd IS NULL OR p_provider_nano_usd<0 OR p_provider_nano_usd>r.held_provider_nano_usd
  THEN RETURN jsonb_build_object('ok',false,'code','COST_EXCEEDS_RESERVATION','state',r.state);END IF;
  IF r.provider_nano_usd>0 AND r.provider_nano_usd IS DISTINCT FROM p_provider_nano_usd
  THEN RETURN jsonb_build_object('ok',false,'code','KNOWN_COST_CONFLICT');END IF;
  UPDATE public.jenios_pro_requests_b143 SET state='dispatched',reconciliation_evidence=p_evidence WHERE id=r.id;
  answer:=public.jenios_pro_settle_b143(p_user_id,p_request_key,p_fingerprint,p_provider_nano_usd,p_usage,p_result,p_provider_response_id);
 END IF;
 IF answer->>'ok' IS DISTINCT FROM 'true' THEN
  UPDATE public.jenios_pro_requests_b143 SET state=r.state WHERE id=r.id;
  RETURN answer;
 END IF;
 INSERT INTO public.jenios_pro_events_b143(request_id,event,details) VALUES(r.id,p_action,p_evidence);
 -- Resolving the last hold clears the alarm; generation stays disabled until
 -- the approved operator explicitly re-enables it after reviewing the cause.
 UPDATE public.jenios_pro_config_b143 SET requires_reconciliation=EXISTS(
  SELECT 1 FROM public.jenios_pro_requests_b143 WHERE state='needs_reconciliation'),updated_at=now() WHERE id=true;
 RETURN answer;
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_status_b143(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;w public.jenios_pro_wallets_b143%ROWTYPE;
 per public.jenios_pro_periods_b143%ROWTYPE;s record;allowance bigint:=0;included jsonb:=NULL;history jsonb;pending bigint;
BEGIN
 IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','USER_REQUIRED');END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_PROVISIONED');END IF;
 SELECT * INTO w FROM public.jenios_pro_wallets_b143 WHERE user_id=p_user_id;
 SELECT x.id,x.current_period_start,x.current_period_end,p.code INTO s
  FROM public.jenios_pay_subscriptions x JOIN public.jenios_pay_products p ON p.id=x.product_id
  WHERE x.user_id=p_user_id AND x.status IN ('active','trialing') AND p.category='platform'
  AND x.current_period_start<=now() AND x.current_period_end>now()
  AND p.code IN ('platform-global-crypto','platform-internacional-pro')
  ORDER BY CASE p.code WHEN 'platform-internacional-pro' THEN 2 ELSE 1 END DESC,
   x.current_period_end DESC,x.current_period_start DESC,x.id ASC LIMIT 1;
 IF FOUND THEN
  SELECT * INTO per FROM public.jenios_pro_periods_b143 WHERE user_id=p_user_id AND subscription_id=s.id AND start_at=s.current_period_start;
  allowance:=coalesce(per.allowance_nano_usd,CASE s.code WHEN 'platform-global-crypto' THEN c.crypto_allowance_nano_usd ELSE c.global_allowance_nano_usd END);
  included:=jsonb_build_object('planCode',s.code,'subscriptionId',s.id,'periodStart',s.current_period_start,'periodEnd',coalesce(per.end_at,s.current_period_end),
   'totalNanoUsd',allowance,'spentNanoUsd',coalesce(per.spent_nano_usd,0),'reservedNanoUsd',coalesce(per.reserved_nano_usd,0),
   'availableNanoUsd',CASE WHEN per.end_at<=now() THEN 0 ELSE greatest(0,allowance-coalesce(per.spent_nano_usd,0)-coalesce(per.reserved_nano_usd,0)) END,'periodOpened',per.user_id IS NOT NULL);
 END IF;
 SELECT count(*) INTO pending FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id AND state IN ('reserved','dispatched','needs_reconciliation');
 SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC),'[]'::jsonb) INTO history FROM (
  SELECT id,request_key,task,model,source,state,held_retail_nano_usd,charged_nano_usd,provider_nano_usd,created_at,completed_at
  FROM public.jenios_pro_requests_b143 WHERE user_id=p_user_id ORDER BY created_at DESC,id DESC LIMIT 30) h;
 RETURN jsonb_build_object('ok',true,'config',to_jsonb(c),'wallet',jsonb_build_object(
  'balanceNanoUsd',coalesce(w.balance_nano_usd,0),'totalNanoUsd',coalesce(w.balance_nano_usd,0),'reservedNanoUsd',coalesce(w.reserved_nano_usd,0),
  'availableNanoUsd',coalesce(w.balance_nano_usd-w.reserved_nano_usd,0)),
  'included',included,'allowance',included,'pendingRequestCount',pending,'pendingRequests',pending,'history',history);
END;$$;

-- Quotes are immutable server snapshots. Legacy B135 proposed packages are
-- never used here. The approved package's base currency may be BRL or USD.
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
 OR c.rates_verified_at<now()-interval '30 days' OR c.monthly_provider_limit_nano_usd<1
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

CREATE OR REPLACE FUNCTION public.jenios_pro_bind_quote_order_b143(p_user_id uuid,p_quote_id uuid,p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;q public.jenios_pro_quotes_b143%ROWTYPE;
 o public.jenios_pay_orders%ROWTYPE;meta jsonb;bound uuid;product_code text;
BEGIN
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO q FROM public.jenios_pro_quotes_b143 WHERE id=p_quote_id AND user_id=p_user_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_NOT_FOUND');END IF;
 SELECT order_id INTO bound FROM public.jenios_pro_quote_orders_b143 WHERE quote_id=q.id;
 IF FOUND THEN RETURN jsonb_build_object('ok',bound=p_order_id,'code',CASE WHEN bound=p_order_id THEN 'BOUND' ELSE 'QUOTE_ALREADY_BOUND' END,'replayed',true);END IF;
 IF c.id IS NULL OR NOT c.payments_enabled OR c.requires_reconciliation THEN RETURN jsonb_build_object('ok',false,'code','PAYMENTS_NOT_APPROVED');END IF;
 IF q.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_EXPIRED');END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'pending' OR o.currency IS DISTINCT FROM q.currency OR o.amount_cents IS DISTINCT FROM q.amount_cents
 OR o.created_at<q.created_at-interval '5 seconds' OR o.created_at>q.expires_at
 THEN RETURN jsonb_build_object('ok',false,'code','ORDER_QUOTE_MISMATCH');END IF;
 SELECT code INTO product_code FROM public.jenios_pay_products WHERE id=o.product_id;
 IF product_code IS DISTINCT FROM 'social-ai-pro-credits' THEN RETURN jsonb_build_object('ok',false,'code','PRODUCT_MISMATCH');END IF;
 BEGIN meta:=o.external_reference::jsonb;EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ORDER_METADATA');END;
 IF jsonb_typeof(meta) IS DISTINCT FROM 'object' OR meta->>'productCode' IS DISTINCT FROM 'social-ai-pro-credits'
 OR meta->>'scope' IS DISTINCT FROM 'social' OR meta->>'proQuoteId' IS DISTINCT FROM q.id::text
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ORDER_METADATA');END IF;
 INSERT INTO public.jenios_pro_quote_orders_b143(quote_id,order_id) VALUES(q.id,o.id);
 RETURN jsonb_build_object('ok',true,'code','BOUND','replayed',false);
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
  OR c.monthly_provider_limit_nano_usd<1
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

CREATE OR REPLACE FUNCTION public.jenios_pro_confirm_paid_topup_b143(p_user_id uuid,p_quote_id uuid,p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q public.jenios_pro_quotes_b143%ROWTYPE;o public.jenios_pay_orders%ROWTYPE;
 f public.jenios_pro_funding_b143%ROWTYPE;receipt text;meta jsonb;product_code text;balance bigint;
BEGIN
 IF p_user_id IS NULL OR p_quote_id IS NULL OR p_order_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVALID_TOPUP');END IF;
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 SELECT * INTO f FROM public.jenios_pro_funding_b143 WHERE order_id=p_order_id;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',f.user_id=p_user_id AND f.quote_id=p_quote_id,'code','ALREADY_CREDITED','replayed',true);
 END IF;
 SELECT * INTO q FROM public.jenios_pro_quotes_b143 WHERE id=p_quote_id AND user_id=p_user_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.jenios_pro_quote_orders_b143 WHERE quote_id=q.id AND order_id=p_order_id)
 THEN RETURN jsonb_build_object('ok',false,'code','BOUND_QUOTE_REQUIRED');END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o.status IS DISTINCT FROM 'paid' OR o.currency IS DISTINCT FROM q.currency OR o.amount_cents IS DISTINCT FROM q.amount_cents
 THEN RETURN jsonb_build_object('ok',false,'code','CONFIRMED_PAYMENT_REQUIRED');END IF;
 SELECT code INTO product_code FROM public.jenios_pay_products WHERE id=o.product_id;
 BEGIN meta:=o.external_reference::jsonb;EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ORDER_METADATA');END;
 IF product_code IS DISTINCT FROM 'social-ai-pro-credits' OR jsonb_typeof(meta) IS DISTINCT FROM 'object'
 OR meta->>'productCode' IS DISTINCT FROM 'social-ai-pro-credits' OR meta->>'scope' IS DISTINCT FROM 'social'
 OR meta->>'proQuoteId' IS DISTINCT FROM q.id::text THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ORDER_METADATA');END IF;
 SELECT p.provider||':'||p.provider_payment_id INTO receipt FROM public.jenios_pay_payments p
 WHERE p.order_id=o.id AND p.status='confirmed' AND p.amount_cents=q.amount_cents
 AND p.provider_payment_id IS NOT NULL AND length(p.provider_payment_id)>0 AND p.confirmed_at>=o.created_at-interval '5 minutes'
 AND p.confirmed_at<=now()+interval '5 minutes' AND p.provider=o.provider
 ORDER BY p.confirmed_at DESC,p.id ASC LIMIT 1;
 IF receipt IS NULL THEN RETURN jsonb_build_object('ok',false,'code','CONFIRMED_RECEIPT_REQUIRED');END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pro_funding_b143 WHERE quote_id=q.id OR receipt_id=receipt)
 THEN RETURN jsonb_build_object('ok',false,'code','RECEIPT_ALREADY_CREDITED');END IF;
 SELECT balance_nano_usd INTO balance FROM public.jenios_pro_wallets_b143 WHERE user_id=p_user_id FOR UPDATE;
 IF coalesce(balance,0)+q.retail_nano_usd>1000000000000000 THEN RETURN jsonb_build_object('ok',false,'code','WALLET_LIMIT');END IF;
 INSERT INTO public.jenios_pro_funding_b143(order_id,quote_id,user_id,retail_nano_usd,amount_cents,currency,receipt_id)
 VALUES(o.id,q.id,p_user_id,q.retail_nano_usd,q.amount_cents,q.currency,receipt);
 INSERT INTO public.jenios_pro_wallets_b143(user_id,balance_nano_usd) VALUES(p_user_id,q.retail_nano_usd)
 ON CONFLICT(user_id) DO UPDATE SET balance_nano_usd=jenios_pro_wallets_b143.balance_nano_usd+EXCLUDED.balance_nano_usd,updated_at=now();
 RETURN jsonb_build_object('ok',true,'code','CREDITED','replayed',false,'retailNanoUsd',q.retail_nano_usd);
END;$$;

CREATE OR REPLACE FUNCTION public.jenios_pro_no_ledger_mutation_b143()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Immutable Pro financial record';END;$$;
DROP TRIGGER IF EXISTS pro_quote_immutable_b143 ON public.jenios_pro_quotes_b143;
CREATE TRIGGER pro_quote_immutable_b143 BEFORE UPDATE OR DELETE ON public.jenios_pro_quotes_b143
 FOR EACH ROW EXECUTE FUNCTION public.jenios_pro_no_ledger_mutation_b143();
DROP TRIGGER IF EXISTS pro_funding_immutable_b143 ON public.jenios_pro_funding_b143;
CREATE TRIGGER pro_funding_immutable_b143 BEFORE UPDATE OR DELETE ON public.jenios_pro_funding_b143
 FOR EACH ROW EXECUTE FUNCTION public.jenios_pro_no_ledger_mutation_b143();
CREATE OR REPLACE FUNCTION public.jenios_pro_check_reenable_b143()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (NEW.generation_enabled OR NEW.payments_enabled) AND (NEW.requires_reconciliation OR EXISTS(
  SELECT 1 FROM public.jenios_pro_requests_b143 WHERE state='needs_reconciliation'))
 THEN RAISE EXCEPTION 'Resolve Pro reconciliation before enabling';END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS pro_config_reenable_b143 ON public.jenios_pro_config_b143;
CREATE TRIGGER pro_config_reenable_b143 BEFORE UPDATE ON public.jenios_pro_config_b143
 FOR EACH ROW EXECUTE FUNCTION public.jenios_pro_check_reenable_b143();

-- Explicit grants in addition to RLS; there are no public ownership policies.
ALTER TABLE public.jenios_pro_config_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_wallets_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_periods_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_budgets_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_requests_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_events_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_quotes_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_quote_orders_b143 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_funding_b143 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_pro_config_b143,public.jenios_pro_wallets_b143,public.jenios_pro_periods_b143,
 public.jenios_pro_budgets_b143,public.jenios_pro_requests_b143,public.jenios_pro_events_b143,public.jenios_pro_quotes_b143,
 public.jenios_pro_quote_orders_b143,public.jenios_pro_funding_b143 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_pro_config_b143,public.jenios_pro_wallets_b143,
 public.jenios_pro_periods_b143,public.jenios_pro_budgets_b143,public.jenios_pro_requests_b143 TO service_role;
GRANT SELECT,INSERT ON public.jenios_pro_events_b143,public.jenios_pro_quotes_b143,
 public.jenios_pro_quote_orders_b143,public.jenios_pro_funding_b143 TO service_role;
REVOKE ALL ON FUNCTION public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text),public.jenios_pro_settle_b143(uuid,text,text,bigint,jsonb,jsonb,text),
 public.jenios_pro_release_b143(uuid,text,text,text),public.jenios_pro_reconcile_b143(uuid,text,text,text,bigint,jsonb,jsonb,text,jsonb),
 public.jenios_pro_status_b143(uuid),public.jenios_pro_create_quote_b143(uuid,text,bigint,text,timestamptz),
 public.jenios_pro_prepare_topup_order_b143(uuid,uuid,text),
 public.jenios_pro_bind_quote_order_b143(uuid,uuid,uuid),public.jenios_pro_confirm_paid_topup_b143(uuid,uuid,uuid),
 public.jenios_pro_no_ledger_mutation_b143(),public.jenios_pro_check_reenable_b143() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text),public.jenios_pro_settle_b143(uuid,text,text,bigint,jsonb,jsonb,text),
 public.jenios_pro_release_b143(uuid,text,text,text),public.jenios_pro_reconcile_b143(uuid,text,text,text,bigint,jsonb,jsonb,text,jsonb),
 public.jenios_pro_status_b143(uuid),public.jenios_pro_create_quote_b143(uuid,text,bigint,text,timestamptz),
 public.jenios_pro_prepare_topup_order_b143(uuid,uuid,text),
 public.jenios_pro_bind_quote_order_b143(uuid,uuid,uuid),public.jenios_pro_confirm_paid_topup_b143(uuid,uuid,uuid) TO service_role;
