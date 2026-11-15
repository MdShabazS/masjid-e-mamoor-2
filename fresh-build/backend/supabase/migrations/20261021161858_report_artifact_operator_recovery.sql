-- Preserve the attempted private path and require a service-only, audited reset.
begin;
alter table public.finance_report_artifacts add column last_attempt_path text;
grant select(attempts,failure_code,last_attempt_path,lease_token,lease_expires_at,updated_at)
 on public.finance_report_artifacts to service_role;

create table public.finance_report_artifact_recoveries (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null,
 format text not null check (format in ('csv','pdf')),
 previous_failure_code text not null,
 previous_attempt_path text not null,
 operator_note text not null,
 recovered_at timestamptz not null default now()
);
alter table public.finance_report_artifact_recoveries enable row level security;
revoke all on public.finance_report_artifact_recoveries from public,anon,authenticated,service_role;

create or replace function public.claim_finance_report_artifact()
returns table(run_id uuid,format text,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into public.finance_report_artifacts(run_id,format)
 select r.id,f.format from public.finance_report_runs r
 cross join (values ('csv'),('pdf')) f(format)
 where r.status='queued' and not exists(
  select 1 from public.finance_report_artifacts existing
  where existing.run_id=r.id and existing.format=f.format)
 order by r.created_at,r.id,f.format limit 20 on conflict do nothing;
 -- An expired worker can still finish a Storage upload. Never retry its path automatically.
 update public.finance_report_artifacts a
 set status='failed',attempts=3,
  last_attempt_path=a.run_id::text||'/'||a.format||'/'||a.lease_token::text||'.'||a.format,
  lease_token=null,lease_expires_at=null,failure_code='lease_expired',updated_at=now()
 where a.status='processing' and a.lease_expires_at<now();
 return query with chosen as (
  select a.run_id,a.format from public.finance_report_artifacts a
  where a.attempts<3 and a.status in ('queued','failed')
  order by a.updated_at,a.run_id,a.format for update skip locked limit 1
 )
 update public.finance_report_artifacts a
 set status='processing',attempts=a.attempts+1,lease_token=gen_random_uuid(),
  lease_expires_at=now()+interval '5 minutes',object_path=null,sha256=null,
  byte_count=null,failure_code=null,last_attempt_path=null,updated_at=now()
 from chosen c where a.run_id=c.run_id and a.format=c.format
 returning a.run_id,a.format,a.lease_token;
end $$;

create or replace function public.fail_finance_report_artifact(p_run_id uuid,p_format text,
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
  last_attempt_path=p_run_id::text||'/'||p_format||'/'||p_lease_token::text||'.'||p_format,
  lease_token=null,lease_expires_at=null,failure_code=p_failure_code,updated_at=now()
 where a.run_id=p_run_id and a.format=p_format and a.status='processing'
  and a.lease_token=p_lease_token;
 return found;
end $$;

create function public.requeue_failed_finance_report_artifact(
 p_run_id uuid,p_format text,p_expected_path text,p_expected_failure_code text,p_operator_note text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_artifact public.finance_report_artifacts;
begin
 if p_run_id is null or p_format not in ('csv','pdf') or p_expected_path is null
  or p_expected_failure_code is null or p_operator_note is null
  or length(btrim(p_operator_note))<3 or length(p_operator_note)>200
 then raise exception 'invalid_artifact_recovery' using errcode='22023'; end if;
 select * into v_artifact from public.finance_report_artifacts
  where run_id=p_run_id and format=p_format for update;
 if not found or v_artifact.status<>'failed' or v_artifact.attempts<>3
  or v_artifact.lease_token is not null or v_artifact.lease_expires_at is not null
  or v_artifact.last_attempt_path is distinct from p_expected_path
  or v_artifact.failure_code is distinct from p_expected_failure_code
 then return false; end if;
 if v_artifact.failure_code in ('upload_ambiguous','lease_expired')
  and v_artifact.updated_at>now()-interval '10 minutes'
 then raise exception 'artifact_recovery_cooldown' using errcode='23514'; end if;
 if exists(select 1 from storage.objects
  where bucket_id='finance-reports-private' and name=p_expected_path)
 then raise exception 'artifact_object_still_exists' using errcode='23514'; end if;
 insert into public.finance_report_artifact_recoveries
  (run_id,format,previous_failure_code,previous_attempt_path,operator_note)
 values (p_run_id,p_format,p_expected_failure_code,p_expected_path,btrim(p_operator_note));
 update public.finance_report_artifacts set status='queued',attempts=0,
  failure_code=null,last_attempt_path=null,updated_at=now()
 where run_id=p_run_id and format=p_format;
 return true;
end $$;

revoke all on function public.requeue_failed_finance_report_artifact(uuid,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.requeue_failed_finance_report_artifact(uuid,text,text,text,text)
 to service_role;
commit;
