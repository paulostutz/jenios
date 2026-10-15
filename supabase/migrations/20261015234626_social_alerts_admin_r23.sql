create schema if not exists jenios_private;
revoke all on schema jenios_private from public,anon,authenticated;
grant usage on schema jenios_private to service_role;
create table public.jenios_admin_permissions (
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check(permission in ('reports.run','finance.manage','permissions.manage')),
 granted_by uuid references auth.users(id), created_at timestamptz not null default now(),
 primary key(user_id,permission)
);
alter table public.jenios_admin_permissions enable row level security;
revoke all on public.jenios_admin_permissions from public,anon,authenticated;
grant select,insert,delete on public.jenios_admin_permissions to service_role;
create table public.jenios_admin_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),
 action text not null,target jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.jenios_admin_audit enable row level security;
revoke all on public.jenios_admin_audit from public,anon,authenticated;
grant select,insert on public.jenios_admin_audit to service_role;
create table public.jenios_trend_subscriptions (
 user_id uuid not null references auth.users(id) on delete cascade,
 module text not null check(module in ('tokens','megapulse','baleias','novos')),
 created_at timestamptz not null default now(),last_notified_at timestamptz,
 primary key(user_id,module)
);
alter table public.jenios_trend_subscriptions enable row level security;
revoke all on public.jenios_trend_subscriptions from public,anon,authenticated;
grant select on public.jenios_trend_subscriptions to authenticated;
create policy trend_subscriptions_own on public.jenios_trend_subscriptions for select to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.jenios_trend_subscriptions to service_role;
create table jenios_private.trend_events(module text not null,event_key text not null,seen_at timestamptz not null default now(),primary key(module,event_key));
create table jenios_private.trend_modules(module text primary key,checked_at timestamptz not null default now());
create table jenios_private.trend_job(id boolean primary key default true check(id),token_hash text not null,endpoint text,last_claim timestamptz,last_success timestamptz);
alter table jenios_private.trend_events enable row level security;
alter table jenios_private.trend_modules enable row level security;
alter table jenios_private.trend_job enable row level security;
grant select,insert,update,delete on all tables in schema jenios_private to service_role;
revoke all on all tables in schema jenios_private from public,anon,authenticated;
grant insert on public.jenios_social_notifications to service_role;
create or replace function public.jenios_claim_trend_job(p_token text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update jenios_private.trend_job set last_claim=now() where id=true and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and (last_claim is null or last_claim<now()-interval '90 seconds');
 return found;
end;$$;
revoke all on function public.jenios_claim_trend_job(text) from public,anon,authenticated;
grant execute on function public.jenios_claim_trend_job(text) to service_role;
create or replace function public.jenios_publish_trend_events(p_module text,p_keys text[],p_title text,p_body text) returns integer language plpgsql security invoker set search_path='' as $$
declare seeded boolean; new_count integer; sent integer:=0;
begin
 if p_module not in ('tokens','megapulse','baleias','novos') or cardinality(p_keys)>100 or length(p_title)>120 or length(p_body)>500 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext('jenios_trend_'||p_module));
 select exists(select 1 from jenios_private.trend_modules where module=p_module) into seeded;
 with added as(insert into jenios_private.trend_events(module,event_key) select p_module,k from unnest(p_keys) k where length(k) between 1 and 200 on conflict do nothing returning 1) select count(*) into new_count from added;
 if seeded and new_count>0 then
  with recipients as(
   update public.jenios_trend_subscriptions set last_notified_at=now() where module=p_module and created_at<now() and (last_notified_at is null or last_notified_at<now()-interval '30 minutes') returning user_id
  ) insert into public.jenios_social_notifications(user_id,kind,title,body,target_url)
  select user_id,'trend',p_title,p_body,'/tendencias?modulo='||p_module from recipients;
  get diagnostics sent=row_count;
 end if;
 insert into jenios_private.trend_modules(module,checked_at) values(p_module,now()) on conflict(module) do update set checked_at=excluded.checked_at;
 update jenios_private.trend_job set last_success=now() where id=true;
 return sent;
end;$$;
revoke all on function public.jenios_publish_trend_events(text,text[],text,text) from public,anon,authenticated;
grant execute on function public.jenios_publish_trend_events(text,text[],text,text) to service_role;
