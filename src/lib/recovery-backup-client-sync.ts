import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { redactOperationalText } from "@/lib/operational-redaction";
import { safeUserFacingMessage } from "@/lib/user-facing-error";
import {
  createEncryptedRecoveryBackup,
  restoreEncryptedRecoveryBackup,
  type RecoveryBackupEnvelope
} from "@/lib/recovery-backup";
import type { RecoveryState } from "@/lib/recovery-state";

type Fetcher = typeof fetch;

const DEFAULT_RECOVERY_BACKUP_SYNC_TIMEOUT_MS = 8_000;
const MIN_RECOVERY_BACKUP_SYNC_TIMEOUT_MS = 500;
const MAX_RECOVERY_BACKUP_SYNC_TIMEOUT_MS = 15_000;
const DEFAULT_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES = 2_000_000;
const MIN_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES = 1_024;
const MAX_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES = 5_000_000;

export type RecoveryBackupClientSyncConfig = {
  endpointUrl?: string | null;
  getAuthToken?: () => Promise<string | null> | string | null;
  fetcher?: Fetcher;
};

export type RecoveryBackupClientSyncReadiness = {
  ready: boolean;
  configured: boolean;
  missing: string[];
  dataBoundary: string;
};

export type RecoveryBackupClientSyncResult = {
  ok: boolean;
  status: "ok" | "unconfigured" | "invalid" | "unauthorized" | "error";
  action: "upload" | "download" | "delete";
  syncedAt?: string;
  backupCreatedAt?: string;
  reason?: string;
};

export type RecoveryBackupDownloadResult = RecoveryBackupClientSyncResult & {
  restoredState?: RecoveryState;
};

export function getRecoveryBackupClientSyncReadiness(
  config: RecoveryBackupClientSyncConfig = {}
): RecoveryBackupClientSyncReadiness {
  const endpointUrl = resolveEndpointUrl(config);
  const missing = [
    ...getProductionEndpointIssues(endpointUrl, "Recovery backup sync endpoint").map((issue) => issue.issue),
    ...(!config.getAuthToken ? ["signed-in account token provider"] : [])
  ];
  const uniqueMissing = Array.from(new Set(missing.filter(Boolean))).sort();
  return {
    ready: uniqueMissing.length === 0,
    configured: Boolean(endpointUrl),
    missing: uniqueMissing,
    dataBoundary:
      "Creates and restores backups on-device. Hosted sync sends only the encrypted backup envelope plus route metadata, never the passphrase or decrypted recovery state."
  };
}

export async function uploadEncryptedRecoveryBackup(
  state: RecoveryState,
  passphrase: string,
  config: RecoveryBackupClientSyncConfig = {}
): Promise<RecoveryBackupClientSyncResult> {
  const encrypted = await createEncryptedRecoveryBackup(state, passphrase);
  const envelope = JSON.parse(encrypted) as RecoveryBackupEnvelope;
  const result = await postRecoveryBackupSync(
    {
      action: "upload",
      envelope,
      clientModifiedAt: envelope.createdAt
    },
    config
  );
  return sanitizeSyncResult(result, "upload");
}

export async function downloadEncryptedRecoveryBackup(
  passphrase: string,
  config: RecoveryBackupClientSyncConfig = {}
): Promise<RecoveryBackupDownloadResult> {
  const result = await postRecoveryBackupSync({ action: "download" }, config);
  const sanitized = sanitizeSyncResult(result, "download");
  if (!sanitized.ok) return sanitized;

  const envelope = isRecord(result) ? sanitizeEnvelope(result.envelope) : null;
  if (!envelope) {
    return {
      ...sanitized,
      ok: false,
      status: "invalid",
      reason: "Hosted recovery backup did not include a valid encrypted envelope."
    };
  }

  const restoredState = await restoreEncryptedRecoveryBackup(JSON.stringify(envelope), passphrase);
  return {
    ...sanitized,
    restoredState
  };
}

export async function deleteHostedRecoveryBackup(
  config: RecoveryBackupClientSyncConfig = {}
): Promise<RecoveryBackupClientSyncResult> {
  const result = await postRecoveryBackupSync({ action: "delete" }, config);
  return sanitizeSyncResult(result, "delete");
}

async function postRecoveryBackupSync(
  payload: Record<string, unknown>,
  config: RecoveryBackupClientSyncConfig
): Promise<unknown> {
  const endpointUrl = resolveEndpointUrl(config);
  const readiness = getRecoveryBackupClientSyncReadiness(config);
  if (!endpointUrl || !readiness.ready) {
    return {
      ok: false,
      status: endpointUrl ? "invalid" : "unconfigured",
      reason: readiness.missing.join("; ")
    };
  }

  const token = await resolveAuthToken(config);
  if (!token) {
    return {
      ok: false,
      status: "unauthorized",
      reason: "Recovery backup sync needs a signed-in account."
    };
  }

  try {
    const { response, body } = await postRecoveryBackupSyncWithTimeout(
      config.fetcher ?? fetch,
      endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      },
      normalizeRecoveryBackupSyncTimeoutMs(readRecoveryBackupSyncTimeoutMs()),
      normalizeRecoveryBackupSyncResponseMaxBytes(readRecoveryBackupSyncResponseMaxBytes())
    );
    if (!response.ok && isRecord(body)) return body;
    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        reason: `Recovery backup sync returned ${response.status}.`
      };
    }
    return body;
  } catch (error) {
    return {
      ok: false,
      status: "error",
      reason: safeUserFacingMessage(error, "Recovery backup sync request failed.")
    };
  }
}

async function resolveAuthToken(config: RecoveryBackupClientSyncConfig) {
  const token = await config.getAuthToken?.();
  return typeof token === "string" && token.trim().length >= 16 ? token.trim() : null;
}

function resolveEndpointUrl(config: RecoveryBackupClientSyncConfig) {
  const value = config.endpointUrl ?? process.env.EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function postRecoveryBackupSyncWithTimeout(
  fetcher: Fetcher,
  endpointUrl: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Recovery backup sync request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetcher(endpointUrl, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
    const body = await readBoundedResponseJson(response, {
      timeoutMs,
      maxBytes,
      label: "Recovery backup sync response",
      abort: () => controller?.abort()
    });
    return { response, body };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readRecoveryBackupSyncTimeoutMs() {
  return process.env.EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_TIMEOUT_MS?.trim() ?? "";
}

function readRecoveryBackupSyncResponseMaxBytes() {
  return process.env.EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES?.trim() ?? "";
}

function normalizeRecoveryBackupSyncTimeoutMs(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RECOVERY_BACKUP_SYNC_TIMEOUT_MS;
  return Math.max(MIN_RECOVERY_BACKUP_SYNC_TIMEOUT_MS, Math.min(MAX_RECOVERY_BACKUP_SYNC_TIMEOUT_MS, Math.round(parsed)));
}

function normalizeRecoveryBackupSyncResponseMaxBytes(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES,
    Math.min(MAX_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

function sanitizeSyncResult(value: unknown, action: RecoveryBackupClientSyncResult["action"]): RecoveryBackupClientSyncResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      status: "error",
      action,
      reason: "Recovery backup sync response was malformed."
    };
  }
  const status = cleanStatus(value.status);
  const syncedAt = cleanIsoDate(value.syncedAt);
  const backupCreatedAt = cleanIsoDate(value.backupCreatedAt);
  const reason = sanitizeSyncReason(value.reason);
  return {
    ok: value.ok === true,
    status,
    action,
    ...(syncedAt ? { syncedAt } : {}),
    ...(backupCreatedAt ? { backupCreatedAt } : {}),
    ...(reason ? { reason } : {})
  };
}

function sanitizeEnvelope(value: unknown): RecoveryBackupEnvelope | null {
  if (!isRecord(value)) return null;
  const createdAt = cleanIsoDate(value.createdAt);
  if (
    value.app !== "FREED" ||
    value.version !== 1 ||
    !createdAt ||
    !isRecord(value.kdf) ||
    !isRecord(value.cipher) ||
    value.kdf.name !== "PBKDF2-SHA256" ||
    value.cipher.name !== "AES-GCM" ||
    typeof value.kdf.iterations !== "number" ||
    typeof value.kdf.salt !== "string" ||
    typeof value.cipher.iv !== "string" ||
    typeof value.payload !== "string"
  ) {
    return null;
  }

  return {
    app: "FREED",
    version: 1,
    createdAt,
    kdf: {
      name: "PBKDF2-SHA256",
      iterations: value.kdf.iterations,
      salt: value.kdf.salt
    },
    cipher: {
      name: "AES-GCM",
      iv: value.cipher.iv
    },
    payload: value.payload
  };
}

function cleanStatus(value: unknown): RecoveryBackupClientSyncResult["status"] {
  return value === "ok" || value === "unconfigured" || value === "invalid" || value === "unauthorized" || value === "error"
    ? value
    : "error";
}

function cleanIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sanitizeSyncReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
