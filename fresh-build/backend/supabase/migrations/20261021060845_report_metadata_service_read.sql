-- The private PDF route reads only immutable snapshot metadata after actor authorization.
-- No browser role gains table access; report lines/balances remain actor-scoped RPCs.
begin;
grant select (id, period_kind, start_date, end_exclusive_date, include_proofs, cutoff_at)
  on public.finance_report_runs to service_role;
commit;
