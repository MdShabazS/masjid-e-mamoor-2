# Fresh Android client

Copy `.env.example` to `.env` and fill in the Supabase URL and publishable key
of a development or staging project, and `EXPO_PUBLIC_WEB_API_URL` with the web
app's address (sign-in and account management go through it). The first System
Admin is created on the server; after that the System Admin and President add
everyone else from People and roles on the Home tab. Never put a service-role key in an app environment variable.

Install dependencies from the fresh-build root with `npm ci`, then run
`npm run start` here and open Android.
`npm run export:android` checks the JavaScript bundle. The app has Home, Finance,
Donors and Work tabs, shown by role. Status and missing screens are in
`../../PROJECT_STATUS.md`.

`eas.json` has installable APK preview and release profiles. The current
`org.masjidemamoor.app.fresh` Android package is a development identity; do
not publish it as the final app or turn on a minimum-version gate. Before a
release, decide whether this is an upgrade of an installed app, confirm the
original signing key, choose the permanent package ID and higher versionCode,
then use the Phase 14 release checklist in `../../docs/PHASE_14_CHECKPOINT.md`.
