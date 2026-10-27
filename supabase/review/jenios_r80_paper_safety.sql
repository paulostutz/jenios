-- R80 JENIOS Platform ONLY: fail-closed PAPER safety state and atomic kill.
-- Review SQL. No API credentials, real trading, orders, subscriptions or account rows.
-- Database target: xaicvhagftzjkqphnbgx. Never apply to Social/CHEFE/LETTER.
create table if not exists public.jenios_robot_paper_safety_r80 (
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 connection_id uuid not null references public.jenios_platform_demo_broker_connections(id) on delete restrict,
 status text not null default 'PAUSED' check (status in ('PAUSED','ACTIVE')),
 kill_switch_engaged boolean not null default true,
 paper_consent_enabled boolean not null default false,
 live_execution_enabled boolean not null default false check (live_execution_enabled = false),
 max_notional_units text check (max_notional_units ~ '^[1-9][0-9]{0,25}$'),
 risk_approved_at timestamptz,
 risk_expires_at timestamptz,
 approval_source text check (approval_source = 'PLATFORM_OWNER_SERVER_VERIFIED'),
 revision bigint not null default 1 check (revision > 0),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 primary key(owner_user_id,connection_id),
 constraint jenios_r80_active_requires_risk check (
   status <> 'ACTIVE' or (
    kill_switch_engaged = false and paper_consent_enabled = true and
    live_execution_enabled = false and max_notional_units is not null and
    risk_approved_at is not null and risk_expires_at is not null and
    risk_expires_at > risk_approved_at and approval_source = 'PLATFORM_OWNER_SERVER_VERIFIED'
   )
 )
);
create index if not exists jenios_r80_safety_connection_idx
 on public.jenios_robot_paper_safety_r80(connection_id);
alter table public.jenios_robot_paper_safety_r80 enable row level security;
revoke all on table public.jenios_robot_paper_safety_r80 from public,anon,authenticated,service_role;
grant select,insert,update on table public.jenios_robot_paper_safety_r80 to service_role;
comment on table public.jenios_robot_paper_safety_r80 is
 'Private service-role ONLY: paused by default; PAPER owner approval and financial limits required; LIVE prohibited.';

create or replace function public.jenios_r80_read_paper_safety(
 p_owner_user_id uuid,p_connection_id uuid
) returns table(
 owner_user_id uuid,connection_id uuid,status text,kill_switch_engaged boolean,
 paper_consent_enabled boolean,live_execution_enabled boolean,
 max_notional_units text,risk_approved_at timestamptz,risk_expires_at timestamptz,
 approval_source text,checked_at timestamptz
)
language sql security invoker set search_path = ''
as $$
 select s.owner_user_id,s.connection_id,s.status,s.kill_switch_engaged,
        s.paper_consent_enabled,s.live_execution_enabled,s.max_notional_units,
        s.risk_approved_at,s.risk_expires_at,s.approval_source,statement_timestamp()
 from public.jenios_robot_paper_safety_r80 s
 join public.jenios_platform_demo_broker_connections c
   on c.id=s.connection_id and c.user_id=s.owner_user_id
 where s.owner_user_id=p_owner_user_id and s.connection_id=p_connection_id
   and c.provider='alpaca' and c.environment='paper'
   and c.status='active' and c.identity_verified is true
   and c.external_digest ~ '^[a-f0-9]{64}$';
$$;
revoke all on function public.jenios_r80_read_paper_safety(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.jenios_r80_read_paper_safety(uuid,uuid) to service_role;

-- Owner-verified private service may PAUSE. Pausing never cancels accepted broker orders.
-- Row lock serializes with R79 claim below, revoking all still-unclaimed permits.
create or replace function public.jenios_r80_engage_paper_kill(
 p_owner_user_id uuid,p_connection_id uuid
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare affected integer;
begin
 insert into public.jenios_robot_paper_safety_r80(
  owner_user_id,connection_id,status,kill_switch_engaged,paper_consent_enabled,live_execution_enabled
 )
 select c.user_id,c.id,'PAUSED',true,false,false
 from public.jenios_platform_demo_broker_connections c
 where c.id=p_connection_id and c.user_id=p_owner_user_id
 on conflict (owner_user_id,connection_id) do update set
  status='PAUSED',kill_switch_engaged=true,paper_consent_enabled=false,
  revision=jenios_robot_paper_safety_r80.revision+1,
  updated_at=statement_timestamp();
 get diagnostics affected = row_count;
 if affected <> 1 then return false; end if;
 update public.jenios_robot_paper_approvals_r79 a
 set status='REVOKED',revoked_at=statement_timestamp()
 where a.owner_user_id=p_owner_user_id and a.connection_id=p_connection_id
   and a.status='APPROVED' and a.used_at is null and a.revoked_at is null;
 return true;
end $$;
revoke all on function public.jenios_r80_engage_paper_kill(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.jenios_r80_engage_paper_kill(uuid,uuid) to service_role;

-- Upgrade R79 claim to lock the SAME safety row as the kill switch.
-- If there is no armed, owner-approved, unexpired PAPER risk row, it returns ZERO.
-- Atomic DB serialization prevents claim-after-kill. It does not cancel an in-flight POST.
create or replace function public.jenios_r79_claim_paper_approval(
 p_approval_id uuid,p_owner_user_id uuid,p_connection_id uuid,
 p_client_order_id text,p_permit_sha256 text,p_expires_at timestamptz
) returns table(
 approval_id uuid,owner_user_id uuid,connection_id uuid,client_order_id text,
 permit_sha256 text,expires_at timestamptz,status text,revoked_at timestamptz,
 used_at timestamptz,source text
)
language plpgsql security invoker set search_path = ''
as $$
begin
 perform 1 from public.jenios_robot_paper_safety_r80 s
 where s.owner_user_id=p_owner_user_id and s.connection_id=p_connection_id
   and s.status='ACTIVE' and s.kill_switch_engaged=false
   and s.paper_consent_enabled=true and s.live_execution_enabled=false
   and s.risk_approved_at<=statement_timestamp()
   and s.risk_expires_at>statement_timestamp()
   and s.approval_source='PLATFORM_OWNER_SERVER_VERIFIED'
 for update of s;
 if not found then return; end if;
 return query
 with changed as (
  update public.jenios_robot_paper_approvals_r79 a
   set status='CLAIMED',used_at=statement_timestamp()
   where a.approval_id=p_approval_id and a.owner_user_id=p_owner_user_id
     and a.connection_id=p_connection_id and a.client_order_id=p_client_order_id
     and a.permit_sha256=p_permit_sha256 and a.expires_at=p_expires_at
     and a.status='APPROVED' and a.used_at is null and a.revoked_at is null
     and a.source='PLATFORM_AUTH_SERVER_VERIFIED'
     and a.issued_at<=statement_timestamp() and a.expires_at>statement_timestamp()
     and exists (
      select 1 from public.jenios_platform_demo_broker_connections c
      where c.id=a.connection_id and c.user_id=a.owner_user_id
        and c.provider='alpaca' and c.environment='paper'
        and c.status='active' and c.identity_verified is true
     )
   returning a.approval_id,a.owner_user_id,a.connection_id,a.client_order_id,
             a.permit_sha256,a.expires_at,a.status,a.revoked_at,a.used_at,a.source
 )
 select changed.approval_id,changed.owner_user_id,changed.connection_id,
        changed.client_order_id,changed.permit_sha256,changed.expires_at,
        changed.status,changed.revoked_at,changed.used_at,changed.source
 from changed;
end $$;
revoke all on function public.jenios_r79_claim_paper_approval(
 uuid,uuid,uuid,text,text,timestamptz
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r79_claim_paper_approval(
 uuid,uuid,uuid,text,text,timestamptz
) to service_role;
