begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.generate_scheduled_finance_monthly_report_snapshot()
returns public.finance_monthly_reports
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_claims jsonb;
  v_report_month date;
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

  v_report_month := (
    date_trunc(
      'month',
      timezone('Asia/Kolkata', now())
    )::date
    - interval '1 month'
  )::date;

  v_report := private.build_finance_monthly_report_snapshot(
    v_report_month,
    'scheduled'
  );

  return v_report;
end;
$function$;

revoke all
on function public.generate_scheduled_finance_monthly_report_snapshot()
from public, anon, authenticated, service_role;

grant execute
on function public.generate_scheduled_finance_monthly_report_snapshot()
to service_role;

create or replace function private.invoke_finance_monthly_report_scheduler()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_endpoint text;
  v_secret text;
  v_request_id bigint;
begin
  select ds.decrypted_secret
  into v_endpoint
  from vault.decrypted_secrets ds
  where ds.name = 'finance_monthly_report_renderer_url'
  limit 1;

  select ds.decrypted_secret
  into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'finance_monthly_report_scheduler_secret'
  limit 1;

  if v_endpoint is null
     or btrim(v_endpoint) = ''
     or v_secret is null
     or length(v_secret) < 32 then
    raise exception 'finance_monthly_scheduler_not_configured'
      using errcode = '55000';
  end if;

  if v_endpoint !~ '^https://[A-Za-z0-9.-]+/functions/v1/render-finance-monthly-report$'
     and v_endpoint !~ '^http://(127[.]0[.]0[.]1|localhost):[0-9]+/functions/v1/render-finance-monthly-report$' then
    raise exception 'finance_monthly_scheduler_endpoint_invalid'
      using errcode = '22023';
  end if;

  select net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-finance-scheduler-secret', v_secret
    ),
    body := jsonb_build_object(
      'mode', 'scheduled'
    ),
    timeout_milliseconds := 10000
  )
  into v_request_id;

  return v_request_id;
end;
$function$;

revoke all
on function private.invoke_finance_monthly_report_scheduler()
from public, anon, authenticated, service_role;

select cron.schedule(
  'finance-monthly-report-render',
  '30 0 1 * *',
  'select private.invoke_finance_monthly_report_scheduler();'
);

commit;
