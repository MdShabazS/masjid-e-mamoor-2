begin;

-- Application identity records are security-sensitive.
-- Client roles must never mutate them directly.
revoke insert, update, delete
on public.application_users
from anon, authenticated;

commit;
