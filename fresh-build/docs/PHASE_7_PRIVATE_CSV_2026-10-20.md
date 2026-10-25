# Phase 7 private CSV slice — 20 October 2026

**Scope:** the fresh-build web API and report package. No real masjid data or new hosted fixture was used. The route is `GET /api/management/report-csv?runId=<uuid>` and requires a bearer session. It is disabled unless the server-only `REPORT_EXPORTS_APPROVED=true` setting is deliberately applied after the named privacy/publication signatory approves the fields; the environment template sets it to `false`.

The endpoint verifies the Auth user, active account and password gate, reads the current database role, and consumes a per-user rate-limit unit. It obtains report lines and account balances through the caller-scoped RPCs in bounded pages, checks the role and gate again before release, then returns a private no-store CSV attachment and SHA-256 header. It never uses the service key to read report content. System Admin is currently a report reader under the database guard, so accepted-policy mapping still needs review.

The renderer checks every line belongs to a returned account, rejects duplicate effects and incomplete transfer pairs, independently sums exact integer paise for every account, and compares opening, income, expense, transfer and closing against the database projection. It rejects mismatches rather than publishing a partial file. Text fields that look like spreadsheet formulas are escaped; negative monetary values remain exact numeric text. CSV rows contain the report run ID, effect fields, optional proof reference already returned by the RPC, and account totals. The file uses UTF-8 BOM and CRLF rows for common spreadsheet readers.

| Check | Result |
| --- | --- |
| Focused renderer and endpoint cases | Eight pass: exact paise and digest, formula escaping, missing/duplicate effects, total drift, incomplete transfers, large-value/negative money, default-off/auth/role/gate/rate denials, changed-role recheck |
| Whole Node suite | 100 tests pass |
| Static gates | ESLint, TypeScript typecheck, Prettier and environment-template checks pass |
| Web build | Next.js production build includes `/api/management/report-csv` |
| HTTP smoke | Built server on localhost returned HTTP 503, `SERVICE_UNAVAILABLE` and `Cache-Control: no-store` with the approval flag unset |
| Working-source backup | SHA-256, 881 file digests and clean source restore pass; this does not back up the live database or private Storage objects |

The main Phase 7 report task remains open. This is a private CSV implementation slice, not a live issued-session download test. It does not yet prove hosted pagination, PDF rendering, queued/ready/failed jobs, report revisions, all salary/advance sources, client download flow, staging access or the signatory's field approval. The approval flag must stay off for real-data use until those decisions are recorded.

**Follow-up, 21 October:** the real local HTTP route and three issued Auth sessions passed. See [Phase 7 CSV HTTP evidence](PHASE_7_CSV_HTTP_2026-10-21.md).
