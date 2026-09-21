-- Donation Trusted Operations V1
--
-- Trusted command layer for the Donation domain established by migration 017.
--
-- Financial tables remain non-writable by authenticated clients directly.
-- All monetary values are integer paise.
-- Material financial mutations require explicit operation identities.

begin;

-- ============================================================================
-- Extend financial operation identities
-- ============================================================================

alter table public.donation_operation_idempotency
  drop constraint donation_operation_idempotency_operation_type_check;

alter table public.donation_operation_idempotency
  add constraint donation_operation_idempotency_operation_type_check
  check (
    operation_type in (
      'obligation_rule_create',
      'obligation_create',
      'obligation_waive',
      'payment_submit',
      'payment_review',
      'payment_reject',
      'payment_verify_allocate',
      'additional_donation_create'
    )
  );

-- ============================================================================
-- Trusted-operation implementation follows below.
--
-- Concurrency contract:
--   1. Normalize and validate operation_id.
--   2. Resolve authenticated application actor.
--   3. Validate permission/resource scope.
--   4. Build deterministic SHA-256 request fingerprint.
--   5. Serialize identical operation IDs with a transaction-scoped advisory
--      lock derived from operation_id before consulting the registry.
--   6. Matching replay returns the authoritative prior result.
--   7. Reuse with different operation/actor/target/fingerprint raises
--      operation_id_conflict (SQLSTATE 23505).
--   8. Financial rows are locked before calculating authoritative state.
--
-- The advisory lock closes the pre-check/insert race present in older
-- non-financial operation implementations without exposing the registry.
-- ============================================================================


-- ============================================================================
-- Create recurring donation obligation rule
-- ============================================================================

create or replace function public.create_donation_obligation_rule(
  p_effective_from_month date,
  p_monthly_amount_paise bigint,
  p_operation_id text
)
returns public.donation_obligation_rules
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_month date;
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_rule public.donation_obligation_rules;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.obligations.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_effective_from_month is null
     or p_effective_from_month <>
        date_trunc('month', p_effective_from_month)::date then
    raise exception 'invalid_effective_month' using errcode = '22023';
  end if;

  v_month := p_effective_from_month;

  if p_monthly_amount_paise is null or p_monthly_amount_paise <= 0 then
    raise exception 'invalid_monthly_amount' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'effective_from_month', v_month,
        'monthly_amount_paise', p_monthly_amount_paise
      )::text,
      'sha256'
    ),
    'hex'
  );

  -- Serialize all callers using this operation identity before checking
  -- or writing the idempotency registry.
  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'obligation_rule_create'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_rule
    from public.donation_obligation_rules
    where operation_id = v_operation_id;

    if v_rule.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_rule;
  end if;

  if exists (
    select 1
    from public.donation_obligation_rules
    where effective_from_month = v_month
  ) then
    raise exception 'obligation_rule_month_exists' using errcode = '23505';
  end if;

  insert into public.donation_obligation_rules (
    effective_from_month,
    monthly_amount_paise,
    created_by_application_user_id,
    operation_id
  )
  values (
    v_month,
    p_monthly_amount_paise,
    v_actor,
    v_operation_id
  )
  returning * into v_rule;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'obligation_rule_create',
    v_actor,
    v_fingerprint
  );

  return v_rule;
end;
$$;

-- ============================================================================
-- Generate one calendar month's member obligations
-- ============================================================================

create or replace function public.generate_monthly_donation_obligations(
  p_effective_month date,
  p_operation_id text
)
returns table (
  effective_month date,
  obligation_rule_id uuid,
  authoritative_amount_paise bigint,
  created_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_month date;
  v_rule public.donation_obligation_rules;
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_created_count integer := 0;
  v_command_tag text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.obligations.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_effective_month is null
     or p_effective_month <>
        date_trunc('month', p_effective_month)::date then
    raise exception 'invalid_effective_month' using errcode = '22023';
  end if;

  v_month := p_effective_month;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_command_tag := encode(
    digest(v_operation_id, 'sha256'),
    'hex'
  );

  -- Select the latest rule effective on or before the requested month.
  select r.*
  into v_rule
  from public.donation_obligation_rules r
  where r.effective_from_month <= v_month
  order by r.effective_from_month desc, r.id desc
  limit 1;

  if v_rule.id is null then
    raise exception 'obligation_rule_not_found' using errcode = 'P0002';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'effective_month', v_month,
        'obligation_rule_id', v_rule.id,
        'authoritative_amount_paise', v_rule.monthly_amount_paise
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  -- Also serialize generation for the same business month even when callers
  -- accidentally supply different operation IDs.
  perform pg_advisory_xact_lock(
    hashtextextended('donation-obligation-month:' || v_month::text, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'obligation_create'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select count(*)::integer
    into v_created_count
    from public.donation_obligations o
    where o.effective_month = v_month
      and o.obligation_rule_id = v_rule.id
      and o.created_by_application_user_id = v_actor
      and o.operation_id like
        'monthly:' || v_command_tag || ':%';

    return query
    select
      v_month,
      v_rule.id,
      v_rule.monthly_amount_paise,
      v_created_count;

    return;
  end if;

  insert into public.donation_obligations (
    member_profile_id,
    obligation_rule_id,
    effective_month,
    authoritative_amount_paise,
    created_by_application_user_id,
    operation_id
  )
  select
    mp.id,
    v_rule.id,
    v_month,
    v_rule.monthly_amount_paise,
    v_actor,
    'monthly:' ||
    v_command_tag ||
    ':' ||
    encode(
      digest(mp.id::text, 'sha256'),
      'hex'
    )
  from public.member_profiles mp
  where mp.status = 'active'
  on conflict (member_profile_id, effective_month) do nothing;

  get diagnostics v_created_count = row_count;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'obligation_create',
    v_actor,
    v_fingerprint
  );

  return query
  select
    v_month,
    v_rule.id,
    v_rule.monthly_amount_paise,
    v_created_count;
end;
$$;

-- ============================================================================
-- Function privileges: Part 1
-- ============================================================================

revoke all on function public.create_donation_obligation_rule(
  date, bigint, text
)
from public, anon, authenticated;

grant execute on function public.create_donation_obligation_rule(
  date, bigint, text
)
to authenticated;

revoke all on function public.generate_monthly_donation_obligations(
  date, text
)
from public, anon, authenticated;

grant execute on function public.generate_monthly_donation_obligations(
  date, text
)
to authenticated;


-- ============================================================================
-- Submit donation payment
-- ============================================================================

create or replace function public.submit_donation_payment(
  p_amount_paise bigint,
  p_payment_method text,
  p_operation_id text
)
returns public.donation_payments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_member uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_method text := lower(nullif(btrim(p_payment_method), ''));
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_payment public.donation_payments;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.payments.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  select mp.id
  into v_member
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';

  if v_member is null then
    raise exception 'active_member_profile_required' using errcode = '42501';
  end if;

  if p_amount_paise is null or p_amount_paise < 100 then
    raise exception 'payment_below_minimum' using errcode = '22023';
  end if;

  if v_method is null
     or v_method not in ('cash', 'upi', 'bank_transfer', 'other') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'member_profile_id', v_member,
        'amount_paise', p_amount_paise,
        'payment_method', v_method
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'payment_submit'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.target_member_profile_id is distinct from v_member
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_payment
    from public.donation_payments
    where id = v_existing.payment_id;

    if v_payment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_payment;
  end if;

  insert into public.donation_payments (
    member_profile_id,
    amount_paise,
    payment_method,
    status,
    submitted_by_application_user_id,
    operation_id
  )
  values (
    v_member,
    p_amount_paise,
    v_method,
    'submitted',
    v_actor,
    v_operation_id
  )
  returning * into v_payment;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    payment_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'payment_submit',
    v_actor,
    v_member,
    v_payment.id,
    v_fingerprint
  );

  return v_payment;
end;
$$;

-- ============================================================================
-- Start payment review
-- ============================================================================

create or replace function public.start_donation_payment_review(
  p_payment_id uuid,
  p_operation_id text
)
returns public.donation_payments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_payment public.donation_payments;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.payments.verify') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_payment_id is null then
    raise exception 'payment_required' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object('payment_id', p_payment_id)::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'payment_review'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.payment_id is distinct from p_payment_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_payment
    from public.donation_payments
    where id = p_payment_id;

    if v_payment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_payment;
  end if;

  select *
  into v_payment
  from public.donation_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status <> 'submitted' then
    raise exception 'invalid_payment_state' using errcode = '22023';
  end if;

  update public.donation_payments
  set
    status = 'under_review',
    reviewed_by_application_user_id = v_actor,
    reviewed_at = null,
    rejection_reason = null
  where id = p_payment_id
  returning * into v_payment;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    payment_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'payment_review',
    v_actor,
    v_payment.member_profile_id,
    v_payment.id,
    v_fingerprint
  );

  return v_payment;
end;
$$;

-- ============================================================================
-- Reject payment
-- ============================================================================

create or replace function public.reject_donation_payment(
  p_payment_id uuid,
  p_reason text,
  p_operation_id text
)
returns public.donation_payments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_payment public.donation_payments;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.payments.verify') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_payment_id is null then
    raise exception 'payment_required' using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) > 1000 then
    raise exception 'invalid_rejection_reason' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'payment_reject'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.payment_id is distinct from p_payment_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_payment
    from public.donation_payments
    where id = p_payment_id;

    if v_payment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_payment;
  end if;

  select *
  into v_payment
  from public.donation_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status <> 'under_review' then
    raise exception 'invalid_payment_state' using errcode = '22023';
  end if;

  update public.donation_payments
  set
    status = 'rejected',
    reviewed_at = now(),
    rejection_reason = v_reason
  where id = p_payment_id
  returning * into v_payment;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    payment_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'payment_reject',
    v_actor,
    v_payment.member_profile_id,
    v_payment.id,
    v_fingerprint
  );

  return v_payment;
end;
$$;

-- ============================================================================
-- Waive obligation
-- ============================================================================

create or replace function public.waive_donation_obligation(
  p_obligation_id uuid,
  p_waived_amount_paise bigint,
  p_reason text,
  p_operation_id text
)
returns public.donation_obligation_waivers
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_obligation public.donation_obligations;
  v_waiver public.donation_obligation_waivers;
  v_allocated bigint;
  v_waived bigint;
  v_outstanding bigint;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.obligations.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_obligation_id is null then
    raise exception 'obligation_required' using errcode = '22023';
  end if;

  if p_waived_amount_paise is null or p_waived_amount_paise <= 0 then
    raise exception 'invalid_waiver_amount' using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) > 1000 then
    raise exception 'invalid_waiver_reason' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'obligation_id', p_obligation_id,
        'waived_amount_paise', p_waived_amount_paise,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'obligation_waive'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.obligation_id is distinct from p_obligation_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_waiver
    from public.donation_obligation_waivers
    where operation_id = v_operation_id;

    if v_waiver.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_waiver;
  end if;

  select *
  into v_obligation
  from public.donation_obligations
  where id = p_obligation_id
  for update;

  if v_obligation.id is null then
    raise exception 'obligation_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(a.allocated_amount_paise), 0)
  into v_allocated
  from public.donation_payment_allocations a
  where a.obligation_id = p_obligation_id;

  select coalesce(sum(w.waived_amount_paise), 0)
  into v_waived
  from public.donation_obligation_waivers w
  where w.obligation_id = p_obligation_id;

  v_outstanding :=
    v_obligation.authoritative_amount_paise - v_allocated - v_waived;

  if v_outstanding <= 0 then
    raise exception 'obligation_already_settled' using errcode = '22023';
  end if;

  if p_waived_amount_paise > v_outstanding then
    raise exception 'waiver_exceeds_outstanding' using errcode = '22023';
  end if;

  insert into public.donation_obligation_waivers (
    obligation_id,
    waived_amount_paise,
    reason,
    actor_application_user_id,
    operation_id
  )
  values (
    p_obligation_id,
    p_waived_amount_paise,
    v_reason,
    v_actor,
    v_operation_id
  )
  returning * into v_waiver;

  v_outstanding := v_outstanding - p_waived_amount_paise;

  update public.donation_obligations
  set status =
    case
      when v_outstanding = 0 and v_allocated = 0 then 'waived'
      when v_outstanding = 0 then 'paid'
      when v_allocated > 0 or (v_waived + p_waived_amount_paise) > 0
        then 'partially_paid'
      else 'outstanding'
    end
  where id = p_obligation_id;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    obligation_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'obligation_waive',
    v_actor,
    v_obligation.member_profile_id,
    v_obligation.id,
    v_fingerprint
  );

  return v_waiver;
end;
$$;

-- ============================================================================
-- Create explicit member additional donation
-- ============================================================================

create or replace function public.create_additional_donation(
  p_amount_paise bigint,
  p_operation_id text
)
returns public.additional_donations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_member uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_donation public.additional_donations;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.additional.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  select mp.id
  into v_member
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';

  if v_member is null then
    raise exception 'active_member_profile_required' using errcode = '42501';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'invalid_additional_donation_amount'
      using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'member_profile_id', v_member,
        'amount_paise', p_amount_paise,
        'donation_kind', 'additional'
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'additional_donation_create'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.target_member_profile_id is distinct from v_member
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_donation
    from public.additional_donations
    where id = v_existing.additional_donation_id;

    if v_donation.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_donation;
  end if;

  insert into public.additional_donations (
    member_profile_id,
    donation_kind,
    amount_paise,
    recorded_by_application_user_id,
    operation_id
  )
  values (
    v_member,
    'additional',
    p_amount_paise,
    v_actor,
    v_operation_id
  )
  returning * into v_donation;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    additional_donation_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'additional_donation_create',
    v_actor,
    v_member,
    v_donation.id,
    v_fingerprint
  );

  return v_donation;
end;
$$;

-- ============================================================================
-- Function privileges: Part 2
-- ============================================================================

revoke all on function public.submit_donation_payment(
  bigint, text, text
)
from public, anon, authenticated;

grant execute on function public.submit_donation_payment(
  bigint, text, text
)
to authenticated;

revoke all on function public.start_donation_payment_review(
  uuid, text
)
from public, anon, authenticated;

grant execute on function public.start_donation_payment_review(
  uuid, text
)
to authenticated;

revoke all on function public.reject_donation_payment(
  uuid, text, text
)
from public, anon, authenticated;

grant execute on function public.reject_donation_payment(
  uuid, text, text
)
to authenticated;

revoke all on function public.waive_donation_obligation(
  uuid, bigint, text, text
)
from public, anon, authenticated;

grant execute on function public.waive_donation_obligation(
  uuid, bigint, text, text
)
to authenticated;

revoke all on function public.create_additional_donation(
  bigint, text
)
from public, anon, authenticated;

grant execute on function public.create_additional_donation(
  bigint, text
)
to authenticated;


-- ============================================================================
-- Verify payment and allocate deterministically
-- ============================================================================

create or replace function public.verify_and_allocate_donation_payment(
  p_payment_id uuid,
  p_operation_id text
)
returns public.donation_payments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_payment public.donation_payments;
  v_obligation record;
  v_allocated bigint;
  v_waived bigint;
  v_outstanding bigint;
  v_allocation bigint;
  v_remaining bigint;
  v_sequence integer := 0;
  v_allocation_operation_id text;
  v_overpayment_operation_id text;
  v_additional public.additional_donations;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.payments.verify')
     or not public.has_application_permission('donations.payments.allocate') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_payment_id is null then
    raise exception 'payment_required' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'payment_id', p_payment_id
      )::text,
      'sha256'
    ),
    'hex'
  );

  -- Serialize retries/replays using the same command identity.
  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'payment_verify_allocate'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.payment_id is distinct from p_payment_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_payment
    from public.donation_payments
    where id = p_payment_id;

    if v_payment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_payment;
  end if;

  -- Lock the payment before evaluating lifecycle state.
  select *
  into v_payment
  from public.donation_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status <> 'under_review' then
    raise exception 'invalid_payment_state' using errcode = '22023';
  end if;

  -- Serialize all allocation activity for this member, including separate
  -- payments being verified concurrently.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'donation-member-allocation:' || v_payment.member_profile_id::text,
      0
    )
  );

  v_remaining := v_payment.amount_paise;

  -- Lock all currently eligible obligations in deterministic FIFO order.
  --
  -- Future-month obligations are excluded. The financial truth for each
  -- obligation is:
  --
  -- authoritative amount - verified allocations - waivers.
  --
  -- Existing allocation rows can only be produced by trusted operations.
  for v_obligation in
    select
      o.id,
      o.authoritative_amount_paise,
      o.effective_month
    from public.donation_obligations o
    where o.member_profile_id = v_payment.member_profile_id
      and o.effective_month <= date_trunc('month', current_date)::date
    order by o.effective_month asc, o.id asc
    for update
  loop
    exit when v_remaining <= 0;

    select coalesce(sum(a.allocated_amount_paise), 0)
    into v_allocated
    from public.donation_payment_allocations a
    where a.obligation_id = v_obligation.id;

    select coalesce(sum(w.waived_amount_paise), 0)
    into v_waived
    from public.donation_obligation_waivers w
    where w.obligation_id = v_obligation.id;

    v_outstanding :=
      v_obligation.authoritative_amount_paise
      - v_allocated
      - v_waived;

    if v_outstanding <= 0 then
      continue;
    end if;

    v_allocation := least(v_remaining, v_outstanding);
    v_sequence := v_sequence + 1;

    v_allocation_operation_id :=
      'allocation:' ||
      encode(
        digest(
          v_operation_id || ':' ||
          v_sequence::text || ':' ||
          v_obligation.id::text,
          'sha256'
        ),
        'hex'
      );

    insert into public.donation_payment_allocations (
      payment_id,
      obligation_id,
      allocated_amount_paise,
      allocation_sequence,
      operation_id,
      created_by_application_user_id
    )
    values (
      v_payment.id,
      v_obligation.id,
      v_allocation,
      v_sequence,
      v_allocation_operation_id,
      v_actor
    );

    v_remaining := v_remaining - v_allocation;
    v_outstanding := v_outstanding - v_allocation;

    update public.donation_obligations
    set status =
      case
        when v_outstanding = 0 and (v_allocated + v_allocation) > 0
          then 'paid'
        when v_outstanding = 0
          then 'waived'
        when (v_allocated + v_allocation) > 0 or v_waived > 0
          then 'partially_paid'
        else 'outstanding'
      end
    where id = v_obligation.id;
  end loop;

  -- V1 does not prepay future obligations. Any verified remainder becomes
  -- a distinct additional donation classified as overpayment.
  if v_remaining > 0 then
    v_overpayment_operation_id :=
      'overpayment:' ||
      encode(
        digest(v_operation_id, 'sha256'),
        'hex'
      );

    insert into public.additional_donations (
      member_profile_id,
      source_payment_id,
      donation_kind,
      amount_paise,
      recorded_by_application_user_id,
      operation_id
    )
    values (
      v_payment.member_profile_id,
      v_payment.id,
      'overpayment',
      v_remaining,
      v_actor,
      v_overpayment_operation_id
    )
    returning * into v_additional;
  end if;

  update public.donation_payments
  set
    status = 'verified',
    reviewed_by_application_user_id = v_actor,
    reviewed_at = now(),
    rejection_reason = null
  where id = v_payment.id
  returning * into v_payment;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    payment_id,
    additional_donation_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'payment_verify_allocate',
    v_actor,
    v_payment.member_profile_id,
    v_payment.id,
    v_additional.id,
    v_fingerprint
  );

  return v_payment;
end;
$$;

revoke all on function public.verify_and_allocate_donation_payment(
  uuid, text
)
from public, anon, authenticated;

grant execute on function public.verify_and_allocate_donation_payment(
  uuid, text
)
to authenticated;

commit;
