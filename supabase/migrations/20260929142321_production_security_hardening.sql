-- Production security hardening.
--
-- These idempotency tables are internal implementation details.
-- Client roles must not access them directly. SECURITY DEFINER trusted
-- operations may continue to use them through the database owner context.

alter table public.member_operation_idempotency
  enable row level security;

alter table public.referral_operation_idempotency
  enable row level security;

-- These helper functions are internal authorization primitives and are not
-- intended to be direct anonymous API endpoints.

revoke execute on function public.current_application_user_id()
from anon;

revoke execute on function public.current_application_role()
from anon;

revoke execute on function public.has_application_permission(text)
from anon;

revoke execute on function public.can_use_member_admin_read_operations()
from anon;
