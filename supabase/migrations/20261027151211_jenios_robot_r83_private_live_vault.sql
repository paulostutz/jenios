-- JENIOS R83: private LIVE credential envelope storage only.
-- JENIOS Platform xaicvhagftzjkqphnbgx. No broker access, live orders, accounts,
-- bearer tokens or signing keys are created by this migration.
-- A separate authenticated private Node worker must verify the Platform owner.
create table if not exists public.jenios_robot_live_connections_r83 (
 id uuid primary key,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 provider text not null default 'alpaca' check (provider='alpaca'),
 environment text not null default 'live' check (environment='live'),
 credential_kind text not null check (
   credential_kind in ('ALPACA_API_KEY_PAIR','ALPACA_OAUTH_ACCESS_TOKEN')
 ),
 credential_box jsonb,
 status text not null default 'STAGED'
   check (status in ('STAGED','READ_VERIFIED','REVOKED')),
 identity_verified boolean not null default false,
 external_digest text check (external_digest ~ '^[a-f0-9]{64}$'),
 source text not null default 'JENIOS_R83_PRIVATE_OWNER_AUTH'
   check (source in ('JENIOS_R83_PRIVATE_OWNER_AUTH',
                    'JENIOS_PRIVATE_LIVE_VAULT_VERIFIED')),
 last_sync_at timestamptz,
 revision bigint not null default 1 check (revision>0),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 constraint jenios_r83_envelope_shape check (
   credential_box is null or (
    jsonb_typeof(credential_box)='object'
    and credential_box->>'v'='1'
    and credential_box->>'kind'=credential_kind
    and credential_box ?& array['kid','iv','tag','data']
    and not (credential_box ?| array['apiKey','secret','accessToken','password'])
   )
 ),
 constraint jenios_r83_verified_readonly_state check (
   (status='STAGED' and credential_box is not null and identity_verified=false
     and external_digest is null and last_sync_at is null
     and source='JENIOS_R83_PRIVATE_OWNER_AUTH')
   or
   (status='READ_VERIFIED' and credential_box is not null and identity_verified=true
     and external_digest is not null and last_sync_at is not null
     and source='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED')
   or
   (status='REVOKED' and credential_box is null and identity_verified=false
     and external_digest is null and last_sync_at is null)
 )
);
create index if not exists jenios_r83_live_owner_idx
 on public.jenios_robot_live_connections_r83(owner_user_id,status,created_at desc);
create unique index if not exists jenios_r83_live_owner_digest_idx
 on public.jenios_robot_live_connections_r83(owner_user_id,external_digest)
 where status='READ_VERIFIED';
alter table public.jenios_robot_live_connections_r83 enable row level security;
revoke all on public.jenios_robot_live_connections_r83
 from public,anon,authenticated,service_role;
grant select,insert,update on public.jenios_robot_live_connections_r83 to service_role;
comment on table public.jenios_robot_live_connections_r83 is
 'JENIOS private LIVE sealed credentials only. GET-only readiness; no trading permissions.';

-- A verified private service can bind the connection to the broker account
-- observed by an official GET; never trusts an account number sent by browser.
create or replace function public.jenios_r83_mark_live_read_verified(
 p_owner_user_id uuid,p_connection_id uuid,
 p_expected_revision bigint,p_external_digest text
) returns boolean
language sql security invoker set search_path=''
as $$
 with changed as (
  update public.jenios_robot_live_connections_r83 c
   set status='READ_VERIFIED',
       identity_verified=true,
       external_digest=p_external_digest,
       source='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED',
       last_sync_at=statement_timestamp(),
       updated_at=statement_timestamp(),
       revision=c.revision+1
  where c.id=p_connection_id and c.owner_user_id=p_owner_user_id
    and c.provider='alpaca' and c.environment='live'
    and c.status='STAGED'
    and c.identity_verified=false and c.external_digest is null
    and c.credential_box is not null
    and c.revision=p_expected_revision
    and p_external_digest ~ '^[a-f0-9]{64}$'
  returning c.id
 )
 select exists(select 1 from changed);
$$;
revoke all on function public.jenios_r83_mark_live_read_verified(
 uuid,uuid,bigint,text
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r83_mark_live_read_verified(
 uuid,uuid,bigint,text
) to service_role;

-- The private reader can update freshness only after GET and matching digest.
create or replace function public.jenios_r83_note_live_read(
 p_owner_user_id uuid,p_connection_id uuid,
 p_expected_revision bigint,p_external_digest text
) returns boolean
language sql security invoker set search_path=''
as $$
 with changed as (
  update public.jenios_robot_live_connections_r83 c
   set last_sync_at=statement_timestamp(),
       updated_at=statement_timestamp(),
       revision=c.revision+1
  where c.id=p_connection_id and c.owner_user_id=p_owner_user_id
    and c.status='READ_VERIFIED' and c.identity_verified=true
    and c.external_digest=p_external_digest
    and c.revision=p_expected_revision
    and p_external_digest ~ '^[a-f0-9]{64}$'
  returning c.id
 )
 select exists(select 1 from changed);
$$;
revoke all on function public.jenios_r83_note_live_read(
 uuid,uuid,bigint,text
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r83_note_live_read(
 uuid,uuid,bigint,text
) to service_role;

-- Revocation wins the row lock against pending verification or refresh, and
-- atomically destroys the saved encrypted credential box.
-- It does NOT invalidate provider tokens; user must also revoke with Alpaca.
create or replace function public.jenios_r83_revoke_live_connection(
 p_owner_user_id uuid,p_connection_id uuid
) returns boolean
language sql security invoker set search_path=''
as $$
 with changed as (
  update public.jenios_robot_live_connections_r83 c
   set status='REVOKED',
       credential_box=null,
       identity_verified=false,
       external_digest=null,
       last_sync_at=null,
       updated_at=statement_timestamp(),
       revision=c.revision+1
  where c.id=p_connection_id and c.owner_user_id=p_owner_user_id
    and c.status in ('STAGED','READ_VERIFIED')
  returning c.id
 )
 select exists(select 1 from changed);
$$;
revoke all on function public.jenios_r83_revoke_live_connection(
 uuid,uuid
) from public,anon,authenticated,service_role;
grant execute on function public.jenios_r83_revoke_live_connection(
 uuid,uuid
) to service_role;
