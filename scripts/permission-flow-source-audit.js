#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-permission-flow-source-audit-v1";
const DEFAULT_REPORT = "docs/validation/artifacts/permission-flow-current/permission-flow-source-audit.json";

const SOURCE_PATHS = {
  permissionPlan: "src/lib/protection-permissions.ts",
  readiness: "src/lib/protection-readiness.ts",
  appSurface: "src/features/freed-app.tsx",
  recoveryNotificationPermission: "src/lib/recovery-notification-permission.ts",
  nativeBridge: "modules/freed-protection/src/index.ts",
  androidNative: "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
  androidManifest: "modules/freed-protection/android/src/main/AndroidManifest.xml",
  androidStrings: "modules/freed-protection/android/src/main/res/values/strings.xml",
  androidUsageAccessConfigActivity: "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
  iosNative: "modules/freed-protection/ios/FreedProtectionModule.swift",
  validationReadme: "docs/validation/README.md",
  releaseBlockers: "docs/release-blockers.md",
};

const ANDROID_REQUIRED_STEP_IDS = [
  "android-native-adult-domain-feed",
  "android-dns-guard",
  "android-usage-access",
  "android-accessibility",
  "android-doomscroll-apps",
];

const IOS_REQUIRED_STEP_IDS = [
  "ios-screen-time",
  "ios-adult-web-filter",
  "ios-screen-time-targets",
  "ios-selected-app-limit-monitor",
  "ios-safari-content-blocker",
];

const ANDROID_FLOW_ORDER = `${ANDROID_REQUIRED_STEP_IDS.join(">")}>activation-test`;
const IOS_FLOW_ORDER = `${IOS_REQUIRED_STEP_IDS.join(">")}>activation-test`;

function printHelp() {
  console.log(`Usage: npm run audit:permission-flow -- [options]

Validates that FREED's source still matches the strict native permission setup
contract for Android and iOS. This is an offline source audit only; it does not
replace physical-device evidence or store review proof.

Options:
  --report <path>  Sanitized JSON report under docs/validation/artifacts.
                   Default: ${DEFAULT_REPORT}
  --self-test      Run offline parser checks.
`);
}

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--report") options.reportPath = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  return options;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function resolveInputPath(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(resolveInputPath(relativePath), "utf8");
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveInputPath(relativePath))).digest("hex");
}

function hasOrderedSubstrings(text, sequence) {
  let cursor = -1;
  for (const token of sequence) {
    const next = text.indexOf(token, cursor + 1);
    if (next === -1) return false;
    cursor = next;
  }
  return true;
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function finalizeReport(checks, auditedSources) {
  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result: failCount === 0 ? "pass" : "fail",
    passCount,
    failCount,
    auditedSources,
    requiredFlowOrders: {
      android: ANDROID_FLOW_ORDER,
      ios: IOS_FLOW_ORDER,
    },
    releaseBoundary:
      "Source-level permission-flow contract only; physical Android/iOS device evidence, store sandbox purchases, and strict release audit still gate production submission.",
    checks,
  };
}

function buildReport() {
  const checks = [];
  const files = {};
  const auditedSources = [];

  for (const [key, relativePath] of Object.entries(SOURCE_PATHS)) {
    try {
      files[key] = readText(relativePath);
      auditedSources.push({
        path: relativePath,
        sha256: sha256File(relativePath),
      });
    } catch (error) {
      pushCheck(checks, `source-readable-${key}`, false, `${relativePath} could not be read: ${error.message || error}`);
    }
  }

  if (Object.keys(files).length !== Object.keys(SOURCE_PATHS).length) {
    return finalizeReport(checks, auditedSources);
  }

  pushCheck(
    checks,
    "android-required-step-order",
    hasOrderedSubstrings(files.permissionPlan, ANDROID_REQUIRED_STEP_IDS.map((id) => `id: "${id}"`)),
    `Android required setup order is ${ANDROID_FLOW_ORDER}.`,
    "Keep reviewed feed sync, DNS Guard, Usage Access, Accessibility, selected app packages, and activation test in strict order.",
  );
  pushCheck(
    checks,
    "ios-required-step-order",
    hasOrderedSubstrings(files.permissionPlan, IOS_REQUIRED_STEP_IDS.map((id) => `id: "${id}"`)),
    `iOS required setup order is ${IOS_FLOW_ORDER}.`,
    "Keep Family Controls, ManagedSettings, picker targets, DeviceActivity limits, Safari rules, and activation test in strict order.",
  );
  pushCheck(
    checks,
    "android-step-actions",
    includesAll(files.permissionPlan, [
      'action: "sync-adult-domain-feed"',
      'action: "apply-adult-filter"',
      'action: "request-android-notification-permission"',
      'action: "open-usage-access-settings"',
      'action: "request-authorization"',
      'action: "choose-android-apps"',
    ]),
    "Android setup rows map to feed sync, DNS Guard/VPN consent, prompt-first recovery notification visibility, Usage Access, Accessibility, and in-app selected-package sync actions.",
  );
  pushCheck(
    checks,
    "ios-step-actions",
    includesAll(files.permissionPlan, [
      'action: "request-authorization"',
      'action: "apply-adult-filter"',
      'action: "choose-ios-targets"',
      'action: "open-settings"',
    ]),
    "iOS setup rows map to Family Controls authorization, ManagedSettings adult filter, FamilyActivityPicker, and Safari/settings handling.",
  );
  pushCheck(
    checks,
    "required-progress-gate",
    includesAll(files.permissionPlan, [
      "const required = steps.filter((step) => step.required)",
      "ready: required.length > 0 && complete.length === required.length",
    ]),
    "Permission progress only reports ready when every required row is complete.",
  );
  pushCheck(
    checks,
    "android-readiness-native-status-gate",
    includesAll(files.readiness, [
      "protectionCapability.localVpnFallback",
      "protectionStatus?.dnsGuardRuntimeReady === true",
      "protectionStatus?.appInterventionAuthorized",
      "protectionStatus?.usageStatsAuthorized",
      "nativeConfiguredAppCount > 0",
      "activationReady: permissionProgress.ready && adultFilterActive && appInterventionReady",
    ]),
    "Android activation readiness depends on DNS Guard runtime, Accessibility, Usage Access, native selected packages, and permission progress.",
  );
  pushCheck(
    checks,
    "ios-readiness-native-status-gate",
    includesAll(files.readiness, [
      "protectionCapability.managedSettings",
      "protectionCapability.screenTime",
      "protectionStatus?.authorized",
      "selectedIosTargets > 0",
      "protectionStatus?.appLimitScheduled",
      "activationReady: permissionProgress.ready && adultFilterActive && appInterventionReady",
    ]),
    "iOS activation readiness depends on Screen Time authorization, ManagedSettings adult filter, selected targets, DeviceActivity scheduling, and permission progress.",
  );
  pushCheck(
    checks,
    "ui-enforces-next-missing-step",
    includesAll(files.appSurface, [
      "firstRequiredStep",
      "targetStep = firstRequiredStep",
      "Continuing required setup in order: ${targetStep.title}.",
      "orderedSetupActionLabel",
      "return `Continue: ${nextRequiredStep.title}`",
    ]),
    "Setup UI redirects out-of-order taps to the first missing required step and labels buttons with the next required row.",
  );
  pushCheck(
    checks,
    "ui-refreshes-and-auto-advances-on-return",
    includesAll(files.appSurface, [
      'AppState.addEventListener("change"',
      "void onRefresh()",
      "setupAutoAdvanceRef",
      "continueAfterOptional",
      "androidSettingsReturnHintText",
      "androidSettingsRouteInstruction",
      "is still not complete. Finish the opened setup step and return to FREED; setup will continue automatically.",
      "can be finished later. Continuing setup:",
      "runStepAction(nextRequiredStep)",
      "All required setup rows are ready. Running the activation test now.",
    ]),
    "Setup refreshes native status on app return, waits for unfinished required OS settings rows, continues after optional Android settings routes, then auto-advances or runs Test Protection.",
  );
  pushCheck(
    checks,
    "android-one-step-setup-wizard",
    includesAll(files.appSurface, [
      "setupDetailsExpanded",
      "androidOneStepSetup",
      "if (androidOneStepSetup)",
      "androidWizardStep",
      "getAndroidSetupStepSummary",
      "getAndroidSetupStepActionLabel",
      "One step at a time. Android opens the right screen",
      "Advanced details",
      "FREED cannot turn Android permissions on silently",
      "permissionPlan.map((step) => {",
    ]),
    "Android setup defaults to a one-step wizard with one primary action, short copy, progress, and advanced checklist/details hidden behind an explicit affordance.",
    "Keep Android post-paywall setup focused on the next missing required step; do not restore the full checklist as the default path.",
  );
  pushCheck(
    checks,
    "ios-picker-resolves-before-auto-advance",
    includesAll(files.appSurface, [
      'prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: Platform.OS === "android" })',
      'case "choose-ios-targets":',
      "prepareSetupAutoAdvance(targetStep);",
      "runAction(\"apps\", presentFamilyActivityPicker)",
    ]) &&
      includesAll(files.iosNative, [
        'AsyncFunction("presentFamilyActivityPicker") { () async -> [String: Any] in',
        "withCheckedContinuation",
        "finishPicker(message:",
        "Screen Time targets saved and selected app limits scheduled.",
        "No Screen Time targets were selected.",
      ]),
    "iOS Screen Time authorization and picker flows resolve in-app before setup auto-advances instead of waiting for an external AppState return.",
  );
  pushCheck(
    checks,
    "android-app-selection-return-sync",
    includesAll(files.appSurface, [
      "appSelectionReturnPending",
      "Select at least one Android app timer to finish protection setup.",
      "Selected apps are saved. Syncing app timers to native protection now.",
      "runAppPackageSync()",
      "selectedAppPackageCount <= 0",
    ]),
    "Android app selection cannot finish with zero selected packages and returns to setup by syncing packages to native protection.",
  );
  pushCheck(
    checks,
    "activation-test-blocks-activation-save",
    includesAll(files.appSurface, [
      "buildProtectionActivationSignature",
      "statusSignature",
      "activationTestMatchesCurrentStatus",
      "syncNativeAdultDomainFeed()",
      "runActivationDiagnostics(adultSmokeHost, normalSmokeHost, reviewedAdultFeedRequired)",
      "freshReadiness.activationReady",
      "nativeDiagnostics.nativeChecksPassed",
      "activationTest?.adultBlocked &&",
      "activationTestMatchesCurrentStatus",
      "const activationComplete = activationReady && activationTestPassed",
      "Protection status changed since the last activation test. Run Test Protection again before activation can finish.",
      "statusSignature: testedActivationSignature",
      "Finish required protection setup before entering FREED on this device.",
    ]),
    "Activation Complete is available only after local classifier checks, native diagnostics, fresh readiness, and the current permission/feed status signature pass.",
  );
  pushCheck(
    checks,
    "android-native-settings-and-consent-routes",
    includesAll(files.androidNative, [
      "VpnService.prepare(context)",
      "context.startActivity(prepareIntent)",
      "ACTION_ACCESSIBILITY_DETAILS_SETTINGS",
      "Settings.ACTION_APP_NOTIFICATION_SETTINGS",
      "Settings.ACTION_ACCESSIBILITY_SETTINGS",
      "usageAccessSettingsIntent(context)",
      "Settings.ACTION_USAGE_ACCESS_SETTINGS",
      "Settings.EXTRA_APP_PACKAGE",
      "Intent.EXTRA_PACKAGE_NAME",
      "Uri.parse(\"package:${context.packageName}\")",
      "usageAccessConfigIntent(context)",
      "ACTION_PRIVATE_DNS_SETTINGS",
      "Settings.ACTION_APPLICATION_DETAILS_SETTINGS",
      "androidSettingsRoutes()",
      "androidSettingsRouteLabel",
      "androidSettingsRouteInstruction",
      "persistAndroidSettingsRoute",
    ]),
    "Android native module opens exact/fallback OS surfaces for VPN consent, notification visibility, Accessibility, Usage Access, Private DNS, and app settings while recording the route plus a sanitized return instruction.",
  );
  pushCheck(
    checks,
    "android-recovery-notification-route",
    includesAll(files.androidManifest, [
      "android.permission.POST_NOTIFICATIONS",
    ]) &&
      includesAll(files.permissionPlan, [
        'id: "android-recovery-notifications"',
        'permissionLabel: "Notifications"',
        'action: "request-android-notification-permission"',
        "androidNotificationPermissionRequired",
        "androidNotificationPermissionGranted",
      ]) &&
      includesAll(files.appSurface, [
        "androidRecoveryNotificationsNeedAttention",
        "Recovery notifications",
        "requestAndroidRecoveryNotificationVisibility",
        'case "request-android-notification-permission":',
        'prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true, continueAfterOptional: true })',
      ]) &&
      includesAll(files.recoveryNotificationPermission, [
        "requestAndroidRecoveryNotificationVisibility",
        'import("expo-notifications")',
        "getPermissionsAsync",
        "requestPermissionsAsync",
        "getProtectionStatus",
        "openAndroidNotificationSettings",
        "androidNotificationPermissionRequired",
        "androidNotificationPermissionGranted",
      ]) &&
      includesAll(files.androidNative, [
        "Manifest.permission.POST_NOTIFICATIONS",
        "Settings.ACTION_APP_NOTIFICATION_SETTINGS",
        'AsyncFunction("openAndroidNotificationSettings"',
        "androidNotificationPermissionRequired",
        "androidNotificationPermissionGranted",
        "isAndroidNotificationPermissionGranted(context)",
      ]) &&
      includesAll(files.nativeBridge, [
        "androidNotificationPermissionRequired?: boolean",
        "androidNotificationPermissionGranted?: boolean",
        "openAndroidNotificationSettings",
      ]),
    "Android 13+ recovery notification visibility is declared, reported by native status, shown in setup/Profile, requested through the runtime prompt first, then routed to the exact app notification settings screen if still denied.",
    "Keep POST_NOTIFICATIONS, native status fields, TypeScript bridge types, the prompt helper, and the optional recovery-notification setup row aligned.",
  );
  pushCheck(
    checks,
    "android-usage-access-config-rationale",
    includesAll(files.androidManifest, [
      "FreedUsageAccessConfigActivity",
      "android.intent.category.USAGE_ACCESS_CONFIG",
      "android.settings.metadata.USAGE_ACCESS_REASON",
      "@string/freed_usage_access_reason",
    ]) &&
      includesAll(files.androidStrings, [
        "freed_usage_access_reason",
        "aggregate foreground time",
        "does not read screen contents",
        "raw usage events",
      ]) &&
      includesAll(files.androidUsageAccessConfigActivity, [
        "class FreedUsageAccessConfigActivity : Activity()",
        "Usage Access is controlled by Android Settings",
        "freed://protection-setup?source=usage-access-config",
        "openFreedSetup()",
        "freed_settings_return_source",
      ]) &&
      includesAll(files.androidNative, [
        "INTENT_CATEGORY_USAGE_ACCESS_CONFIG",
        "usageAccessConfigIntent(context)",
        "FreedUsageAccessConfigActivity::class.java",
        "androidUsageAccessConfigActivity",
        "androidUsageAccessReason",
      ]) &&
      includesAll(files.nativeBridge, [
        "androidUsageAccessConfigActivity?: string",
        "androidUsageAccessReason?: string",
      ]),
    "Android declares a Settings-discoverable Usage Access config activity and localized reason so users see the bounded app-timer rationale before returning to FREED setup.",
    "Keep the Usage Access config activity, Settings metadata reason, native status fields, and bridge types aligned with Android Settings.",
  );
  pushCheck(
    checks,
    "android-settings-return-deep-link",
    includesAll(files.appSurface, [
      "isProtectionSetupDeepLink",
      "consumeProtectionSetupDeepLink",
      "Returned from Android settings. Refreshing protection setup now.",
      'setScreen("protectionSetup")',
      "consumeFreedLink",
    ]) &&
      includesAll(files.androidUsageAccessConfigActivity, [
        "Intent.ACTION_VIEW",
        "freed://protection-setup?source=usage-access-config",
        "setPackage(packageName)",
        "freed_open_protection_setup",
      ]),
    "Android Usage Access return action opens the registered FREED setup deep link and the app routes it back to protection setup before intervention deep links.",
    "Keep Android Settings return links targeted to protection setup and refresh native status on return.",
  );
  pushCheck(
    checks,
    "android-native-activation-diagnostics",
    includesAll(files.androidNative, [
      "activationDiagnosticsPayload",
      "DNS Guard is not running.",
      "AccessibilityService is not enabled.",
      "Usage Access is not authorized.",
      "No selected app packages are synced for app timers.",
      "DNS Guard resolver list is empty.",
      "Native adult-domain smoke host was not blocked.",
      "Native normal-site smoke host was blocked.",
      '"usageStatsObservedPackageNames" to',
      '"usageStatsTodayMinutesByPackage" to',
      '"androidSettingsRoutes" to androidSettingsRoutes()',
      '"androidSettingsRouteOpened" to',
      '"androidSettingsRouteComponent" to',
      '"androidSettingsRouteLabel" to',
      '"androidSettingsRouteInstruction" to',
      '"androidSettingsRouteOpenedAt" to',
      '"privateDnsMode" to privateDnsMode',
      '"dnsGuardResolverCount" to dnsGuardResolverCount',
      '"dnsGuardSessionQueries" to',
      '"dnsGuardBlockedQueries" to',
      '"dnsGuardUserEnabled" to',
      '"dnsGuardAutoRestartEligible" to',
      '"adultDomainFeedChecksum" to',
    ]),
    "Android native diagnostics fail closed on missing DNS Guard, resolver configuration, Accessibility, Usage Access, app packages, feed, adult block, or normal allow proof, and returns bounded Settings route, Private DNS, UsageStats, DNS Guard, and feed-checksum evidence.",
  );
  pushCheck(
    checks,
    "ios-native-protection-surfaces",
    includesAll(files.iosNative, [
      "AuthorizationCenter.shared.requestAuthorization",
      "ManagedSettingsStore",
      "FamilyActivityPicker",
      "scheduleSelectedAppLimitMonitoring",
      "DeviceActivityCenter().startMonitoring",
      "reloadSafariContentBlocker",
      "UIApplication.openSettingsURLString",
    ]),
    "iOS native module uses Family Controls, ManagedSettings, FamilyActivityPicker, DeviceActivity, Safari Content Blocker reload, and app settings routing.",
  );
  pushCheck(
    checks,
    "ios-native-activation-diagnostics",
    includesAll(files.iosNative, [
      "activationDiagnosticsPayload",
      "Screen Time authorization is not approved.",
      "ManagedSettings adult web filter is not active.",
      "No Screen Time app, category, or web-domain targets are selected.",
      "Selected app daily-limit DeviceActivity monitor is not scheduled.",
      "Safari Content Blocker rules are not synced.",
      "Safari adult-domain smoke host did not match a block rule.",
      "Safari normal-site smoke host matched a block rule.",
    ]),
    "iOS native diagnostics fail closed on missing authorization, adult filter, targets, DeviceActivity schedule, Safari rules, adult block, or normal allow proof.",
  );
  pushCheck(
    checks,
    "ios-safari-disabled-settings-route",
    includesAll(files.appSurface, [
      'targetStep.id === "ios-safari-content-blocker"',
      "protectionStatus?.safariContentBlockerEnabled === false",
      "Opening iOS Settings so you can enable the extension",
      "runAction(\"settings\", openProtectionSettings)",
    ]),
    "When Safari rules exist but the extension is disabled, setup opens iOS Settings instead of pretending sync is enough.",
  );
  pushCheck(
    checks,
    "native-bridge-exposes-required-actions",
    includesAll(files.nativeBridge, [
      "openUsageAccessSettings",
      "openPrivateDnsSettings",
      "openProtectionSettings",
      "presentFamilyActivityPicker",
      "configureSafariContentBlockerRules",
      "configureAdultDomainFeed",
      "configureBlockedAppPackages",
      "runActivationDiagnostics",
      "androidSettingsRouteLabel",
      "androidSettingsRouteInstruction",
    ]),
    "TypeScript native bridge exposes the OS-routing, feed/app sync, picker, Safari, and activation diagnostic calls used by setup.",
  );
  pushCheck(
    checks,
    "docs-match-permission-evidence-contract",
    includesAll(files.validationReadme, [
      "permissionWizardFlowOrder",
      "permissionExplanationShown",
      "permissionWizardTestProtectionPassed",
      "android.appSelectionZeroAppContinueDisabled=true",
      "android.appSelectionReturnAutoSync=true",
      "ios.permissionWizardArtifact",
      "android.permissionWizardArtifact",
    ]) &&
      includesAll(files.releaseBlockers, [
        "Current Android permission evidence note",
        "Current iOS setup note",
        "Current evidence note: Permission setup now renders a shared production explanation",
      ]),
    "Validation docs require permission-wizard artifacts, explanation proof, Test Protection, Android app-selection return sync, and platform permission reports.",
  );

  return finalizeReport(checks, auditedSources);
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  assert.equal(hasOrderedSubstrings("alpha beta gamma", ["alpha", "gamma"]), true);
  assert.equal(hasOrderedSubstrings("beta alpha", ["alpha", "beta"]), false);
  assert.equal(includesAll("one two three", ["one", "three"]), true);
  assert.equal(includesAll("one two", ["one", "three"]), false);
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/permission-flow.json"]), /docs\/validation\/evidence/);
  const report = finalizeReport(
    [
      { id: "one", status: "pass", detail: "ok", next: "" },
      { id: "two", status: "fail", detail: "bad", next: "fix" },
    ],
    [{ path: "source.ts", sha256: "abc" }],
  );
  assert.equal(report.schemaVersion, SCHEMA_VERSION);
  assert.equal(report.result, "fail");
  assert.equal(report.passCount, 1);
  assert.equal(report.failCount, 1);
  assert.equal(report.requiredFlowOrders.android, ANDROID_FLOW_ORDER);
  assert.equal(report.requiredFlowOrders.ios, IOS_FLOW_ORDER);
  console.log("permission flow source audit self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const report = buildReport();
  writeReport(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        result: report.result,
        passCount: report.passCount,
        failCount: report.failCount,
        schema: report.schemaVersion,
        sanitized: report.sanitized,
      },
      null,
      2,
    ),
  );
  if (report.failCount > 0) process.exitCode = 1;
}

main();
