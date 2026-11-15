begin;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin','finance') and p.key = 'committee.meetings.read'
on conflict do nothing;

create or replace function public.can_read_committee_meeting(p_meeting_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, extensions as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
begin
  if v_actor is null or not public.has_application_permission('committee.meetings.read') then
    return false; end if;
  select r.key into v_role from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id where aur.application_user_id = v_actor limit 1;
  if v_role in ('system_admin','president','vice_president','secretary','auditor') then
    return true; end if;
  return exists (select 1 from public.committee_meeting_participants p
    where p.meeting_id = p_meeting_id and p.application_user_id = v_actor);
end;
$$;

-- An append-only response history preserves changes of mind and gives the
-- performance view a verifiable invitation outcome.
create table public.committee_meeting_responses (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete restrict,
  application_user_id uuid not null references public.application_users(id) on delete restrict,
  response text not null check (response in ('accepted','declined')),
  decline_reason text check (decline_reason is null or length(btrim(decline_reason)) between 1 and 1000),
  operation_id text not null check (length(btrim(operation_id)) between 1 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  responded_at timestamptz not null default now(),
  constraint committee_meeting_responses_reason_chk check (
    (response = 'accepted' and decline_reason is null) or
    (response = 'declined' and decline_reason is not null)
  ),
  unique(application_user_id,operation_id)
);
create index committee_meeting_responses_latest_idx
  on public.committee_meeting_responses(meeting_id,application_user_id,responded_at desc,id desc);
alter table public.committee_meeting_responses enable row level security;
create policy committee_meeting_responses_read on public.committee_meeting_responses
for select to authenticated using (
  application_user_id = public.current_application_user_id() or
  (public.can_read_committee_meeting(meeting_id) and
    exists (select 1 from public.committee_meetings m
      where m.id = meeting_id and m.created_by_application_user_id = public.current_application_user_id()))
);
revoke all on public.committee_meeting_responses from public,anon,authenticated;
grant select on public.committee_meeting_responses to authenticated;
grant all on public.committee_meeting_responses to service_role;

create or replace function public.reject_committee_meeting_response_change()
returns trigger language plpgsql set search_path = pg_catalog, extensions as $$
begin
  raise exception 'meeting_response_immutable' using errcode = '55000';
end;
$$;
revoke all on function public.reject_committee_meeting_response_change()
from public,anon,authenticated,service_role;
create trigger committee_meeting_responses_immutable
before update or delete on public.committee_meeting_responses
for each row execute function public.reject_committee_meeting_response_change();

create or replace function public.respond_to_committee_meeting(
  p_meeting_id uuid, p_response text, p_decline_reason text, p_operation_id text
) returns public.committee_meeting_responses
language plpgsql security definer set search_path = pg_catalog, extensions as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_meeting public.committee_meetings;
  v_response text := lower(btrim(p_response));
  v_reason text := nullif(btrim(p_decline_reason),'');
  v_operation text := nullif(btrim(p_operation_id),'');
  v_fingerprint text;
  v_existing public.committee_meeting_responses;
  v_result public.committee_meeting_responses;
begin
  if v_actor is null or not public.has_application_permission('committee.meetings.read')
    or not exists (select 1 from public.application_users u where u.id = v_actor and u.status = 'active') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_response not in ('accepted','declined') or v_response is null then
    raise exception 'invalid_response' using errcode = '22023'; end if;
  if (v_response = 'declined' and (v_reason is null or length(v_reason) > 1000))
    or (v_response = 'accepted' and v_reason is not null) then
    raise exception 'invalid_decline_reason' using errcode = '22023'; end if;
  if v_operation is null or length(v_operation) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := encode(digest(jsonb_build_object('meeting',p_meeting_id,
    'response',v_response,'reason',v_reason)::text,'sha256'),'hex');
  select * into v_existing from public.committee_meeting_responses
  where application_user_id = v_actor and operation_id = v_operation;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    return v_existing;
  end if;
  select * into v_meeting from public.committee_meetings
  where id = p_meeting_id for update;
  -- Recheck after the meeting lock so concurrent retries of one operation
  -- return the first result instead of racing into the unique constraint.
  select * into v_existing from public.committee_meeting_responses
  where application_user_id = v_actor and operation_id = v_operation;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    return v_existing;
  end if;
  if not found or v_meeting.status <> 'scheduled' or
    now() >= (((v_meeting.scheduled_start at time zone 'Asia/Kolkata')::date + 1)::timestamp
      at time zone 'Asia/Kolkata') then
    raise exception 'meeting_response_closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.committee_meeting_participants p
    where p.meeting_id = p_meeting_id and p.application_user_id = v_actor) then
    raise exception 'not_invited' using errcode = '42501'; end if;
  insert into public.committee_meeting_responses
    (meeting_id,application_user_id,response,decline_reason,operation_id,request_fingerprint)
  values (p_meeting_id,v_actor,v_response,v_reason,v_operation,v_fingerprint)
  returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.respond_to_committee_meeting(uuid,text,text,text)
from public,anon,authenticated,service_role;
grant execute on function public.respond_to_committee_meeting(uuid,text,text,text) to authenticated;

create or replace function public.list_committee_meeting_responses(p_meeting_id uuid)
returns table(application_user_id uuid,response text,decline_reason text,responded_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, extensions as $$
declare v_actor uuid := public.current_application_user_id();
begin
  if v_actor is null or not public.can_read_committee_meeting(p_meeting_id) then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
    select distinct on (r.application_user_id)
      r.application_user_id,r.response,r.decline_reason,r.responded_at
    from public.committee_meeting_responses r
    join public.committee_meetings m on m.id = r.meeting_id
    where r.meeting_id = p_meeting_id and
      (r.application_user_id = v_actor or m.created_by_application_user_id = v_actor)
    order by r.application_user_id,r.responded_at desc,r.id desc;
end;
$$;
revoke all on function public.list_committee_meeting_responses(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.list_committee_meeting_responses(uuid) to authenticated;

commit;
