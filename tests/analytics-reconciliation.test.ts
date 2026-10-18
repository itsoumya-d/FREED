import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultRecoveryState, recordChallengeCompletion, updateAnalyticsSharingSettings } from "../src/lib/recovery-state";
import { challengeLibrary } from "../src/lib/recovery-engine";
import { prepareAnalyticsSnapshotState, prepareAnalyticsPendingSnapshot, stageAnalyticsPendingSnapshot, applyPendingAnalyticsSnapshotReceipt, applyAnalyticsSnapshotRecovery, parseAnalyticsSnapshotRecovery, type AnalyticsSnapshotRecovery } from "../src/lib/recovery-analytics";
import { ingestAbsoluteAnalyticsSnapshot } from "../functions/src/aggregate-analytics";
import type { TransactionalStore } from "../functions/src/transactional";
const day = "2026-10-01T12:00:00.000Z", tomorrow = "2026-10-02T12:00:00.000Z";
const now = Date.parse(day), later = Date.parse(tomorrow);
function memory() {
  const data = new Map<string, object>();
  const store: TransactionalStore = { get: async <T extends object>(path: string) => ({ value: data.get(path) as T | undefined }), set: async (path, value) => { data.set(path, structuredClone(value)); } };
  return { data, store };
}
async function staged(state = prepareAnalyticsSnapshotState(updateAnalyticsSharingSettings(createDefaultRecoveryState(), {enabled:true,consentVersion:"analytics-consent-v1",userOptedInAt:day,dataRetentionDays:14})), at = day) {
  return stageAnalyticsPendingSnapshot(state, state, await prepareAnalyticsPendingSnapshot(state, state.analyticsSharing, at));
}
function receipt(state: Awaited<ReturnType<typeof staged>>) {
  const pending = state.analyticsSharing.pendingSnapshot!;
  return {...pending, acceptedRevision:pending.baseRevision + 1};
}
test("never delivered yesterday safely restarts missing baseline and refreshes matching established baseline", async () => {
  const db = memory(); const first = await staged();
  const absent = await ingestAbsoluteAnalyticsSnapshot(db.store, "a", first.analyticsSharing.pendingSnapshot!, later);
  const recovery = parseAnalyticsSnapshotRecovery(absent, first.analyticsSharing.pendingSnapshot!)!;
  assert.equal(recovery.recovery, "new-lineage");
  const reset = applyAnalyticsSnapshotRecovery(first, first, recovery);
  assert.notEqual(reset.analyticsSharing.snapshotCheckpoint.lineageId, first.analyticsSharing.snapshotCheckpoint.lineageId);
  const fresh = await staged(reset, tomorrow);
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(db.store, "a", fresh.analyticsSharing.pendingSnapshot!, later)).ok, true);
  const acknowledged = applyPendingAnalyticsSnapshotReceipt(fresh, fresh, receipt(fresh));
  const next = await staged(acknowledged, tomorrow);
  const followingDay = "2026-10-03T12:00:00.000Z";
  const refreshResponse = await ingestAbsoluteAnalyticsSnapshot(db.store, "a", next.analyticsSharing.pendingSnapshot!, Date.parse(followingDay));
  const refresh = parseAnalyticsSnapshotRecovery(refreshResponse, next.analyticsSharing.pendingSnapshot!)!;
  assert.equal(refresh.recovery, "refresh-window");
  const refreshed = applyAnalyticsSnapshotRecovery(next, next, refresh);
  assert.deepEqual(refreshed.analyticsSharing.snapshotCheckpoint, next.analyticsSharing.snapshotCheckpoint);
  const sent = await staged(refreshed, followingDay);
  assert.equal((await ingestAbsoluteAnalyticsSnapshot(db.store, "a", sent.analyticsSharing.pendingSnapshot!, Date.parse(followingDay))).ok, true);
});
test("new account and expired or removed baseline recover without changing local counts", async () => {
  for (const scenario of ["new-account", "expired", "removed"] as const) {
    const db = memory(); const first = await staged();
    await ingestAbsoluteAnalyticsSnapshot(db.store,"a",first.analyticsSharing.pendingSnapshot!,now);
    const acknowledged = applyPendingAnalyticsSnapshotReceipt(first,first,receipt(first));
    const at = scenario === "new-account" ? day : "2026-10-17T12:00:00.000Z";
    const withActivity = recordChallengeCompletion(acknowledged,challengeLibrary[0],at);
    const pending = await staged(withActivity,at);
    if (scenario === "removed") db.data.clear();
    const uid = scenario === "new-account" ? "b" : "a";
    const response = await ingestAbsoluteAnalyticsSnapshot(db.store,uid,pending.analyticsSharing.pendingSnapshot!,Date.parse(at));
    const instruction = parseAnalyticsSnapshotRecovery(response,pending.analyticsSharing.pendingSnapshot!)!;
    assert.equal(instruction.recovery,"new-lineage");
    const reset = applyAnalyticsSnapshotRecovery(pending,pending,instruction);
    assert.equal(reset.completedChallenges, withActivity.completedChallenges);
    assert.deepEqual(reset.challengeHistory,withActivity.challengeHistory);
    assert.equal(reset.analyticsSharing.snapshotCheckpoint.revision,0);
    const fresh = await staged(reset,at);
    assert.equal((await ingestAbsoluteAnalyticsSnapshot(db.store,uid,fresh.analyticsSharing.pendingSnapshot!,Date.parse(at))).ok,true);
  }
});
test("known lost-reply receipt wins over rollover and expired baseline; other device conflicts stay explicit", async () => {
  const db = memory(); const first = await staged();
  await ingestAbsoluteAnalyticsSnapshot(db.store,"a",first.analyticsSharing.pendingSnapshot!,now);
  db.data.delete("aggregate_analytics/a_snapshot");
  const reply = await ingestAbsoluteAnalyticsSnapshot(db.store,"a",first.analyticsSharing.pendingSnapshot!,later);
  assert.equal(reply.ok,true); assert.equal(reply.duplicate,true);
  assert.equal(parseAnalyticsSnapshotRecovery(reply,first.analyticsSharing.pendingSnapshot!),null);
  const other = await staged();
  await ingestAbsoluteAnalyticsSnapshot(db.store,"b",other.analyticsSharing.pendingSnapshot!,now);
  await assert.rejects(ingestAbsoluteAnalyticsSnapshot(db.store,"b",first.analyticsSharing.pendingSnapshot!,later),/conflicts/i);
});
test("recovery instructions must match the exact request and cannot mutate a replaced pending request", async () => {
  const db = memory(); const first = await staged();
  const response = await ingestAbsoluteAnalyticsSnapshot(db.store,"a",first.analyticsSharing.pendingSnapshot!,later);
  const instruction = parseAnalyticsSnapshotRecovery(response,first.analyticsSharing.pendingSnapshot!)!;
  for (const override of [{snapshotId:"snap_"+"f".repeat(64)},{baseRevision:123},{lineageId:"lin_"+"f".repeat(32)},{schemaVersion:"legacy"},{recovery:"advance-revision"},{unexpected:true}]) {
    assert.throws(()=>parseAnalyticsSnapshotRecovery({...instruction,...override},first.analyticsSharing.pendingSnapshot!),/recovery/i);
  }
  assert.throws(()=>applyAnalyticsSnapshotRecovery(updateAnalyticsSharingSettings(first,{pendingSnapshot:null}),first,instruction),/changed|conflict/i);
  assert.throws(()=>applyAnalyticsSnapshotRecovery(first,first,{...instruction,snapshotId:"snap_"+"f".repeat(64)} as AnalyticsSnapshotRecovery),/recovery/i);
});

test("Firebase transport exposes only exact recovery instructions and a rebuilt request succeeds", async () => {
  const { configureFirebaseFeatureProviders } = await import("../src/lib/firebase-feature-runtime");
  const { createFirebaseCallableContracts } = await import("../src/lib/firebase-client");
  const { sendGatedAnalyticsPayload, getConfiguredAnalyticsEndpoint } = await import("../src/lib/recovery-analytics");
  const { parseAggregateAnalyticsSnapshot } = await import("../functions/src/contracts");
  const db = memory(); let corrupt = false;
  const contracts = createFirebaseCallableContracts({call: async (_name,payload) => {
    const response = await ingestAbsoluteAnalyticsSnapshot(db.store,"transport",parseAggregateAnalyticsSnapshot(payload),later);
    return corrupt ? {...response,snapshotId:"snap_"+"f".repeat(64)} : response;
  }});
  const stop = configureFirebaseFeatureProviders(async()=>contracts);
  try {
    const captured = await staged(updateAnalyticsSharingSettings(prepareAnalyticsSnapshotState(createDefaultRecoveryState()),{
      enabled:true,consentVersion:"analytics-consent-v1",userOptedInAt:new Date(Math.min(now,Date.now()-60_000)).toISOString(),dataRetentionDays:14,endpointUrl:getConfiguredAnalyticsEndpoint()
    }));
    corrupt = true;
    const invalid = await sendGatedAnalyticsPayload(captured,captured.analyticsSharing,{day:tomorrow});
    assert.equal(invalid.accepted,false);assert.equal(invalid.snapshotRecovery,undefined);
    corrupt = false;
    const result = await sendGatedAnalyticsPayload(captured,captured.analyticsSharing,{day:tomorrow});
    assert.equal(result.accepted,false);assert.equal(result.snapshotRecovery?.recovery,"new-lineage",JSON.stringify(result));
    const recovered = applyAnalyticsSnapshotRecovery(captured,captured,result.snapshotRecovery!);
    const fresh = await staged(recovered,tomorrow);
    const accepted = await sendGatedAnalyticsPayload(fresh,fresh.analyticsSharing,{day:tomorrow});
    assert.equal(accepted.accepted,true);assert.equal(accepted.snapshotReceipt?.acceptedRevision,1);
    assert.equal(accepted.snapshotRecovery,undefined);
  } finally {stop();}
});
