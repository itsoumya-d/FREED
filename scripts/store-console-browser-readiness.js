#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "freed-store-console-browser-readiness-v1";
const DEFAULT_RUN_ID = "store-console-browser-current";
const DEFAULT_OUTPUT_DIR =
  "docs/validation/artifacts/store-console-browser-current";
const REPORT_FILE_NAME = "store-console-browser-readiness.json";
const DEFAULT_REPORT = `${DEFAULT_OUTPUT_DIR}/${REPORT_FILE_NAME}`;
const APP_NAME = "FREED";
const BUNDLE_ID = "app.freed.recovery";
const PACKAGE_NAME = "app.freed.recovery";

function printHelp() {
  console.log(`Usage: npm run evidence:store-console-browser -- [options]

Writes a sanitized read-only browser-console readiness report for FREED's
Google Play Console and App Store Connect launch setup. This does not create
apps, products, payments, submissions, or external side effects.

Options:
  --report <path>                    JSON report under docs/validation/artifacts.
                                     Default: ${DEFAULT_REPORT}
  --output-dir <path>                Artifact output folder. When --report is
                                     omitted, writes ${REPORT_FILE_NAME} here.
                                     Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>                      Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --observed-at <iso-date>           Browser observation timestamp.
  --play-console-observed            Play Console account/app list was reachable.
  --play-freed-app-present           FREED app record was visible in Play Console.
  --play-freed-app-missing           FREED app record was not visible in Play Console.
  --app-store-connect-observed       App Store Connect apps page was reachable.
  --app-store-freed-app-present      FREED app record was visible in App Store Connect.
  --app-store-freed-app-missing      FREED app record was not visible in App Store Connect.
  --app-store-agreement-accepted     No App Store agreement blocker was visible.
  --app-store-agreement-pending      App Store agreement blocker was visible.
  --browser-connector-unavailable    Chrome connector could not communicate with the browser.
  --browser-native-module-load-failed
                                     Browser/Chrome plugin native module failed before tab discovery.
  --selected-chrome-profile-extension-missing
                                     Selected Chrome profile is missing/disabled for Codex Chrome Extension.
  --codex-extension-present-in-other-chrome-profile
                                     Codex Chrome Extension was found in another Chrome profile.
  --chrome-native-host-ok            Native messaging host manifest check passed.
  --chrome-native-host-not-ok        Native messaging host manifest check failed.
  --store-mutation-performed         Mark the run unsafe if a store mutation happened.
  --self-test                        Run offline parser/report tests.
  --help, -h                         Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    appStoreAgreementPending: null,
    appStoreConnectObserved: false,
    appStoreFreedAppRecordPresent: null,
    browserConnectorUnavailable: false,
    browserNativeModuleLoadFailed: false,
    chromeNativeHostOk: null,
    codexExtensionPresentInOtherChromeProfile: false,
    observedAt: "",
    outputDir: DEFAULT_OUTPUT_DIR,
    playConsoleObserved: false,
    playFreedAppRecordPresent: null,
    reportPath: DEFAULT_REPORT,
    runId: DEFAULT_RUN_ID,
    selfTest: false,
    selectedChromeProfileExtensionMissing: false,
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
    else if (arg === "--play-console-observed")
      options.playConsoleObserved = true;
    else if (arg === "--play-freed-app-present")
      options.playFreedAppRecordPresent = true;
    else if (arg === "--play-freed-app-missing")
      options.playFreedAppRecordPresent = false;
    else if (arg === "--app-store-connect-observed")
      options.appStoreConnectObserved = true;
    else if (arg === "--app-store-freed-app-present")
      options.appStoreFreedAppRecordPresent = true;
    else if (arg === "--app-store-freed-app-missing")
      options.appStoreFreedAppRecordPresent = false;
    else if (arg === "--app-store-agreement-accepted")
      options.appStoreAgreementPending = false;
    else if (arg === "--app-store-agreement-pending")
      options.appStoreAgreementPending = true;
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

function statusForBoolean(value, { unknownStatus = "pending" } = {}) {
  if (value === true) return "pass";
  if (value === false) return "fail";
  return unknownStatus;
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
      "Open Chrome in the signed-in profile intended for Google Play Console and App Store Connect work.",
      "Confirm the Codex Chrome Extension is installed and enabled in that same selected Chrome profile.",
      "If the extension is enabled in a different Chrome profile, switch the connector to that profile or install/enable the extension in the selected profile.",
      "If the Browser or Chrome plugin native module fails before tab discovery, repair or reinstall the bundled Browser/Chrome plugin and rerun this report.",
      "If the native host is reported invalid, reinstall or repair the Chrome plugin from the Codex plugin UI.",
      "Rerun the read-only store console readiness command before creating or editing store products.",
    ],
  };
}

function browserConnectorNextAction(options) {
  const status = browserConnectorStatus(options);
  if (status === "native-module-load-failed") {
    return "Repair or reinstall the bundled Browser/Chrome plugin native module, then rerun this read-only report before creating or editing store products.";
  }
  if (status === "selected-profile-extension-missing") {
    return "Install or enable the Codex Chrome Extension in the selected signed-in Chrome profile, then rerun this read-only report before creating or editing store products.";
  }
  if (status !== "not-reported-unavailable") {
    return "Fix the Chrome connector/profile mismatch, then rerun this read-only report from the signed-in browser profile before creating or editing store products.";
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
      ? "Browser connector was not reported unavailable during the read-only console check."
      : "Browser connector could not be used for the read-only console check; diagnostics are stored as redacted booleans only.",
    "Install or enable the Codex Chrome Extension in the selected Chrome profile, or switch the connector to the Chrome profile where the extension is enabled, then rerun the read-only console report.",
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

  pushCheck(
    checks,
    "read-only-browser-inspection",
    readOnly,
    readOnly
      ? "Browser console check was captured without creating apps, products, payments, submissions, or external mutations."
      : "A store mutation was performed during this browser check, so the report cannot be used as read-only readiness evidence.",
    "Rerun the browser check in read-only mode before using it as launch readiness evidence.",
  );
  if (!readOnly) blockers.push("browser-check-mutated-store-state");

  pushCheck(
    checks,
    "account-identifiers-redacted",
    true,
    "Report stores console host/status signals only; account IDs, team IDs, emails, and personal names are intentionally omitted.",
  );
  pushBrowserConnectorDiagnostics(checks, blockers, options);
  pushCheck(
    checks,
    "google-play-console-reachable",
    options.playConsoleObserved === true,
    options.playConsoleObserved
      ? "Google Play Console account/app list was reachable in the browser session."
      : "Google Play Console was not confirmed reachable in this report.",
    "Open Play Console with the signed-in browser and confirm the app list is visible.",
  );
  if (options.playConsoleObserved !== true)
    blockers.push("google-play-console-not-observed");

  pushCheck(
    checks,
    "google-play-freed-app-record-present",
    options.playFreedAppRecordPresent === true,
    options.playFreedAppRecordPresent === true
      ? `FREED app record for ${PACKAGE_NAME} was visible in Google Play Console.`
      : options.playFreedAppRecordPresent === false
        ? `FREED app record for ${PACKAGE_NAME} was not visible in Google Play Console.`
        : `FREED app record for ${PACKAGE_NAME} was not checked in Google Play Console.`,
    `Create or identify the Google Play app record for ${APP_NAME} with package ${PACKAGE_NAME} before configuring Play subscriptions or one-time products.`,
  );
  if (options.playFreedAppRecordPresent !== true) {
    blockers.push(
      options.playFreedAppRecordPresent === false
        ? "google-play-freed-app-record-missing"
        : "google-play-freed-app-record-unconfirmed",
    );
  }

  pushCheck(
    checks,
    "app-store-connect-reachable",
    options.appStoreConnectObserved === true,
    options.appStoreConnectObserved
      ? "App Store Connect apps page was reachable in the browser session."
      : "App Store Connect apps page was not confirmed reachable in this report.",
    "Open App Store Connect with the signed-in browser and confirm the apps page is visible.",
  );
  if (options.appStoreConnectObserved !== true)
    blockers.push("app-store-connect-not-observed");

  pushCheck(
    checks,
    "app-store-freed-app-record-present",
    options.appStoreFreedAppRecordPresent === true,
    options.appStoreFreedAppRecordPresent === true
      ? `FREED app record for ${BUNDLE_ID} was visible in App Store Connect.`
      : options.appStoreFreedAppRecordPresent === false
        ? `FREED app record for ${BUNDLE_ID} was not visible in App Store Connect.`
        : `FREED app record for ${BUNDLE_ID} was not checked in App Store Connect.`,
    `Create or identify the App Store Connect app record for ${APP_NAME} with bundle ID ${BUNDLE_ID} before configuring in-app purchases.`,
  );
  if (options.appStoreFreedAppRecordPresent !== true) {
    blockers.push(
      options.appStoreFreedAppRecordPresent === false
        ? "app-store-connect-freed-app-record-missing"
        : "app-store-connect-freed-app-record-unconfirmed",
    );
  }

  const agreementAccepted = options.appStoreAgreementPending === false;
  pushCheck(
    checks,
    "app-store-license-agreement-accepted",
    agreementAccepted,
    agreementAccepted
      ? "No App Store Connect license-agreement blocker was observed."
      : options.appStoreAgreementPending === true
        ? "App Store Connect showed a pending Apple Developer Program License Agreement that must be accepted by the Account Holder."
        : "App Store Connect license-agreement status was not checked.",
    "Have the Apple Account Holder accept the updated Apple Developer Program License Agreement before creating or submitting FREED.",
  );
  if (!agreementAccepted) {
    blockers.push(
      options.appStoreAgreementPending === true
        ? "app-store-connect-license-agreement-pending"
        : "app-store-connect-license-agreement-unconfirmed",
    );
  }

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const readyForConsoleProductSetup = failCount === 0;
  const result = readyForConsoleProductSetup
    ? "ready-for-console-product-setup"
    : "blocked-before-console-product-setup";

  return {
    schemaVersion: SCHEMA_VERSION,
    sanitized: true,
    generatedAt: new Date().toISOString(),
    observedAt,
    runId: options.runId,
    result,
    readyForConsoleProductSetup,
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
      teamIdsStored: false,
      accountIdsStored: false,
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
    googlePlay: {
      consoleHost: "play.google.com",
      observedViaBrowser: options.playConsoleObserved === true,
      appRecordPresent: options.playFreedAppRecordPresent === true,
      appRecordStatus:
        options.playFreedAppRecordPresent === true
          ? "present"
          : options.playFreedAppRecordPresent === false
            ? "missing"
            : "unconfirmed",
      packageName: PACKAGE_NAME,
      productSetupAllowed:
        options.playConsoleObserved === true &&
        options.playFreedAppRecordPresent === true,
      nextAction:
        options.playFreedAppRecordPresent === true
          ? "Configure Core 3 Play subscriptions and lifetime one-time product in draft/internal state."
          : `Create or identify the Play Console app record for ${APP_NAME} package ${PACKAGE_NAME}.`,
    },
    appStoreConnect: {
      consoleHost: "appstoreconnect.apple.com",
      observedViaBrowser: options.appStoreConnectObserved === true,
      appRecordPresent: options.appStoreFreedAppRecordPresent === true,
      appRecordStatus:
        options.appStoreFreedAppRecordPresent === true
          ? "present"
          : options.appStoreFreedAppRecordPresent === false
            ? "missing"
            : "unconfirmed",
      bundleId: BUNDLE_ID,
      licenseAgreementAccepted: agreementAccepted,
      licenseAgreementStatus:
        options.appStoreAgreementPending === false
          ? "accepted"
          : options.appStoreAgreementPending === true
            ? "pending-account-holder-acceptance"
            : "unconfirmed",
      productSetupAllowed:
        options.appStoreConnectObserved === true &&
        options.appStoreFreedAppRecordPresent === true &&
        agreementAccepted,
      nextAction:
        options.appStoreAgreementPending === true
          ? "Have the Apple Account Holder accept the updated license agreement, then create or identify the FREED app record."
          : options.appStoreFreedAppRecordPresent === true
            ? "Configure Core 3 App Store subscriptions and lifetime non-consumable in sandbox/TestFlight state."
            : `Create or identify the App Store Connect app record for ${APP_NAME} bundle ID ${BUNDLE_ID}.`,
    },
    checks,
    passCount,
    failCount,
    blockers,
    nextActions: [
      ...[browserConnectorNextAction(options)].filter(Boolean),
      `Create or identify the Google Play app record for ${APP_NAME} package ${PACKAGE_NAME}.`,
      `Have the Apple Account Holder accept any pending Apple Developer Program License Agreement.`,
      `Create or identify the App Store Connect app record for ${APP_NAME} bundle ID ${BUNDLE_ID}.`,
      "Only after both app records exist, configure the Core 3 yearly, monthly, and lifetime products from store/store-products.json.",
      "Keep store products, builds, and review state in draft/internal/TestFlight until strict release evidence passes.",
    ],
    releaseBoundary:
      "Read-only browser console status only. This report does not prove store products, sandbox purchases, AdMob, legal hosted URLs, physical-device protection, or production submission readiness.",
  };
}

function buildMarkdown(report, jsonArtifact) {
  const lines = [
    "# FREED Store Console Browser Readiness",
    "",
    `- JSON artifact: \`${jsonArtifact}\``,
    `- Result: ${report.result}`,
    `- Ready for console product setup: ${report.readyForConsoleProductSetup}`,
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
    "## Google Play",
    "",
    `- Console observed: ${report.googlePlay.observedViaBrowser}`,
    `- FREED app record: ${report.googlePlay.appRecordStatus}`,
    `- Product setup allowed: ${report.googlePlay.productSetupAllowed}`,
    `- Next: ${report.googlePlay.nextAction}`,
    "",
    "## App Store Connect",
    "",
    `- Console observed: ${report.appStoreConnect.observedViaBrowser}`,
    `- FREED app record: ${report.appStoreConnect.appRecordStatus}`,
    `- License agreement: ${report.appStoreConnect.licenseAgreementStatus}`,
    `- Product setup allowed: ${report.appStoreConnect.productSetupAllowed}`,
    `- Next: ${report.appStoreConnect.nextAction}`,
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
    "STORE_CONSOLE_BROWSER_READINESS.md",
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
  assert.equal(
    safeRunId("store-console-browser-current"),
    "store-console-browser-current",
  );
  assert.throws(() => safeRunId("../bad"));
  assert.throws(
    () =>
      parseArgs([
        "--report",
        "docs/validation/evidence/store-console-browser.json",
      ]),
    /evidence/,
  );
  assert.throws(() => parseArgs(["--observed-at", "not-a-date"]), /ISO date/);
  const pending = buildReport({
    ...parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
    ]),
    observedAt: "2026-06-09T00:00:00.000Z",
  });
  assert.equal(pending.schemaVersion, SCHEMA_VERSION);
  assert.equal(pending.sanitized, true);
  assert.equal(pending.readyForConsoleProductSetup, false);
  assert.ok(pending.blockers.includes("google-play-console-not-observed"));
  const connectorBlocked = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
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
    "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
  );
  assert.match(connectorBlockedMarkdown, /Selected Chrome profile extension missing: true/);
  assert.match(connectorBlockedMarkdown, /Native module load failed: true/);
  assert.match(connectorBlockedMarkdown, /Repair checklist/);
  assert.match(connectorBlockedMarkdown, /## Next Actions/);
  const blocked = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
      "--play-console-observed",
      "--play-freed-app-missing",
      "--app-store-connect-observed",
      "--app-store-freed-app-missing",
      "--app-store-agreement-pending",
      "--observed-at",
      "2026-06-09T00:00:00.000Z",
    ]),
  );
  assert.equal(blocked.result, "blocked-before-console-product-setup");
  assert.ok(blocked.blockers.includes("google-play-freed-app-record-missing"));
  assert.ok(
    blocked.blockers.includes("app-store-connect-freed-app-record-missing"),
  );
  assert.ok(
    blocked.blockers.includes("app-store-connect-license-agreement-pending"),
  );
  assert.equal(blocked.browserInspection.accountIdsStored, false);
  const ready = buildReport(
    parseArgs([
      "--report",
      "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
      "--play-console-observed",
      "--play-freed-app-present",
      "--app-store-connect-observed",
      "--app-store-freed-app-present",
      "--app-store-agreement-accepted",
    ]),
  );
  assert.equal(ready.result, "ready-for-console-product-setup");
  assert.equal(ready.readyForConsoleProductSetup, true);
  assert.equal(ready.failCount, 0);
  assert.match(
    buildMarkdown(
      blocked,
      "docs/validation/artifacts/self-test/store-console-browser-readiness.json",
    ),
    /google-play-freed-app-record-missing/,
  );
  console.log("store console browser readiness self-test: pass");
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
        readyForConsoleProductSetup: result.report.readyForConsoleProductSetup,
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
