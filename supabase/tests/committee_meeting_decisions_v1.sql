\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' COMMITTEE MEETING DECISIONS V1 TEST'
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
    'c1100000-0000-0000-0000-000000000001'::uuid,
    'decision-president@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000002'::uuid,
    'decision-vp@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000003'::uuid,
    'decision-secretary@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000004'::uuid,
    'decision-auditor@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000005'::uuid,
    'decision-committee-a@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000006'::uuid,
    'decision-committee-b@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000007'::uuid,
    'decision-finance@example.invalid'
  ),
  (
    'c1100000-0000-0000-0000-000000000008'::uuid,
    'decision-member@example.invalid'
  )
) fixture(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    'c1200000-0000-0000-0000-000000000001',
    'c1100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000002',
    'c1100000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000003',
    'c1100000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000004',
    'c1100000-0000-0000-0000-000000000004',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000005',
    'c1100000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000006',
    'c1100000-0000-0000-0000-000000000006',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000007',
    'c1100000-0000-0000-0000-000000000007',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000008',
    'c1100000-0000-0000-0000-000000000008',
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
    'c1200000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    'c1200000-0000-0000-0000-000000000002'::uuid,
    'vice_president'
  ),
  (
    'c1200000-0000-0000-0000-000000000003'::uuid,
    'secretary'
  ),
  (
    'c1200000-0000-0000-0000-000000000004'::uuid,
    'auditor'
  ),
  (
    'c1200000-0000-0000-0000-000000000005'::uuid,
    'committee_member'
  ),
  (
    'c1200000-0000-0000-0000-000000000006'::uuid,
    'committee_member'
  ),
  (
    'c1200000-0000-0000-0000-000000000007'::uuid,
    'finance'
  ),
  (
    'c1200000-0000-0000-0000-000000000008'::uuid,
    'member'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- President creates meeting using LIVE named argument contract.
-- Committee A + Auditor participate.
-- Committee B remains unrelated.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select id as decision_meeting_id
from public.create_committee_meeting(
  p_title :=
    'Phase 11 decision meeting',

  p_meeting_type :=
    'general',

  p_details :=
    'Review agenda and record outcomes',

  p_location :=
    'Main hall',

  p_scheduled_start :=
    now() + interval '1 day',

  p_scheduled_end :=
    now() + interval '1 day 1 hour',

  p_participant_ids :=
    array[
      'c1200000-0000-0000-0000-000000000005'::uuid,
      'c1200000-0000-0000-0000-000000000004'::uuid
    ],

  p_operation_id :=
    'decision-meeting-create'
)
\gset


select set_config(
  'test.decision_meeting_id',
  :'decision_meeting_id',
  true
);


-- ============================================================
-- President create/replay/conflict
-- ============================================================

select id as president_decision_id
from public.create_committee_meeting_decision(
  :'decision_meeting_id'::uuid,
  'Approve the maintenance schedule.',
  'decision-president-1'
)
\gset


select set_config(
  'test.president_decision_id',
  :'president_decision_id',
  true
);


do $$
declare
  v_replay public.committee_meeting_decisions;
begin
  select *
  into v_replay
  from public.create_committee_meeting_decision(
    current_setting(
      'test.decision_meeting_id'
    )::uuid,
    'Approve the maintenance schedule.',
    'decision-president-1'
  );

  if v_replay.id <>
     current_setting(
       'test.president_decision_id'
     )::uuid then

    raise exception
      'FAIL: decision replay changed identity';
  end if;

  if (
    select count(*)
    from public.committee_meeting_decisions
    where created_by_application_user_id =
      'c1200000-0000-0000-0000-000000000001'
      and operation_id =
        'decision-president-1'
  ) <> 1 then
    raise exception
      'FAIL: replay duplicated decision';
  end if;

  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'Changed decision payload.',
      'decision-president-1'
    );

    raise exception
      'FAIL: changed replay accepted';

  exception
    when unique_violation then
      if sqlerrm <> 'operation_id_conflict' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- VP / Secretary organization-wide authority
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.create_committee_meeting_decision(
  :'decision_meeting_id'::uuid,
  'Vice President outcome.',
  'decision-vp-1'
);


select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select public.create_committee_meeting_decision(
  :'decision_meeting_id'::uuid,
  'Secretary outcome.',
  'decision-secretary-1'
);


-- ============================================================
-- Participant Committee Member may append
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select public.create_committee_meeting_decision(
  :'decision_meeting_id'::uuid,
  'Participant Committee Member outcome.',
  'decision-committee-a-1'
);


-- ============================================================
-- Unrelated Committee Member denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'Forbidden unrelated outcome.',
      'decision-committee-b-forbidden'
    );

    raise exception
      'FAIL: unrelated Committee Member wrote decision';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_not_found' then
        raise;
      end if;
  end;

  begin
    perform *
    from public.list_committee_meeting_decisions(
      current_setting(
        'test.decision_meeting_id'
      )::uuid
    );

    raise exception
      'FAIL: unrelated Committee Member listed decisions';

  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'meeting_not_found' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Auditor read-only
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.list_committee_meeting_decisions(
      current_setting(
        'test.decision_meeting_id'
      )::uuid
    )
  ) <> 4 then

    raise exception
      'FAIL: Auditor decision read scope incorrect';
  end if;

  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'Forbidden Auditor decision.',
      'decision-auditor-forbidden'
    );

    raise exception
      'FAIL: Auditor wrote decision';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Finance / Member denied
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'Forbidden Finance decision.',
      'decision-finance-forbidden'
    );

    raise exception
      'FAIL: Finance wrote decision';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;
end $$;


select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'Forbidden Member decision.',
      'decision-member-forbidden'
    );

    raise exception
      'FAIL: ordinary Member wrote decision';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- Direct writes forbidden: append-only boundary
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  begin
    update public.committee_meeting_decisions
    set decision_text = 'Forbidden direct edit'
    where id =
      current_setting(
        'test.president_decision_id'
      )::uuid;

    raise exception
      'FAIL: direct decision UPDATE succeeded';

  exception
    when insufficient_privilege then
      null;
  end;

  begin
    delete from public.committee_meeting_decisions
    where id =
      current_setting(
        'test.president_decision_id'
      )::uuid;

    raise exception
      'FAIL: direct decision DELETE succeeded';

  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;


-- ============================================================
-- Cancellation preserves history but prevents new outcomes
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select public.cancel_committee_meeting(
  :'decision_meeting_id'::uuid,
  'Decision test cancellation',
  'decision-meeting-cancel'
);


do $$
declare
  v_replay public.committee_meeting_decisions;
begin
  if (
    select count(*)
    from public.list_committee_meeting_decisions(
      current_setting(
        'test.decision_meeting_id'
      )::uuid
    )
  ) <> 4 then

    raise exception
      'FAIL: cancellation changed decision history';
  end if;

  -- Idempotent replay of already-committed decision remains valid.
  select *
  into v_replay
  from public.create_committee_meeting_decision(
    current_setting(
      'test.decision_meeting_id'
    )::uuid,
    'Approve the maintenance schedule.',
    'decision-president-1'
  );

  if v_replay.id <>
     current_setting(
       'test.president_decision_id'
     )::uuid then

    raise exception
      'FAIL: replay broke after cancellation';
  end if;

  begin
    perform public.create_committee_meeting_decision(
      current_setting(
        'test.decision_meeting_id'
      )::uuid,
      'New forbidden post-cancellation decision.',
      'decision-after-cancel'
    );

    raise exception
      'FAIL: new decision accepted after cancellation';

  exception
    when invalid_parameter_value then
      if sqlerrm <> 'meeting_cancelled' then
        raise;
      end if;
  end;
end $$;


\echo ''
\echo 'PASS: append-only meeting decision contract verified'
\echo '============================================'
\echo ' COMMITTEE MEETING DECISIONS V1 PASSED'
\echo '============================================'

rollback;
