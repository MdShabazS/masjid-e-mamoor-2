\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' BOARD GOVERNANCE FOUNDATION V1 TEST'
\echo '============================================'

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  x.email,
  '',
  now(),
  now(),
  now()
from (values
  ('86000000-0000-0000-0000-000000000001'::uuid, 'board-president@example.invalid'),
  ('86000000-0000-0000-0000-000000000002'::uuid, 'board-vp@example.invalid'),
  ('86000000-0000-0000-0000-000000000003'::uuid, 'board-secretary@example.invalid'),
  ('86000000-0000-0000-0000-000000000004'::uuid, 'board-finance@example.invalid'),
  ('86000000-0000-0000-0000-000000000005'::uuid, 'board-auditor@example.invalid'),
  ('86000000-0000-0000-0000-000000000006'::uuid, 'board-committee-one@example.invalid'),
  ('86000000-0000-0000-0000-000000000007'::uuid, 'board-committee-two@example.invalid'),
  ('86000000-0000-0000-0000-000000000008'::uuid, 'board-member@example.invalid'),
  ('86000000-0000-0000-0000-000000000009'::uuid, 'board-system-admin@example.invalid'),
  ('86000000-0000-0000-0000-000000000010'::uuid, 'board-inactive@example.invalid'),
  ('86000000-0000-0000-0000-000000000011'::uuid, 'board-president-two@example.invalid'),
  ('86000000-0000-0000-0000-000000000012'::uuid, 'board-finance-two@example.invalid')
) x(auth_id, email);

insert into public.application_users (
  id, auth_user_id, status, display_name
)
values
  ('87000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', 'active', 'Board President'),
  ('87000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000002', 'active', 'Board Vice President'),
  ('87000000-0000-0000-0000-000000000003', '86000000-0000-0000-0000-000000000003', 'active', 'Board Secretary'),
  ('87000000-0000-0000-0000-000000000004', '86000000-0000-0000-0000-000000000004', 'active', 'Board Treasurer'),
  ('87000000-0000-0000-0000-000000000005', '86000000-0000-0000-0000-000000000005', 'active', 'Board Auditor'),
  ('87000000-0000-0000-0000-000000000006', '86000000-0000-0000-0000-000000000006', 'active', 'Board Trustee One'),
  ('87000000-0000-0000-0000-000000000007', '86000000-0000-0000-0000-000000000007', 'active', 'Board Trustee Two'),
  ('87000000-0000-0000-0000-000000000008', '86000000-0000-0000-0000-000000000008', 'active', 'Board Member Reader'),
  ('87000000-0000-0000-0000-000000000009', '86000000-0000-0000-0000-000000000009', 'active', 'Emergency System Admin'),
  ('87000000-0000-0000-0000-000000000010', '86000000-0000-0000-0000-000000000010', 'deactivated', 'Inactive Committee'),
  ('87000000-0000-0000-0000-000000000011', '86000000-0000-0000-0000-000000000011', 'active', 'Second President'),
  ('87000000-0000-0000-0000-000000000012', '86000000-0000-0000-0000-000000000012', 'active', 'Second Finance');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('87000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('87000000-0000-0000-0000-000000000002'::uuid, 'vice_president'),
  ('87000000-0000-0000-0000-000000000003'::uuid, 'secretary'),
  ('87000000-0000-0000-0000-000000000004'::uuid, 'finance'),
  ('87000000-0000-0000-0000-000000000005'::uuid, 'auditor'),
  ('87000000-0000-0000-0000-000000000006'::uuid, 'committee_member'),
  ('87000000-0000-0000-0000-000000000007'::uuid, 'committee_member'),
  ('87000000-0000-0000-0000-000000000008'::uuid, 'member'),
  ('87000000-0000-0000-0000-000000000009'::uuid, 'system_admin'),
  ('87000000-0000-0000-0000-000000000010'::uuid, 'committee_member'),
  ('87000000-0000-0000-0000-000000000011'::uuid, 'president'),
  ('87000000-0000-0000-0000-000000000012'::uuid, 'finance')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- President appoints a compatible current Board, including multiple trustees.
select id as president_appointment_id
from public.appoint_board_member(
  '87000000-0000-0000-0000-000000000001',
  'president',
  date '2026-01-01',
  'board-appoint-president'
) \gset
select set_config(
  'test.president_appointment_id',
  :'president_appointment_id',
  true
);

select id as vp_appointment_id
from public.appoint_board_member(
  '87000000-0000-0000-0000-000000000002',
  'vice_president',
  date '2026-01-01',
  'board-appoint-vp'
) \gset
select set_config('test.vp_appointment_id', :'vp_appointment_id', true);

select public.appoint_board_member(
  '87000000-0000-0000-0000-000000000003',
  'secretary',
  date '2026-01-01',
  'board-appoint-secretary'
);

select public.appoint_board_member(
  '87000000-0000-0000-0000-000000000004',
  'treasurer',
  date '2026-01-01',
  'board-appoint-treasurer'
);

select id as trustee_one_appointment_id
from public.appoint_board_member(
  '87000000-0000-0000-0000-000000000006',
  'trustee',
  null,
  'board-appoint-trustee-one'
) \gset
select set_config(
  'test.trustee_one_appointment_id',
  :'trustee_one_appointment_id',
  true
);

select public.appoint_board_member(
  '87000000-0000-0000-0000-000000000007',
  'trustee',
  null,
  'board-appoint-trustee-two'
);

do $$
begin
  if (select count(*) from public.list_current_board()) <> 6 then
    raise exception 'FAIL: compatible Board appointments were not created';
  end if;

  if (select count(*) from public.board_appointments
      where status = 'active' and designation = 'trustee') <> 2 then
    raise exception 'FAIL: multiple active trustees were not allowed';
  end if;

  if (select count(*) from public.board_appointment_activity
      where activity_type = 'board_member_appointed') <> 6 then
    raise exception 'FAIL: appointment audit activity count is incorrect';
  end if;
end $$;

-- Exact replay returns the same resource and never duplicates activity.
select public.appoint_board_member(
  '87000000-0000-0000-0000-000000000002',
  'vice_president',
  date '2026-01-01',
  'board-appoint-vp'
);

do $$
begin
  if (select count(*) from public.board_appointment_activity
      where operation_id = 'board-appoint-vp') <> 1 then
    raise exception 'FAIL: exact appointment replay duplicated activity';
  end if;

  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000002',
      'vice_president',
      date '2026-02-01',
      'board-appoint-vp'
    );
    raise exception 'FAIL: changed operation payload was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Database-backed appointment and designation invariants.
do $$
begin
  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000006',
      'joint_secretary',
      current_date,
      'board-duplicate-active-user'
    );
    raise exception 'FAIL: second active appointment for one user succeeded';
  exception when unique_violation then null;
  end;

  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000011',
      'president',
      current_date,
      'board-duplicate-president'
    );
    raise exception 'FAIL: duplicate exclusive President succeeded';
  exception when unique_violation then null;
  end;

  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000008',
      'trustee',
      current_date,
      'board-incompatible-member'
    );
    raise exception 'FAIL: incompatible authorization role was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000010',
      'trustee',
      current_date,
      'board-inactive-target'
    );
    raise exception 'FAIL: inactive account was appointed';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000012',
      'chairperson',
      current_date,
      'board-invalid-designation'
    );
    raise exception 'FAIL: invalid designation was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Designation changes preserve the original appointment and append a new row.
do $$
begin
  begin
    perform public.change_board_designation(
      (
        select id
        from public.board_appointments
        where application_user_id =
          '87000000-0000-0000-0000-000000000007'
          and status = 'active'
      ),
      'treasurer',
      date '2026-03-01',
      'board-change-incompatible-role'
    );
    raise exception 'FAIL: incompatible designation change succeeded';
  exception when invalid_parameter_value then null;
  end;
end $$;

select id as joint_secretary_appointment_id
from public.change_board_designation(
  :'trustee_one_appointment_id'::uuid,
  'joint_secretary',
  date '2026-04-01',
  'board-change-trustee-one'
) \gset
select set_config(
  'test.joint_secretary_appointment_id',
  :'joint_secretary_appointment_id',
  true
);

select public.change_board_designation(
  :'trustee_one_appointment_id'::uuid,
  'joint_secretary',
  date '2026-04-01',
  'board-change-trustee-one'
);

do $$
begin
  if not exists (
    select 1 from public.board_appointments
    where id = current_setting('test.trustee_one_appointment_id')::uuid
      and status = 'ended'
      and designation = 'trustee'
      and ended_on = date '2026-04-01'
  ) then
    raise exception 'FAIL: original appointment history was not preserved';
  end if;

  if not exists (
    select 1 from public.board_appointments
    where id = current_setting('test.joint_secretary_appointment_id')::uuid
      and status = 'active'
      and designation = 'joint_secretary'
      and appointed_on = date '2026-04-01'
  ) then
    raise exception 'FAIL: replacement appointment was not created';
  end if;

  if (select count(*) from public.board_appointment_activity
      where operation_id = 'board-change-trustee-one') <> 1 then
    raise exception 'FAIL: designation replay duplicated audit activity';
  end if;
end $$;

-- Ending an appointment preserves the row, account, and authorization role.
select public.end_board_appointment(
  :'vp_appointment_id'::uuid,
  date '2026-05-01',
  'board-end-vp'
);

select public.end_board_appointment(
  :'vp_appointment_id'::uuid,
  date '2026-05-01',
  'board-end-vp'
);

do $$
begin
  if not exists (
    select 1 from public.board_appointments
    where id = current_setting('test.vp_appointment_id')::uuid
      and status = 'ended'
      and ended_on = date '2026-05-01'
      and ended_by_application_user_id =
        '87000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: ended appointment history was not preserved';
  end if;

  if (select status from public.application_users
      where id = '87000000-0000-0000-0000-000000000002') <> 'active' then
    raise exception 'FAIL: ending appointment changed account status';
  end if;

  if (select r.key
      from public.application_user_roles aur
      join public.roles r on r.id = aur.role_id
      where aur.application_user_id =
        '87000000-0000-0000-0000-000000000002') <> 'vice_president' then
    raise exception 'FAIL: ending appointment changed authorization role';
  end if;

  if (select count(*) from public.board_appointment_activity
      where operation_id = 'board-end-vp') <> 1 then
    raise exception 'FAIL: end replay duplicated audit activity';
  end if;
end $$;

-- Every documented read role can access the safe current/history models.
set local role authenticated;
do $$
declare
  v_auth_id uuid;
begin
  foreach v_auth_id in array array[
    '86000000-0000-0000-0000-000000000001'::uuid,
    '86000000-0000-0000-0000-000000000002'::uuid,
    '86000000-0000-0000-0000-000000000003'::uuid,
    '86000000-0000-0000-0000-000000000004'::uuid,
    '86000000-0000-0000-0000-000000000005'::uuid,
    '86000000-0000-0000-0000-000000000006'::uuid,
    '86000000-0000-0000-0000-000000000008'::uuid
  ] loop
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_auth_id, 'role', 'authenticated')::text,
      true
    );

    if (select count(*) from public.list_current_board()) <> 5 then
      raise exception 'FAIL: authorized Board reader % cannot read current Board',
        v_auth_id;
    end if;

    if (select count(*) from public.list_board_history()) <> 7 then
      raise exception 'FAIL: authorized Board reader % cannot read history',
        v_auth_id;
    end if;

  end loop;
end $$;
reset role;

-- Management remains President-only, including exclusion of System Admin.
do $$
declare
  v_auth_id uuid;
begin
  foreach v_auth_id in array array[
    '86000000-0000-0000-0000-000000000002'::uuid,
    '86000000-0000-0000-0000-000000000003'::uuid,
    '86000000-0000-0000-0000-000000000004'::uuid,
    '86000000-0000-0000-0000-000000000005'::uuid,
    '86000000-0000-0000-0000-000000000006'::uuid,
    '86000000-0000-0000-0000-000000000008'::uuid,
    '86000000-0000-0000-0000-000000000009'::uuid
  ] loop
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_auth_id, 'role', 'authenticated')::text,
      true
    );

    begin
      perform public.appoint_board_member(
        '87000000-0000-0000-0000-000000000012',
        'joint_treasurer',
        current_date,
        'board-forbidden-' || v_auth_id::text
      );
      raise exception 'FAIL: unauthorized Board manager % appointed a user',
        v_auth_id;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-0000-0000-000000000009","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform count(*) from public.board_appointments;
    raise exception 'FAIL: System Admin unexpectedly received direct Board table read';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.list_current_board();
    raise exception 'FAIL: System Admin unexpectedly received Board read';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Authenticated clients use trusted Board RPCs and have no direct table access.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform count(*) from public.board_appointments;
    raise exception 'FAIL: authenticated direct Board read succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.board_appointment_activity;
    raise exception 'FAIL: authenticated direct Board activity read succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.board_appointments (
      application_user_id,
      designation,
      created_by_application_user_id
    ) values (
      '87000000-0000-0000-0000-000000000012',
      'joint_treasurer',
      '87000000-0000-0000-0000-000000000001'
    );
    raise exception 'FAIL: authenticated direct Board insert succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.board_appointments
    set designation = 'trustee'
    where id = current_setting('test.president_appointment_id')::uuid;
    raise exception 'FAIL: authenticated direct Board update succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.board_appointments
    where id = current_setting('test.president_appointment_id')::uuid;
    raise exception 'FAIL: authenticated direct Board delete succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Hard deletion and audit rewrites are rejected even at the table-owner path.
do $$
begin
  begin
    delete from public.board_appointments
    where id = current_setting('test.vp_appointment_id')::uuid;
    raise exception 'FAIL: Board appointment history was deleted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    update public.board_appointment_activity
    set details = '{}'::jsonb
    where operation_id = 'board-end-vp';
    raise exception 'FAIL: Board activity was rewritten';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;

-- Audit failure must roll back appointment and idempotency activity together.
create function public.test_reject_board_activity()
returns trigger
language plpgsql
as $$
begin
  if new.operation_id = 'board-failure-injection' then
    raise exception 'injected_board_activity_failure';
  end if;
  return new;
end;
$$;

create trigger test_reject_board_activity
before insert on public.board_appointment_activity
for each row execute function public.test_reject_board_activity();

select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.appoint_board_member(
      '87000000-0000-0000-0000-000000000012',
      'joint_treasurer',
      current_date,
      'board-failure-injection'
    );
    raise exception 'FAIL: injected audit failure did not abort operation';
  exception when raise_exception then
    if sqlerrm <> 'injected_board_activity_failure' then
      raise;
    end if;
  end;

  if exists (
    select 1 from public.board_appointments
    where application_user_id =
      '87000000-0000-0000-0000-000000000012'
  ) then
    raise exception 'FAIL: audit failure left a Board appointment';
  end if;

  if exists (
    select 1 from public.board_appointment_activity
    where operation_id = 'board-failure-injection'
  ) then
    raise exception 'FAIL: audit failure left idempotency activity';
  end if;
end $$;

drop trigger test_reject_board_activity
on public.board_appointment_activity;
drop function public.test_reject_board_activity();

-- Execution grants and Finance task permissions are exact and least-privilege.
do $$
begin
  if has_function_privilege(
    'anon',
    'public.list_current_board()',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.appoint_board_member(uuid,text,date,text)',
    'execute'
  ) then
    raise exception 'FAIL: anon can execute Board RPCs';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.lock_active_board_actor()',
    'execute'
  ) then
    raise exception 'FAIL: authenticated can execute internal actor lock';
  end if;

  if has_function_privilege(
    'service_role',
    'public.appoint_board_member(uuid,text,date,text)',
    'execute'
  ) then
    raise exception 'FAIL: service_role received Board management execution';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.board_appointment_activity',
    'select'
  ) then
    raise exception 'FAIL: raw Board audit activity is client-readable';
  end if;

  if not exists (
    select 1
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.key = 'finance'
      and p.key = 'committee.tasks.read'
  ) or not exists (
    select 1
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.key = 'finance'
      and p.key = 'committee.tasks.manage'
  ) then
    raise exception 'FAIL: Finance task eligibility permissions are missing';
  end if;

  if exists (
    select 1
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.key = 'finance'
      and p.key = 'committee.tasks.assign'
  ) then
    raise exception 'FAIL: Finance received committee task assignment authority';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.list_current_board();
    raise exception 'FAIL: anon read current Board';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.board_appointments;
    raise exception 'FAIL: anon browsed Board appointment table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo '============================================'
\echo ' ALL BOARD GOVERNANCE TESTS PASSED'
\echo '============================================'

rollback;
