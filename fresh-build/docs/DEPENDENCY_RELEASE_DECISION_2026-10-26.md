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

## 29 October live recheck

A new live `npm audit --json` of the unchanged lockfile returned **four high, five low, zero critical** package entries. The high entries are `expo`, `@expo/cli`, `node-forge` and `zod`; the low entries are `@expo/config`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config` and `deepmerge`. The underlying high advisories remain [node-forge GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) and [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); the low one is [deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). npm's changed transitive grouping removed the earlier `@expo/code-signing-certificates` high entry; the installed versions remain `expo@57.0.31`, `@expo/cli@57.0.32`, `node-forge@1.4.0`, `zod@3.25.76` and `deepmerge@4.3.1`.

The current npm registry still lists `expo@57.0.31` and `@expo/cli@57.0.32` as the latest 57.0 patch versions. The node-forge and deepmerge advisories list no patched version, while the Zod patched version is 4.6.6 outside Expo CLI's 3.x dependency range. The live audit baseline checker passed with four known high paths, zero critical and no new high. The separate live web production-workspace audit returned zero findings. No package was changed or forced to an incompatible Expo release; the release decision above remains open.

The CI checker now also recognizes only the five current low package/advisory paths and rejects a new low or moderate finding, a changed advisory path, or any mismatch between the per-severity counts and entries. The 22 Python script tests and the checker against the saved live audit result pass. This is change detection, not acceptance of the three underlying advisories or a launch sign-off.

### 29 October installed-code path review

The installed Expo 57 tree was inspected without changing the lockfile. Expo CLI imports `node-forge` directly in `build/src/run/ios/codeSigning/Security.js` to parse an Apple signing certificate. Its `@expo/code-signing-certificates` dependency also imports `node-forge` in `build/main.js` for certificate and CSR operations, and Expo CLI calls that package from `build/src/utils/codesigning.js` for development signing. This is build/development tooling; it is still reachable by people who run those tools, so the advisory remains open.

The two direct `zod` imports found in the installed CLI build are `build/src/start/server/DevToolsPlugin.schema.js` and `build/src/start/server/createMCPDevToolsExtensionSchema.js`, both development-server plugin schemas. The installed `@expo/config/build/Config.js` calls `deepmerge` when applying configuration modifications or merging existing plugin options. The Android `app.json` lists only SecureStore and ImagePicker plugins, has no `updates` code-signing configuration, and `eas.json` defines internal APK builds. These findings help identify the likely inputs and operators to review; a source search cannot establish that every transitive call path is unreachable during a signed build.

Before the release owner decides on any temporary exception, restrict build and signing access to named operators, keep untrusted Expo config/plugins and signing material out of that environment, record the exact locked versions and advisories, and repeat the audit and signed-device regression when a compatible fix appears. No exception or release approval is recorded here.
