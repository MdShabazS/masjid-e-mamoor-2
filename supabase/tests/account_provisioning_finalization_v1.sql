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
  ('91000000-0000-0000-0000-000000000001'::uuid, 'finalize-admin@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000002'::uuid, 'finalize-president@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000003'::uuid, 'finalize-member@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000010'::uuid, 'finalize-secretary@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000011'::uuid, 'finalize-new-member@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000012'::uuid, 'finalize-rollback@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000013'::uuid, 'finalize-president-role@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000014'::uuid, 'finalize-forbidden-one@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000015'::uuid, 'finalize-forbidden-two@auth.masjid.local'),
  ('91000000-0000-0000-0000-000000000016'::uuid, 'finalize-unauthorized@auth.masjid.local')
) x(auth_id, email);

insert into public.application_users (id, auth_user_id, status)
values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'active'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'active'),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('92000000-0000-0000-0000-000000000001'::uuid, 'system_admin'),
  ('92000000-0000-0000-0000-000000000002'::uuid, 'president'),
  ('92000000-0000-0000-0000-000000000003'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon',
    'public.finalize_account_provisioning(uuid,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute account finalization';
  end if;
end $$;

-- President may create an allowed non-member account.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select public.finalize_account_provisioning(
  '91000000-0000-0000-0000-000000000010',
  'finalize-secretary@auth.masjid.local',
  'finalize.secretary',
  'finalize.secretary',
  'Finalized Secretary',
  'secretary',
  null
);
reset role;

do $$
declare v_account_id uuid;
begin
  select id into v_account_id from public.application_users
  where auth_user_id = '91000000-0000-0000-0000-000000000010';
  if (select count(*) from public.application_user_roles
      where application_user_id = v_account_id) <> 1 then
    raise exception 'FAIL: non-member did not receive exactly one role';
  end if;
  if exists (select 1 from public.member_profiles
             where application_user_id = v_account_id) then
    raise exception 'FAIL: non-member received a member profile';
  end if;
  if not exists (
    select 1 from public.account_security_events
    where target_application_user_id = v_account_id
      and event_type = 'account.created'
      and metadata ->> 'role' = 'secretary'
  ) then
    raise exception 'FAIL: non-member account creation was not audited';
  end if;
end $$;

-- Member finalization creates one complete database aggregate.
set local role authenticated;
select public.finalize_account_provisioning(
  '91000000-0000-0000-0000-000000000011',
  'finalize-new-member@auth.masjid.local',
  'finalize.member',
  'finalize.member',
  'Finalized Member',
  'member',
  '+919999999991'
);

-- Matching replay returns the same identity without duplicate rows.
select public.finalize_account_provisioning(
  '91000000-0000-0000-0000-000000000011',
  'finalize-new-member@auth.masjid.local',
  'finalize.member',
  'finalize.member',
  'Finalized Member',
  'member',
  '+919999999991'
);
reset role;

do $$
declare v_account_id uuid;
begin
  select id into v_account_id from public.application_users
  where auth_user_id = '91000000-0000-0000-0000-000000000011';
  if (select count(*) from public.application_user_roles
      where application_user_id = v_account_id) <> 1
     or (select count(*) from public.member_profiles
         where application_user_id = v_account_id) <> 1
     or (select count(*) from public.account_security_events
         where target_application_user_id = v_account_id
           and event_type = 'account.created') <> 1 then
    raise exception 'FAIL: idempotent replay duplicated aggregate rows';
  end if;
end $$;

-- A conflicting replay is rejected without overwriting the account.
set local role authenticated;
do $$
begin
  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000011',
      'finalize-new-member@auth.masjid.local',
      'finalize.member',
      'finalize.member',
      'Different Name',
      'member',
      '+919999999991'
    );
    raise exception 'FAIL: conflicting finalization replay succeeded';
  exception when others then
    if sqlerrm not like '%account_create_conflict%' then raise; end if;
  end;
end $$;
reset role;

-- Inject an audit failure and prove the application user, role, and profile
-- all roll back with it.
create function public.test_fail_account_finalization_audit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.application_users au
    where au.id = new.target_application_user_id
      and au.username_normalized = 'rollback.member'
  ) then
    raise exception 'injected_account_audit_failure';
  end if;
  return new;
end;
$$;

create trigger test_fail_account_finalization_audit
before insert on public.account_security_events
for each row execute function public.test_fail_account_finalization_audit();

set local role authenticated;
do $$
begin
  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000012',
      'finalize-rollback@auth.masjid.local',
      'rollback.member',
      'rollback.member',
      'Rollback Member',
      'member',
      '+919999999992'
    );
    raise exception 'FAIL: injected database failure did not fail finalization';
  exception when others then
    if sqlerrm not like '%injected_account_audit_failure%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if exists (select 1 from public.application_users
             where auth_user_id = '91000000-0000-0000-0000-000000000012')
     or exists (
       select 1 from public.application_user_roles aur
       join public.application_users au on au.id = aur.application_user_id
       where au.auth_user_id = '91000000-0000-0000-0000-000000000012'
     )
     or exists (
       select 1 from public.member_profiles mp
       join public.application_users au on au.id = mp.application_user_id
       where au.auth_user_id = '91000000-0000-0000-0000-000000000012'
     ) then
    raise exception 'FAIL: failed finalization left partial database state';
  end if;
end $$;

drop trigger test_fail_account_finalization_audit
on public.account_security_events;
drop function public.test_fail_account_finalization_audit();

-- President and System Admin cannot provision System Admin through this RPC.
set local role authenticated;
do $$
begin
  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000013',
      'finalize-president-role@auth.masjid.local',
      'forbidden.president', 'forbidden.president', 'Forbidden President',
      'president', null
    );
    raise exception 'FAIL: President provisioned another President';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;

  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000014',
      'finalize-forbidden-one@auth.masjid.local',
      'forbidden.one', 'forbidden.one', 'Forbidden One',
      'system_admin', null
    );
    raise exception 'FAIL: President provisioned System Admin';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- System Admin retains the existing ability to provision President.
select public.finalize_account_provisioning(
  '91000000-0000-0000-0000-000000000013',
  'finalize-president-role@auth.masjid.local',
  'finalized.president', 'finalized.president', 'Finalized President',
  'president', null
);

do $$
begin
  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000015',
      'finalize-forbidden-two@auth.masjid.local',
      'forbidden.two', 'forbidden.two', 'Forbidden Two',
      'system_admin', null
    );
    raise exception 'FAIL: System Admin provisioned System Admin';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;

-- An ordinary Member cannot finalize an account.
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.finalize_account_provisioning(
      '91000000-0000-0000-0000-000000000016',
      'finalize-unauthorized@auth.masjid.local',
      'unauthorized.user', 'unauthorized.user', 'Unauthorized User',
      'member', null
    );
    raise exception 'FAIL: unauthorized Member finalized an account';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;

rollback;
