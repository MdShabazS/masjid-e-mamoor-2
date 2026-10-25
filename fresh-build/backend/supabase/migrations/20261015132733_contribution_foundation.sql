-- Fresh-build schema slice. Apply only to a NEW development Supabase project.
-- Never apply alongside the legacy supabase/migrations tree.
begin;

create schema if not exists app_private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.app_users (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('system_admin','president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.masjid_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('cash','upi','bank')),
  active boolean not null default true
);

create table public.payment_qr_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  asset_path text not null,
  activated_at timestamptz not null default now(),
  retired_at timestamptz,
  created_by uuid not null references public.app_users(id) on delete restrict,
  check (retired_at is null or retired_at > activated_at)
);
create unique index payment_qr_one_active on public.payment_qr_versions ((true))
  where retired_at is null;

create table public.monthly_donors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  suggested_amount_paise bigint not null check (suggested_amount_paise > 0),
  referrer_id uuid references public.app_users(id) on delete restrict,
  entered_by uuid not null references public.app_users(id) on delete restrict,
  consent_method text not null check (length(btrim(consent_method)) between 1 and 120),
  consent_recorded_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.monthly_requests (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  period_date date not null check (extract(day from period_date) = 1),
  suggested_amount_paise bigint not null check (suggested_amount_paise > 0),
  qr_version_id uuid not null references public.payment_qr_versions(id) on delete restrict,
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  queued_at timestamptz not null default now(),
  unique(donor_id, period_date)
);

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  period_date date not null check (extract(day from period_date) = 1),
  transaction_id text not null unique check (length(btrim(transaction_id)) between 3 and 200),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  submitted_by uuid not null references public.app_users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.app_users(id) on delete restrict,
  verified_at timestamptz,
  foreign key (donor_id,period_date)
    references public.monthly_requests(donor_id,period_date) on delete restrict
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  direction text not null check (direction in ('income','expense')),
  source_type text not null check (source_type = 'monthly_contribution'),
  source_id uuid not null unique references public.payment_claims(id) on delete restrict,
  posted_at timestamptz not null default now(),
  posted_by uuid not null references public.app_users(id) on delete restrict
);

create table public.monthly_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^MEM2-R-[0-9A-F]{32}$'),
  claim_id uuid not null unique references public.payment_claims(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  period_date date not null,
  amount_paise bigint not null check (amount_paise > 0),
  issued_at timestamptz not null default now()
);

create table public.contribution_operations (
  id uuid primary key,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  claim_id uuid not null references public.payment_claims(id) on delete restrict,
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  amount_paise bigint not null,
  receipt_id uuid not null unique references public.monthly_receipts(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.contribution_audit (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.contribution_operations(id) on delete restrict,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  claim_id uuid not null references public.payment_claims(id) on delete restrict,
  event text not null check (event = 'monthly_claim_verified'),
  occurred_at timestamptz not null default now()
);

create function app_private.reject_immutable_finance_change()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  raise exception 'finance_history_is_immutable' using errcode='42501';
end;
$$;
revoke all on function app_private.reject_immutable_finance_change()
  from public, anon, authenticated;
create trigger ledger_entries_immutable before update or delete on public.ledger_entries
for each row execute function app_private.reject_immutable_finance_change();
create trigger monthly_receipts_immutable before update or delete on public.monthly_receipts
for each row execute function app_private.reject_immutable_finance_change();
create trigger contribution_audit_immutable before update or delete on public.contribution_audit
for each row execute function app_private.reject_immutable_finance_change();

-- Exposed tables deny direct writes and reads. First client access is via
-- deliberately scoped RPCs; read projections will be added separately.
do $$
declare v_table text;
begin
  foreach v_table in array array['app_users','masjid_accounts','payment_qr_versions',
    'monthly_donors','monthly_requests','payment_claims','ledger_entries',
    'monthly_receipts','contribution_operations','contribution_audit'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
  end loop;
end;
$$;

create function app_private.require_actor(p_roles text[])
returns uuid language plpgsql security definer
set search_path = pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.app_users u where u.id = v_actor
      and u.active and u.role = any(p_roles)
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  return v_actor;
end;
$$;
revoke all on function app_private.require_actor(text[]) from public, anon, authenticated;

create function public.current_app_role()
returns text language sql stable security definer set search_path = pg_catalog
as $$
  select u.role from public.app_users u
  where u.id=auth.uid() and u.active;
$$;
revoke all on function public.current_app_role() from public, anon, authenticated;
grant execute on function public.current_app_role() to authenticated;

create function public.enroll_monthly_donor(
  p_name text, p_whatsapp text, p_suggested_amount_paise bigint,
  p_referrer_id uuid, p_consent_method text, p_consent_recorded_at timestamptz
) returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','data_entry']);
  v_id uuid;
begin
  if p_consent_recorded_at is null or p_consent_recorded_at > now()
    or nullif(btrim(p_consent_method),'') is null then
    raise exception 'consent_required' using errcode='22023'; end if;
  insert into public.monthly_donors(name,whatsapp,suggested_amount_paise,
    referrer_id,entered_by,consent_method,consent_recorded_at)
  values (btrim(p_name),btrim(p_whatsapp),p_suggested_amount_paise,
    p_referrer_id,v_actor,btrim(p_consent_method),p_consent_recorded_at)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.submit_monthly_claim(
  p_donor_id uuid, p_period_date date, p_transaction_id text
) returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','data_entry']);
  v_id uuid;
begin
  insert into public.payment_claims(donor_id,period_date,transaction_id,submitted_by)
  values (p_donor_id,p_period_date,btrim(p_transaction_id),v_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- All signed-in roles may see the roster and referrer, but this projection
-- intentionally omits WhatsApp numbers and consent evidence.
create function public.list_monthly_donors()
returns table(donor_id uuid, donor_name text, suggested_amount_paise bigint,
  referrer_id uuid, active boolean)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  perform app_private.require_actor(array['system_admin','president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry']);
  return query select d.id,d.name,d.suggested_amount_paise,d.referrer_id,d.active
    from public.monthly_donors d order by d.name,d.id;
end;
$$;

-- Treasurer review exposes only pending claims and active destination accounts.
-- Transaction identifiers are never part of the general contributor roster.
create function public.list_pending_monthly_claims()
returns table(claim_id uuid, donor_name text, period_date date,
  transaction_id text, submitted_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  perform app_private.require_actor(array['treasurer']);
  return query select c.id,d.name,c.period_date,c.transaction_id,c.submitted_at
    from public.payment_claims c
    join public.monthly_donors d on d.id=c.donor_id
    where c.status='pending' order by c.submitted_at,c.id;
end;
$$;

create function public.list_active_masjid_accounts()
returns table(account_id uuid, account_name text, account_kind text)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  perform app_private.require_actor(array['treasurer']);
  return query select a.id,a.name,a.kind from public.masjid_accounts a
    where a.active order by a.name,a.id;
end;
$$;

-- A server-side scheduler calls this before sending a message. It only queues
-- a snapshot; WhatsApp delivery and its own idempotency are separate work.
create function public.queue_monthly_request(p_donor_id uuid, p_period_date date)
returns public.monthly_requests language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_donor public.monthly_donors;
  v_qr public.payment_qr_versions;
  v_request public.monthly_requests;
begin
  if p_period_date is null or extract(day from p_period_date) <> 1 then
    raise exception 'invalid_period' using errcode='22023'; end if;
  select * into v_donor from public.monthly_donors where id=p_donor_id for update;
  if not found or not v_donor.active then
    raise exception 'donor_not_active' using errcode='22023'; end if;
  select q.* into v_qr from public.payment_qr_versions q
  join public.masjid_accounts a on a.id=q.account_id
  where q.retired_at is null and a.active;
  if not found then raise exception 'active_qr_required' using errcode='22023'; end if;
  insert into public.monthly_requests(donor_id,period_date,suggested_amount_paise,
    qr_version_id,account_id)
  values (p_donor_id,p_period_date,v_donor.suggested_amount_paise,
    v_qr.id,v_qr.account_id)
  on conflict (donor_id,period_date) do nothing returning * into v_request;
  if v_request.id is null then
    select * into v_request from public.monthly_requests
    where donor_id=p_donor_id and period_date=p_period_date;
  end if;
  return v_request;
end;
$$;

create function public.monthly_reminder_eligible(p_donor_id uuid,p_period_date date)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.monthly_donors d
    join public.monthly_requests q on q.donor_id=d.id
    where d.id=p_donor_id and d.active and q.period_date=p_period_date
      and not exists (
        select 1 from public.monthly_receipts r
        where r.donor_id=d.id and r.period_date=p_period_date
      )
  );
$$;

create function public.verify_monthly_claim(
  p_claim_id uuid, p_account_id uuid, p_actual_amount_paise bigint, p_operation_id uuid
) returns text language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['treasurer']);
  v_prior public.contribution_operations;
  v_claim public.payment_claims;
  v_ledger_id uuid;
  v_receipt_id uuid;
  v_code text;
begin
  if p_operation_id is null or p_actual_amount_paise is null
     or p_actual_amount_paise <= 0 then
    raise exception 'invalid_verification' using errcode='22023'; end if;
  -- Serialize same-operation retries before reading the operation record.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_prior from public.contribution_operations where id = p_operation_id;
  if found then
    if v_prior.actor_id <> v_actor or v_prior.claim_id <> p_claim_id
       or v_prior.account_id <> p_account_id
       or v_prior.amount_paise <> p_actual_amount_paise then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return (select code from public.monthly_receipts where id = v_prior.receipt_id);
  end if;
  select * into v_claim from public.payment_claims where id=p_claim_id for update;
  if not found or v_claim.status <> 'pending' then
    raise exception 'claim_not_pending' using errcode='22023'; end if;
  if not exists (select 1 from public.masjid_accounts where id=p_account_id and active) then
    raise exception 'account_not_found' using errcode='22023'; end if;

  insert into public.ledger_entries(account_id,amount_paise,direction,source_type,
    source_id,posted_by)
  values (p_account_id,p_actual_amount_paise,'income','monthly_contribution',
    p_claim_id,v_actor) returning id into v_ledger_id;
  v_code := 'MEM2-R-' || upper(encode(extensions.gen_random_bytes(16),'hex'));
  insert into public.monthly_receipts(code,claim_id,ledger_entry_id,donor_id,
    period_date,amount_paise)
  values (v_code,p_claim_id,v_ledger_id,v_claim.donor_id,v_claim.period_date,
    p_actual_amount_paise) returning id into v_receipt_id;
  update public.payment_claims set status='verified',verified_by=v_actor,
    verified_at=now() where id=p_claim_id;
  insert into public.contribution_operations(id,actor_id,claim_id,account_id,
    amount_paise,receipt_id)
  values (p_operation_id,v_actor,p_claim_id,p_account_id,p_actual_amount_paise,v_receipt_id);
  insert into public.contribution_audit(operation_id,actor_id,claim_id,event)
  values (p_operation_id,v_actor,p_claim_id,'monthly_claim_verified');
  return v_code;
end;
$$;

revoke all on function public.enroll_monthly_donor(text,text,bigint,uuid,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.submit_monthly_claim(uuid,date,text)
  from public, anon, authenticated;
revoke all on function public.list_monthly_donors()
  from public, anon, authenticated;
revoke all on function public.list_pending_monthly_claims()
  from public, anon, authenticated;
revoke all on function public.list_active_masjid_accounts()
  from public, anon, authenticated;
revoke all on function public.queue_monthly_request(uuid,date)
  from public, anon, authenticated;
revoke all on function public.monthly_reminder_eligible(uuid,date)
  from public, anon, authenticated;
revoke all on function public.verify_monthly_claim(uuid,uuid,bigint,uuid)
  from public, anon, authenticated;
grant execute on function public.enroll_monthly_donor(text,text,bigint,uuid,text,timestamptz)
  to authenticated;
grant execute on function public.submit_monthly_claim(uuid,date,text) to authenticated;
grant execute on function public.list_monthly_donors() to authenticated;
grant execute on function public.list_pending_monthly_claims() to authenticated;
grant execute on function public.list_active_masjid_accounts() to authenticated;
grant execute on function public.queue_monthly_request(uuid,date) to service_role;
grant execute on function public.monthly_reminder_eligible(uuid,date) to service_role;
grant execute on function public.verify_monthly_claim(uuid,uuid,bigint,uuid) to authenticated;

commit;
