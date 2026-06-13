# FREED EAS Build Attempt

Generated: 2026-06-11T08:44:22.464Z
Result: blocked-before-eas-build-auth
Ready for current-source artifact: false
Release evidence satisfied: false

## Target

- Platform: android
- Profile: internal
- Artifact type: apk
- Build command: `npm run eas:build:internal -- --platform android --non-interactive`

## Attempt

- Status: blocked-not-logged-in
- Attempt type: auth-check
- Exit code: 1
- Observed message code: not-logged-in

## Checks

- FAIL: eas-authenticated - EAS CLI auth check reported not logged in before an EAS build could start.
- FAIL: eas-build-request-submitted - EAS build request was not submitted.
- FAIL: eas-build-receipts-complete - Completed-build receipts are not complete yet.

## Next Actions

- Run npx eas-cli@latest login with the Expo account that owns the FREED EAS project.
- Retry npm run eas:build:internal -- --platform android --non-interactive.
- After the build starts, rerun this receipt with status submitted or completed and the EAS build URL/ID.

## Boundary

EAS build attempt receipt only. This does not prove an artifact exists, was installed on a physical device, passed protection QA, was uploaded to a store, or passed release evidence.

