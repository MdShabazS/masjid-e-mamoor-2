-- Masjid-e-Mamoor 2
-- Phase 9A: Finance and accounting backend foundation
--
-- Monetary values are integer paise in INR. Account balances are derived
-- exclusively from the append-oriented financial_transactions table.

begin;

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null,
  status text not null default 'active',
  currency text not null default 'INR',
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_accounts_name_chk
    check (length(btrim(name)) between 1 and 120),
  constraint finance_accounts_type_chk
    check (account_type in ('bank', 'upi', 'cash', 'other')),
  constraint finance_accounts_status_chk
    check (status in ('active', 'inactive', 'closed')),
  constraint finance_accounts_currency_chk
    check (currency = 'INR')
);

create index finance_accounts_status_type_idx
  on public.finance_accounts(status, account_type, id);

create trigger finance_accounts_set_updated_at
before update on public.finance_accounts
for each row execute function public.set_updated_at();

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  finance_account_id uuid not null
    references public.finance_accounts(id) on delete restrict,
  transaction_category text not null,
  direction text not null,
  amount_paise bigint not null,
  currency text not null default 'INR',
  business_date date not null,
  reference_type text not null,
  reference_id uuid not null,
  related_transaction_id uuid
    references public.financial_transactions(id) on delete restrict,
  operation_id text not null,
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint financial_transactions_category_chk check (
    transaction_category in (
      'DONATION_RECURRING',
      'DONATION_ADDITIONAL',
      'DONATION_ANONYMOUS',
      'DONATION_JUMMAH',
      'EXPENSE',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'CORRECTION',
      'REVERSAL'
    )
  ),
  constraint financial_transactions_direction_chk
    check (direction in ('inflow', 'outflow')),
  constraint financial_transactions_amount_chk
    check (amount_paise > 0),
  constraint financial_transactions_currency_chk
    check (currency = 'INR'),
  constraint financial_transactions_reference_type_chk check (
    reference_type in (
      'donation_payment',
      'additional_donation',
      'anonymous_donation',
      'jummah_cash_donation',
      'finance_expense',
      'finance_transfer',
      'finance_adjustment'
    )
  ),
  constraint financial_transactions_operation_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint financial_transactions_category_direction_chk check (
    (transaction_category in (
      'DONATION_RECURRING', 'DONATION_ADDITIONAL',
      'DONATION_ANONYMOUS', 'DONATION_JUMMAH', 'TRANSFER_IN'
    ) and direction = 'inflow')
    or
    (transaction_category in ('EXPENSE', 'TRANSFER_OUT') and direction = 'outflow')
    or
    transaction_category in ('CORRECTION', 'REVERSAL')
  ),
  constraint financial_transactions_related_chk check (
    (transaction_category in ('CORRECTION', 'REVERSAL')
      and related_transaction_id is not null)
    or
    (transaction_category not in ('CORRECTION', 'REVERSAL')
      and related_transaction_id is null)
  ),
  constraint financial_transactions_effect_uidx unique (
    operation_id, transaction_category, finance_account_id, direction
  )
);

create index financial_transactions_account_business_idx
  on public.financial_transactions(finance_account_id, business_date, created_at, id);
create index financial_transactions_reference_idx
  on public.financial_transactions(reference_type, reference_id, created_at, id);
create index financial_transactions_related_idx
  on public.financial_transactions(related_transaction_id)
  where related_transaction_id is not null;

create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  finance_account_id uuid not null
    references public.finance_accounts(id) on delete restrict,
  amount_paise bigint not null,
  currency text not null default 'INR',
  description text not null,
  payee text,
  business_date date not null,
  status text not null default 'submitted',
  submitted_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  decided_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  posted_transaction_id uuid unique
    references public.financial_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_expenses_amount_chk check (amount_paise > 0),
  constraint finance_expenses_currency_chk check (currency = 'INR'),
  constraint finance_expenses_description_chk
    check (length(btrim(description)) between 1 and 2000),
  constraint finance_expenses_payee_chk
    check (payee is null or length(btrim(payee)) between 1 and 200),
  constraint finance_expenses_status_chk
    check (status in ('submitted', 'posted', 'rejected')),
  constraint finance_expenses_decision_chk check (
    (status = 'submitted'
      and decided_by_application_user_id is null
      and decided_at is null
      and rejection_reason is null
      and posted_transaction_id is null)
    or
    (status = 'posted'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is null
      and posted_transaction_id is not null)
    or
    (status = 'rejected'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is not null
      and posted_transaction_id is null)
  )
);

create index finance_expenses_status_created_idx
  on public.finance_expenses(status, created_at, id);
create index finance_expenses_account_business_idx
  on public.finance_expenses(finance_account_id, business_date, id);

create trigger finance_expenses_set_updated_at
before update on public.finance_expenses
for each row execute function public.set_updated_at();

create table public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  source_finance_account_id uuid not null
    references public.finance_accounts(id) on delete restrict,
  destination_finance_account_id uuid not null
    references public.finance_accounts(id) on delete restrict,
  amount_paise bigint not null,
  currency text not null default 'INR',
  reason text not null,
  business_date date not null,
  status text not null default 'submitted',
  submitted_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  decided_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  source_transaction_id uuid unique
    references public.financial_transactions(id) on delete restrict,
  destination_transaction_id uuid unique
    references public.financial_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_transfers_accounts_chk
    check (source_finance_account_id <> destination_finance_account_id),
  constraint finance_transfers_amount_chk check (amount_paise > 0),
  constraint finance_transfers_currency_chk check (currency = 'INR'),
  constraint finance_transfers_reason_chk
    check (length(btrim(reason)) between 1 and 1000),
  constraint finance_transfers_status_chk
    check (status in ('submitted', 'approved', 'rejected')),
  constraint finance_transfers_decision_chk check (
    (status = 'submitted'
      and decided_by_application_user_id is null
      and decided_at is null
      and rejection_reason is null
      and source_transaction_id is null
      and destination_transaction_id is null)
    or
    (status = 'approved'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is null
      and source_transaction_id is not null
      and destination_transaction_id is not null)
    or
    (status = 'rejected'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is not null
      and source_transaction_id is null
      and destination_transaction_id is null)
  )
);

create index finance_transfers_status_created_idx
  on public.finance_transfers(status, created_at, id);
create index finance_transfers_source_business_idx
  on public.finance_transfers(source_finance_account_id, business_date, id);
create index finance_transfers_destination_business_idx
  on public.finance_transfers(destination_finance_account_id, business_date, id);

create trigger finance_transfers_set_updated_at
before update on public.finance_transfers
for each row execute function public.set_updated_at();

create table public.finance_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_type text not null,
  target_transaction_id uuid not null
    references public.financial_transactions(id) on delete restrict,
  reason text not null,
  correction_finance_account_id uuid
    references public.finance_accounts(id) on delete restrict,
  correction_direction text,
  correction_amount_paise bigint,
  business_date date not null,
  status text not null default 'submitted',
  submitted_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  decided_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  applied_transaction_id uuid unique
    references public.financial_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_adjustments_type_chk
    check (adjustment_type in ('correction', 'reversal')),
  constraint finance_adjustments_reason_chk
    check (length(btrim(reason)) between 1 and 2000),
  constraint finance_adjustments_correction_chk check (
    (adjustment_type = 'correction'
      and correction_finance_account_id is not null
      and correction_direction in ('inflow', 'outflow')
      and correction_amount_paise > 0)
    or
    (adjustment_type = 'reversal'
      and correction_finance_account_id is null
      and correction_direction is null
      and correction_amount_paise is null)
  ),
  constraint finance_adjustments_status_chk
    check (status in ('submitted', 'applied', 'rejected')),
  constraint finance_adjustments_decision_chk check (
    (status = 'submitted'
      and decided_by_application_user_id is null
      and decided_at is null
      and rejection_reason is null
      and applied_transaction_id is null)
    or
    (status = 'applied'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is null
      and applied_transaction_id is not null)
    or
    (status = 'rejected'
      and decided_by_application_user_id is not null
      and decided_by_application_user_id <> submitted_by_application_user_id
      and decided_at is not null
      and rejection_reason is not null
      and applied_transaction_id is null)
  )
);

create unique index finance_adjustments_active_reversal_uidx
  on public.finance_adjustments(target_transaction_id)
  where adjustment_type = 'reversal' and status in ('submitted', 'applied');
create index finance_adjustments_status_created_idx
  on public.finance_adjustments(status, created_at, id);

create trigger finance_adjustments_set_updated_at
before update on public.finance_adjustments
for each row execute function public.set_updated_at();

create table public.finance_operation_idempotency (
  operation_id text primary key,
  operation_type text not null,
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  request_fingerprint text not null,
  result_entity_type text not null,
  result_entity_id uuid not null,
  created_at timestamptz not null default now(),

  constraint finance_operation_idempotency_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint finance_operation_idempotency_type_chk check (
    operation_type in (
      'account_create', 'account_status_change',
      'expense_submit', 'expense_decide',
      'transfer_submit', 'transfer_decide',
      'adjustment_submit', 'adjustment_decide'
    )
  ),
  constraint finance_operation_idempotency_fingerprint_chk
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint finance_operation_idempotency_result_type_chk check (
    result_entity_type in (
      'finance_account', 'finance_expense',
      'finance_transfer', 'finance_adjustment'
    )
  )
);

create index finance_operation_idempotency_actor_created_idx
  on public.finance_operation_idempotency(
    actor_application_user_id, created_at, operation_id
  );

comment on table public.finance_operation_idempotency is
  'Successful finance operations; retain for at least one year.';

create table public.finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  operation_id text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint finance_audit_events_type_chk check (
    event_type in (
      'account_created', 'account_status_changed',
      'expense_submitted', 'expense_posted', 'expense_rejected',
      'transfer_submitted', 'transfer_approved', 'transfer_rejected',
      'adjustment_submitted', 'correction_applied',
      'reversal_applied', 'adjustment_rejected'
    )
  ),
  constraint finance_audit_events_entity_type_chk check (
    entity_type in (
      'finance_account', 'finance_expense',
      'finance_transfer', 'finance_adjustment'
    )
  ),
  constraint finance_audit_events_operation_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint finance_audit_events_reason_chk
    check (reason is null or length(btrim(reason)) between 1 and 2000)
);

create index finance_audit_events_entity_created_idx
  on public.finance_audit_events(entity_type, entity_id, created_at, id);
create index finance_audit_events_actor_created_idx
  on public.finance_audit_events(actor_application_user_id, created_at, id);

create or replace function public.reject_finance_immutable_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'financial_history_immutable' using errcode = '55000';
end;
$$;

create or replace function public.enforce_finance_adjustment_lineage()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_applied public.financial_transactions;
  v_target public.financial_transactions;
begin
  if new.applied_transaction_id is null then
    return new;
  end if;

  select * into v_applied
  from public.financial_transactions
  where id = new.applied_transaction_id;
  select * into v_target
  from public.financial_transactions
  where id = new.target_transaction_id;

  if v_applied.id is null
     or v_target.id is null
     or v_applied.reference_type <> 'finance_adjustment'
     or v_applied.reference_id <> new.id
     or v_applied.related_transaction_id <> new.target_transaction_id then
    raise exception 'invalid_adjustment_lineage' using errcode = '23514';
  end if;

  if new.adjustment_type = 'reversal' and (
    v_applied.transaction_category <> 'REVERSAL'
    or v_applied.finance_account_id <> v_target.finance_account_id
    or v_applied.direction <> case v_target.direction
      when 'inflow' then 'outflow' else 'inflow' end
    or v_applied.amount_paise <> v_target.amount_paise
  ) then
    raise exception 'invalid_adjustment_lineage' using errcode = '23514';
  end if;

  if new.adjustment_type = 'correction' and (
    v_applied.transaction_category <> 'CORRECTION'
    or v_applied.finance_account_id <> new.correction_finance_account_id
    or v_applied.direction <> new.correction_direction
    or v_applied.amount_paise <> new.correction_amount_paise
  ) then
    raise exception 'invalid_adjustment_lineage' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger financial_transactions_immutable
before update or delete on public.financial_transactions
for each row execute function public.reject_finance_immutable_change();

create trigger finance_audit_events_immutable
before update or delete on public.finance_audit_events
for each row execute function public.reject_finance_immutable_change();

create trigger finance_accounts_no_delete
before delete on public.finance_accounts
for each row execute function public.reject_finance_immutable_change();

create trigger finance_expenses_no_delete
before delete on public.finance_expenses
for each row execute function public.reject_finance_immutable_change();

create trigger finance_transfers_no_delete
before delete on public.finance_transfers
for each row execute function public.reject_finance_immutable_change();

create trigger finance_adjustments_no_delete
before delete on public.finance_adjustments
for each row execute function public.reject_finance_immutable_change();

create trigger finance_adjustments_enforce_lineage
before insert or update on public.finance_adjustments
for each row execute function public.enforce_finance_adjustment_lineage();

alter table public.finance_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_transfers enable row level security;
alter table public.finance_adjustments enable row level security;
alter table public.finance_operation_idempotency enable row level security;
alter table public.finance_audit_events enable row level security;

create policy finance_accounts_authorized_read
on public.finance_accounts for select to authenticated
using (public.has_application_permission('finance.accounts.read'));

create policy financial_transactions_authorized_read
on public.financial_transactions for select to authenticated
using (public.has_application_permission('finance.transactions.read'));

create policy finance_expenses_authorized_read
on public.finance_expenses for select to authenticated
using (
  public.has_application_permission('finance.transactions.read')
  or public.has_application_permission('finance.expenses.create')
  or public.has_application_permission('finance.expenses.approve')
);

create policy finance_transfers_authorized_read
on public.finance_transfers for select to authenticated
using (
  public.has_application_permission('finance.transactions.read')
  or public.has_application_permission('finance.transfers.create')
  or public.has_application_permission('finance.transfers.approve')
);

create policy finance_adjustments_authorized_read
on public.finance_adjustments for select to authenticated
using (
  public.has_application_permission('finance.transactions.read')
  or public.has_application_permission('finance.corrections.create')
  or public.has_application_permission('finance.cancellations.create')
);

create policy finance_audit_events_authorized_read
on public.finance_audit_events for select to authenticated
using (
  public.has_application_permission('audit.records.read')
  or public.has_application_permission('finance.reports.read')
  or public.has_application_permission('reports.finance.read')
);

create view public.finance_account_balances
with (security_invoker = true)
as
select
  fa.id as finance_account_id,
  fa.currency,
  coalesce(sum(
    case ft.direction
      when 'inflow' then ft.amount_paise
      when 'outflow' then -ft.amount_paise
    end
  ), 0)::bigint as balance_paise
from public.finance_accounts fa
left join public.financial_transactions ft
  on ft.finance_account_id = fa.id
group by fa.id, fa.currency;

comment on view public.finance_account_balances is
  'Calculated authoritative balances derived from immutable financial effects.';

revoke all on table public.finance_accounts from public, anon, authenticated;
revoke all on table public.financial_transactions from public, anon, authenticated;
revoke all on table public.finance_expenses from public, anon, authenticated;
revoke all on table public.finance_transfers from public, anon, authenticated;
revoke all on table public.finance_adjustments from public, anon, authenticated;
revoke all on table public.finance_operation_idempotency from public, anon, authenticated;
revoke all on table public.finance_audit_events from public, anon, authenticated;
revoke all on table public.finance_account_balances from public, anon, authenticated;

grant select on table public.finance_accounts to authenticated;
grant select on table public.financial_transactions to authenticated;
grant select on table public.finance_expenses to authenticated;
grant select on table public.finance_transfers to authenticated;
grant select on table public.finance_adjustments to authenticated;
grant select on table public.finance_audit_events to authenticated;
grant select on table public.finance_account_balances to authenticated;

grant all on table public.finance_accounts to service_role;
grant all on table public.financial_transactions to service_role;
grant all on table public.finance_expenses to service_role;
grant all on table public.finance_transfers to service_role;
grant all on table public.finance_adjustments to service_role;
grant all on table public.finance_operation_idempotency to service_role;
grant all on table public.finance_audit_events to service_role;
grant select on table public.finance_account_balances to service_role;

-- Lock the active caller and their single V1 role assignment before any
-- finance operation takes its operation or domain locks. This gives account
-- deactivation/role changes and finance mutations a clear authorization
-- linearization point instead of relying on a stale permission snapshot.
create or replace function public.lock_active_finance_actor()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select au.id
  into v_actor
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  where au.auth_user_id = auth.uid()
    and au.status = 'active'
  for update of au, aur;

  if v_actor is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

create or replace function public.create_finance_account(
  p_name text,
  p_account_type text,
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
  v_account_type text := lower(btrim(p_account_type));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_account public.finance_accounts;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.accounts.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) > 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_account_type is null or v_account_type not in ('bank', 'upi', 'cash', 'other') then
    raise exception 'invalid_account_type' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'account_create', 'name', v_name,
    'account_type', v_account_type, 'currency', 'INR'
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency
  where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'account_create'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_account from public.finance_accounts
    where id = v_existing.result_entity_id;
    return v_account;
  end if;

  insert into public.finance_accounts (
    name, account_type, created_by_application_user_id
  ) values (v_name, v_account_type, v_actor)
  returning * into v_account;

  insert into public.finance_audit_events (
    actor_application_user_id, event_type, entity_type, entity_id,
    operation_id, details
  ) values (
    v_actor, 'account_created', 'finance_account', v_account.id,
    v_operation_id, jsonb_build_object(
      'name', v_account.name, 'account_type', v_account.account_type,
      'currency', v_account.currency, 'status', v_account.status
    )
  );
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'account_create', v_actor, v_fingerprint,
    'finance_account', v_account.id, now()
  );
  return v_account;
end;
$$;

create or replace function public.set_finance_account_status(
  p_finance_account_id uuid,
  p_status text,
  p_operation_id text
)
returns public.finance_accounts
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_status text := lower(btrim(p_status));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_account public.finance_accounts;
  v_previous_status text;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.accounts.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_finance_account_id is null then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  if v_status is null or v_status not in ('active', 'inactive', 'closed') then
    raise exception 'invalid_account_status' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;
  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'account_status_change',
    'finance_account_id', p_finance_account_id, 'status', v_status
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency
  where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'account_status_change'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_account from public.finance_accounts where id = v_existing.result_entity_id;
    return v_account;
  end if;

  select * into v_account from public.finance_accounts
  where id = p_finance_account_id for update;
  if not found then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  v_previous_status := v_account.status;
  if v_previous_status = 'closed' and v_status <> 'closed' then
    raise exception 'account_closed' using errcode = '22023';
  end if;

  update public.finance_accounts set status = v_status
  where id = p_finance_account_id returning * into v_account;
  insert into public.finance_audit_events (
    actor_application_user_id, event_type, entity_type, entity_id,
    operation_id, details
  ) values (
    v_actor, 'account_status_changed', 'finance_account', v_account.id,
    v_operation_id, jsonb_build_object(
      'previous_status', v_previous_status, 'status', v_status
    )
  );
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'account_status_change', v_actor, v_fingerprint,
    'finance_account', v_account.id, now()
  );
  return v_account;
end;
$$;

create or replace function public.submit_finance_expense(
  p_finance_account_id uuid,
  p_amount_paise bigint,
  p_description text,
  p_payee text,
  p_business_date date,
  p_operation_id text
)
returns public.finance_expenses
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_description text := nullif(btrim(p_description), '');
  v_payee text := nullif(btrim(p_payee), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_account public.finance_accounts;
  v_expense public.finance_expenses;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.expenses.create') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if v_description is null or length(v_description) > 2000 then raise exception 'invalid_description' using errcode = '22023'; end if;
  if v_payee is not null and length(v_payee) > 200 then raise exception 'invalid_payee' using errcode = '22023'; end if;
  if p_business_date is null then raise exception 'invalid_business_date' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'expense_submit', 'finance_account_id', p_finance_account_id,
    'amount_paise', p_amount_paise, 'description', v_description,
    'payee', v_payee, 'business_date', p_business_date
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'expense_submit'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;

  select * into v_account from public.finance_accounts
  where id = p_finance_account_id for update;
  if not found then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  if v_account.status <> 'active' then raise exception 'account_not_active' using errcode = '22023'; end if;

  insert into public.finance_expenses (
    finance_account_id, amount_paise, description, payee, business_date,
    submitted_by_application_user_id
  ) values (
    p_finance_account_id, p_amount_paise, v_description, v_payee,
    p_business_date, v_actor
  ) returning * into v_expense;
  insert into public.finance_audit_events (
    actor_application_user_id, event_type, entity_type, entity_id,
    operation_id, details
  ) values (
    v_actor, 'expense_submitted', 'finance_expense', v_expense.id,
    v_operation_id, jsonb_build_object(
      'finance_account_id', p_finance_account_id,
      'amount_paise', p_amount_paise, 'business_date', p_business_date
    )
  );
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'expense_submit', v_actor, v_fingerprint,
    'finance_expense', v_expense.id, now()
  );
  return v_expense;
end;
$$;

create or replace function public.decide_finance_expense(
  p_finance_expense_id uuid,
  p_decision text,
  p_reason text,
  p_operation_id text
)
returns public.finance_expenses
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_decision text := lower(btrim(p_decision));
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_expense public.finance_expenses;
  v_account public.finance_accounts;
  v_transaction public.financial_transactions;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.expenses.approve') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_decision is null or v_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if v_decision = 'reject' and v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
  if v_reason is not null and length(v_reason) > 2000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'expense_decide', 'finance_expense_id', p_finance_expense_id,
    'decision', v_decision, 'reason', v_reason
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'expense_decide'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;

  select * into v_expense from public.finance_expenses
  where id = p_finance_expense_id for update;
  if not found then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if v_expense.status <> 'submitted' then raise exception 'expense_invalid_state' using errcode = '22023'; end if;
  if v_expense.submitted_by_application_user_id = v_actor then raise exception 'maker_checker_violation' using errcode = '42501'; end if;

  if v_decision = 'approve' then
    select * into v_account from public.finance_accounts
    where id = v_expense.finance_account_id for update;
    if v_account.status <> 'active' then raise exception 'account_not_active' using errcode = '22023'; end if;
    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise,
      business_date, reference_type, reference_id, operation_id,
      created_by_application_user_id
    ) values (
      v_expense.finance_account_id, 'EXPENSE', 'outflow', v_expense.amount_paise,
      v_expense.business_date, 'finance_expense', v_expense.id, v_operation_id,
      v_actor
    ) returning * into v_transaction;
    update public.finance_expenses set
      status = 'posted', decided_by_application_user_id = v_actor,
      decided_at = now(), posted_transaction_id = v_transaction.id
    where id = v_expense.id returning * into v_expense;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, details
    ) values (
      v_actor, 'expense_posted', 'finance_expense', v_expense.id,
      v_operation_id, jsonb_build_object(
        'financial_transaction_id', v_transaction.id,
        'amount_paise', v_expense.amount_paise
      )
    );
  else
    update public.finance_expenses set
      status = 'rejected', decided_by_application_user_id = v_actor,
      decided_at = now(), rejection_reason = v_reason
    where id = v_expense.id returning * into v_expense;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, reason
    ) values (
      v_actor, 'expense_rejected', 'finance_expense', v_expense.id,
      v_operation_id, v_reason
    );
  end if;
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'expense_decide', v_actor, v_fingerprint,
    'finance_expense', v_expense.id, now()
  );
  return v_expense;
end;
$$;

create or replace function public.submit_finance_transfer(
  p_source_finance_account_id uuid,
  p_destination_finance_account_id uuid,
  p_amount_paise bigint,
  p_reason text,
  p_business_date date,
  p_operation_id text
)
returns public.finance_transfers
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_transfer public.finance_transfers;
  v_active_count integer;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.transfers.create') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_source_finance_account_id is null or p_destination_finance_account_id is null then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  if p_source_finance_account_id = p_destination_finance_account_id then raise exception 'self_transfer' using errcode = '22023'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if v_reason is null or length(v_reason) > 1000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if p_business_date is null then raise exception 'invalid_business_date' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'transfer_submit', 'source', p_source_finance_account_id,
    'destination', p_destination_finance_account_id,
    'amount_paise', p_amount_paise, 'reason', v_reason,
    'business_date', p_business_date
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'transfer_submit'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_transfer from public.finance_transfers where id = v_existing.result_entity_id;
    return v_transfer;
  end if;

  perform 1 from public.finance_accounts
  where id in (p_source_finance_account_id, p_destination_finance_account_id)
  order by id for update;
  select count(*) into v_active_count from public.finance_accounts
  where id in (p_source_finance_account_id, p_destination_finance_account_id)
    and status = 'active';
  if v_active_count <> 2 then raise exception 'account_not_active' using errcode = '22023'; end if;

  insert into public.finance_transfers (
    source_finance_account_id, destination_finance_account_id,
    amount_paise, reason, business_date, submitted_by_application_user_id
  ) values (
    p_source_finance_account_id, p_destination_finance_account_id,
    p_amount_paise, v_reason, p_business_date, v_actor
  ) returning * into v_transfer;
  insert into public.finance_audit_events (
    actor_application_user_id, event_type, entity_type, entity_id,
    operation_id, reason, details
  ) values (
    v_actor, 'transfer_submitted', 'finance_transfer', v_transfer.id,
    v_operation_id, v_reason, jsonb_build_object(
      'source_finance_account_id', p_source_finance_account_id,
      'destination_finance_account_id', p_destination_finance_account_id,
      'amount_paise', p_amount_paise, 'business_date', p_business_date
    )
  );
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'transfer_submit', v_actor, v_fingerprint,
    'finance_transfer', v_transfer.id, now()
  );
  return v_transfer;
end;
$$;

create or replace function public.decide_finance_transfer(
  p_finance_transfer_id uuid,
  p_decision text,
  p_reason text,
  p_operation_id text
)
returns public.finance_transfers
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_decision text := lower(btrim(p_decision));
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_transfer public.finance_transfers;
  v_source_transaction public.financial_transactions;
  v_destination_transaction public.financial_transactions;
  v_active_count integer;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.transfers.approve') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_decision is null or v_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if v_decision = 'reject' and v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
  if v_reason is not null and length(v_reason) > 2000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'transfer_decide', 'finance_transfer_id', p_finance_transfer_id,
    'decision', v_decision, 'reason', v_reason
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'transfer_decide'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_transfer from public.finance_transfers where id = v_existing.result_entity_id;
    return v_transfer;
  end if;

  select * into v_transfer from public.finance_transfers
  where id = p_finance_transfer_id for update;
  if not found then raise exception 'transfer_not_found' using errcode = 'P0002'; end if;
  if v_transfer.status <> 'submitted' then raise exception 'transfer_invalid_state' using errcode = '22023'; end if;
  if v_transfer.submitted_by_application_user_id = v_actor then raise exception 'maker_checker_violation' using errcode = '42501'; end if;

  if v_decision = 'approve' then
    perform 1 from public.finance_accounts
    where id in (
      v_transfer.source_finance_account_id,
      v_transfer.destination_finance_account_id
    ) order by id for update;
    select count(*) into v_active_count from public.finance_accounts
    where id in (
      v_transfer.source_finance_account_id,
      v_transfer.destination_finance_account_id
    ) and status = 'active';
    if v_active_count <> 2 then raise exception 'account_not_active' using errcode = '22023'; end if;

    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise,
      business_date, reference_type, reference_id, operation_id,
      created_by_application_user_id
    ) values (
      v_transfer.source_finance_account_id, 'TRANSFER_OUT', 'outflow',
      v_transfer.amount_paise, v_transfer.business_date, 'finance_transfer',
      v_transfer.id, v_operation_id, v_actor
    ) returning * into v_source_transaction;
    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise,
      business_date, reference_type, reference_id, operation_id,
      created_by_application_user_id
    ) values (
      v_transfer.destination_finance_account_id, 'TRANSFER_IN', 'inflow',
      v_transfer.amount_paise, v_transfer.business_date, 'finance_transfer',
      v_transfer.id, v_operation_id, v_actor
    ) returning * into v_destination_transaction;
    update public.finance_transfers set
      status = 'approved', decided_by_application_user_id = v_actor,
      decided_at = now(), source_transaction_id = v_source_transaction.id,
      destination_transaction_id = v_destination_transaction.id
    where id = v_transfer.id returning * into v_transfer;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, details
    ) values (
      v_actor, 'transfer_approved', 'finance_transfer', v_transfer.id,
      v_operation_id, jsonb_build_object(
        'source_transaction_id', v_source_transaction.id,
        'destination_transaction_id', v_destination_transaction.id,
        'amount_paise', v_transfer.amount_paise
      )
    );
  else
    update public.finance_transfers set
      status = 'rejected', decided_by_application_user_id = v_actor,
      decided_at = now(), rejection_reason = v_reason
    where id = v_transfer.id returning * into v_transfer;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, reason
    ) values (
      v_actor, 'transfer_rejected', 'finance_transfer', v_transfer.id,
      v_operation_id, v_reason
    );
  end if;
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'transfer_decide', v_actor, v_fingerprint,
    'finance_transfer', v_transfer.id, now()
  );
  return v_transfer;
end;
$$;

create or replace function public.submit_finance_adjustment(
  p_target_transaction_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_correction_finance_account_id uuid,
  p_correction_direction text,
  p_correction_amount_paise bigint,
  p_business_date date,
  p_operation_id text
)
returns public.finance_adjustments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_adjustment_type text := lower(btrim(p_adjustment_type));
  v_reason text := nullif(btrim(p_reason), '');
  v_direction text := lower(nullif(btrim(p_correction_direction), ''));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_target public.financial_transactions;
  v_adjustment public.finance_adjustments;
begin
  v_actor := public.lock_active_finance_actor();
  if v_adjustment_type = 'correction' then
    if not public.has_application_permission('finance.corrections.create') then raise exception 'not_authorized' using errcode = '42501'; end if;
  elsif v_adjustment_type = 'reversal' then
    if not public.has_application_permission('finance.cancellations.create') then raise exception 'not_authorized' using errcode = '42501'; end if;
  else
    raise exception 'invalid_adjustment_type' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) > 2000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if p_business_date is null then raise exception 'invalid_business_date' using errcode = '22023'; end if;
  if v_adjustment_type = 'correction' and (
    p_correction_finance_account_id is null
    or v_direction is null or v_direction not in ('inflow', 'outflow')
    or p_correction_amount_paise is null or p_correction_amount_paise <= 0
  ) then raise exception 'invalid_correction_effect' using errcode = '22023'; end if;
  if v_adjustment_type = 'reversal' and (
    p_correction_finance_account_id is not null
    or v_direction is not null or p_correction_amount_paise is not null
  ) then raise exception 'invalid_reversal_effect' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'adjustment_submit', 'target_transaction_id', p_target_transaction_id,
    'adjustment_type', v_adjustment_type, 'reason', v_reason,
    'correction_finance_account_id', p_correction_finance_account_id,
    'correction_direction', v_direction,
    'correction_amount_paise', p_correction_amount_paise,
    'business_date', p_business_date
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'adjustment_submit'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_adjustment from public.finance_adjustments where id = v_existing.result_entity_id;
    return v_adjustment;
  end if;

  select * into v_target from public.financial_transactions
  where id = p_target_transaction_id;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if v_target.transaction_category in ('TRANSFER_IN', 'TRANSFER_OUT') then
    raise exception 'paired_transfer_adjustment_required' using errcode = '22023';
  end if;
  if v_adjustment_type = 'reversal' and v_target.transaction_category = 'REVERSAL' then
    raise exception 'reversal_not_allowed' using errcode = '22023';
  end if;
  if v_adjustment_type = 'correction' then
    perform 1 from public.finance_accounts
    where id = p_correction_finance_account_id and status = 'active';
    if not found then raise exception 'account_not_active' using errcode = '22023'; end if;
  end if;

  insert into public.finance_adjustments (
    adjustment_type, target_transaction_id, reason,
    correction_finance_account_id, correction_direction,
    correction_amount_paise, business_date,
    submitted_by_application_user_id
  ) values (
    v_adjustment_type, p_target_transaction_id, v_reason,
    case when v_adjustment_type = 'correction' then p_correction_finance_account_id end,
    case when v_adjustment_type = 'correction' then v_direction end,
    case when v_adjustment_type = 'correction' then p_correction_amount_paise end,
    p_business_date, v_actor
  ) returning * into v_adjustment;
  insert into public.finance_audit_events (
    actor_application_user_id, event_type, entity_type, entity_id,
    operation_id, reason, details
  ) values (
    v_actor, 'adjustment_submitted', 'finance_adjustment', v_adjustment.id,
    v_operation_id, v_reason, jsonb_build_object(
      'adjustment_type', v_adjustment_type,
      'target_transaction_id', p_target_transaction_id
    )
  );
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'adjustment_submit', v_actor, v_fingerprint,
    'finance_adjustment', v_adjustment.id, now()
  );
  return v_adjustment;
end;
$$;

create or replace function public.decide_finance_adjustment(
  p_finance_adjustment_id uuid,
  p_decision text,
  p_reason text,
  p_operation_id text
)
returns public.finance_adjustments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_decision text := lower(btrim(p_decision));
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_adjustment public.finance_adjustments;
  v_target public.financial_transactions;
  v_account public.finance_accounts;
  v_transaction public.financial_transactions;
  v_account_id uuid;
  v_direction text;
  v_amount_paise bigint;
  v_category text;
begin
  v_actor := public.lock_active_finance_actor();
  if not public.has_application_permission('finance.corrections.create')
     and not public.has_application_permission('finance.cancellations.create') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_decision is null or v_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if v_decision = 'reject' and v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
  if v_reason is not null and length(v_reason) > 2000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'adjustment_decide', 'finance_adjustment_id', p_finance_adjustment_id,
    'decision', v_decision, 'reason', v_reason
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'adjustment_decide'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_adjustment from public.finance_adjustments where id = v_existing.result_entity_id;
    if (v_adjustment.adjustment_type = 'correction'
        and not public.has_application_permission('finance.corrections.create'))
       or (v_adjustment.adjustment_type = 'reversal'
        and not public.has_application_permission('finance.cancellations.create')) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    return v_adjustment;
  end if;

  select * into v_adjustment from public.finance_adjustments
  where id = p_finance_adjustment_id for update;
  if not found then raise exception 'adjustment_not_found' using errcode = 'P0002'; end if;
  if v_adjustment.adjustment_type = 'correction' then
    if not public.has_application_permission('finance.corrections.create') then raise exception 'not_authorized' using errcode = '42501'; end if;
  else
    if not public.has_application_permission('finance.cancellations.create') then raise exception 'not_authorized' using errcode = '42501'; end if;
  end if;
  if v_adjustment.status <> 'submitted' then raise exception 'adjustment_invalid_state' using errcode = '22023'; end if;
  if v_adjustment.submitted_by_application_user_id = v_actor then raise exception 'maker_checker_violation' using errcode = '42501'; end if;

  if v_decision = 'approve' then
    select * into v_target from public.financial_transactions
    where id = v_adjustment.target_transaction_id;
    if v_adjustment.adjustment_type = 'reversal' then
      v_account_id := v_target.finance_account_id;
      v_direction := case v_target.direction when 'inflow' then 'outflow' else 'inflow' end;
      v_amount_paise := v_target.amount_paise;
      v_category := 'REVERSAL';
    else
      v_account_id := v_adjustment.correction_finance_account_id;
      v_direction := v_adjustment.correction_direction;
      v_amount_paise := v_adjustment.correction_amount_paise;
      v_category := 'CORRECTION';
    end if;
    select * into v_account from public.finance_accounts
    where id = v_account_id for update;
    if v_account.status <> 'active' then raise exception 'account_not_active' using errcode = '22023'; end if;

    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise,
      business_date, reference_type, reference_id, related_transaction_id,
      operation_id, created_by_application_user_id
    ) values (
      v_account_id, v_category, v_direction, v_amount_paise,
      v_adjustment.business_date, 'finance_adjustment', v_adjustment.id,
      v_target.id, v_operation_id, v_actor
    ) returning * into v_transaction;
    update public.finance_adjustments set
      status = 'applied', decided_by_application_user_id = v_actor,
      decided_at = now(), applied_transaction_id = v_transaction.id
    where id = v_adjustment.id returning * into v_adjustment;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, reason, details
    ) values (
      v_actor,
      case when v_adjustment.adjustment_type = 'correction'
        then 'correction_applied' else 'reversal_applied' end,
      'finance_adjustment', v_adjustment.id, v_operation_id,
      v_adjustment.reason, jsonb_build_object(
        'target_transaction_id', v_target.id,
        'applied_transaction_id', v_transaction.id,
        'amount_paise', v_transaction.amount_paise,
        'direction', v_transaction.direction
      )
    );
  else
    update public.finance_adjustments set
      status = 'rejected', decided_by_application_user_id = v_actor,
      decided_at = now(), rejection_reason = v_reason
    where id = v_adjustment.id returning * into v_adjustment;
    insert into public.finance_audit_events (
      actor_application_user_id, event_type, entity_type, entity_id,
      operation_id, reason, details
    ) values (
      v_actor, 'adjustment_rejected', 'finance_adjustment', v_adjustment.id,
      v_operation_id, v_reason,
      jsonb_build_object('adjustment_type', v_adjustment.adjustment_type)
    );
  end if;
  insert into public.finance_operation_idempotency values (
    v_operation_id, 'adjustment_decide', v_actor, v_fingerprint,
    'finance_adjustment', v_adjustment.id, now()
  );
  return v_adjustment;
end;
$$;

revoke execute on function public.reject_finance_immutable_change() from public, anon, authenticated;
revoke execute on function public.enforce_finance_adjustment_lineage() from public, anon, authenticated;
revoke execute on function public.lock_active_finance_actor() from public, anon, authenticated;

revoke execute on function public.create_finance_account(text, text, text) from public, anon;
revoke execute on function public.set_finance_account_status(uuid, text, text) from public, anon;
revoke execute on function public.submit_finance_expense(uuid, bigint, text, text, date, text) from public, anon;
revoke execute on function public.decide_finance_expense(uuid, text, text, text) from public, anon;
revoke execute on function public.submit_finance_transfer(uuid, uuid, bigint, text, date, text) from public, anon;
revoke execute on function public.decide_finance_transfer(uuid, text, text, text) from public, anon;
revoke execute on function public.submit_finance_adjustment(uuid, text, text, uuid, text, bigint, date, text) from public, anon;
revoke execute on function public.decide_finance_adjustment(uuid, text, text, text) from public, anon;

grant execute on function public.create_finance_account(text, text, text) to authenticated;
grant execute on function public.set_finance_account_status(uuid, text, text) to authenticated;
grant execute on function public.submit_finance_expense(uuid, bigint, text, text, date, text) to authenticated;
grant execute on function public.decide_finance_expense(uuid, text, text, text) to authenticated;
grant execute on function public.submit_finance_transfer(uuid, uuid, bigint, text, date, text) to authenticated;
grant execute on function public.decide_finance_transfer(uuid, text, text, text) to authenticated;
grant execute on function public.submit_finance_adjustment(uuid, text, text, uuid, text, bigint, date, text) to authenticated;
grant execute on function public.decide_finance_adjustment(uuid, text, text, text) to authenticated;

commit;
