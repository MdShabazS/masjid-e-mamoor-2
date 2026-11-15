begin;

create or replace function private.invoke_notification_push_dispatcher()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_endpoint text;
  v_secret text;
  v_request_id bigint;
begin
  select ds.decrypted_secret into v_endpoint
  from vault.decrypted_secrets ds
  where ds.name = 'notification_push_dispatch_url'
  limit 1;
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'notification_push_dispatch_secret'
  limit 1;

  if v_endpoint is null or btrim(v_endpoint) = ''
     or v_secret is null or length(v_secret) < 32 then
    raise warning 'notification push dispatcher is not configured; queued notifications remain pending';
    return null;
  end if;
  if v_endpoint !~ '^https://[A-Za-z0-9.-]+/functions/v1/dispatch-notification-push$'
     and v_endpoint !~ '^http://(127[.]0[.]0[.]1|localhost):[0-9]+/functions/v1/dispatch-notification-push$' then
    raise warning 'notification push dispatcher endpoint is invalid; queued notifications remain pending';
    return null;
  end if;

  select net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-push-secret', v_secret
    ),
    body := jsonb_build_object('mode', 'dispatch'),
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function private.invoke_notification_push_dispatcher()
from public, anon, authenticated, service_role;

select cron.schedule(
  'notification-push-dispatch',
  '* * * * *',
  'select private.invoke_notification_push_dispatcher();'
);

commit;
