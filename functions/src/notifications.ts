/** Pure, dependency-injected notification queue and dispatch workflows. */

export const FCM_TOKEN_MAX_LENGTH = 4_096;
export const NOTIFICATION_JOB_MAX_ATTEMPTS = 3;
export const NOTIFICATION_CLAIM_LEASE_MS = 5 * 60 * 1_000;
export const NOTIFICATION_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const NOTIFICATION_BATCH_LIMIT = 20;
export const NOTIFICATION_TOKEN_LIMIT = 20;

const REMOTE_CONFIG_PARAMETER = "remote_notifications_enabled";
const DEFAULT_REMOTE_CONFIG_CACHE_TTL_MS = 60 * 1_000;
const DEFAULT_REMOTE_CONFIG_TIMEOUT_MS = 2_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{8,200}$/;
const FCM_TOKEN = /^[A-Za-z0-9:_-]{20,4096}$/;
const FCM_PLACEHOLDER = /(?:placeholder|replace(?:[_-]?me)?|example|your[_-]?fcm|test[_-]?token|dummy)/i;

export const NOTIFICATION_TEMPLATE_IDS = [
  "morning-checkin",
  "evening-reflection",
  "night-guard",
  "challenge-followup",
  "streak-encouragement"
] as const;

export type NotificationTemplateId = typeof NOTIFICATION_TEMPLATE_IDS[number];
export type NotificationRoute = "checkin";
export type RemoteNotificationGate = "enabled" | "disabled" | "unavailable";
export type NotificationJobStatus = "pending" | "claimed" | "dispatched" | "canceled" | "failed";

export type NotificationJob = {
  uid: string;
  templateId: NotificationTemplateId;
  route: NotificationRoute;
  status: NotificationJobStatus;
  scheduledAt: number;
  createdAt: number;
  claimedAt?: number;
  dispatchedAt?: number;
  attemptCount: number;
  expiresAt: number;
  successCount?: number;
  failureCount?: number;
  invalidTokenCount?: number;
};

export type NotificationClaim = {
  jobId: string;
  uid: string;
  templateId: NotificationTemplateId;
  route: NotificationRoute;
  claimedAt: number;
  attemptCount: number;
};

export type NotificationJobCompletion = {
  outcome: "dispatched" | "retry" | "canceled" | "failed";
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
};

export type NotificationToken = { id: string; token: string };
export type InvalidNotificationToken = NotificationToken;
export type InvalidTokenCleanupTransaction = {
  readTokens(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
  deleteTokens(tokens: readonly InvalidNotificationToken[]): Promise<void> | void;
};
export type InvalidTokenTransactionRunner = (
  operation: (transaction: InvalidTokenCleanupTransaction) => Promise<void>
) => Promise<void>;
export type FirebaseAdminNotificationMessage = {
  token: string;
  notification: { title: string; body: string };
  data: { route: NotificationRoute; kind: NotificationTemplateId };
};
export type FirebaseAdminSendResult = { success: boolean; errorCode?: string };

export type NotificationDispatchDependencies = {
  now(): number;
  getGate(): Promise<RemoteNotificationGate>;
  listDueJobIds(now: number, limit: number): Promise<readonly string[]>;
  claimJob(jobId: string, now: number): Promise<NotificationClaim | null>;
  /** Atomically confirms both the claim and the absence of a deletion tombstone. */
  prepareProviderInvocation(claim: NotificationClaim): Promise<boolean>;
  listActiveTokens(uid: string, now: number, limit: number): Promise<readonly NotificationToken[]>;
  sendFirebaseAdminMessages(messages: readonly FirebaseAdminNotificationMessage[]): Promise<readonly FirebaseAdminSendResult[]>;
  deleteInvalidTokens(tokens: readonly InvalidNotificationToken[]): Promise<void>;
  completeClaim(claim: NotificationClaim, completion: NotificationJobCompletion, now: number): Promise<boolean>;
};

export type NotificationDispatchSummary = {
  gate: RemoteNotificationGate;
  claimed: number;
  sent: number;
  failed: number;
  canceled: number;
};

/** The provider boundary proved the request was never submitted. */
export class NotificationProviderNotSubmittedError extends Error {
  constructor(message = "Firebase Messaging request was not submitted.") {
    super(message);
    this.name = "NotificationProviderNotSubmittedError";
  }
}

/** The request may still complete remotely, so retrying could duplicate delivery. */
export class NotificationProviderUnknownOutcomeError extends Error {
  constructor(message = "Firebase Messaging outcome is unknown.") {
    super(message);
    this.name = "NotificationProviderUnknownOutcomeError";
  }
}

const REVIEWED_NOTIFICATION_CATALOG: Readonly<Record<NotificationTemplateId, {
  title: string;
  body: string;
}>> = Object.freeze({
  "morning-checkin": Object.freeze({
    title: "FREED morning reset",
    body: "One minute to set the tone before the day starts moving."
  }),
  "evening-reflection": Object.freeze({
    title: "FREED evening reflection",
    body: "Check in, lower stimulation, and make tonight easier."
  }),
  "night-guard": Object.freeze({
    title: "FREED night guard",
    body: "Phone away, lights low, one clean choice at a time."
  }),
  "challenge-followup": Object.freeze({
    title: "FREED reset check",
    body: "Take one steady breath and mark how the reset landed."
  }),
  "streak-encouragement": Object.freeze({
    title: "FREED steady progress",
    body: "Return for a short check-in and choose the next supportive step."
  })
});

export function isFcmRegistrationToken(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || !FCM_TOKEN.test(value)) return false;
  if (FCM_PLACEHOLDER.test(value)) return false;
  return !/^([A-Za-z0-9])\1{19,}$/.test(value);
}

export function buildReviewedNotificationPayload(templateId: NotificationTemplateId) {
  if (!isNotificationTemplateId(templateId)) throw new Error("Unsupported notification template.");
  const copy = REVIEWED_NOTIFICATION_CATALOG[templateId];
  return {
    notification: { title: copy.title, body: copy.body },
    data: { route: "checkin" as const, kind: templateId }
  };
}

export function createReviewedNotificationJob(value: {
  uid: string;
  templateId: NotificationTemplateId;
  scheduledAt: number;
  now: number;
}): NotificationJob {
  if (!isExactRecord(value, ["uid", "templateId", "scheduledAt", "now"])) {
    throw new Error("Unsupported notification job.");
  }
  if (!SAFE_IDENTIFIER.test(value.uid) || !isNotificationTemplateId(value.templateId) ||
      !isSafeTime(value.scheduledAt) || !isSafeTime(value.now) ||
      value.scheduledAt > value.now + NOTIFICATION_JOB_TTL_MS) {
    throw new Error("Unsupported notification job.");
  }
  return {
    uid: value.uid,
    templateId: value.templateId,
    route: "checkin",
    status: "pending",
    scheduledAt: value.scheduledAt,
    createdAt: value.now,
    attemptCount: 0,
    expiresAt: value.now + NOTIFICATION_JOB_TTL_MS
  };
}

export function readRemoteNotificationGateTemplate(template: unknown): RemoteNotificationGate {
  if (!isRecord(template) || !isRecord(template.parameters)) return "unavailable";
  const parameter = template.parameters[REMOTE_CONFIG_PARAMETER];
  if (!isRecord(parameter) || !isRecord(parameter.defaultValue)) return "unavailable";
  if (parameter.defaultValue.value === "true") return "enabled";
  if (parameter.defaultValue.value === "false") return "disabled";
  return "unavailable";
}

export function createRemoteNotificationGateReader(
  fetchTemplate: () => Promise<unknown>,
  now: () => number,
  cacheTtlMs = DEFAULT_REMOTE_CONFIG_CACHE_TTL_MS,
  fetchTimeoutMs = DEFAULT_REMOTE_CONFIG_TIMEOUT_MS
) {
  let cached: { gate: Exclude<RemoteNotificationGate, "unavailable">; expiresAt: number } | null = null;
  return async (): Promise<RemoteNotificationGate> => {
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) return cached.gate;
    try {
      const gate = readRemoteNotificationGateTemplate(await withHardTimeout(fetchTemplate(), fetchTimeoutMs));
      if (gate === "unavailable") {
        cached = null;
        return gate;
      }
      cached = { gate, expiresAt: currentTime + cacheTtlMs };
      return gate;
    } catch {
      cached = null;
      return "unavailable";
    }
  };
}

/** Compare-and-delete decision used inside a Firestore transaction. */
export function selectUnchangedInvalidTokens(
  failedTokens: readonly InvalidNotificationToken[],
  storedTokens: ReadonlyMap<string, string>
): InvalidNotificationToken[] {
  return failedTokens.filter((failed) => storedTokens.get(failed.id) === failed.token);
}

/**
 * The runner must provide optimistic transaction retries. A token rotated
 * after the read therefore causes the operation to re-read and preserve it.
 */
export async function deleteInvalidTokensTransactionally(
  failedTokens: readonly InvalidNotificationToken[],
  runTransaction: InvalidTokenTransactionRunner
): Promise<void> {
  const deduplicated = [...new Map(failedTokens.map((entry) => [entry.id, entry])).values()]
    .slice(0, NOTIFICATION_TOKEN_LIMIT);
  if (deduplicated.length === 0) return;
  await runTransaction(async (transaction) => {
    const storedTokens = await transaction.readTokens(deduplicated.map((entry) => entry.id));
    const unchanged = selectUnchangedInvalidTokens(deduplicated, storedTokens);
    if (unchanged.length > 0) await transaction.deleteTokens(unchanged);
  });
}

export function claimNotificationJob(
  job: NotificationJob,
  now: number,
  jobId = "job_12345678"
): { job: NotificationJob; claim: NotificationClaim } | null {
  if (!SAFE_IDENTIFIER.test(jobId) || !isSafeTime(now) || job.expiresAt <= now || job.attemptCount >= NOTIFICATION_JOB_MAX_ATTEMPTS) {
    return null;
  }
  const pendingDue = job.status === "pending" && job.scheduledAt <= now;
  const leaseExpired = job.status === "claimed" && job.claimedAt !== undefined &&
    job.claimedAt + NOTIFICATION_CLAIM_LEASE_MS <= now;
  if (!pendingDue && !leaseExpired) return null;
  const claimedAt = Math.max(now, (job.claimedAt ?? -1) + 1);
  const claimed: NotificationJob = {
    ...withoutResultFields(job),
    status: "claimed",
    claimedAt,
    attemptCount: job.attemptCount + 1
  };
  return {
    job: claimed,
    claim: {
      jobId,
      uid: claimed.uid,
      templateId: claimed.templateId,
      route: claimed.route,
      claimedAt,
      attemptCount: claimed.attemptCount
    }
  };
}

export function completeNotificationClaim(
  current: NotificationJob,
  claim: NotificationClaim,
  completion: NotificationJobCompletion,
  now: number
): NotificationJob | null {
  if (!matchesClaim(current, claim) || !isSafeCompletion(completion) || !isSafeTime(now)) return null;
  const base = {
    ...withoutClaimAndResultFields(current),
    successCount: completion.successCount,
    failureCount: completion.failureCount,
    invalidTokenCount: completion.invalidTokenCount
  };
  const nextAttemptAt = now + retryDelayMs(current.attemptCount);
  if (completion.outcome === "retry" && current.attemptCount < NOTIFICATION_JOB_MAX_ATTEMPTS && current.expiresAt > nextAttemptAt) {
    return {
      ...base,
      status: "pending",
      scheduledAt: nextAttemptAt
    };
  }
  if (completion.outcome === "dispatched") {
    return { ...base, status: "dispatched", dispatchedAt: now };
  }
  return { ...base, status: completion.outcome === "canceled" ? "canceled" : "failed" };
}

export function createNotificationDispatchService(dependencies: NotificationDispatchDependencies) {
  return {
    async run(): Promise<NotificationDispatchSummary> {
      const gate = await dependencies.getGate().catch(() => "unavailable" as const);
      const summary: NotificationDispatchSummary = { gate, claimed: 0, sent: 0, failed: 0, canceled: 0 };
      if (gate !== "enabled") return summary;
      const now = dependencies.now();
      const jobIds = (await dependencies.listDueJobIds(now, NOTIFICATION_BATCH_LIMIT)).slice(0, NOTIFICATION_BATCH_LIMIT);
      for (const jobId of jobIds) await dispatchOne(jobId, dependencies, summary);
      return summary;
    }
  };
}

async function dispatchOne(
  jobId: string,
  dependencies: NotificationDispatchDependencies,
  summary: NotificationDispatchSummary
): Promise<void> {
  const claim = await dependencies.claimJob(jobId, dependencies.now());
  if (!claim) return;
  summary.claimed += 1;

  if (!await dependencies.prepareProviderInvocation(claim)) {
    await recordCompletion(dependencies, claim, {
      outcome: "canceled", successCount: 0, failureCount: 0, invalidTokenCount: 0
    }, summary);
    return;
  }
  const tokens = (await dependencies.listActiveTokens(claim.uid, dependencies.now(), NOTIFICATION_TOKEN_LIMIT))
    .filter((entry) => SAFE_IDENTIFIER.test(entry.id) && isFcmRegistrationToken(entry.token))
    .slice(0, NOTIFICATION_TOKEN_LIMIT);
  if (!await dependencies.prepareProviderInvocation(claim)) {
    await recordCompletion(dependencies, claim, {
      outcome: "canceled", successCount: 0, failureCount: 0, invalidTokenCount: 0
    }, summary);
    return;
  }
  if (tokens.length === 0) {
    await recordCompletion(dependencies, claim, {
      outcome: "failed", successCount: 0, failureCount: 0, invalidTokenCount: 0
    }, summary);
    return;
  }

  const payload = buildReviewedNotificationPayload(claim.templateId);
  const messages = tokens.map((entry) => ({ token: entry.token, ...payload }));
  let completion: NotificationJobCompletion;
  try {
    const responses = await dependencies.sendFirebaseAdminMessages(messages);
    completion = classifyProviderResponses(tokens, responses, claim.attemptCount);
    const invalidTokens = responses.flatMap((response, index) =>
      !response.success && isInvalidTokenError(response.errorCode) && tokens[index] ? [tokens[index]] : []
    );
    if (invalidTokens.length > 0) {
      // Delivery already happened. Cleanup is best effort so a Firestore
      // failure cannot convert provider success into a duplicate-send retry.
      await dependencies.deleteInvalidTokens(invalidTokens).catch(() => undefined);
    }
  } catch (error) {
    completion = {
      outcome: error instanceof NotificationProviderNotSubmittedError && claim.attemptCount < NOTIFICATION_JOB_MAX_ATTEMPTS
        ? "retry"
        : "failed",
      successCount: 0,
      failureCount: tokens.length,
      invalidTokenCount: 0
    };
  }
  await recordCompletion(dependencies, claim, completion, summary);
}

function classifyProviderResponses(
  tokens: readonly NotificationToken[],
  responses: readonly FirebaseAdminSendResult[],
  attemptCount: number
): NotificationJobCompletion {
  if (responses.length !== tokens.length) {
    return {
      outcome: "failed",
      successCount: 0,
      failureCount: tokens.length,
      invalidTokenCount: 0
    };
  }
  const bounded = tokens.map((_token, index) => responses[index]!);
  const successCount = bounded.filter((response) => response.success).length;
  const invalidTokenCount = bounded.filter((response) => isInvalidTokenError(response.errorCode)).length;
  const failureCount = bounded.length - successCount;
  const hasTransientFailure = bounded.some((response) => !response.success && isTransientMessagingError(response.errorCode));
  let outcome: NotificationJobCompletion["outcome"];
  if (successCount > 0) outcome = "dispatched";
  else if (hasTransientFailure && attemptCount < NOTIFICATION_JOB_MAX_ATTEMPTS) outcome = "retry";
  else outcome = "failed";
  return { outcome, successCount, failureCount, invalidTokenCount };
}

async function recordCompletion(
  dependencies: NotificationDispatchDependencies,
  claim: NotificationClaim,
  completion: NotificationJobCompletion,
  summary: NotificationDispatchSummary
) {
  const committed = await dependencies.completeClaim(claim, completion, dependencies.now());
  if (!committed) return;
  if (completion.outcome === "dispatched") summary.sent += completion.successCount;
  else if (completion.outcome === "canceled") summary.canceled += 1;
  else if (completion.outcome === "failed") summary.failed += 1;
}

function isInvalidTokenError(errorCode: string | undefined): boolean {
  return errorCode === "messaging/invalid-registration-token" ||
    errorCode === "messaging/registration-token-not-registered";
}

function isTransientMessagingError(errorCode: string | undefined): boolean {
  return errorCode !== undefined && [
    "messaging/internal-error",
    "messaging/server-unavailable",
    "messaging/quota-exceeded",
    "messaging/message-rate-exceeded",
    "messaging/device-message-rate-exceeded",
    "messaging/topics-message-rate-exceeded"
  ].includes(errorCode);
}

function isSafeCompletion(value: NotificationJobCompletion): boolean {
  return ["dispatched", "retry", "canceled", "failed"].includes(value.outcome) &&
    [value.successCount, value.failureCount, value.invalidTokenCount].every(
      (count) => Number.isInteger(count) && count >= 0 && count <= NOTIFICATION_TOKEN_LIMIT
    ) && value.invalidTokenCount <= value.failureCount;
}

function matchesClaim(job: NotificationJob, claim: NotificationClaim): boolean {
  return job.status === "claimed" && job.uid === claim.uid && job.templateId === claim.templateId &&
    job.route === claim.route && job.claimedAt === claim.claimedAt && job.attemptCount === claim.attemptCount;
}

function retryDelayMs(attemptCount: number): number {
  return Math.min(30 * 60 * 1_000, 5 * 60 * 1_000 * (2 ** Math.max(0, attemptCount - 1)));
}

function withoutResultFields(job: NotificationJob): NotificationJob {
  const { successCount: _success, failureCount: _failure, invalidTokenCount: _invalid, dispatchedAt: _dispatched, ...safe } = job;
  return safe;
}

function withoutClaimAndResultFields(job: NotificationJob): Omit<NotificationJob, "claimedAt" | "dispatchedAt" | "successCount" | "failureCount" | "invalidTokenCount"> {
  const {
    claimedAt: _claimed,
    dispatchedAt: _dispatched,
    successCount: _success,
    failureCount: _failure,
    invalidTokenCount: _invalid,
    ...safe
  } = job;
  return safe;
}

function isNotificationTemplateId(value: unknown): value is NotificationTemplateId {
  return typeof value === "string" && NOTIFICATION_TEMPLATE_IDS.includes(value as NotificationTemplateId);
}

function isSafeTime(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactRecord(value: unknown, allowed: readonly string[]): value is Record<string, never> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

async function withHardTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Remote Config unavailable.")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
