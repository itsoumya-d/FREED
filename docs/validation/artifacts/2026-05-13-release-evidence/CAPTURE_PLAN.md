# FREED Evidence Capture Plan: 2026-05-13-release-evidence

This generated checklist is a QA handoff for real evidence capture. It does not satisfy release gates by itself.
Draft JSON files live in `draft-evidence/`; supporting screenshots, videos, logs, profiler exports, policy tickets, and reports should be stored under:

- `docs/validation/artifacts/2026-05-13-release-evidence/`

Replace every placeholder before draft validation. Keep raw receipts, purchase tokens, private notes, provider keys, and unredacted AI transcripts out of evidence JSON.
Evidence references must be files under the artifact folder or production-safe HTTPS QA/report URLs; remote evidence links reject credentials/fragments and local, private, reserved, documentation-only, or placeholder-like hosts (`your-*`, `sample`, `todo`), while production API endpoint fields also reject query strings.

## Production Environment Preflight

Run this before collecting backend, store, ad, AI, or final release evidence:

```sh
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json
```

Client/release env values:
- [ ] `EXPO_PUBLIC_MONETIZATION_MODE=native`
- [ ] `EXPO_PUBLIC_STORE_PROVIDER=native-iap`
- [ ] `EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID`
- [ ] `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT`
- [ ] `EXPO_PUBLIC_IAP_PRODUCT_YEARLY`
- [ ] `EXPO_PUBLIC_IAP_PRODUCT_MONTHLY`
- [ ] `EXPO_PUBLIC_IAP_PRODUCT_LIFETIME`
- [ ] `EXPO_PUBLIC_ADMOB_APP_ID_IOS`
- [ ] `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`
- [ ] `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS`
- [ ] `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID`
- [ ] `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`
- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Public backend routing env values:
- [ ] `EXPO_PUBLIC_AI_COACH_MODE=remote`
- [ ] `EXPO_PUBLIC_AI_COACH_ENDPOINT`
- [ ] `EXPO_PUBLIC_AI_CHALLENGE_MODE=remote`
- [ ] `EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT`
- [ ] `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT`
- [ ] `EXPO_PUBLIC_ANALYTICS_ENDPOINT`
- [ ] `EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT`
- [ ] `EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT when hosted backup sync is enabled`
- [ ] `EXPO_PUBLIC_RETENTION_ENDPOINT when remote retention is enabled`

Server-only/private env values:
- [ ] `APP_STORE_BUNDLE_ID`
- [ ] `APP_STORE_SERVER_API_ENV=production`
- [ ] `APP_STORE_ISSUER_ID + APP_STORE_KEY_ID + APP_STORE_PRIVATE_KEY(_BASE64), or APP_STORE_SERVER_API_JWT`
- [ ] `GOOGLE_PLAY_PACKAGE_NAME`
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(_BASE64), or GOOGLE_PLAY_ACCESS_TOKEN`
- [ ] `OPENAI_API_KEY and OPENAI_MODEL`
- [ ] `GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENAI_API_KEY`
- [ ] `GEMINI_MODEL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `BACKEND_MAINTENANCE_SECRET or CRON_SECRET`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries`
- [ ] `REMOTE_NOTIFICATION_DISPATCH_SECRET`
- [ ] `FCM credentials with FIREBASE_PROJECT_ID or Firebase service-account project_id`
- [ ] `APNs production signing credentials: APNS_KEY_ID + APNS_TEAM_ID + APNS_PRIVATE_KEY(_BASE64)`
- [ ] `iOS App Store archive signing: FREED_IOS_DEVELOPMENT_TEAM/APPLE_TEAM_ID plus Apple Distribution credentials and provisioning profiles outside the repo`

Release blocker groups:

- `production-backend-infrastructure` (production-env)
  - Env: `SUPABASE_URL`
  - Env: `SUPABASE_SERVICE_ROLE_KEY`
  - Env: `EXPO_PUBLIC_SUPABASE_URL`
  - Env: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Env: `BACKEND_MAINTENANCE_SECRET or CRON_SECRET`
  - Env: `UPSTASH_REDIS_REST_URL`
  - Env: `UPSTASH_REDIS_REST_TOKEN`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/backend-readiness-smoke-report.json`
  - Report: `npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/supabase-schema-smoke-report.json`
  - Preflight check: `server-secret-public-leakage`
  - Preflight check: `supabase-backend-credentials`
  - Preflight check: `redis-backend-infrastructure`
  - Preflight check: `backend-readiness-endpoint`
  - Preflight check: `optional-recovery-backup-sync-endpoint`
  - Preflight check: `optional-supabase-auth-client`
  - Preflight check: `optional-retention-endpoint`
  - Next: Configure Supabase, Redis/Upstash, public anon lockout proof, and maintenance secrets, then rerun release preflight plus deployed backend/schema smoke reports.

- `production-analytics-ingestion` (production-env)
  - Env: `EXPO_PUBLIC_ANALYTICS_ENDPOINT`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/analytics-ingestion-smoke-report.json`
  - Preflight check: `server-secret-public-leakage`
  - Preflight check: `analytics-ingestion-endpoint`
  - Next: Configure the deployed aggregate-only /api/analytics endpoint and prove the sanitized analytics ingestion smoke report.

- `production-notification-backend` (production-env)
  - Env: `REMOTE_NOTIFICATION_DISPATCH_SECRET`
  - Env: `FCM_SERVER_KEY, FCM_ACCESS_TOKEN + FIREBASE_PROJECT_ID, or FIREBASE_SERVICE_ACCOUNT_JSON(_BASE64)`
  - Env: `APNS_KEY_ID + APNS_TEAM_ID + APNS_BUNDLE_ID + APNS_ENV=production + APNS_PRIVATE_KEY(_BASE64)`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/remote-notification-smoke-report.json`
  - Preflight check: `server-secret-public-leakage`
  - Preflight check: `remote-notification-provider-credentials`
  - Next: Configure server-side APNs/FCM dispatch credentials and prove the non-sending notification smoke report.

- `production-adult-domain-feed` (production-env)
  - Env: `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT`
  - Env: `EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true`
  - Env: `FREED_ADULT_DOMAIN_FEED_SOURCE_URLS`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/adult-domain-feed-smoke-report.json`
  - Preflight check: `adult-domain-feed-endpoint`
  - Preflight check: `adult-domain-feed-sources`
  - Next: Configure reviewed adult-domain feed sources and prove the deployed feed freshness/cache/source smoke report.

- `production-monetization` (production-env)
  - Evidence file: `docs/validation/evidence/store-ad-sandbox.json`
  - Env: `EXPO_PUBLIC_MONETIZATION_MODE=native`
  - Env: `EXPO_PUBLIC_STORE_PROVIDER=native-iap`
  - Env: `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT`
  - Env: `EXPO_PUBLIC_IAP_PRODUCT_*`
  - Env: `EXPO_PUBLIC_ADMOB_APP_ID_IOS`
  - Env: `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`
  - Env: `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS`
  - Env: `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID`
  - Env: `APP_STORE_BUNDLE_ID`
  - Env: `APP_STORE_SERVER_API_ENV=production`
  - Env: `App Store Server API credentials`
  - Env: `GOOGLE_PLAY_PACKAGE_NAME`
  - Env: `Google Play verification credentials`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/purchase-verification-smoke-report.json`
  - Preflight check: `server-secret-public-leakage`
  - Preflight check: `release-monetization-mode`
  - Preflight check: `store-provider`
  - Preflight check: `iap-product-ids`
  - Preflight check: `purchase-verify-endpoint`
  - Preflight check: `app-store-environment`
  - Preflight check: `app-store-verification-credentials`
  - Preflight check: `google-play-verification-credentials`
  - Preflight check: `revenuecat-fallback-keys`
  - Preflight check: `admob-app-ids`
  - Preflight check: `admob-rewarded-units`
  - Preflight check: `admob-test-ads-disabled`
  - Preflight check: `admob-request-country`
  - Next: Configure native IAP, purchase verification, and AdMob env values, then prove purchase smoke plus store/ad sandbox evidence.

- `production-android-signing` (production-env)
  - Env: `FREED_ANDROID_UPLOAD_STORE_FILE`
  - Env: `FREED_ANDROID_UPLOAD_STORE_PASSWORD`
  - Env: `FREED_ANDROID_UPLOAD_KEY_ALIAS`
  - Env: `FREED_ANDROID_UPLOAD_KEY_PASSWORD`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-apk-build-report.json`
  - Report: `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-aab-build-report.json`
  - Preflight check: `android-release-signing`
  - Next: Run npm run setup:android-upload-keystore -- --generate-passwords or configure existing secure Android upload signing credentials, point the store-file env value at the secure CI/local keystore, then produce sanitized upload-signed APK and AAB build reports before Play upload.

- `production-ai-backend` (production-env)
  - Evidence file: `docs/validation/evidence/ai-backend-smoke.json`
  - Env: `EXPO_PUBLIC_AI_COACH_MODE=remote`
  - Env: `EXPO_PUBLIC_AI_COACH_ENDPOINT`
  - Env: `EXPO_PUBLIC_AI_CHALLENGE_MODE=remote`
  - Env: `EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT`
  - Env: `OPENAI_API_KEY + OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY + GEMINI_MODEL`
  - Report: `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json`
  - Report: `npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-report.json`
  - Preflight check: `server-secret-public-leakage`
  - Preflight check: `ai-coach-mode`
  - Preflight check: `ai-coach-endpoint`
  - Preflight check: `ai-challenge-mode`
  - Preflight check: `ai-challenge-endpoint`
  - Preflight check: `server-ai-key`
  - Preflight check: `optional-retention-endpoint`
  - Next: Configure remote CLARA/challenge endpoints and server AI provider credentials, then prove AI safety plus deployed backend smoke evidence.

- `ios-physical-device-validation` (physical-evidence)
  - Evidence file: `docs/validation/evidence/ios-physical-device.json`
  - Capture helper: `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-physical-device-capture`
  - Report: `npm run build:ios-archive:release -- --report docs/validation/artifacts/2026-05-13-release-evidence/ios-release-archive-report.json`
  - Next: Produce a sanitized signed iOS Release archive/IPA report, then capture entitlement-approved iOS hardware evidence for Screen Time, Safari Content Blocker, Safari Focus Shield, app shields, and challenge verification.

- `android-real-browser-validation` (physical-evidence)
  - Evidence file: `docs/validation/evidence/android-real-browser.json`
  - Capture helper: `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-real-browser-capture`
  - Next: Capture physical Android browser, DNS Guard, Accessibility, app shield, short-form, unlock, and Play policy evidence.

- `normal-browsing-corpus-validation` (physical-evidence)
  - Evidence file: `docs/validation/evidence/normal-browsing-corpus.json`
  - Capture helper: `npm run evidence:normal-browsing-corpus -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/normal-browsing-corpus-capture`
  - Next: Run the physical-browser normal browsing corpus and promote only after every allow/block matrix row passes.

- `performance-validation` (physical-evidence)
  - Evidence file: `docs/validation/evidence/performance-profile.json`
  - Capture helper: `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/performance-profile-capture`
  - Next: Capture battery, RAM, thermal, background CPU, DNS latency, network speed, and no-full-VPN/no-screenshot proof.

- `store-ad-sandbox-validation` (deployed-evidence)
  - Evidence file: `docs/validation/evidence/store-ad-sandbox.json`
  - Capture helper: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/store-ad-sandbox-capture`
  - Env: `store/ad production env from production-monetization`
  - Report: `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/purchase-verification-smoke-report.json`
  - Next: Capture Core 3-only console product setup, paywall proof, App Store/Play Billing sandbox purchases, restore, rewarded ad completion, and premium no-ad behavior without raw receipts/tokens.

- `ai-backend-smoke-validation` (deployed-evidence)
  - Evidence file: `docs/validation/evidence/ai-backend-smoke.json`
  - Capture helper: `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-capture`
  - Env: `remote AI production env from production-ai-backend`
  - Report: `npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-report.json`
  - Next: Capture AI safety eval plus deployed CLARA/challenge smoke reports without raw prompts, private notes, or provider output.

Do not put App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, push credentials, maintenance secrets, access tokens, purchase receipts, raw purchase tokens, or AI provider keys in any evidence JSON.

## iOS physical device

- Target evidence: `docs/validation/evidence/ios-physical-device.json`
- Draft file: `draft-evidence/ios-physical-device.json`
- Next action: Run on an entitlement-approved iOS device and capture docs/validation/evidence/ios-physical-device.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

iOS device discovery prerequisite:

```sh
npm run evidence:ios-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-device-discovery
```

Capture helper:

```sh
npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-physical-device-capture
```

Helper notes:
- `npm run evidence:ios-devices` is a setup handoff only; use it to confirm a trusted physical iPhone name or UDID, but keep `evidenceSatisfied=false` and do not promote it as iOS release evidence.
- Pass `--app <signed-freed-app-or-ipa>` to generate local `ios-app-package-proof.json` (`freed-ios-app-package-proof-v1`, `sanitized=true`); use it for entitlement/app-group/Complete Data Protection/Safari build support only when `packageProofUsableForManualEvidence=true`, `entitlementFailures`, `safariRuleFailures`, and `missingOrMismatchedExtensions` are empty, the app and extensions pass Family Controls/app-group/Complete Data Protection checks, Safari rule signals include adult-domain plus YouTube Shorts / Instagram Reels / TikTok For You web rules with all-block actions, and no packet tunnel/packet inspection entitlements are present.
- Use `ios-physical-device-evidence-fill-template.json` from the helper as the pending final-shape handoff, but keep every check false and every artifact blank until entitlement-approved physical-device recordings or QA reports prove the behavior.
- In the FamilyActivityPicker recording, tap Done after selecting tokens and immediately capture FREED/native status showing `ios.familyActivityPickerAppLimitScheduledImmediately=true` with the `freed.selectedAppDailyLimit` activity and `freed.selectedAppDailyLimitReached` event names.
- Capture the Safari/web short-form challenge handoff separately from the Content Blocker proof: the artifact must show source `ios-safari-short-form`, a matching `short-form:*` rule, host-only storage, `RawPathStored=false`, no native unlock, selected shields still active, and adult filtering still active.
- Attach physical iPhone challenge-verification artifacts for Vision camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, pedometer steps, and accurate foreground location fixes before setting the challenge verification checks.

Required checks:
- [ ] `checks.permissionSetupWizard`
- [ ] `checks.familyControlsAuthorization`
- [ ] `checks.familyActivityPicker`
- [ ] `checks.familyActivityPickerSchedulesDailyLimit`
- [ ] `checks.managedSettingsAdultFilter`
- [ ] `checks.safariContentBlockerReloaded`
- [ ] `checks.safariContentBlockerEnabled`
- [ ] `checks.safariContentBlockerAdultBlock`
- [ ] `checks.safariFocusShieldBuild`
- [ ] `checks.safariFocusShieldShortFormBlock`
- [ ] `checks.safariShortFormChallengeHandoff`
- [ ] `checks.selectedShieldTokens`
- [ ] `checks.selectedAppDailyLimitThreshold`
- [ ] `checks.earnedUnlockAllowsSelectedApps`
- [ ] `checks.earnedUnlockRejectsNonScreenTimeSource`
- [ ] `checks.earnedUnlockAutoRelock`
- [ ] `checks.challengePhotoVerifiedOnDevice`
- [ ] `checks.challengeMotionVerified`
- [ ] `checks.challengeStepsVerified`
- [ ] `checks.challengeLocationVerified`
- [ ] `checks.shieldActionHandoff`
- [ ] `checks.deviceActivityNightGuard`
- [ ] `checks.normalBrowsingAllowed`
- [ ] `checks.adultAttemptIntercepted`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `device`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `ios.isPhysicalDevice=true`
- [ ] `ios.deviceModel`
- [ ] `ios.osVersion`
- [ ] `ios.permissionWizardRunId`
- [ ] `ios.permissionWizardArtifact`
- [ ] `ios.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true, matching runId/platform/flow order and explicit permission explanation/test protection/iOS settings return auto-advance checks`
- [ ] `ios.permissionWizardFlowOrder=onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete`
- [ ] `ios.permissionExplanationShown=true`
- [ ] `ios.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy`
- [ ] `ios.permissionWizardTestProtectionPassed=true`
- [ ] `ios.permissionWizardArtifact checks include Screen Time authorization return refresh, FamilyActivityPicker return refresh, Safari Settings return refresh, and auto-advance continuation`
- [ ] `ios.familyControlsEntitlementTeamId`
- [ ] `ios.familyControlsEntitlementArtifact`
- [ ] `ios.familyControlsEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true, packageProofUsableForManualEvidence=true, Family Controls entitlement/app-group/Complete Data Protection checks, embedded Screen Time, Safari Content Blocker, and Safari Focus Shield extensions, and no packet tunnel/packet inspection entitlements`
- [ ] `ios.appGroupProvisioningProfileId`
- [ ] `ios.appGroupProvisioningArtifact`
- [ ] `ios.appGroupProvisioningArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true, packageProofUsableForManualEvidence=true, Family Controls entitlement/app-group/Complete Data Protection checks, embedded Screen Time, Safari Content Blocker, and Safari Focus Shield extensions, and no packet tunnel/packet inspection entitlements`
- [ ] `ios.completeDataProtectionEntitlement=NSFileProtectionComplete`
- [ ] `ios.completeDataProtectionEntitlementArtifact`
- [ ] `ios.completeDataProtectionEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true, packageProofUsableForManualEvidence=true, Family Controls entitlement/app-group/Complete Data Protection checks, embedded Screen Time, Safari Content Blocker, and Safari Focus Shield extensions, and no packet tunnel/packet inspection entitlements`
- [ ] `ios.familyControlsAuthorizationRunId`
- [ ] `ios.familyControlsAuthorizationArtifact`
- [ ] `ios.familyControlsStatus=approved`
- [ ] `ios.familyActivityPickerRunId`
- [ ] `ios.familyActivityPickerArtifact`
- [ ] `ios.familyActivityPickerAppLimitScheduledImmediately=true`
- [ ] `ios.familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit`
- [ ] `ios.familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached`
- [ ] `ios.selectedApplicationTokenCount`
- [ ] `ios.selectedCategoryTokenCount`
- [ ] `ios.selectedWebDomainTokenCount`
- [ ] `ios.selectedTokenCounts>0`
- [ ] `ios.selectedShieldTokensRunId`
- [ ] `ios.selectedShieldTokensArtifact`
- [ ] `ios.appLimitScheduled=true`
- [ ] `ios.selectedAppDailyLimitMinutes between 5 and 240`
- [ ] `ios.selectedAppDailyLimitActivityName=freed.selectedAppDailyLimit`
- [ ] `ios.selectedAppDailyLimitEventName=freed.selectedAppDailyLimitReached`
- [ ] `ios.selectedAppDailyLimitReachedToday=true`
- [ ] `ios.selectedAppDailyLimitReachedDate yyyy-MM-dd`
- [ ] `ios.selectedAppDailyLimitRunId`
- [ ] `ios.selectedAppDailyLimitArtifact`
- [ ] `ios.selectedAppDailyLimitArtifact local freed-ios-screen-time-app-limit-report-v1 JSON with sanitized=true, matching runId/activity/event/date/token counts/daily limit and Screen Time threshold shielding/no-screen-read/no-packet-inspection checks`
- [ ] `ios.managedSettingsFilterRunId`
- [ ] `ios.managedSettingsFilterArtifact`
- [ ] `ios.safariContentBlockerEmbedded=true`
- [ ] `ios.safariContentBlockerIdentifier=app.freed.recovery.safari-content-blocker`
- [ ] `ios.safariContentBlockerBuildRunId`
- [ ] `ios.safariContentBlockerBuildArtifact`
- [ ] `ios.safariContentBlockerBuildArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true, packageProofUsableForManualEvidence=true, embedded FREEDSafariContentBlocker.appex, adult-domain-only rules, all-block actions, and no packet tunnel/packet inspection entitlements`
- [ ] `ios.safariContentBlockerReloadRunId`
- [ ] `ios.safariContentBlockerReloadArtifact`
- [ ] `ios.safariContentBlockerReloadArtifact local freed-ios-safari-content-blocker-report-v1 JSON with sanitized=true, matching runId/version/checksum/rule count and Safari reload/no-screen-read/no-packet-inspection checks`
- [ ] `ios.safariContentBlockerVersion`
- [ ] `ios.safariContentBlockerChecksum fnv1a32:<8-hex>`
- [ ] `ios.safariContentBlockerRuleCount>=1`
- [ ] `ios.safariContentBlockerEnabled=true`
- [ ] `ios.safariContentBlockerAdultBlockRunId`
- [ ] `ios.safariContentBlockerAdultBlockArtifact`
- [ ] `ios.safariContentBlockerAdultBlockArtifact local freed-ios-safari-content-blocker-report-v1 JSON with sanitized=true, matching runId/adult host and Safari adult-domain/no-packet-inspection checks`
- [ ] `ios.safariFocusShieldEmbedded=true`
- [ ] `ios.safariFocusShieldIdentifier=app.freed.recovery.safari-focus-shield`
- [ ] `ios.safariFocusShieldBuildRunId`
- [ ] `ios.safariFocusShieldBuildArtifact`
- [ ] `ios.safariFocusShieldBuildArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true, packageProofUsableForManualEvidence=true, embedded FREEDSafariFocusShield.appex, MV3 manifest, background.js service worker, content.js, scoped hosts, iOS 15.4 minimum, and app-group/Complete Data Protection entitlements`
- [ ] `ios.safariFocusShieldShortFormUrl`
- [ ] `ios.safariFocusShieldShortFormBlockRunId`
- [ ] `ios.safariFocusShieldShortFormBlockArtifact`
- [ ] `ios.safariFocusShieldShortFormBlockArtifact local freed-ios-safari-focus-shield-report-v1 JSON with sanitized=true, matching runId/short-form URL/rule and MV3 content-script/background-worker/no-raw-path checks`
- [ ] `ios.safariShortFormChallengeHandoffRunId`
- [ ] `ios.safariShortFormChallengeHandoffArtifact`
- [ ] `ios.safariShortFormChallengeHandoffSource=ios-safari-short-form`
- [ ] `ios.safariShortFormChallengeHandoffMatchedRule=short-form:youtube-shorts|short-form:instagram-reels|short-form:tiktok-feed`
- [ ] `ios.safariShortFormChallengeHandoffHost matches short-form web host`
- [ ] `ios.safariShortFormChallengeHandoffRawPathStored=false`
- [ ] `ios.safariShortFormChallengeHandoffNativeUnlockActive=false`
- [ ] `ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive=true`
- [ ] `ios.safariShortFormChallengeHandoffAdultFilterStillActive=true`
- [ ] `ios.earnedUnlockAppAllowRunId`
- [ ] `ios.earnedUnlockAppAllowArtifact`
- [ ] `ios.earnedUnlockAppAllowArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true, matching runId/source host/duration/token count and Screen Time source-scoped allow/no-screen-read/no-packet-inspection checks`
- [ ] `ios.earnedUnlockRelockRunId`
- [ ] `ios.earnedUnlockRelockArtifact`
- [ ] `ios.earnedUnlockRelockArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true, matching runId/source host/duration/token count and Screen Time auto-relock/no-screen-read/no-packet-inspection checks`
- [ ] `ios.earnedUnlockDurationMinutes between 1 and 120`
- [ ] `ios.earnedUnlockActivityName=freed.earnedUnlockWindow`
- [ ] `ios.earnedUnlockSelectedTokenCount=ios.selectedTokenCounts`
- [ ] `ios.earnedUnlockAdultFilterStillActive=true`
- [ ] `ios.earnedUnlockSourceHost=screen-time-shield.freed.local`
- [ ] `ios.earnedUnlockRejectedSourceRunId`
- [ ] `ios.earnedUnlockRejectedSourceArtifact`
- [ ] `ios.earnedUnlockRejectedSourceArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true, matching runId/rejected source host/duration/token count and blocked browser/adult-source rejection/no-screen-read/no-packet-inspection checks`
- [ ] `ios.earnedUnlockRejectedSourceHost is a blocked browser/adult-domain source`
- [ ] `ios.earnedUnlockRejectedSelectedShieldsStayedActive=true`
- [ ] `ios.earnedUnlockRejectedAdultFilterStillActive=true`
- [ ] `ios.challengePhotoRunId`
- [ ] `ios.challengePhotoArtifact`
- [ ] `ios.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true, matching runId/platform/classifier/label/confidence and on-device/on-demand/no-retention checks`
- [ ] `ios.challengePhotoClassifier=Vision`
- [ ] `ios.challengePhotoMatchedLabel`
- [ ] `ios.challengePhotoConfidence>=0.45`
- [ ] `ios.challengePhotoFreshCameraOnly=true`
- [ ] `ios.challengePhotoNoBase64OrExif=true`
- [ ] `ios.challengePhotoTemporaryFileDeleted=true`
- [ ] `ios.challengeMotionRunId`
- [ ] `ios.challengeMotionArtifact`
- [ ] `ios.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true, matching runId/platform/sample count and on-device/on-demand/no-timer-bypass checks`
- [ ] `ios.challengeMotionSamples>=6`
- [ ] `ios.challengeStepsRunId`
- [ ] `ios.challengeStepsArtifact`
- [ ] `ios.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true, matching runId/platform/step count and pedometer/on-demand/no-timer-bypass checks`
- [ ] `ios.challengeStepCount>=12`
- [ ] `ios.challengeLocationRunId`
- [ ] `ios.challengeLocationArtifact`
- [ ] `ios.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true, matching runId/platform/distance/sample/accuracy metrics and foreground/no-coordinate-retention checks`
- [ ] `ios.challengeLocationDistanceMeters>=10`
- [ ] `ios.challengeLocationSamples>=2`
- [ ] `ios.challengeLocationBestAccuracyMeters<=80`
- [ ] `ios.shieldActionInterventionId`
- [ ] `ios.shieldActionHandoffRunId`
- [ ] `ios.shieldActionHandoffArtifact`
- [ ] `ios.deviceActivityName`
- [ ] `ios.deviceActivityNightGuardRunId`
- [ ] `ios.deviceActivityNightGuardArtifact`
- [ ] `ios.normalBrowsingRunId`
- [ ] `ios.normalBrowsingArtifact`
- [ ] `ios.adultInterceptRunId`
- [ ] `ios.adultInterceptArtifact`
- [ ] `ios.normalBrowsingAllowedUrl`
- [ ] `ios.adultInterceptedHost external adult host or adult-intent search URL`

## Android real browsers

- Target evidence: `docs/validation/evidence/android-real-browser.json`
- Draft file: `draft-evidence/android-real-browser.json`
- Next action: Run on Android hardware across supported browsers and capture docs/validation/evidence/android-real-browser.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

Android device and install QA prerequisites:

```sh
npm run evidence:android-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-device-discovery
npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-install-qa --require-upload-signing
```

Capture helper:

```sh
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-real-browser-capture
```

Helper notes:
- `npm run evidence:android-devices` is a setup handoff only; use it to pick a ready hardware serial, but keep `evidenceSatisfied=false` and do not promote it as Android release evidence.
- Run `npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --require-upload-signing` on Android hardware first, then fill `android.installQaRunId`, `android.installQaArtifact`, and `checks.androidInstallLaunchQa=true` from the local `freed-android-install-qa-report-v1` report before promoting Android real-browser evidence.
- Use `android-real-browser-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every check false until physical Android QA, DNS Guard review, challenge verification, and Play policy review are complete.
- Attach Android hardware challenge-verification artifacts for ML Kit camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, Activity Recognition/steps, and accurate foreground location fixes before setting the challenge verification checks.
- Add `--permission-proof` to a physical-device run, or run `--scenario none --permission-proof`, to generate `android-permission-proof.txt`/`.json` plus local Accessibility, Usage Access, notification, and DNS Guard consent permission reports; pair it with the FREED native status/profile screenshot before filling UsageStats and notification prompt metrics.
- Open FREED to Profile > Native Protection, then add `--native-status-proof` or run `--scenario none --native-status-proof` to capture `android-native-status.png`, UI text, and UI hierarchy for UsageStats metrics, adult-domain feed status, Private DNS, and DNS Guard resolver diagnostics.
- After enabling DNS Guard, reboot the physical device or update the app package, then run `npm run evidence:android-real-browser -- --device <serial> --scenario none --dns-guard-restart-proof` to capture `android.dnsGuardRestartRunId`, `android.dnsGuardRestartArtifact`, restart action/result/user-enabled/eligible fields, and the paired native status text; repeat after manual stop or VPN revocation for the skipped-restart artifact and reason.
- Run `npm run evidence:android-real-browser -- --device <serial> --scenario none --focused-webview-proof` with the installed `app.freed.qawebview` fixture to collect `android.focusedWebViewPackage`, `android.focusedWebViewRunId`, and `android.focusedWebViewArtifact`.
- Run `npm run evidence:android-real-browser -- --scenario none --play-policy-proof` to package the Android Accessibility/DNS Guard disclosure pack and manifest declarations for `android.playPolicyAccessibilityArtifact` and `android.playPolicySpecialUseFgsArtifact`; concrete Play Console review IDs are still required.
- Run `npm run evidence:android-real-browser -- --device <serial> --scenario synced-feed --adult-domain-feed-host <synced-feed-only-adult-host> --dns-guard-proof` with a reviewed synced-feed-only adult host to collect `android.adultDomainFeedAccessibilityArtifact`, `android.dnsGuardBlockArtifact`, `android.dnsGuardInterventionVisible=true`, and `android.adultDomainFeedDnsGuardArtifact`; pair it with native feed status proof.
- Run `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --scenario none --app-scenario browser-earned-unlock --configured-app-package com.instagram.android --configured-app-label Instagram` after completing a browser/adult-domain challenge to prove `android.browserEarnedUnlockNativeAppUnlockActive=false`, `android.browserEarnedUnlockConfiguredAppStillShielded=true`, and `android.browserEarnedUnlockAdultFilterStillActive=true`.
- Run `--app-scenario short-form-both` for YouTube Shorts to collect the below-threshold and sustained-intercept fields, then repeat the sustained helper flow with `--app-scenario short-form --short-form-package com.instagram.android --short-form-label "Instagram Reels"` and `--app-scenario short-form --short-form-package <installed TikTok package> --short-form-label "TikTok For You"` where the TikTok package is `com.zhiliaoapp.musically`, `com.ss.android.ugc.trill`, or `com.tiktok`; keep each app's observed foreground usage below the configured daily app limit and fill `android.shortFormUsageBeforeLimitMinutes`, `android.instagramReelsUsageBeforeLimitMinutes`, and `android.tiktokFeedUsageBeforeLimitMinutes`, plus selected-surface proof fields for YouTube, Instagram, and TikTok, so the proof cannot be mistaken for a broad app-limit shield.

Required checks:
- [ ] `checks.androidInstallLaunchQa`
- [ ] `checks.permissionSetupWizard`
- [ ] `checks.accessibilityPermissionFlow`
- [ ] `checks.usageAccessPermissionFlow`
- [ ] `checks.notificationPermissionFlow`
- [ ] `checks.chromeAdultIntentIntercept`
- [ ] `checks.firefoxAdultIntentIntercept`
- [ ] `checks.edgeAdultIntentIntercept`
- [ ] `checks.samsungInternetAdultIntentIntercept`
- [ ] `checks.focusedBrowserSearchIntercept`
- [ ] `checks.focusedWebViewIntercept`
- [ ] `checks.configuredAppShieldBeforeLimitAllowed`
- [ ] `checks.configuredAppShieldIntercept`
- [ ] `checks.configuredAppShieldDailyLimitReached`
- [ ] `checks.shortFormBelowThresholdAllowed`
- [ ] `checks.shortFormSustainedIntercept`
- [ ] `checks.instagramReelsSustainedIntercept`
- [ ] `checks.tiktokFeedSustainedIntercept`
- [ ] `checks.earnedUnlockAllowsConfiguredApp`
- [ ] `checks.earnedUnlockAutoRelock`
- [ ] `checks.challengePhotoVerifiedOnDevice`
- [ ] `checks.challengeMotionVerified`
- [ ] `checks.challengeStepsVerified`
- [ ] `checks.challengeLocationVerified`
- [ ] `checks.browserEarnedUnlockDoesNotUnlockApps`
- [ ] `checks.normalBrowsingAllowed`
- [ ] `checks.dnsGuardVpnConsentFlow`
- [ ] `checks.dnsGuardAdultDomainBlocked`
- [ ] `checks.dnsGuardInterventionVisible`
- [ ] `checks.dnsGuardRestartPolicyVerified`
- [ ] `checks.nativeAdultDomainFeedSynced`
- [ ] `checks.nativeHandoffBackStackClean`
- [ ] `checks.playPolicyAccessibilityReviewed`
- [ ] `checks.playPolicySpecialUseFgsReviewed`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `device`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `android.isPhysicalDevice=true`
- [ ] `android.deviceModel`
- [ ] `android.osVersion`
- [ ] `android.installQaRunId`
- [ ] `android.installQaArtifact`
- [ ] `android.installQaArtifact local freed-android-install-qa-report-v1 JSON with sanitized=true, matching installQaRunId, physical device, APK hash/size, requested upload-signing requirement, verified non-debug APK signature proof, package install, launch/top-activity proof, screenshot/UI dump artifacts, protection handoff command with permission/native-status/dns-guard proof flags, permission wizard report command, and activation order android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test`
- [ ] `android.permissionWizardRunId`
- [ ] `android.permissionWizardArtifact`
- [ ] `android.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true, matching runId/platform/flow order, explicit permission explanation/test protection, Android VPN consent surface, exact Usage Access route, targeted Accessibility details route, and settings return auto-advance checks`
- [ ] `android.permissionWizardFlowOrder=onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete`
- [ ] `android.permissionExplanationShown=true`
- [ ] `android.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy`
- [ ] `android.permissionWizardTestProtectionPassed=true`
- [ ] `android.appSelectionZeroAppContinueDisabled=true`
- [ ] `android.appSelectionReturnFromSetup=true`
- [ ] `android.appSelectionReturnAutoSync=true`
- [ ] `android.appSelectionReturnNativePackageSyncConfirmed=true`
- [ ] `android.appSelectionReturnSelectedAppCount>0`
- [ ] `android.permissionWizardArtifact checks include Android zero-app disabled, setup-launched app selection, return auto-sync, native package sync, app-selection auto-advance continuation, DNS Guard VPN-consent return refresh plus android.net.VpnService.prepare surface, Usage Access return refresh plus android.settings.USAGE_ACCESS_SETTINGS route, Accessibility return refresh plus android.settings.ACCESSIBILITY_DETAILS_SETTINGS and FREED service component target, and system-settings auto-advance continuation`
- [ ] `android.accessibilityServiceEnabled=true`
- [ ] `android.accessibilityPermissionRunId`
- [ ] `android.accessibilityPermissionArtifact`
- [ ] `android.accessibilityPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true, matching runId, targeted FREED Accessibility details route, enabled AccessibilityService/user-granted/no-hidden-monitoring checks`
- [ ] `android.accessibilitySettingsRouteComponent matches FREED AccessibilityService native target`
- [ ] `android.usageStatsAuthorized=true`
- [ ] `android.usageAccessPermissionRunId`
- [ ] `android.usageAccessPermissionArtifact`
- [ ] `android.usageAccessPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true, matching runId/public Usage Access settings route/explicit FREED user toggle/UsageStats authorization/aggregate selected-app package metrics and no raw usage events`
- [ ] `android.notificationPermissionRunId`
- [ ] `android.notificationPermissionArtifact`
- [ ] `android.notificationPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true, matching runId, Android 13+ runtime notification prompt, native required/granted status, app notification settings fallback only when denied, and no silent notification grant`
- [ ] `android.notificationPermissionRequired=true`
- [ ] `android.notificationPermissionGranted=true`
- [ ] `android.notificationRuntimePromptShown=true`
- [ ] `android.notificationSettingsFallbackOpenedIfDenied=true`
- [ ] `android.usageStatsObservedPackages covers every distinct configured and short-form proof package`
- [ ] `android.usageStatsObservedPackageNames includes every configured and short-form proof package`
- [ ] `android.usageStatsTodayMinutes>=configuredAppShieldUsageBeforeLimitMinutes`
- [ ] `android.usageStatsTodayMinutesByPackage includes every configured and short-form proof package`
- [ ] `android.testedBrowserPackages[]`
- [ ] `android.testedBrowserPackages includes Chrome`
- [ ] `android.testedBrowserPackages includes Firefox`
- [ ] `android.testedBrowserPackages includes Edge`
- [ ] `android.testedBrowserPackages includes Samsung Internet`
- [ ] `android.chromeInterceptRunId`
- [ ] `android.chromeInterceptArtifact`
- [ ] `android.chromeInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/browserPackage/host and Accessibility no-screenshot/no-packet-inspection checks`
- [ ] `android.firefoxInterceptRunId`
- [ ] `android.firefoxInterceptArtifact`
- [ ] `android.firefoxInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/browserPackage/host and Accessibility no-screenshot/no-packet-inspection checks`
- [ ] `android.edgeInterceptRunId`
- [ ] `android.edgeInterceptArtifact`
- [ ] `android.edgeInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/browserPackage/host and Accessibility no-screenshot/no-packet-inspection checks`
- [ ] `android.samsungInternetInterceptRunId`
- [ ] `android.samsungInternetInterceptArtifact`
- [ ] `android.samsungInternetInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/browserPackage/host and Accessibility no-screenshot/no-packet-inspection checks`
- [ ] `android.focusedBrowserSearchRunId`
- [ ] `android.focusedBrowserSearchArtifact`
- [ ] `android.focusedBrowserSearchArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/tested browser/redacted host/matched rule and focused-field/no-raw-query checks`
- [ ] `android.focusedBrowserSearchRedactedHost=focused-search.app.freed.local`
- [ ] `android.focusedBrowserSearchMatchedRule starts with focused-search:`
- [ ] `android.focusedBrowserSearchRawQueryStored=false`
- [ ] `android.focusedWebViewPackage`
- [ ] `android.focusedWebViewRunId`
- [ ] `android.focusedWebViewArtifact`
- [ ] `android.focusedWebViewArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching runId/WebView package and focused-WebView/no-screenshot checks`
- [ ] `android.configuredAppShieldPackages[]`
- [ ] `android.configuredAppShieldPackage`
- [ ] `android.configuredAppShieldDailyLimitMinutes`
- [ ] `android.configuredAppShieldUsageBeforeLimitMinutes`
- [ ] `android.configuredAppShieldBeforeLimitAllowRunId`
- [ ] `android.configuredAppShieldBeforeLimitAllowArtifact`
- [ ] `android.configuredAppShieldBeforeLimitAllowArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/usage metrics and below-limit allow/no-screenshot checks`
- [ ] `android.configuredAppShieldUsageAtInterventionMinutes`
- [ ] `android.configuredAppShieldRunId`
- [ ] `android.configuredAppShieldArtifact`
- [ ] `android.configuredAppShieldArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/intervention/usage metrics and app-limit interruption/no-screenshot checks`
- [ ] `android.configuredAppShieldInterventionId`
- [ ] `android.shortFormPackage`
- [ ] `android.shortFormPackage=com.google.android.youtube`
- [ ] `android.shortFormPackage included in configuredAppShieldPackages[]`
- [ ] `android.shortFormThresholdSeconds between 30 and 300`
- [ ] `android.shortFormBelowThresholdSeconds lower than android.shortFormThresholdSeconds`
- [ ] `android.shortFormBelowThresholdAllowRunId`
- [ ] `android.shortFormBelowThresholdAllowArtifact`
- [ ] `android.shortFormBelowThresholdAllowArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/threshold metrics and below-threshold allow/no-screenshot checks`
- [ ] `android.shortFormAtInterventionSeconds at least android.shortFormThresholdSeconds`
- [ ] `android.shortFormUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes`
- [ ] `android.shortFormRunId`
- [ ] `android.shortFormArtifact`
- [ ] `android.shortFormArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/intervention/threshold metrics, paired selected-surface proof, and no-screenshot checks`
- [ ] `android.shortFormSelectedSurfaceArtifact`
- [ ] `android.shortFormSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true, matching runId/package/intervention/timing metrics and Accessibility selected-surface/no-screenshot checks`
- [ ] `android.shortFormSelectedSurfaceVerified=true`
- [ ] `android.shortFormInterventionId=short-form:youtube-shorts`
- [ ] `android.instagramReelsPackage=com.instagram.android`
- [ ] `android.instagramReelsAtInterventionSeconds at least android.shortFormThresholdSeconds`
- [ ] `android.instagramReelsUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes`
- [ ] `android.instagramReelsRunId`
- [ ] `android.instagramReelsArtifact`
- [ ] `android.instagramReelsArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/intervention/threshold metrics, paired selected-surface proof, and no-screenshot checks`
- [ ] `android.instagramReelsSelectedSurfaceArtifact`
- [ ] `android.instagramReelsSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true, matching runId/package/intervention/timing metrics and Accessibility selected-surface/no-screenshot checks`
- [ ] `android.instagramReelsSelectedSurfaceVerified=true`
- [ ] `android.instagramReelsInterventionId=short-form:instagram-reels`
- [ ] `android.tiktokFeedPackage is one of com.zhiliaoapp.musically, com.ss.android.ugc.trill, com.tiktok`
- [ ] `android.tiktokFeedAtInterventionSeconds at least android.shortFormThresholdSeconds`
- [ ] `android.tiktokFeedUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes`
- [ ] `android.tiktokFeedRunId`
- [ ] `android.tiktokFeedArtifact`
- [ ] `android.tiktokFeedArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true, matching runId/package/intervention/threshold metrics, paired selected-surface proof, and no-screenshot checks`
- [ ] `android.tiktokFeedSelectedSurfaceArtifact`
- [ ] `android.tiktokFeedSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true, matching runId/package/intervention/timing metrics and Accessibility selected-surface/no-screenshot checks`
- [ ] `android.tiktokFeedSelectedSurfaceVerified=true`
- [ ] `android.tiktokFeedInterventionId=short-form:tiktok-feed`
- [ ] `android.earnedUnlockAppAllowRunId`
- [ ] `android.earnedUnlockAppAllowArtifact`
- [ ] `android.earnedUnlockAppAllowArtifact local freed-android-earned-unlock-report-v1 JSON with sanitized=true, matching runId/package/duration and source-scoped allow/no-browser-unlock checks`
- [ ] `android.earnedUnlockRelockRunId`
- [ ] `android.earnedUnlockRelockArtifact`
- [ ] `android.earnedUnlockRelockArtifact local freed-android-earned-unlock-report-v1 JSON with sanitized=true, matching runId/package/duration/usage metrics and source-scoped auto-relock checks`
- [ ] `android.earnedUnlockDurationMinutes between 1 and 120`
- [ ] `android.earnedUnlockSourcePackage=android.configuredAppShieldPackage`
- [ ] `android.earnedUnlockRelockUsageMinutes at least android.configuredAppShieldDailyLimitMinutes`
- [ ] `android.challengePhotoRunId`
- [ ] `android.challengePhotoArtifact`
- [ ] `android.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true, matching runId/platform/classifier/label/confidence and on-device/on-demand/no-retention checks`
- [ ] `android.challengePhotoClassifier=ML Kit`
- [ ] `android.challengePhotoMatchedLabel`
- [ ] `android.challengePhotoConfidence>=0.45`
- [ ] `android.challengePhotoFreshCameraOnly=true`
- [ ] `android.challengePhotoNoBase64OrExif=true`
- [ ] `android.challengePhotoTemporaryFileDeleted=true`
- [ ] `android.challengeMotionRunId`
- [ ] `android.challengeMotionArtifact`
- [ ] `android.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true, matching runId/platform/sample count and on-device/on-demand/no-timer-bypass checks`
- [ ] `android.challengeMotionSamples>=6`
- [ ] `android.challengeStepsRunId`
- [ ] `android.challengeStepsArtifact`
- [ ] `android.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true, matching runId/platform/step count and pedometer/on-demand/no-timer-bypass checks`
- [ ] `android.challengeStepCount>=12`
- [ ] `android.challengeLocationRunId`
- [ ] `android.challengeLocationArtifact`
- [ ] `android.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true, matching runId/platform/distance/sample/accuracy metrics and foreground/no-coordinate-retention checks`
- [ ] `android.challengeLocationDistanceMeters>=10`
- [ ] `android.challengeLocationSamples>=2`
- [ ] `android.challengeLocationBestAccuracyMeters<=80`
- [ ] `android.browserEarnedUnlockNoAppUnlockRunId`
- [ ] `android.browserEarnedUnlockNoAppUnlockArtifact`
- [ ] `android.browserEarnedUnlockNoAppUnlockArtifact local freed-android-browser-earned-unlock-report-v1 JSON with sanitized=true, matching runId/source host/configured package/duration/daily limit and no native app unlock/no-screenshot/no-packet-inspection checks`
- [ ] `android.browserEarnedUnlockSourceHost is a blocked browser/adult-domain source`
- [ ] `android.browserEarnedUnlockNativeAppUnlockActive=false`
- [ ] `android.browserEarnedUnlockConfiguredAppStillShielded=true`
- [ ] `android.browserEarnedUnlockAdultFilterStillActive=true`
- [ ] `android.dnsGuardVpnConsentRunId`
- [ ] `android.dnsGuardVpnConsentArtifact`
- [ ] `android.dnsGuardVpnConsentArtifact local freed-android-permission-report-v1 JSON with sanitized=true, matching runId, VpnService consent required-before/approved-after/no silent-start checks, and Accessibility details/Accessibility/Usage/Network plus app-details/system fallback settings routes`
- [ ] `android.dnsGuardVpnConsentRequiredBeforeApproval=true`
- [ ] `android.dnsGuardVpnConsentRequiredAfterApproval=false`
- [ ] `android.dnsGuardStartedAfterVpnConsent=true`
- [ ] `android.dnsGuardNoSilentStartWithoutConsent=true`
- [ ] `android.dnsGuardDeniedConsentNoPromptLoop=true`
- [ ] `android.dnsGuardResolver`
- [ ] `android.dnsGuardBlockRunId`
- [ ] `android.dnsGuardBlockArtifact`
- [ ] `android.dnsGuardBlockArtifact local freed-dns-guard-block-report-v1 JSON with sanitized=true, matching runId/host/resolver/counter metrics and DNS-only/no-MITM/visible-intervention checks`
- [ ] `android.dnsGuardInterventionVisible=true`
- [ ] `android.dnsGuardLifecycleArtifact`
- [ ] `android.dnsGuardLifecycleArtifact local freed-dns-guard-lifecycle-report-v1 JSON with sanitized=true, matching resolver/counter metrics and DNS-only lifecycle checks`
- [ ] `android.dnsGuardSessionQueries>=2`
- [ ] `android.dnsGuardBlockedQueries>=1`
- [ ] `android.dnsGuardAllowedQueries>=1`
- [ ] `android.dnsGuardServfailResponses>=0`
- [ ] `android.dnsGuardMalformedPackets>=0`
- [ ] `android.dnsGuardRestartRunId`
- [ ] `android.dnsGuardRestartArtifact`
- [ ] `android.dnsGuardRestartArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true, matching runId/action/result/user-enabled/eligible state and no silent VPN prompt/no full-traffic proxy checks`
- [ ] `android.dnsGuardRestartAction=BOOT_COMPLETED or MY_PACKAGE_REPLACED`
- [ ] `android.dnsGuardRestartResult=started`
- [ ] `android.dnsGuardRestartUserEnabled=true`
- [ ] `android.dnsGuardRestartEligible=true`
- [ ] `android.dnsGuardRestartSkippedRunId`
- [ ] `android.dnsGuardRestartSkippedArtifact`
- [ ] `android.dnsGuardRestartSkippedArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true, matching skipped runId/reason/no-silent-prompt state and no consent bypass/no full-traffic proxy checks`
- [ ] `android.dnsGuardRestartSkippedReason=user-disabled or vpn-permission-required`
- [ ] `android.dnsGuardRestartNoSilentPromptConfirmed=true`
- [ ] `android.adultDomainFeedVersion`
- [ ] `android.adultDomainFeedChecksum fnv1a32:<8-hex>`
- [ ] `android.adultDomainFeedDomainCount>0`
- [ ] `android.adultDomainFeedStatusRunId`
- [ ] `android.adultDomainFeedStatusArtifact`
- [ ] `android.adultDomainFeedStatusArtifact local freed-android-adult-domain-feed-status-report-v1 JSON with sanitized=true, matching native feed version/checksum/domain count and synced Accessibility/DNS Guard checks`
- [ ] `android.adultDomainFeedAccessibilityRunId`
- [ ] `android.adultDomainFeedAccessibilityArtifact`
- [ ] `android.adultDomainFeedAccessibilityArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true, matching synced-feed runId/browserPackage/host and native feed source checks`
- [ ] `android.adultDomainFeedDnsGuardRunId`
- [ ] `android.adultDomainFeedDnsGuardArtifact`
- [ ] `android.adultDomainFeedDnsGuardArtifact local freed-dns-guard-block-report-v1 JSON with sanitized=true, matching synced-feed runId/host/resolver/counter metrics and synced adult-domain feed DNS-only checks`
- [ ] `android.nativeHandoffInterventionId`
- [ ] `android.backStackCleanupRunId`
- [ ] `android.backStackCleanupArtifact`
- [ ] `android.normalBrowsingRunId`
- [ ] `android.normalBrowsingArtifact`
- [ ] `android.playPolicyAccessibilityReviewId`
- [ ] `android.playPolicyAccessibilityArtifact`
- [ ] `android.playPolicyAccessibilityArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true, complete AccessibilityService disclosure/config/manifest signals, DNS Guard special-use FGS disclosure signals, sha256 source hashes, and Play review IDs recorded separately`
- [ ] `android.playPolicySpecialUseFgsReviewId`
- [ ] `android.playPolicySpecialUseFgsArtifact`
- [ ] `android.playPolicySpecialUseFgsArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true, complete AccessibilityService disclosure/config/manifest signals, DNS Guard special-use FGS disclosure signals, sha256 source hashes, and Play review IDs recorded separately`
- [ ] `android.normalBrowsingAllowedUrl`
- [ ] `android.adultInterceptedHost external adult host or adult-intent search URL`

## normal browsing false-positive corpus

- Target evidence: `docs/validation/evidence/normal-browsing-corpus.json`
- Draft file: `draft-evidence/normal-browsing-corpus.json`
- Next action: Run the normal-browsing false-positive corpus on real devices/browsers and capture docs/validation/evidence/normal-browsing-corpus.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

Capture helper:

```sh
npm run evidence:normal-browsing-corpus -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/normal-browsing-corpus-capture
```

Helper notes:
- `normal-browsing-browser-summary.template.json` precomputes pending `normalBrowsing.browserMatrix` rows with exact URL counts; fill device details, artifacts, pass counts, zero failure counts, and `passed=true` only after physical-browser QA passes every matrix row.
- `browser-report-templates/*.template.json` gives each browser row a pending `freed-normal-browsing-browser-report-v1` shape with `sanitized=true`; complete these as local JSON result artifacts before copying paths into `normalBrowsing.browserMatrix[].resultArtifact`.
- `normal-browsing-evidence-fill-template.json` mirrors the final evidence shape but starts with false checks and blank pass fields so it remains a handoff aid, not release evidence.

Required checks:
- [ ] `checks.googleAllowed`
- [ ] `checks.youtubeAllowed`
- [ ] `checks.instagramAllowed`
- [ ] `checks.xTwitterAllowed`
- [ ] `checks.educationAllowed`
- [ ] `checks.streamingAllowed`
- [ ] `checks.gamingAllowed`
- [ ] `checks.productivityAllowed`
- [ ] `checks.recoverySearchAllowed`
- [ ] `checks.adultSearchStillBlocked`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `device`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `normalBrowsing.classifierCorpusSource=scripts/classifier-safety-corpus.ts`
- [ ] `normalBrowsing.classifierCorpusCaseCount equals current classifier corpus length`
- [ ] `normalBrowsing.classifierCorpusPassCount equals classifierCorpusCaseCount`
- [ ] `normalBrowsing.classifierCorpusFailedCount=0`
- [ ] `normalBrowsing.browserMatrix[]`
- [ ] `normalBrowsing.browserMatrix includes iOS Safari`
- [ ] `normalBrowsing.browserMatrix includes Android Chrome`
- [ ] `normalBrowsing.browserMatrix includes Android Firefox`
- [ ] `normalBrowsing.browserMatrix includes Android Edge`
- [ ] `normalBrowsing.browserMatrix includes Samsung Internet`
- [ ] `normalBrowsing.browserMatrix[].isPhysicalDevice=true`
- [ ] `normalBrowsing.browserMatrix[].runId`
- [ ] `normalBrowsing.browserMatrix[].resultArtifact`
- [ ] `normalBrowsing.browserMatrix[].resultArtifact local freed-normal-browsing-browser-report-v1 JSON with sanitized=true, matching runId/platform/browser/counts and pass/no-false-positive/no-missed-block checks`
- [ ] `normalBrowsing.browserMatrix[].passed=true`
- [ ] `normalBrowsing.browserMatrix[].allowedUrlCount`
- [ ] `normalBrowsing.browserMatrix[].recoverySearchUrlCount`
- [ ] `normalBrowsing.browserMatrix[].adultBlockedUrlCount`
- [ ] `normalBrowsing.browserMatrix[].allowedUrlPassCount`
- [ ] `normalBrowsing.browserMatrix[].recoverySearchPassCount`
- [ ] `normalBrowsing.browserMatrix[].adultBlockPassCount`
- [ ] `normalBrowsing.browserMatrix[].falsePositiveCount=0`
- [ ] `normalBrowsing.browserMatrix[].missedAdultBlockCount=0`
- [ ] `normalBrowsing.allowedUrls[]`
- [ ] `normalBrowsing.allowedUrls includes Google`
- [ ] `normalBrowsing.allowedUrls includes YouTube`
- [ ] `normalBrowsing.allowedUrls includes Instagram`
- [ ] `normalBrowsing.allowedUrls includes X/Twitter`
- [ ] `normalBrowsing.allowedUrls includes education`
- [ ] `normalBrowsing.allowedUrls includes streaming`
- [ ] `normalBrowsing.allowedUrls includes gaming`
- [ ] `normalBrowsing.allowedUrls includes productivity`
- [ ] `normalBrowsing.recoverySearchUrls[]`
- [ ] `normalBrowsing.recoverySearchUrls includes adult-term recovery intent`
- [ ] `normalBrowsing.adultBlockedUrls[]`
- [ ] `normalBrowsing.adultBlockedUrls includes adult consumption intent`
- [ ] `normalBrowsing.adultBlockedUrls excludes app-owned fixture/documentation hosts`

Device URL checklist:

Allowed URL checks:
- [ ] `https://google.com/search?q=weather` - expect allow
- [ ] `https://youtube.com/results?search_query=workout` - expect allow
- [ ] `https://instagram.com/explore` - expect allow
- [ ] `https://x.com/home` - expect allow
- [ ] `https://coursera.org/learn/math` - expect allow
- [ ] `https://netflix.com/browse` - expect allow
- [ ] `https://store.steampowered.com/app/123` - expect allow
- [ ] `https://notion.so/workspace` - expect allow
- [ ] `https://wikipedia.org/wiki/Exercise` - expect allow
- [ ] `https://open.spotify.com/` - expect allow
- [ ] `https://github.com/features/actions` - expect allow
- [ ] `https://roblox.com/discover` - expect allow

Recovery-search URL checks:
- [ ] `https://duckduckgo.com/?q=porn+addiction+therapy` - expect allow
- [ ] `https://google.com/search?q=porn+recovery+accountability` - expect allow
- [ ] `https://google.com/search?q=accountability+software+porn+addiction` - expect allow
- [ ] `https://duckduckgo.com/?q=quit+porn+support+group` - expect allow

Adult-intent block checks:
- [ ] `https://bing.com/search?q=porn` - expect block
- [ ] `https://pornhub.com` - expect block
- [ ] `https://google.com/search?q=free+explicit+videos` - expect block
- [ ] `https://xvideos.com` - expect block

## battery/RAM/network profile

- Target evidence: `docs/validation/evidence/performance-profile.json`
- Draft file: `draft-evidence/performance-profile.json`
- Next action: Profile battery, RAM, thermals, background CPU, DNS latency, and network speed, then capture docs/validation/evidence/performance-profile.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

Capture helper:

```sh
npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/performance-profile-capture
```

Helper notes:
- Keep `--android-background-cpu-proof` on the physical Android helper run to sample package-specific `dumpsys cpuinfo`, write `android-background-cpu-proof.txt`/`.json`, and prefill the Android background CPU artifact plus maximum parsed percent for QA review.
- Use `performance-profile-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every threshold metric blank and every check false until the real profiler, DNS, speed, and routing QA passes.
- Android routing proof is captured automatically for no-full-traffic-proxy, no-packet-inspection, and no-MITM-HTTPS review; still attach DNS latency, download-speed, DNS failover, SERVFAIL fallback, VPN revocation, continuous screenshot/OCR absence, continuous image-classification absence, and full profiler artifacts before promotion.

Required checks:
- [ ] `checks.normalBrowsingSpeedAcceptable`
- [ ] `checks.noOverheating`
- [ ] `checks.noBatteryDrainRegression`
- [ ] `checks.dnsOnlyRoutingConfirmed`
- [ ] `checks.noForegroundPollingLoopObserved`
- [ ] `checks.noPacketInspection`
- [ ] `checks.noMitmHttps`
- [ ] `checks.noContinuousScreenshotOrOcr`
- [ ] `checks.noContinuousImageClassification`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `device`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `profile.durationMinutes>=30`
- [ ] `profile.batteryDrainPercent between 0 and 8`
- [ ] `profile.maxResidentMemoryMb between 1 and 350`
- [ ] `profile.maxDeviceTemperatureC between 1 and 42`
- [ ] `profile.dnsLatencyP95Ms between 1 and 100`
- [ ] `profile.downloadMbpsBefore>0`
- [ ] `profile.downloadMbpsDuring>0`
- [ ] `profile.downloadMbpsDuring>=80% of profile.downloadMbpsBefore`
- [ ] `profile.platformProfiles[]`
- [ ] `profile.platformProfiles includes iOS physical device`
- [ ] `profile.platformProfiles includes Android physical device`
- [ ] `profile.platformProfiles[].isPhysicalDevice=true`
- [ ] `profile.platformProfiles[].runId`
- [ ] `profile.platformProfiles[].profilerArtifact`
- [ ] `profile.platformProfiles[].backgroundCpuRunId`
- [ ] `profile.platformProfiles[].backgroundCpuArtifact`
- [ ] `profile.platformProfiles[].routingProofRunId`
- [ ] `profile.platformProfiles[].routingProofArtifact`
- [ ] `profile.platformProfiles[].routingProofArtifact local freed-routing-proof-report-v1 JSON with sanitized=true, matching runId/platform/protection mode and no full-traffic proxy/no packet inspection/no MITM checks`
- [ ] `profile.platformProfiles[].protectionMode`
- [ ] `profile.platformProfiles[].networkSpeedRunId`
- [ ] `profile.platformProfiles[].networkSpeedArtifact`
- [ ] `profile.platformProfiles[].networkSpeedArtifact local freed-network-speed-report-v1 JSON with sanitized=true, matching runId/platform/download Mbps metrics and no-proxy/no-MITM checks`
- [ ] `profile.platformProfiles[].dnsLatencyRunId`
- [ ] `profile.platformProfiles[].dnsLatencyArtifact`
- [ ] `profile.platformProfiles[].dnsLatencyArtifact local freed-dns-latency-report-v1 JSON with sanitized=true, matching runId/platform/p95 latency, sample count, and DNS-only checks`
- [ ] `profile.platformProfiles[android].dnsResolverFailoverRunId`
- [ ] `profile.platformProfiles[android].dnsResolverFailoverArtifact`
- [ ] `profile.platformProfiles[android].dnsServfailRunId`
- [ ] `profile.platformProfiles[android].dnsServfailArtifact`
- [ ] `profile.platformProfiles[android].dnsServfailFallbackConfirmed=true`
- [ ] `profile.platformProfiles[android].vpnRevocationRunId`
- [ ] `profile.platformProfiles[android].vpnRevocationArtifact`
- [ ] `profile.platformProfiles[android].vpnRevocationCleanupConfirmed=true`
- [ ] `profile.platformProfiles[].durationMinutes>=30`
- [ ] `profile.platformProfiles[].backgroundCpuPercent<=5`
- [ ] `profile.platformProfiles[].downloadMbpsDuring>=80% of before`
- [ ] `profile.platformProfiles[].normalBrowsingSpeedAcceptable=true`
- [ ] `profile.platformProfiles[].noOverheating=true`
- [ ] `profile.platformProfiles[].noBatteryDrainRegression=true`
- [ ] `profile.platformProfiles[].noForegroundPollingLoopObserved=true`
- [ ] `profile.platformProfiles[].noFullTrafficProxyConfirmed=true`
- [ ] `profile.platformProfiles[].noPacketInspectionConfirmed=true`
- [ ] `profile.platformProfiles[].noMitmHttpsConfirmed=true`
- [ ] `profile.platformProfiles[].noContinuousScreenshotOrOcrConfirmed=true`
- [ ] `profile.platformProfiles[].noContinuousImageClassificationConfirmed=true`

Required numeric profile fields:
- [ ] `profile.durationMinutes`
- [ ] `profile.batteryDrainPercent`
- [ ] `profile.maxResidentMemoryMb`
- [ ] `profile.maxDeviceTemperatureC`
- [ ] `profile.dnsLatencyP95Ms`
- [ ] `profile.downloadMbpsBefore`
- [ ] `profile.downloadMbpsDuring`

## store/ad sandbox

- Target evidence: `docs/validation/evidence/store-ad-sandbox.json`
- Draft file: `draft-evidence/store-ad-sandbox.json`
- Next action: Validate Core 3-only console products, paywall scope, IAP restore/purchase, rewarded ads, and premium no-ad intervention in store/ad sandboxes, then capture docs/validation/evidence/store-ad-sandbox.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

Capture helper:

```sh
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/store-ad-sandbox-capture
```

Helper notes:
- `--release-env-file` preloads non-secret store provider, Core 3 product IDs, entitlement, purchase endpoint, rewarded-ad unit, and coarse country context into the sanitized capture manifest.
- `store-ad-sandbox-evidence-fill-template.json` mirrors the final evidence shape with the Core 3 launch-product matrix, but keeps artifacts/counts blank and checks false until real sandbox QA fills them.
- `paywall-launch-scope-report.template.json` gives QA the local `freed-paywall-launch-scope-report-v1` shape for proving only Core 3 products are shown, future SKUs are hidden, yearly is the value anchor, restore is visible, and purchase buttons are enabled.
- `store-console-product-setup-report.template.json` gives QA the local `freed-store-console-product-setup-report-v1` shape for proving App Store Connect and Play Console have only Core 3 products configured, future SKUs inactive, screenshots/localizations attached, and draft/internal/TestFlight-only status until evidence passes.
- Explicit store/ad CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw receipts, Play tokens, customer IDs, store credentials, and ad-network secrets.

Required command proof:
- [ ] `npm run preflight:release-env`
- [ ] `npm run smoke:purchase-verification`

Required checks:
- [ ] `checks.iosPurchaseSandbox`
- [ ] `checks.iosRestoreSandbox`
- [ ] `checks.androidPurchaseSandbox`
- [ ] `checks.androidRestoreSandbox`
- [ ] `checks.releaseEnvPreflightPassed`
- [ ] `checks.purchaseVerificationSmokePassed`
- [ ] `checks.receiptOrEntitlementVerified`
- [ ] `checks.rewardedAdLoaded`
- [ ] `checks.rewardedOnlyAdFormat`
- [ ] `checks.rewardedAdNonPersonalizedRequest`
- [ ] `checks.rewardedAdCountryContextRecorded`
- [ ] `checks.noInterstitialOrBannerAdsRequested`
- [ ] `checks.storePrivacyDisclosureReviewed`
- [ ] `checks.paywallCore3OnlyShown`
- [ ] `checks.storeConsoleProductsConfigured`
- [ ] `checks.freeStreakRiskContextShown`
- [ ] `checks.freeRewardedAdBeforeChallenge`
- [ ] `checks.freePostAdChallengeGenerated`
- [ ] `checks.rewardedAdCompletionGrantsChallenge`
- [ ] `checks.adFailureFallbackUnlocksChallenge`
- [ ] `checks.premiumNoRewardedAdRequested`
- [ ] `checks.premiumNoAdInterventionStartsChallenge`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `environment`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `store.storeProvider matches configured monetization provider`
- [ ] `store.iosProductId configured FREED Core 3 launch product ID`
- [ ] `store.androidProductId configured FREED Core 3 launch product ID`
- [ ] `store.iosLaunchProductIds.{monthly,yearly,lifetime} configured Core 3 launch product IDs only`
- [ ] `store.androidLaunchProductIds.{monthly,yearly,lifetime} configured Core 3 launch product IDs only`
- [ ] `store.launchProductSandboxMatrix[] includes yearly, monthly, and lifetime with App Store purchase/restore, Play purchase/restore, and local purchase-verification-smoke-v1 server entitlement verification artifacts inspected per row`
- [ ] `store.purchaseVerifyEndpoint production-safe, no URL credentials/query/fragment, and matches configured purchase verification endpoint`
- [ ] `store.releasePreflightCommand`
- [ ] `store.releasePreflightRunId`
- [ ] `store.releasePreflightArtifact`
- [ ] `store.iosPurchaseRunId`
- [ ] `store.iosPurchaseArtifact`
- [ ] `store.iosPurchaseTransactionId numeric StoreKit format`
- [ ] `store.iosRestoreRunId`
- [ ] `store.iosRestoreArtifact`
- [ ] `store.iosRestoreTransactionId numeric StoreKit format`
- [ ] `store.androidPurchaseRunId`
- [ ] `store.androidPurchaseArtifact`
- [ ] `store.androidOrderId GPA.1234-5678-9012-34567 format`
- [ ] `store.androidRestoreRunId`
- [ ] `store.androidRestoreArtifact`
- [ ] `store.androidPurchaseTokenHash=sha256-<64-hex-chars>`
- [ ] `store.entitlementId matches configured premium entitlement ID`
- [ ] `store.purchaseSmokeCommand`
- [ ] `store.paywallScopeRunId`
- [ ] `store.paywallLaunchScopeArtifact`
- [ ] `store.paywallLaunchScopeArtifact local freed-paywall-launch-scope-report-v1 JSON with sanitized=true, matching paywallScopeRunId, source hashes for the paywall and monetization code, Core 3 yearly/monthly/lifetime plan IDs and configured product IDs visible only, family/accountability/AI-coach product IDs hidden, yearly value anchor visible, restore visible, purchase buttons enabled, server verification copy visible, premium no-ad benefit visible, and no future upsell checks`
- [ ] `store.consoleProductSetupRunId`
- [ ] `store.consoleProductSetupArtifact`
- [ ] `store.consoleProductSetupArtifact local freed-store-console-product-setup-report-v1 JSON with sanitized=true, matching consoleProductSetupRunId, source hashes for store product catalog, App Store IAP CSV, Play product CSV, screenshot manifest, read-only Browser app-record readiness report hash proving Play app record, App Store Connect app record, and Apple license-agreement readiness, Core 3 yearly/monthly/lifetime products configured only, App Store monthly/yearly subscription group and lifetime non-consumable configured, Play monthly/yearly base plans and lifetime one-time non-consumable configured, product localizations and review screenshots attached, server-verification metadata configured, redacted App Store Connect and Play Console evidence artifacts with matching hashes captured, future family/accountability/AI-coach SKUs inactive, no extra launch products active, and draft/internal/TestFlight-only status until evidence passes`
- [ ] `store.purchaseVerificationReportId`
- [ ] `store.purchaseVerificationArtifact local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 fake-known yearly/monthly/lifetime PASS result rows, 0 failures, endpoint validation, bounded timeout, synthetic-only rejection proof, matching launchProductIdsChecked, no raw token/receipt/order/package echo, checked server-secret key names, and secretValuesOmitted=true`
- [ ] `store.purchaseVerificationPassCount>=6`
- [ ] `store.purchaseVerificationFailedCount=0`
- [ ] `store.restoreVerificationReportId`
- [ ] `store.restoreVerificationArtifact local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 fake-known yearly/monthly/lifetime PASS result rows, 0 failures, endpoint validation, bounded timeout, synthetic-only rejection proof, matching launchProductIdsChecked, no raw token/receipt/order/package echo, checked server-secret key names, and secretValuesOmitted=true`
- [ ] `store.restoreVerificationPassCount>=6`
- [ ] `store.restoreVerificationFailedCount=0`
- [ ] `store.rewardedAdUnitId configured real AdMob format`
- [ ] `store.rewardedAdFormat=rewarded`
- [ ] `store.rewardedAdResponseId concrete loaded-ad response ID`
- [ ] `store.rewardedAdRequestArtifact`
- [ ] `store.rewardedAdRequestArtifact local freed-rewarded-ad-request-report-v1 JSON with sanitized=true, matching rewardedAdUnitId/rewardedAdResponseId/country code, rewarded format, non-personalized request, no interstitial/banner/app-open/native ad requests, no advertising ID, no precise location, no raw device identifiers, and no ad-network secrets`
- [ ] `store.noInterstitialOrBannerAdRequestsConfirmed=true`
- [ ] `store.freeRewardedInterventionRunId`
- [ ] `store.freeRewardedInterventionArtifact`
- [ ] `store.freeRewardedInterventionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true, matching freeRewardedInterventionRunId, flowType=free-rewarded-intervention, streak-risk/free-plan/rewarded-before-challenge/challenge-generated/supportive-copy/no-punitive-copy checks, no premium bypass, no raw ad payload, and latency matching freePostAdChallengeLatencyMs<=5000`
- [ ] `store.freePostAdChallengeLatencyMs<=5000`
- [ ] `store.rewardedAdCompletionRunId`
- [ ] `store.rewardedAdCompletionArtifact`
- [ ] `store.rewardedAdCompletionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true, matching rewardedAdCompletionRunId, flowType=rewarded-ad-completion, rewarded completion, challenge access, temporary access only, supportive-copy, no purchase grant, and no raw ad payload checks`
- [ ] `store.adFailureFallbackRunId`
- [ ] `store.adFailureFallbackArtifact`
- [ ] `store.adFailureFallbackArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true, matching adFailureFallbackRunId, flowType=ad-failure-fallback, ad failure observed, challenge unlocked without punishment, no retry loop, supportive-copy, no premium grant, and no raw ad error checks`
- [ ] `store.premiumNoAdInterventionRunId`
- [ ] `store.premiumNoAdInterventionArtifact`
- [ ] `store.premiumNoAdInterventionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true, matching premiumNoAdInterventionRunId, flowType=premium-no-ad-intervention, premium entitlement, no rewarded ad request, challenge generated, supportive-copy, no ad SDK request, no upsell, no raw entitlement token, and latency matching premiumNoAdLatencyMs<=3000`
- [ ] `store.premiumNoRewardedAdRequested=true`
- [ ] `store.premiumNoAdLatencyMs<=3000`
- [ ] `store.adRequestNonPersonalized=true`
- [ ] `store.adRequestCountryCode ISO 3166-1 alpha-2`
- [ ] `store.privacyDisclosureReviewId`
- [ ] `store.privacyDisclosureArtifact`
- [ ] `store.privacyDisclosureArtifact local freed-store-privacy-disclosure-report-v1 JSON with sanitized=true, matching privacyDisclosureReviewId, iOS and Android platforms reviewed, App Store privacy, Play Data safety, billing, purchase verification, rewarded ads, non-personalized ads, aggregate analytics opt-in, no tracking, no advertising ID permission, no raw receipt/token, no store credential/ad-secret, no sensitive recovery content, and no challenge media upload checks`

## AI backend smoke

- Target evidence: `docs/validation/evidence/ai-backend-smoke.json`
- Draft file: `draft-evidence/ai-backend-smoke.json`
- Next action: Run AI safety eval plus deployed backend smoke tests, then capture docs/validation/evidence/ai-backend-smoke.json.
- Artifact folder: `docs/validation/artifacts/2026-05-13-release-evidence/`

Capture helper:

```sh
npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-capture
```

Helper notes:
- `--release-env-file` preloads non-secret coach endpoint, challenge endpoint, optional retention endpoint, and model context into the sanitized capture manifest.
- `ai-backend-smoke-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret context, but keeps artifacts/counts blank and checks false until real deployed-endpoint QA fills them.
- Explicit AI helper CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw prompts, transcripts, private notes, sensitive URLs/domains, unredacted model output, and provider API keys.

Required command proof:
- [ ] `npm run preflight:release-env`
- [ ] `npm run eval:ai-safety`
- [ ] `npm run smoke:ai-backend`

Required checks:
- [ ] `checks.aiSafetyEvalPassed`
- [ ] `checks.releaseEnvPreflightPassed`
- [ ] `checks.coachSmokePassed`
- [ ] `checks.challengeSmokePassed`
- [ ] `checks.challengePersonalizationVerified`
- [ ] `checks.riskForecastPersonalizationVerified`
- [ ] `checks.sessionDurationBucketPersonalizationVerified`
- [ ] `checks.recentFailureCountPersonalizationVerified`
- [ ] `checks.freeChallengePremiumExcluded`
- [ ] `checks.noCoordinateFields`
- [ ] `checks.noSensitiveEcho`
- [ ] `checks.crisisFallbackVerified`
- [ ] `checks.fallbackBehaviorVerified`

Required fields:
- [ ] `validatedAt`
- [ ] `tester`
- [ ] `build`
- [ ] `environment`
- [ ] `evidence[]`
- [ ] `evidence[] local artifact or production-safe HTTPS QA/report URL`
- [ ] `ai.coachEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote coach endpoint`
- [ ] `ai.challengeEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote challenge endpoint`
- [ ] `when EXPO_PUBLIC_RETENTION_ENDPOINT is configured: ai.retentionEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote retention endpoint`
- [ ] `ai.model concrete remote provider model ID matching configured OPENAI_MODEL or GEMINI_MODEL when present`
- [ ] `ai.releasePreflightCommand`
- [ ] `ai.releasePreflightRunId`
- [ ] `ai.releasePreflightArtifact`
- [ ] `ai.safetyEvalCommand`
- [ ] `ai.smokeCommand`
- [ ] `ai.safetyEvalReportId`
- [ ] `ai.safetyEvalArtifact`
- [ ] `ai.safetyEvalCaseCount>=10`
- [ ] `ai.safetyEvalFailedCount=0`
- [ ] `ai.smokeReportId`
- [ ] `ai.smokeReportArtifact local ai-backend-smoke-v1 JSON report with sanitized=true, contractProof, required PASS result rows, 0 failures, endpoint path requirements, no-sensitive-echo/no-coordinate proof, checked server-secret key names, and secretValuesOmitted=true`
- [ ] `ai.coachSmokeRunId`
- [ ] `ai.coachSmokeArtifact`
- [ ] `ai.challengeSmokeRunId`
- [ ] `ai.challengeSmokeArtifact`
- [ ] `when EXPO_PUBLIC_RETENTION_ENDPOINT is configured: ai.retentionSmokeRunId`
- [ ] `when EXPO_PUBLIC_RETENTION_ENDPOINT is configured: ai.retentionSmokeArtifact`
- [ ] `ai.smokeEndpointPassCount>=2, or >=3 when EXPO_PUBLIC_RETENTION_ENDPOINT is configured`
- [ ] `ai.smokeEndpointFailCount=0`
- [ ] `ai.challengePersonalizationRunId`
- [ ] `ai.challengePersonalizationArtifact`
- [ ] `ai.challengePersonalizationProfileCount>=2`
- [ ] `ai.challengeRiskForecastProfileCount>=2`
- [ ] `ai.challengeSessionDurationBucketProfileCount>=1`
- [ ] `ai.challengeRecentFailureProfileCount>=1`
- [ ] `ai.freeChallengePremiumCount=0`
- [ ] `ai.noCoordinateFieldsRunId`
- [ ] `ai.noCoordinateFieldsArtifact`
- [ ] `ai.noSensitiveEchoSampleCount>=2, or >=3 when EXPO_PUBLIC_RETENTION_ENDPOINT is configured`
- [ ] `ai.noSensitiveEchoRunId`
- [ ] `ai.noSensitiveEchoArtifact`
- [ ] `when EXPO_PUBLIC_RETENTION_ENDPOINT is configured: checks.retentionAggregateOnlyVerified=true`
- [ ] `ai.redactionReportId`
- [ ] `ai.redactionArtifact`
- [ ] `ai.crisisFallbackRunId`
- [ ] `ai.crisisFallbackArtifact`
- [ ] `ai.providerFallbackRunId`
- [ ] `ai.providerFallbackArtifact`

## Canonical Handoff Commands

These commands are generated from the same shared source as `requirements.json`, `docs/validation/README.md`, and `docs/validation/evidence-runbook.md`.

```sh
npm run evidence:requirements
npm run evidence:templates
npm run evidence:ios-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-device-discovery
npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-physical-device-capture
npm run evidence:android-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-device-discovery
npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-install-qa --require-upload-signing
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-real-browser-capture
npm run evidence:normal-browsing-corpus -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/normal-browsing-corpus-capture
npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/performance-profile-capture
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/store-ad-sandbox-capture
npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-capture
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json
npm run audit:store-legal-hosted -- --report docs/validation/artifacts/2026-05-13-release-evidence/store-legal-hosted-url-audit.json
npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-apk-build-report.json
npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-aab-build-report.json
npm run build:ios-archive:release -- --report docs/validation/artifacts/2026-05-13-release-evidence/ios-release-archive-report.json
npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/backend-readiness-smoke-report.json
npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/supabase-schema-smoke-report.json
npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/adult-domain-feed-smoke-report.json
npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/analytics-ingestion-smoke-report.json
npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/remote-notification-smoke-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/purchase-verification-smoke-report.json
npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-report.json
npm run audit:release:strict -- --report docs/validation/artifacts/2026-05-13-release-evidence/release-readiness-report.json
npm run evidence:validation:draft -- docs/validation/artifacts/2026-05-13-release-evidence/draft-evidence
npm run evidence:promote -- --from docs/validation/artifacts/2026-05-13-release-evidence/draft-evidence
npm run evidence:validation
npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/2026-05-13-release-evidence
npm run audit:release
```
