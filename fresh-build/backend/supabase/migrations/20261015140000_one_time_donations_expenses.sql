-- Phase 6 core money commands. Apply only after all earlier fresh-build migrations.
begin;

alter table public.finance_effects drop constraint finance_effects_source_type_check;
alter table public.finance_effects drop constraint finance_effects_check;
alter table public.finance_effects add constraint finance_effects_source_kind_check
  check (source_type in ('account_opening','monthly_contribution','transfer',
    'one_time_donation','expense_payment'));
alter table public.finance_effects add constraint finance_effects_amount_leg_check
  check ((source_type='account_opening' and leg=0 and amount_paise>=0)
    or (source_type in ('monthly_contribution','one_time_donation') and leg=0 and amount_paise>0)
    or (source_type='expense_payment' and leg=0 and amount_paise<0)
    or (source_type='transfer' and leg=1 and amount_paise<0)
    or (source_type='transfer' and leg=2 and amount_paise>0));

create table public.one_time_donations (
 id uuid primary key default gen_random_uuid(),
 submit_operation_id uuid not null unique,
 donor_name text not null check (length(btrim(donor_name)) between 1 and 200),
 donor_kind text not null check (donor_kind in ('member','other')),
 referrer_id uuid references public.app_users(id) on delete restrict,
 donation_date date not null,
 payment_method text not null check (payment_method in ('cash','upi','bank')),
 claimed_amount_paise bigint not null check (claimed_amount_paise>0),
 evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
 submitted_by uuid not null references public.app_users(id) on delete restrict,
 submitted_at timestamptz not null default now(),
 status text not null default 'pending' check (status in ('pending','verified','rejected')),
 decision_operation_id uuid unique,
 decided_by uuid references public.app_users(id) on delete restrict,
 decided_at timestamptz,
 rejection_reason text,
 actual_amount_paise bigint check (actual_amount_paise>0),
 account_id uuid references public.masjid_accounts(id) on delete restrict,
 receipt_code uuid unique,
 check ((status='pending' and decision_operation_id is null and decided_by is null
      and decided_at is null and rejection_reason is null and actual_amount_paise is null
      and account_id is null and receipt_code is null)
   or (status='rejected' and decision_operation_id is not null and decided_by is not null
      and decided_at is not null and length(btrim(rejection_reason)) between 3 and 240
      and actual_amount_paise is null and account_id is null and receipt_code is null)
   or (status='verified' and decision_operation_id is not null and decided_by is not null
      and decided_at is not null and rejection_reason is null and actual_amount_paise>0
      and account_id is not null and receipt_code is not null))
);
create table public.expense_requests (
 id uuid primary key default gen_random_uuid(),
 submit_operation_id uuid not null unique,
 requester_id uuid not null references public.app_users(id) on delete restrict,
 requester_role text not null,
 title text not null check (length(btrim(title)) between 1 and 160),
 description text not null check (length(btrim(description)) between 1 and 2000),
 category text not null check (length(btrim(category)) between 1 and 80),
 requested_amount_paise bigint not null check (requested_amount_paise>0),
 bill_reference text,
 missing_bill_reason text,
 submitted_at timestamptz not null default now(),
 status text not null default 'submitted' check (status in ('submitted','approved','rejected','partially_paid','paid')),
 decision_operation_id uuid unique,
 decided_by uuid references public.app_users(id) on delete restrict,
 decided_at timestamptz,
 rejection_reason text,
 check ((bill_reference is not null and length(btrim(bill_reference)) between 3 and 240)
    or (missing_bill_reason is not null and length(btrim(missing_bill_reason)) between 3 and 500)),
 check ((status='submitted' and decision_operation_id is null and decided_by is null and decided_at is null)
    or (status in ('approved','partially_paid','paid') and decision_operation_id is not null
      and decided_by is not null and decided_at is not null and rejection_reason is null)
    or (status='rejected' and decision_operation_id is not null and decided_by is not null
      and decided_at is not null and length(btrim(rejection_reason)) between 3 and 500))
);
create table public.expense_payments (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 expense_id uuid not null references public.expense_requests(id) on delete restrict,
 account_id uuid not null references public.masjid_accounts(id) on delete restrict,
 amount_paise bigint not null check (amount_paise>0),
 payment_method text not null check (payment_method in ('cash','upi','bank')),
 payment_date date not null,
 proof_reference text not null check (length(btrim(proof_reference)) between 3 and 240),
 posted_by uuid not null references public.app_users(id) on delete restrict,
 posted_at timestamptz not null default now()
);
create index expense_payments_expense on public.expense_payments(expense_id);

create function app_private.guard_phase6_transition() returns trigger language plpgsql
 set search_path=pg_catalog as $$
begin
 if tg_table_name='one_time_donations' then
   if old.status<>'pending' or new.status not in ('verified','rejected')
      or (to_jsonb(old) - array['status','decision_operation_id','decided_by','decided_at',
         'rejection_reason','actual_amount_paise','account_id','receipt_code'])
       <> (to_jsonb(new) - array['status','decision_operation_id','decided_by','decided_at',
         'rejection_reason','actual_amount_paise','account_id','receipt_code']) then
     raise exception 'donation_immutable' using errcode='42501'; end if;
 else
   if (old.status<>'submitted' and not (old.status='approved' and new.status in ('partially_paid','paid'))
      and not (old.status='partially_paid' and new.status='paid'))
      or (old.status='submitted' and new.status not in ('approved','rejected'))
      or (to_jsonb(old) - array['status','decision_operation_id','decided_by','decided_at','rejection_reason'])
       <> (to_jsonb(new) - array['status','decision_operation_id','decided_by','decided_at','rejection_reason']) then
     raise exception 'expense_immutable' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_phase6_transition() from public,anon,authenticated;
create trigger one_time_donations_update before update on public.one_time_donations
 for each row execute function app_private.guard_phase6_transition();
create trigger expense_requests_update before update on public.expense_requests
 for each row execute function app_private.guard_phase6_transition();
create trigger one_time_donations_delete before delete on public.one_time_donations
 for each row execute function app_private.reject_immutable_finance_change();
create trigger expense_requests_delete before delete on public.expense_requests
 for each row execute function app_private.reject_immutable_finance_change();
create trigger expense_payments_immutable before update or delete on public.expense_payments
 for each row execute function app_private.reject_immutable_finance_change();

do $$ declare v_name text; begin
 foreach v_name in array array['one_time_donations','expense_requests','expense_payments'] loop
  execute format('alter table public.%I enable row level security',v_name);
  execute format('revoke all on public.%I from public,anon,authenticated',v_name);
 end loop;
end $$;

create function public.submit_one_time_donation(p_name text,p_kind text,p_referrer_id uuid,
 p_date date,p_method text,p_amount_paise bigint,p_evidence text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','data_entry']); v_old public.one_time_donations; v_id uuid;
begin
 if p_operation_id is null or length(btrim(p_name)) not between 1 and 200
   or p_kind not in ('member','other') or p_date is null
   or p_date>(now() at time zone 'Asia/Kolkata')::date
   or p_method not in ('cash','upi','bank') or p_amount_paise is null or p_amount_paise<=0
   or length(btrim(p_evidence)) not between 3 and 240 then
  raise exception 'invalid_donation' using errcode='22023'; end if;
 if p_referrer_id is not null and not exists(select 1 from public.app_users
   where id=p_referrer_id and active) then
  raise exception 'invalid_referrer' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,61));
 select * into v_old from public.one_time_donations where submit_operation_id=p_operation_id;
 if found then
  if v_old.submitted_by<>v_actor or v_old.donor_name<>btrim(p_name)
    or v_old.donor_kind<>p_kind or v_old.referrer_id is distinct from p_referrer_id
    or v_old.donation_date<>p_date or v_old.payment_method<>p_method
    or v_old.claimed_amount_paise<>p_amount_paise or v_old.evidence_reference<>btrim(p_evidence) then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.one_time_donations(submit_operation_id,donor_name,donor_kind,referrer_id,
 donation_date,payment_method,claimed_amount_paise,evidence_reference,submitted_by)
 values(p_operation_id,btrim(p_name),p_kind,p_referrer_id,p_date,p_method,p_amount_paise,btrim(p_evidence),v_actor)
 returning id into v_id;
 return v_id;
end $$;

create function public.decide_one_time_donation(p_id uuid,p_decision text,p_actual_paise bigint,
 p_account_id uuid,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['treasurer']);
 v_old public.one_time_donations; v_kind text; v_reason text:=btrim(p_reason);
begin
 if p_operation_id is null or p_decision not in ('verify','reject')
   or (p_decision='verify' and (p_actual_paise is null or p_actual_paise<=0
      or p_account_id is null or p_reason is not null))
   or (p_decision='reject' and (p_actual_paise is not null or p_account_id is not null
      or length(v_reason) not between 3 and 240)) then
  raise exception 'invalid_donation_decision' using errcode='22023'; end if;
 select * into v_old from public.one_time_donations where id=p_id for update;
 if not found then raise exception 'donation_not_found' using errcode='22023'; end if;
 if v_old.decision_operation_id=p_operation_id and v_old.decided_by=v_actor
    and ((p_decision='verify' and v_old.status='verified')
      or (p_decision='reject' and v_old.status='rejected'))
    and v_old.actual_amount_paise is not distinct from p_actual_paise
    and v_old.account_id is not distinct from p_account_id
    and v_old.rejection_reason is not distinct from v_reason then return v_old.id; end if;
 if v_old.status<>'pending' then raise exception 'donation_already_decided' using errcode='22023'; end if;
 if p_decision='verify' then
  select a.kind into v_kind from public.masjid_accounts a where a.id=p_account_id and a.active for update;
  if v_kind is null or v_kind<>v_old.payment_method or not exists(
    select 1 from public.account_openings where account_id=p_account_id and verified_by is not null) then
   raise exception 'verified_matching_account_required' using errcode='22023'; end if;
  update public.one_time_donations set status='verified',decision_operation_id=p_operation_id,
    decided_by=v_actor,decided_at=now(),actual_amount_paise=p_actual_paise,
    account_id=p_account_id,receipt_code=gen_random_uuid() where id=p_id;
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
    values(p_account_id,'one_time_donation',p_id,0,p_actual_paise);
 else
  update public.one_time_donations set status='rejected',decision_operation_id=p_operation_id,
    decided_by=v_actor,decided_at=now(),rejection_reason=v_reason where id=p_id;
 end if;
 return p_id;
end $$;

create function public.submit_expense_request(p_title text,p_description text,p_category text,
 p_amount_paise bigint,p_bill text,p_missing_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president','vice_president',
 'secretary','treasurer','committee_member','member']); v_role text;
 v_old public.expense_requests; v_id uuid; v_bill text:=nullif(btrim(p_bill),'');
 v_missing text:=nullif(btrim(p_missing_reason),'');
begin
 if p_operation_id is null or length(btrim(p_title)) not between 1 and 160
   or length(btrim(p_description)) not between 1 and 2000
   or length(btrim(p_category)) not between 1 and 80
   or p_amount_paise is null or p_amount_paise<=0
   or (v_bill is null and v_missing is null)
   or (v_bill is not null and length(v_bill) not between 3 and 240)
   or (v_missing is not null and length(v_missing) not between 3 and 500) then
  raise exception 'invalid_expense' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,62));
 select * into v_old from public.expense_requests where submit_operation_id=p_operation_id;
 if found then
  if v_old.requester_id<>v_actor or v_old.title<>btrim(p_title)
   or v_old.description<>btrim(p_description) or v_old.category<>btrim(p_category)
   or v_old.requested_amount_paise<>p_amount_paise
   or v_old.bill_reference is distinct from v_bill
   or v_old.missing_bill_reason is distinct from v_missing then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 select role into v_role from public.app_users where id=v_actor;
 insert into public.expense_requests(submit_operation_id,requester_id,requester_role,
 title,description,category,requested_amount_paise,bill_reference,missing_bill_reason)
 values(p_operation_id,v_actor,v_role,btrim(p_title),btrim(p_description),btrim(p_category),
 p_amount_paise,v_bill,v_missing) returning id into v_id;
 return v_id;
end $$;

create function public.decide_expense_request(p_id uuid,p_decision text,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president','treasurer']);
 v_role text; v_old public.expense_requests; v_reason text:=nullif(btrim(p_reason),'');
begin
 if p_operation_id is null or p_decision not in ('approve','reject')
   or (p_decision='approve' and v_reason is not null)
   or (p_decision='reject' and length(v_reason) not between 3 and 500) then
  raise exception 'invalid_expense_decision' using errcode='22023'; end if;
 select * into v_old from public.expense_requests where id=p_id for update;
 if not found then raise exception 'expense_not_found' using errcode='22023'; end if;
 if v_old.decision_operation_id=p_operation_id and v_old.decided_by=v_actor
  and v_old.rejection_reason is not distinct from v_reason
  and ((p_decision='approve' and v_old.status in ('approved','partially_paid','paid'))
    or (p_decision='reject' and v_old.status='rejected')) then return p_id; end if;
 if v_old.status<>'submitted' or v_old.requester_id=v_actor then
  raise exception 'expense_not_decidable' using errcode='42501'; end if;
 select role into v_role from public.app_users where id=v_actor;
 if (v_old.requester_role='president' and v_role<>'treasurer')
   or (v_old.requester_role<>'president' and v_role<>'president') then
  raise exception 'wrong_expense_approver' using errcode='42501'; end if;
 update public.expense_requests set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 decision_operation_id=p_operation_id,decided_by=v_actor,decided_at=now(),rejection_reason=v_reason
 where id=p_id;
 return p_id;
end $$;

create function public.post_expense_payment(p_id uuid,p_account_id uuid,p_amount_paise bigint,
 p_method text,p_date date,p_proof text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['treasurer']);
 v_old public.expense_payments; v_request public.expense_requests;
 v_kind text; v_paid numeric; v_balance numeric; v_id uuid;
begin
 if p_operation_id is null or p_account_id is null or p_amount_paise is null or p_amount_paise<=0
   or p_method not in ('cash','upi','bank') or p_date is null
   or p_date>(now() at time zone 'Asia/Kolkata')::date
   or length(btrim(p_proof)) not between 3 and 240 then
  raise exception 'invalid_expense_payment' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,63));
 select * into v_old from public.expense_payments where operation_id=p_operation_id;
 if found then
  if v_old.posted_by<>v_actor or v_old.expense_id<>p_id or v_old.account_id<>p_account_id
    or v_old.amount_paise<>p_amount_paise or v_old.payment_method<>p_method
    or v_old.payment_date<>p_date or v_old.proof_reference<>btrim(p_proof) then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 -- Shared account lock serializes spending against transfers and other payments.
 select kind into v_kind from public.masjid_accounts where id=p_account_id and active for update;
 if v_kind is null or v_kind<>p_method or not exists(
  select 1 from public.account_openings where account_id=p_account_id and verified_by is not null) then
  raise exception 'verified_matching_account_required' using errcode='22023'; end if;
 select * into v_request from public.expense_requests where id=p_id for update;
 if not found or v_request.status not in ('approved','partially_paid') then
  raise exception 'expense_not_approved' using errcode='22023'; end if;
 select coalesce(sum(amount_paise::numeric),0) into v_paid
  from public.expense_payments where expense_id=p_id;
 if v_paid+p_amount_paise>v_request.requested_amount_paise then
  raise exception 'expense_overpayment' using errcode='22023'; end if;
 select coalesce(sum(amount_paise::numeric),0) into v_balance
  from public.finance_effects where account_id=p_account_id;
 if v_balance<p_amount_paise then
  raise exception 'insufficient_account_balance' using errcode='22023'; end if;
 insert into public.expense_payments(operation_id,expense_id,account_id,amount_paise,
 payment_method,payment_date,proof_reference,posted_by)
 values(p_operation_id,p_id,p_account_id,p_amount_paise,p_method,p_date,btrim(p_proof),v_actor)
 returning id into v_id;
 insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
 values(p_account_id,'expense_payment',v_id,0,-p_amount_paise);
 update public.expense_requests set status=case when v_paid+p_amount_paise=
   v_request.requested_amount_paise then 'paid' else 'partially_paid' end where id=p_id;
 return v_id;
end $$;

revoke all on function public.submit_one_time_donation(text,text,uuid,date,text,bigint,text,uuid)
 from public,anon,authenticated;
revoke all on function public.decide_one_time_donation(uuid,text,bigint,uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.submit_expense_request(text,text,text,bigint,text,text,uuid)
 from public,anon,authenticated;
revoke all on function public.decide_expense_request(uuid,text,text,uuid)
 from public,anon,authenticated;
revoke all on function public.post_expense_payment(uuid,uuid,bigint,text,date,text,uuid)
 from public,anon,authenticated;
grant execute on function public.submit_one_time_donation(text,text,uuid,date,text,bigint,text,uuid) to authenticated;
grant execute on function public.decide_one_time_donation(uuid,text,bigint,uuid,text,uuid) to authenticated;
grant execute on function public.submit_expense_request(text,text,text,bigint,text,text,uuid) to authenticated;
grant execute on function public.decide_expense_request(uuid,text,text,uuid) to authenticated;
grant execute on function public.post_expense_payment(uuid,uuid,bigint,text,date,text,uuid) to authenticated;
commit;
