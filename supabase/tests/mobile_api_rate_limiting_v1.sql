begin;

do $$
declare
  v_signature text :=
    'public.consume_mobile_api_rate_limit(text,text,integer,integer)';
  v_result record;
  v_subject text :=
    repeat('a', 64);
begin
  if has_function_privilege(
    'anon',
    v_signature,
    'EXECUTE'
  ) then
    raise exception
      'anon must not execute mobile API limiter';
  end if;

  if has_function_privilege(
    'authenticated',
    v_signature,
    'EXECUTE'
  ) then
    raise exception
      'authenticated must not execute mobile API limiter';
  end if;

  if not has_function_privilege(
    'service_role',
    v_signature,
    'EXECUTE'
  ) then
    raise exception
      'service_role must execute mobile API limiter';
  end if;

  if has_table_privilege(
    'anon',
    'private.mobile_api_rate_limit_counters',
    'SELECT'
  ) then
    raise exception
      'anon must not read limiter counters';
  end if;

  if has_table_privilege(
    'authenticated',
    'private.mobile_api_rate_limit_counters',
    'SELECT'
  ) then
    raise exception
      'authenticated must not read limiter counters';
  end if;

  delete
  from private.mobile_api_rate_limit_counters
  where bucket = 'security-test'
    and subject_hash = v_subject;

  select *
  into v_result
  from public.consume_mobile_api_rate_limit(
    'security-test',
    v_subject,
    2,
    60
  );

  if v_result.allowed is distinct from true
     or v_result.remaining <> 1
     or v_result.retry_after_seconds <> 0 then
    raise exception
      'unexpected first limiter result: %',
      row_to_json(v_result);
  end if;

  select *
  into v_result
  from public.consume_mobile_api_rate_limit(
    'security-test',
    v_subject,
    2,
    60
  );

  if v_result.allowed is distinct from true
     or v_result.remaining <> 0
     or v_result.retry_after_seconds <> 0 then
    raise exception
      'unexpected second limiter result: %',
      row_to_json(v_result);
  end if;

  select *
  into v_result
  from public.consume_mobile_api_rate_limit(
    'security-test',
    v_subject,
    2,
    60
  );

  if v_result.allowed is distinct from false
     or v_result.remaining <> 0
     or v_result.retry_after_seconds < 1
     or v_result.retry_after_seconds > 60 then
    raise exception
      'unexpected denied limiter result: %',
      row_to_json(v_result);
  end if;

  update private.mobile_api_rate_limit_counters
  set window_started_at =
    clock_timestamp() - interval '61 seconds'
  where bucket = 'security-test'
    and subject_hash = v_subject;

  select *
  into v_result
  from public.consume_mobile_api_rate_limit(
    'security-test',
    v_subject,
    2,
    60
  );

  if v_result.allowed is distinct from true
     or v_result.remaining <> 1
     or v_result.retry_after_seconds <> 0 then
    raise exception
      'expired window did not reset: %',
      row_to_json(v_result);
  end if;

  begin
    perform public.consume_mobile_api_rate_limit(
      'security-test',
      'not-a-sha256',
      2,
      60
    );

    raise exception
      'invalid hash unexpectedly accepted';

  exception
    when sqlstate '22023' then
      null;
  end;
end
$$;

rollback;
