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
  ('95000000-0000-0000-0000-000000000001'::uuid, 'ref-final-admin@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000002'::uuid, 'ref-final-president@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000003'::uuid, 'ref-final-member@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000011'::uuid, 'ref-final-target-one@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000012'::uuid, 'ref-final-target-two@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000013'::uuid, 'ref-final-unauthorized@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000014'::uuid, 'ref-final-pending@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000015'::uuid, 'ref-final-phone@auth.masjid.local'),
  ('95000000-0000-0000-0000-000000000016'::uuid, 'ref-final-rollback@auth.masjid.local')
) x(auth_id, email);

insert into public.application_users (
  id, auth_user_id, status, display_name
)
values
  ('96000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 'active', 'Referral Admin'),
  ('96000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000002', 'active', 'Referral President'),
  ('96000000-0000-0000-0000-000000000003', '95000000-0000-0000-0000-000000000003', 'active', 'Existing Member');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('96000000-0000-0000-0000-000000000001'::uuid, 'system_admin'),
  ('96000000-0000-0000-0000-000000000002'::uuid, 'president'),
  ('96000000-0000-0000-0000-000000000003'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

insert into public.member_profiles (
  id, application_user_id, display_name, phone, status
)
values (
  '97000000-0000-0000-0000-000000000003',
  '96000000-0000-0000-0000-000000000003',
  'Existing Member',
  '+919500000003',
  'active'
);

insert into public.referrals (
  id, referral_code, status, applicant_display_name, applicant_phone,
  reviewed_by_application_user_id, reviewed_at
)
values
  ('98000000-0000-0000-0000-000000000011', 'ref-final-code-00000011', 'approved', 'President Applicant', '+919500000011', '96000000-0000-0000-0000-000000000002', now()),
  ('98000000-0000-0000-0000-000000000012', 'ref-final-code-00000012', 'approved', 'Admin Applicant', '+919500000012', '96000000-0000-0000-0000-000000000001', now()),
  ('98000000-0000-0000-0000-000000000013', 'ref-final-code-00000013', 'approved', 'Unauthorized Applicant', '+919500000013', '96000000-0000-0000-0000-000000000002', now()),
  ('98000000-0000-0000-0000-000000000014', 'ref-final-code-00000014', 'pending', null, null, null, null),
  ('98000000-0000-0000-0000-000000000015', 'ref-final-code-00000015', 'approved', 'Phone Conflict', '+919500000003', '96000000-0000-0000-0000-000000000002', now()),
  ('98000000-0000-0000-0000-000000000016', 'ref-final-code-00000016', 'approved', 'Rollback Applicant', '+919500000016', '96000000-0000-0000-0000-000000000002', now());

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon',
    'public.finalize_referral_member_provisioning(uuid,text,uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute referral finalization';
  end if;
end $$;

-- President completes an approved referral and creates one aggregate.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.finalize_referral_member_provisioning(
  '98000000-0000-0000-0000-000000000011',
  'referral-finalize-president-001',
  '95000000-0000-0000-0000-000000000011',
  'ref-final-target-one@auth.masjid.local',
  'ref.final.one',
  'ref.final.one'
);
reset role;

do $$
declare
  v_account_id uuid;
  v_profile_id uuid;
begin
  select id into v_account_id
  from public.application_users
  where auth_user_id = '95000000-0000-0000-0000-000000000011';

  select id into v_profile_id
  from public.member_profiles
  where application_user_id = v_account_id;

  if v_account_id is null or v_profile_id is null then
    raise exception 'FAIL: President completion did not create Member aggregate';
  end if;

  if (select count(*) from public.application_users
      where auth_user_id = '95000000-0000-0000-0000-000000000011') <> 1
     or (select count(*) from public.application_user_roles
         where application_user_id = v_account_id) <> 1
     or (select count(*) from public.application_user_roles aur
         join public.roles r on r.id = aur.role_id
         where aur.application_user_id = v_account_id
           and r.key = 'member') <> 1
     or (select count(*) from public.member_profiles
         where application_user_id = v_account_id) <> 1
     or (select count(*) from public.account_security_events
         where target_application_user_id = v_account_id
           and event_type = 'account.created') <> 1
     or (select count(*) from public.referral_operation_idempotency
         where operation_id = 'referral-finalize-president-001'
           and operation_type = 'referral_complete') <> 1
     or (select count(*) from public.referral_audit_events
         where referral_id = '98000000-0000-0000-0000-000000000011'
           and event_type = 'referral.completed') <> 1 then
    raise exception 'FAIL: referral completion aggregate counts are incorrect';
  end if;

  if not exists (
    select 1
    from public.referrals r
    join public.application_users au
      on au.id = r.referred_application_user_id
    join public.member_profiles mp
      on mp.id = r.referred_member_profile_id
    where r.id = '98000000-0000-0000-0000-000000000011'
      and r.status = 'completed'
      and mp.application_user_id = au.id
      and au.display_name = r.applicant_display_name
      and mp.display_name = r.applicant_display_name
      and mp.phone = r.applicant_phone
      and au.username_normalized = 'ref.final.one'
  ) then
    raise exception 'FAIL: approved referral identity was not preserved';
  end if;
end $$;

-- Matching replay returns the same account without duplicate rows.
set local role authenticated;
select public.finalize_referral_member_provisioning(
  '98000000-0000-0000-0000-000000000011',
  'referral-finalize-president-001',
  '95000000-0000-0000-0000-000000000011',
  'ref-final-target-one@auth.masjid.local',
  'ref.final.one',
  'ref.final.one'
);

do $$
begin
  begin
    perform public.finalize_referral_member_provisioning(
      '98000000-0000-0000-0000-000000000011',
      'referral-finalize-president-001',
      '95000000-0000-0000-0000-000000000011',
      'ref-final-target-one@auth.masjid.local',
      'different.username',
      'different.username'
    );
    raise exception 'FAIL: conflicting operation replay succeeded';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;
reset role;

do $$
declare v_account_id uuid;
begin
  select id into v_account_id from public.application_users
  where auth_user_id = '95000000-0000-0000-0000-000000000011';
  if (select count(*) from public.account_security_events
      where target_application_user_id = v_account_id
        and event_type = 'account.created') <> 1
     or (select count(*) from public.referral_audit_events
         where referral_id = '98000000-0000-0000-0000-000000000011'
           and event_type = 'referral.completed') <> 1 then
    raise exception 'FAIL: replay duplicated audit records';
  end if;
end $$;

-- System Admin retains current referral completion authority.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select public.finalize_referral_member_provisioning(
  '98000000-0000-0000-0000-000000000012',
  'referral-finalize-admin-001',
  '95000000-0000-0000-0000-000000000012',
  'ref-final-target-two@auth.masjid.local',
  'ref.final.two',
  'ref.final.two'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.referrals
    where id = '98000000-0000-0000-0000-000000000012'
      and status = 'completed'
  ) then
    raise exception 'FAIL: System Admin could not complete approved referral';
  end if;
end $$;

-- Ordinary Member cannot finalize an approved referral.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.finalize_referral_member_provisioning(
      '98000000-0000-0000-0000-000000000013',
      'referral-finalize-member-001',
      '95000000-0000-0000-0000-000000000013',
      'ref-final-unauthorized@auth.masjid.local',
      'ref.unauthorized',
      'ref.unauthorized'
    );
    raise exception 'FAIL: Member finalized a referral';
  exception when others then
    if sqlerrm not like '%not_authorized%' then raise; end if;
  end;
end $$;
reset role;

-- A referral not in approved state cannot start completion.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.finalize_referral_member_provisioning(
      '98000000-0000-0000-0000-000000000014',
      'referral-finalize-pending-001',
      '95000000-0000-0000-0000-000000000014',
      'ref-final-pending@auth.masjid.local',
      'ref.pending',
      'ref.pending'
    );
    raise exception 'FAIL: pending referral was completed';
  exception when others then
    if sqlerrm not like '%referral_not_approved%' then raise; end if;
  end;
end $$;

-- Existing active-member phone conflict leaves no account aggregate.
do $$
begin
  begin
    perform public.finalize_referral_member_provisioning(
      '98000000-0000-0000-0000-000000000015',
      'referral-finalize-phone-001',
      '95000000-0000-0000-0000-000000000015',
      'ref-final-phone@auth.masjid.local',
      'ref.phone',
      'ref.phone'
    );
    raise exception 'FAIL: active-member phone conflict succeeded';
  exception when others then
    if sqlerrm not like '%phone_already_member%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if exists (
    select 1 from public.application_users
    where auth_user_id = '95000000-0000-0000-0000-000000000015'
  ) then
    raise exception 'FAIL: phone conflict left an application account';
  end if;
end $$;

-- Inject a referral-audit failure and prove the account and referral effects
-- roll back as one database transaction.
create function public.test_fail_referral_completion_audit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.referral_id = '98000000-0000-0000-0000-000000000016' then
    raise exception 'injected_referral_audit_failure';
  end if;
  return new;
end;
$$;

create trigger test_fail_referral_completion_audit
before insert on public.referral_audit_events
for each row execute function public.test_fail_referral_completion_audit();

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.finalize_referral_member_provisioning(
      '98000000-0000-0000-0000-000000000016',
      'referral-finalize-rollback-001',
      '95000000-0000-0000-0000-000000000016',
      'ref-final-rollback@auth.masjid.local',
      'ref.rollback',
      'ref.rollback'
    );
    raise exception 'FAIL: injected referral failure did not abort';
  exception when others then
    if sqlerrm not like '%injected_referral_audit_failure%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if exists (
       select 1 from public.application_users
       where auth_user_id = '95000000-0000-0000-0000-000000000016'
     )
     or exists (
       select 1 from public.referral_operation_idempotency
       where operation_id = 'referral-finalize-rollback-001'
     )
     or exists (
       select 1 from public.referral_audit_events
       where referral_id = '98000000-0000-0000-0000-000000000016'
         and event_type = 'referral.completed'
     )
     or not exists (
       select 1 from public.referrals
       where id = '98000000-0000-0000-0000-000000000016'
         and status = 'approved'
         and referred_application_user_id is null
         and referred_member_profile_id is null
     ) then
    raise exception 'FAIL: referral failure left partial database state';
  end if;
end $$;

drop trigger test_fail_referral_completion_audit
on public.referral_audit_events;
drop function public.test_fail_referral_completion_audit();

rollback;
