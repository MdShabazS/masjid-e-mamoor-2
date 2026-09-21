-- Donation Domain Foundation V1
--
-- Authoritative relational foundation for donation obligations,
-- payment submissions, allocations, waivers, additional donations,
-- proof metadata, and operation idempotency.
--
-- Monetary values are stored as integer paise (BIGINT).
-- Sensitive financial state transitions are performed only by later
-- trusted operations.

begin;

-- ---------------------------------------------------------------------------
-- Donation obligation rules
-- ---------------------------------------------------------------------------

create table public.donation_obligation_rules (
  id uuid primary key default gen_random_uuid(),
  effective_from_month date not null,
  monthly_amount_paise bigint not null,
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  operation_id text not null,
  created_at timestamptz not null default now(),

  constraint donation_obligation_rules_month_start_chk
    check (effective_from_month = date_trunc('month', effective_from_month)::date),

  constraint donation_obligation_rules_amount_chk
    check (monthly_amount_paise > 0),

  constraint donation_obligation_rules_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_obligation_rules_effective_month_uidx
    unique (effective_from_month),

  constraint donation_obligation_rules_operation_id_uidx
    unique (operation_id)
);

-- ---------------------------------------------------------------------------
-- Monthly member obligations
-- ---------------------------------------------------------------------------

create table public.donation_obligations (
  id uuid primary key default gen_random_uuid(),

  member_profile_id uuid not null
    references public.member_profiles(id) on delete restrict,

  obligation_rule_id uuid
    references public.donation_obligation_rules(id) on delete restrict,

  effective_month date not null,
  authoritative_amount_paise bigint not null,

  status text not null default 'outstanding'
    check (
      status in (
        'outstanding',
        'partially_paid',
        'paid',
        'waived'
      )
    ),

  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  operation_id text not null,
  created_at timestamptz not null default now(),

  constraint donation_obligations_month_start_chk
    check (effective_month = date_trunc('month', effective_month)::date),

  constraint donation_obligations_amount_chk
    check (authoritative_amount_paise > 0),

  constraint donation_obligations_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_obligations_member_month_uidx
    unique (member_profile_id, effective_month),

  constraint donation_obligations_operation_id_uidx
    unique (operation_id)
);

create index donation_obligations_member_month_idx
  on public.donation_obligations(member_profile_id, effective_month, id);

create index donation_obligations_status_month_idx
  on public.donation_obligations(status, effective_month, id);

-- ---------------------------------------------------------------------------
-- Obligation waivers
-- ---------------------------------------------------------------------------

create table public.donation_obligation_waivers (
  id uuid primary key default gen_random_uuid(),

  obligation_id uuid not null
    references public.donation_obligations(id) on delete restrict,

  waived_amount_paise bigint not null,

  reason text not null,

  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  operation_id text not null,
  created_at timestamptz not null default now(),

  constraint donation_obligation_waivers_amount_chk
    check (waived_amount_paise > 0),

  constraint donation_obligation_waivers_reason_chk
    check (
      length(btrim(reason)) >= 1
      and length(btrim(reason)) <= 1000
    ),

  constraint donation_obligation_waivers_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_obligation_waivers_operation_id_uidx
    unique (operation_id)
);

create index donation_obligation_waivers_obligation_idx
  on public.donation_obligation_waivers(obligation_id, created_at, id);

-- ---------------------------------------------------------------------------
-- Payment submissions
-- ---------------------------------------------------------------------------

create table public.donation_payments (
  id uuid primary key default gen_random_uuid(),

  member_profile_id uuid not null
    references public.member_profiles(id) on delete restrict,

  amount_paise bigint not null,

  payment_method text not null
    check (
      payment_method in (
        'cash',
        'upi',
        'bank_transfer',
        'other'
      )
    ),

  status text not null default 'submitted'
    check (
      status in (
        'submitted',
        'under_review',
        'verified',
        'rejected'
      )
    ),

  submitted_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  reviewed_by_application_user_id uuid
    references public.application_users(id) on delete restrict,

  reviewed_at timestamptz,

  rejection_reason text,

  operation_id text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint donation_payments_amount_chk
    check (amount_paise > 0),

  constraint donation_payments_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_payments_operation_id_uidx
    unique (operation_id),

  constraint donation_payments_review_state_chk
    check (
      (
        status = 'submitted'
        and reviewed_by_application_user_id is null
        and reviewed_at is null
        and rejection_reason is null
      )
      or
      (
        status = 'under_review'
        and reviewed_by_application_user_id is not null
        and reviewed_at is null
        and rejection_reason is null
      )
      or
      (
        status = 'verified'
        and reviewed_by_application_user_id is not null
        and reviewed_at is not null
        and rejection_reason is null
      )
      or
      (
        status = 'rejected'
        and reviewed_by_application_user_id is not null
        and reviewed_at is not null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) between 1 and 1000
      )
    )
);

create index donation_payments_member_created_idx
  on public.donation_payments(member_profile_id, created_at desc, id);

create index donation_payments_status_created_idx
  on public.donation_payments(status, created_at, id);

create trigger donation_payments_set_updated_at
before update on public.donation_payments
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment proof metadata
-- ---------------------------------------------------------------------------

create table public.donation_payment_proofs (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null
    references public.donation_payments(id) on delete restrict,

  storage_bucket text not null,
  storage_object_path text not null,

  uploaded_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  created_at timestamptz not null default now(),

  constraint donation_payment_proofs_bucket_chk
    check (
      length(btrim(storage_bucket)) >= 1
      and length(btrim(storage_bucket)) <= 120
    ),

  constraint donation_payment_proofs_path_chk
    check (
      length(btrim(storage_object_path)) >= 1
      and length(btrim(storage_object_path)) <= 1024
    ),

  constraint donation_payment_proofs_object_uidx
    unique (storage_bucket, storage_object_path)
);

create index donation_payment_proofs_payment_idx
  on public.donation_payment_proofs(payment_id, created_at, id);

-- ---------------------------------------------------------------------------
-- Authoritative payment allocations
-- ---------------------------------------------------------------------------

create table public.donation_payment_allocations (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null
    references public.donation_payments(id) on delete restrict,

  obligation_id uuid not null
    references public.donation_obligations(id) on delete restrict,

  allocated_amount_paise bigint not null,

  allocation_sequence integer not null,

  operation_id text not null,

  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  created_at timestamptz not null default now(),

  constraint donation_payment_allocations_amount_chk
    check (allocated_amount_paise > 0),

  constraint donation_payment_allocations_sequence_chk
    check (allocation_sequence > 0),

  constraint donation_payment_allocations_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_payment_allocations_payment_obligation_uidx
    unique (payment_id, obligation_id),

  constraint donation_payment_allocations_payment_sequence_uidx
    unique (payment_id, allocation_sequence)
);

create index donation_payment_allocations_obligation_idx
  on public.donation_payment_allocations(obligation_id, created_at, id);

create index donation_payment_allocations_operation_idx
  on public.donation_payment_allocations(operation_id);

-- ---------------------------------------------------------------------------
-- Additional donations
-- ---------------------------------------------------------------------------

create table public.additional_donations (
  id uuid primary key default gen_random_uuid(),

  member_profile_id uuid
    references public.member_profiles(id) on delete restrict,

  source_payment_id uuid
    references public.donation_payments(id) on delete restrict,

  donation_kind text not null
    check (
      donation_kind in (
        'additional',
        'overpayment',
        'anonymous',
        'jummah_cash'
      )
    ),

  amount_paise bigint not null,

  recorded_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  operation_id text not null,

  created_at timestamptz not null default now(),

  constraint additional_donations_amount_chk
    check (amount_paise > 0),

  constraint additional_donations_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint additional_donations_operation_id_uidx
    unique (operation_id),

  constraint additional_donations_identity_chk
    check (
      (donation_kind in ('anonymous', 'jummah_cash') and member_profile_id is null)
      or
      (donation_kind in ('additional', 'overpayment') and member_profile_id is not null)
    ),

  constraint additional_donations_overpayment_source_chk
    check (
      donation_kind <> 'overpayment'
      or source_payment_id is not null
    )
);

create index additional_donations_member_created_idx
  on public.additional_donations(member_profile_id, created_at desc, id);

create index additional_donations_kind_created_idx
  on public.additional_donations(donation_kind, created_at desc, id);

-- ---------------------------------------------------------------------------
-- Donation operation idempotency registry
-- ---------------------------------------------------------------------------

create table public.donation_operation_idempotency (
  operation_id text primary key,

  operation_type text not null
    check (
      operation_type in (
        'obligation_rule_create',
        'obligation_create',
        'obligation_waive',
        'payment_submit',
        'payment_review',
        'payment_verify_allocate',
        'additional_donation_create'
      )
    ),

  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,

  target_member_profile_id uuid
    references public.member_profiles(id) on delete restrict,

  payment_id uuid
    references public.donation_payments(id) on delete restrict,

  obligation_id uuid
    references public.donation_obligations(id) on delete restrict,

  additional_donation_id uuid
    references public.additional_donations(id) on delete restrict,

  request_fingerprint text not null,

  created_at timestamptz not null default now(),

  constraint donation_operation_idempotency_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    ),

  constraint donation_operation_idempotency_fingerprint_chk
    check (
      length(btrim(request_fingerprint)) >= 1
    )
);

create index donation_operation_idempotency_actor_created_idx
  on public.donation_operation_idempotency(
    actor_application_user_id,
    created_at desc
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.donation_obligation_rules enable row level security;
alter table public.donation_obligations enable row level security;
alter table public.donation_obligation_waivers enable row level security;
alter table public.donation_payments enable row level security;
alter table public.donation_payment_proofs enable row level security;
alter table public.donation_payment_allocations enable row level security;
alter table public.additional_donations enable row level security;
alter table public.donation_operation_idempotency enable row level security;

-- Own obligation visibility.

create policy donation_obligations_self_read
on public.donation_obligations
for select
to authenticated
using (
  member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id = public.current_application_user_id()
  )
);

-- Organization-wide obligation/history visibility is limited to roles
-- explicitly authorized by the current role matrix.
-- Committee Members remain workflow-scoped and therefore are not granted
-- organization-wide visibility here.

create policy donation_obligations_authorized_read
on public.donation_obligations
for select
to authenticated
using (
  public.has_application_permission('donations.obligations.read')
  and public.current_application_role() in (
    'president',
    'vice_president',
    'secretary',
    'finance',
    'auditor'
  )
);

-- Members may read their own submitted payments.

create policy donation_payments_self_read
on public.donation_payments
for select
to authenticated
using (
  member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id = public.current_application_user_id()
  )
);

-- Authorized administrative/financial/oversight payment visibility.
-- Committee Member is intentionally excluded from organization-wide access.

create policy donation_payments_authorized_read
on public.donation_payments
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'secretary',
    'finance',
    'auditor'
  )
  and (
    public.has_application_permission('donations.obligations.read')
    or public.has_application_permission('donations.reports.read')
    or public.has_application_permission('donations.payments.verify')
    or public.has_application_permission('donations.payments.allocate')
  )
);

-- Proof metadata follows payment visibility.

create policy donation_payment_proofs_self_read
on public.donation_payment_proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.donation_payments dp
    join public.member_profiles mp
      on mp.id = dp.member_profile_id
    where dp.id = donation_payment_proofs.payment_id
      and mp.application_user_id = public.current_application_user_id()
  )
);

create policy donation_payment_proofs_authorized_read
on public.donation_payment_proofs
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'finance',
    'auditor'
  )
);

-- Allocation visibility follows ownership or authorized financial/oversight
-- access. Allocation mutation remains trusted-operation-only.

create policy donation_payment_allocations_self_read
on public.donation_payment_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.donation_payments dp
    join public.member_profiles mp
      on mp.id = dp.member_profile_id
    where dp.id = donation_payment_allocations.payment_id
      and mp.application_user_id = public.current_application_user_id()
  )
);

create policy donation_payment_allocations_authorized_read
on public.donation_payment_allocations
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'finance',
    'auditor'
  )
);

-- Waivers are part of obligation history.

create policy donation_obligation_waivers_self_read
on public.donation_obligation_waivers
for select
to authenticated
using (
  exists (
    select 1
    from public.donation_obligations dob
    join public.member_profiles mp
      on mp.id = dob.member_profile_id
    where dob.id = donation_obligation_waivers.obligation_id
      and mp.application_user_id = public.current_application_user_id()
  )
);

create policy donation_obligation_waivers_authorized_read
on public.donation_obligation_waivers
for select
to authenticated
using (
  public.has_application_permission('donations.obligations.read')
  and public.current_application_role() in (
    'president',
    'vice_president',
    'secretary',
    'finance',
    'auditor'
  )
);

-- Own named additional donations.

create policy additional_donations_self_read
on public.additional_donations
for select
to authenticated
using (
  member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id = public.current_application_user_id()
  )
);

create policy additional_donations_authorized_read
on public.additional_donations
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'secretary',
    'finance',
    'auditor'
  )
  and public.has_application_permission('donations.reports.read')
);

-- Obligation rules are financial configuration. Only authorized
-- administrative/financial/oversight roles receive read access.

create policy donation_obligation_rules_authorized_read
on public.donation_obligation_rules
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'secretary',
    'finance',
    'auditor'
  )
  and public.has_application_permission('donations.obligations.read')
);

-- No client policies are created for donation_operation_idempotency.
-- It is a trusted-operation implementation detail.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.donation_obligation_rules
  from public, anon, authenticated;

revoke all on table public.donation_obligations
  from public, anon, authenticated;

revoke all on table public.donation_obligation_waivers
  from public, anon, authenticated;

revoke all on table public.donation_payments
  from public, anon, authenticated;

revoke all on table public.donation_payment_proofs
  from public, anon, authenticated;

revoke all on table public.donation_payment_allocations
  from public, anon, authenticated;

revoke all on table public.additional_donations
  from public, anon, authenticated;

revoke all on table public.donation_operation_idempotency
  from public, anon, authenticated;

grant select on table public.donation_obligation_rules
  to authenticated;

grant select on table public.donation_obligations
  to authenticated;

grant select on table public.donation_obligation_waivers
  to authenticated;

grant select on table public.donation_payments
  to authenticated;

grant select on table public.donation_payment_proofs
  to authenticated;

grant select on table public.donation_payment_allocations
  to authenticated;

grant select on table public.additional_donations
  to authenticated;

grant all on table public.donation_obligation_rules to service_role;
grant all on table public.donation_obligations to service_role;
grant all on table public.donation_obligation_waivers to service_role;
grant all on table public.donation_payments to service_role;
grant all on table public.donation_payment_proofs to service_role;
grant all on table public.donation_payment_allocations to service_role;
grant all on table public.additional_donations to service_role;
grant all on table public.donation_operation_idempotency to service_role;

commit;
