const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function has(path) {
  return existsSync(join(root, path));
}

function check(id, condition, evidence) {
  return { id, status: condition ? "pass" : "fail", evidence };
}

function manifestPermissionTags(manifest, permission) {
  const tagPattern = /<uses-permission\b[^>]*>/g;
  return Array.from(manifest.matchAll(tagPattern), ([tag]) =>
    tag.includes(`android:name="${permission}"`) ? tag : null
  ).filter(Boolean);
}

function manifestDoesNotShipPermission(manifest, permission) {
  const tags = manifestPermissionTags(manifest, permission);
  return tags.length === 0 || tags.every((tag) => tag.includes('tools:node="remove"'));
}

function manifestOmitsPermission(manifest, permission) {
  return manifestPermissionTags(manifest, permission).length === 0;
}

const AD_ID_PERMISSIONS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
  "android.permission.ACCESS_ADSERVICES_TOPICS"
];
const UNNEEDED_CHALLENGE_PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.ACCESS_MEDIA_LOCATION",
  "android.permission.MANAGE_EXTERNAL_STORAGE"
];
const GENERATED_RELEASE_MANIFEST_PATHS = [
  "android/app/build/intermediates/merged_manifest/release/expoReleaseOverrideMaxSdkConflicts/AndroidManifest.xml",
  "android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml",
  "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml",
  "android/app/build/intermediates/packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml"
];

const privacyManifest = read("ios/FREED/PrivacyInfo.xcprivacy");
const appConfig = read("app.json");
const parsedAppConfig = JSON.parse(appConfig);
const requestedAndroidPermissions = parsedAppConfig.expo?.android?.permissions ?? [];
const blockedAndroidPermissions = parsedAppConfig.expo?.android?.blockedPermissions ?? [];
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const generatedReleaseManifests = GENERATED_RELEASE_MANIFEST_PATHS.filter(has).map((path) => ({
  path,
  contents: read(path)
}));
const androidBackupRules = read("android/app/src/main/res/xml/freed_data_extraction_rules.xml");
const iosInfoPlist = read("ios/FREED/Info.plist");
const iosDataProtectionEntitlements = [
  "ios/FREED/FREED.entitlements",
  "ios/FREEDDeviceActivityMonitor/FREEDDeviceActivityMonitor.entitlements",
  "ios/FREEDShieldAction/FREEDShieldAction.entitlements",
  "ios/FREEDShieldConfiguration/FREEDShieldConfiguration.entitlements",
  "ios/FREEDSafariContentBlocker/FREEDSafariContentBlocker.entitlements"
].map((path) => ({ path, contents: read(path) }));
const envExample = read(".env.example");
const envProductionExample = read(".env.production.example");
const privacyDataMap = read("docs/privacy-data-map.md");
const accountability = read("src/lib/accountability.ts");
const communitySafety = read("src/lib/community-safety.ts");
const recoveryAnalytics = read("src/lib/recovery-analytics.ts");
const recoveryAnalyticsIngestion = read("src/lib/recovery-analytics-ingestion.ts");
const recoverySignalPrivacy = read("src/lib/recovery-signal-privacy.ts");
const urgeForecast = read("src/lib/urge-risk-forecast.ts");
const recoveryState = read("src/lib/recovery-state.ts");
const recoveryBackup = read("src/lib/recovery-backup.ts");
const recoveryBackupClientSync = read("src/lib/recovery-backup-client-sync.ts");
const recoveryBackupSync = read("src/lib/recovery-backup-sync.ts");
const recoveryBackupSyncRoute = read("app/api/recovery-backup/sync+api.ts");
const userFacingError = read("src/lib/user-facing-error.ts");
const endpointSafety = read("src/lib/endpoint-safety.ts");
const backendInfrastructure = read("src/lib/backend-infrastructure.ts");
const backendRetentionCleanup = read("src/lib/backend-retention-cleanup.ts");
const backendCleanupRoute = read("app/api/backend/cleanup+api.ts");
const blockingEngine = read("src/lib/blocking-engine.ts");
const aiCoach = read("src/lib/ai-coach.ts");
const challengeContext = read("src/lib/challenge-context.ts");
const challengeGenerator = read("src/lib/challenge-generator.ts");
const retentionOrchestrator = read("src/lib/retention-orchestrator.ts");
const claraRoute = read("app/api/clara+api.ts");
const challengeRoute = read("app/api/challenges+api.ts");
const retentionRoute = read("app/api/retention+api.ts");
const analyticsRoute = read("app/api/analytics+api.ts");
const purchaseRoute = read("app/api/purchases/verify+api.ts");
const purchaseVerification = read("src/lib/purchase-verification.ts");
const reminders = read("src/lib/recovery-reminders.ts");
const remoteNotifications = read("src/lib/remote-notifications.ts");
const remoteNotificationRoute = read("app/api/notifications/send+api.ts");
const appSurface = read("src/features/freed-app.tsx");
const protectionReadiness = read("src/lib/protection-readiness.ts");
const doomscrollApps = read("src/lib/doomscroll-apps.ts");
const nativeIntervention = read("src/lib/native-intervention.ts");
const challengeVerification = read("src/lib/challenge-verification.ts");
const nativeProtectionIndex = read("modules/freed-protection/src/index.ts");
const iosProtectionModule = read("modules/freed-protection/ios/FreedProtectionModule.swift");
const androidProtectionModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
const androidClassifier = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedUrlClassifier.kt");
const androidAccessibilityService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt");
const protectionPermissions = read("src/lib/protection-permissions.ts");
const androidPolicyPack = read("docs/store-policy/android-accessibility-and-fgs-disclosure.md");
const iosPolicyPack = read("docs/store-policy/ios-screen-time-safari-dns-review.md");
const playStoreDataSafety = read("store/play-store/data-safety.md");
const appStorePrivacy = read("store/app-store/app-privacy.md");
const publicPrivacyRoute = has("app/privacy.tsx") ? read("app/privacy.tsx") : "";
const publicSupportRoute = has("app/support.tsx") ? read("app/support.tsx") : "";
const publicDeletionRoute = has("app/account-deletion.tsx") ? read("app/account-deletion.tsx") : "";
const legalPages = has("src/features/legal-pages.tsx") ? read("src/features/legal-pages.tsx") : "";
const challengeRouteForbiddenBrowsingFields = [
  "recentRiskHosts",
  "recentRiskHost",
  "riskHosts",
  "blockedUrl",
  "blockedHost",
  "attemptUrl",
  "attemptHost",
  "browsingHistory",
  "rawUrl",
  "rawHost"
];
const retentionForbiddenSensitiveFields = [
  '"recentRiskHosts"',
  '"recentRiskHost"',
  '"blockedUrl"',
  '"blockedHost"',
  '"attemptUrl"',
  '"attemptHost"',
  '"browsingHistory"',
  '"rawUrl"',
  '"rawHost"',
  '"reflection"',
  '"privateNotes"',
  '"note"',
  '"contact"',
  '"messageTemplate"',
  '"transcript"'
];

const checks = [
  check(
    "ios-no-tracking-declaration",
    privacyManifest.includes("<key>NSPrivacyTracking</key>") &&
      privacyManifest.includes("<false/>") &&
      !appConfig.includes("NSUserTrackingUsageDescription"),
    "iOS manifest declares no tracking and app config does not request ATT copy."
  ),
  check(
    "ios-no-collected-data-in-current-build",
    privacyManifest.includes("<key>NSPrivacyCollectedDataTypes</key>") &&
      privacyManifest.includes("<array/>"),
    "Current iOS privacy manifest declares no collected data types for the local-first build."
  ),
  check(
    "ios-complete-file-protection",
    iosDataProtectionEntitlements.every(
      ({ contents }) =>
        contents.includes("<key>com.apple.developer.default-data-protection</key>") &&
        contents.includes("<string>NSFileProtectionComplete</string>")
    ),
    "iOS app and extension entitlements default local recovery and app-group files to Complete Data Protection."
  ),
  check(
    "android-no-ad-id-in-current-build",
    AD_ID_PERMISSIONS.every((permission) => manifestDoesNotShipPermission(androidManifest, permission)),
    "Current Android app manifest removes advertising ID and AdServices permissions from merged builds."
  ),
  check(
    "android-no-unneeded-audio-or-media-permissions",
    UNNEEDED_CHALLENGE_PERMISSIONS.every(
      (permission) =>
        !requestedAndroidPermissions.includes(permission) &&
        blockedAndroidPermissions.includes(permission) &&
        manifestDoesNotShipPermission(androidManifest, permission)
    ),
    "Android requests camera/activity/location/notification only; microphone and media-library/storage permissions are blocked or removed because challenge photos use fresh camera capture."
  ),
  check(
    "android-release-merged-manifest-denylist",
    generatedReleaseManifests.length === 0 ||
      generatedReleaseManifests.every(({ contents }) =>
        [...AD_ID_PERMISSIONS, ...UNNEEDED_CHALLENGE_PERMISSIONS, "android.permission.SYSTEM_ALERT_WINDOW"].every(
          (permission) => manifestOmitsPermission(contents, permission)
        )
      ),
    "Generated release manifests, when present after Gradle processing, omit Ad ID, overlay, microphone, media-library, and storage permissions."
  ),
  check(
    "android-implicit-os-backup-disabled",
    parsedAppConfig.expo?.android?.allowBackup === false &&
      androidManifest.includes('android:allowBackup="false"') &&
      androidManifest.includes('android:fullBackupContent="false"') &&
      androidManifest.includes('android:dataExtractionRules="@xml/freed_data_extraction_rules"') &&
      !androidManifest.includes('tools:replace="android:allowBackup,android:fullBackupContent,android:dataExtractionRules"') &&
      androidBackupRules.includes("<cloud-backup") &&
      androidBackupRules.includes("<device-transfer") &&
      ["sharedpref", "database", "file", "external", "root"].every((domain) =>
        androidBackupRules.includes(`domain="${domain}"`)
      ),
    "Android disables implicit OS backup/device-transfer for local recovery state; recovery continuity must use FREED's explicit encrypted backup flow."
  ),
  check(
    "server-secrets-not-public",
    envExample.includes("OPENAI_API_KEY=") &&
      envProductionExample.includes("OPENAI_API_KEY=") &&
      envExample.includes("FREED_AI_PROVIDER_TIMEOUT_MS=") &&
      envProductionExample.includes("FREED_AI_PROVIDER_TIMEOUT_MS=") &&
      envExample.includes("OPENAI_MODEL=") &&
      envProductionExample.includes("OPENAI_MODEL=") &&
      envExample.includes("GEMINI_API_KEY=") &&
      envProductionExample.includes("GEMINI_API_KEY=") &&
      !envExample.includes("EXPO_PUBLIC_OPENAI_API_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_OPENAI_API_KEY") &&
      !envExample.includes("EXPO_PUBLIC_FREED_AI_PROVIDER_TIMEOUT_MS") &&
      !envProductionExample.includes("EXPO_PUBLIC_FREED_AI_PROVIDER_TIMEOUT_MS") &&
      !envExample.includes("EXPO_PUBLIC_GEMINI_API_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_GEMINI_API_KEY") &&
      !envExample.includes("EXPO_PUBLIC_GOOGLE_API_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_API_KEY") &&
      !envExample.includes("EXPO_PUBLIC_GOOGLE_GENAI_API_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_GENAI_API_KEY") &&
      envExample.includes("APP_STORE_SERVER_API_JWT=") &&
      envProductionExample.includes("APP_STORE_SERVER_API_JWT=") &&
      envExample.includes("APP_STORE_PRIVATE_KEY=") &&
      envProductionExample.includes("APP_STORE_PRIVATE_KEY=") &&
      envExample.includes("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=") &&
      envProductionExample.includes("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=") &&
      envExample.includes("GOOGLE_PLAY_ACCESS_TOKEN=") &&
      envProductionExample.includes("GOOGLE_PLAY_ACCESS_TOKEN=") &&
      !envExample.includes("EXPO_PUBLIC_APP_STORE_SERVER_API_JWT") &&
      !envProductionExample.includes("EXPO_PUBLIC_APP_STORE_SERVER_API_JWT") &&
      !envExample.includes("EXPO_PUBLIC_APP_STORE_PRIVATE_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_APP_STORE_PRIVATE_KEY") &&
      !envExample.includes("EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT") &&
      !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT") &&
      !envExample.includes("EXPO_PUBLIC_GOOGLE_PLAY_ACCESS_TOKEN") &&
      !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_PLAY_ACCESS_TOKEN") &&
      envExample.includes("SUPABASE_SERVICE_ROLE_KEY=") &&
      envProductionExample.includes("SUPABASE_SERVICE_ROLE_KEY=") &&
      envExample.includes("BACKEND_MAINTENANCE_SECRET=") &&
      envProductionExample.includes("BACKEND_MAINTENANCE_SECRET=") &&
      envExample.includes("UPSTASH_REDIS_REST_URL=") &&
      envProductionExample.includes("UPSTASH_REDIS_REST_URL=") &&
      envExample.includes("UPSTASH_REDIS_REST_TOKEN=") &&
      envProductionExample.includes("UPSTASH_REDIS_REST_TOKEN=") &&
      envExample.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET=") &&
      envProductionExample.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET=") &&
      envExample.includes("FCM_ACCESS_TOKEN=") &&
      envProductionExample.includes("FCM_ACCESS_TOKEN=") &&
      envExample.includes("FIREBASE_PROJECT_ID=") &&
      envProductionExample.includes("FIREBASE_PROJECT_ID=") &&
      envExample.includes("FIREBASE_SERVICE_ACCOUNT_JSON=") &&
      envProductionExample.includes("FIREBASE_SERVICE_ACCOUNT_JSON=") &&
      envExample.includes("APNS_PRIVATE_KEY=") &&
      envProductionExample.includes("APNS_PRIVATE_KEY=") &&
      !envExample.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") &&
      !envProductionExample.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") &&
      !envExample.includes("EXPO_PUBLIC_BACKEND_MAINTENANCE_SECRET") &&
      !envProductionExample.includes("EXPO_PUBLIC_BACKEND_MAINTENANCE_SECRET") &&
      !envExample.includes("EXPO_PUBLIC_UPSTASH") &&
      !envProductionExample.includes("EXPO_PUBLIC_UPSTASH") &&
      !envExample.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION") &&
      !envProductionExample.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION") &&
      !envExample.includes("EXPO_PUBLIC_FCM") &&
      !envProductionExample.includes("EXPO_PUBLIC_FCM") &&
      !/\bEXPO_PUBLIC_FIREBASE_[A-Z0-9_]*(?:SERVICE_ACCOUNT|ADMIN|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|APPLICATION_CREDENTIALS|CREDENTIAL)[A-Z0-9_]*\b/.test(envExample) &&
      !/\bEXPO_PUBLIC_FIREBASE_[A-Z0-9_]*(?:SERVICE_ACCOUNT|ADMIN|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|APPLICATION_CREDENTIALS|CREDENTIAL)[A-Z0-9_]*\b/.test(envProductionExample) &&
      !envExample.includes("EXPO_PUBLIC_APNS") &&
      !envProductionExample.includes("EXPO_PUBLIC_APNS") &&
      backendRetentionCleanup.includes("validateBackendMaintenanceAuth") &&
      backendRetentionCleanup.includes("BACKEND_MAINTENANCE_SECRET") &&
      !backendRetentionCleanup.includes("EXPO_PUBLIC_") &&
      !backendCleanupRoute.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !remoteNotifications.includes("EXPO_PUBLIC_") &&
      !remoteNotificationRoute.includes("EXPO_PUBLIC_") &&
      !claraRoute.includes("EXPO_PUBLIC_OPENAI") &&
      !challengeRoute.includes("EXPO_PUBLIC_OPENAI") &&
      !retentionRoute.includes("EXPO_PUBLIC_OPENAI") &&
      !claraRoute.includes("EXPO_PUBLIC_GEMINI") &&
      !challengeRoute.includes("EXPO_PUBLIC_GEMINI") &&
      !retentionRoute.includes("EXPO_PUBLIC_GEMINI") &&
      !analyticsRoute.includes("EXPO_PUBLIC_SUPABASE") &&
      !claraRoute.includes("EXPO_PUBLIC_GOOGLE") &&
      !challengeRoute.includes("EXPO_PUBLIC_GOOGLE") &&
      !retentionRoute.includes("EXPO_PUBLIC_GOOGLE") &&
      !purchaseRoute.includes("EXPO_PUBLIC_APP_STORE") &&
      !purchaseRoute.includes("EXPO_PUBLIC_GOOGLE_PLAY"),
    "AI, store-verification, Supabase, Redis, maintenance, and notification secrets are documented and read as server-only env vars, never EXPO_PUBLIC client variables."
  ),
  check(
    "blocked-attempt-redaction",
    blockingEngine.includes("redactUrlForStorage") &&
      blockingEngine.includes("normalizeHostCandidate") &&
      recoveryState.includes("redactUrlForStorage(attempt.url)") &&
      recoveryState.includes("sanitizeStoredAttemptHost") &&
      recoveryState.includes("url: redactUrlForStorage(value.url)") &&
      recoveryState.includes("sanitizeAttemptReason") &&
      recoveryState.includes("sanitizeAttemptMatchedRule") &&
      recoveryState.includes("clampUnit(value.result.confidence)") &&
      recoveryState.includes("[redacted-domain]") &&
      recoveryState.includes("[redacted-secret]") &&
      recoveryState.includes("sanitizeSourceAttemptHost") &&
      recoveryState.includes("sanitizeNativeInterventionId(value.nativeInterventionId)") &&
      nativeIntervention.includes("sanitizeNativeInterventionId(pending.interventionId)") &&
      androidClassifier.includes("fun normalizeHostForStorage(input: String): String") &&
      androidAccessibilityService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)") &&
      androidProtectionModule.includes("sanitizedPendingHost") &&
      androidProtectionModule.includes("sanitizedPendingSourcePackage") &&
      iosProtectionModule.includes("sanitizedPendingHost") &&
      iosProtectionModule.includes("sanitizeHostForStorage") &&
      iosProtectionModule.includes('"url": "https://\\(host)"') &&
      nativeIntervention.includes("SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES") &&
      nativeIntervention.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES") &&
      doomscrollApps.includes("primaryDoomscrollPackageBySupportedPackage") &&
      doomscrollApps.includes("surfaceForDoomscrollAppPackage") &&
      doomscrollApps.includes("SHORT_FORM_RULE_PACKAGES") &&
      doomscrollApps.includes("SHORT_FORM_RULE_HOSTS") &&
      nativeIntervention.includes("SHORT_FORM_RULE_HOSTS") &&
      nativeIntervention.includes("hostForShortFormRule") &&
      nativeIntervention.includes("packageForShortFormRule") &&
      nativeIntervention.includes("supportedNativeAppPackageSet.has(normalized)") &&
      nativeIntervention.includes('APP_INTERVENTION_FALLBACK_HOST = "selected-app.app.freed.local"') &&
      !nativeIntervention.includes("shortFormRulePackages") &&
      nativeIntervention.includes("configured-app:unsupported") &&
      nativeIntervention.includes("normalizePendingReason") &&
      nativeIntervention.includes("[redacted-domain]") &&
      recoveryState.includes('source === "app" ? sanitizeSourcePackage(value.sourcePackage) : undefined'),
    "Blocked attempt URLs/hosts, challenge completion sources, earned-unlock sources, and native pending handoffs are redacted through code paths before local persistence, and native app source packages are retained only when they match the supported app allowlist."
  ),
  check(
    "encrypted-recovery-backup",
    recoveryBackup.includes("AES-GCM") &&
      recoveryBackup.includes("PBKDF2-SHA256") &&
      recoveryBackup.includes("createEncryptedRecoveryBackup") &&
      recoveryBackup.includes("restoreEncryptedRecoveryBackup") &&
      recoveryBackup.includes("buildPortableRecoveryState") &&
      recoveryBackup.includes("scheduledIds: []") &&
      recoveryBackupClientSync.includes("uploadEncryptedRecoveryBackup") &&
      recoveryBackupClientSync.includes("downloadEncryptedRecoveryBackup") &&
      recoveryBackupClientSync.includes("createEncryptedRecoveryBackup(state, passphrase)") &&
      recoveryBackupClientSync.includes("restoreEncryptedRecoveryBackup(JSON.stringify(envelope), passphrase)") &&
      recoveryBackupClientSync.includes("safeUserFacingMessage") &&
      userFacingError.includes("safeUserFacingMessage") &&
      userFacingError.includes("redactOperationalText") &&
      recoveryBackupClientSync.includes("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT") &&
      recoveryBackupSync.includes("sanitizeRecoveryBackupSyncRequest") &&
      recoveryBackupSync.includes("sanitizeRecoveryBackupSyncResult") &&
      recoveryBackupSync.includes("syncEncryptedRecoveryBackup") &&
      recoveryBackupSync.includes("Supabase Auth user endpoint") &&
      recoveryBackupSync.includes("hashToken") &&
      recoveryBackupSync.includes("forbiddenSyncKeys") &&
      recoveryBackupSync.includes("normalizeSyncKey") &&
      recoveryBackupSync.includes("containsSensitiveOperationalText") &&
      recoveryBackupClientSync.includes("redactOperationalText") &&
      recoveryBackupSync.includes("passphrase") &&
      recoveryBackupSyncRoute.includes("syncEncryptedRecoveryBackup") &&
      recoveryBackupSyncRoute.includes("enforceBackendRateLimit") &&
      !recoveryBackupSync.includes("restoreEncryptedRecoveryBackup(") &&
      !recoveryBackupSync.includes("createEncryptedRecoveryBackup(") &&
      !recoveryBackupSyncRoute.includes("passphrase"),
    "Recovery backup export encrypts portable local state, clears device-local notification IDs on restore, hosted client sync encrypts/decrypts locally, and server sync accepts only encrypted envelopes behind authenticated storage."
  ),
  check(
    "in-app-privacy-support-deletion",
    appSurface.includes("PrivacySupportCard") &&
      appSurface.includes("FREED_PRIVACY_POLICY_URL") &&
      appSurface.includes("support@freedrecovery.app") &&
      appSurface.includes("Server Deletion") &&
      appSurface.includes("Delete Local Data") &&
      appSurface.includes("Confirm Delete") &&
      appSurface.includes("deleteLocalRecoveryData") &&
      appSurface.includes("createDefaultRecoveryState") &&
      appSurface.includes("stopAdultContentFilter()") &&
      appSurface.includes("stopRiskWindowMonitoring()") &&
      appSurface.includes("clearEarnedUnlockWindow()") &&
      appSurface.includes("configureBlockedAppPackages(\n        []") &&
      appSurface.includes('setScreen("welcome")'),
    "Profile exposes privacy policy, support contact, server deletion request, hosted-sync deletion guidance, and two-step local data deletion with native protection cleanup."
  ),
  check(
    "public-privacy-support-deletion-pages",
    publicPrivacyRoute.includes("PrivacyPolicyPage") &&
      publicSupportRoute.includes("SupportPage") &&
      publicDeletionRoute.includes("AccountDeletionPage") &&
      legalPages.includes("FREED Privacy Policy") &&
      legalPages.includes("Effective date: June 6, 2026") &&
      legalPages.includes("Android Accessibility") &&
      legalPages.includes("DNS-only VPN") &&
      legalPages.includes("Family Controls") &&
      legalPages.includes("DeviceActivity") &&
      legalPages.includes("Purchase verification") &&
      legalPages.includes("FREED Support") &&
      legalPages.includes("Google Play") &&
      legalPages.includes("App Store") &&
      legalPages.includes("FREED Account Deletion") &&
      legalPages.includes("Delete Local Data") &&
      legalPages.includes("hosted encrypted backup sync") &&
      legalPages.includes("purchase audit records") &&
      legalPages.includes("legal retention") &&
      legalPages.includes("support@freedrecovery.app"),
    "Public /privacy, /support, and /account-deletion routes expose store-ready privacy, support, billing, protection-permission, local deletion, hosted deletion, and retention disclosures without requiring auth."
  ),
  check(
    "accountability-report-privacy",
    accountability.includes("buildSponsorReport") &&
      accountability.includes("buildSupportCircleReportDeepLink") &&
      accountability.includes("hasUsableSupportCircleMember") &&
      accountability.includes("redactReportText") &&
      accountability.includes("Private notes, contacts, and browsing details are not included.") &&
      !accountability.includes("relapseRecords.map") &&
      !accountability.includes("dailyCheckIns.map") &&
      !accountability.includes("attempt.host") &&
      !accountability.includes("state.supportCircle"),
    "Sponsor and support-circle reports are built from aggregate weekly metrics and redacted focus text, not raw notes, reflections, support-contact lists, or browsing hosts."
  ),
  check(
    "remote-community-consent-abuse-gate",
    communitySafety.includes("REMOTE_COMMUNITY_ENABLED_DEFAULT = false") &&
      communitySafety.includes("getRemoteCommunityReadiness") &&
      communitySafety.includes("missing-explicit-user-consent") &&
      communitySafety.includes("missing-privacy-disclosure-review") &&
      communitySafety.includes("missing-community-guidelines-acceptance") &&
      communitySafety.includes("missing-moderation-queue") &&
      communitySafety.includes("missing-abuse-report-channel") &&
      communitySafety.includes("abuse-report-sla-must-be-between-1-and-24-hours") &&
      communitySafety.includes("missing-block-and-mute-controls") &&
      communitySafety.includes("block-and-mute-must-cover-all-surfaces") &&
      communitySafety.includes("private-notes-must-not-be-shared") &&
      communitySafety.includes("browsing-details-must-not-be-shared") &&
      communitySafety.includes("support-contacts-must-not-be-shared") &&
      communitySafety.includes("remote-direct-messaging-must-stay-disabled-until-reviewed") &&
      communitySafety.includes("user-generated-community-text-must-stay-disabled") &&
      communitySafety.includes("missing-retention-deletion-review") &&
      communitySafety.includes("aggregateOnlySharing: true") &&
      communitySafety.includes("excludesPrivateNotes: true") &&
      communitySafety.includes("excludesBrowsingDetails: true") &&
      communitySafety.includes("excludesSupportContacts: true") &&
      communitySafety.includes("excludesUserGeneratedText: true") &&
      communitySafety.includes("directMessagingAllowed: false") &&
      communitySafety.includes("userGeneratedPostTextAllowed: false") &&
      !communitySafety.includes("relapseRecords.map") &&
      !communitySafety.includes("dailyCheckIns.map") &&
      !communitySafety.includes("attempt.host") &&
      !communitySafety.includes("accountability.contact") &&
      !communitySafety.includes("messageTemplate"),
    "Remote community workflows are disabled by default and gated behind explicit consent, privacy disclosure review, guidelines acceptance, moderation queue readiness, reporting SLA, block/mute coverage, disabled DMs/user text, short retention deletion review, crisis-review, and aggregate-only payload rules."
  ),
  check(
    "analytics-aggregate-only-gate",
    recoveryAnalytics.includes("REMOTE_ANALYTICS_ENABLED_DEFAULT = false") &&
      recoveryAnalytics.includes("buildRecoveryAnalyticsSnapshot") &&
      recoveryAnalytics.includes("getAnalyticsSharingReadiness") &&
      recoveryAnalytics.includes("sendGatedAnalyticsPayload") &&
      recoveryAnalytics.includes("ANALYTICS_CONSENT_VERSION") &&
      recoveryAnalytics.includes("EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS") &&
      recoveryAnalytics.includes("Remote analytics request timed out") &&
      recoveryAnalytics.includes("MAX_ANALYTICS_CONSENT_CLOCK_SKEW_MS") &&
      recoveryAnalytics.includes("remote-analytics-disabled-by-default") &&
      recoveryAnalytics.includes("missing-explicit-user-consent") &&
      recoveryAnalytics.includes("analytics-consent-time-in-future") &&
      recoveryAnalytics.includes("analytics-consent-version-mismatch") &&
      recoveryAnalytics.includes("missing-analytics-endpoint") &&
      recoveryAnalytics.includes("configured-analytics-endpoint-missing") &&
      recoveryAnalytics.includes("analytics-endpoint-consent-stale") &&
      recoveryAnalytics.includes("analytics-sharing-must-stay-aggregate-only") &&
      recoveryAnalytics.includes("private-notes-must-not-be-shared") &&
      recoveryAnalytics.includes("browsing-details-must-not-be-shared") &&
      recoveryAnalytics.includes("support-contacts-must-not-be-shared") &&
      recoveryAnalytics.includes("aggregateOnly: true") &&
      recoveryAnalytics.includes("excludesPrivateNotes: true") &&
      recoveryAnalytics.includes("excludesBrowsingDetails: true") &&
      recoveryAnalytics.includes("excludesSupportContacts: true") &&
      recoveryAnalytics.includes("productionMetrics") &&
      recoveryAnalytics.includes("appForegroundMinutes") &&
      recoveryAnalytics.includes("blockedAttemptSourceBreakdown") &&
      recoveryAnalytics.includes("peakUrgeHour") &&
      recoveryAnalytics.includes("hourlyUrgePattern") &&
      recoveryAnalytics.includes("unlockFrequencyPerWeek") &&
      recoveryAnalytics.includes("streakHistory") &&
      recoveryAnalytics.includes("challengeSuccessByCategory") &&
      recoveryAnalytics.includes("coarseRecoveryTriggerLabel") &&
      recoverySignalPrivacy.includes("Logged trigger pattern") &&
      recoveryAnalytics.includes("safeAnalyticsNextFocus") &&
      recoveryState.includes("analyticsSharing: AnalyticsSharingSettings") &&
      recoveryState.includes("updateAnalyticsSharingSettings") &&
      appSurface.includes("sendGatedAnalyticsPayload(recoveryState, recoveryState.analyticsSharing)") &&
      appSurface.includes("Only aggregate counts and rates are sent after consent") &&
	      recoveryAnalyticsIngestion.includes("sanitizeAnalyticsIngestionRequest") &&
	      recoveryAnalyticsIngestion.includes("ANALYTICS_CONSENT_VERSION") &&
	      recoveryAnalyticsIngestion.includes("FORBIDDEN_ANALYTICS_KEYS") &&
	      recoveryAnalyticsIngestion.includes("normalizeAnalyticsKey") &&
	      recoveryAnalyticsIngestion.includes("private_notes") &&
	      recoveryAnalyticsIngestion.includes("rawURL") &&
	      recoveryAnalyticsIngestion.includes("purchase_token") &&
	      recoveryAnalyticsIngestion.includes("receiptData") &&
	      recoveryAnalyticsIngestion.includes("access[_-]?token") &&
	      recoveryAnalyticsIngestion.includes("sanitizeAnalyticsIngestionResult") &&
	      recoveryAnalytics.includes("sanitizeAnalyticsReason") &&
	      recoveryAnalytics.includes("redactOperationalText") &&
	      recoveryAnalyticsIngestion.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      recoveryAnalyticsIngestion.includes("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS") &&
      recoveryAnalyticsIngestion.includes("Analytics Supabase ingestion timed out") &&
      recoveryAnalyticsIngestion.includes("Supabase analytics ingestion is not configured") &&
      analyticsRoute.includes("ingestRecoveryAnalytics") &&
      analyticsRoute.includes("enforceBackendRateLimit") &&
      analyticsRoute.includes("backendRateLimitHttpStatus") &&
      backendInfrastructure.includes("shouldFailClosedRateLimit") &&
      backendInfrastructure.includes("FREED_BACKEND_RATE_LIMIT_FAIL_CLOSED") &&
      !recoveryAnalytics.includes("attempt.host") &&
      !recoveryAnalytics.includes("dailyCheckIns.map") &&
      !recoveryAnalytics.includes("accountability.contact") &&
      !recoveryAnalytics.includes("messageTemplate"),
    "Analytics snapshots are aggregate-only with production metrics and coarse trigger labels, remote sharing is disabled by default, and remote analytics requires explicit current-version consent, safe endpoint, bounded send/ingestion timeouts, short retention, production fail-closed backend rate limiting, and no private notes/browsing/support-contact sharing."
  ),
  check(
    "urge-forecast-local-privacy",
    urgeForecast.includes('source: "local-recovery-signals"') &&
      urgeForecast.includes("getDailyCheckInForDay") &&
      urgeForecast.includes("countAttemptsForDay") &&
      urgeForecast.includes("generateWeeklyRecoveryReport") &&
      urgeForecast.includes("localOnly: true") &&
      urgeForecast.includes("aggregateOnly: true") &&
      urgeForecast.includes("excludesPrivateNotes: true") &&
      urgeForecast.includes("excludesBrowsingDetails: true") &&
      urgeForecast.includes("excludesSupportContacts: true") &&
      urgeForecast.includes("usesRawLocation: false") &&
      privacyDataMap.includes("Local urge risk forecast"),
    "Local urge forecast uses real on-device aggregate recovery signals and documents private-note, browsing, support-contact, and raw-location exclusions."
  ),
  check(
    "coach-redacts-user-text",
    aiCoach.includes("redactCoachText") &&
      aiCoach.includes("[redacted-link]") &&
      aiCoach.includes("[redacted-domain]") &&
      claraRoute.includes("redactCoachText(body.input)"),
    "CLARA client and server route redact links/domains before remote processing."
  ),
  check(
    "ai-remote-slip-signals-coarse",
    recoverySignalPrivacy.includes("coarseRecoveryTriggerLabel") &&
      aiCoach.includes("coarseRecoveryTriggerLabel(context.slipTrigger)") &&
      claraRoute.includes("coarseRecoveryTriggerLabel(context.slipTrigger)") &&
      challengeGenerator.includes("coarseRecoveryTriggerLabel(profile.slipTrigger)") &&
      challengeRoute.includes("coarseRecoveryTriggerLabel(profile.slipTrigger)") &&
      retentionOrchestrator.includes("coarseRecoveryTriggerLabel(report.slipTrigger)") &&
      retentionOrchestrator.includes("coarseRecoveryTriggerLabel(profile.slipTrigger)") &&
      privacyDataMap.includes("coarse trigger categories"),
    "Remote CLARA, challenge generation, retention, and analytics use coarse trigger categories instead of raw private slip trigger text."
  ),
  check(
    "challenge-session-duration-privacy",
    nativeIntervention.includes("sanitizeSessionDurationSeconds") &&
      recoveryState.includes("sanitizeAttemptSessionDuration") &&
      nativeProtectionIndex.includes("sessionDurationSec?: number") &&
      androidAccessibilityService.includes("PENDING_SESSION_DURATION_SECONDS") &&
      androidAccessibilityService.includes("currentForegroundSessionMs") &&
      androidProtectionModule.includes('"sessionDurationSec" to sanitizedPendingSessionDuration(pendingSnapshot)') &&
      challengeGenerator.includes("sessionDurationBucket") &&
      challengeGenerator.includes("Use session duration only as a coarse bucket") &&
      challengeGenerator.includes("Treat recent failed resets as aggregate count signals") &&
      challengeRoute.includes("sessionDurationBuckets") &&
      challengeRoute.includes("recentFailureCount") &&
      challengeRoute.includes("Use session duration only as a coarse bucket"),
    "Android app/short-form session duration is sanitized, converted to coarse challenge buckets, and paired with aggregate failed-reset counts before remote challenge generation."
  ),
  check(
    "ai-output-redaction",
    aiCoach.includes("sanitizeCoachOutput") &&
      claraRoute.includes("sanitizeCoachOutput") &&
      challengeGenerator.includes("sanitizeGeneratedText") &&
      challengeGenerator.includes("sanitizeGeneratedId") &&
      retentionOrchestrator.includes("normalizeRetentionPlan") &&
      retentionOrchestrator.includes("retentionOutputText") &&
      challengeRoute.includes("sanitizeGeneratedText") &&
      challengeRoute.includes("sanitizeGeneratedId") &&
      retentionRoute.includes("normalizeRetentionPlan"),
    "Remote CLARA text plus generated challenge and retention-plan fields are sanitized before display or storage."
  ),
  check(
    "production-endpoint-secret-barrier",
    endpointSafety.includes("parsed.username || parsed.password") &&
      endpointSafety.includes("must not include URL credentials") &&
      endpointSafety.includes("parsed.search") &&
      endpointSafety.includes("must not include query strings") &&
      endpointSafety.includes("parsed.hash") &&
      endpointSafety.includes("must not include URL fragments"),
    "Production endpoint safety rejects URL credentials, query strings, and fragments so public config cannot carry provider tokens or operational secrets."
  ),
  check(
    "weather-context-privacy-gate",
    envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED=false") &&
      envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED=false") &&
      envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS") &&
      envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS") &&
      envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES") &&
      envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES") &&
      challengeContext.includes("getChallengeWeatherContextConfig") &&
      challengeContext.includes('readPublicEnv("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED"') &&
      challengeContext.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS") &&
      challengeContext.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES") &&
      challengeContext.includes("readBoundedResponseJson") &&
      challengeContext.includes("getProductionEndpointIssues") &&
      challengeContext.includes("latitude.toFixed(1)") &&
      challengeContext.includes("longitude.toFixed(1)") &&
      appSurface.includes("getChallengeWeatherContextConfig") &&
      appSurface.includes("if (!weatherConfig.enabled)") &&
      challengeGenerator.includes("never infer weather or location") &&
      privacyDataMap.includes("Challenge weather context") &&
      privacyDataMap.includes("Disabled by default") &&
      privacyDataMap.includes("rounded coordinates") &&
      privacyDataMap.includes("exact coordinates are not sent to AI"),
    "Weather personalization is disabled by default, requires a production-safe HTTPS endpoint when enabled, bounds provider transport, rounds coordinates before provider calls, and sends only condition/temperature into challenge generation."
  ),
  check(
    "challenge-route-no-browsing-fields",
    challengeRouteForbiddenBrowsingFields.every((field) => !challengeRoute.includes(field)),
    "Challenge generation server route accepts recovery signals, not browsing host or URL field payloads."
  ),
  check(
    "retention-route-aggregate-only",
    retentionOrchestrator.includes("buildRetentionRequest") &&
      retentionOrchestrator.includes("getProductionEndpointIssues") &&
      retentionOrchestrator.includes("remote retention endpoint") &&
      retentionOrchestrator.includes("DailyCheckIn") === false &&
      retentionForbiddenSensitiveFields.every((field) => !retentionRoute.includes(field)) &&
      retentionRoute.includes("sanitizeRetentionRequest") &&
      retentionRoute.includes("createLocalRetentionPlan"),
    "Retention orchestration route accepts aggregate profile fields and excludes reflections, notes, contacts, transcripts, and browsing host/URL payloads."
  ),
  check(
    "purchase-verification-redacts-store-tokens",
    purchaseRoute.includes("verifyPurchasePayload") &&
      purchaseVerification.includes("safeResult") &&
      purchaseVerification.includes("sanitizePurchaseToken") &&
      purchaseVerification.includes("sanitizePurchaseReason") &&
      !purchaseRoute.includes("purchaseToken") &&
      !purchaseRoute.includes("rawReceipt"),
    "Purchase verification responses are shaped through a safe result and do not echo raw store tokens or receipts."
  ),
  check(
    "notification-copy-privacy",
    reminders.includes('data: { route: "checkin", kind: item.key }') &&
      reminders.includes("ReminderSyncOptions") &&
      reminders.includes("cancelScheduledNotificationAsync") &&
      remoteNotifications.includes("buildSafeRemoteNotificationPayload") &&
      remoteNotifications.includes("forbiddenPayloadKeys") &&
      remoteNotifications.includes("normalizeDeviceToken") &&
      remoteNotifications.includes("sanitizeNotificationReason") &&
      remoteNotifications.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET") &&
      remoteNotificationRoute.includes("validateRemoteNotificationAuth") &&
      remoteNotificationRoute.includes("sendRemoteNotification") &&
      !/porn|adult|nsfw|explicit/i.test(reminders) &&
      !/porn|adult|nsfw|explicit/i.test(remoteNotifications) &&
      !/data:\s*{[^}]*reflection/i.test(reminders) &&
      !/data:\s*{[^}]*url/i.test(reminders) &&
      !/data:\s*{[^}]*token/i.test(reminders) &&
      !remoteNotificationRoute.includes("purchaseToken"),
    "Reminder and remote push source copy avoid sensitive adult-content terms, cancel stale local IDs, require server authorization, and send only route/kind metadata."
  ),
  check(
    "permission-flow-disclosure-boundaries",
    protectionPermissions.includes("To protect you from explicit content and doomscroll loops") &&
      protectionPermissions.includes("monitor only selected apps and sites through platform APIs") &&
      protectionPermissions.includes("block known adult domains") &&
      protectionPermissions.includes("app-limit threshold") &&
      protectionPermissions.includes("FamilyControls and ManagedSettings") &&
      protectionPermissions.includes("Safari Content Blocker") &&
      protectionPermissions.includes("DNS-only VPN permission") &&
      protectionPermissions.includes("Native feed sync") &&
	      protectionPermissions.includes("feed version, checksum, and domain count") &&
	      protectionPermissions.includes("Usage Access") &&
	      protectionPermissions.includes("Accessibility Service") &&
	      protectionPermissions.includes("without routing all device traffic through FREED") &&
	      protectionPermissions.includes("does not MITM HTTPS") &&
	      protectionPermissions.includes("does not inspect page contents") &&
	      protectionPermissions.includes("Camera and on-device Vision labels") &&
	      protectionPermissions.includes("Camera and on-device ML Kit labels") &&
	      protectionPermissions.includes("Motion sensors and pedometer") &&
	      protectionPermissions.includes("Activity Recognition, sensors, and steps") &&
	      protectionPermissions.includes("Foreground location") &&
	      protectionPermissions.includes("No camera roll access") &&
	      protectionPermissions.includes("No gallery/media-library access") &&
	      protectionPermissions.includes("continuous image classification") &&
	      protectionPermissions.includes("does not sync HealthKit history") &&
	      protectionPermissions.includes("does not run background fitness monitoring") &&
	      protectionPermissions.includes("Screen Time-sourced earned unlocks") &&
	      protectionPermissions.includes("source-scoped app or short-form earned unlocks") &&
	      protectionPermissions.includes("exact coordinates are not sent to AI") &&
      protectionPermissions.includes("getSelectedScreenTimeTargetCount") &&
      protectionPermissions.includes("selectedScreenTimeTokenCount") &&
      appSurface.includes("PROTECTION_PERMISSION_EXPLANATION") &&
      appSurface.includes("getSelectedScreenTimeTargetCount") &&
      appSurface.includes("Permission checklist") &&
	      appSurface.includes("Each permission has one job") &&
      appSurface.includes("setupAutoAdvanceRef") &&
      appSurface.includes("orderedSetupActionLabel") &&
      appSurface.includes("Continuing setup: ${nextRequiredStep.title}.") &&
      appSurface.includes("Boolean(status.vpnConsentRequired && !status.adultFilterActive)") &&
      appSurface.includes("protectionStatus?.vpnConsentRequired === false") &&
      appSurface.includes("Android VPN permission is approved. Starting DNS Guard now.") &&
      appSurface.includes("All required setup rows are ready. Running the activation test now.") &&
      appSurface.includes("if (nextRequiredStep.id === completedStep.id) return") &&
      appSurface.includes("return `Continue: ${nextRequiredStep.title}`") &&
      appSurface.includes("Open: ${nextRequiredStep.title}") &&
      appSurface.includes("adultFilterStep ? runStepAction(adultFilterStep) : runAction(\"adult\", applyAdultContentFilter)") &&
      appSurface.includes("appInterventionStep ? runStepAction(appInterventionStep) : runAction(\"apps\", requestProtectionAuthorization)") &&
      appSurface.includes("usageAccessStep ? runStepAction(usageAccessStep) : runAction(\"usage\", openUsageAccessSettings)") &&
      appSurface.includes("orderedSetupActionLabel(adultFilterStep, \"Enable Adult Block\")") &&
      appSurface.includes("orderedSetupActionLabel(appInterventionStep, \"Enable App Timer Permission\")") &&
      appSurface.includes("orderedSetupActionLabel(usageAccessStep, \"Enable Usage Access\")") &&
		      appSurface.includes("Native Reels, Shorts, and TikTok screens are not inspected") &&
		      appSurface.includes("Accessibility and Usage Access handle selected app timers") &&
		      appSurface.includes("when the selected surface is visible") &&
		      appSurface.includes("DNS-only VPN") &&
		      appSurface.includes("local VpnService routes DNS resolver IPs only") &&
		      appSurface.includes("configured limits or selected short-form thresholds") &&
		      appSurface.includes("Required Android setup: reviewed adult-domain feed, DNS-only VPN, Usage Access, Accessibility, selected app timers, then Test Protection") &&
	      appSurface.includes("Required iOS setup: Screen Time authorization, adult-domain Safari Content Blocker, Safari Focus Shield for Shorts/Reels, selected targets, daily-limit monitoring, then Test Protection") &&
      appSurface.includes("Test Protection") &&
      appSurface.includes("adultBlocked") &&
      appSurface.includes("normalAllowed") &&
      appSurface.includes("nativeReady") &&
      appSurface.includes("getProtectionSetupReadiness") &&
      appSurface.includes("@/lib/protection-readiness") &&
      appSurface.includes("await syncNativeAdultDomainFeed()") &&
      appSurface.includes("Activation test refreshed the reviewed adult-domain feed before checking native readiness") &&
      protectionReadiness.includes("nativeConfiguredAppCount = protectionStatus?.blockedApplications ?? 0") &&
      protectionReadiness.includes("getSelectedScreenTimeTargetCount(protectionStatus)") &&
      protectionReadiness.includes("selectedIosTargets > 0 && protectionStatus?.appLimitScheduled") &&
      protectionReadiness.includes("protectionStatus?.appInterventionAuthorized") &&
      protectionReadiness.includes("protectionStatus?.usageStatsAuthorized") &&
      protectionReadiness.includes("nativeConfiguredAppCount > 0") &&
      appSurface.includes("Promise.allSettled([") &&
      appSurface.includes("freshReadiness.activationReady") &&
      appSurface.includes('Platform.OS === "ios"') &&
      appSurface.includes('Platform.OS === "android"') &&
      appSurface.includes('protectionCapability?.platform === "ios"') &&
      appSurface.includes('protectionCapability?.platform === "android"') &&
      appSurface.includes("if (activationComplete || !nativeProtectionPlatform)") &&
      appSurface.includes("Finish required protection setup before entering FREED on this device") &&
      appSurface.includes("Run Test First") &&
      appSurface.includes("activationReady && !activationTestPassed") &&
      appSurface.includes("Finish Setup") &&
      appSurface.includes("Continue Preview") &&
      !appSurface.includes("Continue Later") &&
      appSurface.includes("Native adult-domain feed loaded") &&
      appSurface.includes("native permission/feed status") &&
      appSurface.includes("without saving a blocked attempt"),
	    "Protection setup explains platform permissions separately, documents Safari, Screen Time, Android DNS-only VPN, native feed sync, Usage Access, Accessibility, and platform-aware on-demand challenge-verification data boundaries, and tests activation without writing fake recovery history."
	  ),
  check(
    "android-play-policy-disclosure-pack",
    androidPolicyPack.includes("Play Console AccessibilityService declaration") &&
      androidPolicyPack.includes("not as a disability assistance feature") &&
      androidPolicyPack.includes("user-enabled") &&
      androidPolicyPack.includes("explicit opt-in") &&
      androidPolicyPack.includes("supported browser address/search fields") &&
      androidPolicyPack.includes("focused WebView URL/search fields") &&
      androidPolicyPack.includes("selected short-form labels") &&
      androidPolicyPack.includes("bounded scroll events") &&
      androidPolicyPack.includes("No screenshots") &&
      androidPolicyPack.includes("No OCR") &&
      androidPolicyPack.includes("No raw page text scraping") &&
      androidPolicyPack.includes("No packet inspection") &&
      androidPolicyPack.includes("No MITM HTTPS") &&
      androidPolicyPack.includes("No sale or sharing of AccessibilityService data") &&
      androidPolicyPack.includes("No raw path/query persistence") &&
      androidPolicyPack.includes("android.permission.FOREGROUND_SERVICE_SPECIAL_USE") &&
      androidPolicyPack.includes('android:foregroundServiceType="specialUse"') &&
      androidPolicyPack.includes("android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE") &&
	      androidPolicyPack.includes("User-enabled DNS-only VPN fallback") &&
	      androidPolicyPack.includes("No full traffic proxy") &&
	      androidPolicyPack.includes("routes only configured DNS resolver IPs") &&
	      androidPolicyPack.includes("persistent foreground notification") &&
	      androidPolicyPack.includes("Challenge Verification Permissions") &&
	      androidPolicyPack.includes("on-device ML Kit labels") &&
	      androidPolicyPack.includes("Activity Recognition, sensors, and steps") &&
	      androidPolicyPack.includes("No background fitness monitoring or Health Connect history sync") &&
	      androidPolicyPack.includes("No background location tracking for protection") &&
	      androidPolicyPack.includes("android.playPolicyAccessibilityReviewId") &&
	      androidPolicyPack.includes("android.playPolicySpecialUseFgsArtifact"),
	    "Android Play policy pack documents AccessibilityService disclosure, DNS Guard special-use foreground-service justification, explicit data boundaries, and required review artifacts."
	  ),
  check(
    "ios-app-store-policy-review-pack",
    iosPolicyPack.includes("iOS Screen Time And Safari Review Pack") &&
      iosPolicyPack.includes("Family Controls entitlement") &&
      iosPolicyPack.includes("FamilyActivityPicker") &&
      iosPolicyPack.includes("ManagedSettings adult web filtering") &&
      iosPolicyPack.includes("DeviceActivity schedules") &&
      iosPolicyPack.includes("Safari Content Blocker") &&
      iosPolicyPack.includes("Safari Focus Shield") &&
      iosPolicyPack.includes("FREED cannot and does not read third-party app screens on iOS") &&
      iosPolicyPack.includes("FREED cannot and does not detect Instagram Reels, TikTok, or YouTube Shorts inside native third-party apps on iOS") &&
      iosPolicyPack.includes("FREED does not take screenshots, run OCR, or perform continuous image classification for protection") &&
      iosPolicyPack.includes("FREED does not use `NEPacketTunnelProvider`, `NETunnelProviderManager`, or `NEVPNManager`") &&
      iosPolicyPack.includes("FREED does not full-tunnel traffic") &&
      iosPolicyPack.includes("FREED does not inspect page contents") &&
      iosPolicyPack.includes("does not receive users' Safari browsing history") &&
	      iosPolicyPack.includes("No packet tunnel") &&
	      iosPolicyPack.includes("No VPN manager") &&
	      iosPolicyPack.includes("No TLS interception") &&
	      iosPolicyPack.includes("on-device Vision labels") &&
	      iosPolicyPack.includes("does not sync HealthKit history") &&
	      iosPolicyPack.includes("No HealthKit history sync or export") &&
	      iosPolicyPack.includes("No challenge media upload in the current local-first build") &&
      iosPolicyPack.includes("ios.familyControlsEntitlementArtifact") &&
      iosPolicyPack.includes("ios.safariFocusShieldShortFormBlockRunId") &&
      iosPolicyPack.includes("ios.safariShortFormChallengeHandoffSource=ios-safari-short-form") &&
      iosPolicyPack.includes("ios.safariShortFormChallengeHandoffRawPathStored=false") &&
      iosPolicyPack.includes("ios.safariShortFormChallengeHandoffNativeUnlockActive=false") &&
      iosPolicyPack.includes("ios.selectedAppDailyLimitArtifact"),
    "iOS App Store review pack documents Screen Time, Safari Content Blocker and Focus Shield, challenge-verification boundaries, and required physical-device artifacts."
  ),
  check(
    "store-console-privacy-answer-sheets",
    playStoreDataSafety.includes("FREED Google Play Data Safety Answer Sheet") &&
      playStoreDataSafety.includes("Purchase history") &&
      playStoreDataSafety.includes("Device or other IDs") &&
      playStoreDataSafety.includes("App interactions") &&
      playStoreDataSafety.includes("Web browsing history") &&
      playStoreDataSafety.includes("not sent off device") &&
      playStoreDataSafety.includes("Data deletion mechanism") &&
      playStoreDataSafety.includes("support@freedrecovery.app") &&
      appStorePrivacy.includes("FREED App Store App Privacy Answer Sheet") &&
      appStorePrivacy.includes("Data used to track users: No") &&
      appStorePrivacy.includes("Purchase History") &&
      appStorePrivacy.includes("Device ID") &&
      appStorePrivacy.includes("Product Interaction") &&
      appStorePrivacy.includes("Browsing History") &&
      appStorePrivacy.includes("not sent off device") &&
      appStorePrivacy.includes("Family Controls") &&
      appStorePrivacy.includes("DeviceActivity") &&
      appStorePrivacy.includes("Safari Content Blocker"),
    "Store-console privacy answer sheets translate the privacy data map into Play Data Safety and App Store App Privacy answers, including collected, optional, not-collected, tracking, deletion, and platform-protection boundaries."
  ),
  check(
    "camera-photo-verification-local-only",
    appConfig.includes("NSCameraUsageDescription") &&
      appConfig.includes("photo challenge") &&
      appConfig.includes('"microphonePermission": false') &&
      appConfig.includes('"photosPermission": false') &&
      iosInfoPlist.includes("NSCameraUsageDescription") &&
      !iosInfoPlist.includes("NSMicrophoneUsageDescription") &&
      !iosInfoPlist.includes("NSPhotoLibraryUsageDescription") &&
      androidManifest.includes("android.permission.CAMERA") &&
      challengeVerification.includes("expectedPhotoLabels") &&
      appSurface.includes("ImagePicker.launchCameraAsync") &&
      appSurface.includes("base64: false") &&
      appSurface.includes("exif: false") &&
      appSurface.includes("deleteTemporaryChallengePhoto(photoUri)") &&
      !appSurface.includes("launchImageLibraryAsync") &&
      !appSurface.includes("base64: true") &&
      nativeProtectionIndex.includes("classifyChallengePhoto") &&
      nativeProtectionIndex.includes("labels: []") &&
      iosProtectionModule.includes("VNClassifyImageRequest") &&
      androidProtectionModule.includes("ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)") &&
      !iosProtectionModule.includes("imageData.base64EncodedString") &&
      !androidProtectionModule.includes("Base64"),
    "Photo challenge verification uses explicit camera copy, fresh camera capture, on-device labels, no microphone/photo-library permission copy, no base64/exif payloads, and best-effort temporary-photo cleanup after classification."
  )
];

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED privacy safety audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
