import assert from "node:assert/strict";
import test from "node:test";

import {
  FCM_TOKEN_MAX_LENGTH,
  NOTIFICATION_JOB_MAX_ATTEMPTS,
  NOTIFICATION_TEMPLATE_IDS,
  buildReviewedNotificationPayload,
  claimNotificationJob,
  completeNotificationClaim,
  createNotificationDispatchService,
  createReviewedNotificationJob,
  createRemoteNotificationGateReader,
  isFcmRegistrationToken,
  readRemoteNotificationGateTemplate,
  type NotificationClaim,
  type NotificationJob,
  type NotificationJobCompletion,
  type NotificationToken
} from "./notifications.js";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");
const REAL_FCM_TOKEN = "fcmRegistrationPrefix123:APA91bG9uZ19yZWFsX3NoYXBlZF90b2tlbi0xMjM0NTY3ODkw";

test("FCM registration-token grammar accepts colon tokens and rejects malformed, placeholder, and oversized values", () => {
  assert.equal(isFcmRegistrationToken(REAL_FCM_TOKEN), true);
  assert.equal(isFcmRegistrationToken("fcm-registration-token"), true);
  for (const invalid of [
    "short",
    "fcm token contains spaces",
    "https://example.invalid/token",
    "your-fcm-token-placeholder",
    "x".repeat(FCM_TOKEN_MAX_LENGTH + 1)
  ]) {
    assert.equal(isFcmRegistrationToken(invalid), false, `expected ${invalid.slice(0, 30)} to be rejected`);
  }
});

test("reviewed notification catalog materializes exact general copy and route metadata", () => {
  assert.deepEqual(NOTIFICATION_TEMPLATE_IDS, [
    "morning-checkin",
    "evening-reflection",
    "night-guard",
    "challenge-followup",
    "streak-encouragement"
  ]);
  const payload = buildReviewedNotificationPayload("night-guard");
  assert.deepEqual(payload, {
    notification: {
      title: "FREED night guard",
      body: "Phone away, lights low, one clean choice at a time."
    },
    data: { route: "checkin", kind: "night-guard" }
  });
  assert.equal(JSON.stringify(payload).includes("url"), false);
  assert.equal(JSON.stringify(payload).includes("streakDays"), false);
  assert.throws(() => buildReviewedNotificationPayload("arbitrary-copy" as never), /unsupported notification template/i);
});

test("server queue documents contain only reviewed identifiers, timing fields, status, and aggregate counts", () => {
  const queued = createReviewedNotificationJob({
    uid: "firebaseUid123",
    templateId: "evening-reflection",
    scheduledAt: NOW,
    now: NOW - 1_000
  });
  assert.deepEqual(queued, {
    uid: "firebaseUid123",
    templateId: "evening-reflection",
    route: "checkin",
    status: "pending",
    scheduledAt: NOW,
    createdAt: NOW - 1_000,
    attemptCount: 0,
    expiresAt: NOW - 1_000 + 7 * 24 * 60 * 60 * 1_000
  });
  assert.equal(JSON.stringify(queued).includes("token"), false);
  for (const unsafe of [
    { uid: "firebaseUid123", templateId: "evening-reflection", scheduledAt: NOW, now: NOW, body: "free text" },
    { uid: "firebaseUid123", templateId: "unknown", scheduledAt: NOW, now: NOW },
    { uid: "firebaseUid123", templateId: "evening-reflection", scheduledAt: NOW, now: NOW, url: "https://example.invalid" }
  ]) {
    assert.throws(() => createReviewedNotificationJob(unsafe as never), /unsupported notification job/i);
  }
});

test("Remote Config accepts only a literal true and never serves stale enabled state", async () => {
  const enabled = { parameters: { remote_notifications_enabled: { defaultValue: { value: "true" } } } };
  const disabled = { parameters: { remote_notifications_enabled: { defaultValue: { value: "false" } } } };
  assert.equal(readRemoteNotificationGateTemplate(enabled), "enabled");
  assert.equal(readRemoteNotificationGateTemplate(disabled), "disabled");
  for (const malformed of [undefined, {}, { parameters: {} }, {
    parameters: { remote_notifications_enabled: { defaultValue: { value: true } } }
  }, {
    parameters: { remote_notifications_enabled: { defaultValue: { value: "TRUE" } } }
  }]) {
    assert.equal(readRemoteNotificationGateTemplate(malformed), "unavailable");
  }

  let now = NOW;
  let mode: "enabled" | "unavailable" | "stalled" = "enabled";
  const reader = createRemoteNotificationGateReader(async () => {
    if (mode === "unavailable") throw new Error("Remote Config unavailable");
    if (mode === "stalled") return new Promise(() => undefined);
    return enabled;
  }, () => now, 100, 5);
  assert.equal(await reader(), "enabled");
  mode = "unavailable";
  assert.equal(await reader(), "enabled", "fresh cache is bounded but usable");
  now += 101;
  assert.equal(await reader(), "unavailable", "expired cache must never fail open");
  mode = "stalled";
  assert.equal(await reader(), "unavailable", "timeout must fail closed");
});

test("claims are monotonic and stale workers cannot commit after retry or cancellation", () => {
  const pending = job();
  const first = claimNotificationJob(pending, NOW);
  assert.ok(first);
  assert.equal(first.job.status, "claimed");
  assert.equal(first.claim.attemptCount, 1);
  assert.equal(claimNotificationJob(first.job, NOW + 1), null, "active lease cannot be stolen");

  const retried = completeNotificationClaim(first.job, first.claim, {
    outcome: "retry", successCount: 0, failureCount: 1, invalidTokenCount: 0
  }, NOW + 1);
  assert.ok(retried);
  assert.equal(retried.status, "pending");
  const second = claimNotificationJob(retried, retried.scheduledAt);
  assert.ok(second);
  assert.equal(second.claim.attemptCount, 2);
  assert.ok(second.claim.claimedAt > first.claim.claimedAt);
  assert.equal(completeNotificationClaim(second.job, first.claim, completion("dispatched"), NOW + 2), null);

  const canceled = { ...second.job, status: "canceled" as const };
  assert.equal(completeNotificationClaim(canceled, second.claim, completion("dispatched"), NOW + 2), null);
});

test("dispatch gate false, unavailable, and stalled paths produce zero provider sends", async () => {
  for (const gate of ["disabled", "unavailable"] as const) {
    let sends = 0;
    const result = await createNotificationDispatchService({
      now: () => NOW,
      getGate: async () => gate,
      listDueJobIds: async () => ["job_12345678"],
      claimJob: async () => { throw new Error("must not claim while disabled"); },
      prepareProviderInvocation: async () => true,
      listActiveTokens: async () => [],
      sendFirebaseAdminMessages: async () => { sends += 1; return []; },
      deleteInvalidTokens: async () => undefined,
      completeClaim: async () => true
    }).run();
    assert.deepEqual(result, { gate, claimed: 0, sent: 0, failed: 0, canceled: 0 });
    assert.equal(sends, 0);
  }
});

test("dispatcher rechecks deletion after claim and after token load before Firebase Admin invocation", async () => {
  for (const deletionCheckToFail of [1, 2]) {
    let checks = 0;
    let sends = 0;
    const completions: NotificationJobCompletion[] = [];
    const claimed = claimNotificationJob(job(), NOW)!;
    const service = createNotificationDispatchService({
      now: () => NOW,
      getGate: async () => "enabled",
      listDueJobIds: async () => ["job_12345678"],
      claimJob: async () => claimed.claim,
      prepareProviderInvocation: async () => {
        checks += 1;
        return checks !== deletionCheckToFail;
      },
      listActiveTokens: async () => [token("token-a")],
      sendFirebaseAdminMessages: async () => { sends += 1; return [{ success: true }]; },
      deleteInvalidTokens: async () => undefined,
      completeClaim: async (_claim, completionValue) => { completions.push(completionValue); return true; }
    });
    const result = await service.run();
    assert.equal(sends, 0);
    assert.equal(result.canceled, 1);
    assert.equal(completions[0]?.outcome, "canceled");
  }
});

test("dispatcher sends catalog-only Firebase Admin payloads, deletes invalid tokens, and records aggregate results", async () => {
  const claimed = claimNotificationJob(job({ templateId: "morning-checkin" }), NOW)!;
  const invalidTokenIds: string[][] = [];
  const completions: NotificationJobCompletion[] = [];
  const capturedMessages: unknown[] = [];
  const service = createNotificationDispatchService({
    now: () => NOW,
    getGate: async () => "enabled",
    listDueJobIds: async () => ["job_12345678"],
    claimJob: async () => claimed.claim,
    prepareProviderInvocation: async () => true,
    listActiveTokens: async () => [token("ios-install"), token("android-install")],
    sendFirebaseAdminMessages: async (messages) => {
      capturedMessages.push(...messages);
      return [
        { success: false, errorCode: "messaging/registration-token-not-registered" },
        { success: true }
      ];
    },
    deleteInvalidTokens: async (ids) => { invalidTokenIds.push([...ids]); },
    completeClaim: async (_claim, completionValue) => { completions.push(completionValue); return true; }
  });
  assert.deepEqual(await service.run(), { gate: "enabled", claimed: 1, sent: 1, failed: 0, canceled: 0 });
  assert.deepEqual(invalidTokenIds, [["ios-install"]]);
  assert.deepEqual(completions, [{ outcome: "dispatched", successCount: 1, failureCount: 1, invalidTokenCount: 1 }]);
  assert.equal(capturedMessages.length, 2);
  for (const message of capturedMessages as Array<Record<string, unknown>>) {
    assert.deepEqual(message.notification, {
      title: "FREED morning reset",
      body: "One minute to set the tone before the day starts moving."
    });
    assert.deepEqual(message.data, { route: "checkin", kind: "morning-checkin" });
    assert.equal(typeof message.token, "string");
    assert.equal("url" in message, false);
  }
  assert.equal(JSON.stringify(completions).includes(REAL_FCM_TOKEN), false);
});

test("transient failures retry with a strict cap while permanent failures do not retry", async () => {
  for (const scenario of [
    { errorCode: "messaging/server-unavailable", attemptCount: 1, expected: "retry" },
    { errorCode: "messaging/server-unavailable", attemptCount: NOTIFICATION_JOB_MAX_ATTEMPTS, expected: "failed" },
    { errorCode: "messaging/sender-id-mismatch", attemptCount: 1, expected: "failed" }
  ] as const) {
    const claim: NotificationClaim = {
      jobId: "job_12345678",
      uid: "firebaseUid123",
      templateId: "night-guard",
      route: "checkin",
      claimedAt: NOW,
      attemptCount: scenario.attemptCount
    };
    const completions: NotificationJobCompletion[] = [];
    await createNotificationDispatchService({
      now: () => NOW,
      getGate: async () => "enabled",
      listDueJobIds: async () => [claim.jobId],
      claimJob: async () => claim,
      prepareProviderInvocation: async () => true,
      listActiveTokens: async () => [token("device-install")],
      sendFirebaseAdminMessages: async () => [{ success: false, errorCode: scenario.errorCode }],
      deleteInvalidTokens: async () => undefined,
      completeClaim: async (_claim, completionValue) => { completions.push(completionValue); return true; }
    }).run();
    assert.equal(completions[0]?.outcome, scenario.expected);
  }
});

test("unexpected provider errors remain retryable and provider bodies never enter completion data", async () => {
  const claimed = claimNotificationJob(job(), NOW)!;
  const completions: NotificationJobCompletion[] = [];
  await createNotificationDispatchService({
    now: () => NOW,
    getGate: async () => "enabled",
    listDueJobIds: async () => [claimed.claim.jobId],
    claimJob: async () => claimed.claim,
    prepareProviderInvocation: async () => true,
    listActiveTokens: async () => [token("device-install")],
    sendFirebaseAdminMessages: async () => { throw new Error(`provider leaked ${REAL_FCM_TOKEN}`); },
    deleteInvalidTokens: async () => undefined,
    completeClaim: async (_claim, completionValue) => { completions.push(completionValue); return true; }
  }).run();
  assert.deepEqual(completions, [{ outcome: "retry", successCount: 0, failureCount: 1, invalidTokenCount: 0 }]);
  assert.equal(JSON.stringify(completions).includes("provider leaked"), false);
  assert.equal(JSON.stringify(completions).includes(REAL_FCM_TOKEN), false);
});

test("invalid-token cleanup failure cannot turn a successful provider result into a duplicate-delivery retry", async () => {
  const claimed = claimNotificationJob(job(), NOW)!;
  const completions: NotificationJobCompletion[] = [];
  await createNotificationDispatchService({
    now: () => NOW,
    getGate: async () => "enabled",
    listDueJobIds: async () => [claimed.claim.jobId],
    claimJob: async () => claimed.claim,
    prepareProviderInvocation: async () => true,
    listActiveTokens: async () => [token("invalid-install"), token("valid-install")],
    sendFirebaseAdminMessages: async () => [
      { success: false, errorCode: "messaging/registration-token-not-registered" },
      { success: true }
    ],
    deleteInvalidTokens: async () => { throw new Error("Firestore cleanup unavailable"); },
    completeClaim: async (_claim, completionValue) => { completions.push(completionValue); return true; }
  }).run();
  assert.deepEqual(completions, [{ outcome: "dispatched", successCount: 1, failureCount: 1, invalidTokenCount: 1 }]);
});

function job(overrides: Partial<NotificationJob> = {}): NotificationJob {
  return {
    uid: "firebaseUid123",
    templateId: "night-guard",
    route: "checkin",
    status: "pending",
    scheduledAt: NOW,
    createdAt: NOW - 1_000,
    attemptCount: 0,
    expiresAt: NOW + 24 * 60 * 60 * 1_000,
    ...overrides
  };
}

function completion(outcome: NotificationJobCompletion["outcome"]): NotificationJobCompletion {
  return { outcome, successCount: 1, failureCount: 0, invalidTokenCount: 0 };
}

function token(id: string): NotificationToken {
  return { id, token: `${REAL_FCM_TOKEN}_${id}` };
}
