#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-store-legal-web-export-audit-v1";
const DEFAULT_EXPORT_DIR = "dist";
const DEFAULT_REPORT = "docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json";

const ROUTES = [
  {
    id: "privacy",
    publicUrl: "https://freedrecovery.app/privacy",
    routePath: "/privacy",
    sourceFile: "app/privacy.tsx",
    expectedComponent: "PrivacyPolicyPage",
    candidates: ["privacy.html", "privacy/index.html"],
    requiredText: [
      "FREED Privacy Policy",
      "Effective date: June 6, 2026",
      "Android Accessibility",
      "DNS-only VPN",
      "Family Controls",
      "Purchase verification",
      "support@freedrecovery.app",
    ],
  },
  {
    id: "support",
    publicUrl: "https://freedrecovery.app/support",
    routePath: "/support",
    sourceFile: "app/support.tsx",
    expectedComponent: "SupportPage",
    candidates: ["support.html", "support/index.html"],
    requiredText: [
      "FREED Support",
      "Protection setup help",
      "Google Play",
      "App Store",
      "support@freedrecovery.app",
    ],
  },
  {
    id: "account-deletion",
    publicUrl: "https://freedrecovery.app/account-deletion",
    routePath: "/account-deletion",
    sourceFile: "app/account-deletion.tsx",
    expectedComponent: "AccountDeletionPage",
    candidates: ["account-deletion.html", "account-deletion/index.html"],
    requiredText: [
      "FREED Account Deletion",
      "Delete local app data",
      "Request hosted data deletion",
      "https://freedrecovery.app/account-deletion",
      "support@freedrecovery.app",
    ],
  },
];

const HOSTING_ROUTE_CONFIGS = [
  {
    id: "netlify-cloudflare-clean-url-redirects",
    sourceFile: "public/_redirects",
    exportFile: "_redirects",
    requiredText: [
      "/privacy /privacy.html 200",
      "/privacy/ /privacy.html 200",
      "/support /support.html 200",
      "/support/ /support.html 200",
      "/account-deletion /account-deletion.html 200",
      "/account-deletion/ /account-deletion.html 200",
    ],
  },
  {
    id: "netlify-cloudflare-crawler-headers",
    sourceFile: "public/_headers",
    exportFile: "_headers",
    requiredText: [
      "/privacy",
      "/support",
      "/account-deletion",
      "Cache-Control: public, max-age=300",
      "X-Robots-Tag: index, follow",
    ],
  },
  {
    id: "vercel-clean-url-rewrites",
    sourceFile: "vercel.json",
    exportFile: "",
    requiredText: [
      "\"cleanUrls\": true",
      "\"source\": \"/privacy\"",
      "\"destination\": \"/privacy.html\"",
      "\"source\": \"/support\"",
      "\"destination\": \"/support.html\"",
      "\"source\": \"/account-deletion\"",
      "\"destination\": \"/account-deletion.html\"",
      "\"key\": \"X-Robots-Tag\"",
      "\"value\": \"index, follow\"",
    ],
  },
];

function printHelp() {
  console.log(`Usage: npm run audit:store-legal-web -- [options]

Validates that the Expo static web export contains direct crawler-readable
privacy, support, and account-deletion route HTML for store review. Run
npm run export:web first when you need a fresh dist/ export.

Options:
  --export-dir <path>  Static Expo web export directory. Default: ${DEFAULT_EXPORT_DIR}
  --report <path>      Sanitized JSON report under docs/validation/artifacts.
                       Default: ${DEFAULT_REPORT}
  --self-test          Run offline parser checks.
`);
}

function parseArgs(argv) {
  const options = {
    exportDir: DEFAULT_EXPORT_DIR,
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

    if (arg === "--export-dir") options.exportDir = next();
    else if (arg === "--report") options.reportPath = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.exportDir = assertSafeWorkspaceDir(options.exportDir, "--export-dir");
  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  return options;
}

function assertSafeWorkspaceDir(value, label) {
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
    throw new Error(`${label} must be a local workspace path without shell syntax, URLs, flags, or template placeholders.`);
  }

  const absolute = path.resolve(process.cwd(), trimmed);
  const relativePath = path.relative(process.cwd(), absolute);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside the current workspace.`);
  }

  const releaseEvidenceDir = path.resolve(process.cwd(), "docs/validation/evidence");
  if (isPathInsideOrSame(releaseEvidenceDir, absolute)) {
    throw new Error(`${label} must not point inside docs/validation/evidence.`);
  }

  return trimmed;
}

function isPathInsideOrSame(parent, child) {
  const relativePath = path.relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function fileSha256(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function readTextIfExists(absolutePath) {
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function resolveRouteHtml(exportDir, route) {
  for (const candidate of route.candidates) {
    const absolutePath = path.join(process.cwd(), exportDir, candidate);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }
  return null;
}

function summarizeRoute(exportDir, route, checks) {
  const sourceAbsolutePath = path.join(process.cwd(), route.sourceFile);
  const sourceText = readTextIfExists(sourceAbsolutePath);
  const sourceOk = sourceText.includes(route.expectedComponent);
  pushCheck(
    checks,
    `source-route-${route.id}`,
    sourceOk,
    `${route.sourceFile} routes to ${route.expectedComponent}.`,
    `Restore ${route.sourceFile} so ${route.publicUrl} renders the expected legal page.`,
  );

  const htmlAbsolutePath = resolveRouteHtml(exportDir, route);
  if (!htmlAbsolutePath) {
    pushCheck(
      checks,
      `static-html-${route.id}`,
      false,
      `${route.routePath} static HTML was not found in ${exportDir}.`,
      "Run npm run export:web and confirm Expo static output includes direct route HTML.",
    );
    return {
      candidates: route.candidates.map((candidate) => `${exportDir}/${candidate}`),
      contentChecks: route.requiredText.map((text) => ({ text, present: false })),
      exists: false,
      id: route.id,
      publicUrl: route.publicUrl,
      routePath: route.routePath,
      sourceFile: route.sourceFile,
    };
  }

  const html = fs.readFileSync(htmlAbsolutePath, "utf8");
  const contentChecks = route.requiredText.map((text) => ({
    text,
    present: html.includes(text),
  }));
  const routeContentOk = contentChecks.every((check) => check.present);
  const hasHydrationScript = html.includes("__EXPO_ROUTER_HYDRATE__") || html.includes("/_expo/static/js/web/");

  pushCheck(
    checks,
    `static-html-${route.id}`,
    true,
    `${route.routePath} exports as ${repoRelative(htmlAbsolutePath)}.`,
  );
  pushCheck(
    checks,
    `static-content-${route.id}`,
    routeContentOk,
    `${route.routePath} exported HTML includes required store-review legal text.`,
    `Refresh ${route.sourceFile} and rerun npm run export:web before store submission.`,
  );
  pushCheck(
    checks,
    `static-runtime-${route.id}`,
    hasHydrationScript,
    `${route.routePath} exported HTML includes Expo web runtime assets for client hydration.`,
  );

  return {
    contentChecks,
    exists: true,
    htmlArtifact: repoRelative(htmlAbsolutePath),
    id: route.id,
    publicUrl: route.publicUrl,
    routePath: route.routePath,
    sha256: `sha256-${fileSha256(htmlAbsolutePath)}`,
    sizeBytes: fs.statSync(htmlAbsolutePath).size,
    sourceFile: route.sourceFile,
  };
}

function summarizeHostingRouteConfig(exportDir, config, checks) {
  const sourceAbsolutePath = path.join(process.cwd(), config.sourceFile);
  const sourceText = readTextIfExists(sourceAbsolutePath);
  const sourceChecks = config.requiredText.map((text) => ({
    text,
    present: sourceText.includes(text),
  }));
  const sourceReady = sourceChecks.every((check) => check.present);
  pushCheck(
    checks,
    `hosting-source-${config.id}`,
    sourceReady,
    `${config.sourceFile} contains clean URL routing rules for the legal pages.`,
    `Restore ${config.sourceFile} so /privacy, /support, and /account-deletion resolve without .html suffixes.`,
  );

  const summary = {
    exportArtifact: "",
    exportCopied: config.exportFile ? false : null,
    exportFile: config.exportFile,
    exportSha256: "",
    id: config.id,
    requiredTextChecks: sourceChecks,
    sourceFile: config.sourceFile,
    sourceReady,
    sourceSha256: fs.existsSync(sourceAbsolutePath) && fs.statSync(sourceAbsolutePath).isFile()
      ? `sha256-${fileSha256(sourceAbsolutePath)}`
      : "",
  };

  if (!config.exportFile) {
    return summary;
  }

  const exportAbsolutePath = path.join(process.cwd(), exportDir, config.exportFile);
  const exportText = readTextIfExists(exportAbsolutePath);
  const exportChecks = config.requiredText.map((text) => ({
    text,
    present: exportText.includes(text),
  }));
  const exportCopied =
    fs.existsSync(exportAbsolutePath) &&
    fs.statSync(exportAbsolutePath).isFile() &&
    exportChecks.every((check) => check.present);
  pushCheck(
    checks,
    `hosting-export-${config.id}`,
    exportCopied,
    `${config.exportFile} is present in ${exportDir} with clean URL routing rules for the legal pages.`,
    "Rerun npm run export:web so public hosting route files are copied into the static deploy root.",
  );

  summary.exportArtifact = exportCopied ? repoRelative(exportAbsolutePath) : "";
  summary.exportCopied = exportCopied;
  summary.exportRequiredTextChecks = exportChecks;
  summary.exportSha256 = exportCopied ? `sha256-${fileSha256(exportAbsolutePath)}` : "";
  return summary;
}

function buildReport(options) {
  const checks = [];
  const exportAbsolutePath = path.resolve(process.cwd(), options.exportDir);
  const exportStat = fs.existsSync(exportAbsolutePath) ? fs.lstatSync(exportAbsolutePath) : null;
  const exportDirOk = Boolean(exportStat?.isDirectory() && !exportStat.isSymbolicLink());

  pushCheck(
    checks,
    "expo-static-web-config",
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "app.json"), "utf8")).expo?.web?.output === "static",
    "app.json configures Expo web output as static for crawler-readable store URLs.",
    "Set expo.web.output to static and rerun npm run export:web.",
  );
  pushCheck(
    checks,
    "static-export-dir",
    exportDirOk,
    `${options.exportDir} exists and is a real directory.`,
    "Run npm run export:web before running the web legal export audit.",
  );

  const routeExports = ROUTES.map((route) => summarizeRoute(options.exportDir, route, checks));
  const hostingRouteConfig = HOSTING_ROUTE_CONFIGS.map((config) =>
    summarizeHostingRouteConfig(options.exportDir, config, checks),
  );
  const routeFilesPresent = routeExports.every((route) => route.exists);
  const allContentPresent = routeExports.every((route) => route.contentChecks.every((check) => check.present));
  const hostingRoutesReady = hostingRouteConfig.every((config) =>
    config.sourceReady === true && (config.exportCopied !== false),
  );

  pushCheck(
    checks,
    "store-crawler-route-set",
    routeFilesPresent && allContentPresent,
    "Privacy, support, and account-deletion static HTML routes are present with required store-review content.",
    "Refresh the web export and do not enter store URLs until every public legal route passes this audit.",
  );
  pushCheck(
    checks,
    "store-clean-url-hosting-config",
    hostingRoutesReady,
    "Static host clean URL routing is configured for /privacy, /support, and /account-deletion.",
    "Add public/_redirects, public/_headers, and vercel.json routing rules, then rerun npm run export:web.",
  );

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result: failCount === 0 ? "pass" : "fail",
    passCount,
    failCount,
    exportDir: options.exportDir,
    routeExports,
    hostingRouteConfig,
    publicUrls: Object.fromEntries(ROUTES.map((route) => [route.id, route.publicUrl])),
    releaseBoundary:
      "Local static-export proof only. Hosted page availability, DNS, CDN cache, legal review, store-console entry, and platform approval still gate production submission.",
    checks,
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  assert.throws(() => parseArgs(["--export-dir", "../outside"]), /current workspace/);
  assert.throws(() => parseArgs(["--export-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/report.json"]), /docs\/validation\/evidence/);

  const tempRoot = path.join(
    process.cwd(),
    "docs/validation/artifacts/store-legal-web-self-test",
    String(Date.now()),
  );
  fs.mkdirSync(tempRoot, { recursive: true });
  try {
    for (const route of ROUTES) {
      fs.writeFileSync(
        path.join(tempRoot, route.candidates[0]),
        `<html><body>${route.requiredText.join("\n")}<script>globalThis.__EXPO_ROUTER_HYDRATE__=true;</script></body></html>`,
      );
    }
    fs.writeFileSync(
      path.join(tempRoot, "_redirects"),
      fs.readFileSync(path.join(process.cwd(), "public/_redirects"), "utf8"),
    );
    fs.writeFileSync(
      path.join(tempRoot, "_headers"),
      fs.readFileSync(path.join(process.cwd(), "public/_headers"), "utf8"),
    );
    const report = buildReport({
      exportDir: repoRelative(tempRoot),
      reportPath: DEFAULT_REPORT,
    });
    assert.equal(report.schemaVersion, SCHEMA_VERSION);
    assert.equal(report.sanitized, true);
    assert.equal(report.result, "pass");
    assert.equal(report.routeExports.length, 3);
    assert.equal(report.hostingRouteConfig.length, 3);
    assert.ok(report.hostingRouteConfig.every((config) => config.sourceReady === true));
    assert.ok(report.hostingRouteConfig.every((config) => config.exportCopied !== false));
    assert.ok(report.routeExports.every((route) => route.sha256?.startsWith("sha256-")));
  } finally {
    fs.rmSync(path.dirname(tempRoot), { recursive: true, force: true });
  }

  console.log("store legal web export audit self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const report = buildReport(options);
  writeReport(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        exportDir: report.exportDir,
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
  main();
}

module.exports = {
  buildReport,
  HOSTING_ROUTE_CONFIGS,
  ROUTES,
};
