-- Disposable PostgreSQL CI database ONLY. This fixture must never target Supabase.
-- The CI runner connects to a fresh local database named jenios_pro_b143_test.
DO $$ BEGIN
 IF current_database()<>'jenios_pro_b143_test' THEN RAISE EXCEPTION 'B143 fixture requires isolated local test database';END IF;
END;$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.jenios_pay_products(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL,
 category text NOT NULL,currency text NOT NULL DEFAULT 'BRL',billing_type text NOT NULL DEFAULT 'one_time',
 price_cents bigint NOT NULL DEFAULT 0,active boolean NOT NULL DEFAULT false
);
CREATE TABLE public.jenios_pay_orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 product_id uuid NOT NULL REFERENCES public.jenios_pay_products(id),amount_cents bigint NOT NULL,currency text NOT NULL,
 status text NOT NULL,provider text NOT NULL,idempotency_key text UNIQUE,external_reference text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.jenios_pay_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 product_id uuid NOT NULL REFERENCES public.jenios_pay_products(id),status text NOT NULL,
 current_period_start timestamptz,current_period_end timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.jenios_pay_payments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.jenios_pay_orders(id),
 provider text NOT NULL,provider_payment_id text,payment_method text NOT NULL,amount_cents bigint NOT NULL,
 status text NOT NULL,confirmed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_payment_id)
);
GRANT SELECT,INSERT,UPDATE ON public.jenios_pay_products,public.jenios_pay_orders,public.jenios_pay_subscriptions,public.jenios_pay_payments TO service_role;
