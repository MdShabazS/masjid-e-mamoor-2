begin;

-- Member profile mutations must go through trusted server-side operations.
revoke insert, update, delete
on public.member_profiles
from anon, authenticated;

-- The trusted member update function remains executable by authenticated users.
revoke all
on function public.update_own_member_profile(text, text, text)
from public;

grant execute
on function public.update_own_member_profile(text, text, text)
to authenticated;

commit;
