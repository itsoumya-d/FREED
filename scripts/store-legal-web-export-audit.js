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
    publicUrl: "https://freed-landing.web.app/privacy",
    routePath: "/privacy",
    sourceFile: "app/privacy.tsx",
    expectedComponent: "PrivacyPolicyPage",
    candidates: ["privacy.html", "privacy/index.html"],
    requiredText: [
      "FREED Privacy Policy",
      "Effective date: October 5, 2026",
      require("../src/i18n/native-android-catalog.json").freed_accessibility_description,
      "DNS-only VPN",
      "Family Controls",
      "Purchase verification",
      "soumyadebnath1661@gmail.com",
    ],
  },
  {
    id: "support",
    publicUrl: "https://freed-landing.web.app/support",
    routePath: "/support",
    sourceFile: "app/support.tsx",
    expectedComponent: "SupportPage",
    candidates: ["support.html", "support/index.html"],
    requiredText: [
      "FREED Support",
      "Protection setup help",
      "Google Play",
      "App Store",
      "soumyadebnath1661@gmail.com",
    ],
  },
  {
    id: "account-deletion",
    publicUrl: "https://freed-landing.web.app/account-deletion",
    routePath: "/account-deletion",
    sourceFile: "app/account-deletion.tsx",
    expectedComponent: "AccountDeletionPage",
    candidates: ["account-deletion.html", "account-deletion/index.html"],
    requiredText: [
      "FREED Account Deletion",
      "Delete local app data",
      "Request hosted data deletion",
      "https://freed-landing.web.app/account-deletion",
      "soumyadebnath1661@gmail.com",
    ],
  },
];

// Website mode audits the scoped public pages, without requiring an Expo runtime.
const WEBSITE_REQUIRED = {
  privacy: ["FREED Privacy Policy", "adults 18+", "account is required", "opaque", "Apple Vision", "bundled ML Kit", "operational SDK metrics", "up to six recent user-authored messages", "not automatically attached", "outside your country", "processing and retention terms", "retention planning run locally", "aggregate", "encrypted backup", "baseline adult-domain protection", "native protection barrier are ad-free"],
  support: ["FREED Support", "Protection setup help", "account ownership verification", "verified paid expiry", "Restore purchases", "Manage subscription", "freed_premium_yearly", "freed_premium_monthly", "retry", "Google Play", "App Store"],
  "account-deletion": ["FREED Account Deletion", "Delete local app data", "Request hosted data deletion", "native acknowledgment", "Recovery records are preserved", "Delete Account &amp; Data", "deletion is in progress", "does not cancel", "instantaneous provider", "https://freed-landing.web.app/account-deletion"],
  terms: ["FREED Terms of Service", "adults 18+", "voluntary personal use", "account is required", "same features", "auto-renewing", "not a medical device", "Strenuous exercise is not required", "never turn off baseline adult-domain protection"],
};
const WEBSITE_FORBIDDEN = ["June 6, 2026", "at least 13", "optional) account", "optional accounts", "lifetime", "remote challenge generation", "selected short-form surfaces", "bounded scroll events", "free users may see rewarded ads before some recovery challenges"];

function inspectDisclosureClaims(id, html) {
  const text = html.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const checks = [];
  const requireClaim = (name, pattern) => checks.push({ id: name, passed: pattern.test(text) });
  const excludeClaim = (name, pattern) => checks.push({ id: name, passed: !pattern.test(text) });
  if (['privacy', 'support', 'terms'].includes(id)) {
    requireClaim('free-basic-help', /Basic Help\/SOS is included with free access and requires neither a paid subscription nor a rewarded ad\./);
    requireClaim('optional-single-session-reward', /Free users may explicitly choose a rewarded ad for access to one guided recovery session where available\./);
    requireClaim('baseline-never-released', /An ad or challenge never releases baseline adult-domain protection\./);
    excludeClaim('no-basic-help-ad-dependency', /Basic Help(?:\/SOS)? (?:requires (?:watching|completing) (?:an?|a rewarded) ad|depends on (?:an?|a rewarded) ad)/i);
    excludeClaim('no-basic-help-paid-dependency', /Basic Help(?:\/SOS)? requires a paid subscription/i);
    excludeClaim('no-ad-or-challenge-domain-unlock', /(?:rewarded ad|challenge) (?:releases|unlocks|turns off) (?:baseline )?adult-domain protection/i);
    checks.push({ id: 'google-processing-link', passed: html.includes('href="https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention"') });
    excludeClaim('no-google-zero-retention-promise', /Google (?:retains nothing|has zero retention|never retains (?:messages|prompts))/i);
    excludeClaim('no-fixed-google-retention-promise', /Google (?:retains|stores) (?:messages|prompts|content) for (?:exactly )?(?:7|seven|14|fourteen) days/i);
  }
  if (id === 'privacy') {
    requireClaim('explicit-cloud-consent', /With your explicit cloud-chat consent, messages you deliberately send to CLARA/);
    excludeClaim('no-cloud-consent-contradiction', /Cloud chat[^.]*without (?:explicit )?consent/i);
    requireClaim('separate-context-choice', /If you also choose to share conversation context, the request can include up to six recent user-authored messages\./);
    excludeClaim('no-automatic-conversation-context', /Conversation context is included automatically/i);
    requireClaim('no-photo-upload', /Photos are not uploaded\./);
    excludeClaim('no-photo-upload-contradiction', /Photos (?:are|may be|will be) uploaded/i);
    requireClaim('analytics-opt-in', /If you opt into analytics sharing, FREED sends/);
    excludeClaim('no-analytics-consent-contradiction', /Analytics sharing[^.]*without (?:explicit )?consent/i);
    requireClaim('actual-day-counts', /absolute UTC-day counts of check-ins and completed challenges for a 14-day window\./);
    requireClaim('analytics-consent-lineage-metadata', /The snapshot also includes schema and consent versions, opt-in time, and lineage, revision and snapshot identifiers\./);
    requireClaim('authenticated-account-linkage', /These records are linked to your authenticated account UID\./);
    excludeClaim('no-anonymous-analytics-claim', /Shared analytics are anonymous|analytics (?:are|is) not linked to your account/i);
    requireClaim('local-derived-values-excluded', /Locally derived rates, streak summaries and challenge categories are not part of this uploaded snapshot\./);
    requireClaim('configured-analytics-expiry', /Analytics records have a configured 14-day expiry\./);
    requireClaim('honest-ttl-timing', /Expiry makes records eligible for TTL deletion; physical deletion may occur later/);
    excludeClaim('no-instant-analytics-erasure', /Analytics records are erased immediately at expiry/i);
    requireClaim('owner-linked-quota-dedupe', /account-linked quota and request deduplication metadata/);
    requireClaim('configured-dedupe-expiry', /Request deduplication records have a configured 7-day expiry\./);
    requireClaim('google-retention-separate', /These service controls do not set Google's content retention\./);
  }
  return checks;
}

function inspectWebsiteContent(id, html) {
  const nativeCopy = require("../src/i18n/native-android-catalog.json");
  const required = ["Effective date: October 5, 2026", "soumyadebnath1661@gmail.com", ...WEBSITE_REQUIRED[id]];
  if (["privacy", "support", "terms"].includes(id)) required.push(nativeCopy.freed_accessibility_description);
  const text = html.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return {
    contentChecks: required.map(value => ({ text: value, present: text.includes(value.replace(/&amp;/g, "&")) })),
    obsoleteChecks: WEBSITE_FORBIDDEN.map(value => ({ text: value, absent: !text.toLowerCase().includes(value.toLowerCase()) })),
    disclosureChecks: inspectDisclosureClaims(id, html),
  };
}

function buildWebsiteReport(options) {
  const checks = [];
  const routes = Object.keys(WEBSITE_REQUIRED).map(id => {
    const absolute = path.resolve(process.cwd(), options.exportDir, `${id}.html`);
    const exists = fs.existsSync(absolute) && fs.statSync(absolute).isFile();
    const html = exists ? fs.readFileSync(absolute, "utf8") : "";
    const content = inspectWebsiteContent(id, html);
    pushCheck(checks, `website-content-${id}`, exists && content.contentChecks.every(row => row.present) && content.obsoleteChecks.every(row => row.absent) && content.disclosureChecks.every(row => row.passed), `${id} has current disclosure and excludes obsolete scope.`);
    const canonical = `https://freed-landing.web.app/${id}`;
    const links = ["/privacy", "/support", "/account-deletion", "/terms"].every(href => html.includes(`href="${href}"`));
    pushCheck(checks, `website-navigation-${id}`, links && html.includes(`href="${canonical}"`) && html.includes('href="mailto:soumyadebnath1661@gmail.com'), `${id} retains canonical URL, legal navigation and contact.`);
    return { id, exists, htmlArtifact: repoRelative(absolute), publicUrl: canonical, ...content, ...(exists ? { sha256: `sha256-${fileSha256(absolute)}`, sizeBytes: fs.statSync(absolute).size } : {}) };
  });
  const failCount = checks.filter(row => row.status === "fail").length;
  return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), sanitized: true, mode: "website", result: failCount ? "fail" : "pass", passCount: checks.length - failCount, failCount, exportDir: options.exportDir, routeExports: routes, checks, releaseBoundary: "Local four-page content proof only. Browser rendering, publication/readback, legal review, and actual device/store/provider proof are separate gates." };
}

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
  --website            Audit four prepared website legal pages (default directory: website).
  --self-test          Run offline parser checks.
`);
}

function parseArgs(argv) {
  const options = {
    exportDir: DEFAULT_EXPORT_DIR,
    reportPath: DEFAULT_REPORT,
    selfTest: false,
    website: false,
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
    else if (arg === "--website") options.website = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.website && !argv.includes("--export-dir")) options.exportDir = "website";
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

  const report = options.website ? buildWebsiteReport(options) : buildReport(options);
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
  buildWebsiteReport,
  inspectWebsiteContent,
  HOSTING_ROUTE_CONFIGS,
  ROUTES,
};
