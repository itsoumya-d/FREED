#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHost, safeExternalHttpsUrl } = require("./lib/evidence-target-safety");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const {
  DEFAULT_SHORT_FORM_WEB_URL,
  SHORT_FORM_WEB_SURFACES,
  isShortFormWebUrl,
} = require("./lib/short-form-web-contract");

const DEFAULT_APP_GROUP = "group.app.freed.recovery";
const DEFAULT_BUNDLE_ID = "app.freed.recovery";
const DEFAULT_NORMAL_URL = "https://youtube.com/results?search_query=workout";
const DEFAULT_DEVICE_ACTIVITY_NAME = "night-guard";
const DEFAULT_APP_LIMIT_ACTIVITY_NAME = "freed.selectedAppDailyLimit";
const DEFAULT_APP_LIMIT_EVENT_NAME = "freed.selectedAppDailyLimitReached";
const DEFAULT_APP_LIMIT_MINUTES = 30;
const DEFAULT_EARNED_UNLOCK_ACTIVITY_NAME = "freed.earnedUnlockWindow";
const DEFAULT_EARNED_UNLOCK_MINUTES = 15;
const DEFAULT_DEVICE_TOOL_TIMEOUT_MS = 30_000;
const DATA_PROTECTION_ENTITLEMENT = "com.apple.developer.default-data-protection";
const COMPLETE_DATA_PROTECTION_VALUE = "NSFileProtectionComplete";
const IOS_SCREEN_TIME_SHIELD_HOST = "screen-time-shield.freed.local";
const IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE = "ios-safari-short-form";
const SHORT_FORM_WEB_SURFACE_RULES = {
  "youtube-shorts-web": "short-form:youtube-shorts",
  "youtube-shorts-feed-web": "short-form:youtube-shorts",
  "instagram-reels-web": "short-form:instagram-reels",
  "tiktok-for-you-web": "short-form:tiktok-feed",
};
const PERMISSION_WIZARD_FLOW_ORDER =
  "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete";
const EXPECTED_APP_EXTENSIONS = [
  {
    bundleName: "FREEDShieldConfiguration.appex",
    extensionPoint: "com.apple.ManagedSettingsUI.shield-configuration-service",
    requiresFamilyControls: true,
    requiredPrincipalClass: "ShieldConfigurationExtension",
  },
  {
    bundleName: "FREEDShieldAction.appex",
    extensionPoint: "com.apple.ManagedSettings.shield-action-service",
    requiresFamilyControls: true,
    requiredPrincipalClass: "ShieldActionExtension",
  },
  {
    bundleName: "FREEDDeviceActivityMonitor.appex",
    extensionPoint: "com.apple.deviceactivity.monitor-extension",
    requiresFamilyControls: true,
    requiredPrincipalClass: "DeviceActivityMonitorExtension",
  },
  {
    bundleName: "FREEDSafariContentBlocker.appex",
    extensionPoint: "com.apple.Safari.content-blocker",
    requiresFamilyControls: false,
    requiresSafariRuleList: true,
    requiredPrincipalClass: "ContentBlockerRequestHandler",
  },
  {
    bundleName: "FREEDSafariFocusShield.appex",
    extensionPoint: "com.apple.Safari.web-extension",
    requiresFamilyControls: false,
    requiresSafariFocusResources: true,
    requiredPrincipalClass: "FREEDSafariFocusShield.SafariWebExtensionHandler",
  },
];
const SAFARI_RULE_LIST_FILE_NAME = "blockerList.json";
const SAFARI_REQUIRED_RULE_SIGNALS = [
  {
    key: "adult-domain-pornhub",
    pattern: /pornhub\\\.com/i,
  },
  {
    key: "adult-domain-xvideos",
    pattern: /xvideos\\\.com/i,
  },
];
const SAFARI_FOCUS_HOST_PERMISSIONS = [
  "*://youtube.com/*",
  "*://*.youtube.com/*",
  "*://instagram.com/*",
  "*://*.instagram.com/*",
  "*://tiktok.com/*",
  "*://*.tiktok.com/*",
  "https://intervention.freed.app/*",
];

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_IOS_PHYSICAL_OUTPUT);
  const options = {
    adultHost: process.env.FREED_IOS_PHYSICAL_ADULT_HOST || "",
    appLimitActivityName: process.env.FREED_IOS_APP_LIMIT_ACTIVITY_NAME || DEFAULT_APP_LIMIT_ACTIVITY_NAME,
    appLimitEventName: process.env.FREED_IOS_APP_LIMIT_EVENT_NAME || DEFAULT_APP_LIMIT_EVENT_NAME,
    appLimitMinutes: parsePositiveInteger(process.env.FREED_IOS_APP_LIMIT_MINUTES, DEFAULT_APP_LIMIT_MINUTES),
    earnedUnlockActivityName: process.env.FREED_IOS_EARNED_UNLOCK_ACTIVITY_NAME || DEFAULT_EARNED_UNLOCK_ACTIVITY_NAME,
    earnedUnlockMinutes: parsePositiveInteger(process.env.FREED_IOS_EARNED_UNLOCK_MINUTES, DEFAULT_EARNED_UNLOCK_MINUTES),
    appGroupId: process.env.FREED_IOS_APP_GROUP_ID || DEFAULT_APP_GROUP,
    appPath: process.env.FREED_IOS_APP_PATH || "",
    bundleId: process.env.FREED_IOS_BUNDLE_ID || DEFAULT_BUNDLE_ID,
    device: process.env.FREED_IOS_PHYSICAL_DEVICE || "",
    deviceActivityName: process.env.FREED_IOS_DEVICE_ACTIVITY_NAME || DEFAULT_DEVICE_ACTIVITY_NAME,
    launchApp: false,
    listDevicesOnly: false,
    normalUrl: process.env.FREED_IOS_PHYSICAL_NORMAL_URL || DEFAULT_NORMAL_URL,
    outputDir: process.env.FREED_IOS_PHYSICAL_OUTPUT || "",
    planOnly: false,
    runId,
    selfTest: false,
    shortFormUrl: process.env.FREED_IOS_SHORT_FORM_URL || DEFAULT_SHORT_FORM_WEB_URL,
    teamId: process.env.FREED_IOS_FAMILY_CONTROLS_TEAM_ID || "",
    toolTimeoutMs: parsePositiveInteger(process.env.FREED_IOS_PHYSICAL_TOOL_TIMEOUT_MS, DEFAULT_DEVICE_TOOL_TIMEOUT_MS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--adult-host") {
      options.adultHost = next();
    } else if (arg === "--app-limit-activity-name") {
      options.appLimitActivityName = next();
    } else if (arg === "--app-limit-event-name") {
      options.appLimitEventName = next();
    } else if (arg === "--app-limit-minutes") {
      options.appLimitMinutes = parsePositiveInteger(next(), DEFAULT_APP_LIMIT_MINUTES);
    } else if (arg === "--earned-unlock-activity-name") {
      options.earnedUnlockActivityName = next();
    } else if (arg === "--app") {
      options.appPath = next();
    } else if (arg === "--app-group-id") {
      options.appGroupId = next();
    } else if (arg === "--bundle-id") {
      options.bundleId = next();
    } else if (arg === "--device") {
      options.device = next();
    } else if (arg === "--device-activity-name") {
      options.deviceActivityName = next();
    } else if (arg === "--earned-unlock-minutes") {
      options.earnedUnlockMinutes = parsePositiveInteger(next(), DEFAULT_EARNED_UNLOCK_MINUTES);
    } else if (arg === "--launch-app") {
      options.launchApp = true;
    } else if (arg === "--list-devices") {
      options.listDevicesOnly = true;
    } else if (arg === "--normal-url") {
      options.normalUrl = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--short-form-url") {
      options.shortFormUrl = next();
    } else if (arg === "--team-id") {
      options.teamId = next();
    } else if (arg === "--tool-timeout-ms") {
      options.toolTimeoutMs = parsePositiveInteger(next(), DEFAULT_DEVICE_TOOL_TIMEOUT_MS);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "ios-physical-device-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) return options;
  if (options.toolTimeoutMs < 1000 || options.toolTimeoutMs > 300000) {
    throw new Error("--tool-timeout-ms must be between 1000 and 300000.");
  }
  if (options.listDevicesOnly) return options;
  if (!options.bundleId.trim()) throw new Error("--bundle-id must not be empty");
  if (!options.appGroupId.trim()) throw new Error("--app-group-id must not be empty");
  if (!options.appLimitActivityName.trim()) throw new Error("--app-limit-activity-name must not be empty");
  if (!options.appLimitEventName.trim()) throw new Error("--app-limit-event-name must not be empty");
  if (!options.earnedUnlockActivityName.trim()) throw new Error("--earned-unlock-activity-name must not be empty");
  if (options.appLimitMinutes < 5 || options.appLimitMinutes > 240) {
    throw new Error("--app-limit-minutes must be between 5 and 240.");
  }
  if (options.earnedUnlockMinutes < 1 || options.earnedUnlockMinutes > 120) {
    throw new Error("--earned-unlock-minutes must be between 1 and 120.");
  }
  options.normalUrl = safeExternalHttpsUrl(options.normalUrl, "--normal-url");
  options.shortFormUrl = validateShortFormUrl(options.shortFormUrl, "--short-form-url");
  if (!options.adultHost.trim()) {
    throw new Error("--adult-host is required so the manual QA manifest records the real adult-intercept target.");
  }
  options.adultHost = safeExternalHost(options.adultHost, "--adult-host");
  return options;
}

function printHelp() {
  console.log(`Usage: npm run evidence:ios-physical-device -- [options]

Collects physical iPhone metadata and a manual QA manifest for the iOS
physical-device release gate. Family Controls authorization, picker, shield,
Safari Content Blocker reload/adult-block, DeviceActivity, normal-browsing,
adult-intercept proof, and real challenge verification still require human
screen recordings or QA reports and the existing evidence validator. When
--app points to a signed .app or .ipa, the helper also writes a package proof
report for entitlements and embedded Screen Time/Safari extensions.

Options:
  --adult-host <host>             Required real external adult-classified host.
  --app <path>                    Optional built FREED .app or .ipa to install.
                                 Also inspected for entitlements/extensions.
  --app-limit-activity-name <n>   Selected-target limit activity. Default: ${DEFAULT_APP_LIMIT_ACTIVITY_NAME}
  --app-limit-event-name <name>   Selected-target threshold event. Default: ${DEFAULT_APP_LIMIT_EVENT_NAME}
  --app-limit-minutes <minutes>   Configured selected-target daily limit. Default: ${DEFAULT_APP_LIMIT_MINUTES}
  --earned-unlock-activity-name <n>
                                 Earned unlock DeviceActivity window. Default: ${DEFAULT_EARNED_UNLOCK_ACTIVITY_NAME}
  --app-group-id <id>             App group. Default: ${DEFAULT_APP_GROUP}
  --bundle-id <id>                Bundle id. Default: ${DEFAULT_BUNDLE_ID}
  --device <udid|name>            Physical device identifier or exact name.
  --device-activity-name <name>   DeviceActivity schedule name. Default: ${DEFAULT_DEVICE_ACTIVITY_NAME}
  --earned-unlock-minutes <n>     Earned unlock duration. Default: ${DEFAULT_EARNED_UNLOCK_MINUTES}
  --list-devices                  List attached physical iOS devices with a
                                 bounded xctrace call, falling back to
                                 devicectl JSON discovery when xctrace hangs.
                                 Writes a sanitized discovery artifact. Does
                                 not require --adult-host and does not satisfy
                                 evidence.
  --launch-app                    Launch the installed app with devicectl.
  --normal-url <url>              Normal browsing URL. Default: ${DEFAULT_NORMAL_URL}
  --output-dir <path>             Artifact output folder.
  --run-id <id>                   Machine-readable run id.
  --short-form-url <url>          Safari short-form web URL. Default: ${DEFAULT_SHORT_FORM_WEB_URL}
  --team-id <id>                  Apple team ID used for Family Controls signing.
  --tool-timeout-ms <ms>          Timeout for xcrun device commands. Default:
                                 ${DEFAULT_DEVICE_TOOL_TIMEOUT_MS}
  --plan-only                     Print the planned capture without xcrun.
  --self-test                     Run offline parser and safety checks.
`);
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a numeric value, received: ${value}`);
  return parsed;
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function validateShortFormUrl(value, label) {
  const url = safeExternalHttpsUrl(value, label);
  if (!isShortFormWebUrl(url)) {
    throw new Error(`${label} must be a YouTube Shorts, Instagram Reels, or TikTok For You web URL.`);
  }
  return url;
}

function shortFormHandoffRuleForUrl(value) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const surface = SHORT_FORM_WEB_SURFACES.find(
    (entry) =>
      entry.hosts.includes(host) &&
      (entry.exactPaths.includes(pathname) || entry.pathPrefixes.some((prefix) => pathname.startsWith(prefix))),
  );
  return surface ? SHORT_FORM_WEB_SURFACE_RULES[surface.id] : "short-form:youtube-shorts";
}

function shortFormHandoffHostForUrl(value) {
  return new URL(value).hostname.toLowerCase();
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const displayCommand = options.displayCommand || command;
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
        reject(new Error(`${displayCommand} ${args.join(" ")} timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${displayCommand} ${args.join(" ")} failed with ${signal || code}\n${stderr || stdout}`));
    });
  });
}

async function readPlistJson(filePath) {
  const { stdout } = await run("/usr/bin/plutil", ["-convert", "json", "-o", "-", filePath]);
  return JSON.parse(stdout);
}

async function readPlistStringJson(content, outputDir, name) {
  const tempPath = path.join(outputDir, `${name}.plist`);
  writeTextArtifact(tempPath, content);
  return readPlistJson(tempPath);
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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function looksUnavailable(value) {
  return /\b(?:offline|unavailable|disconnected|unpaired|untrusted|not\s+available|not\s+paired|not\s+connected)\b/i.test(
    String(value || ""),
  );
}

function normalizeDevicectlDevice(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const deviceProperties = value.deviceProperties && typeof value.deviceProperties === "object" ? value.deviceProperties : {};
  const hardwareProperties =
    value.hardwareProperties && typeof value.hardwareProperties === "object" ? value.hardwareProperties : {};
  const connectionProperties =
    value.connectionProperties && typeof value.connectionProperties === "object" ? value.connectionProperties : {};
  const identifier = firstString(
    value.identifier,
    value.udid,
    value.deviceIdentifier,
    value.id,
    deviceProperties.identifier,
    deviceProperties.udid,
  );
  const name = firstString(
    value.name,
    value.displayName,
    deviceProperties.name,
    deviceProperties.deviceName,
    hardwareProperties.name,
    hardwareProperties.marketingName,
  );
  if (!identifier || !name) return null;
  const platform = firstString(
    value.platform,
    deviceProperties.platform,
    deviceProperties.osPlatform,
    deviceProperties.platformIdentifier,
    hardwareProperties.platform,
  );
  const osVersion = firstString(
    value.osVersion,
    value.operatingSystemVersion,
    value.version,
    deviceProperties.osVersion,
    deviceProperties.osVersionNumber,
    deviceProperties.systemVersion,
  );
  const statusText = [
    value.state,
    value.status,
    value.availability,
    deviceProperties.state,
    deviceProperties.status,
    connectionProperties.state,
    connectionProperties.status,
    connectionProperties.pairingState,
    connectionProperties.tunnelState,
  ]
    .filter(Boolean)
    .join(" ");
  const simulator =
    value.isSimulator === true ||
    deviceProperties.isSimulator === true ||
    /\bsimulator\b/i.test(`${platform} ${statusText} ${hardwareProperties.deviceType || ""}`);
  return {
    identifier,
    isSimulator: simulator,
    name,
    osVersion,
    source: looksUnavailable(statusText) ? "devicectl devices offline" : "devicectl devices",
  };
}

function collectDeviceLikeRecords(value, records = []) {
  if (!value || typeof value !== "object") return records;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const device = normalizeDevicectlDevice(entry);
      if (device) records.push(device);
      collectDeviceLikeRecords(entry, records);
    }
    return records;
  }
  for (const entry of Object.values(value)) {
    collectDeviceLikeRecords(entry, records);
  }
  return records;
}

function parseDevicectlDevicesJson(content) {
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  const devices = collectDeviceLikeRecords(parsed);
  const seen = new Set();
  return devices.filter((device) => {
    const key = `${device.identifier}:${device.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizedDeviceKind(device) {
  const name = String(device?.name || "");
  if (/\bipad\b/i.test(name)) return "iPad";
  if (/\bipod\b/i.test(name)) return "iPod";
  return "iPhone";
}

function sanitizedDeviceName(device) {
  if (!device) return "";
  if (device.isSimulator) return String(device.name || "iOS Simulator");
  if (!isPhysicalIosDevice(device)) return "Non-iOS Apple device";
  return `Physical ${sanitizedDeviceKind(device)}`;
}

function sanitizedDeviceIdentifier(device, index = 0) {
  const ordinal = index + 1;
  if (device?.isSimulator) return `ios-simulator-${ordinal}`;
  if (isPhysicalIosDevice(device)) return `physical-ios-device-${ordinal}`;
  return `non-ios-apple-device-${ordinal}`;
}

function sanitizeDeviceForArtifact(device, index = 0) {
  return {
    identifier: sanitizedDeviceIdentifier(device, index),
    isPhysicalIosDevice: isPhysicalIosDevice(device),
    isReadyPhysicalIosDevice: isReadyPhysicalIosDevice(device),
    isSimulator: device.isSimulator,
    name: sanitizedDeviceName(device, index),
    deviceNameRedacted: !device.isSimulator,
    osVersion: device.osVersion,
    source: device.source,
  };
}

function sanitizeRequestedDeviceForArtifact(requested, requestedDevice) {
  if (!requested) return null;
  if (requestedDevice) return sanitizedDeviceName(requestedDevice);
  return "<redacted-requested-device>";
}

function sanitizeDeviceListRawForArtifact(raw, devices) {
  let sanitized = String(raw || "");
  const orderedDevices = [...devices].sort((first, second) => String(second.name || "").length - String(first.name || "").length);
  orderedDevices.forEach((device, index) => {
    if (device.identifier) sanitized = sanitized.split(device.identifier).join(sanitizedDeviceIdentifier(device, index));
    if (device.name) sanitized = sanitized.split(device.name).join(sanitizedDeviceName(device, index));
  });
  return sanitized;
}

function buildSanitizedDeviceListText(listed) {
  const lines = [
    "# Sanitized iOS Device List",
    `Source: ${listed.source || "xctrace"}`,
    "Raw output stored: false",
    "Device names redacted: true",
    "",
  ];
  const devices = Array.isArray(listed.devices) ? listed.devices : [];
  if (devices.length === 0) {
    lines.push("- No parsed iOS devices or simulators.");
  } else {
    for (const device of devices.map(sanitizeDeviceForArtifact)) {
      const details = [
        device.name,
        device.osVersion ? `iOS ${device.osVersion}` : "",
        device.identifier,
        device.isSimulator ? "simulator" : device.isPhysicalIosDevice ? "physical" : "non-ios",
        device.source || "",
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`- ${details}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function listDevicesWithDevicectl(toolTimeoutMs) {
  const outputPath = path.join(os.tmpdir(), `freed-devicectl-devices-${Date.now()}.json`);
  const result = await run("xcrun", ["devicectl", "list", "devices", "--json-output", outputPath], {
    timeoutMs: toolTimeoutMs,
  });
  const raw = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : result.stdout;
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch {
    // Best-effort cleanup only; the generated repo artifact below is sanitized.
  }
  return {
    devices: parseDevicectlDevicesJson(raw),
    raw,
    source: "devicectl",
  };
}

function deviceListFailure(xctraceError, devicectlError) {
  const error = new Error(
    [
      `xcrun xctrace list devices failed: ${xctraceError instanceof Error ? xctraceError.message : String(xctraceError)}`,
      `xcrun devicectl list devices failed: ${devicectlError instanceof Error ? devicectlError.message : String(devicectlError)}`,
    ].join("\n"),
  );
  error.xctraceErrorMessage = xctraceError instanceof Error ? xctraceError.message : String(xctraceError);
  error.devicectlErrorMessage = devicectlError instanceof Error ? devicectlError.message : String(devicectlError);
  return error;
}

async function listDevices(toolTimeoutMs, outputDir = "") {
  try {
    const { stdout } = await run("xcrun", ["xctrace", "list", "devices"], { timeoutMs: toolTimeoutMs });
    return { devices: parseXctraceDevices(stdout), raw: stdout, source: "xctrace" };
  } catch (xctraceError) {
    try {
      const listed = await listDevicesWithDevicectl(toolTimeoutMs, outputDir);
      return {
        ...listed,
        xctraceErrorMessage: xctraceError instanceof Error ? xctraceError.message : String(xctraceError),
      };
    } catch (devicectlError) {
      throw deviceListFailure(xctraceError, devicectlError);
    }
  }
}

function writeDeviceListArtifacts(outputDir, listed) {
  const artifacts = {
    deviceListSource: listed.source || "xctrace",
  };
  if (listed.xctraceErrorMessage) {
    const xctraceErrorArtifact = path.join(outputDir, "xctrace-devices-error.txt");
    writeTextArtifact(xctraceErrorArtifact, listed.xctraceErrorMessage);
    artifacts.xctraceErrorArtifact = repoRelative(xctraceErrorArtifact);
  }
  if ((listed.source || "xctrace") === "devicectl") {
    const devicectlArtifact = path.join(outputDir, "devicectl-devices.json");
    writeJsonArtifact(devicectlArtifact, {
      sanitized: true,
      source: "devicectl",
      rawOutputStored: false,
      deviceNamesRedacted: true,
      devices: (listed.devices || []).map(sanitizeDeviceForArtifact),
    });
    artifacts.devicectlDevicesArtifact = repoRelative(devicectlArtifact);
    artifacts.deviceListArtifact = artifacts.devicectlDevicesArtifact;
  } else {
    const xctraceArtifact = path.join(outputDir, "xctrace-devices.txt");
    writeTextArtifact(xctraceArtifact, buildSanitizedDeviceListText(listed));
    artifacts.xctraceDevicesArtifact = repoRelative(xctraceArtifact);
    artifacts.deviceListArtifact = artifacts.xctraceDevicesArtifact;
  }
  return artifacts;
}

function normalizeDeviceListArtifacts(artifactsOrPath) {
  if (typeof artifactsOrPath === "string") {
    return {
      deviceListArtifact: repoRelative(artifactsOrPath),
      deviceListSource: "xctrace",
      xctraceDevicesArtifact: repoRelative(artifactsOrPath),
    };
  }
  return artifactsOrPath && typeof artifactsOrPath === "object" ? artifactsOrPath : {};
}

function buildDeviceDiscoveryManifest(options, listed, artifactsOrPath) {
  const artifacts = normalizeDeviceListArtifacts(artifactsOrPath);
  const physicalDevices = listed.devices.filter(isPhysicalIosDevice);
  const readyPhysicalDevices = physicalDevices.filter(isReadyPhysicalIosDevice);
  const offlinePhysicalDevices = physicalDevices.filter((device) => !isReadyPhysicalIosDevice(device));
  const requestedDevice = options.device
    ? physicalDevices.find((device) => device.identifier === options.device || device.name === options.device) || null
    : null;
  const requestedReadyDevice = requestedDevice && isReadyPhysicalIosDevice(requestedDevice) ? requestedDevice : null;
  const result = options.device
    ? requestedReadyDevice
      ? "requested-physical-device-ready"
      : requestedDevice
        ? "requested-physical-device-not-ready"
        : "requested-physical-device-missing"
    : readyPhysicalDevices.length > 0
      ? "physical-device-ready"
      : physicalDevices.length > 0
        ? "physical-device-offline"
        : "no-physical-device";
  const next =
    readyPhysicalDevices.length > 0
      ? "Use one listed ready physical iPhone name or UDID with npm run evidence:ios-physical-device after the signed entitlement-approved app is ready."
      : physicalDevices.length > 0
        ? "A physical iPhone is listed offline. Unlock it, reconnect if needed, trust this Mac, and rerun npm run evidence:ios-devices."
        : "Connect an entitlement-approved physical iPhone, unlock it, trust this Mac, then rerun npm run evidence:ios-devices.";
  return {
    schema: "freed-ios-device-discovery-v1",
    sanitized: true,
    generatedAt: new Date().toISOString(),
    releaseGate: "ios-physical-device-validation",
    result,
    runId: options.runId,
    outputDir: repoRelative(options.outputDir),
    requestedDevice: sanitizeRequestedDeviceForArtifact(options.device, requestedDevice),
    requestedDeviceFound: options.device ? Boolean(requestedDevice) : null,
    requestedDeviceReady: options.device ? Boolean(requestedReadyDevice) : null,
    physicalDeviceCount: physicalDevices.length,
    readyPhysicalDeviceCount: readyPhysicalDevices.length,
    readyDeviceCount: readyPhysicalDevices.length,
    readyPhysicalCandidateCount: readyPhysicalDevices.length,
    offlinePhysicalDeviceCount: offlinePhysicalDevices.length,
    deviceNamesRedacted: true,
    devices: listed.devices.map(sanitizeDeviceForArtifact),
    next,
    evidenceSatisfied: false,
    evidenceBoundary:
      "Device discovery is a setup handoff only. It does not prove Family Controls authorization, Safari content blocking, DeviceActivity shielding, normal browsing allow, adult intercept, or challenge verification.",
    toolTimeoutMs: options.toolTimeoutMs,
    deviceListArtifact: artifacts.deviceListArtifact || "",
    deviceListSource: artifacts.deviceListSource || listed.source || "xctrace",
    ...(artifacts.xctraceDevicesArtifact ? { xctraceDevicesArtifact: artifacts.xctraceDevicesArtifact } : {}),
    ...(artifacts.xctraceErrorArtifact ? { xctraceErrorArtifact: artifacts.xctraceErrorArtifact } : {}),
    ...(artifacts.devicectlDevicesArtifact ? { devicectlDevicesArtifact: artifacts.devicectlDevicesArtifact } : {}),
  };
}

async function captureDeviceDiscovery(options) {
  fs.mkdirSync(options.outputDir, { recursive: true });
  const discoveryArtifact = path.join(options.outputDir, "ios-device-discovery.json");
  const staleErrorArtifacts = [
    path.join(options.outputDir, "device-discovery-error.txt"),
    path.join(options.outputDir, "xctrace-devices-error.txt"),
    path.join(options.outputDir, "devicectl-devices-error.txt"),
  ];
  try {
    const listed = await listDevices(options.toolTimeoutMs, options.outputDir);
    for (const artifact of staleErrorArtifacts) {
      if (fs.existsSync(artifact)) fs.unlinkSync(artifact);
    }
    const deviceListArtifacts = writeDeviceListArtifacts(options.outputDir, listed);
    const manifest = buildDeviceDiscoveryManifest(options, listed, deviceListArtifacts);
    writeJsonArtifact(discoveryArtifact, manifest);
    console.log(
      JSON.stringify(
        {
          ...manifest,
          discoveryArtifact: repoRelative(discoveryArtifact),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const errorArtifact = path.join(options.outputDir, "device-discovery-error.txt");
    const xctraceErrorArtifact = path.join(options.outputDir, "xctrace-devices-error.txt");
    const devicectlErrorArtifact = path.join(options.outputDir, "devicectl-devices-error.txt");
    const message = error instanceof Error ? error.message : String(error);
    writeTextArtifact(errorArtifact, message);
    if (error?.xctraceErrorMessage) writeTextArtifact(xctraceErrorArtifact, error.xctraceErrorMessage);
    if (error?.devicectlErrorMessage) writeTextArtifact(devicectlErrorArtifact, error.devicectlErrorMessage);
    const manifest = {
      schema: "freed-ios-device-discovery-v1",
      sanitized: true,
      generatedAt: new Date().toISOString(),
      releaseGate: "ios-physical-device-validation",
      result: "device-discovery-failed",
      runId: options.runId,
      outputDir: repoRelative(options.outputDir),
      requestedDevice: options.device || null,
      requestedDeviceFound: null,
      requestedDeviceReady: null,
      physicalDeviceCount: 0,
      readyPhysicalDeviceCount: 0,
      readyDeviceCount: 0,
      readyPhysicalCandidateCount: 0,
      offlinePhysicalDeviceCount: 0,
      evidenceSatisfied: false,
      evidenceBoundary:
        "Device discovery is a setup handoff only. It does not prove Family Controls authorization, Safari content blocking, DeviceActivity shielding, normal browsing allow, adult intercept, or challenge verification.",
      toolTimeoutMs: options.toolTimeoutMs,
      errorArtifact: repoRelative(errorArtifact),
      ...(error?.xctraceErrorMessage ? { xctraceErrorArtifact: repoRelative(xctraceErrorArtifact) } : {}),
      ...(error?.devicectlErrorMessage ? { devicectlErrorArtifact: repoRelative(devicectlErrorArtifact) } : {}),
      next: "Fix Xcode device tooling, connect and trust a physical iPhone, then rerun npm run evidence:ios-devices. The helper now tries xctrace first and devicectl JSON discovery second.",
    };
    writeJsonArtifact(discoveryArtifact, manifest);
    console.log(
      JSON.stringify(
        {
          ...manifest,
          discoveryArtifact: repoRelative(discoveryArtifact),
        },
        null,
        2,
      ),
    );
    throw error;
  }
}

function resolveDevice(devices, requested) {
  const physicalDevices = devices.filter(isPhysicalIosDevice);
  const readyPhysicalDevices = physicalDevices.filter(isReadyPhysicalIosDevice);
  if (requested) {
    const physicalMatch = physicalDevices.find((device) => device.identifier === requested || device.name === requested);
    if (physicalMatch && !isReadyPhysicalIosDevice(physicalMatch)) {
      throw new Error(`Requested physical iOS device is listed but not ready: ${requested}. Unlock it, reconnect if needed, and trust this Mac.`);
    }
    const match = readyPhysicalDevices.find((device) => device.identifier === requested || device.name === requested);
    if (!match) throw new Error(`Requested physical iOS device is not attached or ready: ${requested}`);
    return match;
  }
  if (readyPhysicalDevices.length === 0) {
    if (physicalDevices.length > 0) {
      throw new Error("A physical iOS device is listed but not ready. Unlock it, reconnect if needed, and trust this Mac.");
    }
    throw new Error("No physical iOS device found. Connect an entitlement-approved iPhone.");
  }
  if (readyPhysicalDevices.length > 1) {
    throw new Error(
      `Multiple ready physical iOS devices found (${readyPhysicalDevices.map((device) => `${device.name}:${device.identifier}`).join(", ")}). Pass --device.`,
    );
  }
  return readyPhysicalDevices[0];
}

function isPhysicalIosDevice(device) {
  return !device.isSimulator && /\b(?:iphone|ipad|ipod)\b/i.test(device.name);
}

function isReadyPhysicalIosDevice(device) {
  return isPhysicalIosDevice(device) && !String(device.source || "").toLowerCase().includes("offline");
}

async function maybeDeviceDetails(device, outputDir, toolTimeoutMs) {
  const output = path.join(outputDir, "devicectl-details.json");
  try {
    await run("xcrun", ["devicectl", "device", "info", "details", "--device", device.identifier, "--json-output", output], {
      timeoutMs: toolTimeoutMs,
    });
    return { artifact: repoRelative(output), available: true };
  } catch (error) {
    const fallback = path.join(outputDir, "devicectl-details-error.txt");
    writeTextArtifact(fallback, error instanceof Error ? error.message : String(error));
    return { artifact: repoRelative(fallback), available: false };
  }
}

async function maybeInstallApp(device, appPath, outputDir, toolTimeoutMs) {
  if (!appPath) return null;
  const output = path.join(outputDir, "install-app.log");
  if (!fs.existsSync(appPath)) throw new Error(`App path does not exist: ${appPath}`);
  try {
    const result = await run("xcrun", ["devicectl", "device", "install", "app", "--device", device.identifier, appPath], {
      timeoutMs: toolTimeoutMs,
    });
    writeTextArtifact(output, `${result.stdout}${result.stderr}`);
    return { artifact: repoRelative(output), installed: true };
  } catch (error) {
    writeTextArtifact(output, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function maybeLaunchApp(device, bundleId, outputDir, toolTimeoutMs) {
  const output = path.join(outputDir, "launch-app.log");
  try {
    const result = await run("xcrun", ["devicectl", "device", "process", "launch", "--device", device.identifier, bundleId], {
      timeoutMs: toolTimeoutMs,
    });
    writeTextArtifact(output, `${result.stdout}${result.stderr}`);
    return { artifact: repoRelative(output), launched: true };
  } catch (error) {
    writeTextArtifact(output, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function resolveInspectableAppBundle(appPath, outputDir) {
  if (!appPath) return null;
  const resolved = path.resolve(appPath);
  if (!fs.existsSync(resolved)) throw new Error(`App path does not exist: ${appPath}`);
  if (resolved.endsWith(".app")) return resolved;
  if (!resolved.endsWith(".ipa")) return null;

  const unzipDir = path.join(outputDir, "ipa-unpacked");
  fs.rmSync(unzipDir, { force: true, recursive: true });
  fs.mkdirSync(unzipDir, { recursive: true });
  await run("/usr/bin/unzip", ["-q", resolved, "-d", unzipDir]);
  const payloadDir = path.join(unzipDir, "Payload");
  const appName = fs
    .readdirSync(payloadDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.endsWith(".app"))?.name;
  if (!appName) throw new Error(`Unable to locate Payload/*.app inside ${appPath}`);
  return path.join(payloadDir, appName);
}

async function readCodesignEntitlements(bundlePath, outputDir, artifactName) {
  const artifactPath = path.join(outputDir, artifactName);
  try {
    const result = await run("/usr/bin/codesign", ["-d", "--entitlements", ":-", bundlePath]);
    const content = result.stdout.trim();
    if (!content || !content.includes("<plist")) {
      writeTextArtifact(artifactPath, `${result.stdout}${result.stderr}` || "codesign returned no entitlements plist");
      return { artifact: repoRelative(artifactPath), available: false, entitlements: {}, error: "codesign returned no entitlements plist" };
    }
    writeTextArtifact(artifactPath, content);
    return {
      artifact: repoRelative(artifactPath),
      available: true,
      entitlements: await readPlistStringJson(content, outputDir, `${path.basename(artifactName, ".plist")}.json-source`),
    };
  } catch (error) {
    writeTextArtifact(artifactPath, error instanceof Error ? error.message : String(error));
    return { artifact: repoRelative(artifactPath), available: false, entitlements: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

function entitlementsIncludeAppGroup(entitlements, appGroupId) {
  const groups = entitlements["com.apple.security.application-groups"];
  return Array.isArray(groups) && groups.includes(appGroupId);
}

function entitlementBoolean(entitlements, key) {
  return entitlements[key] === true || entitlements[key] === "true";
}

function hasCompleteDataProtectionEntitlement(entitlements) {
  return entitlements[DATA_PROTECTION_ENTITLEMENT] === COMPLETE_DATA_PROTECTION_VALUE;
}

function entitlementIncludesNetworkExtensionKind(entitlements, patterns) {
  const values = entitlements["com.apple.developer.networking.networkextension"];
  if (!Array.isArray(values)) return false;
  return values.some((value) => {
    const normalized = String(value).toLowerCase();
    return patterns.some((pattern) => normalized.includes(pattern));
  });
}

function buildAppPackageProofChecks(app, extensions) {
  const extensionByName = new Map(extensions.map((entry) => [entry.bundleName, entry]));
  const expectedExtensions = EXPECTED_APP_EXTENSIONS.map((expected) => extensionByName.get(expected.bundleName));
  const screenTimeExtensions = EXPECTED_APP_EXTENSIONS
    .filter((expected) => expected.requiresFamilyControls)
    .map((expected) => extensionByName.get(expected.bundleName));
  const safariExtension = extensionByName.get("FREEDSafariContentBlocker.appex");
  const safariFocusShieldExtension = extensionByName.get("FREEDSafariFocusShield.appex");
  const safariRuleSignals = safariExtension?.safariRuleList?.ruleSignals || {};

  return {
    codesignEntitlementsAvailable:
      app.codesignEntitlementsAvailable === true &&
      expectedExtensions.every((entry) => entry?.codesignEntitlementsAvailable === true),
    familyControlsEntitlementPresent:
      app.familyControlsEntitled === true &&
      screenTimeExtensions.every((entry) => entry?.familyControlsEntitled === true),
    appGroupEntitlementPresent:
      app.appGroupPresent === true &&
      expectedExtensions.every((entry) => entry?.appGroupPresent === true),
    completeDataProtectionOnApp: app.completeDataProtectionEntitled === true,
    completeDataProtectionOnEmbeddedExtensions:
      expectedExtensions.length === EXPECTED_APP_EXTENSIONS.length &&
      expectedExtensions.every((entry) => entry?.completeDataProtectionEntitled === true),
    screenTimeExtensionsEmbedded:
      screenTimeExtensions.length === EXPECTED_APP_EXTENSIONS.filter((entry) => entry.requiresFamilyControls).length &&
      screenTimeExtensions.every(
        (entry) => entry?.embedded === true && entry.extensionPointMatches === true && entry.principalClassMatches === true,
      ),
    safariContentBlockerEmbedded:
      safariExtension?.embedded === true &&
      safariExtension.extensionPointMatches === true &&
      safariExtension.principalClassMatches === true,
    safariFocusShieldEmbedded:
      safariFocusShieldExtension?.embedded === true &&
      safariFocusShieldExtension.extensionPointMatches === true &&
      safariFocusShieldExtension.principalClassMatches === true,
    safariFocusShieldResourcesValid:
      safariFocusShieldExtension?.safariFocusShield?.usableForManualEvidence === true,
    adultDomainRulesPresent:
      safariRuleSignals["adult-domain-pornhub"] === true && safariRuleSignals["adult-domain-xvideos"] === true,
    safariRulesAllBlock: safariExtension?.safariRuleList?.allRulesBlock === true,
    noPacketTunnelEntitlement:
      app.packetTunnelProviderEntitled !== true &&
      expectedExtensions.every((entry) => entry?.packetTunnelProviderEntitled !== true),
    noPacketInspectionEntitlement:
      app.packetInspectionEntitled !== true &&
      expectedExtensions.every((entry) => entry?.packetInspectionEntitled !== true),
  };
}

function inspectSafariContentBlockerRules(bundlePath) {
  const ruleListPath = path.join(bundlePath, SAFARI_RULE_LIST_FILE_NAME);
  if (!fs.existsSync(ruleListPath)) {
    return {
      allRulesBlock: false,
      available: false,
      missingSignals: SAFARI_REQUIRED_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      ruleListPath: repoRelative(ruleListPath),
      ruleSignals: {},
      usableForManualEvidence: false,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(ruleListPath, "utf8"));
  } catch (error) {
    return {
      allRulesBlock: false,
      available: false,
      error: error instanceof Error ? error.message : String(error),
      missingSignals: SAFARI_REQUIRED_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      ruleListPath: repoRelative(ruleListPath),
      ruleSignals: {},
      usableForManualEvidence: false,
    };
  }

  const rules = Array.isArray(parsed) ? parsed : [];
  const filters = rules
    .map((rule) => rule?.trigger?.["url-filter"])
    .filter((filter) => typeof filter === "string");
  const filtersText = filters.join("\n");
  const ruleSignals = Object.fromEntries(
    SAFARI_REQUIRED_RULE_SIGNALS.map((signal) => [signal.key, signal.pattern.test(filtersText)]),
  );
  const missingSignals = Object.entries(ruleSignals)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const allRulesBlock = rules.length > 0 && rules.every((rule) => rule?.action?.type === "block");

  return {
    allRulesBlock,
    available: true,
    missingSignals,
    ruleCount: rules.length,
    ruleListPath: repoRelative(ruleListPath),
    ruleSignals,
    usableForManualEvidence: rules.length > 0 && filters.length === rules.length && allRulesBlock && missingSignals.length === 0,
  };
}

function inspectSafariFocusShieldResources(bundlePath) {
  const manifestPath = path.join(bundlePath, "manifest.json");
  const backgroundPath = path.join(bundlePath, "background.js");
  const contentPath = path.join(bundlePath, "content.js");
  let manifest = {};
  let manifestAvailable = false;
  let manifestError = "";
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifestAvailable = true;
  } catch (error) {
    manifestError = error instanceof Error ? error.message : String(error);
  }
  const background = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath, "utf8") : "";
  const content = fs.existsSync(contentPath) ? fs.readFileSync(contentPath, "utf8") : "";
  const hostPermissions = Array.isArray(manifest.host_permissions) ? [...manifest.host_permissions].sort() : [];
  const expectedHostPermissions = [...SAFARI_FOCUS_HOST_PERMISSIONS].sort();
  const hostPermissionsScoped = JSON.stringify(hostPermissions) === JSON.stringify(expectedHostPermissions);
  const manifestVersion3 = manifest.manifest_version === 3;
  const minimumSafariVersion = manifest.browser_specific_settings?.safari?.strict_min_version || "";
  const serviceWorker = manifest.background?.service_worker || "";
  const nativeMessagingPermission = Array.isArray(manifest.permissions) && manifest.permissions.includes("nativeMessaging");
  const backgroundOwnsNativeMessaging =
    background.includes("runtime.onMessage.addListener") && background.includes("sendNativeMessage");
  const contentUsesRuntimeMessaging = content.includes("runtime?.sendMessage") && !content.includes("sendNativeMessage");
  return {
    backgroundAvailable: Boolean(background),
    backgroundOwnsNativeMessaging,
    contentAvailable: Boolean(content),
    contentUsesRuntimeMessaging,
    hostPermissions,
    hostPermissionsScoped,
    manifestAvailable,
    manifestError,
    manifestVersion3,
    minimumSafariVersion,
    nativeMessagingPermission,
    serviceWorker,
    usableForManualEvidence:
      manifestAvailable &&
      manifestVersion3 &&
      minimumSafariVersion === "15.4" &&
      serviceWorker === "background.js" &&
      nativeMessagingPermission &&
      hostPermissionsScoped &&
      backgroundOwnsNativeMessaging &&
      contentUsesRuntimeMessaging,
  };
}

async function inspectBundle(bundlePath, outputDir, appGroupId) {
  const infoPath = path.join(bundlePath, "Info.plist");
  const info = fs.existsSync(infoPath) ? await readPlistJson(infoPath) : {};
  const entitlements = await readCodesignEntitlements(bundlePath, outputDir, `${path.basename(bundlePath)}-codesign-entitlements.plist`);
  const extension = info.NSExtension && typeof info.NSExtension === "object" ? info.NSExtension : {};
  return {
    appGroupPresent: entitlementsIncludeAppGroup(entitlements.entitlements, appGroupId),
    bundleIdentifier: info.CFBundleIdentifier || "",
    bundleName: path.basename(bundlePath),
    codesignEntitlementsArtifact: entitlements.artifact,
    codesignEntitlementsAvailable: entitlements.available,
    completeDataProtectionEntitled: hasCompleteDataProtectionEntitlement(entitlements.entitlements),
    executable: info.CFBundleExecutable || "",
    extensionPoint: extension.NSExtensionPointIdentifier || "",
    familyControlsEntitled: entitlementBoolean(entitlements.entitlements, "com.apple.developer.family-controls"),
    infoPlistPath: repoRelative(infoPath),
    packetInspectionEntitled: entitlementIncludesNetworkExtensionKind(entitlements.entitlements, [
      "app-proxy-provider",
      "content-filter-provider",
      "packet-tunnel-provider",
    ]),
    packetTunnelProviderEntitled: entitlementIncludesNetworkExtensionKind(entitlements.entitlements, [
      "packet-tunnel-provider",
    ]),
    principalClass: extension.NSExtensionPrincipalClass || "",
  };
}

async function inspectAppPackage(appPath, outputDir, appGroupId) {
  const bundlePath = await resolveInspectableAppBundle(appPath, outputDir);
  if (!bundlePath) return null;
  const app = await inspectBundle(bundlePath, outputDir, appGroupId);
  const pluginsDir = path.join(bundlePath, "PlugIns");
  const extensions = [];
  for (const expected of EXPECTED_APP_EXTENSIONS) {
    const extensionPath = path.join(pluginsDir, expected.bundleName);
    if (fs.existsSync(extensionPath)) {
      const inspected = await inspectBundle(extensionPath, outputDir, appGroupId);
      extensions.push({
        ...inspected,
        embedded: true,
        expectedExtensionPoint: expected.extensionPoint,
        expectedPrincipalClass: expected.requiredPrincipalClass,
        extensionPointMatches: inspected.extensionPoint === expected.extensionPoint,
        principalClassMatches: inspected.principalClass === expected.requiredPrincipalClass,
        requiresFamilyControls: expected.requiresFamilyControls,
        requiresSafariRuleList: Boolean(expected.requiresSafariRuleList),
        requiresSafariFocusResources: Boolean(expected.requiresSafariFocusResources),
        ...(expected.requiresSafariRuleList ? { safariRuleList: inspectSafariContentBlockerRules(extensionPath) } : {}),
        ...(expected.requiresSafariFocusResources
          ? { safariFocusShield: inspectSafariFocusShieldResources(extensionPath) }
          : {}),
      });
    } else {
      extensions.push({
        appGroupPresent: false,
        bundleName: expected.bundleName,
        codesignEntitlementsAvailable: false,
        completeDataProtectionEntitled: false,
        embedded: false,
        expectedExtensionPoint: expected.extensionPoint,
        expectedPrincipalClass: expected.requiredPrincipalClass,
        extensionPoint: "",
        extensionPointMatches: false,
        familyControlsEntitled: false,
        packetInspectionEntitled: false,
        packetTunnelProviderEntitled: false,
        principalClass: "",
        principalClassMatches: false,
        requiresFamilyControls: expected.requiresFamilyControls,
        requiresSafariRuleList: Boolean(expected.requiresSafariRuleList),
        requiresSafariFocusResources: Boolean(expected.requiresSafariFocusResources),
        ...(expected.requiresSafariRuleList
          ? {
              safariRuleList: {
                allRulesBlock: false,
                available: false,
                missingSignals: SAFARI_REQUIRED_RULE_SIGNALS.map((signal) => signal.key),
                ruleCount: 0,
                ruleListPath: "",
                ruleSignals: {},
                usableForManualEvidence: false,
              },
            }
          : {}),
        ...(expected.requiresSafariFocusResources
          ? {
              safariFocusShield: {
                backgroundAvailable: false,
                backgroundOwnsNativeMessaging: false,
                contentAvailable: false,
                contentUsesRuntimeMessaging: false,
                hostPermissions: [],
                hostPermissionsScoped: false,
                manifestAvailable: false,
                manifestVersion3: false,
                minimumSafariVersion: "",
                nativeMessagingPermission: false,
                serviceWorker: "",
                usableForManualEvidence: false,
              },
            }
          : {}),
      });
    }
  }
  const missingExtensions = extensions.filter((entry) => entry.embedded === false || !entry.extensionPointMatches || !entry.principalClassMatches);
  const safariRuleFailures = extensions.flatMap((entry) => {
    if (!entry.requiresSafariRuleList) return [];
    if (entry.safariRuleList?.usableForManualEvidence) return [];
    const missingSignals = entry.safariRuleList?.missingSignals || [];
    const detail = missingSignals.length > 0 ? ` missing ${missingSignals.join(", ")}` : "";
    return [`${entry.bundleName} ${SAFARI_RULE_LIST_FILE_NAME}${detail}`];
  });
  const safariFocusShieldFailures = extensions.flatMap((entry) => {
    if (!entry.requiresSafariFocusResources) return [];
    return entry.safariFocusShield?.usableForManualEvidence ? [] : [`${entry.bundleName} MV3 resources`];
  });
  const entitlementFailures = [
    ...(app.appGroupPresent ? [] : ["app app-group entitlement"]),
    ...(app.familyControlsEntitled ? [] : ["app Family Controls entitlement"]),
    ...(app.completeDataProtectionEntitled ? [] : ["app Complete Data Protection entitlement"]),
    ...extensions.flatMap((entry) => {
      const failures = [];
      if (!entry.appGroupPresent) failures.push(`${entry.bundleName} app-group entitlement`);
      if (entry.requiresFamilyControls && !entry.familyControlsEntitled) failures.push(`${entry.bundleName} Family Controls entitlement`);
      if (!entry.completeDataProtectionEntitled) failures.push(`${entry.bundleName} Complete Data Protection entitlement`);
      return failures;
    }),
  ];
  const checks = buildAppPackageProofChecks(app, extensions);
  const report = {
    schemaVersion: "freed-ios-app-package-proof-v1",
    sanitized: true,
    platform: "ios",
    app,
    appGroupId,
    bundlePath: repoRelative(bundlePath),
    checks,
    entitlementFailures,
    extensions,
    missingOrMismatchedExtensions: missingExtensions.map((entry) => entry.bundleName),
    safariRuleFailures,
    safariFocusShieldFailures,
    packageProofUsableForManualEvidence:
      missingExtensions.length === 0 &&
      entitlementFailures.length === 0 &&
      safariRuleFailures.length === 0 &&
      safariFocusShieldFailures.length === 0,
  };
  const reportPath = path.join(outputDir, "ios-app-package-proof.json");
  writeJsonArtifact(reportPath, report);
  return { ...report, artifact: repoRelative(reportPath) };
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
  fs.writeFileSync(filePath, sanitizeLocalHomePaths(content || "\n"));
}

function requiredManualFlows(options) {
  return [
    {
      artifactField: "ios.familyControlsEntitlementArtifact",
      check: "familyControlsEntitlement",
      releaseFields: [
        "ios.familyControlsEntitlementTeamId",
        "ios.familyControlsStatus=approved",
        "ios.familyControlsEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-family-controls-entitlement`,
      summary: "Attach the helper-generated signed-app package proof showing the production team has Family Controls entitlement on the app and Screen Time extensions.",
    },
    {
      artifactField: "ios.appGroupProvisioningArtifact",
      check: "appGroupProvisioning",
      releaseFields: [
        "ios.appGroupProvisioningProfileId",
        "ios.appGroupProvisioningArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-app-group-provisioning`,
      summary: `Attach the helper-generated signed-app package proof showing the app and every extension share ${options.appGroupId}.`,
    },
    {
      artifactField: "ios.completeDataProtectionEntitlementArtifact",
      check: "completeDataProtectionEntitlement",
      releaseFields: [
        `ios.completeDataProtectionEntitlement=${COMPLETE_DATA_PROTECTION_VALUE}`,
        "ios.completeDataProtectionEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-complete-data-protection-entitlement`,
      summary:
        "Attach signed-app package proof showing the app and every embedded extension default local files to Complete Data Protection.",
    },
    {
      artifactField: "ios.permissionWizardArtifact",
      check: "permissionSetupWizard",
      releaseFields: [
        "ios.permissionWizardRunId",
        "ios.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true",
        `ios.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}`,
        "ios.permissionExplanationShown=true",
        "ios.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy",
        "ios.permissionWizardTestProtectionPassed=true",
      ],
      runId: `${options.runId}-permission-wizard`,
      summary:
        "Record the full release setup wizard: recovery goals, app selection, paywall, protection explanation, guided Screen Time/Safari setup, Test Protection, and Activation Complete.",
    },
    {
      artifactField: "ios.familyControlsAuthorizationArtifact",
      check: "familyControlsAuthorization",
      releaseFields: [
        "ios.familyControlsStatus=approved",
      ],
      runId: `${options.runId}-family-controls-authorization`,
      summary: "Record Family Controls authorization returning approved status.",
    },
    {
      artifactField: "ios.familyActivityPickerArtifact",
      check: "familyActivityPicker",
      releaseFields: [
        "ios.familyActivityPickerAppLimitScheduledImmediately=true",
        `ios.familyActivityPickerAppLimitActivityName=${options.appLimitActivityName}`,
        `ios.familyActivityPickerAppLimitEventName=${options.appLimitEventName}`,
      ],
      runId: `${options.runId}-family-activity-picker`,
      summary:
        "Record FamilyActivityPicker selecting at least one app, category, or web-domain token, then immediately capture FREED status showing the selected-target daily-limit monitor is scheduled.",
    },
    {
      artifactField: "ios.selectedShieldTokensArtifact",
      check: "selectedShieldTokens",
      releaseFields: [
        "ios.selectedApplicationTokenCount",
        "ios.selectedCategoryTokenCount",
        "ios.selectedWebDomainTokenCount",
        "ios.selectedTokenCounts>0",
      ],
      runId: `${options.runId}-selected-shield-tokens`,
      summary: "Capture selected application/category/web-domain token counts.",
    },
    {
      artifactField: "ios.selectedAppDailyLimitArtifact",
      check: "selectedAppDailyLimitThreshold",
      releaseFields: [
        "ios.appLimitScheduled=true",
        `ios.selectedAppDailyLimitMinutes=${options.appLimitMinutes}`,
        `ios.selectedAppDailyLimitActivityName=${options.appLimitActivityName}`,
        `ios.selectedAppDailyLimitEventName=${options.appLimitEventName}`,
        "ios.selectedAppDailyLimitReachedToday=true",
        "ios.selectedAppDailyLimitReachedDate yyyy-MM-dd",
        "ios.selectedAppDailyLimitArtifact local freed-ios-screen-time-app-limit-report-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-selected-app-daily-limit`,
      summary: `Record '${options.appLimitActivityName}' firing '${options.appLimitEventName}' after ${options.appLimitMinutes} minutes and shielding the selected Screen Time target, backed by a sanitized freed-ios-screen-time-app-limit-report-v1 JSON artifact.`,
    },
    {
      artifactField: "ios.managedSettingsFilterArtifact",
      check: "managedSettingsAdultFilter",
      releaseFields: [
        `ios.normalBrowsingAllowedUrl=${options.normalUrl}`,
      ],
      runId: `${options.runId}-managed-settings-filter`,
      summary: `Prove ManagedSettings adult filter leaves normal browsing allowed for ${options.normalUrl}.`,
    },
    {
      artifactField: "ios.safariContentBlockerBuildArtifact",
      check: "safariContentBlockerReloaded",
      releaseFields: [
        "ios.safariContentBlockerEmbedded=true",
        "ios.safariContentBlockerIdentifier=app.freed.recovery.safari-content-blocker",
        "ios.safariContentBlockerBuildArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-safari-content-blocker-build`,
      summary: "Capture a signed physical-device build report showing the FREEDSafariContentBlocker extension is embedded.",
    },
    {
      artifactField: "ios.safariContentBlockerReloadArtifact",
      check: "safariContentBlockerReloaded",
      releaseFields: [
        "ios.safariContentBlockerVersion",
        "ios.safariContentBlockerChecksum=fnv1a32:<8-hex>",
        "ios.safariContentBlockerRuleCount",
        "ios.safariContentBlockerEnabled=true",
        "ios.safariContentBlockerReloadArtifact local freed-ios-safari-content-blocker-report-v1 JSON",
      ],
      runId: `${options.runId}-safari-content-blocker-reload`,
      summary:
        "Record Safari Content Blocker reload with the synced adult-domain feed version, checksum, rule count, and Safari enabled state visible in FREED status; promote a local freed-ios-safari-content-blocker-report-v1 JSON report.",
    },
    {
      artifactField: "ios.safariContentBlockerAdultBlockArtifact",
      check: "safariContentBlockerAdultBlock",
      releaseFields: [
        "ios.safariContentBlockerAdultBlockArtifact local freed-ios-safari-content-blocker-report-v1 JSON",
      ],
      runId: `${options.runId}-safari-content-blocker-adult-block`,
      summary: `Prove Safari blocks an adult attempt for ${options.adultHost} through the content-blocker layer; promote a local freed-ios-safari-content-blocker-report-v1 JSON report with no packet-inspection or app-screen-inspection checks.`,
    },
    {
      artifactField: "ios.safariFocusShieldShortFormBlockArtifact",
      check: "safariFocusShieldShortFormBlock",
      releaseFields: [
        "ios.safariFocusShieldEmbedded=true",
        "ios.safariFocusShieldIdentifier=app.freed.recovery.safari-focus-shield",
        `ios.safariFocusShieldShortFormUrl=${options.shortFormUrl}`,
        "ios.safariFocusShieldShortFormBlockArtifact local freed-ios-safari-focus-shield-report-v1 JSON",
      ],
      runId: `${options.runId}-safari-focus-shield-short-form-block`,
      summary: `Prove Safari Focus Shield pauses ${options.shortFormUrl} through its MV3 content-script/background-worker path; promote a local freed-ios-safari-focus-shield-report-v1 JSON report with no raw path or app-screen-inspection checks.`,
    },
    {
      artifactField: "ios.safariShortFormChallengeHandoffArtifact",
      check: "safariShortFormChallengeHandoff",
      releaseFields: [
        "ios.safariShortFormChallengeHandoffRunId",
        "ios.safariShortFormChallengeHandoffArtifact",
        `ios.safariShortFormChallengeHandoffSource=${IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE}`,
        `ios.safariShortFormChallengeHandoffMatchedRule=${shortFormHandoffRuleForUrl(options.shortFormUrl)}`,
        `ios.safariShortFormChallengeHandoffHost=${shortFormHandoffHostForUrl(options.shortFormUrl)}`,
        "ios.safariShortFormChallengeHandoffRawPathStored=false",
        "ios.safariShortFormChallengeHandoffNativeUnlockActive=false",
        "ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive=true",
        "ios.safariShortFormChallengeHandoffAdultFilterStillActive=true",
      ],
      runId: `${options.runId}-safari-short-form-challenge-handoff`,
      summary:
        "Open FREED from the approved Safari web short-form challenge handoff and prove the app stores only the platform host, shows a browser challenge window, does not pause selected Screen Time shields, and leaves adult web filtering active.",
    },
    {
      artifactField: "ios.earnedUnlockAppAllowArtifact",
      check: "earnedUnlockAllowsSelectedApps",
      releaseFields: [
        "ios.earnedUnlockDurationMinutes",
        `ios.earnedUnlockActivityName=${options.earnedUnlockActivityName}`,
        "ios.earnedUnlockSelectedTokenCount=ios.selectedTokenCounts",
        "ios.earnedUnlockAdultFilterStillActive=true",
        `ios.earnedUnlockSourceHost=${IOS_SCREEN_TIME_SHIELD_HOST}`,
        "ios.earnedUnlockAppAllowArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-earned-unlock-app-allow`,
      summary: `Record selected app shields pausing during a ${options.earnedUnlockMinutes}-minute earned unlock that starts from the iOS Screen Time shield handoff (${IOS_SCREEN_TIME_SHIELD_HOST}), with the selected token count unchanged, adult web filtering still active, DeviceActivity monitor '${options.earnedUnlockActivityName}' scheduled for relock, and a sanitized freed-ios-earned-unlock-report-v1 JSON artifact.`,
    },
    {
      artifactField: "ios.earnedUnlockRejectedSourceArtifact",
      check: "earnedUnlockRejectsNonScreenTimeSource",
      releaseFields: [
        "ios.earnedUnlockRejectedSourceRunId",
        "ios.earnedUnlockRejectedSourceArtifact",
        `ios.earnedUnlockRejectedSourceHost=${options.adultHost}`,
        "ios.earnedUnlockRejectedSelectedShieldsStayedActive=true",
        "ios.earnedUnlockRejectedAdultFilterStillActive=true",
        "ios.earnedUnlockRejectedSourceArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true",
      ],
      runId: `${options.runId}-earned-unlock-rejected-source`,
      summary: `Attempt an earned unlock from the blocked browser/adult source ${options.adultHost}; prove this non-Screen-Time source does not pause selected app shields, leaves adult web filtering active, and writes a sanitized freed-ios-earned-unlock-report-v1 JSON artifact.`,
    },
    {
      artifactField: "ios.earnedUnlockRelockArtifact",
      check: "earnedUnlockAutoRelock",
      releaseFields: [
        "ios.earnedUnlockRelockRunId",
        "ios.earnedUnlockRelockArtifact",
        "ios.earnedUnlockRelockArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true",
        "same selected Screen Time target shielded again after expiry",
      ],
      runId: `${options.runId}-earned-unlock-relock`,
      summary: "Record FREED automatically reapplying selected app shields after the earned unlock expires, backed by a sanitized freed-ios-earned-unlock-report-v1 JSON artifact.",
    },
    {
      artifactField: "ios.challengePhotoArtifact",
      check: "challengePhotoVerifiedOnDevice",
      releaseFields: [
        "ios.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true",
        "ios.challengePhotoClassifier=Vision",
        "ios.challengePhotoMatchedLabel",
        "ios.challengePhotoConfidence>=0.45",
        "ios.challengePhotoFreshCameraOnly=true",
        "ios.challengePhotoNoBase64OrExif=true",
        "ios.challengePhotoTemporaryFileDeleted=true",
        "ios.challengePhotoArtifact checks onDeviceClassifier/onDemandOnly/rawPhotoNotPersisted/noContinuousImageClassification=true",
      ],
      runId: `${options.runId}-challenge-photo-verification`,
      summary: "Record a fresh-camera photo challenge completing only after on-device, on-demand Vision classification, with no base64/EXIF payload retained, no raw photo persisted, no continuous image classification, and the temporary captured file deleted after classification.",
    },
    {
      artifactField: "ios.challengeMotionArtifact",
      check: "challengeMotionVerified",
      releaseFields: [
        "ios.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true",
        "ios.challengeMotionRunId",
        "ios.challengeMotionSamples>=6",
        "ios.challengeMotionArtifact checks onDeviceSensorSamples/onDemandOnly/timerOnlyBypassRejected=true",
      ],
      runId: `${options.runId}-challenge-motion-verification`,
      summary: "Record a motion challenge completing from a local on-device, on-demand CoreMotion report with enough live samples and a rejected timer-only bypass.",
    },
    {
      artifactField: "ios.challengeStepsArtifact",
      check: "challengeStepsVerified",
      releaseFields: [
        "ios.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true",
        "ios.challengeStepsRunId",
        "ios.challengeStepCount>=12",
        "ios.challengeStepsArtifact checks pedometerOrHealthData/onDemandOnly/timerOnlyBypassRejected=true",
      ],
      runId: `${options.runId}-challenge-steps-verification`,
      summary: "Record a walking challenge completing from a local on-demand HealthKit/CMPedometer report with enough steps and a rejected timer-only bypass.",
    },
    {
      artifactField: "ios.challengeLocationArtifact",
      check: "challengeLocationVerified",
      releaseFields: [
        "ios.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true",
        "ios.challengeLocationRunId",
        "ios.challengeLocationDistanceMeters>=10",
        "ios.challengeLocationSamples>=2",
        "ios.challengeLocationBestAccuracyMeters<=80",
        "ios.challengeLocationArtifact checks foregroundLocationOnly/onDemandOnly/multiSampleRoute/noRawCoordinatesPersisted=true",
      ],
      runId: `${options.runId}-challenge-location-verification`,
      summary: "Record an outdoor challenge completing from a local foreground-only, on-demand location report with multiple accurate fixes and no raw coordinate retention.",
    },
    {
      artifactField: "ios.shieldActionHandoffArtifact",
      check: "shieldActionHandoff",
      releaseFields: [
        "ios.shieldActionInterventionId",
      ],
      runId: `${options.runId}-shield-action-handoff`,
      summary: "Record Shield Action handoff opening FREED's relapse interruption flow.",
    },
    {
      artifactField: "ios.deviceActivityNightGuardArtifact",
      check: "deviceActivityNightGuard",
      releaseFields: [
        `ios.deviceActivityName=${options.deviceActivityName}`,
      ],
      runId: `${options.runId}-device-activity-night-guard`,
      summary: `Capture DeviceActivity schedule '${options.deviceActivityName}'.`,
    },
    {
      artifactField: "ios.normalBrowsingArtifact",
      check: "normalBrowsingAllowed",
      releaseFields: [
        `ios.normalBrowsingAllowedUrl=${options.normalUrl}`,
      ],
      runId: `${options.runId}-normal-browsing`,
      summary: `Prove normal browsing allowed for ${options.normalUrl}.`,
    },
    {
      artifactField: "ios.adultInterceptArtifact",
      check: "adultAttemptIntercepted",
      releaseFields: [
        `ios.adultInterceptedHost=${options.adultHost}`,
      ],
      runId: `${options.runId}-adult-intercept`,
      summary: `Prove adult attempt interception for ${options.adultHost}.`,
    },
  ];
}

function buildNotes(manifest) {
  const lines = [
    `# iOS Physical-Device Capture: ${manifest.runId}`,
    "",
    "This folder contains metadata and a manual QA checklist for iOS physical-device evidence. It does not satisfy release evidence by itself.",
    "",
    "Required manual recordings/reports:",
    "",
  ];
  for (const flow of manifest.manualFlows) {
    lines.push(`- ${flow.runId}: ${flow.summary} Suggested field: \`${flow.artifactField}\`.`);
    if (flow.releaseFields?.length) {
      lines.push(`  Release fields: ${flow.releaseFields.map((field) => `\`${field}\``).join(", ")}.`);
    }
  }
  if (manifest.appPackageProof) {
    lines.push(
      "",
      `Package proof: review \`${manifest.appPackageProof.artifact}\` for app-group, Family Controls, Safari Content Blocker, Shield Action, Shield Configuration, DeviceActivity extension embedding, and bundled Safari adult/short-form rule-list signals before using it as build/provisioning evidence.`,
    );
  }
  lines.push(
    "",
    "`ios-physical-device-evidence-fill-template.json` mirrors the final evidence shape with concrete run IDs, platform URL/host context, and pending artifact/check fields. It intentionally leaves artifacts blank and checks false until real physical-device QA fills them.",
  );
  lines.push("");
  lines.push("After capture, fill a draft `ios-physical-device.json`, run draft validation, then promote only after every artifact is real.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function flowByCheck(manualFlows, check) {
  const flow = manualFlows.find((entry) => entry.check === check);
  if (!flow) throw new Error(`Missing iOS manual flow for ${check}`);
  return flow;
}

function buildEvidenceFillTemplate(options, manifest) {
  const templateDevice = manifest.device ? sanitizeDeviceForArtifact(manifest.device) : null;
  const flow = (check) => flowByCheck(manifest.manualFlows, check);
  const permissionSetupWizard = flow("permissionSetupWizard");
  const familyControlsAuthorization = flow("familyControlsAuthorization");
  const familyActivityPicker = flow("familyActivityPicker");
  const selectedShieldTokens = flow("selectedShieldTokens");
  const selectedAppDailyLimitThreshold = flow("selectedAppDailyLimitThreshold");
  const managedSettingsAdultFilter = flow("managedSettingsAdultFilter");
  const safariContentBlockerReloaded = flow("safariContentBlockerReloaded");
  const safariContentBlockerAdultBlock = flow("safariContentBlockerAdultBlock");
  const safariFocusShieldShortFormBlock = flow("safariFocusShieldShortFormBlock");
  const safariShortFormChallengeHandoff = flow("safariShortFormChallengeHandoff");
  const earnedUnlockAllowsSelectedApps = flow("earnedUnlockAllowsSelectedApps");
  const earnedUnlockRejectsNonScreenTimeSource = flow("earnedUnlockRejectsNonScreenTimeSource");
  const earnedUnlockAutoRelock = flow("earnedUnlockAutoRelock");
  const challengePhotoVerifiedOnDevice = flow("challengePhotoVerifiedOnDevice");
  const challengeMotionVerified = flow("challengeMotionVerified");
  const challengeStepsVerified = flow("challengeStepsVerified");
  const challengeLocationVerified = flow("challengeLocationVerified");
  const shieldActionHandoff = flow("shieldActionHandoff");
  const deviceActivityNightGuard = flow("deviceActivityNightGuard");
  const normalBrowsingAllowed = flow("normalBrowsingAllowed");
  const adultAttemptIntercepted = flow("adultAttemptIntercepted");
  const deviceName = templateDevice ? `${templateDevice.name}, ${templateDevice.osVersion}` : "";
  const osVersion = templateDevice?.osVersion ? `iOS ${templateDevice.osVersion}` : "";

  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    instructions:
      "Copy this shape into ios-physical-device.json only after replacing blank artifacts, pending counts, and false checks with real entitlement-approved physical-device evidence.",
    validatedAt: "",
    tester: "",
    build: "",
    device: deviceName,
    deviceNameRedacted: templateDevice?.deviceNameRedacted === true,
    evidence: [],
    packageProofArtifact: manifest.appPackageProof?.artifact || "",
    packageProofUsableForManualEvidence: Boolean(manifest.appPackageProof?.packageProofUsableForManualEvidence),
    ios: {
      isPhysicalDevice: Boolean(templateDevice && !templateDevice.isSimulator),
      deviceModel: templateDevice?.name || "",
      osVersion,
      permissionWizardRunId: permissionSetupWizard.runId,
      permissionWizardArtifact: "",
      permissionWizardFlowOrder: PERMISSION_WIZARD_FLOW_ORDER,
      permissionExplanationShown: false,
      permissionExplanationSummary: "",
      permissionWizardTestProtectionPassed: false,
      familyControlsEntitlementTeamId: options.teamId || "",
      familyControlsEntitlementArtifact: manifest.appPackageProof?.artifact || "",
      appGroupProvisioningProfileId: "",
      appGroupProvisioningArtifact: manifest.appPackageProof?.artifact || "",
      completeDataProtectionEntitlement: COMPLETE_DATA_PROTECTION_VALUE,
      completeDataProtectionEntitlementArtifact: manifest.appPackageProof?.artifact || "",
      familyControlsAuthorizationRunId: familyControlsAuthorization.runId,
      familyControlsAuthorizationArtifact: "",
      familyControlsStatus: "",
      familyActivityPickerRunId: familyActivityPicker.runId,
      familyActivityPickerArtifact: "",
      familyActivityPickerAppLimitScheduledImmediately: false,
      familyActivityPickerAppLimitActivityName: options.appLimitActivityName,
      familyActivityPickerAppLimitEventName: options.appLimitEventName,
      selectedApplicationTokenCount: "",
      selectedCategoryTokenCount: "",
      selectedWebDomainTokenCount: "",
      selectedShieldTokensRunId: selectedShieldTokens.runId,
      selectedShieldTokensArtifact: "",
      appLimitScheduled: false,
      selectedAppDailyLimitMinutes: options.appLimitMinutes,
      selectedAppDailyLimitActivityName: options.appLimitActivityName,
      selectedAppDailyLimitEventName: options.appLimitEventName,
      selectedAppDailyLimitReachedToday: false,
      selectedAppDailyLimitReachedDate: "",
      selectedAppDailyLimitRunId: selectedAppDailyLimitThreshold.runId,
      selectedAppDailyLimitArtifact: "",
      managedSettingsFilterRunId: managedSettingsAdultFilter.runId,
      managedSettingsFilterArtifact: "",
      safariContentBlockerEmbedded: manifest.appPackageProof?.checks?.safariContentBlockerEmbedded === true,
      safariContentBlockerIdentifier: "app.freed.recovery.safari-content-blocker",
      safariContentBlockerBuildRunId: `${options.runId}-safari-content-blocker-build`,
      safariContentBlockerBuildArtifact: manifest.appPackageProof?.artifact || "",
      safariContentBlockerReloadRunId: safariContentBlockerReloaded.runId,
      safariContentBlockerReloadArtifact: "",
      safariContentBlockerVersion: "",
      safariContentBlockerChecksum: "",
      safariContentBlockerRuleCount: "",
      safariContentBlockerEnabled: false,
      safariContentBlockerAdultBlockRunId: safariContentBlockerAdultBlock.runId,
      safariContentBlockerAdultBlockArtifact: "",
      safariFocusShieldEmbedded: manifest.appPackageProof?.checks?.safariFocusShieldEmbedded === true,
      safariFocusShieldIdentifier: "app.freed.recovery.safari-focus-shield",
      safariFocusShieldShortFormUrl: options.shortFormUrl,
      safariFocusShieldShortFormBlockRunId: safariFocusShieldShortFormBlock.runId,
      safariFocusShieldShortFormBlockArtifact: "",
      safariShortFormChallengeHandoffRunId: safariShortFormChallengeHandoff.runId,
      safariShortFormChallengeHandoffArtifact: "",
      safariShortFormChallengeHandoffSource: IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE,
      safariShortFormChallengeHandoffMatchedRule: shortFormHandoffRuleForUrl(options.shortFormUrl),
      safariShortFormChallengeHandoffHost: shortFormHandoffHostForUrl(options.shortFormUrl),
      safariShortFormChallengeHandoffRawPathStored: "",
      safariShortFormChallengeHandoffNativeUnlockActive: "",
      safariShortFormChallengeHandoffSelectedShieldsStayedActive: "",
      safariShortFormChallengeHandoffAdultFilterStillActive: "",
      earnedUnlockAppAllowRunId: earnedUnlockAllowsSelectedApps.runId,
      earnedUnlockAppAllowArtifact: "",
      earnedUnlockRelockRunId: earnedUnlockAutoRelock.runId,
      earnedUnlockRelockArtifact: "",
      earnedUnlockDurationMinutes: options.earnedUnlockMinutes,
      earnedUnlockActivityName: options.earnedUnlockActivityName,
      earnedUnlockSelectedTokenCount: "",
      earnedUnlockAdultFilterStillActive: false,
      earnedUnlockSourceHost: IOS_SCREEN_TIME_SHIELD_HOST,
      earnedUnlockRejectedSourceRunId: earnedUnlockRejectsNonScreenTimeSource.runId,
      earnedUnlockRejectedSourceArtifact: "",
      earnedUnlockRejectedSourceHost: options.adultHost,
      earnedUnlockRejectedSelectedShieldsStayedActive: false,
      earnedUnlockRejectedAdultFilterStillActive: false,
      challengePhotoRunId: challengePhotoVerifiedOnDevice.runId,
      challengePhotoArtifact: "",
      challengePhotoClassifier: "Vision",
      challengePhotoMatchedLabel: "",
      challengePhotoConfidence: "",
      challengePhotoFreshCameraOnly: false,
      challengePhotoNoBase64OrExif: false,
      challengePhotoTemporaryFileDeleted: false,
      challengeMotionRunId: challengeMotionVerified.runId,
      challengeMotionArtifact: "",
      challengeMotionSamples: "",
      challengeStepsRunId: challengeStepsVerified.runId,
      challengeStepsArtifact: "",
      challengeStepCount: "",
      challengeLocationRunId: challengeLocationVerified.runId,
      challengeLocationArtifact: "",
      challengeLocationDistanceMeters: "",
      challengeLocationSamples: "",
      challengeLocationBestAccuracyMeters: "",
      shieldActionInterventionId: "",
      shieldActionHandoffRunId: shieldActionHandoff.runId,
      shieldActionHandoffArtifact: "",
      deviceActivityName: options.deviceActivityName,
      deviceActivityNightGuardRunId: deviceActivityNightGuard.runId,
      deviceActivityNightGuardArtifact: "",
      normalBrowsingRunId: normalBrowsingAllowed.runId,
      normalBrowsingArtifact: "",
      adultInterceptRunId: adultAttemptIntercepted.runId,
      adultInterceptArtifact: "",
      normalBrowsingAllowedUrl: options.normalUrl,
      adultInterceptedHost: options.adultHost,
    },
    checks: {
      permissionSetupWizard: false,
      familyControlsAuthorization: false,
      familyActivityPicker: false,
      familyActivityPickerSchedulesDailyLimit: false,
      managedSettingsAdultFilter: false,
      safariContentBlockerReloaded: false,
      safariContentBlockerEnabled: false,
      safariContentBlockerAdultBlock: false,
      safariFocusShieldShortFormBlock: false,
      safariShortFormChallengeHandoff: false,
      selectedShieldTokens: false,
      selectedAppDailyLimitThreshold: false,
      earnedUnlockAllowsSelectedApps: false,
      earnedUnlockRejectsNonScreenTimeSource: false,
      earnedUnlockAutoRelock: false,
      challengePhotoVerifiedOnDevice: false,
      challengeMotionVerified: false,
      challengeStepsVerified: false,
      challengeLocationVerified: false,
      shieldActionHandoff: false,
      deviceActivityNightGuard: false,
      normalBrowsingAllowed: false,
      adultAttemptIntercepted: false,
    },
  };
}

async function capture(options) {
  if (options.listDevicesOnly) {
    await captureDeviceDiscovery(options);
    return;
  }

  if (options.planOnly) {
    fs.mkdirSync(options.outputDir, { recursive: true });
    const manifest = {
      appGroupId: options.appGroupId,
      appLimitActivityName: options.appLimitActivityName,
      appLimitEventName: options.appLimitEventName,
      appLimitMinutes: options.appLimitMinutes,
      earnedUnlockActivityName: options.earnedUnlockActivityName,
      earnedUnlockMinutes: options.earnedUnlockMinutes,
      earnedUnlockSourceHost: IOS_SCREEN_TIME_SHIELD_HOST,
      bundleId: options.bundleId,
      appPackageProof: null,
      appPackageProofExpected: Boolean(options.appPath),
      appPath: options.appPath || null,
      adultInterceptedHost: options.adultHost,
      device: null,
      deviceActivityName: options.deviceActivityName,
      deviceNamesRedacted: true,
      evidenceSatisfied: false,
      generatedAt: new Date().toISOString(),
      manualFlows: requiredManualFlows(options),
      manualVerificationRequired: true,
      normalBrowsingAllowedUrl: options.normalUrl,
      outputDir: repoRelative(options.outputDir),
      releaseGate: "ios-physical-device-validation",
      result: "plan-only",
      runId: options.runId,
      safariFocusShieldShortFormUrl: options.shortFormUrl,
      sanitized: true,
      schema: "freed-ios-physical-device-capture-v1",
      teamId: options.teamId || null,
      toolTimeoutMs: options.toolTimeoutMs,
    };
    const manifestPath = path.join(options.outputDir, "capture-manifest.json");
    const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
    const evidenceFillTemplatePath = path.join(options.outputDir, "ios-physical-device-evidence-fill-template.json");
    writeJsonArtifact(manifestPath, manifest);
    writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
    writeTextArtifact(notesPath, buildNotes(manifest));
    console.log(
      JSON.stringify(
        {
          ...manifest,
          evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
          manifestArtifact: repoRelative(manifestPath),
          notesArtifact: repoRelative(notesPath),
        },
        null,
        2,
      ),
    );
    return;
  }

  fs.mkdirSync(options.outputDir, { recursive: true });
  const listed = await listDevices(options.toolTimeoutMs, options.outputDir);
  const deviceListArtifacts = writeDeviceListArtifacts(options.outputDir, listed);
  const device = resolveDevice(listed.devices, options.device);
  if (device.isSimulator) {
    throw new Error(`Refused simulator target for iOS physical-device evidence: ${device.name}`);
  }
  const details = await maybeDeviceDetails(device, options.outputDir, options.toolTimeoutMs);
  const appPackageProof = await inspectAppPackage(options.appPath, options.outputDir, options.appGroupId);
  const install = await maybeInstallApp(device, options.appPath, options.outputDir, options.toolTimeoutMs);
  const launch = options.launchApp ? await maybeLaunchApp(device, options.bundleId, options.outputDir, options.toolTimeoutMs) : null;
  const manifest = {
    appGroupId: options.appGroupId,
    appPath: options.appPath || null,
    appPackageProof,
    appLimitActivityName: options.appLimitActivityName,
    appLimitEventName: options.appLimitEventName,
    appLimitMinutes: options.appLimitMinutes,
    earnedUnlockActivityName: options.earnedUnlockActivityName,
    earnedUnlockSourceHost: IOS_SCREEN_TIME_SHIELD_HOST,
    bundleId: options.bundleId,
    device: sanitizeDeviceForArtifact(device),
    deviceNamesRedacted: true,
    deviceActivityName: options.deviceActivityName,
    earnedUnlockMinutes: options.earnedUnlockMinutes,
    deviceDetailsArtifact: details.artifact,
    generatedAt: new Date().toISOString(),
    install,
    launch,
    manualFlows: requiredManualFlows(options),
    manualVerificationRequired: true,
    normalBrowsingAllowedUrl: options.normalUrl,
    adultInterceptedHost: options.adultHost,
    safariFocusShieldShortFormUrl: options.shortFormUrl,
    outputDir: repoRelative(options.outputDir),
    releaseGate: "ios-physical-device-validation",
    result: "metadata-captured",
    runId: options.runId,
    schema: "freed-ios-physical-device-capture-v1",
    teamId: options.teamId || null,
    toolTimeoutMs: options.toolTimeoutMs,
    ...deviceListArtifacts,
  };
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  const evidenceFillTemplatePath = path.join(options.outputDir, "ios-physical-device-evidence-fill-template.json");
  writeJsonArtifact(manifestPath, manifest);
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        notesArtifact: repoRelative(notesPath),
      },
      null,
      2,
    ),
  );
}

function testPlist(value) {
  const pairs = Object.entries(value)
    .map(([key, entry]) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return `  <key>${key}</key>\n  <dict>\n${Object.entries(entry)
          .map(([nestedKey, nestedValue]) => `    <key>${nestedKey}</key>\n    <string>${nestedValue}</string>`)
          .join("\n")}\n  </dict>`;
      }
      return `  <key>${key}</key>\n  <string>${entry}</string>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${pairs}\n</dict>\n</plist>\n`;
}

function writeFakeBundleInfo(bundlePath, values) {
  fs.mkdirSync(bundlePath, { recursive: true });
  fs.writeFileSync(path.join(bundlePath, "Info.plist"), testPlist(values));
}

async function runSelfTest() {
  const sample = [
    "== Devices ==",
    "MacBook Pro (15.5) (00006030-0012345E0A90801E)",
    "QA iPhone (18.4) (00008110-001C2D123456801E)",
    "== Devices Offline ==",
    "Offline iPhone (18.4) (00008110-00ABCDEF123456)",
    "== Simulators ==",
    "iPhone 16 Pro (18.4) (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE)",
  ].join("\n");
  const devices = parseXctraceDevices(sample);
  assert.equal(devices.length, 4);
  assert.equal(devices[0].isSimulator, false);
  assert.equal(isPhysicalIosDevice(devices[0]), false);
  assert.equal(devices[1].isSimulator, false);
  assert.equal(isReadyPhysicalIosDevice(devices[1]), true);
  assert.equal(isPhysicalIosDevice(devices[2]), true);
  assert.equal(isReadyPhysicalIosDevice(devices[2]), false);
  assert.equal(devices[3].isSimulator, true);
  assert.equal(resolveDevice(devices, "QA iPhone").identifier, "00008110-001C2D123456801E");
  assert.throws(() => resolveDevice(devices, "Offline iPhone"), /listed but not ready/);
  assert.throws(() => resolveDevice(devices, "iPhone 16 Pro"), /physical iOS device/);
  const devicectlDevices = parseDevicectlDevicesJson({
    result: {
      devices: [
        {
          identifier: "00008140-001D78D62ED0801C",
          name: "QA iPhone",
          deviceProperties: {
            osVersionNumber: "26.5",
            platform: "iOS",
          },
          hardwareProperties: {
            deviceType: "iPhone",
          },
          connectionProperties: {
            pairingState: "paired",
            tunnelState: "connected",
          },
        },
        {
          identifier: "00008140-OFFLINE",
          name: "Offline iPhone",
          deviceProperties: {
            osVersionNumber: "26.5",
            platform: "iOS",
          },
          hardwareProperties: {
            deviceType: "iPhone",
          },
          connectionProperties: {
            pairingState: "unpaired",
            tunnelState: "unavailable",
          },
        },
        {
          identifier: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
          name: "iPhone 17 Pro Max",
          deviceProperties: {
            osVersionNumber: "26.5",
            platform: "iOS Simulator",
          },
        },
      ],
    },
  });
  assert.equal(devicectlDevices.length, 3);
  assert.equal(devicectlDevices[0].source, "devicectl devices");
  assert.equal(isReadyPhysicalIosDevice(devicectlDevices[0]), true);
  assert.equal(devicectlDevices[1].source, "devicectl devices offline");
  assert.equal(isReadyPhysicalIosDevice(devicectlDevices[1]), false);
  assert.equal(devicectlDevices[2].isSimulator, true);
  const options = parseArgs(["--self-test"]);
  assert.equal(options.bundleId, DEFAULT_BUNDLE_ID);
  assert.equal(options.earnedUnlockActivityName, DEFAULT_EARNED_UNLOCK_ACTIVITY_NAME);
  const listOptions = parseArgs(["--list-devices", "--tool-timeout-ms", "1500", "--run-id", "ios-discovery-self-test"]);
  assert.equal(listOptions.listDevicesOnly, true);
  assert.equal(listOptions.toolTimeoutMs, 1500);
  assert.equal(listOptions.runId, "ios-discovery-self-test");
  assert.throws(() => parseArgs(["--list-devices", "--tool-timeout-ms", "999"]), /between 1000 and 300000/);
  const discoveryWithPhone = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "QA iPhone", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-self-test") },
    { devices },
    path.join("docs", "validation", "artifacts", "ios-discovery-self-test", "xctrace-devices.txt")
  );
  assert.equal(discoveryWithPhone.schema, "freed-ios-device-discovery-v1");
  assert.equal(discoveryWithPhone.sanitized, true);
  assert.equal(discoveryWithPhone.result, "requested-physical-device-ready");
  assert.equal(discoveryWithPhone.requestedDevice, "Physical iPhone");
  assert.equal(discoveryWithPhone.requestedDeviceFound, true);
  assert.equal(discoveryWithPhone.requestedDeviceReady, true);
  assert.equal(discoveryWithPhone.physicalDeviceCount, 2);
  assert.equal(discoveryWithPhone.readyPhysicalDeviceCount, 1);
  assert.equal(discoveryWithPhone.offlinePhysicalDeviceCount, 1);
  assert.equal(discoveryWithPhone.deviceNamesRedacted, true);
  assert.equal(discoveryWithPhone.devices[0].name, "Non-iOS Apple device");
  assert.equal(discoveryWithPhone.devices[0].identifier, "non-ios-apple-device-1");
  assert.equal(discoveryWithPhone.devices[1].name, "Physical iPhone");
  assert.equal(discoveryWithPhone.devices[1].identifier, "physical-ios-device-2");
  assert.equal(discoveryWithPhone.devices[1].deviceNameRedacted, true);
  assert.equal(discoveryWithPhone.devices[2].name, "Physical iPhone");
  assert.equal(discoveryWithPhone.devices[2].identifier, "physical-ios-device-3");
  assert.equal(discoveryWithPhone.devices[3].name, "iPhone 16 Pro");
  assert.equal(discoveryWithPhone.devices[3].identifier, "ios-simulator-4");
  assert.equal(discoveryWithPhone.evidenceSatisfied, false);
  assert.match(discoveryWithPhone.evidenceBoundary, /does not prove Family Controls authorization/);
  const requestedByIdentifier = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "00008110-001C2D123456801E", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-requested-id-self-test") },
    { devices },
    path.join("docs", "validation", "artifacts", "ios-discovery-requested-id-self-test", "xctrace-devices.txt")
  );
  assert.equal(requestedByIdentifier.requestedDevice, "Physical iPhone");
  assert.doesNotMatch(JSON.stringify(requestedByIdentifier), /00008110-001C2D123456801E/);
  const redactedXctraceRaw = sanitizeDeviceListRawForArtifact(sample, devices);
  assert.doesNotMatch(redactedXctraceRaw, /QA iPhone/);
  assert.doesNotMatch(redactedXctraceRaw, /00008110-001C2D123456801E/);
  assert.doesNotMatch(redactedXctraceRaw, /00008110-00ABCDEF123456/);
  assert.match(redactedXctraceRaw, /Physical iPhone/);
  const discoveryFromDevicectl = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "QA iPhone", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-devicectl-self-test") },
    { devices: devicectlDevices, source: "devicectl" },
    {
      deviceListArtifact: "docs/validation/artifacts/ios-discovery-devicectl-self-test/devicectl-devices.json",
      deviceListSource: "devicectl",
      devicectlDevicesArtifact: "docs/validation/artifacts/ios-discovery-devicectl-self-test/devicectl-devices.json",
      xctraceErrorArtifact: "docs/validation/artifacts/ios-discovery-devicectl-self-test/xctrace-devices-error.txt",
    },
  );
  assert.equal(discoveryFromDevicectl.result, "requested-physical-device-ready");
  assert.equal(discoveryFromDevicectl.requestedDevice, "Physical iPhone");
  assert.equal(discoveryFromDevicectl.deviceListSource, "devicectl");
  assert.match(discoveryFromDevicectl.devicectlDevicesArtifact, /devicectl-devices\.json/);
  assert.match(discoveryFromDevicectl.xctraceErrorArtifact, /xctrace-devices-error\.txt/);
  assert.doesNotMatch(JSON.stringify(discoveryFromDevicectl), /00008140-001D78D62ED0801C/);
  const discoveryWithOfflinePhone = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "Offline iPhone", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-offline-self-test") },
    { devices },
    path.join("docs", "validation", "artifacts", "ios-discovery-offline-self-test", "xctrace-devices.txt")
  );
  assert.equal(discoveryWithOfflinePhone.result, "requested-physical-device-not-ready");
  assert.equal(discoveryWithOfflinePhone.requestedDeviceFound, true);
  assert.equal(discoveryWithOfflinePhone.requestedDeviceReady, false);
  assert.equal(discoveryWithOfflinePhone.readyPhysicalCandidateCount, 1);
  const discoveryWithoutPhone = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-empty-self-test") },
    { devices: [devices[0], devices[3]] },
    path.join("docs", "validation", "artifacts", "ios-discovery-empty-self-test", "xctrace-devices.txt")
  );
  assert.equal(discoveryWithoutPhone.result, "no-physical-device");
  assert.equal(discoveryWithoutPhone.physicalDeviceCount, 0);
  const discoveryOnlyOfflinePhone = buildDeviceDiscoveryManifest(
    { ...listOptions, device: "", outputDir: path.join("docs", "validation", "artifacts", "ios-discovery-only-offline-self-test") },
    { devices: [devices[2]] },
    path.join("docs", "validation", "artifacts", "ios-discovery-only-offline-self-test", "xctrace-devices.txt")
  );
  assert.equal(discoveryOnlyOfflinePhone.result, "physical-device-offline");
  assert.equal(discoveryOnlyOfflinePhone.physicalDeviceCount, 1);
  assert.equal(discoveryOnlyOfflinePhone.readyPhysicalDeviceCount, 0);
  assert.match(discoveryOnlyOfflinePhone.next, /listed offline/);
  assert.equal(parseArgs(["--adult-host", "adult-domain.realsite.com", "--normal-url", "https://youtube.com/results?search_query=workout"]).adultHost, "adult-domain.realsite.com");
  assert.throws(() => parseArgs(["--adult-host", "<real-adult-host>", "--normal-url", "https://youtube.com/results?search_query=workout"]), /placeholder/);
  assert.throws(() => parseArgs(["--adult-host", "adult-domain.realsite.com", "--normal-url", "http://youtube.com"]), /https/);
  const manualFlows = requiredManualFlows({ ...options, adultHost: "pornhub.com" });
  assert.equal(manualFlows.length, 25);
  const entitlementFlow = manualFlows.find((flow) => flow.check === "familyControlsEntitlement");
  assert.ok(entitlementFlow.releaseFields.includes("ios.familyControlsEntitlementTeamId"));
  assert.ok(entitlementFlow.releaseFields.includes("ios.familyControlsStatus=approved"));
  const provisioningFlow = manualFlows.find((flow) => flow.check === "appGroupProvisioning");
  assert.ok(provisioningFlow.releaseFields.includes("ios.appGroupProvisioningProfileId"));
  const completeDataProtectionFlow = manualFlows.find((flow) => flow.check === "completeDataProtectionEntitlement");
  assert.equal(completeDataProtectionFlow.artifactField, "ios.completeDataProtectionEntitlementArtifact");
  assert.ok(completeDataProtectionFlow.releaseFields.includes("ios.completeDataProtectionEntitlement=NSFileProtectionComplete"));
  const permissionWizardFlow = manualFlows.find((flow) => flow.check === "permissionSetupWizard");
  assert.equal(permissionWizardFlow.artifactField, "ios.permissionWizardArtifact");
  assert.ok(permissionWizardFlow.releaseFields.includes(`ios.permissionWizardFlowOrder=${PERMISSION_WIZARD_FLOW_ORDER}`));
  assert.ok(permissionWizardFlow.releaseFields.includes("ios.permissionExplanationShown=true"));
  assert.ok(
    permissionWizardFlow.releaseFields.includes(
      "ios.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"
    )
  );
  assert.ok(permissionWizardFlow.releaseFields.includes("ios.permissionWizardTestProtectionPassed=true"));
  const familyAuthorizationFlow = manualFlows.find((flow) => flow.check === "familyControlsAuthorization");
  assert.ok(familyAuthorizationFlow.releaseFields.includes("ios.familyControlsStatus=approved"));
  const pickerFlow = manualFlows.find((flow) => flow.check === "familyActivityPicker");
  assert.ok(pickerFlow.releaseFields.includes("ios.familyActivityPickerAppLimitScheduledImmediately=true"));
  assert.ok(pickerFlow.releaseFields.includes("ios.familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit"));
  assert.ok(pickerFlow.releaseFields.includes("ios.familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached"));
  const selectedShieldTokensFlow = manualFlows.find((flow) => flow.check === "selectedShieldTokens");
  assert.ok(selectedShieldTokensFlow.releaseFields.includes("ios.selectedApplicationTokenCount"));
  assert.ok(selectedShieldTokensFlow.releaseFields.includes("ios.selectedCategoryTokenCount"));
  assert.ok(selectedShieldTokensFlow.releaseFields.includes("ios.selectedWebDomainTokenCount"));
  assert.ok(selectedShieldTokensFlow.releaseFields.includes("ios.selectedTokenCounts>0"));
  const appLimitFlow = manualFlows.find((flow) => flow.check === "selectedAppDailyLimitThreshold");
  assert.ok(appLimitFlow.releaseFields.includes("ios.selectedAppDailyLimitReachedToday=true"));
  assert.ok(appLimitFlow.releaseFields.includes("ios.selectedAppDailyLimitMinutes=30"));
  assert.ok(appLimitFlow.releaseFields.includes("ios.selectedAppDailyLimitActivityName=freed.selectedAppDailyLimit"));
  assert.ok(appLimitFlow.releaseFields.includes("ios.selectedAppDailyLimitEventName=freed.selectedAppDailyLimitReached"));
  assert.ok(
    appLimitFlow.releaseFields.includes(
      "ios.selectedAppDailyLimitArtifact local freed-ios-screen-time-app-limit-report-v1 JSON with sanitized=true"
    )
  );
  const safariBuildFlow = manualFlows.find((flow) => flow.runId.endsWith("-safari-content-blocker-build"));
  assert.ok(safariBuildFlow.releaseFields.includes("ios.safariContentBlockerEmbedded=true"));
  assert.ok(safariBuildFlow.releaseFields.includes("ios.safariContentBlockerIdentifier=app.freed.recovery.safari-content-blocker"));
  const safariReloadFlow = manualFlows.find((flow) => flow.runId.endsWith("-safari-content-blocker-reload"));
  assert.ok(safariReloadFlow.releaseFields.includes("ios.safariContentBlockerVersion"));
  assert.ok(safariReloadFlow.releaseFields.includes("ios.safariContentBlockerChecksum=fnv1a32:<8-hex>"));
  assert.ok(safariReloadFlow.releaseFields.includes("ios.safariContentBlockerRuleCount"));
  assert.ok(safariReloadFlow.releaseFields.includes("ios.safariContentBlockerEnabled=true"));
  const safariShortFormFlow = manualFlows.find((flow) => flow.check === "safariFocusShieldShortFormBlock");
  assert.ok(safariShortFormFlow.releaseFields.includes("ios.safariFocusShieldShortFormUrl=https://youtube.com/shorts/dQw4w9WgXcQ"));
  const safariShortFormHandoffFlow = manualFlows.find((flow) => flow.check === "safariShortFormChallengeHandoff");
  assert.equal(safariShortFormHandoffFlow.artifactField, "ios.safariShortFormChallengeHandoffArtifact");
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffRunId"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffArtifact"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffSource=ios-safari-short-form"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffMatchedRule=short-form:youtube-shorts"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffHost=youtube.com"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffRawPathStored=false"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffNativeUnlockActive=false"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive=true"));
  assert.ok(safariShortFormHandoffFlow.releaseFields.includes("ios.safariShortFormChallengeHandoffAdultFilterStillActive=true"));
  const earnedUnlockFlow = manualFlows.find((flow) => flow.check === "earnedUnlockAllowsSelectedApps");
  assert.ok(earnedUnlockFlow.releaseFields.includes("ios.earnedUnlockActivityName=freed.earnedUnlockWindow"));
  assert.ok(earnedUnlockFlow.releaseFields.includes("ios.earnedUnlockSelectedTokenCount=ios.selectedTokenCounts"));
  assert.ok(earnedUnlockFlow.releaseFields.includes("ios.earnedUnlockAdultFilterStillActive=true"));
  assert.ok(earnedUnlockFlow.releaseFields.includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"));
  assert.ok(
    earnedUnlockFlow.releaseFields.includes(
      "ios.earnedUnlockAppAllowArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"
    )
  );
  const earnedUnlockRejectedFlow = manualFlows.find((flow) => flow.check === "earnedUnlockRejectsNonScreenTimeSource");
  assert.equal(earnedUnlockRejectedFlow.artifactField, "ios.earnedUnlockRejectedSourceArtifact");
  assert.ok(earnedUnlockRejectedFlow.releaseFields.includes("ios.earnedUnlockRejectedSourceRunId"));
  assert.ok(earnedUnlockRejectedFlow.releaseFields.includes("ios.earnedUnlockRejectedSourceArtifact"));
  assert.ok(earnedUnlockRejectedFlow.releaseFields.includes("ios.earnedUnlockRejectedSourceHost=pornhub.com"));
  assert.ok(earnedUnlockRejectedFlow.releaseFields.includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive=true"));
  assert.ok(earnedUnlockRejectedFlow.releaseFields.includes("ios.earnedUnlockRejectedAdultFilterStillActive=true"));
  assert.ok(
    earnedUnlockRejectedFlow.releaseFields.includes(
      "ios.earnedUnlockRejectedSourceArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"
    )
  );
  const earnedUnlockRelockFlow = manualFlows.find((flow) => flow.check === "earnedUnlockAutoRelock");
  assert.ok(
    earnedUnlockRelockFlow.releaseFields.includes(
      "ios.earnedUnlockRelockArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"
    )
  );
  const challengePhotoFlow = manualFlows.find((flow) => flow.check === "challengePhotoVerifiedOnDevice");
  assert.ok(challengePhotoFlow.releaseFields.includes("ios.challengePhotoClassifier=Vision"));
  assert.ok(challengePhotoFlow.releaseFields.includes("ios.challengePhotoNoBase64OrExif=true"));
  assert.ok(challengePhotoFlow.releaseFields.includes("ios.challengePhotoTemporaryFileDeleted=true"));
  const challengeLocationFlow = manualFlows.find((flow) => flow.check === "challengeLocationVerified");
  assert.ok(challengeLocationFlow.releaseFields.includes("ios.challengeLocationBestAccuracyMeters<=80"));
  const shieldActionFlow = manualFlows.find((flow) => flow.check === "shieldActionHandoff");
  assert.ok(shieldActionFlow.releaseFields.includes("ios.shieldActionInterventionId"));
  const deviceActivityFlow = manualFlows.find((flow) => flow.check === "deviceActivityNightGuard");
  assert.ok(deviceActivityFlow.releaseFields.includes("ios.deviceActivityName=night-guard"));
  const normalBrowsingFlow = manualFlows.find((flow) => flow.check === "normalBrowsingAllowed");
  assert.ok(normalBrowsingFlow.releaseFields.includes("ios.normalBrowsingAllowedUrl=https://youtube.com/results?search_query=workout"));
  const adultInterceptFlow = manualFlows.find((flow) => flow.check === "adultAttemptIntercepted");
  assert.ok(adultInterceptFlow.releaseFields.includes("ios.adultInterceptedHost=pornhub.com"));
  const fillTemplateOptions = { ...options, adultHost: "pornhub.com", runId: "self-test" };
  const fillTemplateFlows = requiredManualFlows(fillTemplateOptions);
  const fillTemplate = buildEvidenceFillTemplate(
    fillTemplateOptions,
    {
      appPackageProof: { artifact: "docs/validation/artifacts/ios-app-package-proof.json", packageProofUsableForManualEvidence: true },
      device: { isSimulator: false, name: "QA iPhone", osVersion: "18.4" },
      manualFlows: fillTemplateFlows,
    }
  );
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.deviceNameRedacted, true);
  assert.equal(fillTemplate.ios.isPhysicalDevice, true);
  assert.equal(fillTemplate.ios.deviceModel, "Physical iPhone");
  assert.doesNotMatch(fillTemplate.device, /QA iPhone/);
  assert.equal(
    fillTemplate.ios.familyControlsEntitlementArtifact,
    "docs/validation/artifacts/ios-app-package-proof.json",
  );
  assert.equal(
    fillTemplate.ios.appGroupProvisioningArtifact,
    "docs/validation/artifacts/ios-app-package-proof.json",
  );
  assert.equal(fillTemplate.ios.completeDataProtectionEntitlement, "NSFileProtectionComplete");
  assert.equal(
    fillTemplate.ios.completeDataProtectionEntitlementArtifact,
    "docs/validation/artifacts/ios-app-package-proof.json",
  );
  assert.equal(fillTemplate.ios.permissionWizardRunId, "self-test-permission-wizard");
  assert.equal(fillTemplate.ios.permissionWizardFlowOrder, PERMISSION_WIZARD_FLOW_ORDER);
  assert.equal(fillTemplate.ios.familyActivityPickerAppLimitActivityName, DEFAULT_APP_LIMIT_ACTIVITY_NAME);
  assert.equal(fillTemplate.ios.safariShortFormChallengeHandoffSource, IOS_SAFARI_SHORT_FORM_HANDOFF_SOURCE);
  assert.equal(fillTemplate.ios.safariShortFormChallengeHandoffMatchedRule, "short-form:youtube-shorts");
  assert.equal(fillTemplate.ios.earnedUnlockSourceHost, IOS_SCREEN_TIME_SHIELD_HOST);
  assert.equal(fillTemplate.ios.earnedUnlockRejectedSourceHost, "pornhub.com");
  assert.equal(fillTemplate.ios.challengePhotoClassifier, "Vision");
  assert.equal(fillTemplate.ios.normalBrowsingAllowedUrl, DEFAULT_NORMAL_URL);
  assert.equal(fillTemplate.checks.safariContentBlockerAdultBlock, false);
  assert.equal(parseArgs(["--self-test", "--app-limit-minutes", "45"]).appLimitMinutes, 45);
  assert.throws(() => parseArgs(["--adult-host", "adult-domain.realsite.com", "--app-limit-minutes", "4"]), /between 5 and 240/);
  assert.equal(parseArgs(["--self-test", "--earned-unlock-minutes", "20"]).earnedUnlockMinutes, 20);
  assert.equal(parseArgs(["--self-test", "--earned-unlock-activity-name", "freed.customUnlock"]).earnedUnlockActivityName, "freed.customUnlock");
  assert.throws(() => parseArgs(["--adult-host", "adult-domain.realsite.com", "--earned-unlock-minutes", "0"]), /between 1 and 120/);
  assert.equal(parseArgs(["--self-test", "--tool-timeout-ms", "45000"]).toolTimeoutMs, 45000);
  assert.throws(() => parseArgs(["--adult-host", "adult-domain.realsite.com", "--tool-timeout-ms", "999"]), /between 1000 and 300000/);
  assert.equal(
    parseArgs([
      "--adult-host",
      "adult-domain.realsite.com",
      "--short-form-url",
      "https://www.instagram.com/reels/"
    ]).shortFormUrl,
    "https://www.instagram.com/reels/"
  );
  assert.throws(
    () => parseArgs(["--adult-host", "adult-domain.realsite.com", "--short-form-url", "https://youtube.com/watch?v=abc"]),
    /shorts|reels|For You/i
  );
  assert.equal(safeRunId("ios-physical-2026-05-15"), "ios-physical-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-ios-package-proof-"));
  const fakeApp = path.join(tempDir, "FREED.app");
  writeFakeBundleInfo(fakeApp, { CFBundleIdentifier: "app.freed.recovery", CFBundleExecutable: "FREED" });
  for (const expected of EXPECTED_APP_EXTENSIONS) {
    writeFakeBundleInfo(path.join(fakeApp, "PlugIns", expected.bundleName), {
      CFBundleIdentifier: `app.freed.recovery.${expected.bundleName.replace(/\.appex$/, "")}`,
      CFBundleExecutable: expected.bundleName.replace(/\.appex$/, ""),
      NSExtension: {
        NSExtensionPointIdentifier: expected.extensionPoint,
        NSExtensionPrincipalClass: expected.requiredPrincipalClass,
      },
    });
    if (expected.requiresSafariRuleList) {
      fs.writeFileSync(
        path.join(fakeApp, "PlugIns", expected.bundleName, SAFARI_RULE_LIST_FILE_NAME),
        JSON.stringify([
          { trigger: { "url-filter": "^https?://([^/?#]+\\.)?pornhub\\.com([/:?#]|$)" }, action: { type: "block" } },
          { trigger: { "url-filter": "^https?://([^/?#]+\\.)?xvideos\\.com([/:?#]|$)" }, action: { type: "block" } },
        ]),
      );
    }
    if (expected.requiresSafariFocusResources) {
      const extensionPath = path.join(fakeApp, "PlugIns", expected.bundleName);
      fs.writeFileSync(
        path.join(extensionPath, "manifest.json"),
        JSON.stringify({
          manifest_version: 3,
          browser_specific_settings: { safari: { strict_min_version: "15.4" } },
          background: { service_worker: "background.js" },
          permissions: ["nativeMessaging"],
          host_permissions: SAFARI_FOCUS_HOST_PERMISSIONS,
        }),
      );
      fs.writeFileSync(
        path.join(extensionPath, "background.js"),
        "browser.runtime.onMessage.addListener(() => browser.runtime.sendNativeMessage('app.freed.recovery', {}));",
      );
      fs.writeFileSync(
        path.join(extensionPath, "content.js"),
        "const runtime = browser.runtime; if (runtime?.sendMessage) runtime.sendMessage({ rule: 'short-form:youtube-shorts', host: 'youtube.com' });",
      );
    }
  }
  const packageProof = await inspectAppPackage(fakeApp, tempDir, DEFAULT_APP_GROUP);
  assert.equal(packageProof.schemaVersion, "freed-ios-app-package-proof-v1");
  assert.equal(packageProof.sanitized, true);
  assert.equal(packageProof.platform, "ios");
  assert.equal(packageProof.extensions.length, EXPECTED_APP_EXTENSIONS.length);
  assert.deepEqual(packageProof.missingOrMismatchedExtensions, []);
  assert.deepEqual(packageProof.safariRuleFailures, []);
  assert.ok(packageProof.entitlementFailures.includes("app Complete Data Protection entitlement"));
  assert.ok(
    packageProof.entitlementFailures.includes("FREEDSafariContentBlocker.appex Complete Data Protection entitlement"),
  );
  const safariProof = packageProof.extensions.find((entry) => entry.bundleName === "FREEDSafariContentBlocker.appex").safariRuleList;
  assert.equal(safariProof.usableForManualEvidence, true);
  const focusShieldProof = packageProof.extensions.find(
    (entry) => entry.bundleName === "FREEDSafariFocusShield.appex",
  ).safariFocusShield;
  assert.equal(focusShieldProof.usableForManualEvidence, true);
  assert.equal(packageProof.packageProofUsableForManualEvidence, false);
  console.log("ios-physical-device-evidence self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    await runSelfTest();
    return;
  }
  await capture(options);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
