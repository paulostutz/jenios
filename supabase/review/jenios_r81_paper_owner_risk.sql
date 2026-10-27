-- JENIOS R81: Platform-only PAPER owner risk authorization and atomic permit registration.
-- Review stage. No live broker transport, no withdrawals, no customer accounts or orders created.
-- Project xaicvhagftzjkqphnbgx only. Never install in Social/CHEFE/LETTER.
create table if not exists public.jenios_robot_paper_risk_audit_r81 (
  audit_id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.jenios_platform_demo_broker_connections(id) on delete restrict,
  action text not null check (action in ('PAPER_RISK_OWNER_APPROVED')),
  account_digest text not null check (account_digest ~ '^[a-f0-9]{64}$'),
  max_notional_units text not null check (max_notional_units ~ '^[1-9][0-9]{0,25}$'),
  currency text not null check (currency = 'USD'),
  risk_expires_at timestamptz not null,
  revision bigint not null check (revision > 0),
  source text not null check (source='PLATFORM_OWNER_SERVER_VERIFIED'),
  created_at timestamptz not null default statement_timestamp()
);
create index if not exists jenios_r81_paper_risk_owner_idx
 on public.jenios_robot_paper_risk_audit_r81(owner_user_id,connection_id,created_at);
alter table public.jenios_robot_paper_risk_audit_r81 enable row level security;
revoke all on public.jenios_robot_paper_risk_audit_r81 from public,anon,authenticated,service_role;
grant select,insert on public.jenios_robot_paper_risk_audit_r81 to service_role;
grant usage,select on sequence public.jenios_robot_paper_risk_audit_r81_audit_id_seq to service_role;

-- An uninitialized connection is PAUSED. No implicit permission or financial default.
create or replace function public.jenios_r81_initialize_paper_safety(
 p_owner_user_id uuid,p_connection_id uuid
) returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare v_revision bigint;
begin
 insert into public.jenios_robot_paper_safety_r80(owner_user_id,connection_id)
 select c.user_id,c.id
 from public.jenios_platform_demo_broker_connections c
 where c.user_id=p_owner_user_id and c.id=p_connection_id
   and c.provider='alpaca' and c.environment='paper'
   and c.status='active' and c.identity_verified is true
   and c.external_digest ~ '^[a-f0-9]{64}$'
   and c.last_sync_at between statement_timestamp()-interval '5 minutes' and statement_timestamp()
 on conflict (owner_user_id,connection_id) do nothing;
 select s.revision into v_revision
 from public.jenios_robot_paper_safety_r80 s
 where s.owner_user_id=p_owner_user_id and s.connection_id=p_connection_id;
 return v_revision;
end $$;
revoke all on function public.jenios_r81_initialize_paper_safety(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.jenios_r81_initialize_paper_safety(uuid,uuid) to service_role;

-- Compare-and-swap prevents a stale request from re-arming after a concurrent KILL.
-- Owner identity MUST be verified by the private Platform service using db.auth.getUser.
create or replace function public.jenios_r81_activate_paper_owner_risk(
 p_owner_user_id uuid,p_connection_id uuid,p_expected_revision bigint,
 p_account_digest text,p_max_notional_units text,p_expires_at timestamptz,
 p_currency text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_revision bigint; v_now timestamptz := statement_timestamp();
begin
 if p_expected_revision is null or p_expected_revision<=0
  or p_account_digest is null or p_account_digest !~ '^[a-f0-9]{64}$'
  or p_currency is distinct from 'USD'
  or p_max_notional_units is null
  or p_max_notional_units !~ '^[1-9][0-9]{0,25}$'
  or p_expires_at is null or p_expires_at<=v_now+interval '2 minutes'
  or p_expires_at>v_now+interval '1 hour'
 then return false; end if;
 update public.jenios_robot_paper_safety_r80 as s
 set status='ACTIVE',kill_switch_engaged=false,paper_consent_enabled=true,
     live_execution_enabled=false,max_notional_units=p_max_notional_units,
     risk_approved_at=v_now,risk_expires_at=p_expires_at,
     approval_source='PLATFORM_OWNER_SERVER_VERIFIED',
     revision=s.revision+1,updated_at=v_now
 from public.jenios_platform_demo_broker_connections c
 where s.owner_user_id=p_owner_user_id and s.connection_id=p_connection_id
   and s.revision=p_expected_revision
   and s.status='PAUSED' and s.kill_switch_engaged=true
   and c.id=s.connection_id and c.user_id=s.owner_user_id
   and c.provider='alpaca' and c.environment='paper'
   and c.status='active' and c.identity_verified is true
   and c.external_digest=p_account_digest
   and c.last_sync_at between v_now-interval '5 minutes' and v_now
 returning s.revision into v_revision;
 if v_revision is null then return false; end if;
 insert into public.jenios_robot_paper_risk_audit_r81 (
  owner_user_id,connection_id,action,account_digest,max_notional_units,
  currency,risk_expires_at,revision,source
 ) values (
  p_owner_user_id,p_connection_id,'PAPER_RISK_OWNER_APPROVED',p_account_digest,
  p_max_notional_units,'USD',p_expires_at,v_revision,'PLATFORM_OWNER_SERVER_VERIFIED'
 );
 return true;
end $$;
revoke all on function public.jenios_r81_activate_paper_owner_risk(
 uuid,uuid,bigint,text,text,timestamptz,text
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r81_activate_paper_owner_risk(
 uuid,uuid,bigint,text,text,timestamptz,text
) to service_role;

-- Signer returns no permit unless this transaction rechecks PAPER account,
-- owner, active risk and KILL under the same safety row lock as R80 KILL/R79 CLAIM.
create or replace function public.jenios_r81_register_signed_paper_permit(
 p_approval_id uuid,p_owner_user_id uuid,p_connection_id uuid,
 p_account_digest text,p_client_order_id text,p_permit_sha256 text,
 p_issued_at timestamptz,p_expires_at timestamptz,p_notional_units text,
 p_currency text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_now timestamptz:=statement_timestamp();
begin
 if p_approval_id is null or p_owner_user_id is null or p_connection_id is null
   or p_account_digest is null or p_account_digest !~ '^[a-f0-9]{64}$'
   or p_permit_sha256 is null or p_permit_sha256 !~ '^[a-f0-9]{64}$'
   or p_client_order_id is null
   or length(p_client_order_id) not between 1 and 96
   or p_client_order_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
   or p_currency is distinct from 'USD'
   or p_notional_units is null or p_notional_units !~ '^[1-9][0-9]{0,25}$'
   or p_issued_at is null or p_issued_at < v_now-interval '30 seconds'
   or p_issued_at > v_now+interval '5 seconds'
   or p_expires_at is null or p_expires_at<=v_now
   or p_expires_at>p_issued_at+interval '2 minutes'
 then return false; end if;

 perform 1 from public.jenios_robot_paper_safety_r80 s
 join public.jenios_platform_demo_broker_connections c
   on c.id=s.connection_id and c.user_id=s.owner_user_id
 where s.owner_user_id=p_owner_user_id and s.connection_id=p_connection_id
  and s.status='ACTIVE' and s.kill_switch_engaged=false
  and s.paper_consent_enabled=true and s.live_execution_enabled=false
  and s.approval_source='PLATFORM_OWNER_SERVER_VERIFIED'
  and s.risk_approved_at <= v_now and s.risk_expires_at > p_expires_at
  and s.max_notional_units ~ '^[1-9][0-9]{0,25}$'
  and p_notional_units::numeric <= s.max_notional_units::numeric
  and c.provider='alpaca' and c.environment='paper'
  and c.status='active' and c.identity_verified is true
  and c.external_digest=p_account_digest
  and c.last_sync_at between v_now-interval '5 minutes' and v_now
 for update of s;
 if not found then return false; end if;
 insert into public.jenios_robot_paper_approvals_r79(
  approval_id,owner_user_id,connection_id,client_order_id,permit_sha256,
  issued_at,expires_at,source,status
 ) values (p_approval_id,p_owner_user_id,p_connection_id,p_client_order_id,
   p_permit_sha256,p_issued_at,p_expires_at,'PLATFORM_AUTH_SERVER_VERIFIED','APPROVED');
 return true;
end $$;
revoke all on function public.jenios_r81_register_signed_paper_permit(
 uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,text,text
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r81_register_signed_paper_permit(
 uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,text,text
) to service_role;
