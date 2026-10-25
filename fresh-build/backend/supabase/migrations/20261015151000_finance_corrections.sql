-- Treasurer corrections: keep original immutable, reverse it, optionally post a
-- replacement and issue a new receipt identity for corrected income.
begin;
alter table public.finance_effects drop constraint finance_effects_source_kind_check;
alter table public.finance_effects drop constraint finance_effects_amount_leg_check;
alter table public.finance_effects add constraint finance_effects_source_kind_check
 check(source_type in ('account_opening','monthly_contribution','one_time_donation',
  'expense_payment','transfer','correction'));
alter table public.finance_effects add constraint finance_effects_amount_leg_check
 check((source_type='account_opening' and leg=0 and amount_paise>=0)
  or (source_type in ('monthly_contribution','one_time_donation') and leg=0 and amount_paise>0)
  or (source_type='expense_payment' and leg=0 and amount_paise<0)
  or (source_type='transfer' and leg=1 and amount_paise<0)
  or (source_type='transfer' and leg=2 and amount_paise>0)
  or (source_type='correction' and leg in (1,2) and amount_paise<>0));

create table public.finance_corrections (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 original_effect_id uuid not null unique references public.finance_effects(id) on delete restrict,
 source_kind text not null check(source_kind in ('monthly_contribution','one_time_donation','expense_payment')),
 original_account_id uuid not null references public.masjid_accounts(id) on delete restrict,
 original_amount_paise bigint not null,
 replacement_account_id uuid references public.masjid_accounts(id) on delete restrict,
 replacement_amount_paise bigint,
 reason text not null check(length(btrim(reason)) between 3 and 500),
 corrected_by uuid not null references public.app_users(id) on delete restrict,
 corrected_at timestamptz not null default now(),
 check((replacement_account_id is null and replacement_amount_paise is null)
  or (replacement_account_id is not null and replacement_amount_paise is not null
   and replacement_amount_paise<>0))
);
create table public.finance_correction_receipts (
 correction_id uuid primary key references public.finance_corrections(id) on delete restrict,
 code text not null unique check(code ~ '^MEM2-R-[0-9A-F]{32}$'),
 amount_paise bigint not null check(amount_paise>0),
 issued_at timestamptz not null default now()
);
create trigger finance_corrections_immutable before update or delete on public.finance_corrections
 for each row execute function app_private.reject_immutable_finance_change();
create trigger finance_correction_receipts_immutable before update or delete on public.finance_correction_receipts
 for each row execute function app_private.reject_immutable_finance_change();
alter table public.finance_corrections enable row level security;
alter table public.finance_correction_receipts enable row level security;
revoke all on public.finance_corrections from public,anon,authenticated;
revoke all on public.finance_correction_receipts from public,anon,authenticated;
alter table app_private.finance_audit drop constraint finance_audit_event_check;
alter table app_private.finance_audit add constraint finance_audit_event_check
 check(event in ('account_created','account_deactivated','opening_submitted',
  'opening_verified','transfer_posted','posting_corrected'));

-- Each payment contributes only its current terminal effect to the expense.
-- A void contributes zero; a replacement contributes its corrected spend.
create function app_private.expense_effective_paid(p_expense_id uuid)
returns numeric language sql stable security definer set search_path=pg_catalog as $$
 with recursive chain(effect_id,amount_paise) as (
  select e.id,e.amount_paise from public.expense_payments p
   join public.finance_effects e on e.source_type='expense_payment' and e.source_id=p.id
   where p.expense_id=p_expense_id
  union all
  select replacement.id,replacement.amount_paise from chain current_effect
   join public.finance_corrections c on c.original_effect_id=current_effect.effect_id
    and c.source_kind='expense_payment'
   join public.finance_effects replacement on replacement.source_type='correction'
    and replacement.source_id=c.id and replacement.leg=2
 )
 select coalesce(sum(-e.amount_paise::numeric),0) from chain e
 where not exists(select 1 from public.finance_corrections c
  where c.original_effect_id=e.effect_id);
$$;
revoke all on function app_private.expense_effective_paid(uuid) from public,anon,authenticated;

create or replace function app_private.guard_phase6_transition() returns trigger language plpgsql
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
   if not ((old.status='submitted' and new.status in ('approved','rejected'))
      or (old.status in ('approved','partially_paid','paid')
        and new.status in ('approved','partially_paid','paid')))
      or (to_jsonb(old) - array['status','decision_operation_id','decided_by','decided_at','rejection_reason'])
       <> (to_jsonb(new) - array['status','decision_operation_id','decided_by','decided_at','rejection_reason']) then
     raise exception 'expense_immutable' using errcode='42501'; end if;
 end if;
 return new;
end $$;

create or replace function public.post_expense_payment(p_id uuid,p_account_id uuid,p_amount_paise bigint,
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
 select kind into v_kind from public.masjid_accounts where id=p_account_id and active for update;
 if v_kind is null or v_kind<>p_method or not exists(
  select 1 from public.account_openings where account_id=p_account_id and verified_by is not null) then
  raise exception 'verified_matching_account_required' using errcode='22023'; end if;
 select * into v_request from public.expense_requests where id=p_id for update;
 if not found or v_request.status not in ('approved','partially_paid') then
  raise exception 'expense_not_approved' using errcode='22023'; end if;
 v_paid:=app_private.expense_effective_paid(p_id);
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

create function public.correct_finance_posting(p_original_effect_id uuid,
 p_replacement_account_id uuid,p_replacement_amount_paise bigint,
 p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_original public.finance_effects; v_old public.finance_corrections;
 v_kind text; v_id uuid; v_account uuid; v_balance numeric; v_delta numeric;
 v_expense_id uuid; v_expense public.expense_requests; v_paid numeric;
 v_reason text:=btrim(p_reason);
begin
 if p_operation_id is null or p_original_effect_id is null
  or length(v_reason) not between 3 and 500
  or (p_replacement_account_id is null)<>(p_replacement_amount_paise is null)
  or p_replacement_amount_paise=0 then
  raise exception 'invalid_correction' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,85));
 select * into v_old from public.finance_corrections where operation_id=p_operation_id;
 if found then
  if v_old.corrected_by<>v_actor or v_old.original_effect_id<>p_original_effect_id
   or v_old.replacement_account_id is distinct from p_replacement_account_id
   or v_old.replacement_amount_paise is distinct from p_replacement_amount_paise
   or v_old.reason<>v_reason then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 select * into v_original from public.finance_effects where id=p_original_effect_id for update;
 if not found or (v_original.source_type not in ('monthly_contribution','one_time_donation','expense_payment')
   and not (v_original.source_type='correction' and v_original.leg=2)) then
  raise exception 'posting_not_correctable' using errcode='22023'; end if;
 if exists(select 1 from public.finance_corrections where original_effect_id=p_original_effect_id) then
  raise exception 'posting_already_corrected' using errcode='23505'; end if;
 v_kind:=case when v_original.source_type='correction' then
  (select source_kind from public.finance_corrections where id=v_original.source_id)
  else v_original.source_type end;
 if v_kind is null or (v_kind='expense_payment' and p_replacement_amount_paise>=0)
  or (v_kind<>'expense_payment' and p_replacement_amount_paise<=0) then
  raise exception 'invalid_replacement_sign' using errcode='22023'; end if;
 -- Every writer of finance effects locks its account. Lock both in stable order.
 for v_account in select id from public.masjid_accounts
  where id in (v_original.account_id,p_replacement_account_id) order by id for update loop
  null;
 end loop;
 if p_replacement_account_id is not null and not exists(select 1 from public.masjid_accounts a
  join public.account_openings o on o.account_id=a.id and o.verified_by is not null
  where a.id=p_replacement_account_id and a.active) then
  raise exception 'replacement_account_not_ready' using errcode='22023'; end if;
 if v_kind='expense_payment' then
  with recursive ancestors(source_type,source_id) as (
   select v_original.source_type,v_original.source_id
   union all
   select prior.source_type,prior.source_id from ancestors a
    join public.finance_corrections c on a.source_type='correction' and c.id=a.source_id
    join public.finance_effects prior on prior.id=c.original_effect_id
  )
  select p.expense_id into v_expense_id from ancestors a
   join public.expense_payments p on a.source_type='expense_payment' and p.id=a.source_id;
  select * into v_expense from public.expense_requests where id=v_expense_id for update;
  if not found or v_expense.status not in ('approved','partially_paid','paid') then
   raise exception 'expense_not_approved' using errcode='22023'; end if;
  v_paid:=app_private.expense_effective_paid(v_expense_id)
   +v_original.amount_paise::numeric-coalesce(p_replacement_amount_paise::numeric,0);
  if v_paid<0 or v_paid>v_expense.requested_amount_paise then
   raise exception 'expense_correction_out_of_bounds' using errcode='22023'; end if;
 end if;
 for v_account in select distinct id from public.masjid_accounts
  where id in (v_original.account_id,p_replacement_account_id) loop
  select coalesce(sum(amount_paise::numeric),0) into v_balance
    from public.finance_effects where account_id=v_account;
  v_delta:=case when v_account=v_original.account_id then -v_original.amount_paise::numeric else 0 end
    +case when v_account=p_replacement_account_id then p_replacement_amount_paise::numeric else 0 end;
  if v_balance+v_delta<0 then
   raise exception 'correction_overdraws_account' using errcode='22023'; end if;
 end loop;
 insert into public.finance_corrections(operation_id,original_effect_id,source_kind,
  original_account_id,original_amount_paise,replacement_account_id,
  replacement_amount_paise,reason,corrected_by)
 values(p_operation_id,p_original_effect_id,v_kind,v_original.account_id,
  v_original.amount_paise,p_replacement_account_id,p_replacement_amount_paise,v_reason,v_actor)
 returning id into v_id;
 insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
 values(v_original.account_id,'correction',v_id,1,-v_original.amount_paise);
 if p_replacement_account_id is not null then
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
   values(p_replacement_account_id,'correction',v_id,2,p_replacement_amount_paise);
  if v_kind<>'expense_payment' then
   insert into public.finance_correction_receipts(correction_id,code,amount_paise)
   values(v_id,'MEM2-R-'||upper(encode(extensions.gen_random_bytes(16),'hex')),
    p_replacement_amount_paise);
  end if;
 end if;
 if v_kind='expense_payment' then
  update public.expense_requests set status=case
   when v_paid=0 then 'approved'
   when v_paid=v_expense.requested_amount_paise then 'paid'
   else 'partially_paid' end where id=v_expense_id;
 end if;
 insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
 values(p_operation_id,v_actor,v_original.account_id,'posting_corrected',v_id);
 return v_id;
end $$;

-- A receipt is active only while its ledger effect has no correction. This
-- includes replacement receipts from a later correction chain.
create function public.finance_receipt_state(p_code text)
returns table(receipt_state text,amount_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_effect uuid; v_amount bigint;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer']);
 select e.id,r.amount_paise into v_effect,v_amount from public.monthly_receipts r
  join public.ledger_entries le on le.id=r.ledger_entry_id
  join public.finance_effects e on e.source_type='monthly_contribution' and e.source_id=le.id
  where r.code=p_code;
 if not found then
  select e.id,d.actual_amount_paise into v_effect,v_amount
   from public.one_time_donations d join public.finance_effects e
    on e.source_type='one_time_donation' and e.source_id=d.id
   where d.receipt_code::text=p_code;
 end if;
 if v_effect is null then
  select e.id,r.amount_paise into v_effect,v_amount
   from public.finance_correction_receipts r join public.finance_corrections c
    on c.id=r.correction_id join public.finance_effects e
    on e.source_type='correction' and e.source_id=c.id and e.leg=2
   where r.code=p_code;
 end if;
 if v_effect is null then return; end if;
 return query select case when exists(select 1 from public.finance_corrections
  where original_effect_id=v_effect) then 'superseded' else 'active' end,v_amount::text;
end $$;

create function public.list_correctable_finance_effects(p_account_id uuid)
returns table(effect_id uuid,effective_kind text,amount_paise text,occurred_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['treasurer']);
 if p_account_id is null or not exists(select 1 from public.masjid_accounts where id=p_account_id) then
  raise exception 'account_not_found' using errcode='22023'; end if;
 return query select e.id,coalesce(c.source_kind,e.source_type),e.amount_paise::text,e.occurred_at
 from public.finance_effects e
 left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id
 where e.account_id=p_account_id
  and (e.source_type in ('monthly_contribution','one_time_donation','expense_payment')
   or (e.source_type='correction' and e.leg=2))
  and not exists(select 1 from public.finance_corrections used
   where used.original_effect_id=e.id)
 order by e.occurred_at desc,e.id desc limit 100;
end $$;

create or replace function public.list_finance_report_lines(p_run_id uuid)
returns table(effect_id uuid,account_id uuid,source_type text,source_id uuid,leg smallint,
 category text,amount_paise text,occurred_at timestamptz,description text,
 proof_reference text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select e.id,e.account_id,e.source_type,e.source_id,e.leg,
  case when e.source_type='account_opening' then 'opening'
   when e.source_type='transfer' then 'transfer'
   when coalesce(c.source_kind,e.source_type)='expense_payment' then 'expense'
   else 'income' end,e.amount_paise::text,e.occurred_at,
  case when c.id is not null then 'Correction: '||c.reason
   when e.source_type='monthly_contribution' then d.name
   when e.source_type='one_time_donation' then od.donor_name
   when e.source_type='expense_payment' then er.title
   when e.source_type='transfer' then 'Account transfer'
   else 'Opening balance' end,
  case when v_run.include_proofs and e.source_type='expense_payment'
   then ep.proof_reference else null::text end
 from public.finance_report_effects snapshot
 join public.finance_effects e on e.id=snapshot.effect_id
 left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id
 left join public.ledger_entries le on e.source_type='monthly_contribution' and le.id=e.source_id
 left join public.payment_claims pc on pc.id=le.source_id
 left join public.monthly_donors d on d.id=pc.donor_id
 left join public.one_time_donations od on e.source_type='one_time_donation' and od.id=e.source_id
 left join public.expense_payments ep on e.source_type='expense_payment' and ep.id=e.source_id
 left join public.expense_requests er on er.id=ep.expense_id
 where snapshot.run_id=p_run_id
  and (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
  and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
 order by e.occurred_at,e.id;
end $$;

create or replace function public.list_finance_report_balances(p_run_id uuid)
returns table(account_id uuid,account_name text,opening_paise text,period_openings_paise text,income_paise text,
 expense_paise text,transfer_paise text,closing_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select a.account_id,a.account_name,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.start_date),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='account_opening'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type) in ('monthly_contribution','one_time_donation')),0)::text,
  coalesce(sum(-(e.amount_paise::numeric)) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type)='expense_payment'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='transfer'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date),0)::text
 from public.finance_report_accounts a
 left join (public.finance_report_effects snapshot
  join public.finance_effects e on e.id=snapshot.effect_id and snapshot.run_id=p_run_id
  left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id)
  on e.account_id=a.account_id
 where a.run_id=p_run_id
 group by a.account_id,a.account_name order by a.account_name,a.account_id;
end $$;

-- A voided monthly posting no longer suppresses future reminders; a positive
-- replacement still does. Walk replacement chains without mutating history.
create function app_private.monthly_effective_paid(p_donor_id uuid,p_period_date date)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 with recursive chain(effect_id,amount_paise) as (
  select e.id,e.amount_paise from public.payment_claims c
   join public.ledger_entries le on le.source_id=c.id
   join public.finance_effects e on e.source_type='monthly_contribution' and e.source_id=le.id
   where c.donor_id=p_donor_id and c.period_date=p_period_date
  union all
  select replacement.id,replacement.amount_paise from chain current_effect
   join public.finance_corrections c on c.original_effect_id=current_effect.effect_id
    and c.source_kind='monthly_contribution'
   join public.finance_effects replacement on replacement.source_type='correction'
    and replacement.source_id=c.id and replacement.leg=2
 )
 select exists(select 1 from chain e where e.amount_paise>0
  and not exists(select 1 from public.finance_corrections c
    where c.original_effect_id=e.effect_id));
$$;
revoke all on function app_private.monthly_effective_paid(uuid,date) from public,anon,authenticated;

create or replace function public.monthly_reminder_eligible(p_donor_id uuid,p_period_date date)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.monthly_donors d
  join public.monthly_requests r on r.donor_id=d.id and r.period_date=p_period_date
  where d.id=p_donor_id and d.active and d.opted_out_at is null
   and not app_private.monthly_effective_paid(d.id,p_period_date));
$$;

create or replace function app_private.monthly_message_eligible(p_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.monthly_message_outbox o
  join public.monthly_donors d on d.id=o.donor_id
  join public.monthly_requests r on r.id=o.request_id
  join public.masjid_accounts a on a.id=o.account_id
  join app_private.approved_consent_versions cv on cv.version=d.consent_version
  where o.id=p_id and d.active and d.opted_out_at is null and a.active
   and o.consent_version=d.consent_version and r.donor_id=o.donor_id
   and r.period_date=o.period_date and r.qr_sha256=o.qr_sha256
   and r.account_id=o.account_id
   and not app_private.monthly_effective_paid(o.donor_id,o.period_date)
   and (o.purpose<>'reminder' or exists(select 1 from public.monthly_message_outbox initial
    where initial.donor_id=o.donor_id and initial.period_date=o.period_date
     and initial.purpose='request' and initial.state='sent'
     and initial.sent_at<=now()-interval '5 days')));
$$;

create function public.list_pending_one_time_donations()
returns table(donation_id uuid,donor_name text,donation_date date,payment_method text,
 claimed_amount_paise text,evidence_reference text,submitted_by uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['treasurer']);
 return query select d.id,d.donor_name,d.donation_date,d.payment_method,
  d.claimed_amount_paise::text,d.evidence_reference,d.submitted_by
 from public.one_time_donations d where d.status='pending'
 order by d.submitted_at,d.id limit 100;
end $$;

create function public.list_actionable_expenses()
returns table(expense_id uuid,title text,description text,category text,
 requested_amount_paise text,effective_paid_paise text,status text,
 requester_id uuid,requester_role text,bill_reference text,missing_bill_reason text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','treasurer']);
 v_role text;
begin
 select u.role into v_role from public.app_users u where u.id=v_actor;
 return query select e.id,e.title,e.description,e.category,e.requested_amount_paise::text,
  app_private.expense_effective_paid(e.id)::text,e.status,e.requester_id,
  e.requester_role,e.bill_reference,e.missing_bill_reason
 from public.expense_requests e
 where (v_role='president' and e.status='submitted' and e.requester_id<>v_actor
   and e.requester_role<>'president')
  or (v_role='treasurer' and ((e.status='submitted' and e.requester_role='president'
    and e.requester_id<>v_actor) or e.status in ('approved','partially_paid')))
 order by e.submitted_at,e.id limit 100;
end $$;
revoke all on function public.correct_finance_posting(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.finance_receipt_state(text) from public,anon,authenticated;
revoke all on function public.list_correctable_finance_effects(uuid) from public,anon,authenticated;
revoke all on function public.list_pending_one_time_donations() from public,anon,authenticated;
revoke all on function public.list_actionable_expenses() from public,anon,authenticated;
grant execute on function public.correct_finance_posting(uuid,uuid,bigint,text,uuid) to authenticated;
grant execute on function public.finance_receipt_state(text) to authenticated;
grant execute on function public.list_correctable_finance_effects(uuid) to authenticated;
grant execute on function public.list_pending_one_time_donations() to authenticated;
grant execute on function public.list_actionable_expenses() to authenticated;
commit;
