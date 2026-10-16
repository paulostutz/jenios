-- JENIOS Social V7 — STAGING REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Requires Supabase Auth and pgcrypto (gen_random_uuid).
-- Review against existing schema and test with two isolated accounts before execution.
begin;
create table if not exists public.jenios_social_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null default '' check (char_length(body) <= 10000),
 media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index if not exists jenios_social_posts_feed_idx on public.jenios_social_posts(created_at desc,id desc) where deleted_at is null;
create table if not exists public.jenios_social_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.jenios_social_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 parent_id uuid references public.jenios_social_comments(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists jenios_social_comments_post_idx on public.jenios_social_comments(post_id,created_at);
create table if not exists public.jenios_social_likes (
 post_id uuid not null references public.jenios_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (post_id,user_id)
);
-- Guard protected fields against authenticated UPDATE even if a client bypasses the API.
create or replace function public.jenios_social_posts_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
   raise exception 'protected post fields are immutable' using errcode = '42501';
 end if;
 if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
   raise exception 'deleted posts cannot be restored' using errcode = '42501';
 end if;
 new.updated_at = now();
 return new;
end;
$$;
drop trigger if exists jenios_social_posts_guard_trg on public.jenios_social_posts;
create trigger jenios_social_posts_guard_trg before update on public.jenios_social_posts
for each row execute function public.jenios_social_posts_guard();
alter table public.jenios_social_posts enable row level security;
alter table public.jenios_social_comments enable row level security;
alter table public.jenios_social_likes enable row level security;
drop policy if exists social_posts_public_read on public.jenios_social_posts;
create policy social_posts_public_read on public.jenios_social_posts for select to authenticated
using (deleted_at is null or author_id = (select auth.uid()));
drop policy if exists social_posts_author_insert on public.jenios_social_posts;
create policy social_posts_author_insert on public.jenios_social_posts for insert to authenticated
with check (author_id = (select auth.uid()) and deleted_at is null);
drop policy if exists social_posts_author_update on public.jenios_social_posts;
create policy social_posts_author_update on public.jenios_social_posts for update to authenticated
using (author_id = (select auth.uid()) and deleted_at is null)
with check (author_id = (select auth.uid()));
drop policy if exists social_posts_author_delete on public.jenios_social_posts;
-- Deletion is soft-delete through UPDATE only; direct DELETE has no policy.
drop policy if exists social_comments_read on public.jenios_social_comments;
create policy social_comments_read on public.jenios_social_comments for select to authenticated
using (exists (select 1 from public.jenios_social_posts p where p.id = post_id and p.deleted_at is null));
drop policy if exists social_comments_insert on public.jenios_social_comments;
create policy social_comments_insert on public.jenios_social_comments for insert to authenticated
with check (author_id = (select auth.uid()) and exists
 (select 1 from public.jenios_social_posts p where p.id = post_id and p.deleted_at is null)
 and (parent_id is null or exists
 (select 1 from public.jenios_social_comments c where c.id = parent_id and c.post_id = post_id and c.parent_id is null)));
drop policy if exists social_comments_delete on public.jenios_social_comments;
create policy social_comments_delete on public.jenios_social_comments for delete to authenticated
using (author_id = (select auth.uid()));
drop policy if exists social_likes_read on public.jenios_social_likes;
create policy social_likes_read on public.jenios_social_likes for select to authenticated
using (exists (select 1 from public.jenios_social_posts p where p.id = post_id and p.deleted_at is null));
drop policy if exists social_likes_insert on public.jenios_social_likes;
create policy social_likes_insert on public.jenios_social_likes for insert to authenticated
with check (user_id = (select auth.uid()) and exists
 (select 1 from public.jenios_social_posts p where p.id = post_id and p.deleted_at is null));
drop policy if exists social_likes_delete on public.jenios_social_likes;
create policy social_likes_delete on public.jenios_social_likes for delete to authenticated
using (user_id = (select auth.uid()));
-- This draft deliberately does not grant new privileges or run migrations.
commit;
