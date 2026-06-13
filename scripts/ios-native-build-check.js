#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const DEFAULT_WORKSPACE = "ios/FREED.xcworkspace";
const DEFAULT_SCHEME = "FREED";
const DEFAULT_CONFIGURATION = "Debug";
const DEFAULT_SDK = "iphonesimulator";
const DEFAULT_DESTINATION = "auto";
const DEFAULT_DERIVED_DATA_PATH = "ios/build";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SIMCTL_TIMEOUT_MS = 15 * 1000;
const TAIL_LIMIT = 16_000;

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value, label) {
  if (value === "true" || value === "YES" || value === "1") return true;
  if (value === "false" || value === "NO" || value === "0") return false;
  throw new Error(`${label} must be true or false`);
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const options = {
    buildSettings: [],
    codeSigningAllowed: false,
    configuration: process.env.FREED_IOS_NATIVE_BUILD_CONFIGURATION || DEFAULT_CONFIGURATION,
    derivedDataPath: process.env.FREED_IOS_NATIVE_BUILD_DERIVED_DATA_PATH || DEFAULT_DERIVED_DATA_PATH,
    destination: process.env.FREED_IOS_NATIVE_BUILD_DESTINATION || DEFAULT_DESTINATION,
    dryRun: false,
    idleTimeoutMs: parsePositiveInteger(
      process.env.FREED_IOS_NATIVE_BUILD_IDLE_TIMEOUT_MS || String(DEFAULT_IDLE_TIMEOUT_MS),
      "FREED_IOS_NATIVE_BUILD_IDLE_TIMEOUT_MS",
    ),
    logPath:
      process.env.FREED_IOS_NATIVE_BUILD_LOG ||
      path.join("/tmp", `freed-ios-native-build-${timestampLabel()}.log`),
    nodeBinary: process.env.FREED_IOS_NATIVE_BUILD_NODE_BINARY || process.execPath,
    scheme: process.env.FREED_IOS_NATIVE_BUILD_SCHEME || DEFAULT_SCHEME,
    sdk: process.env.FREED_IOS_NATIVE_BUILD_SDK || DEFAULT_SDK,
    selfTest: false,
    simctlTimeoutMs: parsePositiveInteger(
      process.env.FREED_IOS_NATIVE_BUILD_SIMCTL_TIMEOUT_MS || String(DEFAULT_SIMCTL_TIMEOUT_MS),
      "FREED_IOS_NATIVE_BUILD_SIMCTL_TIMEOUT_MS",
    ),
    timeoutMs: parsePositiveInteger(
      process.env.FREED_IOS_NATIVE_BUILD_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
      "FREED_IOS_NATIVE_BUILD_TIMEOUT_MS",
    ),
    workspace: process.env.FREED_IOS_NATIVE_BUILD_WORKSPACE || DEFAULT_WORKSPACE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--build-setting") {
      options.buildSettings.push(next());
    } else if (arg === "--code-signing-allowed") {
      options.codeSigningAllowed = parseBoolean(next(), "--code-signing-allowed");
    } else if (arg === "--configuration") {
      options.configuration = next();
    } else if (arg === "--derived-data-path") {
      options.derivedDataPath = next();
    } else if (arg === "--destination") {
      options.destination = next();
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--idle-timeout-ms") {
      options.idleTimeoutMs = parsePositiveInteger(next(), "--idle-timeout-ms");
    } else if (arg === "--log") {
      options.logPath = next();
    } else if (arg === "--node-binary") {
      options.nodeBinary = next();
    } else if (arg === "--scheme") {
      options.scheme = next();
    } else if (arg === "--sdk") {
      options.sdk = next();
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--simctl-timeout-ms") {
      options.simctlTimeoutMs = parsePositiveInteger(next(), "--simctl-timeout-ms");
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(next(), "--timeout-ms");
    } else if (arg === "--workspace") {
      options.workspace = next();
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.workspace.trim()) throw new Error("--workspace must not be empty");
  if (!options.scheme.trim()) throw new Error("--scheme must not be empty");
  if (!options.configuration.trim()) throw new Error("--configuration must not be empty");
  if (!options.sdk.trim()) throw new Error("--sdk must not be empty");
  if (!options.destination.trim()) throw new Error("--destination must not be empty");
  if (!options.derivedDataPath.trim()) throw new Error("--derived-data-path must not be empty");
  if (!options.logPath.trim()) throw new Error("--log must not be empty");
  if (!options.nodeBinary.trim()) throw new Error("--node-binary must not be empty");
  if (!path.isAbsolute(options.nodeBinary)) {
    throw new Error("--node-binary must be an absolute path");
  }
  if (options.idleTimeoutMs > options.timeoutMs) {
    throw new Error("--idle-timeout-ms must be less than or equal to --timeout-ms");
  }
  for (const setting of options.buildSettings) {
    if (!/^[A-Za-z0-9_]+=[\s\S]+$/.test(setting)) {
      throw new Error(`--build-setting must be KEY=VALUE, got: ${setting}`);
    }
  }

  return options;
}

function xcodebuildArgs(options, destination = options.destination) {
  return [
    "-workspace",
    options.workspace,
    "-scheme",
    options.scheme,
    "-configuration",
    options.configuration,
    "-sdk",
    options.sdk,
    "-destination",
    destination,
    "-derivedDataPath",
    options.derivedDataPath,
    `CODE_SIGNING_ALLOWED=${options.codeSigningAllowed ? "YES" : "NO"}`,
    "COMPILER_INDEX_STORE_ENABLE=NO",
    `FREED_NODE_BINARY=${options.nodeBinary}`,
    ...options.buildSettings,
    "build",
  ];
}

function parseNodeBinaryAssignment(line) {
  const match = String(line).match(/^\s*(?:export\s+)?NODE_BINARY=(.+?)\s*$/);
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function validateXcodeNodeBinary(options) {
  try {
    fs.accessSync(options.nodeBinary, fs.constants.X_OK);
  } catch {
    throw new Error(`--node-binary points to ${options.nodeBinary}, but that file is not executable.`);
  }

  const workspaceDir = path.dirname(path.resolve(process.cwd(), options.workspace));
  for (const fileName of [".xcode.env.local", ".xcode.env"]) {
    const envPath = path.join(workspaceDir, fileName);
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const value = parseNodeBinaryAssignment(line);
      if (!value || !path.isAbsolute(value)) continue;
      try {
        fs.accessSync(value, fs.constants.X_OK);
      } catch {
        throw new Error(
          `${path.relative(process.cwd(), envPath) || envPath} sets NODE_BINARY to ${value}, but that file is not executable. ` +
            "Update it to `export NODE_BINARY=$(command -v node)` or a current Node binary before running xcodebuild.",
        );
      }
    }
  }
}

function dryRunDestinationNote(options, resolvedDestination) {
  if (!options.dryRun || options.destination !== "auto") return "";
  if (resolvedDestination.source !== "dry-run") return "";
  return (
    `Destination: auto (dry-run placeholder; non-dry-run builds resolve it with ` +
    `xcrun simctl within ${options.simctlTimeoutMs}ms before invoking xcodebuild).`
  );
}

function printHelp() {
  console.log(`Usage: npm run build:ios-simulator -- [options]

Runs xcodebuild with bounded total and idle timeouts so native iOS build
checks fail with a useful log tail instead of hanging in Pods script phases.

Options:
  --workspace <path>          Xcode workspace. Default: ${DEFAULT_WORKSPACE}
  --scheme <name>             Scheme. Default: ${DEFAULT_SCHEME}
  --configuration <name>      Build configuration. Default: ${DEFAULT_CONFIGURATION}
  --sdk <name>                SDK. Default: ${DEFAULT_SDK}
  --destination <destination> Destination. Default: ${DEFAULT_DESTINATION}
                              Use "auto" to select a currently available
                              iOS Simulator from xcrun simctl.
  --derived-data-path <path>  Derived data path. Default: ${DEFAULT_DERIVED_DATA_PATH}
  --code-signing-allowed <bool>
                              true/false. Default: false
  --build-setting KEY=VALUE   Extra xcodebuild build setting. Repeatable.
  --timeout-ms <ms>           Total timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --idle-timeout-ms <ms>      No-output timeout. Default: ${DEFAULT_IDLE_TIMEOUT_MS}
  --simctl-timeout-ms <ms>    Timeout for auto destination lookup.
                              Default: ${DEFAULT_SIMCTL_TIMEOUT_MS}
  --log <path>                Full log path. Default: /tmp/freed-ios-native-build-*.log
  --node-binary <path>        Absolute node executable passed into Xcode script
                              phases. Default: current process.execPath.
  --dry-run                   Print the command without running it.
  --self-test                 Run parser/command construction checks.
`);
}

function appendTail(current, chunk) {
  return (current + chunk).slice(-TAIL_LIMIT);
}

function killProcessGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process may already have exited.
    }
  }
}

function simulatorRuntimeRank(runtimeIdentifier) {
  const match = String(runtimeIdentifier).match(/iOS-([0-9-]+)/);
  if (!match) return 0;
  const parts = match[1].split("-").map((part) => Number(part));
  return parts.reduce((score, part, index) => score + (Number.isFinite(part) ? part / Math.pow(100, index) : 0), 0);
}

function simulatorDeviceRank(device) {
  const name = String(device.name ?? "");
  let score = 0;
  if (device.state === "Booted") score += 1_000_000;
  score += simulatorRuntimeRank(device.runtimeIdentifier) * 1_000;
  if (/iPhone/i.test(name)) score += 100;
  if (/Pro Max/i.test(name)) score += 20;
  if (/Pro\b/i.test(name)) score += 10;
  if (/SE/i.test(name)) score -= 5;
  return score;
}

function selectSimulatorDestinationFromDevices(payload) {
  if (!payload || typeof payload !== "object" || !payload.devices || typeof payload.devices !== "object") {
    throw new Error("simctl devices output did not include a devices object");
  }
  const devices = [];
  for (const [runtimeIdentifier, runtimeDevices] of Object.entries(payload.devices)) {
    if (!/\.iOS-/.test(runtimeIdentifier) || !Array.isArray(runtimeDevices)) continue;
    for (const device of runtimeDevices) {
      if (!device || typeof device !== "object") continue;
      if (device.isAvailable === false || device.availabilityError) continue;
      if (typeof device.udid !== "string" || !device.udid.trim()) continue;
      devices.push({ ...device, runtimeIdentifier });
    }
  }
  devices.sort((a, b) => simulatorDeviceRank(b) - simulatorDeviceRank(a) || String(a.name).localeCompare(String(b.name)));
  const selected = devices[0];
  if (!selected) {
    throw new Error(
      "No available iOS Simulator device was reported by xcrun simctl. Create/download an iOS simulator runtime/device in Xcode, or pass --destination explicitly.",
    );
  }
  return {
    destination: `id=${selected.udid}`,
    device: selected,
  };
}

function resolveBuildDestination(options) {
  if (options.destination !== "auto") return { destination: options.destination, source: "explicit" };
  const result = spawnSync("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: options.simctlTimeoutMs,
  });
  if (result.error) {
    const timedOut = result.error.code === "ETIMEDOUT";
    const reason = timedOut ? "xcrun simctl timed out" : "xcrun simctl failed";
    throw new Error(
      `Unable to auto-select an iOS Simulator destination because ${reason} after ${options.simctlTimeoutMs}ms. ` +
        "Open Xcode once, restart CoreSimulator, create/download a simulator runtime/device, or pass --destination explicitly.",
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Unable to auto-select an iOS Simulator destination because xcrun simctl exited with ${result.status}. ` +
        `${result.stderr.trim() || "No stderr was produced."}`,
    );
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error("Unable to auto-select an iOS Simulator destination because xcrun simctl returned malformed JSON.");
  }
  const selected = selectSimulatorDestinationFromDevices(payload);
  return { ...selected, source: "simctl" };
}

function runXcodebuild(options, resolvedDestination) {
  const args = xcodebuildArgs(options, resolvedDestination.destination);
  fs.mkdirSync(path.dirname(options.logPath), { recursive: true });
  const log = fs.createWriteStream(options.logPath, { flags: "w" });
  const startedAt = Date.now();
  let tail = "";
  let settled = false;
  let forcedFailureMessage = "";
  let totalTimer;
  let idleTimer;

  return new Promise((resolve, reject) => {
    const child = spawn("xcodebuild", args, {
      cwd: process.cwd(),
      detached: true,
      env: {
        ...process.env,
        CI: process.env.CI || "1",
        EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY || "1",
        FREED_NODE_BINARY: options.nodeBinary,
        NODE_BINARY: options.nodeBinary,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const settle = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      clearTimeout(idleTimer);
      log.end();
      if (error) reject(error);
      else resolve(result);
    };

    const failAfterKill = (message) => {
      if (settled || forcedFailureMessage) return;
      forcedFailureMessage = message;
      tail = appendTail(tail, `\n${message}\n`);
      log.write(`\n${message}\n`);
      killProcessGroup(child, "SIGTERM");
      setTimeout(() => {
        if (!settled && child.exitCode === null) {
          killProcessGroup(child, "SIGKILL");
        }
        if (!settled) {
          settle(new Error(`${message}\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`));
        }
      }, 3000);
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        failAfterKill(`xcodebuild produced no output for ${options.idleTimeoutMs}ms`);
      }, options.idleTimeoutMs);
    };

    totalTimer = setTimeout(() => {
      failAfterKill(`xcodebuild exceeded total timeout ${options.timeoutMs}ms`);
    }, options.timeoutMs);
    resetIdleTimer();

    const onData = (chunk) => {
      if (settled) return;
      const text = chunk.toString();
      tail = appendTail(tail, text);
      log.write(text);
      process.stdout.write(text);
      resetIdleTimer();
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      settle(error);
    });
    child.on("exit", (code, signal) => {
      const durationMs = Date.now() - startedAt;
      if (forcedFailureMessage) {
        settle(
          new Error(
            `${forcedFailureMessage} after ${durationMs}ms\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`,
          ),
        );
        return;
      }
      if (code === 0) {
        settle(null, { args, durationMs, logPath: options.logPath });
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code}`;
      settle(new Error(`xcodebuild failed with ${suffix} after ${durationMs}ms\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`));
    });
  });
}

function runSelfTest() {
  const options = parseArgs([
    "--scheme",
    "FREEDDeviceActivityMonitor",
    "--timeout-ms",
    "60000",
    "--idle-timeout-ms",
    "5000",
    "--code-signing-allowed",
    "false",
    "--build-setting",
    "ONLY_ACTIVE_ARCH=YES",
    "--node-binary",
    process.execPath,
  ]);
  assert.equal(options.scheme, "FREEDDeviceActivityMonitor");
  assert.equal(options.timeoutMs, 60000);
  assert.equal(options.idleTimeoutMs, 5000);
  assert.equal(options.codeSigningAllowed, false);
  assert.equal(options.nodeBinary, process.execPath);
  assert.equal(options.destination, "auto");
  assert.ok(xcodebuildArgs(options, "id=SIMULATOR-UDID").includes("id=SIMULATOR-UDID"));
  assert.ok(xcodebuildArgs(options, "id=SIMULATOR-UDID").includes("CODE_SIGNING_ALLOWED=NO"));
  assert.ok(xcodebuildArgs(options, "id=SIMULATOR-UDID").includes("COMPILER_INDEX_STORE_ENABLE=NO"));
  assert.ok(xcodebuildArgs(options, "id=SIMULATOR-UDID").includes(`FREED_NODE_BINARY=${process.execPath}`));
  assert.ok(xcodebuildArgs(options, "id=SIMULATOR-UDID").includes("ONLY_ACTIVE_ARCH=YES"));
  assert.equal(parseNodeBinaryAssignment("export NODE_BINARY=/usr/local/bin/node"), "/usr/local/bin/node");
  assert.equal(parseNodeBinaryAssignment("NODE_BINARY=$(command -v node)"), "$(command -v node)");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-ios-node-env-"));
  const tempWorkspace = path.join(tempRoot, "FREED.xcworkspace");
  fs.mkdirSync(tempWorkspace, { recursive: true });
  const tempOptions = { ...options, workspace: tempWorkspace };
  fs.writeFileSync(path.join(tempRoot, ".xcode.env.local"), "export NODE_BINARY=/definitely/missing/node\n");
  assert.throws(() => validateXcodeNodeBinary(tempOptions), /NODE_BINARY.*not executable/);
  fs.writeFileSync(path.join(tempRoot, ".xcode.env.local"), "export NODE_BINARY=$(command -v node)\n");
  assert.doesNotThrow(() => validateXcodeNodeBinary(tempOptions));
  fs.writeFileSync(path.join(tempRoot, ".xcode.env.local"), `export NODE_BINARY=${process.execPath}\n`);
  assert.doesNotThrow(() => validateXcodeNodeBinary(tempOptions));
  assert.match(
    dryRunDestinationNote({ ...options, dryRun: true }, { destination: "auto", source: "dry-run" }),
    /dry-run placeholder/,
  );
  assert.equal(dryRunDestinationNote(options, { destination: "auto", source: "simctl" }), "");
  assert.equal(appendTail("abc", "def").endsWith("abcdef"), true);
  assert.deepEqual(
    selectSimulatorDestinationFromDevices({
      devices: {
        "com.apple.CoreSimulator.SimRuntime.iOS-26-2": [
          { isAvailable: true, name: "iPhone SE (3rd generation)", state: "Shutdown", udid: "SE-UDID" },
          { isAvailable: true, name: "iPhone 17 Pro Max", state: "Booted", udid: "PRO-MAX-UDID" },
        ],
      },
    }).destination,
    "id=PRO-MAX-UDID",
  );
  assert.throws(() => selectSimulatorDestinationFromDevices({ devices: {} }), /No available iOS Simulator/);
  assert.throws(() => parseArgs(["--idle-timeout-ms", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--simctl-timeout-ms", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--timeout-ms", "5000", "--idle-timeout-ms", "6000"]), /less than or equal/);
  assert.throws(() => parseArgs(["--build-setting", "ONLY_ACTIVE_ARCH"]), /KEY=VALUE/);
  console.log("ios-native-build-check self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  if (!options.dryRun) {
    validateXcodeNodeBinary(options);
  }

  const resolvedDestination = options.dryRun && options.destination === "auto"
    ? { destination: "auto", source: "dry-run" }
    : resolveBuildDestination(options);
  if (resolvedDestination.source === "simctl") {
    console.log(`Selected iOS Simulator: ${resolvedDestination.device.name} (${resolvedDestination.device.udid})`);
  }
  const args = xcodebuildArgs(options, resolvedDestination.destination);
  const destinationNote = dryRunDestinationNote(options, resolvedDestination);
  if (destinationNote) console.log(destinationNote);
  console.log(`Running: xcodebuild ${args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`);
  console.log(`Log: ${options.logPath}`);
  if (options.dryRun) return;

  const result = await runXcodebuild(options, resolvedDestination);
  console.log(
    JSON.stringify(
      {
        durationMs: result.durationMs,
        logPath: result.logPath,
        result: "ios-native-build-succeeded",
        scheme: options.scheme,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
