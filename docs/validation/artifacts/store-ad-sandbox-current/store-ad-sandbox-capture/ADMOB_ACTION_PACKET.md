# AdMob Action Packet: store-ad-sandbox-current-admob-action

This packet is for creating or identifying FREED AdMob app records and rewarded reset ad units. It is not approval to publish, roll out, or add other ad placements.

## Current Status

- Result: blocked-before-admob-env-ready
- Current blocker: android-upload-signing-blocked-by-production-admob
- iOS bundle ID: `app.freed.recovery`
- Android package: `app.freed.recovery`

## Required Confirmation

Before any AdMob console mutation, confirm: `confirm-admob-app-and-rewarded-unit-creation-only`.

Confirm before creating or identifying AdMob iOS/Android app records and rewarded reset ad units for FREED. This is not approval to enable production rollout or add banner/interstitial/app-open/native ad placements.

## Hard Stops

- Do not create banner, interstitial, app-open, or native ad units for v1.
- Do not paste AdMob account IDs, payment IDs, ad response payloads, device identifiers, service-account JSON, or private account screenshots into evidence.
- Do not enable personalized ad targeting from FREED recovery context; rewarded requests must remain non-personalized and coarse-country only.
- Do not treat AdMob app/unit creation as release evidence until a real rewarded request and store/ad sandbox evidence pass.

## Action Order

| Step | Platform | Current status | Action |
| --- | --- | --- | --- |
| admob-ios-app | admob | missing-production-env | Create or identify the AdMob iOS app for bundle ID app.freed.recovery. |
| admob-android-app | admob | missing-production-env | Create or identify the AdMob Android app for package app.freed.recovery. |
| ios-rewarded-reset-unit | admob | missing-production-env | Create or identify exactly one iOS rewarded ad unit for the recovery reset challenge gate. |
| android-rewarded-reset-unit | admob | missing-production-env | Create or identify exactly one Android rewarded ad unit for the recovery reset challenge gate. |
| rewarded-request-proof | device-qa | pending-manual-qa | Fill rewarded-ad-request-report.template.json only after a real rewarded response loads with non-personalized/coarse-country request proof and no banner/interstitial/app-open/native requests. |

## Production Env Keys

| Key | Expected | Configured in capture | Stored in evidence |
| --- | --- | --- | --- |
| EXPO_PUBLIC_ADMOB_APP_ID_IOS | ca-app-pub-<16-digits>~<10-digits> | false | false |
| EXPO_PUBLIC_ADMOB_APP_ID_ANDROID | ca-app-pub-<16-digits>~<10-digits> | false | false |
| EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS | ca-app-pub-<16-digits>/<10-digits> | false | false |
| EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID | ca-app-pub-<16-digits>/<10-digits> | false | false |
| EXPO_PUBLIC_ADMOB_USE_TEST_ADS | false | true | false |

## Placement Policy

- Allowed formats: `rewarded`
- Forbidden formats: `banner`, `interstitial`, `app-open`, `native`
- Placement: free recovery reset challenge gate
- Premium behavior: verified premium entitlement skips rewarded ads before challenge entry
- Failure behavior: ad load/show failure opens the recovery challenge without retry loops or punishment
- Personalization: non-personalized request with coarse country context only

## Follow-Up

- Read-only AdMob readiness: `npm run evidence:admob-console-browser -- --admob-console-observed --admob-ios-app-present --admob-android-app-present --ios-rewarded-unit-present --android-rewarded-unit-present --no-forbidden-formats-observed`
- Read-only AdMob readiness artifact: `docs/validation/artifacts/admob-console-current/admob-console-readiness.json`
- AdMob env patch template: `ADMOB_ENV_PATCH.template.env`
- Preflight: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/release-env-preflight-report.json`
- Regenerate store/ad sandbox packet: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture`
- Rewarded request template: `rewarded-ad-request-report.template.json`
- Android upload-signed AAB after AdMob env is real: `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-aab-build-report.json`

