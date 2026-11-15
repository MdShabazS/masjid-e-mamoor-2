# Phase 6 checkpoint — 15 October 2026

## Built in the fresh worktree

- `backend/supabase/migrations/20261015140000_one_time_donations_expenses.sql` extends the canonical `finance_effects` ledger for verified one-time income and posted expense outflow. Pending submissions and approvals have no ledger effect.
- One-time donation submission records donor name, member/other distinction, optional active referrer, date, method, claimed amount, evidence and actor. Treasurer verification records the actual amount and a matching active account with verified opening, posts once and creates an opaque receipt code. Rejection records a reason without posting.
- Expense submission records immutable requester role, title, description, category, amount and bill reference or explicit explanation. President approves ordinary and Treasurer submissions; Treasurer approves President submissions. The requester cannot approve their own expense.
- Treasurer payment records an account, exact paise, method, date, proof and actor. An account lock, expense row lock and remaining-approved-amount check protect against concurrent overspending and overpayment. A paid expense can be partially paid before the final payment. Operation IDs replay only matching commands.
- Direct table privileges are revoked, RLS enabled, and five narrow authenticated RPCs use the database identity gate. The SQL fixture `backend/tests/phase6_money.sql` asserts pending balance, actor denial, actual-amount posting, replay, preapproval denial, self-approval denial, partial/final payment and overpayment denial.

## Verification and remaining work

- Run `npm test` from `fresh-build` for the pure domain tests. The SQL fixture is **source only** until a newly provisioned development Supabase database can apply the migrations and execute it using `psql -v ON_ERROR_STOP=1`.
- Build authenticated web/Android forms and scoped read projections; connect real, private proof uploads and enforce file type/size/access rules. Receipt PDF and public lookup belong to Phase 7.
- Build cash collection task counters and Treasurer verification without double posting; direct Treasurer cash entry needs the same evidence and idempotency checks.
- Review the data-entry employee's bill verification and laptop request approval sequence with the owner before enabling that route. Current SQL excludes the data-entry role from expense submission and does not implement that review route.
- Add revisions with reapproval, correction/void effects and report/receipt version rules; advances, unused returns, salaries and member visibility remain unresolved or unbuilt. The migration has intentionally no general expense edit command.
- Execute role, Storage, concurrency, and replay tests against a live isolated database. Static SQL inspection and pure model tests do not prove deployment or runtime correctness.

**Phase 6 remains incomplete.** The core commands are a reviewable source slice, not a live product workflow.
