begin;

alter table public.finance_monthly_reports
  add column render_claim_token uuid,
  add column render_lease_expires_at timestamptz;

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_render_claim_pair_chk
  check (
    (render_claim_token is null) =
    (render_lease_expires_at is null)
  ),
  add constraint finance_monthly_reports_terminal_claim_chk
  check (
    status = 'generating'
    or (
      render_claim_token is null
      and render_lease_expires_at is null
    )
  ),
  add constraint finance_monthly_reports_render_lease_chk
  check (
    render_claim_token is null
    or render_lease_expires_at > last_attempt_at
  );

create or replace function public.claim_finance_monthly_report_render(
  p_report_id uuid
)
returns table (
  claim_status text,
  report_id uuid,
  render_token uuid,
  lease_expires_at timestamptz,
  storage_bucket text,
  storage_object_path text,
  snapshot_sha256 text,
  snapshot jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_claims jsonb;
  v_now timestamptz := now();
  v_token uuid;
  v_lease_expires_at timestamptz;
  v_report public.finance_monthly_reports;
  v_snapshot jsonb;
  v_snapshot_sha256 text;
begin
  v_claims := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;

  if v_claims ->> 'role' is distinct from 'service_role' then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_report_id is null then
    raise exception 'report_id_required'
      using errcode = '22023';
  end if;

  select r.*
  into v_report
  from public.finance_monthly_reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'finance_monthly_report_not_found'
      using errcode = 'P0002';
  end if;

  if v_report.status = 'ready' then
    return query
    select
      'ready'::text,
      v_report.id,
      null::uuid,
      null::timestamptz,
      v_report.storage_bucket,
      v_report.storage_object_path,
      v_report.snapshot_sha256,
      null::jsonb,
      v_report.attempt_count;
    return;
  end if;

  if v_report.status = 'generating'
     and v_report.render_claim_token is not null
     and v_report.render_lease_expires_at > v_now then
    return query
    select
      'busy'::text,
      v_report.id,
      null::uuid,
      null::timestamptz,
      v_report.storage_bucket,
      v_report.storage_object_path,
      v_report.snapshot_sha256,
      null::jsonb,
      v_report.attempt_count;
    return;
  end if;

  v_token := gen_random_uuid();
  v_lease_expires_at := v_now + interval '10 minutes';

  if v_report.status = 'failed' then
    update public.finance_monthly_reports r
    set
      status = 'generating',
      attempt_count = r.attempt_count + 1,
      last_attempt_at = v_now,
      last_error_code = null,
      render_claim_token = v_token,
      render_lease_expires_at = v_lease_expires_at
    where r.id = v_report.id
    returning r.* into v_report;
  elsif v_report.status = 'generating' then
    update public.finance_monthly_reports r
    set
      attempt_count =
        case
          when r.render_claim_token is null then r.attempt_count
          else r.attempt_count + 1
        end,
      last_attempt_at = v_now,
      render_claim_token = v_token,
      render_lease_expires_at = v_lease_expires_at
    where r.id = v_report.id
    returning r.* into v_report;
  else
    raise exception 'invalid_report_status'
      using errcode = '55000';
  end if;

  select
    s.snapshot,
    s.snapshot_sha256
  into
    v_snapshot,
    v_snapshot_sha256
  from private.finance_monthly_report_snapshots s
  where s.report_id = v_report.id;

  if not found
     or v_snapshot_sha256 is distinct from v_report.snapshot_sha256 then
    raise exception 'finance_monthly_report_snapshot_invalid'
      using errcode = '55000';
  end if;

  return query
  select
    'claimed'::text,
    v_report.id,
    v_report.render_claim_token,
    v_report.render_lease_expires_at,
    v_report.storage_bucket,
    v_report.storage_object_path,
    v_report.snapshot_sha256,
    v_snapshot,
    v_report.attempt_count;
end;
$function$;

create or replace function public.complete_finance_monthly_report_render(
  p_report_id uuid,
  p_render_token uuid,
  p_file_sha256 text,
  p_file_size_bytes bigint
)
returns public.finance_monthly_reports
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_claims jsonb;
  v_now timestamptz := now();
  v_file_sha256 text := btrim(p_file_sha256);
  v_bucket_limit bigint;
  v_report public.finance_monthly_reports;
begin
  v_claims := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;

  if v_claims ->> 'role' is distinct from 'service_role' then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_report_id is null or p_render_token is null then
    raise exception 'invalid_render_completion'
      using errcode = '22023';
  end if;

  if v_file_sha256 is null
     or v_file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_file_sha256'
      using errcode = '22023';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 then
    raise exception 'invalid_file_size'
      using errcode = '22023';
  end if;

  select r.*
  into v_report
  from public.finance_monthly_reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'finance_monthly_report_not_found'
      using errcode = 'P0002';
  end if;

  if v_report.status <> 'generating'
     or v_report.render_claim_token is distinct from p_render_token
     or v_report.render_lease_expires_at is null
     or v_report.render_lease_expires_at <= v_now then
    raise exception 'invalid_render_claim'
      using errcode = '55000';
  end if;

  select b.file_size_limit
  into v_bucket_limit
  from storage.buckets b
  where b.id = v_report.storage_bucket;

  if v_bucket_limit is null
     or p_file_size_bytes > v_bucket_limit then
    raise exception 'invalid_file_size'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = v_report.storage_bucket
      and o.name = v_report.storage_object_path
  ) then
    raise exception 'finance_monthly_report_object_not_found'
      using errcode = 'P0002';
  end if;

  update public.finance_monthly_reports r
  set
    status = 'ready',
    file_sha256 = v_file_sha256,
    file_size_bytes = p_file_size_bytes,
    generated_at = v_now,
    last_error_code = null,
    render_claim_token = null,
    render_lease_expires_at = null
  where r.id = v_report.id
  returning r.* into v_report;

  return v_report;
end;
$function$;

create or replace function public.fail_finance_monthly_report_render(
  p_report_id uuid,
  p_render_token uuid,
  p_error_code text
)
returns public.finance_monthly_reports
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_claims jsonb;
  v_now timestamptz := now();
  v_error_code text := btrim(p_error_code);
  v_report public.finance_monthly_reports;
begin
  v_claims := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;

  if v_claims ->> 'role' is distinct from 'service_role' then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_report_id is null or p_render_token is null then
    raise exception 'invalid_render_failure'
      using errcode = '22023';
  end if;

  if v_error_code is null
     or length(v_error_code) < 1
     or length(v_error_code) > 100
     or v_error_code !~ '^[a-z0-9_:-]+$' then
    raise exception 'invalid_render_error_code'
      using errcode = '22023';
  end if;

  select r.*
  into v_report
  from public.finance_monthly_reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'finance_monthly_report_not_found'
      using errcode = 'P0002';
  end if;

  if v_report.status <> 'generating'
     or v_report.render_claim_token is distinct from p_render_token
     or v_report.render_lease_expires_at is null
     or v_report.render_lease_expires_at <= v_now then
    raise exception 'invalid_render_claim'
      using errcode = '55000';
  end if;

  update public.finance_monthly_reports r
  set
    status = 'failed',
    file_sha256 = null,
    file_size_bytes = null,
    generated_at = null,
    last_error_code = v_error_code,
    render_claim_token = null,
    render_lease_expires_at = null
  where r.id = v_report.id
  returning r.* into v_report;

  return v_report;
end;
$function$;

revoke all
on function public.claim_finance_monthly_report_render(uuid)
from public, anon, authenticated;

revoke all
on function public.complete_finance_monthly_report_render(
  uuid,
  uuid,
  text,
  bigint
)
from public, anon, authenticated;

revoke all
on function public.fail_finance_monthly_report_render(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.claim_finance_monthly_report_render(uuid)
to service_role;

grant execute
on function public.complete_finance_monthly_report_render(
  uuid,
  uuid,
  text,
  bigint
)
to service_role;

grant execute
on function public.fail_finance_monthly_report_render(
  uuid,
  uuid,
  text
)
to service_role;

commit;
