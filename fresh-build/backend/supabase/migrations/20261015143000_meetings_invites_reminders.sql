-- Phase 9 first slice: invitation and reminder source; no physical attendance RPC.
begin;
create table public.committee_meetings (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.app_users(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null check(length(btrim(description)) between 1 and 2000),
 meeting_date date not null,
 starts_at timestamptz not null,
 location_label text check(location_label is null or length(btrim(location_label)) between 1 and 240),
 status text not null default 'active' check(status in ('active','cancelled')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((starts_at at time zone 'Asia/Kolkata')::date=meeting_date)
);
create table public.committee_meeting_invites (
 meeting_id uuid not null references public.committee_meetings(id) on delete restrict,
 member_id uuid not null references public.app_users(id) on delete restrict,
 status text not null default 'invited' check(status in ('invited','accepted','declined')),
 decline_reason text check(decline_reason is null or length(btrim(decline_reason)) between 1 and 500),
 invited_at timestamptz not null default now(),
 responded_at timestamptz,
 primary key(meeting_id,member_id),
 check((status='invited' and responded_at is null and decline_reason is null)
  or (status='accepted' and responded_at is not null and decline_reason is null)
  or (status='declined' and responded_at is not null))
);
create table public.committee_meeting_operations (
 id uuid primary key,
 actor_id uuid not null references public.app_users(id) on delete restrict,
 meeting_id uuid not null references public.committee_meetings(id) on delete restrict,
 action text not null,
 payload jsonb not null,
 occurred_at timestamptz not null default now()
);
create trigger committee_meeting_operations_immutable before update or delete
 on public.committee_meeting_operations for each row
 execute function app_private.reject_immutable_finance_change();
create table public.committee_meeting_reminder_outbox (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null,
 member_id uuid not null,
 purpose text not null default 'one_hour' check(purpose='one_hour'),
 queued_at timestamptz not null default now(),
 unique(meeting_id,member_id,purpose),
 foreign key(meeting_id,member_id) references public.committee_meeting_invites(meeting_id,member_id)
  on delete restrict
);
create trigger committee_meeting_reminder_immutable before update or delete
 on public.committee_meeting_reminder_outbox for each row
 execute function app_private.reject_immutable_finance_change();
do $$ declare v_name text; begin
 foreach v_name in array array['committee_meetings','committee_meeting_invites',
  'committee_meeting_operations','committee_meeting_reminder_outbox'] loop
  execute format('alter table public.%I enable row level security',v_name);
  execute format('revoke all on public.%I from public,anon,authenticated',v_name);
 end loop;
end $$;

create function app_private.meeting_replay(p_op uuid,p_actor uuid,p_meeting uuid,
 p_action text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_old public.committee_meeting_operations;
begin
 if p_op is null then raise exception 'operation_id_required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_op::text,91));
 select * into v_old from public.committee_meeting_operations where id=p_op;
 if not found then return false; end if;
 if v_old.actor_id<>p_actor or v_old.meeting_id<>p_meeting
  or v_old.action<>p_action or v_old.payload<>p_payload then
  raise exception 'operation_id_conflict' using errcode='23505'; end if;
 return true;
end $$;
revoke all on function app_private.meeting_replay(uuid,uuid,uuid,text,jsonb)
 from public,anon,authenticated;

create function public.create_committee_meeting(p_title text,p_description text,
 p_date date,p_starts_at timestamptz,p_location text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_title text:=btrim(p_title); v_description text:=btrim(p_description);
 v_location text:=nullif(btrim(p_location),''); v_payload jsonb; v_old public.committee_meeting_operations;
 v_id uuid;
begin
 if p_operation_id is null or length(v_title) not between 1 and 160
  or length(v_description) not between 1 and 2000
  or (v_location is not null and length(v_location)>240)
  or p_date is null or p_starts_at is null
  or (p_starts_at at time zone 'Asia/Kolkata')::date<>p_date then
  raise exception 'invalid_meeting' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('title',v_title,'description',v_description,'date',p_date,
  'starts',p_starts_at,'location',v_location);
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,91));
 select * into v_old from public.committee_meeting_operations where id=p_operation_id;
 if found then
  if v_old.actor_id<>v_actor or v_old.action<>'create' or v_old.payload<>v_payload then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.meeting_id;
 end if;
 if p_starts_at<=now() then raise exception 'meeting_start_in_past' using errcode='22023'; end if;
 insert into public.committee_meetings(creator_id,title,description,meeting_date,starts_at,location_label)
 values(v_actor,v_title,v_description,p_date,p_starts_at,v_location) returning id into v_id;
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,v_id,'create',v_payload);
 return v_id;
end $$;

create function public.invite_committee_meeting(p_meeting_id uuid,p_member_id uuid,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_meeting public.committee_meetings; v_payload jsonb:=jsonb_build_object('member',p_member_id);
begin
 if p_meeting_id is null or p_member_id is null then
  raise exception 'invalid_invitation' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'invite',v_payload) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
 if not found or v_meeting.creator_id<>v_actor or v_meeting.status<>'active'
  or v_meeting.starts_at<=now()
  or not exists(select 1 from public.app_users where id=p_member_id and active)
  or exists(select 1 from public.committee_meeting_invites
   where meeting_id=p_meeting_id and member_id=p_member_id) then
  raise exception 'invitation_not_allowed' using errcode='42501'; end if;
 insert into public.committee_meeting_invites(meeting_id,member_id)
 values(p_meeting_id,p_member_id);
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'invite',v_payload);
 return p_meeting_id;
end $$;

create function public.respond_committee_meeting(p_meeting_id uuid,p_response text,
 p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
 'secretary','treasurer','committee_member','member','data_entry']);
 v_meeting public.committee_meetings; v_invite public.committee_meeting_invites;
 v_reason text:=nullif(btrim(p_reason),'');
 v_payload jsonb:=jsonb_build_object('response',p_response,'reason',v_reason);
begin
 if p_meeting_id is null or p_response not in ('accept','decline')
  or (p_response='accept' and v_reason is not null)
  or (v_reason is not null and length(v_reason)>500) then
  raise exception 'invalid_rsvp' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'respond',v_payload) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
 select * into v_invite from public.committee_meeting_invites
  where meeting_id=p_meeting_id and member_id=v_actor for update;
 if v_meeting.status is distinct from 'active' or v_meeting.starts_at<=now()
  or v_invite.status is distinct from 'invited' then
  raise exception 'rsvp_not_allowed' using errcode='42501'; end if;
 update public.committee_meeting_invites set status=case when p_response='accept' then 'accepted' else 'declined' end,
  decline_reason=v_reason,responded_at=now() where meeting_id=p_meeting_id and member_id=v_actor;
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'respond',v_payload);
 return p_meeting_id;
end $$;

create function public.cancel_committee_meeting(p_meeting_id uuid,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_meeting public.committee_meetings; v_reason text:=btrim(p_reason);
 v_payload jsonb:=jsonb_build_object('reason',v_reason);
begin
 if p_meeting_id is null or length(v_reason) not between 3 and 500 then
  raise exception 'invalid_cancellation' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'cancel',v_payload) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
 if not found or v_meeting.creator_id<>v_actor or v_meeting.status<>'active' then
  raise exception 'meeting_not_cancellable' using errcode='42501'; end if;
 update public.committee_meetings set status='cancelled',revision=revision+1,updated_at=now()
 where id=p_meeting_id;
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'cancel',v_payload);
 return p_meeting_id;
end $$;

create function public.queue_due_committee_meeting_reminders(p_now timestamptz)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;
begin
 if p_now is null or abs(extract(epoch from (p_now-now())))>120 then
  raise exception 'not_authorized' using errcode='42501'; end if;
 insert into public.committee_meeting_reminder_outbox(meeting_id,member_id)
 select m.id,i.member_id from public.committee_meetings m
 join public.committee_meeting_invites i on i.meeting_id=m.id
 join public.app_users u on u.id=i.member_id and u.active
 where m.status='active' and i.status in ('invited','accepted')
  and m.starts_at-interval '1 hour'<=p_now and m.starts_at>p_now
 on conflict (meeting_id,member_id,purpose) do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

create function public.list_visible_committee_meetings()
returns table(meeting_id uuid,title text,description text,meeting_date date,
 starts_at timestamptz,location_label text,status text,my_rsvp text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
 'secretary','treasurer','committee_member','member','data_entry']);
begin
 return query select m.id,m.title,m.description,m.meeting_date,m.starts_at,m.location_label,
  m.status,i.status from public.committee_meetings m
 left join public.committee_meeting_invites i on i.meeting_id=m.id and i.member_id=v_actor
 where m.creator_id=v_actor or i.member_id is not null
 order by m.starts_at desc,m.id desc;
end $$;

revoke all on function public.create_committee_meeting(text,text,date,timestamptz,text,uuid)
 from public,anon,authenticated;
revoke all on function public.invite_committee_meeting(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.respond_committee_meeting(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.cancel_committee_meeting(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.queue_due_committee_meeting_reminders(timestamptz)
 from public,anon,authenticated;
revoke all on function public.list_visible_committee_meetings() from public,anon,authenticated;
grant execute on function public.create_committee_meeting(text,text,date,timestamptz,text,uuid)
 to authenticated;
grant execute on function public.invite_committee_meeting(uuid,uuid,uuid) to authenticated;
grant execute on function public.respond_committee_meeting(uuid,text,text,uuid) to authenticated;
grant execute on function public.cancel_committee_meeting(uuid,text,uuid) to authenticated;
grant execute on function public.queue_due_committee_meeting_reminders(timestamptz) to service_role;
grant execute on function public.list_visible_committee_meetings() to authenticated;
commit;
