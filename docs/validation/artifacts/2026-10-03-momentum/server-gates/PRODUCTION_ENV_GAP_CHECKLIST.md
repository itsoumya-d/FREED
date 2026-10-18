# FREED Production Env Gap Checklist

Generated: 2026-10-03T12:58:09.662Z
Source preflight report: `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight.json`
Source preflight sha256: `sha256-fe81950880364a45d5f3f02bbafc2f9af47d25a11996a5a8d69e4c12c14651a5`
Source env snapshot: `process.env`
Checklist result: pending

This checklist is a configuration handoff only. It does not prove deployed services, physical-device behavior, sandbox purchases, or store approval.

Do not paste real secrets, purchase receipts, raw purchase tokens, App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, APNs/FCM credentials, maintenance secrets, or AI provider keys into docs/validation artifacts.

## Current Snapshot

- Preflight result: fail
- Preflight checks: 8 pass, 7 fail
- Production env groups still failing: 7
- External validation groups still pending: 6
- Production env groups already passing: none
- Missing-key env skeleton: `docs/validation/artifacts/2026-10-03-momentum/server-gates/PRODUCTION_ENV_MISSING_KEYS.env`
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
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

### production-analytics-ingestion

- Status: fail
- Category: production-env
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

### production-notification-backend

- Status: fail
- Category: production-env
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

### production-adult-domain-feed

- Status: fail
- Category: production-env
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

### production-monetization

- Status: fail
- Category: production-env
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.
- Target evidence file: `docs/validation/evidence/store-ad-sandbox.json`

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `release-monetization-mode`: EXPO_PUBLIC_MONETIZATION_MODE is not native.
  Next: Set EXPO_PUBLIC_MONETIZATION_MODE=native for signed release verification.
- `android-release-signing`: FREED_ANDROID_UPLOAD_STORE_FILE is not configured, FREED_ANDROID_UPLOAD_STORE_PASSWORD is not configured, FREED_ANDROID_UPLOAD_KEY_ALIAS is not configured, FREED_ANDROID_UPLOAD_KEY_PASSWORD is not configured
  Next: Configure FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD with secure production upload signing values.
- `admob-app-ids`: iOS and Android AdMob app IDs are checked for production format and non-sample publisher IDs.
  Next: Configure EXPO_PUBLIC_ADMOB_APP_ID_IOS and EXPO_PUBLIC_ADMOB_APP_ID_ANDROID with real ca-app-pub IDs.
- `admob-rewarded-units`: iOS and Android rewarded reset units are checked for production format and non-sample publisher IDs.
  Next: Configure real rewarded unit IDs for both platforms.
- `admob-test-ads-disabled`: EXPO_PUBLIC_ADMOB_USE_TEST_ADS is not explicitly false.
  Next: Set EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false for production release verification.
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

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
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`
- `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/android-apk-build-report.json`
- `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/android-aab-build-report.json`

Failed preflight checks:
- `android-release-signing`: FREED_ANDROID_UPLOAD_STORE_FILE is not configured, FREED_ANDROID_UPLOAD_STORE_PASSWORD is not configured, FREED_ANDROID_UPLOAD_KEY_ALIAS is not configured, FREED_ANDROID_UPLOAD_KEY_PASSWORD is not configured
  Next: Configure FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD with secure production upload signing values.

### production-ai-backend

- Status: fail
- Category: production-env
- Next: Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment.
- Target evidence file: `docs/validation/evidence/ai-backend-smoke.json`

Required env names:
- `EXPO_PUBLIC_BACKEND_PROVIDER=firebase`
- `EXPO_PUBLIC_FIREBASE_ENV=production`
- `APPLE_STORE_ISSUER_ID`
- `APPLE_STORE_KEY_ID`
- `APPLE_STORE_PRIVATE_KEY`
- `APPLE_STORE_APP_ID`
- `APPLE_STORE_ROOT_CAS_BASE64`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

Failed preflight checks:
- `firebase-server-secret-configuration`: APPLE_STORE_ISSUER_ID is not configured in the server release environment; APPLE_STORE_KEY_ID is not configured in the server release environment; APPLE_STORE_PRIVATE_KEY is not configured in the server release environment; APPLE_STORE_APP_ID is not configured in the server release environment; APPLE_STORE_ROOT_CAS_BASE64 is not configured in the server release environment; GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured in the server release environment; OPENAI_API_KEY is not configured in the server release environment
  Next: Configure server-only APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY; never expose their values in reports or EXPO_PUBLIC variables.
- `firebase-production-runtime-evidence`: Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)
  Next: Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.

## Evidence After Env

### ios-physical-device-validation

- Status: external
- Category: physical-evidence
- Next: Produce a sanitized signed iOS Release archive/IPA report, then capture entitlement-approved iOS hardware evidence for Screen Time, Safari Content Blocker, Safari Focus Shield, app shields, and challenge verification.
- Target evidence file: `docs/validation/evidence/ios-physical-device.json`
- Capture helper: `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/ios-physical-device-capture`

Required env names:
- None

Required report commands:
- `npm run build:ios-archive:release -- --report docs/validation/artifacts/2026-10-03-momentum/ios-release-archive-report.json`

### android-real-browser-validation

- Status: external
- Category: physical-evidence
- Next: Capture physical Android browser, DNS Guard, Accessibility, app shield, short-form, unlock, and Play policy evidence.
- Target evidence file: `docs/validation/evidence/android-real-browser.json`
- Capture helper: `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/android-real-browser-capture`

Required env names:
- None

Required report commands:
- None

### normal-browsing-corpus-validation

- Status: external
- Category: physical-evidence
- Next: Run the physical-browser normal browsing corpus and promote only after every allow/block matrix row passes.
- Target evidence file: `docs/validation/evidence/normal-browsing-corpus.json`
- Capture helper: `npm run evidence:normal-browsing-corpus -- --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/normal-browsing-corpus-capture`

Required env names:
- None

Required report commands:
- None

### performance-validation

- Status: external
- Category: physical-evidence
- Next: Capture battery, RAM, thermal, background CPU, DNS latency, network speed, and no-full-VPN/no-screenshot proof.
- Target evidence file: `docs/validation/evidence/performance-profile.json`
- Capture helper: `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/performance-profile-capture`

Required env names:
- None

Required report commands:
- None

### store-ad-sandbox-validation

- Status: external
- Category: deployed-evidence
- Next: Capture monthly/yearly-only console product setup, paywall proof, App Store/Play Billing sandbox purchases, restore, rewarded ad completion, and premium no-ad behavior without raw receipts/tokens.
- Target evidence file: `docs/validation/evidence/store-ad-sandbox.json`
- Capture helper: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/store-ad-sandbox-capture`

Required env names:
- `store/ad production env from production-monetization`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

### ai-backend-smoke-validation

- Status: external
- Category: deployed-evidence
- Next: Capture AI safety eval plus production-native Firebase CLARA/challenge capture reports without raw prompts, private notes, or provider output.
- Target evidence file: `docs/validation/evidence/ai-backend-smoke.json`
- Capture helper: `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/ai-backend-smoke-capture`

Required env names:
- `remote AI production env from production-ai-backend`

Required report commands:
- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`

## Rerun Commands

After configuring the real production env file outside the repo, rerun these commands and keep only sanitized report paths:

- `docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`
- `npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/release-env-preflight-report.json`
- `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/android-apk-build-report.json`
- `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-10-03-momentum/android-aab-build-report.json`
- `npm run build:ios-archive:release -- --report docs/validation/artifacts/2026-10-03-momentum/ios-release-archive-report.json`

Then capture the pending physical/deployed evidence packets:
- `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/ios-physical-device-capture`
- `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/android-real-browser-capture`
- `npm run evidence:normal-browsing-corpus -- --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/normal-browsing-corpus-capture`
- `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/performance-profile-capture`
- `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/store-ad-sandbox-capture`
- `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-10-03-momentum --output-dir docs/validation/artifacts/2026-10-03-momentum/ai-backend-smoke-capture`

Keep production submission disabled until `npm run audit:release:strict` and the launch dashboard both pass.

