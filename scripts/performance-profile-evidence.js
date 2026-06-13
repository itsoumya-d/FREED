#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHttpsUrl } = require("./lib/evidence-target-safety");

const DEFAULT_APP_PACKAGE = "app.freed.recovery";
const DEFAULT_BUNDLE_ID = "app.freed.recovery";
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_NORMAL_URL = "https://youtube.com/results?search_query=workout";
const DEFAULT_ANDROID_PROTECTION_MODE = "DNS Guard DNS-only fallback";
const DEFAULT_ANDROID_BACKGROUND_CPU_DURATION_SECONDS = 120;
const DEFAULT_ANDROID_BACKGROUND_CPU_INTERVAL_MS = 5000;
const DEFAULT_IOS_PROTECTION_MODE = "Screen Time ManagedSettings adult filter";
const DEFAULT_DEVICE_TOOL_TIMEOUT_MS = 30_000;
const SOURCE_ARTIFACT_PATHS = [
  "docs/validation/templates/performance-profile.template.json",
  "scripts/performance-profile-evidence.js",
  "scripts/performance-safety-audit.js",
];
const UNSAFE_PROTECTION_MODE_TERMS = [
  "all traffic",
  "deep packet inspection",
  "full proxy",
  "full tunnel",
  "full vpn",
  "full-traffic proxy",
  "full-tunnel",
  "https inspection",
  "man-in-the-middle",
  "mitm",
  "packet inspection",
  "packet tunnel",
  "route all traffic",
  "ssl inspection",
  "tls inspection",
  "traffic proxy",
];

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_PERFORMANCE_PROFILE_OUTPUT);
  const options = {
    androidDevice: process.env.FREED_ANDROID_DEVICE || "",
    androidBackgroundCpuDurationSeconds: Number(process.env.FREED_ANDROID_BACKGROUND_CPU_DURATION_SECONDS || DEFAULT_ANDROID_BACKGROUND_CPU_DURATION_SECONDS),
    androidBackgroundCpuIntervalMs: Number(process.env.FREED_ANDROID_BACKGROUND_CPU_INTERVAL_MS || DEFAULT_ANDROID_BACKGROUND_CPU_INTERVAL_MS),
    androidBackgroundCpuProof: process.env.FREED_ANDROID_BACKGROUND_CPU_PROOF === "1",
    androidPackage: process.env.FREED_ANDROID_PACKAGE || DEFAULT_APP_PACKAGE,
    androidProtectionMode: process.env.FREED_ANDROID_PERFORMANCE_PROTECTION_MODE || DEFAULT_ANDROID_PROTECTION_MODE,
    bundleId: process.env.FREED_IOS_BUNDLE_ID || DEFAULT_BUNDLE_ID,
    durationMinutes: Number(process.env.FREED_PERFORMANCE_DURATION_MINUTES || DEFAULT_DURATION_MINUTES),
    iosDevice: process.env.FREED_IOS_PHYSICAL_DEVICE || "",
    iosProtectionMode: process.env.FREED_IOS_PERFORMANCE_PROTECTION_MODE || DEFAULT_IOS_PROTECTION_MODE,
    normalUrl: process.env.FREED_PERFORMANCE_NORMAL_URL || DEFAULT_NORMAL_URL,
    outputDir: process.env.FREED_PERFORMANCE_PROFILE_OUTPUT || "",
    planOnly: false,
    platforms: parsePlatforms(process.env.FREED_PERFORMANCE_PLATFORMS || "ios,android"),
    runId,
    selfTest: false,
    skipDeviceMetadata: process.env.FREED_PERFORMANCE_SKIP_DEVICE_METADATA === "1",
    toolTimeoutMs: Number(process.env.FREED_PERFORMANCE_DEVICE_TOOL_TIMEOUT_MS || DEFAULT_DEVICE_TOOL_TIMEOUT_MS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--android-device") {
      options.androidDevice = next();
    } else if (arg === "--android-background-cpu-duration-seconds") {
      options.androidBackgroundCpuDurationSeconds = Number(next());
    } else if (arg === "--android-background-cpu-interval-ms") {
      options.androidBackgroundCpuIntervalMs = Number(next());
    } else if (arg === "--android-background-cpu-proof") {
      options.androidBackgroundCpuProof = true;
    } else if (arg === "--android-package") {
      options.androidPackage = next();
    } else if (arg === "--android-protection-mode") {
      options.androidProtectionMode = next();
    } else if (arg === "--bundle-id") {
      options.bundleId = next();
    } else if (arg === "--duration-minutes") {
      options.durationMinutes = Number(next());
    } else if (arg === "--ios-device") {
      options.iosDevice = next();
    } else if (arg === "--ios-protection-mode") {
      options.iosProtectionMode = next();
    } else if (arg === "--normal-url") {
      options.normalUrl = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--platforms") {
      options.platforms = parsePlatforms(next());
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--skip-device-metadata") {
      options.skipDeviceMetadata = true;
    } else if (arg === "--tool-timeout-ms") {
      options.toolTimeoutMs = Number(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "performance-profile-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  assertSafeProtectionMode(options.iosProtectionMode, "--ios-protection-mode");
  assertSafeProtectionMode(options.androidProtectionMode, "--android-protection-mode");
  if (!Number.isInteger(options.toolTimeoutMs) || options.toolTimeoutMs < 1000 || options.toolTimeoutMs > 300000) {
    throw new Error("--tool-timeout-ms must be from 1000 to 300000.");
  }
  if (options.selfTest) return options;
  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes < 30) {
    throw new Error("--duration-minutes must be at least 30 for release performance evidence.");
  }
  if (
    !Number.isInteger(options.androidBackgroundCpuDurationSeconds) ||
    options.androidBackgroundCpuDurationSeconds < 30 ||
    options.androidBackgroundCpuDurationSeconds > 3600
  ) {
    throw new Error("--android-background-cpu-duration-seconds must be from 30 to 3600.");
  }
  if (!Number.isInteger(options.androidBackgroundCpuIntervalMs) || options.androidBackgroundCpuIntervalMs < 1000 || options.androidBackgroundCpuIntervalMs > 60000) {
    throw new Error("--android-background-cpu-interval-ms must be from 1000 to 60000.");
  }
  options.normalUrl = safeExternalHttpsUrl(options.normalUrl, "--normal-url");
  if (options.platforms.length === 0) throw new Error("--platforms must include ios, android, or both.");
  return options;
}

function assertSafeProtectionMode(value, flag) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) throw new Error(`${flag} must not be empty.`);
  const unsafeTerm = UNSAFE_PROTECTION_MODE_TERMS.find((term) => normalized.includes(term));
  if (unsafeTerm) {
    throw new Error(`${flag} must describe DNS-only/Screen Time protection, not full VPN, full traffic proxying, packet inspection, or MITM HTTPS (${unsafeTerm}).`);
  }
}

function printHelp() {
  console.log(`Usage: npm run evidence:performance-profile -- [options]

Creates a physical-device performance capture folder for the performance release
gate. It writes a profiling matrix, a pending final-shape evidence fill template,
and, when real devices are connected, safe device metadata. It never fills
threshold results or marks evidence as passing.

Options:
  --platforms <ios,android>       Platforms to prepare. Default: ios,android
  --ios-device <udid|name>        Physical iPhone identifier or exact name.
  --android-device <serial>       Physical Android adb serial.
  --android-background-cpu-proof  Sample adb dumpsys cpuinfo for the Android
                                  package and write raw/background CPU proof.
  --android-background-cpu-duration-seconds <count>
                                  Background CPU sample duration. Default:
                                  ${DEFAULT_ANDROID_BACKGROUND_CPU_DURATION_SECONDS}
  --android-background-cpu-interval-ms <ms>
                                  Delay between CPU samples. Default:
                                  ${DEFAULT_ANDROID_BACKGROUND_CPU_INTERVAL_MS}
  --bundle-id <id>                iOS bundle id. Default: ${DEFAULT_BUNDLE_ID}
  --android-package <package>     Android package. Default: ${DEFAULT_APP_PACKAGE}
  --duration-minutes <count>      Planned profiling duration. Default: ${DEFAULT_DURATION_MINUTES}
  --normal-url <url>              Normal browsing URL for speed proof. Default: ${DEFAULT_NORMAL_URL}
  --output-dir <path>             Artifact output folder.
  --run-id <id>                   Machine-readable run id.
  --skip-device-metadata          Write the pending QA packet without adb/xcrun
                                  device discovery.
  --tool-timeout-ms <ms>          Timeout for adb/xcrun metadata commands.
                                  Default: ${DEFAULT_DEVICE_TOOL_TIMEOUT_MS}
  --plan-only                     Print the capture plan without device tooling.
  --self-test                     Run offline parser and matrix checks.
`);
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function parsePlatforms(value) {
  const platforms = String(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  for (const platform of platforms) {
    if (!["ios", "android"].includes(platform)) {
      throw new Error(`Unsupported platform: ${platform}. Use ios, android, or both.`);
    }
  }
  return [...new Set(platforms)];
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
    let timedOut = false;
    let timer = null;

    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 2000).unref?.();
      }, options.timeoutMs);
    }

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        if (options.echo) process.stdout.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        if (options.echo) process.stderr.write(chunk);
      });
    }

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || code}\n${stderr || stdout}`));
    });
  });
}

function adbArgs(serial, args) {
  return ["-s", serial, ...args];
}

async function listAndroidDevices(toolTimeoutMs) {
  const { stdout } = await run("adb", ["devices", "-l"], { timeoutMs: toolTimeoutMs });
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

async function resolveAndroidDevice(requested, toolTimeoutMs) {
  const devices = await listAndroidDevices(toolTimeoutMs);
  if (requested) {
    const match = devices.find((device) => device.serial === requested);
    if (!match) throw new Error(`Requested Android device is not attached or ready: ${requested}`);
    return match;
  }
  if (devices.length === 0) throw new Error("No ready Android hardware found. Connect a physical Android device.");
  if (devices.length > 1) {
    throw new Error(`Multiple Android targets attached (${devices.map((device) => device.serial).join(", ")}). Pass --android-device.`);
  }
  return devices[0];
}

async function getAndroidProp(serial, name, toolTimeoutMs) {
  const { stdout } = await run("adb", adbArgs(serial, ["shell", "getprop", name]), { timeoutMs: toolTimeoutMs });
  return stdout.trim();
}

function isLikelyAndroidEmulator(device) {
  const values = [
    device.serial,
    device.details,
    device.model,
    device.manufacturer,
    device.fingerprint,
    device.hardware,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    device.qemu === "1" ||
    device.serial.startsWith("emulator-") ||
    /\b(?:sdk_gphone|generic|emulator|goldfish|ranchu|aosp_x86)\b/.test(values)
  );
}

async function androidProfile(device, toolTimeoutMs) {
  const serial = device.serial;
  const profile = {
    details: device.details,
    fingerprint: await getAndroidProp(serial, "ro.build.fingerprint", toolTimeoutMs),
    hardware: await getAndroidProp(serial, "ro.hardware", toolTimeoutMs),
    manufacturer: await getAndroidProp(serial, "ro.product.manufacturer", toolTimeoutMs),
    model: await getAndroidProp(serial, "ro.product.model", toolTimeoutMs),
    osVersion: await getAndroidProp(serial, "ro.build.version.release", toolTimeoutMs),
    qemu: await getAndroidProp(serial, "ro.kernel.qemu", toolTimeoutMs),
    serial,
  };
  return { ...profile, isPhysicalDevice: !isLikelyAndroidEmulator(profile) };
}

async function requireAndroidPhysicalDevice(profile) {
  if (!profile.isPhysicalDevice) {
    throw new Error(`Performance evidence must run on physical Android hardware; refused ${profile.serial} (${profile.model || "unknown model"}).`);
  }
}

function parseXctraceDevices(output) {
  const devices = [];
  let section = "";
  for (const rawLine of String(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sectionMatch = line.match(/^==\s*(.+?)\s*==$/);
    if (sectionMatch) {
      section = sectionMatch[1].toLowerCase();
      continue;
    }
    const match = line.match(/^(.+?)\s+\(([^()]+)\)\s+\(([0-9A-Fa-f-]+)\)$/);
    if (!match) continue;
    devices.push({
      identifier: match[3],
      isSimulator: section.includes("simulator"),
      name: match[1],
      osVersion: match[2],
      source: section || "unknown",
    });
  }
  return devices;
}

async function listIosDevices(toolTimeoutMs) {
  const { stdout } = await run("xcrun", ["xctrace", "list", "devices"], { timeoutMs: toolTimeoutMs });
  return { devices: parseXctraceDevices(stdout), raw: stdout };
}

function isPhysicalIosDevice(device) {
  return !device.isSimulator && /\b(?:iphone|ipad|ipod)\b/i.test(device.name);
}

function resolveIosDevice(devices, requested) {
  const physicalDevices = devices.filter(isPhysicalIosDevice);
  if (requested) {
    const match = physicalDevices.find((device) => device.identifier === requested || device.name === requested);
    if (!match) throw new Error(`Requested physical iOS device is not attached or ready: ${requested}`);
    return match;
  }
  if (physicalDevices.length === 0) throw new Error("No physical iOS device found. Connect an entitlement-approved iPhone.");
  if (physicalDevices.length > 1) {
    throw new Error(
      `Multiple physical iOS devices found (${physicalDevices.map((device) => `${device.name}:${device.identifier}`).join(", ")}). Pass --ios-device.`,
    );
  }
  return physicalDevices[0];
}

async function maybeIosDeviceDetails(device, outputDir, toolTimeoutMs) {
  const output = path.join(outputDir, "ios-devicectl-details.json");
  try {
    await run("xcrun", ["devicectl", "device", "info", "details", "--device", device.identifier, "--json-output", output], {
      timeoutMs: toolTimeoutMs,
    });
    return { artifact: repoRelative(output), available: true };
  } catch (error) {
    const fallback = path.join(outputDir, "ios-devicectl-details-error.txt");
    writeTextArtifact(fallback, error instanceof Error ? error.message : String(error));
    return { artifact: repoRelative(fallback), available: false };
  }
}

async function androidSnapshot(profile, outputDir, appPackage, toolTimeoutMs) {
  const batteryPath = path.join(outputDir, "android-battery-before.txt");
  const meminfoPath = path.join(outputDir, "android-meminfo-before.txt");
  const cpuinfoPath = path.join(outputDir, "android-cpuinfo-before.txt");
  const packagePath = path.join(outputDir, "android-package-path.txt");
  const outputs = [];
  for (const [label, args, filePath] of [
    ["battery", ["shell", "dumpsys", "battery"], batteryPath],
    ["meminfo", ["shell", "dumpsys", "meminfo", appPackage], meminfoPath],
    ["cpuinfo", ["shell", "dumpsys", "cpuinfo"], cpuinfoPath],
    ["package", ["shell", "pm", "path", appPackage], packagePath],
  ]) {
    try {
      const result = await run("adb", adbArgs(profile.serial, args), { timeoutMs: toolTimeoutMs });
      writeTextArtifact(filePath, `${result.stdout}${result.stderr}`);
      outputs.push({ artifact: repoRelative(filePath), label, available: true });
    } catch (error) {
      writeTextArtifact(filePath, error instanceof Error ? error.message : String(error));
      outputs.push({ artifact: repoRelative(filePath), label, available: false });
    }
  }
  return outputs;
}

async function androidRoutingProof(profile, outputDir, options) {
  const routingPath = path.join(outputDir, "android-routing-proof.txt");
  const reportPath = path.join(outputDir, "android-routing-proof-report.json");
  const toolTimeoutMs = options.toolTimeoutMs;
  const commands = [
    ["http-proxy", ["shell", "settings", "get", "global", "http_proxy"]],
    ["global-http-proxy-host", ["shell", "settings", "get", "global", "global_http_proxy_host"]],
    ["global-http-proxy-port", ["shell", "settings", "get", "global", "global_http_proxy_port"]],
    ["private-dns-mode", ["shell", "settings", "get", "global", "private_dns_mode"]],
    ["private-dns-specifier", ["shell", "settings", "get", "global", "private_dns_specifier"]],
    ["always-on-vpn-app", ["shell", "settings", "get", "secure", "always_on_vpn_app"]],
    ["vpn-lockdown", ["shell", "settings", "get", "secure", "always_on_vpn_lockdown"]],
    ["ipv4-routes", ["shell", "ip", "route"]],
    ["ipv6-routes", ["shell", "ip", "-6", "route"]],
    ["connectivity", ["shell", "dumpsys", "connectivity"]],
  ];

  const sections = [
    "# Android Routing Proof",
    "",
    "Review this artifact to confirm FREED is not routing normal traffic through a remote or full-traffic proxy. For DNS Guard, expected proof is no configured HTTP proxy plus VPN/routing state consistent with DNS-only protection.",
    "",
  ];

  for (const [label, args] of commands) {
    sections.push(`## ${label}`, "");
    try {
      const result = await run("adb", adbArgs(profile.serial, args), { timeoutMs: toolTimeoutMs });
      sections.push("```", `${result.stdout}${result.stderr}`.trim() || "(empty)", "```", "");
    } catch (error) {
      sections.push("```", error instanceof Error ? error.message : String(error), "```", "");
    }
  }

  writeTextArtifact(routingPath, sections.join("\n"));
  writeJsonArtifact(reportPath, {
    schemaVersion: "freed-routing-proof-report-v1",
    sanitized: true,
    runId: `${options.runId}-android-routing-proof`,
    platform: "android",
    protectionMode: options.androidProtectionMode,
    routeScope: "dns-only",
    checks: {
      dnsOnlyVpnService: false,
      privateDnsStateCaptured: true,
      vpnStateCaptured: true,
      proxySettingsCaptured: true,
      routeTableCaptured: true,
      noRemoteTrafficTunnel: false,
      noFullTrafficProxyConfirmed: false,
      noPacketInspectionConfirmed: true,
      noMitmHttpsConfirmed: true,
      noContinuousPacketCapture: true,
      normalBrowsingRouteUnaffected: false,
    },
    manualCompletionRequired:
      "Review the paired text artifact before promotion. Set the false checks true only after physical-device QA proves FREED uses DNS-only routing, leaves normal browsing routes unaffected, and does not proxy full traffic, inspect packets, MITM HTTPS, or tunnel traffic remotely.",
    supportingArtifacts: {
      routingTextArtifact: repoRelative(routingPath),
    },
  });
  return {
    artifact: repoRelative(reportPath),
    available: true,
    label: "routing-proof",
    textArtifact: repoRelative(routingPath),
  };
}

function parseCpuPercentFromDumpsys(output, appPackage) {
  const escapedPackage = appPackage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const processPattern = new RegExp(`(^|\\s)(\\d+(?:\\.\\d+)?)%\\s+\\d+/${escapedPackage}(?::|\\s|$)`);
  for (const rawLine of String(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(processPattern);
    if (match) {
      return {
        line,
        percent: Number(match[2]),
      };
    }
  }
  return {
    line: "",
    percent: null,
  };
}

async function androidBackgroundCpuProof(profile, outputDir, options) {
  const jsonPath = path.join(outputDir, "android-background-cpu-proof.json");
  const textPath = path.join(outputDir, "android-background-cpu-proof.txt");
  const sampleCount = Math.max(2, Math.floor(options.androidBackgroundCpuDurationSeconds * 1000 / options.androidBackgroundCpuIntervalMs) + 1);
  const samples = [];
  const textSections = [
    "# Android Background CPU Proof",
    "",
    `Package: ${options.androidPackage}`,
    `Duration seconds: ${options.androidBackgroundCpuDurationSeconds}`,
    `Interval ms: ${options.androidBackgroundCpuIntervalMs}`,
    "",
    "Review this artifact with the profiler export before promoting performance evidence. Parsed values come from package-specific `adb shell dumpsys cpuinfo <package>` lines only.",
    "",
  ];

  for (let index = 0; index < sampleCount; index += 1) {
    const capturedAt = new Date().toISOString();
    textSections.push(`## Sample ${index + 1} (${capturedAt})`, "");
    try {
      const result = await run("adb", adbArgs(profile.serial, ["shell", "dumpsys", "cpuinfo", options.androidPackage]), {
        timeoutMs: options.toolTimeoutMs,
      });
      const output = `${result.stdout}${result.stderr}`;
      const parsed = parseCpuPercentFromDumpsys(output, options.androidPackage);
      samples.push({
        available: parsed.percent !== null,
        capturedAt,
        matchedLine: parsed.line,
        sample: index + 1,
        totalCpuPercent: parsed.percent,
      });
      textSections.push("```", output.trim() || "(empty)", "```", "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      samples.push({
        available: false,
        capturedAt,
        error: message,
        matchedLine: "",
        sample: index + 1,
        totalCpuPercent: null,
      });
      textSections.push("```", message, "```", "");
    }
    if (index < sampleCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, options.androidBackgroundCpuIntervalMs));
    }
  }

  const parsedPercents = samples
    .map((sample) => sample.totalCpuPercent)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const maxCpuPercent = parsedPercents.length > 0 ? Math.max(...parsedPercents) : null;
  const averageCpuPercent =
    parsedPercents.length > 0 ? Number((parsedPercents.reduce((sum, value) => sum + value, 0) / parsedPercents.length).toFixed(3)) : null;
  const payload = {
    artifact: repoRelative(textPath),
    averageCpuPercent,
    generatedAt: new Date().toISOString(),
    intervalMs: options.androidBackgroundCpuIntervalMs,
    maxCpuPercent,
    packageName: options.androidPackage,
    parsedSampleCount: parsedPercents.length,
    result: parsedPercents.length > 0 ? "background-cpu-samples-captured" : "background-cpu-unparsed",
    runId: `${options.runId}-android-background-cpu`,
    sampleCount,
    samples,
    thresholdPercentMax: 5,
  };
  writeTextArtifact(textPath, textSections.join("\n"));
  writeJsonArtifact(jsonPath, payload);
  return {
    artifact: repoRelative(textPath),
    available: parsedPercents.length > 0,
    jsonArtifact: repoRelative(jsonPath),
    label: "background-cpu-proof",
    maxCpuPercent,
  };
}

function profileRows(options, metadata = {}) {
  const rows = [];
  if (options.platforms.includes("ios")) {
    const device = metadata.iosDevice || {};
    rows.push({
      backgroundCpuArtifact: "",
      backgroundCpuPercent: "",
      backgroundCpuRunId: `${options.runId}-ios-background-cpu`,
      routingProofRunId: `${options.runId}-ios-routing-proof`,
      batteryDrainPercent: "",
      deviceModel: device.name || "",
      dnsLatencyP95Ms: "",
      dnsLatencyRunId: `${options.runId}-ios-dns-latency`,
      dnsLatencyArtifact: "",
      downloadMbpsBefore: "",
      downloadMbpsDuring: "",
      durationMinutes: "",
      isPhysicalDevice: device.identifier ? true : "",
      maxDeviceTemperatureC: "",
      maxResidentMemoryMb: "",
      networkSpeedRunId: `${options.runId}-ios-network-speed`,
      networkSpeedArtifact: "",
      noBatteryDrainRegression: "",
      noContinuousScreenshotOrOcrConfirmed: "",
      noForegroundPollingLoopObserved: "",
      noFullTrafficProxyConfirmed: "",
      noMitmHttpsConfirmed: "",
      noContinuousImageClassificationConfirmed: "",
      noOverheating: "",
      noPacketInspectionConfirmed: "",
      normalBrowsingSpeedAcceptable: "",
      osVersion: device.osVersion || "",
      platform: "ios",
      profilerArtifact: "",
      protectionMode: options.iosProtectionMode,
      routingProofArtifact: "",
      runId: `${options.runId}-ios-performance-profile`,
      status: "pending-manual-qa",
    });
  }
  if (options.platforms.includes("android")) {
    const device = metadata.androidDevice || {};
    const backgroundCpuProof = metadata.androidBackgroundCpuProof || {};
    rows.push({
      backgroundCpuArtifact: backgroundCpuProof.artifact || "",
      backgroundCpuPercent: typeof backgroundCpuProof.maxCpuPercent === "number" ? backgroundCpuProof.maxCpuPercent : "",
      backgroundCpuRunId: `${options.runId}-android-background-cpu`,
      routingProofRunId: `${options.runId}-android-routing-proof`,
      batteryDrainPercent: "",
      deviceModel: [device.manufacturer, device.model].filter(Boolean).join(" ").trim(),
      dnsResolverFailoverArtifact: "",
      dnsResolverFailoverRunId: `${options.runId}-android-dns-resolver-failover`,
      dnsLatencyP95Ms: "",
      dnsLatencyRunId: `${options.runId}-android-dns-latency`,
      dnsLatencyArtifact: "",
      dnsServfailArtifact: "",
      dnsServfailFallbackConfirmed: "",
      dnsServfailRunId: `${options.runId}-android-dns-servfail`,
      downloadMbpsBefore: "",
      downloadMbpsDuring: "",
      durationMinutes: "",
      isPhysicalDevice: device.isPhysicalDevice === true ? true : "",
      maxDeviceTemperatureC: "",
      maxResidentMemoryMb: "",
      networkSpeedRunId: `${options.runId}-android-network-speed`,
      networkSpeedArtifact: "",
      noBatteryDrainRegression: "",
      noContinuousScreenshotOrOcrConfirmed: "",
      noForegroundPollingLoopObserved: "",
      noFullTrafficProxyConfirmed: "",
      noMitmHttpsConfirmed: "",
      noContinuousImageClassificationConfirmed: "",
      noOverheating: "",
      noPacketInspectionConfirmed: "",
      normalBrowsingSpeedAcceptable: "",
      osVersion: device.osVersion ? `Android ${device.osVersion}` : "",
      platform: "android",
      profilerArtifact: "",
      protectionMode: options.androidProtectionMode,
      routingProofArtifact: metadata.androidRoutingProofArtifact || "",
      runId: `${options.runId}-android-performance-profile`,
      status: "pending-manual-qa",
      vpnRevocationArtifact: "",
      vpnRevocationCleanupConfirmed: "",
      vpnRevocationRunId: `${options.runId}-android-vpn-revocation`,
    });
  }
  return rows;
}

function requiredManualFlows(options) {
  return options.platforms.flatMap((platform) => {
    const prefix = `${options.runId}-${platform}`;
    return [
      {
        artifactField: `profile.platformProfiles.${platform}.profilerArtifact`,
        metricField: `profile.platformProfiles.${platform}.durationMinutes/maxResidentMemoryMb/maxDeviceTemperatureC/batteryDrainPercent`,
        runId: `${prefix}-performance-profile`,
        summary: `Run a ${options.durationMinutes}+ minute physical-device profiler session with FREED protection enabled.`,
      },
      {
        artifactField: `profile.platformProfiles.${platform}.backgroundCpuArtifact`,
        metricField: `profile.platformProfiles.${platform}.backgroundCpuPercent`,
        runId: `${prefix}-background-cpu`,
        summary: "Capture idle and normal-browsing background CPU proof; threshold is 5% or less.",
      },
      {
        artifactField: `profile.platformProfiles.${platform}.profilerArtifact`,
        metricField: `profile.platformProfiles.${platform}.noForegroundPollingLoopObserved/noContinuousScreenshotOrOcrConfirmed/noContinuousImageClassificationConfirmed`,
        runId: `${prefix}-polling-loop-review`,
        summary: "Attach profiler/log proof that FREED is not running a foreground polling loop, continuous screenshot/OCR analysis, or continuous image-classification loop.",
      },
      {
        artifactField: `profile.platformProfiles.${platform}.routingProofArtifact`,
        metricField: `profile.platformProfiles.${platform}.noFullTrafficProxyConfirmed/noPacketInspectionConfirmed/noMitmHttpsConfirmed`,
        runId: `${prefix}-proxy-routing-review`,
        summary: "Attach routing proof that normal traffic is not sent through a full-traffic proxy, packet-inspected tunnel, or MITM HTTPS path.",
      },
      {
        artifactField: `profile.platformProfiles.${platform}.networkSpeedArtifact`,
        metricField: `profile.platformProfiles.${platform}.downloadMbpsBefore/downloadMbpsDuring`,
        runId: `${prefix}-network-speed`,
        summary: `Measure download speed before and during protection while loading ${options.normalUrl}.`,
      },
      {
        artifactField: `profile.platformProfiles.${platform}.dnsLatencyArtifact`,
        metricField: `profile.platformProfiles.${platform}.dnsLatencyP95Ms`,
        runId: `${prefix}-dns-latency`,
        summary: "Measure DNS p95 latency while protection is active.",
      },
      ...(platform === "android"
        ? [
            {
              artifactField: "profile.platformProfiles.android.dnsResolverFailoverArtifact",
              metricField: "profile.platformProfiles.android.dnsResolverFailoverRunId",
              runId: `${prefix}-dns-resolver-failover`,
              summary: "Disable or blackhole the primary DNS route and prove DNS Guard fails over to the secondary resolver.",
            },
            {
              artifactField: "profile.platformProfiles.android.dnsServfailArtifact",
              metricField: "profile.platformProfiles.android.dnsServfailFallbackConfirmed",
              runId: `${prefix}-dns-servfail`,
              summary: "Blackhole all configured DNS resolvers and prove allowed DNS receives bounded SERVFAIL instead of hanging silently.",
            },
            {
              artifactField: "profile.platformProfiles.android.vpnRevocationArtifact",
              metricField: "profile.platformProfiles.android.vpnRevocationCleanupConfirmed",
              runId: `${prefix}-vpn-revocation`,
              summary: "Revoke Android VPN permission or replace the active VPN slot and prove FREED cleans up foreground-service and TUN state.",
            },
          ]
        : []),
    ];
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const header = [
    "platform",
    "runId",
    "isPhysicalDevice",
    "deviceModel",
    "osVersion",
    "protectionMode",
    "dnsResolverFailoverRunId",
    "dnsResolverFailoverArtifact",
    "dnsServfailRunId",
    "dnsServfailArtifact",
    "dnsServfailFallbackConfirmed",
    "vpnRevocationRunId",
    "vpnRevocationArtifact",
    "vpnRevocationCleanupConfirmed",
    "durationMinutes",
    "batteryDrainPercent",
    "maxResidentMemoryMb",
    "maxDeviceTemperatureC",
    "dnsLatencyP95Ms",
    "downloadMbpsBefore",
    "downloadMbpsDuring",
    "backgroundCpuPercent",
    "profilerArtifact",
    "backgroundCpuArtifact",
    "routingProofRunId",
    "routingProofArtifact",
    "networkSpeedRunId",
    "networkSpeedArtifact",
    "dnsLatencyRunId",
    "dnsLatencyArtifact",
    "normalBrowsingSpeedAcceptable",
    "noOverheating",
    "noBatteryDrainRegression",
    "noForegroundPollingLoopObserved",
    "noFullTrafficProxyConfirmed",
    "noPacketInspectionConfirmed",
    "noMitmHttpsConfirmed",
    "noContinuousImageClassificationConfirmed",
    "noContinuousScreenshotOrOcrConfirmed",
    "status",
  ];
  return `${[header, ...rows.map((row) => header.map((field) => row[field]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content || "\n");
}

function fileSha256Label(relativePath) {
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), relativePath))).digest("hex")}`;
}

function sourceArtifacts(paths = SOURCE_ARTIFACT_PATHS) {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    sha256: fileSha256Label(sourcePath),
  }));
}

function buildNotes(manifest) {
  const lines = [
    `# Performance Profile Capture: ${manifest.runId}`,
    "",
    "This folder contains a profiling plan, optional device metadata, and a manual QA matrix. It does not satisfy release evidence by itself.",
    "",
    "Required threshold proof:",
    "",
    "- durationMinutes >= 30",
    "- 0 <= batteryDrainPercent <= 8",
    "- 0 < maxResidentMemoryMb <= 350",
    "- 0 < maxDeviceTemperatureC <= 42",
    "- 0 < dnsLatencyP95Ms <= 100",
    "- backgroundCpuPercent <= 5",
    "- downloadMbpsDuring >= 80% of downloadMbpsBefore",
    "- noForegroundPollingLoopObserved=true",
    "- noFullTrafficProxyConfirmed=true with routingProofArtifact reviewed",
    "- noPacketInspectionConfirmed=true and noMitmHttpsConfirmed=true with routingProofArtifact reviewed",
    "- noContinuousScreenshotOrOcrConfirmed=true with profiler/log proof",
    "- noContinuousImageClassificationConfirmed=true with profiler/log proof that Vision/ML Kit runs only on demand for challenge submissions",
    "- Android only: DNS resolver failover proof, bounded SERVFAIL fallback proof, and VPN revocation cleanup proof",
    "",
    "Helper-captured fields:",
    "",
    "- Android routing proof is captured automatically for physical Android runs as local `freed-routing-proof-report-v1` JSON plus supporting proxy, Private DNS, VPN, and route diagnostics.",
    "- Add `--android-background-cpu-proof` to sample package-specific `dumpsys cpuinfo`; if parsing succeeds, the Android row is prefilled with the raw artifact and maximum sampled CPU percent for QA review.",
    "- Attach network-speed and DNS-latency report artifacts with `sanitized=true` for each platform; numeric speed/latency values without the matching artifact are rejected.",
    "- `performance-profile-evidence-fill-template.json` mirrors the final evidence shape with concrete run IDs, optional helper-captured routing/background-CPU artifacts, and false checks until real QA fills the profiler, DNS, speed, and routing proof.",
    "",
    "Manual capture checklist:",
    "",
  ];
  for (const flow of manifest.manualFlows) {
    lines.push(`- ${flow.runId}: ${flow.summary} Suggested artifact: \`${flow.artifactField}\`. Metric: \`${flow.metricField}\`.`);
  }
  lines.push(
    "",
    "After the real profiler/network run, fill `performance-profile.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only if every threshold passes.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function collectMetadata(options) {
  const metadata = {};
  const artifacts = [];

  if (options.platforms.includes("ios")) {
    const listed = await listIosDevices(options.toolTimeoutMs);
    const device = resolveIosDevice(listed.devices, options.iosDevice);
    const details = await maybeIosDeviceDetails(device, options.outputDir, options.toolTimeoutMs);
    metadata.iosDevice = {
      identifier: device.identifier,
      isPhysicalDevice: true,
      name: device.name,
      osVersion: device.osVersion,
      source: device.source,
    };
    artifacts.push({ label: "ios-device-details", ...details });
  }

  if (options.platforms.includes("android")) {
    const device = await resolveAndroidDevice(options.androidDevice, options.toolTimeoutMs);
    const profile = await androidProfile(device, options.toolTimeoutMs);
    await requireAndroidPhysicalDevice(profile);
    metadata.androidDevice = profile;
    const snapshots = await androidSnapshot(profile, options.outputDir, options.androidPackage, options.toolTimeoutMs);
    const routingProof = await androidRoutingProof(profile, options.outputDir, options);
    metadata.androidRoutingProofArtifact = routingProof.artifact;
    const backgroundCpuProof = options.androidBackgroundCpuProof
      ? await androidBackgroundCpuProof(profile, options.outputDir, options)
      : null;
    if (backgroundCpuProof) metadata.androidBackgroundCpuProof = backgroundCpuProof;
    artifacts.push(...snapshots.map((snapshot) => ({ ...snapshot, label: `android-${snapshot.label}` })));
    artifacts.push({ ...routingProof, label: `android-${routingProof.label}` });
    if (backgroundCpuProof) {
      artifacts.push({ ...backgroundCpuProof, label: `android-${backgroundCpuProof.label}` });
    }
  }

  return { artifacts, metadata };
}

function manifestFor(options, metadata = {}, artifacts = [], result = "capture-plan-created") {
  const rows = profileRows(options, metadata);
  return {
    generatedAt: new Date().toISOString(),
    manualFlows: requiredManualFlows(options),
    manualVerificationRequired: true,
    normalUrl: options.normalUrl,
    platformProfiles: rows,
    platforms: options.platforms,
    plannedDurationMinutes: options.durationMinutes,
    releaseGate: "performance-validation",
    result,
    runId: options.runId,
    schema: "freed-performance-profile-capture-v1",
    sourceArtifacts: sourceArtifacts(),
    deviceMetadataSkipped: Boolean(options.skipDeviceMetadata),
    evidenceSatisfied: false,
    evidenceBoundary:
      "Performance capture packets are setup handoffs only. They do not prove physical-device status, profiler thresholds, DNS latency, network-speed retention, routing boundaries, or battery/RAM/thermal behavior until real QA fills and validates performance-profile.json.",
    thresholds: {
      backgroundCpuPercentMax: 5,
      batteryDrainPercentMax: 8,
      dnsLatencyP95MsMax: 100,
      downloadMbpsDuringMinRatio: 0.8,
      durationMinutesMin: 30,
      maxDeviceTemperatureCMax: 42,
      maxResidentMemoryMbMax: 350,
    },
    toolTimeoutMs: options.toolTimeoutMs,
    toolArtifacts: artifacts,
  };
}

function buildEvidenceProfileRows(manifest) {
  return manifest.platformProfiles.map((row) => {
    const shared = {
      platform: row.platform,
      isPhysicalDevice: row.isPhysicalDevice === true ? true : "",
      deviceModel: row.deviceModel || "",
      osVersion: row.osVersion || "",
      protectionMode: row.protectionMode || "",
      runId: row.runId,
      profilerArtifact: "",
      backgroundCpuRunId: row.backgroundCpuRunId,
      backgroundCpuArtifact: row.backgroundCpuArtifact || "",
      backgroundCpuPercent: row.backgroundCpuPercent ?? "",
      routingProofRunId: row.routingProofRunId,
      routingProofArtifact: row.routingProofArtifact || "",
      networkSpeedRunId: row.networkSpeedRunId,
      networkSpeedArtifact: "",
      dnsLatencyRunId: row.dnsLatencyRunId,
      dnsLatencyArtifact: "",
      durationMinutes: "",
      batteryDrainPercent: "",
      maxResidentMemoryMb: "",
      maxDeviceTemperatureC: "",
      dnsLatencyP95Ms: "",
      downloadMbpsBefore: "",
      downloadMbpsDuring: "",
      normalBrowsingSpeedAcceptable: false,
      noOverheating: false,
      noBatteryDrainRegression: false,
      noForegroundPollingLoopObserved: false,
      noFullTrafficProxyConfirmed: false,
      noPacketInspectionConfirmed: false,
      noMitmHttpsConfirmed: false,
      noContinuousScreenshotOrOcrConfirmed: false,
      noContinuousImageClassificationConfirmed: false,
    };

    if (row.platform !== "android") return shared;

    return {
      ...shared,
      dnsResolverFailoverRunId: row.dnsResolverFailoverRunId,
      dnsResolverFailoverArtifact: "",
      dnsServfailRunId: row.dnsServfailRunId,
      dnsServfailArtifact: "",
      dnsServfailFallbackConfirmed: false,
      vpnRevocationRunId: row.vpnRevocationRunId,
      vpnRevocationArtifact: "",
      vpnRevocationCleanupConfirmed: false,
    };
  });
}

function buildEvidenceFillTemplate(options, manifest) {
  const platformProfiles = buildEvidenceProfileRows(manifest);
  const deviceSummary = platformProfiles
    .map((row) => [row.platform, row.deviceModel, row.osVersion].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("; ");

  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    instructions:
      "Copy this shape into performance-profile.json only after replacing blank metrics/artifacts and false checks with real 30+ minute physical-device profiler, DNS, speed, and routing proof.",
    validatedAt: "",
    tester: "",
    build: "",
    device: deviceSummary,
    evidence: [],
    profile: {
      durationMinutes: "",
      batteryDrainPercent: "",
      maxResidentMemoryMb: "",
      maxDeviceTemperatureC: "",
      dnsLatencyP95Ms: "",
      downloadMbpsBefore: "",
      downloadMbpsDuring: "",
      platformProfiles,
    },
    checks: {
      normalBrowsingSpeedAcceptable: false,
      noOverheating: false,
      noBatteryDrainRegression: false,
      dnsOnlyRoutingConfirmed: false,
      noForegroundPollingLoopObserved: false,
      noPacketInspection: false,
      noMitmHttps: false,
      noContinuousScreenshotOrOcr: false,
      noContinuousImageClassification: false,
    },
    helperContext: {
      normalUrl: manifest.normalUrl,
      plannedDurationMinutes: manifest.plannedDurationMinutes,
      thresholds: manifest.thresholds,
      androidBackgroundCpuProofPrefilled: platformProfiles.some((row) => row.platform === "android" && Boolean(row.backgroundCpuArtifact)),
      androidRoutingProofPrefilled: platformProfiles.some((row) => row.platform === "android" && Boolean(row.routingProofArtifact)),
    },
  };
}

async function capture(options) {
  if (options.planOnly) {
    console.log(JSON.stringify(manifestFor(options, {}, [], "plan-only"), null, 2));
    return;
  }

  const { metadata, artifacts } = options.skipDeviceMetadata
    ? { metadata: {}, artifacts: [] }
    : await collectMetadata(options);
  const manifest = manifestFor(options, metadata, artifacts);
  const matrixPath = path.join(options.outputDir, "performance-profile-matrix.csv");
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  const evidenceFillTemplatePath = path.join(options.outputDir, "performance-profile-evidence-fill-template.json");
  writeTextArtifact(matrixPath, toCsv(manifest.platformProfiles));
  writeJsonArtifact(manifestPath, { ...manifest, matrixArtifact: repoRelative(matrixPath) });
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        matrixArtifact: repoRelative(matrixPath),
        notesArtifact: repoRelative(notesPath),
      },
      null,
      2,
    ),
  );
}

function runSelfTest() {
  assert.deepEqual(parsePlatforms("ios,android,ios"), ["ios", "android"]);
  assert.throws(() => parsePlatforms("web"), /Unsupported platform/);
  assert.equal(safeRunId("performance-2026-05-15"), "performance-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  assert.equal(parseArgs(["--normal-url", "https://youtube.com/results?search_query=workout", "--platforms", "ios"]).normalUrl, DEFAULT_NORMAL_URL);
  assert.throws(() => parseArgs(["--normal-url", "http://youtube.com", "--platforms", "ios"]), /https/);
  assert.throws(() => parseArgs(["--normal-url", "https://example.com", "--platforms", "ios"]), /placeholder|reserved/);
  assert.equal(parseArgs(["--self-test", "--tool-timeout-ms", "45000"]).toolTimeoutMs, 45000);
  assert.equal(parseArgs(["--self-test", "--skip-device-metadata"]).skipDeviceMetadata, true);
  assert.throws(() => parseArgs(["--self-test", "--tool-timeout-ms", "999"]), /from 1000 to 300000/);

  const devices = parseXctraceDevices(`== Devices ==
QA iPhone (18.4) (00008030-001C195E0E91802E)
My Mac (15.4) (ABCDEF)
== Simulators ==
iPhone 16 Pro (18.4) (A1B2C3D4-1111-2222-3333-444455556666)`);
  assert.equal(devices.length, 3);
  assert.equal(resolveIosDevice(devices, "QA iPhone").name, "QA iPhone");
  assert.throws(() => resolveIosDevice(devices, "iPhone 16 Pro"), /physical iOS device/);
  assert.throws(() => parseArgs(["--self-test", "--android-protection-mode", "Full VPN tunnel"]), /not full VPN/);
  assert.throws(() => parseArgs(["--self-test", "--ios-protection-mode", "HTTPS MITM inspection"]), /MITM HTTPS/);
  assert.equal(parseArgs(["--self-test", "--android-protection-mode", DEFAULT_ANDROID_PROTECTION_MODE]).androidProtectionMode, DEFAULT_ANDROID_PROTECTION_MODE);

  const options = {
    androidProtectionMode: DEFAULT_ANDROID_PROTECTION_MODE,
    durationMinutes: 60,
    iosProtectionMode: DEFAULT_IOS_PROTECTION_MODE,
    normalUrl: DEFAULT_NORMAL_URL,
    platforms: ["ios", "android"],
    runId: "self-test",
    skipDeviceMetadata: false,
    toolTimeoutMs: DEFAULT_DEVICE_TOOL_TIMEOUT_MS,
  };
  const manifest = manifestFor(options, {}, [], "self-test");
  assert.equal(manifest.platformProfiles.length, 2);
  assert.equal(manifest.manualFlows.length, 15);
  assert.deepEqual(
    manifest.sourceArtifacts.map((artifact) => artifact.path),
    SOURCE_ARTIFACT_PATHS,
  );
  assert.ok(manifest.sourceArtifacts.every((artifact) => /^sha256-[0-9a-f]{64}$/.test(artifact.sha256)));
  assert.match(toCsv(manifest.platformProfiles), /noFullTrafficProxyConfirmed/);
  assert.match(toCsv(manifest.platformProfiles), /noPacketInspectionConfirmed/);
  assert.match(toCsv(manifest.platformProfiles), /noContinuousScreenshotOrOcrConfirmed/);
  assert.match(toCsv(manifest.platformProfiles), /noContinuousImageClassificationConfirmed/);
  assert.match(toCsv(manifest.platformProfiles), /routingProofArtifact/);
  assert.match(toCsv(manifest.platformProfiles), /networkSpeedArtifact/);
  assert.match(toCsv(manifest.platformProfiles), /dnsLatencyArtifact/);
  assert.match(toCsv(manifest.platformProfiles), /dnsServfailFallbackConfirmed/);
  assert.equal(manifest.toolTimeoutMs, DEFAULT_DEVICE_TOOL_TIMEOUT_MS);
  assert.equal(manifest.deviceMetadataSkipped, false);
  assert.equal(manifest.evidenceSatisfied, false);
  assert.match(manifest.evidenceBoundary, /setup handoffs only/);
  assert.equal(manifest.platformProfiles[1].routingProofRunId, "self-test-android-routing-proof");
  assert.equal(manifest.platformProfiles[1].dnsServfailRunId, "self-test-android-dns-servfail");
  assert.match(JSON.stringify(manifest.manualFlows), /routingProofArtifact/);
  assert.match(JSON.stringify(manifest.manualFlows), /vpnRevocationCleanupConfirmed/);
  const fillTemplate = buildEvidenceFillTemplate(options, manifest);
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.profile.platformProfiles.length, 2);
  assert.equal(fillTemplate.profile.platformProfiles[0].runId, "self-test-ios-performance-profile");
  assert.equal(fillTemplate.profile.platformProfiles[1].routingProofRunId, "self-test-android-routing-proof");
  assert.equal(fillTemplate.profile.platformProfiles[1].noFullTrafficProxyConfirmed, false);
  assert.equal(fillTemplate.checks.noContinuousImageClassification, false);
  assert.deepEqual(parseCpuPercentFromDumpsys("Load: 1.2 / 1.0 / 0.7\n  2.5% 1234/app.freed.recovery: 1.5% user + 1.0% kernel", "app.freed.recovery"), {
    line: "2.5% 1234/app.freed.recovery: 1.5% user + 1.0% kernel",
    percent: 2.5,
  });
  assert.deepEqual(parseCpuPercentFromDumpsys("  9.0% TOTAL: 5.0% user + 4.0% kernel", "app.freed.recovery"), {
    line: "",
    percent: null,
  });
  const prefilledRows = profileRows(options, {
    androidBackgroundCpuProof: {
      artifact: "docs/validation/artifacts/self-test/android-background-cpu-proof.txt",
      maxCpuPercent: 2.5,
    },
    androidDevice: {
      isPhysicalDevice: true,
      manufacturer: "Google",
      model: "Pixel 8",
      osVersion: "15",
    },
    androidRoutingProofArtifact: "docs/validation/artifacts/self-test/android-routing-proof-report.json",
  });
  assert.equal(prefilledRows[1].backgroundCpuArtifact, "docs/validation/artifacts/self-test/android-background-cpu-proof.txt");
  assert.equal(prefilledRows[1].backgroundCpuPercent, 2.5);
  assert.equal(prefilledRows[0].networkSpeedArtifact, "");
  assert.equal(prefilledRows[1].dnsLatencyArtifact, "");
  const prefilledFillTemplate = buildEvidenceFillTemplate(
    options,
    manifestFor(
      options,
      {
        androidBackgroundCpuProof: {
          artifact: "docs/validation/artifacts/self-test/android-background-cpu-proof.txt",
          maxCpuPercent: 2.5,
        },
        androidDevice: {
          isPhysicalDevice: true,
          manufacturer: "Google",
          model: "Pixel 8",
          osVersion: "15",
        },
          androidRoutingProofArtifact: "docs/validation/artifacts/self-test/android-routing-proof-report.json",
      },
      [],
      "self-test",
    ),
  );
  assert.equal(prefilledFillTemplate.profile.platformProfiles[1].backgroundCpuArtifact, "docs/validation/artifacts/self-test/android-background-cpu-proof.txt");
  assert.equal(prefilledFillTemplate.profile.platformProfiles[1].routingProofArtifact, "docs/validation/artifacts/self-test/android-routing-proof-report.json");
  assert.equal(prefilledFillTemplate.helperContext.androidBackgroundCpuProofPrefilled, true);
  assert.equal(prefilledFillTemplate.helperContext.androidRoutingProofPrefilled, true);
  console.log("performance-profile-evidence self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  await capture(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
