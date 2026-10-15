begin;
alter table public.jenios_pay_payments add column if not exists bank_end_to_end_id text;
create unique index if not exists jenios_pix_receipt_unique on public.jenios_pay_payments(bank_end_to_end_id) where bank_end_to_end_id is not null;
grant select,insert,update on public.jenios_pay_payments to service_role;
create or replace function public.jenios_confirm_inter_pix(p_order_id uuid,p_txid text,p_amount integer,p_end_to_end_id text,p_paid_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.jenios_pay_orders%rowtype; p public.jenios_pay_payments%rowtype;
begin
  select * into o from public.jenios_pay_orders where id=p_order_id for update;
  if not found or p_txid is null or p_amount is null or p_end_to_end_id is null or o.currency<>'BRL' or o.amount_cents<>p_amount or p_amount<=0 or o.status not in ('pending','awaiting_payment','paid')
    or p_txid<>replace(o.id::text,'-','') or p_end_to_end_id !~ '^E[a-zA-Z0-9]{31}$'
    or p_paid_at is null or p_paid_at<o.created_at-interval '5 minutes' or p_paid_at>now()+interval '5 minutes'
    or coalesce((o.external_reference::jsonb)->>'scope','')<>'social' then raise exception 'Payment does not match order'; end if;
  select * into p from public.jenios_pay_payments where order_id=o.id and provider='inter_pix' and provider_payment_id=p_txid for update;
  if not found or p.amount_cents<>p_amount or p.payment_method<>'pix' or p.status not in ('pending','confirmed') then raise exception 'Payment not found'; end if;
  if o.status='paid' then
    if p.status='confirmed' and p.bank_end_to_end_id=p_end_to_end_id then return; end if;
    raise exception 'Order already paid with another receipt';
  end if;
  if p.bank_end_to_end_id is not null and p.bank_end_to_end_id<>p_end_to_end_id then raise exception 'Receipt mismatch'; end if;
  update public.jenios_pay_payments set status='confirmed',bank_end_to_end_id=p_end_to_end_id,confirmed_at=p_paid_at,updated_at=now() where id=p.id;
  update public.jenios_pay_orders set status='paid',updated_at=now() where id=o.id;
end $$;
revoke all on function public.jenios_confirm_inter_pix(uuid,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.jenios_confirm_inter_pix(uuid,text,integer,text,timestamptz) to service_role;
commit;
