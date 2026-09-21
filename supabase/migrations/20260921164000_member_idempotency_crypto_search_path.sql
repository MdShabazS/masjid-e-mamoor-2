begin;

-- Migration 014:
-- Make pgcrypto digest() available to the trusted member operations while
-- retaining an explicit SECURITY DEFINER search path.

alter function public.update_own_member_profile(
  text, text, text
)
set search_path = public, extensions;

alter function public.admin_create_member_profile(
  uuid, text, text, text, text
)
set search_path = public, extensions;

alter function public.admin_update_member_profile(
  uuid, text, text, text, text
)
set search_path = public, extensions;

alter function public.admin_change_member_status(
  uuid, text, text, text
)
set search_path = public, extensions;

commit;
