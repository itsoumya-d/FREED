import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireLease,
  claimIdempotency,
  consumeRateLimit,
  runProtectedMutation,
  type TransactionalStore
} from "./transactional.js";

class MemoryStore implements TransactionalStore {
  readonly values = new Map<string, object>();
  async get<T extends object>(path: string) { return { value: this.values.get(path) as T | undefined }; }
  async set(path: string, value: object) { this.values.set(path, value); }
}

class StrictReadBeforeWriteStore extends MemoryStore {
  writesStarted = false;
  override async get<T extends object>(path: string) {
    if (this.writesStarted) throw new Error(`Firestore read after write: ${path}`);
    return super.get<T>(path);
  }
  override async set(path: string, value: object) {
    this.writesStarted = true;
    return super.set(path, value);
  }
}

test("idempotency claims expire and can be reclaimed", async () => {
  const store = new MemoryStore();
  assert.equal(await claimIdempotency(store, "idempotency/u/e", 100, 10), true);
  assert.equal(await claimIdempotency(store, "idempotency/u/e", 105, 10), false);
  assert.equal(await claimIdempotency(store, "idempotency/u/e", 110, 10), true);
});

test("rate limits reset after their TTL window", async () => {
  const store = new MemoryStore();
  assert.equal(await consumeRateLimit(store, "rate/u", 100, 10, 2), true);
  assert.equal(await consumeRateLimit(store, "rate/u", 101, 10, 2), true);
  assert.equal(await consumeRateLimit(store, "rate/u", 102, 10, 2), false);
  assert.equal(await consumeRateLimit(store, "rate/u", 110, 10, 2), true);
});

test("leases reject a second owner until the TTL expires", async () => {
  const store = new MemoryStore();
  assert.deepEqual(await acquireLease(store, "leases/job", "a", 100, 10), { acquired: true, leaseUntil: 110 });
  assert.deepEqual(await acquireLease(store, "leases/job", "b", 105, 10), { acquired: false, leaseUntil: 110 });
  assert.deepEqual(await acquireLease(store, "leases/job", "b", 110, 10), { acquired: true, leaseUntil: 120 });
});

test("protected mutation reads rate-limit and idempotency controls before every write", async () => {
  for (const operation of ["readiness", "analytics", "backup-metadata", "push-token", "deletion"]) {
    const store = new StrictReadBeforeWriteStore();
    let businessWriteCount = 0;
    const result = await runProtectedMutation(store, {
      rateLimitPath: `rate_limits/user_${operation}`,
      idempotencyPath: `idempotency/user_${operation}_event`,
      now: 100,
      windowMs: 60_000,
      limit: 10,
      idempotencyTtlMs: 1_000
    }, async () => { businessWriteCount += 1; });
    assert.equal(result, "applied");
    assert.equal(businessWriteCount, 1);
  }
});

test("an account deletion tombstone blocks control and business writes", async () => {
  const store = new MemoryStore();
  store.values.set("deletion_tombstones/user", { status: "deleting" });
  let businessWrites = 0;
  const options = {
    rateLimitPath: "rate_limits/user_operation",
    idempotencyPath: "idempotency/user_operation_event",
    accountTombstonePath: "deletion_tombstones/user",
    now: 100,
    windowMs: 60_000,
    limit: 10,
    idempotencyTtlMs: 1_000
  } as Parameters<typeof runProtectedMutation>[1];
  const result = await runProtectedMutation(store, options, async () => { businessWrites += 1; });
  assert.equal(result as string, "account-deleting");
  assert.equal(businessWrites, 0);
  assert.equal(store.values.has("rate_limits/user_operation"), false);
  assert.equal(store.values.has("idempotency/user_operation_event"), false);
});
