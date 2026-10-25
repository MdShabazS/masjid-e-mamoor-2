-- Private, leased PDF/CSV artifact work. Only service_role may claim or finish.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('finance-reports-private','finance-reports-private',false,15000000,
 array['application/pdf','text/csv']::text[]);

create table public.finance_report_artifacts (
 run_id uuid not null references public.finance_report_runs(id) on delete restrict,
 format text not null check(format in ('csv','pdf')),
 status text not null default 'queued' check(status in ('queued','processing','ready','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 lease_token uuid,
 lease_expires_at timestamptz,
 object_path text,
 sha256 text,
 byte_count integer,
 failure_code text,
 updated_at timestamptz not null default now(),
 primary key(run_id,format),
 check((status='processing')=(lease_token is not null and lease_expires_at is not null)),
 check((status='ready')=(object_path is not null and sha256 is not null and byte_count is not null)),
 check(sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
 check(byte_count is null or byte_count between 1 and 15000000)
);
create index finance_report_artifacts_claim_idx on public.finance_report_artifacts
 (status,updated_at,run_id,format) where attempts<3;
alter table public.finance_report_artifacts enable row level security;
revoke all on public.finance_report_artifacts from public,anon,authenticated,service_role;
grant select(run_id,format,status,object_path,sha256,byte_count)
 on public.finance_report_artifacts to service_role;

create function public.claim_finance_report_artifact()
returns table(run_id uuid,format text,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into public.finance_report_artifacts(run_id,format)
 select r.id,f.format from public.finance_report_runs r
 cross join (values ('csv'),('pdf')) f(format)
 where r.status='queued' and not exists(
  select 1 from public.finance_report_artifacts existing
  where existing.run_id=r.id and existing.format=f.format)
 order by r.created_at,r.id,f.format limit 20
 on conflict do nothing;
 update public.finance_report_artifacts a
 set status='failed',lease_token=null,lease_expires_at=null,
  failure_code='lease_expired',updated_at=now()
 where a.status='processing' and a.attempts>=3 and a.lease_expires_at<now();
 return query with chosen as (
  select a.run_id,a.format from public.finance_report_artifacts a
  where a.attempts<3 and (a.status in ('queued','failed')
    or (a.status='processing' and a.lease_expires_at<now()))
  order by a.updated_at,a.run_id,a.format for update skip locked limit 1
 )
 update public.finance_report_artifacts a
 set status='processing',attempts=a.attempts+1,lease_token=gen_random_uuid(),
  lease_expires_at=now()+interval '5 minutes',object_path=null,sha256=null,
  byte_count=null,failure_code=null,updated_at=now()
 from chosen c where a.run_id=c.run_id and a.format=c.format
 returning a.run_id,a.format,a.lease_token;
end $$;

create function public.finish_finance_report_artifact(p_run_id uuid,p_format text,
 p_lease_token uuid,p_object_path text,p_sha256 text,p_byte_count integer)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_run_id is null or p_format is null or p_format not in ('csv','pdf') or p_lease_token is null
  or p_object_path is null or p_sha256 is null or p_byte_count is null
  or p_object_path is distinct from
   (p_run_id::text||'/'||p_format||'/'||p_lease_token::text||'.'||p_format)
  or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_count not between 1 and 15000000
 then raise exception 'invalid_report_artifact' using errcode='22023'; end if;
 update public.finance_report_artifacts a set status='ready',object_path=p_object_path,
  sha256=p_sha256,byte_count=p_byte_count,lease_token=null,lease_expires_at=null,
  failure_code=null,updated_at=now()
 where a.run_id=p_run_id and a.format=p_format and a.status='processing'
  and a.lease_token=p_lease_token and a.lease_expires_at>now();
 return found;
end $$;

create function public.fail_finance_report_artifact(p_run_id uuid,p_format text,
 p_lease_token uuid,p_failure_code text,p_terminal boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_run_id is null or p_format is null or p_format not in ('csv','pdf') or p_lease_token is null
  or p_failure_code is null
  or p_failure_code not in ('snapshot_unavailable','render_failed','storage_unavailable',
    'upload_ambiguous','artifact_too_large') or p_terminal is null
 then raise exception 'invalid_report_artifact' using errcode='22023'; end if;
 update public.finance_report_artifacts a set status='failed',
  attempts=case when p_terminal then 3 else a.attempts end,
  lease_token=null,lease_expires_at=null,failure_code=p_failure_code,updated_at=now()
 where a.run_id=p_run_id and a.format=p_format and a.status='processing'
  and a.lease_token=p_lease_token;
 return found;
end $$;

create function public.finance_report_artifact_status(p_run_id uuid)
returns table(format text,status text,attempts integer,sha256 text,byte_count integer)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 if p_run_id is null or not exists(select 1 from public.finance_report_runs where id=p_run_id) then
  raise exception 'report_not_found' using errcode='22023'; end if;
 return query select a.format,a.status,a.attempts,a.sha256,a.byte_count
 from public.finance_report_artifacts a where a.run_id=p_run_id order by a.format;
end $$;

create function public.worker_finance_report_lines(p_run_id uuid)
returns table(effect_id uuid,account_id uuid,source_type text,source_id uuid,leg smallint,
 category text,amount_paise text,occurred_at timestamptz,description text,proof_reference text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select e.id,e.account_id,e.source_type,e.source_id,e.leg,
  case when e.source_type='account_opening' then 'opening'
   when e.source_type='transfer' then 'transfer'
   when coalesce(c.source_kind,e.source_type)='expense_payment' then 'expense'
   else 'income' end,e.amount_paise::text,e.occurred_at,
  case when c.id is not null then 'Correction: '||c.reason
   when e.source_type='monthly_contribution' then d.name
   when e.source_type='one_time_donation' then od.donor_name
   when e.source_type='expense_payment' then er.title
   when e.source_type='transfer' then 'Account transfer'
   else 'Opening balance' end,
  case when v_run.include_proofs and e.source_type='expense_payment'
   then ep.proof_reference else null::text end
 from public.finance_report_effects snapshot
 join public.finance_effects e on e.id=snapshot.effect_id
 left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id
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

create function public.worker_finance_report_balances(p_run_id uuid)
returns table(account_id uuid,account_name text,opening_paise text,period_openings_paise text,
 income_paise text,expense_paise text,transfer_paise text,closing_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
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
   and coalesce(c.source_kind,e.source_type) in ('monthly_contribution','one_time_donation')),0)::text,
  coalesce(sum(-(e.amount_paise::numeric)) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type)='expense_payment'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='transfer'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date),0)::text
 from public.finance_report_accounts a
 left join (public.finance_report_effects snapshot
  join public.finance_effects e on e.id=snapshot.effect_id and snapshot.run_id=p_run_id
  left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id)
  on e.account_id=a.account_id
 where a.run_id=p_run_id
 group by a.account_id,a.account_name order by a.account_name,a.account_id;
end $$;

revoke all on function public.claim_finance_report_artifact() from public,anon,authenticated;
revoke all on function public.finish_finance_report_artifact(uuid,text,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.fail_finance_report_artifact(uuid,text,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.worker_finance_report_lines(uuid) from public,anon,authenticated;
revoke all on function public.worker_finance_report_balances(uuid) from public,anon,authenticated;
revoke all on function public.finance_report_artifact_status(uuid) from public,anon,authenticated;
grant execute on function public.claim_finance_report_artifact() to service_role;
grant execute on function public.finish_finance_report_artifact(uuid,text,uuid,text,text,integer) to service_role;
grant execute on function public.fail_finance_report_artifact(uuid,text,uuid,text,boolean) to service_role;
grant execute on function public.worker_finance_report_lines(uuid) to service_role;
grant execute on function public.worker_finance_report_balances(uuid) to service_role;
grant execute on function public.finance_report_artifact_status(uuid) to authenticated;
commit;
