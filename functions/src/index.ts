import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";

import {
  COLLECTIONS,
  parseAggregateAnalytics,
  parseBackupMetadataHandshake,
  parseDeletionRequest,
  parsePushTokenRegistration,
  validateServerDocument
} from "./contracts.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
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
    setServerDocument(transaction, COLLECTIONS.aggregateAnalytics, `${uid}_${input.day}`, {
      uid,
      day: input.day,
      checkIns: input.checkIns,
      completedChallenges: input.completedChallenges,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * DAY_MS)
    }, true);
  });
  return { ok: true, duplicate };
});

/** Records handshake metadata only. Encrypted recovery envelopes never enter callable data or Firestore. */
export const registerEncryptedBackupMetadata = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseBackupMetadataHandshake(request.data));
  const duplicate = await mutate(uid, "backup-metadata", input.clientEventId, 10, async (transaction) => {
    setServerDocument(transaction, COLLECTIONS.backupMetadata, `${uid}_${input.backupId}`, {
      uid,
      backupId: input.backupId,
      encryptedBytes: input.encryptedBytes,
      ciphertextSha256: input.ciphertextSha256,
      recordedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * DAY_MS)
    });
  });
  return { ok: true, duplicate, acceptsEncryptedEnvelope: false };
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

/** Limited-use App Check is intentionally unavailable in the Emulator Suite. */
export const requestAccountDeletion = onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    throw new HttpsError("failed-precondition", "Limited-use App Check cannot be validated in the Firebase Emulator Suite.");
  }
  const uid = requireUid(request.auth?.uid);
  const input = parseOrHttpsError(() => parseDeletionRequest(request.data));
  const duplicate = await mutate(uid, "deletion", input.clientEventId, 2, async (transaction) => {
    const expiresAt = Timestamp.fromMillis(Date.now() + 30 * DAY_MS);
    setServerDocument(transaction, COLLECTIONS.deletionTombstones, uid, {
      uid,
      requestedAt: FieldValue.serverTimestamp(),
      expiresAt,
      status: "requested"
    });
    setServerDocument(transaction, COLLECTIONS.backendJobs, `delete_${uid}`, {
      kind: "account-deletion",
      uid,
      status: "queued",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt
    });
  });
  return { ok: true, duplicate, status: "requested" };
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
