-- Security hardening: trigger-only helpers are internal database machinery.
--
-- PostgreSQL functions receive EXECUTE for PUBLIC by default unless explicitly
-- revoked. These three functions return trigger and are not application RPCs.
-- Removing client EXECUTE keeps their existing trigger behavior while reducing
-- unnecessary API-visible privilege.
--
-- Intentionally anonymous application functions are NOT modified here:
--   public.get_mobile_release_status(text, text)
--   public.submit_referral_onboarding(text, text, text, text)
--   public.validate_referral_code(text)

revoke execute
on function public.protect_finance_reconciliation_history()
from public, anon, authenticated;

revoke execute
on function public.protect_finance_reconciliation_item_history()
from public, anon, authenticated;

revoke execute
on function public.set_updated_at()
from public, anon, authenticated;
