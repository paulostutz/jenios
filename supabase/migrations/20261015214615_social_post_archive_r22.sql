begin;
alter table public.posts add column if not exists archived_at timestamptz;
create index if not exists social_posts_public_order on public.posts(created_at desc,id desc) where archived_at is null;
create index if not exists social_posts_own_archive on public.posts(author_id,archived_at desc,id desc) where archived_at is not null;
create policy social_posts_archive_private on public.posts as restrictive for select to authenticated
using (archived_at is null or author_id=(select auth.uid()));
create policy social_stories_original_not_archived on public.stories as restrictive for select to authenticated
using (shared_post_id is null or exists(select 1 from public.posts p where p.id=shared_post_id and p.archived_at is null));
create policy social_stories_share_unarchived on public.stories as restrictive for insert to authenticated
with check (shared_post_id is null or exists(select 1 from public.posts p where p.id=shared_post_id and p.archived_at is null));
commit;
