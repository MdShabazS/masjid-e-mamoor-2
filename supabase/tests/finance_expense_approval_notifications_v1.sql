\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select fixture.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', fixture.email, '', now(), now(), now()
from (values
  ('93000000-0000-0000-0000-000000000001'::uuid, 'expense-notify-maker@example.invalid'),
  ('93000000-0000-0000-0000-000000000002'::uuid, 'expense-notify-president@example.invalid'),
  ('93000000-0000-0000-0000-000000000003'::uuid, 'expense-notify-vp@example.invalid'),
  ('93000000-0000-0000-0000-000000000004'::uuid, 'expense-notify-finance@example.invalid'),
  ('93000000-0000-0000-0000-000000000005'::uuid, 'expense-notify-inactive@example.invalid'),
  ('93000000-0000-0000-0000-000000000006'::uuid, 'expense-notify-member@example.invalid')
) fixture(auth_id, email);

insert into public.application_users (id, auth_user_id, status)
values
  ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 'active'),
  ('94000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', 'active'),
  ('94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', 'active'),
  ('94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000004', 'active'),
  ('94000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000005', 'deactivated'),
  ('94000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000006', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select fixture.application_user_id, role_row.id
from (values
  ('94000000-0000-0000-0000-000000000001'::uuid, 'finance'),
  ('94000000-0000-0000-0000-000000000002'::uuid, 'president'),
  ('94000000-0000-0000-0000-000000000003'::uuid, 'vice_president'),
  ('94000000-0000-0000-0000-000000000004'::uuid, 'finance'),
  ('94000000-0000-0000-0000-000000000005'::uuid, 'president'),
  ('94000000-0000-0000-0000-000000000006'::uuid, 'member')
) fixture(application_user_id, role_key)
join public.roles role_row on role_row.key = fixture.role_key;

insert into public.finance_accounts (
  id, name, account_type, status, created_by_application_user_id
)
values (
  '95000000-0000-0000-0000-000000000001',
  'Expense notification test account',
  'bank',
  'active',
  '94000000-0000-0000-0000-000000000001'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id as notified_expense_id
from public.submit_finance_expense(
  '95000000-0000-0000-0000-000000000001',
  125000,
  'Private test expense description',
  'Private test payee',
  current_date,
  'expense-notification-submit-1'
) \gset

select set_config('test.notified_expense_id', :'notified_expense_id', true);

do $$
declare
  v_expense_id uuid := current_setting('test.notified_expense_id', true)::uuid;
  v_recipient_ids uuid[];
  v_expected_recipient_ids uuid[];
  v_replay_id uuid;
begin
  select array_agg(recipient_application_user_id order by recipient_application_user_id)
  into v_recipient_ids
  from public.notifications
  where source_type = 'finance_expense'
    and source_entity_id = v_expense_id
    and kind = 'expense_awaiting_approval';

  select array_agg(distinct recipient.id order by recipient.id)
  into v_expected_recipient_ids
  from public.application_users recipient
  join public.application_user_roles recipient_role
    on recipient_role.application_user_id = recipient.id
  join public.role_permissions approval_permission
    on approval_permission.role_id = recipient_role.role_id
  join public.permissions approval_capability
    on approval_capability.id = approval_permission.permission_id
   and approval_capability.key = 'finance.expenses.approve'
  join public.role_permissions notification_permission
    on notification_permission.role_id = recipient_role.role_id
  join public.permissions notification_capability
    on notification_capability.id = notification_permission.permission_id
   and notification_capability.key = 'notifications.own.read'
  where recipient.status = 'active'
    and recipient.id <> '94000000-0000-0000-0000-000000000001';

  if v_recipient_ids is distinct from v_expected_recipient_ids then
    raise exception 'FAIL: unexpected approver notification recipients: %', v_recipient_ids;
  end if;

  if not ('94000000-0000-0000-0000-000000000002'::uuid = any(v_recipient_ids)) then
    raise exception 'FAIL: President did not receive expense approval notification';
  end if;

  if exists (
    select 1 from public.notifications
    where source_type = 'finance_expense'
      and source_entity_id = v_expense_id
      and (recipient_application_user_id in (
        '94000000-0000-0000-0000-000000000001'::uuid,
        '94000000-0000-0000-0000-000000000005'::uuid,
        '94000000-0000-0000-0000-000000000006'::uuid
      ))
  ) then
    raise exception 'FAIL: submitter, inactive approver, or ordinary Member received a notification';
  end if;

  if exists (
    select 1 from public.notifications
    where source_type = 'finance_expense'
      and source_entity_id = v_expense_id
      and (body ilike '%125000%' or body ilike '%Private test%'
        or title <> 'Expense awaiting approval'
        or target_path <> '/finance/expenses'
        or metadata <> jsonb_build_object('finance_expense_id', v_expense_id))
  ) then
    raise exception 'FAIL: notification exposed private expense details or had invalid routing/metadata';
  end if;

  if (select count(*) from public.notification_push_outbox outbox
      join public.notifications notification on notification.id = outbox.notification_id
      where notification.source_type = 'finance_expense'
        and notification.source_entity_id = v_expense_id)
        <> cardinality(v_expected_recipient_ids) then
    raise exception 'FAIL: expense notifications did not enqueue push attempts';
  end if;

  select id into v_replay_id
  from public.submit_finance_expense(
    '95000000-0000-0000-0000-000000000001',
    125000,
    'Private test expense description',
    'Private test payee',
    current_date,
    'expense-notification-submit-1'
  );

  if v_replay_id <> v_expense_id then
    raise exception 'FAIL: expense submission retry changed resource identity';
  end if;

  if (select count(*) from public.notifications
      where source_type = 'finance_expense'
        and source_entity_id = v_expense_id
        and kind = 'expense_awaiting_approval')
        <> cardinality(v_expected_recipient_ids) then
    raise exception 'FAIL: idempotent retry duplicated approval notifications';
  end if;

  perform set_config(
    'request.jwt.claims',
    '{"sub":"93000000-0000-0000-0000-000000000002","role":"authenticated"}',
    true
  );
  perform set_config(
    'request.jwt.claims',
    '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated"}',
    true
  );
  perform public.set_finance_expense_missing_bill_reason(
    v_expense_id, 'Vendor supplied no printed invoice.'
  );
  perform set_config(
    'request.jwt.claims',
    '{"sub":"93000000-0000-0000-0000-000000000002","role":"authenticated"}',
    true
  );
  perform public.decide_finance_expense(
    v_expense_id, 'approve', null, 'expense-notification-decision-1'
  );

  if not exists (
    select 1 from public.notifications
    where source_type = 'finance_expense'
      and source_entity_id = v_expense_id
      and recipient_application_user_id = '94000000-0000-0000-0000-000000000001'
      and kind = 'expense_approved'
      and title = 'Expense approved'
      and body = 'Your submitted expense was approved and is awaiting payment.'
  ) then
    raise exception 'FAIL: expense submitter did not receive the decision notification';
  end if;

  if not exists (
    select 1 from public.notification_push_outbox outbox
    join public.notifications notification on notification.id = outbox.notification_id
    where notification.source_type = 'finance_expense'
      and notification.source_entity_id = v_expense_id
      and notification.kind = 'expense_approved'
  ) then
    raise exception 'FAIL: expense decision did not enqueue a push attempt';
  end if;
end $$;

rollback;
