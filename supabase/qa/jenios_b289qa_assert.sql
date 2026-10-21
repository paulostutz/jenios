-- Read only QA verification, execute ONLY in rebzztxlzofxpfwjvbee.
select
 (select count(*) from auth.users) as auth_users,
 (select count(*) from public.jenios_pay_orders) as orders,
 (select count(*) from public.jenios_pay_payments) as payments,
 (select count(*) from public.jenios_pay_subscriptions) as subscriptions,
 (select count(*) from public.jenios_pay_entitlements) as entitlements,
 (select count(*) from public.jenios_learning_state) as learners,
 (select count(*) from public.jenios_pay_products where category='platform') as platform_plan_count,
 (select count(*) from public.jenios_pay_products where category='platform' and active) as enabled_plan_count,
 has_table_privilege('anon','public.jenios_pay_orders','INSERT') as anon_can_insert_order,
 has_table_privilege('authenticated','public.jenios_pay_subscriptions','UPDATE') as auth_can_change_subscription,
 has_table_privilege('service_role','public.jenios_pay_products','SELECT') as service_can_read_catalog;
