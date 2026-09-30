# Mobile V1 Native Acceptance

## Build Baseline

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

The native identifiers were not previously registered in the repository. They are now the stable identifiers for future EAS and store configuration.

## EAS Status

- EAS authentication: unavailable; `eas whoami` reports not logged in
- EAS project link: pending authentication
- EAS project ID: not generated
- Build profiles: `preview-android`, `preview-ios-simulator`, and `production`
- Environment names: `preview` and `production`
- EAS environment variables: pending authentication and project linking
- Store submission: not performed

The checked-in profiles follow the current [EAS build profile guidance](https://docs.expo.dev/build/eas-json/). Android preview is configured as an internal APK, iOS preview is configured for Simulator, and production uses remote app-version management with automatic build-number increments.

Required public environment variable names:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_APP_API_URL`

No values are stored in this document. Preview and production EAS environments must be configured after project linking. Unless an approved staging backend is introduced, the application API origin is `https://masjid-e-mamoor-2.vercel.app`; production-backed preview testing must remain read-only or use dedicated safe QA records.

## Build Results

### Android Preview

- EAS build ID: not available
- Artifact type: configured as APK
- Cloud build: not performed; EAS authentication unavailable
- Installation: not performed; no Android device or AVD is available
- Runtime smoke: not performed
- Local Android JavaScript/Hermes export: passed
- Android tooling: ADB available; no connected devices; emulator binary available but no AVD configured

### iOS Simulator

- EAS build ID: not available
- Cloud build: not performed; EAS authentication unavailable
- Installation: not performed
- Runtime smoke: not performed
- Local iOS JavaScript/Hermes export: passed
- iOS tooling: blocked because full Xcode and Simulator tools are not installed; only Command Line Tools are active

## Native Smoke Checklist

Status vocabulary: **Passed**, **Not performed**, or **Blocked**.

| Check | Android | iOS |
| --- | --- | --- |
| JavaScript/native bundle export | Passed | Passed |
| Install application | Not performed | Blocked |
| Launch without native crash | Not performed | Blocked |
| Login screen renders | Not performed | Blocked |
| Keyboard and text input | Not performed | Blocked |
| Portrait and safe-area layout | Not performed | Blocked |
| Back/gesture navigation | Not performed | Blocked |
| Tab navigation | Not performed | Blocked |
| Background/foreground transition | Not performed | Blocked |
| Kill and relaunch | Not performed | Blocked |
| Network failure and retry behavior | Not performed | Blocked |
| Role presentation | Not performed | Blocked |

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

1. EAS cloud linking, environment setup, and preview builds require Expo account authentication.
2. Authenticated EAS profile resolution could not run without that account; the checked-in JSON is syntactically valid and follows the current documented EAS profile schema.
3. Android installation and runtime verification require a connected safe test device or configured AVD.
4. iOS build installation and runtime verification require full Xcode with an available Simulator.
5. SecureStore persistence, DocumentPicker behavior, and private proof URL opening require controlled native runtime tests.
6. No staging backend is currently configured for destructive mobile QA.
7. `pnpm peers check` reports transitive monorepo peer-range warnings. Expo Doctor passes all 21 checks, Expo dependency validation is current, and both platform exports pass, so no unsupported override was added.
8. The exhaustive role-by-role and workflow-by-workflow review belongs to the final cross-platform acceptance audit.

## Final QA Prerequisites

- Link the app to the intended Expo organization and record the legitimate EAS project ID.
- Configure the three public mobile environment variables in EAS `preview` and `production` without exposing their values.
- Produce an Android `preview-android` APK and an iOS `preview-ios-simulator` artifact.
- Provide an Android device/AVD and an iOS Simulator.
- Provide dedicated safe accounts and safe QA records for any authenticated mutation tests.
- Confirm the production web deployment corresponds to the Phase 5 commit.

## FINAL CROSS-PLATFORM QA — PENDING

The final audit must run against the Android APK, iOS app, and production web application.

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
- [ ] Loading, empty, error, and offline states
- [ ] Responsive behavior and UI consistency
- [ ] Accessibility and native interaction quality
- [ ] Web/native behavior parity

This final audit is not complete, and no `v1.0.0` release tag should be created until it passes and all accepted corrections are resolved.
