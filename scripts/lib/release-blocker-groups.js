function runIdForArtifactRoot(artifactRoot, requestedRunId = "<run-id>") {
  if (requestedRunId && requestedRunId !== "<run-id>") return requestedRunId;

  const normalized = String(artifactRoot ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  const match = normalized.match(/(?:^|\/)docs\/validation\/artifacts\/([^/]+)$/);
  if (match && match[1] && !match[1].includes("<") && !match[1].includes(">")) {
    return match[1];
  }

  return requestedRunId || "<run-id>";
}

function reportArtifactCommands(artifactRoot) {
  return {
    releaseEnvPreflight: `npm run preflight:release-env -- --env-file <production-env-file> --report ${artifactRoot}/release-env-preflight-report.json`,
    storeLegalHosted: `npm run audit:store-legal-hosted -- --report ${artifactRoot}/store-legal-hosted-url-audit.json`,
    androidApkBuild: `npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report ${artifactRoot}/android-apk-build-report.json`,
    androidAabBuild: `npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report ${artifactRoot}/android-aab-build-report.json`,
    iosArchiveBuild: `npm run build:ios-archive:release -- --report ${artifactRoot}/ios-release-archive-report.json`,
    backendReadiness: `npm run smoke:backend-readiness -- --env-file <production-env-file> --report ${artifactRoot}/backend-readiness-smoke-report.json`,
    supabaseSchema: `npm run smoke:supabase-schema -- --env-file <production-env-file> --report ${artifactRoot}/supabase-schema-smoke-report.json`,
    adultDomainFeed: `npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report ${artifactRoot}/adult-domain-feed-smoke-report.json`,
    analyticsIngestion: `npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report ${artifactRoot}/analytics-ingestion-smoke-report.json`,
    remoteNotifications: `npm run smoke:remote-notifications -- --env-file <production-env-file> --report ${artifactRoot}/remote-notification-smoke-report.json`,
    purchaseVerification: `npm run smoke:purchase-verification -- --env-file <production-env-file> --report ${artifactRoot}/purchase-verification-smoke-report.json`,
    aiBackend: `npm run smoke:ai-backend -- --env-file <production-env-file> --report ${artifactRoot}/ai-backend-smoke-report.json`,
    strictReleaseReadiness: `npm run audit:release:strict -- --report ${artifactRoot}/release-readiness-report.json`
  };
}

function reportArtifactCommandList(artifactRoot) {
  const reports = reportArtifactCommands(artifactRoot);
  return [
    reports.releaseEnvPreflight,
    reports.storeLegalHosted,
    reports.androidApkBuild,
    reports.androidAabBuild,
    reports.iosArchiveBuild,
    reports.backendReadiness,
    reports.supabaseSchema,
    reports.adultDomainFeed,
    reports.analyticsIngestion,
    reports.remoteNotifications,
    reports.purchaseVerification,
    reports.aiBackend,
    reports.strictReleaseReadiness
  ];
}

function captureHelperCommands(artifactRoot, runId) {
  return {
    iosDeviceDiscovery:
      `npm run evidence:ios-devices -- --run-id ${runId} --output-dir ${artifactRoot}/ios-device-discovery`,
    iosPhysicalDevice:
      `npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id ${runId} --output-dir ${artifactRoot}/ios-physical-device-capture`,
    androidDeviceDiscovery:
      `npm run evidence:android-devices -- --run-id ${runId} --output-dir ${artifactRoot}/android-device-discovery`,
    androidInstallQa:
      `npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id ${runId} --output-dir ${artifactRoot}/android-install-qa --require-upload-signing`,
    androidRealBrowser:
      `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id ${runId} --output-dir ${artifactRoot}/android-real-browser-capture`,
    normalBrowsingCorpus:
      `npm run evidence:normal-browsing-corpus -- --run-id ${runId} --output-dir ${artifactRoot}/normal-browsing-corpus-capture`,
    performanceProfile:
      `npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id ${runId} --output-dir ${artifactRoot}/performance-profile-capture`,
    storeAdSandbox:
      `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id ${runId} --output-dir ${artifactRoot}/store-ad-sandbox-capture`,
    aiBackendSmoke:
      `npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id ${runId} --output-dir ${artifactRoot}/ai-backend-smoke-capture`
  };
}

function captureHelperCommandMap(artifactRoot, runId = "<run-id>") {
  const resolvedRunId = runIdForArtifactRoot(artifactRoot, runId);
  const helpers = captureHelperCommands(artifactRoot, resolvedRunId);
  return {
    "ios-physical-device-validation": helpers.iosPhysicalDevice,
    "android-real-browser-validation": helpers.androidRealBrowser,
    "normal-browsing-corpus-validation": helpers.normalBrowsingCorpus,
    "performance-validation": helpers.performanceProfile,
    "store-ad-sandbox-validation": helpers.storeAdSandbox,
    "ai-backend-smoke-validation": helpers.aiBackendSmoke
  };
}

function handoffDocumentPaths() {
  return ["docs/validation/README.md", "docs/validation/evidence-runbook.md"];
}

function handoffDocumentCommandList(artifactRoot = "docs/validation/artifacts/<run-id>", runId = "<run-id>") {
  const resolvedRunId = runIdForArtifactRoot(artifactRoot, runId);
  const helpers = captureHelperCommands(artifactRoot, resolvedRunId);
  return [
    helpers.iosDeviceDiscovery,
    helpers.iosPhysicalDevice,
    helpers.androidDeviceDiscovery,
    helpers.androidInstallQa,
    helpers.androidRealBrowser,
    helpers.normalBrowsingCorpus,
    helpers.performanceProfile,
    helpers.storeAdSandbox,
    helpers.aiBackendSmoke,
    ...reportArtifactCommandList(artifactRoot),
    `npm run evidence:validation:draft -- ${artifactRoot}/draft-evidence`,
    `npm run evidence:promote -- --from ${artifactRoot}/draft-evidence`,
    "npm run evidence:validation",
    `npm run verify:release -- --env-file <production-env-file> --artifact-dir ${artifactRoot}`
  ];
}

function productionEnvChecklist() {
  return {
    clientKeys: [
      "EXPO_PUBLIC_MONETIZATION_MODE=native",
      "EXPO_PUBLIC_STORE_PROVIDER=native-iap",
      "EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID",
      "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
      "EXPO_PUBLIC_IAP_PRODUCT_YEARLY",
      "EXPO_PUBLIC_IAP_PRODUCT_MONTHLY",
      "EXPO_PUBLIC_IAP_PRODUCT_LIFETIME",
      "EXPO_PUBLIC_ADMOB_APP_ID_IOS",
      "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
      "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS",
      "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID",
      "EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false",
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    ],
    publicBackendKeys: [
      "EXPO_PUBLIC_AI_COACH_MODE=remote",
      "EXPO_PUBLIC_AI_COACH_ENDPOINT",
      "EXPO_PUBLIC_AI_CHALLENGE_MODE=remote",
      "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
      "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
      "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
      "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT",
      "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT when hosted backup sync is enabled",
      "EXPO_PUBLIC_RETENTION_ENDPOINT when remote retention is enabled"
    ],
    serverKeys: [
      "APP_STORE_BUNDLE_ID",
      "APP_STORE_SERVER_API_ENV=production",
      "APP_STORE_ISSUER_ID + APP_STORE_KEY_ID + APP_STORE_PRIVATE_KEY(_BASE64), or APP_STORE_SERVER_API_JWT",
      "GOOGLE_PLAY_PACKAGE_NAME",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(_BASE64), or GOOGLE_PLAY_ACCESS_TOKEN",
      "OPENAI_API_KEY and OPENAI_MODEL",
      "GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENAI_API_KEY",
      "GEMINI_MODEL",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "BACKEND_MAINTENANCE_SECRET or CRON_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries",
      "REMOTE_NOTIFICATION_DISPATCH_SECRET",
      "FCM credentials with FIREBASE_PROJECT_ID or Firebase service-account project_id",
      "APNs production signing credentials: APNS_KEY_ID + APNS_TEAM_ID + APNS_PRIVATE_KEY(_BASE64)",
      "iOS App Store archive signing: FREED_IOS_DEVELOPMENT_TEAM/APPLE_TEAM_ID plus Apple Distribution credentials and provisioning profiles outside the repo"
    ],
    privateEvidenceWarning:
      "Do not put App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, push credentials, maintenance secrets, access tokens, purchase receipts, raw purchase tokens, or AI provider keys in any evidence JSON."
  };
}

function productionBlockerGroups(artifactRoot = "docs/validation/artifacts/<run-id>", runId = "<run-id>") {
  const resolvedRunId = runIdForArtifactRoot(artifactRoot, runId);
  const reports = reportArtifactCommands(artifactRoot);
  const helpers = captureHelperCommands(artifactRoot, resolvedRunId);
  return [
    {
      id: "production-backend-infrastructure",
      category: "production-env",
      requiredEnv: [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY",
        "BACKEND_MAINTENANCE_SECRET or CRON_SECRET",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.backendReadiness, reports.supabaseSchema],
      preflightCheckIds: [
        "server-secret-public-leakage",
        "supabase-backend-credentials",
        "redis-backend-infrastructure",
        "backend-readiness-endpoint",
        "optional-recovery-backup-sync-endpoint",
        "optional-supabase-auth-client",
        "optional-retention-endpoint"
      ],
      evidenceFile: null,
      next: "Configure Supabase, Redis/Upstash, public anon lockout proof, and maintenance secrets, then rerun release preflight plus deployed backend/schema smoke reports."
    },
    {
      id: "production-analytics-ingestion",
      category: "production-env",
      requiredEnv: ["EXPO_PUBLIC_ANALYTICS_ENDPOINT"],
      requiredReports: [reports.releaseEnvPreflight, reports.analyticsIngestion],
      preflightCheckIds: ["server-secret-public-leakage", "analytics-ingestion-endpoint"],
      evidenceFile: null,
      next: "Configure the deployed aggregate-only /api/analytics endpoint and prove the sanitized analytics ingestion smoke report."
    },
    {
      id: "production-notification-backend",
      category: "production-env",
      requiredEnv: [
        "REMOTE_NOTIFICATION_DISPATCH_SECRET",
        "FCM_SERVER_KEY, FCM_ACCESS_TOKEN + FIREBASE_PROJECT_ID, or FIREBASE_SERVICE_ACCOUNT_JSON(_BASE64)",
        "APNS_KEY_ID + APNS_TEAM_ID + APNS_BUNDLE_ID + APNS_ENV=production + APNS_PRIVATE_KEY(_BASE64)"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.remoteNotifications],
      preflightCheckIds: ["server-secret-public-leakage", "remote-notification-provider-credentials"],
      evidenceFile: null,
      next: "Configure server-side APNs/FCM dispatch credentials and prove the non-sending notification smoke report."
    },
    {
      id: "production-adult-domain-feed",
      category: "production-env",
      requiredEnv: [
        "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
        "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true",
        "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.adultDomainFeed],
      preflightCheckIds: ["adult-domain-feed-endpoint", "adult-domain-feed-sources"],
      evidenceFile: null,
      next: "Configure reviewed adult-domain feed sources and prove the deployed feed freshness/cache/source smoke report."
    },
    {
      id: "production-monetization",
      category: "production-env",
      requiredEnv: [
        "EXPO_PUBLIC_MONETIZATION_MODE=native",
        "EXPO_PUBLIC_STORE_PROVIDER=native-iap",
        "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
        "EXPO_PUBLIC_IAP_PRODUCT_*",
        "EXPO_PUBLIC_ADMOB_APP_ID_IOS",
        "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
        "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS",
        "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID",
        "APP_STORE_BUNDLE_ID",
        "APP_STORE_SERVER_API_ENV=production",
        "App Store Server API credentials",
        "GOOGLE_PLAY_PACKAGE_NAME",
        "Google Play verification credentials"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.purchaseVerification],
      preflightCheckIds: [
        "server-secret-public-leakage",
        "release-monetization-mode",
        "store-provider",
        "iap-product-ids",
        "purchase-verify-endpoint",
        "app-store-environment",
        "app-store-verification-credentials",
        "google-play-verification-credentials",
        "revenuecat-fallback-keys",
        "admob-app-ids",
        "admob-rewarded-units",
        "admob-test-ads-disabled",
        "admob-request-country"
      ],
      evidenceFile: "docs/validation/evidence/store-ad-sandbox.json",
      next: "Configure native IAP, purchase verification, and AdMob env values, then prove purchase smoke plus store/ad sandbox evidence."
    },
    {
      id: "production-android-signing",
      category: "production-env",
      requiredEnv: [
        "FREED_ANDROID_UPLOAD_STORE_FILE",
        "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
        "FREED_ANDROID_UPLOAD_KEY_ALIAS",
        "FREED_ANDROID_UPLOAD_KEY_PASSWORD"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.androidApkBuild, reports.androidAabBuild],
      preflightCheckIds: ["android-release-signing"],
      evidenceFile: null,
      next: "Run npm run setup:android-upload-keystore -- --generate-passwords or configure existing secure Android upload signing credentials, point the store-file env value at the secure CI/local keystore, then produce sanitized upload-signed APK and AAB build reports before Play upload."
    },
    {
      id: "production-ai-backend",
      category: "production-env",
      requiredEnv: [
        "EXPO_PUBLIC_AI_COACH_MODE=remote",
        "EXPO_PUBLIC_AI_COACH_ENDPOINT",
        "EXPO_PUBLIC_AI_CHALLENGE_MODE=remote",
        "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
        "OPENAI_API_KEY + OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY + GEMINI_MODEL"
      ],
      requiredReports: [reports.releaseEnvPreflight, reports.aiBackend],
      preflightCheckIds: [
        "server-secret-public-leakage",
        "ai-coach-mode",
        "ai-coach-endpoint",
        "ai-challenge-mode",
        "ai-challenge-endpoint",
        "server-ai-key",
        "optional-retention-endpoint"
      ],
      evidenceFile: "docs/validation/evidence/ai-backend-smoke.json",
      next: "Configure remote CLARA/challenge endpoints and server AI provider credentials, then prove AI safety plus deployed backend smoke evidence."
    },
    {
      id: "ios-physical-device-validation",
      category: "physical-evidence",
      requiredEnv: [],
      requiredReports: [reports.iosArchiveBuild],
      captureHelperCommand: helpers.iosPhysicalDevice,
      evidenceFile: "docs/validation/evidence/ios-physical-device.json",
      next: "Produce a sanitized signed iOS Release archive/IPA report, then capture entitlement-approved iOS hardware evidence for Screen Time, Safari, DNS settings boundaries, app shields, and challenge verification."
    },
    {
      id: "android-real-browser-validation",
      category: "physical-evidence",
      requiredEnv: [],
      requiredReports: [],
      captureHelperCommand: helpers.androidRealBrowser,
      evidenceFile: "docs/validation/evidence/android-real-browser.json",
      next: "Capture physical Android browser, DNS Guard, Accessibility, app shield, short-form, unlock, and Play policy evidence."
    },
    {
      id: "normal-browsing-corpus-validation",
      category: "physical-evidence",
      requiredEnv: [],
      requiredReports: [],
      captureHelperCommand: helpers.normalBrowsingCorpus,
      evidenceFile: "docs/validation/evidence/normal-browsing-corpus.json",
      next: "Run the physical-browser normal browsing corpus and promote only after every allow/block matrix row passes."
    },
    {
      id: "performance-validation",
      category: "physical-evidence",
      requiredEnv: [],
      requiredReports: [],
      captureHelperCommand: helpers.performanceProfile,
      evidenceFile: "docs/validation/evidence/performance-profile.json",
      next: "Capture battery, RAM, thermal, background CPU, DNS latency, network speed, and no-full-VPN/no-screenshot proof."
    },
    {
      id: "store-ad-sandbox-validation",
      category: "deployed-evidence",
      requiredEnv: ["store/ad production env from production-monetization"],
      requiredReports: [reports.purchaseVerification],
      captureHelperCommand: helpers.storeAdSandbox,
      evidenceFile: "docs/validation/evidence/store-ad-sandbox.json",
      next: "Capture Core 3-only console product setup, paywall proof, App Store/Play Billing sandbox purchases, restore, rewarded ad completion, and premium no-ad behavior without raw receipts/tokens."
    },
    {
      id: "ai-backend-smoke-validation",
      category: "deployed-evidence",
      requiredEnv: ["remote AI production env from production-ai-backend"],
      requiredReports: [reports.aiBackend],
      captureHelperCommand: helpers.aiBackendSmoke,
      evidenceFile: "docs/validation/evidence/ai-backend-smoke.json",
      next: "Capture AI safety eval plus deployed CLARA/challenge smoke reports without raw prompts, private notes, or provider output."
    }
  ];
}

module.exports = {
  runIdForArtifactRoot,
  reportArtifactCommands,
  reportArtifactCommandList,
  captureHelperCommands,
  captureHelperCommandMap,
  handoffDocumentPaths,
  handoffDocumentCommandList,
  productionEnvChecklist,
  productionBlockerGroups
};
