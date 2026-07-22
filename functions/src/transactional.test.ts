import assert from "node:assert/strict";
import test from "node:test";

import { acquireLease, claimIdempotency, consumeRateLimit, type TransactionalStore } from "./transactional.js";

class MemoryStore implements TransactionalStore {
  readonly values = new Map<string, object>();
  async get<T extends object>(path: string) { return { value: this.values.get(path) as T | undefined }; }
  async set(path: string, value: object) { this.values.set(path, value); }
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
