import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { formatEndpointIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import {
  ANALYTICS_BLOCKED_ATTEMPT_SOURCES,
  ANALYTICS_CONSENT_VERSION,
  buildRecoveryAnalyticsSnapshot
} from "../src/lib/recovery-analytics";
import { challengeLibrary } from "../src/lib/recovery-engine";
import {
  createDefaultRecoveryState,
  recordAppSessionEnd,
  recordAppSessionStart,
  recordBlockingAttempt,
  recordChallengeCompletion,
  recordEarnedUnlock
} from "../src/lib/recovery-state";
import { createBlockingAttempt } from "../src/lib/blocking-engine";
import { fetchRemoteProviderResponse, readRemoteProviderJson } from "../src/lib/remote-provider-timeout";
import type { AnalyticsIngestionRequest } from "../src/lib/recovery-analytics-ingestion";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type SmokeResult = {
  id: string;
  status: "PASS" | "FAIL";
  detail: string;
};

type JsonRecord = Record<string, unknown>;

type AnalyticsIngestionSmokeReport = {
  schemaVersion: "analytics-ingestion-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoint: string | null;
  summary: {
    passCount: number;
    failCount: number;
  };
  requestSummary: {
    consentVersion: string;
    dataRetentionDays: number;
    snapshotSchemaVersion: string;
    generatedForDateKey: string;
    aggregateOnly: boolean;
    blockedAttempts: number;
    challengeCompletions: number;
    earnedUnlocks: number;
    appOpens: number;
    foregroundMinutes: number;
    streakHistoryDays: number;
    hourlyBucketCount: number;
    challengeCategoryCount: number;
  };
  contractProof: {
    endpointPathRequired: "/api/analytics";
    requestTimeoutMs: number;
    acceptedAggregateSnapshot: {
      schemaVersion: string;
      consentVersion: string;
      generatedForDateKey: string;
      dataRetentionDays: number;
      aggregateOnly: boolean;
      privacyFlags: {
        excludesPrivateNotes: boolean;
        excludesBrowsingDetails: boolean;
        excludesSupportContacts: boolean;
      };
      blockedAttemptSources: string[];
      streakHistoryDays: number;
      hourlyUrgeBuckets: number;
      challengeCategories: string[];
    };
    rejectionProofs: {
      incompleteProductionMetricsRejected: boolean;
      futureConsentTimestampRejected: boolean;
      futureSnapshotDateRejected: boolean;
      sensitivePayloadRejectedWithoutEcho: boolean;
    };
    responseBoundary: {
      snapshotEchoForbidden: true;
      privateEchoPatternsChecked: number;
      secretValuesOmitted: true;
      serverSecretKeyNamesChecked: string[];
      sensitiveFieldAliasesRejected: string[];
    };
  };
  results: SmokeResult[];
};

const DEFAULT_ANALYTICS_SMOKE_TIMEOUT_MS = 8_000;
const MIN_ANALYTICS_SMOKE_TIMEOUT_MS = 250;
const MAX_ANALYTICS_SMOKE_TIMEOUT_MS = 15_000;
const ANALYTICS_PROVIDERS = new Set(["supabase", "custom"]);
const FORBIDDEN_RESPONSE_PATTERNS = [
  /https?:\/\/[^\s"'<>]+/i,
  /token=(?!redacted)[^"'&\s]+/i,
  /(?:api[_-]?key|secret|password)=([^"'&\s]+)/i,
  /private\.example/i,
  /support@example\.com/i,
  /private relapse note/i,
  /raw-note/i,
  /purchase-token/i,
  /opaque-(?:token|receipt)-secret/i,
  /\+15551234567/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/
];
const SERVER_SECRET_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "BACKEND_MAINTENANCE_SECRET",
  "CRON_SECRET",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
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
  const raw = readEnv("FREED_ANALYTICS_SMOKE_TIMEOUT_MS") ?? readEnv("EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_ANALYTICS_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_ANALYTICS_SMOKE_TIMEOUT_MS;
  return Math.max(MIN_ANALYTICS_SMOKE_TIMEOUT_MS, Math.min(MAX_ANALYTICS_SMOKE_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    endpoint: readEnv("EXPO_PUBLIC_ANALYTICS_ENDPOINT"),
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
  console.log(`Usage: npm run smoke:analytics-ingestion -- [options]

Validates the deployed app/api/analytics route. The command checks endpoint
safety, posts a tiny aggregate-v5 release-smoke snapshot with one-day retention,
then verifies future timestamps, incomplete production metrics, and sensitive/raw
analytics fields are rejected without being echoed.

Options:
  --endpoint <url>              Deployed /api/analytics route.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object JSON body.`);
  }
  return value as JsonRecord;
}

function validateEndpoint(endpoint: string | null): SmokeResult {
  if (!endpoint) {
    return { id: "analytics-ingestion-endpoint", status: "FAIL", detail: "EXPO_PUBLIC_ANALYTICS_ENDPOINT is not configured." };
  }

  const endpointIssues = getProductionEndpointIssues(endpoint, "analytics ingestion endpoint").filter(
    (entry) => entry.issue !== "is not configured"
  );
  if (endpointIssues.length > 0) {
    return { id: "analytics-ingestion-endpoint", status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }

  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/analytics" && !pathname.endsWith("/api/analytics")) {
      return { id: "analytics-ingestion-endpoint", status: "FAIL", detail: "analytics ingestion endpoint must target /api/analytics." };
    }
  } catch {
    return { id: "analytics-ingestion-endpoint", status: "FAIL", detail: "analytics ingestion endpoint is not a valid URL." };
  }

  return { id: "analytics-ingestion-endpoint", status: "PASS", detail: endpoint };
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
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/(?:api[_-]?key|secret|password)=([^"'&\s]+)/gi, "[redacted-secret-param]")
    .replace(/token=(?!redacted)[^"'&\s]+/gi, "token=[redacted]")
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[redacted-google-key]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/\+15551234567/g, "[redacted-phone]")
    .replace(/opaque-(?:token|receipt)-secret/g, "[redacted-store-secret]")
    .replace(/private relapse note/gi, "[redacted-private-note]")
    .replace(/support@example\.com/gi, "[redacted-contact]");

  for (const key of SERVER_SECRET_KEYS) {
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

function assertNoPrivateEcho(value: unknown) {
  const text = JSON.stringify(value);
  for (const pattern of FORBIDDEN_RESPONSE_PATTERNS) {
    assert.equal(pattern.test(text), false, `analytics response echoed forbidden private data: ${pattern}`);
  }
}

function buildAnalyticsSmokeRequest(): AnalyticsIngestionRequest {
  const challenge = challengeLibrary[0];
  const day = "2026-05-18T12:00:00.000Z";
  const attemptedAt = "2026-05-18T04:15:00.000Z";
  const challengedAt = "2026-05-18T04:20:00.000Z";
  const unlockedAt = "2026-05-18T04:24:00.000Z";
  const checkedInAt = "2026-05-18T08:00:00.000Z";
  const state = recordEarnedUnlock(
    recordChallengeCompletion(
      recordBlockingAttempt(
        recordAppSessionEnd(
          recordAppSessionStart(createDefaultRecoveryState(), checkedInAt),
          "2026-05-18T08:06:00.000Z"
        ),
        {
          ...createBlockingAttempt("https://pornhub.com/watch?token=release-smoke", "browser"),
          detectedAt: attemptedAt
        }
      ),
      challenge,
      challengedAt,
      undefined,
      "helped"
    ),
    challenge,
    {
      durationMinutes: 5,
      startedAt: unlockedAt
    }
  );

  return {
    consentVersion: ANALYTICS_CONSENT_VERSION,
    userOptedInAt: "2026-05-18T03:59:00.000Z",
    dataRetentionDays: 1,
    snapshot: buildRecoveryAnalyticsSnapshot(state, day)
  };
}

function assertSmokeRequestIsAggregateOnly(request: AnalyticsIngestionRequest) {
  const text = JSON.stringify(request);
  assert.equal(request.dataRetentionDays, 1);
  assert.equal(request.snapshot.schemaVersion, "aggregate-v5");
  assert.equal(request.snapshot.privacy.aggregateOnly, true);
  assert.equal(request.snapshot.privacy.excludesPrivateNotes, true);
  assert.equal(request.snapshot.privacy.excludesBrowsingDetails, true);
  assert.equal(request.snapshot.privacy.excludesSupportContacts, true);
  assert.equal(request.snapshot.productionMetrics.blockedAttempts, 1);
  assert.equal(request.snapshot.productionMetrics.challengeCompletions, 1);
  assert.equal(request.snapshot.productionMetrics.earnedUnlocks, 1);
  assert.equal(request.snapshot.productionMetrics.streakHistory.length, 7);
  assert.equal(
    request.snapshot.productionMetrics.streakHistory[request.snapshot.productionMetrics.streakHistory.length - 1]?.streakDays,
    request.snapshot.productionMetrics.currentStreakDays
  );
  assert.equal(text.includes("pornhub.com"), false);
  assert.equal(text.includes("release-smoke"), false);
  assert.equal(text.includes("token="), false);
  assert.equal(text.includes("raw-note"), false);
}

function summarizeAnalyticsSmokeRequest(request: AnalyticsIngestionRequest): AnalyticsIngestionSmokeReport["requestSummary"] {
  const metrics = request.snapshot.productionMetrics;
  return {
    consentVersion: request.consentVersion,
    dataRetentionDays: request.dataRetentionDays,
    snapshotSchemaVersion: request.snapshot.schemaVersion,
    generatedForDateKey: request.snapshot.generatedForDateKey,
    aggregateOnly: request.snapshot.privacy.aggregateOnly,
    blockedAttempts: metrics.blockedAttempts,
    challengeCompletions: metrics.challengeCompletions,
    earnedUnlocks: metrics.earnedUnlocks,
    appOpens: metrics.appOpens,
    foregroundMinutes: metrics.foregroundMinutes,
    streakHistoryDays: metrics.streakHistory.length,
    hourlyBucketCount: metrics.hourlyUrgePattern.length,
    challengeCategoryCount: Object.keys(metrics.challengeSuccessByCategory).length
  };
}

function resultPassed(results: SmokeResult[], id: string) {
  return results.some((entry) => entry.id === id && entry.status === "PASS");
}

function buildContractProof(
  request: AnalyticsIngestionRequest,
  results: SmokeResult[]
): AnalyticsIngestionSmokeReport["contractProof"] {
  const metrics = request.snapshot.productionMetrics;
  return {
    endpointPathRequired: "/api/analytics",
    requestTimeoutMs: readBoundedTimeoutMs(),
    acceptedAggregateSnapshot: {
      schemaVersion: request.snapshot.schemaVersion,
      consentVersion: request.consentVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      dataRetentionDays: request.dataRetentionDays,
      aggregateOnly: request.snapshot.privacy.aggregateOnly,
      privacyFlags: {
        excludesPrivateNotes: request.snapshot.privacy.excludesPrivateNotes,
        excludesBrowsingDetails: request.snapshot.privacy.excludesBrowsingDetails,
        excludesSupportContacts: request.snapshot.privacy.excludesSupportContacts
      },
      blockedAttemptSources: [...ANALYTICS_BLOCKED_ATTEMPT_SOURCES],
      streakHistoryDays: metrics.streakHistory.length,
      hourlyUrgeBuckets: metrics.hourlyUrgePattern.length,
      challengeCategories: metrics.challengeSuccessByCategory.map((entry) => entry.category)
    },
    rejectionProofs: {
      incompleteProductionMetricsRejected: resultPassed(results, "analytics-ingestion-incomplete-metrics-rejection"),
      futureConsentTimestampRejected: resultPassed(results, "analytics-ingestion-future-timestamp-rejection"),
      futureSnapshotDateRejected: resultPassed(results, "analytics-ingestion-future-timestamp-rejection"),
      sensitivePayloadRejectedWithoutEcho: resultPassed(results, "analytics-ingestion-sensitive-rejection")
    },
    responseBoundary: {
      snapshotEchoForbidden: true,
      privateEchoPatternsChecked: FORBIDDEN_RESPONSE_PATTERNS.length,
      secretValuesOmitted: true,
      serverSecretKeyNamesChecked: [...SERVER_SECRET_KEYS],
      sensitiveFieldAliasesRejected: ["private_notes", "rawURL", "purchase_token", "receiptData", "support_contacts"]
    }
  };
}

function assertAcceptedAnalyticsResponse(value: unknown, request: AnalyticsIngestionRequest) {
  const body = asRecord(value, "analytics ingestion response");
  assert.equal(body.accepted, true);
  assert.equal(body.status, "ok");
  assert.ok(ANALYTICS_PROVIDERS.has(String(body.provider)), "analytics provider must be supabase or custom");
  assert.equal(body.schemaVersion, request.snapshot.schemaVersion);
  assert.equal(body.generatedForDateKey, request.snapshot.generatedForDateKey);
  assert.equal(typeof body.receivedAt, "string");
  assert.ok(Number.isFinite(Date.parse(String(body.receivedAt))), "receivedAt must be a valid ISO timestamp");
  assert.equal(Object.prototype.hasOwnProperty.call(body, "snapshot"), false, "response must not echo analytics snapshot");
  assertNoPrivateEcho(body);
  return body;
}

function buildSensitiveRejectionRequest(request: AnalyticsIngestionRequest) {
  return {
    ...request,
    private_notes: "private relapse note",
    rawURL: "redacted-url-placeholder",
    purchase_token: "opaque-token-secret",
    receiptData: "opaque-receipt-secret",
    metadata: {
      userEmail: "redacted-user-value",
      support_contacts: [{ phoneNumber: "+15551234567" }]
    },
    attempts: [
      {
        url: "https://private.example.com/raw-note?token=secret",
        note: "private recovery note",
        contact: "support@example.com",
        purchaseToken: "purchase-token-secret"
      }
    ]
  };
}

function buildIncompleteMetricsRejectionRequest(request: AnalyticsIngestionRequest) {
  const snapshot = JSON.parse(JSON.stringify(request.snapshot)) as JsonRecord;
  const productionMetrics = asRecord(snapshot.productionMetrics, "analytics productionMetrics");
  delete productionMetrics.appOpens;
  productionMetrics.hourlyUrgePattern = (productionMetrics.hourlyUrgePattern as unknown[]).slice(0, 23);
  return {
    ...request,
    snapshot
  };
}

function buildFutureConsentRejectionRequest(request: AnalyticsIngestionRequest) {
  return {
    ...request,
    userOptedInAt: "2999-01-01T09:00:00.000Z"
  };
}

function buildFutureSnapshotRejectionRequest(request: AnalyticsIngestionRequest) {
  const snapshot = JSON.parse(JSON.stringify(request.snapshot)) as JsonRecord;
  snapshot.generatedForDateKey = "2999-01-07";
  return {
    ...request,
    snapshot
  };
}

function assertRejectedAnalyticsResponse(value: unknown, reasonPattern: RegExp) {
  const body = asRecord(value, "analytics rejection response");
  assert.equal(body.accepted, false);
  assert.equal(body.status, "invalid");
  assert.equal(body.provider, "invalid");
  assert.equal(typeof body.reason, "string");
  assert.match(String(body.reason), reasonPattern);
  assertNoPrivateEcho(body);
  return body;
}

function assertRejectedSensitiveResponse(value: unknown) {
  return assertRejectedAnalyticsResponse(value, /aggregate-only/i);
}

async function postAnalytics(endpoint: string, body: unknown, timeoutMs: number, label: string) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, timeoutMs, label);
  const payload = await readRemoteProviderJson(response, timeoutMs, `${label} response`);
  return { response, payload };
}

async function smokeAcceptedAnalytics(endpoint: string, request: AnalyticsIngestionRequest, timeoutMs: number) {
  const { response, payload } = await postAnalytics(endpoint, request, timeoutMs, "Analytics ingestion smoke request");
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload).slice(0, 240)}`);
  }
  return assertAcceptedAnalyticsResponse(payload, request);
}

async function smokeIncompleteMetricsRejection(endpoint: string, request: AnalyticsIngestionRequest, timeoutMs: number) {
  const { response, payload } = await postAnalytics(
    endpoint,
    buildIncompleteMetricsRejectionRequest(request),
    timeoutMs,
    "Analytics incomplete production-metrics rejection smoke request"
  );
  assert.equal(response.status, 400);
  return assertRejectedSensitiveResponse(payload);
}

async function smokeFutureTimestampRejection(endpoint: string, request: AnalyticsIngestionRequest, timeoutMs: number) {
  const futureConsent = await postAnalytics(
    endpoint,
    buildFutureConsentRejectionRequest(request),
    timeoutMs,
    "Analytics future consent timestamp rejection smoke request"
  );
  assert.equal(futureConsent.response.status, 400);
  assertRejectedAnalyticsResponse(futureConsent.payload, /userOptedInAt must not be in the future/i);

  const futureSnapshot = await postAnalytics(
    endpoint,
    buildFutureSnapshotRejectionRequest(request),
    timeoutMs,
    "Analytics future snapshot date rejection smoke request"
  );
  assert.equal(futureSnapshot.response.status, 400);
  return assertRejectedAnalyticsResponse(futureSnapshot.payload, /generatedForDateKey must not be in the future/i);
}

async function smokeSensitiveRejection(endpoint: string, request: AnalyticsIngestionRequest, timeoutMs: number) {
  const { response, payload } = await postAnalytics(
    endpoint,
    buildSensitiveRejectionRequest(request),
    timeoutMs,
    "Analytics sensitive-field rejection smoke request"
  );
  assert.equal(response.status, 400);
  return assertRejectedSensitiveResponse(payload);
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function buildSmokeReport(
  endpoint: string | null,
  request: AnalyticsIngestionRequest,
  results: SmokeResult[]
): AnalyticsIngestionSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  return {
    schemaVersion: "analytics-ingestion-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoint: sanitizeEndpointForReport(endpoint),
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    requestSummary: summarizeAnalyticsSmokeRequest(request),
    contractProof: buildContractProof(request, results),
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: AnalyticsIngestionSmokeReport) {
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

  const endpointResult = validateEndpoint(options.endpoint);
  const results: SmokeResult[] = [endpointResult];
  const request = buildAnalyticsSmokeRequest();
  assertSmokeRequestIsAggregateOnly(request);

  if (endpointResult.status === "PASS" && options.endpoint) {
    const timeoutMs = readBoundedTimeoutMs();
    try {
      const body = await smokeAcceptedAnalytics(options.endpoint, request, timeoutMs);
      results.push({
        id: "analytics-ingestion-aggregate-contract",
        status: "PASS",
        detail: `${String(body.provider)} accepted ${String(body.schemaVersion)} for ${String(body.generatedForDateKey)}`
      });
    } catch (error) {
      results.push({
        id: "analytics-ingestion-aggregate-contract",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown analytics ingestion failure"
      });
    }

    try {
      await smokeIncompleteMetricsRejection(options.endpoint, request, timeoutMs);
      results.push({
        id: "analytics-ingestion-incomplete-metrics-rejection",
        status: "PASS",
        detail: "incomplete production metrics rejected without echo"
      });
    } catch (error) {
      results.push({
        id: "analytics-ingestion-incomplete-metrics-rejection",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown analytics incomplete-metrics rejection failure"
      });
    }

    try {
      await smokeFutureTimestampRejection(options.endpoint, request, timeoutMs);
      results.push({
        id: "analytics-ingestion-future-timestamp-rejection",
        status: "PASS",
        detail: "future consent and snapshot dates rejected without echo"
      });
    } catch (error) {
      results.push({
        id: "analytics-ingestion-future-timestamp-rejection",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown analytics future-timestamp rejection failure"
      });
    }

    try {
      await smokeSensitiveRejection(options.endpoint, request, timeoutMs);
      results.push({ id: "analytics-ingestion-sensitive-rejection", status: "PASS", detail: "raw fields rejected without echo" });
    } catch (error) {
      results.push({
        id: "analytics-ingestion-sensitive-rejection",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown analytics rejection failure"
      });
    }
  }

  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(options.endpoint, request, results));
  }

  console.log("# FREED analytics ingestion smoke");
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
  const request = buildAnalyticsSmokeRequest();
  assertSmokeRequestIsAggregateOnly(request);
  const incompleteMetricsRequest = buildIncompleteMetricsRejectionRequest(request);
  const incompleteProductionMetrics = asRecord(incompleteMetricsRequest.snapshot.productionMetrics, "incomplete productionMetrics");
  assert.equal(Object.prototype.hasOwnProperty.call(incompleteProductionMetrics, "appOpens"), false);
  assert.equal((incompleteProductionMetrics.hourlyUrgePattern as unknown[]).length, 23);
  assertAcceptedAnalyticsResponse(
    {
      accepted: true,
      provider: "supabase",
      status: "ok",
      receivedAt: "2026-05-18T12:01:00.000Z",
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey
    },
    request
  );
  assertRejectedSensitiveResponse({
    accepted: false,
    provider: "invalid",
    status: "invalid",
    receivedAt: "2026-05-18T12:01:00.000Z",
    reason: "Analytics payload must be aggregate-only."
  });
  assert.throws(() =>
    assertRejectedSensitiveResponse({
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt: "2026-05-18T12:01:00.000Z",
      reason: "Do not send https://private.example.com/raw-note?token=secret"
    })
  );
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/analytics").status, "PASS");
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/backend/readiness").status, "FAIL");
  assert.equal(validateEndpoint("http://localhost:3000/api/analytics").status, "FAIL");
  assert.equal(validateEndpoint("https://example.com/api/analytics").status, "FAIL");
  const previousSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-present";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/analytics?token=secret",
    request,
    [{ id: "redaction", status: "FAIL", detail: "server-secret-present https://private.example.com/raw-note?token=secret private relapse note +15551234567 eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" }]
  );
  if (previousSecret === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousSecret;
  }
  const reportText = JSON.stringify(report);
  assert.equal(report.endpoint, "https://api.freedrecovery.app/api/analytics");
  assert.equal(report.sanitized, true);
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/analytics?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/analytics"
  );
  assert.equal(report.requestSummary.aggregateOnly, true);
  assert.equal(report.requestSummary.streakHistoryDays, 7);
  assert.equal(report.requestSummary.hourlyBucketCount, 24);
  assert.equal(report.contractProof.endpointPathRequired, "/api/analytics");
  assert.equal(report.contractProof.acceptedAggregateSnapshot.aggregateOnly, true);
  assert.deepEqual(report.contractProof.acceptedAggregateSnapshot.blockedAttemptSources, [...ANALYTICS_BLOCKED_ATTEMPT_SOURCES]);
  assert.equal(report.contractProof.acceptedAggregateSnapshot.hourlyUrgeBuckets, 24);
  assert.equal(report.contractProof.rejectionProofs.incompleteProductionMetricsRejected, false);
  assert.equal(report.contractProof.responseBoundary.snapshotEchoForbidden, true);
  assert.equal(report.contractProof.responseBoundary.secretValuesOmitted, true);
  assert.ok(report.contractProof.responseBoundary.serverSecretKeyNamesChecked.includes("SUPABASE_SERVICE_ROLE_KEY"));
  const passingReport = buildSmokeReport("https://api.freedrecovery.app/api/analytics", request, [
    { id: "analytics-ingestion-endpoint", status: "PASS", detail: "https://api.freedrecovery.app/api/analytics" },
    { id: "analytics-ingestion-aggregate-contract", status: "PASS", detail: "supabase accepted aggregate-v5" },
    { id: "analytics-ingestion-incomplete-metrics-rejection", status: "PASS", detail: "ok" },
    { id: "analytics-ingestion-future-timestamp-rejection", status: "PASS", detail: "ok" },
    { id: "analytics-ingestion-sensitive-rejection", status: "PASS", detail: "ok" }
  ]);
  assert.equal(passingReport.contractProof.rejectionProofs.incompleteProductionMetricsRejected, true);
  assert.equal(passingReport.contractProof.rejectionProofs.futureConsentTimestampRejected, true);
  assert.equal(passingReport.contractProof.rejectionProofs.futureSnapshotDateRejected, true);
  assert.equal(passingReport.contractProof.rejectionProofs.sensitivePayloadRejectedWithoutEcho, true);
  assert.equal(reportText.includes("server-secret-present"), false);
  assert.equal(reportText.includes("private.example.com"), false);
  assert.equal(reportText.includes("private relapse note"), false);
  assert.equal(reportText.includes("+15551234567"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/analytics-ingestion-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/analytics-ingestion-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("analytics-ingestion-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
