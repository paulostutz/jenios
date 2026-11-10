-- Dedicated JENIOS Platform database. Monitoring only; no broker credentials or commands.
create table public.jenios_ultra_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 80),
 provider text not null check(provider in ('profit','binance','mt5')),
 market text not null check(market in ('b3','crypto','forex')),
 environment text not null check(environment in ('demo','live')),
 connection_fingerprint text check(connection_fingerprint ~ '^[a-f0-9]{64}$'),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days'),
 revoked_at timestamptz,
 last_seen_at timestamptz,
 runtime_state text not null default 'idle' check(runtime_state in ('idle','monitoring','running','paused','reconciling','error')),
 check((provider='binance' and market='crypto') or (provider='profit' and market='b3') or (provider='mt5' and market in ('forex','b3')))
);
create unique index jenios_ultra_devices_active_account on public.jenios_ultra_devices(user_id,provider,environment,connection_fingerprint) where revoked_at is null and connection_fingerprint is not null;
create index jenios_ultra_devices_owner on public.jenios_ultra_devices(user_id,created_at desc);
alter table public.jenios_ultra_devices enable row level security;
revoke all on public.jenios_ultra_devices from public,anon,authenticated,service_role;
grant select,insert,update on public.jenios_ultra_devices to service_role;

create table public.jenios_ultra_operations (
 device_id uuid not null references public.jenios_ultra_devices(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id text not null,
 revision integer not null check(revision>0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 state text not null check(state in ('queued','sending','unknown','open','partially_closed','closed','cancelled','rejected')),
 currency text not null check(currency in ('BRL','USD','EUR','USDT')),
 created_at timestamptz not null,
 updated_at timestamptz not null,
 closed_at timestamptz,
 costs_complete boolean not null,
 gross numeric(28,8),fees numeric(28,8),financing numeric(28,8),
 net numeric(28,8) generated always as (case when state='closed' and costs_complete then gross-fees-financing else null end) stored,
 primary key(device_id,operation_id),
 check(updated_at>=created_at),
 check(not costs_complete or (gross is not null and fees is not null and financing is not null)),
 check(state<>'closed' or closed_at is not null)
);
create index jenios_ultra_operations_owner_time on public.jenios_ultra_operations(user_id,updated_at desc,operation_id);
create index jenios_ultra_operations_owner_close on public.jenios_ultra_operations(user_id,closed_at desc) where state='closed';
alter table public.jenios_ultra_operations enable row level security;
revoke all on public.jenios_ultra_operations from public,anon,authenticated,service_role;
grant select,insert,update on public.jenios_ultra_operations to service_role;

create table public.jenios_ultra_operation_events (
 device_id uuid not null references public.jenios_ultra_devices(id) on delete cascade,
 operation_id text not null,
 revision integer not null,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 primary key(device_id,operation_id,revision)
);
alter table public.jenios_ultra_operation_events enable row level security;
revoke all on public.jenios_ultra_operation_events from public,anon,authenticated,service_role;
grant select,insert on public.jenios_ultra_operation_events to service_role;

create function public.jenios_ultra_ingest(p_token_hash text,p_operations jsonb,p_runtime_state text,p_provider text,p_environment text,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.jenios_ultra_devices%rowtype; old public.jenios_ultra_operations%rowtype;
 o jsonb; prior jsonb; k text;
begin
 if p_runtime_state is null or p_operations is null or p_runtime_state not in ('idle','monitoring','running','paused','reconciling','error') or jsonb_typeof(p_operations)<>'array' or jsonb_array_length(p_operations)>100 then raise exception 'ULTRA_INVALID_BATCH'; end if;
 select * into d from public.jenios_ultra_devices where token_hash=p_token_hash and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'ULTRA_DEVICE_UNAUTHORIZED'; end if;
 if d.provider is distinct from p_provider or d.environment is distinct from p_environment or p_fingerprint !~ '^[a-f0-9]{64}$' or p_fingerprint is null or (d.connection_fingerprint is not null and d.connection_fingerprint<>p_fingerprint) then raise exception 'ULTRA_DEVICE_SCOPE'; end if;
 update public.jenios_ultra_devices set connection_fingerprint=p_fingerprint where id=d.id;
 for o in select value from jsonb_array_elements(p_operations) loop
  if o->>'market' is distinct from d.market or o->>'revision' is null or (o->>'revision')::integer<1 then raise exception 'ULTRA_DEVICE_SCOPE'; end if;
  select payload into prior from public.jenios_ultra_operation_events where device_id=d.id and operation_id=o->>'id' and revision=(o->>'revision')::integer;
  if found then
   if prior<>o then raise exception 'ULTRA_REVISION_CONFLICT'; end if;
   continue;
  end if;
  select * into old from public.jenios_ultra_operations where device_id=d.id and operation_id=o->>'id';
  if found then
   if (o->>'revision')::integer<=old.revision then raise exception 'ULTRA_OLD_REVISION'; end if;
   foreach k in array array['id','market','symbol','currency','side','createdAt','requestedQuantity'] loop
    if old.payload->k is distinct from o->k then raise exception 'ULTRA_IDENTITY_CHANGED'; end if;
   end loop;
   if old.state in ('closed','cancelled','rejected') and old.state<>o->>'state' then raise exception 'ULTRA_FINAL_STATE_CHANGED'; end if;
   if (o->>'entryQuantity')::numeric<(old.payload->>'entryQuantity')::numeric or (o->>'exitQuantity')::numeric<(old.payload->>'exitQuantity')::numeric or (o->>'updatedAt')::timestamptz<old.updated_at then raise exception 'ULTRA_EXECUTION_REGRESSED'; end if;
  end if;
  insert into public.jenios_ultra_operation_events(device_id,operation_id,revision,payload) values(d.id,o->>'id',(o->>'revision')::integer,o);
  insert into public.jenios_ultra_operations(device_id,user_id,operation_id,revision,payload,state,currency,created_at,updated_at,closed_at,costs_complete,gross,fees,financing)
  values(d.id,d.user_id,o->>'id',(o->>'revision')::integer,o,o->>'state',o->>'currency',(o->>'createdAt')::timestamptz,(o->>'updatedAt')::timestamptz,(o->>'closedAt')::timestamptz,(o->>'costsComplete')::boolean,(o->>'gross')::numeric,(o->>'fees')::numeric,(o->>'financing')::numeric)
  on conflict(device_id,operation_id) do update set revision=excluded.revision,payload=excluded.payload,state=excluded.state,updated_at=excluded.updated_at,closed_at=excluded.closed_at,costs_complete=excluded.costs_complete,gross=excluded.gross,fees=excluded.fees,financing=excluded.financing;
 end loop;
 update public.jenios_ultra_devices set last_seen_at=now(),runtime_state=p_runtime_state where id=d.id;
 return jsonb_build_object('ok',true,'accepted',jsonb_array_length(p_operations));
end; $$;
revoke all on function public.jenios_ultra_ingest(text,jsonb,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.jenios_ultra_ingest(text,jsonb,text,text,text,text) to service_role;

create function public.jenios_ultra_operations_report(p_user_id uuid,p_environment text,p_since timestamptz,p_until timestamptz,p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with owned as (
 select distinct on (coalesce(d.connection_fingerprint,d.id::text),o.operation_id) o.*,d.label,d.provider,d.environment from public.jenios_ultra_operations o join public.jenios_ultra_devices d on d.id=o.device_id
 where o.user_id=p_user_id and d.user_id=p_user_id and d.environment=p_environment and o.created_at<=p_until
 order by coalesce(d.connection_fingerprint,d.id::text),o.operation_id,o.revision desc,o.updated_at desc
), closed_all as (
 select * from owned where state='closed' and closed_at<=p_until and net is not null
), closed_period as (
 select * from closed_all where p_since is null or closed_at>=p_since
), listed as (
 select * from owned where p_since is null or coalesce(closed_at,created_at)>=p_since or state in ('sending','unknown','open','partially_closed')
), sums as (
 select currency,count(*) operations,sum(greatest(net,0))::text gains,sum(greatest(-net,0))::text losses,sum(gross)::text gross,sum(fees)::text fees,sum(financing)::text financing,sum(net)::text net from closed_period group by currency
), lifetime as (
 select currency,count(*) operations,sum(greatest(net,0))::text gains,sum(greatest(-net,0))::text losses,sum(gross)::text gross,sum(fees)::text fees,sum(financing)::text financing,sum(net)::text net from closed_all group by currency
), days as (
 select (closed_at at time zone 'America/Bahia')::date as "day",currency,count(*) operations,sum(greatest(net,0))::text gains,sum(greatest(-net,0))::text losses,sum(net)::text net from closed_period group by 1,2
), page as (
 select * from listed order by updated_at desc,device_id,operation_id limit 50 offset greatest(0,least(p_page,100000))*50
)
select jsonb_build_object(
 'totals',coalesce((select jsonb_agg(to_jsonb(sums) order by currency) from sums),'[]'::jsonb),
 'lifetime',coalesce((select jsonb_agg(to_jsonb(lifetime) order by currency) from lifetime),'[]'::jsonb),
 'days',coalesce((select jsonb_agg(to_jsonb(days) order by "day" desc,currency) from days),'[]'::jsonb),
 'operations',coalesce((select jsonb_agg(payload||jsonb_build_object('net',net::text,'deviceId',device_id,'deviceLabel',label,'provider',provider,'environment',environment) order by updated_at desc,device_id,operation_id) from page),'[]'::jsonb),
 'count',(select count(*) from listed),
 'awaitingCosts',(select count(*) from listed where state='closed' and net is null),
 'openCount',(select count(*) from owned where state in ('open','partially_closed')),
 'pageSize',50,'environment',p_environment,'source','trader_device','independentlyVerified',false
); $$;
revoke all on function public.jenios_ultra_operations_report(uuid,text,timestamptz,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.jenios_ultra_operations_report(uuid,text,timestamptz,timestamptz,integer) to service_role;
