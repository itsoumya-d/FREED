#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHttpsEndpoint } = require("./lib/evidence-target-safety");
const { envFilePathIssue, isSafeEnvFilePath } = require("./lib/env-file-safety");
const { loadEnvFile } = require("./lib/env-file-loader");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const { buildReport: buildPaywallLaunchSourceAuditReport } = require("./paywall-launch-scope-audit");

const PURCHASE_VERIFY_ENDPOINT_PATH = "/api/purchases/verify";
const GOOGLE_SAMPLE_ADMOB_PUBLISHER = "ca-app-pub-3940256099942544";
const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "monthly", "lifetime"];
const LAUNCH_PREMIUM_PLAN_LABEL = LAUNCH_PREMIUM_PLAN_IDS.join("/");
const DEFAULT_LAUNCH_PRODUCT_IDS = {
  yearly: "freed_premium_yearly",
  monthly: "freed_premium_monthly",
  lifetime: "freed_premium_lifetime"
};
const POST_LAUNCH_PREMIUM_PLAN_IDS = ["family", "accountability", "ai-coach"];
const DEFAULT_POST_LAUNCH_PRODUCT_IDS = {
  family: "freed_family_yearly",
  accountability: "freed_accountability_monthly",
  "ai-coach": "freed_ai_coach_monthly"
};
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
  "noFamilyAccountabilityAiUpsellsVisible",
];
const STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION = "freed-store-console-product-setup-report-v1";
const STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION = "freed-store-console-browser-readiness-v1";
const STORE_APP_RECORD_ACTION_PACKET_SCHEMA_VERSION = "freed-store-app-record-action-packet-v1";
const ADMOB_ACTION_PACKET_SCHEMA_VERSION = "freed-admob-action-packet-v1";
const ADMOB_ACTION_CONFIRMATION_TOKEN = "confirm-admob-app-and-rewarded-unit-creation-only";
const ADMOB_ENV_PATCH_TEMPLATE_NAME = "ADMOB_ENV_PATCH.template.env";
const DEFAULT_ADMOB_CONSOLE_READINESS_REPORT =
  "docs/validation/artifacts/admob-console-current/admob-console-readiness.json";
const DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT =
  "docs/validation/artifacts/store-console-browser-current/store-console-browser-readiness.json";
const DEFAULT_STORE_LEGAL_HOSTED_REPORT =
  "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
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
  "draftOrSandboxOnlyUntilEvidencePasses",
];
const STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS = {
  appStoreConnect: [
    "app-record",
    "subscription-group",
    "yearly-subscription",
    "monthly-subscription",
    "lifetime-non-consumable",
    "future-skus-inactive",
  ],
  googlePlay: [
    "app-record",
    "subscriptions-list",
    "yearly-base-plan",
    "monthly-base-plan",
    "lifetime-one-time-product",
    "future-skus-inactive",
  ],
};
const STORE_CONSOLE_PRODUCT_SETUP_SOURCE_PROOFS = [
  {
    pathField: "storeProductsCatalogPath",
    hashField: "storeProductsCatalogHash",
    expectedPath: "store/store-products.json",
  },
  {
    pathField: "appStoreConnectCsvPath",
    hashField: "appStoreConnectCsvHash",
    expectedPath: "store/app-store/in-app-purchases.csv",
  },
  {
    pathField: "googlePlayProductsCsvPath",
    hashField: "googlePlayProductsCsvHash",
    expectedPath: "store/play-store/products.csv",
  },
  {
    pathField: "screenshotManifestPath",
    hashField: "screenshotManifestHash",
    expectedPath: "store/screenshots/manifest.json",
  },
];
const STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION = "freed-store-privacy-disclosure-report-v1";
const STORE_PRIVACY_DISCLOSURE_REQUIRED_SURFACES = [
  "app-store-connect-app-privacy",
  "play-console-data-safety",
  "app-review-notes",
  "play-policy-declarations",
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
  "noChallengeMediaUploaded",
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
  "noRawDeviceIdentifiersStored",
];
const STORE_INTERVENTION_FLOW_SCHEMA_VERSION = "freed-store-intervention-flow-report-v1";
const STORE_INTERVENTION_FLOW_CONFIGS = [
  {
    artifactField: "store.freeRewardedInterventionArtifact",
    flowType: "free-rewarded-intervention",
    runId: (prefix) => `${prefix}-free-rewarded-intervention`,
    latencyField: "freePostAdChallengeLatencyMs",
    maxLatencyMs: 5000,
    checks: [
      "streakRiskContextShown",
      "freePlanStateShown",
      "rewardedAdBeforeChallenge",
      "challengeGenerated",
      "latencyWithinLimit",
      "supportiveCopyShown",
      "noPunitiveLanguage",
      "noPremiumEntitlementBypass",
      "noRawAdPayloadStored",
    ],
  },
  {
    artifactField: "store.rewardedAdCompletionArtifact",
    flowType: "rewarded-ad-completion",
    runId: (prefix) => `${prefix}-rewarded-ad-completion`,
    checks: [
      "rewardedAdCompleted",
      "challengeAccessGranted",
      "temporaryChallengeAccessOnly",
      "supportiveCopyShown",
      "noPurchaseGranted",
      "noRawAdPayloadStored",
    ],
  },
  {
    artifactField: "store.adFailureFallbackArtifact",
    flowType: "ad-failure-fallback",
    runId: (prefix) => `${prefix}-ad-failure-fallback`,
    checks: [
      "adFailureObserved",
      "challengeUnlockedWithoutPunishment",
      "noRetryLoopRequired",
      "supportiveCopyShown",
      "noPremiumGranted",
      "noRawAdErrorStored",
    ],
  },
  {
    artifactField: "store.premiumNoAdInterventionArtifact",
    flowType: "premium-no-ad-intervention",
    runId: (prefix) => `${prefix}-premium-no-ad-intervention`,
    latencyField: "premiumNoAdLatencyMs",
    maxLatencyMs: 3000,
    checks: [
      "premiumEntitlementVerified",
      "noRewardedAdRequested",
      "challengeGenerated",
      "latencyWithinLimit",
      "supportiveCopyShown",
      "noAdSdkRequest",
      "noPremiumUpsellShown",
      "noRawEntitlementTokenStored",
    ],
  },
];
const FORBIDDEN_SENSITIVE_FIELDS = [
  "iosReceipt",
  "appStoreReceipt",
  "appleReceipt",
  "rawReceipt",
  "receiptData",
  "purchaseReceipt",
  "rawPurchaseReceipt",
  "customerId",
  "customerIdentifier",
  "appUserId",
  "adNetworkSecret",
  "adMobAppSecret",
  "appStorePrivateKey",
  "appStoreServerApiJwt",
  "googlePlayServiceAccountJson",
  "googlePlayAccessToken",
  "androidPurchaseToken",
];
const ISO_3166_ALPHA2_COUNTRY_CODES = new Set(
  [
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ",
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR",
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP",
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ",
    "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW",
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ",
    "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW",
  ].join(" ").split(" ")
);

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultLaunchProductIds = launchProductIdsFromEnv(process.env);
  let outputDirProvided = Boolean(process.env.FREED_STORE_AD_OUTPUT);
  const explicit = new Set();
  const options = {
    adRequestCountryCode: process.env.EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY || "",
    adMobAppIdAndroid: process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID || process.env.EXPO_PUBLIC_ADMOB_APP_ID || "",
    adMobAppIdIos: process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS || process.env.EXPO_PUBLIC_ADMOB_APP_ID || "",
    adMobUseTestAds: process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS || "false",
    androidLaunchProductIds: defaultLaunchProductIds,
    androidPostLaunchProductIds: postLaunchProductIdsFromEnv(process.env),
    androidProductId: process.env.FREED_ANDROID_PRODUCT_ID || defaultLaunchProductIds.yearly || "",
    entitlementId:
      process.env.EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID || process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "",
    envFile: process.env.FREED_RELEASE_ENV_FILE || "",
    iosLaunchProductIds: defaultLaunchProductIds,
    iosPostLaunchProductIds: postLaunchProductIdsFromEnv(process.env),
    iosProductId: process.env.FREED_IOS_PRODUCT_ID || defaultLaunchProductIds.yearly || "",
    outputDir: process.env.FREED_STORE_AD_OUTPUT || "",
    planOnly: false,
    purchaseVerifyEndpoint: process.env.EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT || "",
    rewardedAdUnitId:
      process.env.FREED_REWARDED_AD_UNIT_ID ||
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS ||
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID ||
      "",
    rewardedAdUnitIdAndroid:
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID || process.env.FREED_REWARDED_AD_UNIT_ID || "",
    rewardedAdUnitIdIos:
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS || process.env.FREED_REWARDED_AD_UNIT_ID || "",
    runId,
    selfTest: false,
    storeProvider: process.env.EXPO_PUBLIC_STORE_PROVIDER || "native-iap",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--ad-request-country-code") {
      options.adRequestCountryCode = next();
      explicit.add("adRequestCountryCode");
    } else if (arg === "--admob-app-id-android") {
      options.adMobAppIdAndroid = next();
      explicit.add("adMobAppIdAndroid");
    } else if (arg === "--admob-app-id-ios") {
      options.adMobAppIdIos = next();
      explicit.add("adMobAppIdIos");
    } else if (arg === "--android-product-id") {
      options.androidProductId = next();
      explicit.add("androidProductId");
    } else if (arg === "--entitlement-id") {
      options.entitlementId = next();
      explicit.add("entitlementId");
    } else if (arg === "--release-env-file") {
      options.envFile = next();
      explicit.add("envFile");
    } else if (arg === "--ios-product-id") {
      options.iosProductId = next();
      explicit.add("iosProductId");
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--purchase-verify-endpoint") {
      options.purchaseVerifyEndpoint = next();
      explicit.add("purchaseVerifyEndpoint");
    } else if (arg === "--rewarded-ad-unit-id") {
      options.rewardedAdUnitId = next();
      explicit.add("rewardedAdUnitId");
    } else if (arg === "--rewarded-ad-unit-id-android") {
      options.rewardedAdUnitIdAndroid = next();
      explicit.add("rewardedAdUnitIdAndroid");
    } else if (arg === "--rewarded-ad-unit-id-ios") {
      options.rewardedAdUnitIdIos = next();
      explicit.add("rewardedAdUnitIdIos");
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--store-provider") {
      options.storeProvider = next();
      explicit.add("storeProvider");
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "store-ad-sandbox-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) return options;
  const envFileIssue = options.envFile ? envFilePathIssue(options.envFile, "--release-env-file") : null;
  if (envFileIssue) {
    throw new Error(envFileIssue);
  }
  const releaseEnv = loadEnvFile(options.envFile, "--release-env-file");
  applyReleaseEnv(options, releaseEnv, explicit);
  options.releaseEnvFileLoaded = Boolean(options.envFile);
  if (!["native-iap", "revenuecat"].includes(options.storeProvider.trim().toLowerCase())) {
    throw new Error("--store-provider must be native-iap or revenuecat.");
  }
  const countryCode = options.adRequestCountryCode.trim().toUpperCase();
  if (countryCode && !ISO_3166_ALPHA2_COUNTRY_CODES.has(countryCode)) {
    throw new Error("--ad-request-country-code must be a recognized ISO 3166-1 alpha-2 code.");
  }
  if (options.purchaseVerifyEndpoint.trim()) {
    options.purchaseVerifyEndpoint = validateEndpointUrl(
      "--purchase-verify-endpoint",
      options.purchaseVerifyEndpoint,
    );
  }
  if (options.adMobAppIdAndroid.trim()) {
    options.adMobAppIdAndroid = validateAdMobAppId("--admob-app-id-android", options.adMobAppIdAndroid);
  }
  if (options.adMobAppIdIos.trim()) {
    options.adMobAppIdIos = validateAdMobAppId("--admob-app-id-ios", options.adMobAppIdIos);
  }
  if (options.rewardedAdUnitId.trim()) {
    options.rewardedAdUnitId = validateRewardedAdUnitId("--rewarded-ad-unit-id", options.rewardedAdUnitId);
  }
  if (options.rewardedAdUnitIdAndroid.trim()) {
    options.rewardedAdUnitIdAndroid = validateRewardedAdUnitId("--rewarded-ad-unit-id-android", options.rewardedAdUnitIdAndroid);
  }
  if (options.rewardedAdUnitIdIos.trim()) {
    options.rewardedAdUnitIdIos = validateRewardedAdUnitId("--rewarded-ad-unit-id-ios", options.rewardedAdUnitIdIos);
  }
  return options;
}

function firstEnv(env, keys) {
  for (const key of keys) {
    if (env[key] && String(env[key]).trim()) return String(env[key]);
  }
  return "";
}

function launchProductIdsFromEnv(env) {
  return {
    yearly: firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_YEARLY", "IAP_PRODUCT_YEARLY"]) || DEFAULT_LAUNCH_PRODUCT_IDS.yearly,
    monthly: firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_MONTHLY", "IAP_PRODUCT_MONTHLY"]) || DEFAULT_LAUNCH_PRODUCT_IDS.monthly,
    lifetime: firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_LIFETIME", "IAP_PRODUCT_LIFETIME"]) || DEFAULT_LAUNCH_PRODUCT_IDS.lifetime,
  };
}

function postLaunchProductIdsFromEnv(env) {
  return {
    family: firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_FAMILY", "IAP_PRODUCT_FAMILY"]) || DEFAULT_POST_LAUNCH_PRODUCT_IDS.family,
    accountability:
      firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_ACCOUNTABILITY", "IAP_PRODUCT_ACCOUNTABILITY"]) ||
      DEFAULT_POST_LAUNCH_PRODUCT_IDS.accountability,
    "ai-coach": firstEnv(env, ["EXPO_PUBLIC_IAP_PRODUCT_AI_COACH", "IAP_PRODUCT_AI_COACH"]) || DEFAULT_POST_LAUNCH_PRODUCT_IDS["ai-coach"],
  };
}

function applyIfNotExplicit(options, explicit, field, value) {
  if (explicit.has(field) || !value.trim()) return;
  options[field] = value;
}

function applyReleaseEnv(options, env, explicit) {
  const launchProductIds = launchProductIdsFromEnv(env);
  const postLaunchProductIds = postLaunchProductIdsFromEnv(env);
  applyIfNotExplicit(options, explicit, "adRequestCountryCode", firstEnv(env, ["EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY"]));
  applyIfNotExplicit(options, explicit, "adMobAppIdAndroid", firstEnv(env, ["EXPO_PUBLIC_ADMOB_APP_ID_ANDROID", "EXPO_PUBLIC_ADMOB_APP_ID"]));
  applyIfNotExplicit(options, explicit, "adMobAppIdIos", firstEnv(env, ["EXPO_PUBLIC_ADMOB_APP_ID_IOS", "EXPO_PUBLIC_ADMOB_APP_ID"]));
  applyIfNotExplicit(options, explicit, "adMobUseTestAds", firstEnv(env, ["EXPO_PUBLIC_ADMOB_USE_TEST_ADS"]));
  options.androidLaunchProductIds = launchProductIds;
  options.androidPostLaunchProductIds = postLaunchProductIds;
  applyIfNotExplicit(options, explicit, "androidProductId", firstEnv(env, ["FREED_ANDROID_PRODUCT_ID"]) || launchProductIds.yearly);
  applyIfNotExplicit(options, explicit, "entitlementId", firstEnv(env, ["EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID", "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID"]));
  options.iosLaunchProductIds = launchProductIds;
  options.iosPostLaunchProductIds = postLaunchProductIds;
  applyIfNotExplicit(options, explicit, "iosProductId", firstEnv(env, ["FREED_IOS_PRODUCT_ID"]) || launchProductIds.yearly);
  applyIfNotExplicit(options, explicit, "purchaseVerifyEndpoint", firstEnv(env, ["EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"]));
  applyIfNotExplicit(
    options,
    explicit,
    "rewardedAdUnitId",
    firstEnv(env, [
      "FREED_REWARDED_AD_UNIT_ID",
      "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS",
      "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID"
    ])
  );
  applyIfNotExplicit(
    options,
    explicit,
    "rewardedAdUnitIdAndroid",
    firstEnv(env, ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID", "FREED_REWARDED_AD_UNIT_ID"])
  );
  applyIfNotExplicit(
    options,
    explicit,
    "rewardedAdUnitIdIos",
    firstEnv(env, ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS", "FREED_REWARDED_AD_UNIT_ID"])
  );
  applyIfNotExplicit(options, explicit, "storeProvider", firstEnv(env, ["EXPO_PUBLIC_STORE_PROVIDER"]));
}

function printHelp() {
  console.log(`Usage: npm run evidence:store-ad-sandbox -- [options]

Creates a sandbox QA capture folder for the store/ad validation gate. It writes
command handoffs, run IDs, and a sanitized artifact matrix. It never stores raw
receipts, purchase tokens, customer identifiers, store credentials, or ad
network secrets, and it does not mark evidence as passing.

Options:
  --release-env-file <path>          Production env file used by preflight/smoke commands.
  --store-provider <native-iap|revenuecat>
  --admob-app-id-ios <id>            iOS AdMob app id for production/sandbox proof.
  --admob-app-id-android <id>        Android AdMob app id for production/sandbox proof.
  --rewarded-ad-unit-id-ios <id>     iOS rewarded reset unit id.
  --rewarded-ad-unit-id-android <id> Android rewarded reset unit id.
  --ios-product-id <id>              Configured FREED iOS premium product.
  --android-product-id <id>          Configured FREED Android premium product.
  --entitlement-id <id>              Premium entitlement ID.
  --purchase-verify-endpoint <url>   Deployed /api/purchases/verify endpoint.
  --rewarded-ad-unit-id <id>         Production-format AdMob rewarded unit.
  --ad-request-country-code <code>   Coarse ISO alpha-2 country context.
  --output-dir <path>                Artifact output folder.
  --run-id <id>                      Machine-readable run id.
  --plan-only                        Print the capture plan without writing files.
  --self-test                        Run offline matrix and sanitizer checks.
`);
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function validateEndpointUrl(label, value) {
  return validateEndpointPath(safeExternalHttpsEndpoint(value, label), label, PURCHASE_VERIFY_ENDPOINT_PATH);
}

function validateEndpointPath(endpoint, label, expectedPath) {
  const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
  if (pathname !== expectedPath && !pathname.endsWith(expectedPath)) {
    throw new Error(`${label} must target ${expectedPath}.`);
  }
  return endpoint;
}

function validateAdMobAppId(label, value) {
  const normalized = String(value).trim();
  if (!/^ca-app-pub-\d{16}~\d{10}$/.test(normalized)) {
    throw new Error(`${label} must be a production-format AdMob app id.`);
  }
  if (normalized.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER)) {
    throw new Error(`${label} must not use a Google sample publisher id.`);
  }
  return normalized;
}

function validateRewardedAdUnitId(label, value) {
  const normalized = String(value).trim();
  if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(normalized)) {
    throw new Error(`${label} must be a production-format AdMob rewarded unit id.`);
  }
  if (normalized.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER)) {
    throw new Error(`${label} must not use a Google sample publisher id.`);
  }
  return normalized;
}

function releaseCommand(scriptName, envFile) {
  return envFile ? sanitizeLocalHomePaths(`npm run ${scriptName} -- --env-file ${envFile}`) : `npm run ${scriptName}`;
}

function configuredSummary(options) {
  return {
    adRequestCountryCode: options.adRequestCountryCode.trim().toUpperCase(),
    adMobAppIdAndroid: options.adMobAppIdAndroid.trim(),
    adMobAppIdIos: options.adMobAppIdIos.trim(),
    adMobUseTestAds: (options.adMobUseTestAds || "false").trim(),
    androidLaunchProductIds: options.androidLaunchProductIds,
    androidPostLaunchProductIds: options.androidPostLaunchProductIds ?? DEFAULT_POST_LAUNCH_PRODUCT_IDS,
    androidProductId: options.androidProductId.trim(),
    entitlementId: options.entitlementId.trim(),
    iosLaunchProductIds: options.iosLaunchProductIds,
    iosPostLaunchProductIds: options.iosPostLaunchProductIds ?? DEFAULT_POST_LAUNCH_PRODUCT_IDS,
    iosProductId: options.iosProductId.trim(),
    purchaseVerifyEndpoint: options.purchaseVerifyEndpoint.trim(),
    rewardedAdUnitId: options.rewardedAdUnitId.trim(),
    rewardedAdUnitIdAndroid: options.rewardedAdUnitIdAndroid.trim(),
    rewardedAdUnitIdIos: options.rewardedAdUnitIdIos.trim(),
    storeProvider: options.storeProvider.trim().toLowerCase(),
  };
}

function requiredManualFlows(options) {
  const prefix = options.runId;
  return [
    {
      artifactField: "store.releasePreflightArtifact",
      metricFields: "store.releasePreflightCommand, store.releasePreflightRunId, checks.releaseEnvPreflightPassed",
      runId: `${prefix}-release-env-preflight`,
      summary: `Run ${releaseCommand("preflight:release-env", options.envFile)} and attach the passing command log.`,
    },
    {
      artifactField: "store.purchaseVerificationArtifact",
      metricFields: "store.purchaseSmokeCommand, store.purchaseVerificationPassCount, store.purchaseVerificationFailedCount",
      runId: `${prefix}-purchase-verification-smoke`,
      summary: `Run ${releaseCommand("smoke:purchase-verification", options.envFile)} with --report docs/validation/artifacts/${prefix}/purchase-verification-smoke-report.json against the deployed purchase endpoint, attach that local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 ${LAUNCH_PREMIUM_PLAN_LABEL} fake-known PASS rows, matching launchProductIdsChecked as store.purchaseVerificationArtifact and as each launch matrix purchaseVerificationArtifact, and keep store.purchaseSmokeCommand in the sanctioned command shape.`,
    },
    {
      artifactField: "store.restoreVerificationArtifact",
      metricFields: "store.restoreVerificationReportId, store.restoreVerificationPassCount, store.restoreVerificationFailedCount",
      runId: `${prefix}-restore-verification-smoke`,
      summary: `Attach a local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof, Core 3 ${LAUNCH_PREMIUM_PLAN_LABEL} fake-known PASS rows, matching launchProductIdsChecked, and the same required PASS result rows as store.restoreVerificationArtifact plus each launch matrix restoreVerificationArtifact, proving restore entitlement verification still uses the deployed fail-closed purchase endpoint without raw receipt or token echo.`,
    },
    {
      artifactField: "store.iosPurchaseArtifact",
      metricFields: "store.iosPurchaseTransactionId",
      runId: `${prefix}-ios-purchase-sandbox`,
      summary: "Record an App Store sandbox purchase with a numeric StoreKit transaction ID.",
    },
    {
      artifactField: "store.iosRestoreArtifact",
      metricFields: "store.iosRestoreTransactionId",
      runId: `${prefix}-ios-restore-sandbox`,
      summary: "Record App Store restore and server entitlement verification.",
    },
    {
      artifactField: "store.androidPurchaseArtifact",
      metricFields: "store.androidOrderId, store.androidPurchaseTokenHash",
      runId: `${prefix}-android-purchase-sandbox`,
      summary: "Record Play Billing test purchase with GPA order ID and a sha256 hash label of the token.",
    },
    {
      artifactField: "store.androidRestoreArtifact",
      metricFields: "store.restoreVerificationPassCount, store.restoreVerificationFailedCount",
      runId: `${prefix}-android-restore-sandbox`,
      summary: "Record Play Billing restore and verified entitlement state.",
    },
    {
      artifactField: "store.paywallLaunchScopeArtifact",
      metricFields: "store.paywallScopeRunId, checks.paywallCore3OnlyShown",
      runId: `${prefix}-paywall-launch-scope`,
      summary:
        `Capture the submitted paywall UI and attach a local freed-paywall-launch-scope-report-v1 JSON proof that Core 3 ${LAUNCH_PREMIUM_PLAN_LABEL} are the only visible purchase products, post-launch family/accountability/AI-coach products are hidden, yearly is the value anchor, restore is visible, and purchase buttons are enabled.`,
    },
    {
      artifactField: "store.consoleProductSetupArtifact",
      metricFields: "store.consoleProductSetupRunId, checks.storeConsoleProductsConfigured",
      runId: `${prefix}-store-console-product-setup`,
      summary:
        "Capture App Store Connect and Play Console product setup proof for Core 3 only: read-only Browser app-record readiness, monthly/yearly subscriptions, lifetime non-consumable/one-time product, attached screenshots/localizations, server-verification metadata, redacted console evidence artifacts with matching hashes, future SKUs inactive, and draft/internal/TestFlight-only status until evidence passes.",
    },
    {
      artifactField: "store.rewardedAdRequestArtifact",
      metricFields: "store.adMobAppIdIos, store.adMobAppIdAndroid, store.rewardedAdUnitIdIos, store.rewardedAdUnitIdAndroid, store.rewardedAdUnitId, store.rewardedAdFormat, store.rewardedAdResponseId, store.adRequestNonPersonalized, store.noInterstitialOrBannerAdRequestsConfirmed, store.adRequestCountryCode",
      runId: `${prefix}-rewarded-ad-request`,
      summary: "Capture a loaded rewarded ad response using platform-specific production AdMob app and rewarded unit IDs, non-personalized settings, and prove no banner, interstitial, app-open, or native ad request path was used.",
    },
    {
      artifactField: "store.freeRewardedInterventionArtifact",
      metricFields: "store.freePostAdChallengeLatencyMs",
      runId: `${prefix}-free-rewarded-intervention`,
      summary: "Record the free streak-risk intervention, rewarded ad gate, and generated challenge within 5000 ms.",
    },
    {
      artifactField: "store.rewardedAdCompletionArtifact",
      metricFields: "checks.rewardedAdCompletionGrantsChallenge",
      runId: `${prefix}-rewarded-ad-completion`,
      summary: "Record rewarded completion granting challenge access.",
    },
    {
      artifactField: "store.adFailureFallbackArtifact",
      metricFields: "checks.adFailureFallbackUnlocksChallenge",
      runId: `${prefix}-ad-failure-fallback`,
      summary: "Record ad load/show failure still opening a recovery challenge without punishing the user.",
    },
    {
      artifactField: "store.premiumNoAdInterventionArtifact",
      metricFields: "store.premiumNoAdLatencyMs, store.premiumNoRewardedAdRequested",
      runId: `${prefix}-premium-no-ad-intervention`,
      summary: "Record verified premium entitlement skipping rewarded ad requests and starting challenge mode within 3000 ms.",
    },
    {
      artifactField: "store.privacyDisclosureArtifact",
      metricFields: "store.privacyDisclosureReviewId",
      runId: `${prefix}-store-privacy-review`,
      summary: "Attach App Store / Play privacy disclosure review proof for billing, purchase verification, and rewarded ads.",
    },
  ];
}

function matrixRows(options) {
  return requiredManualFlows(options).map((flow) => ({
    actualResult: "",
    artifact: "",
    artifactField: flow.artifactField,
    metricFields: flow.metricFields,
    notes: "",
    runId: flow.runId,
    status: "pending-manual-qa",
    summary: flow.summary,
  }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const header = ["runId", "artifactField", "metricFields", "actualResult", "artifact", "status", "notes", "summary"];
  return `${[header, ...rows.map((row) => header.map((field) => row[field]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function launchProductSandboxRowsForCsv(configured, prefix) {
  const catalog = readJsonCatalog("store/store-products.json");
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  return LAUNCH_PREMIUM_PLAN_IDS.map((planId) => {
    const product = products.find((entry) => entry.planId === planId) || {};
    const apple = product.apple || {};
    const google = product.google || {};
    return {
      rowType: "launch-product-sandbox",
      planId,
      appleProductId: configured.iosLaunchProductIds[planId] || apple.productId || product.productId || "",
      appleProductType: apple.productType || product.appleType || "",
      appleDuration: apple.duration || "",
      applePurchaseRunId: `${prefix}-ios-${planId}-purchase-sandbox`,
      appleRestoreRunId: `${prefix}-ios-${planId}-restore-sandbox`,
      playProductId: configured.androidLaunchProductIds[planId] || google.productId || product.productId || "",
      playProductType: google.productType || product.googleType || "",
      playBasePlan: google.basePlanId || "",
      playBillingOrPurchase:
        google.productType === "one-time-product"
          ? google.purchaseType || google.billingPeriod || ""
          : google.billingPeriod || google.purchaseType || "",
      playPurchaseRunId: `${prefix}-android-${planId}-purchase-sandbox`,
      playRestoreRunId: `${prefix}-android-${planId}-restore-sandbox`,
      serverVerifyRunId: `${prefix}-${planId}-purchase-verification-smoke`,
      runId: `${prefix}-${planId}-product-matrix`,
      artifactField: "store.launchProductSandboxMatrix[]",
      metricFields:
        "iosPurchaseSandbox, iosRestoreSandbox, androidPurchaseSandbox, androidRestoreSandbox, receiptOrEntitlementVerified, restoreEntitlementVerified",
      actualResult: "",
      artifact: "",
      status: "pending-manual-qa",
      notes: "",
      summary:
        "Validate this Core 3 product row in App Store sandbox, Play Billing sandbox, and server purchase verification before marking final evidence true.",
    };
  });
}

function toStoreSandboxMatrixCsv(options, manifest) {
  const configured = configuredSummary(options);
  const productRows = launchProductSandboxRowsForCsv(configured, manifest.runId);
  const manualRows = manifest.matrixRows.map((row) => ({
    rowType: "manual-flow",
    planId: "",
    appleProductId: "",
    appleProductType: "",
    appleDuration: "",
    applePurchaseRunId: "",
    appleRestoreRunId: "",
    playProductId: "",
    playProductType: "",
    playBasePlan: "",
    playBillingOrPurchase: "",
    playPurchaseRunId: "",
    playRestoreRunId: "",
    serverVerifyRunId: "",
    ...row,
  }));
  const header = [
    "rowType",
    "planId",
    "appleProductId",
    "appleProductType",
    "appleDuration",
    "applePurchaseRunId",
    "appleRestoreRunId",
    "playProductId",
    "playProductType",
    "playBasePlan",
    "playBillingOrPurchase",
    "playPurchaseRunId",
    "playRestoreRunId",
    "serverVerifyRunId",
    "runId",
    "artifactField",
    "metricFields",
    "actualResult",
    "artifact",
    "status",
    "notes",
    "summary",
  ];
  return `${[
    header.map(csvEscape).join(","),
    ...[...productRows, ...manualRows].map((row) => header.map((field) => csvEscape(row[field])).join(",")),
  ]
    .join("\n")}\n`;
}

function markdownCell(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function toMarkdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content || "\n");
}

function releaseReportCommand(scriptName, envFile, reportPath) {
  const envCommand = envFile
    ? releaseCommand(scriptName, envFile)
    : `npm run ${scriptName} -- --env-file <production-env-file>`;
  return `${envCommand} --report ${reportPath}`;
}

function storeSandboxCaptureCommand(options) {
  const envFile = options.envFile ? sanitizeLocalHomePaths(options.envFile) : "<production-env-file>";
  const outputDir =
    options.outputDir || path.join("docs", "validation", "artifacts", options.runId, "store-ad-sandbox-capture");
  return `npm run evidence:store-ad-sandbox -- --release-env-file ${envFile} --run-id ${options.runId} --output-dir ${repoRelative(outputDir)}`;
}

function launchProductRowsForHandoff(configured) {
  const catalog = readJsonCatalog("store/store-products.json");
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  return LAUNCH_PREMIUM_PLAN_IDS.map((planId) => {
    const product = products.find((entry) => entry.planId === planId) || {};
    const apple = product.apple || {};
    const google = product.google || {};
    const reviewScreenshot = apple.reviewScreenshot || "";
    return [
      planId,
      configured.iosLaunchProductIds[planId] || apple.productId || product.productId || "",
      apple.productType || product.appleType || "",
      apple.subscriptionGroupId || "",
      apple.duration || "",
      configured.androidLaunchProductIds[planId] || google.productId || product.productId || "",
      google.productType || product.googleType || "",
      google.basePlanId || "",
      google.billingPeriod || "",
      google.purchaseType || "",
      google.offerId || "",
      apple.priceUsdIntent || google.priceUsdIntent || product.priceUsd || "",
      reviewScreenshot,
      reviewScreenshot ? fileSha256Label(reviewScreenshot) : "",
    ];
  });
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function buildStoreConsoleExecutionRunbook(options, manifest) {
  const configured = configuredSummary(options);
  const hostedLegalReadiness = currentHostedLegalReadinessSummary();
  const catalog = readJsonCatalog("store/store-products.json");
  const subscriptionGroupId = catalog.subscriptionGroupId || "freed_premium";
  const entitlementId = configured.entitlementId || catalog.entitlementId || "premium";
  const futureSkuIds = uniqueValues([
    ...Object.values(configured.iosPostLaunchProductIds || {}),
    ...Object.values(configured.androidPostLaunchProductIds || {}),
    ...(Array.isArray(catalog.futureProductsDisabledForV1) ? catalog.futureProductsDisabledForV1 : []),
  ]);
  const appStoreScreens = STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS.appStoreConnect;
  const googlePlayScreens = STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS.googlePlay;
  const lines = [
    `# Store Console Execution Runbook: ${manifest.runId}`,
    "",
    "Use this while operating the logged-in App Store Connect, Google Play Console, and AdMob accounts. This runbook prepares sandbox/TestFlight/internal-launch payment proof only; it is not permission to submit production.",
    "",
    "## Hard Stops",
    "",
    "- Do not click Submit for Review, Send for Review, Publish, Promote to production, or Start rollout from this runbook.",
    "- Do not activate post-launch family/accountability/AI-coach products for v1.",
    "- Do not paste raw purchase receipts, purchase tokens, service-account JSON, private keys, push tokens, customer IDs, or account IDs into evidence.",
    "- Redact team IDs, developer IDs, app IDs, account emails, order tokens, dashboard URLs, and any console user/account identifiers before saving screenshots.",
    "- Do not enter privacy/support/account-deletion URLs or configure paid products while the hosted legal URL audit is failing.",
    "- Do not continue console setup while `STORE_APP_RECORD_ACTION_PACKET.json` reports `blocked-before-hosted-legal-urls`; deploy and verify the public legal routes first.",
    "- Do not configure store products until `store-console-product-setup-report.template.json` is backed by a read-only `store-console-browser-readiness.json` report proving both app records exist and the Apple license agreement is accepted.",
    "- Capture evidence under `docs/validation/artifacts/<run-id>/store-ad-sandbox-capture/console-evidence/` and record hashes in `store-console-product-setup-report.template.json`.",
    "",
    "## Hosted Legal URL Gate",
    "",
    toMarkdownTable(["Field", "Value"], hostedLegalGateRows(hostedLegalReadiness)),
    "",
    hostedLegalReadiness.hostedLegalUrlsVerified
      ? "Hosted legal URL entry is currently allowed for store-console fields."
      : "Hosted legal URL entry and paid-product setup are currently blocked. Deploy and verify `/privacy`, `/support`, and `/account-deletion`, regenerate this packet, then continue.",
    "",
    "## Product Source Of Truth",
    "",
    toMarkdownTable(
      [
        "Plan",
        "Apple Product ID",
        "Apple Type",
        "Apple Group",
        "Apple Duration",
        "Google Product ID",
        "Google Type",
        "Base Plan",
        "Billing Period",
        "Purchase Type",
        "Offer",
        "USD Intent",
        "Review Screenshot",
      ],
      launchProductRowsForHandoff(configured).map((row) => row.slice(0, -1)),
    ),
    "",
    `Entitlement after server verification: \`${entitlementId}\`.`,
    `Subscription group: \`${subscriptionGroupId}\`.`,
    "",
    "## App Store Connect Execution",
    "",
    `1. After the hosted legal gate passes, create or confirm the app record for bundle ID \`${catalog.bundleId || "app.freed.recovery"}\` and keep the build in TestFlight/App Review prep until release evidence passes.`,
    "2. Confirm paid-app/IAP agreements, banking, tax, and sandbox tester access are ready outside this evidence file.",
    "3. Rerun read-only Browser readiness and continue only after both app records exist and the Apple license agreement is accepted.",
    `4. Create or confirm subscription group \`${subscriptionGroupId}\`.`,
    `5. Create \`${configured.iosLaunchProductIds.yearly || DEFAULT_LAUNCH_PRODUCT_IDS.yearly}\` as an auto-renewable yearly subscription in that group with duration \`P1Y\` and USD intent \`39.99\`.`,
    `6. Create \`${configured.iosLaunchProductIds.monthly || DEFAULT_LAUNCH_PRODUCT_IDS.monthly}\` as an auto-renewable monthly subscription in that group with duration \`P1M\` and USD intent \`9.99\`.`,
    `7. Create \`${configured.iosLaunchProductIds.lifetime || DEFAULT_LAUNCH_PRODUCT_IDS.lifetime}\` as a non-consumable in-app purchase with USD intent \`79.99\`.`,
    "8. Add en-US localization/metadata from `store/app-store/in-app-purchases.csv` and attach the matching review screenshot from the table above.",
    "9. Keep future SKUs inactive/not-created for v1: " + futureSkuIds.map((sku) => `\`${sku}\``).join(", ") + ".",
    "10. Capture the required redacted App Store Connect evidence screens:",
    "",
    toMarkdownTable(["Screen ID", "Capture Requirement"], appStoreScreens.map((screenId) => [screenId, "Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true."])),
    "",
    "## Google Play Console Execution",
    "",
    `1. After the hosted legal gate passes, create or confirm the Play app record for package name \`${catalog.packageName || "app.freed.recovery"}\` and keep releases internal/draft until release evidence passes.`,
    "2. Confirm the merchant profile, license testers, and Play Billing test configuration are ready outside this evidence file.",
    "3. Rerun read-only Browser readiness and continue only after both app records exist and the Apple license agreement is accepted.",
    `4. Create \`${configured.androidLaunchProductIds.yearly || DEFAULT_LAUNCH_PRODUCT_IDS.yearly}\` as a subscription with base plan \`yearly\`, billing period \`P1Y\`, and offer \`yearly-standard\`.`,
    `5. Create \`${configured.androidLaunchProductIds.monthly || DEFAULT_LAUNCH_PRODUCT_IDS.monthly}\` as a subscription with base plan \`monthly\`, billing period \`P1M\`, and offer \`monthly-standard\`.`,
    `6. Create \`${configured.androidLaunchProductIds.lifetime || DEFAULT_LAUNCH_PRODUCT_IDS.lifetime}\` as a one-time non-consumable product with USD intent \`79.99\`.`,
    "7. Add localizations/metadata from `store/play-store/products.csv`.",
    "8. Keep future SKUs inactive/not-created for v1: " + futureSkuIds.map((sku) => `\`${sku}\``).join(", ") + ".",
    "9. Capture the required redacted Google Play evidence screens:",
    "",
    toMarkdownTable(["Screen ID", "Capture Requirement"], googlePlayScreens.map((screenId) => [screenId, "Save a redacted screenshot or PDF, then record artifactPath, artifactHash, capturedAt, redacted=true, accountIdentifiersRedacted=true."])),
    "",
    "## AdMob Execution",
    "",
    `1. Create or confirm the AdMob iOS app for bundle ID \`${catalog.bundleId || "app.freed.recovery"}\` and Android app for package \`${catalog.packageName || "app.freed.recovery"}\`.`,
    "2. Create rewarded ad units only for the recovery reset placement; do not create or wire banner, interstitial, app-open, or native ad units for v1.",
    "3. Put the production-format IDs into the production env file, not into evidence JSON: `EXPO_PUBLIC_ADMOB_APP_ID_IOS`, `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`, `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS`, `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID`, and `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`.",
    "4. Capture rewarded-ad proof later with `rewarded-ad-request-report.template.json`; this console runbook does not prove an ad request loaded.",
    "",
    "## Filling The Console Product Report",
    "",
    "After the console setup is complete, copy `store-console-product-setup-report.template.json` to the local report path referenced by `store.consoleProductSetupArtifact` and update only sanitized fields:",
    "",
    "- Set `result` to `store-console-product-setup-captured`.",
    "- Keep `consoleProductSetupProofUsableForManualEvidence=false` while the hosted legal URL gate is failing or store legal URL entry is blocked.",
    "- Set `consoleProductSetupProofUsableForManualEvidence` to `true` only after hosted legal URLs pass, read-only app-record readiness passes, and product evidence is captured.",
    "- Fill `appRecordReadiness` from the latest sanitized `store-console-browser-readiness.json`: keep `storeMutationPerformed=false`, set the Browser report path/hash/run ID, and set every app-record readiness check to true only after Play app record, App Store Connect app record, and Apple license-agreement readiness all pass.",
    "- Set App Store Connect and Google Play `appRecordCreated` to `true` only after both app records exist.",
    "- Fill every `consoleEvidenceArtifacts` row with redacted local artifact paths and matching `sha256-<hex>` hashes.",
    "- Set each launch product `consoleStatus` to a draft/TestFlight/internal/sandbox-safe state, never `production-live`.",
    "- Set `metadataConfigured`, `reviewScreenshotAttached`, and `serverVerificationMetadataConfigured` to `true` only after inspecting the console.",
    "- Set both platform `noExtraLaunchProductsActive` and `draftOrSandboxOnlyUntilEvidencePasses` to `true` only after checking the console lists.",
    "- Set every `checks.*` value to `true` only when the matching source hashes, products, redacted evidence, inactive future SKUs, and draft/internal boundary are proven.",
    "",
    "## Follow-Up Gates",
    "",
    "```bash",
    releaseReportCommand("preflight:release-env", options.envFile, `docs/validation/artifacts/${manifest.runId}/release-env-preflight-report.json`),
    releaseReportCommand("smoke:purchase-verification", options.envFile, `docs/validation/artifacts/${manifest.runId}/purchase-verification-smoke-report.json`),
    storeSandboxCaptureCommand({ ...options, outputDir: path.join("docs", "validation", "artifacts", manifest.runId, "store-ad-sandbox-capture") }),
    "npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence",
    "```",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function currentStoreConsoleBrowserReadinessSummary() {
  const report = readJsonCatalog(DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT);
  return {
    browserReportPath: DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT,
    browserReportHash: fileSha256Label(DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT),
    browserReportSchemaVersion: report.schemaVersion || STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION,
    browserReportRunId: report.runId || "",
    result: report.result || "missing-read-only-browser-report",
    readyForConsoleProductSetup: report.readyForConsoleProductSetup === true,
    readOnlyBrowserInspection: report.browserInspection?.readOnly === true,
    storeMutationPerformed: report.browserInspection?.storeMutationPerformed === true,
    accountIdentifiersRedacted: report.browserInspection?.accountIdentifiersRedacted === true,
    blockers: Array.isArray(report.blockers) ? report.blockers : ["store-console-browser-report-missing"],
    googlePlay: {
      observedViaBrowser: report.googlePlay?.observedViaBrowser === true,
      appRecordStatus: report.googlePlay?.appRecordStatus || "unconfirmed",
      productSetupAllowed: report.googlePlay?.productSetupAllowed === true,
    },
    appStoreConnect: {
      observedViaBrowser: report.appStoreConnect?.observedViaBrowser === true,
      appRecordStatus: report.appStoreConnect?.appRecordStatus || "unconfirmed",
      licenseAgreementStatus: report.appStoreConnect?.licenseAgreementStatus || "unconfirmed",
      productSetupAllowed: report.appStoreConnect?.productSetupAllowed === true,
    },
  };
}

function currentHostedLegalReadinessSummary() {
  const report = readJsonCatalog(DEFAULT_STORE_LEGAL_HOSTED_REPORT);
  const routeResults = Array.isArray(report.routeResults) ? report.routeResults : [];
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const failedChecks = checks
    .filter((entry) => entry && entry.status === "fail")
    .map((entry) => entry.id || "hosted-legal-check-failed");
  const defaultPublicUrls = {
    privacy: "https://freedrecovery.app/privacy",
    support: "https://freedrecovery.app/support",
    "account-deletion": "https://freedrecovery.app/account-deletion",
  };
  const publicUrls = report.publicUrls && typeof report.publicUrls === "object" ? report.publicUrls : defaultPublicUrls;
  const hostedLegalUrlsVerified =
    report.schemaVersion === "freed-store-legal-hosted-url-audit-v1" &&
    report.sanitized === true &&
    report.result === "pass" &&
    report.failCount === 0 &&
    routeResults.length >= 3 &&
    routeResults.every((route) => Number(route.status) >= 200 && Number(route.status) < 300);
  return {
    hostedReportPath: DEFAULT_STORE_LEGAL_HOSTED_REPORT,
    hostedReportHash: fileSha256Label(DEFAULT_STORE_LEGAL_HOSTED_REPORT),
    hostedReportSchemaVersion: report.schemaVersion || "missing-hosted-legal-report",
    result: report.result || "missing-hosted-legal-report",
    hostedLegalUrlsVerified,
    failCount: Number.isFinite(Number(report.failCount)) ? Number(report.failCount) : null,
    publicUrls: {
      privacy: publicUrls.privacy || defaultPublicUrls.privacy,
      support: publicUrls.support || defaultPublicUrls.support,
      accountDeletion: publicUrls["account-deletion"] || publicUrls.accountDeletion || defaultPublicUrls["account-deletion"],
    },
    failedChecks,
    urlEntryAllowed: hostedLegalUrlsVerified,
    next:
      hostedLegalUrlsVerified
        ? "Hosted legal URLs are available for store-console URL fields."
        : "Deploy and verify /privacy, /support, and /account-deletion before entering legal URLs in Play Console or App Store Connect.",
  };
}

function hostedLegalGateRows(readiness) {
  return [
    ["Hosted legal report", readiness.hostedReportPath],
    ["Hosted legal report hash", readiness.hostedReportHash || "missing"],
    ["Hosted legal result", readiness.result],
    ["Hosted legal URLs verified", String(readiness.hostedLegalUrlsVerified)],
    ["Store legal URL entry allowed", String(readiness.urlEntryAllowed)],
    ["Privacy URL", readiness.publicUrls.privacy],
    ["Support URL", readiness.publicUrls.support],
    ["Account deletion URL", readiness.publicUrls.accountDeletion],
    [
      "Failed checks",
      readiness.failedChecks.length > 0 ? readiness.failedChecks.join(", ") : "none",
    ],
  ];
}

function buildStoreAppRecordActionPacket(options, manifest) {
  const catalog = readJsonCatalog("store/store-products.json");
  const readiness = currentStoreConsoleBrowserReadinessSummary();
  const hostedLegalReadiness = currentHostedLegalReadinessSummary();
  const bundleId = catalog.bundleId || "app.freed.recovery";
  const packageName = catalog.packageName || "app.freed.recovery";
  const privacyPolicyUrl = "https://freedrecovery.app/privacy";
  const supportUrl = "https://freedrecovery.app/support";
  const accountDeletionUrl = "https://freedrecovery.app/account-deletion";
  const supportEmail = "support@freedrecovery.app";
  const sourceFiles = [
    "store/console-launch-packet.md",
    "store/release-submission-checklist.md",
    "store/store-products.json",
    "store/app-store/metadata.md",
    "store/play-store/metadata.md",
    "store/play-store/data-safety.md",
    "store/app-store/app-privacy.md",
    "store/screenshots/listing-screenshot-plan.md",
    "docs/privacy-data-map.md",
    "docs/store-policy/android-accessibility-and-fgs-disclosure.md",
    "docs/store-policy/ios-screen-time-safari-dns-review.md",
  ];
  return {
    schemaVersion: STORE_APP_RECORD_ACTION_PACKET_SCHEMA_VERSION,
    sanitized: true,
    generatedAt: manifest.generatedAt,
    runId: `${manifest.runId}-store-app-record-action`,
    result: !hostedLegalReadiness.hostedLegalUrlsVerified
      ? "blocked-before-hosted-legal-urls"
      : readiness.readyForConsoleProductSetup
        ? "app-records-ready-for-product-setup"
        : "blocked-before-app-records-ready",
    releaseGate: "store-ad-sandbox-validation",
    appIdentifiers: {
      appName: "FREED",
      bundleId,
      packageName,
      appStoreSku: bundleId,
    },
    browserReadiness: readiness,
    hostedLegalReadiness,
    sourceFiles: sourceFiles.map((sourcePath) => ({
      path: sourcePath,
      hash: fileSha256Label(sourcePath),
    })),
    externalMutationBoundary: {
      browserPluginUseAllowedForReadOnlyInspection: true,
      createsExternalStoreRecords: true,
      actionTimeConfirmationRequired: true,
      confirmationToken: "confirm-draft-store-app-record-creation-only",
      confirmationPrompt:
        "Confirm before creating draft Google Play Console and/or App Store Connect app records for FREED using the fields in this packet. This is not approval to submit for review, publish, roll out, or create paid products.",
      destinations: ["https://play.google.com/console", "https://appstoreconnect.apple.com"],
      legalUrlEntryAllowed: hostedLegalReadiness.urlEntryAllowed,
      hostedLegalAuditRequiredBeforeUrlEntry: true,
      dataToTransmit: [
        "FREED app name",
        packageName,
        bundleId,
        "Health & Fitness category",
        `${privacyPolicyUrl} after hosted legal audit passes`,
        `${supportUrl} after hosted legal audit passes`,
        `${accountDeletionUrl} after hosted legal audit passes`,
        supportEmail,
      ],
      noProductionApprovalGranted: true,
    },
    hardStops: [
      "Do not enter privacy/support/account-deletion URLs into Play Console or App Store Connect until the hosted legal URL audit passes for every public route.",
      "Do not click Submit for Review, Send for Review, Publish, Promote to production, Start rollout, or equivalent production actions.",
      "Do not create subscriptions, one-time products, AdMob apps, or production releases until the read-only Browser readiness report proves both app records exist and the Apple agreement is accepted.",
      "Do not proceed inside App Store Connect while the Apple Developer Program License Agreement is pending unless the Account Holder is the person accepting that agreement.",
      "Do not paste account emails, team IDs, developer IDs, service-account JSON, private keys, purchase receipts, or raw screenshots into evidence.",
    ],
    requiredActionOrder: [
      {
        stepId: "hosted-legal-url-validation",
        platform: "legal-web",
        requiredBefore: ["google-play-app-record-url-fields", "app-store-connect-app-record-url-fields"],
        operator: "Static hosting/DNS owner",
        action:
          "Deploy and verify https://freedrecovery.app/privacy, /support, and /account-deletion before entering legal URLs in store console fields.",
        currentStatus: hostedLegalReadiness.result,
      },
      {
        stepId: "apple-license-agreement",
        platform: "app-store-connect",
        requiredBefore: ["app-store-connect-app-record", "app-store-connect-iap-setup"],
        operator: "Apple Account Holder",
        action: "Accept the pending Apple Developer Program License Agreement if App Store Connect still shows that blocker.",
        currentStatus: readiness.appStoreConnect.licenseAgreementStatus,
      },
      {
        stepId: "google-play-app-record",
        platform: "google-play-console",
        requiredBefore: ["google-play-product-setup", "android-internal-release"],
        operator: "Google Play Console admin",
        action: "Create or identify the FREED draft app record for package app.freed.recovery.",
        currentStatus: readiness.googlePlay.appRecordStatus,
      },
      {
        stepId: "app-store-connect-app-record",
        platform: "app-store-connect",
        requiredBefore: ["app-store-connect-iap-setup", "testflight-review"],
        operator: "App Store Connect admin after agreement acceptance",
        action: "Create or identify the FREED app record for bundle ID app.freed.recovery.",
        currentStatus: readiness.appStoreConnect.appRecordStatus,
      },
      {
        stepId: "read-only-readiness-recheck",
        platform: "browser-evidence",
        requiredBefore: ["core-3-product-setup"],
        operator: "Codex Browser read-only inspection",
        action:
          "Rerun npm run evidence:store-console-browser with both app records present and agreement accepted, with no store mutation performed during that read-only check.",
        currentStatus: readiness.result,
      },
    ],
    googlePlayAppRecordPayload: {
      destination: "Google Play Console > All apps > Create app",
      permittedAction: "Create or identify a draft app record only.",
      legalUrlEntryAllowed: hostedLegalReadiness.urlEntryAllowed,
      prerequisites: [
        "Hosted legal URL audit passes for privacy/support/account-deletion before entering URL fields.",
      ],
      fields: {
        appName: "FREED",
        defaultLanguage: "English (United States)",
        appOrGame: "App",
        freeOrPaid: "Free download with in-app purchases",
        packageName,
        category: "Health & Fitness",
        targetAudience: "Adults/recovery audience; not child-directed and not submitted to Families.",
        appAccess: "No restricted login required for reviewer access to core app surfaces.",
        privacyPolicyUrl,
        supportEmail,
        accountDeletionUrl,
      },
      declarationsToPrepareAfterRecordExists: [
        "Ads present because free users may see rewarded reset ads.",
        "AccessibilityService declaration from docs/store-policy/android-accessibility-and-fgs-disclosure.md.",
        "VpnService / DNS Guard disclosure as DNS-only adult-domain filtering, not full-traffic proxying.",
        "Data Safety answers from store/play-store/data-safety.md and docs/privacy-data-map.md.",
      ],
      stopAfter: "App record exists in draft/internal-safe state; do not configure products until readiness recheck passes.",
    },
    appStoreConnectAppRecordPayload: {
      destination: "App Store Connect > Apps > New App",
      permittedAction: "Create or identify an app record only after the Apple agreement blocker is cleared.",
      legalUrlEntryAllowed: hostedLegalReadiness.urlEntryAllowed,
      prerequisites: [
        "Hosted legal URL audit passes for privacy/support/account-deletion before entering URL fields.",
        "Apple Developer Program License Agreement accepted by Account Holder.",
        "Bundle ID app.freed.recovery exists in the Apple developer account with required production capabilities/entitlements.",
      ],
      fields: {
        platform: "iOS",
        name: "FREED",
        primaryLanguage: "English (U.S.)",
        bundleId,
        sku: bundleId,
        category: "Health & Fitness",
        privacyPolicyUrl,
        supportUrl,
        supportEmail,
      },
      declarationsToPrepareAfterRecordExists: [
        "App Privacy answers from store/app-store/app-privacy.md and docs/privacy-data-map.md.",
        "Screen Time, FamilyControls, ManagedSettings, DeviceActivity, and Safari Content Blocker review notes from docs/store-policy/ios-screen-time-safari-dns-review.md.",
        "In-app purchase group freed_premium only after app-record readiness recheck passes.",
      ],
      stopAfter: "App record exists in draft/TestFlight-safe state; do not create IAPs until readiness recheck passes.",
    },
    afterAppRecordsExist: {
      readOnlyBrowserReadinessCommand:
        "npm run evidence:store-console-browser -- --play-console-observed --play-freed-app-present --app-store-connect-observed --app-store-freed-app-present --app-store-agreement-accepted",
      regenerateSandboxPacketCommand: storeSandboxCaptureCommand(options),
      nextEvidenceArtifact: "store-console-product-setup-report.template.json",
    },
    checks: {
      packetIsSanitized: true,
      actionTimeConfirmationRequired: true,
      accountIdentifiersOmitted: true,
      blocksProductionSubmission: true,
      blocksLegalUrlEntryUntilHostedLegalPasses: true,
      blocksProductSetupUntilReadinessPasses: true,
      core3OnlyBoundaryRetained: true,
      hostedLegalUrlsVerified: hostedLegalReadiness.hostedLegalUrlsVerified,
      legalUrlEntryAllowed: hostedLegalReadiness.urlEntryAllowed,
      currentReadinessBlocksIfAppRecordsMissing: readiness.readyForConsoleProductSetup !== true,
    },
  };
}

function buildStoreAppRecordActionPacketMarkdown(packet) {
  const lines = [
    `# Store App Record Action Packet: ${packet.runId}`,
    "",
    "This packet is for creating or identifying draft app records only. It is not approval to submit for review, publish, roll out, or create paid products.",
    "",
    "## Current Readiness",
    "",
    `- Result: ${packet.result}`,
    `- Browser report: \`${packet.browserReadiness.browserReportPath}\``,
    `- Browser report hash: \`${packet.browserReadiness.browserReportHash || "missing"}\``,
    `- Hosted legal report: \`${packet.hostedLegalReadiness.hostedReportPath}\``,
    `- Hosted legal report hash: \`${packet.hostedLegalReadiness.hostedReportHash || "missing"}\``,
    `- Hosted legal result: ${packet.hostedLegalReadiness.result}`,
    `- Hosted legal URLs verified: ${packet.hostedLegalReadiness.hostedLegalUrlsVerified}`,
    `- Store legal URL entry allowed: ${packet.hostedLegalReadiness.urlEntryAllowed}`,
    `- Read-only Browser inspection: ${packet.browserReadiness.readOnlyBrowserInspection}`,
    `- Store mutation during Browser check: ${packet.browserReadiness.storeMutationPerformed}`,
    `- Google Play app record: ${packet.browserReadiness.googlePlay.appRecordStatus}`,
    `- App Store Connect app record: ${packet.browserReadiness.appStoreConnect.appRecordStatus}`,
    `- Apple license agreement: ${packet.browserReadiness.appStoreConnect.licenseAgreementStatus}`,
    "",
    "## Required Confirmation",
    "",
    `Before any browser-side app-record creation, confirm: \`${packet.externalMutationBoundary.confirmationToken}\`.`,
    "",
    packet.externalMutationBoundary.confirmationPrompt,
    "",
    "## Hard Stops",
    "",
    ...packet.hardStops.map((item) => `- ${item}`),
    "",
    "## Action Order",
    "",
    toMarkdownTable(
      ["Step", "Platform", "Operator", "Current status", "Action"],
      packet.requiredActionOrder.map((step) => [
        step.stepId,
        step.platform,
        step.operator,
        step.currentStatus,
        step.action,
      ]),
    ),
    "",
    "## Google Play Draft App Record",
    "",
    `Destination: ${packet.googlePlayAppRecordPayload.destination}`,
    "",
    toMarkdownTable(
      ["Field", "Value"],
      Object.entries(packet.googlePlayAppRecordPayload.fields).map(([key, value]) => [key, value]),
    ),
    "",
    "## App Store Connect App Record",
    "",
    `Destination: ${packet.appStoreConnectAppRecordPayload.destination}`,
    "",
    toMarkdownTable(
      ["Field", "Value"],
      Object.entries(packet.appStoreConnectAppRecordPayload.fields).map(([key, value]) => [key, value]),
    ),
    "",
    "## After App Records Exist",
    "",
    `- Read-only Browser readiness: \`${packet.afterAppRecordsExist.readOnlyBrowserReadinessCommand}\``,
    `- Regenerate sandbox packet: \`${packet.afterAppRecordsExist.regenerateSandboxPacketCommand}\``,
    `- Next product evidence template: \`${packet.afterAppRecordsExist.nextEvidenceArtifact}\``,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildAdMobActionPacket(options, manifest) {
  const configured = configuredSummary(options);
  const catalog = readJsonCatalog("store/store-products.json");
  const bundleId = catalog.bundleId || "app.freed.recovery";
  const packageName = catalog.packageName || "app.freed.recovery";
  const hasIosAppId = Boolean(configured.adMobAppIdIos);
  const hasAndroidAppId = Boolean(configured.adMobAppIdAndroid);
  const hasIosRewardedUnit = Boolean(configured.rewardedAdUnitIdIos);
  const hasAndroidRewardedUnit = Boolean(configured.rewardedAdUnitIdAndroid);
  const adMobUseTestAdsExplicitlyFalse = configured.adMobUseTestAds === "false";
  const envReady =
    hasIosAppId && hasAndroidAppId && hasIosRewardedUnit && hasAndroidRewardedUnit && adMobUseTestAdsExplicitlyFalse;
  const sourceFiles = [
    "store/console-launch-packet.md",
    "store/play-store/data-safety.md",
    "store/app-store/app-privacy.md",
    "docs/privacy-data-map.md",
    "src/lib/monetization.ts",
    "src/lib/native-monetization-adapter.ts",
    "src/lib/native-monetization-runtime.ts",
  ];

  return {
    schemaVersion: ADMOB_ACTION_PACKET_SCHEMA_VERSION,
    sanitized: true,
    generatedAt: manifest.generatedAt,
    runId: `${manifest.runId}-admob-action`,
    result: envReady ? "admob-env-ready-for-sandbox-ad-proof" : "blocked-before-admob-env-ready",
    releaseGate: "store-ad-sandbox-validation",
    currentBlocker:
      hasAndroidAppId && hasAndroidRewardedUnit
        ? "admob-sandbox-proof-pending"
        : "android-upload-signing-blocked-by-production-admob",
    appIdentifiers: {
      appName: "FREED",
      bundleId,
      packageName,
    },
    sourceFiles: sourceFiles.map((sourcePath) => ({
      path: sourcePath,
      hash: fileSha256Label(sourcePath),
    })),
    externalMutationBoundary: {
      browserPluginUseAllowedForConsoleSetup: true,
      createsExternalAdMobAppsOrAdUnits: true,
      actionTimeConfirmationRequired: true,
      confirmationToken: ADMOB_ACTION_CONFIRMATION_TOKEN,
      confirmationPrompt:
        "Confirm before creating or identifying AdMob iOS/Android app records and rewarded reset ad units for FREED. This is not approval to enable production rollout or add banner/interstitial/app-open/native ad placements.",
      destinations: ["https://apps.admob.com"],
      dataToTransmit: [
        "FREED app name",
        bundleId,
        packageName,
        "rewarded reset challenge placement",
      ],
      noProductionApprovalGranted: true,
    },
    hardStops: [
      "Do not create banner, interstitial, app-open, or native ad units for v1.",
      "Do not paste AdMob account IDs, payment IDs, ad response payloads, device identifiers, service-account JSON, or private account screenshots into evidence.",
      "Do not enable personalized ad targeting from FREED recovery context; rewarded requests must remain non-personalized and coarse-country only.",
      "Do not treat AdMob app/unit creation as release evidence until a real rewarded request and store/ad sandbox evidence pass.",
    ],
    requiredActionOrder: [
      {
        stepId: "admob-ios-app",
        platform: "admob",
        requiredBefore: ["ios-rewarded-reset-unit", "ios-store-ad-sandbox"],
        action: `Create or identify the AdMob iOS app for bundle ID ${bundleId}.`,
        currentStatus: hasIosAppId ? "configured-in-env" : "missing-production-env",
      },
      {
        stepId: "admob-android-app",
        platform: "admob",
        requiredBefore: ["android-rewarded-reset-unit", "android-upload-signed-aab"],
        action: `Create or identify the AdMob Android app for package ${packageName}.`,
        currentStatus: hasAndroidAppId ? "configured-in-env" : "missing-production-env",
      },
      {
        stepId: "ios-rewarded-reset-unit",
        platform: "admob",
        requiredBefore: ["ios-rewarded-ad-request-proof"],
        action: "Create or identify exactly one iOS rewarded ad unit for the recovery reset challenge gate.",
        currentStatus: hasIosRewardedUnit ? "configured-in-env" : "missing-production-env",
      },
      {
        stepId: "android-rewarded-reset-unit",
        platform: "admob",
        requiredBefore: ["android-rewarded-ad-request-proof"],
        action: "Create or identify exactly one Android rewarded ad unit for the recovery reset challenge gate.",
        currentStatus: hasAndroidRewardedUnit ? "configured-in-env" : "missing-production-env",
      },
      {
        stepId: "rewarded-request-proof",
        platform: "device-qa",
        requiredBefore: ["store-ad-sandbox-validation"],
        action:
          "Fill rewarded-ad-request-report.template.json only after a real rewarded response loads with non-personalized/coarse-country request proof and no banner/interstitial/app-open/native requests.",
        currentStatus: "pending-manual-qa",
      },
    ],
    productionEnvKeys: [
      {
        key: "EXPO_PUBLIC_ADMOB_APP_ID_IOS",
        expectedShape: "ca-app-pub-<16-digits>~<10-digits>",
        configured: hasIosAppId,
        evidenceValueStored: false,
      },
      {
        key: "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
        expectedShape: "ca-app-pub-<16-digits>~<10-digits>",
        configured: hasAndroidAppId,
        evidenceValueStored: false,
      },
      {
        key: "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS",
        expectedShape: "ca-app-pub-<16-digits>/<10-digits>",
        configured: hasIosRewardedUnit,
        evidenceValueStored: false,
      },
      {
        key: "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID",
        expectedShape: "ca-app-pub-<16-digits>/<10-digits>",
        configured: hasAndroidRewardedUnit,
        evidenceValueStored: false,
      },
      {
        key: "EXPO_PUBLIC_ADMOB_USE_TEST_ADS",
        expectedValue: "false",
        configured: adMobUseTestAdsExplicitlyFalse,
        evidenceValueStored: false,
      },
    ],
    adPlacementPolicy: {
      allowedFormats: ["rewarded"],
      forbiddenFormats: ["banner", "interstitial", "app-open", "native"],
      placement: "free recovery reset challenge gate",
      premiumBehavior: "verified premium entitlement skips rewarded ads before challenge entry",
      failureBehavior: "ad load/show failure opens the recovery challenge without retry loops or punishment",
      personalization: "non-personalized request with coarse country context only",
    },
    followUp: {
      readOnlyAdMobReadinessCommand:
        "npm run evidence:admob-console-browser -- --admob-console-observed --admob-ios-app-present --admob-android-app-present --ios-rewarded-unit-present --android-rewarded-unit-present --no-forbidden-formats-observed",
      readOnlyAdMobReadinessArtifact: DEFAULT_ADMOB_CONSOLE_READINESS_REPORT,
      adMobEnvPatchTemplate: ADMOB_ENV_PATCH_TEMPLATE_NAME,
      preflightCommand: releaseReportCommand(
        "preflight:release-env",
        options.envFile,
        `docs/validation/artifacts/${manifest.runId}/release-env-preflight-report.json`,
      ),
      storeAdSandboxCommand: storeSandboxCaptureCommand(options),
      rewardedAdRequestTemplate: "rewarded-ad-request-report.template.json",
      androidAabUploadSignedCommand:
        "npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-aab-build-report.json",
    },
    checks: {
      packetIsSanitized: true,
      actionTimeConfirmationRequired: true,
      accountIdentifiersOmitted: true,
      blocksProductionSubmission: true,
      rewardedOnlyBoundaryRetained: true,
      noAdNetworkSecretsStored: true,
      androidUploadSigningBlockerNamed: true,
      platformSpecificEnvRequired: true,
      envReady,
    },
  };
}

function buildAdMobEnvPatchTemplate(packet) {
  const rows = [
    "# FREED AdMob production env patch template",
    "# Generated from ADMOB_ACTION_PACKET.json. Do not use this artifact path as the release --env-file.",
    "# Copy the completed lines into the real production env file after the AdMob console action is confirmed.",
    "# Keep evidence sanitized: do not paste account IDs, payment IDs, screenshots, service-account JSON, or ad response payloads here.",
    "",
    `# Confirmation token before console mutation: ${packet.externalMutationBoundary.confirmationToken}`,
    `# iOS bundle ID: ${packet.appIdentifiers.bundleId}`,
    `# Android package: ${packet.appIdentifiers.packageName}`,
    "# Allowed v1 ad format: rewarded only",
    "",
  ];
  for (const entry of packet.productionEnvKeys) {
    const expected = entry.expectedShape || entry.expectedValue || "";
    rows.push(`# ${entry.key}: ${expected}`);
    rows.push(`${entry.key}=${entry.expectedValue === "false" ? "false" : ""}`);
  }
  rows.push("");
  rows.push("# After copying values into the real production env file, run:");
  rows.push(
    "# npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/store-ad-sandbox-current/release-env-preflight-report.json",
  );
  rows.push(
    "# npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture",
  );
  rows.push("");
  return `${rows.join("\n")}\n`;
}

function buildAdMobActionPacketMarkdown(packet) {
  const lines = [
    `# AdMob Action Packet: ${packet.runId}`,
    "",
    "This packet is for creating or identifying FREED AdMob app records and rewarded reset ad units. It is not approval to publish, roll out, or add other ad placements.",
    "",
    "## Current Status",
    "",
    `- Result: ${packet.result}`,
    `- Current blocker: ${packet.currentBlocker}`,
    `- iOS bundle ID: \`${packet.appIdentifiers.bundleId}\``,
    `- Android package: \`${packet.appIdentifiers.packageName}\``,
    "",
    "## Required Confirmation",
    "",
    `Before any AdMob console mutation, confirm: \`${packet.externalMutationBoundary.confirmationToken}\`.`,
    "",
    packet.externalMutationBoundary.confirmationPrompt,
    "",
    "## Hard Stops",
    "",
    ...packet.hardStops.map((item) => `- ${item}`),
    "",
    "## Action Order",
    "",
    toMarkdownTable(
      ["Step", "Platform", "Current status", "Action"],
      packet.requiredActionOrder.map((step) => [
        step.stepId,
        step.platform,
        step.currentStatus,
        step.action,
      ]),
    ),
    "",
    "## Production Env Keys",
    "",
    toMarkdownTable(
      ["Key", "Expected", "Configured in capture", "Stored in evidence"],
      packet.productionEnvKeys.map((entry) => [
        entry.key,
        entry.expectedShape || entry.expectedValue || "",
        entry.configured,
        entry.evidenceValueStored,
      ]),
    ),
    "",
    "## Placement Policy",
    "",
    `- Allowed formats: ${packet.adPlacementPolicy.allowedFormats.map((format) => `\`${format}\``).join(", ")}`,
    `- Forbidden formats: ${packet.adPlacementPolicy.forbiddenFormats.map((format) => `\`${format}\``).join(", ")}`,
    `- Placement: ${packet.adPlacementPolicy.placement}`,
    `- Premium behavior: ${packet.adPlacementPolicy.premiumBehavior}`,
    `- Failure behavior: ${packet.adPlacementPolicy.failureBehavior}`,
    `- Personalization: ${packet.adPlacementPolicy.personalization}`,
    "",
    "## Follow-Up",
    "",
    `- Read-only AdMob readiness: \`${packet.followUp.readOnlyAdMobReadinessCommand}\``,
    `- Read-only AdMob readiness artifact: \`${packet.followUp.readOnlyAdMobReadinessArtifact}\``,
    `- AdMob env patch template: \`${packet.followUp.adMobEnvPatchTemplate}\``,
    `- Preflight: \`${packet.followUp.preflightCommand}\``,
    `- Regenerate store/ad sandbox packet: \`${packet.followUp.storeAdSandboxCommand}\``,
    `- Rewarded request template: \`${packet.followUp.rewardedAdRequestTemplate}\``,
    `- Android upload-signed AAB after AdMob env is real: \`${packet.followUp.androidAabUploadSignedCommand}\``,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildConsolePaymentHandoff(options, manifest) {
  const configured = configuredSummary(options);
  const hostedLegalReadiness = currentHostedLegalReadinessSummary();
  const catalog = readJsonCatalog("store/store-products.json");
  const subscriptionGroupId = catalog.subscriptionGroupId || "freed_premium";
  const entitlementId = configured.entitlementId || catalog.entitlementId || "premium";
  const futureSkuIds = uniqueValues([
    ...Object.values(configured.iosPostLaunchProductIds || {}),
    ...Object.values(configured.androidPostLaunchProductIds || {}),
    ...(Array.isArray(catalog.futureProductsDisabledForV1) ? catalog.futureProductsDisabledForV1 : []),
  ]);
  const artifactRoot = `docs/validation/artifacts/${manifest.runId}`;
  const releasePreflightReportPath = `${artifactRoot}/release-env-preflight-report.json`;
  const purchaseSmokeReportPath = `${artifactRoot}/purchase-verification-smoke-report.json`;
  const sandboxCaptureDir = path.join(artifactRoot, "store-ad-sandbox-capture");
  const lines = [
    `# Store Console Payment Handoff: ${manifest.runId}`,
    "",
    "This is a console setup and sandbox evidence handoff for the Core 3 launch products. It is not production approval.",
    "",
    "## Boundaries",
    "",
    "- Do not submit production until strict release evidence, physical-device validation, privacy declarations, sandbox purchases, and purchase verification all pass.",
    "- Keep Play releases on internal/draft and App Store builds in TestFlight/App Review prep until the release gate passes.",
    "- Server verification remains required before granting premium entitlement.",
    "- Do not paste raw receipts, purchase tokens, customer identifiers, service-account JSON, private keys, or AdMob secrets into evidence.",
    "- For Play evidence, record the GPA order ID and a sha256-<hex> purchase token hash only. For Apple evidence, record the numeric StoreKit transaction ID only.",
    "- Do not create Core 3 paid products or enter privacy/support/account-deletion URLs while the hosted legal URL audit is failing.",
    "- Do not use this payment handoff for console setup while `STORE_APP_RECORD_ACTION_PACKET.json` reports `blocked-before-hosted-legal-urls`.",
    "",
    "## Hosted Legal URL Gate",
    "",
    toMarkdownTable(["Field", "Value"], hostedLegalGateRows(hostedLegalReadiness)),
    "",
    hostedLegalReadiness.hostedLegalUrlsVerified
      ? "Hosted legal URL entry is currently allowed for App Store Connect and Play Console fields."
      : "Hosted legal URL entry and payment setup are currently blocked. Deploy and verify `/privacy`, `/support`, and `/account-deletion`, regenerate this handoff, then continue.",
    "",
    "## Core 3 Launch Products",
    "",
    toMarkdownTable(
      [
        "Plan",
        "Apple Product ID",
        "Apple Type",
        "Apple Group",
        "Apple Duration",
        "Google Product ID",
        "Google Type",
        "Base Plan",
        "Billing Period",
        "Purchase Type",
        "Offer",
        "USD Intent",
        "Review Screenshot",
        "Screenshot Hash",
      ],
      launchProductRowsForHandoff(configured),
    ),
    "",
    "## App Store Connect Setup",
    "",
    "- Continue only after the hosted legal URL gate passes and read-only app-record readiness proves the App Store Connect app exists.",
    `- Create monthly and yearly as auto-renewable subscriptions in subscription group \`${subscriptionGroupId}\`.`,
    "- Create lifetime as a non-consumable in-app purchase.",
    "- Attach the review screenshots listed above and keep localizations aligned with `store/app-store/in-app-purchases.csv`.",
    `- Map every purchase to entitlement \`${entitlementId}\` only after server verification succeeds.`,
    "- Keep any family/accountability/AI products inactive for v1.",
    "",
    "## Google Play Console Setup",
    "",
    "- Continue only after the hosted legal URL gate passes and read-only app-record readiness proves the Play app exists.",
    "- Create monthly and yearly as subscriptions with base plans `monthly` and `yearly`, billing periods `P1M` and `P1Y`.",
    "- Create lifetime as a one-time non-consumable product.",
    "- Keep product rows aligned with `store/play-store/products.csv` and leave products draft/internal until sandbox evidence passes.",
    `- Map every purchase to entitlement \`${entitlementId}\` only after server verification succeeds.`,
    "- Keep any family/accountability/AI products inactive for v1.",
    "",
    "## Future SKUs Inactive",
    "",
    toMarkdownTable(["Product ID", "Launch Status"], futureSkuIds.map((productId) => [productId, "inactive-post-launch"])),
    "",
    "## Required Production Env Keys",
    "",
    toMarkdownTable(
      ["Key", "Expected v1 value"],
      [
        ["EXPO_PUBLIC_STORE_PROVIDER", configured.storeProvider || "native-iap"],
        ["EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID", entitlementId],
        ["EXPO_PUBLIC_IAP_PRODUCT_YEARLY", configured.iosLaunchProductIds.yearly || DEFAULT_LAUNCH_PRODUCT_IDS.yearly],
        ["EXPO_PUBLIC_IAP_PRODUCT_MONTHLY", configured.iosLaunchProductIds.monthly || DEFAULT_LAUNCH_PRODUCT_IDS.monthly],
        ["EXPO_PUBLIC_IAP_PRODUCT_LIFETIME", configured.iosLaunchProductIds.lifetime || DEFAULT_LAUNCH_PRODUCT_IDS.lifetime],
        ["EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT", configured.purchaseVerifyEndpoint || "https://<production-host>/api/purchases/verify"],
        ["EXPO_PUBLIC_ADMOB_APP_ID_IOS", configured.adMobAppIdIos || "ca-app-pub-<16-digits>~<10-digits>"],
        ["EXPO_PUBLIC_ADMOB_APP_ID_ANDROID", configured.adMobAppIdAndroid || "ca-app-pub-<16-digits>~<10-digits>"],
        ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS", configured.rewardedAdUnitIdIos || "ca-app-pub-<16-digits>/<10-digits>"],
        ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID", configured.rewardedAdUnitIdAndroid || "ca-app-pub-<16-digits>/<10-digits>"],
        ["EXPO_PUBLIC_ADMOB_USE_TEST_ADS", "false"],
      ],
    ),
    "",
    "Keep `EXPO_PUBLIC_IAP_PRODUCT_FAMILY`, `EXPO_PUBLIC_IAP_PRODUCT_ACCOUNTABILITY`, and `EXPO_PUBLIC_IAP_PRODUCT_AI_COACH` unset or commented for v1.",
    "Do not rely on the legacy generic `FREED_REWARDED_AD_UNIT_ID` for production release checks; configure the platform-specific rewarded unit IDs above so Android AAB, iOS archive, and sandbox evidence use the same keys as release preflight.",
    "",
    "## Required Report Commands",
    "",
    "Run these with real non-placeholder production env values and attach sanitized local report artifacts:",
    "",
    "```bash",
    releaseReportCommand("preflight:release-env", options.envFile, releasePreflightReportPath),
    releaseReportCommand("smoke:purchase-verification", options.envFile, purchaseSmokeReportPath),
    storeSandboxCaptureCommand({ ...options, outputDir: sandboxCaptureDir }),
    "```",
    "",
    "## Sandbox Evidence Targets",
    "",
    toMarkdownTable(
      ["Evidence", "Template or Command Source"],
      [
        ["Paywall Core 3 only", "paywall-launch-scope-report.template.json"],
        ["Console product setup", "store-console-product-setup-report.template.json"],
        ["Rewarded ad request", "rewarded-ad-request-report.template.json"],
        ["Free rewarded intervention", "store-intervention-flow-report.templates.json"],
        ["Premium no-ad challenge entry", "store-intervention-flow-report.templates.json"],
        ["Privacy disclosure review", "store-privacy-disclosure-report.template.json"],
      ],
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildStoreSandboxTestPlan(options, manifest) {
  const configured = configuredSummary(options);
  const hostedLegalReadiness = currentHostedLegalReadinessSummary();
  const catalog = readJsonCatalog("store/store-products.json");
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const entitlementId = configured.entitlementId || catalog.entitlementId || "premium";
  const productRows = LAUNCH_PREMIUM_PLAN_IDS.map((planId) => {
    const product = products.find((entry) => entry.planId === planId) || {};
    const apple = product.apple || {};
    const google = product.google || {};
    return [
      planId,
      configured.iosLaunchProductIds[planId],
      apple.productType || "",
      apple.duration || "",
      `${manifest.runId}-ios-${planId}-purchase-sandbox`,
      `${manifest.runId}-ios-${planId}-restore-sandbox`,
      configured.androidLaunchProductIds[planId],
      google.productType || "",
      google.basePlanId || "",
      google.productType === "one-time-product"
        ? google.purchaseType || google.billingPeriod || ""
        : google.billingPeriod || google.purchaseType || "",
      `${manifest.runId}-android-${planId}-purchase-sandbox`,
      `${manifest.runId}-android-${planId}-restore-sandbox`,
      `${manifest.runId}-${planId}-purchase-verification-smoke`,
    ];
  });
  const interventionRows = STORE_INTERVENTION_FLOW_CONFIGS.map((config) => [
    config.flowType,
    config.runId(manifest.runId),
    config.artifactField,
    config.latencyField ? `${config.maxLatencyMs} ms max` : "no latency ceiling",
  ]);
  const lines = [
    `# Store Sandbox Test Plan: ${manifest.runId}`,
    "",
    "Use this plan after the draft app records, Core 3 products, purchase-verification backend, and sandbox tester access exist. It is a QA execution plan, not production approval.",
    "",
    "## Hard Stops",
    "",
    "- Do not click Submit for Review, Send for Review, Publish, Promote to production, Start rollout, or equivalent production actions.",
    "- Do not activate family, accountability, or AI-coach products for v1.",
    "- Do not paste raw Apple receipts, Play purchase tokens, service-account JSON, private keys, AdMob secrets, customer IDs, account emails, or console account identifiers into evidence.",
    "- Record Apple purchases by numeric StoreKit transaction ID only.",
    "- Record Play purchases by GPA order ID plus a sha256-<hex> purchase-token hash only.",
    "- Do not start sandbox purchases while the hosted legal URL audit is failing or `STORE_APP_RECORD_ACTION_PACKET.json` is blocked before hosted legal URLs.",
    "",
    "## Hosted Legal URL Gate",
    "",
    toMarkdownTable(["Field", "Value"], hostedLegalGateRows(hostedLegalReadiness)),
    "",
    hostedLegalReadiness.hostedLegalUrlsVerified
      ? "Hosted legal URL entry has passed; sandbox QA can continue once product and backend prerequisites pass."
      : "Hosted legal URL entry is currently blocked. Do not begin store sandbox purchases until `/privacy`, `/support`, and `/account-deletion` pass hosted audit and this plan is regenerated.",
    "",
    "## Prerequisites",
    "",
    "- Hosted legal URL audit passes and the store app-record action packet no longer reports `blocked-before-hosted-legal-urls`.",
    "- `store-console-product-setup-report.template.json` has been filled from redacted App Store Connect, Google Play, and AdMob console evidence.",
    "- App Store sandbox testers and Play license testers can purchase without production charging.",
    "- The production env file has real Core 3 product IDs, platform AdMob app IDs, platform rewarded-unit IDs, and `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT` for `/api/purchases/verify`.",
    "- Product types match the launch catalog: yearly/monthly are recurring subscriptions, lifetime is non-consumable on App Store and one-time non-consumable on Play.",
    "- `npm run preflight:release-env -- --env-file <production-env-file>` passes and writes a sanitized report.",
    "- `npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json` passes against the deployed purchase endpoint.",
    "",
    "## Core 3 Sandbox Matrix",
    "",
    toMarkdownTable(
      [
        "Plan",
        "Apple Product ID",
        "Apple Type",
        "Apple Duration",
        "Apple Purchase Run",
        "Apple Restore Run",
        "Play Product ID",
        "Play Type",
        "Play Base Plan",
        "Play Billing/Purchase",
        "Play Purchase Run",
        "Play Restore Run",
        "Server Verify Run",
      ],
      productRows,
    ),
    "",
    `Every row must grant entitlement \`${entitlementId}\` only after server verification succeeds.`,
    "Do not proceed if the yearly/monthly rows are not subscriptions, or if lifetime is not a non-consumable / one-time product in the relevant store console.",
    "",
    "## Product Test Loop",
    "",
    "For each yearly, monthly, and lifetime row:",
    "",
    "1. Confirm the paywall shows only Core 3 products, yearly as the value anchor, restore visible, purchase buttons enabled, server-verification copy visible, and premium no-ad value visible.",
    "2. Run the App Store sandbox purchase in TestFlight or the signed sandbox build. Save a redacted local proof artifact and record only the numeric StoreKit transaction ID.",
    "3. Delete/reinstall or clear entitlement state as appropriate, then run App Store restore. Save the redacted restore proof and verified entitlement state.",
    "4. Run the Play Billing license-test purchase on Android. Save a redacted local proof artifact, the GPA order ID, and a sha256 hash label of the purchase token.",
    "5. Delete/reinstall or clear entitlement state as appropriate, then run Play restore. Save the redacted restore proof and verified entitlement state.",
    "6. Attach the sanitized `purchase-verification-smoke-v1` report for purchase and restore verification. It must include Core 3 yearly/monthly/lifetime PASS rows, endpoint validation, rejection-proof booleans, checked secret-key names, and no raw receipt/token/order/package echo.",
    "",
    "## Rewarded Ad And Intervention Flows",
    "",
    toMarkdownTable(["Flow", "Run ID", "Evidence Field", "Latency Requirement"], interventionRows),
    "",
    "Additional ad proof requirements:",
    "",
    "- `rewarded-ad-request-report.template.json` must be filled only after a real rewarded ad response loads with platform-specific production-format AdMob IDs.",
    "- The request must be non-personalized, use coarse country context only, and prove no banner, interstitial, app-open, or native ad unit was requested.",
    "- Free users must see a rewarded-ad gate before challenge entry.",
    "- Rewarded completion must grant challenge access only, not premium.",
    "- Ad failure must open the recovery challenge without a retry loop or punishment.",
    "- Premium users must skip rewarded ad requests and enter challenge mode within 3000 ms after entitlement verification.",
    "",
    "## Final Evidence Assembly",
    "",
    "- Copy `store-ad-sandbox-evidence-fill-template.json` into the draft evidence package only after all artifacts above are real and sanitized.",
    "- Set every `store.launchProductSandboxMatrix[]` purchase/restore/server-verification boolean to true only for products actually tested in both stores.",
    "- Keep `checks.storeConsoleProductsConfigured`, `checks.paywallCore3OnlyShown`, `checks.rewardedAdLoaded`, `checks.noInterstitialOrBannerAdsRequested`, `checks.premiumNoRewardedAdRequested`, and `checks.storePrivacyDisclosureReviewed` false until their local proof artifacts pass.",
    "- Validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence` before promotion.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildNotes(manifest) {
  const lines = [
    `# Store/Ad Sandbox Capture: ${manifest.runId}`,
    "",
    "This folder contains a sandbox QA plan. It does not satisfy release evidence by itself.",
    `Manifest boundary: \`${manifest.releaseBoundary}\``,
    `Evidence satisfied: \`${manifest.evidenceSatisfied}\``,
    "",
    "Never store these fields in evidence:",
    "",
    ...manifest.forbiddenSensitiveFields.map((field) => `- ${field}`),
    "",
    "Manual capture checklist:",
    "",
  ];
  for (const row of manifest.matrixRows) {
    lines.push(`- ${row.runId}: ${row.summary} Suggested artifact: \`${row.artifactField}\`. Metrics: \`${row.metricFields}\`.`);
  }
  lines.push(
    "",
    "`store-ad-sandbox-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret Core 3 product, entitlement, endpoint, ad-unit, and command context. It intentionally leaves artifacts/counts blank and checks false until real sandbox QA fills them.",
    "",
    "`STORE_CONSOLE_PAYMENT_HANDOFF.md` gives App Store Connect and Play Console operators the hosted legal URL gate, Core 3 launch products, future-SKU inactive boundary, required production env keys, and report commands for sandbox payment evidence.",
    "",
    "`STORE_CONSOLE_EXECUTION_RUNBOOK.md` gives the logged-in console operator the hosted legal URL gate, step-by-step App Store Connect, Google Play, and AdMob execution order, plus redacted evidence capture rules for the console product setup report.",
    "",
    "`STORE_SANDBOX_TEST_PLAN.md` gives QA the hosted legal URL gate, yearly/monthly/lifetime App Store and Play purchase/restore run matrix, purchase-verification report requirements, rewarded-ad proof requirements, and premium no-ad intervention checks before filling final evidence.",
    "",
    "`STORE_APP_RECORD_ACTION_PACKET.md` and `.json` give the exact draft app-record fields, action-time Browser confirmation token, Apple agreement prerequisite, and hard stops before any Play Console or App Store Connect app-record mutation.",
    "",
    "`ADMOB_ACTION_PACKET.md` and `.json` give the exact AdMob iOS/Android app plus rewarded reset unit setup order, action-time confirmation token, v1 rewarded-only boundary, production-env keys, and Android upload-signing blocker handoff before any AdMob console mutation. `ADMOB_ENV_PATCH.template.env` gives a blank paste-safe production env patch skeleton after the confirmed AdMob action.",
    "",
    "`paywall-launch-source-audit.json` is a local source precheck proving the current PaywallScreen uses the Core 3 launch plan API, shows store-verification/no-ad copy, and hides post-launch family/accountability/AI-coach products. It supports QA but does not replace the submitted-build `freed-paywall-launch-scope-report-v1` proof.",
    "",
    "The Core 3 launch-product matrix must cover yearly, monthly, and lifetime for App Store purchase/restore, Play purchase/restore, and server entitlement verification. Keep future family/accountability/AI-coach SKUs out of this v1 evidence.",
    "",
    "`rewarded-ad-request-report.template.json` gives QA the required local `freed-rewarded-ad-request-report-v1` shape for `store.rewardedAdRequestArtifact`; set `result=rewarded-ad-request-captured`, `rewardedAdRequestProofUsableForManualEvidence=true`, and every rewarded-only/privacy check to true only after the loaded ad response proves a real rewarded unit, non-personalized request mode, coarse country context, and no banner/interstitial/app-open/native ad request.",
    "",
    "`paywall-launch-scope-report.template.json` gives QA the required local `freed-paywall-launch-scope-report-v1` shape for `store.paywallLaunchScopeArtifact`; set `result=paywall-launch-scope-captured`, `paywallLaunchScopeProofUsableForManualEvidence=true`, and every paywall-scope check to true only after the submitted build shows Core 3 yearly/monthly/lifetime only, hides family/accountability/AI-coach products, presents yearly as the primary value anchor, exposes restore, and enables purchase buttons.",
    "",
    "`store-console-product-setup-report.template.json` gives QA the required local `freed-store-console-product-setup-report-v1` shape for `store.consoleProductSetupArtifact`; set `result=store-console-product-setup-captured`, `consoleProductSetupProofUsableForManualEvidence=true`, fill `appRecordReadiness` from a sanitized read-only Browser readiness report, fill the redacted console evidence artifacts with sanitized screenshot/report paths plus hashes, and set every console-product check to true only after App Store Connect and Play Console contain Core 3 products only, monthly/yearly subscriptions, lifetime one-time/non-consumable setup, screenshots/localizations, server-verification metadata, inactive future SKUs, and draft/internal/TestFlight-only status until evidence passes.",
    "",
    "`store-intervention-flow-report.templates.json` gives QA the required local `freed-store-intervention-flow-report-v1` shapes for free rewarded gate, rewarded completion, ad-failure fallback, and premium no-ad challenge entry artifacts.",
    "",
    "`store-privacy-disclosure-report.template.json` gives QA the required local `freed-store-privacy-disclosure-report-v1` shape for `store.privacyDisclosureArtifact`; set `result=privacy-disclosure-review-captured`, `privacyDisclosureProofUsableForManualEvidence=true`, and every privacy signal/check to true only after App Store and Play disclosures match the reviewed release behavior.",
    "",
    "After the real sandbox runs, fill `store-ad-sandbox.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only after every proof artifact exists and contains sanitized data.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function manifestFor(options, result = "capture-plan-created") {
  const rows = matrixRows(options);
  return {
    commandHandoff: {
      purchaseSmokeCommand: releaseCommand("smoke:purchase-verification", options.envFile),
      releasePreflightCommand: releaseCommand("preflight:release-env", options.envFile),
    },
    configured: configuredSummary(options),
    forbiddenSensitiveFields: FORBIDDEN_SENSITIVE_FIELDS,
    generatedAt: new Date().toISOString(),
    evidenceSatisfied: false,
    manualVerificationRequired: true,
    matrixRows: rows,
    releaseBoundary:
      "Store/ad sandbox capture packets are setup handoffs only. They do not prove console products, sandbox purchase/restore, production AdMob, rewarded-ad behavior, premium no-ad behavior, or privacy disclosure review until real QA fills and validates store-ad-sandbox.json.",
    releaseGate: "store-ad-sandbox-validation",
    releaseEnvFileLoaded: Boolean(options.releaseEnvFileLoaded),
    result,
    runId: options.runId,
    sanitized: true,
    sanitizedOnly: true,
    schema: "freed-store-ad-sandbox-capture-v1",
    schemaVersion: "freed-store-ad-sandbox-capture-v1",
  };
}

function buildLaunchProductSandboxMatrixTemplate(configured, prefix) {
  return LAUNCH_PREMIUM_PLAN_IDS.map((planId) => ({
    planId,
    iosProductId: configured.iosLaunchProductIds[planId],
    androidProductId: configured.androidLaunchProductIds[planId],
    iosPurchaseRunId: `${prefix}-ios-${planId}-purchase-sandbox`,
    iosPurchaseArtifact: "",
    iosRestoreRunId: `${prefix}-ios-${planId}-restore-sandbox`,
    iosRestoreArtifact: "",
    androidPurchaseRunId: `${prefix}-android-${planId}-purchase-sandbox`,
    androidPurchaseArtifact: "",
    androidRestoreRunId: `${prefix}-android-${planId}-restore-sandbox`,
    androidRestoreArtifact: "",
    purchaseVerificationRunId: `${prefix}-${planId}-purchase-verification-smoke`,
    purchaseVerificationArtifact: "",
    restoreVerificationRunId: `${prefix}-${planId}-restore-verification-smoke`,
    restoreVerificationArtifact: "",
    iosPurchaseSandbox: false,
    iosRestoreSandbox: false,
    androidPurchaseSandbox: false,
    androidRestoreSandbox: false,
    receiptOrEntitlementVerified: false,
    restoreEntitlementVerified: false,
  }));
}

function buildEvidenceFillTemplate(options, manifest) {
  const configured = configuredSummary(options);
  const prefix = options.runId;
  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    sanitizedOnly: true,
    instructions:
      "Copy this shape into store-ad-sandbox.json only after replacing blank fields with real sandbox artifacts, sanitized IDs, counts, and passing checks.",
    store: {
      storeProvider: configured.storeProvider,
      iosProductId: configured.iosProductId,
      androidProductId: configured.androidProductId,
      iosLaunchProductIds: configured.iosLaunchProductIds,
      androidLaunchProductIds: configured.androidLaunchProductIds,
      launchProductSandboxMatrix: buildLaunchProductSandboxMatrixTemplate(configured, prefix),
      paywallScopeRunId: `${prefix}-paywall-launch-scope`,
      paywallLaunchScopeArtifact: "path/to/local-freed-paywall-launch-scope-report-v1.json",
      consoleProductSetupRunId: `${prefix}-store-console-product-setup`,
      consoleProductSetupArtifact: "path/to/local-freed-store-console-product-setup-report-v1.json",
      purchaseVerifyEndpoint: configured.purchaseVerifyEndpoint,
      releasePreflightCommand: manifest.commandHandoff.releasePreflightCommand,
      releasePreflightRunId: `${prefix}-release-env-preflight`,
      releasePreflightArtifact: "",
      iosPurchaseRunId: `${prefix}-ios-purchase-sandbox`,
      iosPurchaseArtifact: "",
      iosPurchaseTransactionId: "",
      iosRestoreRunId: `${prefix}-ios-restore-sandbox`,
      iosRestoreArtifact: "",
      iosRestoreTransactionId: "",
      androidPurchaseRunId: `${prefix}-android-purchase-sandbox`,
      androidPurchaseArtifact: "",
      androidOrderId: "",
      androidRestoreRunId: `${prefix}-android-restore-sandbox`,
      androidRestoreArtifact: "",
      androidPurchaseTokenHash: "",
      entitlementId: configured.entitlementId,
      purchaseSmokeCommand: manifest.commandHandoff.purchaseSmokeCommand,
      purchaseVerificationReportId: `${prefix}-purchase-verification-smoke`,
      purchaseVerificationArtifact: "",
      purchaseVerificationPassCount: "",
      purchaseVerificationFailedCount: "",
      restoreVerificationReportId: `${prefix}-restore-verification-smoke`,
      restoreVerificationArtifact: "",
      restoreVerificationPassCount: "",
      restoreVerificationFailedCount: "",
      adMobAppIdAndroid: configured.adMobAppIdAndroid,
      adMobAppIdIos: configured.adMobAppIdIos,
      rewardedAdUnitId: configured.rewardedAdUnitId,
      rewardedAdUnitIdAndroid: configured.rewardedAdUnitIdAndroid,
      rewardedAdUnitIdIos: configured.rewardedAdUnitIdIos,
      rewardedAdFormat: "rewarded",
      rewardedAdResponseId: "",
      rewardedAdRequestArtifact: "path/to/local-freed-rewarded-ad-request-report-v1.json",
      noInterstitialOrBannerAdRequestsConfirmed: false,
      freeRewardedInterventionRunId: `${prefix}-free-rewarded-intervention`,
      freeRewardedInterventionArtifact: "path/to/local-freed-store-intervention-flow-report-v1.json",
      freePostAdChallengeLatencyMs: "",
      rewardedAdCompletionRunId: `${prefix}-rewarded-ad-completion`,
      rewardedAdCompletionArtifact: "path/to/local-freed-store-intervention-flow-report-v1.json",
      adFailureFallbackRunId: `${prefix}-ad-failure-fallback`,
      adFailureFallbackArtifact: "path/to/local-freed-store-intervention-flow-report-v1.json",
      premiumNoAdInterventionRunId: `${prefix}-premium-no-ad-intervention`,
      premiumNoAdInterventionArtifact: "path/to/local-freed-store-intervention-flow-report-v1.json",
      premiumNoRewardedAdRequested: false,
      premiumNoAdLatencyMs: "",
      adRequestNonPersonalized: false,
      adRequestCountryCode: configured.adRequestCountryCode,
      privacyDisclosureReviewId: `${prefix}-store-privacy-review`,
      privacyDisclosureArtifact: "path/to/local-freed-store-privacy-disclosure-report-v1.json",
    },
    checks: {
      iosPurchaseSandbox: false,
      iosRestoreSandbox: false,
      androidPurchaseSandbox: false,
      androidRestoreSandbox: false,
      releaseEnvPreflightPassed: false,
      purchaseVerificationSmokePassed: false,
      receiptOrEntitlementVerified: false,
      rewardedAdLoaded: false,
      rewardedOnlyAdFormat: false,
      rewardedAdNonPersonalizedRequest: false,
      rewardedAdCountryContextRecorded: false,
      noInterstitialOrBannerAdsRequested: false,
      storePrivacyDisclosureReviewed: false,
      paywallCore3OnlyShown: false,
      storeConsoleProductsConfigured: false,
      freeStreakRiskContextShown: false,
      freeRewardedAdBeforeChallenge: false,
      freePostAdChallengeGenerated: false,
      rewardedAdCompletionGrantsChallenge: false,
      adFailureFallbackUnlocksChallenge: false,
      premiumNoRewardedAdRequested: false,
      premiumNoAdInterventionStartsChallenge: false,
    },
  };
}

function fileSha256Label(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")}`;
}

function readJsonCatalog(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return {};
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function buildStoreConsoleProductSetupReportTemplate(options) {
  const pendingChecks = Object.fromEntries(
    STORE_CONSOLE_PRODUCT_SETUP_REQUIRED_CHECKS.map((check) => [check, false]),
  );
  const configured = configuredSummary(options);
  const catalog = readJsonCatalog("store/store-products.json");
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const sourceProofs = Object.fromEntries(
    STORE_CONSOLE_PRODUCT_SETUP_SOURCE_PROOFS.flatMap((sourceProof) => [
      [sourceProof.pathField, sourceProof.expectedPath],
      [sourceProof.hashField, fileSha256Label(sourceProof.expectedPath)],
    ]),
  );
  const appStoreProducts = products.map((product) => ({
    planId: product.planId,
    productId: product.apple?.productId ?? product.productId,
    productType: product.apple?.productType ?? product.appleType,
    referenceName: product.apple?.referenceName ?? product.displayName,
    subscriptionGroupId: product.apple?.subscriptionGroupId ?? null,
    duration: product.apple?.duration ?? "",
    priceUsdIntent: product.apple?.priceUsdIntent ?? product.priceUsd,
    reviewScreenshotPath: product.apple?.reviewScreenshot ?? "",
    reviewScreenshotHash: product.apple?.reviewScreenshot ? fileSha256Label(product.apple.reviewScreenshot) : "",
    localizationLocales: product.apple?.localizations ? Object.keys(product.apple.localizations) : [],
    consoleStatus: "pending-manual-console-setup",
    metadataConfigured: false,
    reviewScreenshotAttached: false,
    serverVerificationMetadataConfigured: false,
  }));
  const googlePlayProducts = products.map((product) => ({
    planId: product.planId,
    productId: product.google?.productId ?? product.productId,
    productType: product.google?.productType ?? product.googleType,
    basePlanId: product.google?.basePlanId ?? "",
    billingPeriod: product.google?.billingPeriod ?? "",
    offerId: product.google?.offerId ?? "",
    purchaseType: product.google?.purchaseType ?? "",
    priceUsdIntent: product.google?.priceUsdIntent ?? product.priceUsd,
    localizationLocales: product.google?.localizations ? Object.keys(product.google.localizations) : [],
    consoleStatus: "pending-manual-console-setup",
    metadataConfigured: false,
    serverVerificationMetadataConfigured: false,
  }));
  const buildConsoleEvidenceArtifacts = (platform) =>
    STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS[platform].map((screenId) => ({
      screenId,
      artifactPath: "",
      artifactHash: "",
      capturedAt: "",
      redacted: false,
      accountIdentifiersRedacted: false,
    }));
  const appRecordReadiness = {
    proofSource: "read-only-browser-console-readiness",
    browserReportPath: DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT,
    browserReportHash: fileSha256Label(DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT),
    browserReportSchemaVersion: STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION,
    browserReportRunId: "store-console-browser-current",
    readyForConsoleProductSetup: false,
    readOnlyBrowserInspection: false,
    storeMutationPerformed: false,
    accountIdentifiersRedacted: false,
    appIdentifiers: {
      appName: "FREED",
      bundleId: catalog.bundleId ?? "app.freed.recovery",
      packageName: catalog.packageName ?? "app.freed.recovery",
    },
    googlePlay: {
      consoleHost: "play.google.com",
      observedViaBrowser: false,
      appRecordPresent: false,
      packageName: catalog.packageName ?? "app.freed.recovery",
      productSetupAllowed: false,
    },
    appStoreConnect: {
      consoleHost: "appstoreconnect.apple.com",
      observedViaBrowser: false,
      appRecordPresent: false,
      bundleId: catalog.bundleId ?? "app.freed.recovery",
      licenseAgreementAccepted: false,
      productSetupAllowed: false,
    },
    checks: {
      browserReadinessReportCurrent: false,
      readOnlyBrowserInspection: false,
      noStoreMutationDuringBrowserCheck: false,
      accountIdentifiersRedacted: false,
      googlePlayAppRecordPresent: false,
      appStoreConnectAppRecordPresent: false,
      appStoreLicenseAgreementAccepted: false,
      bothPlatformsProductSetupAllowed: false,
    },
  };

  return {
    schemaVersion: STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION,
    templateStatus: "pending-manual-console-setup",
    sanitized: true,
    result: "pending-manual-console-setup",
    consoleProductSetupProofUsableForManualEvidence: false,
    setupRunId: `${options.runId}-store-console-product-setup`,
    suggestedEvidenceFields: ["store.consoleProductSetupArtifact"],
    ...sourceProofs,
    bundleId: catalog.bundleId ?? "app.freed.recovery",
    packageName: catalog.packageName ?? "app.freed.recovery",
    entitlementId: configured.entitlementId || catalog.entitlementId || "premium",
    subscriptionGroupId: catalog.subscriptionGroupId ?? "freed_premium",
    launchPlanIdsConfigured: LAUNCH_PREMIUM_PLAN_IDS,
    iosLaunchProductIdsConfigured: configured.iosLaunchProductIds,
    androidLaunchProductIdsConfigured: configured.androidLaunchProductIds,
    iosPostLaunchProductIdsInactive: configured.iosPostLaunchProductIds,
    androidPostLaunchProductIdsInactive: configured.androidPostLaunchProductIds,
    appRecordReadiness,
    appStoreConnect: {
      appRecordCreated: false,
      bundleId: catalog.bundleId ?? "app.freed.recovery",
      subscriptionGroupId: catalog.subscriptionGroupId ?? "freed_premium",
      consoleHost: "appstoreconnect.apple.com",
      consolePathRedacted: "/apps/redacted-app-id/appstore/in-app-purchases",
      consoleEvidenceArtifacts: buildConsoleEvidenceArtifacts("appStoreConnect"),
      launchProducts: appStoreProducts,
      futureProductIdsInactive: configured.iosPostLaunchProductIds,
      noExtraLaunchProductsActive: false,
      draftOrSandboxOnlyUntilEvidencePasses: false,
    },
    googlePlay: {
      appRecordCreated: false,
      packageName: catalog.packageName ?? "app.freed.recovery",
      consoleHost: "play.google.com",
      consolePathRedacted: "/console/u/redacted-user/developers/redacted-developer-id/app/redacted-app-id/monetization",
      consoleEvidenceArtifacts: buildConsoleEvidenceArtifacts("googlePlay"),
      launchProducts: googlePlayProducts,
      futureProductIdsInactive: configured.androidPostLaunchProductIds,
      noExtraLaunchProductsActive: false,
      draftOrSandboxOnlyUntilEvidencePasses: false,
    },
    checks: pendingChecks,
  };
}

function buildPrivacyDisclosureReportTemplate(options) {
  const pendingSignals = Object.fromEntries(
    STORE_PRIVACY_DISCLOSURE_REQUIRED_SIGNALS.map((signal) => [signal, false]),
  );
  return {
    schemaVersion: STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION,
    templateStatus: "pending-manual-review",
    sanitized: true,
    result: "pending-manual-review",
    privacyDisclosureProofUsableForManualEvidence: false,
    reviewId: `${options.runId}-store-privacy-review`,
    platformsReviewed: ["ios", "android"],
    reviewedStoreSurfaces: STORE_PRIVACY_DISCLOSURE_REQUIRED_SURFACES,
    suggestedEvidenceFields: ["store.privacyDisclosureArtifact"],
    privacyDataMapPath: "docs/privacy-data-map.md",
    privacyDataMapHash: fileSha256Label("docs/privacy-data-map.md"),
    iosReviewPackPath: "docs/store-policy/ios-screen-time-safari-dns-review.md",
    iosReviewPackHash: fileSha256Label("docs/store-policy/ios-screen-time-safari-dns-review.md"),
    androidPolicyPackPath: "docs/store-policy/android-accessibility-and-fgs-disclosure.md",
    androidPolicyPackHash: fileSha256Label("docs/store-policy/android-accessibility-and-fgs-disclosure.md"),
    signals: pendingSignals,
    checks: pendingSignals,
  };
}

function buildRewardedAdRequestReportTemplate(options) {
  const pendingChecks = Object.fromEntries(
    STORE_REWARDED_AD_REQUEST_REQUIRED_CHECKS.map((check) => [check, false]),
  );
  return {
    schemaVersion: STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION,
    templateStatus: "pending-manual-qa",
    sanitized: true,
    result: "pending-manual-qa",
    rewardedAdRequestProofUsableForManualEvidence: false,
    adMobAppIdAndroid: options.adMobAppIdAndroid,
    adMobAppIdIos: options.adMobAppIdIos,
    rewardedAdUnitId: options.rewardedAdUnitId,
    rewardedAdUnitIdAndroid: options.rewardedAdUnitIdAndroid,
    rewardedAdUnitIdIos: options.rewardedAdUnitIdIos,
    adFormat: "rewarded",
    rewardedAdResponseId: "",
    adRequestNonPersonalized: false,
    adRequestCountryCode: options.adRequestCountryCode,
    noInterstitialOrBannerAdRequestsConfirmed: false,
    suggestedEvidenceFields: ["store.rewardedAdRequestArtifact"],
    checks: pendingChecks,
  };
}

function buildPaywallLaunchScopeReportTemplate(options, sourceAuditArtifact = "") {
  const pendingChecks = Object.fromEntries(
    STORE_PAYWALL_LAUNCH_SCOPE_REQUIRED_CHECKS.map((check) => [check, false]),
  );
  const configured = configuredSummary(options);
  return {
    schemaVersion: STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION,
    templateStatus: "pending-manual-qa",
    sanitized: true,
    result: "pending-manual-qa",
    paywallLaunchScopeProofUsableForManualEvidence: false,
    runId: `${options.runId}-paywall-launch-scope`,
    suggestedEvidenceFields: ["store.paywallLaunchScopeArtifact"],
    paywallSourcePath: "src/features/freed-app.tsx",
    paywallSourceHash: fileSha256Label("src/features/freed-app.tsx"),
    monetizationSourcePath: "src/lib/monetization.ts",
    monetizationSourceHash: fileSha256Label("src/lib/monetization.ts"),
    paywallLaunchSourceAuditArtifact: sourceAuditArtifact,
    paywallLaunchSourceAuditSchemaVersion: "freed-paywall-launch-source-audit-v1",
    launchPlanIdsShown: LAUNCH_PREMIUM_PLAN_IDS,
    iosLaunchProductIdsShown: configured.iosLaunchProductIds,
    androidLaunchProductIdsShown: configured.androidLaunchProductIds,
    postLaunchPlanIdsHidden: POST_LAUNCH_PREMIUM_PLAN_IDS,
    iosPostLaunchProductIdsHidden: configured.iosPostLaunchProductIds,
    androidPostLaunchProductIdsHidden: configured.androidPostLaunchProductIds,
    primaryValuePlanId: "yearly",
    restorePurchasesVisible: false,
    purchaseButtonsEnabled: false,
    yearlyValueAnchorVisible: false,
    checks: pendingChecks,
  };
}

function buildInterventionFlowReportTemplate(options, config) {
  const pendingChecks = Object.fromEntries(config.checks.map((check) => [check, false]));
  const template = {
    schemaVersion: STORE_INTERVENTION_FLOW_SCHEMA_VERSION,
    templateStatus: "pending-manual-qa",
    sanitized: true,
    result: "pending-manual-qa",
    interventionFlowProofUsableForManualEvidence: false,
    flowType: config.flowType,
    runId: config.runId(options.runId),
    suggestedEvidenceFields: [config.artifactField],
    checks: pendingChecks,
  };
  if (config.latencyField) {
    template.latencyMs = "";
    template.latencyField = `store.${config.latencyField}`;
    template.maxLatencyMs = config.maxLatencyMs;
  }
  if (config.flowType === "free-rewarded-intervention") {
    template.rewardedAdRequested = false;
    template.premiumEntitlementActive = "";
  }
  if (config.flowType === "rewarded-ad-completion") {
    template.rewardedAdCompleted = false;
    template.challengeAccessGranted = false;
  }
  if (config.flowType === "ad-failure-fallback") {
    template.adFailureObserved = false;
    template.challengeAccessGranted = false;
    template.retryLoopRequired = true;
  }
  if (config.flowType === "premium-no-ad-intervention") {
    template.premiumEntitlementActive = false;
    template.rewardedAdRequested = true;
  }
  return template;
}

function buildInterventionFlowReportTemplates(options) {
  return {
    schemaVersion: "freed-store-intervention-flow-report-templates-v1",
    sanitized: true,
    templateStatus: "pending-manual-qa",
    artifactSchemaVersion: STORE_INTERVENTION_FLOW_SCHEMA_VERSION,
    templates: Object.fromEntries(
      STORE_INTERVENTION_FLOW_CONFIGS.map((config) => [
        config.artifactField,
        buildInterventionFlowReportTemplate(options, config),
      ]),
    ),
  };
}

function capture(options) {
  const manifest = manifestFor(options, options.planOnly ? "plan-only" : "capture-plan-created");
  if (options.planOnly) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  const matrixPath = path.join(options.outputDir, "store-ad-sandbox-matrix.csv");
  const evidenceFillTemplatePath = path.join(options.outputDir, "store-ad-sandbox-evidence-fill-template.json");
  const rewardedAdRequestTemplatePath = path.join(options.outputDir, "rewarded-ad-request-report.template.json");
  const paywallLaunchScopeTemplatePath = path.join(options.outputDir, "paywall-launch-scope-report.template.json");
  const paywallLaunchSourceAuditPath = path.join(options.outputDir, "paywall-launch-source-audit.json");
  const consoleProductSetupTemplatePath = path.join(options.outputDir, "store-console-product-setup-report.template.json");
  const interventionFlowTemplatePath = path.join(options.outputDir, "store-intervention-flow-report.templates.json");
  const privacyDisclosureTemplatePath = path.join(options.outputDir, "store-privacy-disclosure-report.template.json");
  const consolePaymentHandoffPath = path.join(options.outputDir, "STORE_CONSOLE_PAYMENT_HANDOFF.md");
  const consoleExecutionRunbookPath = path.join(options.outputDir, "STORE_CONSOLE_EXECUTION_RUNBOOK.md");
  const storeSandboxTestPlanPath = path.join(options.outputDir, "STORE_SANDBOX_TEST_PLAN.md");
  const storeAppRecordActionPacketPath = path.join(options.outputDir, "STORE_APP_RECORD_ACTION_PACKET.json");
  const storeAppRecordActionPacketMarkdownPath = path.join(options.outputDir, "STORE_APP_RECORD_ACTION_PACKET.md");
  const adMobActionPacketPath = path.join(options.outputDir, "ADMOB_ACTION_PACKET.json");
  const adMobActionPacketMarkdownPath = path.join(options.outputDir, "ADMOB_ACTION_PACKET.md");
  const adMobEnvPatchTemplatePath = path.join(options.outputDir, ADMOB_ENV_PATCH_TEMPLATE_NAME);
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  const storeAppRecordActionPacket = buildStoreAppRecordActionPacket(options, manifest);
  const adMobActionPacket = buildAdMobActionPacket(options, manifest);
  writeTextArtifact(matrixPath, toStoreSandboxMatrixCsv(options, manifest));
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
  writeJsonArtifact(rewardedAdRequestTemplatePath, buildRewardedAdRequestReportTemplate(options));
  writeJsonArtifact(paywallLaunchSourceAuditPath, buildPaywallLaunchSourceAuditReport());
  writeJsonArtifact(
    paywallLaunchScopeTemplatePath,
    buildPaywallLaunchScopeReportTemplate(options, repoRelative(paywallLaunchSourceAuditPath)),
  );
  writeJsonArtifact(consoleProductSetupTemplatePath, buildStoreConsoleProductSetupReportTemplate(options));
  writeJsonArtifact(interventionFlowTemplatePath, buildInterventionFlowReportTemplates(options));
  writeJsonArtifact(privacyDisclosureTemplatePath, buildPrivacyDisclosureReportTemplate(options));
  writeTextArtifact(consolePaymentHandoffPath, buildConsolePaymentHandoff(options, manifest));
  writeTextArtifact(consoleExecutionRunbookPath, buildStoreConsoleExecutionRunbook(options, manifest));
  writeTextArtifact(storeSandboxTestPlanPath, buildStoreSandboxTestPlan(options, manifest));
  writeJsonArtifact(storeAppRecordActionPacketPath, storeAppRecordActionPacket);
  writeTextArtifact(storeAppRecordActionPacketMarkdownPath, buildStoreAppRecordActionPacketMarkdown(storeAppRecordActionPacket));
  writeJsonArtifact(adMobActionPacketPath, adMobActionPacket);
  writeTextArtifact(adMobActionPacketMarkdownPath, buildAdMobActionPacketMarkdown(adMobActionPacket));
  writeTextArtifact(adMobEnvPatchTemplatePath, buildAdMobEnvPatchTemplate(adMobActionPacket));
  writeJsonArtifact(manifestPath, {
    ...manifest,
    evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
    rewardedAdRequestTemplateArtifact: repoRelative(rewardedAdRequestTemplatePath),
    paywallLaunchScopeTemplateArtifact: repoRelative(paywallLaunchScopeTemplatePath),
    paywallLaunchSourceAuditArtifact: repoRelative(paywallLaunchSourceAuditPath),
    consoleProductSetupTemplateArtifact: repoRelative(consoleProductSetupTemplatePath),
    interventionFlowTemplateArtifact: repoRelative(interventionFlowTemplatePath),
    privacyDisclosureTemplateArtifact: repoRelative(privacyDisclosureTemplatePath),
    consolePaymentHandoffArtifact: repoRelative(consolePaymentHandoffPath),
    consoleExecutionRunbookArtifact: repoRelative(consoleExecutionRunbookPath),
    storeSandboxTestPlanArtifact: repoRelative(storeSandboxTestPlanPath),
    storeAppRecordActionPacketArtifact: repoRelative(storeAppRecordActionPacketPath),
    storeAppRecordActionPacketMarkdownArtifact: repoRelative(storeAppRecordActionPacketMarkdownPath),
    adMobActionPacketArtifact: repoRelative(adMobActionPacketPath),
    adMobActionPacketMarkdownArtifact: repoRelative(adMobActionPacketMarkdownPath),
    adMobEnvPatchTemplateArtifact: repoRelative(adMobEnvPatchTemplatePath),
    matrixArtifact: repoRelative(matrixPath),
  });
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        matrixArtifact: repoRelative(matrixPath),
        notesArtifact: repoRelative(notesPath),
        consolePaymentHandoffArtifact: repoRelative(consolePaymentHandoffPath),
        consoleExecutionRunbookArtifact: repoRelative(consoleExecutionRunbookPath),
        storeSandboxTestPlanArtifact: repoRelative(storeSandboxTestPlanPath),
        storeAppRecordActionPacketArtifact: repoRelative(storeAppRecordActionPacketPath),
        storeAppRecordActionPacketMarkdownArtifact: repoRelative(storeAppRecordActionPacketMarkdownPath),
        adMobActionPacketArtifact: repoRelative(adMobActionPacketPath),
        adMobActionPacketMarkdownArtifact: repoRelative(adMobActionPacketMarkdownPath),
        adMobEnvPatchTemplateArtifact: repoRelative(adMobEnvPatchTemplatePath),
        rewardedAdRequestTemplateArtifact: repoRelative(rewardedAdRequestTemplatePath),
        paywallLaunchScopeTemplateArtifact: repoRelative(paywallLaunchScopeTemplatePath),
        paywallLaunchSourceAuditArtifact: repoRelative(paywallLaunchSourceAuditPath),
        consoleProductSetupTemplateArtifact: repoRelative(consoleProductSetupTemplatePath),
        interventionFlowTemplateArtifact: repoRelative(interventionFlowTemplatePath),
        privacyDisclosureTemplateArtifact: repoRelative(privacyDisclosureTemplatePath),
      },
      null,
      2,
    ),
  );
}

function runSelfTest() {
  assert.equal(safeRunId("store-ad-2026-05-15"), "store-ad-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  assert.equal(isSafeEnvFilePath("secrets/prod.env"), true);
  assert.equal(isSafeEnvFilePath(".env.production.example"), false);
  assert.equal(isSafeEnvFilePath("https://example.com/env"), false);
  assert.throws(() => parseArgs(["--release-env-file", "docs/validation/evidence/prod.env"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--release-env-file", "docs/validation/artifacts/run/prod.env"]), /docs\/validation\/artifacts/);
  const envRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-store-ad-env-"));
  try {
    const malformedEnv = path.join(envRoot, "malformed.env");
    const duplicateEnv = path.join(envRoot, "duplicate.env");
    fs.writeFileSync(malformedEnv, ["GOOD=value", "# spacer", "", "MISSING_EQUALS"].join("\n"));
    fs.writeFileSync(duplicateEnv, ["GOOD=value", "# spacer", "", "GOOD=again"].join("\n"));
    assert.throws(() => parseArgs(["--release-env-file", malformedEnv]), /--release-env-file line 4 must use KEY=value syntax/);
    assert.throws(() => parseArgs(["--release-env-file", duplicateEnv]), /--release-env-file line 4 repeats GOOD from line 1/);
  } finally {
    fs.rmSync(envRoot, { recursive: true, force: true });
  }
  assert.throws(() => parseArgs(["--ad-request-country-code", "ZZ"]));
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "http://api.freedrecovery.app/api/purchases/verify"]),
    /https/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://192.168.1.10/api/purchases/verify"]),
    /private|reserved/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://api.freedrecovery.app"]),
    /concrete route path/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://api.freedrecovery.app/api/store/verify"]),
    /\/api\/purchases\/verify/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://user:pass@api.freedrecovery.app/api/purchases/verify"]),
    /URL credentials/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://api.freedrecovery.app/api/purchases/verify?token=secret"]),
    /query strings/,
  );
  assert.throws(
    () => parseArgs(["--purchase-verify-endpoint", "https://api.freedrecovery.app/api/purchases/verify#access_token=secret"]),
    /URL fragments/,
  );
  assert.throws(() => parseArgs(["--rewarded-ad-unit-id", "google-mobile-ads-test-rewarded"]), /production-format/);
  assert.throws(
    () => parseArgs(["--rewarded-ad-unit-id", "ca-app-pub-3940256099942544/1712485313"]),
    /Google sample publisher/,
  );
  assert.throws(() => parseArgs(["--admob-app-id-ios", "google-mobile-ads-test-app"]), /production-format/);
  assert.throws(
    () => parseArgs(["--admob-app-id-android", "ca-app-pub-3940256099942544~3347511713"]),
    /Google sample publisher/,
  );
  assert.throws(
    () => parseArgs(["--rewarded-ad-unit-id-android", "ca-app-pub-3940256099942544/5224354917"]),
    /Google sample publisher/,
  );
  assert.equal(releaseCommand("preflight:release-env", "secrets/prod.env"), "npm run preflight:release-env -- --env-file secrets/prod.env");
  assert.equal(
    releaseCommand("preflight:release-env", path.join(os.homedir(), ".freed", "android-upload", "freed-upload.env")),
    "npm run preflight:release-env -- --env-file ~/.freed/android-upload/freed-upload.env",
  );

  const options = {
    adRequestCountryCode: "US",
    adMobAppIdAndroid: "ca-app-pub-2234567890123456~1234567890",
    adMobAppIdIos: "ca-app-pub-1234567890123456~1234567890",
    androidLaunchProductIds: DEFAULT_LAUNCH_PRODUCT_IDS,
    androidPostLaunchProductIds: DEFAULT_POST_LAUNCH_PRODUCT_IDS,
    androidProductId: "freed_premium_yearly",
    entitlementId: "premium",
    envFile: "secrets/prod.env",
    iosLaunchProductIds: DEFAULT_LAUNCH_PRODUCT_IDS,
    iosPostLaunchProductIds: DEFAULT_POST_LAUNCH_PRODUCT_IDS,
    iosProductId: "freed_premium_yearly",
    purchaseVerifyEndpoint: "https://api.freedrecovery.app/api/purchases/verify",
    rewardedAdUnitId: "ca-app-pub-1234567890123456/1234567890",
    rewardedAdUnitIdAndroid: "ca-app-pub-2234567890123456/1234567890",
    rewardedAdUnitIdIos: "ca-app-pub-1234567890123456/1234567890",
    runId: "self-test",
    storeProvider: "native-iap",
  };
  const manifest = manifestFor(options, "self-test");
  assert.equal(manifest.matrixRows.length, 15);
  assert.equal(manifest.sanitized, true);
  assert.equal(manifest.sanitizedOnly, true);
  assert.equal(manifest.evidenceSatisfied, false);
  assert.match(manifest.releaseBoundary, /setup handoffs only/);
  assert.ok(manifest.forbiddenSensitiveFields.includes("androidPurchaseToken"));
  assert.ok(!JSON.stringify(manifest.matrixRows).includes("rawReceipt"));
  assert.match(JSON.stringify(manifest.matrixRows), /store\.restoreVerificationArtifact/);
  assert.match(toCsv(manifest.matrixRows), /pending-manual-qa/);
  const storeSandboxMatrixCsv = toStoreSandboxMatrixCsv(options, manifest);
  assert.match(storeSandboxMatrixCsv, /rowType,planId,appleProductId,appleProductType/);
  assert.match(storeSandboxMatrixCsv, /playProductType,playBasePlan,playBillingOrPurchase/);
  assert.match(storeSandboxMatrixCsv, /launch-product-sandbox,yearly,freed_premium_yearly,auto-renewable-subscription,P1Y/);
  assert.match(storeSandboxMatrixCsv, /launch-product-sandbox,monthly,freed_premium_monthly,auto-renewable-subscription,P1M/);
  assert.match(storeSandboxMatrixCsv, /launch-product-sandbox,lifetime,freed_premium_lifetime,non-consumable,lifetime/);
  assert.match(storeSandboxMatrixCsv, /subscription,yearly,P1Y/);
  assert.match(storeSandboxMatrixCsv, /subscription,monthly,P1M/);
  assert.match(storeSandboxMatrixCsv, /one-time-product,,non-consumable/);
  assert.match(storeSandboxMatrixCsv, /manual-flow,,,,,,,,,,,,,,self-test-release-env-preflight/);
  const captureNotes = buildNotes(manifest);
  assert.match(captureNotes, /Evidence satisfied: `false`/);
  const fillTemplate = buildEvidenceFillTemplate(options, manifest);
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.store.releasePreflightCommand, "npm run preflight:release-env -- --env-file secrets/prod.env");
  assert.equal(fillTemplate.store.purchaseSmokeCommand, "npm run smoke:purchase-verification -- --env-file secrets/prod.env");
  assert.equal(fillTemplate.store.restoreVerificationReportId, "self-test-restore-verification-smoke");
  assert.equal(fillTemplate.store.paywallScopeRunId, "self-test-paywall-launch-scope");
  assert.equal(fillTemplate.store.paywallLaunchScopeArtifact, "path/to/local-freed-paywall-launch-scope-report-v1.json");
  assert.equal(fillTemplate.store.consoleProductSetupRunId, "self-test-store-console-product-setup");
  assert.equal(fillTemplate.store.consoleProductSetupArtifact, "path/to/local-freed-store-console-product-setup-report-v1.json");
  assert.equal(fillTemplate.store.adMobAppIdIos, "ca-app-pub-1234567890123456~1234567890");
  assert.equal(fillTemplate.store.adMobAppIdAndroid, "ca-app-pub-2234567890123456~1234567890");
  assert.equal(fillTemplate.store.rewardedAdUnitId, "ca-app-pub-1234567890123456/1234567890");
  assert.equal(fillTemplate.store.rewardedAdUnitIdIos, "ca-app-pub-1234567890123456/1234567890");
  assert.equal(fillTemplate.store.rewardedAdUnitIdAndroid, "ca-app-pub-2234567890123456/1234567890");
  assert.deepEqual(fillTemplate.store.iosLaunchProductIds, DEFAULT_LAUNCH_PRODUCT_IDS);
  assert.deepEqual(fillTemplate.store.androidLaunchProductIds, DEFAULT_LAUNCH_PRODUCT_IDS);
  assert.deepEqual(
    fillTemplate.store.launchProductSandboxMatrix.map((entry) => entry.planId),
    LAUNCH_PREMIUM_PLAN_IDS,
  );
  assert.equal(fillTemplate.store.launchProductSandboxMatrix[0].iosProductId, "freed_premium_yearly");
  assert.equal(fillTemplate.store.launchProductSandboxMatrix[1].androidProductId, "freed_premium_monthly");
  assert.equal(fillTemplate.store.launchProductSandboxMatrix[2].receiptOrEntitlementVerified, false);
  assert.equal(fillTemplate.store.rewardedAdFormat, "rewarded");
  assert.equal(fillTemplate.store.rewardedAdRequestArtifact, "path/to/local-freed-rewarded-ad-request-report-v1.json");
  assert.equal(fillTemplate.store.noInterstitialOrBannerAdRequestsConfirmed, false);
  assert.equal(fillTemplate.store.freeRewardedInterventionArtifact, "path/to/local-freed-store-intervention-flow-report-v1.json");
  assert.equal(fillTemplate.store.rewardedAdCompletionArtifact, "path/to/local-freed-store-intervention-flow-report-v1.json");
  assert.equal(fillTemplate.store.adFailureFallbackArtifact, "path/to/local-freed-store-intervention-flow-report-v1.json");
  assert.equal(fillTemplate.store.premiumNoAdInterventionArtifact, "path/to/local-freed-store-intervention-flow-report-v1.json");
  assert.equal(fillTemplate.store.premiumNoRewardedAdRequested, false);
  assert.equal(fillTemplate.store.adRequestNonPersonalized, false);
  assert.equal(fillTemplate.store.privacyDisclosureArtifact, "path/to/local-freed-store-privacy-disclosure-report-v1.json");
  assert.equal(fillTemplate.checks.iosPurchaseSandbox, false);
  assert.equal(fillTemplate.checks.rewardedOnlyAdFormat, false);
  assert.equal(fillTemplate.checks.noInterstitialOrBannerAdsRequested, false);
  assert.equal(fillTemplate.checks.paywallCore3OnlyShown, false);
  assert.equal(fillTemplate.checks.storeConsoleProductsConfigured, false);
  assert.equal(fillTemplate.checks.premiumNoRewardedAdRequested, false);
  assert.equal(JSON.stringify(fillTemplate).includes("rawReceipt"), false);
  const consolePaymentHandoff = buildConsolePaymentHandoff(options, manifest);
  assert.match(consolePaymentHandoff, /Hosted Legal URL Gate/);
  assert.match(consolePaymentHandoff, /blocked-before-hosted-legal-urls/);
  assert.match(consolePaymentHandoff, /Store legal URL entry allowed/);
  assert.match(consolePaymentHandoff, /Core 3 Launch Products/);
  assert.match(consolePaymentHandoff, /freed_premium_yearly/);
  assert.match(consolePaymentHandoff, /freed_premium_monthly/);
  assert.match(consolePaymentHandoff, /freed_premium_lifetime/);
  assert.match(consolePaymentHandoff, /Future SKUs Inactive/);
  assert.match(consolePaymentHandoff, /freed_family_yearly/);
  assert.match(consolePaymentHandoff, /freed_accountability_monthly/);
  assert.match(consolePaymentHandoff, /freed_ai_coach_monthly/);
  assert.match(consolePaymentHandoff, /EXPO_PUBLIC_ADMOB_APP_ID_IOS/);
  assert.match(consolePaymentHandoff, /EXPO_PUBLIC_ADMOB_APP_ID_ANDROID/);
  assert.match(consolePaymentHandoff, /EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS/);
  assert.match(consolePaymentHandoff, /EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID/);
  assert.equal(consolePaymentHandoff.includes("FREED_REWARDED_AD_UNIT_ID |"), false);
  assert.match(consolePaymentHandoff, /Do not submit production/);
  assert.match(consolePaymentHandoff, /npm run preflight:release-env -- --env-file secrets\/prod\.env --report docs\/validation\/artifacts\/self-test\/release-env-preflight-report\.json/);
  assert.match(consolePaymentHandoff, /npm run smoke:purchase-verification -- --env-file secrets\/prod\.env --report docs\/validation\/artifacts\/self-test\/purchase-verification-smoke-report\.json/);
  assert.match(consolePaymentHandoff, /npm run evidence:store-ad-sandbox -- --release-env-file secrets\/prod\.env --run-id self-test --output-dir docs\/validation\/artifacts\/self-test\/store-ad-sandbox-capture/);
  assert.equal(consolePaymentHandoff.includes("rawReceipt"), false);
  assert.equal(consolePaymentHandoff.includes("androidPurchaseToken"), false);
  const consoleExecutionRunbook = buildStoreConsoleExecutionRunbook(options, manifest);
  assert.match(consoleExecutionRunbook, /Store Console Execution Runbook: self-test/);
  assert.match(consoleExecutionRunbook, /Hosted Legal URL Gate/);
  assert.match(consoleExecutionRunbook, /blocked-before-hosted-legal-urls/);
  assert.match(consoleExecutionRunbook, /Store legal URL entry allowed/);
  assert.match(consoleExecutionRunbook, /App Store Connect Execution/);
  assert.match(consoleExecutionRunbook, /Google Play Console Execution/);
  assert.match(consoleExecutionRunbook, /AdMob Execution/);
  assert.match(consoleExecutionRunbook, /freed_premium_yearly/);
  assert.match(consoleExecutionRunbook, /store-console-product-setup-report\.template\.json/);
  assert.match(consoleExecutionRunbook, /Submit for Review/);
  assert.match(consoleExecutionRunbook, /redacted=true/);
  assert.match(consoleExecutionRunbook, /EXPO_PUBLIC_ADMOB_APP_ID_ANDROID/);
  assert.equal(consoleExecutionRunbook.includes("rawReceipt"), false);
  assert.equal(consoleExecutionRunbook.includes("androidPurchaseToken"), false);
  const sandboxTestPlan = buildStoreSandboxTestPlan(options, manifest);
  assert.match(sandboxTestPlan, /Store Sandbox Test Plan: self-test/);
  assert.match(sandboxTestPlan, /Hosted Legal URL Gate/);
  assert.match(sandboxTestPlan, /blocked-before-hosted-legal-urls/);
  assert.match(sandboxTestPlan, /Store legal URL entry allowed/);
  assert.match(sandboxTestPlan, /Core 3 Sandbox Matrix/);
  assert.match(sandboxTestPlan, /Apple Type/);
  assert.match(sandboxTestPlan, /Play Type/);
  assert.match(sandboxTestPlan, /Play Billing\/Purchase/);
  assert.match(sandboxTestPlan, /auto-renewable-subscription/);
  assert.match(sandboxTestPlan, /non-consumable/);
  assert.match(sandboxTestPlan, /one-time-product/);
  assert.match(sandboxTestPlan, /yearly\/monthly rows are not subscriptions/);
  assert.match(sandboxTestPlan, /lifetime is not a non-consumable \/ one-time product/);
  assert.match(sandboxTestPlan, /self-test-ios-yearly-purchase-sandbox/);
  assert.match(sandboxTestPlan, /self-test-android-monthly-restore-sandbox/);
  assert.match(sandboxTestPlan, /freed_premium_lifetime/);
  assert.match(sandboxTestPlan, /purchase-verification-smoke-v1/);
  assert.match(sandboxTestPlan, /premium-no-ad-intervention/);
  assert.match(sandboxTestPlan, /sha256-<hex>/);
  assert.equal(sandboxTestPlan.includes("rawReceipt"), false);
  assert.equal(sandboxTestPlan.includes("androidPurchaseToken"), false);
  const paywallTemplate = buildPaywallLaunchScopeReportTemplate(options);
  assert.equal(paywallTemplate.schemaVersion, STORE_PAYWALL_LAUNCH_SCOPE_SCHEMA_VERSION);
  assert.equal(paywallTemplate.sanitized, true);
  assert.equal(paywallTemplate.paywallLaunchScopeProofUsableForManualEvidence, false);
  assert.deepEqual(paywallTemplate.launchPlanIdsShown, LAUNCH_PREMIUM_PLAN_IDS);
  assert.equal(paywallTemplate.primaryValuePlanId, "yearly");
  assert.equal(paywallTemplate.iosPostLaunchProductIdsHidden.family, "freed_family_yearly");
  assert.equal(paywallTemplate.checks.core3PlanIdsVisible, false);
  assert.match(JSON.stringify(paywallTemplate), /store\.paywallLaunchScopeArtifact/);
  const paywallTemplateWithSourceAudit = buildPaywallLaunchScopeReportTemplate(
    options,
    "docs/validation/artifacts/self-test/store-ad-sandbox-capture/paywall-launch-source-audit.json",
  );
  assert.equal(
    paywallTemplateWithSourceAudit.paywallLaunchSourceAuditArtifact,
    "docs/validation/artifacts/self-test/store-ad-sandbox-capture/paywall-launch-source-audit.json",
  );
  const paywallSourceAudit = buildPaywallLaunchSourceAuditReport();
  assert.equal(paywallSourceAudit.schemaVersion, "freed-paywall-launch-source-audit-v1");
  assert.equal(paywallSourceAudit.sanitized, true);
  assert.equal(paywallSourceAudit.result, "pass");
  assert.ok(paywallSourceAudit.checks.some((check) => check.id === "paywall-future-products-hidden"));
  const consoleProductSetupTemplate = buildStoreConsoleProductSetupReportTemplate(options);
  assert.equal(consoleProductSetupTemplate.schemaVersion, STORE_CONSOLE_PRODUCT_SETUP_SCHEMA_VERSION);
  assert.equal(consoleProductSetupTemplate.sanitized, true);
  assert.equal(consoleProductSetupTemplate.consoleProductSetupProofUsableForManualEvidence, false);
  assert.equal(consoleProductSetupTemplate.setupRunId, "self-test-store-console-product-setup");
  assert.deepEqual(consoleProductSetupTemplate.launchPlanIdsConfigured, LAUNCH_PREMIUM_PLAN_IDS);
  assert.equal(consoleProductSetupTemplate.subscriptionGroupId, "freed_premium");
  assert.equal(consoleProductSetupTemplate.appStoreConnect.launchProducts.length, 3);
  assert.deepEqual(
    consoleProductSetupTemplate.appStoreConnect.launchProducts.map((product) => product.planId),
    LAUNCH_PREMIUM_PLAN_IDS,
  );
  assert.deepEqual(
    consoleProductSetupTemplate.googlePlay.launchProducts.map((product) => product.planId),
    LAUNCH_PREMIUM_PLAN_IDS,
  );
  assert.equal(consoleProductSetupTemplate.appStoreConnect.launchProducts[0].reviewScreenshotPath, "store/screenshots/paywall-yearly.png");
  assert.equal(consoleProductSetupTemplate.googlePlay.launchProducts[0].basePlanId, "yearly");
  assert.equal(consoleProductSetupTemplate.googlePlay.launchProducts[1].basePlanId, "monthly");
  assert.equal(
    consoleProductSetupTemplate.appRecordReadiness.browserReportPath,
    DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT,
  );
  assert.equal(
    consoleProductSetupTemplate.appRecordReadiness.browserReportSchemaVersion,
    STORE_CONSOLE_BROWSER_READINESS_SCHEMA_VERSION,
  );
  assert.equal(consoleProductSetupTemplate.appRecordReadiness.readyForConsoleProductSetup, false);
  assert.equal(consoleProductSetupTemplate.appRecordReadiness.checks.googlePlayAppRecordPresent, false);
  assert.equal(consoleProductSetupTemplate.appRecordReadiness.checks.appStoreLicenseAgreementAccepted, false);
  assert.equal(consoleProductSetupTemplate.appStoreConnect.consoleHost, "appstoreconnect.apple.com");
  assert.equal(consoleProductSetupTemplate.googlePlay.consoleHost, "play.google.com");
  assert.deepEqual(
    consoleProductSetupTemplate.appStoreConnect.consoleEvidenceArtifacts.map((artifact) => artifact.screenId),
    STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS.appStoreConnect,
  );
  assert.deepEqual(
    consoleProductSetupTemplate.googlePlay.consoleEvidenceArtifacts.map((artifact) => artifact.screenId),
    STORE_CONSOLE_PRODUCT_SETUP_EVIDENCE_SCREENS.googlePlay,
  );
  assert.equal(consoleProductSetupTemplate.checks.consoleEvidenceArtifactsCaptured, false);
  assert.equal(consoleProductSetupTemplate.checks.core3ProductsCreated, false);
  assert.match(JSON.stringify(consoleProductSetupTemplate), /store\.consoleProductSetupArtifact/);
  const appRecordActionPacket = buildStoreAppRecordActionPacket(options, manifest);
  assert.equal(appRecordActionPacket.schemaVersion, STORE_APP_RECORD_ACTION_PACKET_SCHEMA_VERSION);
  assert.equal(appRecordActionPacket.sanitized, true);
  assert.equal(appRecordActionPacket.result, "blocked-before-hosted-legal-urls");
  assert.equal(appRecordActionPacket.hostedLegalReadiness.hostedLegalUrlsVerified, false);
  assert.equal(appRecordActionPacket.externalMutationBoundary.hostedLegalAuditRequiredBeforeUrlEntry, true);
  assert.equal(appRecordActionPacket.externalMutationBoundary.legalUrlEntryAllowed, false);
  assert.equal(appRecordActionPacket.externalMutationBoundary.actionTimeConfirmationRequired, true);
  assert.equal(appRecordActionPacket.externalMutationBoundary.confirmationToken, "confirm-draft-store-app-record-creation-only");
  assert.equal(appRecordActionPacket.requiredActionOrder[0].stepId, "hosted-legal-url-validation");
  assert.equal(appRecordActionPacket.googlePlayAppRecordPayload.legalUrlEntryAllowed, false);
  assert.equal(appRecordActionPacket.appStoreConnectAppRecordPayload.legalUrlEntryAllowed, false);
  assert.equal(appRecordActionPacket.checks.blocksLegalUrlEntryUntilHostedLegalPasses, true);
  assert.equal(appRecordActionPacket.googlePlayAppRecordPayload.fields.packageName, "app.freed.recovery");
  assert.equal(appRecordActionPacket.appStoreConnectAppRecordPayload.fields.bundleId, "app.freed.recovery");
  assert.equal(appRecordActionPacket.checks.blocksProductSetupUntilReadinessPasses, true);
  assert.ok(appRecordActionPacket.sourceFiles.some((source) => source.path === "store/screenshots/listing-screenshot-plan.md"));
  assert.ok(appRecordActionPacket.sourceFiles.every((source) => /^sha256-[0-9a-f]{64}$/.test(source.hash)));
  assert.match(buildStoreAppRecordActionPacketMarkdown(appRecordActionPacket), /Store App Record Action Packet/);
  const adMobActionPacket = buildAdMobActionPacket(options, manifest);
  assert.equal(adMobActionPacket.schemaVersion, ADMOB_ACTION_PACKET_SCHEMA_VERSION);
  assert.equal(adMobActionPacket.sanitized, true);
  assert.equal(adMobActionPacket.externalMutationBoundary.actionTimeConfirmationRequired, true);
  assert.equal(adMobActionPacket.externalMutationBoundary.confirmationToken, ADMOB_ACTION_CONFIRMATION_TOKEN);
  assert.equal(adMobActionPacket.currentBlocker, "admob-sandbox-proof-pending");
  assert.equal(adMobActionPacket.adPlacementPolicy.allowedFormats[0], "rewarded");
  assert.ok(adMobActionPacket.adPlacementPolicy.forbiddenFormats.includes("interstitial"));
  assert.match(adMobActionPacket.followUp.readOnlyAdMobReadinessCommand, /evidence:admob-console-browser/);
  assert.equal(adMobActionPacket.followUp.readOnlyAdMobReadinessArtifact, DEFAULT_ADMOB_CONSOLE_READINESS_REPORT);
  assert.equal(adMobActionPacket.followUp.adMobEnvPatchTemplate, ADMOB_ENV_PATCH_TEMPLATE_NAME);
  assert.ok(adMobActionPacket.productionEnvKeys.some((entry) => entry.key === "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID"));
  assert.equal(adMobActionPacket.checks.rewardedOnlyBoundaryRetained, true);
  assert.equal(adMobActionPacket.checks.platformSpecificEnvRequired, true);
  assert.ok(adMobActionPacket.sourceFiles.every((source) => /^sha256-[0-9a-f]{64}$/.test(source.hash)));
  assert.match(buildAdMobActionPacketMarkdown(adMobActionPacket), /AdMob Action Packet/);
  assert.match(buildAdMobActionPacketMarkdown(adMobActionPacket), /ADMOB_ENV_PATCH\.template\.env/);
  const adMobEnvPatchTemplate = buildAdMobEnvPatchTemplate(adMobActionPacket);
  assert.match(adMobEnvPatchTemplate, /EXPO_PUBLIC_ADMOB_APP_ID_IOS=/);
  assert.match(adMobEnvPatchTemplate, /EXPO_PUBLIC_ADMOB_APP_ID_ANDROID=/);
  assert.match(adMobEnvPatchTemplate, /EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS=/);
  assert.match(adMobEnvPatchTemplate, /EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID=/);
  assert.match(adMobEnvPatchTemplate, /EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false/);
  assert.doesNotMatch(adMobEnvPatchTemplate, /ca-app-pub-\d{16}[~/]\d{10}/);
  const missingAdMobOptions = { ...options, adMobAppIdAndroid: "", rewardedAdUnitIdAndroid: "" };
  const missingAdMobPacket = buildAdMobActionPacket(missingAdMobOptions, manifest);
  assert.equal(missingAdMobPacket.currentBlocker, "android-upload-signing-blocked-by-production-admob");
  assert.equal(missingAdMobPacket.checks.envReady, false);
  const rewardedTemplate = buildRewardedAdRequestReportTemplate(options);
  assert.equal(rewardedTemplate.schemaVersion, STORE_REWARDED_AD_REQUEST_SCHEMA_VERSION);
  assert.equal(rewardedTemplate.sanitized, true);
  assert.equal(rewardedTemplate.rewardedAdRequestProofUsableForManualEvidence, false);
  assert.equal(rewardedTemplate.adMobAppIdIos, "ca-app-pub-1234567890123456~1234567890");
  assert.equal(rewardedTemplate.adMobAppIdAndroid, "ca-app-pub-2234567890123456~1234567890");
  assert.equal(rewardedTemplate.rewardedAdUnitId, "ca-app-pub-1234567890123456/1234567890");
  assert.equal(rewardedTemplate.rewardedAdUnitIdIos, "ca-app-pub-1234567890123456/1234567890");
  assert.equal(rewardedTemplate.rewardedAdUnitIdAndroid, "ca-app-pub-2234567890123456/1234567890");
  assert.equal(rewardedTemplate.adFormat, "rewarded");
  assert.equal(rewardedTemplate.checks.noInterstitialRequested, false);
  assert.match(JSON.stringify(rewardedTemplate), /store\.rewardedAdRequestArtifact/);
  const interventionTemplates = buildInterventionFlowReportTemplates(options);
  assert.equal(interventionTemplates.artifactSchemaVersion, STORE_INTERVENTION_FLOW_SCHEMA_VERSION);
  assert.equal(
    interventionTemplates.templates["store.freeRewardedInterventionArtifact"].flowType,
    "free-rewarded-intervention",
  );
  assert.equal(
    interventionTemplates.templates["store.freeRewardedInterventionArtifact"].maxLatencyMs,
    5000,
  );
  assert.equal(
    interventionTemplates.templates["store.premiumNoAdInterventionArtifact"].flowType,
    "premium-no-ad-intervention",
  );
  assert.equal(interventionTemplates.templates["store.adFailureFallbackArtifact"].retryLoopRequired, true);
  const privacyTemplate = buildPrivacyDisclosureReportTemplate(options);
  assert.equal(privacyTemplate.schemaVersion, STORE_PRIVACY_DISCLOSURE_SCHEMA_VERSION);
  assert.equal(privacyTemplate.sanitized, true);
  assert.equal(privacyTemplate.privacyDisclosureProofUsableForManualEvidence, false);
  assert.ok(privacyTemplate.reviewedStoreSurfaces.includes("app-store-connect-app-privacy"));
  assert.equal(privacyTemplate.signals.billingDataUseReviewed, false);
  assert.match(JSON.stringify(privacyTemplate), /store\.privacyDisclosureArtifact/);
  console.log("store-ad-sandbox-evidence self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  capture(options);
}

main();
