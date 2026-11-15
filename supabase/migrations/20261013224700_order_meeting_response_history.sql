begin;

-- A transaction gives all now() timestamps the same value. An identity
-- establishes the authoritative order of successive responses.
alter table public.committee_meeting_responses
  add column response_sequence bigint generated always as identity unique;
create index committee_meeting_responses_sequence_idx
  on public.committee_meeting_responses(meeting_id,application_user_id,response_sequence desc);

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
    order by r.application_user_id,r.response_sequence desc;
end;
$$;

commit;
