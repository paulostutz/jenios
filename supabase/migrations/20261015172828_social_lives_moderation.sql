create index social_lives_feed_idx on public.lives(created_at desc,id desc);
create unique index social_lives_host_video_idx on public.lives(host_id,youtube_video_id);
create table jenios_social_private.hidden_lives(live_id uuid primary key references public.lives(id) on delete cascade,moderator_id uuid not null,reason text not null,created_at timestamptz not null default now());
alter table jenios_social_private.hidden_lives enable row level security;
revoke all on jenios_social_private.hidden_lives from public,anon,authenticated;
create function jenios_social_private.visible_live(live_id uuid,host_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select jenios_social_private.can_interact(host_id) and not exists(select 1 from jenios_social_private.hidden_lives h where h.live_id=visible_live.live_id)
$$;
revoke all on function jenios_social_private.visible_live(uuid,uuid) from public,anon;
grant execute on function jenios_social_private.visible_live(uuid,uuid) to authenticated;
create policy social_lives_visibility on public.lives as restrictive for select to authenticated using(jenios_social_private.visible_live(id,host_id));
create or replace function jenios_social_private.moderation_queue(filter_status text, page_offset integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not jenios_social_private.is_moderator() then raise exception 'MODERATOR_REQUIRED' using errcode='42501';end if;
 if filter_status not in ('pending','reviewing','resolved','dismissed') or page_offset<0 or page_offset>100000 then raise exception 'INVALID_FILTER';end if;
 select coalesce(jsonb_agg(row_to_json(q)),'[]'::jsonb) into result from (
 select r.*,p.body as post_body,p.author_id as post_author_id,l.title as live_title,l.youtube_video_id as live_video_id,case when r.target_type='live' then exists(select 1 from jenios_social_private.hidden_lives h where h.live_id=r.target_id) else exists(select 1 from jenios_social_private.hidden_posts h where h.post_id=r.target_id) end as hidden
 from public.reports r left join public.posts p on r.target_type='post' and p.id=r.target_id left join public.lives l on r.target_type='live' and l.id=r.target_id
 where r.status=filter_status order by r.created_at desc,r.id desc limit 50 offset page_offset
 )q;
 return result;
end $$;
create or replace function jenios_social_private.moderate_report(report_id uuid, decision text, note text, expected_status text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare report public.reports; new_status text;
begin
 if not jenios_social_private.is_moderator() then raise exception 'MODERATOR_REQUIRED' using errcode='42501';end if;
 if decision not in ('reviewing','dismissed','hide','restore') or note is null or length(trim(note))<3 or length(note)>2000 then raise exception 'INVALID_DECISION';end if;
 select * into report from public.reports where id=report_id for update;
 if not found then raise exception 'REPORT_NOT_FOUND';end if;
 if report.status<>expected_status then raise exception 'REPORT_CHANGED';end if;
 if decision in ('hide','restore') and report.target_type not in ('post','live') then raise exception 'UNSUPPORTED_TARGET';end if;
 if decision='hide' and report.target_type='live' then
  if not exists(select 1 from public.lives where id=report.target_id) then raise exception 'LIVE_NOT_FOUND';end if;
  insert into jenios_social_private.hidden_lives(live_id,moderator_id,reason) values(report.target_id,auth.uid(),note) on conflict(live_id) do update set moderator_id=excluded.moderator_id,reason=excluded.reason,created_at=now();new_status:='resolved';
 elsif decision='restore' and report.target_type='live' then delete from jenios_social_private.hidden_lives where live_id=report.target_id;new_status:='reviewing';
 elsif decision='hide' then
  if not exists(select 1 from public.posts where id=report.target_id) then raise exception 'POST_NOT_FOUND';end if;
  insert into jenios_social_private.hidden_posts(post_id,moderator_id,reason) values(report.target_id,auth.uid(),note) on conflict(post_id) do update set moderator_id=excluded.moderator_id,reason=excluded.reason,created_at=now();new_status:='resolved';
 elsif decision='restore' then delete from jenios_social_private.hidden_posts where post_id=report.target_id;new_status:='reviewing';
 else new_status:=decision;end if;
 update public.reports set status=new_status where id=report_id;
 insert into jenios_social_private.moderation_audit(report_id,actor_id,action,note) values(report_id,auth.uid(),decision,note);
 return jsonb_build_object('id',report_id,'status',new_status);
end $$;
