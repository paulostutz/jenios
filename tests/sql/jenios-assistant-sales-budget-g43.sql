-- Disposable database only, loaded by the G43 loopback runner.
DO $$
DECLARE m text:=to_char(now() at time zone 'UTC','YYYY-MM');
 h text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24');result boolean;n integer;
BEGIN
 IF has_function_privilege('anon','public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint)','EXECUTE')
 OR has_function_privilege('authenticated','public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Public budget mutation must be denied';END IF;
 IF NOT has_function_privilege('service_role','public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint)','EXECUTE') THEN RAISE EXCEPTION 'Backend budget grant missing';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE relname IN ('jenios_sales_budget_b282','jenios_sales_visitor_b282') AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Budget tables require RLS';END IF;
 FOREACH n IN ARRAY ARRAY[1,2,3,4,5] LOOP
  SELECT public.jenios_sales_budget_hold_b282(CASE WHEN n=1 THEN NULL ELSE m END,
   CASE WHEN n=2 THEN NULL ELSE repeat('a',64) END,CASE WHEN n=3 THEN NULL ELSE h END,
   CASE WHEN n=4 THEN NULL ELSE 20000 END,CASE WHEN n=5 THEN NULL ELSE 1000000 END) INTO result;
  IF result IS DISTINCT FROM false THEN RAISE EXCEPTION 'Null budget parameters must fail closed';END IF;
 END LOOP;
 IF public.jenios_sales_budget_hold_b282(m,repeat('a',64),'2020-01-01T00',20000,1000000)
 OR public.jenios_sales_budget_hold_b282(m,repeat('a',64),h,1,1000000)
 OR public.jenios_sales_budget_hold_b282(m,repeat('a',64),h,20000,999999)
 THEN RAISE EXCEPTION 'Invalid window or amount accepted';END IF;
 FOR n IN 1..12 LOOP
  IF NOT public.jenios_sales_budget_hold_b282(m,repeat('a',64),h,20000,1000000) THEN RAISE EXCEPTION 'Expected first 12 visitor reservations';END IF;
 END LOOP;
 IF public.jenios_sales_budget_hold_b282(m,repeat('a',64),h,20000,1000000) THEN RAISE EXCEPTION 'Visitor cap bypassed';END IF;
 IF (SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282 WHERE month=m)<>240000 THEN RAISE EXCEPTION 'Rejected reservation changed budget';END IF;
 UPDATE public.jenios_sales_budget_b282 SET reserved_micro_usd=1000000 WHERE month=m;
 IF public.jenios_sales_budget_hold_b282(m,repeat('b',64),h,20000,1000000) THEN RAISE EXCEPTION 'Monthly cap bypassed';END IF;
 DELETE FROM public.jenios_sales_visitor_b282;
 DELETE FROM public.jenios_sales_budget_b282;
END $$;
SELECT 'G43_SALES_BUDGET_GRANTS_NULLS_WINDOWS_AND_CAPS_PASS';
