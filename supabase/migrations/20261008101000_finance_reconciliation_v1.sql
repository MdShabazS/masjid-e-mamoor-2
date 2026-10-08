-- Masjid-e-Mamoor 2
-- Finance V1: authoritative financial reconciliation.
--
-- Reconciliation compares authoritative ledger-derived balances against
-- external evidence. It never edits financial_transactions and it is not a
-- hard accounting close.
--
-- V1 supports:
--   - one formal monthly reconciliation per month
--   - additional on-demand reconciliations
--   - account-by-account external evidence
--   - explicit discrepancy investigation
--   - immutable completed history
--   - trusted, permission-checked, idempotent mutations
--   - immutable Finance audit evidence

begin;

-- ---------------------------------------------------------------------------
-- Reconciliation header
-- ---------------------------------------------------------------------------

create table public.finance_reconciliations (
  id uuid primary key default gen_random_uuid(),

  reconciliation_type text not null,
  period_month date,
  as_of_business_date date not null,

  status text not null default 'in_progress',

  start_notes text,
  completion_notes text,

  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  completed_by_application_user_id uuid
    references public.application_users(id) on delete restrict,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint finance_reconciliations_type_chk check (
    reconciliation_type in ('monthly', 'on_demand')
  ),

  constraint finance_reconciliations_period_chk check (
    (
      reconciliation_type = 'monthly'
      and period_month is not null
      and extract(day from period_month) = 1
      and as_of_business_date =
        (period_month + interval '1 month - 1 day')::date
    )
    or
    (
      reconciliation_type = 'on_demand'
      and period_month is null
    )
  ),

  constraint finance_reconciliations_status_chk check (
    status in ('in_progress', 'completed')
  ),

  constraint finance_reconciliations_completion_chk check (
    (
      status = 'in_progress'
      and completed_by_application_user_id is null
      and completed_at is null
    )
    or
    (
      status = 'completed'
      and completed_by_application_user_id is not null
      and completed_at is not null
    )
  ),

  constraint finance_reconciliations_start_notes_chk check (
    start_notes is null
    or length(btrim(start_notes)) between 1 and 2000
  ),

  constraint finance_reconciliations_completion_notes_chk check (
    completion_notes is null
    or length(btrim(completion_notes)) between 1 and 2000
  )
);

create unique index finance_reconciliations_monthly_period_uidx
  on public.finance_reconciliations(period_month)
  where reconciliation_type = 'monthly';

create index finance_reconciliations_status_started_idx
  on public.finance_reconciliations(status, started_at desc, id);

create index finance_reconciliations_as_of_idx
  on public.finance_reconciliations(as_of_business_date desc, id);

comment on table public.finance_reconciliations is
  'Finance V1 reconciliation runs. Reconciliation records discrepancies but never mutates authoritative ledger history.';

-- ---------------------------------------------------------------------------
-- Reconciliation account items
-- ---------------------------------------------------------------------------

create table public.finance_reconciliation_items (
  id uuid primary key default gen_random_uuid(),

  reconciliation_id uuid not null
    references public.finance_reconciliations(id) on delete restrict,

  finance_account_id uuid not null
    references public.finance_accounts(id) on delete restrict,

  account_name_snapshot text not null,
  account_type_snapshot text not null,
  currency text not null,

  system_balance_paise bigint not null,

  external_balance_paise bigint,

  difference_paise bigint generated always as (
    case
      when external_balance_paise is null then null
      else external_balance_paise - system_balance_paise
    end
  ) stored,

  evidence_type text,
  evidence_reference text,
  investigation_note text,

  discrepancy_status text not null default 'pending',

  recorded_by_application_user_id uuid
    references public.application_users(id) on delete restrict,

  recorded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_reconciliation_items_unique_account
    unique (reconciliation_id, finance_account_id),

  constraint finance_reconciliation_items_name_chk check (
    length(btrim(account_name_snapshot)) between 1 and 120
  ),

  constraint finance_reconciliation_items_account_type_chk check (
    account_type_snapshot in ('bank', 'upi', 'cash', 'other')
  ),

  constraint finance_reconciliation_items_currency_chk check (
    currency = 'INR'
  ),

  constraint finance_reconciliation_items_evidence_type_chk check (
    evidence_type is null
    or evidence_type in (
      'bank_statement',
      'upi_statement',
      'cash_count',
      'receipt',
      'other'
    )
  ),

  constraint finance_reconciliation_items_evidence_reference_chk check (
    evidence_reference is null
    or length(btrim(evidence_reference)) between 1 and 500
  ),

  constraint finance_reconciliation_items_investigation_note_chk check (
    investigation_note is null
    or length(btrim(investigation_note)) between 1 and 2000
  ),

  constraint finance_reconciliation_items_discrepancy_status_chk check (
    discrepancy_status in (
      'pending',
      'matched',
      'open',
      'investigated'
    )
  ),

  constraint finance_reconciliation_items_state_chk check (
    (
      external_balance_paise is null
      and evidence_type is null
      and evidence_reference is null
      and investigation_note is null
      and discrepancy_status = 'pending'
      and recorded_by_application_user_id is null
      and recorded_at is null
    )
    or
    (
      external_balance_paise is not null
      and evidence_type is not null
      and recorded_by_application_user_id is not null
      and recorded_at is not null
      and (
        (
          difference_paise = 0
          and discrepancy_status = 'matched'
        )
        or
        (
          difference_paise <> 0
          and investigation_note is null
          and discrepancy_status = 'open'
        )
        or
        (
          difference_paise <> 0
          and investigation_note is not null
          and discrepancy_status = 'investigated'
        )
      )
    )
  )
);

create index finance_reconciliation_items_reconciliation_idx
  on public.finance_reconciliation_items(
    reconciliation_id,
    finance_account_id
  );

create index finance_reconciliation_items_discrepancy_idx
  on public.finance_reconciliation_items(
    reconciliation_id,
    discrepancy_status
  );

comment on table public.finance_reconciliation_items is
  'Account-by-account reconciliation evidence against authoritative ledger-derived balances.';

-- ---------------------------------------------------------------------------
-- Preserve reconciliation history.
-- ---------------------------------------------------------------------------

create or replace function public.protect_finance_reconciliation_history()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'finance_reconciliation_delete_not_allowed'
      using errcode = '55000';
  end if;

  if old.status = 'completed' then
    raise exception 'finance_reconciliation_completed_immutable'
      using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.reconciliation_type is distinct from old.reconciliation_type
     or new.period_month is distinct from old.period_month
     or new.as_of_business_date is distinct from old.as_of_business_date
     or new.start_notes is distinct from old.start_notes
     or new.created_by_application_user_id
          is distinct from old.created_by_application_user_id
     or new.started_at is distinct from old.started_at then
    raise exception 'finance_reconciliation_identity_immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger finance_reconciliations_protect_history
before update or delete on public.finance_reconciliations
for each row
execute function public.protect_finance_reconciliation_history();

create or replace function public.protect_finance_reconciliation_item_history()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_parent_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'finance_reconciliation_item_delete_not_allowed'
      using errcode = '55000';
  end if;

  select fr.status
  into v_parent_status
  from public.finance_reconciliations fr
  where fr.id = old.reconciliation_id;

  if v_parent_status = 'completed' then
    raise exception 'finance_reconciliation_completed_immutable'
      using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.reconciliation_id is distinct from old.reconciliation_id
     or new.finance_account_id is distinct from old.finance_account_id
     or new.account_name_snapshot is distinct from old.account_name_snapshot
     or new.account_type_snapshot is distinct from old.account_type_snapshot
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at then
    raise exception 'finance_reconciliation_item_identity_immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger finance_reconciliation_items_protect_history
before update or delete on public.finance_reconciliation_items
for each row
execute function public.protect_finance_reconciliation_item_history();

-- ---------------------------------------------------------------------------
-- RLS: President/Finance manage. Audit readers have oversight read access.
-- ---------------------------------------------------------------------------

alter table public.finance_reconciliations enable row level security;
alter table public.finance_reconciliation_items enable row level security;

create policy finance_reconciliations_authorized_read
on public.finance_reconciliations
for select
to authenticated
using (
  public.has_application_permission('finance.reconciliation.manage')
  or public.has_application_permission('audit.records.read')
);

create policy finance_reconciliation_items_authorized_read
on public.finance_reconciliation_items
for select
to authenticated
using (
  public.has_application_permission('finance.reconciliation.manage')
  or public.has_application_permission('audit.records.read')
);

revoke all on table public.finance_reconciliations
  from public, anon, authenticated;

revoke all on table public.finance_reconciliation_items
  from public, anon, authenticated;

grant select on table public.finance_reconciliations
  to authenticated;

grant select on table public.finance_reconciliation_items
  to authenticated;

grant all on table public.finance_reconciliations
  to service_role;

grant all on table public.finance_reconciliation_items
  to service_role;

-- ---------------------------------------------------------------------------
-- Extend Finance operation idempotency.
-- Preserve every existing supported operation/result type.
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
      'donation_verify_post',
      'reconciliation_start',
      'reconciliation_item_record',
      'reconciliation_complete'
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
      'donation_payment',
      'finance_reconciliation',
      'finance_reconciliation_item'
    )
  );

-- ---------------------------------------------------------------------------
-- Extend immutable Finance audit.
-- Preserve every existing supported event/entity type.
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
      'donation_payment_posted',
      'reconciliation_started',
      'reconciliation_item_recorded',
      'reconciliation_discrepancy_recorded',
      'reconciliation_completed'
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
      'donation_payment',
      'finance_reconciliation',
      'finance_reconciliation_item'
    )
  );

-- ---------------------------------------------------------------------------
-- Start reconciliation.
--
-- Monthly:
--   p_period_month is normalized to first day of month.
--   as-of date is the final calendar day of that month.
--
-- On-demand:
--   p_period_month must be null.
--   p_as_of_business_date is required.
-- ---------------------------------------------------------------------------

create or replace function public.start_finance_reconciliation(
  p_reconciliation_type text,
  p_period_month date,
  p_as_of_business_date date,
  p_notes text,
  p_operation_id text
)
returns public.finance_reconciliations
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_type text := lower(btrim(coalesce(p_reconciliation_type, '')));
  v_period_month date;
  v_as_of_business_date date;
  v_notes text := nullif(btrim(p_notes), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_reconciliation public.finance_reconciliations;
  v_item_count integer;
begin
  v_actor := public.lock_active_finance_actor();

  if not public.has_application_permission(
    'finance.reconciliation.manage'
  ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if v_type not in ('monthly', 'on_demand') then
    raise exception 'invalid_reconciliation_type'
      using errcode = '22023';
  end if;

  if v_type = 'monthly' then
    if p_period_month is null then
      raise exception 'period_month_required'
        using errcode = '22023';
    end if;

    v_period_month :=
      date_trunc('month', p_period_month::timestamp)::date;

    v_as_of_business_date :=
      (v_period_month + interval '1 month - 1 day')::date;

    if p_as_of_business_date is not null
       and p_as_of_business_date <> v_as_of_business_date then
      raise exception 'invalid_monthly_as_of_date'
        using errcode = '22023';
    end if;
  else
    if p_period_month is not null then
      raise exception 'period_month_not_allowed'
        using errcode = '22023';
    end if;

    if p_as_of_business_date is null then
      raise exception 'as_of_business_date_required'
        using errcode = '22023';
    end if;

    v_period_month := null;
    v_as_of_business_date := p_as_of_business_date;
  end if;

  if v_notes is not null and length(v_notes) > 2000 then
    raise exception 'invalid_notes'
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
        'operation', 'reconciliation_start',
        'reconciliation_type', v_type,
        'period_month', v_period_month,
        'as_of_business_date', v_as_of_business_date,
        'notes', v_notes
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
       or v_existing.operation_type <> 'reconciliation_start'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_reconciliation
    from public.finance_reconciliations
    where id = v_existing.result_entity_id;

    return v_reconciliation;
  end if;

  if v_type = 'monthly' then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'finance-reconciliation-month:' ||
          v_period_month::text,
        0
      )
    );

    if exists (
      select 1
      from public.finance_reconciliations fr
      where fr.reconciliation_type = 'monthly'
        and fr.period_month = v_period_month
    ) then
      raise exception 'monthly_reconciliation_exists'
        using errcode = '23505';
    end if;
  end if;

  insert into public.finance_reconciliations (
    reconciliation_type,
    period_month,
    as_of_business_date,
    start_notes,
    created_by_application_user_id
  )
  values (
    v_type,
    v_period_month,
    v_as_of_business_date,
    v_notes,
    v_actor
  )
  returning *
  into v_reconciliation;

  insert into public.finance_reconciliation_items (
    reconciliation_id,
    finance_account_id,
    account_name_snapshot,
    account_type_snapshot,
    currency,
    system_balance_paise
  )
  select
    v_reconciliation.id,
    fa.id,
    fa.name,
    fa.account_type,
    fa.currency,
    coalesce(
      (
        select sum(
          case ft.direction
            when 'inflow' then ft.amount_paise
            when 'outflow' then -ft.amount_paise
          end
        )
        from public.financial_transactions ft
        where ft.finance_account_id = fa.id
          and ft.business_date <= v_as_of_business_date
      ),
      0
    )::bigint
  from public.finance_accounts fa
  order by fa.created_at, fa.id;

  get diagnostics v_item_count = row_count;

  if v_item_count = 0 then
    raise exception 'no_finance_accounts'
      using errcode = '22023';
  end if;

  insert into public.finance_audit_events (
    actor_application_user_id,
    event_type,
    entity_type,
    entity_id,
    operation_id,
    reason,
    details
  )
  values (
    v_actor,
    'reconciliation_started',
    'finance_reconciliation',
    v_reconciliation.id,
    v_operation_id,
    v_notes,
    jsonb_build_object(
      'reconciliation_type', v_type,
      'period_month', v_period_month,
      'as_of_business_date', v_as_of_business_date,
      'account_count', v_item_count
    )
  );

  insert into public.finance_operation_idempotency values (
    v_operation_id,
    'reconciliation_start',
    v_actor,
    v_fingerprint,
    'finance_reconciliation',
    v_reconciliation.id,
    now()
  );

  return v_reconciliation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record or revise one reconciliation item.
--
-- The system balance is recalculated from authoritative ledger effects every
-- time the item is recorded. A mismatch is preserved as a discrepancy.
-- ---------------------------------------------------------------------------

create or replace function public.record_finance_reconciliation_item(
  p_reconciliation_id uuid,
  p_finance_account_id uuid,
  p_external_balance_paise bigint,
  p_evidence_type text,
  p_evidence_reference text,
  p_investigation_note text,
  p_operation_id text
)
returns public.finance_reconciliation_items
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_evidence_type text :=
    lower(btrim(coalesce(p_evidence_type, '')));
  v_evidence_reference text :=
    nullif(btrim(p_evidence_reference), '');
  v_investigation_note text :=
    nullif(btrim(p_investigation_note), '');
  v_operation_id text :=
    nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_reconciliation public.finance_reconciliations;
  v_item public.finance_reconciliation_items;
  v_account public.finance_accounts;
  v_system_balance_paise bigint;
  v_difference_paise bigint;
  v_discrepancy_status text;
begin
  v_actor := public.lock_active_finance_actor();

  if not public.has_application_permission(
    'finance.reconciliation.manage'
  ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_reconciliation_id is null
     or p_finance_account_id is null then
    raise exception 'invalid_reconciliation_target'
      using errcode = '22023';
  end if;

  if p_external_balance_paise is null then
    raise exception 'external_balance_required'
      using errcode = '22023';
  end if;

  if v_evidence_type not in (
    'bank_statement',
    'upi_statement',
    'cash_count',
    'receipt',
    'other'
  ) then
    raise exception 'invalid_evidence_type'
      using errcode = '22023';
  end if;

  if v_evidence_reference is not null
     and length(v_evidence_reference) > 500 then
    raise exception 'invalid_evidence_reference'
      using errcode = '22023';
  end if;

  if v_investigation_note is not null
     and length(v_investigation_note) > 2000 then
    raise exception 'invalid_investigation_note'
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
        'operation', 'reconciliation_item_record',
        'reconciliation_id', p_reconciliation_id,
        'finance_account_id', p_finance_account_id,
        'external_balance_paise', p_external_balance_paise,
        'evidence_type', v_evidence_type,
        'evidence_reference', v_evidence_reference,
        'investigation_note', v_investigation_note
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
       or v_existing.operation_type <>
            'reconciliation_item_record'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_item
    from public.finance_reconciliation_items
    where id = v_existing.result_entity_id;

    return v_item;
  end if;

  select *
  into v_reconciliation
  from public.finance_reconciliations
  where id = p_reconciliation_id
  for update;

  if not found then
    raise exception 'reconciliation_not_found'
      using errcode = 'P0002';
  end if;

  if v_reconciliation.status <> 'in_progress' then
    raise exception 'reconciliation_not_in_progress'
      using errcode = '55000';
  end if;

  select *
  into v_item
  from public.finance_reconciliation_items
  where reconciliation_id = p_reconciliation_id
    and finance_account_id = p_finance_account_id
  for update;

  if not found then
    select *
    into v_account
    from public.finance_accounts
    where id = p_finance_account_id;

    if not found then
      raise exception 'account_not_found'
        using errcode = 'P0002';
    end if;

    select coalesce(
      sum(
        case ft.direction
          when 'inflow' then ft.amount_paise
          when 'outflow' then -ft.amount_paise
        end
      ),
      0
    )::bigint
    into v_system_balance_paise
    from public.financial_transactions ft
    where ft.finance_account_id = p_finance_account_id
      and ft.business_date <=
        v_reconciliation.as_of_business_date;

    insert into public.finance_reconciliation_items (
      reconciliation_id,
      finance_account_id,
      account_name_snapshot,
      account_type_snapshot,
      currency,
      system_balance_paise
    )
    values (
      p_reconciliation_id,
      v_account.id,
      v_account.name,
      v_account.account_type,
      v_account.currency,
      v_system_balance_paise
    )
    returning *
    into v_item;
  else
    select coalesce(
      sum(
        case ft.direction
          when 'inflow' then ft.amount_paise
          when 'outflow' then -ft.amount_paise
        end
      ),
      0
    )::bigint
    into v_system_balance_paise
    from public.financial_transactions ft
    where ft.finance_account_id = p_finance_account_id
      and ft.business_date <=
        v_reconciliation.as_of_business_date;
  end if;

  v_difference_paise :=
    p_external_balance_paise - v_system_balance_paise;

  if v_difference_paise = 0 then
    v_discrepancy_status := 'matched';
  elsif v_investigation_note is null then
    v_discrepancy_status := 'open';
  else
    v_discrepancy_status := 'investigated';
  end if;

  update public.finance_reconciliation_items
  set
    system_balance_paise = v_system_balance_paise,
    external_balance_paise = p_external_balance_paise,
    evidence_type = v_evidence_type,
    evidence_reference = v_evidence_reference,
    investigation_note = v_investigation_note,
    discrepancy_status = v_discrepancy_status,
    recorded_by_application_user_id = v_actor,
    recorded_at = now(),
    updated_at = now()
  where id = v_item.id
  returning *
  into v_item;

  insert into public.finance_audit_events (
    actor_application_user_id,
    event_type,
    entity_type,
    entity_id,
    operation_id,
    reason,
    details
  )
  values (
    v_actor,
    'reconciliation_item_recorded',
    'finance_reconciliation_item',
    v_item.id,
    v_operation_id,
    v_investigation_note,
    jsonb_build_object(
      'reconciliation_id', p_reconciliation_id,
      'finance_account_id', p_finance_account_id,
      'system_balance_paise', v_system_balance_paise,
      'external_balance_paise', p_external_balance_paise,
      'difference_paise', v_difference_paise,
      'evidence_type', v_evidence_type,
      'evidence_reference', v_evidence_reference,
      'discrepancy_status', v_discrepancy_status
    )
  );

  if v_difference_paise <> 0 then
    insert into public.finance_audit_events (
      actor_application_user_id,
      event_type,
      entity_type,
      entity_id,
      operation_id,
      reason,
      details
    )
    values (
      v_actor,
      'reconciliation_discrepancy_recorded',
      'finance_reconciliation_item',
      v_item.id,
      v_operation_id,
      v_investigation_note,
      jsonb_build_object(
        'reconciliation_id', p_reconciliation_id,
        'finance_account_id', p_finance_account_id,
        'difference_paise', v_difference_paise,
        'discrepancy_status', v_discrepancy_status
      )
    );
  end if;

  insert into public.finance_operation_idempotency values (
    v_operation_id,
    'reconciliation_item_record',
    v_actor,
    v_fingerprint,
    'finance_reconciliation_item',
    v_item.id,
    now()
  );

  return v_item;
end;
$$;

-- ---------------------------------------------------------------------------
-- Complete reconciliation.
--
-- Completion is rejected when:
--   - any account has not been reconciled
--   - an unresolved/open discrepancy exists
--   - ledger-derived balances changed after an item was recorded
--   - a newly relevant account is missing from the reconciliation
--
-- Investigated non-zero discrepancies remain recorded; they are not silently
-- repaired and no ledger mutation occurs here.
-- ---------------------------------------------------------------------------

create or replace function public.complete_finance_reconciliation(
  p_reconciliation_id uuid,
  p_notes text,
  p_operation_id text
)
returns public.finance_reconciliations
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_notes text := nullif(btrim(p_notes), '');
  v_operation_id text :=
    nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_reconciliation public.finance_reconciliations;
  v_matched_count integer;
  v_discrepancy_count integer;
  v_total_absolute_difference_paise numeric;
begin
  v_actor := public.lock_active_finance_actor();

  if not public.has_application_permission(
    'finance.reconciliation.manage'
  ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_reconciliation_id is null then
    raise exception 'invalid_reconciliation_id'
      using errcode = '22023';
  end if;

  if v_notes is not null and length(v_notes) > 2000 then
    raise exception 'invalid_notes'
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
        'operation', 'reconciliation_complete',
        'reconciliation_id', p_reconciliation_id,
        'notes', v_notes
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
       or v_existing.operation_type <>
            'reconciliation_complete'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_reconciliation
    from public.finance_reconciliations
    where id = v_existing.result_entity_id;

    return v_reconciliation;
  end if;

  select *
  into v_reconciliation
  from public.finance_reconciliations
  where id = p_reconciliation_id
  for update;

  if not found then
    raise exception 'reconciliation_not_found'
      using errcode = 'P0002';
  end if;

  if v_reconciliation.status <> 'in_progress' then
    raise exception 'reconciliation_not_in_progress'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.finance_reconciliation_items fri
    where fri.reconciliation_id = p_reconciliation_id
      and fri.external_balance_paise is null
  ) then
    raise exception 'reconciliation_incomplete'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.finance_reconciliation_items fri
    where fri.reconciliation_id = p_reconciliation_id
      and fri.discrepancy_status = 'open'
  ) then
    raise exception 'reconciliation_discrepancy_not_investigated'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.finance_accounts fa
    where not exists (
      select 1
      from public.finance_reconciliation_items fri
      where fri.reconciliation_id = p_reconciliation_id
        and fri.finance_account_id = fa.id
    )
      and exists (
        select 1
        from public.financial_transactions ft
        where ft.finance_account_id = fa.id
          and ft.business_date <=
            v_reconciliation.as_of_business_date
      )
  ) then
    raise exception 'reconciliation_account_set_stale'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.finance_reconciliation_items fri
    where fri.reconciliation_id = p_reconciliation_id
      and fri.system_balance_paise <> coalesce(
        (
          select sum(
            case ft.direction
              when 'inflow' then ft.amount_paise
              when 'outflow' then -ft.amount_paise
            end
          )
          from public.financial_transactions ft
          where ft.finance_account_id =
            fri.finance_account_id
            and ft.business_date <=
              v_reconciliation.as_of_business_date
        ),
        0
      )::bigint
  ) then
    raise exception 'reconciliation_snapshot_stale'
      using errcode = '55000';
  end if;

  select
    count(*) filter (
      where fri.discrepancy_status = 'matched'
    ),
    count(*) filter (
      where fri.discrepancy_status = 'investigated'
    ),
    coalesce(
      sum(abs(fri.difference_paise::numeric))
        filter (
          where fri.difference_paise is not null
        ),
      0
    )
  into
    v_matched_count,
    v_discrepancy_count,
    v_total_absolute_difference_paise
  from public.finance_reconciliation_items fri
  where fri.reconciliation_id = p_reconciliation_id;

  update public.finance_reconciliations
  set
    status = 'completed',
    completion_notes = v_notes,
    completed_by_application_user_id = v_actor,
    completed_at = now(),
    updated_at = now()
  where id = p_reconciliation_id
  returning *
  into v_reconciliation;

  insert into public.finance_audit_events (
    actor_application_user_id,
    event_type,
    entity_type,
    entity_id,
    operation_id,
    reason,
    details
  )
  values (
    v_actor,
    'reconciliation_completed',
    'finance_reconciliation',
    v_reconciliation.id,
    v_operation_id,
    v_notes,
    jsonb_build_object(
      'reconciliation_type',
        v_reconciliation.reconciliation_type,
      'period_month',
        v_reconciliation.period_month,
      'as_of_business_date',
        v_reconciliation.as_of_business_date,
      'matched_account_count',
        v_matched_count,
      'investigated_discrepancy_count',
        v_discrepancy_count,
      'total_absolute_difference_paise',
        v_total_absolute_difference_paise
    )
  );

  insert into public.finance_operation_idempotency values (
    v_operation_id,
    'reconciliation_complete',
    v_actor,
    v_fingerprint,
    'finance_reconciliation',
    v_reconciliation.id,
    now()
  );

  return v_reconciliation;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC permissions
-- ---------------------------------------------------------------------------

revoke all on function public.start_finance_reconciliation(
  text,
  date,
  date,
  text,
  text
) from public, anon, authenticated, service_role;

revoke all on function public.record_finance_reconciliation_item(
  uuid,
  uuid,
  bigint,
  text,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

revoke all on function public.complete_finance_reconciliation(
  uuid,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.start_finance_reconciliation(
  text,
  date,
  date,
  text,
  text
) to authenticated;

grant execute on function public.record_finance_reconciliation_item(
  uuid,
  uuid,
  bigint,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.complete_finance_reconciliation(
  uuid,
  text,
  text
) to authenticated;

commit;
