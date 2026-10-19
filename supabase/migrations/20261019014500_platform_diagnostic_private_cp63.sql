-- CP63: SOMENTE arquivo proposto para homologação.
-- NÃO executar em produção nem aplicar automaticamente.
-- O diagnóstico orienta um modo inicial; NÃO concede autorização de corretora.
create table if not exists public.jenios_platform_diagnostics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers smallint[] not null
    check (array_length(answers,1)=5 and array_position(answers,null) is null),
  timeframe text not null check (timeframe in ('RAPIDO','ESTRUTURADO','SWING')),
  initial_mode text not null check (initial_mode in ('manual','reversa')),
  scores jsonb not null,
  methodology text not null check (methodology='JENIOS-UX-2'),
  created_at timestamptz not null default now()
);
alter table public.jenios_platform_diagnostics enable row level security;
revoke all on public.jenios_platform_diagnostics from public,anon,authenticated;
grant select,insert on public.jenios_platform_diagnostics to service_role;
comment on table public.jenios_platform_diagnostics is
  'Laudos educacionais vinculados a auth.users; imutáveis na interface. Não autorizam execução real.';
