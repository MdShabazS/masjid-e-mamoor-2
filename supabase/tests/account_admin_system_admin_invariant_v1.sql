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
  ('81000000-0000-0000-0000-000000000001'::uuid, 'account-admin-one@example.invalid'),
  ('81000000-0000-0000-0000-000000000002'::uuid, 'account-admin-two@example.invalid'),
  ('81000000-0000-0000-0000-000000000003'::uuid, 'account-president@example.invalid'),
  ('81000000-0000-0000-0000-000000000004'::uuid, 'account-member@example.invalid')
) x(auth_id, email);

insert into public.application_users (id, auth_user_id, status)
values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'active'),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'deactivated'),
  ('82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000003', 'active'),
  ('82000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000004', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('82000000-0000-0000-0000-000000000001'::uuid, 'system_admin'),
  ('82000000-0000-0000-0000-000000000002'::uuid, 'system_admin'),
  ('82000000-0000-0000-0000-000000000003'::uuid, 'president'),
  ('82000000-0000-0000-0000-000000000004'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon', 'public.change_account_role(uuid,text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.change_account_status(uuid,text)', 'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute trusted account mutations';
  end if;
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- A sole active System Admin cannot demote or deactivate itself.
do $$
begin
  begin
    perform public.change_account_role(
      '82000000-0000-0000-0000-000000000001', 'finance'
    );
    raise exception 'FAIL: sole active System Admin was demoted';
  exception when others then
    if sqlerrm not like '%last_system_admin%' then raise; end if;
  end;

  begin
    perform public.change_account_status(
      '82000000-0000-0000-0000-000000000001', 'deactivated'
    );
    raise exception 'FAIL: sole active System Admin was deactivated';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;

-- Re-applying deactivated status to an inactive System Admin is allowed even
-- when exactly one other active System Admin remains.
select public.change_account_status(
  '82000000-0000-0000-0000-000000000002', 'deactivated'
);

reset role;
update public.application_users
set status = 'active'
where id = '82000000-0000-0000-0000-000000000002';
set local role authenticated;

-- With two active System Admins, one may be deactivated.
select public.change_account_status(
  '82000000-0000-0000-0000-000000000002', 'deactivated'
);

do $$
begin
  if (select status from public.application_users
      where id = '82000000-0000-0000-0000-000000000002') <> 'deactivated' then
    raise exception 'FAIL: second System Admin was not deactivated';
  end if;
  if not exists (
    select 1 from public.account_security_events
    where actor_application_user_id = '82000000-0000-0000-0000-000000000001'
      and target_application_user_id = '82000000-0000-0000-0000-000000000002'
      and event_type = 'account.deactivated'
  ) then
    raise exception 'FAIL: successful status mutation was not audited';
  end if;
end $$;

-- Demoting that already-deactivated System Admin must not be blocked by the
-- active-admin invariant now that exactly one other active admin remains.
select public.change_account_role(
  '82000000-0000-0000-0000-000000000002', 'finance'
);

do $$
begin
  if (select r.key
      from public.application_user_roles aur
      join public.roles r on r.id = aur.role_id
      where aur.application_user_id = '82000000-0000-0000-0000-000000000002') <> 'finance' then
    raise exception 'FAIL: second System Admin was not demoted';
  end if;
  if not exists (
    select 1 from public.account_security_events
    where actor_application_user_id = '82000000-0000-0000-0000-000000000001'
      and target_application_user_id = '82000000-0000-0000-0000-000000000002'
      and event_type = 'role.changed'
      and metadata ->> 'role' = 'finance'
  ) then
    raise exception 'FAIL: successful role mutation was not audited';
  end if;
end $$;

-- The remaining System Admin is protected after the successful demotion.
do $$
begin
  begin
    perform public.change_account_role(
      '82000000-0000-0000-0000-000000000001', 'finance'
    );
    raise exception 'FAIL: remaining System Admin was demoted';
  exception when others then
    if sqlerrm not like '%last_system_admin%' then raise; end if;
  end;
end $$;

-- President cannot manage a System Admin, and denial does not mutate/audit.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
declare v_events bigint;
begin
  select count(*) into v_events from public.account_security_events;
  begin
    perform public.change_account_status(
      '82000000-0000-0000-0000-000000000001', 'deactivated'
    );
    raise exception 'FAIL: President managed a System Admin';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
  if (select status from public.application_users
      where id = '82000000-0000-0000-0000-000000000001') <> 'active'
     or (select count(*) from public.account_security_events) <> v_events then
    raise exception 'FAIL: denied President operation changed state or audit';
  end if;
end $$;

-- An ordinary Member cannot invoke either mutation.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.change_account_role(
      '82000000-0000-0000-0000-000000000003', 'secretary'
    );
    raise exception 'FAIL: Member changed an account role';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
  begin
    perform public.change_account_status(
      '82000000-0000-0000-0000-000000000003', 'deactivated'
    );
    raise exception 'FAIL: Member changed an account status';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;

-- Both functions must acquire the same advisory lock before mutation.
do $$
declare
  v_role_definition text := pg_catalog.pg_get_functiondef(
    'public.change_account_role(uuid,text)'::regprocedure
  );
  v_status_definition text := pg_catalog.pg_get_functiondef(
    'public.change_account_status(uuid,text)'::regprocedure
  );
begin
  if pg_catalog.strpos(v_role_definition, 'pg_advisory_xact_lock(1296387405, 1)') = 0
     or pg_catalog.strpos(v_status_definition, 'pg_advisory_xact_lock(1296387405, 1)') = 0
     or pg_catalog.strpos(v_role_definition, 'pg_advisory_xact_lock(1296387405, 1)')
        > pg_catalog.strpos(v_role_definition, 'update public.application_user_roles')
     or pg_catalog.strpos(v_status_definition, 'pg_advisory_xact_lock(1296387405, 1)')
        > pg_catalog.strpos(v_status_definition, 'update public.application_users') then
    raise exception 'FAIL: trusted account mutations do not share lock-first ordering';
  end if;
end $$;

rollback;
