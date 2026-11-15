-- Rejection is an immutable audit event; a replacement uses a new numbered slip.
begin;

alter table public.cash_task_counts drop constraint cash_task_counts_task_id_key;
alter table public.cash_task_counts drop constraint cash_task_counts_status_check;
alter table public.cash_task_counts drop constraint cash_task_counts_check;
alter table public.cash_task_counts
  add column replaces_count_id uuid unique references public.cash_task_counts(id) on delete restrict,
  add column rejection_operation_id uuid unique,
  add column rejected_by uuid references public.app_users(id) on delete restrict,
  add column rejected_at timestamptz,
  add column rejection_reason text;
alter table public.cash_task_counts
  add constraint cash_task_counts_status_check check(status in ('pending','verified','rejected')),
  add constraint cash_task_counts_state_check check(
    (status='pending' and verification_operation_id is null and verified_by is null
      and verified_at is null and actual_amount_paise is null and account_id is null
      and donation_id is null and rejection_operation_id is null and rejected_by is null
      and rejected_at is null and rejection_reason is null)
    or (status='verified' and verification_operation_id is not null and verified_by is not null
      and verified_at is not null and actual_amount_paise>0 and account_id is not null
      and donation_id is not null and rejection_operation_id is null and rejected_by is null
      and rejected_at is null and rejection_reason is null)
    or (status='rejected' and verification_operation_id is null and verified_by is null
      and verified_at is null and actual_amount_paise is null and account_id is null
      and donation_id is null and rejection_operation_id is not null and rejected_by is not null
      and rejected_at is not null and length(btrim(rejection_reason)) between 3 and 240)
  );
create unique index cash_task_counts_one_live_per_task
  on public.cash_task_counts(task_id) where status in ('pending','verified');

create or replace function app_private.guard_cash_task_count() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if old.status<>'pending' or new.status not in ('verified','rejected')
    or (to_jsonb(old) - array['status','verification_operation_id','verified_by',
      'verified_at','actual_amount_paise','account_id','donation_id',
      'rejection_operation_id','rejected_by','rejected_at','rejection_reason'])
      <> (to_jsonb(new) - array['status','verification_operation_id','verified_by',
      'verified_at','actual_amount_paise','account_id','donation_id',
      'rejection_operation_id','rejected_by','rejected_at','rejection_reason']) then
    raise exception 'cash_count_immutable' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function public.submit_cash_task_count(
  p_task_id uuid,p_date date,p_amount_paise bigint,p_evidence text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
  'committee_member','member','data_entry']);
 v_evidence text:=btrim(p_evidence); v_key text:=lower(btrim(p_evidence));
 v_old public.cash_task_counts; v_previous public.cash_task_counts;
 v_task public.work_tasks; v_id uuid;
begin
  if p_task_id is null or p_operation_id is null or p_date is null
    or p_date>(now() at time zone 'Asia/Kolkata')::date
    or p_amount_paise is null or p_amount_paise<=0
    or v_evidence is null or length(v_evidence) not between 3 and 240 then
    raise exception 'invalid_cash_count' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,66));
  select * into v_old from public.cash_task_counts where submission_operation_id=p_operation_id;
  if found then
    if v_old.submitted_by<>v_actor or v_old.task_id<>p_task_id
      or v_old.counted_date<>p_date or v_old.claimed_amount_paise<>p_amount_paise
      or v_old.evidence_reference<>v_evidence then
      raise exception 'operation_id_conflict' using errcode='23505';
    end if;
    return v_old.id;
  end if;
  select * into v_task from public.work_tasks where id=p_task_id for update;
  if not found or v_task.status<>'active'
    or not exists(select 1 from public.cash_collection_tasks where task_id=p_task_id)
    or not exists(select 1 from public.work_task_participants
      where task_id=p_task_id and member_id=v_actor and status in
        ('confirmed','completion_submitted','returned','verified')) then
    raise exception 'cash_count_not_allowed' using errcode='42501';
  end if;
  select * into v_previous from public.cash_task_counts c
    where c.task_id=p_task_id and not exists(
      select 1 from public.cash_task_counts successor where successor.replaces_count_id=c.id)
    for update of c;
  if found and v_previous.status<>'rejected' then
    raise exception 'cash_count_already_submitted' using errcode='23505';
  end if;
  insert into public.cash_task_counts(task_id,replaces_count_id,submission_operation_id,
    submitted_by,counted_date,claimed_amount_paise,evidence_reference,evidence_key)
  values(p_task_id,v_previous.id,p_operation_id,v_actor,p_date,p_amount_paise,v_evidence,v_key)
  returning id into v_id;
  insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
    values(v_key,'task_count',v_id);
  return v_id;
end $$;

create function public.reject_cash_task_count(
  p_count_id uuid,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_reason text:=btrim(p_reason); v_count public.cash_task_counts;
begin
  if p_count_id is null or p_operation_id is null
    or v_reason is null or length(v_reason) not between 3 and 240 then
    raise exception 'invalid_cash_rejection' using errcode='22023';
  end if;
  select * into v_count from public.cash_task_counts where id=p_count_id for update;
  if not found then raise exception 'cash_count_not_found' using errcode='22023'; end if;
  if v_count.status='rejected' then
    if v_count.rejected_by=v_actor and v_count.rejection_operation_id=p_operation_id
      and v_count.rejection_reason=v_reason then return v_count.id; end if;
    raise exception 'cash_count_already_rejected' using errcode='23505';
  end if;
  if v_count.status<>'pending' then
    raise exception 'cash_count_not_pending' using errcode='23505'; end if;
  update public.cash_task_counts set status='rejected',rejection_operation_id=p_operation_id,
    rejected_by=v_actor,rejected_at=now(),rejection_reason=v_reason where id=p_count_id;
  return p_count_id;
end $$;

create or replace function public.verify_cash_task_count(
  p_count_id uuid,p_actual_amount_paise bigint,p_account_id uuid,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_count public.cash_task_counts; v_task public.work_tasks; v_donation uuid;
begin
  if p_count_id is null or p_operation_id is null or p_account_id is null
    or p_actual_amount_paise is null or p_actual_amount_paise<=0 then
    raise exception 'invalid_cash_verification' using errcode='22023';
  end if;
  select * into v_count from public.cash_task_counts where id=p_count_id for update;
  if not found then raise exception 'cash_count_not_found' using errcode='22023'; end if;
  if v_count.submitted_by=v_actor then
    raise exception 'independent_cash_counter_required' using errcode='42501'; end if;
  if v_count.status='verified' then
    if v_count.verified_by=v_actor and v_count.verification_operation_id=p_operation_id
      and v_count.actual_amount_paise=p_actual_amount_paise
      and v_count.account_id=p_account_id then return v_count.donation_id; end if;
    raise exception 'cash_count_already_verified' using errcode='23505';
  end if;
  if v_count.status<>'pending' then
    raise exception 'cash_count_not_pending' using errcode='23505'; end if;
  select * into v_task from public.work_tasks where id=v_count.task_id for update;
  if v_task.status<>'active' then
    raise exception 'cash_task_not_active' using errcode='22023'; end if;
  v_donation:=public.submit_one_time_donation(
    'Collection task: '||left(v_task.title,183),'other',null,v_count.counted_date,
    'cash',v_count.claimed_amount_paise,v_count.evidence_reference,p_operation_id);
  insert into public.cash_task_verification_links(donation_id,count_id)
    values(v_donation,p_count_id);
  perform public.decide_one_time_donation(v_donation,'verify',p_actual_amount_paise,
    p_account_id,null,p_operation_id);
  update public.cash_task_counts set status='verified',verification_operation_id=p_operation_id,
    verified_by=v_actor,verified_at=now(),actual_amount_paise=p_actual_amount_paise,
    account_id=p_account_id,donation_id=v_donation where id=p_count_id;
  return v_donation;
end $$;

drop function public.list_cash_collection_workflow();
create function public.list_cash_collection_workflow()
returns table(task_id uuid,title text,task_status text,my_status text,
  count_id uuid,count_status text,counted_date date,claimed_amount_paise text,
  evidence_reference text,actual_amount_paise text,donation_id uuid,
  rejection_reason text,replaces_count_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
  'treasurer','committee_member','member','data_entry']);
 v_is_treasurer boolean;
begin
  select u.role='treasurer' into v_is_treasurer from public.app_users u where u.id=v_actor;
  return query
  with visible as materialized (select v.task_id,v.my_status
    from public.list_visible_work_tasks() v)
  select t.id,t.title,t.status,visible.my_status,
    case when v_is_treasurer or c.submitted_by=v_actor then c.id end,
    c.status,
    case when v_is_treasurer or c.submitted_by=v_actor then c.counted_date end,
    case when v_is_treasurer or c.submitted_by=v_actor then c.claimed_amount_paise::text end,
    case when v_is_treasurer or c.submitted_by=v_actor then c.evidence_reference end,
    case when v_is_treasurer or c.submitted_by=v_actor then c.actual_amount_paise::text end,
    case when v_is_treasurer or c.submitted_by=v_actor then c.donation_id end,
    case when v_is_treasurer or c.submitted_by=v_actor
      or visible.my_status in ('confirmed','completion_submitted','returned','verified')
      then c.rejection_reason end,
    case when v_is_treasurer or c.submitted_by=v_actor then c.replaces_count_id end
  from public.cash_collection_tasks ct
    join public.work_tasks t on t.id=ct.task_id
    left join visible on visible.task_id=t.id
    left join public.cash_task_counts c on c.task_id=t.id and not exists(
      select 1 from public.cash_task_counts successor where successor.replaces_count_id=c.id)
  where visible.task_id is not null or (v_is_treasurer and c.id is not null)
  order by t.created_at desc,t.id desc;
end $$;
revoke all on function public.list_cash_collection_workflow() from public,anon,authenticated;
grant execute on function public.list_cash_collection_workflow() to authenticated;
revoke all on function public.reject_cash_task_count(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reject_cash_task_count(uuid,text,uuid) to authenticated;

commit;
