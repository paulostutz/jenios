create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from vault.secrets where name='jenios_trend_job_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'jenios_trend_job_token','Credencial interna de execução do radar JENIOS');
 end if;
 insert into jenios_private.trend_job(id,token_hash) select true,encode(extensions.digest(decrypted_secret,'sha256'),'hex') from vault.decrypted_secrets where name='jenios_trend_job_token' on conflict(id) do nothing;
end;$$;
create or replace function jenios_private.run_trend_job() returns bigint language plpgsql security invoker set search_path='' as $$
declare target text; token text; request_id bigint;
begin
 select endpoint into target from jenios_private.trend_job where id=true;
 if target is null or target !~ '^https://jenios-ecossistem-[a-z0-9-]+-jenios\.vercel\.app/api/internal/trend-alerts$' then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='jenios_trend_job_token';
 select net.http_post(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=45000) into request_id;
 return request_id;
end;$$;
revoke all on function jenios_private.run_trend_job() from public,anon,authenticated,service_role;
select cron.schedule('jenios-trend-alerts','*/3 * * * *','select jenios_private.run_trend_job();');
