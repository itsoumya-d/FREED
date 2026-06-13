# Local Android Emulator Smoke

Date: 2026-05-14

Package: `app.freed.recovery`

Default APK: `android/app/build/outputs/apk/release/app-release.apk`

QA WebView fixture APK: `android/qa-webview-fixture/build/outputs/apk/debug/qa-webview-fixture-debug.apk`

This is local emulator/device smoke infrastructure only. It does not satisfy the release gates that require physical-device browser, store/ad, normal-browsing corpus, or performance evidence.

## Commands Run

- `adb devices -l`
- `node -c scripts/android-emulator-smoke.js`
- `node scripts/android-emulator-smoke.js --help`
- `node scripts/android-emulator-smoke.js --self-test`
- `CI=1 EXPO_NO_TELEMETRY=1 npx expo export:embed --platform android --dev false --minify true --entry-file node_modules/expo-router/entry.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res`
- `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a`
- `npm run smoke:android-emulator -- --device emulator-5554 --apk android/app/build/outputs/apk/release/app-release.apk --install-fixture --clear-app-data --output docs/validation/artifacts/local-android-emulator-smoke/android-smoke-rendered-release-default-avd.png --launch-wait-ms 60000`

## Result

- The Android debug APK exists at `android/app/build/outputs/apk/debug/app-debug.apk`.
- The Android release APK exists at `android/app/build/outputs/apk/release/app-release.apk` and is 56 MB on this arm64 release build.
- The QA WebView fixture APK exists at `android/qa-webview-fixture/build/outputs/apk/debug/qa-webview-fixture-debug.apk`.
- `npm run smoke:android-emulator` installed the release APK and QA WebView fixture on `FREED_Default_API35` (`Android SDK built for arm64`, Android 15), cleared app data, launched `app.freed.recovery/.MainActivity`, and captured `android-smoke-rendered-release-default-avd.png`.
- Launch metadata reported `LaunchState: COLD`, `TotalTime: 1079`, and `WaitTime: 1082`.
- Filtered logcat after launch showed `ReactNativeJS: Running "main"` and `Displayed app.freed.recovery/.MainActivity for user 0: +1s79ms`, with no matching app `FATAL EXCEPTION` or ANR lines in the checked window.
- `scripts/android-emulator-smoke.js` now clears logcat before launch, scans post-launch logcat for package-specific crash/ANR signals by default, fails the smoke run if one is found, audits the captured PNG for dimensions, visible pixels, color variety, and luminance variance, writes a metadata JSON sidecar next to the screenshot by default, and includes compact `logcat` and `screenshot` summaries in that metadata. Use `--metadata-output` for a custom JSON path and `--skip-logcat-scan` only when deliberately debugging an adb/logcat issue.
- `node scripts/android-emulator-smoke.js --self-test` passes offline parser checks for clean launch, app crash, app ANR, unrelated crash, and missing Play Store warning detection.
- `node scripts/lib/png-screenshot-audit.js --self-test` passes offline PNG checks for useful, solid, tiny, and malformed screenshots.
- The default AVD does not include Google Play Store, so logs include `app.freed.recovery requires the Google Play Store, but it is missing`; live IAP/ad sandbox validation still requires a Play image or physical device with store services.

## Debug APK Notes

- Debug APKs are still useful for native compile checks, but they are not standalone release-smoke evidence because React Native debug builds expect Metro at `localhost:8081`.
- The Android embed command now passes `--dev false --minify true` so the embedded bundle has `__DEV__=false`; this fixed the previous embedded-devtools redbox seen in earlier debug screenshots.
- `scripts/android-emulator-smoke.js` uses `adb install --no-streaming -r`, which avoided streamed-install hangs with large APKs.
- `android/app/src/main/AndroidManifest.xml` replaces Expo Notifications' receiver without `MY_PACKAGE_REPLACED`, preventing package-install broadcasts from starting FREED in the background before the explicit smoke launch.

## Repeatable Smoke Command

When an emulator or Android device is attached and a release APK has been built:

```sh
npm run smoke:android-emulator -- --apk android/app/build/outputs/apk/release/app-release.apk --install-fixture --clear-app-data --output docs/validation/artifacts/local-android-emulator-smoke/android-smoke-rendered-release-default-avd.png
```

This writes `android-smoke-rendered-release-default-avd.json` beside the screenshot unless `--metadata-output <path>` is supplied. The sidecar includes a `screenshot` analysis block with dimensions, sampled color count, visible-pixel ratio, luminance variance, and any nonblank-render failures.

Optional focused-WebView fixture install:

```sh
npm run smoke:android-emulator -- --install-fixture --output docs/validation/artifacts/local-android-emulator-smoke/android-smoke-with-fixture.png
```

If more than one Android target is attached, pass the serial from `adb devices -l`:

```sh
npm run smoke:android-emulator -- --device <serial> --output docs/validation/artifacts/local-android-emulator-smoke/android-smoke-rendered.png
```
