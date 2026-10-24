-- Social QA only, after the legitimate R41 Auth Admin bootstrap.
-- A real service-role audit insert is rolled back; Auth identities are read only.
begin;
select set_config('jenios.r41_actor',(
 select id::text from auth.users
 where raw_app_meta_data->>'jenios_master_bootstrap'='jenios_master_r41_20261024'
 and raw_app_meta_data->>'role'='master' and not is_anonymous
),true);
set local role service_role;
insert into public.jenios_admin_audit(actor_id,action,target)
values(current_setting('jenios.r41_actor')::uuid,'r41.rollback_probe','{"synthetic":true}'::jsonb);
rollback;
select jsonb_build_object(
 'rollback_complete',(select count(*)=0 from public.jenios_admin_audit where action='r41.rollback_probe'),
 'permissions_rows',(select count(*) from public.jenios_admin_permissions),
 'policies',(select count(*) from pg_policies where schemaname='public' and tablename in ('jenios_admin_permissions','jenios_admin_audit')),
 'tables',(select jsonb_agg(jsonb_build_object(
   'name',c.relname,'rls',c.relrowsecurity,
   'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
   'anon_insert',has_table_privilege('anon',c.oid,'INSERT'),
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
   'authenticated_insert',has_table_privilege('authenticated',c.oid,'INSERT'),
   'service_select',has_table_privilege('service_role',c.oid,'SELECT'),
   'service_insert',has_table_privilege('service_role',c.oid,'INSERT'),
   'service_update',has_table_privilege('service_role',c.oid,'UPDATE'),
   'service_delete',has_table_privilege('service_role',c.oid,'DELETE')
 )) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('jenios_admin_permissions','jenios_admin_audit'))
) as r41_regression;
