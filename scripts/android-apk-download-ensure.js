#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: sleep } = require("node:timers/promises");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-android-apk-download-ensure-v1";
const LIVE_CHECK_SCHEMA_VERSION = "freed-android-apk-download-live-check-v1";
const HANDOFF_SCHEMA_VERSION = "freed-android-apk-download-handoff-v1";
const DEFAULT_HANDOFF_REPORT = "docs/validation/artifacts/android-download-current/android-apk-download-handoff.json";
const DEFAULT_LIVE_CHECK_REPORT = "docs/validation/artifacts/android-download-current/android-apk-download-live-check.json";
const DEFAULT_REPORT = "docs/validation/artifacts/android-download-current/android-apk-download-ensure.json";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_ATTEMPTS = 6;
const DEFAULT_POLL_DELAY_MS = 1000;

function printHelp() {
  console.log(`Usage: npm run qa:android-download:ensure -- [options]

Ensures the current Android APK download handoff is live. It first runs the
strict live check. With --start-if-needed, it can start the local download
server for the handoff APK and poll the live check again.

This is local side-load QA only. It does not create Play Console evidence,
upload-signing proof, install evidence, or Android permission/protection proof.

Options:
  --handoff <path>              Android download handoff JSON.
                                Default: ${DEFAULT_HANDOFF_REPORT}
  --live-check-report <path>    Live-check JSON to write/read.
                                Default: ${DEFAULT_LIVE_CHECK_REPORT}
  --report <path>               Ensure JSON report under docs/validation/artifacts.
                                Default: ${DEFAULT_REPORT}
  --url <url>                   Optional local http:// page URL passed to the live check.
  --timeout-ms <ms>             Per-request live-check timeout, 500-30000.
                                Default: ${DEFAULT_TIMEOUT_MS}
  --start-if-needed             Start the local server when the initial live check fails.
  --poll-attempts <count>       Post-start live-check attempts, 1-20.
                                Default: ${DEFAULT_POLL_ATTEMPTS}
  --poll-delay-ms <ms>          Delay between post-start attempts, 250-10000.
                                Default: ${DEFAULT_POLL_DELAY_MS}
  --self-test                   Run offline helper checks.
`);
}

function parseArgs(argv) {
  const options = {
    handoff: DEFAULT_HANDOFF_REPORT,
    liveCheckReport: DEFAULT_LIVE_CHECK_REPORT,
    pageUrl: "",
    pollAttempts: DEFAULT_POLL_ATTEMPTS,
    pollDelayMs: DEFAULT_POLL_DELAY_MS,
    reportPath: DEFAULT_REPORT,
    selfTest: false,
    startIfNeeded: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--handoff") options.handoff = next();
    else if (arg === "--live-check-report") options.liveCheckReport = next();
    else if (arg === "--report") options.reportPath = next();
    else if (arg === "--url") options.pageUrl = next();
    else if (arg === "--timeout-ms") options.timeoutMs = parseBoundedInteger(next(), arg, 500, 30000);
    else if (arg === "--poll-attempts") options.pollAttempts = parseBoundedInteger(next(), arg, 1, 20);
    else if (arg === "--poll-delay-ms") options.pollDelayMs = parseBoundedInteger(next(), arg, 250, 10000);
    else if (arg === "--start-if-needed") options.startIfNeeded = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.handoff = assertSafeArtifactJsonPath(options.handoff, "--handoff");
  options.liveCheckReport = assertSafeArtifactJsonPath(options.liveCheckReport, "--live-check-report");
  options.reportPath = assertSafeArtifactJsonPath(options.reportPath, "--report");
  if (options.pageUrl) options.pageUrl = assertSafeLocalHttpUrl(options.pageUrl, "--url");
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

function assertSafeArtifactJsonPath(value, label) {
  return repoRelative(assertSafeReportPath(value, label));
}

function assertSafeLocalHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be a valid local http:// URL.`);
  }
  if (parsed.protocol !== "http:") throw new Error(`${label} must use http:// for the local QA server.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must not include credentials, query strings, or fragments.`);
  }
  const host = parsed.hostname.toLowerCase();
  const localHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (!localHost) throw new Error(`${label} must target localhost or a private LAN host.`);
  return parsed.toString();
}

function safeWorkspacePath(value, label) {
  const normalized = String(value || "").trim();
  if (
    !normalized ||
    normalized !== String(value || "") ||
    normalized.startsWith("-") ||
    normalized.includes("\0") ||
    /[;&|`$<>]/.test(normalized)
  ) {
    throw new Error(`${label} must be a plain workspace path without shell syntax or flags.`);
  }
  const absolute = path.resolve(process.cwd(), normalized);
  const relative = path.relative(process.cwd(), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the current workspace.`);
  }
  return relative.replace(/\\/g, "/");
}

function validateHost(value) {
  const host = String(value || "").trim();
  if (!host || host.length > 255 || /[\s;&|`$<>/\\]/.test(host)) {
    throw new Error("handoff server host must be a plain interface hostname.");
  }
  return host;
}

function validatePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("handoff server port must be an integer from 1024 to 65535.");
  }
  return port;
}

function readJsonIfExists(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { exists: false, value: null };
  }
  return {
    exists: true,
    value: JSON.parse(fs.readFileSync(absolutePath, "utf8")),
  };
}

function readHandoff(relativePath) {
  const read = readJsonIfExists(relativePath);
  if (!read.exists) throw new Error(`Missing Android download handoff: ${relativePath}`);
  const handoff = read.value;
  if (handoff.schemaVersion !== HANDOFF_SCHEMA_VERSION) {
    throw new Error("--handoff must be a freed-android-apk-download-handoff-v1 JSON artifact.");
  }
  if (handoff.sanitized !== true) throw new Error("--handoff must be sanitized.");
  const apkPath = safeWorkspacePath(handoff.apk?.path || "", "handoff APK path");
  if (!apkPath.endsWith(".apk")) throw new Error("handoff APK path must end in .apk.");
  if (!fs.existsSync(path.resolve(process.cwd(), apkPath))) {
    throw new Error(`handoff APK does not exist: ${apkPath}`);
  }
  return {
    ...handoff,
    apk: {
      ...(handoff.apk || {}),
      path: apkPath,
    },
    runId: safeRunId(handoff.runId || path.basename(path.dirname(relativePath))),
    server: {
      ...(handoff.server || {}),
      host: validateHost(handoff.server?.host || "0.0.0.0"),
      port: validatePort(handoff.server?.port || 8787),
    },
  };
}

function safeRunId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("handoff run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function commandEnv() {
  const pathEntries = [
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH || "",
  ].filter(Boolean);
  return {
    ...process.env,
    PATH: [...new Set(pathEntries.join(path.delimiter).split(path.delimiter).filter(Boolean))].join(path.delimiter),
  };
}

function buildLiveCheckArgs(options) {
  const args = [
    "--",
    "scripts/android-apk-download-live-check.js",
    "--handoff",
    options.handoff,
    "--report",
    options.liveCheckReport,
    "--timeout-ms",
    String(options.timeoutMs),
  ];
  if (options.pageUrl) args.push("--url", options.pageUrl);
  return args;
}

function buildStartServerArgs(options, handoff) {
  return [
    "--",
    "scripts/android-apk-download-server.js",
    "--apk",
    handoff.apk.path,
    "--host",
    handoff.server.host,
    "--port",
    String(handoff.server.port),
    "--run-id",
    handoff.runId,
    "--report",
    options.handoff,
  ];
}

function shellQuote(value) {
  const raw = String(value);
  if (/^[A-Za-z0-9._~/:=@%+-]+$/.test(raw)) return raw;
  return `'${raw.replace(/'/g, "'\\''")}'`;
}

function liveCheckCommandString(options) {
  const args = [
    "npm",
    "run",
    "qa:android-download:live-check",
    "--",
    "--handoff",
    options.handoff,
    "--report",
    options.liveCheckReport,
    "--timeout-ms",
    String(options.timeoutMs),
  ];
  if (options.pageUrl) args.push("--url", options.pageUrl);
  return args.map(shellQuote).join(" ");
}

function ensureCommandString(options, includeStart = true) {
  const args = [
    "npm",
    "run",
    "qa:android-download:ensure",
    "--",
    "--handoff",
    options.handoff,
    "--live-check-report",
    options.liveCheckReport,
    "--report",
    options.reportPath,
    "--timeout-ms",
    String(options.timeoutMs),
  ];
  if (options.pageUrl) args.push("--url", options.pageUrl);
  if (includeStart) args.push("--start-if-needed");
  return args.map(shellQuote).join(" ");
}

function startServerCommandString(options, handoff) {
  const args = [
    "npm",
    "run",
    "qa:android-download",
    "--",
    "--apk",
    handoff.apk.path,
    "--host",
    handoff.server.host,
    "--port",
    String(handoff.server.port),
    "--run-id",
    handoff.runId,
    "--report",
    options.handoff,
  ];
  return args.map(shellQuote).join(" ");
}

function sanitizeText(value, limit = 1800) {
  const text = String(value || "")
    .replaceAll(process.cwd(), ".")
    .replaceAll(process.execPath, "node")
    .replace(/\s+$/g, "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function runLiveCheckCommand(options) {
  const result = spawnSync(process.execPath, buildLiveCheckArgs(options), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: commandEnv(),
    maxBuffer: 1024 * 1024,
  });
  const read = readJsonIfExists(options.liveCheckReport);
  return {
    command: liveCheckCommandString(options),
    exitCode: typeof result.status === "number" ? result.status : 1,
    report: read.value,
    reportExists: read.exists,
    signal: result.signal || "",
    stderr: sanitizeText(result.stderr || result.error?.message || ""),
    stdout: sanitizeText(result.stdout || ""),
  };
}

function liveCheckPassed(run) {
  return (
    run.exitCode === 0 &&
    run.reportExists === true &&
    run.report?.schemaVersion === LIVE_CHECK_SCHEMA_VERSION &&
    run.report?.result === "pass" &&
    Number(run.report?.failCount || 0) === 0
  );
}

function summarizeLiveCheckRun(label, run) {
  return {
    label,
    command: run.command,
    exitCode: run.exitCode,
    failCount: Number(run.report?.failCount || 0),
    generatedAt: run.report?.generatedAt || "",
    passCount: Number(run.report?.passCount || 0),
    passed: liveCheckPassed(run),
    reportExists: run.reportExists === true,
    reportResult: run.report?.result || "",
    reportSchema: run.report?.schemaVersion || "",
    stderr: run.stderr,
    stdout: run.stdout,
    target: run.report?.target
      ? {
          downloadUrl: run.report.target.downloadUrl || "",
          pageUrl: run.report.target.pageUrl || "",
          qrTargetUrl: run.report.target.qrTargetUrl || "",
        }
      : null,
  };
}

function startServerDetached(options, handoff) {
  const artifactDir = path.dirname(path.resolve(process.cwd(), options.reportPath));
  fs.mkdirSync(artifactDir, { recursive: true });
  const stdoutLog = path.join(artifactDir, "android-apk-download-server.ensure.log");
  const stderrLog = path.join(artifactDir, "android-apk-download-server.ensure.err.log");
  const stdoutFd = fs.openSync(stdoutLog, "a");
  const stderrFd = fs.openSync(stderrLog, "a");
  try {
    const child = spawn(process.execPath, buildStartServerArgs(options, handoff), {
      cwd: process.cwd(),
      detached: true,
      env: commandEnv(),
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    child.unref();
    return {
      command: startServerCommandString(options, handoff),
      logs: {
        stderr: repoRelative(stderrLog),
        stdout: repoRelative(stdoutLog),
      },
      pid: child.pid || 0,
      spawned: true,
    };
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

function check(id, status, detail, next = "") {
  return { id, status, detail, next };
}

async function buildEnsureReport(options, deps = {}) {
  const now = deps.now || (() => new Date().toISOString());
  const runLiveCheck = deps.runLiveCheck || runLiveCheckCommand;
  const startServer = deps.startServer || startServerDetached;
  const wait = deps.sleep || sleep;
  const initialRun = runLiveCheck(options);
  const initialPassed = liveCheckPassed(initialRun);
  const liveChecks = [summarizeLiveCheckRun("initial", initialRun)];
  const handoff = initialPassed ? null : readHandoff(options.handoff);
  let startResult = null;
  let finalRun = initialRun;

  if (!initialPassed && options.startIfNeeded) {
    startResult = startServer(options, handoff);
    for (let attempt = 1; attempt <= options.pollAttempts; attempt += 1) {
      await wait(options.pollDelayMs);
      const pollRun = runLiveCheck(options);
      liveChecks.push(summarizeLiveCheckRun(`post-start-${attempt}`, pollRun));
      finalRun = pollRun;
      if (liveCheckPassed(pollRun)) break;
    }
  }

  const finalPassed = liveCheckPassed(finalRun);
  const result = finalPassed ? "pass" : options.startIfNeeded ? "fail" : "needs-server-start";
  const checks = [
    check(
      "initial-live-check-pass",
      initialPassed ? "pass" : "fail",
      initialPassed
        ? "The current Android download server already passed the strict live check."
        : "The current Android download server did not pass the strict live check.",
      "Run this ensure command with --start-if-needed or start the handoff server manually.",
    ),
    check(
      "server-start-policy",
      initialPassed || options.startIfNeeded ? "pass" : "fail",
      initialPassed
        ? "No server start was needed."
        : options.startIfNeeded
          ? "Server start was explicitly allowed for local QA."
          : "Server start was not allowed by this run.",
      ensureCommandString(options, true),
    ),
    check(
      "server-spawned-if-needed",
      initialPassed || !options.startIfNeeded || startResult?.spawned ? "pass" : "fail",
      startResult?.spawned
        ? `Spawned the local Android download server for ${handoff.server.host}:${handoff.server.port}.`
        : initialPassed
          ? "The existing server was already current."
          : options.startIfNeeded
            ? "The local Android download server was not spawned."
            : "Server start was intentionally skipped.",
      startResult?.command || (handoff ? startServerCommandString(options, handoff) : ""),
    ),
    check(
      "final-live-check-pass",
      finalPassed ? "pass" : "fail",
      finalPassed
        ? "The Android download page, metadata route, and APK route are currently verified."
        : "The Android download page, metadata route, or APK route is still not verified.",
      liveCheckCommandString(options),
    ),
    check(
      "local-side-load-qa-boundary",
      "pass",
      "This ensure report is local side-load QA only and is not Play Console, upload-signing, install, or protection evidence.",
    ),
  ];
  const failCount = checks.filter((item) => item.status === "fail").length;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now(),
    sanitized: true,
    result,
    passCount: checks.length - failCount,
    failCount,
    sourceHandoff: options.handoff,
    liveCheckReport: options.liveCheckReport,
    startIfNeeded: options.startIfNeeded,
    startAttempted: Boolean(startResult),
    serverStarted: Boolean(startResult?.spawned),
    pollAttempts: options.pollAttempts,
    pollDelayMs: options.pollDelayMs,
    timeoutMs: options.timeoutMs,
    commands: {
      ensure: ensureCommandString(options, true),
      liveCheck: liveCheckCommandString(options),
      startServer: startResult?.command || (handoff ? startServerCommandString(options, handoff) : ""),
    },
    serverStart: startResult
      ? {
          command: startResult.command,
          logs: startResult.logs,
          pid: startResult.pid,
          spawned: startResult.spawned,
        }
      : null,
    liveChecks,
    checks,
    releaseBoundary:
      "Local Android APK side-load download ensure only. This does not prove install, Android permission consent, browser blocking, upload signing, Play Console readiness, or store approval.",
  };
}

function writeReport(reportPath, report) {
  const absolutePath = path.resolve(process.cwd(), reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`);
}

async function runSelfTest() {
  assert.throws(() => parseArgs(["--handoff", "docs/validation/evidence/download.json"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--url", "https://example.com/"]), /http/);
  assert.throws(() => parseArgs(["--url", "http://example.com/"]), /private LAN/);
  const tempRoot = fs.mkdtempSync(path.resolve(process.cwd(), "docs/validation/artifacts/android-download-ensure-self-test-"));
  try {
    const apkPath = path.join(tempRoot, "FREED-release-universal.apk");
    const handoffPath = path.join(tempRoot, "android-apk-download-handoff.json");
    const liveCheckPath = path.join(tempRoot, "android-apk-download-live-check.json");
    const ensurePath = path.join(tempRoot, "android-apk-download-ensure.json");
    fs.writeFileSync(apkPath, "fake apk");
    fs.writeFileSync(
      handoffPath,
      `${JSON.stringify(
        {
          schemaVersion: HANDOFF_SCHEMA_VERSION,
          generatedAt: "2026-06-10T00:00:00.000Z",
          sanitized: true,
          runId: "android-download-ensure-self-test",
          apk: {
            filename: "FREED-release-universal.apk",
            path: repoRelative(apkPath),
            sha256: "a".repeat(64),
            sizeBytes: 8,
          },
          server: {
            host: "0.0.0.0",
            port: 8787,
            qrTargetUrl: "http://127.0.0.1:8787/",
          },
        },
        null,
        2,
      )}\n`,
    );
    const options = parseArgs([
      "--handoff",
      repoRelative(handoffPath),
      "--live-check-report",
      repoRelative(liveCheckPath),
      "--report",
      repoRelative(ensurePath),
      "--poll-delay-ms",
      "250",
    ]);
    const passRun = {
      command: "npm run qa:android-download:live-check",
      exitCode: 0,
      report: {
        schemaVersion: LIVE_CHECK_SCHEMA_VERSION,
        generatedAt: "2026-06-10T00:01:00.000Z",
        result: "pass",
        passCount: 46,
        failCount: 0,
      },
      reportExists: true,
      stderr: "",
      stdout: "",
    };
    const failRun = {
      command: "npm run qa:android-download:live-check",
      exitCode: 1,
      report: {
        schemaVersion: LIVE_CHECK_SCHEMA_VERSION,
        generatedAt: "2026-06-10T00:02:00.000Z",
        result: "fail",
        passCount: 0,
        failCount: 46,
      },
      reportExists: true,
      stderr: "connect ECONNREFUSED 127.0.0.1:8787",
      stdout: "",
    };
    const alreadyLive = await buildEnsureReport(options, {
      now: () => "2026-06-10T00:03:00.000Z",
      runLiveCheck: () => passRun,
      sleep: async () => {},
    });
    assert.equal(alreadyLive.result, "pass");
    assert.equal(alreadyLive.serverStarted, false);
    assert.match(alreadyLive.releaseBoundary, /Local Android APK side-load download ensure only/);

    const needsStart = await buildEnsureReport(options, {
      now: () => "2026-06-10T00:04:00.000Z",
      runLiveCheck: () => failRun,
      sleep: async () => {},
    });
    assert.equal(needsStart.result, "needs-server-start");
    assert.equal(needsStart.serverStarted, false);
    assert.match(needsStart.commands.ensure, /--start-if-needed/);

    const startOptions = { ...options, startIfNeeded: true };
    const sequence = [failRun, passRun];
    const started = await buildEnsureReport(startOptions, {
      now: () => "2026-06-10T00:05:00.000Z",
      runLiveCheck: () => sequence.shift() || passRun,
      sleep: async () => {},
      startServer: () => ({
        command: "npm run qa:android-download -- --apk docs/validation/artifacts/example/FREED-release-universal.apk",
        logs: {
          stderr: "docs/validation/artifacts/android-download-ensure-self-test/server.err.log",
          stdout: "docs/validation/artifacts/android-download-ensure-self-test/server.log",
        },
        pid: 123,
        spawned: true,
      }),
    });
    assert.equal(started.result, "pass");
    assert.equal(started.serverStarted, true);
    assert.equal(started.startAttempted, true);
    assert.equal(started.liveChecks.length, 2);
    assert.match(started.commands.startServer, /qa:android-download/);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
  console.log("android APK download ensure self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    await runSelfTest();
    return;
  }

  const report = await buildEnsureReport(options);
  writeReport(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        failCount: report.failCount,
        passCount: report.passCount,
        result: report.result,
        sanitized: report.sanitized,
        schemaVersion: report.schemaVersion,
        serverStarted: report.serverStarted,
      },
      null,
      2,
    ),
  );
  if (report.result !== "pass") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  buildEnsureReport,
  ensureCommandString,
  liveCheckPassed,
  parseArgs,
};
