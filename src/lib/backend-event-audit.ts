import { createHash } from "node:crypto";
import {
  fetchBackendProviderResponse,
  readBackendProviderTimeoutMs
} from "@/lib/backend-provider-timeout";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { redactOperationalText } from "@/lib/operational-redaction";
import { isSupabaseServiceRoleKey } from "@/lib/server-credential-safety";

type Env = Record<string, string | undefined>;

export type BackendAuditRecordResult = {
  recorded: boolean;
  provider: "supabase" | "custom" | "unconfigured" | "invalid" | "error";
  status: "ok" | "unconfigured" | "invalid" | "error";
  tableName?: string;
  reason?: string;
};

export type PurchaseVerificationAuditEvent = {
  platform: "ios" | "android";
  storeEnvironment: "sandbox" | "production";
  productId: string;
  entitlementId: string;
  verificationStatus: "granted" | "rejected" | "error";
  transactionId?: string | null;
  orderId?: string | null;
  purchaseToken?: string | null;
  failureCode?: string | null;
  verifiedAt?: string;
};

export type PurchaseVerificationAuditRecord = {
  platform: "ios" | "android";
  storeEnvironment: "sandbox" | "production";
  productId: string;
  entitlementId: string;
  verificationStatus: "granted" | "rejected" | "error";
  transactionIdHash: string | null;
  orderIdHash: string | null;
  purchaseTokenHash: string | null;
  failureCode: string | null;
  verifiedAt: string;
};

export type AiBackendAuditEvent = {
  route: "clara" | "challenges" | "retention" | "smoke";
  provider: string;
  model: string;
  requestKind: string;
  safetyEvalPassed?: boolean | null;
  redactionPassed?: boolean;
  crisisFallbackUsed?: boolean;
  promptTokenCount?: number | null;
  responseTokenCount?: number | null;
  payloadSummary?: Record<string, unknown>;
  receivedAt?: string;
};

export type PurchaseVerificationAuditProvider = (
  event: PurchaseVerificationAuditRecord
) => Promise<BackendAuditRecordResult> | BackendAuditRecordResult;

export type AiBackendAuditProvider = (
  event: AiBackendAuditEvent
) => Promise<BackendAuditRecordResult> | BackendAuditRecordResult;

let purchaseVerificationAuditProvider: PurchaseVerificationAuditProvider | null = null;
let aiBackendAuditProvider: AiBackendAuditProvider | null = null;

const FORBIDDEN_SUMMARY_KEYS = [
  "rawPrompt",
  "prompt",
  "privateNotes",
  "note",
  "notes",
  "transcript",
  "url",
  "urls",
  "host",
  "hosts",
  "domain",
  "domains",
  "receipt",
  "purchaseToken",
  "token",
  "apiKey",
  "serviceRoleKey"
];

export function configurePurchaseVerificationAuditProvider(provider: PurchaseVerificationAuditProvider | null) {
  purchaseVerificationAuditProvider = provider;
}

export function configureAiBackendAuditProvider(provider: AiBackendAuditProvider | null) {
  aiBackendAuditProvider = provider;
}

export async function recordPurchaseVerificationEvent(
  event: PurchaseVerificationAuditEvent,
  options: { env?: Env } = {}
): Promise<BackendAuditRecordResult> {
  const sanitized = sanitizePurchaseVerificationAuditEvent(event);
  if (!sanitized) return invalidResult("Purchase verification audit event is invalid.");
  const record = buildPurchaseVerificationAuditRecord(sanitized);
  if (purchaseVerificationAuditProvider) return purchaseVerificationAuditProvider(record);

  return postSupabase(options.env ?? process.env, readEnv(options.env ?? process.env, "SUPABASE_PURCHASE_AUDIT_TABLE") ?? "purchase_verification_events", {
    platform: record.platform,
    store_environment: record.storeEnvironment,
    product_id: record.productId,
    entitlement_id: record.entitlementId,
    verification_status: record.verificationStatus,
    transaction_id_hash: record.transactionIdHash,
    order_id_hash: record.orderIdHash,
    purchase_token_hash: record.purchaseTokenHash,
    failure_code: record.failureCode,
    verified_at: record.verifiedAt
  });
}

export async function recordAiBackendEvent(
  event: AiBackendAuditEvent,
  options: { env?: Env } = {}
): Promise<BackendAuditRecordResult> {
  const sanitized = sanitizeAiBackendAuditEvent(event);
  if (!sanitized) return invalidResult("AI backend audit event is invalid.");
  if (aiBackendAuditProvider) return aiBackendAuditProvider(sanitized);

  return postSupabase(options.env ?? process.env, readEnv(options.env ?? process.env, "SUPABASE_AI_EVENTS_TABLE") ?? "ai_backend_events", {
    route: sanitized.route,
    provider: sanitized.provider,
    model: sanitized.model,
    request_kind: sanitized.requestKind,
    safety_eval_passed: sanitized.safetyEvalPassed,
    redaction_passed: sanitized.redactionPassed,
    crisis_fallback_used: sanitized.crisisFallbackUsed,
    prompt_token_count: cleanNullableCount(sanitized.promptTokenCount, 50_000),
    response_token_count: cleanNullableCount(sanitized.responseTokenCount, 50_000),
    payload_summary: sanitized.payloadSummary,
    received_at: sanitized.receivedAt
  });
}

function sanitizePurchaseVerificationAuditEvent(event: PurchaseVerificationAuditEvent): PurchaseVerificationAuditEvent | null {
  const platform = event.platform === "ios" || event.platform === "android" ? event.platform : null;
  const storeEnvironment = event.storeEnvironment === "sandbox" ? "sandbox" : event.storeEnvironment === "production" ? "production" : null;
  const verificationStatus =
    event.verificationStatus === "granted" || event.verificationStatus === "rejected" || event.verificationStatus === "error"
      ? event.verificationStatus
      : null;
  const productId = cleanText(event.productId, 512);
  const entitlementId = cleanToken(event.entitlementId, 80);
  if (!platform || !storeEnvironment || !verificationStatus || !productId || !entitlementId) return null;

  return {
    platform,
    storeEnvironment,
    productId,
    entitlementId,
    verificationStatus,
    transactionId: cleanText(event.transactionId ?? "", 512) || null,
    orderId: cleanText(event.orderId ?? "", 512) || null,
    purchaseToken: cleanText(event.purchaseToken ?? "", 4_000) || null,
    failureCode: cleanToken(event.failureCode ?? "", 120) || null,
    verifiedAt: cleanIsoTime(event.verifiedAt) ?? new Date().toISOString()
  };
}

function buildPurchaseVerificationAuditRecord(event: PurchaseVerificationAuditEvent): PurchaseVerificationAuditRecord {
  return {
    platform: event.platform,
    storeEnvironment: event.storeEnvironment,
    productId: event.productId,
    entitlementId: event.entitlementId,
    verificationStatus: event.verificationStatus,
    transactionIdHash: sha256Hash(event.transactionId),
    orderIdHash: sha256Hash(event.orderId),
    purchaseTokenHash: sha256Hash(event.purchaseToken),
    failureCode: event.failureCode ?? null,
    verifiedAt: event.verifiedAt ?? new Date().toISOString()
  };
}

function sanitizeAiBackendAuditEvent(event: AiBackendAuditEvent): AiBackendAuditEvent | null {
  const route = ["clara", "challenges", "retention", "smoke"].includes(event.route) ? event.route : null;
  const provider = cleanToken(event.provider, 40);
  const model = cleanToken(event.model, 80) || "unconfigured";
  const requestKind = cleanToken(event.requestKind, 64);
  if (!route || !provider || !requestKind) return null;

  return {
    route,
    provider,
    model,
    requestKind,
    safetyEvalPassed: typeof event.safetyEvalPassed === "boolean" ? event.safetyEvalPassed : null,
    redactionPassed: event.redactionPassed !== false,
    crisisFallbackUsed: Boolean(event.crisisFallbackUsed),
    promptTokenCount: cleanNullableCount(event.promptTokenCount, 50_000),
    responseTokenCount: cleanNullableCount(event.responseTokenCount, 50_000),
    payloadSummary: sanitizePayloadSummary(event.payloadSummary ?? {}),
    receivedAt: cleanIsoTime(event.receivedAt) ?? new Date().toISOString()
  };
}

async function postSupabase(env: Env, tableName: string, body: Record<string, unknown>): Promise<BackendAuditRecordResult> {
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return {
      recorded: false,
      provider: "unconfigured",
      status: "unconfigured",
      tableName,
      reason: "Supabase backend audit persistence is not configured."
    };
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: "Supabase backend audit service-role key is not production-shaped."
    };
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase backend audit base URL");
  if (baseIssues.length > 0) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: baseIssues.map((issue) => issue.issue).join("; ")
    };
  }

  const endpoint = supabaseTableUrl(supabaseUrl, tableName);
  if (!endpoint) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: "Supabase backend audit endpoint is not configured."
    };
  }

  const endpointIssues = getProductionEndpointIssues(endpoint, "Supabase backend audit endpoint");
  if (endpointIssues.length > 0) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    };
  }

  try {
    const timeoutMs = readBackendProviderTimeoutMs(env);
    const response = await fetchBackendProviderResponse(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(body)
    }, timeoutMs, "Supabase backend audit request");
    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
    return { recorded: true, provider: "supabase", status: "ok", tableName };
  } catch (error) {
    return {
      recorded: false,
      provider: "error",
      status: "error",
      tableName,
      reason: sanitizeOperationalReason(error instanceof Error ? error.message : "Supabase backend audit persistence failed.") ??
        "Supabase backend audit persistence failed."
    };
  }
}

function sanitizePayloadSummary(value: Record<string, unknown>) {
  const summary: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    const safeKey = cleanSummaryKey(key);
    if (!safeKey || isForbiddenSummaryKey(safeKey)) continue;
    const safeValue = sanitizeSummaryValue(rawValue);
    if (safeValue !== undefined) summary[safeKey] = safeValue;
  }

  return summary;
}

function sanitizeSummaryValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (typeof value === "string") return redactSensitiveText(value, 160);
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeSummaryValue(item))
      .filter((item) => item !== undefined)
      .slice(0, 8);
  }
  if (typeof value === "object" && value !== null) {
    const nested: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      const safeKey = cleanSummaryKey(nestedKey);
      if (!safeKey || isForbiddenSummaryKey(safeKey)) continue;
      const safeValue = sanitizeSummaryValue(nestedValue);
      if (safeValue !== undefined) nested[safeKey] = safeValue;
    }
    return nested;
  }
  return undefined;
}

function isForbiddenSummaryKey(key: string) {
  const lower = key.toLowerCase();
  return FORBIDDEN_SUMMARY_KEYS.some((forbidden) => lower === forbidden.toLowerCase() || lower.includes(forbidden.toLowerCase()));
}

function redactSensitiveText(value: string, maxLength: number) {
  return redactOperationalText(value, maxLength) ?? "";
}

function sanitizeOperationalReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function sha256Hash(value: string | null | undefined) {
  const cleaned = cleanText(value ?? "", 4_000);
  return cleaned ? `sha256-${createHash("sha256").update(cleaned).digest("hex")}` : null;
}

function cleanSummaryKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 64);
}

function cleanToken(value: string, maxLength: number) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength);
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function cleanIsoTime(value: string | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function cleanNullableCount(value: number | null | undefined, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : null;
}

function invalidResult(reason: string): BackendAuditRecordResult {
  return {
    recorded: false,
    provider: "invalid",
    status: "invalid",
    reason
  };
}

function supabaseTableUrl(baseUrl: string, tableName: string) {
  try {
    return new URL(`/rest/v1/${encodeURIComponent(tableName)}`, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}
