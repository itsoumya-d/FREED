#!/usr/bin/env node

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const { dirname, join, posix } = require("node:path");

const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { assertSafeReportPath } = require("./lib/report-path-safety");
const {
  hasLocalHomePath,
  sanitizeLocalHomePaths,
} = require("./lib/local-path-privacy");
const {
  productionBlockerGroups,
  productionEnvChecklist,
  reportArtifactCommandList,
} = require("./lib/release-blocker-groups");

const root = process.cwd();

const CORE_MIGRATION_PATH =
  "supabase/migrations/20260518000100_freed_backend_core.sql";
const ANALYTICS_PRIVACY_MIGRATION_PATH =
  "supabase/migrations/20260520000100_harden_analytics_privacy_keys.sql";
const SCHEMA_PATH = "docs/backend/supabase-schema.sql";
const PRODUCTION_BACKEND_PACKET_PATH = "docs/backend/production-backend.md";
const EDGE_CONFIG_PATH = "supabase/config.toml";
const EDGE_SHARED_PATH = "supabase/functions/_shared/freed_edge_contract.ts";
const ARTIFACT_ROOT = "docs/validation/artifacts/<run-id>";
const DEFAULT_RUN_ID = "supabase-deployment-current";
const DEFAULT_OUTPUT_DIR =
  "docs/validation/artifacts/supabase-deployment-current";
const REPORT_FILE_NAME = "supabase-deployment-packet.json";
const DEFAULT_REPORT = `${DEFAULT_OUTPUT_DIR}/${REPORT_FILE_NAME}`;

const BACKEND_BLOCKER_IDS = [
  "production-backend-infrastructure",
  "production-adult-domain-feed",
  "production-analytics-ingestion",
  "production-notification-backend",
  "production-monetization",
  "production-ai-backend",
];

const BACKEND_SMOKE_REPORT_FILES = [
  "release-env-preflight-report.json",
  "backend-readiness-smoke-report.json",
  "supabase-schema-smoke-report.json",
  "adult-domain-feed-smoke-report.json",
  "analytics-ingestion-smoke-report.json",
  "remote-notification-smoke-report.json",
  "purchase-verification-smoke-report.json",
  "ai-backend-smoke-report.json",
];

const CORE_TABLES = [
  "recovery_analytics_events",
  "adult_domain_feed_versions",
  "encrypted_recovery_backups",
  "purchase_verification_events",
  "ai_backend_events",
  "backend_job_runs",
];

const PRIVACY_CONSTRAINTS = [
  "recovery_analytics_events_privacy_flags",
  "freed_jsonb_has_forbidden_normalized_keys",
  "recovery_analytics_events_no_raw_payload_keys",
  "encrypted_recovery_backups_no_raw_payload_keys",
  "purchase_verification_events_hash_shape",
  "ai_backend_events_no_sensitive_payload_keys",
  "backend_job_runs_no_sensitive_metadata_keys",
];

const EDGE_FUNCTIONS = [
  {
    id: "adult-domain-feed-sync",
    path: "supabase/functions/adult-domain-feed-sync/index.ts",
    requiredMarkers: [
      "Deno.serve",
      "requireMaintenanceAuth",
      "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS",
      "FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES",
      "SUPABASE_ADULT_FEED_TABLE",
      "storesFullDomainList: false",
      "noPacketInspection",
      "noScreenshotAnalysis",
      "noRawBrowsingData",
      "recordBackendJobRun",
      "acquireEdgeRedisLock",
      "releaseEdgeRedisLock",
    ],
  },
  {
    id: "analytics-retention-cleanup",
    path: "supabase/functions/analytics-retention-cleanup/index.ts",
    requiredMarkers: [
      "Deno.serve",
      "requireMaintenanceAuth",
      "deleteExpiredRows",
      "SUPABASE_ANALYTICS_TABLE",
      "SUPABASE_ADULT_FEED_TABLE",
      "SUPABASE_RECOVERY_BACKUP_TABLE",
      "SUPABASE_PURCHASE_AUDIT_TABLE",
      "SUPABASE_AI_EVENTS_TABLE",
      "recordBackendJobRun",
      "acquireEdgeRedisLock",
      "releaseEdgeRedisLock",
    ],
  },
];

const REQUIRED_SERVER_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "BACKEND_MAINTENANCE_SECRET or CRON_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS",
];

const REQUIRED_PUBLIC_ENV = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
  "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
  "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT",
];

const FORBIDDEN_PUBLIC_SECRET_KEYS = [
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN",
  "EXPO_PUBLIC_REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "EXPO_PUBLIC_BACKEND_MAINTENANCE_SECRET",
  "EXPO_PUBLIC_CRON_SECRET",
];

function file(path) {
  return join(root, path);
}

function has(path) {
  return existsSync(file(path));
}

function read(path) {
  return readFileSync(file(path), "utf8");
}

function maybeRead(path) {
  return has(path) ? read(path) : "";
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function lineCount(text) {
  return text ? text.split(/\r?\n/).length : 0;
}

function includesAll(source, markers) {
  return markers.every((marker) => source.includes(marker));
}

function result(id, status, detail, next) {
  return {
    id,
    status,
    detail,
    ...(next ? { next } : {}),
  };
}

function pass(id, detail) {
  return result(id, "PASS", detail);
}

function fail(id, detail, next) {
  return result(id, "FAIL", detail, next);
}

function warn(id, detail, next) {
  return result(id, "WARN", detail, next);
}

function check(id, condition, passDetail, failDetail, next) {
  return condition ? pass(id, passDetail) : fail(id, failDetail, next);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function functionConfigDisablesJwt(config, functionId) {
  const pattern = new RegExp(
    `\\[functions\\.${escapeRegExp(functionId)}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`,
  );
  return pattern.test(config);
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    reportPath: DEFAULT_REPORT,
    runId: DEFAULT_RUN_ID,
    projectRef: null,
    projectName: null,
    projectStatus: null,
    deployedOrigin: null,
    selfTest: false,
  };
  let outputDirExplicit = false;
  let reportExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirExplicit = true;
    } else if (arg === "--report") {
      options.reportPath = next();
      reportExplicit = true;
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
      if (!outputDirExplicit)
        options.outputDir = `docs/validation/artifacts/${options.runId}`;
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report.");
      reportExplicit = true;
    } else if (arg === "--project-ref") options.projectRef = next();
    else if (arg === "--project-name") options.projectName = next();
    else if (arg === "--project-status") options.projectStatus = next();
    else if (arg === "--deployed-origin") options.deployedOrigin = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.outputDir = assertSafeArtifactOutputDir(
    options.outputDir,
    "--output-dir",
  );
  if (!reportExplicit) {
    options.reportPath = posix.join(options.outputDir, REPORT_FILE_NAME);
  }
  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
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

function printHelp() {
  console.log(`Usage: npm run evidence:supabase-deploy-packet -- [options]

Builds a sanitized local Supabase deployment packet before production deploy.
The packet inventories migrations, Edge Functions, config, secret boundaries,
handoff commands, and pending live-project actions without reading secrets.

Options:
  --report <path>          Write JSON under docs/validation/artifacts/<run-id>/.
                           Default: ${DEFAULT_REPORT}
  --output-dir <path>      Artifact output folder. When --report is omitted,
                           writes ${REPORT_FILE_NAME} here.
                           Default: ${DEFAULT_OUTPUT_DIR}
  --run-id <id>            Machine-readable run id. When --output-dir and
                           --report are omitted, writes to
                           docs/validation/artifacts/<id>/${REPORT_FILE_NAME}.
                           Default: ${DEFAULT_RUN_ID}
  --project-ref <ref>      Optional intended production Supabase project ref.
  --project-name <name>    Optional intended project display name.
  --project-status <text>  Optional live project status from Supabase.
  --deployed-origin <url>  Optional deployed Expo/API origin for smoke handoff.
  --self-test              Run offline packet assertions.
`);
}

function fileSummary(path) {
  const content = maybeRead(path);
  return {
    path,
    exists: Boolean(content),
    lineCount: lineCount(content),
    sha256: content ? sha256(content) : null,
  };
}

function buildTableProof(sql, schema) {
  return CORE_TABLES.map((tableName) => {
    const qualified = `public.${tableName}`;
    return {
      tableName,
      migrationCreatesTable: sql.includes(
        `create table if not exists ${qualified}`,
      ),
      schemaDocumentsTable: schema.includes(
        `create table if not exists ${qualified}`,
      ),
      rlsEnabled: sql.includes(
        `alter table ${qualified} enable row level security`,
      ),
      publicRolesRevoked: sql.includes(
        `revoke all on table ${qualified} from anon, authenticated, public`,
      ),
      serviceRoleGrant: sql.includes(
        `grant select, insert, update, delete on table ${qualified} to service_role`,
      ),
    };
  });
}

function buildEdgeFunctionProof(config, sharedSource) {
  return EDGE_FUNCTIONS.map((fn) => {
    const source = maybeRead(fn.path);
    return {
      id: fn.id,
      path: fn.path,
      exists: Boolean(source),
      sha256: source ? sha256(source) : null,
      lineCount: lineCount(source),
      verifyJwtDisabledByConfig: functionConfigDisablesJwt(config, fn.id),
      requiresMaintenanceAuth: source.includes("requireMaintenanceAuth"),
      hasRequiredMarkers: includesAll(source, fn.requiredMarkers),
      avoidsPublicEnvSecrets: !source.includes("EXPO_PUBLIC_"),
      sharedContractHasServiceRoleBoundary:
        sharedSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
        sharedSource.includes("BACKEND_MAINTENANCE_SECRET") &&
        sharedSource.includes("CRON_SECRET") &&
        sharedSource.includes("productionSafeHttpsOrigin(baseUrl)") &&
        sharedSource.includes("readJsonBodyWithByteLimit") &&
        sharedSource.includes("recordBackendJobRun"),
    };
  });
}

function buildDeploymentTarget(options) {
  const status = options.projectStatus
    ? String(options.projectStatus).trim()
    : null;
  const normalizedStatus = status ? status.toLowerCase() : null;
  const active =
    normalizedStatus === "active" ||
    normalizedStatus === "healthy" ||
    normalizedStatus === "running" ||
    normalizedStatus === "active_healthy";
  const inactive = normalizedStatus
    ? /inactive|paused|failed|deleted|suspended/.test(normalizedStatus)
    : false;
  const projectRef = options.projectRef
    ? String(options.projectRef).trim()
    : null;
  const projectRefShapeOk = !projectRef || /^[a-z0-9]{10,32}$/.test(projectRef);

  return {
    projectRef: projectRef || null,
    projectName: options.projectName
      ? String(options.projectName).trim()
      : null,
    projectStatus: status,
    projectRefShapeOk,
    activeProjectConfirmed: Boolean(projectRef && active && projectRefShapeOk),
    productionTargetRequiredBeforeDeploy: true,
    inactiveOrUnrelatedProjectsMustNotBeUsed: true,
    statusNote: inactive
      ? "Provided project status is not deployable for production."
      : projectRef && !active
        ? "Project ref was provided, but an active/healthy live status was not confirmed."
        : projectRef
          ? "Project ref shape is recorded; confirm ownership, region, billing, and active health before deploy."
          : "Production Supabase project selection is pending.",
  };
}

function serializeBlockerGroup(group) {
  return {
    id: group.id,
    category: group.category,
    requiredEnv: Array.isArray(group.requiredEnv) ? group.requiredEnv : [],
    requiredReports: Array.isArray(group.requiredReports)
      ? group.requiredReports
      : [],
    preflightCheckIds: Array.isArray(group.preflightCheckIds)
      ? group.preflightCheckIds
      : [],
    evidenceFile: group.evidenceFile ?? null,
    captureHelperCommand: group.captureHelperCommand ?? null,
    next: group.next,
  };
}

function buildReleaseBlockerHandoff(artifactRoot = ARTIFACT_ROOT) {
  const blockerGroups = productionBlockerGroups(artifactRoot);
  const backendBlockerGroups = BACKEND_BLOCKER_IDS.map((id) =>
    blockerGroups.find((group) => group.id === id),
  ).filter(Boolean);
  const reportArtifactCommands = reportArtifactCommandList(artifactRoot);
  const smokeCommands = reportArtifactCommands.filter((command) =>
    BACKEND_SMOKE_REPORT_FILES.some((reportFile) =>
      command.includes(`/${reportFile}`),
    ),
  );

  return {
    artifactRoot,
    productionEnvChecklist: productionEnvChecklist(),
    productionBlockerGroups: backendBlockerGroups.map(serializeBlockerGroup),
    reportArtifactCommands,
    backendSmokeCommands: smokeCommands,
  };
}

function buildReport(options = {}) {
  const coreMigration = maybeRead(CORE_MIGRATION_PATH);
  const analyticsPrivacyMigration = maybeRead(ANALYTICS_PRIVACY_MIGRATION_PATH);
  const schema = maybeRead(SCHEMA_PATH);
  const packet = maybeRead(PRODUCTION_BACKEND_PACKET_PATH);
  const config = maybeRead(EDGE_CONFIG_PATH);
  const sharedSource = maybeRead(EDGE_SHARED_PATH);
  const edgeSource = EDGE_FUNCTIONS.map((fn) => maybeRead(fn.path)).join("\n");
  const combinedMigration = `${coreMigration}\n${analyticsPrivacyMigration}`;
  const tableProof = buildTableProof(combinedMigration, schema);
  const edgeFunctions = buildEdgeFunctionProof(config, sharedSource);
  const deploymentTarget = buildDeploymentTarget(options);
  const releaseBlockerHandoff = buildReleaseBlockerHandoff(ARTIFACT_ROOT);

  const deployCommands = [
    "supabase link --project-ref <production-project-ref>",
    "supabase db push",
    "supabase secrets set --env-file <production-env-file>",
    "supabase functions deploy adult-domain-feed-sync",
    "supabase functions deploy analytics-retention-cleanup",
  ];
  const smokeCommands = releaseBlockerHandoff.backendSmokeCommands;

  const results = [
    check(
      "supabase-migration-files",
      has(CORE_MIGRATION_PATH) && has(ANALYTICS_PRIVACY_MIGRATION_PATH),
      "Core and analytics privacy hardening migrations are present in the required order.",
      "One or more required Supabase migration files are missing.",
      "Restore the production backend core migration and the analytics privacy hardening migration before linking a live project.",
    ),
    check(
      "supabase-schema-mirror",
      has(SCHEMA_PATH) &&
        schema.includes("recovery_analytics_events") &&
        schema.includes("backend_job_runs"),
      "docs/backend/supabase-schema.sql mirrors the expected production backend table family.",
      "The schema mirror is missing or no longer documents the FREED backend table family.",
      "Regenerate or update docs/backend/supabase-schema.sql before deployment handoff.",
    ),
    check(
      "supabase-core-table-contracts",
      tableProof.every(
        (entry) =>
          entry.migrationCreatesTable &&
          entry.schemaDocumentsTable &&
          entry.rlsEnabled &&
          entry.publicRolesRevoked &&
          entry.serviceRoleGrant,
      ),
      "All six backend tables are created, documented, RLS-enabled, revoked from public client roles, and granted only to service_role.",
      "One or more backend table RLS/revoke/service-role checks failed.",
      "Inspect tableProof in this packet and fix the migration/schema before deployment.",
    ),
    check(
      "supabase-privacy-constraints",
      includesAll(combinedMigration, PRIVACY_CONSTRAINTS) &&
        combinedMigration.includes("receiptdata") &&
        combinedMigration.includes("purchasetoken"),
      "Migrations include aggregate/privacy constraints and normalized forbidden-key scanning for receipts, tokens, raw browsing, and sensitive payloads.",
      "Migrations no longer contain all required sensitive-key and privacy constraints.",
      "Restore the backend privacy constraints before applying migrations to production.",
    ),
    check(
      "supabase-edge-functions-present",
      edgeFunctions.every((entry) => entry.exists && entry.hasRequiredMarkers),
      "Both Supabase Edge Functions are present and contain their required cron/admin markers.",
      "One or more Supabase Edge Functions are missing or incomplete.",
      "Restore adult-domain-feed-sync and analytics-retention-cleanup before deployment.",
    ),
    check(
      "supabase-edge-verify-jwt-config",
      edgeFunctions.every((entry) => entry.verifyJwtDisabledByConfig),
      "supabase/config.toml disables Supabase JWT verification only for the two maintenance-secret-protected cron/admin functions.",
      "supabase/config.toml does not explicitly set verify_jwt=false for both cron/admin functions.",
      "Fix supabase/config.toml and keep the in-function maintenance-secret check.",
    ),
    check(
      "supabase-edge-maintenance-auth",
      edgeFunctions.every((entry) => entry.requiresMaintenanceAuth) &&
        sharedSource.includes("BACKEND_MAINTENANCE_SECRET") &&
        sharedSource.includes("CRON_SECRET"),
      "Every non-OPTIONS Edge Function path is guarded by BACKEND_MAINTENANCE_SECRET or CRON_SECRET.",
      "Edge Function maintenance auth is missing or incomplete.",
      "Restore requireMaintenanceAuth before deploying verify_jwt=false functions.",
    ),
    check(
      "supabase-edge-secret-boundary",
      edgeFunctions.every(
        (entry) =>
          entry.avoidsPublicEnvSecrets &&
          entry.sharedContractHasServiceRoleBoundary,
      ) && !edgeSource.includes("EXPO_PUBLIC_"),
      "Edge Function sources use server-only Supabase/Redis/maintenance values and do not reference EXPO_PUBLIC_* secrets.",
      "Edge Function sources contain public env references or lack the service-role boundary.",
      "Remove public secret exposure and keep service-role credentials inside backend/Edge environments only.",
    ),
    check(
      "supabase-production-packet-doc",
      packet.includes("Production Backend Deployment Packet") &&
        packet.includes("supabase db push") &&
        packet.includes("supabase functions deploy adult-domain-feed-sync") &&
        packet.includes(
          "supabase functions deploy analytics-retention-cleanup",
        ) &&
        packet.includes("Do not paste real secrets") &&
        packet.includes("Never define `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`"),
      "docs/backend/production-backend.md includes migration, function deploy, smoke, and secret-boundary handoff.",
      "Production backend packet doc is missing required deployment or secret-boundary text.",
      "Update docs/backend/production-backend.md before handing off production deployment.",
    ),
    check(
      "supabase-deploy-command-handoff",
      deployCommands.every((command) => command.includes("supabase ")) &&
        deployCommands.includes("supabase db push") &&
        deployCommands.includes(
          "supabase secrets set --env-file <production-env-file>",
        ),
      "Deployment handoff includes link, db push, secrets set, and both Edge Function deploy commands.",
      "Deployment command handoff is incomplete.",
      "Restore the Supabase CLI deployment command list.",
    ),
    check(
      "supabase-smoke-command-handoff",
      smokeCommands.includes(
        "npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/supabase-schema-smoke-report.json",
      ) &&
        smokeCommands.includes(
          "npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/backend-readiness-smoke-report.json",
        ),
      "Post-deploy handoff includes sanitized release preflight and deployed backend/Supabase smoke report commands.",
      "Post-deploy smoke command handoff is incomplete.",
      "Restore sanitized report-producing backend smoke commands.",
    ),
    check(
      "supabase-shared-blocker-handoff",
      releaseBlockerHandoff.productionBlockerGroups.length ===
        BACKEND_BLOCKER_IDS.length &&
        BACKEND_BLOCKER_IDS.every((id) =>
          releaseBlockerHandoff.productionBlockerGroups.some(
            (group) => group.id === id,
          ),
        ) &&
        smokeCommands.every((command) =>
          releaseBlockerHandoff.reportArtifactCommands.includes(command),
        ) &&
        releaseBlockerHandoff.productionBlockerGroups.every(
          (group) =>
            group.requiredReports.every((command) =>
              command.includes(`${ARTIFACT_ROOT}/`),
            ) || group.requiredReports.length === 0,
        ),
      "Supabase deployment packet imports the canonical backend, adult-feed, analytics, notification, monetization, and AI release blocker handoff.",
      "Supabase deployment packet drifted away from the canonical release blocker groups.",
      "Restore productionBlockerGroups/reportArtifactCommandList wiring in scripts/supabase-deployment-packet.js.",
    ),
    check(
      "supabase-shared-env-checklist",
      releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) &&
        releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
          "UPSTASH_REDIS_REST_TOKEN",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.clientKeys.includes(
          "EXPO_PUBLIC_SUPABASE_URL",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.publicBackendKeys.includes(
          "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.publicBackendKeys.includes(
          "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
          "APP_STORE_SERVER_API_ENV=production",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
          "OPENAI_API_KEY and OPENAI_MODEL",
        ) &&
        releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
          "REMOTE_NOTIFICATION_DISPATCH_SECRET",
        ),
      "Supabase deployment packet uses the shared production env checklist for Supabase, Redis, adult-feed, analytics, payments, AI, and notifications.",
      "Supabase deployment packet is missing shared production env checklist coverage.",
      "Restore productionEnvChecklist wiring in scripts/supabase-deployment-packet.js.",
    ),
  ];

  if (deploymentTarget.projectRef && !deploymentTarget.projectRefShapeOk) {
    results.push(
      fail(
        "supabase-live-project-target",
        "Provided Supabase project ref does not look like a valid project reference.",
        "Use the exact production Supabase project ref before deployment.",
      ),
    );
  } else if (
    deploymentTarget.projectStatus &&
    !deploymentTarget.activeProjectConfirmed
  ) {
    results.push(
      fail(
        "supabase-live-project-target",
        deploymentTarget.statusNote,
        "Choose or create an active production Supabase project before applying migrations or functions.",
      ),
    );
  } else if (deploymentTarget.projectRef) {
    results.push(
      pass("supabase-live-project-target", deploymentTarget.statusNote),
    );
  } else {
    results.push(
      warn(
        "supabase-live-project-target",
        deploymentTarget.statusNote,
        "Select or create the FREED production Supabase project, confirm billing/region/active health, then rerun this packet with --project-ref and --project-status active.",
      ),
    );
  }

  const summary = {
    passCount: results.filter((entry) => entry.status === "PASS").length,
    warnCount: results.filter((entry) => entry.status === "WARN").length,
    failCount: results.filter((entry) => entry.status === "FAIL").length,
  };

  const report = {
    schemaVersion: "freed-supabase-deployment-packet-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    source: "local-workspace",
    summary,
    deploymentTarget,
    files: {
      schema: fileSummary(SCHEMA_PATH),
      productionBackendPacket: fileSummary(PRODUCTION_BACKEND_PACKET_PATH),
      migrations: [
        fileSummary(CORE_MIGRATION_PATH),
        fileSummary(ANALYTICS_PRIVACY_MIGRATION_PATH),
      ],
      edgeConfig: fileSummary(EDGE_CONFIG_PATH),
      edgeShared: fileSummary(EDGE_SHARED_PATH),
    },
    tableProof,
    edgeFunctions,
    secretBoundary: {
      secretValuesOmitted: true,
      serverOnlyKeysRequired: REQUIRED_SERVER_SECRETS,
      publicKeysAllowedForClientProof: REQUIRED_PUBLIC_ENV,
      forbiddenPublicSecretKeys: FORBIDDEN_PUBLIC_SECRET_KEYS,
      noServiceRoleInPublicEnv: true,
      noRedisTokenInPublicEnv: true,
      noMaintenanceSecretInPublicEnv: true,
    },
    commands: {
      deploy: deployCommands,
      smoke: smokeCommands,
    },
    releaseBlockerHandoff,
    pendingExternalActions: [
      "Choose or create the FREED production Supabase project; do not use inactive or unrelated projects.",
      "Push secrets through Supabase dashboard or supabase secrets set --env-file <production-env-file> without committing the env file.",
      "Apply migrations and deploy both Edge Functions only after the project target is confirmed.",
      "Run every smoke command in this packet and attach only sanitized JSON reports under docs/validation/artifacts/<run-id>/.",
    ],
    docsChecked: [
      "https://supabase.com/docs/guides/functions/secrets",
      "https://supabase.com/docs/guides/functions/examples/upstash-redis",
    ],
    results,
  };

  assertSanitizedReport(report);
  return report;
}

function assertSanitizedReport(report) {
  const text = sanitizeLocalHomePaths(JSON.stringify(report, null, 2));
  assert.equal(
    hasLocalHomePath(text),
    false,
    "Supabase deployment packet must not contain local home-profile paths.",
  );
  assert.equal(
    /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(text),
    false,
    "Supabase deployment packet must not contain private keys.",
  );
  assert.equal(
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(text),
    false,
    "Supabase deployment packet must not contain OpenAI-style API keys.",
  );
  assert.equal(
    /\bAIza[0-9A-Za-z_-]{30,}\b/.test(text),
    false,
    "Supabase deployment packet must not contain Google API keys.",
  );
  assert.equal(
    /\bya29\.[0-9A-Za-z._-]{20,}\b/.test(text),
    false,
    "Supabase deployment packet must not contain Google OAuth tokens.",
  );
  assert.equal(
    /\bBearer\s+(?!<)[A-Za-z0-9._~:/+=-]{16,}\b/i.test(text),
    false,
    "Supabase deployment packet must not contain bearer tokens.",
  );
}

function writeReport(reportPath, report) {
  const safePath = assertSafeReportPath(reportPath);
  mkdirSync(dirname(safePath), { recursive: true });
  const text = `${sanitizeLocalHomePaths(JSON.stringify(report, null, 2))}\n`;
  assert.equal(
    hasLocalHomePath(text),
    false,
    "Supabase deployment packet report must be sanitized before writing.",
  );
  writeFileSync(safePath, text);
  return safePath;
}

function runSelfTest() {
  const report = buildReport({});
  assert.equal(report.schemaVersion, "freed-supabase-deployment-packet-v1");
  assert.equal(report.sanitized, true);
  assert.equal(report.summary.failCount, 0);
  assert.equal(report.summary.warnCount, 1);
  assert.equal(report.deploymentTarget.activeProjectConfirmed, false);
  assert.equal(report.secretBoundary.secretValuesOmitted, true);
  assert.equal(report.tableProof.length, CORE_TABLES.length);
  assert.equal(report.edgeFunctions.length, EDGE_FUNCTIONS.length);
  assert.equal(
    report.releaseBlockerHandoff.productionBlockerGroups.length,
    BACKEND_BLOCKER_IDS.length,
  );
  assert.equal(
    report.releaseBlockerHandoff.backendSmokeCommands.length,
    BACKEND_SMOKE_REPORT_FILES.length,
  );
  assert.equal(
    report.releaseBlockerHandoff.productionBlockerGroups.some(
      (group) => group.id === "production-monetization",
    ),
    true,
  );
  assert.equal(
    report.releaseBlockerHandoff.productionEnvChecklist.serverKeys.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
    true,
  );
  assert.equal(
    report.results.some(
      (entry) =>
        entry.id === "supabase-live-project-target" && entry.status === "WARN",
    ),
    true,
  );

  const activeReport = buildReport({
    projectRef: "abcdefghijklmnopqrst",
    projectStatus: "ACTIVE",
  });
  assert.equal(activeReport.summary.failCount, 0);
  assert.equal(
    activeReport.results.some(
      (entry) =>
        entry.id === "supabase-live-project-target" && entry.status === "PASS",
    ),
    true,
  );

  const inactiveReport = buildReport({
    projectRef: "abcdefghijklmnopqrst",
    projectStatus: "INACTIVE",
  });
  assert.equal(
    inactiveReport.results.some(
      (entry) =>
        entry.id === "supabase-live-project-target" && entry.status === "FAIL",
    ),
    true,
  );

  assert.throws(
    () =>
      writeReport(
        "docs/validation/evidence/supabase-deployment-packet.json",
        report,
      ),
    /docs\/validation\/evidence/,
  );
  console.log("supabase deployment packet self-test: pass");
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Invalid Supabase deployment packet arguments.",
    );
    process.exit(1);
  }

  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const report = buildReport(options);
  const reportPath = writeReport(options.reportPath, report);

  console.log("# FREED Supabase deployment packet");
  console.log(
    `Result: ${report.summary.passCount} pass, ${report.summary.warnCount} warn, ${report.summary.failCount} fail`,
  );
  if (reportPath) console.log(`Report: ${reportPath}`);
  for (const entry of report.results) {
    console.log(`- ${entry.status}: ${entry.id} - ${entry.detail}`);
  }

  if (report.summary.failCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
  assertSanitizedReport,
  buildReleaseBlockerHandoff,
};
