-- JENIOS Platform B165-B169 — APENAS no Supabase exclusivo de homologação:
-- xaicvhagftzjkqphnbgx. NAO executar no banco Social ou producao sem aceite separado.
-- Supabase Auth da Platform valida o usuário em Node; somente service_role acessa esta tabela.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_platform_demo_broker_connections (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('binance','alpaca')),
 environment text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 credential_box jsonb,
 snapshot_box jsonb,
 external_digest text,
 identity_verified boolean NOT NULL DEFAULT false,
 position_count integer NOT NULL DEFAULT 0 CHECK (position_count BETWEEN 0 AND 5000),
 open_order_count integer NOT NULL DEFAULT 0 CHECK (open_order_count BETWEEN 0 AND 500),
 last_sync_at timestamptz,
 sync_lease_until timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
 last_error_code text,
 revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, provider, environment),
 CHECK ((provider='binance' AND environment='testnet') OR (provider='alpaca' AND environment='paper')),
 CHECK ((status='active' AND credential_box IS NOT NULL AND snapshot_box IS NOT NULL AND external_digest ~ '^[a-f0-9]{64}$')
        OR (status='revoked' AND credential_box IS NULL AND snapshot_box IS NULL AND external_digest IS NULL))
);
-- Keep owner+status lookups efficient without exposing either via client RLS.
CREATE INDEX IF NOT EXISTS jenios_demo_broker_owner_status_idx
 ON public.jenios_platform_demo_broker_connections (user_id,status,created_at DESC);
ALTER TABLE public.jenios_platform_demo_broker_connections ENABLE ROW LEVEL SECURITY;
-- No policies: deny all direct access even for authenticated, except service_role bypass.
REVOKE ALL PRIVILEGES ON TABLE public.jenios_platform_demo_broker_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jenios_platform_demo_broker_connections TO service_role;
-- Per-user/provider one-minute registration throttle, enforced atomically in Postgres.
CREATE TABLE IF NOT EXISTS public.jenios_platform_demo_broker_attempts (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('binance','alpaca')),
 claimed_at timestamptz NOT NULL,
 PRIMARY KEY (user_id,provider)
);
ALTER TABLE public.jenios_platform_demo_broker_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.jenios_platform_demo_broker_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jenios_platform_demo_broker_attempts TO service_role;
-- Invoker-only: service_role may claim an attempt; direct public clients may not call it.
CREATE OR REPLACE FUNCTION public.jenios_platform_demo_claim_attempt(p_user uuid,p_provider text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF p_provider NOT IN ('binance','alpaca') OR p_user IS NULL THEN RETURN FALSE; END IF;
 INSERT INTO public.jenios_platform_demo_broker_attempts AS prior (user_id,provider,claimed_at)
 VALUES (p_user,p_provider,clock_timestamp())
 ON CONFLICT (user_id,provider) DO UPDATE SET claimed_at=EXCLUDED.claimed_at
 WHERE prior.claimed_at < EXCLUDED.claimed_at - INTERVAL '60 seconds';
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jenios_platform_demo_claim_attempt(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_platform_demo_claim_attempt(uuid,text) TO service_role;
COMMENT ON TABLE public.jenios_platform_demo_broker_connections IS
 'JENIOS Platform ONLY: encrypted testnet/paper demo credentials and snapshots. Service role only; no execution of orders, trades or withdrawals.';
COMMIT;
