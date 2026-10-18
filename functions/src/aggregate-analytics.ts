import { createHash } from "node:crypto";
import { ANALYTICS_SNAPSHOT_SCHEMA_VERSION, COLLECTIONS, type AggregateAnalyticsSnapshotInput } from "./contracts.js";
import { consumeRateLimit, runProtectedMutation, type TransactionalStore } from "./transactional.js";

const DAY_MS = 86_400_000;
export const ANALYTICS_RETENTION_MS = 14 * DAY_MS;
type SnapshotBaseline = { lineageId: string; revision: number; snapshotId: string; expiresAt: number };
type SnapshotReceipt = { schemaVersion: string; lineageId: string; snapshotId: string; acceptedRevision: number; expiresAt: number };
type DayCounts = { lineageId: string; checkIns: number; completedChallenges: number; expiresAt: number };
export type AggregateSnapshotRecovery = { ok: false; schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION; lineageId: string; baseRevision: number; snapshotId: string; recovery: "refresh-window" | "new-lineage"; acceptedRevision?: never; duplicate?: never };
export type AggregateSnapshotResult = AggregateSnapshotRecovery | { ok: true; schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION; lineageId: string; snapshotId: string; acceptedRevision: number; duplicate: boolean };

export function aggregateSnapshotId(input: Omit<AggregateAnalyticsSnapshotInput, "snapshotId"> | AggregateAnalyticsSnapshotInput): string {
  const canonical = { schemaVersion: input.schemaVersion, lineageId: input.lineageId, baseRevision: input.baseRevision,
    days: input.days, consentVersion: input.consentVersion, userOptedInAt: input.userOptedInAt, dataRetentionDays: input.dataRetentionDays };
  return `snap_${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

/** All reads precede writes. UID is supplied by Auth, never by the client. */
export async function ingestAbsoluteAnalyticsSnapshot(store: TransactionalStore, uid: string, input: AggregateAnalyticsSnapshotInput, now: number): Promise<AggregateSnapshotResult> {
  if (aggregateSnapshotId(input) !== input.snapshotId) throw new Error("Aggregate snapshot identity does not match its counters.");
  if (Date.parse(input.userOptedInAt) > now + 5 * 60_000) throw new Error("Analytics consent time is invalid.");
  const baselinePath = `${COLLECTIONS.aggregateAnalytics}/${uid}_snapshot`;
  const receiptPath = `${COLLECTIONS.idempotency}/${uid}_analytics_${input.snapshotId}`;
  const dayPaths = input.days.map(day => `${COLLECTIONS.aggregateAnalytics}/${uid}_${day.day}`);
  const [baseline, receipt, ...storedDays] = await Promise.all([
    store.get<SnapshotBaseline>(baselinePath), store.get<SnapshotReceipt>(receiptPath),
    ...dayPaths.map(path => store.get<DayCounts>(path))
  ]);
  const previousReceipt = receipt.value as SnapshotReceipt | undefined;
  const duplicate = previousReceipt && previousReceipt.expiresAt > now;
  if (duplicate) {
    if (previousReceipt.schemaVersion !== input.schemaVersion || previousReceipt.snapshotId !== input.snapshotId ||
        previousReceipt.lineageId !== input.lineageId || previousReceipt.acceptedRevision !== input.baseRevision + 1) throw new Error("Aggregate snapshot receipt is incompatible.");
  } else {
    const saved = baseline.value as SnapshotBaseline | undefined;
    const current = saved && saved.expiresAt > now ? saved : undefined;
    const today = new Date(now).toISOString().slice(0, 10);
    const staleWindow = input.days[input.days.length - 1].day < today;
    // A missing baseline only accepts a genuinely new, current-window revision zero.
    // Recovery authorizes rebuilding a request, never treating old counters as a newer revision.
    if (!current && (input.baseRevision !== 0 || staleWindow)) {
      return recoveryInstruction(store, uid, input, now, "new-lineage");
    }
    if ((current && current.lineageId !== input.lineageId) || (current?.revision ?? 0) !== input.baseRevision) throw new Error("Analytics snapshot lineage or baseline conflicts. Choose the recovery backup to continue.");
    if (current && staleWindow) return recoveryInstruction(store, uid, input, now, "refresh-window");
    if (input.days[input.days.length - 1].day !== today) throw new Error("Aggregate snapshot must end on today's UTC day.");
    for (const [index, entry] of storedDays.entries()) {
      const prior = entry.value as DayCounts | undefined;
      if (!prior || prior.expiresAt <= now) continue;
      if (prior.lineageId !== input.lineageId || input.days[index].checkIns < prior.checkIns || input.days[index].completedChallenges < prior.completedChallenges) throw new Error("Aggregate snapshot cannot decrease acknowledged day counts.");
    }
  }
  const acceptedRevision = input.baseRevision + 1;
  const result = await runProtectedMutation(store, {
    rateLimitPath: `${COLLECTIONS.rateLimits}/${uid}_analytics`, idempotencyPath: receiptPath,
    accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${uid}`, now, windowMs: 60_000, limit: 30,
    idempotencyTtlMs: ANALYTICS_RETENTION_MS
  }, async () => {
    await store.set(baselinePath, { uid, schemaVersion: input.schemaVersion, lineageId: input.lineageId,
      revision: acceptedRevision, snapshotId: input.snapshotId, updatedAt: now, expiresAt: now + ANALYTICS_RETENTION_MS });
    for (const [index, day] of input.days.entries()) {
      await store.set(dayPaths[index], { uid, schemaVersion: input.schemaVersion, ...day, lineageId: input.lineageId, updatedAt: now,
        expiresAt: Date.parse(`${day.day}T00:00:00.000Z`) + ANALYTICS_RETENTION_MS });
    }
    await store.set(receiptPath, { schemaVersion: input.schemaVersion, lineageId: input.lineageId, snapshotId: input.snapshotId,
      acceptedRevision, createdAt: now, expiresAt: now + ANALYTICS_RETENTION_MS });
  });
  if (result === "rate-limited") throw new Error("Analytics rate limit reached. Try again shortly.");
  if (result === "account-deleting") throw new Error("This account is being deleted.");
  return { ok: true, schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: input.lineageId,
    snapshotId: input.snapshotId, acceptedRevision, duplicate: result === "duplicate" };
}

/** Recovery is rate limited and deletion fenced, but never records an acceptance receipt. */
async function recoveryInstruction(store: TransactionalStore, uid: string, input: AggregateAnalyticsSnapshotInput, now: number,
  recovery: AggregateSnapshotRecovery["recovery"]): Promise<AggregateSnapshotRecovery> {
  if ((await store.get(`${COLLECTIONS.deletionTombstones}/${uid}`)).value) throw new Error("This account is being deleted.");
  if (!await consumeRateLimit(store, `${COLLECTIONS.rateLimits}/${uid}_analytics`, now, 60_000, 30)) {
    throw new Error("Analytics rate limit reached. Try again shortly.");
  }
  return { ok: false, schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: input.lineageId,
    baseRevision: input.baseRevision, snapshotId: input.snapshotId, recovery };
}
