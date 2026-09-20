-- Masjid-e-Mamoor
-- Migration 003: Authorization RLS foundation
--
-- Establishes the database security boundary for the V1 identity and
-- authorization model.
--
-- Important:
-- - Authorization is derived from auth.uid() and database state.
-- - Clients cannot assign roles or modify permission grants directly.
-- - Privileged mutations will be introduced through trusted operations.
-- - Domain-specific RLS will be added alongside each domain migration.

begin;

-- ============================================================================
-- Authorization helper functions
-- ============================================================================

create or replace function public.current_application_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select au.id
  from public.application_users au
  where au.auth_user_id = auth.uid()
    and au.status in ('pending', 'active', 'restricted')
  limit 1;
$$;

create or replace function public.current_application_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.key
  from public.application_user_roles aur
  join public.application_users au
    on au.id = aur.application_user_id
  join public.roles r
    on r.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.status in ('pending', 'active', 'restricted')
  limit 1;
$$;

create or replace function public.has_application_permission(
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.application_user_roles aur
    join public.application_users au
      on au.id = aur.application_user_id
    join public.role_permissions rp
      on rp.role_id = aur.role_id
    join public.permissions p
      on p.id = rp.permission_id
    where au.auth_user_id = auth.uid()
      and au.status = 'active'
      and p.key = requested_permission
  );
$$;

-- Prevent callers from modifying the helper functions through normal
-- database privileges. These functions are intended only for RLS evaluation.
revoke all on function public.current_application_user_id() from public;
revoke all on function public.current_application_role() from public;
revoke all on function public.has_application_permission(text) from public;

grant execute on function public.current_application_user_id() to authenticated;
grant execute on function public.current_application_role() to authenticated;
grant execute on function public.has_application_permission(text) to authenticated;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.application_users enable row level security;
alter table public.application_user_roles enable row level security;
alter table public.member_profiles enable row level security;

-- ============================================================================
-- Roles
-- ============================================================================
--
-- Role definitions are non-secret authorization metadata.
-- Authenticated users may read them.
-- There are intentionally no client INSERT/UPDATE/DELETE policies.

drop policy if exists roles_authenticated_read on public.roles;

create policy roles_authenticated_read
on public.roles
for select
to authenticated
using (true);

-- ============================================================================
-- Permissions
-- ============================================================================
--
-- Permission definitions are non-secret authorization metadata.
-- Authenticated users may read them.
-- There are intentionally no client INSERT/UPDATE/DELETE policies.

drop policy if exists permissions_authenticated_read on public.permissions;

create policy permissions_authenticated_read
on public.permissions
for select
to authenticated
using (true);

-- ============================================================================
-- Role Permissions
-- ============================================================================
--
-- Grants are readable authorization metadata.
-- Mutation remains trusted-operation only.

drop policy if exists role_permissions_authenticated_read
on public.role_permissions;

create policy role_permissions_authenticated_read
on public.role_permissions
for select
to authenticated
using (true);

-- ============================================================================
-- Application Users
-- ============================================================================
--
-- A user can read their own application-user record.
-- Administrative users with the approved users.manage permission can read
-- application-user records for authorized administration workflows.
--
-- There are deliberately no direct client INSERT/UPDATE/DELETE policies.
-- This prevents clients from changing status or other security-sensitive
-- fields directly.

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

-- ============================================================================
-- Application User Roles
-- ============================================================================
--
-- A user may read their own role assignment.
-- Authorized role-administration users may read role assignments.
--
-- There are deliberately no direct client mutation policies.

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

-- ============================================================================
-- Member Profiles
-- ============================================================================
--
-- A member can read their own profile.
-- Authorized membership readers can read profiles within their permitted
-- application scope.
--
-- Profile updates are intentionally NOT granted directly because the table
-- contains security-sensitive ownership/status fields. A trusted operation
-- will later enforce column-level business rules.
--
-- There are deliberately no direct INSERT/UPDATE/DELETE policies.

drop policy if exists member_profiles_self_read
on public.member_profiles;

create policy member_profiles_self_read
on public.member_profiles
for select
to authenticated
using (
  application_user_id = public.current_application_user_id()
  or public.has_application_permission('membership.members.read')
);

commit;
