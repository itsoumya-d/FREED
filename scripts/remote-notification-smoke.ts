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

type JsonRecord = Record<string, unknown>;

type RemoteNotificationSmokeReport = {
  schemaVersion: "remote-notification-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoint: string | null;
  summary: {
    passCount: number;
    failCount: number;
  };
  dispatchBoundary: {
    sendsPush: false;
    unauthorizedRejectionChecked: boolean;
    sensitivePayloadRejectionChecked: boolean;
    supportedKindAllowlistChecked: boolean;
    requiresDispatchSecret: true;
    acceptedPayloadFields: string[];
    rejectedSensitiveFields: string[];
  };
  contractProof: {
    endpointPathRequired: "/api/notifications/send";
    requestTimeoutMs: number;
    nonSendingSmoke: true;
    authorizationBoundary: {
      requiresDispatchSecret: true;
      unauthorizedRequestRejected: boolean;
      dispatchSecretValuesOmitted: true;
      authorizationHeaderNotStored: true;
    };
    payloadBoundary: {
      acceptedPayloadFields: string[];
      supportedKinds: string[];
      presetCopyServerSideOnly: true;
      clientSuppliedCopyRejected: boolean;
      supportedKindAllowlistRejectedUnknown: boolean;
      sensitiveFieldAliasesRejected: string[];
    };
    responseBoundary: {
      providerCallsExpected: false;
      deviceTokenEchoForbidden: true;
      privateEchoPatternsChecked: number;
      secretValuesOmitted: true;
      serverSecretKeyNamesChecked: string[];
    };
  };
  results: SmokeResult[];
};

const DEFAULT_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS = 8_000;
const MIN_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS = 500;
const MAX_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS = 15_000;
const DERIVATION_ENDPOINT_KEYS = [
  "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT",
  "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
  "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
  "EXPO_PUBLIC_AI_COACH_ENDPOINT",
  "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
  "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
  "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT"
] as const;
const SMOKE_FCM_DEVICE_TOKEN = "fcmReleaseSmokeToken_1234567890:APA91bReleaseSmokeToken_abcdefghijklmnopqrstuvwxyz";
const FCM_DEVICE_TOKEN_ECHO_PATTERN = /\b[A-Za-z0-9:_-]{8,}:APA91[A-Za-z0-9:_-]{20,}\b/i;
const APNS_DEVICE_TOKEN_ECHO_PATTERN = /\b[A-Fa-f0-9]{64}\b/;
const FORBIDDEN_RESPONSE_PATTERNS = [
  /remote-notification-secret/i,
  /test-remote-notification-secret/i,
  /fcm-token/i,
  /apns-token/i,
  literalPattern(SMOKE_FCM_DEVICE_TOKEN, "i"),
  FCM_DEVICE_TOKEN_ECHO_PATTERN,
  APNS_DEVICE_TOKEN_ECHO_PATTERN,
  /https?:\/\/[^\s"'<>]+/i,
  /token=(?!redacted)[^"'&\s]+/i,
  /private\.example/i,
  /support@example\.com/i,
  /purchase-token/i,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/
];
const SERVER_SECRET_KEYS = [
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "FCM_SERVER_KEY",
  "FCM_ACCESS_TOKEN",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64"
] as const;
const ACCEPTED_PAYLOAD_FIELDS = ["platform", "token", "kind"] as const;
const SUPPORTED_NOTIFICATION_KINDS = [
  "morning-checkin",
  "evening-reflection",
  "night-guard",
  "challenge-followup",
  "streak-encouragement"
] as const;
const REJECTED_SENSITIVE_FIELDS = ["title", "body", "url", "note", "contact", "purchaseToken"] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function literalPattern(value: string, flags = "g") {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
}

function readBoundedTimeoutMs() {
  const raw = readEnv("FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS") ?? readEnv("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS;
  return Math.max(
    MIN_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS,
    Math.min(MAX_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS, Math.round(parsed))
  );
}

function parseArgs(argv: string[]) {
  const options = {
    endpoint: readConfiguredRemoteNotificationEndpoint(),
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
  console.log(`Usage: npm run smoke:remote-notifications -- [options]

Validates the deployed app/api/notifications/send route without sending a push.
The command derives /api/notifications/send from another deployed app endpoint
when possible, checks unauthorized rejection, then uses the server dispatch
secret only to prove unsupported notification kinds and private/raw notification
payload fields are rejected.

Options:
  --endpoint <url>              Deployed /api/notifications/send route.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function readConfiguredRemoteNotificationEndpoint() {
  const direct = readEnv("FREED_REMOTE_NOTIFICATION_SMOKE_ENDPOINT");
  if (direct) return direct;
  const source = DERIVATION_ENDPOINT_KEYS.map(readEnv).find(Boolean);
  return source ? deriveNotificationEndpoint(source) : null;
}

function deriveNotificationEndpoint(sourceEndpoint: string) {
  if (getProductionEndpointIssues(sourceEndpoint, "remote notification derivation source endpoint").length > 0) {
    return sourceEndpoint;
  }
  try {
    const parsed = new URL(sourceEndpoint);
    return new URL("/api/notifications/send", parsed.origin).toString();
  } catch {
    return sourceEndpoint;
  }
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object JSON body.`);
  }
  return value as JsonRecord;
}

function validateEndpoint(endpoint: string | null): SmokeResult {
  if (!endpoint) {
    return {
      id: "remote-notification-endpoint",
      status: "FAIL",
      detail: "FREED_REMOTE_NOTIFICATION_SMOKE_ENDPOINT is not configured and no deployed app endpoint could be used to derive it."
    };
  }

  const endpointIssues = getProductionEndpointIssues(endpoint, "remote notification endpoint").filter(
    (entry) => entry.issue !== "is not configured"
  );
  if (endpointIssues.length > 0) {
    return { id: "remote-notification-endpoint", status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }

  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/notifications/send" && !pathname.endsWith("/api/notifications/send")) {
      return {
        id: "remote-notification-endpoint",
        status: "FAIL",
        detail: "remote notification endpoint must target /api/notifications/send."
      };
    }
  } catch {
    return { id: "remote-notification-endpoint", status: "FAIL", detail: "remote notification endpoint is not a valid URL." };
  }

  return { id: "remote-notification-endpoint", status: "PASS", detail: endpoint };
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
    .replace(/token=(?!redacted)[^"'&\s]+/gi, "token=[redacted]")
    .replace(/\b(?:fcm|apns)-token-[A-Za-z0-9._-]+\b/gi, "[redacted-device-token]")
    .replace(literalPattern(SMOKE_FCM_DEVICE_TOKEN), "[redacted-device-token]")
    .replace(new RegExp(FCM_DEVICE_TOKEN_ECHO_PATTERN.source, "gi"), "[redacted-device-token]")
    .replace(new RegExp(APNS_DEVICE_TOKEN_ECHO_PATTERN.source, "g"), "[redacted-apns-token]")
    .replace(/\bpurchase-token-[A-Za-z0-9._-]+\b/gi, "[redacted-purchase-token]")
    .replace(/\bremote-notification-secret-[A-Za-z0-9._-]+\b/gi, "[redacted-dispatch-secret]")
    .replace(/\btest-remote-notification-secret-[A-Za-z0-9._-]+\b/gi, "[redacted-dispatch-secret]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
    .replace(/AAAA[A-Za-z0-9:_-]{20,}/g, "[redacted-fcm-key]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]");

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

function resultPassed(results: SmokeResult[], id: string) {
  return results.some((entry) => entry.id === id && entry.status === "PASS");
}

function buildContractProof(results: SmokeResult[]): RemoteNotificationSmokeReport["contractProof"] {
  return {
    endpointPathRequired: "/api/notifications/send",
    requestTimeoutMs: readBoundedTimeoutMs(),
    nonSendingSmoke: true,
    authorizationBoundary: {
      requiresDispatchSecret: true,
      unauthorizedRequestRejected: resultPassed(results, "remote-notification-unauthorized-rejection"),
      dispatchSecretValuesOmitted: true,
      authorizationHeaderNotStored: true
    },
    payloadBoundary: {
      acceptedPayloadFields: [...ACCEPTED_PAYLOAD_FIELDS],
      supportedKinds: [...SUPPORTED_NOTIFICATION_KINDS],
      presetCopyServerSideOnly: true,
      clientSuppliedCopyRejected: resultPassed(results, "remote-notification-sensitive-rejection"),
      supportedKindAllowlistRejectedUnknown: resultPassed(results, "remote-notification-supported-kind-rejection"),
      sensitiveFieldAliasesRejected: [...REJECTED_SENSITIVE_FIELDS]
    },
    responseBoundary: {
      providerCallsExpected: false,
      deviceTokenEchoForbidden: true,
      privateEchoPatternsChecked: FORBIDDEN_RESPONSE_PATTERNS.length,
      secretValuesOmitted: true,
      serverSecretKeyNamesChecked: [...SERVER_SECRET_KEYS]
    }
  };
}

function assertNoPrivateEcho(value: unknown, env: Record<string, string | undefined> = process.env) {
  const text = JSON.stringify(value);
  for (const pattern of FORBIDDEN_RESPONSE_PATTERNS) {
    assert.equal(pattern.test(text), false, `remote notification response echoed forbidden data: ${pattern}`);
  }
  const secret = env.REMOTE_NOTIFICATION_DISPATCH_SECRET?.trim();
  if (secret && secret.length >= 8) {
    assert.equal(text.includes(secret), false, "remote notification response echoed dispatch secret");
  }
}

function assertUnauthorizedResponse(value: unknown) {
  const body = asRecord(value, "remote notification unauthorized response");
  assert.equal(body.sent, false);
  assert.equal(body.provider, "fallback");
  assert.equal(body.status, "unauthorized");
  assert.match(String(body.reason ?? ""), /not authorized/i);
  assertNoPrivateEcho(body);
  return body;
}

function buildSensitiveRejectedRequest() {
  return {
    platform: "android",
    token: SMOKE_FCM_DEVICE_TOKEN,
    kind: "night-guard",
    title: "Caller supplied copy must be rejected",
    body: "Private streak detail should never be accepted",
    url: "https://private.example.com/raw-note?token=secret",
    note: "private recovery note",
    contact: "support@example.com",
    purchaseToken: "purchase-token-secret"
  };
}

function buildUnsupportedKindRejectedRequest() {
  return {
    platform: "android",
    token: SMOKE_FCM_DEVICE_TOKEN,
    kind: "marketing-blast"
  };
}

function assertRejectedSensitiveResponse(value: unknown) {
  const body = asRecord(value, "remote notification rejection response");
  assert.equal(body.sent, false);
  assert.equal(body.provider, "fallback");
  assert.equal(body.status, "invalid");
  assert.match(String(body.reason ?? ""), /platform, token, and a supported recovery-safe kind/i);
  assertNoPrivateEcho(body);
  return body;
}

async function postNotification(endpoint: string, body: unknown, timeoutMs: number, label: string, secret?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  }, timeoutMs, label);
  const payload = await readRemoteProviderJson(response, timeoutMs, `${label} response`);
  return { response, payload };
}

async function smokeUnauthorizedRejection(endpoint: string, timeoutMs: number) {
  const { response, payload } = await postNotification(
    endpoint,
    buildSensitiveRejectedRequest(),
    timeoutMs,
    "Remote notification unauthorized smoke request"
  );
  assert.equal(response.status, 401);
  return assertUnauthorizedResponse(payload);
}

async function smokeSensitiveRejection(endpoint: string, secret: string, timeoutMs: number) {
  const { response, payload } = await postNotification(
    endpoint,
    buildSensitiveRejectedRequest(),
    timeoutMs,
    "Remote notification sensitive-field rejection smoke request",
    secret
  );
  assert.equal(response.status, 400);
  return assertRejectedSensitiveResponse(payload);
}

async function smokeUnsupportedKindRejection(endpoint: string, secret: string, timeoutMs: number) {
  const { response, payload } = await postNotification(
    endpoint,
    buildUnsupportedKindRejectedRequest(),
    timeoutMs,
    "Remote notification unsupported-kind rejection smoke request",
    secret
  );
  assert.equal(response.status, 400);
  return assertRejectedSensitiveResponse(payload);
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function buildSmokeReport(endpoint: string | null, results: SmokeResult[]): RemoteNotificationSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  return {
    schemaVersion: "remote-notification-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoint: sanitizeEndpointForReport(endpoint),
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    dispatchBoundary: {
      sendsPush: false,
      unauthorizedRejectionChecked: results.some((entry) => entry.id === "remote-notification-unauthorized-rejection" && entry.status === "PASS"),
      sensitivePayloadRejectionChecked: results.some((entry) => entry.id === "remote-notification-sensitive-rejection" && entry.status === "PASS"),
      supportedKindAllowlistChecked: results.some((entry) => entry.id === "remote-notification-supported-kind-rejection" && entry.status === "PASS"),
      requiresDispatchSecret: true,
      acceptedPayloadFields: [...ACCEPTED_PAYLOAD_FIELDS],
      rejectedSensitiveFields: [...REJECTED_SENSITIVE_FIELDS]
    },
    contractProof: buildContractProof(results),
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: RemoteNotificationSmokeReport) {
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

  if (endpointResult.status === "PASS" && options.endpoint) {
    const timeoutMs = readBoundedTimeoutMs();
    try {
      await smokeUnauthorizedRejection(options.endpoint, timeoutMs);
      results.push({ id: "remote-notification-unauthorized-rejection", status: "PASS", detail: "unauthorized request rejected without echo" });
    } catch (error) {
      results.push({
        id: "remote-notification-unauthorized-rejection",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "unknown unauthorized rejection failure"
      });
    }

    const secret = readEnv("REMOTE_NOTIFICATION_DISPATCH_SECRET");
    if (!secret) {
      results.push({
        id: "remote-notification-sensitive-rejection",
        status: "FAIL",
        detail: "REMOTE_NOTIFICATION_DISPATCH_SECRET is not configured."
      });
      results.push({
        id: "remote-notification-supported-kind-rejection",
        status: "FAIL",
        detail: "REMOTE_NOTIFICATION_DISPATCH_SECRET is not configured."
      });
    } else {
      try {
        await smokeUnsupportedKindRejection(options.endpoint, secret, timeoutMs);
        results.push({
          id: "remote-notification-supported-kind-rejection",
          status: "PASS",
          detail: "unsupported notification kind rejected without sending"
        });
      } catch (error) {
        results.push({
          id: "remote-notification-supported-kind-rejection",
          status: "FAIL",
          detail: error instanceof Error ? error.message : "unknown unsupported-kind rejection failure"
        });
      }

      try {
        await smokeSensitiveRejection(options.endpoint, secret, timeoutMs);
        results.push({ id: "remote-notification-sensitive-rejection", status: "PASS", detail: "raw payload fields rejected without sending" });
      } catch (error) {
        results.push({
          id: "remote-notification-sensitive-rejection",
          status: "FAIL",
          detail: error instanceof Error ? error.message : "unknown sensitive-field rejection failure"
        });
      }
    }
  }

  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(options.endpoint, results));
  }

  console.log("# FREED remote notification smoke");
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
  assert.equal(
    deriveNotificationEndpoint("https://api.freedrecovery.app/api/backend/readiness"),
    "https://api.freedrecovery.app/api/notifications/send"
  );
  assert.equal(
    deriveNotificationEndpoint("https://api.freedrecovery.app/api/backend/readiness?token=secret"),
    "https://api.freedrecovery.app/api/backend/readiness?token=secret"
  );
  assert.match(
    validateEndpoint(deriveNotificationEndpoint("https://api.freedrecovery.app/api/backend/readiness?token=secret")).detail,
    /must not include query strings/
  );
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/notifications/send").status, "PASS");
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/analytics").status, "FAIL");
  assert.equal(validateEndpoint("http://localhost:3000/api/notifications/send").status, "FAIL");
  assert.equal(validateEndpoint("https://example.com/api/notifications/send").status, "FAIL");
  assertUnauthorizedResponse({
    sent: false,
    provider: "fallback",
    status: "unauthorized",
    reason: "Remote notification dispatch is not authorized."
  });
  assertRejectedSensitiveResponse({
    sent: false,
    provider: "fallback",
    status: "invalid",
    reason: "Remote notification payload must contain only platform, token, and a supported recovery-safe kind."
  });
  assert.throws(() =>
    assertRejectedSensitiveResponse({
      sent: false,
      provider: "fallback",
      status: "invalid",
      reason: "Do not echo fcm-token-release-smoke-private"
    })
  );
  assert.throws(() =>
    assertRejectedSensitiveResponse({
      sent: false,
      provider: "fallback",
      status: "invalid",
      reason: `Do not echo ${SMOKE_FCM_DEVICE_TOKEN}`
    })
  );
  assert.throws(() =>
    assertRejectedSensitiveResponse({
      sent: false,
      provider: "fallback",
      status: "invalid",
      reason: "Do not echo 1234567890abcdef:APA91providerEchoDeviceTokenSecretValue"
    })
  );
  assert.doesNotThrow(() =>
    assertRejectedSensitiveResponse({
      sent: false,
      provider: "fallback",
      status: "invalid",
      reason: "Remote notification payload must contain only platform, token, and a supported recovery-safe kind."
    })
  );
  const previousDispatchSecret = process.env.REMOTE_NOTIFICATION_DISPATCH_SECRET;
  process.env.REMOTE_NOTIFICATION_DISPATCH_SECRET = "remote-notification-secret-123456";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/notifications/send?token=secret",
    [
      { id: "remote-notification-endpoint", status: "PASS", detail: "https://api.freedrecovery.app/api/notifications/send?token=secret" },
      { id: "remote-notification-unauthorized-rejection", status: "PASS", detail: `fcm-token-release-smoke-private ${SMOKE_FCM_DEVICE_TOKEN} private.example.com` },
      { id: "remote-notification-supported-kind-rejection", status: "PASS", detail: "marketing-blast fcm-token-release-smoke-private" },
      { id: "remote-notification-sensitive-rejection", status: "PASS", detail: "remote-notification-secret-123456 purchase-token-secret eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" }
    ]
  );
  if (previousDispatchSecret === undefined) {
    delete process.env.REMOTE_NOTIFICATION_DISPATCH_SECRET;
  } else {
    process.env.REMOTE_NOTIFICATION_DISPATCH_SECRET = previousDispatchSecret;
  }
  const reportText = JSON.stringify(report);
  assert.equal(report.endpoint, "https://api.freedrecovery.app/api/notifications/send");
  assert.equal(report.sanitized, true);
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/notifications/send?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/notifications/send"
  );
  assert.equal(report.dispatchBoundary.sendsPush, false);
  assert.equal(report.dispatchBoundary.unauthorizedRejectionChecked, true);
  assert.equal(report.dispatchBoundary.supportedKindAllowlistChecked, true);
  assert.equal(report.dispatchBoundary.sensitivePayloadRejectionChecked, true);
  assert.equal(report.contractProof.endpointPathRequired, "/api/notifications/send");
  assert.equal(report.contractProof.nonSendingSmoke, true);
  assert.equal(report.contractProof.authorizationBoundary.unauthorizedRequestRejected, true);
  assert.equal(report.contractProof.authorizationBoundary.authorizationHeaderNotStored, true);
  assert.deepEqual(report.contractProof.payloadBoundary.acceptedPayloadFields, [...ACCEPTED_PAYLOAD_FIELDS]);
  assert.ok(report.contractProof.payloadBoundary.supportedKinds.includes("night-guard"));
  assert.equal(report.contractProof.payloadBoundary.clientSuppliedCopyRejected, true);
  assert.equal(report.contractProof.payloadBoundary.supportedKindAllowlistRejectedUnknown, true);
  assert.equal(report.contractProof.responseBoundary.providerCallsExpected, false);
  assert.equal(report.contractProof.responseBoundary.deviceTokenEchoForbidden, true);
  assert.equal(report.contractProof.responseBoundary.secretValuesOmitted, true);
  assert.ok(report.contractProof.responseBoundary.serverSecretKeyNamesChecked.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"));
  assert.equal(reportText.includes("fcm-token-release-smoke-private"), false);
  assert.equal(reportText.includes(SMOKE_FCM_DEVICE_TOKEN), false);
  assert.equal(reportText.includes("remote-notification-secret-123456"), false);
  assert.equal(reportText.includes("purchase-token-secret"), false);
  assert.equal(reportText.includes("private.example.com"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/remote-notification-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/remote-notification-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("remote-notification-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
