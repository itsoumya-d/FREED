# FREED Console Launch Packet

Use this packet when creating or updating the Google Play Console and App Store Connect records for the v1 launch. Keep every store submission on an internal, TestFlight, draft, or otherwise non-production release path until `npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>` passes and the six evidence files in `docs/validation/evidence/` are real promoted device/store evidence.

## Release Scope

- App name: FREED
- Bundle ID: `app.freed.recovery`
- Android package: `app.freed.recovery`
- Category: Health & Fitness
- Privacy Policy URL: `https://freedrecovery.app/privacy`
- Support URL: `https://freedrecovery.app/support`
- Account deletion URL: `https://freedrecovery.app/account-deletion`
- Support email: `support@freedrecovery.app`
- Web hosting: Expo web output is set to `static` so the exported site should include direct `/privacy`, `/support`, and `/account-deletion` HTML routes for store crawlers.
- Store release status before evidence: Play internal track and draft release, App Store Connect/TestFlight beta only.
- Do not submit production until strict release audit, production-env preflight, physical-device evidence, store sandbox evidence, and privacy declarations all pass.
- EAS submit guard: `npm run eas:submit:internal` and `npm run eas:submit:production` both run `scripts/eas-submit-guard.js` before invoking EAS. The guard allows the current draft/internal handoff, but blocks live Play production/review-submit drift unless the owner explicitly sets `FREED_STORE_PRODUCTION_SUBMIT_APPROVED=strict-release-evidence-pass` after every blocker is closed.

## Core 3 Products

Create only these v1 products in both stores:

| Plan | Product ID | Store type | Price intent |
| --- | --- | --- | --- |
| Yearly | `freed_premium_yearly` | App Store auto-renewable subscription; Play subscription | USD 39.99 |
| Monthly | `freed_premium_monthly` | App Store auto-renewable subscription; Play subscription | USD 9.99 |
| Lifetime | `freed_premium_lifetime` | App Store non-consumable; Play one-time product | USD 79.99 |

Use entitlement `premium`. Server verification through `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT` is required before granting premium. Configure App Store Server API credentials and Google Play service-account credentials in the production environment, not in the app bundle or repository.

Future SKUs are disabled for v1 and must not appear in the paywall, purchase calls, store metadata, release preflight, or screenshots: `freed_family_yearly`, `freed_accountability_monthly`, and `freed_ai_coach_monthly`.

Pricing economics source: `store/pricing-economics.md`. The v1 launch uses a conservative 30% store-fee model and an optimized 15% model for eligible small-business/subscription fee tiers. The yearly plan is the primary value anchor at USD 3.33/month equivalent and a 67% discount against monthly. Lifetime is the cashflow anchor with an 8-month breakeven against monthly and a 2-year breakeven against yearly. Validate actual proceeds, local price tiers, taxes, and account-specific fee eligibility in App Store Connect and Play Console before production submission.

Console handoff files:

- App Store Connect IAP rows: `store/app-store/in-app-purchases.csv`
- Google Play product rows: `store/play-store/products.csv`
- Source catalog: `store/store-products.json`
- IAP review screenshots and checksums: `store/screenshots/manifest.json`
- Store listing screenshot capture plan: `store/screenshots/listing-screenshot-plan.md`
- Store listing screenshot manifest template: `store/screenshots/listing/manifest.template.json`
- Draft app-record action packet: `docs/validation/artifacts/<run-id>/store-ad-sandbox-capture/STORE_APP_RECORD_ACTION_PACKET.md` and `.json`

Before opening the store consoles, run `npm run audit:store-catalog`. The current sanitized local precheck is `docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json`; it verifies that the catalog, App Store CSV, Play CSV, and screenshot manifest are Core 3 only, that future family/accountability/AI-coach SKUs are inactive for v1, and that screenshot hashes/dimensions match. This is a local catalog precheck only; it does not prove console products exist or sandbox purchases pass.

Before uploading public App Store or Play listing screenshots, use `store/screenshots/listing-screenshot-plan.md`. Keep listing screenshots separate from the Core 3 IAP review screenshot manifest and do not use them as Android/iOS physical-device protection evidence.

Before recording reviewer/demo permission setup, run `npm run audit:permission-flow`. The current sanitized local precheck is `docs/validation/artifacts/permission-flow-current/permission-flow-source-audit.json`; it verifies that the source still routes users through the strict native permission order and activation-test gate. This is a source-level precheck only; it does not replace Android/iOS physical-device evidence.

Before entering privacy, data safety, app metadata, or review-note answers, run `npm run audit:store-legal`. The current sanitized local precheck is `docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json`; it verifies that the checked-in privacy policy, public legal routes, App Store privacy answers, Play Data Safety sheet, metadata drafts, and platform policy packs remain aligned. This is a local legal/metadata precheck only; it does not prove hosted page availability, legal review, console entry, or platform approval.

Before creating or identifying app records in the logged-in browser, generate the sandbox packet and use `STORE_APP_RECORD_ACTION_PACKET.md`. It contains the exact Play Console and App Store Connect app-record fields, the Browser action-time confirmation token `confirm-draft-store-app-record-creation-only`, the Apple Account Holder license-agreement prerequisite, and hard stops against product setup, review submission, publishing, or rollout. After the app records exist, rerun the read-only Browser readiness command from that packet and do not create Core 3 products until the readiness report proves both app records exist and the Apple agreement is accepted.

Use App Store subscription group `freed_premium` for the yearly and monthly products. In Google Play, use subscription base plans `yearly` with billing period `P1Y` and `monthly` with billing period `P1M`; keep lifetime as a one-time non-consumable product. Keep all three products in draft or inactive/sandbox-only state until server receipt verification, restore, and store/ad sandbox evidence pass.

## Google Play Console Setup

- App access: no restricted login is required for the basic app, but reviewers must be able to reach onboarding, paywall, permission setup, Profile, privacy/support controls, and sample recovery challenge flows in the submitted build.
- Ads: declare ads because free users may see rewarded AdMob reset ads. Production must use real AdMob app IDs and rewarded unit IDs, with `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`.
- Content rating and target audience: position FREED for adults/recovery and do not submit it as a child-directed or Families app.
- Data Safety: complete from `store/play-store/data-safety.md`, `docs/privacy-data-map.md`, and the production env that is actually enabled. The v1 local-first baseline does not collect raw browsing history, full URLs, search text, screenshots, microphone audio, camera roll media, exact background location, Android Ad ID, private notes, payment card details, or store/ad/provider secrets.
- Data deletion: point users to Profile privacy controls, the public account deletion route `https://freedrecovery.app/account-deletion`, and `support@freedrecovery.app`; local data deletion is in-app and hosted/server deletion requests go through support until authenticated account deletion is live.
- AccessibilityService declaration: use `docs/store-policy/android-accessibility-and-fgs-disclosure.md`. FREED uses AccessibilityService only after explicit opt-in for selected browser/search/WebView/app/short-form recovery handoff. It does not take screenshots, run OCR, log keystrokes, inspect private messages, read page contents broadly, or sell AccessibilityService data.
- VpnService declaration: FREED DNS Guard is DNS-only adult-domain filtering. It does not route full traffic, proxy normal traffic, inspect packet payloads beyond DNS questions, decrypt HTTPS, or MITM connections.
- Foreground service special use: DNS Guard stays visible while running and is user-enabled. Evidence must prove lifecycle behavior, visible notification, restart limits, and no full-traffic proxying.
- Upload signing: configure `FREED_ANDROID_UPLOAD_STORE_FILE`, `FREED_ANDROID_UPLOAD_STORE_PASSWORD`, `FREED_ANDROID_UPLOAD_KEY_ALIAS`, and `FREED_ANDROID_UPLOAD_KEY_PASSWORD` outside the repo. Upload the AAB from the `production` EAS profile or `npm run build:android-aab:upload-signed` only after the upload-keystore report is non-debug. Keep `npm run build:android-apk:upload-signed` for signed APK side-load QA and verifier evidence, not Play Console upload.

## App Store Connect Setup

- App Privacy: complete from `store/app-store/app-privacy.md`, `docs/privacy-data-map.md`, `store/privacy-policy.md`, the public `/privacy`, `/support`, and `/account-deletion` routes, and the production env actually enabled. Declare no tracking for the v1 build unless a future ads/analytics change introduces tracking. Purchases, optional aggregate analytics, optional remote AI context, optional encrypted backup sync, optional notification dispatch, and optional challenge weather context must match the enabled production env.
- In-App Purchases: create `freed_premium_yearly`, `freed_premium_monthly`, and `freed_premium_lifetime` only. Put yearly/monthly in a subscription group and configure lifetime as a non-consumable.
- Review notes: use `docs/store-policy/ios-screen-time-safari-dns-review.md`. FREED uses Family Controls, ManagedSettings, DeviceActivity, FamilyActivityPicker, and Safari Content Blocker for recovery protection.
- Screen Time boundary: FREED receives opaque Screen Time tokens and threshold events. It cannot and does not read third-party app screens, native Reels/Shorts/TikTok content, private messages, or in-app content on iOS.
- Safari boundary: FREED's Safari Content Blocker supplies rule lists. It does not receive Safari browsing history or page contents.
- DNS Settings: leave optional iOS DNS Settings disabled unless the signed build has Apple's `dns-settings` entitlement approval and physical-device evidence proves matched-domain DNS behavior without packet tunnel, full VPN, proxying, packet inspection, or HTTPS interception.
- Signed archive: configure `FREED_IOS_DEVELOPMENT_TEAM` or `APPLE_TEAM_ID`, Apple Distribution signing, and any provisioning profile map outside the repo. Produce `ios-release-archive-report.json` with `npm run build:ios-archive:release` before TestFlight review evidence; the report must prove App Store Connect export, IPA hash/size, production bundle IDs, embedded Screen Time/Safari extensions, Family Controls/app-group/Complete Data Protection entitlements, Safari blocker rules, and no packet tunnel/packet inspection entitlements.
- TestFlight: run sandbox purchases, restore, rewarded-ad fallback, premium no-ad flow, permission setup, Safari block/reload, Screen Time shields, DeviceActivity limits, and support/privacy controls before any App Review production submission.

## Required Console Evidence Before Production

- `docs/validation/evidence/store-ad-sandbox.json`: App Store/Play console product setup proof for Core 3 only with future SKUs inactive, App Store/Play sandbox purchase and restore for yearly/monthly/lifetime, Core 3-only paywall proof with future SKUs hidden and yearly value anchor visible, server receipt verification, AdMob rewarded request/completion/failure fallback, premium no-ad flow, and store privacy-disclosure review against `store/play-store/data-safety.md` and `store/app-store/app-privacy.md`.
- `docs/validation/evidence/android-real-browser.json`: physical Android Chrome, Firefox, Edge, Samsung Internet, WebView fixture, DNS Guard, Usage Access, Accessibility, selected app timers, earned unlock/relock, reboot/restart, normal browsing, and Play policy declaration artifacts.
- `docs/validation/evidence/ios-physical-device.json`: physical iPhone Family Controls authorization, FamilyActivityPicker target selection, ManagedSettings adult web filter, DeviceActivity limits, Safari Content Blocker reload/adult block/web short-form block, shield actions, earned unlock/relock, and entitlement/provisioning artifacts.
- `docs/validation/evidence/normal-browsing-corpus.json`: iOS Safari plus Android major-browser false-positive/false-negative corpus.
- `docs/validation/evidence/performance-profile.json`: battery, CPU, RAM, thermal, DNS latency, speed, routing, no-packet-inspection, and no-full-proxy proof.
- `docs/validation/evidence/ai-backend-smoke.json`: deployed CLARA/challenge AI smoke, safety evaluation, redaction, no sensitive echo, and provider fallback proof.

## Build And Submit Commands

Run these only with real production env/secrets loaded outside the repo:

```sh
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/release-env-preflight-report.json
npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-aab-build-report.json
npm run build:ios-archive:release -- --report docs/validation/artifacts/<run-id>/ios-release-archive-report.json
npm run eas:build:internal
npm run eas:build:production
npm run eas:submit:internal
npm run eas:submit:production -- --dry-run
npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>
```

Current Android build note: the latest local Android rebuilds on this Mac can reach `:app:configureCMakeRelWithDebInfo[arm64-v8a]` and then fail with CMake exit 137. Until a local current-source rebuild succeeds on a higher-memory machine, use EAS internal/production Android builds as the current-source artifact path. Record the EAS build URL, source revision, artifact hash, signing mode, and production env preflight report under `docs/validation/artifacts/<run-id>` before using that build for physical QA, Play internal testing, or store sandbox evidence. Do not use the older side-load APK as proof of latest native code or as Play upload evidence.

`npm run eas:submit:production` must remain a draft/internal handoff until the owner explicitly approves production submission after every blocker is closed.
