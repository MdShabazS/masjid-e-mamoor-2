\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' COMMITTEE MEETINGS V1 BEHAVIOR TEST'
\echo '============================================'


-- ============================================================
-- Fixed test identities
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
    '71000000-0000-0000-0000-000000000001'::uuid,
    'meeting-president@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000002'::uuid,
    'meeting-vp@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000003'::uuid,
    'meeting-secretary@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000004'::uuid,
    'meeting-auditor@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000005'::uuid,
    'meeting-committee-a@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000006'::uuid,
    'meeting-committee-b@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000007'::uuid,
    'meeting-finance@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000008'::uuid,
    'meeting-member@example.invalid'
  ),
  (
    '71000000-0000-0000-0000-000000000009'::uuid,
    'meeting-inactive@example.invalid'
  )
) fixture(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000004',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000005',
    '71000000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000006',
    '71000000-0000-0000-0000-000000000006',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000007',
    '71000000-0000-0000-0000-000000000007',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000008',
    '71000000-0000-0000-0000-000000000008',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000009',
    '71000000-0000-0000-0000-000000000009',
    'deactivated'
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
    '72000000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    '72000000-0000-0000-0000-000000000002'::uuid,
    'vice_president'
  ),
  (
    '72000000-0000-0000-0000-000000000003'::uuid,
    'secretary'
  ),
  (
    '72000000-0000-0000-0000-000000000004'::uuid,
    'auditor'
  ),
  (
    '72000000-0000-0000-0000-000000000005'::uuid,
    'committee_member'
  ),
  (
    '72000000-0000-0000-0000-000000000006'::uuid,
    'committee_member'
  ),
  (
    '72000000-0000-0000-0000-000000000007'::uuid,
    'finance'
  ),
  (
    '72000000-0000-0000-0000-000000000008'::uuid,
    'member'
  ),
  (
    '72000000-0000-0000-0000-000000000009'::uuid,
    'committee_member'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- President creates meeting
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id as president_meeting_id
from public.create_committee_meeting(
  'Executive Committee Meeting',
  'general',
  'Monthly committee coordination meeting',
  'Masjid meeting hall',
  '2026-10-20 18:30:00+05:30'::timestamptz,
  '2026-10-20 20:00:00+05:30'::timestamptz,
  array[
    '72000000-0000-0000-0000-000000000005'::uuid,
    '72000000-0000-0000-0000-000000000004'::uuid
  ],
  'meeting-president-create'
) \gset

select set_config(
  'test.president_meeting_id',
  :'president_meeting_id',
  true
);


-- Exact create replay must return original result.
do $$
declare
  v_replay public.committee_meetings;
begin
  select *
  into v_replay
  from public.create_committee_meeting(
    'Executive Committee Meeting',
    'general',
    'Monthly committee coordination meeting',
    'Masjid meeting hall',
    '2026-10-20 18:30:00+05:30'::timestamptz,
    '2026-10-20 20:00:00+05:30'::timestamptz,
    array[
      '72000000-0000-0000-0000-000000000005'::uuid,
      '72000000-0000-0000-0000-000000000004'::uuid
    ],
    'meeting-president-create'
  );

  if v_replay.id <>
    current_setting('test.president_meeting_id')::uuid
  then
    raise exception
      'FAIL: create replay changed meeting result';
  end if;

  begin
    perform public.create_committee_meeting(
      'Changed replay payload',
      'general',
      null,
      null,
      '2026-10-20 18:30:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000005'::uuid
      ],
      'meeting-president-create'
    );

    raise exception
      'FAIL: changed create replay payload accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;


-- ============================================================
-- Vice President creates second meeting
-- Actor is also participant: self-notification must be excluded.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select id as vp_meeting_id
from public.create_committee_meeting(
  'Operations Review',
  'operations',
  null,
  'Office',
  '2026-10-22 19:00:00+05:30'::timestamptz,
  '2026-10-22 20:00:00+05:30'::timestamptz,
  array[
    '72000000-0000-0000-0000-000000000002'::uuid,
    '72000000-0000-0000-0000-000000000006'::uuid
  ],
  'meeting-vp-create'
) \gset

select set_config(
  'test.vp_meeting_id',
  :'vp_meeting_id',
  true
);


-- ============================================================
-- Secretary creates third meeting
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select id as secretary_meeting_id
from public.create_committee_meeting(
  'Programme Planning',
  'planning',
  'Plan upcoming programme responsibilities',
  'Conference room',
  '2026-10-25 18:00:00+05:30'::timestamptz,
  '2026-10-25 19:30:00+05:30'::timestamptz,
  array[
    '72000000-0000-0000-0000-000000000005'::uuid,
    '72000000-0000-0000-0000-000000000006'::uuid
  ],
  'meeting-secretary-create'
) \gset

select set_config(
  'test.secretary_meeting_id',
  :'secretary_meeting_id',
  true
);


-- ============================================================
-- Organization-wide administrative visibility
-- ============================================================

do $$
begin
  if (
    select count(*)
    from public.list_committee_meetings(100, 0)
  ) <> 3 then
    raise exception
      'FAIL: Secretary organization-wide meeting visibility';
  end if;

  if (
    public.get_committee_meeting(
      current_setting(
        'test.president_meeting_id'
      )::uuid
    )
    -> 'meeting'
    ->> 'title'
  ) <> 'Executive Committee Meeting' then
    raise exception
      'FAIL: meeting detail returned unexpected meeting';
  end if;
end;
$$;


-- ============================================================
-- Participant option scope
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.list_committee_meeting_participant_options()
  ) <> 6 then
    raise exception
      'FAIL: meeting participant option scope incorrect';
  end if;

  if exists (
    select 1
    from public.list_committee_meeting_participant_options()
    where application_user_id in (
      '72000000-0000-0000-0000-000000000007'::uuid,
      '72000000-0000-0000-0000-000000000008'::uuid,
      '72000000-0000-0000-0000-000000000009'::uuid
    )
  ) then
    raise exception
      'FAIL: unauthorized/inactive participant option exposed';
  end if;
end;
$$;


-- ============================================================
-- Invalid participants / invalid scheduling are atomic
-- ============================================================

do $$
declare
  v_before bigint;
begin
  select count(*)
  into v_before
  from public.committee_meetings;

  begin
    perform public.create_committee_meeting(
      'Invalid Member Meeting',
      'general',
      null,
      null,
      '2026-10-30 18:00:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000008'::uuid
      ],
      'meeting-invalid-member'
    );

    raise exception
      'FAIL: ordinary Member accepted as meeting participant';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_meeting(
      'Inactive Participant Meeting',
      'general',
      null,
      null,
      '2026-10-30 18:00:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000009'::uuid
      ],
      'meeting-invalid-inactive'
    );

    raise exception
      'FAIL: inactive participant accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_meeting(
      'Invalid Schedule',
      'general',
      null,
      null,
      '2026-10-30 20:00:00+05:30'::timestamptz,
      '2026-10-30 19:00:00+05:30'::timestamptz,
      array[
        '72000000-0000-0000-0000-000000000005'::uuid
      ],
      'meeting-invalid-schedule'
    );

    raise exception
      'FAIL: invalid schedule accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_meeting(
      'No Participants',
      'general',
      null,
      null,
      '2026-10-30 18:00:00+05:30'::timestamptz,
      null,
      '{}'::uuid[],
      'meeting-no-participants'
    );

    raise exception
      'FAIL: empty participant set accepted';
  exception
    when invalid_parameter_value then null;
  end;

  if (
    select count(*)
    from public.committee_meetings
  ) <> v_before then
    raise exception
      'FAIL: rejected meeting creation left partial data';
  end if;
end;
$$;


-- ============================================================
-- President updates meeting + idempotent replay
-- ============================================================

select id
from public.update_committee_meeting(
  current_setting(
    'test.president_meeting_id'
  )::uuid,
  'Executive Committee Meeting',
  'general',
  'Updated coordination agenda',
  'Main meeting hall',
  '2026-10-20 18:45:00+05:30'::timestamptz,
  '2026-10-20 20:15:00+05:30'::timestamptz,
  array[
    '72000000-0000-0000-0000-000000000004'::uuid,
    '72000000-0000-0000-0000-000000000005'::uuid,
    '72000000-0000-0000-0000-000000000006'::uuid
  ],
  'meeting-president-update'
);


do $$
declare
  v_replay public.committee_meetings;
begin
  select *
  into v_replay
  from public.update_committee_meeting(
    current_setting(
      'test.president_meeting_id'
    )::uuid,
    'Executive Committee Meeting',
    'general',
    'Updated coordination agenda',
    'Main meeting hall',
    '2026-10-20 18:45:00+05:30'::timestamptz,
    '2026-10-20 20:15:00+05:30'::timestamptz,
    array[
      '72000000-0000-0000-0000-000000000004'::uuid,
      '72000000-0000-0000-0000-000000000005'::uuid,
      '72000000-0000-0000-0000-000000000006'::uuid
    ],
    'meeting-president-update'
  );

  if v_replay.id <>
    current_setting(
      'test.president_meeting_id'
    )::uuid
  then
    raise exception
      'FAIL: update replay changed meeting';
  end if;

  begin
    perform public.update_committee_meeting(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      'Changed replay title',
      'general',
      null,
      null,
      '2026-10-20 18:45:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000005'::uuid
      ],
      'meeting-president-update'
    );

    raise exception
      'FAIL: changed update replay payload accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;


-- ============================================================
-- Committee Member participant-only RLS / RPC scope
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.committee_meetings
  ) <> 2 then
    raise exception
      'FAIL: Committee Member A meeting scope incorrect';
  end if;

  if exists (
    select 1
    from public.committee_meetings
    where id = current_setting(
      'test.vp_meeting_id'
    )::uuid
  ) then
    raise exception
      'FAIL: Committee Member read unrelated meeting';
  end if;

  if (
    select count(*)
    from public.list_committee_meetings(100, 0)
  ) <> 2 then
    raise exception
      'FAIL: Committee Member list widened meeting scope';
  end if;

  begin
    perform public.get_committee_meeting(
      current_setting(
        'test.vp_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: Committee Member detail widened meeting scope';
  exception
    when no_data_found then null;
  end;
end;
$$;

reset role;


-- Committee Member may not create/edit/cancel meeting definition.
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_committee_meeting(
      'Forbidden Committee Meeting',
      'general',
      null,
      null,
      '2026-11-01 18:00:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000005'::uuid
      ],
      'meeting-committee-forbidden-create'
    );

    raise exception
      'FAIL: Committee Member created meeting';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.update_committee_meeting(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      'Forged title',
      'general',
      null,
      null,
      '2026-10-20 18:45:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000005'::uuid
      ],
      'meeting-committee-forbidden-update'
    );

    raise exception
      'FAIL: Committee Member edited meeting definition';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.cancel_committee_meeting(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      'Forged cancellation',
      'meeting-committee-forbidden-cancel'
    );

    raise exception
      'FAIL: Committee Member cancelled meeting';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.list_committee_meeting_participant_options();

    raise exception
      'FAIL: Committee Member accessed participant management options';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;


-- ============================================================
-- Assigned Committee Member records meeting attendance
-- ============================================================

select id as committee_a_attendance_id
from public.record_committee_meeting_attendance(
  current_setting(
    'test.president_meeting_id'
  )::uuid,
  '72000000-0000-0000-0000-000000000005'::uuid,
  'present',
  'meeting-attendance-a'
) \gset

select set_config(
  'test.committee_a_attendance_id',
  :'committee_a_attendance_id',
  true
);


-- Exact attendance replay returns original.
do $$
declare
  v_replay public.committee_meeting_attendance;
begin
  select *
  into v_replay
  from public.record_committee_meeting_attendance(
    current_setting(
      'test.president_meeting_id'
    )::uuid,
    '72000000-0000-0000-0000-000000000005'::uuid,
    'present',
    'meeting-attendance-a'
  );

  if v_replay.id <>
    current_setting(
      'test.committee_a_attendance_id'
    )::uuid
  then
    raise exception
      'FAIL: attendance replay changed result';
  end if;

  begin
    perform public.record_committee_meeting_attendance(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      '72000000-0000-0000-0000-000000000005'::uuid,
      'absent',
      'meeting-attendance-a'
    );

    raise exception
      'FAIL: changed attendance replay accepted';
  exception
    when unique_violation then null;
  end;

  begin
    perform public.record_committee_meeting_attendance(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      '72000000-0000-0000-0000-000000000005'::uuid,
      'present',
      'meeting-attendance-a-second-operation'
    );

    raise exception
      'FAIL: duplicate authoritative attendance accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;


-- Assigned Committee Member can record another participant
-- in the same assigned meeting.
select public.record_committee_meeting_attendance(
  current_setting(
    'test.president_meeting_id'
  )::uuid,
  '72000000-0000-0000-0000-000000000004'::uuid,
  'absent',
  'meeting-attendance-a-records-auditor'
);


-- But cannot record attendance in unrelated meeting.
do $$
begin
  begin
    perform public.record_committee_meeting_attendance(
      current_setting(
        'test.vp_meeting_id'
      )::uuid,
      '72000000-0000-0000-0000-000000000006'::uuid,
      'present',
      'meeting-attendance-unrelated'
    );

    raise exception
      'FAIL: Committee Member recorded unrelated meeting attendance';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;


-- ============================================================
-- Attendance history prevents silent participant removal
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.update_committee_meeting(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      'Executive Committee Meeting',
      'general',
      'Attempt to remove attended participant',
      'Main meeting hall',
      '2026-10-20 18:45:00+05:30'::timestamptz,
      '2026-10-20 20:15:00+05:30'::timestamptz,
      array[
        '72000000-0000-0000-0000-000000000006'::uuid
      ],
      'meeting-remove-attended-participants'
    );

    raise exception
      'FAIL: participant with attendance was removed';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  if not exists (
    select 1
    from public.committee_meeting_participants
    where meeting_id = current_setting(
      'test.president_meeting_id'
    )::uuid
      and application_user_id =
        '72000000-0000-0000-0000-000000000005'::uuid
  ) then
    raise exception
      'FAIL: failed update partially removed participant';
  end if;
end;
$$;


-- ============================================================
-- Auditor = organization-wide read-only
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.committee_meetings
  ) <> 3 then
    raise exception
      'FAIL: Auditor organization-wide read scope incorrect';
  end if;

  if (
    select count(*)
    from public.list_committee_meetings(100, 0)
  ) <> 3 then
    raise exception
      'FAIL: Auditor list RPC scope incorrect';
  end if;
end;
$$;

reset role;


select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_committee_meeting(
      'Forbidden Auditor Meeting',
      'general',
      null,
      null,
      '2026-11-02 18:00:00+05:30'::timestamptz,
      null,
      array[
        '72000000-0000-0000-0000-000000000004'::uuid
      ],
      'meeting-auditor-create'
    );

    raise exception
      'FAIL: Auditor created meeting';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.record_committee_meeting_attendance(
      current_setting(
        'test.president_meeting_id'
      )::uuid,
      '72000000-0000-0000-0000-000000000004'::uuid,
      'present',
      'meeting-auditor-attendance'
    );

    raise exception
      'FAIL: Auditor recorded attendance';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;


-- ============================================================
-- Finance has no meeting access
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.committee_meetings
  ) <> 0 then
    raise exception
      'FAIL: Finance read meeting rows';
  end if;

  if (
    select count(*)
    from public.committee_meeting_participants
  ) <> 0 then
    raise exception
      'FAIL: Finance read participant rows';
  end if;

  if (
    select count(*)
    from public.committee_meeting_attendance
  ) <> 0 then
    raise exception
      'FAIL: Finance read attendance rows';
  end if;

  begin
    perform public.list_committee_meetings(100, 0);

    raise exception
      'FAIL: Finance used meeting list RPC';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;


-- ============================================================
-- Ordinary Member has no meeting access
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.committee_meetings
  ) <> 0 then
    raise exception
      'FAIL: ordinary Member read meeting rows';
  end if;

  begin
    perform public.list_committee_meetings(100, 0);

    raise exception
      'FAIL: ordinary Member used meeting list RPC';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;


-- ============================================================
-- Cancel meeting + replay + cancelled attendance protection
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select id
from public.cancel_committee_meeting(
  current_setting(
    'test.vp_meeting_id'
  )::uuid,
  'Schedule conflict',
  'meeting-vp-cancel'
);


do $$
declare
  v_replay public.committee_meetings;
begin
  select *
  into v_replay
  from public.cancel_committee_meeting(
    current_setting(
      'test.vp_meeting_id'
    )::uuid,
    'Schedule conflict',
    'meeting-vp-cancel'
  );

  if v_replay.status <> 'cancelled' then
    raise exception
      'FAIL: cancel replay returned invalid state';
  end if;

  begin
    perform public.cancel_committee_meeting(
      current_setting(
        'test.vp_meeting_id'
      )::uuid,
      'Changed cancellation reason',
      'meeting-vp-cancel'
    );

    raise exception
      'FAIL: changed cancel replay payload accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;


select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.record_committee_meeting_attendance(
      current_setting(
        'test.vp_meeting_id'
      )::uuid,
      '72000000-0000-0000-0000-000000000006'::uuid,
      'present',
      'meeting-attendance-after-cancel'
    );

    raise exception
      'FAIL: attendance recorded on cancelled meeting';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;


-- ============================================================
-- Notification behavior
-- Run as transaction owner so RLS does not hide evidence.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_activity uuid;
begin
  -- President create:
  -- Committee A + Auditor are participants.
  select id
  into v_activity
  from public.committee_meeting_activity
  where operation_id = 'meeting-president-create';

  if (
    select count(*)
    from public.notifications
    where source_meeting_activity_id = v_activity
      and kind = 'meeting_created'
  ) <> 2 then
    raise exception
      'FAIL: meeting create notification recipients incorrect';
  end if;

  -- VP was itself a participant and must not receive
  -- a self-notification; only Committee B remains.
  select id
  into v_activity
  from public.committee_meeting_activity
  where operation_id = 'meeting-vp-create';

  if (
    select count(*)
    from public.notifications
    where source_meeting_activity_id = v_activity
      and kind = 'meeting_created'
  ) <> 1 then
    raise exception
      'FAIL: meeting actor self-notification exclusion failed';
  end if;

  if exists (
    select 1
    from public.notifications
    where source_meeting_activity_id = v_activity
      and recipient_application_user_id =
        '72000000-0000-0000-0000-000000000002'::uuid
  ) then
    raise exception
      'FAIL: meeting actor received self-notification';
  end if;

  -- Updated President meeting currently has
  -- Auditor + Committee A + Committee B.
  select id
  into v_activity
  from public.committee_meeting_activity
  where operation_id = 'meeting-president-update';

  if (
    select count(*)
    from public.notifications
    where source_meeting_activity_id = v_activity
      and kind = 'meeting_updated'
  ) <> 3 then
    raise exception
      'FAIL: meeting update notification recipients incorrect';
  end if;

  -- Idempotent update replay must not create another activity.
  if (
    select count(*)
    from public.committee_meeting_activity
    where actor_application_user_id =
      '72000000-0000-0000-0000-000000000001'::uuid
      and operation_id = 'meeting-president-update'
  ) <> 1 then
    raise exception
      'FAIL: update replay duplicated meeting activity';
  end if;

  -- Cancelled VP meeting should notify Committee B only.
  select id
  into v_activity
  from public.committee_meeting_activity
  where operation_id = 'meeting-vp-cancel';

  if (
    select count(*)
    from public.notifications
    where source_meeting_activity_id = v_activity
      and kind = 'meeting_cancelled'
  ) <> 1 then
    raise exception
      'FAIL: meeting cancellation notifications incorrect';
  end if;

  if (
    select count(*)
    from public.committee_meeting_activity
    where actor_application_user_id =
      '72000000-0000-0000-0000-000000000002'::uuid
      and operation_id = 'meeting-vp-cancel'
  ) <> 1 then
    raise exception
      'FAIL: cancel replay duplicated meeting activity';
  end if;
end;
$$;


-- ============================================================
-- Final invariants
-- ============================================================

do $$
begin
  if (
    select count(*)
    from public.committee_meeting_attendance
    where meeting_id = current_setting(
      'test.president_meeting_id'
    )::uuid
      and application_user_id =
        '72000000-0000-0000-0000-000000000005'::uuid
  ) <> 1 then
    raise exception
      'FAIL: duplicate attendance invariant violated';
  end if;

  if (
    select status
    from public.committee_meetings
    where id = current_setting(
      'test.vp_meeting_id'
    )::uuid
  ) <> 'cancelled' then
    raise exception
      'FAIL: cancellation state not authoritative';
  end if;

  if exists (
    select 1
    from public.committee_meeting_attendance
    where meeting_id = current_setting(
      'test.vp_meeting_id'
    )::uuid
  ) then
    raise exception
      'FAIL: cancelled attendance failure left data behind';
  end if;
end;
$$;


\echo 'PASS: Meeting V1 behavioral authorization/idempotency/notification tests'

rollback;
