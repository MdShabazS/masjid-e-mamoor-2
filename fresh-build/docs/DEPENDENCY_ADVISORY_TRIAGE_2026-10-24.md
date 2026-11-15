# Dependency advisory triage — 24 October 2026

## Evidence

From the clean npm workspace lockfile, `npm audit --json` reported **five high, zero critical** vulnerability entries. They are five dependency-tree reports from two underlying advisories:

| Underlying package | Locked version | Advisory | Dependency path | Available compatible fix |
| --- | --- | --- | --- | --- |
| `node-forge` | 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), RSA PKCS#1 v1.5 signature-verification bypass | Android workspace → `expo@57.0.31` → `@expo/cli@57.0.32` → `node-forge` directly and through `@expo/code-signing-certificates@0.0.6` | **No patched published version** in the advisory; the npm registry's latest `node-forge` was 1.4.0 at check time. |
| `zod` | 3.25.76 | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), memory exhaustion while validating oversized arrays | Android workspace → `expo@57.0.31` → `@expo/cli@57.0.32` → `zod` | Advisory patch is 4.6.6; Expo CLI 57 declares `zod: ^3.25.76`. Even CLI 58.1.15 still declares Zod 3 and node-forge 1.4.0, so an override is outside its published compatibility range. |

`npm audit` reports the affected `@expo/cli`, `@expo/code-signing-certificates` and `expo` ancestor packages as the other three high entries. Its suggested `expo@44.0.6` is a major downgrade from the installed SDK 57 and is not a credible remediation for this app without a migration and regression study. No application source imports `node-forge`, `zod` or `@expo/cli` directly. The bundled APK contains `assets/index.android.bundle`; a string scan did not find those package names, but that alone does **not** prove the code is absent or unreachable. This is a build-tool-path assessment, not an exploitability guarantee.

`npm audit --omit=dev --workspace=@masjid/fresh-web --json` reported **zero** vulnerabilities in the web production dependency set. The project-wide critical gate passed, but it does not clear the five high reports. No dependency override or untested SDK downgrade was applied.

## Release treatment

Keep the five-high finding open. Recheck for upstream Expo/node-forge fixes immediately before a release build. If still unresolved, a named release/security owner must review the exact dependency path and decide whether the build-process exposure is acceptable; record that decision and controls before signing. Do not silently mark the advisories fixed or let this triage alone authorize the public real-money launch.
