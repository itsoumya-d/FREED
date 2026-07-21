import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { classifyUrl, SAFARI_SHORT_FORM_WEB_RULE_FILTERS } from "../src/lib/blocking-engine";
import { getCoachConfig } from "../src/lib/ai-coach";
import { getChallengeGenerationConfig } from "../src/lib/challenge-generator";
import { formatEndpointIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { getMonetizationConfig, LAUNCH_PREMIUM_PLAN_IDS } from "../src/lib/monetization";
import { getRetentionConfig } from "../src/lib/retention-orchestrator";
import {
  INSTAGRAM_ANDROID_PACKAGE,
  SUPPORTED_DOOMSCROLL_APP_PACKAGES,
  TIKTOK_ANDROID_PACKAGES,
  YOUTUBE_ANDROID_PACKAGE
} from "../src/lib/doomscroll-apps";
import { readConfiguredServerAiModel } from "../src/lib/server-ai-provider";
import { classifierSafetyCorpus } from "./classifier-safety-corpus";

type EvidenceStatus = "pass" | "fail";

type EvidenceSpec = {
  id: string;
  file: string;
  subjectLabel: string;
  requiredChecks: string[];
  requiredFields?: string[];
  requiredCommands?: string[];
  requiredProfileNumbers?: string[];
  next: string;
};

export type ValidationEvidenceResult = {
  id: string;
  status: EvidenceStatus;
  evidence: string;
  next?: string;
};

export type ValidationEvidenceOptions = {
  evidenceDir?: string | null;
};

export const validationEvidenceSpecs = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/validation-evidence-specs.json"), "utf8")
) as EvidenceSpec[];

const MIN_IOS_SAFARI_CONTENT_BLOCKER_RULE_COUNT = SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length + 1;
const IOS_COMPLETE_DATA_PROTECTION_ENTITLEMENT = "NSFileProtectionComplete";
const IOS_APP_PACKAGE_PROOF_SCHEMA_VERSION = "freed-ios-app-package-proof-v1";
const IOS_APP_GROUP_ID = "group.app.freed.recovery";
const IOS_APP_PACKAGE_PROOF_ARTIFACT_FIELDS = [
  "familyControlsEntitlementArtifact",
  "appGroupProvisioningArtifact",
  "completeDataProtectionEntitlementArtifact",
  "safariContentBlockerBuildArtifact"
];
const IOS_APP_PACKAGE_REQUIRED_EXTENSIONS = [
  { bundleName: "FREEDShieldConfiguration.appex", requiresFamilyControls: true },
  { bundleName: "FREEDShieldAction.appex", requiresFamilyControls: true },
  { bundleName: "FREEDDeviceActivityMonitor.appex", requiresFamilyControls: true },
  { bundleName: "FREEDSafariContentBlocker.appex", requiresFamilyControls: false, requiresSafariRuleList: true }
];
const IOS_APP_PACKAGE_REQUIRED_SAFARI_RULE_SIGNALS = [
  "adult-domain-pornhub",
  "adult-domain-xvideos",
  "youtube-shorts-web",
  "instagram-reels-web",
  "tiktok-for-you-web"
];
const PERMISSION_WIZARD_FLOW_ORDER =
  "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete";
const PERMISSION_EXPLANATION_REQUIRED_PHRASES = [
  "monitor only selected apps and sites",
  "block known adult domains",
  "harmful site, search, or app-limit threshold"
];
const ANDROID_PERMISSION_WIZARD_REQUIRED_CHECKS = [
  "androidZeroAppContinueDisabled",
  "androidSetupLaunchedAppSelection",
  "androidAppSelectionReturnAutoSync",
  "androidAppSelectionReturnNativePackageSyncConfirmed",
  "androidAppSelectionReturnAutoAdvanceContinued",
  "androidDnsGuardVpnConsentReturnRefreshed",
  "androidDnsGuardVpnConsentSurfaceObserved",
  "androidUsageAccessSettingsReturnRefreshed",
  "androidUsageAccessExactSettingsRouteObserved",
  "androidAccessibilitySettingsReturnRefreshed",
  "androidAccessibilityExactSettingsRouteObserved",
  "androidAccessibilityServiceDetailsTargetObserved",
  "androidSystemSettingsReturnAutoAdvanceContinued"
];
const IOS_PERMISSION_WIZARD_REQUIRED_CHECKS = [
  "iosScreenTimeAuthorizationReturnRefreshed",
  "iosFamilyActivityPickerReturnRefreshed",
  "iosSafariSettingsReturnRefreshed",
  "iosSystemSettingsReturnAutoAdvanceContinued"
];
const ANDROID_INSTALL_QA_SCHEMA_VERSION = "freed-android-install-qa-report-v1";
const ANDROID_INSTALL_QA_APP_PACKAGE = "app.freed.recovery";
const ANDROID_INSTALL_QA_MAIN_ACTIVITY = "app.freed.recovery/.MainActivity";
const ANDROID_INSTALL_QA_MIN_APK_BYTES = 5_000_000;
const ANDROID_PROTECTION_FLOW_ORDER = [
  "android-native-adult-domain-feed",
  "android-dns-guard",
  "android-usage-access",
  "android-accessibility",
  "android-doomscroll-apps",
  "activation-test"
];
const ANDROID_PROTECTION_FLOW_ORDER_STRING = ANDROID_PROTECTION_FLOW_ORDER.join(">");
const ANDROID_ACTIVATION_READINESS_REQUIRED_PHRASE =
  "adult domains are blocked while normal browsing is allowed";
const ANDROID_INSTALL_QA_REQUIRED_PROOF_FLAGS = [
  "--permission-proof",
  "--native-status-proof",
  "--dns-guard-proof"
];
const UNSAFE_PROTECTION_MODE_TERMS = [
  "all traffic",
  "deep packet inspection",
  "full proxy",
  "full tunnel",
  "full vpn",
  "full-traffic proxy",
  "full-tunnel",
  "https inspection",
  "man-in-the-middle",
  "mitm",
  "packet inspection",
  "packet tunnel",
  "route all traffic",
  "ssl inspection",
  "tls inspection",
  "traffic proxy"
];
const IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE = "ios-safari-short-form";
const IOS_SAFARI_SHORT_FORM_RULE_DOMAINS: Record<string, string> = {
  "short-form:youtube-shorts": "youtube.com",
  "short-form:instagram-reels": "instagram.com",
  "short-form:tiktok-feed": "tiktok.com"
};
const PURCHASE_VERIFICATION_REQUIRED_RESULT_IDS = [
  "purchase-verification-endpoint",
  "purchase-unknown-product-fails-closed",
  ...LAUNCH_PREMIUM_PLAN_IDS.map((planId) => `purchase-fake-known-${planId}-token-fails-closed`),
  "purchase-malformed-json-fails-closed"
];
const PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT = PURCHASE_VERIFICATION_REQUIRED_RESULT_IDS.length;
const POST_LAUNCH_PREMIUM_PLAN_IDS = ["family", "accountability", "ai-coach"] as const;
const STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION = "freed-paywall-launch-scope-report-v1";
const STORE_PAYWALL_LAUNCH_SCOPE_REQUIRED_CHECKS = [
  "core3PlanIdsVisible",
  "onlyLaunchProductIdsVisible",
  "postLaunchProductIdsHidden",
  "yearlyValueAnchorVisible",
  "monthlyRecurringVisible",
  "lifetimeOneTimeVisible",
  "restorePurchasesVisible",
  "purchaseButtonsEnabled",
  "serverVerificationCopyVisible",
  "premiumNoAdBenefitVisible",
  "noFamilyAccountabilityAiUpsellsVisible"
];
const STORE_PAYWALL_LAUNCH_SCOPE_SOURCE_PROOFS = [
  {
    pathField: "paywallSourcePath",
    hashField: "paywallSourceHash",
    expectedPath: "src/features/freed-app.tsx"
  },
  {
    pathField: "monetizationSourcePath",
    hashField: "monetizationSourceHash",
    expectedPath: "src/lib/monetization.ts"
  }
];
const STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION = "freed-store-console-product-setup-report-v1";
const STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION = "freed-store-console-browser-readiness-v1";
const STORE_CONSOLE_APP_RECORD_READINESS_REQUIRED_CHECKS = [
  "browserReadinessReportCurrent",
  "readOnlyBrowserInspection",
  "noStoreMutationDuringBrowserCheck",
  "accountIdentifiersRedacted",
  "googlePlayAppRecordPresent",
  "appStoreConnectAppRecordPresent",
  "appStoreLicenseAgreementAccepted",
  "bothPlatformsProductSetupAllowed"
];
const STORE_CONSOLE_PRODUCT_SETUP_REQUIRED_CHECKS = [
  "core3ProductsCreated",
  "appStoreMonthlyYearlySubscriptionGroupConfigured",
  "appStoreLifetimeNonConsumableConfigured",
  "playMonthlyYearlyBasePlansConfigured",
  "playLifetimeOneTimeProductConfigured",
  "launchPricesMatchCatalog",
  "reviewScreenshotsAttached",
  "productLocalizationsConfigured",
  "serverVerificationMetadataConfigured",
  "consoleEvidenceArtifactsCaptured",
  "futureSkusInactive",
  "noExtraLaunchProductsActive",
  "draftOrSandboxOnlyUntilEvidencePasses"
];
const STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS = {
  appStoreConnect: [
    "app-record",
    "subscription-group",
    "yearly-subscription",
    "monthly-subscription",
    "lifetime-non-consumable",
    "future-skus-inactive"
  ],
  googlePlay: [
    "app-record",
    "subscriptions-list",
    "yearly-base-plan",
    "monthly-base-plan",
    "lifetime-one-time-product",
    "future-skus-inactive"
  ]
} as const;
const STORE_CONSOLE_PRODUCT_SETUP_SOURCE_PROOFS = [
  {
    pathField: "storeProductsCatalogPath",
    hashField: "storeProductsCatalogHash",
    expectedPath: "store/store-products.json"
  },
  {
    pathField: "appStoreConnectCsvPath",
    hashField: "appStoreConnectCsvHash",
    expectedPath: "store/app-store/in-app-purchases.csv"
  },
  {
    pathField: "googlePlayProductsCsvPath",
    hashField: "googlePlayProductsCsvHash",
    expectedPath: "store/play-store/products.csv"
  },
  {
    pathField: "screenshotManifestPath",
    hashField: "screenshotManifestHash",
    expectedPath: "store/screenshots/manifest.json"
  }
];
const STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION = "freed-store-privacy-disclosure-report-v1";
const STORE_PRIVACY_DISCLOSURE_REQUIRED_SURFACES = [
  "app-store-connect-app-privacy",
  "play-console-data-safety",
  "app-review-notes",
  "play-policy-declarations"
];
const STORE_PRIVACY_DISCLOSURE_REQUIRED_SIGNALS = [
  "appStorePrivacyDisclosureReviewed",
  "playDataSafetyDisclosureReviewed",
  "billingDataUseReviewed",
  "purchaseVerificationDataUseReviewed",
  "rewardedAdsDataUseReviewed",
  "nonPersonalizedAdsRequestReviewed",
  "aggregateAnalyticsOptInReviewed",
  "remoteAnalyticsDisabledByDefaultReviewed",
  "noTrackingDeclared",
  "noAdvertisingIdPermissionDeclared",
  "noRawReceiptsOrTokensStored",
  "noStoreCredentialsOrAdSecretsStored",
  "noSensitiveRecoveryContentShared",
  "noChallengeMediaUploaded"
];
const STORE_PRIVACY_DISCLOSURE_SOURCE_PROOFS = [
  {
    pathField: "privacyDataMapPath",
    hashField: "privacyDataMapHash",
    expectedPath: "docs/privacy-data-map.md"
  },
  {
    pathField: "iosReviewPackPath",
    hashField: "iosReviewPackHash",
    expectedPath: "docs/store-policy/ios-screen-time-safari-dns-review.md"
  },
  {
    pathField: "androidPolicyPackPath",
    hashField: "androidPolicyPackHash",
    expectedPath: "docs/store-policy/android-accessibility-and-fgs-disclosure.md"
  }
];
const STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION = "freed-rewarded-ad-request-report-v1";
const STORE_REWARDED_AD_REQUEST_REQUIRED_CHECKS = [
  "rewardedOnlyFormat",
  "realAdMobRewardedUnitUsed",
  "realLoadedAdResponseIdCaptured",
  "nonPersonalizedRequest",
  "coarseCountryOnly",
  "noInterstitialRequested",
  "noBannerRequested",
  "noAppOpenRequested",
  "noNativeAdRequested",
  "noAdNetworkSecretsStored",
  "noPreciseLocationStored",
  "noRawDeviceIdentifiersStored"
];
const STORE_INTERVENTION_FLOW_SCHEMA_VERSION = "freed-store-intervention-flow-report-v1";
const STORE_INTERVENTION_FLOW_REQUIRED_CHECKS_BY_TYPE: Record<string, string[]> = {
  "free-rewarded-intervention": [
    "streakRiskContextShown",
    "freePlanStateShown",
    "rewardedAdBeforeChallenge",
    "challengeGenerated",
    "latencyWithinLimit",
    "supportiveCopyShown",
    "noPunitiveLanguage",
    "noPremiumEntitlementBypass",
    "noRawAdPayloadStored"
  ],
  "rewarded-ad-completion": [
    "rewardedAdCompleted",
    "challengeAccessGranted",
    "temporaryChallengeAccessOnly",
    "supportiveCopyShown",
    "noPurchaseGranted",
    "noRawAdPayloadStored"
  ],
  "ad-failure-fallback": [
    "adFailureObserved",
    "challengeUnlockedWithoutPunishment",
    "noRetryLoopRequired",
    "supportiveCopyShown",
    "noPremiumGranted",
    "noRawAdErrorStored"
  ],
  "premium-no-ad-intervention": [
    "premiumEntitlementVerified",
    "noRewardedAdRequested",
    "challengeGenerated",
    "latencyWithinLimit",
    "supportiveCopyShown",
    "noAdSdkRequest",
    "noPremiumUpsellShown",
    "noRawEntitlementTokenStored"
  ]
};
const AI_BACKEND_REQUIRED_RESULT_IDS = [
  "configured-ai-model",
  "clara-remote-endpoint",
  "challenge-remote-endpoint",
  "challenge-personalization-profiles"
];
const ANDROID_PLAY_POLICY_PROOF_SCHEMA_VERSION = "freed-android-play-policy-report-v1";
const ANDROID_PLAY_POLICY_REQUIRED_SIGNALS = [
  "accessibilityDisclosureMatchesPolicyPack",
  "accessibilityServiceConfigIsNotAccessibilityTool",
  "accessibilityServiceConfigReadsBoundedEvents",
  "accessibilityServiceDeclared",
  "dnsGuardDisclosureMatchesPolicyPack",
  "specialUseForegroundServiceDeclared"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function permissionExplanationSummaryIssues(value: unknown, path: "ios" | "android"): string[] {
  if (!nonEmptyString(value)) return [`${path}.permissionExplanationSummary`];

  const normalized = value.toLowerCase();
  return PERMISSION_EXPLANATION_REQUIRED_PHRASES
    .filter((phrase) => !normalized.includes(phrase))
    .map((phrase) => `${path}.permissionExplanationSummary must include "${phrase}"`);
}

const iso3166Alpha2CountryCodes = new Set([
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW"
]);
const allowedAndroidDoomscrollPackages = new Set(SUPPORTED_DOOMSCROLL_APP_PACKAGES);
const androidInstagramPackage = INSTAGRAM_ANDROID_PACKAGE;
const androidTikTokPackages = new Set(TIKTOK_ANDROID_PACKAGES);

function validIso3166Alpha2CountryCode(value: unknown) {
  return typeof value === "string" && iso3166Alpha2CountryCodes.has(value.trim().toUpperCase());
}

function validIsoDate(value: unknown) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(trimmed)) return false;

  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return false;
  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) return false;

  const canonical = parsed.toISOString();
  return trimmed === canonical || trimmed === canonical.replace(".000Z", "Z");
}

function validAdMobResponseId(value: unknown) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 512) return false;
  if (!/^[A-Za-z0-9._~:/+=-]+$/.test(trimmed)) return false;

  const normalized = trimmed.toLowerCase();
  return ![
    "rewarded-response",
    "response-id",
    "placeholder",
    "changeme",
    "sample",
    "test",
    "mock",
    "sandbox"
  ].some((term) => normalized.includes(term));
}

function validRemoteAiModelId(value: unknown) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 128) return false;
  if (!/^[A-Za-z0-9._~:/+=-]+$/.test(trimmed)) return false;

  const normalized = trimmed.toLowerCase();
  if (["configured-server-model", "gpt-release-safe"].includes(normalized)) return false;

  const placeholderTokens = new Set(["configured", "placeholder", "changeme", "test", "mock", "sample", "sandbox", "local", "fallback", "dummy"]);
  return !normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((token) => placeholderTokens.has(token));
}

function validEvidenceId(value: unknown) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 128) return false;
  if (/\s/.test(trimmed)) return false;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return false;

  const normalized = trimmed.toLowerCase();
  if (["run", "report", "review", "ticket", "proof", "evidence", "id", "todo", "tbd", "n/a", "na"].includes(normalized)) {
    return false;
  }
  if (["placeholder", "changeme", "example"].some((term) => normalized.includes(term))) return false;

  return /[A-Za-z]/.test(trimmed) && /[-_:]/.test(trimmed);
}

function evidenceIdIssue(path: string, value: unknown): string | null {
  if (!nonEmptyString(value)) return path;
  return validEvidenceId(value) ? null : `${path} must use a concrete machine-readable ID`;
}

function duplicateEvidenceIdIssues(entries: Array<{ path: string; value: unknown }>): string[] {
  const issues: string[] = [];
  const seen = new Map<string, string>();

  entries.forEach(({ path, value }) => {
    if (!nonEmptyString(value) || !validEvidenceId(value)) return;
    const normalized = value.trim().toLowerCase();
    const firstPath = seen.get(normalized);
    if (firstPath) {
      issues.push(`${path} duplicates ${firstPath}`);
    } else {
      seen.set(normalized, path);
    }
  });

  return issues;
}

function configuredPremiumProductIds(platform: "ios" | "android") {
  return new Set(Object.values(getMonetizationConfig({ mode: "native", platform }).launchProductIds));
}

function configuredLaunchProductIdsByPlan(platform: "ios" | "android") {
  const launchProductIds = getMonetizationConfig({ mode: "native", platform }).launchProductIds;
  return Object.fromEntries(LAUNCH_PREMIUM_PLAN_IDS.map((planId) => [planId, launchProductIds[planId]]));
}

function configuredPostLaunchProductIdsByPlan(platform: "ios" | "android") {
  const productIds = getMonetizationConfig({ mode: "native", platform }).productIds;
  return Object.fromEntries(POST_LAUNCH_PREMIUM_PLAN_IDS.map((planId) => [planId, productIds[planId]]));
}

function configuredMonetizationEvidenceConfig() {
  const iosConfig = getMonetizationConfig({ mode: "native", platform: "ios" });
  const androidConfig = getMonetizationConfig({ mode: "native", platform: "android" });
  const rewardedUnitIds = [iosConfig.rewardedResetPlacementId, androidConfig.rewardedResetPlacementId].filter(
    (value): value is string =>
      Boolean(value && /^ca-app-pub-\d{16}\/\d{10}$/.test(value) && !value.includes("ca-app-pub-3940256099942544"))
  );
  return {
    storeProvider: iosConfig.storeProvider,
    entitlementId: iosConfig.revenueCatEntitlementId,
    purchaseVerifyEndpoint: iosConfig.purchaseVerifyEndpoint ?? androidConfig.purchaseVerifyEndpoint,
    rewardedUnitIds: new Set(rewardedUnitIds)
  };
}

function configuredAiEvidenceConfig() {
  const configuredModel = readConfiguredServerAiModel();
  return {
    coachEndpoint: getCoachConfig({ mode: "remote" }).endpointUrl,
    challengeEndpoint: getChallengeGenerationConfig({ mode: "remote" }).endpointUrl,
    retentionEndpoint: getRetentionConfig({ mode: "remote" }).endpointUrl,
    model: configuredModel || null
  };
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function placeholderIssue(path: string, value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const exactPlaceholders = new Set([
    "qa",
    "iphone model, ios version, entitlement-approved apple id",
    "android model, android version",
    "ios/android model and os version",
    "ios/android model, os version, browser list",
    "app store sandbox, play billing test, admob test ads",
    "configured-server-model",
    "shield-action-run-id",
    "android-handoff-run-id",
    "sandbox-ios-purchase-id",
    "sandbox-ios-restore-id",
    "gpa.sandbox-order-id",
    "sha256-redacted-token",
    "admob-rewarded-unit-or-test-unit",
    "rewarded-response-id",
    "blocked-adult-domain.example",
    "com.example.webviewfixture"
  ]);

  if (
    exactPlaceholders.has(normalized) ||
    /<[^>\s]+(?:-[^>\s]+)*>/.test(normalized) ||
    normalized.includes(".env.production.example") ||
    normalized.includes(".env.example") ||
    normalized.includes("production-env-file") ||
    normalized.includes("path/to/") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme")
  ) {
    return `${path} must not use template placeholder text`;
  }

  return null;
}

function collectPlaceholderIssues(value: unknown, path: string): string[] {
  const directIssue = placeholderIssue(path, value);
  if (directIssue) return [directIssue];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectPlaceholderIssues(entry, `${path}[${index}]`));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) => collectPlaceholderIssues(entry, `${path}.${key}`));
  }

  return [];
}

const LOCAL_HOME_PATH_PATTERN =
  /(?:^|["'\s])(?:\/(?:Users|home)\/[A-Za-z0-9._-]+\/[^\s"']*|[A-Za-z]:(?:\\\\)+Users(?:\\\\)+[^\\/"'\s]+(?:(?:\\\\)+[^"'\s]*)?)/i;

function localHomePathIssue(path: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!LOCAL_HOME_PATH_PATTERN.test(value)) return null;
  return `${path} must not contain local home-profile paths`;
}

function collectLocalHomePathIssues(value: unknown, path: string): string[] {
  const directIssue = localHomePathIssue(path, value);
  if (directIssue) return [directIssue];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectLocalHomePathIssues(entry, `${path}[${index}]`));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) => collectLocalHomePathIssues(entry, `${path}.${key}`));
  }

  return [];
}

function collectForbiddenEvidenceFieldIssues(
  value: unknown,
  path: string,
  forbiddenFields: Set<string>,
  message: string,
  skipExactPaths = new Set<string>()
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectForbiddenEvidenceFieldIssues(entry, `${path}[${index}]`, forbiddenFields, message, skipExactPaths)
    );
  }

  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, entry]) => {
    const childPath = `${path}.${key}`;
    const hasSubmittedValue =
      entry !== undefined &&
      entry !== null &&
      !(typeof entry === "string" && entry.trim() === "");
    const directIssue =
      forbiddenFields.has(key) && hasSubmittedValue && !skipExactPaths.has(childPath)
        ? [`${childPath} must be omitted from evidence; ${message}`]
        : [];
    return [
      ...directIssue,
      ...collectForbiddenEvidenceFieldIssues(entry, childPath, forbiddenFields, message, skipExactPaths)
    ];
  });
}

type ForbiddenEvidenceTextOptions = {
  skipExactPaths?: Set<string>;
  skipFieldNames?: Set<string>;
  skipPathPrefixes?: Set<string>;
};

function pathStartsWithEvidencePrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

function evidencePathFieldName(path: string) {
  const withoutIndex = path.replace(/\[\d+\]$/g, "");
  const separatorIndex = withoutIndex.lastIndexOf(".");
  return separatorIndex >= 0 ? withoutIndex.slice(separatorIndex + 1) : withoutIndex;
}

function shouldSkipForbiddenEvidenceText(path: string, options: ForbiddenEvidenceTextOptions) {
  if (options.skipExactPaths?.has(path)) return true;
  if ([...(options.skipPathPrefixes ?? [])].some((prefix) => pathStartsWithEvidencePrefix(path, prefix))) return true;
  return options.skipFieldNames?.has(evidencePathFieldName(path)) ?? false;
}

function collectForbiddenEvidenceTextIssues(
  value: unknown,
  path: string,
  forbiddenPatterns: RegExp[],
  message: string,
  options: ForbiddenEvidenceTextOptions = {}
): string[] {
  if (typeof value === "string" && value.trim() && !shouldSkipForbiddenEvidenceText(path, options)) {
    const hasForbiddenText = forbiddenPatterns.some((pattern) => pattern.test(value));
    if (hasForbiddenText) return [`${path} must omit sensitive text; ${message}`];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectForbiddenEvidenceTextIssues(entry, `${path}[${index}]`, forbiddenPatterns, message, options)
    );
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectForbiddenEvidenceTextIssues(entry, `${path}.${key}`, forbiddenPatterns, message, options)
    );
  }

  return [];
}

function parseEvidenceUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function remoteEvidenceUrlIssue(url: URL, index: number): string | null {
  const proofTerms = [
    "artifact",
    "evidence",
    "issue",
    "log",
    "profile",
    "profiler",
    "qa",
    "recording",
    "report",
    "run",
    "sandbox",
    "screen",
    "screenshot",
    "smoke",
    "ticket",
    "trace",
    "validation",
    "video"
  ];
  const pathAndQuery = `${url.pathname}${url.search}`.toLowerCase();
  const hasProofTerm = proofTerms.some((term) => pathAndQuery.includes(term));

  return hasProofTerm ? null : `evidence[${index}] must reference a QA/report artifact path, not a generic website URL`;
}

function remoteEvidenceTransportIssue(url: URL, path: string): string | null {
  const safetyUrl = new URL(url.toString());
  safetyUrl.search = "";
  const issues = getProductionEndpointIssues(safetyUrl.toString(), path);
  return issues.length > 0 ? formatEndpointIssues(issues).join("; ") : null;
}

function missingEvidenceReference(root: string, value: unknown, path: string): string | null {
  if (typeof value !== "string" || !value.trim()) return path;
  const candidate = value.trim();
  const url = parseEvidenceUrl(candidate);
  if (url) {
    const transportIssue = remoteEvidenceTransportIssue(url, path);
    if (transportIssue) return transportIssue;
    return remoteEvidenceUrlIssue(url, 0)?.replace("evidence[0]", path) ?? null;
  }
  const absolutePath = isAbsolute(candidate) ? candidate : join(root, candidate);
  if (!existsSync(absolutePath)) return `${path} (${candidate})`;

  const stat = statSync(absolutePath);
  if (!stat.isFile()) return `${path} must reference a file, not a directory`;
  if (stat.size <= 0) return `${path} must reference a non-empty artifact file`;

  const artifactRoot = join(root, "docs/validation/artifacts");
  const artifactRelativePath = relative(artifactRoot, absolutePath);
  const outsideArtifacts =
    artifactRelativePath === "" ||
    artifactRelativePath.startsWith("..") ||
    isAbsolute(artifactRelativePath);
  if (outsideArtifacts) {
    return `${path} must be under docs/validation/artifacts/ or use an HTTPS QA/report URL`;
  }
  if (basename(absolutePath) === ".gitkeep") return `${path} must not reference a placeholder .gitkeep file`;
  return null;
}

function missingEvidenceReferences(root: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const issues = value
    .map((entry, index) => missingEvidenceReference(root, entry, `evidence[${index}]`))
    .filter((entry): entry is string => Boolean(entry));

  const seen = new Map<string, number>();
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) return;
    const normalized = entry.trim().replace(/#.*$/, "").toLowerCase();
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      issues.push(`evidence[${index}] duplicates evidence[${firstIndex}]`);
    } else {
      seen.set(normalized, index);
    }
  });

  return issues;
}

function numberField(profile: Record<string, unknown>, field: string): number | null {
  const value = profile[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readLocalJsonEvidenceArtifact(
  root: string,
  value: unknown,
  path: string,
  purpose = "contractProof inspection"
): { payload: unknown | null; issues: string[] } {
  if (!nonEmptyString(value)) return { payload: null, issues: [] };

  const candidate = value.trim();
  if (parseEvidenceUrl(candidate)) {
    return {
      payload: null,
      issues: [`${path} must reference the local sanitized JSON report under docs/validation/artifacts/ for ${purpose}`]
    };
  }

  const referenceIssue = missingEvidenceReference(root, candidate, path);
  if (referenceIssue) return { payload: null, issues: [] };

  const absolutePath = isAbsolute(candidate) ? candidate : join(root, candidate);
  try {
    return { payload: JSON.parse(readFileSync(absolutePath, "utf8")), issues: [] };
  } catch {
    return { payload: null, issues: [`${path} must be a parseable sanitized JSON report artifact`] };
  }
}

function reportResultIssues(
  report: Record<string, unknown>,
  path: string,
  requiredResultIds: string[]
): string[] {
  const issues: string[] = [];
  const summary = isRecord(report.summary) ? report.summary : {};
  const results = Array.isArray(report.results) ? report.results : [];
  const passCount = numberField(summary, "passCount");
  const failCount = numberField(summary, "failCount");
  const seen = new Set<string>();
  let actualPassCount = 0;
  let actualFailCount = 0;

  if (results.length === 0) {
    issues.push(`${path}.results must include non-empty PASS/FAIL rows`);
  }

  for (const [index, row] of results.entries()) {
    const rowPath = `${path}.results[${index}]`;
    if (!isRecord(row)) {
      issues.push(rowPath);
      continue;
    }
    if (!nonEmptyString(row.id)) {
      issues.push(`${rowPath}.id`);
      continue;
    }
    const id = row.id.trim();
    if (seen.has(id)) {
      issues.push(`${path}.results must not repeat ${id}`);
    } else {
      seen.add(id);
    }
    if (row.status !== "PASS" && row.status !== "FAIL") {
      issues.push(`${rowPath}.status must be PASS or FAIL`);
    } else if (row.status === "PASS") {
      actualPassCount += 1;
    } else {
      actualFailCount += 1;
    }
    if (!nonEmptyString(row.detail)) {
      issues.push(`${rowPath}.detail`);
    }
  }

  if (passCount !== actualPassCount || failCount !== actualFailCount) {
    issues.push(`${path}.summary pass/fail counts must match results`);
  }

  for (const requiredResultId of requiredResultIds) {
    const row = results.find((entry) => isRecord(entry) && entry.id === requiredResultId);
    if (!row) {
      issues.push(`${path}.results must include required result ${requiredResultId}`);
    } else if (isRecord(row) && row.status !== "PASS") {
      issues.push(`${path}.results.${requiredResultId} must be PASS`);
    }
  }

  return issues;
}

function sanitizedEndpointUrl(value: unknown) {
  if (!nonEmptyString(value)) return null;

  try {
    const parsed = new URL(value.trim());
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function performanceThresholdIssues(profile: Record<string, unknown>, path = "profile"): string[] {
  const durationMinutes = numberField(profile, "durationMinutes");
  const batteryDrainPercent = numberField(profile, "batteryDrainPercent");
  const maxResidentMemoryMb = numberField(profile, "maxResidentMemoryMb");
  const maxDeviceTemperatureC = numberField(profile, "maxDeviceTemperatureC");
  const dnsLatencyP95Ms = numberField(profile, "dnsLatencyP95Ms");
  const downloadMbpsBefore = numberField(profile, "downloadMbpsBefore");
  const downloadMbpsDuring = numberField(profile, "downloadMbpsDuring");
  const issues: string[] = [];

  if (durationMinutes !== null && durationMinutes < 30) issues.push(`${path}.durationMinutes >= 30`);
  if (batteryDrainPercent !== null && batteryDrainPercent < 0) issues.push(`${path}.batteryDrainPercent >= 0`);
  if (batteryDrainPercent !== null && batteryDrainPercent > 8) issues.push(`${path}.batteryDrainPercent <= 8`);
  if (maxResidentMemoryMb !== null && maxResidentMemoryMb <= 0) issues.push(`${path}.maxResidentMemoryMb > 0`);
  if (maxResidentMemoryMb !== null && maxResidentMemoryMb > 350) issues.push(`${path}.maxResidentMemoryMb <= 350`);
  if (maxDeviceTemperatureC !== null && maxDeviceTemperatureC <= 0) issues.push(`${path}.maxDeviceTemperatureC > 0`);
  if (maxDeviceTemperatureC !== null && maxDeviceTemperatureC > 42) issues.push(`${path}.maxDeviceTemperatureC <= 42`);
  if (dnsLatencyP95Ms !== null && dnsLatencyP95Ms <= 0) issues.push(`${path}.dnsLatencyP95Ms > 0`);
  if (dnsLatencyP95Ms !== null && dnsLatencyP95Ms > 100) issues.push(`${path}.dnsLatencyP95Ms <= 100`);
  if (downloadMbpsBefore !== null && downloadMbpsBefore <= 0) issues.push(`${path}.downloadMbpsBefore > 0`);
  if (downloadMbpsDuring !== null && downloadMbpsDuring <= 0) issues.push(`${path}.downloadMbpsDuring > 0`);
  if (
    downloadMbpsBefore !== null &&
    downloadMbpsDuring !== null &&
    downloadMbpsBefore > 0 &&
    downloadMbpsDuring / downloadMbpsBefore < 0.8
  ) {
    issues.push(`${path}.downloadMbpsDuring >= 80% of ${path}.downloadMbpsBefore`);
  }

  return issues;
}

function numbersMatchWithinTolerance(actual: number | null, expected: number | null, tolerance = 0.01) {
  return actual !== null && expected !== null && Math.abs(actual - expected) <= tolerance;
}

function normalizedReportPlatform(value: unknown) {
  return nonEmptyString(value) ? value.trim().toLowerCase() : "";
}

function localFileSha256Label(root: string, relativePath: string) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return null;
  return `sha256-${createHash("sha256").update(readFileSync(absolutePath)).digest("hex")}`;
}

function performanceRoutingProofReportIssues(
  root: string,
  row: Record<string, unknown>,
  rowPath: string
): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    row.routingProofArtifact,
    `${rowPath}.routingProofArtifact`,
    "DNS-only/no-full-traffic routing proof inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${rowPath}.routingProofArtifact must contain a freed-routing-proof-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const platform = normalizedReportPlatform(row.platform);
  const reportProtectionMode = nonEmptyString(report.protectionMode) ? report.protectionMode.trim() : "";
  const rowProtectionMode = nonEmptyString(row.protectionMode) ? row.protectionMode.trim() : "";

  if (report.schemaVersion !== "freed-routing-proof-report-v1") {
    reportIssues.push(`${rowPath}.routingProofArtifact.schemaVersion must be freed-routing-proof-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${rowPath}.routingProofArtifact.sanitized must be true`);
  }
  if (report.runId !== row.routingProofRunId) {
    reportIssues.push(`${rowPath}.routingProofArtifact.runId must match ${rowPath}.routingProofRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== platform) {
    reportIssues.push(`${rowPath}.routingProofArtifact.platform must match ${rowPath}.platform`);
  }
  if (!reportProtectionMode || reportProtectionMode !== rowProtectionMode) {
    reportIssues.push(`${rowPath}.routingProofArtifact.protectionMode must match ${rowPath}.protectionMode`);
  } else if (includesAnyTerm(reportProtectionMode, UNSAFE_PROTECTION_MODE_TERMS)) {
    reportIssues.push(`${rowPath}.routingProofArtifact.protectionMode must not describe full VPN/proxy/packet inspection`);
  }

  const requiredChecks = [
    "noFullTrafficProxyConfirmed",
    "noPacketInspectionConfirmed",
    "noMitmHttpsConfirmed",
    "noContinuousPacketCapture",
    "normalBrowsingRouteUnaffected",
    ...(platform === "android"
      ? [
          "dnsOnlyVpnService",
          "privateDnsStateCaptured",
          "vpnStateCaptured",
          "proxySettingsCaptured",
          "routeTableCaptured",
          "noRemoteTrafficTunnel"
        ]
      : []),
    ...(platform === "ios"
      ? [
          "screenTimeManagedSettingsOrSafariLayer",
          "noPacketTunnel",
          "noNetworkExtensionPacketTunnel"
        ]
      : [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${rowPath}.routingProofArtifact.checks.${check}`);
  }

  return reportIssues;
}

function performanceNetworkSpeedReportIssues(
  root: string,
  row: Record<string, unknown>,
  rowPath: string
): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    row.networkSpeedArtifact,
    `${rowPath}.networkSpeedArtifact`,
    "network speed metric inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${rowPath}.networkSpeedArtifact must contain a freed-network-speed-report-v1 JSON object`];

  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const before = numberField(metrics, "downloadMbpsBefore");
  const during = numberField(metrics, "downloadMbpsDuring");
  const rowBefore = numberField(row, "downloadMbpsBefore");
  const rowDuring = numberField(row, "downloadMbpsDuring");

  if (report.schemaVersion !== "freed-network-speed-report-v1") {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.schemaVersion must be freed-network-speed-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.sanitized must be true`);
  }
  if (report.runId !== row.networkSpeedRunId) {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.runId must match ${rowPath}.networkSpeedRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== normalizedReportPlatform(row.platform)) {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.platform must match ${rowPath}.platform`);
  }
  if (!numbersMatchWithinTolerance(before, rowBefore)) {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.metrics.downloadMbpsBefore must match ${rowPath}.downloadMbpsBefore`);
  }
  if (!numbersMatchWithinTolerance(during, rowDuring)) {
    reportIssues.push(`${rowPath}.networkSpeedArtifact.metrics.downloadMbpsDuring must match ${rowPath}.downloadMbpsDuring`);
  }
  const requiredChecks = [
    "normalBrowsingSpeedAcceptable",
    "downloadDuringAtLeast80Percent",
    "sameNetworkBeforeDuring",
    "noFullTrafficProxyConfirmed",
    "noPacketInspectionConfirmed",
    "noMitmHttpsConfirmed"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${rowPath}.networkSpeedArtifact.checks.${check}`);
  }

  return reportIssues;
}

function performanceDnsLatencyReportIssues(
  root: string,
  row: Record<string, unknown>,
  rowPath: string
): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    row.dnsLatencyArtifact,
    `${rowPath}.dnsLatencyArtifact`,
    "DNS latency metric inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${rowPath}.dnsLatencyArtifact must contain a freed-dns-latency-report-v1 JSON object`];

  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const dnsLatencyP95Ms = numberField(metrics, "dnsLatencyP95Ms");
  const rowDnsLatencyP95Ms = numberField(row, "dnsLatencyP95Ms");
  const sampleCount = numberField(metrics, "sampleCount");

  if (report.schemaVersion !== "freed-dns-latency-report-v1") {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.schemaVersion must be freed-dns-latency-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.sanitized must be true`);
  }
  if (report.runId !== row.dnsLatencyRunId) {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.runId must match ${rowPath}.dnsLatencyRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== normalizedReportPlatform(row.platform)) {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.platform must match ${rowPath}.platform`);
  }
  if (!numbersMatchWithinTolerance(dnsLatencyP95Ms, rowDnsLatencyP95Ms)) {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.metrics.dnsLatencyP95Ms must match ${rowPath}.dnsLatencyP95Ms`);
  }
  if (sampleCount === null || sampleCount <= 0) {
    reportIssues.push(`${rowPath}.dnsLatencyArtifact.metrics.sampleCount > 0`);
  }
  const requiredChecks = [
    "dnsLatencyWithinThreshold",
    "dnsOnlyRoutingConfirmed",
    "noFullTrafficProxyConfirmed"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${rowPath}.dnsLatencyArtifact.checks.${check}`);
  }

  return reportIssues;
}

function performancePlatformProfilesIssues(profile: Record<string, unknown>, root: string): string[] {
  const rows = profile.platformProfiles;
  const issues: string[] = [];
  if (!Array.isArray(rows)) return ["profile.platformProfiles[]"];
  if (rows.length < 2) issues.push("profile.platformProfiles[]");

  let hasIos = false;
  let hasAndroid = false;
  const idEntries: Array<{ path: string; value: unknown }> = [];

  rows.forEach((row, index) => {
    const path = `profile.platformProfiles[${index}]`;
    if (!isRecord(row)) {
      issues.push(path);
      return;
    }

    const platform = nonEmptyString(row.platform) ? row.platform.trim().toLowerCase() : "";
    if (!["ios", "android"].includes(platform)) issues.push(`${path}.platform`);
    if (row.isPhysicalDevice !== true) issues.push(`${path}.isPhysicalDevice must be true`);

    if (!nonEmptyString(row.deviceModel)) {
      issues.push(`${path}.deviceModel`);
    } else if (includesAnyTerm(row.deviceModel, ["model", "simulator", "emulator", "sdk_gphone", "generic"])) {
      issues.push(`${path}.deviceModel must name physical hardware`);
    }

    if (!nonEmptyString(row.osVersion)) {
      issues.push(`${path}.osVersion`);
    } else if (platform === "ios" && !/\bios\s*\d+(?:\.\d+){0,2}\b/i.test(row.osVersion.trim())) {
      issues.push(`${path}.osVersion must include a concrete iOS version`);
    } else if (platform === "android" && !/\bandroid\s*\d+(?:\.\d+){0,2}\b/i.test(row.osVersion.trim())) {
      issues.push(`${path}.osVersion must include a concrete Android version`);
    }

    if (!nonEmptyString(row.protectionMode)) {
      issues.push(`${path}.protectionMode`);
    } else if (includesAnyTerm(row.protectionMode, UNSAFE_PROTECTION_MODE_TERMS)) {
      issues.push(
        `${path}.protectionMode must describe DNS-only/Screen Time protection, not full VPN, full traffic proxying, packet inspection, or MITM HTTPS`
      );
    }

    const rowRunIdIssue = evidenceIdIssue(`${path}.runId`, row.runId);
    if (rowRunIdIssue) issues.push(rowRunIdIssue);
    idEntries.push({ path: `${path}.runId`, value: row.runId });
    if (!nonEmptyString(row.profilerArtifact)) {
      issues.push(`${path}.profilerArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, row.profilerArtifact, `${path}.profilerArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }
    const backgroundCpuRunIdIssue = evidenceIdIssue(`${path}.backgroundCpuRunId`, row.backgroundCpuRunId);
    if (backgroundCpuRunIdIssue) issues.push(backgroundCpuRunIdIssue);
    idEntries.push({ path: `${path}.backgroundCpuRunId`, value: row.backgroundCpuRunId });
    if (!nonEmptyString(row.backgroundCpuArtifact)) {
      issues.push(`${path}.backgroundCpuArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, row.backgroundCpuArtifact, `${path}.backgroundCpuArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }
    const routingProofRunIdIssue = evidenceIdIssue(`${path}.routingProofRunId`, row.routingProofRunId);
    if (routingProofRunIdIssue) issues.push(routingProofRunIdIssue);
    idEntries.push({ path: `${path}.routingProofRunId`, value: row.routingProofRunId });
    if (!nonEmptyString(row.routingProofArtifact)) {
      issues.push(`${path}.routingProofArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, row.routingProofArtifact, `${path}.routingProofArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }
    issues.push(...performanceRoutingProofReportIssues(root, row, path));
    const networkSpeedRunIdIssue = evidenceIdIssue(`${path}.networkSpeedRunId`, row.networkSpeedRunId);
    if (networkSpeedRunIdIssue) issues.push(networkSpeedRunIdIssue);
    idEntries.push({ path: `${path}.networkSpeedRunId`, value: row.networkSpeedRunId });
    if (!nonEmptyString(row.networkSpeedArtifact)) {
      issues.push(`${path}.networkSpeedArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, row.networkSpeedArtifact, `${path}.networkSpeedArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }
    const dnsLatencyRunIdIssue = evidenceIdIssue(`${path}.dnsLatencyRunId`, row.dnsLatencyRunId);
    if (dnsLatencyRunIdIssue) issues.push(dnsLatencyRunIdIssue);
    idEntries.push({ path: `${path}.dnsLatencyRunId`, value: row.dnsLatencyRunId });
    if (!nonEmptyString(row.dnsLatencyArtifact)) {
      issues.push(`${path}.dnsLatencyArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, row.dnsLatencyArtifact, `${path}.dnsLatencyArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }

    if (row.normalBrowsingSpeedAcceptable !== true) issues.push(`${path}.normalBrowsingSpeedAcceptable must be true`);
    if (row.noOverheating !== true) issues.push(`${path}.noOverheating must be true`);
    if (row.noBatteryDrainRegression !== true) issues.push(`${path}.noBatteryDrainRegression must be true`);
    if (row.noForegroundPollingLoopObserved !== true) issues.push(`${path}.noForegroundPollingLoopObserved must be true`);
    if (row.noFullTrafficProxyConfirmed !== true) issues.push(`${path}.noFullTrafficProxyConfirmed must be true`);
    if (row.noPacketInspectionConfirmed !== true) issues.push(`${path}.noPacketInspectionConfirmed must be true`);
    if (row.noMitmHttpsConfirmed !== true) issues.push(`${path}.noMitmHttpsConfirmed must be true`);
    if (row.noContinuousScreenshotOrOcrConfirmed !== true) {
      issues.push(`${path}.noContinuousScreenshotOrOcrConfirmed must be true`);
    }
    if (row.noContinuousImageClassificationConfirmed !== true) {
      issues.push(`${path}.noContinuousImageClassificationConfirmed must be true`);
    }
    if (platform === "android") {
      const androidRunIdFields = ["dnsResolverFailoverRunId", "dnsServfailRunId", "vpnRevocationRunId"];
      for (const field of androidRunIdFields) {
        const issue = evidenceIdIssue(`${path}.${field}`, row[field]);
        if (issue) issues.push(issue);
        idEntries.push({ path: `${path}.${field}`, value: row[field] });
      }
      for (const field of ["dnsResolverFailoverArtifact", "dnsServfailArtifact", "vpnRevocationArtifact"]) {
        if (!nonEmptyString(row[field])) {
          issues.push(`${path}.${field}`);
        } else {
          const artifactIssue = missingEvidenceReference(root, row[field], `${path}.${field}`);
          if (artifactIssue) issues.push(artifactIssue);
        }
      }
      if (row.dnsServfailFallbackConfirmed !== true) issues.push(`${path}.dnsServfailFallbackConfirmed must be true`);
      if (row.vpnRevocationCleanupConfirmed !== true) issues.push(`${path}.vpnRevocationCleanupConfirmed must be true`);
    }
    const backgroundCpuPercent = numberField(row, "backgroundCpuPercent");
    if (backgroundCpuPercent === null) {
      issues.push(`${path}.backgroundCpuPercent`);
    } else if (backgroundCpuPercent < 0 || backgroundCpuPercent > 5) {
      issues.push(`${path}.backgroundCpuPercent must be between 0 and 5`);
    }
    issues.push(...performanceThresholdIssues(row, path));
    issues.push(...performanceNetworkSpeedReportIssues(root, row, path));
    issues.push(...performanceDnsLatencyReportIssues(root, row, path));

    if (platform === "ios" && row.isPhysicalDevice === true) hasIos = true;
    if (platform === "android" && row.isPhysicalDevice === true) hasAndroid = true;
  });

  if (!hasIos) issues.push("profile.platformProfiles must include iOS physical device");
  if (!hasAndroid) issues.push("profile.platformProfiles must include Android physical device");
  issues.push(...duplicateEvidenceIdIssues(idEntries));

  return issues;
}

function evidenceUrlCandidate(value: string): string {
  return value.includes("://") ? value : `https://${value}`;
}

function classifiedEvidenceUrlIssues(value: string, path: string, expected: "allow" | "block"): string[] {
  const candidate = evidenceUrlCandidate(value.trim());
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return [`${path} must be a valid URL or host`];
  }
  if (parsed.protocol !== "https:") return [`${path} must use HTTPS`];

  const result = classifyUrl(candidate);
  return result.verdict === expected ? [] : [`${path} must classify ${expected}`];
}

function blockedEvidenceUrlIssues(value: string, path: string): string[] {
  const issues = classifiedEvidenceUrlIssues(value, path, "block");
  const host = urlHost(evidenceUrlCandidate(value.trim()));
  if (
    host === "freedrecovery.app" ||
    host.endsWith(".freedrecovery.app") ||
    host === "example.com" ||
    host.endsWith(".example.com") ||
    host === "example.org" ||
    host.endsWith(".example.org") ||
    host === "example.net" ||
    host.endsWith(".example.net") ||
    host.endsWith(".example") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host.includes("fixture") ||
    host === "localhost"
  ) {
    issues.push(`${path} must use a real external adult host or adult-intent search URL, not an app-owned, fixture, or documentation host`);
  }
  return issues;
}

function safariShortFormUrlIssues(value: string, path: string): string[] {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [`${path} must be a valid HTTPS short-form URL`];
  }

  const issues: string[] = [];
  const coveredBySafariRule = SAFARI_SHORT_FORM_WEB_RULE_FILTERS.some((urlFilter) => new RegExp(urlFilter, "i").test(trimmed));

  if (parsed.protocol !== "https:") issues.push(`${path} must use HTTPS`);
  if (!coveredBySafariRule) {
    issues.push(`${path} must be a YouTube Shorts, Instagram Reels, or TikTok For You web URL covered by FREED's Safari content-blocker rules`);
  }
  return issues;
}

function safariShortFormRuleForUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const hostMatches = (domain: string) => host === domain || host.endsWith(`.${domain}`);

  if (
    hostMatches("youtube.com") &&
    (pathname === "/shorts" || pathname === "/feed/shorts" || pathname.startsWith("/shorts/"))
  ) {
    return "short-form:youtube-shorts";
  }
  if (
    hostMatches("instagram.com") &&
    (pathname === "/reel" || pathname === "/reels" || pathname.startsWith("/reel/") || pathname.startsWith("/reels/"))
  ) {
    return "short-form:instagram-reels";
  }
  if (hostMatches("tiktok.com") && (pathname === "/foryou" || pathname.startsWith("/foryou/"))) {
    return "short-form:tiktok-feed";
  }

  return null;
}

function hostOnlyEvidenceHostIssues(value: string, path: string): string[] {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(evidenceUrlCandidate(trimmed));
  } catch {
    return [`${path} must be a valid host`];
  }

  const issues: string[] = [];
  if (parsed.protocol !== "https:") issues.push(`${path} must use HTTPS when a URL is supplied`);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    issues.push(`${path} must be host-only without path, query, or fragment`);
  }
  if (!parsed.hostname) issues.push(`${path} must include a host`);
  return issues;
}

function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function dnsGuardResolverIssues(value: string): string[] {
  const candidate = value.includes("://") ? value.trim() : `https://${value.trim()}/dns-query`;
  return formatEndpointIssues(getProductionEndpointIssues(candidate, "android.dnsGuardResolver"));
}

function validateShortFormUsageBelowAppLimit(
  issues: string[],
  value: number | null,
  configuredAppShieldDailyLimitMinutes: number | null,
  field: string
) {
  if (value === null || value < 0) {
    issues.push(field);
  } else if (configuredAppShieldDailyLimitMinutes !== null && value >= configuredAppShieldDailyLimitMinutes) {
    issues.push(`${field} must be lower than android.configuredAppShieldDailyLimitMinutes`);
  }
}

function shortFormSurfaceReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    atInterventionSecondsField: string;
    interventionIdField: string;
    packageField: string;
    runIdField: string;
    surface: string;
    usageBeforeLimitMinutesField: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android short-form selected-surface Accessibility inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-short-form-surface-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const rawExpectedPackage = record[config.packageField];
  const rawExpectedInterventionId = record[config.interventionIdField];
  const expectedPackage = nonEmptyString(rawExpectedPackage) ? rawExpectedPackage.trim().toLowerCase() : "";
  const reportPackage = nonEmptyString(report.packageName) ? report.packageName.trim().toLowerCase() : "";
  const expectedInterventionId = nonEmptyString(rawExpectedInterventionId) ? rawExpectedInterventionId.trim() : "";
  const reportSurface = nonEmptyString(report.surface) ? report.surface.trim().toLowerCase() : "";
  const expectedSurface = config.surface.trim().toLowerCase();
  const reportAtInterventionSeconds = numberField(metrics, "atInterventionSeconds");
  const expectedAtInterventionSeconds = numberField(record, config.atInterventionSecondsField);
  const reportUsageBeforeLimitMinutes = numberField(metrics, "usageBeforeLimitMinutes");
  const expectedUsageBeforeLimitMinutes = numberField(record, config.usageBeforeLimitMinutesField);

  if (report.schemaVersion !== "freed-short-form-surface-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-short-form-surface-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (reportPackage !== expectedPackage) {
    reportIssues.push(`${path}.packageName must match android.${config.packageField}`);
  }
  if (report.interventionId !== expectedInterventionId) {
    reportIssues.push(`${path}.interventionId must match android.${config.interventionIdField}`);
  }
  if (reportSurface !== expectedSurface) {
    reportIssues.push(`${path}.surface must be ${config.surface}`);
  }
  if (!numbersMatchWithinTolerance(reportAtInterventionSeconds, expectedAtInterventionSeconds)) {
    reportIssues.push(`${path}.metrics.atInterventionSeconds must match android.${config.atInterventionSecondsField}`);
  }
  if (!numbersMatchWithinTolerance(reportUsageBeforeLimitMinutes, expectedUsageBeforeLimitMinutes)) {
    reportIssues.push(`${path}.metrics.usageBeforeLimitMinutes must match android.${config.usageBeforeLimitMinutesField}`);
  }

  const requiredChecks = [
    "accessibilityNodeTreeUsed",
    "selectedSurfaceConfirmed",
    "focusedSurfaceBeforeIntervention",
    "usageBelowConfiguredAppLimit",
    "noScreenshotAnalysis",
    "noContinuousFrameAnalysis"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidAppInterventionReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    dailyLimitMinutesField?: string;
    extraRequiredChecks?: string[];
    interventionIdField?: string;
    observedSecondsField?: string;
    outcome: "allow" | "block";
    packageField: string;
    reportKind: string;
    runIdField: string;
    surface: string;
    thresholdSecondsField?: string;
    usageBeforeLimitMinutesField?: string;
    usageMinutesField?: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android app and short-form intervention inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-app-intervention-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const rawExpectedPackage = record[config.packageField];
  const expectedPackage = nonEmptyString(rawExpectedPackage) ? rawExpectedPackage.trim().toLowerCase() : "";
  const reportPackage = nonEmptyString(report.packageName) ? report.packageName.trim().toLowerCase() : "";
  const reportSurface = nonEmptyString(report.surface) ? report.surface.trim().toLowerCase() : "";
  const expectedSurface = config.surface.trim().toLowerCase();

  if (report.schemaVersion !== "freed-android-app-intervention-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-app-intervention-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (report.outcome !== config.outcome) {
    reportIssues.push(`${path}.outcome must be ${config.outcome}`);
  }
  if (reportPackage !== expectedPackage) {
    reportIssues.push(`${path}.packageName must match android.${config.packageField}`);
  }
  if (reportSurface !== expectedSurface) {
    reportIssues.push(`${path}.surface must be ${config.surface}`);
  }
  if (config.interventionIdField) {
    const expectedInterventionId = nonEmptyString(record[config.interventionIdField])
      ? record[config.interventionIdField].trim()
      : "";
    if (report.interventionId !== expectedInterventionId) {
      reportIssues.push(`${path}.interventionId must match android.${config.interventionIdField}`);
    }
  }

  const metricMatches = (metricField: string, recordField?: string) => {
    if (!recordField) return;
    if (!numbersMatchWithinTolerance(numberField(metrics, metricField), numberField(record, recordField))) {
      reportIssues.push(`${path}.metrics.${metricField} must match android.${recordField}`);
    }
  };
  metricMatches("usageMinutes", config.usageMinutesField);
  metricMatches("observedSeconds", config.observedSecondsField);
  metricMatches("thresholdSeconds", config.thresholdSecondsField);
  metricMatches("usageBeforeLimitMinutes", config.usageBeforeLimitMinutesField);
  metricMatches("dailyLimitMinutes", config.dailyLimitMinutesField);

  const requiredChecks = [
    "accessibilityEventUsed",
    "usageStatsSnapshotCaptured",
    "configuredPackageSelected",
    "appPackageAllowlisted",
    "noScreenshotAnalysis",
    "noContinuousFrameAnalysis",
    "noContinuousOcr",
    "noPacketInspection",
    "noOverlayPermissionRequired",
    "noRawAppContentStored",
    ...(config.outcome === "allow"
      ? ["thresholdNotReached", "freedInterventionNotLaunched"]
      : ["thresholdReached", "freedInterventionLaunched", "challengeActivityVisible", "handoffStateSanitized"]),
    ...(config.extraRequiredChecks ?? [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidEarnedUnlockReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    extraRequiredChecks?: string[];
    outcome: "allow" | "block";
    reportKind: string;
    runIdField: string;
    usageMinutesField?: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android earned unlock source-scoped allow/relock inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-earned-unlock-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedPackage = nonEmptyString(record.earnedUnlockSourcePackage)
    ? record.earnedUnlockSourcePackage.trim().toLowerCase()
    : "";
  const reportPackage = nonEmptyString(report.packageName) ? report.packageName.trim().toLowerCase() : "";
  const reportSourcePackage = nonEmptyString(report.sourcePackage) ? report.sourcePackage.trim().toLowerCase() : "";

  if (report.schemaVersion !== "freed-android-earned-unlock-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-earned-unlock-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (report.outcome !== config.outcome) {
    reportIssues.push(`${path}.outcome must be ${config.outcome}`);
  }
  if (!reportPackage || reportPackage !== expectedPackage) {
    reportIssues.push(`${path}.packageName must match android.earnedUnlockSourcePackage`);
  }
  if (!reportSourcePackage || reportSourcePackage !== expectedPackage) {
    reportIssues.push(`${path}.sourcePackage must match android.earnedUnlockSourcePackage`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "durationMinutes"), numberField(record, "earnedUnlockDurationMinutes"))) {
    reportIssues.push(`${path}.metrics.durationMinutes must match android.earnedUnlockDurationMinutes`);
  }
  if (config.usageMinutesField) {
    if (!numbersMatchWithinTolerance(numberField(metrics, "usageMinutes"), numberField(record, config.usageMinutesField))) {
      reportIssues.push(`${path}.metrics.usageMinutes must match android.${config.usageMinutesField}`);
    }
    if (
      !numbersMatchWithinTolerance(
        numberField(metrics, "dailyLimitMinutes"),
        numberField(record, "configuredAppShieldDailyLimitMinutes")
      )
    ) {
      reportIssues.push(`${path}.metrics.dailyLimitMinutes must match android.configuredAppShieldDailyLimitMinutes`);
    }
  }

  const requiredChecks = [
    "challengeVerifiedBeforeUnlock",
    "sourcePackageAllowlisted",
    "sourceScopedUnlock",
    "durationBounded",
    "adultFilterStillActive",
    "noBrowserSourceUnlock",
    "noScreenshotAnalysis",
    "noContinuousFrameAnalysis",
    "noContinuousOcr",
    "noPacketInspection",
    "noOverlayPermissionRequired",
    "noRawAppContentStored",
    ...(config.outcome === "allow"
      ? ["unlockWindowActive", "samePackageAllowed", "otherConfiguredAppsStillShielded"]
      : ["unlockExpired", "samePackageRelocked", "usageAtOrAboveDailyLimit", "challengeActivityVisible", "handoffStateSanitized"]),
    ...(config.extraRequiredChecks ?? [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidBrowserEarnedUnlockNoAppUnlockReportIssues(
  record: Record<string, unknown>,
  root: string
): string[] {
  const path = "android.browserEarnedUnlockNoAppUnlockArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.browserEarnedUnlockNoAppUnlockArtifact,
    path,
    "Android browser-sourced earned unlock no-app-unlock inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-browser-earned-unlock-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedSourceHost = nonEmptyString(record.browserEarnedUnlockSourceHost)
    ? urlHost(evidenceUrlCandidate(record.browserEarnedUnlockSourceHost.trim()))
    : "";
  const reportSourceHost = nonEmptyString(report.sourceHost) ? urlHost(evidenceUrlCandidate(report.sourceHost.trim())) : "";
  const expectedConfiguredPackage = nonEmptyString(record.configuredAppShieldPackage)
    ? record.configuredAppShieldPackage.trim().toLowerCase()
    : "";
  const reportConfiguredPackage = nonEmptyString(report.configuredAppPackage)
    ? report.configuredAppPackage.trim().toLowerCase()
    : "";

  if (report.schemaVersion !== "freed-android-browser-earned-unlock-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-browser-earned-unlock-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record.browserEarnedUnlockNoAppUnlockRunId) {
    reportIssues.push(`${path}.runId must match android.browserEarnedUnlockNoAppUnlockRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.reportKind !== "browser-earned-unlock-no-app-unlock") {
    reportIssues.push(`${path}.reportKind must be browser-earned-unlock-no-app-unlock`);
  }
  if (report.outcome !== "block") {
    reportIssues.push(`${path}.outcome must be block`);
  }
  if (report.sourceType !== "blocked-browser-source") {
    reportIssues.push(`${path}.sourceType must be blocked-browser-source`);
  }
  if (!reportSourceHost || reportSourceHost !== expectedSourceHost) {
    reportIssues.push(`${path}.sourceHost must match android.browserEarnedUnlockSourceHost`);
  }
  if (!reportConfiguredPackage || reportConfiguredPackage !== expectedConfiguredPackage) {
    reportIssues.push(`${path}.configuredAppPackage must match android.configuredAppShieldPackage`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "durationMinutes"), numberField(record, "earnedUnlockDurationMinutes"))) {
    reportIssues.push(`${path}.metrics.durationMinutes must match android.earnedUnlockDurationMinutes`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "dailyLimitMinutes"), numberField(record, "configuredAppShieldDailyLimitMinutes"))) {
    reportIssues.push(`${path}.metrics.dailyLimitMinutes must match android.configuredAppShieldDailyLimitMinutes`);
  }
  if (report.nativeAppUnlockActive !== false) {
    reportIssues.push(`${path}.nativeAppUnlockActive must be false`);
  }
  if (report.configuredAppStillShielded !== true) {
    reportIssues.push(`${path}.configuredAppStillShielded must be true`);
  }
  if (report.adultFilterStillActive !== true) {
    reportIssues.push(`${path}.adultFilterStillActive must be true`);
  }

  const requiredChecks = [
    "challengeVerifiedFromBrowserSource",
    "browserSourceHostSanitized",
    "nativeAppUnlockNotActivated",
    "configuredAppStillShielded",
    "adultFilterStillActive",
    "appDailyLimitStillEnforced",
    "noNativeAppUnlockStateCreated",
    "noScreenshotAnalysis",
    "noContinuousFrameAnalysis",
    "noContinuousOcr",
    "noPacketInspection",
    "noOverlayPermissionRequired",
    "noRawUrlStored",
    "noRawAppContentStored"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidPermissionReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    reportKind: "accessibility-permission" | "usage-access-permission" | "notification-permission" | "dns-guard-vpn-consent";
    runIdField: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android permission proof inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-permission-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];

  if (report.schemaVersion !== "freed-android-permission-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-permission-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (!nonEmptyString(report.appPackage)) {
    reportIssues.push(`${path}.appPackage`);
  }

  if (config.reportKind === "dns-guard-vpn-consent") {
    if (report.vpnConsentRequiredBeforeApproval !== true || record.dnsGuardVpnConsentRequiredBeforeApproval !== true) {
      reportIssues.push(`${path}.vpnConsentRequiredBeforeApproval must be true`);
    }
    if (report.vpnConsentRequiredAfterApproval !== false || record.dnsGuardVpnConsentRequiredAfterApproval !== false) {
      reportIssues.push(`${path}.vpnConsentRequiredAfterApproval must be false`);
    }
    if (report.dnsGuardStartedAfterVpnConsent !== true || record.dnsGuardStartedAfterVpnConsent !== true) {
      reportIssues.push(`${path}.dnsGuardStartedAfterVpnConsent must be true`);
    }
    if (report.dnsGuardNoSilentStartWithoutConsent !== true || record.dnsGuardNoSilentStartWithoutConsent !== true) {
      reportIssues.push(`${path}.dnsGuardNoSilentStartWithoutConsent must be true`);
    }
    if (report.dnsGuardDeniedConsentNoPromptLoop !== true || record.dnsGuardDeniedConsentNoPromptLoop !== true) {
      reportIssues.push(`${path}.dnsGuardDeniedConsentNoPromptLoop must be true`);
    }

    const settingsRoutes = nonEmptyStringArray(report.androidSettingsRoutes)
      ? report.androidSettingsRoutes.map((entry) => entry.trim())
      : [];
    const requiredRoutes = [
      "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
      "android.settings.PRIVATE_DNS_SETTINGS",
      "android.settings.ACCESSIBILITY_SETTINGS",
      "android.settings.USAGE_ACCESS_SETTINGS",
      "android.settings.WIRELESS_SETTINGS",
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      "android.settings.SETTINGS"
    ];
    for (const route of requiredRoutes) {
      if (!settingsRoutes.includes(route)) {
        reportIssues.push(`${path}.androidSettingsRoutes must include ${route}`);
      }
    }

    const requiredChecks = [
      "vpnConsentDialogObserved",
      "vpnConsentRequiredBeforeApproval",
      "vpnConsentApprovedByUser",
      "vpnConsentRequiredAfterApprovalFalse",
      "dnsGuardStartedAfterConsent",
      "nativeStatusVpnConsentRequiredFalse",
      "deniedConsentDoesNotLoopPrompt",
      "settingsRoutesCaptured",
      "settingsFallbackRoutesCaptured",
      "noSilentVpnConsentBypass",
      "dnsOnlyVpnService",
      "noFullTrafficProxy",
      "noMitmHttps",
      "noPacketPayloadInspection"
    ];
    for (const check of requiredChecks) {
      if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
    }
  } else if (config.reportKind === "notification-permission") {
    if (report.notificationPermissionRequired !== true || record.notificationPermissionRequired !== true) {
      reportIssues.push(`${path}.notificationPermissionRequired must be true for Android 13+ launch evidence`);
    }
    if (report.notificationPermissionGranted !== true || record.notificationPermissionGranted !== true) {
      reportIssues.push(`${path}.notificationPermissionGranted must be true`);
    }
    if (record.notificationRuntimePromptShown !== true) {
      reportIssues.push(`${path}.notificationRuntimePromptShown must be true`);
    }
    if (record.notificationSettingsFallbackOpenedIfDenied !== true) {
      reportIssues.push(`${path}.notificationSettingsFallbackOpenedIfDenied must be true`);
    }
    const settingsRoutes = nonEmptyStringArray(report.androidSettingsRoutes)
      ? report.androidSettingsRoutes.map((entry) => entry.trim())
      : [];
    if (!settingsRoutes.includes("android.settings.APP_NOTIFICATION_SETTINGS")) {
      reportIssues.push(`${path}.androidSettingsRoutes must include android.settings.APP_NOTIFICATION_SETTINGS`);
    }
    if (report.androidSettingsRouteOpened !== "android.settings.APP_NOTIFICATION_SETTINGS") {
      reportIssues.push(`${path}.androidSettingsRouteOpened must be android.settings.APP_NOTIFICATION_SETTINGS`);
    }
    const requiredChecks = [
      "notificationRuntimePromptShown",
      "nativeStatusCapturedBeforePrompt",
      "nativeStatusCapturedAfterPrompt",
      "notificationPermissionRequiredCaptured",
      "notificationPermissionGrantedCaptured",
      "appNotificationSettingsFallbackCaptured",
      "settingsFallbackOnlyWhenDenied",
      "noSilentNotificationGrant",
      "noNotificationListenerRequirement",
      "noRawNotificationHistoryStored",
      "noDnsHistoryStored",
      "noPacketInspection"
    ];
    for (const check of requiredChecks) {
      if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
    }
  } else if (config.reportKind === "accessibility-permission") {
    if (report.accessibilityServiceEnabled !== true) {
      reportIssues.push(`${path}.accessibilityServiceEnabled must be true`);
    }
    const settingsRoutes = nonEmptyStringArray(report.androidSettingsRoutes)
      ? report.androidSettingsRoutes.map((entry) => entry.trim())
      : [];
    if (!settingsRoutes.includes("android.settings.ACCESSIBILITY_DETAILS_SETTINGS")) {
      reportIssues.push(`${path}.androidSettingsRoutes must include android.settings.ACCESSIBILITY_DETAILS_SETTINGS`);
    }
    if (!nonEmptyString(report.androidSettingsRouteOpened)) {
      reportIssues.push(`${path}.androidSettingsRouteOpened`);
    }
    if (!nonEmptyString(report.androidSettingsRouteComponent)) {
      reportIssues.push(`${path}.androidSettingsRouteComponent`);
    } else {
      const routeComponent = report.androidSettingsRouteComponent.trim();
      if (!routeComponent.includes(report.appPackage) || !routeComponent.includes("FreedAccessibilityService")) {
        reportIssues.push(`${path}.androidSettingsRouteComponent must target FREED AccessibilityService`);
      }
    }
    const requiredChecks = [
      "explicitUserPermissionConfirmed",
      "accessibilityServiceDetailsRouteCaptured",
      "accessibilitySettingsCaptured",
      "enabledServicesCaptured",
      "serviceComponentMatchesFreed",
      "accessibilityServiceEnabled",
      "noHiddenMonitoring",
      "noOverlayPermissionRequired",
      "noScreenshotAnalysis",
      "noContinuousOcr",
      "noPacketInspection"
    ];
    for (const check of requiredChecks) {
      if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
    }
  } else {
    if (report.usageStatsAuthorized !== true || record.usageStatsAuthorized !== true) {
      reportIssues.push(`${path}.usageStatsAuthorized must be true`);
    }
    const settingsRoutes = nonEmptyStringArray(report.androidSettingsRoutes)
      ? report.androidSettingsRoutes.map((entry) => entry.trim())
      : [];
    if (!settingsRoutes.includes("android.settings.USAGE_ACCESS_SETTINGS")) {
      reportIssues.push(`${path}.androidSettingsRoutes must include android.settings.USAGE_ACCESS_SETTINGS`);
    }
    if (report.androidSettingsRouteOpened !== "android.settings.USAGE_ACCESS_SETTINGS") {
      reportIssues.push(`${path}.androidSettingsRouteOpened must be android.settings.USAGE_ACCESS_SETTINGS`);
    }
    if (!nonEmptyString(report.androidUsageAccessManualTogglePath)) {
      reportIssues.push(`${path}.androidUsageAccessManualTogglePath`);
    } else if (!report.androidUsageAccessManualTogglePath.includes("Special app access > Usage access > FREED")) {
      reportIssues.push(`${path}.androidUsageAccessManualTogglePath must point to Special app access > Usage access > FREED`);
    }
    if (!numbersMatchWithinTolerance(numberField(metrics, "usageStatsObservedPackages"), numberField(record, "usageStatsObservedPackages"))) {
      reportIssues.push(`${path}.metrics.usageStatsObservedPackages must match android.usageStatsObservedPackages`);
    }
    if (!numbersMatchWithinTolerance(numberField(metrics, "usageStatsTodayMinutes"), numberField(record, "usageStatsTodayMinutes"))) {
      reportIssues.push(`${path}.metrics.usageStatsTodayMinutes must match android.usageStatsTodayMinutes`);
    }

    const expectedPackages = nonEmptyStringArray(record.usageStatsObservedPackageNames)
      ? record.usageStatsObservedPackageNames.map((entry) => entry.trim().toLowerCase())
      : [];
    const reportPackages = nonEmptyStringArray(metrics.usageStatsObservedPackageNames)
      ? metrics.usageStatsObservedPackageNames.map((entry) => entry.trim().toLowerCase())
      : [];
    for (const expectedPackage of expectedPackages) {
      if (!reportPackages.includes(expectedPackage)) {
        reportIssues.push(`${path}.metrics.usageStatsObservedPackageNames must include ${expectedPackage}`);
      }
    }

    const expectedMinutesByPackage = isRecord(record.usageStatsTodayMinutesByPackage)
      ? record.usageStatsTodayMinutesByPackage
      : {};
    const reportMinutesByPackage = isRecord(metrics.usageStatsTodayMinutesByPackage)
      ? metrics.usageStatsTodayMinutesByPackage
      : {};
    for (const [packageName, expectedMinutes] of Object.entries(expectedMinutesByPackage)) {
      const actualMinutes = numberField(reportMinutesByPackage, packageName);
      const expectedMetric = typeof expectedMinutes === "number" && Number.isFinite(expectedMinutes) ? expectedMinutes : null;
      if (!numbersMatchWithinTolerance(actualMinutes, expectedMetric)) {
        reportIssues.push(`${path}.metrics.usageStatsTodayMinutesByPackage.${packageName} must match android.usageStatsTodayMinutesByPackage.${packageName}`);
      }
    }

    const requiredChecks = [
      "explicitUserPermissionConfirmed",
      "usageAccessSettingsRouteCaptured",
      "usageAccessManualTogglePathCaptured",
      "usageAccessRequiresExplicitUserToggle",
      "noSilentUsageAccessGrant",
      "noPackageSpecificUsageAccessDeepLinkClaim",
      "usageAccessAppOpsCaptured",
      "usageStatsAuthorized",
      "nativeStatusUsageStatsAuthorized",
      "selectedAppPackageDiagnosticsCaptured",
      "usageStatsObservedPackageNamesCaptured",
      "usageStatsTodayMinutesCaptured",
      "aggregateOnlyUsageMetrics",
      "noRawUsageEventsStored",
      "noScreenshotAnalysis",
      "noPacketInspection"
    ];
    for (const check of requiredChecks) {
      if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
    }
  }

  return reportIssues;
}

function androidAdultDomainFeedStatusReportIssues(record: Record<string, unknown>, root: string): string[] {
  const path = "android.adultDomainFeedStatusArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.adultDomainFeedStatusArtifact,
    path,
    "Android native adult-domain feed status inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-adult-domain-feed-status-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedVersion = nonEmptyString(record.adultDomainFeedVersion) ? record.adultDomainFeedVersion.trim() : "";
  const expectedChecksum = nonEmptyString(record.adultDomainFeedChecksum) ? record.adultDomainFeedChecksum.trim().toLowerCase() : "";
  const reportVersion = nonEmptyString(metrics.feedVersion) ? metrics.feedVersion.trim() : "";
  const reportChecksum = nonEmptyString(metrics.feedChecksum) ? metrics.feedChecksum.trim().toLowerCase() : "";

  if (report.schemaVersion !== "freed-android-adult-domain-feed-status-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-adult-domain-feed-status-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record.adultDomainFeedStatusRunId) {
    reportIssues.push(`${path}.runId must match android.adultDomainFeedStatusRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (!reportVersion || reportVersion !== expectedVersion) {
    reportIssues.push(`${path}.metrics.feedVersion must match android.adultDomainFeedVersion`);
  }
  if (!reportChecksum || reportChecksum !== expectedChecksum) {
    reportIssues.push(`${path}.metrics.feedChecksum must match android.adultDomainFeedChecksum`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "domainCount"), numberField(record, "adultDomainFeedDomainCount"))) {
    reportIssues.push(`${path}.metrics.domainCount must match android.adultDomainFeedDomainCount`);
  }
  if (Array.isArray(report.domains)) {
    reportIssues.push(`${path}.domains must be omitted from sanitized status evidence`);
  }

  const requiredChecks = [
    "nativeStatusPanelVisible",
    "adultDomainFeedStatusVisible",
    "feedVersionVisible",
    "feedChecksumVisible",
    "domainCountVisible",
    "cachedNativeFeedPresent",
    "accessibilityFeedSynced",
    "dnsGuardFeedSynced",
    "noRawDomainListStored",
    "noNormalBrowsingHostsStored",
    "noScreenshotAnalysis",
    "noPacketInspection"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function iosEarnedUnlockReportIssues(
  root: string,
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    extraRequiredChecks?: string[];
    outcome: "allow" | "block";
    reportKind: string;
    runIdField: string;
    sourceHostField: string;
    sourceType: "screen-time-shield" | "blocked-browser-source";
  }
): string[] {
  const path = `ios.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "iOS Screen Time earned unlock source-scoped allow/reject/relock inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-ios-earned-unlock-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedSourceHost = nonEmptyString(record[config.sourceHostField])
    ? urlHost(evidenceUrlCandidate(record[config.sourceHostField].trim()))
    : "";
  const reportSourceHost = nonEmptyString(report.sourceHost) ? urlHost(evidenceUrlCandidate(report.sourceHost.trim())) : "";

  if (report.schemaVersion !== "freed-ios-earned-unlock-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-ios-earned-unlock-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match ios.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "ios") {
    reportIssues.push(`${path}.platform must match ios`);
  }
  if (report.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (report.outcome !== config.outcome) {
    reportIssues.push(`${path}.outcome must be ${config.outcome}`);
  }
  if (report.sourceType !== config.sourceType) {
    reportIssues.push(`${path}.sourceType must be ${config.sourceType}`);
  }
  if (!reportSourceHost || reportSourceHost !== expectedSourceHost) {
    reportIssues.push(`${path}.sourceHost must match ios.${config.sourceHostField}`);
  } else if (nonEmptyString(report.sourceHost)) {
    reportIssues.push(...hostOnlyEvidenceHostIssues(report.sourceHost, `${path}.sourceHost`));
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "durationMinutes"), numberField(record, "earnedUnlockDurationMinutes"))) {
    reportIssues.push(`${path}.metrics.durationMinutes must match ios.earnedUnlockDurationMinutes`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "selectedTokenCount"), numberField(record, "earnedUnlockSelectedTokenCount"))) {
    reportIssues.push(`${path}.metrics.selectedTokenCount must match ios.earnedUnlockSelectedTokenCount`);
  }

  const requiredChecks = [
    "screenTimeApiUsed",
    "managedSettingsShieldUsed",
    "sourceScopedUnlock",
    "durationBounded",
    "adultFilterStillActive",
    "sameSelectedTokenCount",
    "noThirdPartyAppScreenInspection",
    "noContinuousScreenRead",
    "noPacketTunnel",
    "noPacketInspection",
    "noMitmHttps",
    "noRawUrlStored",
    ...(config.extraRequiredChecks ?? [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidBrowserInterceptReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    expectedPackage?: string;
    extraRequiredChecks?: string[];
    hostField?: string;
    matchedRuleField?: string;
    matchedRulePrefix?: string;
    packageField?: string;
    packageOneOfTestedBrowsers?: boolean;
    rawQueryStoredField?: string;
    redactedHostField?: string;
    runIdField: string;
    surface: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android browser Accessibility interception inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-android-browser-intercept-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const reportPackage = nonEmptyString(report.browserPackage) ? report.browserPackage.trim().toLowerCase() : "";
  const rawExpectedPackage = config.packageField ? record[config.packageField] : null;
  const expectedPackage = config.expectedPackage
    ? config.expectedPackage.trim().toLowerCase()
    : nonEmptyString(rawExpectedPackage)
      ? rawExpectedPackage.trim().toLowerCase()
      : "";
  const testedBrowsers = nonEmptyStringArray(record.testedBrowserPackages)
    ? record.testedBrowserPackages.map((entry) => entry.trim().toLowerCase())
    : [];
  const reportSurface = nonEmptyString(report.surface) ? report.surface.trim().toLowerCase() : "";
  const expectedSurface = config.surface.trim().toLowerCase();
  const reportMatchedRule = nonEmptyString(report.matchedRule) ? report.matchedRule.trim() : "";

  if (report.schemaVersion !== "freed-android-browser-intercept-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-android-browser-intercept-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (reportSurface !== expectedSurface) {
    reportIssues.push(`${path}.surface must be ${config.surface}`);
  }
  if (expectedPackage && reportPackage !== expectedPackage) {
    reportIssues.push(`${path}.browserPackage must match android.${config.packageField ?? "testedBrowserPackages"}`);
  } else if (config.packageOneOfTestedBrowsers && (!reportPackage || !testedBrowsers.includes(reportPackage))) {
    reportIssues.push(`${path}.browserPackage must be one of android.testedBrowserPackages`);
  }
  if (config.hostField) {
    const expectedHost = nonEmptyString(record[config.hostField])
      ? urlHost(evidenceUrlCandidate(record[config.hostField].trim()))
      : "";
    const reportHost = nonEmptyString(report.host) ? urlHost(evidenceUrlCandidate(report.host.trim())) : "";
    if (!reportHost || reportHost !== expectedHost) {
      reportIssues.push(`${path}.host must match android.${config.hostField}`);
    }
  }
  if (config.redactedHostField) {
    const expectedRedactedHost = nonEmptyString(record[config.redactedHostField])
      ? record[config.redactedHostField].trim().toLowerCase()
      : "";
    const reportRedactedHost = nonEmptyString(report.redactedHost) ? report.redactedHost.trim().toLowerCase() : "";
    if (!reportRedactedHost || reportRedactedHost !== expectedRedactedHost) {
      reportIssues.push(`${path}.redactedHost must match android.${config.redactedHostField}`);
    }
  }
  if (config.matchedRuleField) {
    const expectedMatchedRule = nonEmptyString(record[config.matchedRuleField])
      ? record[config.matchedRuleField].trim()
      : "";
    if (!reportMatchedRule || reportMatchedRule !== expectedMatchedRule) {
      reportIssues.push(`${path}.matchedRule must match android.${config.matchedRuleField}`);
    }
  } else if (config.matchedRulePrefix && !reportMatchedRule.toLowerCase().startsWith(config.matchedRulePrefix.toLowerCase())) {
    reportIssues.push(`${path}.matchedRule must start with ${config.matchedRulePrefix}`);
  }
  if (config.rawQueryStoredField && report.rawQueryStored !== record[config.rawQueryStoredField]) {
    reportIssues.push(`${path}.rawQueryStored must match android.${config.rawQueryStoredField}`);
  }

  const requiredChecks = [
    "accessibilityEventUsed",
    "supportedSurfaceObserved",
    "urlOrSearchFieldObserved",
    "interceptedBeforeNavigation",
    "freedInterventionLaunched",
    "redactedHostOnly",
    "rawUrlNotPersisted",
    "noScreenshotAnalysis",
    "noContinuousOcr",
    "noPacketInspection",
    "noMitmHttps",
    ...(config.extraRequiredChecks ?? [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function dnsGuardBlockReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    extraRequiredChecks?: string[];
    runIdField: string;
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android DNS Guard DNS-only adult-domain block inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-dns-guard-block-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedHost = nonEmptyString(record.adultInterceptedHost)
    ? urlHost(evidenceUrlCandidate(record.adultInterceptedHost.trim()))
    : "";
  const reportHost = nonEmptyString(report.host) ? urlHost(evidenceUrlCandidate(report.host.trim())) : "";
  const expectedResolver = nonEmptyString(record.dnsGuardResolver) ? record.dnsGuardResolver.trim().toLowerCase() : "";
  const reportResolver = nonEmptyString(report.resolver) ? report.resolver.trim().toLowerCase() : "";

  if (report.schemaVersion !== "freed-dns-guard-block-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-dns-guard-block-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (!reportHost || reportHost !== expectedHost) {
    reportIssues.push(`${path}.host must match android.adultInterceptedHost`);
  }
  if (!reportResolver || reportResolver !== expectedResolver) {
    reportIssues.push(`${path}.resolver must match android.dnsGuardResolver`);
  }

  const metricFields = [
    ["sessionQueries", "dnsGuardSessionQueries"],
    ["blockedQueries", "dnsGuardBlockedQueries"],
    ["allowedQueries", "dnsGuardAllowedQueries"],
    ["servfailResponses", "dnsGuardServfailResponses"],
    ["malformedPackets", "dnsGuardMalformedPackets"]
  ] as const;
  for (const [reportField, recordField] of metricFields) {
    if (!numbersMatchWithinTolerance(numberField(metrics, reportField), numberField(record, recordField))) {
      reportIssues.push(`${path}.metrics.${reportField} must match android.${recordField}`);
    }
  }

  const requiredChecks = [
    "dnsOnlyVpnService",
    "adultDomainBlocked",
    "visibleRecoveryPath",
    "noOverlayPermissionRequired",
    "privateDnsStateCaptured",
    "vpnStateCaptured",
    "resolverProbeCaptured",
    "hostSanitized",
    "noFullTrafficProxy",
    "noMitmHttps",
    "noPacketPayloadInspection",
    "noRawDnsPayloadRetained",
    ...(config.extraRequiredChecks ?? [])
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function dnsGuardLifecycleReportIssues(record: Record<string, unknown>, root: string): string[] {
  const path = "android.dnsGuardLifecycleArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.dnsGuardLifecycleArtifact,
    path,
    "Android DNS Guard DNS-only lifecycle counter inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-dns-guard-lifecycle-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedResolver = nonEmptyString(record.dnsGuardResolver) ? record.dnsGuardResolver.trim().toLowerCase() : "";
  const reportResolver = nonEmptyString(report.resolver) ? report.resolver.trim().toLowerCase() : "";

  if (report.schemaVersion !== "freed-dns-guard-lifecycle-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-dns-guard-lifecycle-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (!reportResolver || reportResolver !== expectedResolver) {
    reportIssues.push(`${path}.resolver must match android.dnsGuardResolver`);
  }

  const metricFields = [
    ["sessionQueries", "dnsGuardSessionQueries"],
    ["blockedQueries", "dnsGuardBlockedQueries"],
    ["allowedQueries", "dnsGuardAllowedQueries"],
    ["servfailResponses", "dnsGuardServfailResponses"],
    ["malformedPackets", "dnsGuardMalformedPackets"]
  ] as const;
  for (const [reportField, recordField] of metricFields) {
    if (!numbersMatchWithinTolerance(numberField(metrics, reportField), numberField(record, recordField))) {
      reportIssues.push(`${path}.metrics.${reportField} must match android.${recordField}`);
    }
  }

  const requiredChecks = [
    "dnsOnlyVpnService",
    "nativeStatusPanelVisible",
    "sessionCountersVisible",
    "privateDnsStatusCaptured",
    "vpnStateCaptured",
    "userEnabledStateVisible",
    "foregroundServiceVisible",
    "noFullTrafficProxy",
    "noMitmHttps",
    "noPacketPayloadInspection"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function normalizedDnsGuardRestartAction(value: unknown) {
  return nonEmptyString(value) ? value.trim().replace(/^android\.intent\.action\./i, "").toUpperCase() : "";
}

function normalizedDnsGuardRestartResult(value: unknown) {
  return nonEmptyString(value) ? value.trim().toLowerCase() : "";
}

function dnsGuardRestartReportIssues(
  record: Record<string, unknown>,
  config: {
    artifactField: "dnsGuardRestartArtifact" | "dnsGuardRestartSkippedArtifact";
    reportKind: "restart-started" | "restart-skipped";
    runIdField: "dnsGuardRestartRunId" | "dnsGuardRestartSkippedRunId";
  },
  root: string
): string[] {
  const path = `android.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "Android DNS Guard restart policy inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-dns-guard-restart-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];

  if (report.schemaVersion !== "freed-dns-guard-restart-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-dns-guard-restart-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match android.${config.runIdField}`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (Array.isArray(report.diagnostics) || Array.isArray(report.logcatLines)) {
    reportIssues.push(`${path}.diagnostics must be omitted from sanitized restart evidence`);
  }

  if (config.reportKind === "restart-started") {
    if (normalizedDnsGuardRestartAction(report.action) !== normalizedDnsGuardRestartAction(record.dnsGuardRestartAction)) {
      reportIssues.push(`${path}.action must match android.dnsGuardRestartAction`);
    }
    if (normalizedDnsGuardRestartResult(report.result) !== normalizedDnsGuardRestartResult(record.dnsGuardRestartResult)) {
      reportIssues.push(`${path}.result must match android.dnsGuardRestartResult`);
    }
    if (report.userEnabled !== record.dnsGuardRestartUserEnabled) {
      reportIssues.push(`${path}.userEnabled must match android.dnsGuardRestartUserEnabled`);
    }
    if (report.restartEligible !== record.dnsGuardRestartEligible) {
      reportIssues.push(`${path}.restartEligible must match android.dnsGuardRestartEligible`);
    }
  } else {
    const expectedSkippedReason = normalizedDnsGuardRestartResult(record.dnsGuardRestartSkippedReason);
    const reportSkippedReason = normalizedDnsGuardRestartResult(report.skippedReason);
    if (!reportSkippedReason || reportSkippedReason !== expectedSkippedReason) {
      reportIssues.push(`${path}.skippedReason must match android.dnsGuardRestartSkippedReason`);
    }
    if (report.noSilentPromptConfirmed !== record.dnsGuardRestartNoSilentPromptConfirmed) {
      reportIssues.push(`${path}.noSilentPromptConfirmed must match android.dnsGuardRestartNoSilentPromptConfirmed`);
    }
  }

  const requiredChecks =
    config.reportKind === "restart-started"
      ? [
          "realBootOrPackageUpdateObserved",
          "dnsGuardPreviouslyUserEnabled",
          "androidVpnConsentStillValid",
          "restartEligibilityVisible",
          "restartResultVisible",
          "foregroundServiceVisibleWhenActive",
          "persistentNotificationVisible",
          "noSilentVpnPermissionPrompt",
          "noFullTrafficProxy",
          "noMitmHttps",
          "noPacketPayloadInspection"
        ]
      : [
          "manualStopOrVpnRevocationObserved",
          "skippedReasonVisible",
          "userConsentNotBypassed",
          "dnsGuardNotStartedWithoutConsent",
          "restartResultVisible",
          "noSilentVpnPermissionPrompt",
          "vpnPermissionPromptNotLaunchedSilently",
          "noFullTrafficProxy",
          "noMitmHttps",
          "noPacketPayloadInspection"
        ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function androidPlayPolicyReportIssues(
  record: Record<string, unknown>,
  artifactField: "playPolicyAccessibilityArtifact" | "playPolicySpecialUseFgsArtifact",
  root: string
): string[] {
  const path = `android.${artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[artifactField],
    path,
    "Android Play policy disclosure and manifest inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a ${ANDROID_PLAY_POLICY_PROOF_SCHEMA_VERSION} JSON object`];

  const signals = isRecord(report.signals) ? report.signals : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const reviewIdsStillRequired = Array.isArray(report.reviewIdsStillRequired)
    ? report.reviewIdsStillRequired
    : [];
  const reportIssues: string[] = [];

  if (report.schemaVersion !== ANDROID_PLAY_POLICY_PROOF_SCHEMA_VERSION) {
    reportIssues.push(`${path}.schemaVersion must be ${ANDROID_PLAY_POLICY_PROOF_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (normalizedReportPlatform(report.platform) !== "android") {
    reportIssues.push(`${path}.platform must match android`);
  }
  if (report.playPolicyProofUsableForManualEvidence !== true) {
    reportIssues.push(`${path}.playPolicyProofUsableForManualEvidence must be true`);
  }
  if (report.result !== "local-policy-proof-captured") {
    reportIssues.push(`${path}.result must be local-policy-proof-captured`);
  }
  if (!suggestedEvidenceFields.includes(`android.${artifactField}`)) {
    reportIssues.push(`${path}.suggestedEvidenceFields must include android.${artifactField}`);
  }
  for (const reviewField of ["android.playPolicyAccessibilityReviewId", "android.playPolicySpecialUseFgsReviewId"]) {
    if (!reviewIdsStillRequired.includes(reviewField)) {
      reportIssues.push(`${path}.reviewIdsStillRequired must include ${reviewField}`);
    }
  }
  for (const hashField of ["policyPackHash", "manifestHash", "accessibilityConfigHash"]) {
    if (!nonEmptyString(report[hashField]) || !/^sha256-[0-9a-f]{64}$/i.test(String(report[hashField]).trim())) {
      reportIssues.push(`${path}.${hashField} must use sha256-<64-hex> format`);
    }
  }
  for (const sourcePathField of ["policyPackPath", "manifestPath", "accessibilityConfigPath"]) {
    if (!nonEmptyString(report[sourcePathField])) reportIssues.push(`${path}.${sourcePathField}`);
  }
  for (const signal of ANDROID_PLAY_POLICY_REQUIRED_SIGNALS) {
    if (signals[signal] !== true) reportIssues.push(`${path}.signals.${signal}`);
    if (checks[signal] !== true) reportIssues.push(`${path}.checks.${signal}`);
  }

  return reportIssues;
}

function includesAnyTerm(value: string, terms: string[]) {
  const normalized = value.trim().toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function challengeVerificationEvidenceIssues(
  record: Record<string, unknown>,
  path: "ios" | "android",
  classifier: "Vision" | "ML Kit",
  root: string
): string[] {
  const issues: string[] = [];
  const classifierValue = nonEmptyString(record.challengePhotoClassifier)
    ? record.challengePhotoClassifier.trim().toLowerCase()
    : "";
  const confidence = numberField(record, "challengePhotoConfidence");
  const motionSamples = numberField(record, "challengeMotionSamples");
  const stepCount = numberField(record, "challengeStepCount");
  const locationDistanceMeters = numberField(record, "challengeLocationDistanceMeters");
  const locationSamples = numberField(record, "challengeLocationSamples");
  const locationBestAccuracyMeters = numberField(record, "challengeLocationBestAccuracyMeters");

  if (!classifierValue) {
    issues.push(`${path}.challengePhotoClassifier`);
  } else if (classifier === "Vision" && !classifierValue.includes("vision")) {
    issues.push(`${path}.challengePhotoClassifier must be Vision`);
  } else if (classifier === "ML Kit" && !classifierValue.includes("ml kit")) {
    issues.push(`${path}.challengePhotoClassifier must be ML Kit`);
  }

  if (!nonEmptyString(record.challengePhotoMatchedLabel)) {
    issues.push(`${path}.challengePhotoMatchedLabel`);
  }
  if (confidence === null || confidence < 0.45 || confidence > 1) {
    issues.push(`${path}.challengePhotoConfidence >= 0.45 and <= 1`);
  }
  if (record.challengePhotoFreshCameraOnly !== true) {
    issues.push(`${path}.challengePhotoFreshCameraOnly must be true`);
  }
  if (record.challengePhotoNoBase64OrExif !== true) {
    issues.push(`${path}.challengePhotoNoBase64OrExif must be true`);
  }
  if (record.challengePhotoTemporaryFileDeleted !== true) {
    issues.push(`${path}.challengePhotoTemporaryFileDeleted must be true`);
  }
  if (motionSamples === null || motionSamples < 6) {
    issues.push(`${path}.challengeMotionSamples >= 6`);
  }
  if (stepCount === null || stepCount < 12) {
    issues.push(`${path}.challengeStepCount >= 12`);
  }
  if (locationDistanceMeters === null || locationDistanceMeters < 10) {
    issues.push(`${path}.challengeLocationDistanceMeters >= 10`);
  }
  if (locationSamples === null || locationSamples < 2) {
    issues.push(`${path}.challengeLocationSamples >= 2`);
  }
  if (locationBestAccuracyMeters === null || locationBestAccuracyMeters <= 0 || locationBestAccuracyMeters > 80) {
    issues.push(`${path}.challengeLocationBestAccuracyMeters > 0 and <= 80`);
  }
  issues.push(...challengePhotoReportIssues(record, path, classifier, root));
  issues.push(...challengeMotionReportIssues(record, path, root));
  issues.push(...challengeStepsReportIssues(record, path, root));
  issues.push(...challengeLocationReportIssues(record, path, root));

  return issues;
}

function challengePhotoReportIssues(
  record: Record<string, unknown>,
  path: "ios" | "android",
  classifier: "Vision" | "ML Kit",
  root: string
): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.challengePhotoArtifact,
    `${path}.challengePhotoArtifact`,
    "on-demand challenge photo verification inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path}.challengePhotoArtifact must contain a freed-challenge-photo-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const expectedClassifier = classifier.toLowerCase();
  const reportClassifier = nonEmptyString(report.classifier) ? report.classifier.trim().toLowerCase() : "";
  const reportMatchedLabel = nonEmptyString(report.matchedLabel) ? report.matchedLabel.trim().toLowerCase() : "";
  const expectedMatchedLabel = nonEmptyString(record.challengePhotoMatchedLabel)
    ? record.challengePhotoMatchedLabel.trim().toLowerCase()
    : "";
  const reportConfidence = numberField(metrics, "confidence");
  const expectedConfidence = numberField(record, "challengePhotoConfidence");

  if (report.schemaVersion !== "freed-challenge-photo-report-v1") {
    reportIssues.push(`${path}.challengePhotoArtifact.schemaVersion must be freed-challenge-photo-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.challengePhotoArtifact.sanitized must be true`);
  }
  if (report.runId !== record.challengePhotoRunId) {
    reportIssues.push(`${path}.challengePhotoArtifact.runId must match ${path}.challengePhotoRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== path) {
    reportIssues.push(`${path}.challengePhotoArtifact.platform must match ${path}`);
  }
  if (!reportClassifier.includes(expectedClassifier)) {
    reportIssues.push(`${path}.challengePhotoArtifact.classifier must match ${path}.challengePhotoClassifier`);
  }
  if (reportMatchedLabel !== expectedMatchedLabel) {
    reportIssues.push(`${path}.challengePhotoArtifact.matchedLabel must match ${path}.challengePhotoMatchedLabel`);
  }
  if (!numbersMatchWithinTolerance(reportConfidence, expectedConfidence)) {
    reportIssues.push(`${path}.challengePhotoArtifact.metrics.confidence must match ${path}.challengePhotoConfidence`);
  }

  const requiredChecks = [
    "onDeviceClassifier",
    "onDemandOnly",
    "freshCameraOnly",
    "noBase64OrExif",
    "temporaryFileDeleted",
    "rawPhotoNotPersisted",
    "noContinuousImageClassification"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.challengePhotoArtifact.checks.${check}`);
  }

  return reportIssues;
}

function challengeMotionReportIssues(record: Record<string, unknown>, path: "ios" | "android", root: string): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.challengeMotionArtifact,
    `${path}.challengeMotionArtifact`,
    "on-demand challenge motion verification inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path}.challengeMotionArtifact must contain a freed-challenge-motion-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const reportSampleCount = numberField(metrics, "sampleCount");
  const expectedSampleCount = numberField(record, "challengeMotionSamples");

  if (report.schemaVersion !== "freed-challenge-motion-report-v1") {
    reportIssues.push(`${path}.challengeMotionArtifact.schemaVersion must be freed-challenge-motion-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.challengeMotionArtifact.sanitized must be true`);
  }
  if (report.runId !== record.challengeMotionRunId) {
    reportIssues.push(`${path}.challengeMotionArtifact.runId must match ${path}.challengeMotionRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== path) {
    reportIssues.push(`${path}.challengeMotionArtifact.platform must match ${path}`);
  }
  if (!numbersMatchWithinTolerance(reportSampleCount, expectedSampleCount)) {
    reportIssues.push(`${path}.challengeMotionArtifact.metrics.sampleCount must match ${path}.challengeMotionSamples`);
  }

  const requiredChecks = ["onDeviceSensorSamples", "onDemandOnly", "timerOnlyBypassRejected"];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.challengeMotionArtifact.checks.${check}`);
  }

  return reportIssues;
}

function challengeStepsReportIssues(record: Record<string, unknown>, path: "ios" | "android", root: string): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.challengeStepsArtifact,
    `${path}.challengeStepsArtifact`,
    "on-demand challenge steps verification inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path}.challengeStepsArtifact must contain a freed-challenge-steps-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const reportStepCount = numberField(metrics, "stepCount");
  const expectedStepCount = numberField(record, "challengeStepCount");

  if (report.schemaVersion !== "freed-challenge-steps-report-v1") {
    reportIssues.push(`${path}.challengeStepsArtifact.schemaVersion must be freed-challenge-steps-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.challengeStepsArtifact.sanitized must be true`);
  }
  if (report.runId !== record.challengeStepsRunId) {
    reportIssues.push(`${path}.challengeStepsArtifact.runId must match ${path}.challengeStepsRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== path) {
    reportIssues.push(`${path}.challengeStepsArtifact.platform must match ${path}`);
  }
  if (!numbersMatchWithinTolerance(reportStepCount, expectedStepCount)) {
    reportIssues.push(`${path}.challengeStepsArtifact.metrics.stepCount must match ${path}.challengeStepCount`);
  }

  const requiredChecks = ["pedometerOrHealthData", "onDemandOnly", "timerOnlyBypassRejected"];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.challengeStepsArtifact.checks.${check}`);
  }

  return reportIssues;
}

function challengeLocationReportIssues(record: Record<string, unknown>, path: "ios" | "android", root: string): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.challengeLocationArtifact,
    `${path}.challengeLocationArtifact`,
    "on-demand challenge location verification inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path}.challengeLocationArtifact must contain a freed-challenge-location-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const reportIssues: string[] = [];
  const reportDistanceMeters = numberField(metrics, "distanceMeters");
  const reportSampleCount = numberField(metrics, "sampleCount");
  const reportBestAccuracyMeters = numberField(metrics, "bestAccuracyMeters");
  const expectedDistanceMeters = numberField(record, "challengeLocationDistanceMeters");
  const expectedSampleCount = numberField(record, "challengeLocationSamples");
  const expectedBestAccuracyMeters = numberField(record, "challengeLocationBestAccuracyMeters");

  if (report.schemaVersion !== "freed-challenge-location-report-v1") {
    reportIssues.push(`${path}.challengeLocationArtifact.schemaVersion must be freed-challenge-location-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.challengeLocationArtifact.sanitized must be true`);
  }
  if (report.runId !== record.challengeLocationRunId) {
    reportIssues.push(`${path}.challengeLocationArtifact.runId must match ${path}.challengeLocationRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== path) {
    reportIssues.push(`${path}.challengeLocationArtifact.platform must match ${path}`);
  }
  if (!numbersMatchWithinTolerance(reportDistanceMeters, expectedDistanceMeters)) {
    reportIssues.push(`${path}.challengeLocationArtifact.metrics.distanceMeters must match ${path}.challengeLocationDistanceMeters`);
  }
  if (!numbersMatchWithinTolerance(reportSampleCount, expectedSampleCount)) {
    reportIssues.push(`${path}.challengeLocationArtifact.metrics.sampleCount must match ${path}.challengeLocationSamples`);
  }
  if (!numbersMatchWithinTolerance(reportBestAccuracyMeters, expectedBestAccuracyMeters)) {
    reportIssues.push(`${path}.challengeLocationArtifact.metrics.bestAccuracyMeters must match ${path}.challengeLocationBestAccuracyMeters`);
  }

  const requiredChecks = ["foregroundLocationOnly", "onDemandOnly", "multiSampleRoute", "noRawCoordinatesPersisted"];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.challengeLocationArtifact.checks.${check}`);
  }

  return reportIssues;
}

function permissionWizardReportIssues(record: Record<string, unknown>, path: "ios" | "android", root: string): string[] {
  const artifactPath = `${path}.permissionWizardArtifact`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.permissionWizardArtifact,
    artifactPath,
    `${path} permission wizard flow inspection`
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${artifactPath} must contain a freed-permission-wizard-report-v1 JSON object`];

  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const expectedSummary = nonEmptyString(record.permissionExplanationSummary)
    ? record.permissionExplanationSummary.trim()
    : "";
  const reportSummary = nonEmptyString(report.permissionExplanationSummary)
    ? report.permissionExplanationSummary.trim()
    : "";

  if (report.schemaVersion !== "freed-permission-wizard-report-v1") {
    reportIssues.push(`${artifactPath}.schemaVersion must be freed-permission-wizard-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${artifactPath}.sanitized must be true`);
  }
  if (report.runId !== record.permissionWizardRunId) {
    reportIssues.push(`${artifactPath}.runId must match ${path}.permissionWizardRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== path) {
    reportIssues.push(`${artifactPath}.platform must match ${path}`);
  }
  if (report.flowOrder !== PERMISSION_WIZARD_FLOW_ORDER) {
    reportIssues.push(`${artifactPath}.flowOrder must be ${PERMISSION_WIZARD_FLOW_ORDER}`);
  }
  if (report.permissionExplanationShown !== true) {
    reportIssues.push(`${artifactPath}.permissionExplanationShown must be true`);
  }
  if (!reportSummary || reportSummary !== expectedSummary) {
    reportIssues.push(`${artifactPath}.permissionExplanationSummary must match ${path}.permissionExplanationSummary`);
  }
  const normalizedReportSummary = reportSummary.toLowerCase();
  for (const phrase of PERMISSION_EXPLANATION_REQUIRED_PHRASES) {
    if (!normalizedReportSummary.includes(phrase)) {
      reportIssues.push(`${artifactPath}.permissionExplanationSummary must include "${phrase}"`);
    }
  }
  if (report.testProtectionPassed !== true) {
    reportIssues.push(`${artifactPath}.testProtectionPassed must be true`);
  }

  const requiredChecks = [
    "onboardingGoalsShown",
    "appSelectionShown",
    "paywallShown",
    "explicitProtectionExplanationShown",
    "guidedPermissionSetupShown",
    "testProtectionPassed",
    "activationCompleteShown",
    "permissionExplanationBeforeSystemPrompts",
    "selectedAppsSitesMonitoringExplained",
    "knownAdultDomainBlockingExplained",
    "recoveryChallengeThresholdExplained",
    "noHiddenMonitoring",
    "noScreenshotOrOcrLoop",
    "noRawSelectedTargetsStored",
    "noRawDomainListStored"
  ];
  if (path === "android") {
    requiredChecks.push(...ANDROID_PERMISSION_WIZARD_REQUIRED_CHECKS);
  } else if (path === "ios") {
    requiredChecks.push(...IOS_PERMISSION_WIZARD_REQUIRED_CHECKS);
  }
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${artifactPath}.checks.${check}`);
  }
  if (path === "android") {
    if (report.androidDnsGuardVpnConsentSurface !== "android.net.VpnService.prepare") {
      reportIssues.push(`${artifactPath}.androidDnsGuardVpnConsentSurface must be android.net.VpnService.prepare`);
    }
    if (report.androidUsageAccessSettingsRoute !== "android.settings.USAGE_ACCESS_SETTINGS") {
      reportIssues.push(`${artifactPath}.androidUsageAccessSettingsRoute must be android.settings.USAGE_ACCESS_SETTINGS`);
    }
    if (report.androidAccessibilitySettingsRoute !== "android.settings.ACCESSIBILITY_DETAILS_SETTINGS") {
      reportIssues.push(
        `${artifactPath}.androidAccessibilitySettingsRoute must be android.settings.ACCESSIBILITY_DETAILS_SETTINGS`
      );
    }
    if (!nonEmptyString(report.androidAppPackage)) {
      reportIssues.push(`${artifactPath}.androidAppPackage`);
    }
    if (!nonEmptyString(report.androidAccessibilitySettingsRouteComponent)) {
      reportIssues.push(`${artifactPath}.androidAccessibilitySettingsRouteComponent`);
    } else {
      const component = String(report.androidAccessibilitySettingsRouteComponent).trim();
      const appPackage = nonEmptyString(report.androidAppPackage) ? String(report.androidAppPackage).trim() : "";
      if (!component.includes("FreedAccessibilityService") || (appPackage && !component.includes(appPackage))) {
        reportIssues.push(`${artifactPath}.androidAccessibilitySettingsRouteComponent must target FREED AccessibilityService`);
      }
    }
  }

  return reportIssues;
}

function permissionWizardEvidenceIssues(record: Record<string, unknown>, path: "ios" | "android", root: string): string[] {
  const issues: string[] = [];
  if (record.permissionWizardFlowOrder !== PERMISSION_WIZARD_FLOW_ORDER) {
    issues.push(`${path}.permissionWizardFlowOrder must be ${PERMISSION_WIZARD_FLOW_ORDER}`);
  }
  if (record.permissionExplanationShown !== true) {
    issues.push(`${path}.permissionExplanationShown must be true`);
  }
  issues.push(...permissionExplanationSummaryIssues(record.permissionExplanationSummary, path));
  if (record.permissionWizardTestProtectionPassed !== true) {
    issues.push(`${path}.permissionWizardTestProtectionPassed must be true`);
  }
  if (path === "android") {
    if (record.appSelectionZeroAppContinueDisabled !== true) {
      issues.push("android.appSelectionZeroAppContinueDisabled must be true");
    }
    if (record.appSelectionReturnFromSetup !== true) {
      issues.push("android.appSelectionReturnFromSetup must be true");
    }
    if (record.appSelectionReturnAutoSync !== true) {
      issues.push("android.appSelectionReturnAutoSync must be true");
    }
    if (record.appSelectionReturnNativePackageSyncConfirmed !== true) {
      issues.push("android.appSelectionReturnNativePackageSyncConfirmed must be true");
    }
    if (typeof record.appSelectionReturnSelectedAppCount !== "number" || record.appSelectionReturnSelectedAppCount < 1) {
      issues.push("android.appSelectionReturnSelectedAppCount > 0");
    }
  }
  issues.push(...permissionWizardReportIssues(record, path, root));
  return issues;
}

function androidInstallQaReportIssues(record: Record<string, unknown>, root: string): string[] {
  const artifactPath = "android.installQaArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.installQaArtifact,
    artifactPath,
    "Android physical-device install QA inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${artifactPath} must contain a ${ANDROID_INSTALL_QA_SCHEMA_VERSION} JSON object`];

  const requested = isRecord(report.requested) ? report.requested : {};
  const apk = isRecord(report.apk) ? report.apk : {};
  const apkSignature = isRecord(apk.signature) ? apk.signature : {};
  const device = isRecord(report.device) ? report.device : {};
  const install = isRecord(report.install) ? report.install : {};
  const packageSummary = isRecord(report.package) ? report.package : {};
  const launch = isRecord(report.launch) ? report.launch : {};
  const artifacts = isRecord(report.artifacts) ? report.artifacts : {};
  const protectionHandoff = isRecord(report.protectionHandoff) ? report.protectionHandoff : {};
  const reportIssues: string[] = [];

  if (report.schemaVersion !== ANDROID_INSTALL_QA_SCHEMA_VERSION) {
    reportIssues.push(`${artifactPath}.schemaVersion must be ${ANDROID_INSTALL_QA_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${artifactPath}.sanitized must be true`);
  }
  if (report.status !== "pass") {
    reportIssues.push(`${artifactPath}.status must be pass`);
  }
  if (report.runId !== record.installQaRunId) {
    reportIssues.push(`${artifactPath}.runId must match android.installQaRunId`);
  }

  if (requested.allowEmulator !== false) reportIssues.push(`${artifactPath}.requested.allowEmulator must be false`);
  if (requested.appPackage !== ANDROID_INSTALL_QA_APP_PACKAGE) {
    reportIssues.push(`${artifactPath}.requested.appPackage must be ${ANDROID_INSTALL_QA_APP_PACKAGE}`);
  }
  if (requested.mainActivity !== ANDROID_INSTALL_QA_MAIN_ACTIVITY) {
    reportIssues.push(`${artifactPath}.requested.mainActivity must be ${ANDROID_INSTALL_QA_MAIN_ACTIVITY}`);
  }
  if (requested.skipInstall !== false) reportIssues.push(`${artifactPath}.requested.skipInstall must be false`);
  if (requested.skipLaunch !== false) reportIssues.push(`${artifactPath}.requested.skipLaunch must be false`);
  if (requested.requireUploadSigning !== true) reportIssues.push(`${artifactPath}.requested.requireUploadSigning must be true`);

  if (apk.exists !== true) reportIssues.push(`${artifactPath}.apk.exists must be true`);
  if (!nonEmptyString(apk.sha256) || !/^[a-f0-9]{64}$/i.test(apk.sha256.trim())) {
    reportIssues.push(`${artifactPath}.apk.sha256 must be a 64-character SHA-256 hash`);
  }
  const apkSizeBytes = numberField(apk, "sizeBytes");
  if (apkSizeBytes === null || apkSizeBytes < ANDROID_INSTALL_QA_MIN_APK_BYTES) {
    reportIssues.push(`${artifactPath}.apk.sizeBytes must be at least ${ANDROID_INSTALL_QA_MIN_APK_BYTES}`);
  }
  if (apkSignature.checked !== true) reportIssues.push(`${artifactPath}.apk.signature.checked must be true`);
  if (apkSignature.verified !== true) reportIssues.push(`${artifactPath}.apk.signature.verified must be true`);
  if (apkSignature.debugSigned !== false) reportIssues.push(`${artifactPath}.apk.signature.debugSigned must be false`);
  if (!nonEmptyString(apkSignature.certificateSha256Digest) || !/^[a-f0-9]{64}$/i.test(apkSignature.certificateSha256Digest.trim())) {
    reportIssues.push(`${artifactPath}.apk.signature.certificateSha256Digest must be a 64-character SHA-256 hash`);
  }

  if (!nonEmptyString(device.serial)) reportIssues.push(`${artifactPath}.device.serial`);
  if (device.state !== "device") reportIssues.push(`${artifactPath}.device.state must be device`);
  if (device.emulator !== false) reportIssues.push(`${artifactPath}.device.emulator must be false`);

  if (install.attempted !== true) reportIssues.push(`${artifactPath}.install.attempted must be true`);
  if (install.passed !== true) reportIssues.push(`${artifactPath}.install.passed must be true`);
  if (packageSummary.installed !== true) reportIssues.push(`${artifactPath}.package.installed must be true`);
  if (packageSummary.appPackage !== ANDROID_INSTALL_QA_APP_PACKAGE) {
    reportIssues.push(`${artifactPath}.package.appPackage must be ${ANDROID_INSTALL_QA_APP_PACKAGE}`);
  }
  if (!nonEmptyString(packageSummary.versionCode)) reportIssues.push(`${artifactPath}.package.versionCode`);
  if (!nonEmptyString(packageSummary.versionName)) reportIssues.push(`${artifactPath}.package.versionName`);

  if (launch.attempted !== true) reportIssues.push(`${artifactPath}.launch.attempted must be true`);
  if (launch.passed !== true) reportIssues.push(`${artifactPath}.launch.passed must be true`);
  if (launch.topActivityMatchesPackage !== true) {
    reportIssues.push(`${artifactPath}.launch.topActivityMatchesPackage must be true`);
  }
  if (!nonEmptyString(launch.topActivity) || !launch.topActivity.includes(ANDROID_INSTALL_QA_APP_PACKAGE)) {
    reportIssues.push(`${artifactPath}.launch.topActivity must include ${ANDROID_INSTALL_QA_APP_PACKAGE}`);
  }

  for (const [field, value] of [
    ["screenshot", artifacts.screenshot],
    ["uiDump", artifacts.uiDump]
  ] as const) {
    if (!nonEmptyString(value)) {
      reportIssues.push(`${artifactPath}.artifacts.${field}`);
      continue;
    }
    const artifactIssue = missingEvidenceReference(root, value, `${artifactPath}.artifacts.${field}`);
    if (artifactIssue) reportIssues.push(artifactIssue);
  }

  if (protectionHandoff.required !== true) reportIssues.push(`${artifactPath}.protectionHandoff.required must be true`);
  if (protectionHandoff.flowOrder !== ANDROID_PROTECTION_FLOW_ORDER_STRING) {
    reportIssues.push(`${artifactPath}.protectionHandoff.flowOrder must be ${ANDROID_PROTECTION_FLOW_ORDER_STRING}`);
  }
  if (
    !Array.isArray(protectionHandoff.flowOrderSteps) ||
    protectionHandoff.flowOrderSteps.join(">") !== ANDROID_PROTECTION_FLOW_ORDER_STRING
  ) {
    reportIssues.push(`${artifactPath}.protectionHandoff.flowOrderSteps must match Android activation order`);
  }
  if (
    !nonEmptyString(protectionHandoff.activationReadinessRule) ||
    !protectionHandoff.activationReadinessRule.toLowerCase().includes(ANDROID_ACTIVATION_READINESS_REQUIRED_PHRASE)
  ) {
    reportIssues.push(`${artifactPath}.protectionHandoff.activationReadinessRule must require adult-block and normal-allow activation proof`);
  }
  if (!Array.isArray(protectionHandoff.requiredProofFlags)) {
    reportIssues.push(`${artifactPath}.protectionHandoff.requiredProofFlags[]`);
  } else {
    for (const flag of ANDROID_INSTALL_QA_REQUIRED_PROOF_FLAGS) {
      if (!protectionHandoff.requiredProofFlags.includes(flag)) {
        reportIssues.push(`${artifactPath}.protectionHandoff.requiredProofFlags must include ${flag}`);
      }
    }
  }
  const commandString = nonEmptyString(protectionHandoff.commandString) ? protectionHandoff.commandString : "";
  if (!commandString.includes("npm run evidence:android-real-browser")) {
    reportIssues.push(`${artifactPath}.protectionHandoff.commandString must include npm run evidence:android-real-browser`);
  }
  for (const flag of ANDROID_INSTALL_QA_REQUIRED_PROOF_FLAGS) {
    if (!commandString.includes(flag)) {
      reportIssues.push(`${artifactPath}.protectionHandoff.commandString must include ${flag}`);
    }
  }
  const permissionWizardCommandString = nonEmptyString(protectionHandoff.permissionWizardCommandString)
    ? protectionHandoff.permissionWizardCommandString
    : "";
  if (!permissionWizardCommandString.includes("npm run evidence:permission-wizard")) {
    reportIssues.push(`${artifactPath}.protectionHandoff.permissionWizardCommandString must include npm run evidence:permission-wizard`);
  }
  for (const token of ["--platform android", "--test-protection-passed", "--confirm-common-flow", "--confirm-android-flow"]) {
    if (!permissionWizardCommandString.includes(token)) {
      reportIssues.push(`${artifactPath}.protectionHandoff.permissionWizardCommandString must include ${token}`);
    }
  }
  if (!nonEmptyString(protectionHandoff.permissionWizardReport)) {
    reportIssues.push(`${artifactPath}.protectionHandoff.permissionWizardReport`);
  }

  return reportIssues;
}

function iosSafariContentBlockerReportIssues(
  root: string,
  record: Record<string, unknown>,
  config: {
    artifactField: string;
    runIdField: string;
    reportKind: "reload" | "adult-block" | "short-form-block";
    hostField?: string;
    urlField?: string;
    matchedRuleFromShortFormUrl?: boolean;
    requiredChecks: string[];
  }
): string[] {
  const path = `ios.${config.artifactField}`;
  const { payload, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[config.artifactField],
    path,
    "iOS Safari Content Blocker inspection"
  );
  if (issues.length > 0) return issues;
  if (!payload) return [];
  if (!isRecord(payload)) return [`${path} must contain a freed-ios-safari-content-blocker-report-v1 JSON object`];

  const reportIssues: string[] = [];
  const metrics = isRecord(payload.metrics) ? payload.metrics : {};
  const checks = isRecord(payload.checks) ? payload.checks : {};
  if (payload.schemaVersion !== "freed-ios-safari-content-blocker-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-ios-safari-content-blocker-report-v1`);
  }
  if (payload.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (payload.runId !== record[config.runIdField]) {
    reportIssues.push(`${path}.runId must match ios.${config.runIdField}`);
  }
  if (normalizedReportPlatform(payload.platform) !== "ios") {
    reportIssues.push(`${path}.platform must be ios`);
  }
  if (payload.reportKind !== config.reportKind) {
    reportIssues.push(`${path}.reportKind must be ${config.reportKind}`);
  }
  if (payload.contentBlockerIdentifier !== record.safariContentBlockerIdentifier) {
    reportIssues.push(`${path}.contentBlockerIdentifier must match ios.safariContentBlockerIdentifier`);
  }
  if (payload.version !== record.safariContentBlockerVersion) {
    reportIssues.push(`${path}.version must match ios.safariContentBlockerVersion`);
  }
  if (payload.checksum !== record.safariContentBlockerChecksum) {
    reportIssues.push(`${path}.checksum must match ios.safariContentBlockerChecksum`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "ruleCount"), numberField(record, "safariContentBlockerRuleCount"))) {
    reportIssues.push(`${path}.metrics.ruleCount must match ios.safariContentBlockerRuleCount`);
  }
  if (payload.safariContentBlockerEnabled !== true) {
    reportIssues.push(`${path}.safariContentBlockerEnabled must be true`);
  }

  if (config.hostField) {
    const expectedHost = nonEmptyString(record[config.hostField])
      ? urlHost(evidenceUrlCandidate(record[config.hostField].trim()))
      : "";
    const reportHost = nonEmptyString(payload.host) ? urlHost(evidenceUrlCandidate(payload.host.trim())) : "";
    if (!reportHost) {
      reportIssues.push(`${path}.host`);
    } else if (expectedHost && reportHost !== expectedHost) {
      reportIssues.push(`${path}.host must match ios.${config.hostField}`);
    }
  }

  if (config.urlField) {
    const expectedUrl = nonEmptyString(record[config.urlField]) ? record[config.urlField].trim() : "";
    const reportUrl = nonEmptyString(payload.url) ? payload.url.trim() : "";
    if (!reportUrl) {
      reportIssues.push(`${path}.url`);
    } else if (expectedUrl && reportUrl !== expectedUrl) {
      reportIssues.push(`${path}.url must match ios.${config.urlField}`);
    }
  }

  if (config.matchedRuleFromShortFormUrl) {
    const expectedRule = nonEmptyString(record.safariContentBlockerShortFormUrl)
      ? safariShortFormRuleForUrl(record.safariContentBlockerShortFormUrl)
      : null;
    if (!nonEmptyString(payload.matchedRule)) {
      reportIssues.push(`${path}.matchedRule`);
    } else if (expectedRule && payload.matchedRule.trim().toLowerCase() !== expectedRule) {
      reportIssues.push(`${path}.matchedRule must match ios.safariContentBlockerShortFormUrl`);
    }
  }

  const requiredChecks = [
    "contentBlockerExtensionUsed",
    "safariContentBlockerLayer",
    "safariContentBlockerEnabled",
    "rulesLoadedFromSignedOrSyncedList",
    "noThirdPartyAppScreenInspection",
    "noContinuousScreenRead",
    "noPacketTunnel",
    "noPacketInspection",
    "noMitmHttps",
    ...config.requiredChecks
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function iosSelectedAppDailyLimitReportIssues(root: string, record: Record<string, unknown>): string[] {
  const path = "ios.selectedAppDailyLimitArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record.selectedAppDailyLimitArtifact,
    path,
    "iOS Screen Time selected app daily-limit threshold inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a freed-ios-screen-time-app-limit-report-v1 JSON object`];

  const reportIssues: string[] = [];
  const metrics = isRecord(report.metrics) ? report.metrics : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const selectedTokenCount =
    (numberField(record, "selectedApplicationTokenCount") ?? 0) +
    (numberField(record, "selectedCategoryTokenCount") ?? 0) +
    (numberField(record, "selectedWebDomainTokenCount") ?? 0);

  if (report.schemaVersion !== "freed-ios-screen-time-app-limit-report-v1") {
    reportIssues.push(`${path}.schemaVersion must be freed-ios-screen-time-app-limit-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (report.runId !== record.selectedAppDailyLimitRunId) {
    reportIssues.push(`${path}.runId must match ios.selectedAppDailyLimitRunId`);
  }
  if (normalizedReportPlatform(report.platform) !== "ios") {
    reportIssues.push(`${path}.platform must match ios`);
  }
  if (report.reportKind !== "selected-app-daily-limit-threshold") {
    reportIssues.push(`${path}.reportKind must be selected-app-daily-limit-threshold`);
  }
  if (report.activityName !== record.selectedAppDailyLimitActivityName) {
    reportIssues.push(`${path}.activityName must match ios.selectedAppDailyLimitActivityName`);
  }
  if (report.eventName !== record.selectedAppDailyLimitEventName) {
    reportIssues.push(`${path}.eventName must match ios.selectedAppDailyLimitEventName`);
  }
  if (report.reachedDate !== record.selectedAppDailyLimitReachedDate) {
    reportIssues.push(`${path}.reachedDate must match ios.selectedAppDailyLimitReachedDate`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "dailyLimitMinutes"), numberField(record, "selectedAppDailyLimitMinutes"))) {
    reportIssues.push(`${path}.metrics.dailyLimitMinutes must match ios.selectedAppDailyLimitMinutes`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "selectedApplicationTokenCount"), numberField(record, "selectedApplicationTokenCount"))) {
    reportIssues.push(`${path}.metrics.selectedApplicationTokenCount must match ios.selectedApplicationTokenCount`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "selectedCategoryTokenCount"), numberField(record, "selectedCategoryTokenCount"))) {
    reportIssues.push(`${path}.metrics.selectedCategoryTokenCount must match ios.selectedCategoryTokenCount`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "selectedWebDomainTokenCount"), numberField(record, "selectedWebDomainTokenCount"))) {
    reportIssues.push(`${path}.metrics.selectedWebDomainTokenCount must match ios.selectedWebDomainTokenCount`);
  }
  if (!numbersMatchWithinTolerance(numberField(metrics, "selectedTokenCount"), selectedTokenCount)) {
    reportIssues.push(`${path}.metrics.selectedTokenCount must match ios.selectedTokenCounts`);
  }

  const requiredChecks = [
    "familyActivityPickerSelectionUsed",
    "deviceActivityMonitorScheduled",
    "thresholdEventObserved",
    "selectedTargetsShielded",
    "managedSettingsShieldApplied",
    "adultFilterStillActive",
    "appLimitScheduled",
    "noThirdPartyAppScreenInspection",
    "noContinuousScreenRead",
    "noPacketTunnel",
    "noPacketInspection",
    "noMitmHttps",
    "noRawAppContentStored"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function iosAppPackageProofReportIssues(
  root: string,
  record: Record<string, unknown>,
  artifactField: string
): string[] {
  const path = `ios.${artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    record[artifactField],
    path,
    "iOS signed app package entitlement and Safari blocker build inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path} must contain a ${IOS_APP_PACKAGE_PROOF_SCHEMA_VERSION} JSON object`];

  const app = isRecord(report.app) ? report.app : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const extensions = Array.isArray(report.extensions) ? report.extensions.filter(isRecord) : [];
  const extensionByName = new Map(
    extensions
      .filter((entry) => nonEmptyString(entry.bundleName))
      .map((entry) => [String(entry.bundleName), entry] as const)
  );
  const safariExtension = extensionByName.get("FREEDSafariContentBlocker.appex");
  const safariRuleList = safariExtension && isRecord(safariExtension.safariRuleList) ? safariExtension.safariRuleList : {};
  const safariRuleSignals = isRecord(safariRuleList.ruleSignals) ? safariRuleList.ruleSignals : {};
  const reportIssues: string[] = [];

  if (report.schemaVersion !== IOS_APP_PACKAGE_PROOF_SCHEMA_VERSION) {
    reportIssues.push(`${path}.schemaVersion must be ${IOS_APP_PACKAGE_PROOF_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.sanitized must be true`);
  }
  if (normalizedReportPlatform(report.platform) !== "ios") {
    reportIssues.push(`${path}.platform must match ios`);
  }
  if (report.appGroupId !== IOS_APP_GROUP_ID) {
    reportIssues.push(`${path}.appGroupId must be ${IOS_APP_GROUP_ID}`);
  }
  if (report.packageProofUsableForManualEvidence !== true) {
    reportIssues.push(`${path}.packageProofUsableForManualEvidence must be true`);
  }
  if (Array.isArray(report.entitlementFailures) && report.entitlementFailures.length > 0) {
    reportIssues.push(`${path}.entitlementFailures must be empty`);
  }
  if (Array.isArray(report.safariRuleFailures) && report.safariRuleFailures.length > 0) {
    reportIssues.push(`${path}.safariRuleFailures must be empty`);
  }
  if (Array.isArray(report.missingOrMismatchedExtensions) && report.missingOrMismatchedExtensions.length > 0) {
    reportIssues.push(`${path}.missingOrMismatchedExtensions must be empty`);
  }

  if (app.codesignEntitlementsAvailable !== true) {
    reportIssues.push(`${path}.app.codesignEntitlementsAvailable must be true`);
  }
  if (app.familyControlsEntitled !== true) {
    reportIssues.push(`${path}.app.familyControlsEntitled must be true`);
  }
  if (app.appGroupPresent !== true) {
    reportIssues.push(`${path}.app.appGroupPresent must be true`);
  }
  if (app.completeDataProtectionEntitled !== true) {
    reportIssues.push(`${path}.app.completeDataProtectionEntitled must be true`);
  }
  if (app.packetTunnelProviderEntitled === true) {
    reportIssues.push(`${path}.app.packetTunnelProviderEntitled must be false`);
  }
  if (app.packetInspectionEntitled === true) {
    reportIssues.push(`${path}.app.packetInspectionEntitled must be false`);
  }

  for (const expected of IOS_APP_PACKAGE_REQUIRED_EXTENSIONS) {
    const extension = extensionByName.get(expected.bundleName);
    if (!extension) {
      reportIssues.push(`${path}.extensions must include ${expected.bundleName}`);
      continue;
    }
    if (extension.embedded !== true) reportIssues.push(`${path}.extensions.${expected.bundleName}.embedded must be true`);
    if (extension.extensionPointMatches !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.extensionPointMatches must be true`);
    }
    if (extension.principalClassMatches !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.principalClassMatches must be true`);
    }
    if (extension.codesignEntitlementsAvailable !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.codesignEntitlementsAvailable must be true`);
    }
    if (extension.appGroupPresent !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.appGroupPresent must be true`);
    }
    if (expected.requiresFamilyControls && extension.familyControlsEntitled !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.familyControlsEntitled must be true`);
    }
    if (extension.completeDataProtectionEntitled !== true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.completeDataProtectionEntitled must be true`);
    }
    if (extension.packetTunnelProviderEntitled === true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.packetTunnelProviderEntitled must be false`);
    }
    if (extension.packetInspectionEntitled === true) {
      reportIssues.push(`${path}.extensions.${expected.bundleName}.packetInspectionEntitled must be false`);
    }
  }

  if (!isRecord(safariRuleList)) {
    reportIssues.push(`${path}.extensions.FREEDSafariContentBlocker.appex.safariRuleList`);
  } else {
    if (safariRuleList.available !== true) {
      reportIssues.push(`${path}.safariRuleList.available must be true`);
    }
    if (safariRuleList.allRulesBlock !== true) {
      reportIssues.push(`${path}.safariRuleList.allRulesBlock must be true`);
    }
    if (safariRuleList.usableForManualEvidence !== true) {
      reportIssues.push(`${path}.safariRuleList.usableForManualEvidence must be true`);
    }
    if (
      typeof safariRuleList.ruleCount !== "number" ||
      safariRuleList.ruleCount <= SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length
    ) {
      reportIssues.push(`${path}.safariRuleList.ruleCount must include adult-domain rules plus short-form web rules`);
    }
    if (Array.isArray(safariRuleList.missingSignals) && safariRuleList.missingSignals.length > 0) {
      reportIssues.push(`${path}.safariRuleList.missingSignals must be empty`);
    }
    for (const signal of IOS_APP_PACKAGE_REQUIRED_SAFARI_RULE_SIGNALS) {
      if (safariRuleSignals[signal] !== true) reportIssues.push(`${path}.safariRuleList.ruleSignals.${signal}`);
    }
  }

  const requiredChecks = [
    "codesignEntitlementsAvailable",
    "familyControlsEntitlementPresent",
    "appGroupEntitlementPresent",
    "completeDataProtectionOnApp",
    "completeDataProtectionOnEmbeddedExtensions",
    "screenTimeExtensionsEmbedded",
    "safariContentBlockerEmbedded",
    "adultDomainRulesPresent",
    "shortFormRulesPresent",
    "safariRulesAllBlock",
    "noPacketTunnelEntitlement",
    "noPacketInspectionEntitlement"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.checks.${check}`);
  }

  return reportIssues;
}

function iosPhysicalDeviceIssues(payload: Record<string, unknown>, root: string): string[] {
  const ios = isRecord(payload.ios) ? payload.ios : {};
  const deviceSummary = nonEmptyString(payload.device) ? payload.device : "";
  const applicationTokens = numberField(ios, "selectedApplicationTokenCount");
  const categoryTokens = numberField(ios, "selectedCategoryTokenCount");
  const webDomainTokens = numberField(ios, "selectedWebDomainTokenCount");
  const selectedAppDailyLimitMinutes = numberField(ios, "selectedAppDailyLimitMinutes");
  const safariContentBlockerRuleCount = numberField(ios, "safariContentBlockerRuleCount");
  const iosEarnedUnlockDurationMinutes = numberField(ios, "earnedUnlockDurationMinutes");
  const iosEarnedUnlockSelectedTokenCount = numberField(ios, "earnedUnlockSelectedTokenCount");
  const selectedTokenCount = (applicationTokens ?? 0) + (categoryTokens ?? 0) + (webDomainTokens ?? 0);
  const issues: string[] = [];

  if (includesAnyTerm(deviceSummary, ["simulator", "xcode preview"])) {
    issues.push("device must describe a physical iOS device, not simulator");
  }
  if (ios.isPhysicalDevice !== true) issues.push("ios.isPhysicalDevice must be true");
  if (!nonEmptyString(ios.deviceModel)) {
    issues.push("ios.deviceModel");
  } else if (includesAnyTerm(ios.deviceModel, ["model", "simulator", "emulator"])) {
    issues.push("ios.deviceModel must name a physical iPhone model");
  }
  if (!nonEmptyString(ios.osVersion)) {
    issues.push("ios.osVersion");
  } else if (!/\bios\s*\d+(?:\.\d+){0,2}\b/i.test(ios.osVersion.trim())) {
    issues.push("ios.osVersion must include a concrete iOS version");
  }
  if (!nonEmptyString(ios.familyControlsEntitlementTeamId)) {
    issues.push("ios.familyControlsEntitlementTeamId");
  } else if (!/^[A-Z0-9]{10}$/i.test(ios.familyControlsEntitlementTeamId.trim())) {
    issues.push("ios.familyControlsEntitlementTeamId must use 10-character Apple team ID format");
  }
  if (ios.completeDataProtectionEntitlement !== IOS_COMPLETE_DATA_PROTECTION_ENTITLEMENT) {
    issues.push(`ios.completeDataProtectionEntitlement must be ${IOS_COMPLETE_DATA_PROTECTION_ENTITLEMENT}`);
  }
  const iosEvidenceIdFields = [
    "permissionWizardRunId",
    "familyControlsAuthorizationRunId",
    "familyActivityPickerRunId",
    "managedSettingsFilterRunId",
    "safariContentBlockerBuildRunId",
    "safariContentBlockerReloadRunId",
    "safariContentBlockerAdultBlockRunId",
    "safariContentBlockerShortFormBlockRunId",
    "safariShortFormChallengeHandoffRunId",
    "earnedUnlockAppAllowRunId",
    "earnedUnlockRejectedSourceRunId",
    "earnedUnlockRelockRunId",
    "challengePhotoRunId",
    "challengeMotionRunId",
    "challengeStepsRunId",
    "challengeLocationRunId",
    "selectedShieldTokensRunId",
    "selectedAppDailyLimitRunId",
    "shieldActionHandoffRunId",
    "deviceActivityNightGuardRunId",
    "normalBrowsingRunId",
    "adultInterceptRunId",
    "appGroupProvisioningProfileId"
  ];
  for (const field of iosEvidenceIdFields) {
    const issue = evidenceIdIssue(`ios.${field}`, ios[field]);
    if (issue) issues.push(issue);
  }
  issues.push(
    ...duplicateEvidenceIdIssues(iosEvidenceIdFields.map((field) => ({ path: `ios.${field}`, value: ios[field] })))
  );
  for (const field of [
    "permissionWizardArtifact",
    "familyControlsEntitlementArtifact",
    "appGroupProvisioningArtifact",
    "completeDataProtectionEntitlementArtifact",
    "familyControlsAuthorizationArtifact",
    "familyActivityPickerArtifact",
    "selectedShieldTokensArtifact",
    "selectedAppDailyLimitArtifact",
    "managedSettingsFilterArtifact",
    "safariContentBlockerBuildArtifact",
    "safariContentBlockerReloadArtifact",
    "safariContentBlockerAdultBlockArtifact",
    "safariContentBlockerShortFormBlockArtifact",
    "safariShortFormChallengeHandoffArtifact",
    "earnedUnlockAppAllowArtifact",
    "earnedUnlockRejectedSourceArtifact",
    "earnedUnlockRelockArtifact",
    "challengePhotoArtifact",
    "challengeMotionArtifact",
    "challengeStepsArtifact",
    "challengeLocationArtifact",
    "shieldActionHandoffArtifact",
    "deviceActivityNightGuardArtifact",
    "normalBrowsingArtifact",
    "adultInterceptArtifact"
  ]) {
    if (!nonEmptyString(ios[field])) {
      issues.push(`ios.${field}`);
    } else {
      const artifactIssue = missingEvidenceReference(root, ios[field], `ios.${field}`);
      if (artifactIssue) issues.push(artifactIssue);
    }
  }
  for (const field of IOS_APP_PACKAGE_PROOF_ARTIFACT_FIELDS) {
    issues.push(...iosAppPackageProofReportIssues(root, ios, field));
  }
  issues.push(...permissionWizardEvidenceIssues(ios, "ios", root));
  if (!nonEmptyString(ios.familyControlsStatus)) issues.push("ios.familyControlsStatus");
  else if (ios.familyControlsStatus.trim().toLowerCase() !== "approved") {
    issues.push("ios.familyControlsStatus must be approved");
  }
  if (applicationTokens === null) issues.push("ios.selectedApplicationTokenCount");
  if (categoryTokens === null) issues.push("ios.selectedCategoryTokenCount");
  if (webDomainTokens === null) issues.push("ios.selectedWebDomainTokenCount");
  if (selectedTokenCount <= 0) issues.push("ios.selectedTokenCounts > 0");
  if (ios.familyActivityPickerAppLimitScheduledImmediately !== true) {
    issues.push("ios.familyActivityPickerAppLimitScheduledImmediately must be true");
  }
  if (ios.familyActivityPickerAppLimitActivityName !== "freed.selectedAppDailyLimit") {
    issues.push("ios.familyActivityPickerAppLimitActivityName must be freed.selectedAppDailyLimit");
  }
  if (ios.familyActivityPickerAppLimitEventName !== "freed.selectedAppDailyLimitReached") {
    issues.push("ios.familyActivityPickerAppLimitEventName must be freed.selectedAppDailyLimitReached");
  }
  if (ios.appLimitScheduled !== true) issues.push("ios.appLimitScheduled must be true");
  if (selectedAppDailyLimitMinutes === null) {
    issues.push("ios.selectedAppDailyLimitMinutes");
  } else {
    if (selectedAppDailyLimitMinutes < 5) issues.push("ios.selectedAppDailyLimitMinutes >= 5");
    if (selectedAppDailyLimitMinutes > 240) issues.push("ios.selectedAppDailyLimitMinutes <= 240");
  }
  if (ios.selectedAppDailyLimitActivityName !== "freed.selectedAppDailyLimit") {
    issues.push("ios.selectedAppDailyLimitActivityName must be freed.selectedAppDailyLimit");
  }
  if (ios.selectedAppDailyLimitEventName !== "freed.selectedAppDailyLimitReached") {
    issues.push("ios.selectedAppDailyLimitEventName must be freed.selectedAppDailyLimitReached");
  }
  if (ios.selectedAppDailyLimitReachedToday !== true) {
    issues.push("ios.selectedAppDailyLimitReachedToday must be true");
  }
  if (!nonEmptyString(ios.selectedAppDailyLimitReachedDate)) {
    issues.push("ios.selectedAppDailyLimitReachedDate");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(ios.selectedAppDailyLimitReachedDate.trim())) {
    issues.push("ios.selectedAppDailyLimitReachedDate must use yyyy-MM-dd format");
  }
  issues.push(...iosSelectedAppDailyLimitReportIssues(root, ios));
  if (ios.safariContentBlockerEmbedded !== true) issues.push("ios.safariContentBlockerEmbedded must be true");
  if (ios.safariContentBlockerEnabled !== true) issues.push("ios.safariContentBlockerEnabled must be true");
  if (ios.safariContentBlockerIdentifier !== "app.freed.recovery.safari-content-blocker") {
    issues.push("ios.safariContentBlockerIdentifier must be app.freed.recovery.safari-content-blocker");
  }
  if (!nonEmptyString(ios.safariContentBlockerVersion)) issues.push("ios.safariContentBlockerVersion");
  if (!nonEmptyString(ios.safariContentBlockerChecksum)) {
    issues.push("ios.safariContentBlockerChecksum");
  } else if (!/^fnv1a32:[0-9a-f]{8}$/i.test(ios.safariContentBlockerChecksum.trim())) {
    issues.push("ios.safariContentBlockerChecksum must use fnv1a32:<8-hex> format");
  }
  if (
    safariContentBlockerRuleCount === null ||
    safariContentBlockerRuleCount < MIN_IOS_SAFARI_CONTENT_BLOCKER_RULE_COUNT
  ) {
    issues.push(
      `ios.safariContentBlockerRuleCount > ${SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length} (adult-domain rules plus short-form web rules)`
    );
  }
  issues.push(
    ...iosSafariContentBlockerReportIssues(root, ios, {
      artifactField: "safariContentBlockerReloadArtifact",
      runIdField: "safariContentBlockerReloadRunId",
      reportKind: "reload",
      requiredChecks: ["reloadedViaSafariApi", "adultRulesPresent", "shortFormRulesPresent"]
    }),
    ...iosSafariContentBlockerReportIssues(root, ios, {
      artifactField: "safariContentBlockerAdultBlockArtifact",
      runIdField: "safariContentBlockerAdultBlockRunId",
      reportKind: "adult-block",
      hostField: "adultInterceptedHost",
      requiredChecks: ["adultDomainRuleMatched", "adultNavigationBlocked", "rawUrlNotPersisted"]
    }),
    ...iosSafariContentBlockerReportIssues(root, ios, {
      artifactField: "safariContentBlockerShortFormBlockArtifact",
      runIdField: "safariContentBlockerShortFormBlockRunId",
      reportKind: "short-form-block",
      urlField: "safariContentBlockerShortFormUrl",
      matchedRuleFromShortFormUrl: true,
      requiredChecks: ["shortFormWebRuleMatched", "shortFormNavigationBlocked", "rawPathNotPersisted"]
    })
  );
  if (!nonEmptyString(ios.safariContentBlockerShortFormUrl)) {
    issues.push("ios.safariContentBlockerShortFormUrl");
  } else {
    issues.push(...safariShortFormUrlIssues(ios.safariContentBlockerShortFormUrl, "ios.safariContentBlockerShortFormUrl"));
  }
  const safariShortFormUrlRule = nonEmptyString(ios.safariContentBlockerShortFormUrl)
    ? safariShortFormRuleForUrl(ios.safariContentBlockerShortFormUrl)
    : null;
  if (ios.safariShortFormChallengeHandoffSource !== IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE) {
    issues.push(`ios.safariShortFormChallengeHandoffSource must be ${IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE}`);
  }
  const safariShortFormHandoffRule = nonEmptyString(ios.safariShortFormChallengeHandoffMatchedRule)
    ? ios.safariShortFormChallengeHandoffMatchedRule.trim().toLowerCase()
    : "";
  const expectedHandoffDomain = IOS_SAFARI_SHORT_FORM_RULE_DOMAINS[safariShortFormHandoffRule];
  if (!safariShortFormHandoffRule) {
    issues.push("ios.safariShortFormChallengeHandoffMatchedRule");
  } else if (!expectedHandoffDomain) {
    issues.push(
      "ios.safariShortFormChallengeHandoffMatchedRule must be short-form:youtube-shorts, short-form:instagram-reels, or short-form:tiktok-feed"
    );
  } else if (safariShortFormUrlRule && safariShortFormHandoffRule !== safariShortFormUrlRule) {
    issues.push("ios.safariShortFormChallengeHandoffMatchedRule must match ios.safariContentBlockerShortFormUrl");
  }
  if (!nonEmptyString(ios.safariShortFormChallengeHandoffHost)) {
    issues.push("ios.safariShortFormChallengeHandoffHost");
  } else {
    issues.push(
      ...hostOnlyEvidenceHostIssues(ios.safariShortFormChallengeHandoffHost, "ios.safariShortFormChallengeHandoffHost")
    );
    const handoffHost = urlHost(evidenceUrlCandidate(ios.safariShortFormChallengeHandoffHost.trim()));
    if (expectedHandoffDomain && !hostMatchesDomain(handoffHost, expectedHandoffDomain)) {
      issues.push("ios.safariShortFormChallengeHandoffHost must match the short-form web host");
    }
  }
  if (ios.safariShortFormChallengeHandoffRawPathStored !== false) {
    issues.push("ios.safariShortFormChallengeHandoffRawPathStored must be false");
  }
  if (ios.safariShortFormChallengeHandoffNativeUnlockActive !== false) {
    issues.push("ios.safariShortFormChallengeHandoffNativeUnlockActive must be false");
  }
  if (ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive !== true) {
    issues.push("ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive must be true");
  }
  if (ios.safariShortFormChallengeHandoffAdultFilterStillActive !== true) {
    issues.push("ios.safariShortFormChallengeHandoffAdultFilterStillActive must be true");
  }
  if (
    iosEarnedUnlockDurationMinutes === null ||
    !Number.isInteger(iosEarnedUnlockDurationMinutes) ||
    iosEarnedUnlockDurationMinutes < 1 ||
    iosEarnedUnlockDurationMinutes > 120
  ) {
    issues.push("ios.earnedUnlockDurationMinutes between 1 and 120");
  }
  if (ios.earnedUnlockActivityName !== "freed.earnedUnlockWindow") {
    issues.push("ios.earnedUnlockActivityName must be freed.earnedUnlockWindow");
  }
  if (iosEarnedUnlockSelectedTokenCount === null || iosEarnedUnlockSelectedTokenCount <= 0) {
    issues.push("ios.earnedUnlockSelectedTokenCount");
  } else if (selectedTokenCount > 0 && iosEarnedUnlockSelectedTokenCount !== selectedTokenCount) {
    issues.push("ios.earnedUnlockSelectedTokenCount must equal selected shield token count");
  }
  if (ios.earnedUnlockAdultFilterStillActive !== true) {
    issues.push("ios.earnedUnlockAdultFilterStillActive must be true");
  }
  const earnedUnlockSourceHost = nonEmptyString(ios.earnedUnlockSourceHost)
    ? urlHost(evidenceUrlCandidate(ios.earnedUnlockSourceHost.trim()))
    : "";
  if (!earnedUnlockSourceHost) {
    issues.push("ios.earnedUnlockSourceHost");
  } else if (earnedUnlockSourceHost !== "screen-time-shield.freed.local") {
    issues.push("ios.earnedUnlockSourceHost must be screen-time-shield.freed.local");
  }
  if (!nonEmptyString(ios.earnedUnlockRejectedSourceHost)) {
    issues.push("ios.earnedUnlockRejectedSourceHost");
  } else {
    issues.push(...blockedEvidenceUrlIssues(ios.earnedUnlockRejectedSourceHost, "ios.earnedUnlockRejectedSourceHost"));
    const rejectedSourceHost = urlHost(evidenceUrlCandidate(ios.earnedUnlockRejectedSourceHost.trim()));
    if (rejectedSourceHost === "screen-time-shield.freed.local" || rejectedSourceHost.endsWith(".app.freed.local")) {
      issues.push(
        "ios.earnedUnlockRejectedSourceHost must be a browser/adult-domain source, not a Screen Time or app shield source"
      );
    }
  }
  if (ios.earnedUnlockRejectedSelectedShieldsStayedActive !== true) {
    issues.push("ios.earnedUnlockRejectedSelectedShieldsStayedActive must be true");
  }
  if (ios.earnedUnlockRejectedAdultFilterStillActive !== true) {
    issues.push("ios.earnedUnlockRejectedAdultFilterStillActive must be true");
  }
  issues.push(
    ...iosEarnedUnlockReportIssues(root, ios, {
      artifactField: "earnedUnlockAppAllowArtifact",
      runIdField: "earnedUnlockAppAllowRunId",
      reportKind: "screen-time-allow",
      outcome: "allow",
      sourceHostField: "earnedUnlockSourceHost",
      sourceType: "screen-time-shield",
      extraRequiredChecks: [
        "screenTimeShieldSourceVerified",
        "unlockWindowActive",
        "selectedShieldsTemporarilyUnshielded",
        "deviceActivityRelockScheduled"
      ]
    }),
    ...iosEarnedUnlockReportIssues(root, ios, {
      artifactField: "earnedUnlockRejectedSourceArtifact",
      runIdField: "earnedUnlockRejectedSourceRunId",
      reportKind: "rejected-source",
      outcome: "block",
      sourceHostField: "earnedUnlockRejectedSourceHost",
      sourceType: "blocked-browser-source",
      extraRequiredChecks: [
        "blockedSourceRejected",
        "selectedShieldsStayedActive",
        "adultFilterStillActive",
        "nativeUnlockNotActivated"
      ]
    }),
    ...iosEarnedUnlockReportIssues(root, ios, {
      artifactField: "earnedUnlockRelockArtifact",
      runIdField: "earnedUnlockRelockRunId",
      reportKind: "auto-relock",
      outcome: "block",
      sourceHostField: "earnedUnlockSourceHost",
      sourceType: "screen-time-shield",
      extraRequiredChecks: [
        "unlockExpired",
        "selectedShieldsRelocked",
        "deviceActivityRelockObserved",
        "adultFilterStillActive"
      ]
    })
  );
  issues.push(...challengeVerificationEvidenceIssues(ios, "ios", "Vision", root));
  if (!nonEmptyString(ios.shieldActionInterventionId)) issues.push("ios.shieldActionInterventionId");
  if (!nonEmptyString(ios.deviceActivityName)) issues.push("ios.deviceActivityName");
  if (!nonEmptyString(ios.normalBrowsingAllowedUrl)) issues.push("ios.normalBrowsingAllowedUrl");
  else issues.push(...classifiedEvidenceUrlIssues(ios.normalBrowsingAllowedUrl, "ios.normalBrowsingAllowedUrl", "allow"));
  if (!nonEmptyString(ios.adultInterceptedHost)) issues.push("ios.adultInterceptedHost");
  else issues.push(...blockedEvidenceUrlIssues(ios.adultInterceptedHost, "ios.adultInterceptedHost"));

  return issues;
}

function androidRealBrowserIssues(payload: Record<string, unknown>, root: string): string[] {
  const android = isRecord(payload.android) ? payload.android : {};
  const deviceSummary = nonEmptyString(payload.device) ? payload.device : "";
  const issues: string[] = [];
  const testedBrowserPackages = nonEmptyStringArray(android.testedBrowserPackages)
    ? android.testedBrowserPackages.map((entry) => entry.toLowerCase())
    : [];

  if (includesAnyTerm(deviceSummary, ["emulator", "simulator", "sdk_gphone", "generic"])) {
    issues.push("device must describe Android hardware, not an emulator");
  }
  if (android.isPhysicalDevice !== true) issues.push("android.isPhysicalDevice must be true");
  if (!nonEmptyString(android.deviceModel)) {
    issues.push("android.deviceModel");
  } else if (includesAnyTerm(android.deviceModel, ["android model", "emulator", "simulator", "sdk_gphone", "generic"])) {
    issues.push("android.deviceModel must name Android hardware");
  }
  if (!nonEmptyString(android.osVersion)) {
    issues.push("android.osVersion");
  } else if (!/\bandroid\s*\d+(?:\.\d+){0,2}\b/i.test(android.osVersion.trim())) {
    issues.push("android.osVersion must include a concrete Android version");
  }
  if (android.accessibilityServiceEnabled !== true) issues.push("android.accessibilityServiceEnabled");
  const androidEvidenceIdFields = [
    "installQaRunId",
    "permissionWizardRunId",
    "accessibilityPermissionRunId",
    "usageAccessPermissionRunId",
    "notificationPermissionRunId",
    "chromeInterceptRunId",
    "firefoxInterceptRunId",
    "edgeInterceptRunId",
    "samsungInternetInterceptRunId",
    "focusedBrowserSearchRunId",
    "focusedWebViewRunId",
    "configuredAppShieldBeforeLimitAllowRunId",
    "configuredAppShieldRunId",
    "shortFormBelowThresholdAllowRunId",
    "shortFormRunId",
    "instagramReelsRunId",
    "tiktokFeedRunId",
    "earnedUnlockAppAllowRunId",
    "earnedUnlockRelockRunId",
    "challengePhotoRunId",
    "challengeMotionRunId",
    "challengeStepsRunId",
    "challengeLocationRunId",
    "browserEarnedUnlockNoAppUnlockRunId",
    "dnsGuardVpnConsentRunId",
    "dnsGuardBlockRunId",
    "dnsGuardRestartRunId",
    "dnsGuardRestartSkippedRunId",
    "adultDomainFeedStatusRunId",
    "adultDomainFeedAccessibilityRunId",
    "adultDomainFeedDnsGuardRunId",
    "backStackCleanupRunId",
    "normalBrowsingRunId",
    "playPolicyAccessibilityReviewId",
    "playPolicySpecialUseFgsReviewId"
  ];
  for (const field of androidEvidenceIdFields) {
    const issue = evidenceIdIssue(`android.${field}`, android[field]);
    if (issue) issues.push(issue);
  }
  issues.push(
    ...duplicateEvidenceIdIssues(androidEvidenceIdFields.map((field) => ({ path: `android.${field}`, value: android[field] })))
  );
  for (const field of [
    "installQaArtifact",
    "permissionWizardArtifact",
    "accessibilityPermissionArtifact",
    "usageAccessPermissionArtifact",
    "notificationPermissionArtifact",
    "chromeInterceptArtifact",
    "firefoxInterceptArtifact",
    "edgeInterceptArtifact",
    "samsungInternetInterceptArtifact",
    "focusedBrowserSearchArtifact",
    "focusedWebViewArtifact",
    "configuredAppShieldBeforeLimitAllowArtifact",
    "configuredAppShieldArtifact",
    "shortFormBelowThresholdAllowArtifact",
    "shortFormArtifact",
    "shortFormSelectedSurfaceArtifact",
    "instagramReelsArtifact",
    "instagramReelsSelectedSurfaceArtifact",
    "tiktokFeedArtifact",
    "tiktokFeedSelectedSurfaceArtifact",
    "earnedUnlockAppAllowArtifact",
    "earnedUnlockRelockArtifact",
    "challengePhotoArtifact",
    "challengeMotionArtifact",
    "challengeStepsArtifact",
    "challengeLocationArtifact",
    "browserEarnedUnlockNoAppUnlockArtifact",
    "dnsGuardVpnConsentArtifact",
    "dnsGuardBlockArtifact",
    "dnsGuardLifecycleArtifact",
    "dnsGuardRestartArtifact",
    "dnsGuardRestartSkippedArtifact",
    "adultDomainFeedStatusArtifact",
    "adultDomainFeedAccessibilityArtifact",
    "adultDomainFeedDnsGuardArtifact",
    "backStackCleanupArtifact",
    "normalBrowsingArtifact",
    "playPolicyAccessibilityArtifact",
    "playPolicySpecialUseFgsArtifact"
  ]) {
    if (!nonEmptyString(android[field])) {
      issues.push(`android.${field}`);
    } else {
      const artifactIssue = missingEvidenceReference(root, android[field], `android.${field}`);
      if (artifactIssue) issues.push(artifactIssue);
    }
  }
  issues.push(...androidInstallQaReportIssues(android, root));
  issues.push(...permissionWizardEvidenceIssues(android, "android", root));
  issues.push(...androidPlayPolicyReportIssues(android, "playPolicyAccessibilityArtifact", root));
  issues.push(...androidPlayPolicyReportIssues(android, "playPolicySpecialUseFgsArtifact", root));
  issues.push(
    ...androidPermissionReportIssues(
      android,
      {
        artifactField: "accessibilityPermissionArtifact",
        reportKind: "accessibility-permission",
        runIdField: "accessibilityPermissionRunId"
      },
      root
    )
  );
  issues.push(
    ...androidPermissionReportIssues(
      android,
      {
        artifactField: "usageAccessPermissionArtifact",
        reportKind: "usage-access-permission",
        runIdField: "usageAccessPermissionRunId"
      },
      root
    )
  );
  issues.push(
    ...androidPermissionReportIssues(
      android,
      {
        artifactField: "notificationPermissionArtifact",
        reportKind: "notification-permission",
        runIdField: "notificationPermissionRunId"
      },
      root
    )
  );
  issues.push(...androidAdultDomainFeedStatusReportIssues(android, root));
  if (!nonEmptyStringArray(android.testedBrowserPackages)) issues.push("android.testedBrowserPackages[]");
  else {
    if (!testedBrowserPackages.includes("com.android.chrome")) issues.push("android.testedBrowserPackages must include Chrome");
    if (!testedBrowserPackages.some((entry) => entry.includes("firefox"))) {
      issues.push("android.testedBrowserPackages must include Firefox");
    }
    if (!testedBrowserPackages.some((entry) => entry.includes("microsoft.emmx"))) {
      issues.push("android.testedBrowserPackages must include Edge");
    }
    if (!testedBrowserPackages.some((entry) => entry.includes("com.sec.android.app.sbrowser") || entry.includes("samsung"))) {
      issues.push("android.testedBrowserPackages must include Samsung Internet");
    }
  }
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "chromeInterceptArtifact",
        expectedPackage: "com.android.chrome",
        hostField: "adultInterceptedHost",
        matchedRulePrefix: "adult",
        runIdField: "chromeInterceptRunId",
        surface: "Chrome Adult Intent"
      },
      root
    )
  );
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "firefoxInterceptArtifact",
        expectedPackage: "org.mozilla.firefox",
        hostField: "adultInterceptedHost",
        matchedRulePrefix: "adult",
        runIdField: "firefoxInterceptRunId",
        surface: "Firefox Adult Intent"
      },
      root
    )
  );
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "edgeInterceptArtifact",
        expectedPackage: "com.microsoft.emmx",
        hostField: "adultInterceptedHost",
        matchedRulePrefix: "adult",
        runIdField: "edgeInterceptRunId",
        surface: "Edge Adult Intent"
      },
      root
    )
  );
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "samsungInternetInterceptArtifact",
        expectedPackage: "com.sec.android.app.sbrowser",
        hostField: "adultInterceptedHost",
        matchedRulePrefix: "adult",
        runIdField: "samsungInternetInterceptRunId",
        surface: "Samsung Internet Adult Intent"
      },
      root
    )
  );
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "adultDomainFeedAccessibilityArtifact",
        extraRequiredChecks: [
          "syncedAdultDomainFeedUsed",
          "hostAbsentFromEmbeddedSeed",
          "nativeFeedVersionMatched",
          "nativeFeedChecksumMatched"
        ],
        hostField: "adultInterceptedHost",
        matchedRulePrefix: "adult-domain-feed",
        packageOneOfTestedBrowsers: true,
        runIdField: "adultDomainFeedAccessibilityRunId",
        surface: "Synced Adult Domain Feed Accessibility"
      },
      root
    )
  );
  if (!nonEmptyString(android.focusedBrowserSearchRedactedHost)) {
    issues.push("android.focusedBrowserSearchRedactedHost");
  } else if (android.focusedBrowserSearchRedactedHost.trim().toLowerCase() !== "focused-search.app.freed.local") {
    issues.push("android.focusedBrowserSearchRedactedHost must be focused-search.app.freed.local");
  }
  if (!nonEmptyString(android.focusedBrowserSearchMatchedRule)) {
    issues.push("android.focusedBrowserSearchMatchedRule");
  } else if (!android.focusedBrowserSearchMatchedRule.trim().toLowerCase().startsWith("focused-search:")) {
    issues.push("android.focusedBrowserSearchMatchedRule must start with focused-search:");
  }
  if (android.focusedBrowserSearchRawQueryStored !== false) {
    issues.push("android.focusedBrowserSearchRawQueryStored must be false");
  }
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "focusedBrowserSearchArtifact",
        extraRequiredChecks: ["focusedInputObserved", "rawQueryNotPersisted"],
        matchedRuleField: "focusedBrowserSearchMatchedRule",
        packageOneOfTestedBrowsers: true,
        rawQueryStoredField: "focusedBrowserSearchRawQueryStored",
        redactedHostField: "focusedBrowserSearchRedactedHost",
        runIdField: "focusedBrowserSearchRunId",
        surface: "Focused Browser Search"
      },
      root
    )
  );
  if (!nonEmptyString(android.focusedWebViewPackage)) issues.push("android.focusedWebViewPackage");
  issues.push(
    ...androidBrowserInterceptReportIssues(
      android,
      {
        artifactField: "focusedWebViewArtifact",
        extraRequiredChecks: ["focusedWebViewInputObserved"],
        matchedRulePrefix: "focused-webview:",
        packageField: "focusedWebViewPackage",
        runIdField: "focusedWebViewRunId",
        surface: "Focused WebView"
      },
      root
    )
  );
  const configuredAppShieldPackage = nonEmptyString(android.configuredAppShieldPackage)
    ? android.configuredAppShieldPackage.trim().toLowerCase()
    : "";
  const tiktokFeedPackage = nonEmptyString(android.tiktokFeedPackage) ? android.tiktokFeedPackage.trim().toLowerCase() : "";
  if (!configuredAppShieldPackage) {
    issues.push("android.configuredAppShieldPackage");
  } else if (!allowedAndroidDoomscrollPackages.has(configuredAppShieldPackage)) {
    issues.push("android.configuredAppShieldPackage must be one of FREED's supported doomscroll packages");
  }
  if (!nonEmptyStringArray(android.configuredAppShieldPackages)) {
    issues.push("android.configuredAppShieldPackages[]");
  } else {
    const configuredPackages = android.configuredAppShieldPackages.map((entry) => entry.toLowerCase());
    const invalidPackage = configuredPackages.find((entry) => !allowedAndroidDoomscrollPackages.has(entry));
    if (invalidPackage) issues.push("android.configuredAppShieldPackages[] must only include supported doomscroll packages");
    if (configuredAppShieldPackage && !configuredPackages.includes(configuredAppShieldPackage)) {
      issues.push("android.configuredAppShieldPackages must include android.configuredAppShieldPackage");
    }
    if (!configuredPackages.includes(androidInstagramPackage)) {
      issues.push("android.configuredAppShieldPackages must include android.instagramReelsPackage");
    }
    if (tiktokFeedPackage && !configuredPackages.includes(tiktokFeedPackage)) {
      issues.push("android.configuredAppShieldPackages must include android.tiktokFeedPackage");
    }
  }
  if (!nonEmptyString(android.configuredAppShieldInterventionId)) issues.push("android.configuredAppShieldInterventionId");
  const shortFormPackage = nonEmptyString(android.shortFormPackage) ? android.shortFormPackage.trim().toLowerCase() : "";
  if (!shortFormPackage) {
    issues.push("android.shortFormPackage");
  } else if (shortFormPackage !== YOUTUBE_ANDROID_PACKAGE) {
    issues.push("android.shortFormPackage must be com.google.android.youtube");
  } else if (
    nonEmptyStringArray(android.configuredAppShieldPackages) &&
    !android.configuredAppShieldPackages.map((entry) => entry.toLowerCase()).includes(shortFormPackage)
  ) {
    issues.push("android.configuredAppShieldPackages must include android.shortFormPackage");
  }
  const configuredAppShieldDailyLimitMinutes = numberField(android, "configuredAppShieldDailyLimitMinutes");
  const configuredAppShieldUsageBeforeLimitMinutes = numberField(android, "configuredAppShieldUsageBeforeLimitMinutes");
  const configuredAppShieldUsageAtInterventionMinutes = numberField(android, "configuredAppShieldUsageAtInterventionMinutes");
  const usageStatsObservedPackages = numberField(android, "usageStatsObservedPackages");
  const usageStatsTodayMinutes = numberField(android, "usageStatsTodayMinutes");
  const usageStatsObservedPackageNames = nonEmptyStringArray(android.usageStatsObservedPackageNames)
    ? android.usageStatsObservedPackageNames.map((entry) => entry.trim().toLowerCase())
    : null;
  const usageStatsTodayMinutesByPackage = isRecord(android.usageStatsTodayMinutesByPackage)
    ? android.usageStatsTodayMinutesByPackage
    : null;
  const expectedUsageStatsPackages = new Set(
    [configuredAppShieldPackage, shortFormPackage, androidInstagramPackage, tiktokFeedPackage].filter(Boolean)
  );
  const shortFormThresholdSeconds = numberField(android, "shortFormThresholdSeconds");
  const shortFormBelowThresholdSeconds = numberField(android, "shortFormBelowThresholdSeconds");
  const shortFormAtInterventionSeconds = numberField(android, "shortFormAtInterventionSeconds");
  const shortFormUsageBeforeLimitMinutes = numberField(android, "shortFormUsageBeforeLimitMinutes");
  const instagramReelsAtInterventionSeconds = numberField(android, "instagramReelsAtInterventionSeconds");
  const instagramReelsUsageBeforeLimitMinutes = numberField(android, "instagramReelsUsageBeforeLimitMinutes");
  const tiktokFeedAtInterventionSeconds = numberField(android, "tiktokFeedAtInterventionSeconds");
  const tiktokFeedUsageBeforeLimitMinutes = numberField(android, "tiktokFeedUsageBeforeLimitMinutes");
  const earnedUnlockRelockUsageMinutes = numberField(android, "earnedUnlockRelockUsageMinutes");
  const browserEarnedUnlockSourceHost = nonEmptyString(android.browserEarnedUnlockSourceHost)
    ? android.browserEarnedUnlockSourceHost.trim().toLowerCase()
    : "";
  const dnsGuardSessionQueries = numberField(android, "dnsGuardSessionQueries");
  const dnsGuardBlockedQueries = numberField(android, "dnsGuardBlockedQueries");
  const dnsGuardAllowedQueries = numberField(android, "dnsGuardAllowedQueries");
  const dnsGuardServfailResponses = numberField(android, "dnsGuardServfailResponses");
  const dnsGuardMalformedPackets = numberField(android, "dnsGuardMalformedPackets");
  if (
    configuredAppShieldDailyLimitMinutes === null ||
    !Number.isInteger(configuredAppShieldDailyLimitMinutes) ||
    configuredAppShieldDailyLimitMinutes < 5 ||
    configuredAppShieldDailyLimitMinutes > 240
  ) {
    issues.push("android.configuredAppShieldDailyLimitMinutes");
  }
  if (configuredAppShieldUsageBeforeLimitMinutes === null || configuredAppShieldUsageBeforeLimitMinutes < 0) {
    issues.push("android.configuredAppShieldUsageBeforeLimitMinutes");
  } else if (
    configuredAppShieldDailyLimitMinutes !== null &&
    configuredAppShieldUsageBeforeLimitMinutes >= configuredAppShieldDailyLimitMinutes
  ) {
    issues.push("android.configuredAppShieldUsageBeforeLimitMinutes must be lower than android.configuredAppShieldDailyLimitMinutes");
  }
  if (configuredAppShieldUsageAtInterventionMinutes === null || configuredAppShieldUsageAtInterventionMinutes < 0) {
    issues.push("android.configuredAppShieldUsageAtInterventionMinutes");
  } else if (
    configuredAppShieldDailyLimitMinutes !== null &&
    configuredAppShieldUsageAtInterventionMinutes < configuredAppShieldDailyLimitMinutes
  ) {
    issues.push("android.configuredAppShieldUsageAtInterventionMinutes must be at least android.configuredAppShieldDailyLimitMinutes");
  }
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "configuredAppShieldBeforeLimitAllowArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: ["appDailyLimitCompared", "usageBelowDailyLimit", "appLaunchAllowed"],
        outcome: "allow",
        packageField: "configuredAppShieldPackage",
        reportKind: "configured-app-before-limit-allow",
        runIdField: "configuredAppShieldBeforeLimitAllowRunId",
        surface: "Configured App Before Limit",
        usageMinutesField: "configuredAppShieldUsageBeforeLimitMinutes"
      },
      root
    )
  );
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "configuredAppShieldArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: ["appDailyLimitCompared", "usageAtOrAboveDailyLimit", "nativeInterventionVisible"],
        interventionIdField: "configuredAppShieldInterventionId",
        outcome: "block",
        packageField: "configuredAppShieldPackage",
        reportKind: "configured-app-threshold-block",
        runIdField: "configuredAppShieldRunId",
        surface: "Configured App Shield",
        usageMinutesField: "configuredAppShieldUsageAtInterventionMinutes"
      },
      root
    )
  );
  if (android.usageStatsAuthorized !== true) issues.push("android.usageStatsAuthorized must be true");
  if (usageStatsObservedPackages === null || usageStatsObservedPackages <= 0) {
    issues.push("android.usageStatsObservedPackages > 0");
  } else if (usageStatsObservedPackages < expectedUsageStatsPackages.size) {
    issues.push(
      "android.usageStatsObservedPackages must cover every distinct configured and short-form proof package"
    );
  }
  if (!usageStatsObservedPackageNames) {
    issues.push("android.usageStatsObservedPackageNames[]");
  } else {
    const missingObservedPackage = [...expectedUsageStatsPackages].find((packageName) => !usageStatsObservedPackageNames.includes(packageName));
    if (missingObservedPackage) {
      issues.push("android.usageStatsObservedPackageNames must include every configured and short-form proof package");
    }
  }
  if (usageStatsTodayMinutes === null || usageStatsTodayMinutes < 0) {
    issues.push("android.usageStatsTodayMinutes");
  } else if (
    configuredAppShieldUsageBeforeLimitMinutes !== null &&
    usageStatsTodayMinutes < configuredAppShieldUsageBeforeLimitMinutes
  ) {
    issues.push("android.usageStatsTodayMinutes must be at least android.configuredAppShieldUsageBeforeLimitMinutes");
  }
  if (!usageStatsTodayMinutesByPackage) {
    issues.push("android.usageStatsTodayMinutesByPackage");
  } else {
    const missingUsagePackage = [...expectedUsageStatsPackages].find((packageName) => {
      const minutes = usageStatsTodayMinutesByPackage[packageName];
      return typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0;
    });
    if (missingUsagePackage) {
      issues.push("android.usageStatsTodayMinutesByPackage must include non-negative minutes for every configured and short-form proof package");
    }

    if (configuredAppShieldPackage && configuredAppShieldUsageBeforeLimitMinutes !== null) {
      const configuredPackageMinutes = usageStatsTodayMinutesByPackage[configuredAppShieldPackage];
      if (
        typeof configuredPackageMinutes === "number" &&
        Number.isFinite(configuredPackageMinutes) &&
        configuredPackageMinutes < configuredAppShieldUsageBeforeLimitMinutes
      ) {
        issues.push(
          "android.usageStatsTodayMinutesByPackage[android.configuredAppShieldPackage] must be at least android.configuredAppShieldUsageBeforeLimitMinutes"
        );
      }
    }
  }
  if (
    shortFormThresholdSeconds === null ||
    !Number.isInteger(shortFormThresholdSeconds) ||
    shortFormThresholdSeconds < 30 ||
    shortFormThresholdSeconds > 300
  ) {
    issues.push("android.shortFormThresholdSeconds");
  }
  if (shortFormBelowThresholdSeconds === null || shortFormBelowThresholdSeconds < 0) {
    issues.push("android.shortFormBelowThresholdSeconds");
  } else if (shortFormThresholdSeconds !== null && shortFormBelowThresholdSeconds >= shortFormThresholdSeconds) {
    issues.push("android.shortFormBelowThresholdSeconds must be lower than android.shortFormThresholdSeconds");
  }
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "shortFormBelowThresholdAllowArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: [
          "shortFormThresholdCompared",
          "shortFormBelowThresholdAllowed",
          "usageBelowConfiguredAppLimit",
          "noRawScreenTextPersisted"
        ],
        observedSecondsField: "shortFormBelowThresholdSeconds",
        outcome: "allow",
        packageField: "shortFormPackage",
        reportKind: "short-form-below-threshold-allow",
        runIdField: "shortFormBelowThresholdAllowRunId",
        surface: "YouTube Shorts",
        thresholdSecondsField: "shortFormThresholdSeconds",
        usageBeforeLimitMinutesField: "shortFormUsageBeforeLimitMinutes"
      },
      root
    )
  );
  if (shortFormAtInterventionSeconds === null || shortFormAtInterventionSeconds < 0) {
    issues.push("android.shortFormAtInterventionSeconds");
  } else if (shortFormThresholdSeconds !== null && shortFormAtInterventionSeconds < shortFormThresholdSeconds) {
    issues.push("android.shortFormAtInterventionSeconds must be at least android.shortFormThresholdSeconds");
  }
  validateShortFormUsageBelowAppLimit(
    issues,
    shortFormUsageBeforeLimitMinutes,
    configuredAppShieldDailyLimitMinutes,
    "android.shortFormUsageBeforeLimitMinutes"
  );
  if (!nonEmptyString(android.shortFormInterventionId)) {
    issues.push("android.shortFormInterventionId");
  } else if (android.shortFormInterventionId.trim() !== "short-form:youtube-shorts") {
    issues.push("android.shortFormInterventionId must be short-form:youtube-shorts");
  }
  if (android.shortFormSelectedSurfaceVerified !== true) {
    issues.push("android.shortFormSelectedSurfaceVerified must be true");
  }
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "shortFormArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: [
          "shortFormThresholdCompared",
          "selectedSurfaceReportPaired",
          "scrollOrSurfaceEventUsed",
          "usageBelowConfiguredAppLimit",
          "noRawScreenTextPersisted"
        ],
        interventionIdField: "shortFormInterventionId",
        observedSecondsField: "shortFormAtInterventionSeconds",
        outcome: "block",
        packageField: "shortFormPackage",
        reportKind: "short-form-threshold-block",
        runIdField: "shortFormRunId",
        surface: "YouTube Shorts",
        thresholdSecondsField: "shortFormThresholdSeconds",
        usageBeforeLimitMinutesField: "shortFormUsageBeforeLimitMinutes"
      },
      root
    )
  );
  issues.push(
    ...shortFormSurfaceReportIssues(
      android,
      {
        artifactField: "shortFormSelectedSurfaceArtifact",
        atInterventionSecondsField: "shortFormAtInterventionSeconds",
        interventionIdField: "shortFormInterventionId",
        packageField: "shortFormPackage",
        runIdField: "shortFormRunId",
        surface: "YouTube Shorts",
        usageBeforeLimitMinutesField: "shortFormUsageBeforeLimitMinutes"
      },
      root
    )
  );
  if (!nonEmptyString(android.instagramReelsPackage)) {
    issues.push("android.instagramReelsPackage");
  } else if (android.instagramReelsPackage.trim().toLowerCase() !== androidInstagramPackage) {
    issues.push("android.instagramReelsPackage must be com.instagram.android");
  }
  if (instagramReelsAtInterventionSeconds === null || instagramReelsAtInterventionSeconds < 0) {
    issues.push("android.instagramReelsAtInterventionSeconds");
  } else if (shortFormThresholdSeconds !== null && instagramReelsAtInterventionSeconds < shortFormThresholdSeconds) {
    issues.push("android.instagramReelsAtInterventionSeconds must be at least android.shortFormThresholdSeconds");
  }
  validateShortFormUsageBelowAppLimit(
    issues,
    instagramReelsUsageBeforeLimitMinutes,
    configuredAppShieldDailyLimitMinutes,
    "android.instagramReelsUsageBeforeLimitMinutes"
  );
  if (!nonEmptyString(android.instagramReelsInterventionId)) {
    issues.push("android.instagramReelsInterventionId");
  } else if (android.instagramReelsInterventionId.trim() !== "short-form:instagram-reels") {
    issues.push("android.instagramReelsInterventionId must be short-form:instagram-reels");
  }
  if (android.instagramReelsSelectedSurfaceVerified !== true) {
    issues.push("android.instagramReelsSelectedSurfaceVerified must be true");
  }
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "instagramReelsArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: [
          "shortFormThresholdCompared",
          "selectedSurfaceReportPaired",
          "scrollOrSurfaceEventUsed",
          "usageBelowConfiguredAppLimit",
          "noRawScreenTextPersisted"
        ],
        interventionIdField: "instagramReelsInterventionId",
        observedSecondsField: "instagramReelsAtInterventionSeconds",
        outcome: "block",
        packageField: "instagramReelsPackage",
        reportKind: "short-form-threshold-block",
        runIdField: "instagramReelsRunId",
        surface: "Instagram Reels",
        thresholdSecondsField: "shortFormThresholdSeconds",
        usageBeforeLimitMinutesField: "instagramReelsUsageBeforeLimitMinutes"
      },
      root
    )
  );
  issues.push(
    ...shortFormSurfaceReportIssues(
      android,
      {
        artifactField: "instagramReelsSelectedSurfaceArtifact",
        atInterventionSecondsField: "instagramReelsAtInterventionSeconds",
        interventionIdField: "instagramReelsInterventionId",
        packageField: "instagramReelsPackage",
        runIdField: "instagramReelsRunId",
        surface: "Instagram Reels",
        usageBeforeLimitMinutesField: "instagramReelsUsageBeforeLimitMinutes"
      },
      root
    )
  );
  if (!tiktokFeedPackage) {
    issues.push("android.tiktokFeedPackage");
  } else if (!androidTikTokPackages.has(tiktokFeedPackage)) {
    issues.push("android.tiktokFeedPackage must be one of FREED's supported TikTok packages");
  }
  if (tiktokFeedAtInterventionSeconds === null || tiktokFeedAtInterventionSeconds < 0) {
    issues.push("android.tiktokFeedAtInterventionSeconds");
  } else if (shortFormThresholdSeconds !== null && tiktokFeedAtInterventionSeconds < shortFormThresholdSeconds) {
    issues.push("android.tiktokFeedAtInterventionSeconds must be at least android.shortFormThresholdSeconds");
  }
  validateShortFormUsageBelowAppLimit(
    issues,
    tiktokFeedUsageBeforeLimitMinutes,
    configuredAppShieldDailyLimitMinutes,
    "android.tiktokFeedUsageBeforeLimitMinutes"
  );
  if (!nonEmptyString(android.tiktokFeedInterventionId)) {
    issues.push("android.tiktokFeedInterventionId");
  } else if (android.tiktokFeedInterventionId.trim() !== "short-form:tiktok-feed") {
    issues.push("android.tiktokFeedInterventionId must be short-form:tiktok-feed");
  }
  if (android.tiktokFeedSelectedSurfaceVerified !== true) {
    issues.push("android.tiktokFeedSelectedSurfaceVerified must be true");
  }
  issues.push(
    ...androidAppInterventionReportIssues(
      android,
      {
        artifactField: "tiktokFeedArtifact",
        dailyLimitMinutesField: "configuredAppShieldDailyLimitMinutes",
        extraRequiredChecks: [
          "shortFormThresholdCompared",
          "selectedSurfaceReportPaired",
          "scrollOrSurfaceEventUsed",
          "usageBelowConfiguredAppLimit",
          "noRawScreenTextPersisted"
        ],
        interventionIdField: "tiktokFeedInterventionId",
        observedSecondsField: "tiktokFeedAtInterventionSeconds",
        outcome: "block",
        packageField: "tiktokFeedPackage",
        reportKind: "short-form-threshold-block",
        runIdField: "tiktokFeedRunId",
        surface: "TikTok For You",
        thresholdSecondsField: "shortFormThresholdSeconds",
        usageBeforeLimitMinutesField: "tiktokFeedUsageBeforeLimitMinutes"
      },
      root
    )
  );
  issues.push(
    ...shortFormSurfaceReportIssues(
      android,
      {
        artifactField: "tiktokFeedSelectedSurfaceArtifact",
        atInterventionSecondsField: "tiktokFeedAtInterventionSeconds",
        interventionIdField: "tiktokFeedInterventionId",
        packageField: "tiktokFeedPackage",
        runIdField: "tiktokFeedRunId",
        surface: "TikTok For You",
        usageBeforeLimitMinutesField: "tiktokFeedUsageBeforeLimitMinutes"
      },
      root
    )
  );
  const earnedUnlockDurationMinutes = numberField(android, "earnedUnlockDurationMinutes");
  if (
    earnedUnlockDurationMinutes === null ||
    !Number.isInteger(earnedUnlockDurationMinutes) ||
    earnedUnlockDurationMinutes < 1 ||
    earnedUnlockDurationMinutes > 120
  ) {
    issues.push("android.earnedUnlockDurationMinutes between 1 and 120");
  }
  const earnedUnlockSourcePackage = nonEmptyString(android.earnedUnlockSourcePackage)
    ? android.earnedUnlockSourcePackage.trim().toLowerCase()
    : "";
  if (!earnedUnlockSourcePackage) {
    issues.push("android.earnedUnlockSourcePackage");
  } else if (configuredAppShieldPackage && earnedUnlockSourcePackage !== configuredAppShieldPackage) {
    issues.push("android.earnedUnlockSourcePackage must match android.configuredAppShieldPackage");
  }
  if (earnedUnlockRelockUsageMinutes === null || earnedUnlockRelockUsageMinutes < 0) {
    issues.push("android.earnedUnlockRelockUsageMinutes");
  } else if (
    configuredAppShieldDailyLimitMinutes !== null &&
    earnedUnlockRelockUsageMinutes < configuredAppShieldDailyLimitMinutes
  ) {
    issues.push("android.earnedUnlockRelockUsageMinutes must be at least android.configuredAppShieldDailyLimitMinutes");
  }
  issues.push(
    ...androidEarnedUnlockReportIssues(
      android,
      {
        artifactField: "earnedUnlockAppAllowArtifact",
        outcome: "allow",
        reportKind: "earned-unlock-app-allow",
        runIdField: "earnedUnlockAppAllowRunId"
      },
      root
    )
  );
  issues.push(
    ...androidEarnedUnlockReportIssues(
      android,
      {
        artifactField: "earnedUnlockRelockArtifact",
        outcome: "block",
        reportKind: "earned-unlock-auto-relock",
        runIdField: "earnedUnlockRelockRunId",
        usageMinutesField: "earnedUnlockRelockUsageMinutes"
      },
      root
    )
  );
  issues.push(...challengeVerificationEvidenceIssues(android, "android", "ML Kit", root));
  if (!browserEarnedUnlockSourceHost) {
    issues.push("android.browserEarnedUnlockSourceHost");
  } else {
    issues.push(...blockedEvidenceUrlIssues(browserEarnedUnlockSourceHost, "android.browserEarnedUnlockSourceHost"));
    const host = urlHost(evidenceUrlCandidate(browserEarnedUnlockSourceHost));
    if (allowedAndroidDoomscrollPackages.has(host) || host.endsWith(".app.freed.local")) {
      issues.push("android.browserEarnedUnlockSourceHost must be a browser/adult-domain source, not a supported app handoff source");
    }
  }
  if (android.browserEarnedUnlockNativeAppUnlockActive !== false) {
    issues.push("android.browserEarnedUnlockNativeAppUnlockActive must be false");
  }
  if (android.browserEarnedUnlockConfiguredAppStillShielded !== true) {
    issues.push("android.browserEarnedUnlockConfiguredAppStillShielded must be true");
  }
  if (android.browserEarnedUnlockAdultFilterStillActive !== true) {
    issues.push("android.browserEarnedUnlockAdultFilterStillActive must be true");
  }
  issues.push(...androidBrowserEarnedUnlockNoAppUnlockReportIssues(android, root));
  if (!nonEmptyString(android.dnsGuardResolver)) issues.push("android.dnsGuardResolver");
  else issues.push(...dnsGuardResolverIssues(android.dnsGuardResolver));
  issues.push(
    ...androidPermissionReportIssues(
      android,
      {
        artifactField: "dnsGuardVpnConsentArtifact",
        reportKind: "dns-guard-vpn-consent",
        runIdField: "dnsGuardVpnConsentRunId"
      },
      root
    )
  );
  if (dnsGuardSessionQueries === null || dnsGuardSessionQueries < 2) {
    issues.push("android.dnsGuardSessionQueries >= 2");
  }
  if (dnsGuardBlockedQueries === null || dnsGuardBlockedQueries < 1) {
    issues.push("android.dnsGuardBlockedQueries >= 1");
  }
  if (dnsGuardAllowedQueries === null || dnsGuardAllowedQueries < 1) {
    issues.push("android.dnsGuardAllowedQueries >= 1");
  }
  if (dnsGuardServfailResponses === null || dnsGuardServfailResponses < 0) {
    issues.push("android.dnsGuardServfailResponses >= 0");
  }
  if (dnsGuardMalformedPackets === null || dnsGuardMalformedPackets < 0) {
    issues.push("android.dnsGuardMalformedPackets >= 0");
  }
  if (android.dnsGuardInterventionVisible !== true) {
    issues.push("android.dnsGuardInterventionVisible must be true");
  }
  if (
    dnsGuardSessionQueries !== null &&
    dnsGuardBlockedQueries !== null &&
    dnsGuardAllowedQueries !== null &&
    dnsGuardSessionQueries < dnsGuardBlockedQueries + dnsGuardAllowedQueries
  ) {
    issues.push("android.dnsGuardSessionQueries must cover blocked plus allowed DNS queries");
  }
  issues.push(
    ...dnsGuardBlockReportIssues(
      android,
      {
        artifactField: "dnsGuardBlockArtifact",
        runIdField: "dnsGuardBlockRunId"
      },
      root
    )
  );
  issues.push(...dnsGuardLifecycleReportIssues(android, root));
  const dnsGuardRestartAction = nonEmptyString(android.dnsGuardRestartAction)
    ? android.dnsGuardRestartAction.trim().replace(/^android\.intent\.action\./i, "")
    : "";
  if (!dnsGuardRestartAction) {
    issues.push("android.dnsGuardRestartAction");
  } else if (!["BOOT_COMPLETED", "MY_PACKAGE_REPLACED"].includes(dnsGuardRestartAction)) {
    issues.push("android.dnsGuardRestartAction must be BOOT_COMPLETED or MY_PACKAGE_REPLACED");
  }
  if (!nonEmptyString(android.dnsGuardRestartResult)) {
    issues.push("android.dnsGuardRestartResult");
  } else if (android.dnsGuardRestartResult.trim().toLowerCase() !== "started") {
    issues.push("android.dnsGuardRestartResult must be started");
  }
  if (android.dnsGuardRestartUserEnabled !== true) {
    issues.push("android.dnsGuardRestartUserEnabled must be true");
  }
  if (android.dnsGuardRestartEligible !== true) {
    issues.push("android.dnsGuardRestartEligible must be true");
  }
  if (!nonEmptyString(android.dnsGuardRestartSkippedReason)) {
    issues.push("android.dnsGuardRestartSkippedReason");
  } else if (!["user-disabled", "vpn-permission-required"].includes(android.dnsGuardRestartSkippedReason.trim().toLowerCase())) {
    issues.push("android.dnsGuardRestartSkippedReason must be user-disabled or vpn-permission-required");
  }
  if (android.dnsGuardRestartNoSilentPromptConfirmed !== true) {
    issues.push("android.dnsGuardRestartNoSilentPromptConfirmed must be true");
  }
  issues.push(
    ...dnsGuardRestartReportIssues(
      android,
      {
        artifactField: "dnsGuardRestartArtifact",
        reportKind: "restart-started",
        runIdField: "dnsGuardRestartRunId"
      },
      root
    )
  );
  issues.push(
    ...dnsGuardRestartReportIssues(
      android,
      {
        artifactField: "dnsGuardRestartSkippedArtifact",
        reportKind: "restart-skipped",
        runIdField: "dnsGuardRestartSkippedRunId"
      },
      root
    )
  );
  const adultDomainFeedDomainCount = numberField(android, "adultDomainFeedDomainCount");
  if (!nonEmptyString(android.adultDomainFeedVersion)) issues.push("android.adultDomainFeedVersion");
  if (!nonEmptyString(android.adultDomainFeedChecksum)) {
    issues.push("android.adultDomainFeedChecksum");
  } else if (!/^fnv1a32:[0-9a-f]{8}$/i.test(android.adultDomainFeedChecksum.trim())) {
    issues.push("android.adultDomainFeedChecksum must use fnv1a32:<8-hex> format");
  }
  if (adultDomainFeedDomainCount === null || adultDomainFeedDomainCount <= 0) {
    issues.push("android.adultDomainFeedDomainCount > 0");
  }
  issues.push(
    ...dnsGuardBlockReportIssues(
      android,
      {
        artifactField: "adultDomainFeedDnsGuardArtifact",
        extraRequiredChecks: ["syncedAdultDomainFeedUsed"],
        runIdField: "adultDomainFeedDnsGuardRunId"
      },
      root
    )
  );
  if (!nonEmptyString(android.nativeHandoffInterventionId)) issues.push("android.nativeHandoffInterventionId");
  if (!nonEmptyString(android.normalBrowsingAllowedUrl)) issues.push("android.normalBrowsingAllowedUrl");
  else issues.push(...classifiedEvidenceUrlIssues(android.normalBrowsingAllowedUrl, "android.normalBrowsingAllowedUrl", "allow"));
  if (!nonEmptyString(android.adultInterceptedHost)) issues.push("android.adultInterceptedHost");
  else issues.push(...blockedEvidenceUrlIssues(android.adultInterceptedHost, "android.adultInterceptedHost"));

  return issues;
}

function classifyUrlArray(value: unknown, path: string, expected: "allow" | "block"): string[] {
  if (!nonEmptyStringArray(value)) return [`${path}[]`];

  const issues: string[] = [];
  const seen = new Map<string, number>();

  value.forEach((url, index) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      issues.push(`${path}[${index}] must be a valid URL`);
      return;
    }

    parsed.hash = "";
    const normalized = parsed.toString().toLowerCase();
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      issues.push(`${path}[${index}] duplicates ${path}[${firstIndex}]`);
    } else {
      seen.set(normalized, index);
    }
    if (parsed.protocol !== "https:") {
      issues.push(`${path}[${index}] must use HTTPS`);
      return;
    }

	    const result = classifyUrl(url);
	    if (result.verdict !== expected) issues.push(`${path}[${index}] must classify ${expected}`);
	    if (expected === "block") {
	      issues.push(
	        ...blockedEvidenceUrlIssues(url, `${path}[${index}]`).filter(
	          (issue) => !issue.endsWith("must classify block")
	        )
	      );
	    }
	  });

  return issues;
}

function urlHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function requireCorpusUrl(
  urls: string[],
  issue: string,
  matcher: (url: string, host: string) => boolean
): string[] {
  return urls.some((url) => matcher(url.toLowerCase(), urlHost(url))) ? [] : [issue];
}

function normalBrowsingBrowserReportIssues(
  root: string,
  entry: Record<string, unknown>,
  path: string,
  expectedCounts: {
    allowedUrlCount: number;
    recoverySearchUrlCount: number;
    adultBlockedUrlCount: number;
  }
): string[] {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    entry.resultArtifact,
    `${path}.resultArtifact`,
    "normal browsing browser result inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${path}.resultArtifact must contain a freed-normal-browsing-browser-report-v1 JSON object`];

  const counts = isRecord(report.counts) ? report.counts : {};
  const checks = isRecord(report.checks) ? report.checks : {};
  const reportIssues: string[] = [];
  const platform = nonEmptyString(entry.platform) ? entry.platform.trim().toLowerCase() : "";
  const browserName = nonEmptyString(entry.browserName) ? entry.browserName.trim().toLowerCase() : "";
  const browserPackage = nonEmptyString(entry.browserPackage) ? entry.browserPackage.trim().toLowerCase() : "";
  const reportPlatform = nonEmptyString(report.platform) ? report.platform.trim().toLowerCase() : "";
  const reportBrowserName = nonEmptyString(report.browserName) ? report.browserName.trim().toLowerCase() : "";
  const reportBrowserPackage = nonEmptyString(report.browserPackage) ? report.browserPackage.trim().toLowerCase() : "";
  const countFields = [
    "allowedUrlCount",
    "recoverySearchUrlCount",
    "adultBlockedUrlCount",
    "allowedUrlPassCount",
    "recoverySearchPassCount",
    "adultBlockPassCount",
    "falsePositiveCount",
    "missedAdultBlockCount"
  ] as const;

  if (report.schemaVersion !== "freed-normal-browsing-browser-report-v1") {
    reportIssues.push(`${path}.resultArtifact.schemaVersion must be freed-normal-browsing-browser-report-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${path}.resultArtifact.sanitized must be true`);
  }
  if (report.runId !== entry.runId) {
    reportIssues.push(`${path}.resultArtifact.runId must match ${path}.runId`);
  }
  if (reportPlatform !== platform) {
    reportIssues.push(`${path}.resultArtifact.platform must match ${path}.platform`);
  }
  if (reportBrowserName !== browserName) {
    reportIssues.push(`${path}.resultArtifact.browserName must match ${path}.browserName`);
  }
  if (platform === "android" && reportBrowserPackage !== browserPackage) {
    reportIssues.push(`${path}.resultArtifact.browserPackage must match ${path}.browserPackage`);
  }

  for (const field of countFields) {
    if (numberField(counts, field) !== numberField(entry, field)) {
      reportIssues.push(`${path}.resultArtifact.counts.${field} must match ${path}.${field}`);
    }
  }
  if (numberField(counts, "allowedUrlCount") !== expectedCounts.allowedUrlCount) {
    reportIssues.push(`${path}.resultArtifact.counts.allowedUrlCount must equal ${expectedCounts.allowedUrlCount}`);
  }
  if (numberField(counts, "recoverySearchUrlCount") !== expectedCounts.recoverySearchUrlCount) {
    reportIssues.push(`${path}.resultArtifact.counts.recoverySearchUrlCount must equal ${expectedCounts.recoverySearchUrlCount}`);
  }
  if (numberField(counts, "adultBlockedUrlCount") !== expectedCounts.adultBlockedUrlCount) {
    reportIssues.push(`${path}.resultArtifact.counts.adultBlockedUrlCount must equal ${expectedCounts.adultBlockedUrlCount}`);
  }

  const requiredChecks = [
    "physicalDevice",
    "passed",
    "allowedUrlsPassed",
    "recoverySearchPassed",
    "adultUrlsBlocked",
    "noFalsePositives",
    "noMissedAdultBlocks"
  ];
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${path}.resultArtifact.checks.${check}`);
  }

  return reportIssues;
}

function normalBrowsingBrowserMatrixIssues(
  value: unknown,
  expectedCounts: {
    allowedUrlCount: number;
    recoverySearchUrlCount: number;
    adultBlockedUrlCount: number;
  },
  root: string
): string[] {
  const issues: string[] = [];
  if (!Array.isArray(value)) return ["normalBrowsing.browserMatrix[]"];
  if (value.length < 2) issues.push("normalBrowsing.browserMatrix[]");

  let hasIosSafari = false;
  let hasAndroidChrome = false;
  let hasAndroidFirefox = false;
  let hasAndroidEdge = false;
  let hasAndroidSamsung = false;
  const idEntries: Array<{ path: string; value: unknown }> = [];

  value.forEach((entry, index) => {
    const path = `normalBrowsing.browserMatrix[${index}]`;
    if (!isRecord(entry)) {
      issues.push(path);
      return;
    }

    const platform = nonEmptyString(entry.platform) ? entry.platform.trim().toLowerCase() : "";
    if (!["ios", "android"].includes(platform)) issues.push(`${path}.platform`);
    if (entry.isPhysicalDevice !== true) issues.push(`${path}.isPhysicalDevice must be true`);
    if (entry.passed !== true) issues.push(`${path}.passed must be true`);

    if (!nonEmptyString(entry.deviceModel)) {
      issues.push(`${path}.deviceModel`);
    } else if (includesAnyTerm(entry.deviceModel, ["model", "simulator", "emulator", "sdk_gphone", "generic"])) {
      issues.push(`${path}.deviceModel must name physical hardware`);
    }

    if (!nonEmptyString(entry.osVersion)) {
      issues.push(`${path}.osVersion`);
    } else if (platform === "ios" && !/\bios\s*\d+(?:\.\d+){0,2}\b/i.test(entry.osVersion.trim())) {
      issues.push(`${path}.osVersion must include a concrete iOS version`);
    } else if (platform === "android" && !/\bandroid\s*\d+(?:\.\d+){0,2}\b/i.test(entry.osVersion.trim())) {
      issues.push(`${path}.osVersion must include a concrete Android version`);
    }

    const browserName = nonEmptyString(entry.browserName) ? entry.browserName.trim().toLowerCase() : "";
    const browserPackage = nonEmptyString(entry.browserPackage) ? entry.browserPackage.trim().toLowerCase() : "";
    if (!browserName) issues.push(`${path}.browserName`);
    if (platform === "android" && !browserPackage) issues.push(`${path}.browserPackage`);
    if (platform === "android" && browserPackage === "com.android.chrome" && !browserName.includes("chrome")) {
      issues.push(`${path}.browserName must match Chrome package proof`);
    }
    if (platform === "android" && browserPackage === "org.mozilla.firefox" && !browserName.includes("firefox")) {
      issues.push(`${path}.browserName must match Firefox package proof`);
    }
    if (platform === "android" && browserPackage === "com.brave.browser" && !browserName.includes("brave")) {
      issues.push(`${path}.browserName must match Brave package proof`);
    }
    if (platform === "android" && browserPackage === "com.microsoft.emmx" && !browserName.includes("edge")) {
      issues.push(`${path}.browserName must match Edge package proof`);
    }
    if (platform === "android" && browserPackage === "com.sec.android.app.sbrowser" && !browserName.includes("samsung")) {
      issues.push(`${path}.browserName must match Samsung Internet package proof`);
    }
    const entryRunIdIssue = evidenceIdIssue(`${path}.runId`, entry.runId);
    if (entryRunIdIssue) issues.push(entryRunIdIssue);
    idEntries.push({ path: `${path}.runId`, value: entry.runId });
    if (!nonEmptyString(entry.resultArtifact)) {
      issues.push(`${path}.resultArtifact`);
    } else {
      const artifactIssue = missingEvidenceReference(root, entry.resultArtifact, `${path}.resultArtifact`);
      if (artifactIssue) issues.push(artifactIssue);
    }

    const allowedUrlCount = numberField(entry, "allowedUrlCount");
    const recoverySearchUrlCount = numberField(entry, "recoverySearchUrlCount");
    const adultBlockedUrlCount = numberField(entry, "adultBlockedUrlCount");
    const allowedUrlPassCount = numberField(entry, "allowedUrlPassCount");
    const recoverySearchPassCount = numberField(entry, "recoverySearchPassCount");
    const adultBlockPassCount = numberField(entry, "adultBlockPassCount");
    const falsePositiveCount = numberField(entry, "falsePositiveCount");
    const missedAdultBlockCount = numberField(entry, "missedAdultBlockCount");
    if (allowedUrlCount === null || allowedUrlCount !== expectedCounts.allowedUrlCount) {
      issues.push(`${path}.allowedUrlCount must equal ${expectedCounts.allowedUrlCount}`);
    }
    if (recoverySearchUrlCount === null || recoverySearchUrlCount !== expectedCounts.recoverySearchUrlCount) {
      issues.push(`${path}.recoverySearchUrlCount must equal ${expectedCounts.recoverySearchUrlCount}`);
    }
    if (adultBlockedUrlCount === null || adultBlockedUrlCount !== expectedCounts.adultBlockedUrlCount) {
      issues.push(`${path}.adultBlockedUrlCount must equal ${expectedCounts.adultBlockedUrlCount}`);
    }
    if (allowedUrlPassCount === null || allowedUrlPassCount !== expectedCounts.allowedUrlCount) {
      issues.push(`${path}.allowedUrlPassCount must equal ${expectedCounts.allowedUrlCount}`);
    }
    if (recoverySearchPassCount === null || recoverySearchPassCount !== expectedCounts.recoverySearchUrlCount) {
      issues.push(`${path}.recoverySearchPassCount must equal ${expectedCounts.recoverySearchUrlCount}`);
    }
    if (adultBlockPassCount === null || adultBlockPassCount !== expectedCounts.adultBlockedUrlCount) {
      issues.push(`${path}.adultBlockPassCount must equal ${expectedCounts.adultBlockedUrlCount}`);
    }
    if (falsePositiveCount === null || falsePositiveCount !== 0) issues.push(`${path}.falsePositiveCount must be 0`);
    if (missedAdultBlockCount === null || missedAdultBlockCount !== 0) {
      issues.push(`${path}.missedAdultBlockCount must be 0`);
    }
    issues.push(...normalBrowsingBrowserReportIssues(root, entry, path, expectedCounts));

    if (platform === "ios" && browserName === "safari") {
      hasIosSafari = true;
    }
    if (platform === "android" && browserPackage === "com.android.chrome" && browserName.includes("chrome")) {
      hasAndroidChrome = true;
    }
    if (platform === "android" && browserPackage === "org.mozilla.firefox" && browserName.includes("firefox")) {
      hasAndroidFirefox = true;
    }
    if (platform === "android" && browserPackage === "com.microsoft.emmx" && browserName.includes("edge")) {
      hasAndroidEdge = true;
    }
    if (platform === "android" && browserPackage === "com.sec.android.app.sbrowser" && browserName.includes("samsung")) {
      hasAndroidSamsung = true;
    }
  });

  if (!hasIosSafari) issues.push("normalBrowsing.browserMatrix must include iOS Safari");
  if (!hasAndroidChrome) issues.push("normalBrowsing.browserMatrix must include Android Chrome");
  if (!hasAndroidFirefox) issues.push("normalBrowsing.browserMatrix must include Android Firefox");
  if (!hasAndroidEdge) issues.push("normalBrowsing.browserMatrix must include Android Edge");
  if (!hasAndroidSamsung) issues.push("normalBrowsing.browserMatrix must include Samsung Internet");
  issues.push(...duplicateEvidenceIdIssues(idEntries));

  return issues;
}

function normalBrowsingCorpusIssues(payload: Record<string, unknown>, root: string): string[] {
  const normalBrowsing = isRecord(payload.normalBrowsing) ? payload.normalBrowsing : {};
  const allowedUrls = nonEmptyStringArray(normalBrowsing.allowedUrls) ? normalBrowsing.allowedUrls : [];
  const recoverySearchUrls = nonEmptyStringArray(normalBrowsing.recoverySearchUrls) ? normalBrowsing.recoverySearchUrls : [];
  const adultBlockedUrls = nonEmptyStringArray(normalBrowsing.adultBlockedUrls) ? normalBrowsing.adultBlockedUrls : [];
  const classifierCorpusCaseCount = numberField(normalBrowsing, "classifierCorpusCaseCount");
  const classifierCorpusPassCount = numberField(normalBrowsing, "classifierCorpusPassCount");
  const classifierCorpusFailedCount = numberField(normalBrowsing, "classifierCorpusFailedCount");
  const issues: string[] = [];

  if (normalBrowsing.classifierCorpusSource !== "scripts/classifier-safety-corpus.ts") {
    issues.push("normalBrowsing.classifierCorpusSource must be scripts/classifier-safety-corpus.ts");
  }
  if (classifierCorpusCaseCount === null) {
    issues.push("normalBrowsing.classifierCorpusCaseCount");
  } else if (classifierCorpusCaseCount !== classifierSafetyCorpus.length) {
    issues.push(`normalBrowsing.classifierCorpusCaseCount must equal ${classifierSafetyCorpus.length}`);
  }
  if (classifierCorpusPassCount === null) {
    issues.push("normalBrowsing.classifierCorpusPassCount");
  } else if (classifierCorpusPassCount !== classifierCorpusCaseCount) {
    issues.push("normalBrowsing.classifierCorpusPassCount must equal classifierCorpusCaseCount");
  }
  if (classifierCorpusFailedCount === null) {
    issues.push("normalBrowsing.classifierCorpusFailedCount");
  } else if (classifierCorpusFailedCount !== 0) {
    issues.push("normalBrowsing.classifierCorpusFailedCount must be 0");
  }

  return [
    ...issues,
    ...normalBrowsingBrowserMatrixIssues(normalBrowsing.browserMatrix, {
      allowedUrlCount: allowedUrls.length,
      recoverySearchUrlCount: recoverySearchUrls.length,
      adultBlockedUrlCount: adultBlockedUrls.length
    }, root),
    ...classifyUrlArray(normalBrowsing.allowedUrls, "normalBrowsing.allowedUrls", "allow"),
    ...classifyUrlArray(normalBrowsing.recoverySearchUrls, "normalBrowsing.recoverySearchUrls", "allow"),
    ...classifyUrlArray(normalBrowsing.adultBlockedUrls, "normalBrowsing.adultBlockedUrls", "block"),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.googleAllowedUrl", (_url, host) => host === "google.com" || host.endsWith(".google.com")),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.youtubeAllowedUrl", (_url, host) => host === "youtube.com" || host.endsWith(".youtube.com")),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.instagramAllowedUrl", (_url, host) => host === "instagram.com" || host.endsWith(".instagram.com")),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.xTwitterAllowedUrl", (_url, host) => host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.educationAllowedUrl", (_url, host) => host.endsWith(".edu") || ["coursera.org", "edx.org", "khanacademy.org", "wikipedia.org"].some((domain) => host === domain || host.endsWith(`.${domain}`))),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.streamingAllowedUrl", (_url, host) => ["netflix.com", "hulu.com", "disneyplus.com", "spotify.com"].some((domain) => host === domain || host.endsWith(`.${domain}`))),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.gamingAllowedUrl", (_url, host) => ["steampowered.com", "xbox.com", "playstation.com", "roblox.com"].some((domain) => host === domain || host.endsWith(`.${domain}`))),
    ...requireCorpusUrl(allowedUrls, "normalBrowsing.productivityAllowedUrl", (_url, host) => ["notion.so", "github.com", "docs.google.com", "slack.com"].some((domain) => host === domain || host.endsWith(`.${domain}`))),
    ...requireCorpusUrl(recoverySearchUrls, "normalBrowsing.recoverySearchWithAdultTermUrl", (url) =>
      url.includes("porn") && ["recovery", "addiction", "therapy", "accountability"].some((term) => url.includes(term))
    ),
    ...requireCorpusUrl(adultBlockedUrls, "normalBrowsing.adultBlockedIntentUrl", (url) =>
      ["porn", "nsfw", "explicit"].some((term) => url.includes(term))
    )
  ];
}

function launchProductIdMapIssues(
  store: Record<string, unknown>,
  field: "iosLaunchProductIds" | "androidLaunchProductIds",
  configuredProductIds: Record<string, string>
) {
  const value = store[field];
  const issues: string[] = [];
  if (!isRecord(value)) return [`store.${field}`];

  const allowedPlanIds = new Set<string>([...LAUNCH_PREMIUM_PLAN_IDS]);
  for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
    const productId = value[planId];
    if (!nonEmptyString(productId)) {
      issues.push(`store.${field}.${planId}`);
    } else if (productId.trim() !== configuredProductIds[planId]) {
      issues.push(`store.${field}.${planId} must match configured ${planId} Core 3 launch product id`);
    }
  }

  for (const key of Object.keys(value)) {
    if (!allowedPlanIds.has(key)) {
      issues.push(`store.${field}.${key} must not include post-launch product ids`);
    }
  }

  return issues;
}

function launchProductSandboxMatrixIssues(
  store: Record<string, unknown>,
  root: string,
  configuredIosProductIds: Record<string, string>,
  configuredAndroidProductIds: Record<string, string>
) {
  const matrix = store.launchProductSandboxMatrix;
  const issues: string[] = [];
  if (!Array.isArray(matrix)) return ["store.launchProductSandboxMatrix[]"];

  if (matrix.length !== LAUNCH_PREMIUM_PLAN_IDS.length) {
    issues.push("store.launchProductSandboxMatrix must include exactly yearly, monthly, and lifetime");
  }

  const requiredIdFields = [
    "iosPurchaseRunId",
    "iosRestoreRunId",
    "androidPurchaseRunId",
    "androidRestoreRunId",
    "purchaseVerificationRunId",
    "restoreVerificationRunId"
  ];
  const requiredArtifactFields = [
    "iosPurchaseArtifact",
    "iosRestoreArtifact",
    "androidPurchaseArtifact",
    "androidRestoreArtifact",
    "purchaseVerificationArtifact",
    "restoreVerificationArtifact"
  ];
  const requiredTrueFields = [
    "iosPurchaseSandbox",
    "iosRestoreSandbox",
    "androidPurchaseSandbox",
    "androidRestoreSandbox",
    "receiptOrEntitlementVerified",
    "restoreEntitlementVerified"
  ];
  const seenPlans = new Set<string>();
  const idEntries: Array<{ path: string; value: unknown }> = [];

  matrix.forEach((rawEntry, index) => {
    const path = `store.launchProductSandboxMatrix[${index}]`;
    if (!isRecord(rawEntry)) {
      issues.push(path);
      return;
    }

    const planId = nonEmptyString(rawEntry.planId) ? rawEntry.planId.trim() : "";
    if (!LAUNCH_PREMIUM_PLAN_IDS.includes(planId as (typeof LAUNCH_PREMIUM_PLAN_IDS)[number])) {
      issues.push(`${path}.planId must be yearly, monthly, or lifetime`);
    } else if (seenPlans.has(planId)) {
      issues.push(`${path}.planId duplicates ${planId}`);
    } else {
      seenPlans.add(planId);
    }

    const iosProductId = rawEntry.iosProductId;
    if (!nonEmptyString(iosProductId)) {
      issues.push(`${path}.iosProductId`);
    } else if (planId && configuredIosProductIds[planId] && iosProductId.trim() !== configuredIosProductIds[planId]) {
      issues.push(`${path}.iosProductId must match configured ${planId} iOS Core 3 launch product id`);
    }

    const androidProductId = rawEntry.androidProductId;
    if (!nonEmptyString(androidProductId)) {
      issues.push(`${path}.androidProductId`);
    } else if (planId && configuredAndroidProductIds[planId] && androidProductId.trim() !== configuredAndroidProductIds[planId]) {
      issues.push(`${path}.androidProductId must match configured ${planId} Android Core 3 launch product id`);
    }

    for (const field of requiredIdFields) {
      const issue = evidenceIdIssue(`${path}.${field}`, rawEntry[field]);
      if (issue) issues.push(issue);
      idEntries.push({ path: `${path}.${field}`, value: rawEntry[field] });
    }
    for (const field of requiredArtifactFields) {
      if (!nonEmptyString(rawEntry[field])) {
        issues.push(`${path}.${field}`);
      } else {
        const artifactIssue = missingEvidenceReference(root, rawEntry[field], `${path}.${field}`);
        if (artifactIssue) issues.push(artifactIssue);
      }
    }
    if (nonEmptyString(rawEntry.purchaseVerificationArtifact)) {
      issues.push(
        ...purchaseVerificationReportArtifactIssues(
          root,
          store,
          rawEntry.purchaseVerificationArtifact,
          `${path}.purchaseVerificationArtifact`
        )
      );
    }
    if (nonEmptyString(rawEntry.restoreVerificationArtifact)) {
      issues.push(
        ...purchaseVerificationReportArtifactIssues(
          root,
          store,
          rawEntry.restoreVerificationArtifact,
          `${path}.restoreVerificationArtifact`
        )
      );
    }
    for (const field of requiredTrueFields) {
      if (rawEntry[field] !== true) issues.push(`${path}.${field} must be true`);
    }
  });

  for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
    if (!seenPlans.has(planId)) issues.push(`store.launchProductSandboxMatrix includes ${planId}`);
  }
  issues.push(...duplicateEvidenceIdIssues(idEntries));

  return issues;
}

function exactStringSetIssues(value: unknown, path: string, expected: readonly string[]): string[] {
  const issues: string[] = [];
  if (!Array.isArray(value)) return [`${path}[]`];

  const seen = new Map<string, number>();
  const normalizedValues = value
    .map((entry, index) => {
      if (!nonEmptyString(entry)) {
        issues.push(`${path}[${index}]`);
        return "";
      }
      const normalized = entry.trim();
      const firstIndex = seen.get(normalized);
      if (firstIndex !== undefined) {
        issues.push(`${path}[${index}] duplicates ${path}[${firstIndex}]`);
      } else {
        seen.set(normalized, index);
      }
      return normalized;
    })
    .filter(Boolean);
  const normalizedSet = new Set(normalizedValues);

  for (const expectedValue of expected) {
    if (!normalizedSet.has(expectedValue)) issues.push(`${path} must include ${expectedValue}`);
  }
  for (const actualValue of normalizedValues) {
    if (!expected.includes(actualValue)) issues.push(`${path} must not include ${actualValue}`);
  }
  if (normalizedValues.length !== expected.length) {
    issues.push(`${path} must include exactly ${expected.join(", ")}`);
  }

  return issues;
}

function exactProductIdMapIssues(
  value: unknown,
  path: string,
  expected: Record<string, string>,
  expectedKeys: readonly string[]
): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return [path];

  for (const key of expectedKeys) {
    const productId = value[key];
    if (!nonEmptyString(productId)) {
      issues.push(`${path}.${key}`);
    } else if (productId.trim() !== expected[key]) {
      issues.push(`${path}.${key} must match configured ${key} product id`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.includes(key)) issues.push(`${path}.${key} must not be included`);
  }

  return issues;
}

function readStoreProductsCatalog(root: string): Record<string, unknown> {
  const catalogPath = join(root, "store/store-products.json");
  if (!existsSync(catalogPath)) return {};
  try {
    const payload = JSON.parse(readFileSync(catalogPath, "utf8"));
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function productsByPlan(products: unknown): Map<string, Record<string, unknown>> {
  const entries = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(products)) return entries;
  for (const product of products) {
    if (!isRecord(product) || !nonEmptyString(product.planId)) continue;
    entries.set(product.planId.trim(), product);
  }
  return entries;
}

function nonProductionConsoleStatusIssues(value: unknown, path: string): string[] {
  if (!nonEmptyString(value)) return [path];
  const normalized = value.trim().toLowerCase();
  if (/\b(?:live|production|released|public|active-live|prod)\b/.test(normalized)) {
    return [`${path} must not be production-live before all release evidence passes`];
  }
  return [];
}

function consoleProductSourceProofIssues(
  root: string,
  report: Record<string, unknown>,
  pathPrefix: string
): string[] {
  const issues: string[] = [];
  for (const sourceProof of STORE_CONSOLE_PRODUCT_SETUP_SOURCE_PROOFS) {
    const sourcePath = report[sourceProof.pathField];
    const sourceHash = report[sourceProof.hashField];
    if (sourcePath !== sourceProof.expectedPath) {
      issues.push(`${pathPrefix}.${sourceProof.pathField} must be ${sourceProof.expectedPath}`);
    }
    if (!nonEmptyString(sourceHash) || !/^sha256-[0-9a-f]{64}$/i.test(String(sourceHash).trim())) {
      issues.push(`${pathPrefix}.${sourceProof.hashField} must use sha256-<64-hex> format`);
    } else {
      const expectedHash = localFileSha256Label(root, sourceProof.expectedPath);
      if (expectedHash && String(sourceHash).trim().toLowerCase() !== expectedHash) {
        issues.push(`${pathPrefix}.${sourceProof.hashField} must match ${sourceProof.expectedPath}`);
      }
    }
  }
  return issues;
}

function storeConsoleLaunchProductRowsIssues(
  rows: unknown,
  path: string,
  platform: "appStoreConnect" | "googlePlay",
  configuredLaunchProductIds: Record<string, string>,
  catalogProductsByPlan: Map<string, Record<string, unknown>>,
  root: string
): string[] {
  const issues: string[] = [];
  if (!Array.isArray(rows)) return [`${path} must include Core 3 launch products`];
  const rowsByPlan = productsByPlan(rows);
  if (rows.length !== LAUNCH_PREMIUM_PLAN_IDS.length) issues.push(`${path} must include exactly Core 3 products`);

  for (const row of rows) {
    if (!isRecord(row) || !nonEmptyString(row.planId)) continue;
    const planId = row.planId.trim();
    if (!LAUNCH_PREMIUM_PLAN_IDS.includes(planId as (typeof LAUNCH_PREMIUM_PLAN_IDS)[number])) {
      issues.push(`${path} must not include post-launch or unknown plan ${planId}`);
    }
    if (nonEmptyString(row.productId) && Object.values(configuredPostLaunchProductIdsByPlan(platform === "appStoreConnect" ? "ios" : "android")).includes(row.productId.trim())) {
      issues.push(`${path}.${planId}.productId must not be a post-launch product id`);
    }
  }

  for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
    const row = rowsByPlan.get(planId);
    const catalogProduct = catalogProductsByPlan.get(planId);
    const rowPath = `${path}.${planId}`;
    if (!row) {
      issues.push(rowPath);
      continue;
    }
    const productId = row.productId;
    if (!nonEmptyString(productId)) {
      issues.push(`${rowPath}.productId`);
    } else if (productId.trim() !== configuredLaunchProductIds[planId]) {
      issues.push(`${rowPath}.productId must match configured ${planId} product id`);
    }
    issues.push(...nonProductionConsoleStatusIssues(row.consoleStatus, `${rowPath}.consoleStatus`));
    if (row.metadataConfigured !== true) issues.push(`${rowPath}.metadataConfigured must be true`);
    if (row.serverVerificationMetadataConfigured !== true) {
      issues.push(`${rowPath}.serverVerificationMetadataConfigured must be true`);
    }
    const localizationLocales = Array.isArray(row.localizationLocales) ? row.localizationLocales : [];
    if (!localizationLocales.includes("en-US")) issues.push(`${rowPath}.localizationLocales must include en-US`);

    const catalogPrice = isRecord(catalogProduct) && nonEmptyString(catalogProduct.priceUsd) ? catalogProduct.priceUsd.trim() : "";
    if (catalogPrice && (!nonEmptyString(row.priceUsdIntent) || row.priceUsdIntent.trim() !== catalogPrice)) {
      issues.push(`${rowPath}.priceUsdIntent must match store/store-products.json`);
    }

    if (platform === "appStoreConnect") {
      const appleCatalog = isRecord(catalogProduct?.apple) ? catalogProduct.apple : {};
      const expectedProductType = planId === "lifetime" ? "non-consumable" : "auto-renewable-subscription";
      const expectedDuration = planId === "monthly" ? "P1M" : planId === "yearly" ? "P1Y" : "lifetime";
      if (row.productType !== expectedProductType) issues.push(`${rowPath}.productType must be ${expectedProductType}`);
      if (row.duration !== expectedDuration) issues.push(`${rowPath}.duration must be ${expectedDuration}`);
      if (planId === "lifetime") {
        if (row.subscriptionGroupId !== null && row.subscriptionGroupId !== "") {
          issues.push(`${rowPath}.subscriptionGroupId must be empty for lifetime non-consumable`);
        }
      } else if (row.subscriptionGroupId !== "freed_premium") {
        issues.push(`${rowPath}.subscriptionGroupId must be freed_premium`);
      }
      const expectedScreenshotPath = nonEmptyString(appleCatalog.reviewScreenshot)
        ? appleCatalog.reviewScreenshot.trim()
        : "";
      if (expectedScreenshotPath) {
        if (row.reviewScreenshotPath !== expectedScreenshotPath) {
          issues.push(`${rowPath}.reviewScreenshotPath must match store/store-products.json`);
        }
        const expectedScreenshotHash = localFileSha256Label(root, expectedScreenshotPath);
        if (!nonEmptyString(row.reviewScreenshotHash) || !/^sha256-[0-9a-f]{64}$/i.test(row.reviewScreenshotHash.trim())) {
          issues.push(`${rowPath}.reviewScreenshotHash must use sha256-<64-hex> format`);
        } else if (expectedScreenshotHash && row.reviewScreenshotHash.trim().toLowerCase() !== expectedScreenshotHash) {
          issues.push(`${rowPath}.reviewScreenshotHash must match ${expectedScreenshotPath}`);
        }
      }
      if (row.reviewScreenshotAttached !== true) issues.push(`${rowPath}.reviewScreenshotAttached must be true`);
    } else {
      const expectedProductType = planId === "lifetime" ? "one-time-product" : "subscription";
      const expectedBillingPeriod = planId === "monthly" ? "P1M" : planId === "yearly" ? "P1Y" : "lifetime";
      if (row.productType !== expectedProductType) issues.push(`${rowPath}.productType must be ${expectedProductType}`);
      if (row.billingPeriod !== expectedBillingPeriod) issues.push(`${rowPath}.billingPeriod must be ${expectedBillingPeriod}`);
      if (planId === "lifetime") {
        if (row.purchaseType !== "non-consumable") issues.push(`${rowPath}.purchaseType must be non-consumable`);
      } else if (row.basePlanId !== planId) {
        issues.push(`${rowPath}.basePlanId must be ${planId}`);
      }
    }
  }

  return issues;
}

function consoleProductSetupEvidenceArtifactIssues(
  root: string,
  platformReport: Record<string, unknown>,
  path: string,
  platform: keyof typeof STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS
): string[] {
  const issues: string[] = [];
  const requiredScreens = STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS[platform];
  const requiredScreenSet = new Set<string>(requiredScreens);
  const expectedHost = platform === "appStoreConnect" ? "appstoreconnect.apple.com" : "play.google.com";
  const consolePathRedacted = platformReport.consolePathRedacted;

  if (platformReport.consoleHost !== expectedHost) {
    issues.push(`${path}.consoleHost must be ${expectedHost}`);
  }
  if (!nonEmptyString(consolePathRedacted)) {
    issues.push(`${path}.consolePathRedacted`);
  } else {
    const normalizedPath = consolePathRedacted.trim();
    if (!normalizedPath.startsWith("/")) issues.push(`${path}.consolePathRedacted must be a path, not a full URL`);
    if (!normalizedPath.includes("redacted")) {
      issues.push(`${path}.consolePathRedacted must redact account, developer, and app identifiers`);
    }
    if (/[?#@]/.test(normalizedPath)) {
      issues.push(`${path}.consolePathRedacted must omit credentials, query strings, and fragments`);
    }
  }

  const artifacts = platformReport.consoleEvidenceArtifacts;
  if (!Array.isArray(artifacts)) return [...issues, `${path}.consoleEvidenceArtifacts must include sanitized console proof artifacts`];
  const artifactsByScreen = new Map<string, Record<string, unknown>>();
  if (artifacts.length !== requiredScreens.length) {
    issues.push(`${path}.consoleEvidenceArtifacts must include exactly ${requiredScreens.length} required screens`);
  }

  for (const [index, artifact] of artifacts.entries()) {
    const artifactPath = `${path}.consoleEvidenceArtifacts[${index}]`;
    if (!isRecord(artifact)) {
      issues.push(artifactPath);
      continue;
    }
    if (!nonEmptyString(artifact.screenId)) {
      issues.push(`${artifactPath}.screenId`);
      continue;
    }
    const screenId = artifact.screenId.trim();
    if (!requiredScreenSet.has(screenId)) {
      issues.push(`${path}.consoleEvidenceArtifacts must not include unknown screen ${screenId}`);
    }
    if (artifactsByScreen.has(screenId)) {
      issues.push(`${path}.consoleEvidenceArtifacts must not repeat ${screenId}`);
    } else {
      artifactsByScreen.set(screenId, artifact);
    }
    if (!validIsoDate(artifact.capturedAt)) issues.push(`${artifactPath}.capturedAt must be an ISO timestamp`);
    if (artifact.redacted !== true) issues.push(`${artifactPath}.redacted must be true`);
    if (artifact.accountIdentifiersRedacted !== true) {
      issues.push(`${artifactPath}.accountIdentifiersRedacted must be true`);
    }
    if (!nonEmptyString(artifact.artifactPath)) {
      issues.push(`${artifactPath}.artifactPath`);
    } else if (parseEvidenceUrl(artifact.artifactPath.trim())) {
      issues.push(`${artifactPath}.artifactPath must reference a local sanitized console artifact under docs/validation/artifacts/`);
    } else {
      const referenceIssue = missingEvidenceReference(root, artifact.artifactPath, `${artifactPath}.artifactPath`);
      if (referenceIssue) {
        issues.push(referenceIssue);
      } else {
        const expectedHash = localFileSha256Label(root, artifact.artifactPath.trim());
        if (!nonEmptyString(artifact.artifactHash) || !/^sha256-[0-9a-f]{64}$/i.test(artifact.artifactHash.trim())) {
          issues.push(`${artifactPath}.artifactHash must use sha256-<64-hex> format`);
        } else if (expectedHash && artifact.artifactHash.trim().toLowerCase() !== expectedHash) {
          issues.push(`${artifactPath}.artifactHash must match artifactPath`);
        }
      }
    }
  }

  for (const screenId of requiredScreens) {
    if (!artifactsByScreen.has(screenId)) {
      issues.push(`${path}.consoleEvidenceArtifacts must include ${screenId}`);
    }
  }

  return issues;
}

function storeConsoleAppRecordReadinessIssues(
  root: string,
  value: unknown,
  path: string
): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return [`${path} must include read-only Browser app-record readiness proof`];

  const browserReportPath = value.browserReportPath;
  const browserReportPathString = nonEmptyString(browserReportPath) ? String(browserReportPath).trim() : "";
  const browserReportHash = nonEmptyString(value.browserReportHash) ? String(value.browserReportHash).trim() : "";
  let browserReport: unknown | null = null;

  if (value.proofSource !== "read-only-browser-console-readiness") {
    issues.push(`${path}.proofSource must be read-only-browser-console-readiness`);
  }
  if (value.browserReportSchemaVersion !== STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION) {
    issues.push(`${path}.browserReportSchemaVersion must be ${STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION}`);
  }
  if (!browserReportPathString) {
    issues.push(`${path}.browserReportPath`);
  } else if (parseEvidenceUrl(browserReportPathString)) {
    issues.push(`${path}.browserReportPath must reference a local sanitized Browser readiness report under docs/validation/artifacts/`);
  } else {
    const referenceIssue = missingEvidenceReference(root, browserReportPathString, `${path}.browserReportPath`);
    if (referenceIssue) {
      issues.push(referenceIssue);
    } else {
      const absolutePath = isAbsolute(browserReportPathString)
        ? browserReportPathString
        : join(root, browserReportPathString);
      const expectedHash = `sha256-${createHash("sha256").update(readFileSync(absolutePath)).digest("hex")}`;
      if (!browserReportHash || !/^sha256-[0-9a-f]{64}$/i.test(browserReportHash)) {
        issues.push(`${path}.browserReportHash must use sha256-<64-hex> format`);
      } else if (browserReportHash.toLowerCase() !== expectedHash) {
        issues.push(`${path}.browserReportHash must match ${browserReportPathString}`);
      }
      try {
        browserReport = JSON.parse(readFileSync(absolutePath, "utf8"));
      } catch {
        issues.push(`${path}.browserReportPath must be a parseable Browser readiness JSON report`);
      }
    }
  }

  if (value.readyForConsoleProductSetup !== true) {
    issues.push(`${path}.readyForConsoleProductSetup must be true`);
  }
  if (value.readOnlyBrowserInspection !== true) {
    issues.push(`${path}.readOnlyBrowserInspection must be true`);
  }
  if (value.storeMutationPerformed !== false) {
    issues.push(`${path}.storeMutationPerformed must be false`);
  }
  if (value.accountIdentifiersRedacted !== true) {
    issues.push(`${path}.accountIdentifiersRedacted must be true`);
  }

  const readinessIdentifiers = isRecord(value.appIdentifiers) ? value.appIdentifiers : {};
  if (readinessIdentifiers.bundleId !== "app.freed.recovery") {
    issues.push(`${path}.appIdentifiers.bundleId must be app.freed.recovery`);
  }
  if (readinessIdentifiers.packageName !== "app.freed.recovery") {
    issues.push(`${path}.appIdentifiers.packageName must be app.freed.recovery`);
  }

  const readinessGooglePlay = isRecord(value.googlePlay) ? value.googlePlay : {};
  if (readinessGooglePlay.consoleHost !== "play.google.com") {
    issues.push(`${path}.googlePlay.consoleHost must be play.google.com`);
  }
  if (readinessGooglePlay.observedViaBrowser !== true) {
    issues.push(`${path}.googlePlay.observedViaBrowser must be true`);
  }
  if (readinessGooglePlay.appRecordPresent !== true) {
    issues.push(`${path}.googlePlay.appRecordPresent must be true`);
  }
  if (readinessGooglePlay.packageName !== "app.freed.recovery") {
    issues.push(`${path}.googlePlay.packageName must be app.freed.recovery`);
  }
  if (readinessGooglePlay.productSetupAllowed !== true) {
    issues.push(`${path}.googlePlay.productSetupAllowed must be true`);
  }

  const readinessAppStoreConnect = isRecord(value.appStoreConnect) ? value.appStoreConnect : {};
  if (readinessAppStoreConnect.consoleHost !== "appstoreconnect.apple.com") {
    issues.push(`${path}.appStoreConnect.consoleHost must be appstoreconnect.apple.com`);
  }
  if (readinessAppStoreConnect.observedViaBrowser !== true) {
    issues.push(`${path}.appStoreConnect.observedViaBrowser must be true`);
  }
  if (readinessAppStoreConnect.appRecordPresent !== true) {
    issues.push(`${path}.appStoreConnect.appRecordPresent must be true`);
  }
  if (readinessAppStoreConnect.bundleId !== "app.freed.recovery") {
    issues.push(`${path}.appStoreConnect.bundleId must be app.freed.recovery`);
  }
  if (readinessAppStoreConnect.licenseAgreementAccepted !== true) {
    issues.push(`${path}.appStoreConnect.licenseAgreementAccepted must be true`);
  }
  if (readinessAppStoreConnect.productSetupAllowed !== true) {
    issues.push(`${path}.appStoreConnect.productSetupAllowed must be true`);
  }

  const readinessChecks = isRecord(value.checks) ? value.checks : {};
  for (const check of STORE_CONSOLE_APP_RECORD_READINESS_REQUIRED_CHECKS) {
    if (readinessChecks[check] !== true) issues.push(`${path}.checks.${check}`);
  }

  if (isRecord(browserReport)) {
    const browserInspection = isRecord(browserReport.browserInspection) ? browserReport.browserInspection : {};
    const browserIdentifiers = isRecord(browserReport.appIdentifiers) ? browserReport.appIdentifiers : {};
    const browserGooglePlay = isRecord(browserReport.googlePlay) ? browserReport.googlePlay : {};
    const browserAppStoreConnect = isRecord(browserReport.appStoreConnect) ? browserReport.appStoreConnect : {};
    const blockers = Array.isArray(browserReport.blockers) ? browserReport.blockers : [];
    const failCount = typeof browserReport.failCount === "number" ? browserReport.failCount : null;

    if (browserReport.schemaVersion !== STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION) {
      issues.push(`${path}.browserReportPath.schemaVersion must be ${STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION}`);
    }
    if (browserReport.sanitized !== true) issues.push(`${path}.browserReportPath.sanitized must be true`);
    if (nonEmptyString(value.browserReportRunId) && String(value.browserReportRunId).trim() !== browserReport.runId) {
      issues.push(`${path}.browserReportRunId must match Browser readiness report runId`);
    }
    if (browserReport.readyForConsoleProductSetup !== true) {
      issues.push(`${path}.browserReportPath.readyForConsoleProductSetup must be true`);
    }
    if (failCount !== 0) issues.push(`${path}.browserReportPath.failCount must be 0`);
    if (blockers.length > 0) issues.push(`${path}.browserReportPath.blockers must be empty`);
    if (browserInspection.readOnly !== true) {
      issues.push(`${path}.browserReportPath.browserInspection.readOnly must be true`);
    }
    if (browserInspection.storeMutationPerformed !== false) {
      issues.push(`${path}.browserReportPath.browserInspection.storeMutationPerformed must be false`);
    }
    if (browserInspection.accountIdentifiersRedacted !== true) {
      issues.push(`${path}.browserReportPath.browserInspection.accountIdentifiersRedacted must be true`);
    }
    if (browserIdentifiers.bundleId !== "app.freed.recovery") {
      issues.push(`${path}.browserReportPath.appIdentifiers.bundleId must be app.freed.recovery`);
    }
    if (browserIdentifiers.packageName !== "app.freed.recovery") {
      issues.push(`${path}.browserReportPath.appIdentifiers.packageName must be app.freed.recovery`);
    }
    if (browserGooglePlay.observedViaBrowser !== true) {
      issues.push(`${path}.browserReportPath.googlePlay.observedViaBrowser must be true`);
    }
    if (browserGooglePlay.appRecordPresent !== true) {
      issues.push(`${path}.browserReportPath.googlePlay.appRecordPresent must be true`);
    }
    if (browserGooglePlay.packageName !== "app.freed.recovery") {
      issues.push(`${path}.browserReportPath.googlePlay.packageName must be app.freed.recovery`);
    }
    if (browserGooglePlay.productSetupAllowed !== true) {
      issues.push(`${path}.browserReportPath.googlePlay.productSetupAllowed must be true`);
    }
    if (browserAppStoreConnect.observedViaBrowser !== true) {
      issues.push(`${path}.browserReportPath.appStoreConnect.observedViaBrowser must be true`);
    }
    if (browserAppStoreConnect.appRecordPresent !== true) {
      issues.push(`${path}.browserReportPath.appStoreConnect.appRecordPresent must be true`);
    }
    if (browserAppStoreConnect.bundleId !== "app.freed.recovery") {
      issues.push(`${path}.browserReportPath.appStoreConnect.bundleId must be app.freed.recovery`);
    }
    if (browserAppStoreConnect.licenseAgreementAccepted !== true) {
      issues.push(`${path}.browserReportPath.appStoreConnect.licenseAgreementAccepted must be true`);
    }
    if (browserAppStoreConnect.productSetupAllowed !== true) {
      issues.push(`${path}.browserReportPath.appStoreConnect.productSetupAllowed must be true`);
    }
  }

  return issues;
}

function storeConsoleProductSetupArtifactIssues(
  root: string,
  store: Record<string, unknown>,
  configuredIosLaunchProductIds: Record<string, string>,
  configuredAndroidLaunchProductIds: Record<string, string>
): string[] {
  const pathPrefix = "store.consoleProductSetupArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    store.consoleProductSetupArtifact,
    pathPrefix,
    "store console product setup proof inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${pathPrefix} must contain a ${STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION} JSON object`];

  const reportIssues: string[] = [];
  const checks = isRecord(report.checks) ? report.checks : {};
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const catalog = readStoreProductsCatalog(root);
  const catalogProductsByPlan = productsByPlan(catalog.products);
  const configuredIosPostLaunchProductIds = configuredPostLaunchProductIdsByPlan("ios");
  const configuredAndroidPostLaunchProductIds = configuredPostLaunchProductIdsByPlan("android");
  const configuredMonetization = configuredMonetizationEvidenceConfig();
  const appStoreConnect = isRecord(report.appStoreConnect) ? report.appStoreConnect : {};
  const googlePlay = isRecord(report.googlePlay) ? report.googlePlay : {};

  reportIssues.push(
    ...collectForbiddenEvidenceFieldIssues(
      report,
      pathPrefix,
      new Set([
        "accountEmail",
        "accessToken",
        "appleId",
        "appleTeamId",
        "authorization",
        "authorizationHeader",
        "cookie",
        "cookies",
        "developerAccountId",
        "googleDeveloperId",
        "rawConsoleUrl",
        "rawUrl",
        "refreshToken",
        "sessionToken"
      ]),
      "console product setup evidence must use redacted screenshot/report artifacts, not account identifiers or session data"
    )
  );

  if (report.schemaVersion !== STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION) {
    reportIssues.push(`${pathPrefix}.schemaVersion must be ${STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) reportIssues.push(`${pathPrefix}.sanitized must be true`);
  if (report.result !== "store-console-product-setup-captured") {
    reportIssues.push(`${pathPrefix}.result must be store-console-product-setup-captured`);
  }
  if (report.consoleProductSetupProofUsableForManualEvidence !== true) {
    reportIssues.push(`${pathPrefix}.consoleProductSetupProofUsableForManualEvidence must be true`);
  }
  if (!suggestedEvidenceFields.includes("store.consoleProductSetupArtifact")) {
    reportIssues.push(`${pathPrefix}.suggestedEvidenceFields must include store.consoleProductSetupArtifact`);
  }
  const setupRunIdIssue = evidenceIdIssue(`${pathPrefix}.setupRunId`, report.setupRunId);
  if (setupRunIdIssue) {
    reportIssues.push(setupRunIdIssue);
  } else if (nonEmptyString(store.consoleProductSetupRunId) && report.setupRunId !== String(store.consoleProductSetupRunId).trim()) {
    reportIssues.push(`${pathPrefix}.setupRunId must match store.consoleProductSetupRunId`);
  }
  reportIssues.push(...consoleProductSourceProofIssues(root, report, pathPrefix));
  if (report.bundleId !== "app.freed.recovery") reportIssues.push(`${pathPrefix}.bundleId must be app.freed.recovery`);
  if (report.packageName !== "app.freed.recovery") reportIssues.push(`${pathPrefix}.packageName must be app.freed.recovery`);
  if (report.entitlementId !== configuredMonetization.entitlementId) {
    reportIssues.push(`${pathPrefix}.entitlementId must match configured premium entitlement id`);
  }
  if (report.subscriptionGroupId !== "freed_premium") reportIssues.push(`${pathPrefix}.subscriptionGroupId must be freed_premium`);
  reportIssues.push(...exactStringSetIssues(report.launchPlanIdsConfigured, `${pathPrefix}.launchPlanIdsConfigured`, LAUNCH_PREMIUM_PLAN_IDS));
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.iosLaunchProductIdsConfigured,
      `${pathPrefix}.iosLaunchProductIdsConfigured`,
      configuredIosLaunchProductIds,
      LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.androidLaunchProductIdsConfigured,
      `${pathPrefix}.androidLaunchProductIdsConfigured`,
      configuredAndroidLaunchProductIds,
      LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.iosPostLaunchProductIdsInactive,
      `${pathPrefix}.iosPostLaunchProductIdsInactive`,
      configuredIosPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.androidPostLaunchProductIdsInactive,
      `${pathPrefix}.androidPostLaunchProductIdsInactive`,
      configuredAndroidPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...storeConsoleAppRecordReadinessIssues(root, report.appRecordReadiness, `${pathPrefix}.appRecordReadiness`)
  );
  if (appStoreConnect.appRecordCreated !== true) reportIssues.push(`${pathPrefix}.appStoreConnect.appRecordCreated must be true`);
  if (appStoreConnect.bundleId !== "app.freed.recovery") reportIssues.push(`${pathPrefix}.appStoreConnect.bundleId must be app.freed.recovery`);
  if (appStoreConnect.subscriptionGroupId !== "freed_premium") {
    reportIssues.push(`${pathPrefix}.appStoreConnect.subscriptionGroupId must be freed_premium`);
  }
  if (appStoreConnect.noExtraLaunchProductsActive !== true) {
    reportIssues.push(`${pathPrefix}.appStoreConnect.noExtraLaunchProductsActive must be true`);
  }
  if (appStoreConnect.draftOrSandboxOnlyUntilEvidencePasses !== true) {
    reportIssues.push(`${pathPrefix}.appStoreConnect.draftOrSandboxOnlyUntilEvidencePasses must be true`);
  }
  reportIssues.push(
    ...consoleProductSetupEvidenceArtifactIssues(
      root,
      appStoreConnect,
      `${pathPrefix}.appStoreConnect`,
      "appStoreConnect"
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      appStoreConnect.futureProductIdsInactive,
      `${pathPrefix}.appStoreConnect.futureProductIdsInactive`,
      configuredIosPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...storeConsoleLaunchProductRowsIssues(
      appStoreConnect.launchProducts,
      `${pathPrefix}.appStoreConnect.launchProducts`,
      "appStoreConnect",
      configuredIosLaunchProductIds,
      catalogProductsByPlan,
      root
    )
  );
  if (googlePlay.appRecordCreated !== true) reportIssues.push(`${pathPrefix}.googlePlay.appRecordCreated must be true`);
  if (googlePlay.packageName !== "app.freed.recovery") reportIssues.push(`${pathPrefix}.googlePlay.packageName must be app.freed.recovery`);
  if (googlePlay.noExtraLaunchProductsActive !== true) {
    reportIssues.push(`${pathPrefix}.googlePlay.noExtraLaunchProductsActive must be true`);
  }
  if (googlePlay.draftOrSandboxOnlyUntilEvidencePasses !== true) {
    reportIssues.push(`${pathPrefix}.googlePlay.draftOrSandboxOnlyUntilEvidencePasses must be true`);
  }
  reportIssues.push(
    ...consoleProductSetupEvidenceArtifactIssues(
      root,
      googlePlay,
      `${pathPrefix}.googlePlay`,
      "googlePlay"
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      googlePlay.futureProductIdsInactive,
      `${pathPrefix}.googlePlay.futureProductIdsInactive`,
      configuredAndroidPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...storeConsoleLaunchProductRowsIssues(
      googlePlay.launchProducts,
      `${pathPrefix}.googlePlay.launchProducts`,
      "googlePlay",
      configuredAndroidLaunchProductIds,
      catalogProductsByPlan,
      root
    )
  );
  for (const check of STORE_CONSOLE_PRODUCT_SETUP_REQUIRED_CHECKS) {
    if (checks[check] !== true) reportIssues.push(`${pathPrefix}.checks.${check}`);
  }

  return reportIssues;
}

function storePaywallLaunchScopeArtifactIssues(
  root: string,
  store: Record<string, unknown>,
  configuredIosLaunchProductIds: Record<string, string>,
  configuredAndroidLaunchProductIds: Record<string, string>
): string[] {
  const pathPrefix = "store.paywallLaunchScopeArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    store.paywallLaunchScopeArtifact,
    pathPrefix,
    "Core 3 paywall launch scope proof inspection"
  );
  if (issues.length > 0 || !report) return issues;
  if (!isRecord(report)) return [`${pathPrefix} must contain a ${STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION} JSON object`];

  const reportIssues: string[] = [];
  const checks = isRecord(report.checks) ? report.checks : {};
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const configuredIosPostLaunchProductIds = configuredPostLaunchProductIdsByPlan("ios");
  const configuredAndroidPostLaunchProductIds = configuredPostLaunchProductIdsByPlan("android");
  const futureProductIds = new Set([
    ...Object.values(configuredIosPostLaunchProductIds),
    ...Object.values(configuredAndroidPostLaunchProductIds)
  ]);
  const reportVisibleProductIds = [
    ...(isRecord(report.iosLaunchProductIdsShown) ? Object.values(report.iosLaunchProductIdsShown) : []),
    ...(isRecord(report.androidLaunchProductIdsShown) ? Object.values(report.androidLaunchProductIdsShown) : [])
  ].filter((value): value is string => nonEmptyString(value));

  if (report.schemaVersion !== STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION) {
    reportIssues.push(`${pathPrefix}.schemaVersion must be ${STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) reportIssues.push(`${pathPrefix}.sanitized must be true`);
  if (report.result !== "paywall-launch-scope-captured") {
    reportIssues.push(`${pathPrefix}.result must be paywall-launch-scope-captured`);
  }
  if (report.paywallLaunchScopeProofUsableForManualEvidence !== true) {
    reportIssues.push(`${pathPrefix}.paywallLaunchScopeProofUsableForManualEvidence must be true`);
  }
  if (!suggestedEvidenceFields.includes("store.paywallLaunchScopeArtifact")) {
    reportIssues.push(`${pathPrefix}.suggestedEvidenceFields must include store.paywallLaunchScopeArtifact`);
  }
  const runIdIssue = evidenceIdIssue(`${pathPrefix}.runId`, report.runId);
  if (runIdIssue) {
    reportIssues.push(runIdIssue);
  } else if (nonEmptyString(store.paywallScopeRunId) && report.runId !== String(store.paywallScopeRunId).trim()) {
    reportIssues.push(`${pathPrefix}.runId must match store.paywallScopeRunId`);
  }
  reportIssues.push(...exactStringSetIssues(report.launchPlanIdsShown, `${pathPrefix}.launchPlanIdsShown`, LAUNCH_PREMIUM_PLAN_IDS));
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.iosLaunchProductIdsShown,
      `${pathPrefix}.iosLaunchProductIdsShown`,
      configuredIosLaunchProductIds,
      LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.androidLaunchProductIdsShown,
      `${pathPrefix}.androidLaunchProductIdsShown`,
      configuredAndroidLaunchProductIds,
      LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactStringSetIssues(report.postLaunchPlanIdsHidden, `${pathPrefix}.postLaunchPlanIdsHidden`, POST_LAUNCH_PREMIUM_PLAN_IDS)
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.iosPostLaunchProductIdsHidden,
      `${pathPrefix}.iosPostLaunchProductIdsHidden`,
      configuredIosPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  reportIssues.push(
    ...exactProductIdMapIssues(
      report.androidPostLaunchProductIdsHidden,
      `${pathPrefix}.androidPostLaunchProductIdsHidden`,
      configuredAndroidPostLaunchProductIds,
      POST_LAUNCH_PREMIUM_PLAN_IDS
    )
  );
  for (const visibleProductId of reportVisibleProductIds) {
    if (futureProductIds.has(visibleProductId)) {
      reportIssues.push(`${pathPrefix}.visible product ids must not include post-launch product id ${visibleProductId}`);
    }
  }
  if (report.primaryValuePlanId !== "yearly") reportIssues.push(`${pathPrefix}.primaryValuePlanId must be yearly`);
  if (report.restorePurchasesVisible !== true) reportIssues.push(`${pathPrefix}.restorePurchasesVisible must be true`);
  if (report.purchaseButtonsEnabled !== true) reportIssues.push(`${pathPrefix}.purchaseButtonsEnabled must be true`);
  if (report.yearlyValueAnchorVisible !== true) reportIssues.push(`${pathPrefix}.yearlyValueAnchorVisible must be true`);
  for (const sourceProof of STORE_PAYWALL_LAUNCH_SCOPE_SOURCE_PROOFS) {
    const sourcePath = report[sourceProof.pathField];
    const sourceHash = report[sourceProof.hashField];
    if (sourcePath !== sourceProof.expectedPath) {
      reportIssues.push(`${pathPrefix}.${sourceProof.pathField} must be ${sourceProof.expectedPath}`);
    }
    if (!nonEmptyString(sourceHash) || !/^sha256-[0-9a-f]{64}$/i.test(String(sourceHash).trim())) {
      reportIssues.push(`${pathPrefix}.${sourceProof.hashField} must use sha256-<64-hex> format`);
    } else {
      const expectedHash = localFileSha256Label(root, sourceProof.expectedPath);
      if (expectedHash && String(sourceHash).trim().toLowerCase() !== expectedHash) {
        reportIssues.push(`${pathPrefix}.${sourceProof.hashField} must match ${sourceProof.expectedPath}`);
      }
    }
  }
  for (const check of STORE_PAYWALL_LAUNCH_SCOPE_REQUIRED_CHECKS) {
    if (checks[check] !== true) reportIssues.push(`${pathPrefix}.checks.${check}`);
  }

  return reportIssues;
}

function storeAdSandboxIssues(payload: Record<string, unknown>, root: string): string[] {
  const store = isRecord(payload.store) ? payload.store : {};
  const forbiddenSensitiveStoreFields = [
    "iosReceipt",
    "appStoreReceipt",
    "appleReceipt",
    "rawReceipt",
    "receiptData",
    "purchaseReceipt",
    "rawPurchaseReceipt",
    "androidPurchaseToken",
    "purchaseToken",
    "rawPurchaseToken",
    "playPurchaseToken",
    "playStorePurchaseToken",
    "customerId",
    "customerIdentifier",
    "appUserId",
    "adNetworkSecret",
    "adMobAppSecret",
    "appStorePrivateKey",
    "appStoreServerApiJwt",
    "googlePlayServiceAccountJson",
    "googlePlayAccessToken"
  ];
  const forbiddenNonRewardedAdFields = [
    "bannerAdUnitId",
    "bannerAdRequestArtifact",
    "interstitialAdUnitId",
    "interstitialAdRequestArtifact",
    "appOpenAdUnitId",
    "appOpenAdRequestArtifact",
    "nativeAdUnitId",
    "nativeAdRequestArtifact"
  ];
  const forbiddenSensitiveStoreValuePatterns = [
    /\braw[-_\s]*(?:ios|app[-_\s]?store|apple|purchase)?[-_\s]*receipt\b/i,
    /\b(?:ios|app[-_\s]?store|apple|purchase)[-_\s]*receipt(?:[-_\s]?(?:data|secret|payload))?\b/i,
    /\breceipt[-_\s]?(?:data|secret|payload)\b/i,
    /\b(?:android|google[-_\s]?play|play|purchase)[-_\s]*(?:purchase[-_\s]*)?token(?![-_\s]*hash)\b/i,
    /\b(?:customer[-_\s]?(?:id|identifier)|app[-_\s]?user[-_\s]?id)\b/i,
    /\b(?:ad[-_\s]?network|admob|app[-_\s]?store|google[-_\s]?play)[-_\s]*(?:secret|private[-_\s]?key|service[-_\s]?account)\b/i,
    /\b(?:receipt|purchaseToken|purchase_token|access_token|token|secret)=/i,
    /\bya29\.[A-Za-z0-9._-]+/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
  ];
  const requiredFields = [
    "storeProvider",
    "iosProductId",
    "androidProductId",
    "purchaseVerifyEndpoint",
    "releasePreflightCommand",
    "releasePreflightRunId",
    "releasePreflightArtifact",
    "iosPurchaseRunId",
    "iosPurchaseArtifact",
    "iosPurchaseTransactionId",
    "iosRestoreRunId",
    "iosRestoreArtifact",
    "iosRestoreTransactionId",
    "androidPurchaseRunId",
    "androidPurchaseArtifact",
    "androidOrderId",
    "androidRestoreRunId",
    "androidRestoreArtifact",
    "androidPurchaseTokenHash",
    "entitlementId",
    "purchaseSmokeCommand",
    "paywallScopeRunId",
    "paywallLaunchScopeArtifact",
    "consoleProductSetupRunId",
    "consoleProductSetupArtifact",
    "purchaseVerificationReportId",
    "purchaseVerificationArtifact",
    "restoreVerificationReportId",
    "restoreVerificationArtifact",
    "rewardedAdUnitId",
    "rewardedAdFormat",
    "rewardedAdResponseId",
    "rewardedAdRequestArtifact",
    "freeRewardedInterventionRunId",
    "freeRewardedInterventionArtifact",
    "rewardedAdCompletionRunId",
    "rewardedAdCompletionArtifact",
    "adFailureFallbackRunId",
    "adFailureFallbackArtifact",
    "premiumNoAdInterventionRunId",
    "premiumNoAdInterventionArtifact",
    "adRequestCountryCode",
    "privacyDisclosureReviewId",
    "privacyDisclosureArtifact"
  ];
  const storeArtifactFields = [
    "releasePreflightArtifact",
    "iosPurchaseArtifact",
    "iosRestoreArtifact",
    "androidPurchaseArtifact",
    "androidRestoreArtifact",
    "purchaseVerificationArtifact",
    "restoreVerificationArtifact",
    "paywallLaunchScopeArtifact",
    "consoleProductSetupArtifact",
    "rewardedAdRequestArtifact",
    "freeRewardedInterventionArtifact",
    "rewardedAdCompletionArtifact",
    "adFailureFallbackArtifact",
    "premiumNoAdInterventionArtifact",
    "privacyDisclosureArtifact"
  ];
  const purchaseVerificationPassCount = numberField(store, "purchaseVerificationPassCount");
  const purchaseVerificationFailedCount = numberField(store, "purchaseVerificationFailedCount");
  const restoreVerificationPassCount = numberField(store, "restoreVerificationPassCount");
  const restoreVerificationFailedCount = numberField(store, "restoreVerificationFailedCount");
  const freePostAdChallengeLatencyMs = numberField(store, "freePostAdChallengeLatencyMs");
  const premiumNoAdLatencyMs = numberField(store, "premiumNoAdLatencyMs");
  const issues: string[] = [];

  for (const field of requiredFields) {
    if (!nonEmptyString(store[field])) issues.push(`store.${field}`);
  }
  const storeEvidenceIdFields = [
    "releasePreflightRunId",
    "iosPurchaseRunId",
    "iosRestoreRunId",
    "androidPurchaseRunId",
    "androidRestoreRunId",
    "purchaseVerificationReportId",
    "restoreVerificationReportId",
    "paywallScopeRunId",
    "consoleProductSetupRunId",
    "freeRewardedInterventionRunId",
    "rewardedAdCompletionRunId",
    "adFailureFallbackRunId",
    "premiumNoAdInterventionRunId",
    "privacyDisclosureReviewId"
  ];
  for (const field of storeEvidenceIdFields) {
    if (nonEmptyString(store[field])) {
      const issue = evidenceIdIssue(`store.${field}`, store[field]);
      if (issue) issues.push(issue);
    }
  }
  issues.push(
    ...duplicateEvidenceIdIssues(storeEvidenceIdFields.map((field) => ({ path: `store.${field}`, value: store[field] })))
  );
  for (const field of forbiddenSensitiveStoreFields) {
    const value = store[field];
    const hasSubmittedValue = value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
    if (hasSubmittedValue) {
      issues.push(`store.${field} must be omitted from evidence; store only sanitized IDs, hashes, or artifact references`);
    }
  }
  for (const field of forbiddenNonRewardedAdFields) {
    const value = store[field];
    const hasSubmittedValue = value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
    if (hasSubmittedValue) {
      issues.push(`store.${field} must be omitted from evidence; FREED store/ad release evidence may only use rewarded ads`);
    }
  }
  issues.push(
    ...collectForbiddenEvidenceFieldIssues(
      payload,
      "root",
      new Set(forbiddenSensitiveStoreFields),
      "store only sanitized IDs, hashes, or artifact references",
      new Set(forbiddenSensitiveStoreFields.map((field) => `root.store.${field}`))
    )
  );
  issues.push(
    ...collectForbiddenEvidenceFieldIssues(
      payload,
      "root",
      new Set(forbiddenNonRewardedAdFields),
      "FREED store/ad release evidence may only use rewarded ads",
      new Set(forbiddenNonRewardedAdFields.map((field) => `root.store.${field}`))
    )
  );
  issues.push(
    ...collectForbiddenEvidenceTextIssues(
      payload,
      "root",
      forbiddenSensitiveStoreValuePatterns,
      "store only sanitized IDs, hashes, or artifact references",
      {
        skipPathPrefixes: new Set(["root.evidence"]),
        skipExactPaths: new Set([
          ...storeArtifactFields.map((field) => `root.store.${field}`),
          "root.store.purchaseVerifyEndpoint",
          "root.store.releasePreflightCommand",
          "root.store.purchaseSmokeCommand"
        ])
      }
    )
  );
  for (const field of storeArtifactFields) {
    if (nonEmptyString(store[field])) {
      const artifactIssue = missingEvidenceReference(root, store[field], `store.${field}`);
      if (artifactIssue) issues.push(artifactIssue);
    }
  }
  if (
    nonEmptyString(store.storeProvider) &&
    !["native-iap", "revenuecat"].includes(store.storeProvider.trim().toLowerCase())
  ) {
    issues.push("store.storeProvider must be native-iap or revenuecat");
  }
  const configuredMonetization = configuredMonetizationEvidenceConfig();
  if (
    nonEmptyString(store.storeProvider) &&
    ["native-iap", "revenuecat"].includes(store.storeProvider.trim().toLowerCase()) &&
    store.storeProvider.trim().toLowerCase() !== configuredMonetization.storeProvider
  ) {
    issues.push("store.storeProvider must match configured monetization store provider");
  }
  const configuredIosProductIds = configuredPremiumProductIds("ios");
  const configuredAndroidProductIds = configuredPremiumProductIds("android");
  const configuredIosLaunchProductIds = configuredLaunchProductIdsByPlan("ios");
  const configuredAndroidLaunchProductIds = configuredLaunchProductIdsByPlan("android");
  for (const field of ["iosProductId", "androidProductId"]) {
    const value = store[field];
    if (nonEmptyString(value) && !/^[A-Za-z0-9._-]+$/.test(value.trim())) {
      issues.push(`store.${field} must use a store product id format`);
    }
  }
  if (nonEmptyString(store.iosProductId) && !configuredIosProductIds.has(store.iosProductId.trim())) {
    issues.push("store.iosProductId must match a configured FREED Core 3 launch product id");
  }
  if (nonEmptyString(store.androidProductId) && !configuredAndroidProductIds.has(store.androidProductId.trim())) {
    issues.push("store.androidProductId must match a configured FREED Core 3 launch product id");
  }
  issues.push(...launchProductIdMapIssues(store, "iosLaunchProductIds", configuredIosLaunchProductIds));
  issues.push(...launchProductIdMapIssues(store, "androidLaunchProductIds", configuredAndroidLaunchProductIds));
  issues.push(
    ...launchProductSandboxMatrixIssues(store, root, configuredIosLaunchProductIds, configuredAndroidLaunchProductIds)
  );
  issues.push(...storePaywallLaunchScopeArtifactIssues(root, store, configuredIosLaunchProductIds, configuredAndroidLaunchProductIds));
  issues.push(...storeConsoleProductSetupArtifactIssues(root, store, configuredIosLaunchProductIds, configuredAndroidLaunchProductIds));
  if (nonEmptyString(store.entitlementId) && !/^[A-Za-z0-9._-]{3,64}$/.test(store.entitlementId.trim())) {
    issues.push("store.entitlementId must use an entitlement id format");
  } else if (nonEmptyString(store.entitlementId) && store.entitlementId.trim() !== configuredMonetization.entitlementId) {
    issues.push("store.entitlementId must match configured premium entitlement id");
  }
  if (nonEmptyString(store.purchaseVerifyEndpoint)) {
    issues.push(...formatEndpointIssues(getProductionEndpointIssues(store.purchaseVerifyEndpoint, "store.purchaseVerifyEndpoint")));
    if (
      configuredMonetization.purchaseVerifyEndpoint &&
      store.purchaseVerifyEndpoint.trim() !== configuredMonetization.purchaseVerifyEndpoint
    ) {
      issues.push("store.purchaseVerifyEndpoint must match configured purchase verification endpoint");
    }
  }
  for (const field of ["iosPurchaseTransactionId", "iosRestoreTransactionId"]) {
    if (nonEmptyString(store[field]) && !/^\d{10,20}$/.test(store[field].trim())) {
      issues.push(`store.${field} must use App Store transaction id format`);
    }
  }
  if (
    nonEmptyString(store.androidOrderId) &&
    !/^GPA\.\d{4}-\d{4}-\d{4}-\d{5}$/i.test(store.androidOrderId.trim())
  ) {
    issues.push("store.androidOrderId must use Play order id format");
  }
  if (
    nonEmptyString(store.androidPurchaseTokenHash) &&
    !/^sha256-[a-f0-9]{64}$/i.test(store.androidPurchaseTokenHash.trim())
  ) {
    issues.push("store.androidPurchaseTokenHash must be a full sha256 hash label");
  }
  if (nonEmptyString(store.androidPurchaseToken)) issues.push("store.androidPurchaseToken must be hashed or omitted");
  if (!nonEmptyString(store.rewardedAdFormat)) {
    issues.push("store.rewardedAdFormat");
  } else if (store.rewardedAdFormat.trim().toLowerCase() !== "rewarded") {
    issues.push("store.rewardedAdFormat must be rewarded");
  }
  if (store.adRequestNonPersonalized !== true) issues.push("store.adRequestNonPersonalized must be true");
  if (store.noInterstitialOrBannerAdRequestsConfirmed !== true) {
    issues.push("store.noInterstitialOrBannerAdRequestsConfirmed must be true");
  }
  if (store.premiumNoRewardedAdRequested !== true) {
    issues.push("store.premiumNoRewardedAdRequested must be true");
  }
  if (nonEmptyString(store.adRequestCountryCode) && !validIso3166Alpha2CountryCode(store.adRequestCountryCode)) {
    issues.push("store.adRequestCountryCode must be ISO 3166-1 alpha-2");
  }
  if (
    nonEmptyString(store.releasePreflightCommand) &&
    !matchesReleaseCommand(store.releasePreflightCommand, "preflight:release-env")
  ) {
    issues.push("store.releasePreflightCommand must be npm run preflight:release-env, optionally with -- --env-file <path>");
  }
  if (
    nonEmptyString(store.purchaseSmokeCommand) &&
    !matchesReleaseCommand(store.purchaseSmokeCommand, "smoke:purchase-verification")
  ) {
    issues.push("store.purchaseSmokeCommand must be npm run smoke:purchase-verification, optionally with -- --env-file <path>");
  }
  if (purchaseVerificationPassCount === null) {
    issues.push("store.purchaseVerificationPassCount");
  } else if (purchaseVerificationPassCount < PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT) {
    issues.push(`store.purchaseVerificationPassCount >= ${PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT}`);
  }
  if (purchaseVerificationFailedCount === null) {
    issues.push("store.purchaseVerificationFailedCount");
  } else if (purchaseVerificationFailedCount !== 0) {
    issues.push("store.purchaseVerificationFailedCount must be 0");
  }
  if (restoreVerificationPassCount === null) {
    issues.push("store.restoreVerificationPassCount");
  } else if (restoreVerificationPassCount < PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT) {
    issues.push(`store.restoreVerificationPassCount >= ${PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT}`);
  }
  if (restoreVerificationFailedCount === null) {
    issues.push("store.restoreVerificationFailedCount");
  } else if (restoreVerificationFailedCount !== 0) {
    issues.push("store.restoreVerificationFailedCount must be 0");
  }
  if (freePostAdChallengeLatencyMs === null) {
    issues.push("store.freePostAdChallengeLatencyMs");
  } else if (freePostAdChallengeLatencyMs < 0 || freePostAdChallengeLatencyMs > 5_000) {
    issues.push("store.freePostAdChallengeLatencyMs must be between 0 and 5000");
  }
  if (premiumNoAdLatencyMs === null) {
    issues.push("store.premiumNoAdLatencyMs");
  } else if (premiumNoAdLatencyMs < 0 || premiumNoAdLatencyMs > 3_000) {
    issues.push("store.premiumNoAdLatencyMs must be between 0 and 3000");
  }
  if (
    nonEmptyString(store.rewardedAdUnitId) &&
    (!/^ca-app-pub-\d{16}\/\d{10}$/.test(store.rewardedAdUnitId.trim()) ||
      store.rewardedAdUnitId.includes("ca-app-pub-3940256099942544"))
  ) {
    issues.push("store.rewardedAdUnitId must use a real AdMob rewarded unit id format");
  }
  if (
    nonEmptyString(store.rewardedAdUnitId) &&
    configuredMonetization.rewardedUnitIds.size > 0 &&
    !configuredMonetization.rewardedUnitIds.has(store.rewardedAdUnitId.trim())
  ) {
    issues.push("store.rewardedAdUnitId must match a configured rewarded reset ad unit");
  }
  if (nonEmptyString(store.rewardedAdResponseId) && !validAdMobResponseId(store.rewardedAdResponseId)) {
    issues.push("store.rewardedAdResponseId must be a concrete AdMob response id from a loaded rewarded ad");
  }
  issues.push(...storeRewardedAdRequestArtifactIssues(root, store));
  issues.push(
    ...storeInterventionFlowArtifactIssues(root, store, {
      artifactField: "freeRewardedInterventionArtifact",
      runIdField: "freeRewardedInterventionRunId",
      flowType: "free-rewarded-intervention",
      latencyField: "freePostAdChallengeLatencyMs",
      maxLatencyMs: 5_000
    })
  );
  issues.push(
    ...storeInterventionFlowArtifactIssues(root, store, {
      artifactField: "rewardedAdCompletionArtifact",
      runIdField: "rewardedAdCompletionRunId",
      flowType: "rewarded-ad-completion"
    })
  );
  issues.push(
    ...storeInterventionFlowArtifactIssues(root, store, {
      artifactField: "adFailureFallbackArtifact",
      runIdField: "adFailureFallbackRunId",
      flowType: "ad-failure-fallback"
    })
  );
  issues.push(
    ...storeInterventionFlowArtifactIssues(root, store, {
      artifactField: "premiumNoAdInterventionArtifact",
      runIdField: "premiumNoAdInterventionRunId",
      flowType: "premium-no-ad-intervention",
      latencyField: "premiumNoAdLatencyMs",
      maxLatencyMs: 3_000
    })
  );
  issues.push(...storePurchaseVerificationArtifactIssues(root, store, "purchaseVerificationArtifact"));
  issues.push(...storePurchaseVerificationArtifactIssues(root, store, "restoreVerificationArtifact"));
  issues.push(...storePrivacyDisclosureArtifactIssues(root, store));

  return issues;
}

type StoreInterventionFlowArtifactConfig = {
  artifactField:
    | "freeRewardedInterventionArtifact"
    | "rewardedAdCompletionArtifact"
    | "adFailureFallbackArtifact"
    | "premiumNoAdInterventionArtifact";
  runIdField:
    | "freeRewardedInterventionRunId"
    | "rewardedAdCompletionRunId"
    | "adFailureFallbackRunId"
    | "premiumNoAdInterventionRunId";
  flowType:
    | "free-rewarded-intervention"
    | "rewarded-ad-completion"
    | "ad-failure-fallback"
    | "premium-no-ad-intervention";
  latencyField?: "freePostAdChallengeLatencyMs" | "premiumNoAdLatencyMs";
  maxLatencyMs?: number;
};

function storeInterventionFlowArtifactIssues(
  root: string,
  store: Record<string, unknown>,
  config: StoreInterventionFlowArtifactConfig
) {
  const pathPrefix = `store.${config.artifactField}`;
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    store[config.artifactField],
    pathPrefix,
    "store intervention flow proof inspection"
  );
  if (issues.length > 0 || !report) return issues;

  if (!isRecord(report)) return [`${pathPrefix} must contain a ${STORE_INTERVENTION_FLOW_SCHEMA_VERSION} JSON object`];

  const reportIssues: string[] = [];
  const checks = isRecord(report.checks) ? report.checks : {};
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const requiredChecks = STORE_INTERVENTION_FLOW_REQUIRED_CHECKS_BY_TYPE[config.flowType] ?? [];
  const forbiddenFields = new Set([
    "rawAdResponse",
    "rawAdError",
    "adNetworkSecret",
    "adMobAppSecret",
    "adMobSecret",
    "rewardedAdResponsePayload",
    "receipt",
    "rawReceipt",
    "purchaseToken",
    "entitlementToken",
    "customerIdentifier",
    "appUserId",
    "deviceToken"
  ]);
  const forbiddenPatterns = [
    /\braw[-_\s]*(?:ad|rewarded|receipt|purchase|entitlement)[-_\s]*(?:response|payload|token|receipt|error)\b/i,
    /\b(?:ad[-_\s]?network|admob|app[-_\s]?store|google[-_\s]?play)[-_\s]*(?:secret|private[-_\s]?key|service[-_\s]?account)\b/i,
    /\b(?:receipt|purchaseToken|purchase_token|entitlementToken|access_token|token|secret)=/i,
    /\bya29\.[A-Za-z0-9._-]+/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
  ];

  if (report.schemaVersion !== STORE_INTERVENTION_FLOW_SCHEMA_VERSION) {
    reportIssues.push(`${pathPrefix}.schemaVersion must be ${STORE_INTERVENTION_FLOW_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${pathPrefix}.sanitized must be true`);
  }
  if (report.result !== "intervention-flow-captured") {
    reportIssues.push(`${pathPrefix}.result must be intervention-flow-captured`);
  }
  if (report.interventionFlowProofUsableForManualEvidence !== true) {
    reportIssues.push(`${pathPrefix}.interventionFlowProofUsableForManualEvidence must be true`);
  }
  if (report.flowType !== config.flowType) {
    reportIssues.push(`${pathPrefix}.flowType must be ${config.flowType}`);
  }
  if (!suggestedEvidenceFields.includes(`store.${config.artifactField}`)) {
    reportIssues.push(`${pathPrefix}.suggestedEvidenceFields must include store.${config.artifactField}`);
  }
  const runIdIssue = evidenceIdIssue(`${pathPrefix}.runId`, report.runId);
  if (runIdIssue) {
    reportIssues.push(runIdIssue);
  } else if (nonEmptyString(store[config.runIdField]) && report.runId !== String(store[config.runIdField]).trim()) {
    reportIssues.push(`${pathPrefix}.runId must match store.${config.runIdField}`);
  }
  if (config.latencyField) {
    const reportLatencyMs = numberField(report, "latencyMs");
    const storeLatencyMs = numberField(store, config.latencyField);
    if (reportLatencyMs === null) {
      reportIssues.push(`${pathPrefix}.latencyMs`);
    } else {
      if (reportLatencyMs < 0 || (config.maxLatencyMs !== undefined && reportLatencyMs > config.maxLatencyMs)) {
        reportIssues.push(`${pathPrefix}.latencyMs must be between 0 and ${config.maxLatencyMs}`);
      }
      if (storeLatencyMs !== null && !numbersMatchWithinTolerance(reportLatencyMs, storeLatencyMs, 1)) {
        reportIssues.push(`${pathPrefix}.latencyMs must match store.${config.latencyField}`);
      }
    }
  }
  if (config.flowType === "free-rewarded-intervention") {
    if (report.rewardedAdRequested !== true) reportIssues.push(`${pathPrefix}.rewardedAdRequested must be true`);
    if (report.premiumEntitlementActive !== false) reportIssues.push(`${pathPrefix}.premiumEntitlementActive must be false`);
  }
  if (config.flowType === "rewarded-ad-completion") {
    if (report.rewardedAdCompleted !== true) reportIssues.push(`${pathPrefix}.rewardedAdCompleted must be true`);
    if (report.challengeAccessGranted !== true) reportIssues.push(`${pathPrefix}.challengeAccessGranted must be true`);
  }
  if (config.flowType === "ad-failure-fallback") {
    if (report.adFailureObserved !== true) reportIssues.push(`${pathPrefix}.adFailureObserved must be true`);
    if (report.challengeAccessGranted !== true) reportIssues.push(`${pathPrefix}.challengeAccessGranted must be true`);
    if (report.retryLoopRequired !== false) reportIssues.push(`${pathPrefix}.retryLoopRequired must be false`);
  }
  if (config.flowType === "premium-no-ad-intervention") {
    if (report.premiumEntitlementActive !== true) reportIssues.push(`${pathPrefix}.premiumEntitlementActive must be true`);
    if (report.rewardedAdRequested !== false) reportIssues.push(`${pathPrefix}.rewardedAdRequested must be false`);
  }
  for (const check of requiredChecks) {
    if (checks[check] !== true) reportIssues.push(`${pathPrefix}.checks.${check}`);
  }
  reportIssues.push(
    ...collectForbiddenEvidenceFieldIssues(
      report,
      pathPrefix,
      forbiddenFields,
      "store intervention flow proof must omit raw ad payloads, receipts, purchase tokens, customer IDs, device tokens, and ad-network secrets"
    )
  );
  reportIssues.push(
    ...collectForbiddenEvidenceTextIssues(
      report,
      pathPrefix,
      forbiddenPatterns,
      "store intervention flow proof must omit raw ad payloads, receipts, purchase tokens, customer IDs, device tokens, and ad-network secrets"
    )
  );

  return reportIssues;
}

function storeRewardedAdRequestArtifactIssues(root: string, store: Record<string, unknown>) {
  const pathPrefix = "store.rewardedAdRequestArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    store.rewardedAdRequestArtifact,
    pathPrefix,
    "rewarded-only AdMob request proof inspection"
  );
  if (issues.length > 0 || !report) return issues;

  if (!isRecord(report)) return [`${pathPrefix} must contain a ${STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION} JSON object`];

  const reportIssues: string[] = [];
  const checks = isRecord(report.checks) ? report.checks : {};
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const forbiddenFields = new Set([
    "advertisingId",
    "androidAdvertisingId",
    "idfa",
    "idfv",
    "preciseLocation",
    "latitude",
    "longitude",
    "deviceToken",
    "adNetworkSecret",
    "adMobAppSecret",
    "adMobSecret",
    "appStorePrivateKey",
    "googlePlayAccessToken"
  ]);
  const forbiddenPatterns = [
    /\badvertising[-_\s]?id\b/i,
    /\bidfa\b/i,
    /\b(?:latitude|longitude|precise[-_\s]?location)\b/i,
    /\b(?:ad[-_\s]?network|admob|app[-_\s]?store|google[-_\s]?play)[-_\s]*(?:secret|private[-_\s]?key|service[-_\s]?account)\b/i,
    /\b(?:access_token|token|secret)=/i,
    /\bya29\.[A-Za-z0-9._-]+/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
  ];

  if (report.schemaVersion !== STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION) {
    reportIssues.push(`${pathPrefix}.schemaVersion must be ${STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${pathPrefix}.sanitized must be true`);
  }
  if (report.result !== "rewarded-ad-request-captured") {
    reportIssues.push(`${pathPrefix}.result must be rewarded-ad-request-captured`);
  }
  if (report.rewardedAdRequestProofUsableForManualEvidence !== true) {
    reportIssues.push(`${pathPrefix}.rewardedAdRequestProofUsableForManualEvidence must be true`);
  }
  if (!suggestedEvidenceFields.includes("store.rewardedAdRequestArtifact")) {
    reportIssues.push(`${pathPrefix}.suggestedEvidenceFields must include store.rewardedAdRequestArtifact`);
  }
  if (report.adFormat !== "rewarded") {
    reportIssues.push(`${pathPrefix}.adFormat must be rewarded`);
  }
  if (nonEmptyString(store.rewardedAdUnitId)) {
    if (report.rewardedAdUnitId !== store.rewardedAdUnitId.trim()) {
      reportIssues.push(`${pathPrefix}.rewardedAdUnitId must match store.rewardedAdUnitId`);
    }
  }
  if (!nonEmptyString(report.rewardedAdUnitId) || !/^ca-app-pub-\d{16}\/\d{10}$/.test(String(report.rewardedAdUnitId).trim())) {
    reportIssues.push(`${pathPrefix}.rewardedAdUnitId must use a real AdMob rewarded unit id format`);
  } else if (String(report.rewardedAdUnitId).includes("ca-app-pub-3940256099942544")) {
    reportIssues.push(`${pathPrefix}.rewardedAdUnitId must not use a Google sample publisher id`);
  }
  if (nonEmptyString(store.rewardedAdResponseId)) {
    if (report.rewardedAdResponseId !== store.rewardedAdResponseId.trim()) {
      reportIssues.push(`${pathPrefix}.rewardedAdResponseId must match store.rewardedAdResponseId`);
    }
  }
  if (!validAdMobResponseId(report.rewardedAdResponseId)) {
    reportIssues.push(`${pathPrefix}.rewardedAdResponseId must be a concrete AdMob response id from a loaded rewarded ad`);
  }
  if (report.adRequestNonPersonalized !== true) {
    reportIssues.push(`${pathPrefix}.adRequestNonPersonalized must be true`);
  }
  if (report.noInterstitialOrBannerAdRequestsConfirmed !== true) {
    reportIssues.push(`${pathPrefix}.noInterstitialOrBannerAdRequestsConfirmed must be true`);
  }
  if (nonEmptyString(store.adRequestCountryCode)) {
    if (report.adRequestCountryCode !== store.adRequestCountryCode.trim().toUpperCase()) {
      reportIssues.push(`${pathPrefix}.adRequestCountryCode must match store.adRequestCountryCode`);
    }
  }
  if (nonEmptyString(report.adRequestCountryCode) && !validIso3166Alpha2CountryCode(report.adRequestCountryCode)) {
    reportIssues.push(`${pathPrefix}.adRequestCountryCode must be ISO 3166-1 alpha-2`);
  }
  for (const check of STORE_REWARDED_AD_REQUEST_REQUIRED_CHECKS) {
    if (checks[check] !== true) reportIssues.push(`${pathPrefix}.checks.${check}`);
  }
  reportIssues.push(
    ...collectForbiddenEvidenceFieldIssues(
      report,
      pathPrefix,
      forbiddenFields,
      "rewarded ad request proof must omit advertising IDs, precise location, device tokens, and ad-network secrets"
    )
  );
  reportIssues.push(
    ...collectForbiddenEvidenceTextIssues(
      report,
      pathPrefix,
      forbiddenPatterns,
      "rewarded ad request proof must omit advertising IDs, precise location, device tokens, and ad-network secrets"
    )
  );

  return reportIssues;
}

function storePrivacyDisclosureArtifactIssues(root: string, store: Record<string, unknown>) {
  const pathPrefix = "store.privacyDisclosureArtifact";
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    store.privacyDisclosureArtifact,
    pathPrefix,
    "store privacy disclosure proof inspection"
  );
  if (issues.length > 0 || !report) return issues;

  if (!isRecord(report)) return [`${pathPrefix} must contain a ${STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION} JSON object`];

  const reportIssues: string[] = [];
  const checks = isRecord(report.checks) ? report.checks : {};
  const signals = isRecord(report.signals) ? report.signals : {};
  const platformsReviewed = Array.isArray(report.platformsReviewed)
    ? report.platformsReviewed.map((entry) => normalizedReportPlatform(entry))
    : [];
  const reviewedStoreSurfaces = Array.isArray(report.reviewedStoreSurfaces)
    ? report.reviewedStoreSurfaces.map((entry) => normalizedReportPlatform(entry))
    : [];
  const suggestedEvidenceFields = Array.isArray(report.suggestedEvidenceFields)
    ? report.suggestedEvidenceFields
    : [];
  const forbiddenFields = new Set([
    "rawReceipt",
    "receipt",
    "appStoreReceipt",
    "purchaseReceipt",
    "receiptData",
    "purchaseToken",
    "androidPurchaseToken",
    "googlePlayPurchaseToken",
    "customerIdentifier",
    "appUserId",
    "adNetworkSecret",
    "googlePlayAccessToken",
    "storeCredential",
    "serviceAccountJson"
  ]);
  const forbiddenPatterns = [
    /\braw[-_\s]*(?:ios|app[-_\s]?store|apple|purchase)?[-_\s]*receipt\b/i,
    /\b(?:ios|app[-_\s]?store|apple|purchase)[-_\s]*receipt(?:[-_\s]?(?:data|secret|payload))?\b/i,
    /\breceipt[-_\s]?(?:data|secret|payload)\b/i,
    /\b(?:android|google[-_\s]?play|play|purchase)[-_\s]*(?:purchase[-_\s]*)?token(?![-_\s]*hash)\b/i,
    /\b(?:customer[-_\s]?(?:id|identifier)|app[-_\s]?user[-_\s]?id)\b/i,
    /\b(?:ad[-_\s]?network|admob|app[-_\s]?store|google[-_\s]?play)[-_\s]*(?:secret|private[-_\s]?key|service[-_\s]?account)\b/i,
    /\b(?:receipt|purchaseToken|purchase_token|access_token|token|secret)=/i,
    /\bya29\.[A-Za-z0-9._-]+/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
  ];

  if (report.schemaVersion !== STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION) {
    reportIssues.push(`${pathPrefix}.schemaVersion must be ${STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION}`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${pathPrefix}.sanitized must be true`);
  }
  if (report.result !== "privacy-disclosure-review-captured") {
    reportIssues.push(`${pathPrefix}.result must be privacy-disclosure-review-captured`);
  }
  if (report.privacyDisclosureProofUsableForManualEvidence !== true) {
    reportIssues.push(`${pathPrefix}.privacyDisclosureProofUsableForManualEvidence must be true`);
  }
  const reviewIdIssue = evidenceIdIssue(`${pathPrefix}.reviewId`, report.reviewId);
  if (reviewIdIssue) {
    reportIssues.push(reviewIdIssue);
  } else if (
    nonEmptyString(store.privacyDisclosureReviewId) &&
    String(report.reviewId).trim() !== String(store.privacyDisclosureReviewId).trim()
  ) {
    reportIssues.push(`${pathPrefix}.reviewId must match store.privacyDisclosureReviewId`);
  }
  if (!platformsReviewed.includes("ios")) reportIssues.push(`${pathPrefix}.platformsReviewed must include ios`);
  if (!platformsReviewed.includes("android")) reportIssues.push(`${pathPrefix}.platformsReviewed must include android`);
  for (const surface of STORE_PRIVACY_DISCLOSURE_REQUIRED_SURFACES) {
    if (!reviewedStoreSurfaces.includes(surface)) {
      reportIssues.push(`${pathPrefix}.reviewedStoreSurfaces must include ${surface}`);
    }
  }
  if (!suggestedEvidenceFields.includes("store.privacyDisclosureArtifact")) {
    reportIssues.push(`${pathPrefix}.suggestedEvidenceFields must include store.privacyDisclosureArtifact`);
  }
  for (const sourceProof of STORE_PRIVACY_DISCLOSURE_SOURCE_PROOFS) {
    const sourcePath = report[sourceProof.pathField];
    const sourceHash = report[sourceProof.hashField];
    if (sourcePath !== sourceProof.expectedPath) {
      reportIssues.push(`${pathPrefix}.${sourceProof.pathField} must be ${sourceProof.expectedPath}`);
    }
    if (!nonEmptyString(sourceHash) || !/^sha256-[0-9a-f]{64}$/i.test(String(sourceHash).trim())) {
      reportIssues.push(`${pathPrefix}.${sourceProof.hashField} must use sha256-<64-hex> format`);
    } else {
      const expectedHash = localFileSha256Label(root, sourceProof.expectedPath);
      if (expectedHash && String(sourceHash).trim().toLowerCase() !== expectedHash) {
        reportIssues.push(`${pathPrefix}.${sourceProof.hashField} must match ${sourceProof.expectedPath}`);
      }
    }
  }
  for (const signal of STORE_PRIVACY_DISCLOSURE_REQUIRED_SIGNALS) {
    if (signals[signal] !== true) reportIssues.push(`${pathPrefix}.signals.${signal}`);
    if (checks[signal] !== true) reportIssues.push(`${pathPrefix}.checks.${signal}`);
  }
  reportIssues.push(
    ...collectForbiddenEvidenceFieldIssues(
      report,
      pathPrefix,
      forbiddenFields,
      "store privacy disclosure proof must omit raw receipts, purchase tokens, customer IDs, store credentials, and ad-network secrets"
    )
  );
  reportIssues.push(
    ...collectForbiddenEvidenceTextIssues(
      report,
      pathPrefix,
      forbiddenPatterns,
      "store privacy disclosure proof must omit raw receipts, purchase tokens, customer IDs, store credentials, and ad-network secrets"
    )
  );

  return reportIssues;
}

function storePurchaseVerificationArtifactIssues(
  root: string,
  store: Record<string, unknown>,
  artifactField: "purchaseVerificationArtifact" | "restoreVerificationArtifact"
) {
  return purchaseVerificationReportArtifactIssues(root, store, store[artifactField], `store.${artifactField}`);
}

function purchaseVerificationReportArtifactIssues(
  root: string,
  store: Record<string, unknown>,
  artifactValue: unknown,
  pathPrefix: string
) {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(
    root,
    artifactValue,
    pathPrefix
  );
  if (issues.length > 0 || !report) return issues;

  if (!isRecord(report)) return [`${pathPrefix} must contain a purchase-verification-smoke-v1 JSON object`];

  const reportIssues: string[] = [];
  const summary = isRecord(report.summary) ? report.summary : {};
  const verificationBoundary = isRecord(report.verificationBoundary) ? report.verificationBoundary : {};
  const contractProof = isRecord(report.contractProof) ? report.contractProof : {};
  const rejectionProofs = isRecord(contractProof.rejectionProofs) ? contractProof.rejectionProofs : {};
  const responseBoundary = isRecord(contractProof.responseBoundary) ? contractProof.responseBoundary : {};
  const fakeKnownBoundaryByPlan = isRecord(verificationBoundary.fakeKnownTokenRejectionCheckedByPlan)
    ? verificationBoundary.fakeKnownTokenRejectionCheckedByPlan
    : {};
  const fakeKnownProofByPlan = isRecord(rejectionProofs.fakeKnownTokenRejectedByPlan)
    ? rejectionProofs.fakeKnownTokenRejectedByPlan
    : {};
  const boundaryLaunchProductIds = isRecord(verificationBoundary.launchProductIdsChecked)
    ? verificationBoundary.launchProductIdsChecked
    : {};
  const contractLaunchProductIds = isRecord(contractProof.launchProductIdsChecked)
    ? contractProof.launchProductIdsChecked
    : {};
  const configuredAndroidLaunchProductIds = configuredLaunchProductIdsByPlan("android");
  const passCount = numberField(summary, "passCount");
  const failCount = numberField(summary, "failCount");
  const requestTimeoutMs = numberField(contractProof, "requestTimeoutMs");
  const serverSecretKeyNames = Array.isArray(responseBoundary.serverSecretKeyNamesChecked)
    ? responseBoundary.serverSecretKeyNamesChecked
    : [];
  const redactedSensitiveFields = Array.isArray(responseBoundary.redactedSensitiveFields)
    ? responseBoundary.redactedSensitiveFields
    : [];

  if (report.schemaVersion !== "purchase-verification-smoke-v1") {
    reportIssues.push(`${pathPrefix}.schemaVersion must be purchase-verification-smoke-v1`);
  }
  if (report.sanitized !== true) {
    reportIssues.push(`${pathPrefix}.sanitized must be true`);
  }
  if (report.endpoint !== sanitizedEndpointUrl(store.purchaseVerifyEndpoint)) {
    reportIssues.push(`${pathPrefix}.endpoint must match the sanitized store.purchaseVerifyEndpoint`);
  }
  if (failCount !== 0) reportIssues.push(`${pathPrefix}.summary.failCount must be 0`);
  if (passCount === null || passCount < PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT) {
    reportIssues.push(`${pathPrefix}.summary.passCount >= ${PURCHASE_VERIFICATION_REQUIRED_PASS_COUNT}`);
  }
  if (requestTimeoutMs === null || requestTimeoutMs < 500 || requestTimeoutMs > 15_000) {
    reportIssues.push(`${pathPrefix}.contractProof.requestTimeoutMs must be between 500 and 15000`);
  }

  const requiredTrueChecks: Array<[string, unknown]> = [
    [`${pathPrefix}.verificationBoundary.usesSyntheticPurchasePayloads`, verificationBoundary.usesSyntheticPurchasePayloads],
    [`${pathPrefix}.verificationBoundary.unknownProductRejectionChecked`, verificationBoundary.unknownProductRejectionChecked],
    [`${pathPrefix}.verificationBoundary.fakeKnownTokenRejectionChecked`, verificationBoundary.fakeKnownTokenRejectionChecked],
    [`${pathPrefix}.verificationBoundary.malformedJsonRejectionChecked`, verificationBoundary.malformedJsonRejectionChecked],
    [`${pathPrefix}.verificationBoundary.rawTokenEchoRejected`, verificationBoundary.rawTokenEchoRejected],
    [`${pathPrefix}.contractProof.endpointValidated`, contractProof.endpointValidated],
    [`${pathPrefix}.contractProof.syntheticOnly`, contractProof.syntheticOnly],
    [`${pathPrefix}.contractProof.rejectionProofs.unknownProductRejected`, rejectionProofs.unknownProductRejected],
    [`${pathPrefix}.contractProof.rejectionProofs.fakeKnownTokenRejected`, rejectionProofs.fakeKnownTokenRejected],
    [`${pathPrefix}.contractProof.rejectionProofs.malformedJsonRejected`, rejectionProofs.malformedJsonRejected],
    [`${pathPrefix}.contractProof.responseBoundary.rawTokenEchoRejected`, responseBoundary.rawTokenEchoRejected],
    [`${pathPrefix}.contractProof.responseBoundary.rawReceiptEchoRejected`, responseBoundary.rawReceiptEchoRejected],
    [`${pathPrefix}.contractProof.responseBoundary.orderIdEchoRejected`, responseBoundary.orderIdEchoRejected],
    [`${pathPrefix}.contractProof.responseBoundary.packageNameEchoRejected`, responseBoundary.packageNameEchoRejected],
    [`${pathPrefix}.contractProof.responseBoundary.secretValuesOmitted`, responseBoundary.secretValuesOmitted]
  ];
  for (const [path, value] of requiredTrueChecks) {
    if (value !== true) reportIssues.push(path);
  }
  if (contractProof.endpointPathRequired !== "/api/purchases/verify") {
    reportIssues.push(`${pathPrefix}.contractProof.endpointPathRequired`);
  }
  for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
    if (fakeKnownBoundaryByPlan[planId] !== true) {
      reportIssues.push(`${pathPrefix}.verificationBoundary.fakeKnownTokenRejectionCheckedByPlan.${planId}`);
    }
    if (fakeKnownProofByPlan[planId] !== true) {
      reportIssues.push(`${pathPrefix}.contractProof.rejectionProofs.fakeKnownTokenRejectedByPlan.${planId}`);
    }
    if (boundaryLaunchProductIds[planId] !== configuredAndroidLaunchProductIds[planId]) {
      reportIssues.push(
        `${pathPrefix}.verificationBoundary.launchProductIdsChecked.${planId} must match configured Android Core 3 launch product id`
      );
    }
    if (contractLaunchProductIds[planId] !== configuredAndroidLaunchProductIds[planId]) {
      reportIssues.push(
        `${pathPrefix}.contractProof.launchProductIdsChecked.${planId} must match configured Android Core 3 launch product id`
      );
    }
  }
  for (const [mapPath, map] of [
    [`${pathPrefix}.verificationBoundary.launchProductIdsChecked`, boundaryLaunchProductIds],
    [`${pathPrefix}.contractProof.launchProductIdsChecked`, contractLaunchProductIds]
  ] as const) {
    for (const key of Object.keys(map)) {
      if (!LAUNCH_PREMIUM_PLAN_IDS.includes(key as (typeof LAUNCH_PREMIUM_PLAN_IDS)[number])) {
        reportIssues.push(`${mapPath}.${key} must not include post-launch product ids`);
      }
    }
  }
  for (const keyName of ["APP_STORE_PRIVATE_KEY", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]) {
    if (!serverSecretKeyNames.includes(keyName)) {
      reportIssues.push(`${pathPrefix}.contractProof.responseBoundary.serverSecretKeyNamesChecked must include ${keyName}`);
    }
  }
  for (const field of ["purchaseToken", "receipt", "orderId", "packageName"]) {
    if (!redactedSensitiveFields.includes(field)) {
      reportIssues.push(`${pathPrefix}.contractProof.responseBoundary.redactedSensitiveFields must include ${field}`);
    }
  }
  reportIssues.push(...reportResultIssues(report, pathPrefix, PURCHASE_VERIFICATION_REQUIRED_RESULT_IDS));

  return reportIssues;
}

function aiBackendSmokeIssues(payload: Record<string, unknown>, root: string): string[] {
  const ai = isRecord(payload.ai) ? payload.ai : {};
  const forbiddenSensitiveAiFields = [
    "rawPrompt",
    "rawPrompts",
    "rawUserInput",
    "rawUserMessage",
    "rawCoachRequest",
    "rawChallengeRequest",
    "rawRetentionRequest",
    "rawModelResponse",
    "rawCoachResponse",
    "rawChallengeResponse",
    "rawRetentionResponse",
    "rawRetentionPlan",
    "promptText",
    "userText",
    "privateNotes",
    "slipNote",
    "fullConversation",
    "conversationTranscript",
    "sensitiveUrl",
    "sensitiveDomain",
    "latitude",
    "longitude",
    "rawLocation",
    "preciseLocation",
    "apiKey",
    "geminiApiKey",
    "providerApiKey"
  ];
  const forbiddenSensitiveAiValuePatterns = [
    /\bhttps?:\/\/[^\s"'<>]+/i,
    /\b(?:[a-z0-9-]+\.)+(?:adult|app|com|dev|io|net|online|org|porn|site|xxx|xyz)\b/i,
    /\b(?:raw[-_\s]?prompt|raw[-_\s]?user[-_\s]?input|raw[-_\s]?model[-_\s]?response)\b/i,
    /\b(?:private[-_\s]?notes?|conversation[-_\s]?transcript|full[-_\s]?conversation)\b/i,
    /\b(?:api[_-\s]?key|provider[_-\s]?key|token|secret)=/i,
    /\bAIza[0-9A-Za-z_-]{20,}\b/i,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/i
  ];
  const configuredAi = configuredAiEvidenceConfig();
  const retentionEndpointConfigured = Boolean(configuredAi.retentionEndpoint);
  const requiredFields = [
    "coachEndpoint",
    "challengeEndpoint",
    ...(retentionEndpointConfigured ? ["retentionEndpoint"] : []),
    "model",
    "releasePreflightCommand",
    "releasePreflightRunId",
    "releasePreflightArtifact",
    "safetyEvalCommand",
    "smokeCommand",
    "safetyEvalReportId",
    "safetyEvalArtifact",
    "smokeReportId",
    "smokeReportArtifact",
    "coachSmokeRunId",
    "coachSmokeArtifact",
    "challengeSmokeRunId",
    "challengeSmokeArtifact",
    ...(retentionEndpointConfigured ? ["retentionSmokeRunId", "retentionSmokeArtifact"] : []),
    "challengePersonalizationRunId",
    "challengePersonalizationArtifact",
    "noCoordinateFieldsRunId",
    "noCoordinateFieldsArtifact",
    "noSensitiveEchoRunId",
    "noSensitiveEchoArtifact",
    "redactionReportId",
    "redactionArtifact",
    "crisisFallbackRunId",
    "crisisFallbackArtifact",
    "providerFallbackRunId",
    "providerFallbackArtifact"
  ];
  const aiArtifactFields = [
    "releasePreflightArtifact",
    "safetyEvalArtifact",
    "smokeReportArtifact",
    "coachSmokeArtifact",
    "challengeSmokeArtifact",
    ...(retentionEndpointConfigured ? ["retentionSmokeArtifact"] : []),
    "challengePersonalizationArtifact",
    "noCoordinateFieldsArtifact",
    "noSensitiveEchoArtifact",
    "redactionArtifact",
    "crisisFallbackArtifact",
    "providerFallbackArtifact"
  ];
  const safetyEvalCaseCount = numberField(ai, "safetyEvalCaseCount");
  const safetyEvalFailedCount = numberField(ai, "safetyEvalFailedCount");
  const smokeEndpointPassCount = numberField(ai, "smokeEndpointPassCount");
  const smokeEndpointFailCount = numberField(ai, "smokeEndpointFailCount");
  const challengePersonalizationProfileCount = numberField(ai, "challengePersonalizationProfileCount");
  const challengeRiskForecastProfileCount = numberField(ai, "challengeRiskForecastProfileCount");
  const challengeSessionDurationBucketProfileCount = numberField(ai, "challengeSessionDurationBucketProfileCount");
  const challengeRecentFailureProfileCount = numberField(ai, "challengeRecentFailureProfileCount");
  const freeChallengePremiumCount = numberField(ai, "freeChallengePremiumCount");
  const noSensitiveEchoSampleCount = numberField(ai, "noSensitiveEchoSampleCount");
  const issues: string[] = [];
  const checks = isRecord(payload.checks) ? payload.checks : {};
  const requiredSmokeEndpointPassCount = retentionEndpointConfigured ? 3 : 2;
  const requiredNoSensitiveEchoSampleCount = retentionEndpointConfigured ? 3 : 2;

  for (const field of requiredFields) {
    if (!nonEmptyString(ai[field])) issues.push(`ai.${field}`);
  }
  const aiEvidenceIdFields = [
    "releasePreflightRunId",
    "safetyEvalReportId",
    "smokeReportId",
    "coachSmokeRunId",
    "challengeSmokeRunId",
    ...(retentionEndpointConfigured ? ["retentionSmokeRunId"] : []),
    "challengePersonalizationRunId",
    "noCoordinateFieldsRunId",
    "noSensitiveEchoRunId",
    "redactionReportId",
    "crisisFallbackRunId",
    "providerFallbackRunId"
  ];
  for (const field of aiEvidenceIdFields) {
    if (nonEmptyString(ai[field])) {
      const issue = evidenceIdIssue(`ai.${field}`, ai[field]);
      if (issue) issues.push(issue);
    }
  }
  issues.push(
    ...duplicateEvidenceIdIssues(aiEvidenceIdFields.map((field) => ({ path: `ai.${field}`, value: ai[field] })))
  );
  for (const field of forbiddenSensitiveAiFields) {
    const value = ai[field];
    const hasSubmittedValue = value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
    if (hasSubmittedValue) {
      issues.push(`ai.${field} must be omitted from evidence; store only redacted summaries, counts, run IDs, and artifact references`);
    }
  }
  issues.push(
    ...collectForbiddenEvidenceFieldIssues(
      payload,
      "root",
      new Set(forbiddenSensitiveAiFields),
      "store only redacted summaries, counts, run IDs, and artifact references",
      new Set(forbiddenSensitiveAiFields.map((field) => `root.ai.${field}`))
    )
  );
  issues.push(
    ...collectForbiddenEvidenceTextIssues(
      payload,
      "root",
      forbiddenSensitiveAiValuePatterns,
      "store only redacted summaries, counts, run IDs, and artifact references",
      {
        skipPathPrefixes: new Set(["root.evidence"]),
        skipExactPaths: new Set([
          ...aiArtifactFields.map((field) => `root.ai.${field}`),
          "root.ai.coachEndpoint",
          "root.ai.challengeEndpoint",
          ...(retentionEndpointConfigured ? ["root.ai.retentionEndpoint"] : []),
          "root.ai.releasePreflightCommand",
          "root.ai.safetyEvalCommand",
          "root.ai.smokeCommand"
        ])
      }
    )
  );
  for (const field of aiArtifactFields) {
    if (nonEmptyString(ai[field])) {
      const artifactIssue = missingEvidenceReference(root, ai[field], `ai.${field}`);
      if (artifactIssue) issues.push(artifactIssue);
    }
  }

  if (nonEmptyString(ai.coachEndpoint)) {
    issues.push(...formatEndpointIssues(getProductionEndpointIssues(ai.coachEndpoint, "ai.coachEndpoint")));
    if (configuredAi.coachEndpoint && ai.coachEndpoint.trim() !== configuredAi.coachEndpoint) {
      issues.push("ai.coachEndpoint must match configured remote coach endpoint");
    }
  }
  if (nonEmptyString(ai.challengeEndpoint)) {
    issues.push(...formatEndpointIssues(getProductionEndpointIssues(ai.challengeEndpoint, "ai.challengeEndpoint")));
    if (configuredAi.challengeEndpoint && ai.challengeEndpoint.trim() !== configuredAi.challengeEndpoint) {
      issues.push("ai.challengeEndpoint must match configured remote challenge endpoint");
    }
  }
  if (retentionEndpointConfigured) {
    if (nonEmptyString(ai.retentionEndpoint)) {
      issues.push(...formatEndpointIssues(getProductionEndpointIssues(ai.retentionEndpoint, "ai.retentionEndpoint")));
      if (configuredAi.retentionEndpoint && ai.retentionEndpoint.trim() !== configuredAi.retentionEndpoint) {
        issues.push("ai.retentionEndpoint must match configured remote retention endpoint");
      }
    }
    if (checks.retentionAggregateOnlyVerified !== true) {
      issues.push("checks.retentionAggregateOnlyVerified");
    }
  }
  if (nonEmptyString(ai.model)) {
    if (!validRemoteAiModelId(ai.model)) {
      issues.push("ai.model must be a concrete remote provider model id");
    }
    if (configuredAi.model && ai.model.trim() !== configuredAi.model) {
      issues.push("ai.model must match configured OPENAI_MODEL or GEMINI_MODEL");
    }
  }
  if (nonEmptyString(ai.releasePreflightCommand) && !matchesReleaseCommand(ai.releasePreflightCommand, "preflight:release-env")) {
    issues.push("ai.releasePreflightCommand must be npm run preflight:release-env, optionally with -- --env-file <path>");
  }
  if (nonEmptyString(ai.safetyEvalCommand) && !matchesReleaseCommand(ai.safetyEvalCommand, "eval:ai-safety")) {
    issues.push("ai.safetyEvalCommand must be npm run eval:ai-safety, optionally with -- --env-file <path>");
  }
  if (nonEmptyString(ai.smokeCommand) && !matchesReleaseCommand(ai.smokeCommand, "smoke:ai-backend")) {
    issues.push("ai.smokeCommand must be npm run smoke:ai-backend, optionally with -- --env-file <path>");
  }
  if (safetyEvalCaseCount === null) {
    issues.push("ai.safetyEvalCaseCount");
  } else if (safetyEvalCaseCount < 10) {
    issues.push("ai.safetyEvalCaseCount >= 10");
  }
  if (safetyEvalFailedCount === null) {
    issues.push("ai.safetyEvalFailedCount");
  } else if (safetyEvalFailedCount !== 0) {
    issues.push("ai.safetyEvalFailedCount must be 0");
  }
  if (smokeEndpointPassCount === null) {
    issues.push("ai.smokeEndpointPassCount");
  } else if (smokeEndpointPassCount < requiredSmokeEndpointPassCount) {
    issues.push(`ai.smokeEndpointPassCount >= ${requiredSmokeEndpointPassCount}`);
  }
  if (smokeEndpointFailCount === null) {
    issues.push("ai.smokeEndpointFailCount");
  } else if (smokeEndpointFailCount !== 0) {
    issues.push("ai.smokeEndpointFailCount must be 0");
  }
  if (challengePersonalizationProfileCount === null) {
    issues.push("ai.challengePersonalizationProfileCount");
  } else if (challengePersonalizationProfileCount < 2) {
    issues.push("ai.challengePersonalizationProfileCount >= 2");
  }
  if (challengeRiskForecastProfileCount === null) {
    issues.push("ai.challengeRiskForecastProfileCount");
  } else if (challengeRiskForecastProfileCount < 2) {
    issues.push("ai.challengeRiskForecastProfileCount >= 2");
  }
  if (challengeSessionDurationBucketProfileCount === null) {
    issues.push("ai.challengeSessionDurationBucketProfileCount");
  } else if (challengeSessionDurationBucketProfileCount < 1) {
    issues.push("ai.challengeSessionDurationBucketProfileCount >= 1");
  }
  if (challengeRecentFailureProfileCount === null) {
    issues.push("ai.challengeRecentFailureProfileCount");
  } else if (challengeRecentFailureProfileCount < 1) {
    issues.push("ai.challengeRecentFailureProfileCount >= 1");
  }
  if (freeChallengePremiumCount === null) {
    issues.push("ai.freeChallengePremiumCount");
  } else if (freeChallengePremiumCount !== 0) {
    issues.push("ai.freeChallengePremiumCount must be 0");
  }
  if (noSensitiveEchoSampleCount === null) {
    issues.push("ai.noSensitiveEchoSampleCount");
  } else if (noSensitiveEchoSampleCount < requiredNoSensitiveEchoSampleCount) {
    issues.push(`ai.noSensitiveEchoSampleCount >= ${requiredNoSensitiveEchoSampleCount}`);
  }
  issues.push(
    ...aiBackendSmokeReportArtifactIssues(
      root,
      ai,
      retentionEndpointConfigured,
      requiredSmokeEndpointPassCount
    )
  );

  return issues;
}

function aiBackendSmokeReportArtifactIssues(
  root: string,
  ai: Record<string, unknown>,
  retentionEndpointConfigured: boolean,
  requiredSmokeEndpointPassCount: number
) {
  const { payload: report, issues } = readLocalJsonEvidenceArtifact(root, ai.smokeReportArtifact, "ai.smokeReportArtifact");
  if (issues.length > 0 || !report) return issues;

  if (!isRecord(report)) return ["ai.smokeReportArtifact must contain an ai-backend-smoke-v1 JSON object"];

  const reportIssues: string[] = [];
  const summary = isRecord(report.summary) ? report.summary : {};
  const endpoints = isRecord(report.endpoints) ? report.endpoints : {};
  const aiBoundary = isRecord(report.aiBoundary) ? report.aiBoundary : {};
  const contractProof = isRecord(report.contractProof) ? report.contractProof : {};
  const endpointPathRequirements = isRecord(contractProof.endpointPathRequirements) ? contractProof.endpointPathRequirements : {};
  const requestTimeoutMs = isRecord(contractProof.requestTimeoutMs) ? contractProof.requestTimeoutMs : {};
  const configuredModelProof = isRecord(contractProof.configuredModelProof) ? contractProof.configuredModelProof : {};
  const endpointProofs = isRecord(contractProof.endpointProofs) ? contractProof.endpointProofs : {};
  const personalizationProofs = isRecord(contractProof.personalizationProofs) ? contractProof.personalizationProofs : {};
  const privacyProofs = isRecord(contractProof.privacyProofs) ? contractProof.privacyProofs : {};
  const responseBoundary = isRecord(contractProof.responseBoundary) ? contractProof.responseBoundary : {};
  const passCount = numberField(summary, "passCount");
  const failCount = numberField(summary, "failCount");
  const coachTimeout = numberField(requestTimeoutMs, "coach");
  const challengeTimeout = numberField(requestTimeoutMs, "challenge");
  const retentionTimeout = numberField(requestTimeoutMs, "retention");
  const serverSecretKeyNames = Array.isArray(responseBoundary.serverSecretKeyNamesChecked)
    ? responseBoundary.serverSecretKeyNamesChecked
    : [];
  const redactedSensitiveFields = Array.isArray(responseBoundary.redactedSensitiveFields)
    ? responseBoundary.redactedSensitiveFields
    : [];

  if (report.schemaVersion !== "ai-backend-smoke-v1") reportIssues.push("ai.smokeReportArtifact.schemaVersion must be ai-backend-smoke-v1");
  if (report.sanitized !== true) reportIssues.push("ai.smokeReportArtifact.sanitized must be true");
  if (failCount !== 0) reportIssues.push("ai.smokeReportArtifact.summary.failCount must be 0");
  if (passCount === null || passCount < requiredSmokeEndpointPassCount + 2) {
    reportIssues.push(`ai.smokeReportArtifact.summary.passCount >= ${requiredSmokeEndpointPassCount + 2}`);
  }
  if (endpoints.coach !== sanitizedEndpointUrl(ai.coachEndpoint)) {
    reportIssues.push("ai.smokeReportArtifact.endpoints.coach must match the sanitized ai.coachEndpoint");
  }
  if (endpoints.challenge !== sanitizedEndpointUrl(ai.challengeEndpoint)) {
    reportIssues.push("ai.smokeReportArtifact.endpoints.challenge must match the sanitized ai.challengeEndpoint");
  }
  if (retentionEndpointConfigured) {
    if (endpoints.retention !== sanitizedEndpointUrl(ai.retentionEndpoint)) {
      reportIssues.push("ai.smokeReportArtifact.endpoints.retention must match the sanitized ai.retentionEndpoint");
    }
  }
  if (endpointPathRequirements.coach !== "/api/clara") reportIssues.push("ai.smokeReportArtifact.contractProof.endpointPathRequirements.coach");
  if (endpointPathRequirements.challenge !== "/api/challenges") {
    reportIssues.push("ai.smokeReportArtifact.contractProof.endpointPathRequirements.challenge");
  }
  if (endpointPathRequirements.retention !== "/api/retention") {
    reportIssues.push("ai.smokeReportArtifact.contractProof.endpointPathRequirements.retention");
  }
  for (const [label, value] of [
    ["coach", coachTimeout],
    ["challenge", challengeTimeout],
    ["retention", retentionTimeout]
  ] as const) {
    if (value === null || value < 1_000 || value > 12_000) {
      reportIssues.push(`ai.smokeReportArtifact.contractProof.requestTimeoutMs.${label} must be between 1000 and 12000`);
    }
  }

  const requiredTrueChecks: Array<[string, unknown]> = [
    ["ai.smokeReportArtifact.aiBoundary.configuredModelChecked", aiBoundary.configuredModelChecked],
    ["ai.smokeReportArtifact.aiBoundary.claraEndpointChecked", aiBoundary.claraEndpointChecked],
    ["ai.smokeReportArtifact.aiBoundary.challengeEndpointChecked", aiBoundary.challengeEndpointChecked],
    ["ai.smokeReportArtifact.aiBoundary.challengePersonalizationProfilesChecked", aiBoundary.challengePersonalizationProfilesChecked],
    ["ai.smokeReportArtifact.aiBoundary.challengeSessionDurationBucketChecked", aiBoundary.challengeSessionDurationBucketChecked],
    ["ai.smokeReportArtifact.aiBoundary.challengeRecentFailureCountChecked", aiBoundary.challengeRecentFailureCountChecked],
    ["ai.smokeReportArtifact.aiBoundary.noSensitiveEchoChecked", aiBoundary.noSensitiveEchoChecked],
    ["ai.smokeReportArtifact.aiBoundary.noCoordinateFieldsChecked", aiBoundary.noCoordinateFieldsChecked],
    ["ai.smokeReportArtifact.contractProof.configuredModelProof.configuredModelChecked", configuredModelProof.configuredModelChecked],
    ["ai.smokeReportArtifact.contractProof.configuredModelProof.concreteProviderModelRequired", configuredModelProof.concreteProviderModelRequired],
    ["ai.smokeReportArtifact.contractProof.configuredModelProof.placeholderModelRejected", configuredModelProof.placeholderModelRejected],
    ["ai.smokeReportArtifact.contractProof.endpointProofs.claraEndpointChecked", endpointProofs.claraEndpointChecked],
    ["ai.smokeReportArtifact.contractProof.endpointProofs.challengeEndpointChecked", endpointProofs.challengeEndpointChecked],
    ["ai.smokeReportArtifact.contractProof.endpointProofs.productionHttpsOnly", endpointProofs.productionHttpsOnly],
    ["ai.smokeReportArtifact.contractProof.endpointProofs.endpointQueryStringsOmitted", endpointProofs.endpointQueryStringsOmitted],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.challengePersonalizationProfilesChecked", personalizationProofs.challengePersonalizationProfilesChecked],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.contextSignalsChecked", personalizationProofs.contextSignalsChecked],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.aggregateRiskForecastChecked", personalizationProofs.aggregateRiskForecastChecked],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.sessionDurationBucketChecked", personalizationProofs.sessionDurationBucketChecked],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.recentFailureCountChecked", personalizationProofs.recentFailureCountChecked],
    ["ai.smokeReportArtifact.contractProof.personalizationProofs.noRawRiskDriversStored", personalizationProofs.noRawRiskDriversStored],
    ["ai.smokeReportArtifact.contractProof.privacyProofs.noSensitiveEchoChecked", privacyProofs.noSensitiveEchoChecked],
    ["ai.smokeReportArtifact.contractProof.privacyProofs.noCoordinateFieldsChecked", privacyProofs.noCoordinateFieldsChecked],
    ["ai.smokeReportArtifact.contractProof.privacyProofs.rawPromptsOmitted", privacyProofs.rawPromptsOmitted],
    ["ai.smokeReportArtifact.contractProof.privacyProofs.unredactedModelResponsesOmitted", privacyProofs.unredactedModelResponsesOmitted],
    ["ai.smokeReportArtifact.contractProof.responseBoundary.secretValuesOmitted", responseBoundary.secretValuesOmitted]
  ];
  for (const [path, value] of requiredTrueChecks) {
    if (value !== true) reportIssues.push(path);
  }
  if (retentionEndpointConfigured) {
    const retentionChecks: Array<[string, unknown]> = [
      ["ai.smokeReportArtifact.aiBoundary.retentionEndpointConfigured", aiBoundary.retentionEndpointConfigured],
      ["ai.smokeReportArtifact.aiBoundary.retentionEndpointChecked", aiBoundary.retentionEndpointChecked],
      ["ai.smokeReportArtifact.aiBoundary.retentionAggregateOnlyChecked", aiBoundary.retentionAggregateOnlyChecked],
      ["ai.smokeReportArtifact.contractProof.endpointProofs.retentionEndpointConfigured", endpointProofs.retentionEndpointConfigured],
      ["ai.smokeReportArtifact.contractProof.endpointProofs.retentionEndpointChecked", endpointProofs.retentionEndpointChecked],
      ["ai.smokeReportArtifact.contractProof.privacyProofs.retentionAggregateOnlyChecked", privacyProofs.retentionAggregateOnlyChecked]
    ];
    for (const [path, value] of retentionChecks) {
      if (value !== true) reportIssues.push(path);
    }
  }
  for (const keyName of ["OPENAI_API_KEY", "GEMINI_API_KEY"]) {
    if (!serverSecretKeyNames.includes(keyName)) {
      reportIssues.push(`ai.smokeReportArtifact.contractProof.responseBoundary.serverSecretKeyNamesChecked must include ${keyName}`);
    }
  }
  for (const field of ["rawModelText", "providerApiKeys", "coordinateFields", "privateNotes"]) {
    if (!redactedSensitiveFields.includes(field)) {
      reportIssues.push(`ai.smokeReportArtifact.contractProof.responseBoundary.redactedSensitiveFields must include ${field}`);
    }
  }
  reportIssues.push(
    ...reportResultIssues(
      report,
      "ai.smokeReportArtifact",
      [
        ...AI_BACKEND_REQUIRED_RESULT_IDS,
        ...(retentionEndpointConfigured ? ["retention-remote-endpoint"] : [])
      ]
    )
  );

  return reportIssues;
}

function matchesReleaseCommand(value: unknown, scriptName: string) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().replace(/\s+/g, " ");
  const baseCommand = `npm run ${scriptName}`;
  if (normalized === baseCommand) return true;

  const escapedScript = scriptName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(new RegExp(`^npm run ${escapedScript} -- --env-file(?:=(\\S+)| (\\S+))$`));
  const envFilePath = match?.[1] ?? match?.[2] ?? "";
  return isEvidenceEnvFilePath(envFilePath);
}

function isEvidenceEnvFilePath(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const basicSafe =
    /^[A-Za-z0-9._~/-]+$/.test(trimmed) &&
    !normalized.startsWith("-") &&
    !normalized.includes("://") &&
    !normalized.includes(".env.production.example") &&
    !normalized.includes(".env.example") &&
    !normalized.includes("production-env-file");
  if (!basicSafe) return false;

  const absoluteEnvFile = isAbsolute(trimmed) ? resolve(trimmed) : resolve(process.cwd(), trimmed);
  for (const relativeDir of ["docs/validation/evidence", "docs/validation/artifacts"]) {
    const forbiddenDir = resolve(process.cwd(), relativeDir);
    if (isPathInsideOrSame(forbiddenDir, absoluteEnvFile)) {
      return false;
    }
  }

  return true;
}

function isPathInsideOrSame(parent: string, child: string) {
  const exactRelative = relative(parent, child);
  if (exactRelative === "" || (!exactRelative.startsWith("..") && !isAbsolute(exactRelative))) return true;

  const foldedRelative = relative(parent.toLowerCase(), child.toLowerCase());
  return foldedRelative === "" || (!foldedRelative.startsWith("..") && !isAbsolute(foldedRelative));
}

function normalizedEvidenceDirOption(value: string, root = process.cwd()) {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const unsafeMessage =
    "evidence directory must be a local workspace path without shell syntax, URLs, flags, or template placeholders";

  if (
    !trimmed ||
    !/^[A-Za-z0-9._~/-]+$/.test(trimmed) ||
    normalized.startsWith("-") ||
    normalized.includes("://") ||
    normalized.includes(".env.production.example") ||
    normalized.includes(".env.example") ||
    normalized.includes("production-env-file") ||
    normalized.includes("path/to/") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme")
  ) {
    throw new Error(unsafeMessage);
  }

  const absoluteRoot = resolve(root);
  const absoluteEvidenceDir = isAbsolute(trimmed) ? resolve(trimmed) : resolve(absoluteRoot, trimmed);
  const relativePath = relative(absoluteRoot, absoluteEvidenceDir);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("evidence directory must be inside the current workspace");
  }

  const releaseEvidenceDir = resolve(absoluteRoot, "docs/validation/evidence");
  const releaseRelativePath = relative(releaseEvidenceDir, absoluteEvidenceDir);
  const pointsAtReleaseEvidence =
    releaseRelativePath === "" || (!releaseRelativePath.startsWith("..") && !isAbsolute(releaseRelativePath));
  if (pointsAtReleaseEvidence) {
    throw new Error(
      "draft evidence directory must be outside docs/validation/evidence. Omit --evidence-dir to validate release-gated evidence."
    );
  }

  return relativePath;
}

function evidencePathForSpec(root: string, spec: EvidenceSpec, options: ValidationEvidenceOptions) {
  return options.evidenceDir ? join(root, options.evidenceDir, basename(spec.file)) : join(root, spec.file);
}

function evidenceDisplayPath(spec: EvidenceSpec, options: ValidationEvidenceOptions) {
  return options.evidenceDir ? join(options.evidenceDir, basename(spec.file)) : spec.file;
}

function validateEvidence(root: string, spec: EvidenceSpec, options: ValidationEvidenceOptions = {}): ValidationEvidenceResult {
  const displayPath = evidenceDisplayPath(spec, options);
  const absolutePath = evidencePathForSpec(root, spec, options);
  if (!existsSync(absolutePath)) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `Missing ${spec.subjectLabel} evidence file: ${displayPath}.`,
      next: spec.next
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `${displayPath} is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}.`,
      next: spec.next
    };
  }

  if (!isRecord(payload)) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `${displayPath} must contain a JSON object.`,
      next: spec.next
    };
  }

  const missing: string[] = [];
  missing.push(...collectPlaceholderIssues(payload, "root"));
  missing.push(...collectLocalHomePathIssues(payload, "root"));
  if (!validIsoDate(payload.validatedAt)) missing.push("validatedAt");
  if (!nonEmptyString(payload.tester)) missing.push("tester");
  if (!nonEmptyString(payload.build)) missing.push("build");
  if (!nonEmptyString(payload.device) && !nonEmptyString(payload.environment)) missing.push("device or environment");
  if (!nonEmptyStringArray(payload.evidence)) missing.push("evidence[]");
  else missing.push(...missingEvidenceReferences(root, payload.evidence));

  const checks = isRecord(payload.checks) ? payload.checks : {};
  for (const check of spec.requiredChecks) {
    if (checks[check] !== true) missing.push(`checks.${check}`);
  }

  const profile = isRecord(payload.profile) ? payload.profile : {};
  for (const field of spec.requiredProfileNumbers ?? []) {
    if (typeof profile[field] !== "number" || !Number.isFinite(profile[field])) missing.push(`profile.${field}`);
  }
  if (spec.id === "ios-physical-device-validation") missing.push(...iosPhysicalDeviceIssues(payload, root));
  if (spec.id === "android-real-browser-validation") missing.push(...androidRealBrowserIssues(payload, root));
  if (spec.id === "normal-browsing-corpus-validation") missing.push(...normalBrowsingCorpusIssues(payload, root));
  if (spec.id === "performance-validation") {
    missing.push(...performanceThresholdIssues(profile));
    missing.push(...performancePlatformProfilesIssues(profile, root));
  }
  if (spec.id === "store-ad-sandbox-validation") missing.push(...storeAdSandboxIssues(payload, root));
  if (spec.id === "ai-backend-smoke-validation") missing.push(...aiBackendSmokeIssues(payload, root));

  if (missing.length > 0) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `${displayPath} is incomplete. Missing or false: ${missing.join(", ")}.`,
      next: spec.next
    };
  }

  return {
    id: spec.id,
    status: "pass",
    evidence: `${displayPath} validates ${spec.requiredChecks.length} ${spec.subjectLabel} checks.`
  };
}

export function getValidationEvidenceResults(root = process.cwd(), options: ValidationEvidenceOptions = {}): ValidationEvidenceResult[] {
  return validationEvidenceSpecs.map((spec) => validateEvidence(root, spec, options));
}

function printResults(results: ValidationEvidenceResult[]) {
  const failed = results.filter((entry) => entry.status === "fail");
  console.log("# FREED validation evidence");
  console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log("");
  console.log("| Status | Gate | Evidence | Next |");
  console.log("| --- | --- | --- | --- |");
  for (const result of results) {
    console.log(
      `| ${result.status.toUpperCase()} | ${result.id} | ${result.evidence.replace(/\|/g, "/")} | ${(result.next ?? "").replace(/\|/g, "/")} |`
    );
  }

  if (failed.length > 0) process.exitCode = 1;
}

function printRequirements() {
  const requirements = validationEvidenceSpecs.map((spec) => ({
    id: spec.id,
    file: spec.file,
    subjectLabel: spec.subjectLabel,
    requiredChecks: spec.requiredChecks,
    requiredProfileNumbers: spec.requiredProfileNumbers ?? [],
    next: spec.next
  }));

  console.log(JSON.stringify({ requirements }, null, 2));
}

function parseCliOptions(argv = process.argv.slice(2)): ValidationEvidenceOptions & { requirements: boolean } {
  const options: ValidationEvidenceOptions & { requirements: boolean } = {
    evidenceDir: null,
    requirements: false
  };

  const nextValue = (name: string, index: number) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--requirements") {
      options.requirements = true;
    } else if (arg === "--evidence-dir" || arg === "--draft-evidence-dir") {
      options.evidenceDir = normalizedEvidenceDirOption(nextValue(arg, index));
      index += 1;
    } else if (arg.startsWith("--evidence-dir=")) {
      const value = arg.slice("--evidence-dir=".length);
      if (!value) throw new Error("Missing value for --evidence-dir.");
      options.evidenceDir = normalizedEvidenceDirOption(value);
    } else if (arg.startsWith("--draft-evidence-dir=")) {
      const value = arg.slice("--draft-evidence-dir=".length);
      if (!value) throw new Error("Missing value for --draft-evidence-dir.");
      options.evidenceDir = normalizedEvidenceDirOption(value);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

if (process.argv[1]?.endsWith("validation-evidence.ts")) {
  try {
    const options = parseCliOptions();
    if (options.requirements) printRequirements();
    else printResults(getValidationEvidenceResults(process.cwd(), options));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Failed to parse validation evidence options.");
    process.exitCode = 1;
  }
}
