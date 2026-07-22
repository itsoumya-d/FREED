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
  deleteEncryptedBackup as deleteEncryptedBackupObject,
  deleteFirebaseAccountData,
  getBackupObjectPath,
  getSignedUrlSpec,
  requireVerifiedBackup,
  verifyCiphertext
} from "./core-data.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

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
  const duplicate = await mutate(uid, "backup-start", input.clientEventId, 10, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.backupMetadata, `${uid}_${input.backupId}`, {
      uid,
      backupId: input.backupId,
      expectedBytes: input.encryptedBytes,
      ciphertextSha256: input.ciphertextSha256,
      objectPath,
      status: "uploading",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * DAY_MS)
    });
  });

  const metadata = await getBackupMetadata(uid, input.backupId);
  if (
    !metadata || metadata.uid !== uid || metadata.backupId !== input.backupId ||
    metadata.objectPath !== objectPath || metadata.expectedBytes !== input.encryptedBytes ||
    metadata.ciphertextSha256 !== input.ciphertextSha256
  ) {
    throw new HttpsError("failed-precondition", "The encrypted backup upload could not be started.");
  }
  const now = Date.now();
  const spec = getSignedUrlSpec("write", now, input.encryptedBytes);
  const [signedUrl] = await bucket.file(objectPath).getSignedUrl(spec);
  return {
    ok: true,
    duplicate,
    status: metadata.status,
    signedUrl,
    objectKey: objectPath,
    expiresAt: new Date(spec.expires).toISOString(),
    requiredHeaders: {
      "content-type": "application/octet-stream",
      "content-length": String(input.encryptedBytes)
    }
  };
});

/** Streams ciphertext bytes to verify their byte count and SHA-256; no envelope parsing occurs. */
export const finalizeEncryptedBackupUpload = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseFinalizeBackupUpload(request.data));
  const existing = await getBackupMetadata(uid, input.backupId);
  const objectPath = requireOwnedBackup(uid, input.backupId, existing);
  if (!existing) throw new HttpsError("not-found", "The encrypted backup metadata is unavailable.");
  if (existing.status === "verified") {
    return { ok: true, duplicate: true, status: "verified", verifiedBytes: existing.verifiedBytes };
  }
  if (existing.status === "invalid") {
    await safeDeleteObject(objectPath);
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }
  const duplicate = await mutate(uid, "backup-finalize", input.clientEventId, 10, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.backupMetadata, `${uid}_${input.backupId}`, {
      status: "verifying",
      updatedAt: FieldValue.serverTimestamp()
    }, true);
  });
  const metadata = await getBackupMetadata(uid, input.backupId);
  if (!metadata) throw new HttpsError("not-found", "The encrypted backup metadata is unavailable.");
  if (metadata.status === "verified") {
    return { ok: true, duplicate: true, status: "verified", verifiedBytes: metadata.verifiedBytes };
  }
  if (metadata.status === "invalid") {
    await safeDeleteObject(objectPath);
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }

  let result: Awaited<ReturnType<typeof verifyCiphertext>>;
  try {
    result = await verifyCiphertext({
      source: bucket.file(objectPath).createReadStream() as AsyncIterable<Uint8Array>,
      expectedBytes: metadata.expectedBytes,
      expectedSha256: metadata.ciphertextSha256,
      removeInvalid: () => safeDeleteObject(objectPath)
    });
  } catch {
    throw new HttpsError("failed-precondition", "The encrypted backup could not be verified.");
  }

  if (!result.ok) {
    await setBackupMetadata(uid, input.backupId, {
      status: "invalid",
      verifiedBytes: result.verifiedBytes,
      updatedAt: FieldValue.serverTimestamp()
    });
    throw new HttpsError("failed-precondition", "The encrypted backup failed verification.");
  }
  await setBackupMetadata(uid, input.backupId, {
    status: "verified",
    verifiedBytes: result.verifiedBytes,
    verifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { ok: true, duplicate, status: "verified", verifiedBytes: result.verifiedBytes };
});

/** Returns a short-lived signed GET URL only for verified, matching metadata. */
export const getEncryptedBackupDownload = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseBackupDownload(request.data));
  const metadata = await getBackupMetadata(uid, input.backupId);
  let objectPath: string;
  try {
    objectPath = requireVerifiedBackup({ requesterUid: uid, backupId: input.backupId, metadata });
  } catch {
    throw new HttpsError("not-found", "A verified encrypted backup is unavailable.");
  }
  const spec = getSignedUrlSpec("read", Date.now());
  const [signedUrl] = await bucket.file(objectPath).getSignedUrl(spec);
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
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 90 * DAY_MS)
    });
  });
  return { ok: true, duplicate };
});

/** Completes deletion synchronously; limited-use App Check consumption is enforced in production. */
export const requestAccountDeletion = onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true" && request.app?.alreadyConsumed) {
    throw new HttpsError("permission-denied", "A fresh App Check token is required.");
  }
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseDeletionRequest(request.data));
  await mutate(uid, "deletion", input.clientEventId, 2, async (transaction) => {
    const expiresAt = Timestamp.fromMillis(Date.now() + 30 * DAY_MS);
    setServerDocument(transaction, COLLECTIONS.deletionTombstones, uid, {
      uid,
      requestedAt: FieldValue.serverTimestamp(),
      expiresAt,
      status: "deleting"
    });
  });
  try {
    await deleteFirebaseAccountData(uid, {
      deleteBackupObjects: async (ownerUid) => bucket.deleteFiles({ prefix: `recovery-backups/${ownerUid}/` }),
      deleteRecords: deleteUserRecords,
      deleteAuthIdentity: deleteAuthIdentity
    });
  } catch {
    throw new HttpsError("internal", "Account deletion did not complete. Retry the request.");
  }
  return { ok: true, status: "completed" };
});

/** Deletes TTL-expired server records; it never scans or decrypts user backup content. */
export const cleanupExpiredServerRecords = onSchedule({ schedule: "every 24 hours", timeZone: "Asia/Kolkata" }, async () => {
  const now = Timestamp.now();
  const collections = Object.values(COLLECTIONS).filter((name) => name !== COLLECTIONS.idempotency);
  let deleted = 0;
  for (const collection of [...collections, COLLECTIONS.idempotency]) {
    const expired = await db.collection(collection).where("expiresAt", "<=", now).limit(400).get();
    if (expired.empty) continue;
    const batch = db.batch();
    expired.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += expired.size;
  }
  // Scheduled functions deliberately emit no user data. The deletion count is
  // only useful to Cloud logging and is not returned by the scheduler API.
  void deleted;
});

async function mutate(
  uid: string,
  operation: string,
  clientEventId: string,
  perMinute: number,
  write: (transaction: Transaction) => Promise<void> | void
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
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS
    }, () => write(transaction));
    if (result === "rate-limited") throw new HttpsError("resource-exhausted", "Try again shortly.");
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

async function getBackupMetadata(uid: string, backupId: string): Promise<BackupMetadataDocument | undefined> {
  const snapshot = await db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`).get();
  return snapshot.exists ? snapshot.data() as BackupMetadataDocument : undefined;
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

async function setBackupMetadata(uid: string, backupId: string, value: object): Promise<void> {
  const safe = validateServerDocument(COLLECTIONS.backupMetadata, value);
  await db.collection(COLLECTIONS.backupMetadata).doc(`${uid}_${backupId}`).set(safe, { merge: true });
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

function isStorageNotFound(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 404 || code === "404";
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
  if (scope === COLLECTIONS.deletionTombstones) {
    await db.collection(scope).doc(uid).delete();
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
