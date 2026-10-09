\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' GET COMMITTEE MEETING ATTENDANCE V1 TEST'
\echo '============================================'


-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
select
  fixture.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  now(),
  now(),
  now()
from (values
  (
    'd1100000-0000-0000-0000-000000000001'::uuid,
    'attendance-query-president@example.invalid'
  ),
  (
    'd1100000-0000-0000-0000-000000000002'::uuid,
    'attendance-query-auditor@example.invalid'
  ),
  (
    'd1100000-0000-0000-0000-000000000003'::uuid,
    'attendance-query-committee-a@example.invalid'
  ),
  (
    'd1100000-0000-0000-0000-000000000004'::uuid,
    'attendance-query-committee-b@example.invalid'
  ),
  (
    'd1100000-0000-0000-0000-000000000005'::uuid,
    'attendance-query-finance@example.invalid'
  ),
  (
    'd1100000-0000-0000-0000-000000000006'::uuid,
    'attendance-query-member@example.invalid'
  )
) fixture(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    'd1200000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'd1200000-0000-0000-0000-000000000002',
    'd1100000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    'd1200000-0000-0000-0000-000000000003',
    'd1100000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    'd1200000-0000-0000-0000-000000000004',
    'd1100000-0000-0000-0000-000000000004',
    'active'
  ),
  (
    'd1200000-0000-0000-0000-000000000005',
    'd1100000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    'd1200000-0000-0000-0000-000000000006',
    'd1100000-0000-0000-0000-000000000006',
    'active'
  );


insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  fixture.application_user_id,
  r.id
from (values
  (
    'd1200000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    'd1200000-0000-0000-0000-000000000002'::uuid,
    'auditor'
  ),
  (
    'd1200000-0000-0000-0000-000000000003'::uuid,
    'committee_member'
  ),
  (
    'd1200000-0000-0000-0000-000000000004'::uuid,
    'committee_member'
  ),
  (
    'd1200000-0000-0000-0000-000000000005'::uuid,
    'finance'
  ),
  (
    'd1200000-0000-0000-0000-000000000006'::uuid,
    'member'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- President creates meeting.
-- Auditor + Committee A are participants.
-- Committee B remains unrelated.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select id as attendance_meeting_id
from public.create_committee_meeting(
  p_title :=
    'Attendance query contract meeting',

  p_meeting_type :=
    'general',

  p_details :=
    'Verify explicit attendance query authorization',

  p_location :=
    'Committee room',

  p_scheduled_start :=
    now() + interval '1 day',

  p_scheduled_end :=
    now() + interval '1 day 1 hour',

  p_participant_ids :=
    array[
      'd1200000-0000-0000-0000-000000000002'::uuid,
      'd1200000-0000-0000-0000-000000000003'::uuid
    ],

  p_operation_id :=
    'attendance-query-meeting-create'
)
\gset


select set_config(
  'test.attendance_meeting_id',
  :'attendance_meeting_id',
  true
);


-- Record authoritative attendance through the existing command.
select public.record_committee_meeting_attendance(
  :'attendance_meeting_id'::uuid,
  'd1200000-0000-0000-0000-000000000002'::uuid,
  'present',
  'attendance-query-auditor-present'
);

select public.record_committee_meeting_attendance(
  :'attendance_meeting_id'::uuid,
  'd1200000-0000-0000-0000-000000000003'::uuid,
  'absent',
  'attendance-query-committee-a-absent'
);


-- ============================================================
-- President organization-wide read
-- ============================================================

do $$
begin
  if (
    select count(*)
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    )
  ) <> 2 then

    raise exception
      'FAIL: President attendance query returned wrong count';
  end if;
end $$;


-- ============================================================
-- Auditor organization-wide read
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    )
  ) <> 2 then

    raise exception
      'FAIL: Auditor could not read meeting attendance';
  end if;
end $$;


-- ============================================================
-- Participant Committee Member read
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    )
  ) <> 2 then

    raise exception
      'FAIL: participant Committee Member could not read attendance';
  end if;
end $$;


-- ============================================================
-- Unrelated Committee Member denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform *
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: unrelated Committee Member read attendance';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_not_found' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Finance denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform *
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: Finance read meeting attendance';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_not_found' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Ordinary Member denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform *
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: ordinary Member read meeting attendance';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_not_found' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Unauthenticated denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);

do $$
begin
  begin
    perform *
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: unauthenticated caller read attendance';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_authenticated' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Cancellation preserves historical attendance read.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"d1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.cancel_committee_meeting(
  :'attendance_meeting_id'::uuid,
  'Attendance history preservation test',
  'attendance-query-meeting-cancel'
);


do $$
begin
  if (
    select count(*)
    from public.get_committee_meeting_attendance(
      current_setting(
        'test.attendance_meeting_id'
      )::uuid
    )
  ) <> 2 then

    raise exception
      'FAIL: cancellation changed attendance history';
  end if;
end $$;


\echo ''
\echo 'PASS: explicit meeting attendance query authorization verified'
\echo '============================================'
\echo ' GET COMMITTEE MEETING ATTENDANCE V1 PASSED'
\echo '============================================'

rollback;
