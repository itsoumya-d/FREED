import { createHash } from "node:crypto";
import {
  readBackendProviderResponseMaxBytes,
  readBackendProviderTimeoutMs
} from "@/lib/backend-provider-timeout";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import {
  containsSensitiveOperationalText,
  redactOperationalText
} from "@/lib/operational-redaction";
import {
  RECOVERY_BACKUP_VERSION,
  type RecoveryBackupEnvelope
} from "@/lib/recovery-backup";
import { isSupabaseServiceRoleKey } from "@/lib/server-credential-safety";

type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

export type RecoveryBackupSyncAction = "upload" | "download" | "delete";

export type RecoveryBackupSyncRequest = {
  action: RecoveryBackupSyncAction;
  envelope?: RecoveryBackupEnvelope;
  deviceId?: string;
  clientModifiedAt?: string;
};

export type RecoveryBackupSyncIdentity = {
  provider: "supabase-auth" | "custom";
  userHash: string;
};

export type RecoveryBackupSyncResult = {
  ok: boolean;
  provider: "supabase" | "custom" | "unconfigured" | "invalid" | "unauthorized" | "error";
  status: "ok" | "unconfigured" | "invalid" | "unauthorized" | "error";
  action?: RecoveryBackupSyncAction;
  syncedAt: string;
  version?: typeof RECOVERY_BACKUP_VERSION;
  backupCreatedAt?: string;
  envelope?: RecoveryBackupEnvelope;
  reason?: string;
};

export type RecoveryBackupSyncIdentityProvider = (
  request: Request
) => Promise<RecoveryBackupSyncIdentity | null> | RecoveryBackupSyncIdentity | null;

export type RecoveryBackupSyncStorageProvider = (
  request: RecoveryBackupSyncRequest,
  identity: RecoveryBackupSyncIdentity,
  syncedAt: string
) => Promise<RecoveryBackupSyncResult> | RecoveryBackupSyncResult;

let recoveryBackupSyncIdentityProvider: RecoveryBackupSyncIdentityProvider | null = null;
let recoveryBackupSyncStorageProvider: RecoveryBackupSyncStorageProvider | null = null;

const MAX_ENVELOPE_BYTES = 1_000_000;
const DEFAULT_RETENTION_DAYS = 365;

const forbiddenSyncKeyAliases = [
  "state",
  "attempts",
  "relapseRecords",
  "relapse_records",
  "dailyCheckIns",
  "daily_check_ins",
  "dailyHabits",
  "daily_habits",
  "reflection",
  "reflections",
  "note",
  "notes",
  "privateNotes",
  "private_notes",
  "privateJournal",
  "private_journal",
  "contact",
  "contacts",
  "supportCircle",
  "support_circle",
  "supportContacts",
  "support_contacts",
  "accountability",
  "accountabilityContacts",
  "accountability_contacts",
  "messageTemplate",
  "message_template",
  "phone",
  "phoneNumber",
  "phone_number",
  "email",
  "emailAddress",
  "email_address",
  "url",
  "urls",
  "rawUrl",
  "rawURL",
  "raw_url",
  "rawHost",
  "raw_host",
  "host",
  "hostname",
  "hosts",
  "domain",
  "domains",
  "browsingHistory",
  "browsing_history",
  "browserHistory",
  "browser_history",
  "visitedUrl",
  "visitedURL",
  "visited_url",
  "conversationTranscript",
  "conversation_transcript",
  "transcript",
  "transcripts",
  "receipt",
  "receipts",
  "receiptData",
  "receipt_data",
  "rawReceipt",
  "raw_receipt",
  "purchaseToken",
  "purchase_token",
  "rawPurchaseToken",
  "raw_purchase_token",
  "passphrase",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "authToken",
  "auth_token",
  "jwt",
  "secret",
  "serviceRoleKey",
  "service_role_key",
  "preciseLocation",
  "precise_location",
  "coordinates",
  "latitude",
  "longitude",
  "screenshot",
  "photo",
  "image",
  "apiKey"
] as const;

const forbiddenSyncKeys = new Set(forbiddenSyncKeyAliases.map(normalizeSyncKey));
const allowedSyncKeysByAction: Record<RecoveryBackupSyncAction, Set<string>> = {
  upload: new Set(["action", "envelope", "deviceId", "clientModifiedAt"]),
  download: new Set(["action", "deviceId", "clientModifiedAt"]),
  delete: new Set(["action", "deviceId", "clientModifiedAt"])
};

export function configureRecoveryBackupSyncIdentityProvider(provider: RecoveryBackupSyncIdentityProvider | null) {
  recoveryBackupSyncIdentityProvider = provider;
}

export function configureRecoveryBackupSyncStorageProvider(provider: RecoveryBackupSyncStorageProvider | null) {
  recoveryBackupSyncStorageProvider = provider;
}

export function sanitizeRecoveryBackupSyncRequest(value: unknown): RecoveryBackupSyncRequest | null {
  if (!isRecord(value)) return null;
  if (containsForbiddenSyncKey(value)) return null;

  const action = value.action;
  if (action !== "upload" && action !== "download" && action !== "delete") return null;
  if (!hasOnlyAllowedSyncKeys(value, allowedSyncKeysByAction[action])) return null;

  const deviceId = cleanOptionalRouteMetadataText(value.deviceId, 120);
  const clientModifiedAt = cleanOptionalIsoDate(value.clientModifiedAt);
  if (hasOwn(value, "deviceId") && value.deviceId !== null && value.deviceId !== undefined && value.deviceId !== "" && !deviceId) {
    return null;
  }
  if (
    hasOwn(value, "clientModifiedAt") &&
    value.clientModifiedAt !== null &&
    value.clientModifiedAt !== undefined &&
    value.clientModifiedAt !== "" &&
    !clientModifiedAt
  ) {
    return null;
  }

  if (action === "upload") {
    const envelope = sanitizeRecoveryBackupEnvelope(value.envelope);
    if (!envelope) return null;
    return {
      action,
      envelope,
      ...(deviceId ? { deviceId } : {}),
      ...(clientModifiedAt ? { clientModifiedAt } : {})
    };
  }

  if ("envelope" in value) return null;
  return {
    action,
    ...(deviceId ? { deviceId } : {}),
    ...(clientModifiedAt ? { clientModifiedAt } : {})
  };
}

export async function syncEncryptedRecoveryBackup(
  value: unknown,
  request: Request,
  options: { env?: Env; fetcher?: Fetcher; syncedAt?: string } = {}
): Promise<RecoveryBackupSyncResult> {
  const syncedAt = options.syncedAt ?? new Date().toISOString();
  const syncRequest = sanitizeRecoveryBackupSyncRequest(value);
  if (!syncRequest) {
    return result(false, "invalid", "invalid", syncedAt, {
      reason: "Recovery backup sync accepts only encrypted FREED backup envelopes and route metadata."
    });
  }

  const identity = await resolveRecoveryBackupSyncIdentity(request, {
    env: options.env,
    fetcher: options.fetcher
  });
  if (!identity) {
    return result(false, "unauthorized", "unauthorized", syncedAt, {
      action: syncRequest.action,
      reason: "Recovery backup sync requires an authenticated Supabase user token."
    });
  }

  if (recoveryBackupSyncStorageProvider) {
    return sanitizeRecoveryBackupSyncResult(
      await recoveryBackupSyncStorageProvider(syncRequest, identity, syncedAt),
      syncRequest.action,
      syncedAt
    );
  }

  return syncWithSupabase(syncRequest, identity, syncedAt, {
    env: options.env,
    fetcher: options.fetcher
  });
}

async function resolveRecoveryBackupSyncIdentity(
  request: Request,
  options: { env?: Env; fetcher?: Fetcher } = {}
): Promise<RecoveryBackupSyncIdentity | null> {
  if (recoveryBackupSyncIdentityProvider) {
    const identity = await recoveryBackupSyncIdentityProvider(request);
    return identity?.userHash ? identity : null;
  }

  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = readBackendProviderTimeoutMs(env);
  const responseMaxBytes = readBackendProviderResponseMaxBytes(env);
  const token = bearerToken(request);
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !serviceKey || !isSupabaseServiceRoleKey(serviceKey)) return null;
  if (getProductionBaseUrlIssues(supabaseUrl, "Supabase Auth base URL").length > 0) return null;

  const endpoint = authUserEndpoint(supabaseUrl);
  const endpointIssues = getProductionEndpointIssues(endpoint, "Supabase Auth user endpoint");
  if (endpointIssues.length > 0) return null;

  try {
    const response = await fetchRecoveryBackupProviderResponse(
      fetcher,
      endpoint,
      {
        method: "GET",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${token}`
        }
      },
      timeoutMs,
      "Supabase Auth user request"
    );
    if (!response.ok) return null;
    const payload = await readRecoveryBackupProviderJson(
      response,
      timeoutMs,
      responseMaxBytes,
      "Supabase Auth user response"
    ).catch(() => null);
    const userId = isRecord(payload) ? cleanOptionalText(payload.id, 180) : null;
    if (!userId) return null;
    return {
      provider: "supabase-auth",
      userHash: hashToken(userId)
    };
  } catch {
    return null;
  }
}

async function syncWithSupabase(
  request: RecoveryBackupSyncRequest,
  identity: RecoveryBackupSyncIdentity,
  syncedAt: string,
  options: { env?: Env; fetcher?: Fetcher } = {}
): Promise<RecoveryBackupSyncResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = readBackendProviderTimeoutMs(env);
  const responseMaxBytes = readBackendProviderResponseMaxBytes(env);
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const tableName = readEnv(env, "SUPABASE_RECOVERY_BACKUP_TABLE") ?? "encrypted_recovery_backups";
  const retentionDays = cleanRetentionDays(readEnv(env, "SUPABASE_RECOVERY_BACKUP_RETENTION_DAYS"));

  if (!supabaseUrl || !serviceKey) {
    return result(false, "unconfigured", "unconfigured", syncedAt, {
      action: request.action,
      reason: "Supabase encrypted backup sync is not configured."
    });
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return result(false, "invalid", "invalid", syncedAt, {
      action: request.action,
      reason: "Supabase encrypted backup sync service-role key is not production-shaped."
    });
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase encrypted backup base URL");
  if (baseIssues.length > 0) {
    return result(false, "invalid", "invalid", syncedAt, {
      action: request.action,
      reason: baseIssues.map((issue) => issue.issue).join("; ")
    });
  }

  const baseEndpoint = supabaseTableUrl(supabaseUrl, tableName);
  const endpointIssues = getProductionEndpointIssues(baseEndpoint, "Supabase encrypted backup endpoint");
  if (endpointIssues.length > 0) {
    return result(false, "invalid", "invalid", syncedAt, {
      action: request.action,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    });
  }

  try {
    if (request.action === "upload") {
      const envelope = request.envelope;
      if (!envelope) {
        return result(false, "invalid", "invalid", syncedAt, {
          action: "upload",
          reason: "Upload requires an encrypted backup envelope."
        });
      }

      const response = await fetchRecoveryBackupProviderResponse(
        fetcher,
        `${baseEndpoint}?on_conflict=user_hash`,
        {
          method: "POST",
          headers: supabaseHeaders(serviceKey, "resolution=merge-duplicates,return=minimal"),
          body: JSON.stringify({
            user_hash: identity.userHash,
            envelope_version: envelope.version,
            envelope,
            backup_created_at: envelope.createdAt,
            device_hash: request.deviceId ? hashToken(request.deviceId) : null,
            client_modified_at: request.clientModifiedAt ?? envelope.createdAt,
            retention_days: retentionDays,
            synced_at: syncedAt
          })
        },
        timeoutMs,
        "Supabase encrypted backup upload"
      );
      if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
      return result(true, "supabase", "ok", syncedAt, {
        action: "upload",
        version: RECOVERY_BACKUP_VERSION,
        backupCreatedAt: envelope.createdAt
      });
    }

    if (request.action === "download") {
      const endpoint = `${baseEndpoint}?select=envelope,envelope_version,backup_created_at,synced_at&user_hash=eq.${encodeURIComponent(identity.userHash)}&limit=1`;
      const response = await fetchRecoveryBackupProviderResponse(
        fetcher,
        endpoint,
        {
          method: "GET",
          headers: supabaseHeaders(serviceKey)
        },
        timeoutMs,
        "Supabase encrypted backup download"
      );
      if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
      const rows = await readRecoveryBackupProviderJson(
        response,
        timeoutMs,
        responseMaxBytes,
        "Supabase encrypted backup download response"
      ).catch(() => null);
      const first = Array.isArray(rows) ? rows[0] : null;
      const envelope = isRecord(first) ? sanitizeRecoveryBackupEnvelope(first.envelope) : null;
      if (!envelope) {
        return result(false, "supabase", "invalid", syncedAt, {
          action: "download",
          reason: "No encrypted recovery backup is available for this user."
        });
      }
      return result(true, "supabase", "ok", syncedAt, {
        action: "download",
        version: RECOVERY_BACKUP_VERSION,
        backupCreatedAt: envelope.createdAt,
        envelope
      });
    }

    const response = await fetchRecoveryBackupProviderResponse(
      fetcher,
      `${baseEndpoint}?user_hash=eq.${encodeURIComponent(identity.userHash)}`,
      {
        method: "DELETE",
        headers: supabaseHeaders(serviceKey, "return=minimal")
      },
      timeoutMs,
      "Supabase encrypted backup delete"
    );
    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
    return result(true, "supabase", "ok", syncedAt, {
      action: "delete"
    });
  } catch (error) {
    return result(false, "error", "error", syncedAt, {
      action: request.action,
      reason: error instanceof Error ? error.message : "Encrypted recovery backup sync failed."
    });
  }
}

async function fetchRecoveryBackupProviderResponse(
  fetcher: Fetcher,
  input: Parameters<Fetcher>[0],
  init: Parameters<Fetcher>[1],
  timeoutMs: number,
  label: string
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(input, { ...(init ?? {}), ...(controller ? { signal: controller.signal } : {}) }),
      timedOut
    ]);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readRecoveryBackupProviderJson(
  response: Response,
  timeoutMs: number,
  maxBytes: number,
  label: string
) {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}

function sanitizeRecoveryBackupEnvelope(value: unknown): RecoveryBackupEnvelope | null {
  if (!isRecord(value)) return null;
  if (containsForbiddenSyncKey(value)) return null;
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_ENVELOPE_BYTES) return null;

  const kdf = isRecord(value.kdf) ? value.kdf : null;
  const cipher = isRecord(value.cipher) ? value.cipher : null;
  const createdAt = cleanOptionalIsoDate(value.createdAt);
  const iterations = typeof kdf?.iterations === "number" ? kdf.iterations : null;

  if (
    value.app !== "FREED" ||
    value.version !== RECOVERY_BACKUP_VERSION ||
    !createdAt ||
    kdf?.name !== "PBKDF2-SHA256" ||
    cipher?.name !== "AES-GCM" ||
    !iterations ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !isBase64Text(kdf.salt, 512) ||
    !isBase64Text(cipher.iv, 256) ||
    !isBase64Text(value.payload, MAX_ENVELOPE_BYTES)
  ) {
    return null;
  }

  return {
    app: "FREED",
    version: RECOVERY_BACKUP_VERSION,
    createdAt,
    kdf: {
      name: "PBKDF2-SHA256",
      iterations,
      salt: String(kdf.salt)
    },
    cipher: {
      name: "AES-GCM",
      iv: String(cipher.iv)
    },
    payload: String(value.payload)
  };
}

function result(
  ok: boolean,
  provider: RecoveryBackupSyncResult["provider"],
  status: RecoveryBackupSyncResult["status"],
  syncedAt: string,
  extra: Omit<Partial<RecoveryBackupSyncResult>, "reason"> & { reason?: unknown } = {}
): RecoveryBackupSyncResult {
  const { reason, ...safeExtra } = extra;
  const safeReason = sanitizeSyncReason(reason);
  return {
    ok,
    provider,
    status,
    syncedAt,
    ...safeExtra,
    ...(safeReason ? { reason: safeReason } : {})
  };
}

function sanitizeRecoveryBackupSyncResult(
  value: unknown,
  fallbackAction: RecoveryBackupSyncAction,
  fallbackSyncedAt: string
): RecoveryBackupSyncResult {
  if (!isRecord(value)) {
    return result(false, "error", "error", fallbackSyncedAt, {
      action: fallbackAction,
      reason: "Recovery backup sync provider returned a malformed response."
    });
  }

  const status = cleanSyncStatus(value.status);
  const action = cleanSyncAction(value.action) ?? fallbackAction;
  const syncedAt = cleanOptionalIsoDate(value.syncedAt) ?? fallbackSyncedAt;
  const backupCreatedAt = cleanOptionalIsoDate(value.backupCreatedAt);
  const envelope = action === "download" ? sanitizeRecoveryBackupEnvelope(value.envelope) : null;

  return result(value.ok === true && status === "ok", cleanSyncProvider(value.provider), status, syncedAt, {
    action,
    ...(value.version === RECOVERY_BACKUP_VERSION ? { version: RECOVERY_BACKUP_VERSION } : {}),
    ...(backupCreatedAt ? { backupCreatedAt } : {}),
    ...(envelope ? { envelope } : {}),
    reason: value.reason
  });
}

function containsForbiddenSyncKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenSyncKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => {
    if (forbiddenSyncKeys.has(normalizeSyncKey(key))) return true;
    return containsForbiddenSyncKey(nested);
  });
}

function hasOnlyAllowedSyncKeys(value: Record<string, unknown>, allowedKeys: Set<string>) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1]?.trim() : "";
  return token && token.length >= 16 ? token : null;
}

function authUserEndpoint(supabaseUrl: string) {
  try {
    return new URL("/auth/v1/user", supabaseUrl).toString();
  } catch {
    return supabaseUrl;
  }
}

function supabaseTableUrl(supabaseUrl: string, tableName: string) {
  const safeTable = encodeURIComponent(tableName.replace(/[^\w-]/g, ""));
  try {
    return new URL(`/rest/v1/${safeTable}`, supabaseUrl).toString();
  } catch {
    return supabaseUrl;
  }
}

function supabaseHeaders(serviceKey: string, prefer?: string) {
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...(prefer ? { Prefer: prefer } : {})
  };
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function cleanOptionalRouteMetadataText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null;
  if (containsSensitiveOperationalText(trimmed)) return null;
  return trimmed;
}

function cleanOptionalIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function cleanRetentionDays(value: string | null) {
  const parsed = value ? Number(value) : DEFAULT_RETENTION_DAYS;
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.max(1, Math.min(365, Math.floor(parsed)));
}

function isBase64Text(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function hashToken(value: string) {
  return `sha256-${createHash("sha256").update(value).digest("hex")}`;
}

function cleanSyncProvider(value: unknown): RecoveryBackupSyncResult["provider"] {
  return value === "supabase" ||
    value === "custom" ||
    value === "unconfigured" ||
    value === "invalid" ||
    value === "unauthorized" ||
    value === "error"
    ? value
    : "error";
}

function cleanSyncStatus(value: unknown): RecoveryBackupSyncResult["status"] {
  return value === "ok" || value === "unconfigured" || value === "invalid" || value === "unauthorized" || value === "error"
    ? value
    : "error";
}

function cleanSyncAction(value: unknown): RecoveryBackupSyncAction | null {
  return value === "upload" || value === "download" || value === "delete" ? value : null;
}

function sanitizeSyncReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function normalizeSyncKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
