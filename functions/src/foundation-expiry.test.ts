import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp({ projectId: "freed-foundation-expiry-test", storageBucket: "freed-foundation-expiry-test.firebasestorage.app" });
const { backendReadiness } = createRequire(__filename)("./foundation.js") as typeof import("./foundation.js");
const db = getFirestore();
const UID = "expiryTestUid";
const RATE_PATH = `rate_limits/${UID}_readiness`;
const IDEMPOTENCY_PATH = `idempotency/${UID}_readiness_readiness`;
const BASE_TIME = 1_800_000_000_000;

/** Substitute only Firestore transport; the real callable, adapter, and mutation gate execute. */
function fixture(t: TestContext, now = BASE_TIME) {
  const documents = new Map<string, Record<string, unknown>>();
  const original = db.runTransaction;
  let time = now;
  t.mock.method(Date, "now", () => time);
  db.runTransaction = (async (callback: (transaction: unknown) => Promise<unknown>) => {
    const pending = new Map<string, Record<string, unknown>>();
    const transaction = {
      async get(reference: DocumentReference) {
        assert.equal(pending.size, 0, "Firestore requires all reads before writes");
        const value = documents.get(reference.path);
        return { exists: value !== undefined, data: () => value ? { ...value } : undefined };
      },
      set(reference: DocumentReference, value: Record<string, unknown>) {
        pending.set(reference.path, { ...value });
        return transaction;
      }
    };
    const result = await callback(transaction);
    for (const [path, value] of pending) documents.set(path, value);
    return result;
  }) as typeof db.runTransaction;
  t.after(() => { db.runTransaction = original; });
  return {
    documents,
    advanceTo(value: number) { time = value; },
    call: () => backendReadiness.run({ data: undefined, auth: { uid: UID, token: {} } } as unknown as CallableRequest)
  };
}

test("production foundation adapter persists TTL-compatible rate-limit and idempotency expiry", async t => {
  const f = fixture(t);
  await f.call();
  const rateExpiry = f.documents.get(RATE_PATH)?.expiresAt;
  const idempotencyExpiry = f.documents.get(IDEMPOTENCY_PATH)?.expiresAt;
  assert.ok(rateExpiry instanceof Timestamp, "rate-limit expiry must be a Firestore timestamp");
  assert.ok(idempotencyExpiry instanceof Timestamp, "idempotency expiry must be a Firestore timestamp");
  assert.equal(rateExpiry.toMillis(), 1_800_000_060_000);
  assert.equal(idempotencyExpiry.toMillis(), 1_800_604_800_000);
});

test("production adapter preserves duplicates until timestamp expiry and applies again at its boundary", async t => {
  const f = fixture(t);
  f.documents.set(IDEMPOTENCY_PATH, { createdAt: BASE_TIME - 1000, expiresAt: Timestamp.fromMillis(BASE_TIME + 1000) });
  await f.call();
  assert.equal(f.documents.get(IDEMPOTENCY_PATH)?.createdAt, BASE_TIME - 1000);
  f.advanceTo(BASE_TIME + 1000);
  await f.call();
  assert.equal(f.documents.get(IDEMPOTENCY_PATH)?.createdAt, BASE_TIME + 1000);
  const expiry = f.documents.get(IDEMPOTENCY_PATH)?.expiresAt;
  assert.ok(expiry instanceof Timestamp);
  assert.equal(expiry.toMillis(), 1_800_604_801_000);
});

test("production adapter accepts legacy numeric expiry without weakening rate or deletion fences", async t => {
  const f = fixture(t);
  f.documents.set(IDEMPOTENCY_PATH, { createdAt: BASE_TIME - 1000, expiresAt: BASE_TIME });
  await f.call();
  assert.equal(f.documents.get(IDEMPOTENCY_PATH)?.createdAt, BASE_TIME);
  for (let count = 1; count < 10; count += 1) await f.call();
  await assert.rejects(f.call, (error: unknown) => (error as { code: string }).code === "resource-exhausted");
  assert.equal(f.documents.get(RATE_PATH)?.count, 10);
  f.advanceTo(BASE_TIME + 60_000);
  f.documents.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting", requestedAt: Timestamp.fromMillis(BASE_TIME) });
  const before = [...f.documents.entries()];
  await assert.rejects(f.call, (error: unknown) => (error as { code: string }).code === "failed-precondition");
  assert.deepEqual([...f.documents.entries()], before);
});
