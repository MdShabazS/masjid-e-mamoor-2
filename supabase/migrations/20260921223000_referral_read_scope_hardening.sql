-- Referral / Membership Onboarding V1
-- Read-scope hardening
--
-- President, Vice President, Secretary:
--   organization-wide referral administration.
--
-- Committee Member:
--   only referrals associated through an authorized workflow,
--   currently represented by being the referral's referrer.
--
-- Referred application user/member:
--   may read the referral resulting in their own linked identity.
--
-- Finance, Auditor, Member:
--   no unrelated referral visibility.
--
-- membership.members.read is intentionally NOT sufficient to read
-- organization-wide referral records.

drop policy if exists referrals_authorized_read
on public.referrals;

drop policy if exists referrals_referrer_read
on public.referrals;

create policy referrals_administrative_read
on public.referrals
for select
to authenticated
using (
  public.current_application_role() in (
    'president',
    'vice_president',
    'secretary'
  )
);

create policy referrals_referrer_read
on public.referrals
for select
to authenticated
using (
  referrer_member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id =
      public.current_application_user_id()
  )
);

create policy referrals_referred_application_user_read
on public.referrals
for select
to authenticated
using (
  referred_application_user_id =
    public.current_application_user_id()
);

create policy referrals_referred_member_read
on public.referrals
for select
to authenticated
using (
  referred_member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id =
      public.current_application_user_id()
  )
);
