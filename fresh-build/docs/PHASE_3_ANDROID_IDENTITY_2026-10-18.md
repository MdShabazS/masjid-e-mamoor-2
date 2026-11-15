# Phase 3 Android identity continuation — 18 October 2026

The isolated local `masjid-e-mamoor-2-fresh` Supabase stack was reset through
all 17 migrations before testing. Its Auth users, sessions, application users
and finance effects were all zero. A synthetic Member with a temporary-password
gate was then created locally; no masjid or hosted user data was used.

Source review found that Android could briefly render its normal account layout
before `current_identity_gate` finished. `apps/android/App.jsx` now has explicit
`checking`, `temporary`, `ready` and `denied` identity states. Protected panels
render only in `ready`, after the gate, role and scoped list calls succeed. A
failed gate has a sign-out path. Signing out clears role, donor, claim and account
state. This is a source fix, not proof of a successful signed-in device journey.

The connected development APK was bundled and built with JDK 21, then installed
on the Pixel 8 Android 16 emulator. SHA-256:
`ea2d5bd3990a8a44062641f8fe0606858af6b529a23d0009bff0417f28708a3a`.
The generated, ignored native manifest temporarily allowed local HTTP for the
emulator-only test. It was restored afterward, and the APK was uninstalled.
This APK had the `.fresh` package and debug signing key; it is not a release
artifact. Android Studio's embedded emulator did not forward navigation taps
reliably during this run, so temporary sign-in, reset and sign-out were **not**
accepted as device UI checks. The password-change form still requires a human
operator under the computer-use policy.

Verification: 76 Node tests, ESLint, TypeScript check, Prettier check, Android
bundle export, Gradle `:app:assembleRelease` and `adb install -r` passed. The
local API returned the expected unauthenticated 401. The synthetic fixture file
was removed; the isolated local database was reset again and checked empty.
The post-reset counts were `0|0|0|0|0` for Auth users, sessions, application
users, finance effects and Storage objects. Only the fresh-build local stack
was stopped. A refreshed source archive passed checksum, 831 file digests and
clean source restore; it is separate from database and private-object recovery.
Next device check: use a reliably interactive emulator or physical Android
device against the isolated development environment, complete first-password,
reset, stale-session, sign-out and app relaunch journeys, then repeat in staging.
