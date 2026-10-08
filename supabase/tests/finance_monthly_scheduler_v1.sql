\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_job_count integer;
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception 'FAIL: pg_cron is not installed';
  end if;

  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_net'
  ) then
    raise exception 'FAIL: pg_net is not installed';
  end if;

  select count(*)
  into v_job_count
  from cron.job j
  where j.jobname = 'finance-monthly-report-render'
    and j.schedule = '30 0 1 * *'
    and j.active
    and j.command like '%private.invoke_finance_monthly_report_scheduler%';

  if v_job_count <> 1 then
    raise exception 'FAIL: monthly scheduler cron job is missing or incorrect';
  end if;

  if has_function_privilege(
    'anon',
    'public.generate_scheduled_finance_monthly_report_snapshot()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.generate_scheduled_finance_monthly_report_snapshot()',
    'execute'
  ) or has_function_privilege(
    'public',
    'public.generate_scheduled_finance_monthly_report_snapshot()',
    'execute'
  ) then
    raise exception 'FAIL: scheduled generator is exposed to client roles';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.generate_scheduled_finance_monthly_report_snapshot()',
    'execute'
  ) then
    raise exception 'FAIL: service_role cannot execute scheduled generator';
  end if;

  if has_function_privilege(
    'service_role',
    'private.invoke_finance_monthly_report_scheduler()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'private.invoke_finance_monthly_report_scheduler()',
    'execute'
  ) or has_function_privilege(
    'anon',
    'private.invoke_finance_monthly_report_scheduler()',
    'execute'
  ) then
    raise exception 'FAIL: private scheduler invoker is exposed';
  end if;

  perform set_config(
    'request.jwt.claims',
    '{"role":"authenticated"}',
    true
  );

  begin
    perform public.generate_scheduled_finance_monthly_report_snapshot();
    raise exception 'FAIL: runtime service-role assertion was bypassed';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_authorized' then
        raise;
      end if;
  end;
end
$test$;

select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

set local role service_role;

do $test$
declare
  v_expected_month date;
  v_report public.finance_monthly_reports;
begin
  select *
  into v_report
  from public.generate_scheduled_finance_monthly_report_snapshot();

  v_expected_month := (
    date_trunc(
      'month',
      timezone('Asia/Kolkata', now())
    )::date
    - interval '1 month'
  )::date;

  if v_report.report_month <> v_expected_month then
    raise exception
      'FAIL: scheduled report month %, expected %',
      v_report.report_month,
      v_expected_month;
  end if;

  if v_report.generation_source <> 'scheduled' then
    raise exception
      'FAIL: scheduled report generation source is %',
      v_report.generation_source;
  end if;
end
$test$;

reset role;

select vault.create_secret(
  'http://127.0.0.1:54321/functions/v1/render-finance-monthly-report',
  'finance_monthly_report_renderer_url',
  '7B3 local scheduler URL'
);

select vault.create_secret(
  repeat('7', 64),
  'finance_monthly_report_scheduler_secret',
  '7B3 local scheduler secret'
);

do $test$
declare
  v_request_id bigint;
  v_url text;
  v_headers jsonb;
  v_body jsonb;
begin
  v_request_id := private.invoke_finance_monthly_report_scheduler();

  if v_request_id is null then
    raise exception 'FAIL: scheduler invoker returned no request id';
  end if;

  select
    q.url,
    q.headers,
    convert_from(q.body, 'UTF8')::jsonb
  into
    v_url,
    v_headers,
    v_body
  from net.http_request_queue q
  where q.id = v_request_id;

  if v_url <>
     'http://127.0.0.1:54321/functions/v1/render-finance-monthly-report' then
    raise exception 'FAIL: scheduler URL mismatch';
  end if;

  if v_headers ->> 'x-finance-scheduler-secret' <> repeat('7', 64) then
    raise exception 'FAIL: scheduler secret header mismatch';
  end if;

  if v_body <> '{"mode":"scheduled"}'::jsonb then
    raise exception 'FAIL: scheduler request body mismatch';
  end if;
end
$test$;

rollback;

\echo 'finance_monthly_scheduler_v1: PASS'
