-- Phase 7 first slice: private, immutable report requests over canonical posted effects.
-- No PDF or public receipt endpoint is enabled by this migration.
begin;
create table public.finance_report_runs (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 requested_by uuid not null references public.app_users(id) on delete restrict,
 period_kind text not null check (period_kind in ('month','year','range')),
 start_date date not null,
 end_exclusive_date date not null,
 include_proofs boolean not null,
 cutoff_at timestamptz not null default now(),
 status text not null default 'queued' check (status='queued'),
 created_at timestamptz not null default now(),
 check (end_exclusive_date>start_date),
 check (end_exclusive_date<=start_date+366)
);
alter table public.finance_report_runs enable row level security;
revoke all on public.finance_report_runs from public,anon,authenticated;
create trigger finance_report_runs_immutable before update or delete on public.finance_report_runs
 for each row execute function app_private.reject_immutable_finance_change();
create table public.finance_report_effects (
 run_id uuid not null references public.finance_report_runs(id) on delete restrict,
 effect_id uuid not null references public.finance_effects(id) on delete restrict,
 primary key(run_id,effect_id)
);
alter table public.finance_report_effects enable row level security;
revoke all on public.finance_report_effects from public,anon,authenticated;
create trigger finance_report_effects_immutable before update or delete on public.finance_report_effects
 for each row execute function app_private.reject_immutable_finance_change();
create table public.finance_report_accounts (
 run_id uuid not null references public.finance_report_runs(id) on delete restrict,
 account_id uuid not null references public.masjid_accounts(id) on delete restrict,
 account_name text not null,
 primary key(run_id,account_id)
);
alter table public.finance_report_accounts enable row level security;
revoke all on public.finance_report_accounts from public,anon,authenticated;
create trigger finance_report_accounts_immutable before update or delete on public.finance_report_accounts
 for each row execute function app_private.reject_immutable_finance_change();

create function public.request_finance_report(p_kind text,p_start date,p_end_exclusive date,
 p_include_proofs boolean,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','treasurer']);
 v_old public.finance_report_runs; v_id uuid;
begin
 if p_operation_id is null or p_kind not in ('month','year','range')
  or p_start is null or p_end_exclusive is null or p_include_proofs is null
  or p_end_exclusive<=p_start or p_end_exclusive>p_start+366
  or (p_kind='month' and (extract(day from p_start)<>1
    or p_end_exclusive<>(p_start+interval '1 month')::date))
  or (p_kind='year' and (extract(month from p_start)<>1
    or extract(day from p_start)<>1 or p_end_exclusive<>(p_start+interval '1 year')::date)) then
  raise exception 'invalid_report_period' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,71));
 select * into v_old from public.finance_report_runs where operation_id=p_operation_id;
 if found then
  if v_old.requested_by<>v_actor or v_old.period_kind<>p_kind
   or v_old.start_date<>p_start or v_old.end_exclusive_date<>p_end_exclusive
   or v_old.include_proofs<>p_include_proofs then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.finance_report_runs(operation_id,requested_by,period_kind,start_date,
  end_exclusive_date,include_proofs)
 values(p_operation_id,v_actor,p_kind,p_start,p_end_exclusive,p_include_proofs)
 returning id into v_id;
 insert into public.finance_report_accounts(run_id,account_id,account_name)
 select v_id,a.id,a.name from public.masjid_accounts a;
 -- Freeze source IDs in the same transaction; later commits cannot alter this run.
 insert into public.finance_report_effects(run_id,effect_id)
 select v_id,e.id from public.finance_effects e
 where e.occurred_at<=(select cutoff_at from public.finance_report_runs where id=v_id)
  and (e.occurred_at at time zone 'Asia/Kolkata')::date<p_end_exclusive;
 return v_id;
end $$;

create function public.list_finance_report_lines(p_run_id uuid)
returns table(effect_id uuid,account_id uuid,source_type text,source_id uuid,leg smallint,
 category text,amount_paise text,occurred_at timestamptz,description text,
 proof_reference text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select e.id,e.account_id,e.source_type,e.source_id,e.leg,
   case when e.source_type='account_opening' then 'opening'
    when e.source_type='transfer' then 'transfer'
    when e.amount_paise>0 then 'income' else 'expense' end,
   e.amount_paise::text,e.occurred_at,
   case when e.source_type='monthly_contribution' then d.name
    when e.source_type='one_time_donation' then od.donor_name
    when e.source_type='expense_payment' then er.title
    when e.source_type='transfer' then 'Account transfer'
    else 'Opening balance' end,
   case when v_run.include_proofs and e.source_type='expense_payment'
    then ep.proof_reference else null::text end
  from public.finance_report_effects snapshot
   join public.finance_effects e on e.id=snapshot.effect_id
   left join public.ledger_entries le on e.source_type='monthly_contribution' and le.id=e.source_id
   left join public.payment_claims pc on pc.id=le.source_id
   left join public.monthly_donors d on d.id=pc.donor_id
   left join public.one_time_donations od on e.source_type='one_time_donation' and od.id=e.source_id
   left join public.expense_payments ep on e.source_type='expense_payment' and ep.id=e.source_id
   left join public.expense_requests er on er.id=ep.expense_id
  where snapshot.run_id=p_run_id
   and (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
  order by e.occurred_at,e.id;
end $$;

create function public.list_finance_report_balances(p_run_id uuid)
returns table(account_id uuid,account_name text,opening_paise text,period_openings_paise text,income_paise text,
 expense_paise text,transfer_paise text,closing_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select a.account_id,a.account_name,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.start_date),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='account_opening'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type in ('monthly_contribution','one_time_donation')),0)::text,
  coalesce(sum(-(e.amount_paise::numeric)) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='expense_payment'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='transfer'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date),0)::text
 from public.finance_report_accounts a
 left join (public.finance_report_effects snapshot
  join public.finance_effects e on e.id=snapshot.effect_id and snapshot.run_id=p_run_id)
  on e.account_id=a.account_id
 where a.run_id=p_run_id
 group by a.account_id,a.account_name order by a.account_name,a.account_id;
end $$;

revoke all on function public.request_finance_report(text,date,date,boolean,uuid)
 from public,anon,authenticated;
revoke all on function public.list_finance_report_lines(uuid) from public,anon,authenticated;
revoke all on function public.list_finance_report_balances(uuid) from public,anon,authenticated;
grant execute on function public.request_finance_report(text,date,date,boolean,uuid) to authenticated;
grant execute on function public.list_finance_report_lines(uuid) to authenticated;
grant execute on function public.list_finance_report_balances(uuid) to authenticated;
commit;
