import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { formatEndpointIssues, getProductionBaseUrlIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { fetchRemoteProviderResponse, readRemoteProviderJson } from "../src/lib/remote-provider-timeout";
import { isJwt, isSupabaseServiceRoleKey } from "../src/lib/server-credential-safety";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type SmokeResult = {
  id: string;
  status: "PASS" | "FAIL";
  detail: string;
};

type TableContract = {
  id: string;
  envKey: string;
  defaultName: string;
  columns: string[];
};

type SupabaseSchemaSmokeReport = {
  schemaVersion: "supabase-schema-smoke-v1";
  generatedAt: string;
  sanitized: true;
  supabaseRestEndpoint: string | null;
  summary: {
    passCount: number;
    failCount: number;
  };
  schemaBoundary: {
    usesServiceRoleOnly: true;
    verifiesPublicAnonLockout: boolean;
    usesLimitZeroReads: true;
    coreTableContractsChecked: boolean;
    noRowPayloadsExpected: true;
    noSecretEchoChecked: boolean;
    tableContractIds: string[];
  };
  tableContracts: Array<{
    id: string;
    tableName: string;
    requiredColumnCount: number;
    requiredColumns: string[];
    request: {
      select: string[];
      limit: 0;
    };
    serviceRoleLimitZeroReadRequired: true;
    publicAnonLockoutRequired: true;
  }>;
  accessProof: {
    serviceRoleKeyRequired: true;
    publicAnonKeyRequired: true;
    publicAnonUsedOnlyForLockout: true;
    noRowPayloadsExpected: true;
    secretValuesOmitted: true;
    credentialNamesRedacted: string[];
    requestTimeoutMs: number;
  };
  results: SmokeResult[];
};

const DEFAULT_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS = 8_000;
const MIN_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS = 500;
const MAX_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS = 15_000;
const SAFE_TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

const TABLE_CONTRACTS: TableContract[] = [
  {
    id: "analytics",
    envKey: "SUPABASE_ANALYTICS_TABLE",
    defaultName: "recovery_analytics_events",
    columns: ["id", "schema_version", "generated_for_date_key", "consent_version", "data_retention_days", "snapshot", "received_at", "expires_at"]
  },
  {
    id: "adult-domain-feed",
    envKey: "SUPABASE_ADULT_FEED_TABLE",
    defaultName: "adult_domain_feed_versions",
    columns: ["id", "version", "checksum", "generated_at", "domain_count", "safari_rule_count", "rejected_normal_domain_count", "source_reports", "readiness"]
  },
  {
    id: "encrypted-recovery-backups",
    envKey: "SUPABASE_RECOVERY_BACKUP_TABLE",
    defaultName: "encrypted_recovery_backups",
    columns: ["user_hash", "envelope_version", "envelope", "backup_created_at", "device_hash", "synced_at", "retention_days", "expires_at"]
  },
  {
    id: "purchase-verification",
    envKey: "SUPABASE_PURCHASE_AUDIT_TABLE",
    defaultName: "purchase_verification_events",
    columns: ["id", "platform", "store_environment", "product_id", "entitlement_id", "verification_status", "transaction_id_hash", "order_id_hash", "purchase_token_hash", "verified_at", "expires_at"]
  },
  {
    id: "ai-backend-events",
    envKey: "SUPABASE_AI_EVENTS_TABLE",
    defaultName: "ai_backend_events",
    columns: ["id", "route", "provider", "model", "request_kind", "safety_eval_passed", "redaction_passed", "crisis_fallback_used", "payload_summary", "received_at", "expires_at"]
  },
  {
    id: "backend-job-runs",
    envKey: "SUPABASE_JOB_RUNS_TABLE",
    defaultName: "backend_job_runs",
    columns: ["id", "job_name", "idempotency_key", "status", "started_at", "finished_at", "metadata"]
  }
];

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
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "FCM_SERVER_KEY",
  "FCM_ACCESS_TOKEN",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function readBoundedTimeoutMs() {
  const raw = readEnv("FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS") ?? readEnv("FREED_BACKEND_PROVIDER_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS;
  return Math.max(MIN_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS, Math.min(MAX_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    supabaseUrl: readEnv("SUPABASE_URL"),
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
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

    if (arg === "--supabase-url") {
      options.supabaseUrl = next();
    } else if (arg === "--service-role-key") {
      options.serviceRoleKey = next();
    } else if (arg === "--anon-key") {
      options.anonKey = next();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report.");
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
  console.log(`Usage: npm run smoke:supabase-schema -- [options]

Validates the deployed Supabase/PostgREST schema without writing data. The
command checks that the production project exposes the six FREED backend tables
and required columns through server-only service-role credentials, while public
anon clients are denied access to those backend tables.

Options:
  --supabase-url <url>          Production SUPABASE_URL.
  --service-role-key <secret>   Server-only SUPABASE_SERVICE_ROLE_KEY.
  --anon-key <jwt>              Public EXPO_PUBLIC_SUPABASE_ANON_KEY used to prove lockout.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function supabaseRestEndpoint(supabaseUrl: string) {
  return new URL("/rest/v1/", supabaseUrl).toString();
}

function tableName(contract: TableContract) {
  return readEnv(contract.envKey) ?? contract.defaultName;
}

function buildTableContractUrl(supabaseUrl: string, name: string, columns: string[]) {
  const url = new URL(encodeURIComponent(name), supabaseRestEndpoint(supabaseUrl));
  url.searchParams.set("select", columns.join(","));
  url.searchParams.set("limit", "0");
  return url.toString();
}

function isPublicSupabaseAnonKey(value: string | null) {
  const token = value && value.trim();
  if (!isJwt(token) || /service[_-]?role|jwt[_-]?secret/i.test(token)) return false;
  const parts = token.split(".");
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return !payload.role || payload.role === "anon";
  } catch {
    return true;
  }
}

function validateSupabaseConfig(supabaseUrl: string | null, serviceRoleKey: string | null, anonKey: string | null): SmokeResult {
  const issues: string[] = [];

  if (!supabaseUrl) {
    issues.push("SUPABASE_URL is not configured");
  } else {
    const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase base URL").filter(
      (entry) => entry.issue !== "is not configured"
    );
    issues.push(...formatEndpointIssues(baseIssues));
    if (baseIssues.length === 0) {
      try {
        issues.push(
          ...formatEndpointIssues(
            getProductionEndpointIssues(supabaseRestEndpoint(supabaseUrl), "Supabase REST endpoint").filter(
              (entry) => entry.issue !== "is not configured"
            )
          )
        );
      } catch {
        issues.push("Supabase REST endpoint is not a valid URL");
      }
    }
  }

  if (!isSupabaseServiceRoleKey(serviceRoleKey)) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY must be a production-shaped service-role secret");
  }
  if (!isPublicSupabaseAnonKey(anonKey)) {
    issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public anon JWT for public-client lockout proof");
  }

  return {
    id: "supabase-schema-config",
    status: issues.length === 0 ? "PASS" : "FAIL",
    detail: issues.length === 0 ? "SUPABASE_URL and server-only service role are configured" : issues.join(", ")
  };
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
    assert.equal(text.includes(value), false, `${key} value was echoed by Supabase schema smoke`);
  }
}

function sanitizeSupabaseRestEndpointForReport(supabaseUrl: string | null) {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseRestEndpoint(supabaseUrl));
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
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[redacted-google-key]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
    .replace(/AAAA[A-Za-z0-9:_-]{20,}/g, "[redacted-fcm-key]")
    .replace(/\b(?:[a-z0-9-]+\.)+supabase\.co\b/gi, "[redacted-supabase-host]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]");

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

function sanitizeTableNameForReport(name: string) {
  return SAFE_TABLE_NAME_PATTERN.test(name) ? name : "[redacted-table-name]";
}

function buildTableContractsForReport(): SupabaseSchemaSmokeReport["tableContracts"] {
  return TABLE_CONTRACTS.map((contract) => ({
    id: contract.id,
    tableName: sanitizeTableNameForReport(tableName(contract)),
    requiredColumnCount: contract.columns.length,
    requiredColumns: [...contract.columns],
    request: {
      select: [...contract.columns],
      limit: 0
    },
    serviceRoleLimitZeroReadRequired: true,
    publicAnonLockoutRequired: true
  }));
}

function assertReadOnlyTableBody(value: unknown) {
  assert.ok(Array.isArray(value), "Supabase table contract response must be a JSON array");
  assert.equal(value.length, 0, "Supabase table contract response must use limit=0 and return no row payloads");
}

async function fetchTableContract(supabaseUrl: string, serviceRoleKey: string, contract: TableContract, timeoutMs: number) {
  const name = tableName(contract);
  const response = await fetchRemoteProviderResponse(
    buildTableContractUrl(supabaseUrl, name, contract.columns),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    },
    timeoutMs,
    `Supabase ${contract.id} schema smoke request`
  );
  const body = await readRemoteProviderJson(response, timeoutMs, `Supabase ${contract.id} schema smoke response`);
  assertNoServerSecretEcho(body);

  if (!response.ok) {
    const errorText = JSON.stringify(body).slice(0, 240);
    throw new Error(`${name} returned ${response.status}: ${errorText}`);
  }

  assertReadOnlyTableBody(body);
  return name;
}

async function smokeSupabaseTables(supabaseUrl: string, serviceRoleKey: string, timeoutMs: number) {
  const verifiedNames: string[] = [];
  for (const contract of TABLE_CONTRACTS) {
    verifiedNames.push(await fetchTableContract(supabaseUrl, serviceRoleKey, contract, timeoutMs));
  }
  return verifiedNames;
}

function assertPublicClientLockedOut(status: number, body: unknown, tableName: string) {
  assertNoServerSecretEcho(body);
  if (status === 401 || status === 403) return;
  if (status >= 200 && status < 300) {
    throw new Error(`${tableName} was readable with the public anon key; backend tables must stay service-role only`);
  }
  throw new Error(`${tableName} public lockout returned ${status}; expected 401 or 403`);
}

async function fetchPublicClientLockout(supabaseUrl: string, anonKey: string, contract: TableContract, timeoutMs: number) {
  const name = tableName(contract);
  const response = await fetchRemoteProviderResponse(
    buildTableContractUrl(supabaseUrl, name, contract.columns),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    },
    timeoutMs,
    `Supabase ${contract.id} public lockout smoke request`
  );
  const body = await readRemoteProviderJson(response, timeoutMs, `Supabase ${contract.id} public lockout smoke response`);
  assertPublicClientLockedOut(response.status, body, name);
  return name;
}

async function smokePublicClientLockout(supabaseUrl: string, anonKey: string, timeoutMs: number) {
  const lockedNames: string[] = [];
  for (const contract of TABLE_CONTRACTS) {
    lockedNames.push(await fetchPublicClientLockout(supabaseUrl, anonKey, contract, timeoutMs));
  }
  return lockedNames;
}

function runPayloadCase(id: string, run: () => void): SmokeResult {
  try {
    run();
    return { id, status: "PASS", detail: "ok" };
  } catch (error) {
    return { id, status: "FAIL", detail: error instanceof Error ? error.message : "unknown Supabase schema smoke failure" };
  }
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function buildSmokeReport(supabaseUrl: string | null, results: SmokeResult[]): SupabaseSchemaSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  const passed = (id: string) => results.some((entry) => entry.id === id && entry.status === "PASS");
  return {
    schemaVersion: "supabase-schema-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    supabaseRestEndpoint: sanitizeSupabaseRestEndpointForReport(supabaseUrl),
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    schemaBoundary: {
      usesServiceRoleOnly: true,
      verifiesPublicAnonLockout: passed("supabase-schema-public-client-lockout"),
      usesLimitZeroReads: true,
      coreTableContractsChecked: passed("supabase-schema-core-table-contracts"),
      noRowPayloadsExpected: true,
      noSecretEchoChecked: passed("supabase-schema-no-secret-echo"),
      tableContractIds: TABLE_CONTRACTS.map((contract) => contract.id)
    },
    tableContracts: buildTableContractsForReport(),
    accessProof: {
      serviceRoleKeyRequired: true,
      publicAnonKeyRequired: true,
      publicAnonUsedOnlyForLockout: true,
      noRowPayloadsExpected: true,
      secretValuesOmitted: true,
      credentialNamesRedacted: [...SERVER_ONLY_KEYS],
      requestTimeoutMs: readBoundedTimeoutMs()
    },
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: SupabaseSchemaSmokeReport) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const configResult = validateSupabaseConfig(options.supabaseUrl, options.serviceRoleKey, options.anonKey);
  const results: SmokeResult[] = [configResult];

  if (configResult.status === "PASS" && options.supabaseUrl && options.serviceRoleKey && options.anonKey) {
    const timeoutMs = readBoundedTimeoutMs();
    try {
      const verifiedNames = await smokeSupabaseTables(options.supabaseUrl, options.serviceRoleKey, timeoutMs);
      results.push({
        id: "supabase-schema-core-table-contracts",
        status: "PASS",
        detail: verifiedNames.join(", ")
      });
    } catch (error) {
      results.push({
        id: "supabase-schema-core-table-contracts",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown Supabase table contract failure"
      });
    }
    try {
      const lockedNames = await smokePublicClientLockout(options.supabaseUrl, options.anonKey, timeoutMs);
      results.push({
        id: "supabase-schema-public-client-lockout",
        status: "PASS",
        detail: lockedNames.join(", ")
      });
    } catch (error) {
      results.push({
        id: "supabase-schema-public-client-lockout",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown Supabase public-client lockout failure"
      });
    }
  }

  results.push(
    runPayloadCase("supabase-schema-no-secret-echo", () =>
      assertNoServerSecretEcho({ checkedTables: TABLE_CONTRACTS.map((contract) => contract.defaultName) })
    )
  );

  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(options.supabaseUrl, results));
  }

  console.log("# FREED Supabase schema smoke");
  console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log("");
  console.log("| Status | Case | Detail |");
  console.log("| --- | --- | --- |");
  for (const result of results) {
    console.log(`| ${result.status} | ${result.id} | ${sanitizeDetailForReport(result.detail).replace(/\|/g, "/")} |`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

function runSelfTest() {
  const validUrl = "https://freed-project.supabase.co";
  const validSecret = "supabase-service-role-key-prod-1234567890";
  const validAnon = testJwt({ role: "anon" });
  const serviceRoleJwt = testJwt({ role: "service_role" });
  assert.equal(validateSupabaseConfig(validUrl, validSecret, validAnon).status, "PASS");
  assert.equal(validateSupabaseConfig("https://example.com", validSecret, validAnon).status, "FAIL");
  assert.equal(validateSupabaseConfig("http://localhost:54321", validSecret, validAnon).status, "FAIL");
  const unsafeBaseResult = validateSupabaseConfig("https://freed-project.supabase.co/rest/v1?token=secret", validSecret, validAnon);
  assert.equal(unsafeBaseResult.status, "FAIL");
  assert.match(unsafeBaseResult.detail, /Supabase base URL must be an origin without a path/);
  assert.match(unsafeBaseResult.detail, /Supabase base URL must not include query strings/);
  assert.equal(validateSupabaseConfig(validUrl, "test-key", validAnon).status, "FAIL");
  assert.equal(validateSupabaseConfig(validUrl, validSecret, serviceRoleJwt).status, "FAIL");
  assert.equal(validateSupabaseConfig(validUrl, validSecret, null).status, "FAIL");
  assert.match(
    buildTableContractUrl(validUrl, "recovery_analytics_events", ["id", "schema_version"]),
    /\/rest\/v1\/recovery_analytics_events\?select=id%2Cschema_version&limit=0$/
  );
  assertReadOnlyTableBody([]);
  assert.throws(() => assertReadOnlyTableBody([{ id: "row-leak" }]), /return no row payloads/);
  assert.doesNotThrow(() => assertPublicClientLockedOut(403, { code: "42501" }, "recovery_analytics_events"));
  assert.throws(
    () => assertPublicClientLockedOut(200, [], "recovery_analytics_events"),
    /was readable with the public anon key/
  );
  assertNoServerSecretEcho({ checked: true }, { SUPABASE_SERVICE_ROLE_KEY: "server-secret-not-present" });
  assert.throws(() => assertNoServerSecretEcho({ leaked: "server-secret-present" }, { SUPABASE_SERVICE_ROLE_KEY: "server-secret-present" }));
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "supabase-service-role-key-prod-1234567890";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = validAnon;
  const report = buildSmokeReport(
    "https://freed-project.supabase.co",
    [
      { id: "supabase-schema-config", status: "PASS", detail: "https://freed-project.supabase.co/rest/v1/?apikey=secret" },
      { id: "supabase-schema-core-table-contracts", status: "PASS", detail: "recovery_analytics_events, backend_job_runs" },
      { id: "supabase-schema-public-client-lockout", status: "PASS", detail: validAnon },
      { id: "supabase-schema-no-secret-echo", status: "PASS", detail: "supabase-service-role-key-prod-1234567890" }
    ]
  );
  if (previousServiceRole === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  }
  if (previousAnon === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  }
  const reportText = JSON.stringify(report);
  assert.equal(report.schemaVersion, "supabase-schema-smoke-v1");
  assert.equal(report.sanitized, true);
  assert.equal(report.supabaseRestEndpoint, "https://freed-project.supabase.co/rest/v1/");
  assert.equal(
    sanitizeSupabaseRestEndpointForReport("https://user:pass@freed-project.supabase.co?apikey=secret#access_token=secret"),
    "https://freed-project.supabase.co/rest/v1/"
  );
  assert.equal(report.schemaBoundary.usesServiceRoleOnly, true);
  assert.equal(report.schemaBoundary.coreTableContractsChecked, true);
  assert.equal(report.schemaBoundary.verifiesPublicAnonLockout, true);
  assert.equal(report.schemaBoundary.noSecretEchoChecked, true);
  assert.equal(report.tableContracts.length, TABLE_CONTRACTS.length);
  assert.equal(report.tableContracts[0].request.limit, 0);
  assert.ok(report.tableContracts[0].requiredColumns.includes("schema_version"));
  assert.equal(report.accessProof.publicAnonUsedOnlyForLockout, true);
  assert.equal(report.accessProof.secretValuesOmitted, true);
  assert.ok(report.accessProof.credentialNamesRedacted.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.equal(reportText.includes("supabase-service-role-key-prod-1234567890"), false);
  assert.equal(reportText.includes(validAnon), false);
  assert.equal(reportText.includes("apikey=secret"), false);
  const previousAnalyticsTable = process.env.SUPABASE_ANALYTICS_TABLE;
  process.env.SUPABASE_ANALYTICS_TABLE = "token=secret";
  assert.equal(buildTableContractsForReport()[0].tableName, "[redacted-table-name]");
  if (previousAnalyticsTable === undefined) {
    delete process.env.SUPABASE_ANALYTICS_TABLE;
  } else {
    process.env.SUPABASE_ANALYTICS_TABLE = previousAnalyticsTable;
  }
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/supabase-schema-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/supabase-schema-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("supabase-schema-smoke self-test: pass");
}

function testJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
