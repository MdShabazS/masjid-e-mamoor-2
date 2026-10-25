# Monthly contributions — first implementation contract

The pure module in `../packages/contributions/` holds the current business
rules. Amounts are safe integer paise. An enrolled contributor needs recorded
consent. A request snapshots the suggested amount, QR version and masjid
account, and retries cannot change that snapshot. Changing the suggested
amount affects the profile immediately without rewriting sent requests.

A donor's transaction ID creates only a pending claim. An active Treasurer
verifies the actual received amount. That amount is posted for the month and
appears on the opaque receipt. Any positive verified amount marks the month
contributed; there is no remaining-balance debt or reminder. Each verified
claim can post once, and retrying the same operation returns its original
receipt.

The module is not itself an authorization or persistence boundary. The backend
must read the actor from the authenticated session, check their current role,
verify payment against the selected masjid account, and atomically save the
claim transition, financial ledger entry, receipt and audit event. Database
uniqueness must cover operation ID, actual transaction ID across contributors,
and receipt code. Rejected claims, corrections, reversals, and WhatsApp delivery
states require separate commands and tests before launch.

`../packages/contributions/access.js` defines only the first command guards:
data-entry staff can enroll a consenting contributor; System Admin can read
detailed finance but cannot decide/pay; President requests route to a different
Treasurer and other expense requests to the President, using the stored role
at submission. Backend enforcement and a complete role matrix remain pending.

The draft `../backend/001_monthly_contributions.sql` contains the first
trusted verification transaction and closed table grants. It is unexecuted;
`../backend/tests/monthly_contributions.sql` is the database scenario to run
on a new development project. `../packages/api-client/` sends exact paise and
a stable operation ID. The new web contributor route in `../apps/web/` needs a
configured development backend for a live check.

Expense approval and partial-payment rules are implemented as a pure model in
`../packages/expenses/`; no expense database posting exists yet. Laptop expense
verification and other unresolved controls remain outside that model.
