-- JENIOS Platform — projeto exclusivo de HOMOLOGAÇÃO.
-- Não instalar em JENIOS Social, Chefe ou qualquer produção.
-- A API da Platform valida o usuário autenticado antes de usar service_role.
revoke all privileges on table public.jenios_platform_diagnostics from service_role;
revoke all privileges on table public.jenios_platform_risk_events from service_role;
grant select,insert on table public.jenios_platform_diagnostics to service_role;
grant select,insert on table public.jenios_platform_risk_events to service_role;

create table if not exists public.jenios_platform_admin_permissions (
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check(permission in ('platform.admin','platform.reports')),
 granted_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(user_id,permission)
);
alter table public.jenios_platform_admin_permissions enable row level security;
revoke all on table public.jenios_platform_admin_permissions from public,anon,authenticated,service_role;
grant select,insert,delete on table public.jenios_platform_admin_permissions to service_role;

create table if not exists public.jenios_platform_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 action text not null check(length(action) between 1 and 80),
 target jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.jenios_platform_admin_audit enable row level security;
revoke all on table public.jenios_platform_admin_audit from public,anon,authenticated,service_role;
grant select,insert on table public.jenios_platform_admin_audit to service_role;

comment on table public.jenios_platform_admin_permissions is
 'Permissoes exclusivas Platform. Nunca herdadas da JENIOS Social nem da JENIOS PAY.';
comment on table public.jenios_platform_admin_audit is
 'Auditoria append-only da Platform; nao equivale a registros financeiros reais.';
