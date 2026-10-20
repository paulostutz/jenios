-- B138 JENIOS PRO prepaid ledger. REVIEW ONLY: no deployment/migration until financial audit.
-- Every function remains restricted to service_role; no anon/authenticated policy.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_pro_wallets(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 paid_retail_micro_usd bigint NOT NULL DEFAULT 0 CHECK(paid_retail_micro_usd>=0),
 reserved_retail_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_retail_micro_usd>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(reserved_retail_micro_usd<=paid_retail_micro_usd)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 16 AND 100),
 source text NOT NULL CHECK(source IN ('prepaid','included')),
 subscription_id uuid REFERENCES public.jenios_pay_subscriptions(id),
 period_start timestamptz,
 task text NOT NULL CHECK(length(task) BETWEEN 3 AND 45),
 model text NOT NULL CHECK(length(model) BETWEEN 3 AND 50),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','settled','released','needs_reconciliation')),
 held_micro_usd bigint NOT NULL CHECK(held_micro_usd>=1),
 charged_micro_usd bigint NOT NULL DEFAULT 0 CHECK(charged_micro_usd>=0),
 upstream_micro_usd bigint NOT NULL DEFAULT 0 CHECK(upstream_micro_usd>=0),
 usage_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(user_id,request_key),
 CHECK(charged_micro_usd<=held_micro_usd)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_plan_periods(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 subscription_id uuid NOT NULL REFERENCES public.jenios_pay_subscriptions(id),
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 allowance_micro_usd bigint NOT NULL CHECK(allowance_micro_usd>=0),
 spent_micro_usd bigint NOT NULL DEFAULT 0 CHECK(spent_micro_usd>=0),
 reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_micro_usd>=0),
 PRIMARY KEY(user_id,subscription_id,start_at),
 CHECK(spent_micro_usd+reserved_micro_usd<=allowance_micro_usd)
);
CREATE TABLE IF NOT EXISTS public.jenios_pro_funding(
 order_id uuid PRIMARY KEY REFERENCES public.jenios_pay_orders(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 retail_micro_usd bigint NOT NULL CHECK(retail_micro_usd BETWEEN 10000000 AND 1000000000),
 amount_cents bigint NOT NULL CHECK(amount_cents>=1000),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 credited_at timestamptz NOT NULL DEFAULT now(),
 receipt_id text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS jenios_pro_requests_owner_date ON public.jenios_pro_requests(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS jenios_pro_funding_user_date ON public.jenios_pro_funding(user_id,credited_at DESC);

ALTER TABLE public.jenios_pro_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_plan_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pro_funding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_pro_wallets, public.jenios_pro_requests,
 public.jenios_pro_plan_periods, public.jenios_pro_funding FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_pro_wallets, public.jenios_pro_requests,
 public.jenios_pro_plan_periods, public.jenios_pro_funding TO service_role;

-- Only paid orders and actual confirmed payment receipts may fund wallet credits.
-- A repeated confirmation of the same order never credits again.
CREATE OR REPLACE FUNCTION public.jenios_pro_confirm_paid_topup(
 p_user_id uuid,p_order_id uuid,p_retail_micro_usd bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o public.jenios_pay_orders%ROWTYPE; receipt text; product_code text; metadata jsonb;
BEGIN
 IF p_user_id IS NULL OR p_order_id IS NULL OR p_retail_micro_usd NOT BETWEEN 10000000 AND 1000000000 THEN RETURN false; END IF;
 SELECT * INTO o FROM public.jenios_pay_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.currency<>'BRL' THEN RETURN false; END IF;
 SELECT code INTO product_code FROM public.jenios_pay_products WHERE id=o.product_id;
 IF product_code<>'social-ai-pro-credits' THEN RETURN false; END IF;
 BEGIN metadata:=o.external_reference::jsonb;EXCEPTION WHEN OTHERS THEN RETURN false;END;
 IF metadata->>'productCode'<>'social-ai-pro-credits'
  OR metadata->>'scope'<>'social'
  OR (metadata->>'retail_micro_usd')::bigint<>p_retail_micro_usd
  OR coalesce(metadata->>'fx_verified','')<>'true' THEN RETURN false;END IF;
 SELECT provider||':'||provider_payment_id INTO receipt FROM public.jenios_pay_payments
 WHERE order_id=p_order_id AND status='confirmed' AND amount_cents=o.amount_cents
   AND confirmed_at IS NOT NULL AND provider_payment_id IS NOT NULL
 ORDER BY confirmed_at DESC LIMIT 1;
 IF receipt IS NULL THEN RETURN false; END IF;
 INSERT INTO public.jenios_pro_funding(order_id,user_id,retail_micro_usd,amount_cents,receipt_id)
 VALUES(p_order_id,p_user_id,p_retail_micro_usd,o.amount_cents,receipt)
 ON CONFLICT(order_id) DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.jenios_pro_wallets(user_id,paid_retail_micro_usd)
 VALUES(p_user_id,p_retail_micro_usd)
 ON CONFLICT(user_id) DO UPDATE
 SET paid_retail_micro_usd=jenios_pro_wallets.paid_retail_micro_usd+EXCLUDED.paid_retail_micro_usd,
 updated_at=now();
 RETURN true;
END; $$;

-- Exact idempotency and row locks protect against concurrent requests.
CREATE OR REPLACE FUNCTION public.jenios_pro_reserve(
 p_user_id uuid,p_request_key text,p_task text,p_model text,
 p_source text,p_max_micro_usd bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE sub record; allowance bigint; existing uuid;
BEGIN
 IF p_user_id IS NULL OR length(p_request_key) NOT BETWEEN 16 AND 100
 OR p_task !~ '^[a-z_]{3,45}$' OR p_model !~ '^[a-z0-9.-]{3,50}$'
 OR p_source NOT IN ('prepaid','included')
 OR p_max_micro_usd NOT BETWEEN 1 AND 5000000 THEN RETURN false;END IF;
 SELECT id INTO existing FROM public.jenios_pro_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN RETURN false;END IF;
 IF p_source='prepaid' THEN
  INSERT INTO public.jenios_pro_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  UPDATE public.jenios_pro_wallets
   SET reserved_retail_micro_usd=reserved_retail_micro_usd+p_max_micro_usd,updated_at=now()
   WHERE user_id=p_user_id AND paid_retail_micro_usd-reserved_retail_micro_usd>=p_max_micro_usd;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.jenios_pro_requests(user_id,request_key,task,model,source,held_micro_usd)
   VALUES(p_user_id,p_request_key,p_task,p_model,p_source,p_max_micro_usd);
 ELSE
  SELECT s.id,s.current_period_start,s.current_period_end,p.code INTO sub
   FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
   WHERE s.user_id=p_user_id AND s.status IN ('active','trialing')
    AND s.current_period_start<=now() AND s.current_period_end>now()
    AND p.code IN ('platform-global-crypto','platform-internacional-pro')
   ORDER BY CASE p.code WHEN 'platform-internacional-pro' THEN 2 ELSE 1 END DESC LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  allowance:=CASE sub.code WHEN 'platform-global-crypto' THEN 2000000 ELSE 4000000 END;
  INSERT INTO public.jenios_pro_plan_periods(user_id,subscription_id,start_at,end_at,allowance_micro_usd)
   VALUES(p_user_id,sub.id,sub.current_period_start,sub.current_period_end,allowance)
   ON CONFLICT(user_id,subscription_id,start_at) DO NOTHING;
  UPDATE public.jenios_pro_plan_periods
   SET reserved_micro_usd=reserved_micro_usd+p_max_micro_usd
   WHERE user_id=p_user_id AND subscription_id=sub.id AND start_at=sub.current_period_start
    AND end_at>now() AND allowance_micro_usd-spent_micro_usd-reserved_micro_usd>=p_max_micro_usd;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.jenios_pro_requests(user_id,request_key,task,model,source,subscription_id,period_start,held_micro_usd)
   VALUES(p_user_id,p_request_key,p_task,p_model,p_source,sub.id,sub.current_period_start,p_max_micro_usd);
 END IF;
 RETURN true;
END; $$;

-- Providers may bill even when a request times out. Unknown usage leaves the hold
-- open for reconciliation; never credit back an ambiguous provider response.
CREATE OR REPLACE FUNCTION public.jenios_pro_settle(
 p_user_id uuid,p_request_key text,p_provider_micro_usd bigint,p_usage jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE req public.jenios_pro_requests%ROWTYPE; charge bigint;
BEGIN
 IF p_user_id IS NULL OR p_provider_micro_usd IS NULL OR p_provider_micro_usd<0
 OR p_usage IS NULL OR jsonb_typeof(p_usage)<>'object' THEN RETURN false; END IF;
 SELECT * INTO req FROM public.jenios_pro_requests WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND OR req.state<>'reserved' THEN RETURN false; END IF;
 charge:=p_provider_micro_usd*2;
 IF charge>req.held_micro_usd THEN
  UPDATE public.jenios_pro_requests SET state='needs_reconciliation',upstream_micro_usd=p_provider_micro_usd,usage_data=p_usage WHERE id=req.id;
  RETURN false;
 END IF;
 IF req.source='prepaid' THEN
  UPDATE public.jenios_pro_wallets
   SET paid_retail_micro_usd=paid_retail_micro_usd-charge,
   reserved_retail_micro_usd=reserved_retail_micro_usd-req.held_micro_usd,updated_at=now()
   WHERE user_id=p_user_id AND reserved_retail_micro_usd>=req.held_micro_usd;
 ELSE
  UPDATE public.jenios_pro_plan_periods
   SET spent_micro_usd=spent_micro_usd+charge,reserved_micro_usd=reserved_micro_usd-req.held_micro_usd
   WHERE user_id=p_user_id AND subscription_id=req.subscription_id AND start_at=req.period_start
    AND reserved_micro_usd>=req.held_micro_usd;
 END IF;
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE public.jenios_pro_requests SET state='settled',charged_micro_usd=charge,upstream_micro_usd=p_provider_micro_usd,
  usage_data=p_usage,completed_at=now() WHERE id=req.id;
 RETURN true;
END; $$;
CREATE OR REPLACE FUNCTION public.jenios_pro_release(
 p_user_id uuid,p_request_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE req public.jenios_pro_requests%ROWTYPE;
BEGIN
 SELECT * INTO req FROM public.jenios_pro_requests WHERE user_id=p_user_id AND request_key=p_request_key FOR UPDATE;
 IF NOT FOUND OR req.state<>'reserved' THEN RETURN false;END IF;
 IF req.source='prepaid' THEN
  UPDATE public.jenios_pro_wallets
   SET reserved_retail_micro_usd=reserved_retail_micro_usd-req.held_micro_usd,updated_at=now()
   WHERE user_id=p_user_id AND reserved_retail_micro_usd>=req.held_micro_usd;
 ELSE
  UPDATE public.jenios_pro_plan_periods
   SET reserved_micro_usd=reserved_micro_usd-req.held_micro_usd
   WHERE user_id=p_user_id AND subscription_id=req.subscription_id AND start_at=req.period_start
    AND reserved_micro_usd>=req.held_micro_usd;
 END IF;
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE public.jenios_pro_requests SET state='released',completed_at=now() WHERE id=req.id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.jenios_pro_confirm_paid_topup(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_pro_reserve(uuid,text,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_pro_settle(uuid,text,bigint,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_pro_release(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_pro_confirm_paid_topup(uuid,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_pro_reserve(uuid,text,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_pro_settle(uuid,text,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_pro_release(uuid,text) TO service_role;
COMMIT;