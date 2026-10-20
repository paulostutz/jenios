-- Execute somente após b143-wallet-fixture.sql no PostgreSQL local descartável.
-- Os registros fictícios e as tabelas temporárias são revertidos ao terminar.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'jenios_pro_b143_test' THEN
  RAISE EXCEPTION 'B146 catalog test requires isolated local test database';
 END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pay_products
  WHERE code IN ('social-university-pass','social-ai-pro-credits')) THEN
  RAISE EXCEPTION 'B146 catalog test requires the clean B143 product fixture';
 END IF;
END;$$;

SAVEPOINT b146_empty_catalog;
\ir ../../db/schema/university-pro-catalog-b146.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.jenios_pay_products
  WHERE code IN ('social-university-pass','social-ai-pro-credits'))<>2 THEN
  RAISE EXCEPTION 'B146 catalog did not insert both products';
 END IF;
 IF EXISTS(SELECT 1 FROM public.jenios_pay_products
  WHERE code IN ('social-university-pass','social-ai-pro-credits')
   AND (id IS NULL OR category IS DISTINCT FROM 'other'
    OR price_cents IS DISTINCT FROM 0::bigint OR currency IS DISTINCT FROM 'BRL'
    OR billing_type IS DISTINCT FROM 'one_time' OR active IS DISTINCT FROM false)) THEN
  RAISE EXCEPTION 'B146 catalog must create inactive, unpriced, one-time BRL products';
 END IF;
 IF (SELECT name FROM public.jenios_pay_products WHERE code='social-university-pass')
   IS DISTINCT FROM 'Universidade JENIOS — 30 dias'
  OR (SELECT name FROM public.jenios_pay_products WHERE code='social-ai-pro-credits')
   IS DISTINCT FROM 'Créditos Gênio / Gênia Pro' THEN
  RAISE EXCEPTION 'B146 product names do not match the approved catalog';
 END IF;
END;$$;

CREATE TEMP TABLE b146_catalog_snapshot ON COMMIT DROP AS
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.code),'[]'::jsonb) AS content
 FROM public.jenios_pay_products p;
\ir ../../db/schema/university-pro-catalog-b146.sql
DO $$ BEGIN
 IF (SELECT content FROM b146_catalog_snapshot) IS DISTINCT FROM
  (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.code),'[]'::jsonb)
   FROM public.jenios_pay_products p) THEN
  RAISE EXCEPTION 'B146 repeated catalog insert changed existing rows or UUIDs';
 END IF;
END;$$;
ROLLBACK TO SAVEPOINT b146_empty_catalog;
RELEASE SAVEPOINT b146_empty_catalog;

-- Um catálogo já configurado deve permanecer intacto, inclusive preço e ativação.
-- Estes valores são apenas dados fictícios do teste, não decisões comerciais.
INSERT INTO public.jenios_pay_products
 (code,name,category,price_cents,currency,billing_type,active)
VALUES
 ('social-university-pass','B146 existing university fixture','other',12345,'BRL','one_time',true),
 ('social-ai-pro-credits','B146 existing credit fixture','other',67890,'BRL','one_time',true);
CREATE TEMP TABLE b146_catalog_snapshot ON COMMIT DROP AS
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.code),'[]'::jsonb) AS content
 FROM public.jenios_pay_products p;
\ir ../../db/schema/university-pro-catalog-b146.sql
DO $$ BEGIN
 IF (SELECT content FROM b146_catalog_snapshot) IS DISTINCT FROM
  (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.code),'[]'::jsonb)
   FROM public.jenios_pay_products p) THEN
  RAISE EXCEPTION 'B146 catalog overwrote an existing product configuration';
 END IF;
END;$$;
ROLLBACK;
SELECT 'B146 catalog invariants passed: inactive defaults, generated UUIDs, idempotency and existing products preserved; fictitious records rolled back' AS result;
