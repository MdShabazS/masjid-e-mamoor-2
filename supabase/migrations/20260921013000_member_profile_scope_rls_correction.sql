begin;

drop policy if exists member_profiles_self_read
on public.member_profiles;

create policy member_profiles_self_read
on public.member_profiles
for select
to authenticated
using (
  application_user_id = public.current_application_user_id()
);

commit;
