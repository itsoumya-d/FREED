#!/usr/bin/env node

const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { dirname } = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-dependency-audit-v1";
const AUDIT_TIMEOUT_MS = 180_000;

function parseArgs(argv) {
  const options = {
    json: false,
    reportPath: null,
    selfTest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--json") options.json = true;
    else if (arg === "--report") options.reportPath = next();
    else if (arg === "--self-test") options.selfTest = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function sanitizeReportText(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s,|)]+/gi, "[redacted-url]")
    .replace(/\b(?:token|secret|password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|receipt)=\S+/gi, "[redacted-secret]")
    .replace(/\b(?:sk-(?:proj-)?[0-9A-Za-z_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z._-]{20,})\b/g, "[redacted-secret]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-secret]");
}

function parseJsonObjectFromOutput(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function normalizeVulnerabilitySummary(value) {
  const summary = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const readCount = (key) => {
    const count = Number(summary[key] ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  };

  return {
    critical: readCount("critical"),
    high: readCount("high"),
    moderate: readCount("moderate"),
    low: readCount("low"),
    info: readCount("info"),
    total: readCount("total")
  };
}

function summarizeAuditOutput(raw) {
  return sanitizeReportText(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .slice(0, 360);
}

function npmInvocationFromCandidate(candidate) {
  const trimmed = String(candidate || "").trim();
  if (!trimmed) return null;
  if (trimmed.endsWith(".js") || trimmed.endsWith("npm-cli.js")) {
    return { command: process.execPath, prefixArgs: [trimmed] };
  }
  return { command: trimmed, prefixArgs: [] };
}

function resolveNpmInvocation(env = process.env) {
  return (
    npmInvocationFromCandidate(env.FREED_NPM_CLI) ||
    npmInvocationFromCandidate(env.npm_execpath) ||
    { command: "npm", prefixArgs: [] }
  );
}

function runNpmAudit(env = process.env) {
  const invocation = resolveNpmInvocation(env);
  const child = spawnSync(invocation.command, [...invocation.prefixArgs, "audit", "--omit=dev", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: AUDIT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 8
  });

  return {
    raw: [child.stdout, child.stderr, child.error?.message].filter(Boolean).join("\n"),
    exitCode: typeof child.status === "number" ? child.status : null,
    errorCode: child.error && typeof child.error.code === "string" ? child.error.code : null,
    timedOut: child.error && child.error.code === "ETIMEDOUT"
  };
}

function buildReport(auditResult) {
  const raw = auditResult.raw || "";
  const parsed = parseJsonObjectFromOutput(raw);
  const vulnerabilities = normalizeVulnerabilitySummary(parsed?.metadata?.vulnerabilities);
  let failureKind = null;
  let issues = [];
  let result = "fail";

  if (parsed?.metadata?.vulnerabilities) {
    result = vulnerabilities.total === 0 ? "pass" : "fail";
    if (vulnerabilities.total > 0) {
      issues = [`npm audit reported ${vulnerabilities.total} production vulnerabilities.`];
    }
  } else if (/found\s+0\s+vulnerabilities/i.test(raw)) {
    result = "pass";
  } else if (auditResult.errorCode === "ENOENT") {
    failureKind = "tool-unavailable";
    issues = ["npm executable was not found on PATH; install npm or run the command through npm so npm_execpath is available."];
  } else if (auditResult.timedOut) {
    failureKind = "timeout";
    issues = [`npm audit did not complete within ${AUDIT_TIMEOUT_MS}ms.`];
  } else {
    failureKind = "unparseable-output";
    const summary = summarizeAuditOutput(raw);
    issues = [summary || "npm audit returned no parseable vulnerability metadata."];
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result,
    passCount: result === "pass" ? 1 : 0,
    failCount: result === "pass" ? 0 : 1,
    vulnerabilitySummary: vulnerabilities,
    audit: {
      command: "npm audit --omit=dev --json",
      timeoutMs: AUDIT_TIMEOUT_MS,
      exitCode: auditResult.exitCode,
      failureKind
    },
    issues: issues.map(sanitizeReportText)
  };
}

function writeReport(reportPath, report) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

function printHumanReport(report) {
  const lines = [
    "# FREED dependency audit",
    `Result: ${report.result}`,
    `Vulnerabilities: ${report.vulnerabilitySummary.total}`,
    ""
  ];

  for (const issue of report.issues) {
    lines.push(`- ${issue}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function runSelfTest() {
  const passReport = buildReport({
    raw: JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {},
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } }
    }),
    exitCode: 0,
    errorCode: null,
    timedOut: false
  });
  assert.equal(passReport.result, "pass");
  assert.equal(passReport.vulnerabilitySummary.total, 0);

  const vulnerabilityReport = buildReport({
    raw: JSON.stringify({
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 } }
    }),
    exitCode: 1,
    errorCode: null,
    timedOut: false
  });
  assert.equal(vulnerabilityReport.result, "fail");
  assert.equal(vulnerabilityReport.vulnerabilitySummary.moderate, 1);

  const failureReport = buildReport({
    raw: "npm ERR! audit registry unavailable https://registry.npmjs.org/audit?token=secret-value\nbearer eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment",
    exitCode: 1,
    errorCode: null,
    timedOut: false
  });
  assert.equal(failureReport.result, "fail");
  assert.equal(failureReport.audit.failureKind, "unparseable-output");
  assert.match(failureReport.issues.join(" "), /\[redacted-url\]/);
  assert.match(failureReport.issues.join(" "), /\[redacted-secret\]/);
  assert.doesNotMatch(failureReport.issues.join(" "), /secret-value/);
  assert.doesNotMatch(failureReport.issues.join(" "), /eyJhbGci/);

  process.stdout.write("dependency audit self-test: pass\n");
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid dependency audit arguments.");
  process.exit(1);
}

if (options.selfTest) {
  runSelfTest();
  process.exit(0);
}

const report = buildReport(runNpmAudit());
if (options.reportPath) writeReport(options.reportPath, report);
if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else printHumanReport(report);

process.exit(report.result === "pass" ? 0 : 1);
