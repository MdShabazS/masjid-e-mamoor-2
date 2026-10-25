# Fresh Android client

Copy `.env.example` to `.env` and fill in a **development** Supabase URL and
publishable key. Provision an active user in the fresh backend before signing
in. Never put a service-role key in an app environment variable.

Install dependencies from the fresh-build root with `npm ci`, then run
`npm run start` here and open Android.
`npm run export:android` checks the JavaScript bundle. The current screens
cover sign in, contributor enrollment with consent, the roster, claim submission,
and Treasurer verification with receipt-code confirmation. Receipt rendering,
offline submission drafts, notifications, and device QA are tracked in `../../docs/PHASE_12_CHECKPOINT.md`. The runtime calls the draft RPCs in `../../backend/`; that SQL
has not yet been executed against a development database.

`eas.json` has installable APK preview and release profiles. The current
`org.masjidemamoor.app.fresh` Android package is a development identity; do
not publish it as the final app or turn on a minimum-version gate. Before a
release, decide whether this is an upgrade of an installed app, confirm the
original signing key, choose the permanent package ID and higher versionCode,
then use the Phase 14 release checklist in `../../docs/PHASE_14_CHECKPOINT.md`.
