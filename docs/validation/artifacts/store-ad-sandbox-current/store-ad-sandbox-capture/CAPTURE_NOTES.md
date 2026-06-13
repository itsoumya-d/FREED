# Store/Ad Sandbox Capture: store-ad-sandbox-current

This folder contains a sandbox QA plan. It does not satisfy release evidence by itself.
Manifest boundary: `Store/ad sandbox capture packets are setup handoffs only. They do not prove console products, sandbox purchase/restore, production AdMob, rewarded-ad behavior, premium no-ad behavior, or privacy disclosure review until real QA fills and validates store-ad-sandbox.json.`
Evidence satisfied: `false`

Never store these fields in evidence:

- iosReceipt
- appStoreReceipt
- appleReceipt
- rawReceipt
- receiptData
- purchaseReceipt
- rawPurchaseReceipt
- customerId
- customerIdentifier
- appUserId
- adNetworkSecret
- adMobAppSecret
- appStorePrivateKey
- appStoreServerApiJwt
- googlePlayServiceAccountJson
- googlePlayAccessToken
- androidPurchaseToken

Manual capture checklist:

- store-ad-sandbox-current-release-env-preflight: Run npm run preflight:release-env and attach the passing command log. Suggested artifact: `store.releasePreflightArtifact`. Metrics: `store.releasePreflightCommand, store.releasePreflightRunId, checks.releaseEnvPreflightPassed`.
- store-ad-sandbox-current-purchase-verification-smoke: Run npm run smoke:purchase-verification with --report docs/validation/artifacts/store-ad-sandbox-current/purchase-verification-smoke-report.json against the deployed purchase endpoint, attach that local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 yearly/monthly/lifetime fake-known PASS rows, matching launchProductIdsChecked as store.purchaseVerificationArtifact and as each launch matrix purchaseVerificationArtifact, and keep store.purchaseSmokeCommand in the sanctioned command shape. Suggested artifact: `store.purchaseVerificationArtifact`. Metrics: `store.purchaseSmokeCommand, store.purchaseVerificationPassCount, store.purchaseVerificationFailedCount`.
- store-ad-sandbox-current-restore-verification-smoke: Attach a local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 yearly/monthly/lifetime fake-known PASS rows, matching launchProductIdsChecked, and the same required PASS result rows as store.restoreVerificationArtifact plus each launch matrix restoreVerificationArtifact, proving restore entitlement verification still uses the deployed fail-closed purchase endpoint without raw receipt or token echo. Suggested artifact: `store.restoreVerificationArtifact`. Metrics: `store.restoreVerificationReportId, store.restoreVerificationPassCount, store.restoreVerificationFailedCount`.
- store-ad-sandbox-current-ios-purchase-sandbox: Record an App Store sandbox purchase with a numeric StoreKit transaction ID. Suggested artifact: `store.iosPurchaseArtifact`. Metrics: `store.iosPurchaseTransactionId`.
- store-ad-sandbox-current-ios-restore-sandbox: Record App Store restore and server entitlement verification. Suggested artifact: `store.iosRestoreArtifact`. Metrics: `store.iosRestoreTransactionId`.
- store-ad-sandbox-current-android-purchase-sandbox: Record Play Billing test purchase with GPA order ID and a sha256 hash label of the token. Suggested artifact: `store.androidPurchaseArtifact`. Metrics: `store.androidOrderId, store.androidPurchaseTokenHash`.
- store-ad-sandbox-current-android-restore-sandbox: Record Play Billing restore and verified entitlement state. Suggested artifact: `store.androidRestoreArtifact`. Metrics: `store.restoreVerificationPassCount, store.restoreVerificationFailedCount`.
- store-ad-sandbox-current-paywall-launch-scope: Capture the submitted paywall UI and attach a local freed-paywall-launch-scope-report-v1 JSON proof that Core 3 yearly/monthly/lifetime are the only visible purchase products, post-launch family/accountability/AI-coach products are hidden, yearly is the value anchor, restore is visible, and purchase buttons are enabled. Suggested artifact: `store.paywallLaunchScopeArtifact`. Metrics: `store.paywallScopeRunId, checks.paywallCore3OnlyShown`.
- store-ad-sandbox-current-store-console-product-setup: Capture App Store Connect and Play Console product setup proof for Core 3 only: read-only Browser app-record readiness, monthly/yearly subscriptions, lifetime non-consumable/one-time product, attached screenshots/localizations, server-verification metadata, redacted console evidence artifacts with matching hashes, future SKUs inactive, and draft/internal/TestFlight-only status until evidence passes. Suggested artifact: `store.consoleProductSetupArtifact`. Metrics: `store.consoleProductSetupRunId, checks.storeConsoleProductsConfigured`.
- store-ad-sandbox-current-rewarded-ad-request: Capture a loaded rewarded ad response using platform-specific production AdMob app and rewarded unit IDs, non-personalized settings, and prove no banner, interstitial, app-open, or native ad request path was used. Suggested artifact: `store.rewardedAdRequestArtifact`. Metrics: `store.adMobAppIdIos, store.adMobAppIdAndroid, store.rewardedAdUnitIdIos, store.rewardedAdUnitIdAndroid, store.rewardedAdUnitId, store.rewardedAdFormat, store.rewardedAdResponseId, store.adRequestNonPersonalized, store.noInterstitialOrBannerAdRequestsConfirmed, store.adRequestCountryCode`.
- store-ad-sandbox-current-free-rewarded-intervention: Record the free streak-risk intervention, rewarded ad gate, and generated challenge within 5000 ms. Suggested artifact: `store.freeRewardedInterventionArtifact`. Metrics: `store.freePostAdChallengeLatencyMs`.
- store-ad-sandbox-current-rewarded-ad-completion: Record rewarded completion granting challenge access. Suggested artifact: `store.rewardedAdCompletionArtifact`. Metrics: `checks.rewardedAdCompletionGrantsChallenge`.
- store-ad-sandbox-current-ad-failure-fallback: Record ad load/show failure still opening a recovery challenge without punishing the user. Suggested artifact: `store.adFailureFallbackArtifact`. Metrics: `checks.adFailureFallbackUnlocksChallenge`.
- store-ad-sandbox-current-premium-no-ad-intervention: Record verified premium entitlement skipping rewarded ad requests and starting challenge mode within 3000 ms. Suggested artifact: `store.premiumNoAdInterventionArtifact`. Metrics: `store.premiumNoAdLatencyMs, store.premiumNoRewardedAdRequested`.
- store-ad-sandbox-current-store-privacy-review: Attach App Store / Play privacy disclosure review proof for billing, purchase verification, and rewarded ads. Suggested artifact: `store.privacyDisclosureArtifact`. Metrics: `store.privacyDisclosureReviewId`.

`store-ad-sandbox-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret Core 3 product, entitlement, endpoint, ad-unit, and command context. It intentionally leaves artifacts/counts blank and checks false until real sandbox QA fills them.

`STORE_CONSOLE_PAYMENT_HANDOFF.md` gives App Store Connect and Play Console operators the hosted legal URL gate, Core 3 launch products, future-SKU inactive boundary, required production env keys, and report commands for sandbox payment evidence.

`STORE_CONSOLE_EXECUTION_RUNBOOK.md` gives the logged-in console operator the hosted legal URL gate, step-by-step App Store Connect, Google Play, and AdMob execution order, plus redacted evidence capture rules for the console product setup report.

`STORE_SANDBOX_TEST_PLAN.md` gives QA the hosted legal URL gate, yearly/monthly/lifetime App Store and Play purchase/restore run matrix, purchase-verification report requirements, rewarded-ad proof requirements, and premium no-ad intervention checks before filling final evidence.

`STORE_APP_RECORD_ACTION_PACKET.md` and `.json` give the exact draft app-record fields, action-time Browser confirmation token, Apple agreement prerequisite, and hard stops before any Play Console or App Store Connect app-record mutation.

`ADMOB_ACTION_PACKET.md` and `.json` give the exact AdMob iOS/Android app plus rewarded reset unit setup order, action-time confirmation token, v1 rewarded-only boundary, production-env keys, and Android upload-signing blocker handoff before any AdMob console mutation. `ADMOB_ENV_PATCH.template.env` gives a blank paste-safe production env patch skeleton after the confirmed AdMob action.

`paywall-launch-source-audit.json` is a local source precheck proving the current PaywallScreen uses the Core 3 launch plan API, shows store-verification/no-ad copy, and hides post-launch family/accountability/AI-coach products. It supports QA but does not replace the submitted-build `freed-paywall-launch-scope-report-v1` proof.

The Core 3 launch-product matrix must cover yearly, monthly, and lifetime for App Store purchase/restore, Play purchase/restore, and server entitlement verification. Keep future family/accountability/AI-coach SKUs out of this v1 evidence.

`rewarded-ad-request-report.template.json` gives QA the required local `freed-rewarded-ad-request-report-v1` shape for `store.rewardedAdRequestArtifact`; set `result=rewarded-ad-request-captured`, `rewardedAdRequestProofUsableForManualEvidence=true`, and every rewarded-only/privacy check to true only after the loaded ad response proves a real rewarded unit, non-personalized request mode, coarse country context, and no banner/interstitial/app-open/native ad request.

`paywall-launch-scope-report.template.json` gives QA the required local `freed-paywall-launch-scope-report-v1` shape for `store.paywallLaunchScopeArtifact`; set `result=paywall-launch-scope-captured`, `paywallLaunchScopeProofUsableForManualEvidence=true`, and every paywall-scope check to true only after the submitted build shows Core 3 yearly/monthly/lifetime only, hides family/accountability/AI-coach products, presents yearly as the primary value anchor, exposes restore, and enables purchase buttons.

`store-console-product-setup-report.template.json` gives QA the required local `freed-store-console-product-setup-report-v1` shape for `store.consoleProductSetupArtifact`; set `result=store-console-product-setup-captured`, `consoleProductSetupProofUsableForManualEvidence=true`, fill `appRecordReadiness` from a sanitized read-only Browser readiness report, fill the redacted console evidence artifacts with sanitized screenshot/report paths plus hashes, and set every console-product check to true only after App Store Connect and Play Console contain Core 3 products only, monthly/yearly subscriptions, lifetime one-time/non-consumable setup, screenshots/localizations, server-verification metadata, inactive future SKUs, and draft/internal/TestFlight-only status until evidence passes.

`store-intervention-flow-report.templates.json` gives QA the required local `freed-store-intervention-flow-report-v1` shapes for free rewarded gate, rewarded completion, ad-failure fallback, and premium no-ad challenge entry artifacts.

`store-privacy-disclosure-report.template.json` gives QA the required local `freed-store-privacy-disclosure-report-v1` shape for `store.privacyDisclosureArtifact`; set `result=privacy-disclosure-review-captured`, `privacyDisclosureProofUsableForManualEvidence=true`, and every privacy signal/check to true only after App Store and Play disclosures match the reviewed release behavior.

After the real sandbox runs, fill `store-ad-sandbox.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only after every proof artifact exists and contains sanitized data.

