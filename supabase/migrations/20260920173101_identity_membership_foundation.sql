-- Masjid-e-Mamoor
-- Migration 001: Identity & Membership Foundation
--
-- Establishes the application identity, role, permission, and member-profile
-- foundations without introducing financial or operational domains.
--
-- This migration intentionally does not define RLS policies. RLS predicates
-- and trusted-operation boundaries will be introduced after the underlying
-- authorization model has been implemented and reviewed.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Roles
-- ============================================================================

create table public.roles (
    id uuid primary key default gen_random_uuid(),
    key text not null unique,
    name text not null unique,
    description text,
    created_at timestamptz not null default now(),

    constraint roles_key_format_chk
        check (key ~ '^[a-z][a-z0-9_]*$')
);

-- Approved V1 application roles.
insert into public.roles (key, name, description)
values
    (
        'president',
        'President / Super Admin',
        'Highest administrative authority with organization-wide administrative and oversight responsibilities.'
    ),
    (
        'vice_president',
        'Vice President',
        'Senior operational oversight role.'
    ),
    (
        'secretary',
        'Secretary',
        'Membership, committee, and administrative operations role.'
    ),
    (
        'finance',
        'Finance',
        'Financial operations and authorized financial workflows.'
    ),
    (
        'auditor',
        'Auditor',
        'Read-oriented financial and audit oversight role.'
    ),
    (
        'committee_member',
        'Committee Member',
        'Assigned committee, task, meeting, and authorized attendance workflows.'
    ),
    (
        'member',
        'Member',
        'Ordinary member-facing application access.'
    );

-- ============================================================================
-- Permissions
-- ============================================================================

create table public.permissions (
    id uuid primary key default gen_random_uuid(),
    key text not null unique,
    name text not null,
    description text,
    created_at timestamptz not null default now(),

    constraint permissions_key_format_chk
        check (
            key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
        )
);

-- Permission records are intentionally not seeded here.
-- The approved architecture defers the final normalized permission catalogue
-- until authorization implementation is finalized.

-- ============================================================================
-- Role Permissions
-- ============================================================================

create table public.role_permissions (
    role_id uuid not null references public.roles(id) on delete restrict,
    permission_id uuid not null references public.permissions(id) on delete restrict,
    created_at timestamptz not null default now(),

    primary key (role_id, permission_id)
);

create index role_permissions_permission_id_idx
    on public.role_permissions (permission_id);

-- ============================================================================
-- Application Users
-- ============================================================================

create table public.application_users (
    id uuid primary key default gen_random_uuid(),

    auth_user_id uuid not null unique
        references auth.users(id) on delete restrict,

    status text not null default 'pending',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint application_users_status_chk
        check (
            status in (
                'pending',
                'active',
                'restricted',
                'deactivated'
            )
        )
);

create index application_users_status_idx
    on public.application_users (status);

-- ============================================================================
-- Application User Roles
-- ============================================================================

create table public.application_user_roles (
    application_user_id uuid not null
        references public.application_users(id) on delete restrict,

    role_id uuid not null
        references public.roles(id) on delete restrict,

    created_at timestamptz not null default now(),

    primary key (application_user_id, role_id)
);

-- V1 allows at most one active application role per application user.
create unique index application_user_roles_one_role_per_user_uidx
    on public.application_user_roles (application_user_id);

create index application_user_roles_role_id_idx
    on public.application_user_roles (role_id);

-- ============================================================================
-- Member Profiles
-- ============================================================================

create table public.member_profiles (
    id uuid primary key default gen_random_uuid(),

    application_user_id uuid
        references public.application_users(id) on delete restrict,

    status text not null default 'active',

    display_name text not null,
    phone text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint member_profiles_application_user_id_uidx
        unique (application_user_id),

    constraint member_profiles_status_chk
        check (
            status in (
                'active',
                'inactive'
            )
        )
);

create index member_profiles_status_idx
    on public.member_profiles (status);

create index member_profiles_phone_idx
    on public.member_profiles (phone);

-- ============================================================================
-- Updated-at trigger support
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger application_users_set_updated_at
before update on public.application_users
for each row
execute function public.set_updated_at();

create trigger member_profiles_set_updated_at
before update on public.member_profiles
for each row
execute function public.set_updated_at();
