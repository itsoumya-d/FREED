#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_ID = "eas-build-current";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/eas-build-current";
const DEFAULT_REPORT_NAME = "eas-build-handoff.json";
const DEFAULT_MARKDOWN_NAME = "EAS_BUILD_HANDOFF.md";
const EAS_JSON = "eas.json";
const INTERNAL_WORKFLOW = ".eas/workflows/freed-internal-builds.yml";
const STORE_WORKFLOW = ".eas/workflows/freed-store-builds.yml";
const DEFAULT_ANDROID_BUILD_FAILURE_REPORT =
  "docs/validation/artifacts/android-current-apk-retry/android-apk-build-report.json";
const LEGACY_ANDROID_DOWNLOAD_APK =
  "docs/validation/artifacts/continue-goal-android-current-artifacts/apk/FREED-release-universal.apk";

function printHelp() {
  console.log(`Usage: npm run evidence:eas-build-handoff -- [options]

Writes a sanitized EAS current-source artifact handoff. It does not run EAS,
upload files, submit store releases, read secret env files, or mark release
evidence as passing.

Options:
  --run-id <id>              Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --output-dir <path>        Artifact output folder. Default: ${DEFAULT_OUTPUT_DIR}
  --android-failure-report <path>
                             Sanitized local Android build failure report.
                             Default: ${DEFAULT_ANDROID_BUILD_FAILURE_REPORT}
  --self-test                Run offline checks.
  --help, -h                 Show this help.
`);
}

function safeRunId(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function assertSafeInputReportPath(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error(`${label} must be a plain JSON file path.`);
  }
  if (normalized.startsWith("-") || /[;&|`$<>]/.test(normalized)) {
    throw new Error(`${label} must not contain shell syntax or flags.`);
  }
  const relative = repoRelative(normalized);
  if (!relative.startsWith("docs/validation/artifacts/") || !relative.endsWith(".json")) {
    throw new Error(`${label} must be a JSON report under docs/validation/artifacts/<run-id>.`);
  }
  return relative;
}

function parseArgs(argv) {
  const options = {
    androidFailureReport: DEFAULT_ANDROID_BUILD_FAILURE_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: DEFAULT_RUN_ID,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--android-failure-report") {
      options.androidFailureReport = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  options.androidFailureReport = assertSafeInputReportPath(options.androidFailureReport, "--android-failure-report");
  return options;
}

function repoRelative(filePath) {
  return path.relative(ROOT, path.resolve(ROOT, filePath)).replace(/\\/g, "/");
}

function readText(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return { exists: false, value: null };
  return { exists: true, value: JSON.parse(fs.readFileSync(absolutePath, "utf8")) };
}

function fileSha256(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")}`;
}

function findExecutable(name, extraCandidates = []) {
  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.join(entry, name));
  const candidates = [...extraCandidates, ...pathEntries];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function hasLine(text, needle) {
  return text.split(/\r?\n/).some((line) => line.trim() === needle);
}

function check(id, ok, detail, next = "") {
  return { id, status: ok ? "PASS" : "FAIL", detail, next };
}

function summarize(results) {
  return {
    passCount: results.filter((entry) => entry.status === "PASS").length,
    failCount: results.filter((entry) => entry.status === "FAIL").length,
  };
}

function buildCommands() {
  return {
    androidInternalApk: "npm run eas:build:internal -- --platform android --non-interactive",
    androidProductionAab: "npm run eas:build:production -- --platform android --non-interactive",
    iosInternal: "npm run eas:build:internal -- --platform ios --non-interactive",
    iosProduction: "npm run eas:build:production -- --platform ios --non-interactive",
    releasePreflight:
      "npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/release-env-preflight-report.json",
    strictVerify:
      "npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>",
  };
}

function requiredReceipts() {
  return [
    "EAS build URL",
    "EAS build ID",
    "Git/source revision used by EAS",
    "Profile name: internal for QA APK or production for Play AAB/App Store IPA",
    "Platform: android or ios",
    "Artifact type: apk, aab, app, or ipa",
    "Artifact SHA-256 and byte size",
    "Android signing mode or iOS distribution signing summary",
    "Production env preflight report path for store artifacts",
    "Physical-device install/protection QA run ID before evidence promotion",
  ];
}

function summarizeAndroidFailure(reportPath) {
  const read = readJson(reportPath);
  if (!read.exists) {
    return {
      artifact: reportPath,
      exists: false,
      localBuildBlocked: false,
      next: "Run the local Android build helper with --report before relying on EAS fallback documentation.",
    };
  }
  const value = read.value;
  const diagnostics = value.diagnostics && typeof value.diagnostics === "object" ? value.diagnostics : {};
  const detail = String(value.releaseBoundary?.reason || value.results?.[0]?.detail || "");
  const cmakeExit137 =
    diagnostics.cmakeExit137 === true || /exit value 137|exit code 137|signal SIGKILL/i.test(detail);
  const failedTask =
    String(diagnostics.failedTask || "") || detail.match(/Execution failed for task '([^']+)'/)?.[1] || "";
  const newArchForced =
    diagnostics.reactNativeNewArchForced === true || /New Architecture enabled by default/i.test(detail);
  const localBuildBlocked = value.result === "fail" && /configureCMake/i.test(failedTask || detail);
  return {
    artifact: reportPath,
    buildResult: value.buildResult || "",
    cmakeExit137,
    exists: true,
    failedTask,
    generatedAt: value.generatedAt || "",
    localBuildBlocked,
    newArchForcedByReactNative: newArchForced,
    requestedNewArchEnabled: value.requested?.newArchEnabled,
    result: value.result || "",
    sanitized: value.sanitized === true,
    summary: value.summary || null,
  };
}

function buildHandoff(options) {
  const easJsonText = readText(EAS_JSON);
  const internalWorkflowText = readText(INTERNAL_WORKFLOW);
  const storeWorkflowText = readText(STORE_WORKFLOW);
  const easConfig = easJsonText ? JSON.parse(easJsonText) : null;
  const androidFailure = summarizeAndroidFailure(options.androidFailureReport);
  const commands = buildCommands();
  const receipts = requiredReceipts();
  const npxPath = findExecutable("npx", ["/opt/homebrew/bin/npx", "/usr/local/bin/npx"]);

  const internalAndroidBuildType = easConfig?.build?.internal?.android?.buildType || "";
  const productionAndroidBuildType = easConfig?.build?.production?.android?.buildType || "";
  const results = [
    check("eas-json-present", Boolean(easConfig), "eas.json is present and parseable."),
    check(
      "internal-android-apk-profile",
      internalAndroidBuildType === "apk",
      "EAS internal profile builds Android APK artifacts for physical QA.",
      "Set eas.json build.internal.android.buildType to apk.",
    ),
    check(
      "production-android-aab-profile",
      productionAndroidBuildType === "app-bundle",
      "EAS production profile builds Android App Bundle artifacts for Play.",
      "Set eas.json build.production.android.buildType to app-bundle.",
    ),
    check(
      "production-submit-draft-internal",
      easConfig?.submit?.production?.android?.track === "internal" &&
        easConfig?.submit?.production?.android?.releaseStatus === "draft",
      "Production submit profile is constrained to Play internal track with draft release status.",
      "Keep production submit draft/internal until strict release evidence passes.",
    ),
    check(
      "internal-workflow-manual",
      internalWorkflowText.includes("workflow_dispatch:") && hasLine(internalWorkflowText, "type: build"),
      "Internal workflow is manually triggered and contains build jobs.",
    ),
    check(
      "store-workflow-manual-no-submit",
      storeWorkflowText.includes("workflow_dispatch:") &&
        hasLine(storeWorkflowText, "type: build") &&
        !hasLine(storeWorkflowText, "type: submit"),
      "Store workflow is manually triggered, builds store artifacts, and does not auto-submit.",
    ),
    check(
      "eas-cli-runner-available",
      Boolean(npxPath),
      npxPath
        ? `npx is available for npx eas-cli@latest commands at ${repoRelative(npxPath)}.`
        : "npx is not available on PATH or the standard Homebrew locations.",
      "Install Node/npm or run the EAS build commands from an environment where npx is available.",
    ),
    check(
      "local-android-cmake-blocker-captured",
      androidFailure.localBuildBlocked && androidFailure.cmakeExit137,
      "Current local Android source build blocker is captured as CMake exit 137.",
      "Rerun npm run build:android-apk:arm64 with a sanitized --report, or use EAS after owner approval.",
    ),
    check(
      "legacy-apk-boundary-captured",
      fs.existsSync(path.join(ROOT, LEGACY_ANDROID_DOWNLOAD_APK)),
      "Legacy downloadable APK still exists only as a side-load support artifact.",
      "Do not use the legacy APK as current-source or Play upload evidence.",
    ),
  ];
  const summary = summarize(results);
  const readyForApprovedEasBuild = summary.failCount === 0;

  return {
    schema: "freed-eas-build-handoff-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    runId: options.runId,
    result: readyForApprovedEasBuild ? "ready-for-approved-eas-build" : "blocked-before-eas-build-handoff",
    readyForApprovedEasBuild,
    releaseEvidenceSatisfied: false,
    summary,
    results,
    androidFailure,
    easConfig: {
      artifact: EAS_JSON,
      sha256: fileSha256(EAS_JSON),
      internalAndroidBuildType,
      productionAndroidBuildType,
      internalDistribution: easConfig?.build?.internal?.distribution || "",
      productionChannel: easConfig?.build?.production?.channel || "",
      productionSubmitTrack: easConfig?.submit?.production?.android?.track || "",
      productionSubmitReleaseStatus: easConfig?.submit?.production?.android?.releaseStatus || "",
    },
    workflows: {
      internal: {
        artifact: INTERNAL_WORKFLOW,
        exists: Boolean(internalWorkflowText),
        sha256: fileSha256(INTERNAL_WORKFLOW),
      },
      store: {
        artifact: STORE_WORKFLOW,
        exists: Boolean(storeWorkflowText),
        sha256: fileSha256(STORE_WORKFLOW),
      },
    },
    cli: {
      npxAvailable: Boolean(npxPath),
      npxPath: npxPath ? repoRelative(npxPath) : "",
      easCliInvocation: "npx eas-cli@latest",
    },
    commands,
    requiredReceipts: receipts,
    postBuildEvidence: {
      androidInternalApk:
        "Install the EAS internal Android APK on physical hardware, then run qa:android-install and evidence:android-real-browser against the same device.",
      androidProductionAab:
        "Use the EAS production Android AAB only for Play internal/draft upload after production env, AdMob, purchase verification, and store sandbox gates pass.",
      iosInternal:
        "Use the EAS internal iOS build for entitlement-approved physical-device Screen Time/Safari validation.",
      iosProduction:
        "Use the EAS production iOS artifact for TestFlight/App Store Connect only after strict release evidence passes.",
    },
    releaseBoundary:
      "EAS handoff only. This report does not prove an EAS build was run, that artifacts exist, that stores accepted uploads, or that physical-device protection evidence passed.",
  };
}

function buildMarkdown(report) {
  const lines = [
    "# FREED EAS Build Handoff",
    "",
    `Generated: ${report.generatedAt}`,
    `Result: ${report.result}`,
    `Ready for approved EAS build: ${report.readyForApprovedEasBuild}`,
    "",
    "## Local Android Blocker",
    "",
    `- Report: \`${report.androidFailure.artifact}\``,
    `- Result: ${report.androidFailure.result || "missing"}`,
    `- Failed task: \`${report.androidFailure.failedTask || "unknown"}\``,
    `- CMake exit 137: ${report.androidFailure.cmakeExit137}`,
    `- React Native forced New Architecture: ${report.androidFailure.newArchForcedByReactNative}`,
    "",
    "## EAS Commands",
    "",
    `- CLI invocation: \`${report.cli.easCliInvocation}\``,
    `- npx available: ${report.cli.npxAvailable}${report.cli.npxPath ? ` (\`${report.cli.npxPath}\`)` : ""}`,
    `- Android internal APK: \`${report.commands.androidInternalApk}\``,
    `- Android Play AAB: \`${report.commands.androidProductionAab}\``,
    `- iOS internal: \`${report.commands.iosInternal}\``,
    `- iOS production: \`${report.commands.iosProduction}\``,
    "",
    "## Required Receipts",
    "",
    ...report.requiredReceipts.map((receipt) => `- ${receipt}`),
    "",
    "## Checks",
    "",
    ...report.results.map((result) => `- ${result.status}: ${result.id} - ${result.detail}`),
    "",
    `Boundary: ${report.releaseBoundary}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function writeOutputs(options, report) {
  const outputDir = path.join(ROOT, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, DEFAULT_REPORT_NAME);
  const markdownPath = path.join(outputDir, DEFAULT_MARKDOWN_NAME);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, buildMarkdown(report));
  return {
    markdownArtifact: repoRelative(markdownPath),
    reportArtifact: repoRelative(reportPath),
  };
}

function runSelfTest() {
  assert.equal(safeRunId("eas-build-current"), "eas-build-current");
  assert.throws(() => safeRunId("../bad"), /Run id/);
  assert.throws(() => parseArgs(["--output-dir", "docs/validation/evidence/eas"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--android-failure-report", "docs/release-blockers.md"]), /docs\/validation\/artifacts/);
  const diagnostics = summarizeAndroidFailure(DEFAULT_ANDROID_BUILD_FAILURE_REPORT);
  assert.equal(typeof diagnostics.exists, "boolean");
  const report = buildHandoff(parseArgs(["--run-id", "self-test"]));
  assert.equal(report.schema, "freed-eas-build-handoff-v1");
  assert.equal(report.sanitized, true);
  assert.equal(report.releaseEvidenceSatisfied, false);
  assert.equal(typeof report.cli.npxAvailable, "boolean");
  assert.equal(report.cli.easCliInvocation, "npx eas-cli@latest");
  assert.ok(report.commands.androidInternalApk.includes("--platform android"));
  assert.ok(report.requiredReceipts.includes("EAS build URL"));
  assert.match(buildMarkdown(report), /FREED EAS Build Handoff/);
  console.log("eas build handoff self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const report = buildHandoff(options);
  const written = writeOutputs(options, report);
  console.log(
    JSON.stringify(
      {
        artifact: written.reportArtifact,
        markdownArtifact: written.markdownArtifact,
        result: report.result,
        readyForApprovedEasBuild: report.readyForApprovedEasBuild,
        schema: report.schema,
        sanitized: report.sanitized,
      },
      null,
      2,
    ),
  );
  if (report.summary.failCount > 0) process.exit(1);
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
  buildHandoff,
  buildMarkdown,
  parseArgs,
  safeRunId,
  summarizeAndroidFailure,
};
