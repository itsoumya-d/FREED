#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveAndroidTool } = require("./lib/android-sdk-tools");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const DEFAULT_APK = path.join("android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const DEFAULT_APP_PACKAGE = "app.freed.recovery";
const DEFAULT_MAIN_ACTIVITY = "app.freed.recovery/.MainActivity";
const DEFAULT_WAIT_MS = 5000;
const DEFAULT_TOOL_TIMEOUT_MS = 30000;
const ADB_COMMAND = resolveAndroidTool("adb");
const ADB_DISPLAY_COMMAND = "adb";
const ANDROID_DEBUG_CERT_SHA256 = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
const SCHEMA_VERSION = "freed-android-install-qa-report-v1";
const PLAN_SCHEMA_VERSION = "freed-android-install-qa-plan-v1";
const ANDROID_PROTECTION_FLOW_ORDER = [
  "android-native-adult-domain-feed",
  "android-dns-guard",
  "android-usage-access",
  "android-accessibility",
  "android-doomscroll-apps",
  "activation-test",
];
const ANDROID_ACTIVATION_READINESS_RULE =
  "Activation is saved only after native status confirms DNS Guard, Usage Access, Accessibility, selected app packages, and the activation test confirms adult domains are blocked while normal browsing is allowed.";

function printHelp() {
  console.log(`Usage: npm run qa:android-install -- [options]

Installs a locally built FREED Android APK on a physical Android device,
launches it, and writes a sanitized install/launch proof report for manual
permission QA. This is not Play Store evidence and does not mark release gates
as passing.

Options:
  --apk <path>              APK path. Default: ${DEFAULT_APK}
  --app-package <package>   Android package. Default: ${DEFAULT_APP_PACKAGE}
  --main-activity <cmp>     Launch component. Default: ${DEFAULT_MAIN_ACTIVITY}
  --device <serial>         adb physical-device serial. Required when multiple
                            physical devices are attached.
  --allow-emulator          Allow emulator target for local smoke only.
  --output-dir <path>       Artifact folder under docs/validation/artifacts.
  --report <path>           Sanitized JSON report path under artifacts.
  --skip-install            Verify/launch an already installed package.
  --skip-launch             Install only; do not launch.
  --wait-ms <ms>            Wait after launch before collecting state.
                            Default: ${DEFAULT_WAIT_MS}
  --tool-timeout-ms <ms>    Per-adb command timeout. Default: ${DEFAULT_TOOL_TIMEOUT_MS}
  --plan-only               Print the resolved plan without adb. When --report
                            is provided, write a non-promotable plan artifact.
  --require-upload-signing  Fail unless the APK signature verifies and is not
                            Android's debug certificate.
  --self-test               Run offline parser and safety checks.
`);
}

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_ANDROID_INSTALL_QA_OUTPUT);
  const options = {
    allowEmulator: process.env.FREED_ANDROID_INSTALL_ALLOW_EMULATOR === "1",
    apk: process.env.FREED_ANDROID_INSTALL_APK || DEFAULT_APK,
    appPackage: process.env.FREED_ANDROID_PACKAGE || DEFAULT_APP_PACKAGE,
    device: process.env.FREED_ANDROID_DEVICE || "",
    mainActivity: process.env.FREED_ANDROID_MAIN_ACTIVITY || DEFAULT_MAIN_ACTIVITY,
    outputDir: process.env.FREED_ANDROID_INSTALL_QA_OUTPUT || "",
    planOnly: false,
    reportPath: process.env.FREED_ANDROID_INSTALL_QA_REPORT || "",
    requireUploadSigning: /^(1|true|yes|on)$/i.test(String(process.env.FREED_ANDROID_INSTALL_REQUIRE_UPLOAD_SIGNING || "").trim()),
    runId,
    selfTest: false,
    skipInstall: false,
    skipLaunch: false,
    toolTimeoutMs: Number(process.env.FREED_ANDROID_INSTALL_TOOL_TIMEOUT_MS || DEFAULT_TOOL_TIMEOUT_MS),
    waitMs: Number(process.env.FREED_ANDROID_INSTALL_WAIT_MS || DEFAULT_WAIT_MS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--allow-emulator") {
      options.allowEmulator = true;
    } else if (arg === "--apk") {
      options.apk = next();
    } else if (arg === "--app-package") {
      options.appPackage = next();
    } else if (arg === "--device") {
      options.device = next();
    } else if (arg === "--main-activity") {
      options.mainActivity = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--require-upload-signing") {
      options.requireUploadSigning = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--skip-install") {
      options.skipInstall = true;
    } else if (arg === "--skip-launch") {
      options.skipLaunch = true;
    } else if (arg === "--tool-timeout-ms") {
      options.toolTimeoutMs = Number(next());
    } else if (arg === "--wait-ms") {
      options.waitMs = Number(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  validateAndroidPackage(options.appPackage, "--app-package");
  validateLaunchComponent(options.mainActivity, "--main-activity");
  if (options.device) validateDeviceSerial(options.device, "--device");
  if (!Number.isInteger(options.toolTimeoutMs) || options.toolTimeoutMs < 1000 || options.toolTimeoutMs > 300000) {
    throw new Error("--tool-timeout-ms must be an integer from 1000 to 300000.");
  }
  if (!Number.isInteger(options.waitMs) || options.waitMs < 0 || options.waitMs > 60000) {
    throw new Error("--wait-ms must be an integer from 0 to 60000.");
  }

  options.apk = resolveWorkspacePath(options.apk, "--apk");
  if (!options.selfTest && !options.skipInstall && !fs.existsSync(options.apk)) {
    throw new Error(`APK does not exist: ${path.relative(process.cwd(), options.apk)}`);
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "android-install-qa");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.reportPath) {
    options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  }
  return options;
}

function resolveWorkspacePath(value, label) {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed !== raw ||
    trimmed.startsWith("-") ||
    trimmed.includes("://") ||
    trimmed.includes("<") ||
    trimmed.includes(">") ||
    /[;&|`$]/.test(trimmed)
  ) {
    throw new Error(`${label} must be a local workspace path without shell syntax, URLs, flags, or template placeholders.`);
  }
  const absolute = path.resolve(process.cwd(), trimmed);
  const relativePath = path.relative(process.cwd(), absolute);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside the current workspace.`);
  }
  if (!trimmed.endsWith(".apk")) {
    throw new Error(`${label} must point to an .apk file.`);
  }
  return absolute;
}

function safeRunId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function validateAndroidPackage(value, label) {
  if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(String(value ?? "").trim())) {
    throw new Error(`${label} must be an Android package name.`);
  }
}

function validateLaunchComponent(value, label) {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_.]+\/(?:\.[A-Za-z0-9_]+|[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)$/.test(normalized)) {
    throw new Error(`${label} must be an Android component such as app.freed.recovery/.MainActivity.`);
  }
}

function validateDeviceSerial(value, label) {
  if (!/^[A-Za-z0-9._:-]+$/.test(String(value ?? "").trim())) {
    throw new Error(`${label} may only contain letters, numbers, dots, dashes, underscores, and colons.`);
  }
}

function adbArgs(options, args) {
  return options.device ? ["-s", options.device, ...args] : args;
}

function run(command, args, options = {}) {
  const displayCommand = options.displayCommand || command;
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options.timeoutMs || DEFAULT_TOOL_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : "";
    throw new Error(`${displayCommand} failed to start${code}`);
  }
  if (result.status !== 0) {
    throw new Error(`${displayCommand} ${args.join(" ")} failed with exit code ${result.status}${output ? `\n${output}` : ""}`);
  }
  return output;
}

function runAdb(options, args) {
  return run(ADB_COMMAND, adbArgs(options, args), { timeoutMs: options.toolTimeoutMs, displayCommand: ADB_DISPLAY_COMMAND });
}

function parseAdbDevices(output) {
  return String(output)
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial = "", state = "", ...rest] = line.split(/\s+/);
      const details = rest.join(" ");
      return {
        serial,
        state,
        details,
        emulator: serial.startsWith("emulator-") || /\bmodel:sdk_|generic|emulator\b/i.test(details),
      };
    })
    .filter((device) => device.serial && device.state);
}

function selectDevice(devices, requestedSerial, allowEmulator) {
  const online = devices.filter((device) => device.state === "device");
  const candidates = allowEmulator ? online : online.filter((device) => !device.emulator);
  if (requestedSerial) {
    const selected = online.find((device) => device.serial === requestedSerial);
    if (!selected) throw new Error(`Requested device ${requestedSerial} is not attached and online.`);
    if (selected.emulator && !allowEmulator) {
      throw new Error(`Requested device ${requestedSerial} looks like an emulator. Use --allow-emulator for local smoke only.`);
    }
    return selected;
  }
  if (candidates.length === 0) {
    throw new Error(allowEmulator ? "No online adb device found." : "No online physical adb device found. Attach hardware or use --allow-emulator for local smoke only.");
  }
  if (candidates.length > 1) {
    throw new Error(`Multiple adb devices found: ${candidates.map((device) => device.serial).join(", ")}. Pass --device <serial>.`);
  }
  return candidates[0];
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function androidSdkCandidates() {
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
  ].filter(Boolean);
}

function numericVersionParts(value) {
  return String(value)
    .split(".")
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareAndroidBuildToolsVersions(left, right) {
  const leftParts = numericVersionParts(left);
  const rightParts = numericVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return String(left).localeCompare(String(right));
}

function resolveApkSigner() {
  const directCandidates = androidSdkCandidates().flatMap((sdkPath) => {
    const buildToolsDir = path.join(sdkPath, "build-tools");
    if (!fs.existsSync(buildToolsDir)) return [];
    return fs
      .readdirSync(buildToolsDir)
      .filter((entry) => fs.existsSync(path.join(buildToolsDir, entry, "apksigner")))
      .sort(compareAndroidBuildToolsVersions)
      .reverse()
      .map((entry) => path.join(buildToolsDir, entry, "apksigner"));
  });
  return [...directCandidates, "/opt/homebrew/bin/apksigner", "/usr/local/bin/apksigner"].find((entry) => fs.existsSync(entry));
}

function normalizeCertificateSha256(value) {
  return String(value || "")
    .replace(/[^a-f0-9]/gi, "")
    .toLowerCase();
}

function boolFromApkSignerLine(stdout, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stdout.match(new RegExp(`${escaped}:\\s+(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : false;
}

function firstApkSignerValue(stdout, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stdout.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : "";
}

function safeReportPath(filePath) {
  if (!filePath) return "";
  const resolved = path.resolve(filePath);
  const workspaceRelative = path.relative(process.cwd(), resolved).replace(/\\/g, "/");
  if (!workspaceRelative.startsWith("..") && !path.isAbsolute(workspaceRelative)) {
    return workspaceRelative || ".";
  }
  const homeRelative = path.relative(os.homedir(), resolved).replace(/\\/g, "/");
  if (!homeRelative.startsWith("..") && !path.isAbsolute(homeRelative)) {
    return homeRelative ? `~/${homeRelative}` : "~";
  }
  return resolved;
}

function parseApkSignatureOutput(stdout, toolPath) {
  const certificateSha256Digest = normalizeCertificateSha256(firstApkSignerValue(stdout, "Signer #1 certificate SHA-256 digest"));
  const certificateDn = firstApkSignerValue(stdout, "Signer #1 certificate DN");
  const numberOfSigners = Number(firstApkSignerValue(stdout, "Number of signers"));
  const keySizeBits = Number(firstApkSignerValue(stdout, "Signer #1 key size (bits)"));
  const verified = /^Verifies$/m.test(stdout);
  const debugSigned = certificateSha256Digest === ANDROID_DEBUG_CERT_SHA256 || /CN=Android Debug\b/i.test(certificateDn);

  return {
    certificateDn,
    certificateSha256Digest,
    checked: true,
    debugSigned,
    keyAlgorithm: firstApkSignerValue(stdout, "Signer #1 key algorithm"),
    keySizeBits: Number.isFinite(keySizeBits) ? keySizeBits : 0,
    numberOfSigners: Number.isFinite(numberOfSigners) ? numberOfSigners : 0,
    sourceStampVerified: boolFromApkSignerLine(stdout, "Verified for SourceStamp"),
    tool: safeReportPath(toolPath),
    v1SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v1 scheme (JAR signing)"),
    v2SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v2 scheme (APK Signature Scheme v2)"),
    v3SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v3 scheme (APK Signature Scheme v3)"),
    v31SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v3.1 scheme (APK Signature Scheme v3.1)"),
    v4SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v4 scheme (APK Signature Scheme v4)"),
    verified,
  };
}

function uncheckedApkSignature(reason) {
  return {
    certificateDn: "",
    certificateSha256Digest: "",
    checked: false,
    debugSigned: false,
    error: sanitizeCommandOutput(reason),
    keyAlgorithm: "",
    keySizeBits: 0,
    numberOfSigners: 0,
    sourceStampVerified: false,
    tool: "",
    v1SchemeVerified: false,
    v2SchemeVerified: false,
    v3SchemeVerified: false,
    v31SchemeVerified: false,
    v4SchemeVerified: false,
    verified: false,
  };
}

function inspectApkSignature(apkPath) {
  const apkSigner = resolveApkSigner();
  if (!apkSigner) return uncheckedApkSignature("Android SDK apksigner was not found.");
  const result = spawnSync(apkSigner, ["verify", "--verbose", "--print-certs", apkPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: DEFAULT_TOOL_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) {
    return uncheckedApkSignature(`${result.error?.message || ""}\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return parseApkSignatureOutput(`${result.stdout || ""}\n${result.stderr || ""}`, apkSigner);
}

function assertUploadSignedApk(signature) {
  if (signature.checked !== true || signature.verified !== true || signature.numberOfSigners <= 0) {
    throw new Error("APK upload signing is required, but the APK signature could not be verified with apksigner.");
  }
  if (signature.debugSigned === true) {
    throw new Error("APK upload signing is required, but the APK is signed with Android's debug certificate.");
  }
}

function parsePackageSummary(output, appPackage) {
  const versionName = output.match(/versionName=([^\s]+)/)?.[1] || "";
  const versionCode = output.match(/versionCode=(\d+)/)?.[1] || "";
  const firstInstallTime = output.match(/firstInstallTime=([^\n]+)/)?.[1]?.trim() || "";
  const lastUpdateTime = output.match(/lastUpdateTime=([^\n]+)/)?.[1]?.trim() || "";
  return {
    appPackage,
    firstInstallTime,
    installed: output.includes(`Package [${appPackage}]`) || output.includes(`Packages:\n  Package [${appPackage}]`),
    lastUpdateTime,
    versionCode,
    versionName,
  };
}

function redactDeviceDetails(value) {
  return String(value ?? "")
    .replace(/\btransport_id:\d+\b/g, "transport_id:<redacted>")
    .replace(/\busb:[^\s]+/g, "usb:<redacted>");
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function shellCommandString(parts) {
  return parts.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function repoRelativePath(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function artifactRootForInstallOutput(outputDir, runId) {
  const relativeOutput = repoRelativePath(outputDir);
  if (relativeOutput.endsWith("/android-install-qa")) {
    return relativeOutput.slice(0, -"/android-install-qa".length);
  }
  return path.join("docs", "validation", "artifacts", runId).replace(/\\/g, "/");
}

function buildProtectionHandoff(options, device) {
  const artifactRoot = artifactRootForInstallOutput(options.outputDir, options.runId);
  const outputDir = `${artifactRoot}/android-real-browser-capture`;
  const permissionWizardReport = `${outputDir}/android-permission-wizard-report.json`;
  const permissionWizardCommand = [
    "npm",
    "run",
    "evidence:permission-wizard",
    "--",
    "--platform",
    "android",
    "--run-id",
    `${options.runId}-permission-wizard`,
    "--report",
    permissionWizardReport,
    "--test-protection-passed",
    "--confirm-common-flow",
    "--confirm-android-flow",
    "--android-selected-app-count",
    "<count>",
  ];
  const command = [
    "npm",
    "run",
    "evidence:android-real-browser",
    "--",
    "--device",
    device?.serial || "<serial>",
    "--adult-url",
    "<real-adult-url>",
    "--permission-proof",
    "--native-status-proof",
    "--dns-guard-proof",
    "--run-id",
    options.runId,
    "--output-dir",
    outputDir,
  ];

  return {
    required: true,
    reason: "Install QA only proves the APK downloads, installs, and launches. Android protection is activation-ready only after this physical-device evidence run proves permission flow, native status, DNS Guard/VPN consent, browser blocking, and normal browsing.",
    activationReadinessRule: ANDROID_ACTIVATION_READINESS_RULE,
    flowOrder: ANDROID_PROTECTION_FLOW_ORDER.join(">"),
    flowOrderSteps: [...ANDROID_PROTECTION_FLOW_ORDER],
    requiredProofFlags: ["--permission-proof", "--native-status-proof", "--dns-guard-proof"],
    outputDir,
    permissionWizardReport,
    permissionWizardCommand,
    permissionWizardCommandString: shellCommandString(permissionWizardCommand),
    command,
    commandString: shellCommandString(command),
  };
}

function buildPlanReport({ options, apk }) {
  const protectionHandoff = buildProtectionHandoff(options, null);
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    sanitized: true,
    generatedAt: new Date().toISOString(),
    runId: options.runId,
    status: "plan-only",
    caveat: "No adb device was used. This plan cannot satisfy android.installQaArtifact or checks.androidInstallLaunchQa=true; run without --plan-only on a physical Android device.",
    apk: {
      path: repoRelativePath(apk.path),
      exists: fs.existsSync(apk.path),
      sha256: apk.sha256,
      signature: apk.signature,
      sizeBytes: apk.sizeBytes,
    },
    requested: {
      allowEmulator: options.allowEmulator,
      appPackage: options.appPackage,
      mainActivity: options.mainActivity,
      requireUploadSigning: options.requireUploadSigning,
      skipInstall: options.skipInstall,
      skipLaunch: options.skipLaunch,
      waitMs: options.waitMs,
    },
    physicalDeviceRequired: true,
    finalInstallQaSchemaVersion: SCHEMA_VERSION,
    installCommand: [
      "npm",
      "run",
      "qa:android-install",
      "--",
      "--device",
      "<serial>",
      "--apk",
      repoRelativePath(apk.path),
      "--run-id",
      options.runId,
      "--output-dir",
      repoRelativePath(options.outputDir),
      ...(options.requireUploadSigning ? ["--require-upload-signing"] : []),
    ],
    installCommandString: shellCommandString([
      "npm",
      "run",
      "qa:android-install",
      "--",
      "--device",
      "<serial>",
      "--apk",
      repoRelativePath(apk.path),
      "--run-id",
      options.runId,
      "--output-dir",
      repoRelativePath(options.outputDir),
      ...(options.requireUploadSigning ? ["--require-upload-signing"] : []),
    ]),
    protectionHandoff,
  };
}

function buildReport({ options, device, apk, packageSummary, installOutput, launchOutput, topActivity, screenshotPath, uiDumpPath, status }) {
  const relativeApk = repoRelativePath(apk.path);
  const launchTopActivityMatchesPackage = options.skipLaunch || topActivity.includes(options.appPackage);
  const installPassed = options.skipInstall || /success/i.test(installOutput || "");
  const launchPassed = options.skipLaunch || (Boolean(launchOutput) && launchTopActivityMatchesPackage);
  const report = {
    schemaVersion: SCHEMA_VERSION,
    sanitized: true,
    generatedAt: new Date().toISOString(),
    runId: options.runId,
    status,
    caveat: "Local Android install QA only. This report does not replace upload-signed Play Console artifacts or physical browser/protection evidence.",
    requested: {
      allowEmulator: options.allowEmulator,
      appPackage: options.appPackage,
      mainActivity: options.mainActivity,
      requireUploadSigning: options.requireUploadSigning,
      skipInstall: options.skipInstall,
      skipLaunch: options.skipLaunch,
      waitMs: options.waitMs,
    },
    apk: {
      path: relativeApk,
      exists: fs.existsSync(apk.path),
      sha256: apk.sha256,
      signature: apk.signature,
      sizeBytes: apk.sizeBytes,
    },
    device: device
      ? {
          serial: device.serial,
          state: device.state,
          emulator: device.emulator,
          details: redactDeviceDetails(device.details),
        }
      : null,
    install: {
      attempted: !options.skipInstall,
      passed: installPassed,
      output: sanitizeCommandOutput(installOutput),
    },
    package: packageSummary,
    launch: {
      attempted: !options.skipLaunch,
      passed: launchPassed,
      output: sanitizeCommandOutput(launchOutput),
      topActivity: sanitizeCommandOutput(topActivity),
      topActivityMatchesPackage: launchTopActivityMatchesPackage,
    },
    artifacts: {
      screenshot: screenshotPath ? repoRelativePath(screenshotPath) : "",
      uiDump: uiDumpPath ? repoRelativePath(uiDumpPath) : "",
    },
    protectionHandoff: buildProtectionHandoff(options, device),
  };
  return {
    ...report,
    status: installPassed && packageSummary.installed && launchPassed ? status : "fail",
  };
}

function sanitizeCommandOutput(value) {
  return String(value ?? "")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "~")
    .replace(/\/Users\/[^/\s]+/g, "~")
    .replace(/\/home\/[^/\s]+/g, "~")
    .trim()
    .slice(0, 4000);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const apk = {
    path: options.apk,
    sha256: options.skipInstall ? "" : sha256File(options.apk),
    signature: options.skipInstall ? uncheckedApkSignature("Skipped install; APK signature was not inspected.") : inspectApkSignature(options.apk),
    sizeBytes: options.skipInstall ? 0 : fs.statSync(options.apk).size,
  };
  if (options.requireUploadSigning) {
    assertUploadSignedApk(apk.signature);
  }
  const plan = {
    apk: path.relative(process.cwd(), options.apk),
    appPackage: options.appPackage,
    mainActivity: options.mainActivity,
    outputDir: options.outputDir,
    protectionHandoff: buildProtectionHandoff(options, null),
    reportPath: options.reportPath ? path.relative(process.cwd(), options.reportPath) : "",
    skipInstall: options.skipInstall,
    skipLaunch: options.skipLaunch,
  };
  if (options.planOnly) {
    const planReport = buildPlanReport({ options, apk });
    if (options.reportPath) {
      writeJson(options.reportPath, planReport);
      console.log(`# FREED Android install QA plan\nResult: plan-only\nReport: ${repoRelativePath(options.reportPath)}`);
    } else {
      console.log(JSON.stringify({ schemaVersion: PLAN_SCHEMA_VERSION, sanitized: true, plan }, null, 2));
    }
    return;
  }

  const devices = parseAdbDevices(run(ADB_COMMAND, ["devices", "-l"], { timeoutMs: options.toolTimeoutMs, displayCommand: ADB_DISPLAY_COMMAND }));
  const device = selectDevice(devices, options.device, options.allowEmulator);
  options.device = device.serial;
  fs.mkdirSync(options.outputDir, { recursive: true });

  const installOutput = options.skipInstall ? "skipped" : runAdb(options, ["install", "-r", "-d", options.apk]);
  const packageOutput = runAdb(options, ["shell", "dumpsys", "package", options.appPackage]);
  const packageSummary = parsePackageSummary(packageOutput, options.appPackage);
  if (!packageSummary.installed) {
    throw new Error(`Package ${options.appPackage} was not found after install.`);
  }

  let launchOutput = "";
  let topActivity = "";
  let screenshotPath = "";
  let uiDumpPath = "";
  if (!options.skipLaunch) {
    launchOutput = runAdb(options, ["shell", "am", "start", "-W", "-n", options.mainActivity]);
    sleep(options.waitMs);
    topActivity = runAdb(options, ["shell", "dumpsys", "activity", "activities"]);
    screenshotPath = path.resolve(options.outputDir, "freed-install-launch.png");
    uiDumpPath = path.resolve(options.outputDir, "freed-install-ui.xml");
    const screenshot = spawnSync(ADB_COMMAND, adbArgs(options, ["exec-out", "screencap", "-p"]), {
      cwd: process.cwd(),
      timeout: options.toolTimeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (screenshot.status === 0 && screenshot.stdout?.length) {
      fs.writeFileSync(screenshotPath, screenshot.stdout);
    } else {
      screenshotPath = "";
    }
    try {
      runAdb(options, ["shell", "uiautomator", "dump", "/sdcard/freed-install-ui.xml"]);
      const xml = runAdb(options, ["exec-out", "cat", "/sdcard/freed-install-ui.xml"]);
      fs.writeFileSync(uiDumpPath, sanitizeCommandOutput(xml));
    } catch {
      uiDumpPath = "";
    }
  }

  const report = buildReport({
    options,
    device,
    apk,
    packageSummary,
    installOutput,
    launchOutput,
    topActivity,
    screenshotPath,
    uiDumpPath,
    status: "pass",
  });
  const reportPath = options.reportPath || path.resolve(options.outputDir, "android-install-qa-report.json");
  writeJson(reportPath, report);
  console.log(`# FREED Android install QA\nResult: ${report.status}\nReport: ${path.relative(process.cwd(), reportPath)}`);
  if (report.status !== "pass") {
    process.exit(1);
  }
}

function runSelfTest() {
  const devices = parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 transport_id:1
R5CT123ABCD device usb:338690048X product:a52 model:SM_A525F device:a52 transport_id:2
RF9T456EFGH device usb:338690049X product:oriole model:Pixel_6 device:oriole transport_id:3
offline-1 offline product:bad model:bad
`);
  assert.equal(devices.length, 4);
  assert.equal(devices[0].emulator, true);
  assert.equal(devices[1].emulator, false);
  assert.equal(selectDevice(devices, "R5CT123ABCD", false).serial, "R5CT123ABCD");
  assert.throws(() => selectDevice(devices, "emulator-5554", false), /emulator/);
  assert.equal(selectDevice(devices, "emulator-5554", true).serial, "emulator-5554");
  assert.throws(() => selectDevice(devices, "", false), /Multiple|No online physical/);
  validateAndroidPackage("app.freed.recovery", "--app-package");
  validateLaunchComponent("app.freed.recovery/.MainActivity", "--main-activity");
  assert.throws(() => validateAndroidPackage("bad package", "--app-package"), /package name/);
  assert.throws(() => validateLaunchComponent("bad", "--main-activity"), /component/);
  assert.throws(() => resolveWorkspacePath("../outside.apk", "--apk"), /workspace/);
  assert.doesNotThrow(() => parseArgs(["--self-test"]));
  assert.throws(() => parseArgs(["--apk", "android/app/build/outputs/apk/release/missing.apk"]), /APK does not exist/);
  assert.throws(
    () => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence/install"]),
    /docs\/validation\/evidence/
  );
  const summary = parsePackageSummary(
    `Package [app.freed.recovery] (123):
      versionCode=1 minSdk=26 targetSdk=36
      versionName=1.0.0
      firstInstallTime=2026-06-06 10:00:00
      lastUpdateTime=2026-06-06 10:10:00`,
    "app.freed.recovery",
  );
  assert.equal(summary.installed, true);
  assert.equal(summary.versionCode, "1");
  assert.equal(summary.versionName, "1.0.0");
  const debugSignature = parseApkSignatureOutput(
    [
      "Verifies",
      "Verified using v1 scheme (JAR signing): false",
      "Verified using v2 scheme (APK Signature Scheme v2): true",
      "Verified using v3 scheme (APK Signature Scheme v3): false",
      "Verified using v3.1 scheme (APK Signature Scheme v3.1): false",
      "Verified using v4 scheme (APK Signature Scheme v4): false",
      "Verified for SourceStamp: false",
      "Number of signers: 1",
      "Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US",
      `Signer #1 certificate SHA-256 digest: ${ANDROID_DEBUG_CERT_SHA256}`,
      "Signer #1 key algorithm: RSA",
      "Signer #1 key size (bits): 2048",
    ].join("\n"),
    "/android-sdk/build-tools/36.0.0/apksigner",
  );
  const uploadSignature = {
    ...debugSignature,
    certificateDn: "CN=FREED Upload, O=FREED Recovery, C=US",
    certificateSha256Digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    debugSigned: false,
  };
  assert.equal(debugSignature.checked, true);
  assert.equal(debugSignature.verified, true);
  assert.equal(debugSignature.debugSigned, true);
  assert.throws(() => assertUploadSignedApk(debugSignature), /debug certificate/);
  assert.doesNotThrow(() => assertUploadSignedApk(uploadSignature));
  const report = buildReport({
    options: {
      allowEmulator: false,
      appPackage: "app.freed.recovery",
      mainActivity: "app.freed.recovery/.MainActivity",
      outputDir: path.resolve(process.cwd(), "docs/validation/artifacts/self-test/android-install-qa"),
      requireUploadSigning: true,
      runId: "self-test",
      skipInstall: false,
      skipLaunch: false,
      waitMs: 1,
    },
    device: devices[1],
    apk: { path: path.resolve(process.cwd(), DEFAULT_APK), sha256: "a".repeat(64), signature: uploadSignature, sizeBytes: 123 },
    packageSummary: summary,
    installOutput: "Success",
    launchOutput: "Status: ok",
    topActivity: "mResumedActivity: ActivityRecord{ app.freed.recovery/.MainActivity }",
    screenshotPath: path.resolve(process.cwd(), "docs/validation/artifacts/self-test/freed-install-launch.png"),
    uiDumpPath: path.resolve(process.cwd(), "docs/validation/artifacts/self-test/freed-install-ui.xml"),
    status: "pass",
  });
  assert.equal(report.schemaVersion, SCHEMA_VERSION);
  assert.equal(report.sanitized, true);
  assert.equal(report.status, "pass");
  assert.equal(report.requested.requireUploadSigning, true);
  assert.equal(report.apk.signature.debugSigned, false);
  assert.equal(report.apk.signature.verified, true);
  assert.equal(report.install.passed, true);
  assert.equal(report.package.installed, true);
  assert.equal(report.launch.topActivityMatchesPackage, true);
  assert.equal(report.device.details.includes("transport_id:2"), false);
  assert.equal(report.protectionHandoff.required, true);
  assert.match(report.protectionHandoff.activationReadinessRule, /adult domains are blocked while normal browsing is allowed/);
  assert.equal(
    report.protectionHandoff.flowOrder,
    "android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test",
  );
  assert.deepEqual(report.protectionHandoff.flowOrderSteps, [
    "android-native-adult-domain-feed",
    "android-dns-guard",
    "android-usage-access",
    "android-accessibility",
    "android-doomscroll-apps",
    "activation-test",
  ]);
  assert.equal(report.protectionHandoff.outputDir, "docs/validation/artifacts/self-test/android-real-browser-capture");
  assert.equal(
    report.protectionHandoff.permissionWizardReport,
    "docs/validation/artifacts/self-test/android-real-browser-capture/android-permission-wizard-report.json",
  );
  assert.ok(report.protectionHandoff.permissionWizardCommand.includes("evidence:permission-wizard"));
  assert.match(report.protectionHandoff.permissionWizardCommandString, /--platform android/);
  assert.match(report.protectionHandoff.permissionWizardCommandString, /--test-protection-passed/);
  assert.match(report.protectionHandoff.permissionWizardCommandString, /--confirm-android-flow/);
  assert.ok(report.protectionHandoff.command.includes("evidence:android-real-browser"));
  assert.ok(report.protectionHandoff.command.includes("--permission-proof"));
  assert.ok(report.protectionHandoff.command.includes("--native-status-proof"));
  assert.ok(report.protectionHandoff.command.includes("--dns-guard-proof"));
  assert.match(report.protectionHandoff.commandString, /--device R5CT123ABCD --adult-url <real-adult-url>/);
  const failedReport = buildReport({
    options: {
      allowEmulator: false,
      appPackage: "app.freed.recovery",
      mainActivity: "app.freed.recovery/.MainActivity",
      outputDir: path.resolve(process.cwd(), "docs/validation/artifacts/self-test/android-install-qa"),
      requireUploadSigning: false,
      runId: "self-test",
      skipInstall: false,
      skipLaunch: false,
      waitMs: 1,
    },
    device: devices[1],
    apk: { path: path.resolve(process.cwd(), DEFAULT_APK), sha256: "a".repeat(64), signature: debugSignature, sizeBytes: 123 },
    packageSummary: summary,
    installOutput: "Success",
    launchOutput: "Status: ok",
    topActivity: "mResumedActivity: ActivityRecord{ com.android.settings/.Settings }",
    screenshotPath: "",
    uiDumpPath: "",
    status: "pass",
  });
  assert.equal(failedReport.status, "fail");
  assert.equal(failedReport.launch.topActivityMatchesPackage, false);
  const planReport = buildPlanReport({
    options: {
      allowEmulator: false,
      appPackage: "app.freed.recovery",
      mainActivity: "app.freed.recovery/.MainActivity",
      outputDir: path.resolve(process.cwd(), "docs/validation/artifacts/self-test/android-install-qa"),
      requireUploadSigning: true,
      runId: "self-test",
      skipInstall: false,
      skipLaunch: false,
      waitMs: 1,
    },
    apk: { path: path.resolve(process.cwd(), DEFAULT_APK), sha256: "a".repeat(64), signature: uploadSignature, sizeBytes: 123 },
  });
  assert.equal(planReport.schemaVersion, PLAN_SCHEMA_VERSION);
  assert.equal(planReport.status, "plan-only");
  assert.equal(planReport.physicalDeviceRequired, true);
  assert.equal(planReport.finalInstallQaSchemaVersion, SCHEMA_VERSION);
  assert.equal(planReport.requested.requireUploadSigning, true);
  assert.equal(planReport.apk.signature.debugSigned, false);
  assert.match(planReport.caveat, /cannot satisfy android\.installQaArtifact/);
  assert.ok(planReport.installCommand.includes("--device"));
  assert.ok(planReport.installCommand.includes("--apk"));
  assert.ok(planReport.installCommand.includes("--require-upload-signing"));
  assert.match(planReport.installCommandString, /npm run qa:android-install -- --device <serial> --apk/);
  assert.match(planReport.installCommandString, /--require-upload-signing/);
  assert.equal(planReport.protectionHandoff.required, true);
  console.log("android install qa self-test: pass");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
