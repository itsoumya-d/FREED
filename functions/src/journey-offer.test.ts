import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { validateServerDocument } from "./contracts.js";
import { deleteFirebaseAccountData } from "./core-data.js";

if (!getApps().length) initializeApp({ projectId: "freed-journey-offer-unit", storageBucket: "freed-journey-offer-unit.firebasestorage.app" });
const foundation = createRequire(__filename)("./foundation.js") as Record<string, any>;
const db = getFirestore();
const UID = "journeyOwner";
const PATH = `backend_jobs/${UID}_journey-offer-v1`;
const EVENT = `journey_${"a".repeat(32)}`;
const NOW = 1_800_000_000_000;

function fixture(t: TestContext) {
  const documents = new Map<string, Record<string, unknown>>();
  let writes = 0;
  let transactions = 0;
  let now = NOW;
  const original = db.runTransaction;
  t.mock.method(Date, "now", () => now);
  db.runTransaction = (async (callback: (transaction: unknown) => Promise<unknown>) => {
    transactions += 1;
    const staged = new Map<string, Record<string, unknown>>();
    const transaction = {
      async get(ref: DocumentReference) {
        assert.equal(staged.size, 0, "All reads must precede writes");
        const data = documents.get(ref.path);
        return { exists: data !== undefined, data: () => data ? { ...data } : undefined };
      },
      set(ref: DocumentReference, data: Record<string, unknown>) { staged.set(ref.path, { ...data }); return transaction; }
    };
    const result = await callback(transaction);
    for (const [path, data] of staged) { documents.set(path, data); writes += 1; }
    return result;
  }) as typeof db.runTransaction;
  t.after(() => { db.runTransaction = original; });
  return {
    documents,
    writes: () => writes,
    transactions: () => transactions,
    advanceTo(value: number) { now = value; },
    get: (data?: unknown, uid: string | undefined = UID, provider: string | undefined = "password") => {
      assert.equal(typeof foundation.getJourneyOfferState?.run, "function", "Account-scoped offer state callable must exist");
      return foundation.getJourneyOfferState.run({ data, ...(uid ? { auth: { uid, token: { firebase: { sign_in_provider: provider } } } } : {}) });
    },
    ack: (data: unknown, uid: string | undefined = UID, provider: string | undefined = "password") => {
      assert.equal(typeof foundation.acknowledgeJourneyOffer?.run, "function", "Account-scoped acknowledgement callable must exist");
      return foundation.acknowledgeJourneyOffer.run({ data, ...(uid ? { auth: { uid, token: { firebase: { sign_in_provider: provider } } } } : {}) });
    }
  };
}

function isCode(code: string) { return (error: unknown) => (error as { code: string }).code === code; }

test("journey offer reads accept no selection payload and require server authentication before access", async t => {
  const f = fixture(t);
  assert.deepEqual(await f.get(), { offerVersion: 1, acknowledged: false });
  assert.deepEqual(await f.get(null), { offerVersion: 1, acknowledged: false });
  assert.equal(f.documents.has(PATH), false, "Reads never acknowledge the offer");
  assert.equal(f.documents.get(`rate_limits/${UID}_journey-offer-read`)?.count, 2);
  const transactions = f.transactions();
  for (const data of [{}, { uid: "otherOwner" }, { offerVersion: 1 }, { answers: ["private answer"] }]) {
    await assert.rejects(() => f.get(data), isCode("invalid-argument"));
  }
  await assert.rejects(() => f.get(undefined, ""), isCode("unauthenticated"));
  assert.equal(f.transactions(), transactions);
});

test("offer endpoints require a connected provider and no-payload reads are bounded", async t => {
  const f = fixture(t);
  const input = { offerVersion: 1, decision: "free", eventId: EVENT };
  for (const provider of ["anonymous", "custom", "unknown", ""]) {
    await assert.rejects(() => f.get(null, UID, provider), isCode("failed-precondition"));
    await assert.rejects(() => f.ack(input, UID, provider), isCode("failed-precondition"));
  }
  await assert.rejects(() => foundation.getJourneyOfferState.run({ data: null, auth: { uid: UID, token: {} } }), isCode("failed-precondition"));
  await assert.rejects(() => foundation.acknowledgeJourneyOffer.run({ data: input, auth: { uid: UID, token: {} } }), isCode("failed-precondition"));
  assert.equal(f.transactions(), 0);
  for (let count = 0; count < 10; count += 1) await f.get();
  await assert.rejects(() => f.get(), isCode("resource-exhausted"));
  assert.equal(f.documents.has(PATH), false);
  const rate = f.documents.get(`rate_limits/${UID}_journey-offer-read`)!;
  assert.ok(rate.expiresAt instanceof Timestamp);
  assert.equal(rate.count, 10);
  f.advanceTo(NOW + 60_000);
  assert.deepEqual(await f.get(), { offerVersion: 1, acknowledged: false });
  assert.equal(f.documents.get(`rate_limits/${UID}_journey-offer-read`)?.count, 1);
});

test("acknowledgement rejects unknown fields, unsupported versions, decisions, and nonopaque event IDs", async t => {
  const f = fixture(t);
  const valid = { offerVersion: 1, decision: "free", eventId: EVENT };
  for (const data of [undefined, null, [], {}, { ...valid, offerVersion: 2 }, { ...valid, offerVersion: "1" },
    { ...valid, decision: "premium" }, { ...valid, decision: " free" }, { ...valid, eventId: "private_answer" },
    { ...valid, eventId: `journey_${"A".repeat(32)}` }, { ...valid, eventId: `journey_${"a".repeat(31)}` },
    { ...valid, eventId: `journey_${"a".repeat(32)} extra` }, { ...valid, uid: "otherOwner" },
    { ...valid, ownerId: "otherOwner" }, { ...valid, answers: ["private answer"] }, { ...valid, premium: true }]) {
    await assert.rejects(() => f.ack(data), isCode("invalid-argument"));
  }
  await assert.rejects(() => f.ack(valid, ""), isCode("unauthenticated"));
  assert.equal(f.transactions(), 0);
  assert.equal(f.writes(), 0);
});

test("first acknowledgement is durable for the verified UID/version and duplicates never rewrite it", async t => {
  const f = fixture(t);
  assert.deepEqual(await f.ack({ offerVersion: 1, decision: "free", eventId: EVENT }), { offerVersion: 1, acknowledged: true });
  const stored = f.documents.get(PATH)!;
  assert.deepEqual(Object.keys(stored).sort(), ["createdAt", "kind", "status", "uid"]);
  assert.equal(stored.uid, UID);
  assert.equal(stored.kind, "journey-offer-v1");
  assert.equal(stored.status, "free");
  assert.ok(stored.createdAt instanceof Timestamp);
  assert.equal(stored.createdAt.toMillis(), NOW);
  const before = f.writes();
  f.advanceTo(NOW + 400 * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.deepEqual(await f.ack({ offerVersion: 1, decision: "purchased", eventId: attempt % 2 ? EVENT : `journey_${"b".repeat(32)}` }), { offerVersion: 1, acknowledged: true });
  }
  assert.equal(f.writes(), before + 8, "Retries update only their bounded rate control");
  assert.deepEqual(f.documents.get(PATH), stored);
  assert.deepEqual(await f.get(), { offerVersion: 1, acknowledged: true });
});

test("acknowledgement retries are bounded without rewriting the first marker and recover next window", async t => {
  const f = fixture(t);
  const input = { offerVersion: 1, decision: "free", eventId: EVENT };
  await f.ack(input);
  const first = f.documents.get(PATH);
  for (let retry = 0; retry < 9; retry += 1) await f.ack({ ...input, decision: "purchased" });
  const before = f.writes();
  await assert.rejects(() => f.ack(input), isCode("resource-exhausted"));
  assert.equal(f.writes(), before);
  assert.deepEqual(f.documents.get(PATH), first);
  assert.equal(f.documents.get(`rate_limits/${UID}_journey-offer`)?.count, 10);
  f.advanceTo(NOW + 60_000);
  assert.deepEqual(await f.ack(input), { offerVersion: 1, acknowledged: true });
  assert.deepEqual(f.documents.get(PATH), first);
  assert.equal(f.documents.get(`rate_limits/${UID}_journey-offer`)?.count, 1);
});

test("purchased is only an offer outcome label and cannot change premium or other account data", async t => {
  const f = fixture(t);
  const purchase = { uid: UID, status: "inactive", productId: "freed_premium_yearly" };
  const counters = { uid: UID, checkIns: 2 };
  f.documents.set("purchase_claims/existingClaim", purchase);
  f.documents.set("aggregate_analytics/existingCounters", counters);
  await f.ack({ offerVersion: 1, decision: "purchased", eventId: EVENT });
  assert.deepEqual(f.documents.get("purchase_claims/existingClaim"), purchase);
  assert.deepEqual(f.documents.get("aggregate_analytics/existingCounters"), counters);
  assert.equal(f.documents.get(PATH)?.status, "purchased");
  assert.ok([...f.documents.keys()].filter(path => !path.startsWith("purchase_claims/") && !path.startsWith("aggregate_analytics/"))
    .every(path => /^(?:backend_jobs|rate_limits|idempotency)\//.test(path)));
});

test("another account's acknowledgement never suppresses this account's offer", async t => {
  const f = fixture(t);
  const foreign = { uid: "otherOwner", kind: "journey-offer-v1", status: "free", createdAt: Timestamp.fromMillis(NOW) };
  f.documents.set("backend_jobs/otherOwner_journey-offer-v1", foreign);
  assert.deepEqual(await f.get(), { offerVersion: 1, acknowledged: false });
  await f.ack({ offerVersion: 1, decision: "free", eventId: EVENT });
  assert.deepEqual(f.documents.get("backend_jobs/otherOwner_journey-offer-v1"), foreign);
  assert.equal(f.documents.get(PATH)?.uid, UID);
});

test("deletion fences block both new and duplicate acknowledgements and state reads", async t => {
  const f = fixture(t);
  for (const status of ["deleting", "cooldown"]) {
    f.documents.set(`deletion_tombstones/${UID}`, { uid: UID, status });
    for (const existing of [false, true]) {
      if (existing) f.documents.set(PATH, { uid: UID, kind: "journey-offer-v1", status: "free", createdAt: Timestamp.fromMillis(NOW) });
      else f.documents.delete(PATH);
      const before = f.writes();
      await assert.rejects(() => f.get(), isCode("failed-precondition"));
      await assert.rejects(() => f.ack({ offerVersion: 1, decision: "free", eventId: EVENT }), isCode("failed-precondition"));
      assert.equal(f.writes(), before);
    }
  }
});

test("first acknowledgement honors existing rate limits and malformed durable state fails closed", async t => {
  const f = fixture(t);
  f.documents.set(`rate_limits/${UID}_journey-offer`, { count: 10, windowStartedAt: NOW, expiresAt: Timestamp.fromMillis(NOW + 60_000) });
  await assert.rejects(() => f.ack({ offerVersion: 1, decision: "free", eventId: EVENT }), isCode("resource-exhausted"));
  assert.equal(f.documents.has(PATH), false);
  f.documents.clear();
  f.documents.set(PATH, { uid: "otherOwner", kind: "journey-offer-v1", status: "free", createdAt: Timestamp.fromMillis(NOW) });
  await assert.rejects(() => f.get(), isCode("unavailable"));
  await assert.rejects(() => f.ack({ offerVersion: 1, decision: "free", eventId: EVENT }), isCode("unavailable"));
  f.documents.set(PATH, { uid: UID, kind: "actionable-job", status: "free", createdAt: Timestamp.fromMillis(NOW) });
  await assert.rejects(() => f.get(), isCode("unavailable"));
  f.documents.set(PATH, { uid: UID, kind: "journey-offer-v1", status: "free", createdAt: Timestamp.fromMillis(NOW), expiresAt: Timestamp.fromMillis(NOW) });
  await assert.rejects(() => f.get(), isCode("unavailable"));
  assert.equal(f.writes(), 0);
});

test("offer metadata rejects authority/content fields and account deletion includes its collection", async () => {
  assert.doesNotThrow(() => validateServerDocument("backend_jobs", { uid: UID, kind: "journey-offer-v1", status: "free", createdAt: Timestamp.fromMillis(NOW) }));
  for (const field of ["premium", "entitlement", "unlock", "recovery", "health", "answers", "ownerId", "eventId"]) {
    assert.throws(() => validateServerDocument("backend_jobs", { uid: UID, offerVersion: 1, decision: "free", acknowledgedAt: Timestamp.fromMillis(NOW), [field]: true }));
  }
  const deleted: string[] = [];
  await deleteFirebaseAccountData(UID, { deleteBackupObjects: async () => undefined,
    deleteRecords: async (scope, uid) => { assert.equal(uid, UID); deleted.push(scope); }, deleteAuthIdentity: async () => undefined });
  assert.ok(deleted.includes("backend_jobs"), "The existing deployed deletion scope already owns offer metadata cleanup");
});
