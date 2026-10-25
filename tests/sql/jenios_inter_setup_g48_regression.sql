-- G48 isolated regression. All synthetic metadata and fake Vault material are
-- transactional and rolled back. No Banco Inter endpoint is contacted.
begin;
do $$
begin
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-g48-regression',0));
 if exists(select 1 from public.jenios_inter_settings_b283)
  or exists(select 1 from public.jenios_inter_setup_attempts_r40)
  or exists(select 1 from vault.secrets where name='jenios_g48_inter_pix')
 then raise exception 'G48 regression requires an unused disposable setup'; end if;
end $$;
set local role service_role;
do $$
declare
 result jsonb; loaded jsonb;
 certificate_value text:='-----BEGIN CERTIFICATE-----'||repeat('A',150);
 private_key_value text:='-----BEGIN PRIVATE KEY-----'||repeat('B',150);
 expires_value timestamptz:=now()+interval '1 day';
begin
 if public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from false
 then raise exception 'G48 connect rate limit failed'; end if;
 if public.jenios_inter_claim_setup_attempt_r40('test') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('test') is distinct from false or
  public.jenios_inter_claim_setup_attempt_r40(null) is distinct from false or
  public.jenios_inter_claim_setup_attempt_r40('save') is distinct from false
 then raise exception 'G48 retest/invalid action rate limit failed'; end if;

 result:=public.jenios_inter_store_verified_r40(0,'g48-synthetic-client','g48-synthetic-secret-value',
  certificate_value,private_key_value,'g48-synthetic-pix','',repeat('a',64),expires_value);
 if result->>'configured' is distinct from 'true' or result->>'bankAuthenticated' is distinct from 'true'
  or result->>'configurationVersion' is distinct from '1' or result->>'chargesEnabled' is distinct from 'false'
 then raise exception 'G48 atomic initial verified store failed'; end if;
 loaded:=public.jenios_inter_load_b283();
 if loaded->>'purpose' is distinct from 'jenios_pix_configuration_only'
  or loaded->>'schema_version' is distinct from 'g48'
  or loaded->>'client_id' is distinct from 'g48-synthetic-client'
  or loaded->>'client_secret' is distinct from 'g48-synthetic-secret-value'
 then raise exception 'G48 Vault load mismatch'; end if;

 begin
  perform public.jenios_inter_store_verified_r40(0,'g48-synthetic-other','g48-synthetic-secret-other',
   certificate_value,private_key_value,'g48-synthetic-pix','',repeat('b',64),expires_value);
  raise exception 'G48 stale writer was accepted';
 exception when serialization_failure then null;
 end;
 begin
  perform public.jenios_inter_mark_auth_r40(1,repeat('b',64));
  raise exception 'G48 wrong fingerprint was accepted';
 exception when serialization_failure then null;
 end;
 result:=public.jenios_inter_mark_auth_r40(1,repeat('a',64));
 if result->>'configurationVersion' is distinct from '1' or result->>'bankAuthenticated' is distinct from 'true'
 then raise exception 'G48 matching retest failed'; end if;

 result:=public.jenios_inter_store_verified_r40(1,'g48-synthetic-rotated','g48-synthetic-secret-rotated',
  certificate_value,private_key_value,'g48-synthetic-pix','',repeat('b',64),expires_value);
 if result->>'configurationVersion' is distinct from '2' or result->>'fingerprintSha256' is distinct from repeat('b',64)
 then raise exception 'G48 credential rotation failed'; end if;
 begin
  perform public.jenios_inter_mark_auth_r40(1,repeat('a',64));
  raise exception 'G48 stale retest was accepted';
 exception when serialization_failure then null;
 end;
 begin
  perform public.jenios_inter_store_verified_r40(2,'g48-synthetic-invalid','g48-synthetic-secret-invalid',
   null,private_key_value,'g48-synthetic-pix','',repeat('c',64),expires_value);
  raise exception 'G48 null certificate was accepted';
 exception when invalid_parameter_value then null;
 end;
 result:=public.jenios_inter_status_b283();
 if result->>'configurationVersion' is distinct from '2' or result->>'fingerprintSha256' is distinct from repeat('b',64)
  or result ? 'client_secret' or result ? 'private_key' or result ? 'certificate'
 then raise exception 'G48 public projection changed or exposed a secret'; end if;
end $$;
rollback;
select jsonb_build_object(
 'settings_after_rollback',(select count(*) from public.jenios_inter_settings_b283),
 'attempts_after_rollback',(select count(*) from public.jenios_inter_setup_attempts_r40),
 'secrets_after_rollback',(select count(*) from vault.secrets where name='jenios_g48_inter_pix')
);
