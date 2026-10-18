import {
  buildPortableRecoverySessionState,
  hydrateRecoveryState,
  type RecoveryState
} from "@/lib/recovery-state";
import { projectRecoveryStateForOffDevice } from "@/lib/recovery-signal-privacy";
import { validateJournalTextBackup, type JournalTextBackup } from './journal-text-backup';
import {
  assertBackupCryptoAvailable,
  decryptBackupPayload,
  encryptBackupPayload,
  generateBackupRandomBase64
} from "@/lib/backup-crypto";
import {
  BACKUP_KDF_ITERATIONS,
  BACKUP_SALT_BYTES,
  BACKUP_IV_BYTES,
  MAX_BACKUP_ENVELOPE_CHARS,
  validateBackupCiphertext,
  validateBackupSaltAndIv
} from "@/lib/backup-crypto-format";

export const RECOVERY_BACKUP_VERSION = 1;
const BACKUP_APP_ID = "FREED";

export type RecoveryBackupEnvelope = {
  app: typeof BACKUP_APP_ID;
  version: typeof RECOVERY_BACKUP_VERSION;
  createdAt: string;
  kdf: {
    name: "PBKDF2-SHA256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  payload: string;
};

type RecoveryBackupPayload = {
  app: typeof BACKUP_APP_ID;
  version: typeof RECOVERY_BACKUP_VERSION;
  exportedAt: string;
  state: Omit<RecoveryState, "premiumEntitlement">;
  journal?: JournalTextBackup;
};

function assertUsablePassphrase(passphrase: string) {
  if (passphrase.trim().length < 8) {
    throw new Error("Recovery backup passphrase must be at least 8 characters.");
  }
}

export function buildPortableRecoveryState(
  state: unknown,
  exportedAt = new Date().toISOString()
): Omit<RecoveryState, "premiumEntitlement"> {
  return buildRestoredRecoveryState(projectRecoveryStateForOffDevice(state), exportedAt);
}

/** Legacy inbound history remains local; only the outbound mapping projects data. */
function buildRestoredRecoveryState(
  state: unknown,
  exportedAt = new Date().toISOString()
): Omit<RecoveryState, "premiumEntitlement"> {
  const hydrated = hydrateRecoveryState(state);
  const portable = hydrateRecoveryState({
    ...hydrated,
    ...buildPortableRecoverySessionState(hydrated, exportedAt),
    // Purchases must be reverified and protection must be activated on this device.
    premium: false,
    premiumPlanId: null,
    premiumPlanAudience: null,
    premiumActivatedAt: null,
    premiumEntitlement: null,
    automaticBackupEnabled: false,
    protectionActivatedAt: null,
    protectionActivationPlatform: null,
    protectionSetupFallback: null,
    vpnDisclosureAcknowledgedAt: null,
    reminders: {
      ...hydrated.reminders,
      scheduledIds: [],
      permissionStatus: "undetermined",
      effectiveStatus: hydrated.reminders.enabled ? "pending" : "off",
      timezone: null,
      statusMessage: "Recovery reminders need to be scheduled on this device.",
      lastScheduledAt: null
    }
  });
  // Optional store-verification metadata is never part of a portable backup.
  const { premiumEntitlement: _entitlement, ...portableState } = portable as RecoveryState & { premiumEntitlement?: unknown };
  const portableWithoutLocalConsent = { ...portableState, automaticBackupEnabled: false };
  return portableWithoutLocalConsent;
}

function parseEnvelope(serialized: string): RecoveryBackupEnvelope {
  if (serialized.length > MAX_BACKUP_ENVELOPE_CHARS) {
    throw new Error("Recovery backup exceeds the size limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Recovery backup is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Recovery backup has an invalid envelope.");
  }

  const envelope = parsed as Partial<RecoveryBackupEnvelope>;
  if (
    envelope.app !== BACKUP_APP_ID ||
    envelope.version !== RECOVERY_BACKUP_VERSION ||
    envelope.kdf?.name !== "PBKDF2-SHA256" ||
    envelope.cipher?.name !== "AES-GCM" ||
    typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt)) ||
    envelope.kdf.iterations !== BACKUP_KDF_ITERATIONS ||
    typeof envelope.kdf.salt !== "string" ||
    typeof envelope.cipher.iv !== "string" ||
    typeof envelope.payload !== "string"
  ) {
    throw new Error("Recovery backup envelope is unsupported.");
  }
  validateBackupSaltAndIv(envelope.kdf.salt, envelope.cipher.iv);
  validateBackupCiphertext(envelope.payload);

  return envelope as RecoveryBackupEnvelope;
}

export function getRecoveryBackupReadiness() {
  try {
    assertBackupCryptoAvailable();
    return {
      status: "ready" as const,
      missing: [] as string[]
    };
  } catch (error) {
    return {
      status: "unavailable" as const,
      missing: [error instanceof Error ? error.message : "Backup crypto support is unavailable."]
    };
  }
}

export async function createEncryptedRecoveryBackup(
  state: RecoveryState,
  passphrase: string,
  exportedAt = new Date().toISOString(),
  journal?: JournalTextBackup
): Promise<string> {
  assertUsablePassphrase(passphrase);

  const salt = await generateBackupRandomBase64(BACKUP_SALT_BYTES);
  const iv = await generateBackupRandomBase64(BACKUP_IV_BYTES);
  const payload: RecoveryBackupPayload = {
    app: BACKUP_APP_ID,
    version: RECOVERY_BACKUP_VERSION,
    exportedAt,
    state: buildPortableRecoveryState(state, exportedAt),
    ...(journal ? { journal: validateJournalTextBackup(journal) } : {})
  };
  const encrypted = await encryptBackupPayload(passphrase, salt, iv, JSON.stringify(payload));
  const envelope: RecoveryBackupEnvelope = {
    app: BACKUP_APP_ID,
    version: RECOVERY_BACKUP_VERSION,
    createdAt: exportedAt,
    kdf: {
      name: "PBKDF2-SHA256",
      iterations: BACKUP_KDF_ITERATIONS,
      salt
    },
    cipher: {
      name: "AES-GCM",
      iv
    },
    payload: encrypted
  };

  return JSON.stringify(envelope);
}

export async function restoreEncryptedRecoveryBackupContent(serialized: string, passphrase: string): Promise<{ state: RecoveryState; journal?: JournalTextBackup }> {
  assertUsablePassphrase(passphrase);

  const envelope = parseEnvelope(serialized);
  assertBackupCryptoAvailable();

  try {
    const decoded = await decryptBackupPayload(passphrase, envelope.kdf.salt, envelope.cipher.iv, envelope.payload);
    const payload = JSON.parse(decoded) as Partial<RecoveryBackupPayload>;
    if (payload.app !== BACKUP_APP_ID || payload.version !== RECOVERY_BACKUP_VERSION ||
        typeof payload.exportedAt !== "string" || !Number.isFinite(Date.parse(payload.exportedAt)) ||
        typeof payload.state !== "object" || payload.state === null || Array.isArray(payload.state)) {
      throw new Error("Recovery backup payload is unsupported.");
    }
    return { state: hydrateRecoveryState(buildRestoredRecoveryState(payload.state, payload.exportedAt)),
      ...(payload.journal !== undefined ? { journal: validateJournalTextBackup(payload.journal) } : {}) };
  } catch {
    throw new Error("Recovery backup could not be decrypted with this passphrase.");
  }
}
export async function restoreEncryptedRecoveryBackup(serialized: string, passphrase: string): Promise<RecoveryState> {
  return (await restoreEncryptedRecoveryBackupContent(serialized, passphrase)).state;
}
