-- Read-only, service-only check for the dedicated Alpaca authorization service.
-- No session, user, broker credential, financial permission or order is created.
begin;
create schema if not exists jenios_connect_private;
revoke all on schema jenios_connect_private from public,anon,authenticated;
grant usage on schema jenios_connect_private to service_role;

-- The definer is confined to a non-exposed schema and a boolean lookup.
-- The service verifies the same JWT with Auth.getUser before supplying its
-- subject/session_id. End-user roles cannot invoke either entry point.
create or replace function jenios_connect_private.r107_session_is_active(
 p_owner_user_id uuid,p_session_id uuid
) returns boolean language sql stable security definer set search_path=''
as $$
 select current_setting('role',true)='service_role'
  and p_owner_user_id is not null and p_session_id is not null
  and exists(select 1 from auth.sessions s
   where s.id=p_session_id and s.user_id=p_owner_user_id
    and (s.not_after is null or s.not_after>statement_timestamp()));
$$;
revoke all on function jenios_connect_private.r107_session_is_active(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function jenios_connect_private.r107_session_is_active(uuid,uuid) to service_role;

create or replace function public.jenios_r107_session_is_active(
 p_owner_user_id uuid,p_session_id uuid
) returns boolean language sql stable security invoker set search_path=''
as $$ select jenios_connect_private.r107_session_is_active(p_owner_user_id,p_session_id); $$;
revoke all on function public.jenios_r107_session_is_active(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.jenios_r107_session_is_active(uuid,uuid) to service_role;
comment on function public.jenios_r107_session_is_active(uuid,uuid) is
 'Service-only existence/expiry check after Auth.getUser. No session data or trading authority returned.';
commit;
