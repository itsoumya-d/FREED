const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { isPathInsideOrSame } = require("./workspace-path-safety");

function envFilePathIssue(value, label = "env file") {
  if (typeof value !== "string" || !value.trim()) {
    return `${label} must include a local production env file path.`;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (
    trimmed !== value ||
    !/^[A-Za-z0-9._~/-]+$/.test(trimmed) ||
    normalized.startsWith("-") ||
    normalized.includes("://") ||
    normalized.includes(".env.production.example") ||
    normalized.includes(".env.example") ||
    normalized.includes("production-env-file") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("todo") ||
    normalized.includes("<") ||
    normalized.includes(">")
  ) {
    return `${label} must be a local path without shell syntax, URLs, flags, or template placeholders.`;
  }

  const absolute = resolve(process.cwd(), trimmed);
  const forbiddenValidationDirs = [
    ["docs/validation/evidence", "docs/validation/evidence"],
    ["docs/validation/artifacts", "docs/validation/artifacts"],
  ];
  for (const [relativeDir, displayDir] of forbiddenValidationDirs) {
    const forbiddenDir = resolve(process.cwd(), relativeDir);
    if (isPathInsideOrSame(forbiddenDir, absolute)) {
      return `${label} must not be stored in ${displayDir}; use .env.production or secrets/prod.env outside validation artifacts.`;
    }
  }

  return null;
}

function isSafeEnvFilePath(value) {
  return envFilePathIssue(value) === null;
}

function assertSafeEnvFilePath(value, label = "env file") {
  const issue = envFilePathIssue(value, label);
  if (issue) throw new Error(issue);
}

function runSelfTest() {
  assert.equal(isSafeEnvFilePath(".env.production"), true);
  assert.equal(isSafeEnvFilePath("secrets/prod.env"), true);
  assert.equal(isSafeEnvFilePath("/tmp/freed-prod.env"), true);
  assert.equal(isSafeEnvFilePath("https://secrets.freedrecovery.app/prod.env"), false);
  assert.equal(isSafeEnvFilePath("--verbose"), false);
  assert.equal(isSafeEnvFilePath("<production-env-file>"), false);
  assert.equal(isSafeEnvFilePath(".env.production.example"), false);
  assert.equal(isSafeEnvFilePath("secrets/prod.env;echo"), false);
  assert.match(envFilePathIssue("docs/validation/evidence/prod.env"), /docs\/validation\/evidence/);
  assert.match(envFilePathIssue("DOCS/VALIDATION/EVIDENCE/prod.env"), /docs\/validation\/evidence/);
  assert.match(envFilePathIssue("docs/validation/artifacts/run/prod.env"), /docs\/validation\/artifacts/);
  assert.match(envFilePathIssue("docs/validation/artifacts/run/../prod.env"), /docs\/validation\/artifacts/);
  assert.throws(() => assertSafeEnvFilePath("docs/validation/evidence/prod.env"), /docs\/validation\/evidence/);
  assert.throws(() => assertSafeEnvFilePath("docs/validation/artifacts/run/prod.env"), /docs\/validation\/artifacts/);
  console.log("env file safety self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  }
}

module.exports = {
  assertSafeEnvFilePath,
  envFilePathIssue,
  isSafeEnvFilePath,
  runSelfTest,
};
