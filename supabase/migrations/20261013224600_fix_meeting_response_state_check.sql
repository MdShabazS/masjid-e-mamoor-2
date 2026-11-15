begin;

-- A retry lookup changes FOUND; test the locked meeting row directly.
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
  if v_meeting.id is null or v_meeting.status <> 'scheduled' or
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

commit;
