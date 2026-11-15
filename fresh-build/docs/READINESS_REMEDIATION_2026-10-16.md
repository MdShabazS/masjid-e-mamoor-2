# Readiness remediation — 16 October 2026 (India time)

The full backlog is `../tasks.md`; this checkpoint records what was actually tested while trying to move toward a usable release. No SQL fixture, signed APK or release-wide acceptance ID passed in this work.

## Fixes and evidence

| Area | Change | Observed local result | Remaining limit |
|---|---|---|---|
| Android money display | Replace `Number(paise) / 100` with integer-string formatting, including Indian grouping and negative amounts. | New test passes above JavaScript's safe-integer range; Android Metro export passes. | No device installed; large real database amount not exercised. |
| SQL fixture safety | Check migration/fixture inventory, reject fixture `COMMIT`/missing rollback, require `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable`, use `psql -X`. | Inventory found 15 migrations and nine rollback-only fixtures; mutation test rejects a committed fixture and duplicate migration timestamp. | No Postgres/`psql`; this does not parse or execute SQL. |
| Web fail closed | Missing backend keys now return an uncached JSON 503. Production-web smoke starts a local server and checks three public pages and three privileged routes. | Next production build and smoke pass: public 200, identity 503, privileged POST 503. | No configured Auth/DB, browser workflow, storage or accessibility pass. |
| Android native build | Isolated clean npm install and Expo prebuild. | Native project generated with package `org.masjidemamoor.app.fresh`, versionCode 1. | Offline `assembleDebug` failed: uncached `commons-io:commons-io:1.4` and Kotlin daemon tried to write under `~/Library/Application Support/kotlin`; no APK. |

## Environment investigation

- Supabase connected account currently lists **zero projects** and one organization, `MdShabazS's Org`. The connector requires the user to choose an organization; then its cost tool must be called and the cost repeated for confirmation before project creation. No project or spend was initiated.
- Docker CLI exists but the daemon is unavailable; attempts to open the installed Docker Desktop bundle returned `kLSNoExecutableErr`. No `psql` binary was found. Installed Supabase CLI is 2.117.0. Current native-stack documentation requires 2.119.0 or newer; it is experimental and was not substituted silently for a tested isolated database.
- A Pixel 8 emulator is configured, but `adb devices` showed no running device. Java 21 and Gradle 9.3.1 were found. The prebuild happened under `/tmp`, outside the worktree; no native generated source or APK was copied into the project.

## Next real gates

1. After the organization choice and cost confirmation, create an isolated development project, apply migrations and execute SQL fixtures and direct-role/Storage/race tests. Alternatively arrange a working local DB runtime and `psql` with an isolated disposable database.
2. Provision a permitted Android build environment with complete Maven dependencies and writable Kotlin cache, create a debug APK, and test install/launch before signing and upgrade checks.
3. Implement the missing private files, receipt/report delivery and finance flows, then run the 25 release acceptance IDs from the master matrix. No source-only test count can replace these journeys.

Primary documentation checked: [Supabase local runtime requirements](https://supabase.com/docs/guides/local-development/running-multiple-local-projects), [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview), [Expo native prebuild](https://docs.expo.dev/workflow/continuous-native-generation/), [Gradle offline/read-only dependency cache](https://docs.gradle.org/current/userguide/dependency_caching.html).
