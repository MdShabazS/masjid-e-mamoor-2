# Phase 14 native Android build evidence — 16 October 2026

`npx expo prebuild --platform android --no-install` generated the native Android
project from `apps/android`. The first online Gradle attempt ran under the
machine default Java 26 and failed during Expo CMake configuration. The installed
JDK 21, `--no-daemon` and in-process Kotlin compiler completed both
`:app:assembleDebug` and `:app:assembleRelease` with Gradle 9.3.1. The prior
offline missing-dependency failure is resolved for this machine.

| Variant | Result | SHA-256 |
|---|---|---|
| `android/app/build/outputs/apk/debug/app-debug.apk` | Built, 133 MB; requires Metro for JavaScript | `e2b43451ef78f3c3435898fc915878195346ab69808b3124256092b7328bf889` |
| `android/app/build/outputs/apk/release/app-release.apk` | Built, 67 MB; JavaScript bundled; installed on Pixel 8 emulator | `be9f6da4eee7f1eb99205cf2726b10e577a7350d6c98f9fb7d5c3a53c6926289` |

`apksigner verify --print-certs` accepted the bundled APK. Its signer is
`CN=Android Debug` with SHA-256 certificate fingerprint
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
`aapt dump badging` reports package `org.masjidemamoor.app.fresh`, versionCode
1, versionName 0.1.0, min SDK 24 and target SDK 36. The generated Gradle release
build type explicitly uses `signingConfigs.debug`; this artifact is for
development smoke testing and must not be published as the masjid release.

On the existing Pixel 8 Android 36 emulator, `adb install -r` succeeded over the
debug variant and `MainActivity` launched. The process remained alive and a
screen capture showed the app's “Supabase connection is not configured” state.
That is expected because no public project URL/key or hosted web API URL was
provided to this build. This proves native packaging, bundled JavaScript and
fail-closed startup, not sign-in or a connected business workflow. The debug
variant showed Metro's missing-script screen until a development server was
available; the bundled variant did not need Metro.

The generated `apps/android/android/` tree is ignored as build output; source
backup and Git should include the Expo source and lockfile, not its 3.7 GB
generated native/build tree. The APK remains in that local ignored tree and
must be rebuilt if the tree is removed.

Still required: permanent package/signing identity decision, a protected
release keystore, environment-scoped URLs and publishable key, named users and
hosted API, real-device and old-to-new upgrade tests, and full Phase 13/14
acceptance. The release manifest guard correctly rejects the current `.fresh`
package.

For build environment selection, see the [Android JDK build guidance](https://developer.android.com/build/jdks).
