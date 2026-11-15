begin;

alter table public.notification_push_deliveries
  add column receipt_checks integer not null default 0
    check (receipt_checks between 0 and 5);

create or replace function public.claim_notification_push_receipts(
  p_limit integer default 100
)
returns table (delivery_id uuid, expo_ticket_id text)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid_batch_limit' using errcode = '22023';
  end if;

  update public.notification_push_deliveries d
  set state = 'failed', last_error_code = 'receipt_unavailable',
      locked_until = null, updated_at = now()
  where d.state = 'receipt_pending'
    and d.receipt_checks >= 5
    and d.ticket_created_at <= now() - interval '15 minutes';

  return query
  with candidates as (
    select d.id
    from public.notification_push_deliveries d
    where d.state = 'receipt_pending'
      and d.receipt_checks < 5
      and d.ticket_created_at <= now() - interval '15 minutes'
    order by d.ticket_created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_push_deliveries d
    set state = 'checking_receipt',
        receipt_checks = d.receipt_checks + 1,
        locked_until = now() + interval '5 minutes',
        updated_at = now()
    from candidates c
    where d.id = c.id
    returning d.id, d.expo_ticket_id
  )
  select claimed.id, claimed.expo_ticket_id
  from claimed;
end;
$$;

revoke all on function public.claim_notification_push_receipts(integer)
from public, anon, authenticated;
grant execute on function public.claim_notification_push_receipts(integer)
to service_role;

commit;
