# FREED Production Env Gap Checklist

Generated: 2026-06-10T23:01:10.720Z
Source preflight report: `docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
Source preflight sha256: `sha256-d9a738ed0afa6bce269fe5bd05e4b3005b450a235ed6154e7302d62ff557d16a`
Source env snapshot: `process.env`
Checklist result: pending

This checklist is a configuration handoff only. It does not prove deployed services, physical-device behavior, sandbox purchases, or store approval.

Do not paste real secrets, purchase receipts, raw purchase tokens, App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, APNs/FCM credentials, maintenance secrets, or AI provider keys into docs/validation artifacts.

## Current Snapshot

- Preflight result: fail
- Preflight checks: 9 pass, 22 fail
- Production env groups still failing: 7
- External validation groups still pending: 6
- Production env groups already passing: none
- Missing-key env skeleton: `docs/validation/artifacts/release-env-current/PRODUCTION_ENV_MISSING_KEYS.env`
- Public launch defaults prefilled: entitlement `premium`, bundle/package `app.freed.recovery`, Core 3 product IDs `freed_premium_yearly`, `freed_premium_monthly`, `freed_premium_lifetime`
- EAS project metadata keys included: `EAS_PROJECT_ID`, `EXPO_PROJECT_ID`, optional `EXPO_OWNER`
- Apply public defaults to private env: `npm run setup:release-env-public-defaults -- --env-file <production-env-file> --write`

## Configure First

### expo-eas-project-metadata

- Status: pending until the EAS project is linked and `npm run eas:deploy:legal-web` can read project metadata.
- Next: Set EAS_PROJECT_ID or EXPO_PROJECT_ID from the linked Expo project, and optionally EXPO_OWNER, before EAS builds, submits, or legal web deploys.

Required env names:
- `EAS_PROJECT_ID`
- `EXPO_PROJECT_ID`
- `EXPO_OWNER`

Required report commands:
- `npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json`

### production-backend-infrastructure

- Status: fail
- Category: production-env
- Next: Configure Supabase, Redis/Upstash, public anon lockout proof, and maintenance secrets, then rerun release preflight plus deployed backend/schema smoke reports.

Required env names:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_MAINTENANCE_SECRET or CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/backend-readiness-smoke-report.json`
- `npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/supabase-schema-smoke-report.json`

Failed preflight checks:
- `supabase-backend-credentials`: SUPABASE_URL is not configured, SUPABASE_SERVICE_ROLE_KEY must be a production-shaped service-role secret, EXPO_PUBLIC_SUPABASE_URL is required for Supabase public anon lockout proof and hosted auth, EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public anon JWT for Supabase schema public-client lockout proof, BACKEND_MAINTENANCE_SECRET or CRON_SECRET must be a production-shaped maintenance secret
  Next: Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, BACKEND_MAINTENANCE_SECRET or CRON_SECRET, and optional FREED_BACKEND_PROVIDER_TIMEOUT_MS / FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES / FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS with production values.
- `redis-backend-infrastructure`: UPSTASH_REDIS_REST_URL is not configured, UPSTASH_REDIS_REST_TOKEN must be a production-shaped Redis REST token
  Next: Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN with server-only production values.
- `backend-readiness-endpoint`: backend readiness endpoint is not configured
  Next: Configure EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT as the deployed /api/backend/readiness route, or let the smoke command derive it from another deployed app endpoint, and keep optional timeout values bounded.

### production-analytics-ingestion

- Status: fail
- Category: production-env
- Next: Configure the deployed aggregate-only /api/analytics endpoint and prove the sanitized analytics ingestion smoke report.

Required env names:
- `EXPO_PUBLIC_ANALYTICS_ENDPOINT`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/analytics-ingestion-smoke-report.json`

Failed preflight checks:
- `analytics-ingestion-endpoint`: remote analytics endpoint is not configured
  Next: Configure EXPO_PUBLIC_ANALYTICS_ENDPOINT as the deployed aggregate-only app/api/analytics route after privacy review; runtime sharing still requires explicit user consent, and optional analytics timeout/response-size values must stay within documented bounds.

### production-notification-backend

- Status: fail
- Category: production-env
- Next: Configure server-side APNs/FCM dispatch credentials and prove the non-sending notification smoke report.

Required env names:
- `REMOTE_NOTIFICATION_DISPATCH_SECRET`
- `FCM_SERVER_KEY, FCM_ACCESS_TOKEN + FIREBASE_PROJECT_ID, or FIREBASE_SERVICE_ACCOUNT_JSON(_BASE64)`
- `APNS_KEY_ID + APNS_TEAM_ID + APNS_BUNDLE_ID + APNS_ENV=production + APNS_PRIVATE_KEY(_BASE64)`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/remote-notification-smoke-report.json`

Failed preflight checks:
- `remote-notification-provider-credentials`: REMOTE_NOTIFICATION_DISPATCH_SECRET must be a production-shaped dispatch secret, FCM credentials must include a production FCM server key, Firebase service account JSON with project_id, or FCM_ACCESS_TOKEN plus FIREBASE_PROJECT_ID, APNs credentials must include production APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_ENV=production, and APNS_PRIVATE_KEY(_BASE64)
  Next: Configure REMOTE_NOTIFICATION_DISPATCH_SECRET, optional FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS, FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES, and FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS, FCM credentials with FIREBASE_PROJECT_ID or Firebase service-account project_id, and APNs production signing credentials for server-authorized recovery-safe push dispatch.

### production-adult-domain-feed

- Status: fail
- Category: production-env
- Next: Configure reviewed adult-domain feed sources and prove the deployed feed freshness/cache/source smoke report.

Required env names:
- `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT`
- `EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true`
- `FREED_ADULT_DOMAIN_FEED_SOURCE_URLS`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/adult-domain-feed-smoke-report.json`

Failed preflight checks:
- `adult-domain-feed-endpoint`: adult domain feed endpoint is not configured
  Next: Configure EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT as an HTTPS non-local deployed API route.
- `adult-domain-feed-sources`: FREED_ADULT_DOMAIN_FEED_SOURCE_URLS must include at least one reviewed HTTPS source feed, EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED must be true for production release verification
  Next: Configure FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries such as OISD NSFW or StevenBlack-style adult lists, and keep optional feed cache/timeout/size values within documented bounds.

### production-monetization

- Status: fail
- Category: production-env
- Next: Configure native IAP, purchase verification, and AdMob env values, then prove purchase smoke plus store/ad sandbox evidence.
- Target evidence file: `docs/validation/evidence/store-ad-sandbox.json`

Required env names:
- `EXPO_PUBLIC_MONETIZATION_MODE=native`
- `EXPO_PUBLIC_STORE_PROVIDER=native-iap`
- `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT`
- `EXPO_PUBLIC_IAP_PRODUCT_*`
- `EXPO_PUBLIC_ADMOB_APP_ID_IOS`
- `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`
- `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS`
- `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID`
- `APP_STORE_BUNDLE_ID`
- `APP_STORE_SERVER_API_ENV=production`
- `App Store Server API credentials`
- `GOOGLE_PLAY_PACKAGE_NAME`
- `Google Play verification credentials`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/purchase-verification-smoke-report.json`

Failed preflight checks:
- `release-monetization-mode`: EXPO_PUBLIC_MONETIZATION_MODE is not native.
  Next: Set EXPO_PUBLIC_MONETIZATION_MODE=native for signed release verification.
- `iap-product-ids`: Launch Core 3 product identifiers are checked for non-placeholder values.
  Next: Configure EXPO_PUBLIC_IAP_PRODUCT_YEARLY, EXPO_PUBLIC_IAP_PRODUCT_MONTHLY, and EXPO_PUBLIC_IAP_PRODUCT_LIFETIME with real App Store / Play product IDs.
- `purchase-verify-endpoint`: purchase verify endpoint is not configured
  Next: Configure EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT as an HTTPS non-local deployed API route, and keep optional purchase verification timeout and response-size values within documented bounds.
- `app-store-environment`: APP_STORE_SERVER_API_ENV is not production.
  Next: Set APP_STORE_SERVER_API_ENV=production for the final release preflight.
- `app-store-verification-credentials`: App Store bundle ID plus issuer/key/private-key credentials or JWT fallback are missing.
  Next: Configure APP_STORE_BUNDLE_ID and either APP_STORE_ISSUER_ID + APP_STORE_KEY_ID + APP_STORE_PRIVATE_KEY(_BASE64), or APP_STORE_SERVER_API_JWT.
- `google-play-verification-credentials`: Google Play package name plus service account credentials or access-token fallback are missing.
  Next: Configure GOOGLE_PLAY_PACKAGE_NAME and either GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(_BASE64), or GOOGLE_PLAY_ACCESS_TOKEN.
- `admob-app-ids`: iOS and Android AdMob app IDs are checked for production format and non-sample publisher IDs.
  Next: Configure EXPO_PUBLIC_ADMOB_APP_ID_IOS and EXPO_PUBLIC_ADMOB_APP_ID_ANDROID with real ca-app-pub IDs.
- `admob-rewarded-units`: iOS and Android rewarded reset units are checked for production format and non-sample publisher IDs.
  Next: Configure real rewarded unit IDs for both platforms.
- `admob-test-ads-disabled`: EXPO_PUBLIC_ADMOB_USE_TEST_ADS is not explicitly false.
  Next: Set EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false for production release verification.

### production-android-signing

- Status: fail
- Category: production-env
- Next: Run npm run setup:android-upload-keystore -- --generate-passwords or configure existing secure Android upload signing credentials, point the store-file env value at the secure CI/local keystore, then produce sanitized upload-signed APK and AAB build reports before Play upload.

Required env names:
- `FREED_ANDROID_UPLOAD_STORE_FILE`
- `FREED_ANDROID_UPLOAD_STORE_PASSWORD`
- `FREED_ANDROID_UPLOAD_KEY_ALIAS`
- `FREED_ANDROID_UPLOAD_KEY_PASSWORD`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/android-apk-build-report.json`
- `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/android-aab-build-report.json`

Failed preflight checks:
- `android-release-signing`: FREED_ANDROID_UPLOAD_STORE_FILE is not configured, FREED_ANDROID_UPLOAD_STORE_PASSWORD is not configured, FREED_ANDROID_UPLOAD_KEY_ALIAS is not configured, FREED_ANDROID_UPLOAD_KEY_PASSWORD is not configured
  Next: Configure FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD with secure production upload signing values.

### production-ai-backend

- Status: fail
- Category: production-env
- Next: Configure remote CLARA/challenge endpoints and server AI provider credentials, then prove AI safety plus deployed backend smoke evidence.
- Target evidence file: `docs/validation/evidence/ai-backend-smoke.json`

Required env names:
- `EXPO_PUBLIC_AI_COACH_MODE=remote`
- `EXPO_PUBLIC_AI_COACH_ENDPOINT`
- `EXPO_PUBLIC_AI_CHALLENGE_MODE=remote`
- `EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT`
- `OPENAI_API_KEY + OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY + GEMINI_MODEL`

Required report commands:
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/ai-backend-smoke-report.json`

Failed preflight checks:
- `ai-coach-mode`: EXPO_PUBLIC_AI_COACH_MODE is not remote.
  Next: Set EXPO_PUBLIC_AI_COACH_MODE=remote for deployed backend verification.
- `ai-coach-endpoint`: CLARA endpoint is not configured
  Next: Configure EXPO_PUBLIC_AI_COACH_ENDPOINT as an HTTPS non-local deployed API route, and keep optional EXPO_PUBLIC_AI_COACH_TIMEOUT_MS within documented bounds.
- `ai-challenge-mode`: EXPO_PUBLIC_AI_CHALLENGE_MODE is not remote.
  Next: Set EXPO_PUBLIC_AI_CHALLENGE_MODE=remote for deployed backend verification.
- `ai-challenge-endpoint`: challenge endpoint is not configured
  Next: Configure EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT as an HTTPS non-local deployed API route, and keep optional EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS within documented bounds.
- `server-ai-key`: OPENAI_API_KEY and OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY and GEMINI_MODEL, are missing or malformed.
  Next: Configure a real OpenAI or Google/Gemini API key plus concrete model only in the server environment, never as EXPO_PUBLIC_*, and keep optional server AI provider timeout and response-size values within documented bounds.

## Evidence After Env

### ios-physical-device-validation

- Status: external
- Category: physical-evidence
- Next: Produce a sanitized signed iOS Release archive/IPA report, then capture entitlement-approved iOS hardware evidence for Screen Time, Safari, DNS settings boundaries, app shields, and challenge verification.
- Target evidence file: `docs/validation/evidence/ios-physical-device.json`
- Capture helper: `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/ios-physical-device-capture`

Required env names:
- None

Required report commands:
- `npm run build:ios-archive:release -- --report docs/validation/artifacts/release-env-current/ios-release-archive-report.json`

### android-real-browser-validation

- Status: external
- Category: physical-evidence
- Next: Capture physical Android browser, DNS Guard, Accessibility, app shield, short-form, unlock, and Play policy evidence.
- Target evidence file: `docs/validation/evidence/android-real-browser.json`
- Capture helper: `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/android-real-browser-capture`

Required env names:
- None

Required report commands:
- None

### normal-browsing-corpus-validation

- Status: external
- Category: physical-evidence
- Next: Run the physical-browser normal browsing corpus and promote only after every allow/block matrix row passes.
- Target evidence file: `docs/validation/evidence/normal-browsing-corpus.json`
- Capture helper: `npm run evidence:normal-browsing-corpus -- --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/normal-browsing-corpus-capture`

Required env names:
- None

Required report commands:
- None

### performance-validation

- Status: external
- Category: physical-evidence
- Next: Capture battery, RAM, thermal, background CPU, DNS latency, network speed, and no-full-VPN/no-screenshot proof.
- Target evidence file: `docs/validation/evidence/performance-profile.json`
- Capture helper: `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/performance-profile-capture`

Required env names:
- None

Required report commands:
- None

### store-ad-sandbox-validation

- Status: external
- Category: deployed-evidence
- Next: Capture Core 3-only console product setup, paywall proof, App Store/Play Billing sandbox purchases, restore, rewarded ad completion, and premium no-ad behavior without raw receipts/tokens.
- Target evidence file: `docs/validation/evidence/store-ad-sandbox.json`
- Capture helper: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/store-ad-sandbox-capture`

Required env names:
- `store/ad production env from production-monetization`

Required report commands:
- `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/purchase-verification-smoke-report.json`

### ai-backend-smoke-validation

- Status: external
- Category: deployed-evidence
- Next: Capture AI safety eval plus deployed CLARA/challenge smoke reports without raw prompts, private notes, or provider output.
- Target evidence file: `docs/validation/evidence/ai-backend-smoke.json`
- Capture helper: `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/ai-backend-smoke-capture`

Required env names:
- `remote AI production env from production-ai-backend`

Required report commands:
- `npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/ai-backend-smoke-report.json`

## Rerun Commands

After configuring the real production env file outside the repo, rerun these commands and keep only sanitized report paths:

- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/release-env-preflight-report.json`
- `npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/backend-readiness-smoke-report.json`
- `npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/supabase-schema-smoke-report.json`
- `npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/analytics-ingestion-smoke-report.json`
- `npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/remote-notification-smoke-report.json`
- `npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/adult-domain-feed-smoke-report.json`
- `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/purchase-verification-smoke-report.json`
- `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/android-apk-build-report.json`
- `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/android-aab-build-report.json`
- `npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/release-env-current/ai-backend-smoke-report.json`
- `npm run build:ios-archive:release -- --report docs/validation/artifacts/release-env-current/ios-release-archive-report.json`

Then capture the pending physical/deployed evidence packets:
- `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/ios-physical-device-capture`
- `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/android-real-browser-capture`
- `npm run evidence:normal-browsing-corpus -- --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/normal-browsing-corpus-capture`
- `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/performance-profile-capture`
- `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/store-ad-sandbox-capture`
- `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id release-env-current --output-dir docs/validation/artifacts/release-env-current/ai-backend-smoke-capture`

Keep production submission disabled until `npm run audit:release:strict` and the launch dashboard both pass.

