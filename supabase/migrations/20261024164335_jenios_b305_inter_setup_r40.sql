-- JENIOS B305 R40. Apply to the isolated Social QA database first.
-- No credentials are populated here. No call to the bank or charge is made.
-- Settings/Vault material stays in the existing B283 schema and grants.

create table public.jenios_inter_setup_attempts_r40 (
 action text primary key check (action in ('connect','test')),
 window_started_at timestamptz not null,
 attempts integer not null check (attempts between 1 and 3)
);
alter table public.jenios_inter_setup_attempts_r40 enable row level security;
revoke all on public.jenios_inter_setup_attempts_r40 from PUBLIC,anon,authenticated;
grant select,insert,update on public.jenios_inter_setup_attempts_r40 to service_role;

-- Durable shared limits: up to three connect attempts per minute and one saved
-- connection test per 30 seconds, including failed external authentication.
create or replace function public.jenios_inter_claim_setup_attempt_r40(p_action text)
 returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 current_time_value timestamptz:=clock_timestamp();
 previous public.jenios_inter_setup_attempts_r40%rowtype;
 window_size interval;
 max_attempts integer;
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

-- Called only after the server has authenticated the supplied material via
-- OAuth + read-only GET. Compare-and-swap prevents a slow test from overwriting
-- a configuration saved concurrently. Vault save and authenticated state are
-- committed together, using the SAME lock as the existing B283 writer.
create or replace function public.jenios_inter_store_verified_r40(
 p_expected_version integer,p_client_id text,p_client_secret text,p_certificate text,
 p_private_key text,p_pix_key text,p_account_number text,p_cert_fingerprint text,
 p_cert_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_version integer;
begin
 if p_expected_version is null or p_expected_version<0 or
  p_cert_fingerprint is null or p_cert_fingerprint !~ '^[a-f0-9]{64}$' or
  p_certificate is null or p_private_key is null or p_cert_expires_at is null
 then raise exception 'JENIOS_INTER_INVALID_MATERIAL' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 select configuration_version into current_version
  from public.jenios_inter_settings_b283 where singleton=true for update;
 if coalesce(current_version,0)<>p_expected_version then
  raise exception 'JENIOS_INTER_CONFIGURATION_CHANGED' using errcode='40001';
 end if;
 perform public.jenios_inter_store_b283(p_client_id,p_client_secret,p_certificate,p_private_key,
  p_pix_key,p_account_number,p_cert_fingerprint,p_cert_expires_at);
 update public.jenios_inter_settings_b283 set bank_authenticated=true,updated_at=now()
  where singleton=true and configuration_version=p_expected_version+1
   and cert_fingerprint_sha256=p_cert_fingerprint;
 if not found then raise exception 'JENIOS_INTER_CONFIGURATION_CHANGED' using errcode='40001'; end if;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_store_verified_r40(integer,text,text,text,text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_store_verified_r40(integer,text,text,text,text,text,text,text,timestamptz) to service_role;

-- Retests only mark the exact snapshot consulted; rotation during a bank
-- request cannot mark the replacement credential bundle as authenticated.
create or replace function public.jenios_inter_mark_auth_r40(p_expected_version integer,p_cert_fingerprint text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_expected_version is null or p_expected_version<1 or
  p_cert_fingerprint is null or p_cert_fingerprint !~ '^[a-f0-9]{64}$'
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
