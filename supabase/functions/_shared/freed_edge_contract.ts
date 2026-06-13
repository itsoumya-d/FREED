export const EDGE_CONTRACT_VERSION = "freed-edge-v1";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-FREED-Edge-Contract": EDGE_CONTRACT_VERSION
};

const REVIEWED_SOURCE_ID_PATTERNS = [
  /^oisd-nsfw$/,
  /^stevenblack(?:[-_][a-z0-9]+)*$/,
  /^cloudflare-family(?:[-_][a-z0-9]+)*$/,
  /^freed-custom(?:[-_][a-z0-9]+)*$/
];

const NORMAL_HOSTS = new Set([
  "apple.com",
  "cloudflare.com",
  "github.com",
  "google.com",
  "instagram.com",
  "microsoft.com",
  "reddit.com",
  "tiktok.com",
  "twitter.com",
  "wikipedia.org",
  "x.com",
  "youtube.com"
]);

const RESERVED_TLDS = [".example", ".invalid", ".internal", ".local", ".localhost", ".test"];
const DEFAULT_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 2_000_000;
const MIN_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 10_000;
const MAX_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 5_000_000;
const DEFAULT_BACKEND_PROVIDER_TIMEOUT_MS = 8_000;
const MIN_BACKEND_PROVIDER_TIMEOUT_MS = 500;
const MAX_BACKEND_PROVIDER_TIMEOUT_MS = 15_000;
const DEFAULT_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 1_000_000;
const MIN_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 1_024;
const MAX_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 5_000_000;
const FORBIDDEN_METADATA_KEYS = [
  "rawUrl",
  "url",
  "urls",
  "host",
  "hosts",
  "domain",
  "domains",
  "privateNotes",
  "note",
  "notes",
  "transcript",
  "receipt",
  "purchaseToken",
  "apiKey",
  "serviceRoleKey",
  "preciseLocation",
  "screenshot"
];

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Headers": "authorization, content-type, x-freed-maintenance-secret",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  });
}

export function readEnv(name: string, fallback = "") {
  const value = Deno.env.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function clampNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function requireMaintenanceAuth(request: Request) {
  const expected = readEnv("BACKEND_MAINTENANCE_SECRET") || readEnv("CRON_SECRET");
  const headerSecret = request.headers.get("x-freed-maintenance-secret") || "";
  const authorization = request.headers.get("authorization") || "";
  const bearerSecret = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
  const supplied = headerSecret || bearerSecret;

  if (!expected || !constantTimeEqual(supplied, expected)) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: "unauthorized",
          reason: "BACKEND_MAINTENANCE_SECRET or CRON_SECRET is required"
        },
        401
      )
    };
  }

  return { ok: true };
}

export function constantTimeEqual(a: string, b: string) {
  if (!a || !b) {
    return false;
  }
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export function supabaseTableUrl(baseUrl: string, tableName: string) {
  const origin = productionSafeHttpsOrigin(baseUrl);
  if (!origin) {
    return "";
  }
  return `${origin}/rest/v1/${encodeURIComponent(tableName)}`;
}

export function supabaseServiceHeaders(prefer?: string) {
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
  if (prefer) {
    headers.prefer = prefer;
  }
  return headers;
}

export async function acquireEdgeRedisLock(key: string, ttlMs: number) {
  const lockKey = cleanRedisKey(key);
  const lockTtlMs = clampNumber(String(ttlMs), 600_000, 1_000, 3_600_000);
  const token = crypto.randomUUID();
  if (!lockKey) {
    return edgeRedisLock(false, lockKey, null, lockTtlMs, "invalid", "invalid", "Redis lock key is invalid.");
  }

  const redisUrl = readEnv("UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!redisUrl || !redisToken) {
    return edgeRedisLock(true, lockKey, null, lockTtlMs, "unconfigured", "unconfigured", "Redis edge job locking is not configured.");
  }
  if (!isProductionShapedRedisToken(redisToken)) {
    return edgeRedisLock(false, lockKey, null, lockTtlMs, "invalid", "invalid", "Redis edge job token is not production-shaped.");
  }

  const redisOrigin = productionSafeHttpsOrigin(redisUrl);
  if (!redisOrigin) {
    return edgeRedisLock(false, lockKey, null, lockTtlMs, "invalid", "invalid", "Redis edge job base URL is not a production-safe HTTPS origin.");
  }

  const endpoint = redisPipelineUrl(redisOrigin);
  if (!isProductionSafeHttpsUrl(endpoint)) {
    return edgeRedisLock(false, lockKey, null, lockTtlMs, "invalid", "invalid", "Redis edge job endpoint is not production-safe HTTPS.");
  }

  try {
    const payload = await postRedisPipeline(endpoint, redisToken, [
      ["SET", lockKey, token, "NX", "PX", String(lockTtlMs)]
    ]);
    const acquired = readRedisResult(payload, 0) === "OK";
    return edgeRedisLock(acquired, lockKey, acquired ? token : null, lockTtlMs, "upstash-redis", acquired ? "ok" : "locked");
  } catch (error) {
    return edgeRedisLock(false, lockKey, null, lockTtlMs, "error", "error", error instanceof Error ? error.message : "Redis edge job locking failed.");
  }
}

export async function releaseEdgeRedisLock(lock: {
  acquired: boolean;
  key: string;
  token: string | null;
}) {
  if (!lock.acquired || !lock.token) {
    return;
  }

  const redisUrl = readEnv("UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!redisUrl || !redisToken || !isProductionShapedRedisToken(redisToken)) {
    return;
  }

  const redisOrigin = productionSafeHttpsOrigin(redisUrl);
  if (!redisOrigin) {
    return;
  }

  const endpoint = redisPipelineUrl(redisOrigin);
  if (!isProductionSafeHttpsUrl(endpoint)) {
    return;
  }

  await postRedisPipeline(endpoint, redisToken, [
    [
      "EVAL",
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      "1",
      lock.key,
      lock.token
    ]
  ]).catch(() => null);
}

export async function upsertSupabaseRow(tableName: string, row: Record<string, unknown>) {
  return upsertSupabaseRecord(tableName, row, "checksum");
}

export async function recordBackendJobRun(record: {
  jobName: string;
  idempotencyKey: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  startedAt: string;
  finishedAt: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sanitized = sanitizeBackendJobRun(record);
  if (!sanitized) {
    return { recorded: false, status: "invalid", error: "backend-job-run-record-invalid" };
  }
  const tableName = readEnv("SUPABASE_JOB_RUNS_TABLE", "backend_job_runs");
  return upsertSupabaseRecord(tableName, {
    job_name: sanitized.jobName,
    idempotency_key: sanitized.idempotencyKey,
    status: sanitized.status,
    started_at: sanitized.startedAt,
    finished_at: sanitized.finishedAt,
    metadata: sanitized.metadata
  }, "idempotency_key");
}

export async function deleteExpiredRows(tableName: string, cutoffIso: string) {
  const supabaseUrl = readEnv("SUPABASE_URL");
  if (!supabaseUrl || !readEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    return {
      table: tableName,
      status: "skipped",
      deletedCount: 0,
      reason: "supabase-service-role-not-configured"
    };
  }

  const tableUrl = supabaseTableUrl(supabaseUrl, tableName);
  if (!tableUrl) {
    return {
      table: tableName,
      status: "skipped",
      deletedCount: 0,
      reason: "supabase-url-not-production-safe-origin"
    };
  }

  const target = `${tableUrl}?expires_at=lt.${encodeURIComponent(cutoffIso)}`;
  const response = await fetchProviderWithTimeout(
    target,
    {
      method: "DELETE",
      headers: supabaseServiceHeaders("count=exact,return=minimal")
    },
    readBackendProviderTimeoutMs(),
    "Supabase edge retention cleanup request"
  );

  return {
    table: tableName,
    status: response.ok ? "deleted-expired" : "delete-failed",
    deletedCount: parseContentRangeCount(response.headers.get("content-range")),
    httpStatus: response.status
  };
}

async function upsertSupabaseRecord(tableName: string, row: Record<string, unknown>, onConflict: string) {
  const supabaseUrl = readEnv("SUPABASE_URL");
  if (!supabaseUrl || !readEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: false, status: 503, error: "supabase-service-role-not-configured" };
  }

  const tableUrl = supabaseTableUrl(supabaseUrl, tableName);
  if (!tableUrl) {
    return { ok: false, status: 503, error: "supabase-url-not-production-safe-origin" };
  }

  const target = `${tableUrl}?on_conflict=${encodeURIComponent(onConflict)}`;
  const response = await fetchProviderWithTimeout(
    target,
    {
      method: "POST",
      headers: supabaseServiceHeaders("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(row)
    },
    readBackendProviderTimeoutMs(),
    "Supabase edge upsert request"
  );

  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? "" : "supabase-upsert-failed"
  };
}

export function parseReviewedAdultDomainFeedSourceUrls(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [rawId, rawLabel, ...urlParts] = line.split("|");
      const id = normalizeSourceId(rawId);
      const label = sanitizeLabel(rawLabel || rawId || "reviewed source");
      const sourceUrl = urlParts.join("|").trim();
      const reviewedSource = REVIEWED_SOURCE_ID_PATTERNS.some((pattern) => pattern.test(id));
      const productionSafeUrl = isProductionSafeHttpsUrl(sourceUrl);
      return {
        id,
        label,
        sourceUrl,
        reviewedSource,
        productionSafeUrl,
        accepted: reviewedSource && productionSafeUrl
      };
    });
}

export function sanitizeSourceReport(report: Record<string, unknown>) {
  return {
    id: String(report.id || "unknown").slice(0, 80),
    label: sanitizeLabel(String(report.label || "reviewed source")),
    status: String(report.status || "unknown").slice(0, 40),
    domainCount: Number(report.domainCount || 0),
    rejectedNormalDomainCount: Number(report.rejectedNormalDomainCount || 0),
    error: report.error ? String(report.error).slice(0, 120) : undefined
  };
}

export async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number,
  maxBytes = clampNumber(
    readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"),
    DEFAULT_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES,
    MIN_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES,
    MAX_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES
  )
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/plain, */*;q=0.8",
        "User-Agent": "FREED adult-domain-feed-sync"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`source responded ${response.status}`);
    }
    return await readTextBodyWithByteLimit(response, maxBytes, () => controller.abort());
  } finally {
    clearTimeout(timeout);
  }
}

async function readTextBodyWithByteLimit(
  response: Response,
  maxBytes: number,
  abortFetch: () => void,
  makeTooLargeError: (maxBytes: number) => Error = adultDomainFeedSourceTooLargeError
) {
  const contentLength = parseContentLength(response.headers.get("content-length"));
  if (contentLength !== null && contentLength > maxBytes) {
    throw makeTooLargeError(maxBytes);
  }

  if (!response.body) {
    const text = await response.text();
    if (utf8ByteLength(text) > maxBytes) {
      throw makeTooLargeError(maxBytes);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        abortFetch();
        await reader.cancel().catch(() => null);
        throw makeTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function adultDomainFeedSourceTooLargeError(maxBytes: number) {
  return new Error(`adult-domain-feed-source-too-large: source body exceeds ${maxBytes} bytes`);
}

export function parseAdultDomainsFromText(text: string) {
  const domains = new Set<string>();
  let rejectedNormalDomainCount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "").replace(/^#.*$/, "").replace(/\s+!.*$/, "").trim();
    if (!withoutComment || withoutComment.startsWith("!") || withoutComment.startsWith("@@")) {
      continue;
    }

    const host = extractHostCandidate(withoutComment);
    if (!host) {
      continue;
    }

    if (NORMAL_HOSTS.has(host) || [...NORMAL_HOSTS].some((normalHost) => host.endsWith(`.${normalHost}`))) {
      rejectedNormalDomainCount += 1;
      continue;
    }

    domains.add(host);
  }

  return {
    domains: [...domains].sort(),
    rejectedNormalDomainCount
  };
}

export function parseExtraAdultDomains(raw: string) {
  return parseAdultDomainsFromText(raw.replace(/[,\s]+/g, "\n"));
}

export function checksumDomains(domains: string[]) {
  let hash = 0x811c9dc5;
  for (const domain of domains) {
    for (let index = 0; index < domain.length; index += 1) {
      hash ^= domain.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function futureIso(daysFromNow: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString();
}

async function postRedisPipeline(endpoint: string, token: string, commands: string[][]) {
  const response = await fetchJsonWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(commands)
  }, readBackendProviderTimeoutMs());
  return response;
}

async function fetchProviderWithTimeout(url: string, init: RequestInit, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const maxBytes = readBackendProviderResponseMaxBytes();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`provider responded ${response.status}`);
    }
    return await readJsonBodyWithByteLimit(response, maxBytes, "Redis edge pipeline response", () => controller.abort());
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error(`Redis edge pipeline request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBodyWithByteLimit(response: Response, maxBytes: number, label: string, abortFetch: () => void) {
  const contentLength = parseContentLength(response.headers.get("content-length"));
  if (contentLength !== null && contentLength > maxBytes) {
    abortFetch();
    throw backendProviderResponseTooLargeError(label, maxBytes);
  }

  if (!response.body) {
    const text = await response.text();
    if (utf8ByteLength(text) > maxBytes) {
      abortFetch();
      throw backendProviderResponseTooLargeError(label, maxBytes);
    }
    return JSON.parse(text);
  }

  const text = await readTextBodyWithByteLimit(response, maxBytes, abortFetch, () =>
    backendProviderResponseTooLargeError(label, maxBytes)
  );
  return JSON.parse(text);
}

function backendProviderResponseTooLargeError(label: string, maxBytes: number) {
  return new Error(`${label} exceeds ${maxBytes} bytes.`);
}

function readBackendProviderTimeoutMs() {
  return clampNumber(
    readEnv("FREED_BACKEND_PROVIDER_TIMEOUT_MS"),
    DEFAULT_BACKEND_PROVIDER_TIMEOUT_MS,
    MIN_BACKEND_PROVIDER_TIMEOUT_MS,
    MAX_BACKEND_PROVIDER_TIMEOUT_MS
  );
}

function readBackendProviderResponseMaxBytes() {
  return clampNumber(
    readEnv("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES"),
    DEFAULT_BACKEND_PROVIDER_RESPONSE_MAX_BYTES,
    MIN_BACKEND_PROVIDER_RESPONSE_MAX_BYTES,
    MAX_BACKEND_PROVIDER_RESPONSE_MAX_BYTES
  );
}

function isAbortLikeError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message));
}

function parseContentRangeCount(value: string | null) {
  if (!value) {
    return 0;
  }
  const match = value.match(/\/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function edgeRedisLock(
  acquired: boolean,
  key: string,
  token: string | null,
  ttlMs: number,
  provider: "upstash-redis" | "unconfigured" | "invalid" | "error",
  status: "ok" | "locked" | "unconfigured" | "invalid" | "error",
  reason?: string
) {
  return { acquired, key, token, ttlMs, provider, status, reason };
}

function readRedisResult(payload: unknown, index: number) {
  if (!Array.isArray(payload)) {
    return null;
  }
  const entry = payload[index];
  if (entry && typeof entry === "object" && "result" in entry) {
    return (entry as { result?: unknown }).result;
  }
  return null;
}

function redisPipelineUrl(baseUrl: string) {
  try {
    return new URL("/pipeline", baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function productionSafeHttpsOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!isProductionSafeHttpsUrlParts(url, false)) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function isProductionShapedRedisToken(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    value.trim().length >= 20 &&
    !normalized.includes("placeholder") &&
    !normalized.includes("sample") &&
    !normalized.includes("todo") &&
    !normalized.includes("your-") &&
    !normalized.startsWith("test") &&
    !normalized.startsWith("local")
  );
}

function sanitizeBackendJobRun(record: {
  jobName: string;
  idempotencyKey: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  startedAt: string;
  finishedAt: string | null;
  metadata?: Record<string, unknown>;
}) {
  const jobName = isBackendJobName(record.jobName) ? record.jobName : "";
  const idempotencyKey = cleanToken(record.idempotencyKey, 180);
  const startedAt = cleanIsoTime(record.startedAt);
  const finishedAt = record.finishedAt ? cleanIsoTime(record.finishedAt) : null;
  if (!jobName || !idempotencyKey || !startedAt) {
    return null;
  }
  return {
    jobName,
    idempotencyKey,
    status: record.status,
    startedAt,
    finishedAt,
    metadata: sanitizeMetadata(record.metadata ?? {})
  };
}

function sanitizeMetadata(value: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const safeKey = cleanMetadataKey(key);
    if (!safeKey || isForbiddenMetadataKey(safeKey)) {
      continue;
    }
    const safeValue = sanitizeMetadataValue(rawValue);
    if (safeValue !== undefined) {
      metadata[safeKey] = safeValue;
    }
  }
  return metadata;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }
  if (typeof value === "string") {
    return redactSensitiveText(value, 160);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMetadataValue(item))
      .filter((item) => item !== undefined)
      .slice(0, 8);
  }
  if (typeof value === "object" && value !== null) {
    return sanitizeMetadata(value as Record<string, unknown>);
  }
  return undefined;
}

function isBackendJobName(value: string) {
  return [
    "adult-domain-feed-sync",
    "analytics-retention-cleanup",
    "ai-backend-smoke",
    "purchase-verification-smoke",
    "performance-evidence-ingest"
  ].includes(value);
}

function isForbiddenMetadataKey(key: string) {
  const lower = key.toLowerCase();
  return FORBIDDEN_METADATA_KEYS.some((forbidden) => lower === forbidden.toLowerCase() || lower.includes(forbidden.toLowerCase()));
}

function cleanMetadataKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 64);
}

function cleanRedisKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "-").replace(/-+/g, "-").slice(0, 180);
}

function cleanToken(value: string, maxLength: number) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength);
}

function cleanIsoTime(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function redactSensitiveText(value: string, maxLength: number) {
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSourceId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function sanitizeLabel(value: string) {
  return String(value || "reviewed source")
    .replace(/[^\w .:/()-]/g, "")
    .replace(/https?:\/\/\S+/gi, "[source]")
    .trim()
    .slice(0, 120);
}

function extractHostCandidate(value: string) {
  const trimmed = value
    .replace(/^address=\//, "")
    .replace(/^server=\//, "")
    .replace(/^local-zone:\s*/i, "")
    .replace(/^\|\|/, "")
    .replace(/\^.*$/, "")
    .trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const candidate = parts.length >= 2 && (parts[0] === "0.0.0.0" || parts[0] === "127.0.0.1") ? parts[1] : parts[0];
  const withoutProtocol = candidate.replace(/^https?:\/\//i, "");
  const withoutPath = withoutProtocol.split(/[/:]/)[0];
  const host = normalizeHost(withoutPath);
  return isAdultFeedHostCandidate(host) ? host : "";
}

function normalizeHost(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\*\./, "")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
}

function isAdultFeedHostCandidate(host: string) {
  if (!host || host.length > 253 || host.includes("_")) {
    return false;
  }
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) {
    return false;
  }
  if (RESERVED_TLDS.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))) {
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return false;
  }
  return host.split(".").every((label) => label.length > 0 && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
}

function isProductionSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return isProductionSafeHttpsUrlParts(url, true);
  } catch {
    return false;
  }
}

function isProductionSafeHttpsUrlParts(url: URL, requireConcretePath: boolean) {
  const host = normalizeUrlHostname(url.hostname);
  if (url.protocol !== "https:") {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) {
    return false;
  }
  if (requireConcretePath && (!url.pathname || url.pathname === "/")) {
    return false;
  }
  if (!requireConcretePath && url.pathname && url.pathname !== "/") {
    return false;
  }
  if (
    host === "::" ||
    host === "::1" ||
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "example.com" ||
    host.includes("placeholder") ||
    host.includes("changeme") ||
    host.includes("sample") ||
    host.includes("todo") ||
    host.startsWith("your-") ||
    RESERVED_TLDS.some((suffix) => host.endsWith(suffix))
  ) {
    return false;
  }
  if (isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host)) {
    return false;
  }
  return true;
}

function normalizeUrlHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

function isPrivateOrReservedIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }
  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second, third] = octets;
  return (
    first === 10 ||
    first === 0 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateOrReservedIpv6(host: string) {
  if (!host.includes(":")) {
    return false;
  }
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe8") ||
    host.startsWith("fe9") ||
    host.startsWith("fea") ||
    host.startsWith("feb") ||
    host.startsWith("ff") ||
    host.startsWith("2001:db8")
  );
}
