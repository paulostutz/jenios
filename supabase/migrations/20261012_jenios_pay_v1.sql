
-- JENIOS PAY V1
-- Estrutura financeira inicial
-- Valores monetarios armazenados em centavos.
-- Execute apenas uma vez no projeto Supabase correto.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Catalogo centralizado
CREATE TABLE IF NOT EXISTS public.jenios_pay_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'platform', 'bankscore', 'ads',
      'crypto_validator', 'other'
    )
  ),
  description text,
  price_cents bigint NOT NULL DEFAULT 0
    CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL'
    CHECK (currency = 'BRL'),
  billing_type text NOT NULL DEFAULT 'one_time'
    CHECK (billing_type IN ('one_time', 'monthly', 'yearly')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Pedidos
CREATE TABLE IF NOT EXISTS public.jenios_pay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL
    REFERENCES public.jenios_pay_products(id),
  amount_cents bigint NOT NULL
    CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL'
    CHECK (currency = 'BRL'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'awaiting_payment', 'paid',
      'cancelled', 'expired', 'refunded'
    )),
  provider text NOT NULL DEFAULT 'inter',
  external_reference text UNIQUE,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Pagamentos
CREATE TABLE IF NOT EXISTS public.jenios_pay_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.jenios_pay_orders(id),
  provider text NOT NULL DEFAULT 'inter',
  provider_payment_id text,
  payment_method text NOT NULL
    CHECK (payment_method IN ('pix', 'boleto', 'credits')),
  amount_cents bigint NOT NULL
    CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'confirmed', 'failed',
      'cancelled', 'refunded'
    )),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

-- 4. Assinaturas
CREATE TABLE IF NOT EXISTS public.jenios_pay_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL
    REFERENCES public.jenios_pay_products(id),
  latest_order_id uuid
    REFERENCES public.jenios_pay_orders(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'active', 'past_due',
      'cancelled', 'expired'
    )),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Eventos recebidos do banco
CREATE TABLE IF NOT EXISTS public.jenios_pay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'inter',
  event_key text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received', 'processing',
      'processed', 'rejected', 'failed'
    )),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);

-- 6. Liberacao dos produtos adquiridos
CREATE TABLE IF NOT EXISTS public.jenios_pay_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL
    REFERENCES public.jenios_pay_products(id),
  order_id uuid NOT NULL UNIQUE
    REFERENCES public.jenios_pay_orders(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'active', 'revoked', 'expired'
    )),
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Indices
CREATE INDEX IF NOT EXISTS idx_jpay_orders_user
  ON public.jenios_pay_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jpay_payments_order
  ON public.jenios_pay_payments(order_id);

CREATE INDEX IF NOT EXISTS idx_jpay_subscriptions_user
  ON public.jenios_pay_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_jpay_entitlements_user
  ON public.jenios_pay_entitlements(user_id);

-- 8. Row Level Security
ALTER TABLE public.jenios_pay_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pay_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pay_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pay_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pay_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_pay_entitlements ENABLE ROW LEVEL SECURITY;

-- Produtos ativos podem ser consultados por usuarios
-- autenticados. Administracao permanece no servidor.
CREATE POLICY "jpay_products_read"
ON public.jenios_pay_products
FOR SELECT TO authenticated
USING (active = true);

-- Usuarios consultam apenas os proprios pedidos.
CREATE POLICY "jpay_orders_read"
ON public.jenios_pay_orders
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Usuarios consultam pagamentos de seus pedidos.
CREATE POLICY "jpay_payments_read"
ON public.jenios_pay_payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jenios_pay_orders o
    WHERE o.id = order_id
      AND o.user_id = (select auth.uid())
  )
);

-- Usuarios consultam as proprias assinaturas.
CREATE POLICY "jpay_subscriptions_read"
ON public.jenios_pay_subscriptions
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Usuarios consultam suas liberacoes.
CREATE POLICY "jpay_entitlements_read"
ON public.jenios_pay_entitlements
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Nenhuma politica publica de INSERT, UPDATE ou DELETE.
-- Escritas financeiras serao feitas apenas pelo backend
-- autorizado, apos validacoes e conciliacao bancaria.
-- Eventos de webhook nao possuem acesso pelo cliente.
