import { randomUUID } from "node:crypto";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, FieldValue, getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";

import {
  COLLECTIONS,
  parseAggregateAnalytics,
  parseBackupDownload,
  parseDeleteBackup,
  parseDeletionRequest,
  parseFinalizeBackupUpload,
  parsePushTokenRegistration,
  parseStartBackupUpload,
  type BackupMetadataDocument,
  validateServerDocument
} from "./contracts.js";
import {
  assertAcceptableContentEncoding,
  assertBackupStartAllowed,
  assertVerificationCommit,
  createVerificationClaim,
  deleteEncryptedBackup as deleteEncryptedBackupObject,
  getDeletionFenceAction,
  getBackupObjectPath,
  getSignedUrlSpec,
  requireVerifiedBackup,
  sweepFirebaseAccountDeletion,
  verifyCiphertext,
  type VerificationClaim
} from "./core-data.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

export { getReviewedAdultDomainFeed, refreshReviewedAdultDomainFeed } from "./adult-feed-firebase.js";
export { generateClaraReply, generateChallenges, generateRetentionPlan } from "./ai-firebase.js";
export { verifyStorePurchase } from "./purchase-firebase.js";
export { dispatchReviewedNotifications } from "./notification-firebase.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const REGION = "asia-south1";
const DAY_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 7 * DAY_MS;
const RATE_LIMIT_TTL_MS = 60 * 1000;

setGlobalOptions({ region: REGION, maxInstances: 5 });

/** A tiny authenticated health contract; it accepts no personal or recovery data. */
export const backendReadiness = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  await mutate(uid, "readiness", "readiness", 10, async () => undefined);
  return { ok: true, projectRegion: REGION, acceptsRecoveryContent: false, appCheckRequired: true };
});

/** Bounded daily counters only. Raw URLs, hosts, and user text are rejected by the parser. */
export const ingestAggregateAnalytics = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseAggregateAnalytics(request.data));
  const duplicate = await mutate(uid, "analytics", input.clientEventId, 30, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.aggregateAnalytics, input.day, {
      day: input.day,
      checkIns: FieldValue.increment(input.checkIns),
      completedChallenges: FieldValue.increment(input.completedChallenges),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * DAY_MS)
    }, true);
  });
  return { ok: true, duplicate };
});

/** Creates a short-lived signed PUT URL for an opaque, server-derived object key. */
export const startEncryptedBackupUpload = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseStartBackupUpload(request.data));
  const objectPath = getBackupObjectPath(uid, input.backupId);
  const uploadSessionId = randomUUID();
  let claim: Awaited<ReturnType<typeof claimBackupStart>>;
  try {
    claim = await claimBackupStart(uid, input, objectPath, uploadSessionId);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "The encrypted backup upload could not be started.");
  }
  let metadata = claim.metadata;
  if (!matchesBackupRequest(metadata, uid, input.backupId, objectPath, input.encryptedBytes, input.ciphertextSha256)) {
    throw new HttpsError("failed-precondition", "The encrypted backup upload could not be started.");
  }
  if (metadata.status !== "preparing" && metadata.status !== "uploading") {
    throw new HttpsError("failed-precondition", "This backup ID is already active.");
  }

  let sentinelGeneration = metadata.sentinelGeneration;
  if (!sentinelGeneration) {
    sentinelGeneration = await createUploadSentinel(objectPath, claim.previousObjectGeneration);
    try {
      await bindUploadSentinel(uid, input.backupId, metadata.uploadSessionId, sentinelGeneration);
    } catch {
      await safeDeleteObjectGeneration(objectPath, sentinelGeneration);
      throw new HttpsError("failed-precondition", "The encrypted backup upload could not be started.");
    }
    metadata = (await getActiveBackupMetadata(uid, input.backupId)) ?? metadata;
  }
  const now = Date.now();
  const spec = getSignedUrlSpec("write", now, input.encryptedBytes, sentinelGeneration);
  const [signedUrl] = await bucket.file(objectPath).getSignedUrl(spec);
  return {
    ok: true,
    duplicate: claim.duplicate,
    status: metadata.status,
    signedUrl,
    objectKey: objectPath,
    expiresAt: new Date(spec.expires).toISOString(),
    requiredHeaders: {
      "content-type": "application/octet-stream",
      "content-length": String(input.encryptedBytes),
      "x-goog-if-generation-match": sentinelGeneration
    }
  };
});

/** Streams ciphertext bytes to verify their byte count and SHA-256; no envelope parsing occurs. */
export const finalizeEncryptedBackupUpload = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseFinalizeBackupUpload(request.data));
  const existing = await getActiveBackupMetadata(uid, input.backupId);
  const objectPath = requireOwnedBackup(uid, input.backupId, existing);
  // requireOwnedBackup has already established that metadata is present.
  const owned = existing as BackupMetadataDocument;
  if (owned.status === "verified") {
    return { ok: true, duplicate: true, status: "verified", verifiedBytes: owned.verifiedBytes };
  }
  if (owned.status === "invalid") {
    await safeDeleteObject(objectPath);
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }

  let claim: VerificationClaim;
  if (owned.status === "uploading") {
    const [objectMetadata] = await bucket.file(objectPath).getMetadata();
    claim = createVerificationClaim(owned, requiredGeneration(objectMetadata.generation));
  } else if (owned.status === "verifying") {
    claim = verificationClaimFromMetadata(owned);
  } else {
    throw new HttpsError("failed-precondition", "The encrypted backup is not ready for finalization.");
  }
  const duplicate = await claimBackupFinalization(uid, input.backupId, input.clientEventId, claim);
  const generationFile = bucket.file(objectPath, { generation: claim.objectGeneration });
  const [objectMetadata] = await generationFile.getMetadata();
  try {
    assertAcceptableContentEncoding(objectMetadata.contentEncoding);
  } catch {
    await safeDeleteObjectGeneration(objectPath, claim.objectGeneration);
    await commitBackupVerification(uid, input.backupId, claim, "invalid", 0);
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }

  let result: Awaited<ReturnType<typeof verifyCiphertext>>;
  try {
    result = await verifyCiphertext({
      source: generationFile.createReadStream({ decompress: false }) as AsyncIterable<Uint8Array>,
      expectedBytes: claim.expectedBytes,
      expectedSha256: claim.ciphertextSha256,
      removeInvalid: () => safeDeleteObjectGeneration(objectPath, claim.objectGeneration)
    });
  } catch {
    throw new HttpsError("failed-precondition", "The encrypted backup could not be verified.");
  }

  if (!result.ok) {
    await commitBackupVerification(uid, input.backupId, claim, "invalid", result.verifiedBytes);
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }
  await commitBackupVerification(uid, input.backupId, claim, "verified", result.verifiedBytes);
  return { ok: true, duplicate, status: "verified", verifiedBytes: result.verifiedBytes };
});

/** Returns a short-lived signed GET URL only for verified, matching metadata. */
export const getEncryptedBackupDownload = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseBackupDownload(request.data));
  const metadata = await getActiveBackupMetadata(uid, input.backupId);
  let objectPath: string;
  try {
    objectPath = requireVerifiedBackup({ requesterUid: uid, backupId: input.backupId, metadata });
  } catch {
    throw new HttpsError("not-found", "A verified encrypted backup is unavailable.");
  }
  if (!metadata?.objectGeneration) throw new HttpsError("not-found", "A verified encrypted backup is unavailable.");
  const spec = getSignedUrlSpec("read", Date.now(), undefined, metadata.objectGeneration);
  const [signedUrl] = await bucket.file(objectPath, { generation: metadata.objectGeneration }).getSignedUrl(spec);
  return { ok: true, status: "verified", signedUrl, objectKey: objectPath, expiresAt: new Date(spec.expires).toISOString() };
});

/** Deletes the opaque encrypted object and its server-owned metadata idempotently. */
export const deleteEncryptedBackup = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseDeleteBackup(request.data));
  const objectPath = getBackupObjectPath(uid, input.backupId);
  const duplicate = await mutate(uid, "backup-delete", input.clientEventId, 10, async () => undefined);
  await deleteEncryptedBackupData(uid, input.backupId, objectPath);
  return { ok: true, duplicate, status: "deleted" };
});

/** Stores an FCM token in an Admin-only collection after notification permission was granted locally. */
export const registerPushToken = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parsePushTokenRegistration(request.data));
  const duplicate = await mutate(uid, "push-token", input.clientEventId, 10, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.pushTokens, `${uid}_${input.installationId}`, {
      uid,
      installationId: input.installationId,
      token: input.token,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 90 * DAY_MS)
    });
  });
  return { ok: true, duplicate };
});

/** Starts a fenced deletion sweep; completion is deferred until its cooldown marker expires. */
export const requestAccountDeletion = onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true" && request.app?.alreadyConsumed) {
    throw new HttpsError("permission-denied", "A fresh App Check token is required.");
  }
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseDeletionRequest(request.data));
  await mutate(uid, "deletion", input.clientEventId, 2, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.deletionTombstones, uid, {
      uid,
      requestedAt: FieldValue.serverTimestamp(),
      status: "deleting"
    });
  }, false);
  try {
    const cooldown = await sweepFirebaseAccountDeletion(uid, Date.now(), accountDeletionDependencies());
    await transitionDeletionToCooldown(uid, cooldown.expiresAt);
  } catch {
    throw new HttpsError("internal", "Account deletion did not complete. Retry the request.");
  }
  return { ok: true, status: "deleting" };
});

/** Retries partial deletion sweeps while their non-expiring safety fence remains. */
export const retryPendingAccountDeletions = onSchedule({ schedule: "every 15 minutes", timeZone: "Asia/Kolkata" }, async () => {
  const pending = await db.collection(COLLECTIONS.deletionTombstones).where("status", "==", "deleting").limit(100).get();
  for (const document of pending.docs) {
    const data = document.data() as { uid?: string; status?: string };
    if (data.uid !== document.id || data.status !== "deleting") continue;
    try {
      const cooldown = await sweepFirebaseAccountDeletion(document.id, Date.now(), accountDeletionDependencies());
      await transitionDeletionToCooldown(document.id, cooldown.expiresAt);
    } catch {
      // The durable deleting fence remains for the next scheduled retry.
    }
  }
});

/** Deletes TTL-expired server records; it never scans or decrypts user backup content. */
export const cleanupExpiredServerRecords = onSchedule({ schedule: "every 24 hours", timeZone: "Asia/Kolkata" }, async () => {
  const now = Timestamp.now();
  const collections = Object.values(COLLECTIONS).filter(
    (name) => name !== COLLECTIONS.idempotency && name !== COLLECTIONS.deletionTombstones
  );
  let deleted = 0;
  for (const collection of [...collections, COLLECTIONS.idempotency]) {
    const expired = await db.collection(collection).where("expiresAt", "<=", now).limit(400).get();
    if (expired.empty) continue;
    const batch = db.batch();
    expired.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += expired.size;
  }
  deleted += await cleanupExpiredDeletionCooldowns(now);
  // Scheduled functions deliberately emit no user data. The deletion count is
  // only useful to Cloud logging and is not returned by the scheduler API.
  void deleted;
});

function accountDeletionDependencies(): Parameters<typeof sweepFirebaseAccountDeletion>[2] {
  return {
    deleteBackupObjects: async (ownerUid) => bucket.deleteFiles({ prefix: `recovery-backups/${ownerUid}/` }),
    deleteRecords: deleteUserRecords,
    deleteAuthIdentity
  };
}

async function transitionDeletionToCooldown(uid: string, expiresAt: number): Promise<void> {
  const reference = db.collection(COLLECTIONS.deletionTombstones).doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("The deletion fence is unavailable.");
    const tombstone = snapshot.data() as { uid?: string; status?: string };
    if (tombstone.uid !== uid) throw new Error("The deletion fence owner changed.");
    if (tombstone.status === "cooldown") return;
    if (tombstone.status !== "deleting") throw new Error("The deletion fence state changed.");
    transaction.set(reference, validateServerDocument(COLLECTIONS.deletionTombstones, {
      status: "cooldown",
      expiresAt: Timestamp.fromMillis(expiresAt)
    }), { merge: true });
  });
}

async function cleanupExpiredDeletionCooldowns(now: Timestamp): Promise<number> {
  const candidates = await db.collection(COLLECTIONS.deletionTombstones).where("expiresAt", "<=", now).limit(400).get();
  let deleted = 0;
  for (const candidate of candidates.docs) {
    const removed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(candidate.ref);
      if (!snapshot.exists) return false;
      const tombstone = snapshot.data() as { status?: string; expiresAt?: Timestamp };
      const fence = tombstone.status === "cooldown" && tombstone.expiresAt instanceof Timestamp
        ? { status: "cooldown" as const, expiresAt: tombstone.expiresAt.toMillis() }
        : { status: "deleting" as const };
      if (tombstone.status !== "cooldown" || getDeletionFenceAction(fence, now.toMillis()) !== "remove") return false;
      transaction.delete(candidate.ref);
      return true;
    });
    if (removed) deleted += 1;
  }
  return deleted;
}

async function mutate(
  uid: string,
  operation: string,
  clientEventId: string,
  perMinute: number,
  write: (transaction: Transaction) => Promise<void> | void,
  gateAccount = true
): Promise<boolean> {
  return db.runTransaction(async (transaction) => {
    const store = firestoreTransactionStore(transaction);
    const now = Date.now();
    const result = await runProtectedMutation(store, {
      rateLimitPath: `${COLLECTIONS.rateLimits}/${uid}_${operation}`,
      idempotencyPath: `${COLLECTIONS.idempotency}/${uid}_${operation}_${clientEventId}`,
      now,
      windowMs: RATE_LIMIT_TTL_MS,
      limit: perMinute,
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS,
      accountTombstonePath: gateAccount ? `${COLLECTIONS.deletionTombstones}/${uid}` : undefined
    }, () => write(transaction));
    if (result === "rate-limited") throw new HttpsError("resource-exhausted", "Try again shortly.");
    if (result === "account-deleting") throw new HttpsError("failed-precondition", "This account is being deleted.");
    return result === "duplicate";
  });
}

function firestoreTransactionStore(transaction: Transaction): TransactionalStore {
  return {
    async get<T extends object>(path: string) {
      const snapshot = await transaction.get(db.doc(path));
      return { value: snapshot.exists ? snapshot.data() as T : undefined };
    },
    async set(path: string, value: object) {
      const [collection] = path.split("/");
      transaction.set(db.doc(path), validateServerDocument(collection ?? "", value));
    }
  };
}

function setServerDocument(
  transaction: Transaction,
  collection: string,
  id: string,
  value: object,
  merge = false
) {
  const reference = db.collection(collection).doc(id);
  const safe = validateServerDocument(collection, value);
  if (merge) transaction.set(reference, safe, { merge: true });
  else transaction.set(reference, safe);
}

async function claimBackupStart(
  uid: string,
  input: ReturnType<typeof parseStartBackupUpload>,
  objectPath: string,
  uploadSessionId: string
): Promise<{ duplicate: boolean; metadata: BackupMetadataDocument; previousObjectGeneration?: string }> {
  const metadataReference = db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${input.backupId}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(metadataReference);
    const existing = snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
    const metadata: BackupMetadataDocument = {
      uid,
      backupId: input.backupId,
      expectedBytes: input.encryptedBytes,
      ciphertextSha256: input.ciphertextSha256,
      objectPath,
      status: "preparing",
      uploadSessionId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * DAY_MS)
    };
    const result = await runProtectedMutation(firestoreTransactionStore(transaction), {
      rateLimitPath: `${COLLECTIONS.rateLimits}/${uid}_backup-start`,
      idempotencyPath: `${COLLECTIONS.idempotency}/${uid}_backup-start_${input.clientEventId}`,
      accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${uid}`,
      now: Date.now(),
      windowMs: RATE_LIMIT_TTL_MS,
      limit: 10,
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS
    }, () => {
      assertBackupStartAllowed(existing);
      transaction.set(metadataReference, validateServerDocument(COLLECTIONS.backupMetadata, metadata));
    });
    assertProtectedMutationAllowed(result);
    if (result === "duplicate") {
      if (!existing) throw new HttpsError("failed-precondition", "The encrypted backup upload could not be resumed.");
      return { duplicate: true, metadata: existing };
    }
    return {
      duplicate: false,
      metadata,
      previousObjectGeneration: existing?.objectGeneration ?? existing?.sentinelGeneration
    };
  });
}

async function createUploadSentinel(objectPath: string, previousGeneration?: string): Promise<string> {
  if (previousGeneration) await safeDeleteObjectGeneration(objectPath, previousGeneration);
  const file = bucket.file(objectPath);
  try {
    await file.save(Buffer.alloc(0), {
      contentType: "application/octet-stream",
      resumable: false,
      validation: false,
      preconditionOpts: { ifGenerationMatch: 0 }
    });
  } catch (error) {
    if (!isStoragePreconditionFailure(error)) throw error;
  }
  const [metadata] = await file.getMetadata();
  assertAcceptableContentEncoding(metadata.contentEncoding);
  if (Number(metadata.size) !== 0) throw new Error("The upload sentinel is not empty.");
  return requiredGeneration(metadata.generation);
}

async function bindUploadSentinel(
  uid: string,
  backupId: string,
  uploadSessionId: string,
  sentinelGeneration: string
): Promise<void> {
  const reference = db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`);
  await db.runTransaction(async (transaction) => {
    const [tombstone, snapshot] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid)),
      transaction.get(reference)
    ]);
    if (tombstone.exists) throw new HttpsError("failed-precondition", "This account is being deleted.");
    const metadata = snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
    if (
      !metadata || metadata.uploadSessionId !== uploadSessionId ||
      (metadata.status !== "preparing" && metadata.status !== "uploading") ||
      (metadata.sentinelGeneration && metadata.sentinelGeneration !== sentinelGeneration)
    ) {
      throw new Error("The upload session changed.");
    }
    transaction.set(reference, validateServerDocument(COLLECTIONS.backupMetadata, {
      status: "uploading",
      sentinelGeneration,
      updatedAt: FieldValue.serverTimestamp()
    }), { merge: true });
  });
}

async function claimBackupFinalization(
  uid: string,
  backupId: string,
  clientEventId: string,
  claim: VerificationClaim
): Promise<boolean> {
  const reference = db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const metadata = snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
    if (!metadata) throw new HttpsError("not-found", "The encrypted backup metadata is unavailable.");
    const result = await runProtectedMutation(firestoreTransactionStore(transaction), {
      rateLimitPath: `${COLLECTIONS.rateLimits}/${uid}_backup-finalize`,
      idempotencyPath: `${COLLECTIONS.idempotency}/${uid}_backup-finalize_${clientEventId}`,
      accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${uid}`,
      now: Date.now(),
      windowMs: RATE_LIMIT_TTL_MS,
      limit: 10,
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS
    }, () => {
      const currentClaim = createVerificationClaim(metadata, claim.objectGeneration);
      if (!sameVerificationClaim(currentClaim, claim)) throw new Error("The verification session changed.");
      transaction.set(reference, validateServerDocument(COLLECTIONS.backupMetadata, {
        status: "verifying",
        objectGeneration: claim.objectGeneration,
        updatedAt: FieldValue.serverTimestamp()
      }), { merge: true });
    });
    assertProtectedMutationAllowed(result);
    if (result === "duplicate") assertVerificationCommit(metadata, claim);
    return result === "duplicate";
  });
}

async function commitBackupVerification(
  uid: string,
  backupId: string,
  claim: VerificationClaim,
  status: "verified" | "invalid",
  verifiedBytes: number
): Promise<void> {
  const reference = db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`);
  await db.runTransaction(async (transaction) => {
    const [tombstone, snapshot] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid)),
      transaction.get(reference)
    ]);
    if (tombstone.exists) throw new HttpsError("failed-precondition", "This account is being deleted.");
    const metadata = snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
    if (!metadata) throw new HttpsError("not-found", "The encrypted backup metadata is unavailable.");
    assertVerificationCommit(metadata, claim);
    transaction.set(reference, validateServerDocument(COLLECTIONS.backupMetadata, {
      status,
      verifiedBytes,
      ...(status === "verified" ? { verifiedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp()
    }), { merge: true });
  });
}

async function ensureAccountActive(uid: string): Promise<void> {
  const tombstone = await db.collection(COLLECTIONS.deletionTombstones).doc(uid).get();
  if (tombstone.exists) throw new HttpsError("failed-precondition", "This account is being deleted.");
}

async function getActiveBackupMetadata(uid: string, backupId: string): Promise<BackupMetadataDocument | undefined> {
  await ensureAccountActive(uid);
  return db.runTransaction(async (transaction) => {
    const [tombstone, snapshot] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid)),
      transaction.get(db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`))
    ]);
    if (tombstone.exists) throw new HttpsError("failed-precondition", "This account is being deleted.");
    return snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
  });
}

function requireOwnedBackup(
  uid: string,
  backupId: string,
  metadata: BackupMetadataDocument | undefined
): string {
  const expectedPath = getBackupObjectPath(uid, backupId);
  if (!metadata || metadata.uid !== uid || metadata.backupId !== backupId || metadata.objectPath !== expectedPath) {
    throw new HttpsError("not-found", "The encrypted backup metadata is unavailable.");
  }
  return expectedPath;
}

async function deleteEncryptedBackupData(uid: string, backupId: string, objectPath: string): Promise<void> {
  await deleteEncryptedBackupObject({
    objectPath,
    deleteObject: safeDeleteObject,
    deleteMetadata: async () => { await db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`).delete(); },
    isObjectNotFound: isStorageNotFound
  });
}

async function safeDeleteObject(objectPath: string): Promise<void> {
  try {
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch (error) {
    if (!isStorageNotFound(error)) throw error;
  }
}

async function safeDeleteObjectGeneration(objectPath: string, generation: string): Promise<void> {
  try {
    await bucket.file(objectPath, { generation }).delete({
      ignoreNotFound: true,
      ifGenerationMatch: generation
    });
  } catch (error) {
    if (!isStorageNotFound(error)) throw error;
  }
}

function isStoragePreconditionFailure(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 409 || code === "409" || code === 412 || code === "412";
}

function isStorageNotFound(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 404 || code === "404";
}

function requiredGeneration(value: string | number | undefined): string {
  const generation = String(value ?? "");
  if (!/^\d+$/.test(generation)) throw new Error("Storage did not return an object generation.");
  return generation;
}

function verificationClaimFromMetadata(metadata: BackupMetadataDocument): VerificationClaim {
  if (!metadata.sentinelGeneration || !metadata.objectGeneration) throw new Error("The verification generation is unavailable.");
  const claim = {
    uploadSessionId: metadata.uploadSessionId,
    sentinelGeneration: metadata.sentinelGeneration,
    objectGeneration: metadata.objectGeneration,
    expectedBytes: metadata.expectedBytes,
    ciphertextSha256: metadata.ciphertextSha256,
    objectPath: metadata.objectPath
  };
  assertVerificationCommit(metadata, claim);
  return claim;
}

function sameVerificationClaim(left: VerificationClaim, right: VerificationClaim): boolean {
  return left.uploadSessionId === right.uploadSessionId &&
    left.sentinelGeneration === right.sentinelGeneration &&
    left.objectGeneration === right.objectGeneration &&
    left.expectedBytes === right.expectedBytes &&
    left.ciphertextSha256 === right.ciphertextSha256 &&
    left.objectPath === right.objectPath;
}

function matchesBackupRequest(
  metadata: BackupMetadataDocument,
  uid: string,
  backupId: string,
  objectPath: string,
  expectedBytes: number,
  ciphertextSha256: string
): boolean {
  return metadata.uid === uid && metadata.backupId === backupId && metadata.objectPath === objectPath &&
    metadata.expectedBytes === expectedBytes && metadata.ciphertextSha256 === ciphertextSha256;
}

function assertProtectedMutationAllowed(result: Awaited<ReturnType<typeof runProtectedMutation>>): void {
  if (result === "rate-limited") throw new HttpsError("resource-exhausted", "Try again shortly.");
  if (result === "account-deleting") throw new HttpsError("failed-precondition", "This account is being deleted.");
}

async function deleteUserRecords(scope: string, uid: string): Promise<void> {
  if (scope === COLLECTIONS.rateLimits || scope === COLLECTIONS.idempotency) {
    await deleteDocumentsByIdPrefix(scope, `${uid}_`);
    return;
  }
  if (scope === COLLECTIONS.leases) {
    await deleteDocumentsByField(scope, "owner", uid);
    await deleteDocumentsByIdPrefix(scope, `${uid}_`);
    return;
  }
  await deleteDocumentsByField(scope, "uid", uid);
}

async function deleteDocumentsByField(collection: string, field: string, value: string): Promise<void> {
  while (true) {
    const snapshot = await db.collection(collection).where(field, "==", value).limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function deleteDocumentsByIdPrefix(collection: string, prefix: string): Promise<void> {
  while (true) {
    const snapshot = await db.collection(collection)
      .orderBy(FieldPath.documentId())
      .startAt(prefix)
      .endBefore(`${prefix}\uf8ff`)
      .limit(400)
      .get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function deleteAuthIdentity(uid: string): Promise<void> {
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string } | undefined)?.code !== "auth/user-not-found") throw error;
  }
}

function requireUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  return uid;
}

function parseOrHttpsError<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new HttpsError("invalid-argument", "The callable payload is not permitted.");
  }
}
