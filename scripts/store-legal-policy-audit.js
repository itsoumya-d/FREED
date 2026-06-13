#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-store-legal-policy-audit-v1";
const DEFAULT_REPORT = "docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json";

const SOURCE_PATHS = {
  privacyPolicy: "store/privacy-policy.md",
  playDataSafety: "store/play-store/data-safety.md",
  playMetadata: "store/play-store/metadata.md",
  appStorePrivacy: "store/app-store/app-privacy.md",
  appStoreMetadata: "store/app-store/metadata.md",
  releaseChecklist: "store/release-submission-checklist.md",
  consolePacket: "store/console-launch-packet.md",
  privacyDataMap: "docs/privacy-data-map.md",
  androidPolicyPack: "docs/store-policy/android-accessibility-and-fgs-disclosure.md",
  iosPolicyPack: "docs/store-policy/ios-screen-time-safari-dns-review.md",
  privacyRoute: "app/privacy.tsx",
  supportRoute: "app/support.tsx",
  accountDeletionRoute: "app/account-deletion.tsx",
  legalPages: "src/features/legal-pages.tsx",
};

const PUBLIC_URLS = [
  "https://freedrecovery.app/privacy",
  "https://freedrecovery.app/support",
  "https://freedrecovery.app/account-deletion",
];
const CORE_PRODUCT_IDS = ["freed_premium_yearly", "freed_premium_monthly", "freed_premium_lifetime"];
const FUTURE_PRODUCT_IDS = ["freed_family_yearly", "freed_accountability_monthly", "freed_ai_coach_monthly"];

function printHelp() {
  console.log(`Usage: npm run audit:store-legal -- [options]

Validates the local store legal, privacy, metadata, and policy handoff packet
for App Store Connect and Google Play Console. This is a local source audit; it
does not verify hosted pages, console answers, legal review, or platform review.

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

function resolveInputPath(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function readText(relativePath) {
  return fs.readFileSync(resolveInputPath(relativePath), "utf8");
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveInputPath(relativePath))).digest("hex");
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function excludesAll(text, needles) {
  return needles.every((needle) => !text.includes(needle));
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
    publicUrls: {
      privacy: PUBLIC_URLS[0],
      support: PUBLIC_URLS[1],
      accountDeletion: PUBLIC_URLS[2],
    },
    bundleId: "app.freed.recovery",
    packageName: "app.freed.recovery",
    releaseBoundary:
      "Local legal/metadata source precheck only; hosted page availability, legal review, store-console answers, platform approval, sandbox purchases, and physical-device evidence still gate production submission.",
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

  const allStoreText = [
    files.privacyPolicy,
    files.playDataSafety,
    files.playMetadata,
    files.appStorePrivacy,
    files.appStoreMetadata,
    files.releaseChecklist,
    files.consolePacket,
  ].join("\n");

  pushCheck(
    checks,
    "public-legal-routes",
    includesAll(files.privacyRoute, ["PrivacyPolicyPage"]) &&
      includesAll(files.supportRoute, ["SupportPage"]) &&
      includesAll(files.accountDeletionRoute, ["AccountDeletionPage"]) &&
      includesAll(files.legalPages, ["PrivacyPolicyPage", "SupportPage", "AccountDeletionPage", "support@freedrecovery.app"]),
    "Expo public legal routes exist for privacy, support, and account deletion and route to shared legal page components.",
  );
  pushCheck(
    checks,
    "public-urls-aligned",
    PUBLIC_URLS.every((url) => allStoreText.includes(url)),
    "Privacy, support, and account-deletion URLs are present across store policy and metadata handoff files.",
  );
  pushCheck(
    checks,
    "bundle-and-package-aligned",
    ["app.freed.recovery"].every((id) =>
      [files.playDataSafety, files.playMetadata, files.appStorePrivacy, files.appStoreMetadata, files.consolePacket].every((text) =>
        text.includes(id),
      ),
    ),
    "App Store and Play Store legal/metadata drafts reference app.freed.recovery.",
  );
  pushCheck(
    checks,
    "privacy-policy-core-sections",
    includesAll(files.privacyPolicy, [
      "Effective date:",
      "Data FREED Uses On Device",
      "Optional Data Sent To FREED Servers",
      "Ads And Payments",
      "Permissions",
      "Retention And Deletion",
      "Privacy contact: support@freedrecovery.app",
    ]),
    "Privacy policy includes effective date, on-device data, optional server data, ads/payments, permissions, retention/deletion, and contact sections.",
  );
  pushCheck(
    checks,
    "privacy-policy-native-boundaries",
    includesAll(files.privacyPolicy, [
      "DNS-only VPN permission",
      "does not full-tunnel traffic",
      "Family Controls",
      "DeviceActivity",
      "ManagedSettings",
      "Safari Content Blocker",
      "opaque selected target tokens",
    ]),
    "Privacy policy states Android DNS-only VPN and iOS Screen Time/Safari data boundaries.",
  );
  pushCheck(
    checks,
    "privacy-data-map-store-review-coverage",
    includesAll(files.privacyDataMap, [
      "Store Review Notes",
      "store/play-store/data-safety.md",
      "store/app-store/app-privacy.md",
      "docs/store-policy/ios-screen-time-safari-dns-review.md",
      "docs/store-policy/android-accessibility-and-fgs-disclosure.md",
      "Protection permission setup",
      "No raw path/query",
    ]),
    "Privacy data map links store answer sheets, platform policy packs, protection setup fields, and raw URL/path/query boundaries.",
  );
  pushCheck(
    checks,
    "play-data-safety-core-answers",
    includesAll(files.playDataSafety, [
      "Last reviewed:",
      "Does the app collect or share any required user data types? Yes",
      "Is all collected user data encrypted in transit? Yes",
      "Can users request data deletion? Yes",
      "Is the app committed to the Families policy? No",
      "Purchase history",
      "Device or other IDs",
      "App interactions",
      "Data Types Not Collected For V1 Local-First Protection",
    ]),
    "Play Data Safety answer sheet covers collection, encryption, deletion, Families status, disclosed data types, and not-collected v1 data.",
  );
  pushCheck(
    checks,
    "play-policy-declarations",
    includesAll(files.playMetadata, [
      "AccessibilityService",
      "VpnService",
      "Foreground Service Special Use",
      "does not perform continuous screenshot analysis",
      "does not route normal traffic to a monetized remote proxy",
      "does not include Android Ad ID permission",
    ]) &&
      includesAll(files.androidPolicyPack, [
        "AccessibilityService",
        "VpnService",
        "special-use foreground service",
        "No screenshots",
        "No OCR",
        "No HTTPS MITM",
      ]),
    "Play metadata and Android policy pack include AccessibilityService, VpnService, foreground-service, no screenshot/OCR, no proxy, no Ad ID, and no MITM boundaries.",
  );
  pushCheck(
    checks,
    "app-store-privacy-core-answers",
    includesAll(files.appStorePrivacy, [
      "Last reviewed:",
      "Data used to track users: No",
      "Purchase History",
      "User ID",
      "Device ID",
      "Data Not Collected For V1 Local-First Protection",
      "Browsing History",
      "Search History",
      "Precise Location",
    ]),
    "App Store privacy answer sheet covers no tracking, conditional linked/unlinked data, and data not collected for v1 protection.",
  );
  pushCheck(
    checks,
    "app-store-review-notes",
    includesAll(files.appStoreMetadata, [
      "Family Controls",
      "DeviceActivity",
      "ManagedSettings",
      "Safari Content Blocker",
      "does not inspect native third-party app screens",
      "Optional DNS Settings",
      "does not include a packet-tunnel provider",
    ]) &&
      includesAll(files.iosPolicyPack, [
        "Family Controls",
        "DeviceActivity",
        "ManagedSettings",
        "Safari Content Blocker",
        "No packet tunnel",
        "no full traffic proxying",
        "MITM HTTPS",
      ]),
    "App Store metadata and iOS policy pack include Screen Time/Safari/DNS review boundaries.",
  );
  pushCheck(
    checks,
    "core3-products-only-in-store-metadata",
    CORE_PRODUCT_IDS.every((id) => allStoreText.includes(id)) &&
      excludesAll([files.playMetadata, files.appStoreMetadata, files.appStorePrivacy, files.playDataSafety].join("\n"), FUTURE_PRODUCT_IDS) &&
      files.consolePacket.includes("Future SKUs are disabled for v1"),
    "Store metadata/privacy packet includes Core 3 product IDs, keeps future SKU IDs out of active metadata/privacy answers, and documents future SKUs as disabled in the console packet.",
    "Keep future SKU IDs out of v1 active metadata, paywall, purchase calls, and screenshots; console handoffs may name them only as disabled/post-launch.",
  );
  pushCheck(
    checks,
    "release-checklist-gates-production-submit",
    includesAll(files.releaseChecklist, [
      "Keep `submit.production.android.releaseStatus` as `draft` until release evidence passes.",
      "Privacy And Policy",
      "Host the checked-in Expo routes `app/privacy.tsx`, `app/support.tsx`, and `app/account-deletion.tsx`",
      "Production submission must wait for physical-device Android/iOS evidence",
    ]) &&
      includesAll(files.consolePacket, [
        "Do not submit production until strict release audit",
        "EAS submit guard",
        "Play internal track and draft release",
        "App Store Connect/TestFlight beta only",
      ]),
    "Release checklist and console packet gate production submission until strict evidence and keep store submits draft/internal.",
  );
  pushCheck(
    checks,
    "metadata-describes-guided-permission-setup",
    includesAll(files.playMetadata, [
      "Protection setup sends you directly to the required Android permission screens",
      "before activation completes",
    ]) &&
      includesAll(files.appStoreMetadata, [
        "sends you directly to the required system authorization screen",
        "protection test before the app marks setup complete",
      ]),
    "Store metadata explains direct permission routing and activation-test completion without claiming silent consent.",
  );
  pushCheck(
    checks,
    "no-overclaim-for-silent-permissions",
    excludesAll(allStoreText.toLowerCase(), [
      "silently grant",
      "without user consent",
      "bypass consent",
      "bypass os consent",
      "screen recording",
      "silently enable",
      "automatic permission grant",
    ]),
    "Store legal/metadata sources avoid silent-permission, consent-bypass, screen-recording, and automatic-grant claims while allowing explicit negative safety exclusions.",
  );

  return finalizeReport(checks, auditedSources);
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  assert.equal(includesAll("one two three", ["one", "three"]), true);
  assert.equal(includesAll("one two", ["one", "three"]), false);
  assert.equal(excludesAll("one two", ["three"]), true);
  assert.equal(excludesAll("one two", ["two"]), false);
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/store-legal.json"]), /docs\/validation\/evidence/);
  const report = finalizeReport(
    [
      { id: "one", status: "pass", detail: "ok", next: "" },
      { id: "two", status: "fail", detail: "bad", next: "fix" },
    ],
    [{ path: "store/privacy-policy.md", sha256: "abc" }],
  );
  assert.equal(report.schemaVersion, SCHEMA_VERSION);
  assert.equal(report.result, "fail");
  assert.equal(report.passCount, 1);
  assert.equal(report.failCount, 1);
  assert.equal(report.publicUrls.privacy, "https://freedrecovery.app/privacy");
  assert.equal(report.packageName, "app.freed.recovery");
  console.log("store legal policy audit self-test: pass");
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
