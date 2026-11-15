BEGIN;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.key = 'committee_member'
  AND p.key = 'finance.monthly_reports.read';

COMMIT;
