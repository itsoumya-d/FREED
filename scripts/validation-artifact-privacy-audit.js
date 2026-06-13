#!/usr/bin/env node

const assert = require("node:assert/strict");
const { existsSync, readFileSync, readdirSync, statSync, writeFileSync } = require("node:fs");
const { extname, join, relative } = require("node:path");
const {
  hasLocalHomePath,
  runSelfTest: runLocalPathPrivacySelfTest,
  sanitizeLocalHomePaths,
} = require("./lib/local-path-privacy");

const root = process.cwd();
const artifactRoot = join(root, "docs", "validation", "artifacts");
const checkedExtensions = new Set([".json", ".md", ".txt"]);
const rawAppleDeviceNamePattern =
  /\b(?!Physical\b)(?!Codex\b)[A-Za-z][A-Za-z0-9 ._'’:-]{0,40}[’']s\s+(?:iPhone|iPad|iPod|MacBook|Mac|Apple Watch)\b/gu;
const rawCoreDeviceHostPattern = /\b[A-Za-z0-9._-]+-(?:iPhone|iPad|iPod)\.coredevice\.local\b/giu;
const rawAppleDeviceIdentifierJsonPattern =
  /"(?:identifier|deviceIdentifier|udid)"\s*:\s*"(?:[0-9A-F]{8}-[0-9A-F]{16}|[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12})"/giu;
const rawAppleDeviceIdentifierListPattern =
  /\|\s*(?:[0-9A-F]{8}-[0-9A-F]{16}|[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12})\s*\|\s*(?:physical|simulator|non-ios)\b/giu;

function printHelp() {
  console.log(`Usage: node -- scripts/validation-artifact-privacy-audit.js [options]

Audits checked validation artifact JSON/Markdown/text files for local
user-profile paths and raw Apple device names, identifiers, and CoreDevice
hostnames that must not appear in shareable release evidence.

Options:
  --fix        Rewrite local home paths to ~-relative paths.
  --self-test  Run offline parser and sanitizer checks.
  --help, -h   Show this help.
`);
}

function parseArgs(argv) {
  const options = { fix: false, selfTest: false };
  for (const arg of argv) {
    if (arg === "--fix") options.fix = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function listCandidateFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listCandidateFiles(path));
    } else if (stat.isFile() && checkedExtensions.has(extname(path))) {
      files.push(path);
    }
  }
  return files.sort();
}

function auditFiles(files, options) {
  const failedLocalPaths = [];
  const failedDeviceNames = [];
  const fixed = [];

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const hasRawDeviceName = hasRawAppleDeviceName(before);

    if (hasRawDeviceName) {
      failedDeviceNames.push(file);
    }

    if (!hasLocalHomePath(before)) {
      continue;
    }

    if (!options.fix) {
      failedLocalPaths.push(file);
      continue;
    }

    const after = sanitizeLocalHomePaths(before);
    if (after !== before) {
      writeFileSync(file, after);
      fixed.push(file);
    }
    if (hasLocalHomePath(after)) failedLocalPaths.push(file);
  }

  return { failedDeviceNames, failedLocalPaths, fixed };
}

function hasRawAppleDeviceName(value) {
  rawAppleDeviceNamePattern.lastIndex = 0;
  rawCoreDeviceHostPattern.lastIndex = 0;
  rawAppleDeviceIdentifierJsonPattern.lastIndex = 0;
  rawAppleDeviceIdentifierListPattern.lastIndex = 0;
  return (
    rawAppleDeviceNamePattern.test(value) ||
    rawCoreDeviceHostPattern.test(value) ||
    rawAppleDeviceIdentifierJsonPattern.test(value) ||
    rawAppleDeviceIdentifierListPattern.test(value)
  );
}

function renderReport(files, result) {
  const localPathPassed = result.failedLocalPaths.length === 0;
  const deviceNamePassed = result.failedDeviceNames.length === 0;
  const passCount = [localPathPassed, deviceNamePassed].filter(Boolean).length;
  const failCount = [localPathPassed, deviceNamePassed].filter((passed) => !passed).length;
  console.log("# FREED validation artifact privacy");
  console.log(`Result: ${passCount} pass, ${failCount} fail`);
  console.log("");
  console.log("| Status | Gate | Evidence | Next |");
  console.log("| --- | --- | --- | --- |");
  if (localPathPassed) {
    const fixedNote = result.fixed.length > 0 ? ` Fixed ${result.fixed.length} artifact file(s).` : "";
    console.log(
      `| PASS | checked-artifact-local-paths | Scanned ${files.length} JSON/Markdown/text validation artifact file(s); no local home-profile paths remain.${fixedNote} |  |`
    );
  } else {
    const evidence = result.failedLocalPaths.map((file) => relative(root, file)).join(", ");
    console.log(
      `| FAIL | checked-artifact-local-paths | Local home-profile paths remain in: ${evidence}. | Run node -- scripts/validation-artifact-privacy-audit.js --fix and review the artifact diff. |`
    );
  }
  if (deviceNamePassed) {
    console.log(
      `| PASS | checked-artifact-apple-device-names | Scanned ${files.length} JSON/Markdown/text validation artifact file(s); no raw Apple device names, identifiers, or CoreDevice hostnames remain. |  |`
    );
  } else {
    const evidence = result.failedDeviceNames.map((file) => relative(root, file)).join(", ");
    console.log(
      `| FAIL | checked-artifact-apple-device-names | Raw Apple device names, identifiers, or CoreDevice hostnames remain in: ${evidence}. | Regenerate the artifact with redacted device names and identifiers, or replace stale xctrace/devicectl output with a sanitized handoff. |`
    );
  }
}

function runSelfTest() {
  runLocalPathPrivacySelfTest();
  assert.equal(hasLocalHomePath('{"path": "~/Downloads/FREED.apk"}'), false);
  assert.equal(hasRawAppleDeviceName("Physical iPhone (26.5)"), false);
  assert.equal(hasRawAppleDeviceName("Codex iPad Pro 13-inch (M5) Simulator"), false);
  assert.equal(hasRawAppleDeviceName("Tester's iPhone (26.5)"), true);
  assert.equal(hasRawAppleDeviceName("Testers-iPhone.coredevice.local"), true);
  assert.equal(hasRawAppleDeviceName('"identifier": "00008140-001D78D62ED0801C"'), true);
  assert.equal(hasRawAppleDeviceName("- Physical iPhone | iOS 26.5 | 00008140-001D78D62ED0801C | physical | devices offline"), true);
  assert.equal(hasRawAppleDeviceName('"identifier": "physical-ios-device-1"'), false);
  console.log("validation artifact privacy self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const files = listCandidateFiles(artifactRoot);
  const result = auditFiles(files, options);
  renderReport(files, result);
  if (result.failedLocalPaths.length > 0 || result.failedDeviceNames.length > 0) process.exitCode = 1;
}

main();
