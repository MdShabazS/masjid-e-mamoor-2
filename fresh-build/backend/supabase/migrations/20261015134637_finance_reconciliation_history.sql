-- Phase 4 incremental slice: append-only balance observations and keyset history.
begin;
create table public.finance_reconciliations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  observed_balance_paise bigint not null check (observed_balance_paise >= 0),
  book_balance_paise numeric not null,
  variance_paise numeric not null,
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  explanation text,
  recorded_by uuid not null references public.app_users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  check (variance_paise=observed_balance_paise::numeric-book_balance_paise),
  check (variance_paise=0 or length(btrim(explanation)) between 3 and 1000)
);
create index finance_reconciliations_account_time on public.finance_reconciliations(account_id,recorded_at desc,id desc);
alter table public.finance_reconciliations enable row level security;
revoke all on public.finance_reconciliations from public,anon,authenticated;
create trigger finance_reconciliations_immutable before update or delete on public.finance_reconciliations
for each row execute function app_private.reject_immutable_finance_change();

create function public.record_finance_reconciliation(
  p_account_id uuid,p_observed_balance_paise bigint,p_evidence_reference text,
  p_explanation text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
        v_old public.finance_reconciliations; v_book numeric; v_id uuid;
        v_evidence text:=btrim(p_evidence_reference); v_explanation text:=nullif(btrim(p_explanation),'');
begin
  if p_operation_id is null or p_observed_balance_paise is null or p_observed_balance_paise<0
    or v_evidence is null or length(v_evidence) not between 3 and 240 then
    raise exception 'invalid_reconciliation' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,46));
  select * into v_old from public.finance_reconciliations where operation_id=p_operation_id;
  if found then
    if v_old.account_id<>p_account_id or v_old.observed_balance_paise<>p_observed_balance_paise
      or v_old.evidence_reference<>v_evidence or v_old.explanation is distinct from v_explanation
      or v_old.recorded_by<>v_actor then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  perform 1 from public.masjid_accounts where id=p_account_id for update;
  if not found then raise exception 'account_not_found' using errcode='22023'; end if;
  select coalesce(sum(e.amount_paise::numeric),0) into v_book
    from public.finance_effects e where e.account_id=p_account_id;
  if v_book<>p_observed_balance_paise and (v_explanation is null or length(v_explanation) not between 3 and 1000) then
    raise exception 'variance_explanation_required' using errcode='22023'; end if;
  insert into public.finance_reconciliations(operation_id,account_id,observed_balance_paise,
    book_balance_paise,variance_paise,evidence_reference,explanation,recorded_by)
    values(p_operation_id,p_account_id,p_observed_balance_paise,v_book,
      p_observed_balance_paise::numeric-v_book,v_evidence,v_explanation,v_actor)
    returning id into v_id;
  return v_id;
end;
$$;

create function public.list_finance_account_history(
  p_account_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,
  p_limit integer default 25)
returns table(effect_id uuid,source_type text,source_id uuid,leg smallint,
  amount_paise text,occurred_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
  if p_limit is null or p_limit<1 or p_limit>100 or
    (p_before_at is null) <> (p_before_id is null) then
    raise exception 'invalid_page' using errcode='22023'; end if;
  if not exists(select 1 from public.masjid_accounts where id=p_account_id) then
    raise exception 'account_not_found' using errcode='22023'; end if;
  return query select e.id,e.source_type,e.source_id,e.leg,e.amount_paise::text,e.occurred_at
    from public.finance_effects e where e.account_id=p_account_id and
      (p_before_at is null or (e.occurred_at,e.id)<(p_before_at,p_before_id))
    order by e.occurred_at desc,e.id desc limit p_limit;
end;
$$;

create function public.list_finance_reconciliations(
  p_account_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,
  p_limit integer default 25)
returns table(reconciliation_id uuid,observed_balance_paise text,book_balance_paise text,
  variance_paise text,evidence_reference text,explanation text,recorded_by uuid,recorded_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
  if p_limit is null or p_limit<1 or p_limit>100 or
    (p_before_at is null) <> (p_before_id is null) then
    raise exception 'invalid_page' using errcode='22023'; end if;
  if not exists(select 1 from public.masjid_accounts where id=p_account_id) then
    raise exception 'account_not_found' using errcode='22023'; end if;
  return query select r.id,r.observed_balance_paise::text,r.book_balance_paise::text,
    r.variance_paise::text,r.evidence_reference,r.explanation,r.recorded_by,r.recorded_at
    from public.finance_reconciliations r where r.account_id=p_account_id and
      (p_before_at is null or (r.recorded_at,r.id)<(p_before_at,p_before_id))
    order by r.recorded_at desc,r.id desc limit p_limit;
end;
$$;

revoke all on function public.record_finance_reconciliation(uuid,bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.list_finance_account_history(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.list_finance_reconciliations(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.record_finance_reconciliation(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.list_finance_account_history(uuid,timestamptz,uuid,integer) to authenticated;
grant execute on function public.list_finance_reconciliations(uuid,timestamptz,uuid,integer) to authenticated;
commit;
