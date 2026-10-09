\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' COMMITTEE MEETING FOLLOW-UP TASKS V1 TEST'
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
    'e1100000-0000-0000-0000-000000000001'::uuid,
    'followup-president@example.invalid'
  ),
  (
    'e1100000-0000-0000-0000-000000000002'::uuid,
    'followup-committee-a@example.invalid'
  ),
  (
    'e1100000-0000-0000-0000-000000000003'::uuid,
    'followup-committee-b@example.invalid'
  ),
  (
    'e1100000-0000-0000-0000-000000000004'::uuid,
    'followup-finance@example.invalid'
  )
) fixture(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    'e1200000-0000-0000-0000-000000000001',
    'e1100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'e1200000-0000-0000-0000-000000000002',
    'e1100000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    'e1200000-0000-0000-0000-000000000003',
    'e1100000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    'e1200000-0000-0000-0000-000000000004',
    'e1100000-0000-0000-0000-000000000004',
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
    'e1200000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    'e1200000-0000-0000-0000-000000000002'::uuid,
    'committee_member'
  ),
  (
    'e1200000-0000-0000-0000-000000000003'::uuid,
    'committee_member'
  ),
  (
    'e1200000-0000-0000-0000-000000000004'::uuid,
    'finance'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- President creates two meetings.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"e1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select id as followup_meeting_a
from public.create_committee_meeting(
  p_title :=
    'Follow-up source meeting A',

  p_meeting_type :=
    'general',

  p_details :=
    'Primary source meeting',

  p_location :=
    'Committee room',

  p_scheduled_start :=
    now() + interval '1 day',

  p_scheduled_end :=
    now() + interval '1 day 1 hour',

  p_participant_ids :=
    array[
      'e1200000-0000-0000-0000-000000000002'::uuid
    ],

  p_operation_id :=
    'followup-meeting-a'
)
\gset


select id as followup_meeting_b
from public.create_committee_meeting(
  p_title :=
    'Follow-up source meeting B',

  p_meeting_type :=
    'general',

  p_details :=
    'Secondary source meeting',

  p_location :=
    'Committee room',

  p_scheduled_start :=
    now() + interval '2 days',

  p_scheduled_end :=
    now() + interval '2 days 1 hour',

  p_participant_ids :=
    array[
      'e1200000-0000-0000-0000-000000000003'::uuid
    ],

  p_operation_id :=
    'followup-meeting-b'
)
\gset


select set_config(
  'test.followup_meeting_a',
  :'followup_meeting_a',
  true
);

select set_config(
  'test.followup_meeting_b',
  :'followup_meeting_b',
  true
);


-- ============================================================
-- Meeting A decision
-- ============================================================

select id as followup_decision_a
from public.create_committee_meeting_decision(
  :'followup_meeting_a'::uuid,
  'Arrange maintenance inspection.',
  'followup-decision-a'
)
\gset


select set_config(
  'test.followup_decision_a',
  :'followup_decision_a',
  true
);


-- ============================================================
-- Direct-assignment follow-up linked to decision
-- ============================================================

select id as direct_followup_id
from public.create_committee_meeting_followup_task(
  :'followup_meeting_a'::uuid,
  :'followup_decision_a'::uuid,
  'Arrange maintenance inspection',
  'Follow up the approved meeting decision',
  'high',
  current_date + 5,
  array[
    'e1200000-0000-0000-0000-000000000002'::uuid
  ],
  'followup-direct-create'
)
\gset


select set_config(
  'test.direct_followup_id',
  :'direct_followup_id',
  true
);


do $$
declare
  v_task public.committee_tasks;
  v_detail jsonb;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting(
      'test.direct_followup_id'
    )::uuid;

  if v_task.assignment_mode <> 'direct'
     or v_task.status <> 'assigned' then

    raise exception
      'FAIL: direct follow-up changed normal task semantics';
  end if;

  if v_task.source_meeting_id <>
       current_setting(
         'test.followup_meeting_a'
       )::uuid then

    raise exception
      'FAIL: direct follow-up meeting link missing';
  end if;

  if v_task.source_meeting_decision_id <>
       current_setting(
         'test.followup_decision_a'
       )::uuid then

    raise exception
      'FAIL: direct follow-up decision link missing';
  end if;

  v_detail :=
    public.get_committee_task(
      v_task.id
    );

  if (
    v_detail
    -> 'task'
    ->> 'source_meeting_id'
  )::uuid <> v_task.source_meeting_id then

    raise exception
      'FAIL: task detail omitted source meeting';
  end if;

  if (
    v_detail
    -> 'task'
    ->> 'source_meeting_decision_id'
  )::uuid <> v_task.source_meeting_decision_id then

    raise exception
      'FAIL: task detail omitted source decision';
  end if;
end $$;


-- ============================================================
-- Direct follow-up replay must return same task.
-- ============================================================

do $$
declare
  v_replay public.committee_tasks;
begin
  select *
  into v_replay
  from public.create_committee_meeting_followup_task(
    current_setting(
      'test.followup_meeting_a'
    )::uuid,

    current_setting(
      'test.followup_decision_a'
    )::uuid,

    'Arrange maintenance inspection',

    'Follow up the approved meeting decision',

    'high',

    current_date + 5,

    array[
      'e1200000-0000-0000-0000-000000000002'::uuid
    ],

    'followup-direct-create'
  );

  if v_replay.id <>
       current_setting(
         'test.direct_followup_id'
       )::uuid then

    raise exception
      'FAIL: direct follow-up replay changed task identity';
  end if;
end $$;


-- ============================================================
-- Same operation ID cannot be rebound to another meeting.
-- ============================================================

do $$
begin
  begin
    perform public.create_committee_meeting_followup_task(
      current_setting(
        'test.followup_meeting_b'
      )::uuid,

      null,

      'Arrange maintenance inspection',

      'Follow up the approved meeting decision',

      'high',

      current_date + 5,

      array[
        'e1200000-0000-0000-0000-000000000002'::uuid
      ],

      'followup-direct-create'
    );

    raise exception
      'FAIL: follow-up operation rebound to another meeting';

  exception
    when unique_violation then
      if sqlerrm <> 'operation_id_conflict' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Decision from Meeting A cannot be attached to Meeting B.
-- ============================================================

do $$
begin
  begin
    perform public.create_committee_meeting_followup_task(
      current_setting(
        'test.followup_meeting_b'
      )::uuid,

      current_setting(
        'test.followup_decision_a'
      )::uuid,

      'Invalid decision linkage',

      null,

      'normal',

      current_date + 6,

      array[
        'e1200000-0000-0000-0000-000000000003'::uuid
      ],

      'followup-invalid-decision'
    );

    raise exception
      'FAIL: cross-meeting decision linkage accepted';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_decision_not_found' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Open follow-up with meeting source only.
-- ============================================================

select id as open_followup_id
from public.create_open_committee_meeting_followup_task(
  :'followup_meeting_a'::uuid,
  null,
  'Volunteer programme preparation',
  'Open follow-up task from meeting',
  'normal',
  current_date + 7,
  'followup-open-create'
)
\gset


select set_config(
  'test.open_followup_id',
  :'open_followup_id',
  true
);


do $$
declare
  v_task public.committee_tasks;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting(
      'test.open_followup_id'
    )::uuid;

  if v_task.assignment_mode <> 'open'
     or v_task.status <> 'open' then

    raise exception
      'FAIL: open follow-up changed open-task semantics';
  end if;

  if v_task.source_meeting_id <>
       current_setting(
         'test.followup_meeting_a'
       )::uuid then

    raise exception
      'FAIL: open follow-up meeting link missing';
  end if;

  if v_task.source_meeting_decision_id
       is not null then

    raise exception
      'FAIL: open follow-up unexpectedly linked decision';
  end if;
end $$;


-- ============================================================
-- Committee Member claims the open follow-up normally.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"e1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);


select public.claim_open_committee_task(
  :'open_followup_id'::uuid,
  'followup-open-claim'
);


do $$
declare
  v_task public.committee_tasks;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting(
      'test.open_followup_id'
    )::uuid;

  if v_task.status <> 'assigned' then
    raise exception
      'FAIL: follow-up open task did not claim normally';
  end if;

  if v_task.source_meeting_id <>
       current_setting(
         'test.followup_meeting_a'
       )::uuid then

    raise exception
      'FAIL: claim changed meeting linkage';
  end if;

  if (
    select count(*)
    from public.committee_task_assignees cta
    where cta.task_id = v_task.id
      and cta.removed_at is null
  ) <> 1 then

    raise exception
      'FAIL: claimed follow-up does not have exactly one active assignee';
  end if;
end $$;


-- ============================================================
-- Committee Member cannot create meeting follow-up tasks.
-- ============================================================

do $$
begin
  begin
    perform public.create_open_committee_meeting_followup_task(
      current_setting(
        'test.followup_meeting_a'
      )::uuid,
      null,
      'Unauthorized follow-up',
      null,
      'normal',
      current_date + 10,
      'followup-cm-forbidden'
    );

    raise exception
      'FAIL: Committee Member created follow-up task';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Finance cannot create follow-up tasks.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"e1100000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);


do $$
begin
  begin
    perform public.create_open_committee_meeting_followup_task(
      current_setting(
        'test.followup_meeting_a'
      )::uuid,
      null,
      'Finance forbidden follow-up',
      null,
      'normal',
      current_date + 10,
      'followup-finance-forbidden'
    );

    raise exception
      'FAIL: Finance created follow-up task';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Source linkage cannot be rewritten after creation.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"e1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


do $$
begin
  begin
    update public.committee_tasks
    set source_meeting_id =
      current_setting(
        'test.followup_meeting_b'
      )::uuid
    where id =
      current_setting(
        'test.direct_followup_id'
      )::uuid;

    raise exception
      'FAIL: historical meeting source was rewritten';

  exception
    when invalid_parameter_value then
      if sqlerrm <> 'task_source_meeting_immutable' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Ordinary non-follow-up task remains unlinked.
-- ============================================================

select id as ordinary_task_id
from public.create_committee_task(
  'Ordinary unrelated task',
  null,
  'normal',
  current_date + 3,
  array[
    'e1200000-0000-0000-0000-000000000002'::uuid
  ],
  'ordinary-task-control'
)
\gset


select set_config(
  'test.ordinary_task_id',
  :'ordinary_task_id',
  true
);


do $$
declare
  v_task public.committee_tasks;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting(
      'test.ordinary_task_id'
    )::uuid;

  if v_task.source_meeting_id is not null
     or v_task.source_meeting_decision_id is not null then

    raise exception
      'FAIL: ordinary task acquired meeting linkage';
  end if;
end $$;


\echo ''
\echo 'PASS: direct/open meeting follow-up linkage verified'
\echo '============================================'
\echo ' COMMITTEE MEETING FOLLOW-UP TASKS V1 PASSED'
\echo '============================================'

rollback;
