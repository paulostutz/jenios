-- G46 approved additional provider capacity BRL 5/10/20/50/100,
-- sold for BRL 15/30/60/150/300. No payment, generation or pricing gate enabled.
BEGIN;
DO $$ BEGIN
 PERFORM id FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G46_CONFIGURATION_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pro_config_b143 WHERE id=true AND payments_enabled)
 THEN RAISE EXCEPTION 'G46_REQUIRES_PAYMENTS_PAUSED'; END IF;
 IF to_regprocedure('public.jenios_pro_included_state_g45(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G46_REQUIRES_G45'; END IF;
END $$;
ALTER TABLE public.jenios_pro_quotes_b143 ADD COLUMN IF NOT EXISTS addon_pack_code text;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.jenios_pro_quotes_b143'::regclass AND conname='jenios_pro_addon_snapshot_g46') THEN
  ALTER TABLE public.jenios_pro_quotes_b143 ADD CONSTRAINT jenios_pro_addon_snapshot_g46 CHECK (
   (addon_pack_code IS NULL AND terms_version<>'jenios-pro-addons-3x-20261024') OR
   (addon_pack_code IS NOT NULL AND addon_pack_code IN ('ia-500','ia-1000','ia-2000','ia-5000','ia-10000')
    AND terms_version='jenios-pro-addons-3x-20261024' AND base_currency='BRL' AND currency='BRL'
    AND base_amount_minor=CASE addon_pack_code WHEN 'ia-500' THEN 500 WHEN 'ia-1000' THEN 1000 WHEN 'ia-2000' THEN 2000 WHEN 'ia-5000' THEN 5000 WHEN 'ia-10000' THEN 10000 END
    AND amount_cents=base_amount_minor*3
    AND retail_nano_usd=2*floor(base_amount_minor::numeric*10000000000000/fx_brl_micros_per_usd)
    AND pricing_version='2026-10-20-v2-nano'));
 END IF;
END $$;
UPDATE public.jenios_pro_config_b143 SET topup_currency='BRL',topup_amount_minor=NULL,
 commercial_terms_version='jenios-pro-addons-3x-20261024',updated_at=now()
 WHERE id=true AND (topup_currency IS DISTINCT FROM 'BRL' OR topup_amount_minor IS NOT NULL
  OR commercial_terms_version IS DISTINCT FROM 'jenios-pro-addons-3x-20261024');

CREATE OR REPLACE FUNCTION public.jenios_pro_create_addon_quote_g46(
 p_user_id uuid,p_quote_key text,p_pack_code text,p_fx_brl_micros_per_usd bigint,p_rate_source text,p_rate_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_pro_config_b143%ROWTYPE;q public.jenios_pro_quotes_b143%ROWTYPE;capacity bigint;retail bigint;included jsonb;
BEGIN
 capacity:=CASE p_pack_code WHEN 'ia-500' THEN 500 WHEN 'ia-1000' THEN 1000 WHEN 'ia-2000' THEN 2000 WHEN 'ia-5000' THEN 5000 WHEN 'ia-10000' THEN 10000 END;
 IF p_user_id IS NULL OR p_quote_key IS NULL OR p_quote_key !~ '^[A-Za-z0-9_-]{16,100}$' OR capacity IS NULL
 OR p_fx_brl_micros_per_usd IS NULL OR p_fx_brl_micros_per_usd NOT BETWEEN 1000000 AND 100000000
 OR p_rate_source IS DISTINCT FROM 'BCB:PTAX_USD_VENDA' OR p_rate_at IS NULL OR p_rate_at>now() OR p_rate_at<now()-interval '72 hours'
 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_QUOTE'); END IF;
 SELECT * INTO c FROM public.jenios_pro_config_b143 WHERE id=true FOR UPDATE;
 IF NOT FOUND OR NOT c.payments_enabled OR c.requires_reconciliation OR c.topup_currency IS DISTINCT FROM 'BRL'
 OR c.topup_amount_minor IS NOT NULL OR c.commercial_terms_version IS DISTINCT FROM 'jenios-pro-addons-3x-20261024'
 OR c.pricing_version IS DISTINCT FROM '2026-10-20-v2-nano' OR NOT c.pricing_approved
 OR c.rates_verified_at IS NULL OR c.rates_verified_at>now() OR c.rates_verified_at<now()-interval '30 days'
 OR cardinality(c.allowed_models)<1 OR (c.monthly_budget_mode='capped' AND c.monthly_provider_limit_nano_usd<1)
 THEN RETURN jsonb_build_object('ok',false,'code','PAYMENTS_NOT_APPROVED'); END IF;
 included:=public.jenios_pro_included_state_g45(p_user_id);
 IF included IS NULL THEN RETURN jsonb_build_object('ok',false,'code','ADVANCED_PLAN_REQUIRED'); END IF;
 IF (included->>'transitionRequired')::boolean THEN RETURN jsonb_build_object('ok',false,'code','INCLUDED_PERIOD_TRANSITION_REQUIRED'); END IF;
 SELECT * INTO q FROM public.jenios_pro_quotes_b143 WHERE user_id=p_user_id AND quote_key=p_quote_key;
 IF FOUND THEN
  IF q.addon_pack_code IS DISTINCT FROM p_pack_code THEN RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT'); END IF;
  IF q.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'code','QUOTE_EXPIRED'); END IF;
  RETURN jsonb_build_object('ok',true,'quote',to_jsonb(q),'replayed',true);
 END IF;
 retail:=2*floor(capacity::numeric*10000000000000/p_fx_brl_micros_per_usd)::bigint;
 INSERT INTO public.jenios_pro_quotes_b143(user_id,quote_key,currency,amount_cents,retail_nano_usd,base_currency,
 base_amount_minor,fx_brl_micros_per_usd,rate_source,rate_at,terms_version,pricing_version,expires_at,addon_pack_code)
 VALUES(p_user_id,p_quote_key,'BRL',capacity*3,retail,'BRL',capacity,p_fx_brl_micros_per_usd,p_rate_source,p_rate_at,
 c.commercial_terms_version,c.pricing_version,now()+interval '15 minutes',p_pack_code) RETURNING * INTO q;
 RETURN jsonb_build_object('ok',true,'quote',to_jsonb(q),'replayed',false);
END;$$;
REVOKE ALL ON FUNCTION public.jenios_pro_create_addon_quote_g46(uuid,text,text,bigint,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_pro_create_addon_quote_g46(uuid,text,text,bigint,text,timestamptz) TO service_role;
COMMIT;
