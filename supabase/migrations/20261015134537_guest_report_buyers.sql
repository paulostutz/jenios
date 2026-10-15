-- Staged only. Enable JENIOS_GUEST_REPORTS_ENABLED after gateway guest-order confirmation is tested.
begin;
alter table public.jenios_pay_orders add column if not exists guest_buyer_hash text;
alter table public.jenios_pay_orders alter column user_id drop not null;
alter table public.jenios_pay_orders add constraint jenios_order_buyer_identity check (
 (user_id is not null and guest_buyer_hash is null) or
 (user_id is null and guest_buyer_hash is not null and guest_buyer_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists jenios_order_guest_buyer on public.jenios_pay_orders(guest_buyer_hash) where user_id is null;
-- Existing RLS ownership remains: guest requests only use the server's verified cookie hash.
-- No anonymous table grant or browser policy is added.
commit;
