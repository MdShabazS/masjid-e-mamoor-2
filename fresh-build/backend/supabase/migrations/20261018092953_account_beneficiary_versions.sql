-- Beneficiary corrections are allowed only before an account is used. Once a
-- QR, opening or ledger effect exists, create a replacement account instead.
begin;

create table app_private.account_beneficiary_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  operation_id uuid not null unique,
  upi_id text,
  bank_account_number text,
  ifsc text,
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  changed_by uuid not null references public.app_users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique(account_id,version_no),
  check ((upi_id is not null and bank_account_number is null and ifsc is null)
    or (upi_id is null and bank_account_number is not null and ifsc is not null)
    or (upi_id is null and bank_account_number is null and ifsc is null))
);
create index account_beneficiary_versions_account_time
  on app_private.account_beneficiary_versions(account_id,version_no desc);
create index account_beneficiary_versions_changed_by
  on app_private.account_beneficiary_versions(changed_by);
alter table app_private.account_beneficiary_versions enable row level security;
revoke all on app_private.account_beneficiary_versions from public,anon,authenticated;
create trigger account_beneficiary_versions_immutable before update or delete
  on app_private.account_beneficiary_versions for each row
  execute function app_private.reject_immutable_finance_change();

insert into app_private.account_beneficiary_versions
  (account_id,version_no,operation_id,upi_id,bank_account_number,ifsc,
   evidence_reference,changed_by,changed_at)
select b.account_id,1,a.create_operation_id,b.upi_id,b.bank_account_number,b.ifsc,
  'Initial account creation',f.actor_id,f.occurred_at
from app_private.account_beneficiaries b
join public.masjid_accounts a on a.id=b.account_id
join app_private.finance_audit f on f.account_id=a.id
  and f.operation_id=a.create_operation_id and f.event='account_created';

create or replace function public.create_finance_account(
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
      select 1 from app_private.account_beneficiary_versions b
      where b.account_id=v_old.id and b.version_no=1
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
  insert into app_private.account_beneficiary_versions
    (account_id,version_no,operation_id,upi_id,bank_account_number,ifsc,evidence_reference,changed_by)
    values(v_id,1,p_operation_id,v_upi,v_bank,v_ifsc,'Initial account creation',v_actor);
  insert into app_private.finance_audit(operation_id,actor_id,account_id,event,source_id)
    values(p_operation_id,v_actor,v_id,'account_created',v_id);
  return v_id;
end;
$$;

create function public.correct_account_beneficiary(
  p_account_id uuid,p_upi_id text,p_bank_account_number text,p_ifsc text,
  p_evidence_reference text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president']);
        v_account public.masjid_accounts; v_current app_private.account_beneficiaries;
        v_old app_private.account_beneficiary_versions; v_id uuid;
        v_upi text:=lower(btrim(p_upi_id)); v_bank text:=btrim(p_bank_account_number);
        v_ifsc text:=upper(btrim(p_ifsc)); v_evidence text:=btrim(p_evidence_reference);
begin
  if p_account_id is null or p_operation_id is null or v_evidence is null
    or length(v_evidence) not between 3 and 240 then
    raise exception 'invalid_beneficiary_change' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,47));
  select * into v_old from app_private.account_beneficiary_versions
    where operation_id=p_operation_id;
  if found then
    if v_old.account_id<>p_account_id or v_old.changed_by<>v_actor
      or v_old.upi_id is distinct from v_upi
      or v_old.bank_account_number is distinct from v_bank
      or v_old.ifsc is distinct from v_ifsc
      or v_old.evidence_reference<>v_evidence then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  -- QR activation takes this same lock. A correction cannot race a new QR.
  perform pg_advisory_xact_lock(98341250);
  select * into v_account from public.masjid_accounts
    where id=p_account_id for update;
  if not found or not v_account.active then
    raise exception 'account_not_active' using errcode='22023'; end if;
  if (v_account.kind='cash' and (p_upi_id is not null or p_bank_account_number is not null or p_ifsc is not null))
    or (v_account.kind='upi' and (v_upi is null or v_upi !~ '^[a-z0-9._-]{2,128}@[a-z0-9.-]{2,64}$'
      or p_bank_account_number is not null or p_ifsc is not null))
    or (v_account.kind='bank' and (v_bank is null or v_bank !~ '^[0-9]{6,30}$'
      or v_ifsc is null or v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' or p_upi_id is not null)) then
    raise exception 'invalid_beneficiary_change' using errcode='22023'; end if;
  if exists(select 1 from public.payment_qr_versions q where q.account_id=p_account_id)
    or exists(select 1 from public.account_openings o where o.account_id=p_account_id)
    or exists(select 1 from public.finance_effects e where e.account_id=p_account_id)
    or exists(select 1 from public.monthly_requests r where r.account_id=p_account_id) then
    raise exception 'account_already_used_create_replacement' using errcode='22023'; end if;
  select * into v_current from app_private.account_beneficiaries
    where account_id=p_account_id for update;
  if not found then raise exception 'beneficiary_missing' using errcode='22023'; end if;
  if v_current.upi_id is not distinct from v_upi
    and v_current.bank_account_number is not distinct from v_bank
    and v_current.ifsc is not distinct from v_ifsc then
    raise exception 'beneficiary_unchanged' using errcode='22023'; end if;
  insert into app_private.account_beneficiary_versions
    (account_id,version_no,operation_id,upi_id,bank_account_number,ifsc,evidence_reference,changed_by)
    values(p_account_id,(select max(version_no)+1 from app_private.account_beneficiary_versions
      where account_id=p_account_id),p_operation_id,v_upi,v_bank,v_ifsc,v_evidence,v_actor)
    returning id into v_id;
  update app_private.account_beneficiaries set upi_id=v_upi,
    bank_account_number=v_bank,ifsc=v_ifsc where account_id=p_account_id;
  return v_id;
end;
$$;

create function public.list_account_beneficiary_versions(p_account_id uuid)
returns table(version_no integer,upi_id text,bank_last_four text,ifsc text,
  evidence_reference text,changed_by uuid,changed_at timestamptz,is_current boolean)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['president','treasurer']);
  if not exists(select 1 from public.masjid_accounts where id=p_account_id) then
    raise exception 'account_not_found' using errcode='22023'; end if;
  return query select v.version_no,v.upi_id,right(v.bank_account_number,4),v.ifsc,
    v.evidence_reference,v.changed_by,v.changed_at,
    v.version_no=(select max(x.version_no) from app_private.account_beneficiary_versions x
      where x.account_id=p_account_id)
  from app_private.account_beneficiary_versions v where v.account_id=p_account_id
  order by v.version_no desc;
end;
$$;

revoke all on function public.correct_account_beneficiary(uuid,text,text,text,text,uuid)
  from public,anon,authenticated;
revoke all on function public.list_account_beneficiary_versions(uuid)
  from public,anon,authenticated;
grant execute on function public.correct_account_beneficiary(uuid,text,text,text,text,uuid)
  to authenticated;
grant execute on function public.list_account_beneficiary_versions(uuid)
  to authenticated;
commit;
