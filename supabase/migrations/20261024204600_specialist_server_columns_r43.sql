-- R43: restore only the columns used by the existing authenticated server API.
-- Public catalog output is filtered through publicSpecialist; write identity is
-- obtained from requirePayUser, never from the submitted profile's user_id.
-- No grant to anon/authenticated, no RLS or policy changes, no DELETE privilege.
grant select (user_id,nome,cargo,especialidades,experiencia,certificacoes,youtube,sobre,updated_at)
 on public.jenios_specialist_profiles to service_role;
grant insert (user_id,nome,cargo,especialidades,experiencia,certificacoes,youtube,sobre,updated_at)
 on public.jenios_specialist_profiles to service_role;
grant update (user_id,nome,cargo,especialidades,experiencia,certificacoes,youtube,sobre,updated_at)
 on public.jenios_specialist_profiles to service_role;
