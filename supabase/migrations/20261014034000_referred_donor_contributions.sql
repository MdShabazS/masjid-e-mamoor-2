-- Named, one-time donations brought by a member. Verification is the only
-- point at which the finance ledger and member activity recognize the amount.
begin;

insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key = 'system_admin' and p.key in ('donations.payments.create','finance.accounts.read')
on conflict do nothing;

create sequence public.referred_donation_receipt_number_seq;
revoke all on sequence public.referred_donation_receipt_number_seq from public, anon, authenticated;

create table public.referred_donor_contributions (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null check (length(btrim(donor_name)) between 1 and 160),
  amount_paise bigint not null check (amount_paise > 0),
  payment_method text not null check (payment_method in ('cash','upi','bank_transfer')),
  purpose text not null check (length(btrim(purpose)) between 1 and 200),
  donor_phone text check (donor_phone is null or length(btrim(donor_phone)) between 6 and 25),
  payment_reference text check (payment_reference is null or length(btrim(payment_reference)) between 1 and 120),
  donation_date date not null,
  submitted_by_application_user_id uuid not null references public.application_users(id) on delete restrict,
  referred_by_application_user_id uuid not null references public.application_users(id) on delete restrict,
  replaces_contribution_id uuid unique references public.referred_donor_contributions(id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted','verified','rejected')),
  submitted_operation_id text not null unique check (length(btrim(submitted_operation_id)) between 1 and 200),
  decided_operation_id text unique check (decided_operation_id is null or length(btrim(decided_operation_id)) between 1 and 200),
  reviewed_by_application_user_id uuid references public.application_users(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(btrim(rejection_reason)) between 1 and 1000),
  finance_account_id uuid references public.finance_accounts(id) on delete restrict,
  business_date date,
  receipt_number text unique,
  posted_transaction_id uuid unique references public.financial_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint referred_donor_decision_chk check (
    (status = 'submitted' and decided_operation_id is null and reviewed_by_application_user_id is null
      and reviewed_at is null and rejection_reason is null and finance_account_id is null
      and business_date is null and receipt_number is null and posted_transaction_id is null)
    or (status = 'rejected' and decided_operation_id is not null and reviewed_by_application_user_id is not null
      and reviewed_at is not null and rejection_reason is not null and finance_account_id is null
      and business_date is null and receipt_number is null and posted_transaction_id is null)
    or (status = 'verified' and decided_operation_id is not null and reviewed_by_application_user_id is not null
      and reviewed_at is not null and rejection_reason is null and finance_account_id is not null
      and business_date is not null and receipt_number is not null and posted_transaction_id is not null)
  )
);
create index referred_donor_referrer_idx on public.referred_donor_contributions
  (referred_by_application_user_id, created_at desc);
create index referred_donor_submitter_idx on public.referred_donor_contributions
  (submitted_by_application_user_id, created_at desc);
create index referred_donor_pending_idx on public.referred_donor_contributions (created_at, id)
  where status = 'submitted';

create table public.referred_donor_events (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.referred_donor_contributions(id) on delete restrict,
  actor_application_user_id uuid not null references public.application_users(id) on delete restrict,
  action text not null check (action in ('submitted','verified','rejected')),
  operation_id text not null unique,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create trigger referred_donor_events_immutable before update or delete on public.referred_donor_events
  for each row execute function public.reject_finance_immutable_change();

alter table public.referred_donor_contributions enable row level security;
alter table public.referred_donor_events enable row level security;
create policy referred_donor_read on public.referred_donor_contributions for select to authenticated
  using ((referred_by_application_user_id = (
    select u.id from public.application_users u where u.auth_user_id = auth.uid() and u.status = 'active'
  ) or submitted_by_application_user_id = (
    select u.id from public.application_users u where u.auth_user_id = auth.uid() and u.status = 'active'
  )) or public.has_application_permission('donations.payments.verify')
  or public.current_application_role() = 'system_admin');
revoke all on public.referred_donor_contributions from public, anon, authenticated;
revoke all on public.referred_donor_events from public, anon, authenticated;
grant select on public.referred_donor_contributions to authenticated;

alter table public.financial_transactions drop constraint financial_transactions_reference_type_chk;
alter table public.financial_transactions add constraint financial_transactions_reference_type_chk check (
  reference_type in ('donation_payment','additional_donation','anonymous_donation',
    'jummah_cash_donation','finance_expense','finance_transfer','finance_adjustment',
    'referred_donor_contribution')
);

create function public.list_donation_referrers()
returns table (application_user_id uuid, display_name text)
language plpgsql stable security definer set search_path = pg_catalog, extensions as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.application_users u where u.auth_user_id = auth.uid() and u.status = 'active'
  ) or not public.has_application_permission('donations.payments.create') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query select u.id, coalesce(nullif(btrim(u.display_name), ''),
    nullif(btrim(u.username), ''), 'Member ' || left(u.id::text, 8))::text
    from public.application_users u where u.status = 'active'
    order by 2, u.id;
end;
$$;

create function public.submit_referred_donor_contribution(
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
    if not found or v_original.status <> 'rejected'
       or v_original.submitted_by_application_user_id <> v_actor
       or exists (select 1 from public.referred_donor_contributions revised
         where revised.replaces_contribution_id = p_replaces_contribution_id) then
      raise exception 'rejected_contribution_not_revisable' using errcode = '22023';
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

create function public.decide_referred_donor_contribution(
  p_contribution_id uuid, p_approve boolean, p_finance_account_id uuid,
  p_business_date date, p_reason text, p_operation_id text
) returns public.referred_donor_contributions
language plpgsql security definer set search_path = pg_catalog, extensions as $$
declare
  v_actor uuid;
  v_row public.referred_donor_contributions;
  v_account public.finance_accounts;
  v_transaction_id uuid;
  v_receipt text;
begin
  v_actor := public.lock_active_finance_actor();
  if public.current_application_role() <> 'finance'
     or not public.has_application_permission('donations.payments.verify') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_contribution_id is null or p_approve is null or p_operation_id is null
     or length(btrim(p_operation_id)) not between 1 and 200 then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  select * into v_row from public.referred_donor_contributions
    where id = p_contribution_id for update;
  if not found then raise exception 'contribution_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'submitted' then
    if v_row.decided_operation_id = p_operation_id
       and v_row.reviewed_by_application_user_id = v_actor
       and ((p_approve and v_row.status = 'verified'
         and v_row.finance_account_id = p_finance_account_id and v_row.business_date = p_business_date)
        or (not p_approve and v_row.status = 'rejected' and v_row.rejection_reason = btrim(p_reason))) then
      return v_row;
    end if;
    raise exception 'contribution_already_decided' using errcode = '23505';
  end if;
  if v_row.submitted_by_application_user_id = v_actor then
    raise exception 'self_verification_forbidden' using errcode = '42501';
  end if;
  if p_approve then
    if p_finance_account_id is null or p_business_date is null then
      raise exception 'posting_details_required' using errcode = '22023';
    end if;
    select * into v_account from public.finance_accounts where id = p_finance_account_id for update;
    if not found or v_account.status <> 'active' then
      raise exception 'finance_account_not_active' using errcode = '22023';
    end if;
    v_receipt := 'MEM2-' || to_char(p_business_date, 'YYYY') || '-'
      || lpad(nextval('public.referred_donation_receipt_number_seq'::regclass)::text, 8, '0');
    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise, currency,
      business_date, reference_type, reference_id, operation_id, created_by_application_user_id
    ) values (
      v_account.id, 'DONATION_ADDITIONAL', 'inflow', v_row.amount_paise, 'INR',
      p_business_date, 'referred_donor_contribution', v_row.id, p_operation_id, v_actor
    ) returning id into v_transaction_id;
    update public.referred_donor_contributions set status = 'verified',
      decided_operation_id = p_operation_id, reviewed_by_application_user_id = v_actor,
      reviewed_at = now(), finance_account_id = v_account.id,
      business_date = p_business_date, receipt_number = v_receipt,
      posted_transaction_id = v_transaction_id where id = v_row.id returning * into v_row;
  else
    if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
      raise exception 'rejection_reason_required' using errcode = '22023';
    end if;
    update public.referred_donor_contributions set status = 'rejected',
      decided_operation_id = p_operation_id, reviewed_by_application_user_id = v_actor,
      reviewed_at = now(), rejection_reason = btrim(p_reason)
      where id = v_row.id returning * into v_row;
  end if;
  insert into public.referred_donor_events
    (contribution_id, actor_application_user_id, action, operation_id, details)
  values (v_row.id, v_actor, case when p_approve then 'verified' else 'rejected' end,
    p_operation_id, jsonb_build_object('finance_account_id', v_row.finance_account_id,
      'business_date', v_row.business_date, 'receipt_number', v_row.receipt_number,
      'posted_transaction_id', v_row.posted_transaction_id, 'reason', v_row.rejection_reason));
  return v_row;
end;
$$;

revoke all on function public.list_donation_referrers() from public, anon, authenticated, service_role;
grant execute on function public.list_donation_referrers() to authenticated;
revoke all on function public.submit_referred_donor_contribution(text,bigint,text,text,uuid,text,date,text,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_referred_donor_contribution(text,bigint,text,text,uuid,text,date,text,text,uuid) to authenticated;
revoke all on function public.decide_referred_donor_contribution(uuid,boolean,uuid,date,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.decide_referred_donor_contribution(uuid,boolean,uuid,date,text,text) to authenticated;

commit;
