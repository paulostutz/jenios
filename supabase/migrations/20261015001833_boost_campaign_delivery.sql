-- Homologation first. Additive service extension; never updates PAY records.
begin;
create table public.jenios_boost_campaigns (
  order_id uuid primary key references public.jenios_pay_orders(id),
  owner_id uuid not null,
  post_id uuid not null, -- no FK: preserve the existing right to delete a post
  target jsonb not null check (jsonb_typeof(target)='object' and target ?& array['postId','dailyCents','days','objective','country','region','city']),
  amount_cents bigint not null check (amount_cents>0),
  state text not null default 'pending' check (state in ('pending','active','paused','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  revision integer not null default 0 check (revision>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((target->>'postId')::uuid=post_id),
  check ((target->>'dailyCents')::integer between 1000 and 1000000),
  check ((target->>'days')::integer between 1 and 365),
  check (amount_cents=(target->>'dailyCents')::bigint*(target->>'days')::integer),
  check (target->>'objective' in ('profile','website','whatsapp','copy')),
  check (length(btrim(target->>'country')) between 1 and 80),
  check ((state='pending' and starts_at is null and ends_at is null) or (state='cancelled') or (starts_at is not null and ends_at>starts_at))
);
create index jenios_boost_owner_idx on public.jenios_boost_campaigns(owner_id,created_at desc,order_id);
create index jenios_boost_active_idx on public.jenios_boost_campaigns(ends_at) where state='active';
alter table public.jenios_boost_campaigns enable row level security;
revoke all on public.jenios_boost_campaigns from public,anon,authenticated;
grant select on public.jenios_boost_campaigns to authenticated;
grant all on public.jenios_boost_campaigns to service_role;
create policy boost_owner_read on public.jenios_boost_campaigns for select to authenticated using ((select auth.uid())=owner_id);

create table public.jenios_boost_events (
  order_id uuid not null references public.jenios_boost_campaigns(order_id) on delete cascade,
  viewer_id uuid not null,
  event_day date not null default ((now() at time zone 'UTC')::date),
  kind text not null check (kind in ('impression','click')),
  created_at timestamptz not null default now(),
  primary key(order_id,viewer_id,event_day,kind)
);
alter table public.jenios_boost_events enable row level security;
revoke all on public.jenios_boost_events from public,anon,authenticated;
grant all on public.jenios_boost_events to service_role;

create function public.jenios_boost_action(p_order_id uuid,p_actor_id uuid,p_expected_revision integer,p_action text)
returns setof public.jenios_boost_campaigns language plpgsql security invoker set search_path=pg_catalog,public as $$
declare financial public.jenios_pay_orders%rowtype; campaign public.jenios_boost_campaigns%rowtype; next_state text;
begin
  select * into financial from public.jenios_pay_orders where id=p_order_id for update;
  select * into campaign from public.jenios_boost_campaigns where order_id=p_order_id for update;
  if campaign.order_id is null or campaign.owner_id is distinct from p_actor_id or financial.user_id is distinct from p_actor_id
    or financial.amount_cents is distinct from campaign.amount_cents or financial.currency is distinct from 'BRL' then raise exception 'Not found' using errcode='P0002'; end if;
  if financial.status is distinct from 'paid' then raise exception 'Payment not confirmed' using errcode='42501'; end if;
  if campaign.revision is distinct from p_expected_revision then raise exception 'Stale revision' using errcode='40001'; end if;
  if campaign.ends_at<=now() or campaign.state='cancelled' then raise exception 'Campaign ended' using errcode='42501'; end if;
  if p_action='cancel' then next_state:='cancelled';
  elsif p_action='start' and campaign.state='pending' then next_state:='active';
  elsif p_action='pause' and campaign.state='active' then next_state:='paused';
  elsif p_action='resume' and campaign.state='paused' then next_state:='active';
  else raise exception 'Invalid action' using errcode='42501'; end if;
  if next_state='active' and not exists(select 1 from public.posts where id=campaign.post_id and author_id=campaign.owner_id) then raise exception 'Post unavailable' using errcode='42501'; end if;
  return query update public.jenios_boost_campaigns set state=next_state,
    starts_at=case when p_action='start' then now() else campaign.starts_at end,
    ends_at=case when p_action='start' then now()+(campaign.target->>'days')::integer*interval '1 day' else campaign.ends_at end,
    revision=campaign.revision+1,updated_at=now() where order_id=p_order_id returning *;
end; $$;

create function public.jenios_boost_candidates(p_viewer_id uuid,p_country text,p_region text,p_city text)
returns setof public.jenios_boost_campaigns language sql security invoker set search_path=pg_catalog,public as $$
  select c.* from public.jenios_boost_campaigns c
  join public.jenios_pay_orders o on o.id=c.order_id and o.user_id=c.owner_id and o.amount_cents=c.amount_cents and o.currency='BRL' and o.status='paid'
  join public.posts p on p.id=c.post_id and p.author_id=c.owner_id
  where c.state='active' and c.starts_at<=now() and c.ends_at>now() and c.owner_id<>p_viewer_id
    and btrim(p_country)<>'' and lower(btrim(c.target->>'country'))=lower(btrim(p_country))
    and (btrim(c.target->>'region')='' or lower(btrim(c.target->>'region'))=lower(btrim(p_region)))
    and (btrim(c.target->>'city')='' or lower(btrim(c.target->>'city'))=lower(btrim(p_city)))
    and not exists(select 1 from public.user_blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=c.owner_id) or (b.blocker_id=c.owner_id and b.blocked_id=p_viewer_id))
  order by -ln(greatest(random(),0.000000001))/(c.target->>'dailyCents')::numeric limit 5;
$$;

create function public.jenios_boost_event(p_order_id uuid,p_viewer_id uuid,p_revision integer,p_kind text)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare financial public.jenios_pay_orders%rowtype; campaign public.jenios_boost_campaigns%rowtype; affected integer;
begin
  select * into financial from public.jenios_pay_orders where id=p_order_id for share;
  select * into campaign from public.jenios_boost_campaigns where order_id=p_order_id for share;
  if p_viewer_id is null or campaign.order_id is null or p_viewer_id=campaign.owner_id or financial.status is distinct from 'paid'
    or financial.user_id is distinct from campaign.owner_id or financial.amount_cents is distinct from campaign.amount_cents or financial.currency is distinct from 'BRL'
    or campaign.state<>'active' or campaign.starts_at>now() or campaign.ends_at<=now() or campaign.revision is distinct from p_revision
    or p_kind is null or p_kind not in ('impression','click') then return false; end if;
  if not exists(select 1 from public.posts where id=campaign.post_id and author_id=campaign.owner_id)
    or exists(select 1 from public.user_blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=campaign.owner_id) or (b.blocker_id=campaign.owner_id and b.blocked_id=p_viewer_id)) then return false; end if;
  -- A click also establishes an impression. Both deduplicate per account/day UTC.
  insert into public.jenios_boost_events(order_id,viewer_id,kind) values(p_order_id,p_viewer_id,'impression') on conflict do nothing;
  if p_kind='click' then insert into public.jenios_boost_events(order_id,viewer_id,kind) values(p_order_id,p_viewer_id,'click') on conflict do nothing; end if;
  get diagnostics affected=row_count;
  return affected>0;
end; $$;

create function public.jenios_boost_metrics(p_owner_id uuid,p_order_ids uuid[])
returns table(order_id uuid,impressions bigint,clicks bigint) language sql security invoker set search_path=pg_catalog,public as $$
  select c.order_id,count(e.order_id) filter(where e.kind='impression'),count(e.order_id) filter(where e.kind='click')
  from public.jenios_boost_campaigns c left join public.jenios_boost_events e on e.order_id=c.order_id
  where c.owner_id=p_owner_id and c.order_id=any(p_order_ids) and cardinality(p_order_ids)<=30 group by c.order_id;
$$;
revoke all on function public.jenios_boost_action(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.jenios_boost_candidates(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.jenios_boost_event(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.jenios_boost_metrics(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.jenios_boost_action(uuid,uuid,integer,text) to service_role;
grant execute on function public.jenios_boost_candidates(uuid,text,text,text) to service_role;
grant execute on function public.jenios_boost_event(uuid,uuid,integer,text) to service_role;
grant execute on function public.jenios_boost_metrics(uuid,uuid[]) to service_role;
commit;
