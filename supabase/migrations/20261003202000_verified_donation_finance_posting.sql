-- Masjid-e-Mamoor 2
-- Phase 9B-1A: Verified recurring donation -> Finance ledger integration
--
-- The original two-argument donation verification function remains as an
-- internal allocation core. Authenticated clients can no longer call it
-- directly. The new trusted boundary requires an explicit active Finance
-- account and business date, then atomically performs:
--
--   verification + FIFO allocation + overpayment classification
--   + authoritative Finance ledger posting + immutable Finance audit
--
-- No historical verified donations are backfilled by this migration.

begin;

-- ---------------------------------------------------------------------------
-- Extend Finance idempotency to cover donation verification/posting.
-- ---------------------------------------------------------------------------

alter table public.finance_operation_idempotency
  drop constraint finance_operation_idempotency_type_chk;

alter table public.finance_operation_idempotency
  add constraint finance_operation_idempotency_type_chk check (
    operation_type in (
      'account_create',
      'account_status_change',
      'expense_submit',
      'expense_decide',
      'transfer_submit',
      'transfer_decide',
      'adjustment_submit',
      'adjustment_decide',
      'donation_verify_post'
    )
  );

alter table public.finance_operation_idempotency
  drop constraint finance_operation_idempotency_result_type_chk;

alter table public.finance_operation_idempotency
  add constraint finance_operation_idempotency_result_type_chk check (
    result_entity_type in (
      'finance_account',
      'finance_expense',
      'finance_transfer',
      'finance_adjustment',
      'donation_payment'
    )
  );

-- ---------------------------------------------------------------------------
-- Extend immutable Finance audit to record a verified donation posting.
-- ---------------------------------------------------------------------------

alter table public.finance_audit_events
  drop constraint finance_audit_events_type_chk;

alter table public.finance_audit_events
  add constraint finance_audit_events_type_chk check (
    event_type in (
      'account_created',
      'account_status_changed',
      'expense_submitted',
      'expense_posted',
      'expense_rejected',
      'transfer_submitted',
      'transfer_approved',
      'transfer_rejected',
      'adjustment_submitted',
      'correction_applied',
      'reversal_applied',
      'adjustment_rejected',
      'donation_payment_posted'
    )
  );

alter table public.finance_audit_events
  drop constraint finance_audit_events_entity_type_chk;

alter table public.finance_audit_events
  add constraint finance_audit_events_entity_type_chk check (
    entity_type in (
      'finance_account',
      'finance_expense',
      'finance_transfer',
      'finance_adjustment',
      'donation_payment'
    )
  );

-- ---------------------------------------------------------------------------
-- The legacy verifier is now an internal allocation core.
--
-- Keeping the function avoids rewriting the already-tested FIFO,
-- overpayment, obligation-state and donation-idempotency implementation.
-- Only the function owner may reach it through the new trusted wrapper.
-- ---------------------------------------------------------------------------

revoke all on function public.verify_and_allocate_donation_payment(
  uuid, text
)
from public, anon, authenticated;

comment on function public.verify_and_allocate_donation_payment(
  uuid, text
) is
  'Internal donation verification/allocation core. Client execution revoked by Phase 9B-1A.';

-- ---------------------------------------------------------------------------
-- Authoritative verification + Finance posting boundary.
-- ---------------------------------------------------------------------------

create or replace function public.verify_and_allocate_donation_payment(
  p_payment_id uuid,
  p_finance_account_id uuid,
  p_business_date date,
  p_operation_id text
)
returns public.donation_payments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_fingerprint text;
  v_existing public.finance_operation_idempotency;

  v_account public.finance_accounts;
  v_payment public.donation_payments;

  v_internal_operation_id text;
  v_ledger_operation_id text;

  v_recurring_amount_paise bigint := 0;
  v_overpayment_amount_paise bigint := 0;
  v_overpayment_count bigint := 0;
  v_overpayment_id uuid;

  v_recurring_transaction_id uuid;
  v_additional_transaction_id uuid;
begin
  -- Lock the active caller and role assignment so authorization cannot become
  -- stale while a financial mutation is in progress.
  v_actor := public.lock_active_finance_actor();

  if not public.has_application_permission(
    'donations.payments.verify'
  )
     or not public.has_application_permission(
       'donations.payments.allocate'
     )
     or not public.has_application_permission(
       'finance.accounts.read'
     ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_payment_id is null then
    raise exception 'payment_required'
      using errcode = '22023';
  end if;

  if p_finance_account_id is null then
    raise exception 'finance_account_required'
      using errcode = '22023';
  end if;

  if p_business_date is null then
    raise exception 'business_date_required'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'operation',
        'donation_verify_post',
        'payment_id',
        p_payment_id,
        'finance_account_id',
        p_finance_account_id,
        'business_date',
        p_business_date
      )::text,
      'sha256'
    ),
    'hex'
  );

  -- Serialize retries using the client-visible operation identity.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'finance-operation:' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.finance_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <>
         'donation_verify_post'
       or v_existing.actor_application_user_id <>
         v_actor
       or v_existing.result_entity_type <>
         'donation_payment'
       or v_existing.result_entity_id <>
         p_payment_id
       or v_existing.request_fingerprint <>
         v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_payment
    from public.donation_payments
    where id = v_existing.result_entity_id;

    if v_payment.id is null then
      raise exception 'idempotency_result_missing'
        using errcode = 'P0002';
    end if;

    return v_payment;
  end if;

  -- Lock and validate the destination account before any financial effect.
  select *
  into v_account
  from public.finance_accounts
  where id = p_finance_account_id
  for update;

  if v_account.id is null then
    raise exception 'finance_account_not_found'
      using errcode = 'P0002';
  end if;

  if v_account.status <> 'active' then
    raise exception 'finance_account_not_active'
      using errcode = '22023';
  end if;

  -- The internal donation operation identity is deterministic but separate
  -- from the public Finance operation registry.
  v_internal_operation_id :=
    'donation-core:' ||
    encode(
      digest(v_operation_id, 'sha256'),
      'hex'
    );

  -- Existing trusted logic performs payment-state validation, deterministic
  -- FIFO allocation, obligation-state transitions and overpayment creation.
  select *
  into v_payment
  from public.verify_and_allocate_donation_payment(
    p_payment_id,
    v_internal_operation_id
  );

  if v_payment.id is null
     or v_payment.status <> 'verified' then
    raise exception 'donation_verification_failed'
      using errcode = '55000';
  end if;

  -- Recurring financial recognition equals the authoritative allocations
  -- created for this verified payment.
  select coalesce(
    sum(a.allocated_amount_paise),
    0
  )
  into v_recurring_amount_paise
  from public.donation_payment_allocations a
  where a.payment_id = v_payment.id;

  -- V1 classifies any remainder as exactly one overpayment additional donation.
  select
    coalesce(sum(d.amount_paise), 0),
    count(*),
    min(d.id::text)::uuid
  into
    v_overpayment_amount_paise,
    v_overpayment_count,
    v_overpayment_id
  from public.additional_donations d
  where d.source_payment_id = v_payment.id
    and d.donation_kind = 'overpayment';

  if v_overpayment_count > 1 then
    raise exception 'invalid_overpayment_cardinality'
      using errcode = '23514';
  end if;

  -- Critical accounting invariant: every verified paise must be recognized
  -- exactly once as recurring settlement or overpayment/additional donation.
  if v_recurring_amount_paise
       + v_overpayment_amount_paise
       <> v_payment.amount_paise then
    raise exception 'donation_finance_posting_mismatch'
      using errcode = '23514';
  end if;

  v_ledger_operation_id :=
    'donation-ledger:' ||
    encode(
      digest(v_operation_id, 'sha256'),
      'hex'
    );

  if v_recurring_amount_paise > 0 then
    insert into public.financial_transactions (
      finance_account_id,
      transaction_category,
      direction,
      amount_paise,
      currency,
      business_date,
      reference_type,
      reference_id,
      related_transaction_id,
      operation_id,
      created_by_application_user_id
    )
    values (
      v_account.id,
      'DONATION_RECURRING',
      'inflow',
      v_recurring_amount_paise,
      'INR',
      p_business_date,
      'donation_payment',
      v_payment.id,
      null,
      v_ledger_operation_id,
      v_actor
    )
    returning id
    into v_recurring_transaction_id;
  end if;

  if v_overpayment_amount_paise > 0 then
    if v_overpayment_id is null then
      raise exception 'overpayment_record_missing'
        using errcode = '23514';
    end if;

    insert into public.financial_transactions (
      finance_account_id,
      transaction_category,
      direction,
      amount_paise,
      currency,
      business_date,
      reference_type,
      reference_id,
      related_transaction_id,
      operation_id,
      created_by_application_user_id
    )
    values (
      v_account.id,
      'DONATION_ADDITIONAL',
      'inflow',
      v_overpayment_amount_paise,
      'INR',
      p_business_date,
      'additional_donation',
      v_overpayment_id,
      null,
      v_ledger_operation_id,
      v_actor
    )
    returning id
    into v_additional_transaction_id;
  end if;

  insert into public.finance_audit_events (
    actor_application_user_id,
    event_type,
    entity_type,
    entity_id,
    operation_id,
    details
  )
  values (
    v_actor,
    'donation_payment_posted',
    'donation_payment',
    v_payment.id,
    v_operation_id,
    jsonb_build_object(
      'finance_account_id',
      v_account.id,
      'business_date',
      p_business_date,
      'payment_amount_paise',
      v_payment.amount_paise,
      'recurring_amount_paise',
      v_recurring_amount_paise,
      'overpayment_amount_paise',
      v_overpayment_amount_paise,
      'recurring_transaction_id',
      v_recurring_transaction_id,
      'additional_transaction_id',
      v_additional_transaction_id
    )
  );

  insert into public.finance_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    request_fingerprint,
    result_entity_type,
    result_entity_id,
    created_at
  )
  values (
    v_operation_id,
    'donation_verify_post',
    v_actor,
    v_fingerprint,
    'donation_payment',
    v_payment.id,
    now()
  );

  return v_payment;
end;
$$;

revoke all on function public.verify_and_allocate_donation_payment(
  uuid, uuid, date, text
)
from public, anon, authenticated;

grant execute on function public.verify_and_allocate_donation_payment(
  uuid, uuid, date, text
)
to authenticated;

comment on function public.verify_and_allocate_donation_payment(
  uuid, uuid, date, text
) is
  'Authoritative verified donation allocation and Finance ledger posting boundary.';

commit;
