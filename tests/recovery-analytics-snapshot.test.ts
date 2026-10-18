import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultRecoveryState, hydrateRecoveryState, recordChallengeCompletion, recordDailyCheckIn, updateAnalyticsSharingSettings, getRecoveryUtcAnalyticsDayCounts } from "../src/lib/recovery-state";
import { ANALYTICS_CONSENT_VERSION, ANALYTICS_SNAPSHOT_SCHEMA_VERSION, applyAnalyticsSnapshotReceipt, applyPendingAnalyticsSnapshotReceipt, getConfiguredAnalyticsEndpoint, prepareAnalyticsSnapshotState, prepareAnalyticsPendingSnapshot, stageAnalyticsPendingSnapshot, sendGatedAnalyticsPayload } from "../src/lib/recovery-analytics";
import { challengeLibrary } from "../src/lib/recovery-engine";
import { configureFirebaseFeatureProviders } from "../src/lib/firebase-feature-runtime";
import { createFirebaseCallableContracts } from "../src/lib/firebase-client";
import { buildPortableRecoveryState } from "../src/lib/recovery-backup";
import { parseAggregateAnalyticsSnapshot, validateServerDocument, type AggregateAnalyticsSnapshotInput } from "../functions/src/contracts";
import { aggregateSnapshotId, ingestAbsoluteAnalyticsSnapshot } from "../functions/src/aggregate-analytics";
import type { TransactionalStore } from "../functions/src/transactional";

const at = "2026-10-01T12:00:00.000Z";
const now = Date.parse(at);
const challenge = challengeLibrary.find(challenge => challenge.id === "breathing-478")!;
function store() {
  const data = new Map<string, object>();
  let writing = false;
  const transactional: TransactionalStore = {
    async get<T extends object>(path: string) { assert.equal(writing, false, "Every business and control read must precede transaction writes."); return { value: data.get(path) as T | undefined }; },
    async set(path, value) { writing = true; validateServerDocument(path.split("/")[0], value); data.set(path, structuredClone(value)); }
  };
  return { data, begin: () => { writing = false; return transactional; } };
}
function input(count = 501, revision = 0): AggregateAnalyticsSnapshotInput {
  const value: Omit<AggregateAnalyticsSnapshotInput, "snapshotId"> = { schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: `lin_${"a".repeat(32)}`, baseRevision: revision,
    days: getRecoveryUtcAnalyticsDayCounts(createDefaultRecoveryState(), at).map(day => ({ ...day, completedChallenges: day.day === "2026-10-01" ? count : 0 })),
    consentVersion: ANALYTICS_CONSENT_VERSION, userOptedInAt: at, dataRetentionDays: 14 as const };
  return { ...value, snapshotId: aggregateSnapshotId(value) };
}

test("absolute snapshots replace counts, replay the same revision, and refuse stale or decreasing branches", async () => {
  const memory = store();
  const first = input();
  const accepted = await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", first, now);
  assert.equal(accepted.acceptedRevision, 1);
  assert.equal(accepted.duplicate, false);
  const replay = await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", first, now + 1);
  assert.equal(replay.acceptedRevision, 1);
  assert.equal(replay.duplicate, true);
  const counters = memory.data.get("aggregate_analytics/uid_A_2026-10-01") as { completedChallenges: number; expiresAt: number };
  assert.equal(counters.completedChallenges, 501);
  assert.equal(counters.expiresAt, Date.parse("2026-10-15T00:00:00.000Z"));
  await assert.rejects(ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", input(502, 0), now + 2), /baseline conflicts/i);
  await assert.rejects(ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", input(500, 1), now + 2), /decrease/i);
  const wrongLineage = { ...input(502, 1), lineageId: `lin_${"b".repeat(32)}` };
  wrongLineage.snapshotId = aggregateSnapshotId(wrongLineage);
  await assert.rejects(ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", wrongLineage, now + 2), /lineage/i);
  const next = await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", input(502, 1), now + 3);
  assert.equal(next.acceptedRevision, 2);
  assert.equal((memory.data.get("aggregate_analytics/uid_A_2026-10-01") as { completedChallenges: number }).completedChallenges, 502);
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", first, now + 4)).acceptedRevision, 1, "An older accepted snapshot retries its own receipt without replacing the newer counters.");
  assert.equal((memory.data.get("aggregate_analytics/uid_A_2026-10-01") as { completedChallenges: number }).completedChallenges, 502);
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_B", first, now + 5)).acceptedRevision, 1, "Auth UID isolates each user's snapshot.");
});

test("snapshot parser rejects hidden fields, unsupported dates, unsafe counts and retention outside the consent contract", () => {
  const valid = input();
  assert.deepEqual(parseAggregateAnalyticsSnapshot(valid), valid);
  for (const changed of [{ ...valid, uid: "chosen_uid" }, { ...valid, schemaVersion: "aggregate-v5" }, { ...valid, dataRetentionDays: 30 },
      { ...valid, days: valid.days.slice(1) }, { ...valid, days: valid.days.map((day, index) => index === 0 ? { ...day, day: "2026-02-30" } : day) },
      { ...valid, days: valid.days.map((day, index) => index === 0 ? { ...day, completedChallenges: Number.MAX_SAFE_INTEGER + 1 } : day) },
      { ...valid, days: valid.days.map((day, index) => index === 0 ? { ...day, note: "private" } : day) }]) {
    assert.throws(() => parseAggregateAnalyticsSnapshot(changed), /unsupported|sensitive|14 UTC/i);
  }
});

test("UTC day snapshots retain 201 completions across the history cap and exclude undated legacy counts", () => {
  const previousZone = process.env.TZ;
  try {
    const saved = hydrateRecoveryState({ ...createDefaultRecoveryState(), completedChallenges: 500,
      challengeHistory: Array.from({ length: 201 }, (_unused, index) => ({ ...challenge, completedAt: `2026-09-30T23:${String(59 - index % 60).padStart(2, "0")}:00.000Z`, outcome: "helped" })) });
    process.env.TZ = "Asia/Kolkata";
    const first = getRecoveryUtcAnalyticsDayCounts(saved, at);
    assert.equal(first.find(day => day.day === "2026-09-30")?.completedChallenges, 201);
    assert.equal(first.reduce((sum, day) => sum + day.completedChallenges, 0), 201, "The missing 299 dates are never assigned to a UTC day.");
    process.env.TZ = "Pacific/Honolulu";
    assert.deepEqual(getRecoveryUtcAnalyticsDayCounts(saved, at), first);
  } finally { if (previousZone === undefined) delete process.env.TZ; else process.env.TZ = previousZone; }
});

test("Firebase requires exact schema receipts and checkpoints acknowledge the captured counts despite intervening activity", async () => {
  const memory = store();
  let oldSchema = false;
  const payloads: AggregateAnalyticsSnapshotInput[] = [];
  const contracts = createFirebaseCallableContracts({ call: async (name, payload) => {
    assert.equal(name, "ingestAggregateAnalytics");
    const parsed = parseAggregateAnalyticsSnapshot(payload);
    payloads.push(parsed);
    if (oldSchema) return { ok: true, duplicate: false };
    return ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_A", parsed, now);
  } });
  const stop = configureFirebaseFeatureProviders(async () => contracts);
  try {
    let captured = prepareAnalyticsSnapshotState(hydrateRecoveryState({ ...createDefaultRecoveryState(), completedChallenges: 500,
      challengeHistory: Array.from({ length: 201 }, () => ({ ...challenge, completedAt: at, outcome: "helped" })) }));
    captured = recordDailyCheckIn(captured, { mood: "steady", urgeLevel: 1, sleepQuality: 4, reflection: "private reflection https://private.example/" }, at);
    captured = updateAnalyticsSharingSettings(captured, { enabled: true, userOptedInAt: new Date(Math.min(now, Date.now() - 60_000)).toISOString(), consentVersion: ANALYTICS_CONSENT_VERSION,
      endpointUrl: getConfiguredAnalyticsEndpoint(), dataRetentionDays: 14 });
    captured = stageAnalyticsPendingSnapshot(captured, captured, await prepareAnalyticsPendingSnapshot(captured, captured.analyticsSharing, at));
    const accepted = await sendGatedAnalyticsPayload(captured, captured.analyticsSharing, { day: at });
    assert.equal(accepted.accepted, true, accepted.reason ?? JSON.stringify(accepted.readiness));
    assert.match(accepted.reason ?? "", /undated.*remain on this device/i);
    const callCount = payloads.length;
    assert.equal((await sendGatedAnalyticsPayload(captured, { ...captured.analyticsSharing, dataRetentionDays: 30 }, { day: at })).status, "blocked");
    assert.equal(payloads.length, callCount, "The wrong retention consent does not call Firebase.");
    assert.equal(payloads[0].days.find(day => day.day === "2026-10-01")?.completedChallenges, 201);
    assert.equal(JSON.stringify(payloads[0]).includes("breathing-478"), false);
    assert.equal(JSON.stringify(payloads[0]).includes("reflection"), false);
    const updated = recordChallengeCompletion(captured, challenge, at);
    let acknowledged = applyPendingAnalyticsSnapshotReceipt(updated, captured, accepted.snapshotReceipt!);
    assert.equal(acknowledged.completedChallenges, 501, "Cumulative legacy progress stays local while only 202 located events can be shared next.");
    assert.equal(acknowledged.analyticsSharing.snapshotCheckpoint.revision, 1);
    assert.equal(acknowledged.analyticsSharing.snapshotCheckpoint.days.find(day => day.day === "2026-10-01")?.completedChallenges, 201);
    const portable = hydrateRecoveryState(buildPortableRecoveryState(acknowledged, at));
    assert.deepEqual(portable.analyticsSharing.snapshotCheckpoint, acknowledged.analyticsSharing.snapshotCheckpoint);
    const staleReceipt = { ...accepted.snapshotReceipt!, lineageId: `lin_${"f".repeat(32)}` };
    assert.equal(applyAnalyticsSnapshotReceipt(updated, captured, staleReceipt), updated);
    assert.throws(() => applyPendingAnalyticsSnapshotReceipt(updated, captured, staleReceipt), /conflicts/i);
    acknowledged = stageAnalyticsPendingSnapshot(acknowledged, acknowledged, await prepareAnalyticsPendingSnapshot(acknowledged, acknowledged.analyticsSharing, at));
    const next = await sendGatedAnalyticsPayload(acknowledged, acknowledged.analyticsSharing, { day: at });
    assert.equal(next.accepted, true);
    assert.equal(next.snapshotReceipt?.acceptedRevision, 2);
    assert.equal(next.snapshotReceipt?.days.find(day => day.day === "2026-10-01")?.completedChallenges, 202);
    const beforeStale = memory.data.get("aggregate_analytics/uid_A_2026-10-01");
    const retryOlder = recordChallengeCompletion(updated, challenge, at);
    assert.equal((await sendGatedAnalyticsPayload(retryOlder, retryOlder.analyticsSharing, { day: at })).accepted, true, "The pending request retries its own old receipt, never the newer unsent actions.");
    const staleBranch = updateAnalyticsSharingSettings(retryOlder, { pendingSnapshot: null });
    const conflicting = stageAnalyticsPendingSnapshot(staleBranch, staleBranch, await prepareAnalyticsPendingSnapshot(staleBranch, staleBranch.analyticsSharing, at));
    assert.equal((await sendGatedAnalyticsPayload(conflicting, conflicting.analyticsSharing, { day: at })).accepted, false);
    assert.deepEqual(memory.data.get("aggregate_analytics/uid_A_2026-10-01"), beforeStale);
    oldSchema = true;
    const unsupported = await sendGatedAnalyticsPayload(acknowledged, acknowledged.analyticsSharing, { day: at });
    assert.equal(unsupported.accepted, false);
    assert.equal(unsupported.status, "error");
    assert.match(unsupported.reason ?? "", /schema|revision/i);
  } finally { stop(); }
});

test("a durable pending request survives a lost reply, new action, restart and UTC rollover without extending expired counters", async () => {
  const beforeMidnight = "2026-10-01T23:59:00.000Z";
  const afterMidnight = "2026-10-02T00:01:00.000Z";
  let serverNow = Date.parse(beforeMidnight);
  let loseReply = true;
  const memory = store();
  const payloads: AggregateAnalyticsSnapshotInput[] = [];
  const contracts = createFirebaseCallableContracts({ call: async (name, payload) => {
    assert.equal(name, "ingestAggregateAnalytics");
    const parsed = parseAggregateAnalyticsSnapshot(payload);
    payloads.push(parsed);
    const receipt = await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_lost", parsed, serverNow);
    if (loseReply) { loseReply = false; throw new Error("Network disconnected after the server accepted the request."); }
    return receipt;
  } });
  const stop = configureFirebaseFeatureProviders(async () => contracts);
  try {
    const initial = recordChallengeCompletion(prepareAnalyticsSnapshotState(createDefaultRecoveryState()), challenge, beforeMidnight);
    const captured = updateAnalyticsSharingSettings(initial, { enabled: true,
      userOptedInAt: new Date(Math.min(serverNow, Date.now() - 60_000)).toISOString(), consentVersion: ANALYTICS_CONSENT_VERSION,
      endpointUrl: getConfiguredAnalyticsEndpoint(), dataRetentionDays: 14 });
    const pending = await prepareAnalyticsPendingSnapshot(captured, captured.analyticsSharing, beforeMidnight);
    const staged = stageAnalyticsPendingSnapshot(captured, captured, pending);
    const persistedBeforeSend = JSON.parse(JSON.stringify(staged));
    assert.equal((await sendGatedAnalyticsPayload(staged, staged.analyticsSharing, { day: beforeMidnight })).accepted, false);
    const firstDayKey = `aggregate_analytics/uid_lost_${pending.days[0].day}`;
    const expiredCounter = structuredClone(memory.data.get(firstDayKey));
    const originalReceiptExpiry = (memory.data.get(`idempotency/uid_lost_analytics_${pending.snapshotId}`) as {expiresAt: number}).expiresAt;
    serverNow = Date.parse(afterMidnight);
    const restored = hydrateRecoveryState(persistedBeforeSend);
    const withNewAction = recordChallengeCompletion(restored, challenge, afterMidnight);
    assert.deepEqual(await prepareAnalyticsPendingSnapshot(withNewAction, withNewAction.analyticsSharing, afterMidnight), pending);
    const retryState = stageAnalyticsPendingSnapshot(withNewAction, withNewAction, pending);
    const retry = await sendGatedAnalyticsPayload(retryState, retryState.analyticsSharing, { day: afterMidnight });
    assert.equal(retry.accepted, true, retry.reason ?? "Retry should use the known receipt from yesterday.");
    assert.deepEqual(payloads[1], payloads[0], "The exact request and ID survive restart and new activity.");
    assert.deepEqual(memory.data.get(firstDayKey), expiredCounter, "Retrying must not refresh or extend an expired day counter.");
    assert.ok((expiredCounter as {expiresAt: number}).expiresAt <= serverNow);
    assert.equal((memory.data.get(`idempotency/uid_lost_analytics_${pending.snapshotId}`) as {expiresAt: number}).expiresAt, originalReceiptExpiry);
    const acknowledged = applyPendingAnalyticsSnapshotReceipt(retryState, retryState, retry.snapshotReceipt!);
    assert.equal(acknowledged.completedChallenges, 2);
    assert.equal(acknowledged.analyticsSharing.snapshotCheckpoint.revision, 1);
    assert.equal(acknowledged.analyticsSharing.pendingSnapshot, null);
    assert.equal(acknowledged.analyticsSharing.snapshotCheckpoint.days.reduce((sum, day) => sum + day.completedChallenges, 0), 1);
    const freshPending = await prepareAnalyticsPendingSnapshot(acknowledged, acknowledged.analyticsSharing, afterMidnight);
    assert.equal(freshPending.baseRevision, 1);
    assert.equal(freshPending.days[freshPending.days.length - 1].day, "2026-10-02");
    assert.equal(freshPending.days.reduce((sum, day) => sum + day.completedChallenges, 0), 2);
    const fresh = stageAnalyticsPendingSnapshot(acknowledged, acknowledged, freshPending);
    assert.equal((await sendGatedAnalyticsPayload(fresh, fresh.analyticsSharing, { day: afterMidnight })).snapshotReceipt?.acceptedRevision, 2);
    assert.deepEqual(memory.data.get(firstDayKey), expiredCounter, "A fresh window also leaves the old expired day untouched.");
  } finally { stop(); }
});

test("hashing merges only the pending request and unknown or expired windows request explicit recovery", async () => {
  const captured = updateAnalyticsSharingSettings(prepareAnalyticsSnapshotState(createDefaultRecoveryState()), {
    enabled: true, consentVersion: ANALYTICS_CONSENT_VERSION, userOptedInAt: "2026-09-01T00:00:00.000Z", dataRetentionDays: 14
  });
  const pending = await prepareAnalyticsPendingSnapshot(captured, captured.analyticsSharing, at);
  const newAction = recordChallengeCompletion(captured, challenge, at);
  const staged = stageAnalyticsPendingSnapshot(newAction, captured, pending);
  assert.equal(staged.completedChallenges, 1);
  assert.equal(staged.analyticsSharing.pendingSnapshot?.days.reduce((sum, day) => sum + day.completedChallenges, 0), 0);
  assert.deepEqual(hydrateRecoveryState(JSON.parse(JSON.stringify(staged))).analyticsSharing.pendingSnapshot, pending);
  const conflictingPending = await prepareAnalyticsPendingSnapshot(newAction, newAction.analyticsSharing, at);
  assert.throws(() => stageAnalyticsPendingSnapshot(staged, newAction, conflictingPending), /awaiting acknowledgement/i);
  const memory = store();
  const request = parseAggregateAnalyticsSnapshot(pending);
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_unknown", request, now + 86_400_000)).ok, false);
  assert.equal(memory.data.has("aggregate_analytics/uid_unknown_snapshot"), false, "An unknown request from yesterday cannot establish today's baseline.");
  await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_expired", request, now);
  const original = structuredClone(memory.data.get("aggregate_analytics/uid_expired_2026-10-01"));
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(memory.begin(), "uid_expired", request, now + 15 * 86_400_000)).ok, false);
  assert.deepEqual(memory.data.get("aggregate_analytics/uid_expired_2026-10-01"), original, "An expired receipt cannot refresh old counts or invent a new baseline.");
});
