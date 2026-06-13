# FREED Store Console Browser Readiness

- JSON artifact: `docs/validation/artifacts/store-console-browser-current/store-console-browser-readiness.json`
- Result: blocked-before-console-product-setup
- Ready for console product setup: false
- Pass/fail: 2 pass, 6 fail
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
- Open Chrome in the signed-in profile intended for Google Play Console and App Store Connect work.
- Confirm the Codex Chrome Extension is installed and enabled in that same selected Chrome profile.
- If the extension is enabled in a different Chrome profile, switch the connector to that profile or install/enable the extension in the selected profile.
- If the Browser or Chrome plugin native module fails before tab discovery, repair or reinstall the bundled Browser/Chrome plugin and rerun this report.
- If the native host is reported invalid, reinstall or repair the Chrome plugin from the Codex plugin UI.
- Rerun the read-only store console readiness command before creating or editing store products.

## Google Play

- Console observed: false
- FREED app record: unconfirmed
- Product setup allowed: false
- Next: Create or identify the Play Console app record for FREED package app.freed.recovery.

## App Store Connect

- Console observed: false
- FREED app record: unconfirmed
- License agreement: unconfirmed
- Product setup allowed: false
- Next: Create or identify the App Store Connect app record for FREED bundle ID app.freed.recovery.

## Blockers

- browser-connector-unavailable
- browser-native-module-load-failed
- google-play-console-not-observed
- google-play-freed-app-record-unconfirmed
- app-store-connect-not-observed
- app-store-connect-freed-app-record-unconfirmed
- app-store-connect-license-agreement-unconfirmed

## Next Actions

- Repair or reinstall the bundled Browser/Chrome plugin native module, then rerun this read-only report before creating or editing store products.
- Create or identify the Google Play app record for FREED package app.freed.recovery.
- Have the Apple Account Holder accept any pending Apple Developer Program License Agreement.
- Create or identify the App Store Connect app record for FREED bundle ID app.freed.recovery.
- Only after both app records exist, configure the Core 3 yearly, monthly, and lifetime products from store/store-products.json.
- Keep store products, builds, and review state in draft/internal/TestFlight until strict release evidence passes.

Boundary: Read-only browser console status only. This report does not prove store products, sandbox purchases, AdMob, legal hosted URLs, physical-device protection, or production submission readiness.

