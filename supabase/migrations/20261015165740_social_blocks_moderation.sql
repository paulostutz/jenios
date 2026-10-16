create schema jenios_social_private;
revoke all on schema jenios_social_private from public,anon;
grant usage on schema jenios_social_private to authenticated;
create table jenios_social_private.hidden_posts(post_id uuid primary key references public.posts(id) on delete cascade, moderator_id uuid not null, reason text not null, created_at timestamptz not null default now());
create table jenios_social_private.moderation_audit(id uuid primary key default gen_random_uuid(),report_id uuid not null,actor_id uuid not null,action text not null,note text not null,created_at timestamptz not null default now());
alter table jenios_social_private.hidden_posts enable row level security;
alter table jenios_social_private.moderation_audit enable row level security;
revoke all on all tables in schema jenios_social_private from public,anon,authenticated;
create function jenios_social_private.is_moderator() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from auth.users where id=auth.uid() and coalesce(is_anonymous,false)=false and raw_app_meta_data->>'role' in ('admin','social_moderator'))
$$;
create function jenios_social_private.can_interact(other_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and not exists(select 1 from public.user_blocks where (blocker_id=auth.uid() and blocked_id=other_id) or (blocked_id=auth.uid() and blocker_id=other_id))
$$;
create function jenios_social_private.visible_post(post_id uuid,author_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select jenios_social_private.can_interact(author_id) and not exists(select 1 from jenios_social_private.hidden_posts h where h.post_id=visible_post.post_id)
$$;
revoke all on all functions in schema jenios_social_private from public,anon;
grant execute on all functions in schema jenios_social_private to authenticated;
create policy social_posts_visibility on public.posts as restrictive for select to authenticated using(jenios_social_private.visible_post(id,author_id));
create policy social_stories_visibility on public.stories as restrictive for select to authenticated using(jenios_social_private.can_interact(author_id));
create policy social_comments_visibility on public.comments as restrictive for select to authenticated using(jenios_social_private.can_interact(author_id) and exists(select 1 from public.posts p where p.id=post_id));
create policy social_comments_insert_visible on public.comments as restrictive for insert to authenticated with check(exists(select 1 from public.posts p where p.id=post_id));
create policy social_likes_insert_visible on public.post_likes as restrictive for insert to authenticated with check(exists(select 1 from public.posts p where p.id=post_id));
create policy social_comment_likes_insert_visible on public.comment_likes as restrictive for insert to authenticated with check(exists(select 1 from public.comments c where c.id=comment_id));
create policy social_follows_insert_visible on public.follows as restrictive for insert to authenticated with check(jenios_social_private.can_interact(following_id));

create function jenios_social_private.moderation_queue(filter_status text, page_offset integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not jenios_social_private.is_moderator() then raise exception 'MODERATOR_REQUIRED' using errcode='42501';end if;
 if filter_status not in ('pending','reviewing','resolved','dismissed') or page_offset<0 or page_offset>100000 then raise exception 'INVALID_FILTER';end if;
 select coalesce(jsonb_agg(row_to_json(q)),'[]'::jsonb) into result from (
 select r.*,p.body as post_body,p.author_id as post_author_id,exists(select 1 from jenios_social_private.hidden_posts h where h.post_id=r.target_id) as hidden
 from public.reports r left join public.posts p on r.target_type='post' and p.id=r.target_id
 where r.status=filter_status order by r.created_at desc,r.id desc limit 50 offset page_offset
 )q;
 return result;
end $$;
create function jenios_social_private.moderate_report(report_id uuid, decision text, note text, expected_status text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare report public.reports; new_status text;
begin
 if not jenios_social_private.is_moderator() then raise exception 'MODERATOR_REQUIRED' using errcode='42501';end if;
 if decision not in ('reviewing','dismissed','hide','restore') or note is null or length(trim(note))<3 or length(note)>2000 then raise exception 'INVALID_DECISION';end if;
 select * into report from public.reports where id=report_id for update;
 if not found then raise exception 'REPORT_NOT_FOUND';end if;
 if report.status<>expected_status then raise exception 'REPORT_CHANGED';end if;
 if decision in ('hide','restore') and report.target_type<>'post' then raise exception 'UNSUPPORTED_TARGET';end if;
 if decision='hide' then
  if not exists(select 1 from public.posts where id=report.target_id) then raise exception 'POST_NOT_FOUND';end if;
  insert into jenios_social_private.hidden_posts(post_id,moderator_id,reason) values(report.target_id,auth.uid(),note) on conflict(post_id) do update set moderator_id=excluded.moderator_id,reason=excluded.reason,created_at=now();new_status:='resolved';
 elsif decision='restore' then delete from jenios_social_private.hidden_posts where post_id=report.target_id;new_status:='reviewing';
 else new_status:=decision;end if;
 update public.reports set status=new_status where id=report_id;
 insert into jenios_social_private.moderation_audit(report_id,actor_id,action,note) values(report_id,auth.uid(),decision,note);
 return jsonb_build_object('id',report_id,'status',new_status);
end $$;
revoke all on function jenios_social_private.moderation_queue(text,integer),jenios_social_private.moderate_report(uuid,text,text,text) from public,anon;
grant execute on function jenios_social_private.moderation_queue(text,integer),jenios_social_private.moderate_report(uuid,text,text,text) to authenticated;
create function public.jenios_moderation_queue(filter_status text default 'pending',page_offset integer default 0) returns jsonb language sql security invoker set search_path=pg_catalog,public as $$select jenios_social_private.moderation_queue(filter_status,page_offset)$$;
create function public.jenios_moderate_report(report_id uuid,decision text,note text,expected_status text) returns jsonb language sql security invoker set search_path=pg_catalog,public as $$select jenios_social_private.moderate_report(report_id,decision,note,expected_status)$$;
revoke all on function public.jenios_moderation_queue(text,integer),public.jenios_moderate_report(uuid,text,text,text) from public,anon;
grant execute on function public.jenios_moderation_queue(text,integer),public.jenios_moderate_report(uuid,text,text,text) to authenticated;
