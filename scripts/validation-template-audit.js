const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { basename, join } = require("node:path");

const root = process.cwd();
const validationEvidenceSpecs = JSON.parse(
  readFileSync(join(root, "scripts/validation-evidence-specs.json"), "utf8")
);
const {
  captureHelperCommandMap,
  handoffDocumentCommandList,
  handoffDocumentPaths,
  productionEnvChecklist,
  productionBlockerGroups,
  reportArtifactCommandList
} = require("./lib/release-blocker-groups");
const {
  VALIDATION_REQUIREMENTS_SCHEMA_VERSION
} = require("./lib/validation-requirements-schema");
const PERMISSION_WIZARD_FLOW_ORDER =
  "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete";
const PERMISSION_EXPLANATION_REQUIRED_PHRASES = [
  "monitor only selected apps and sites",
  "block known adult domains",
  "harmful site, search, or app-limit threshold"
];
const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "monthly", "lifetime"];
const DEFAULT_LAUNCH_PRODUCT_IDS = {
  monthly: "freed_premium_monthly",
  yearly: "freed_premium_yearly",
  lifetime: "freed_premium_lifetime"
};

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPermissionExplanationSummary(value) {
  if (!nonEmptyString(value)) return false;
  const normalized = value.toLowerCase();
  return PERMISSION_EXPLANATION_REQUIRED_PHRASES.every((phrase) => normalized.includes(phrase));
}

function nonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function validIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function classifierCorpusCaseCount() {
  const source = readFileSync(join(root, "scripts/classifier-safety-corpus.ts"), "utf8");
  return (source.match(/\bexpected:\s*"(?:allow|block)"/g) ?? []).length;
}

function urlHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function nonEmptyUrlArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function validateUrlGroup(urls, path, missing) {
  if (!nonEmptyUrlArray(urls)) {
    missing.push(`${path}[]`);
    return;
  }

  const seen = new Set();
  urls.forEach((url, index) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      missing.push(`${path}[${index}] valid URL`);
      return;
    }

    if (parsed.protocol !== "https:") missing.push(`${path}[${index}] HTTPS`);
    const normalized = parsed.toString().toLowerCase();
    if (seen.has(normalized)) missing.push(`${path}[${index}] unique`);
    seen.add(normalized);
  });
}

function includesUrl(urls, matcher) {
  return Array.isArray(urls) && urls.some((url) => matcher(String(url).toLowerCase(), urlHost(String(url))));
}

function templatePathForEvidenceFile(evidenceFile) {
  return join(
    "docs/validation/templates",
    basename(evidenceFile).replace(/\.json$/, ".template.json")
  );
}

function validatePerformancePlatformProfiles(payload, missing) {
  const profile = isRecord(payload) && isRecord(payload.profile) ? payload.profile : {};
  const rows = Array.isArray(profile.platformProfiles) ? profile.platformProfiles : null;
  if (!rows) {
    missing.push("profile.platformProfiles[]");
    return;
  }

  for (const platform of ["ios", "android"]) {
    const row = rows.find(
      (entry) =>
        isRecord(entry) &&
        typeof entry.platform === "string" &&
        entry.platform.trim().toLowerCase() === platform
    );
    const path = `profile.platformProfiles.${platform}`;
    if (!isRecord(row)) {
      missing.push(path);
      continue;
    }

    if (row.isPhysicalDevice !== true) missing.push(`${path}.isPhysicalDevice`);
    for (const field of [
      "deviceModel",
      "osVersion",
      "protectionMode",
      "runId",
      "profilerArtifact",
      "backgroundCpuRunId",
      "backgroundCpuArtifact",
      "routingProofRunId",
      "routingProofArtifact",
      "networkSpeedRunId",
      "networkSpeedArtifact",
      "dnsLatencyRunId",
      "dnsLatencyArtifact"
    ]) {
      if (!nonEmptyString(row[field])) missing.push(`${path}.${field}`);
    }
    for (const field of [
      "durationMinutes",
      "batteryDrainPercent",
      "maxResidentMemoryMb",
      "maxDeviceTemperatureC",
      "dnsLatencyP95Ms",
      "downloadMbpsBefore",
      "downloadMbpsDuring",
      "backgroundCpuPercent"
    ]) {
      if (!finiteNumber(row[field])) missing.push(`${path}.${field}`);
    }
    if (finiteNumber(row.backgroundCpuPercent) && (row.backgroundCpuPercent < 0 || row.backgroundCpuPercent > 5)) {
      missing.push(`${path}.backgroundCpuPercent<=5`);
    }
    for (const field of [
      "normalBrowsingSpeedAcceptable",
      "noOverheating",
      "noBatteryDrainRegression",
      "noForegroundPollingLoopObserved",
      "noFullTrafficProxyConfirmed",
      "noPacketInspectionConfirmed",
      "noMitmHttpsConfirmed",
      "noContinuousScreenshotOrOcrConfirmed",
      "noContinuousImageClassificationConfirmed"
    ]) {
      if (row[field] !== true) missing.push(`${path}.${field}`);
    }
  }
}

function validateNormalBrowsingTemplate(payload, missing) {
  const expectedCorpusCount = classifierCorpusCaseCount();
  const normalBrowsing = isRecord(payload) && isRecord(payload.normalBrowsing) ? payload.normalBrowsing : {};
  const allowedUrls = normalBrowsing.allowedUrls;
  const recoverySearchUrls = normalBrowsing.recoverySearchUrls;
  const adultBlockedUrls = normalBrowsing.adultBlockedUrls;

  if (normalBrowsing.classifierCorpusSource !== "scripts/classifier-safety-corpus.ts") {
    missing.push("normalBrowsing.classifierCorpusSource");
  }
  if (normalBrowsing.classifierCorpusCaseCount !== expectedCorpusCount) {
    missing.push(`normalBrowsing.classifierCorpusCaseCount=${expectedCorpusCount}`);
  }
  if (normalBrowsing.classifierCorpusPassCount !== expectedCorpusCount) {
    missing.push(`normalBrowsing.classifierCorpusPassCount=${expectedCorpusCount}`);
  }
  if (normalBrowsing.classifierCorpusFailedCount !== 0) {
    missing.push("normalBrowsing.classifierCorpusFailedCount=0");
  }

  validateUrlGroup(allowedUrls, "normalBrowsing.allowedUrls", missing);
  validateUrlGroup(recoverySearchUrls, "normalBrowsing.recoverySearchUrls", missing);
  validateUrlGroup(adultBlockedUrls, "normalBrowsing.adultBlockedUrls", missing);

  const allowedCount = nonEmptyUrlArray(allowedUrls) ? allowedUrls.length : 0;
  const recoveryCount = nonEmptyUrlArray(recoverySearchUrls) ? recoverySearchUrls.length : 0;
  const blockedCount = nonEmptyUrlArray(adultBlockedUrls) ? adultBlockedUrls.length : 0;
  const rows = Array.isArray(normalBrowsing.browserMatrix) ? normalBrowsing.browserMatrix : [];
  if (rows.length < 5) missing.push("normalBrowsing.browserMatrix[]");
  let hasIosSafari = false;
  let hasAndroidChrome = false;
  let hasAndroidFirefox = false;
  let hasAndroidEdge = false;
  let hasAndroidSamsung = false;

  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      missing.push(`normalBrowsing.browserMatrix[${index}]`);
      continue;
    }
    const platform = typeof row.platform === "string" ? row.platform.toLowerCase() : "";
    const browserName = typeof row.browserName === "string" ? row.browserName.toLowerCase() : "";
    const browserPackage = typeof row.browserPackage === "string" ? row.browserPackage : "";
    if (platform === "ios" && browserName === "safari") hasIosSafari = true;
    if (platform === "android" && browserName.includes("chrome") && browserPackage === "com.android.chrome") hasAndroidChrome = true;
    if (platform === "android" && browserName.includes("firefox") && browserPackage === "org.mozilla.firefox") hasAndroidFirefox = true;
    if (platform === "android" && browserName.includes("edge") && browserPackage === "com.microsoft.emmx") {
      hasAndroidEdge = true;
    }
    if (platform === "android" && browserName.includes("samsung") && browserPackage === "com.sec.android.app.sbrowser") {
      hasAndroidSamsung = true;
    }
    if (row.allowedUrlCount !== allowedCount) missing.push(`normalBrowsing.browserMatrix[${index}].allowedUrlCount=${allowedCount}`);
    if (row.recoverySearchUrlCount !== recoveryCount) {
      missing.push(`normalBrowsing.browserMatrix[${index}].recoverySearchUrlCount=${recoveryCount}`);
    }
    if (row.adultBlockedUrlCount !== blockedCount) {
      missing.push(`normalBrowsing.browserMatrix[${index}].adultBlockedUrlCount=${blockedCount}`);
    }
    if (row.allowedUrlPassCount !== allowedCount) {
      missing.push(`normalBrowsing.browserMatrix[${index}].allowedUrlPassCount=${allowedCount}`);
    }
    if (row.recoverySearchPassCount !== recoveryCount) {
      missing.push(`normalBrowsing.browserMatrix[${index}].recoverySearchPassCount=${recoveryCount}`);
    }
    if (row.adultBlockPassCount !== blockedCount) {
      missing.push(`normalBrowsing.browserMatrix[${index}].adultBlockPassCount=${blockedCount}`);
    }
    if (row.falsePositiveCount !== 0) missing.push(`normalBrowsing.browserMatrix[${index}].falsePositiveCount=0`);
    if (row.missedAdultBlockCount !== 0) missing.push(`normalBrowsing.browserMatrix[${index}].missedAdultBlockCount=0`);
  }
  if (!hasIosSafari) missing.push("normalBrowsing.browserMatrix includes iOS Safari");
  if (!hasAndroidChrome) missing.push("normalBrowsing.browserMatrix includes Android Chrome");
  if (!hasAndroidFirefox) missing.push("normalBrowsing.browserMatrix includes Android Firefox");
  if (!hasAndroidEdge) missing.push("normalBrowsing.browserMatrix includes Android Edge");
  if (!hasAndroidSamsung) missing.push("normalBrowsing.browserMatrix includes Samsung Internet");

  if (!includesUrl(allowedUrls, (_url, host) => host === "google.com" || host.endsWith(".google.com"))) {
    missing.push("normalBrowsing.allowedUrls includes Google");
  }
  if (!includesUrl(allowedUrls, (_url, host) => host === "youtube.com" || host.endsWith(".youtube.com"))) {
    missing.push("normalBrowsing.allowedUrls includes YouTube");
  }
  if (!includesUrl(allowedUrls, (_url, host) => host === "instagram.com" || host.endsWith(".instagram.com"))) {
    missing.push("normalBrowsing.allowedUrls includes Instagram");
  }
  if (!includesUrl(allowedUrls, (_url, host) => host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com"))) {
    missing.push("normalBrowsing.allowedUrls includes X/Twitter");
  }
  if (!includesUrl(allowedUrls, (_url, host) => host.endsWith(".edu") || ["coursera.org", "edx.org", "khanacademy.org", "wikipedia.org"].some((domain) => host === domain || host.endsWith(`.${domain}`)))) {
    missing.push("normalBrowsing.allowedUrls includes education");
  }
  if (!includesUrl(allowedUrls, (_url, host) => ["netflix.com", "hulu.com", "disneyplus.com", "spotify.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)))) {
    missing.push("normalBrowsing.allowedUrls includes streaming");
  }
  if (!includesUrl(allowedUrls, (_url, host) => ["steampowered.com", "xbox.com", "playstation.com", "roblox.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)))) {
    missing.push("normalBrowsing.allowedUrls includes gaming");
  }
  if (!includesUrl(allowedUrls, (_url, host) => ["notion.so", "github.com", "docs.google.com", "slack.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)))) {
    missing.push("normalBrowsing.allowedUrls includes productivity");
  }
  if (!includesUrl(recoverySearchUrls, (url) => url.includes("porn") && ["recovery", "addiction", "therapy", "accountability"].some((term) => url.includes(term)))) {
    missing.push("normalBrowsing.recoverySearchUrls includes adult-term recovery intent");
  }
  if (!includesUrl(adultBlockedUrls, (url, host) =>
    ["porn", "nsfw", "explicit"].some((term) => url.includes(term)) &&
    !["app.freed.local", "example.com", "example.org", "example.net"].some((domain) => host === domain || host.endsWith(`.${domain}`))
  )) {
    missing.push("normalBrowsing.adultBlockedUrls includes non-fixture adult intent");
  }
}

function requireStringFields(record, path, fields, missing) {
  for (const field of fields) {
    if (!nonEmptyString(record[field])) missing.push(`${path}.${field}`);
  }
}

function requireNumberFields(record, path, fields, missing) {
  for (const field of fields) {
    if (!finiteNumber(record[field])) missing.push(`${path}.${field}`);
  }
}

function validateIosPhysicalDeviceTemplate(payload, missing) {
  const ios = isRecord(payload) && isRecord(payload.ios) ? payload.ios : {};

  if (ios.isPhysicalDevice !== true) missing.push("ios.isPhysicalDevice");
  requireStringFields(
    ios,
    "ios",
    [
      "deviceModel",
      "osVersion",
      "permissionWizardRunId",
      "permissionWizardArtifact",
      "permissionWizardFlowOrder",
      "permissionExplanationSummary",
      "familyControlsEntitlementTeamId",
      "familyControlsEntitlementArtifact",
      "appGroupProvisioningProfileId",
      "appGroupProvisioningArtifact",
      "familyControlsAuthorizationRunId",
      "familyControlsAuthorizationArtifact",
      "familyControlsStatus",
      "familyActivityPickerRunId",
      "familyActivityPickerArtifact",
      "familyActivityPickerAppLimitActivityName",
      "familyActivityPickerAppLimitEventName",
      "selectedShieldTokensRunId",
      "selectedShieldTokensArtifact",
      "selectedAppDailyLimitActivityName",
      "selectedAppDailyLimitEventName",
      "selectedAppDailyLimitReachedDate",
      "selectedAppDailyLimitRunId",
      "selectedAppDailyLimitArtifact",
      "managedSettingsFilterRunId",
      "managedSettingsFilterArtifact",
      "safariContentBlockerIdentifier",
      "safariContentBlockerBuildRunId",
      "safariContentBlockerBuildArtifact",
      "safariContentBlockerReloadRunId",
      "safariContentBlockerReloadArtifact",
      "safariContentBlockerVersion",
      "safariContentBlockerChecksum",
      "safariContentBlockerAdultBlockRunId",
      "safariContentBlockerAdultBlockArtifact",
      "safariFocusShieldEmbedded",
      "safariFocusShieldIdentifier",
      "safariFocusShieldBuildRunId",
      "safariFocusShieldBuildArtifact",
      "safariFocusShieldShortFormUrl",
      "safariFocusShieldShortFormBlockRunId",
      "safariFocusShieldShortFormBlockArtifact",
      "safariShortFormChallengeHandoffRunId",
      "safariShortFormChallengeHandoffArtifact",
      "safariShortFormChallengeHandoffSource",
      "safariShortFormChallengeHandoffMatchedRule",
      "safariShortFormChallengeHandoffHost",
      "earnedUnlockAppAllowRunId",
      "earnedUnlockAppAllowArtifact",
      "earnedUnlockRelockRunId",
      "earnedUnlockRelockArtifact",
      "earnedUnlockActivityName",
      "earnedUnlockSourceHost",
      "earnedUnlockRejectedSourceRunId",
      "earnedUnlockRejectedSourceArtifact",
      "earnedUnlockRejectedSourceHost",
      "challengePhotoRunId",
      "challengePhotoArtifact",
      "challengePhotoClassifier",
      "challengePhotoMatchedLabel",
      "challengeMotionRunId",
      "challengeMotionArtifact",
      "challengeStepsRunId",
      "challengeStepsArtifact",
      "challengeLocationRunId",
      "challengeLocationArtifact",
      "shieldActionInterventionId",
      "shieldActionHandoffRunId",
      "shieldActionHandoffArtifact",
      "deviceActivityName",
      "deviceActivityNightGuardRunId",
      "deviceActivityNightGuardArtifact",
      "normalBrowsingRunId",
      "normalBrowsingArtifact",
      "adultInterceptRunId",
      "adultInterceptArtifact",
      "normalBrowsingAllowedUrl",
      "adultInterceptedHost"
    ],
    missing
  );
  requireNumberFields(
    ios,
    "ios",
    [
      "selectedApplicationTokenCount",
      "selectedCategoryTokenCount",
      "selectedWebDomainTokenCount",
      "selectedAppDailyLimitMinutes",
      "safariContentBlockerRuleCount",
      "earnedUnlockDurationMinutes",
      "earnedUnlockSelectedTokenCount",
      "challengePhotoConfidence",
      "challengeMotionSamples",
      "challengeStepCount",
      "challengeLocationDistanceMeters",
      "challengeLocationSamples",
      "challengeLocationBestAccuracyMeters"
    ],
    missing
  );
  if (ios.familyActivityPickerAppLimitScheduledImmediately !== true) {
    missing.push("ios.familyActivityPickerAppLimitScheduledImmediately");
  }
  if (ios.appLimitScheduled !== true) missing.push("ios.appLimitScheduled");
  if (ios.permissionWizardFlowOrder !== PERMISSION_WIZARD_FLOW_ORDER) missing.push("ios.permissionWizardFlowOrder");
  if (ios.permissionExplanationShown !== true) missing.push("ios.permissionExplanationShown");
  if (!hasPermissionExplanationSummary(ios.permissionExplanationSummary)) missing.push("ios.permissionExplanationSummary");
  if (ios.permissionWizardTestProtectionPassed !== true) missing.push("ios.permissionWizardTestProtectionPassed");
  if (ios.selectedAppDailyLimitReachedToday !== true) missing.push("ios.selectedAppDailyLimitReachedToday");
  if (ios.safariContentBlockerEmbedded !== true) missing.push("ios.safariContentBlockerEmbedded");
  if (ios.safariContentBlockerEnabled !== true) missing.push("ios.safariContentBlockerEnabled");
  if (ios.safariShortFormChallengeHandoffSource !== "ios-safari-short-form") {
    missing.push("ios.safariShortFormChallengeHandoffSource");
  }
  if (ios.safariShortFormChallengeHandoffRawPathStored !== false) {
    missing.push("ios.safariShortFormChallengeHandoffRawPathStored");
  }
  if (ios.safariShortFormChallengeHandoffNativeUnlockActive !== false) {
    missing.push("ios.safariShortFormChallengeHandoffNativeUnlockActive");
  }
  if (ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive !== true) {
    missing.push("ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive");
  }
  if (ios.safariShortFormChallengeHandoffAdultFilterStillActive !== true) {
    missing.push("ios.safariShortFormChallengeHandoffAdultFilterStillActive");
  }
  if (ios.earnedUnlockActivityName !== "freed.earnedUnlockWindow") missing.push("ios.earnedUnlockActivityName");
  if (ios.earnedUnlockAdultFilterStillActive !== true) missing.push("ios.earnedUnlockAdultFilterStillActive");
  if (ios.earnedUnlockSourceHost !== "screen-time-shield.freed.local") missing.push("ios.earnedUnlockSourceHost");
  if (ios.earnedUnlockRejectedSelectedShieldsStayedActive !== true) {
    missing.push("ios.earnedUnlockRejectedSelectedShieldsStayedActive");
  }
  if (ios.earnedUnlockRejectedAdultFilterStillActive !== true) {
    missing.push("ios.earnedUnlockRejectedAdultFilterStillActive");
  }
  if (ios.challengePhotoFreshCameraOnly !== true) missing.push("ios.challengePhotoFreshCameraOnly");
  if (ios.challengePhotoNoBase64OrExif !== true) missing.push("ios.challengePhotoNoBase64OrExif");
  if (ios.challengePhotoTemporaryFileDeleted !== true) missing.push("ios.challengePhotoTemporaryFileDeleted");
}

function validateAndroidRealBrowserTemplate(payload, missing) {
  const android = isRecord(payload) && isRecord(payload.android) ? payload.android : {};
  const testedBrowserPackages = Array.isArray(android.testedBrowserPackages) ? android.testedBrowserPackages : [];
  const normalizedPackages = testedBrowserPackages.map((entry) => String(entry).toLowerCase());

  if (android.isPhysicalDevice !== true) missing.push("android.isPhysicalDevice");
  if (android.accessibilityServiceEnabled !== true) missing.push("android.accessibilityServiceEnabled");
  if (!nonEmptyStringArray(android.testedBrowserPackages)) missing.push("android.testedBrowserPackages[]");
  if (!nonEmptyStringArray(android.configuredAppShieldPackages)) missing.push("android.configuredAppShieldPackages[]");
  if (!normalizedPackages.includes("com.android.chrome")) {
    missing.push("android.testedBrowserPackages includes Chrome");
  }
  if (!normalizedPackages.some((entry) => entry.includes("firefox"))) {
    missing.push("android.testedBrowserPackages includes Firefox");
  }
  if (!normalizedPackages.some((entry) => entry.includes("microsoft.emmx"))) {
    missing.push("android.testedBrowserPackages includes Edge");
  }
  if (!normalizedPackages.some((entry) => entry.includes("com.sec.android.app.sbrowser") || entry.includes("samsung"))) {
    missing.push("android.testedBrowserPackages includes Samsung Internet");
  }
  requireStringFields(
    android,
    "android",
    [
      "deviceModel",
      "osVersion",
      "installQaRunId",
      "installQaArtifact",
      "permissionWizardRunId",
      "permissionWizardArtifact",
      "permissionWizardFlowOrder",
      "permissionExplanationSummary",
      "accessibilityPermissionRunId",
      "accessibilityPermissionArtifact",
      "usageAccessPermissionRunId",
      "usageAccessPermissionArtifact",
      "notificationPermissionRunId",
      "notificationPermissionArtifact",
      "chromeInterceptRunId",
      "chromeInterceptArtifact",
      "firefoxInterceptRunId",
      "firefoxInterceptArtifact",
      "edgeInterceptRunId",
      "edgeInterceptArtifact",
      "samsungInternetInterceptRunId",
      "samsungInternetInterceptArtifact",
      "focusedBrowserSearchRunId",
      "focusedBrowserSearchArtifact",
      "focusedBrowserSearchRedactedHost",
      "focusedBrowserSearchMatchedRule",
      "focusedWebViewPackage",
      "focusedWebViewRunId",
      "focusedWebViewArtifact",
      "configuredAppShieldPackage",
      "configuredAppShieldBeforeLimitAllowRunId",
      "configuredAppShieldBeforeLimitAllowArtifact",
      "configuredAppShieldRunId",
      "configuredAppShieldArtifact",
      "configuredAppShieldInterventionId",
      "shortFormPackage",
      "shortFormBelowThresholdAllowRunId",
      "shortFormBelowThresholdAllowArtifact",
      "shortFormRunId",
      "shortFormArtifact",
      "shortFormSelectedSurfaceArtifact",
      "shortFormInterventionId",
      "instagramReelsPackage",
      "instagramReelsRunId",
      "instagramReelsArtifact",
      "instagramReelsSelectedSurfaceArtifact",
      "instagramReelsInterventionId",
      "tiktokFeedPackage",
      "tiktokFeedRunId",
      "tiktokFeedArtifact",
      "tiktokFeedSelectedSurfaceArtifact",
      "tiktokFeedInterventionId",
      "earnedUnlockAppAllowRunId",
      "earnedUnlockAppAllowArtifact",
      "earnedUnlockRelockRunId",
      "earnedUnlockRelockArtifact",
      "earnedUnlockSourcePackage",
      "challengePhotoRunId",
      "challengePhotoArtifact",
      "challengePhotoClassifier",
      "challengePhotoMatchedLabel",
      "challengeMotionRunId",
      "challengeMotionArtifact",
      "challengeStepsRunId",
      "challengeStepsArtifact",
      "challengeLocationRunId",
      "challengeLocationArtifact",
      "dnsGuardResolver",
      "dnsGuardBlockRunId",
      "dnsGuardBlockArtifact",
      "dnsGuardLifecycleArtifact",
      "dnsGuardRestartRunId",
      "dnsGuardRestartArtifact",
      "dnsGuardRestartAction",
      "dnsGuardRestartResult",
      "dnsGuardRestartSkippedRunId",
      "dnsGuardRestartSkippedArtifact",
      "dnsGuardRestartSkippedReason",
      "adultDomainFeedVersion",
      "adultDomainFeedChecksum",
      "adultDomainFeedStatusRunId",
      "adultDomainFeedStatusArtifact",
      "adultDomainFeedAccessibilityRunId",
      "adultDomainFeedAccessibilityArtifact",
      "adultDomainFeedDnsGuardRunId",
      "adultDomainFeedDnsGuardArtifact",
      "nativeHandoffInterventionId",
      "backStackCleanupRunId",
      "backStackCleanupArtifact",
      "normalBrowsingRunId",
      "normalBrowsingArtifact",
      "playPolicyAccessibilityReviewId",
      "playPolicyAccessibilityArtifact",
      "playPolicySpecialUseFgsReviewId",
      "playPolicySpecialUseFgsArtifact",
      "normalBrowsingAllowedUrl",
      "adultInterceptedHost"
    ],
    missing
  );
  if (android.focusedBrowserSearchRawQueryStored !== false) missing.push("android.focusedBrowserSearchRawQueryStored");
  if (android.shortFormSelectedSurfaceVerified !== true) missing.push("android.shortFormSelectedSurfaceVerified");
  if (android.instagramReelsSelectedSurfaceVerified !== true) missing.push("android.instagramReelsSelectedSurfaceVerified");
  if (android.tiktokFeedSelectedSurfaceVerified !== true) missing.push("android.tiktokFeedSelectedSurfaceVerified");
  if (android.dnsGuardRestartUserEnabled !== true) missing.push("android.dnsGuardRestartUserEnabled");
  if (android.dnsGuardRestartEligible !== true) missing.push("android.dnsGuardRestartEligible");
  if (android.dnsGuardRestartNoSilentPromptConfirmed !== true) missing.push("android.dnsGuardRestartNoSilentPromptConfirmed");
  if (android.dnsGuardInterventionVisible !== true) missing.push("android.dnsGuardInterventionVisible");
  if (android.challengePhotoFreshCameraOnly !== true) missing.push("android.challengePhotoFreshCameraOnly");
  if (android.challengePhotoNoBase64OrExif !== true) missing.push("android.challengePhotoNoBase64OrExif");
  if (android.challengePhotoTemporaryFileDeleted !== true) missing.push("android.challengePhotoTemporaryFileDeleted");
  requireNumberFields(
    android,
    "android",
    [
      "configuredAppShieldDailyLimitMinutes",
      "configuredAppShieldUsageBeforeLimitMinutes",
      "configuredAppShieldUsageAtInterventionMinutes",
      "shortFormThresholdSeconds",
      "shortFormBelowThresholdSeconds",
      "shortFormAtInterventionSeconds",
      "shortFormUsageBeforeLimitMinutes",
      "instagramReelsAtInterventionSeconds",
      "instagramReelsUsageBeforeLimitMinutes",
      "tiktokFeedAtInterventionSeconds",
      "tiktokFeedUsageBeforeLimitMinutes",
      "earnedUnlockDurationMinutes",
      "earnedUnlockRelockUsageMinutes",
      "challengePhotoConfidence",
      "challengeMotionSamples",
      "challengeStepCount",
      "challengeLocationDistanceMeters",
      "challengeLocationSamples",
      "challengeLocationBestAccuracyMeters",
      "dnsGuardSessionQueries",
      "dnsGuardBlockedQueries",
      "dnsGuardAllowedQueries",
      "dnsGuardServfailResponses",
      "dnsGuardMalformedPackets",
      "adultDomainFeedDomainCount"
    ],
    missing
  );
  if (android.usageStatsAuthorized !== true) missing.push("android.usageStatsAuthorized");
  if (android.notificationPermissionRequired !== true) missing.push("android.notificationPermissionRequired");
  if (android.notificationPermissionGranted !== true) missing.push("android.notificationPermissionGranted");
  if (android.notificationRuntimePromptShown !== true) missing.push("android.notificationRuntimePromptShown");
  if (android.notificationSettingsFallbackOpenedIfDenied !== true) {
    missing.push("android.notificationSettingsFallbackOpenedIfDenied");
  }
  if (android.permissionWizardFlowOrder !== PERMISSION_WIZARD_FLOW_ORDER) missing.push("android.permissionWizardFlowOrder");
  if (android.permissionExplanationShown !== true) missing.push("android.permissionExplanationShown");
  if (!hasPermissionExplanationSummary(android.permissionExplanationSummary)) missing.push("android.permissionExplanationSummary");
  if (android.permissionWizardTestProtectionPassed !== true) missing.push("android.permissionWizardTestProtectionPassed");
  if (android.appSelectionZeroAppContinueDisabled !== true) missing.push("android.appSelectionZeroAppContinueDisabled");
  if (android.appSelectionReturnFromSetup !== true) missing.push("android.appSelectionReturnFromSetup");
  if (android.appSelectionReturnAutoSync !== true) missing.push("android.appSelectionReturnAutoSync");
  if (android.appSelectionReturnNativePackageSyncConfirmed !== true) {
    missing.push("android.appSelectionReturnNativePackageSyncConfirmed");
  }
  if (typeof android.appSelectionReturnSelectedAppCount !== "number" || android.appSelectionReturnSelectedAppCount < 1) {
    missing.push("android.appSelectionReturnSelectedAppCount");
  }
  requireNumberFields(android, "android", ["usageStatsObservedPackages", "usageStatsTodayMinutes"], missing);
  if (!Array.isArray(android.usageStatsObservedPackageNames) || android.usageStatsObservedPackageNames.length === 0) {
    missing.push("android.usageStatsObservedPackageNames");
  }
  if (!isRecord(android.usageStatsTodayMinutesByPackage)) {
    missing.push("android.usageStatsTodayMinutesByPackage");
  }
}

function validateStoreAdTemplate(payload, missing) {
  const store = isRecord(payload) && isRecord(payload.store) ? payload.store : {};

  requireStringFields(
    store,
    "store",
    [
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
    ],
    missing
  );
  for (const field of ["iosLaunchProductIds", "androidLaunchProductIds"]) {
    if (!isRecord(store[field])) {
      missing.push(`store.${field}`);
      continue;
    }
    for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
      if (store[field][planId] !== DEFAULT_LAUNCH_PRODUCT_IDS[planId]) {
        missing.push(`store.${field}.${planId}`);
      }
    }
    for (const key of Object.keys(store[field])) {
      if (!LAUNCH_PREMIUM_PLAN_IDS.includes(key)) missing.push(`store.${field}.${key}`);
    }
  }
  const launchMatrix = Array.isArray(store.launchProductSandboxMatrix) ? store.launchProductSandboxMatrix : null;
  if (!launchMatrix) {
    missing.push("store.launchProductSandboxMatrix[]");
  } else {
    const launchMatrixPlanIds = launchMatrix.map((entry) => (isRecord(entry) ? entry.planId : ""));
    if (JSON.stringify(launchMatrixPlanIds) !== JSON.stringify(LAUNCH_PREMIUM_PLAN_IDS)) {
      missing.push("store.launchProductSandboxMatrix order yearly/monthly/lifetime");
    }
    for (const planId of LAUNCH_PREMIUM_PLAN_IDS) {
      const row = launchMatrix.find((entry) => isRecord(entry) && entry.planId === planId);
      if (!isRecord(row)) {
        missing.push(`store.launchProductSandboxMatrix.${planId}`);
        continue;
      }
      if (row.iosProductId !== DEFAULT_LAUNCH_PRODUCT_IDS[planId]) {
        missing.push(`store.launchProductSandboxMatrix.${planId}.iosProductId`);
      }
      if (row.androidProductId !== DEFAULT_LAUNCH_PRODUCT_IDS[planId]) {
        missing.push(`store.launchProductSandboxMatrix.${planId}.androidProductId`);
      }
      for (const field of [
        "iosPurchaseRunId",
        "iosPurchaseArtifact",
        "iosRestoreRunId",
        "iosRestoreArtifact",
        "androidPurchaseRunId",
        "androidPurchaseArtifact",
        "androidRestoreRunId",
        "androidRestoreArtifact",
        "purchaseVerificationRunId",
        "purchaseVerificationArtifact",
        "restoreVerificationRunId",
        "restoreVerificationArtifact"
      ]) {
        if (!nonEmptyString(row[field])) missing.push(`store.launchProductSandboxMatrix.${planId}.${field}`);
      }
      for (const field of [
        "iosPurchaseSandbox",
        "iosRestoreSandbox",
        "androidPurchaseSandbox",
        "androidRestoreSandbox",
        "receiptOrEntitlementVerified",
        "restoreEntitlementVerified"
      ]) {
        if (row[field] !== true) missing.push(`store.launchProductSandboxMatrix.${planId}.${field}`);
      }
    }
  }
  requireNumberFields(
    store,
    "store",
    [
      "purchaseVerificationPassCount",
      "purchaseVerificationFailedCount",
      "restoreVerificationPassCount",
      "restoreVerificationFailedCount",
      "freePostAdChallengeLatencyMs",
      "premiumNoAdLatencyMs"
    ],
    missing
  );
  if (store.rewardedAdFormat !== "rewarded") missing.push("store.rewardedAdFormat");
  if (store.adRequestNonPersonalized !== true) missing.push("store.adRequestNonPersonalized");
  if (store.noInterstitialOrBannerAdRequestsConfirmed !== true) {
    missing.push("store.noInterstitialOrBannerAdRequestsConfirmed");
  }
  if (store.premiumNoRewardedAdRequested !== true) missing.push("store.premiumNoRewardedAdRequested");
  if (
    nonEmptyString(store.releasePreflightCommand) &&
    !store.releasePreflightCommand.includes("npm run preflight:release-env")
  ) {
    missing.push("store.releasePreflightCommand includes preflight:release-env");
  }
  if (
    nonEmptyString(store.purchaseSmokeCommand) &&
    !store.purchaseSmokeCommand.includes("npm run smoke:purchase-verification")
  ) {
    missing.push("store.purchaseSmokeCommand includes smoke:purchase-verification");
  }
}

function validateAiBackendTemplate(payload, missing) {
  const ai = isRecord(payload) && isRecord(payload.ai) ? payload.ai : {};

  requireStringFields(
    ai,
    "ai",
    [
      "coachEndpoint",
      "challengeEndpoint",
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
    ],
    missing
  );
  requireNumberFields(
    ai,
    "ai",
    [
      "safetyEvalCaseCount",
      "safetyEvalFailedCount",
      "smokeEndpointPassCount",
      "smokeEndpointFailCount",
      "challengePersonalizationProfileCount",
      "challengeRiskForecastProfileCount",
      "challengeSessionDurationBucketProfileCount",
      "challengeRecentFailureProfileCount",
      "freeChallengePremiumCount",
      "noSensitiveEchoSampleCount"
    ],
    missing
  );
  if (
    nonEmptyString(ai.releasePreflightCommand) &&
    !ai.releasePreflightCommand.includes("npm run preflight:release-env")
  ) {
    missing.push("ai.releasePreflightCommand includes preflight:release-env");
  }
  if (nonEmptyString(ai.safetyEvalCommand) && !ai.safetyEvalCommand.includes("npm run eval:ai-safety")) {
    missing.push("ai.safetyEvalCommand includes eval:ai-safety");
  }
  if (nonEmptyString(ai.smokeCommand) && !ai.smokeCommand.includes("npm run smoke:ai-backend")) {
    missing.push("ai.smokeCommand includes smoke:ai-backend");
  }
}

function templateExampleLabel(specId) {
  if (specId === "ios-physical-device-validation") return "iOS physical-device field examples";
  if (specId === "android-real-browser-validation") return "Android real-browser field examples";
  if (specId === "store-ad-sandbox-validation") return "store/ad sandbox field examples";
  if (specId === "ai-backend-smoke-validation") return "AI backend smoke field examples";
  if (specId === "performance-validation") return "performance field examples";
  if (specId === "normal-browsing-corpus-validation") {
    return "normal-browsing corpus examples aligned to the current classifier corpus";
  }
  return "required checks";
}

function validatePayloadForSpec(payload, spec) {
  const missing = [];
  if (!isRecord(payload)) missing.push("root object");
  if (!validIsoDate(payload?.validatedAt)) missing.push("validatedAt");
  if (!nonEmptyString(payload?.tester)) missing.push("tester");
  if (!nonEmptyString(payload?.build)) missing.push("build");
  if (!nonEmptyString(payload?.device) && !nonEmptyString(payload?.environment)) {
    missing.push("device or environment");
  }
  if (!nonEmptyStringArray(payload?.evidence)) missing.push("evidence[]");

  const checks = isRecord(payload) && isRecord(payload.checks) ? payload.checks : {};
  for (const check of spec.requiredChecks) {
    if (checks[check] !== true) missing.push(`checks.${check}`);
  }

  if (spec.requiredProfileNumbers) {
    const profile = isRecord(payload) && isRecord(payload.profile) ? payload.profile : {};
    for (const field of spec.requiredProfileNumbers) {
      if (typeof profile[field] !== "number" || !Number.isFinite(profile[field])) {
        missing.push(`profile.${field}`);
      }
    }
  }
  if (spec.id === "normal-browsing-corpus-validation") {
    validateNormalBrowsingTemplate(payload, missing);
  }
  if (spec.id === "ios-physical-device-validation") {
    validateIosPhysicalDeviceTemplate(payload, missing);
  }
  if (spec.id === "android-real-browser-validation") {
    validateAndroidRealBrowserTemplate(payload, missing);
  }
  if (spec.id === "performance-validation") {
    validatePerformancePlatformProfiles(payload, missing);
  }
  if (spec.id === "store-ad-sandbox-validation") {
    validateStoreAdTemplate(payload, missing);
  }
  if (spec.id === "ai-backend-smoke-validation") {
    validateAiBackendTemplate(payload, missing);
  }

  return missing;
}

function validateTemplate(spec) {
  const templatePath = templatePathForEvidenceFile(spec.file);
  const absolutePath = join(root, templatePath);
  if (!existsSync(absolutePath)) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `Missing template: ${templatePath}.`,
      next: "Add or restore the validation evidence template."
    };
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    return {
      id: spec.id,
      status: "fail",
      evidence: `${templatePath} is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}.`,
      next: "Fix the template JSON before using it for QA handoff."
    };
  }

  const missing = [];
  if (!isRecord(payload)) missing.push("root object");
  if (!validIsoDate(payload?.validatedAt)) missing.push("validatedAt");
  if (!nonEmptyString(payload?.tester)) missing.push("tester");
  if (!nonEmptyString(payload?.build)) missing.push("build");
  if (!nonEmptyString(payload?.device) && !nonEmptyString(payload?.environment)) {
    missing.push("device or environment");
  }
  if (!nonEmptyStringArray(payload?.evidence)) missing.push("evidence[]");

  const checks = isRecord(payload) && isRecord(payload.checks) ? payload.checks : {};
  for (const check of spec.requiredChecks) {
    if (checks[check] !== true) missing.push(`checks.${check}`);
  }

  if (spec.requiredProfileNumbers) {
    const profile = isRecord(payload) && isRecord(payload.profile) ? payload.profile : {};
    for (const field of spec.requiredProfileNumbers) {
      if (typeof profile[field] !== "number" || !Number.isFinite(profile[field])) {
        missing.push(`profile.${field}`);
      }
    }
  }
  if (spec.id === "normal-browsing-corpus-validation") {
    validateNormalBrowsingTemplate(payload, missing);
  }
  if (spec.id === "ios-physical-device-validation") {
    validateIosPhysicalDeviceTemplate(payload, missing);
  }
  if (spec.id === "android-real-browser-validation") {
    validateAndroidRealBrowserTemplate(payload, missing);
  }
  if (spec.id === "performance-validation") {
    validatePerformancePlatformProfiles(payload, missing);
  }
  if (spec.id === "store-ad-sandbox-validation") {
    validateStoreAdTemplate(payload, missing);
  }
  if (spec.id === "ai-backend-smoke-validation") {
    validateAiBackendTemplate(payload, missing);
  }

  return missing.length > 0
    ? {
        id: spec.id,
        status: "fail",
        evidence: `${templatePath} is incomplete. Missing: ${missing.join(", ")}.`,
        next: "Sync the template with scripts/validation-evidence-specs.json."
      }
    : {
        id: spec.id,
        status: "pass",
        evidence: `${templatePath} includes ${spec.requiredChecks.length} required checks and ${templateExampleLabel(spec.id)}.`
      };
}

function listDraftPackages() {
  const artifactsDir = join(root, "docs/validation/artifacts");
  if (!existsSync(artifactsDir)) return [];
  return readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("docs/validation/artifacts", entry.name))
    .filter((artifactDir) => existsSync(join(root, artifactDir, "draft-evidence")));
}

function expectedReportArtifactCommands(artifactRoot) {
  return reportArtifactCommandList(artifactRoot);
}

function expectedCaptureHelperCommand(spec, runId, artifactRoot) {
  return captureHelperCommandMap(artifactRoot, runId)[spec.id] ?? null;
}

function missingStringValues(actualValues, expectedValues, label) {
  const actual = Array.isArray(actualValues) ? actualValues : [];
  return expectedValues.filter((value) => !actual.includes(value)).map((value) => `${label} missing ${value}`);
}

function missingSpecValues(entry, spec, fieldName, label) {
  const expectedValues = Array.isArray(spec[fieldName]) ? spec[fieldName] : [];
  const actualValues = Array.isArray(entry?.[fieldName]) ? entry[fieldName] : [];
  return missingStringValues(actualValues, expectedValues, `${label}.${fieldName}`);
}

function validateProductionEnvChecklist(requirements, packagePath, missing) {
  const actualChecklist = isRecord(requirements.productionEnvChecklist) ? requirements.productionEnvChecklist : null;
  const expectedChecklist = productionEnvChecklist();
  const label = `${packagePath}/requirements.json productionEnvChecklist`;

  if (!actualChecklist) {
    missing.push(label);
    return;
  }

  missing.push(...missingStringValues(actualChecklist.clientKeys, expectedChecklist.clientKeys, `${label}.clientKeys`));
  missing.push(
    ...missingStringValues(actualChecklist.publicBackendKeys, expectedChecklist.publicBackendKeys, `${label}.publicBackendKeys`)
  );
  missing.push(...missingStringValues(actualChecklist.serverKeys, expectedChecklist.serverKeys, `${label}.serverKeys`));
  if (actualChecklist.privateEvidenceWarning !== expectedChecklist.privateEvidenceWarning) {
    missing.push(`${label}.privateEvidenceWarning missing ${expectedChecklist.privateEvidenceWarning}`);
  }
}

function validateProductionBlockerGroups(requirements, packagePath, missing) {
  const actualGroups = Array.isArray(requirements.productionBlockerGroups) ? requirements.productionBlockerGroups : [];
  if (actualGroups.length === 0) {
    missing.push(`${packagePath}/requirements.json productionBlockerGroups[]`);
    return;
  }

  for (const expectedGroup of productionBlockerGroups(packagePath, basename(packagePath))) {
    const actualGroup = actualGroups.find((candidate) => isRecord(candidate) && candidate.id === expectedGroup.id);
    const label = `${packagePath}/requirements.json productionBlockerGroups.${expectedGroup.id}`;
    if (!actualGroup) {
      missing.push(`${label} entry`);
      continue;
    }
    if (actualGroup.category !== expectedGroup.category) {
      missing.push(`${label}.category missing ${expectedGroup.category}`);
    }
    if ((actualGroup.evidenceFile ?? null) !== (expectedGroup.evidenceFile ?? null)) {
      missing.push(`${label}.evidenceFile missing ${expectedGroup.evidenceFile ?? null}`);
    }
    if ((actualGroup.captureHelperCommand ?? null) !== (expectedGroup.captureHelperCommand ?? null)) {
      missing.push(`${label}.captureHelperCommand missing ${expectedGroup.captureHelperCommand ?? null}`);
    }
    missing.push(...missingStringValues(actualGroup.requiredEnv ?? [], expectedGroup.requiredEnv ?? [], `${label}.requiredEnv`));
    missing.push(
      ...missingStringValues(actualGroup.requiredReports ?? [], expectedGroup.requiredReports ?? [], `${label}.requiredReports`)
    );
    missing.push(
      ...missingStringValues(actualGroup.preflightCheckIds ?? [], expectedGroup.preflightCheckIds ?? [], `${label}.preflightCheckIds`)
    );
  }
}

function validateDraftPackageRequirements(packagePath, missing) {
  const requirementsPath = join(root, packagePath, "requirements.json");
  if (!existsSync(requirementsPath)) {
    missing.push(`${packagePath}/requirements.json`);
    return;
  }

  let requirements;
  try {
    requirements = JSON.parse(readFileSync(requirementsPath, "utf8"));
  } catch (error) {
    missing.push(`${packagePath}/requirements.json valid JSON`);
    return;
  }

  if (requirements.schemaVersion !== VALIDATION_REQUIREMENTS_SCHEMA_VERSION) {
    missing.push(`${packagePath}/requirements.json schemaVersion missing ${VALIDATION_REQUIREMENTS_SCHEMA_VERSION}`);
  }
  if (!validIsoDate(requirements.generatedAt)) {
    missing.push(`${packagePath}/requirements.json generatedAt`);
  }
  if (requirements.runId !== basename(packagePath)) {
    missing.push(`${packagePath}/requirements.json runId missing ${basename(packagePath)}`);
  }

  const expectedReportCommands = expectedReportArtifactCommands(packagePath);
  const expectedHandoffDocuments = handoffDocumentPaths();
  const expectedHandoffCommands = expectedHandoffCommandsForPackage(packagePath);
  if (!Array.isArray(requirements.reportArtifactCommands)) {
    missing.push(`${packagePath}/requirements.json reportArtifactCommands[]`);
  } else {
    for (const command of expectedReportCommands) {
      if (!requirements.reportArtifactCommands.includes(command)) {
        missing.push(`${packagePath}/requirements.json reportArtifactCommands missing ${command}`);
      }
    }
  }
  if (!Array.isArray(requirements.handoffDocuments)) {
    missing.push(`${packagePath}/requirements.json handoffDocuments[]`);
  } else {
    missing.push(
      ...missingStringValues(requirements.handoffDocuments, expectedHandoffDocuments, `${packagePath}/requirements.json handoffDocuments`)
    );
  }
  if (!Array.isArray(requirements.handoffDocumentCommands)) {
    missing.push(`${packagePath}/requirements.json handoffDocumentCommands[]`);
  } else {
    missing.push(
      ...missingStringValues(
        requirements.handoffDocumentCommands,
        expectedHandoffCommands,
        `${packagePath}/requirements.json handoffDocumentCommands`
      )
    );
  }
  const expectedDraftValidationCommand = `npm run evidence:validation:draft -- ${packagePath}/draft-evidence`;
  const expectedPromotionCommand = `npm run evidence:promote -- --from ${packagePath}/draft-evidence`;
  const expectedFinalVerificationCommand = `npm run verify:release -- --env-file <production-env-file> --artifact-dir ${packagePath}`;
  if (requirements.draftValidationCommand !== expectedDraftValidationCommand) {
    missing.push(`${packagePath}/requirements.json draftValidationCommand missing ${expectedDraftValidationCommand}`);
  }
  if (requirements.promotionCommand !== expectedPromotionCommand) {
    missing.push(`${packagePath}/requirements.json promotionCommand missing ${expectedPromotionCommand}`);
  }
  if (requirements.releaseEvidenceValidationCommand !== "npm run evidence:validation") {
    missing.push(`${packagePath}/requirements.json releaseEvidenceValidationCommand missing npm run evidence:validation`);
  }
  if (requirements.finalVerificationCommand !== expectedFinalVerificationCommand) {
    missing.push(`${packagePath}/requirements.json finalVerificationCommand missing ${expectedFinalVerificationCommand}`);
  }
  validateProductionEnvChecklist(requirements, packagePath, missing);
  validateProductionBlockerGroups(requirements, packagePath, missing);

  const entries = Array.isArray(requirements.requirements) ? requirements.requirements : [];
  for (const spec of validationEvidenceSpecs) {
    const entry = entries.find((candidate) => isRecord(candidate) && candidate.id === spec.id);
    const label = `${packagePath}/requirements.json ${spec.id}`;
    if (!entry) {
      missing.push(`${label} entry`);
      continue;
    }
    missing.push(...missingSpecValues(entry, spec, "requiredChecks", label));
    missing.push(...missingSpecValues(entry, spec, "requiredFields", label));
    missing.push(...missingSpecValues(entry, spec, "requiredCommands", label));
    const expectedHelperCommand = expectedCaptureHelperCommand(spec, basename(packagePath), packagePath);
    if (expectedHelperCommand && entry.captureHelperCommand !== expectedHelperCommand) {
      missing.push(`${label}.captureHelperCommand missing ${expectedHelperCommand}`);
    }
  }
}

function validateDraftPackageReadme(packagePath, missing) {
  const readmePath = join(root, packagePath, "README.md");
  if (!existsSync(readmePath)) {
    missing.push(`${packagePath}/README.md`);
    return;
  }

  const readme = readFileSync(readmePath, "utf8");
  const expectedCommands = [
    "npm run evidence:requirements",
    "npm run evidence:templates",
    ...expectedHandoffCommandsForPackage(packagePath),
    "npm run audit:release"
  ];

  for (const command of expectedCommands) {
    if (!readme.includes(command)) {
      missing.push(`${packagePath}/README.md missing ${command}`);
    }
  }
}

function validateDraftPackageCapturePlan(packagePath, missing) {
  const capturePlanPath = join(root, packagePath, "CAPTURE_PLAN.md");
  if (!existsSync(capturePlanPath)) {
    missing.push(`${packagePath}/CAPTURE_PLAN.md`);
    return;
  }

  const capturePlan = readFileSync(capturePlanPath, "utf8");
  if (!capturePlan.includes("## Canonical Handoff Commands")) {
    missing.push(`${packagePath}/CAPTURE_PLAN.md missing canonical handoff commands section`);
  }
  for (const command of [
    "npm run evidence:requirements",
    "npm run evidence:templates",
    ...expectedHandoffCommandsForPackage(packagePath),
    "npm run audit:release"
  ]) {
    if (!capturePlan.includes(command)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${command}`);
    }
  }
  for (const spec of validationEvidenceSpecs) {
    const helperCommand = expectedCaptureHelperCommand(spec, basename(packagePath), packagePath);
    if (helperCommand && !capturePlan.includes(helperCommand)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${helperCommand}`);
    }
  }
  for (const command of expectedReportArtifactCommands(packagePath)) {
    if (!capturePlan.includes(command)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${command}`);
    }
  }
  for (const group of productionBlockerGroups(packagePath, basename(packagePath))) {
    const expectedText = `\`${group.id}\` (${group.category})`;
    if (!capturePlan.includes(expectedText)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${expectedText}`);
    }
    for (const value of group.requiredEnv ?? []) {
      if (!capturePlan.includes(`Env: \`${value}\``)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing Env: ${value}`);
      }
    }
    for (const value of group.requiredReports ?? []) {
      if (!capturePlan.includes(`Report: \`${value}\``)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing Report: ${value}`);
      }
    }
    for (const value of group.preflightCheckIds ?? []) {
      if (!capturePlan.includes(`Preflight check: \`${value}\``)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing Preflight check: ${value}`);
      }
    }
    if (group.evidenceFile && !capturePlan.includes(`Evidence file: \`${group.evidenceFile}\``)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing Evidence file: ${group.evidenceFile}`);
    }
    if (group.captureHelperCommand && !capturePlan.includes(`Capture helper: \`${group.captureHelperCommand}\``)) {
      missing.push(`${packagePath}/CAPTURE_PLAN.md missing Capture helper: ${group.captureHelperCommand}`);
    }
  }
  for (const spec of validationEvidenceSpecs) {
    for (const check of spec.requiredChecks) {
      if (!capturePlan.includes(`checks.${check}`)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing checks.${check}`);
      }
    }
    for (const field of spec.requiredFields ?? []) {
      if (!capturePlan.includes(field)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${field}`);
      }
    }
    for (const command of spec.requiredCommands ?? []) {
      if (!capturePlan.includes(command)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing ${command}`);
      }
    }
    for (const field of spec.requiredProfileNumbers ?? []) {
      if (!capturePlan.includes(`profile.${field}`)) {
        missing.push(`${packagePath}/CAPTURE_PLAN.md missing profile.${field}`);
      }
    }
  }
}

function validateDraftPackage(packagePath) {
  const missing = [];
  const draftDir = join(root, packagePath, "draft-evidence");
  for (const spec of validationEvidenceSpecs) {
    const draftPath = join(draftDir, basename(spec.file));
    if (!existsSync(draftPath)) {
      missing.push(`${packagePath}/draft-evidence/${basename(spec.file)}`);
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(readFileSync(draftPath, "utf8"));
    } catch (error) {
      missing.push(`${packagePath}/draft-evidence/${basename(spec.file)} valid JSON`);
      continue;
    }

    const payloadMissing = validatePayloadForSpec(payload, spec);
    missing.push(...payloadMissing.map((field) => `${packagePath}/draft-evidence/${basename(spec.file)} ${field}`));
  }

  validateDraftPackageRequirements(packagePath, missing);
  validateDraftPackageReadme(packagePath, missing);
  validateDraftPackageCapturePlan(packagePath, missing);

  return missing.length > 0
    ? {
        id: `draft-package:${basename(packagePath)}`,
        status: "fail",
        evidence: `${packagePath} is stale or incomplete. Missing: ${missing.join(", ")}.`,
        next: "Regenerate with npm run evidence:scaffold -- --run-id <run-id> --force, or sync the draft package with scripts/validation-evidence-specs.json."
      }
    : {
        id: `draft-package:${basename(packagePath)}`,
        status: "pass",
        evidence: `${packagePath} draft JSON, requirements.json, README.md, and CAPTURE_PLAN.md are aligned with the current evidence spec.`
      };
}

function expectedHandoffCommandsForPackage(artifactRoot, runId = basename(artifactRoot)) {
  return handoffDocumentCommandList(artifactRoot, runId);
}

function expectedHandoffDocChecklistPhrases() {
  return [
    "productionEnvChecklist",
    "production env checklist",
    productionEnvChecklist().privateEvidenceWarning
  ];
}

function validateHandoffDoc(docPath) {
  if (!existsSync(join(root, docPath))) {
    return {
      id: `handoff-doc:${docPath}`,
      status: "fail",
      evidence: `${docPath} is missing.`,
      next: "Restore the validation handoff doc before QA capture."
    };
  }

  const artifactRoot = "docs/validation/artifacts/<run-id>";
  const doc = readFileSync(join(root, docPath), "utf8");
  const missing = [
    ...expectedHandoffCommandsForPackage(artifactRoot, "<run-id>").filter((command) => !doc.includes(command)),
    ...expectedHandoffDocChecklistPhrases().filter((phrase) => !doc.includes(phrase))
  ];

  return missing.length > 0
    ? {
        id: `handoff-doc:${docPath}`,
        status: "fail",
        evidence: `${docPath} is missing shared release/evidence handoff details: ${missing.join(", ")}.`,
        next: "Sync the handoff doc with scripts/lib/release-blocker-groups.js so QA runs the current helper/report commands and keeps the production env checklist plus no-secret evidence warning visible."
      }
    : {
        id: `handoff-doc:${docPath}`,
        status: "pass",
        evidence: `${docPath} includes the shared capture-helper, report-artifact, draft validation, promotion, final verification commands, production env checklist reference, and no-secret evidence warning.`
      };
}

const results = [
  ...validationEvidenceSpecs.map(validateTemplate),
  ...listDraftPackages().map(validateDraftPackage),
  validateHandoffDoc("docs/validation/README.md"),
  validateHandoffDoc("docs/validation/evidence-runbook.md")
];
const failed = results.filter((entry) => entry.status === "fail");

console.log("# FREED validation templates and draft packages");
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
