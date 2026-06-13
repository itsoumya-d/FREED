import { createHash, randomUUID } from "node:crypto";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import {
  isRedisRestToken,
  isSupabaseServiceRoleKey
} from "@/lib/server-credential-safety";
import {
  fetchBackendProviderResponse,
  readBackendProviderJson,
  readBackendProviderTimeoutMs
} from "@/lib/backend-provider-timeout";
import { redactOperationalText } from "@/lib/operational-redaction";

type Env = Record<string, string | undefined>;

export type BackendInfrastructureResult = {
  provider: "upstash-redis" | "supabase" | "custom" | "unconfigured" | "invalid" | "error";
  status: "ok" | "allowed" | "limited" | "locked" | "unconfigured" | "invalid" | "error";
  reason?: string;
};

export type BackendRateLimitRoute =
  | "purchase-verification"
  | "analytics"
  | "clara"
  | "challenges"
  | "retention"
  | "adult-domain-feed"
  | "notifications"
  | "recovery-backup";

export type BackendRateLimitInput = {
  route: BackendRateLimitRoute;
  request: Request;
  limit: number;
  windowSeconds: number;
  failClosed?: boolean;
};

export type BackendRateLimitCheck = BackendInfrastructureResult & {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number | null;
  retryAfterSeconds: number | null;
};

export type BackendRedisLockRequest = {
  key: string;
  ttlMs: number;
  metadata?: Record<string, unknown>;
};

export type BackendRedisLockResult = BackendInfrastructureResult & {
  acquired: boolean;
  key: string;
  token: string | null;
  ttlMs: number;
};

export type BackendJobName =
  | "adult-domain-feed-sync"
  | "analytics-retention-cleanup"
  | "ai-backend-smoke"
  | "purchase-verification-smoke"
  | "performance-evidence-ingest";

export type BackendJobStatus = "started" | "succeeded" | "failed" | "skipped";

export type BackendJobRunRecord = {
  jobName: BackendJobName;
  idempotencyKey: string;
  status: BackendJobStatus;
  startedAt: string;
  finishedAt: string | null;
  metadata: Record<string, unknown>;
};

export type BackendJobRunResult = BackendInfrastructureResult & {
  recorded: boolean;
  tableName?: string;
  jobName?: BackendJobName;
  idempotencyKey?: string;
};

export type BackendJobRunOutcome<T> = {
  result: T | null;
  status: BackendJobStatus;
  lock: BackendRedisLockResult;
  audit: BackendJobRunResult;
  startedAt: string;
  finishedAt: string;
  reason?: string;
};

export type BackendRateLimitProviderInput = {
  route: BackendRateLimitRoute;
  request: Request;
  key: string;
  limit: number;
  windowSeconds: number;
  clientFingerprintHash: string;
};

export type BackendRateLimitProvider = (
  input: BackendRateLimitProviderInput
) => Promise<BackendRateLimitCheck> | BackendRateLimitCheck;

export type BackendRedisLockProvider = (
  input: BackendRedisLockRequest & { token: string }
) => Promise<BackendRedisLockResult> | BackendRedisLockResult;

export type BackendRedisUnlockProvider = (lock: BackendRedisLockResult) => Promise<void> | void;

export type BackendJobRunProvider = (
  record: BackendJobRunRecord
) => Promise<BackendJobRunResult> | BackendJobRunResult;

let backendRateLimitProvider: BackendRateLimitProvider | null = null;
let backendRedisLockProvider: BackendRedisLockProvider | null = null;
let backendRedisUnlockProvider: BackendRedisUnlockProvider | null = null;
let backendJobRunProvider: BackendJobRunProvider | null = null;

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

export function configureBackendRateLimitProvider(provider: BackendRateLimitProvider | null) {
  backendRateLimitProvider = provider;
}

export function configureBackendRedisLockProvider(
  provider: BackendRedisLockProvider | null,
  unlockProvider: BackendRedisUnlockProvider | null = null
) {
  backendRedisLockProvider = provider;
  backendRedisUnlockProvider = unlockProvider;
}

export function configureBackendJobRunProvider(provider: BackendJobRunProvider | null) {
  backendJobRunProvider = provider;
}

export async function enforceBackendRateLimit(
  input: BackendRateLimitInput,
  options: { env?: Env } = {}
): Promise<BackendRateLimitCheck> {
  const limit = cleanCount(input.limit, 1, 10_000);
  const windowSeconds = cleanCount(input.windowSeconds, 1, 86_400);
  const clientFingerprintHash = hashToken(readClientFingerprint(input.request));
  const key = `freed:rate:${input.route}:${clientFingerprintHash}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

  if (backendRateLimitProvider) {
    return backendRateLimitProvider({
      key,
      route: input.route,
      request: input.request,
      limit,
      windowSeconds,
      clientFingerprintHash
    });
  }

  const env = options.env ?? process.env;
  const failClosed = shouldFailClosedRateLimit(input, env);
  const redisUrl = readEnv(env, "UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv(env, "UPSTASH_REDIS_REST_TOKEN");
  if (!redisUrl || !redisToken) {
    return rateLimitUnavailable(key, limit, windowSeconds, "unconfigured", "unconfigured", "Redis rate limiting is not configured.", failClosed);
  }
  if (!isRedisRestToken(redisToken)) {
    return rateLimitUnavailable(key, limit, windowSeconds, "invalid", "invalid", "Redis rate-limit token is not production-shaped.", failClosed);
  }

  const baseIssues = getProductionBaseUrlIssues(redisUrl, "Redis rate-limit base URL");
  if (baseIssues.length > 0) {
    return rateLimitUnavailable(key, limit, windowSeconds, "invalid", "invalid", baseIssues.map((issue) => issue.issue).join("; "), failClosed);
  }

  const endpoint = redisPipelineUrl(redisUrl);
  const endpointIssues = getProductionEndpointIssues(endpoint, "Redis rate-limit endpoint");
  if (endpointIssues.length > 0) {
    return rateLimitUnavailable(key, limit, windowSeconds, "invalid", "invalid", endpointIssues.map((issue) => issue.issue).join("; "), failClosed);
  }

  try {
    const payload = await postRedisPipeline(endpoint, redisToken, [
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"]
    ], readBackendProviderTimeoutMs(env));
    const count = readRedisNumber(payload, 0) ?? 1;
    const allowed = count <= limit;
    return {
      allowed,
      key,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? null : windowSeconds,
      provider: "upstash-redis",
      status: allowed ? "allowed" : "limited"
    };
  } catch (error) {
    return rateLimitUnavailable(
      key,
      limit,
      windowSeconds,
      "error",
      "error",
      error instanceof Error ? error.message : "Redis rate limiting failed.",
      failClosed
    );
  }
}

export function backendRateLimitHttpStatus(rateLimit: BackendRateLimitCheck) {
  return rateLimit.status === "limited" ? 429 : 503;
}

export function backendRateLimitError(rateLimit: BackendRateLimitCheck, limitedMessage: string) {
  return rateLimit.status === "limited"
    ? limitedMessage
    : rateLimit.reason ?? "Backend rate limiting is unavailable.";
}

export async function acquireBackendRedisLock(
  input: BackendRedisLockRequest,
  options: { env?: Env } = {}
): Promise<BackendRedisLockResult> {
  const key = cleanRedisKey(input.key);
  const ttlMs = cleanCount(input.ttlMs, 1_000, 3_600_000);
  const token = randomUUID();
  if (!key) return lockResult(false, key, null, ttlMs, "invalid", "invalid", "Redis lock key is invalid.");

  if (backendRedisLockProvider) return backendRedisLockProvider({ key, ttlMs, metadata: sanitizeMetadata(input.metadata ?? {}), token });

  const env = options.env ?? process.env;
  const redisUrl = readEnv(env, "UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv(env, "UPSTASH_REDIS_REST_TOKEN");
  if (!redisUrl || !redisToken) {
    return lockResult(true, key, null, ttlMs, "unconfigured", "unconfigured", "Redis lock is not configured.");
  }
  if (!isRedisRestToken(redisToken)) {
    return lockResult(true, key, null, ttlMs, "invalid", "invalid", "Redis lock token is not production-shaped.");
  }

  const baseIssues = getProductionBaseUrlIssues(redisUrl, "Redis lock base URL");
  if (baseIssues.length > 0) {
    return lockResult(true, key, null, ttlMs, "invalid", "invalid", baseIssues.map((issue) => issue.issue).join("; "));
  }

  const endpoint = redisPipelineUrl(redisUrl);
  const endpointIssues = getProductionEndpointIssues(endpoint, "Redis lock endpoint");
  if (endpointIssues.length > 0) {
    return lockResult(true, key, null, ttlMs, "invalid", "invalid", endpointIssues.map((issue) => issue.issue).join("; "));
  }

  try {
    const payload = await postRedisPipeline(endpoint, redisToken, [["SET", key, token, "NX", "PX", String(ttlMs)]], readBackendProviderTimeoutMs(env));
    const acquired = readRedisResult(payload, 0) === "OK";
    return lockResult(acquired, key, acquired ? token : null, ttlMs, "upstash-redis", acquired ? "ok" : "locked");
  } catch (error) {
    return lockResult(
      true,
      key,
      null,
      ttlMs,
      "error",
      "error",
      error instanceof Error ? error.message : "Redis lock failed."
    );
  }
}

export async function releaseBackendRedisLock(lock: BackendRedisLockResult, options: { env?: Env } = {}) {
  if (!lock.acquired || !lock.token) return;
  if (backendRedisUnlockProvider) {
    await backendRedisUnlockProvider(lock);
    return;
  }

  const env = options.env ?? process.env;
  const redisUrl = readEnv(env, "UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv(env, "UPSTASH_REDIS_REST_TOKEN");
  if (!redisUrl || !redisToken) return;
  if (!isRedisRestToken(redisToken)) return;
  if (getProductionBaseUrlIssues(redisUrl, "Redis unlock base URL").length > 0) return;

  const endpoint = redisPipelineUrl(redisUrl);
  if (getProductionEndpointIssues(endpoint, "Redis unlock endpoint").length > 0) return;

  await postRedisPipeline(endpoint, redisToken, [
    [
      "EVAL",
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      "1",
      lock.key,
      lock.token
    ]
  ], readBackendProviderTimeoutMs(env)).catch(() => null);
}

export async function recordBackendJobRun(
  record: BackendJobRunRecord,
  options: { env?: Env } = {}
): Promise<BackendJobRunResult> {
  const sanitized = sanitizeJobRunRecord(record);
  if (!sanitized) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      reason: "Backend job run record is invalid."
    };
  }

  if (backendJobRunProvider) return backendJobRunProvider(sanitized);

  const env = options.env ?? process.env;
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const tableName = readEnv(env, "SUPABASE_JOB_RUNS_TABLE") ?? "backend_job_runs";

  if (!supabaseUrl || !serviceKey) {
    return {
      recorded: false,
      provider: "unconfigured",
      status: "unconfigured",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: "Supabase backend job-run persistence is not configured."
    };
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: "Supabase backend job-run service-role key is not production-shaped."
    };
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase backend job-run base URL");
  if (baseIssues.length > 0) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: baseIssues.map((issue) => issue.issue).join("; ")
    };
  }

  const baseEndpoint = supabaseTableUrl(supabaseUrl, tableName);
  if (!baseEndpoint) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: "Supabase backend job-run endpoint is not configured."
    };
  }

  const endpointIssues = getProductionEndpointIssues(baseEndpoint, "Supabase backend job-run endpoint");
  if (endpointIssues.length > 0) {
    return {
      recorded: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    };
  }

  try {
    const timeoutMs = readBackendProviderTimeoutMs(env);
    const endpoint = `${baseEndpoint}?on_conflict=idempotency_key`;
    const response = await fetchBackendProviderResponse(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        job_name: sanitized.jobName,
        idempotency_key: sanitized.idempotencyKey,
        status: sanitized.status,
        started_at: sanitized.startedAt,
        finished_at: sanitized.finishedAt,
        metadata: sanitized.metadata
      })
    }, timeoutMs, "Supabase backend job-run request");
    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
    return {
      recorded: true,
      provider: "supabase",
      status: "ok",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey
    };
  } catch (error) {
    return {
      recorded: false,
      provider: "error",
      status: "error",
      tableName,
      jobName: sanitized.jobName,
      idempotencyKey: sanitized.idempotencyKey,
      reason: sanitizeOperationalReason(error instanceof Error ? error.message : "Supabase backend job-run persistence failed.") ??
        "Supabase backend job-run persistence failed."
    };
  }
}

export async function runBackendJob<T>(
  input: {
    jobName: BackendJobName;
    idempotencyKey: string;
    lockKey?: string;
    lockTtlMs?: number;
    metadata?: Record<string, unknown>;
  },
  task: () => Promise<T> | T,
  options: { env?: Env } = {}
): Promise<BackendJobRunOutcome<T>> {
  const startedAt = new Date().toISOString();
  const metadata = sanitizeMetadata(input.metadata ?? {});
  const lock = input.lockKey
    ? await acquireBackendRedisLock({ key: input.lockKey, ttlMs: input.lockTtlMs ?? 60_000, metadata }, options)
    : lockResult(true, "no-lock", null, 0, "unconfigured", "unconfigured", "No Redis lock requested.");

  if (!lock.acquired) {
    const finishedAt = new Date().toISOString();
    const audit = await recordBackendJobRun(
      {
        jobName: input.jobName,
        idempotencyKey: cleanToken(input.idempotencyKey, 180) || hashToken(`${input.jobName}:${startedAt}`),
        status: "skipped",
        startedAt,
        finishedAt,
        metadata: { ...metadata, lockStatus: lock.status }
      },
      options
    );
    return {
      result: null,
      status: "skipped",
      lock,
      audit,
      startedAt,
      finishedAt,
      reason: lock.reason ?? "Backend job is already locked."
    };
  }

  const idempotencyKey = cleanToken(input.idempotencyKey, 180) || hashToken(`${input.jobName}:${startedAt}`);
  await recordBackendJobRun(
    {
      jobName: input.jobName,
      idempotencyKey,
      status: "started",
      startedAt,
      finishedAt: null,
      metadata: { ...metadata, lockStatus: lock.status }
    },
    options
  ).catch(() => null);

  try {
    const result = await task();
    const finishedAt = new Date().toISOString();
    const audit = await recordBackendJobRun(
      {
        jobName: input.jobName,
        idempotencyKey,
        status: "succeeded",
        startedAt,
        finishedAt,
        metadata: { ...metadata, lockStatus: lock.status }
      },
      options
    );
    return { result, status: "succeeded", lock, audit, startedAt, finishedAt };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const audit = await recordBackendJobRun(
      {
        jobName: input.jobName,
        idempotencyKey,
        status: "failed",
        startedAt,
        finishedAt,
        metadata: {
          ...metadata,
          lockStatus: lock.status,
          failureCode: error instanceof Error ? cleanToken(error.name, 80) : "unknown"
        }
      },
      options
    );
    throw Object.assign(error instanceof Error ? error : new Error("Backend job failed."), {
      backendJobRun: { status: "failed", lock, audit, startedAt, finishedAt }
    });
  } finally {
    await releaseBackendRedisLock(lock, options);
  }
}

function rateLimitUnavailable(
  key: string,
  limit: number,
  windowSeconds: number,
  provider: BackendRateLimitCheck["provider"],
  status: BackendRateLimitCheck["status"],
  reason: string,
  failClosed: boolean
): BackendRateLimitCheck {
  return {
    allowed: !failClosed,
    key,
    limit,
    remaining: failClosed ? 0 : null,
    retryAfterSeconds: failClosed ? windowSeconds : null,
    provider,
    status,
    reason: sanitizeOperationalReason(reason) ?? "Backend rate limiting is unavailable."
  };
}

function shouldFailClosedRateLimit(input: BackendRateLimitInput, env: Env) {
  if (input.failClosed) return true;
  if (readBooleanEnv(env, "FREED_BACKEND_RATE_LIMIT_FAIL_CLOSED")) return true;

  return ["NODE_ENV", "APP_ENV", "VERCEL_ENV", "EAS_BUILD_PROFILE"]
    .map((key) => readEnv(env, key)?.toLowerCase())
    .some((value) => value === "production");
}

function lockResult(
  acquired: boolean,
  key: string,
  token: string | null,
  ttlMs: number,
  provider: BackendRedisLockResult["provider"],
  status: BackendRedisLockResult["status"],
  reason?: string
): BackendRedisLockResult {
  const safeReason = sanitizeOperationalReason(reason);
  return { acquired, key, token, ttlMs, provider, status, ...(safeReason ? { reason: safeReason } : {}) };
}

function sanitizeJobRunRecord(record: BackendJobRunRecord): BackendJobRunRecord | null {
  const jobName = isBackendJobName(record.jobName) ? record.jobName : null;
  const idempotencyKey = cleanToken(record.idempotencyKey, 180);
  const status = ["started", "succeeded", "failed", "skipped"].includes(record.status) ? record.status : null;
  const startedAt = cleanIsoTime(record.startedAt);
  const finishedAt = record.finishedAt ? cleanIsoTime(record.finishedAt) : null;
  if (!jobName || !idempotencyKey || !status || !startedAt) return null;

  return {
    jobName,
    idempotencyKey,
    status,
    startedAt,
    finishedAt,
    metadata: sanitizeMetadata(record.metadata)
  };
}

function sanitizeMetadata(value: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const safeKey = cleanMetadataKey(key);
    if (!safeKey || isForbiddenMetadataKey(safeKey)) continue;
    const safeValue = sanitizeMetadataValue(rawValue);
    if (safeValue !== undefined) metadata[safeKey] = safeValue;
  }
  return metadata;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (typeof value === "string") return redactSensitiveText(value, 160);
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMetadataValue(item))
      .filter((item) => item !== undefined)
      .slice(0, 8);
  }
  if (typeof value === "object" && value !== null) return sanitizeMetadata(value as Record<string, unknown>);
  return undefined;
}

function readClientFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim();
  return [forwarded, realIp, cfIp, userAgent].filter(Boolean).join("|") || "unknown-client";
}

async function postRedisPipeline(endpoint: string, token: string, commands: string[][], timeoutMs: number) {
  const response = await fetchBackendProviderResponse(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(commands)
  }, timeoutMs, "Redis backend pipeline request");
  if (!response.ok) throw new Error(`Redis returned ${response.status}.`);
  return readBackendProviderJson(response, timeoutMs, "Redis backend pipeline response");
}

function readRedisNumber(payload: unknown, index: number) {
  const result = readRedisResult(payload, index);
  if (typeof result === "number" && Number.isFinite(result)) return result;
  if (typeof result === "string") {
    const parsed = Number.parseInt(result, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readRedisResult(payload: unknown, index: number) {
  if (!Array.isArray(payload)) return null;
  const entry = payload[index];
  if (entry && typeof entry === "object" && "result" in entry) return (entry as { result?: unknown }).result;
  return null;
}

function redisPipelineUrl(baseUrl: string) {
  try {
    return new URL("/pipeline", baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function supabaseTableUrl(baseUrl: string, tableName: string) {
  try {
    return new URL(`/rest/v1/${encodeURIComponent(tableName)}`, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function isBackendJobName(value: string): value is BackendJobName {
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

function redactSensitiveText(value: string, maxLength: number) {
  return redactOperationalText(value, maxLength) ?? "";
}

function sanitizeOperationalReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function cleanRedisKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "-").replace(/-+/g, "-").slice(0, 180);
}

function cleanMetadataKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 64);
}

function cleanToken(value: string, maxLength: number) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength);
}

function cleanCount(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min;
}

function cleanIsoTime(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readBooleanEnv(env: Env, key: string) {
  const value = readEnv(env, key)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}
