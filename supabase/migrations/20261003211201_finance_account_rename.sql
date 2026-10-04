-- Masjid-e-Mamoor 2
-- Phase 9B-2C-A: Audited Finance account rename
--
-- Finance account identity, type, status, balances and ledger history remain
-- unchanged. Only the human-readable account label may be corrected through
-- this trusted, permission-checked, idempotent and audited operation.

begin;

-- ---------------------------------------------------------------------------
-- Finance idempotency supports account rename.
-- Preserve all previously supported operation types, including 9B-1 posting.
-- ---------------------------------------------------------------------------

alter table public.finance_operation_idempotency
  drop constraint finance_operation_idempotency_type_chk;

alter table public.finance_operation_idempotency
  add constraint finance_operation_idempotency_type_chk check (
    operation_type in (
      'account_create',
      'account_status_change',
      'account_rename',
      'expense_submit',
      'expense_decide',
      'transfer_submit',
      'transfer_decide',
      'adjustment_submit',
      'adjustment_decide',
      'donation_verify_post'
    )
  );

-- ---------------------------------------------------------------------------
-- Immutable Finance audit records account-label corrections.
-- Preserve all existing Finance audit event types.
-- ---------------------------------------------------------------------------

alter table public.finance_audit_events
  drop constraint finance_audit_events_type_chk;

alter table public.finance_audit_events
  add constraint finance_audit_events_type_chk check (
    event_type in (
      'account_created',
      'account_status_changed',
      'account_renamed',
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

-- ---------------------------------------------------------------------------
-- Trusted Finance account rename.
--
-- Renaming is metadata correction only:
--   - account UUID is unchanged
--   - account type is unchanged
--   - lifecycle status is unchanged
--   - currency is unchanged
--   - ledger effects and balances are unchanged
--   - closed accounts may still have their display label corrected
-- ---------------------------------------------------------------------------

create or replace function public.rename_finance_account(
  p_finance_account_id uuid,
  p_name text,
  p_operation_id text
)
returns public.finance_accounts
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_name text := nullif(btrim(p_name), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_account public.finance_accounts;
  v_previous_name text;
begin
  v_actor := public.lock_active_finance_actor();

  if not public.has_application_permission(
    'finance.accounts.manage'
  ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_finance_account_id is null then
    raise exception 'account_not_found'
      using errcode = 'P0002';
  end if;

  if v_name is null or length(v_name) > 120 then
    raise exception 'invalid_name'
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
        'operation', 'account_rename',
        'finance_account_id', p_finance_account_id,
        'name', v_name
      )::text,
      'sha256'
    ),
    'hex'
  );

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
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'account_rename'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_account
    from public.finance_accounts
    where id = v_existing.result_entity_id;

    if v_account.id is null then
      raise exception 'idempotency_result_missing'
        using errcode = 'P0002';
    end if;

    return v_account;
  end if;

  select *
  into v_account
  from public.finance_accounts
  where id = p_finance_account_id
  for update;

  if not found then
    raise exception 'account_not_found'
      using errcode = 'P0002';
  end if;

  v_previous_name := v_account.name;

  if v_previous_name = v_name then
    raise exception 'account_name_unchanged'
      using errcode = '22023';
  end if;

  update public.finance_accounts
  set name = v_name
  where id = p_finance_account_id
  returning * into v_account;

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
    'account_renamed',
    'finance_account',
    v_account.id,
    v_operation_id,
    jsonb_build_object(
      'previous_name', v_previous_name,
      'name', v_account.name
    )
  );

  insert into public.finance_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    request_fingerprint,
    result_entity_type,
    result_entity_id
  )
  values (
    v_operation_id,
    'account_rename',
    v_actor,
    v_fingerprint,
    'finance_account',
    v_account.id
  );

  return v_account;
end;
$$;

revoke execute on function public.rename_finance_account(
  uuid, text, text
)
from public, anon, authenticated, service_role;

grant execute on function public.rename_finance_account(
  uuid, text, text
)
to authenticated;

comment on function public.rename_finance_account(
  uuid, text, text
) is
  'Trusted audited Finance account display-name correction. Requires finance.accounts.manage.';

commit;
