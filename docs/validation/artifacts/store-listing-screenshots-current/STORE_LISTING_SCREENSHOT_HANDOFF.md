# FREED Store Listing Screenshot Handoff

Generated: 2026-06-11T08:25:20.656Z
Result: ready-for-signed-build-capture
Ready for signed-build capture: true
Ready for store upload: false
Final manifest: `store/screenshots/listing/manifest.json`
Final manifest status: pending-signed-build-capture

## Capture Rows

- turn-on-real-protection: TURN ON REAL PROTECTION - protection setup checklist, 1290x2796
- block-adult-sites-safely: BLOCK ADULT SITES SAFELY - activation test passed, 1290x2796
- interrupt-app-loops: INTERRUPT APP LOOPS - selected app limits, 1290x2796
- recover-in-the-moment: RECOVER IN THE MOMENT - recovery challenge, 1290x2796
- keep-privacy-local: KEEP PRIVACY LOCAL - privacy controls, 1290x2796
- upgrade-without-ad-breaks: UPGRADE WITHOUT AD BREAKS - Core 3 paywall, 1290x2796

## Commands

- Refresh EAS handoff: `npm run evidence:eas-build-handoff -- --run-id eas-build-current --output-dir docs/validation/artifacts/eas-build-current`
- Validate final catalog: `npm run audit:store-catalog -- --report docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json`
- Refresh launch status: `npm run status:launch -- --run-id launch-status --output-dir docs/validation/artifacts/launch-status-current`

## Checks

- PASS: listing-plan-present - Listing screenshot plan exists.
- PASS: listing-copy-concepts-present - Listing plan/template cover the six approved public listing concepts.
- PASS: listing-template-valid-for-capture - Listing screenshot template has required concept, dimension, headline, screen, and review-boundary fields.
- PASS: signed-build-dependency-ready - EAS current-source build handoff is ready for an approved signed-build capture.
- PASS: final-manifest-not-faked - Final listing manifest is still absent, so no fake public screenshots are being treated as upload-ready.

## Boundary

Store listing screenshot capture handoff only. This does not prove final screenshots exist, are from a signed build, were uploaded to stores, or satisfy physical-device protection evidence.

