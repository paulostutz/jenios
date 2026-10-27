-- R79 JENIOS Platform only; auth-private, noncustodial Alpaca PAPER consent.
-- No customers, approvals, orders, secret keys, subscriptions or live trade created.
-- Apply only on project xaicvhagftzjkqphnbgx after peer review.
create table if not exists public.jenios_robot_paper_approvals_r79 (
 approval_id uuid primary key,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 connection_id uuid not null references public.jenios_platform_demo_broker_connections(id) on delete restrict,
 client_order_id text not null check (
  length(client_order_id) between 1 and 96 and
  client_order_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
 ),
 permit_sha256 text not null check (permit_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null,
 expires_at timestamptz not null,
 source text not null check (source = 'PLATFORM_AUTH_SERVER_VERIFIED'),
 status text not null default 'APPROVED'
  check (status in ('APPROVED','CLAIMED','REVOKED')),
 used_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 constraint jenios_r79_short_expiration check (
  expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'
 ),
 constraint jenios_r79_terminal_states check (
  (status = 'APPROVED' and used_at is null and revoked_at is null) or
  (status = 'CLAIMED' and used_at is not null and revoked_at is null) or
  (status = 'REVOKED' and revoked_at is not null and used_at is null)
 ),
 constraint jenios_r79_one_order_per_account unique (owner_user_id,connection_id,client_order_id)
);
create index if not exists jenios_r79_connection_fk_idx
 on public.jenios_robot_paper_approvals_r79(connection_id);
alter table public.jenios_robot_paper_approvals_r79 enable row level security;
revoke all on table public.jenios_robot_paper_approvals_r79 from public,anon,authenticated,service_role;
grant select,insert,update on table public.jenios_robot_paper_approvals_r79 to service_role;
comment on table public.jenios_robot_paper_approvals_r79 is
 'R79: PAPER approval only, protected by dedicated Platform service role; no live broker orders.';

-- Atomic consumption. DB clock is authoritative; the signed proof is
-- verified by the private Node worker before invoking this service-only RPC.
-- Parallel callers for the same approval contend on one UPDATE row lock and
-- at most one receives a row; none can automatically retry an uncertain POST.
create or replace function public.jenios_r79_claim_paper_approval(
 p_approval_id uuid,
 p_owner_user_id uuid,
 p_connection_id uuid,
 p_client_order_id text,
 p_permit_sha256 text,
 p_expires_at timestamptz
) returns table (
 approval_id uuid,
 owner_user_id uuid,
 connection_id uuid,
 client_order_id text,
 permit_sha256 text,
 expires_at timestamptz,
 status text,
 revoked_at timestamptz,
 used_at timestamptz,
 source text
)
language sql
security invoker
set search_path = ''
as $$
 with changed as (
  update public.jenios_robot_paper_approvals_r79 as a
   set status = 'CLAIMED', used_at = statement_timestamp()
   where a.approval_id = p_approval_id
     and a.owner_user_id = p_owner_user_id
     and a.connection_id = p_connection_id
     and a.client_order_id = p_client_order_id
     and a.permit_sha256 = p_permit_sha256
     and a.expires_at = p_expires_at
     and a.status = 'APPROVED'
     and a.used_at is null
     and a.revoked_at is null
     and a.source = 'PLATFORM_AUTH_SERVER_VERIFIED'
     and a.issued_at <= statement_timestamp()
     and a.expires_at > statement_timestamp()
     and exists (
      select 1 from public.jenios_platform_demo_broker_connections as c
      where c.id = a.connection_id
        and c.user_id = a.owner_user_id
        and c.provider = 'alpaca'
        and c.environment = 'paper'
        and c.status = 'active'
        and c.identity_verified is true
     )
   returning a.approval_id,a.owner_user_id,a.connection_id,
     a.client_order_id,a.permit_sha256,a.expires_at,
     a.status,a.revoked_at,a.used_at,a.source
 )
 select * from changed;
$$;
revoke all on function public.jenios_r79_claim_paper_approval(
 uuid,uuid,uuid,text,text,timestamptz
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r79_claim_paper_approval(
 uuid,uuid,uuid,text,text,timestamptz
) to service_role;

-- Revocation of a pending approval is possible only before CLAIMED.
-- A claimed approval must be manually reconciled with the external PAPER
-- broker; revocation does not pretend to cancel a broker order.
create or replace function public.jenios_r79_revoke_paper_approval(
 p_approval_id uuid,p_owner_user_id uuid
) returns boolean
language sql
security invoker
set search_path = ''
as $$
 with revoked as (
  update public.jenios_robot_paper_approvals_r79 as a
   set status = 'REVOKED', revoked_at = statement_timestamp()
   where a.approval_id = p_approval_id
     and a.owner_user_id = p_owner_user_id
     and a.status = 'APPROVED'
     and a.used_at is null and a.revoked_at is null
   returning a.approval_id
 )
 select exists(select 1 from revoked);
$$;
revoke all on function public.jenios_r79_revoke_paper_approval(
 uuid,uuid
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r79_revoke_paper_approval(
 uuid,uuid
) to service_role;

comment on function public.jenios_r79_claim_paper_approval(
 uuid,uuid,uuid,text,text,timestamptz
) is 'Strictly service_role; atomic approval claim before PAPER submission. No live order transport.';
