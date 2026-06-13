# Local iOS Simulator Smoke

Date: 2026-05-14

Device: iPhone 17 Pro Max simulator, iOS 26.2, UDID `4E748628-BD69-48F2-B02B-9A6402FC8389`

Bundle ID: `app.freed.recovery`

This is local simulator evidence only. It does not satisfy the release gates that require physical-device Screen Time, browser, store/ad, AI backend, or performance evidence.

## Commands Run

- `xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/FREED-ceswmgewahqetjauiirtejvupcwu/Build/Products/Debug-iphonesimulator/FREED.app`
- `xcrun simctl launch --terminate-running-process booted app.freed.recovery`
- `EXPO_NO_TELEMETRY=1 npx expo start --localhost --port 8081 --clear`
- `xcrun simctl launch --terminate-running-process booted app.freed.recovery`
- `xcrun simctl io booted screenshot docs/validation/artifacts/local-simulator-smoke/ios-launch-warm-metro-2.png`
- `npm run smoke:ios-simulator -- --output docs/validation/artifacts/local-simulator-smoke/ios-smoke-script.png --launch-wait-ms 12000`
- `xcrun simctl io booted screenshot docs/validation/artifacts/local-simulator-smoke/ios-smoke-script-late.png`
- `npm run smoke:ios-simulator -- --output docs/validation/artifacts/local-simulator-smoke/ios-smoke-script-rendered.png`
- `node -c scripts/ios-simulator-smoke.js`
- `node scripts/ios-simulator-smoke.js --help`
- `node scripts/ios-simulator-smoke.js --self-test`

## Result

- Native install and launch worked.
- Debug simulator builds do not embed the JavaScript bundle because the Xcode build phase exports `SKIP_BUNDLING=1`.
- Launching without Metro showed the expected React Native redbox: `No script URL provided`.
- Launching while Metro was cold first showed `Loading from Metro...`, then a transient `Could not connect to development server` redbox from the request made before the bundle was ready.
- Metro completed the cold bundle in `700823ms` for `node_modules/expo-router/entry.js` with `3101 modules`.
- Relaunching against the warm Metro server rendered the FREED home UI.
- The scripted smoke now warms the bundle before launch, uses a 30-second default screenshot delay, captures a rendered FREED home-screen artifact, and stops Metro when complete. A deliberately shorter 12-second run captured the splash screen first, and a later screenshot confirmed the FREED home UI rendered.
- `scripts/ios-simulator-smoke.js` now scans recent simulator logs for app-specific crash/redbox signals after screenshot capture, fails the smoke run if it sees errors such as `No script URL provided`, `Could not connect to development server`, `Unhandled JS Exception`, `RCTFatal`, `NSException`, `SIGABRT`, or `EXC_CRASH`, audits the captured PNG for dimensions, visible pixels, color variety, and luminance variance, and writes a metadata JSON sidecar next to the screenshot by default. Use `--metadata-output` for a custom JSON path and `--skip-log-scan` only when deliberately debugging simulator log access.
- `node scripts/ios-simulator-smoke.js --self-test` passes offline parser checks for clean launch, React Native redbox, native exception, and unrelated app crash detection.
- `node scripts/lib/png-screenshot-audit.js --self-test` passes offline PNG checks for useful, solid, tiny, and malformed screenshots.

## Artifacts

- `ios-launch.png`: launch without Metro, shows `No script URL provided`.
- `ios-launch-with-metro.png`: early capture while Metro was still building, shows `Loading from Metro...`.
- `ios-launch-rendered.png`: stale redbox from the first request before Metro finished.
- `ios-launch-warm-metro.png`: intermediate warm relaunch capture before first painted UI.
- `ios-launch-warm-metro-2.png`: passing warm-Metro render of the FREED home UI.
- `ios-smoke-script.png`: scripted smoke with a 12-second custom wait, captured the FREED splash/loading screen.
- `ios-smoke-script-late.png`: later screenshot from the same scripted launch, captured the FREED home UI.
- `ios-smoke-script-rendered.png`: scripted smoke with the default 30-second wait, captured the FREED home UI.

Future scripted smoke runs write a matching `.json` metadata sidecar beside the screenshot unless `--metadata-output <path>` is supplied. The sidecar includes a `screenshot` analysis block with dimensions, sampled color count, visible-pixel ratio, luminance variance, and any nonblank-render failures.
