-- JENIOS B289-QA: strictly isolated server-only financial preflight.
-- Apply only to Supabase rebzztxlzofxpfwjvbee (JENIOS Social homologacao).
-- Requires the canonical migration 20261012_jenios_pay_v1.sql and R26 learning.
-- Creates ZERO users, ZERO orders, ZERO payment receipts, ZERO subscriptions, ZERO charges.
begin;
revoke all on public.jenios_pay_products,public.jenios_pay_orders,
 public.jenios_pay_payments,public.jenios_pay_subscriptions,
 public.jenios_pay_webhook_events,public.jenios_pay_entitlements
 from public,anon,authenticated;
grant select on public.jenios_pay_products,public.jenios_pay_orders,
 public.jenios_pay_payments,public.jenios_pay_subscriptions,
 public.jenios_pay_entitlements to authenticated;
grant select,insert,update,delete on public.jenios_pay_products,
 public.jenios_pay_orders,public.jenios_pay_payments,
 public.jenios_pay_subscriptions,public.jenios_pay_webhook_events,
 public.jenios_pay_entitlements to service_role;
alter table public.jenios_pay_products enable row level security;
alter table public.jenios_pay_orders enable row level security;
alter table public.jenios_pay_payments enable row level security;
alter table public.jenios_pay_subscriptions enable row level security;
alter table public.jenios_pay_webhook_events enable row level security;
alter table public.jenios_pay_entitlements enable row level security;
-- Display-only QA catalog, never active for checkout, never actual charge.
insert into public.jenios_pay_products
 (code,name,category,description,price_cents,currency,billing_type,active)
values
 ('platform-nacional','Nacional — B3','platform','QA somente: acesso mensal Nacional em homologação, cobrança desativada.',9990,'BRL','monthly',false),
 ('platform-global-crypto','Global Crypto — B3 e Cripto','platform','QA somente: plano avançado em homologação, cobrança desativada.',14990,'BRL','monthly',false),
 ('platform-internacional-pro','Internacional Pro','platform','QA somente: plano internacional em homologação, cobrança desativada.',19990,'BRL','monthly',false)
on conflict(code) do nothing;
-- Zero access for visitor / browser to private learner state and budget.
revoke all on public.jenios_learning_state from public,anon,authenticated;
grant select,insert,update,delete on public.jenios_learning_state to service_role;
alter table public.jenios_learning_state enable row level security;
create or replace view public.jenios_b289qa_catalog_inspection
 with (security_invoker=true) as
 select code,price_cents,billing_type,active from public.jenios_pay_products
 where category='platform' and code in
 ('platform-nacional','platform-global-crypto','platform-internacional-pro');
revoke all on public.jenios_b289qa_catalog_inspection from public,anon,authenticated;
grant select on public.jenios_b289qa_catalog_inspection to service_role;
comment on view public.jenios_b289qa_catalog_inspection is
 'B289 QA evidence only; inactive catalog does not authorize customer charges or subscriptions';
commit;