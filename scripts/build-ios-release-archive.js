#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_WORKSPACE = "ios/FREED.xcworkspace";
const DEFAULT_SCHEME = "FREED";
const DEFAULT_CONFIGURATION = "Release";
const DEFAULT_SDK = "iphoneos";
const DEFAULT_DESTINATION = "generic/platform=iOS";
const DEFAULT_ARCHIVE_PATH = "ios/build/FREED-release.xcarchive";
const DEFAULT_EXPORT_PATH = "ios/build/export";
const DEFAULT_EXPORT_METHOD = "app-store-connect";
const DEFAULT_EXPORT_OPTIONS_PLIST = "ios/build/FREED-export-options.plist";
const DEFAULT_BUNDLE_ID = "app.freed.recovery";
const DEFAULT_APP_GROUP = "group.app.freed.recovery";
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const COMPLETE_DATA_PROTECTION = "NSFileProtectionComplete";
const DATA_PROTECTION_ENTITLEMENT = "com.apple.developer.default-data-protection";
const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const TAIL_LIMIT = 18_000;

const EXPECTED_EXTENSIONS = Object.freeze([
  {
    bundleId: "app.freed.recovery.shield-configuration",
    bundleName: "FREEDShieldConfiguration.appex",
    extensionPoint: "com.apple.ManagedSettingsUI.shield-configuration-service",
    principalClass: "ShieldConfigurationExtension",
    requiresFamilyControls: true,
  },
  {
    bundleId: "app.freed.recovery.shield-action",
    bundleName: "FREEDShieldAction.appex",
    extensionPoint: "com.apple.ManagedSettings.shield-action-service",
    principalClass: "ShieldActionExtension",
    requiresFamilyControls: true,
  },
  {
    bundleId: "app.freed.recovery.device-activity-monitor",
    bundleName: "FREEDDeviceActivityMonitor.appex",
    extensionPoint: "com.apple.deviceactivity.monitor-extension",
    principalClass: "DeviceActivityMonitorExtension",
    requiresFamilyControls: true,
  },
  {
    bundleId: "app.freed.recovery.safari-content-blocker",
    bundleName: "FREEDSafariContentBlocker.appex",
    extensionPoint: "com.apple.Safari.content-blocker",
    principalClass: "ContentBlockerRequestHandler",
    requiresFamilyControls: false,
    requiresSafariRuleList: true,
  },
]);

const SAFARI_RULE_SIGNALS = Object.freeze([
  { key: "adult-domain-pornhub", pattern: /pornhub\\\.com/i },
  { key: "adult-domain-xvideos", pattern: /xvideos\\\.com/i },
  { key: "youtube-shorts-web", pattern: /youtube\\\.com\/shorts/i },
  { key: "instagram-reels-web", pattern: /instagram\\\.com\/reel/i },
  { key: "tiktok-for-you-web", pattern: /tiktok\\\.com\/foryou/i },
]);

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolvePath(value) {
  if (!value || value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

function parseArgs(argv) {
  const options = {
    allowProvisioningUpdates: truthy(process.env.FREED_IOS_ALLOW_PROVISIONING_UPDATES),
    appGroupId: process.env.FREED_IOS_APP_GROUP_ID || DEFAULT_APP_GROUP,
    archivePath: process.env.FREED_IOS_ARCHIVE_PATH || DEFAULT_ARCHIVE_PATH,
    buildSettings: [],
    bundleId: process.env.APP_STORE_BUNDLE_ID || process.env.FREED_IOS_BUNDLE_ID || DEFAULT_BUNDLE_ID,
    codeSignIdentity: process.env.FREED_IOS_CODE_SIGN_IDENTITY || "Apple Distribution",
    codeSignStyle: process.env.FREED_IOS_CODE_SIGN_STYLE || "Automatic",
    configuration: process.env.FREED_IOS_ARCHIVE_CONFIGURATION || DEFAULT_CONFIGURATION,
    destination: process.env.FREED_IOS_ARCHIVE_DESTINATION || DEFAULT_DESTINATION,
    dryRun: false,
    exportMethod: process.env.FREED_IOS_EXPORT_METHOD || DEFAULT_EXPORT_METHOD,
    exportOptionsPlist: process.env.FREED_IOS_EXPORT_OPTIONS_PLIST || "",
    exportPath: process.env.FREED_IOS_EXPORT_PATH || DEFAULT_EXPORT_PATH,
    idleTimeoutMs: parsePositiveInteger(
      process.env.FREED_IOS_ARCHIVE_IDLE_TIMEOUT_MS || String(DEFAULT_IDLE_TIMEOUT_MS),
      "FREED_IOS_ARCHIVE_IDLE_TIMEOUT_MS",
    ),
    logPath:
      process.env.FREED_IOS_ARCHIVE_LOG ||
      path.join("/tmp", `freed-ios-release-archive-${timestampLabel()}.log`),
    provisioningProfileSpecifier: process.env.FREED_IOS_PROFILE_SPECIFIER || "",
    provisioningProfilesJson: process.env.FREED_IOS_PROVISIONING_PROFILES_JSON || "",
    reportPath: process.env.FREED_IOS_ARCHIVE_REPORT || "",
    requireReleaseSigning:
      truthy(process.env.FREED_REQUIRE_IOS_RELEASE_SIGNING) ||
      truthy(process.env.FREED_IOS_REQUIRE_RELEASE_SIGNING),
    scheme: process.env.FREED_IOS_ARCHIVE_SCHEME || DEFAULT_SCHEME,
    sdk: process.env.FREED_IOS_ARCHIVE_SDK || DEFAULT_SDK,
    selfTest: false,
    skipExport: false,
    teamId: process.env.FREED_IOS_DEVELOPMENT_TEAM || process.env.APPLE_TEAM_ID || "",
    timeoutMs: parsePositiveInteger(
      process.env.FREED_IOS_ARCHIVE_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
      "FREED_IOS_ARCHIVE_TIMEOUT_MS",
    ),
    workspace: process.env.FREED_IOS_ARCHIVE_WORKSPACE || DEFAULT_WORKSPACE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--allow-provisioning-updates") {
      options.allowProvisioningUpdates = true;
    } else if (arg === "--app-group-id") {
      options.appGroupId = next();
    } else if (arg === "--archive-path") {
      options.archivePath = next();
    } else if (arg === "--build-setting") {
      options.buildSettings.push(next());
    } else if (arg === "--bundle-id") {
      options.bundleId = next();
    } else if (arg === "--code-sign-identity") {
      options.codeSignIdentity = next();
    } else if (arg === "--code-sign-style") {
      options.codeSignStyle = next();
    } else if (arg === "--configuration") {
      options.configuration = next();
    } else if (arg === "--destination") {
      options.destination = next();
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--export-method") {
      options.exportMethod = next();
    } else if (arg === "--export-options-plist") {
      options.exportOptionsPlist = next();
    } else if (arg === "--export-path") {
      options.exportPath = next();
    } else if (arg === "--idle-timeout-ms") {
      options.idleTimeoutMs = parsePositiveInteger(next(), "--idle-timeout-ms");
    } else if (arg === "--log") {
      options.logPath = next();
    } else if (arg === "--profile-specifier") {
      options.provisioningProfileSpecifier = next();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report");
    } else if (arg === "--require-release-signing") {
      options.requireReleaseSigning = true;
    } else if (arg === "--scheme") {
      options.scheme = next();
    } else if (arg === "--sdk") {
      options.sdk = next();
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--skip-export") {
      options.skipExport = true;
    } else if (arg === "--team-id") {
      options.teamId = next();
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

  for (const field of ["workspace", "scheme", "configuration", "sdk", "destination", "archivePath", "exportPath", "bundleId", "appGroupId"]) {
    if (!String(options[field] ?? "").trim()) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} must not be empty`);
  }
  if (options.idleTimeoutMs > options.timeoutMs) {
    throw new Error("--idle-timeout-ms must be less than or equal to --timeout-ms");
  }
  if (options.requireReleaseSigning && !TEAM_ID_PATTERN.test(options.teamId)) {
    throw new Error(
      "iOS release signing requires FREED_IOS_DEVELOPMENT_TEAM or APPLE_TEAM_ID as a 10-character Apple team ID.",
    );
  }
  if (!["Automatic", "Manual"].includes(options.codeSignStyle)) {
    throw new Error("--code-sign-style must be Automatic or Manual");
  }
  if (!["app-store-connect", "app-store"].includes(options.exportMethod)) {
    throw new Error("--export-method must be app-store-connect or app-store");
  }
  for (const setting of options.buildSettings) {
    if (!/^[A-Za-z0-9_]+=[\s\S]+$/.test(setting)) {
      throw new Error(`--build-setting must be KEY=VALUE, got: ${setting}`);
    }
  }

  options.archivePath = resolvePath(options.archivePath);
  options.exportPath = resolvePath(options.exportPath);
  options.logPath = resolvePath(options.logPath);
  if (options.exportOptionsPlist) options.exportOptionsPlist = resolvePath(options.exportOptionsPlist);
  if (options.reportPath) options.reportPath = assertSafeReportPath(options.reportPath);
  return options;
}

function printHelp() {
  console.log(`Usage: npm run build:ios-archive:release -- [options]

Archives and exports FREED for App Store Connect/TestFlight, then writes a
sanitized JSON report that proves Release signing, embedded Screen Time/Safari
extensions, required entitlements, no packet tunnel entitlements, and IPA hash.

Options:
  --workspace <path>             Xcode workspace. Default: ${DEFAULT_WORKSPACE}
  --scheme <name>                Scheme. Default: ${DEFAULT_SCHEME}
  --configuration <name>         Build configuration. Default: ${DEFAULT_CONFIGURATION}
  --sdk <name>                   SDK. Default: ${DEFAULT_SDK}
  --destination <destination>    Destination. Default: ${DEFAULT_DESTINATION}
  --archive-path <path>          .xcarchive path. Default: ${DEFAULT_ARCHIVE_PATH}
  --export-path <path>           IPA export folder. Default: ${DEFAULT_EXPORT_PATH}
  --export-method <method>       app-store-connect or app-store. Default: ${DEFAULT_EXPORT_METHOD}
  --export-options-plist <path>  Existing export options plist. Otherwise one is generated.
  --team-id <id>                 Apple team ID. Also honors FREED_IOS_DEVELOPMENT_TEAM.
  --code-sign-style <style>      Automatic or Manual. Default: Automatic
  --code-sign-identity <name>    Default: Apple Distribution
  --profile-specifier <name>     Optional manual profile specifier for xcodebuild.
  --allow-provisioning-updates   Allow Xcode to use configured Apple account credentials.
  --build-setting KEY=VALUE      Extra xcodebuild build setting. Repeatable.
  --timeout-ms <ms>              Total timeout per xcodebuild command. Default: ${DEFAULT_TIMEOUT_MS}
  --idle-timeout-ms <ms>         No-output timeout per xcodebuild command. Default: ${DEFAULT_IDLE_TIMEOUT_MS}
  --log <path>                   Full xcodebuild log path. Default: /tmp/freed-ios-release-archive-*.log
  --report <path>                Write sanitized JSON report under docs/validation/artifacts/<run-id>/.
  --require-release-signing      Fail unless release signing config is present and signed output proves distribution signing.
  --skip-export                  Archive only; release verifier requires export, so do not use for store proof.
  --dry-run                      Print commands and generated export options without running xcodebuild.
  --self-test                    Run offline parser/report checks.
`);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseProvisioningProfilesJson(raw) {
  if (!raw.trim()) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FREED_IOS_PROVISIONING_PROFILES_JSON must be a JSON object mapping bundle IDs to profile names.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("FREED_IOS_PROVISIONING_PROFILES_JSON must be a JSON object mapping bundle IDs to profile names.");
  }
  for (const [bundleId, profile] of Object.entries(parsed)) {
    if (!bundleId.trim() || typeof profile !== "string" || !profile.trim()) {
      throw new Error("FREED_IOS_PROVISIONING_PROFILES_JSON entries must be non-empty strings.");
    }
  }
  return parsed;
}

function exportOptionsXml(options, provisioningProfiles) {
  const signingStyle = options.codeSignStyle.toLowerCase();
  const profileEntries = Object.entries(provisioningProfiles);
  const provisioningProfilesXml = profileEntries.length
    ? [
        "\t<key>provisioningProfiles</key>",
        "\t<dict>",
        ...profileEntries.flatMap(([bundleId, profile]) => [
          `\t\t<key>${xmlEscape(bundleId)}</key>`,
          `\t\t<string>${xmlEscape(profile)}</string>`,
        ]),
        "\t</dict>",
      ].join("\n")
    : "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "\t<key>destination</key>",
    "\t<string>export</string>",
    "\t<key>method</key>",
    `\t<string>${xmlEscape(options.exportMethod)}</string>`,
    "\t<key>signingStyle</key>",
    `\t<string>${xmlEscape(signingStyle)}</string>`,
    ...(options.teamId ? ["\t<key>teamID</key>", `\t<string>${xmlEscape(options.teamId)}</string>`] : []),
    "\t<key>stripSwiftSymbols</key>",
    "\t<true/>",
    "\t<key>uploadSymbols</key>",
    "\t<true/>",
    ...(provisioningProfilesXml ? [provisioningProfilesXml] : []),
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

function ensureExportOptionsPlist(options) {
  if (options.exportOptionsPlist) {
    return {
      generated: false,
      path: options.exportOptionsPlist,
      provisioningProfileBundleIds: Object.keys(parseProvisioningProfilesJson(options.provisioningProfilesJson)).sort(),
    };
  }
  const provisioningProfiles = parseProvisioningProfilesJson(options.provisioningProfilesJson);
  const plistPath = resolvePath(DEFAULT_EXPORT_OPTIONS_PLIST);
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, exportOptionsXml(options, provisioningProfiles));
  return {
    generated: true,
    path: plistPath,
    provisioningProfileBundleIds: Object.keys(provisioningProfiles).sort(),
  };
}

function archiveArgs(options) {
  const args = [
    "-workspace",
    options.workspace,
    "-scheme",
    options.scheme,
    "-configuration",
    options.configuration,
    "-sdk",
    options.sdk,
    "-destination",
    options.destination,
    "-archivePath",
    options.archivePath,
  ];
  if (options.allowProvisioningUpdates) args.push("-allowProvisioningUpdates");
  args.push(
    "CODE_SIGNING_ALLOWED=YES",
    "CODE_SIGNING_REQUIRED=YES",
    `CODE_SIGN_STYLE=${options.codeSignStyle}`,
    "COMPILER_INDEX_STORE_ENABLE=NO",
  );
  if (options.teamId) args.push(`DEVELOPMENT_TEAM=${options.teamId}`);
  if (options.codeSignIdentity) args.push(`CODE_SIGN_IDENTITY=${options.codeSignIdentity}`);
  if (options.provisioningProfileSpecifier) {
    args.push(`PROVISIONING_PROFILE_SPECIFIER=${options.provisioningProfileSpecifier}`);
  }
  args.push(...options.buildSettings, "archive");
  return args;
}

function exportArgs(options, exportOptionsPath) {
  const args = [
    "-exportArchive",
    "-archivePath",
    options.archivePath,
    "-exportPath",
    options.exportPath,
    "-exportOptionsPlist",
    exportOptionsPath,
  ];
  if (options.allowProvisioningUpdates) args.push("-allowProvisioningUpdates");
  return args;
}

function printableCommand(command, args) {
  return `${command} ${args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`;
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
      // The process may already have exited.
    }
  }
}

function runLogged(command, args, options) {
  fs.mkdirSync(path.dirname(options.logPath), { recursive: true });
  const log = fs.createWriteStream(options.logPath, { flags: options.appendLog ? "a" : "w" });
  const startedAt = Date.now();
  let tail = "";
  let settled = false;
  let forcedFailureMessage = "";
  let totalTimer;
  let idleTimer;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      detached: true,
      env: {
        ...process.env,
        CI: process.env.CI || "1",
        EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY || "1",
        NODE_ENV: "production",
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
        if (!settled && child.exitCode === null) killProcessGroup(child, "SIGKILL");
        if (!settled) {
          settle(new Error(`${message}\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`));
        }
      }, 3000);
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        failAfterKill(`${command} produced no output for ${options.idleTimeoutMs}ms`);
      }, options.idleTimeoutMs);
    };

    totalTimer = setTimeout(() => {
      failAfterKill(`${command} exceeded total timeout ${options.timeoutMs}ms`);
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
    child.on("error", (error) => settle(error));
    child.on("exit", (code, signal) => {
      const durationMs = Date.now() - startedAt;
      if (forcedFailureMessage) {
        settle(new Error(`${forcedFailureMessage} after ${durationMs}ms\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`));
        return;
      }
      if (code === 0) {
        settle(null, { durationMs });
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code}`;
      settle(new Error(`${command} failed with ${suffix} after ${durationMs}ms\nLog: ${options.logPath}\nRecent output:\n${tail.trim()}`));
    });
  });
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
    timeout: options.timeoutMs || 30_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}: ${result.stderr || result.stdout}`);
  }
  return { stdout: result.stdout || "", stderr: result.stderr || "" };
}

function readPlistJson(plistPath) {
  const { stdout } = runSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath]);
  return JSON.parse(stdout || "{}");
}

function repoPath(filePath) {
  if (!filePath) return "";
  const resolved = path.resolve(filePath);
  const workspaceRelative = path.relative(ROOT, resolved).replace(/\\/g, "/");
  if (!workspaceRelative.startsWith("..") && !path.isAbsolute(workspaceRelative)) return workspaceRelative || ".";
  const homeRelative = path.relative(os.homedir(), resolved).replace(/\\/g, "/");
  if (!homeRelative.startsWith("..") && !path.isAbsolute(homeRelative)) return homeRelative ? `~/${homeRelative}` : "~";
  return path.basename(resolved);
}

function codesignDetails(bundlePath) {
  try {
    const result = runSync("/usr/bin/codesign", ["-dv", "--verbose=4", bundlePath]);
    const text = `${result.stdout}\n${result.stderr}`;
    const authorities = [...text.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1].trim());
    return {
      appleDistributionSigned: authorities.some((value) => /Apple Distribution|iPhone Distribution/i.test(value)),
      authorities,
      available: true,
      debugSigned: authorities.some((value) => /Apple Development|iPhone Developer/i.test(value)),
      identifier: text.match(/^Identifier=(.+)$/m)?.[1]?.trim() || "",
      teamIdentifier: text.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || "",
    };
  } catch (error) {
    return {
      appleDistributionSigned: false,
      authorities: [],
      available: false,
      debugSigned: false,
      error: error instanceof Error ? error.message.replace(/\s+/g, " ").trim() : String(error),
      identifier: "",
      teamIdentifier: "",
    };
  }
}

function codesignEntitlementsXml(bundlePath) {
  try {
    const result = runSync("/usr/bin/codesign", ["-d", "--entitlements", ":-", bundlePath]);
    const text = result.stdout.trim();
    return {
      available: text.includes("<plist"),
      text,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message.replace(/\s+/g, " ").trim() : String(error),
      text: "",
    };
  }
}

function entitlementsBoolean(xml, key) {
  const pattern = new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<true\\s*/>`, "i");
  return pattern.test(xml);
}

function entitlementsString(xml, key) {
  const pattern = new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<string>([^<]+)</string>`, "i");
  return xml.match(pattern)?.[1] || "";
}

function entitlementsArrayIncludes(xml, key, value) {
  const pattern = new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<array>([\\s\\S]*?)</array>`, "i");
  const body = xml.match(pattern)?.[1] || "";
  return new RegExp(`<string>${escapeRegExp(value)}</string>`, "i").test(body);
}

function entitlementsNetworkExtensionIncludes(xml, values) {
  const pattern = /<key>com\.apple\.developer\.networking\.networkextension<\/key>\s*<array>([\s\S]*?)<\/array>/i;
  const body = xml.match(pattern)?.[1] || "";
  return values.some((value) => body.toLowerCase().includes(value.toLowerCase()));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inspectBundle(bundlePath, expected, appGroupId) {
  const info = readPlistJson(path.join(bundlePath, "Info.plist"));
  const entitlements = codesignEntitlementsXml(bundlePath);
  const codesign = codesignDetails(bundlePath);
  const extension = info.NSExtension && typeof info.NSExtension === "object" ? info.NSExtension : {};
  const bundleId = info.CFBundleIdentifier || "";
  const extensionPoint = extension.NSExtensionPointIdentifier || "";
  const principalClass = extension.NSExtensionPrincipalClass || "";

  return {
    appGroupPresent: entitlementsArrayIncludes(entitlements.text, "com.apple.security.application-groups", appGroupId),
    appleDistributionSigned: codesign.appleDistributionSigned,
    bundleId,
    bundleName: path.basename(bundlePath),
    codesignAvailable: codesign.available,
    completeDataProtectionEntitled: entitlementsString(entitlements.text, DATA_PROTECTION_ENTITLEMENT) === COMPLETE_DATA_PROTECTION,
    debugSigned: codesign.debugSigned,
    embedded: true,
    entitlementsAvailable: entitlements.available,
    extensionPoint,
    extensionPointMatches: expected?.extensionPoint ? extensionPoint === expected.extensionPoint : true,
    familyControlsEntitled: entitlementsBoolean(entitlements.text, "com.apple.developer.family-controls"),
    expectedBundleId: expected?.bundleId || DEFAULT_BUNDLE_ID,
    expectedBundleIdMatches: expected?.bundleId ? bundleId === expected.bundleId : bundleId === DEFAULT_BUNDLE_ID,
    expectedExtensionPoint: expected?.extensionPoint || "",
    expectedPrincipalClass: expected?.principalClass || "",
    packetInspectionEntitled: entitlementsNetworkExtensionIncludes(entitlements.text, [
      "app-proxy-provider",
      "content-filter-provider",
      "packet-tunnel-provider",
    ]),
    packetTunnelProviderEntitled: entitlementsNetworkExtensionIncludes(entitlements.text, ["packet-tunnel-provider"]),
    principalClass,
    principalClassMatches: expected?.principalClass ? principalClass === expected.principalClass : true,
    requiresFamilyControls: Boolean(expected?.requiresFamilyControls),
    teamIdentifier: codesign.teamIdentifier,
  };
}

function missingExtension(expected) {
  return {
    appGroupPresent: false,
    appleDistributionSigned: false,
    bundleId: "",
    bundleName: expected.bundleName,
    codesignAvailable: false,
    completeDataProtectionEntitled: false,
    debugSigned: false,
    embedded: false,
    entitlementsAvailable: false,
    extensionPoint: "",
    extensionPointMatches: false,
    familyControlsEntitled: false,
    expectedBundleId: expected.bundleId,
    expectedBundleIdMatches: false,
    expectedExtensionPoint: expected.extensionPoint,
    expectedPrincipalClass: expected.principalClass,
    packetInspectionEntitled: false,
    packetTunnelProviderEntitled: false,
    principalClass: "",
    principalClassMatches: false,
    requiresFamilyControls: Boolean(expected.requiresFamilyControls),
    teamIdentifier: "",
  };
}

function inspectSafariRuleList(extensionPath) {
  const rulePath = path.join(extensionPath, "blockerList.json");
  if (!fs.existsSync(rulePath)) {
    return {
      adultDomainRulesPresent: false,
      allRulesBlock: false,
      available: false,
      missingSignals: SAFARI_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      shortFormRulesPresent: false,
      usableForManualEvidence: false,
    };
  }
  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(rulePath, "utf8"));
  } catch (error) {
    return {
      adultDomainRulesPresent: false,
      allRulesBlock: false,
      available: false,
      error: error instanceof Error ? error.message : String(error),
      missingSignals: SAFARI_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      shortFormRulesPresent: false,
      usableForManualEvidence: false,
    };
  }
  const rows = Array.isArray(rules) ? rules : [];
  const filterText = rows
    .map((rule) => rule?.trigger?.["url-filter"])
    .filter((value) => typeof value === "string")
    .join("\n");
  const ruleSignals = Object.fromEntries(SAFARI_RULE_SIGNALS.map((signal) => [signal.key, signal.pattern.test(filterText)]));
  const missingSignals = Object.entries(ruleSignals)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const allRulesBlock = rows.length > 0 && rows.every((rule) => rule?.action?.type === "block");
  const adultDomainRulesPresent = ruleSignals["adult-domain-pornhub"] === true && ruleSignals["adult-domain-xvideos"] === true;
  const shortFormRulesPresent =
    ruleSignals["youtube-shorts-web"] === true &&
    ruleSignals["instagram-reels-web"] === true &&
    ruleSignals["tiktok-for-you-web"] === true;
  return {
    adultDomainRulesPresent,
    allRulesBlock,
    available: true,
    missingSignals,
    ruleCount: rows.length,
    ruleSignals,
    shortFormRulesPresent,
    usableForManualEvidence: rows.length > 0 && missingSignals.length === 0 && allRulesBlock,
  };
}

function inspectArchive(options) {
  const appPath = path.join(options.archivePath, "Products", "Applications", `${options.scheme}.app`);
  if (!fs.existsSync(appPath)) throw new Error(`Archive did not contain ${options.scheme}.app at ${repoPath(appPath)}`);
  const app = inspectBundle(appPath, { bundleId: options.bundleId }, options.appGroupId);
  const pluginsDir = path.join(appPath, "PlugIns");
  const extensions = EXPECTED_EXTENSIONS.map((expected) => {
    const extensionPath = path.join(pluginsDir, expected.bundleName);
    if (!fs.existsSync(extensionPath)) return missingExtension(expected);
    const inspected = inspectBundle(extensionPath, expected, options.appGroupId);
    return {
      ...inspected,
      ...(expected.requiresSafariRuleList ? { safariRuleList: inspectSafariRuleList(extensionPath) } : {}),
    };
  });
  const allBundles = [app, ...extensions];
  const missingOrMismatchedExtensions = extensions
    .filter(
      (entry) =>
        entry.embedded !== true ||
        entry.expectedBundleIdMatches !== true ||
        entry.extensionPointMatches !== true ||
        entry.principalClassMatches !== true,
    )
    .map((entry) => entry.bundleName);
  const screenTimeExtensions = extensions.filter((entry) => entry.requiresFamilyControls);
  const safari = extensions.find((entry) => entry.bundleName === "FREEDSafariContentBlocker.appex");
  return {
    appBundleIdentifier: app.bundleId,
    appGroupEntitledBundleIds: allBundles.filter((entry) => entry.appGroupPresent).map((entry) => entry.bundleId).filter(Boolean),
    appleDistributionSignedBundleIds: allBundles.filter((entry) => entry.appleDistributionSigned).map((entry) => entry.bundleId).filter(Boolean),
    archivePath: repoPath(options.archivePath),
    bundlePath: repoPath(appPath),
    codesignAvailableBundleIds: allBundles.filter((entry) => entry.codesignAvailable).map((entry) => entry.bundleId).filter(Boolean),
    completeDataProtectionEntitledBundleIds: allBundles
      .filter((entry) => entry.completeDataProtectionEntitled)
      .map((entry) => entry.bundleId)
      .filter(Boolean),
    debugSignedBundleIds: allBundles.filter((entry) => entry.debugSigned).map((entry) => entry.bundleId).filter(Boolean),
    embeddedExtensionBundleIds: extensions.filter((entry) => entry.embedded).map((entry) => entry.bundleId).filter(Boolean),
    embeddedExtensionNames: extensions.filter((entry) => entry.embedded).map((entry) => entry.bundleName),
    extensions,
    familyControlsEntitledBundleIds: [app, ...screenTimeExtensions]
      .filter((entry) => entry.familyControlsEntitled)
      .map((entry) => entry.bundleId)
      .filter(Boolean),
    missingOrMismatchedExtensions,
    packetInspectionEntitled: allBundles.some((entry) => entry.packetInspectionEntitled),
    packetTunnelProviderEntitled: allBundles.some((entry) => entry.packetTunnelProviderEntitled),
    safariRuleList: safari?.safariRuleList || {
      adultDomainRulesPresent: false,
      allRulesBlock: false,
      available: false,
      missingSignals: SAFARI_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      shortFormRulesPresent: false,
      usableForManualEvidence: false,
    },
    signedBundleTeamIds: [...new Set(allBundles.map((entry) => entry.teamIdentifier).filter(Boolean))].sort(),
  };
}

function findExportedIpa(exportPath) {
  if (!fs.existsSync(exportPath)) return "";
  const entries = fs.readdirSync(exportPath, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ipa"))
    .map((entry) => path.join(exportPath, entry.name))
    .sort();
  return candidates[0] || "";
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function inspectIpa(ipaPath) {
  if (!ipaPath || !fs.existsSync(ipaPath)) {
    return {
      embeddedExtensionNames: [],
      exists: false,
      hasPayloadApp: false,
      ipaPath: "",
      sha256: "",
      sizeBytes: 0,
    };
  }
  const { stdout } = runSync("/usr/bin/unzip", ["-l", ipaPath]);
  const expectedNames = EXPECTED_EXTENSIONS.map((entry) => entry.bundleName);
  return {
    embeddedExtensionNames: expectedNames.filter((name) => stdout.includes(`Payload/${DEFAULT_SCHEME}.app/PlugIns/${name}/`)),
    exists: true,
    hasPayloadApp: stdout.includes(`Payload/${DEFAULT_SCHEME}.app/`),
    ipaPath: repoPath(ipaPath),
    sha256: sha256(ipaPath),
    sizeBytes: fs.statSync(ipaPath).size,
  };
}

function summarizeResults(results) {
  return {
    passCount: results.filter((entry) => entry.status === "PASS").length,
    failCount: results.filter((entry) => entry.status === "FAIL").length,
  };
}

function resultStatus(results) {
  return summarizeResults(results).failCount === 0 ? "pass" : "fail";
}

function failureResults(reason) {
  const detail = reason + " This blocker snapshot is not release evidence.";
  return [
    "ios-release-archive-build",
    "ios-release-export",
    "ios-release-signing",
    "ios-release-bundle-id",
    "ios-release-entitlements",
    "ios-release-embedded-extensions",
    "ios-release-safari-content-blocker",
  ].map((id) => ({ id, status: "FAIL", detail }));
}

function sanitizeErrorMessage(error) {
  return sanitizeLocalHomePaths(error instanceof Error ? error.message : String(error))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function argvValue(argv, flag, fallback = "") {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) return argv[index + 1] || "";
    if (arg.startsWith(flag + "=")) return arg.slice(flag.length + 1);
  }
  return fallback;
}

function argvIncludes(argv, flag) {
  return argv.includes(flag);
}

function reportPathFromArgv(argv) {
  const raw = argvValue(argv, "--report", process.env.FREED_IOS_ARCHIVE_REPORT || "");
  if (!raw) return "";
  try {
    return assertSafeReportPath(raw);
  } catch {
    return "";
  }
}

function fallbackFailureOptions(argv) {
  const exportMethod = argvValue(argv, "--export-method", process.env.FREED_IOS_EXPORT_METHOD || DEFAULT_EXPORT_METHOD);
  const codeSignStyle = argvValue(argv, "--code-sign-style", process.env.FREED_IOS_CODE_SIGN_STYLE || "Automatic");
  const teamId = argvValue(argv, "--team-id", process.env.FREED_IOS_DEVELOPMENT_TEAM || process.env.APPLE_TEAM_ID || "");
  return {
    allowProvisioningUpdates:
      truthy(process.env.FREED_IOS_ALLOW_PROVISIONING_UPDATES) || argvIncludes(argv, "--allow-provisioning-updates"),
    bundleId: argvValue(argv, "--bundle-id", process.env.APP_STORE_BUNDLE_ID || process.env.FREED_IOS_BUNDLE_ID || DEFAULT_BUNDLE_ID),
    codeSignStyle,
    configuration: argvValue(argv, "--configuration", process.env.FREED_IOS_ARCHIVE_CONFIGURATION || DEFAULT_CONFIGURATION),
    destination: argvValue(argv, "--destination", process.env.FREED_IOS_ARCHIVE_DESTINATION || DEFAULT_DESTINATION),
    exportMethod,
    logPath: resolvePath(process.env.FREED_IOS_ARCHIVE_LOG || path.join("/tmp", "freed-ios-release-archive-" + timestampLabel() + ".log")),
    requireReleaseSigning:
      truthy(process.env.FREED_REQUIRE_IOS_RELEASE_SIGNING) ||
      truthy(process.env.FREED_IOS_REQUIRE_RELEASE_SIGNING) ||
      argvIncludes(argv, "--require-release-signing"),
    scheme: argvValue(argv, "--scheme", process.env.FREED_IOS_ARCHIVE_SCHEME || DEFAULT_SCHEME),
    sdk: argvValue(argv, "--sdk", process.env.FREED_IOS_ARCHIVE_SDK || DEFAULT_SDK),
    skipExport: argvIncludes(argv, "--skip-export"),
    teamId,
  };
}

function emptyArchiveProof(options) {
  return {
    appBundleIdentifier: "",
    appGroupEntitledBundleIds: [],
    appleDistributionSignedBundleIds: [],
    archivePath: "",
    bundlePath: "",
    codesignAvailableBundleIds: [],
    completeDataProtectionEntitledBundleIds: [],
    debugSignedBundleIds: [],
    embeddedExtensionBundleIds: [],
    embeddedExtensionNames: [],
    extensions: EXPECTED_EXTENSIONS.map(missingExtension),
    familyControlsEntitledBundleIds: [],
    missingOrMismatchedExtensions: EXPECTED_EXTENSIONS.map((entry) => entry.bundleName),
    packetInspectionEntitled: false,
    packetTunnelProviderEntitled: false,
    safariRuleList: {
      adultDomainRulesPresent: false,
      allRulesBlock: false,
      available: false,
      missingSignals: SAFARI_RULE_SIGNALS.map((signal) => signal.key),
      ruleCount: 0,
      shortFormRulesPresent: false,
      usableForManualEvidence: false,
    },
    signedBundleTeamIds: [],
    expectedBundleId: options.bundleId,
  };
}

function emptyIpaProof() {
  return {
    embeddedExtensionNames: [],
    exists: false,
    hasPayloadApp: false,
    ipaPath: "",
    sha256: "",
    sizeBytes: 0,
  };
}

function buildFailureReport(options, exportOptions, phase, error) {
  const message = sanitizeErrorMessage(error);
  const results = failureResults(message || "iOS release archive gate failed before release proof could be inspected.");
  const summary = summarizeResults(results);
  return {
    schemaVersion: "freed-ios-release-archive-report-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    platform: "ios",
    result: "fail",
    archiveResult: "fail",
    exportResult: "fail",
    summary,
    results,
    requested: {
      allowProvisioningUpdates: options.allowProvisioningUpdates,
      bundleId: options.bundleId,
      configuration: options.configuration,
      destination: options.destination,
      requireReleaseSigning: options.requireReleaseSigning,
      scheme: options.scheme,
      sdk: options.sdk,
      skipExport: options.skipExport,
    },
    exportOptions: {
      generated: Boolean(exportOptions?.generated),
      method: options.exportMethod,
      path: repoPath(exportOptions?.path || DEFAULT_EXPORT_OPTIONS_PLIST),
      provisioningProfileBundleIds: exportOptions?.provisioningProfileBundleIds || [],
      signingStyle: String(options.codeSignStyle || "").toLowerCase(),
      teamIdConfigured: Boolean(options.teamId),
    },
    signing: {
      allSignedBundleTeamIdsMatch: false,
      appleDistributionSigned: false,
      debugSigned: false,
      mode: "not-app-store-distribution",
      required: options.requireReleaseSigning,
      teamIdConfigured: Boolean(options.teamId),
    },
    archive: emptyArchiveProof(options),
    ipa: emptyIpaProof(),
    durations: { archiveDurationMs: 0, exportDurationMs: 0 },
    failure: {
      phase,
      message,
    },
    logPath: repoPath(options.logPath),
  };
}

function buildReport(options, exportOptions, archive, ipa, durations) {
  const teamMatches =
    options.teamId &&
    archive.signedBundleTeamIds.length === 1 &&
    archive.signedBundleTeamIds[0] === options.teamId;
  const requiredFamilyBundleIds = [
    options.bundleId,
    ...EXPECTED_EXTENSIONS.filter((entry) => entry.requiresFamilyControls).map((entry) => entry.bundleId),
  ];
  const allRequiredFamilyControlsPresent = requiredFamilyBundleIds.every((id) =>
    archive.familyControlsEntitledBundleIds.includes(id),
  );
  const allRequiredAppGroupsPresent = [options.bundleId, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)].every((id) =>
    archive.appGroupEntitledBundleIds.includes(id),
  );
  const allRequiredDataProtectionPresent = [options.bundleId, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)].every((id) =>
    archive.completeDataProtectionEntitledBundleIds.includes(id),
  );
  const allExtensionsPresent = EXPECTED_EXTENSIONS.every((entry) => archive.embeddedExtensionNames.includes(entry.bundleName));
  const allExpectedIpaExtensionsPresent = EXPECTED_EXTENSIONS.every((entry) => ipa.embeddedExtensionNames.includes(entry.bundleName));
  const signedForDistribution =
    archive.appleDistributionSignedBundleIds.length === 1 + EXPECTED_EXTENSIONS.length &&
    archive.debugSignedBundleIds.length === 0 &&
    teamMatches;
  const results = [
    {
      id: "ios-release-archive-build",
      status: archive.appBundleIdentifier === options.bundleId ? "PASS" : "FAIL",
      detail: "Release archive contains the FREED app bundle with the configured production bundle identifier.",
    },
    {
      id: "ios-release-export",
      status: !options.skipExport && ipa.exists && ipa.hasPayloadApp && allExpectedIpaExtensionsPresent ? "PASS" : "FAIL",
      detail: options.skipExport
        ? "IPA export was skipped; this cannot be used as a TestFlight/App Store artifact."
        : "App Store Connect export produced an IPA containing the app and expected extensions.",
    },
    {
      id: "ios-release-signing",
      status: signedForDistribution ? "PASS" : "FAIL",
      detail: signedForDistribution
        ? "Every app and extension bundle is signed with Apple Distribution for the configured team."
        : "Release archive signing did not prove Apple Distribution signing for every app and extension bundle.",
    },
    {
      id: "ios-release-bundle-id",
      status:
        archive.appBundleIdentifier === options.bundleId &&
        EXPECTED_EXTENSIONS.every((entry) => archive.embeddedExtensionBundleIds.includes(entry.bundleId))
          ? "PASS"
          : "FAIL",
      detail: "Main app and embedded extension bundle identifiers match the store launch identifiers.",
    },
    {
      id: "ios-release-entitlements",
      status:
        allRequiredFamilyControlsPresent &&
        allRequiredAppGroupsPresent &&
        allRequiredDataProtectionPresent &&
        archive.packetInspectionEntitled === false &&
        archive.packetTunnelProviderEntitled === false
          ? "PASS"
          : "FAIL",
      detail:
        "Signed app and extensions include Family Controls where required, shared app group, Complete Data Protection, and no packet tunnel/inspection entitlements.",
    },
    {
      id: "ios-release-embedded-extensions",
      status: allExtensionsPresent && archive.missingOrMismatchedExtensions.length === 0 ? "PASS" : "FAIL",
      detail: "Release archive embeds Shield Configuration, Shield Action, Device Activity Monitor, and Safari Content Blocker extensions.",
    },
    {
      id: "ios-release-safari-content-blocker",
      status: archive.safariRuleList.usableForManualEvidence === true ? "PASS" : "FAIL",
      detail: "Safari Content Blocker includes adult-domain and short-form web block rules with block actions.",
    },
  ];
  const summary = summarizeResults(results);
  return {
    schemaVersion: "freed-ios-release-archive-report-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    platform: "ios",
    result: resultStatus(results),
    archiveResult: archive.appBundleIdentifier === options.bundleId ? "pass" : "fail",
    exportResult: !options.skipExport && ipa.exists && ipa.hasPayloadApp && allExpectedIpaExtensionsPresent ? "pass" : "fail",
    summary,
    results,
    requested: {
      allowProvisioningUpdates: options.allowProvisioningUpdates,
      bundleId: options.bundleId,
      configuration: options.configuration,
      destination: options.destination,
      requireReleaseSigning: options.requireReleaseSigning,
      scheme: options.scheme,
      sdk: options.sdk,
      skipExport: options.skipExport,
    },
    exportOptions: {
      generated: exportOptions.generated,
      method: options.exportMethod,
      path: repoPath(exportOptions.path),
      provisioningProfileBundleIds: exportOptions.provisioningProfileBundleIds,
      signingStyle: options.codeSignStyle.toLowerCase(),
      teamIdConfigured: Boolean(options.teamId),
    },
    signing: {
      allSignedBundleTeamIdsMatch: Boolean(teamMatches),
      appleDistributionSigned: signedForDistribution,
      debugSigned: archive.debugSignedBundleIds.length > 0,
      mode: signedForDistribution ? "app-store-distribution" : "not-app-store-distribution",
      required: options.requireReleaseSigning,
      teamIdConfigured: Boolean(options.teamId),
    },
    archive,
    ipa,
    durations,
    logPath: repoPath(options.logPath),
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function assertReportIsReleaseReady(report) {
  if (report.summary.failCount !== 0) {
    const failed = report.results.filter((entry) => entry.status === "FAIL").map((entry) => entry.id).join(", ");
    throw new Error(`iOS release archive report is not release-ready; failed: ${failed}`);
  }
}

async function runArchive(options, exportOptions) {
  fs.rmSync(options.archivePath, { recursive: true, force: true });
  fs.rmSync(options.exportPath, { recursive: true, force: true });
  const archiveCommand = archiveArgs(options);
  console.log(`Running: ${printableCommand("xcodebuild", archiveCommand)}`);
  console.log(`Log: ${options.logPath}`);
  const archiveRun = await runLogged("xcodebuild", archiveCommand, {
    appendLog: false,
    idleTimeoutMs: options.idleTimeoutMs,
    logPath: options.logPath,
    timeoutMs: options.timeoutMs,
  });

  let exportRun = { durationMs: 0 };
  if (!options.skipExport) {
    const exportCommand = exportArgs(options, exportOptions.path);
    console.log(`Running: ${printableCommand("xcodebuild", exportCommand)}`);
    exportRun = await runLogged("xcodebuild", exportCommand, {
      appendLog: true,
      idleTimeoutMs: options.idleTimeoutMs,
      logPath: options.logPath,
      timeoutMs: options.timeoutMs,
    });
  }
  return {
    archiveDurationMs: archiveRun.durationMs,
    exportDurationMs: exportRun.durationMs,
  };
}

function runDryRun(options, exportOptions) {
  console.log(`Archive: ${printableCommand("xcodebuild", archiveArgs(options))}`);
  if (!options.skipExport) {
    console.log(`Export: ${printableCommand("xcodebuild", exportArgs(options, exportOptions.path))}`);
  }
  console.log(`Export options: ${repoPath(exportOptions.path)}`);
  console.log("Dry run only; no archive, IPA, or release-ready report was produced.");
}

function runSelfTest() {
  const options = parseArgs([
    "--team-id",
    "ABCDE12345",
    "--report",
    "docs/validation/artifacts/ios-archive-self-test/ios-release-archive-report.json",
    "--require-release-signing",
    "--build-setting",
    "OTHER_CODE_SIGN_FLAGS=--timestamp",
  ]);
  assert.equal(options.teamId, "ABCDE12345");
  assert.equal(options.requireReleaseSigning, true);
  assert.ok(archiveArgs(options).includes("DEVELOPMENT_TEAM=ABCDE12345"));
  assert.ok(archiveArgs(options).includes("CODE_SIGN_STYLE=Automatic"));
  assert.ok(archiveArgs(options).includes("OTHER_CODE_SIGN_FLAGS=--timestamp"));
  assert.throws(() => parseArgs(["--require-release-signing", "--team-id", "bad-team"]), /10-character Apple team ID/);
  assert.throws(() => parseArgs(["--code-sign-style", "AdHoc"]), /Automatic or Manual/);
  assert.throws(() => parseArgs(["--build-setting", "ONLY_ACTIVE_ARCH"]), /KEY=VALUE/);
  const provisioning = parseProvisioningProfilesJson(
    JSON.stringify({ "app.freed.recovery": "FREED App Store Profile" }),
  );
  assert.equal(provisioning["app.freed.recovery"], "FREED App Store Profile");
  assert.match(exportOptionsXml(options, provisioning), /app-store-connect/);
  assert.equal(entitlementsBoolean("<key>com.apple.developer.family-controls</key><true/>", "com.apple.developer.family-controls"), true);
  assert.equal(
    entitlementsString(
      "<key>com.apple.developer.default-data-protection</key><string>NSFileProtectionComplete</string>",
      DATA_PROTECTION_ENTITLEMENT,
    ),
    COMPLETE_DATA_PROTECTION,
  );
  assert.equal(
    entitlementsArrayIncludes(
      "<key>com.apple.security.application-groups</key><array><string>group.app.freed.recovery</string></array>",
      "com.apple.security.application-groups",
      DEFAULT_APP_GROUP,
    ),
    true,
  );
  const sampleArchive = {
    appBundleIdentifier: DEFAULT_BUNDLE_ID,
    appGroupEntitledBundleIds: [DEFAULT_BUNDLE_ID, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)],
    appleDistributionSignedBundleIds: [DEFAULT_BUNDLE_ID, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)],
    archivePath: "ios/build/FREED-release.xcarchive",
    bundlePath: "ios/build/FREED-release.xcarchive/Products/Applications/FREED.app",
    codesignAvailableBundleIds: [DEFAULT_BUNDLE_ID, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)],
    completeDataProtectionEntitledBundleIds: [DEFAULT_BUNDLE_ID, ...EXPECTED_EXTENSIONS.map((entry) => entry.bundleId)],
    debugSignedBundleIds: [],
    embeddedExtensionBundleIds: EXPECTED_EXTENSIONS.map((entry) => entry.bundleId),
    embeddedExtensionNames: EXPECTED_EXTENSIONS.map((entry) => entry.bundleName),
    extensions: [],
    familyControlsEntitledBundleIds: [
      DEFAULT_BUNDLE_ID,
      ...EXPECTED_EXTENSIONS.filter((entry) => entry.requiresFamilyControls).map((entry) => entry.bundleId),
    ],
    missingOrMismatchedExtensions: [],
    packetInspectionEntitled: false,
    packetTunnelProviderEntitled: false,
    safariRuleList: {
      adultDomainRulesPresent: true,
      allRulesBlock: true,
      available: true,
      missingSignals: [],
      ruleCount: 5,
      shortFormRulesPresent: true,
      usableForManualEvidence: true,
    },
    signedBundleTeamIds: ["ABCDE12345"],
  };
  const sampleIpa = {
    embeddedExtensionNames: EXPECTED_EXTENSIONS.map((entry) => entry.bundleName),
    exists: true,
    hasPayloadApp: true,
    ipaPath: "ios/build/export/FREED.ipa",
    sha256: "a".repeat(64),
    sizeBytes: 42_000_000,
  };
  const sample = buildReport(
    options,
    { generated: true, path: resolvePath(DEFAULT_EXPORT_OPTIONS_PLIST), provisioningProfileBundleIds: [] },
    sampleArchive,
    sampleIpa,
    { archiveDurationMs: 1, exportDurationMs: 1 },
  );
  assert.equal(sample.schemaVersion, "freed-ios-release-archive-report-v1");
  assert.equal(sample.summary.failCount, 0);
  assert.equal(sample.signing.mode, "app-store-distribution");
  const weak = buildReport(
    options,
    { generated: true, path: resolvePath(DEFAULT_EXPORT_OPTIONS_PLIST), provisioningProfileBundleIds: [] },
    { ...sampleArchive, packetTunnelProviderEntitled: true },
    sampleIpa,
    { archiveDurationMs: 1, exportDurationMs: 1 },
  );
  assert.equal(weak.summary.failCount > 0, true);
  const failure = buildFailureReport(
    options,
    { generated: false, path: resolvePath(DEFAULT_EXPORT_OPTIONS_PLIST), provisioningProfileBundleIds: [] },
    "archive",
    new Error("Signing profile missing at /Users/alice/Library/MobileDevice/Provisioning Profiles/FREED.mobileprovision"),
  );
  assert.equal(failure.schemaVersion, "freed-ios-release-archive-report-v1");
  assert.equal(failure.result, "fail");
  assert.equal(failure.summary.failCount, 7);
  assert.equal(failure.failure.phase, "archive");
  assert.match(failure.failure.message, /~\/Library\/MobileDevice/);
  assert.doesNotMatch(JSON.stringify(failure), /\/Users\/alice/);
  console.log("ios-release-archive self-test: pass");
}

async function main() {
  const argv = process.argv.slice(2);
  let options;
  let exportOptions;
  let phase = "argument-validation";
  let reportWritten = false;
  try {
    options = parseArgs(argv);
    if (options.selfTest) {
      runSelfTest();
      return;
    }
    phase = "export-options";
    exportOptions = ensureExportOptionsPlist(options);
    if (options.dryRun) {
      runDryRun(options, exportOptions);
      return;
    }

    phase = "archive";
    const durations = await runArchive(options, exportOptions);
    phase = "archive-inspection";
    const archive = inspectArchive(options);
    phase = "ipa-inspection";
    const ipa = inspectIpa(options.skipExport ? "" : findExportedIpa(options.exportPath));
    phase = "release-report";
    const report = buildReport(options, exportOptions, archive, ipa, durations);
    if (options.reportPath) {
      writeJson(options.reportPath, report);
      reportWritten = true;
    }
    assertReportIsReleaseReady(report);
    console.log(JSON.stringify({ result: report.result, report: options.reportPath ? repoPath(options.reportPath) : "", ipa: report.ipa.ipaPath }, null, 2));
  } catch (error) {
    const reportPath = options?.reportPath || reportPathFromArgv(argv);
    if (reportPath && !reportWritten) {
      const failureOptions = options || fallbackFailureOptions(argv);
      const failureExportOptions =
        exportOptions || {
          generated: false,
          path: resolvePath(DEFAULT_EXPORT_OPTIONS_PLIST),
          provisioningProfileBundleIds: [],
        };
      writeJson(reportPath, buildFailureReport(failureOptions, failureExportOptions, phase, error));
      console.error("Wrote iOS release archive failure report: " + repoPath(reportPath));
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
