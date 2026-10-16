begin;
create table if not exists public.jenios_whale_events (
 id text primary key check(id ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz not null,
 amount_btc numeric(24,8) not null check(amount_btc>=100 and amount_btc<=21000000),
 first_seen_at timestamptz not null default now()
);
alter table public.jenios_whale_events enable row level security;
revoke all on public.jenios_whale_events from public,anon,authenticated;
grant select,insert on public.jenios_whale_events to service_role;
create index if not exists jenios_whale_recent on public.jenios_whale_events(occurred_at desc,id desc);
commit;
