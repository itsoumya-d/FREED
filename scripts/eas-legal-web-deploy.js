#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "freed-eas-legal-web-deploy-readiness-v1";
const DEFAULT_REPORT =
  "docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json";
const DEFAULT_WEB_EXPORT_REPORT =
  "docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json";
const DEFAULT_HOSTED_REPORT =
  "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
const APPROVAL_ENV = "FREED_LEGAL_WEB_DEPLOY_APPROVED";
const APPROVAL_TOKEN = "ready-to-deploy-legal-pages";

function printHelp() {
  console.log(`Usage: npm run eas:deploy:legal-web -- [options]

Checks whether the current Expo/EAS environment can deploy FREED's static
privacy, support, and account-deletion pages. By default this writes a
sanitized readiness report only. Use --deploy only after the static export
audit passes and the owner has approved public legal-page deployment.

Options:
  --report <path>             Readiness JSON report under docs/validation/artifacts.
                              Default: ${DEFAULT_REPORT}
  --web-export-report <path>  Store legal static export audit JSON.
                              Default: ${DEFAULT_WEB_EXPORT_REPORT}
  --hosted-report <path>      Hosted legal URL audit JSON.
                              Default: ${DEFAULT_HOSTED_REPORT}
  --deploy                    Run npx eas-cli deploy --prod after all guard checks pass.
                              Requires ${APPROVAL_ENV}=${APPROVAL_TOKEN}.
  --self-test                 Run offline guard tests.
  --help, -h                  Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    deploy: false,
    hostedReport: DEFAULT_HOSTED_REPORT,
    reportPath: DEFAULT_REPORT,
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

    if (arg === "--deploy") options.deploy = true;
    else if (arg === "--hosted-report") options.hostedReport = next();
    else if (arg === "--report") options.reportPath = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--web-export-report") options.webExportReport = next();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  options.webExportReport = assertSafeReportPath(options.webExportReport, "--web-export-report");
  options.hostedReport = assertSafeReportPath(options.hostedReport, "--hosted-report");
  return options;
}

function repoRelative(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, value: null };
  return { exists: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) };
}

function readTrimmedEnv(env, name) {
  const value = env && Object.prototype.hasOwnProperty.call(env, name) ? env[name] : "";
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function projectIdFormat(projectId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
    ? "uuid"
    : "non-empty";
}

function readFirstProjectIdEnv(env) {
  for (const name of ["EAS_PROJECT_ID", "EXPO_PROJECT_ID"]) {
    const value = readTrimmedEnv(env, name);
    if (value) return { name, value };
  }
  return { name: "", value: "" };
}

function readEasProjectConfig({
  appConfigPath = path.join(ROOT, "app.config.js"),
  appJsonPath = path.join(ROOT, "app.json"),
  env = process.env,
} = {}) {
  const summary = {
    appJsonPath: repoRelative(appJsonPath),
    appConfigPath: repoRelative(appConfigPath),
    dynamicProjectIdSupported: false,
    ownerConfigured: false,
    ownerSource: "missing",
    projectIdConfigured: false,
    projectIdEnvKeys: ["EAS_PROJECT_ID", "EXPO_PROJECT_ID"],
    projectIdFormat: "missing",
    source: "missing",
  };

  const envOwner = readTrimmedEnv(env, "EXPO_OWNER");
  if (envOwner) {
    summary.ownerConfigured = true;
    summary.ownerSource = "env:EXPO_OWNER";
  }

  const envProjectId = readFirstProjectIdEnv(env);
  if (envProjectId.value) {
    summary.projectIdConfigured = true;
    summary.projectIdFormat = projectIdFormat(envProjectId.value);
    summary.source = `env:${envProjectId.name}`;
    return summary;
  }

  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      const expo = appJson && typeof appJson === "object" ? appJson.expo || {} : {};
      const projectId = String(expo?.extra?.eas?.projectId || "").trim();
      if (!summary.ownerConfigured && String(expo?.owner || "").trim()) {
        summary.ownerConfigured = true;
        summary.ownerSource = "app.json:expo.owner";
      }
      if (projectId) {
        summary.projectIdConfigured = true;
        summary.projectIdFormat = projectIdFormat(projectId);
        summary.source = "app.json:expo.extra.eas.projectId";
        return summary;
      }
    } catch (error) {
      summary.source = "app.json-unreadable";
      summary.projectIdFormat = "unreadable";
      return summary;
    }
  }

  if (fs.existsSync(appConfigPath)) {
    const appConfigSource = fs.readFileSync(appConfigPath, "utf8");
    if (/\bprojectId\b/.test(appConfigSource) && /\beas\b/.test(appConfigSource) && /\b(?:EAS_PROJECT_ID|EXPO_PROJECT_ID)\b/.test(appConfigSource)) {
      summary.dynamicProjectIdSupported = true;
      summary.projectIdFormat = "env-missing";
      summary.source = "app.config.js:env-projectId-marker";
    }
  }

  return summary;
}

function isStaticExportReady(webReport) {
  return (
    webReport?.sanitized === true &&
    webReport?.result === "pass" &&
    Number(webReport?.failCount || 0) === 0 &&
    Array.isArray(webReport?.routeExports) &&
    webReport.routeExports.length === 3 &&
    webReport.routeExports.every((route) =>
      Array.isArray(route.contentChecks) && route.contentChecks.every((check) => check.present === true)
    )
  );
}

function isHostedVerified(hostedReport) {
  return (
    hostedReport?.sanitized === true &&
    hostedReport?.result === "pass" &&
    Number(hostedReport?.failCount || 0) === 0 &&
    Array.isArray(hostedReport?.routeResults) &&
    hostedReport.routeResults.length === 3 &&
    hostedReport.routeResults.every((route) => Number(route.status || 0) >= 200 && Number(route.status || 0) < 300)
  );
}

function sanitizeText(value) {
  const home = process.env.HOME || "";
  let text = String(value || "");
  if (home) text = text.split(home).join("<home>");
  text = text.split(ROOT).join("<workspace>");
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>");
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>");
  text = text.replace(/\b(?:[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{20,}\b/g, "<jwt-redacted>");
  text = text.replace(/\s+/g, " ").trim();
  return text.length > 600 ? `${text.slice(0, 600)}...` : text;
}

function commandSummary(args) {
  return ["npx", "eas-cli", ...args].join(" ");
}

function commandEnv() {
  const pathEntries = [
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH || "",
  ]
    .filter(Boolean)
    .join(path.delimiter);

  return {
    ...process.env,
    CI: "1",
    EXPO_NO_TELEMETRY: "1",
    PATH: pathEntries,
  };
}

function runEasCommand(args, { timeoutMs = 75000 } = {}) {
  const result = spawnSync("npx", ["eas-cli", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: commandEnv(),
    timeout: timeoutMs,
  });
  const stdout = sanitizeText(result.stdout);
  const stderr = sanitizeText(result.stderr);
  return {
    command: commandSummary(args),
    exitCode: typeof result.status === "number" ? result.status : null,
    outputSnippet: stdout || stderr,
    signal: result.signal || null,
    status: result.status === 0 ? "pass" : "fail",
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
  };
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function firstUsefulLine(text) {
  return String(text || "")
    .split(/\r?\n| \| /)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function buildReadiness({
  deploy,
  env = process.env,
  projectConfig = readEasProjectConfig(),
  hostedReport,
  hostedReportPath,
  runCommand = runEasCommand,
  webExportReport,
  webExportReportPath,
}) {
  const checks = [];
  const deploymentBlockedBy = [];
  const staticExportReady = isStaticExportReady(webExportReport);
  const hostedVerified = isHostedVerified(hostedReport);
  const approvedForDeploy = env[APPROVAL_ENV] === APPROVAL_TOKEN;

  pushCheck(
    checks,
    "static-export-audit-ready",
    staticExportReady,
    staticExportReady
      ? "The current Expo static export contains crawler-readable privacy, support, and account-deletion HTML."
      : "The store legal static export audit is missing, stale, or failing.",
    "Run npm run export:web and npm run audit:store-legal-web before deploying legal pages."
  );
  if (!staticExportReady) deploymentBlockedBy.push("static-export-audit-not-passing");

  const cli = runCommand(["--version"]);
  const cliReady = cli.status === "pass";
  pushCheck(
    checks,
    "eas-cli-available",
    cliReady,
    cliReady ? `EAS CLI is available: ${cli.outputSnippet}` : `EAS CLI is unavailable: ${cli.outputSnippet}`,
    "Install or allow npx eas-cli, then rerun this readiness check."
  );
  if (!cliReady) deploymentBlockedBy.push("eas-cli-unavailable");

  const projectIdConfigured = projectConfig.projectIdConfigured === true;
  pushCheck(
    checks,
    "eas-project-id-configured",
    projectIdConfigured,
    projectIdConfigured
      ? `EAS project link metadata is configured via ${projectConfig.source}.`
      : projectConfig.dynamicProjectIdSupported
        ? "app.config.js supports env-backed EAS project metadata, but EAS_PROJECT_ID or EXPO_PROJECT_ID is not set for this readiness run."
        : "No EAS project link metadata was found in app.json expo.extra.eas.projectId or env-backed app.config.js.",
    "Set EAS_PROJECT_ID or EXPO_PROJECT_ID from the linked Expo project for this run, or run npx eas-cli init with the correct Expo account/project and commit only public project link metadata."
  );
  if (!projectIdConfigured) deploymentBlockedBy.push("eas-project-id-not-configured");

  const account = cliReady ? runCommand(["whoami"]) : { status: "fail", outputSnippet: "Skipped because EAS CLI is unavailable." };
  const accountName = account.status === "pass" ? firstUsefulLine(account.outputSnippet) : "";
  const loggedIn = account.status === "pass" && accountName && !/not logged in/i.test(accountName);
  pushCheck(
    checks,
    "eas-account-login",
    loggedIn,
    loggedIn ? `EAS account is logged in as ${accountName}.` : `EAS account is not logged in: ${account.outputSnippet}`,
    "Run npx eas-cli login, or set EXPO_TOKEN for CI, then rerun this readiness check."
  );
  if (!loggedIn) deploymentBlockedBy.push("eas-account-not-logged-in");

  const project = loggedIn && projectIdConfigured
    ? runCommand(["project:info"])
    : {
        status: "fail",
        outputSnippet: projectIdConfigured
          ? "Skipped because EAS account is not logged in."
          : "Skipped because EAS project link metadata is not configured.",
      };
  const projectLinked = project.status === "pass";
  pushCheck(
    checks,
    "eas-project-linked",
    projectLinked,
    projectLinked ? "EAS project metadata is readable for this workspace." : `EAS project metadata is not readable: ${project.outputSnippet}`,
    "Run npx eas-cli project:info after logging in, and run npx eas-cli init if this project is not linked."
  );
  if (!projectLinked) deploymentBlockedBy.push("eas-project-not-linked");

  if (deploy && !approvedForDeploy) {
    deploymentBlockedBy.push("legal-web-deploy-approval-not-set");
  }

  let deployCommand = null;
  let deploymentAttempted = false;
  if (deploy && deploymentBlockedBy.length === 0) {
    deploymentAttempted = true;
    deployCommand = runCommand(["deploy", "--prod", "--non-interactive"], { timeoutMs: 10 * 60 * 1000 });
    pushCheck(
      checks,
      "eas-legal-web-deploy-command",
      deployCommand.status === "pass",
      deployCommand.status === "pass"
        ? "EAS legal web deploy command completed."
        : `EAS legal web deploy command failed: ${deployCommand.outputSnippet}`,
      "Fix the EAS deployment error, rerun the guarded deploy, then rerun the hosted legal URL audit."
    );
    if (deployCommand.status !== "pass") deploymentBlockedBy.push("eas-legal-web-deploy-command-failed");
  }

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const readyForApprovedDeploy =
    staticExportReady && cliReady && loggedIn && projectLinked && deploymentBlockedBy.every((id) => id === "legal-web-deploy-approval-not-set");
  const result = deploymentAttempted
    ? deployCommand?.status === "pass"
      ? "deployed"
      : "deploy-failed"
    : readyForApprovedDeploy
      ? "ready-for-approved-deploy"
      : "blocked-before-deploy";

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result,
    mode: deploy ? "deploy" : "readiness",
    passCount,
    failCount,
    staticExportReady,
    hostedAlreadyVerified: hostedVerified,
    readyForApprovedDeploy,
    approval: {
      env: APPROVAL_ENV,
      expectedValue: APPROVAL_TOKEN,
      approvedForDeploy,
      requiredForDeploy: true,
    },
    easCli: cli,
    easAccount: {
      loggedIn,
      accountName: loggedIn ? accountName : "",
      command: account.command || commandSummary(["whoami"]),
      status: loggedIn ? "pass" : "fail",
      outputSnippet: account.outputSnippet || "",
    },
    easProject: {
      dynamicProjectIdSupported: projectConfig.dynamicProjectIdSupported === true,
      linked: projectLinked,
      command: project.command || commandSummary(["project:info"]),
      projectIdConfigured,
      projectIdEnvKeys: Array.isArray(projectConfig.projectIdEnvKeys)
        ? projectConfig.projectIdEnvKeys
        : ["EAS_PROJECT_ID", "EXPO_PROJECT_ID"],
      projectIdFormat: projectConfig.projectIdFormat || "missing",
      projectIdSource: projectConfig.source || "missing",
      status: projectLinked ? "pass" : "fail",
      outputSnippet: project.outputSnippet || "",
    },
    deploymentAttempted,
    deployCommand,
    deploymentBlockedBy,
    sourceReports: {
      hostedReport: repoRelative(hostedReportPath),
      webExportReport: repoRelative(webExportReportPath),
    },
    commands: {
      exportWeb: "npm run export:web",
      auditStaticExport:
        "npm run audit:store-legal-web -- --report docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json",
      readiness:
        "npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json",
      approvedDeploy:
        `${APPROVAL_ENV}=${APPROVAL_TOKEN} npm run eas:deploy:legal-web -- --deploy --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json`,
      hostedAudit:
        "npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json",
      refreshLaunchStatus:
        "npm run status:launch -- --run-id launch-status-current --output-dir docs/validation/artifacts/launch-status-current",
    },
    checks,
    releaseBoundary:
      "EAS legal web deploy readiness only. This does not prove DNS ownership, custom-domain attachment, TLS issuance, hosted URL availability, legal review, store-console entry, platform approval, sandbox purchases, or physical-device evidence.",
  };
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runSelfTest() {
  const webReport = {
    failCount: 0,
    result: "pass",
    routeExports: [
      { id: "privacy", contentChecks: [{ present: true }] },
      { id: "support", contentChecks: [{ present: true }] },
      { id: "account-deletion", contentChecks: [{ present: true }] },
    ],
    sanitized: true,
  };
  const hostedReport = {
    failCount: 3,
    result: "fail",
    routeResults: [],
    sanitized: true,
  };
  const commandRunner = (args) => {
    const joined = args.join(" ");
    if (joined === "--version") return { command: commandSummary(args), outputSnippet: "eas-cli/20.1.0", status: "pass", exitCode: 0 };
    if (joined === "whoami") return { command: commandSummary(args), outputSnippet: "freed-owner", status: "pass", exitCode: 0 };
    if (joined === "project:info") return { command: commandSummary(args), outputSnippet: "Project: FREED", status: "pass", exitCode: 0 };
    if (joined === "deploy --prod --non-interactive") return { command: commandSummary(args), outputSnippet: "Deployment created", status: "pass", exitCode: 0 };
    throw new Error(`Unexpected command ${joined}`);
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-eas-legal-web-self-test-"));
  try {
    const tempAppJsonPath = path.join(tempDir, "app.json");
    const tempAppConfigPath = path.join(tempDir, "app.config.js");
    fs.writeFileSync(tempAppJsonPath, `${JSON.stringify({ expo: { slug: "freed" } }, null, 2)}\n`);
    fs.writeFileSync(
      tempAppConfigPath,
      [
        "function readEnv(name) { return process.env[name]; }",
        "module.exports = ({ config }) => ({",
        "  ...config,",
        "  extra: { eas: { projectId: readEnv('EAS_PROJECT_ID') ?? readEnv('EXPO_PROJECT_ID') } }",
        "});",
        "",
      ].join("\n"),
    );

    const envConfiguredProject = readEasProjectConfig({
      appConfigPath: tempAppConfigPath,
      appJsonPath: tempAppJsonPath,
      env: {
        EAS_PROJECT_ID: "123e4567-e89b-12d3-a456-426614174000",
        EXPO_OWNER: "freed-owner",
      },
    });
    assert.equal(envConfiguredProject.projectIdConfigured, true);
    assert.equal(envConfiguredProject.projectIdFormat, "uuid");
    assert.equal(envConfiguredProject.source, "env:EAS_PROJECT_ID");
    assert.equal(envConfiguredProject.ownerConfigured, true);
    assert.equal(envConfiguredProject.ownerSource, "env:EXPO_OWNER");

    const markerOnlyProject = readEasProjectConfig({
      appConfigPath: tempAppConfigPath,
      appJsonPath: tempAppJsonPath,
      env: {},
    });
    assert.equal(markerOnlyProject.dynamicProjectIdSupported, true);
    assert.equal(markerOnlyProject.projectIdConfigured, false);
    assert.equal(markerOnlyProject.projectIdFormat, "env-missing");
    assert.equal(markerOnlyProject.source, "app.config.js:env-projectId-marker");
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }

  const ready = buildReadiness({
    deploy: false,
    env: {},
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    projectConfig: {
      projectIdConfigured: true,
      projectIdFormat: "uuid",
      source: "app.json:expo.extra.eas.projectId",
    },
    runCommand: commandRunner,
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(ready.result, "ready-for-approved-deploy");
  assert.equal(ready.readyForApprovedDeploy, true);
  assert.equal(ready.deploymentAttempted, false);

  const deployed = buildReadiness({
    deploy: true,
    env: { [APPROVAL_ENV]: APPROVAL_TOKEN },
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    projectConfig: {
      projectIdConfigured: true,
      projectIdFormat: "uuid",
      source: "app.json:expo.extra.eas.projectId",
    },
    runCommand: commandRunner,
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(deployed.result, "deployed");
  assert.equal(deployed.deploymentAttempted, true);

  const notLoggedIn = buildReadiness({
    deploy: false,
    env: {},
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    projectConfig: {
      projectIdConfigured: true,
      projectIdFormat: "uuid",
      source: "app.json:expo.extra.eas.projectId",
    },
    runCommand: (args) => {
      const joined = args.join(" ");
      if (joined === "--version") return { command: commandSummary(args), outputSnippet: "eas-cli/20.1.0", status: "pass", exitCode: 0 };
      if (joined === "whoami") return { command: commandSummary(args), outputSnippet: "Not logged in", status: "fail", exitCode: 1 };
      throw new Error(`Unexpected command ${joined}`);
    },
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(notLoggedIn.result, "blocked-before-deploy");
  assert.ok(notLoggedIn.deploymentBlockedBy.includes("eas-account-not-logged-in"));

  const unlinkedProject = buildReadiness({
    deploy: false,
    env: {},
    hostedReport,
    hostedReportPath: DEFAULT_HOSTED_REPORT,
    projectConfig: {
      projectIdConfigured: false,
      projectIdFormat: "missing",
      source: "missing",
    },
    runCommand: (args) => {
      const joined = args.join(" ");
      if (joined === "--version") return { command: commandSummary(args), outputSnippet: "eas-cli/20.1.0", status: "pass", exitCode: 0 };
      if (joined === "whoami") return { command: commandSummary(args), outputSnippet: "freed-owner", status: "pass", exitCode: 0 };
      throw new Error(`Unexpected command ${joined}`);
    },
    webExportReport: webReport,
    webExportReportPath: DEFAULT_WEB_EXPORT_REPORT,
  });
  assert.equal(unlinkedProject.result, "blocked-before-deploy");
  assert.ok(unlinkedProject.deploymentBlockedBy.includes("eas-project-id-not-configured"));
  assert.equal(unlinkedProject.easProject.projectIdConfigured, false);

  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/eas.json"]), /docs\/validation\/evidence/);
  console.log("eas legal web deploy self-test: pass");
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    process.exit(1);
  }

  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const webRead = readJsonIfExists(options.webExportReport);
  const hostedRead = readJsonIfExists(options.hostedReport);
  const report = buildReadiness({
    deploy: options.deploy,
    hostedReport: hostedRead.value,
    hostedReportPath: options.hostedReport,
    webExportReport: webRead.value,
    webExportReportPath: options.webExportReport,
  });
  writeJsonArtifact(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        result: report.result,
        sanitized: report.sanitized,
        schemaVersion: report.schemaVersion,
        deploymentAttempted: report.deploymentAttempted,
        deploymentBlockedBy: report.deploymentBlockedBy,
        readyForApprovedDeploy: report.readyForApprovedDeploy,
      },
      null,
      2,
    ),
  );
  if (options.deploy && report.result !== "deployed") process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  APPROVAL_ENV,
  APPROVAL_TOKEN,
  buildReadiness,
  readEasProjectConfig,
  isHostedVerified,
  isStaticExportReady,
};
