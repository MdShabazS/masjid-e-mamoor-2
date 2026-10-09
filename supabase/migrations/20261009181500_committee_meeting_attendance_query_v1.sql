-- Masjid-e-Mamoor
-- Phase 11 closure:
-- explicit trusted getMeetingAttendance(meetingId) query.
--
-- This query does not introduce a new authorization model.
-- It deliberately reuses can_read_committee_meeting(meeting_id).
--
-- Authorized:
-- - President / Vice President / Secretary: organization-wide
-- - Auditor: organization-wide read-only
-- - Committee Member: participant-scoped
--
-- Unauthorized meeting scope is hidden as meeting_not_found.
-- Finance and ordinary Member receive no meeting attendance scope.

begin;


create or replace function
public.get_committee_meeting_attendance(
  p_meeting_id uuid
)
returns setof public.committee_meeting_attendance
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if p_meeting_id is null
     or not public.can_read_committee_meeting(
       p_meeting_id
     ) then

    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  return query
  select cma.*
  from public.committee_meeting_attendance cma
  where cma.meeting_id = p_meeting_id
  order by
    cma.application_user_id,
    cma.id;
end;
$$;


revoke execute
on function public.get_committee_meeting_attendance(uuid)
from public, anon, service_role;


grant execute
on function public.get_committee_meeting_attendance(uuid)
to authenticated;


commit;
