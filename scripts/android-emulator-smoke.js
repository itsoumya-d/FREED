#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { assertUsefulScreenshot } = require("./lib/png-screenshot-audit");

const DEFAULT_APK = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const DEFAULT_FIXTURE_APK = path.join(
  "android",
  "qa-webview-fixture",
  "build",
  "outputs",
  "apk",
  "debug",
  "qa-webview-fixture-debug.apk",
);
const DEFAULT_PACKAGE = "app.freed.recovery";
const DEFAULT_LAUNCH_WAIT_MS = 20000;
const DEFAULT_LOGCAT_LINES = 1000;

function parseArgs(argv) {
  const options = {
    apk: process.env.FREED_ANDROID_APK || DEFAULT_APK,
    clearAppData: false,
    device: process.env.FREED_ANDROID_DEVICE || "",
    fixtureApk: process.env.FREED_ANDROID_FIXTURE_APK || "",
    installFixture: false,
    launchWaitMs: DEFAULT_LAUNCH_WAIT_MS,
    logcatLines: DEFAULT_LOGCAT_LINES,
    metadataOutput: process.env.FREED_ANDROID_SMOKE_METADATA || "",
    output:
      process.env.FREED_ANDROID_SMOKE_OUTPUT ||
      path.join(
        "docs",
        "validation",
        "artifacts",
        "local-android-emulator-smoke",
        `android-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      ),
    packageName: process.env.FREED_ANDROID_PACKAGE || DEFAULT_PACKAGE,
    skipLogcatScan: false,
    skipInstall: false,
    selfTest: false,
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

    if (arg === "--apk") {
      options.apk = next();
    } else if (arg === "--clear-app-data") {
      options.clearAppData = true;
    } else if (arg === "--device") {
      options.device = next();
    } else if (arg === "--fixture-apk") {
      options.fixtureApk = next();
      options.installFixture = true;
    } else if (arg === "--install-fixture") {
      options.fixtureApk = DEFAULT_FIXTURE_APK;
      options.installFixture = true;
    } else if (arg === "--launch-wait-ms") {
      options.launchWaitMs = Number(next());
    } else if (arg === "--logcat-lines") {
      options.logcatLines = Number(next());
    } else if (arg === "--metadata-output") {
      options.metadataOutput = next();
    } else if (arg === "--output") {
      options.output = next();
    } else if (arg === "--package") {
      options.packageName = next();
    } else if (arg === "--skip-logcat-scan") {
      options.skipLogcatScan = true;
    } else if (arg === "--skip-install") {
      options.skipInstall = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.launchWaitMs) || options.launchWaitMs < 0) {
    throw new Error("--launch-wait-ms must be a non-negative number");
  }
  if (!Number.isInteger(options.logcatLines) || options.logcatLines <= 0) {
    throw new Error("--logcat-lines must be a positive integer");
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
  console.log(`Usage: npm run smoke:android-emulator -- [options]

Installs the FREED Android debug APK on an attached Android emulator/device,
launches the app, captures and audits a nonblank PNG screenshot, and records
target metadata.

Options:
  --apk <path>              APK to install. Default: ${DEFAULT_APK}
  --clear-app-data          Clear app data before launch.
  --device <serial>         adb device serial. Required if more than one target
                            is attached. Can also use FREED_ANDROID_DEVICE.
  --fixture-apk <path>      Install a QA WebView fixture APK before launch.
  --install-fixture         Install the default QA WebView fixture APK.
  --launch-wait-ms <ms>     Wait before screenshot. Default: ${DEFAULT_LAUNCH_WAIT_MS}
  --logcat-lines <count>    Logcat lines to scan after launch. Default: ${DEFAULT_LOGCAT_LINES}
  --metadata-output <path>  Metadata JSON path. Default: screenshot path with .json.
  --output <path>           Screenshot path.
  --package <name>          Android package. Default: ${DEFAULT_PACKAGE}
  --self-test               Run offline parser checks for logcat crash/ANR detection.
  --skip-logcat-scan        Do not clear/scan logcat for app crash and ANR signals.
  --skip-install            Launch an already-installed app.
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

async function listDevices() {
  const { stdout } = await run("adb", ["devices", "-l"]);
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      return { details: details.join(" "), serial, state };
    })
    .filter((device) => device.state === "device");
}

async function resolveDevice(requested) {
  const devices = await listDevices();
  if (requested) {
    const match = devices.find((device) => device.serial === requested);
    if (!match) {
      throw new Error(`Requested Android device is not attached or ready: ${requested}`);
    }
    return match;
  }
  if (devices.length === 0) {
    throw new Error("No ready Android emulator/device found. Start an emulator or connect hardware, then rerun.");
  }
  if (devices.length > 1) {
    throw new Error(
      `Multiple Android targets attached (${devices
        .map((device) => device.serial)
        .join(", ")}). Pass --device <serial>.`,
    );
  }
  return devices[0];
}

function adbArgs(serial, args) {
  return ["-s", serial, ...args];
}

async function getProp(serial, name) {
  const { stdout } = await run("adb", adbArgs(serial, ["shell", "getprop", name]));
  return stdout.trim();
}

async function resolveLaunchActivity(serial, packageName) {
  const { stdout } = await run("adb", adbArgs(serial, ["shell", "cmd", "package", "resolve-activity", "--brief", packageName]));
  const component = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.includes("/"));
  if (!component) {
    throw new Error(`Could not resolve launcher activity for ${packageName}`);
  }
  return component;
}

async function launchApp(serial, packageName) {
  const component = await resolveLaunchActivity(serial, packageName);
  await run(
    "adb",
    adbArgs(serial, [
      "shell",
      "am",
      "start",
      "-W",
      "-n",
      component,
      "-a",
      "android.intent.action.MAIN",
      "-c",
      "android.intent.category.LAUNCHER",
    ]),
    { echo: true },
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clearLogcat(serial) {
  await run("adb", adbArgs(serial, ["logcat", "-c"]));
}

function summarizeLogcat(logcat, packageName, lineLimit) {
  const packagePattern = escapeRegExp(packageName);
  const crashPatterns = [
    new RegExp(`ANR in ${packagePattern}`, "i"),
    new RegExp(`${packagePattern}.*\\bANR\\b`, "i"),
    new RegExp(`FATAL EXCEPTION[\\s\\S]{0,1200}${packagePattern}`, "i"),
    new RegExp(`Process:\\s*${packagePattern}[\\s\\S]{0,1200}(?:FATAL EXCEPTION|RuntimeException|\\bError\\b)`, "i"),
  ];
  const crashSignals = crashPatterns
    .map((pattern) => {
      const match = logcat.match(pattern);
      return match ? match[0].split(/\r?\n/).slice(0, 8).join("\n") : "";
    })
    .filter(Boolean);
  const interestingLines = logcat
    .split(/\r?\n/)
    .filter((line) => {
      const lower = line.toLowerCase();
      return (
        line.includes(packageName) ||
        line.includes("ReactNativeJS") ||
        line.includes("AndroidRuntime") ||
        lower.includes("fatal exception") ||
        lower.includes(" anr ") ||
        lower.includes("displayed ")
      );
    })
    .slice(-lineLimit);
  return {
    crashSignalCount: crashSignals.length,
    crashSignals,
    googlePlayStoreMissing: /requires the Google Play Store, but it is missing/i.test(logcat),
    interestingLines,
    reactNativeMainSeen: /ReactNativeJS:\s+Running "main"/.test(logcat),
    scanned: true,
  };
}

function runSelfTest() {
  const clean = summarizeLogcat(
    [
      "05-15 04:00:00.100 1234 1234 I ReactNativeJS: Running \"main\"",
      "05-15 04:00:01.100  579  619 I ActivityTaskManager: Displayed app.freed.recovery/.MainActivity for user 0: +1s79ms",
    ].join("\n"),
    DEFAULT_PACKAGE,
    10,
  );
  assert.equal(clean.crashSignalCount, 0);
  assert.equal(clean.reactNativeMainSeen, true);

  const appCrash = summarizeLogcat(
    [
      "05-15 04:00:02.100 2000 2000 E AndroidRuntime: FATAL EXCEPTION: mqt_native_modules",
      "05-15 04:00:02.101 2000 2000 E AndroidRuntime: Process: app.freed.recovery, PID: 2000",
      "05-15 04:00:02.102 2000 2000 E AndroidRuntime: java.lang.RuntimeException: smoke",
    ].join("\n"),
    DEFAULT_PACKAGE,
    10,
  );
  assert.equal(appCrash.crashSignalCount > 0, true);

  const appAnr = summarizeLogcat("05-15 04:00:03.100 579 631 E ActivityManager: ANR in app.freed.recovery", DEFAULT_PACKAGE, 10);
  assert.equal(appAnr.crashSignalCount > 0, true);

  const unrelatedCrash = summarizeLogcat(
    [
      "05-15 04:00:04.100 3000 3000 E AndroidRuntime: FATAL EXCEPTION: main",
      "05-15 04:00:04.101 3000 3000 E AndroidRuntime: Process: com.example.other, PID: 3000",
    ].join("\n"),
    DEFAULT_PACKAGE,
    10,
  );
  assert.equal(unrelatedCrash.crashSignalCount, 0);

  const missingPlay = summarizeLogcat(
    "05-15 04:00:05.100 2000 2100 W GooglePlayServicesUtil: app.freed.recovery requires the Google Play Store, but it is missing.",
    DEFAULT_PACKAGE,
    10,
  );
  assert.equal(missingPlay.googlePlayStoreMissing, true);
  assert.equal(defaultMetadataOutputFor("artifact.png"), "artifact.json");
  assert.equal(defaultMetadataOutputFor("artifact.PNG"), "artifact.json");
  assert.equal(defaultMetadataOutputFor("artifact"), "artifact.json");

  console.log("android-emulator-smoke self-test: pass");
}

async function scanLogcat(serial, packageName, lines) {
  const { stdout } = await run("adb", adbArgs(serial, ["logcat", "-d", "-t", String(lines)]));
  const summary = summarizeLogcat(stdout, packageName, 40);
  if (summary.crashSignalCount > 0) {
    throw new Error(
      `Android smoke detected app crash/ANR signal for ${packageName}:\n${summary.crashSignals.join("\n---\n")}`,
    );
  }
  return summary;
}

async function captureScreenshot(serial, output) {
  await new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const child = spawn("adb", adbArgs(serial, ["exec-out", "screencap", "-p"]));
    const file = fs.createWriteStream(output);
    let stderr = "";

    child.stdout.pipe(file);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    file.on("error", reject);
    child.on("exit", (code, signal) => {
      file.close(() => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`adb screencap failed with ${signal || code}\n${stderr}`));
      });
    });
  });

  const stats = fs.statSync(output);
  if (stats.size <= 0) {
    throw new Error(`Screenshot is empty: ${output}`);
  }
  return assertUsefulScreenshot(output);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const device = await resolveDevice(options.device);
  const serial = device.serial;

  await run("adb", adbArgs(serial, ["wait-for-device"]));

  if (!options.skipInstall) {
    if (!fs.existsSync(options.apk)) {
      throw new Error(`APK not found. Build it first or pass --apk: ${options.apk}`);
    }
    await run("adb", adbArgs(serial, ["install", "--no-streaming", "-r", options.apk]), { echo: true });
  }

  if (options.installFixture) {
    if (!fs.existsSync(options.fixtureApk)) {
      throw new Error(`Fixture APK not found. Build it first or pass --fixture-apk: ${options.fixtureApk}`);
    }
    await run("adb", adbArgs(serial, ["install", "--no-streaming", "-r", options.fixtureApk]), { echo: true });
  }

  if (options.clearAppData) {
    await run("adb", adbArgs(serial, ["shell", "pm", "clear", options.packageName]), { echo: true });
  }

  if (!options.skipLogcatScan) {
    await clearLogcat(serial);
  }

  await launchApp(serial, options.packageName);
  await new Promise((resolve) => setTimeout(resolve, options.launchWaitMs));
  const screenshot = await captureScreenshot(serial, options.output);
  const logcat = options.skipLogcatScan
    ? { scanned: false }
    : await scanLogcat(serial, options.packageName, options.logcatLines);

  const metadata = {
    apk: options.skipInstall ? null : options.apk,
    device: serial,
    deviceDetails: device.details,
    isEmulator: (await getProp(serial, "ro.kernel.qemu")) === "1",
    model: await getProp(serial, "ro.product.model"),
    osVersion: await getProp(serial, "ro.build.version.release"),
    output: options.output,
    packageName: options.packageName,
    logcat,
    result: "screenshot-captured",
    screenshot,
  };
  fs.mkdirSync(path.dirname(options.metadataOutput), { recursive: true });
  fs.writeFileSync(options.metadataOutput, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
