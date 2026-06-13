#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const DEFAULT_APK = path.join(
  "docs",
  "validation",
  "artifacts",
  "continue-goal-android-current-artifacts",
  "apk",
  "FREED-release-universal.apk",
);
const DEFAULT_ARTIFACT_ROOT = path.join("docs", "validation", "artifacts");
const DEFAULT_ANDROID_BUILD_FAILURE_REPORT = path.join(
  "docs",
  "validation",
  "artifacts",
  "continue-goal-android-current-artifacts",
  "android-qa-universal-apk-build-failure-report.json",
);
const ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES = Object.freeze([
  path.join("docs", "validation", "artifacts", "android-current-apk-toolchain-retry", "android-apk-build-report.json"),
  path.join("docs", "validation", "artifacts", "android-current-apk-retry", "android-apk-build-report.json"),
  DEFAULT_ANDROID_BUILD_FAILURE_REPORT,
  path.join(
    "docs",
    "validation",
    "artifacts",
    "continue-goal-android-current-artifacts",
    "android-qa-arm64-apk-alt-toolchain-build-report.json",
  ),
]);
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 8787;
const FLOW_ORDER = [
  "adult feed sync",
  "DNS Guard / VPN consent",
  "Usage Access",
  "Accessibility consent",
  "blocked-app package config",
  "activation test",
];
const RECOVERY_NOTIFICATION_PROMPT_TITLE = "Recovery Notifications";
const RECOVERY_NOTIFICATION_PROMPT_TEXT =
  "On Android 13+, FREED asks for the runtime notification prompt in-app first, then opens Android app notification settings only if the permission remains denied. This is optional for activation but required for DNS Guard visible recovery-handoff evidence.";
const APK_USE_BOUNDARY = {
  classification: "Side-load QA APK",
  installReadyLabel: "Downloadable for local Android side-load QA",
  localUse:
    "Use this artifact to prove the current FREED build can be downloaded, installed, launched, and routed through Android setup on a physical QA phone.",
  storeReadyLabel: "Not Play upload evidence",
  blockedUse:
    "Do not submit this artifact to Google Play. Store upload still requires an upload-signed AAB/APK, production AdMob app id, release env preflight, and store sandbox evidence.",
  uploadSignedArtifactCommand:
    "npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-aab-build-report.json",
};
const SAME_DEVICE_EVIDENCE_SEQUENCE = [
  {
    step: "Install QA report",
    proof:
      "Run install QA against this exact APK SHA-256 on the physical Android device, proving package install, launch/top-activity, screenshot/UI dump, and no crash loop.",
  },
  {
    step: "Permission wizard",
    proof:
      "Run the Android permission wizard report after install, confirming the same setup order and the selected blocked-app count before activation is promoted.",
  },
  {
    step: "Real-browser evidence",
    proof:
      "Run Android real-browser evidence on the same device with permission, native-status, and DNS Guard proof so adult-block and normal-allow checks share one device context.",
  },
];
const INSTALL_TROUBLESHOOTING = [
  {
    issue: "Phone cannot open the QR target",
    action:
      "Keep the Android phone and this Mac on the same Wi-Fi, turn off phone VPN or cellular-only browsing, then try the alternate LAN URL shown on the page.",
    evidence: "Live check still passes from the Mac and the phone screenshot shows the attempted LAN URL.",
  },
  {
    issue: "Browser blocks the APK download",
    action:
      "Use Chrome or the default browser, keep the filename unchanged, accept the one-time Android download warning, and do not rename the APK.",
    evidence: "Downloaded file name and SHA-256 match the handoff.",
  },
  {
    issue: "Install unknown apps prompt appears",
    action:
      "Tap Settings, enable Allow from this source for the browser that downloaded the APK, press Back, and resume the same install.",
    evidence: "Install QA notes show the browser-specific install-from-this-source permission was granted by the user.",
  },
  {
    issue: "App not installed or package conflicts",
    action:
      "Uninstall the previous local FREED build for app.freed.recovery, then install this APK again from the completed download.",
    evidence: "Install QA report shows app.freed.recovery was freshly installed and launched.",
  },
  {
    issue: "Install fails because storage is low",
    action:
      "Free storage, delete partial FREED APK downloads, download again from the QR target, and verify the hash before install evidence is captured.",
    evidence: "Install QA report uses the current APK hash from this handoff.",
  },
];
const QR_CODE_CAPACITIES = [
  { version: 1, dataCodewords: 19, eccCodewords: 7 },
  { version: 2, dataCodewords: 34, eccCodewords: 10 },
  { version: 3, dataCodewords: 55, eccCodewords: 15 },
  { version: 4, dataCodewords: 80, eccCodewords: 20 },
];

function printHelp() {
  console.log(`Usage: npm run qa:android-download -- [options]

Serves a single local FREED Android QA APK over HTTP for same-network phone
download testing. This is a local side-load QA helper only; it does not produce
Play Console artifacts or release evidence. The server prints a QR code and
serves /qr.svg so the Android phone can open the download page without typing
the LAN URL.

Options:
  --apk <path>       APK path inside this workspace.
                     Default: ${DEFAULT_APK}
  --latest           Serve the newest FREED-release*.apk under
                     ${DEFAULT_ARTIFACT_ROOT}.
  --host <host>      Host/interface to bind. Default: ${DEFAULT_HOST}
  --port <port>      HTTP port. Default: ${DEFAULT_PORT}
  --run-id <id>      QA run id used in generated follow-up commands.
  --report <path>    Optional sanitized JSON report under docs/validation/artifacts.
  --metadata-only    Write/print metadata and exit without starting the server.
  --self-test        Run offline helper checks.
`);
}

function parseArgs(argv) {
  const defaultRunId = `android-download-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const options = {
    apk: process.env.FREED_ANDROID_DOWNLOAD_APK || DEFAULT_APK,
    host: process.env.FREED_ANDROID_DOWNLOAD_HOST || DEFAULT_HOST,
    latest: String(process.env.FREED_ANDROID_DOWNLOAD_APK || "").trim().toLowerCase() === "latest",
    metadataOnly: false,
    port: Number(process.env.FREED_ANDROID_DOWNLOAD_PORT || DEFAULT_PORT),
    reportPath: process.env.FREED_ANDROID_DOWNLOAD_REPORT || "",
    runId: process.env.FREED_ANDROID_DOWNLOAD_RUN_ID || defaultRunId,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--apk") {
      options.apk = next();
      options.latest = String(options.apk).trim().toLowerCase() === "latest";
    } else if (arg === "--latest") {
      options.apk = "latest";
      options.latest = true;
    } else if (arg === "--host") {
      options.host = next();
    } else if (arg === "--port") {
      options.port = Number(next());
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg === "--metadata-only") {
      options.metadataOnly = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.runId = safeRunId(options.runId);
  if (options.reportPath) options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  if (!options.selfTest) {
    options.apk = options.latest ? resolveLatestWorkspaceApk() : resolveWorkspaceApkPath(options.apk);
    if (!fs.existsSync(options.apk)) {
      throw new Error(`APK does not exist: ${repoRelativePath(options.apk)}`);
    }
  }
  validateHost(options.host);
  validatePort(options.port);
  return options;
}

function safeRunId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function collectLatestApkCandidates(searchRoot) {
  const candidates = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile() && /^FREED-release.*\.apk$/.test(entry.name)) {
        const stat = fs.statSync(absolute);
        candidates.push({
          mtimeMs: stat.mtimeMs,
          path: absolute,
          size: stat.size,
        });
      }
    }
  };
  visit(searchRoot);
  return candidates.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs - left.mtimeMs;
    if (right.size !== left.size) return right.size - left.size;
    return repoRelativePath(left.path).localeCompare(repoRelativePath(right.path));
  });
}

function resolveLatestWorkspaceApk() {
  const artifactRoot = path.resolve(process.cwd(), DEFAULT_ARTIFACT_ROOT);
  const relativeRoot = path.relative(process.cwd(), artifactRoot);
  if (relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
    throw new Error("Latest APK search root must stay inside the current workspace.");
  }
  const latest = collectLatestApkCandidates(artifactRoot)[0];
  if (!latest) {
    throw new Error(
      `No FREED-release*.apk files found under ${DEFAULT_ARTIFACT_ROOT}. Build a universal QA APK first with npm run build:android-apk -- --arch all --engine hermes --output-dir ${DEFAULT_ARTIFACT_ROOT}/continue-goal-android-current-artifacts/apk --stable-name FREED-release-universal.apk --report ${DEFAULT_ARTIFACT_ROOT}/continue-goal-android-current-artifacts/android-qa-universal-apk-build-report.json`,
    );
  }
  return latest.path;
}

function resolveWorkspaceApkPath(value) {
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
    throw new Error("--apk must be a local workspace path without shell syntax, URLs, flags, or placeholders.");
  }
  if (!trimmed.endsWith(".apk")) {
    throw new Error("--apk must point to an .apk file.");
  }
  const absolute = path.resolve(process.cwd(), trimmed);
  const relative = path.relative(process.cwd(), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--apk must stay inside the current workspace.");
  }
  return absolute;
}

function validateHost(value) {
  const host = String(value ?? "").trim();
  if (!host || host !== String(value) || host.includes("/") || host.includes(":") || /[;&|`$<>\s]/.test(host)) {
    throw new Error("--host must be a plain IPv4/IPv6/interface hostname without shell syntax.");
  }
}

function validatePort(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error("--port must be an integer from 1024 to 65535.");
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function repoRelativePath(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function safeFilename(filePath) {
  return path.basename(filePath).replace(/[^A-Za-z0-9._-]/g, "_");
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInstallTroubleshootingHtml() {
  return INSTALL_TROUBLESHOOTING.map(
    (item) =>
      `<li><strong>${htmlEscape(item.issue)}:</strong> ${htmlEscape(item.action)} <em>Evidence:</em> ${htmlEscape(item.evidence)}</li>`,
  ).join("");
}

function renderInstallTroubleshootingMarkdown() {
  return INSTALL_TROUBLESHOOTING.map(
    (item) => `- ${item.issue}: ${item.action} Evidence: ${item.evidence}`,
  ).join("\n");
}

function renderInstallTroubleshootingRows() {
  return INSTALL_TROUBLESHOOTING.map(
    (item) => `| ${item.issue} | ${item.action} | ${item.evidence} |`,
  ).join("\n");
}

function renderSameDeviceEvidenceHtml(steps) {
  return steps
    .map((item) => `<li><strong>${htmlEscape(item.step)}:</strong> ${htmlEscape(item.proof)}</li>`)
    .join("");
}

function renderSameDeviceEvidenceMarkdown(steps) {
  return steps.map((item) => `- ${item.step}: ${item.proof}`).join("\n");
}

function renderSameDeviceEvidenceRows(steps) {
  return steps.map((item) => `| ${item.step} | ${item.proof} |`).join("\n");
}

function currentBuildStatusOrDefault(metadata) {
  return metadata.currentBuildStatus || {
    apkModifiedAt: "",
    candidateArtifacts: [...ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES],
    cmakeExit137: false,
    failedTask: "",
    reportArtifact: DEFAULT_ANDROID_BUILD_FAILURE_REPORT,
    reportExists: false,
    reportGeneratedAt: "",
    newArchForcedByReactNative: false,
    newArchRequested: null,
    result: "not-checked",
    staleDownloadWarning: false,
    summary:
      "No newer failed current Android rebuild report is available for this APK handoff. This still remains a local side-load QA artifact only.",
  };
}

function renderCurrentBuildStatusHtml(metadata) {
  const status = currentBuildStatusOrDefault(metadata);
  const failedTask = status.failedTask ? `<dt>Failed task</dt><dd><code>${htmlEscape(status.failedTask)}</code></dd>` : "";
  const diagnostics =
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `<dt>CMake exit 137</dt><dd>${status.cmakeExit137 ? "true" : "false"}</dd>
        <dt>Host memory constrained</dt><dd>${status.hostMemoryConstrainedLikely ? `true (${htmlEscape(String(status.hostTotalMemoryMb || "unknown"))} MB)` : "false"}</dd>
        <dt>React Native forced New Architecture</dt><dd>${status.newArchForcedByReactNative ? "true" : "false"}</dd>
        <dt>New Architecture requested</dt><dd>${htmlEscape(
          status.newArchRequested === null || status.newArchRequested === undefined
            ? "unknown"
            : String(status.newArchRequested),
        )}</dd>`
      : "";
  return `<section class="panel warning" aria-label="Current Android build status">
      <h2>Current Android Build Status</h2>
      <p>${htmlEscape(status.summary)}</p>
      <dl>
        <dt>Status</dt><dd>${htmlEscape(status.result)}</dd>
        <dt>Stale warning</dt><dd>${status.staleDownloadWarning ? "true" : "false"}</dd>
        <dt>APK modified</dt><dd>${htmlEscape(status.apkModifiedAt || "unknown")}</dd>
        <dt>Failure report</dt><dd><code>${htmlEscape(status.reportArtifact || DEFAULT_ANDROID_BUILD_FAILURE_REPORT)}</code></dd>
        <dt>Report generated</dt><dd>${htmlEscape(status.reportGeneratedAt || "not available")}</dd>
        ${failedTask}
        ${diagnostics}
      </dl>
    </section>`;
}

function renderCurrentBuildStatusMarkdown(metadata) {
  const status = currentBuildStatusOrDefault(metadata);
  return [
    "## Current Android Build Status",
    "",
    `- Status: ${status.result}`,
    `- Stale warning: ${status.staleDownloadWarning ? "true" : "false"}`,
    `- Summary: ${status.summary}`,
    `- APK modified: ${status.apkModifiedAt || "unknown"}`,
    `- Failure report: \`${status.reportArtifact || DEFAULT_ANDROID_BUILD_FAILURE_REPORT}\``,
    `- Report generated: ${status.reportGeneratedAt || "not available"}`,
    status.failedTask ? `- Failed task: \`${status.failedTask}\`` : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `- CMake exit 137: ${status.cmakeExit137 ? "true" : "false"}`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `- Host memory constrained: ${status.hostMemoryConstrainedLikely ? `true (${status.hostTotalMemoryMb || "unknown"} MB)` : "false"}`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `- React Native forced New Architecture: ${status.newArchForcedByReactNative ? "true" : "false"}`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `- New Architecture requested: ${
          status.newArchRequested === null || status.newArchRequested === undefined
            ? "unknown"
            : String(status.newArchRequested)
        }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderCurrentBuildStatusRows(metadata) {
  const status = currentBuildStatusOrDefault(metadata);
  return [
    `| Status | ${status.result} |`,
    `| Stale warning | ${status.staleDownloadWarning ? "true" : "false"} |`,
    `| Summary | ${status.summary} |`,
    `| APK modified | ${status.apkModifiedAt || "unknown"} |`,
    `| Failure report | \`${status.reportArtifact || DEFAULT_ANDROID_BUILD_FAILURE_REPORT}\` |`,
    `| Report generated | ${status.reportGeneratedAt || "not available"} |`,
    status.failedTask ? `| Failed task | \`${status.failedTask}\` |` : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `| CMake exit 137 | ${status.cmakeExit137 ? "true" : "false"} |`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `| Host memory constrained | ${status.hostMemoryConstrainedLikely ? `true (${status.hostTotalMemoryMb || "unknown"} MB)` : "false"} |`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `| React Native forced New Architecture | ${status.newArchForcedByReactNative ? "true" : "false"} |`
      : "",
    status.staleDownloadWarning || status.cmakeExit137 || status.newArchForcedByReactNative
      ? `| New Architecture requested | ${
          status.newArchRequested === null || status.newArchRequested === undefined
            ? "unknown"
            : String(status.newArchRequested)
        } |`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function collectLanHosts(host) {
  const hosts = new Set();
  if (host && host !== "0.0.0.0" && host !== "::") hosts.add(host);
  hosts.add("127.0.0.1");
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && entry.address) {
        hosts.add(entry.address);
      }
    }
  }
  return [...hosts];
}

function chooseQrTargetUrl(lanUrls) {
  return lanUrls.find((url) => !url.includes("127.0.0.1") && !url.includes("localhost")) || lanUrls[0] || "";
}

function parseReportTime(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readJsonIfExists(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return { exists: false, value: null };
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(absolutePath, "utf8")) };
  } catch {
    return { exists: true, value: null };
  }
}

function selectLatestFailedAndroidBuildReport(candidates = ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES) {
  const failedReports = candidates
    .map((artifact) => ({
      artifact,
      ...readJsonIfExists(artifact),
    }))
    .filter((entry) => entry.exists && entry.value?.result === "fail");
  failedReports.sort((left, right) =>
    String(right.value?.generatedAt || "").localeCompare(String(left.value?.generatedAt || "")),
  );
  return (
    failedReports[0] || {
      artifact: candidates[0] || DEFAULT_ANDROID_BUILD_FAILURE_REPORT,
      exists: false,
      value: null,
    }
  );
}

function extractBuildFailureReason(report) {
  return [
    report?.releaseBoundary?.reason || "",
    ...(Array.isArray(report?.results) ? report.results.map((result) => result.detail || "") : []),
  ].join("\n");
}

function extractFailedTask(report) {
  const diagnostics = report?.diagnostics && typeof report.diagnostics === "object" ? report.diagnostics : {};
  if (typeof diagnostics.failedTask === "string" && diagnostics.failedTask.trim()) {
    return diagnostics.failedTask.trim();
  }
  const text = extractBuildFailureReason(report);
  return text.match(/Execution failed for task '([^']+)'/)?.[1] || text.match(/task '([^']+)'/)?.[1] || "";
}

function summarizeCurrentAndroidBuildStatus(
  apkPath,
  reportCandidates = ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES,
) {
  const apkStat = fs.statSync(apkPath);
  const apkModifiedAt = new Date(apkStat.mtimeMs).toISOString();
  const read = selectLatestFailedAndroidBuildReport(reportCandidates);
  if (!read.exists || !read.value) {
    return {
      apkModifiedAt,
      candidateArtifacts: [...reportCandidates],
      cmakeExit137: false,
      failedTask: "",
      hostMemoryConstrainedLikely: false,
      hostTotalMemoryMb: null,
      reportArtifact: read.artifact,
      reportExists: read.exists,
      reportGeneratedAt: "",
      newArchForcedByReactNative: false,
      newArchRequested: null,
      result: "not-checked",
      staleDownloadWarning: false,
      summary:
        "No newer failed current Android rebuild report is available for this APK handoff. This still remains a local side-load QA artifact only.",
    };
  }
  const report = read.value;
  const reportGeneratedAt = report.generatedAt || "";
  const reportGeneratedAtMs = parseReportTime(reportGeneratedAt);
  const staleDownloadWarning =
    report.result === "fail" &&
    reportGeneratedAtMs !== null &&
    reportGeneratedAtMs > apkStat.mtimeMs;
  const reason = extractBuildFailureReason(report);
  const diagnostics = report.diagnostics && typeof report.diagnostics === "object" ? report.diagnostics : {};
  const cmakeExit137 =
    diagnostics.cmakeExit137 === true ||
    /exit value 137|exits? 137|exit code 137|CMake.*137|cmake.*137/i.test(reason);
  const newArchForcedByReactNative =
    diagnostics.reactNativeNewArchForced === true ||
    /not supported anymore since React Native 0\.82|New Architecture enabled by default/i.test(reason);
  return {
    apkModifiedAt,
    buildResult: report.buildResult || "",
    candidateArtifacts: [...reportCandidates],
    cmakeExit137,
    failedStage: report.failedStage || "",
    failedTask: extractFailedTask(report),
    hostMemoryConstrainedLikely: diagnostics.hostMemoryConstrainedLikely === true,
    hostTotalMemoryMb: Number.isFinite(diagnostics.hostTotalMemoryMb) ? diagnostics.hostTotalMemoryMb : null,
    reportArtifact: read.artifact,
    reportExists: true,
    reportGeneratedAt,
    newArchForcedByReactNative,
    newArchRequested:
      report.requested && Object.prototype.hasOwnProperty.call(report.requested, "newArchEnabled")
        ? report.requested.newArchEnabled
        : null,
    result: staleDownloadWarning ? "stale-apk-newer-rebuild-failed" : "no-newer-failed-rebuild",
    staleDownloadWarning,
    summary: staleDownloadWarning
      ? "A newer current Android rebuild failed after this APK was produced. Use this download only for legacy side-load QA, not as proof of the latest native code."
      : "No newer failed current Android rebuild was detected after this APK was produced. This still remains a local side-load QA artifact only.",
  };
}

function buildMetadata({ apkPath, host, port, reportPath, runId }) {
  const stat = fs.statSync(apkPath);
  const filename = safeFilename(apkPath);
  const apkRelativePath = repoRelativePath(apkPath);
  const lanUrls = collectLanHosts(host).map((address) => `http://${address}:${port}/`);
  const qrTargetUrl = chooseQrTargetUrl(lanUrls);
  const installQaOutputDir = `docs/validation/artifacts/${runId}/android-install-qa`;
  const installQaPlanArtifact = `${installQaOutputDir}/android-install-qa-plan.json`;
  const browserEvidenceOutputDir = `docs/validation/artifacts/${runId}/android-real-browser-capture`;
  const permissionWizardArtifact = `${browserEvidenceOutputDir}/android-permission-wizard-report.json`;
  const deviceDiscoveryRunId = "android-device-discovery-current";
  const deviceDiscoveryOutputDir = `docs/validation/artifacts/${deviceDiscoveryRunId}`;
  const liveCheckArtifact = `docs/validation/artifacts/${runId}/android-apk-download-live-check.json`;
  const ensureArtifact = `docs/validation/artifacts/${runId}/android-apk-download-ensure.json`;
  return {
    schemaVersion: "freed-android-apk-download-handoff-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    runId,
    apk: {
      filename,
      path: apkRelativePath,
      sha256: sha256File(apkPath),
      sizeBytes: stat.size,
      sizeLabel: formatBytes(stat.size),
    },
    currentBuildStatus: summarizeCurrentAndroidBuildStatus(apkPath),
    apkUseBoundary: {
      ...APK_USE_BOUNDARY,
      localQaDownloadReady: true,
      sameDeviceEvidenceRequired: true,
      storeSubmissionReady: false,
    },
    server: {
      host,
      port,
      lanUrls,
      downloadPath: `/download/${encodeURIComponent(filename)}`,
      metadataPath: "/metadata.json",
      qrPath: "/qr.svg",
      qrTargetUrl,
    },
    report: reportPath ? repoRelativePath(reportPath) : "",
    qaHandoff: {
      deviceDiscoveryCommand: `npm run evidence:android-devices -- --run-id ${deviceDiscoveryRunId} --output-dir ${deviceDiscoveryOutputDir}`,
      deviceDiscoveryArtifact: `${deviceDiscoveryOutputDir}/android-device-discovery.json`,
      deviceDiscoveryOutputDir,
      downloadServerCommand: `npm run qa:android-download -- --apk ${apkRelativePath} --host ${host} --port ${port} --run-id ${runId}`,
      liveCheckArtifact,
      liveCheckCommand: `npm run qa:android-download:live-check -- --handoff docs/validation/artifacts/${runId}/android-apk-download-handoff.json --report ${liveCheckArtifact}`,
      ensureArtifact,
      ensureCommand: `npm run qa:android-download:ensure -- --handoff docs/validation/artifacts/${runId}/android-apk-download-handoff.json --live-check-report ${liveCheckArtifact} --report ${ensureArtifact} --start-if-needed`,
      installQaPlanArtifact,
      installQaPlanCommand: `npm run qa:android-install -- --plan-only --apk ${apkRelativePath} --run-id ${runId} --output-dir ${installQaOutputDir} --report ${installQaPlanArtifact}`,
      installQaCommand: `npm run qa:android-install -- --apk ${apkRelativePath} --run-id ${runId} --output-dir ${installQaOutputDir}`,
      permissionWizardArtifact,
      permissionWizardCommand: `npm run evidence:permission-wizard -- --platform android --run-id ${runId}-permission-wizard --report ${permissionWizardArtifact} --test-protection-passed --confirm-common-flow --confirm-android-flow --android-selected-app-count <count>`,
      protectionEvidenceCommand: `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id ${runId} --output-dir ${browserEvidenceOutputDir}`,
      installQaOutputDir,
      browserEvidenceOutputDir,
      evidenceBoundary:
        "This download handoff proves only the selected APK, hash, local download route, and follow-up commands. It does not prove install, permission consent, browser blocking, or Play readiness.",
    },
    releaseBoundary:
      "Local Android side-load QA only. This page does not produce Play Console artifacts, upload signing proof, or physical-device release evidence.",
    protectionFlowOrder: [...FLOW_ORDER],
    sameDeviceEvidenceSequence: SAME_DEVICE_EVIDENCE_SEQUENCE.map((item) => ({ ...item })),
    recoveryNotificationPrompt: {
      title: RECOVERY_NOTIFICATION_PROMPT_TITLE,
      text: RECOVERY_NOTIFICATION_PROMPT_TEXT,
      reportArtifact: `${browserEvidenceOutputDir}/android-notification-permission-report.json`,
      evidenceFields: [
        "android.notificationPermissionArtifact",
        "android.notificationPermissionRequired=true",
        "android.notificationPermissionGranted=true",
        "android.notificationRuntimePromptShown=true",
        "android.notificationSettingsFallbackOpenedIfDenied=true",
      ],
    },
  };
}

function qrBitBufferForText(text, dataCodewords) {
  const bytes = [...Buffer.from(text, "utf8")];
  if (bytes.length > 255) throw new Error("QR target is too long.");
  const bits = [];
  const appendBits = (value, length) => {
    for (let bit = length - 1; bit >= 0; bit -= 1) {
      bits.push((value >>> bit) & 1);
    }
  };
  appendBits(0x4, 4);
  appendBits(bytes.length, 8);
  for (const byte of bytes) appendBits(byte, 8);
  const capacityBits = dataCodewords * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < dataCodewords; pad = pad === 0xec ? 0x11 : 0xec) {
    data.push(pad);
  }
  return data;
}

function gfTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
  return { exp, log };
}

const QR_GF = gfTables();

function gfMultiply(left, right) {
  if (left === 0 || right === 0) return 0;
  return QR_GF.exp[QR_GF.log[left] + QR_GF.log[right]];
}

function reedSolomonGenerator(degree) {
  let coefficients = [1];
  for (let degreeIndex = 0; degreeIndex < degree; degreeIndex += 1) {
    const next = new Array(coefficients.length + 1).fill(0);
    for (let index = 0; index < coefficients.length; index += 1) {
      next[index] ^= coefficients[index];
      next[index + 1] ^= gfMultiply(coefficients[index], QR_GF.exp[degreeIndex]);
    }
    coefficients = next;
  }
  return coefficients;
}

function reedSolomonRemainder(data, degree) {
  const generator = reedSolomonGenerator(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }
  return result;
}

function getQrFormatBits(mask) {
  const data = (0b01 << 3) | mask;
  let bits = data << 10;
  const generator = 0x537;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((bits >>> bit) & 1) !== 0) bits ^= generator << (bit - 10);
  }
  return ((data << 10) | bits) ^ 0x5412;
}

function makeQrMatrix(text) {
  const textLength = Buffer.byteLength(text, "utf8");
  const spec = QR_CODE_CAPACITIES.find((entry) => textLength + 2 <= entry.dataCodewords);
  if (!spec) throw new Error("QR target URL is too long for the offline QR helper.");
  const size = 17 + spec.version * 4;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (row, col, dark) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row][col] = Boolean(dark);
    isFunction[row][col] = true;
  };
  const placeFinder = (row, col) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const rr = row + dy;
        const cc = col + dx;
        const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inFinder && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setFunction(rr, cc, dark);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);
  for (let index = 0; index < size; index += 1) {
    if (!isFunction[6][index]) setFunction(6, index, index % 2 === 0);
    if (!isFunction[index][6]) setFunction(index, 6, index % 2 === 0);
  }
  if (spec.version >= 2) {
    const center = size - 7;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(center + dy, center + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  setFunction(4 * spec.version + 9, 8, true);
  for (let index = 0; index < 8; index += 1) setFunction(size - 1 - index, 8, false);
  for (let index = 0; index < 8; index += 1) setFunction(8, size - 1 - index, false);
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setFunction(8, index, false);
      setFunction(index, 8, false);
    }
  }

  const data = qrBitBufferForText(text, spec.dataCodewords);
  const codewords = [...data, ...reedSolomonRemainder(data, spec.eccCodewords)];
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (!isFunction[row][col]) {
          let dark = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
          bitIndex += 1;
          if ((row + col) % 2 === 0) dark = !dark;
          modules[row][col] = dark;
        }
      }
    }
    upward = !upward;
  }

  const format = getQrFormatBits(0);
  const formatBit = (index) => ((format >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) setFunction(8, index, formatBit(index));
  setFunction(8, 7, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(7, 8, formatBit(8));
  for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, formatBit(index));
  for (let index = 0; index < 8; index += 1) setFunction(size - 1 - index, 8, formatBit(index));
  for (let index = 8; index < 15; index += 1) setFunction(8, size - 15 + index, formatBit(index));
  setFunction(4 * spec.version + 9, 8, true);

  return modules;
}

function renderQrSvg(text) {
  const modules = makeQrMatrix(text);
  const quiet = 4;
  const size = modules.length + quiet * 2;
  const cells = [];
  modules.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (dark) cells.push(`M${colIndex + quiet},${rowIndex + quiet}h1v1h-1z`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${htmlEscape(text)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${cells.join("")}" fill="#111"/></svg>`;
}

function renderTerminalQr(text) {
  const modules = makeQrMatrix(text);
  const quiet = 2;
  const white = "\u001b[47m  \u001b[0m";
  const black = "\u001b[40m  \u001b[0m";
  const rows = [];
  for (let row = -quiet; row < modules.length + quiet; row += 1) {
    let line = "";
    for (let col = -quiet; col < modules.length + quiet; col += 1) {
      line += modules[row]?.[col] ? black : white;
    }
    rows.push(line);
  }
  return rows.join("\n");
}

function renderPage(metadata) {
  const apk = metadata.apk;
  const downloadPath = metadata.server.downloadPath;
  const metadataPath = metadata.server.metadataPath;
  const qrPath = metadata.server.qrPath;
  const qrTargetUrl = metadata.server.qrTargetUrl;
  const alternateUrls = metadata.server.lanUrls.filter((url) => url !== qrTargetUrl);
  const urls = alternateUrls
    .map((url) => `<li><code>${htmlEscape(url)}</code></li>`)
    .join("");
  const alternateUrlList = urls ? `<p>Alternate local URLs:</p><ul>${urls}</ul>` : "";
  const flow = metadata.protectionFlowOrder.map((step) => `<li>${htmlEscape(step)}</li>`).join("");
  const sameDeviceEvidence = renderSameDeviceEvidenceHtml(metadata.sameDeviceEvidenceSequence || []);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FREED Android QA Download</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f4ee; color: #171614; }
    main { max-width: 760px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 32px; line-height: 1.1; margin: 0 0 12px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 28px 0 10px; letter-spacing: 0; }
    p { line-height: 1.55; }
    a.button { display: inline-flex; align-items: center; min-height: 48px; padding: 0 18px; border-radius: 6px; background: #174f46; color: white; text-decoration: none; font-weight: 700; }
    code { overflow-wrap: anywhere; }
    img.qr { width: min(260px, 100%); image-rendering: pixelated; border: 12px solid white; background: white; }
    .panel { border: 1px solid #d9d1c4; border-radius: 8px; padding: 16px; background: #fffaf2; }
    .warning { border-color: #b7682b; background: #fff4e6; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #d9d1c4; border-radius: 6px; padding: 12px; background: #f3ede3; }
    dl { display: grid; grid-template-columns: minmax(120px, 180px) 1fr; gap: 8px 14px; }
    dt { font-weight: 700; }
    dd { margin: 0; overflow-wrap: anywhere; }
    li { margin: 8px 0; line-height: 1.45; }
    @media (prefers-color-scheme: dark) {
      body { background: #16130f; color: #f5efe4; }
      .panel { background: #211d17; border-color: #4a4035; }
      .warning { background: #2c2115; border-color: #a96123; }
      pre { background: #17130f; border-color: #4a4035; }
      a.button { background: #68c8b4; color: #081513; }
    }
  </style>
</head>
<body>
  <main>
    <h1>FREED Android QA Download</h1>
    <p>Open this page on the Android phone that will be used for local side-load QA, then download the APK below.</p>
    <p><a class="button" href="${htmlEscape(downloadPath)}" download="${htmlEscape(apk.filename)}">Download APK</a></p>

    <section class="panel warning" aria-label="Release boundary">
      <h2>Local QA Boundary</h2>
      <p>${htmlEscape(metadata.releaseBoundary)}</p>
      <p>Android may ask you to allow installs from this browser. That OS permission cannot be granted silently; allow it, return here, and continue the install.</p>
      <p>After install, FREED routes directly to each required Android setup screen, refreshes native status when you return, and advances to the next missing step until activation can be tested.</p>
      <p>Before counting the APK as install-tested, connect the phone with USB debugging and run device discovery from the development machine.</p>
    </section>

    ${renderCurrentBuildStatusHtml(metadata)}

    <section class="panel warning" aria-label="APK use boundary">
      <h2>APK Use Boundary</h2>
      <dl>
        <dt>Artifact class</dt><dd>${htmlEscape(metadata.apkUseBoundary.classification)}</dd>
        <dt>Local install</dt><dd>${htmlEscape(metadata.apkUseBoundary.installReadyLabel)}</dd>
        <dt>Store upload</dt><dd>${htmlEscape(metadata.apkUseBoundary.storeReadyLabel)}</dd>
      </dl>
      <p>${htmlEscape(metadata.apkUseBoundary.localUse)}</p>
      <p>${htmlEscape(metadata.apkUseBoundary.blockedUse)}</p>
      <p>Store artifact command:</p>
      <pre>${htmlEscape(metadata.apkUseBoundary.uploadSignedArtifactCommand)}</pre>
    </section>

    <section class="panel" aria-label="Install troubleshooting">
      <h2>Install Troubleshooting</h2>
      <ul>${renderInstallTroubleshootingHtml()}</ul>
    </section>

    <section class="panel" aria-label="APK details">
      <h2>APK Details</h2>
      <dl>
        <dt>Filename</dt><dd>${htmlEscape(apk.filename)}</dd>
        <dt>Size</dt><dd>${htmlEscape(apk.sizeLabel)} (${apk.sizeBytes} bytes)</dd>
        <dt>SHA-256</dt><dd><code>sha256-${htmlEscape(apk.sha256)}</code></dd>
      </dl>
    </section>

    <section class="panel" aria-label="Phone URLs">
      <h2>Open On Phone</h2>
      <p>Scan this QR code from the Android phone, or use one of these URLs from a phone on the same network:</p>
      <p><img class="qr" src="${htmlEscape(qrPath)}" alt="QR code for ${htmlEscape(qrTargetUrl)}"></p>
      <p>QR target: <code>${htmlEscape(qrTargetUrl)}</code></p>
      ${alternateUrlList}
    </section>

    <section class="panel" aria-label="Support routes">
      <h2>Support Routes</h2>
      <p>Use these local routes to confirm the page, QR, metadata, and APK are all from the same handoff before installing.</p>
      <ul>
        <li>Download route: <a href="${htmlEscape(downloadPath)}" download="${htmlEscape(apk.filename)}"><code>${htmlEscape(downloadPath)}</code></a></li>
        <li>Metadata route: <a href="${htmlEscape(metadataPath)}"><code>${htmlEscape(metadataPath)}</code></a></li>
        <li>QR SVG route: <a href="${htmlEscape(qrPath)}"><code>${htmlEscape(qrPath)}</code></a></li>
      </ul>
      <p>The live check must pass for the page route, metadata route, QR route, and APK route before phone-side install QA begins.</p>
    </section>

    <section class="panel" aria-label="Protection flow">
      <h2>After Install</h2>
      <ol>${flow}</ol>
      <p>Activation should only be treated as ready after native status and the adult-block plus normal-allow test pass on the same physical device.</p>
      <h2>Same-Device Evidence Sequence</h2>
      <ul>${sameDeviceEvidence}</ul>
      <h2>${htmlEscape(metadata.recoveryNotificationPrompt.title)}</h2>
      <p>${htmlEscape(metadata.recoveryNotificationPrompt.text)}</p>
      <p>The permission-proof helper writes <code>${htmlEscape(metadata.recoveryNotificationPrompt.reportArtifact)}</code> for the runtime prompt, native required/granted status, and settings fallback proof.</p>
      <h2>QA Commands</h2>
      <p>After downloading, use these commands from the development machine to capture install and protection evidence:</p>
      <pre>${htmlEscape(metadata.qaHandoff.ensureCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.liveCheckCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.deviceDiscoveryCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.installQaPlanCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.installQaCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.permissionWizardCommand)}</pre>
      <pre>${htmlEscape(metadata.qaHandoff.protectionEvidenceCommand)}</pre>
    </section>
  </main>
</body>
</html>`;
}

function buildDownloadHandoffMarkdown(metadata) {
  const flow = metadata.protectionFlowOrder.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return `# FREED Android QA Download Handoff

Generated by \`scripts/android-apk-download-server.js\` at ${metadata.generatedAt}.

## APK

- Path: \`${metadata.apk.path}\`
- Filename: \`${metadata.apk.filename}\`
- Size: ${metadata.apk.sizeLabel} (${metadata.apk.sizeBytes} bytes)
- SHA-256: \`${metadata.apk.sha256}\`

${renderCurrentBuildStatusMarkdown(metadata)}

## APK Use Boundary

- Artifact class: ${metadata.apkUseBoundary.classification}
- Local install: ${metadata.apkUseBoundary.installReadyLabel}
- Store upload: ${metadata.apkUseBoundary.storeReadyLabel}
- Local use: ${metadata.apkUseBoundary.localUse}
- Blocked use: ${metadata.apkUseBoundary.blockedUse}
- Store artifact command:

\`\`\`sh
${metadata.apkUseBoundary.uploadSignedArtifactCommand}
\`\`\`

## Phone Download

- QR target URL: \`${metadata.server.qrTargetUrl}\`
- QR SVG: \`ANDROID_APK_DOWNLOAD_QR.svg\`
- Start download server:

\`\`\`sh
${metadata.qaHandoff.downloadServerCommand}
\`\`\`

Android may ask the user to allow installs from the browser that opens this page. FREED cannot silently grant that OS permission; allow it in Android Settings, return to the install, then continue setup.

## Install Troubleshooting

${renderInstallTroubleshootingMarkdown()}

## After Install

FREED should route directly to each required Android setup screen, refresh native status when the user returns, auto-advance to the next missing step, and save activation only after native status plus adult-block and normal-allow activation checks pass.

${flow}

## Same-Device Evidence Sequence

${renderSameDeviceEvidenceMarkdown(metadata.sameDeviceEvidenceSequence || [])}

## Recovery Notifications

${metadata.recoveryNotificationPrompt.text}

- Report artifact: \`${metadata.recoveryNotificationPrompt.reportArtifact}\`
- Evidence fields: ${metadata.recoveryNotificationPrompt.evidenceFields.map((field) => `\`${field}\``).join(", ")}

## QA Commands

Refresh Android device discovery:

\`\`\`sh
${metadata.qaHandoff.deviceDiscoveryCommand}
\`\`\`

Verify the download server is live:

\`\`\`sh
${metadata.qaHandoff.liveCheckCommand}
\`\`\`

Ensure the download server is live, starting it if needed:

\`\`\`sh
${metadata.qaHandoff.ensureCommand}
\`\`\`

Write the non-promotable install QA plan before a physical device is available:

\`\`\`sh
${metadata.qaHandoff.installQaPlanCommand}
\`\`\`

Install and launch evidence:

\`\`\`sh
${metadata.qaHandoff.installQaCommand}
\`\`\`

Protection evidence:

\`\`\`sh
${metadata.qaHandoff.permissionWizardCommand}
\`\`\`

\`\`\`sh
${metadata.qaHandoff.protectionEvidenceCommand}
\`\`\`

## Boundaries

- Release boundary: ${metadata.releaseBoundary}
- Evidence boundary: ${metadata.qaHandoff.evidenceBoundary}

Do not use this side-load handoff as Play Console, upload-signing, or physical-device release evidence.
`;
}

function buildPhysicalQaChecklistMarkdown(metadata) {
  const flowRows = metadata.protectionFlowOrder
    .map((step, index) => `| ${index + 1} | ${step} | App returns from the exact OS/native surface, refreshes native status, and advances only when this step reports ready. |`)
    .join("\n");
  const sameDeviceRows = renderSameDeviceEvidenceRows(metadata.sameDeviceEvidenceSequence || []);
  return `# FREED Android Physical QA Checklist

Generated by \`scripts/android-apk-download-server.js\` at ${metadata.generatedAt}.

Use this checklist on the Android phone that scans \`${metadata.server.qrTargetUrl}\`. It is for local side-load and permission-flow QA only.

## Download And Install

| Check | Expected result | Evidence |
| --- | --- | --- |
| Phone opens the QR target from the same network | FREED Android QA Download page loads and the APK button is visible. | Screenshot or install QA report note |
| APK download starts from \`${metadata.server.downloadPath}\` | Browser downloads \`${metadata.apk.filename}\` without changing the expected SHA-256. | APK hash \`${metadata.apk.sha256}\` |
| Android unknown-app install permission appears if needed | User is sent to Android's install-from-this-source setting, grants it, returns, and resumes install. FREED does not claim this can be granted silently. | Install QA report |
| FREED installs and launches | Package opens to onboarding/setup, not a blank screen or crash loop. | \`freed-android-install-qa-report-v1\` |

## APK Use Boundary

| Boundary | Value |
| --- | --- |
${renderCurrentBuildStatusRows(metadata)}
| Artifact class | ${metadata.apkUseBoundary.classification} |
| Local install | ${metadata.apkUseBoundary.installReadyLabel} |
| Store upload | ${metadata.apkUseBoundary.storeReadyLabel} |
| Local use | ${metadata.apkUseBoundary.localUse} |
| Blocked use | ${metadata.apkUseBoundary.blockedUse} |
| Store artifact command | \`${metadata.apkUseBoundary.uploadSignedArtifactCommand}\` |

## Install Troubleshooting

| Failure case | Recovery action | Evidence |
| --- | --- | --- |
${renderInstallTroubleshootingRows()}

## Permission Redirect Flow

| Order | Required step | Pass condition |
| --- | --- | --- |
${flowRows}

Activation must stay pending until native status and test protection agree that adult domains are blocked while normal browsing is allowed.

## Same-Device Evidence Sequence

| Step | Proof |
| --- | --- |
${sameDeviceRows}

## Recovery Notifications

${metadata.recoveryNotificationPrompt.text}

| Check | Expected result | Evidence |
| --- | --- | --- |
| Android 13+ runtime notification prompt | FREED asks in-app first from the optional recovery-notification row. | \`${metadata.recoveryNotificationPrompt.reportArtifact}\` |
| Settings fallback only if denied | FREED opens Android app notification settings only after Android still reports notification permission denied. | \`android.notificationSettingsFallbackOpenedIfDenied=true\` |
| Native status after return | Profile/native status shows \`androidNotificationPermissionRequired\` and \`androidNotificationPermissionGranted\`. | Native status screenshot plus \`android.notificationPermissionGranted=true\` |

## Evidence Commands

Run install QA on a physical Android device:

\`\`\`sh
${metadata.qaHandoff.deviceDiscoveryCommand}
\`\`\`

Verify the download page and APK route are live:

\`\`\`sh
${metadata.qaHandoff.liveCheckCommand}
\`\`\`

Ensure the download page and APK route are live, starting the local server if needed:

\`\`\`sh
${metadata.qaHandoff.ensureCommand}
\`\`\`

Write the non-promotable install QA plan before a physical device is available:

\`\`\`sh
${metadata.qaHandoff.installQaPlanCommand}
\`\`\`

\`\`\`sh
${metadata.qaHandoff.installQaCommand}
\`\`\`

Then run protection evidence on the same device:

\`\`\`sh
${metadata.qaHandoff.permissionWizardCommand}
\`\`\`

\`\`\`sh
${metadata.qaHandoff.protectionEvidenceCommand}
\`\`\`

The final Android evidence still needs a real device serial, a real adult URL or host, Accessibility/Usage Access diagnostics, DNS Guard/VPN consent proof, native status proof, browser block proof, and normal browsing allow proof.

## Do Not Count As Release Evidence

- This side-load packet does not prove Play Console readiness.
- This side-load packet does not prove upload-signed AAB production readiness.
- This side-load packet does not prove Android permissions were granted or protection actually blocked anything.
- This side-load packet does not replace \`docs/validation/evidence/android-real-browser.json\`.

Release boundary: ${metadata.releaseBoundary}
Evidence boundary: ${metadata.qaHandoff.evidenceBoundary}
`;
}

function sendText(res, statusCode, body, contentType, method = "GET") {
  const payload = Buffer.from(body);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": payload.length,
    "Content-Type": contentType,
  });
  if (method !== "HEAD") res.end(payload);
  else res.end();
}

function createServer({ apkPath, metadata }) {
  const filename = metadata.apk.filename;
  return http.createServer((req, res) => {
    const method = req.method || "GET";
    if (!["GET", "HEAD"].includes(method)) {
      sendText(res, 405, "Method not allowed\n", "text/plain; charset=utf-8", method);
      return;
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
      sendText(res, 200, renderPage(metadata), "text/html; charset=utf-8", method);
      return;
    }
    if (requestUrl.pathname === "/metadata.json") {
      sendText(res, 200, `${JSON.stringify(metadata, null, 2)}\n`, "application/json; charset=utf-8", method);
      return;
    }
    if (requestUrl.pathname === "/qr.svg") {
      sendText(res, 200, `${renderQrSvg(metadata.server.qrTargetUrl)}\n`, "image/svg+xml; charset=utf-8", method);
      return;
    }
    if (requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    if (requestUrl.pathname === `/download/${encodeURIComponent(filename)}` || requestUrl.pathname === `/download/${filename}`) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stat.size,
        "Content-Type": "application/vnd.android.package-archive",
      });
      if (method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(apkPath).pipe(res);
      return;
    }
    sendText(res, 404, "Not found\n", "text/plain; charset=utf-8", method);
  });
}

function writeReport(reportPath, metadata) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

function writeCompanionArtifacts(reportPath, metadata) {
  if (!reportPath) return {};
  const outputDir = path.dirname(path.resolve(process.cwd(), reportPath));
  const handoffPath = path.join(outputDir, "ANDROID_APK_DOWNLOAD_HANDOFF.md");
  const physicalQaChecklistPath = path.join(outputDir, "ANDROID_PHYSICAL_QA_CHECKLIST.md");
  const qrSvgPath = path.join(outputDir, "ANDROID_APK_DOWNLOAD_QR.svg");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(handoffPath, buildDownloadHandoffMarkdown(metadata));
  fs.writeFileSync(physicalQaChecklistPath, buildPhysicalQaChecklistMarkdown(metadata));
  fs.writeFileSync(qrSvgPath, `${renderQrSvg(metadata.server.qrTargetUrl)}\n`);
  return {
    handoffMarkdown: repoRelativePath(handoffPath),
    physicalQaChecklist: repoRelativePath(physicalQaChecklistPath),
    qrSvg: repoRelativePath(qrSvgPath),
  };
}

function runSelfTest() {
  assert.equal(formatBytes(59098510), "56.4 MB");
  assert.equal(safeFilename("../FREED release.apk"), "FREED_release.apk");
  assert.equal(htmlEscape("<FREED & \"QA\">"), "&lt;FREED &amp; &quot;QA&quot;&gt;");
  assert.equal(safeRunId("android-download-1"), "android-download-1");
  assert.throws(() => safeRunId("../bad"), /Run id/);
  assert.throws(() => validatePort(80), /--port/);
  assert.throws(() => validateHost("127.0.0.1;open"), /--host/);
  assert.throws(() => parseArgs(["--self-test", "--report", "docs/validation/evidence/download.json"]), /docs\/validation\/evidence/);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-apk-latest-"));
  try {
    const oldDir = path.join(tempRoot, "old", "apk");
    const newDir = path.join(tempRoot, "new", "apk");
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    const oldApk = path.join(oldDir, "FREED-release-arm64.apk");
    const newApk = path.join(newDir, "FREED-release-arm64-20990101-010101.apk");
    fs.writeFileSync(oldApk, "old");
    fs.writeFileSync(newApk, "newer");
    fs.writeFileSync(path.join(newDir, "not-freed.apk"), "ignored");
    fs.utimesSync(oldApk, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
    fs.utimesSync(newApk, new Date("2026-01-02T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z"));
    assert.equal(collectLatestApkCandidates(tempRoot)[0].path, newApk);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
  const statusRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-apk-status-"));
  try {
    const statusApk = path.join(statusRoot, "FREED-release-universal.apk");
    const oldReport = path.join(statusRoot, "old-build-report.json");
    const newReport = path.join(statusRoot, "new-build-report.json");
    fs.writeFileSync(statusApk, "apk");
    fs.utimesSync(statusApk, new Date("2026-06-10T00:00:00.000Z"), new Date("2026-06-10T00:00:00.000Z"));
    fs.writeFileSync(
      oldReport,
      JSON.stringify({
        generatedAt: "2026-06-10T01:00:00.000Z",
        result: "fail",
        results: [{ detail: "Execution failed for task ':app:assembleRelease'." }],
      }),
    );
    fs.writeFileSync(
      newReport,
      JSON.stringify({
        diagnostics: {
          cmakeExit137: true,
          failedTask: ":app:configureCMakeRelWithDebInfo[arm64-v8a]",
          reactNativeNewArchForced: true,
        },
        generatedAt: "2026-06-11T01:00:00.000Z",
        requested: { newArchEnabled: false },
        result: "fail",
        results: [
          {
            detail:
              "Setting `newArchEnabled=false` is not supported anymore since React Native 0.82. CMake failed with exit code 137.",
          },
        ],
      }),
    );
    const status = summarizeCurrentAndroidBuildStatus(statusApk, [oldReport, newReport]);
    assert.equal(status.reportArtifact, newReport);
    assert.equal(status.result, "stale-apk-newer-rebuild-failed");
    assert.equal(status.staleDownloadWarning, true);
    assert.equal(status.cmakeExit137, true);
    assert.equal(status.newArchForcedByReactNative, true);
    assert.equal(status.newArchRequested, false);
    assert.equal(status.failedTask, ":app:configureCMakeRelWithDebInfo[arm64-v8a]");
  } finally {
    fs.rmSync(statusRoot, { force: true, recursive: true });
  }
  const metadata = {
    generatedAt: "2026-06-08T00:00:00.000Z",
    apk: {
      filename: "FREED-release-arm64.apk",
      path: "docs/validation/artifacts/example/FREED-release-arm64.apk",
      sha256: "a".repeat(64),
      sizeBytes: 59098510,
      sizeLabel: "56.4 MB",
    },
    currentBuildStatus: {
      apkModifiedAt: "2026-06-07T00:00:00.000Z",
      failedTask: ":app:configureCMakeRelWithDebInfo[arm64-v8a]",
      reportArtifact:
        "docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-universal-apk-build-failure-report.json",
      reportExists: true,
      reportGeneratedAt: "2026-06-08T00:00:00.000Z",
      result: "stale-apk-newer-rebuild-failed",
      staleDownloadWarning: true,
      summary:
        "A newer current Android rebuild failed after this APK was produced. Use this download only for legacy side-load QA, not as proof of the latest native code.",
    },
    apkUseBoundary: {
      ...APK_USE_BOUNDARY,
      localQaDownloadReady: true,
      sameDeviceEvidenceRequired: true,
      storeSubmissionReady: false,
    },
    server: {
      downloadPath: "/download/FREED-release-arm64.apk",
      lanUrls: ["http://127.0.0.1:8787/", "http://192.168.1.7:8787/"],
      metadataPath: "/metadata.json",
      qrPath: "/qr.svg",
      qrTargetUrl: "http://127.0.0.1:8787/",
    },
    qaHandoff: {
      deviceDiscoveryCommand:
        "npm run evidence:android-devices -- --run-id android-device-discovery-current --output-dir docs/validation/artifacts/android-device-discovery-current",
      deviceDiscoveryArtifact: "docs/validation/artifacts/android-device-discovery-current/android-device-discovery.json",
      deviceDiscoveryOutputDir: "docs/validation/artifacts/android-device-discovery-current",
      downloadServerCommand:
        "npm run qa:android-download -- --apk docs/validation/artifacts/example/FREED-release-arm64.apk --run-id android-download-self-test",
      liveCheckArtifact: "docs/validation/artifacts/android-download-self-test/android-apk-download-live-check.json",
      liveCheckCommand:
        "npm run qa:android-download:live-check -- --handoff docs/validation/artifacts/android-download-self-test/android-apk-download-handoff.json --report docs/validation/artifacts/android-download-self-test/android-apk-download-live-check.json",
      ensureArtifact: "docs/validation/artifacts/android-download-self-test/android-apk-download-ensure.json",
      ensureCommand:
        "npm run qa:android-download:ensure -- --handoff docs/validation/artifacts/android-download-self-test/android-apk-download-handoff.json --live-check-report docs/validation/artifacts/android-download-self-test/android-apk-download-live-check.json --report docs/validation/artifacts/android-download-self-test/android-apk-download-ensure.json --start-if-needed",
      evidenceBoundary: "This download handoff proves only the selected APK, hash, local download route, and follow-up commands.",
      installQaPlanArtifact: "docs/validation/artifacts/android-download-self-test/android-install-qa/android-install-qa-plan.json",
      installQaPlanCommand:
        "npm run qa:android-install -- --plan-only --apk docs/validation/artifacts/example/FREED-release-arm64.apk --run-id android-download-self-test --output-dir docs/validation/artifacts/android-download-self-test/android-install-qa --report docs/validation/artifacts/android-download-self-test/android-install-qa/android-install-qa-plan.json",
      installQaCommand: "npm run qa:android-install -- --apk docs/validation/artifacts/example/FREED-release-arm64.apk --run-id android-download-self-test --output-dir docs/validation/artifacts/android-download-self-test/android-install-qa",
      permissionWizardArtifact:
        "docs/validation/artifacts/android-download-self-test/android-real-browser-capture/android-permission-wizard-report.json",
      permissionWizardCommand:
        "npm run evidence:permission-wizard -- --platform android --run-id android-download-self-test-permission-wizard --report docs/validation/artifacts/android-download-self-test/android-real-browser-capture/android-permission-wizard-report.json --test-protection-passed --confirm-common-flow --confirm-android-flow --android-selected-app-count <count>",
      protectionEvidenceCommand:
        "npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id android-download-self-test --output-dir docs/validation/artifacts/android-download-self-test/android-real-browser-capture",
    },
    releaseBoundary: "Local Android side-load QA only.",
    protectionFlowOrder: [...FLOW_ORDER],
    sameDeviceEvidenceSequence: SAME_DEVICE_EVIDENCE_SEQUENCE.map((item) => ({ ...item })),
    recoveryNotificationPrompt: {
      title: RECOVERY_NOTIFICATION_PROMPT_TITLE,
      text: RECOVERY_NOTIFICATION_PROMPT_TEXT,
      reportArtifact: "docs/validation/artifacts/android-download-self-test/android-real-browser-capture/android-notification-permission-report.json",
      evidenceFields: [
        "android.notificationPermissionArtifact",
        "android.notificationPermissionRequired=true",
        "android.notificationPermissionGranted=true",
        "android.notificationRuntimePromptShown=true",
        "android.notificationSettingsFallbackOpenedIfDenied=true",
      ],
    },
  };
  const html = renderPage(metadata);
  assert.match(html, /Download APK/);
  assert.match(html, /Scan this QR code/);
  assert.match(html, /qr\.svg/);
  assert.match(html, /Local Android side-load QA only/);
  assert.match(html, /Current Android Build Status/);
  assert.match(html, /A newer current Android rebuild failed after this APK was produced/);
  assert.match(html, /stale-apk-newer-rebuild-failed/);
  assert.match(html, /APK Use Boundary/);
  assert.match(html, /Side-load QA APK/);
  assert.match(html, /Not Play upload evidence/);
  assert.match(html, /upload-signed AAB/);
  assert.match(html, /routes directly to each required Android setup screen/);
  assert.match(html, /refreshes native status when you return/);
  assert.match(html, /advances to the next missing step/);
  assert.match(html, /Same-Device Evidence Sequence/);
  assert.match(html, /Install QA report/);
  assert.match(html, /permission wizard/);
  assert.match(html, /real-browser evidence/);
  assert.match(html, /Recovery Notifications/);
  assert.match(html, /runtime notification prompt/);
  assert.match(html, /Android app notification settings/);
  assert.match(html, /android-notification-permission-report\.json/);
  assert.match(html, /Install Troubleshooting/);
  assert.match(html, /Phone cannot open the QR target/);
  assert.match(html, /Install unknown apps prompt appears/);
  assert.match(html, /package conflicts/);
  assert.match(html, /storage is low/);
  assert.match(html, /sha256-a{64}/);
  assert.match(html, /Support Routes/);
  assert.match(html, /Download route/);
  assert.match(html, /Metadata route/);
  assert.match(html, /\/metadata\.json/);
  assert.match(html, /QR SVG route/);
  assert.match(html, /\/qr\.svg/);
  assert.match(html, /live check must pass for the page route, metadata route, QR route, and APK route/);
  assert.match(html, /QR target: <code>http:\/\/127\.0\.0\.1:8787\/<\/code>/);
  assert.match(html, /Alternate local URLs/);
  assert.match(html, /http:\/\/192\.168\.1\.7:8787\//);
  assert.match(html, /DNS Guard/);
  assert.match(html, /QA Commands/);
  assert.match(html, /qa:android-download:live-check/);
  assert.match(html, /evidence:android-devices/);
  assert.match(html, /--plan-only/);
  assert.match(html, /android-install-qa-plan\.json/);
  assert.match(html, /qa:android-install/);
  assert.match(html, /evidence:permission-wizard/);
  assert.match(html, /--confirm-android-flow/);
  assert.match(html, /evidence:android-real-browser/);
  const markdown = buildDownloadHandoffMarkdown(metadata);
  assert.match(markdown, /FREED Android QA Download Handoff/);
  assert.match(markdown, /Generated by `scripts\/android-apk-download-server\.js`/);
  assert.match(markdown, /APK Use Boundary/);
  assert.match(markdown, /Current Android Build Status/);
  assert.match(markdown, /stale-apk-newer-rebuild-failed/);
  assert.match(markdown, /not as proof of the latest native code/);
  assert.match(markdown, /Side-load QA APK/);
  assert.match(markdown, /Not Play upload evidence/);
  assert.match(markdown, /upload-signed AAB/);
  assert.match(markdown, /QR target URL: `http:\/\/127\.0\.0\.1:8787\/`/);
  assert.match(markdown, /qa:android-download:live-check/);
  assert.match(markdown, /evidence:android-devices/);
  assert.match(markdown, /non-promotable install QA plan/);
  assert.match(markdown, /--plan-only/);
  assert.match(markdown, /android-install-qa-plan\.json/);
  assert.match(markdown, /qa:android-install/);
  assert.match(markdown, /evidence:permission-wizard/);
  assert.match(markdown, /evidence:android-real-browser/);
  assert.match(markdown, /cannot silently grant that OS permission/);
  assert.match(markdown, /Same-Device Evidence Sequence/);
  assert.match(markdown, /Install QA report/);
  assert.match(markdown, /Real-browser evidence/);
  assert.match(markdown, /Recovery Notifications/);
  assert.match(markdown, /android\.notificationPermissionArtifact/);
  assert.match(markdown, /Install Troubleshooting/);
  assert.match(markdown, /Allow from this source/);
  assert.match(markdown, /app\.freed\.recovery/);
  const physicalChecklist = buildPhysicalQaChecklistMarkdown(metadata);
  assert.match(physicalChecklist, /FREED Android Physical QA Checklist/);
  assert.match(physicalChecklist, /Download And Install/);
  assert.match(physicalChecklist, /APK Use Boundary/);
  assert.match(physicalChecklist, /current Android rebuild failed/);
  assert.match(physicalChecklist, /stale-apk-newer-rebuild-failed/);
  assert.match(physicalChecklist, /Side-load QA APK/);
  assert.match(physicalChecklist, /Not Play upload evidence/);
  assert.match(physicalChecklist, /upload-signed AAB/);
  assert.match(physicalChecklist, /Install Troubleshooting/);
  assert.match(physicalChecklist, /Failure case \| Recovery action \| Evidence/);
  assert.match(physicalChecklist, /same Wi-Fi/);
  assert.match(physicalChecklist, /browser-specific install-from-this-source permission/);
  assert.match(physicalChecklist, /Permission Redirect Flow/);
  assert.match(physicalChecklist, /Same-Device Evidence Sequence/);
  assert.match(physicalChecklist, /Install QA report/);
  assert.match(physicalChecklist, /Real-browser evidence/);
  assert.match(physicalChecklist, /Recovery Notifications/);
  assert.match(physicalChecklist, /Settings fallback only if denied/);
  assert.match(physicalChecklist, /androidNotificationPermissionGranted/);
  assert.match(physicalChecklist, /qa:android-download:live-check/);
  assert.match(physicalChecklist, /evidence:android-devices/);
  assert.match(physicalChecklist, /non-promotable install QA plan/);
  assert.match(physicalChecklist, /--plan-only/);
  assert.match(physicalChecklist, /evidence:permission-wizard/);
  assert.match(physicalChecklist, /Android unknown-app install permission/);
  assert.match(physicalChecklist, /native status and test protection agree/);
  assert.match(physicalChecklist, /docs\/validation\/evidence\/android-real-browser\.json/);
  assert.match(physicalChecklist, /Do Not Count As Release Evidence/);
  assert.equal(getQrFormatBits(0).toString(2).padStart(15, "0"), "111011111000100");
  assert.equal(makeQrMatrix("http://127.0.0.1:8787/").length, 25);
  assert.match(renderQrSvg("http://127.0.0.1:8787/"), /<svg/);
  assert.match(renderTerminalQr("http://127.0.0.1:8787/"), /\u001b\[47m/);
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-apk-companions-"));
  try {
    const reportPath = path.join(artifactRoot, "android-apk-download-handoff.json");
    const companions = writeCompanionArtifacts(reportPath, metadata);
    assert.equal(companions.handoffMarkdown.endsWith("ANDROID_APK_DOWNLOAD_HANDOFF.md"), true);
    assert.equal(companions.physicalQaChecklist.endsWith("ANDROID_PHYSICAL_QA_CHECKLIST.md"), true);
    assert.equal(companions.qrSvg.endsWith("ANDROID_APK_DOWNLOAD_QR.svg"), true);
    assert.equal(path.isAbsolute(companions.handoffMarkdown), false);
    assert.equal(path.isAbsolute(companions.physicalQaChecklist), false);
    assert.equal(path.isAbsolute(companions.qrSvg), false);
    assert.match(fs.readFileSync(path.join(artifactRoot, "ANDROID_APK_DOWNLOAD_HANDOFF.md"), "utf8"), /FREED Android QA Download Handoff/);
    assert.match(fs.readFileSync(path.join(artifactRoot, "ANDROID_PHYSICAL_QA_CHECKLIST.md"), "utf8"), /FREED Android Physical QA Checklist/);
    assert.match(fs.readFileSync(path.join(artifactRoot, "ANDROID_APK_DOWNLOAD_QR.svg"), "utf8"), /<svg/);
  } finally {
    fs.rmSync(artifactRoot, { force: true, recursive: true });
  }
  console.log("android-apk-download-server self-test passed");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const metadata = buildMetadata({
    apkPath: options.apk,
    host: options.host,
    port: options.port,
    reportPath: options.reportPath,
    runId: options.runId,
  });
  if (options.reportPath) metadata.companionArtifacts = writeCompanionArtifacts(options.reportPath, metadata);
  if (options.reportPath) writeReport(options.reportPath, metadata);
  if (options.metadataOnly) {
    console.log(
      JSON.stringify(
        {
          artifact: options.reportPath ? repoRelativePath(options.reportPath) : "",
          apk: metadata.apk.path,
          releaseBoundary: metadata.releaseBoundary,
          runId: metadata.runId,
          schema: metadata.schemaVersion,
          sanitized: metadata.sanitized,
        },
        null,
        2,
      ),
    );
    return;
  }
  const server = createServer({ apkPath: options.apk, metadata });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, resolve);
  });

  console.log("# FREED Android QA download server");
  console.log(`APK: ${metadata.apk.path}`);
  console.log(`SHA-256: ${metadata.apk.sha256}`);
  console.log(`Size: ${metadata.apk.sizeLabel} (${metadata.apk.sizeBytes} bytes)`);
  console.log("Open one of these URLs on the Android phone:");
  for (const url of metadata.server.lanUrls) console.log(`- ${url}`);
  if (metadata.server.qrTargetUrl) {
    console.log(`QR target: ${metadata.server.qrTargetUrl}`);
    console.log(renderTerminalQr(metadata.server.qrTargetUrl));
  }
  console.log("Release boundary: local side-load QA only; not Play upload evidence.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
