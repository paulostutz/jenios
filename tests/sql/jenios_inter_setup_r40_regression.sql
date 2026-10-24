-- Isolated QA only, before real Inter setup. All synthetic rows/Vault material
-- are rolled back. Refuse to run if a configuration already exists.
begin;
do $$
begin
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 if exists(select 1 from public.jenios_inter_settings_b283) or
  exists(select 1 from public.jenios_inter_setup_attempts_r40)
 then raise exception 'R40 regression requires an unused QA setup'; end if;
end $$;
set local role service_role;
do $$
declare
 result jsonb;
 certificate_value text:='-----BEGIN CERTIFICATE-----'||repeat('A',150);
 private_key_value text:='-----BEGIN PRIVATE KEY-----'||repeat('B',150);
 expires_value timestamptz:=now()+interval '1 day';
begin
 if public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('connect') is distinct from false
 then raise exception 'Connect rate limit failed'; end if;
 if public.jenios_inter_claim_setup_attempt_r40('test') is distinct from true or
  public.jenios_inter_claim_setup_attempt_r40('test') is distinct from false or
  public.jenios_inter_claim_setup_attempt_r40(null) is distinct from false or
  public.jenios_inter_claim_setup_attempt_r40('save') is distinct from false
 then raise exception 'Retest or invalid action rate limit failed'; end if;

 result:=public.jenios_inter_store_verified_r40(0,'r40-synthetic-client','r40-synthetic-secret-value',
  certificate_value,private_key_value,'r40-synthetic-pix','',repeat('a',64),expires_value);
 if result->>'configured' is distinct from 'true' or
  result->>'bankAuthenticated' is distinct from 'true' or
  result->>'configurationVersion' is distinct from '1' or
  result->>'chargesEnabled' is distinct from 'false'
 then raise exception 'Atomic initial verified store failed'; end if;

 begin
  perform public.jenios_inter_store_verified_r40(0,'r40-synthetic-other','r40-synthetic-secret-other',
   certificate_value,private_key_value,'r40-synthetic-pix','',repeat('b',64),expires_value);
  raise exception 'Stale writer was accepted';
 exception when serialization_failure then null;
 end;
 begin
  perform public.jenios_inter_mark_auth_r40(1,repeat('b',64));
  raise exception 'Wrong fingerprint was accepted';
 exception when serialization_failure then null;
 end;
 result:=public.jenios_inter_mark_auth_r40(1,repeat('a',64));
 if result->>'configurationVersion' is distinct from '1' or
  result->>'bankAuthenticated' is distinct from 'true'
 then raise exception 'Matching retest failed'; end if;

 result:=public.jenios_inter_store_verified_r40(1,'r40-synthetic-rotated','r40-synthetic-secret-rotated',
  certificate_value,private_key_value,'r40-synthetic-pix','',repeat('b',64),expires_value);
 if result->>'configurationVersion' is distinct from '2' or
  result->>'fingerprintSha256' is distinct from repeat('b',64)
 then raise exception 'Credential rotation failed'; end if;
 begin
  perform public.jenios_inter_mark_auth_r40(1,repeat('a',64));
  raise exception 'Stale retest was accepted';
 exception when serialization_failure then null;
 end;
 begin
  perform public.jenios_inter_store_verified_r40(2,'r40-synthetic-invalid','r40-synthetic-secret-invalid',
   null,private_key_value,'r40-synthetic-pix','',repeat('c',64),expires_value);
  raise exception 'Null certificate was accepted';
 exception when invalid_parameter_value then null;
 end;
 result:=public.jenios_inter_status_b283();
 if result->>'configurationVersion' is distinct from '2' or
  result->>'fingerprintSha256' is distinct from repeat('b',64)
 then raise exception 'A rejected write changed the configuration'; end if;
end $$;
rollback;
select
 (select count(*) from public.jenios_inter_settings_b283) as settings_after_rollback,
 (select count(*) from public.jenios_inter_setup_attempts_r40) as attempts_after_rollback;
