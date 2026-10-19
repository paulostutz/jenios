\set ON_ERROR_STOP on
-- Ensaio PostgreSQL descartável. Nunca rodar em bancos existentes da Social.
\i supabase/migrations/20261019113500_platform_dedicated_admin_roles_cp67r1.sql

do $$
declare table_name text; obj regclass;
begin
 foreach table_name in array array['jenios_platform_diagnostics','jenios_platform_risk_events',
  'jenios_platform_admin_permissions','jenios_platform_admin_audit'] loop
  obj=to_regclass('public.'||table_name);
  if obj is null then raise exception 'Missing Platform table: %',table_name; end if;
  if not (select relrowsecurity from pg_class where oid=obj) then
   raise exception 'RLS absent: %',table_name;
  end if;
  if has_table_privilege('authenticated',obj,'SELECT')
   or has_table_privilege('authenticated',obj,'INSERT')
   or has_table_privilege('anon',obj,'SELECT')
   or has_table_privilege('anon',obj,'INSERT') then
    raise exception 'Client role can access %',table_name;
  end if;
  if not has_table_privilege('service_role',obj,'SELECT')
    or not has_table_privilege('service_role',obj,'INSERT') then
    raise exception 'Service role missing privileges: %',table_name;
  end if;
 end loop;
 if has_table_privilege('service_role','public.jenios_platform_diagnostics','UPDATE')
 or has_table_privilege('service_role','public.jenios_platform_diagnostics','DELETE')
 or has_table_privilege('service_role','public.jenios_platform_risk_events','UPDATE')
 or has_table_privilege('service_role','public.jenios_platform_risk_events','DELETE')
 or has_table_privilege('service_role','public.jenios_platform_admin_audit','UPDATE')
 or has_table_privilege('service_role','public.jenios_platform_admin_audit','DELETE')
 then raise exception 'Immutable Platform record is mutable by service role';end if;
end $$;

set role service_role;
insert into public.jenios_platform_admin_permissions(user_id,permission)
values ('00000000-0000-4000-8000-000000000001','platform.reports');
do $$
declare found_count integer;
begin
 select count(*) into found_count from public.jenios_platform_admin_permissions
 where user_id='00000000-0000-4000-8000-000000000001';
 if found_count<>1 then raise exception 'Platform scoped role grant failed';end if;
end $$;
reset role;
select 'CP67R1_DEDICATED_PLATFORM_ROLE_ISOLATION_PASS' as result;
