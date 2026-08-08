import { randomUUID } from "node:crypto";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getRemoteConfig } from "firebase-admin/remote-config";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { COLLECTIONS, validateServerDocument } from "./contracts.js";
import {
  NOTIFICATION_BATCH_LIMIT,
  NOTIFICATION_CLAIM_LEASE_MS,
  NOTIFICATION_TOKEN_LIMIT,
  NotificationProviderNotSubmittedError,
  NotificationProviderUnknownOutcomeError,
  buildReviewedNotificationPayload,
  claimNotificationJob,
  completeNotificationClaim,
  createNotificationDispatchService,
  createRemoteNotificationGateReader,
  createReviewedNotificationJob,
  deleteInvalidTokensTransactionally,
  isFcmRegistrationToken,
  type FirebaseAdminNotificationMessage,
  type NotificationClaim,
  type NotificationJob,
  type NotificationJobCompletion,
  type NotificationTemplateId
} from "./notifications.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = "asia-south1";
const PROVIDER_TIMEOUT_MS = 20 * 1_000;
const TOKEN_SCAN_LIMIT = 100;
const SAFE_JOB_IDENTITY = /^[A-Za-z0-9_-]{8,200}$/;

const getNotificationGate = createRemoteNotificationGateReader(
  () => getRemoteConfig().getTemplate(),
  () => Date.now()
);

/**
 * Internal server API for reviewed schedules. It is deliberately not exported
 * from the Cloud Functions entrypoint and accepts no title, body, token, data,
 * URL, domain, or recovery content.
 */
export async function enqueueReviewedNotificationJob(
  uid: string,
  templateId: NotificationTemplateId,
  scheduledAt: number,
  now = Date.now()
): Promise<string> {
  const job = createReviewedNotificationJob({ uid, templateId, scheduledAt, now });
  const id = `notification_${randomUUID().replaceAll("-", "")}`;
  const reference = db.collection(COLLECTIONS.notificationJobs).doc(id);
  await db.runTransaction(async (transaction) => {
    const tombstone = await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid));
    if (tombstone.exists) throw new Error("This account is being deleted.");
    transaction.create(reference, toFirestoreJob(job));
  });
  return id;
}

const service = createNotificationDispatchService({
  now: () => Date.now(),
  getGate: getNotificationGate,
  listDueJobIds,
  claimJob,
  prepareProviderInvocation,
  listActiveTokens,
  sendFirebaseAdminMessages,
  deleteInvalidTokens,
  completeClaim
});

/** Scheduled dispatch only; there is no mobile enqueue or dispatch callable. */
export const dispatchReviewedNotifications = onSchedule({
  region: REGION,
  schedule: "every 5 minutes",
  timeZone: "Asia/Kolkata",
  timeoutSeconds: 60,
  maxInstances: 1
}, async () => {
  await service.run();
});

async function listDueJobIds(now: number, limit: number): Promise<readonly string[]> {
  const boundedLimit = Math.min(Math.max(1, limit), NOTIFICATION_BATCH_LIMIT);
  const [pending, expiredClaims] = await Promise.all([
    db.collection(COLLECTIONS.notificationJobs)
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", Timestamp.fromMillis(now))
      .orderBy("scheduledAt", "asc")
      .limit(boundedLimit)
      .get(),
    db.collection(COLLECTIONS.notificationJobs)
      .where("status", "==", "claimed")
      .where("claimedAt", "<=", Timestamp.fromMillis(now - NOTIFICATION_CLAIM_LEASE_MS))
      .orderBy("claimedAt", "asc")
      .limit(boundedLimit)
      .get()
  ]);
  return [...new Set([...pending.docs, ...expiredClaims.docs].map((document) => document.id))].slice(0, boundedLimit);
}

async function claimJob(jobId: string, now: number): Promise<NotificationClaim | null> {
  const reference = db.collection(COLLECTIONS.notificationJobs).doc(jobId);
  return db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(reference);
    if (!jobSnapshot.exists) return null;
    const current = fromFirestoreJob(jobSnapshot.data());
    if (!current) return null;
    const tombstone = await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(current.uid));
    if (tombstone.exists) {
      transaction.set(reference, toFirestoreJob({ ...current, status: "canceled" }));
      return null;
    }
    const claimed = claimNotificationJob(current, now, jobId);
    if (!claimed) return null;
    transaction.set(reference, toFirestoreJob(claimed.job));
    return claimed.claim;
  });
}

async function prepareProviderInvocation(claim: NotificationClaim): Promise<boolean> {
  return db.runTransaction(async (transaction) => {
    const [jobSnapshot, tombstone] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.notificationJobs).doc(claim.jobId)),
      transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(claim.uid))
    ]);
    if (tombstone.exists || !jobSnapshot.exists) return false;
    const current = fromFirestoreJob(jobSnapshot.data());
    return current !== null && current.status === "claimed" && current.uid === claim.uid &&
      current.templateId === claim.templateId && current.route === claim.route &&
      current.claimedAt === claim.claimedAt && current.attemptCount === claim.attemptCount;
  });
}

async function listActiveTokens(uid: string, now: number, limit: number) {
  const snapshot = await db.collection(COLLECTIONS.pushTokens)
    .where("uid", "==", uid)
    .limit(TOKEN_SCAN_LIMIT)
    .get();
  const boundedLimit = Math.min(Math.max(1, limit), NOTIFICATION_TOKEN_LIMIT);
  return snapshot.docs.flatMap((document) => {
    const data = document.data() as Record<string, unknown>;
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0;
    return expiresAt > now && isFcmRegistrationToken(data.token)
      ? [{ id: document.id, token: data.token }]
      : [];
  }).slice(0, boundedLimit);
}

async function sendFirebaseAdminMessages(messages: readonly FirebaseAdminNotificationMessage[]) {
  if (messages.length === 0 || messages.length > NOTIFICATION_TOKEN_LIMIT) {
    throw new NotificationProviderNotSubmittedError("Invalid notification batch.");
  }
  const first = messages[0]!;
  for (const message of messages) {
    if (message.notification.title !== first.notification.title || message.notification.body !== first.notification.body ||
        message.data.route !== first.data.route || message.data.kind !== first.data.kind) {
      throw new NotificationProviderNotSubmittedError("Mixed notification templates are not permitted.");
    }
  }
  // The Admin SDK routes the same FCM registration-token contract to Android
  // and Firebase-configured APNs. There is intentionally no direct APNs sender.
  let operation: ReturnType<ReturnType<typeof getMessaging>["sendEachForMulticast"]>;
  try {
    operation = getMessaging().sendEachForMulticast({
      tokens: messages.map((message) => message.token),
      notification: first.notification,
      data: first.data,
      android: { priority: "normal" },
      apns: { headers: { "apns-priority": "5" } }
    }, false);
  } catch {
    throw new NotificationProviderNotSubmittedError();
  }
  let response: Awaited<typeof operation>;
  try {
    response = await withProviderTimeout(operation);
  } catch {
    // A rejected or timed-out Admin SDK promise may have reached FCM. It is
    // terminal because a retry could duplicate a late successful delivery.
    throw new NotificationProviderUnknownOutcomeError();
  }
  return response.responses.map((result) => ({
    success: result.success,
    ...(result.error?.code ? { errorCode: result.error.code } : {})
  }));
}

async function deleteInvalidTokens(invalidTokens: readonly { id: string; token: string }[]): Promise<void> {
  await deleteInvalidTokensTransactionally(invalidTokens, async (operation) => db.runTransaction(async (transaction) => {
    await operation({
      async readTokens(ids) {
        const references = ids.map((id) => db.collection(COLLECTIONS.pushTokens).doc(id));
        const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
        const storedTokens = new Map(snapshots.flatMap((snapshot) => {
          const stored = snapshot.data()?.token;
          return snapshot.exists && typeof stored === "string" ? [[snapshot.id, stored] as const] : [];
        }));
        return storedTokens;
      },
      deleteTokens(tokens) {
        for (const token of tokens) transaction.delete(db.collection(COLLECTIONS.pushTokens).doc(token.id));
      }
    });
  }));
}

async function completeClaim(
  claim: NotificationClaim,
  completion: NotificationJobCompletion,
  now: number
): Promise<boolean> {
  const reference = db.collection(COLLECTIONS.notificationJobs).doc(claim.jobId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    const current = fromFirestoreJob(snapshot.data());
    if (!current) return false;
    const completed = completeNotificationClaim(current, claim, completion, now);
    if (!completed) return false;
    transaction.set(reference, toFirestoreJob(completed));
    return true;
  });
}

function toFirestoreJob(job: NotificationJob): Record<string, unknown> {
  const document: Record<string, unknown> = {
    uid: job.uid,
    templateId: job.templateId,
    route: job.route,
    status: job.status,
    scheduledAt: Timestamp.fromMillis(job.scheduledAt),
    createdAt: Timestamp.fromMillis(job.createdAt),
    attemptCount: job.attemptCount,
    expiresAt: Timestamp.fromMillis(job.expiresAt)
  };
  if (job.claimedAt !== undefined) document.claimedAt = Timestamp.fromMillis(job.claimedAt);
  if (job.dispatchedAt !== undefined) document.dispatchedAt = Timestamp.fromMillis(job.dispatchedAt);
  if (job.successCount !== undefined) document.successCount = job.successCount;
  if (job.failureCount !== undefined) document.failureCount = job.failureCount;
  if (job.invalidTokenCount !== undefined) document.invalidTokenCount = job.invalidTokenCount;
  return validateServerDocument(COLLECTIONS.notificationJobs, document);
}

function fromFirestoreJob(data: DocumentData | undefined): NotificationJob | null {
  if (!data || !hasOnlyJobFields(data) || typeof data.uid !== "string" || !SAFE_JOB_IDENTITY.test(data.uid) ||
      typeof data.templateId !== "string" || data.route !== "checkin" || !isJobStatus(data.status) ||
      !Number.isInteger(data.attemptCount) || data.attemptCount < 0 || data.attemptCount > 3 ||
      !(data.scheduledAt instanceof Timestamp) || !(data.createdAt instanceof Timestamp) || !(data.expiresAt instanceof Timestamp)) {
    return null;
  }
  try {
    buildReviewedNotificationPayload(data.templateId as NotificationTemplateId);
  } catch {
    return null;
  }
  const job: NotificationJob = {
    uid: data.uid,
    templateId: data.templateId as NotificationTemplateId,
    route: "checkin",
    status: data.status,
    scheduledAt: data.scheduledAt.toMillis(),
    createdAt: data.createdAt.toMillis(),
    attemptCount: data.attemptCount,
    expiresAt: data.expiresAt.toMillis()
  };
  if (data.claimedAt !== undefined) {
    if (!(data.claimedAt instanceof Timestamp)) return null;
    job.claimedAt = data.claimedAt.toMillis();
  }
  if (data.dispatchedAt !== undefined) {
    if (!(data.dispatchedAt instanceof Timestamp)) return null;
    job.dispatchedAt = data.dispatchedAt.toMillis();
  }
  for (const field of ["successCount", "failureCount", "invalidTokenCount"] as const) {
    if (data[field] !== undefined) {
      if (!Number.isInteger(data[field]) || data[field] < 0 || data[field] > NOTIFICATION_TOKEN_LIMIT) return null;
      job[field] = data[field];
    }
  }
  if (job.status === "claimed" && job.claimedAt === undefined) return null;
  if (job.status === "dispatched" && job.dispatchedAt === undefined) return null;
  if (job.createdAt > job.expiresAt || job.scheduledAt > job.expiresAt) return null;
  return job;
}

function hasOnlyJobFields(data: DocumentData): boolean {
  const allowed = new Set([
    "uid", "templateId", "route", "status", "scheduledAt", "createdAt", "claimedAt", "dispatchedAt",
    "attemptCount", "expiresAt", "successCount", "failureCount", "invalidTokenCount"
  ]);
  return Object.keys(data).every((key) => allowed.has(key));
}

function isJobStatus(value: unknown): value is NotificationJob["status"] {
  return value === "pending" || value === "claimed" || value === "dispatched" || value === "canceled" || value === "failed";
}

async function withProviderTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Firebase Messaging unavailable.")), PROVIDER_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
