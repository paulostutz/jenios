-- JENIOS G48 — isolated Banco Inter Vault and Master setup.
-- No credential, order, payment or charge is created by this migration.
-- Install only in the JENIOS/Social database; never in CHEFE or LETTER.

do $$
begin
 if to_regnamespace('vault') is null
  or to_regprocedure('vault.create_secret(text,text,text)') is null
  or to_regprocedure('vault.update_secret(uuid,text,text,text)') is null then
  raise exception 'JENIOS_G48_VAULT_EXTENSION_REQUIRED';
 end if;
end $$;

create table if not exists public.jenios_inter_settings_b283(
 singleton boolean primary key default true check(singleton),
 secret_id uuid not null,
 client_id_suffix text not null check(length(client_id_suffix)=4),
 pix_key_suffix text not null check(length(pix_key_suffix) between 1 and 4),
 cert_fingerprint_sha256 text not null check(cert_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 cert_expires_at timestamptz not null,
 bank_authenticated boolean not null default false,
 configuration_version integer not null default 1 check(configuration_version>=1),
 updated_at timestamptz not null default now()
);
alter table public.jenios_inter_settings_b283 enable row level security;
revoke all on public.jenios_inter_settings_b283 from PUBLIC,anon,authenticated;
grant select,insert,update on public.jenios_inter_settings_b283 to service_role;

create table if not exists public.jenios_inter_setup_attempts_r40(
 action text primary key check(action in ('connect','test')),
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 3)
);
alter table public.jenios_inter_setup_attempts_r40 enable row level security;
revoke all on public.jenios_inter_setup_attempts_r40 from PUBLIC,anon,authenticated;
grant select,insert,update on public.jenios_inter_setup_attempts_r40 to service_role;

create or replace function public.jenios_inter_status_b283()
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.jenios_inter_settings_b283%rowtype;
begin
 select * into r from public.jenios_inter_settings_b283 where singleton=true;
 if not found then
  return jsonb_build_object('configured',false,'bankAuthenticated',false,'chargesEnabled',false,'status','not_configured');
 end if;
 return jsonb_build_object(
  'configured',true,'clientIdLast4',r.client_id_suffix,'pixKeyLast4',r.pix_key_suffix,
  'certificateExpiresAt',r.cert_expires_at,'fingerprintSha256',r.cert_fingerprint_sha256,
  'bankAuthenticated',r.bank_authenticated,'chargesEnabled',false,
  'configurationVersion',r.configuration_version,'updatedAt',r.updated_at,
  'status','configuration_saved_pending_payment_homologation'
 );
end $$;
revoke all on function public.jenios_inter_status_b283() from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_status_b283() to service_role;

create or replace function public.jenios_inter_store_b283(
 p_client_id text,p_client_secret text,p_certificate text,p_private_key text,
 p_pix_key text,p_account_number text,p_cert_fingerprint text,p_cert_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,vault as $$
declare r public.jenios_inter_settings_b283%rowtype; bundle jsonb; sid uuid;
begin
 if length(trim(coalesce(p_client_id,''))) not between 8 and 200
  or length(coalesce(p_client_secret,'')) not between 16 and 500
  or p_client_id ~ '[[:space:]]' or p_client_secret ~ '[[:cntrl:]]'
  or p_certificate not like '%-----BEGIN CERTIFICATE-----%'
  or (p_private_key not like '%-----BEGIN PRIVATE KEY-----%'
   and p_private_key not like '%-----BEGIN RSA PRIVATE KEY-----%'
   and p_private_key not like '%-----BEGIN EC PRIVATE KEY-----%')
  or length(p_certificate) not between 100 and 32768
  or length(p_private_key) not between 100 and 32768
  or length(trim(coalesce(p_pix_key,''))) not between 4 and 140
  or p_cert_fingerprint !~ '^[a-f0-9]{64}$'
  or p_cert_expires_at<=now() or p_cert_expires_at>now()+interval '4 years'
  or length(coalesce(p_account_number,''))>60
 then raise exception 'JENIOS_INTER_INVALID_MATERIAL' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 select * into r from public.jenios_inter_settings_b283 where singleton=true for update;
 bundle:=jsonb_build_object(
  'client_id',trim(p_client_id),'client_secret',p_client_secret,
  'certificate',p_certificate,'private_key',p_private_key,'pix_key',trim(p_pix_key),
  'account_number',coalesce(trim(p_account_number),''),
  'purpose','jenios_pix_configuration_only','schema_version','g48'
 );
 if not found then
  select vault.create_secret(bundle::text,'jenios_g48_inter_pix','JENIOS Inter Pix; isolated from CHEFE and LETTER') into sid;
  insert into public.jenios_inter_settings_b283(singleton,secret_id,client_id_suffix,pix_key_suffix,cert_fingerprint_sha256,cert_expires_at)
  values(true,sid,right(trim(p_client_id),4),right(trim(p_pix_key),4),p_cert_fingerprint,p_cert_expires_at);
 else
  perform vault.update_secret(r.secret_id,bundle::text,'jenios_g48_inter_pix','JENIOS Inter Pix; isolated from CHEFE and LETTER');
  update public.jenios_inter_settings_b283
   set client_id_suffix=right(trim(p_client_id),4),pix_key_suffix=right(trim(p_pix_key),4),
    cert_fingerprint_sha256=p_cert_fingerprint,cert_expires_at=p_cert_expires_at,
    bank_authenticated=false,configuration_version=configuration_version+1,updated_at=now()
   where singleton=true;
 end if;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_store_b283(text,text,text,text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_store_b283(text,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function public.jenios_inter_load_b283()
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public,vault as $$
declare sid uuid; decrypted jsonb;
begin
 select secret_id into sid from public.jenios_inter_settings_b283 where singleton=true;
 if sid is null then return null; end if;
 select decrypted_secret::jsonb into decrypted from vault.decrypted_secrets
  where id=sid and name='jenios_g48_inter_pix';
 if decrypted is null then raise exception 'JENIOS_INTER_VAULT_UNAVAILABLE'; end if;
 return decrypted;
end $$;
revoke all on function public.jenios_inter_load_b283() from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_load_b283() to service_role;

-- Durable shared limits include failed external authentication attempts.
create or replace function public.jenios_inter_claim_setup_attempt_r40(p_action text)
 returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 current_time_value timestamptz:=clock_timestamp();
 previous public.jenios_inter_setup_attempts_r40%rowtype;
 window_size interval; max_attempts integer;
begin
 if p_action is null or p_action not in ('connect','test') then return false; end if;
 window_size:=case when p_action='connect' then interval '1 minute' else interval '30 seconds' end;
 max_attempts:=case when p_action='connect' then 3 else 1 end;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-setup-attempt:'||p_action,0));
 select * into previous from public.jenios_inter_setup_attempts_r40 where action=p_action for update;
 if found and previous.window_started_at+window_size>current_time_value then
  if previous.attempts>=max_attempts then return false; end if;
  update public.jenios_inter_setup_attempts_r40 set attempts=attempts+1 where action=p_action;
 else
  insert into public.jenios_inter_setup_attempts_r40(action,window_started_at,attempts)
   values(p_action,current_time_value,1)
  on conflict(action) do update set window_started_at=excluded.window_started_at,attempts=1;
 end if;
 return true;
end $$;
revoke all on function public.jenios_inter_claim_setup_attempt_r40(text) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_claim_setup_attempt_r40(text) to service_role;

-- Called only after OAuth + a read-only Pix GET. The version lock prevents a
-- slow request from overwriting a credential rotation performed concurrently.
create or replace function public.jenios_inter_store_verified_r40(
 p_expected_version integer,p_client_id text,p_client_secret text,p_certificate text,
 p_private_key text,p_pix_key text,p_account_number text,p_cert_fingerprint text,
 p_cert_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_version integer;
begin
 if p_expected_version is null or p_expected_version<0
  or p_cert_fingerprint is null or p_cert_fingerprint !~ '^[a-f0-9]{64}$'
  or p_certificate is null or p_private_key is null or p_cert_expires_at is null
 then raise exception 'JENIOS_INTER_INVALID_MATERIAL' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 select configuration_version into current_version from public.jenios_inter_settings_b283 where singleton=true for update;
 if coalesce(current_version,0)<>p_expected_version then
  raise exception 'JENIOS_INTER_CONFIGURATION_CHANGED' using errcode='40001';
 end if;
 perform public.jenios_inter_store_b283(p_client_id,p_client_secret,p_certificate,p_private_key,p_pix_key,p_account_number,p_cert_fingerprint,p_cert_expires_at);
 update public.jenios_inter_settings_b283 set bank_authenticated=true,updated_at=now()
  where singleton=true and configuration_version=p_expected_version+1 and cert_fingerprint_sha256=p_cert_fingerprint;
 if not found then raise exception 'JENIOS_INTER_CONFIGURATION_CHANGED' using errcode='40001'; end if;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_store_verified_r40(integer,text,text,text,text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_store_verified_r40(integer,text,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function public.jenios_inter_mark_auth_r40(p_expected_version integer,p_cert_fingerprint text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_expected_version is null or p_expected_version<1
  or p_cert_fingerprint is null or p_cert_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'JENIOS_INTER_INVALID_VERSION' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 update public.jenios_inter_settings_b283 set bank_authenticated=true,updated_at=now()
  where singleton=true and configuration_version=p_expected_version
   and cert_fingerprint_sha256=p_cert_fingerprint and cert_expires_at>now();
 if not found then raise exception 'JENIOS_INTER_CONFIGURATION_CHANGED' using errcode='40001'; end if;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_mark_auth_r40(integer,text) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_mark_auth_r40(integer,text) to service_role;

-- Compatibility function remains service-role only; G48 application code uses
-- the version/fingerprint-bound R40 function above.
create or replace function public.jenios_inter_mark_auth_b283(p_authenticated boolean)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.jenios_inter_settings_b283 set bank_authenticated=p_authenticated,updated_at=now() where singleton=true;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_mark_auth_b283(boolean) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_mark_auth_b283(boolean) to service_role;
