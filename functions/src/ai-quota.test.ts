import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";

import { createAiService, type AiFeatureGate } from "./ai.js";
import { authorizeAiUsage } from "./ai-quota.js";
import { type TransactionalStore } from "./transactional.js";

const UID = "quota-user";
const NOW = Date.parse("2026-10-01T10:30:00.000Z");
const DAY_START = Date.parse("2026-10-01T00:00:00.000Z");
const MINUTE_PATH = `rate_limits/${UID}_ai-clara`;
const DAILY_PATH = `rate_limits/${UID}_ai-clara-daily`;
const TOMBSTONE_PATH = `deletion_tombstones/${UID}`;

/** Models atomic transaction commits and rejects Admin SDK read-after-write mistakes. */
class MemoryTransactions {
  readonly documents = new Map<string, object>();
  private tail: Promise<void> = Promise.resolve();

  run<Result>(operation: (store: TransactionalStore) => Promise<Result>): Promise<Result> {
    const pending = this.tail.then(async () => {
      const writes = new Map<string, object>();
      const store: TransactionalStore = {
        get: async <T extends object>(path: string) => {
          assert.equal(writes.size, 0, `Firestore reads must precede writes: ${path}`);
          return { value: this.documents.get(path) as T | undefined };
        },
        set: async (path, value) => { writes.set(path, value); }
      };
      const result = await operation(store);
      for (const [path, value] of writes) this.documents.set(path, value);
      return result;
    });
    this.tail = pending.then(() => undefined, () => undefined);
    return pending;
  }
}

function quotaHarness(options: { claims?: readonly unknown[]; membershipUnavailable?: boolean; gate?: AiFeatureGate } = {}) {
  const transactions = new MemoryTransactions();
  let clock = NOW;
  let providerCalls = 0;
  const service = createAiService({
    now: () => clock,
    getFeatureGate: async () => options.gate ?? "enabled",
    getApiKey: () => "server-secret-must-not-appear",
    persistEvent: async () => undefined,
    authorize: async (input) => transactions.run((store) => {
      return authorizeAiUsage(store, {
        uid: input.uid,
        route: input.route,
        rateLimitPath: `rate_limits/${input.uid}_ai-${input.route}`,
        idempotencyPath: `idempotency/${input.uid}_ai-${input.route}_${input.clientEventId}`,
        accountTombstonePath: `deletion_tombstones/${input.uid}`,
        dailyUsagePath: `rate_limits/${input.uid}_ai-clara-daily`,
        now: clock,
        windowMs: 60_000,
        limit: input.perMinute,
        idempotencyTtlMs: 7 * 86_400_000,
        consumeDailyQuota: input.consumeDailyQuota
      }, async (uid) => {
        assert.equal(uid, UID);
        if (options.membershipUnavailable) throw new Error("private-membership-error");
        return options.claims ?? [];
      });
    }),
    fetch: async (_url, init) => {
      providerCalls += 1;
      assert.match(init.body as string, /"store":false/);
      return Response.json({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: '{"replyId":"breathing-pause"}' }] }]
      });
    }
  });
  const request = (index: number, premium = false) => service.generateClara(UID, {
    clientEventId: `evt_quota_${index}`,
    input: "private-input-must-not-appear",
    context: { streakDays: 0, attemptsToday: 0, premium, slipsThisWeek: 0, slipWindow: null, slipTrigger: null }
  });
  return { service, request, transactions, providerCalls: () => providerCalls, setNow: (value: number) => { clock = value; } };
}

test("Free membership permits exactly three remote CLARA provider requests per UTC day", async () => {
  const harness = quotaHarness();
  for (let index = 0; index < 3; index += 1) assert.equal((await harness.request(index)).provider, "remote");
  const exhausted = await harness.request(3);
  assert.deepEqual(exhausted, {
    text: "Put the phone down, take three slow breaths, and move to a different room. A small change in body and place can interrupt the automatic loop.",
    provider: "fallback", status: "fallback", reason: "provider-unavailable"
  });
  assert.equal(harness.providerCalls(), 3);
  assert.deepEqual(harness.transactions.documents.get(DAILY_PATH), {
    count: 3, windowStartedAt: DAY_START, expiresAt: DAY_START + 86_400_000
  });
  assert.doesNotMatch(JSON.stringify(exhausted), /private-input|server-secret/);
});

test("verified unexpired purchase claims permit exactly twenty remote CLARA provider requests", async () => {
  const harness = quotaHarness({ claims: [{
    uid: UID, status: "verified", productId: "freed_premium_monthly",
    entitlementExpiresAt: Timestamp.fromMillis(NOW + 86_400_000)
  }] });
  for (let index = 0; index < 20; index += 1) assert.equal((await harness.request(index)).provider, "remote");
  assert.equal((await harness.request(20)).provider, "fallback");
  assert.equal(harness.providerCalls(), 20);
  assert.equal((harness.transactions.documents.get(DAILY_PATH) as { count: number }).count, 20);
});

test("legacy verified lifetime membership still receives the Premium allowance", async () => {
  const harness = quotaHarness({ claims: [{ uid: UID, status: "verified", productId: "freed_premium_lifetime" }] });
  for (let index = 0; index < 20; index += 1) assert.equal((await harness.request(index)).provider, "remote");
  assert.equal((await harness.request(20)).provider, "fallback");
  assert.equal(harness.providerCalls(), 20);
});

test("forged client Premium context cannot raise the Free remote allowance", async () => {
  const harness = quotaHarness();
  for (let index = 0; index < 4; index += 1) await harness.request(index, true);
  assert.equal(harness.providerCalls(), 3);
});

test("expired, revoked, foreign, missing-expiry, and non-Timestamp claims grant no Premium allowance", async () => {
  for (const claim of [
    { uid: UID, status: "verified", productId: "freed_premium_yearly", entitlementExpiresAt: Timestamp.fromMillis(NOW) },
    { uid: UID, status: "revoked", productId: "freed_premium_yearly", entitlementExpiresAt: Timestamp.fromMillis(NOW + 86_400_000) },
    { uid: "other-user", status: "verified", productId: "freed_premium_lifetime" },
    { uid: UID, status: "verified", productId: "freed_premium_yearly" },
    { uid: UID, status: "verified", productId: "freed_premium_yearly", entitlementExpiresAt: NOW + 86_400_000 },
    { uid: UID, status: "verified", productId: "freed_premium_yearly", entitlementExpiresAt: new Date(NOW + 86_400_000).toISOString() }
  ]) {
    const harness = quotaHarness({ claims: [claim] });
    for (let index = 0; index < 4; index += 1) await harness.request(index, true);
    assert.equal(harness.providerCalls(), 3);
  }
});

test("a failed membership lookup fails closed to the Free allowance", async () => {
  const harness = quotaHarness({ membershipUnavailable: true });
  for (let index = 0; index < 4; index += 1) await harness.request(index, true);
  assert.equal(harness.providerCalls(), 3);
});

test("the daily allowance resets at UTC midnight rather than twenty-four hours after the first request", async () => {
  const harness = quotaHarness();
  harness.setNow(DAY_START + 86_400_000 - 1);
  for (let index = 0; index < 4; index += 1) await harness.request(index);
  assert.equal(harness.providerCalls(), 3);
  harness.setNow(DAY_START + 86_400_000);
  for (let index = 4; index < 8; index += 1) await harness.request(index);
  assert.equal(harness.providerCalls(), 6);
  assert.deepEqual(harness.transactions.documents.get(DAILY_PATH), {
    count: 3, windowStartedAt: DAY_START + 86_400_000, expiresAt: DAY_START + 2 * 86_400_000
  });
});

test("idempotent duplicates do not call the provider or consume daily CLARA usage", async () => {
  const harness = quotaHarness();
  assert.equal((await harness.request(0)).provider, "remote");
  const duplicate = await harness.request(0);
  assert.equal(duplicate.provider, "fallback");
  if (duplicate.provider === "fallback") assert.equal(duplicate.reason, "duplicate-request");
  assert.equal((harness.transactions.documents.get(DAILY_PATH) as { count: number }).count, 1);
  await harness.request(1);
  await harness.request(2);
  await harness.request(3);
  assert.equal(harness.providerCalls(), 3);
});

test("duplicate requests remain duplicate after midnight without consuming the new day", async () => {
  const harness = quotaHarness();
  await harness.request(0);
  harness.setNow(DAY_START + 86_400_000);
  const duplicate = await harness.request(0);
  assert.equal(duplicate.provider, "fallback");
  if (duplicate.provider === "fallback") assert.equal(duplicate.reason, "duplicate-request");
  for (let index = 1; index < 5; index += 1) await harness.request(index);
  assert.equal(harness.providerCalls(), 4);
});

test("deletion tombstones fence daily usage, idempotency, and remote provider access", async () => {
  const harness = quotaHarness();
  harness.transactions.documents.set(TOMBSTONE_PATH, { status: "deleting" });
  await assert.rejects(harness.request(0), /account-deleting/);
  assert.equal(harness.providerCalls(), 0);
  assert.equal(harness.transactions.documents.size, 1);
});

test("the existing per-minute bound still blocks requests before daily usage changes", async () => {
  const harness = quotaHarness();
  harness.transactions.documents.set(MINUTE_PATH, { count: 30, windowStartedAt: NOW, expiresAt: NOW + 60_000 });
  await assert.rejects(harness.request(0), /rate-limited/);
  assert.equal(harness.providerCalls(), 0);
  assert.equal(harness.transactions.documents.has(DAILY_PATH), false);
});

test("concurrent Free requests cannot reserve more than three daily provider calls", async () => {
  const harness = quotaHarness();
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => harness.request(index)));
  assert.equal(results.filter((result) => result.provider === "remote").length, 3);
  assert.equal(harness.providerCalls(), 3);
});

test("disabled remote CLARA does not spend daily remote allowance", async () => {
  const harness = quotaHarness({ gate: "disabled" });
  await harness.request(0);
  assert.equal(harness.providerCalls(), 0);
  assert.equal(harness.transactions.documents.has(DAILY_PATH), false);
});

test("other AI routes retain their per-minute limit without consuming CLARA allowance or reading membership", async () => {
  const transactions = new MemoryTransactions();
  for (const route of ["challenges", "retention"] as const) {
    for (let index = 0; index < 4; index += 1) {
      const result = await transactions.run((store) => authorizeAiUsage(store, {
        uid: UID, route,
        rateLimitPath: `rate_limits/${UID}_ai-${route}`,
        idempotencyPath: `idempotency/${UID}_ai-${route}_${index}`,
        accountTombstonePath: TOMBSTONE_PATH,
        dailyUsagePath: DAILY_PATH,
        now: NOW, windowMs: 60_000, limit: 4, idempotencyTtlMs: 86_400_000
      }, async () => { assert.fail("Other routes do not use daily CLARA membership"); }));
      assert.equal(result, "allowed");
    }
    const exhausted = await transactions.run((store) => authorizeAiUsage(store, {
      uid: UID, route,
      rateLimitPath: `rate_limits/${UID}_ai-${route}`,
      idempotencyPath: `idempotency/${UID}_ai-${route}_overflow`,
      accountTombstonePath: TOMBSTONE_PATH,
      dailyUsagePath: DAILY_PATH,
      now: NOW, windowMs: 60_000, limit: 4, idempotencyTtlMs: 86_400_000
    }, async () => []));
    assert.equal(exhausted, "rate-limited");
  }
  assert.equal(transactions.documents.has(DAILY_PATH), false);
});
