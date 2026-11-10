-- Dedicated Platform database only. No execution permission or broker credential.
create table public.jenios_ultra_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 config jsonb not null check (jsonb_typeof(config)='object'),
 assessment jsonb not null check (jsonb_typeof(assessment)='object'),
 review_digest text not null check (review_digest ~ '^[a-f0-9]{64}$'),
 risk_acknowledged boolean not null default false,
 policy_version text not null,
 created_at timestamptz not null default now()
);
create index jenios_ultra_plans_owner_time on public.jenios_ultra_plans(user_id,created_at desc);
alter table public.jenios_ultra_plans enable row level security;
revoke all on public.jenios_ultra_plans from public,anon,authenticated,service_role;
grant select,insert on public.jenios_ultra_plans to service_role;

-- Closed operations confirmed by an authorized collector. Never browser-supplied fills.
create table public.jenios_ultra_trades (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 connection_ref text not null,
 broker_trade_id text not null,
 market text not null check (market in ('b3','crypto','forex')),
 symbol text not null,
 currency text not null check(currency in ('BRL','USD','USDT','EUR')),
 side text not null check(side in ('buy','sell')),
 opened_at timestamptz not null,
 closed_at timestamptz not null check(closed_at>=opened_at),
 gross_realized numeric(28,8) not null,
 fees numeric(28,8) not null check(fees>=0),
 financing numeric(28,8) not null default 0,
 net_realized numeric(28,8) generated always as (gross_realized-fees-financing) stored,
 evidence_ref text not null check(length(evidence_ref)>0),
 unique(user_id,connection_ref,broker_trade_id)
);
create index jenios_ultra_trades_owner_close on public.jenios_ultra_trades(user_id,closed_at desc,id);
alter table public.jenios_ultra_trades enable row level security;
revoke all on public.jenios_ultra_trades from public,anon,authenticated,service_role;
grant select,insert on public.jenios_ultra_trades to service_role;

create function public.jenios_ultra_financial_report(p_user_id uuid,p_since timestamptz,p_until timestamptz,p_page integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
with all_trades as (
 select * from public.jenios_ultra_trades where user_id=p_user_id and closed_at<=p_until
), filtered as (
 select * from all_trades where p_since is null or closed_at>=p_since
), sums as (
 select currency,count(*) as operations,
 sum(greatest(net_realized,0)) as gains,sum(greatest(-net_realized,0)) as losses,
 sum(gross_realized) as gross,sum(fees) as fees,sum(financing) as financing,sum(net_realized) as net
 from filtered group by currency
), lifetime as (
 select currency,count(*) as operations,sum(greatest(net_realized,0)) as gains,
 sum(greatest(-net_realized,0)) as losses,sum(gross_realized) as gross,sum(fees) as fees,
 sum(financing) as financing,sum(net_realized) as net from all_trades group by currency
), days as (
 select (closed_at at time zone 'America/Bahia')::date as day,currency,count(*) as operations,
 sum(greatest(net_realized,0)) as gains,sum(greatest(-net_realized,0)) as losses,
 sum(net_realized) as net from filtered group by 1,2
), page as (
 select id,market,symbol,currency,side,opened_at,closed_at,gross_realized,fees,financing,net_realized
 from filtered order by closed_at desc,id limit 50 offset greatest(0,least(p_page,100000))*50
)
select jsonb_build_object(
 'totals',coalesce((select jsonb_agg(to_jsonb(sums) order by currency) from sums),'[]'::jsonb),
 'lifetime',coalesce((select jsonb_agg(to_jsonb(lifetime) order by currency) from lifetime),'[]'::jsonb),
 'days',coalesce((select jsonb_agg(to_jsonb(days) order by day desc,currency) from days),'[]'::jsonb),
 'operations',coalesce((select jsonb_agg(to_jsonb(page) order by closed_at desc,id) from page),'[]'::jsonb),
 'count',(select count(*) from filtered),'pageSize',50,'unrealized',null,'source','broker_confirmed'
); $$;
revoke all on function public.jenios_ultra_financial_report(uuid,timestamptz,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.jenios_ultra_financial_report(uuid,timestamptz,timestamptz,integer) to service_role;
