-- Notify active users who are already authorized to approve expenses.
-- Notification insert and push-outbox enqueue are part of expense submission.

begin;

alter table public.notifications
  drop constraint notifications_kind_chk;

alter table public.notifications
  add constraint notifications_kind_chk
  check (
    kind in (
      'task_assigned',
      'task_unassigned',
      'task_updated',
      'task_progress',
      'task_started',
      'task_completed',
      'task_declined',
      'meeting_created',
      'meeting_updated',
      'meeting_cancelled',
      'announcement',
      'attendance_sync_rejected',
      'expense_awaiting_approval'
    )
  );

create unique index notifications_finance_expense_kind_recipient_uidx
  on public.notifications(recipient_application_user_id, source_entity_id, kind)
  where source_type = 'finance_expense'
    and kind = 'expense_awaiting_approval';

create or replace function public.notify_finance_expense_awaiting_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  insert into public.notifications (
    recipient_application_user_id,
    actor_application_user_id,
    kind,
    title,
    body,
    target_path,
    source_type,
    source_entity_id,
    metadata
  )
  select distinct
    recipient.id,
    new.submitted_by_application_user_id,
    'expense_awaiting_approval',
    'Expense awaiting approval',
    'A submitted expense needs review.',
    '/finance/expenses',
    'finance_expense',
    new.id,
    jsonb_build_object('finance_expense_id', new.id)
  from public.application_users recipient
  join public.application_user_roles recipient_role
    on recipient_role.application_user_id = recipient.id
  join public.role_permissions recipient_permission
    on recipient_permission.role_id = recipient_role.role_id
  join public.permissions permission
    on permission.id = recipient_permission.permission_id
  where recipient.status = 'active'
    and recipient.id <> new.submitted_by_application_user_id
    and permission.key = 'finance.expenses.approve'
    and exists (
      select 1
      from public.role_permissions notification_permission
      join public.permissions notification_capability
        on notification_capability.id = notification_permission.permission_id
      where notification_permission.role_id = recipient_role.role_id
        and notification_capability.key = 'notifications.own.read'
    )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.notify_finance_expense_awaiting_approval()
  from public, anon, authenticated, service_role;

create trigger finance_expenses_notify_approvers
after insert on public.finance_expenses
for each row
when (new.status = 'submitted')
execute function public.notify_finance_expense_awaiting_approval();

commit;
