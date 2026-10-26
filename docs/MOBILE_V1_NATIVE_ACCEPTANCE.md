# Mobile V1 Native Acceptance

## Build Baseline

This document was initially written before EAS was linked. The current
Android release status below supersedes the historical Phase 5 setup notes.

- Phase 5 starting SHA: `148a6482762ccee0d2c5795790277f11409e07d8`
- Phase 5 commit SHA: the Git commit containing this document; resolve with `git rev-parse HEAD` after checkout.
- Expo SDK: `57.0.26`
- Expo Router: `57.0.24`
- React Native: `0.86.3`
- Mobile React: `19.2.3`
- Package manager: `pnpm 12.4.2`

Expo Doctor passes all checks, Expo dependency validation reports the project is current, and Android and iOS production JavaScript bundle exports succeed. The project remains managed through Continuous Native Generation; no `android/` or `ios/` directories are committed.

## Native Identity

- Android package: `com.masjidemamoor.masjidemamoor2`
- iOS bundle identifier: `com.masjidemamoor.masjidemamoor2`
- Orientation: portrait
- Router plugin: configured
- SecureStore plugin: configured with Android backup handling enabled
- Icon and adaptive-icon assets: resolved by Expo public configuration and native bundle export

The native identifiers are configured in the current EAS project.

## EAS Status

- EAS authentication: verified for the project owner
- EAS project link: configured as `@shabaz17/masjid-e-mamoor-2`
- EAS project ID: configured in Expo project metadata
- Build profiles: `preview-android`, `preview-ios-simulator`, `production`, and `production-apk`
- Environment names: `preview` and `production`
- Required public EAS environment variables: configured for `preview` and `production`; values are intentionally omitted
- Store submission: not performed

The checked-in profiles follow the current [EAS build profile guidance](https://docs.expo.dev/build/eas-json/). Android preview is configured as an internal APK, iOS preview is configured for Simulator, and production uses remote app-version management with automatic build-number increments.

Required public environment variable names:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_APP_API_URL`

No values are stored in this document. Unless an approved staging backend is introduced, the application API origin is `https://masjid-e-mamoor-2.vercel.app`; production-backed preview testing must remain read-only or use dedicated safe QA records.

## Build Results

### Android Preview

- Latest EAS internal APK build ID: `93fede69-6aff-4ba9-8853-b3ea226f94fc`
- Build result: passed; artifact produced on 2026-10-12
- App version/build code: `1.0.0` / `2`
- EAS source commit metadata: `516bdd1bab5f2353f7ea8915acfb05e30973de63`
- EAS fingerprint: `a431355ba84c8065ccff30911a23bc80f2ab753a`
- APK SHA-256: `5d7b352f4ea0dd72b0f2ccf667913c599ef5373de0ac85a60af54330b061ff56`
- Source traceability: the working tree contained uncommitted changes during the build, so the reported commit alone does not identify the exact APK source; this is a QA candidate, not an approved member-release artifact
- Artifact type: internal preview APK; not submitted to a store
- Installation/runtime on the exact candidate: pending; no device was connected during verification
- Runtime smoke: not performed
- Local Android JavaScript/Hermes export: passed
- Latest verified EAS production build: `5f9e8aa7-5f3c-4d31-9db4-3472689ad6c0` (AAB, version `1.0.0`, version code `2`, source commit `e44a8bd8a87733837ac5bde89de4f82369ab129e`)
- Local release-variant APK: builds successfully but is signed with the Android debug certificate and is not suitable for store distribution
- Android tooling: no physical device currently connected. The `Pixel_8` AVD now boots with the installed Android 36 system image and software graphics. The current local debug APK was installed and launched to the Sign In screen; this does not verify the exact EAS release candidate.

### iOS Simulator — Deferred

- EAS build ID: not available
- Cloud build: not checked in this Android-focused verification
- Installation: not performed
- Runtime smoke: not performed
- Local iOS JavaScript/Hermes export: passed
- iOS tooling/build readiness: deferred; not assessed in this Android-only workstream

## Native Smoke Checklist

Status vocabulary: **Passed**, **Partial**, **Not performed**, or **Blocked**. Debug-only results are identified explicitly and do not count as release-candidate acceptance.

| Check | Android | iOS |
| --- | --- | --- |
| JavaScript/native bundle export | Passed | Deferred |
| Install application | Passed (debug APK only) | Deferred |
| Launch without native crash | Partial (debug APK launched; non-fatal React Native SoftException logged) | Deferred |
| Login screen renders | Passed (debug APK only) | Deferred |
| Keyboard and text input | Partial (focused fields visible; scrolling dismisses keyboard and reveals lower controls) | Deferred |
| Portrait and safe-area layout | Not performed | Deferred |
| Back/gesture navigation | Not performed | Deferred |
| Tab navigation | Not performed | Deferred |
| Background/foreground transition | Not performed | Deferred |
| Kill and relaunch | Not performed | Deferred |
| Network failure and retry behavior | Not performed | Deferred |
| Role presentation | Not performed | Deferred |

No production account, referral, donation, proof, role, password, or financial record was changed during Phase 5.

## SecureStore

The application uses `expo-secure-store` for Supabase session persistence. Its CNG config plugin enables Android backup integration so restored backups exclude undecryptable SecureStore values, following the current [Expo SecureStore guidance](https://docs.expo.dev/versions/latest/sdk/securestore/).

- Static configuration: passed
- Android login/relaunch/logout persistence: not performed
- iOS login/relaunch/logout persistence: not performed
- Biometric authentication: not added

## DocumentPicker

- SDK-compatible dependency: passed
- Android bundle inclusion: passed
- iOS bundle inclusion: passed
- Android picker open/cancel: not performed
- iOS picker open/cancel: not performed
- JPEG/PNG/PDF runtime selection: not performed
- Controlled proof upload: not performed
- iCloud entitlements: not added

## Private Proof URL

- Existing short-lived signed URL architecture: unchanged
- Android `Linking.openURL` runtime: not performed
- iOS `Linking.openURL` runtime: not performed
- Signed URL values logged or documented: no

## Known Limitations And Blockers

1. Android runtime verification against the finalized EAS release candidate remains pending. No physical device is connected; the Pixel_8 AVD is usable for emulator-only checks, but does not replace GPS/hardware verification.
2. The existing production AAB predates the current source commit and must not be treated as the release artifact for the current working tree.
3. The local release-variant APK is debug-signed; store distribution must use the EAS production signing configuration.
4. No isolated staging backend is configured. Production-backed preview mutation testing is not authorized without dedicated safe QA records.
5. SecureStore, DocumentPicker, and private proof URL flows need verification on the exact Android release candidate.
6. The exhaustive role/workflow matrix and accessibility acceptance remain pending for Android.
7. `pnpm peers check` has previously reported transitive monorepo peer-range warnings; this is separate from the passing Expo Doctor/dependency checks recorded at the time.
8. Jummah GPS/offline attendance is implemented in the current uncommitted source with President-configured event centre/window, Member-only self-recording, fixed server-side 100 metre validation, and encrypted local queuing. The attendance migration and SQL regression suite have passed against the local Supabase database; the production database has not been changed. Native SQLCipher and physical GPS runtime verification remain pending.
9. Push delivery source is present locally: authenticated device registration, transactional notification outbox, Expo dispatch/receipt processing, and a private scheduled invocation. Mobile tests and Android export pass, and the SQL regression suite passes locally. Expo's Android setup requires FCM credentials for EAS; no Firebase project, matching Android Firebase configuration, EAS FCM credential, dispatcher secrets, production deployment, or real-device delivery have been verified. Push is therefore not release-ready. Android OS notification permission remains user-controlled, with in-app notifications as the durable source of truth. See [Expo Android FCM setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).
10. Mobile localization is not implemented. V1 calls for English, Hindi, Kannada, and Urdu with Urdu RTL; authoritative translations require human review.

## Final QA Prerequisites

- Complete review of the current uncommitted Android UI changes; production artifacts must come from a traceable approved commit.
- Connect a safe Android device for hardware/GPS checks, then install and exercise the exact EAS preview/release candidate. The Pixel_8 AVD is available for non-hardware-specific checks.
- Use only read-only checks against the current production-backed preview until isolated QA data/backend are approved.
- Verify the required mobile native flows, role visibility, keyboard behavior, SecureStore, DocumentPicker, and private proof viewing on Android.
- Produce a new EAS `production-apk` from the approved final Android source snapshot and verify its version/build number before member distribution. The separate `production` AAB profile remains for a future store release.
- iOS build and runtime acceptance are explicitly deferred.

## ANDROID FINAL QA — PENDING

The remaining native acceptance in this workstream is Android-only. Do not treat the historical cross-platform checklist below as evidence that iOS has been tested.

- [ ] Authentication and logout
- [ ] Forced password change
- [ ] Home and Profile
- [ ] Members directory
- [ ] Member detail and update
- [ ] Referral creation
- [ ] Referral management, approval, rejection, and provisioning
- [ ] Donation outstanding snapshot
- [ ] Payment submission and history
- [ ] Proof upload and private viewing
- [ ] Additional donation
- [ ] Donation review, rejection, verification, and allocation
- [ ] Waivers, donation rules, and obligation generation
- [ ] Anonymous donation and Jummah donation
- [ ] Account directory and creation
- [ ] Username, role, status, and password reset management
- [ ] System Admin protections
- [ ] All approved roles and capability visibility
- [ ] Member self-recorded Jummah attendance with server-authoritative 100m validation
- [ ] Offline attendance queue, retry, duplicate protection, and server reconciliation
- [ ] Android push permission, token registration, delivery, and failure fallback
- [ ] English/Hindi/Kannada/Urdu resources and Urdu RTL review
- [ ] Loading, empty, error, and offline states
- [ ] Responsive behavior and UI consistency
- [ ] Accessibility and native interaction quality
- [ ] Web/native behavior parity

Android final acceptance is not complete. Do not create a `v1.0.0` release tag until the exact approved Android candidate passes the Android checks and all accepted corrections are resolved. iOS remains deferred.
