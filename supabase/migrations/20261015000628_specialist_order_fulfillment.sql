-- Additive extension. Review/apply in homologation before enabling the feature.
-- No modifications to PAY orders, webhook handlers, payments or subscriptions.
begin;

create table public.jenios_specialist_orders (
  order_id uuid primary key references public.jenios_pay_orders(id),
  buyer_id uuid not null,
  seller_id uuid not null check (seller_id <> buyer_id),
  offer_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  amount_cents bigint not null check (amount_cents > 0),
  commission_cents bigint not null check (commission_cents = round(amount_cents::numeric / 10)),
  seller_amount_cents bigint not null check (seller_amount_cents = amount_cents - commission_cents),
  state text not null default 'pending' check (state in ('pending','accepted','scheduled','delivered','completed','declined')),
  scheduled_at timestamptz,
  meeting_url text check (length(meeting_url) <= 1500),
  delivery_note text not null default '' check (length(delivery_note) <= 2000),
  revision integer not null default 0 check (revision >= 0),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array' and jsonb_array_length(history) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jenios_specialist_orders_buyer_idx on public.jenios_specialist_orders (buyer_id,created_at desc,order_id);
create index jenios_specialist_orders_seller_idx on public.jenios_specialist_orders (seller_id,created_at desc,order_id);
alter table public.jenios_specialist_orders enable row level security;
revoke all on table public.jenios_specialist_orders from public,anon,authenticated;
grant select on table public.jenios_specialist_orders to authenticated;
grant all on table public.jenios_specialist_orders to service_role;
create policy specialist_order_participants_read on public.jenios_specialist_orders
  for select to authenticated using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

-- Only backend service_role can execute. SECURITY INVOKER never grants privilege.
-- Locks the financial order before the service row: a concurrent refund must
-- serialize with this action. Financial rows are read/locked, never updated.
create function public.jenios_specialist_order_action(
  p_order_id uuid, p_actor_id uuid, p_expected_revision integer, p_action text,
  p_scheduled_at timestamptz default null, p_meeting_url text default null,
  p_delivery_note text default ''
) returns setof public.jenios_specialist_orders
language plpgsql security invoker set search_path = pg_catalog,public
as $$
declare
  financial public.jenios_pay_orders%rowtype;
  service public.jenios_specialist_orders%rowtype;
  actor_role text;
  next_state text;
begin
  select * into financial from public.jenios_pay_orders where id = p_order_id for update;
  select * into service from public.jenios_specialist_orders where order_id = p_order_id for update;
  if service.order_id is null or financial.id is null or p_actor_id is null
    or (p_actor_id <> service.buyer_id and p_actor_id <> service.seller_id)
    or financial.user_id is distinct from service.buyer_id or financial.amount_cents is distinct from service.amount_cents
    or financial.currency is distinct from 'BRL' then
    raise exception 'Atendimento não encontrado' using errcode = 'P0002';
  end if;
  if financial.status is distinct from 'paid' then
    raise exception 'Pagamento não confirmado' using errcode = '42501';
  end if;
  if service.revision is distinct from p_expected_revision then
    raise exception 'Revisão obsoleta' using errcode = '40001';
  end if;
  actor_role := case when p_actor_id = service.seller_id then 'seller' else 'buyer' end;
  if actor_role = 'seller' and p_action = 'accept' and service.state = 'pending' then next_state := 'accepted';
  elsif actor_role = 'seller' and p_action = 'decline' and service.state in ('pending','accepted') then next_state := 'declined';
  elsif actor_role = 'seller' and p_action = 'schedule' and service.state in ('accepted','scheduled') then next_state := 'scheduled';
  elsif actor_role = 'seller' and p_action = 'deliver' and service.state in ('accepted','scheduled') then next_state := 'delivered';
  elsif actor_role = 'buyer' and p_action = 'complete' and service.state = 'delivered' then next_state := 'completed';
  else raise exception 'Transição não permitida' using errcode = '42501';
  end if;
  if jsonb_array_length(service.history) >= 100 then
    raise exception 'Limite de eventos atingido' using errcode = '22023';
  end if;
  if p_action = 'schedule' and (p_scheduled_at is null or p_scheduled_at <= now()
    or p_scheduled_at > now() + interval '366 days'
    or (p_meeting_url is not null and (length(p_meeting_url) > 1500 or p_meeting_url !~ '^https://[^/@[:space:]?#]+([/?#].*)?$'))) then
    raise exception 'Agendamento inválido' using errcode = '22023';
  end if;
  if p_action in ('decline','deliver') and (p_delivery_note is null or length(btrim(p_delivery_note)) < 10 or length(btrim(p_delivery_note)) > 2000) then
    raise exception 'Descrição inválida' using errcode = '22023';
  end if;
  return query update public.jenios_specialist_orders set
    state = next_state,
    scheduled_at = case when p_action = 'schedule' then p_scheduled_at else service.scheduled_at end,
    meeting_url = case when p_action = 'schedule' then p_meeting_url else service.meeting_url end,
    delivery_note = case when p_action in ('decline','deliver') then btrim(p_delivery_note) else service.delivery_note end,
    revision = service.revision + 1,
    history = service.history || jsonb_build_array(jsonb_build_object('action',p_action,'role',actor_role,'at',now())),
    updated_at = now()
  where order_id = p_order_id returning *;
end;
$$;
revoke all on function public.jenios_specialist_order_action(uuid,uuid,integer,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.jenios_specialist_order_action(uuid,uuid,integer,text,timestamptz,text,text) to service_role;

commit;
