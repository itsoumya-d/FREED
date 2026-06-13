#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-permission-wizard-report-v1";
const FLOW_ORDER =
  "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete";
const DEFAULT_ANDROID_APP_PACKAGE = "app.freed.recovery";
const ANDROID_VPN_CONSENT_SURFACE = "android.net.VpnService.prepare";
const ANDROID_USAGE_ACCESS_SETTINGS_ROUTE = "android.settings.USAGE_ACCESS_SETTINGS";
const ANDROID_ACCESSIBILITY_SETTINGS_ROUTE = "android.settings.ACCESSIBILITY_DETAILS_SETTINGS";
const ANDROID_ACCESSIBILITY_SETTINGS_COMPONENT = `${DEFAULT_ANDROID_APP_PACKAGE}/app.freed.protection.FreedAccessibilityService`;
const DEFAULT_PERMISSION_EXPLANATION =
  "To protect you from explicit content and doomscroll loops, FREED needs these permissions to monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.";

const COMMON_CHECKS = {
  onboardingGoalsShown: "--confirm-onboarding-goals",
  appSelectionShown: "--confirm-app-selection",
  paywallShown: "--confirm-paywall",
  explicitProtectionExplanationShown: "--confirm-protection-explanation",
  guidedPermissionSetupShown: "--confirm-guided-permission-setup",
  activationCompleteShown: "--confirm-activation-complete",
  permissionExplanationBeforeSystemPrompts: "--confirm-explanation-before-system-prompts",
  selectedAppsSitesMonitoringExplained: "--confirm-selected-apps-sites-explained",
  knownAdultDomainBlockingExplained: "--confirm-adult-domain-blocking-explained",
  recoveryChallengeThresholdExplained: "--confirm-recovery-threshold-explained",
  noHiddenMonitoring: "--confirm-no-hidden-monitoring",
  noScreenshotOrOcrLoop: "--confirm-no-screenshot-ocr-loop",
  noRawSelectedTargetsStored: "--confirm-no-raw-selected-targets",
  noRawDomainListStored: "--confirm-no-raw-domain-list",
};

const ANDROID_CHECKS = {
  androidZeroAppContinueDisabled: "--confirm-android-zero-app-disabled",
  androidSetupLaunchedAppSelection: "--confirm-android-setup-launched-app-selection",
  androidAppSelectionReturnAutoSync: "--confirm-android-return-auto-sync",
  androidAppSelectionReturnNativePackageSyncConfirmed: "--confirm-android-native-package-sync",
  androidAppSelectionReturnAutoAdvanceContinued: "--confirm-android-auto-advance",
  androidDnsGuardVpnConsentReturnRefreshed: "--confirm-android-vpn-return-refresh",
  androidDnsGuardVpnConsentSurfaceObserved: "--confirm-android-vpn-consent-surface",
  androidUsageAccessSettingsReturnRefreshed: "--confirm-android-usage-return-refresh",
  androidUsageAccessExactSettingsRouteObserved: "--confirm-android-usage-exact-route",
  androidAccessibilitySettingsReturnRefreshed: "--confirm-android-accessibility-return-refresh",
  androidAccessibilityExactSettingsRouteObserved: "--confirm-android-accessibility-exact-route",
  androidAccessibilityServiceDetailsTargetObserved: "--confirm-android-accessibility-target-component",
  androidSystemSettingsReturnAutoAdvanceContinued: "--confirm-android-settings-auto-advance",
};

const IOS_CHECKS = {
  iosScreenTimeAuthorizationReturnRefreshed: "--confirm-ios-screen-time-return-refresh",
  iosFamilyActivityPickerReturnRefreshed: "--confirm-ios-picker-return-refresh",
  iosSafariSettingsReturnRefreshed: "--confirm-ios-safari-settings-return-refresh",
  iosSystemSettingsReturnAutoAdvanceContinued: "--confirm-ios-auto-advance",
};

const REQUIRED_SUMMARY_PHRASES = [
  "monitor only selected apps and sites",
  "block known adult domains",
  "harmful site, search, or app-limit threshold",
];

function printHelp() {
  console.log(`Usage: npm run evidence:permission-wizard -- [options]

Writes a sanitized local ${SCHEMA_VERSION} JSON report after QA records the
full physical-device permission setup wizard. This helper does not grant OS
permissions and does not replace the Android/iOS physical-device evidence file.

Required options:
  --platform android|ios
  --run-id <id>
  --report docs/validation/artifacts/<run-id>/permission-wizard-report.json
  --test-protection-passed

Required confirmation flags:
  --confirm-onboarding-goals
  --confirm-app-selection
  --confirm-paywall
  --confirm-protection-explanation
  --confirm-guided-permission-setup
  --confirm-activation-complete
  --confirm-explanation-before-system-prompts
  --confirm-selected-apps-sites-explained
  --confirm-adult-domain-blocking-explained
  --confirm-recovery-threshold-explained
  --confirm-no-hidden-monitoring
  --confirm-no-screenshot-ocr-loop
  --confirm-no-raw-selected-targets
  --confirm-no-raw-domain-list

Android-only required options:
  --android-selected-app-count <count>
  --confirm-android-zero-app-disabled
  --confirm-android-setup-launched-app-selection
  --confirm-android-return-auto-sync
  --confirm-android-native-package-sync
  --confirm-android-auto-advance
  --confirm-android-vpn-return-refresh
  --confirm-android-vpn-consent-surface
  --confirm-android-usage-return-refresh
  --confirm-android-usage-exact-route
  --confirm-android-accessibility-return-refresh
  --confirm-android-accessibility-exact-route
  --confirm-android-accessibility-target-component
  --confirm-android-settings-auto-advance

iOS-only required confirmation flags:
  --confirm-ios-screen-time-return-refresh
  --confirm-ios-picker-return-refresh
  --confirm-ios-safari-settings-return-refresh
  --confirm-ios-auto-advance

Convenience flags:
  --confirm-common-flow     Sets all common confirmation flags.
  --confirm-android-flow    Sets all Android-only confirmation flags.
  --confirm-ios-flow        Sets all iOS-only confirmation flags.

Optional:
  --permission-explanation-summary <text>
  --self-test
`);
}

function safeRunId(value) {
  const text = String(value || "").trim();
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(text)) {
    throw new Error("--run-id must be 3-80 characters using letters, numbers, dot, underscore, or hyphen.");
  }
  return text;
}

function parseArgs(argv) {
  const options = {
    androidSelectedAppCount: null,
    checks: {},
    permissionExplanationSummary: DEFAULT_PERMISSION_EXPLANATION,
    platform: "",
    reportPath: "",
    runId: "",
    selfTest: false,
    testProtectionPassed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--android-selected-app-count") {
      options.androidSelectedAppCount = Number(next());
    } else if (arg === "--confirm-android-flow") {
      for (const check of Object.keys(ANDROID_CHECKS)) options.checks[check] = true;
    } else if (arg === "--confirm-common-flow") {
      for (const check of Object.keys(COMMON_CHECKS)) options.checks[check] = true;
    } else if (arg === "--confirm-ios-flow") {
      for (const check of Object.keys(IOS_CHECKS)) options.checks[check] = true;
    } else if (arg === "--permission-explanation-summary") {
      options.permissionExplanationSummary = next();
    } else if (arg === "--platform") {
      options.platform = next().trim().toLowerCase();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--test-protection-passed") {
      options.testProtectionPassed = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      const commonCheck = Object.entries(COMMON_CHECKS).find(([, flag]) => flag === arg);
      const androidCheck = Object.entries(ANDROID_CHECKS).find(([, flag]) => flag === arg);
      const iosCheck = Object.entries(IOS_CHECKS).find(([, flag]) => flag === arg);
      if (commonCheck) options.checks[commonCheck[0]] = true;
      else if (androidCheck) options.checks[androidCheck[0]] = true;
      else if (iosCheck) options.checks[iosCheck[0]] = true;
      else throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.selfTest) return options;
  if (!options.platform || !["android", "ios"].includes(options.platform)) {
    throw new Error("--platform must be android or ios.");
  }
  if (!options.runId) throw new Error("--run-id is required.");
  if (!options.reportPath) throw new Error("--report is required.");
  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  return options;
}

function assertReadyToReport(options) {
  const missing = [];
  if (options.testProtectionPassed !== true) missing.push("--test-protection-passed");

  for (const [check, flag] of Object.entries(COMMON_CHECKS)) {
    if (options.checks[check] !== true) missing.push(flag);
  }
  if (options.platform === "android") {
    for (const [check, flag] of Object.entries(ANDROID_CHECKS)) {
      if (options.checks[check] !== true) missing.push(flag);
    }
    if (!Number.isInteger(options.androidSelectedAppCount) || options.androidSelectedAppCount < 1) {
      missing.push("--android-selected-app-count <count greater than 0>");
    }
  }
  if (options.platform === "ios") {
    for (const [check, flag] of Object.entries(IOS_CHECKS)) {
      if (options.checks[check] !== true) missing.push(flag);
    }
  }

  const summary = String(options.permissionExplanationSummary || "").trim();
  if (!summary) missing.push("--permission-explanation-summary");
  const normalizedSummary = summary.toLowerCase();
  for (const phrase of REQUIRED_SUMMARY_PHRASES) {
    if (!normalizedSummary.includes(phrase)) {
      missing.push(`permission explanation phrase: ${phrase}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Permission wizard report is incomplete. Missing: ${missing.join(", ")}.`);
  }
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function buildReport(options) {
  assertReadyToReport(options);
  const commonChecks = Object.fromEntries(Object.keys(COMMON_CHECKS).map((check) => [check, true]));
  const checks =
    options.platform === "android"
      ? { ...commonChecks, ...Object.fromEntries(Object.keys(ANDROID_CHECKS).map((check) => [check, true])) }
      : options.platform === "ios"
      ? { ...commonChecks, ...Object.fromEntries(Object.keys(IOS_CHECKS).map((check) => [check, true])) }
      : commonChecks;

  checks.testProtectionPassed = true;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    runId: options.runId,
    platform: options.platform,
    flowOrder: FLOW_ORDER,
    permissionExplanationShown: true,
    permissionExplanationSummary: String(options.permissionExplanationSummary).trim(),
    testProtectionPassed: true,
    ...(options.platform === "android"
      ? {
          androidAppPackage: DEFAULT_ANDROID_APP_PACKAGE,
          androidSelectedAppCount: options.androidSelectedAppCount,
          androidDnsGuardVpnConsentSurface: ANDROID_VPN_CONSENT_SURFACE,
          androidUsageAccessSettingsRoute: ANDROID_USAGE_ACCESS_SETTINGS_ROUTE,
          androidAccessibilitySettingsRoute: ANDROID_ACCESSIBILITY_SETTINGS_ROUTE,
          androidAccessibilitySettingsRouteComponent: ANDROID_ACCESSIBILITY_SETTINGS_COMPONENT,
        }
      : {}),
    evidenceRecordPatch: {
      permissionWizardRunId: options.runId,
      permissionWizardArtifact: repoRelative(options.reportPath),
      permissionWizardFlowOrder: FLOW_ORDER,
      permissionExplanationShown: true,
      permissionExplanationSummary: String(options.permissionExplanationSummary).trim(),
      permissionWizardTestProtectionPassed: true,
      ...(options.platform === "android"
        ? {
            appSelectionZeroAppContinueDisabled: true,
            appSelectionReturnFromSetup: true,
            appSelectionReturnAutoSync: true,
            appSelectionReturnNativePackageSyncConfirmed: true,
            appSelectionReturnSelectedAppCount: options.androidSelectedAppCount,
            dnsGuardVpnConsentReturnRefreshed: true,
            dnsGuardVpnConsentSurface: ANDROID_VPN_CONSENT_SURFACE,
            usageAccessSettingsReturnRefreshed: true,
            usageAccessSettingsRoute: ANDROID_USAGE_ACCESS_SETTINGS_ROUTE,
            accessibilitySettingsReturnRefreshed: true,
            accessibilitySettingsRoute: ANDROID_ACCESSIBILITY_SETTINGS_ROUTE,
            accessibilitySettingsRouteComponent: ANDROID_ACCESSIBILITY_SETTINGS_COMPONENT,
            systemSettingsReturnAutoAdvanceContinued: true,
          }
        : options.platform === "ios"
        ? {
            screenTimeAuthorizationReturnRefreshed: true,
            familyActivityPickerReturnRefreshed: true,
            safariSettingsReturnRefreshed: true,
            systemSettingsReturnAutoAdvanceContinued: true,
          }
        : {}),
    },
    releaseBoundary:
      "Manual physical-device permission wizard report only; it does not grant OS permissions, prove store approval, or replace Android/iOS physical-device evidence validation.",
    checks,
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "docs/validation/artifacts/permission-wizard-report-self-test-"));
  try {
    const androidReportPath = path.join(tempRoot, "android-permission-wizard-report.json");
    const androidOptions = parseArgs([
      "--platform",
      "android",
      "--run-id",
      "android-permission-wizard-self-test",
      "--report",
      repoRelative(androidReportPath),
      "--test-protection-passed",
      "--confirm-common-flow",
      "--confirm-android-flow",
      "--android-selected-app-count",
      "2",
    ]);
    const androidReport = buildReport(androidOptions);
    writeReport(androidOptions.reportPath, androidReport);
    const parsedAndroid = JSON.parse(fs.readFileSync(androidOptions.reportPath, "utf8"));
    assert.equal(parsedAndroid.schemaVersion, SCHEMA_VERSION);
    assert.equal(parsedAndroid.platform, "android");
    assert.equal(parsedAndroid.flowOrder, FLOW_ORDER);
    assert.equal(parsedAndroid.sanitized, true);
    assert.equal(parsedAndroid.checks.androidAppSelectionReturnAutoSync, true);
    assert.equal(parsedAndroid.checks.androidDnsGuardVpnConsentReturnRefreshed, true);
    assert.equal(parsedAndroid.checks.androidDnsGuardVpnConsentSurfaceObserved, true);
    assert.equal(parsedAndroid.checks.androidUsageAccessSettingsReturnRefreshed, true);
    assert.equal(parsedAndroid.checks.androidUsageAccessExactSettingsRouteObserved, true);
    assert.equal(parsedAndroid.checks.androidAccessibilitySettingsReturnRefreshed, true);
    assert.equal(parsedAndroid.checks.androidAccessibilityExactSettingsRouteObserved, true);
    assert.equal(parsedAndroid.checks.androidAccessibilityServiceDetailsTargetObserved, true);
    assert.equal(parsedAndroid.checks.androidSystemSettingsReturnAutoAdvanceContinued, true);
    assert.equal(parsedAndroid.androidDnsGuardVpnConsentSurface, ANDROID_VPN_CONSENT_SURFACE);
    assert.equal(parsedAndroid.androidUsageAccessSettingsRoute, ANDROID_USAGE_ACCESS_SETTINGS_ROUTE);
    assert.equal(parsedAndroid.androidAccessibilitySettingsRoute, ANDROID_ACCESSIBILITY_SETTINGS_ROUTE);
    assert.equal(parsedAndroid.androidAccessibilitySettingsRouteComponent, ANDROID_ACCESSIBILITY_SETTINGS_COMPONENT);
    assert.equal(parsedAndroid.evidenceRecordPatch.appSelectionReturnSelectedAppCount, 2);
    assert.equal(parsedAndroid.evidenceRecordPatch.usageAccessSettingsRoute, ANDROID_USAGE_ACCESS_SETTINGS_ROUTE);
    assert.equal(
      parsedAndroid.evidenceRecordPatch.accessibilitySettingsRouteComponent,
      ANDROID_ACCESSIBILITY_SETTINGS_COMPONENT
    );
    assert.equal(parsedAndroid.evidenceRecordPatch.systemSettingsReturnAutoAdvanceContinued, true);

    const iosReportPath = path.join(tempRoot, "ios-permission-wizard-report.json");
    const iosOptions = parseArgs([
      "--platform",
      "ios",
      "--run-id",
      "ios-permission-wizard-self-test",
      "--report",
      repoRelative(iosReportPath),
      "--test-protection-passed",
      "--confirm-common-flow",
      "--confirm-ios-flow",
    ]);
    const iosReport = buildReport(iosOptions);
    writeReport(iosOptions.reportPath, iosReport);
    const parsedIos = JSON.parse(fs.readFileSync(iosOptions.reportPath, "utf8"));
    assert.equal(parsedIos.platform, "ios");
    assert.equal(parsedIos.checks.noRawDomainListStored, true);
    assert.equal(parsedIos.checks.iosScreenTimeAuthorizationReturnRefreshed, true);
    assert.equal(parsedIos.checks.iosFamilyActivityPickerReturnRefreshed, true);
    assert.equal(parsedIos.checks.iosSafariSettingsReturnRefreshed, true);
    assert.equal(parsedIos.checks.iosSystemSettingsReturnAutoAdvanceContinued, true);
    assert.equal(parsedIos.evidenceRecordPatch.systemSettingsReturnAutoAdvanceContinued, true);
    assert.equal("androidSelectedAppCount" in parsedIos, false);

    assert.throws(
      () =>
        buildReport({
          ...androidOptions,
          checks: { ...androidOptions.checks, androidAppSelectionReturnAutoSync: false },
        }),
      /--confirm-android-return-auto-sync/
    );
    assert.throws(
      () =>
        buildReport({
          ...iosOptions,
          checks: { ...iosOptions.checks, iosSafariSettingsReturnRefreshed: false },
        }),
      /--confirm-ios-safari-settings-return-refresh/
    );
    assert.throws(
      () =>
        parseArgs([
          "--platform",
          "android",
          "--run-id",
          "bad-android",
          "--report",
          "docs/validation/evidence/permission-wizard-report.json",
        ]),
      /docs\/validation\/evidence/
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log("permission wizard report self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const report = buildReport(options);
  writeReport(options.reportPath, report);
  console.log(`# FREED permission wizard report
Result: pass
Report: ${repoRelative(options.reportPath)}
Platform: ${report.platform}
Run ID: ${report.runId}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  buildReport,
  parseArgs,
  SCHEMA_VERSION,
  FLOW_ORDER,
};
