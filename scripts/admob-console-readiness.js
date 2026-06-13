#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "freed-admob-console-readiness-v1";
const DEFAULT_RUN_ID = "admob-console-current";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/admob-console-current";
const REPORT_FILE_NAME = "admob-console-readiness.json";
const DEFAULT_REPORT = `${DEFAULT_OUTPUT_DIR}/${REPORT_FILE_NAME}`;
const APP_NAME = "FREED";
const BUNDLE_ID = "app.freed.recovery";
const PACKAGE_NAME = "app.freed.recovery";
const IOS_APP_ID_KEY = "EXPO_PUBLIC_ADMOB_APP_ID_IOS";
const ANDROID_APP_ID_KEY = "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID";
const IOS_REWARDED_UNIT_KEY = "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS";
const ANDROID_REWARDED_UNIT_KEY =
  "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID";

function printHelp() {
  console.log(`Usage: npm run evidence:admob-console-browser -- [options]

Writes a sanitized read-only AdMob console readiness report for FREED's
production ad setup. This does not create AdMob apps, ad units, payments, or
external side effects.

Options:
  --report <path>                      JSON report under docs/validation/artifacts.
                                       Default: ${DEFAULT_REPORT}
  --output-dir <path>                  Artifact output folder. When --report is
                                       omitted, writes ${REPORT_FILE_NAME} here.
                                       Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>                        Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --observed-at <iso-date>             Browser observation timestamp.
  --admob-console-observed             AdMob console was reachable.
  --admob-ios-app-present              FREED iOS AdMob app was visible.
  --admob-ios-app-missing              FREED iOS AdMob app was not visible.
  --admob-android-app-present          FREED Android AdMob app was visible.
  --admob-android-app-missing          FREED Android AdMob app was not visible.
  --ios-rewarded-unit-present          iOS rewarded reset ad unit was visible.
  --ios-rewarded-unit-missing          iOS rewarded reset ad unit was not visible.
  --android-rewarded-unit-present      Android rewarded reset ad unit was visible.
  --android-rewarded-unit-missing      Android rewarded reset ad unit was not visible.
  --no-forbidden-formats-observed      No banner/interstitial/app-open/native units were observed for v1.
  --forbidden-formats-observed         A forbidden ad format was observed.
  --browser-connector-unavailable      Chrome connector could not communicate with the browser.
  --browser-native-module-load-failed  Browser/Chrome plugin native module failed before tab discovery.
  --selected-chrome-profile-extension-missing
                                       Selected Chrome profile is missing/disabled for Codex Chrome Extension.
  --codex-extension-present-in-other-chrome-profile
                                       Codex Chrome Extension was found in another Chrome profile.
  --chrome-native-host-ok              Native messaging host manifest check passed.
  --chrome-native-host-not-ok          Native messaging host manifest check failed.
  --store-mutation-performed           Mark the run unsafe if an AdMob mutation happened.
  --self-test                          Run offline parser/report tests.
  --help, -h                           Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    admobAndroidAppPresent: null,
    admobConsoleObserved: false,
    admobIosAppPresent: null,
    androidRewardedUnitPresent: null,
    browserConnectorUnavailable: false,
    browserNativeModuleLoadFailed: false,
    chromeNativeHostOk: null,
    codexExtensionPresentInOtherChromeProfile: false,
    forbiddenFormatsObserved: null,
    iosRewardedUnitPresent: null,
    observedAt: "",
    outputDir: DEFAULT_OUTPUT_DIR,
    reportPath: DEFAULT_REPORT,
    runId: DEFAULT_RUN_ID,
    selectedChromeProfileExtensionMissing: false,
    selfTest: false,
    storeMutationPerformed: false,
  };
  let reportExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--report") {
      options.reportPath = next();
      reportExplicit = true;
    } else if (arg === "--output-dir") options.outputDir = next();
    else if (arg === "--run-id") options.runId = safeRunId(next());
    else if (arg === "--observed-at") options.observedAt = next();
    else if (arg === "--admob-console-observed")
      options.admobConsoleObserved = true;
    else if (arg === "--admob-ios-app-present")
      options.admobIosAppPresent = true;
    else if (arg === "--admob-ios-app-missing")
      options.admobIosAppPresent = false;
    else if (arg === "--admob-android-app-present")
      options.admobAndroidAppPresent = true;
    else if (arg === "--admob-android-app-missing")
      options.admobAndroidAppPresent = false;
    else if (arg === "--ios-rewarded-unit-present")
      options.iosRewardedUnitPresent = true;
    else if (arg === "--ios-rewarded-unit-missing")
      options.iosRewardedUnitPresent = false;
    else if (arg === "--android-rewarded-unit-present")
      options.androidRewardedUnitPresent = true;
    else if (arg === "--android-rewarded-unit-missing")
      options.androidRewardedUnitPresent = false;
    else if (arg === "--no-forbidden-formats-observed")
      options.forbiddenFormatsObserved = false;
    else if (arg === "--forbidden-formats-observed")
      options.forbiddenFormatsObserved = true;
    else if (arg === "--browser-connector-unavailable")
      options.browserConnectorUnavailable = true;
    else if (arg === "--browser-native-module-load-failed")
      options.browserNativeModuleLoadFailed = true;
    else if (arg === "--selected-chrome-profile-extension-missing")
      options.selectedChromeProfileExtensionMissing = true;
    else if (arg === "--codex-extension-present-in-other-chrome-profile")
      options.codexExtensionPresentInOtherChromeProfile = true;
    else if (arg === "--chrome-native-host-ok")
      options.chromeNativeHostOk = true;
    else if (arg === "--chrome-native-host-not-ok")
      options.chromeNativeHostOk = false;
    else if (arg === "--store-mutation-performed")
      options.storeMutationPerformed = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(
    options.outputDir,
    "--output-dir",
  );
  if (!reportExplicit) {
    options.reportPath = path.posix.join(options.outputDir, REPORT_FILE_NAME);
  }
  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  if (options.observedAt)
    assertValidIsoDate(options.observedAt, "--observed-at");
  return options;
}

function safeRunId(value) {
  const normalized = String(value || "").trim();
  if (
    !/^[A-Za-z0-9._:-]+$/.test(normalized) ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw new Error(
      "Run id may only contain letters, numbers, dots, dashes, underscores, and colons.",
    );
  }
  return normalized;
}

function assertValidIsoDate(value, label) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed))
    throw new Error(`${label} must be an ISO date string.`);
}

function repoRelative(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/");
}

function observedStatus(value) {
  if (value === true) return "present";
  if (value === false) return "missing";
  return "unconfirmed";
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function browserConnectorStatus(options) {
  if (options.selectedChromeProfileExtensionMissing) {
    return "selected-profile-extension-missing";
  }
  if (options.browserNativeModuleLoadFailed) {
    return "native-module-load-failed";
  }
  if (options.browserConnectorUnavailable) return "unavailable";
  if (options.chromeNativeHostOk === false) return "native-host-invalid";
  return "not-reported-unavailable";
}

function browserConnectorRepairHandoff(options) {
  const status = browserConnectorStatus(options);
  return {
    required: status !== "not-reported-unavailable",
    status,
    profileIdentifiersStored: false,
    accountIdentifiersStored: false,
    steps: [
      "Open Chrome in the signed-in profile intended for AdMob work.",
      "Confirm the Codex Chrome Extension is installed and enabled in that same selected Chrome profile.",
      "If the extension is enabled in a different Chrome profile, switch the connector to that profile or install/enable the extension in the selected profile.",
      "If the Browser or Chrome plugin native module fails before tab discovery, repair or reinstall the bundled Browser/Chrome plugin and rerun this report.",
      "If the native host is reported invalid, reinstall or repair the Chrome plugin from the Codex plugin UI.",
      "Rerun the read-only AdMob readiness command before creating or editing AdMob apps or units.",
    ],
  };
}

function browserConnectorNextAction(options) {
  const status = browserConnectorStatus(options);
  if (status === "native-module-load-failed") {
    return "Repair or reinstall the bundled Browser/Chrome plugin native module, then rerun this read-only AdMob report before creating or editing ad apps or units.";
  }
  if (status === "selected-profile-extension-missing") {
    return "Install or enable the Codex Chrome Extension in the selected signed-in Chrome profile, then rerun this read-only AdMob report before creating or editing ad apps or units.";
  }
  if (status !== "not-reported-unavailable") {
    return "Fix the Chrome connector/profile mismatch, then rerun this read-only AdMob report from the signed-in browser profile before creating or editing ad apps or units.";
  }
  return "";
}

function pushBrowserConnectorDiagnostics(checks, blockers, options) {
  const diagnosticsCaptured =
    options.browserConnectorUnavailable === true ||
    options.browserNativeModuleLoadFailed === true ||
    options.selectedChromeProfileExtensionMissing === true ||
    options.codexExtensionPresentInOtherChromeProfile === true ||
    options.chromeNativeHostOk !== null;
  if (!diagnosticsCaptured) return;

  const connectorUsable =
    options.browserConnectorUnavailable !== true &&
    options.browserNativeModuleLoadFailed !== true &&
    options.selectedChromeProfileExtensionMissing !== true &&
    options.chromeNativeHostOk !== false;

  pushCheck(
    checks,
    "browser-connector-usable",
    connectorUsable,
    connectorUsable
      ? "Browser connector was not reported unavailable during the read-only AdMob check."
      : "Browser connector could not be used for the read-only AdMob check; diagnostics are stored as redacted booleans only.",
    "Install or enable the Codex Chrome Extension in the selected Chrome profile, or switch the connector to the Chrome profile where the extension is enabled, then rerun the read-only AdMob report.",
  );
  if (!connectorUsable) blockers.push("browser-connector-unavailable");
  if (options.browserNativeModuleLoadFailed === true) {
    blockers.push("browser-native-module-load-failed");
  }

  if (options.selectedChromeProfileExtensionMissing === true) {
    blockers.push("selected-chrome-profile-extension-missing");
  }
  if (options.codexExtensionPresentInOtherChromeProfile === true) {
    blockers.push("codex-extension-present-in-other-chrome-profile");
  }

  if (options.chromeNativeHostOk !== null) {
    pushCheck(
      checks,
      "chrome-native-host-manifest-ok",
      options.chromeNativeHostOk === true,
      options.chromeNativeHostOk
        ? "Chrome native messaging host manifest check passed."
        : "Chrome native messaging host manifest check did not pass.",
      "Reinstall the Chrome plugin from the Codex plugin UI if the native host manifest is missing or invalid.",
    );
    if (options.chromeNativeHostOk !== true) {
      blockers.push("chrome-native-host-manifest-not-ok");
    }
  }
}

function buildReport(options) {
  const checks = [];
  const blockers = [];
  const observedAt = options.observedAt || new Date().toISOString();
  const readOnly = options.storeMutationPerformed !== true;
  const noForbiddenFormats = options.forbiddenFormatsObserved === false;

  pushCheck(
    checks,
    "read-only-admob-inspection",
    readOnly,
    readOnly
      ? "AdMob console check was captured without creating apps, ad units, payments, or external mutations."
      : "An AdMob mutation was performed during this check, so the report cannot be used as read-only readiness evidence.",
    "Rerun the AdMob check in read-only mode before using it as launch readiness evidence.",
  );
  if (!readOnly) blockers.push("admob-check-mutated-console-state");

  pushCheck(
    checks,
    "account-identifiers-redacted",
    true,
    "Report stores AdMob host/status signals only; account IDs, payment IDs, app IDs, ad-unit IDs, emails, and personal names are intentionally omitted.",
  );
  pushBrowserConnectorDiagnostics(checks, blockers, options);
  pushCheck(
    checks,
    "admob-console-reachable",
    options.admobConsoleObserved === true,
    options.admobConsoleObserved
      ? "AdMob console was reachable in the browser session."
      : "AdMob console was not confirmed reachable in this report.",
    "Open AdMob with the signed-in browser and confirm the app list is visible.",
  );
  if (options.admobConsoleObserved !== true)
    blockers.push("admob-console-not-observed");

  pushCheck(
    checks,
    "admob-ios-app-record-present",
    options.admobIosAppPresent === true,
    options.admobIosAppPresent === true
      ? `FREED iOS AdMob app for ${BUNDLE_ID} was visible.`
      : options.admobIosAppPresent === false
        ? `FREED iOS AdMob app for ${BUNDLE_ID} was not visible.`
        : `FREED iOS AdMob app for ${BUNDLE_ID} was not checked.`,
    `Create or identify the iOS AdMob app for ${APP_NAME} bundle ${BUNDLE_ID}, then store ${IOS_APP_ID_KEY} outside the repo.`,
  );
  if (options.admobIosAppPresent !== true) {
    blockers.push(
      options.admobIosAppPresent === false
        ? "admob-ios-app-missing"
        : "admob-ios-app-unconfirmed",
    );
  }

  pushCheck(
    checks,
    "admob-android-app-record-present",
    options.admobAndroidAppPresent === true,
    options.admobAndroidAppPresent === true
      ? `FREED Android AdMob app for ${PACKAGE_NAME} was visible.`
      : options.admobAndroidAppPresent === false
        ? `FREED Android AdMob app for ${PACKAGE_NAME} was not visible.`
        : `FREED Android AdMob app for ${PACKAGE_NAME} was not checked.`,
    `Create or identify the Android AdMob app for ${APP_NAME} package ${PACKAGE_NAME}, then store ${ANDROID_APP_ID_KEY} outside the repo.`,
  );
  if (options.admobAndroidAppPresent !== true) {
    blockers.push(
      options.admobAndroidAppPresent === false
        ? "admob-android-app-missing"
        : "admob-android-app-unconfirmed",
    );
  }

  pushCheck(
    checks,
    "ios-rewarded-reset-unit-present",
    options.iosRewardedUnitPresent === true,
    options.iosRewardedUnitPresent === true
      ? "iOS rewarded reset ad unit was visible."
      : options.iosRewardedUnitPresent === false
        ? "iOS rewarded reset ad unit was not visible."
        : "iOS rewarded reset ad unit was not checked.",
    `Create or identify exactly one iOS rewarded unit for the recovery reset gate, then store ${IOS_REWARDED_UNIT_KEY} outside the repo.`,
  );
  if (options.iosRewardedUnitPresent !== true) {
    blockers.push(
      options.iosRewardedUnitPresent === false
        ? "ios-rewarded-reset-unit-missing"
        : "ios-rewarded-reset-unit-unconfirmed",
    );
  }

  pushCheck(
    checks,
    "android-rewarded-reset-unit-present",
    options.androidRewardedUnitPresent === true,
    options.androidRewardedUnitPresent === true
      ? "Android rewarded reset ad unit was visible."
      : options.androidRewardedUnitPresent === false
        ? "Android rewarded reset ad unit was not visible."
        : "Android rewarded reset ad unit was not checked.",
    `Create or identify exactly one Android rewarded unit for the recovery reset gate, then store ${ANDROID_REWARDED_UNIT_KEY} outside the repo.`,
  );
  if (options.androidRewardedUnitPresent !== true) {
    blockers.push(
      options.androidRewardedUnitPresent === false
        ? "android-rewarded-reset-unit-missing"
        : "android-rewarded-reset-unit-unconfirmed",
    );
  }

  pushCheck(
    checks,
    "no-forbidden-ad-formats-observed",
    noForbiddenFormats,
    noForbiddenFormats
      ? "No banner, interstitial, app-open, or native ad units were observed for the v1 FREED setup."
      : options.forbiddenFormatsObserved === true
        ? "A forbidden non-rewarded ad format was observed in the v1 FREED setup."
        : "Forbidden ad formats were not checked.",
    "Keep v1 monetization scoped to rewarded reset ads only; delete or leave inactive any banner, interstitial, app-open, or native units.",
  );
  if (!noForbiddenFormats) {
    blockers.push(
      options.forbiddenFormatsObserved === true
        ? "forbidden-ad-format-observed"
        : "forbidden-ad-formats-unconfirmed",
    );
  }

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const readyForRewardedAdRequestProof = failCount === 0;
  const result = readyForRewardedAdRequestProof
    ? "ready-for-rewarded-ad-request-proof"
    : "blocked-before-admob-console-ready";

  return {
    schemaVersion: SCHEMA_VERSION,
    sanitized: true,
    generatedAt: new Date().toISOString(),
    observedAt,
    runId: options.runId,
    result,
    readyForRewardedAdRequestProof,
    appIdentifiers: {
      appName: APP_NAME,
      bundleId: BUNDLE_ID,
      packageName: PACKAGE_NAME,
    },
    browserInspection: {
      readOnly,
      storeMutationPerformed: options.storeMutationPerformed === true,
      accountIdentifiersRedacted: true,
      screenshotsStored: false,
      personalNamesStored: false,
      emailsStored: false,
      paymentIdsStored: false,
      accountIdsStored: false,
      adMobAppIdsStored: false,
      adUnitIdsStored: false,
    },
    browserConnector: {
      status: browserConnectorStatus(options),
      connectorUnavailable: options.browserConnectorUnavailable === true,
      nativeModuleLoadFailed: options.browserNativeModuleLoadFailed === true,
      selectedChromeProfileExtensionMissing:
        options.selectedChromeProfileExtensionMissing === true,
      codexExtensionPresentInOtherChromeProfile:
        options.codexExtensionPresentInOtherChromeProfile === true,
      chromeNativeHostOk:
        options.chromeNativeHostOk === null ? null : options.chromeNativeHostOk === true,
      diagnosticIdentifiersRedacted: true,
      profileNamesStored: false,
      profilePathsStored: false,
      repairHandoff: browserConnectorRepairHandoff(options),
    },
    admob: {
      consoleHost: "apps.admob.com",
      observedViaBrowser: options.admobConsoleObserved === true,
      iosApp: {
        bundleId: BUNDLE_ID,
        status: observedStatus(options.admobIosAppPresent),
        productionEnvKey: IOS_APP_ID_KEY,
      },
      androidApp: {
        packageName: PACKAGE_NAME,
        status: observedStatus(options.admobAndroidAppPresent),
        productionEnvKey: ANDROID_APP_ID_KEY,
      },
      iosRewardedUnit: {
        placement: "free recovery reset challenge gate",
        status: observedStatus(options.iosRewardedUnitPresent),
        productionEnvKey: IOS_REWARDED_UNIT_KEY,
      },
      androidRewardedUnit: {
        placement: "free recovery reset challenge gate",
        status: observedStatus(options.androidRewardedUnitPresent),
        productionEnvKey: ANDROID_REWARDED_UNIT_KEY,
      },
      allowedFormats: ["rewarded"],
      forbiddenFormats: ["banner", "interstitial", "app-open", "native"],
      forbiddenFormatsObserved: options.forbiddenFormatsObserved === true,
      noForbiddenFormatsObserved: noForbiddenFormats,
    },
    checks,
    passCount,
    failCount,
    blockers,
    nextActions: [
      ...[browserConnectorNextAction(options)].filter(Boolean),
      `Create or identify the iOS AdMob app for ${APP_NAME} bundle ${BUNDLE_ID}.`,
      `Create or identify the Android AdMob app for ${APP_NAME} package ${PACKAGE_NAME}.`,
      "Create exactly one rewarded reset ad unit per platform for the recovery challenge gate.",
      "Store the four production AdMob IDs in the production env file outside the repo.",
      "Rerun this read-only report, then fill rewarded-ad-request-report.template.json only after a real rewarded response loads on device.",
    ],
    releaseBoundary:
      "Read-only AdMob console status only. This report does not prove rewarded ads load, sandbox purchases pass, premium no-ad behavior works, physical-device protection works, or production submission readiness.",
  };
}

function buildMarkdown(report, jsonArtifact) {
  const lines = [
    "# FREED AdMob Console Readiness",
    "",
    `- JSON artifact: \`${jsonArtifact}\``,
    `- Result: ${report.result}`,
    `- Ready for rewarded-ad request proof: ${report.readyForRewardedAdRequestProof}`,
    `- Pass/fail: ${report.passCount} pass, ${report.failCount} fail`,
    `- Read-only inspection: ${report.browserInspection.readOnly}`,
    `- Browser connector: ${report.browserConnector.status}`,
    `- App: ${report.appIdentifiers.appName}`,
    `- Bundle ID: \`${report.appIdentifiers.bundleId}\``,
    `- Android package: \`${report.appIdentifiers.packageName}\``,
    "",
  ];
  if (report.browserConnector.status !== "not-reported-unavailable") {
    lines.push(
      "## Browser Connector",
      "",
      `- Connector unavailable: ${report.browserConnector.connectorUnavailable}`,
      `- Native module load failed: ${report.browserConnector.nativeModuleLoadFailed}`,
      `- Selected Chrome profile extension missing: ${report.browserConnector.selectedChromeProfileExtensionMissing}`,
      `- Extension present in another Chrome profile: ${report.browserConnector.codexExtensionPresentInOtherChromeProfile}`,
      `- Native host manifest OK: ${report.browserConnector.chromeNativeHostOk}`,
      `- Profile names stored: ${report.browserConnector.profileNamesStored}`,
      `- Profile paths stored: ${report.browserConnector.profilePathsStored}`,
      `- Repair handoff required: ${report.browserConnector.repairHandoff.required}`,
      "",
      "Repair checklist:",
      ...report.browserConnector.repairHandoff.steps.map((step) => `- ${step}`),
      "",
    );
  }
  lines.push(
    "## AdMob",
    "",
    `- Console observed: ${report.admob.observedViaBrowser}`,
    `- iOS app: ${report.admob.iosApp.status}`,
    `- Android app: ${report.admob.androidApp.status}`,
    `- iOS rewarded unit: ${report.admob.iosRewardedUnit.status}`,
    `- Android rewarded unit: ${report.admob.androidRewardedUnit.status}`,
    `- No forbidden formats observed: ${report.admob.noForbiddenFormatsObserved}`,
    `- Allowed formats: ${report.admob.allowedFormats.map((format) => `\`${format}\``).join(", ")}`,
    `- Forbidden formats: ${report.admob.forbiddenFormats.map((format) => `\`${format}\``).join(", ")}`,
    "",
    "## Blockers",
    "",
  );
  if (report.blockers.length > 0) {
    lines.push(...report.blockers.map((blocker) => `- ${blocker}`));
  } else {
    lines.push("- None");
  }
  lines.push("", "## Next Actions", "");
  if (Array.isArray(report.nextActions) && report.nextActions.length > 0) {
    lines.push(...report.nextActions.map((action) => `- ${action}`));
  } else {
    lines.push("- None");
  }
  lines.push("", `Boundary: ${report.releaseBoundary}`, "");
  return `${lines.join("\n")}\n`;
}

function writeArtifacts(options) {
  const report = buildReport(options);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdownPath = path.join(
    path.dirname(options.reportPath),
    "ADMOB_CONSOLE_READINESS.md",
  );
  fs.writeFileSync(
    markdownPath,
    buildMarkdown(report, repoRelative(options.reportPath)),
  );
  return {
    report,
    reportPath: repoRelative(options.reportPath),
    markdownPath: repoRelative(markdownPath),
  };
}

function runSelfTest() {
  assert.equal(safeRunId("admob-console-current"), "admob-console-current");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(
    () =>
      parseArgs(["--report", "docs/validation/evidence/admob-console.json"]),
    /evidence/,
  );
  assert.throws(() => parseArgs(["--observed-at", "not-a-date"]), /ISO date/);
  const pending = buildReport({
    ...parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/admob-console-readiness.json",
    ]),
    observedAt: "2026-06-09T00:00:00.000Z",
  });
  assert.equal(pending.schemaVersion, SCHEMA_VERSION);
  assert.equal(pending.sanitized, true);
  assert.equal(pending.readyForRewardedAdRequestProof, false);
  assert.ok(pending.blockers.includes("admob-console-not-observed"));
  assert.equal(pending.browserInspection.adUnitIdsStored, false);
  const connectorBlocked = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/admob-console-readiness.json",
      "--browser-connector-unavailable",
      "--browser-native-module-load-failed",
      "--selected-chrome-profile-extension-missing",
      "--codex-extension-present-in-other-chrome-profile",
      "--chrome-native-host-ok",
    ]),
  );
  assert.equal(
    connectorBlocked.browserConnector.status,
    "selected-profile-extension-missing",
  );
  assert.ok(connectorBlocked.blockers.includes("browser-connector-unavailable"));
  assert.ok(connectorBlocked.blockers.includes("browser-native-module-load-failed"));
  assert.ok(
    connectorBlocked.blockers.includes(
      "selected-chrome-profile-extension-missing",
    ),
  );
  assert.ok(
    connectorBlocked.blockers.includes(
      "codex-extension-present-in-other-chrome-profile",
    ),
  );
  assert.equal(connectorBlocked.browserConnector.profileNamesStored, false);
  assert.equal(connectorBlocked.browserConnector.nativeModuleLoadFailed, true);
  assert.equal(connectorBlocked.browserConnector.repairHandoff.required, true);
  assert.equal(connectorBlocked.browserConnector.repairHandoff.profileIdentifiersStored, false);
  const connectorBlockedMarkdown = buildMarkdown(
    connectorBlocked,
    "docs/validation/artifacts/self-test/admob-console-readiness.json",
  );
  assert.match(connectorBlockedMarkdown, /Selected Chrome profile extension missing: true/);
  assert.match(connectorBlockedMarkdown, /Native module load failed: true/);
  assert.match(connectorBlockedMarkdown, /Repair checklist/);
  assert.match(connectorBlockedMarkdown, /## Next Actions/);
  const blocked = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/admob-console-readiness.json",
      "--admob-console-observed",
      "--admob-ios-app-missing",
      "--admob-android-app-missing",
      "--ios-rewarded-unit-missing",
      "--android-rewarded-unit-missing",
      "--forbidden-formats-observed",
      "--observed-at",
      "2026-06-09T00:00:00.000Z",
    ]),
  );
  assert.equal(blocked.result, "blocked-before-admob-console-ready");
  assert.ok(blocked.blockers.includes("admob-ios-app-missing"));
  assert.ok(blocked.blockers.includes("admob-android-app-missing"));
  assert.ok(blocked.blockers.includes("ios-rewarded-reset-unit-missing"));
  assert.ok(blocked.blockers.includes("android-rewarded-reset-unit-missing"));
  assert.ok(blocked.blockers.includes("forbidden-ad-format-observed"));
  const ready = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/admob-console-readiness.json",
      "--admob-console-observed",
      "--admob-ios-app-present",
      "--admob-android-app-present",
      "--ios-rewarded-unit-present",
      "--android-rewarded-unit-present",
      "--no-forbidden-formats-observed",
    ]),
  );
  assert.equal(ready.result, "ready-for-rewarded-ad-request-proof");
  assert.equal(ready.readyForRewardedAdRequestProof, true);
  assert.equal(ready.failCount, 0);
  assert.match(
    buildMarkdown(
      blocked,
      "docs/validation/artifacts/self-test/admob-console-readiness.json",
    ),
    /forbidden-ad-format-observed/,
  );
  console.log("AdMob console readiness self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const result = writeArtifacts(options);
  console.log(
    JSON.stringify(
      {
        artifact: result.reportPath,
        blockers: result.report.blockers,
        markdownArtifact: result.markdownPath,
        readyForRewardedAdRequestProof:
          result.report.readyForRewardedAdRequestProof,
        result: result.report.result,
        schemaVersion: result.report.schemaVersion,
        sanitized: result.report.sanitized,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  SCHEMA_VERSION,
  buildMarkdown,
  buildReport,
  parseArgs,
};
