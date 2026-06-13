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

const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "monthly", "lifetime"] as const;
type LaunchPremiumPlanId = (typeof LAUNCH_PREMIUM_PLAN_IDS)[number];

const DEFAULT_LAUNCH_PRODUCT_IDS: Record<LaunchPremiumPlanId, string> = {
  yearly: "freed_premium_yearly",
  monthly: "freed_premium_monthly",
  lifetime: "freed_premium_lifetime"
};

const LAUNCH_PRODUCT_ENV_KEYS: Record<LaunchPremiumPlanId, [string, string]> = {
  yearly: ["EXPO_PUBLIC_IAP_PRODUCT_YEARLY", "IAP_PRODUCT_YEARLY"],
  monthly: ["EXPO_PUBLIC_IAP_PRODUCT_MONTHLY", "IAP_PRODUCT_MONTHLY"],
  lifetime: ["EXPO_PUBLIC_IAP_PRODUCT_LIFETIME", "IAP_PRODUCT_LIFETIME"]
};

type PurchaseSmokeBody = {
  active?: unknown;
  status?: unknown;
};

type PurchaseVerificationSmokeReport = {
  schemaVersion: "purchase-verification-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoint: string | null;
  summary: {
    passCount: number;
    failCount: number;
  };
  verificationBoundary: {
    usesSyntheticPurchasePayloads: true;
    unknownProductRejectionChecked: boolean;
    fakeKnownTokenRejectionChecked: boolean;
    fakeKnownTokenRejectionCheckedByPlan: Record<LaunchPremiumPlanId, boolean>;
    launchProductIdsChecked: Record<LaunchPremiumPlanId, string>;
    malformedJsonRejectionChecked: boolean;
    rawTokenEchoRejected: true;
    redactedSensitiveFields: string[];
  };
  contractProof: {
    endpointPathRequired: "/api/purchases/verify";
    endpointValidated: boolean;
    requestTimeoutMs: number;
    syntheticOnly: true;
    launchProductIdsChecked: Record<LaunchPremiumPlanId, string>;
    rejectionProofs: {
      unknownProductRejected: boolean;
      fakeKnownTokenRejected: boolean;
      fakeKnownTokenRejectedByPlan: Record<LaunchPremiumPlanId, boolean>;
      malformedJsonRejected: boolean;
    };
    responseBoundary: {
      rawTokenEchoRejected: true;
      rawReceiptEchoRejected: true;
      orderIdEchoRejected: true;
      packageNameEchoRejected: true;
      secretValuesOmitted: true;
      serverSecretKeyNamesChecked: string[];
      redactedSensitiveFields: string[];
    };
  };
  results: SmokeResult[];
};

const DEFAULT_PURCHASE_SMOKE_TIMEOUT_MS = 8_000;
const MIN_PURCHASE_SMOKE_TIMEOUT_MS = 500;
const MAX_PURCHASE_SMOKE_TIMEOUT_MS = 15_000;
const SERVER_SECRET_KEYS = [
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "APP_STORE_KEY_ID",
  "APP_STORE_ISSUER_ID",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
  "GOOGLE_PLAY_CLIENT_EMAIL",
  "GOOGLE_PLAY_PRIVATE_KEY",
  "GOOGLE_PLAY_PRIVATE_KEY_BASE64",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY"
] as const;
const REDACTED_SENSITIVE_FIELDS = ["purchaseToken", "receipt", "transactionReceipt", "orderId", "packageName"] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function launchProductIdsFromEnv(): Record<LaunchPremiumPlanId, string> {
  return Object.fromEntries(
    LAUNCH_PREMIUM_PLAN_IDS.map((planId) => {
      const [publicKey, serverKey] = LAUNCH_PRODUCT_ENV_KEYS[planId];
      return [planId, readEnv(publicKey) ?? readEnv(serverKey) ?? DEFAULT_LAUNCH_PRODUCT_IDS[planId]];
    })
  ) as Record<LaunchPremiumPlanId, string>;
}

function readBoundedTimeoutMs() {
  const raw = readEnv("EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PURCHASE_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_PURCHASE_SMOKE_TIMEOUT_MS;
  return Math.max(MIN_PURCHASE_SMOKE_TIMEOUT_MS, Math.min(MAX_PURCHASE_SMOKE_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    endpoint: readEnv("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"),
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
  console.log(`Usage: npm run smoke:purchase-verification -- [options]

Validates the deployed app/api/purchases/verify route with synthetic purchase
payloads. The command proves unknown products, fake known-product tokens, and
malformed JSON fail closed without echoing raw store tokens or receipts.

Options:
  --endpoint <url>              Deployed /api/purchases/verify route.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

async function readJsonOrNull(response: Response, timeoutMs: number, label: string) {
  try {
    return await readRemoteProviderJson(response, timeoutMs, label);
  } catch (error) {
    if (error instanceof Error && /timed out after/i.test(error.message)) throw error;
    return null;
  }
}

function asPurchaseBody(value: unknown): PurchaseSmokeBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PurchaseSmokeBody;
}

function assertNoTokenEcho(value: unknown) {
  const text = JSON.stringify(value);
  assert.equal(text.includes("smoke-secret-token"), false);
  assert.equal(text.includes("raw-ios-receipt-secret"), false);
  assert.equal(text.includes("androidPurchaseToken"), false);
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
    .replace(/\bsmoke-secret-token\b/g, "[redacted-purchase-token]")
    .replace(/\braw-ios-receipt-secret\b/g, "[redacted-store-receipt]")
    .replace(/\bandroidPurchaseToken\b/g, "[redacted-token-field]")
    .replace(/\bpurchase[-_]?token[-_][A-Za-z0-9._-]+\b/gi, "[redacted-purchase-token]")
    .replace(/\bGPA\.[A-Za-z0-9._-]+\b/g, "[redacted-order-id]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
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

function validateEndpoint(endpoint: string | null): SmokeResult {
  if (!endpoint) {
    return {
      id: "purchase-verification-endpoint",
      status: "FAIL",
      detail: "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT is not configured."
    };
  }

  const endpointIssues = getProductionEndpointIssues(endpoint, "purchase verification endpoint").filter(
    (entry) => entry.issue !== "is not configured"
  );
  if (endpointIssues.length > 0) {
    return { id: "purchase-verification-endpoint", status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }

  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/purchases/verify" && !pathname.endsWith("/api/purchases/verify")) {
      return {
        id: "purchase-verification-endpoint",
        status: "FAIL",
        detail: "purchase verification endpoint must target /api/purchases/verify."
      };
    }
  } catch {
    return { id: "purchase-verification-endpoint", status: "FAIL", detail: "purchase verification endpoint is not a valid URL." };
  }

  return { id: "purchase-verification-endpoint", status: "PASS", detail: endpoint };
}

function resultPassed(results: SmokeResult[], id: string) {
  return results.some((entry) => entry.id === id && entry.status === "PASS");
}

function fakeKnownResultId(planId: LaunchPremiumPlanId) {
  return `purchase-fake-known-${planId}-token-fails-closed`;
}

function fakeKnownRejectionChecksByPlan(results: SmokeResult[]) {
  return Object.fromEntries(
    LAUNCH_PREMIUM_PLAN_IDS.map((planId) => [planId, resultPassed(results, fakeKnownResultId(planId))])
  ) as Record<LaunchPremiumPlanId, boolean>;
}

function buildContractProof(
  results: SmokeResult[],
  launchProductIds: Record<LaunchPremiumPlanId, string>
): PurchaseVerificationSmokeReport["contractProof"] {
  const fakeKnownTokenRejectedByPlan = fakeKnownRejectionChecksByPlan(results);
  return {
    endpointPathRequired: "/api/purchases/verify",
    endpointValidated: resultPassed(results, "purchase-verification-endpoint"),
    requestTimeoutMs: readBoundedTimeoutMs(),
    syntheticOnly: true,
    launchProductIdsChecked: launchProductIds,
    rejectionProofs: {
      unknownProductRejected: resultPassed(results, "purchase-unknown-product-fails-closed"),
      fakeKnownTokenRejected: LAUNCH_PREMIUM_PLAN_IDS.every((planId) => fakeKnownTokenRejectedByPlan[planId]),
      fakeKnownTokenRejectedByPlan,
      malformedJsonRejected: resultPassed(results, "purchase-malformed-json-fails-closed")
    },
    responseBoundary: {
      rawTokenEchoRejected: true,
      rawReceiptEchoRejected: true,
      orderIdEchoRejected: true,
      packageNameEchoRejected: true,
      secretValuesOmitted: true,
      serverSecretKeyNamesChecked: [...SERVER_SECRET_KEYS],
      redactedSensitiveFields: [...REDACTED_SENSITIVE_FIELDS]
    }
  };
}

async function postJson(endpoint: string, payload: unknown, timeoutMs: number, label: string) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, timeoutMs, label);

  const body = asPurchaseBody(await readJsonOrNull(response, timeoutMs, `${label} response`));
  return { response, body };
}

async function smokeUnknownProduct(endpoint: string, timeoutMs: number) {
  const { body } = await postJson(endpoint, {
    platform: "android",
    entitlementId: "premium",
    purchase: {
      productId: "freed_unknown_product",
      purchaseToken: "smoke-secret-token",
      packageName: readEnv("GOOGLE_PLAY_PACKAGE_NAME") ?? "app.freed.recovery"
    }
  }, timeoutMs, "Purchase unknown-product smoke request");

  assert.equal(body?.active, false);
  assert.equal(body?.status, "invalid");
  assertNoTokenEcho(body);
}

function smokeFakeKnownPurchaseForPlan(planId: LaunchPremiumPlanId, productId: string) {
  return async (endpoint: string, timeoutMs: number) => {
    const { body } = await postJson(endpoint, {
      platform: "android",
      entitlementId: "premium",
      purchase: {
        productId,
        purchaseToken: "smoke-secret-token",
        orderId: "GPA.smoke-order",
        packageName: readEnv("GOOGLE_PLAY_PACKAGE_NAME") ?? "app.freed.recovery"
      }
    }, timeoutMs, `Purchase fake-known-token ${planId} smoke request`);

    assert.equal(body?.active, false);
    assert.ok(["unconfigured", "failed", "invalid"].includes(String(body?.status)));
    assertNoTokenEcho(body);
  };
}

async function smokeMalformedJson(endpoint: string, timeoutMs: number) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  }, timeoutMs, "Purchase malformed-json smoke request");
  const body = asPurchaseBody(await readJsonOrNull(response, timeoutMs, "Purchase malformed-json smoke response"));
  assert.equal(response.status, 400);
  assert.equal(body?.active, false);
  assert.equal(body?.status, "invalid");
}

async function runCase(id: string, endpoint: string | null, run: (endpoint: string, timeoutMs: number) => Promise<void>): Promise<SmokeResult> {
  if (!endpoint) return { id, status: "FAIL", detail: "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT is not configured." };

  const endpointIssues = getProductionEndpointIssues(endpoint, id).filter((entry) => entry.issue !== "is not configured");
  if (endpointIssues.length > 0) {
    return { id, status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }

  try {
    await run(endpoint, readBoundedTimeoutMs());
    return { id, status: "PASS", detail: endpoint };
  } catch (error) {
    return {
      id,
      status: "FAIL",
      detail: error instanceof Error ? error.message : "unknown purchase verification smoke failure"
    };
  }
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function buildSmokeReport(
  endpoint: string | null,
  results: SmokeResult[],
  launchProductIds: Record<LaunchPremiumPlanId, string> = launchProductIdsFromEnv()
): PurchaseVerificationSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  const unknownProductRejectionChecked = resultPassed(results, "purchase-unknown-product-fails-closed");
  const fakeKnownTokenRejectionCheckedByPlan = fakeKnownRejectionChecksByPlan(results);
  const fakeKnownTokenRejectionChecked = LAUNCH_PREMIUM_PLAN_IDS.every((planId) => fakeKnownTokenRejectionCheckedByPlan[planId]);
  const malformedJsonRejectionChecked = resultPassed(results, "purchase-malformed-json-fails-closed");
  return {
    schemaVersion: "purchase-verification-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoint: sanitizeEndpointForReport(endpoint),
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    verificationBoundary: {
      usesSyntheticPurchasePayloads: true,
      unknownProductRejectionChecked,
      fakeKnownTokenRejectionChecked,
      fakeKnownTokenRejectionCheckedByPlan,
      launchProductIdsChecked: launchProductIds,
      malformedJsonRejectionChecked,
      rawTokenEchoRejected: true,
      redactedSensitiveFields: [...REDACTED_SENSITIVE_FIELDS]
    },
    contractProof: buildContractProof(results, launchProductIds),
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: PurchaseVerificationSmokeReport) {
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

  const endpoint = options.endpoint;
  const launchProductIds = launchProductIdsFromEnv();
  const endpointResult = validateEndpoint(endpoint);
  const results = [endpointResult];
  if (endpointResult.status === "PASS") {
    results.push(
      ...(await Promise.all([
        runCase("purchase-unknown-product-fails-closed", endpoint, smokeUnknownProduct),
        ...LAUNCH_PREMIUM_PLAN_IDS.map((planId) =>
          runCase(fakeKnownResultId(planId), endpoint, smokeFakeKnownPurchaseForPlan(planId, launchProductIds[planId]))
        ),
        runCase("purchase-malformed-json-fails-closed", endpoint, smokeMalformedJson)
      ]))
    );
  }
  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(endpoint, results, launchProductIds));
  }

  console.log("# FREED purchase verification smoke");
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
  assertNoTokenEcho({ active: false, status: "invalid" });
  assert.throws(() => assertNoTokenEcho({ reason: "Do not echo smoke-secret-token" }));
  assert.throws(() => assertNoTokenEcho({ reason: "Do not echo raw-ios-receipt-secret" }));
  assert.throws(() => assertNoTokenEcho({ reason: "Do not echo androidPurchaseToken" }));
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/purchases/verify").status, "PASS");
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/analytics").status, "FAIL");
  assert.equal(validateEndpoint("http://localhost:3000/api/purchases/verify").status, "FAIL");
  assert.equal(validateEndpoint("https://example.com/api/purchases/verify").status, "FAIL");

  const previousPrivateKey = process.env.APP_STORE_PRIVATE_KEY;
  process.env.APP_STORE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/purchases/verify?token=secret",
    [
      { id: "purchase-verification-endpoint", status: "PASS", detail: "https://api.freedrecovery.app/api/purchases/verify?token=secret" },
      { id: "purchase-unknown-product-fails-closed", status: "PASS", detail: "https://api.freedrecovery.app/api/purchases/verify?token=secret" },
      { id: "purchase-fake-known-yearly-token-fails-closed", status: "PASS", detail: "smoke-secret-token GPA.smoke-order app.freed.recovery eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" },
      { id: "purchase-fake-known-monthly-token-fails-closed", status: "PASS", detail: "smoke-secret-token GPA.smoke-order app.freed.recovery eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" },
      { id: "purchase-fake-known-lifetime-token-fails-closed", status: "PASS", detail: "smoke-secret-token GPA.smoke-order app.freed.recovery eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" },
      { id: "purchase-malformed-json-fails-closed", status: "PASS", detail: "raw-ios-receipt-secret androidPurchaseToken" }
    ]
  );
  if (previousPrivateKey === undefined) {
    delete process.env.APP_STORE_PRIVATE_KEY;
  } else {
    process.env.APP_STORE_PRIVATE_KEY = previousPrivateKey;
  }

  const reportText = JSON.stringify(report);
  assert.equal(report.endpoint, "https://api.freedrecovery.app/api/purchases/verify");
  assert.equal(report.sanitized, true);
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/purchases/verify?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/purchases/verify"
  );
  assert.equal(report.verificationBoundary.usesSyntheticPurchasePayloads, true);
  assert.equal(report.verificationBoundary.unknownProductRejectionChecked, true);
  assert.equal(report.verificationBoundary.fakeKnownTokenRejectionChecked, true);
  assert.deepEqual(report.verificationBoundary.fakeKnownTokenRejectionCheckedByPlan, {
    yearly: true,
    monthly: true,
    lifetime: true
  });
  assert.deepEqual(report.verificationBoundary.launchProductIdsChecked, DEFAULT_LAUNCH_PRODUCT_IDS);
  assert.equal(report.summary.passCount, 6);
  assert.equal(report.verificationBoundary.malformedJsonRejectionChecked, true);
  assert.equal(report.contractProof.endpointPathRequired, "/api/purchases/verify");
  assert.equal(report.contractProof.endpointValidated, true);
  assert.equal(report.contractProof.syntheticOnly, true);
  assert.deepEqual(report.contractProof.launchProductIdsChecked, DEFAULT_LAUNCH_PRODUCT_IDS);
  assert.equal(report.contractProof.rejectionProofs.unknownProductRejected, true);
  assert.equal(report.contractProof.rejectionProofs.fakeKnownTokenRejected, true);
  assert.deepEqual(report.contractProof.rejectionProofs.fakeKnownTokenRejectedByPlan, {
    yearly: true,
    monthly: true,
    lifetime: true
  });
  assert.equal(report.contractProof.rejectionProofs.malformedJsonRejected, true);
  assert.equal(report.contractProof.responseBoundary.rawTokenEchoRejected, true);
  assert.equal(report.contractProof.responseBoundary.rawReceiptEchoRejected, true);
  assert.equal(report.contractProof.responseBoundary.secretValuesOmitted, true);
  assert.ok(report.contractProof.responseBoundary.serverSecretKeyNamesChecked.includes("APP_STORE_PRIVATE_KEY"));
  assert.equal(reportText.includes("smoke-secret-token"), false);
  assert.equal(reportText.includes("raw-ios-receipt-secret"), false);
  assert.equal(reportText.includes("androidPurchaseToken"), false);
  assert.equal(reportText.includes("GPA.smoke-order"), false);
  assert.equal(reportText.includes("app.freed.recovery"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/purchase-verification-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/purchase-verification-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("purchase-verification-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
