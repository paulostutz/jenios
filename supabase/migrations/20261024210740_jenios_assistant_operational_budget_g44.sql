-- G44: explicitly configured operation without a fixed monthly provider cap.
-- Default remains capped. This migration grants no subscription/allowance, sets
-- no generation/payment gate, changes no tariff and resets no financial record.
-- Requires the reviewed B143 ledger and the isolated G43 sales-budget migration.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.jenios_pro_config_b143') IS NULL
  OR to_regclass('public.jenios_pro_budgets_b143') IS NULL
  OR to_regclass('public.jenios_sales_budget_b282') IS NULL
  OR to_regclass('public.jenios_sales_visitor_b282') IS NULL
 THEN RAISE EXCEPTION 'G44_BUDGET_PREREQUISITES_MISSING'; END IF;
END $$;

CREATE TABLE public.jenios_sales_policy_g44(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 monthly_budget_mode text NOT NULL DEFAULT 'capped' CHECK(monthly_budget_mode IN ('capped','uncapped')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.jenios_sales_policy_g44(id) VALUES(true);
ALTER TABLE public.jenios_sales_policy_g44 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_sales_policy_g44 FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.jenios_sales_policy_g44 TO service_role;

-- Both the application mode and this durable server policy must explicitly
-- select uncapped. A NULL limit expresses absence of a monthly cap; it is not
-- a substitute balance. The fixed 20,000 microUSD reservation and 12/hour
-- protection remain atomic with the SAME counters/lock as legacy B282 calls.
CREATE FUNCTION public.jenios_sales_budget_hold_g44(
 p_month text,p_visitor_hash text,p_hour text,p_amount_micro_usd bigint,
 p_limit_micro_usd bigint,p_budget_mode text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;used bigint;configured_mode text;
BEGIN
 IF p_month IS NULL OR p_hour IS NULL OR p_visitor_hash IS NULL OR p_amount_micro_usd IS NULL
  OR p_budget_mode IS NULL OR p_budget_mode NOT IN ('capped','uncapped')
  OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  OR p_hour !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3])$'
  OR p_month<>to_char(now() at time zone 'UTC','YYYY-MM')
  OR p_hour<>to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24')
  OR left(p_hour,7)<>p_month OR p_visitor_hash !~ '^[a-f0-9]{64}$'
  OR p_amount_micro_usd<>20000
 THEN RETURN false;END IF;
 SELECT monthly_budget_mode INTO configured_mode FROM public.jenios_sales_policy_g44 WHERE id=true FOR SHARE;
 IF NOT FOUND OR configured_mode IS DISTINCT FROM p_budget_mode THEN RETURN false;END IF;
 IF p_budget_mode='capped' THEN
  IF p_limit_micro_usd IS NULL OR p_limit_micro_usd<1000000 OR p_limit_micro_usd>1000000000 THEN RETURN false;END IF;
 ELSIF p_limit_micro_usd IS NOT NULL THEN RETURN false;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('jenios-sales-budget:'||p_month,0));
 SELECT coalesce(reserved_micro_usd,0) INTO used FROM public.jenios_sales_budget_b282 WHERE month=p_month;
 IF p_budget_mode='capped' AND coalesce(used,0)+p_amount_micro_usd>p_limit_micro_usd THEN RETURN false;END IF;
 SELECT coalesce(calls,0) INTO n FROM public.jenios_sales_visitor_b282 WHERE month=p_month AND visitor_hash=p_visitor_hash AND hour=p_hour;
 IF coalesce(n,0)>=12 THEN RETURN false;END IF;
 INSERT INTO public.jenios_sales_budget_b282(month,reserved_micro_usd) VALUES(p_month,p_amount_micro_usd)
 ON CONFLICT(month) DO UPDATE SET reserved_micro_usd=jenios_sales_budget_b282.reserved_micro_usd+excluded.reserved_micro_usd,updated_at=now();
 INSERT INTO public.jenios_sales_visitor_b282(month,visitor_hash,hour,calls) VALUES(p_month,p_visitor_hash,p_hour,1)
 ON CONFLICT(month,visitor_hash,hour) DO UPDATE SET calls=jenios_sales_visitor_b282.calls+1;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_sales_budget_hold_g44(text,text,text,bigint,bigint,text) TO service_role;

-- Keep the old numeric configuration for an explicit return to capped mode.
-- Existing clients without the new column still use the original capped logic.
ALTER TABLE public.jenios_pro_config_b143 ADD COLUMN monthly_budget_mode text NOT NULL DEFAULT 'capped'
 CHECK(monthly_budget_mode IN ('capped','uncapped'));
ALTER TABLE public.jenios_pro_budgets_b143 ADD COLUMN monthly_budget_mode text NOT NULL DEFAULT 'capped'
 CHECK(monthly_budget_mode IN ('capped','uncapped'));
ALTER TABLE public.jenios_pro_budgets_b143 ALTER COLUMN limit_nano_usd DROP NOT NULL;
ALTER TABLE public.jenios_pro_budgets_b143 ADD CONSTRAINT jenios_pro_budget_mode_shape_g44 CHECK(
 (monthly_budget_mode='capped' AND limit_nano_usd IS NOT NULL) OR
 (monthly_budget_mode='uncapped' AND limit_nano_usd IS NULL)
);
-- Original checks still enforce nonnegative counters and spent+reserved<=limit
-- in capped rows. Uncapped rows retain actual spent/reserved values with NULL
-- limit. Settlement/release/reconciliation are unchanged and never erase usage.

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
 INSERT INTO public.jenios_pro_budgets_b143(month,monthly_budget_mode,limit_nano_usd,reserved_nano_usd)
  VALUES(month_key,c.monthly_budget_mode,CASE WHEN c.monthly_budget_mode='capped' THEN c.monthly_provider_limit_nano_usd ELSE NULL END,p_max_provider_nano_usd)
  ON CONFLICT(month) DO UPDATE SET monthly_budget_mode=EXCLUDED.monthly_budget_mode,limit_nano_usd=EXCLUDED.limit_nano_usd,
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
  OR c.max_request_provider_nano_usd<r.held_provider_nano_usd
  OR (c.monthly_budget_mode='capped' AND (c.monthly_provider_limit_nano_usd<1 OR EXISTS(
   SELECT 1 FROM public.jenios_pro_budgets_b143 WHERE month=r.budget_month AND spent_nano_usd+reserved_nano_usd>c.monthly_provider_limit_nano_usd)))
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

-- Replacing the two functions does not widen their execution privileges.
REVOKE ALL ON FUNCTION public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text),
 public.jenios_pro_dispatch_b143(uuid,text,text) TO service_role;
COMMIT;
