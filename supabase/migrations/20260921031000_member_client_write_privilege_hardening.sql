begin;

-- Client applications must not have direct mutation privileges on
-- membership history or referral records.
-- These records are mutated only through trusted server-side operations.

revoke all privileges on table public.membership_history
from anon, authenticated;

revoke all privileges on table public.referrals
from anon, authenticated;

-- Authenticated users may read only; RLS remains the authoritative
-- row-level boundary for these reads.
grant select on table public.membership_history to authenticated;
grant select on table public.referrals to authenticated;

commit;
