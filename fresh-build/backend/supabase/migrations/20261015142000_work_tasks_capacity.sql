-- Phase 8 first slice: authoritative task capacity and FIFO participation.
begin;
create sequence public.work_task_queue_seq;
revoke all on sequence public.work_task_queue_seq from public,anon,authenticated;
create table public.work_tasks (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.app_users(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null check(length(btrim(description)) between 1 and 2000),
 scheduled_date date,
 location text check(location is null or length(btrim(location)) between 1 and 240),
 mode text not null check(mode in ('direct','open','mixed')),
 total_cap integer not null check(total_cap between 1 and 10000),
 invited_cap integer not null check(invited_cap between 0 and 10000),
 volunteer_cap integer not null check(volunteer_cap between 0 and 10000),
 status text not null default 'active' check(status in ('active','cancelled')),
 created_at timestamptz not null default now(),
 check(total_cap<=invited_cap+volunteer_cap),
 check((mode='direct' and invited_cap>0 and volunteer_cap=0)
    or (mode='open' and invited_cap=0 and volunteer_cap>0)
    or (mode='mixed' and invited_cap>0 and volunteer_cap>0))
);
create table public.work_task_participants (
 task_id uuid not null references public.work_tasks(id) on delete restrict,
 member_id uuid not null references public.app_users(id) on delete restrict,
 source text not null check(source in ('invited','volunteer')),
 status text not null check(status in ('invited','confirmed','waitlisted','declined',
   'withdrawn','completion_submitted','returned','verified')),
 queue_no bigint unique,
 joined_at timestamptz,
 completion_note text check(completion_note is null or length(completion_note)<=2000),
 review_reason text check(review_reason is null or length(btrim(review_reason)) between 3 and 500),
 updated_at timestamptz not null default now(),
 primary key(task_id,member_id),
 check((status in ('invited','declined') and queue_no is null and joined_at is null)
   or (status not in ('invited','declined') and queue_no is not null and joined_at is not null))
);
create index work_task_wait_queue on public.work_task_participants(task_id,queue_no)
 where status='waitlisted';
create table public.work_task_operations (
 id uuid primary key,
 actor_id uuid not null references public.app_users(id) on delete restrict,
 task_id uuid not null references public.work_tasks(id) on delete restrict,
 action text not null,
 payload jsonb not null,
 result_status text,
 occurred_at timestamptz not null default now()
);
create trigger work_task_operations_immutable before update or delete on public.work_task_operations
 for each row execute function app_private.reject_immutable_finance_change();
do $$ declare v_name text; begin
 foreach v_name in array array['work_tasks','work_task_participants','work_task_operations'] loop
  execute format('alter table public.%I enable row level security',v_name);
  execute format('revoke all on public.%I from public,anon,authenticated',v_name);
 end loop;
end $$;

create function app_private.task_replay(p_op uuid,p_actor uuid,p_task uuid,p_action text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_old public.work_task_operations;
begin
 if p_op is null then raise exception 'operation_id_required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_op::text,81));
 select * into v_old from public.work_task_operations where id=p_op;
 if not found then return false; end if;
 if v_old.actor_id<>p_actor or v_old.task_id<>p_task or v_old.action<>p_action
   or v_old.payload<>p_payload then
  raise exception 'operation_id_conflict' using errcode='23505'; end if;
 return true;
end $$;
revoke all on function app_private.task_replay(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;

create function public.create_work_task(p_title text,p_description text,p_date date,p_location text,
 p_mode text,p_total integer,p_invited integer,p_volunteer integer,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
 v_id uuid; v_old public.work_task_operations;
 v_title text:=btrim(p_title); v_description text:=btrim(p_description);
 v_location text:=nullif(btrim(p_location),''); v_payload jsonb;
begin
 if p_operation_id is null or length(v_title) not between 1 and 160
  or length(v_description) not between 1 and 2000
  or (v_location is not null and length(v_location)>240)
  or p_mode not in ('direct','open','mixed') or p_total is null or p_total not between 1 and 10000
  or p_invited is null or p_invited not between 0 and 10000
  or p_volunteer is null or p_volunteer not between 0 and 10000
  or p_total>p_invited+p_volunteer
  or (p_mode='direct' and (p_invited=0 or p_volunteer<>0))
  or (p_mode='open' and (p_invited<>0 or p_volunteer=0))
  or (p_mode='mixed' and (p_invited=0 or p_volunteer=0)) then
  raise exception 'invalid_task' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('title',v_title,'description',v_description,'date',p_date,
  'location',v_location,'mode',p_mode,'total',p_total,'invited',p_invited,'volunteer',p_volunteer);
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,81));
 select * into v_old from public.work_task_operations where id=p_operation_id;
 if found then
  if v_old.actor_id<>v_actor or v_old.action<>'create' or v_old.payload<>v_payload then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.task_id;
 end if;
 insert into public.work_tasks(creator_id,title,description,scheduled_date,location,
  mode,total_cap,invited_cap,volunteer_cap)
 values(v_actor,v_title,v_description,p_date,v_location,p_mode,p_total,p_invited,p_volunteer)
 returning id into v_id;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload)
 values(p_operation_id,v_actor,v_id,'create',v_payload);
 return v_id;
end $$;

create function public.invite_work_task_member(p_task_id uuid,p_member_id uuid,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
 v_task public.work_tasks; v_payload jsonb:=jsonb_build_object('member',p_member_id);
begin
 if p_task_id is null or p_member_id is null then
  raise exception 'invalid_invitation' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'invite',v_payload) then return p_task_id; end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.status<>'active' or v_task.creator_id<>v_actor
  or v_task.invited_cap=0 or p_member_id=v_actor
  or not exists(select 1 from public.app_users where id=p_member_id and active
   and role<>'system_admin')
  or exists(select 1 from public.work_task_participants where task_id=p_task_id and member_id=p_member_id) then
  raise exception 'invitation_not_allowed' using errcode='42501'; end if;
 insert into public.work_task_participants(task_id,member_id,source,status)
 values(p_task_id,p_member_id,'invited','invited');
 insert into public.work_task_operations(id,actor_id,task_id,action,payload)
 values(p_operation_id,v_actor,p_task_id,'invite',v_payload);
 return p_task_id;
end $$;

create function app_private.promote_work_task_waiters(p_task_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_task public.work_tasks; v_total integer; v_invited integer; v_volunteer integer;
 v_candidate record;
begin
 select * into v_task from public.work_tasks where id=p_task_id;
 if v_task.status<>'active' then return; end if;
 loop
  select count(*),count(*) filter(where source='invited'),
   count(*) filter(where source='volunteer')
   into v_total,v_invited,v_volunteer
   from public.work_task_participants
   where task_id=p_task_id and status in ('confirmed','completion_submitted','returned','verified');
  if v_total>=v_task.total_cap then exit; end if;
  select p.member_id into v_candidate from public.work_task_participants p
   join public.app_users u on u.id=p.member_id and u.active and u.role<>'system_admin'
   where p.task_id=p_task_id and p.status='waitlisted'
    and p.member_id<>v_task.creator_id
    and ((p.source='invited' and v_invited<v_task.invited_cap)
      or (p.source='volunteer' and v_volunteer<v_task.volunteer_cap))
   order by p.queue_no limit 1;
  if not found then exit; end if;
  update public.work_task_participants set status='confirmed',updated_at=now()
   where task_id=p_task_id and member_id=v_candidate.member_id;
 end loop;
end $$;
revoke all on function app_private.promote_work_task_waiters(uuid) from public,anon,authenticated;

create function public.join_work_task(p_task_id uuid,p_operation_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']);
 v_task public.work_tasks; v_p public.work_task_participants;
 v_source text; v_status text; v_total integer; v_source_count integer;
 v_payload jsonb:=jsonb_build_object('member',v_actor);
begin
 if p_task_id is null then raise exception 'task_required' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'join',v_payload) then
  select result_status into v_status from public.work_task_operations where id=p_operation_id;
  return v_status;
 end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.status<>'active' or v_task.creator_id=v_actor then
  raise exception 'task_not_joinable' using errcode='42501'; end if;
 select * into v_p from public.work_task_participants
  where task_id=p_task_id and member_id=v_actor;
 if found then
  if v_p.status<>'invited' then raise exception 'already_participating' using errcode='22023'; end if;
  v_source:='invited';
 else
  if v_task.mode='direct' then raise exception 'invitation_required' using errcode='42501'; end if;
  v_source:='volunteer';
 end if;
 select count(*),count(*) filter(where source=v_source) into v_total,v_source_count
 from public.work_task_participants where task_id=p_task_id
  and status in ('confirmed','completion_submitted','returned','verified');
 v_status:=case when v_total<v_task.total_cap and v_source_count<
  case when v_source='invited' then v_task.invited_cap else v_task.volunteer_cap end
  then 'confirmed' else 'waitlisted' end;
 if v_source='invited' then
  update public.work_task_participants set status=v_status,
   queue_no=nextval('public.work_task_queue_seq'),joined_at=now(),updated_at=now()
  where task_id=p_task_id and member_id=v_actor;
 else
  insert into public.work_task_participants(task_id,member_id,source,status,queue_no,joined_at)
  values(p_task_id,v_actor,'volunteer',v_status,nextval('public.work_task_queue_seq'),now());
 end if;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status)
 values(p_operation_id,v_actor,p_task_id,'join',v_payload,v_status);
 return v_status;
end $$;

create function public.leave_work_task(p_task_id uuid,p_operation_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']);
 v_task public.work_tasks; v_old text; v_status text;
 v_payload jsonb:=jsonb_build_object('member',v_actor);
begin
 if p_task_id is null then raise exception 'task_required' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'leave',v_payload) then
  select result_status into v_status from public.work_task_operations where id=p_operation_id;
  return v_status;
 end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.status<>'active' then
  raise exception 'task_not_active' using errcode='22023'; end if;
 select status into v_old from public.work_task_participants
  where task_id=p_task_id and member_id=v_actor for update;
 if v_old not in ('invited','confirmed','waitlisted') or v_old is null then
  raise exception 'not_releasable' using errcode='22023'; end if;
 v_status:=case when v_old='invited' then 'declined' else 'withdrawn' end;
 update public.work_task_participants set status=v_status,updated_at=now()
 where task_id=p_task_id and member_id=v_actor;
 if v_old='confirmed' then perform app_private.promote_work_task_waiters(p_task_id); end if;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status)
 values(p_operation_id,v_actor,p_task_id,'leave',v_payload,v_status);
 return v_status;
end $$;

create function public.submit_work_task_completion(p_task_id uuid,p_note text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']);
 v_task public.work_tasks; v_status text; v_note text:=nullif(btrim(p_note),'');
 v_payload jsonb:=jsonb_build_object('member',v_actor,'note',v_note);
begin
 if p_task_id is null or (v_note is not null and length(v_note)>2000) then
  raise exception 'invalid_completion' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'submit_completion',v_payload) then
  return p_task_id; end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.status<>'active' or v_task.creator_id=v_actor then
  raise exception 'task_not_active' using errcode='42501'; end if;
 select status into v_status from public.work_task_participants
  where task_id=p_task_id and member_id=v_actor for update;
 if v_status not in ('confirmed','returned') or v_status is null then
  raise exception 'member_not_confirmed' using errcode='22023'; end if;
 update public.work_task_participants set status='completion_submitted',
  completion_note=v_note,review_reason=null,updated_at=now()
  where task_id=p_task_id and member_id=v_actor;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status)
 values(p_operation_id,v_actor,p_task_id,'submit_completion',v_payload,'completion_submitted');
 return p_task_id;
end $$;

create function public.review_work_task_completion(p_task_id uuid,p_member_id uuid,
 p_decision text,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
 v_task public.work_tasks; v_status text; v_reason text:=nullif(btrim(p_reason),'');
 v_payload jsonb:=jsonb_build_object('member',p_member_id,'decision',p_decision,'reason',v_reason);
begin
 if p_task_id is null or p_member_id is null or p_member_id=v_actor
  or p_decision not in ('accept','return')
  or (p_decision='accept' and v_reason is not null)
  or (p_decision='return' and length(v_reason) not between 3 and 500) then
  raise exception 'invalid_task_review' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'review',v_payload) then
  return p_task_id; end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.status<>'active' or v_task.creator_id<>v_actor then
  raise exception 'task_review_not_authorized' using errcode='42501'; end if;
 select status into v_status from public.work_task_participants
  where task_id=p_task_id and member_id=p_member_id for update;
 if v_status is distinct from 'completion_submitted' then
  raise exception 'completion_not_submitted' using errcode='22023'; end if;
 v_status:=case when p_decision='accept' then 'verified' else 'returned' end;
 update public.work_task_participants set status=v_status,review_reason=v_reason,updated_at=now()
 where task_id=p_task_id and member_id=p_member_id;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status)
 values(p_operation_id,v_actor,p_task_id,'review',v_payload,v_status);
 return p_task_id;
end $$;

create function public.cancel_work_task(p_task_id uuid,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
 v_task public.work_tasks; v_reason text:=btrim(p_reason);
 v_payload jsonb:=jsonb_build_object('reason',v_reason);
begin
 if p_task_id is null or length(v_reason) not between 3 and 500 then
  raise exception 'invalid_cancellation' using errcode='22023'; end if;
 if app_private.task_replay(p_operation_id,v_actor,p_task_id,'cancel',v_payload) then
  return p_task_id; end if;
 select * into v_task from public.work_tasks where id=p_task_id for update;
 if not found or v_task.creator_id<>v_actor or v_task.status<>'active' then
  raise exception 'task_not_cancellable' using errcode='42501'; end if;
 update public.work_tasks set status='cancelled' where id=p_task_id;
 insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status)
 values(p_operation_id,v_actor,p_task_id,'cancel',v_payload,'cancelled');
 return p_task_id;
end $$;

create function public.list_visible_work_tasks()
returns table(task_id uuid,title text,description text,scheduled_date date,location text,
 mode text,status text,total_cap integer,confirmed_count bigint,my_status text,is_creator boolean)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']);
begin
 return query select t.id,t.title,t.description,t.scheduled_date,t.location,t.mode,t.status,
  t.total_cap,(select count(*) from public.work_task_participants p
   where p.task_id=t.id and p.status in
    ('confirmed','completion_submitted','returned','verified')),
  mine.status,t.creator_id=v_actor
 from public.work_tasks t left join public.work_task_participants mine
  on mine.task_id=t.id and mine.member_id=v_actor
 where t.creator_id=v_actor or mine.member_id is not null
  or (t.mode in ('open','mixed') and t.status='active')
 order by t.created_at desc,t.id desc;
end $$;

create function public.list_work_task_participants(p_task_id uuid)
returns table(member_id uuid,source text,status text,queue_no bigint,
 completion_note text,review_reason text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
begin
 if not exists(select 1 from public.work_tasks where id=p_task_id and creator_id=v_actor) then
  raise exception 'task_not_found' using errcode='42501'; end if;
 return query select p.member_id,p.source,p.status,p.queue_no,p.completion_note,p.review_reason
  from public.work_task_participants p where p.task_id=p_task_id
  order by p.queue_no nulls first,p.member_id;
end $$;

create function public.my_verified_task_count()
returns bigint language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']);
 v_count bigint;
begin
 select count(*) into v_count from public.work_task_participants p
  join public.work_tasks t on t.id=p.task_id
  where p.member_id=v_actor and p.status='verified' and t.status='active';
 return v_count;
end $$;

revoke all on function public.create_work_task(text,text,date,text,text,integer,integer,integer,uuid)
 from public,anon,authenticated;
revoke all on function public.invite_work_task_member(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.join_work_task(uuid,uuid) from public,anon,authenticated;
revoke all on function public.leave_work_task(uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_work_task_completion(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.review_work_task_completion(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.cancel_work_task(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.list_visible_work_tasks() from public,anon,authenticated;
revoke all on function public.list_work_task_participants(uuid) from public,anon,authenticated;
revoke all on function public.my_verified_task_count() from public,anon,authenticated;
grant execute on function public.create_work_task(text,text,date,text,text,integer,integer,integer,uuid)
 to authenticated;
grant execute on function public.invite_work_task_member(uuid,uuid,uuid) to authenticated;
grant execute on function public.join_work_task(uuid,uuid) to authenticated;
grant execute on function public.leave_work_task(uuid,uuid) to authenticated;
grant execute on function public.submit_work_task_completion(uuid,text,uuid) to authenticated;
grant execute on function public.review_work_task_completion(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.cancel_work_task(uuid,text,uuid) to authenticated;
grant execute on function public.list_visible_work_tasks() to authenticated;
grant execute on function public.list_work_task_participants(uuid) to authenticated;
grant execute on function public.my_verified_task_count() to authenticated;
commit;
