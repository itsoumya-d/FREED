const assert = require("node:assert/strict");
const { dirname, isAbsolute, relative, resolve } = require("node:path");
const { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { isPathInsideOrSame } = require("./workspace-path-safety");

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function existingReportPathIssue(artifactRoot, reportPath) {
  const rootStat = lstatOrNull(artifactRoot);
  if (!rootStat) return null;
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return "--report artifact root must be a real docs/validation/artifacts directory.";
  }

  const reportParent = dirname(reportPath);
  let current = artifactRoot;
  for (const segment of relative(artifactRoot, reportParent).split(/[\\/]+/)) {
    if (!segment) continue;
    current = resolve(current, segment);
    const stat = lstatOrNull(current);
    if (!stat) return null;
    if (stat.isSymbolicLink()) {
      return "--report path must not include symbolic links.";
    }
    if (!stat.isDirectory()) {
      return "--report existing path components must be directories.";
    }
  }

  const reportStat = lstatOrNull(reportPath);
  if (!reportStat) return null;
  if (reportStat.isSymbolicLink()) {
    return "--report path must not be a symbolic link.";
  }
  if (!reportStat.isFile()) {
    return "--report path must be a JSON file.";
  }

  return null;
}

function reportPathIssue(value, label = "--report") {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (
    !trimmed ||
    trimmed !== raw ||
    !/^[A-Za-z0-9._~/-]+$/.test(trimmed) ||
    normalized.startsWith("-") ||
    normalized.includes("://") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("todo") ||
    normalized.includes("<") ||
    normalized.includes(">")
  ) {
    return `${label} must be a local workspace path without shell syntax, URLs, flags, or template placeholders.`;
  }

  const absolute = resolve(process.cwd(), trimmed);
  const workspaceRelativePath = relative(process.cwd(), absolute);
  if (workspaceRelativePath.startsWith("..") || isAbsolute(workspaceRelativePath)) {
    return `${label} must stay inside the current workspace.`;
  }

  const releaseEvidenceDir = resolve(process.cwd(), "docs/validation/evidence");
  if (isPathInsideOrSame(releaseEvidenceDir, absolute)) {
    return `${label} must not be written to docs/validation/evidence; use docs/validation/artifacts/<run-id>.`;
  }

  if (!trimmed.endsWith(".json")) {
    return `${label} must end in .json.`;
  }

  const artifactRoot = resolve(process.cwd(), "docs/validation/artifacts");
  const artifactRelativePath = relative(artifactRoot, absolute);
  if (artifactRelativePath === "" || artifactRelativePath.startsWith("..") || isAbsolute(artifactRelativePath)) {
    return `${label} must be under docs/validation/artifacts/<run-id>.`;
  }
  const artifactSegments = artifactRelativePath.split(/[\\/]+/).filter(Boolean);
  if (artifactSegments.length < 2) {
    return `${label} must be under docs/validation/artifacts/<run-id>.`;
  }

  const existingPathIssue = existingReportPathIssue(artifactRoot, absolute);
  if (existingPathIssue) return existingPathIssue.replace(/^--report/, label);

  return null;
}

function assertSafeReportPath(value, label = "--report") {
  const issue = reportPathIssue(value, label);
  if (issue) throw new Error(issue);
  return resolve(process.cwd(), String(value).trim());
}

function isSafeReportPath(value, label = "--report") {
  return reportPathIssue(value, label) === null;
}

function runSelfTest() {
  assert.equal(isSafeReportPath("docs/validation/artifacts/self-test/report.json"), true);
  assert.match(reportPathIssue("https://example.com/report.json"), /local workspace path/);
  assert.match(reportPathIssue("../report.json"), /inside the current workspace/);
  assert.match(reportPathIssue("docs/validation/evidence/report.json"), /docs\/validation\/evidence/);
  assert.match(reportPathIssue("DOCS/VALIDATION/EVIDENCE/report.json"), /docs\/validation\/evidence/);
  assert.match(reportPathIssue("docs/validation/evidence/../evidence/report.json"), /docs\/validation\/evidence/);
  assert.match(reportPathIssue("docs/validation/artifacts/report.json"), /docs\/validation\/artifacts\/<run-id>/);
  assert.match(reportPathIssue("screenshots/report.json"), /docs\/validation\/artifacts\/<run-id>/);
  assert.match(reportPathIssue("docs/validation/artifacts/self-test/report.txt"), /\.json/);
  assert.throws(() => assertSafeReportPath("docs/validation/evidence/report.json"), /docs\/validation\/evidence/);

  const tempRoot = mkdtempSync(resolve(process.cwd(), "docs/validation/artifacts/report-path-safety-self-test-"));
  try {
    const fileComponent = resolve(tempRoot, "not-a-dir");
    writeFileSync(fileComponent, "not a directory");
    assert.match(
      reportPathIssue(`${relative(process.cwd(), fileComponent)}/report.json`),
      /existing path components/
    );

    const existingReport = resolve(tempRoot, "existing-report.json");
    writeFileSync(existingReport, "{}\n");
    assert.equal(isSafeReportPath(relative(process.cwd(), existingReport)), true);

    const directoryReport = resolve(tempRoot, "directory-report.json");
    mkdirSync(directoryReport);
    assert.match(reportPathIssue(relative(process.cwd(), directoryReport)), /JSON file/);

    const symlinkPath = resolve(tempRoot, "linked-dir");
    try {
      symlinkSync(tempRoot, symlinkPath, "dir");
      assert.match(
        reportPathIssue(`${relative(process.cwd(), symlinkPath)}/report.json`),
        /symbolic links/
      );
    } catch {
      // Some filesystems disallow symlink creation; existing-path tests still run above.
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log("report path safety self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  } else {
    console.error("Usage: node scripts/lib/report-path-safety.js --self-test");
    process.exit(1);
  }
}

module.exports = {
  assertSafeReportPath,
  isSafeReportPath,
  reportPathIssue,
};
