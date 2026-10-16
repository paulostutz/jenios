create table public.comment_likes (
 comment_id uuid not null references public.comments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(comment_id,user_id)
);
create index comment_likes_user_idx on public.comment_likes(user_id);
alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon,authenticated;
grant select,insert,delete on public.comment_likes to authenticated;
create policy comment_likes_read on public.comment_likes for select to authenticated using (true);
create policy comment_likes_insert on public.comment_likes for insert to authenticated with check (user_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy comment_likes_delete on public.comment_likes for delete to authenticated using (user_id=(select auth.uid()));
create function public.jenios_comment_like_stats(ids uuid[])
returns table(comment_id uuid, count bigint, liked boolean)
language sql stable security invoker set search_path=public,pg_temp
as $$
 select c.id,count(l.user_id),coalesce(bool_or(l.user_id=auth.uid()),false)
 from public.comments c left join public.comment_likes l on l.comment_id=c.id
 where c.id=any(ids[1:100]) group by c.id
$$;
revoke all on function public.jenios_comment_like_stats(uuid[]) from public,anon;
grant execute on function public.jenios_comment_like_stats(uuid[]) to authenticated;
