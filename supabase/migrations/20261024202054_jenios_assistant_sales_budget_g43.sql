-- JENIOS G43: commercial support budget only; selectively reuses approved B282.
-- No Inter/Vault, payment, email or trading schema changes. Default app gates remain off.
BEGIN;
create table if not exists public.jenios_sales_budget_b282(
 month text primary key check(month ~ '^[0-9]{4}-[0-9]{2}$'),
 reserved_micro_usd bigint not null default 0 check(reserved_micro_usd>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.jenios_sales_visitor_b282(
 month text not null,visitor_hash text not null check(visitor_hash ~ '^[a-f0-9]{64}$'),
 hour text not null check(hour ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$'),
 calls integer not null default 0 check(calls between 0 and 12),
 primary key(month,visitor_hash,hour)
);
alter table public.jenios_sales_budget_b282 enable row level security;
alter table public.jenios_sales_visitor_b282 enable row level security;
revoke all on public.jenios_sales_budget_b282,public.jenios_sales_visitor_b282 from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.jenios_sales_budget_b282,public.jenios_sales_visitor_b282 to service_role;
create or replace function public.jenios_sales_budget_hold_b282(
 p_month text,p_visitor_hash text,p_hour text,p_amount_micro_usd bigint,p_limit_micro_usd bigint
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare n integer; used bigint;
begin
 if p_month is null or p_hour is null or p_visitor_hash is null or p_amount_micro_usd is null or p_limit_micro_usd is null
  or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  or p_hour !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3])$'
  or p_month<>to_char(now() at time zone 'UTC','YYYY-MM')
  or p_hour<>to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24')
  or left(p_hour,7)<>p_month or p_visitor_hash !~ '^[a-f0-9]{64}$'
  or p_amount_micro_usd<>20000 or p_limit_micro_usd<1000000 or p_limit_micro_usd>1000000000
 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-sales-budget:'||p_month,0));
 select coalesce(reserved_micro_usd,0) into used from public.jenios_sales_budget_b282 where month=p_month;
 if coalesce(used,0)+p_amount_micro_usd>p_limit_micro_usd then return false;end if;
 select coalesce(calls,0) into n from public.jenios_sales_visitor_b282 where month=p_month and visitor_hash=p_visitor_hash and hour=p_hour;
 if coalesce(n,0)>=12 then return false;end if;
 insert into public.jenios_sales_budget_b282(month,reserved_micro_usd) values(p_month,p_amount_micro_usd)
 on conflict(month) do update set reserved_micro_usd=jenios_sales_budget_b282.reserved_micro_usd+excluded.reserved_micro_usd,updated_at=now();
 insert into public.jenios_sales_visitor_b282(month,visitor_hash,hour,calls) values(p_month,p_visitor_hash,p_hour,1)
 on conflict(month,visitor_hash,hour) do update set calls=jenios_sales_visitor_b282.calls+1;
 return true;
end $$;
revoke all on function public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint) to service_role;


COMMIT;
