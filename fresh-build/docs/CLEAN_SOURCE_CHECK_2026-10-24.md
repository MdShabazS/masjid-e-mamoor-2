# Clean source checkout check — 24 October 2026

The verified `masjid-project-working-source-2026-10-23T191626Z.tar.gz` archive was restored to a new disposable directory outside the working tree. Its manifest contained 949 files and passed checksum, file-digest and clean-restore verification.

From that restored `fresh-build/`, without generated working-tree dependencies, these passed:

| Check | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | clean lockfile install |
| `npm test` | 131 passed, 0 failed |
| `npm run build:web` and `npm run smoke:web` | production web build and fail-closed HTTP routes passed |
| `npm run export:android` | Android JavaScript bundle exported |
| `npm run lint`, `format:check`, `typecheck`, `check:env` | passed |
| `npm run test:backup`, `check:shell` | passed |
| `npm audit --audit-level=critical` | passed with zero critical findings; four high Expo/node-forge findings remain |

This removes dependence on ignored build files for these gates. It is a local clean restore, **not** a GitHub-hosted CI run from a committed checkout, a native signed APK, or a production backup/restore drill.
