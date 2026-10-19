\set ON_ERROR_STOP on
-- CP64 — Ambiente PostgreSQL efêmero. NÃO EXECUTAR EM PRODUÇÃO.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid primary key);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$$;
\i supabase/migrations/20261019014500_platform_diagnostic_private_cp63.sql

DO $$
DECLARE
 r record;
BEGIN
 SELECT relrowsecurity INTO r FROM pg_class WHERE oid='public.jenios_platform_diagnostics'::regclass;
 IF NOT r.relrowsecurity THEN RAISE EXCEPTION 'RLS disabled'; END IF;
 IF has_table_privilege('anon','public.jenios_platform_diagnostics','SELECT') OR
    has_table_privilege('anon','public.jenios_platform_diagnostics','INSERT') OR
    has_table_privilege('authenticated','public.jenios_platform_diagnostics','SELECT') OR
    has_table_privilege('authenticated','public.jenios_platform_diagnostics','INSERT') OR
    has_table_privilege('authenticated','public.jenios_platform_diagnostics','UPDATE') OR
    has_table_privilege('authenticated','public.jenios_platform_diagnostics','DELETE')
 THEN RAISE EXCEPTION 'Client role has forbidden access'; END IF;
 IF NOT has_table_privilege('service_role','public.jenios_platform_diagnostics','SELECT') OR
    NOT has_table_privilege('service_role','public.jenios_platform_diagnostics','INSERT')
 THEN RAISE EXCEPTION 'service role lacks necessary permission'; END IF;
 IF has_table_privilege('service_role','public.jenios_platform_diagnostics','UPDATE')
 OR has_table_privilege('service_role','public.jenios_platform_diagnostics','DELETE')
 THEN RAISE EXCEPTION 'service role can mutate immutable diagnostics'; END IF;
END $$;

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003');
SET ROLE service_role;
INSERT INTO public.jenios_platform_diagnostics(user_id,answers,timeframe,initial_mode,scores,methodology)
VALUES
 ('00000000-0000-4000-8000-000000000001',ARRAY[4,4,4,4,4]::smallint[],'RAPIDO','manual','{"tecnico_positivo":10}'::jsonb,'JENIOS-UX-2'),
 ('00000000-0000-4000-8000-000000000002',ARRAY[0,0,0,0,0]::smallint[],'SWING','reversa','{"impulsivo":10}'::jsonb,'JENIOS-UX-2');
DO $$
DECLARE count_all int;
BEGIN
 SELECT count(*) INTO count_all FROM public.jenios_platform_diagnostics;
 IF count_all <> 2 THEN RAISE EXCEPTION 'Wrong number of persisted diagnostics'; END IF;
 IF (SELECT initial_mode FROM public.jenios_platform_diagnostics WHERE user_id='00000000-0000-4000-8000-000000000001') <> 'manual'
 OR (SELECT initial_mode FROM public.jenios_platform_diagnostics WHERE user_id='00000000-0000-4000-8000-000000000002') <> 'reversa'
 THEN RAISE EXCEPTION 'Cross-user data corruption'; END IF;
 BEGIN
   INSERT INTO public.jenios_platform_diagnostics(user_id,answers,timeframe,initial_mode,scores,methodology)
     VALUES ('00000000-0000-4000-8000-000000000001',ARRAY[0,0,0,0,0]::smallint[],'SWING','reversa','{}'::jsonb,'JENIOS-UX-2');
   RAISE EXCEPTION 'Duplicate questionnaire unexpectedly accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 FOR count_all IN 1..4 LOOP
   BEGIN
     INSERT INTO public.jenios_platform_diagnostics(user_id,answers,timeframe,initial_mode,scores,methodology)
     VALUES ('00000000-0000-4000-8000-000000000003',
       CASE count_all
         WHEN 1 THEN ARRAY[4,4,4,4,9]::smallint[]
         WHEN 2 THEN ARRAY[4,4,4,4]::smallint[]
         WHEN 3 THEN ARRAY[4,4,4,NULL,4]::smallint[]
         ELSE ARRAY[-1,4,4,4,4]::smallint[] END,
       'SWING','manual','{}'::jsonb,'JENIOS-UX-2');
     RAISE EXCEPTION 'Invalid answers accepted: %',count_all;
   EXCEPTION WHEN check_violation THEN NULL;
   END;
 END LOOP;
END $$;
RESET ROLE;
SELECT 'CP64_EPHEMERAL_RLS_PASS' AS result;
