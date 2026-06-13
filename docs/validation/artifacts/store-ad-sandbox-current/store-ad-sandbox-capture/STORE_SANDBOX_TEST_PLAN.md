# Store Sandbox Test Plan: store-ad-sandbox-current

Use this plan after the draft app records, Core 3 products, purchase-verification backend, and sandbox tester access exist. It is a QA execution plan, not production approval.

## Hard Stops

- Do not click Submit for Review, Send for Review, Publish, Promote to production, Start rollout, or equivalent production actions.
- Do not activate family, accountability, or AI-coach products for v1.
- Do not paste raw Apple receipts, Play purchase tokens, service-account JSON, private keys, AdMob secrets, customer IDs, account emails, or console account identifiers into evidence.
- Record Apple purchases by numeric StoreKit transaction ID only.
- Record Play purchases by GPA order ID plus a sha256-<hex> purchase-token hash only.
- Do not start sandbox purchases while the hosted legal URL audit is failing or `STORE_APP_RECORD_ACTION_PACKET.json` is blocked before hosted legal URLs.

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

Hosted legal URL entry is currently blocked. Do not begin store sandbox purchases until `/privacy`, `/support`, and `/account-deletion` pass hosted audit and this plan is regenerated.

## Prerequisites

- Hosted legal URL audit passes and the store app-record action packet no longer reports `blocked-before-hosted-legal-urls`.
- `store-console-product-setup-report.template.json` has been filled from redacted App Store Connect, Google Play, and AdMob console evidence.
- App Store sandbox testers and Play license testers can purchase without production charging.
- The production env file has real Core 3 product IDs, platform AdMob app IDs, platform rewarded-unit IDs, and `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT` for `/api/purchases/verify`.
- Product types match the launch catalog: yearly/monthly are recurring subscriptions, lifetime is non-consumable on App Store and one-time non-consumable on Play.
- `npm run preflight:release-env -- --env-file <production-env-file>` passes and writes a sanitized report.
- `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json` passes against the deployed purchase endpoint.

## Core 3 Sandbox Matrix

| Plan | Apple Product ID | Apple Type | Apple Duration | Apple Purchase Run | Apple Restore Run | Play Product ID | Play Type | Play Base Plan | Play Billing/Purchase | Play Purchase Run | Play Restore Run | Server Verify Run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yearly | freed_premium_yearly | auto-renewable-subscription | P1Y | store-ad-sandbox-current-ios-yearly-purchase-sandbox | store-ad-sandbox-current-ios-yearly-restore-sandbox | freed_premium_yearly | subscription | yearly | P1Y | store-ad-sandbox-current-android-yearly-purchase-sandbox | store-ad-sandbox-current-android-yearly-restore-sandbox | store-ad-sandbox-current-yearly-purchase-verification-smoke |
| monthly | freed_premium_monthly | auto-renewable-subscription | P1M | store-ad-sandbox-current-ios-monthly-purchase-sandbox | store-ad-sandbox-current-ios-monthly-restore-sandbox | freed_premium_monthly | subscription | monthly | P1M | store-ad-sandbox-current-android-monthly-purchase-sandbox | store-ad-sandbox-current-android-monthly-restore-sandbox | store-ad-sandbox-current-monthly-purchase-verification-smoke |
| lifetime | freed_premium_lifetime | non-consumable | lifetime | store-ad-sandbox-current-ios-lifetime-purchase-sandbox | store-ad-sandbox-current-ios-lifetime-restore-sandbox | freed_premium_lifetime | one-time-product |  | non-consumable | store-ad-sandbox-current-android-lifetime-purchase-sandbox | store-ad-sandbox-current-android-lifetime-restore-sandbox | store-ad-sandbox-current-lifetime-purchase-verification-smoke |

Every row must grant entitlement `premium` only after server verification succeeds.
Do not proceed if the yearly/monthly rows are not subscriptions, or if lifetime is not a non-consumable / one-time product in the relevant store console.

## Product Test Loop

For each yearly, monthly, and lifetime row:

1. Confirm the paywall shows only Core 3 products, yearly as the value anchor, restore visible, purchase buttons enabled, server-verification copy visible, and premium no-ad value visible.
2. Run the App Store sandbox purchase in TestFlight or the signed sandbox build. Save a redacted local proof artifact and record only the numeric StoreKit transaction ID.
3. Delete/reinstall or clear entitlement state as appropriate, then run App Store restore. Save the redacted restore proof and verified entitlement state.
4. Run the Play Billing license-test purchase on Android. Save a redacted local proof artifact, the GPA order ID, and a sha256 hash label of the purchase token.
5. Delete/reinstall or clear entitlement state as appropriate, then run Play restore. Save the redacted restore proof and verified entitlement state.
6. Attach the sanitized `purchase-verification-smoke-v1` report for purchase and restore verification. It must include Core 3 yearly/monthly/lifetime PASS rows, endpoint validation, rejection-proof booleans, checked secret-key names, and no raw receipt/token/order/package echo.

## Rewarded Ad And Intervention Flows

| Flow | Run ID | Evidence Field | Latency Requirement |
| --- | --- | --- | --- |
| free-rewarded-intervention | store-ad-sandbox-current-free-rewarded-intervention | store.freeRewardedInterventionArtifact | 5000 ms max |
| rewarded-ad-completion | store-ad-sandbox-current-rewarded-ad-completion | store.rewardedAdCompletionArtifact | no latency ceiling |
| ad-failure-fallback | store-ad-sandbox-current-ad-failure-fallback | store.adFailureFallbackArtifact | no latency ceiling |
| premium-no-ad-intervention | store-ad-sandbox-current-premium-no-ad-intervention | store.premiumNoAdInterventionArtifact | 3000 ms max |

Additional ad proof requirements:

- `rewarded-ad-request-report.template.json` must be filled only after a real rewarded ad response loads with platform-specific production-format AdMob IDs.
- The request must be non-personalized, use coarse country context only, and prove no banner, interstitial, app-open, or native ad unit was requested.
- Free users must see a rewarded-ad gate before challenge entry.
- Rewarded completion must grant challenge access only, not premium.
- Ad failure must open the recovery challenge without a retry loop or punishment.
- Premium users must skip rewarded ad requests and enter challenge mode within 3000 ms after entitlement verification.

## Final Evidence Assembly

- Copy `store-ad-sandbox-evidence-fill-template.json` into the draft evidence package only after all artifacts above are real and sanitized.
- Set every `store.launchProductSandboxMatrix[]` purchase/restore/server-verification boolean to true only for products actually tested in both stores.
- Keep `checks.storeConsoleProductsConfigured`, `checks.paywallCore3OnlyShown`, `checks.rewardedAdLoaded`, `checks.noInterstitialOrBannerAdsRequested`, `checks.premiumNoRewardedAdRequested`, and `checks.storePrivacyDisclosureReviewed` false until their local proof artifacts pass.
- Validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence` before promotion.

