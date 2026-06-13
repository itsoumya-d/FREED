#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");

const DEFAULT_RUN_ID = "launch-status-current";
const DEFAULT_PREFLIGHT_REPORT = "docs/validation/artifacts/release-env-current/release-env-preflight-report.json";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/launch-status-current";
const DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT =
  "docs/validation/artifacts/android-download-current/android-apk-download-handoff.json";
const DEFAULT_ANDROID_DOWNLOAD_LIVE_CHECK_REPORT =
  "docs/validation/artifacts/android-download-current/android-apk-download-live-check.json";
const DEFAULT_ANDROID_DOWNLOAD_ENSURE_REPORT =
  "docs/validation/artifacts/android-download-current/android-apk-download-ensure.json";
const DEFAULT_ANDROID_QA_UNIVERSAL_APK_BUILD_FAILURE_REPORT =
  "docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-universal-apk-build-failure-report.json";
const ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES = Object.freeze([
  "docs/validation/artifacts/android-current-apk-toolchain-retry/android-apk-build-report.json",
  "docs/validation/artifacts/android-current-apk-retry/android-apk-build-report.json",
  DEFAULT_ANDROID_QA_UNIVERSAL_APK_BUILD_FAILURE_REPORT,
  "docs/validation/artifacts/continue-goal-android-current-artifacts/android-qa-arm64-apk-alt-toolchain-build-report.json",
]);
const DEFAULT_STORE_CATALOG_AUDIT_REPORT =
  "docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json";
const DEFAULT_STORE_LISTING_SCREENSHOT_HANDOFF_REPORT =
  "docs/validation/artifacts/store-listing-screenshots-current/store-listing-screenshot-handoff.json";
const DEFAULT_STORE_AD_SANDBOX_CAPTURE_MANIFEST =
  "docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture/capture-manifest.json";
const DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT =
  "docs/validation/artifacts/store-console-browser-current/store-console-browser-readiness.json";
const DEFAULT_PAYWALL_LAUNCH_SCOPE_AUDIT_REPORT =
  "docs/validation/artifacts/paywall-launch-scope-current/paywall-launch-source-audit.json";
const DEFAULT_PERMISSION_FLOW_AUDIT_REPORT =
  "docs/validation/artifacts/permission-flow-current/permission-flow-source-audit.json";
const DEFAULT_STORE_LEGAL_AUDIT_REPORT =
  "docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json";
const DEFAULT_STORE_LEGAL_WEB_EXPORT_AUDIT_REPORT =
  "docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json";
const DEFAULT_STORE_LEGAL_HOSTED_URL_AUDIT_REPORT =
  "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
const DEFAULT_STORE_LEGAL_WEB_DEPLOY_PACKET_REPORT =
  "docs/validation/artifacts/store-legal-web-deploy-current/store-legal-web-deploy-packet.json";
const DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT =
  "docs/validation/artifacts/supabase-deployment-current/supabase-deployment-packet.json";
const DEFAULT_ANDROID_SIGNING_AAB_REPORT =
  "docs/validation/artifacts/android-signing-current/android-aab-dry-run-report.json";
const DEFAULT_ANDROID_SIGNING_PREFLIGHT_REPORT =
  "docs/validation/artifacts/android-signing-current/release-env-preflight-report.json";
const DEFAULT_EAS_BUILD_HANDOFF_REPORT =
  "docs/validation/artifacts/eas-build-current/eas-build-handoff.json";
const DEFAULT_EAS_BUILD_ATTEMPT_REPORT =
  "docs/validation/artifacts/eas-build-current/eas-build-attempt.json";
const PRODUCTION_ENV_GAP_CHECKLIST_ARTIFACT_NAME = "PRODUCTION_ENV_GAP_CHECKLIST.md";
const PRODUCTION_ENV_MISSING_KEYS_ARTIFACT_NAME = "PRODUCTION_ENV_MISSING_KEYS.env";
const ANDROID_DOWNLOAD_LIVE_CHECK_FRESH_MS = 15 * 60 * 1000;
const ANDROID_DOWNLOAD_ENSURE_FRESH_MS = 15 * 60 * 1000;
const DEVICE_DISCOVERY_FRESH_MS = 15 * 60 * 1000;
const HOSTED_LEGAL_URL_AUDIT_FRESH_MS = 24 * 60 * 60 * 1000;
const PRODUCTION_ENV_GAP_CHECKLIST_JSON_ARTIFACT_NAME = "production-env-gap-checklist.json";
const ANDROID_DOWNLOAD_REQUIRED_LIVE_CHECK_IDS = Object.freeze([
  "download-page-apk-use-boundary-section",
  "download-page-side-load-qa-apk",
  "download-page-not-play-upload-evidence",
  "download-page-upload-signed-aab-command",
  "download-page-same-device-evidence-section",
  "download-page-same-device-install-qa",
  "download-page-same-device-permission-wizard",
  "download-page-same-device-real-browser",
]);
const ANDROID_DOWNLOAD_REQUIRED_SAME_DEVICE_STEPS = Object.freeze([
  "Install QA report",
  "Permission wizard",
  "Real-browser evidence",
]);
const ENV_SKELETON_SAFE_PUBLIC_DEFAULTS = Object.freeze({
  APNS_ENV: "production",
  APP_STORE_BUNDLE_ID: "app.freed.recovery",
  APP_STORE_SERVER_API_ENV: "production",
  EXPO_PUBLIC_ADMOB_USE_TEST_ADS: "false",
  EXPO_PUBLIC_AI_CHALLENGE_MODE: "remote",
  EXPO_PUBLIC_AI_COACH_MODE: "remote",
  EXPO_PUBLIC_IAP_PRODUCT_LIFETIME: "freed_premium_lifetime",
  EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: "freed_premium_monthly",
  EXPO_PUBLIC_IAP_PRODUCT_YEARLY: "freed_premium_yearly",
  EXPO_PUBLIC_MONETIZATION_MODE: "native",
  EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID: "premium",
  EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED: "true",
  EXPO_PUBLIC_STORE_PROVIDER: "native-iap",
  FREED_REQUIRE_ANDROID_RELEASE_SIGNING: "true",
  GOOGLE_PLAY_PACKAGE_NAME: "app.freed.recovery",
});

const HANDOFF_PACKETS = [
  {
    id: "ios-device-discovery",
    label: "iOS Device Discovery",
    artifact: "docs/validation/artifacts/ios-device-discovery-current/ios-device-discovery.json",
    artifactCandidates: [
      "docs/validation/artifacts/ios-device-discovery-current/ios-device-discovery/ios-device-discovery.json",
    ],
    requiredForRelease: false,
  },
  {
    id: "ios-physical-capture",
    label: "iOS Physical Capture Packet",
    artifact: "docs/validation/artifacts/ios-physical-current/ios-physical-device-capture/capture-manifest.json",
    requiredForRelease: true,
  },
  {
    id: "android-device-discovery",
    label: "Android Device Discovery",
    artifact: "docs/validation/artifacts/android-device-discovery-current/android-device-discovery.json",
    artifactCandidates: [
      "docs/validation/artifacts/android-device-discovery-current/android-device-discovery/android-device-discovery.json",
    ],
    requiredForRelease: false,
  },
  {
    id: "android-real-browser-capture",
    label: "Android Real-Browser Capture Packet",
    artifact: "docs/validation/artifacts/android-real-browser-current/android-real-browser-capture/capture-manifest.json",
    requiredForRelease: true,
  },
  {
    id: "store-ad-sandbox",
    label: "Store/Ad Sandbox",
    artifact: "docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture/capture-manifest.json",
    requiredForRelease: true,
  },
  {
    id: "normal-browsing-corpus",
    label: "Normal Browsing Corpus",
    artifact: "docs/validation/artifacts/normal-browsing-current/normal-browsing-corpus-capture/capture-manifest.json",
    requiredForRelease: true,
  },
  {
    id: "performance-profile",
    label: "Performance Profile",
    artifact: "docs/validation/artifacts/performance-profile-current/performance-profile-capture/capture-manifest.json",
    requiredForRelease: true,
  },
  {
    id: "ai-backend-smoke",
    label: "AI Backend Smoke",
    artifact: "docs/validation/artifacts/ai-backend-smoke-current/ai-backend-smoke-capture/capture-manifest.json",
    requiredForRelease: true,
  },
];
const SOURCE_FRESHNESS_HANDOFF_PACKET_IDS = new Set([
  "ai-backend-smoke",
  "normal-browsing-corpus",
  "performance-profile",
]);
const DEVICE_DISCOVERY_HANDOFF_PACKET_IDS = new Set(["android-device-discovery", "ios-device-discovery"]);

function sanitizeIosDeviceNameForStatus(device) {
  if (!device || typeof device !== "object") return "";
  if (device.isSimulator === true) return String(device.name || "iOS Simulator");
  const name = String(device.name || "");
  if (/\bipad\b/i.test(name)) return "Physical iPad";
  if (/\bipod\b/i.test(name)) return "Physical iPod";
  if (/\biphone\b/i.test(name)) return "Physical iPhone";
  return "Non-iOS Apple device";
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    preflightReport: DEFAULT_PREFLIGHT_REPORT,
    runId: DEFAULT_RUN_ID,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--output-dir") {
      options.outputDir = next();
    } else if (arg === "--preflight-report") {
      options.preflightReport = next();
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  options.preflightReport = assertSafeInputReportPath(options.preflightReport, "--preflight-report");
  return options;
}

function printHelp() {
  console.log(`Usage: npm run status:launch -- [options]

Writes a sanitized launch status dashboard from the current release preflight
report and local evidence handoff packets. It does not run deploys, touch store
consoles, read secret env files, or mark release evidence as passing.

Options:
  --preflight-report <path>  Sanitized preflight JSON under docs/validation/artifacts.
                             Default: ${DEFAULT_PREFLIGHT_REPORT}
  --output-dir <path>        Artifact output folder.
                             Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>              Machine-readable run id. Default: ${DEFAULT_RUN_ID}
  --self-test                Run offline parser and summary checks.
`);
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function assertSafeInputReportPath(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error(`${label} must be a plain JSON file path.`);
  }
  if (normalized.startsWith("-") || /[;&|`$<>]/.test(normalized)) {
    throw new Error(`${label} must not contain shell syntax or flags.`);
  }
  const relative = repoRelative(normalized);
  if (!relative.startsWith("docs/validation/artifacts/")) {
    throw new Error(`${label} must be under docs/validation/artifacts/<run-id>.`);
  }
  if (!relative.endsWith(".json")) {
    throw new Error(`${label} must end in .json.`);
  }
  return relative;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function readJsonIfExists(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return { exists: false, value: null };
  return { exists: true, value: JSON.parse(fs.readFileSync(absolutePath, "utf8")) };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFirstJsonIfExists(relativePaths) {
  for (const relativePath of relativePaths) {
    const read = readJsonIfExists(relativePath);
    if (read.exists) return { ...read, artifact: relativePath };
  }
  return { exists: false, value: null, artifact: relativePaths[0] || "" };
}

function fileSha256Label(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")}`;
}

function normalizeSha256Label(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.startsWith("sha256-") ? normalized : `sha256-${normalized}`;
}

function booleanCheckSummary(checks) {
  const entries = isRecord(checks) ? Object.values(checks) : [];
  return {
    falseCount: entries.filter((value) => value === false).length,
    trueCount: entries.filter((value) => value === true).length,
    totalCount: entries.length,
  };
}

function relatedProductionEnvGapChecklist(preflightReport) {
  const reportDir = path.posix.dirname(preflightReport.replace(/\\/g, "/"));
  const artifact = `${reportDir}/${PRODUCTION_ENV_GAP_CHECKLIST_ARTIFACT_NAME}`;
  const envSkeletonArtifact = `${reportDir}/${PRODUCTION_ENV_MISSING_KEYS_ARTIFACT_NAME}`;
  const jsonArtifact = `${reportDir}/${PRODUCTION_ENV_GAP_CHECKLIST_JSON_ARTIFACT_NAME}`;
  const jsonRead = readJsonIfExists(jsonArtifact);
  const value = isRecord(jsonRead.value) ? jsonRead.value : {};
  const currentFailedProductionEnvGroupIds = failedProductionEnvGroupIdsFromPreflight(preflightReport);
  const checklistFailedProductionEnvGroupIds = uniqueSortedStrings(
    Array.isArray(value.failedProductionEnvGroups) ? value.failedProductionEnvGroups.map((group) => group?.id) : [],
  );
  const groupIdsMatchCurrentPreflight = sameStringSet(
    checklistFailedProductionEnvGroupIds,
    currentFailedProductionEnvGroupIds,
  );
  const envSkeleton = summarizeEnvSkeletonStructure(envSkeletonArtifact, checklistFailedProductionEnvGroupIds);
  const sourceFreshness = jsonRead.exists
    ? summarizeSourceFreshness([
        compareSourceHash({
          actualHash: value.sourcePreflightReportSha256,
          actualPath: value.sourcePreflightReport,
          currentHash: fileSha256Label(preflightReport),
          currentPath: preflightReport,
          id: "production-env-gap-preflight",
        }),
      ])
    : summarizeSourceFreshness([], { exists: false });
  const outputFreshness = jsonRead.exists
    ? summarizeSourceFreshness([
        compareSourceHash({
          actualHash: value.checklistSha256,
          actualPath: value.checklistArtifact,
          currentHash: fileSha256Label(artifact),
          currentPath: artifact,
          id: "production-env-gap-checklist",
        }),
        compareSourceHash({
          actualHash: value.envSkeletonSha256,
          actualPath: value.envSkeletonArtifact,
          currentHash: fileSha256Label(envSkeletonArtifact),
          currentPath: envSkeletonArtifact,
          id: "production-env-gap-env-skeleton",
        }),
      ])
    : summarizeSourceFreshness([], { exists: false });
  const schemaValid = value.schema === "freed-production-env-gap-checklist-v1" && value.sanitized === true;
  const exists = fs.existsSync(path.join(process.cwd(), artifact));
  const envSkeletonExists = fs.existsSync(path.join(process.cwd(), envSkeletonArtifact));
  const structuralIssues = [
    !schemaValid ? "schema-or-sanitized-invalid" : "",
    value.secretValuesOmitted !== true ? "secret-values-omitted-flag-missing" : "",
    !groupIdsMatchCurrentPreflight ? "failed-production-env-groups-mismatch-current-preflight" : "",
    !envSkeleton.coversFailedProductionEnvGroups ? "missing-env-skeleton-group-markers" : "",
    !envSkeleton.publicDefaultsPresent ? "missing-env-skeleton-public-defaults" : "",
    !envSkeleton.secretLikeValuesOmitted ? "env-skeleton-has-filled-secret-like-values" : "",
    envSkeleton.malformedAssignmentLineCount > 0 ? "env-skeleton-malformed-assignment-lines" : "",
  ].filter(Boolean);
  let status = "current";
  if (!exists || !envSkeletonExists || !jsonRead.exists) {
    status = "missing";
  } else if (!schemaValid) {
    status = "invalid";
  } else if (sourceFreshness.status !== "current") {
    status = sourceFreshness.status;
  } else if (outputFreshness.status !== "current") {
    status = "stale-output-drift";
  } else if (structuralIssues.length > 0) {
    status = "invalid-structure";
  }
  const skeletonUsableForCurrentPreflight =
    status === "current" &&
    groupIdsMatchCurrentPreflight &&
    envSkeleton.status === "current" &&
    value.secretValuesOmitted === true;
  return {
    artifact,
    checklistSha256: fileSha256Label(artifact),
    checklistFailedProductionEnvGroupIds,
    currentPreflightReportSha256: fileSha256Label(preflightReport),
    currentFailedProductionEnvGroupIds,
    envSkeleton,
    envSkeletonArtifact,
    envSkeletonExists,
    envSkeletonSha256: fileSha256Label(envSkeletonArtifact),
    exists,
    externalValidationGroupCount: Array.isArray(value.externalValidationGroups) ? value.externalValidationGroups.length : 0,
    failedProductionEnvGroupCount: Array.isArray(value.failedProductionEnvGroups)
      ? value.failedProductionEnvGroups.length
      : 0,
    freshForCurrentPreflight: status === "current",
    generatedAt: value.generatedAt || "",
    groupIdsMatchCurrentPreflight,
    jsonArtifact,
    jsonExists: jsonRead.exists,
    outputFreshness,
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schema || "",
    skeletonUsableForCurrentPreflight,
    structuralIssues,
    sourceFreshness,
    sourcePreflightReport: value.sourcePreflightReport || "",
    sourcePreflightReportSha256: normalizeSha256Label(value.sourcePreflightReportSha256 || ""),
    status,
  };
}

function latestApkArtifact() {
  const roots = [
    "docs/validation/artifacts/continue-goal-android-current-artifacts/apk",
    "docs/validation/artifacts/continue-goal-android-download-current/apk",
  ];
  const candidates = [];
  for (const root of roots) {
    const absoluteRoot = path.join(process.cwd(), root);
    if (!fs.existsSync(absoluteRoot)) continue;
    for (const entry of fs.readdirSync(absoluteRoot)) {
      if (!entry.endsWith(".apk")) continue;
      const relative = `${root}/${entry}`;
      const stat = fs.statSync(path.join(process.cwd(), relative));
      candidates.push({
        artifact: relative,
        modifiedAt: stat.mtime.toISOString(),
        sha256: fileSha256Label(relative),
        sizeBytes: stat.size,
      });
    }
  }
  candidates.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return candidates[0] || null;
}

function summarizeAndroidCurrentBuildFailure(latestApk) {
  const candidateReads = ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES.map((artifact) => ({
    artifact,
    ...readJsonIfExists(artifact),
  })).filter((entry) => entry.exists && entry.value?.result === "fail");
  candidateReads.sort((a, b) =>
    String(b.value?.generatedAt || "").localeCompare(String(a.value?.generatedAt || "")),
  );
  const read = candidateReads[0] || {
    artifact: DEFAULT_ANDROID_QA_UNIVERSAL_APK_BUILD_FAILURE_REPORT,
    exists: false,
    value: null,
  };
  if (!read.exists) {
    return {
      artifact: read.artifact,
      candidateArtifacts: [...ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES],
      exists: false,
      newerThanSelectedApk: false,
      staleDownloadWarning: false,
    };
  }
  const value = read.value;
  const generatedAt = String(value.generatedAt || "");
  const generatedMs = Date.parse(generatedAt);
  const selectedApkMs = Date.parse(String(latestApk?.modifiedAt || ""));
  const newerThanSelectedApk = Number.isFinite(generatedMs) && Number.isFinite(selectedApkMs) && generatedMs > selectedApkMs;
  const reason = String(value.releaseBoundary?.reason || value.results?.[0]?.detail || "");
  const failedTask = reason.match(/Execution failed for task '([^']+)'/)?.[1] || "";
  const gradleCommand = Array.isArray(value.gradleCommand) ? value.gradleCommand : [];
  const attemptedCmakeVersion =
    String(value.requested?.cmakeVersion || "") ||
    gradleCommand.find((arg) => String(arg).startsWith("-Pfreed.androidCmakeVersion="))?.split("=")[1] ||
    "";
  const attemptedNdkVersion =
    String(value.requested?.ndkVersion || "") ||
    gradleCommand.find((arg) => String(arg).startsWith("-Pfreed.androidNdkVersion="))?.split("=")[1] ||
    "";
  const newArchRequested = value.requested?.newArchEnabled;
  const diagnostics = value.diagnostics && typeof value.diagnostics === "object" ? value.diagnostics : {};
  const newArchForcedByReactNative =
    diagnostics.reactNativeNewArchForced === true ||
    /not supported anymore since React Native 0\.82|New Architecture enabled by default/i.test(reason);
  const cmakeExit137 =
    diagnostics.cmakeExit137 === true ||
    /exit value 137|exits? 137|exit code 137|CMake.*137|cmake.*137/i.test(reason);
  return {
    artifact: read.artifact,
    attemptedCmakeVersion,
    attemptedNdkVersion,
    buildResult: value.buildResult || "",
    candidateArtifacts: [...ANDROID_CURRENT_SOURCE_BUILD_FAILURE_REPORT_CANDIDATES],
    cmakeExit137,
    exists: true,
    failedStage: value.failedStage || "",
    failedTask,
    generatedAt,
    gradleCommand,
    hostMemoryConstrainedLikely: diagnostics.hostMemoryConstrainedLikely === true,
    hostTotalMemoryMb: Number.isFinite(diagnostics.hostTotalMemoryMb) ? diagnostics.hostTotalMemoryMb : null,
    newArchForcedByReactNative,
    newArchRequested,
    newerThanSelectedApk,
    reasonPreview: reason.slice(0, 500),
    result: value.result || "",
    sanitized: value.sanitized === true,
    selectedApkArtifact: latestApk?.artifact || "",
    selectedApkModifiedAt: latestApk?.modifiedAt || "",
    staleDownloadWarning: newerThanSelectedApk && value.result === "fail",
  };
}

function summarizeEasBuildHandoff() {
  const read = readJsonIfExists(DEFAULT_EAS_BUILD_HANDOFF_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_EAS_BUILD_HANDOFF_REPORT,
      exists: false,
      readyForApprovedEasBuild: false,
      result: "missing",
      releaseEvidenceSatisfied: false,
      next:
        "Run npm run evidence:eas-build-handoff -- --run-id eas-build-current --output-dir docs/validation/artifacts/eas-build-current.",
    };
  }
  const value = read.value;
  const commands = isRecord(value.commands) ? value.commands : {};
  const androidFailure = isRecord(value.androidFailure) ? value.androidFailure : {};
  const cli = isRecord(value.cli) ? value.cli : {};
  return {
    artifact: DEFAULT_EAS_BUILD_HANDOFF_REPORT,
    androidFailure: {
      artifact: androidFailure.artifact || "",
      cmakeExit137: androidFailure.cmakeExit137 === true,
      failedTask: androidFailure.failedTask || "",
      localBuildBlocked: androidFailure.localBuildBlocked === true,
      newArchForcedByReactNative: androidFailure.newArchForcedByReactNative === true,
    },
    commands: {
      androidInternalApk: commands.androidInternalApk || "",
      androidProductionAab: commands.androidProductionAab || "",
      iosInternal: commands.iosInternal || "",
      iosProduction: commands.iosProduction || "",
      releasePreflight: commands.releasePreflight || "",
      strictVerify: commands.strictVerify || "",
    },
    cli: {
      easCliInvocation: cli.easCliInvocation || "",
      npxAvailable: cli.npxAvailable === true,
      npxPath: cli.npxPath || "",
    },
    exists: true,
    generatedAt: value.generatedAt || "",
    readyForApprovedEasBuild: value.readyForApprovedEasBuild === true,
    releaseBoundary: value.releaseBoundary || "",
    releaseEvidenceSatisfied: value.releaseEvidenceSatisfied === true,
    requiredReceipts: Array.isArray(value.requiredReceipts) ? value.requiredReceipts.map(String) : [],
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schema || "",
    summary: value.summary || null,
  };
}

function summarizeEasBuildAttempt() {
  const read = readJsonIfExists(DEFAULT_EAS_BUILD_ATTEMPT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_EAS_BUILD_ATTEMPT_REPORT,
      exists: false,
      readyForCurrentSourceArtifact: false,
      releaseEvidenceSatisfied: false,
      result: "missing",
      next:
        "Run npm run evidence:eas-build-attempt after checking EAS auth or attempting the target EAS build.",
    };
  }
  const value = read.value;
  const commands = isRecord(value.commands) ? value.commands : {};
  const target = isRecord(value.target) ? value.target : {};
  const receipts = isRecord(value.receipts) ? value.receipts : {};
  return {
    artifact: DEFAULT_EAS_BUILD_ATTEMPT_REPORT,
    attemptType: value.attemptType || "",
    commands: {
      authCheck: commands.authCheck || "",
      build: commands.build || "",
      login: commands.login || "",
    },
    exists: true,
    exitCode: Number(value.exitCode || 0),
    generatedAt: value.generatedAt || "",
    observedMessageCode: value.observedMessageCode || "",
    readyForCurrentSourceArtifact: value.readyForCurrentSourceArtifact === true,
    receipts: {
      artifactSha256: normalizeSha256Label(receipts.artifactSha256 || ""),
      artifactSizeBytes: Number(receipts.artifactSizeBytes || 0),
      buildIdPresent: Boolean(receipts.buildId),
      buildUrl: receipts.buildUrl || "",
      physicalQaRunId: receipts.physicalQaRunId || "",
      preflightReport: receipts.preflightReport || "",
      signingSummary: receipts.signingSummary || "",
      sourceRevisionPresent: Boolean(receipts.sourceRevision),
    },
    releaseBoundary: value.releaseBoundary || "",
    releaseEvidenceSatisfied: value.releaseEvidenceSatisfied === true,
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schema || "",
    status: value.status || "",
    summary: value.summary || null,
    target: {
      artifactType: target.artifactType || "",
      commandId: target.commandId || "",
      platform: target.platform || "",
      profile: target.profile || "",
      purpose: target.purpose || "",
    },
  };
}

function summarizeArtifactFreshness(generatedAt, maxAgeMs, nowMs = Date.now()) {
  const parsed = Date.parse(String(generatedAt || ""));
  if (!Number.isFinite(parsed)) {
    return {
      ageMs: null,
      ageMinutes: null,
      fresh: false,
      status: "missing-generatedAt",
    };
  }
  const ageMs = Math.max(0, nowMs - parsed);
  return {
    ageMs,
    ageMinutes: Number((ageMs / 60000).toFixed(2)),
    fresh: ageMs <= maxAgeMs,
    status: ageMs <= maxAgeMs ? "current" : "stale",
  };
}

function summarizeAndroidDeviceDiscoveryArtifact(artifact) {
  const target = artifact || "docs/validation/artifacts/android-device-discovery-current/android-device-discovery.json";
  const read = readJsonIfExists(target);
  if (!read.exists) {
    return {
      artifact: target,
      exists: false,
      result: "missing",
      readyPhysicalCandidateCount: 0,
      readyDeviceCount: 0,
    };
  }
  const value = read.value;
  const freshness = summarizeArtifactFreshness(value.generatedAt, DEVICE_DISCOVERY_FRESH_MS);
  return {
    adbDevicesArtifact: value.adbDevicesArtifact || "",
    artifact: target,
    deviceCount: Number(value.deviceCount || 0),
    evidenceBoundary: value.evidenceBoundary || "",
    evidenceSatisfied: value.evidenceSatisfied === true,
    exists: true,
    freshness,
    generatedAt: value.generatedAt || "",
    next: value.next || "",
    nextCommand: value.nextCommand || "",
    readyDeviceCount: Number(value.readyDeviceCount || 0),
    readyEmulatorLikeDeviceCount: Number(value.readyEmulatorLikeDeviceCount || 0),
    readyPhysicalCandidateCount: Number(value.readyPhysicalCandidateCount || 0),
    releaseGate: value.releaseGate || "",
    result: value.result || "",
    runId: value.runId || "",
    sanitized: value.sanitized === true,
    schema: value.schema || value.schemaVersion || "",
    status: freshness.status === "current" ? value.result || "" : "stale-device-discovery",
  };
}

function summarizeAndroidDownloadLiveCheck(artifact = DEFAULT_ANDROID_DOWNLOAD_LIVE_CHECK_REPORT) {
  const read = readJsonIfExists(artifact);
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  const freshness = summarizeArtifactFreshness(value.generatedAt, ANDROID_DOWNLOAD_LIVE_CHECK_FRESH_MS);
  const passing = value.result === "pass" && Number(value.failCount || 0) === 0;
  const checks = Array.isArray(value.checks) ? value.checks : [];
  const checkStatuses = new Map(
    checks
      .filter((check) => isRecord(check) && typeof check.id === "string")
      .map((check) => [check.id, check.status]),
  );
  const missingRequiredContentCheckIds = ANDROID_DOWNLOAD_REQUIRED_LIVE_CHECK_IDS.filter(
    (id) => checkStatuses.get(id) !== "pass",
  );
  const requiredBoundaryPageChecksPassed = missingRequiredContentCheckIds.length === 0;
  return {
    artifact,
    downloadProbe: value.probes?.download
      ? {
          contentLength: Number(value.probes.download.contentLength || 0),
          contentType: value.probes.download.contentType || "",
          status: Number(value.probes.download.status || 0),
          url: value.probes.download.url || "",
        }
      : null,
    exists: true,
    failCount: Number(value.failCount || 0),
    freshness,
    generatedAt: value.generatedAt || "",
    pageProbe: value.probes?.page
      ? {
          contentLength: Number(value.probes.page.contentLength || 0),
          contentType: value.probes.page.contentType || "",
          status: Number(value.probes.page.status || 0),
          url: value.probes.page.url || "",
        }
      : null,
    passCount: Number(value.passCount || 0),
    releaseBoundary: value.releaseBoundary || "",
    requiredBoundaryPageChecksPassed,
    requiredLiveCheckIds: [...ANDROID_DOWNLOAD_REQUIRED_LIVE_CHECK_IDS],
    missingRequiredContentCheckIds,
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    status: passing ? freshness.status : "failing",
    target: value.target
      ? {
          downloadUrl: value.target.downloadUrl || "",
          metadataUrl: value.target.metadataUrl || "",
          pageUrl: value.target.pageUrl || "",
          qrTargetUrl: value.target.qrTargetUrl || "",
        }
      : null,
    usableForCurrentDownload: passing && freshness.fresh,
  };
}

function summarizeAndroidDownloadEnsure(artifact = DEFAULT_ANDROID_DOWNLOAD_ENSURE_REPORT) {
  const read = readJsonIfExists(artifact);
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      result: "missing",
      usableForCurrentDownload: false,
    };
  }
  return summarizeAndroidDownloadEnsureValue(read.value, artifact);
}

function summarizeAndroidDownloadEnsureValue(value, artifact, now = Date.now()) {
  const freshness = summarizeArtifactFreshness(value.generatedAt, ANDROID_DOWNLOAD_ENSURE_FRESH_MS, now);
  const liveChecks = Array.isArray(value.liveChecks) ? value.liveChecks : [];
  const latestLiveCheck = liveChecks[liveChecks.length - 1] || {};
  const latestLiveCheckPassed =
    latestLiveCheck.passed === true ||
    (Number(latestLiveCheck.exitCode || 0) === 0 && latestLiveCheck.reportResult === "pass");
  const passing = value.result === "pass" && latestLiveCheckPassed;
  return {
    artifact,
    command: value.commands?.ensure || "",
    exists: true,
    failCount: Number(value.failCount || 0),
    freshness,
    generatedAt: value.generatedAt || "",
    latestLiveCheck: {
      exitCode: Number(latestLiveCheck.exitCode || 0),
      label: latestLiveCheck.label || "",
      passed: latestLiveCheckPassed,
      reportResult: latestLiveCheck.reportResult || "",
      target: latestLiveCheck.target || null,
    },
    liveCheckReport: value.liveCheckReport || "",
    passCount: Number(value.passCount || 0),
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    serverStarted: value.serverStarted === true,
    startAttempted: value.startAttempted === true,
    startIfNeeded: value.startIfNeeded === true,
    status: passing ? freshness.status : value.result === "needs-server-start" ? "needs-server-start" : "failing",
    usableForCurrentDownload: passing && freshness.fresh,
  };
}

function summarizeAndroidDownloadUseBoundary(value) {
  const boundary = isRecord(value.apkUseBoundary) ? value.apkUseBoundary : {};
  const sameDeviceEvidenceSequence = Array.isArray(value.sameDeviceEvidenceSequence)
    ? value.sameDeviceEvidenceSequence
        .filter((item) => isRecord(item))
        .map((item) => ({
          proof: String(item.proof || ""),
          step: String(item.step || ""),
        }))
    : [];
  const sameDeviceSteps = sameDeviceEvidenceSequence.map((item) => item.step);
  const requiredSameDeviceStepsPresent = ANDROID_DOWNLOAD_REQUIRED_SAME_DEVICE_STEPS.every((step) =>
    sameDeviceSteps.includes(step),
  );
  const sameDeviceProofTextPresent = sameDeviceEvidenceSequence
    .filter((item) => ANDROID_DOWNLOAD_REQUIRED_SAME_DEVICE_STEPS.includes(item.step))
    .every((item) => item.proof.trim().length > 0 && /same|physical|install|permission|browser/i.test(item.proof));
  const localQaDownloadReady = boundary.localQaDownloadReady === true;
  const sameDeviceEvidenceRequired = boundary.sameDeviceEvidenceRequired === true;
  const storeSubmissionReadyFlag = boundary.storeSubmissionReady === true;
  const storeSubmissionCorrectlyBlocked = boundary.storeSubmissionReady === false;
  const storeReadyLabel = String(boundary.storeReadyLabel || "");
  const blockedUse = String(boundary.blockedUse || "");
  const uploadSignedArtifactCommand = String(boundary.uploadSignedArtifactCommand || "");
  const boundaryValid =
    localQaDownloadReady &&
    sameDeviceEvidenceRequired &&
    storeSubmissionCorrectlyBlocked &&
    /not play upload evidence/i.test(storeReadyLabel) &&
    /do not submit/i.test(blockedUse) &&
    /upload-signed AAB\/APK|upload-signed/i.test(blockedUse) &&
    /build:android-aab:upload-signed/.test(uploadSignedArtifactCommand) &&
    /--env-file <production-env-file>/.test(uploadSignedArtifactCommand);
  const sameDeviceEvidenceValid =
    sameDeviceEvidenceRequired && requiredSameDeviceStepsPresent && sameDeviceProofTextPresent;
  return {
    boundary,
    boundaryValid,
    localQaDownloadReady,
    requiredSameDeviceSteps: [...ANDROID_DOWNLOAD_REQUIRED_SAME_DEVICE_STEPS],
    requiredSameDeviceStepsPresent,
    sameDeviceEvidenceRequired,
    sameDeviceEvidenceSequence,
    sameDeviceEvidenceValid,
    sameDeviceProofTextPresent,
    storeSubmissionCorrectlyBlocked,
    storeSubmissionReady: storeSubmissionReadyFlag,
    usableForPhysicalQaHandoff: boundaryValid && sameDeviceEvidenceValid,
  };
}

function summarizeAndroidInstallQaPlan(planArtifact, expected) {
  const artifact = planArtifact ? repoRelative(planArtifact) : "";
  if (!artifact) {
    return {
      artifact: "",
      exists: false,
      releaseEvidenceSatisfied: false,
      status: "missing",
      usableForInstallHandoff: false,
    };
  }
  const read = readJsonIfExists(artifact);
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      releaseEvidenceSatisfied: false,
      status: "missing",
      usableForInstallHandoff: false,
    };
  }

  const value = read.value || {};
  const planApkPath = value.apk?.path ? repoRelative(value.apk.path) : "";
  const planApkSha256 = normalizeSha256Label(value.apk?.sha256 || "");
  const expectedApkPath = expected?.apkPath || "";
  const expectedApkSha256 = expected?.apkSha256 || "";
  const requiredProofFlags = Array.isArray(value.protectionHandoff?.requiredProofFlags)
    ? value.protectionHandoff.requiredProofFlags
    : [];
  const protectionCommand = String(value.protectionHandoff?.commandString || "");
  const requiredProofFlagsPresent = ["--permission-proof", "--native-status-proof", "--dns-guard-proof"].every(
    (flag) => requiredProofFlags.includes(flag) && protectionCommand.includes(flag),
  );
  const nonPromotableCaveat = /cannot satisfy android\.installQaArtifact/.test(String(value.caveat || ""));
  const runIdMatchesHandoff = Boolean(value.runId && expected?.runId && value.runId === expected.runId);
  const apkPathMatchesHandoff = Boolean(planApkPath && expectedApkPath && planApkPath === expectedApkPath);
  const apkShaMatchesHandoff = Boolean(planApkSha256 && expectedApkSha256 && planApkSha256 === expectedApkSha256);
  const usableForInstallHandoff =
    value.schemaVersion === "freed-android-install-qa-plan-v1" &&
    value.sanitized === true &&
    value.status === "plan-only" &&
    value.physicalDeviceRequired === true &&
    value.finalInstallQaSchemaVersion === "freed-android-install-qa-report-v1" &&
    runIdMatchesHandoff &&
    apkPathMatchesHandoff &&
    apkShaMatchesHandoff &&
    requiredProofFlagsPresent &&
    nonPromotableCaveat;

  return {
    apkPath: planApkPath,
    apkPathMatchesHandoff,
    apkSha256: planApkSha256,
    apkShaMatchesHandoff,
    artifact,
    debugSigned: value.apk?.signature?.debugSigned === true,
    exists: true,
    finalInstallQaSchemaVersion: value.finalInstallQaSchemaVersion || "",
    nonPromotableCaveat,
    physicalDeviceRequired: value.physicalDeviceRequired === true,
    releaseEvidenceSatisfied: false,
    requestedRequireUploadSigning: value.requested?.requireUploadSigning === true,
    requiredProofFlags,
    requiredProofFlagsPresent,
    runId: value.runId || "",
    runIdMatchesHandoff,
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    status: value.status || "",
    usableForInstallHandoff,
  };
}

function summarizeAndroidDownloadHandoff(latestApk) {
  const read = readJsonIfExists(DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT,
      exists: false,
    };
  }
  const value = read.value;
  const apkPath = value.apk?.path || "";
  const apkRelative = apkPath ? repoRelative(apkPath) : "";
  const apkExists = apkRelative ? fs.existsSync(path.join(process.cwd(), apkRelative)) : false;
  const actualApkSha256 = apkExists ? fileSha256Label(apkRelative) : "";
  const reportedApkSha256 = normalizeSha256Label(value.apk?.sha256 || "");
  const reportShaMatchesFile = Boolean(actualApkSha256 && reportedApkSha256 && actualApkSha256 === reportedApkSha256);
  const matchesLatestApkSha256 = Boolean(latestApk?.sha256 && reportedApkSha256 && latestApk.sha256 === reportedApkSha256);
  const readyToServeSelectedApk = apkExists && reportShaMatchesFile;
  const deviceDiscoveryArtifact = value.qaHandoff?.deviceDiscoveryArtifact || "";
  const liveCheckArtifact = value.qaHandoff?.liveCheckArtifact || DEFAULT_ANDROID_DOWNLOAD_LIVE_CHECK_REPORT;
  const ensureArtifact = value.qaHandoff?.ensureArtifact || DEFAULT_ANDROID_DOWNLOAD_ENSURE_REPORT;
  const installQaPlanArtifact = value.qaHandoff?.installQaPlanArtifact || "";
  const installQaPlan = summarizeAndroidInstallQaPlan(installQaPlanArtifact, {
    apkPath: apkRelative,
    apkSha256: reportedApkSha256,
    runId: value.runId || "",
  });
  const liveCheck = summarizeAndroidDownloadLiveCheck(liveCheckArtifact);
  const ensure = summarizeAndroidDownloadEnsure(ensureArtifact);
  const useBoundary = summarizeAndroidDownloadUseBoundary(value);
  return {
    apkExists,
    apkPath: apkRelative,
    artifact: DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT,
    companionArtifacts:
      value.companionArtifacts && typeof value.companionArtifacts === "object" ? value.companionArtifacts : {},
    deviceDiscovery: summarizeAndroidDeviceDiscoveryArtifact(deviceDiscoveryArtifact),
    deviceDiscoveryArtifact,
    deviceDiscoveryCommand: value.qaHandoff?.deviceDiscoveryCommand || "",
    deviceDiscoveryOutputDir: value.qaHandoff?.deviceDiscoveryOutputDir || "",
    downloadServerCommand: value.qaHandoff?.downloadServerCommand || "",
    downloadServerCurrentlyVerified: liveCheck.usableForCurrentDownload === true,
    evidenceBoundary: value.qaHandoff?.evidenceBoundary || "",
    exists: true,
    generatedAt: value.generatedAt || "",
    ensure,
    ensureArtifact,
    ensureCommand:
      value.qaHandoff?.ensureCommand ||
      `npm run qa:android-download:ensure -- --handoff ${DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT} --live-check-report ${liveCheckArtifact} --report ${ensureArtifact} --start-if-needed`,
    liveCheck,
    liveCheckArtifact,
    liveCheckCommand: value.qaHandoff?.liveCheckCommand || "",
    installQaPlanArtifact,
    installQaPlanCommand: value.qaHandoff?.installQaPlanCommand || "",
    installQaPlan,
    installQaPlanExists: installQaPlan.exists === true,
    installQaCommand: value.qaHandoff?.installQaCommand || "",
    latestApkSha256: latestApk?.sha256 || "",
    matchesLatestApkSha256,
    permissionWizardArtifact: value.qaHandoff?.permissionWizardArtifact || "",
    permissionWizardCommand: value.qaHandoff?.permissionWizardCommand || "",
    protectionEvidenceCommand: value.qaHandoff?.protectionEvidenceCommand || "",
    qrTargetUrl: value.server?.qrTargetUrl || "",
    readyToServeSelectedApk,
    reportedApkSha256,
    reportShaMatchesFile,
    runId: value.runId || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    server: {
      downloadPath: value.server?.downloadPath || "",
      host: value.server?.host || "",
      lanUrls: Array.isArray(value.server?.lanUrls) ? value.server.lanUrls : [],
      metadataPath: value.server?.metadataPath || "",
      port: Number(value.server?.port || 0),
      qrPath: value.server?.qrPath || "",
    },
    useBoundary,
    usableForPhysicalQaHandoff:
      readyToServeSelectedApk &&
      installQaPlan.usableForInstallHandoff === true &&
      useBoundary.usableForPhysicalQaHandoff === true &&
      liveCheck.requiredBoundaryPageChecksPassed === true,
  };
}

function summarizeStoreCatalogAudit() {
  const read = readJsonIfExists(DEFAULT_STORE_CATALOG_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_CATALOG_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  return {
    artifact: DEFAULT_STORE_CATALOG_AUDIT_REPORT,
    exists: true,
    failCount: Number(value.failCount || 0),
    futureProductsDisabledForV1: Array.isArray(value.futureProductsDisabledForV1)
      ? value.futureProductsDisabledForV1
      : [],
    listingScreenshotReadiness: isRecord(value.listingScreenshotReadiness)
      ? {
          assetCount: Number(value.listingScreenshotReadiness.assetCount || 0),
          blockers: Array.isArray(value.listingScreenshotReadiness.blockers)
            ? value.listingScreenshotReadiness.blockers.filter(Boolean).map(String)
            : [],
          expectedAssetIds: Array.isArray(value.listingScreenshotReadiness.expectedAssetIds)
            ? value.listingScreenshotReadiness.expectedAssetIds.filter(Boolean).map(String)
            : [],
          exists: value.listingScreenshotReadiness.exists === true,
          manifestPath: value.listingScreenshotReadiness.manifestPath || "",
          next: value.listingScreenshotReadiness.next || "",
          readyForStoreUpload: value.listingScreenshotReadiness.readyForStoreUpload === true,
          requiredBeforeStoreUpload: value.listingScreenshotReadiness.requiredBeforeStoreUpload === true,
          status: value.listingScreenshotReadiness.status || "not-reported",
          templatePath: value.listingScreenshotReadiness.templatePath || "",
        }
      : {
          assetCount: 0,
          blockers: ["listing-screenshot-readiness-missing"],
          expectedAssetIds: [],
          exists: false,
          manifestPath: "store/screenshots/listing/manifest.json",
          next: "Rerun npm run audit:store-catalog so public listing screenshot readiness is reported.",
          readyForStoreUpload: false,
          requiredBeforeStoreUpload: true,
          status: "missing",
          templatePath: "store/screenshots/listing/manifest.template.json",
        },
    launchProductIds: value.launchProductIds || {},
    passCount: Number(value.passCount || 0),
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    sourceArtifacts: value.sourceArtifacts || {},
  };
}

function summarizeStoreListingScreenshotHandoff() {
  const read = readJsonIfExists(DEFAULT_STORE_LISTING_SCREENSHOT_HANDOFF_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_LISTING_SCREENSHOT_HANDOFF_REPORT,
      exists: false,
      readyForSignedBuildCapture: false,
      readyForStoreUpload: false,
      releaseEvidenceSatisfied: false,
      result: "missing",
      next:
        "Run npm run evidence:store-listing-screenshots -- --run-id store-listing-screenshots-current --output-dir docs/validation/artifacts/store-listing-screenshots-current.",
    };
  }
  const value = read.value;
  const commands = isRecord(value.captureCommands) ? value.captureCommands : {};
  return {
    artifact: DEFAULT_STORE_LISTING_SCREENSHOT_HANDOFF_REPORT,
    captureCommands: {
      refreshEasHandoff: commands.refreshEasHandoff || "",
      refreshLaunchStatus: commands.refreshLaunchStatus || "",
      validateCatalog: commands.validateCatalog || "",
    },
    captureRows: Array.isArray(value.captureRows)
      ? value.captureRows.map((row) => ({
          headline: row.headline || "",
          height: Number(row.height || 0),
          id: row.id || "",
          screen: row.screen || "",
          width: Number(row.width || 0),
        }))
      : [],
    exists: true,
    finalManifestExists: value.finalManifestExists === true,
    finalManifestPath: value.finalManifestPath || "",
    finalManifestStatus: value.finalManifestStatus || "",
    generatedAt: value.generatedAt || "",
    readyForSignedBuildCapture: value.readyForSignedBuildCapture === true,
    readyForStoreUpload: value.readyForStoreUpload === true,
    releaseBoundary: value.releaseBoundary || "",
    releaseEvidenceSatisfied: value.releaseEvidenceSatisfied === true,
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schema || "",
    summary: value.summary || null,
  };
}

function summarizePaywallLaunchScopeAudit() {
  const read = readJsonIfExists(DEFAULT_PAYWALL_LAUNCH_SCOPE_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_PAYWALL_LAUNCH_SCOPE_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  return {
    artifact: DEFAULT_PAYWALL_LAUNCH_SCOPE_AUDIT_REPORT,
    exists: true,
    failCount: Number(value.failCount || 0),
    futurePlanIdsDisabledForV1: Array.isArray(value.futurePlanIdsDisabledForV1)
      ? value.futurePlanIdsDisabledForV1
      : [],
    launchPlanIds: Array.isArray(value.launchPlanIds) ? value.launchPlanIds : [],
    launchProductIds: value.launchProductIds || {},
    passCount: Number(value.passCount || 0),
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    sourceArtifacts: value.sourceArtifacts || {},
  };
}

function summarizeConsoleEvidencePlatform(platform) {
  const evidenceArtifacts = Array.isArray(platform.consoleEvidenceArtifacts) ? platform.consoleEvidenceArtifacts : [];
  return {
    appRecordCreated: platform.appRecordCreated === true,
    consoleHost: platform.consoleHost || "",
    consolePathRedacted: platform.consolePathRedacted || "",
    evidenceArtifactCount: evidenceArtifacts.length,
    launchProductsCount: Array.isArray(platform.launchProducts) ? platform.launchProducts.length : 0,
    pendingEvidenceArtifactCount: evidenceArtifacts.filter(
      (artifact) =>
        !isRecord(artifact) ||
        artifact.redacted !== true ||
        artifact.accountIdentifiersRedacted !== true ||
        !String(artifact.artifactPath || "").trim() ||
        !String(artifact.artifactHash || "").trim(),
    ).length,
    screenIds: evidenceArtifacts
      .filter((artifact) => isRecord(artifact) && String(artifact.screenId || "").trim())
      .map((artifact) => artifact.screenId),
  };
}

function summarizeConsoleAppRecordReadiness(value) {
  const readiness = isRecord(value?.appRecordReadiness) ? value.appRecordReadiness : {};
  const checks = booleanCheckSummary(readiness.checks);
  const googlePlay = isRecord(readiness.googlePlay) ? readiness.googlePlay : {};
  const appStoreConnect = isRecord(readiness.appStoreConnect) ? readiness.appStoreConnect : {};
  return {
    accountIdentifiersRedacted: readiness.accountIdentifiersRedacted === true,
    browserReportHash: normalizeSha256Label(readiness.browserReportHash || ""),
    browserReportPath: readiness.browserReportPath || "",
    browserReportRunId: readiness.browserReportRunId || "",
    checkFalseCount: checks.falseCount,
    checkTotalCount: checks.totalCount,
    checkTrueCount: checks.trueCount,
    googlePlay: {
      appRecordPresent: googlePlay.appRecordPresent === true,
      observedViaBrowser: googlePlay.observedViaBrowser === true,
      productSetupAllowed: googlePlay.productSetupAllowed === true,
    },
    appStoreConnect: {
      appRecordPresent: appStoreConnect.appRecordPresent === true,
      licenseAgreementAccepted: appStoreConnect.licenseAgreementAccepted === true,
      observedViaBrowser: appStoreConnect.observedViaBrowser === true,
      productSetupAllowed: appStoreConnect.productSetupAllowed === true,
    },
    readOnlyBrowserInspection: readiness.readOnlyBrowserInspection === true,
    readyForConsoleProductSetup: readiness.readyForConsoleProductSetup === true,
    storeMutationPerformed: readiness.storeMutationPerformed === true,
  };
}

const STORE_CONSOLE_SOURCE_FRESHNESS_FIELDS = [
  {
    artifactKey: "storeProductsCatalog",
    hashField: "storeProductsCatalogHash",
    id: "store-products-catalog",
    pathField: "storeProductsCatalogPath",
  },
  {
    artifactKey: "appStoreConnectCsv",
    hashField: "appStoreConnectCsvHash",
    id: "app-store-connect-csv",
    pathField: "appStoreConnectCsvPath",
  },
  {
    artifactKey: "googlePlayProductsCsv",
    hashField: "googlePlayProductsCsvHash",
    id: "google-play-products-csv",
    pathField: "googlePlayProductsCsvPath",
  },
  {
    artifactKey: "screenshotManifest",
    hashField: "screenshotManifestHash",
    id: "screenshot-manifest",
    pathField: "screenshotManifestPath",
  },
];

function sourceArtifactEntry(sourceArtifacts, key) {
  const entry = isRecord(sourceArtifacts) && isRecord(sourceArtifacts[key]) ? sourceArtifacts[key] : {};
  return {
    path: entry.path || "",
    sha256: normalizeSha256Label(entry.sha256 || ""),
  };
}

function sourceHashForPath(relativePath) {
  const normalized = String(relativePath || "").trim();
  return normalized ? fileSha256Label(normalized) : "";
}

function compareSourceHash({ actualHash, actualPath, currentHash, currentPath, id }) {
  const normalizedActualHash = normalizeSha256Label(actualHash || "");
  const normalizedCurrentHash = normalizeSha256Label(currentHash || "");
  const normalizedActualPath = String(actualPath || "").trim();
  const normalizedCurrentPath = String(currentPath || "").trim();
  return {
    currentHash: normalizedCurrentHash,
    currentPath: normalizedCurrentPath,
    hashMatchesCurrent:
      Boolean(normalizedActualHash && normalizedCurrentHash) && normalizedActualHash === normalizedCurrentHash,
    id,
    pathMatchesCurrent:
      Boolean(normalizedActualPath && normalizedCurrentPath) && normalizedActualPath === normalizedCurrentPath,
    reportedHash: normalizedActualHash,
    reportedPath: normalizedActualPath,
  };
}

function summarizeSourceFreshness(comparisons, options = {}) {
  if (options.exists === false) {
    return {
      exists: false,
      reason: "source-proof-missing",
      staleReason: "",
      status: "missing",
    };
  }
  const staleReasons = comparisons
    .flatMap((comparison) => {
      const reasons = [];
      if (!comparison.pathMatchesCurrent) reasons.push(`${comparison.id}-path-mismatch`);
      if (!comparison.hashMatchesCurrent) reasons.push(`${comparison.id}-hash-mismatch`);
      return reasons;
    })
    .filter(Boolean);
  return {
    comparisons,
    exists: true,
    reason: staleReasons.length > 0 ? staleReasons.join(", ") : "",
    staleReason: staleReasons.join(", "),
    status: staleReasons.length > 0 ? "stale-source-drift" : "current",
  };
}

function uniqueSortedStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort();
}

function setDiff(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function sameStringSet(left, right) {
  const normalizedLeft = uniqueSortedStrings(left);
  const normalizedRight = uniqueSortedStrings(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function failedProductionEnvGroupIdsFromPreflight(preflightReport) {
  const read = readJsonIfExists(preflightReport);
  const groups = Array.isArray(read.value?.blockerGroups) ? read.value.blockerGroups : [];
  return uniqueSortedStrings(
    groups
      .filter((group) => group?.category === "production-env" && group?.status === "fail")
      .map((group) => group.id),
  );
}

function summarizeEnvSkeletonStructure(envSkeletonArtifact, failedProductionEnvGroupIds) {
  const absolutePath = path.join(process.cwd(), envSkeletonArtifact);
  if (!fs.existsSync(absolutePath)) {
    return {
      activeKeyCount: 0,
      assignmentLineCount: 0,
      coversFailedProductionEnvGroups: false,
      exists: false,
      extraGroupMarkerIds: [],
      groupMarkerIds: [],
      malformedAssignmentLineCount: 0,
      missingGroupMarkerIds: failedProductionEnvGroupIds,
      missingPublicDefaultKeys: Object.keys(ENV_SKELETON_SAFE_PUBLIC_DEFAULTS),
      safeDefaultKeyCount: 0,
      unexpectedFilledValueKeys: [],
      publicDefaultsPresent: false,
      secretLikeValuesOmitted: false,
      status: "missing",
    };
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const groupMarkerIds = uniqueSortedStrings(
    content
      .split(/\r?\n/)
      .map((line) => /^#\s+(production-[A-Za-z0-9-]+)\s*$/.exec(line.trim())?.[1] || ""),
  );
  const assignments = [];
  let malformedAssignmentLineCount = 0;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) {
      malformedAssignmentLineCount += 1;
      continue;
    }
    assignments.push({
      key: match[1],
      value: match[2].trim(),
    });
  }

  const assignmentValues = new Map(assignments.map((assignment) => [assignment.key, assignment.value]));
  const missingPublicDefaultKeys = Object.entries(ENV_SKELETON_SAFE_PUBLIC_DEFAULTS)
    .filter(([key, value]) => assignmentValues.get(key) !== value)
    .map(([key]) => key)
    .sort();
  const unexpectedFilledValueKeys = uniqueSortedStrings(
    assignments
      .filter((assignment) => assignment.value && ENV_SKELETON_SAFE_PUBLIC_DEFAULTS[assignment.key] !== assignment.value)
      .map((assignment) => assignment.key),
  );
  const missingGroupMarkerIds = setDiff(failedProductionEnvGroupIds, groupMarkerIds);
  const extraGroupMarkerIds = setDiff(groupMarkerIds, failedProductionEnvGroupIds);
  const coversFailedProductionEnvGroups = missingGroupMarkerIds.length === 0;
  const publicDefaultsPresent = missingPublicDefaultKeys.length === 0;
  const secretLikeValuesOmitted = unexpectedFilledValueKeys.length === 0;
  const status =
    coversFailedProductionEnvGroups &&
    publicDefaultsPresent &&
    secretLikeValuesOmitted &&
    malformedAssignmentLineCount === 0
      ? "current"
      : "invalid-structure";

  return {
    activeKeyCount: assignments.length,
    assignmentLineCount: assignments.length,
    coversFailedProductionEnvGroups,
    exists: true,
    extraGroupMarkerIds,
    groupMarkerIds,
    malformedAssignmentLineCount,
    missingGroupMarkerIds,
    missingPublicDefaultKeys,
    safeDefaultKeyCount: Object.keys(ENV_SKELETON_SAFE_PUBLIC_DEFAULTS).length - missingPublicDefaultKeys.length,
    unexpectedFilledValueKeys,
    publicDefaultsPresent,
    secretLikeValuesOmitted,
    status,
  };
}

function summarizePaywallLaunchSourceFreshness(artifact, currentPaywallLaunchScope) {
  if (!artifact) {
    return {
      artifact: "",
      exists: false,
      result: "missing",
      status: "missing",
    };
  }
  const read = readJsonIfExists(artifact);
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      result: "missing",
      status: "missing",
    };
  }
  const value = read.value;
  const sourceArtifacts = isRecord(value.sourceArtifacts) ? value.sourceArtifacts : {};
  const currentSourceArtifacts = currentPaywallLaunchScope?.sourceArtifacts || {};
  const paywallSource = sourceArtifactEntry(sourceArtifacts, "paywall");
  const monetizationSource = sourceArtifactEntry(sourceArtifacts, "monetization");
  const currentPaywallSource = sourceArtifactEntry(currentSourceArtifacts, "paywall");
  const currentMonetizationSource = sourceArtifactEntry(currentSourceArtifacts, "monetization");
  const freshness = summarizeSourceFreshness([
    compareSourceHash({
      actualHash: paywallSource.sha256,
      actualPath: paywallSource.path,
      currentHash: currentPaywallSource.sha256 || sourceHashForPath("src/features/freed-app.tsx"),
      currentPath: currentPaywallSource.path || "src/features/freed-app.tsx",
      id: "paywall-source",
    }),
    compareSourceHash({
      actualHash: monetizationSource.sha256,
      actualPath: monetizationSource.path,
      currentHash: currentMonetizationSource.sha256 || sourceHashForPath("src/lib/monetization.ts"),
      currentPath: currentMonetizationSource.path || "src/lib/monetization.ts",
      id: "monetization-source",
    }),
  ]);
  const auditPassing = value.schemaVersion === "freed-paywall-launch-source-audit-v1" && value.sanitized === true && value.result === "pass";
  return {
    ...freshness,
    artifact,
    auditPassing,
    generatedAt: value.generatedAt || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    status: auditPassing ? freshness.status : "source-audit-not-passing",
  };
}

function summarizeConsoleProductSetupSourceFreshness(value, currentStoreCatalog) {
  if (!isRecord(value)) return summarizeSourceFreshness([], { exists: false });
  const currentSourceArtifacts = currentStoreCatalog?.sourceArtifacts || {};
  return summarizeSourceFreshness(
    STORE_CONSOLE_SOURCE_FRESHNESS_FIELDS.map((field) => {
      const currentSource = sourceArtifactEntry(currentSourceArtifacts, field.artifactKey);
      return compareSourceHash({
        actualHash: value[field.hashField],
        actualPath: value[field.pathField],
        currentHash: currentSource.sha256 || sourceHashForPath(value[field.pathField]),
        currentPath: currentSource.path || value[field.pathField] || "",
        id: field.id,
      });
    }),
  );
}

function summarizeStoreConsoleProductSetupTemplate(artifact, currentStoreCatalog) {
  if (!artifact) {
    return {
      artifact: "",
      exists: false,
      result: "missing",
      sourceFreshness: summarizeSourceFreshness([], { exists: false }),
      status: "missing",
    };
  }
  const read = readJsonIfExists(artifact);
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      result: "missing",
      sourceFreshness: summarizeSourceFreshness([], { exists: false }),
      status: "missing",
    };
  }
  const value = read.value;
  const checks = booleanCheckSummary(value.checks);
  const appStoreConnect = summarizeConsoleEvidencePlatform(isRecord(value.appStoreConnect) ? value.appStoreConnect : {});
  const googlePlay = summarizeConsoleEvidencePlatform(isRecord(value.googlePlay) ? value.googlePlay : {});
  const appRecordReadiness = summarizeConsoleAppRecordReadiness(value);
  const proofCaptured =
    value.schemaVersion === "freed-store-console-product-setup-report-v1" &&
    value.sanitized === true &&
    value.result === "store-console-product-setup-captured" &&
    value.consoleProductSetupProofUsableForManualEvidence === true &&
    checks.falseCount === 0 &&
    appRecordReadiness.readyForConsoleProductSetup === true &&
    appRecordReadiness.readOnlyBrowserInspection === true &&
    appRecordReadiness.storeMutationPerformed === false &&
    appRecordReadiness.accountIdentifiersRedacted === true &&
    appRecordReadiness.checkFalseCount === 0 &&
    appRecordReadiness.googlePlay.productSetupAllowed === true &&
    appRecordReadiness.appStoreConnect.productSetupAllowed === true &&
    appStoreConnect.pendingEvidenceArtifactCount === 0 &&
    googlePlay.pendingEvidenceArtifactCount === 0;
  return {
    appRecordReadiness,
    appStoreConnect,
    artifact,
    checkFalseCount: checks.falseCount,
    checkTotalCount: checks.totalCount,
    checkTrueCount: checks.trueCount,
    exists: true,
    googlePlay,
    proofCaptured,
    proofUsableForManualEvidence: value.consoleProductSetupProofUsableForManualEvidence === true,
    result: value.result || "",
    schema: value.schemaVersion || "",
    setupRunId: value.setupRunId || "",
    sourceFreshness: summarizeConsoleProductSetupSourceFreshness(value, currentStoreCatalog),
    status: proofCaptured ? "captured" : value.templateStatus || value.result || "pending",
  };
}

function summarizeStoreAppRecordActionPacket(artifact, markdownArtifact) {
  if (!artifact) {
    return {
      artifact: "",
      exists: false,
      markdownArtifact: markdownArtifact || "",
      result: "missing",
      status: "missing",
    };
  }
  const read = readJsonIfExists(artifact);
  const markdownExists = Boolean(markdownArtifact && fs.existsSync(path.join(process.cwd(), markdownArtifact)));
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      markdownArtifact: markdownArtifact || "",
      markdownExists,
      result: "missing",
      status: "missing",
    };
  }
  const value = isRecord(read.value) ? read.value : {};
  const browserReadiness = isRecord(value.browserReadiness) ? value.browserReadiness : {};
  const boundary = isRecord(value.externalMutationBoundary) ? value.externalMutationBoundary : {};
  const checks = isRecord(value.checks) ? value.checks : {};
  const hostedLegalReadiness = isRecord(value.hostedLegalReadiness) ? value.hostedLegalReadiness : {};
  const googlePlayPayload = isRecord(value.googlePlayAppRecordPayload) ? value.googlePlayAppRecordPayload : {};
  const appStorePayload = isRecord(value.appStoreConnectAppRecordPayload)
    ? value.appStoreConnectAppRecordPayload
    : {};
  const googlePlayReadiness = isRecord(browserReadiness.googlePlay) ? browserReadiness.googlePlay : {};
  const appStoreReadiness = isRecord(browserReadiness.appStoreConnect) ? browserReadiness.appStoreConnect : {};
  const afterAppRecordsExist = isRecord(value.afterAppRecordsExist) ? value.afterAppRecordsExist : {};
  const sourceFiles = Array.isArray(value.sourceFiles) ? value.sourceFiles.filter((entry) => isRecord(entry)) : [];
  const sourceFreshness = summarizeSourceFreshness(
    sourceFiles.map((entry) =>
      compareSourceHash({
        actualHash: entry.hash,
        actualPath: entry.path,
        currentHash: sourceHashForPath(entry.path),
        currentPath: entry.path || "",
        id: `app-record-packet-source:${entry.path || "missing"}`,
      }),
    ),
    { exists: sourceFiles.length > 0 },
  );
  const browserReadinessFreshness = summarizeSourceFreshness(
    [
      compareSourceHash({
        actualHash: browserReadiness.browserReportHash,
        actualPath: browserReadiness.browserReportPath,
        currentHash: sourceHashForPath(browserReadiness.browserReportPath),
        currentPath: browserReadiness.browserReportPath || "",
        id: "store-console-browser-readiness-report",
      }),
    ],
    { exists: Boolean(browserReadiness.browserReportPath) },
  );
  const hostedLegalFreshness = summarizeSourceFreshness(
    [
      compareSourceHash({
        actualHash: hostedLegalReadiness.hostedReportHash,
        actualPath: hostedLegalReadiness.hostedReportPath,
        currentHash: sourceHashForPath(hostedLegalReadiness.hostedReportPath),
        currentPath: hostedLegalReadiness.hostedReportPath || "",
        id: "store-legal-hosted-url-audit-report",
      }),
    ],
    { exists: Boolean(hostedLegalReadiness.hostedReportPath) },
  );
  const hardStops = Array.isArray(value.hardStops) ? value.hardStops : [];
  const requiredActionOrder = Array.isArray(value.requiredActionOrder) ? value.requiredActionOrder : [];
  const hostedLegalUrlEntryAllowed =
    hostedLegalReadiness.hostedLegalUrlsVerified === true &&
    hostedLegalReadiness.urlEntryAllowed === true &&
    boundary.legalUrlEntryAllowed === true;
  const usableForDraftAppRecordAction =
    value.schemaVersion === "freed-store-app-record-action-packet-v1" &&
    value.sanitized === true &&
    boundary.actionTimeConfirmationRequired === true &&
    boundary.confirmationToken === "confirm-draft-store-app-record-creation-only" &&
    boundary.noProductionApprovalGranted === true &&
    boundary.hostedLegalAuditRequiredBeforeUrlEntry === true &&
    checks.blocksProductionSubmission === true &&
    checks.blocksLegalUrlEntryUntilHostedLegalPasses === true &&
    checks.hostedLegalUrlsVerified === true &&
    hostedLegalUrlEntryAllowed &&
    checks.blocksProductSetupUntilReadinessPasses === true &&
    sourceFreshness.status === "current" &&
    browserReadinessFreshness.status === "current" &&
    hostedLegalFreshness.status === "current";
  return {
    actionTimeConfirmationRequired: boundary.actionTimeConfirmationRequired === true,
    appStoreConnect: {
      appRecordStatus: appStoreReadiness.appRecordStatus || "",
      destination: appStorePayload.destination || "",
      licenseAgreementStatus: appStoreReadiness.licenseAgreementStatus || "",
      productSetupAllowed: appStoreReadiness.productSetupAllowed === true,
    },
    artifact,
    browserReadiness: {
      browserReportHash: normalizeSha256Label(browserReadiness.browserReportHash || ""),
      browserReportPath: browserReadiness.browserReportPath || "",
      freshness: browserReadinessFreshness,
      readyForConsoleProductSetup: browserReadiness.readyForConsoleProductSetup === true,
      result: browserReadiness.result || "",
    },
    hostedLegalReadiness: {
      freshness: hostedLegalFreshness,
      hostedLegalUrlsVerified: hostedLegalReadiness.hostedLegalUrlsVerified === true,
      hostedReportHash: normalizeSha256Label(hostedLegalReadiness.hostedReportHash || ""),
      hostedReportPath: hostedLegalReadiness.hostedReportPath || "",
      result: hostedLegalReadiness.result || "",
      urlEntryAllowed: hostedLegalReadiness.urlEntryAllowed === true,
    },
    confirmationToken: boundary.confirmationToken || "",
    dataToTransmitCount: Array.isArray(boundary.dataToTransmit) ? boundary.dataToTransmit.length : 0,
    exists: true,
    googlePlay: {
      appRecordStatus: googlePlayReadiness.appRecordStatus || "",
      destination: googlePlayPayload.destination || "",
      productSetupAllowed: googlePlayReadiness.productSetupAllowed === true,
    },
    hardStopCount: hardStops.length,
    markdownArtifact: markdownArtifact || "",
    markdownExists,
    noProductionApprovalGranted: boundary.noProductionApprovalGranted === true,
    readOnlyBrowserInspection: browserReadiness.readOnlyBrowserInspection === true,
    requiredActionCount: requiredActionOrder.length,
    result: value.result || "",
    runId: value.runId || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || value.schema || "",
    sourceFreshness,
    status: usableForDraftAppRecordAction ? "ready-for-confirmed-draft-app-record-action" : value.result || "pending",
    storeMutationPerformed: browserReadiness.storeMutationPerformed === true,
    usableForDraftAppRecordAction,
    recheckCommand: afterAppRecordsExist.readOnlyBrowserReadinessCommand || "",
  };
}

function summarizeAdMobActionPacket(artifact, markdownArtifact, envPatchTemplateArtifact) {
  if (!artifact) {
    return {
      artifact: "",
      exists: false,
      markdownArtifact: markdownArtifact || "",
      result: "missing",
      status: "missing",
    };
  }
  const read = readJsonIfExists(artifact);
  const markdownExists = Boolean(markdownArtifact && fs.existsSync(path.join(process.cwd(), markdownArtifact)));
  if (!read.exists) {
    return {
      artifact,
      exists: false,
      markdownArtifact: markdownArtifact || "",
      markdownExists,
      result: "missing",
      status: "missing",
    };
  }
  const value = isRecord(read.value) ? read.value : {};
  const boundary = isRecord(value.externalMutationBoundary) ? value.externalMutationBoundary : {};
  const checks = isRecord(value.checks) ? value.checks : {};
  const sourceFiles = Array.isArray(value.sourceFiles) ? value.sourceFiles.filter((entry) => isRecord(entry)) : [];
  const sourceFreshness = summarizeSourceFreshness(
    sourceFiles.map((entry) =>
      compareSourceHash({
        actualHash: entry.hash,
        actualPath: entry.path,
        currentHash: sourceHashForPath(entry.path),
        currentPath: entry.path || "",
        id: `admob-action-packet-source:${entry.path || "missing"}`,
      }),
    ),
    { exists: sourceFiles.length > 0 },
  );
  const productionEnvKeys = Array.isArray(value.productionEnvKeys)
    ? value.productionEnvKeys.filter((entry) => isRecord(entry))
    : [];
  const configuredEnvKeys = productionEnvKeys.filter((entry) => entry.configured === true);
  const missingEnvKeys = productionEnvKeys
    .filter((entry) => entry.configured !== true)
    .map((entry) => String(entry.key || ""))
    .filter(Boolean);
  const requiredActionOrder = Array.isArray(value.requiredActionOrder)
    ? value.requiredActionOrder.filter((entry) => isRecord(entry))
    : [];
  const hardStops = Array.isArray(value.hardStops) ? value.hardStops : [];
  const placementPolicy = isRecord(value.adPlacementPolicy) ? value.adPlacementPolicy : {};
  const followUp = isRecord(value.followUp) ? value.followUp : {};
  const adMobEnvPatchTemplateArtifact =
    envPatchTemplateArtifact ||
    (followUp.adMobEnvPatchTemplate && artifact
      ? path.posix.join(path.posix.dirname(artifact), String(followUp.adMobEnvPatchTemplate))
      : "");
  const adMobEnvPatchTemplateExists = Boolean(
    adMobEnvPatchTemplateArtifact && fs.existsSync(path.join(process.cwd(), adMobEnvPatchTemplateArtifact)),
  );
  const usableForAdMobConsoleAction =
    value.schemaVersion === "freed-admob-action-packet-v1" &&
    value.sanitized === true &&
    boundary.actionTimeConfirmationRequired === true &&
    boundary.confirmationToken === "confirm-admob-app-and-rewarded-unit-creation-only" &&
    boundary.noProductionApprovalGranted === true &&
    checks.rewardedOnlyBoundaryRetained === true &&
    checks.noAdNetworkSecretsStored === true &&
    checks.platformSpecificEnvRequired === true &&
    sourceFreshness.status === "current";
  const readOnlyAdMobReadinessArtifact = followUp.readOnlyAdMobReadinessArtifact || "";
  return {
    actionTimeConfirmationRequired: boundary.actionTimeConfirmationRequired === true,
    artifact,
    confirmationToken: boundary.confirmationToken || "",
    currentBlocker: value.currentBlocker || "",
    envReady: checks.envReady === true,
    exists: true,
    hardStopCount: hardStops.length,
    markdownArtifact: markdownArtifact || "",
    markdownExists,
    missingEnvKeys,
    noProductionApprovalGranted: boundary.noProductionApprovalGranted === true,
    placementPolicy: {
      allowedFormats: Array.isArray(placementPolicy.allowedFormats) ? placementPolicy.allowedFormats : [],
      forbiddenFormats: Array.isArray(placementPolicy.forbiddenFormats) ? placementPolicy.forbiddenFormats : [],
      placement: placementPolicy.placement || "",
    },
    productionEnvConfiguredCount: configuredEnvKeys.length,
    productionEnvKeyCount: productionEnvKeys.length,
    result: value.result || "",
    runId: value.runId || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || value.schema || "",
    sourceFreshness,
    adMobEnvPatchTemplateArtifact,
    adMobEnvPatchTemplateExists,
    readOnlyAdMobReadiness: summarizeAdMobConsoleReadiness(readOnlyAdMobReadinessArtifact),
    readOnlyAdMobReadinessArtifact,
    readOnlyAdMobReadinessCommand: followUp.readOnlyAdMobReadinessCommand || "",
    status: usableForAdMobConsoleAction ? "ready-for-confirmed-admob-action" : value.result || "pending",
    storeAdSandboxCommand: followUp.storeAdSandboxCommand || "",
    usableForAdMobConsoleAction,
  };
}

function summarizeBrowserConnectorDiagnostic(value) {
  const connector = isRecord(value) ? value : {};
  const repairHandoff = isRecord(connector.repairHandoff) ? connector.repairHandoff : {};
  return {
    chromeNativeHostOk:
      connector.chromeNativeHostOk === null || connector.chromeNativeHostOk === undefined
        ? null
        : connector.chromeNativeHostOk === true,
    codexExtensionPresentInOtherChromeProfile:
      connector.codexExtensionPresentInOtherChromeProfile === true,
    connectorUnavailable: connector.connectorUnavailable === true,
    diagnosticIdentifiersRedacted: connector.diagnosticIdentifiersRedacted === true,
    nativeModuleLoadFailed: connector.nativeModuleLoadFailed === true,
    profileNamesStored: connector.profileNamesStored === true,
    profilePathsStored: connector.profilePathsStored === true,
    repairHandoff: {
      accountIdentifiersStored: repairHandoff.accountIdentifiersStored === true,
      profileIdentifiersStored: repairHandoff.profileIdentifiersStored === true,
      required: repairHandoff.required === true,
      status: repairHandoff.status || connector.status || "not-reported",
      steps: Array.isArray(repairHandoff.steps) ? repairHandoff.steps.filter(Boolean).map(String) : [],
    },
    selectedChromeProfileExtensionMissing:
      connector.selectedChromeProfileExtensionMissing === true,
    status: connector.status || "not-reported",
  };
}

function summarizeAdMobConsoleReadiness(artifact) {
  const read = readJsonIfExists(artifact || "");
  if (!read.exists) {
    return {
      artifact: artifact || "",
      browserConnector: summarizeBrowserConnectorDiagnostic(null),
      exists: false,
      readyForRewardedAdRequestProof: false,
      result: "missing",
    };
  }
  const value = isRecord(read.value) ? read.value : {};
  const blockers = Array.isArray(value.blockers) ? value.blockers.filter(Boolean).map(String) : [];
  const checks = Array.isArray(value.checks) ? value.checks : [];
  return {
    artifact,
    blockers,
    browserConnector: summarizeBrowserConnectorDiagnostic(value.browserConnector),
    exists: true,
    failCount: Number(value.failCount || checks.filter((check) => check.status === "fail").length),
    passCount: Number(value.passCount || checks.filter((check) => check.status === "pass").length),
    readyForRewardedAdRequestProof: value.readyForRewardedAdRequestProof === true,
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || value.schema || "",
    nextActions: Array.isArray(value.nextActions) ? value.nextActions.filter(Boolean).map(String) : [],
  };
}

function summarizeStoreAdSandboxCapture(currentArtifacts = {}) {
  const read = readJsonIfExists(DEFAULT_STORE_AD_SANDBOX_CAPTURE_MANIFEST);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_AD_SANDBOX_CAPTURE_MANIFEST,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  const configured = value.configured && typeof value.configured === "object" ? value.configured : {};
  const matrixRows = Array.isArray(value.matrixRows) ? value.matrixRows : [];
  const missingProductionConfig = [
    ["EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID", configured.entitlementId],
    ["EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT", configured.purchaseVerifyEndpoint],
    ["EXPO_PUBLIC_ADMOB_APP_ID_IOS", configured.adMobAppIdIos],
    ["EXPO_PUBLIC_ADMOB_APP_ID_ANDROID", configured.adMobAppIdAndroid],
    ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS", configured.rewardedAdUnitIdIos],
    ["EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID", configured.rewardedAdUnitIdAndroid],
  ]
    .filter(([, configuredValue]) => !String(configuredValue || "").trim())
    .map(([key]) => key);
  const companionArtifacts = Object.fromEntries(
    [
      "consolePaymentHandoffArtifact",
      "evidenceFillTemplateArtifact",
      "rewardedAdRequestTemplateArtifact",
      "paywallLaunchScopeTemplateArtifact",
      "paywallLaunchSourceAuditArtifact",
      "consoleProductSetupTemplateArtifact",
      "consoleExecutionRunbookArtifact",
      "storeSandboxTestPlanArtifact",
      "storeAppRecordActionPacketArtifact",
      "storeAppRecordActionPacketMarkdownArtifact",
      "adMobActionPacketArtifact",
      "adMobActionPacketMarkdownArtifact",
      "adMobEnvPatchTemplateArtifact",
      "interventionFlowTemplateArtifact",
      "privacyDisclosureTemplateArtifact",
      "matrixArtifact",
    ]
      .filter((field) => typeof value[field] === "string" && value[field].trim())
      .map((field) => [field, value[field]]),
  );
  const consoleProductSetup = summarizeStoreConsoleProductSetupTemplate(
    companionArtifacts.consoleProductSetupTemplateArtifact,
    currentArtifacts.storeCatalog,
  );
  const paywallLaunchSourceAudit = summarizePaywallLaunchSourceFreshness(
    companionArtifacts.paywallLaunchSourceAuditArtifact,
    currentArtifacts.paywallLaunchScope,
  );
  const appRecordActionPacket = summarizeStoreAppRecordActionPacket(
    companionArtifacts.storeAppRecordActionPacketArtifact,
    companionArtifacts.storeAppRecordActionPacketMarkdownArtifact,
  );
  const adMobActionPacket = summarizeAdMobActionPacket(
    companionArtifacts.adMobActionPacketArtifact,
    companionArtifacts.adMobActionPacketMarkdownArtifact,
    companionArtifacts.adMobEnvPatchTemplateArtifact,
  );
  const sourceFreshnessReasons = [
    paywallLaunchSourceAudit.status === "stale-source-drift"
      ? `paywall-launch-source-audit: ${paywallLaunchSourceAudit.staleReason}`
      : "",
    consoleProductSetup.sourceFreshness?.status === "stale-source-drift"
      ? `console-product-setup-template: ${consoleProductSetup.sourceFreshness.staleReason}`
      : "",
    appRecordActionPacket.sourceFreshness?.status === "stale-source-drift"
      ? `app-record-action-packet: ${appRecordActionPacket.sourceFreshness.staleReason}`
      : "",
    appRecordActionPacket.browserReadiness?.freshness?.status === "stale-source-drift"
      ? `app-record-browser-readiness: ${appRecordActionPacket.browserReadiness.freshness.staleReason}`
      : "",
    adMobActionPacket.sourceFreshness?.status === "stale-source-drift"
      ? `admob-action-packet: ${adMobActionPacket.sourceFreshness.staleReason}`
      : "",
  ].filter(Boolean);
  const sourceFreshnessStatus =
    sourceFreshnessReasons.length > 0
      ? "stale-source-drift"
      : paywallLaunchSourceAudit.status === "current" &&
          consoleProductSetup.sourceFreshness?.status === "current" &&
          appRecordActionPacket.sourceFreshness?.status === "current" &&
          appRecordActionPacket.browserReadiness?.freshness?.status === "current" &&
          adMobActionPacket.sourceFreshness?.status === "current"
        ? "current"
        : "incomplete";
  return {
    adMobActionPacket,
    appRecordActionPacket,
    artifact: DEFAULT_STORE_AD_SANDBOX_CAPTURE_MANIFEST,
    commandHandoff: value.commandHandoff || {},
    companionArtifacts,
    consoleProductSetup,
    configured: {
      adMobAppIdAndroidConfigured: Boolean(String(configured.adMobAppIdAndroid || "").trim()),
      adMobAppIdIosConfigured: Boolean(String(configured.adMobAppIdIos || "").trim()),
      adRequestCountryCode: configured.adRequestCountryCode || "",
      androidLaunchProductIds: configured.androidLaunchProductIds || {},
      entitlementConfigured: Boolean(String(configured.entitlementId || "").trim()),
      iosLaunchProductIds: configured.iosLaunchProductIds || {},
      purchaseVerifyEndpointConfigured: Boolean(String(configured.purchaseVerifyEndpoint || "").trim()),
      rewardedAdUnitIdAndroidConfigured: Boolean(String(configured.rewardedAdUnitIdAndroid || "").trim()),
      rewardedAdUnitIdIosConfigured: Boolean(String(configured.rewardedAdUnitIdIos || "").trim()),
      storeProvider: configured.storeProvider || "",
    },
    exists: true,
    manualVerificationRequired: value.manualVerificationRequired === true,
    matrixRowCount: matrixRows.length,
    missingProductionConfig,
    pendingManualQaCount: matrixRows.filter((row) => row.status === "pending-manual-qa").length,
    releaseBoundary:
      "Store/ad sandbox handoff only. Release still requires real App Store Connect and Play Console products, production AdMob app and rewarded unit IDs, server receipt verification, sandbox purchase/restore, rewarded-ad behavior, premium no-ad proof, and promoted evidence.",
    releaseEnvFileLoaded: value.releaseEnvFileLoaded === true,
    releaseGate: value.releaseGate || "",
    result: value.result || "",
    runId: value.runId || "",
    sanitized: value.sanitized === true || value.sanitizedOnly === true,
    schema: value.schema || value.schemaVersion || "",
    sourceFreshness: {
      appRecordActionPacket: appRecordActionPacket.sourceFreshness,
      appRecordBrowserReadiness: appRecordActionPacket.browserReadiness?.freshness,
      adMobActionPacket: adMobActionPacket.sourceFreshness,
      consoleProductSetup: consoleProductSetup.sourceFreshness,
      paywallLaunchSourceAudit,
      staleReason: sourceFreshnessReasons.join(", "),
      status: sourceFreshnessStatus,
    },
  };
}

function summarizeStoreConsoleBrowserReadiness() {
  const read = readJsonIfExists(DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT,
      exists: false,
      result: "missing",
      readyForConsoleProductSetup: false,
    };
  }
  const value = isRecord(read.value) ? read.value : {};
  const checks = Array.isArray(value.checks) ? value.checks : [];
  const blockers = Array.isArray(value.blockers) ? value.blockers.filter(Boolean).map(String) : [];
  const googlePlay = isRecord(value.googlePlay) ? value.googlePlay : {};
  const appStoreConnect = isRecord(value.appStoreConnect) ? value.appStoreConnect : {};
  const browserInspection = isRecord(value.browserInspection) ? value.browserInspection : {};
  return {
    appStoreConnect: {
      appRecordPresent: appStoreConnect.appRecordPresent === true,
      appRecordStatus: appStoreConnect.appRecordStatus || "",
      consoleHost: appStoreConnect.consoleHost || "",
      licenseAgreementAccepted: appStoreConnect.licenseAgreementAccepted === true,
      licenseAgreementStatus: appStoreConnect.licenseAgreementStatus || "",
      observedViaBrowser: appStoreConnect.observedViaBrowser === true,
      productSetupAllowed: appStoreConnect.productSetupAllowed === true,
    },
    artifact: DEFAULT_STORE_CONSOLE_BROWSER_READINESS_REPORT,
    blockers,
    browserInspection: {
      accountIdentifiersRedacted: browserInspection.accountIdentifiersRedacted === true,
      readOnly: browserInspection.readOnly === true,
      storeMutationPerformed: browserInspection.storeMutationPerformed === true,
    },
    browserConnector: summarizeBrowserConnectorDiagnostic(value.browserConnector),
    checkCount: checks.length,
    exists: true,
    failCount: Number(value.failCount || checks.filter((check) => check.status === "fail").length),
    googlePlay: {
      appRecordPresent: googlePlay.appRecordPresent === true,
      appRecordStatus: googlePlay.appRecordStatus || "",
      consoleHost: googlePlay.consoleHost || "",
      observedViaBrowser: googlePlay.observedViaBrowser === true,
      productSetupAllowed: googlePlay.productSetupAllowed === true,
    },
    markdownArtifact:
      "docs/validation/artifacts/store-console-browser-current/STORE_CONSOLE_BROWSER_READINESS.md",
    observedAt: value.observedAt || "",
    passCount: Number(value.passCount || checks.filter((check) => check.status === "pass").length),
    readyForConsoleProductSetup: value.readyForConsoleProductSetup === true,
    result: value.result || "",
    runId: value.runId || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || value.schema || "",
    nextActions: Array.isArray(value.nextActions) ? value.nextActions.filter(Boolean).map(String) : [],
  };
}

function summarizePermissionFlowAudit() {
  const read = readJsonIfExists(DEFAULT_PERMISSION_FLOW_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_PERMISSION_FLOW_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  return {
    androidFlowOrder: value.requiredFlowOrders?.android || "",
    artifact: DEFAULT_PERMISSION_FLOW_AUDIT_REPORT,
    exists: true,
    failCount: Number(value.failCount || 0),
    iosFlowOrder: value.requiredFlowOrders?.ios || "",
    passCount: Number(value.passCount || 0),
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
  };
}

function summarizeStoreLegalAudit() {
  const read = readJsonIfExists(DEFAULT_STORE_LEGAL_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_LEGAL_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  return {
    artifact: DEFAULT_STORE_LEGAL_AUDIT_REPORT,
    bundleId: value.bundleId || "",
    exists: true,
    failCount: Number(value.failCount || 0),
    packageName: value.packageName || "",
    passCount: Number(value.passCount || 0),
    publicUrls: value.publicUrls || {},
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
  };
}

function summarizeStoreLegalWebExportAudit() {
  const read = readJsonIfExists(DEFAULT_STORE_LEGAL_WEB_EXPORT_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_LEGAL_WEB_EXPORT_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  return {
    artifact: DEFAULT_STORE_LEGAL_WEB_EXPORT_AUDIT_REPORT,
    exists: true,
    exportDir: value.exportDir || "",
    failCount: Number(value.failCount || 0),
    passCount: Number(value.passCount || 0),
    publicUrls: value.publicUrls || {},
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    routeExports: Array.isArray(value.routeExports)
      ? value.routeExports.map((route) => ({
          htmlArtifact: route.htmlArtifact || "",
          id: route.id || "",
          publicUrl: route.publicUrl || "",
          routePath: route.routePath || "",
          sha256: route.sha256 || "",
          sizeBytes: Number(route.sizeBytes || 0),
        }))
      : [],
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
  };
}

function summarizeStoreLegalHostedUrlAudit() {
  const read = readJsonIfExists(DEFAULT_STORE_LEGAL_HOSTED_URL_AUDIT_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_LEGAL_HOSTED_URL_AUDIT_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  const freshness = summarizeArtifactFreshness(value.generatedAt, HOSTED_LEGAL_URL_AUDIT_FRESH_MS);
  const passing = value.sanitized === true && value.result === "pass" && Number(value.failCount || 0) === 0;
  return {
    artifact: DEFAULT_STORE_LEGAL_HOSTED_URL_AUDIT_REPORT,
    exists: true,
    failCount: Number(value.failCount || 0),
    freshness,
    generatedAt: value.generatedAt || "",
    passCount: Number(value.passCount || 0),
    publicUrls: value.publicUrls || {},
    releaseBoundary: value.releaseBoundary || "",
    result: value.result || "",
    routeResults: Array.isArray(value.routeResults)
      ? value.routeResults.map((route) => ({
          contentType: route.contentType || "",
          finalUrl: route.finalUrl || "",
          id: route.id || "",
          publicUrl: route.publicUrl || "",
          routePath: route.routePath || "",
          sizeBytes: Number(route.sizeBytes || 0),
          status: Number(route.status || 0),
        }))
      : [],
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    status: passing ? freshness.status : "failing",
    usableForStoreSubmission: passing && freshness.fresh,
  };
}

function summarizeStoreLegalWebDeploySourceFreshness(value, currentWebExport) {
  if (!isRecord(value)) return summarizeSourceFreshness([], { exists: false });
  const currentRoutes = new Map(
    (Array.isArray(currentWebExport?.routeExports) ? currentWebExport.routeExports : []).map((route) => [route.id, route]),
  );
  const routes = Array.isArray(value.routeExports) ? value.routeExports : [];
  return summarizeSourceFreshness(
    routes.map((route) => {
      const currentRoute = currentRoutes.get(route.id) || {};
      return compareSourceHash({
        actualHash: route.sha256,
        actualPath: route.htmlArtifact,
        currentHash: currentRoute.sha256 || sourceHashForPath(route.htmlArtifact),
        currentPath: currentRoute.htmlArtifact || route.htmlArtifact || "",
        id: `legal-route-${route.id || "missing-id"}`,
      });
    }),
  );
}

function summarizeStoreLegalWebDeployPacket(currentWebExport) {
  const read = readJsonIfExists(DEFAULT_STORE_LEGAL_WEB_DEPLOY_PACKET_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_STORE_LEGAL_WEB_DEPLOY_PACKET_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  const sourceFreshness = summarizeStoreLegalWebDeploySourceFreshness(value, currentWebExport);
  return {
    artifact: DEFAULT_STORE_LEGAL_WEB_DEPLOY_PACKET_REPORT,
    deployBlockedBy: Array.isArray(value.deployBlockedBy) ? value.deployBlockedBy : [],
    easDeployment: isRecord(value.easDeployment)
      ? {
          accountLoggedIn: value.easDeployment.accountLoggedIn === true,
          artifact: value.easDeployment.artifact || "",
          approvedForDeploy: value.easDeployment.approvedForDeploy === true,
          deploymentBlockedBy: Array.isArray(value.easDeployment.deploymentBlockedBy)
            ? value.easDeployment.deploymentBlockedBy
            : [],
          deploymentAttempted: value.easDeployment.deploymentAttempted === true,
          freshness: isRecord(value.easDeployment.freshness)
            ? {
                newerSourceReports: Array.isArray(value.easDeployment.freshness.newerSourceReports)
                  ? value.easDeployment.freshness.newerSourceReports.map((source) => ({
                      artifact: source.artifact || "",
                      generatedAt: source.generatedAt || "",
                      id: source.id || "",
                    }))
                  : [],
                staleReason: value.easDeployment.freshness.staleReason || "",
                status: value.easDeployment.freshness.status || "",
                usableForCurrentSourceReports:
                  value.easDeployment.freshness.usableForCurrentSourceReports === true,
              }
            : {
                newerSourceReports: [],
                staleReason: "eas-readiness-freshness-missing",
                status: "missing",
                usableForCurrentSourceReports: false,
              },
          generatedAt: value.easDeployment.generatedAt || "",
          projectIdConfigured: value.easDeployment.projectIdConfigured === true,
          projectIdFormat: value.easDeployment.projectIdFormat || "missing",
          projectIdSource: value.easDeployment.projectIdSource || "missing",
          projectLinked: value.easDeployment.projectLinked === true,
          readyForCurrentApprovedDeploy: value.easDeployment.readyForCurrentApprovedDeploy === true,
          readyForApprovedDeploy: value.easDeployment.readyForApprovedDeploy === true,
          result: value.easDeployment.result || "",
          usableForCurrentSourceReports: value.easDeployment.usableForCurrentSourceReports === true,
        }
      : null,
    exists: true,
    hostedVerified: value.hostedVerified === true,
    markdownArtifact: "docs/validation/artifacts/store-legal-web-deploy-current/STORE_LEGAL_WEB_DEPLOY_PACKET.md",
    publicUrls: value.publicUrls || {},
    releaseBoundary: value.releaseBoundary || "",
    result: sourceFreshness.status === "stale-source-drift" ? "stale-source-drift" : value.result || "",
    legalWebDeployEnvTemplate: isRecord(value.legalWebDeployEnvTemplate)
      ? {
          activeApprovalPrefilled: value.legalWebDeployEnvTemplate.activeApprovalPrefilled === true,
          approvalEnv: value.legalWebDeployEnvTemplate.approvalEnv || "",
          approvalExpectedValue: value.legalWebDeployEnvTemplate.approvalExpectedValue || "",
          artifact: value.legalWebDeployEnvTemplate.artifact || "",
          created: value.legalWebDeployEnvTemplate.created === true,
          keys: Array.isArray(value.legalWebDeployEnvTemplate.keys)
            ? value.legalWebDeployEnvTemplate.keys.filter(Boolean).map(String)
            : [],
          reason: value.legalWebDeployEnvTemplate.reason || "",
          sha256: value.legalWebDeployEnvTemplate.sha256 || "",
        }
      : null,
    routeExports: Array.isArray(value.routeExports)
      ? value.routeExports.map((route) => ({
          hostedStatus: Number(route.hostedStatus || 0),
          htmlArtifact: route.htmlArtifact || "",
          id: route.id || "",
          publicUrl: route.publicUrl || "",
          routePath: route.routePath || "",
          sha256: route.sha256 || "",
        }))
      : [],
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    sourceFreshness,
    staticExportReady: value.staticExportReady === true,
    staticHostingBundle: isRecord(value.staticHostingBundle)
      ? {
          archiveArtifact: value.staticHostingBundle.archiveArtifact || "",
          archiveCreated: value.staticHostingBundle.archiveCreated === true,
          archiveSha256: value.staticHostingBundle.archiveSha256 || "",
          bundleDir: value.staticHostingBundle.bundleDir || "",
          fileCount: Number(value.staticHostingBundle.fileCount || 0),
          generated: value.staticHostingBundle.generated === true,
          manifestArtifact: value.staticHostingBundle.manifestArtifact || "",
          manifestSha256: value.staticHostingBundle.manifestSha256 || "",
          reason: value.staticHostingBundle.reason || "",
          totalBytes: Number(value.staticHostingBundle.totalBytes || 0),
        }
      : null,
  };
}

function reportFileSourceComparison(fileEntry, id) {
  const reportedPath = isRecord(fileEntry) ? fileEntry.path || "" : "";
  return compareSourceHash({
    actualHash: isRecord(fileEntry) ? fileEntry.sha256 || "" : "",
    actualPath: reportedPath,
    currentHash: sourceHashForPath(reportedPath),
    currentPath: reportedPath,
    id,
  });
}

function summarizeSupabaseSourceFreshness(files) {
  if (!isRecord(files)) return summarizeSourceFreshness([], { exists: false });
  const comparisons = [
    reportFileSourceComparison(files.schema, "supabase-schema"),
    reportFileSourceComparison(files.productionBackendPacket, "production-backend-packet"),
    reportFileSourceComparison(files.edgeConfig, "supabase-edge-config"),
    reportFileSourceComparison(files.edgeShared, "supabase-edge-shared-contract"),
  ];
  const migrations = Array.isArray(files.migrations) ? files.migrations : [];
  for (const migration of migrations) {
    const migrationPath = isRecord(migration) ? migration.path || "" : "";
    const id = migrationPath ? `migration-${path.basename(migrationPath, ".sql")}` : "migration-missing-path";
    comparisons.push(reportFileSourceComparison(migration, id));
  }
  return summarizeSourceFreshness(comparisons);
}

function summarizePacketSourceFreshness(sourceArtifacts, packetId) {
  if (!Array.isArray(sourceArtifacts) || sourceArtifacts.length === 0) {
    return summarizeSourceFreshness([], { exists: false });
  }
  return summarizeSourceFreshness(
    sourceArtifacts.map((sourceArtifact) =>
      compareSourceHash({
        actualHash: sourceArtifact.sha256,
        actualPath: sourceArtifact.path,
        currentHash: sourceHashForPath(sourceArtifact.path),
        currentPath: sourceArtifact.path || "",
        id: `${packetId}-${path.basename(sourceArtifact.path || "missing-source")}`,
      }),
    ),
  );
}

function summarizeSupabaseDeploymentPacket() {
  const read = readJsonIfExists(DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT);
  if (!read.exists) {
    return {
      artifact: DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT,
      exists: false,
      result: "missing",
    };
  }
  const value = read.value;
  const summary = value.summary && typeof value.summary === "object" ? value.summary : {};
  const deploymentTarget =
    value.deploymentTarget && typeof value.deploymentTarget === "object" ? value.deploymentTarget : {};
  const blockerGroups = Array.isArray(value.releaseBlockerHandoff?.productionBlockerGroups)
    ? value.releaseBlockerHandoff.productionBlockerGroups
    : [];
  const deployCommands = Array.isArray(value.commands?.deploy) ? value.commands.deploy : [];
  const smokeCommands = Array.isArray(value.commands?.smoke) ? value.commands.smoke : [];
  const files = value.files && typeof value.files === "object" ? value.files : {};
  const secretBoundary = value.secretBoundary && typeof value.secretBoundary === "object" ? value.secretBoundary : {};
  const passCount = Number(summary.passCount || 0);
  const warnCount = Number(summary.warnCount || 0);
  const failCount = Number(summary.failCount || 0);
  const sourceFreshness = summarizeSupabaseSourceFreshness(files);
  return {
    artifact: DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT,
    backendBlockerGroupIds: blockerGroups.map((group) => group.id).filter(Boolean),
    deployCommands,
    deploymentTarget: {
      activeProjectConfirmed: deploymentTarget.activeProjectConfirmed === true,
      projectName: deploymentTarget.projectName || "",
      projectRefConfigured: Boolean(deploymentTarget.projectRef),
      projectRefShapeOk: deploymentTarget.projectRefShapeOk === true,
      projectStatus: deploymentTarget.projectStatus || "",
      statusNote: deploymentTarget.statusNote || "",
    },
    exists: true,
    failCount,
    fileHashes: {
      edgeConfig: files.edgeConfig?.sha256 ? `sha256-${files.edgeConfig.sha256}` : "",
      productionBackendPacket: files.productionBackendPacket?.sha256
        ? `sha256-${files.productionBackendPacket.sha256}`
        : "",
      schema: files.schema?.sha256 ? `sha256-${files.schema.sha256}` : "",
    },
    passCount,
    pendingExternalActions: Array.isArray(value.pendingExternalActions) ? value.pendingExternalActions : [],
    releaseBoundary:
      "Backend deployment handoff only. Release still requires a live production project, production env secrets outside the repo, deployed smoke reports, store sandbox evidence, and physical-device evidence.",
    result:
      failCount > 0
        ? "fail"
        : sourceFreshness.status === "stale-source-drift"
          ? "stale-source-drift"
          : warnCount > 0
            ? "pending-live-project"
            : "ready-for-deploy-smoke",
    sanitized: value.sanitized === true,
    schema: value.schemaVersion || "",
    secretValuesOmitted: secretBoundary.secretValuesOmitted === true,
    sourceFreshness,
    smokeCommands,
    warnCount,
  };
}

function summarizeAndroidUploadSigning() {
  const aabRead = readJsonIfExists(DEFAULT_ANDROID_SIGNING_AAB_REPORT);
  const preflightRead = readJsonIfExists(DEFAULT_ANDROID_SIGNING_PREFLIGHT_REPORT);
  const signing = aabRead.value?.signing || null;
  const releaseBoundary = aabRead.value?.releaseBoundary || {};
  const uploadKeystore = signing?.uploadKeystore || {};
  const preflightGroups = Array.isArray(preflightRead.value?.blockerGroups) ? preflightRead.value.blockerGroups : [];
  const preflightSigningGroup = preflightGroups.find((group) => group.id === "production-android-signing") || null;
  const signingReady =
    aabRead.exists &&
    signing?.mode === "upload-signing" &&
    signing?.playConsoleReady === true &&
    signing?.storeFileExists === true &&
    uploadKeystore.checked === true &&
    uploadKeystore.debugSigned === false &&
    preflightSigningGroup?.status === "pass";
  const blockedByProductionAdMob =
    aabRead.exists &&
    String(releaseBoundary.reason || "").includes("production Android AdMob app ID");

  return {
    aabReportArtifact: DEFAULT_ANDROID_SIGNING_AAB_REPORT,
    preflightArtifact: DEFAULT_ANDROID_SIGNING_PREFLIGHT_REPORT,
    exists: aabRead.exists || preflightRead.exists,
    status: signingReady
      ? blockedByProductionAdMob
        ? "upload-signing-ready-admob-blocked"
        : "upload-signing-ready"
      : aabRead.exists || preflightRead.exists
        ? "incomplete"
        : "missing",
    releaseEvidenceSatisfied: false,
    releaseBoundary:
      "Upload-signing proof only. Play/App Store release still requires production AdMob, production monetization/backend env, deployed smoke reports, and physical-device/store sandbox evidence.",
    aab: aabRead.exists
      ? {
          artifactType: aabRead.value.artifactType || "",
          buildResult: aabRead.value.buildResult || "",
          gradleInvoked: releaseBoundary.gradleInvoked === true,
          releaseEnvFileLoaded: releaseBoundary.releaseEnvFileLoaded === true,
          releaseEnvFileSource: releaseBoundary.releaseEnvFileSource || "",
          result: aabRead.value.result || "",
          schema: aabRead.value.schema || "",
          uploadSignedBuildProduced: releaseBoundary.uploadSignedBuildProduced === true,
          reason: releaseBoundary.reason || "",
        }
      : null,
    preflight: preflightRead.exists
      ? {
          passCount: Number(preflightRead.value.passCount || 0),
          failCount: Number(preflightRead.value.failCount || 0),
          productionAndroidSigningStatus: preflightSigningGroup?.status || "",
          result: preflightRead.value.result || "",
          sanitized: preflightRead.value.sanitized === true,
          source: preflightRead.value.source || "",
        }
      : null,
    signing: signing
      ? {
          mode: signing.mode || "",
          missingInputs: Array.isArray(signing.missingInputs) ? signing.missingInputs : [],
          playConsoleReady: signing.playConsoleReady === true,
          required: signing.required === true,
          storeFileConfigured: signing.storeFileConfigured === true,
          storeFileExists: signing.storeFileExists === true,
          uploadKeystore: {
            checked: uploadKeystore.checked === true,
            debugSigned: uploadKeystore.debugSigned === true,
            certificateSha256Digest: uploadKeystore.certificateSha256Digest || "",
          },
        }
      : null,
  };
}

function summarizePreflight(preflightReport) {
  const productionEnvGapChecklist = relatedProductionEnvGapChecklist(preflightReport);
  const read = readJsonIfExists(preflightReport);
  if (!read.exists) {
    return {
      artifact: preflightReport,
      exists: false,
      result: "missing",
      sanitized: false,
      blockerGroups: [],
      productionEnvGapChecklist,
      releaseBlockingGroupCount: 0,
    };
  }
  const report = read.value;
  const blockerGroups = Array.isArray(report.blockerGroups)
    ? report.blockerGroups.map((group) => ({
        category: group.category || "",
        captureHelperCommand: group.captureHelperCommand || "",
        evidenceFile: group.evidenceFile || "",
        id: group.id,
        requiredEnv: Array.isArray(group.requiredEnv) ? group.requiredEnv : [],
        requiredReports: Array.isArray(group.requiredReports) ? group.requiredReports : [],
        status: group.status || "",
      }))
    : [];
  return {
    artifact: preflightReport,
    blockerGroups,
    exists: true,
    failCount: Number(report.failCount || 0),
    passCount: Number(report.passCount || 0),
    productionEnvGapChecklist,
    releaseBlockingGroupCount: blockerGroups.filter((group) => group.status === "fail").length,
    result: report.result || "",
    sanitized: report.sanitized === true,
    schema: report.schema || "",
    source: report.source || "",
  };
}

function summarizePacket(packet) {
  const candidateArtifacts = [packet.artifact, ...(packet.artifactCandidates || [])];
  const read = readFirstJsonIfExists(candidateArtifacts);
  if (!read.exists) {
    return {
      ...packet,
      artifact: read.artifact || packet.artifact,
      artifactCandidates: candidateArtifacts,
      exists: false,
      releaseEvidenceSatisfied: false,
      status: "missing",
    };
  }
  const value = read.value;
  const explicitSatisfied = value.evidenceSatisfied === true;
  const hasPassingResult = typeof value.result === "string" && /\bpass(?:ed)?\b/i.test(value.result);
  const reportedStatus = String(value.result || value.templateStatus || "").trim();
  const device = value.device && typeof value.device === "object" ? value.device : null;
  const manualFlows = Array.isArray(value.manualFlows) ? value.manualFlows : [];
  const sourceArtifacts = Array.isArray(value.sourceArtifacts)
    ? value.sourceArtifacts
        .filter((artifact) => isRecord(artifact))
        .map((artifact) => ({
          path: artifact.path || "",
          sha256: normalizeSha256Label(artifact.sha256 || ""),
        }))
    : [];
  const sourceFreshness = SOURCE_FRESHNESS_HANDOFF_PACKET_IDS.has(packet.id)
    ? summarizePacketSourceFreshness(sourceArtifacts, packet.id)
    : null;
  const deviceDiscoveryFreshness = DEVICE_DISCOVERY_HANDOFF_PACKET_IDS.has(packet.id)
    ? summarizeArtifactFreshness(value.generatedAt, DEVICE_DISCOVERY_FRESH_MS)
    : null;
  const companionArtifacts = Object.fromEntries(
    [
      "consolePaymentHandoffArtifact",
      "evidenceFillTemplateArtifact",
      "paywallLaunchScopeTemplateArtifact",
      "consoleProductSetupTemplateArtifact",
      "rewardedAdRequestTemplateArtifact",
      "paywallLaunchSourceAuditArtifact",
      "storeSandboxTestPlanArtifact",
      "privacyDisclosureTemplateArtifact",
      "matrixArtifact",
    ]
      .filter((field) => typeof value[field] === "string" && value[field].trim())
      .map((field) => [field, value[field]]),
  );
  return {
    ...packet,
    artifact: read.artifact,
    artifactCandidates: candidateArtifacts,
    appPackageProof: value.appPackageProof || "",
    companionArtifacts,
    deviceDetailsArtifact: value.deviceDetailsArtifact || "",
    deviceListArtifact: value.deviceListArtifact || value.xctraceDevicesArtifact || value.devicectlDevicesArtifact || "",
    deviceListSource: value.deviceListSource || (value.devicectlDevicesArtifact ? "devicectl" : value.xctraceDevicesArtifact ? "xctrace" : ""),
    devicectlDevicesArtifact: value.devicectlDevicesArtifact || "",
    devicectlErrorArtifact: value.devicectlErrorArtifact || "",
    errorArtifact: value.errorArtifact || "",
    xctraceErrorArtifact: value.xctraceErrorArtifact || "",
    deviceSummary: device
      ? {
          isSimulator: device.isSimulator === true,
          name: sanitizeIosDeviceNameForStatus(device),
          deviceNameRedacted: device.isSimulator !== true,
          osVersion: device.osVersion || "",
          source: device.source || "",
        }
      : null,
    evidenceBoundary: value.evidenceBoundary || "",
    exists: true,
    generatedAt: value.generatedAt || "",
    deviceDiscoveryFreshness,
    manualVerificationRequired: value.manualVerificationRequired === true,
    manualFlowCount: manualFlows.length,
    next: typeof value.next === "string" && value.next.trim() ? value.next.trim() : packet.next || "",
    outputDir: value.outputDir || "",
    physicalDeviceCount: Number.isFinite(value.physicalDeviceCount) ? value.physicalDeviceCount : null,
    readyDeviceCount: Number.isFinite(value.readyDeviceCount) ? value.readyDeviceCount : null,
    readyPhysicalCandidateCount: Number.isFinite(value.readyPhysicalCandidateCount)
      ? value.readyPhysicalCandidateCount
      : null,
    releaseEvidenceSatisfied: explicitSatisfied && hasPassingResult,
    releaseGate: value.releaseGate || "",
    result: value.result || "",
    runId: value.runId || "",
    schema: value.schema || value.schemaVersion || "",
    sourceArtifacts,
    sourceFreshness,
    staleReason: "",
    status: explicitSatisfied && hasPassingResult ? "complete" : reportedStatus || "pending",
    xctraceDevicesArtifact: value.xctraceDevicesArtifact || "",
    xctraceErrorArtifact: value.xctraceErrorArtifact || "",
  };
}

function applyHandoffPacketCrossChecks(packets, context = {}) {
  const iosDiscovery = packets.find((packet) => packet.id === "ios-device-discovery");
  return packets.map((packet) => {
    if (DEVICE_DISCOVERY_HANDOFF_PACKET_IDS.has(packet.id) && packet.exists && packet.deviceDiscoveryFreshness) {
      if (packet.deviceDiscoveryFreshness.status !== "current") {
        return {
          ...packet,
          deviceDiscoveryFreshnessStatus: packet.deviceDiscoveryFreshness.status,
          releaseEvidenceSatisfied: false,
          staleReason: `device-discovery-${packet.deviceDiscoveryFreshness.status}`,
          status: "stale-device-discovery",
        };
      }
      if (/device-discovery-failed/i.test(String(packet.result || ""))) {
        return {
          ...packet,
          deviceDiscoveryFreshnessStatus: packet.deviceDiscoveryFreshness.status,
          releaseEvidenceSatisfied: false,
          staleReason: "device-discovery-tooling-failed",
          status: "device-discovery-failed",
        };
      }
      if (Number(packet.readyPhysicalCandidateCount ?? packet.readyDeviceCount ?? 0) <= 0) {
        const resultStatus = String(packet.result || "").trim() || "no-ready-device";
        return {
          ...packet,
          deviceDiscoveryFreshnessStatus: packet.deviceDiscoveryFreshness.status,
          releaseEvidenceSatisfied: false,
          staleReason: `device-discovery-result-${resultStatus}`,
          status: resultStatus,
        };
      }
      return {
        ...packet,
        deviceDiscoveryFreshnessStatus: packet.deviceDiscoveryFreshness.status,
        status: String(packet.result || "").trim() || packet.status,
      };
    }
    if (packet.id === "store-ad-sandbox" && packet.exists) {
      const sourceFreshness = context.storeAdSandbox?.sourceFreshness || null;
      if (!sourceFreshness) return packet;
      const staleReason = sourceFreshness.staleReason || "";
      if (sourceFreshness.status === "stale-source-drift") {
        return {
          ...packet,
          releaseEvidenceSatisfied: false,
          staleReason,
          status: "stale-store-source-drift",
          storeSourceFreshnessStatus: sourceFreshness.status,
        };
      }
      return {
        ...packet,
        storeSourceFreshnessStatus: sourceFreshness.status,
      };
    }
    if (SOURCE_FRESHNESS_HANDOFF_PACKET_IDS.has(packet.id) && packet.exists && packet.sourceFreshness) {
      const staleReason = packet.sourceFreshness.staleReason || packet.sourceFreshness.reason || "";
      if (packet.sourceFreshness.status !== "current") {
        return {
          ...packet,
          releaseEvidenceSatisfied: false,
          sourceFreshnessStatus: packet.sourceFreshness.status,
          staleReason,
          status: packet.sourceFreshness.status === "missing" ? "missing-source-proof" : "stale-source-drift",
        };
      }
      return {
        ...packet,
        sourceFreshnessStatus: packet.sourceFreshness.status,
      };
    }
    if (packet.id !== "ios-physical-capture" || !packet.exists) return packet;
    const staleReasons = [];
    const readyPhysicalCandidates = Number(iosDiscovery?.readyPhysicalCandidateCount || iosDiscovery?.readyDeviceCount || 0);
    const discoveryResult = String(iosDiscovery?.result || "");
    const captureDeviceSource = String(packet.deviceSummary?.source || "");
    if (iosDiscovery?.exists && readyPhysicalCandidates === 0) {
      staleReasons.push("current-ios-device-discovery-has-no-ready-physical-device");
    }
    if (iosDiscovery?.deviceDiscoveryFreshness?.status && iosDiscovery.deviceDiscoveryFreshness.status !== "current") {
      staleReasons.push(`current-ios-device-discovery-${iosDiscovery.deviceDiscoveryFreshness.status}`);
    }
    if (/device-discovery-failed/i.test(discoveryResult)) {
      staleReasons.push("current-ios-device-discovery-tooling-failed");
    }
    if (/offline|not-ready|no-physical-device|missing/i.test(discoveryResult)) {
      staleReasons.push(`current-ios-device-discovery-result-${discoveryResult}`);
    }
    if (/offline/i.test(captureDeviceSource)) {
      staleReasons.push("capture-device-was-offline");
    }
    if (staleReasons.length === 0) return { ...packet, deviceReadyForCapture: true };
    return {
      ...packet,
      deviceReadyForCapture: false,
      releaseEvidenceSatisfied: false,
      staleReason: staleReasons.join(", "),
      status: "blocked-device-not-ready",
    };
  });
}

function summarizePlatformDeviceReadiness(packet, platform) {
  const platformLabel = platform === "ios" ? "iOS" : "Android";
  const connectInstruction =
    platform === "ios"
      ? "Connect, unlock, and trust a physical iOS device"
      : "Connect and unlock a physical Android device, and authorize USB debugging for this Mac";
  const exists = packet?.exists === true;
  const freshnessStatus = packet?.deviceDiscoveryFreshness?.status || (exists ? "missing-generatedAt" : "missing");
  const readyPhysicalCandidateCount = Number(
    packet?.readyPhysicalCandidateCount ?? packet?.readyDeviceCount ?? 0,
  );
  const readyDeviceCount = Number(packet?.readyDeviceCount ?? 0);
  const discoveryCurrent = freshnessStatus === "current";
  const discoveryResult = String(packet?.result || (exists ? "" : "missing"));
  const toolingFailed = exists && discoveryCurrent && /device-discovery-failed/i.test(discoveryResult);
  const captureReady = exists && discoveryCurrent && readyPhysicalCandidateCount > 0;
  const packetNext = typeof packet?.next === "string" && packet.next.trim() ? packet.next.trim() : "";
  const next = !exists
    ? `Run the ${platformLabel} device discovery command before attempting physical-device evidence capture.`
    : !discoveryCurrent
      ? `Refresh ${platformLabel} device discovery; current discovery freshness is ${freshnessStatus}.`
      : toolingFailed
        ? packetNext || `Fix ${platformLabel} device discovery tooling, then rerun discovery before capture.`
      : readyPhysicalCandidateCount <= 0
        ? packetNext || `${connectInstruction}, then rerun discovery before capture.`
        : `Run the ${platformLabel} physical evidence capture command on the ready device.`;

  return {
    artifact: packet?.artifact || "",
    captureReady,
    discoveryFreshness: freshnessStatus,
    exists,
    generatedAt: packet?.generatedAt || "",
    deviceListArtifact: packet?.deviceListArtifact || "",
    deviceListSource: packet?.deviceListSource || "",
    devicectlErrorArtifact: packet?.devicectlErrorArtifact || "",
    errorArtifact: packet?.errorArtifact || "",
    xctraceErrorArtifact: packet?.xctraceErrorArtifact || "",
    next,
    readyDeviceCount,
    readyPhysicalCandidateCount,
    result: discoveryResult,
    status: captureReady ? "capture-ready" : toolingFailed ? "device-discovery-failed" : "not-ready",
    staleReason: packet?.staleReason || "",
    toolingFailed,
  };
}

function summarizePhysicalDeviceReadiness(handoffPackets) {
  const androidDiscovery = handoffPackets.find((packet) => packet.id === "android-device-discovery");
  const iosDiscovery = handoffPackets.find((packet) => packet.id === "ios-device-discovery");
  const android = summarizePlatformDeviceReadiness(androidDiscovery, "android");
  const ios = summarizePlatformDeviceReadiness(iosDiscovery, "ios");
  return {
    android,
    ios,
    overallStatus: android.captureReady && ios.captureReady ? "capture-ready" : "physical-device-capture-blocked",
    releaseBoundary:
      "Current device discovery only. Store release still requires promoted Android real-browser, iOS physical-device, normal-browsing, performance, store/ad sandbox, and AI backend evidence.",
  };
}

function buildStatus(options) {
  const preflight = summarizePreflight(options.preflightReport);
  const androidDownload = latestApkArtifact();
  const androidCurrentBuildFailure = summarizeAndroidCurrentBuildFailure(androidDownload);
  const easBuildHandoff = summarizeEasBuildHandoff();
  const easBuildAttempt = summarizeEasBuildAttempt();
  const androidDownloadHandoff = summarizeAndroidDownloadHandoff(androidDownload);
  const storeCatalog = summarizeStoreCatalogAudit();
  const storeListingScreenshotHandoff = summarizeStoreListingScreenshotHandoff();
  const paywallLaunchScope = summarizePaywallLaunchScopeAudit();
  const storeAdSandbox = summarizeStoreAdSandboxCapture({ storeCatalog, paywallLaunchScope });
  const storeConsoleBrowserReadiness = summarizeStoreConsoleBrowserReadiness();
  const permissionFlow = summarizePermissionFlowAudit();
  const storeLegal = summarizeStoreLegalAudit();
  const storeLegalWebExport = summarizeStoreLegalWebExportAudit();
  const storeLegalHostedUrl = summarizeStoreLegalHostedUrlAudit();
  const storeLegalWebDeploy = summarizeStoreLegalWebDeployPacket(storeLegalWebExport);
  const supabaseDeployment = summarizeSupabaseDeploymentPacket();
  const androidUploadSigning = summarizeAndroidUploadSigning();
  const handoffPackets = applyHandoffPacketCrossChecks(HANDOFF_PACKETS.map(summarizePacket), { storeAdSandbox });
  const physicalDeviceReadiness = summarizePhysicalDeviceReadiness(handoffPackets);
  const requiredPacketsMissing = handoffPackets.filter((packet) => packet.requiredForRelease && !packet.exists);
  const requiredPacketsStillPending = handoffPackets.filter(
    (packet) => packet.requiredForRelease && packet.exists && !packet.releaseEvidenceSatisfied,
  );
  const hostedLegalUrlsReady =
    storeLegalHostedUrl.exists &&
    storeLegalHostedUrl.sanitized &&
    storeLegalHostedUrl.result === "pass" &&
    storeLegalHostedUrl.failCount === 0 &&
    storeLegalHostedUrl.freshness?.status === "current";
  const storeListingScreenshotsReady =
    storeCatalog.exists === true && storeCatalog.listingScreenshotReadiness?.readyForStoreUpload === true;
  const listingScreenshotBlocker = storeListingScreenshotsReady
    ? ""
    : storeCatalog.listingScreenshotReadiness?.manifestPath
      ? `final public listing screenshot manifest (${storeCatalog.listingScreenshotReadiness.manifestPath})`
      : "final public listing screenshot manifest (store/screenshots/listing/manifest.json)";
  const releaseReady =
    preflight.exists &&
    preflight.sanitized &&
    preflight.result === "pass" &&
    preflight.releaseBlockingGroupCount === 0 &&
    hostedLegalUrlsReady &&
    storeListingScreenshotsReady &&
    requiredPacketsMissing.length === 0 &&
    requiredPacketsStillPending.length === 0;

  return {
    schema: "freed-release-launch-status-v1",
    sanitized: true,
    generatedAt: new Date().toISOString(),
    runId: options.runId,
    releaseReady,
    releaseReadyReason: releaseReady
      ? "Production preflight and required evidence packets report passing status."
      : androidCurrentBuildFailure.staleDownloadWarning
        ? `Launch remains blocked because the newest current Android rebuild failed after the served APK was produced; hosted legal URLs, ${listingScreenshotBlocker}, production env, deployed reports, store sandbox, and physical-device evidence must also pass.`
        : `Launch remains blocked until hosted legal URLs, ${listingScreenshotBlocker}, production env, deployed reports, store sandbox, and physical-device evidence pass.`,
    hostedLegalUrlsReady,
    storeListingScreenshotsReady,
    androidDownload: androidDownload
      ? {
          ...androidDownload,
          currentBuildFailure: androidCurrentBuildFailure,
          handoff: androidDownloadHandoff,
          note: androidCurrentBuildFailure.staleDownloadWarning
            ? "Local APK download/support artifact only; a newer current Android rebuild failed, so this APK is not evidence for the latest native code."
            : "Local APK download/support artifact only; not a Play Console release artifact.",
        }
      : null,
    androidUploadSigning,
    easBuildHandoff,
    easBuildAttempt,
    storeCatalog,
    storeListingScreenshotHandoff,
    paywallLaunchScope,
    storeAdSandbox,
    storeConsoleBrowserReadiness,
    permissionFlow,
    storeLegal,
    storeLegalWebExport,
    storeLegalHostedUrl,
    storeLegalWebDeploy,
    supabaseDeployment,
    preflight,
    physicalDeviceReadiness,
    handoffPackets,
    nextActions: preflight.blockerGroups.map((group) => ({
      id: group.id,
      status: group.status,
      requiredEnv: group.requiredEnv,
      requiredReports: group.requiredReports,
      captureHelperCommand: group.captureHelperCommand,
      evidenceFile: group.evidenceFile,
    })),
  };
}

function buildMarkdown(status) {
  const lines = [
    "# FREED Launch Status",
    "",
    `Generated: ${status.generatedAt}`,
    `Run ID: ${status.runId}`,
    `Release ready: ${status.releaseReady ? "true" : "false"}`,
    "",
    status.releaseReadyReason,
    "",
    "## Current Preflight",
    "",
  ];

  if (status.preflight.exists) {
    lines.push(
      `- Artifact: \`${status.preflight.artifact}\``,
      `- Sanitized: ${status.preflight.sanitized}`,
      `- Source: ${status.preflight.source}`,
      `- Result: ${status.preflight.result}`,
      `- Checks: ${status.preflight.passCount} pass, ${status.preflight.failCount} fail`,
      `- Failed production-env groups: ${status.preflight.releaseBlockingGroupCount}`,
      "",
    );
    const productionEnvGapChecklist = status.preflight.productionEnvGapChecklist;
    if (productionEnvGapChecklist?.exists) {
      lines.splice(
        lines.length - 1,
        0,
        `- Production env gap checklist: \`${productionEnvGapChecklist.artifact}\``,
      );
    }
    if (productionEnvGapChecklist?.jsonExists) {
      lines.splice(
        lines.length - 1,
        0,
        `- Production env gap JSON: \`${productionEnvGapChecklist.jsonArtifact}\``,
      );
    }
    if (productionEnvGapChecklist?.envSkeletonExists) {
      lines.splice(
        lines.length - 1,
        0,
        `- Missing-key env skeleton: \`${productionEnvGapChecklist.envSkeletonArtifact}\``,
      );
    }
    if (productionEnvGapChecklist) {
      lines.splice(
        lines.length - 1,
        0,
        `- Env gap handoff status: ${productionEnvGapChecklist.status}`,
        `- Env gap source freshness: ${productionEnvGapChecklist.sourceFreshness?.status || "missing"}`,
        `- Env gap output freshness: ${productionEnvGapChecklist.outputFreshness?.status || "missing"}`,
        `- Env gap failed-group coverage: ${productionEnvGapChecklist.groupIdsMatchCurrentPreflight ? "current" : "mismatch"}`,
        `- Env skeleton usable for current preflight: ${productionEnvGapChecklist.skeletonUsableForCurrentPreflight === true}`,
      );
      if (productionEnvGapChecklist.envSkeleton?.exists) {
        lines.splice(
          lines.length - 1,
          0,
          `- Env skeleton active keys: ${productionEnvGapChecklist.envSkeleton.activeKeyCount}`,
          `- Env skeleton covers failing groups: ${productionEnvGapChecklist.envSkeleton.coversFailedProductionEnvGroups}`,
          `- Env skeleton public defaults present: ${productionEnvGapChecklist.envSkeleton.publicDefaultsPresent}`,
          `- Env skeleton secret-like values omitted: ${productionEnvGapChecklist.envSkeleton.secretLikeValuesOmitted}`,
        );
      }
      if (productionEnvGapChecklist.envSkeleton?.missingGroupMarkerIds?.length > 0) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Missing env skeleton groups: ${productionEnvGapChecklist.envSkeleton.missingGroupMarkerIds.map((id) => `\`${id}\``).join(", ")}`,
        );
      }
      if (productionEnvGapChecklist.envSkeleton?.missingPublicDefaultKeys?.length > 0) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Missing public default keys: ${productionEnvGapChecklist.envSkeleton.missingPublicDefaultKeys.map((key) => `\`${key}\``).join(", ")}`,
        );
      }
      if (productionEnvGapChecklist.envSkeleton?.unexpectedFilledValueKeys?.length > 0) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Unexpected filled env keys: ${productionEnvGapChecklist.envSkeleton.unexpectedFilledValueKeys.map((key) => `\`${key}\``).join(", ")}`,
        );
      }
      if (productionEnvGapChecklist.structuralIssues?.length > 0) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Env gap structural issues: ${productionEnvGapChecklist.structuralIssues.join(", ")}`,
        );
      }
      if (productionEnvGapChecklist.sourceFreshness?.staleReason) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Source reason: ${productionEnvGapChecklist.sourceFreshness.staleReason}`,
        );
      }
      if (productionEnvGapChecklist.outputFreshness?.staleReason) {
        lines.splice(
          lines.length - 1,
          0,
          `  - Output reason: ${productionEnvGapChecklist.outputFreshness.staleReason}`,
        );
      }
      if (productionEnvGapChecklist.generatedAt) {
        lines.splice(lines.length - 1, 0, `- Env gap generated: ${productionEnvGapChecklist.generatedAt}`);
      }
    }
  } else {
    lines.push(`- Missing preflight report: \`${status.preflight.artifact}\``, "");
  }

  lines.push("## Physical Device Readiness", "");
  if (status.physicalDeviceReadiness) {
    lines.push(
      `- Status: ${status.physicalDeviceReadiness.overallStatus}`,
      `- Boundary: ${status.physicalDeviceReadiness.releaseBoundary}`,
    );
    for (const [label, readiness] of [
      ["Android", status.physicalDeviceReadiness.android],
      ["iOS", status.physicalDeviceReadiness.ios],
    ]) {
      lines.push(
        `- ${label}: ${readiness.status}`,
        `  - Discovery artifact: \`${readiness.artifact || "missing"}\``,
        `  - Result: ${readiness.result || "missing"}`,
        `  - Freshness: ${readiness.discoveryFreshness}`,
        `  - Ready devices: ${readiness.readyDeviceCount}`,
        `  - Ready physical candidates: ${readiness.readyPhysicalCandidateCount}`,
        `  - Next: ${readiness.next}`,
      );
      if (readiness.deviceListSource) lines.push(`  - Device list source: ${readiness.deviceListSource}`);
      if (readiness.deviceListArtifact) lines.push(`  - Device list artifact: \`${readiness.deviceListArtifact}\``);
      if (readiness.errorArtifact) lines.push(`  - Discovery error artifact: \`${readiness.errorArtifact}\``);
      if (readiness.xctraceErrorArtifact) lines.push(`  - xctrace error artifact: \`${readiness.xctraceErrorArtifact}\``);
      if (readiness.devicectlErrorArtifact) lines.push(`  - devicectl error artifact: \`${readiness.devicectlErrorArtifact}\``);
      if (readiness.generatedAt) lines.push(`  - Generated: ${readiness.generatedAt}`);
      if (readiness.staleReason) {
        const reasonLabel = readiness.discoveryFreshness === "stale" ? "Stale reason" : "Current blocker";
        lines.push(`  - ${reasonLabel}: ${readiness.staleReason}`);
      }
    }
    lines.push("");
  }

  lines.push("## Backend/Supabase Deployment Packet", "");
  if (status.supabaseDeployment.exists) {
    lines.push(
      `- Artifact: \`${status.supabaseDeployment.artifact}\``,
      `- Sanitized: ${status.supabaseDeployment.sanitized}`,
      `- Result: ${status.supabaseDeployment.result}`,
      `- Checks: ${status.supabaseDeployment.passCount} pass, ${status.supabaseDeployment.warnCount} warn, ${status.supabaseDeployment.failCount} fail`,
      `- Live project confirmed: ${status.supabaseDeployment.deploymentTarget.activeProjectConfirmed}`,
      `- Project ref configured: ${status.supabaseDeployment.deploymentTarget.projectRefConfigured}`,
      `- Project ref shape ok: ${status.supabaseDeployment.deploymentTarget.projectRefShapeOk}`,
      `- Secret values omitted: ${status.supabaseDeployment.secretValuesOmitted}`,
    );
    if (status.supabaseDeployment.deploymentTarget.projectStatus) {
      lines.push(`- Project status: \`${status.supabaseDeployment.deploymentTarget.projectStatus}\``);
    }
    if (status.supabaseDeployment.deploymentTarget.statusNote) {
      lines.push(`- Target note: ${status.supabaseDeployment.deploymentTarget.statusNote}`);
    }
    if (status.supabaseDeployment.sourceFreshness) {
      lines.push(`- Source freshness: ${status.supabaseDeployment.sourceFreshness.status}`);
      if (status.supabaseDeployment.sourceFreshness.staleReason) {
        lines.push(`  - Reason: ${status.supabaseDeployment.sourceFreshness.staleReason}`);
      }
      if (status.supabaseDeployment.sourceFreshness.status === "stale-source-drift") {
        lines.push(
          `  - Refresh command: \`npm run evidence:supabase-deploy-packet -- --report ${DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT}\``,
        );
      }
    }
    if (status.supabaseDeployment.backendBlockerGroupIds.length > 0) {
      lines.push(
        `- Backend blocker groups covered: ${status.supabaseDeployment.backendBlockerGroupIds.map((id) => `\`${id}\``).join(", ")}`,
      );
    }
    if (status.supabaseDeployment.fileHashes.schema) {
      lines.push(`- Schema hash: \`${status.supabaseDeployment.fileHashes.schema}\``);
    }
    if (status.supabaseDeployment.fileHashes.edgeConfig) {
      lines.push(`- Edge config hash: \`${status.supabaseDeployment.fileHashes.edgeConfig}\``);
    }
    if (status.supabaseDeployment.fileHashes.productionBackendPacket) {
      lines.push(`- Backend doc hash: \`${status.supabaseDeployment.fileHashes.productionBackendPacket}\``);
    }
    if (status.supabaseDeployment.deployCommands.length > 0) {
      lines.push("- Deploy commands:");
      for (const command of status.supabaseDeployment.deployCommands) lines.push(`  - \`${command}\``);
    }
    if (status.supabaseDeployment.smokeCommands.length > 0) {
      lines.push("- Post-deploy smoke commands:");
      for (const command of status.supabaseDeployment.smokeCommands) lines.push(`  - \`${command}\``);
    }
    if (status.supabaseDeployment.pendingExternalActions.length > 0) {
      lines.push("- Pending external actions:");
      for (const action of status.supabaseDeployment.pendingExternalActions) lines.push(`  - ${action}`);
    }
    lines.push(`- Boundary: ${status.supabaseDeployment.releaseBoundary}`, "");
  } else {
    lines.push(
      `- Missing Supabase deployment packet: \`${DEFAULT_SUPABASE_DEPLOYMENT_PACKET_REPORT}\``,
      "- Run: `npm run evidence:supabase-deploy-packet -- --report docs/validation/artifacts/supabase-deployment-current/supabase-deployment-packet.json`",
      "",
    );
  }

  lines.push("## Android Local Download", "");
  if (status.androidDownload) {
    lines.push(
      `- APK: \`${status.androidDownload.artifact}\``,
      `- Size bytes: ${status.androidDownload.sizeBytes}`,
      `- SHA-256: \`${status.androidDownload.sha256}\``,
      `- Note: ${status.androidDownload.note}`,
    );
    if (status.androidDownload.currentBuildFailure?.exists) {
      const failure = status.androidDownload.currentBuildFailure;
      lines.push(
        `- Current rebuild failure report: \`${failure.artifact}\``,
        `- Current rebuild failed after selected APK: ${failure.newerThanSelectedApk}`,
        `- Current rebuild stale-download warning: ${failure.staleDownloadWarning}`,
        `- Current rebuild failed task: \`${failure.failedTask || failure.failedStage || "unknown"}\``,
        `- Current rebuild toolchain: CMake \`${failure.attemptedCmakeVersion || "default"}\`, NDK \`${failure.attemptedNdkVersion || "default"}\``,
        `- Current rebuild CMake exit 137: ${failure.cmakeExit137}`,
        `- Current rebuild host memory constrained: ${failure.hostMemoryConstrainedLikely}${failure.hostTotalMemoryMb ? ` (${failure.hostTotalMemoryMb} MB)` : ""}`,
        `- Current rebuild requested new architecture: ${String(failure.newArchRequested)}`,
        `- React Native forced New Architecture: ${failure.newArchForcedByReactNative}`,
      );
    }
    if (status.androidDownload.handoff?.exists) {
      lines.push(
        `- Handoff report: \`${status.androidDownload.handoff.artifact}\``,
        `- Handoff sanitized: ${status.androidDownload.handoff.sanitized}`,
        `- Handoff generated: ${status.androidDownload.handoff.generatedAt || "unknown"}`,
        `- Handoff APK: \`${status.androidDownload.handoff.apkPath || ""}\``,
        `- Handoff APK exists: ${status.androidDownload.handoff.apkExists}`,
        `- Handoff APK hash matches file: ${status.androidDownload.handoff.reportShaMatchesFile}`,
        `- Handoff matches latest APK hash: ${status.androidDownload.handoff.matchesLatestApkSha256}`,
        `- Ready to serve selected APK: ${status.androidDownload.handoff.readyToServeSelectedApk}`,
        `- Usable for physical QA handoff: ${status.androidDownload.handoff.usableForPhysicalQaHandoff}`,
        `- Download server currently verified: ${status.androidDownload.handoff.downloadServerCurrentlyVerified}`,
      );
      if (status.androidDownload.handoff.useBoundary) {
        const boundary = status.androidDownload.handoff.useBoundary;
        lines.push(
          `- APK use boundary valid: ${boundary.boundaryValid}`,
          `  - Local QA download ready: ${boundary.localQaDownloadReady}`,
          `  - Store submission ready: ${boundary.storeSubmissionReady}`,
          `  - Store submission correctly blocked: ${boundary.storeSubmissionCorrectlyBlocked}`,
          `  - Same-device evidence required: ${boundary.sameDeviceEvidenceRequired}`,
          `  - Same-device evidence valid: ${boundary.sameDeviceEvidenceValid}`,
        );
        if (boundary.sameDeviceEvidenceSequence?.length > 0) {
          lines.push(
            `  - Same-device evidence steps: ${boundary.sameDeviceEvidenceSequence.map((item) => `\`${item.step}\``).join(", ")}`,
          );
        }
        if (boundary.boundary?.uploadSignedArtifactCommand) {
          lines.push(`  - Store artifact command: \`${boundary.boundary.uploadSignedArtifactCommand}\``);
        }
      }
      if (status.androidDownload.handoff.reportedApkSha256) {
        lines.push(`- Handoff APK SHA-256: \`${status.androidDownload.handoff.reportedApkSha256}\``);
      }
      if (status.androidDownload.handoff.companionArtifacts?.handoffMarkdown) {
        lines.push(`- Download handoff doc: \`${status.androidDownload.handoff.companionArtifacts.handoffMarkdown}\``);
      }
      if (status.androidDownload.handoff.companionArtifacts?.physicalQaChecklist) {
        lines.push(`- Physical QA checklist: \`${status.androidDownload.handoff.companionArtifacts.physicalQaChecklist}\``);
      }
      if (status.androidDownload.handoff.companionArtifacts?.qrSvg) {
        lines.push(`- QR SVG: \`${status.androidDownload.handoff.companionArtifacts.qrSvg}\``);
      }
      if (status.androidDownload.handoff.qrTargetUrl) {
        lines.push(`- Current QR target URL: \`${status.androidDownload.handoff.qrTargetUrl}\``);
      }
      if (status.androidDownload.handoff.deviceDiscovery?.exists) {
        const discovery = status.androidDownload.handoff.deviceDiscovery;
        lines.push(
          `- Android device discovery: ${discovery.result}`,
          `  - Freshness: ${discovery.freshness?.status || "unknown"}`,
          `  - Artifact: \`${discovery.artifact}\``,
          `  - Ready physical devices: ${discovery.readyPhysicalCandidateCount}`,
          `  - Ready adb devices: ${discovery.readyDeviceCount}`,
        );
        if (discovery.freshness?.ageMinutes !== null && discovery.freshness?.ageMinutes !== undefined) {
          lines.push(`  - Age minutes: ${discovery.freshness.ageMinutes}`);
        }
        if (discovery.next) lines.push(`  - Next: ${discovery.next}`);
      } else if (status.androidDownload.handoff.deviceDiscoveryArtifact) {
        lines.push(`- Missing Android device discovery: \`${status.androidDownload.handoff.deviceDiscoveryArtifact}\``);
      }
      if (status.androidDownload.handoff.liveCheck?.exists) {
        const liveCheck = status.androidDownload.handoff.liveCheck;
        lines.push(
          `- Download server live check: ${liveCheck.result}`,
          `  - Freshness: ${liveCheck.status}`,
          `  - Generated: ${liveCheck.generatedAt || "unknown"}`,
          `  - Artifact: \`${liveCheck.artifact}\``,
          `  - Checks: ${liveCheck.passCount} pass, ${liveCheck.failCount} fail`,
          `  - Required boundary/page checks passed: ${liveCheck.requiredBoundaryPageChecksPassed}`,
        );
        if (liveCheck.missingRequiredContentCheckIds?.length > 0) {
          lines.push(
            `  - Missing required page checks: ${liveCheck.missingRequiredContentCheckIds.map((id) => `\`${id}\``).join(", ")}`,
          );
        }
        if (liveCheck.target?.pageUrl) {
          lines.push(`  - Checked page URL: \`${liveCheck.target.pageUrl}\``);
        }
        if (liveCheck.target?.downloadUrl) {
          lines.push(`  - Checked APK URL: \`${liveCheck.target.downloadUrl}\``);
        }
        if (liveCheck.freshness?.ageMinutes !== null && liveCheck.freshness?.ageMinutes !== undefined) {
          lines.push(`  - Age minutes: ${liveCheck.freshness.ageMinutes}`);
        }
        if (liveCheck.pageProbe) {
          lines.push(`  - Page: HTTP ${liveCheck.pageProbe.status}, ${liveCheck.pageProbe.contentType || "unknown content type"}`);
        }
        if (liveCheck.downloadProbe) {
          lines.push(
            `  - APK route: HTTP ${liveCheck.downloadProbe.status}, ${liveCheck.downloadProbe.contentLength} bytes, ${liveCheck.downloadProbe.contentType || "unknown content type"}`,
          );
        }
      } else if (status.androidDownload.handoff.liveCheckArtifact) {
        lines.push(`- Missing download server live check: \`${status.androidDownload.handoff.liveCheckArtifact}\``);
      }
      if (status.androidDownload.handoff.ensure?.exists) {
        const ensure = status.androidDownload.handoff.ensure;
        lines.push(
          `- Download server ensure: ${ensure.result}`,
          `  - Freshness: ${ensure.status}`,
          `  - Generated: ${ensure.generatedAt || "unknown"}`,
          `  - Artifact: \`${ensure.artifact}\``,
          `  - Checks: ${ensure.passCount} pass, ${ensure.failCount} fail`,
          `  - Server start attempted: ${ensure.startAttempted}`,
          `  - Server started: ${ensure.serverStarted}`,
          `  - Final live check: ${ensure.latestLiveCheck?.passed ? "pass" : "fail"}${ensure.latestLiveCheck?.label ? ` (${ensure.latestLiveCheck.label})` : ""}`,
        );
        if (ensure.liveCheckReport) {
          lines.push(`  - Live check report: \`${ensure.liveCheckReport}\``);
        }
      } else if (status.androidDownload.handoff.ensureArtifact) {
        lines.push(`- Missing download server ensure: \`${status.androidDownload.handoff.ensureArtifact}\``);
      }
      if (status.androidDownload.handoff.server?.lanUrls?.length > 0) {
        lines.push(`- LAN URLs in handoff: ${status.androidDownload.handoff.server.lanUrls.map((url) => `\`${url}\``).join(", ")}`);
      }
      if (status.androidDownload.handoff.server?.downloadPath) {
        lines.push(`- Download path: \`${status.androidDownload.handoff.server.downloadPath}\``);
      }
      if (status.androidDownload.handoff.downloadServerCommand) {
        lines.push(`- Start download server: \`${status.androidDownload.handoff.downloadServerCommand}\``);
      }
      if (status.androidDownload.handoff.liveCheckCommand) {
        lines.push(`- Verify download server: \`${status.androidDownload.handoff.liveCheckCommand}\``);
      }
      if (status.androidDownload.handoff.ensureCommand) {
        lines.push(`- Ensure download server: \`${status.androidDownload.handoff.ensureCommand}\``);
      }
      if (status.androidDownload.handoff.deviceDiscoveryCommand) {
        lines.push(`- Refresh Android device discovery: \`${status.androidDownload.handoff.deviceDiscoveryCommand}\``);
      }
      if (status.androidDownload.handoff.installQaPlanCommand) {
        lines.push(`- Write install QA plan: \`${status.androidDownload.handoff.installQaPlanCommand}\``);
      }
      if (status.androidDownload.handoff.installQaPlanArtifact) {
        lines.push(`- Install QA plan artifact: \`${status.androidDownload.handoff.installQaPlanArtifact}\``);
        lines.push(`- Install QA plan exists: ${status.androidDownload.handoff.installQaPlanExists}`);
        if (status.androidDownload.handoff.installQaPlan?.exists) {
          const plan = status.androidDownload.handoff.installQaPlan;
          lines.push(`- Install QA plan status: ${plan.status}`);
          lines.push(`- Install QA plan usable for handoff: ${plan.usableForInstallHandoff}`);
          lines.push(`- Install QA plan APK hash matches handoff: ${plan.apkShaMatchesHandoff}`);
          lines.push(`- Install QA plan APK path matches handoff: ${plan.apkPathMatchesHandoff}`);
          lines.push(`- Install QA plan run ID matches handoff: ${plan.runIdMatchesHandoff}`);
          lines.push(`- Install QA plan physical device required: ${plan.physicalDeviceRequired}`);
          lines.push(`- Install QA plan release evidence satisfied: ${plan.releaseEvidenceSatisfied}`);
          lines.push(`- Install QA plan required proof flags present: ${plan.requiredProofFlagsPresent}`);
          if (plan.requiredProofFlags?.length > 0) {
            lines.push(`- Install QA plan required proof flags: ${plan.requiredProofFlags.map((flag) => `\`${flag}\``).join(", ")}`);
          }
        }
      }
      if (status.androidDownload.handoff.installQaCommand) {
        lines.push(`- Install QA command: \`${status.androidDownload.handoff.installQaCommand}\``);
      }
      if (status.androidDownload.handoff.permissionWizardCommand) {
        lines.push(`- Permission wizard report command: \`${status.androidDownload.handoff.permissionWizardCommand}\``);
      }
      if (status.androidDownload.handoff.protectionEvidenceCommand) {
        lines.push(`- Protection evidence command: \`${status.androidDownload.handoff.protectionEvidenceCommand}\``);
      }
      if (status.androidDownload.handoff.evidenceBoundary) {
        lines.push(`- Handoff boundary: ${status.androidDownload.handoff.evidenceBoundary}`);
      }
    } else {
      lines.push(`- Missing handoff report: \`${DEFAULT_ANDROID_DOWNLOAD_HANDOFF_REPORT}\``);
    }
    lines.push("");
  } else {
    lines.push("- No current local APK artifact found.", "");
  }

  lines.push("## EAS Current-Source Build Handoff", "");
  if (status.easBuildHandoff?.exists) {
    const eas = status.easBuildHandoff;
    lines.push(
      `- Artifact: \`${eas.artifact}\``,
      `- Generated: ${eas.generatedAt || "unknown"}`,
      `- Result: ${eas.result}`,
      `- Ready for approved EAS build: ${eas.readyForApprovedEasBuild}`,
      `- Release evidence satisfied: ${eas.releaseEvidenceSatisfied}`,
      `- EAS CLI invocation: \`${eas.cli.easCliInvocation || "missing"}\``,
      `- npx available: ${eas.cli.npxAvailable}${eas.cli.npxPath ? ` (${eas.cli.npxPath})` : ""}`,
      `- Local Android blocked: ${eas.androidFailure.localBuildBlocked}`,
      `- Local Android CMake exit 137: ${eas.androidFailure.cmakeExit137}`,
      `- Failed local task: \`${eas.androidFailure.failedTask || "unknown"}\``,
      `- React Native forced New Architecture: ${eas.androidFailure.newArchForcedByReactNative}`,
    );
    if (eas.commands.androidInternalApk) {
      lines.push(`- EAS Android internal APK: \`${eas.commands.androidInternalApk}\``);
    }
    if (eas.commands.androidProductionAab) {
      lines.push(`- EAS Android Play AAB: \`${eas.commands.androidProductionAab}\``);
    }
    if (eas.commands.iosInternal) {
      lines.push(`- EAS iOS internal: \`${eas.commands.iosInternal}\``);
    }
    if (eas.commands.iosProduction) {
      lines.push(`- EAS iOS production: \`${eas.commands.iosProduction}\``);
    }
    if (eas.requiredReceipts.length > 0) {
      lines.push("- Required post-build receipts:");
      for (const receipt of eas.requiredReceipts) lines.push(`  - ${receipt}`);
    }
    if (eas.releaseBoundary) lines.push(`- Boundary: ${eas.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(
      `- Missing EAS handoff report: \`${DEFAULT_EAS_BUILD_HANDOFF_REPORT}\``,
      "- Run: `npm run evidence:eas-build-handoff -- --run-id eas-build-current --output-dir docs/validation/artifacts/eas-build-current`",
      "",
    );
  }

  lines.push("## EAS Build Attempt", "");
  if (status.easBuildAttempt?.exists) {
    const attempt = status.easBuildAttempt;
    lines.push(
      `- Artifact: \`${attempt.artifact}\``,
      `- Generated: ${attempt.generatedAt || "unknown"}`,
      `- Result: ${attempt.result}`,
      `- Status: ${attempt.status}`,
      `- Attempt type: ${attempt.attemptType}`,
      `- Target: ${attempt.target.platform || "unknown"} ${attempt.target.profile || "unknown"} ${attempt.target.artifactType || "unknown"}`,
      `- Ready for current-source artifact: ${attempt.readyForCurrentSourceArtifact}`,
      `- Release evidence satisfied: ${attempt.releaseEvidenceSatisfied}`,
      `- Exit code: ${attempt.exitCode}`,
    );
    if (attempt.observedMessageCode) {
      lines.push(`- Observed message code: \`${attempt.observedMessageCode}\``);
    }
    if (attempt.commands.login) lines.push(`- Login command: \`${attempt.commands.login}\``);
    if (attempt.commands.authCheck) lines.push(`- Auth check: \`${attempt.commands.authCheck}\``);
    if (attempt.commands.build) lines.push(`- Target build command: \`${attempt.commands.build}\``);
    if (attempt.receipts.buildUrl) lines.push(`- Build URL: ${attempt.receipts.buildUrl}`);
    if (attempt.receipts.artifactSha256) lines.push(`- Artifact SHA-256: \`${attempt.receipts.artifactSha256}\``);
    if (attempt.receipts.artifactSizeBytes > 0) {
      lines.push(`- Artifact size bytes: ${attempt.receipts.artifactSizeBytes}`);
    }
    if (attempt.releaseBoundary) lines.push(`- Boundary: ${attempt.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(
      `- Missing EAS build attempt report: \`${DEFAULT_EAS_BUILD_ATTEMPT_REPORT}\``,
      "- Run after auth/build attempt: `npm run evidence:eas-build-attempt -- --status blocked-not-logged-in --exit-code 1 --observed-message-code not-logged-in`",
      "",
    );
  }

  lines.push("## Android Upload Signing", "");
  if (status.androidUploadSigning.exists) {
    lines.push(
      `- Status: ${status.androidUploadSigning.status}`,
      `- AAB report: \`${status.androidUploadSigning.aabReportArtifact}\``,
      `- Signing preflight: \`${status.androidUploadSigning.preflightArtifact}\``,
      `- Release evidence satisfied: ${status.androidUploadSigning.releaseEvidenceSatisfied}`,
    );
    const signing = status.androidUploadSigning.signing;
    if (signing) {
      lines.push(
        `- Signing mode: \`${signing.mode}\``,
        `- Play Console ready signing: ${signing.playConsoleReady}`,
        `- Upload keystore checked: ${signing.uploadKeystore.checked}`,
        `- Debug certificate: ${signing.uploadKeystore.debugSigned}`,
      );
      if (signing.uploadKeystore.certificateSha256Digest) {
        lines.push(`- Upload certificate SHA-256: \`${signing.uploadKeystore.certificateSha256Digest}\``);
      }
      if (signing.missingInputs.length > 0) {
        lines.push(`- Missing signing inputs: ${signing.missingInputs.join(", ")}`);
      }
    }
    if (status.androidUploadSigning.aab) {
      lines.push(
        `- AAB dry-run result: ${status.androidUploadSigning.aab.result}`,
        `- Build result: ${status.androidUploadSigning.aab.buildResult}`,
        `- Gradle invoked: ${status.androidUploadSigning.aab.gradleInvoked}`,
        `- Release env file loaded: ${status.androidUploadSigning.aab.releaseEnvFileLoaded}`,
      );
      if (status.androidUploadSigning.aab.releaseEnvFileSource) {
        lines.push(`- Env source: \`${status.androidUploadSigning.aab.releaseEnvFileSource}\``);
      }
      if (status.androidUploadSigning.aab.reason) {
        lines.push(`- Current artifact blocker: ${status.androidUploadSigning.aab.reason}`);
      }
    }
    if (status.androidUploadSigning.preflight) {
      lines.push(
        `- Signing preflight result: ${status.androidUploadSigning.preflight.result}`,
        `- Signing group: ${status.androidUploadSigning.preflight.productionAndroidSigningStatus}`,
        `- Signing preflight checks: ${status.androidUploadSigning.preflight.passCount} pass, ${status.androidUploadSigning.preflight.failCount} fail`,
      );
    }
    lines.push(`- Boundary: ${status.androidUploadSigning.releaseBoundary}`, "");
  } else {
    lines.push(`- Missing Android upload-signing report: \`${status.androidUploadSigning.aabReportArtifact}\``, "");
  }

  lines.push("## Store Launch Catalog", "");
  if (status.storeCatalog.exists) {
    lines.push(
      `- Artifact: \`${status.storeCatalog.artifact}\``,
      `- Sanitized: ${status.storeCatalog.sanitized}`,
      `- Result: ${status.storeCatalog.result}`,
      `- Checks: ${status.storeCatalog.passCount} pass, ${status.storeCatalog.failCount} fail`,
    );
    const productIds = status.storeCatalog.launchProductIds;
    if (productIds && Object.keys(productIds).length > 0) {
      lines.push(`- Launch products: yearly=\`${productIds.yearly || ""}\`, monthly=\`${productIds.monthly || ""}\`, lifetime=\`${productIds.lifetime || ""}\``);
    }
    if (status.storeCatalog.futureProductsDisabledForV1.length > 0) {
      lines.push(`- Future SKUs disabled for v1: ${status.storeCatalog.futureProductsDisabledForV1.map((id) => `\`${id}\``).join(", ")}`);
    }
    const listingScreenshots = status.storeCatalog.listingScreenshotReadiness;
    if (listingScreenshots) {
      lines.push(
        `- Public listing screenshots: ${listingScreenshots.status}`,
        `  - Ready for store upload: ${listingScreenshots.readyForStoreUpload}`,
        `  - Final manifest: \`${listingScreenshots.manifestPath}\``,
        `  - Manifest exists: ${listingScreenshots.exists}`,
        `  - Template: \`${listingScreenshots.templatePath}\``,
        `  - Assets: ${listingScreenshots.assetCount}`,
      );
      if (listingScreenshots.blockers.length > 0) {
        lines.push(`  - Blockers: ${listingScreenshots.blockers.map((id) => `\`${id}\``).join(", ")}`);
      }
      if (listingScreenshots.next) lines.push(`  - Next: ${listingScreenshots.next}`);
    }
    if (status.storeCatalog.releaseBoundary) lines.push(`- Boundary: ${status.storeCatalog.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(`- Missing store catalog audit: \`${DEFAULT_STORE_CATALOG_AUDIT_REPORT}\``, "");
  }

  lines.push("## Store Listing Screenshot Handoff", "");
  if (status.storeListingScreenshotHandoff?.exists) {
    const listing = status.storeListingScreenshotHandoff;
    lines.push(
      `- Artifact: \`${listing.artifact}\``,
      `- Generated: ${listing.generatedAt || "unknown"}`,
      `- Result: ${listing.result}`,
      `- Ready for signed-build capture: ${listing.readyForSignedBuildCapture}`,
      `- Ready for store upload: ${listing.readyForStoreUpload}`,
      `- Final manifest: \`${listing.finalManifestPath || ""}\``,
      `- Final manifest exists: ${listing.finalManifestExists}`,
      `- Final manifest status: ${listing.finalManifestStatus}`,
      `- Capture rows: ${listing.captureRows.length}`,
    );
    if (listing.captureRows.length > 0) {
      lines.push("- Capture concepts:");
      for (const row of listing.captureRows) {
        lines.push(`  - ${row.id}: ${row.headline} (${row.width}x${row.height})`);
      }
    }
    if (listing.captureCommands.refreshEasHandoff) {
      lines.push(`- Refresh EAS handoff: \`${listing.captureCommands.refreshEasHandoff}\``);
    }
    if (listing.captureCommands.validateCatalog) {
      lines.push(`- Validate final manifest: \`${listing.captureCommands.validateCatalog}\``);
    }
    if (listing.releaseBoundary) lines.push(`- Boundary: ${listing.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(
      `- Missing listing screenshot handoff: \`${DEFAULT_STORE_LISTING_SCREENSHOT_HANDOFF_REPORT}\``,
      "- Run: `npm run evidence:store-listing-screenshots -- --run-id store-listing-screenshots-current --output-dir docs/validation/artifacts/store-listing-screenshots-current`",
      "",
    );
  }

  lines.push("## Paywall Source Scope", "");
  if (status.paywallLaunchScope.exists) {
    lines.push(
      `- Artifact: \`${status.paywallLaunchScope.artifact}\``,
      `- Sanitized: ${status.paywallLaunchScope.sanitized}`,
      `- Result: ${status.paywallLaunchScope.result}`,
      `- Checks: ${status.paywallLaunchScope.passCount} pass, ${status.paywallLaunchScope.failCount} fail`,
    );
    if (status.paywallLaunchScope.launchPlanIds.length > 0) {
      lines.push(`- Launch plan IDs: ${status.paywallLaunchScope.launchPlanIds.map((id) => `\`${id}\``).join(", ")}`);
    }
    const productIds = status.paywallLaunchScope.launchProductIds || {};
    if (Object.keys(productIds).length > 0) {
      lines.push(`- Launch products: yearly=\`${productIds.yearly || ""}\`, monthly=\`${productIds.monthly || ""}\`, lifetime=\`${productIds.lifetime || ""}\``);
    }
    if (status.paywallLaunchScope.futurePlanIdsDisabledForV1.length > 0) {
      lines.push(`- Future plans hidden for v1: ${status.paywallLaunchScope.futurePlanIdsDisabledForV1.map((id) => `\`${id}\``).join(", ")}`);
    }
    if (status.paywallLaunchScope.sourceArtifacts?.paywall?.sha256) {
      lines.push(`- Paywall source hash: \`${status.paywallLaunchScope.sourceArtifacts.paywall.sha256}\``);
    }
    if (status.paywallLaunchScope.releaseBoundary) lines.push(`- Boundary: ${status.paywallLaunchScope.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(
      `- Missing paywall source scope audit: \`${DEFAULT_PAYWALL_LAUNCH_SCOPE_AUDIT_REPORT}\``,
      "- Run: `npm run audit:paywall-launch-scope -- --report docs/validation/artifacts/paywall-launch-scope-current/paywall-launch-source-audit.json`",
      "",
    );
  }

  lines.push("## Store/Ad Sandbox Setup", "");
  if (status.storeAdSandbox.exists) {
    lines.push(
      `- Artifact: \`${status.storeAdSandbox.artifact}\``,
      `- Sanitized: ${status.storeAdSandbox.sanitized}`,
      `- Result: ${status.storeAdSandbox.result}`,
      `- Release env file loaded: ${status.storeAdSandbox.releaseEnvFileLoaded}`,
      `- Manual QA rows: ${status.storeAdSandbox.pendingManualQaCount} pending of ${status.storeAdSandbox.matrixRowCount}`,
      `- Store provider: \`${status.storeAdSandbox.configured.storeProvider || ""}\``,
      `- Entitlement configured: ${status.storeAdSandbox.configured.entitlementConfigured}`,
      `- Purchase verify endpoint configured: ${status.storeAdSandbox.configured.purchaseVerifyEndpointConfigured}`,
      `- iOS AdMob app ID configured: ${status.storeAdSandbox.configured.adMobAppIdIosConfigured}`,
      `- Android AdMob app ID configured: ${status.storeAdSandbox.configured.adMobAppIdAndroidConfigured}`,
      `- iOS rewarded unit configured: ${status.storeAdSandbox.configured.rewardedAdUnitIdIosConfigured}`,
      `- Android rewarded unit configured: ${status.storeAdSandbox.configured.rewardedAdUnitIdAndroidConfigured}`,
    );
    const iosProducts = status.storeAdSandbox.configured.iosLaunchProductIds || {};
    const androidProducts = status.storeAdSandbox.configured.androidLaunchProductIds || {};
    if (Object.keys(iosProducts).length > 0) {
      lines.push(`- iOS launch products: yearly=\`${iosProducts.yearly || ""}\`, monthly=\`${iosProducts.monthly || ""}\`, lifetime=\`${iosProducts.lifetime || ""}\``);
    }
    if (Object.keys(androidProducts).length > 0) {
      lines.push(`- Android launch products: yearly=\`${androidProducts.yearly || ""}\`, monthly=\`${androidProducts.monthly || ""}\`, lifetime=\`${androidProducts.lifetime || ""}\``);
    }
    if (status.storeAdSandbox.missingProductionConfig.length > 0) {
      lines.push(`- Missing production config: ${status.storeAdSandbox.missingProductionConfig.map((key) => `\`${key}\``).join(", ")}`);
    }
    if (status.storeAdSandbox.commandHandoff.releasePreflightCommand) {
      lines.push(`- Release preflight command: \`${status.storeAdSandbox.commandHandoff.releasePreflightCommand}\``);
    }
    if (status.storeAdSandbox.commandHandoff.purchaseSmokeCommand) {
      lines.push(`- Purchase smoke command: \`${status.storeAdSandbox.commandHandoff.purchaseSmokeCommand}\``);
    }
    if (status.storeAdSandbox.companionArtifacts.consolePaymentHandoffArtifact) {
      lines.push(`- Console/payment handoff: \`${status.storeAdSandbox.companionArtifacts.consolePaymentHandoffArtifact}\``);
    }
    if (status.storeAdSandbox.companionArtifacts.consoleExecutionRunbookArtifact) {
      lines.push(`- Console execution runbook: \`${status.storeAdSandbox.companionArtifacts.consoleExecutionRunbookArtifact}\``);
    }
    if (status.storeAdSandbox.companionArtifacts.storeSandboxTestPlanArtifact) {
      lines.push(`- Store sandbox test plan: \`${status.storeAdSandbox.companionArtifacts.storeSandboxTestPlanArtifact}\``);
    }
    if (status.storeAdSandbox.appRecordActionPacket?.artifact) {
      const packet = status.storeAdSandbox.appRecordActionPacket;
      lines.push(
        `- Store app-record action packet: ${packet.status}`,
        `  - Artifact: \`${packet.artifact}\``,
        `  - Handoff doc: \`${packet.markdownArtifact || "missing"}\``,
        `  - Markdown exists: ${packet.markdownExists}`,
        `  - Usable for confirmed draft app-record action: ${packet.usableForDraftAppRecordAction}`,
        `  - Action-time confirmation required: ${packet.actionTimeConfirmationRequired}`,
        `  - Confirmation token: \`${packet.confirmationToken || "missing"}\``,
        `  - No production approval granted: ${packet.noProductionApprovalGranted}`,
        `  - Google Play app record: ${packet.googlePlay.appRecordStatus || "unconfirmed"}`,
        `  - App Store Connect app record: ${packet.appStoreConnect.appRecordStatus || "unconfirmed"}`,
        `  - Apple license agreement: ${packet.appStoreConnect.licenseAgreementStatus || "unconfirmed"}`,
        `  - Hosted legal URL audit: ${packet.hostedLegalReadiness?.result || "missing"}`,
        `  - Hosted legal URLs verified: ${packet.hostedLegalReadiness?.hostedLegalUrlsVerified === true}`,
        `  - Store legal URL entry allowed: ${packet.hostedLegalReadiness?.urlEntryAllowed === true}`,
        `  - Hosted legal report freshness: ${packet.hostedLegalReadiness?.freshness?.status || "missing"}`,
        `  - Browser readiness report freshness: ${packet.browserReadiness.freshness.status}`,
        `  - Packet source freshness: ${packet.sourceFreshness.status}`,
      );
      if (packet.recheckCommand) {
        lines.push(`  - Recheck after app records: \`${packet.recheckCommand}\``);
      }
    }
    if (status.storeAdSandbox.adMobActionPacket?.artifact) {
      const packet = status.storeAdSandbox.adMobActionPacket;
      lines.push(
        `- AdMob action packet: ${packet.status}`,
        `  - Artifact: \`${packet.artifact}\``,
        `  - Handoff doc: \`${packet.markdownArtifact || "missing"}\``,
        `  - Markdown exists: ${packet.markdownExists}`,
        `  - Env patch template: \`${packet.adMobEnvPatchTemplateArtifact || "missing"}\``,
        `  - Env patch template exists: ${packet.adMobEnvPatchTemplateExists === true}`,
        `  - Usable for confirmed AdMob action: ${packet.usableForAdMobConsoleAction}`,
        `  - Action-time confirmation required: ${packet.actionTimeConfirmationRequired}`,
        `  - Confirmation token: \`${packet.confirmationToken || "missing"}\``,
        `  - No production approval granted: ${packet.noProductionApprovalGranted}`,
        `  - Current blocker: ${packet.currentBlocker || "unconfirmed"}`,
        `  - Env ready: ${packet.envReady}`,
        `  - Production env keys configured: ${packet.productionEnvConfiguredCount} of ${packet.productionEnvKeyCount}`,
        `  - Missing env keys: ${packet.missingEnvKeys.length > 0 ? packet.missingEnvKeys.map((key) => `\`${key}\``).join(", ") : "none"}`,
        `  - Allowed ad formats: ${packet.placementPolicy.allowedFormats.map((format) => `\`${format}\``).join(", ") || "none"}`,
        `  - Forbidden ad formats: ${packet.placementPolicy.forbiddenFormats.map((format) => `\`${format}\``).join(", ") || "none"}`,
        `  - Packet source freshness: ${packet.sourceFreshness.status}`,
      );
      if (packet.storeAdSandboxCommand) {
        lines.push(`  - Regenerate after AdMob env: \`${packet.storeAdSandboxCommand}\``);
      }
      if (packet.readOnlyAdMobReadinessCommand) {
        lines.push(`  - Read-only AdMob readiness: \`${packet.readOnlyAdMobReadinessCommand}\``);
      }
      if (packet.readOnlyAdMobReadinessArtifact) {
        lines.push(`  - Read-only AdMob readiness artifact: \`${packet.readOnlyAdMobReadinessArtifact}\``);
      }
      if (packet.readOnlyAdMobReadiness?.exists) {
        const readiness = packet.readOnlyAdMobReadiness;
        lines.push(
          `  - Read-only AdMob readiness result: ${readiness.result}`,
          `  - Ready for rewarded-ad request proof: ${readiness.readyForRewardedAdRequestProof}`,
        );
        if (readiness.browserConnector?.status && readiness.browserConnector.status !== "not-reported") {
          lines.push(
            `  - AdMob browser connector: ${readiness.browserConnector.status}`,
            `    - Connector unavailable: ${readiness.browserConnector.connectorUnavailable}`,
            `    - Native module load failed: ${readiness.browserConnector.nativeModuleLoadFailed}`,
            `    - Selected Chrome profile extension missing: ${readiness.browserConnector.selectedChromeProfileExtensionMissing}`,
            `    - Extension present in another Chrome profile: ${readiness.browserConnector.codexExtensionPresentInOtherChromeProfile}`,
            `    - Native host manifest OK: ${readiness.browserConnector.chromeNativeHostOk}`,
            `    - Repair handoff required: ${readiness.browserConnector.repairHandoff.required}`,
          );
          if (readiness.browserConnector.repairHandoff.steps.length > 0) {
            lines.push(
              "    - Repair checklist:",
              ...readiness.browserConnector.repairHandoff.steps.map((step) => `      - ${step}`),
            );
          }
        }
        if (readiness.nextActions?.length > 0) {
          lines.push(
            "  - AdMob readiness next actions:",
            ...readiness.nextActions.map((action) => `    - ${action}`),
          );
        }
      }
    }
    if (status.storeAdSandbox.companionArtifacts.rewardedAdRequestTemplateArtifact) {
      lines.push(`- Rewarded ad request template: \`${status.storeAdSandbox.companionArtifacts.rewardedAdRequestTemplateArtifact}\``);
    }
    if (status.storeAdSandbox.companionArtifacts.paywallLaunchSourceAuditArtifact) {
      lines.push(`- Paywall source audit: \`${status.storeAdSandbox.companionArtifacts.paywallLaunchSourceAuditArtifact}\``);
    }
    if (status.storeAdSandbox.sourceFreshness) {
      lines.push(`- Source freshness: ${status.storeAdSandbox.sourceFreshness.status}`);
      if (status.storeAdSandbox.sourceFreshness.staleReason) {
        lines.push(`  - Reason: ${status.storeAdSandbox.sourceFreshness.staleReason}`);
      }
      const paywallSourceAudit = status.storeAdSandbox.sourceFreshness.paywallLaunchSourceAudit;
      if (paywallSourceAudit?.artifact) {
        lines.push(
          `  - Paywall audit freshness: ${paywallSourceAudit.status}`,
          `    - Audit artifact: \`${paywallSourceAudit.artifact}\``,
          `    - Audit passing: ${paywallSourceAudit.auditPassing}`,
        );
      }
      const consoleSourceFreshness = status.storeAdSandbox.sourceFreshness.consoleProductSetup;
      if (consoleSourceFreshness?.status) {
        lines.push(`  - Console setup source freshness: ${consoleSourceFreshness.status}`);
      }
    }
    if (status.storeAdSandbox.consoleProductSetup?.artifact) {
      const consoleSetup = status.storeAdSandbox.consoleProductSetup;
      lines.push(
        `- Console product setup proof: ${consoleSetup.status}`,
        `  - Artifact: \`${consoleSetup.artifact}\``,
        `  - Result: ${consoleSetup.result}`,
        `  - Proof captured: ${consoleSetup.proofCaptured}`,
        `  - App-record Browser proof: ${consoleSetup.appRecordReadiness.readyForConsoleProductSetup}`,
        `    - Browser report: \`${consoleSetup.appRecordReadiness.browserReportPath || "missing"}\``,
        `    - Read-only Browser check: ${consoleSetup.appRecordReadiness.readOnlyBrowserInspection}`,
        `    - Store mutation performed during Browser check: ${consoleSetup.appRecordReadiness.storeMutationPerformed}`,
        `    - Google Play product setup allowed: ${consoleSetup.appRecordReadiness.googlePlay.productSetupAllowed}`,
        `    - App Store Connect product setup allowed: ${consoleSetup.appRecordReadiness.appStoreConnect.productSetupAllowed}`,
        `  - Checks: ${consoleSetup.checkTrueCount} true, ${consoleSetup.checkFalseCount} false of ${consoleSetup.checkTotalCount}`,
        `  - App Store Connect evidence artifacts: ${consoleSetup.appStoreConnect.evidenceArtifactCount} total, ${consoleSetup.appStoreConnect.pendingEvidenceArtifactCount} pending`,
        `  - Google Play evidence artifacts: ${consoleSetup.googlePlay.evidenceArtifactCount} total, ${consoleSetup.googlePlay.pendingEvidenceArtifactCount} pending`,
      );
    }
    if (status.storeConsoleBrowserReadiness?.exists) {
      const consoleReadiness = status.storeConsoleBrowserReadiness;
      lines.push(
        `- Browser console readiness: ${consoleReadiness.result}`,
        `  - Artifact: \`${consoleReadiness.artifact}\``,
        `  - Handoff doc: \`${consoleReadiness.markdownArtifact}\``,
        `  - Read-only: ${consoleReadiness.browserInspection.readOnly}`,
        `  - Ready for product setup: ${consoleReadiness.readyForConsoleProductSetup}`,
        `  - Browser connector: ${consoleReadiness.browserConnector.status}`,
      );
      if (consoleReadiness.browserConnector?.status && consoleReadiness.browserConnector.status !== "not-reported") {
        lines.push(
          `    - Connector unavailable: ${consoleReadiness.browserConnector.connectorUnavailable}`,
          `    - Native module load failed: ${consoleReadiness.browserConnector.nativeModuleLoadFailed}`,
          `    - Selected Chrome profile extension missing: ${consoleReadiness.browserConnector.selectedChromeProfileExtensionMissing}`,
          `    - Extension present in another Chrome profile: ${consoleReadiness.browserConnector.codexExtensionPresentInOtherChromeProfile}`,
          `    - Native host manifest OK: ${consoleReadiness.browserConnector.chromeNativeHostOk}`,
          `    - Repair handoff required: ${consoleReadiness.browserConnector.repairHandoff.required}`,
        );
        if (consoleReadiness.browserConnector.repairHandoff.steps.length > 0) {
          lines.push(
            `    - Repair checklist:`,
            ...consoleReadiness.browserConnector.repairHandoff.steps.map((step) => `      - ${step}`),
          );
        }
      }
      lines.push(
        `  - Google Play app record: ${consoleReadiness.googlePlay.appRecordStatus || "unconfirmed"}`,
        `  - Google Play product setup allowed: ${consoleReadiness.googlePlay.productSetupAllowed}`,
        `  - App Store Connect app record: ${consoleReadiness.appStoreConnect.appRecordStatus || "unconfirmed"}`,
        `  - App Store Connect license agreement: ${consoleReadiness.appStoreConnect.licenseAgreementStatus || "unconfirmed"}`,
        `  - App Store Connect product setup allowed: ${consoleReadiness.appStoreConnect.productSetupAllowed}`,
      );
      if (consoleReadiness.blockers.length > 0) {
        lines.push(`  - Blockers: ${consoleReadiness.blockers.map((blocker) => `\`${blocker}\``).join(", ")}`);
      }
      if (consoleReadiness.nextActions?.length > 0) {
        lines.push(
          `  - Browser readiness next actions:`,
          ...consoleReadiness.nextActions.map((action) => `    - ${action}`),
        );
      }
    } else {
      lines.push(
        `- Browser console readiness: missing`,
        `  - Run: \`npm run evidence:store-console-browser -- --play-console-observed --play-freed-app-missing --app-store-connect-observed --app-store-freed-app-missing --app-store-agreement-pending\` after a read-only browser console check.`,
      );
    }
    lines.push(`- Boundary: ${status.storeAdSandbox.releaseBoundary}`, "");
  } else {
    lines.push(
      `- Missing store/ad sandbox capture manifest: \`${DEFAULT_STORE_AD_SANDBOX_CAPTURE_MANIFEST}\``,
      "- Run: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture`",
      "",
    );
  }

  lines.push("## Permission Flow Source Audit", "");
  if (status.permissionFlow.exists) {
    lines.push(
      `- Artifact: \`${status.permissionFlow.artifact}\``,
      `- Sanitized: ${status.permissionFlow.sanitized}`,
      `- Result: ${status.permissionFlow.result}`,
      `- Checks: ${status.permissionFlow.passCount} pass, ${status.permissionFlow.failCount} fail`,
    );
    if (status.permissionFlow.androidFlowOrder) {
      lines.push(`- Android order: \`${status.permissionFlow.androidFlowOrder}\``);
    }
    if (status.permissionFlow.iosFlowOrder) {
      lines.push(`- iOS order: \`${status.permissionFlow.iosFlowOrder}\``);
    }
    if (status.permissionFlow.releaseBoundary) lines.push(`- Boundary: ${status.permissionFlow.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(`- Missing permission flow audit: \`${DEFAULT_PERMISSION_FLOW_AUDIT_REPORT}\``, "");
  }

  lines.push("## Store Legal Policy", "");
  if (status.storeLegal.exists) {
    lines.push(
      `- Artifact: \`${status.storeLegal.artifact}\``,
      `- Sanitized: ${status.storeLegal.sanitized}`,
      `- Result: ${status.storeLegal.result}`,
      `- Checks: ${status.storeLegal.passCount} pass, ${status.storeLegal.failCount} fail`,
      `- Bundle/package: \`${status.storeLegal.bundleId}\` / \`${status.storeLegal.packageName}\``,
    );
    const urls = status.storeLegal.publicUrls || {};
    if (urls.privacy) lines.push(`- Privacy URL: \`${urls.privacy}\``);
    if (urls.support) lines.push(`- Support URL: \`${urls.support}\``);
    if (urls.accountDeletion) lines.push(`- Account deletion URL: \`${urls.accountDeletion}\``);
    if (status.storeLegal.releaseBoundary) lines.push(`- Boundary: ${status.storeLegal.releaseBoundary}`);
    lines.push("");
  } else {
    lines.push(`- Missing store legal audit: \`${DEFAULT_STORE_LEGAL_AUDIT_REPORT}\``, "");
  }

  lines.push("## Store Legal Web Export", "");
  if (status.storeLegalWebExport.exists) {
    lines.push(
      `- Artifact: \`${status.storeLegalWebExport.artifact}\``,
      `- Sanitized: ${status.storeLegalWebExport.sanitized}`,
      `- Result: ${status.storeLegalWebExport.result}`,
      `- Checks: ${status.storeLegalWebExport.passCount} pass, ${status.storeLegalWebExport.failCount} fail`,
      `- Export dir: \`${status.storeLegalWebExport.exportDir}\``,
    );
    for (const route of status.storeLegalWebExport.routeExports) {
      lines.push(
        `- ${route.routePath}: \`${route.htmlArtifact}\``,
        `  - Public URL: \`${route.publicUrl}\``,
        `  - Size bytes: ${route.sizeBytes}`,
        `  - SHA-256: \`${route.sha256}\``,
      );
    }
    if (status.storeLegalWebExport.releaseBoundary) {
      lines.push(`- Boundary: ${status.storeLegalWebExport.releaseBoundary}`);
    }
    lines.push("");
  } else {
    lines.push(`- Missing store legal web export audit: \`${DEFAULT_STORE_LEGAL_WEB_EXPORT_AUDIT_REPORT}\``, "");
  }

  lines.push("## Store Legal Hosted URLs", "");
  if (status.storeLegalHostedUrl.exists) {
    lines.push(
      `- Artifact: \`${status.storeLegalHostedUrl.artifact}\``,
      `- Sanitized: ${status.storeLegalHostedUrl.sanitized}`,
      `- Result: ${status.storeLegalHostedUrl.result}`,
      `- Checks: ${status.storeLegalHostedUrl.passCount} pass, ${status.storeLegalHostedUrl.failCount} fail`,
      `- Generated: ${status.storeLegalHostedUrl.generatedAt || "unknown"}`,
      `- Freshness: ${status.storeLegalHostedUrl.freshness?.status || "missing"}`,
      `- Usable for store submission: ${status.storeLegalHostedUrl.usableForStoreSubmission}`,
    );
    if (status.storeLegalHostedUrl.freshness?.ageMinutes !== null && status.storeLegalHostedUrl.freshness?.ageMinutes !== undefined) {
      lines.push(`  - Age minutes: ${status.storeLegalHostedUrl.freshness.ageMinutes}`);
    }
    for (const route of status.storeLegalHostedUrl.routeResults) {
      lines.push(
        `- ${route.routePath}: HTTP ${route.status}`,
        `  - Public URL: \`${route.publicUrl}\``,
        `  - Final URL: \`${route.finalUrl}\``,
        `  - Content type: \`${route.contentType}\``,
        `  - Size bytes: ${route.sizeBytes}`,
      );
    }
    if (status.storeLegalHostedUrl.releaseBoundary) {
      lines.push(`- Boundary: ${status.storeLegalHostedUrl.releaseBoundary}`);
    }
    lines.push("");
  } else {
    lines.push(
      `- Missing hosted URL audit: \`${DEFAULT_STORE_LEGAL_HOSTED_URL_AUDIT_REPORT}\``,
      "- Run after deployment: `npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json`",
      "",
    );
  }

  lines.push("## Store Legal Web Deploy Packet", "");
  if (status.storeLegalWebDeploy.exists) {
    lines.push(
      `- Artifact: \`${status.storeLegalWebDeploy.artifact}\``,
      `- Handoff doc: \`${status.storeLegalWebDeploy.markdownArtifact}\``,
      `- Sanitized: ${status.storeLegalWebDeploy.sanitized}`,
      `- Result: ${status.storeLegalWebDeploy.result}`,
      `- Static export ready: ${status.storeLegalWebDeploy.staticExportReady}`,
      `- Hosted URLs verified: ${status.storeLegalWebDeploy.hostedVerified}`,
    );
    if (status.storeLegalWebDeploy.sourceFreshness) {
      lines.push(`- Source freshness: ${status.storeLegalWebDeploy.sourceFreshness.status}`);
      if (status.storeLegalWebDeploy.sourceFreshness.staleReason) {
        lines.push(`  - Reason: ${status.storeLegalWebDeploy.sourceFreshness.staleReason}`);
      }
      if (status.storeLegalWebDeploy.sourceFreshness.status === "stale-source-drift") {
        lines.push(
          "- Refresh command: `npm run evidence:store-legal-web-deploy -- --run-id store-legal-web-deploy-current --output-dir docs/validation/artifacts/store-legal-web-deploy-current`",
        );
      }
    }
    if (status.storeLegalWebDeploy.deployBlockedBy.length > 0) {
      lines.push(`- Deploy blocked by: ${status.storeLegalWebDeploy.deployBlockedBy.map((id) => `\`${id}\``).join(", ")}`);
    }
    if (status.storeLegalWebDeploy.staticHostingBundle) {
      const bundle = status.storeLegalWebDeploy.staticHostingBundle;
      lines.push(
        "- Static hosting bundle:",
        `  - Generated: ${bundle.generated}`,
        `  - Bundle dir: ${bundle.bundleDir ? `\`${bundle.bundleDir}\`` : "missing"}`,
        `  - Archive created: ${bundle.archiveCreated}`,
        `  - Archive: ${bundle.archiveArtifact ? `\`${bundle.archiveArtifact}\`` : "missing"}`,
        `  - Archive SHA-256: ${bundle.archiveSha256 ? `\`${bundle.archiveSha256}\`` : "missing"}`,
        `  - Manifest: ${bundle.manifestArtifact ? `\`${bundle.manifestArtifact}\`` : "missing"}`,
        `  - Manifest SHA-256: ${bundle.manifestSha256 ? `\`${bundle.manifestSha256}\`` : "missing"}`,
        `  - Files: ${bundle.fileCount}`,
        `  - Total bytes: ${bundle.totalBytes}`,
      );
      if (bundle.reason) lines.push(`  - Reason: ${bundle.reason}`);
    }
    if (status.storeLegalWebDeploy.legalWebDeployEnvTemplate) {
      const template = status.storeLegalWebDeploy.legalWebDeployEnvTemplate;
      lines.push(
        "- Legal web deploy env template:",
        `  - Created: ${template.created}`,
        `  - Artifact: ${template.artifact ? `\`${template.artifact}\`` : "missing"}`,
        `  - SHA-256: ${template.sha256 ? `\`${template.sha256}\`` : "missing"}`,
        `  - Keys: ${template.keys.map((key) => `\`${key}\``).join(", ") || "none"}`,
        `  - Approval env: ${template.approvalEnv || "missing"}=${template.approvalExpectedValue || "missing"}`,
        `  - Active approval prefilled: ${template.activeApprovalPrefilled}`,
      );
      if (template.reason) lines.push(`  - Reason: ${template.reason}`);
    }
    if (status.storeLegalWebDeploy.easDeployment) {
      const eas = status.storeLegalWebDeploy.easDeployment;
      lines.push(
        "- EAS legal web deploy readiness:",
        `  - Artifact: \`${eas.artifact}\``,
        `  - Generated: ${eas.generatedAt || "missing"}`,
        `  - Result: ${eas.result}`,
        `  - Source freshness: ${eas.freshness.status}`,
        `  - Usable for current source reports: ${eas.usableForCurrentSourceReports}`,
        `  - Ready for approved deploy: ${eas.readyForApprovedDeploy}`,
        `  - Ready for current approved deploy: ${eas.readyForCurrentApprovedDeploy}`,
        `  - Deployment attempted: ${eas.deploymentAttempted}`,
        `  - EAS account logged in: ${eas.accountLoggedIn}`,
        `  - EAS project ID configured: ${eas.projectIdConfigured}`,
        `  - EAS project ID source: ${eas.projectIdSource}`,
        `  - EAS project ID format: ${eas.projectIdFormat}`,
        `  - EAS project linked: ${eas.projectLinked}`,
        `  - Approval set now: ${eas.approvedForDeploy}`,
      );
      if (eas.freshness.staleReason) {
        lines.push(`  - Source freshness reason: ${eas.freshness.staleReason}`);
      }
      if (eas.deploymentBlockedBy.length > 0) {
        lines.push(`  - EAS blocked by: ${eas.deploymentBlockedBy.map((id) => `\`${id}\``).join(", ")}`);
      }
    }
    for (const route of status.storeLegalWebDeploy.routeExports) {
      lines.push(
        `- ${route.routePath}: \`${route.htmlArtifact}\``,
        `  - Public URL: \`${route.publicUrl}\``,
        `  - Hosted status: ${route.hostedStatus}`,
        `  - SHA-256: \`${route.sha256}\``,
      );
    }
    if (status.storeLegalWebDeploy.releaseBoundary) {
      lines.push(`- Boundary: ${status.storeLegalWebDeploy.releaseBoundary}`);
    }
    lines.push("");
  } else {
    lines.push(
      `- Missing deploy packet: \`${DEFAULT_STORE_LEGAL_WEB_DEPLOY_PACKET_REPORT}\``,
      "- Run: `npm run evidence:store-legal-web-deploy -- --run-id store-legal-web-deploy-current --output-dir docs/validation/artifacts/store-legal-web-deploy-current`",
      "",
    );
  }

  lines.push("## Handoff Packets", "");
  for (const packet of status.handoffPackets) {
    lines.push(
      `- ${packet.label}: ${packet.status}`,
      `  - Artifact: \`${packet.artifact}\``,
      `  - Required for release: ${packet.requiredForRelease}`,
      `  - Release evidence satisfied: ${packet.releaseEvidenceSatisfied}`,
    );
    if (packet.result) lines.push(`  - Result: ${packet.result}`);
    if (packet.staleReason) {
      const reasonLabel =
        packet.status === "blocked-device-not-ready" || DEVICE_DISCOVERY_HANDOFF_PACKET_IDS.has(packet.id)
          ? "Current device blocker"
          : "Stale/current-state reason";
      lines.push(`  - ${reasonLabel}: ${packet.staleReason}`);
    }
    if (packet.storeSourceFreshnessStatus) lines.push(`  - Source freshness: ${packet.storeSourceFreshnessStatus}`);
    if (packet.sourceFreshnessStatus) lines.push(`  - Source freshness: ${packet.sourceFreshnessStatus}`);
    if (packet.deviceDiscoveryFreshnessStatus) lines.push(`  - Discovery freshness: ${packet.deviceDiscoveryFreshnessStatus}`);
    if (packet.deviceDiscoveryFreshness?.ageMinutes !== null && packet.deviceDiscoveryFreshness?.ageMinutes !== undefined) {
      lines.push(`  - Discovery age minutes: ${packet.deviceDiscoveryFreshness.ageMinutes}`);
    }
    if (typeof packet.deviceReadyForCapture === "boolean") {
      lines.push(`  - Device ready for capture: ${packet.deviceReadyForCapture}`);
    }
    if (packet.deviceSummary) {
      const deviceParts = [packet.deviceSummary.name, packet.deviceSummary.osVersion ? `iOS ${packet.deviceSummary.osVersion}` : ""]
        .filter(Boolean)
        .join(", ");
      if (deviceParts) lines.push(`  - Device: ${deviceParts}`);
    }
    if (packet.deviceListSource) lines.push(`  - Device list source: ${packet.deviceListSource}`);
    if (packet.deviceListArtifact) lines.push(`  - Device list artifact: \`${packet.deviceListArtifact}\``);
    if (packet.errorArtifact) lines.push(`  - Discovery error artifact: \`${packet.errorArtifact}\``);
    if (packet.xctraceErrorArtifact) lines.push(`  - xctrace error artifact: \`${packet.xctraceErrorArtifact}\``);
    if (packet.devicectlErrorArtifact) lines.push(`  - devicectl error artifact: \`${packet.devicectlErrorArtifact}\``);
    if (packet.physicalDeviceCount !== null) lines.push(`  - Physical devices: ${packet.physicalDeviceCount}`);
    if (packet.readyDeviceCount !== null) lines.push(`  - Ready devices: ${packet.readyDeviceCount}`);
    if (packet.readyPhysicalCandidateCount !== null) lines.push(`  - Ready physical candidates: ${packet.readyPhysicalCandidateCount}`);
    if (packet.manualFlowCount > 0) lines.push(`  - Manual flow rows: ${packet.manualFlowCount}`);
    if (packet.outputDir) lines.push(`  - Output dir: \`${packet.outputDir}\``);
    if (packet.deviceDetailsArtifact) lines.push(`  - Device details artifact: \`${packet.deviceDetailsArtifact}\``);
    if (packet.appPackageProof) lines.push(`  - App package proof: \`${packet.appPackageProof}\``);
    if (packet.companionArtifacts?.consolePaymentHandoffArtifact) {
      lines.push(`  - Console/payment handoff: \`${packet.companionArtifacts.consolePaymentHandoffArtifact}\``);
    }
    if (packet.companionArtifacts?.evidenceFillTemplateArtifact) {
      lines.push(`  - Evidence fill template: \`${packet.companionArtifacts.evidenceFillTemplateArtifact}\``);
    }
    if (packet.companionArtifacts?.storeSandboxTestPlanArtifact) {
      lines.push(`  - Store sandbox test plan: \`${packet.companionArtifacts.storeSandboxTestPlanArtifact}\``);
    }
    if (packet.companionArtifacts?.paywallLaunchSourceAuditArtifact) {
      lines.push(`  - Paywall source audit: \`${packet.companionArtifacts.paywallLaunchSourceAuditArtifact}\``);
    }
    if (packet.evidenceBoundary) lines.push(`  - Boundary: ${packet.evidenceBoundary}`);
  }

  lines.push("", "## Next Actions", "");
  for (const action of status.nextActions) {
    lines.push(`- ${action.id}: ${action.status}`);
    if (action.requiredEnv.length > 0) lines.push(`  - Required env: ${action.requiredEnv.join(", ")}`);
    if (action.requiredReports.length > 0) {
      lines.push("  - Required reports:");
      for (const report of action.requiredReports) lines.push(`    - \`${report}\``);
    }
    if (action.captureHelperCommand) lines.push(`  - Capture helper: \`${action.captureHelperCommand}\``);
    if (action.evidenceFile) lines.push(`  - Evidence file: \`${action.evidenceFile}\``);
  }

  lines.push("", "Do not submit production until releaseReady is true and strict release verification passes.", "");
  return `${lines.join("\n")}\n`;
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runSelfTest() {
  assert.equal(safeRunId("launch-status-1"), "launch-status-1");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => assertSafeInputReportPath("docs/validation/evidence/report.json", "--preflight-report"), /artifacts/);
  assert.throws(() => assertSafeInputReportPath("docs/validation/artifacts/run/report.txt", "--preflight-report"), /\.json/);
  assert.throws(() => parseArgs(["--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);

  const status = buildStatus({
    outputDir: DEFAULT_OUTPUT_DIR,
    preflightReport: DEFAULT_PREFLIGHT_REPORT,
    runId: "self-test",
  });
  assert.equal(status.schema, "freed-release-launch-status-v1");
  assert.equal(status.sanitized, true);
  assert.equal(status.releaseReady, false);
  assert.equal(typeof status.physicalDeviceReadiness.overallStatus, "string");
  assert.equal(typeof status.physicalDeviceReadiness.android.captureReady, "boolean");
  assert.equal(typeof status.physicalDeviceReadiness.ios.captureReady, "boolean");
  const captureReadyPhysicalReadiness = summarizePhysicalDeviceReadiness([
    {
      deviceDiscoveryFreshness: { status: "current" },
      exists: true,
      id: "android-device-discovery",
      readyDeviceCount: 1,
      readyPhysicalCandidateCount: 1,
      result: "ready-physical-device",
    },
    {
      deviceDiscoveryFreshness: { status: "current" },
      deviceListArtifact: "docs/validation/artifacts/ios-device-discovery-current/xctrace-devices.txt",
      deviceListSource: "xctrace",
      exists: true,
      id: "ios-device-discovery",
      readyDeviceCount: 1,
      readyPhysicalCandidateCount: 1,
      result: "ready-physical-device",
    },
  ]);
  assert.equal(captureReadyPhysicalReadiness.overallStatus, "capture-ready");
  assert.equal(captureReadyPhysicalReadiness.ios.deviceListSource, "xctrace");
  assert.match(captureReadyPhysicalReadiness.ios.deviceListArtifact, /xctrace-devices\.txt/);
  const iosReadinessWithDeviceListSource = summarizePhysicalDeviceReadiness([
    {
      deviceDiscoveryFreshness: { status: "current" },
      devicectlErrorArtifact: "docs/validation/artifacts/ios-device-discovery-current/devicectl-devices-error.txt",
      deviceListArtifact: "docs/validation/artifacts/ios-device-discovery-current/devicectl-devices.json",
      deviceListSource: "devicectl",
      errorArtifact: "docs/validation/artifacts/ios-device-discovery-current/device-discovery-error.txt",
      exists: true,
      id: "ios-device-discovery",
      next: "Fix Xcode device tooling, connect and trust a physical iPhone, then rerun npm run evidence:ios-devices.",
      readyDeviceCount: 0,
      readyPhysicalCandidateCount: 0,
      result: "physical-device-offline",
      xctraceErrorArtifact: "docs/validation/artifacts/ios-device-discovery-current/xctrace-devices-error.txt",
    },
  ]).ios;
  assert.equal(iosReadinessWithDeviceListSource.deviceListSource, "devicectl");
  assert.match(iosReadinessWithDeviceListSource.deviceListArtifact, /devicectl-devices\.json/);
  assert.match(iosReadinessWithDeviceListSource.errorArtifact, /device-discovery-error\.txt/);
  assert.match(iosReadinessWithDeviceListSource.xctraceErrorArtifact, /xctrace-devices-error\.txt/);
  assert.match(iosReadinessWithDeviceListSource.devicectlErrorArtifact, /devicectl-devices-error\.txt/);
  assert.match(iosReadinessWithDeviceListSource.next, /Fix Xcode device tooling/);
  const iosReadinessWithFailedTooling = summarizePhysicalDeviceReadiness([
    {
      deviceDiscoveryFreshness: { status: "current" },
      devicectlErrorArtifact: "docs/validation/artifacts/ios-device-discovery-current/devicectl-devices-error.txt",
      errorArtifact: "docs/validation/artifacts/ios-device-discovery-current/device-discovery-error.txt",
      exists: true,
      id: "ios-device-discovery",
      next: "Fix Xcode device tooling, connect and trust a physical iPhone, then rerun npm run evidence:ios-devices.",
      readyDeviceCount: 0,
      readyPhysicalCandidateCount: 0,
      result: "device-discovery-failed",
      xctraceErrorArtifact: "docs/validation/artifacts/ios-device-discovery-current/xctrace-devices-error.txt",
    },
  ]).ios;
  assert.equal(iosReadinessWithFailedTooling.status, "device-discovery-failed");
  assert.equal(iosReadinessWithFailedTooling.toolingFailed, true);
  assert.match(iosReadinessWithFailedTooling.next, /Fix Xcode device tooling/);
  const currentFreshnessSelfTest = summarizeArtifactFreshness("2026-06-09T00:00:00.000Z", ANDROID_DOWNLOAD_LIVE_CHECK_FRESH_MS, Date.parse("2026-06-09T00:10:00.000Z"));
  assert.equal(currentFreshnessSelfTest.status, "current");
  assert.equal(currentFreshnessSelfTest.fresh, true);
  const staleFreshnessSelfTest = summarizeArtifactFreshness("2026-06-09T00:00:00.000Z", ANDROID_DOWNLOAD_LIVE_CHECK_FRESH_MS, Date.parse("2026-06-09T00:16:00.000Z"));
  assert.equal(staleFreshnessSelfTest.status, "stale");
  assert.equal(staleFreshnessSelfTest.fresh, false);
  const ensureStartedServerSelfTest = summarizeAndroidDownloadEnsureValue(
    {
      generatedAt: "2026-06-09T00:00:00.000Z",
      result: "pass",
      passCount: 4,
      failCount: 1,
      sanitized: true,
      schemaVersion: "freed-android-apk-download-ensure-v1",
      serverStarted: true,
      startAttempted: true,
      startIfNeeded: true,
      liveChecks: [
        {
          exitCode: 1,
          label: "initial",
          passed: false,
          reportResult: "fail",
        },
        {
          exitCode: 0,
          label: "post-start-1",
          passed: true,
          reportResult: "pass",
        },
      ],
    },
    "docs/validation/artifacts/self-test/android-apk-download-ensure.json",
    Date.parse("2026-06-09T00:01:00.000Z"),
  );
  assert.equal(ensureStartedServerSelfTest.status, "current");
  assert.equal(ensureStartedServerSelfTest.usableForCurrentDownload, true);
  assert.equal(ensureStartedServerSelfTest.latestLiveCheck.passed, true);
  assert.equal(ensureStartedServerSelfTest.failCount, 1);
  const installQaPlanMissingSelfTest = summarizeAndroidInstallQaPlan(
    "docs/validation/artifacts/self-test/missing-android-install-qa-plan.json",
    {
      apkPath: "docs/validation/artifacts/example/FREED-release-universal.apk",
      apkSha256: "sha256-a",
      runId: "self-test",
    },
  );
  assert.equal(installQaPlanMissingSelfTest.exists, false);
  assert.equal(installQaPlanMissingSelfTest.usableForInstallHandoff, false);
  const staleDiscoveryFreshnessSelfTest = summarizeArtifactFreshness(
    "2026-06-09T00:00:00.000Z",
    DEVICE_DISCOVERY_FRESH_MS,
    Date.parse("2026-06-09T00:16:00.000Z"),
  );
  assert.equal(staleDiscoveryFreshnessSelfTest.status, "stale");
  const currentHostedLegalFreshnessSelfTest = summarizeArtifactFreshness(
    "2026-06-09T00:00:00.000Z",
    HOSTED_LEGAL_URL_AUDIT_FRESH_MS,
    Date.parse("2026-06-09T23:59:00.000Z"),
  );
  assert.equal(currentHostedLegalFreshnessSelfTest.status, "current");
  const staleHostedLegalFreshnessSelfTest = summarizeArtifactFreshness(
    "2026-06-09T00:00:00.000Z",
    HOSTED_LEGAL_URL_AUDIT_FRESH_MS,
    Date.parse("2026-06-10T00:01:00.000Z"),
  );
  assert.equal(staleHostedLegalFreshnessSelfTest.status, "stale");
  assert.equal(typeof status.hostedLegalUrlsReady, "boolean");
  if (status.androidDownload?.handoff?.exists) {
    assert.equal(typeof status.androidDownload.handoff.usableForPhysicalQaHandoff, "boolean");
    assert.equal(typeof status.androidDownload.handoff.useBoundary.boundaryValid, "boolean");
    assert.equal(typeof status.androidDownload.handoff.useBoundary.sameDeviceEvidenceValid, "boolean");
    assert.equal(typeof status.androidDownload.handoff.useBoundary.localQaDownloadReady, "boolean");
    assert.equal(typeof status.androidDownload.handoff.useBoundary.storeSubmissionReady, "boolean");
    assert.ok(Array.isArray(status.androidDownload.handoff.useBoundary.sameDeviceEvidenceSequence));
    assert.ok(Array.isArray(status.androidDownload.handoff.useBoundary.requiredSameDeviceSteps));
    if (status.androidDownload.handoff.liveCheck?.exists) {
      assert.equal(typeof status.androidDownload.handoff.liveCheck.requiredBoundaryPageChecksPassed, "boolean");
      assert.ok(Array.isArray(status.androidDownload.handoff.liveCheck.requiredLiveCheckIds));
      assert.ok(Array.isArray(status.androidDownload.handoff.liveCheck.missingRequiredContentCheckIds));
    }
    if (status.androidDownload.handoff.ensure?.exists) {
      assert.equal(typeof status.androidDownload.handoff.ensure.startAttempted, "boolean");
      assert.equal(typeof status.androidDownload.handoff.ensure.serverStarted, "boolean");
      assert.equal(typeof status.androidDownload.handoff.ensure.usableForCurrentDownload, "boolean");
    }
  }
  assert.equal(typeof status.easBuildHandoff.exists, "boolean");
  assert.equal(typeof status.easBuildAttempt.exists, "boolean");
  assert.equal(typeof status.easBuildAttempt.readyForCurrentSourceArtifact, "boolean");
  assert.equal(typeof status.androidUploadSigning.exists, "boolean");
  assert.equal(typeof status.storeCatalog.exists, "boolean");
  assert.equal(typeof status.storeListingScreenshotsReady, "boolean");
  if (status.storeCatalog.exists) {
    assert.equal(typeof status.storeCatalog.listingScreenshotReadiness.readyForStoreUpload, "boolean");
    assert.equal(typeof status.storeCatalog.listingScreenshotReadiness.status, "string");
    assert.ok(Array.isArray(status.storeCatalog.listingScreenshotReadiness.blockers));
  }
  assert.equal(typeof status.paywallLaunchScope.exists, "boolean");
  assert.equal(typeof status.storeAdSandbox.exists, "boolean");
  if (status.storeAdSandbox.exists) {
    assert.equal(typeof status.storeAdSandbox.appRecordActionPacket.exists, "boolean");
    if (status.storeAdSandbox.appRecordActionPacket.exists) {
      assert.equal(typeof status.storeAdSandbox.appRecordActionPacket.actionTimeConfirmationRequired, "boolean");
      assert.equal(typeof status.storeAdSandbox.appRecordActionPacket.usableForDraftAppRecordAction, "boolean");
      assert.equal(
        status.storeAdSandbox.appRecordActionPacket.confirmationToken,
        "confirm-draft-store-app-record-creation-only",
      );
      assert.equal(typeof status.storeAdSandbox.appRecordActionPacket.sourceFreshness.status, "string");
      assert.equal(typeof status.storeAdSandbox.appRecordActionPacket.browserReadiness.freshness.status, "string");
    }
    assert.equal(typeof status.storeAdSandbox.adMobActionPacket.exists, "boolean");
    if (status.storeAdSandbox.adMobActionPacket.exists) {
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.actionTimeConfirmationRequired, "boolean");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.usableForAdMobConsoleAction, "boolean");
      assert.equal(
        status.storeAdSandbox.adMobActionPacket.confirmationToken,
        "confirm-admob-app-and-rewarded-unit-creation-only",
      );
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.sourceFreshness.status, "string");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.adMobEnvPatchTemplateArtifact, "string");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.adMobEnvPatchTemplateExists, "boolean");
      assert.ok(Array.isArray(status.storeAdSandbox.adMobActionPacket.missingEnvKeys));
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadinessCommand, "string");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadinessArtifact, "string");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadiness.exists, "boolean");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadiness.browserConnector.status, "string");
      assert.equal(typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadiness.browserConnector.nativeModuleLoadFailed, "boolean");
      assert.equal(
        typeof status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadiness.browserConnector.repairHandoff.required,
        "boolean",
      );
      assert.ok(Array.isArray(status.storeAdSandbox.adMobActionPacket.readOnlyAdMobReadiness.nextActions));
    }
    assert.equal(typeof status.storeAdSandbox.consoleProductSetup.exists, "boolean");
    assert.equal(typeof status.storeAdSandbox.sourceFreshness.status, "string");
  }
  assert.equal(typeof status.storeConsoleBrowserReadiness.exists, "boolean");
  assert.equal(typeof status.storeConsoleBrowserReadiness.readyForConsoleProductSetup, "boolean");
  if (status.storeConsoleBrowserReadiness.exists) {
    assert.equal(typeof status.storeConsoleBrowserReadiness.browserConnector.status, "string");
    assert.equal(typeof status.storeConsoleBrowserReadiness.browserConnector.nativeModuleLoadFailed, "boolean");
    assert.equal(typeof status.storeConsoleBrowserReadiness.browserConnector.repairHandoff.required, "boolean");
    assert.ok(Array.isArray(status.storeConsoleBrowserReadiness.nextActions));
  }
  assert.equal(typeof status.permissionFlow.exists, "boolean");
  assert.equal(typeof status.storeLegal.exists, "boolean");
  assert.equal(typeof status.storeLegalWebExport.exists, "boolean");
  assert.equal(typeof status.storeLegalHostedUrl.exists, "boolean");
  if (status.storeLegalHostedUrl.exists) {
    assert.equal(typeof status.storeLegalHostedUrl.freshness.status, "string");
    assert.equal(typeof status.storeLegalHostedUrl.usableForStoreSubmission, "boolean");
  }
  assert.equal(typeof status.storeLegalWebDeploy.exists, "boolean");
  if (status.storeLegalWebDeploy.exists) {
    assert.equal(typeof status.storeLegalWebDeploy.sourceFreshness.status, "string");
    if (status.storeLegalWebDeploy.legalWebDeployEnvTemplate) {
      assert.equal(typeof status.storeLegalWebDeploy.legalWebDeployEnvTemplate.created, "boolean");
      assert.equal(typeof status.storeLegalWebDeploy.legalWebDeployEnvTemplate.activeApprovalPrefilled, "boolean");
      assert.ok(Array.isArray(status.storeLegalWebDeploy.legalWebDeployEnvTemplate.keys));
    }
    if (status.storeLegalWebDeploy.easDeployment) {
      assert.equal(typeof status.storeLegalWebDeploy.easDeployment.freshness.status, "string");
      assert.equal(typeof status.storeLegalWebDeploy.easDeployment.usableForCurrentSourceReports, "boolean");
      assert.equal(typeof status.storeLegalWebDeploy.easDeployment.projectIdConfigured, "boolean");
      assert.equal(typeof status.storeLegalWebDeploy.easDeployment.projectIdSource, "string");
      assert.equal(typeof status.storeLegalWebDeploy.easDeployment.projectIdFormat, "string");
    }
  }
  assert.equal(typeof status.preflight.productionEnvGapChecklist.jsonExists, "boolean");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.sourceFreshness.status, "string");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.outputFreshness.status, "string");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.groupIdsMatchCurrentPreflight, "boolean");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.skeletonUsableForCurrentPreflight, "boolean");
  assert.ok(Array.isArray(status.preflight.productionEnvGapChecklist.currentFailedProductionEnvGroupIds));
  assert.ok(Array.isArray(status.preflight.productionEnvGapChecklist.checklistFailedProductionEnvGroupIds));
  assert.ok(Array.isArray(status.preflight.productionEnvGapChecklist.structuralIssues));
  assert.equal(typeof status.preflight.productionEnvGapChecklist.envSkeleton.exists, "boolean");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.envSkeleton.coversFailedProductionEnvGroups, "boolean");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.envSkeleton.publicDefaultsPresent, "boolean");
  assert.equal(typeof status.preflight.productionEnvGapChecklist.envSkeleton.secretLikeValuesOmitted, "boolean");
  assert.ok(Array.isArray(status.preflight.productionEnvGapChecklist.envSkeleton.unexpectedFilledValueKeys));
  const missingEnvSkeletonSelfTest = summarizeEnvSkeletonStructure(
    "docs/validation/artifacts/self-test/missing-production-env.env",
    ["production-monetization"],
  );
  assert.equal(missingEnvSkeletonSelfTest.exists, false);
  assert.equal(missingEnvSkeletonSelfTest.coversFailedProductionEnvGroups, false);
  assert.match(missingEnvSkeletonSelfTest.status, /missing/);
  const safeEnvSkeletonSelfTestPath =
    "docs/validation/artifacts/self-test-safe-production-env-missing-keys.env";
  fs.mkdirSync(path.dirname(path.join(process.cwd(), safeEnvSkeletonSelfTestPath)), { recursive: true });
  try {
    fs.writeFileSync(
      path.join(process.cwd(), safeEnvSkeletonSelfTestPath),
      [
        "# production-android-signing",
        ...Object.entries(ENV_SKELETON_SAFE_PUBLIC_DEFAULTS).map(([key, value]) => `${key}=${value}`),
        "",
      ].join("\n"),
    );
    const safeEnvSkeletonSelfTest = summarizeEnvSkeletonStructure(safeEnvSkeletonSelfTestPath, [
      "production-android-signing",
    ]);
    assert.equal(safeEnvSkeletonSelfTest.exists, true);
    assert.equal(safeEnvSkeletonSelfTest.coversFailedProductionEnvGroups, true);
    assert.equal(safeEnvSkeletonSelfTest.publicDefaultsPresent, true);
    assert.equal(safeEnvSkeletonSelfTest.secretLikeValuesOmitted, true);
    assert.equal(safeEnvSkeletonSelfTest.status, "current");
    assert.ok(
      !safeEnvSkeletonSelfTest.unexpectedFilledValueKeys.includes("FREED_REQUIRE_ANDROID_RELEASE_SIGNING"),
    );
  } finally {
    try {
      fs.unlinkSync(path.join(process.cwd(), safeEnvSkeletonSelfTestPath));
    } catch {
      // Self-test cleanup is best-effort.
    }
  }
  assert.equal(typeof status.supabaseDeployment.exists, "boolean");
  if (status.supabaseDeployment.exists) {
    assert.equal(typeof status.supabaseDeployment.sourceFreshness.status, "string");
  }
  assert.ok(status.handoffPackets.some((packet) => packet.id === "store-ad-sandbox"));
  assert.ok(status.handoffPackets.some((packet) => packet.id === "ios-physical-capture"));
  assert.ok(status.handoffPackets.some((packet) => packet.id === "android-real-browser-capture"));
  const existingPlanOnlyPacketSelfTest = status.handoffPackets.find(
    (packet) => packet.exists && packet.id === "android-real-browser-capture" && packet.result,
  );
  if (existingPlanOnlyPacketSelfTest) {
    assert.notEqual(existingPlanOnlyPacketSelfTest.status, "pending");
    assert.equal(existingPlanOnlyPacketSelfTest.status, existingPlanOnlyPacketSelfTest.result);
  }
  const stalePacketSelfTest = applyHandoffPacketCrossChecks([
    {
      id: "ios-device-discovery",
      exists: true,
      readyDeviceCount: 0,
      readyPhysicalCandidateCount: 0,
      result: "physical-device-offline",
    },
    {
      id: "ios-physical-capture",
      deviceSummary: { source: "devices offline" },
      exists: true,
      releaseEvidenceSatisfied: false,
      result: "metadata-captured",
      status: "pending",
    },
  ]).find((packet) => packet.id === "ios-physical-capture");
  assert.equal(stalePacketSelfTest.status, "blocked-device-not-ready");
  assert.equal(stalePacketSelfTest.deviceReadyForCapture, false);
  assert.match(stalePacketSelfTest.staleReason, /current-ios-device-discovery-has-no-ready-physical-device/);
  assert.match(stalePacketSelfTest.staleReason, /capture-device-was-offline/);
  const failedToolingDiscoveryPacketSelfTest = applyHandoffPacketCrossChecks([
    {
      deviceDiscoveryFreshness: { status: "current" },
      exists: true,
      id: "ios-device-discovery",
      releaseEvidenceSatisfied: false,
      result: "device-discovery-failed",
      status: "pending",
    },
    {
      id: "ios-physical-capture",
      exists: true,
      releaseEvidenceSatisfied: false,
      result: "plan-only",
      status: "pending",
    },
  ]);
  assert.equal(
    failedToolingDiscoveryPacketSelfTest.find((packet) => packet.id === "ios-device-discovery").status,
    "device-discovery-failed",
  );
  assert.equal(
    failedToolingDiscoveryPacketSelfTest.find((packet) => packet.id === "ios-device-discovery").staleReason,
    "device-discovery-tooling-failed",
  );
  assert.match(
    failedToolingDiscoveryPacketSelfTest.find((packet) => packet.id === "ios-physical-capture").staleReason,
    /current-ios-device-discovery-tooling-failed/,
  );
  const currentNoReadyDiscoveryPacketSelfTest = applyHandoffPacketCrossChecks([
    {
      deviceDiscoveryFreshness: { status: "current" },
      exists: true,
      id: "android-device-discovery",
      readyDeviceCount: 0,
      readyPhysicalCandidateCount: 0,
      releaseEvidenceSatisfied: false,
      result: "no-ready-android-device",
      status: "pending",
    },
  ]).find((packet) => packet.id === "android-device-discovery");
  assert.equal(currentNoReadyDiscoveryPacketSelfTest.status, "no-ready-android-device");
  assert.equal(currentNoReadyDiscoveryPacketSelfTest.deviceDiscoveryFreshnessStatus, "current");
  assert.match(currentNoReadyDiscoveryPacketSelfTest.staleReason, /device-discovery-result-no-ready-android-device/);
  const staleDeviceDiscoveryPacketSelfTest = applyHandoffPacketCrossChecks([
    {
      deviceDiscoveryFreshness: staleDiscoveryFreshnessSelfTest,
      exists: true,
      id: "android-device-discovery",
      releaseEvidenceSatisfied: false,
      result: "no-ready-android-device",
      status: "pending",
    },
  ]).find((packet) => packet.id === "android-device-discovery");
  assert.equal(staleDeviceDiscoveryPacketSelfTest.status, "stale-device-discovery");
  assert.equal(staleDeviceDiscoveryPacketSelfTest.deviceDiscoveryFreshnessStatus, "stale");
  assert.match(staleDeviceDiscoveryPacketSelfTest.staleReason, /device-discovery-stale/);
  const staleStorePacketSelfTest = applyHandoffPacketCrossChecks(
    [
      {
        id: "store-ad-sandbox",
        exists: true,
        releaseEvidenceSatisfied: true,
        result: "passed",
        status: "complete",
      },
    ],
    {
      storeAdSandbox: {
        sourceFreshness: {
          staleReason: "paywall-launch-source-audit: paywall-source-hash-mismatch",
          status: "stale-source-drift",
        },
      },
    },
  ).find((packet) => packet.id === "store-ad-sandbox");
  assert.equal(staleStorePacketSelfTest.status, "stale-store-source-drift");
  assert.equal(staleStorePacketSelfTest.releaseEvidenceSatisfied, false);
  assert.match(staleStorePacketSelfTest.staleReason, /paywall-source-hash-mismatch/);
  const staleSupabaseFreshness = summarizeSupabaseSourceFreshness({
    schema: {
      path: "docs/backend/supabase-schema.sql",
      sha256: `sha256-${"0".repeat(64)}`,
    },
  });
  assert.equal(staleSupabaseFreshness.status, "stale-source-drift");
  assert.match(staleSupabaseFreshness.staleReason, /supabase-schema-hash-mismatch/);
  const staleLegalWebDeployFreshness = summarizeStoreLegalWebDeploySourceFreshness(
    {
      routeExports: [
        {
          htmlArtifact: "dist/privacy.html",
          id: "privacy",
          sha256: `sha256-${"0".repeat(64)}`,
        },
      ],
    },
    {
      routeExports: [
        {
          htmlArtifact: "dist/privacy.html",
          id: "privacy",
          sha256: `sha256-${"1".repeat(64)}`,
        },
      ],
    },
  );
  assert.equal(staleLegalWebDeployFreshness.status, "stale-source-drift");
  assert.match(staleLegalWebDeployFreshness.staleReason, /legal-route-privacy-hash-mismatch/);
  const staleProductionEnvGapSourceFreshness = summarizeSourceFreshness([
    compareSourceHash({
      actualHash: `sha256-${"0".repeat(64)}`,
      actualPath: "docs/validation/artifacts/release-env-current/release-env-preflight-report.json",
      currentHash: `sha256-${"1".repeat(64)}`,
      currentPath: "docs/validation/artifacts/release-env-current/release-env-preflight-report.json",
      id: "production-env-gap-preflight",
    }),
  ]);
  assert.equal(staleProductionEnvGapSourceFreshness.status, "stale-source-drift");
  assert.match(staleProductionEnvGapSourceFreshness.staleReason, /production-env-gap-preflight-hash-mismatch/);
  const staleProductionEnvGapOutputFreshness = summarizeSourceFreshness([
    compareSourceHash({
      actualHash: `sha256-${"0".repeat(64)}`,
      actualPath: "docs/validation/artifacts/release-env-current/PRODUCTION_ENV_GAP_CHECKLIST.md",
      currentHash: `sha256-${"1".repeat(64)}`,
      currentPath: "docs/validation/artifacts/release-env-current/PRODUCTION_ENV_GAP_CHECKLIST.md",
      id: "production-env-gap-checklist",
    }),
  ]);
  assert.equal(staleProductionEnvGapOutputFreshness.status, "stale-source-drift");
  assert.match(staleProductionEnvGapOutputFreshness.staleReason, /production-env-gap-checklist-hash-mismatch/);
  const staleNormalBrowsingFreshness = summarizePacketSourceFreshness(
    [
      {
        path: "docs/validation/templates/normal-browsing-corpus.template.json",
        sha256: `sha256-${"0".repeat(64)}`,
      },
    ],
    "normal-browsing-corpus",
  );
  assert.equal(staleNormalBrowsingFreshness.status, "stale-source-drift");
  assert.match(staleNormalBrowsingFreshness.staleReason, /normal-browsing-corpus-normal-browsing-corpus\.template\.json-hash-mismatch/);
  const stalePerformanceFreshness = summarizePacketSourceFreshness(
    [
      {
        path: "docs/validation/templates/performance-profile.template.json",
        sha256: `sha256-${"0".repeat(64)}`,
      },
    ],
    "performance-profile",
  );
  assert.equal(stalePerformanceFreshness.status, "stale-source-drift");
  assert.match(stalePerformanceFreshness.staleReason, /performance-profile-performance-profile\.template\.json-hash-mismatch/);
  const staleAiBackendFreshness = summarizePacketSourceFreshness(
    [
      {
        path: "docs/validation/templates/ai-backend-smoke.template.json",
        sha256: `sha256-${"0".repeat(64)}`,
      },
    ],
    "ai-backend-smoke",
  );
  assert.equal(staleAiBackendFreshness.status, "stale-source-drift");
  assert.match(staleAiBackendFreshness.staleReason, /ai-backend-smoke-ai-backend-smoke\.template\.json-hash-mismatch/);
  const staleNormalBrowsingPacketSelfTest = applyHandoffPacketCrossChecks([
    {
      id: "normal-browsing-corpus",
      exists: true,
      releaseEvidenceSatisfied: true,
      result: "passed",
      sourceFreshness: {
        staleReason: "normal-browsing-corpus-normal-browsing-corpus.template.json-hash-mismatch",
        status: "stale-source-drift",
      },
      status: "complete",
    },
  ]).find((packet) => packet.id === "normal-browsing-corpus");
  assert.equal(staleNormalBrowsingPacketSelfTest.status, "stale-source-drift");
  assert.equal(staleNormalBrowsingPacketSelfTest.releaseEvidenceSatisfied, false);
  const missingSourcePacketSelfTest = applyHandoffPacketCrossChecks([
    {
      id: "performance-profile",
      exists: true,
      releaseEvidenceSatisfied: true,
      result: "passed",
      sourceFreshness: summarizePacketSourceFreshness([], "performance-profile"),
      status: "complete",
    },
  ]).find((packet) => packet.id === "performance-profile");
  assert.equal(missingSourcePacketSelfTest.status, "missing-source-proof");
  assert.equal(missingSourcePacketSelfTest.releaseEvidenceSatisfied, false);
  assert.match(missingSourcePacketSelfTest.staleReason, /source-proof-missing/);
  assert.match(buildMarkdown(status), /Permission Flow Source Audit/);
  assert.match(buildMarkdown({ ...status, handoffPackets: applyHandoffPacketCrossChecks(status.handoffPackets) }), /blocked-device-not-ready|Handoff Packets/);
  assert.match(buildMarkdown(status), /Physical Device Readiness/);
  assert.match(buildMarkdown(status), /physical-device-capture-blocked|capture-ready/);
  assert.match(buildMarkdown(status), /Ready physical candidates/);
  assert.match(buildMarkdown(status), /Ready to serve selected APK/);
  assert.match(buildMarkdown(status), /Usable for physical QA handoff/);
  assert.match(buildMarkdown(status), /APK use boundary valid/);
  assert.match(buildMarkdown(status), /Store submission ready: false|Store submission ready: true/);
  assert.match(buildMarkdown(status), /Store submission correctly blocked: false|Store submission correctly blocked: true/);
  assert.match(buildMarkdown(status), /Same-device evidence required/);
  assert.match(buildMarkdown(status), /Same-device evidence valid/);
  assert.match(buildMarkdown(status), /Download server currently verified/);
  assert.match(buildMarkdown(status), /Required boundary\/page checks passed/);
  assert.match(buildMarkdown(status), /Freshness: (current|stale|failing|missing-generatedAt)/);
  assert.match(buildMarkdown(status), /download server live check|Download server live check/i);
  assert.match(buildMarkdown(status), /Ensure download server/);
  if (status.androidDownload?.handoff?.permissionWizardCommand) {
    assert.match(buildMarkdown(status), /Permission wizard report command/);
  }
  if (status.androidDownload?.handoff?.installQaPlanCommand) {
    assert.match(buildMarkdown(status), /Write install QA plan/);
    assert.match(buildMarkdown(status), /--plan-only/);
  }
  if (status.androidDownload?.handoff?.installQaPlanArtifact) {
    assert.match(buildMarkdown(status), /Install QA plan artifact/);
    assert.match(buildMarkdown(status), /Install QA plan exists/);
    assert.match(buildMarkdown(status), /Install QA plan status/);
    assert.match(buildMarkdown(status), /Install QA plan usable for handoff/);
    assert.match(buildMarkdown(status), /Install QA plan APK hash matches handoff/);
    assert.match(buildMarkdown(status), /Install QA plan release evidence satisfied/);
    assert.match(buildMarkdown(status), /Install QA plan required proof flags present/);
    assert.match(buildMarkdown(status), /android-install-qa-plan\.json/);
  }
  assert.match(buildMarkdown(status), /Android device discovery|Android Local Download/);
  assert.match(buildMarkdown(status), /Discovery freshness|Freshness: current|Freshness: stale/);
  assert.match(buildMarkdown(status), /Android Upload Signing/);
  assert.match(buildMarkdown(status), /Backend\/Supabase Deployment Packet/);
  if (status.supabaseDeployment.exists) {
    assert.match(buildMarkdown(status), /Source freshness/);
  }
  assert.match(buildMarkdown(status), /Paywall Source Scope/);
  assert.match(buildMarkdown(status), /Store\/Ad Sandbox Setup/);
  if (status.storeAdSandbox.exists) {
    assert.match(buildMarkdown(status), /Source freshness/);
    assert.match(buildMarkdown(status), /Console product setup proof/);
    if (status.storeAdSandbox.companionArtifacts.adMobActionPacketArtifact) {
      assert.match(buildMarkdown(status), /AdMob action packet/);
    }
    if (status.storeAdSandbox.companionArtifacts.consoleExecutionRunbookArtifact) {
      assert.match(buildMarkdown(status), /Console execution runbook/);
    }
  }
  assert.match(buildMarkdown(status), /Store Legal Policy/);
  assert.match(buildMarkdown(status), /Store Legal Web Export/);
  assert.match(buildMarkdown(status), /Store Legal Hosted URLs/);
  if (status.storeLegalHostedUrl.exists) {
    assert.match(buildMarkdown(status), /Usable for store submission/);
  }
  assert.match(buildMarkdown(status), /Store Legal Web Deploy Packet/);
  if (status.storeLegalWebDeploy.exists) {
    assert.match(buildMarkdown(status), /Source freshness/);
    if (status.storeLegalWebDeploy.easDeployment) {
      assert.match(buildMarkdown(status), /Usable for current source reports/);
    }
  }
  assert.match(buildMarkdown(status), /Release ready: false/);
  const statusWithGapChecklist = {
    ...status,
    preflight: {
      ...status.preflight,
      productionEnvGapChecklist: {
        artifact: "docs/validation/artifacts/release-env-current/PRODUCTION_ENV_GAP_CHECKLIST.md",
        jsonArtifact: "docs/validation/artifacts/release-env-current/production-env-gap-checklist.json",
        jsonExists: true,
        envSkeletonArtifact: "docs/validation/artifacts/release-env-current/PRODUCTION_ENV_MISSING_KEYS.env",
        envSkeletonExists: true,
        exists: true,
        envSkeleton: {
          activeKeyCount: 53,
          coversFailedProductionEnvGroups: true,
          exists: true,
          missingGroupMarkerIds: [],
          missingPublicDefaultKeys: [],
          publicDefaultsPresent: true,
          secretLikeValuesOmitted: true,
          unexpectedFilledValueKeys: [],
        },
        groupIdsMatchCurrentPreflight: true,
        outputFreshness: { status: "current" },
        skeletonUsableForCurrentPreflight: true,
        sourceFreshness: { status: "current" },
        status: "current",
        structuralIssues: [],
      },
    },
  };
  assert.match(buildMarkdown(statusWithGapChecklist), /Production env gap checklist/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Production env gap JSON/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Missing-key env skeleton/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env gap handoff status/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env gap source freshness/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env gap output freshness/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env gap failed-group coverage/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env skeleton usable for current preflight/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env skeleton active keys/);
  assert.match(buildMarkdown(statusWithGapChecklist), /Env skeleton secret-like values omitted/);
  console.log("release-launch-status self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const status = buildStatus(options);
  const jsonPath = path.join(options.outputDir, "launch-status.json");
  const markdownPath = path.join(options.outputDir, "launch-status.md");
  writeJsonArtifact(jsonPath, status);
  writeTextArtifact(markdownPath, buildMarkdown(status));
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(jsonPath),
        markdownArtifact: repoRelative(markdownPath),
        releaseReady: status.releaseReady,
        releaseReadyReason: status.releaseReadyReason,
        schema: status.schema,
        sanitized: status.sanitized,
      },
      null,
      2,
    ),
  );
}

main();
