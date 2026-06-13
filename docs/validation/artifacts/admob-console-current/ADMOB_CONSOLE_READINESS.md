# FREED AdMob Console Readiness

- JSON artifact: `docs/validation/artifacts/admob-console-current/admob-console-readiness.json`
- Result: blocked-before-admob-console-ready
- Ready for rewarded-ad request proof: false
- Pass/fail: 2 pass, 7 fail
- Read-only inspection: true
- Browser connector: native-module-load-failed
- App: FREED
- Bundle ID: `app.freed.recovery`
- Android package: `app.freed.recovery`

## Browser Connector

- Connector unavailable: true
- Native module load failed: true
- Selected Chrome profile extension missing: false
- Extension present in another Chrome profile: false
- Native host manifest OK: null
- Profile names stored: false
- Profile paths stored: false
- Repair handoff required: true

Repair checklist:
- Open Chrome in the signed-in profile intended for AdMob work.
- Confirm the Codex Chrome Extension is installed and enabled in that same selected Chrome profile.
- If the extension is enabled in a different Chrome profile, switch the connector to that profile or install/enable the extension in the selected profile.
- If the Browser or Chrome plugin native module fails before tab discovery, repair or reinstall the bundled Browser/Chrome plugin and rerun this report.
- If the native host is reported invalid, reinstall or repair the Chrome plugin from the Codex plugin UI.
- Rerun the read-only AdMob readiness command before creating or editing AdMob apps or units.

## AdMob

- Console observed: false
- iOS app: unconfirmed
- Android app: unconfirmed
- iOS rewarded unit: unconfirmed
- Android rewarded unit: unconfirmed
- No forbidden formats observed: false
- Allowed formats: `rewarded`
- Forbidden formats: `banner`, `interstitial`, `app-open`, `native`

## Blockers

- browser-connector-unavailable
- browser-native-module-load-failed
- admob-console-not-observed
- admob-ios-app-unconfirmed
- admob-android-app-unconfirmed
- ios-rewarded-reset-unit-unconfirmed
- android-rewarded-reset-unit-unconfirmed
- forbidden-ad-formats-unconfirmed

## Next Actions

- Repair or reinstall the bundled Browser/Chrome plugin native module, then rerun this read-only AdMob report before creating or editing ad apps or units.
- Create or identify the iOS AdMob app for FREED bundle app.freed.recovery.
- Create or identify the Android AdMob app for FREED package app.freed.recovery.
- Create exactly one rewarded reset ad unit per platform for the recovery challenge gate.
- Store the four production AdMob IDs in the production env file outside the repo.
- Rerun this read-only report, then fill rewarded-ad-request-report.template.json only after a real rewarded response loads on device.

Boundary: Read-only AdMob console status only. This report does not prove rewarded ads load, sandbox purchases pass, premium no-ad behavior works, physical-device protection works, or production submission readiness.

