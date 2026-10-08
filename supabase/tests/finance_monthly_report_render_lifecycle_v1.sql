\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_constraint_count integer;
begin
  if (
    select count(*)
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'finance_monthly_reports'
      and a.attname in (
        'render_claim_token',
        'render_lease_expires_at'
      )
      and not a.attisdropped
  ) <> 2 then
    raise exception 'FAIL: render lifecycle columns are missing';
  end if;

  select count(*)
  into v_constraint_count
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_monthly_reports'
    and con.conname in (
      'finance_monthly_reports_render_claim_pair_chk',
      'finance_monthly_reports_terminal_claim_chk',
      'finance_monthly_reports_render_lease_chk'
    );

  if v_constraint_count <> 3 then
    raise exception 'FAIL: render lifecycle constraints are missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.claim_finance_monthly_report_render(uuid)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.complete_finance_monthly_report_render(uuid,uuid,text,bigint)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.fail_finance_monthly_report_render(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'FAIL: anon can execute a render bridge RPC';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_finance_monthly_report_render(uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.complete_finance_monthly_report_render(uuid,uuid,text,bigint)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.fail_finance_monthly_report_render(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'FAIL: authenticated can execute a render bridge RPC';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_finance_monthly_report_render(uuid)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.complete_finance_monthly_report_render(uuid,uuid,text,bigint)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.fail_finance_monthly_report_render(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'FAIL: service_role lacks render bridge execute';
  end if;

  if has_table_privilege(
    'service_role',
    'public.finance_monthly_reports',
    'select'
  ) or has_table_privilege(
    'service_role',
    'public.finance_monthly_reports',
    'insert'
  ) or has_table_privilege(
    'service_role',
    'public.finance_monthly_reports',
    'update'
  ) or has_table_privilege(
    'service_role',
    'public.finance_monthly_reports',
    'delete'
  ) then
    raise exception 'FAIL: service_role has direct report-table access';
  end if;

  if has_table_privilege(
    'service_role',
    'private.finance_monthly_report_snapshots',
    'select'
  ) then
    raise exception 'FAIL: service_role can select private snapshots';
  end if;

  if has_schema_privilege(
    'service_role',
    'private',
    'usage'
  ) then
    raise exception 'FAIL: service_role has private schema usage';
  end if;

  if has_function_privilege(
    'service_role',
    'private.build_finance_monthly_report_snapshot(date,text)',
    'execute'
  ) then
    raise exception 'FAIL: service_role can execute private snapshot builder';
  end if;
end
$test$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated"}',
  true
);

do $test$
begin
  begin
    perform public.claim_finance_monthly_report_render(
      '7b2b0000-0000-0000-0000-000000000099'::uuid
    );
    raise exception 'FAIL: owner bypassed runtime service-role assertion';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_authorized' then
        raise;
      end if;
  end;
end
$test$;

create temporary table render_lifecycle_test_state (
  name text primary key,
  report_id uuid not null,
  revision integer not null,
  snapshot_sha256 text not null,
  snapshot jsonb not null,
  first_token uuid,
  current_token uuid
) on commit drop;

do $test$
declare
  v_report public.finance_monthly_reports;
  v_snapshot jsonb;
begin
  v_report := private.build_finance_monthly_report_snapshot(
    date '2041-01-01',
    'scheduled'
  );

  select s.snapshot
  into strict v_snapshot
  from private.finance_monthly_report_snapshots s
  where s.report_id = v_report.id;

  insert into render_lifecycle_test_state (
    name,
    report_id,
    revision,
    snapshot_sha256,
    snapshot
  )
  values (
    'primary',
    v_report.id,
    v_report.revision,
    v_report.snapshot_sha256,
    v_snapshot
  );

  v_report := private.build_finance_monthly_report_snapshot(
    date '2041-02-01',
    'scheduled'
  );

  select s.snapshot
  into strict v_snapshot
  from private.finance_monthly_report_snapshots s
  where s.report_id = v_report.id;

  insert into render_lifecycle_test_state (
    name,
    report_id,
    revision,
    snapshot_sha256,
    snapshot
  )
  values (
    'failure',
    v_report.id,
    v_report.revision,
    v_report.snapshot_sha256,
    v_snapshot
  );
end
$test$;

grant select, update
on render_lifecycle_test_state
to service_role;

select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
set local role service_role;

do $test$
declare
  v_claim record;
  v_expected record;
  v_busy record;
begin
  select *
  into v_expected
  from render_lifecycle_test_state
  where name = 'primary';

  select *
  into v_claim
  from public.claim_finance_monthly_report_render(
    v_expected.report_id
  );

  if v_claim.claim_status <> 'claimed'
     or v_claim.report_id <> v_expected.report_id
     or v_claim.render_token is null
     or v_claim.lease_expires_at <= now()
     or v_claim.attempt_count <> 1 then
    raise exception 'FAIL: first render claim is incorrect';
  end if;

  if v_claim.snapshot_sha256 <> v_expected.snapshot_sha256
     or v_claim.snapshot is distinct from v_expected.snapshot then
    raise exception 'FAIL: first claim returned incorrect snapshot';
  end if;

  update render_lifecycle_test_state
  set
    first_token = v_claim.render_token,
    current_token = v_claim.render_token
  where name = 'primary';

  select *
  into v_busy
  from public.claim_finance_monthly_report_render(
    v_expected.report_id
  );

  if v_busy.claim_status <> 'busy'
     or v_busy.render_token is not null
     or v_busy.lease_expires_at is not null
     or v_busy.snapshot is not null
     or v_busy.attempt_count <> 1 then
    raise exception 'FAIL: busy claim leaked renderer state';
  end if;
end
$test$;

reset role;

update public.finance_monthly_reports r
set
  last_attempt_at = now() - interval '11 minutes',
  render_lease_expires_at = now() - interval '1 minute'
where r.id = (
  select report_id
  from render_lifecycle_test_state
  where name = 'primary'
);

set local role service_role;

do $test$
declare
  v_claim record;
  v_state record;
begin
  select *
  into v_state
  from render_lifecycle_test_state
  where name = 'primary';

  select *
  into v_claim
  from public.claim_finance_monthly_report_render(
    v_state.report_id
  );

  if v_claim.claim_status <> 'claimed'
     or v_claim.render_token is null
     or v_claim.render_token = v_state.first_token
     or v_claim.attempt_count <> 2
     or v_claim.snapshot is distinct from v_state.snapshot then
    raise exception 'FAIL: expired claim was not reclaimed safely';
  end if;

  update render_lifecycle_test_state
  set current_token = v_claim.render_token
  where name = 'primary';

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_state.first_token,
      repeat('a', 64),
      1024
    );
    raise exception 'FAIL: stale token completed report';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_claim.render_token,
      repeat('A', 64),
      1024
    );
    raise exception 'FAIL: uppercase file hash accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_claim.render_token,
      repeat('a', 64),
      20971521
    );
    raise exception 'FAIL: oversized PDF accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_claim.render_token,
      repeat('a', 64),
      1024
    );
    raise exception 'FAIL: completion without Storage object succeeded';
  exception
    when no_data_found then null;
  end;
end
$test$;

reset role;

insert into storage.objects (
  bucket_id,
  name,
  metadata
)
select
  r.storage_bucket,
  r.storage_object_path,
  '{}'::jsonb
from public.finance_monthly_reports r
where r.id = (
  select report_id
  from render_lifecycle_test_state
  where name = 'primary'
);

set local role service_role;

do $test$
declare
  v_ready public.finance_monthly_reports;
  v_claim record;
  v_state record;
begin
  select *
  into v_state
  from render_lifecycle_test_state
  where name = 'primary';

  select *
  into v_ready
  from public.complete_finance_monthly_report_render(
    v_state.report_id,
    v_state.current_token,
    repeat('a', 64),
    1024
  );

  if v_ready.status <> 'ready'
     or v_ready.file_sha256 <> repeat('a', 64)
     or v_ready.file_size_bytes <> 1024
     or v_ready.generated_at is null
     or v_ready.last_error_code is not null
     or v_ready.render_claim_token is not null
     or v_ready.render_lease_expires_at is not null
     or v_ready.revision <> v_state.revision
     or v_ready.snapshot_sha256 <> v_state.snapshot_sha256 then
    raise exception 'FAIL: valid render completion is incorrect';
  end if;

  select *
  into v_claim
  from public.claim_finance_monthly_report_render(
    v_state.report_id
  );

  if v_claim.claim_status <> 'ready'
     or v_claim.render_token is not null
     or v_claim.lease_expires_at is not null
     or v_claim.snapshot is not null then
    raise exception 'FAIL: ready claim exposed private render data';
  end if;

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_state.current_token,
      repeat('b', 64),
      2048
    );
    raise exception 'FAIL: ready report was rewritten';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end
$test$;

reset role;

do $test$
declare
  v_report_id uuid;
begin
  select report_id
  into v_report_id
  from render_lifecycle_test_state
  where name = 'primary';

  begin
    update public.finance_monthly_reports
    set
      render_claim_token = gen_random_uuid(),
      render_lease_expires_at = now() + interval '10 minutes'
    where id = v_report_id;
    raise exception 'FAIL: ready report retained a render claim';
  exception
    when check_violation then null;
  end;
end
$test$;

set local role service_role;

do $test$
declare
  v_claim record;
  v_failed public.finance_monthly_reports;
  v_retry record;
  v_state record;
begin
  select *
  into v_state
  from render_lifecycle_test_state
  where name = 'failure';

  select *
  into v_claim
  from public.claim_finance_monthly_report_render(
    v_state.report_id
  );

  update render_lifecycle_test_state
  set
    first_token = v_claim.render_token,
    current_token = v_claim.render_token
  where name = 'failure';

  begin
    perform public.fail_finance_monthly_report_render(
      v_state.report_id,
      v_claim.render_token,
      'INVALID ERROR'
    );
    raise exception 'FAIL: invalid error code accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.fail_finance_monthly_report_render(
      v_state.report_id,
      v_claim.render_token,
      repeat('a', 101)
    );
    raise exception 'FAIL: oversized error code accepted';
  exception
    when invalid_parameter_value then null;
  end;

  select *
  into v_failed
  from public.fail_finance_monthly_report_render(
    v_state.report_id,
    v_claim.render_token,
    'renderer:failed-1'
  );

  if v_failed.status <> 'failed'
     or v_failed.last_error_code <> 'renderer:failed-1'
     or v_failed.attempt_count <> 1
     or v_failed.render_claim_token is not null
     or v_failed.render_lease_expires_at is not null
     or v_failed.revision <> v_state.revision
     or v_failed.snapshot_sha256 <> v_state.snapshot_sha256 then
    raise exception 'FAIL: failed render transition is incorrect';
  end if;

  select *
  into v_retry
  from public.claim_finance_monthly_report_render(
    v_state.report_id
  );

  if v_retry.claim_status <> 'claimed'
     or v_retry.report_id <> v_state.report_id
     or v_retry.attempt_count <> 2
     or v_retry.render_token is null
     or v_retry.render_token = v_claim.render_token
     or v_retry.snapshot is distinct from v_state.snapshot then
    raise exception 'FAIL: failed report retry is incorrect';
  end if;

  update render_lifecycle_test_state
  set current_token = v_retry.render_token
  where name = 'failure';
end
$test$;

reset role;

update public.finance_monthly_reports r
set
  last_attempt_at = now() - interval '11 minutes',
  render_lease_expires_at = now() - interval '1 minute'
where r.id = (
  select report_id
  from render_lifecycle_test_state
  where name = 'failure'
);

set local role service_role;

do $test$
declare
  v_state record;
begin
  select *
  into v_state
  from render_lifecycle_test_state
  where name = 'failure';

  begin
    perform public.fail_finance_monthly_report_render(
      v_state.report_id,
      v_state.current_token,
      'expired_claim'
    );
    raise exception 'FAIL: expired claim failed report';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    perform public.complete_finance_monthly_report_render(
      v_state.report_id,
      v_state.current_token,
      repeat('c', 64),
      1024
    );
    raise exception 'FAIL: expired claim completed report';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end
$test$;

reset role;

rollback;

\echo 'finance_monthly_report_render_lifecycle_v1: PASS (35 assertions)'
