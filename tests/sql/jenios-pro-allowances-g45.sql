-- Actual SQL assertions, called only by the disposable-loopback G45 runner.
CREATE FUNCTION pg_temp.g45_assert(condition boolean,label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'G45_ASSERT:%',label;END IF;
END $$;

SELECT pg_temp.g45_assert((SELECT crypto_allowance_nano_usd=4000000000
 AND global_allowance_nano_usd=8000000000 FROM public.jenios_pro_config_b143 WHERE id=true),
 'APPROVED_2_4_PROVIDER_IS_4_8_INTERNAL');

SELECT pg_temp.g45_assert((SELECT bool_and(NOT prosecdef)
 FROM pg_proc WHERE oid IN (
  'public.jenios_pro_included_state_g45(uuid)'::regprocedure,
  'public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text)'::regprocedure,
  'public.jenios_pro_dispatch_b143(uuid,text,text)'::regprocedure,
  'public.jenios_pro_status_b143(uuid)'::regprocedure)), 'NO_SECURITY_DEFINER');

SELECT pg_temp.g45_assert((SELECT bool_and(
 NOT has_function_privilege('anon',signature,'EXECUTE')
 AND NOT has_function_privilege('authenticated',signature,'EXECUTE')
 AND has_function_privilege('service_role',signature,'EXECUTE'))
 FROM unnest(ARRAY[
  'public.jenios_pro_included_state_g45(uuid)',
  'public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text)',
  'public.jenios_pro_dispatch_b143(uuid,text,text)',
  'public.jenios_pro_status_b143(uuid)']) signature), 'RPC_SERVICE_ROLE_ONLY');

SELECT pg_temp.g45_assert((SELECT bool_and(relrowsecurity) FROM pg_class
 WHERE oid IN ('public.jenios_pro_config_b143'::regclass,
 'public.jenios_pro_wallets_b143'::regclass,'public.jenios_pro_periods_b143'::regclass,
 'public.jenios_pro_requests_b143'::regclass)), 'EXISTING_RLS_PRESERVED');

SELECT pg_temp.g45_assert(NOT EXISTS(SELECT 1 FROM public.jenios_pro_periods_b143
 WHERE spent_nano_usd<0 OR reserved_nano_usd<0
 OR spent_nano_usd+reserved_nano_usd>allowance_nano_usd), 'PERIOD_LEDGER_INVARIANT');

SELECT 'G45_SQL_POLICY_PRIVILEGES_AND_LEDGER_INVARIANTS_PASS';
