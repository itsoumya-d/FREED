#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { assertUsefulScreenshot } = require("./lib/png-screenshot-audit");

const DEFAULT_BUNDLE_ID = "app.freed.recovery";
const DEFAULT_PORT = 8081;
const DEFAULT_LAUNCH_WAIT_MS = 30000;
const DEFAULT_METRO_READY_TIMEOUT_MS = 180000;
const DEFAULT_WARM_TIMEOUT_MS = 900000;
const DEFAULT_LOG_LOOKBACK = "2m";
const DEFAULT_PROCESS_NAME = "FREED";

function parseArgs(argv) {
  const options = {
    appPath: process.env.FREED_IOS_APP_PATH || "",
    bundleId: process.env.FREED_IOS_BUNDLE_ID || DEFAULT_BUNDLE_ID,
    device: process.env.FREED_IOS_SIMULATOR_UDID || "booted",
    keepMetro: false,
    launchWaitMs: DEFAULT_LAUNCH_WAIT_MS,
    logLookback: process.env.FREED_IOS_LOG_LOOKBACK || DEFAULT_LOG_LOOKBACK,
    metadataOutput: process.env.FREED_IOS_SMOKE_METADATA || "",
    metroReadyTimeoutMs: DEFAULT_METRO_READY_TIMEOUT_MS,
    output:
      process.env.FREED_IOS_SMOKE_OUTPUT ||
      path.join(
        "docs",
        "validation",
        "artifacts",
        "local-simulator-smoke",
        `ios-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      ),
    port: Number(process.env.FREED_IOS_METRO_PORT || DEFAULT_PORT),
    processName: process.env.FREED_IOS_PROCESS_NAME || DEFAULT_PROCESS_NAME,
    resetCache: false,
    selfTest: false,
    skipLogScan: false,
    warmTimeoutMs: DEFAULT_WARM_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg === "--app") {
      options.appPath = next();
    } else if (arg === "--bundle-id") {
      options.bundleId = next();
    } else if (arg === "--device") {
      options.device = next();
    } else if (arg === "--keep-metro") {
      options.keepMetro = true;
    } else if (arg === "--launch-wait-ms") {
      options.launchWaitMs = Number(next());
    } else if (arg === "--log-lookback") {
      options.logLookback = next();
    } else if (arg === "--metro-ready-timeout-ms") {
      options.metroReadyTimeoutMs = Number(next());
    } else if (arg === "--metadata-output") {
      options.metadataOutput = next();
    } else if (arg === "--output") {
      options.output = next();
    } else if (arg === "--port") {
      options.port = Number(next());
    } else if (arg === "--process-name") {
      options.processName = next();
    } else if (arg === "--reset-cache") {
      options.resetCache = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--skip-log-scan") {
      options.skipLogScan = true;
    } else if (arg === "--warm-timeout-ms") {
      options.warmTimeoutMs = Number(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new Error("--port must be a positive number");
  }
  if (!Number.isFinite(options.launchWaitMs) || options.launchWaitMs < 0) {
    throw new Error("--launch-wait-ms must be a non-negative number");
  }
  if (!Number.isFinite(options.metroReadyTimeoutMs) || options.metroReadyTimeoutMs <= 0) {
    throw new Error("--metro-ready-timeout-ms must be a positive number");
  }
  if (!Number.isFinite(options.warmTimeoutMs) || options.warmTimeoutMs <= 0) {
    throw new Error("--warm-timeout-ms must be a positive number");
  }
  if (!/^\d+[smhd]$/.test(options.logLookback)) {
    throw new Error("--log-lookback must be a duration like 30s, 2m, 1h, or 1d");
  }
  if (!options.processName.trim()) {
    throw new Error("--process-name must not be empty");
  }
  if (!options.metadataOutput) {
    options.metadataOutput = defaultMetadataOutputFor(options.output);
  }

  return options;
}

function defaultMetadataOutputFor(output) {
  const metadataOutput = output.replace(/\.png$/i, ".json");
  return metadataOutput === output ? `${output}.json` : metadataOutput;
}

function printHelp() {
  console.log(`Usage: npm run smoke:ios-simulator -- [options]

Starts Metro, warms the Expo Router iOS bundle, optionally installs a built
.app, launches the simulator app, captures and audits a nonblank screenshot,
and stops Metro.

Options:
  --app <path>              Built FREED.app path to install before launch.
                            Can also use FREED_IOS_APP_PATH.
  --bundle-id <id>          App bundle id. Default: ${DEFAULT_BUNDLE_ID}
  --device <udid|booted>    Simulator target. Default: booted
  --keep-metro              Leave Metro running after the smoke.
  --launch-wait-ms <ms>     Wait before screenshot. Default: ${DEFAULT_LAUNCH_WAIT_MS}
  --log-lookback <duration> Simulator log lookback for crash scan. Default: ${DEFAULT_LOG_LOOKBACK}
  --metro-ready-timeout-ms <ms>
                            Time to wait for Expo CLI startup output.
                            Default: ${DEFAULT_METRO_READY_TIMEOUT_MS}
  --metadata-output <path>  Metadata JSON path. Default: screenshot path with .json.
  --output <path>           Screenshot path.
  --port <number>           Metro port. Default: ${DEFAULT_PORT}
  --process-name <name>     iOS process name for log scan. Default: ${DEFAULT_PROCESS_NAME}
  --reset-cache             Pass --clear to expo start.
  --self-test               Run offline parser checks for iOS log crash/redbox detection.
  --skip-log-scan           Do not scan simulator logs for app crash/redbox signals.
  --warm-timeout-ms <ms>    Bundle warm timeout. Default: ${DEFAULT_WARM_TIMEOUT_MS}
`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "pipe",
    });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        if (options.echo) {
          process.stdout.write(chunk);
        }
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        if (options.echo) {
          process.stderr.write(chunk);
        }
      });
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} failed with ${suffix}\n${stderr || stdout}`));
    });
  });
}

function startMetro(options) {
  const args = ["expo", "start", "--localhost", "--port", String(options.port)];
  if (options.resetCache) {
    args.push("--clear");
  }

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: "1",
      EXPO_NO_QR_CODE: "1",
      EXPO_NO_TELEMETRY: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  let buffer = "";
  const readyPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Metro did not report readiness on port ${options.port}`));
    }, options.metroReadyTimeoutMs);

    const onData = (chunk) => {
      const text = chunk.toString();
      buffer += text;
      process.stdout.write(text);
      if (
        !ready &&
        (text.includes("Starting project at") ||
          text.includes("Starting Metro Bundler") ||
          text.includes(`Metro: exp://127.0.0.1:${options.port}`) ||
          text.includes(`Web: http://localhost:${options.port}`))
      ) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Metro exited before readiness (${signal || code}).\n${buffer}`));
      }
    });
  });

  return { child, readyPromise };
}

async function stopMetro(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }
  child.kill("SIGINT");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
      }
      resolve();
    }, 5000);
    child.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function ensureSimulatorTarget(device) {
  if (device !== "booted") {
    return;
  }
  const { stdout } = await run("xcrun", ["simctl", "list", "devices", "booted", "--json"]);
  const parsed = JSON.parse(stdout);
  const bootedDevices = Object.values(parsed.devices || {})
    .flat()
    .filter((entry) => entry && entry.state === "Booted");
  if (bootedDevices.length === 0) {
    throw new Error("No booted iOS simulator found. Boot one before running the smoke.");
  }
}

function bundleUrl(options) {
  const params = new URLSearchParams({
    app: options.bundleId,
    dev: "true",
    excludeSource: "true",
    inlineSourceMap: "false",
    lazy: "true",
    minify: "false",
    modulesOnly: "false",
    platform: "ios",
    runModule: "true",
    sourcePaths: "url-server",
  });
  return `http://localhost:${options.port}/.expo/.virtual-metro-entry.bundle?${params.toString()}`;
}

async function warmBundle(options) {
  const outputPath = path.join("/tmp", `freed-ios-smoke-${Date.now()}.bundle`);
  const url = bundleUrl(options);
  await downloadWithRetry(url, outputPath, options.warmTimeoutMs);
  const stats = fs.statSync(outputPath);
  if (stats.size <= 0) {
    throw new Error("Metro returned an empty iOS bundle");
  }
  fs.rmSync(outputPath, { force: true });
}

function downloadOnce(url, outputPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const request = client.get(target, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        const redirect = new URL(response.headers.location, target).toString();
        downloadOnce(redirect, outputPath, timeoutMs).then(resolve, reject);
        return;
      }

      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Metro bundle request returned HTTP ${response.statusCode || "unknown"}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Metro bundle request timed out"));
    });
    request.on("error", reject);
  });
}

async function downloadWithRetry(url, outputPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      fs.rmSync(outputPath, { force: true });
      await downloadOnce(url, outputPath, Math.max(1000, deadline - Date.now()));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error(`Metro bundle warm failed before timeout: ${lastError ? lastError.message : "unknown error"}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function predicateStringLiteral(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildLogPredicate(options) {
  const processName = predicateStringLiteral(options.processName);
  const bundleId = predicateStringLiteral(options.bundleId);
  return `process == ${processName} OR eventMessage CONTAINS[c] ${bundleId}`;
}

function summarizeSimulatorLog(logText, options, lineLimit = 40) {
  const processPattern = new RegExp(`\\b${escapeRegExp(options.processName)}(?:\\[|\\b)`, "i");
  const bundlePattern = new RegExp(escapeRegExp(options.bundleId), "i");
  const appLine = (line) => processPattern.test(line) || bundlePattern.test(line);
  const failurePattern =
    /No script URL provided|Could not connect to development server|Unhandled JS Exception|RCTFatal|Terminating app due to uncaught exception|NSException|SIGABRT|EXC_CRASH|abort\(\) called/i;
  const interestingPattern =
    /Running "main"|No script URL provided|Could not connect to development server|Unhandled JS Exception|RCTFatal|Terminating app due to uncaught exception|NSException|SIGABRT|EXC_CRASH|abort\(\) called/i;
  const lines = logText.split(/\r?\n/).filter(Boolean);
  const failureSignals = lines.filter((line) => appLine(line) && failurePattern.test(line)).slice(-10);
  const interestingLines = lines.filter((line) => appLine(line) && interestingPattern.test(line)).slice(-lineLimit);

  return {
    failureSignalCount: failureSignals.length,
    failureSignals,
    interestingLines,
    redboxSignalSeen: failureSignals.some((line) => /No script URL provided|Could not connect to development server|Unhandled JS Exception/i.test(line)),
    scanned: true,
  };
}

async function scanSimulatorLog(options) {
  const { stdout } = await run("xcrun", [
    "simctl",
    "spawn",
    options.device,
    "log",
    "show",
    "--style",
    "compact",
    "--last",
    options.logLookback,
    "--predicate",
    buildLogPredicate(options),
  ]);
  const summary = summarizeSimulatorLog(stdout, options);
  if (summary.failureSignalCount > 0) {
    throw new Error(
      `iOS simulator smoke detected app crash/redbox signal for ${options.bundleId}:\n${summary.failureSignals.join("\n")}`,
    );
  }
  return summary;
}

function runSelfTest() {
  const options = {
    bundleId: DEFAULT_BUNDLE_ID,
    processName: DEFAULT_PROCESS_NAME,
  };
  const clean = summarizeSimulatorLog(
    [
      '2026-05-15 04:10:00.000000+0530 localhost FREED[1200]: ReactNativeJS: Running "main"',
      "2026-05-15 04:10:01.000000+0530 localhost SpringBoard[100]: app.freed.recovery did finish launch",
    ].join("\n"),
    options,
  );
  assert.equal(clean.failureSignalCount, 0);
  assert.equal(clean.interestingLines.length > 0, true);

  const redbox = summarizeSimulatorLog(
    "2026-05-15 04:10:02.000000+0530 localhost FREED[1200]: No script URL provided",
    options,
  );
  assert.equal(redbox.failureSignalCount, 1);
  assert.equal(redbox.redboxSignalSeen, true);

  const nativeCrash = summarizeSimulatorLog(
    "2026-05-15 04:10:03.000000+0530 localhost FREED[1200]: Terminating app due to uncaught exception 'NSInvalidArgumentException'",
    options,
  );
  assert.equal(nativeCrash.failureSignalCount, 1);

  const unrelatedCrash = summarizeSimulatorLog(
    "2026-05-15 04:10:04.000000+0530 localhost OtherApp[1300]: Terminating app due to uncaught exception 'NSInvalidArgumentException'",
    options,
  );
  assert.equal(unrelatedCrash.failureSignalCount, 0);
  assert.equal(defaultMetadataOutputFor("artifact.png"), "artifact.json");
  assert.equal(defaultMetadataOutputFor("artifact.PNG"), "artifact.json");
  assert.equal(defaultMetadataOutputFor("artifact"), "artifact.json");

  console.log("ios-simulator-smoke self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  let metro;

  await ensureSimulatorTarget(options.device);
  try {
    metro = startMetro(options);
    await metro.readyPromise;
    await warmBundle(options);

    if (options.appPath) {
      if (!fs.existsSync(options.appPath)) {
        throw new Error(`Built app not found: ${options.appPath}`);
      }
      await run("xcrun", ["simctl", "install", options.device, options.appPath], { echo: true });
    }

    await run("xcrun", ["simctl", "launch", "--terminate-running-process", options.device, options.bundleId], {
      echo: true,
    });
    await new Promise((resolve) => setTimeout(resolve, options.launchWaitMs));

    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    await run("xcrun", ["simctl", "io", options.device, "screenshot", options.output], { echo: true });
    const screenshot = assertUsefulScreenshot(options.output);
    const simulatorLog = options.skipLogScan ? { scanned: false } : await scanSimulatorLog(options);
    const metadata = {
      bundleId: options.bundleId,
      device: options.device,
      log: simulatorLog,
      metroPort: options.port,
      output: options.output,
      result: "screenshot-captured",
      screenshot,
    };
    fs.mkdirSync(path.dirname(options.metadataOutput), { recursive: true });
    fs.writeFileSync(options.metadataOutput, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(JSON.stringify(metadata, null, 2));
  } finally {
    if (metro && !options.keepMetro) {
      await stopMetro(metro.child);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
