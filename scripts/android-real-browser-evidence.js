#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { resolveAndroidTool } = require("./lib/android-sdk-tools");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHost, safeExternalHttpsUrl } = require("./lib/evidence-target-safety");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const { assertUsefulScreenshot } = require("./lib/png-screenshot-audit");
const {
  DEFAULT_SHORT_FORM_PACKAGE,
  INSTAGRAM_ANDROID_PACKAGE,
  INSTAGRAM_REELS_RULE,
  TIKTOK_ANDROID_PACKAGE_ALIASES,
  TIKTOK_ANDROID_PACKAGES,
  TIKTOK_FEED_RULE,
  TIKTOK_PRIMARY_ANDROID_PACKAGE,
  YOUTUBE_ANDROID_PACKAGE,
  YOUTUBE_SHORTS_RULE,
  shortFormReleaseProfile,
} = require("./lib/android-doomscroll-contract");

const DEFAULT_ALLOWED_URL = "https://youtube.com/results?search_query=workout";
const DEFAULT_APP_PACKAGE = "app.freed.recovery";
const DEFAULT_ACCESSIBILITY_SERVICE = "app.freed.recovery/app.freed.protection.FreedAccessibilityService";
const DEFAULT_BROWSERS = "com.android.chrome=Chrome,org.mozilla.firefox=Firefox,com.microsoft.emmx=Edge,com.sec.android.app.sbrowser=Samsung Internet";
const DEFAULT_LOGCAT_LINES = 1200;
const DEFAULT_WAIT_MS = 8000;
const DEFAULT_BACK_STACK_WAIT_MS = 2000;
const DEFAULT_SHORT_FORM_LABEL = "YouTube Shorts";
const DEFAULT_SHORT_FORM_THRESHOLD_SECONDS = 90;
const DEFAULT_SHORT_FORM_BELOW_THRESHOLD_SECONDS = 60;
const DEFAULT_SHORT_FORM_AT_INTERVENTION_SECONDS = 95;
const DEFAULT_EARNED_UNLOCK_MINUTES = 15;
const DEFAULT_FOCUSED_SEARCH_QUERY = "pornography video";
const DEFAULT_FOCUSED_SEARCH_WAIT_MS = 15000;
const DEFAULT_FOCUSED_WEBVIEW_LABEL = "FREED WebView Fixture";
const DEFAULT_FOCUSED_WEBVIEW_PACKAGE = "app.freed.qawebview";
const DEFAULT_FOCUSED_WEBVIEW_WAIT_MS = 15000;
const DEFAULT_NATIVE_STATUS_WAIT_MS = 5000;
const DEFAULT_DNS_GUARD_VISIBLE_WAIT_MS = 3000;
const DEFAULT_DEVICE_TOOL_TIMEOUT_MS = 30_000;
const ADB_COMMAND = resolveAndroidTool("adb");
const ADB_DISPLAY_COMMAND = "adb";
const PERMISSION_WIZARD_FLOW_ORDER =
  "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete";
const ANDROID_PROTECTION_FLOW_ORDER =
  "android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test";
const ANDROID_USAGE_ACCESS_SETTINGS_ROUTE = "android.settings.USAGE_ACCESS_SETTINGS";
const ANDROID_USAGE_ACCESS_MANUAL_TOGGLE_PATH = "Android Settings > Special app access > Usage access > FREED";
const ANDROID_ACCESSIBILITY_CONFIG_PATH = path.join("modules", "freed-protection", "android", "src", "main", "res", "xml", "freed_accessibility_service.xml");
const ANDROID_POLICY_PACK_PATH = path.join("docs", "store-policy", "android-accessibility-and-fgs-disclosure.md");
const ANDROID_PROTECTION_MANIFEST_PATH = path.join("modules", "freed-protection", "android", "src", "main", "AndroidManifest.xml");
const APP_SCENARIOS = new Set([
  "none",
  "before-limit",
  "shield",
  "earned-unlock",
  "earned-unlock-relock",
  "browser-earned-unlock",
  "both",
  "short-form-below-threshold",
  "short-form",
  "short-form-both",
  "all",
]);
const BROWSER_SCENARIOS = new Set(["none", "allowed", "adult", "focused-search", "synced-feed", "both", "all"]);
let activeDeviceToolTimeoutMs = DEFAULT_DEVICE_TOOL_TIMEOUT_MS;

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_ANDROID_REAL_BROWSER_OUTPUT);
  const options = {
    accessibilityService: process.env.FREED_ANDROID_ACCESSIBILITY_SERVICE || DEFAULT_ACCESSIBILITY_SERVICE,
    adultDomainFeedHost: process.env.FREED_ANDROID_ADULT_DOMAIN_FEED_HOST || "",
    adultUrl: process.env.FREED_ANDROID_REAL_BROWSER_ADULT_URL || "",
    allowedUrl: process.env.FREED_ANDROID_REAL_BROWSER_ALLOWED_URL || DEFAULT_ALLOWED_URL,
    appScenario: process.env.FREED_ANDROID_APP_SCENARIO || "none",
    appPackage: process.env.FREED_ANDROID_PACKAGE || DEFAULT_APP_PACKAGE,
    backStackCheck: process.env.FREED_ANDROID_BACK_STACK_CHECK === "1",
    backStackWaitMs: Number(process.env.FREED_ANDROID_BACK_STACK_WAIT_MS || DEFAULT_BACK_STACK_WAIT_MS),
    browsers: parseBrowsers(process.env.FREED_ANDROID_REAL_BROWSER_PACKAGES || DEFAULT_BROWSERS),
    configuredAppLabel: process.env.FREED_ANDROID_CONFIGURED_APP_LABEL || "",
    configuredAppPackage: process.env.FREED_ANDROID_CONFIGURED_APP_PACKAGE || "",
    device: process.env.FREED_ANDROID_DEVICE || "",
    dnsGuardHost: process.env.FREED_ANDROID_DNS_GUARD_HOST || "",
    dnsGuardProof: process.env.FREED_ANDROID_DNS_GUARD_PROOF === "1",
    dnsGuardProbeTimeoutSeconds: Number(process.env.FREED_ANDROID_DNS_GUARD_PROBE_TIMEOUT_SECONDS || 3),
    dnsGuardRestartProof: process.env.FREED_ANDROID_DNS_GUARD_RESTART_PROOF === "1",
    dnsGuardVisibleWaitMs: Number(process.env.FREED_ANDROID_DNS_GUARD_VISIBLE_WAIT_MS || DEFAULT_DNS_GUARD_VISIBLE_WAIT_MS),
    focusedSearchQuery: process.env.FREED_ANDROID_FOCUSED_SEARCH_QUERY || DEFAULT_FOCUSED_SEARCH_QUERY,
    focusedSearchWaitMs: Number(process.env.FREED_ANDROID_FOCUSED_SEARCH_WAIT_MS || DEFAULT_FOCUSED_SEARCH_WAIT_MS),
    focusedWebViewLabel: process.env.FREED_ANDROID_FOCUSED_WEBVIEW_LABEL || DEFAULT_FOCUSED_WEBVIEW_LABEL,
    focusedWebViewPackage: process.env.FREED_ANDROID_FOCUSED_WEBVIEW_PACKAGE || DEFAULT_FOCUSED_WEBVIEW_PACKAGE,
    focusedWebViewProof: process.env.FREED_ANDROID_FOCUSED_WEBVIEW_PROOF === "1",
    focusedWebViewWaitMs: Number(process.env.FREED_ANDROID_FOCUSED_WEBVIEW_WAIT_MS || DEFAULT_FOCUSED_WEBVIEW_WAIT_MS),
    earnedUnlockMinutes: Number(process.env.FREED_ANDROID_EARNED_UNLOCK_MINUTES || DEFAULT_EARNED_UNLOCK_MINUTES),
    logcatLines: DEFAULT_LOGCAT_LINES,
    listDevicesOnly: false,
    nativeStatusProof: process.env.FREED_ANDROID_NATIVE_STATUS_PROOF === "1",
    nativeStatusWaitMs: Number(process.env.FREED_ANDROID_NATIVE_STATUS_WAIT_MS || DEFAULT_NATIVE_STATUS_WAIT_MS),
    outputDir: process.env.FREED_ANDROID_REAL_BROWSER_OUTPUT || "",
    permissionProof: process.env.FREED_ANDROID_PERMISSION_PROOF === "1",
    planOnly: false,
    playPolicyProof: process.env.FREED_ANDROID_PLAY_POLICY_PROOF === "1",
    runId,
    scenario: "both",
    selfTest: false,
    shortFormAtInterventionSeconds: Number(process.env.FREED_ANDROID_SHORT_FORM_AT_INTERVENTION_SECONDS || DEFAULT_SHORT_FORM_AT_INTERVENTION_SECONDS),
    shortFormBelowThresholdSeconds: Number(process.env.FREED_ANDROID_SHORT_FORM_BELOW_THRESHOLD_SECONDS || DEFAULT_SHORT_FORM_BELOW_THRESHOLD_SECONDS),
    shortFormLabel: process.env.FREED_ANDROID_SHORT_FORM_LABEL || DEFAULT_SHORT_FORM_LABEL,
    shortFormPackage: process.env.FREED_ANDROID_SHORT_FORM_PACKAGE || DEFAULT_SHORT_FORM_PACKAGE,
    shortFormThresholdSeconds: Number(process.env.FREED_ANDROID_SHORT_FORM_THRESHOLD_SECONDS || DEFAULT_SHORT_FORM_THRESHOLD_SECONDS),
    toolTimeoutMs: Number(process.env.FREED_ANDROID_REAL_BROWSER_TOOL_TIMEOUT_MS || DEFAULT_DEVICE_TOOL_TIMEOUT_MS),
    waitMs: DEFAULT_WAIT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--accessibility-service") {
      options.accessibilityService = next();
    } else if (arg === "--adult-domain-feed-host") {
      options.adultDomainFeedHost = next();
    } else if (arg === "--adult-url") {
      options.adultUrl = next();
    } else if (arg === "--allowed-url") {
      options.allowedUrl = next();
    } else if (arg === "--app-scenario") {
      options.appScenario = next();
    } else if (arg === "--app-package") {
      options.appPackage = next();
    } else if (arg === "--back-stack-check") {
      options.backStackCheck = true;
    } else if (arg === "--back-stack-wait-ms") {
      options.backStackWaitMs = Number(next());
    } else if (arg === "--browsers") {
      options.browsers = parseBrowsers(next());
    } else if (arg === "--configured-app-label") {
      options.configuredAppLabel = next();
    } else if (arg === "--configured-app-package") {
      options.configuredAppPackage = next();
    } else if (arg === "--device") {
      options.device = next();
    } else if (arg === "--dns-guard-host") {
      options.dnsGuardHost = next();
      options.dnsGuardProof = true;
    } else if (arg === "--dns-guard-probe-timeout-seconds") {
      options.dnsGuardProbeTimeoutSeconds = Number(next());
    } else if (arg === "--dns-guard-proof") {
      options.dnsGuardProof = true;
    } else if (arg === "--dns-guard-restart-proof") {
      options.dnsGuardRestartProof = true;
      options.nativeStatusProof = true;
    } else if (arg === "--dns-guard-visible-wait-ms") {
      options.dnsGuardVisibleWaitMs = Number(next());
    } else if (arg === "--focused-search-query") {
      options.focusedSearchQuery = next();
    } else if (arg === "--focused-search-wait-ms") {
      options.focusedSearchWaitMs = Number(next());
    } else if (arg === "--focused-webview-label") {
      options.focusedWebViewLabel = next();
    } else if (arg === "--focused-webview-package") {
      options.focusedWebViewPackage = next();
      options.focusedWebViewProof = true;
    } else if (arg === "--focused-webview-proof") {
      options.focusedWebViewProof = true;
    } else if (arg === "--focused-webview-wait-ms") {
      options.focusedWebViewWaitMs = Number(next());
    } else if (arg === "--earned-unlock-minutes") {
      options.earnedUnlockMinutes = Number(next());
    } else if (arg === "--logcat-lines") {
      options.logcatLines = Number(next());
    } else if (arg === "--list-devices") {
      options.listDevicesOnly = true;
    } else if (arg === "--native-status-proof") {
      options.nativeStatusProof = true;
    } else if (arg === "--native-status-wait-ms") {
      options.nativeStatusWaitMs = Number(next());
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--permission-proof") {
      options.permissionProof = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--play-policy-proof") {
      options.playPolicyProof = true;
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--scenario") {
      options.scenario = next();
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--short-form-at-intervention-seconds") {
      options.shortFormAtInterventionSeconds = Number(next());
    } else if (arg === "--short-form-below-threshold-seconds") {
      options.shortFormBelowThresholdSeconds = Number(next());
    } else if (arg === "--short-form-label") {
      options.shortFormLabel = next();
    } else if (arg === "--short-form-package") {
      options.shortFormPackage = next();
    } else if (arg === "--short-form-threshold-seconds") {
      options.shortFormThresholdSeconds = Number(next());
    } else if (arg === "--tool-timeout-ms") {
      options.toolTimeoutMs = Number(next());
    } else if (arg === "--wait-ms") {
      options.waitMs = Number(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!BROWSER_SCENARIOS.has(options.scenario)) {
    throw new Error("--scenario must be one of: none, allowed, adult, focused-search, synced-feed, both, all");
  }
  if (!APP_SCENARIOS.has(options.appScenario)) {
    throw new Error("--app-scenario must be one of: none, before-limit, shield, earned-unlock, earned-unlock-relock, browser-earned-unlock, both, short-form-below-threshold, short-form, short-form-both, all");
  }
  if (!Number.isInteger(options.logcatLines) || options.logcatLines <= 0) {
    throw new Error("--logcat-lines must be a positive integer");
  }
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error("--wait-ms must be a non-negative number");
  }
  if (!Number.isInteger(options.toolTimeoutMs) || options.toolTimeoutMs < 1000 || options.toolTimeoutMs > 300000) {
    throw new Error("--tool-timeout-ms must be an integer from 1000 to 300000.");
  }
  if (!Number.isInteger(options.dnsGuardProbeTimeoutSeconds) || options.dnsGuardProbeTimeoutSeconds < 1 || options.dnsGuardProbeTimeoutSeconds > 15) {
    throw new Error("--dns-guard-probe-timeout-seconds must be from 1 to 15.");
  }
  if (!Number.isFinite(options.dnsGuardVisibleWaitMs) || options.dnsGuardVisibleWaitMs < 500 || options.dnsGuardVisibleWaitMs > 30000) {
    throw new Error("--dns-guard-visible-wait-ms must be from 500 to 30000.");
  }
  if (!Number.isFinite(options.backStackWaitMs) || options.backStackWaitMs < 500 || options.backStackWaitMs > 10000) {
    throw new Error("--back-stack-wait-ms must be from 500 to 10000.");
  }
  if (!Number.isFinite(options.nativeStatusWaitMs) || options.nativeStatusWaitMs < 1000 || options.nativeStatusWaitMs > 60000) {
    throw new Error("--native-status-wait-ms must be from 1000 to 60000.");
  }
  if (!Number.isInteger(options.earnedUnlockMinutes) || options.earnedUnlockMinutes < 1 || options.earnedUnlockMinutes > 120) {
    throw new Error("--earned-unlock-minutes must be an integer from 1 to 120.");
  }
  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "android-real-browser-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) {
    return options;
  }
  if (options.listDevicesOnly) {
    return options;
  }
  if (options.scenario !== "none" && options.browsers.length === 0) {
    throw new Error("--browsers must include at least one package");
  }
  if (!Number.isFinite(options.focusedSearchWaitMs) || options.focusedSearchWaitMs < 5000 || options.focusedSearchWaitMs > 120000) {
    throw new Error("--focused-search-wait-ms must be from 5000 to 120000.");
  }
  if (!Number.isFinite(options.focusedWebViewWaitMs) || options.focusedWebViewWaitMs < 5000 || options.focusedWebViewWaitMs > 120000) {
    throw new Error("--focused-webview-wait-ms must be from 5000 to 120000.");
  }
  if (["adult", "both", "all"].includes(options.scenario) && !options.adultUrl) {
    throw new Error("--adult-url is required for adult interception capture. Use a real external adult-classified HTTPS URL.");
  }
  if (["adult", "both", "all"].includes(options.scenario)) {
    options.adultUrl = safeExternalHttpsUrl(options.adultUrl, "--adult-url");
  }
  if (["browser-earned-unlock", "all"].includes(options.appScenario) && !options.adultUrl) {
    throw new Error("--adult-url is required for browser-earned-unlock app evidence. Use the real blocked browser/adult-domain source that produced the challenge.");
  }
  if (["browser-earned-unlock", "all"].includes(options.appScenario) && options.scenario === "none") {
    options.adultUrl = safeExternalHttpsUrl(options.adultUrl, "--adult-url");
  }
  if (["allowed", "focused-search", "both", "all"].includes(options.scenario) && !options.allowedUrl) {
    throw new Error("--allowed-url is required for normal browsing capture.");
  }
  if (["allowed", "focused-search", "both", "all"].includes(options.scenario)) {
    options.allowedUrl = safeExternalHttpsUrl(options.allowedUrl, "--allowed-url");
  }
  if (["focused-search", "all"].includes(options.scenario)) {
    validateFocusedSearchQuery(options.focusedSearchQuery);
  }
  if (options.adultDomainFeedHost) {
    options.adultDomainFeedHost = safeExternalHost(options.adultDomainFeedHost, "--adult-domain-feed-host");
  }
  if (options.scenario === "synced-feed" && !options.adultDomainFeedHost) {
    throw new Error("--adult-domain-feed-host is required for synced-feed capture.");
  }
  if (options.dnsGuardHost) {
    options.dnsGuardHost = safeExternalHost(options.dnsGuardHost, "--dns-guard-host");
    options.dnsGuardProof = true;
  }
  if (options.dnsGuardProof && !options.dnsGuardHost) {
    if (options.adultDomainFeedHost) {
      options.dnsGuardHost = options.adultDomainFeedHost;
    } else if (options.adultUrl) {
      options.dnsGuardHost = safeExternalHost(options.adultUrl, "--adult-url");
    } else {
      throw new Error("--dns-guard-proof requires --dns-guard-host, --adult-domain-feed-host, or --adult-url.");
    }
  }
  if (options.dnsGuardRestartProof) {
    options.nativeStatusProof = true;
  }
  if (requiresConfiguredAppPackage(options.appScenario)) {
    if (!options.configuredAppPackage) {
      throw new Error("--configured-app-package is required for before-limit, shield, earned-unlock, earned-unlock-relock, browser-earned-unlock, both, and all app scenarios.");
    }
    options.configuredAppPackage = safeAndroidPackage(options.configuredAppPackage, "--configured-app-package");
  }
  if (requiresShortFormPackage(options.appScenario)) {
    options.shortFormPackage = safeAndroidPackage(options.shortFormPackage, "--short-form-package");
    validateShortFormTimings(options);
  }
  if (options.focusedWebViewProof) {
    options.focusedWebViewPackage = safeAndroidPackage(options.focusedWebViewPackage, "--focused-webview-package");
  }
  if (
    options.scenario === "none" &&
    options.appScenario === "none" &&
    !options.dnsGuardProof &&
    !options.dnsGuardRestartProof &&
    !options.permissionProof &&
    !options.nativeStatusProof &&
    !options.focusedWebViewProof &&
    !options.playPolicyProof
  ) {
    throw new Error("No capture scenarios requested. Use --scenario, --app-scenario, --dns-guard-proof, --dns-guard-restart-proof, --permission-proof, --native-status-proof, --focused-webview-proof, --play-policy-proof, or a combination.");
  }
  return options;
}

function printHelp() {
  console.log(`Usage: npm run evidence:android-real-browser -- [options]

Collects physical Android browser evidence artifacts for the android-real-browser
release gate. This script refuses emulator targets and writes audited screenshots,
logcat extracts, top-activity dumps, a capture manifest, and a pending final-shape
evidence fill template for manual QA review. It also writes the required manual
challenge-verification checklist for ML Kit camera, motion, steps, and
foreground-location proof. It does not promote or mark release evidence as
passing.

Options:
  --adult-url <url>              Required for adult/both scenarios.
  --adult-domain-feed-host <host>
                                 Reviewed synced-feed-only adult host for
                                 adult-domain feed Accessibility proof.
  --allowed-url <url>            Normal browsing URL. Default: ${DEFAULT_ALLOWED_URL}
  --app-scenario <mode>          App launch capture: none, before-limit, shield,
                                 earned-unlock, earned-unlock-relock,
                                 browser-earned-unlock, both,
                                 short-form-below-threshold, short-form,
                                 short-form-both, or all. Default: none.
  --app-package <package>        FREED package. Default: ${DEFAULT_APP_PACKAGE}
  --back-stack-check             After expected-block captures, press Back and
                                 capture proof that the blocked page is not
                                 restored.
  --back-stack-wait-ms <ms>      Wait after Back before capture. Default:
                                 ${DEFAULT_BACK_STACK_WAIT_MS}
  --browsers <list>              Comma list of package=Label. Default:
                                 ${DEFAULT_BROWSERS}
  --configured-app-package <pkg> Supported doomscroll app package selected in
                                 FREED, such as com.instagram.android.
  --configured-app-label <name>  Human label for --configured-app-package.
  --short-form-package <pkg>     Short-form app package. Default: ${DEFAULT_SHORT_FORM_PACKAGE}
  --short-form-label <name>      Human label for short-form capture. Default: ${DEFAULT_SHORT_FORM_LABEL}
  --short-form-threshold-seconds <n>
                                 Configured FREED threshold. Default: ${DEFAULT_SHORT_FORM_THRESHOLD_SECONDS}
  --short-form-below-threshold-seconds <n>
                                 Below-threshold allow duration. Default: ${DEFAULT_SHORT_FORM_BELOW_THRESHOLD_SECONDS}
  --short-form-at-intervention-seconds <n>
                                 Sustained capture duration. Default: ${DEFAULT_SHORT_FORM_AT_INTERVENTION_SECONDS}
  --device <serial>              adb physical-device serial. Required if more
                                 than one target is attached.
  --dns-guard-proof              Capture Private DNS/VPN state plus device DNS
                                 probe output for a reviewed adult host.
  --dns-guard-host <host>        Host for --dns-guard-proof. Defaults to
                                 --adult-domain-feed-host, then --adult-url.
  --dns-guard-probe-timeout-seconds <n>
                                 Timeout for shell DNS probes. Default: 3.
  --dns-guard-visible-wait-ms <ms>
                                 Wait after DNS probes before capturing the
                                 recovery notification/activity proof. Default:
                                 ${DEFAULT_DNS_GUARD_VISIBLE_WAIT_MS}
  --dns-guard-restart-proof      Capture boot/package-update restart diagnostics
                                 and Profile native status text for DNS Guard.
  --output-dir <path>            Artifact output folder.
  --permission-proof             Capture Accessibility, Usage Access app-op,
                                 Android 13+ notification permission,
                                 notification-listener, VPN, and FREED package
                                 diagnostics for permission evidence fields.
  --play-policy-proof            Generate a local Play policy artifact from the
                                 Android disclosure pack and native manifest
                                 declarations. Does not replace Play review IDs.
  --run-id <id>                  Machine-readable run id.
  --focused-search-query <text> High-confidence adult search text for manual
                                 focused-field capture. Default is a synthetic
                                 QA adult-consumption query.
  --focused-search-wait-ms <ms> Wait while QA types focused-search query.
                                 Default: ${DEFAULT_FOCUSED_SEARCH_WAIT_MS}
  --focused-webview-proof        Open the QA WebView fixture and capture the
                                 focused URL-field handoff proof.
  --focused-webview-package <pkg>
                                 Focused WebView fixture package. Default:
                                 ${DEFAULT_FOCUSED_WEBVIEW_PACKAGE}
  --focused-webview-label <name> Human label for WebView fixture. Default:
                                 ${DEFAULT_FOCUSED_WEBVIEW_LABEL}
  --focused-webview-wait-ms <ms> Wait while QA taps the fixture Adult Test
                                 field. Default: ${DEFAULT_FOCUSED_WEBVIEW_WAIT_MS}
  --earned-unlock-minutes <n>    Earned unlock duration for app allow/relock
                                 evidence. Default: ${DEFAULT_EARNED_UNLOCK_MINUTES}
  --scenario <none|allowed|adult|focused-search|synced-feed|both|all>
                                 Default: both. all includes synced-feed only
                                 when --adult-domain-feed-host is set.
  --wait-ms <ms>                 Wait after each browser launch. Default: ${DEFAULT_WAIT_MS}
  --logcat-lines <count>         Logcat lines per scenario. Default: ${DEFAULT_LOGCAT_LINES}
  --list-devices                 Run bounded adb device discovery, write
                                 android-device-discovery.json, and exit.
                                 This is a setup handoff only, not release
                                 evidence.
  --tool-timeout-ms <ms>         Timeout for adb device-tool commands and
                                 screenshots. Default: ${DEFAULT_DEVICE_TOOL_TIMEOUT_MS}
  --native-status-proof          Bring FREED forward and capture a screenshot,
                                 UI text, and activity dump for the Profile
                                 Native Protection status evidence fields.
  --native-status-wait-ms <ms>   Wait before native-status capture. Default:
                                 ${DEFAULT_NATIVE_STATUS_WAIT_MS}
  --plan-only                    Print the planned capture without adb.
  --self-test                    Run offline parser and safety checks.
`);
}

function safeAndroidPackage(value, label) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(normalized)) {
    throw new Error(`${label} must be an Android package name.`);
  }
  return normalized;
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function requiresConfiguredAppPackage(appScenario) {
  return ["before-limit", "shield", "earned-unlock", "earned-unlock-relock", "browser-earned-unlock", "both", "all"].includes(appScenario);
}

function requiresShortFormPackage(appScenario) {
  return ["short-form-below-threshold", "short-form", "short-form-both", "all"].includes(appScenario);
}

function configuredAppInterventionId(packageName) {
  return `configured-app:${packageName}`;
}

function earnedUnlockProof(app, options, phase) {
  const durationMinutes = Number.isInteger(options.earnedUnlockMinutes) ? options.earnedUnlockMinutes : DEFAULT_EARNED_UNLOCK_MINUTES;
  const common = {
    durationField: "android.earnedUnlockDurationMinutes",
    durationMinutes,
    earnedUnlockReportSchema: "freed-android-earned-unlock-report-v1",
    expectedPackage: app.packageName,
    packageField: "android.earnedUnlockSourcePackage",
  };
  if (phase === "allow") {
    return {
      ...common,
      artifactField: "android.earnedUnlockAppAllowArtifact",
      check: "earnedUnlockAllowsConfiguredApp",
      runIdField: "android.earnedUnlockAppAllowRunId",
    };
  }
  return {
    ...common,
    artifactField: "android.earnedUnlockRelockArtifact",
    check: "earnedUnlockAutoRelock",
    relockUsageMinutesField: "android.earnedUnlockRelockUsageMinutes",
    relockUsageMustBeAtLeastField: "android.configuredAppShieldDailyLimitMinutes",
    runIdField: "android.earnedUnlockRelockRunId",
  };
}

function shortFormSustainedProof(app, options) {
  const profile = shortFormReleaseProfile(app.packageName);
  if (!profile) {
    return {
      expectedPackage: app.packageName,
      expectedThresholdSeconds: options.shortFormThresholdSeconds,
      observedSecondsField: null,
      releaseValidatorField: false,
    };
  }
  return {
    artifactField: profile.artifactField,
    expectedInterventionId: profile.interventionId,
    expectedPackage: profile.packageField === "android.shortFormPackage" ? YOUTUBE_ANDROID_PACKAGE : app.packageName,
    expectedThresholdSeconds: options.shortFormThresholdSeconds,
    interventionReportSchema: "freed-android-app-intervention-report-v1",
    interventionIdField: profile.interventionIdField,
    observedSecondsField: profile.atInterventionSecondsField,
    packageField: profile.packageField,
    releaseValidatorField: true,
    runIdField: profile.runIdField,
    selectedSurfaceArtifactField: profile.selectedSurfaceArtifactField || null,
    selectedSurfaceExpected: Boolean(profile.selectedSurfaceVerifiedField),
    selectedSurfaceReportSchema: profile.selectedSurfaceArtifactField ? "freed-short-form-surface-report-v1" : null,
    selectedSurfaceVerifiedField: profile.selectedSurfaceVerifiedField || null,
    surface: profile.surface,
    usageBeforeLimitField: profile.usageBeforeLimitField,
    usageMustBeLowerThanField: "android.configuredAppShieldDailyLimitMinutes",
  };
}

function shortFormBelowThresholdProof(app, options) {
  const profile = shortFormReleaseProfile(app.packageName);
  if (!profile?.belowThresholdArtifactField) {
    return {
      expectedPackage: app.packageName,
      expectedThresholdSeconds: options.shortFormThresholdSeconds,
      observedSecondsField: null,
      releaseValidatorField: false,
    };
  }
  return {
    artifactField: profile.belowThresholdArtifactField,
    expectedPackage: YOUTUBE_ANDROID_PACKAGE,
    expectedThresholdSeconds: options.shortFormThresholdSeconds,
    interventionReportSchema: "freed-android-app-intervention-report-v1",
    observedSecondsField: profile.belowThresholdSecondsField,
    packageField: profile.packageField,
    releaseValidatorField: true,
    runIdField: profile.belowThresholdRunIdField,
    surface: profile.surface,
    usageBeforeLimitField: profile.usageBeforeLimitField,
    usageMustBeLowerThanField: "android.configuredAppShieldDailyLimitMinutes",
  };
}

function validateShortFormTimings(options) {
  if (!Number.isInteger(options.shortFormThresholdSeconds) || options.shortFormThresholdSeconds < 30 || options.shortFormThresholdSeconds > 300) {
    throw new Error("--short-form-threshold-seconds must be an integer from 30 to 300.");
  }
  if (
    !Number.isInteger(options.shortFormBelowThresholdSeconds) ||
    options.shortFormBelowThresholdSeconds < 1 ||
    options.shortFormBelowThresholdSeconds >= options.shortFormThresholdSeconds
  ) {
    throw new Error("--short-form-below-threshold-seconds must be lower than --short-form-threshold-seconds.");
  }
  if (
    !Number.isInteger(options.shortFormAtInterventionSeconds) ||
    options.shortFormAtInterventionSeconds < options.shortFormThresholdSeconds ||
    options.shortFormAtInterventionSeconds > options.shortFormThresholdSeconds + 120
  ) {
    throw new Error("--short-form-at-intervention-seconds must be at least the threshold and within 120 seconds after it.");
  }
}

function validateFocusedSearchQuery(value) {
  const normalized = String(value).trim();
  if (normalized.length < 3 || normalized.length > 120) {
    throw new Error("--focused-search-query must be 3 to 120 characters.");
  }
  if (/https?:\/\//i.test(normalized) || /[\r\n\t]/.test(normalized)) {
    throw new Error("--focused-search-query must be raw search text, not a URL or multiline value.");
  }
  const signal = focusedSearchSignal(normalized);
  if (!signal) {
    throw new Error("--focused-search-query must include a high-confidence adult-search term.");
  }
  if (!focusedSearchHasConsumptionIntent(normalized)) {
    throw new Error("--focused-search-query must use adult-consumption wording, not recovery or education wording.");
  }
  return { normalized, signal };
}

function focusedSearchSignal(value) {
  const normalized = String(value).toLowerCase();
  const signals = [
    "porn",
    "pornography",
    "porno",
    "xxx",
    "adult video",
    "nude videos",
    "nsfw video",
    "hentai",
    "camgirl",
    "onlyfans leak",
    "xvideos",
    "xnxx",
    "xhamster",
    "redtube",
    "youporn",
    "chaturbate",
    "stripchat",
    "nsfw",
  ];
  return signals.find((signal) => {
    if (signal.includes(" ")) return normalized.includes(signal);
    return new RegExp(`(^|[^a-z0-9])${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(normalized);
  }) || "";
}

function focusedSearchHasConsumptionIntent(value) {
  const normalized = String(value).toLowerCase();
  return [
    "watch",
    "stream",
    "download",
    "free",
    "full",
    "leak",
    "gallery",
    "pic",
    "pics",
    "image",
    "images",
    "uncensored",
    "video",
    "videos",
  ].some((term) => new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(normalized));
}

function parseBrowsers(value) {
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [packageName, ...labelParts] = entry.split("=");
      const label = labelParts.join("=").trim() || packageName.trim();
      return { label, packageName: safeAndroidPackage(packageName, "--browsers") };
    });
}

function scenarioPlan(options) {
  const scenarios = [];
  if (options.scenario === "none") return scenarios;
  if (["allowed", "both", "all"].includes(options.scenario)) {
    scenarios.push({ expected: "allow", name: "allowed", url: options.allowedUrl });
  }
  if (["adult", "both", "all"].includes(options.scenario)) {
    scenarios.push({ expected: "block", name: "adult", url: options.adultUrl });
  }
  if (["focused-search", "all"].includes(options.scenario)) {
    const { signal } = validateFocusedSearchQuery(options.focusedSearchQuery);
    scenarios.push({
      expected: "block",
      focusedSearchProof: {
        expectedMatchedRule: `focused-search:${signal}`,
        expectedRedactedHost: "focused-search.app.freed.local",
        rawQueryStored: false,
      },
      manualPrerequisite:
        "After the browser opens, tap the address/search field, type the configured high-confidence adult-consumption search text, and confirm FREED opens before relying on loaded search results.",
      name: "focused-browser-search",
      suggestedEvidenceField: "android.focusedBrowserSearchArtifact",
      url: options.allowedUrl,
      waitMs: options.focusedSearchWaitMs,
    });
  }
  if (options.scenario === "synced-feed" || (options.scenario === "all" && options.adultDomainFeedHost)) {
    const host = safeExternalHost(options.adultDomainFeedHost, "--adult-domain-feed-host");
    scenarios.push({
      adultDomainFeedProof: {
        expectedClassifiedHost: host,
        expectedSource: "synced-adult-domain-feed",
        pairedDnsGuardEvidenceField: "android.adultDomainFeedDnsGuardArtifact",
      },
      expected: "block",
      manualPrerequisite:
        "Use a reviewed synced-feed-only adult host that is present in the current native adult-domain feed version/checksum/domain count and absent from the embedded seed list.",
      name: "synced-adult-domain-feed",
      suggestedEvidenceField: "android.adultDomainFeedAccessibilityArtifact",
      url: `https://${host}/`,
    });
  }
  return scenarios;
}

function appScenarioPlan(options) {
  const scenarios = [];
  if (options.appScenario === "none") return scenarios;
  const app = options.configuredAppPackage
    ? {
        label: options.configuredAppLabel || options.configuredAppPackage,
        packageName: options.configuredAppPackage,
      }
    : null;
  const shortFormApp = {
    label: options.shortFormLabel || options.shortFormPackage,
    packageName: options.shortFormPackage,
  };
  if (["before-limit", "all"].includes(options.appScenario)) {
    scenarios.push({
      app,
      configuredAppShieldProof: {
        artifactField: "android.configuredAppShieldBeforeLimitAllowArtifact",
        expectedPackage: app.packageName,
        interventionReportSchema: "freed-android-app-intervention-report-v1",
        packageField: "android.configuredAppShieldPackage",
        runIdField: "android.configuredAppShieldBeforeLimitAllowRunId",
        usageMinutesField: "android.configuredAppShieldUsageBeforeLimitMinutes",
      },
      expected: "allow",
      manualPrerequisite:
        "FREED Accessibility is enabled, this app package is selected in Shield settings, daily usage for the package is below the configured daily limit, and no earned unlock is active.",
      name: "configured-app-before-limit-allow",
      suggestedEvidenceField: "android.configuredAppShieldBeforeLimitAllowArtifact",
    });
  }
  if (["shield", "both", "all"].includes(options.appScenario)) {
    scenarios.push({
      app,
      configuredAppShieldProof: {
        artifactField: "android.configuredAppShieldArtifact",
        expectedInterventionId: configuredAppInterventionId(app.packageName),
        expectedPackage: app.packageName,
        interventionReportSchema: "freed-android-app-intervention-report-v1",
        interventionIdField: "android.configuredAppShieldInterventionId",
        packageField: "android.configuredAppShieldPackage",
        runIdField: "android.configuredAppShieldRunId",
        usageMinutesField: "android.configuredAppShieldUsageAtInterventionMinutes",
      },
      expected: "block",
      manualPrerequisite:
        "FREED Accessibility is enabled, this app package is selected in Shield settings, daily usage for the package is at or above the configured daily limit, and no earned unlock is active.",
      name: "configured-app-shield",
      suggestedEvidenceField: "android.configuredAppShieldArtifact",
    });
  }
  if (["earned-unlock", "both", "all"].includes(options.appScenario)) {
    scenarios.push({
      app,
      earnedUnlockProof: earnedUnlockProof(app, options, "allow"),
      expected: "allow",
      manualPrerequisite:
        `The same app package is selected in Shield settings and a ${options.earnedUnlockMinutes || DEFAULT_EARNED_UNLOCK_MINUTES}-minute earned unlock window is currently active.`,
      name: "earned-unlock-app-allow",
      suggestedEvidenceField: "android.earnedUnlockAppAllowArtifact",
    });
  }
  if (["earned-unlock", "earned-unlock-relock", "both", "all"].includes(options.appScenario)) {
    scenarios.push({
      app,
      earnedUnlockProof: earnedUnlockProof(app, options, "relock"),
      expected: "block",
      manualPrerequisite:
        "The same app package is selected in Shield settings, the earned unlock window has expired, and daily usage is still at or above the configured limit.",
      name: "earned-unlock-relock",
      suggestedEvidenceField: "android.earnedUnlockRelockArtifact",
    });
  }
  if (["browser-earned-unlock", "all"].includes(options.appScenario)) {
    scenarios.push({
      app,
      browserEarnedUnlockNoAppUnlockProof: {
        adultFilterStillActiveField: "android.browserEarnedUnlockAdultFilterStillActive",
        artifactField: "android.browserEarnedUnlockNoAppUnlockArtifact",
        check: "browserEarnedUnlockDoesNotUnlockApps",
        durationField: "android.earnedUnlockDurationMinutes",
        durationMinutes: options.earnedUnlockMinutes || DEFAULT_EARNED_UNLOCK_MINUTES,
        earnedUnlockReportSchema: "freed-android-browser-earned-unlock-report-v1",
        configuredAppStillShieldedField: "android.browserEarnedUnlockConfiguredAppStillShielded",
        expectedAdultFilterStillActive: true,
        expectedConfiguredAppPackage: app.packageName,
        expectedConfiguredAppStillShielded: true,
        expectedNativeAppUnlockActive: false,
        expectedSourceHost: safeExternalHost(options.adultUrl, "--adult-url"),
        nativeAppUnlockActiveField: "android.browserEarnedUnlockNativeAppUnlockActive",
        runIdField: "android.browserEarnedUnlockNoAppUnlockRunId",
        sourceHostField: "android.browserEarnedUnlockSourceHost",
      },
      expected: "block",
      manualPrerequisite:
        "Complete a verified challenge from the real browser/adult-domain source, keep the configured app over its daily limit, and confirm the browser-sourced challenge window does not pause Android app shields.",
      name: "browser-earned-unlock-no-app-unlock",
      suggestedEvidenceField: "android.browserEarnedUnlockNoAppUnlockArtifact",
    });
  }
  if (["short-form-below-threshold", "short-form-both", "all"].includes(options.appScenario)) {
    const belowThresholdProof = shortFormBelowThresholdProof(shortFormApp, options);
    scenarios.push({
      app: shortFormApp,
      expected: "allow",
      manualPrerequisite:
        `FREED Accessibility is enabled, ${shortFormApp.packageName} is selected in Shield settings, today's foreground usage for that package is below the configured daily app limit, the short-form threshold is ${options.shortFormThresholdSeconds}s, no earned unlock is active, and the app is on the ${options.shortFormLabel} surface for less than the threshold.`,
      name: "short-form-below-threshold-allow",
      observedSeconds: options.shortFormBelowThresholdSeconds,
      shortFormProof: belowThresholdProof,
      suggestedEvidenceField: belowThresholdProof.artifactField || null,
      waitMs: options.shortFormBelowThresholdSeconds * 1000,
    });
  }
  if (["short-form", "short-form-both", "all"].includes(options.appScenario)) {
    const sustainedProof = shortFormSustainedProof(shortFormApp, options);
    const selectedSurfaceRequirement = sustainedProof.selectedSurfaceExpected
      ? ` Record selected/focused ${options.shortFormLabel} surface proof in \`${sustainedProof.selectedSurfaceArtifactField}\` and \`${sustainedProof.selectedSurfaceVerifiedField}=true\`.`
      : "";
    scenarios.push({
      app: shortFormApp,
      expected: "block",
      manualPrerequisite:
        `FREED Accessibility is enabled, ${shortFormApp.packageName} is selected in Shield settings, today's foreground usage for that package is below the configured daily app limit, the short-form threshold is ${options.shortFormThresholdSeconds}s, no earned unlock is active, and the app stays on the ${options.shortFormLabel} surface until FREED opens the recovery handoff.${selectedSurfaceRequirement}`,
      name: "short-form-sustained-intervention",
      observedSeconds: options.shortFormAtInterventionSeconds,
      shortFormProof: sustainedProof,
      suggestedEvidenceField: sustainedProof.artifactField || null,
      waitMs: options.shortFormAtInterventionSeconds * 1000,
    });
  }
  return scenarios;
}

function focusedWebViewPlan(options) {
  if (!options.focusedWebViewProof) return [];
  return [
    {
      app: {
        label: options.focusedWebViewLabel || options.focusedWebViewPackage,
        packageName: options.focusedWebViewPackage,
      },
      expected: "block",
      focusedWebViewProof: {
        expectedFixturePackage: options.focusedWebViewPackage,
        expectedRawFieldStorage: "none",
        expectedSurface: "focused-webview-url-field",
      },
      manualPrerequisite:
        "Install the QA WebView fixture, keep FREED Accessibility enabled, open the fixture, tap Adult Test or focus the URL field with a high-confidence adult URL, and confirm FREED opens before relying on loaded WebView page content.",
      name: "focused-webview",
      suggestedEvidenceField: "android.focusedWebViewArtifact",
      waitMs: options.focusedWebViewWaitMs,
    },
  ];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let forceKillTimer;
    let timeoutTimer;
    const displayCommand = options.displayCommand || command;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "pipe",
    });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        if (options.echo) process.stdout.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        if (options.echo) process.stderr.write(chunk);
      });
    }

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      callback(value);
    };

    if (Number.isInteger(options.timeoutMs) && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => {
          if (!settled) child.kill("SIGKILL");
        }, 1000);
        if (typeof forceKillTimer.unref === "function") forceKillTimer.unref();
      }, options.timeoutMs);
      if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();
    }

    child.on("error", (error) => finish(reject, error));
    child.on("exit", (code, signal) => {
      if (timedOut) {
        finish(reject, new Error(`${displayCommand} ${args.join(" ")} timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code === 0) {
        finish(resolve, { stdout, stderr });
        return;
      }
      finish(reject, new Error(`${displayCommand} ${args.join(" ")} failed with ${signal || code}\n${stderr || stdout}`));
    });
  });
}

function adbArgs(serial, args) {
  return ["-s", serial, ...args];
}

function runAdb(args, options = {}) {
  return run(ADB_COMMAND, args, { timeoutMs: activeDeviceToolTimeoutMs, displayCommand: ADB_DISPLAY_COMMAND, ...options });
}

function parseAdbDevices(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^List of devices attached$/i.test(line))
    .filter((line) => !/^\* daemon/i.test(line))
    .map((line) => {
      const [serial = "", state = "", ...details] = line.split(/\s+/);
      const detailText = details.join(" ");
      const fields = {};
      for (const token of details) {
        const match = token.match(/^([^:\s]+):(.+)$/);
        if (match) fields[match[1]] = match[2];
      }
      const device = {
        details: detailText,
        fields,
        model: fields.model ? fields.model.replace(/_/g, " ") : "",
        product: fields.product || "",
        serial,
        state,
      };
      return {
        ...device,
        isLikelyEmulator: isLikelyEmulator(device),
        isReady: state === "device",
      };
    })
    .filter((device) => device.serial && device.state);
}

async function listAdbDevices() {
  const { stdout } = await runAdb(["devices", "-l"]);
  return { devices: parseAdbDevices(stdout), raw: stdout };
}

async function listDevices() {
  const listed = await listAdbDevices();
  return listed.devices.filter((device) => device.state === "device");
}

async function resolveDevice(requested) {
  const devices = await listDevices();
  if (requested) {
    const match = devices.find((device) => device.serial === requested);
    if (!match) throw new Error(`Requested Android device is not attached or ready: ${requested}`);
    return match;
  }
  if (devices.length === 0) throw new Error("No ready Android hardware found. Connect a physical device and enable adb.");
  if (devices.length > 1) {
    throw new Error(`Multiple Android targets attached (${devices.map((device) => device.serial).join(", ")}). Pass --device.`);
  }
  return devices[0];
}

function buildDeviceDiscoveryManifest(options, listed, adbDevicesArtifact) {
  const readyDevices = listed.devices.filter((device) => device.isReady);
  const physicalCandidates = readyDevices.filter((device) => !device.isLikelyEmulator);
  const emulatorLikeDevices = readyDevices.filter((device) => device.isLikelyEmulator);
  const requestedDevice = options.device
    ? listed.devices.find((device) => device.serial === options.device) || null
    : null;
  const requestedReadyDevice = requestedDevice?.isReady ? requestedDevice : null;
  const result = options.device
    ? requestedReadyDevice
      ? "requested-ready-device-found"
      : "requested-device-missing-or-not-ready"
    : physicalCandidates.length > 0
      ? "ready-physical-candidate-found"
      : emulatorLikeDevices.length > 0
        ? "ready-emulator-only"
        : "no-ready-android-device";
  const nextSerial = physicalCandidates[0]?.serial || readyDevices[0]?.serial || "<serial>";
  return {
    schema: "freed-android-device-discovery-v1",
    sanitized: true,
    generatedAt: new Date().toISOString(),
    releaseGate: "android-real-browser-validation",
    result,
    runId: options.runId,
    outputDir: repoRelative(options.outputDir),
    requestedDevice: options.device || null,
    requestedDeviceFound: options.device ? Boolean(requestedDevice) : null,
    requestedReadyDeviceFound: options.device ? Boolean(requestedReadyDevice) : null,
    deviceCount: listed.devices.length,
    readyDeviceCount: readyDevices.length,
    readyPhysicalCandidateCount: physicalCandidates.length,
    readyEmulatorLikeDeviceCount: emulatorLikeDevices.length,
    devices: listed.devices.map((device) => ({
      details: device.details,
      isLikelyEmulator: device.isLikelyEmulator,
      isReady: device.isReady,
      model: device.model,
      product: device.product,
      serial: device.serial,
      state: device.state,
    })),
    next:
      physicalCandidates.length > 0
        ? `Use a listed ready non-emulator serial with npm run evidence:android-real-browser after the upload-signed APK is installed, for example --device ${physicalCandidates[0].serial}.`
        : "Connect a physical Android phone, enable USB debugging, authorize this Mac, then rerun npm run evidence:android-devices.",
    nextCommand:
      `npm run evidence:android-real-browser -- --device ${nextSerial} --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id ${options.runId} --output-dir docs/validation/artifacts/${options.runId}/android-real-browser-capture`,
    checks: {
      adbDeviceReady: readyDevices.length > 0,
      physicalAndroidDeviceVerified: false,
      releaseEvidenceSatisfied: false,
      androidInstallLaunchQaCaptured: false,
      androidProtectionQaCaptured: false,
    },
    evidenceSatisfied: false,
    evidenceBoundary:
      "Device discovery is a setup handoff only. It does not prove physical-device status, installed upload-signed FREED APK, Accessibility consent, Usage Access consent, VPN/DNS Guard consent, app shielding, normal browsing allow, adult intercept, or challenge verification.",
    toolTimeoutMs: options.toolTimeoutMs,
    adbDevicesArtifact: repoRelative(adbDevicesArtifact),
  };
}

async function captureDeviceDiscovery(options) {
  fs.mkdirSync(options.outputDir, { recursive: true });
  const adbDevicesArtifact = path.join(options.outputDir, "adb-devices.txt");
  const discoveryArtifact = path.join(options.outputDir, "android-device-discovery.json");
  const errorArtifact = path.join(options.outputDir, "adb-devices-error.txt");
  try {
    const listed = await listAdbDevices();
    if (fs.existsSync(errorArtifact)) fs.unlinkSync(errorArtifact);
    writeTextArtifact(adbDevicesArtifact, listed.raw || "\n");
    const manifest = buildDeviceDiscoveryManifest(options, listed, adbDevicesArtifact);
    writeJsonArtifact(discoveryArtifact, manifest);
    console.log(
      JSON.stringify(
        {
          ...manifest,
          discoveryArtifact: repoRelative(discoveryArtifact),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeTextArtifact(errorArtifact, message);
    const manifest = {
      schema: "freed-android-device-discovery-v1",
      sanitized: true,
      generatedAt: new Date().toISOString(),
      releaseGate: "android-real-browser-validation",
      result: "device-discovery-failed",
      runId: options.runId,
      outputDir: repoRelative(options.outputDir),
      requestedDevice: options.device || null,
      evidenceSatisfied: false,
      evidenceBoundary:
        "Device discovery is a setup handoff only. It does not prove physical-device status, installed upload-signed FREED APK, Accessibility consent, Usage Access consent, VPN/DNS Guard consent, app shielding, normal browsing allow, adult intercept, or challenge verification.",
      toolTimeoutMs: options.toolTimeoutMs,
      errorArtifact: repoRelative(errorArtifact),
      next: "Fix adb/device authorization, connect a physical Android phone, then rerun npm run evidence:android-devices.",
    };
    writeJsonArtifact(discoveryArtifact, manifest);
    console.log(
      JSON.stringify(
        {
          ...manifest,
          discoveryArtifact: repoRelative(discoveryArtifact),
        },
        null,
        2,
      ),
    );
    throw error;
  }
}

async function getProp(serial, name) {
  const { stdout } = await runAdb(adbArgs(serial, ["shell", "getprop", name]));
  return stdout.trim();
}

function isLikelyEmulator(device) {
  const values = [
    device.serial,
    device.details,
    device.model,
    device.manufacturer,
    device.fingerprint,
    device.hardware,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    device.qemu === "1" ||
    device.serial.startsWith("emulator-") ||
    /\b(?:sdk_gphone|generic|emulator|goldfish|ranchu|aosp_x86)\b/.test(values)
  );
}

async function deviceProfile(device) {
  const serial = device.serial;
  const profile = {
    details: device.details,
    fingerprint: await getProp(serial, "ro.build.fingerprint"),
    hardware: await getProp(serial, "ro.hardware"),
    manufacturer: await getProp(serial, "ro.product.manufacturer"),
    model: await getProp(serial, "ro.product.model"),
    osVersion: await getProp(serial, "ro.build.version.release"),
    qemu: await getProp(serial, "ro.kernel.qemu"),
    serial,
  };
  return { ...profile, isPhysicalDevice: !isLikelyEmulator(profile) };
}

async function requirePhysicalDevice(profile) {
  if (!profile.isPhysicalDevice) {
    throw new Error(
      `Android real-browser evidence must run on physical hardware; refused target ${profile.serial} (${profile.model || "unknown model"}).`,
    );
  }
}

async function requirePackage(serial, packageName) {
  await runAdb(adbArgs(serial, ["shell", "pm", "path", packageName]));
}

async function accessibilityStatus(serial, serviceComponent) {
  const enabled = await runAdb(adbArgs(serial, ["shell", "settings", "get", "secure", "enabled_accessibility_services"])).catch(
    () => ({ stdout: "" }),
  );
  const accessibilityEnabled = await runAdb(adbArgs(serial, ["shell", "settings", "get", "secure", "accessibility_enabled"])).catch(
    () => ({ stdout: "" }),
  );
  const enabledServices = enabled.stdout.trim();
  return {
    accessibilityEnabled: accessibilityEnabled.stdout.trim() === "1",
    enabledServices,
    serviceComponent,
    serviceEnabled: enabledServices.toLowerCase().split(":").includes(serviceComponent.toLowerCase()),
  };
}

async function clearLogcat(serial) {
  await runAdb(adbArgs(serial, ["logcat", "-c"]));
}

async function dumpLogcat(serial, lines, output) {
  const { stdout } = await runAdb(adbArgs(serial, ["logcat", "-d", "-t", String(lines)]));
  writeTextArtifact(output, stdout || "\n");
  return stdout;
}

async function topActivity(serial, output) {
  const { stdout } = await runAdb(adbArgs(serial, ["shell", "dumpsys", "activity", "activities"]));
  writeTextArtifact(output, stdout || "\n");
  return {
    packageName: topPackageFromActivityOutput(stdout),
    rawArtifact: output,
  };
}

function topPackageFromActivityOutput(value) {
  const lines = String(value)
    .split(/\r?\n/)
    .filter((line) => /topResumedActivity|mResumedActivity|ResumedActivity|mFocusedApp/.test(line));
  for (const line of lines) {
    const match = line.match(/\b([a-zA-Z][\w]*(?:\.[\w]+)+)\/[A-Za-z0-9_.$]+/);
    if (match) return match[1];
  }
  const fallback = String(value).match(/\b([a-zA-Z][\w]*(?:\.[\w]+)+)\/[A-Za-z0-9_.$]+/);
  return fallback?.[1] || "";
}

async function openUrl(serial, browserPackage, url) {
  await runAdb(adbArgs(serial, ["shell", "am", "force-stop", browserPackage])).catch(() => undefined);
  return runAdb(
    adbArgs(serial, ["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", url, "-p", browserPackage]),
  );
}

async function openApp(serial, packageName) {
  await runAdb(adbArgs(serial, ["shell", "am", "force-stop", packageName])).catch(() => undefined);
  return runAdb(adbArgs(serial, ["shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"]));
}

async function bringAppToFront(serial, packageName) {
  return runAdb(adbArgs(serial, ["shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"]));
}

async function pressBack(serial) {
  return runAdb(adbArgs(serial, ["shell", "input", "keyevent", "BACK"]));
}

async function captureScreenshot(serial, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let forceKillTimer;
    let timeoutTimer;
    const child = spawn(ADB_COMMAND, adbArgs(serial, ["exec-out", "screencap", "-p"]));
    const file = fs.createWriteStream(output);
    let stderr = "";
    child.stdout.pipe(file);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      callback(value);
    };

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 1000);
      if (typeof forceKillTimer.unref === "function") forceKillTimer.unref();
    }, activeDeviceToolTimeoutMs);
    if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();

    child.on("error", (error) => finish(reject, error));
    file.on("error", (error) => finish(reject, error));
    child.on("exit", (code, signal) => {
      file.close(() => {
        if (timedOut) {
          finish(reject, new Error(`adb ${adbArgs(serial, ["exec-out", "screencap", "-p"]).join(" ")} timed out after ${activeDeviceToolTimeoutMs}ms`));
          return;
        }
        if (code === 0) {
          finish(resolve);
          return;
        }
        finish(reject, new Error(`adb screencap failed with ${signal || code}\n${stderr}`));
      });
    });
  });
  if (fs.statSync(output).size <= 0) throw new Error(`Screenshot is empty: ${output}`);
  return assertUsefulScreenshot(output);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
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
  fs.writeFileSync(filePath, sanitizeLocalHomePaths(content));
}

function browserInterceptSurfaceForField(field, browserLabel) {
  if (field === "android.chromeInterceptArtifact") return "Chrome Adult Intent";
  if (field === "android.firefoxInterceptArtifact") return "Firefox Adult Intent";
  if (field === "android.edgeInterceptArtifact") return "Edge Adult Intent";
  if (field === "android.samsungInternetInterceptArtifact") return "Samsung Internet Adult Intent";
  if (field === "android.focusedBrowserSearchArtifact") return "Focused Browser Search";
  if (field === "android.focusedWebViewArtifact") return "Focused WebView";
  if (field === "android.adultDomainFeedAccessibilityArtifact") return "Synced Adult Domain Feed Accessibility";
  return `${browserLabel || "Android Browser"} Adult Intent`;
}

function writeAndroidBrowserInterceptReport(filePath, details) {
  const focusedSearch = Boolean(details.focusedSearchProof);
  const focusedWebView = details.surface === "Focused WebView";
  const syncedAdultDomainFeed = Boolean(details.adultDomainFeedProof);
  const report = {
    schemaVersion: "freed-android-browser-intercept-report-v1",
    sanitized: true,
    runId: details.runId,
    platform: "android",
    surface: details.surface,
    browserPackage: details.browserPackage,
    ...(details.host ? { host: details.host } : {}),
    ...(details.redactedHost ? { redactedHost: details.redactedHost } : {}),
    matchedRule: details.matchedRule,
    ...(focusedSearch ? { rawQueryStored: false } : {}),
    checks: {
      accessibilityEventUsed: false,
      supportedSurfaceObserved: true,
      urlOrSearchFieldObserved: false,
      interceptedBeforeNavigation: false,
      freedInterventionLaunched: false,
      redactedHostOnly: true,
      rawUrlNotPersisted: false,
      noScreenshotAnalysis: true,
      noContinuousOcr: true,
      noPacketInspection: true,
      noMitmHttps: true,
      ...(focusedSearch ? { focusedInputObserved: false, rawQueryNotPersisted: false } : {}),
      ...(focusedWebView ? { focusedWebViewInputObserved: false } : {}),
      ...(syncedAdultDomainFeed
        ? {
            syncedAdultDomainFeedUsed: false,
            hostAbsentFromEmbeddedSeed: false,
            nativeFeedVersionMatched: false,
            nativeFeedChecksumMatched: false,
          }
        : {}),
    },
    manualCompletionRequired:
      "Before promotion, review the paired screenshot/logcat/UI artifacts and set every event-driven Accessibility/no-screenshot/no-OCR/no-packet-inspection check true only when the physical-device capture proves the browser handoff.",
    supportingArtifacts: details.supportingArtifacts,
  };
  writeJsonArtifact(filePath, report);
  return repoRelative(filePath);
}

function writeAndroidBrowserEarnedUnlockReport(filePath, details) {
  const report = {
    schemaVersion: "freed-android-browser-earned-unlock-report-v1",
    sanitized: true,
    runId: details.runId,
    platform: "android",
    reportKind: "browser-earned-unlock-no-app-unlock",
    outcome: "block",
    sourceType: "blocked-browser-source",
    sourceHost: details.sourceHost,
    configuredAppPackage: details.configuredAppPackage,
    nativeAppUnlockActive: false,
    configuredAppStillShielded: true,
    adultFilterStillActive: true,
    metrics: {
      durationMinutes: details.durationMinutes,
      dailyLimitMinutes: details.dailyLimitMinutes,
    },
    checks: {
      challengeVerifiedFromBrowserSource: false,
      browserSourceHostSanitized: true,
      nativeAppUnlockNotActivated: false,
      configuredAppStillShielded: false,
      adultFilterStillActive: false,
      appDailyLimitStillEnforced: false,
      noNativeAppUnlockStateCreated: false,
      noScreenshotAnalysis: true,
      noContinuousFrameAnalysis: true,
      noContinuousOcr: true,
      noPacketInspection: true,
      noOverlayPermissionRequired: true,
      noRawUrlStored: true,
      noRawAppContentStored: true,
    },
    manualCompletionRequired:
      "Before promotion, complete the browser/adult-source challenge on Android hardware, try the configured over-limit app, then set the behavioral checks true only when the app remains shielded and adult filtering remains active without creating a native app unlock window.",
    supportingArtifacts: details.supportingArtifacts,
  };
  writeJsonArtifact(filePath, report);
  return repoRelative(filePath);
}

function sha256Text(content) {
  return `sha256-${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function readRequiredText(relativePath) {
  const absolutePath = path.resolve(relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing required policy proof source: ${relativePath}`);
  return fs.readFileSync(absolutePath, "utf8");
}

function playPolicySignals({ accessibilityConfig, moduleManifest, policyPack }) {
  return {
    accessibilityDisclosureMatchesPolicyPack:
      policyPack.includes("explicit user opt-in") &&
      policyPack.includes("does not capture screenshots") &&
      policyPack.includes("No OCR") &&
      policyPack.includes("No keyboard logging") &&
      policyPack.includes("No raw page text scraping"),
    accessibilityServiceConfigIsNotAccessibilityTool: accessibilityConfig.includes('android:isAccessibilityTool="false"'),
    accessibilityServiceConfigReadsBoundedEvents:
      accessibilityConfig.includes("typeWindowStateChanged") &&
      accessibilityConfig.includes("typeWindowContentChanged") &&
      accessibilityConfig.includes("typeViewTextChanged") &&
      accessibilityConfig.includes("typeViewScrolled"),
    accessibilityServiceDeclared:
      moduleManifest.includes(".FreedAccessibilityService") &&
      moduleManifest.includes("android.permission.BIND_ACCESSIBILITY_SERVICE") &&
      moduleManifest.includes("android.accessibilityservice.AccessibilityService") &&
      moduleManifest.includes("@xml/freed_accessibility_service"),
    dnsGuardDisclosureMatchesPolicyPack:
      policyPack.includes("DNS-only VPN fallback") &&
      policyPack.includes("No full traffic proxy") &&
      policyPack.includes("No TLS interception") &&
      policyPack.includes("No HTTPS MITM") &&
      policyPack.includes("No packet payload inspection beyond DNS questions"),
    specialUseForegroundServiceDeclared:
      moduleManifest.includes("android.permission.FOREGROUND_SERVICE_SPECIAL_USE") &&
      moduleManifest.includes(".FreedVpnService") &&
      moduleManifest.includes('android:foregroundServiceType="specialUse"') &&
      moduleManifest.includes("android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE") &&
      moduleManifest.includes("DNS-only VPN fallback"),
  };
}

function capturePlayPolicyProof(outputDir, options) {
  const policyPack = readRequiredText(ANDROID_POLICY_PACK_PATH);
  const moduleManifest = readRequiredText(ANDROID_PROTECTION_MANIFEST_PATH);
  const accessibilityConfig = readRequiredText(ANDROID_ACCESSIBILITY_CONFIG_PATH);
  const signals = playPolicySignals({ accessibilityConfig, moduleManifest, policyPack });
  const usableForManualEvidence = Object.values(signals).every(Boolean);
  const runId = `${options.runId}-android-play-policy`;
  const markdownPath = path.join(outputDir, "android-play-policy-proof.md");
  const jsonPath = path.join(outputDir, "android-play-policy-proof.json");
  const policyPackHash = sha256Text(policyPack);
  const manifestHash = sha256Text(moduleManifest);
  const accessibilityConfigHash = sha256Text(accessibilityConfig);
  const suggestedEvidenceFields = ["android.playPolicyAccessibilityArtifact", "android.playPolicySpecialUseFgsArtifact"];
  const markdown = [
    `# Android Play Policy Proof: ${runId}`,
    "",
    "This artifact packages local release-review source material for manual QA. It does not satisfy Play Console review IDs by itself.",
    "",
    "## Sources",
    "",
    `- Policy pack: \`${ANDROID_POLICY_PACK_PATH}\` (${policyPackHash})`,
    `- Native manifest: \`${ANDROID_PROTECTION_MANIFEST_PATH}\` (${manifestHash})`,
    `- Accessibility config: \`${ANDROID_ACCESSIBILITY_CONFIG_PATH}\` (${accessibilityConfigHash})`,
    "",
    "## Declaration Checks",
    "",
    ...Object.entries(signals).map(([name, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${name}`),
    "",
    "## Suggested Evidence Fields",
    "",
    `- \`android.playPolicyAccessibilityRunId=${runId}\` is not a validator field; use \`android.playPolicyAccessibilityReviewId\` only after Play Console submission returns a concrete review/decision ID.`,
    `- \`android.playPolicyAccessibilityArtifact=${repoRelative(jsonPath)}\``,
    `- \`android.playPolicySpecialUseFgsRunId=${runId}\` is not a validator field; use \`android.playPolicySpecialUseFgsReviewId\` only after Play Console submission returns a concrete review/decision ID.`,
    `- \`android.playPolicySpecialUseFgsArtifact=${repoRelative(jsonPath)}\``,
    "",
    "## Manual QA Requirements",
    "",
    "- Confirm the submitted Play Console AccessibilityService declaration matches the policy pack.",
    "- Confirm the submitted foreground-service special-use declaration matches the DNS-only fallback text.",
    "- Attach signed-build screenshots or exports where Play Console requires visual disclosure evidence.",
    "- Do not promote release evidence until concrete Play review IDs are recorded.",
    "",
  ].join("\n");
  const json = {
    schemaVersion: "freed-android-play-policy-report-v1",
    sanitized: true,
    platform: "android",
    accessibilityConfigHash,
    accessibilityConfigPath: ANDROID_ACCESSIBILITY_CONFIG_PATH,
    artifact: repoRelative(jsonPath),
    checks: signals,
    generatedAt: new Date().toISOString(),
    manifestHash,
    manifestPath: ANDROID_PROTECTION_MANIFEST_PATH,
    markdownArtifact: repoRelative(markdownPath),
    playPolicyProofUsableForManualEvidence: usableForManualEvidence,
    policyPackHash,
    policyPackPath: ANDROID_POLICY_PACK_PATH,
    result: usableForManualEvidence ? "local-policy-proof-captured" : "local-policy-proof-incomplete",
    reviewIdsStillRequired: ["android.playPolicyAccessibilityReviewId", "android.playPolicySpecialUseFgsReviewId"],
    runId,
    signals,
    suggestedEvidenceFields,
  };
  writeTextArtifact(markdownPath, markdown);
  writeJsonArtifact(jsonPath, json);
  return {
    ...json,
    jsonArtifact: repoRelative(jsonPath),
  };
}

function summarizeLogcat(logcat, packageName) {
  const packagePattern = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const crashPatterns = [
    new RegExp(`ANR in ${packagePattern}`, "i"),
    new RegExp(`${packagePattern}.*\\bANR\\b`, "i"),
    new RegExp(`FATAL EXCEPTION[\\s\\S]{0,1200}${packagePattern}`, "i"),
    new RegExp(`Process:\\s*${packagePattern}[\\s\\S]{0,1200}(?:FATAL EXCEPTION|RuntimeException|\\bError\\b)`, "i"),
  ];
  const crashSignals = crashPatterns
    .map((pattern) => logcat.match(pattern)?.[0].split(/\r?\n/).slice(0, 8).join("\n") || "")
    .filter(Boolean);
  return {
    crashSignalCount: crashSignals.length,
    crashSignals,
    freedInterventionSeen: logcat.includes("FreedInterventionActivity") || logcat.includes(packageName),
  };
}

function suggestedField(browser, scenario) {
  if (scenario.name === "allowed") return "android.normalBrowsingArtifact";
  const label = browser.label.toLowerCase();
  const packageName = browser.packageName.toLowerCase();
  if (packageName === "com.android.chrome" || label.includes("chrome")) return "android.chromeInterceptArtifact";
  if (packageName.includes("firefox") || label.includes("firefox")) return "android.firefoxInterceptArtifact";
  if (packageName.includes("microsoft.emmx") || label.includes("edge")) {
    return "android.edgeInterceptArtifact";
  }
  if (packageName.includes("brave") || label.includes("brave")) return "android.optionalBrowserArtifact";
  if (packageName.includes("com.sec.android.app.sbrowser") || label.includes("samsung")) {
    return "android.samsungInternetInterceptArtifact";
  }
  return "android.adultInterceptArtifact";
}

function attemptLabel(attempt) {
  if (attempt.browser) return `${attempt.browser.label} ${attempt.scenario}`;
  if (attempt.app) return `${attempt.app.label} ${attempt.scenario}`;
  return attempt.scenario;
}

function formatPngRenderAuditSummary(analysis) {
  if (!analysis) return "PNG render audit unavailable";
  return `${analysis.width}x${analysis.height}, ${analysis.uniqueSampledColors} sampled colors, luminance stddev ${analysis.luminanceStdDev}`;
}

function androidChallengeVerificationProof(options) {
  return {
    manualExpectation:
      "Run these challenge proofs on the same Android hardware after FREED protection is active. Attach separate reports or recordings before setting the challenge verification checks.",
    proofs: [
      {
        artifactField: "android.challengePhotoArtifact",
        check: "challengePhotoVerifiedOnDevice",
        releaseFields: [
          "android.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true",
          "android.challengePhotoClassifier=ML Kit",
          "android.challengePhotoMatchedLabel",
          "android.challengePhotoConfidence>=0.45",
          "android.challengePhotoFreshCameraOnly=true",
          "android.challengePhotoNoBase64OrExif=true",
          "android.challengePhotoTemporaryFileDeleted=true",
          "android.challengePhotoArtifact checks onDeviceClassifier/onDemandOnly/rawPhotoNotPersisted/noContinuousImageClassification=true",
        ],
        runId: `${options.runId}-challenge-photo-verification`,
        runIdField: "android.challengePhotoRunId",
        summary:
          "Record a fresh-camera photo challenge completing only after on-device, on-demand ML Kit image labeling, with no base64/EXIF payload retained, no raw photo persisted, no continuous image classification, and the temporary captured file deleted after classification.",
      },
      {
        artifactField: "android.challengeMotionArtifact",
        check: "challengeMotionVerified",
        releaseFields: [
          "android.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true",
          "android.challengeMotionSamples>=6",
          "android.challengeMotionArtifact checks onDeviceSensorSamples/onDemandOnly/timerOnlyBypassRejected=true",
        ],
        runId: `${options.runId}-challenge-motion-verification`,
        runIdField: "android.challengeMotionRunId",
        summary:
          "Record a motion challenge completing from a local on-device, on-demand sensor report with enough live samples and a rejected timer-only bypass.",
      },
      {
        artifactField: "android.challengeStepsArtifact",
        check: "challengeStepsVerified",
        releaseFields: [
          "android.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true",
          "android.challengeStepCount>=12",
          "android.challengeStepsArtifact checks pedometerOrHealthData/onDemandOnly/timerOnlyBypassRejected=true",
        ],
        runId: `${options.runId}-challenge-steps-verification`,
        runIdField: "android.challengeStepsRunId",
        summary:
          "Record a walking challenge completing from a local on-demand Health Connect/step report with enough steps and a rejected timer-only bypass.",
      },
      {
        artifactField: "android.challengeLocationArtifact",
        check: "challengeLocationVerified",
        releaseFields: [
          "android.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true",
          "android.challengeLocationDistanceMeters>=10",
          "android.challengeLocationSamples>=2",
          "android.challengeLocationBestAccuracyMeters<=80",
          "android.challengeLocationArtifact checks foregroundLocationOnly/onDemandOnly/multiSampleRoute/noRawCoordinatesPersisted=true",
        ],
        runId: `${options.runId}-challenge-location-verification`,
        runIdField: "android.challengeLocationRunId",
        summary:
          "Record an outdoor challenge completing from a local foreground-only, on-demand location report with multiple accurate fixes and no raw coordinate retention.",
      },
    ],
  };
}

function androidPermissionWizardProof(options) {
  return {
    artifactField: "android.permissionWizardArtifact",
    check: "permissionSetupWizard",
    flowOrder: PERMISSION_WIZARD_FLOW_ORDER,
    manualExpectation:
      "Record the full release setup wizard on Android hardware: recovery goals, app selection, paywall, protection explanation, guided DNS Guard VPN consent, Usage Access, and targeted FREED Accessibility details setup, Test Protection, and Activation Complete.",
    releaseFields: [
      "android.permissionWizardRunId",
      "android.permissionWizardArtifact",
      "android.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true and exact Android VPN consent/Usage Access/Accessibility route surfaces",
      `android.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}`,
      "android.permissionExplanationShown=true",
      "android.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy",
      "android.permissionWizardTestProtectionPassed=true",
      "android.appSelectionZeroAppContinueDisabled=true",
      "android.appSelectionReturnFromSetup=true",
      "android.appSelectionReturnAutoSync=true",
      "android.appSelectionReturnNativePackageSyncConfirmed=true",
      "android.appSelectionReturnSelectedAppCount>0",
    ],
    runId: `${options.runId}-permission-wizard`,
    suggestedEvidenceFields: [
      "android.permissionWizardRunId",
      "android.permissionWizardArtifact",
      "android.permissionWizardFlowOrder",
      "android.permissionExplanationShown",
      "android.permissionExplanationSummary",
      "android.permissionWizardTestProtectionPassed",
      "android.appSelectionZeroAppContinueDisabled",
      "android.appSelectionReturnFromSetup",
      "android.appSelectionReturnAutoSync",
      "android.appSelectionReturnNativePackageSyncConfirmed",
      "android.appSelectionReturnSelectedAppCount",
    ],
  };
}

function optionHost(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}

function stripAndroidPrefix(field) {
  return String(field || "").replace(/^android\./, "");
}

function setAndroidEvidenceField(android, field, value) {
  const key = stripAndroidPrefix(field);
  if (!key || !(key in android) || value === undefined) return;
  android[key] = value;
}

function setAndroidArtifactField(android, field, runId, artifact) {
  const artifactKey = stripAndroidPrefix(field);
  if (!artifactKey || !(artifactKey in android) || !artifact) return;
  android[artifactKey] = artifact;
  const runIdKey = artifactKey.replace(/Artifact$/, "RunId");
  if (runIdKey !== artifactKey && runIdKey in android && runId) {
    android[runIdKey] = runId;
  }
}

function buildEvidenceFillTemplate(options, manifest) {
  const permissionWizard = manifest.permissionWizardProof || androidPermissionWizardProof(options);
  const challengeProof = manifest.challengeVerificationProof || androidChallengeVerificationProof(options);
  const device = manifest.device || {};
  const deviceModel = [device.manufacturer, device.model].filter(Boolean).join(" ").trim();
  const osVersion = device.osVersion ? (String(device.osVersion).startsWith("Android") ? device.osVersion : `Android ${device.osVersion}`) : "";
  const configuredPackage = options.configuredAppPackage || "";
  const shortFormPackage = options.shortFormPackage || DEFAULT_SHORT_FORM_PACKAGE;
  const adultHost = optionHost(options.adultUrl) || options.adultDomainFeedHost || options.dnsGuardHost || "";

  const android = {
    isPhysicalDevice: manifest.device ? manifest.device.isPhysicalDevice === true : "",
    deviceModel,
    osVersion,
    installQaRunId: `${options.runId}-android-install-qa`,
    installQaArtifact: "path/to/local-freed-android-install-qa-report-v1.json",
    permissionWizardRunId: permissionWizard.runId,
    permissionWizardArtifact: "",
    permissionWizardFlowOrder: PERMISSION_WIZARD_FLOW_ORDER,
    permissionExplanationShown: false,
    permissionExplanationSummary: "",
    permissionWizardTestProtectionPassed: false,
    appSelectionZeroAppContinueDisabled: false,
    appSelectionReturnFromSetup: false,
    appSelectionReturnAutoSync: false,
    appSelectionReturnNativePackageSyncConfirmed: false,
    appSelectionReturnSelectedAppCount: "",
    accessibilityServiceEnabled: Boolean(manifest.accessibility?.serviceEnabled),
    accessibilityPermissionRunId: `${options.runId}-accessibility-permission`,
    accessibilityPermissionArtifact: "",
    usageStatsAuthorized: "",
    usageAccessPermissionRunId: `${options.runId}-usage-access-permission`,
    usageAccessPermissionArtifact: "",
    usageStatsObservedPackages: "",
    usageStatsObservedPackageNames: [],
    usageStatsTodayMinutes: "",
    usageStatsTodayMinutesByPackage: {},
    testedBrowserPackages: options.browsers.map((browser) => browser.packageName),
    chromeInterceptRunId: `${options.runId}-chrome-intercept`,
    chromeInterceptArtifact: "",
    firefoxInterceptRunId: `${options.runId}-firefox-intercept`,
    firefoxInterceptArtifact: "",
    edgeInterceptRunId: `${options.runId}-edge-intercept`,
    edgeInterceptArtifact: "",
    samsungInternetInterceptRunId: `${options.runId}-samsung-internet-intercept`,
    samsungInternetInterceptArtifact: "",
    focusedBrowserSearchRunId: `${options.runId}-focused-browser-search`,
    focusedBrowserSearchArtifact: "",
    focusedBrowserSearchRedactedHost: "focused-search.app.freed.local",
    focusedBrowserSearchMatchedRule: "",
    focusedBrowserSearchRawQueryStored: false,
    focusedWebViewPackage: options.focusedWebViewPackage || DEFAULT_FOCUSED_WEBVIEW_PACKAGE,
    focusedWebViewRunId: `${options.runId}-focused-webview`,
    focusedWebViewArtifact: "",
    configuredAppShieldPackages: [
      INSTAGRAM_ANDROID_PACKAGE,
      ...TIKTOK_ANDROID_PACKAGES,
      YOUTUBE_ANDROID_PACKAGE,
    ],
    configuredAppShieldPackage: configuredPackage,
    configuredAppShieldDailyLimitMinutes: "",
    configuredAppShieldUsageBeforeLimitMinutes: "",
    configuredAppShieldBeforeLimitAllowRunId: `${options.runId}-configured-app-before-limit-allow`,
    configuredAppShieldBeforeLimitAllowArtifact: "",
    configuredAppShieldUsageAtInterventionMinutes: "",
    configuredAppShieldRunId: `${options.runId}-configured-app-shield`,
    configuredAppShieldArtifact: "",
    configuredAppShieldInterventionId: configuredPackage ? configuredAppInterventionId(configuredPackage) : "",
    shortFormPackage: YOUTUBE_ANDROID_PACKAGE,
    shortFormThresholdSeconds: options.shortFormThresholdSeconds,
    shortFormBelowThresholdSeconds: options.shortFormBelowThresholdSeconds,
    shortFormBelowThresholdAllowRunId: `${options.runId}-short-form-below-threshold-allow`,
    shortFormBelowThresholdAllowArtifact: "",
    shortFormAtInterventionSeconds: options.shortFormAtInterventionSeconds,
    shortFormUsageBeforeLimitMinutes: "",
    shortFormRunId: `${options.runId}-short-form-sustained-intervention`,
    shortFormArtifact: "",
    shortFormSelectedSurfaceArtifact: "",
    shortFormSelectedSurfaceVerified: false,
    shortFormInterventionId: YOUTUBE_SHORTS_RULE,
    instagramReelsPackage: INSTAGRAM_ANDROID_PACKAGE,
    instagramReelsAtInterventionSeconds: options.shortFormAtInterventionSeconds,
    instagramReelsUsageBeforeLimitMinutes: "",
    instagramReelsRunId: `${options.runId}-instagram-reels-sustained-intervention`,
    instagramReelsArtifact: "",
    instagramReelsSelectedSurfaceArtifact: "",
    instagramReelsSelectedSurfaceVerified: false,
    instagramReelsInterventionId: INSTAGRAM_REELS_RULE,
    tiktokFeedPackage: TIKTOK_PRIMARY_ANDROID_PACKAGE,
    tiktokFeedAtInterventionSeconds: options.shortFormAtInterventionSeconds,
    tiktokFeedUsageBeforeLimitMinutes: "",
    tiktokFeedRunId: `${options.runId}-tiktok-feed-sustained-intervention`,
    tiktokFeedArtifact: "",
    tiktokFeedSelectedSurfaceArtifact: "",
    tiktokFeedSelectedSurfaceVerified: false,
    tiktokFeedInterventionId: TIKTOK_FEED_RULE,
    earnedUnlockAppAllowRunId: `${options.runId}-earned-unlock-app-allow`,
    earnedUnlockAppAllowArtifact: "",
    earnedUnlockRelockRunId: `${options.runId}-earned-unlock-relock`,
    earnedUnlockRelockArtifact: "",
    earnedUnlockDurationMinutes: options.earnedUnlockMinutes || DEFAULT_EARNED_UNLOCK_MINUTES,
    earnedUnlockSourcePackage: configuredPackage,
    earnedUnlockRelockUsageMinutes: "",
    challengePhotoRunId: challengeProof.proofs.find((proof) => proof.check === "challengePhotoVerifiedOnDevice")?.runId || `${options.runId}-challenge-photo-verification`,
    challengePhotoArtifact: "",
    challengePhotoClassifier: "ML Kit",
    challengePhotoMatchedLabel: "",
    challengePhotoConfidence: "",
    challengePhotoFreshCameraOnly: false,
    challengePhotoNoBase64OrExif: false,
    challengePhotoTemporaryFileDeleted: false,
    challengeMotionRunId: challengeProof.proofs.find((proof) => proof.check === "challengeMotionVerified")?.runId || `${options.runId}-challenge-motion-verification`,
    challengeMotionArtifact: "",
    challengeMotionSamples: "",
    challengeStepsRunId: challengeProof.proofs.find((proof) => proof.check === "challengeStepsVerified")?.runId || `${options.runId}-challenge-steps-verification`,
    challengeStepsArtifact: "",
    challengeStepCount: "",
    challengeLocationRunId: challengeProof.proofs.find((proof) => proof.check === "challengeLocationVerified")?.runId || `${options.runId}-challenge-location-verification`,
    challengeLocationArtifact: "",
    challengeLocationDistanceMeters: "",
    challengeLocationSamples: "",
    challengeLocationBestAccuracyMeters: "",
    browserEarnedUnlockNoAppUnlockRunId: `${options.runId}-browser-earned-unlock-no-app-unlock`,
    browserEarnedUnlockNoAppUnlockArtifact: "",
    browserEarnedUnlockSourceHost: adultHost,
    browserEarnedUnlockNativeAppUnlockActive: "",
    browserEarnedUnlockConfiguredAppStillShielded: false,
    browserEarnedUnlockAdultFilterStillActive: false,
    dnsGuardVpnConsentRunId: `${options.runId}-dns-guard-vpn-consent`,
    dnsGuardVpnConsentArtifact: "",
    dnsGuardVpnConsentRequiredBeforeApproval: false,
    dnsGuardVpnConsentRequiredAfterApproval: "",
    dnsGuardStartedAfterVpnConsent: false,
    dnsGuardNoSilentStartWithoutConsent: false,
    dnsGuardDeniedConsentNoPromptLoop: false,
    dnsGuardResolver: "",
    dnsGuardBlockRunId: `${options.runId}-dns-guard-block`,
    dnsGuardBlockArtifact: "",
    dnsGuardInterventionVisible: false,
    dnsGuardLifecycleArtifact: "",
    dnsGuardSessionQueries: "",
    dnsGuardBlockedQueries: "",
    dnsGuardAllowedQueries: "",
    dnsGuardServfailResponses: "",
    dnsGuardMalformedPackets: "",
    dnsGuardRestartRunId: `${options.runId}-dns-guard-restart`,
    dnsGuardRestartArtifact: "",
    dnsGuardRestartAction: "",
    dnsGuardRestartResult: "",
    dnsGuardRestartUserEnabled: false,
    dnsGuardRestartEligible: false,
    dnsGuardRestartSkippedRunId: `${options.runId}-dns-guard-restart-skipped`,
    dnsGuardRestartSkippedArtifact: "",
    dnsGuardRestartSkippedReason: "",
    dnsGuardRestartNoSilentPromptConfirmed: false,
    adultDomainFeedVersion: "",
    adultDomainFeedChecksum: "",
    adultDomainFeedDomainCount: "",
    adultDomainFeedStatusRunId: `${options.runId}-android-native-status`,
    adultDomainFeedStatusArtifact: "",
    adultDomainFeedAccessibilityRunId: `${options.runId}-adult-domain-feed-accessibility`,
    adultDomainFeedAccessibilityArtifact: "",
    adultDomainFeedDnsGuardRunId: `${options.runId}-adult-domain-feed-dns-guard`,
    adultDomainFeedDnsGuardArtifact: "",
    nativeHandoffInterventionId: "",
    backStackCleanupRunId: `${options.runId}-back-stack-cleanup`,
    backStackCleanupArtifact: "",
    normalBrowsingRunId: `${options.runId}-normal-browsing`,
    normalBrowsingArtifact: "",
    playPolicyAccessibilityReviewId: "",
    playPolicyAccessibilityArtifact: "",
    playPolicySpecialUseFgsReviewId: "",
    playPolicySpecialUseFgsArtifact: "",
    normalBrowsingAllowedUrl: options.allowedUrl || DEFAULT_ALLOWED_URL,
    adultInterceptedHost: adultHost,
  };

  if (TIKTOK_ANDROID_PACKAGES.includes(shortFormPackage)) {
    android.tiktokFeedPackage = shortFormPackage;
  }

  if (manifest.permissionProof) {
    android.accessibilityPermissionRunId = `${options.runId}-accessibility-permission`;
    android.accessibilityPermissionArtifact = manifest.permissionProof.accessibilityReportArtifact || manifest.permissionProof.jsonArtifact || "";
    android.usageAccessPermissionRunId = `${options.runId}-usage-access-permission`;
    android.usageAccessPermissionArtifact = manifest.permissionProof.usageAccessReportArtifact || manifest.permissionProof.jsonArtifact || "";
    android.notificationPermissionRunId = `${options.runId}-notification-permission`;
    android.notificationPermissionArtifact = manifest.permissionProof.notificationPermissionReportArtifact || manifest.permissionProof.jsonArtifact || "";
    android.notificationPermissionRequired =
      typeof manifest.permissionProof.androidNotificationPermissionRequired === "boolean"
        ? manifest.permissionProof.androidNotificationPermissionRequired
        : "";
    android.notificationPermissionGranted =
      typeof manifest.permissionProof.androidNotificationPermissionGranted === "boolean"
        ? manifest.permissionProof.androidNotificationPermissionGranted
        : "";
    android.dnsGuardVpnConsentRunId = `${options.runId}-dns-guard-vpn-consent`;
    android.dnsGuardVpnConsentArtifact = manifest.permissionProof.vpnConsentReportArtifact || manifest.permissionProof.jsonArtifact || "";
    android.usageStatsAuthorized = typeof manifest.permissionProof.usageStatsAuthorized === "boolean" ? manifest.permissionProof.usageStatsAuthorized : "";
    android.accessibilityServiceEnabled = Boolean(manifest.permissionProof.accessibility?.serviceEnabled);
  }

  if (manifest.nativeStatusProof) {
    android.adultDomainFeedStatusRunId = manifest.nativeStatusProof.runId;
    android.adultDomainFeedStatusArtifact = manifest.nativeStatusProof.adultDomainFeedStatusArtifact || manifest.nativeStatusProof.textArtifact || manifest.nativeStatusProof.screenshotArtifact || "";
    android.dnsGuardLifecycleArtifact = manifest.nativeStatusProof.lifecycleArtifact || manifest.nativeStatusProof.textArtifact || "";
    if (manifest.nativeStatusProof.adultDomainFeedStatusMetrics) {
      const feedStatus = manifest.nativeStatusProof.adultDomainFeedStatusMetrics;
      if (feedStatus.feedVersion) android.adultDomainFeedVersion = feedStatus.feedVersion;
      if (feedStatus.feedChecksum) android.adultDomainFeedChecksum = feedStatus.feedChecksum;
      if (typeof feedStatus.domainCount === "number" && Number.isFinite(feedStatus.domainCount)) {
        android.adultDomainFeedDomainCount = feedStatus.domainCount;
      }
    }
    if (manifest.nativeStatusProof.parsedDnsGuardCounters) {
      Object.assign(android, manifest.nativeStatusProof.parsedDnsGuardCounters);
    }
  }

  for (const attempt of manifest.attempts || []) {
    setAndroidArtifactField(android, attempt.suggestedEvidenceField, attempt.runId, attempt.reportArtifact || attempt.screenshotArtifact);
    if (attempt.focusedSearchProof) {
      android.focusedBrowserSearchRunId = attempt.runId;
      android.focusedBrowserSearchArtifact = attempt.reportArtifact || attempt.screenshotArtifact || "";
      android.focusedBrowserSearchRedactedHost = attempt.focusedSearchProof.expectedRedactedHost;
      android.focusedBrowserSearchMatchedRule = attempt.focusedSearchProof.expectedMatchedRule;
      android.focusedBrowserSearchRawQueryStored = false;
    }
    if (attempt.focusedWebViewProof) {
      android.focusedWebViewPackage = attempt.focusedWebViewProof.expectedFixturePackage;
      android.focusedWebViewRunId = attempt.runId;
      android.focusedWebViewArtifact = attempt.reportArtifact || attempt.screenshotArtifact || "";
    }
    if (attempt.configuredAppShieldProof) {
      const proof = attempt.configuredAppShieldProof;
      setAndroidEvidenceField(android, proof.packageField, proof.expectedPackage);
      setAndroidEvidenceField(android, proof.runIdField, attempt.runId);
      setAndroidEvidenceField(android, proof.artifactField, attempt.screenshotArtifact || "");
      if (proof.expectedInterventionId) setAndroidEvidenceField(android, proof.interventionIdField, proof.expectedInterventionId);
    }
    if (attempt.earnedUnlockProof) {
      const proof = attempt.earnedUnlockProof;
      setAndroidEvidenceField(android, proof.packageField, proof.expectedPackage);
      setAndroidEvidenceField(android, proof.durationField, proof.durationMinutes);
      setAndroidEvidenceField(android, proof.runIdField, attempt.runId);
      setAndroidEvidenceField(android, proof.artifactField, attempt.screenshotArtifact || "");
    }
    if (attempt.browserEarnedUnlockNoAppUnlockProof) {
      const proof = attempt.browserEarnedUnlockNoAppUnlockProof;
      setAndroidEvidenceField(android, proof.runIdField, attempt.runId);
      setAndroidEvidenceField(android, proof.artifactField, attempt.reportArtifact || attempt.screenshotArtifact || "");
      setAndroidEvidenceField(android, proof.sourceHostField, proof.expectedSourceHost);
      setAndroidEvidenceField(android, proof.nativeAppUnlockActiveField, "");
      setAndroidEvidenceField(android, proof.configuredAppStillShieldedField, false);
      setAndroidEvidenceField(android, proof.adultFilterStillActiveField, false);
    }
    if (attempt.shortFormProof?.releaseValidatorField) {
      const proof = attempt.shortFormProof;
      setAndroidEvidenceField(android, proof.packageField, proof.expectedPackage);
      setAndroidEvidenceField(android, "android.shortFormThresholdSeconds", proof.expectedThresholdSeconds);
      setAndroidEvidenceField(android, proof.observedSecondsField, attempt.observedSeconds || "");
      setAndroidEvidenceField(android, proof.runIdField, attempt.runId);
      setAndroidEvidenceField(android, proof.artifactField, attempt.screenshotArtifact || "");
      if (proof.expectedInterventionId) setAndroidEvidenceField(android, proof.interventionIdField, proof.expectedInterventionId);
      if (proof.selectedSurfaceArtifactField) setAndroidEvidenceField(android, proof.selectedSurfaceArtifactField, "");
      if (proof.selectedSurfaceVerifiedField) setAndroidEvidenceField(android, proof.selectedSurfaceVerifiedField, false);
    }
    if (attempt.backStackCheck) {
      android.backStackCleanupRunId = `${attempt.runId}-back-stack-cleanup`;
      android.backStackCleanupArtifact = attempt.backStackCheck.screenshotArtifact || "";
    }
  }

  if (manifest.dnsGuardProof) {
    android.dnsGuardBlockRunId = manifest.dnsGuardProof.runId;
    android.dnsGuardBlockArtifact = manifest.dnsGuardProof.artifact || "";
    android.adultDomainFeedDnsGuardRunId = manifest.dnsGuardProof.runId;
    android.adultDomainFeedDnsGuardArtifact = manifest.dnsGuardProof.artifact || "";
  }

  if (manifest.dnsGuardRestartProof) {
    android.dnsGuardRestartRunId = manifest.dnsGuardRestartProof.runId;
    android.dnsGuardRestartArtifact = manifest.dnsGuardRestartProof.startedReportArtifact || "";
    android.dnsGuardRestartSkippedRunId = manifest.dnsGuardRestartProof.skippedRunId;
    android.dnsGuardRestartSkippedArtifact = manifest.dnsGuardRestartProof.skippedReportArtifact || "";
  }

  if (manifest.playPolicyProof) {
    android.playPolicyAccessibilityArtifact = manifest.playPolicyProof.artifact || "";
    android.playPolicySpecialUseFgsArtifact = manifest.playPolicyProof.artifact || "";
  }

  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    instructions:
      "Copy this shape into android-real-browser.json only after replacing blank artifacts, pending metrics, and false checks with real Android hardware QA, Play policy review IDs, and manual evidence review.",
    validatedAt: "",
    tester: "",
    build: "",
    device: [android.deviceModel, android.osVersion].filter(Boolean).join(", "),
    evidence: [],
    android,
    checks: {
      androidInstallLaunchQa: false,
      permissionSetupWizard: false,
      accessibilityPermissionFlow: false,
      usageAccessPermissionFlow: false,
      notificationPermissionFlow: false,
      chromeAdultIntentIntercept: false,
      firefoxAdultIntentIntercept: false,
      edgeAdultIntentIntercept: false,
      samsungInternetAdultIntentIntercept: false,
      focusedBrowserSearchIntercept: false,
      focusedWebViewIntercept: false,
      configuredAppShieldBeforeLimitAllowed: false,
      configuredAppShieldIntercept: false,
      configuredAppShieldDailyLimitReached: false,
      shortFormBelowThresholdAllowed: false,
      shortFormSustainedIntercept: false,
      instagramReelsSustainedIntercept: false,
      tiktokFeedSustainedIntercept: false,
      earnedUnlockAllowsConfiguredApp: false,
      earnedUnlockAutoRelock: false,
      challengePhotoVerifiedOnDevice: false,
      challengeMotionVerified: false,
      challengeStepsVerified: false,
      challengeLocationVerified: false,
      browserEarnedUnlockDoesNotUnlockApps: false,
      normalBrowsingAllowed: false,
      dnsGuardVpnConsentFlow: false,
      dnsGuardAdultDomainBlocked: false,
      dnsGuardInterventionVisible: false,
      dnsGuardRestartPolicyVerified: false,
      nativeAdultDomainFeedSynced: false,
      nativeHandoffBackStackClean: false,
      playPolicyAccessibilityReviewed: false,
      playPolicySpecialUseFgsReviewed: false,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatSignal(value) {
  return value === true || value === false ? String(value) : "pending-capture";
}

function formatDnsGuardVisibleProofNote(visibleProof) {
  if (!visibleProof) return "";
  if (typeof visibleProof === "string") return ` Visible proof plan: ${visibleProof}`;
  if (!isPlainObject(visibleProof)) return "";

  const uiTextSignals = isPlainObject(visibleProof.uiTextSignals) ? visibleProof.uiTextSignals : {};
  return ` Visible proof: activity screenshot \`${visibleProof.activityScreenshotArtifact || "pending-capture"}\`, notification shade screenshot \`${visibleProof.notificationShadeScreenshotArtifact || "pending-capture"}\`, notification dump \`${visibleProof.notificationDumpArtifact || "pending-capture"}\`, and UI dump \`${visibleProof.notificationUiAutomatorArtifact || "pending-capture"}\`. Parsed signals: notification title \`${formatSignal(uiTextSignals.notificationTitleSeen)}\`, recovery copy \`${formatSignal(uiTextSignals.recoveryCopySeen)}\`, intervention activity \`${formatSignal(uiTextSignals.interventionActivitySeen)}\`.`;
}

function buildNotes(manifest) {
  const lines = [
    `# Android Real-Browser Capture: ${manifest.runId}`,
    "",
    "This folder contains physical-device capture artifacts for manual QA review. It does not satisfy release evidence by itself.",
    "",
    "Before promotion:",
    "",
    "- Review every screenshot/video/log and confirm expected behavior.",
    "- Use `android-real-browser-evidence-fill-template.json` as the pending final-shape handoff for `docs/validation/artifacts/<run-id>/draft-evidence/android-real-browser.json` or a new draft from `docs/validation/templates/android-real-browser.template.json`.",
    "- Add Usage Access, DNS Guard, synced adult-domain feed status/DNS proof, focused browser search before-navigation proof, focused WebView, back-stack cleanup, and Play policy review artifacts; this script captures browser URL attempts, synced-feed Accessibility handoff attempts, focused WebView fixture attempts, optional configured app launch attempts, and optional sustained short-form launch attempts only.",
    `- Required install QA fields: \`android.installQaRunId\` and \`android.installQaArtifact\` as local \`freed-android-install-qa-report-v1\` JSON from \`npm run qa:android-install -- --require-upload-signing\`, with \`sanitized=true\`, physical device, APK hash/size, requested upload-signing guard, verified non-debug APK signature proof, package install, launch/top-activity proof, screenshot/UI dump artifacts, and protection handoff order \`${ANDROID_PROTECTION_FLOW_ORDER}\`.`,
    "- Required browser-intercept fields for Chrome, Firefox, Edge, Samsung Internet, focused browser search, and focused WebView must use local `freed-android-browser-intercept-report-v1` JSON with Accessibility event proof, no screenshot/OCR loops, no packet inspection, and no MITM HTTPS checks.",
    "- Required Usage Access fields: `android.usageStatsAuthorized=true`, `android.usageAccessPermissionArtifact`, `android.usageStatsObservedPackages`, `android.usageStatsObservedPackageNames`, `android.usageStatsTodayMinutes`, and `android.usageStatsTodayMinutesByPackage` from FREED native status.",
    "- Required Android 13+ notification fields: `android.notificationPermissionArtifact`, `android.notificationPermissionRequired=true`, `android.notificationPermissionGranted=true`, `android.notificationRuntimePromptShown=true`, and `android.notificationSettingsFallbackOpenedIfDenied=true` from the prompt-first recovery-notification setup row plus FREED native status.",
    `- Required permission wizard fields: \`android.permissionWizardRunId\`, \`android.permissionWizardArtifact\` as local \`freed-permission-wizard-report-v1\` JSON with \`sanitized=true\`, \`android.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}\`, \`android.permissionExplanationShown=true\`, \`android.permissionExplanationSummary\` with the production explanation proof, \`android.permissionWizardTestProtectionPassed=true\`, \`android.appSelectionZeroAppContinueDisabled=true\`, \`android.appSelectionReturnFromSetup=true\`, \`android.appSelectionReturnAutoSync=true\`, \`android.appSelectionReturnNativePackageSyncConfirmed=true\`, and \`android.appSelectionReturnSelectedAppCount>0\`.`,
    "- Required adult-domain feed fields: `android.adultDomainFeedVersion`, `android.adultDomainFeedChecksum`, `android.adultDomainFeedDomainCount`, `android.adultDomainFeedStatusArtifact`, `android.adultDomainFeedAccessibilityArtifact`, and `android.adultDomainFeedDnsGuardArtifact` as local `freed-dns-guard-block-report-v1` JSON when proving DNS Guard classification.",
    "- Required DNS Guard visibility field: `android.dnsGuardInterventionVisible=true` only after a local `freed-dns-guard-block-report-v1` artifact shows the DNS-only block plus FREED recovery notification or intervention activity for the blocked DNS handoff. `android.dnsGuardLifecycleArtifact` must be local `freed-dns-guard-lifecycle-report-v1` JSON with matching counters, and restart/skipped artifacts must be local `freed-dns-guard-restart-report-v1` JSON with `sanitized=true`, matching run IDs, no silent VPN prompt, no consent bypass, and no full-traffic proxy/MITM/payload-inspection checks.",
    "- Required challenge proof fields: `android.challengePhotoClassifier=ML Kit`, `android.challengePhotoNoBase64OrExif=true`, `android.challengePhotoTemporaryFileDeleted=true`, `android.challengeMotionSamples>=6`, `android.challengeStepCount>=12`, and `android.challengeLocationBestAccuracyMeters<=80` from real on-device challenge runs.",
    "- Run `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence` before promotion.",
    "",
    "Captured attempts:",
    "",
  ];
  for (const attempt of manifest.attempts) {
    const suggestedFieldText = attempt.suggestedEvidenceField
      ? `; suggested field \`${attempt.suggestedEvidenceField}\``
      : "; supporting artifact only";
    const browserReportText = attempt.reportArtifact
      ? attempt.browserEarnedUnlockNoAppUnlockProof
        ? `; report \`${attempt.reportArtifact}\` (local \`freed-android-browser-earned-unlock-report-v1\` JSON requiring manual QA completion)`
        : `; report \`${attempt.reportArtifact}\` (local \`freed-android-browser-intercept-report-v1\` JSON requiring manual QA completion)`
      : "";
    lines.push(
      `- ${attemptLabel(attempt)}: expected ${attempt.expected}; screenshot \`${attempt.screenshotArtifact}\` (${formatPngRenderAuditSummary(attempt.screenshotAnalysis)}); logcat \`${attempt.logcatArtifact}\`; top package \`${attempt.observedTopPackage || "unknown"}\`${browserReportText}${suggestedFieldText}.`,
    );
    if (attempt.manualPrerequisite) lines.push(`  Prerequisite: ${attempt.manualPrerequisite}`);
    if (attempt.configuredAppShieldProof) {
      const proof = attempt.configuredAppShieldProof;
      const proofFields = [
        `\`${proof.packageField}=${proof.expectedPackage}\``,
        `\`${proof.usageMinutesField}\``,
        `\`${proof.runIdField}=${attempt.runId}\``,
        proof.artifactField ? `\`${proof.artifactField}\`` : "",
        proof.expectedInterventionId ? `\`${proof.interventionIdField}=${proof.expectedInterventionId}\`` : "",
      ].filter(Boolean);
      lines.push(`  App-shield proof: use after confirming selected-app UsageStats match the prerequisite. Release fields: ${proofFields.join(", ")}. The artifact must be promoted as a local \`${proof.interventionReportSchema}\` JSON report with matching package, usage metrics, allow/block outcome, and no screenshot/OCR/frame-analysis checks.`);
    }
    if (attempt.earnedUnlockProof) {
      const proof = attempt.earnedUnlockProof;
      const proofFields = [
        `\`${proof.packageField}=${proof.expectedPackage}\``,
        `\`${proof.durationField}=${proof.durationMinutes}\``,
        proof.runIdField ? `\`${proof.runIdField}=${attempt.runId}\`` : "",
        proof.artifactField ? `\`${proof.artifactField}\`` : "",
        proof.relockUsageMinutesField ? `\`${proof.relockUsageMinutesField}\`` : "",
      ].filter(Boolean);
      const usageNote = proof.relockUsageMinutesField
        ? ` Confirm \`${proof.relockUsageMinutesField}\` is at least \`${proof.relockUsageMustBeAtLeastField}\`.`
        : "";
      lines.push(`  Earned-unlock proof (${proof.check}): release fields ${proofFields.join(", ")}.${usageNote} The artifact must be promoted as a local \`${proof.earnedUnlockReportSchema}\` JSON report with matching package/source package, bounded duration, same-package source-scoped behavior, adult-filter continuity, no browser-source native unlock, and no screenshot/OCR/frame-analysis checks.`);
    }
    if (attempt.browserEarnedUnlockNoAppUnlockProof) {
      const proof = attempt.browserEarnedUnlockNoAppUnlockProof;
      const proofFields = [
        `\`${proof.runIdField}=${attempt.runId}\``,
        `\`${proof.artifactField}\``,
        `\`${proof.sourceHostField}=${proof.expectedSourceHost}\``,
        `\`${proof.durationField}=${proof.durationMinutes}\``,
        `\`${proof.nativeAppUnlockActiveField}=false\``,
        `\`${proof.configuredAppStillShieldedField}=true\``,
        `\`${proof.adultFilterStillActiveField}=true\``,
      ];
      lines.push(
        `  Browser-earned-unlock no-app-unlock proof (${proof.check}): release fields ${proofFields.join(", ")}. Promote the artifact as a local \`${proof.earnedUnlockReportSchema}\` JSON report matching the blocked source host, configured app package, duration, app daily limit, native app unlock inactive state, configured app shield state, adult-filter continuity, and no screenshot/OCR/frame-analysis/packet-inspection checks.`,
      );
    }
    if (attempt.shortFormProof) {
      const proof = attempt.shortFormProof;
      if (proof.releaseValidatorField) {
        const proofFields = [
          `\`${proof.packageField}=${proof.expectedPackage}\``,
          `\`android.shortFormThresholdSeconds=${proof.expectedThresholdSeconds}\``,
          proof.observedSecondsField ? `\`${proof.observedSecondsField}=${attempt.observedSeconds}\`` : "",
          proof.runIdField ? `\`${proof.runIdField}=${attempt.runId}\`` : "",
          proof.artifactField ? `\`${proof.artifactField}\`` : "",
          proof.expectedInterventionId ? `\`${proof.interventionIdField}=${proof.expectedInterventionId}\`` : "",
          proof.usageBeforeLimitField ? `\`${proof.usageBeforeLimitField}<${proof.usageMustBeLowerThanField}\`` : "",
          proof.selectedSurfaceArtifactField && proof.selectedSurfaceReportSchema
            ? `\`${proof.selectedSurfaceArtifactField} local ${proof.selectedSurfaceReportSchema} JSON\``
            : proof.selectedSurfaceArtifactField ? `\`${proof.selectedSurfaceArtifactField}\`` : "",
          proof.selectedSurfaceVerifiedField ? `\`${proof.selectedSurfaceVerifiedField}=true\`` : "",
        ].filter(Boolean);
        lines.push(`  Short-form proof (${proof.surface}): release fields ${proofFields.join(", ")}. The app artifact must be promoted as a local \`${proof.interventionReportSchema}\` JSON report with matching package, timing/threshold metrics, allow/block outcome, no raw screen text, and no screenshot/OCR/frame-analysis checks. The selected-surface report must prove Accessibility node-tree confirmation without screenshot/frame analysis, separating sustained short-form interruption from the broader configured-app daily-limit shield.`);
      } else {
        lines.push(
          `  Short-form proof: supporting capture for \`${proof.expectedPackage}\`; the release validator only consumes YouTube below-threshold plus sustained YouTube/Instagram/TikTok intervention fields.`,
        );
      }
    }
    if (attempt.focusedSearchProof) {
      lines.push(
        `  Focused-search proof: set \`android.focusedBrowserSearchRedactedHost=${attempt.focusedSearchProof.expectedRedactedHost}\`, \`android.focusedBrowserSearchMatchedRule=${attempt.focusedSearchProof.expectedMatchedRule}\`, and \`android.focusedBrowserSearchRawQueryStored=false\`. The final artifact must be local \`freed-android-browser-intercept-report-v1\` JSON with focused-field/no-raw-query checks.`,
      );
    }
    if (attempt.focusedWebViewProof) {
      lines.push(
        `  Focused-WebView proof: set \`android.focusedWebViewPackage=${attempt.focusedWebViewProof.expectedFixturePackage}\`, use run ID \`${attempt.runId}\`, and use this capture for \`android.focusedWebViewArtifact\` only after confirming the fixture URL/search field was focused and FREED opened before page-content inspection. The final artifact must be local \`freed-android-browser-intercept-report-v1\` JSON.`,
      );
    }
    if (attempt.adultDomainFeedProof) {
      lines.push(
        `  Synced-feed proof: confirm host \`${attempt.adultDomainFeedProof.expectedClassifiedHost}\` came from the current synced adult-domain feed, then use this capture for \`android.adultDomainFeedAccessibilityArtifact\` and pair it with \`${attempt.adultDomainFeedProof.pairedDnsGuardEvidenceField}\`.`,
      );
    }
    if (attempt.backStackCheck) {
      lines.push(
        `  Back-stack proof: after Back, screenshot \`${attempt.backStackCheck.screenshotArtifact}\` (${formatPngRenderAuditSummary(attempt.backStackCheck.screenshotAnalysis)}); top package \`${attempt.backStackCheck.observedTopPackage || "unknown"}\`; suggested field \`${attempt.backStackCheck.suggestedEvidenceField}\`. Confirm this did not return to the blocked browser/app page or FREED handoff activity.`,
      );
    }
    if (attempt.observedSeconds) lines.push(`  Observed seconds: ${attempt.observedSeconds}.`);
  }
  if (manifest.permissionWizardProof) {
    lines.push("", "Permission wizard proof:");
    lines.push(
      `- ${manifest.permissionWizardProof.runId}: ${manifest.permissionWizardProof.manualExpectation} Release fields: ${manifest.permissionWizardProof.releaseFields.map((field) => `\`${field}\``).join(", ")}.`,
    );
  }
  if (manifest.challengeVerificationProof) {
    lines.push("", "Challenge verification proof:");
    lines.push(`- ${manifest.challengeVerificationProof.manualExpectation}`);
    for (const proof of manifest.challengeVerificationProof.proofs) {
      const releaseFields = [
        `\`${proof.runIdField}=${proof.runId}\``,
        `\`${proof.artifactField}\``,
        ...proof.releaseFields.map((field) => `\`${field}\``),
      ];
      lines.push(`- ${proof.runId}: ${proof.summary} Release fields: ${releaseFields.join(", ")}.`);
    }
  }
  if (manifest.dnsGuardProof) {
    const visibleProofText = formatDnsGuardVisibleProofNote(manifest.dnsGuardProof.visibleInterventionProof);
    lines.push(
      "",
      `DNS Guard proof: review report \`${manifest.dnsGuardProof.artifact}\`${manifest.dnsGuardProof.textArtifact ? ` and diagnostics \`${manifest.dnsGuardProof.textArtifact}\`` : ""} for host \`${manifest.dnsGuardProof.host}\`. Suggested fields: ${manifest.dnsGuardProof.suggestedEvidenceFields.map((field) => `\`${field}\``).join(", ")}. The final report must use local \`freed-dns-guard-block-report-v1\` JSON with DNS-only/no-MITM checks, matching resolver/counter metrics, and visible recovery-path proof before promoting evidence.${visibleProofText}`,
    );
  }
  if (manifest.dnsGuardRestartProof) {
    lines.push(
      "",
      `DNS Guard restart proof: review \`${manifest.dnsGuardRestartProof.artifact}\`, diagnostics \`${manifest.dnsGuardRestartProof.jsonArtifact}\`, started report \`${manifest.dnsGuardRestartProof.startedReportArtifact}\`, and skipped report \`${manifest.dnsGuardRestartProof.skippedReportArtifact}\`. Suggested fields: ${manifest.dnsGuardRestartProof.suggestedEvidenceFields.map((field) => `\`${field}\``).join(", ")}. Capture this after a real reboot or package update with DNS Guard previously user-enabled, repeat after manual stop or VPN revocation, and promote only local \`freed-dns-guard-restart-report-v1\` JSON artifacts with sanitized=true, no raw diagnostics, no silent VPN prompt, no consent bypass, and no full-traffic proxy/MITM/payload-inspection checks.`,
    );
  }
  if (manifest.permissionProof) {
    const accessibility = isPlainObject(manifest.permissionProof.accessibility) ? manifest.permissionProof.accessibility : {};
    lines.push(
      "",
      `Permission proof: review \`${manifest.permissionProof.artifact || "pending-capture"}\`, \`${manifest.permissionProof.accessibilityReportArtifact || manifest.permissionProof.jsonArtifact || "pending-capture"}\`, and \`${manifest.permissionProof.usageAccessReportArtifact || manifest.permissionProof.jsonArtifact || "pending-capture"}\`. Suggested fields: ${manifest.permissionProof.suggestedEvidenceFields.map((field) => `\`${field}\``).join(", ")}. Parsed Accessibility service state is \`${formatSignal(accessibility.serviceEnabled)}\`; Usage Access app-op state is \`${manifest.permissionProof.usageStatsAuthorized === null || manifest.permissionProof.usageStatsAuthorized === undefined ? "pending-capture" : manifest.permissionProof.usageStatsAuthorized}\`. Pair this with the FREED native status/profile screenshot before promotion.`,
    );
  }
  if (manifest.nativeStatusProof) {
    const uiTextSignals = isPlainObject(manifest.nativeStatusProof.uiTextSignals) ? manifest.nativeStatusProof.uiTextSignals : {};
    lines.push(
      "",
      `Native status proof: review adult feed status report \`${manifest.nativeStatusProof.adultDomainFeedStatusArtifact || manifest.nativeStatusProof.textArtifact || "pending-capture"}\`, DNS lifecycle report \`${manifest.nativeStatusProof.lifecycleArtifact || manifest.nativeStatusProof.textArtifact || "pending-capture"}\`, screenshot \`${manifest.nativeStatusProof.screenshotArtifact || "pending-capture"}\`, UI text \`${manifest.nativeStatusProof.textArtifact || "pending-capture"}\`, and UI dump \`${manifest.nativeStatusProof.uiAutomatorArtifact || "pending-capture"}\`. Suggested fields: ${manifest.nativeStatusProof.suggestedEvidenceFields.map((field) => `\`${field}\``).join(", ")}. The final adult feed status report must use local \`freed-android-adult-domain-feed-status-report-v1\` JSON with matching version/checksum/domain count and synced Accessibility/DNS Guard checks; the final lifecycle report must use local \`freed-dns-guard-lifecycle-report-v1\` JSON with matching counters and DNS-only/no-MITM checks. Parsed signals: native panel \`${formatSignal(uiTextSignals.nativeProtectionPanelSeen)}\`, usage metrics \`${formatSignal(uiTextSignals.usageStatsMetricsSeen)}\`, adult feed \`${formatSignal(uiTextSignals.adultDomainFeedStatusSeen)}\`, DNS diagnostics \`${formatSignal(uiTextSignals.dnsGuardResolverSeen)}\`, DNS lifecycle \`${formatSignal(uiTextSignals.dnsGuardLifecycleSeen)}\`, DNS restart \`${formatSignal(uiTextSignals.dnsGuardRestartSeen)}\`.`,
    );
  }
  if (manifest.playPolicyProof) {
    lines.push(
      "",
      `Play policy proof: review \`${manifest.playPolicyProof.artifact}\` and \`${manifest.playPolicyProof.jsonArtifact}\`. Suggested artifact fields: ${manifest.playPolicyProof.suggestedEvidenceFields.map((field) => `\`${field}\``).join(", ")}. Play Console review IDs are still required: ${manifest.playPolicyProof.reviewIdsStillRequired.map((field) => `\`${field}\``).join(", ")}. Local declaration checks usable for manual evidence: \`${manifest.playPolicyProof.playPolicyProofUsableForManualEvidence}\`.`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function captureBackStackCheck(serial, outputDir, base, waitMs) {
  const screenshotPath = path.join(outputDir, `${base}-after-back.png`);
  const activityPath = path.join(outputDir, `${base}-after-back.activity.txt`);
  const back = await pressBack(serial);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const screenshotAnalysis = await captureScreenshot(serial, screenshotPath);
  const top = await topActivity(serial, activityPath);

  return {
    backStdout: back.stdout.trim(),
    manualExpectation: "Back after the FREED handoff should not return to the blocked browser/app page or FreedInterventionActivity.",
    observedTopPackage: top.packageName,
    screenshotAnalysis,
    screenshotArtifact: repoRelative(screenshotPath),
    suggestedEvidenceField: "android.backStackCleanupArtifact",
    topActivityArtifact: repoRelative(activityPath),
    waitMs,
  };
}

async function captureDnsGuardProof(serial, outputDir, options) {
  const host = safeExternalHost(options.dnsGuardHost, "--dns-guard-host");
  const proofPath = path.join(outputDir, `dns-guard-${slug(host)}.txt`);
  const reportPath = path.join(outputDir, `dns-guard-${slug(host)}.json`);
  const visibleScreenshotPath = path.join(outputDir, `dns-guard-${slug(host)}-visible.png`);
  const notificationScreenshotPath = path.join(outputDir, `dns-guard-${slug(host)}-notification-shade.png`);
  const activityPath = path.join(outputDir, `dns-guard-${slug(host)}-activity.txt`);
  const notificationDumpPath = path.join(outputDir, `dns-guard-${slug(host)}-notifications.txt`);
  const uiPath = path.join(outputDir, `dns-guard-${slug(host)}-notification-ui.xml`);
  const commands = [
    ["private-dns-mode", ["shell", "settings", "get", "global", "private_dns_mode"]],
    ["private-dns-specifier", ["shell", "settings", "get", "global", "private_dns_specifier"]],
    ["always-on-vpn-app", ["shell", "settings", "get", "secure", "always_on_vpn_app"]],
    ["vpn-lockdown", ["shell", "settings", "get", "secure", "always_on_vpn_lockdown"]],
    ["net-dns1", ["shell", "getprop", "net.dns1"]],
    ["net-dns2", ["shell", "getprop", "net.dns2"]],
    ["connectivity", ["shell", "dumpsys", "connectivity"]],
    ["getent-hosts", ["shell", "getent", "hosts", host]],
    ["toybox-nslookup", ["shell", "toybox", "nslookup", host]],
    ["nslookup", ["shell", "nslookup", host]],
    ["ping-dns-resolution", ["shell", "ping", "-c", "1", "-W", String(options.dnsGuardProbeTimeoutSeconds), host]],
  ];
  const sections = [
    "# Android DNS Guard Proof",
    "",
    `Host: ${host}`,
    "",
    "Manual expectation: FREED DNS Guard is active, Android Private DNS settings do not bypass protection, and this reviewed adult host is classified by the current synced adult-domain feed. DNS probe failures or blocked resolutions are expected when the guard is working; review FREED native status/logs before promotion.",
    "",
  ];

  for (const [label, args] of commands) {
    sections.push(`## ${label}`, "");
    try {
      const result = await runAdb(adbArgs(serial, args));
      sections.push("```", `${result.stdout}${result.stderr}`.trim() || "(empty)", "```", "");
    } catch (error) {
      sections.push("```", error instanceof Error ? error.message : String(error), "```", "");
    }
  }

  await new Promise((resolve) => setTimeout(resolve, options.dnsGuardVisibleWaitMs));
  const visibleScreenshotAnalysis = await captureScreenshot(serial, visibleScreenshotPath);
  const top = await topActivity(serial, activityPath);
  const topActivityText = fs.existsSync(activityPath) ? fs.readFileSync(activityPath, "utf8") : "";
  const notificationDump = await captureAdbDiagnostic(serial, ["shell", "dumpsys", "notification"]);
  const notificationDumpText = diagnosticText(notificationDump);
  writeTextArtifact(notificationDumpPath, notificationDumpText || "\n");
  const notificationExpand = await captureAdbDiagnostic(serial, ["shell", "cmd", "statusbar", "expand-notifications"]);
  await new Promise((resolve) => setTimeout(resolve, 750));
  const notificationScreenshotAnalysis = await captureScreenshot(serial, notificationScreenshotPath);
  const uiDump = await captureUiAutomatorDump(serial, uiPath);
  const uiTexts = extractUiText(uiDump.xml);
  const notificationCollapse = await captureAdbDiagnostic(serial, ["shell", "cmd", "statusbar", "collapse"]);
  const visibleSignals = dnsGuardVisibleInterventionSignals(
    {
      notificationDumpText,
      topActivityText,
      topPackageName: top.packageName,
      uiTexts,
    },
    options.appPackage,
  );

  sections.push(
    "## visible-intervention-proof",
    "",
    `Manual expectation: set \`android.dnsGuardInterventionVisible=true\` only if these artifacts show the no-overlay FREED recovery notification or the FREED intervention activity after the blocked DNS handoff. This proves Android background-start restrictions still left the user with a visible recovery path.`,
    "",
    `- Wait after DNS probe: ${options.dnsGuardVisibleWaitMs}ms`,
    `- Activity screenshot: \`${repoRelative(visibleScreenshotPath)}\` (${formatPngRenderAuditSummary(visibleScreenshotAnalysis)})`,
    `- Notification shade screenshot: \`${repoRelative(notificationScreenshotPath)}\` (${formatPngRenderAuditSummary(notificationScreenshotAnalysis)})`,
    `- Top activity dump: \`${repoRelative(activityPath)}\``,
    `- Notification dump: \`${repoRelative(notificationDumpPath)}\``,
    `- Notification UI dump: \`${repoRelative(uiPath)}\``,
    `- topPackageAfterProbe: ${top.packageName || "unknown"}`,
    `- statusbarExpandOk: ${notificationExpand.ok}`,
    `- statusbarCollapseOk: ${notificationCollapse.ok}`,
    `- notificationTitleSeen: ${visibleSignals.notificationTitleSeen}`,
    `- recoveryCopySeen: ${visibleSignals.recoveryCopySeen}`,
    `- interventionActivitySeen: ${visibleSignals.interventionActivitySeen}`,
    "",
  );

  const runId = `${options.runId}-dns-guard-${slug(host)}`;
  const report = {
    schemaVersion: "freed-dns-guard-block-report-v1",
    sanitized: true,
    runId,
    platform: "android",
    host,
    resolver: "",
    metrics: {
      sessionQueries: null,
      blockedQueries: null,
      allowedQueries: null,
      servfailResponses: null,
      malformedPackets: null,
    },
    checks: {
      dnsOnlyVpnService: true,
      adultDomainBlocked: false,
      visibleRecoveryPath:
        visibleSignals.notificationTitleSeen ||
        visibleSignals.recoveryCopySeen ||
        visibleSignals.interventionActivitySeen,
      noOverlayPermissionRequired: true,
      privateDnsStateCaptured: true,
      vpnStateCaptured: true,
      resolverProbeCaptured: true,
      hostSanitized: true,
      syncedAdultDomainFeedUsed:
        Boolean(options.adultDomainFeedHost) &&
        String(options.adultDomainFeedHost).trim().toLowerCase() === host.toLowerCase(),
      noFullTrafficProxy: true,
      noMitmHttps: true,
      noPacketPayloadInspection: true,
      noRawDnsPayloadRetained: true,
    },
    diagnosticsArtifact: repoRelative(proofPath),
    manualCompletionRequired:
      "Before promotion, fill resolver and metrics from FREED Native Protection status, set adultDomainBlocked=true only after the DNS probe and visible intervention prove the host was blocked, and keep every DNS-only/no-MITM check true only when verified on the physical device.",
    visibleInterventionProof: {
      activityScreenshotArtifact: repoRelative(visibleScreenshotPath),
      notificationDumpArtifact: repoRelative(notificationDumpPath),
      notificationShadeScreenshotArtifact: repoRelative(notificationScreenshotPath),
      notificationUiAutomatorArtifact: repoRelative(uiPath),
      observedTopPackage: top.packageName,
      uiTextSignals: visibleSignals,
      waitMs: options.dnsGuardVisibleWaitMs,
    },
  };

  writeTextArtifact(proofPath, sections.join("\n"));
  writeJsonArtifact(reportPath, report);
  return {
    artifact: repoRelative(reportPath),
    host,
    manualExpectation:
      "Confirm FREED DNS Guard was active, Private DNS did not bypass protection, the host was classified by the synced adult-domain feed, and the no-overlay FREED notification or intervention activity was visible before using this artifact.",
    reportSchema: "freed-dns-guard-block-report-v1",
    runId,
    suggestedEvidenceFields: [
      "android.dnsGuardBlockArtifact",
      "android.dnsGuardInterventionVisible=true",
      "android.adultDomainFeedDnsGuardArtifact",
    ],
    textArtifact: repoRelative(proofPath),
    visibleInterventionProof: {
      activityScreenshotArtifact: repoRelative(visibleScreenshotPath),
      activityScreenshotAnalysis: visibleScreenshotAnalysis,
      expectedEvidenceField: "android.dnsGuardInterventionVisible=true",
      notificationDumpArtifact: repoRelative(notificationDumpPath),
      notificationShadeScreenshotArtifact: repoRelative(notificationScreenshotPath),
      notificationShadeScreenshotAnalysis: notificationScreenshotAnalysis,
      notificationUiAutomatorArtifact: repoRelative(uiPath),
      observedTopPackage: top.packageName,
      statusbarCollapseOk: notificationCollapse.ok,
      statusbarExpandOk: notificationExpand.ok,
      topActivityArtifact: repoRelative(activityPath),
      uiAutomatorDumpOk: uiDump.dump.ok,
      uiTextSignals: visibleSignals,
      waitMs: options.dnsGuardVisibleWaitMs,
    },
  };
}

async function captureDnsGuardRestartProof(serial, outputDir, options) {
  const proofPath = path.join(outputDir, "dns-guard-restart-proof.txt");
  const diagnosticsJsonPath = path.join(outputDir, "dns-guard-restart-diagnostics.json");
  const startedReportPath = path.join(outputDir, "dns-guard-restart-started-report.json");
  const skippedReportPath = path.join(outputDir, "dns-guard-restart-skipped-report.json");
  const commands = [
    ["sys-boot-completed", ["shell", "getprop", "sys.boot_completed"]],
    ["device-uptime", ["shell", "cat", "/proc/uptime"]],
    ["package-info", ["shell", "dumpsys", "package", options.appPackage]],
    ["freed-vpn-service", ["shell", "dumpsys", "activity", "services", options.appPackage]],
    ["always-on-vpn-app", ["shell", "settings", "get", "secure", "always_on_vpn_app"]],
    ["vpn-lockdown", ["shell", "settings", "get", "secure", "always_on_vpn_lockdown"]],
    ["private-dns-mode", ["shell", "settings", "get", "global", "private_dns_mode"]],
    ["private-dns-specifier", ["shell", "settings", "get", "global", "private_dns_specifier"]],
    ["connectivity", ["shell", "dumpsys", "connectivity"]],
    ["freed-logcat-tail", ["logcat", "-d", "-t", "400"]],
  ];
  const diagnostics = [];
  const sections = [
    "# Android DNS Guard Restart Proof",
    "",
    `Run ID: ${options.runId}-dns-guard-restart`,
    `FREED package: ${options.appPackage}`,
    "",
    "Manual expectation: run this after a real device reboot or app package update with DNS Guard previously enabled by the user. FREED should restore DNS Guard only if Android VPN consent is still valid, show the persistent foreground notification while active, and expose restart eligibility/result text in Profile > Native Protection. Manual stop or VPN revocation must produce a skipped restart state instead of a silent permission prompt.",
    "",
  ];

  for (const [label, args] of commands) {
    const result = await captureAdbDiagnostic(serial, args);
    diagnostics.push({ label, ...result });
    sections.push(`## ${label}`, "");
    sections.push("```", `${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}${result.error ? `\n${result.error}` : ""}`.trim() || "(empty)", "```", "");
  }

  const sysBootCompleted = diagnostics.find((entry) => entry.label === "sys-boot-completed")?.stdout.trim() === "1";
  const serviceDump = diagnostics.find((entry) => entry.label === "freed-vpn-service")?.stdout ?? "";
  const connectivity = diagnostics.find((entry) => entry.label === "connectivity")?.stdout ?? "";
  const packageInfo = diagnostics.find((entry) => entry.label === "package-info")?.stdout ?? "";
  const serviceMentioned = /FreedVpnService|freed_dns_guard|FREED DNS Guard/i.test(`${serviceDump}\n${connectivity}`);

  const startedRunId = `${options.runId}-dns-guard-restart`;
  const skippedRunId = `${options.runId}-dns-guard-restart-skipped`;
  const report = {
    manualExpectation:
      "Confirm the artifact was captured after real BOOT_COMPLETED or MY_PACKAGE_REPLACED behavior, not a synthetic in-app toggle. Pair it with Profile > Native Protection status showing DNS Guard restart eligibility/result text.",
    packageInfoCaptured: packageInfo.includes(options.appPackage),
    runId: startedRunId,
    skippedRunId,
    serviceMentioned,
    suggestedEvidenceFields: [
      "android.dnsGuardRestartRunId",
      "android.dnsGuardRestartArtifact",
      "android.dnsGuardRestartArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true",
      "android.dnsGuardRestartAction",
      "android.dnsGuardRestartResult",
      "android.dnsGuardRestartUserEnabled",
      "android.dnsGuardRestartEligible",
      "android.dnsGuardRestartSkippedRunId",
      "android.dnsGuardRestartSkippedArtifact",
      "android.dnsGuardRestartSkippedArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true",
      "android.dnsGuardRestartSkippedReason",
      "android.dnsGuardRestartNoSilentPromptConfirmed",
    ],
    sysBootCompleted,
  };

  writeTextArtifact(proofPath, sections.join("\n"));
  writeJsonArtifact(diagnosticsJsonPath, {
    ...report,
    diagnostics,
  });
  writeJsonArtifact(startedReportPath, {
    schemaVersion: "freed-dns-guard-restart-report-v1",
    sanitized: true,
    runId: startedRunId,
    platform: "android",
    reportKind: "restart-started",
    action: "",
    result: "",
    userEnabled: false,
    restartEligible: false,
    sourceDiagnosticsArtifact: repoRelative(proofPath),
    checks: {
      realBootOrPackageUpdateObserved: sysBootCompleted,
      dnsGuardPreviouslyUserEnabled: false,
      androidVpnConsentStillValid: false,
      restartEligibilityVisible: false,
      restartResultVisible: false,
      foregroundServiceVisibleWhenActive: serviceMentioned,
      persistentNotificationVisible: false,
      noSilentVpnPermissionPrompt: false,
      noFullTrafficProxy: false,
      noMitmHttps: false,
      noPacketPayloadInspection: false,
    },
    manualReviewRequired:
      "Fill action/result/userEnabled/restartEligible and set checks true only after reviewing a real reboot or package-update restart plus native status proof.",
  });
  writeJsonArtifact(skippedReportPath, {
    schemaVersion: "freed-dns-guard-restart-report-v1",
    sanitized: true,
    runId: skippedRunId,
    platform: "android",
    reportKind: "restart-skipped",
    skippedReason: "",
    noSilentPromptConfirmed: false,
    sourceDiagnosticsArtifact: repoRelative(proofPath),
    checks: {
      manualStopOrVpnRevocationObserved: false,
      skippedReasonVisible: false,
      userConsentNotBypassed: false,
      dnsGuardNotStartedWithoutConsent: false,
      restartResultVisible: false,
      noSilentVpnPermissionPrompt: false,
      vpnPermissionPromptNotLaunchedSilently: false,
      noFullTrafficProxy: false,
      noMitmHttps: false,
      noPacketPayloadInspection: false,
    },
    manualReviewRequired:
      "Fill skippedReason/noSilentPromptConfirmed and set checks true only after reviewing manual-stop or VPN-revocation skipped-restart proof.",
  });

  return {
    artifact: repoRelative(proofPath),
    jsonArtifact: repoRelative(diagnosticsJsonPath),
    skippedReportArtifact: repoRelative(skippedReportPath),
    startedReportArtifact: repoRelative(startedReportPath),
    ...report,
  };
}

async function captureAdbDiagnostic(serial, args) {
  try {
    const result = await runAdb(adbArgs(serial, args));
    return {
      args,
      ok: true,
      stderr: result.stderr.trim(),
      stdout: result.stdout.trim(),
    };
  } catch (error) {
    return {
      args,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      stderr: "",
      stdout: "",
    };
  }
}

function diagnosticText(result) {
  return sanitizeLocalHomePaths([result.stdout, result.stderr, result.error].filter(Boolean).join("\n")).trim();
}

function dnsGuardVisibleInterventionSignals({ notificationDumpText, topActivityText, topPackageName, uiTexts }, appPackage) {
  const joined = [notificationDumpText, topActivityText, uiTexts.join("\n")].join("\n");
  return {
    interventionActivitySeen:
      topPackageName === appPackage || /FreedInterventionActivity|freed_intervention_source|android-dns/i.test(joined),
    notificationTitleSeen:
      /FREED blocked an adult-domain request|freed_dns_interventions|Open FREED to complete a recovery challenge/i.test(joined),
    recoveryCopySeen: /recovery challenge|Blocked host|adult-domain request|android-dns/i.test(joined),
  };
}

function parseUsageStatsAuthorized(results) {
  const usageText = results
    .map((result) => diagnosticText(result))
    .join("\n")
    .split(/\r?\n/)
    .filter((line) => /(?:android:)?get_usage_stats/i.test(line))
    .join("\n")
    .toLowerCase();
  if (!usageText) return null;
  if (/\b(?:allow|allowed|mode_allowed)\b/.test(usageText)) return true;
  if (/\b(?:deny|denied|ignore|ignored|default|mode_ignored|mode_default|errored)\b/.test(usageText)) return false;
  return null;
}

function parsePostNotificationsGranted(results) {
  const notificationText = results
    .map((result) => diagnosticText(result))
    .join("\n")
    .split(/\r?\n/)
    .filter((line) => /(?:android:)?post_notification/i.test(line))
    .join("\n")
    .toLowerCase();
  if (!notificationText) return null;
  if (/\b(?:allow|allowed|mode_allowed)\b/.test(notificationText)) return true;
  if (/\b(?:deny|denied|ignore|ignored|default|mode_ignored|mode_default|errored)\b/.test(notificationText)) return false;
  return null;
}

function parseEnabledSetting(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null") return false;
  return normalized === "1" || normalized === "true" || normalized === "enabled";
}

function parseNotificationListenerEnabled(value, packageName) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized || normalized.trim() === "null") return false;
  return normalized.includes(`${packageName.toLowerCase()}/`);
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractUiText(value) {
  const texts = [];
  const seen = new Set();
  const pattern = /\b(?:text|content-desc)="([^"]*)"/g;
  let match = pattern.exec(String(value));
  while (match) {
    const text = decodeXmlEntities(match[1]).trim().replace(/\s+/g, " ");
    if (text && !seen.has(text)) {
      seen.add(text);
      texts.push(text);
    }
    match = pattern.exec(String(value));
  }
  return texts;
}

function nativeStatusSignals(texts) {
  const joined = texts.join("\n").toLowerCase();
  return {
    adultDomainFeedStatusSeen: /adult-domain feed|adult domain feed|domains/.test(joined),
    dnsGuardLifecycleSeen: /dns guard session|uptime|last session|last stop|servfail|malformed/.test(joined),
    dnsGuardRestartSeen: /dns guard restart|restart eligible|last restart|last check/.test(joined),
    dnsGuardResolverSeen: /dns guard|resolver|private dns/.test(joined),
    nativeProtectionPanelSeen: /native protection/.test(joined),
    usageStatsMetricsSeen: /usage access sees|selected app package|selected app packages|usage access|package coverage/.test(joined),
  };
}

function parseDnsGuardLifecycleCounters(texts) {
  const joined = texts.join(" ");
  const match = joined.match(
    /dns guard session:\s*(\d+)\s+quer(?:y|ies),\s*(\d+)\s+blocked,\s*(\d+)\s+allowed,\s*(\d+)\s+servfail,\s*(\d+)\s+malformed/i,
  );
  if (!match) return null;
  return {
    dnsGuardSessionQueries: Number(match[1]),
    dnsGuardBlockedQueries: Number(match[2]),
    dnsGuardAllowedQueries: Number(match[3]),
    dnsGuardServfailResponses: Number(match[4]),
    dnsGuardMalformedPackets: Number(match[5]),
  };
}

function parseAdultDomainFeedStatus(texts) {
  const joined = texts.join(" ");
  const checksum = joined.match(/fnv1a32:[0-9a-f]{8}/i)?.[0].toLowerCase() || "";
  const versionMatch =
    joined.match(/adult[- ]domain feed(?: version)?[:\s]+([A-Za-z0-9._:-]{6,128})/i) ||
    joined.match(/feed version[:\s]+([A-Za-z0-9._:-]{6,128})/i);
  const domainMatch =
    joined.match(/(?:domain count|domains)[:\s]+([0-9][0-9,]*)/i) ||
    joined.match(/([0-9][0-9,]*)\s+(?:adult\s+)?domains/i);
  return {
    domainCount: domainMatch ? Number(domainMatch[1].replace(/,/g, "")) : null,
    feedChecksum: checksum,
    feedVersion: versionMatch?.[1] || "",
  };
}

async function capturePermissionProof(serial, outputDir, options, accessibility) {
  const proofPath = path.join(outputDir, "android-permission-proof.txt");
  const summaryReportPath = path.join(outputDir, "android-permission-proof.json");
  const accessibilityReportPath = path.join(outputDir, "android-accessibility-permission-report.json");
  const usageAccessReportPath = path.join(outputDir, "android-usage-access-permission-report.json");
  const notificationPermissionReportPath = path.join(outputDir, "android-notification-permission-report.json");
  const vpnConsentReportPath = path.join(outputDir, "android-dns-guard-vpn-consent-report.json");
  const commands = [
    ["freed-package-path", ["shell", "pm", "path", options.appPackage]],
    ["accessibility-enabled", ["shell", "settings", "get", "secure", "accessibility_enabled"]],
    ["enabled-accessibility-services", ["shell", "settings", "get", "secure", "enabled_accessibility_services"]],
    ["usage-access-appops", ["shell", "cmd", "appops", "get", options.appPackage, "GET_USAGE_STATS"]],
    ["usage-access-appops-android-name", ["shell", "cmd", "appops", "get", options.appPackage, "android:get_usage_stats"]],
    ["post-notifications-appops", ["shell", "cmd", "appops", "get", options.appPackage, "POST_NOTIFICATION"]],
    ["post-notifications-appops-android-name", ["shell", "cmd", "appops", "get", options.appPackage, "android:post_notification"]],
    ["package-appops", ["shell", "cmd", "appops", "get", options.appPackage]],
    ["android-sdk-version", ["shell", "getprop", "ro.build.version.sdk"]],
    ["enabled-notification-listeners", ["shell", "settings", "get", "secure", "enabled_notification_listeners"]],
    ["private-dns-mode", ["shell", "settings", "get", "global", "private_dns_mode"]],
    ["private-dns-specifier", ["shell", "settings", "get", "global", "private_dns_specifier"]],
    ["always-on-vpn-app", ["shell", "settings", "get", "secure", "always_on_vpn_app"]],
    ["vpn-lockdown", ["shell", "settings", "get", "secure", "always_on_vpn_lockdown"]],
    ["freed-package-dump", ["shell", "dumpsys", "package", options.appPackage]],
  ];
  const diagnostics = [];
  for (const [label, args] of commands) {
    diagnostics.push({ label, ...(await captureAdbDiagnostic(serial, args)) });
  }

  const usageResults = diagnostics.filter((entry) => entry.label.includes("usage-access") || entry.label === "package-appops");
  const notificationPermissionResults = diagnostics.filter((entry) => entry.label.includes("post-notifications") || entry.label === "package-appops");
  const notificationResult = diagnostics.find((entry) => entry.label === "enabled-notification-listeners");
  const androidSdkVersionText = diagnosticText(diagnostics.find((entry) => entry.label === "android-sdk-version") || {}).trim();
  const androidSdkVersion = Number.parseInt(androidSdkVersionText, 10);
  const androidNotificationPermissionRequired = Number.isFinite(androidSdkVersion) ? androidSdkVersion >= 33 : null;
  const privateDnsMode = diagnosticText(diagnostics.find((entry) => entry.label === "private-dns-mode") || {}).trim();
  const privateDnsSpecifier = diagnosticText(diagnostics.find((entry) => entry.label === "private-dns-specifier") || {}).trim();
  const alwaysOnVpnApp = diagnosticText(diagnostics.find((entry) => entry.label === "always-on-vpn-app") || {}).trim();
  const vpnLockdown = diagnosticText(diagnostics.find((entry) => entry.label === "vpn-lockdown") || {}).trim();
  const usageStatsAuthorized = parseUsageStatsAuthorized(usageResults);
  const androidNotificationPermissionGranted = parsePostNotificationsGranted(notificationPermissionResults);
  const notificationListenerEnabled = parseNotificationListenerEnabled(diagnosticText(notificationResult || {}), options.appPackage);
  const permissionSummary = {
    accessibility: {
      accessibilityEnabled: accessibility.accessibilityEnabled,
      enabledServices: accessibility.enabledServices,
      serviceComponent: accessibility.serviceComponent,
      serviceEnabled: accessibility.serviceEnabled,
    },
    appPackage: options.appPackage,
    diagnostics: diagnostics.map((entry) => ({
      args: entry.args,
      error: entry.error,
      label: entry.label,
      ok: entry.ok,
      stderr: entry.stderr,
      stdout: entry.stdout,
    })),
    manualExpectation:
      "Use this artifact with a screen recording or FREED native status screenshot that shows Accessibility enabled, Usage Access enabled, and aggregate selected-app UsageStats diagnostics. Do not promote if the app-op is not allowed or FREED native status does not show usageStatsAuthorized=true.",
    networkState: {
      alwaysOnVpnApp,
      privateDnsMode,
      privateDnsSpecifier,
      vpnLockdownEnabled: parseEnabledSetting(vpnLockdown),
    },
    androidNotificationPermissionGranted,
    androidNotificationPermissionRequired,
    notificationListenerEnabled,
    runId: `${options.runId}-android-permissions`,
    suggestedEvidenceFields: [
      "android.permissionWizardRunId",
      "android.permissionWizardArtifact",
      "android.permissionWizardFlowOrder",
      "android.permissionExplanationShown",
      "android.permissionExplanationSummary",
      "android.permissionWizardTestProtectionPassed",
      "android.accessibilityPermissionRunId",
      "android.accessibilityPermissionArtifact",
      "android.usageAccessPermissionRunId",
      "android.usageAccessPermissionArtifact",
      "android.usageStatsAuthorized",
      "android.usageStatsObservedPackages",
      "android.usageStatsObservedPackageNames",
      "android.usageStatsTodayMinutes",
      "android.usageStatsTodayMinutesByPackage",
      "android.notificationPermissionRunId",
      "android.notificationPermissionArtifact",
      "android.dnsGuardVpnConsentRunId",
      "android.dnsGuardVpnConsentArtifact",
      "android.dnsGuardVpnConsentRequiredBeforeApproval",
      "android.dnsGuardVpnConsentRequiredAfterApproval",
      "android.dnsGuardStartedAfterVpnConsent",
      "android.dnsGuardNoSilentStartWithoutConsent",
      "android.dnsGuardDeniedConsentNoPromptLoop",
      "android.notificationPermissionRequired",
      "android.notificationPermissionGranted",
      "android.notificationRuntimePromptShown",
      "android.notificationSettingsFallbackOpenedIfDenied",
    ],
    usageStatsAuthorized,
  };
  const settingsRouteOpenedAt = new Date().toISOString();
  const accessibilityReport = {
    schemaVersion: "freed-android-permission-report-v1",
    sanitized: true,
    runId: `${options.runId}-accessibility-permission`,
    platform: "android",
    reportKind: "accessibility-permission",
    appPackage: options.appPackage,
    accessibilityServiceEnabled: accessibility.serviceEnabled,
    accessibilityServiceComponent: accessibility.serviceComponent,
    androidSettingsRouteOpened: "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
    androidSettingsRouteComponent: `${options.appPackage}/app.freed.protection.FreedAccessibilityService`,
    androidSettingsRouteOpenedAt: settingsRouteOpenedAt,
    androidSettingsRoutes: [
      "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
      "android.settings.APP_NOTIFICATION_SETTINGS",
      "android.settings.PRIVATE_DNS_SETTINGS",
      "android.settings.ACCESSIBILITY_SETTINGS",
      "android.settings.USAGE_ACCESS_SETTINGS",
      "android.settings.WIRELESS_SETTINGS",
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      "android.settings.SETTINGS",
    ],
    checks: {
      explicitUserPermissionConfirmed: false,
      accessibilityServiceDetailsRouteCaptured: true,
      accessibilitySettingsCaptured: diagnostics.some((entry) => entry.label === "accessibility-enabled" && entry.ok),
      enabledServicesCaptured: diagnostics.some((entry) => entry.label === "enabled-accessibility-services" && entry.ok),
      serviceComponentMatchesFreed: Boolean(accessibility.serviceComponent && accessibility.serviceComponent.includes(options.appPackage)),
      accessibilityServiceEnabled: accessibility.serviceEnabled,
      noHiddenMonitoring: false,
      noOverlayPermissionRequired: true,
      noScreenshotAnalysis: true,
      noContinuousOcr: true,
      noPacketInspection: true,
    },
    manualCompletionRequired:
      "Set explicitUserPermissionConfirmed and noHiddenMonitoring true only after the release permission-flow recording proves the user enabled FREED's AccessibilityService through Android Settings with the in-app disclosure shown.",
    supportingArtifacts: {
      permissionTextArtifact: repoRelative(proofPath),
    },
  };
  const vpnConsentReport = {
    schemaVersion: "freed-android-permission-report-v1",
    sanitized: true,
    runId: `${options.runId}-dns-guard-vpn-consent`,
    platform: "android",
    reportKind: "dns-guard-vpn-consent",
    appPackage: options.appPackage,
    vpnConsentRequiredBeforeApproval: false,
    vpnConsentRequiredAfterApproval: "",
    dnsGuardStartedAfterVpnConsent: false,
    dnsGuardNoSilentStartWithoutConsent: false,
    dnsGuardDeniedConsentNoPromptLoop: false,
    androidSettingsRoutes: [
      "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
      "android.settings.APP_NOTIFICATION_SETTINGS",
      "android.settings.PRIVATE_DNS_SETTINGS",
      "android.settings.ACCESSIBILITY_SETTINGS",
      "android.settings.USAGE_ACCESS_SETTINGS",
      "android.settings.WIRELESS_SETTINGS",
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      "android.settings.SETTINGS",
    ],
    checks: {
      vpnConsentDialogObserved: false,
      vpnConsentRequiredBeforeApproval: false,
      vpnConsentApprovedByUser: false,
      vpnConsentRequiredAfterApprovalFalse: false,
      dnsGuardStartedAfterConsent: false,
      nativeStatusVpnConsentRequiredFalse: false,
      deniedConsentDoesNotLoopPrompt: false,
      settingsRoutesCaptured: true,
      settingsFallbackRoutesCaptured: true,
      noSilentVpnConsentBypass: false,
      dnsOnlyVpnService: true,
      noFullTrafficProxy: true,
      noMitmHttps: true,
      noPacketPayloadInspection: true,
    },
    manualCompletionRequired:
      "Set the false fields/checks true only after Android hardware QA records the VpnService consent dialog before approval, observes FREED returning with vpnConsentRequired=false, proves DNS Guard starts only after approval, and proves denying consent does not launch a repeated prompt loop.",
    supportingArtifacts: {
      permissionTextArtifact: repoRelative(proofPath),
    },
  };
  const notificationPermissionReport = {
    schemaVersion: "freed-android-permission-report-v1",
    sanitized: true,
    runId: `${options.runId}-notification-permission`,
    platform: "android",
    reportKind: "notification-permission",
    appPackage: options.appPackage,
    notificationPermissionRequired: androidNotificationPermissionRequired,
    notificationPermissionGranted: androidNotificationPermissionGranted,
    androidSettingsRouteOpened: "android.settings.APP_NOTIFICATION_SETTINGS",
    androidSettingsRouteOpenedAt: settingsRouteOpenedAt,
    androidSettingsRoutes: [
      "android.settings.APP_NOTIFICATION_SETTINGS",
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      "android.settings.SETTINGS",
    ],
    checks: {
      notificationRuntimePromptShown: false,
      nativeStatusCapturedBeforePrompt: androidNotificationPermissionRequired !== null,
      nativeStatusCapturedAfterPrompt: false,
      notificationPermissionRequiredCaptured: androidNotificationPermissionRequired !== null,
      notificationPermissionGrantedCaptured: androidNotificationPermissionGranted !== null,
      appNotificationSettingsFallbackCaptured: true,
      settingsFallbackOnlyWhenDenied: false,
      noSilentNotificationGrant: true,
      noNotificationListenerRequirement: true,
      noRawNotificationHistoryStored: true,
      noDnsHistoryStored: true,
      noPacketInspection: true,
    },
    manualCompletionRequired:
      "Set notificationRuntimePromptShown, nativeStatusCapturedAfterPrompt, and settingsFallbackOnlyWhenDenied true only after Android 13+ hardware QA records FREED asking the runtime notification prompt first, reruns native status, and opens android.settings.APP_NOTIFICATION_SETTINGS only if Android still reports notification permission denied.",
    supportingArtifacts: {
      permissionTextArtifact: repoRelative(proofPath),
    },
  };
  const usageAccessReport = {
    schemaVersion: "freed-android-permission-report-v1",
    sanitized: true,
    runId: `${options.runId}-usage-access-permission`,
    platform: "android",
    reportKind: "usage-access-permission",
    appPackage: options.appPackage,
    usageStatsAuthorized,
    androidSettingsRouteOpened: ANDROID_USAGE_ACCESS_SETTINGS_ROUTE,
    androidSettingsRouteOpenedAt: settingsRouteOpenedAt,
    androidSettingsRoutes: [
      "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
      "android.settings.APP_NOTIFICATION_SETTINGS",
      "android.settings.PRIVATE_DNS_SETTINGS",
      "android.settings.ACCESSIBILITY_SETTINGS",
      ANDROID_USAGE_ACCESS_SETTINGS_ROUTE,
      "android.settings.WIRELESS_SETTINGS",
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      "android.settings.SETTINGS",
    ],
    androidUsageAccessManualTogglePath: ANDROID_USAGE_ACCESS_MANUAL_TOGGLE_PATH,
    metrics: {
      usageStatsObservedPackages: null,
      usageStatsObservedPackageNames: [],
      usageStatsTodayMinutes: null,
      usageStatsTodayMinutesByPackage: {},
    },
    checks: {
      explicitUserPermissionConfirmed: false,
      usageAccessSettingsRouteCaptured: true,
      usageAccessManualTogglePathCaptured: true,
      usageAccessRequiresExplicitUserToggle: true,
      noSilentUsageAccessGrant: true,
      noPackageSpecificUsageAccessDeepLinkClaim: true,
      usageAccessAppOpsCaptured: usageResults.some((entry) => entry.ok),
      usageStatsAuthorized: usageStatsAuthorized === true,
      nativeStatusUsageStatsAuthorized: false,
      selectedAppPackageDiagnosticsCaptured: false,
      usageStatsObservedPackageNamesCaptured: false,
      usageStatsTodayMinutesCaptured: false,
      aggregateOnlyUsageMetrics: true,
      noRawUsageEventsStored: true,
      noScreenshotAnalysis: true,
      noPacketInspection: true,
    },
    manualCompletionRequired:
      `Fill the metrics and set the false checks true only after the release recording shows the user toggled FREED at ${ANDROID_USAGE_ACCESS_MANUAL_TOGGLE_PATH} and FREED Profile > Native Protection shows usageStatsAuthorized=true plus aggregate selected-app package names and same-day minute totals.`,
    supportingArtifacts: {
      permissionTextArtifact: repoRelative(proofPath),
    },
  };

  const sections = [
    "# Android Permission Proof",
    "",
    `Run ID: ${options.runId}-android-permissions`,
    `FREED package: ${options.appPackage}`,
    `Accessibility service: ${accessibility.serviceComponent}`,
    "",
    "Manual expectation: Accessibility is enabled for FREED, Usage Access is allowed for FREED, and the FREED native status/profile panel shows `usageStatsAuthorized=true`, `usageStatsObservedPackages`, `usageStatsObservedPackageNames`, `usageStatsTodayMinutes`, and `usageStatsTodayMinutesByPackage` for the selected app timer configuration.",
    "",
    "Suggested release evidence fields:",
    "",
    "- `android.permissionWizardRunId`",
    "- `android.permissionWizardArtifact`",
    `- \`android.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}\``,
    "- `android.permissionExplanationShown=true`",
    "- `android.permissionExplanationSummary` includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy",
    "- `android.permissionWizardTestProtectionPassed=true`",
    "- `android.accessibilityPermissionRunId`",
    "- `android.accessibilityPermissionArtifact`",
    "- `android.usageAccessPermissionRunId`",
    "- `android.usageAccessPermissionArtifact`",
    "- `android.usageStatsAuthorized`",
    "- `android.usageStatsObservedPackages`",
    "- `android.usageStatsObservedPackageNames`",
    "- `android.usageStatsTodayMinutes`",
    "- `android.usageStatsTodayMinutesByPackage`",
    "- `android.notificationPermissionRunId`",
    "- `android.notificationPermissionArtifact`",
    "- `android.notificationPermissionRequired`",
    "- `android.notificationPermissionGranted`",
    "- `android.notificationRuntimePromptShown=true`",
    "- `android.notificationSettingsFallbackOpenedIfDenied=true`",
    "- `android.dnsGuardVpnConsentRunId`",
    "- `android.dnsGuardVpnConsentArtifact`",
    "- `android.dnsGuardVpnConsentRequiredBeforeApproval=true`",
    "- `android.dnsGuardVpnConsentRequiredAfterApproval=false`",
    "- `android.dnsGuardStartedAfterVpnConsent=true`",
    "- `android.dnsGuardNoSilentStartWithoutConsent=true`",
    "- `android.dnsGuardDeniedConsentNoPromptLoop=true`",
    "",
    "Parsed status:",
    "",
    `- accessibilityEnabled: ${accessibility.accessibilityEnabled}`,
    `- accessibilityServiceEnabled: ${accessibility.serviceEnabled}`,
    `- usageStatsAuthorizedFromAppOps: ${usageStatsAuthorized === null ? "unknown" : usageStatsAuthorized}`,
    `- androidNotificationPermissionRequired: ${androidNotificationPermissionRequired === null ? "unknown" : androidNotificationPermissionRequired}`,
    `- androidNotificationPermissionGrantedFromAppOps: ${androidNotificationPermissionGranted === null ? "unknown" : androidNotificationPermissionGranted}`,
    `- notificationListenerEnabled: ${notificationListenerEnabled}`,
    `- privateDnsMode: ${privateDnsMode || "unknown"}`,
    `- alwaysOnVpnApp: ${alwaysOnVpnApp || "unknown"}`,
    `- vpnLockdownEnabled: ${permissionSummary.networkState.vpnLockdownEnabled}`,
    "",
  ];

  for (const entry of diagnostics) {
    sections.push(`## ${entry.label}`, "", `$ adb -s ${serial} ${entry.args.join(" ")}`, "", "```", diagnosticText(entry) || "(empty)", "```", "");
  }

  writeTextArtifact(proofPath, sections.join("\n"));
  writeJsonArtifact(accessibilityReportPath, accessibilityReport);
  writeJsonArtifact(usageAccessReportPath, usageAccessReport);
  writeJsonArtifact(notificationPermissionReportPath, notificationPermissionReport);
  writeJsonArtifact(vpnConsentReportPath, vpnConsentReport);
  writeJsonArtifact(summaryReportPath, {
    ...permissionSummary,
    accessibilityReportArtifact: repoRelative(accessibilityReportPath),
    artifact: repoRelative(proofPath),
    jsonArtifact: repoRelative(summaryReportPath),
    notificationPermissionReportArtifact: repoRelative(notificationPermissionReportPath),
    usageAccessReportArtifact: repoRelative(usageAccessReportPath),
    vpnConsentReportArtifact: repoRelative(vpnConsentReportPath),
  });
  return {
    ...permissionSummary,
    accessibilityReportArtifact: repoRelative(accessibilityReportPath),
    artifact: repoRelative(proofPath),
    jsonArtifact: repoRelative(summaryReportPath),
    notificationPermissionReportArtifact: repoRelative(notificationPermissionReportPath),
    usageAccessReportArtifact: repoRelative(usageAccessReportPath),
    vpnConsentReportArtifact: repoRelative(vpnConsentReportPath),
  };
}

async function captureUiAutomatorDump(serial, output) {
  const remotePath = `/sdcard/freed-native-status-${Date.now()}.xml`;
  const dump = await captureAdbDiagnostic(serial, ["shell", "uiautomator", "dump", remotePath]);
  let xml = diagnosticText(dump);
  if (dump.ok) {
    const cat = await captureAdbDiagnostic(serial, ["shell", "cat", remotePath]);
    xml = diagnosticText(cat);
    await captureAdbDiagnostic(serial, ["shell", "rm", remotePath]);
  }
  writeTextArtifact(output, xml || "\n");
  return { dump, xml };
}

async function captureNativeStatusProof(serial, outputDir, options) {
  const screenshotPath = path.join(outputDir, "android-native-status.png");
  const activityPath = path.join(outputDir, "android-native-status.activity.txt");
  const uiPath = path.join(outputDir, "android-native-status-ui.xml");
  const textPath = path.join(outputDir, "android-native-status-text.txt");
  const adultFeedStatusPath = path.join(outputDir, "android-adult-domain-feed-status-report.json");
  const lifecyclePath = path.join(outputDir, "android-dns-guard-lifecycle-report.json");
  const launch = await bringAppToFront(serial, options.appPackage);
  await new Promise((resolve) => setTimeout(resolve, options.nativeStatusWaitMs));
  const screenshotAnalysis = await captureScreenshot(serial, screenshotPath);
  const top = await topActivity(serial, activityPath);
  const uiDump = await captureUiAutomatorDump(serial, uiPath);
  const texts = extractUiText(uiDump.xml);
  const signals = nativeStatusSignals(texts);
  const dnsGuardCounters = parseDnsGuardLifecycleCounters(texts);
  const adultFeedStatus = parseAdultDomainFeedStatus(texts);
  const sections = [
    "# Android Native Status Text",
    "",
    `Run ID: ${options.runId}-android-native-status`,
    `FREED package: ${options.appPackage}`,
    "",
    "Manual expectation: before capture, open FREED to Profile > Native Protection so the screenshot and UI text show Usage Access metrics, adult-domain feed version/checksum/domain count, Private DNS, DNS Guard resolver diagnostics, and DNS Guard restart eligibility/result diagnostics. Do not promote if this capture is on the wrong screen or misses the required status rows.",
    "",
    "Suggested release evidence fields:",
    "",
    "- `android.usageAccessPermissionArtifact`",
    "- `android.usageStatsAuthorized`",
    "- `android.usageStatsObservedPackages`",
    "- `android.usageStatsObservedPackageNames`",
    "- `android.usageStatsTodayMinutes`",
    "- `android.usageStatsTodayMinutesByPackage`",
    "- `android.adultDomainFeedStatusRunId`",
    "- `android.adultDomainFeedStatusArtifact`",
    "- `android.adultDomainFeedVersion`",
    "- `android.adultDomainFeedChecksum`",
    "- `android.adultDomainFeedDomainCount`",
    "- `android.dnsGuardBlockArtifact`",
    "- `android.dnsGuardLifecycleArtifact`",
    "- `android.dnsGuardSessionQueries`",
    "- `android.dnsGuardBlockedQueries`",
    "- `android.dnsGuardAllowedQueries`",
    "- `android.dnsGuardServfailResponses`",
    "- `android.dnsGuardMalformedPackets`",
    "",
    "Parsed UI signals:",
    "",
    `- nativeProtectionPanelSeen: ${signals.nativeProtectionPanelSeen}`,
    `- usageStatsMetricsSeen: ${signals.usageStatsMetricsSeen}`,
    `- adultDomainFeedStatusSeen: ${signals.adultDomainFeedStatusSeen}`,
    `- adultDomainFeedVersion: ${adultFeedStatus.feedVersion || "not parsed"}`,
    `- adultDomainFeedChecksum: ${adultFeedStatus.feedChecksum || "not parsed"}`,
    `- adultDomainFeedDomainCount: ${adultFeedStatus.domainCount ?? "not parsed"}`,
    `- dnsGuardResolverSeen: ${signals.dnsGuardResolverSeen}`,
    `- dnsGuardLifecycleSeen: ${signals.dnsGuardLifecycleSeen}`,
    `- dnsGuardRestartSeen: ${signals.dnsGuardRestartSeen}`,
    "",
    "Parsed DNS Guard counters:",
    "",
    ...(dnsGuardCounters
      ? [
          `- android.dnsGuardSessionQueries: ${dnsGuardCounters.dnsGuardSessionQueries}`,
          `- android.dnsGuardBlockedQueries: ${dnsGuardCounters.dnsGuardBlockedQueries}`,
          `- android.dnsGuardAllowedQueries: ${dnsGuardCounters.dnsGuardAllowedQueries}`,
          `- android.dnsGuardServfailResponses: ${dnsGuardCounters.dnsGuardServfailResponses}`,
          `- android.dnsGuardMalformedPackets: ${dnsGuardCounters.dnsGuardMalformedPackets}`,
        ]
      : ["- not parsed from UI text"]),
    "",
    "Extracted UI text:",
    "",
    ...texts.map((text) => `- ${text}`),
    "",
  ];
  writeTextArtifact(textPath, sections.join("\n"));
  writeJsonArtifact(adultFeedStatusPath, {
    schemaVersion: "freed-android-adult-domain-feed-status-report-v1",
    sanitized: true,
    runId: `${options.runId}-android-native-status`,
    platform: "android",
    metrics: {
      feedVersion: adultFeedStatus.feedVersion || null,
      feedChecksum: adultFeedStatus.feedChecksum || null,
      domainCount: adultFeedStatus.domainCount,
    },
    checks: {
      nativeStatusPanelVisible: signals.nativeProtectionPanelSeen,
      adultDomainFeedStatusVisible: signals.adultDomainFeedStatusSeen,
      feedVersionVisible: Boolean(adultFeedStatus.feedVersion),
      feedChecksumVisible: Boolean(adultFeedStatus.feedChecksum),
      domainCountVisible: typeof adultFeedStatus.domainCount === "number" && Number.isFinite(adultFeedStatus.domainCount),
      cachedNativeFeedPresent: false,
      accessibilityFeedSynced: false,
      dnsGuardFeedSynced: false,
      noRawDomainListStored: true,
      noNormalBrowsingHostsStored: true,
      noScreenshotAnalysis: true,
      noPacketInspection: true,
    },
    manualCompletionRequired:
      "Before promotion, fill any unparsed feed metrics and set cachedNativeFeedPresent/accessibilityFeedSynced/dnsGuardFeedSynced true only when the physical device proves the native cached feed version/checksum/domain count powers both Accessibility and DNS Guard synced-feed classification.",
    supportingArtifacts: {
      screenshotArtifact: repoRelative(screenshotPath),
      textArtifact: repoRelative(textPath),
      uiAutomatorArtifact: repoRelative(uiPath),
    },
  });
  writeJsonArtifact(lifecyclePath, {
    schemaVersion: "freed-dns-guard-lifecycle-report-v1",
    sanitized: true,
    runId: `${options.runId}-android-native-status`,
    platform: "android",
    resolver: "",
    metrics: {
      sessionQueries: dnsGuardCounters?.dnsGuardSessionQueries ?? null,
      blockedQueries: dnsGuardCounters?.dnsGuardBlockedQueries ?? null,
      allowedQueries: dnsGuardCounters?.dnsGuardAllowedQueries ?? null,
      servfailResponses: dnsGuardCounters?.dnsGuardServfailResponses ?? null,
      malformedPackets: dnsGuardCounters?.dnsGuardMalformedPackets ?? null,
    },
    checks: {
      dnsOnlyVpnService: true,
      nativeStatusPanelVisible: signals.nativeProtectionPanelSeen,
      sessionCountersVisible: Boolean(dnsGuardCounters),
      privateDnsStatusCaptured: signals.dnsGuardResolverSeen,
      vpnStateCaptured: signals.dnsGuardResolverSeen,
      userEnabledStateVisible: signals.dnsGuardLifecycleSeen,
      foregroundServiceVisible: false,
      noFullTrafficProxy: true,
      noMitmHttps: true,
      noPacketPayloadInspection: true,
    },
    manualCompletionRequired:
      "Before promotion, fill the resolver from FREED Native Protection status, confirm foreground-service visibility while DNS Guard is active, and keep DNS-only/no-MITM checks true only when verified on the physical device.",
    screenshotArtifact: repoRelative(screenshotPath),
    textArtifact: repoRelative(textPath),
    uiAutomatorArtifact: repoRelative(uiPath),
  });
  return {
    adultDomainFeedStatusArtifact: repoRelative(adultFeedStatusPath),
    adultDomainFeedStatusMetrics: adultFeedStatus,
    launchStdout: launch.stdout.trim(),
    lifecycleArtifact: repoRelative(lifecyclePath),
    manualExpectation:
      "Confirm the screenshot and UI text show FREED Profile > Native Protection with Usage Access metrics, adult-domain feed status, Private DNS, DNS Guard resolver diagnostics, and DNS Guard restart diagnostics before using this as release evidence.",
    observedTopPackage: top.packageName,
    runId: `${options.runId}-android-native-status`,
    screenshotAnalysis,
    screenshotArtifact: repoRelative(screenshotPath),
    suggestedEvidenceFields: [
      "android.usageAccessPermissionArtifact",
      "android.usageStatsAuthorized",
      "android.usageStatsObservedPackages",
      "android.usageStatsObservedPackageNames",
      "android.usageStatsTodayMinutes",
      "android.usageStatsTodayMinutesByPackage",
      "android.notificationPermissionRequired",
      "android.notificationPermissionGranted",
      "android.adultDomainFeedStatusRunId",
      "android.adultDomainFeedStatusArtifact",
      "android.adultDomainFeedVersion",
      "android.adultDomainFeedChecksum",
      "android.adultDomainFeedDomainCount",
      "android.dnsGuardBlockArtifact",
      "android.dnsGuardLifecycleArtifact",
      "android.dnsGuardSessionQueries",
      "android.dnsGuardBlockedQueries",
      "android.dnsGuardAllowedQueries",
      "android.dnsGuardServfailResponses",
      "android.dnsGuardMalformedPackets",
    ],
    textArtifact: repoRelative(textPath),
    topActivityArtifact: repoRelative(activityPath),
    uiAutomatorArtifact: repoRelative(uiPath),
    uiAutomatorDumpOk: uiDump.dump.ok,
    parsedDnsGuardCounters: dnsGuardCounters,
    uiTextSignals: signals,
    waitMs: options.nativeStatusWaitMs,
  };
}

async function captureFocusedWebViewProof(serial, outputDir, options) {
  const scenario = focusedWebViewPlan(options)[0];
  const base = `${slug(scenario.app.label)}-${slug(scenario.app.packageName)}-${scenario.name}`;
  const screenshotPath = path.join(outputDir, `${base}.png`);
  const logcatPath = path.join(outputDir, `${base}.logcat.txt`);
  const activityPath = path.join(outputDir, `${base}.activity.txt`);
  const uiPath = path.join(outputDir, `${base}.ui.xml`);
  const textPath = path.join(outputDir, `${base}.ui-text.txt`);
  const reportPath = path.join(outputDir, `${base}-intercept-report.json`);
  const runId = `${options.runId}-${base}`;

  await clearLogcat(serial);
  const launch = await openApp(serial, scenario.app.packageName);
  await new Promise((resolve) => setTimeout(resolve, scenario.waitMs));
  const screenshotAnalysis = await captureScreenshot(serial, screenshotPath);
  const logcat = await dumpLogcat(serial, options.logcatLines, logcatPath);
  const logcatSummary = summarizeLogcat(logcat, options.appPackage);
  if (logcatSummary.crashSignalCount > 0) {
    throw new Error(`Detected FREED crash/ANR during ${scenario.app.label} focused WebView capture:\n${logcatSummary.crashSignals.join("\n---\n")}`);
  }
  const top = await topActivity(serial, activityPath);
  const uiDump = await captureUiAutomatorDump(serial, uiPath);
  const texts = extractUiText(uiDump.xml);
  const textSections = [
    "# Android Focused WebView UI Text",
    "",
    `Run ID: ${runId}`,
    `Fixture package: ${scenario.app.packageName}`,
    "",
    "Manual expectation: the QA fixture URL field was focused with a high-confidence adult URL, and FREED opened a recovery handoff before page-content inspection or broad WebView scraping.",
    "",
    "Extracted UI text:",
    "",
    ...texts.map((text) => `- ${text}`),
    "",
  ];
  writeTextArtifact(textPath, textSections.join("\n"));

  const backStackCheck = options.backStackCheck
    ? await captureBackStackCheck(serial, outputDir, base, options.backStackWaitMs)
    : null;
  const reportArtifact = writeAndroidBrowserInterceptReport(reportPath, {
    browserPackage: scenario.app.packageName,
    matchedRule: "focused-webview:adult-url-field",
    runId,
    surface: "Focused WebView",
    supportingArtifacts: {
      logcatArtifact: repoRelative(logcatPath),
      screenshotArtifact: repoRelative(screenshotPath),
      textArtifact: repoRelative(textPath),
      topActivityArtifact: repoRelative(activityPath),
      uiAutomatorArtifact: repoRelative(uiPath),
    },
  });
  return {
    ...(backStackCheck ? { backStackCheck } : {}),
    app: scenario.app,
    expected: scenario.expected,
    focusedWebViewProof: scenario.focusedWebViewProof,
    launchStdout: launch.stdout.trim(),
    logcatArtifact: repoRelative(logcatPath),
    logcatSummary,
    manualPrerequisite: scenario.manualPrerequisite,
    observedTopPackage: top.packageName,
    reportArtifact,
    runId,
    scenario: scenario.name,
    screenshotAnalysis,
    screenshotArtifact: repoRelative(screenshotPath),
    suggestedEvidenceField: scenario.suggestedEvidenceField,
    textArtifact: repoRelative(textPath),
    topActivityArtifact: repoRelative(activityPath),
    uiAutomatorArtifact: repoRelative(uiPath),
    uiAutomatorDumpOk: uiDump.dump.ok,
    waitMs: scenario.waitMs,
  };
}

async function capture(options) {
  activeDeviceToolTimeoutMs = options.toolTimeoutMs;
  if (options.listDevicesOnly) {
    await captureDeviceDiscovery(options);
    return;
  }
  if (options.planOnly) {
    const plan = {
      appPackage: options.appPackage,
      browsers: options.browsers,
      manualProofs: [
        "android.installQaRunId",
        "android.installQaArtifact local freed-android-install-qa-report-v1 JSON",
        "android.accessibilityPermissionRunId",
        "android.accessibilityPermissionArtifact",
        "android.usageAccessPermissionRunId",
        "android.usageAccessPermissionArtifact",
        "android.notificationPermissionRunId",
        "android.notificationPermissionArtifact",
        "android.usageStatsAuthorized=true",
        "android.usageStatsObservedPackages",
        "android.usageStatsObservedPackageNames",
        "android.usageStatsTodayMinutes",
        "android.usageStatsTodayMinutesByPackage",
        "android.adultDomainFeedStatusRunId",
        "android.adultDomainFeedStatusArtifact",
        "android.dnsGuardBlockRunId",
        "android.dnsGuardBlockArtifact",
        "android.dnsGuardBlockArtifact local freed-dns-guard-block-report-v1 JSON",
        "android.dnsGuardInterventionVisible=true",
        "android.dnsGuardLifecycleArtifact",
        "android.dnsGuardLifecycleArtifact local freed-dns-guard-lifecycle-report-v1 JSON",
        "android.dnsGuardSessionQueries>=2",
        "android.dnsGuardBlockedQueries>=1",
        "android.dnsGuardAllowedQueries>=1",
        "android.dnsGuardServfailResponses>=0",
        "android.dnsGuardMalformedPackets>=0",
        "android.adultDomainFeedAccessibilityRunId",
        "android.adultDomainFeedAccessibilityArtifact",
        "android.adultDomainFeedDnsGuardRunId",
        "android.adultDomainFeedDnsGuardArtifact",
        "android.adultDomainFeedDnsGuardArtifact local freed-dns-guard-block-report-v1 JSON",
        "android.focusedBrowserSearchArtifact",
        "android.focusedBrowserSearchRedactedHost=focused-search.app.freed.local",
        "android.focusedBrowserSearchRawQueryStored=false",
        "android.focusedWebViewPackage",
        "android.focusedWebViewRunId",
        "android.focusedWebViewArtifact",
        "android.backStackCleanupRunId",
        "android.backStackCleanupArtifact",
        "android.configuredAppShieldInterventionId=configured-app:<package>",
        "android.earnedUnlockDurationMinutes",
        "android.earnedUnlockAppAllowArtifact local freed-android-earned-unlock-report-v1 JSON",
        "android.earnedUnlockRelockArtifact local freed-android-earned-unlock-report-v1 JSON",
        "android.earnedUnlockSourcePackage=<configured package>",
        "android.earnedUnlockRelockUsageMinutes>=android.configuredAppShieldDailyLimitMinutes",
        "android.browserEarnedUnlockNoAppUnlockRunId",
        "android.browserEarnedUnlockNoAppUnlockArtifact",
        "android.browserEarnedUnlockNoAppUnlockArtifact local freed-android-browser-earned-unlock-report-v1 JSON",
        "android.browserEarnedUnlockSourceHost=<blocked browser/adult-domain source>",
        "android.browserEarnedUnlockNativeAppUnlockActive=false",
        "android.browserEarnedUnlockConfiguredAppStillShielded=true",
        "android.browserEarnedUnlockAdultFilterStillActive=true",
        "android.challengePhotoClassifier=ML Kit",
        "android.challengePhotoNoBase64OrExif=true",
        "android.challengePhotoTemporaryFileDeleted=true",
        "android.challengeMotionSamples>=6",
        "android.challengeStepCount>=12",
        "android.challengeLocationBestAccuracyMeters<=80",
        "android.configuredAppShieldBeforeLimitAllowArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.configuredAppShieldArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.shortFormBelowThresholdAllowArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.shortFormArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.shortFormUsageBeforeLimitMinutes<android.configuredAppShieldDailyLimitMinutes",
        "android.shortFormSelectedSurfaceArtifact",
        "android.shortFormSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON",
        "android.shortFormSelectedSurfaceVerified=true",
        "android.shortFormInterventionId=short-form:youtube-shorts",
        "android.instagramReelsUsageBeforeLimitMinutes<android.configuredAppShieldDailyLimitMinutes",
        "android.instagramReelsArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.instagramReelsSelectedSurfaceArtifact",
        "android.instagramReelsSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON",
        "android.instagramReelsSelectedSurfaceVerified=true",
        "android.instagramReelsInterventionId=short-form:instagram-reels",
        "android.tiktokFeedUsageBeforeLimitMinutes<android.configuredAppShieldDailyLimitMinutes",
        "android.tiktokFeedArtifact local freed-android-app-intervention-report-v1 JSON",
        "android.tiktokFeedSelectedSurfaceArtifact",
        "android.tiktokFeedSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON",
        "android.tiktokFeedSelectedSurfaceVerified=true",
        "android.tiktokFeedInterventionId=short-form:tiktok-feed",
        "android.playPolicyAccessibilityReviewId",
        "android.playPolicyAccessibilityArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true",
        "android.playPolicySpecialUseFgsReviewId",
        "android.playPolicySpecialUseFgsArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true",
      ],
      adultDomainFeedHost: options.adultDomainFeedHost || null,
      appScenarios: appScenarioPlan(options),
      backStackCheck: options.backStackCheck,
      challengeVerificationProof: androidChallengeVerificationProof(options),
      permissionWizardProof: androidPermissionWizardProof(options),
      dnsGuardProof: options.dnsGuardProof
        ? {
            host: options.dnsGuardHost,
            suggestedEvidenceFields: [
              "android.dnsGuardBlockArtifact",
              "android.dnsGuardInterventionVisible=true",
              "android.adultDomainFeedDnsGuardArtifact",
            ],
            visibleInterventionProof:
              "After DNS probes, the helper captures an activity screenshot, notification shade screenshot, notification dump, and UI dump for manual `android.dnsGuardInterventionVisible=true` review.",
            visibleWaitMs: options.dnsGuardVisibleWaitMs,
          }
        : null,
      dnsGuardRestartProof: options.dnsGuardRestartProof
        ? {
            suggestedEvidenceFields: [
              "android.dnsGuardRestartRunId",
              "android.dnsGuardRestartArtifact",
              "android.dnsGuardRestartArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true",
              "android.dnsGuardRestartAction",
              "android.dnsGuardRestartResult",
              "android.dnsGuardRestartUserEnabled",
              "android.dnsGuardRestartEligible",
              "android.dnsGuardRestartSkippedRunId",
              "android.dnsGuardRestartSkippedArtifact",
              "android.dnsGuardRestartSkippedArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true",
              "android.dnsGuardRestartSkippedReason",
              "android.dnsGuardRestartNoSilentPromptConfirmed",
            ],
          }
        : null,
      outputDir: options.outputDir,
      toolTimeoutMs: options.toolTimeoutMs,
      nativeStatusProof: options.nativeStatusProof
        ? {
            suggestedEvidenceFields: [
              "android.usageAccessPermissionArtifact",
              "android.usageStatsAuthorized",
              "android.usageStatsObservedPackages",
              "android.usageStatsObservedPackageNames",
              "android.usageStatsTodayMinutes",
              "android.usageStatsTodayMinutesByPackage",
              "android.adultDomainFeedStatusArtifact",
              "android.adultDomainFeedVersion",
              "android.adultDomainFeedChecksum",
              "android.adultDomainFeedDomainCount",
              "android.dnsGuardBlockArtifact",
              "android.dnsGuardLifecycleArtifact",
              "android.dnsGuardSessionQueries",
              "android.dnsGuardBlockedQueries",
              "android.dnsGuardAllowedQueries",
              "android.dnsGuardServfailResponses",
              "android.dnsGuardMalformedPackets",
            ],
          }
        : null,
      permissionProof: options.permissionProof
        ? {
            suggestedEvidenceFields: [
              "android.permissionWizardRunId",
              "android.permissionWizardArtifact",
              "android.permissionWizardFlowOrder",
              "android.permissionExplanationShown",
              "android.permissionExplanationSummary",
              "android.permissionWizardTestProtectionPassed",
              "android.accessibilityPermissionRunId",
              "android.accessibilityPermissionArtifact",
              "android.usageAccessPermissionRunId",
              "android.usageAccessPermissionArtifact",
              "android.usageStatsAuthorized",
              "android.usageStatsObservedPackages",
              "android.usageStatsObservedPackageNames",
              "android.usageStatsTodayMinutes",
              "android.usageStatsTodayMinutesByPackage",
            ],
          }
        : null,
      focusedWebViewProof: options.focusedWebViewProof
        ? {
            packageName: options.focusedWebViewPackage,
            suggestedEvidenceFields: [
              "android.focusedWebViewPackage",
              "android.focusedWebViewRunId",
              "android.focusedWebViewArtifact",
            ],
          }
        : null,
      playPolicyProof: options.playPolicyProof
        ? {
            reviewIdsStillRequired: ["android.playPolicyAccessibilityReviewId", "android.playPolicySpecialUseFgsReviewId"],
            suggestedEvidenceFields: ["android.playPolicyAccessibilityArtifact", "android.playPolicySpecialUseFgsArtifact"],
          }
        : null,
      runId: options.runId,
      scenarios: scenarioPlan(options),
      webViewScenarios: focusedWebViewPlan(options),
      result: "plan-only",
      sanitized: true,
      schema: "freed-android-real-browser-capture-v1",
    };
    const manifest = {
      ...plan,
      attempts: [],
      challengeVerificationProof: androidChallengeVerificationProof(options),
      evidenceSatisfied: false,
      generatedAt: new Date().toISOString(),
      manualVerificationRequired: true,
      outputDir: repoRelative(options.outputDir),
      releaseGate: "android-real-browser-validation",
    };
    const manifestPath = path.join(options.outputDir, "capture-manifest.json");
    const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
    const evidenceFillTemplatePath = path.join(options.outputDir, "android-real-browser-evidence-fill-template.json");
    writeJsonArtifact(manifestPath, manifest);
    writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
    writeTextArtifact(notesPath, buildNotes(manifest));
    console.log(
      JSON.stringify(
        {
          ...manifest,
          evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
          manifestArtifact: repoRelative(manifestPath),
          notesArtifact: repoRelative(notesPath),
        },
        null,
        2,
      ),
    );
    return;
  }

  const policyOnly =
    options.playPolicyProof &&
    options.scenario === "none" &&
    options.appScenario === "none" &&
    !options.dnsGuardProof &&
    !options.dnsGuardRestartProof &&
    !options.permissionProof &&
    !options.nativeStatusProof &&
    !options.focusedWebViewProof;
  if (policyOnly) {
    const playPolicyProof = capturePlayPolicyProof(options.outputDir, options);
    const manifest = {
      appPackage: options.appPackage,
      attempts: [],
      challengeVerificationProof: androidChallengeVerificationProof(options),
      generatedAt: new Date().toISOString(),
      manualVerificationRequired: true,
      outputDir: repoRelative(options.outputDir),
      playPolicyProof,
      releaseGate: "android-real-browser-validation",
      result: "local-policy-artifacts-captured",
      runId: options.runId,
      schema: "freed-android-real-browser-capture-v1",
      toolTimeoutMs: options.toolTimeoutMs,
    };
    const manifestPath = path.join(options.outputDir, "capture-manifest.json");
    const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
    const evidenceFillTemplatePath = path.join(options.outputDir, "android-real-browser-evidence-fill-template.json");
    writeJsonArtifact(manifestPath, manifest);
    writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
    writeTextArtifact(notesPath, buildNotes(manifest));
    console.log(
      JSON.stringify(
        {
          ...manifest,
          evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
          manifestArtifact: repoRelative(manifestPath),
          notesArtifact: repoRelative(notesPath),
        },
        null,
        2,
      ),
    );
    return;
  }

  const device = await resolveDevice(options.device);
  const profile = await deviceProfile(device);
  await requirePhysicalDevice(profile);
  await requirePackage(profile.serial, options.appPackage);
  if (options.focusedWebViewProof) {
    await requirePackage(profile.serial, options.focusedWebViewPackage);
  }
  if (options.scenario !== "none") {
    for (const browser of options.browsers) {
      await requirePackage(profile.serial, browser.packageName);
    }
  }
  for (const scenario of appScenarioPlan(options)) {
    await requirePackage(profile.serial, scenario.app.packageName);
  }
  const accessibility = await accessibilityStatus(profile.serial, options.accessibilityService);
  const permissionProof = options.permissionProof ? await capturePermissionProof(profile.serial, options.outputDir, options, accessibility) : null;
  const nativeStatusProof = options.nativeStatusProof ? await captureNativeStatusProof(profile.serial, options.outputDir, options) : null;
  const playPolicyProof = options.playPolicyProof ? capturePlayPolicyProof(options.outputDir, options) : null;
  const attempts = [];
  if (options.focusedWebViewProof) {
    attempts.push(await captureFocusedWebViewProof(profile.serial, options.outputDir, options));
  }

  for (const browser of options.browsers) {
    for (const scenario of scenarioPlan(options)) {
      const base = `${slug(browser.label)}-${slug(browser.packageName)}-${scenario.name}`;
      const runId = `${options.runId}-${base}`;
      const screenshotPath = path.join(options.outputDir, `${base}.png`);
      const logcatPath = path.join(options.outputDir, `${base}.logcat.txt`);
      const activityPath = path.join(options.outputDir, `${base}.activity.txt`);
      const scenarioWaitMs = scenario.waitMs ?? options.waitMs;

      await clearLogcat(profile.serial);
      const launch = await openUrl(profile.serial, browser.packageName, scenario.url);
      await new Promise((resolve) => setTimeout(resolve, scenarioWaitMs));
      const screenshotAnalysis = await captureScreenshot(profile.serial, screenshotPath);
      const logcat = await dumpLogcat(profile.serial, options.logcatLines, logcatPath);
      const logcatSummary = summarizeLogcat(logcat, options.appPackage);
      if (logcatSummary.crashSignalCount > 0) {
        throw new Error(`Detected FREED crash/ANR during ${browser.label} ${scenario.name} capture:\n${logcatSummary.crashSignals.join("\n---\n")}`);
      }
      const top = await topActivity(profile.serial, activityPath);
      const suggestedEvidenceField = scenario.suggestedEvidenceField || suggestedField(browser, scenario);
      const reportPath = path.join(options.outputDir, `${base}-intercept-report.json`);
      const reportArtifact = scenario.expected === "block"
        ? writeAndroidBrowserInterceptReport(reportPath, {
            browserPackage: browser.packageName,
            adultDomainFeedProof: scenario.adultDomainFeedProof,
            focusedSearchProof: scenario.focusedSearchProof,
            host: scenario.focusedSearchProof ? "" : optionHost(scenario.url),
            matchedRule: scenario.focusedSearchProof
              ? scenario.focusedSearchProof.expectedMatchedRule
              : scenario.adultDomainFeedProof
                ? "adult-domain-feed:synced-host"
                : "adult-domain:known-host",
            redactedHost: scenario.focusedSearchProof ? scenario.focusedSearchProof.expectedRedactedHost : "",
            runId,
            surface: browserInterceptSurfaceForField(suggestedEvidenceField, browser.label),
            supportingArtifacts: {
              activityArtifact: repoRelative(activityPath),
              logcatArtifact: repoRelative(logcatPath),
              screenshotArtifact: repoRelative(screenshotPath),
            },
          })
        : null;
      const backStackCheck = options.backStackCheck && scenario.expected === "block"
        ? await captureBackStackCheck(profile.serial, options.outputDir, base, options.backStackWaitMs)
        : null;
      attempts.push({
        ...(backStackCheck ? { backStackCheck } : {}),
        browser,
        adultDomainFeedProof: scenario.adultDomainFeedProof,
        expected: scenario.expected,
        focusedSearchProof: scenario.focusedSearchProof,
        launchStdout: launch.stdout.trim(),
        logcatArtifact: repoRelative(logcatPath),
        logcatSummary,
        manualPrerequisite: scenario.manualPrerequisite,
        observedTopPackage: top.packageName,
        ...(reportArtifact ? { reportArtifact } : {}),
        runId,
        scenario: scenario.name,
        screenshotAnalysis,
        screenshotArtifact: repoRelative(screenshotPath),
        suggestedEvidenceField,
        topActivityArtifact: repoRelative(activityPath),
        url: scenario.url,
        waitMs: scenarioWaitMs,
      });
    }
  }

  for (const scenario of appScenarioPlan(options)) {
    const base = `${slug(scenario.app.label)}-${slug(scenario.app.packageName)}-${scenario.name}`;
    const runId = `${options.runId}-${base}`;
    const screenshotPath = path.join(options.outputDir, `${base}.png`);
    const logcatPath = path.join(options.outputDir, `${base}.logcat.txt`);
    const activityPath = path.join(options.outputDir, `${base}.activity.txt`);
    const browserEarnedUnlockReportPath = path.join(options.outputDir, `${base}-browser-earned-unlock-report.json`);
    const scenarioWaitMs = scenario.waitMs ?? options.waitMs;

    await clearLogcat(profile.serial);
    const launch = await openApp(profile.serial, scenario.app.packageName);
    await new Promise((resolve) => setTimeout(resolve, scenarioWaitMs));
    const screenshotAnalysis = await captureScreenshot(profile.serial, screenshotPath);
    const logcat = await dumpLogcat(profile.serial, options.logcatLines, logcatPath);
    const logcatSummary = summarizeLogcat(logcat, options.appPackage);
    if (logcatSummary.crashSignalCount > 0) {
      throw new Error(`Detected FREED crash/ANR during ${scenario.app.label} ${scenario.name} capture:\n${logcatSummary.crashSignals.join("\n---\n")}`);
    }
    const top = await topActivity(profile.serial, activityPath);
    const backStackCheck = options.backStackCheck && scenario.expected === "block"
      ? await captureBackStackCheck(profile.serial, options.outputDir, base, options.backStackWaitMs)
      : null;
    const reportArtifact = scenario.browserEarnedUnlockNoAppUnlockProof
      ? writeAndroidBrowserEarnedUnlockReport(browserEarnedUnlockReportPath, {
          configuredAppPackage: scenario.browserEarnedUnlockNoAppUnlockProof.expectedConfiguredAppPackage,
          dailyLimitMinutes: options.configuredAppDailyLimitMinutes,
          durationMinutes: scenario.browserEarnedUnlockNoAppUnlockProof.durationMinutes,
          runId,
          sourceHost: scenario.browserEarnedUnlockNoAppUnlockProof.expectedSourceHost,
          supportingArtifacts: {
            activityArtifact: repoRelative(activityPath),
            logcatArtifact: repoRelative(logcatPath),
            screenshotArtifact: repoRelative(screenshotPath),
          },
        })
      : null;
    attempts.push({
      ...(backStackCheck ? { backStackCheck } : {}),
      app: scenario.app,
      browserEarnedUnlockNoAppUnlockProof: scenario.browserEarnedUnlockNoAppUnlockProof,
      configuredAppShieldProof: scenario.configuredAppShieldProof,
      earnedUnlockProof: scenario.earnedUnlockProof,
      expected: scenario.expected,
      launchStdout: launch.stdout.trim(),
      logcatArtifact: repoRelative(logcatPath),
      logcatSummary,
      manualPrerequisite: scenario.manualPrerequisite,
      observedSeconds: scenario.observedSeconds,
      observedTopPackage: top.packageName,
      ...(reportArtifact ? { reportArtifact } : {}),
      runId,
      scenario: scenario.name,
      shortFormProof: scenario.shortFormProof,
      screenshotAnalysis,
      screenshotArtifact: repoRelative(screenshotPath),
      suggestedEvidenceField: scenario.suggestedEvidenceField,
      topActivityArtifact: repoRelative(activityPath),
      waitMs: scenarioWaitMs,
    });
  }

  const dnsGuardProof = options.dnsGuardProof ? await captureDnsGuardProof(profile.serial, options.outputDir, options) : null;
  const dnsGuardRestartProof = options.dnsGuardRestartProof
    ? await captureDnsGuardRestartProof(profile.serial, options.outputDir, options)
    : null;

  const manifest = {
    accessibility,
    appPackage: options.appPackage,
    attempts,
    challengeVerificationProof: androidChallengeVerificationProof(options),
    device: profile,
    permissionWizardProof: androidPermissionWizardProof(options),
    ...(dnsGuardProof ? { dnsGuardProof } : {}),
    ...(dnsGuardRestartProof ? { dnsGuardRestartProof } : {}),
    ...(nativeStatusProof ? { nativeStatusProof } : {}),
    ...(permissionProof ? { permissionProof } : {}),
    ...(playPolicyProof ? { playPolicyProof } : {}),
    generatedAt: new Date().toISOString(),
    manualVerificationRequired: true,
    outputDir: repoRelative(options.outputDir),
    releaseGate: "android-real-browser-validation",
    result: "artifacts-captured",
    runId: options.runId,
    schema: "freed-android-real-browser-capture-v1",
    toolTimeoutMs: options.toolTimeoutMs,
  };
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  const evidenceFillTemplatePath = path.join(options.outputDir, "android-real-browser-evidence-fill-template.json");
  writeJsonArtifact(manifestPath, manifest);
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        notesArtifact: repoRelative(notesPath),
      },
      null,
      2,
    ),
  );
}

function runSelfTest() {
  assert.deepEqual(parseBrowsers("com.android.chrome=Chrome,org.mozilla.firefox"), [
    { label: "Chrome", packageName: "com.android.chrome" },
    { label: "org.mozilla.firefox", packageName: "org.mozilla.firefox" },
  ]);
  const adbSample = [
    "List of devices attached",
    "R5CT123ABCD device product:oriole model:Pixel_8 device:oriole transport_id:3",
    "emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:4",
    "ZY224 offline transport_id:5",
  ].join("\n");
  const adbDevices = parseAdbDevices(adbSample);
  assert.equal(adbDevices.length, 3);
  assert.equal(adbDevices[0].isReady, true);
  assert.equal(adbDevices[0].isLikelyEmulator, false);
  assert.equal(adbDevices[1].isLikelyEmulator, true);
  assert.equal(adbDevices[2].isReady, false);
  const listOptions = parseArgs(["--list-devices", "--tool-timeout-ms", "1500", "--run-id", "android-discovery-self-test"]);
  assert.equal(listOptions.listDevicesOnly, true);
  assert.equal(listOptions.toolTimeoutMs, 1500);
  assert.equal(listOptions.runId, "android-discovery-self-test");
  assert.throws(() => parseArgs(["--list-devices", "--tool-timeout-ms", "999"]), /from 1000 to 300000/);
  const discoveryWithDevice = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "R5CT123ABCD", outputDir: path.join("docs", "validation", "artifacts", "android-discovery-self-test") },
    { devices: adbDevices },
    path.join("docs", "validation", "artifacts", "android-discovery-self-test", "adb-devices.txt"),
  );
  assert.equal(discoveryWithDevice.schema, "freed-android-device-discovery-v1");
  assert.equal(discoveryWithDevice.sanitized, true);
  assert.equal(discoveryWithDevice.result, "requested-ready-device-found");
  assert.equal(discoveryWithDevice.requestedReadyDeviceFound, true);
  assert.equal(discoveryWithDevice.readyPhysicalCandidateCount, 1);
  assert.equal(discoveryWithDevice.evidenceSatisfied, false);
  assert.match(discoveryWithDevice.evidenceBoundary, /does not prove physical-device status/);
  assert.match(discoveryWithDevice.nextCommand, /npm run evidence:android-real-browser/);
  const discoveryWithoutDevice = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "", outputDir: path.join("docs", "validation", "artifacts", "android-discovery-empty-self-test") },
    { devices: [] },
    path.join("docs", "validation", "artifacts", "android-discovery-empty-self-test", "adb-devices.txt"),
  );
  assert.equal(discoveryWithoutDevice.result, "no-ready-android-device");
  assert.equal(discoveryWithoutDevice.readyDeviceCount, 0);
  assert.equal(
    parseArgs(["--adult-url", "https://adult-domain.realsite.com/path", "--allowed-url", "https://youtube.com/results?search_query=workout"]).adultUrl,
    "https://adult-domain.realsite.com/path",
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--app-scenario", "short-form-both", "--short-form-threshold-seconds", "90"]).shortFormPackage,
    DEFAULT_SHORT_FORM_PACKAGE,
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--app-scenario", "short-form-both", "--short-form-threshold-seconds", "90", "--back-stack-check"]).backStackCheck,
    true,
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--app-scenario", "short-form-both", "--short-form-threshold-seconds", "90", "--back-stack-wait-ms", "2500"]).backStackWaitMs,
    2500,
  );
  assert.equal(parseArgs(["--scenario", "focused-search"]).scenario, "focused-search");
  assert.equal(parseArgs(["--scenario", "focused-search", "--focused-search-wait-ms", "12000"]).focusedSearchWaitMs, 12000);
  assert.equal(
    parseArgs(["--scenario", "synced-feed", "--adult-domain-feed-host", "Adult-Domain.RealSite.com"]).adultDomainFeedHost,
    "adult-domain.realsite.com",
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--dns-guard-proof", "--adult-domain-feed-host", "Adult-Domain.RealSite.com"]).dnsGuardHost,
    "adult-domain.realsite.com",
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--dns-guard-host", "Dns-Only.RealSite.com"]).dnsGuardProof,
    true,
  );
  assert.equal(
    parseArgs(["--scenario", "none", "--dns-guard-host", "Dns-Only.RealSite.com", "--dns-guard-visible-wait-ms", "2500"]).dnsGuardVisibleWaitMs,
    2500,
  );
  assert.equal(parseArgs(["--scenario", "none", "--permission-proof"]).permissionProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--permission-proof"]).toolTimeoutMs, DEFAULT_DEVICE_TOOL_TIMEOUT_MS);
  assert.equal(parseArgs(["--scenario", "none", "--permission-proof", "--tool-timeout-ms", "1500"]).toolTimeoutMs, 1500);
  assert.equal(parseArgs(["--scenario", "none", "--native-status-proof"]).nativeStatusProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--dns-guard-restart-proof"]).dnsGuardRestartProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--dns-guard-restart-proof"]).nativeStatusProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--play-policy-proof"]).playPolicyProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--native-status-proof", "--native-status-wait-ms", "2500"]).nativeStatusWaitMs, 2500);
  assert.equal(parseArgs(["--scenario", "none", "--native-status-proof", "--earned-unlock-minutes", "20"]).earnedUnlockMinutes, 20);
  assert.equal(
    parseArgs(["--scenario", "none", "--app-scenario", "browser-earned-unlock", "--configured-app-package", INSTAGRAM_ANDROID_PACKAGE, "--adult-url", "https://adult-domain.realsite.com/path"]).adultUrl,
    "https://adult-domain.realsite.com/path",
  );
  assert.equal(parseArgs(["--scenario", "none", "--focused-webview-proof"]).focusedWebViewPackage, DEFAULT_FOCUSED_WEBVIEW_PACKAGE);
  assert.equal(parseArgs(["--scenario", "none", "--focused-webview-package", "app.freed.releasefixture"]).focusedWebViewProof, true);
  assert.equal(parseArgs(["--scenario", "none", "--focused-webview-proof", "--focused-webview-wait-ms", "12000"]).focusedWebViewWaitMs, 12000);
  assert.equal(DEFAULT_SHORT_FORM_PACKAGE, YOUTUBE_ANDROID_PACKAGE);
  assert.deepEqual(TIKTOK_ANDROID_PACKAGES, [TIKTOK_PRIMARY_ANDROID_PACKAGE, ...TIKTOK_ANDROID_PACKAGE_ALIASES]);
  assert.equal(shortFormReleaseProfile(YOUTUBE_ANDROID_PACKAGE).interventionId, YOUTUBE_SHORTS_RULE);
  assert.equal(shortFormReleaseProfile(INSTAGRAM_ANDROID_PACKAGE).interventionId, INSTAGRAM_REELS_RULE);
  for (const tiktokPackage of TIKTOK_ANDROID_PACKAGES) {
    assert.equal(shortFormReleaseProfile(tiktokPackage).interventionId, TIKTOK_FEED_RULE);
  }
  assert.throws(() => parseArgs(["--scenario", "none"]), /No capture scenarios/);
  assert.throws(() => parseArgs(["--adult-url", "http://adult-domain.realsite.com", "--allowed-url", "https://youtube.com/results?search_query=workout"]), /https/);
  assert.throws(() => parseArgs(["--adult-url", "https://example.com", "--allowed-url", "https://youtube.com/results?search_query=workout"]), /placeholder|reserved/);
  assert.throws(() => parseArgs(["--scenario", "synced-feed"]), /adult-domain-feed-host/);
  assert.throws(() => parseArgs(["--scenario", "synced-feed", "--adult-domain-feed-host", "example.com"]), /placeholder|reserved/);
  assert.throws(() => parseArgs(["--scenario", "none", "--dns-guard-proof"]), /dns-guard-proof/);
  assert.throws(() => parseArgs(["--scenario", "none", "--dns-guard-host", "example.com"]), /placeholder|reserved/);
  assert.throws(() => parseArgs(["--scenario", "none", "--dns-guard-host", "adult-domain.realsite.com", "--dns-guard-probe-timeout-seconds", "20"]), /dns-guard-probe/);
  assert.throws(() => parseArgs(["--scenario", "none", "--dns-guard-host", "adult-domain.realsite.com", "--dns-guard-visible-wait-ms", "100"]), /dns-guard-visible/);
  assert.throws(() => parseArgs(["--scenario", "none", "--focused-webview-proof", "--focused-webview-wait-ms", "2500"]), /focused-webview-wait-ms/);
  assert.throws(() => parseArgs(["--self-test", "--tool-timeout-ms", "999"]), /tool-timeout-ms/);
  assert.throws(() => parseArgs(["--self-test", "--tool-timeout-ms", "300001"]), /tool-timeout-ms/);
  assert.throws(() => parseArgs(["--scenario", "none", "--native-status-proof", "--earned-unlock-minutes", "0"]), /earned-unlock-minutes/);
  assert.throws(() => parseArgs(["--scenario", "none", "--app-scenario", "browser-earned-unlock", "--configured-app-package", INSTAGRAM_ANDROID_PACKAGE]), /adult-url/);
  assert.throws(() => parseArgs(["--scenario", "focused-search", "--focused-search-query", "weather video"]), /high-confidence/);
  assert.throws(() => parseArgs(["--scenario", "focused-search", "--focused-search-query", "porn recovery"]), /adult-consumption/);
  assert.throws(() => parseArgs(["--scenario", "focused-search", "--focused-search-query", "https://adult-domain.realsite.com/search"]), /raw search text/);
  assert.throws(() => parseArgs(["--scenario", "focused-search", "--focused-search-wait-ms", "2500"]), /focused-search-wait-ms/);
  assert.throws(() => parseArgs(["--scenario", "none", "--app-scenario", "short-form-both", "--short-form-threshold-seconds", "90", "--back-stack-wait-ms", "100"]), /back-stack-wait-ms/);
  assert.throws(
    () => parseArgs(["--scenario", "none", "--app-scenario", "short-form-both", "--short-form-threshold-seconds", "90", "--short-form-below-threshold-seconds", "90"]),
    /below-threshold/,
  );
  assert.equal(
    isLikelyEmulator({
      details: "",
      fingerprint: "google/sdk_gphone64_arm64/emulator",
      hardware: "ranchu",
      manufacturer: "Google",
      model: "sdk_gphone64_arm64",
      qemu: "1",
      serial: "emulator-5554",
    }),
    true,
  );
  assert.equal(
    isLikelyEmulator({
      details: "usb:1 product:panther model:Pixel_7",
      fingerprint: "google/panther/panther:15/AP4A",
      hardware: "gs201",
      manufacturer: "Google",
      model: "Pixel 7",
      qemu: "0",
      serial: "R58T12345",
    }),
    false,
  );
  assert.equal(
    topPackageFromActivityOutput("topResumedActivity=ActivityRecord{abc u0 app.freed.recovery/.MainActivity t1}"),
    "app.freed.recovery",
  );
  assert.equal(
    topPackageFromActivityOutput("mResumedActivity: ActivityRecord{abc u0 com.android.chrome/com.google.android.apps.chrome.Main t1}"),
    "com.android.chrome",
  );
  assert.equal(
    parseUsageStatsAuthorized([{ stdout: "GET_USAGE_STATS: allow; time=+1h", stderr: "", ok: true }]),
    true,
  );
  assert.equal(
    parseUsageStatsAuthorized([{ stdout: "android:get_usage_stats: ignore", stderr: "", ok: true }]),
    false,
  );
  assert.equal(parseUsageStatsAuthorized([{ stdout: "No operations.", stderr: "", ok: true }]), null);
  assert.equal(
    parsePostNotificationsGranted([{ stdout: "POST_NOTIFICATION: allow; time=+1h", stderr: "", ok: true }]),
    true,
  );
  assert.equal(
    parsePostNotificationsGranted([{ stdout: "android:post_notification: ignore", stderr: "", ok: true }]),
    false,
  );
  assert.equal(parsePostNotificationsGranted([{ stdout: "No operations.", stderr: "", ok: true }]), null);
  assert.match(run.toString(), /timed out after \$\{options\.timeoutMs\}ms/);
  assert.match(runAdb.toString(), /activeDeviceToolTimeoutMs/);
  assert.match(captureScreenshot.toString(), /timed out after \$\{activeDeviceToolTimeoutMs\}ms/);
  assert.equal(parseNotificationListenerEnabled("app.freed.recovery/app.freed.Notifications:other/.Listener", "app.freed.recovery"), true);
  assert.deepEqual(
    extractUiText('<node text="Native Protection"/><node text="Usage Access sees 2 selected app packages today (24 min total)."/><node content-desc="Adult-domain feed freed-feed-2026-05-12 (fnv1a32:1a2b3c4d)"/>'),
    [
      "Native Protection",
      "Usage Access sees 2 selected app packages today (24 min total).",
      "Adult-domain feed freed-feed-2026-05-12 (fnv1a32:1a2b3c4d)",
    ],
  );
  assert.deepEqual(
    nativeStatusSignals([
      "Native Protection",
      "Usage Access sees 2 selected app packages today (24 min total).",
      "Adult-domain feed freed-feed-2026-05-12 (fnv1a32:1a2b3c4d)",
      "DNS Guard last forwarded through resolver 1.1.1.1",
      "DNS Guard session: 18 queries, 3 blocked, 15 allowed, 0 SERVFAIL, 0 malformed. Uptime 2m.",
      "DNS Guard restart: eligible after reboot or app update. Last check started from BOOT_COMPLETED.",
    ]),
    {
      adultDomainFeedStatusSeen: true,
      dnsGuardLifecycleSeen: true,
      dnsGuardRestartSeen: true,
      dnsGuardResolverSeen: true,
      nativeProtectionPanelSeen: true,
      usageStatsMetricsSeen: true,
    },
  );
  assert.deepEqual(
    parseDnsGuardLifecycleCounters([
      "DNS Guard session: 18 queries, 3 blocked, 15 allowed, 0 SERVFAIL, 0 malformed. Uptime 2m.",
    ]),
    {
      dnsGuardSessionQueries: 18,
      dnsGuardBlockedQueries: 3,
      dnsGuardAllowedQueries: 15,
      dnsGuardServfailResponses: 0,
      dnsGuardMalformedPackets: 0,
    },
  );
  assert.deepEqual(
    androidChallengeVerificationProof({ runId: "android-real-browser-self-test" }).proofs.map((proof) => [
      proof.check,
      proof.runIdField,
      proof.artifactField,
      proof.releaseFields[0],
    ]),
    [
      [
        "challengePhotoVerifiedOnDevice",
        "android.challengePhotoRunId",
        "android.challengePhotoArtifact",
        "android.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true",
      ],
      [
        "challengeMotionVerified",
        "android.challengeMotionRunId",
        "android.challengeMotionArtifact",
        "android.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true",
      ],
      [
        "challengeStepsVerified",
        "android.challengeStepsRunId",
        "android.challengeStepsArtifact",
        "android.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true",
      ],
      [
        "challengeLocationVerified",
        "android.challengeLocationRunId",
        "android.challengeLocationArtifact",
        "android.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true",
      ],
    ],
  );
  assert.deepEqual(
    playPolicySignals({
      accessibilityConfig: readRequiredText(ANDROID_ACCESSIBILITY_CONFIG_PATH),
      moduleManifest: readRequiredText(ANDROID_PROTECTION_MANIFEST_PATH),
      policyPack: readRequiredText(ANDROID_POLICY_PACK_PATH),
    }),
    {
      accessibilityDisclosureMatchesPolicyPack: true,
      accessibilityServiceConfigIsNotAccessibilityTool: true,
      accessibilityServiceConfigReadsBoundedEvents: true,
      accessibilityServiceDeclared: true,
      dnsGuardDisclosureMatchesPolicyPack: true,
      specialUseForegroundServiceDeclared: true,
    },
  );
  assert.equal(suggestedField({ label: "Firefox", packageName: "org.mozilla.firefox" }, { name: "adult" }), "android.firefoxInterceptArtifact");
  assert.equal(suggestedField({ label: "Samsung Internet", packageName: "com.sec.android.app.sbrowser" }, { name: "adult" }), "android.samsungInternetInterceptArtifact");
  assert.deepEqual(appScenarioPlan({ appScenario: "both", configuredAppLabel: "Instagram", configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE }).map((entry) => entry.name), [
    "configured-app-shield",
    "earned-unlock-app-allow",
    "earned-unlock-relock",
  ]);
  assert.deepEqual(
    appScenarioPlan({ appScenario: "shield", configuredAppLabel: "Instagram", configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE }).map((entry) => [
      entry.name,
      entry.configuredAppShieldProof.runIdField,
      entry.configuredAppShieldProof.interventionIdField,
      entry.configuredAppShieldProof.expectedInterventionId,
    ]),
    [["configured-app-shield", "android.configuredAppShieldRunId", "android.configuredAppShieldInterventionId", configuredAppInterventionId(INSTAGRAM_ANDROID_PACKAGE)]],
  );
  assert.deepEqual(
    appScenarioPlan({ appScenario: "earned-unlock", configuredAppLabel: "Instagram", configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE, earnedUnlockMinutes: 20 }).map((entry) => [
      entry.name,
      entry.earnedUnlockProof.runIdField,
      entry.earnedUnlockProof.packageField,
      entry.earnedUnlockProof.expectedPackage,
      entry.earnedUnlockProof.durationMinutes,
      entry.earnedUnlockProof.relockUsageMinutesField || "",
    ]),
    [
      ["earned-unlock-app-allow", "android.earnedUnlockAppAllowRunId", "android.earnedUnlockSourcePackage", INSTAGRAM_ANDROID_PACKAGE, 20, ""],
      ["earned-unlock-relock", "android.earnedUnlockRelockRunId", "android.earnedUnlockSourcePackage", INSTAGRAM_ANDROID_PACKAGE, 20, "android.earnedUnlockRelockUsageMinutes"],
    ],
  );
  assert.deepEqual(
    appScenarioPlan({ appScenario: "browser-earned-unlock", adultUrl: "https://adult-domain.realsite.com/path", configuredAppLabel: "Instagram", configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE }).map((entry) => [
      entry.name,
      entry.browserEarnedUnlockNoAppUnlockProof.runIdField,
      entry.browserEarnedUnlockNoAppUnlockProof.sourceHostField,
      entry.browserEarnedUnlockNoAppUnlockProof.expectedSourceHost,
      entry.browserEarnedUnlockNoAppUnlockProof.nativeAppUnlockActiveField,
    ]),
    [["browser-earned-unlock-no-app-unlock", "android.browserEarnedUnlockNoAppUnlockRunId", "android.browserEarnedUnlockSourceHost", "adult-domain.realsite.com", "android.browserEarnedUnlockNativeAppUnlockActive"]],
  );
  assert.match(
    buildNotes({
      attempts: [
        {
          app: { label: "Instagram", packageName: INSTAGRAM_ANDROID_PACKAGE },
          browserEarnedUnlockNoAppUnlockProof: appScenarioPlan({
            appScenario: "browser-earned-unlock",
            adultUrl: "https://adult-domain.realsite.com/path",
            configuredAppLabel: "Instagram",
            configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE,
          })[0].browserEarnedUnlockNoAppUnlockProof,
          expected: "block",
          logcatArtifact: "docs/validation/artifacts/browser-earned-unlock.logcat.txt",
          observedTopPackage: "app.freed.recovery",
          runId: "browser-earned-unlock-run",
          scenario: "browser-earned-unlock-no-app-unlock",
          screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
          screenshotArtifact: "docs/validation/artifacts/browser-earned-unlock.png",
          suggestedEvidenceField: "android.browserEarnedUnlockNoAppUnlockArtifact",
        },
      ],
      runId: "self-test",
    }),
    /Browser-earned-unlock no-app-unlock proof[\s\S]*android\.browserEarnedUnlockNativeAppUnlockActive=false[\s\S]*android\.browserEarnedUnlockConfiguredAppStillShielded=true[\s\S]*android\.browserEarnedUnlockAdultFilterStillActive=true/,
  );
  assert.deepEqual(
    appScenarioPlan({
      appScenario: "all",
      adultUrl: "https://adult-domain.realsite.com/path",
      configuredAppLabel: "Instagram",
      configuredAppPackage: INSTAGRAM_ANDROID_PACKAGE,
      shortFormAtInterventionSeconds: 95,
      shortFormBelowThresholdSeconds: 60,
      shortFormLabel: "YouTube Shorts",
      shortFormPackage: YOUTUBE_ANDROID_PACKAGE,
      shortFormThresholdSeconds: 90,
    }).map((entry) => entry.name),
    [
      "configured-app-before-limit-allow",
      "configured-app-shield",
      "earned-unlock-app-allow",
      "earned-unlock-relock",
      "browser-earned-unlock-no-app-unlock",
      "short-form-below-threshold-allow",
      "short-form-sustained-intervention",
    ],
  );
  assert.deepEqual(
    appScenarioPlan({
      appScenario: "short-form-both",
      shortFormAtInterventionSeconds: 95,
      shortFormBelowThresholdSeconds: 60,
      shortFormLabel: "YouTube Shorts",
      shortFormPackage: YOUTUBE_ANDROID_PACKAGE,
      shortFormThresholdSeconds: 90,
    }).map((entry) => [
      entry.name,
      entry.suggestedEvidenceField,
      entry.waitMs,
      entry.shortFormProof.usageBeforeLimitField,
      entry.shortFormProof.selectedSurfaceArtifactField || "",
      entry.shortFormProof.selectedSurfaceVerifiedField || "",
    ]),
    [
      ["short-form-below-threshold-allow", "android.shortFormBelowThresholdAllowArtifact", 60_000, "android.shortFormUsageBeforeLimitMinutes", "", ""],
      ["short-form-sustained-intervention", "android.shortFormArtifact", 95_000, "android.shortFormUsageBeforeLimitMinutes", "android.shortFormSelectedSurfaceArtifact", "android.shortFormSelectedSurfaceVerified"],
    ],
  );
  assert.deepEqual(
    appScenarioPlan({
      appScenario: "short-form",
      shortFormAtInterventionSeconds: 95,
      shortFormBelowThresholdSeconds: 60,
      shortFormLabel: "Instagram Reels",
      shortFormPackage: INSTAGRAM_ANDROID_PACKAGE,
      shortFormThresholdSeconds: 90,
    }).map((entry) => [
      entry.name,
      entry.suggestedEvidenceField,
      entry.shortFormProof.runIdField,
      entry.shortFormProof.observedSecondsField,
      entry.shortFormProof.interventionIdField,
      entry.shortFormProof.expectedInterventionId,
      entry.shortFormProof.usageBeforeLimitField,
      entry.shortFormProof.selectedSurfaceArtifactField || "",
      entry.shortFormProof.selectedSurfaceVerifiedField || "",
    ]),
    [["short-form-sustained-intervention", "android.instagramReelsArtifact", "android.instagramReelsRunId", "android.instagramReelsAtInterventionSeconds", "android.instagramReelsInterventionId", INSTAGRAM_REELS_RULE, "android.instagramReelsUsageBeforeLimitMinutes", "android.instagramReelsSelectedSurfaceArtifact", "android.instagramReelsSelectedSurfaceVerified"]],
  );
  assert.deepEqual(
    appScenarioPlan({
      appScenario: "short-form",
      shortFormAtInterventionSeconds: 95,
      shortFormBelowThresholdSeconds: 60,
      shortFormLabel: "TikTok For You",
      shortFormPackage: TIKTOK_PRIMARY_ANDROID_PACKAGE,
      shortFormThresholdSeconds: 90,
    }).map((entry) => [
      entry.name,
      entry.suggestedEvidenceField,
      entry.shortFormProof.runIdField,
      entry.shortFormProof.observedSecondsField,
      entry.shortFormProof.interventionIdField,
      entry.shortFormProof.expectedInterventionId,
      entry.shortFormProof.usageBeforeLimitField,
      entry.shortFormProof.selectedSurfaceArtifactField || "",
      entry.shortFormProof.selectedSurfaceVerifiedField || "",
    ]),
    [["short-form-sustained-intervention", "android.tiktokFeedArtifact", "android.tiktokFeedRunId", "android.tiktokFeedAtInterventionSeconds", "android.tiktokFeedInterventionId", TIKTOK_FEED_RULE, "android.tiktokFeedUsageBeforeLimitMinutes", "android.tiktokFeedSelectedSurfaceArtifact", "android.tiktokFeedSelectedSurfaceVerified"]],
  );
  const tiktokShortFormScenario = appScenarioPlan({
    appScenario: "short-form",
    shortFormAtInterventionSeconds: 95,
    shortFormBelowThresholdSeconds: 60,
    shortFormLabel: "TikTok For You",
    shortFormPackage: TIKTOK_PRIMARY_ANDROID_PACKAGE,
    shortFormThresholdSeconds: 90,
  })[0];
  assert.match(
    tiktokShortFormScenario.manualPrerequisite,
    /android\.tiktokFeedSelectedSurfaceArtifact[\s\S]*android\.tiktokFeedSelectedSurfaceVerified=true/,
  );
  assert.match(
    buildNotes({
      attempts: [
        {
          app: { label: "TikTok For You", packageName: TIKTOK_PRIMARY_ANDROID_PACKAGE },
          expected: "block",
          logcatArtifact: "docs/validation/artifacts/tiktok-short-form.logcat.txt",
          observedSeconds: 95,
          observedTopPackage: "app.freed.recovery",
          runId: "tiktok-short-form-run",
          scenario: tiktokShortFormScenario.name,
          screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
          screenshotArtifact: "docs/validation/artifacts/tiktok-short-form.png",
          shortFormProof: tiktokShortFormScenario.shortFormProof,
          suggestedEvidenceField: tiktokShortFormScenario.suggestedEvidenceField,
        },
      ],
      runId: "self-test",
    }),
    /Short-form proof \(TikTok For You\)[\s\S]*android\.tiktokFeedSelectedSurfaceArtifact[\s\S]*android\.tiktokFeedSelectedSurfaceVerified=true/,
  );
  assert.deepEqual(
    appScenarioPlan({
      appScenario: "short-form",
      shortFormAtInterventionSeconds: 95,
      shortFormBelowThresholdSeconds: 60,
      shortFormLabel: "TikTok For You",
      shortFormPackage: TIKTOK_ANDROID_PACKAGE_ALIASES[0],
      shortFormThresholdSeconds: 90,
    }).map((entry) => [
      entry.shortFormProof.expectedPackage,
      entry.shortFormProof.packageField,
      entry.shortFormProof.expectedInterventionId,
      entry.shortFormProof.usageBeforeLimitField,
    ]),
    [[TIKTOK_ANDROID_PACKAGE_ALIASES[0], "android.tiktokFeedPackage", TIKTOK_FEED_RULE, "android.tiktokFeedUsageBeforeLimitMinutes"]],
  );
  assert.deepEqual(
    focusedWebViewPlan(parseArgs(["--scenario", "none", "--focused-webview-proof", "--focused-webview-wait-ms", "12000"])).map((entry) => [
      entry.name,
      entry.app.packageName,
      entry.suggestedEvidenceField,
      entry.waitMs,
      entry.focusedWebViewProof.expectedSurface,
    ]),
    [["focused-webview", DEFAULT_FOCUSED_WEBVIEW_PACKAGE, "android.focusedWebViewArtifact", 12_000, "focused-webview-url-field"]],
  );
  assert.deepEqual(
    scenarioPlan(parseArgs(["--scenario", "focused-search", "--focused-search-query", "pornography video"])).map((entry) => [
      entry.name,
      entry.suggestedEvidenceField,
      entry.waitMs,
      entry.focusedSearchProof.expectedMatchedRule,
      entry.focusedSearchProof.expectedRedactedHost,
      entry.focusedSearchProof.rawQueryStored,
    ]),
    [["focused-browser-search", "android.focusedBrowserSearchArtifact", DEFAULT_FOCUSED_SEARCH_WAIT_MS, "focused-search:pornography", "focused-search.app.freed.local", false]],
  );
  assert.deepEqual(
    scenarioPlan(
      parseArgs([
        "--scenario",
        "all",
        "--adult-url",
        "https://adult-domain.realsite.com/path",
        "--allowed-url",
        "https://youtube.com/results?search_query=workout",
      ]),
    ).map((entry) => entry.name),
    ["allowed", "adult", "focused-browser-search"],
  );
  assert.deepEqual(
    scenarioPlan(parseArgs(["--scenario", "synced-feed", "--adult-domain-feed-host", "adult-domain.realsite.com"])).map((entry) => [
      entry.name,
      entry.suggestedEvidenceField,
      entry.adultDomainFeedProof.expectedClassifiedHost,
      entry.adultDomainFeedProof.expectedSource,
      entry.adultDomainFeedProof.pairedDnsGuardEvidenceField,
      entry.url,
    ]),
    [
      [
        "synced-adult-domain-feed",
        "android.adultDomainFeedAccessibilityArtifact",
        "adult-domain.realsite.com",
        "synced-adult-domain-feed",
        "android.adultDomainFeedDnsGuardArtifact",
        "https://adult-domain.realsite.com/",
      ],
    ],
  );
  assert.deepEqual(
    scenarioPlan(
      parseArgs([
        "--scenario",
        "all",
        "--adult-url",
        "https://adult-domain.realsite.com/path",
        "--adult-domain-feed-host",
        "feed-only-adult.realsite.com",
        "--allowed-url",
        "https://youtube.com/results?search_query=workout",
      ]),
    ).map((entry) => entry.name),
    ["allowed", "adult", "focused-browser-search", "synced-adult-domain-feed"],
  );
  assert.equal(suggestedField({ label: "Chrome", packageName: "com.android.chrome" }, { name: "focused-browser-search" }), "android.chromeInterceptArtifact");
  assert.match(
    buildNotes({
      attempts: [
        {
          adultDomainFeedProof: {
            expectedClassifiedHost: "feed-only-adult.realsite.com",
            pairedDnsGuardEvidenceField: "android.adultDomainFeedDnsGuardArtifact",
          },
          backStackCheck: {
            observedTopPackage: "app.freed.recovery",
            screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
            screenshotArtifact: "docs/validation/artifacts/back.png",
            suggestedEvidenceField: "android.backStackCleanupArtifact",
          },
          expected: "block",
          logcatArtifact: "docs/validation/artifacts/logcat.txt",
          observedTopPackage: "app.freed.recovery",
          runId: "back-stack-test",
          scenario: "adult",
          screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
          screenshotArtifact: "docs/validation/artifacts/front.png",
          suggestedEvidenceField: "android.chromeInterceptArtifact",
        },
      ],
      runId: "self-test",
    }),
    /android\.backStackCleanupArtifact/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      challengeVerificationProof: androidChallengeVerificationProof({ runId: "self-test" }),
      runId: "self-test",
    }),
    /android\.challengePhotoClassifier=ML Kit[\s\S]*android\.challengeLocationBestAccuracyMeters<=80/,
  );
  const permissionWizardProof = androidPermissionWizardProof({ runId: "self-test" });
  assert.equal(permissionWizardProof.artifactField, "android.permissionWizardArtifact");
  assert.ok(permissionWizardProof.releaseFields.includes(`android.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}`));
  assert.ok(permissionWizardProof.releaseFields.includes("android.permissionExplanationShown=true"));
  assert.ok(
    permissionWizardProof.releaseFields.includes(
      "android.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"
    )
  );
  assert.ok(permissionWizardProof.releaseFields.includes("android.permissionWizardTestProtectionPassed=true"));
  assert.ok(permissionWizardProof.releaseFields.includes("android.appSelectionZeroAppContinueDisabled=true"));
  assert.ok(permissionWizardProof.releaseFields.includes("android.appSelectionReturnFromSetup=true"));
  assert.ok(permissionWizardProof.releaseFields.includes("android.appSelectionReturnAutoSync=true"));
  assert.ok(permissionWizardProof.releaseFields.includes("android.appSelectionReturnNativePackageSyncConfirmed=true"));
  assert.ok(permissionWizardProof.releaseFields.includes("android.appSelectionReturnSelectedAppCount>0"));
  assert.match(
    buildNotes({
      attempts: [],
      permissionWizardProof,
      runId: "self-test",
    }),
    /Permission wizard proof[\s\S]*android\.permissionWizardArtifact/,
  );
  assert.match(
    buildNotes({
      attempts: [
        {
          app: { label: "FREED WebView Fixture", packageName: "app.freed.qawebview" },
          expected: "block",
          focusedWebViewProof: {
            expectedFixturePackage: "app.freed.qawebview",
          },
          logcatArtifact: "docs/validation/artifacts/webview.logcat.txt",
          observedTopPackage: "app.freed.recovery",
          runId: "focused-webview-run",
          scenario: "focused-webview",
          screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
          screenshotArtifact: "docs/validation/artifacts/webview.png",
          suggestedEvidenceField: "android.focusedWebViewArtifact",
        },
      ],
      runId: "self-test",
    }),
    /Focused-WebView proof/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      dnsGuardProof: {
        artifact: "docs/validation/artifacts/dns-guard-proof.json",
        host: "feed-only-adult.realsite.com",
        suggestedEvidenceFields: [
          "android.dnsGuardBlockArtifact",
          "android.dnsGuardInterventionVisible=true",
          "android.adultDomainFeedDnsGuardArtifact",
        ],
        visibleInterventionProof: {
          activityScreenshotArtifact: "docs/validation/artifacts/dns-guard-visible.png",
          notificationDumpArtifact: "docs/validation/artifacts/dns-guard-notifications.txt",
          notificationShadeScreenshotArtifact: "docs/validation/artifacts/dns-guard-notification-shade.png",
          notificationUiAutomatorArtifact: "docs/validation/artifacts/dns-guard-notification-ui.xml",
          uiTextSignals: {
            interventionActivitySeen: false,
            notificationTitleSeen: true,
            recoveryCopySeen: true,
          },
        },
      },
      runId: "self-test",
    }),
    /DNS Guard proof[\s\S]*android\.dnsGuardInterventionVisible=true[\s\S]*notification title `true`/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      dnsGuardProof: {
        artifact: undefined,
        host: "adult-domain.realsite.com",
        suggestedEvidenceFields: [
          "android.dnsGuardBlockArtifact",
          "android.dnsGuardInterventionVisible=true",
          "android.adultDomainFeedDnsGuardArtifact",
        ],
        visibleInterventionProof:
          "After DNS probes, the helper captures an activity screenshot, notification shade screenshot, notification dump, and UI dump for manual `android.dnsGuardInterventionVisible=true` review.",
      },
      runId: "self-test",
    }),
    /Visible proof plan:[\s\S]*android\.dnsGuardInterventionVisible=true/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      dnsGuardRestartProof: {
        artifact: "docs/validation/artifacts/dns-guard-restart-proof.txt",
        jsonArtifact: "docs/validation/artifacts/dns-guard-restart-diagnostics.json",
        skippedReportArtifact: "docs/validation/artifacts/dns-guard-restart-skipped-report.json",
        startedReportArtifact: "docs/validation/artifacts/dns-guard-restart-started-report.json",
        suggestedEvidenceFields: ["android.dnsGuardRestartRunId", "android.dnsGuardRestartArtifact"],
      },
      runId: "self-test",
    }),
    /DNS Guard restart proof/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      permissionProof: {
        accessibility: { serviceEnabled: true },
        accessibilityReportArtifact: "docs/validation/artifacts/android-accessibility-permission-report.json",
        artifact: "docs/validation/artifacts/android-permission-proof.txt",
        jsonArtifact: "docs/validation/artifacts/android-permission-proof.json",
        notificationPermissionReportArtifact: "docs/validation/artifacts/android-notification-permission-report.json",
        suggestedEvidenceFields: [
          "android.accessibilityPermissionArtifact",
          "android.usageAccessPermissionArtifact",
          "android.notificationPermissionArtifact",
        ],
        usageAccessReportArtifact: "docs/validation/artifacts/android-usage-access-permission-report.json",
        usageStatsAuthorized: true,
      },
      runId: "self-test",
    }),
    /Permission proof/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      permissionProof: {
        suggestedEvidenceFields: [
          "android.accessibilityPermissionArtifact",
          "android.usageAccessPermissionArtifact",
        ],
      },
      runId: "self-test",
    }),
    /Permission proof[\s\S]*pending-capture/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      nativeStatusProof: {
        screenshotArtifact: "docs/validation/artifacts/android-native-status.png",
        suggestedEvidenceFields: [
          "android.adultDomainFeedStatusArtifact",
          "android.usageAccessPermissionArtifact",
          "android.dnsGuardLifecycleArtifact",
          "android.dnsGuardSessionQueries",
          "android.dnsGuardBlockedQueries",
          "android.dnsGuardAllowedQueries",
          "android.dnsGuardServfailResponses",
          "android.dnsGuardMalformedPackets",
        ],
        textArtifact: "docs/validation/artifacts/android-native-status-text.txt",
        uiAutomatorArtifact: "docs/validation/artifacts/android-native-status-ui.xml",
        uiTextSignals: {
          adultDomainFeedStatusSeen: true,
          dnsGuardLifecycleSeen: true,
          dnsGuardResolverSeen: true,
          nativeProtectionPanelSeen: true,
          usageStatsMetricsSeen: true,
        },
      },
      runId: "self-test",
    }),
    /Native status proof/,
  );
  assert.match(
    buildNotes({
      attempts: [],
      nativeStatusProof: {
        suggestedEvidenceFields: [
          "android.adultDomainFeedStatusArtifact",
          "android.dnsGuardLifecycleArtifact",
        ],
      },
      runId: "self-test",
    }),
    /Native status proof[\s\S]*native panel `pending-capture`/,
  );
  assert.match(
    buildNotes({
      attempts: [
        {
          adultDomainFeedProof: {
            expectedClassifiedHost: "feed-only-adult.realsite.com",
            pairedDnsGuardEvidenceField: "android.adultDomainFeedDnsGuardArtifact",
          },
          expected: "block",
          logcatArtifact: "docs/validation/artifacts/logcat.txt",
          observedTopPackage: "app.freed.recovery",
          runId: "feed-test",
          scenario: "synced-adult-domain-feed",
          screenshotAnalysis: { height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 },
          screenshotArtifact: "docs/validation/artifacts/feed.png",
          suggestedEvidenceField: "android.adultDomainFeedAccessibilityArtifact",
        },
      ],
      runId: "self-test",
    }),
    /Synced-feed proof/,
  );
  const fillOptions = parseArgs([
    "--scenario",
    "adult",
    "--adult-url",
    "https://adult-domain.realsite.com/path",
    "--app-scenario",
    "short-form",
    "--short-form-package",
    INSTAGRAM_ANDROID_PACKAGE,
    "--run-id",
    "self-test",
  ]);
  const fillTemplate = buildEvidenceFillTemplate(fillOptions, {
    accessibility: { serviceEnabled: true },
    attempts: [
      {
        browser: { label: "Chrome", packageName: "com.android.chrome" },
        expected: "block",
        logcatArtifact: "docs/validation/artifacts/logcat.txt",
        observedTopPackage: "app.freed.recovery",
        reportArtifact: "docs/validation/artifacts/chrome-adult-intercept-report.json",
        runId: "self-test-chrome-adult",
        scenario: "adult",
        screenshotArtifact: "docs/validation/artifacts/chrome-adult.png",
        suggestedEvidenceField: "android.chromeInterceptArtifact",
      },
      {
        app: { label: "Instagram Reels", packageName: INSTAGRAM_ANDROID_PACKAGE },
        expected: "block",
        observedSeconds: 95,
        runId: "self-test-instagram-reels",
        scenario: "short-form-sustained-intervention",
        screenshotArtifact: "docs/validation/artifacts/instagram-reels.png",
        shortFormProof: shortFormSustainedProof({ label: "Instagram Reels", packageName: INSTAGRAM_ANDROID_PACKAGE }, fillOptions),
        suggestedEvidenceField: "android.instagramReelsArtifact",
      },
    ],
    challengeVerificationProof: androidChallengeVerificationProof(fillOptions),
    device: {
      isPhysicalDevice: true,
      manufacturer: "Google",
      model: "Pixel 8",
      osVersion: "15",
    },
    dnsGuardProof: {
      artifact: "docs/validation/artifacts/dns-guard-proof.json",
      host: "adult-domain.realsite.com",
      runId: "self-test-dns-guard-adult-domain",
    },
    manualVerificationRequired: true,
    permissionWizardProof: androidPermissionWizardProof(fillOptions),
    runId: "self-test",
  });
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.android.isPhysicalDevice, true);
  assert.equal(fillTemplate.android.deviceModel, "Google Pixel 8");
  assert.equal(fillTemplate.android.installQaRunId, "self-test-android-install-qa");
  assert.match(fillTemplate.android.installQaArtifact, /freed-android-install-qa-report-v1/);
  assert.equal(fillTemplate.android.chromeInterceptRunId, "self-test-chrome-adult");
  assert.equal(fillTemplate.android.chromeInterceptArtifact, "docs/validation/artifacts/chrome-adult-intercept-report.json");
  assert.equal(fillTemplate.android.instagramReelsRunId, "self-test-instagram-reels");
  assert.equal(fillTemplate.android.instagramReelsArtifact, "docs/validation/artifacts/instagram-reels.png");
  assert.equal(fillTemplate.android.instagramReelsInterventionId, INSTAGRAM_REELS_RULE);
  assert.equal(fillTemplate.android.dnsGuardBlockRunId, "self-test-dns-guard-adult-domain");
  assert.equal(fillTemplate.android.dnsGuardInterventionVisible, false);
  assert.equal(fillTemplate.checks.chromeAdultIntentIntercept, false);
  assert.equal(safeAndroidPackage(INSTAGRAM_ANDROID_PACKAGE, "--configured-app-package"), INSTAGRAM_ANDROID_PACKAGE);
  assert.throws(() => safeAndroidPackage("../bad", "--configured-app-package"));
  assert.equal(safeRunId("android-real-browser-2026-05-15"), "android-real-browser-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  assert.match(formatPngRenderAuditSummary({ height: 2400, luminanceStdDev: 44.5, uniqueSampledColors: 1200, width: 1080 }), /1080x2400/);
  console.log("android-real-browser-evidence self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  await capture(options);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
