begin;

\echo '============================================'
\echo ' COMMITTEE MEETINGS V1 TEST'
\echo '============================================'

do $$
begin
  if to_regclass(
    'public.committee_meetings'
  ) is null then
    raise exception 'FAIL: committee_meetings missing';
  end if;

  if to_regclass(
    'public.committee_meeting_participants'
  ) is null then
    raise exception
      'FAIL: committee_meeting_participants missing';
  end if;

  if to_regclass(
    'public.committee_meeting_attendance'
  ) is null then
    raise exception
      'FAIL: committee_meeting_attendance missing';
  end if;

  if to_regclass(
    'public.committee_meeting_activity'
  ) is null then
    raise exception
      'FAIL: committee_meeting_activity missing';
  end if;
end;
$$;

-- Validate exact RPC presence.
do $$
begin
  if to_regprocedure(
    'public.create_committee_meeting(text,text,text,text,timestamptz,timestamptz,uuid[],text)'
  ) is null then
    raise exception 'FAIL: create meeting RPC missing';
  end if;

  if to_regprocedure(
    'public.list_committee_meetings(integer,integer)'
  ) is null then
    raise exception 'FAIL: list meetings RPC missing';
  end if;

  if to_regprocedure(
    'public.get_committee_meeting(uuid)'
  ) is null then
    raise exception 'FAIL: get meeting RPC missing';
  end if;

  if to_regprocedure(
    'public.update_committee_meeting(uuid,text,text,text,text,timestamptz,timestamptz,uuid[],text)'
  ) is null then
    raise exception 'FAIL: update meeting RPC missing';
  end if;

  if to_regprocedure(
    'public.cancel_committee_meeting(uuid,text,text)'
  ) is null then
    raise exception 'FAIL: cancel meeting RPC missing';
  end if;

  if to_regprocedure(
    'public.record_committee_meeting_attendance(uuid,uuid,text,text)'
  ) is null then
    raise exception
      'FAIL: attendance RPC missing';
  end if;
end;
$$;

-- RPC privilege surface: authenticated only.
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.create_committee_meeting(text,text,text,text,timestamptz,timestamptz,uuid[],text)',
    'public.list_committee_meetings(integer,integer)',
    'public.get_committee_meeting(uuid)',
    'public.update_committee_meeting(uuid,text,text,text,text,timestamptz,timestamptz,uuid[],text)',
    'public.cancel_committee_meeting(uuid,text,text)',
    'public.record_committee_meeting_attendance(uuid,uuid,text,text)'
  ]
  loop
    if has_function_privilege(
      'anon',
      v_signature,
      'EXECUTE'
    ) then
      raise exception
        'FAIL: anon can execute %',
        v_signature;
    end if;

    if not has_function_privilege(
      'authenticated',
      v_signature,
      'EXECUTE'
    ) then
      raise exception
        'FAIL: authenticated cannot execute %',
        v_signature;
    end if;

    if has_function_privilege(
      'service_role',
      v_signature,
      'EXECUTE'
    ) then
      raise exception
        'FAIL: service_role can execute %',
        v_signature;
    end if;
  end loop;
end;
$$;

-- Structural duplicate prevention.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.committee_meeting_participants'::regclass
      and contype = 'u'
  ) then
    raise exception
      'FAIL: participant uniqueness missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.committee_meeting_attendance'::regclass
      and contype = 'u'
  ) then
    raise exception
      'FAIL: attendance uniqueness missing';
  end if;
end;
$$;

-- RLS must remain enabled.
do $$
declare
  v_rel text;
begin
  foreach v_rel in array array[
    'committee_meetings',
    'committee_meeting_participants',
    'committee_meeting_attendance',
    'committee_meeting_activity'
  ]
  loop
    if not exists (
      select 1
      from pg_class
      where oid = (
        'public.' || v_rel
      )::regclass
        and relrowsecurity
    ) then
      raise exception
        'FAIL: RLS disabled for %',
        v_rel;
    end if;
  end loop;
end;
$$;

\echo 'PASS: Meeting V1 schema/RPC/RLS foundations verified'

rollback;
