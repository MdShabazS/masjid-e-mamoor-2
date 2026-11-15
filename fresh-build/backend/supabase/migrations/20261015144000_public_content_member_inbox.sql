-- Phase 10 first slice: text announcements and durable member inbox.
begin;
create table public.community_posts (
 id uuid primary key default gen_random_uuid(),
 create_operation_id uuid not null unique,
 title text not null check(length(btrim(title)) between 1 and 160),
 body text not null check(length(btrim(body)) between 1 and 5000),
 audience text not null check(audience in ('public','members')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 publish_at timestamptz,
 expire_at timestamptz,
 created_by uuid not null references public.app_users(id) on delete restrict,
 updated_by uuid not null references public.app_users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0),
 check(expire_at is null or (publish_at is not null and expire_at>publish_at)),
 check(status<>'published' or publish_at is not null)
);
create table public.community_post_events (
 operation_id uuid primary key,
 post_id uuid not null references public.community_posts(id) on delete restrict,
 actor_id uuid not null references public.app_users(id) on delete restrict,
 action text not null check(action in ('create','revise','publish','archive')),
 payload jsonb not null,
 occurred_at timestamptz not null default now()
);
create trigger community_post_events_immutable before update or delete on public.community_post_events
 for each row execute function app_private.reject_immutable_finance_change();
create table public.member_inbox (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.app_users(id) on delete restrict,
 post_id uuid not null references public.community_posts(id) on delete restrict,
 post_revision integer not null check(post_revision>0),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(member_id,post_id,post_revision)
);
create index member_inbox_member_time on public.member_inbox(member_id,created_at desc,id desc);
do $$ declare v_table text; begin
 foreach v_table in array array['community_posts','community_post_events','member_inbox'] loop
  execute format('alter table public.%I enable row level security',v_table);
  execute format('revoke all on public.%I from public,anon,authenticated',v_table);
 end loop;
end $$;

create function public.create_community_post(p_title text,p_body text,p_audience text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_old public.community_posts; v_id uuid; v_title text:=btrim(p_title); v_body text:=btrim(p_body);
 v_payload jsonb;
begin
 if p_operation_id is null or length(v_title) not between 1 and 160
  or length(v_body) not between 1 and 5000 or p_audience not in ('public','members') then
  raise exception 'invalid_content' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('title',v_title,'body',v_body,'audience',p_audience);
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,101));
 select * into v_old from public.community_posts where create_operation_id=p_operation_id;
 if found then
  if v_old.created_by<>v_actor or not exists(select 1 from public.community_post_events ev
   where ev.operation_id=p_operation_id and ev.action='create' and ev.payload=v_payload) then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.community_posts(create_operation_id,title,body,audience,created_by,updated_by)
 values(p_operation_id,v_title,v_body,p_audience,v_actor,v_actor) returning id into v_id;
 insert into public.community_post_events(operation_id,post_id,actor_id,action,payload)
 values(p_operation_id,v_id,v_actor,'create',v_payload);
 return v_id;
end $$;

create function public.publish_community_post(p_id uuid,p_publish_at timestamptz,
 p_expire_at timestamptz,p_expected_revision integer,p_operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_old public.community_posts; v_event public.community_post_events;
 v_payload jsonb:=jsonb_build_object('publish_at',p_publish_at,'expire_at',p_expire_at,
  'expected_revision',p_expected_revision);
begin
 if p_id is null or p_operation_id is null or p_publish_at is null or p_expected_revision is null
  or (p_expire_at is not null and p_expire_at<=p_publish_at) then
  raise exception 'invalid_publication' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,101));
 select * into v_event from public.community_post_events where operation_id=p_operation_id;
 if found then
  if v_event.post_id<>p_id or v_event.actor_id<>v_actor
   or v_event.action<>'publish' or v_event.payload<>v_payload then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_expected_revision+1;
 end if;
 select * into v_old from public.community_posts where id=p_id for update;
 if not found or v_old.status<>'draft' or v_old.revision<>p_expected_revision then
  raise exception 'stale_or_unpublishable_post' using errcode='22023'; end if;
 update public.community_posts set status='published',publish_at=p_publish_at,
  expire_at=p_expire_at,revision=revision+1,updated_by=v_actor,updated_at=now()
 where id=p_id;
 insert into public.community_post_events(operation_id,post_id,actor_id,action,payload)
 values(p_operation_id,p_id,v_actor,'publish',v_payload);
 return v_old.revision+1;
end $$;

create function public.revise_community_post(p_id uuid,p_title text,p_body text,
 p_audience text,p_expected_revision integer,p_operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_old public.community_posts; v_event public.community_post_events;
 v_title text:=btrim(p_title); v_body text:=btrim(p_body);
 v_payload jsonb:=jsonb_build_object('title',v_title,'body',v_body,
  'audience',p_audience,'expected_revision',p_expected_revision);
begin
 if p_id is null or p_operation_id is null or p_expected_revision is null
  or length(v_title) not between 1 and 160 or length(v_body) not between 1 and 5000
  or p_audience not in ('public','members') then
  raise exception 'invalid_content' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,101));
 select * into v_event from public.community_post_events where operation_id=p_operation_id;
 if found then
  if v_event.post_id<>p_id or v_event.actor_id<>v_actor
   or v_event.action<>'revise' or v_event.payload<>v_payload then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_expected_revision+1;
 end if;
 select * into v_old from public.community_posts where id=p_id for update;
 if not found or v_old.status='archived' or v_old.revision<>p_expected_revision
  or (v_old.status='published' and v_old.audience<>p_audience) then
  raise exception 'stale_or_uneditable_post' using errcode='22023'; end if;
 update public.community_posts set title=v_title,body=v_body,audience=p_audience,
  revision=revision+1,updated_by=v_actor,updated_at=now() where id=p_id;
 insert into public.community_post_events(operation_id,post_id,actor_id,action,payload)
 values(p_operation_id,p_id,v_actor,'revise',v_payload);
 return v_old.revision+1;
end $$;

create function public.archive_community_post(p_id uuid,p_expected_revision integer,p_operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_old public.community_posts; v_event public.community_post_events;
 v_payload jsonb:=jsonb_build_object('expected_revision',p_expected_revision);
begin
 if p_id is null or p_operation_id is null or p_expected_revision is null then
  raise exception 'invalid_archive' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,101));
 select * into v_event from public.community_post_events where operation_id=p_operation_id;
 if found then
  if v_event.post_id<>p_id or v_event.actor_id<>v_actor
   or v_event.action<>'archive' or v_event.payload<>v_payload then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_expected_revision+1;
 end if;
 select * into v_old from public.community_posts where id=p_id for update;
 if not found or v_old.status='archived' or v_old.revision<>p_expected_revision then
  raise exception 'stale_or_archived_post' using errcode='22023'; end if;
 update public.community_posts set status='archived',revision=revision+1,
  updated_by=v_actor,updated_at=now() where id=p_id;
 insert into public.community_post_events(operation_id,post_id,actor_id,action,payload)
 values(p_operation_id,p_id,v_actor,'archive',v_payload);
 return v_old.revision+1;
end $$;

create function public.list_published_community_posts(p_limit integer default 20)
returns table(post_id uuid,title text,body text,published_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_limit is null or p_limit not between 1 and 50 then
  raise exception 'invalid_limit' using errcode='22023'; end if;
 return query select p.id,p.title,p.body,p.publish_at from public.community_posts p
 where p.audience='public' and p.status='published' and p.publish_at<=now()
  and (p.expire_at is null or p.expire_at>now())
 order by p.publish_at desc,p.id desc limit p_limit;
end $$;

create function public.list_member_community_posts(p_limit integer default 20)
returns table(post_id uuid,title text,body text,audience text,published_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary',
  'treasurer','committee_member','member','data_entry']);
 if p_limit is null or p_limit not between 1 and 50 then
  raise exception 'invalid_limit' using errcode='22023'; end if;
 return query select p.id,p.title,p.body,p.audience,p.publish_at from public.community_posts p
 where p.status='published' and p.publish_at<=now()
  and (p.expire_at is null or p.expire_at>now())
 order by p.publish_at desc,p.id desc limit p_limit;
end $$;

create function public.list_managed_community_posts(p_limit integer default 50)
returns table(post_id uuid,title text,body text,audience text,status text,revision integer,
 publish_at timestamptz,expire_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 if p_limit is null or p_limit not between 1 and 100 then
  raise exception 'invalid_limit' using errcode='22023'; end if;
 return query select p.id,p.title,p.body,p.audience,p.status,p.revision,p.publish_at,p.expire_at
  from public.community_posts p order by p.created_at desc,p.id desc limit p_limit;
end $$;

create function public.queue_due_member_post_notifications()
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;
begin
 insert into public.member_inbox(member_id,post_id,post_revision)
 select u.id,p.id,p.revision from public.app_users u cross join public.community_posts p
 where u.active and p.status='published' and p.audience='members'
  and p.publish_at<=now() and (p.expire_at is null or p.expire_at>now())
 on conflict (member_id,post_id,post_revision) do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

create function public.list_my_member_inbox(p_limit integer default 25)
returns table(notification_id uuid,title text,created_at timestamptz,read_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
 'secretary','treasurer','committee_member','member','data_entry']);
begin
 if p_limit is null or p_limit not between 1 and 50 then
  raise exception 'invalid_limit' using errcode='22023'; end if;
 return query select i.id,p.title,i.created_at,i.read_at from public.member_inbox i
 join public.community_posts p on p.id=i.post_id
 where i.member_id=v_actor and p.status='published' and p.publish_at<=now()
  and (p.expire_at is null or p.expire_at>now())
 order by i.created_at desc,i.id desc limit p_limit;
end $$;

create function public.mark_my_member_notification_read(p_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
 'secretary','treasurer','committee_member','member','data_entry']);
begin
 update public.member_inbox set read_at=coalesce(read_at,now())
 where id=p_id and member_id=v_actor;
 return found;
end $$;

revoke all on function public.create_community_post(text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.publish_community_post(uuid,timestamptz,timestamptz,integer,uuid) from public,anon,authenticated;
revoke all on function public.revise_community_post(uuid,text,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.archive_community_post(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.list_published_community_posts(integer) from public,anon,authenticated;
revoke all on function public.list_member_community_posts(integer) from public,anon,authenticated;
revoke all on function public.list_managed_community_posts(integer) from public,anon,authenticated;
revoke all on function public.queue_due_member_post_notifications() from public,anon,authenticated;
revoke all on function public.list_my_member_inbox(integer) from public,anon,authenticated;
revoke all on function public.mark_my_member_notification_read(uuid) from public,anon,authenticated;
grant execute on function public.create_community_post(text,text,text,uuid) to authenticated;
grant execute on function public.publish_community_post(uuid,timestamptz,timestamptz,integer,uuid) to authenticated;
grant execute on function public.revise_community_post(uuid,text,text,text,integer,uuid) to authenticated;
grant execute on function public.archive_community_post(uuid,integer,uuid) to authenticated;
grant execute on function public.list_published_community_posts(integer) to anon,authenticated;
grant execute on function public.list_member_community_posts(integer) to authenticated;
grant execute on function public.list_managed_community_posts(integer) to authenticated;
grant execute on function public.queue_due_member_post_notifications() to service_role;
grant execute on function public.list_my_member_inbox(integer) to authenticated;
grant execute on function public.mark_my_member_notification_read(uuid) to authenticated;
commit;
