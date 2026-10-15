-- Executar manualmente no SQL Editor do Supabase antes de usar o formulário.
create table if not exists public.jenios_specialist_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nome text not null default '', cargo text not null default '',
 especialidades text not null default '', experiencia text not null default '',
 certificacoes text not null default '', youtube text not null default '',
 sobre text not null default '', updated_at timestamptz not null default now(),
 constraint jenios_specialist_nome_len check (char_length(nome)<=300),
 constraint jenios_specialist_cargo_len check (char_length(cargo)<=300),
 constraint jenios_specialist_especialidades_len check (char_length(especialidades)<=300),
 constraint jenios_specialist_experiencia_len check (char_length(experiencia)<=1200),
 constraint jenios_specialist_certificacoes_len check (char_length(certificacoes)<=300),
 constraint jenios_specialist_youtube_len check (char_length(youtube)<=300),
 constraint jenios_specialist_sobre_len check (char_length(sobre)<=1200)
);
alter table public.jenios_specialist_profiles enable row level security;
revoke all on public.jenios_specialist_profiles from anon;
grant select,insert,update on public.jenios_specialist_profiles to authenticated;
drop policy if exists jenios_specialist_self_select on public.jenios_specialist_profiles;
drop policy if exists jenios_specialist_self_insert on public.jenios_specialist_profiles;
drop policy if exists jenios_specialist_self_update on public.jenios_specialist_profiles;
create policy jenios_specialist_self_select on public.jenios_specialist_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy jenios_specialist_self_insert on public.jenios_specialist_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy jenios_specialist_self_update on public.jenios_specialist_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
