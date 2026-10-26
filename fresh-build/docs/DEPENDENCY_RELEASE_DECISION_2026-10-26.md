# Expo dependency release decision — 26 October 2026

**Decision state: open.** This is an engineering assessment for the release owner, not an acceptance of the risk or a real-money launch approval.

## Exact current result

The live locked-workspace `npm audit --json` returned **five high, zero critical** package entries: `expo`, `@expo/cli`, `@expo/code-signing-certificates`, `node-forge` and `zod`. They are two underlying advisories: [node-forge GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) and [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The separate live web production-workspace audit returned zero findings. The repository's audit-baseline checker accepted the five known paths with zero critical/new high entries, and its four regression tests passed. Its pass means change detection, **not** release-risk acceptance. The offline audit returned zero because it could not use the live advisory endpoint; **it is not a clean security result**.

The installed tree resolves `expo@57.0.31 → @expo/cli@57.0.32 → node-forge@1.4.0, zod@3.25.76`, plus `@expo/code-signing-certificates@0.0.6 → node-forge@1.4.0`. On 26 October, the npm registry reported `node-forge` latest as 1.4.0, SDK 57 CLI as 57.0.32, and that CLI's dependency ranges as `node-forge: ^1.3.3` and `zod: ^3.25.76`. The node-forge advisory lists no patched version; Zod lists 4.6.6, outside Expo CLI's 3.x range. Expo's [remediation request](https://github.com/expo/expo/issues/51773) remains open. The suggested `expo@44.0.6` is an incompatible major downgrade and was not applied.

Local package inspection places the affected dependencies in Expo CLI and its signing/dev-server support. The Android configuration does not enable Expo Updates code signing, and neither package name appeared as a plain string in the exported Hermes bundle. These observations narrow the apparent exposure but do **not** prove the CLI paths unreachable in every build or prove the vulnerability harmless. The build and signing environment still needs review.

## Release owner decision needed

1. Prefer a published Expo-compatible fix. Replace the locked dependency, rerun live `npm audit`, clean `npm ci`, native **signed** build, signer/hash inspection, real-device install/upgrade, full regression and hosted CI.
2. If no compatible fix exists by release time, a named release/security owner must sign a dated, time-limited residual-risk decision naming both advisories, the affected CLI paths, who can run the build/signing tools, the intended safeguards, the next review date and the stop condition if a fix becomes available. A CI baseline pass is not that decision.

No release owner, approved exception, production signer or signed-device regression evidence is recorded. This gate remains **NO-GO** alongside the separate Board/privacy, payment, staging and recovery gates.
