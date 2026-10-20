-- JENIOS B131: budget authorization infrastructure; prepare and review before applying.
-- No provider request can occur unless server flag, key, model, budget and this RPC all exist.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_ai_monthly_budget (
 month text PRIMARY KEY CHECK(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_micro_usd >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_ai_monthly_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_ai_monthly_budget FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.jenios_ai_monthly_budget TO service_role;
CREATE OR REPLACE FUNCTION public.jenios_ai_budget_reserve_b131(
 p_month text,p_cost_micro_usd bigint,p_limit_micro_usd bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$
DECLARE saved bigint;
BEGIN
 IF p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    OR p_cost_micro_usd IS NULL OR p_cost_micro_usd < 1 OR p_cost_micro_usd > 1000000
    OR p_limit_micro_usd IS NULL OR p_limit_micro_usd < 1 OR p_limit_micro_usd > 1000000000
    OR p_cost_micro_usd > p_limit_micro_usd
 THEN RETURN false; END IF;
 INSERT INTO public.jenios_ai_monthly_budget(month,reserved_micro_usd,updated_at)
 VALUES(p_month,p_cost_micro_usd,now())
 ON CONFLICT(month) DO UPDATE
 SET reserved_micro_usd=jenios_ai_monthly_budget.reserved_micro_usd+EXCLUDED.reserved_micro_usd,
     updated_at=now()
 WHERE jenios_ai_monthly_budget.reserved_micro_usd <= p_limit_micro_usd-EXCLUDED.reserved_micro_usd
 RETURNING reserved_micro_usd INTO saved;
 RETURN saved IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.jenios_ai_budget_reserve_b131(text,bigint,bigint) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_ai_budget_reserve_b131(text,bigint,bigint) TO service_role;
COMMIT;
