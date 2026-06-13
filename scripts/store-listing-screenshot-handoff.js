#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_ID = "store-listing-screenshots-current";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/store-listing-screenshots-current";
const DEFAULT_REPORT_NAME = "store-listing-screenshot-handoff.json";
const DEFAULT_MARKDOWN_NAME = "STORE_LISTING_SCREENSHOT_HANDOFF.md";
const PLAN_PATH = "store/screenshots/listing-screenshot-plan.md";
const TEMPLATE_PATH = "store/screenshots/listing/manifest.template.json";
const FINAL_MANIFEST_PATH = "store/screenshots/listing/manifest.json";
const EAS_HANDOFF_PATH = "docs/validation/artifacts/eas-build-current/eas-build-handoff.json";
const EXPECTED_IDS = [
  "turn-on-real-protection",
  "block-adult-sites-safely",
  "interrupt-app-loops",
  "recover-in-the-moment",
  "keep-privacy-local",
  "upgrade-without-ad-breaks",
];
const REQUIRED_FIELDS = [
  "id",
  "platform",
  "deviceClass",
  "sourceBuild",
  "sourceCapturePath",
  "finalAssetPath",
  "headline",
  "screen",
  "width",
  "height",
  "sha256",
  "reviewBoundary",
];

function printHelp() {
  console.log(`Usage: npm run evidence:store-listing-screenshots -- [options]

Writes a sanitized handoff for final App Store / Play listing screenshot
capture. It does not generate fake screenshots, create the final manifest,
or mark store upload readiness as passing.

Options:
  --run-id <id>        Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --output-dir <path>  Artifact output folder. Default: ${DEFAULT_OUTPUT_DIR}
  --self-test          Run offline checks.
  --help, -h           Show this help.
`);
}

function safeRunId(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function parseArgs(argv) {
  const options = {
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
    if (arg === "--output-dir") options.outputDir = next();
    else if (arg === "--run-id") options.runId = safeRunId(next());
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
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

function hasExactSet(values, expected) {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function missingFields(asset, allowCapturePlaceholders = false) {
  return REQUIRED_FIELDS.filter((field) => {
    if (allowCapturePlaceholders && ["sourceBuild", "sourceCapturePath", "finalAssetPath", "sha256"].includes(field)) {
      return false;
    }
    const value = asset?.[field];
    if (field === "width" || field === "height") return !Number.isFinite(Number(value)) || Number(value) <= 0;
    return typeof value !== "string" || !value.trim();
  });
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

function captureRows(template) {
  const assets = Array.isArray(template?.assets) ? template.assets : [];
  return assets.map((asset) => ({
    deviceClass: asset.deviceClass || "",
    finalAssetPath: asset.finalAssetPath || "",
    headline: asset.headline || "",
    height: Number(asset.height || 0),
    id: asset.id || "",
    platform: asset.platform || "",
    reviewBoundary: asset.reviewBoundary || "",
    screen: asset.screen || "",
    sourceBuild: asset.sourceBuild || "",
    sourceCapturePath: asset.sourceCapturePath || "",
    width: Number(asset.width || 0),
  }));
}

function buildHandoff(options) {
  const planText = readText(PLAN_PATH);
  const templateRead = readJson(TEMPLATE_PATH);
  const finalManifestExists = fs.existsSync(path.join(ROOT, FINAL_MANIFEST_PATH));
  const easRead = readJson(EAS_HANDOFF_PATH);
  const template = templateRead.value;
  const rows = captureRows(template);
  const ids = rows.map((row) => row.id).filter(Boolean);
  const finalManifestStatus = finalManifestExists ? "present-validate-with-store-catalog-audit" : "pending-signed-build-capture";
  const easReady = easRead.exists && easRead.value?.readyForApprovedEasBuild === true;
  const templateCaptureFieldsOk =
    template?.schemaVersion === "freed-store-listing-screenshot-template-v1" &&
    template?.finalManifestPath === FINAL_MANIFEST_PATH &&
    hasExactSet(ids, EXPECTED_IDS) &&
    rows.every((row) => missingFields(row, true).length === 0);
  const planConceptsPresent = EXPECTED_IDS.every((id) => {
    const row = rows.find((asset) => asset.id === id);
    return row && planText.includes(row.headline);
  });
  const results = [
    check("listing-plan-present", planText.includes("FREED Store Listing Screenshot Plan"), "Listing screenshot plan exists."),
    check(
      "listing-copy-concepts-present",
      planConceptsPresent,
      "Listing plan/template cover the six approved public listing concepts.",
      "Update listing-screenshot-plan.md and manifest.template.json so they agree on every concept.",
    ),
    check(
      "listing-template-valid-for-capture",
      templateCaptureFieldsOk,
      "Listing screenshot template has required concept, dimension, headline, screen, and review-boundary fields.",
      "Fix store/screenshots/listing/manifest.template.json before capture.",
    ),
    check(
      "signed-build-dependency-ready",
      easReady,
      "EAS current-source build handoff is ready for an approved signed-build capture.",
      "Run npm run evidence:eas-build-handoff before final listing screenshots.",
    ),
    check(
      "final-manifest-not-faked",
      !finalManifestExists,
      "Final listing manifest is still absent, so no fake public screenshots are being treated as upload-ready.",
      "If final screenshots were captured, validate store/screenshots/listing/manifest.json with npm run audit:store-catalog.",
    ),
  ];
  const summary = summarize(results);
  const readyForSignedBuildCapture = summary.failCount === 0;
  return {
    schema: "freed-store-listing-screenshot-handoff-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    runId: options.runId,
    result: readyForSignedBuildCapture ? "ready-for-signed-build-capture" : "blocked-before-listing-capture",
    readyForSignedBuildCapture,
    readyForStoreUpload: false,
    releaseEvidenceSatisfied: false,
    finalManifestPath: FINAL_MANIFEST_PATH,
    finalManifestExists,
    finalManifestStatus,
    summary,
    results,
    sourceArtifacts: {
      easBuildHandoff: { path: EAS_HANDOFF_PATH, exists: easRead.exists, sha256: fileSha256(EAS_HANDOFF_PATH) },
      plan: { path: PLAN_PATH, sha256: fileSha256(PLAN_PATH) },
      template: { path: TEMPLATE_PATH, sha256: fileSha256(TEMPLATE_PATH) },
    },
    captureRows: rows,
    captureCommands: {
      refreshEasHandoff:
        "npm run evidence:eas-build-handoff -- --run-id eas-build-current --output-dir docs/validation/artifacts/eas-build-current",
      validateCatalog:
        "npm run audit:store-catalog -- --report docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json",
      refreshLaunchStatus:
        "npm run status:launch -- --run-id launch-status --output-dir docs/validation/artifacts/launch-status-current",
    },
    manifestRequirements: REQUIRED_FIELDS,
    releaseBoundary:
      "Store listing screenshot capture handoff only. This does not prove final screenshots exist, are from a signed build, were uploaded to stores, or satisfy physical-device protection evidence.",
  };
}

function buildMarkdown(report) {
  const lines = [
    "# FREED Store Listing Screenshot Handoff",
    "",
    `Generated: ${report.generatedAt}`,
    `Result: ${report.result}`,
    `Ready for signed-build capture: ${report.readyForSignedBuildCapture}`,
    `Ready for store upload: ${report.readyForStoreUpload}`,
    `Final manifest: \`${report.finalManifestPath}\``,
    `Final manifest status: ${report.finalManifestStatus}`,
    "",
    "## Capture Rows",
    "",
    ...report.captureRows.map(
      (row) => `- ${row.id}: ${row.headline} - ${row.screen}, ${row.width}x${row.height}`,
    ),
    "",
    "## Commands",
    "",
    `- Refresh EAS handoff: \`${report.captureCommands.refreshEasHandoff}\``,
    `- Validate final catalog: \`${report.captureCommands.validateCatalog}\``,
    `- Refresh launch status: \`${report.captureCommands.refreshLaunchStatus}\``,
    "",
    "## Checks",
    "",
    ...report.results.map((result) => `- ${result.status}: ${result.id} - ${result.detail}`),
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
  assert.equal(safeRunId("store-listing-current"), "store-listing-current");
  assert.throws(() => safeRunId("../bad"), /Run id/);
  assert.throws(() => parseArgs(["--output-dir", "docs/validation/evidence/listing"]), /docs\/validation\/evidence/);
  assert.equal(hasExactSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactSet(["a", "b", "b"], ["a", "b"]), false);
  const report = buildHandoff(parseArgs(["--run-id", "self-test"]));
  assert.equal(report.schema, "freed-store-listing-screenshot-handoff-v1");
  assert.equal(report.sanitized, true);
  assert.equal(report.releaseEvidenceSatisfied, false);
  assert.equal(report.readyForStoreUpload, false);
  assert.equal(report.finalManifestPath, FINAL_MANIFEST_PATH);
  assert.ok(report.captureRows.length >= 6);
  assert.match(buildMarkdown(report), /Store Listing Screenshot Handoff/);
  console.log("store listing screenshot handoff self-test: pass");
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
        readyForSignedBuildCapture: report.readyForSignedBuildCapture,
        readyForStoreUpload: report.readyForStoreUpload,
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
};
