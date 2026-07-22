# Task 10 release-audit report

## Scope

- Repaired Android install-QA self-test coverage without weakening normal missing-APK validation.
- Updated App Store reviewer notes and the iOS review pack with the present iOS shielding/privacy boundary.
- Regenerated the local store-legal policy audit artifact.
- Replaced stale aggregate release checks with their authoritative classifier/parity, privacy, backend, smoke-harness, store/EAS, Firebase public-SDK, and store-legal sub-audits.
- Updated the two iOS static contracts to match the current identity-bound Screen Time unlock and Safari Focus Shield handoff markers.

## TDD evidence

1. Added `tests/release-audit-repair.test.ts` and ran it before the repair. It failed at `node scripts/android-install-qa.js --self-test`: the self-test's own output-directory assertion followed normal APK validation and failed because no real APK exists.
2. Added focused assertions that self-test parsing accepts a missing default APK, while normal install parsing rejects a missing requested APK. The Android self-test then passed.
3. The legal audit initially failed the App Store review-note gate. The exact reviewer-note and review-pack wording was updated, then `npm run audit:store-legal` regenerated the current artifact with 14 pass / 0 fail.

## Commands and observed results

- `node scripts/android-install-qa.js --self-test` — pass.
- `npm run audit:classifier` — 49 pass / 0 fail.
- `npm run audit:android-classifier` — 15 pass / 0 fail.
- `npm run audit:privacy` — 31 pass / 0 fail.
- `npm run audit:backend` — 16 pass / 0 fail.
- `npm run audit:store-catalog` — 29 pass / 0 fail.
- `npm run audit:eas-workflows` — 14 pass / 0 fail.
- `npm run audit:firebase-config` — pass.
- `npm run audit:store-legal` — 14 pass / 0 fail; regenerated `docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json`.
- `npm run audit:smoke-harnesses` — 94 pass / 0 fail.

## Remaining external gates

This work intentionally does not supply production credentials, signing material, billing/store-console state, deployed legal URLs, or physical-device evidence. Those release gates remain fail-closed, including hosted legal-page availability, production backend/feed/analytics/notification/AI/monetization configuration, upload signing, dependency remediation, and required Android/iOS/device/store-sandbox evidence.
