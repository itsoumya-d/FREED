import {
  hydrateRecoveryState,
  type RecoveryState
} from "@/lib/recovery-state";

export const RECOVERY_BACKUP_VERSION = 1;
const BACKUP_APP_ID = "FREED";
const KDF_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

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
  state: RecoveryState;
};

function getWebCrypto() {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") {
    throw new Error("Encrypted recovery backup requires Web Crypto support.");
  }
  return crypto;
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function assertUsablePassphrase(passphrase: string) {
  if (passphrase.trim().length < 8) {
    throw new Error("Recovery backup passphrase must be at least 8 characters.");
  }
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]) {
  const crypto = getWebCrypto();
  const material = await crypto.subtle.importKey("raw", encodeText(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytesToArrayBuffer(salt),
      iterations,
      hash: "SHA-256"
    },
    material,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    usage
  );
}

function buildPortableRecoveryState(state: RecoveryState): RecoveryState {
  const hydrated = hydrateRecoveryState(state);
  return hydrateRecoveryState({
    ...hydrated,
    reminders: {
      ...hydrated.reminders,
      scheduledIds: [],
      permissionStatus: "unknown",
      statusMessage: "Recovery reminders need to be scheduled on this device.",
      lastScheduledAt: null
    }
  });
}

function parseEnvelope(serialized: string): RecoveryBackupEnvelope {
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
    typeof envelope.createdAt !== "string" ||
    typeof envelope.kdf.iterations !== "number" ||
    typeof envelope.kdf.salt !== "string" ||
    typeof envelope.cipher.iv !== "string" ||
    typeof envelope.payload !== "string"
  ) {
    throw new Error("Recovery backup envelope is unsupported.");
  }

  return envelope as RecoveryBackupEnvelope;
}

export function getRecoveryBackupReadiness() {
  try {
    getWebCrypto();
    return {
      status: "ready" as const,
      missing: [] as string[]
    };
  } catch (error) {
    return {
      status: "unavailable" as const,
      missing: [error instanceof Error ? error.message : "Web Crypto support is unavailable."]
    };
  }
}

export async function createEncryptedRecoveryBackup(
  state: RecoveryState,
  passphrase: string,
  exportedAt = new Date().toISOString()
): Promise<string> {
  assertUsablePassphrase(passphrase);

  const crypto = getWebCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveBackupKey(passphrase, salt, KDF_ITERATIONS, ["encrypt"]);
  const payload: RecoveryBackupPayload = {
    app: BACKUP_APP_ID,
    version: RECOVERY_BACKUP_VERSION,
    exportedAt,
    state: buildPortableRecoveryState(state)
  };
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: bytesToArrayBuffer(iv)
    },
    key,
    encodeText(JSON.stringify(payload))
  );
  const envelope: RecoveryBackupEnvelope = {
    app: BACKUP_APP_ID,
    version: RECOVERY_BACKUP_VERSION,
    createdAt: exportedAt,
    kdf: {
      name: "PBKDF2-SHA256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt)
    },
    cipher: {
      name: "AES-GCM",
      iv: bytesToBase64(iv)
    },
    payload: bytesToBase64(new Uint8Array(encrypted))
  };

  return JSON.stringify(envelope);
}

export async function restoreEncryptedRecoveryBackup(serialized: string, passphrase: string): Promise<RecoveryState> {
  assertUsablePassphrase(passphrase);

  const envelope = parseEnvelope(serialized);
  const crypto = getWebCrypto();
  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.cipher.iv);
  const encrypted = base64ToBytes(envelope.payload);
  const key = await deriveBackupKey(passphrase, salt, envelope.kdf.iterations, ["decrypt"]);

  try {
    const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytesToArrayBuffer(iv)
    },
      key,
      encrypted
    );
    const decoded = new TextDecoder().decode(decrypted);
    const payload = JSON.parse(decoded) as Partial<RecoveryBackupPayload>;
    if (payload.app !== BACKUP_APP_ID || payload.version !== RECOVERY_BACKUP_VERSION || !payload.state) {
      throw new Error("Recovery backup payload is unsupported.");
    }
    return buildPortableRecoveryState(hydrateRecoveryState(payload.state));
  } catch {
    throw new Error("Recovery backup could not be decrypted with this passphrase.");
  }
}
