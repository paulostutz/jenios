-- Batch likes without bypassing post visibility or the caller's RLS.
create or replace function public.jenios_social_post_stats(p_ids uuid[])
returns table(post_id uuid, count bigint, liked boolean)
language sql stable security invoker set search_path = '' as $$
  select p.id, count(l.user_id), coalesce(bool_or(l.user_id=(select auth.uid())),false)
  from public.posts p left join public.post_likes l on l.post_id=p.id
  where p.id = any(p_ids[1:50])
  group by p.id;
$$;
revoke all on function public.jenios_social_post_stats(uuid[]) from public, anon;
grant execute on function public.jenios_social_post_stats(uuid[]) to authenticated;

-- A shared Story references the original post, so removal/moderation still applies.
alter table public.stories add column if not exists shared_post_id uuid references public.posts(id) on delete cascade;
alter table public.stories drop constraint if exists stories_media_type_check;
alter table public.stories add constraint stories_media_type_check check(media_type in ('image','video','post'));
alter table public.stories alter column media_path drop not null;
alter table public.stories add constraint stories_shared_post_check check(
  (media_type='post' and shared_post_id is not null and media_path is null)
  or (media_type in ('image','video') and shared_post_id is null and media_path is not null)
);
create policy social_stories_shared_visible on public.stories as restrictive for select to authenticated
using (shared_post_id is null or exists (select 1 from public.posts p where p.id=shared_post_id));
create policy social_stories_shared_insert on public.stories as restrictive for insert to authenticated
with check (shared_post_id is null or exists (select 1 from public.posts p where p.id=shared_post_id));

-- The server controls both timestamps; callers cannot extend public visibility.
create or replace function public.jenios_stamp_story_lifetime()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.created_at := now();
  new.expires_at := new.created_at + interval '24 hours';
  return new;
end;
$$;
revoke all on function public.jenios_stamp_story_lifetime() from public, anon, authenticated;
create trigger jenios_story_lifetime before insert on public.stories
for each row execute function public.jenios_stamp_story_lifetime();
create policy social_stories_lifetime on public.stories as restrictive for select to authenticated
using (created_at <= now() and expires_at > now() and created_at > now()-interval '24 hours');
