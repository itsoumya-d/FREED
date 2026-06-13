#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const DEFAULT_PREFLIGHT_REPORT =
  "docs/validation/artifacts/release-env-current/release-env-preflight-report.json";
const DEFAULT_OUTPUT_DIR = "docs/validation/artifacts/release-env-current";
const DEFAULT_RUN_ID = "release-env-current";
const CHECKLIST_ARTIFACT_NAME = "PRODUCTION_ENV_GAP_CHECKLIST.md";
const ENV_SKELETON_ARTIFACT_NAME = "PRODUCTION_ENV_MISSING_KEYS.env";
const JSON_ARTIFACT_NAME = "production-env-gap-checklist.json";
const PUBLIC_LAUNCH_ENV_DEFAULTS = {
  entitlementId: "premium",
  bundleId: "app.freed.recovery",
  packageName: "app.freed.recovery",
  products: {
    yearly: "freed_premium_yearly",
    monthly: "freed_premium_monthly",
    lifetime: "freed_premium_lifetime",
  },
};
const LAUNCH_PLATFORM_ENV_SETUP = {
  id: "expo-eas-project-metadata",
  next:
    "Set EAS_PROJECT_ID or EXPO_PROJECT_ID from the linked Expo project, and optionally EXPO_OWNER, before EAS builds, submits, or legal web deploys.",
  requiredEnv: ["EAS_PROJECT_ID", "EXPO_PROJECT_ID", "EXPO_OWNER"],
  skeletonLines: [
    "# Expo/EAS project metadata for production builds, submits, and legal web deploys.",
    "# EAS_PROJECT_ID and EXPO_PROJECT_ID are accepted aliases; set one real project ID.",
    "EAS_PROJECT_ID=",
    "EXPO_PROJECT_ID=",
    "# Optional Expo account/organization owner.",
    "EXPO_OWNER=",
  ],
};

const GROUP_ENV_SKELETON_LINES = {
  "production-backend-infrastructure": [
    "# Backend/Supabase and Redis infrastructure.",
    "SUPABASE_URL=",
    "SUPABASE_SERVICE_ROLE_KEY=",
    "EXPO_PUBLIC_SUPABASE_URL=",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY=",
    "# Use one production maintenance secret. BACKEND_MAINTENANCE_SECRET is preferred.",
    "BACKEND_MAINTENANCE_SECRET=",
    "# CRON_SECRET=",
    "UPSTASH_REDIS_REST_URL=",
    "UPSTASH_REDIS_REST_TOKEN=",
    "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT=",
  ],
  "production-analytics-ingestion": [
    "# Aggregate-only analytics endpoint. Runtime upload still requires explicit user opt-in.",
    "EXPO_PUBLIC_ANALYTICS_ENDPOINT=",
  ],
  "production-notification-backend": [
    "# Server-authorized push dispatch credentials. Local reminders do not need these.",
    "REMOTE_NOTIFICATION_DISPATCH_SECRET=",
    "# FCM: use either server key, access token + project id, or service account JSON/base64.",
    "FCM_SERVER_KEY=",
    "FCM_ACCESS_TOKEN=",
    "FIREBASE_PROJECT_ID=",
    "FIREBASE_SERVICE_ACCOUNT_JSON=",
    "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=",
    "# APNs production signing credentials.",
    "APNS_KEY_ID=",
    "APNS_TEAM_ID=",
    "APNS_BUNDLE_ID=",
    "APNS_ENV=production",
    "APNS_PRIVATE_KEY=",
    "APNS_PRIVATE_KEY_BASE64=",
  ],
  "production-adult-domain-feed": [
    "# Reviewed adult-domain feed. Keep source URLs HTTPS and reviewed.",
    "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT=",
    "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true",
    "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS=",
  ],
  "production-monetization": [
    "# Launch monetization: Core 3 products only. Public catalog defaults are prefilled.",
    "EXPO_PUBLIC_MONETIZATION_MODE=native",
    "EXPO_PUBLIC_STORE_PROVIDER=native-iap",
    `EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID=${PUBLIC_LAUNCH_ENV_DEFAULTS.entitlementId}`,
    "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT=",
    `EXPO_PUBLIC_IAP_PRODUCT_YEARLY=${PUBLIC_LAUNCH_ENV_DEFAULTS.products.yearly}`,
    `EXPO_PUBLIC_IAP_PRODUCT_MONTHLY=${PUBLIC_LAUNCH_ENV_DEFAULTS.products.monthly}`,
    `EXPO_PUBLIC_IAP_PRODUCT_LIFETIME=${PUBLIC_LAUNCH_ENV_DEFAULTS.products.lifetime}`,
    "EXPO_PUBLIC_ADMOB_APP_ID_IOS=",
    "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID=",
    "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS=",
    "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID=",
    "EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false",
    `APP_STORE_BUNDLE_ID=${PUBLIC_LAUNCH_ENV_DEFAULTS.bundleId}`,
    "APP_STORE_SERVER_API_ENV=production",
    "APP_STORE_ISSUER_ID=",
    "APP_STORE_KEY_ID=",
    "APP_STORE_PRIVATE_KEY=",
    "APP_STORE_PRIVATE_KEY_BASE64=",
    "APP_STORE_SERVER_API_JWT=",
    `GOOGLE_PLAY_PACKAGE_NAME=${PUBLIC_LAUNCH_ENV_DEFAULTS.packageName}`,
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64=",
    "GOOGLE_PLAY_ACCESS_TOKEN=",
  ],
  "production-android-signing": [
    "# Android upload signing for Play Console APK/AAB artifacts.",
    "# Generate or load a secure non-debug upload keystore outside the repo.",
    "# Bootstrap helper: npm run setup:android-upload-keystore -- --generate-passwords",
    "FREED_ANDROID_UPLOAD_STORE_FILE=",
    "FREED_ANDROID_UPLOAD_STORE_PASSWORD=",
    "FREED_ANDROID_UPLOAD_KEY_ALIAS=",
    "FREED_ANDROID_UPLOAD_KEY_PASSWORD=",
    "FREED_REQUIRE_ANDROID_RELEASE_SIGNING=true",
  ],
  "production-ai-backend": [
    "# Remote AI endpoints and server-only provider credentials.",
    "EXPO_PUBLIC_AI_COACH_MODE=remote",
    "EXPO_PUBLIC_AI_COACH_ENDPOINT=",
    "EXPO_PUBLIC_AI_CHALLENGE_MODE=remote",
    "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT=",
    "# Use one provider family server-side.",
    "OPENAI_API_KEY=",
    "OPENAI_MODEL=",
    "GEMINI_API_KEY=",
    "GOOGLE_API_KEY=",
    "GOOGLE_GENAI_API_KEY=",
    "GEMINI_MODEL=",
  ],
};

function printHelp() {
  console.log(`Usage: npm run status:release-env-gaps -- [options]

Writes a sanitized production-env gap checklist from a sanitized
release-env preflight report. It never reads a production env file and never
writes secret values.

Options:
  --preflight-report <path>  Sanitized preflight JSON under docs/validation/artifacts.
                             Default: ${DEFAULT_PREFLIGHT_REPORT}
  --output-dir <path>        Artifact output folder.
                             Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>              Machine-readable run id. When --output-dir is
                             omitted, writes to docs/validation/artifacts/<id>.
                             Default: ${DEFAULT_RUN_ID}
  --self-test                Run offline parser and checklist checks.
`);
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    preflightReport: DEFAULT_PREFLIGHT_REPORT,
    runId: DEFAULT_RUN_ID,
  };
  let outputDirExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--preflight-report") {
      options.preflightReport = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirExplicit = true;
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirExplicit) {
    options.outputDir = `docs/validation/artifacts/${options.runId}`;
  }
  options.preflightReport = repoRelative(
    assertSafeReportPath(options.preflightReport, "--preflight-report"),
  );
  options.outputDir = assertSafeArtifactOutputDir(
    options.outputDir,
    "--output-dir",
  );
  return options;
}

function safeRunId(value) {
  const normalized = String(value || "").trim();
  if (
    !/^[A-Za-z0-9._:-]+$/.test(normalized) ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw new Error(
      "Run id may only contain letters, numbers, dots, dashes, underscores, and colons.",
    );
  }
  return normalized;
}

function repoRelative(filePath) {
  return path
    .relative(process.cwd(), path.resolve(filePath))
    .replace(/\\/g, "/");
}

function fileSha256Label(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")}`;
}

function unique(values) {
  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()),
    ),
  ];
}

function safeText(value) {
  return sanitizeLocalHomePaths(String(value || "").trim());
}

function normalizeFailedCheck(check) {
  return {
    detail: safeText(check.detail),
    id: safeText(check.id),
    next: safeText(check.next),
  };
}

function normalizeGroup(group) {
  return {
    captureHelperCommand: safeText(group.captureHelperCommand),
    category: safeText(group.category),
    evidenceFile: safeText(group.evidenceFile),
    failedPreflightChecks: Array.isArray(group.failedPreflightChecks)
      ? group.failedPreflightChecks
          .map(normalizeFailedCheck)
          .filter((check) => check.id)
      : [],
    id: safeText(group.id),
    next: safeText(group.next),
    requiredEnv: unique(
      Array.isArray(group.requiredEnv) ? group.requiredEnv.map(safeText) : [],
    ),
    requiredReports: unique(
      Array.isArray(group.requiredReports)
        ? group.requiredReports.map(safeText)
        : [],
    ),
    status: safeText(group.status),
  };
}

function readPreflightReport(preflightReport) {
  const absolutePath = path.join(process.cwd(), preflightReport);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing preflight report: ${preflightReport}`);
  }
  const report = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (report.schema !== "freed-release-env-preflight-report-v1") {
    throw new Error(
      "--preflight-report must be a freed-release-env-preflight-report-v1 JSON artifact.",
    );
  }
  if (report.sanitized !== true) {
    throw new Error(
      "--preflight-report must be sanitized before generating a launch handoff.",
    );
  }
  if (!Array.isArray(report.blockerGroups)) {
    throw new Error("--preflight-report must include blockerGroups.");
  }
  return report;
}

function statusCounts(groups) {
  return groups.reduce((counts, group) => {
    const status = group.status || "unknown";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function buildGapPlan(report, sourcePreflightReport) {
  const groups = report.blockerGroups
    .map(normalizeGroup)
    .filter((group) => group.id);
  const failedProductionEnvGroups = groups.filter(
    (group) => group.category === "production-env" && group.status === "fail",
  );
  const passedProductionEnvGroups = groups.filter(
    (group) => group.category === "production-env" && group.status === "pass",
  );
  const externalValidationGroups = groups.filter(
    (group) => group.status === "external",
  );
  const otherOpenGroups = groups.filter(
    (group) =>
      group.status !== "pass" &&
      group.status !== "external" &&
      group.category !== "production-env",
  );
  const openGroups = [
    ...failedProductionEnvGroups,
    ...externalValidationGroups,
    ...otherOpenGroups,
  ];
  const requiredReports = unique(
    openGroups.flatMap((group) => group.requiredReports),
  );
  const captureHelperCommands = unique(
    openGroups.map((group) => group.captureHelperCommand),
  );

  return {
    schema: "freed-production-env-gap-checklist-v1",
    sanitized: true,
    secretValuesOmitted: true,
    generatedAt: new Date().toISOString(),
    sourcePreflightReport,
    sourcePreflightReportSha256: fileSha256Label(sourcePreflightReport),
    source: safeText(report.source),
    preflight: {
      result: safeText(report.result),
      passCount: Number(report.passCount || 0),
      failCount: Number(report.failCount || 0),
      statusCounts: statusCounts(groups),
    },
    result:
      report.result === "pass" &&
      failedProductionEnvGroups.length === 0 &&
      externalValidationGroups.length === 0
        ? "pass"
        : "pending",
    failedProductionEnvGroups,
    passedProductionEnvGroupIds: passedProductionEnvGroups.map(
      (group) => group.id,
    ),
    externalValidationGroups,
    otherOpenGroups,
    launchPlatformEnvSetup: LAUNCH_PLATFORM_ENV_SETUP,
    requiredEnv: unique(
      [
        ...LAUNCH_PLATFORM_ENV_SETUP.requiredEnv,
        ...failedProductionEnvGroups.flatMap((group) => group.requiredEnv),
      ],
    ),
    requiredReports,
    captureHelperCommands,
    releaseBoundary:
      "This checklist is a configuration handoff only. It does not prove deployed services, physical-device behavior, sandbox purchases, or store approval.",
    secretBoundary:
      "Do not paste real secrets, purchase receipts, raw purchase tokens, App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, APNs/FCM credentials, maintenance secrets, or AI provider keys into docs/validation artifacts.",
  };
}

function formatCodeList(values) {
  if (values.length === 0) return ["- None"];
  return values.map((value) => `- \`${value}\``);
}

function formatGroup(group) {
  const lines = [
    `### ${group.id}`,
    "",
    `- Status: ${group.status}`,
    `- Category: ${group.category}`,
  ];

  if (group.next) lines.push(`- Next: ${group.next}`);
  if (group.evidenceFile)
    lines.push(`- Target evidence file: \`${group.evidenceFile}\``);
  if (group.captureHelperCommand)
    lines.push(`- Capture helper: \`${group.captureHelperCommand}\``);

  lines.push(
    "",
    "Required env names:",
    ...formatCodeList(group.requiredEnv),
    "",
    "Required report commands:",
    ...formatCodeList(group.requiredReports),
  );

  if (group.failedPreflightChecks.length > 0) {
    lines.push("", "Failed preflight checks:");
    for (const check of group.failedPreflightChecks) {
      lines.push(`- \`${check.id}\`: ${check.detail || "No detail provided."}`);
      if (check.next) lines.push(`  Next: ${check.next}`);
    }
  }

  return lines;
}

function renderMarkdown(plan) {
  const lines = [
    "# FREED Production Env Gap Checklist",
    "",
    `Generated: ${plan.generatedAt}`,
    `Source preflight report: \`${plan.sourcePreflightReport}\``,
    `Source preflight sha256: \`${plan.sourcePreflightReportSha256 || "not available"}\``,
    `Source env snapshot: \`${plan.source || "not recorded"}\``,
    `Checklist result: ${plan.result}`,
    "",
    plan.releaseBoundary,
    "",
    plan.secretBoundary,
    "",
    "## Current Snapshot",
    "",
    `- Preflight result: ${plan.preflight.result}`,
    `- Preflight checks: ${plan.preflight.passCount} pass, ${plan.preflight.failCount} fail`,
    `- Production env groups still failing: ${plan.failedProductionEnvGroups.length}`,
    `- External validation groups still pending: ${plan.externalValidationGroups.length}`,
    `- Production env groups already passing: ${plan.passedProductionEnvGroupIds.length > 0 ? plan.passedProductionEnvGroupIds.map((id) => `\`${id}\``).join(", ") : "none"}`,
    `- Missing-key env skeleton: \`${plan.envSkeletonArtifact || path.posix.join(path.posix.dirname(plan.sourcePreflightReport), ENV_SKELETON_ARTIFACT_NAME)}\``,
    "- Public launch defaults prefilled: entitlement `premium`, bundle/package `app.freed.recovery`, Core 3 product IDs `freed_premium_yearly`, `freed_premium_monthly`, `freed_premium_lifetime`",
    "- EAS project metadata keys included: `EAS_PROJECT_ID`, `EXPO_PROJECT_ID`, optional `EXPO_OWNER`",
    "- Apply public defaults to private env: `npm run setup:release-env-public-defaults -- --env-file <production-env-file> --write`",
    "",
    "## Configure First",
    "",
    `### ${plan.launchPlatformEnvSetup.id}`,
    "",
    "- Status: pending until the EAS project is linked and `npm run eas:deploy:legal-web` can read project metadata.",
    `- Next: ${plan.launchPlatformEnvSetup.next}`,
    "",
    "Required env names:",
    ...formatCodeList(plan.launchPlatformEnvSetup.requiredEnv),
    "",
    "Required report commands:",
    "- `npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json`",
    "",
  ];

  if (plan.failedProductionEnvGroups.length === 0) {
    lines.push(
      "- No failed production-env groups in the source preflight report.",
      "",
    );
  } else {
    for (const group of plan.failedProductionEnvGroups) {
      lines.push(...formatGroup(group), "");
    }
  }

  lines.push("## Evidence After Env", "");
  if (
    plan.externalValidationGroups.length === 0 &&
    plan.otherOpenGroups.length === 0
  ) {
    lines.push(
      "- No external validation groups are pending in the source preflight report.",
      "",
    );
  } else {
    for (const group of [
      ...plan.externalValidationGroups,
      ...plan.otherOpenGroups,
    ]) {
      lines.push(...formatGroup(group), "");
    }
  }

  lines.push(
    "## Rerun Commands",
    "",
    "After configuring the real production env file outside the repo, rerun these commands and keep only sanitized report paths:",
    "",
  );
  for (const report of plan.requiredReports) lines.push(`- \`${report}\``);
  if (plan.captureHelperCommands.length > 0) {
    lines.push(
      "",
      "Then capture the pending physical/deployed evidence packets:",
    );
    for (const command of plan.captureHelperCommands)
      lines.push(`- \`${command}\``);
  }

  lines.push(
    "",
    "Keep production submission disabled until `npm run audit:release:strict` and the launch dashboard both pass.",
    "",
  );
  return sanitizeLocalHomePaths(`${lines.join("\n")}\n`);
}

function dedupeEnvSkeletonLines(lines) {
  const seenKeys = new Set();
  const output = [];
  for (const rawLine of lines) {
    const line = String(rawLine || "").trimEnd();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (output[output.length - 1] !== line) output.push(line);
      continue;
    }
    const key = line.split("=", 1)[0].replace(/^#\s*/, "");
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    output.push(line);
  }
  return output;
}

function buildEnvSkeleton(plan, envSkeletonArtifact) {
  const lines = [
    "# FREED production env missing-key skeleton.",
    "# Generated from a sanitized preflight report; secret values are intentionally omitted.",
    "# Copy only the needed keys into your private production env file, fill real values there,",
    "# then rerun: npm run preflight:release-env -- --env-file <production-env-file>",
    "# Public launch defaults from the Core 3 catalog are prefilled; endpoints and secrets stay blank.",
    `# Source preflight report: ${plan.sourcePreflightReport}`,
    `# Source preflight sha256: ${plan.sourcePreflightReportSha256 || "not available"}`,
    `# Checklist result: ${plan.result}`,
    `# Companion checklist: ${plan.checklistArtifact || path.posix.join(path.posix.dirname(envSkeletonArtifact), CHECKLIST_ARTIFACT_NAME)}`,
    "",
    ...LAUNCH_PLATFORM_ENV_SETUP.skeletonLines,
    "",
  ];

  for (const group of plan.failedProductionEnvGroups) {
    const groupLines = GROUP_ENV_SKELETON_LINES[group.id];
    if (!groupLines) continue;
    lines.push("", `# ${group.id}`, ...groupLines);
  }

  if (plan.failedProductionEnvGroups.length === 0) {
    lines.push(
      "",
      "# No failed production-env groups were present in the source preflight report.",
    );
  }

  lines.push(
    "",
    "# Boundary: this artifact is not release evidence and should not contain real secrets.",
    "# Keep App Store keys, Play service accounts, Supabase service-role keys, Redis tokens,",
    "# APNs/FCM credentials, maintenance secrets, purchase tokens, and AI provider keys outside docs.",
    "",
  );
  return sanitizeLocalHomePaths(
    `${dedupeEnvSkeletonLines(lines).join("\n")}\n`,
  );
}

function writeArtifacts(plan, outputDir) {
  const markdownPath = path.join(outputDir, CHECKLIST_ARTIFACT_NAME);
  const envSkeletonPath = path.join(outputDir, ENV_SKELETON_ARTIFACT_NAME);
  const jsonPath = path.join(outputDir, JSON_ARTIFACT_NAME);
  const checklistArtifact = repoRelative(markdownPath);
  const envSkeletonArtifact = repoRelative(envSkeletonPath);
  const jsonArtifact = repoRelative(jsonPath);
  plan.checklistArtifact = checklistArtifact;
  plan.envSkeletonArtifact = envSkeletonArtifact;
  plan.jsonArtifact = jsonArtifact;
  const markdown = renderMarkdown(plan);
  const envSkeleton = buildEnvSkeleton(plan, envSkeletonArtifact);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(envSkeletonPath, envSkeleton);
  plan.checklistSha256 = fileSha256Label(checklistArtifact);
  plan.envSkeletonSha256 = fileSha256Label(envSkeletonArtifact);
  fs.writeFileSync(
    jsonPath,
    `${sanitizeLocalHomePaths(JSON.stringify(plan, null, 2))}\n`,
  );
  return {
    checklistArtifact,
    envSkeletonArtifact,
    jsonArtifact,
  };
}

function runSelfTest() {
  const sample = {
    blockerGroups: [
      {
        category: "production-env",
        failedPreflightChecks: [
          {
            detail:
              "Launch Core 3 product identifiers are checked for non-placeholder values.",
            id: "iap-product-ids",
            next: "Configure EXPO_PUBLIC_IAP_PRODUCT_YEARLY, EXPO_PUBLIC_IAP_PRODUCT_MONTHLY, and EXPO_PUBLIC_IAP_PRODUCT_LIFETIME.",
          },
        ],
        id: "production-monetization",
        next: "Configure native IAP and purchase verification.",
        requiredEnv: [
          "EXPO_PUBLIC_IAP_PRODUCT_YEARLY",
          "EXPO_PUBLIC_IAP_PRODUCT_MONTHLY",
        ],
        requiredReports: [
          "npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/self-test/purchase-verification-smoke-report.json",
        ],
        status: "fail",
      },
      {
        captureHelperCommand:
          "npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof",
        category: "physical-evidence",
        evidenceFile: "docs/validation/evidence/android-real-browser.json",
        id: "android-real-browser-validation",
        requiredEnv: [],
        requiredReports: [],
        status: "external",
      },
      {
        category: "production-env",
        id: "production-android-signing",
        requiredEnv: [
          "FREED_ANDROID_UPLOAD_STORE_FILE",
          "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
          "FREED_ANDROID_UPLOAD_KEY_ALIAS",
          "FREED_ANDROID_UPLOAD_KEY_PASSWORD",
        ],
        requiredReports: [],
        status: "fail",
      },
    ],
    failCount: 2,
    passCount: 3,
    result: "fail",
    sanitized: true,
    schema: "freed-release-env-preflight-report-v1",
    source: "/Users/tester/.freed/prod.env",
  };

  const plan = buildGapPlan(
    sample,
    "docs/validation/artifacts/self-test/release-env-preflight-report.json",
  );
  assert.equal(plan.schema, "freed-production-env-gap-checklist-v1");
  assert.equal(plan.secretValuesOmitted, true);
  assert.equal(plan.sourcePreflightReportSha256, "");
  assert.deepEqual(plan.launchPlatformEnvSetup.requiredEnv, [
    "EAS_PROJECT_ID",
    "EXPO_PROJECT_ID",
    "EXPO_OWNER",
  ]);
  assert.ok(plan.requiredEnv.includes("EAS_PROJECT_ID"));
  assert.ok(plan.requiredEnv.includes("EXPO_PROJECT_ID"));
  assert.ok(plan.requiredEnv.includes("EXPO_OWNER"));
  assert.equal(plan.failedProductionEnvGroups.length, 2);
  assert.deepEqual(plan.passedProductionEnvGroupIds, []);
  assert.match(renderMarkdown(plan), /FREED Production Env Gap Checklist/);
  assert.match(renderMarkdown(plan), /expo-eas-project-metadata/);
  assert.match(renderMarkdown(plan), /EAS_PROJECT_ID/);
  assert.match(renderMarkdown(plan), /EXPO_PUBLIC_IAP_PRODUCT_YEARLY/);
  assert.match(renderMarkdown(plan), /setup:release-env-public-defaults/);
  assert.match(renderMarkdown(plan), /android-real-browser-validation/);
  assert.doesNotMatch(renderMarkdown(plan), /\/Users\/tester/);
  const envSkeleton = buildEnvSkeleton(
    plan,
    "docs/validation/artifacts/self-test/PRODUCTION_ENV_MISSING_KEYS.env",
  );
  assert.match(envSkeleton, /EAS_PROJECT_ID=/);
  assert.match(envSkeleton, /EXPO_PROJECT_ID=/);
  assert.match(envSkeleton, /EXPO_OWNER=/);
  assert.doesNotMatch(envSkeleton, /EAS_PROJECT_ID=.+/);
  assert.doesNotMatch(envSkeleton, /EXPO_PROJECT_ID=.+/);
  assert.doesNotMatch(envSkeleton, /EXPO_OWNER=.+/);
  assert.match(envSkeleton, /EXPO_PUBLIC_IAP_PRODUCT_YEARLY=/);
  assert.match(envSkeleton, /EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID=premium/);
  assert.match(
    envSkeleton,
    /EXPO_PUBLIC_IAP_PRODUCT_YEARLY=freed_premium_yearly/,
  );
  assert.match(
    envSkeleton,
    /EXPO_PUBLIC_IAP_PRODUCT_MONTHLY=freed_premium_monthly/,
  );
  assert.match(
    envSkeleton,
    /EXPO_PUBLIC_IAP_PRODUCT_LIFETIME=freed_premium_lifetime/,
  );
  assert.match(envSkeleton, /APP_STORE_BUNDLE_ID=app\.freed\.recovery/);
  assert.match(envSkeleton, /GOOGLE_PLAY_PACKAGE_NAME=app\.freed\.recovery/);
  assert.match(envSkeleton, /EXPO_PUBLIC_MONETIZATION_MODE=native/);
  assert.match(envSkeleton, /# production-android-signing/);
  assert.match(envSkeleton, /FREED_ANDROID_UPLOAD_STORE_FILE=/);
  assert.match(envSkeleton, /FREED_ANDROID_UPLOAD_STORE_PASSWORD=/);
  assert.match(envSkeleton, /FREED_ANDROID_UPLOAD_KEY_ALIAS=/);
  assert.match(envSkeleton, /FREED_ANDROID_UPLOAD_KEY_PASSWORD=/);
  assert.match(envSkeleton, /FREED_REQUIRE_ANDROID_RELEASE_SIGNING=true/);
  assert.doesNotMatch(envSkeleton, /\/Users\/tester/);
  assert.doesNotMatch(envSkeleton, /test-key/);
  assert.throws(
    () =>
      parseArgs(["--preflight-report", "docs/validation/evidence/report.json"]),
    /docs\/validation\/evidence/,
  );
  assert.throws(
    () => parseArgs(["--output-dir", "docs/validation/evidence"]),
    /docs\/validation\/evidence/,
  );
  console.log("release-env-gap-plan self-test: pass");
}

function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const options = parseArgs(rawArgs);
  const report = readPreflightReport(options.preflightReport);
  const plan = buildGapPlan(report, options.preflightReport);
  plan.runId = options.runId;
  const artifacts = writeArtifacts(plan, options.outputDir);
  console.log(
    JSON.stringify(
      {
        ...artifacts,
        result: plan.result,
        failedProductionEnvGroups: plan.failedProductionEnvGroups.length,
        externalValidationGroups: plan.externalValidationGroups.length,
        schema: plan.schema,
        sanitized: plan.sanitized,
        secretValuesOmitted: plan.secretValuesOmitted,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  buildGapPlan,
  renderMarkdown,
};
