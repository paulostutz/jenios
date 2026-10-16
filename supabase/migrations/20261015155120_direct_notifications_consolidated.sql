-- Applied to jenios-social on 2026-10-15, remote migration 20261015155120. Existing profiles and block rules retained.
begin;
create schema if not exists jenios_private;
revoke all on schema jenios_private from public,anon;
grant usage on schema jenios_private to authenticated;
do $$ begin
 if to_regclass('public.profiles') is null or to_regclass('public.user_blocks') is null then raise exception 'Profiles or block rules missing';end if;
end $$;
-- Direct real de texto; não altera nem converte as mensagens locais antigas.
create table if not exists public.jenios_direct_threads_v7(
 id uuid primary key default gen_random_uuid(), user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade, created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(user_low,user_high),check(user_low<user_high),check(created_by in (user_low,user_high))
);
create table if not exists public.jenios_direct_messages_v7(
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.jenios_direct_threads_v7(id) on delete cascade,
 sender_id uuid not null references auth.users(id),body text not null check(char_length(trim(body)) between 1 and 5000),created_at timestamptz not null default now()
);
create index if not exists jenios_direct_order_v7 on public.jenios_direct_messages_v7(thread_id,created_at desc);
create index if not exists jenios_direct_rate_v7 on public.jenios_direct_messages_v7(sender_id,created_at desc);
alter table public.jenios_direct_threads_v7 enable row level security;
alter table public.jenios_direct_messages_v7 enable row level security;
revoke all on public.jenios_direct_threads_v7,public.jenios_direct_messages_v7 from anon,authenticated;
grant select on public.jenios_direct_threads_v7,public.jenios_direct_messages_v7 to authenticated;
drop policy if exists jenios_direct_thread_read_v7 on public.jenios_direct_threads_v7;
create policy jenios_direct_thread_read_v7 on public.jenios_direct_threads_v7 for select to authenticated using((select auth.uid()) in (user_low,user_high));
drop policy if exists jenios_direct_message_read_v7 on public.jenios_direct_messages_v7;
create policy jenios_direct_message_read_v7 on public.jenios_direct_messages_v7 for select to authenticated using(exists(select 1 from public.jenios_direct_threads_v7 t where t.id=thread_id and (select auth.uid()) in (t.user_low,t.user_high)));
create or replace function jenios_private.jenios_open_direct_v7(recipient_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();lo uuid;hi uuid;tid uuid;
begin
 if me is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or recipient_id is null or me=recipient_id then raise exception 'Sessão ou destinatário inválido.';end if;
 if not exists(select 1 from public.profiles where id=recipient_id) then raise exception 'Destinatário não possui perfil público ativo.';end if;
 if exists(
  select 1 from public.user_blocks b
  where (b.blocker_id=me and b.blocked_id=recipient_id)
     or (b.blocker_id=recipient_id and b.blocked_id=me)
 ) then raise exception 'Conversa indisponível para estes perfis.';end if;
 lo:=least(me,recipient_id);hi:=greatest(me,recipient_id);
 select id into tid from public.jenios_direct_threads_v7 where user_low=lo and user_high=hi;
 if tid is not null then return tid;end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if (select count(*) from public.jenios_direct_threads_v7 where created_by=me and created_at>now()-interval '24 hours')>=30 then raise exception 'Limite diário de novas conversas atingido.';end if;
 insert into public.jenios_direct_threads_v7(user_low,user_high,created_by) values(lo,hi,me) on conflict(user_low,user_high) do nothing returning id into tid;
 if tid is null then select id into tid from public.jenios_direct_threads_v7 where user_low=lo and user_high=hi;end if;
 return tid;
end $$;
create or replace function jenios_private.jenios_send_direct_v7(p_id uuid,p_thread uuid,p_body text)
returns setof public.jenios_direct_messages_v7 language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();existing public.jenios_direct_messages_v7;
begin
 if me is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_id is null or p_thread is null or p_body is null or char_length(trim(p_body)) not between 1 and 5000 then raise exception 'Mensagem inválida.';end if;
 if not exists(select 1 from public.jenios_direct_threads_v7 t where t.id=p_thread and me in(t.user_low,t.user_high)) then raise exception 'Conversa não autorizada.';end if;
 if exists(
  select 1 from public.jenios_direct_threads_v7 t
  join public.user_blocks b on
    (b.blocker_id=t.user_low and b.blocked_id=t.user_high)
    or (b.blocker_id=t.user_high and b.blocked_id=t.user_low)
  where t.id=p_thread
 ) then raise exception 'Conversa indisponível para estes perfis.';end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,1));
 select * into existing from public.jenios_direct_messages_v7 where id=p_id;
 if existing.id is not null then
  if existing.sender_id<>me or existing.thread_id<>p_thread or existing.body<>trim(p_body) then raise exception 'Identificador já utilizado.';end if;
  return next existing;return;
 end if;
 if (select count(*) from public.jenios_direct_messages_v7 where sender_id=me and created_at>now()-interval '1 minute')>=60 then raise exception 'Aguarde antes de enviar mais mensagens.';end if;
 return query insert into public.jenios_direct_messages_v7(id,thread_id,sender_id,body) values(p_id,p_thread,me,trim(p_body)) returning *;
end $$;

revoke all on function jenios_private.jenios_open_direct_v7(uuid) from public,anon;
revoke all on function jenios_private.jenios_send_direct_v7(uuid,uuid,text) from public,anon;
grant execute on function jenios_private.jenios_open_direct_v7(uuid) to authenticated;
grant execute on function jenios_private.jenios_send_direct_v7(uuid,uuid,text) to authenticated;
create or replace function public.jenios_open_direct_v7(recipient_id uuid) returns uuid language sql security invoker set search_path='' as $$ select jenios_private.jenios_open_direct_v7(recipient_id) $$;
create or replace function public.jenios_send_direct_v7(p_id uuid,p_thread uuid,p_body text) returns setof public.jenios_direct_messages_v7 language sql security invoker set search_path='' as $$ select * from jenios_private.jenios_send_direct_v7(p_id,p_thread,p_body) $$;
revoke all on function public.jenios_open_direct_v7(uuid) from public,anon;
revoke all on function public.jenios_send_direct_v7(uuid,uuid,text) from public,anon;
grant execute on function public.jenios_open_direct_v7(uuid) to authenticated;
grant execute on function public.jenios_send_direct_v7(uuid,uuid,text) to authenticated;

create table if not exists public.jenios_social_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,kind text not null,
 title text not null,body text not null default '',target_url text,read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.jenios_social_notifications enable row level security;
revoke all on public.jenios_social_notifications from anon,authenticated;
grant select on public.jenios_social_notifications to authenticated;
grant update(read_at) on public.jenios_social_notifications to authenticated;
create index if not exists jenios_notifications_owner_date on public.jenios_social_notifications(user_id,created_at desc);
drop policy if exists notifications_select_own on public.jenios_social_notifications;
create policy notifications_select_own on public.jenios_social_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists notifications_update_own on public.jenios_social_notifications;
create policy notifications_update_own on public.jenios_social_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- Trigger derives recipient from the stored event; clients cannot forge notices.
create or replace function jenios_private.notify_direct_v7() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 select case when t.user_low=new.sender_id then t.user_high else t.user_low end into recipient from public.jenios_direct_threads_v7 t where t.id=new.thread_id;
 if recipient is not null then insert into public.jenios_social_notifications(user_id,actor_id,kind,title,body,target_url) values(recipient,new.sender_id,'direct','Nova mensagem','Você recebeu uma mensagem privada.','/social?direct=1');end if;
 return new;
end $$;
revoke all on function jenios_private.notify_direct_v7() from public,anon,authenticated;
drop trigger if exists jenios_notify_direct_v7 on public.jenios_direct_messages_v7;
create trigger jenios_notify_direct_v7 after insert on public.jenios_direct_messages_v7 for each row execute function jenios_private.notify_direct_v7();
create or replace function jenios_private.notify_social_v7() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;actor uuid;kind text;title text;target text;
begin
 if tg_table_name='comments' then
  select author_id into recipient from public.posts where id=new.post_id;
  actor:=new.author_id;kind:='comment';title:='Novo comentário';target:='/social?post='||new.post_id::text;
 elsif tg_table_name='follows' then
  recipient:=new.following_id;actor:=new.follower_id;kind:='follow';title:='Novo seguidor';target:='/social';
 else return new;end if;
 if recipient is not null and recipient<>actor and not exists(select 1 from public.user_blocks b where (b.blocker_id=recipient and b.blocked_id=actor) or (b.blocker_id=actor and b.blocked_id=recipient)) then
  insert into public.jenios_social_notifications(user_id,actor_id,kind,title,target_url) values(recipient,actor,kind,title,target);
 end if;
 return new;
end $$;
revoke all on function jenios_private.notify_social_v7() from public,anon,authenticated;
drop trigger if exists jenios_notify_comment_v7 on public.comments;
create trigger jenios_notify_comment_v7 after insert on public.comments for each row execute function jenios_private.notify_social_v7();
drop trigger if exists jenios_notify_follow_v7 on public.follows;
create trigger jenios_notify_follow_v7 after insert on public.follows for each row execute function jenios_private.notify_social_v7();
commit;
