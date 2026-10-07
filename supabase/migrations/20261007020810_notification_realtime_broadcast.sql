-- Masjid-e-Mamoor 2
-- Phase 6B-5B1: private per-user Realtime Broadcast for durable notifications.

begin;

drop policy if exists "authenticated_receive_own_notification_broadcasts"
  on realtime.messages;

create policy "authenticated_receive_own_notification_broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) =
    'notifications:' || (select public.current_application_user_id())::text
);

create or replace function public.broadcast_notification_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  perform realtime.broadcast_changes(
    'notifications:' || new.recipient_application_user_id::text,
    'notification_created',
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return new;
end;
$$;

revoke all on function public.broadcast_notification_created() from public;
revoke all on function public.broadcast_notification_created() from anon;
revoke all on function public.broadcast_notification_created() from authenticated;
revoke all on function public.broadcast_notification_created() from service_role;

drop trigger if exists notifications_broadcast_created
  on public.notifications;

create trigger notifications_broadcast_created
after insert
on public.notifications
for each row
execute function public.broadcast_notification_created();

commit;
