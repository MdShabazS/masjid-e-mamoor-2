begin;

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_transfer_balance_chk
  check (
    transfer_in_paise = transfer_out_paise
  );

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_balance_equation_chk
  check (
    closing_balance_paise =
      opening_balance_paise
      + donation_inflow_paise
      - expense_outflow_paise
      + adjustments_net_paise
      + transfer_in_paise
      - transfer_out_paise
  );

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_account_breakdown_chk
  check (
    closing_balance_paise =
      cash_closing_paise
      + bank_closing_paise
      + upi_closing_paise
      + other_closing_paise
  );

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_id_snapshot_uidx
  unique (id, snapshot_sha256);

alter table private.finance_monthly_report_snapshots
  add constraint finance_monthly_report_snapshots_content_hash_chk
  check (
    snapshot_sha256 =
      encode(
        extensions.digest(snapshot::text, 'sha256'),
        'hex'
      )
  );

alter table private.finance_monthly_report_snapshots
  drop constraint finance_monthly_report_snapshots_report_id_fkey;

alter table private.finance_monthly_report_snapshots
  add constraint finance_monthly_report_snapshots_report_sha_fkey
  foreign key (report_id, snapshot_sha256)
  references public.finance_monthly_reports(id, snapshot_sha256)
  on delete restrict;

create trigger finance_monthly_report_snapshots_immutable
before update or delete
on private.finance_monthly_report_snapshots
for each row
execute function public.reject_finance_immutable_change();

drop policy finance_monthly_reports_storage_select
on storage.objects;

create policy finance_monthly_reports_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'finance-monthly-reports'
  and public.has_application_permission(
    'finance.monthly_reports.read'
  )
  and exists (
    select 1
    from public.finance_monthly_reports report
    where report.status = 'ready'
      and report.storage_bucket = storage.objects.bucket_id
      and report.storage_object_path = storage.objects.name
  )
);

commit;
