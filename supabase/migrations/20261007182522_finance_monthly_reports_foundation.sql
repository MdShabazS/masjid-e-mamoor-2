BEGIN;

CREATE SCHEMA "private";

CREATE TABLE "private"."finance_monthly_report_snapshots" (
  "report_id"       uuid                     NOT NULL,
  "snapshot"        jsonb                    NOT NULL,
  "snapshot_sha256" text                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "finance_monthly_report_snapshots_object_chk" CHECK ((jsonb_typeof(snapshot) = 'object'::text)),
  CONSTRAINT "finance_monthly_report_snapshots_pkey" PRIMARY KEY (report_id),
  CONSTRAINT "finance_monthly_report_snapshots_report_sha_uidx" UNIQUE (report_id, snapshot_sha256),
  CONSTRAINT "finance_monthly_report_snapshots_sha_chk" CHECK ((snapshot_sha256 ~ '^[0-9a-f]{64}$'::text))
);

CREATE TABLE "public"."finance_monthly_reports" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "report_month"          date                     NOT NULL,
  "revision"              integer                  NOT NULL,
  "status"                text                     NOT NULL DEFAULT 'generating'::text,
  "generation_source"     text                     NOT NULL,
  "attempt_count"         integer                  NOT NULL DEFAULT 1,
  "snapshot_sha256"       text                     NOT NULL,
  "opening_balance_paise" bigint                   NOT NULL,
  "donation_inflow_paise" bigint                   NOT NULL,
  "expense_outflow_paise" bigint                   NOT NULL,
  "adjustments_net_paise" bigint                   NOT NULL,
  "transfer_in_paise"     bigint                   NOT NULL,
  "transfer_out_paise"    bigint                   NOT NULL,
  "closing_balance_paise" bigint                   NOT NULL,
  "cash_closing_paise"    bigint                   NOT NULL,
  "bank_closing_paise"    bigint                   NOT NULL,
  "upi_closing_paise"     bigint                   NOT NULL,
  "other_closing_paise"   bigint                   NOT NULL,
  "transaction_count"     bigint                   NOT NULL,
  "storage_bucket"        text                     NOT NULL DEFAULT 'finance-monthly-reports'::text,
  "storage_object_path"   text                     NOT NULL,
  "file_sha256"           text,
  "file_size_bytes"       bigint,
  "generated_at"          timestamp with time zone,
  "last_attempt_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "last_error_code"       text,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "finance_monthly_reports_attempt_count_chk" CHECK ((attempt_count > 0)),
  CONSTRAINT "finance_monthly_reports_error_code_chk"
    CHECK (((last_error_code IS NULL) OR ((last_error_code = btrim(last_error_code)) AND ((length(last_error_code) >= 1) AND (length(last_error_code) <= 200))))),
  CONSTRAINT "finance_monthly_reports_file_sha_chk" CHECK (((file_sha256 IS NULL) OR (file_sha256 ~ '^[0-9a-f]{64}$'::text))),
  CONSTRAINT "finance_monthly_reports_file_size_chk" CHECK (((file_size_bytes IS NULL) OR (file_size_bytes > 0))),
  CONSTRAINT "finance_monthly_reports_generation_source_chk" CHECK ((generation_source = ANY (ARRAY['scheduled'::text, 'manual'::text]))),
  CONSTRAINT "finance_monthly_reports_month_revision_uidx" UNIQUE (report_month, revision),
  CONSTRAINT "finance_monthly_reports_month_snapshot_uidx" UNIQUE (report_month, snapshot_sha256),
  CONSTRAINT "finance_monthly_reports_month_start_chk" CHECK ((report_month = (date_trunc('month'::text, (report_month)::timestamp with time zone))::date)),
  CONSTRAINT "finance_monthly_reports_nonnegative_totals_chk"
    CHECK (((donation_inflow_paise >= 0) AND (expense_outflow_paise >= 0) AND (transfer_in_paise >= 0) AND (transfer_out_paise >= 0) AND (transaction_count >= 0))),
  CONSTRAINT "finance_monthly_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "finance_monthly_reports_revision_chk" CHECK ((revision > 0)),
  CONSTRAINT "finance_monthly_reports_snapshot_sha_chk" CHECK ((snapshot_sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "finance_monthly_reports_state_chk"
    CHECK
    ((((status = 'generating'::text) AND (file_sha256 IS NULL) AND (file_size_bytes IS NULL) AND (generated_at IS NULL) AND (last_error_code IS NULL)) OR ((status = 'ready'::text)
    AND (file_sha256 IS NOT NULL) AND (file_size_bytes IS NOT NULL) AND (generated_at IS
    NOT NULL) AND (last_error_code IS NULL)) OR
    ((status = 'failed'::text) AND (file_sha256 IS NULL) AND (file_size_bytes IS NULL) AND (generated_at IS NULL) AND (last_error_code IS NOT NULL)))),
  CONSTRAINT "finance_monthly_reports_status_chk" CHECK ((status = ANY (ARRAY['generating'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "finance_monthly_reports_storage_bucket_chk" CHECK ((storage_bucket = 'finance-monthly-reports'::text)),
  CONSTRAINT "finance_monthly_reports_storage_object_uidx" UNIQUE (storage_bucket, storage_object_path),
  CONSTRAINT "finance_monthly_reports_storage_path_chk"
    CHECK
    ((((length(btrim(storage_object_path)) >= 1) AND (length(btrim(storage_object_path)) <= 500)) AND (storage_object_path = btrim(storage_object_path)) AND (storage_object_path !~
    '(^|/)\.\.?(/|$)'::text) AND (storage_object_path ~ '\.pdf$'::text)))
);

ALTER TABLE "public"."finance_monthly_reports"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."finance_monthly_report_snapshots"
  ADD CONSTRAINT "finance_monthly_report_snapshots_report_id_fkey" FOREIGN KEY (report_id) REFERENCES public.finance_monthly_reports(id) ON DELETE RESTRICT;

CREATE INDEX finance_monthly_reports_created_idx ON public.finance_monthly_reports USING btree (created_at DESC, id);

CREATE INDEX finance_monthly_reports_month_status_idx ON public.finance_monthly_reports USING btree (report_month DESC, status, revision DESC);

CREATE TRIGGER finance_monthly_reports_set_updated_at
  BEFORE UPDATE ON public.finance_monthly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "finance_monthly_reports_authorized_read" ON "public"."finance_monthly_reports"
  FOR SELECT
  TO "authenticated"
  USING (public.has_application_permission('finance.monthly_reports.read'::text));

CREATE POLICY "finance_monthly_reports_storage_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'finance-monthly-reports'::text) AND public.has_application_permission('finance.monthly_reports.read'::text)));

COMMENT ON TABLE "private"."finance_monthly_report_snapshots" IS 'Internal immutable source snapshots used to render revisioned monthly Finance PDF packs.';

COMMENT ON TABLE "public"."finance_monthly_reports" IS 'Authorized metadata and summary totals for immutable, revisioned monthly Finance PDF packs.';

GRANT CREATE, USAGE ON SCHEMA "private" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."finance_monthly_report_snapshots" TO "postgres";

REVOKE ALL ON TABLE "public"."finance_monthly_reports" FROM "authenticated";

GRANT SELECT ON TABLE "public"."finance_monthly_reports" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."finance_monthly_reports" TO "postgres";


REVOKE ALL ON SCHEMA private
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE private.finance_monthly_report_snapshots
FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE private.finance_monthly_report_snapshots
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.finance_monthly_reports
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.finance_monthly_reports
TO authenticated;

INSERT INTO public.permissions (
  key,
  name,
  description
)
VALUES
  (
    'finance.monthly_reports.read',
    'Finance / Monthly Reports / Read',
    'Read and download authorized monthly Finance report packs'
  ),
  (
    'finance.monthly_reports.manage',
    'Finance / Monthly Reports / Manage',
    'Generate or regenerate monthly Finance report packs through trusted workflows'
  )
ON CONFLICT (key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description;

INSERT INTO public.role_permissions (
  role_id,
  permission_id
)
SELECT
  r.id,
  p.id
FROM (
  VALUES
    ('president', 'finance.monthly_reports.read'),
    ('vice_president', 'finance.monthly_reports.read'),
    ('secretary', 'finance.monthly_reports.read'),
    ('finance', 'finance.monthly_reports.read'),
    ('auditor', 'finance.monthly_reports.read'),
    ('committee_member', 'finance.monthly_reports.read'),
    ('president', 'finance.monthly_reports.manage'),
    ('finance', 'finance.monthly_reports.manage')
) AS grants(role_key, permission_key)
JOIN public.roles r
  ON r.key = grants.role_key
JOIN public.permissions p
  ON p.key = grants.permission_key
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'finance-monthly-reports',
  'finance-monthly-reports',
  false,
  20971520,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

COMMIT;
