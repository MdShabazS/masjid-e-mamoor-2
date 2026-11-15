-- A Treasurer voids a posted receipt with a current-day accounting reversal.
-- The original receipt and posted transaction remain immutable and auditable.
begin;

-- Enforce one full reversal per posted entry across receipt voids and the
-- generic Finance adjustment workflow.
create unique index financial_transactions_one_reversal_per_target_uidx
  on public.financial_transactions(related_transaction_id)
  where transaction_category='REVERSAL';

-- Generic adjustment reversals do not update the receipt's verified status.
-- Require the dedicated void operation for these postings, including when a
-- pending adjustment was submitted before this migration.
create function public.reject_generic_referred_donor_reversal()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.adjustment_type='reversal' and new.status in ('submitted','applied') and exists (
    select 1 from public.financial_transactions ft
    where ft.id=new.target_transaction_id
      and ft.reference_type='referred_donor_contribution'
      and ft.transaction_category='DONATION_ADDITIONAL'
  ) then
    raise exception 'use_referred_donor_void' using errcode='22023';
  end if;
  return new;
end;
$$;
create trigger finance_adjustments_referred_donor_reversal_guard
before insert or update of adjustment_type,target_transaction_id,status
on public.finance_adjustments for each row
execute function public.reject_generic_referred_donor_reversal();
revoke all on function public.reject_generic_referred_donor_reversal()
  from public,anon,authenticated,service_role;

alter table public.referred_donor_contributions
  add column voided_at timestamptz,
  add column voided_by_application_user_id uuid references public.application_users(id) on delete restrict,
  add column void_reason text check (void_reason is null or length(btrim(void_reason)) between 10 and 1000),
  add column reversal_transaction_id uuid unique references public.financial_transactions(id) on delete restrict;
alter table public.referred_donor_contributions drop constraint referred_donor_contributions_status_check;
alter table public.referred_donor_contributions add constraint referred_donor_contributions_status_check
  check (status in ('submitted','verified','rejected','voided'));
alter table public.referred_donor_contributions drop constraint referred_donor_decision_chk;
alter table public.referred_donor_contributions add constraint referred_donor_decision_chk check (
    (status = 'submitted' and decided_operation_id is null and reviewed_by_application_user_id is null
      and reviewed_at is null and rejection_reason is null and finance_account_id is null
      and business_date is null and receipt_number is null and posted_transaction_id is null)
    or (status = 'rejected' and decided_operation_id is not null and reviewed_by_application_user_id is not null
      and reviewed_at is not null and rejection_reason is not null and finance_account_id is null
      and business_date is null and receipt_number is null and posted_transaction_id is null)
    or (status in ('verified','voided') and decided_operation_id is not null
      and reviewed_by_application_user_id is not null and reviewed_at is not null
      and rejection_reason is null and finance_account_id is not null
      and business_date is not null and receipt_number is not null and posted_transaction_id is not null)
  );
alter table public.referred_donor_contributions add constraint referred_donor_void_state_chk check (
  (status = 'voided' and voided_at is not null and voided_by_application_user_id is not null
    and void_reason is not null and reversal_transaction_id is not null)
  or (status <> 'voided' and voided_at is null and voided_by_application_user_id is null
    and void_reason is null and reversal_transaction_id is null)
);
alter table public.referred_donor_events drop constraint referred_donor_events_action_check;
alter table public.referred_donor_events add constraint referred_donor_events_action_check
  check (action in ('submitted','verified','rejected','voided'));

create function public.void_referred_donor_contribution(
  p_contribution_id uuid, p_reason text, p_operation_id text
) returns public.referred_donor_contributions
language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare
  v_actor uuid;
  v_row public.referred_donor_contributions;
  v_reversal_id uuid;
begin
  v_actor := public.lock_active_finance_actor();
  if public.current_application_role() <> 'finance'
     or not public.has_application_permission('donations.payments.verify') then
    raise exception 'not_authorized' using errcode='42501'; end if;
  if p_contribution_id is null or p_reason is null or length(btrim(p_reason)) not between 10 and 1000
     or p_operation_id is null or length(btrim(p_operation_id)) not between 1 and 200 then
    raise exception 'invalid_void' using errcode='22023'; end if;
  select * into v_row from public.referred_donor_contributions
    where id=p_contribution_id for update;
  if not found then raise exception 'contribution_not_found' using errcode='P0002'; end if;
  if v_row.status='voided' and exists (
    select 1 from public.referred_donor_events e where e.contribution_id=v_row.id
      and e.action='voided' and e.operation_id=p_operation_id
      and e.actor_application_user_id=v_actor and e.details->>'reason'=btrim(p_reason)) then
    return v_row;
  end if;
  if v_row.status<>'verified' then
    raise exception 'contribution_not_verified' using errcode='23505'; end if;
  if exists (select 1 from public.financial_transactions ft
    where ft.related_transaction_id=v_row.posted_transaction_id
      and ft.transaction_category='REVERSAL') then
    raise exception 'posting_already_reversed' using errcode='23505'; end if;
  if exists (select 1 from public.referred_donor_contributions c
    where c.replaces_contribution_id=v_row.id) then
    raise exception 'contribution_already_corrected' using errcode='23505'; end if;
  insert into public.financial_transactions
    (finance_account_id,transaction_category,direction,amount_paise,currency,
      business_date,reference_type,reference_id,related_transaction_id,operation_id,
      created_by_application_user_id)
  values (v_row.finance_account_id,'REVERSAL','outflow',v_row.amount_paise,'INR',
    (now() at time zone 'Asia/Kolkata')::date,'referred_donor_contribution',v_row.id,
    v_row.posted_transaction_id,p_operation_id,v_actor)
  returning id into v_reversal_id;
  update public.referred_donor_contributions
    set status='voided',voided_at=now(),voided_by_application_user_id=v_actor,
      void_reason=btrim(p_reason),reversal_transaction_id=v_reversal_id
    where id=v_row.id returning * into v_row;
  insert into public.referred_donor_events
    (contribution_id,actor_application_user_id,action,operation_id,details)
  values (v_row.id,v_actor,'voided',p_operation_id,
    jsonb_build_object('reason',btrim(p_reason),'reversal_transaction_id',v_reversal_id,
      'original_posted_transaction_id',v_row.posted_transaction_id));
  return v_row;
end;
$$;
revoke all on function public.void_referred_donor_contribution(uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.void_referred_donor_contribution(uuid,text,text) to authenticated;

create or replace function public.submit_referred_donor_contribution(
  p_donor_name text, p_amount_paise bigint, p_payment_method text, p_operation_id text,
  p_referrer_application_user_id uuid, p_purpose text, p_donation_date date,
  p_donor_phone text, p_payment_reference text, p_replaces_contribution_id uuid default null
) returns public.referred_donor_contributions
language plpgsql security definer set search_path = pg_catalog, extensions as $$
declare
  v_actor uuid;
  v_referrer uuid;
  v_row public.referred_donor_contributions;
  v_original public.referred_donor_contributions;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('donations.payments.create') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_donor_name is null or length(btrim(p_donor_name)) not between 1 and 160
     or p_amount_paise is null or p_amount_paise <= 0
     or p_payment_method is null or p_payment_method not in ('cash','upi','bank_transfer')
     or p_purpose is null or length(btrim(p_purpose)) not between 1 and 200
     or p_donation_date is null or p_referrer_application_user_id is null
     or (p_donor_phone is not null and length(btrim(p_donor_phone)) not between 6 and 25)
     or (p_payment_reference is not null and length(btrim(p_payment_reference)) not between 1 and 120)
     or (p_payment_method in ('upi','bank_transfer') and nullif(btrim(p_payment_reference), '') is null)
     or p_operation_id is null or length(btrim(p_operation_id)) not between 1 and 200 then
    raise exception 'invalid_contribution' using errcode = '22023';
  end if;
  select u.id into v_referrer from public.application_users u
    where u.id = p_referrer_application_user_id and u.status = 'active' for update;
  if v_referrer is null then raise exception 'referrer_not_active' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('referred-donor-submit:' || p_operation_id, 0));
  select * into v_row from public.referred_donor_contributions where submitted_operation_id = p_operation_id;
  if found then
    if v_row.submitted_by_application_user_id <> v_actor
       or v_row.referred_by_application_user_id <> v_referrer
       or v_row.donor_name <> btrim(p_donor_name)
       or v_row.amount_paise <> p_amount_paise or v_row.payment_method <> p_payment_method
       or v_row.purpose <> btrim(p_purpose) or v_row.donation_date <> p_donation_date
       or v_row.donor_phone is distinct from nullif(btrim(p_donor_phone), '')
       or v_row.payment_reference is distinct from nullif(btrim(p_payment_reference), '')
       or v_row.replaces_contribution_id is distinct from p_replaces_contribution_id then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    return v_row;
  end if;
  if p_replaces_contribution_id is not null then
    select * into v_original from public.referred_donor_contributions
      where id = p_replaces_contribution_id for update;
    if not found or v_original.status not in ('rejected','voided')
       or v_original.submitted_by_application_user_id <> v_actor
       or exists (select 1 from public.referred_donor_contributions revised
         where revised.replaces_contribution_id = p_replaces_contribution_id) then
      raise exception 'contribution_not_revisable' using errcode = '22023';
    end if;
  end if;
  insert into public.referred_donor_contributions
    (donor_name, amount_paise, payment_method, purpose, donor_phone,
     payment_reference, donation_date, submitted_by_application_user_id,
     referred_by_application_user_id, submitted_operation_id, replaces_contribution_id)
  values (btrim(p_donor_name), p_amount_paise, p_payment_method, btrim(p_purpose),
    nullif(btrim(p_donor_phone), ''), nullif(btrim(p_payment_reference), ''),
    p_donation_date, v_actor, v_referrer, p_operation_id, p_replaces_contribution_id)
  returning * into v_row;
  insert into public.referred_donor_events (contribution_id, actor_application_user_id, action, operation_id)
  values (v_row.id, v_actor, 'submitted', p_operation_id);
  return v_row;
end;
$$;
commit;
