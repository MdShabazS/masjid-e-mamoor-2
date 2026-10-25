-- Phase 6 collection task: one pending count per task, verified money only.
-- A shared immutable slip claim rejects reuse across direct and task paths.
begin;

create table public.cash_slip_claims (
  evidence_key text primary key check (length(evidence_key) between 3 and 240),
  source_kind text not null check (source_kind in ('direct','task_count','one_time')),
  source_id uuid not null,
  claimed_at timestamptz not null default now(),
  unique(source_kind,source_id)
);
alter table public.cash_slip_claims enable row level security;
revoke all on public.cash_slip_claims from public,anon,authenticated;
create trigger cash_slip_claims_immutable before update or delete on public.cash_slip_claims
  for each row execute function app_private.reject_immutable_finance_change();
insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
  select evidence_key,'direct',donation_id from public.direct_cash_posts;
insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
  select lower(btrim(d.evidence_reference)),'one_time',d.id
  from public.one_time_donations d
  where d.payment_method='cash' and d.status='verified'
    and not exists(select 1 from public.direct_cash_posts p where p.donation_id=d.id);

create function app_private.claim_direct_cash_slip() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
  values(new.evidence_key,'direct',new.donation_id) on conflict(evidence_key) do nothing;
  if not exists(select 1 from public.cash_slip_claims c
    where c.evidence_key=new.evidence_key and c.source_id=new.donation_id
      and c.source_kind in ('direct','one_time')) then
    raise exception 'cash_slip_already_claimed' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function app_private.claim_direct_cash_slip() from public,anon,authenticated;
create trigger direct_cash_claim_slip after insert on public.direct_cash_posts
  for each row execute function app_private.claim_direct_cash_slip();

create table public.cash_collection_tasks (
  task_id uuid primary key references public.work_tasks(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.cash_collection_tasks enable row level security;
revoke all on public.cash_collection_tasks from public,anon,authenticated;
create trigger cash_collection_tasks_immutable before update or delete on public.cash_collection_tasks
  for each row execute function app_private.reject_immutable_finance_change();

create table public.cash_task_counts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.cash_collection_tasks(task_id) on delete restrict,
  submission_operation_id uuid not null unique,
  submitted_by uuid not null references public.app_users(id) on delete restrict,
  counted_date date not null,
  claimed_amount_paise bigint not null check (claimed_amount_paise>0),
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  evidence_key text not null unique check (length(evidence_key) between 3 and 240),
  status text not null default 'pending' check (status in ('pending','verified')),
  submitted_at timestamptz not null default now(),
  verification_operation_id uuid unique,
  verified_by uuid references public.app_users(id) on delete restrict,
  verified_at timestamptz,
  actual_amount_paise bigint check (actual_amount_paise>0),
  account_id uuid references public.masjid_accounts(id) on delete restrict,
  donation_id uuid unique references public.one_time_donations(id) on delete restrict,
  check ((status='pending' and verification_operation_id is null and verified_by is null
      and verified_at is null and actual_amount_paise is null and account_id is null
      and donation_id is null)
    or (status='verified' and verification_operation_id is not null and verified_by is not null
      and verified_at is not null and actual_amount_paise>0 and account_id is not null
      and donation_id is not null))
);
alter table public.cash_task_counts enable row level security;
revoke all on public.cash_task_counts from public,anon,authenticated;
create function app_private.guard_cash_task_count() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if old.status<>'pending' or new.status<>'verified'
    or (to_jsonb(old) - array['status','verification_operation_id','verified_by',
      'verified_at','actual_amount_paise','account_id','donation_id'])
      <> (to_jsonb(new) - array['status','verification_operation_id','verified_by',
      'verified_at','actual_amount_paise','account_id','donation_id']) then
    raise exception 'cash_count_immutable' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_cash_task_count() from public,anon,authenticated;
create trigger cash_task_counts_update before update on public.cash_task_counts
  for each row execute function app_private.guard_cash_task_count();
create trigger cash_task_counts_delete before delete on public.cash_task_counts
  for each row execute function app_private.reject_immutable_finance_change();

create table public.cash_task_verification_links (
  donation_id uuid primary key references public.one_time_donations(id) on delete restrict,
  count_id uuid not null unique references public.cash_task_counts(id) on delete restrict
);
alter table public.cash_task_verification_links enable row level security;
revoke all on public.cash_task_verification_links from public,anon,authenticated;
create trigger cash_task_verification_links_immutable before update or delete
  on public.cash_task_verification_links for each row
  execute function app_private.reject_immutable_finance_change();

create function app_private.claim_verified_cash_donation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_key text:=lower(btrim(new.evidence_reference));
 v_claim public.cash_slip_claims;
begin
  if new.status='verified' and old.status<>'verified' and new.payment_method='cash' then
    select * into v_claim from public.cash_slip_claims where evidence_key=v_key for update;
    if found then
      if v_claim.source_kind in ('direct','one_time') and v_claim.source_id=new.id then
        return new;
      end if;
      if v_claim.source_kind='task_count' and exists(
        select 1 from public.cash_task_verification_links l
        where l.donation_id=new.id and l.count_id=v_claim.source_id) then
        return new;
      end if;
      raise exception 'cash_slip_already_claimed' using errcode='23505';
    end if;
    insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
      values(v_key,'one_time',new.id);
  end if;
  return new;
end $$;
revoke all on function app_private.claim_verified_cash_donation()
  from public,anon,authenticated;
create trigger one_time_cash_claim_slip after update on public.one_time_donations
  for each row execute function app_private.claim_verified_cash_donation();

create function public.create_cash_collection_task(
  p_title text,p_description text,p_date date,p_location text,p_mode text,
  p_total integer,p_invited integer,p_volunteer integer,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary']);
 v_existing uuid; v_id uuid;
begin
  if p_operation_id is null then
    raise exception 'operation_id_required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,81));
  select task_id into v_existing from public.work_task_operations where id=p_operation_id;
  if found and not exists(select 1 from public.cash_collection_tasks where task_id=v_existing) then
    raise exception 'operation_id_conflict' using errcode='23505';
  end if;
  v_id:=public.create_work_task(p_title,p_description,p_date,p_location,p_mode,
    p_total,p_invited,p_volunteer,p_operation_id);
  insert into public.cash_collection_tasks(task_id) values(v_id) on conflict do nothing;
  return v_id;
end $$;

create function public.submit_cash_task_count(
  p_task_id uuid,p_date date,p_amount_paise bigint,p_evidence text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
  'committee_member','member','data_entry']);
 v_evidence text:=btrim(p_evidence); v_key text:=lower(btrim(p_evidence));
 v_old public.cash_task_counts; v_task public.work_tasks; v_id uuid;
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
  insert into public.cash_task_counts(task_id,submission_operation_id,submitted_by,
    counted_date,claimed_amount_paise,evidence_reference,evidence_key)
  values(p_task_id,p_operation_id,v_actor,p_date,p_amount_paise,v_evidence,v_key)
  returning id into v_id;
  insert into public.cash_slip_claims(evidence_key,source_kind,source_id)
    values(v_key,'task_count',v_id);
  return v_id;
end $$;

create function public.verify_cash_task_count(
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

create function public.list_cash_collection_workflow()
returns table(task_id uuid,title text,task_status text,my_status text,
  count_id uuid,count_status text,counted_date date,claimed_amount_paise text,
  evidence_reference text,actual_amount_paise text,donation_id uuid)
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
    case when v_is_treasurer or c.submitted_by=v_actor then c.donation_id end
  from public.cash_collection_tasks ct
    join public.work_tasks t on t.id=ct.task_id
    left join visible on visible.task_id=t.id
    left join public.cash_task_counts c on c.task_id=t.id
  where visible.task_id is not null or (v_is_treasurer and c.status='pending')
  order by t.created_at desc,t.id desc;
end $$;

revoke all on function public.create_cash_collection_task(text,text,date,text,text,integer,integer,integer,uuid)
  from public,anon,authenticated;
revoke all on function public.submit_cash_task_count(uuid,date,bigint,text,uuid)
  from public,anon,authenticated;
revoke all on function public.verify_cash_task_count(uuid,bigint,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.list_cash_collection_workflow()
  from public,anon,authenticated;
grant execute on function public.create_cash_collection_task(text,text,date,text,text,integer,integer,integer,uuid)
  to authenticated;
grant execute on function public.submit_cash_task_count(uuid,date,bigint,text,uuid)
  to authenticated;
grant execute on function public.verify_cash_task_count(uuid,bigint,uuid,uuid)
  to authenticated;
grant execute on function public.list_cash_collection_workflow() to authenticated;

commit;
