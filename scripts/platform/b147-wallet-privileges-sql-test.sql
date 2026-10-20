-- Disposable PostgreSQL 17 CI fixture ONLY; never execute against Supabase.
-- The included hardening owns its BEGIN/COMMIT. Temporary snapshots survive commits.
-- No application rows are inserted or updated; final privileges remain hardened.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'jenios_pro_b143_test' OR current_setting('server_version_num')::int<170000 THEN
  RAISE EXCEPTION 'B147 privilege test requires the isolated PostgreSQL 17+ fixture';
 END IF;
END;$$;

CREATE TEMP TABLE b147_wallet_expected(table_name text PRIMARY KEY,can_update boolean NOT NULL);
INSERT INTO b147_wallet_expected VALUES
 ('jenios_pro_config_b143',true),('jenios_pro_wallets_b143',true),
 ('jenios_pro_periods_b143',true),('jenios_pro_budgets_b143',true),
 ('jenios_pro_requests_b143',true),('jenios_pro_events_b143',false),
 ('jenios_pro_quotes_b143',false),('jenios_pro_quote_orders_b143',false),
 ('jenios_pro_funding_b143',false);

CREATE TEMP TABLE b147_wallet_data_before(table_name text PRIMARY KEY,content jsonb NOT NULL);
DO $$ DECLARE t record;content jsonb;BEGIN
 FOR t IN SELECT table_name FROM b147_wallet_expected LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM public.%I r',t.table_name) INTO content;
  INSERT INTO b147_wallet_data_before VALUES(t.table_name,content);
 END LOOP;
END;$$;

CREATE TEMP TABLE b147_other_tables_before AS
 SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p')
 AND NOT EXISTS(SELECT 1 FROM b147_wallet_expected e WHERE n.nspname='public' AND e.table_name=c.relname);
CREATE TEMP TABLE b147_pro_functions_before AS
 SELECT p.oid,p.proacl,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname ~ '^jenios_pro_.*_b143$';

-- Reproduce overly broad defaults observed in production, including TRUNCATE.
GRANT ALL ON TABLE
 public.jenios_pro_config_b143,public.jenios_pro_wallets_b143,
 public.jenios_pro_periods_b143,public.jenios_pro_budgets_b143,
 public.jenios_pro_requests_b143,public.jenios_pro_events_b143,
 public.jenios_pro_quotes_b143,public.jenios_pro_quote_orders_b143,
 public.jenios_pro_funding_b143 TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM b147_wallet_expected e
  WHERE NOT has_table_privilege('service_role','public.'||e.table_name,'TRUNCATE')
     OR NOT has_table_privilege('service_role','public.'||e.table_name,'MAINTAIN')) THEN
  RAISE EXCEPTION 'B147 test did not establish broad service_role privileges';
 END IF;
END;$$;

\ir ../../db/schema/pro-wallet-privileges-b147.sql
\ir ../../db/schema/pro-wallet-privileges-b147.sql

DO $$
DECLARE t record;privilege_name text;role_name text;allowed boolean;expected boolean;content jsonb;
BEGIN
 FOR t IN SELECT * FROM b147_wallet_expected LOOP
  FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
   allowed:=has_table_privilege('service_role','public.'||t.table_name,privilege_name);
   expected:=privilege_name IN ('SELECT','INSERT') OR privilege_name='UPDATE' AND t.can_update;
   IF allowed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'B147 wrong service_role privilege: table=%, privilege=%, actual=%, expected=%',t.table_name,privilege_name,allowed,expected;
   END IF;
   FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(role_name,'public.'||t.table_name,privilege_name) THEN
     RAISE EXCEPTION 'B147 private table accessible to client: %, %, %',t.table_name,role_name,privilege_name;
    END IF;
   END LOOP;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t.table_name)::regclass) THEN
   RAISE EXCEPTION 'B147 disabled RLS on %',t.table_name;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c,
   LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
   WHERE c.oid=('public.'||t.table_name)::regclass AND a.grantee=0) THEN
   RAISE EXCEPTION 'B147 table has a PUBLIC grant: %',t.table_name;
  END IF;
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM public.%I r',t.table_name) INTO content;
  IF content IS DISTINCT FROM (SELECT b.content FROM b147_wallet_data_before b WHERE b.table_name=t.table_name) THEN
   RAISE EXCEPTION 'B147 modified application data in %',t.table_name;
  END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM b147_other_tables_before b JOIN pg_class c USING(oid)
  WHERE b.relowner IS DISTINCT FROM c.relowner OR b.relacl IS DISTINCT FROM c.relacl
   OR b.relrowsecurity IS DISTINCT FROM c.relrowsecurity OR b.relforcerowsecurity IS DISTINCT FROM c.relforcerowsecurity
 ) THEN RAISE EXCEPTION 'B147 changed an unrelated table';END IF;
 IF EXISTS(
  SELECT 1 FROM b147_pro_functions_before b JOIN pg_proc p USING(oid)
  WHERE b.proacl IS DISTINCT FROM p.proacl OR b.prosecdef IS DISTINCT FROM p.prosecdef
 ) THEN RAISE EXCEPTION 'B147 changed a Pro function privilege or security mode';END IF;
 IF EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname ~ '^jenios_pro_.*_b143$'
   AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
 ) THEN RAISE EXCEPTION 'B147 private Pro function callable by a client';END IF;
END;$$;

BEGIN;
SET LOCAL ROLE service_role;
DO $$ DECLARE blocked boolean:=false;r jsonb;BEGIN
 -- A real privilege check: TRUNCATE bypasses RLS, so RLS alone is insufficient.
 BEGIN
  TRUNCATE TABLE public.jenios_pro_config_b143,public.jenios_pro_wallets_b143,
   public.jenios_pro_periods_b143,public.jenios_pro_budgets_b143,
   public.jenios_pro_requests_b143,public.jenios_pro_events_b143,
   public.jenios_pro_quotes_b143,public.jenios_pro_quote_orders_b143,
   public.jenios_pro_funding_b143;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'B147 service_role could truncate the Pro ledger';END IF;
 r:=public.jenios_pro_status_b143('b1470000-0000-4000-8000-000000000001');
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'B147 broke service_role ledger reads';END IF;
END;$$;
ROLLBACK;

SELECT 'B147 wallet privilege invariants passed: exact service_role grants, no TRUNCATE/MAINTAIN/delete, private clients denied, idempotency and application data preserved' AS result;
