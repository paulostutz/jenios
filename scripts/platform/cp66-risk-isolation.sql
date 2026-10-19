\set ON_ERROR_STOP on
-- CP66 ephemeral PostgreSQL only; never touch remote Supabase.
\i supabase/migrations/20261019023000_platform_risk_evidence_cp66.sql
DO $$
DECLARE rls_on boolean;
BEGIN
 SELECT relrowsecurity INTO rls_on
 FROM pg_class WHERE oid='public.jenios_platform_risk_events'::regclass;
 IF NOT rls_on THEN RAISE EXCEPTION 'Risk evidence table must enable RLS'; END IF;
 IF has_table_privilege('anon','public.jenios_platform_risk_events','SELECT')
 OR has_table_privilege('authenticated','public.jenios_platform_risk_events','SELECT')
 OR has_table_privilege('authenticated','public.jenios_platform_risk_events','INSERT')
 THEN RAISE EXCEPTION 'Client access to risk evidence is forbidden'; END IF;
 IF NOT has_table_privilege('service_role','public.jenios_platform_risk_events','SELECT')
 OR NOT has_table_privilege('service_role','public.jenios_platform_risk_events','INSERT')
 THEN RAISE EXCEPTION 'Verified evidence source lacks service rights'; END IF;
 IF has_table_privilege('service_role','public.jenios_platform_risk_events','UPDATE')
 OR has_table_privilege('service_role','public.jenios_platform_risk_events','DELETE')
 THEN RAISE EXCEPTION 'Risk evidence must be append only'; END IF;
END $$;
SET ROLE service_role;
INSERT INTO public.jenios_platform_risk_events(user_id,external_ref,kind,source,observed_at,verified_at)
VALUES
 ('00000000-0000-4000-8000-000000000001','paper-fixture-0001','risk_block','paper_confirmed',now(),now()),
 ('00000000-0000-4000-8000-000000000002','broker-fixture-0002','risk_block','broker_confirmed',now(),now());
DO $$
BEGIN
 IF (SELECT count(*) FROM public.jenios_platform_risk_events
      WHERE user_id='00000000-0000-4000-8000-000000000001')<>1
 OR (SELECT count(*) FROM public.jenios_platform_risk_events
      WHERE user_id='00000000-0000-4000-8000-000000000002')<>1
 THEN RAISE EXCEPTION 'Cross account evidence isolation failed'; END IF;
 BEGIN
   INSERT INTO public.jenios_platform_risk_events(user_id,external_ref,kind,source,observed_at,verified_at)
   VALUES ('00000000-0000-4000-8000-000000000002','broker-fixture-0002','risk_block','broker_confirmed',now(),now());
   RAISE EXCEPTION 'Duplicate broker reference accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO public.jenios_platform_risk_events(user_id,external_ref,kind,source,observed_at,verified_at,realized_pnl_cents)
   VALUES ('00000000-0000-4000-8000-000000000002','broker-fixture-0003','risk_block','broker_confirmed',now(),now(),500);
   RAISE EXCEPTION 'A risk-block event incorrectly carries PNL';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO public.jenios_platform_risk_events(user_id,external_ref,kind,source,observed_at,verified_at)
   VALUES ('00000000-0000-4000-8000-000000000002','broker-fixture-0004','closed_trade','paper_confirmed',now(),now());
   RAISE EXCEPTION 'Closed trade missing PNL was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
RESET ROLE;
SELECT 'CP66_EPHEMERAL_RISK_RLS_PASS' AS result;
