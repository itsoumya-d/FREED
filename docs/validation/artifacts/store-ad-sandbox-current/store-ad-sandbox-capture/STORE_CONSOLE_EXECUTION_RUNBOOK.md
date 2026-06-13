# Store Console Execution Runbook: store-ad-sandbox-current

Use this while operating the logged-in App Store Connect, Google Play Console, and AdMob accounts. This runbook prepares sandbox/TestFlight/internal-launch payment proof only; it is not permission to submit production.

## Hard Stops

- Do not click Submit for Review, Send for Review, Publish, Promote to production, or Start rollout from this runbook.
- Do not activate post-launch family/accountability/AI-coach products for v1.
- Do not paste raw purchase receipts, purchase tokens, service-account JSON, private keys, push tokens, customer IDs, or account IDs into evidence.
- Redact team IDs, developer IDs, app IDs, account emails, order tokens, dashboard URLs, and any console user/account identifiers before saving screenshots.
- Do not enter privacy/support/account-deletion URLs or configure paid products while the hosted legal URL audit is failing.
- Do not continue console setup while `STORE_APP_RECORD_ACTION_PACKET.json` reports `blocked-before-hosted-legal-urls`; deploy and verify the public legal routes first.
- Do not configure store products until `store-console-product-setup-report.template.json` is backed by a read-only `store-console-browser-readiness.json` report proving both app records exist and the Apple license agreement is accepted.
- Capture evidence under `docs/validation/artifacts/<run-id>/store-ad-sandbox-capture/console-evidence/` and record hashes in `store-console-product-setup-report.template.json`.

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

Hosted legal URL entry and paid-product setup are currently blocked. Deploy and verify `/privacy`, `/support`, and `/account-deletion`, regenerate this packet, then continue.

## Product Source Of Truth

| Plan | Apple Product ID | Apple Type | Apple Group | Apple Duration | Google Product ID | Google Type | Base Plan | Billing Period | Purchase Type | Offer | USD Intent | Review Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yearly | freed_premium_yearly | auto-renewable-subscription | freed_premium | P1Y | freed_premium_yearly | subscription | yearly | P1Y |  | yearly-standard | 39.99 | store/screenshots/paywall-yearly.png |
| monthly | freed_premium_monthly | auto-renewable-subscription | freed_premium | P1M | freed_premium_monthly | subscription | monthly | P1M |  | monthly-standard | 9.99 | store/screenshots/paywall-monthly.png |
| lifetime | freed_premium_lifetime | non-consumable |  | lifetime | freed_premium_lifetime | one-time-product |  | lifetime | non-consumable |  | 79.99 | store/screenshots/paywall-lifetime.png |

Entitlement after server verification: `premium`.
Subscription group: `freed_premium`.

## App Store Connect Execution

1. After the hosted legal gate passes, create or confirm the app record for bundle ID `app.freed.recovery` and keep the build in TestFlight/App Review prep until release evidence passes.
2. Confirm paid-app/IAP agreements, banking, tax, and sandbox tester access are ready outside this evidence file.
3. Rerun read-only Browser readiness and continue only after both app records exist and the Apple license agreement is accepted.
4. Create or confirm subscription group `freed_premium`.
5. Create `freed_premium_yearly` as an auto-renewable yearly subscription in that group with duration `P1Y` and USD intent `39.99`.
6. Create `freed_premium_monthly` as an auto-renewable monthly subscription in that group with duration `P1M` and USD intent `9.99`.
7. Create `freed_premium_lifetime` as a non-consumable in-app purchase with USD intent `79.99`.
8. Add en-US localization/metadata from `store/app-store/in-app-purchases.csv` and attach the matching review screenshot from the table above.
9. Keep future SKUs inactive/not-created for v1: `freed_family_yearly`, `freed_accountability_monthly`, `freed_ai_coach_monthly`.
10. Capture the required redacted App Store Connect evidence screens:

| Screen ID | Capture Requirement |
| --- | --- |
| app-record | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| subscription-group | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| yearly-subscription | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| monthly-subscription | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| lifetime-non-consumable | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| future-skus-inactive | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |

## Google Play Console Execution

1. After the hosted legal gate passes, create or confirm the Play app record for package name `app.freed.recovery` and keep releases internal/draft until release evidence passes.
2. Confirm the merchant profile, license testers, and Play Billing test configuration are ready outside this evidence file.
3. Rerun read-only Browser readiness and continue only after both app records exist and the Apple license agreement is accepted.
4. Create `freed_premium_yearly` as a subscription with base plan `yearly`, billing period `P1Y`, and offer `yearly-standard`.
5. Create `freed_premium_monthly` as a subscription with base plan `monthly`, billing period `P1M`, and offer `monthly-standard`.
6. Create `freed_premium_lifetime` as a one-time non-consumable product with USD intent `79.99`.
7. Add localizations/metadata from `store/play-store/products.csv`.
8. Keep future SKUs inactive/not-created for v1: `freed_family_yearly`, `freed_accountability_monthly`, `freed_ai_coach_monthly`.
9. Capture the required redacted Google Play evidence screens:

| Screen ID | Capture Requirement |
| --- | --- |
| app-record | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| subscriptions-list | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| yearly-base-plan | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| monthly-base-plan | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| lifetime-one-time-product | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |
| future-skus-inactive | Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true. |

## AdMob Execution

1. Create or confirm the AdMob iOS app for bundle ID `app.freed.recovery` and Android app for package `app.freed.recovery`.
2. Create rewarded ad units only for the recovery reset placement; do not create or wire banner, interstitial, app-open, or native ad units for v1.
3. Put the production-format IDs into the production env file, not into evidence JSON: `EXPO_PUBLIC_ADMOB_APP_ID_IOS`, `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`, `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS`, `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID`, and `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`.
4. Capture rewarded-ad proof later with `rewarded-ad-request-report.template.json`; this console runbook does not prove an ad request loaded.

## Filling The Console Product Report

After the console setup is complete, copy `store-console-product-setup-report.template.json` to the local report path referenced by `store.consoleProductSetupArtifact` and update only sanitized fields:

- Set `result` to `store-console-product-setup-captured`.
- Keep `consoleProductSetupProofUsableForManualEvidence=false` while the hosted legal URL gate is failing or store legal URL entry is blocked.
- Set `consoleProductSetupProofUsableForManualEvidence` to `true` only after hosted legal URLs pass, read-only app-record readiness passes, and product evidence is captured.
- Fill `appRecordReadiness` from the latest sanitized `store-console-browser-readiness.json`: keep `storeMutationPerformed=false`, set the Browser report path/hash/run ID, and set every app-record readiness check to true only after Play app record, App Store Connect app record, and Apple license-agreement readiness all pass.
- Set App Store Connect and Google Play `appRecordCreated` to `true` only after both app records exist.
- Fill every `consoleEvidenceArtifacts` row with redacted local artifact paths and matching `sha256-<hex>` hashes.
- Set each launch product `consoleStatus` to a draft/TestFlight/internal/sandbox-safe state, never `production-live`.
- Set `metadataConfigured`, `reviewScreenshotAttached`, and `serverVerificationMetadataConfigured` to `true` only after inspecting the console.
- Set both platform `noExtraLaunchProductsActive` and `draftOrSandboxOnlyUntilEvidencePasses` to `true` only after checking the console lists.
- Set every `checks.*` value to `true` only when the matching source hashes, products, redacted evidence, inactive future SKUs, and draft/internal boundary are proven.

## Follow-Up Gates

```bash
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/release-env-preflight-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/purchase-verification-smoke-report.json
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture
npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence
```

