# FREED EAS Build Handoff

Generated: 2026-06-11T08:10:45.947Z
Result: ready-for-approved-eas-build
Ready for approved EAS build: true

## Local Android Blocker

- Report: `docs/validation/artifacts/android-current-apk-retry/android-apk-build-report.json`
- Result: fail
- Failed task: `:app:configureCMakeRelWithDebInfo[arm64-v8a]`
- CMake exit 137: true
- React Native forced New Architecture: true

## EAS Commands

- CLI invocation: `npx eas-cli@latest`
- npx available: true (`../../../../../opt/homebrew/bin/npx`)
- Android internal APK: `npm run eas:build:internal -- --platform android --non-interactive`
- Android Play AAB: `npm run eas:build:production -- --platform android --non-interactive`
- iOS internal: `npm run eas:build:internal -- --platform ios --non-interactive`
- iOS production: `npm run eas:build:production -- --platform ios --non-interactive`

## Required Receipts

- EAS build URL
- EAS build ID
- Git/source revision used by EAS
- Profile name: internal for QA APK or production for Play AAB/App Store IPA
- Platform: android or ios
- Artifact type: apk, aab, app, or ipa
- Artifact SHA-256 and byte size
- Android signing mode or iOS distribution signing summary
- Production env preflight report path for store artifacts
- Physical-device install/protection QA run ID before evidence promotion

## Checks

- PASS: eas-json-present - eas.json is present and parseable.
- PASS: internal-android-apk-profile - EAS internal profile builds Android APK artifacts for physical QA.
- PASS: production-android-aab-profile - EAS production profile builds Android App Bundle artifacts for Play.
- PASS: production-submit-draft-internal - Production submit profile is constrained to Play internal track with draft release status.
- PASS: internal-workflow-manual - Internal workflow is manually triggered and contains build jobs.
- PASS: store-workflow-manual-no-submit - Store workflow is manually triggered, builds store artifacts, and does not auto-submit.
- PASS: eas-cli-runner-available - npx is available for npx eas-cli@latest commands at ../../../../../opt/homebrew/bin/npx.
- PASS: local-android-cmake-blocker-captured - Current local Android source build blocker is captured as CMake exit 137.
- PASS: legacy-apk-boundary-captured - Legacy downloadable APK still exists only as a side-load support artifact.

Boundary: EAS handoff only. This report does not prove an EAS build was run, that artifacts exist, that stores accepted uploads, or that physical-device protection evidence passed.

