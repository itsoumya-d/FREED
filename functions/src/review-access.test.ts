import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";

if (!getApps().length) initializeApp({ projectId: "freed-review-access-unit", storageBucket: "freed-review-access-unit.firebasestorage.app" });
const foundation = createRequire(__filename)("./foundation.js") as Record<string, any>;
const db = getFirestore();
const UID = "reviewOwner";
const PATH = `backend_jobs/${UID}_review-access-v1`;
const RATE = `rate_limits/${UID}_review-access-read`;
const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const none = (uid = UID) => ({ reviewAccessVersion: 1, ownerUid: uid, access: "none", expiresAt: null, capabilities: [] });
const record = (createdAt = NOW, expiresAt = NOW + DAY) => ({ uid: UID, kind: "review-access-v1", status: "active", createdAt: Timestamp.fromMillis(createdAt), expiresAt: Timestamp.fromMillis(expiresAt) });
function isCode(code: string) { return (error: unknown) => (error as { code: string }).code === code; }

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
        assert.equal(staged.size, 0, "All transaction reads must precede writes");
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
    documents, writes: () => writes, transactions: () => transactions,
    advanceTo(value: number) { now = value; },
    get: (data?: unknown, uid: string | undefined = UID, provider: string | undefined = "password") => {
      assert.equal(typeof foundation.getReviewAccess?.run, "function", "Bounded review access callable must exist");
      return foundation.getReviewAccess.run({ data, ...(uid ? { auth: { uid, token: { firebase: { sign_in_provider: provider } } } } : {}) });
    }
  };
}

test("review access reads return exact none DTO for the verified owner without creating review authority", async t => {
  const f = fixture(t);
  assert.deepEqual(await f.get(), none());
  assert.deepEqual(await f.get(null), none());
  assert.equal(f.documents.has(PATH), false);
  assert.equal(f.documents.get(RATE)?.count, 2);
  assert.ok(f.documents.get(RATE)?.expiresAt instanceof Timestamp);
  assert.ok([...f.documents.keys()].every(path => path.startsWith("rate_limits/")));
});

test("review access requires connected Auth and rejects every client payload before database access", async t => {
  const f = fixture(t);
  await assert.rejects(() => f.get(undefined, ""), isCode("unauthenticated"));
  for (const provider of ["anonymous", "custom", "unknown", ""]) await assert.rejects(() => f.get(null, UID, provider), isCode("failed-precondition"));
  assert.equal(typeof foundation.getReviewAccess?.run, "function");
  await assert.rejects(() => foundation.getReviewAccess.run({ data: null, auth: { uid: UID, token: {} } }), isCode("failed-precondition"));
  for (const data of [{}, [], "review", false, { ownerUid: "otherOwner" }, { uid: "otherOwner" }, { reviewAccessVersion: 1 },
    { expiresAt: new Date(NOW + DAY).toISOString() }, { capabilities: ["ad-free"] }, { answers: ["private answer"] }]) {
    await assert.rejects(() => f.get(data), isCode("invalid-argument"));
  }
  assert.equal(f.transactions(), 0);
  for (const provider of ["password", "google.com", "apple.com"]) assert.deepEqual(await f.get(null, UID, provider), none());
});

test("active review metadata derives only fixed review capabilities and never mutates metadata or purchase authority", async t => {
  const f = fixture(t);
  const marker = record();
  const purchase = { uid: UID, productId: "freed_premium_yearly", status: "inactive" };
  f.documents.set(PATH, marker);
  f.documents.set("purchase_claims/existingClaim", purchase);
  f.documents.set("purchase_account_fences/existingFence", { uid: UID, status: "inactive" });
  assert.deepEqual(await f.get(), { reviewAccessVersion: 1, ownerUid: UID, access: "review", expiresAt: new Date(NOW + DAY).toISOString(), capabilities: ["ad-free", "premium-features"] });
  assert.deepEqual(f.documents.get(PATH), marker);
  assert.deepEqual(f.documents.get("purchase_claims/existingClaim"), purchase);
  assert.deepEqual(f.documents.get("purchase_account_fences/existingFence"), { uid: UID, status: "inactive" });
  assert.equal(f.writes(), 1, "The read may mutate only its rate counter");
});

test("review lifetime accepts exactly fourteen days and rejects one millisecond more", async t => {
  const f = fixture(t);
  f.documents.set(PATH, record(NOW, NOW + 14 * DAY));
  assert.equal((await f.get()).access, "review");
  f.documents.set(PATH, record(NOW, NOW + 14 * DAY + 1));
  assert.deepEqual(await f.get(), none());
});

test("review expiry is exclusive and no read renews or extends the original marker", async t => {
  const f = fixture(t);
  const marker = record(NOW, NOW + 14 * DAY);
  f.documents.set(PATH, marker);
  f.advanceTo(NOW + 14 * DAY - 1);
  assert.equal((await f.get()).access, "review");
  f.advanceTo(NOW + 14 * DAY);
  assert.deepEqual(await f.get(), none());
  f.advanceTo(NOW + 15 * DAY);
  assert.deepEqual(await f.get(), none());
  assert.deepEqual(f.documents.get(PATH), marker);
});

test("revoked, future-created, wrong-owner, wrong-kind and malformed records fail closed without echoing fields", async t => {
  const f = fixture(t);
  const valid = record();
  const malformed = [
    { ...valid, status: "revoked" }, { ...valid, status: "purchased" }, { ...valid, uid: "otherOwner" },
    { ...valid, kind: "review-access-v2" }, { ...valid, createdAt: Timestamp.fromMillis(NOW + 1) },
    { ...valid, expiresAt: Timestamp.fromMillis(NOW) }, { ...valid, expiresAt: Timestamp.fromMillis(NOW - 1) },
    { ...valid, createdAt: Timestamp.fromMillis(NOW - 15 * DAY) }, { ...valid, createdAt: NOW },
    { ...valid, expiresAt: NOW + DAY }, { ...valid, createdAt: "private answer" }, { ...valid, expiresAt: new Date(NOW + DAY).toISOString() },
    { ...valid, expiresAt: null }, { ...valid, createdAt: null }, { ...valid, createdAt: undefined }, { ...valid, expiresAt: undefined },
    { ...valid, reviewAccessVersion: 1 }, { ...valid, reviewAccessVersion: 2 }, { ...valid, capabilities: ["ad-free", "premium-features"] },
    { ...valid, paid: true }, { ...valid, receipt: "private receipt" }, { ...valid, ownerUid: UID }
  ];
  for (const marker of malformed) {
    f.documents.set(PATH, marker);
    f.documents.delete(RATE);
    assert.deepEqual(await f.get(), none());
    assert.deepEqual(f.documents.get(PATH), marker, "Fail-closed reads cannot repair or renew records");
  }
});

test("a different account's valid review marker cannot grant this verified owner access", async t => {
  const f = fixture(t);
  const other = { ...record(), uid: "otherOwner" };
  f.documents.set("backend_jobs/otherOwner_review-access-v1", other);
  assert.deepEqual(await f.get(), none());
  assert.deepEqual(await f.get(null, "otherOwner"), { reviewAccessVersion: 1, ownerUid: "otherOwner", access: "review", expiresAt: new Date(NOW + DAY).toISOString(), capabilities: ["ad-free", "premium-features"] });
  assert.equal(f.documents.has(PATH), false);
});

test("review getter is bounded to ten requests per minute including absent and malformed markers", async t => {
  const f = fixture(t);
  for (let request = 0; request < 10; request += 1) assert.deepEqual(await f.get(), none());
  const before = f.writes();
  await assert.rejects(() => f.get(), isCode("resource-exhausted"));
  assert.equal(f.writes(), before);
  assert.equal(f.documents.get(RATE)?.count, 10);
  f.advanceTo(NOW + 60_000);
  f.documents.set(PATH, { ...record(), capabilities: ["premium-features"] });
  assert.deepEqual(await f.get(), none());
  assert.equal(f.documents.get(RATE)?.count, 1);
});

test("deletion and cooldown fences block review reads before any rate or authority mutation", async t => {
  const f = fixture(t);
  f.documents.set(PATH, record());
  for (const status of ["deleting", "cooldown"]) {
    f.documents.set(`deletion_tombstones/${UID}`, { uid: UID, status });
    await assert.rejects(() => f.get(), isCode("failed-precondition"));
    assert.equal(f.writes(), 0);
    assert.equal(f.documents.has(RATE), false);
  }
});

test("database failures expose only fixed public review errors", async t => {
  const f = fixture(t);
  assert.equal(typeof foundation.getReviewAccess?.run, "function");
  db.runTransaction = (async () => { throw new Error("private database detail"); }) as typeof db.runTransaction;
  await assert.rejects(() => f.get(), (error: unknown) => {
    const e = error as { code: string; message: string };
    assert.equal(e.code, "unavailable");
    assert.equal(e.message, "Review access is temporarily unavailable.");
    return true;
  });
});
