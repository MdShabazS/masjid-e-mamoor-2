\set ON_ERROR_STOP on

begin;

do $$
declare
  v_rls boolean;
  v_public_execute boolean;
  v_security_definer boolean;
  v_config text[];
begin
  select c.relrowsecurity
  into v_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'mobile_release_policies';

  if v_rls is distinct from true then
    raise exception 'FAIL: mobile_release_policies RLS is not enabled';
  end if;

  if not pg_catalog.has_table_privilege(
    'anon',
    'public.mobile_release_policies',
    'SELECT'
  ) then
    raise exception 'FAIL: anon cannot read release policy';
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated',
    'public.mobile_release_policies',
    'SELECT'
  ) then
    raise exception 'FAIL: authenticated cannot read release policy';
  end if;

  if pg_catalog.has_table_privilege(
    'anon',
    'public.mobile_release_policies',
    'INSERT, UPDATE, DELETE'
  ) then
    raise exception 'FAIL: anon has release-policy mutation privileges';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.mobile_release_policies',
    'INSERT, UPDATE, DELETE'
  ) then
    raise exception 'FAIL: authenticated has release-policy mutation privileges';
  end if;

  select p.prosecdef, p.proconfig
  into v_security_definer, v_config
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_mobile_release_status'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_platform text, p_current_version text';

  if not found then
    raise exception 'FAIL: get_mobile_release_status(text,text) not found';
  end if;

  if v_security_definer then
    raise exception 'FAIL: release status RPC unexpectedly uses SECURITY DEFINER';
  end if;

  if not (
    'search_path=pg_catalog' = any(coalesce(v_config, '{}'::text[]))
  ) then
    raise exception 'FAIL: release status RPC search_path is not pinned';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        p.proacl,
        pg_catalog.acldefault('f', p.proowner)
      )
    ) acl
    where n.nspname = 'public'
      and p.proname = 'get_mobile_release_status'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'p_platform text, p_current_version text'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  )
  into v_public_execute;

  if v_public_execute then
    raise exception 'FAIL: PUBLIC can execute release status RPC';
  end if;

  if not pg_catalog.has_function_privilege(
    'anon',
    'public.get_mobile_release_status(text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon cannot execute release status RPC';
  end if;

  if not pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_mobile_release_status(text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated cannot execute release status RPC';
  end if;
end
$$;

do $$
begin
  if (
    select count(*)
    from public.mobile_release_policies
    where platform in ('android', 'ios')
      and latest_version = '1.0.0'
      and minimum_supported_version = '1.0.0'
  ) <> 2 then
    raise exception 'FAIL: seeded release policies are incorrect';
  end if;

  begin
    update public.mobile_release_policies
    set latest_version = '1.0.0',
        minimum_supported_version = '1.0.1'
    where platform = 'android';

    raise exception 'FAIL: minimum version exceeded latest version';
  exception when check_violation then
    null;
  end;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_status record;
begin
  select *
  into v_status
  from public.get_mobile_release_status('android', '1.0.0');

  if v_status.update_status <> 'none'
     or v_status.latest_version <> '1.0.0'
     or v_status.minimum_supported_version <> '1.0.0' then
    raise exception 'FAIL: current Android version did not resolve to none';
  end if;

  if (select count(*) from public.mobile_release_policies) <> 2 then
    raise exception 'FAIL: anon cannot read both public release policies';
  end if;

  begin
    update public.mobile_release_policies
    set latest_version = '9.9.9'
    where platform = 'android';

    raise exception 'FAIL: anon directly updated release policy';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.get_mobile_release_status('windows', '1.0.0');
    raise exception 'FAIL: invalid platform was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  begin
    perform public.get_mobile_release_status('android', '1.0');
    raise exception 'FAIL: invalid current version was accepted';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

reset role;

update public.mobile_release_policies
set latest_version = '1.1.0',
    minimum_supported_version = '1.0.0',
    store_url = 'https://example.invalid/masjid-e-mamoor-2'
where platform = 'android';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_status record;
begin
  select *
  into v_status
  from public.get_mobile_release_status('android', '1.0.0');

  if v_status.update_status <> 'optional'
     or v_status.latest_version <> '1.1.0'
     or v_status.minimum_supported_version <> '1.0.0' then
    raise exception 'FAIL: optional update decision is incorrect';
  end if;

  select *
  into v_status
  from public.get_mobile_release_status('android', '0.9.9');

  if v_status.update_status <> 'required' then
    raise exception 'FAIL: required update decision is incorrect';
  end if;

  select *
  into v_status
  from public.get_mobile_release_status('android', '1.1.0');

  if v_status.update_status <> 'none' then
    raise exception 'FAIL: latest version did not resolve to none';
  end if;

  select *
  into v_status
  from public.get_mobile_release_status('android', '2.0.0');

  if v_status.update_status <> 'none' then
    raise exception 'FAIL: newer client version did not resolve to none';
  end if;
end
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_status record;
begin
  select *
  into v_status
  from public.get_mobile_release_status('ios', '1.0.0');

  if v_status.update_status <> 'none' then
    raise exception 'FAIL: authenticated iOS release status is incorrect';
  end if;

  begin
    delete from public.mobile_release_policies
    where platform = 'ios';

    raise exception 'FAIL: authenticated directly deleted release policy';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

reset role;

rollback;
