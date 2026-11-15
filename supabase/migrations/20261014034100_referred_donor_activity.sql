-- Read-only factual activity, with no comparative score or donor identity.
-- Dates and end-of-day absence use the masjid's India calendar.
begin;

create or replace function public.list_member_activity(
  p_start_date date,
  p_end_date date
)
returns table (
  application_user_id uuid,
  display_name text,
  role_name text,
  task_assigned_count bigint,
  task_completed_count bigint,
  meeting_invited_count bigint,
  meeting_attended_count bigint,
  meeting_declined_count bigint,
  meeting_absent_count bigint,
  verified_referred_donation_count bigint,
  verified_referred_donation_paise bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.application_users caller
    where caller.auth_user_id = auth.uid() and caller.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null
    or p_end_date < p_start_date or p_end_date - p_start_date > 3660 then
    raise exception 'invalid_activity_range' using errcode = '22023';
  end if;

  return query
  with assigned as (
    select a.application_user_id, count(distinct a.task_id)::bigint total
    from public.committee_task_assignees a
    where (a.assigned_at at time zone 'Asia/Kolkata')::date
      between p_start_date and p_end_date
    group by a.application_user_id
  ), completed as (
    select a.application_user_id, count(distinct t.id)::bigint total
    from public.committee_task_assignees a
    join public.committee_tasks t on t.id = a.task_id
    where t.status = 'completed' and t.completed_at is not null
      and a.assigned_at <= t.completed_at
      and (a.removed_at is null or a.removed_at > t.completed_at)
      and (t.completed_at at time zone 'Asia/Kolkata')::date
        between p_start_date and p_end_date
    group by a.application_user_id
  ), meetings as (
    select p.application_user_id,
      count(*)::bigint invited,
      count(*) filter (where a.attendance_status = 'present')::bigint attended,
      count(*) filter (where a.attendance_status is distinct from 'present'
        and response.response = 'declined')::bigint declined,
      count(*) filter (where a.attendance_status is distinct from 'present'
        and response.response is distinct from 'declined'
        and (m.scheduled_start at time zone 'Asia/Kolkata')::date
          < (now() at time zone 'Asia/Kolkata')::date)::bigint absent
    from public.committee_meeting_participants p
    join public.committee_meetings m on m.id = p.meeting_id
    left join public.committee_meeting_attendance a
      on a.meeting_id = m.id and a.application_user_id = p.application_user_id
    left join lateral (
      select mr.response
      from public.committee_meeting_responses mr
      where mr.meeting_id = m.id and mr.application_user_id = p.application_user_id
      order by mr.response_sequence desc limit 1
    ) response on true
    where m.status = 'scheduled'
      and (m.scheduled_start at time zone 'Asia/Kolkata')::date
        between p_start_date and p_end_date
    group by p.application_user_id
  ), donation_sources as (
    select referrer.application_user_id, payment.id, payment.amount_paise
    from public.donation_payments payment
    join public.referrals referral
      on referral.referred_member_profile_id = payment.member_profile_id
      and referral.status = 'completed'
    join public.member_profiles referrer
      on referrer.id = referral.referrer_member_profile_id
    where payment.status = 'verified' and payment.reviewed_at is not null
      and (payment.reviewed_at at time zone 'Asia/Kolkata')::date
        between p_start_date and p_end_date
    union all
    select contribution.referred_by_application_user_id,
      contribution.id, contribution.amount_paise
    from public.referred_donor_contributions contribution
    where contribution.status = 'verified' and contribution.posted_transaction_id is not null
      and (contribution.reviewed_at at time zone 'Asia/Kolkata')::date
        between p_start_date and p_end_date
  ), donations as (
    select source.application_user_id,
      count(*)::bigint total,
      coalesce(sum(source.amount_paise), 0)::bigint amount_paise
    from donation_sources source
    group by source.application_user_id
  )
  select u.id, coalesce(nullif(btrim(u.display_name), ''),
      nullif(btrim(profile.display_name), ''), 'Member ' || left(u.id::text, 8))::text,
    r.name::text,
    coalesce(assigned.total, 0), coalesce(completed.total, 0),
    coalesce(meetings.invited, 0), coalesce(meetings.attended, 0),
    coalesce(meetings.declined, 0), coalesce(meetings.absent, 0),
    coalesce(donations.total, 0), coalesce(donations.amount_paise, 0)
  from public.application_users u
  join public.application_user_roles ur on ur.application_user_id = u.id
  join public.roles r on r.id = ur.role_id
  left join public.member_profiles profile on profile.application_user_id = u.id
  left join assigned on assigned.application_user_id = u.id
  left join completed on completed.application_user_id = u.id
  left join meetings on meetings.application_user_id = u.id
  left join donations on donations.application_user_id = u.id
  order by coalesce(nullif(btrim(u.display_name), ''),
    nullif(btrim(profile.display_name), ''), 'Member ' || left(u.id::text, 8)), u.id;
end;
$$;

revoke all on function public.list_member_activity(date,date)
  from public, anon, authenticated, service_role;
grant execute on function public.list_member_activity(date,date) to authenticated;

commit;
