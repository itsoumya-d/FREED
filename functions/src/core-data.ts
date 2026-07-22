import { createHash } from "node:crypto";

/** Pure, dependency-injected workflows for Firebase-owned data operations. */

export const BACKUP_MAX_BYTES = 100 * 1024 * 1024;
export const SIGNED_URL_TTL_MS = 10 * 60 * 1000;
export const ACCOUNT_DELETION_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const USER_LINKED_RECORD_SCOPES = [
  "backup_metadata",
  "push_tokens",
  "notification_jobs",
  "redacted_ai_events",
  "backend_jobs",
  "rate_limits",
  "leases",
  "idempotency",
  "purchase_claims",
  "purchase_audits"
] as const;

const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,200}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GENERATION = /^\d+$/;

export type BackupGenerationState = {
  expectedBytes: number;
  ciphertextSha256: string;
  objectPath: string;
  status: "preparing" | "uploading" | "verifying" | "verified" | "invalid";
  uploadSessionId: string;
  sentinelGeneration?: string;
  objectGeneration?: string;
};

export type VerificationClaim = {
  uploadSessionId: string;
  sentinelGeneration: string;
  objectGeneration: string;
  expectedBytes: number;
  ciphertextSha256: string;
  objectPath: string;
};

export function getBackupObjectPath(uid: string, backupId: string): string {
  if (!PATH_SEGMENT.test(uid) || !PATH_SEGMENT.test(backupId)) throw new Error("Invalid backup identity.");
  return `recovery-backups/${uid}/${backupId}.bin`;
}

export function getSignedUrlSpec(
  action: "read",
  now: number,
  expectedBytes: undefined,
  generation: string
): { version: "v4"; action: "read"; expires: number; queryParams: Record<string, string> };
export function getSignedUrlSpec(
  action: "write",
  now: number,
  expectedBytes: number | undefined,
  generation: string
): {
  version: "v4";
  action: "write";
  expires: number;
  contentType: string;
  extensionHeaders: { "content-length": string; "x-goog-if-generation-match": string };
};
export function getSignedUrlSpec(
  action: "read" | "write",
  now: number,
  expectedBytes: number | undefined,
  generation: string
) {
  if (!GENERATION.test(generation)) throw new Error("Invalid object generation.");
  const common = { version: "v4" as const, action, expires: now + SIGNED_URL_TTL_MS };
  if (action === "read") return { ...common, queryParams: { generation } as Record<string, string> };
  if (!Number.isInteger(expectedBytes) || expectedBytes === undefined || expectedBytes < 0 || expectedBytes > BACKUP_MAX_BYTES) {
    throw new Error("Invalid encrypted backup size.");
  }
  return {
    ...common,
    contentType: "application/octet-stream",
    extensionHeaders: {
      "content-length": String(expectedBytes),
      "x-goog-if-generation-match": generation
    }
  };
}

export function assertBackupStartAllowed(metadata: BackupGenerationState | undefined): void {
  if (metadata && metadata.status !== "invalid") throw new Error("This backup ID is already active.");
}

export function createVerificationClaim(
  metadata: BackupGenerationState,
  objectGeneration: string
): VerificationClaim {
  if (metadata.status !== "uploading" || !metadata.sentinelGeneration) {
    throw new Error("The backup is not ready for finalization.");
  }
  if (!GENERATION.test(objectGeneration) || objectGeneration === metadata.sentinelGeneration) {
    throw new Error("A fresh uploaded generation is required.");
  }
  return {
    uploadSessionId: metadata.uploadSessionId,
    sentinelGeneration: metadata.sentinelGeneration,
    objectGeneration,
    expectedBytes: metadata.expectedBytes,
    ciphertextSha256: metadata.ciphertextSha256,
    objectPath: metadata.objectPath
  };
}

export function assertVerificationCommit(metadata: BackupGenerationState, claim: VerificationClaim): void {
  if (
    metadata.status !== "verifying" ||
    metadata.uploadSessionId !== claim.uploadSessionId ||
    metadata.sentinelGeneration !== claim.sentinelGeneration ||
    metadata.objectGeneration !== claim.objectGeneration ||
    metadata.expectedBytes !== claim.expectedBytes ||
    metadata.ciphertextSha256 !== claim.ciphertextSha256 ||
    metadata.objectPath !== claim.objectPath
  ) {
    throw new Error("The verification session changed.");
  }
}

export function assertAcceptableContentEncoding(contentEncoding: string | undefined): void {
  if (contentEncoding !== undefined && contentEncoding !== "identity") {
    throw new Error("Ciphertext content encoding is not permitted.");
  }
}

export async function verifyCiphertext(input: {
  source: AsyncIterable<Uint8Array>;
  expectedBytes: number;
  expectedSha256: string;
  removeInvalid: () => Promise<void>;
}): Promise<{ ok: boolean; verifiedBytes: number; sha256: string }> {
  if (!Number.isInteger(input.expectedBytes) || input.expectedBytes < 0 || input.expectedBytes > BACKUP_MAX_BYTES) {
    throw new Error("Invalid encrypted backup size.");
  }
  if (!SHA256.test(input.expectedSha256)) throw new Error("Invalid ciphertext SHA-256.");

  const hash = createHash("sha256");
  let verifiedBytes = 0;
  for await (const chunk of input.source) {
    verifiedBytes += chunk.byteLength;
    hash.update(chunk);
    if (verifiedBytes > input.expectedBytes || verifiedBytes > BACKUP_MAX_BYTES) break;
  }
  const sha256 = hash.digest("hex");
  const ok = verifiedBytes === input.expectedBytes && sha256 === input.expectedSha256;
  if (!ok) await input.removeInvalid();
  return { ok, verifiedBytes, sha256 };
}

export function requireVerifiedBackup(input: {
  requesterUid: string;
  backupId: string;
  metadata: { uid: string; backupId: string; objectPath: string; status: string } | undefined;
}): string {
  const expectedPath = getBackupObjectPath(input.requesterUid, input.backupId);
  if (
    !input.metadata ||
    input.metadata.uid !== input.requesterUid ||
    input.metadata.backupId !== input.backupId ||
    input.metadata.objectPath !== expectedPath ||
    input.metadata.status !== "verified"
  ) {
    throw new Error("A verified backup is not available.");
  }
  return expectedPath;
}

export async function deleteEncryptedBackup(input: {
  objectPath: string;
  deleteObject: (path: string) => Promise<void>;
  deleteMetadata: () => Promise<void>;
  isObjectNotFound: (error: unknown) => boolean;
}): Promise<void> {
  try {
    await input.deleteObject(input.objectPath);
  } catch (error) {
    if (!input.isObjectNotFound(error)) throw error;
  }
  await input.deleteMetadata();
}

export async function deleteFirebaseAccountData(
  uid: string,
  deps: {
    deleteBackupObjects: (uid: string) => Promise<void>;
    deleteRecords: (scope: string, uid: string) => Promise<void>;
    deleteAuthIdentity: (uid: string) => Promise<void>;
  }
): Promise<void> {
  await deps.deleteBackupObjects(uid);
  for (const scope of USER_LINKED_RECORD_SCOPES) await deps.deleteRecords(scope, uid);
  await deps.deleteAuthIdentity(uid);
}

export async function sweepFirebaseAccountDeletion(
  uid: string,
  now: number,
  deps: Parameters<typeof deleteFirebaseAccountData>[1]
): Promise<{ status: "cooldown"; expiresAt: number }> {
  await deleteFirebaseAccountData(uid, deps);
  return { status: "cooldown", expiresAt: now + ACCOUNT_DELETION_COOLDOWN_MS };
}

export function getDeletionFenceAction(
  fence: { status: "deleting" } | { status: "cooldown"; expiresAt: number },
  now: number
): "retry" | "retain" | "remove" {
  if (fence.status === "deleting") return "retry";
  return fence.expiresAt <= now ? "remove" : "retain";
}
