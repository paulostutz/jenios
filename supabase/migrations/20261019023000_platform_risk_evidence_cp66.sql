-- R45-B66: não aplicar em bancos existentes. Requer banco exclusivo da Platform.
-- Evidências são produzidas SOMENTE por adaptador futuro de corretora/paper homologado.
create table if not exists public.jenios_platform_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_ref text not null check(length(external_ref) between 8 and 160),
  kind text not null check(kind in ('risk_block','closed_trade')),
  source text not null check(source in ('broker_confirmed','paper_confirmed')),
  observed_at timestamptz not null,
  verified_at timestamptz not null,
  realized_pnl_cents bigint,
  created_at timestamptz not null default now(),
  unique(user_id,external_ref),
  check (
    (kind='risk_block' and realized_pnl_cents is null)
    or (kind='closed_trade' and realized_pnl_cents is not null)
  )
);
alter table public.jenios_platform_risk_events enable row level security;
revoke all on public.jenios_platform_risk_events from public,anon,authenticated;
grant select,insert on public.jenios_platform_risk_events to service_role;
comment on table public.jenios_platform_risk_events is
'Evidencias imutaveis; bloqueio confirmado NAO equivale a valor financeiro evitado. Sem POST publico.';
