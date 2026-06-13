#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_ID = "eas-build-current";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/eas-build-current";
const DEFAULT_REPORT_NAME = "eas-build-attempt.json";
const DEFAULT_MARKDOWN_NAME = "EAS_BUILD_ATTEMPT.md";
const STATUSES = new Set([
  "blocked-not-logged-in",
  "blocked-cli-error",
  "submitted",
  "completed",
  "failed",
]);
const COMMANDS = Object.freeze({
  "android-internal-apk": {
    artifactType: "apk",
    buildCommand: "npm run eas:build:internal -- --platform android --non-interactive",
    platform: "android",
    profile: "internal",
    purpose: "Current-source Android APK for physical QA.",
  },
  "android-production-aab": {
    artifactType: "aab",
    buildCommand: "npm run eas:build:production -- --platform android --non-interactive",
    platform: "android",
    profile: "production",
    purpose: "Android App Bundle for Play internal/draft handoff after production gates pass.",
  },
  "ios-internal": {
    artifactType: "app",
    buildCommand: "npm run eas:build:internal -- --platform ios --non-interactive",
    platform: "ios",
    profile: "internal",
    purpose: "iOS internal build for entitlement-approved physical QA.",
  },
  "ios-production": {
    artifactType: "ipa",
    buildCommand: "npm run eas:build:production -- --platform ios --non-interactive",
    platform: "ios",
    profile: "production",
    purpose: "iOS production/TestFlight/App Store artifact after strict gates pass.",
  },
});

function printHelp() {
  console.log(`Usage: npm run evidence:eas-build-attempt -- [options]

Writes a sanitized EAS build attempt receipt. This records whether a networked
EAS auth/build attempt was blocked, submitted, completed, or failed. It does
not store account IDs, emails, access tokens, raw terminal output, or secrets.

Options:
  --run-id <id>                  Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --output-dir <path>            Artifact output folder. Default: ${DEFAULT_OUTPUT_DIR}
  --command-id <id>              One of: ${Object.keys(COMMANDS).join(", ")}
                                 Default: android-internal-apk
  --attempt-type <auth-check|build>
                                 Default: auth-check
  --status <status>              One of: ${[...STATUSES].join(", ")}
  --exit-code <number>           Sanitized CLI exit code. Default: 1
  --observed-message-code <code> Short sanitized code, e.g. not-logged-in.
  --build-url <url>              EAS build URL for submitted/completed builds.
  --build-id <id>                EAS build ID for submitted/completed builds.
  --source-revision <revision>   Git/source revision used by EAS.
  --artifact-sha256 <sha256>     Artifact hash for completed builds.
  --artifact-size-bytes <bytes>  Artifact byte size for completed builds.
  --signing-summary <summary>    Short sanitized signing summary.
  --preflight-report <path>      Sanitized production preflight report path.
  --physical-qa-run-id <id>      Follow-up physical QA run id.
  --self-test                    Run offline checks.
  --help, -h                     Show this help.
`);
}

function safeRunId(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function safeShortCode(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error(`${label} may only contain letters, numbers, dots, dashes, underscores, and colons.`);
  }
  return normalized;
}

function safeSummary(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (
    normalized.length > 160 ||
    normalized.includes("\0") ||
    normalized.includes("\n") ||
    normalized.includes("\r") ||
    /[;&|`$<>]/.test(normalized)
  ) {
    throw new Error(`${label} must be a short sanitized summary without shell syntax.`);
  }
  if (/@/.test(normalized) || /\b[A-Za-z]:\\/.test(normalized) || /\/Users\//.test(normalized)) {
    throw new Error(`${label} must not include account identifiers or local profile paths.`);
  }
  return normalized;
}

function safeArtifactReportPath(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error(`${label} must be a plain JSON path.`);
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

function safeBuildUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("--build-url must be a valid https://expo.dev or https://eas.build URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("--build-url must be a clean HTTPS URL without credentials, query, or fragment.");
  }
  if (!["expo.dev", "eas.build"].includes(parsed.hostname)) {
    throw new Error("--build-url must point to expo.dev or eas.build.");
  }
  return parsed.toString();
}

function safeSha256(value) {
  const normalized = String(value || "").trim().replace(/^sha256-/i, "");
  if (!normalized) return "";
  if (!/^[a-f0-9]{64}$/i.test(normalized)) throw new Error("--artifact-sha256 must be a SHA-256 hex digest.");
  return `sha256-${normalized.toLowerCase()}`;
}

function safePositiveInteger(value, label, defaultValue = 0) {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    artifactSha256: "",
    artifactSizeBytes: 0,
    attemptType: "auth-check",
    buildId: "",
    buildUrl: "",
    commandId: "android-internal-apk",
    exitCode: 1,
    observedMessageCode: "",
    outputDir: DEFAULT_OUTPUT_DIR,
    physicalQaRunId: "",
    preflightReport: "",
    runId: DEFAULT_RUN_ID,
    selfTest: false,
    signingSummary: "",
    sourceRevision: "",
    status: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--run-id") options.runId = safeRunId(next());
    else if (arg === "--output-dir") options.outputDir = next();
    else if (arg === "--command-id") options.commandId = next();
    else if (arg === "--attempt-type") options.attemptType = next();
    else if (arg === "--status") options.status = next();
    else if (arg === "--exit-code") options.exitCode = safePositiveInteger(next(), "--exit-code");
    else if (arg === "--observed-message-code") options.observedMessageCode = safeShortCode(next(), arg);
    else if (arg === "--build-url") options.buildUrl = safeBuildUrl(next());
    else if (arg === "--build-id") options.buildId = safeShortCode(next(), arg);
    else if (arg === "--source-revision") options.sourceRevision = safeShortCode(next(), arg);
    else if (arg === "--artifact-sha256") options.artifactSha256 = safeSha256(next());
    else if (arg === "--artifact-size-bytes")
      options.artifactSizeBytes = safePositiveInteger(next(), "--artifact-size-bytes");
    else if (arg === "--signing-summary") options.signingSummary = safeSummary(next(), arg);
    else if (arg === "--preflight-report") options.preflightReport = safeArtifactReportPath(next(), arg);
    else if (arg === "--physical-qa-run-id") options.physicalQaRunId = safeRunId(next());
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) return options;
  if (!COMMANDS[options.commandId]) {
    throw new Error(`--command-id must be one of: ${Object.keys(COMMANDS).join(", ")}.`);
  }
  if (!["auth-check", "build"].includes(options.attemptType)) {
    throw new Error("--attempt-type must be auth-check or build.");
  }
  if (!STATUSES.has(options.status)) {
    throw new Error(`--status must be one of: ${[...STATUSES].join(", ")}.`);
  }
  return options;
}

function repoRelative(filePath) {
  return path.relative(ROOT, path.resolve(ROOT, filePath)).replace(/\\/g, "/");
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

function buildReport(options) {
  const command = COMMANDS[options.commandId];
  const authBlocked = options.status === "blocked-not-logged-in";
  const submitted = ["submitted", "completed", "failed"].includes(options.status);
  const completed = options.status === "completed";
  const receiptsComplete =
    completed &&
    Boolean(
      options.buildUrl &&
        options.buildId &&
        options.sourceRevision &&
        options.artifactSha256 &&
        options.artifactSizeBytes > 0 &&
        options.signingSummary,
    );
  const results = [
    check(
      "eas-authenticated",
      !authBlocked,
      authBlocked
        ? "EAS CLI auth check reported not logged in before an EAS build could start."
        : "EAS CLI auth did not report a not-logged-in blocker.",
      "Run npx eas-cli@latest login in the Expo account that owns FREED, then rerun the target EAS build command.",
    ),
    check(
      "eas-build-request-submitted",
      submitted,
      submitted ? "EAS build request reached the remote build service." : "EAS build request was not submitted.",
      command.buildCommand,
    ),
    check(
      "eas-build-receipts-complete",
      receiptsComplete,
      receiptsComplete
        ? "EAS build URL, build ID, source revision, artifact hash/size, and signing summary are present."
        : "Completed-build receipts are not complete yet.",
      "After EAS completes, record build URL, build ID, source revision, artifact SHA-256, byte size, and signing summary.",
    ),
  ];
  const summary = summarize(results);
  const readyForCurrentSourceArtifact = completed && receiptsComplete && summary.failCount === 0;
  const result = readyForCurrentSourceArtifact
    ? "current-source-artifact-receipts-complete"
    : options.status === "blocked-not-logged-in"
      ? "blocked-before-eas-build-auth"
      : options.status === "blocked-cli-error"
        ? "blocked-before-eas-build-cli"
        : options.status === "submitted"
          ? "eas-build-submitted-waiting-for-receipts"
          : options.status === "failed"
            ? "eas-build-failed"
            : "eas-build-receipts-incomplete";
  return {
    schema: "freed-eas-build-attempt-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    runId: options.runId,
    result,
    readyForCurrentSourceArtifact,
    releaseEvidenceSatisfied: false,
    status: options.status,
    attemptType: options.attemptType,
    exitCode: options.exitCode,
    observedMessageCode: options.observedMessageCode,
    target: {
      artifactType: command.artifactType,
      commandId: options.commandId,
      platform: command.platform,
      profile: command.profile,
      purpose: command.purpose,
    },
    commands: {
      authCheck: "npx eas-cli@latest whoami --non-interactive",
      build: command.buildCommand,
      login: "npx eas-cli@latest login",
    },
    receipts: {
      artifactSha256: options.artifactSha256,
      artifactSizeBytes: options.artifactSizeBytes,
      buildId: options.buildId,
      buildUrl: options.buildUrl,
      physicalQaRunId: options.physicalQaRunId,
      preflightReport: options.preflightReport,
      signingSummary: options.signingSummary,
      sourceRevision: options.sourceRevision,
    },
    summary,
    results,
    nextActions: authBlocked
      ? [
          "Run npx eas-cli@latest login with the Expo account that owns the FREED EAS project.",
          `Retry ${command.buildCommand}.`,
          "After the build starts, rerun this receipt with status submitted or completed and the EAS build URL/ID.",
        ]
      : [
          "Wait for the EAS build to finish.",
          "Record the build URL, build ID, source revision, artifact SHA-256, byte size, and signing summary.",
          "Use the artifact only for physical QA until strict release evidence passes.",
        ],
    releaseBoundary:
      "EAS build attempt receipt only. This does not prove an artifact exists, was installed on a physical device, passed protection QA, was uploaded to a store, or passed release evidence.",
  };
}

function buildMarkdown(report) {
  const lines = [
    "# FREED EAS Build Attempt",
    "",
    `Generated: ${report.generatedAt}`,
    `Result: ${report.result}`,
    `Ready for current-source artifact: ${report.readyForCurrentSourceArtifact}`,
    `Release evidence satisfied: ${report.releaseEvidenceSatisfied}`,
    "",
    "## Target",
    "",
    `- Platform: ${report.target.platform}`,
    `- Profile: ${report.target.profile}`,
    `- Artifact type: ${report.target.artifactType}`,
    `- Build command: \`${report.commands.build}\``,
    "",
    "## Attempt",
    "",
    `- Status: ${report.status}`,
    `- Attempt type: ${report.attemptType}`,
    `- Exit code: ${report.exitCode}`,
    `- Observed message code: ${report.observedMessageCode || "none"}`,
    "",
    "## Checks",
    "",
    ...report.results.map((result) => `- ${result.status}: ${result.id} - ${result.detail}`),
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Boundary",
    "",
    report.releaseBoundary,
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
  assert.throws(() => parseArgs(["--status", "blocked-not-logged-in", "--output-dir", "docs/validation/evidence/eas"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--status", "blocked-not-logged-in", "--build-url", "https://example.com/build"]), /expo\.dev|eas\.build/);
  const blocked = buildReport(
    parseArgs([
      "--status",
      "blocked-not-logged-in",
      "--exit-code",
      "1",
      "--observed-message-code",
      "not-logged-in",
    ]),
  );
  assert.equal(blocked.schema, "freed-eas-build-attempt-v1");
  assert.equal(blocked.result, "blocked-before-eas-build-auth");
  assert.equal(blocked.readyForCurrentSourceArtifact, false);
  assert.equal(blocked.releaseEvidenceSatisfied, false);
  assert.match(buildMarkdown(blocked), /EAS Build Attempt/);
  const complete = buildReport(
    parseArgs([
      "--status",
      "completed",
      "--exit-code",
      "0",
      "--build-url",
      "https://expo.dev/accounts/freed/projects/freed/builds/build123",
      "--build-id",
      "build123",
      "--source-revision",
      "abcdef1",
      "--artifact-sha256",
      "a".repeat(64),
      "--artifact-size-bytes",
      "123456",
      "--signing-summary",
      "android-internal-debuggable-false",
    ]),
  );
  assert.equal(complete.readyForCurrentSourceArtifact, true);
  console.log("eas build attempt report self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const report = buildReport(options);
  const written = writeOutputs(options, report);
  console.log(
    JSON.stringify(
      {
        artifact: written.reportArtifact,
        markdownArtifact: written.markdownArtifact,
        result: report.result,
        readyForCurrentSourceArtifact: report.readyForCurrentSourceArtifact,
        schema: report.schema,
        sanitized: report.sanitized,
      },
      null,
      2,
    ),
  );
  if (report.summary.failCount > 0 && !["blocked-before-eas-build-auth", "blocked-before-eas-build-cli"].includes(report.result)) {
    process.exit(1);
  }
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
  buildMarkdown,
  buildReport,
  parseArgs,
  safeRunId,
};
