# Phase 14 — signed APK and launch checkpoint

**Started:** 16 October 2026 (India time). **Status:** release preparation only; no signed APK, public deployment or launch acceptance. Phases 1–13 still have open exits, especially real database/role checks, owner policy, onsite and restore trials. The source build remains deliberately unable to publish an APK manifest while the package ID ends in `.fresh`.

## Implemented release controls

- `apps/android/app.json` now declares `android.versionCode: 1`. The existing `org.masjidemamoor.app.fresh` package is for development and must be replaced only after deciding whether existing installed builds must upgrade in place.
- `apps/android/eas.json` has `preview` and `release` profiles with `android.buildType: apk`; both produce directly installable APK artifacts when an EAS project, build environment and signing credentials exist. Expo's default Android output is an AAB without the APK override.
- `scripts/release_manifest.py` reads the APK using Android SDK `aapt`, verifies its signature with `apksigner`, checks package/version against `app.json`, and records the APK hash, byte size, signer fingerprint and HTTPS site/download URLs. Upgrade mode additionally compares the previous APK's package, signer and versionCode. It refuses the `.fresh` placeholder and writes no manifest on failure.
- The 24 October release-gate repair accepts both `Signer #1` and current `V2 Signer` certificate labels from `apksigner`, and rejects certificates whose subject is `CN=Android Debug`. The newly built `.fresh` APK was inspected with the real SDK tools and correctly rejected as debug signed; three release-manifest tests pass. Final package/signing ownership and an actual production-key APK remain open.
- The 24 October environment-template check passed its three tests and found no public-prefixed secret variable names. The unconfigured built-web HTTP smoke passed: public pages returned 200; identity, privileged POST and private QR routes returned 503. The unconfigured Android APK rendered its fail-closed connection screen on the emulator. These checks do not validate staging/production values or inspect a configured production bundle, because those environments do not yet exist.
- `scripts/test_release_manifest.py` covers signer mismatch, version monotonicity, placeholder package and insecure/placeholder URL rejection. A successful test uses mocked SDK inspection; it is **not** evidence of a real signed APK.

## Release sequence and evidence still required

1. **Product and environment gates:** close the owner policy/privacy decisions; provision isolated development/staging and production projects; execute migrations and 25 acceptance scenarios with real roles. Obtain QR/account, verified location, approved public copy/privacy contact, backup target and operator roster. WhatsApp can remain disabled until the masjid Business number and approved templates are available, but the published scope must say so.
2. **Android identity and signing:** the preserved older source declares `com.masjidemamoor.masjidemamoor2` and version `1.0.0`, but used EAS remote versionCode management; its installed build's actual code and signer are not established. Inspect the currently installed older APK on the intended devices. Decide whether the new product must upgrade it without uninstalling. If yes, use its exact package ID and original signing key, choose a strictly higher versionCode, and perform a signed old→new install preserving data. If no, record the deliberate first-install identity. Store keystore and passwords outside Git/source archives with owner-controlled backup. Do not infer signing compatibility from a matching package string.
3. **Build and inspect:** configure the EAS project and environment-scoped public app values; build the selected APK profile. Install on emulator and a real Android device; test cold start, sign-in, role routes, denied permission, offline/reconnect, kill/restart, update and receipt download without Metro. Record build ID, Expo SDK, package, versionCode, signer fingerprint and SHA-256.
4. **Stage web/backend:** apply tested migrations in order to staging; verify private key ownership, HTTPS, all protected routes, direct RPC/RLS denial, storage reads, scheduled jobs, reports, receipt lookup and backup/restore. Reconcile Treasurer test records to generated balances and reports. Run the production migration only after a restorable checkpoint; write down the forward fix/rollback decision for every migration.
5. **Publish:** upload the verified APK to an HTTPS URL, run the manifest command with that URL and the live site URL, then expose the download link. Verify the public link downloads bytes with the manifest hash. Only then enable a minimum-version gate that still allows access to the download/support page. Smoke test both old and new clients and record the result. Deploy public copy only after approval.
6. **Operate:** record release owner, monitoring and backup alert recipients, first support contact, known limitations, launch time, rollback action and first-day finance/queue review. Keep the prior APK and its signer/hash record for upgrade and rollback analysis.

Manifest command after a real signed artifact exists (paths and URLs are examples, not approved production values):

```sh
python3 scripts/release_manifest.py --apk /secure/path/release.apk \
  --previous-apk /secure/path/previous.apk \
  --web-url https://your-approved-site.invalid \
  --apk-url https://your-approved-site.invalid/download/release.apk \
  --output release/release-manifest.json
```

Use `--first-install` instead of `--previous-apk` only after explicitly deciding no installed build is being upgraded. The command rejects `.invalid` URLs; replace the examples with verified HTTPS addresses. Never put the APK, signing key, credentials or private build logs in the source backup merely to make a build look complete.

**Later native build update:** [Phase 14 native build evidence](PHASE_14_NATIVE_BUILD_2026-10-16.md) records debug and bundled release variants built locally with JDK 21. The bundled variant installed and rendered on a Pixel 8 emulator. It is signed with the generated Android debug key and retains the `.fresh` development package. No production signing credential, real-device trial, staging site or public URL exists. The manifest CLI still blocks this package from publication.

Primary references checked 16 October 2026: [Expo APK build profile](https://docs.expo.dev/build-reference/apk/), [EAS JSON Android buildType/versionCode](https://docs.expo.dev/eas/json/), [Expo signing credential security](https://docs.expo.dev/app-signing/security/).
