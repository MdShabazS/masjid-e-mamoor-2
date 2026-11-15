-- Phase 4 first slice. Apply after contribution and identity migrations only.
begin;

alter table public.masjid_accounts add column create_operation_id uuid unique;
create table app_private.account_beneficiaries (
  account_id uuid primary key references public.masjid_accounts(id) on delete restrict,
  upi_id text,
  bank_account_number text,
  ifsc text,
  check ((upi_id is not null and bank_account_number is null and ifsc is null)
      or (upi_id is null and bank_account_number is not null and ifsc is not null)
      or (upi_id is null and bank_account_number is null and ifsc is null))
);
create unique index account_upi_unique on app_private.account_beneficiaries(lower(upi_id)) where upi_id is not null;
create unique index account_bank_unique on app_private.account_beneficiaries(bank_account_number,ifsc) where bank_account_number is not null;
alter table app_private.account_beneficiaries enable row level security;
revoke all on app_private.account_beneficiaries from public,anon,authenticated;

create table public.account_openings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.masjid_accounts(id) on delete restrict,
  amount_paise bigint not null check (amount_paise >= 0),
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  submitted_by uuid not null references public.app_users(id) on delete restrict,
  submit_operation_id uuid not null unique,
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.app_users(id) on delete restrict,
  verify_operation_id uuid unique,
  verified_at timestamptz,
  check (verified_by is distinct from submitted_by),
  check ((verified_by is null and verify_operation_id is null and verified_at is null)
    or (verified_by is not null and verify_operation_id is not null and verified_at is not null))
);

create table public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  from_account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  to_account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  posted_by uuid not null references public.app_users(id) on delete restrict,
  posted_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

-- All effects are signed integer paise. Transfers have two legs, never income.
create table public.finance_effects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  source_type text not null check (source_type in ('account_opening','monthly_contribution','transfer')),
  source_id uuid not null,
  leg smallint not null check (leg in (0,1,2)),
  amount_paise bigint not null,
  occurred_at timestamptz not null default now(),
  check ((source_type='account_opening' and leg=0 and amount_paise >= 0)
      or (source_type='monthly_contribution' and leg=0 and amount_paise > 0)
      or (source_type='transfer' and leg=1 and amount_paise < 0)
      or (source_type='transfer' and leg=2 and amount_paise > 0)),
  unique(source_type,source_id,leg)
);
create index finance_effects_account_time on public.finance_effects(account_id,occurred_at,id);
create index finance_effects_source on public.finance_effects(source_type,source_id);

create table app_private.finance_audit (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  account_id uuid references public.masjid_accounts(id) on delete restrict,
  event text not null check (event in ('account_created','account_deactivated','opening_submitted','opening_verified','transfer_posted')),
  source_id uuid not null,
  occurred_at timestamptz not null default now()
);

-- Backfill is safe for a disposable fresh project; this source must not be
-- applied to an existing ledger without comparing source and receipt counts.
insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise,occurred_at)
select account_id,'monthly_contribution',id,0,amount_paise,posted_at
from public.ledger_entries;
create function app_private.mirror_monthly_ledger()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform 1 from public.masjid_accounts where id=new.account_id and active for update;
  if not found then raise exception 'account_not_active' using errcode='22023'; end if;
  if not exists(select 1 from public.account_openings o where o.account_id=new.account_id
    and o.verified_by is not null) then
    raise exception 'verified_opening_required' using errcode='22023'; end if;
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise,occurred_at)
    values(new.account_id,'monthly_contribution',new.id,0,new.amount_paise,new.posted_at);
  return new;
end;
$$;
revoke all on function app_private.mirror_monthly_ledger() from public,anon,authenticated;
create trigger mirror_monthly_ledger after insert on public.ledger_entries
for each row execute function app_private.mirror_monthly_ledger();

create trigger finance_effects_immutable before update or delete on public.finance_effects
for each row execute function app_private.reject_immutable_finance_change();
create trigger finance_transfers_immutable before update or delete on public.finance_transfers
for each row execute function app_private.reject_immutable_finance_change();
create trigger finance_audit_immutable before update or delete on app_private.finance_audit
for each row execute function app_private.reject_immutable_finance_change();
create trigger account_openings_no_delete before delete on public.account_openings
for each row execute function app_private.reject_immutable_finance_change();
-- The only allowed update is pending -> verified by the trusted command.
create function app_private.guard_opening_transition()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.id<>new.id or old.account_id<>new.account_id or old.amount_paise<>new.amount_paise
    or old.evidence_reference<>new.evidence_reference or old.submitted_by<>new.submitted_by
    or old.submit_operation_id<>new.submit_operation_id or old.submitted_at<>new.submitted_at
    or old.verified_by is not null or new.verified_by is null then
    raise exception 'opening_immutable' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function app_private.guard_opening_transition() from public,anon,authenticated;
create trigger opening_transition before update on public.account_openings
for each row execute function app_private.guard_opening_transition();

-- Direct Data API access is closed. All projections and commands below
-- check the current database role via the Phase 3 credential gate.
do $$ declare v_name text; begin
  foreach v_name in array array['account_openings','finance_transfers','finance_effects'] loop
    execute format('alter table public.%I enable row level security',v_name);
    execute format('revoke all on public.%I from public,anon,authenticated',v_name);
  end loop;
end $$;
alter table app_private.finance_audit enable row level security;
revoke all on app_private.finance_audit from public,anon,authenticated;

create function public.create_finance_account(
  p_name text,p_kind text,p_upi_id text,p_bank_account_number text,p_ifsc text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president']);
        v_old public.masjid_accounts; v_id uuid;
        v_name text := btrim(p_name); v_upi text := lower(btrim(p_upi_id));
        v_bank text := btrim(p_bank_account_number); v_ifsc text := upper(btrim(p_ifsc));
begin
  if p_operation_id is null or v_name is null or length(v_name) not between 1 and 120
    or p_kind not in ('cash','upi','bank') or
    (p_kind='cash' and (p_upi_id is not null or p_bank_account_number is not null or p_ifsc is not null)) or
    (p_kind='upi' and (v_upi is null or v_upi !~ '^[a-z0-9._-]{2,128}@[a-z0-9.-]{2,64}$'
      or p_bank_account_number is not null or p_ifsc is not null)) or
    (p_kind='bank' and (v_bank is null or v_bank !~ '^[0-9]{6,30}$'
      or v_ifsc is null or v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' or p_upi_id is not null)) then
    raise exception 'invalid_account' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,43));
  select * into v_old from public.masjid_accounts where create_operation_id=p_operation_id;
  if found then
    if v_old.name<>v_name or v_old.kind<>p_kind or not exists (
      select 1 from app_private.account_beneficiaries b where b.account_id=v_old.id
        and b.upi_id is not distinct from v_upi
        and b.bank_account_number is not distinct from v_bank
        and b.ifsc is not distinct from v_ifsc)
      or not exists(select 1 from app_private.finance_audit a where a.operation_id=p_operation_id
        and a.actor_id=v_actor) then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  insert into public.masjid_accounts(name,kind,create_operation_id)
    values(v_name,p_kind,p_operation_id) returning id into v_id;
  insert into app_private.account_beneficiaries(account_id,upi_id,bank_account_number,ifsc)
    values(v_id,v_upi,v_bank,v_ifsc);
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,v_id,'account_created',v_id);
  return v_id;
end;
$$;

create function public.submit_account_opening(
  p_account_id uuid,p_amount_paise bigint,p_evidence_reference text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['treasurer']);
        v_old public.account_openings; v_id uuid; v_evidence text:=btrim(p_evidence_reference);
begin
  if p_operation_id is null or p_amount_paise is null or p_amount_paise<0
    or v_evidence is null or length(v_evidence) not between 3 and 240 then
    raise exception 'invalid_opening' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,44));
  select * into v_old from public.account_openings where submit_operation_id=p_operation_id;
  if found then
    if v_old.account_id<>p_account_id or v_old.amount_paise<>p_amount_paise
      or v_old.evidence_reference<>v_evidence or v_old.submitted_by<>v_actor then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  perform 1 from public.masjid_accounts where id=p_account_id and active for update;
  if not found then raise exception 'account_not_active' using errcode='22023'; end if;
  if exists(select 1 from public.finance_effects where account_id=p_account_id) then
    raise exception 'opening_after_posting_denied' using errcode='22023'; end if;
  insert into public.account_openings(account_id,amount_paise,evidence_reference,submitted_by,submit_operation_id)
    values(p_account_id,p_amount_paise,v_evidence,v_actor,p_operation_id) returning id into v_id;
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,p_account_id,'opening_submitted',v_id);
  return v_id;
end;
$$;

create function public.deactivate_finance_account(p_account_id uuid,p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president']);
        v_account public.masjid_accounts;
begin
  if p_operation_id is null then raise exception 'invalid_operation' using errcode='22023'; end if;
  if exists(select 1 from app_private.finance_audit a where a.operation_id=p_operation_id) then
    if not exists(select 1 from app_private.finance_audit a where a.operation_id=p_operation_id
      and a.actor_id=v_actor and a.account_id=p_account_id and a.event='account_deactivated') then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return;
  end if;
  select * into v_account from public.masjid_accounts where id=p_account_id for update;
  if not found or not v_account.active then
    raise exception 'account_not_active' using errcode='22023'; end if;
  if exists(select 1 from public.payment_qr_versions q
      where q.account_id=p_account_id and q.retired_at is null)
    or exists(select 1 from public.account_openings o
      where o.account_id=p_account_id and o.verified_by is null)
    or (select coalesce(sum(e.amount_paise::numeric),0) from public.finance_effects e
      where e.account_id=p_account_id) <> 0 then
    raise exception 'account_not_settled' using errcode='22023'; end if;
  update public.masjid_accounts set active=false where id=p_account_id;
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,p_account_id,'account_deactivated',p_account_id);
end;
$$;

create function public.verify_account_opening(p_opening_id uuid,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president']); v_opening public.account_openings;
begin
  if p_operation_id is null then raise exception 'invalid_operation' using errcode='22023'; end if;
  select * into v_opening from public.account_openings where id=p_opening_id for update;
  if not found then raise exception 'opening_not_found' using errcode='22023'; end if;
  if v_opening.verify_operation_id=p_operation_id and v_opening.verified_by=v_actor then return v_opening.id; end if;
  if v_opening.verified_by is not null or v_opening.submitted_by=v_actor then
    raise exception 'opening_already_verified_or_self' using errcode='42501'; end if;
  perform 1 from public.masjid_accounts where id=v_opening.account_id and active for update;
  if not found then raise exception 'account_not_active' using errcode='22023'; end if;
  update public.account_openings set verified_by=v_actor,verify_operation_id=p_operation_id,
    verified_at=now() where id=p_opening_id;
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
    values(v_opening.account_id,'account_opening',v_opening.id,0,v_opening.amount_paise);
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,v_opening.account_id,'opening_verified',v_opening.id);
  return v_opening.id;
end;
$$;

create function public.post_finance_transfer(
  p_from_account_id uuid,p_to_account_id uuid,p_amount_paise bigint,
  p_evidence_reference text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['treasurer']);
        v_old public.finance_transfers; v_account uuid; v_count integer:=0;
        v_id uuid; v_evidence text:=btrim(p_evidence_reference); v_available numeric;
begin
  if p_operation_id is null or p_from_account_id is null or p_to_account_id is null
    or p_from_account_id=p_to_account_id or p_amount_paise is null or p_amount_paise<=0
    or v_evidence is null or length(v_evidence) not between 3 and 240 then
    raise exception 'invalid_transfer' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,45));
  select * into v_old from public.finance_transfers where operation_id=p_operation_id;
  if found then
    if v_old.posted_by<>v_actor or v_old.from_account_id<>p_from_account_id
      or v_old.to_account_id<>p_to_account_id or v_old.amount_paise<>p_amount_paise
      or v_old.evidence_reference<>v_evidence then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  -- Identical lock order prevents opposite-direction transfers deadlocking.
  for v_account in select a.id from public.masjid_accounts a
      where a.id in (p_from_account_id,p_to_account_id) and a.active order by a.id for update loop
    v_count:=v_count+1;
  end loop;
  if v_count<>2 then raise exception 'account_not_active' using errcode='22023'; end if;
  select coalesce(sum(e.amount_paise::numeric),0) into v_available
    from public.finance_effects e where e.account_id=p_from_account_id;
  if v_available<p_amount_paise then raise exception 'insufficient_account_balance' using errcode='22023'; end if;
  insert into public.finance_transfers(operation_id,from_account_id,to_account_id,
    amount_paise,evidence_reference,posted_by)
    values(p_operation_id,p_from_account_id,p_to_account_id,p_amount_paise,v_evidence,v_actor)
    returning id into v_id;
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
    values (p_from_account_id,'transfer',v_id,1,-p_amount_paise),
      (p_to_account_id,'transfer',v_id,2,p_amount_paise);
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,p_from_account_id,'transfer_posted',v_id);
  return v_id;
end;
$$;

create function public.list_finance_accounts()
returns table(account_id uuid,account_name text,account_kind text,active boolean,balance_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
  return query select a.id,a.name,a.kind,a.active,
    coalesce(sum(e.amount_paise::numeric),0)::text
    from public.masjid_accounts a left join public.finance_effects e on e.account_id=a.id
    group by a.id,a.name,a.kind,a.active order by a.name,a.id;
end;
$$;

create function public.list_pending_finance_openings()
returns table(opening_id uuid,account_id uuid,account_name text,amount_paise text,
 evidence_reference text,submitted_by uuid,submitted_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['president','treasurer']);
 return query select o.id,o.account_id,a.name,o.amount_paise::text,
  o.evidence_reference,o.submitted_by,o.submitted_at
 from public.account_openings o join public.masjid_accounts a on a.id=o.account_id
 where o.verified_by is null and a.active order by o.submitted_at,o.id;
end;
$$;

create function public.reconcile_finance_account(p_account_id uuid,p_observed_balance_paise bigint)
returns table(book_balance_paise text,observed_balance_paise text,variance_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_book numeric;
begin
  perform app_private.require_actor(array['treasurer']);
  if p_observed_balance_paise is null or p_observed_balance_paise<0 then
    raise exception 'invalid_observed_balance' using errcode='22023'; end if;
  if not exists(select 1 from public.masjid_accounts where id=p_account_id) then
    raise exception 'account_not_found' using errcode='22023'; end if;
  select coalesce(sum(e.amount_paise::numeric),0) into v_book
    from public.finance_effects e where e.account_id=p_account_id;
  return query select v_book::text,p_observed_balance_paise::text,
    (p_observed_balance_paise::numeric-v_book)::text;
end;
$$;

revoke all on function public.create_finance_account(text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_account_opening(uuid,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.deactivate_finance_account(uuid,uuid) from public,anon,authenticated;
revoke all on function public.verify_account_opening(uuid,uuid) from public,anon,authenticated;
revoke all on function public.post_finance_transfer(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.list_finance_accounts() from public,anon,authenticated;
revoke all on function public.list_pending_finance_openings() from public,anon,authenticated;
revoke all on function public.reconcile_finance_account(uuid,bigint) from public,anon,authenticated;
grant execute on function public.create_finance_account(text,text,text,text,text,uuid) to authenticated;
grant execute on function public.submit_account_opening(uuid,bigint,text,uuid) to authenticated;
grant execute on function public.deactivate_finance_account(uuid,uuid) to authenticated;
grant execute on function public.verify_account_opening(uuid,uuid) to authenticated;
grant execute on function public.post_finance_transfer(uuid,uuid,bigint,text,uuid) to authenticated;
grant execute on function public.list_finance_accounts() to authenticated;
grant execute on function public.list_pending_finance_openings() to authenticated;
grant execute on function public.reconcile_finance_account(uuid,bigint) to authenticated;
commit;
