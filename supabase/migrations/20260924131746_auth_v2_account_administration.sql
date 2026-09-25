begin;

-- Auth V2: username/password account administration.
--
-- Existing migrations 001-024 are frozen. This migration extends the V1
-- identity model without changing Donation V1 business/security semantics.

insert into public.roles (key, name, description)
values (
  'system_admin',
  'System Admin',
  'Emergency account administration role for credential and President recovery.'
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

insert into public.permissions (key, name, description)
values
  ('accounts.read', 'Accounts / Read', 'Read account administration metadata within authorized scope'),
  ('accounts.create', 'Accounts / Create', 'Create administratively provisioned application accounts'),
  ('accounts.username.change', 'Accounts / Username / Change', 'Change authorized account usernames'),
  ('accounts.password.reset', 'Accounts / Password / Reset', 'Assign new temporary passwords to authorized accounts'),
  ('accounts.status.manage', 'Accounts / Status / Manage', 'Activate or deactivate authorized accounts'),
  ('accounts.role.manage', 'Accounts / Role / Manage', 'Assign authorized application roles to accounts'),
  ('accounts.president.manage', 'Accounts / President / Manage', 'Manage President account credentials and recovery'),
  ('accounts.system_admin.manage', 'Accounts / System Admin / Manage', 'Manage System Admin account credentials and recovery')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('system_admin', 'identity.profile.read'),
    ('system_admin', 'identity.profile.update'),
    ('system_admin', 'accounts.read'),
    ('system_admin', 'accounts.create'),
    ('system_admin', 'accounts.username.change'),
    ('system_admin', 'accounts.password.reset'),
    ('system_admin', 'accounts.status.manage'),
    ('system_admin', 'accounts.role.manage'),
    ('system_admin', 'accounts.president.manage'),
    ('system_admin', 'accounts.system_admin.manage'),
    ('president', 'accounts.read'),
    ('president', 'accounts.create'),
    ('president', 'accounts.username.change'),
    ('president', 'accounts.password.reset'),
    ('president', 'accounts.status.manage'),
    ('president', 'accounts.role.manage')
) as grants(role_key, permission_key)
join public.roles r on r.key = grants.role_key
join public.permissions p on p.key = grants.permission_key
on conflict (role_id, permission_id) do nothing;

alter table public.application_users
  add column if not exists username text,
  add column if not exists username_normalized text,
  add column if not exists auth_login_email text,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists credential_updated_at timestamptz not null default now(),
  add column if not exists last_username_changed_at timestamptz;

alter table public.application_users
  drop constraint if exists application_users_username_chk;

alter table public.application_users
  add constraint application_users_username_chk
  check (
    username is null
    or (
      length(btrim(username)) between 3 and 40
      and username = btrim(username)
      and username ~ '^[A-Za-z0-9._-]+$'
    )
  );

alter table public.application_users
  drop constraint if exists application_users_username_normalized_chk;

alter table public.application_users
  add constraint application_users_username_normalized_chk
  check (
    username_normalized is null
    or username_normalized ~ '^[a-z0-9._-]{3,40}$'
  );

create unique index if not exists application_users_username_normalized_uidx
  on public.application_users (username_normalized)
  where username_normalized is not null;

alter table public.application_users
  drop constraint if exists application_users_auth_login_email_chk;

alter table public.application_users
  add constraint application_users_auth_login_email_chk
  check (
    auth_login_email is null
    or auth_login_email ~ '^[a-z0-9._%+-]+@auth\.masjid\.local$'
  );

create unique index if not exists application_users_auth_login_email_uidx
  on public.application_users (auth_login_email)
  where auth_login_email is not null;

revoke select on table public.application_users
  from anon, authenticated;

grant select (
  id,
  auth_user_id,
  status,
  created_at,
  updated_at,
  username,
  username_normalized,
  must_change_password,
  credential_updated_at,
  last_username_changed_at
) on table public.application_users
  to authenticated;

create table if not exists public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  actor_application_user_id uuid
    references public.application_users(id) on delete restrict,
  target_application_user_id uuid
    references public.application_users(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint account_security_events_event_type_chk
    check (
      event_type in (
        'account.created',
        'username.changed',
        'password.reset',
        'password.changed',
        'account.activated',
        'account.deactivated',
        'role.changed',
        'system_admin.bootstrapped'
      )
    ),

  constraint account_security_events_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists account_security_events_target_idx
  on public.account_security_events(target_application_user_id, created_at desc);

create index if not exists account_security_events_actor_idx
  on public.account_security_events(actor_application_user_id, created_at desc);

alter table public.account_security_events enable row level security;

drop policy if exists account_security_events_authorized_read
on public.account_security_events;

create policy account_security_events_authorized_read
on public.account_security_events
for select
to authenticated
using (
  public.has_application_permission('accounts.read')
  or public.has_application_permission('audit.records.read')
);

revoke all on table public.account_security_events
  from public, anon, authenticated;

grant select on table public.account_security_events
  to authenticated;

grant all on table public.account_security_events
  to service_role;

drop policy if exists application_users_self_read
on public.application_users;

create policy application_users_self_read
on public.application_users
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.has_application_permission('administration.users.manage')
);

drop policy if exists application_user_roles_self_read
on public.application_user_roles;

create policy application_user_roles_self_read
on public.application_user_roles
for select
to authenticated
using (
  application_user_id = public.current_application_user_id()
  or public.has_application_permission('administration.roles.assign')
);

commit;
