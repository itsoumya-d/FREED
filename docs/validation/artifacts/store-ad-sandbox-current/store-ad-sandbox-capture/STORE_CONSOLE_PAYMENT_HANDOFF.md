# Store Console Payment Handoff: store-ad-sandbox-current

This is a console setup and sandbox evidence handoff for the Core 3 launch products. It is not production approval.

## Boundaries

- Do not submit production until strict release evidence, physical-device validation, privacy declarations, sandbox purchases, and purchase verification all pass.
- Keep Play releases on internal/draft and App Store builds in TestFlight/App Review prep until the release gate passes.
- Server verification remains required before granting premium entitlement.
- Do not paste raw receipts, purchase tokens, customer identifiers, service-account JSON, private keys, or AdMob secrets into evidence.
- For Play evidence, record the GPA order ID and a sha256-<hex> purchase token hash only. For Apple evidence, record the numeric StoreKit transaction ID only.
- Do not create Core 3 paid products or enter privacy/support/account-deletion URLs while the hosted legal URL audit is failing.
- Do not use this payment handoff for console setup while `STORE_APP_RECORD_ACTION_PACKET.json` reports `blocked-before-hosted-legal-urls`.

## Hosted Legal URL Gate

| Field | Value |
| --- | --- |
| Hosted legal report | docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json |
| Hosted legal report hash | sha256-beb04c914899d5446402aeb1e53a659f7d7e2ec0fba1ec3f9d98301e4b696cd3 |
| Hosted legal result | fail |
| Hosted legal URLs verified | false |
| Store legal URL entry allowed | false |
| Privacy URL | https://freedrecovery.app/privacy |
| Support URL | https://freedrecovery.app/support |
| Account deletion URL | https://freedrecovery.app/account-deletion |
| Failed checks | hosted-fetch-privacy, hosted-fetch-support, hosted-fetch-account-deletion |

Hosted legal URL entry and payment setup are currently blocked. Deploy and verify `/privacy`, `/support`, and `/account-deletion`, regenerate this handoff, then continue.

## Core 3 Launch Products

| Plan | Apple Product ID | Apple Type | Apple Group | Apple Duration | Google Product ID | Google Type | Base Plan | Billing Period | Purchase Type | Offer | USD Intent | Review Screenshot | Screenshot Hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yearly | freed_premium_yearly | auto-renewable-subscription | freed_premium | P1Y | freed_premium_yearly | subscription | yearly | P1Y |  | yearly-standard | 39.99 | store/screenshots/paywall-yearly.png | sha256-27960938520f9ad47fb34c64b3c24d98e06fec616bfacc29a94a0df4ced6388a |
| monthly | freed_premium_monthly | auto-renewable-subscription | freed_premium | P1M | freed_premium_monthly | subscription | monthly | P1M |  | monthly-standard | 9.99 | store/screenshots/paywall-monthly.png | sha256-723643d6c62c4a0b494a8f95369aa210acbb2e53fc659a17fe294330988a469a |
| lifetime | freed_premium_lifetime | non-consumable |  | lifetime | freed_premium_lifetime | one-time-product |  | lifetime | non-consumable |  | 79.99 | store/screenshots/paywall-lifetime.png | sha256-3cb40dfb16d70ccf56fff2cf56fda1e0ef18241ea72eda177a0db79f73c9b83c |

## App Store Connect Setup

- Continue only after the hosted legal URL gate passes and read-only app-record readiness proves the App Store Connect app exists.
- Create monthly and yearly as auto-renewable subscriptions in subscription group `freed_premium`.
- Create lifetime as a non-consumable in-app purchase.
- Attach the review screenshots listed above and keep localizations aligned with `store/app-store/in-app-purchases.csv`.
- Map every purchase to entitlement `premium` only after server verification succeeds.
- Keep any family/accountability/AI products inactive for v1.

## Google Play Console Setup

- Continue only after the hosted legal URL gate passes and read-only app-record readiness proves the Play app exists.
- Create monthly and yearly as subscriptions with base plans `monthly` and `yearly`, billing periods `P1M` and `P1Y`.
- Create lifetime as a one-time non-consumable product.
- Keep product rows aligned with `store/play-store/products.csv` and leave products draft/internal until sandbox evidence passes.
- Map every purchase to entitlement `premium` only after server verification succeeds.
- Keep any family/accountability/AI products inactive for v1.

## Future SKUs Inactive

| Product ID | Launch Status |
| --- | --- |
| freed_family_yearly | inactive-post-launch |
| freed_accountability_monthly | inactive-post-launch |
| freed_ai_coach_monthly | inactive-post-launch |

## Required Production Env Keys

| Key | Expected v1 value |
| --- | --- |
| EXPO_PUBLIC_STORE_PROVIDER | native-iap |
| EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID | premium |
| EXPO_PUBLIC_IAP_PRODUCT_YEARLY | freed_premium_yearly |
| EXPO_PUBLIC_IAP_PRODUCT_MONTHLY | freed_premium_monthly |
| EXPO_PUBLIC_IAP_PRODUCT_LIFETIME | freed_premium_lifetime |
| EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT | https://<production-host>/api/purchases/verify |
| EXPO_PUBLIC_ADMOB_APP_ID_IOS | ca-app-pub-<16-digits>~<10-digits> |
| EXPO_PUBLIC_ADMOB_APP_ID_ANDROID | ca-app-pub-<16-digits>~<10-digits> |
| EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS | ca-app-pub-<16-digits>/<10-digits> |
| EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID | ca-app-pub-<16-digits>/<10-digits> |
| EXPO_PUBLIC_ADMOB_USE_TEST_ADS | false |

Keep `EXPO_PUBLIC_IAP_PRODUCT_FAMILY`, `EXPO_PUBLIC_IAP_PRODUCT_ACCOUNTABILITY`, and `EXPO_PUBLIC_IAP_PRODUCT_AI_COACH` unset or commented for v1.
Do not rely on the legacy generic `FREED_REWARDED_AD_UNIT_ID` for production release checks; configure the platform-specific rewarded unit IDs above so Android AAB, iOS archive, and sandbox evidence use the same keys as release preflight.

## Required Report Commands

Run these with real non-placeholder production env values and attach sanitized local report artifacts:

```bash
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/release-env-preflight-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/purchase-verification-smoke-report.json
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture
```

## Sandbox Evidence Targets

| Evidence | Template or Command Source |
| --- | --- |
| Paywall Core 3 only | paywall-launch-scope-report.template.json |
| Console product setup | store-console-product-setup-report.template.json |
| Rewarded ad request | rewarded-ad-request-report.template.json |
| Free rewarded intervention | store-intervention-flow-report.templates.json |
| Premium no-ad challenge entry | store-intervention-flow-report.templates.json |
| Privacy disclosure review | store-privacy-disclosure-report.template.json |

