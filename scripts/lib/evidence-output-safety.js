#!/usr/bin/env node

const assert = require("node:assert/strict");
const { isAbsolute, relative, resolve } = require("node:path");
const { isPathInsideOrSame } = require("./workspace-path-safety");

function artifactOutputDirIssue(value, label = "artifact output directory") {
  if (typeof value !== "string" || !value.trim()) {
    return `${label} must include a local workspace artifact directory.`;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (
    trimmed !== value ||
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

  const artifactRoot = resolve(process.cwd(), "docs/validation/artifacts");
  if (isPathInsideOrSame(artifactRoot, absolute)) {
    const artifactRelativePath = relative(artifactRoot, absolute);
    const foldedArtifactRelativePath = relative(artifactRoot.toLowerCase(), absolute.toLowerCase());
    if (artifactRelativePath !== "" && foldedArtifactRelativePath !== "") return null;
  }
  {
    return `${label} must be under docs/validation/artifacts/<run-id> so generated capture files can be referenced by release evidence.`;
  }
}

function assertSafeArtifactOutputDir(value, label = "artifact output directory") {
  const issue = artifactOutputDirIssue(value, label);
  if (issue) throw new Error(issue);
  return String(value).trim();
}

function isSafeArtifactOutputDir(value, label = "artifact output directory") {
  return artifactOutputDirIssue(value, label) === null;
}

function runSelfTest() {
  assert.equal(isSafeArtifactOutputDir("docs/validation/artifacts/self-test/output"), true);
  assert.equal(assertSafeArtifactOutputDir("docs/validation/artifacts/self-test/output"), "docs/validation/artifacts/self-test/output");
  assert.match(artifactOutputDirIssue("docs/validation/evidence"), /docs\/validation\/evidence/);
  assert.match(artifactOutputDirIssue("DOCS/VALIDATION/EVIDENCE"), /docs\/validation\/evidence/);
  assert.match(artifactOutputDirIssue("docs/validation/evidence/ios-physical-device"), /docs\/validation\/evidence/);
  assert.match(artifactOutputDirIssue("DOCS/VALIDATION/ARTIFACTS"), /docs\/validation\/artifacts/);
  assert.match(artifactOutputDirIssue("../outside-artifacts"), /current workspace/);
  assert.match(artifactOutputDirIssue("screenshots/evidence-capture"), /docs\/validation\/artifacts/);
  assert.match(artifactOutputDirIssue("https://example.com/artifacts"), /URLs/);
  assert.match(artifactOutputDirIssue("--output-dir"), /flags/);
  assert.match(artifactOutputDirIssue("docs/validation/artifacts/<run-id>"), /template placeholders/);
  assert.throws(() => assertSafeArtifactOutputDir("docs/validation/evidence"), /docs\/validation\/evidence/);
  console.log("evidence-output-safety self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  } else {
    console.error("Usage: node scripts/lib/evidence-output-safety.js --self-test");
    process.exit(1);
  }
}

module.exports = {
  artifactOutputDirIssue,
  assertSafeArtifactOutputDir,
  isSafeArtifactOutputDir,
};
