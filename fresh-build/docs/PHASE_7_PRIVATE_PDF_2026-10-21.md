# Phase 7 private PDF export — 21 October 2026

## Implemented

- Added a default-off, private PDF route for an existing finance report ID. It requires a live bearer session, active identity, allowed report-reader role, rate limit and a second role check before release.
- The route fetches only immutable period/cutoff metadata with a server-only service role. Migration `20261021060845_report_metadata_service_read.sql` grants the service role SELECT on the six required columns; browser roles have no table grant. Report lines and balances still come from actor-scoped RPCs.
- The renderer reuses the exact-paise CSV reconciliation and transfer-pair checks. It prints period, cutoff, account balances, itemized effects and optional proof references. It bounds input/output, pages the PDF, sends a SHA-256 digest and private/no-store headers. The browser checks that digest before downloading.
- A synthetic one-page PDF is saved at `output/pdf/phase7-synthetic-report.pdf`. This contains no real personal or finance data.

## Verification

- PDF renderer/route unit tests cover digest, page count, pagination, reconciliation drift, invalid metadata, unsupported glyphs, default-off access, wrong role, inactive gate, rate limit and live role change.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build:web` pass after the changes.
- Rendered the synthetic PDF to PNG and visually inspected its account totals, period/cutoff and line details. Poppler `pdfinfo` reports an A4, one-page, untagged PDF.
- On a disposable local Supabase stack, separate issued President and Treasurer sessions downloaded the actual Next route and matched its SHA-256 header. Anonymous and Member requests, a password-gated Treasurer and a President whose role changed to Member were denied. No Storage object was created. The script reset all synthetic rows and users afterward.

## Remaining gates

- Export remains off in production until the named masjid privacy/publication approver signs the policy and the enabled environment is configured.
- The PDF font library misplaces Devanagari shaping. A later local slice renders those lines with Sharp using the bundled font and escaped SVG text; the synthetic PDF and a built-route download with a Devanagari account name passed visual and signed-in checks. This preserves visible glyphs, but those image-rendered lines are not selectable PDF text. The CSV remains the text alternative. PDF text extraction/accessibility review and unsupported-script coverage remain open. This fallback is bounded to 500 shaped lines and otherwise fails closed.
- The PDF is generated on demand. Queued/ready/failed job state, bounded retries, persisted file digests, hosted/staging HTTP and browser checks, and all-source salary/advance/revision coverage remain open.
