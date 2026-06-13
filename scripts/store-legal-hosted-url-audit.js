#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { safeExternalHttpsUrl } = require("./lib/evidence-target-safety");
const { assertSafeReportPath } = require("./lib/report-path-safety");
const { ROUTES } = require("./store-legal-web-export-audit");

const SCHEMA_VERSION = "freed-store-legal-hosted-url-audit-v1";
const DEFAULT_REPORT = "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RESPONSE_MAX_BYTES = 262144;

function printHelp() {
  console.log(`Usage: npm run audit:store-legal-hosted -- [options]

Checks the public privacy, support, and account-deletion URLs that will be
entered in App Store Connect and Google Play Console. This is an online hosted
availability check; run it only after the static web export has been deployed.

Options:
  --report <path>           Sanitized JSON report under docs/validation/artifacts.
                            Default: ${DEFAULT_REPORT}
  --timeout-ms <ms>         Per-request timeout, 500-30000. Default: ${DEFAULT_TIMEOUT_MS}
  --response-max-bytes <n>  Max HTML bytes read per page, 1024-1000000.
                            Default: ${DEFAULT_RESPONSE_MAX_BYTES}
  --self-test               Run offline parser/fetch checks.
`);
}

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT,
    responseMaxBytes: DEFAULT_RESPONSE_MAX_BYTES,
    selfTest: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--report") options.reportPath = next();
    else if (arg === "--timeout-ms") options.timeoutMs = parseBoundedInteger(next(), arg, 500, 30000);
    else if (arg === "--response-max-bytes") {
      options.responseMaxBytes = parseBoundedInteger(next(), arg, 1024, 1000000);
    } else if (arg === "--self-test") options.selfTest = true;
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

function parseBoundedInteger(value, label, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function validateHostedUrl(value, label) {
  const normalized = safeExternalHttpsUrl(value, label);
  const parsed = new URL(normalized);
  if (parsed.username || parsed.password) throw new Error(`${label} must not include URL credentials.`);
  if (parsed.search) throw new Error(`${label} must not include query strings.`);
  if (parsed.hash) throw new Error(`${label} must not include URL fragments.`);
  if (!parsed.pathname || parsed.pathname === "/") throw new Error(`${label} must include a concrete route path.`);
  return parsed.toString();
}

function sanitizeUrlForReport(value) {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function formatFetchError(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause && typeof error.cause === "object" ? error.cause : null;
  const code = cause && "code" in cause ? String(cause.code || "") : "";
  const hostname = cause && "hostname" in cause ? String(cause.hostname || "") : "";
  const reason = [error.message, code ? `code=${code}` : "", hostname ? `host=${hostname}` : ""]
    .filter(Boolean)
    .join("; ");
  return reason || "fetch failed";
}

async function readBoundedText(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(`response body exceeds ${maxBytes} bytes`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(`response body exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function auditRoute(route, options, checks, fetchImpl) {
  const expectedUrl = validateHostedUrl(route.publicUrl, `route ${route.id} public URL`);
  const result = {
    contentChecks: route.requiredText.map((text) => ({ text, present: false })),
    contentType: "",
    expectedUrl,
    finalUrl: "",
    id: route.id,
    publicUrl: route.publicUrl,
    routePath: route.routePath,
    status: 0,
  };

  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, expectedUrl, options.timeoutMs);
  } catch (error) {
    pushCheck(
      checks,
      `hosted-fetch-${route.id}`,
      false,
      `${route.publicUrl} could not be fetched: ${formatFetchError(error)}`,
      "Deploy the static web export, verify DNS/CDN routing, then rerun the hosted legal URL audit.",
    );
    return result;
  }

  const finalUrl = sanitizeUrlForReport(response.url || expectedUrl);
  const contentType = String(response.headers?.get?.("content-type") || "");
  result.contentType = contentType;
  result.finalUrl = finalUrl;
  result.status = Number(response.status || 0);

  const statusOk = response.status >= 200 && response.status < 300;
  const finalUrlOk = finalUrl.startsWith("https://") && new URL(finalUrl).pathname === new URL(expectedUrl).pathname;
  const contentTypeOk = /text\/html/i.test(contentType);

  pushCheck(
    checks,
    `hosted-status-${route.id}`,
    statusOk,
    `${route.publicUrl} returned HTTP ${response.status}.`,
    "Store legal URLs should return 2xx HTML responses before console submission.",
  );
  pushCheck(
    checks,
    `hosted-final-url-${route.id}`,
    finalUrlOk,
    `${route.publicUrl} final URL is ${finalUrl || "unavailable"}.`,
    "Avoid redirects to unrelated paths or non-HTTPS URLs for store crawler reliability.",
  );
  pushCheck(
    checks,
    `hosted-content-type-${route.id}`,
    contentTypeOk,
    `${route.publicUrl} returned content type ${contentType || "unknown"}.`,
    "Serve the public legal route as HTML.",
  );

  let html = "";
  try {
    html = await readBoundedText(response, options.responseMaxBytes);
  } catch (error) {
    pushCheck(
      checks,
      `hosted-body-${route.id}`,
      false,
      `${route.publicUrl} body could not be read within ${options.responseMaxBytes} bytes: ${error instanceof Error ? error.message : String(error)}`,
      "Keep hosted legal HTML bounded and crawler-readable.",
    );
    return result;
  }

  result.sizeBytes = Buffer.byteLength(html, "utf8");
  result.contentChecks = route.requiredText.map((text) => ({
    text,
    present: html.includes(text),
  }));
  const contentOk = result.contentChecks.every((check) => check.present);
  const noNoindex = !/noindex/i.test(html);

  pushCheck(
    checks,
    `hosted-body-${route.id}`,
    result.sizeBytes > 0,
    `${route.publicUrl} returned ${result.sizeBytes} bytes of HTML.`,
    "Deploy a non-empty static legal page.",
  );
  pushCheck(
    checks,
    `hosted-content-${route.id}`,
    contentOk,
    `${route.publicUrl} includes required store-review legal text.`,
    "Deploy the latest static export and verify the public legal page content.",
  );
  pushCheck(
    checks,
    `hosted-indexing-${route.id}`,
    noNoindex,
    `${route.publicUrl} does not include a noindex directive.`,
    "Remove noindex from store-facing legal URLs.",
  );

  return result;
}

async function buildReport(options, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("fetch is not available in this Node runtime.");

  const checks = [];
  const routeResults = [];
  for (const route of ROUTES) {
    routeResults.push(await auditRoute(route, options, checks, fetchImpl));
  }
  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result: failCount === 0 ? "pass" : "fail",
    passCount,
    failCount,
    timeoutMs: options.timeoutMs,
    responseMaxBytes: options.responseMaxBytes,
    publicUrls: Object.fromEntries(ROUTES.map((route) => [route.id, route.publicUrl])),
    routeResults,
    releaseBoundary:
      "Hosted URL availability proof only. Legal review, store-console entry, platform approval, sandbox purchases, and physical-device evidence still gate production submission.",
    checks,
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function runSelfTest() {
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/hosted.json"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--timeout-ms", "50"]), /between 500 and 30000/);
  assert.throws(() => validateHostedUrl("https://freedrecovery.app/privacy?token=secret", "url"), /query strings/);

  const fakeFetch = async (url) => {
    const route = ROUTES.find((candidate) => candidate.publicUrl === url);
    assert.ok(route, `unexpected URL ${url}`);
    return new Response(`<html><body>${route.requiredText.join("\n")}</body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200,
    });
  };
  const report = await buildReport(
    {
      reportPath: DEFAULT_REPORT,
      responseMaxBytes: DEFAULT_RESPONSE_MAX_BYTES,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    fakeFetch,
  );
  assert.equal(report.schemaVersion, SCHEMA_VERSION);
  assert.equal(report.sanitized, true);
  assert.equal(report.result, "pass");
  assert.equal(report.routeResults.length, 3);
  assert.ok(report.checks.some((check) => check.id === "hosted-content-privacy" && check.status === "pass"));
  console.log("store legal hosted URL audit self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    await runSelfTest();
    return;
  }

  const report = await buildReport(options);
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

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  buildReport,
  validateHostedUrl,
};
