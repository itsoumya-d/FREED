import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { formatEndpointIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { fetchRemoteProviderResponse, readRemoteProviderJson } from "../src/lib/remote-provider-timeout";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type SmokeResult = {
  id: string;
  status: "PASS" | "FAIL";
  detail: string;
};

type ReadinessComponent = {
  ready?: unknown;
  configured?: unknown;
  missing?: unknown;
  dataBoundary?: unknown;
};

type BackendReadinessBody = {
  schemaVersion?: unknown;
  tables?: unknown;
  components?: unknown;
  privacy?: unknown;
};

type BackendReadinessSmokeReport = {
  schemaVersion: "backend-readiness-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoint: string | null;
  requireAllComponents: boolean;
  summary: {
    passCount: number;
    failCount: number;
  };
  results: SmokeResult[];
  infrastructureProof: null | {
    coreComponents: string[];
    optionalComponents: string[];
    requiredComponents: string[];
    allComponentsRequired: boolean;
    coreComponentsReady: boolean;
    requiredComponentsReady: boolean;
    allComponentsReady: boolean;
    notReadyComponents: string[];
    checkedTableKeys: string[];
    cacheControlRequired: "no-store";
    requestTimeoutMs: number;
    privacyBoundary: {
      returnsSecrets: false | null;
      secretValuesOmitted: true;
      serverOnlyKeyNamesChecked: string[];
      forbiddenPublicPrefixesChecked: string[];
    };
    dataBoundaryPhrasesChecked: string[];
  };
  readiness: null | {
    schemaVersion: unknown;
    tables: Record<string, unknown>;
    components: Record<string, {
      ready: boolean | null;
      configured: boolean | null;
      missing: unknown[];
      dataBoundary: string;
    }>;
    privacy: {
      returnsSecrets: boolean | null;
      serverOnlyKeyCount: number;
      forbiddenPublicPrefixes: unknown[];
    };
  };
};

const DEFAULT_BACKEND_READINESS_TIMEOUT_MS = 8_000;
const MIN_BACKEND_READINESS_TIMEOUT_MS = 500;
const MAX_BACKEND_READINESS_TIMEOUT_MS = 15_000;

const CORE_COMPONENTS = ["supabase", "redis", "recoveryBackupSync", "maintenance"] as const;
const EXPECTED_COMPONENTS = ["supabase", "redis", "ai", "purchases", "notifications", "recoveryBackupSync", "maintenance"] as const;
const EXPECTED_TABLES = [
  "analytics",
  "adultDomainFeedVersions",
  "encryptedRecoveryBackups",
  "purchaseVerificationEvents",
  "aiBackendEvents",
  "backendJobRuns"
] as const;
const SERVER_ONLY_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "BACKEND_MAINTENANCE_SECRET",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "APP_STORE_SERVER_API_JWT",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
  "GOOGLE_PLAY_ACCESS_TOKEN",
  "FCM_SERVER_KEY",
  "FCM_ACCESS_TOKEN",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64"
] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function readBoundedTimeoutMs() {
  const raw = readEnv("EXPO_PUBLIC_BACKEND_READINESS_TIMEOUT_MS") ?? readEnv("FREED_BACKEND_READINESS_SMOKE_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_BACKEND_READINESS_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_BACKEND_READINESS_TIMEOUT_MS;
  return Math.max(MIN_BACKEND_READINESS_TIMEOUT_MS, Math.min(MAX_BACKEND_READINESS_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    endpoint: readConfiguredBackendReadinessEndpoint(),
    requireAllComponents: false,
    reportPath: null as string | null,
    selfTest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--endpoint") {
      options.endpoint = next();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report.");
    } else if (arg === "--require-all-components") {
      options.requireAllComponents = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run smoke:backend-readiness -- [options]

Validates the deployed app/api/backend/readiness route. The command checks that
the endpoint is production-safe, returns the no-secret readiness contract, marks
core Supabase/Redis/backup/maintenance infrastructure ready, and does not echo
server-only secret values.

Options:
  --endpoint <url>              Deployed /api/backend/readiness route.
  --require-all-components      Also require AI, purchase, and notification readiness.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function readConfiguredBackendReadinessEndpoint() {
  const direct = readEnv("EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT");
  if (direct) return direct;

  const derivedSource = [
    "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
    "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
    "EXPO_PUBLIC_AI_COACH_ENDPOINT",
    "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
    "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
    "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT"
  ]
    .map(readEnv)
    .find(Boolean);
  return derivedSource ? deriveReadinessEndpoint(derivedSource) : null;
}

function deriveReadinessEndpoint(sourceEndpoint: string) {
  if (getProductionEndpointIssues(sourceEndpoint, "backend readiness derivation source endpoint").length > 0) {
    return sourceEndpoint;
  }
  try {
    const parsed = new URL(sourceEndpoint);
    return new URL("/api/backend/readiness", parsed.origin).toString();
  } catch {
    return sourceEndpoint;
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object JSON body.`);
  }
  return value as Record<string, unknown>;
}

function asComponent(value: unknown, label: string): ReadinessComponent {
  return asRecord(value, label) as ReadinessComponent;
}

function assertReadinessShape(payload: unknown): BackendReadinessBody {
  const body = asRecord(payload, "Backend readiness") as BackendReadinessBody;
  assert.equal(body.schemaVersion, "backend-v1");
  const tables = asRecord(body.tables, "Backend readiness tables");
  for (const table of EXPECTED_TABLES) {
    assert.equal(typeof tables[table], "string", `${table} table must be named`);
    assert.ok(String(tables[table]).trim().length > 0, `${table} table must not be blank`);
  }

  const components = asRecord(body.components, "Backend readiness components");
  for (const componentName of EXPECTED_COMPONENTS) {
    const component = asComponent(components[componentName], `${componentName} readiness`);
    assert.equal(typeof component.ready, "boolean", `${componentName}.ready must be boolean`);
    assert.equal(typeof component.configured, "boolean", `${componentName}.configured must be boolean`);
    assert.ok(Array.isArray(component.missing), `${componentName}.missing must be an array`);
    assert.equal(typeof component.dataBoundary, "string", `${componentName}.dataBoundary must be text`);
    assert.ok(String(component.dataBoundary).length >= 40, `${componentName}.dataBoundary must describe the privacy boundary`);
  }

  const privacy = asRecord(body.privacy, "Backend readiness privacy");
  assert.equal(privacy.returnsSecrets, false);
  assert.ok(Array.isArray(privacy.serverOnlyKeys));
  assert.ok(Array.isArray(privacy.forbiddenPublicPrefixes));
  assert.ok((privacy.serverOnlyKeys as unknown[]).includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok((privacy.serverOnlyKeys as unknown[]).includes("UPSTASH_REDIS_REST_TOKEN"));
  assert.ok((privacy.forbiddenPublicPrefixes as unknown[]).includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE"));
  return body;
}

function assertNoServerSecretEcho(payload: unknown, env: Record<string, string | undefined> = process.env) {
  const text = JSON.stringify(payload);
  assert.equal(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(text), false);
  assert.equal(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(text), false);
  assert.equal(/AIza[0-9A-Za-z_-]{30,}/.test(text), false);
  assert.equal(/ya29\.[0-9A-Za-z._-]{20,}/.test(text), false);

  for (const key of SERVER_ONLY_KEYS) {
    const value = env[key]?.trim();
    if (!value || value.length < 8) continue;
    assert.equal(text.includes(value), false, `${key} value was echoed by readiness endpoint`);
  }
}

function assertCoreInfrastructureReady(body: BackendReadinessBody, requireAllComponents: boolean) {
  const components = asRecord(body.components, "Backend readiness components");
  const requiredComponents = requireAllComponents ? EXPECTED_COMPONENTS : CORE_COMPONENTS;
  for (const componentName of requiredComponents) {
    const component = asComponent(components[componentName], `${componentName} readiness`);
    assert.equal(component.ready, true, `${componentName} is not ready: ${missingDetail(component)}`);
    assert.deepEqual(component.missing, [], `${componentName}.missing must be empty`);
  }
}

function missingDetail(component: ReadinessComponent) {
  return Array.isArray(component.missing) ? component.missing.join(", ") || "missing readiness" : "invalid missing list";
}

function assertDataBoundaries(body: BackendReadinessBody) {
  const components = asRecord(body.components, "Backend readiness components");
  const combined = EXPECTED_COMPONENTS.map((componentName) =>
    String(asComponent(components[componentName], `${componentName} readiness`).dataBoundary)
  ).join("\n");
  for (const phrase of ["raw URLs", "recovery notes", "purchase tokens", "passphrases"]) {
    assert.ok(combined.includes(phrase), `Data boundary should mention ${phrase}`);
  }
}

function sanitizeEndpointForReport(endpoint: string | null) {
  if (!endpoint) return null;
  try {
    const parsed = new URL(endpoint);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeDetailForReport(detail: string, env: Record<string, string | undefined> = process.env) {
  let sanitized = detail
    .replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[redacted-google-key]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/([?&](?:token|key|secret|receipt|purchaseToken)=)[^"'&\s]+/gi, "$1[redacted]");

  for (const key of SERVER_ONLY_KEYS) {
    const value = env[key]?.trim();
    if (!value || value.length < 8) continue;
    sanitized = sanitized.split(value).join(`[redacted-${key}]`);
  }
  return sanitized.slice(0, 1_000);
}

function sanitizeResultsForReport(results: SmokeResult[]) {
  return results.map((result) => ({
    ...result,
    detail: sanitizeDetailForReport(result.detail)
  }));
}

function buildSmokeReport(
  endpoint: string | null,
  requireAllComponents: boolean,
  results: SmokeResult[],
  body: BackendReadinessBody | null
): BackendReadinessSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  return {
    schemaVersion: "backend-readiness-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoint: sanitizeEndpointForReport(endpoint),
    requireAllComponents,
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    results: sanitizedResults,
    infrastructureProof: body ? summarizeInfrastructureProofForReport(body, requireAllComponents) : null,
    readiness: body ? summarizeReadinessForReport(body) : null
  };
}

function summarizeInfrastructureProofForReport(
  body: BackendReadinessBody,
  requireAllComponents: boolean
): BackendReadinessSmokeReport["infrastructureProof"] {
  const components = asRecord(body.components, "Backend readiness components");
  const privacy = asRecord(body.privacy, "Backend readiness privacy");
  const coreComponentSet = new Set<string>(CORE_COMPONENTS);
  const optionalComponents = EXPECTED_COMPONENTS.filter((componentName) => !coreComponentSet.has(componentName));
  const requiredComponents = requireAllComponents ? [...EXPECTED_COMPONENTS] : [...CORE_COMPONENTS];
  const componentReady = (componentName: string) => {
    const component = asComponent(components[componentName], `${componentName} readiness`);
    return component.ready === true && Array.isArray(component.missing) && component.missing.length === 0;
  };
  const notReadyComponents = EXPECTED_COMPONENTS.filter((componentName) => !componentReady(componentName));

  return {
    coreComponents: [...CORE_COMPONENTS],
    optionalComponents,
    requiredComponents,
    allComponentsRequired: requireAllComponents,
    coreComponentsReady: CORE_COMPONENTS.every(componentReady),
    requiredComponentsReady: requiredComponents.every(componentReady),
    allComponentsReady: EXPECTED_COMPONENTS.every(componentReady),
    notReadyComponents,
    checkedTableKeys: [...EXPECTED_TABLES],
    cacheControlRequired: "no-store",
    requestTimeoutMs: readBoundedTimeoutMs(),
    privacyBoundary: {
      returnsSecrets: privacy.returnsSecrets === false ? false : null,
      secretValuesOmitted: true,
      serverOnlyKeyNamesChecked: Array.isArray(privacy.serverOnlyKeys) ? privacy.serverOnlyKeys.map(String).filter(Boolean) : [],
      forbiddenPublicPrefixesChecked: Array.isArray(privacy.forbiddenPublicPrefixes)
        ? privacy.forbiddenPublicPrefixes.map(String).filter(Boolean)
        : []
    },
    dataBoundaryPhrasesChecked: ["raw URLs", "recovery notes", "purchase tokens", "passphrases"]
  };
}

function summarizeReadinessForReport(body: BackendReadinessBody): BackendReadinessSmokeReport["readiness"] {
  const tables = asRecord(body.tables, "Backend readiness tables");
  const components = asRecord(body.components, "Backend readiness components");
  const privacy = asRecord(body.privacy, "Backend readiness privacy");
  return {
    schemaVersion: body.schemaVersion,
    tables,
    components: Object.fromEntries(
      EXPECTED_COMPONENTS.map((componentName) => {
        const component = asComponent(components[componentName], `${componentName} readiness`);
        return [
          componentName,
          {
            ready: typeof component.ready === "boolean" ? component.ready : null,
            configured: typeof component.configured === "boolean" ? component.configured : null,
            missing: Array.isArray(component.missing) ? component.missing : [],
            dataBoundary: String(component.dataBoundary ?? "").slice(0, 1_000)
          }
        ];
      })
    ),
    privacy: {
      returnsSecrets: typeof privacy.returnsSecrets === "boolean" ? privacy.returnsSecrets : null,
      serverOnlyKeyCount: Array.isArray(privacy.serverOnlyKeys) ? privacy.serverOnlyKeys.length : 0,
      forbiddenPublicPrefixes: Array.isArray(privacy.forbiddenPublicPrefixes) ? privacy.forbiddenPublicPrefixes : []
    }
  };
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function writeSmokeReport(reportPath: string, report: BackendReadinessSmokeReport) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

async function fetchBackendReadiness(endpoint: string, timeoutMs: number) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" }
  }, timeoutMs, "Backend readiness smoke request");

  const body = await readRemoteProviderJson(response, timeoutMs, "Backend readiness smoke response");
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(body).slice(0, 240)}`);
  }
  const cacheControl = response.headers.get("cache-control") ?? "";
  assert.match(cacheControl, /no-store/i, "Backend readiness route must return Cache-Control: no-store");
  return body;
}

function validateEndpoint(endpoint: string | null): SmokeResult {
  if (!endpoint) {
    return { id: "backend-readiness-endpoint", status: "FAIL", detail: "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT is not configured and no deployed app endpoint could be used to derive it." };
  }
  const endpointIssues = getProductionEndpointIssues(endpoint, "backend readiness endpoint").filter(
    (entry) => entry.issue !== "is not configured"
  );
  if (endpointIssues.length > 0) {
    return { id: "backend-readiness-endpoint", status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/backend/readiness" && !pathname.endsWith("/api/backend/readiness")) {
      return { id: "backend-readiness-endpoint", status: "FAIL", detail: "backend readiness endpoint must target /api/backend/readiness." };
    }
  } catch {
    return { id: "backend-readiness-endpoint", status: "FAIL", detail: "backend readiness endpoint is not a valid URL." };
  }
  return { id: "backend-readiness-endpoint", status: "PASS", detail: endpoint };
}

function runPayloadCase(id: string, run: () => void): SmokeResult {
  try {
    run();
    return { id, status: "PASS", detail: "ok" };
  } catch (error) {
    return { id, status: "FAIL", detail: error instanceof Error ? error.message : "unknown backend readiness smoke failure" };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const endpointResult = validateEndpoint(options.endpoint);
  const results: SmokeResult[] = [endpointResult];
  let body: BackendReadinessBody | null = null;

  if (endpointResult.status === "PASS" && options.endpoint) {
    try {
      body = assertReadinessShape(await fetchBackendReadiness(options.endpoint, readBoundedTimeoutMs()));
      results.push({ id: "backend-readiness-http-contract", status: "PASS", detail: "backend-v1 no-store JSON" });
    } catch (error) {
      results.push({
        id: "backend-readiness-http-contract",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown backend readiness fetch failure"
      });
    }
  }

  if (body) {
    results.push(
      runPayloadCase("backend-readiness-no-secret-echo", () => assertNoServerSecretEcho(body)),
      runPayloadCase("backend-readiness-core-infrastructure-ready", () => assertCoreInfrastructureReady(body, options.requireAllComponents)),
      runPayloadCase("backend-readiness-data-boundaries", () => assertDataBoundaries(body))
    );
  }

  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(options.endpoint, options.requireAllComponents, results, body));
  }

  console.log("# FREED backend readiness smoke");
  console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log("");
  console.log("| Status | Case | Detail |");
  console.log("| --- | --- | --- |");
  for (const result of results) {
    console.log(`| ${result.status} | ${result.id} | ${sanitizeDetailForReport(result.detail).replace(/\|/g, "/")} |`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

function sampleReadiness(): BackendReadinessBody {
  const component = (ready: boolean, boundary: string): ReadinessComponent => ({
    ready,
    configured: ready,
    missing: ready ? [] : ["provider credential"],
    dataBoundary: boundary
  });
  return {
    schemaVersion: "backend-v1",
    tables: {
      analytics: "recovery_analytics_events",
      adultDomainFeedVersions: "adult_domain_feed_versions",
      encryptedRecoveryBackups: "encrypted_recovery_backups",
      purchaseVerificationEvents: "purchase_verification_events",
      aiBackendEvents: "ai_backend_events",
      backendJobRuns: "backend_job_runs"
    },
    components: {
      supabase: component(true, "Stores aggregate rows only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      redis: component(true, "Stores short-lived locks and rate limits only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      ai: component(false, "Uses redacted prompts only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      purchases: component(false, "Stores product/status plus hashes only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      notifications: component(false, "Sends preset route metadata only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      recoveryBackupSync: component(true, "Accepts encrypted backup envelopes only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts."),
      maintenance: component(true, "Deletes expired rows only; never stores raw URLs, recovery notes, screenshots, passphrases, purchase tokens, or support contacts.")
    },
    privacy: {
      returnsSecrets: false,
      serverOnlyKeys: ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_TOKEN"],
      forbiddenPublicPrefixes: ["EXPO_PUBLIC_SUPABASE_SERVICE_ROLE"]
    }
  };
}

function runSelfTest() {
  const sample = assertReadinessShape(sampleReadiness());
  assertNoServerSecretEcho(sample, { SUPABASE_SERVICE_ROLE_KEY: "server-secret-not-present" });
  assert.throws(() => assertNoServerSecretEcho({ leaked: "server-secret-present" }, { SUPABASE_SERVICE_ROLE_KEY: "server-secret-present" }));
  assertCoreInfrastructureReady(sample, false);
  assert.throws(() => assertCoreInfrastructureReady(sample, true), /ai is not ready/);
  assertDataBoundaries(sample);
  assert.equal(deriveReadinessEndpoint("https://api.freedrecovery.app/api/analytics"), "https://api.freedrecovery.app/api/backend/readiness");
  assert.equal(
    deriveReadinessEndpoint("https://api.freedrecovery.app/api/analytics?token=secret"),
    "https://api.freedrecovery.app/api/analytics?token=secret"
  );
  assert.match(
    validateEndpoint(deriveReadinessEndpoint("https://api.freedrecovery.app/api/analytics?token=secret")).detail,
    /must not include query strings/
  );
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/backend/readiness").status, "PASS");
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/analytics").status, "FAIL");
  assert.equal(validateEndpoint("http://localhost:3000/api/backend/readiness").status, "FAIL");
  assert.equal(validateEndpoint("https://example.com/api/backend/readiness").status, "FAIL");
  const previousSupabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-present";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/backend/readiness?token=secret",
    false,
    [{ id: "redaction", status: "FAIL", detail: "server-secret-present https://api.freedrecovery.app/api/backend/readiness?token=secret eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" }],
    sample
  );
  if (previousSupabaseSecret === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousSupabaseSecret;
  }
  const reportText = JSON.stringify(report);
  assert.equal(report.endpoint, "https://api.freedrecovery.app/api/backend/readiness");
  assert.equal(report.sanitized, true);
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/backend/readiness?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/backend/readiness"
  );
  assert.equal(report.infrastructureProof?.coreComponentsReady, true);
  assert.equal(report.infrastructureProof?.requiredComponentsReady, true);
  assert.equal(report.infrastructureProof?.allComponentsReady, false);
  assert.deepEqual(report.infrastructureProof?.requiredComponents, [...CORE_COMPONENTS]);
  assert.ok(report.infrastructureProof?.privacyBoundary.serverOnlyKeyNamesChecked.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.equal(report.infrastructureProof?.privacyBoundary.secretValuesOmitted, true);
  assert.equal(reportText.includes("server-secret-present"), false);
  assert.equal(reportText.includes("token=secret"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/backend-readiness-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/backend-readiness-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("backend-readiness-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
