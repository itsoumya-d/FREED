#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");

const SCHEMA_VERSION = "freed-store-legal-web-deploy-packet-v1";
const DEFAULT_RUN_ID = "store-legal-web-deploy-current";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/store-legal-web-deploy-current";
const DEFAULT_WEB_EXPORT_REPORT =
  "docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json";
const DEFAULT_HOSTED_REPORT =
  "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
const DEFAULT_EAS_READINESS_REPORT =
  "docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json";
const LEGAL_WEB_DEPLOY_ENV_TEMPLATE_NAME = "LEGAL_WEB_DEPLOY_ENV.template.env";

function printHelp() {
  console.log(`Usage: npm run evidence:store-legal-web-deploy -- [options]

Creates a sanitized deploy handoff packet for the public privacy, support, and
account-deletion pages. It links the passing Expo static export proof to the
currently failing or passing hosted URL proof. It does not deploy, mutate DNS,
or mark release evidence as complete.

Options:
  --web-export-report <path>  Existing store legal web export audit JSON.
                              Default: ${DEFAULT_WEB_EXPORT_REPORT}
  --hosted-report <path>      Existing hosted legal URL audit JSON.
                              Default: ${DEFAULT_HOSTED_REPORT}
  --eas-readiness-report <path>
                              Optional EAS legal web deploy readiness JSON.
                              Default: ${DEFAULT_EAS_READINESS_REPORT}
  --output-dir <path>         Artifact output directory.
                              Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>               Machine-readable run id.
                              Default: ${DEFAULT_RUN_ID}
  --self-test                 Run offline packet tests.
`);
}

function parseArgs(argv) {
  const options = {
    hostedReport: DEFAULT_HOSTED_REPORT,
    easReadinessReport: DEFAULT_EAS_READINESS_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: DEFAULT_RUN_ID,
    selfTest: false,
    webExportReport: DEFAULT_WEB_EXPORT_REPORT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--eas-readiness-report") options.easReadinessReport = next();
    else if (arg === "--hosted-report") options.hostedReport = next();
    else if (arg === "--output-dir") options.outputDir = next();
    else if (arg === "--run-id") options.runId = safeRunId(next());
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--web-export-report") options.webExportReport = next();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  options.webExportReport = assertSafeInputReportPath(options.webExportReport, "--web-export-report");
  options.hostedReport = assertSafeInputReportPath(options.hostedReport, "--hosted-report");
  options.easReadinessReport = assertSafeInputReportPath(options.easReadinessReport, "--eas-readiness-report");
  return options;
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function assertSafeInputReportPath(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error(`${label} must be a plain JSON file path.`);
  }
  if (normalized.startsWith("-") || /[;&|`$<>]/.test(normalized)) {
    throw new Error(`${label} must not contain shell syntax or flags.`);
  }
  const relative = repoRelative(normalized);
  if (!relative.startsWith("docs/validation/artifacts/")) {
    throw new Error(`${label} must be under docs/validation/artifacts/<run-id>.`);
  }
  if (!relative.endsWith(".json")) {
    throw new Error(`${label} must end in .json.`);
  }
  return relative;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function sha256File(filePath) {
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function readJsonReport(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      exists: false,
      value: null,
    };
  }
  return {
    exists: true,
    value: JSON.parse(fs.readFileSync(absolutePath, "utf8")),
  };
}

function publicUrlMap(report) {
  const urls = report?.publicUrls && typeof report.publicUrls === "object" ? report.publicUrls : {};
  return {
    "account-deletion": urls["account-deletion"] || urls.accountDeletion || "https://freedrecovery.app/account-deletion",
    privacy: urls.privacy || "https://freedrecovery.app/privacy",
    support: urls.support || "https://freedrecovery.app/support",
  };
}

function routeExportsFrom(webReport, hostedReport) {
  const hostedRoutes = new Map(
    (Array.isArray(hostedReport?.routeResults) ? hostedReport.routeResults : []).map((route) => [route.id, route]),
  );
  const routes = Array.isArray(webReport?.routeExports) ? webReport.routeExports : [];
  return routes.map((route) => {
    const hosted = hostedRoutes.get(route.id) || {};
    return {
      contentReady: Array.isArray(route.contentChecks) && route.contentChecks.every((check) => check.present === true),
      hostedContentType: hosted.contentType || "",
      hostedFinalUrl: hosted.finalUrl || "",
      hostedStatus: Number(hosted.status || 0),
      htmlArtifact: route.htmlArtifact || "",
      id: route.id || "",
      publicUrl: route.publicUrl || hosted.publicUrl || "",
      routePath: route.routePath || hosted.routePath || "",
      sha256: route.sha256 || "",
      sizeBytes: Number(route.sizeBytes || 0),
    };
  });
}

function hostingRouteConfigFrom(webReport) {
  return (Array.isArray(webReport?.hostingRouteConfig) ? webReport.hostingRouteConfig : []).map((config) => ({
    exportArtifact: config.exportArtifact || "",
    exportCopied: config.exportCopied === null ? null : config.exportCopied === true,
    exportFile: config.exportFile || "",
    exportSha256: config.exportSha256 || "",
    id: config.id || "",
    sourceFile: config.sourceFile || "",
    sourceReady: config.sourceReady === true,
    sourceSha256: config.sourceSha256 || "",
  }));
}

function manualStaticHostingHandoff(webReport, routeExports, hostedVerified) {
  const hostingRouteConfig = hostingRouteConfigFrom(webReport);
  const cleanUrlRoutingReady =
    hostingRouteConfig.length >= 3 &&
    hostingRouteConfig.every((config) => config.sourceReady === true && config.exportCopied !== false);
  return {
    deployRoot: webReport?.exportDir || "dist",
    cleanUrlRoutingReady,
    storeLegalUrlEntryAllowedAfterDeploy: hostedVerified,
    routeMappings: routeExports.map((route) => ({
      htmlArtifact: route.htmlArtifact,
      publicUrl: route.publicUrl,
      requiredCleanUrl: route.routePath,
      requiredMapping: `${route.routePath} -> /${path.basename(route.htmlArtifact || `${route.id}.html`)}`,
      sha256: route.sha256,
    })),
    routeConfigFiles: hostingRouteConfig,
    providerNotes: [
      "Upload the deploy root contents as the site root, not the repository root.",
      "Netlify and Cloudflare Pages can use the exported _redirects and _headers files in the deploy root.",
      "Vercel can use vercel.json cleanUrls, rewrites, and crawler headers from the repository root.",
      "Any other static host must serve /privacy, /support, and /account-deletion as direct HTTPS 2xx HTML without requiring .html suffixes.",
    ],
    postDeployAuditOrder: [
      "Confirm freedrecovery.app DNS points to the selected static host.",
      "Wait for TLS certificate issuance on https://freedrecovery.app.",
      "Run npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json.",
      "Run npm run evidence:store-legal-web-deploy -- --run-id store-legal-web-deploy-current --output-dir docs/validation/artifacts/store-legal-web-deploy-current.",
      "Run npm run status:launch -- --run-id launch-status-current --output-dir docs/validation/artifacts/launch-status-current.",
    ],
  };
}

function staticHostingBundlePlaceholder(staticExportReady) {
  return {
    archiveArtifact: "",
    archiveCreated: false,
    archiveError: "",
    archiveSha256: "",
    bundleDir: "",
    fileCount: 0,
    generated: false,
    includedFiles: [],
    manifestArtifact: "",
    manifestSha256: "",
    reason: staticExportReady ? "bundle-not-generated-until-packet-write" : "static-export-audit-not-passing",
    totalBytes: 0,
  };
}

function legalWebDeployEnvTemplatePlaceholder(staticExportReady) {
  return {
    activeApprovalPrefilled: false,
    approvalEnv: "FREED_LEGAL_WEB_DEPLOY_APPROVED",
    approvalExpectedValue: "ready-to-deploy-legal-pages",
    artifact: "",
    created: false,
    keys: ["EAS_PROJECT_ID", "EXPO_PROJECT_ID", "EXPO_OWNER", "EXPO_TOKEN"],
    reason: staticExportReady ? "template-not-generated-until-packet-write" : "static-export-audit-not-passing",
    sha256: "",
  };
}

function writeLegalWebDeployEnvTemplate(packet, outputDir) {
  if (!packet.staticExportReady) return legalWebDeployEnvTemplatePlaceholder(false);
  const templatePath = path.join(outputDir, LEGAL_WEB_DEPLOY_ENV_TEMPLATE_NAME);
  const approvalEnv = packet.easDeployment?.approvalEnv || "FREED_LEGAL_WEB_DEPLOY_APPROVED";
  const approvalExpectedValue = packet.easDeployment?.approvalExpectedValue || "ready-to-deploy-legal-pages";
  const content = [
    "# FREED legal web deploy env/action template.",
    "# Copy only the needed blank keys into a private shell or private production env file.",
    "# Do not commit filled values, EXPO_TOKEN, or action-time deploy approvals.",
    `# Generated for run: ${packet.runId}`,
    "",
    "# Expo/EAS project metadata for legal-page deployment.",
    "# Set exactly one project id alias from the linked Expo project.",
    "EAS_PROJECT_ID=",
    "EXPO_PROJECT_ID=",
    "",
    "# Optional Expo account/organization owner, if this project belongs to an org.",
    "EXPO_OWNER=",
    "",
    "# Optional CI auth token. Keep private and never paste into validation artifacts.",
    "EXPO_TOKEN=",
    "",
    "# Action-time approval only. Uncomment/set this in the shell only after:",
    "# - static export audit passes",
    "# - EAS account login or EXPO_TOKEN is active",
    "# - EAS project metadata is linked/readable",
    "# - DNS/static-host target is selected for freedrecovery.app",
    `# ${approvalEnv}=${approvalExpectedValue}`,
    "",
    "# Readiness command:",
    "# npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json",
    "# Approved deploy command, after the checks above:",
    "# npm run eas:deploy:legal-web -- --deploy --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json",
    "",
    "# Boundary: setup handoff only. This does not prove DNS, TLS, hosted URL availability,",
    "# store-console entry, platform approval, sandbox purchases, or physical-device evidence.",
    "",
  ].join("\n");
  fs.writeFileSync(templatePath, content);
  return {
    activeApprovalPrefilled: false,
    approvalEnv,
    approvalExpectedValue,
    artifact: repoRelative(templatePath),
    created: true,
    keys: ["EAS_PROJECT_ID", "EXPO_PROJECT_ID", "EXPO_OWNER", "EXPO_TOKEN"],
    reason: "",
    sha256: sha256File(templatePath),
  };
}

function createStaticHostingBundle(packet, outputDir) {
  if (!packet.staticExportReady) return staticHostingBundlePlaceholder(false);

  const outputRoot = path.resolve(outputDir);
  const bundleRoot = path.join(outputRoot, "static-hosting-bundle");
  const archivePath = path.join(outputRoot, "freed-store-legal-web-static-bundle.zip");
  fs.rmSync(bundleRoot, { recursive: true, force: true });
  fs.rmSync(archivePath, { force: true });
  fs.mkdirSync(bundleRoot, { recursive: true });

  const includedFiles = [];
  const includeFile = (sourceRelative, targetName, kind) => {
    if (!sourceRelative) return;
    const sourcePath = path.resolve(sourceRelative);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) return;
    const targetPath = path.join(bundleRoot, targetName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const stat = fs.statSync(targetPath);
    includedFiles.push({
      bytes: stat.size,
      kind,
      sha256: sha256File(targetPath),
      source: repoRelative(sourcePath),
      target: path.relative(bundleRoot, targetPath).replace(/\\/g, "/"),
    });
  };

  for (const route of packet.routeExports) {
    includeFile(route.htmlArtifact, path.basename(route.htmlArtifact || ""), "legal-route-html");
  }
  for (const config of packet.manualStaticHosting.routeConfigFiles) {
    if (config.exportArtifact) includeFile(config.exportArtifact, path.basename(config.exportArtifact), "hosting-route-config");
    else if (config.sourceFile === "vercel.json") includeFile(config.sourceFile, "vercel.json", "hosting-route-config");
  }

  const manifestPath = path.join(bundleRoot, "static-hosting-manifest.json");
  const manifest = {
    schemaVersion: "freed-static-legal-hosting-bundle-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    publicUrls: packet.publicUrls,
    uploadRoot: repoRelative(bundleRoot),
    routeMappings: packet.manualStaticHosting.routeMappings,
    routeConfigFiles: packet.manualStaticHosting.routeConfigFiles,
    includedFiles,
    providerNotes: packet.manualStaticHosting.providerNotes,
    postDeployAuditOrder: packet.manualStaticHosting.postDeployAuditOrder,
    releaseBoundary:
      "Static hosting upload bundle only. This does not prove DNS ownership, TLS issuance, hosted URL availability, legal review, store-console entry, platform approval, sandbox purchases, or physical-device evidence.",
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  includedFiles.push({
    bytes: fs.statSync(manifestPath).size,
    kind: "bundle-manifest",
    sha256: sha256File(manifestPath),
    source: "",
    target: "static-hosting-manifest.json",
  });

  const readmePath = path.join(bundleRoot, "STATIC_HOSTING_README.md");
  fs.writeFileSync(
    readmePath,
    [
      "# FREED Static Legal Hosting Bundle",
      "",
      "Upload the contents of this folder as the static site root for freedrecovery.app.",
      "After DNS and TLS are live, run the hosted URL audit before entering these URLs in App Store Connect or Google Play Console.",
      "",
      "Required public routes:",
      ...packet.manualStaticHosting.routeMappings.map((route) => `- ${route.requiredCleanUrl}: ${route.requiredMapping}`),
      "",
      "This bundle is not release evidence by itself.",
      "",
    ].join("\n"),
  );
  includedFiles.push({
    bytes: fs.statSync(readmePath).size,
    kind: "bundle-readme",
    sha256: sha256File(readmePath),
    source: "",
    target: "STATIC_HOSTING_README.md",
  });

  let archiveCreated = false;
  let archiveError = "";
  const zipResult = spawnSync("zip", ["-qr", archivePath, "."], {
    cwd: bundleRoot,
    encoding: "utf8",
  });
  if (zipResult.status === 0 && fs.existsSync(archivePath)) {
    archiveCreated = true;
  } else {
    archiveError = `zip command failed with status ${zipResult.status ?? "unknown"}`;
  }

  return {
    archiveArtifact: archiveCreated ? repoRelative(archivePath) : "",
    archiveCreated,
    archiveError,
    archiveSha256: archiveCreated ? sha256File(archivePath) : "",
    bundleDir: repoRelative(bundleRoot),
    fileCount: includedFiles.length,
    generated: true,
    includedFiles,
    manifestArtifact: repoRelative(manifestPath),
    manifestSha256: sha256File(manifestPath),
    reason: "",
    totalBytes: includedFiles.reduce((total, file) => total + file.bytes, 0),
  };
}

function failedHostedChecks(hostedReport) {
  return (Array.isArray(hostedReport?.checks) ? hostedReport.checks : [])
    .filter((check) => check.status === "fail")
    .map((check) => ({
      detail: check.detail || "",
      id: check.id || "",
      next: check.next || "",
    }));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReportTime(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeEasReadinessFreshness(report, sourceReports) {
  const sourceSummaries = sourceReports.map((source) => {
    const exists = isRecord(source.report);
    const generatedAt = exists ? String(source.report.generatedAt || "") : "";
    return {
      artifact: source.artifact,
      exists,
      generatedAt,
      generatedAtMs: parseReportTime(generatedAt),
      id: source.id,
    };
  });
  const publicSourceSummaries = sourceSummaries.map((source) => ({
    artifact: source.artifact,
    exists: source.exists,
    generatedAt: source.generatedAt,
    id: source.id,
  }));
  if (!isRecord(report)) {
    return {
      generatedAt: "",
      newerSourceReports: [],
      sourceReports: publicSourceSummaries,
      staleReason: "eas-readiness-missing",
      status: "missing",
      usableForCurrentSourceReports: false,
    };
  }

  const generatedAt = String(report.generatedAt || "");
  const easGeneratedAtMs = parseReportTime(generatedAt);
  if (easGeneratedAtMs === null) {
    return {
      generatedAt,
      newerSourceReports: [],
      sourceReports: publicSourceSummaries,
      staleReason: "eas-readiness-generatedAt-missing",
      status: "missing-generatedAt",
      usableForCurrentSourceReports: false,
    };
  }

  const missingSources = sourceSummaries.filter((source) => !source.exists);
  if (missingSources.length > 0) {
    return {
      generatedAt,
      newerSourceReports: [],
      sourceReports: publicSourceSummaries,
      staleReason: missingSources.map((source) => `${source.id}-missing`).join(", "),
      status: "source-report-missing",
      usableForCurrentSourceReports: false,
    };
  }

  const sourceTimeIssues = sourceSummaries.filter((source) => source.generatedAtMs === null);
  if (sourceTimeIssues.length > 0) {
    return {
      generatedAt,
      newerSourceReports: [],
      sourceReports: publicSourceSummaries,
      staleReason: sourceTimeIssues.map((source) => `${source.id}-generatedAt-missing`).join(", "),
      status: "source-generatedAt-missing",
      usableForCurrentSourceReports: false,
    };
  }

  const newerSourceReports = sourceSummaries
    .filter((source) => source.generatedAtMs > easGeneratedAtMs)
    .map((source) => ({
      artifact: source.artifact,
      generatedAt: source.generatedAt,
      id: source.id,
    }));
  return {
    generatedAt,
    newerSourceReports,
    sourceReports: publicSourceSummaries,
    staleReason: newerSourceReports.map((source) => `${source.id}-newer-than-eas-readiness`).join(", "),
    status: newerSourceReports.length > 0 ? "stale-source-report" : "current",
    usableForCurrentSourceReports: newerSourceReports.length === 0,
  };
}

function summarizeEasReadiness(report, reportPath, sourceReports) {
  const freshness = summarizeEasReadinessFreshness(report, sourceReports);
  if (!report || typeof report !== "object") {
    return {
      artifact: reportPath,
      exists: false,
      generatedAt: "",
      freshness,
      result: "missing",
      readyForApprovedDeploy: false,
      readyForCurrentApprovedDeploy: false,
      deploymentAttempted: false,
      deploymentBlockedBy: ["eas-legal-web-readiness-missing"],
      accountLoggedIn: false,
      projectIdConfigured: false,
      projectIdFormat: "missing",
      projectIdSource: "missing",
      projectLinked: false,
      approvalEnv: "FREED_LEGAL_WEB_DEPLOY_APPROVED",
      approvalExpectedValue: "ready-to-deploy-legal-pages",
      approvedForDeploy: false,
      usableForCurrentSourceReports: false,
      releaseBoundary:
        "EAS legal web deploy readiness has not been captured. Run npm run eas:deploy:legal-web before attempting public legal URL deployment.",
    };
  }
  const deploymentBlockedBy = Array.isArray(report.deploymentBlockedBy)
    ? report.deploymentBlockedBy.filter((id) => typeof id === "string" && id.trim())
    : [];
  if (freshness.status !== "current" && !deploymentBlockedBy.includes("eas-legal-web-readiness-stale")) {
    deploymentBlockedBy.push("eas-legal-web-readiness-stale");
  }
  const readyForApprovedDeploy = report.readyForApprovedDeploy === true;
  return {
    artifact: reportPath,
    exists: true,
    generatedAt: report.generatedAt || "",
    freshness,
    result: report.result || "",
    readyForApprovedDeploy,
    readyForCurrentApprovedDeploy: readyForApprovedDeploy && freshness.usableForCurrentSourceReports,
    deploymentAttempted: report.deploymentAttempted === true,
    deploymentBlockedBy,
    accountLoggedIn: report.easAccount?.loggedIn === true,
    projectIdConfigured: report.easProject?.projectIdConfigured === true,
    projectIdFormat: report.easProject?.projectIdFormat || "missing",
    projectIdSource: report.easProject?.projectIdSource || "missing",
    projectLinked: report.easProject?.linked === true,
    approvalEnv: report.approval?.env || "FREED_LEGAL_WEB_DEPLOY_APPROVED",
    approvalExpectedValue: report.approval?.expectedValue || "ready-to-deploy-legal-pages",
    approvedForDeploy: report.approval?.approvedForDeploy === true,
    usableForCurrentSourceReports: freshness.usableForCurrentSourceReports,
    releaseBoundary: report.releaseBoundary || "",
  };
}

function buildPacket({
  easReadinessReport,
  easReadinessReportPath,
  hostedReport,
  hostedReportPath,
  outputDir,
  runId,
  webExportReport,
  webExportReportPath,
}) {
  const staticExportReady =
    webExportReport?.sanitized === true &&
    webExportReport?.result === "pass" &&
    Number(webExportReport?.failCount || 0) === 0 &&
    Array.isArray(webExportReport?.routeExports) &&
    webExportReport.routeExports.length === 3;
  const hostedVerified =
    hostedReport?.sanitized === true &&
    hostedReport?.result === "pass" &&
    Number(hostedReport?.failCount || 0) === 0 &&
    Array.isArray(hostedReport?.routeResults) &&
    hostedReport.routeResults.every((route) => Number(route.status || 0) >= 200 && Number(route.status || 0) < 300);
  const hostedFailures = failedHostedChecks(hostedReport);
  const publicUrls = publicUrlMap(webExportReport || hostedReport);
  const routeExports = routeExportsFrom(webExportReport, hostedReport);
  const easDeployment = summarizeEasReadiness(easReadinessReport, easReadinessReportPath, [
    { artifact: webExportReportPath, id: "web-export-report", report: webExportReport },
    { artifact: hostedReportPath, id: "hosted-report", report: hostedReport },
  ]);
  const manualStaticHosting = manualStaticHostingHandoff(webExportReport, routeExports, hostedVerified);
  const deployBlockedBy = [];
  if (!staticExportReady) deployBlockedBy.push("static-export-audit-not-passing");
  if (!hostedVerified) deployBlockedBy.push(hostedFailures.some((failure) => failure.detail.includes("ENOTFOUND")) ? "dns-not-resolving" : "hosted-url-audit-not-passing");
  if (!hostedVerified && easDeployment.exists) {
    for (const blocker of easDeployment.deploymentBlockedBy) {
      if (!deployBlockedBy.includes(blocker)) deployBlockedBy.push(blocker);
    }
  }
  if (!hostedVerified && !easDeployment.exists && !deployBlockedBy.includes("eas-legal-web-readiness-missing")) {
    deployBlockedBy.push("eas-legal-web-readiness-missing");
  }
  const readyForApprovedDeploy = staticExportReady && easDeployment.readyForCurrentApprovedDeploy === true;
  const result = hostedVerified
    ? "hosted-verified"
    : readyForApprovedDeploy
      ? "ready-for-approved-deploy"
      : staticExportReady
        ? "static-export-ready-deploy-blocked"
        : "blocked-before-deploy";

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result,
    runId,
    staticExportReady,
    hostedVerified,
    readyForApprovedDeploy,
    deployBlockedBy,
    publicUrls,
    easDeployment,
    manualStaticHosting,
    legalWebDeployEnvTemplate: legalWebDeployEnvTemplatePlaceholder(staticExportReady),
    staticHostingBundle: staticHostingBundlePlaceholder(staticExportReady),
    routeExports,
    sourceReports: {
      easReadinessReport: easReadinessReportPath,
      hostedReport: hostedReportPath,
      webExportReport: webExportReportPath,
    },
    commands: {
      exportWeb: "npm run export:web",
      auditStaticExport:
        "npm run audit:store-legal-web -- --report docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json",
      createDeployPacket:
        `npm run evidence:store-legal-web-deploy -- --run-id ${runId} --output-dir ${repoRelative(outputDir)}`,
      checkEasLegalWebDeploy:
        "npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json",
      easHostingDeploy:
        "FREED_LEGAL_WEB_DEPLOY_APPROVED=ready-to-deploy-legal-pages npm run eas:deploy:legal-web -- --deploy --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json",
      hostedAudit:
        "npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json",
      refreshLaunchStatus:
        "npm run status:launch -- --run-id launch-status-current --output-dir docs/validation/artifacts/launch-status-current",
    },
    dnsChecklist: [
      "Select the static hosting target for the Expo web export and attach the custom domain freedrecovery.app.",
      "Create the provider-required apex A/AAAA/ALIAS/ANAME or CNAME records for freedrecovery.app.",
      "Optionally route www.freedrecovery.app to freedrecovery.app with HTTPS redirect.",
      "Wait for DNS propagation and TLS certificate issuance before entering URLs in App Store Connect or Play Console.",
      "Verify /privacy, /support, and /account-deletion return direct HTTPS 2xx HTML without noindex.",
      "Rerun the hosted legal URL audit and refresh launch status after deployment.",
    ],
    hostedFailures,
    releaseBoundary:
      "Deployment handoff only. This does not prove DNS ownership, TLS issuance, hosted URL availability, legal review, store-console entry, platform approval, sandbox purchases, or physical-device evidence.",
  };
}

function markdownTable(headers, rows) {
  const clean = (value) => String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

function buildMarkdown(packet) {
  const lines = [
    `# Store Legal Web Deploy Packet: ${packet.runId}`,
    "",
    `Generated: ${packet.generatedAt}`,
    `Result: ${packet.result}`,
    `Static export ready: ${packet.staticExportReady}`,
    `Hosted URLs verified: ${packet.hostedVerified}`,
    `Ready for approved deploy: ${packet.readyForApprovedDeploy}`,
  ];
  if (packet.deployBlockedBy.length > 0) {
    lines.push(`Deploy blocked by: ${packet.deployBlockedBy.join(", ")}`);
  }
  lines.push(
    "",
    "## Public URLs",
    "",
    markdownTable(
      ["Route", "Public URL", "Static HTML", "SHA-256", "Hosted Status"],
      packet.routeExports.map((route) => [
        route.routePath,
        route.publicUrl,
        route.htmlArtifact,
        route.sha256,
        route.hostedStatus || "not reachable",
      ]),
    ),
    "",
    "## Manual Static Hosting Handoff",
    "",
    `- Deploy root: \`${packet.manualStaticHosting.deployRoot}\``,
    `- Clean URL routing ready: ${packet.manualStaticHosting.cleanUrlRoutingReady}`,
    `- Store legal URL entry allowed after deploy/audit: ${packet.manualStaticHosting.storeLegalUrlEntryAllowedAfterDeploy}`,
    "",
    markdownTable(
      ["Route", "Required Mapping", "Static HTML", "SHA-256"],
      packet.manualStaticHosting.routeMappings.map((route) => [
        route.requiredCleanUrl,
        route.requiredMapping,
        route.htmlArtifact,
        route.sha256,
      ]),
    ),
    "",
    markdownTable(
      ["Config", "Source", "Exported", "Source SHA-256", "Export SHA-256"],
      packet.manualStaticHosting.routeConfigFiles.map((config) => [
        config.id,
        config.sourceFile,
        config.exportArtifact || (config.exportFile ? "missing" : "repo-root only"),
        config.sourceSha256,
        config.exportSha256 || "n/a",
      ]),
    ),
    "",
    ...packet.manualStaticHosting.providerNotes.map((item) => `- ${item}`),
    "",
    "Post-deploy audit order:",
    "",
    ...packet.manualStaticHosting.postDeployAuditOrder.map((item) => `- ${item}`),
    "",
    "## Static Hosting Bundle",
    "",
  );
  if (packet.staticHostingBundle?.generated) {
    lines.push(
      `- Bundle dir: \`${packet.staticHostingBundle.bundleDir}\``,
      `- Archive created: ${packet.staticHostingBundle.archiveCreated}`,
      `- Archive: ${packet.staticHostingBundle.archiveArtifact ? `\`${packet.staticHostingBundle.archiveArtifact}\`` : "not created"}`,
      `- Archive SHA-256: ${packet.staticHostingBundle.archiveSha256 ? `\`${packet.staticHostingBundle.archiveSha256}\`` : "n/a"}`,
      `- Manifest: \`${packet.staticHostingBundle.manifestArtifact}\``,
      `- Manifest SHA-256: \`${packet.staticHostingBundle.manifestSha256}\``,
      `- Included files: ${packet.staticHostingBundle.fileCount}`,
      `- Total bytes: ${packet.staticHostingBundle.totalBytes}`,
      "",
      markdownTable(
        ["Kind", "Target", "Bytes", "SHA-256"],
        packet.staticHostingBundle.includedFiles.map((file) => [
          file.kind,
          file.target,
          file.bytes,
          file.sha256,
        ]),
      ),
      "",
    );
    if (packet.staticHostingBundle.archiveError) {
      lines.push(`- Archive error: ${packet.staticHostingBundle.archiveError}`, "");
    }
  } else {
    lines.push(`- Bundle not generated: ${packet.staticHostingBundle?.reason || "unknown"}`, "");
  }
  lines.push(
    "## Deployment Commands",
    "",
    "Run these after choosing the static host and configuring the production domain:",
    "",
    "```bash",
    packet.commands.exportWeb,
    packet.commands.auditStaticExport,
    packet.commands.checkEasLegalWebDeploy,
    packet.commands.easHostingDeploy,
    packet.commands.hostedAudit,
    packet.commands.refreshLaunchStatus,
    "```",
    "",
    "## DNS And Hosting Checklist",
    "",
    ...packet.dnsChecklist.map((item) => `- ${item}`),
    "",
    "## Legal Web Deploy Env Template",
    "",
  );
  if (packet.legalWebDeployEnvTemplate?.created) {
    lines.push(
      `- Template: \`${packet.legalWebDeployEnvTemplate.artifact}\``,
      `- SHA-256: \`${packet.legalWebDeployEnvTemplate.sha256}\``,
      `- Keys: ${packet.legalWebDeployEnvTemplate.keys.map((key) => `\`${key}\``).join(", ")}`,
      `- Approval env: ${packet.legalWebDeployEnvTemplate.approvalEnv}=${packet.legalWebDeployEnvTemplate.approvalExpectedValue}`,
      `- Active approval prefilled: ${packet.legalWebDeployEnvTemplate.activeApprovalPrefilled}`,
      "",
    );
  } else {
    lines.push(`- Template not generated: ${packet.legalWebDeployEnvTemplate?.reason || "unknown"}`, "");
  }
  lines.push(
    "## EAS Deploy Readiness",
    "",
    `- Artifact: ${packet.easDeployment.artifact}`,
    `- Generated: ${packet.easDeployment.generatedAt || "missing"}`,
    `- Result: ${packet.easDeployment.result}`,
    `- Source freshness: ${packet.easDeployment.freshness.status}`,
    `- Usable for current source reports: ${packet.easDeployment.usableForCurrentSourceReports}`,
    `- Ready for approved deploy: ${packet.easDeployment.readyForApprovedDeploy}`,
    `- Ready for current approved deploy: ${packet.easDeployment.readyForCurrentApprovedDeploy}`,
    `- Deployment attempted: ${packet.easDeployment.deploymentAttempted}`,
    `- EAS account logged in: ${packet.easDeployment.accountLoggedIn}`,
    `- EAS project ID configured: ${packet.easDeployment.projectIdConfigured}`,
    `- EAS project ID source: ${packet.easDeployment.projectIdSource}`,
    `- EAS project ID format: ${packet.easDeployment.projectIdFormat}`,
    `- EAS project linked: ${packet.easDeployment.projectLinked}`,
    `- Approval env: ${packet.easDeployment.approvalEnv}=${packet.easDeployment.approvalExpectedValue}`,
    `- Approval set now: ${packet.easDeployment.approvedForDeploy}`,
  );
  if (packet.easDeployment.freshness.staleReason) {
    lines.push(`- Source freshness reason: ${packet.easDeployment.freshness.staleReason}`);
  }
  if (packet.easDeployment.freshness.newerSourceReports.length > 0) {
    for (const source of packet.easDeployment.freshness.newerSourceReports) {
      lines.push(`- Newer source report: ${source.id} (${source.generatedAt})`);
    }
  }
  if (packet.easDeployment.deploymentBlockedBy.length > 0) {
    lines.push(
      `- EAS deploy blocked by: ${packet.easDeployment.deploymentBlockedBy.join(", ")}`,
    );
  }
  if (packet.easDeployment.releaseBoundary) {
    lines.push(`- Boundary: ${packet.easDeployment.releaseBoundary}`);
  }
  lines.push(
    "",
    "## Current Hosted Failures",
    "",
  );

  if (packet.hostedFailures.length > 0) {
    for (const failure of packet.hostedFailures) {
      lines.push(`- ${failure.id}: ${failure.detail}`);
      if (failure.next) lines.push(`  - Next: ${failure.next}`);
    }
  } else {
    lines.push("- No hosted failures in the supplied hosted audit report.");
  }

  lines.push(
    "",
    "## Boundary",
    "",
    packet.releaseBoundary,
    "",
    "Do not enter these URLs in store-console production fields until the hosted audit passes and launch status is refreshed.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runSelfTest() {
  assert.equal(safeRunId("deploy-1"), "deploy-1");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => assertSafeInputReportPath("docs/validation/evidence/report.json", "--web-export-report"), /artifacts/);
  assert.throws(() => parseArgs(["--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);

  const webReport = {
    failCount: 0,
    generatedAt: "2026-05-13T10:00:00.000Z",
    hostingRouteConfig: [
      {
        exportArtifact: "dist/_redirects",
        exportCopied: true,
        exportFile: "_redirects",
        exportSha256: "sha256-r",
        id: "netlify-cloudflare-clean-url-redirects",
        sourceFile: "public/_redirects",
        sourceReady: true,
        sourceSha256: "sha256-rs",
      },
      {
        exportArtifact: "dist/_headers",
        exportCopied: true,
        exportFile: "_headers",
        exportSha256: "sha256-h",
        id: "netlify-cloudflare-crawler-headers",
        sourceFile: "public/_headers",
        sourceReady: true,
        sourceSha256: "sha256-hs",
      },
      {
        exportArtifact: "",
        exportCopied: null,
        exportFile: "",
        exportSha256: "",
        id: "vercel-clean-url-rewrites",
        sourceFile: "vercel.json",
        sourceReady: true,
        sourceSha256: "sha256-v",
      },
    ],
    publicUrls: publicUrlMap(null),
    result: "pass",
    routeExports: [
      { contentChecks: [{ present: true }], htmlArtifact: "dist/privacy.html", id: "privacy", publicUrl: "https://freedrecovery.app/privacy", routePath: "/privacy", sha256: "sha256-a", sizeBytes: 10 },
      { contentChecks: [{ present: true }], htmlArtifact: "dist/support.html", id: "support", publicUrl: "https://freedrecovery.app/support", routePath: "/support", sha256: "sha256-b", sizeBytes: 10 },
      { contentChecks: [{ present: true }], htmlArtifact: "dist/account-deletion.html", id: "account-deletion", publicUrl: "https://freedrecovery.app/account-deletion", routePath: "/account-deletion", sha256: "sha256-c", sizeBytes: 10 },
    ],
    sanitized: true,
  };
  const hostedReport = {
    checks: [{ id: "hosted-fetch-privacy", status: "fail", detail: "fetch failed; code=ENOTFOUND; host=freedrecovery.app", next: "Deploy." }],
    failCount: 1,
    generatedAt: "2026-05-13T10:00:00.000Z",
    result: "fail",
    routeResults: [{ id: "privacy", publicUrl: "https://freedrecovery.app/privacy", routePath: "/privacy", status: 0 }],
    sanitized: true,
  };
  const easReadinessReport = {
    approval: {
      approvedForDeploy: false,
      env: "FREED_LEGAL_WEB_DEPLOY_APPROVED",
      expectedValue: "ready-to-deploy-legal-pages",
    },
    deploymentAttempted: false,
    deploymentBlockedBy: ["eas-account-not-logged-in", "eas-project-id-not-configured", "eas-project-not-linked"],
    easAccount: { loggedIn: false },
    easProject: {
      linked: false,
      projectIdConfigured: false,
      projectIdFormat: "missing",
      projectIdSource: "missing",
    },
    generatedAt: "2026-05-13T10:01:00.000Z",
    readyForApprovedDeploy: false,
    releaseBoundary: "EAS readiness boundary.",
    result: "blocked-before-deploy",
    sanitized: true,
  };
  const readyPacket = buildPacket({
    easReadinessReport,
    easReadinessReportPath: DEFAULT_EAS_READINESS_REPORT,
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: "self-test",
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(readyPacket.result, "static-export-ready-deploy-blocked");
  assert.equal(readyPacket.staticExportReady, true);
  assert.equal(readyPacket.hostedVerified, false);
  assert.equal(readyPacket.readyForApprovedDeploy, false);
  assert.ok(readyPacket.deployBlockedBy.includes("dns-not-resolving"));
  assert.ok(readyPacket.deployBlockedBy.includes("eas-account-not-logged-in"));
  assert.ok(readyPacket.deployBlockedBy.includes("eas-project-id-not-configured"));
  assert.equal(readyPacket.manualStaticHosting.deployRoot, "dist");
  assert.equal(readyPacket.manualStaticHosting.cleanUrlRoutingReady, true);
  assert.equal(readyPacket.manualStaticHosting.storeLegalUrlEntryAllowedAfterDeploy, false);
  assert.equal(readyPacket.manualStaticHosting.routeConfigFiles.length, 3);
  assert.equal(readyPacket.legalWebDeployEnvTemplate.created, false);
  assert.equal(readyPacket.legalWebDeployEnvTemplate.activeApprovalPrefilled, false);
  assert.equal(readyPacket.easDeployment.freshness.status, "current");
  assert.equal(readyPacket.easDeployment.projectIdConfigured, false);
  assert.equal(readyPacket.easDeployment.usableForCurrentSourceReports, true);
  assert.match(buildMarkdown(readyPacket), /Store Legal Web Deploy Packet/);
  assert.match(buildMarkdown(readyPacket), /Manual Static Hosting Handoff/);
  assert.match(buildMarkdown(readyPacket), /Static Hosting Bundle/);
  assert.match(buildMarkdown(readyPacket), /Legal Web Deploy Env Template/);
  assert.match(buildMarkdown(readyPacket), /Template not generated: template-not-generated-until-packet-write/);
  assert.match(buildMarkdown(readyPacket), /Bundle not generated: bundle-not-generated-until-packet-write/);
  assert.match(buildMarkdown(readyPacket), /Clean URL routing ready: true/);
  assert.match(buildMarkdown(readyPacket), /dist\/_redirects/);
  assert.match(buildMarkdown(readyPacket), /\/privacy -> \/privacy\.html/);
  assert.match(buildMarkdown(readyPacket), /Ready for approved deploy: false/);
  assert.match(buildMarkdown(readyPacket), /eas:deploy:legal-web/);
  assert.match(buildMarkdown(readyPacket), /EAS project ID configured: false/);
  assert.match(buildMarkdown(readyPacket), /Usable for current source reports: true/);

  const stalePacket = buildPacket({
    easReadinessReport: { ...easReadinessReport, generatedAt: "2026-05-13T09:59:00.000Z" },
    easReadinessReportPath: DEFAULT_EAS_READINESS_REPORT,
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: "self-test",
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(stalePacket.easDeployment.freshness.status, "stale-source-report");
  assert.equal(stalePacket.easDeployment.usableForCurrentSourceReports, false);
  assert.ok(stalePacket.deployBlockedBy.includes("eas-legal-web-readiness-stale"));
  assert.match(buildMarkdown(stalePacket), /eas-legal-web-readiness-stale/);

  const hostedPass = {
    failCount: 0,
    generatedAt: "2026-05-13T10:00:00.000Z",
    result: "pass",
    routeResults: webReport.routeExports.map((route) => ({
      ...route,
      contentType: "text/html; charset=utf-8",
      finalUrl: route.publicUrl,
      status: 200,
    })),
    sanitized: true,
  };
  const verifiedPacket = buildPacket({
    easReadinessReport,
    easReadinessReportPath: DEFAULT_EAS_READINESS_REPORT,
    hostedReport: hostedPass,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: "self-test",
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(verifiedPacket.result, "hosted-verified");
  assert.equal(verifiedPacket.hostedVerified, true);
  console.log("store legal web deploy packet self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const webRead = readJsonReport(options.webExportReport);
  const hostedRead = readJsonReport(options.hostedReport);
  const easRead = readJsonReport(options.easReadinessReport);
  const packet = buildPacket({
    easReadinessReport: easRead.value,
    easReadinessReportPath: options.easReadinessReport,
    hostedReport: hostedRead.value,
    hostedReportPath: options.hostedReport,
    outputDir: options.outputDir,
    runId: options.runId,
    webExportReport: webRead.value,
    webExportReportPath: options.webExportReport,
  });
  packet.staticHostingBundle = createStaticHostingBundle(packet, options.outputDir);
  packet.legalWebDeployEnvTemplate = writeLegalWebDeployEnvTemplate(packet, options.outputDir);
  const jsonPath = path.join(options.outputDir, "store-legal-web-deploy-packet.json");
  const markdownPath = path.join(options.outputDir, "STORE_LEGAL_WEB_DEPLOY_PACKET.md");
  writeJsonArtifact(jsonPath, packet);
  writeTextArtifact(markdownPath, buildMarkdown(packet));
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(jsonPath),
        deployBlockedBy: packet.deployBlockedBy,
        easReadinessFreshness: packet.easDeployment.freshness.status,
        markdownArtifact: repoRelative(markdownPath),
        staticHostingArchive: packet.staticHostingBundle.archiveArtifact,
        staticHostingBundleDir: packet.staticHostingBundle.bundleDir,
        hostedVerified: packet.hostedVerified,
        result: packet.result,
        sanitized: packet.sanitized,
        schemaVersion: packet.schemaVersion,
        staticExportReady: packet.staticExportReady,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  buildMarkdown,
  buildPacket,
  publicUrlMap,
  routeExportsFrom,
};
