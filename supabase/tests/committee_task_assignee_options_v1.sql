\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', x.email, '', now(), now(), now()
from (values
  ('71000000-0000-0000-0000-000000000001'::uuid, 'picker-president@example.invalid'),
  ('71000000-0000-0000-0000-000000000002'::uuid, 'picker-secretary@example.invalid'),
  ('71000000-0000-0000-0000-000000000003'::uuid, 'picker-committee@example.invalid'),
  ('71000000-0000-0000-0000-000000000004'::uuid, 'picker-auditor@example.invalid'),
  ('71000000-0000-0000-0000-000000000005'::uuid, 'picker-member@example.invalid'),
  ('71000000-0000-0000-0000-000000000006'::uuid, 'picker-inactive@example.invalid')
) x(auth_id, email);

insert into public.application_users (
  id, auth_user_id, status, username, username_normalized, display_name
)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'active', 'picker.president', 'picker.president', 'Account President'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'active', 'picker.secretary', 'picker.secretary', null),
  ('72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'active', 'picker.committee', 'picker.committee', null),
  ('72000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000004', 'active', 'picker.auditor', 'picker.auditor', 'Account Auditor'),
  ('72000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000005', 'active', 'picker.member', 'picker.member', 'Account Member'),
  ('72000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000006', 'deactivated', 'picker.inactive', 'picker.inactive', 'Inactive Committee');

insert into public.member_profiles (
  id, application_user_id, status, display_name
)
values (
  '73000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000002',
  'active',
  'Profile Secretary'
);

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('72000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('72000000-0000-0000-0000-000000000002'::uuid, 'secretary'),
  ('72000000-0000-0000-0000-000000000003'::uuid, 'committee_member'),
  ('72000000-0000-0000-0000-000000000004'::uuid, 'auditor'),
  ('72000000-0000-0000-0000-000000000005'::uuid, 'member'),
  ('72000000-0000-0000-0000-000000000006'::uuid, 'committee_member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
declare v_rows jsonb;
begin
  select jsonb_agg(to_jsonb(options) order by options.application_user_id)
  into v_rows
  from public.list_committee_task_assignee_options() options
  where options.application_user_id::text like '72000000-0000-0000-0000-%';

  if v_rows is null or jsonb_array_length(v_rows) <> 3 then
    raise exception 'FAIL: expected three active read/manage assignees, got %', v_rows;
  end if;
  if v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000004"}]'::jsonb
     or v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000005"}]'::jsonb
     or v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000006"}]'::jsonb then
    raise exception 'FAIL: ineligible or inactive assignee returned';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(v_rows -> 0) key
    where key not in ('application_user_id', 'display_name', 'role_label')
  ) then
    raise exception 'FAIL: assignee picker returned unnecessary fields';
  end if;
end $$;


-- Picker labels must never expose application login usernames.
do $$
declare v_rows jsonb;
begin
  select jsonb_agg(to_jsonb(options))
  into v_rows
  from public.list_committee_task_assignee_options() options
  where options.application_user_id::text like '72000000-0000-0000-0000-%';

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) item
    where item ->> 'display_name' in (
      'picker.president',
      'picker.secretary',
      'picker.committee'
    )
  ) then
    raise exception 'FAIL: assignee picker exposed a login username';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) item
    where item ->> 'display_name' like '%@example.invalid%'
       or item ->> 'display_name' like '%picker.%'
       or item ->> 'display_name' like '%72000000-%'
  ) then
    raise exception 'FAIL: assignee labels exposed account or UUID data: %', v_rows;
  end if;

  if not v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000001","display_name":"Account President","role_label":"President / Super Admin"}]'::jsonb then
    raise exception 'FAIL: account display name was not preferred: %', v_rows;
  end if;

  if not v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000002","display_name":"Profile Secretary","role_label":"Secretary"}]'::jsonb then
    raise exception 'FAIL: member-profile display name fallback was not used: %', v_rows;
  end if;

  if not v_rows @> '[{"application_user_id":"72000000-0000-0000-0000-000000000003","display_name":"Committee Member","role_label":"Committee Member"}]'::jsonb then
    raise exception 'FAIL: safe role fallback was not used: %', v_rows;
  end if;
end $$;

-- Task detail must use the same safe assignee-label boundary and must not
-- expose account/authentication fields.
select public.create_committee_task(
  'Picker detail contract',
  null,
  'normal',
  null,
  array[
    '72000000-0000-0000-0000-000000000001'::uuid,
    '72000000-0000-0000-0000-000000000002'::uuid,
    '72000000-0000-0000-0000-000000000003'::uuid
  ],
  'picker-detail-contract-create'
);

do $$
declare
  v_task_id uuid;
  v_detail jsonb;
  v_assignee jsonb;
begin
  select id
  into v_task_id
  from public.committee_tasks
  where title = 'Picker detail contract';

  v_detail := public.get_committee_task(v_task_id);

  if jsonb_array_length(coalesce(v_detail -> 'assignees', '[]'::jsonb)) <> 3 then
    raise exception 'FAIL: task detail assignee contract missing';
  end if;

  select item
  into v_assignee
  from jsonb_array_elements(v_detail -> 'assignees') item
  where item ->> 'application_user_id' = '72000000-0000-0000-0000-000000000003';

  if v_assignee ->> 'display_name' <> 'Committee Member' then
    raise exception 'FAIL: task detail did not use safe role fallback: %', v_assignee;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_detail -> 'assignees', '[]'::jsonb)) item
    where item ->> 'display_name' like '%@example.invalid%'
       or item ->> 'display_name' like '%picker.%'
       or item ->> 'display_name' like '%72000000-%'
  ) then
    raise exception 'FAIL: task detail labels exposed account or UUID data: %', v_detail;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_assignee) key
    where key not in (
      'id',
      'application_user_id',
      'display_name',
      'role_label',
      'assigned_at',
      'removed_at'
    )
  ) then
    raise exception 'FAIL: task detail exposed unnecessary assignee fields: %',
      v_assignee;
  end if;
end $$;

-- Secretary is also assign-capable.
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select count(*) from public.list_committee_task_assignee_options();

-- Committee Member, Auditor, and ordinary Member are denied.
do $$
declare v_auth_id uuid;
begin
  foreach v_auth_id in array array[
    '71000000-0000-0000-0000-000000000003'::uuid,
    '71000000-0000-0000-0000-000000000004'::uuid,
    '71000000-0000-0000-0000-000000000005'::uuid
  ] loop
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_auth_id, 'role', 'authenticated')::text,
      true
    );
    begin
      perform public.list_committee_task_assignee_options();
      raise exception 'FAIL: unauthorized assignee discovery succeeded for %', v_auth_id;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.list_committee_task_assignee_options()',
    'execute'
  ) then
    raise exception 'FAIL: anon can execute assignee discovery';
  end if;
end $$;

rollback;
