const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, isAbsolute, relative, resolve } = require("node:path");
const { loadEnvFile } = require("./lib/env-file-loader");
const { productionBlockerGroups } = require("./lib/release-blocker-groups");
const { isPathInsideOrSame } = require("./lib/workspace-path-safety");

const releaseScripts = [
  "preflight:release-env",
  "typecheck",
  "test:core",
  "audit:smoke-harnesses",
  "export:web",
  "audit:store-legal-hosted",
  "export:android-bundle",
  "build:android-apk:upload-signed",
  "build:android-aab:upload-signed",
  "build:ios-archive:release",
  "audit:client-bundles",
  "smoke:backend-readiness",
  "smoke:supabase-schema",
  "smoke:adult-domain-feed",
  "smoke:analytics-ingestion",
  "smoke:remote-notifications",
  "eval:ai-safety",
  "smoke:ai-backend",
  "smoke:purchase-verification",
  "audit:challenges",
  "audit:classifier",
  "audit:android-classifier",
  "audit:accessibility",
  "audit:privacy",
  "audit:runtime-data",
  "audit:backend",
  "audit:performance",
  "audit:dependencies",
  "evidence:requirements",
  "evidence:artifact-privacy",
  "evidence:templates",
  "evidence:validation",
  "audit:release:strict"
];

const ISO_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REPORT_CURRENT_RUN_TOLERANCE_MS = 2_000;
const REPORT_FUTURE_SKEW_MS = 5 * 60 * 1_000;

const reportArtifactNames = {
  "preflight:release-env": "release-env-preflight-report.json",
  "build:android-apk:upload-signed": "android-apk-build-report.json",
  "build:android-aab:upload-signed": "android-aab-build-report.json",
  "build:ios-archive:release": "ios-release-archive-report.json",
  "audit:store-legal-hosted": "store-legal-hosted-url-audit.json",
  "smoke:backend-readiness": "backend-readiness-smoke-report.json",
  "smoke:supabase-schema": "supabase-schema-smoke-report.json",
  "smoke:adult-domain-feed": "adult-domain-feed-smoke-report.json",
  "smoke:analytics-ingestion": "analytics-ingestion-smoke-report.json",
  "smoke:remote-notifications": "remote-notification-smoke-report.json",
  "smoke:ai-backend": "ai-backend-smoke-report.json",
  "smoke:purchase-verification": "purchase-verification-smoke-report.json",
  "audit:release:strict": "release-readiness-report.json"
};

const envFileAwareScripts = new Set([
  "preflight:release-env",
  "build:android-apk:upload-signed",
  "build:android-aab:upload-signed"
]);

const reportArtifactSchemas = {
  "preflight:release-env": {
    field: "schema",
    value: "freed-release-env-preflight-report-v1",
    rowsField: "checks",
    requiredArrayFields: ["blockerGroups"]
  },
  "build:android-apk:upload-signed": {
    field: "schema",
    value: "freed-android-apk-build-report-v1",
    proofField: "apk"
  },
  "build:android-aab:upload-signed": {
    field: "schema",
    value: "freed-android-release-build-report-v1",
    proofField: "aab"
  },
  "build:ios-archive:release": {
    field: "schemaVersion",
    value: "freed-ios-release-archive-report-v1",
    proofField: "archive"
  },
  "audit:store-legal-hosted": {
    field: "schemaVersion",
    value: "freed-store-legal-hosted-url-audit-v1",
    rowsField: "checks"
  },
  "smoke:backend-readiness": {
    field: "schemaVersion",
    value: "backend-readiness-smoke-v1",
    proofField: "infrastructureProof"
  },
  "smoke:supabase-schema": {
    field: "schemaVersion",
    value: "supabase-schema-smoke-v1",
    proofField: "accessProof"
  },
  "smoke:adult-domain-feed": {
    field: "schemaVersion",
    value: "adult-domain-feed-smoke-v1",
    proofField: "contractProof"
  },
  "smoke:analytics-ingestion": {
    field: "schemaVersion",
    value: "analytics-ingestion-smoke-v1",
    proofField: "contractProof"
  },
  "smoke:remote-notifications": {
    field: "schemaVersion",
    value: "remote-notification-smoke-v1",
    proofField: "contractProof"
  },
  "smoke:ai-backend": {
    field: "schemaVersion",
    value: "ai-backend-smoke-v1",
    proofField: "contractProof"
  },
  "smoke:purchase-verification": {
    field: "schemaVersion",
    value: "purchase-verification-smoke-v1",
    proofField: "contractProof"
  },
  "audit:release:strict": {
    field: "schemaVersion",
    value: "release-readiness-report-v1"
  }
};

const reportArtifactRequiredResultIds = {
  "build:android-apk:upload-signed": [
    "android-apk-build",
    "android-apk-upload-signing",
    "android-apk-admob-app-id",
    "android-apk-signature",
    "android-apk-react-native-bundle",
    "android-apk-abi"
  ],
  "build:android-aab:upload-signed": [
    "android-aab-build",
    "android-aab-upload-signing",
    "android-aab-admob-app-id",
    "android-aab-react-native-bundle",
    "android-aab-abi"
  ],
  "build:ios-archive:release": [
    "ios-release-archive-build",
    "ios-release-export",
    "ios-release-signing",
    "ios-release-bundle-id",
    "ios-release-entitlements",
    "ios-release-embedded-extensions",
    "ios-release-safari-content-blocker",
    "ios-release-safari-focus-shield"
  ],
  "smoke:backend-readiness": [
    "backend-readiness-endpoint",
    "backend-readiness-http-contract",
    "backend-readiness-no-secret-echo",
    "backend-readiness-core-infrastructure-ready",
    "backend-readiness-data-boundaries"
  ],
  "smoke:supabase-schema": [
    "supabase-schema-config",
    "supabase-schema-core-table-contracts",
    "supabase-schema-public-client-lockout",
    "supabase-schema-no-secret-echo"
  ],
  "smoke:adult-domain-feed": [
    "adult-feed-endpoint",
    "adult-feed-json-contract",
    "adult-feed-conditional-304",
    "adult-feed-safari-content-blocker"
  ],
  "smoke:analytics-ingestion": [
    "analytics-ingestion-endpoint",
    "analytics-ingestion-aggregate-contract",
    "analytics-ingestion-incomplete-metrics-rejection",
    "analytics-ingestion-future-timestamp-rejection",
    "analytics-ingestion-sensitive-rejection"
  ],
  "smoke:remote-notifications": [
    "remote-notification-endpoint",
    "remote-notification-unauthorized-rejection",
    "remote-notification-supported-kind-rejection",
    "remote-notification-sensitive-rejection"
  ],
  "smoke:ai-backend": [
    "configured-ai-model",
    "clara-remote-endpoint",
    "challenge-remote-endpoint",
    "challenge-personalization-profiles"
  ],
  "smoke:purchase-verification": [
    "purchase-verification-endpoint",
    "purchase-unknown-product-fails-closed",
    "purchase-fake-known-yearly-token-fails-closed",
    "purchase-fake-known-monthly-token-fails-closed",
    "purchase-fake-known-lifetime-token-fails-closed",
    "purchase-malformed-json-fails-closed"
  ]
};

const hostedLegalRouteIds = ["privacy", "support", "account-deletion"];
const hostedLegalRequiredCheckIds = hostedLegalRouteIds.flatMap((routeId) => [
  `hosted-status-${routeId}`,
  `hosted-final-url-${routeId}`,
  `hosted-content-type-${routeId}`,
  `hosted-body-${routeId}`,
  `hosted-content-${routeId}`,
  `hosted-indexing-${routeId}`
]);

const launchPremiumPlanIds = ["yearly", "monthly", "lifetime"];
const defaultLaunchProductIds = {
  yearly: "freed_premium_yearly",
  monthly: "freed_premium_monthly",
  lifetime: "freed_premium_lifetime"
};
const launchProductEnvKeys = {
  yearly: ["EXPO_PUBLIC_IAP_PRODUCT_YEARLY", "IAP_PRODUCT_YEARLY"],
  monthly: ["EXPO_PUBLIC_IAP_PRODUCT_MONTHLY", "IAP_PRODUCT_MONTHLY"],
  lifetime: ["EXPO_PUBLIC_IAP_PRODUCT_LIFETIME", "IAP_PRODUCT_LIFETIME"]
};
const androidProtectionFlowOrder = [
  "android-native-adult-domain-feed",
  "android-dns-guard",
  "android-usage-access",
  "android-accessibility",
  "android-doomscroll-apps",
  "activation-test"
];
const androidProtectionFlowOrderString = androidProtectionFlowOrder.join(">");
const androidProtectionFlowDetails = [
  "android-native-adult-domain-feed: sync the reviewed adult-domain feed in FREED before OS permission prompts",
  "android-dns-guard: request Android VpnService consent for DNS-only adult-domain blocking",
  "android-usage-access: open Android Usage Access settings for aggregate selected-app timers",
  "android-accessibility: open the FREED Accessibility service details screen for browser and selected-app interruption",
  "android-doomscroll-apps: choose at least one supported app package and sync blocked-app config",
  "activation-test: verify adult-domain blocking, normal browsing allow behavior, and fresh native readiness before saving activation"
];

const expectedPreflightReportCheckIds = [
  "server-secret-public-leakage",
  "release-monetization-mode",
  "store-provider",
  "iap-product-ids",
  "purchase-verify-endpoint",
  "app-store-environment",
  "app-store-verification-credentials",
  "google-play-verification-credentials",
  "android-release-signing",
  "revenuecat-fallback-keys",
  "admob-app-ids",
  "admob-rewarded-units",
  "admob-test-ads-disabled",
  "admob-request-country",
  "ai-coach-mode",
  "ai-coach-endpoint",
  "ai-challenge-mode",
  "ai-challenge-endpoint",
  "adult-domain-feed-endpoint",
  "adult-domain-feed-sources",
  "supabase-backend-credentials",
  "redis-backend-infrastructure",
  "backend-readiness-endpoint",
  "remote-notification-provider-credentials",
  "optional-challenge-weather-context",
  "analytics-ingestion-endpoint",
  "optional-recovery-backup-sync-endpoint",
  "optional-supabase-auth-client",
  "optional-retention-endpoint",
  "server-ai-key"
];

const reportArtifactRequiredProofValues = {
  "preflight:release-env": [
    { path: "result", equals: "pass" },
    { path: "sanitized", equals: true }
  ],
  "build:android-apk:upload-signed": [
    { path: "sanitized", equals: true },
    { path: "buildResult", equals: "pass" },
    { path: "result", equals: "pass" },
    { path: "selectedEngine", equals: "hermes" },
    { path: "finalEngine", equals: "hermes" },
    { path: "signing.mode", equals: "upload-signing" },
    { path: "signing.playConsoleReady", equals: true },
    { path: "signing.required", equals: true },
    { path: "signing.uploadKeystore.checked", equals: true },
    { path: "signing.uploadKeystore.debugSigned", equals: false },
    { path: "signing.uploadKeystore.certificateSha256Digest", nonEmptyString: true },
    { path: "adMob.mode", equals: "production" },
    { path: "adMob.androidAppIdConfigured", equals: true },
    { path: "adMob.productionReady", equals: true },
    { path: "adMob.sampleAppIdUsed", equals: false },
    { path: "installHandoff.localInstallSupported", equals: true },
    { path: "installHandoff.playUploadArtifact", equals: false },
    { path: "installHandoff.handoffDocument", nonEmptyString: true },
    { path: "installHandoff.handoffDocumentWritten", equals: true },
    { path: "installHandoff.activationReadinessRule", nonEmptyString: true },
    { path: "installHandoff.protectionFlowDetails", includesAll: androidProtectionFlowDetails },
    { path: "installHandoff.protectionFlowOrder", includesAll: androidProtectionFlowOrder },
    { path: "installHandoff.protectionFlowOrderString", equals: androidProtectionFlowOrderString },
    { path: "installHandoff.installQaApk", nonEmptyString: true },
    { path: "installHandoff.installQaCommand", includesAll: ["npm", "run", "qa:android-install", "--apk", "--run-id", "--output-dir"] },
    { path: "installHandoff.installQaCommandString", nonEmptyString: true },
    { path: "installHandoff.protectionQaRunId", nonEmptyString: true },
    { path: "installHandoff.protectionQaOutputDir", nonEmptyString: true },
    { path: "installHandoff.protectionQaCommand", includesAll: ["npm", "run", "evidence:android-real-browser", "--device", "--adult-url", "--permission-proof", "--native-status-proof", "--dns-guard-proof", "--run-id", "--output-dir"] },
    { path: "installHandoff.protectionQaCommandString", nonEmptyString: true },
    { path: "apk.signature.verified", equals: true },
    { path: "apk.signature.debugSigned", equals: false },
    { path: "apk.signature.v2SchemeVerified", equals: true },
    { path: "apk.signature.numberOfSigners", numberBetween: [1, 10] },
    { path: "apk.signature.certificateSha256Digest", nonEmptyString: true },
    { path: "apk.hasHermesRuntime", equals: true },
    { path: "apk.hasJscRuntime", equals: false },
    { path: "apk.hasReactNativeBundle", equals: true },
    { path: "apk.abis", includesAll: ["arm64-v8a"] },
    { path: "apk.sha256", nonEmptyString: true },
    { path: "apk.sizeBytes", numberBetween: [1, 300_000_000] }
  ],
  "build:android-aab:upload-signed": [
    { path: "sanitized", equals: true },
    { path: "artifactType", equals: "aab" },
    { path: "buildResult", equals: "pass" },
    { path: "result", equals: "pass" },
    { path: "selectedEngine", equals: "hermes" },
    { path: "finalEngine", equals: "hermes" },
    { path: "signing.mode", equals: "upload-signing" },
    { path: "signing.playConsoleReady", equals: true },
    { path: "signing.required", equals: true },
    { path: "signing.uploadKeystore.checked", equals: true },
    { path: "signing.uploadKeystore.debugSigned", equals: false },
    { path: "signing.uploadKeystore.certificateSha256Digest", nonEmptyString: true },
    { path: "adMob.mode", equals: "production" },
    { path: "adMob.androidAppIdConfigured", equals: true },
    { path: "adMob.productionReady", equals: true },
    { path: "adMob.sampleAppIdUsed", equals: false },
    { path: "installHandoff.localInstallSupported", equals: false },
    { path: "installHandoff.playUploadArtifact", equals: true },
    { path: "installHandoff.handoffDocument", nonEmptyString: true },
    { path: "installHandoff.handoffDocumentWritten", equals: true },
    { path: "installHandoff.activationReadinessRule", nonEmptyString: true },
    { path: "installHandoff.protectionFlowDetails", includesAll: androidProtectionFlowDetails },
    { path: "installHandoff.protectionFlowOrder", includesAll: androidProtectionFlowOrder },
    { path: "installHandoff.protectionFlowOrderString", equals: androidProtectionFlowOrderString },
    { path: "installHandoff.note", nonEmptyString: true },
    { path: "aab.hasHermesRuntime", equals: true },
    { path: "aab.hasJscRuntime", equals: false },
    { path: "aab.hasReactNativeBundle", equals: true },
    { path: "aab.abis", includesAll: ["arm64-v8a"] },
    { path: "aab.sha256", nonEmptyString: true },
    { path: "aab.sizeBytes", numberBetween: [1, 300_000_000] }
  ],
  "build:ios-archive:release": [
    { path: "sanitized", equals: true },
    { path: "platform", equals: "ios" },
    { path: "result", equals: "pass" },
    { path: "archiveResult", equals: "pass" },
    { path: "exportResult", equals: "pass" },
    { path: "requested.requireReleaseSigning", equals: true },
    { path: "requested.bundleId", equals: "app.freed.recovery" },
    { path: "signing.required", equals: true },
    { path: "signing.mode", equals: "app-store-distribution" },
    { path: "signing.teamIdConfigured", equals: true },
    { path: "signing.appleDistributionSigned", equals: true },
    { path: "signing.debugSigned", equals: false },
    { path: "signing.allSignedBundleTeamIdsMatch", equals: true },
    { path: "exportOptions.method", equals: "app-store-connect" },
    { path: "exportOptions.teamIdConfigured", equals: true },
    { path: "archive.appBundleIdentifier", equals: "app.freed.recovery" },
    { path: "archive.embeddedExtensionBundleIds", includesAll: [
      "app.freed.recovery.shield-configuration",
      "app.freed.recovery.shield-action",
      "app.freed.recovery.device-activity-monitor",
      "app.freed.recovery.safari-content-blocker",
      "app.freed.recovery.safari-focus-shield"
    ] },
    { path: "archive.embeddedExtensionNames", includesAll: [
      "FREEDShieldConfiguration.appex",
      "FREEDShieldAction.appex",
      "FREEDDeviceActivityMonitor.appex",
      "FREEDSafariContentBlocker.appex",
      "FREEDSafariFocusShield.appex"
    ] },
    { path: "archive.familyControlsEntitledBundleIds", includesAll: [
      "app.freed.recovery",
      "app.freed.recovery.shield-configuration",
      "app.freed.recovery.shield-action",
      "app.freed.recovery.device-activity-monitor"
    ] },
    { path: "archive.appGroupEntitledBundleIds", includesAll: [
      "app.freed.recovery",
      "app.freed.recovery.shield-configuration",
      "app.freed.recovery.shield-action",
      "app.freed.recovery.device-activity-monitor",
      "app.freed.recovery.safari-content-blocker",
      "app.freed.recovery.safari-focus-shield"
    ] },
    { path: "archive.completeDataProtectionEntitledBundleIds", includesAll: [
      "app.freed.recovery",
      "app.freed.recovery.shield-configuration",
      "app.freed.recovery.shield-action",
      "app.freed.recovery.device-activity-monitor",
      "app.freed.recovery.safari-content-blocker",
      "app.freed.recovery.safari-focus-shield"
    ] },
    { path: "archive.packetTunnelProviderEntitled", equals: false },
    { path: "archive.packetInspectionEntitled", equals: false },
    { path: "archive.safariRuleList.usableForManualEvidence", equals: true },
    { path: "archive.safariRuleList.adultDomainRulesPresent", equals: true },
    { path: "archive.safariRuleList.allRulesBlock", equals: true },
    { path: "archive.safariRuleList.ruleCount", numberBetween: [1, 100_000] },
    { path: "archive.safariFocusShield.usableForManualEvidence", equals: true },
    { path: "archive.safariFocusShield.manifestVersion3", equals: true },
    { path: "archive.safariFocusShield.minimumSafariVersion", equals: "15.4" },
    { path: "archive.safariFocusShield.serviceWorker", equals: "background.js" },
    { path: "archive.safariFocusShield.backgroundOwnsNativeMessaging", equals: true },
    { path: "archive.safariFocusShield.backgroundServiceWorkerValid", equals: true },
    { path: "archive.safariFocusShield.contentScriptsScoped", equals: true },
    { path: "archive.safariFocusShield.contentUsesRuntimeMessaging", equals: true },
    { path: "archive.safariFocusShield.hostPermissionsScoped", equals: true },
    { path: "archive.safariFocusShield.infoAllowedDomainsScoped", equals: true },
    { path: "archive.safariFocusShield.nativeAppIdentifierValid", equals: true },
    { path: "archive.safariFocusShield.nativePayloadSchemaValid", equals: true },
    { path: "archive.safariFocusShield.nativeHandlerContractValid", equals: true },
    { path: "archive.safariFocusShield.minimumOSVersionAtLeast154", equals: true },
    { path: "ipa.exists", equals: true },
    { path: "ipa.hasPayloadApp", equals: true },
    { path: "ipa.embeddedExtensionNames", includesAll: [
      "FREEDShieldConfiguration.appex",
      "FREEDShieldAction.appex",
      "FREEDDeviceActivityMonitor.appex",
      "FREEDSafariContentBlocker.appex",
      "FREEDSafariFocusShield.appex"
    ] },
    { path: "ipa.sha256", nonEmptyString: true },
    { path: "ipa.sizeBytes", numberBetween: [1, 500_000_000] }
  ],
  "smoke:backend-readiness": [
    { path: "sanitized", equals: true },
    { path: "infrastructureProof.coreComponentsReady", equals: true },
    { path: "infrastructureProof.requiredComponentsReady", equals: true },
    { path: "infrastructureProof.cacheControlRequired", equals: "no-store" },
    { path: "infrastructureProof.privacyBoundary.returnsSecrets", equals: false },
    { path: "infrastructureProof.privacyBoundary.secretValuesOmitted", equals: true },
    { path: "infrastructureProof.privacyBoundary.serverOnlyKeyNamesChecked", includesAll: ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_TOKEN"] },
    { path: "infrastructureProof.dataBoundaryPhrasesChecked", includesAll: ["raw URLs", "purchase tokens"] },
    { path: "infrastructureProof.requestTimeoutMs", numberBetween: [500, 15_000] }
  ],
  "smoke:supabase-schema": [
    { path: "sanitized", equals: true },
    { path: "schemaBoundary.usesServiceRoleOnly", equals: true },
    { path: "schemaBoundary.verifiesPublicAnonLockout", equals: true },
    { path: "schemaBoundary.usesLimitZeroReads", equals: true },
    { path: "schemaBoundary.coreTableContractsChecked", equals: true },
    { path: "schemaBoundary.noRowPayloadsExpected", equals: true },
    { path: "schemaBoundary.noSecretEchoChecked", equals: true },
    { path: "schemaBoundary.tableContractIds", includesAll: ["analytics", "purchase-verification", "ai-backend-events"] },
    { path: "accessProof.serviceRoleKeyRequired", equals: true },
    { path: "accessProof.publicAnonKeyRequired", equals: true },
    { path: "accessProof.publicAnonUsedOnlyForLockout", equals: true },
    { path: "accessProof.noRowPayloadsExpected", equals: true },
    { path: "accessProof.secretValuesOmitted", equals: true },
    { path: "accessProof.credentialNamesRedacted", includesAll: ["SUPABASE_SERVICE_ROLE_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"] },
    { path: "accessProof.requestTimeoutMs", numberBetween: [500, 15_000] }
  ],
  "smoke:adult-domain-feed": [
    { path: "sanitized", equals: true },
    { path: "contractProof.endpointPathRequired", equals: "/api/adult-domain-feed" },
    { path: "contractProof.requestTimeoutMs", numberBetween: [50, 15_000] },
    { path: "contractProof.feedContract.maxFeedAgeHours", equals: 48 },
    { path: "contractProof.feedContract.readinessRequired", equals: true },
    { path: "contractProof.feedContract.headersRequired", includesAll: ["ETag", "X-FREED-Adult-Feed-Checksum", "X-FREED-Adult-Feed-Source-Max-Bytes"] },
    { path: "contractProof.feedContract.normalBrowsingDomainsChecked", includesAll: ["google.com", "youtube.com", "instagram.com"] },
    { path: "contractProof.syncProofs.feedJsonContractValidated", equals: true },
    { path: "contractProof.syncProofs.conditional304Validated", equals: true },
    { path: "contractProof.syncProofs.safariContentBlockerExportValidated", equals: true },
    { path: "contractProof.sourceReportBoundary.rawSourceUrlsWithQueryStringsOmitted", equals: true },
    { path: "contractProof.sourceReportBoundary.fullDomainListOmitted", equals: true },
    { path: "contractProof.responseBoundary.privateEchoPatternsChecked", numberBetween: [1, 100] },
    { path: "contractProof.responseBoundary.secretValuesOmitted", equals: true },
    { path: "contractProof.responseBoundary.serverSecretKeyNamesChecked", includesAll: ["FREED_ADULT_DOMAIN_FEED_SOURCE_URLS", "SUPABASE_SERVICE_ROLE_KEY"] }
  ],
  "smoke:analytics-ingestion": [
    { path: "sanitized", equals: true },
    { path: "contractProof.endpointPathRequired", equals: "/api/analytics" },
    { path: "contractProof.requestTimeoutMs", numberBetween: [250, 15_000] },
    { path: "contractProof.acceptedAggregateSnapshot.schemaVersion", equals: "aggregate-v5" },
    { path: "contractProof.acceptedAggregateSnapshot.aggregateOnly", equals: true },
    { path: "contractProof.acceptedAggregateSnapshot.privacyFlags.excludesPrivateNotes", equals: true },
    { path: "contractProof.acceptedAggregateSnapshot.privacyFlags.excludesBrowsingDetails", equals: true },
    { path: "contractProof.acceptedAggregateSnapshot.privacyFlags.excludesSupportContacts", equals: true },
    { path: "contractProof.rejectionProofs.incompleteProductionMetricsRejected", equals: true },
    { path: "contractProof.rejectionProofs.futureConsentTimestampRejected", equals: true },
    { path: "contractProof.rejectionProofs.futureSnapshotDateRejected", equals: true },
    { path: "contractProof.rejectionProofs.sensitivePayloadRejectedWithoutEcho", equals: true },
    { path: "contractProof.responseBoundary.snapshotEchoForbidden", equals: true },
    { path: "contractProof.responseBoundary.privateEchoPatternsChecked", numberBetween: [1, 100] },
    { path: "contractProof.responseBoundary.secretValuesOmitted", equals: true },
    { path: "contractProof.responseBoundary.serverSecretKeyNamesChecked", includesAll: ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_TOKEN"] },
    { path: "contractProof.responseBoundary.sensitiveFieldAliasesRejected", includesAll: ["private_notes", "rawURL", "purchase_token"] }
  ],
  "smoke:remote-notifications": [
    { path: "sanitized", equals: true },
    { path: "dispatchBoundary.sendsPush", equals: false },
    { path: "dispatchBoundary.requiresDispatchSecret", equals: true },
    { path: "dispatchBoundary.unauthorizedRejectionChecked", equals: true },
    { path: "dispatchBoundary.sensitivePayloadRejectionChecked", equals: true },
    { path: "dispatchBoundary.supportedKindAllowlistChecked", equals: true },
    { path: "contractProof.endpointPathRequired", equals: "/api/notifications/send" },
    { path: "contractProof.requestTimeoutMs", numberBetween: [500, 15_000] },
    { path: "contractProof.nonSendingSmoke", equals: true },
    { path: "contractProof.authorizationBoundary.requiresDispatchSecret", equals: true },
    { path: "contractProof.authorizationBoundary.unauthorizedRequestRejected", equals: true },
    { path: "contractProof.authorizationBoundary.dispatchSecretValuesOmitted", equals: true },
    { path: "contractProof.authorizationBoundary.authorizationHeaderNotStored", equals: true },
    { path: "contractProof.payloadBoundary.presetCopyServerSideOnly", equals: true },
    { path: "contractProof.payloadBoundary.clientSuppliedCopyRejected", equals: true },
    { path: "contractProof.payloadBoundary.supportedKindAllowlistRejectedUnknown", equals: true },
    { path: "contractProof.payloadBoundary.sensitiveFieldAliasesRejected", includesAll: ["title", "body", "url", "purchaseToken"] },
    { path: "contractProof.responseBoundary.providerCallsExpected", equals: false },
    { path: "contractProof.responseBoundary.deviceTokenEchoForbidden", equals: true },
    { path: "contractProof.responseBoundary.privateEchoPatternsChecked", numberBetween: [1, 100] },
    { path: "contractProof.responseBoundary.secretValuesOmitted", equals: true },
    { path: "contractProof.responseBoundary.serverSecretKeyNamesChecked", includesAll: ["REMOTE_NOTIFICATION_DISPATCH_SECRET", "FCM_SERVER_KEY"] }
  ],
  "smoke:ai-backend": [
    { path: "sanitized", equals: true },
    { path: "contractProof.endpointPathRequirements.coach", equals: "/api/clara" },
    { path: "contractProof.endpointPathRequirements.challenge", equals: "/api/challenges" },
    { path: "contractProof.endpointPathRequirements.retention", equals: "/api/retention" },
    { path: "contractProof.requestTimeoutMs.coach", numberBetween: [1_000, 12_000] },
    { path: "contractProof.requestTimeoutMs.challenge", numberBetween: [1_000, 12_000] },
    { path: "contractProof.configuredModelProof.configuredModelChecked", equals: true },
    { path: "contractProof.configuredModelProof.concreteProviderModelRequired", equals: true },
    { path: "contractProof.configuredModelProof.placeholderModelRejected", equals: true },
    { path: "contractProof.endpointProofs.claraEndpointChecked", equals: true },
    { path: "contractProof.endpointProofs.challengeEndpointChecked", equals: true },
    { path: "contractProof.endpointProofs.productionHttpsOnly", equals: true },
    { path: "contractProof.endpointProofs.endpointQueryStringsOmitted", equals: true },
    { path: "contractProof.personalizationProofs.challengePersonalizationProfilesChecked", equals: true },
    { path: "contractProof.personalizationProofs.contextSignalsChecked", equals: true },
    { path: "contractProof.personalizationProofs.aggregateRiskForecastChecked", equals: true },
    { path: "contractProof.personalizationProofs.sessionDurationBucketChecked", equals: true },
    { path: "contractProof.personalizationProofs.recentFailureCountChecked", equals: true },
    { path: "contractProof.personalizationProofs.noRawRiskDriversStored", equals: true },
    { path: "contractProof.privacyProofs.noSensitiveEchoChecked", equals: true },
    { path: "contractProof.privacyProofs.noCoordinateFieldsChecked", equals: true },
    { path: "contractProof.privacyProofs.rawPromptsOmitted", equals: true },
    { path: "contractProof.privacyProofs.unredactedModelResponsesOmitted", equals: true },
    { path: "contractProof.responseBoundary.privateEchoPatternsChecked", numberBetween: [1, 100] },
    { path: "contractProof.responseBoundary.secretValuesOmitted", equals: true },
    { path: "contractProof.responseBoundary.serverSecretKeyNamesChecked", includesAll: ["OPENAI_API_KEY", "GEMINI_API_KEY"] },
    { path: "contractProof.responseBoundary.redactedSensitiveFields", includesAll: ["urls", "domains", "privateNotes", "coordinateFields"] }
  ],
  "smoke:purchase-verification": [
    { path: "sanitized", equals: true },
    { path: "verificationBoundary.usesSyntheticPurchasePayloads", equals: true },
    { path: "verificationBoundary.unknownProductRejectionChecked", equals: true },
    { path: "verificationBoundary.fakeKnownTokenRejectionChecked", equals: true },
    { path: "verificationBoundary.fakeKnownTokenRejectionCheckedByPlan.yearly", equals: true },
    { path: "verificationBoundary.fakeKnownTokenRejectionCheckedByPlan.monthly", equals: true },
    { path: "verificationBoundary.fakeKnownTokenRejectionCheckedByPlan.lifetime", equals: true },
    { path: "verificationBoundary.malformedJsonRejectionChecked", equals: true },
    { path: "contractProof.endpointPathRequired", equals: "/api/purchases/verify" },
    { path: "contractProof.endpointValidated", equals: true },
    { path: "contractProof.requestTimeoutMs", numberBetween: [500, 15_000] },
    { path: "contractProof.syntheticOnly", equals: true },
    { path: "contractProof.rejectionProofs.unknownProductRejected", equals: true },
    { path: "contractProof.rejectionProofs.fakeKnownTokenRejected", equals: true },
    { path: "contractProof.rejectionProofs.fakeKnownTokenRejectedByPlan.yearly", equals: true },
    { path: "contractProof.rejectionProofs.fakeKnownTokenRejectedByPlan.monthly", equals: true },
    { path: "contractProof.rejectionProofs.fakeKnownTokenRejectedByPlan.lifetime", equals: true },
    { path: "contractProof.rejectionProofs.malformedJsonRejected", equals: true },
    { path: "contractProof.responseBoundary.rawTokenEchoRejected", equals: true },
    { path: "contractProof.responseBoundary.rawReceiptEchoRejected", equals: true },
    { path: "contractProof.responseBoundary.orderIdEchoRejected", equals: true },
    { path: "contractProof.responseBoundary.packageNameEchoRejected", equals: true },
    { path: "contractProof.responseBoundary.secretValuesOmitted", equals: true },
    { path: "contractProof.responseBoundary.serverSecretKeyNamesChecked", includesAll: ["APP_STORE_PRIVATE_KEY", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"] },
    { path: "contractProof.responseBoundary.redactedSensitiveFields", includesAll: ["purchaseToken", "receipt", "orderId", "packageName"] }
  ],
  "audit:release:strict": [
    { path: "sanitized", equals: true }
  ]
};

const expectedReleaseReadinessGateIds = [
  "prototype-design-files",
  "app-surface",
  "prompt-to-artifact-traceability",
  "release-verifier-command-sequence",
  "release-env-preflight-harness",
  "production-env-template",
  "store-launch-config",
  "store-legal-hosted-url-validation",
  "validation-evidence-workflow",
  "adult-only-classifier",
  "ios-screen-time-scaffold",
  "android-native-safety-contract",
  "challenge-verification-contract",
  "challenge-personalization-context",
  "optional-challenge-weather-context",
  "discipline-configuration-contract",
  "accessibility-safety-contract",
  "privacy-safety-contract",
  "runtime-data-integrity-contract",
  "backend-architecture-contract",
  "production-backend-infrastructure",
  "production-analytics-ingestion",
  "production-notification-backend",
  "production-adult-domain-feed",
  "production-android-signing",
  "dependency-security",
  "monetization-adapter-scaffold",
  "server-ai-routes",
  "ai-safety-eval-harness",
  "backend-readiness-smoke-harness",
  "supabase-schema-smoke-harness",
  "adult-domain-feed-smoke-harness",
  "analytics-ingestion-smoke-harness",
  "remote-notification-smoke-harness",
  "ai-backend-smoke-harness",
  "purchase-verification-smoke-harness",
  "client-bundle-secret-audit-harness",
  "production-monetization",
  "production-ai-backend",
  "ios-physical-device-validation",
  "android-real-browser-validation",
  "normal-browsing-corpus-validation",
  "performance-validation",
  "store-ad-sandbox-validation",
  "ai-backend-smoke-validation"
];

const secretShapedReportPatterns = [
  {
    label: "URL credentials",
    pattern: /https?:\/\/[^/\s"'<>:@]+:[^/\s"'<>@]+@/i
  },
  {
    label: "private key",
    pattern: /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/
  },
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/
  },
  {
    label: "Google OAuth access token",
    pattern: /\bya29\.[0-9A-Za-z._-]{20,}\b/
  },
  {
    label: "FCM server key",
    pattern: /\bAAAA[A-Za-z0-9:_-]{20,}\b/
  },
  {
    label: "device token",
    pattern: /\b(?:(?:fcm|apns)-token-[A-Za-z0-9._-]+|[A-Za-z0-9_-]{8,}:APA91[A-Za-z0-9_-]{20,})\b/i
  },
  {
    label: "bearer token",
    pattern: /\bBearer\s+(?!\[?redacted\b)[A-Za-z0-9._~:/+=-]{16,}\b/i
  },
  {
    label: "JWT",
    pattern: /\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/
  },
  {
    label: "raw secret parameter",
    pattern: /\b(?:token|secret|password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|receipt|purchaseToken)=(?!\[?redacted\b)[^"'\s,&}]+/i
  },
  {
    label: "local home path",
    pattern: /(?:^|["'\s])(?:\/(?:Users|home)\/[A-Za-z0-9._-]+\/[^\s"']*|[A-Za-z]:(?:\\\\)+Users(?:\\\\)+[^\\/"'\s]+(?:(?:\\\\)+[^"'\s]*)?)/i
  }
];

function parseArgs(argv) {
  const args = {
    artifactDir: null,
    envFile: process.env.FREED_RELEASE_ENV_FILE || null,
    list: false,
    selfTest: false
  };
  const nextValue = (option, index) => {
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${option}`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") {
      args.list = true;
    } else if (arg === "--self-test") {
      args.selfTest = true;
    } else if (arg === "--env-file") {
      args.envFile = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--env-file=")) {
      args.envFile = arg.slice("--env-file=".length);
      if (!args.envFile) throw new Error("Missing value for --env-file");
    } else if (arg === "--artifact-dir") {
      args.artifactDir = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--artifact-dir=")) {
      args.artifactDir = arg.slice("--artifact-dir=".length);
      if (!args.artifactDir) throw new Error("Missing value for --artifact-dir");
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function existingArtifactDirPathIssue(artifactRoot, absolute) {
  const rootStat = lstatOrNull(artifactRoot);
  if (!rootStat) return null;
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return "release artifact root must be a real docs/validation/artifacts directory";
  }

  let current = artifactRoot;
  for (const segment of relative(artifactRoot, absolute).split(/[\\/]+/)) {
    if (!segment) continue;
    current = resolve(current, segment);
    const stat = lstatOrNull(current);
    if (!stat) return null;
    if (stat.isSymbolicLink()) {
      return "release artifact directory must not include symbolic links";
    }
    if (!stat.isDirectory()) {
      return "release artifact directory existing path components must be directories";
    }
  }

  return null;
}

function artifactDirPathIssue(value) {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (
    !trimmed ||
    trimmed !== raw ||
    !/^[A-Za-z0-9._~/-]+$/.test(trimmed) ||
    normalized.startsWith("-") ||
    normalized.includes("://") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("todo") ||
    normalized.includes("<") ||
    normalized.includes(">")
  ) {
    return "release artifact directory must be a local workspace path without shell syntax, URLs, flags, or template placeholders";
  }

  const absolute = resolve(process.cwd(), trimmed);
  const relativePath = relative(process.cwd(), absolute);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return "release artifact directory must stay inside the current workspace";
  }

  const releaseEvidenceDir = resolve(process.cwd(), "docs/validation/evidence");
  if (isPathInsideOrSame(releaseEvidenceDir, absolute)) {
    return "release artifact directory must not be docs/validation/evidence; use docs/validation/artifacts/<run-id>";
  }

  const artifactRoot = resolve(process.cwd(), "docs/validation/artifacts");
  const artifactRelativePath = relative(artifactRoot, absolute);
  if (artifactRelativePath === "" || artifactRelativePath.startsWith("..") || isAbsolute(artifactRelativePath)) {
    return "release artifact directory must be under docs/validation/artifacts/<run-id>";
  }

  const existingPathIssue = existingArtifactDirPathIssue(artifactRoot, absolute);
  if (existingPathIssue) return existingPathIssue;

  return null;
}

function normalizeArtifactDir(value) {
  if (!value) return null;
  const issue = artifactDirPathIssue(value);
  if (issue) throw new Error(issue);
  return value.replace(/\/+$/, "");
}

function loadReleaseEnv(envFile) {
  if (!envFile) return { env: process.env, sourceLabel: "process.env", envFile: null };

  return {
    env: { ...process.env, ...loadEnvFile(envFile, "release env file"), FREED_RELEASE_ENV_FILE: envFile },
    sourceLabel: `${envFile} merged with process.env`,
    envFile
  };
}

function reportPathForScript(script, artifactDir) {
  const fileName = reportArtifactNames[script];
  return fileName && artifactDir ? `${artifactDir}/${fileName}` : null;
}

function removeExistingReportArtifact(script, artifactDir) {
  const reportPath = reportPathForScript(script, artifactDir);
  if (!reportPath) return;

  const absolute = resolve(process.cwd(), reportPath);
  if (!existsSync(absolute)) return;
  if (!statSync(absolute).isFile()) {
    throw new Error(`${script} expected report artifact path must be a file before cleanup: ${reportPath}`);
  }
  unlinkSync(absolute);
}

function scriptArgs(script, envFile, artifactDir) {
  const appArgs = [];
  if (envFileAwareScripts.has(script) && envFile) appArgs.push("--env-file", envFile);
  const reportPath = reportPathForScript(script, artifactDir);
  if (reportPath) appArgs.push("--report", reportPath);
  return appArgs.length > 0 ? ["run", script, "--", ...appArgs] : ["run", script];
}

function commandLabel(script, envFile, artifactDir) {
  return `npm ${scriptArgs(script, envFile, artifactDir).join(" ")}`;
}

function reportSummary(payload) {
  if (payload && typeof payload.summary === "object" && payload.summary !== null) {
    return payload.summary;
  }
  return payload;
}

function isIsoUtcTimestamp(value) {
  if (typeof value !== "string" || !ISO_UTC_TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertGeneratedAt(payload, label, reportPath, options = {}) {
  if (!isIsoUtcTimestamp(payload.generatedAt)) {
    throw new Error(`${label} report artifact must include ISO generatedAt: ${reportPath}`);
  }
  const generatedAtMs = Date.parse(payload.generatedAt);
  if (typeof options.minGeneratedAtMs === "number" && generatedAtMs + REPORT_CURRENT_RUN_TOLERANCE_MS < options.minGeneratedAtMs) {
    throw new Error(`${label} report artifact generatedAt must be from the current verifier run: ${reportPath}`);
  }
  if (generatedAtMs > Date.now() + REPORT_FUTURE_SKEW_MS) {
    throw new Error(`${label} report artifact generatedAt must not be in the future: ${reportPath}`);
  }
}

function assertReportFileFresh(stat, label, reportPath, options = {}) {
  if (typeof options.minModifiedAtMs === "number" && stat.mtimeMs + REPORT_CURRENT_RUN_TOLERANCE_MS < options.minModifiedAtMs) {
    throw new Error(`${label} report artifact file must be written by the current verifier run: ${reportPath}`);
  }
}

function reportSecretShapeIssue(rawText) {
  for (const entry of secretShapedReportPatterns) {
    if (entry.pattern.test(rawText)) return entry.label;
  }
  return null;
}

function valueAtReportPath(payload, path) {
  return path.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return current[segment];
  }, payload);
}

function expectedValueLabel(value) {
  return JSON.stringify(value);
}

function hasConfiguredEnvValue(env, key) {
  return typeof env?.[key] === "string" && env[key].trim().length > 0;
}

function configuredEnvValue(env, key) {
  return typeof env?.[key] === "string" && env[key].trim() ? env[key].trim() : null;
}

function launchProductIdsFromEnv(env) {
  return Object.fromEntries(
    launchPremiumPlanIds.map((planId) => {
      const [publicKey, serverKey] = launchProductEnvKeys[planId];
      return [planId, configuredEnvValue(env, publicKey) ?? configuredEnvValue(env, serverKey) ?? defaultLaunchProductIds[planId]];
    })
  );
}

function aiRetentionSmokeRequired(payload, env) {
  return hasConfiguredEnvValue(env, "EXPO_PUBLIC_RETENTION_ENDPOINT") || typeof valueAtReportPath(payload, "endpoints.retention") === "string";
}

function conditionalRequiredResultIds(payload, script, env) {
  if (script === "smoke:ai-backend" && aiRetentionSmokeRequired(payload, env)) {
    return ["retention-remote-endpoint"];
  }
  return [];
}

function conditionalRequiredProofValues(payload, script, env) {
  if (script === "smoke:ai-backend" && aiRetentionSmokeRequired(payload, env)) {
    return [
      { path: "endpoints.retention", nonEmptyString: true },
      { path: "aiBoundary.retentionEndpointConfigured", equals: true },
      { path: "aiBoundary.retentionEndpointChecked", equals: true },
      { path: "aiBoundary.retentionAggregateOnlyChecked", equals: true },
      { path: "contractProof.requestTimeoutMs.retention", numberBetween: [1_000, 12_000] },
      { path: "contractProof.endpointProofs.retentionEndpointConfigured", equals: true },
      { path: "contractProof.endpointProofs.retentionEndpointChecked", equals: true },
      { path: "contractProof.privacyProofs.retentionAggregateOnlyChecked", equals: true }
    ];
  }
  if (script === "smoke:purchase-verification") {
    const launchProductIds = launchProductIdsFromEnv(env);
    return launchPremiumPlanIds.flatMap((planId) => [
      { path: `verificationBoundary.launchProductIdsChecked.${planId}`, equals: launchProductIds[planId] },
      { path: `contractProof.launchProductIdsChecked.${planId}`, equals: launchProductIds[planId] }
    ]);
  }
  return [];
}

function assertReportProofValues(payload, script, reportPath, env = process.env) {
  const expectations = [
    ...(reportArtifactRequiredProofValues[script] ?? []),
    ...conditionalRequiredProofValues(payload, script, env)
  ];
  for (const expectation of expectations) {
    const actual = valueAtReportPath(payload, expectation.path);
    if (Object.prototype.hasOwnProperty.call(expectation, "equals") && actual !== expectation.equals) {
      throw new Error(
        `${script} report artifact ${expectation.path} must equal ${expectedValueLabel(expectation.equals)}: ${reportPath}`
      );
    }
    if (expectation.nonEmptyString && (typeof actual !== "string" || !actual.trim())) {
      throw new Error(`${script} report artifact ${expectation.path} must be a non-empty string: ${reportPath}`);
    }
    if (expectation.includesAll) {
      if (!Array.isArray(actual)) {
        throw new Error(`${script} report artifact ${expectation.path} must include ${expectation.includesAll.join(", ")}: ${reportPath}`);
      }
      for (const expectedEntry of expectation.includesAll) {
        if (!actual.includes(expectedEntry)) {
          throw new Error(`${script} report artifact ${expectation.path} must include ${expectedEntry}: ${reportPath}`);
        }
      }
    }
    if (expectation.numberBetween) {
      const [min, max] = expectation.numberBetween;
      if (typeof actual !== "number" || !Number.isFinite(actual) || actual < min || actual > max) {
        throw new Error(`${script} report artifact ${expectation.path} must be a number between ${min} and ${max}: ${reportPath}`);
      }
    }
  }
}

function assertStringArrayMatches(actual, expected, label, reportPath) {
  if (!Array.isArray(actual)) {
    throw new Error(`preflight:release-env report artifact ${label} must be an array: ${reportPath}`);
  }
  for (const expectedEntry of expected) {
    if (!actual.includes(expectedEntry)) {
      throw new Error(`preflight:release-env report artifact ${label} must include ${expectedEntry}: ${reportPath}`);
    }
  }
  for (const actualEntry of actual) {
    if (!expected.includes(actualEntry)) {
      throw new Error(`preflight:release-env report artifact ${label} has unexpected ${actualEntry}: ${reportPath}`);
    }
  }
}

function assertPreflightBlockerGroups(payload, reportPath) {
  const expectedGroups = productionBlockerGroups(dirname(reportPath));
  const groups = payload.blockerGroups;
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error(`preflight:release-env report artifact must include non-empty blockerGroups: ${reportPath}`);
  }

  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  const checksById = new Map();
  let computedFailCount = 0;
  let computedPassCount = 0;
  for (const entry of checks) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id) {
      throw new Error(`preflight:release-env report artifact checks must include string ids: ${reportPath}`);
    }
    if (!["pass", "fail"].includes(entry.status)) {
      throw new Error(`preflight:release-env report artifact checks.${entry.id} must include pass/fail status: ${reportPath}`);
    }
    if (checksById.has(entry.id)) {
      throw new Error(`preflight:release-env report artifact checks must not repeat ${entry.id}: ${reportPath}`);
    }
    checksById.set(entry.id, entry);
    if (entry.status === "fail") computedFailCount += 1;
    if (entry.status === "pass") computedPassCount += 1;
  }
  if (payload.failCount !== computedFailCount || payload.passCount !== computedPassCount) {
    throw new Error(`preflight:release-env report artifact pass/fail counts must match checks: ${reportPath}`);
  }
  const expectedPreflightCheckIdSet = new Set(expectedPreflightReportCheckIds);
  for (const expectedCheckId of expectedPreflightReportCheckIds) {
    if (!checksById.has(expectedCheckId)) {
      throw new Error(`preflight:release-env report artifact checks must include preflight check ${expectedCheckId}: ${reportPath}`);
    }
  }
  for (const actualCheckId of checksById.keys()) {
    if (!expectedPreflightCheckIdSet.has(actualCheckId)) {
      throw new Error(`preflight:release-env report artifact checks include unexpected preflight check ${actualCheckId}: ${reportPath}`);
    }
  }

  for (const expectedGroup of expectedGroups) {
    const group = groups.find((candidate) => candidate && typeof candidate === "object" && candidate.id === expectedGroup.id);
    if (!group) {
      throw new Error(`preflight:release-env report artifact blockerGroups must include ${expectedGroup.id}: ${reportPath}`);
    }
    const expectedCheckIds = expectedGroup.preflightCheckIds ?? [];
    const expectedCheckIdSet = new Set(expectedCheckIds);
    if (!["pass", "fail", "external"].includes(group.status)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id} must include a valid status: ${reportPath}`);
    }
    if (group.category !== expectedGroup.category) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id} category must be ${expectedGroup.category}: ${reportPath}`);
    }
    assertStringArrayMatches(
      group.requiredEnv,
      expectedGroup.requiredEnv ?? [],
      `blockerGroups.${expectedGroup.id}.requiredEnv`,
      reportPath
    );
    assertStringArrayMatches(
      group.requiredReports,
      expectedGroup.requiredReports ?? [],
      `blockerGroups.${expectedGroup.id}.requiredReports`,
      reportPath
    );
    if ((group.evidenceFile ?? null) !== (expectedGroup.evidenceFile ?? null)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id}.evidenceFile must match the release blocker group: ${reportPath}`);
    }
    if ((group.captureHelperCommand ?? null) !== (expectedGroup.captureHelperCommand ?? null)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id}.captureHelperCommand must match the release blocker group: ${reportPath}`);
    }
    if (!Array.isArray(group.failedPreflightChecks)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id} must include failedPreflightChecks: ${reportPath}`);
    }
    if (!Array.isArray(group.preflightCheckIds)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id} must include preflightCheckIds: ${reportPath}`);
    }
    if (!Array.isArray(group.missingPreflightCheckIds)) {
      throw new Error(`preflight:release-env report artifact blockerGroups.${expectedGroup.id} must include missingPreflightCheckIds: ${reportPath}`);
    }
    for (const expectedCheckId of expectedCheckIds) {
      if (!group.preflightCheckIds.includes(expectedCheckId)) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must include preflight check ${expectedCheckId}: ${reportPath}`
        );
      }
      if (!checksById.has(expectedCheckId)) {
        throw new Error(
          `preflight:release-env report artifact checks must include ${expectedCheckId} for blockerGroups.${expectedGroup.id}: ${reportPath}`
        );
      }
    }
    for (const actualCheckId of group.preflightCheckIds) {
      if (!expectedCheckIdSet.has(actualCheckId)) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} has unexpected preflight check ${actualCheckId}: ${reportPath}`
        );
      }
    }
    if (group.missingPreflightCheckIds.length > 0) {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must not have missingPreflightCheckIds: ${reportPath}`
      );
    }
    if (group.status === "external" && (expectedGroup.category === "production-env" || expectedCheckIds.length > 0)) {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} can only be external when no preflight checks apply: ${reportPath}`
      );
    }
    if (expectedCheckIds.length === 0) {
      if (group.status !== "external") {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must be external because no preflight checks apply: ${reportPath}`
        );
      }
      if (group.failedPreflightChecks.length > 0 || group.preflightCheckIds.length > 0) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must not include preflight failures: ${reportPath}`
        );
      }
      continue;
    }

    const failedEntryIds = new Set();
    for (const failedEntry of group.failedPreflightChecks) {
      if (!failedEntry || typeof failedEntry !== "object" || typeof failedEntry.id !== "string" || !failedEntry.id) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} failedPreflightChecks must include string ids: ${reportPath}`
        );
      }
      if (failedEntryIds.has(failedEntry.id)) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} failedPreflightChecks must not repeat ${failedEntry.id}: ${reportPath}`
        );
      }
      failedEntryIds.add(failedEntry.id);
      if (!expectedCheckIdSet.has(failedEntry.id)) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} failedPreflightChecks must belong to its preflightCheckIds: ${reportPath}`
        );
      }
      if (checksById.get(failedEntry.id)?.status !== "fail") {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} failedPreflightChecks must match failed checks: ${reportPath}`
        );
      }
    }

    const failedExpectedCheckIds = expectedCheckIds.filter((id) => checksById.get(id)?.status === "fail");
    for (const failedExpectedCheckId of failedExpectedCheckIds) {
      if (!failedEntryIds.has(failedExpectedCheckId)) {
        throw new Error(
          `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must list failed preflight check ${failedExpectedCheckId}: ${reportPath}`
        );
      }
    }
    if (group.status === "pass" && failedEntryIds.size > 0) {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} pass status must not include failedPreflightChecks: ${reportPath}`
      );
    }
    if (group.status === "fail" && failedEntryIds.size === 0) {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} fail status must include failedPreflightChecks: ${reportPath}`
      );
    }
    if ((group.status === "pass" && failedExpectedCheckIds.length > 0) || (group.status === "fail" && failedExpectedCheckIds.length === 0)) {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} status must match failed preflight checks: ${reportPath}`
      );
    }
    if (payload.failCount === 0 && group.status !== "pass") {
      throw new Error(
        `preflight:release-env report artifact blockerGroups.${expectedGroup.id} must pass when failCount is zero: ${reportPath}`
      );
    }
  }
}

function assertHostedLegalReport(payload, reportPath) {
  if (payload.result !== "pass") {
    throw new Error(`audit:store-legal-hosted report artifact result must be pass: ${reportPath}`);
  }
  if (payload.sanitized !== true) {
    throw new Error(`audit:store-legal-hosted report artifact must be sanitized: ${reportPath}`);
  }
  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  const checksById = new Map();
  let passCount = 0;
  let failCount = 0;
  for (const entry of checks) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id) {
      throw new Error(`audit:store-legal-hosted report artifact checks must include string ids: ${reportPath}`);
    }
    if (!["pass", "fail"].includes(entry.status)) {
      throw new Error(`audit:store-legal-hosted report artifact checks.${entry.id} must include pass/fail status: ${reportPath}`);
    }
    if (checksById.has(entry.id)) {
      throw new Error(`audit:store-legal-hosted report artifact checks must not repeat ${entry.id}: ${reportPath}`);
    }
    checksById.set(entry.id, entry);
    if (entry.status === "pass") passCount += 1;
    if (entry.status === "fail") failCount += 1;
  }
  if (payload.passCount !== passCount || payload.failCount !== failCount) {
    throw new Error(`audit:store-legal-hosted report artifact pass/fail counts must match checks: ${reportPath}`);
  }
  for (const requiredCheckId of hostedLegalRequiredCheckIds) {
    const check = checksById.get(requiredCheckId);
    if (!check) {
      throw new Error(`audit:store-legal-hosted report artifact must include hosted check ${requiredCheckId}: ${reportPath}`);
    }
    if (check.status !== "pass") {
      throw new Error(`audit:store-legal-hosted report artifact hosted check ${requiredCheckId} must pass: ${reportPath}`);
    }
  }
  const publicUrls = payload.publicUrls && typeof payload.publicUrls === "object" ? payload.publicUrls : {};
  const routeResults = Array.isArray(payload.routeResults) ? payload.routeResults : [];
  if (routeResults.length !== hostedLegalRouteIds.length) {
    throw new Error(`audit:store-legal-hosted report artifact must include routeResults for every hosted legal page: ${reportPath}`);
  }
  for (const routeId of hostedLegalRouteIds) {
    const publicUrl = publicUrls[routeId];
    if (typeof publicUrl !== "string" || !publicUrl.startsWith("https://freedrecovery.app/")) {
      throw new Error(`audit:store-legal-hosted report artifact publicUrls.${routeId} must be a FREED HTTPS URL: ${reportPath}`);
    }
    const route = routeResults.find((entry) => entry && typeof entry === "object" && entry.id === routeId);
    if (!route || typeof route.status !== "number" || route.status < 200 || route.status >= 300) {
      throw new Error(`audit:store-legal-hosted report artifact routeResults.${routeId} must include a 2xx route result: ${reportPath}`);
    }
    if (typeof route.finalUrl !== "string" || !route.finalUrl.startsWith(publicUrl)) {
      throw new Error(`audit:store-legal-hosted report artifact routeResults.${routeId}.finalUrl must stay on the public legal URL: ${reportPath}`);
    }
  }
}

function assertReleaseReadinessReport(payload, reportPath) {
  const summary = reportSummary(payload);
  if (payload.strict !== true) {
    throw new Error(`audit:release:strict report artifact must be strict: ${reportPath}`);
  }
  assertGeneratedAt(payload, "audit:release:strict", reportPath);

  const results = payload.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`audit:release:strict report artifact must include non-empty results: ${reportPath}`);
  }

  const counts = { pass: 0, warn: 0, fail: 0 };
  const resultsById = new Map();
  for (const entry of results) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id) {
      throw new Error(`audit:release:strict report artifact results must include string ids: ${reportPath}`);
    }
    if (!["pass", "warn", "fail"].includes(entry.status)) {
      throw new Error(`audit:release:strict report artifact results.${entry.id} must include pass/warn/fail status: ${reportPath}`);
    }
    if (resultsById.has(entry.id)) {
      throw new Error(`audit:release:strict report artifact results must not repeat ${entry.id}: ${reportPath}`);
    }
    if (typeof entry.evidence !== "string" || !entry.evidence.trim()) {
      throw new Error(`audit:release:strict report artifact results.${entry.id} must include evidence: ${reportPath}`);
    }
    if (typeof entry.next !== "string") {
      throw new Error(`audit:release:strict report artifact results.${entry.id} must include next: ${reportPath}`);
    }
    counts[entry.status] += 1;
    resultsById.set(entry.id, entry);
  }

  const expectedGateIds = new Set(expectedReleaseReadinessGateIds);
  for (const actualGateId of resultsById.keys()) {
    if (!expectedGateIds.has(actualGateId)) {
      throw new Error(`audit:release:strict report artifact includes unexpected release readiness gate ${actualGateId}: ${reportPath}`);
    }
  }
  if (
    summary.passCount !== counts.pass ||
    summary.warnCount !== counts.warn ||
    summary.failCount !== counts.fail
  ) {
    throw new Error(`audit:release:strict report artifact pass/warn/fail counts must match results: ${reportPath}`);
  }
  if (summary.warnCount !== 0) {
    throw new Error(`audit:release:strict report artifact must have warnCount=0: ${reportPath}`);
  }

  for (const expectedGateId of expectedReleaseReadinessGateIds) {
    const result = resultsById.get(expectedGateId);
    if (!result) {
      throw new Error(`audit:release:strict report artifact must include release readiness gate ${expectedGateId}: ${reportPath}`);
    }
    if (result.status !== "pass") {
      throw new Error(`audit:release:strict report artifact release readiness gate ${expectedGateId} must pass: ${reportPath}`);
    }
  }
}

function assertPassFailResults(payload, script, reportPath, env = process.env) {
  const summary = reportSummary(payload);
  const results = payload.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`${script} report artifact must include non-empty results: ${reportPath}`);
  }

  const resultsById = new Map();
  let passCount = 0;
  let failCount = 0;
  for (const entry of results) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id) {
      throw new Error(`${script} report artifact results must include string ids: ${reportPath}`);
    }
    if (!["PASS", "FAIL"].includes(entry.status)) {
      throw new Error(`${script} report artifact results.${entry.id} must include PASS/FAIL status: ${reportPath}`);
    }
    if (resultsById.has(entry.id)) {
      throw new Error(`${script} report artifact results must not repeat ${entry.id}: ${reportPath}`);
    }
    if (typeof entry.detail !== "string" || !entry.detail.trim()) {
      throw new Error(`${script} report artifact results.${entry.id} must include detail: ${reportPath}`);
    }
    resultsById.set(entry.id, entry);
    if (entry.status === "PASS") passCount += 1;
    if (entry.status === "FAIL") failCount += 1;
  }
  if (summary.passCount !== passCount || summary.failCount !== failCount) {
    throw new Error(`${script} report artifact pass/fail counts must match results: ${reportPath}`);
  }
  const requiredResultIds = [
    ...(reportArtifactRequiredResultIds[script] ?? []),
    ...conditionalRequiredResultIds(payload, script, env)
  ];
  for (const requiredResultId of requiredResultIds) {
    const result = resultsById.get(requiredResultId);
    if (!result) {
      throw new Error(`${script} report artifact must include required result ${requiredResultId}: ${reportPath}`);
    }
    if (result.status !== "PASS") {
      throw new Error(`${script} report artifact required result ${requiredResultId} must pass: ${reportPath}`);
    }
  }
}

function assertReportArtifact(script, artifactDir, env = process.env, options = {}) {
  const reportPath = reportPathForScript(script, artifactDir);
  if (!reportPath) return;

  const schema = reportArtifactSchemas[script];
  if (!schema) throw new Error(`No report schema registered for ${script}.`);

  const absolute = resolve(process.cwd(), reportPath);
  if (!existsSync(absolute)) {
    throw new Error(`${script} did not write expected sanitized report artifact: ${reportPath}`);
  }
  const reportStat = statSync(absolute);
  assertReportFileFresh(reportStat, script, reportPath, options);

  let payload;
  let rawText;
  try {
    rawText = readFileSync(absolute, "utf8");
    payload = JSON.parse(rawText);
  } catch {
    throw new Error(`${script} wrote a malformed JSON report artifact: ${reportPath}`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${script} report artifact must contain a JSON object: ${reportPath}`);
  }

  if (payload[schema.field] !== schema.value) {
    throw new Error(`${script} report artifact schema must be ${schema.value}: ${reportPath}`);
  }
  assertGeneratedAt(payload, script, reportPath, options);

  const summary = reportSummary(payload);
  if (!summary || typeof summary !== "object") {
    throw new Error(`${script} report artifact must include pass/fail counts: ${reportPath}`);
  }
  if (summary.failCount !== 0) {
    throw new Error(`${script} report artifact must have failCount=0: ${reportPath}`);
  }
  if (typeof summary.passCount !== "number" || summary.passCount <= 0) {
    throw new Error(`${script} report artifact must include a positive passCount: ${reportPath}`);
  }

  const rowsField = schema.rowsField ?? "results";
  if (!Array.isArray(payload[rowsField]) || payload[rowsField].length === 0) {
    throw new Error(`${script} report artifact must include non-empty ${rowsField}: ${reportPath}`);
  }

  if (schema.proofField && (!payload[schema.proofField] || typeof payload[schema.proofField] !== "object")) {
    throw new Error(`${script} report artifact must include ${schema.proofField}: ${reportPath}`);
  }
  assertReportProofValues(payload, script, reportPath, env);
  for (const field of schema.requiredArrayFields ?? []) {
    if (!Array.isArray(payload[field]) || payload[field].length === 0) {
      throw new Error(`${script} report artifact must include non-empty ${field}: ${reportPath}`);
    }
  }
  if (script === "preflight:release-env") {
    assertPreflightBlockerGroups(payload, reportPath);
  }
  if (script === "audit:store-legal-hosted") {
    assertHostedLegalReport(payload, reportPath);
  }
  if (script === "audit:release:strict") {
    assertReleaseReadinessReport(payload, reportPath);
  }
  if (!schema.rowsField && script !== "audit:release:strict") {
    assertPassFailResults(payload, script, reportPath, env);
  }

  const secretIssue = reportSecretShapeIssue(rawText);
  if (secretIssue) {
    throw new Error(`${script} report artifact must not contain secret-shaped ${secretIssue} values: ${reportPath}`);
  }
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function ensureObjectAtReportPath(payload, path) {
  const segments = path.split(".");
  const finalSegment = segments.pop();
  let current = payload;
  for (const segment of segments) {
    if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  }
  return { parent: current, finalSegment };
}

function setReportPathValue(payload, path, value) {
  const { parent, finalSegment } = ensureObjectAtReportPath(payload, path);
  parent[finalSegment] = value;
}

function applyProofExpectationsToSample(payload, script) {
  const expectations = [
    ...(reportArtifactRequiredProofValues[script] ?? []),
    ...conditionalRequiredProofValues(payload, script, process.env)
  ];
  for (const expectation of expectations) {
    if (Object.prototype.hasOwnProperty.call(expectation, "equals")) {
      setReportPathValue(payload, expectation.path, expectation.equals);
    }
    if (expectation.includesAll) {
      const existing = valueAtReportPath(payload, expectation.path);
      const nextValue = Array.isArray(existing) ? [...existing] : [];
      for (const entry of expectation.includesAll) {
        if (!nextValue.includes(entry)) nextValue.push(entry);
      }
      setReportPathValue(payload, expectation.path, nextValue);
    }
    if (expectation.numberBetween) {
      const existing = valueAtReportPath(payload, expectation.path);
      if (typeof existing !== "number" || !Number.isFinite(existing)) {
        const [min, max] = expectation.numberBetween;
        setReportPathValue(payload, expectation.path, Math.round((min + max) / 2));
      }
    }
    if (expectation.nonEmptyString) {
      const existing = valueAtReportPath(payload, expectation.path);
      if (typeof existing !== "string" || !existing.trim()) {
        setReportPathValue(payload, expectation.path, "synthetic-sanitized-proof");
      }
    }
  }
}

function sampleReportPayload(script, reportPath = null) {
  const schema = reportArtifactSchemas[script];
  if (!schema) throw new Error(`No report schema registered for ${script}.`);

  if (script === "audit:release:strict") {
    return {
      [schema.field]: schema.value,
      generatedAt: new Date().toISOString(),
      sanitized: true,
      strict: true,
      summary: {
        passCount: expectedReleaseReadinessGateIds.length,
        warnCount: 0,
        failCount: 0
      },
      results: expectedReleaseReadinessGateIds.map((id) => ({
        id,
        status: "pass",
        evidence: "synthetic sanitized release readiness proof accepted",
        next: ""
      }))
    };
  }

  if (script === "audit:store-legal-hosted") {
    return {
      [schema.field]: schema.value,
      generatedAt: new Date().toISOString(),
      sanitized: true,
      result: "pass",
      passCount: hostedLegalRequiredCheckIds.length,
      failCount: 0,
      publicUrls: {
        privacy: "https://freedrecovery.app/privacy",
        support: "https://freedrecovery.app/support",
        "account-deletion": "https://freedrecovery.app/account-deletion"
      },
      routeResults: hostedLegalRouteIds.map((id) => ({
        id,
        status: 200,
        finalUrl: id === "account-deletion" ? "https://freedrecovery.app/account-deletion" : `https://freedrecovery.app/${id}`,
        contentType: "text/html; charset=utf-8",
        sizeBytes: 4096
      })),
      checks: hostedLegalRequiredCheckIds.map((id) => ({
        id,
        status: "pass",
        detail: "synthetic sanitized hosted URL proof accepted"
      }))
    };
  }

  if (schema.rowsField === "checks") {
    const blockerGroups = productionBlockerGroups(reportPath ? dirname(reportPath) : undefined);
    return {
      [schema.field]: schema.value,
      generatedAt: new Date().toISOString(),
      result: "pass",
      sanitized: true,
      passCount: expectedPreflightReportCheckIds.length,
      failCount: 0,
      checks: expectedPreflightReportCheckIds.map((id) => ({
        id,
        status: "pass",
        detail: "synthetic sanitized report accepted"
      })),
      blockerGroups: blockerGroups.map((group) => ({
        id: group.id,
        category: group.category,
        status: group.preflightCheckIds?.length ? "pass" : "external",
        requiredEnv: group.requiredEnv ?? [],
        requiredReports: group.requiredReports ?? [],
        captureHelperCommand: group.captureHelperCommand ?? null,
        evidenceFile: group.evidenceFile ?? null,
        preflightCheckIds: group.preflightCheckIds ?? [],
        missingPreflightCheckIds: [],
        failedPreflightChecks: []
      }))
    };
  }

  const payload = {
    [schema.field]: schema.value,
    generatedAt: new Date().toISOString(),
    summary: {
      passCount: (reportArtifactRequiredResultIds[script] ?? ["release-verifier-self-test"]).length,
      failCount: 0
    },
    results: (reportArtifactRequiredResultIds[script] ?? ["release-verifier-self-test"]).map((id) => ({
      id,
      status: "PASS",
      detail: "synthetic sanitized report accepted"
    }))
  };
  if (schema.proofField) {
    payload[schema.proofField] = {
      selfTest: true
    };
  }
  applyProofExpectationsToSample(payload, script);
  return payload;
}

function assertThrows(fn, pattern) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (pattern.test(message)) return;
    throw new Error(`Expected ${pattern} but received: ${message}`);
  }
  throw new Error(`Expected ${pattern} to throw.`);
}

function runSelfTest() {
  const artifactDir = `docs/validation/artifacts/release-verifier-self-test-${Date.now()}`;
  const absoluteArtifactDir = resolve(process.cwd(), artifactDir);

  try {
    for (const script of Object.keys(reportArtifactNames)) {
      const reportPath = reportPathForScript(script, artifactDir);
      writeJson(resolve(process.cwd(), reportPath), sampleReportPayload(script, reportPath));
      assertReportArtifact(script, artifactDir);
    }

    assertThrows(
      () => assertReportArtifact("smoke:ai-backend", `docs/validation/artifacts/release-verifier-missing-${Date.now()}`),
      /did not write expected sanitized report artifact/
    );

    const aiReportPath = resolve(process.cwd(), reportPathForScript("smoke:ai-backend", artifactDir));
    writeFileSync(aiReportPath, "{not-json");
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /malformed JSON/);

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      summary: { passCount: 1, failCount: 1 }
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /failCount=0/);

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      schemaVersion: "wrong-schema"
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /schema must be ai-backend-smoke-v1/);

    const missingGeneratedAtPayload = sampleReportPayload("smoke:backend-readiness");
    delete missingGeneratedAtPayload.generatedAt;
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:backend-readiness", artifactDir)), missingGeneratedAtPayload);
    assertThrows(() => assertReportArtifact("smoke:backend-readiness", artifactDir), /must include ISO generatedAt/);

    const looseGeneratedAtPayload = sampleReportPayload("smoke:backend-readiness");
    looseGeneratedAtPayload.generatedAt = "May 23, 2026";
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:backend-readiness", artifactDir)), looseGeneratedAtPayload);
    assertThrows(() => assertReportArtifact("smoke:backend-readiness", artifactDir), /must include ISO generatedAt/);

    const staleGeneratedAtPayload = sampleReportPayload("smoke:supabase-schema");
    staleGeneratedAtPayload.generatedAt = new Date(Date.now() - 60_000).toISOString();
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:supabase-schema", artifactDir)), staleGeneratedAtPayload);
    assertThrows(
      () => assertReportArtifact("smoke:supabase-schema", artifactDir, process.env, { minGeneratedAtMs: Date.now() }),
      /generatedAt must be from the current verifier run/
    );

    writeJson(resolve(process.cwd(), reportPathForScript("smoke:supabase-schema", artifactDir)), sampleReportPayload("smoke:supabase-schema"));
    assertThrows(
      () => assertReportArtifact("smoke:supabase-schema", artifactDir, process.env, { minModifiedAtMs: Date.now() + 60_000 }),
      /file must be written by the current verifier run/
    );

    const removableReportPath = resolve(process.cwd(), reportPathForScript("smoke:remote-notifications", artifactDir));
    writeJson(removableReportPath, sampleReportPayload("smoke:remote-notifications"));
    if (!existsSync(removableReportPath)) {
      throw new Error("Expected stale report artifact cleanup self-test fixture to exist.");
    }
    removeExistingReportArtifact("smoke:remote-notifications", artifactDir);
    if (existsSync(removableReportPath)) {
      throw new Error("Expected stale report artifact cleanup to remove the previous report.");
    }
    removeExistingReportArtifact("typecheck", artifactDir);
    removeExistingReportArtifact("smoke:remote-notifications", artifactDir);

    const missingProofPayload = sampleReportPayload("smoke:ai-backend");
    delete missingProofPayload.contractProof;
    writeJson(aiReportPath, missingProofPayload);
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /contractProof/);

    const weakProofPayload = sampleReportPayload("smoke:ai-backend");
    weakProofPayload.contractProof.endpointProofs.claraEndpointChecked = false;
    writeJson(aiReportPath, weakProofPayload);
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /endpointProofs\.claraEndpointChecked/);

    const weakSecretProofPayload = sampleReportPayload("smoke:purchase-verification");
    weakSecretProofPayload.contractProof.responseBoundary.serverSecretKeyNamesChecked = [];
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:purchase-verification", artifactDir)), weakSecretProofPayload);
    assertThrows(() => assertReportArtifact("smoke:purchase-verification", artifactDir), /serverSecretKeyNamesChecked must include APP_STORE_PRIVATE_KEY/);

    const weakRedactionPatternPayload = sampleReportPayload("smoke:analytics-ingestion");
    weakRedactionPatternPayload.contractProof.responseBoundary.privateEchoPatternsChecked = 0;
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:analytics-ingestion", artifactDir)), weakRedactionPatternPayload);
    assertThrows(() => assertReportArtifact("smoke:analytics-ingestion", artifactDir), /privateEchoPatternsChecked must be a number between 1 and 100/);

    const localHomePathPayload = sampleReportPayload("smoke:backend-readiness");
    localHomePathPayload.results[0].detail = "synthetic report leaked /Users/alice/Downloads/FREED-release-arm64.apk";
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:backend-readiness", artifactDir)), localHomePathPayload);
    assertThrows(() => assertReportArtifact("smoke:backend-readiness", artifactDir), /local home path/);

    const windowsHomePathPayload = sampleReportPayload("smoke:backend-readiness");
    windowsHomePathPayload.results[0].detail = "synthetic report leaked C:\\\\Users\\\\alice\\\\Downloads\\\\FREED-release-arm64.apk";
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:backend-readiness", artifactDir)), windowsHomePathPayload);
    assertThrows(() => assertReportArtifact("smoke:backend-readiness", artifactDir), /local home path/);

    const unsanitizedDeployedSmokePayload = sampleReportPayload("smoke:backend-readiness");
    unsanitizedDeployedSmokePayload.sanitized = false;
    writeJson(resolve(process.cwd(), reportPathForScript("smoke:backend-readiness", artifactDir)), unsanitizedDeployedSmokePayload);
    assertThrows(() => assertReportArtifact("smoke:backend-readiness", artifactDir), /sanitized/);

    const androidApkReportPath = resolve(process.cwd(), reportPathForScript("build:android-apk:upload-signed", artifactDir));
    const weakAndroidSigningPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidSigningPayload.signing.playConsoleReady = false;
    writeJson(androidApkReportPath, weakAndroidSigningPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /signing\.playConsoleReady/);

    const weakAndroidUploadKeystorePayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidUploadKeystorePayload.signing.uploadKeystore.debugSigned = true;
    weakAndroidUploadKeystorePayload.signing.uploadKeystore.certificateSha256Digest =
      "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
    writeJson(androidApkReportPath, weakAndroidUploadKeystorePayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /uploadKeystore\.debugSigned/);

    const weakAndroidAdMobPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidAdMobPayload.adMob.mode = "local-test-app-id";
    weakAndroidAdMobPayload.adMob.productionReady = false;
    weakAndroidAdMobPayload.adMob.sampleAppIdUsed = true;
    writeJson(androidApkReportPath, weakAndroidAdMobPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /adMob\.mode/);

    const missingAndroidInstallHandoffPayload = sampleReportPayload("build:android-apk:upload-signed");
    delete missingAndroidInstallHandoffPayload.installHandoff;
    writeJson(androidApkReportPath, missingAndroidInstallHandoffPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /installHandoff\.localInstallSupported/);

    const weakAndroidInstallHandoffPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidInstallHandoffPayload.installHandoff.installQaCommand = ["npm", "run", "android"];
    writeJson(androidApkReportPath, weakAndroidInstallHandoffPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /installQaCommand must include qa:android-install/);

    const missingAndroidInstallHandoffDocumentPayload = sampleReportPayload("build:android-apk:upload-signed");
    delete missingAndroidInstallHandoffDocumentPayload.installHandoff.handoffDocument;
    missingAndroidInstallHandoffDocumentPayload.installHandoff.handoffDocumentWritten = false;
    writeJson(androidApkReportPath, missingAndroidInstallHandoffDocumentPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /installHandoff\.handoffDocument/);

    const weakAndroidProtectionFlowPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidProtectionFlowPayload.installHandoff.protectionFlowOrder = [
      "android-dns-guard",
      "android-usage-access",
      "android-accessibility"
    ];
    weakAndroidProtectionFlowPayload.installHandoff.protectionFlowOrderString =
      "android-dns-guard>android-usage-access>android-accessibility";
    writeJson(androidApkReportPath, weakAndroidProtectionFlowPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /protectionFlowOrder must include android-native-adult-domain-feed/);

    const weakAndroidProtectionHandoffPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidProtectionHandoffPayload.installHandoff.protectionQaCommand = [
      "npm",
      "run",
      "evidence:android-real-browser",
      "--",
      "--device",
      "<serial>",
      "--adult-url",
      "<real-adult-url>",
      "--permission-proof",
      "--native-status-proof",
      "--run-id",
      "self-test",
      "--output-dir",
      "docs/validation/artifacts/self-test/android-real-browser-capture",
    ];
    writeJson(androidApkReportPath, weakAndroidProtectionHandoffPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /protectionQaCommand must include --dns-guard-proof/);

    const weakAndroidSignaturePayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidSignaturePayload.apk.signature.debugSigned = true;
    weakAndroidSignaturePayload.apk.signature.certificateSha256Digest =
      "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
    writeJson(androidApkReportPath, weakAndroidSignaturePayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /signature\.debugSigned/);

    const missingAndroidBuildResultPayload = sampleReportPayload("build:android-apk:upload-signed");
    delete missingAndroidBuildResultPayload.buildResult;
    writeJson(androidApkReportPath, missingAndroidBuildResultPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /buildResult/);

    const weakAndroidResultPayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidResultPayload.result = "fail";
    writeJson(androidApkReportPath, weakAndroidResultPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /result/);

    const unsanitizedAndroidPayload = sampleReportPayload("build:android-apk:upload-signed");
    unsanitizedAndroidPayload.sanitized = false;
    writeJson(androidApkReportPath, unsanitizedAndroidPayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /sanitized/);

    const weakAndroidEnginePayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidEnginePayload.finalEngine = "jsc";
    writeJson(androidApkReportPath, weakAndroidEnginePayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /finalEngine/);

    const weakAndroidRuntimePayload = sampleReportPayload("build:android-apk:upload-signed");
    weakAndroidRuntimePayload.apk.hasHermesRuntime = false;
    weakAndroidRuntimePayload.apk.hasJscRuntime = true;
    writeJson(androidApkReportPath, weakAndroidRuntimePayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /hasHermesRuntime/);

    const missingAndroidBundlePayload = sampleReportPayload("build:android-apk:upload-signed");
    missingAndroidBundlePayload.results.find((result) => result.id === "android-apk-react-native-bundle").status = "FAIL";
    missingAndroidBundlePayload.summary.passCount -= 1;
    missingAndroidBundlePayload.summary.failCount += 1;
    writeJson(androidApkReportPath, missingAndroidBundlePayload);
    assertThrows(() => assertReportArtifact("build:android-apk:upload-signed", artifactDir), /failCount=0/);

    const androidAabReportPath = resolve(process.cwd(), reportPathForScript("build:android-aab:upload-signed", artifactDir));
    const weakAndroidAabTypePayload = sampleReportPayload("build:android-aab:upload-signed");
    weakAndroidAabTypePayload.artifactType = "apk";
    writeJson(androidAabReportPath, weakAndroidAabTypePayload);
    assertThrows(() => assertReportArtifact("build:android-aab:upload-signed", artifactDir), /artifactType/);

    const weakAndroidAabSigningPayload = sampleReportPayload("build:android-aab:upload-signed");
    weakAndroidAabSigningPayload.signing.playConsoleReady = false;
    writeJson(androidAabReportPath, weakAndroidAabSigningPayload);
    assertThrows(() => assertReportArtifact("build:android-aab:upload-signed", artifactDir), /signing\.playConsoleReady/);

    const weakAndroidAabRuntimePayload = sampleReportPayload("build:android-aab:upload-signed");
    weakAndroidAabRuntimePayload.aab.hasHermesRuntime = false;
    weakAndroidAabRuntimePayload.aab.hasJscRuntime = true;
    writeJson(androidAabReportPath, weakAndroidAabRuntimePayload);
    assertThrows(() => assertReportArtifact("build:android-aab:upload-signed", artifactDir), /hasHermesRuntime/);

    const weakAndroidAabResultPayload = sampleReportPayload("build:android-aab:upload-signed");
    weakAndroidAabResultPayload.results.find((result) => result.id === "android-aab-build").status = "FAIL";
    weakAndroidAabResultPayload.summary.passCount -= 1;
    weakAndroidAabResultPayload.summary.failCount += 1;
    writeJson(androidAabReportPath, weakAndroidAabResultPayload);
    assertThrows(() => assertReportArtifact("build:android-aab:upload-signed", artifactDir), /failCount=0/);

    const iosArchiveReportPath = resolve(process.cwd(), reportPathForScript("build:ios-archive:release", artifactDir));
    const weakIosSigningPayload = sampleReportPayload("build:ios-archive:release");
    weakIosSigningPayload.signing.appleDistributionSigned = false;
    weakIosSigningPayload.signing.mode = "not-app-store-distribution";
    writeJson(iosArchiveReportPath, weakIosSigningPayload);
    assertThrows(() => assertReportArtifact("build:ios-archive:release", artifactDir), /signing\.mode/);

    const weakIosExportPayload = sampleReportPayload("build:ios-archive:release");
    weakIosExportPayload.exportResult = "fail";
    weakIosExportPayload.ipa.exists = false;
    writeJson(iosArchiveReportPath, weakIosExportPayload);
    assertThrows(() => assertReportArtifact("build:ios-archive:release", artifactDir), /exportResult/);

    const weakIosExtensionPayload = sampleReportPayload("build:ios-archive:release");
    weakIosExtensionPayload.archive.embeddedExtensionNames = ["FREEDShieldConfiguration.appex"];
    writeJson(iosArchiveReportPath, weakIosExtensionPayload);
    assertThrows(() => assertReportArtifact("build:ios-archive:release", artifactDir), /embeddedExtensionNames must include FREEDShieldAction\.appex/);

    const weakIosEntitlementPayload = sampleReportPayload("build:ios-archive:release");
    weakIosEntitlementPayload.archive.packetTunnelProviderEntitled = true;
    writeJson(iosArchiveReportPath, weakIosEntitlementPayload);
    assertThrows(() => assertReportArtifact("build:ios-archive:release", artifactDir), /packetTunnelProviderEntitled/);

    const weakIosSafariPayload = sampleReportPayload("build:ios-archive:release");
    weakIosSafariPayload.archive.safariFocusShield.serviceWorker = "";
    writeJson(iosArchiveReportPath, weakIosSafariPayload);
    assertThrows(() => assertReportArtifact("build:ios-archive:release", artifactDir), /safariFocusShield\.serviceWorker/);

    writeJson(aiReportPath, sampleReportPayload("smoke:ai-backend"));
    assertThrows(
      () => assertReportArtifact("smoke:ai-backend", artifactDir, { EXPO_PUBLIC_RETENTION_ENDPOINT: "https://api.freedrecovery.app/api/retention" }),
      /endpoints\.retention/
    );

    const retentionMissingResultPayload = sampleReportPayload("smoke:ai-backend");
    setReportPathValue(retentionMissingResultPayload, "endpoints.retention", "https://api.freedrecovery.app/api/retention");
    setReportPathValue(retentionMissingResultPayload, "aiBoundary.retentionEndpointConfigured", true);
    setReportPathValue(retentionMissingResultPayload, "aiBoundary.retentionEndpointChecked", true);
    setReportPathValue(retentionMissingResultPayload, "aiBoundary.retentionAggregateOnlyChecked", true);
    setReportPathValue(retentionMissingResultPayload, "contractProof.requestTimeoutMs.retention", 8_000);
    setReportPathValue(retentionMissingResultPayload, "contractProof.endpointProofs.retentionEndpointConfigured", true);
    setReportPathValue(retentionMissingResultPayload, "contractProof.endpointProofs.retentionEndpointChecked", true);
    setReportPathValue(retentionMissingResultPayload, "contractProof.privacyProofs.retentionAggregateOnlyChecked", true);
    writeJson(aiReportPath, retentionMissingResultPayload);
    assertThrows(
      () => assertReportArtifact("smoke:ai-backend", artifactDir, { EXPO_PUBLIC_RETENTION_ENDPOINT: "https://api.freedrecovery.app/api/retention" }),
      /required result retention-remote-endpoint/
    );

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      summary: { passCount: reportArtifactRequiredResultIds["smoke:ai-backend"].length - 1, failCount: 0 },
      results: sampleReportPayload("smoke:ai-backend").results.filter((result) => result.id !== "challenge-remote-endpoint")
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /required result challenge-remote-endpoint/);

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      results: [
        {
          id: "release-verifier-self-test",
          status: "FAIL",
          detail: "synthetic failure should not pass summary validation"
        }
      ]
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /pass\/fail counts must match results/);

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      results: [
        {
          id: "release-verifier-self-test",
          status: "PASS",
          detail: "synthetic sanitized report accepted"
        },
        {
          id: "release-verifier-self-test",
          status: "PASS",
          detail: "duplicate row should not pass validation"
        }
      ],
      summary: { passCount: 2, failCount: 0 }
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /must not repeat/);

    writeJson(aiReportPath, {
      ...sampleReportPayload("smoke:ai-backend"),
      results: [
        {
          id: "release-verifier-self-test",
          status: "pass",
          detail: "lowercase status should not pass validation"
        }
      ]
    });
    assertThrows(() => assertReportArtifact("smoke:ai-backend", artifactDir), /PASS\/FAIL status/);

    const preflightReportArtifactPath = reportPathForScript("preflight:release-env", artifactDir);
    const preflightReportPath = resolve(process.cwd(), preflightReportArtifactPath);
    const preflightSamplePayload = () => sampleReportPayload("preflight:release-env", preflightReportArtifactPath);
    const missingBlockerGroupsPayload = preflightSamplePayload();
    delete missingBlockerGroupsPayload.blockerGroups;
    writeJson(preflightReportPath, missingBlockerGroupsPayload);
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /blockerGroups/);

    writeJson(preflightReportPath, {
      ...preflightSamplePayload(),
      blockerGroups: preflightSamplePayload().blockerGroups.filter(
        (group) => group.id !== "production-ai-backend"
      )
    });
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /production-ai-backend/);

    const preflightPayloadWithGroup = (groupId, mutateGroup, mutatePayload = () => {}) => {
      const payload = preflightSamplePayload();
      const group = payload.blockerGroups.find((candidate) => candidate.id === groupId);
      if (!group) throw new Error(`Missing self-test blocker group ${groupId}`);
      mutateGroup(group, payload);
      mutatePayload(payload);
      return payload;
    };

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("production-android-signing", (group) => {
        group.requiredReports = group.requiredReports.filter((entry) => !entry.includes("android-apk-build-report.json"));
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /requiredReports must include npm run build:android-apk:upload-signed/);

    const countMismatchPayload = preflightSamplePayload();
    countMismatchPayload.checks[0].status = "fail";
    writeJson(preflightReportPath, countMismatchPayload);
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /pass\/fail counts must match checks/);

    const weakPreflightResultPayload = preflightSamplePayload();
    weakPreflightResultPayload.result = "dry-run";
    writeJson(preflightReportPath, weakPreflightResultPayload);
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /result/);

    const unsanitizedPreflightPayload = preflightSamplePayload();
    unsanitizedPreflightPayload.sanitized = false;
    writeJson(preflightReportPath, unsanitizedPreflightPayload);
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /sanitized/);

    const unexpectedPreflightCheckPayload = preflightSamplePayload();
    unexpectedPreflightCheckPayload.checks.push({
      id: "untracked-production-check",
      status: "pass",
      detail: "synthetic untracked preflight check should not pass validation"
    });
    unexpectedPreflightCheckPayload.passCount += 1;
    writeJson(preflightReportPath, unexpectedPreflightCheckPayload);
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /unexpected preflight check untracked-production-check/);

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("production-ai-backend", (group) => {
        group.status = "external";
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /can only be external/);

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("ios-physical-device-validation", (group) => {
        group.status = "pass";
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /must be external because no preflight checks apply/);

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("production-ai-backend", (group) => {
        group.failedPreflightChecks = [{ id: "purchase-verify-endpoint" }];
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /failedPreflightChecks must belong to its preflightCheckIds/);

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("production-ai-backend", (group) => {
        group.failedPreflightChecks = [{ id: "server-ai-key" }];
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /failedPreflightChecks must match failed checks/);

    writeJson(
      preflightReportPath,
      preflightPayloadWithGroup("production-ai-backend", (group) => {
        group.status = "fail";
      })
    );
    assertThrows(() => assertReportArtifact("preflight:release-env", artifactDir), /fail status must include failedPreflightChecks/);

    const releaseReadinessReportPath = resolve(process.cwd(), reportPathForScript("audit:release:strict", artifactDir));

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      strict: false
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /must be strict/);

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      sanitized: false
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /sanitized/);

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      summary: { passCount: expectedReleaseReadinessGateIds.length - 1, warnCount: 1, failCount: 0 },
      results: [
        ...sampleReportPayload("audit:release:strict").results.slice(0, -1),
        {
          ...sampleReportPayload("audit:release:strict").results.at(-1),
          status: "warn"
        }
      ]
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /warnCount=0/);

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      results: sampleReportPayload("audit:release:strict").results.filter(
        (result) => result.id !== "prototype-design-files"
      ),
      summary: { passCount: expectedReleaseReadinessGateIds.length - 1, warnCount: 0, failCount: 0 }
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /release readiness gate prototype-design-files/);

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      results: [
        ...sampleReportPayload("audit:release:strict").results,
        {
          id: "synthetic-extra-gate",
          status: "pass",
          evidence: "synthetic sanitized release readiness proof accepted",
          next: ""
        }
      ],
      summary: { passCount: expectedReleaseReadinessGateIds.length + 1, warnCount: 0, failCount: 0 }
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /unexpected release readiness gate synthetic-extra-gate/);

    writeJson(releaseReadinessReportPath, {
      ...sampleReportPayload("audit:release:strict"),
      results: [
        ...sampleReportPayload("audit:release:strict").results,
        sampleReportPayload("audit:release:strict").results[0]
      ],
      summary: { passCount: expectedReleaseReadinessGateIds.length + 1, warnCount: 0, failCount: 0 }
    });
    assertThrows(() => assertReportArtifact("audit:release:strict", artifactDir), /must not repeat/);

    const secretLeakCases = [
      {
        label: "URL credentials",
        detail: "provider echoed https://user:pass@api.freedrecovery.app/api/clara",
        expectedPattern: /secret-shaped URL credentials/
      },
      {
        label: "private key",
        detail: "provider echoed -----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
        expectedPattern: /secret-shaped private key/
      },
      {
        label: "OpenAI API key",
        detail: "provider echoed sk-proj-releaseVerifierSecret1234567890abcdef",
        expectedPattern: /secret-shaped OpenAI API key/
      },
      {
        label: "Google API key",
        detail: "provider echoed AIzaReleaseVerifierSecret1234567890abcdef",
        expectedPattern: /secret-shaped Google API key/
      },
      {
        label: "Google OAuth access token",
        detail: "provider echoed ya29.releaseVerifierSecret1234567890abcdef",
        expectedPattern: /secret-shaped Google OAuth access token/
      },
      {
        label: "FCM server key",
        detail: "provider echoed AAAAReleaseVerifierSecret1234567890:abcdef",
        expectedPattern: /secret-shaped FCM server key/
      },
      {
        label: "device token",
        detail: "provider echoed fcmReleaseSmokeToken_1234567890:APA91bReleaseSmokeToken_abcdefghijklmnopqrstuvwxyz",
        expectedPattern: /secret-shaped device token/
      },
      {
        label: "bearer token",
        detail: "provider echoed Authorization: Bearer backend-maintenance-secret-1234567890",
        expectedPattern: /secret-shaped bearer token/
      },
      {
        label: "JWT",
        detail: "provider echoed eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment",
        expectedPattern: /secret-shaped JWT/
      },
      {
        label: "raw secret parameter",
        detail: "provider echoed token=release-verifier-secret",
        expectedPattern: /secret-shaped raw secret parameter/
      }
    ];

    for (const secretLeakCase of secretLeakCases) {
      const leakedPayload = sampleReportPayload("smoke:ai-backend");
      leakedPayload.results[0] = {
        ...leakedPayload.results[0],
        detail: secretLeakCase.detail
      };
      writeJson(aiReportPath, leakedPayload);
      assertThrows(
        () => assertReportArtifact("smoke:ai-backend", artifactDir),
        secretLeakCase.expectedPattern
      );
    }

    assertThrows(
      () => normalizeArtifactDir("DOCS/VALIDATION/EVIDENCE"),
      /docs\/validation\/evidence/
    );
    assertThrows(
      () => normalizeArtifactDir("screenshots/release-verifier-reports"),
      /under docs\/validation\/artifacts/
    );
    assertThrows(
      () => normalizeArtifactDir("docs/validation/artifacts"),
      /under docs\/validation\/artifacts/
    );
    const fileArtifactDir = `${artifactDir}/not-a-directory`;
    writeFileSync(resolve(process.cwd(), fileArtifactDir), "not a directory");
    assertThrows(
      () => normalizeArtifactDir(fileArtifactDir),
      /existing path components must be directories/
    );

    console.log("release-verify self-test: pass");
  } finally {
    rmSync(absoluteArtifactDir, { recursive: true, force: true });
  }
}

let args;
let releaseEnv;
try {
  args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    process.exit(0);
  }
  args.artifactDir = normalizeArtifactDir(args.artifactDir);
  releaseEnv = loadReleaseEnv(args.envFile);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to load release environment.");
  process.exit(1);
}

if (args.list) {
  console.log("# FREED release verification command order");
  console.log(`Environment: ${releaseEnv.sourceLabel}`);
  if (args.artifactDir) console.log(`Artifact reports: ${args.artifactDir}`);
  for (const script of releaseScripts) console.log(commandLabel(script, releaseEnv.envFile, args.artifactDir));
  process.exit(0);
}

for (const script of releaseScripts) {
  console.log(`\n# ${commandLabel(script, releaseEnv.envFile, args.artifactDir)}`);
  try {
    removeExistingReportArtifact(script, args.artifactDir);
  } catch (error) {
    console.error(`\nRelease verification stopped before npm run ${script}: ${error instanceof Error ? error.message : "could not remove previous report artifact"}`);
    process.exitCode = 1;
    break;
  }
  const commandStartedAtMs = Date.now();
  const result = spawnSync("npm", scriptArgs(script, releaseEnv.envFile, args.artifactDir), {
    cwd: process.cwd(),
    env: releaseEnv.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`\nRelease verification failed while starting npm run ${script}: ${result.error.message}`);
    process.exitCode = 1;
    break;
  }

  if (result.status !== 0) {
    console.error(`\nRelease verification stopped at npm run ${script} with exit code ${result.status ?? 1}.`);
    process.exitCode = result.status ?? 1;
    break;
  }

  try {
    assertReportArtifact(script, args.artifactDir, releaseEnv.env, {
      minGeneratedAtMs: commandStartedAtMs,
      minModifiedAtMs: commandStartedAtMs
    });
  } catch (error) {
    console.error(`\nRelease verification stopped after npm run ${script}: ${error instanceof Error ? error.message : "invalid report artifact"}`);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log("\nFREED release verification passed all gates.");
}
