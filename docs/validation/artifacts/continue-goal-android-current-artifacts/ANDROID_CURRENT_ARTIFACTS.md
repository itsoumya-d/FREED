# FREED Android Current Artifact Handoff

Generated for the current native protection build after the Android Private DNS route hardening. Refreshed on 2026-06-11 after current-source Android rebuild attempts.

## Current Android Rebuild Status

- Result: blocked locally.
- Latest universal build report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-universal-apk-build-report.json`
- Latest canonical failure report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-universal-apk-build-failure-report.json`
- Latest arm64 default-toolchain report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-arm64-apk-build-report.json`
- Latest arm64 alternate-toolchain report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-arm64-apk-alt-toolchain-build-report.json`
- Rebuild command fixed: `scripts/build-android-release-apk.js` now defaults `newArchEnabled=true`, matching `android/gradle.properties` and React Native 0.83 expectations.
- Remaining failure: Gradle reaches `:app:configureCMakeRelWithDebInfo[arm64-v8a]`, then CMake exits with code 137 under both installed toolchains:
  - Default: CMake `3.22.1`, NDK `27.1.12297006`
  - Alternate: CMake `3.31.0`, NDK `28.2.13676358`
- Boundary: current Android release artifacts are not produced on this host. Use EAS/cloud build or a higher-memory local machine before treating Android APK/AAB evidence as current.

## Legacy Local Download / QA APK Served By Current Handoff

- Path: `docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal.apk`
- Timestamped copy: `docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal-20260610-162547.apk`
- SHA-256: `d8ce331f89ee0de6c121117ac8bbe240ac619895dc8fbb0f7c3b10f806017f05`
- Size: 140.3 MB
- ABIs: armeabi-v7a, arm64-v8a, x86, x86_64
- Build: `npm run build:android-apk -- --arch all --engine hermes --output-dir docs/validation/artifacts/continue-goal-android-current-artifacts/apk --stable-name FREED-release-universal.apk --report docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-universal-apk-build-report.json`
- Build result: a prior Gradle `:app:assembleRelease` passed; the latest current-source rebuild now fails as documented above.
- Local QA result: `localQa.result=pass`, `localInstallArtifactProduced=true`, and `sideLoadReady=true`.
- Release result: still `fail` by design because this artifact is not Play-upload-ready.
- Signing: Android Debug certificate fallback, APK signature verified.
- Runtime: React Native release bundle present, Hermes runtime present, JavaScriptCore runtime absent.
- Boundary: legacy local Android side-load QA only. This APK is not proof of the latest native code, and it is not a Play Console upload artifact because it is debug-signed and uses the local Google sample AdMob app ID fallback.

Local phone download server:

```sh
npm run qa:android-download -- --apk docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal.apk --host 0.0.0.0 --port 8788 --run-id android-download-current
```

Current sanitized download handoff report:

```sh
npm run qa:android-download -- --metadata-only --apk docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal.apk --host 0.0.0.0 --port 8788 --run-id android-download-current --report docs/validation/artifacts/android-download-current/android-apk-download-handoff.json
```

- Path: `docs/validation/artifacts/android-download-current/android-apk-download-handoff.json`
- Schema: `freed-android-apk-download-handoff-v1`
- Boundary: non-promotable; it proves the selected APK hash, local download route, stale-build warning, and follow-up QA commands only. It does not prove install, Android permissions, browser blocking, current native code, or Play readiness.

Shortcut that serves the newest local `FREED-release*.apk` under `docs/validation/artifacts/`:

```sh
npm run qa:android-download:latest
```

Scan the printed terminal QR code from the Android phone, scan the page QR from a desktop browser, or open one of the printed `http://<local-ip>:8788/` URLs on the Android phone. The page serves only the selected APK, `/qr.svg`, and sanitized metadata, and keeps the local-QA-only release boundary visible before download.

Install QA command:

```sh
npm run qa:android-install -- --apk docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal.apk --run-id android-download-current --output-dir docs/validation/artifacts/android-download-current/android-install-qa
```

Plan-only handoff generated for the selected legacy APK:

- Path: `docs/validation/artifacts/android-download-current/android-install-qa-plan.json`
- Schema: `freed-android-install-qa-plan-v1`
- Boundary: non-promotable; it proves the resolved commands and APK hash only. It does not satisfy `android.installQaArtifact` or `checks.androidInstallLaunchQa=true`.

Protection evidence command after install:

```sh
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id android-download-current --output-dir docs/validation/artifacts/android-download-current/android-real-browser-capture
```

For the current native module, verify that Profile > Native Protection still shows the last Android settings route, target component when applicable, and `androidSettingsRouteOpenedAt` after returning from VPN consent, Usage Access, or Accessibility settings. The route is persisted natively so `getStatus()` refreshes should not erase the handoff evidence.

## Retained Older Upload-Signed QA APK

- Path: `docs/validation/artifacts/continue-goal-android-current-artifacts/upload-signed-qa-apk/FREED-upload-signed-qa-arm64.apk`
- Timestamped copy: `docs/validation/artifacts/continue-goal-android-current-artifacts/upload-signed-qa-apk/FREED-upload-signed-qa-arm64-20260607-143500.apk`
- SHA-256: `cf50540a07dcea83f82ac6926aa50f3b1147792ab76e533819b346157a865f49`
- Size: 56.4 MB
- ABIs: arm64-v8a
- Signing: upload signing certificate, non-debug
- Boundary: retained for signing-reference only. Regenerate before using it for current-source install proof.

## Play Upload Blocker

The Play-ready upload-signed APK and AAB launch lanes remain blocked before Gradle until production Android monetization env is configured:

- APK report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-apk-build-report.json`
- AAB report: `docs/validation/artifacts/continue-goal-android-current-artifacts/android-aab-build-report.json`
- Required production Android AdMob app ID: set `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID` or `EXPO_PUBLIC_ADMOB_APP_ID` to a non-sample value matching `ca-app-pub-0000000000000000~0000000000`.
- Required upload signing env: set `FREED_ANDROID_UPLOAD_STORE_FILE`, `FREED_ANDROID_UPLOAD_STORE_PASSWORD`, `FREED_ANDROID_UPLOAD_KEY_ALIAS`, and `FREED_ANDROID_UPLOAD_KEY_PASSWORD` with a non-debug upload keystore.

Launch monetization still also requires the production rewarded ad unit and purchase verification settings from the release preflight before Play upload or store submission can be treated as ready.
