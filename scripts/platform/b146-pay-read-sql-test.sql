-- Somente na fixture PostgreSQL local descartável; não executar no Supabase.
-- Todas as alterações de privilégios são revertidas pelo ROLLBACK final.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'jenios_pro_b143_test' THEN
  RAISE EXCEPTION 'B146 PAY read test requires isolated local test database';
 END IF;
END;$$;

CREATE TEMP VIEW b146_pay_client_privileges AS
 SELECT role_name,privilege_name,''::text AS column_name,
  has_table_privilege(role_name,'public.jenios_pay_subscriptions',privilege_name) AS allowed
 FROM unnest(ARRAY['anon','authenticated']) AS roles(role_name)
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS permissions(privilege_name)
 UNION ALL
 SELECT role_name,privilege_name,a.attname::text AS column_name,
  has_column_privilege(role_name,'public.jenios_pay_subscriptions',a.attname,privilege_name) AS allowed
 FROM unnest(ARRAY['anon','authenticated']) AS roles(role_name)
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) AS permissions(privilege_name)
 CROSS JOIN pg_attribute a
 WHERE a.attrelid='public.jenios_pay_subscriptions'::regclass AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE b146_pay_client_privileges_before ON COMMIT DROP AS
 SELECT * FROM b146_pay_client_privileges;

-- A fixture B143 concede leitura/escrita amplas; removê-las apenas neste teste.
REVOKE SELECT, INSERT, UPDATE ON public.jenios_pay_subscriptions FROM service_role;
\ir ../../db/schema/university-pro-pay-read-b146.sql

DO $$
DECLARE column_name text;
BEGIN
 FOREACH column_name IN ARRAY ARRAY['id','user_id','product_id','status','current_period_start','current_period_end','created_at'] LOOP
  IF NOT has_column_privilege('service_role','public.jenios_pay_subscriptions',column_name,'SELECT') THEN
   RAISE EXCEPTION 'B146 service_role cannot read required subscription column: %',column_name;
  END IF;
 END LOOP;
 IF has_table_privilege('service_role','public.jenios_pay_subscriptions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
  RAISE EXCEPTION 'B146 granted a table-wide subscription privilege';
 END IF;
 IF has_any_column_privilege('service_role','public.jenios_pay_subscriptions','INSERT,UPDATE,REFERENCES') THEN
  RAISE EXCEPTION 'B146 granted a non-read subscription column privilege';
 END IF;
 IF EXISTS(
  (SELECT * FROM b146_pay_client_privileges_before EXCEPT SELECT * FROM b146_pay_client_privileges)
  UNION ALL
  (SELECT * FROM b146_pay_client_privileges EXCEPT SELECT * FROM b146_pay_client_privileges_before)
 ) THEN
  RAISE EXCEPTION 'B146 changed anon or authenticated subscription privileges';
 END IF;
END;$$;

SET LOCAL ROLE service_role;
SELECT id,user_id,product_id,status,current_period_start,current_period_end,created_at
FROM public.jenios_pay_subscriptions
WHERE user_id='b1460000-0000-4000-8000-000000000001'::uuid
ORDER BY created_at DESC;
ROLLBACK;
SELECT 'B146 PAY read invariants passed: seven readable columns, no table-wide or write grants, other roles preserved; fixture privileges restored' AS result;
