-- A-PERF1 "Activity points" (owner decision 17 October 2026): verified task completions +
-- attended meetings + at most one referral point per referred donor per month. Each part
-- shows its count out of its total. It is computed live from source records, so a void,
-- correction or cancelled task changes the number at once. One member at a time: no ranking.
begin;
create function public.member_activity(p_member_id uuid,p_start date,p_end_exclusive date)
returns table(username text,role text,task_points integer,tasks_joined integer,
 meeting_points integer,meetings_finalized integer,meetings_declined integer,meetings_absent integer,
 referral_points integer,referral_months_requested integer,activity_points integer)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_tasks integer; v_joined integer; v_attended integer; v_finalized integer;
 v_declined integer; v_absent integer; v_referral integer; v_requested integer;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary',
  'treasurer','committee_member','member','data_entry']);
 if p_member_id is null or p_start is null or p_end_exclusive is null
  or p_end_exclusive<=p_start or p_end_exclusive>p_start+366 then
  raise exception 'invalid_activity_period' using errcode='22023'; end if;
 if not exists(select 1 from public.app_users u where u.id=p_member_id and u.active
   and u.role<>'system_admin') then
  raise exception 'member_not_found' using errcode='22023'; end if;

 -- A point needs the creator's acceptance on an active task; cancelling the task removes it.
 select count(*) into v_tasks from public.work_task_participants p
  join public.work_tasks t on t.id=p.task_id and t.status='active'
  where p.member_id=p_member_id and p.status='verified'
   and exists(select 1 from public.work_task_operations o
    where o.task_id=p.task_id and o.action='review' and o.result_status='verified'
     and o.payload->>'member'=p_member_id::text
     and (o.occurred_at at time zone 'Asia/Kolkata')::date>=p_start
     and (o.occurred_at at time zone 'Asia/Kolkata')::date<p_end_exclusive);
 select count(*) into v_joined from public.work_task_participants p
  join public.work_tasks t on t.id=p.task_id and t.status='active'
  where p.member_id=p_member_id and p.joined_at is not null
   and (p.joined_at at time zone 'Asia/Kolkata')::date>=p_start
   and (p.joined_at at time zone 'Asia/Kolkata')::date<p_end_exclusive;

 -- Only a finalized roster counts, so an open meeting cannot show a premature absence.
 select count(*) filter (where r.outcome='attended'),count(*),
  count(*) filter (where r.outcome='declined'),count(*) filter (where r.outcome='absent')
  into v_attended,v_finalized,v_declined,v_absent
  from public.committee_meeting_roster r
  join public.committee_meetings m on m.id=r.meeting_id
  where r.member_id=p_member_id and m.meeting_date>=p_start and m.meeting_date<p_end_exclusive;

 -- Follow each verified payment through any correction chain; it still earns a point only if
 -- its last version stands. A void without a replacement ends the chain.
 with recursive chain(origin,effect_id) as (
  select e.id,e.id from public.finance_effects e where e.source_type='monthly_contribution'
  union all
  select ch.origin,r.id from chain ch
   join public.finance_corrections c on c.original_effect_id=ch.effect_id
   join public.finance_effects r on r.source_type='correction' and r.source_id=c.id and r.leg=2
 ), live as (
  select distinct ch.origin from chain ch
  where not exists(select 1 from public.finance_corrections c where c.original_effect_id=ch.effect_id)
 )
 select count(distinct (pc.donor_id,pc.period_date)) into v_referral
  from live
  join public.finance_effects e on e.id=live.origin
  join public.ledger_entries le on le.id=e.source_id
  join public.payment_claims pc on pc.id=le.source_id
  join public.monthly_donors d on d.id=pc.donor_id
  where d.referrer_id=p_member_id and pc.period_date>=p_start and pc.period_date<p_end_exclusive;
 select count(*) into v_requested from public.monthly_requests q
  join public.monthly_donors d on d.id=q.donor_id
  where d.referrer_id=p_member_id and q.period_date>=p_start and q.period_date<p_end_exclusive;

 return query select a.username,u.role,v_tasks,v_joined,v_attended,v_finalized,v_declined,v_absent,
  v_referral,v_requested,v_tasks+v_attended+v_referral
  from public.app_users u join app_private.username_aliases a on a.user_id=u.id
  where u.id=p_member_id;
end $$;
revoke all on function public.member_activity(uuid,date,date) from public,anon,authenticated;
grant execute on function public.member_activity(uuid,date,date) to authenticated;
commit;
