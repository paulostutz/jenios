-- R41: restore the existing administrative prerequisites on Social QA.
-- The R23 source also creates these tables; IF NOT EXISTS keeps a full replay
-- compatible. No Auth identity or application permissions are created here.
create table if not exists public.jenios_admin_permissions (
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check(permission in ('reports.run','finance.manage','permissions.manage')),
 granted_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(user_id,permission)
);
alter table public.jenios_admin_permissions enable row level security;
revoke all on public.jenios_admin_permissions from public,anon,authenticated,service_role;
grant select,insert,delete on public.jenios_admin_permissions to service_role;
create index if not exists jenios_admin_permissions_granted_by_r41_idx
 on public.jenios_admin_permissions(granted_by);

create table if not exists public.jenios_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 action text not null,
 target jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.jenios_admin_audit enable row level security;
revoke all on public.jenios_admin_audit from public,anon,authenticated,service_role;
grant select,insert on public.jenios_admin_audit to service_role;
create index if not exists jenios_admin_audit_actor_created_r41_idx
 on public.jenios_admin_audit(actor_id,created_at desc);
