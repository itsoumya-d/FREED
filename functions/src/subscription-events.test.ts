import assert from "node:assert/strict";
import test from "node:test";
import { PurchaseProviderError, deriveAppleAppAccountToken, hashStoreReference, type PurchaseProvider, type VerifiedStorePurchase } from "./purchase.js";
import * as eventModule from "./subscription-events.js";
import type { SubscriptionClaim, SubscriptionMutation } from "./subscription-events.js";
import { premiumEntitlementFromClaims } from "./premium-state.js";

const api = eventModule;
const NOW = Date.parse("2026-10-01T10:00:00.000Z");
const FUTURE = NOW + 86_400_000;
const UID = "subscriptionOwner123";
const APP_ID = 1234567890;
const ORIGINAL = "2000001234567890";
const TOKEN = "play-purchase-token_1234567890";
const JWS = "eyJhbGciOiJFUzI1NiJ9.eyJmaXh0dXJlIjp0cnVlfQ.c2lnbmF0dXJl";
const SOURCE = "//pubsub.googleapis.com/projects/freed-7d5ee/topics/freed-google-play-subscriptions";
const PRODUCT = "freed_premium_monthly";
const CURRENT_TRANSACTION = "2000009876543211";
const OLD_ORDER_HASH = "bdca0d7f5db540a9142165aa96339bbf135d5f880f7c7010376ea5e108ca8bb6";
const CURRENT_ORDER_HASH = "b8a52ca6465051a01e5850876b561bbd3819bf8a5e427d379ee0ac72693c96b6";

type Claim = SubscriptionClaim;

function appleFixture(overrides: Record<string, unknown> = {}) {
  return {
    notification: {
      notificationType: "DID_RENEW", notificationUUID: "9a7db3ae-3548-4a66-9c2e-123456789abc",
      signedDate: NOW, version: "2.0",
      data: { bundleId: "app.freed.recovery", appAppleId: APP_ID, environment: "Production", signedTransactionInfo: JWS,
        signedRenewalInfo: undefined as string | undefined },
      ...overrides
    },
    transaction: {
      transactionId: "2000009876543210", originalTransactionId: ORIGINAL, productId: PRODUCT,
      bundleId: "app.freed.recovery", environment: "Production", type: "Auto-Renewable Subscription",
      inAppOwnershipType: "PURCHASED", purchaseDate: NOW - 1000, signedDate: NOW,
      expiresDate: FUTURE, appAccountToken: deriveAppleAppAccountToken(UID)
    },
    renewal: {
      originalTransactionId: ORIGINAL, productId: PRODUCT, environment: "Production", signedDate: NOW,
      isInBillingRetryPeriod: true, gracePeriodExpiresDate: FUTURE, appAccountToken: deriveAppleAppAccountToken(UID)
    }
  };
}

function appleDecoder(fixture = appleFixture(), fail = false, timeoutMs = 1000, renewalError?: Error) {
  let verificationCalls = 0;
  const decode = api.createAppleNotificationDecoder({
    appAppleId: String(APP_ID), rootCertificatesBase64: JSON.stringify([Buffer.from("local-test-root").toString("base64")]),
    environment: "Production"
  }, {
    createVerifier: (options) => {
      assert.equal(options.bundleId, "app.freed.recovery");
      assert.equal(options.appAppleId, APP_ID);
      assert.equal(options.enableOnlineChecks, true);
      assert.equal(options.environment, "Production");
      return {
        verifyAndDecodeNotification: async (signed: string) => {
          verificationCalls += 1;
          assert.equal(signed, JWS);
          if (fail) throw new Error("invalid-signature-private-payload");
          return fixture.notification;
        },
        verifyAndDecodeTransaction: async (signed: string) => {
          verificationCalls += 1;
          assert.equal(signed, JWS);
          return fixture.transaction;
        },
        verifyAndDecodeRenewalInfo: async (signed: string) => {
          verificationCalls += 1;
          assert.equal(signed, JWS);
          if (renewalError) throw renewalError;
          return fixture.renewal;
        }
      };
    }
  }, () => NOW, timeoutMs);
  return { decode, verificationCalls: () => verificationCalls };
}

function googleEnvelope(type = 2, overrides: Record<string, unknown> = {}) {
  const body = {
    version: "1.0", packageName: "app.freed.recovery", eventTimeMillis: String(NOW),
    subscriptionNotification: { version: "1.0", notificationType: type, purchaseToken: TOKEN, subscriptionId: PRODUCT },
    ...overrides
  };
  return { source: SOURCE, type: "google.cloud.pubsub.topic.v1.messagePublished", messageId: "1234567890123", data: Buffer.from(JSON.stringify(body)).toString("base64") };
}

function lifecycleHarness(provider: "apple" | "google-play", options: { verified?: Record<string, unknown>; providerError?: Error; appleNotification?: ReturnType<typeof appleFixture>; renewalError?: Error } = {}) {
  let claim: Claim | undefined = {
    uid: UID, provider, productId: PRODUCT, storeReferenceHash: hashStoreReference(provider === "apple" ? ORIGINAL : TOKEN),
    status: "verified", verifiedAt: NOW - 1000, entitlementExpiresAt: FUTURE
  };
  let deleting = false;
  let calls = 0;
  const receipts = new Map<string, object>();
  const writes: object[] = [];
  const decoder = appleDecoder(options.appleNotification, false, 1000, options.renewalError);
  const defaultVerified: VerifiedStorePurchase = {
    platform: provider === "apple" ? "ios" : "android", productId: PRODUCT,
    storeReference: provider === "apple" ? ORIGINAL : TOKEN, expiresAt: FUTURE,
    ...(provider === "apple" ? { environment: "Production" } : {})
  };
  const verify: PurchaseProvider["verify"] = async (input) => {
    calls += 1;
    assert.equal(input.productId, options.appleNotification?.transaction.productId ?? PRODUCT);
    if (provider === "apple") assert.equal(input.expectedAppAccountToken, deriveAppleAppAccountToken(claim?.uid ?? UID));
    else assert.equal(input.purchaseToken, TOKEN);
    if (options.providerError) throw options.providerError;
    return options.verified ? options.verified as VerifiedStorePurchase : defaultVerified;
  };
  const processor = api.createSubscriptionEventProcessor({
    now: () => NOW,
    decodeApple: decoder.decode,
    googleTopicSource: SOURCE,
    apple: { verify }, google: { verify },
    inspect: async (_hash: string, eventHash: string) => ({ claim, processed: receipts.has(eventHash), deleting }),
    commit: async (mutation: SubscriptionMutation) => {
      let writesStarted = false;
      return api.commitSubscriptionMutation({
        readClaim: async () => { assert.equal(writesStarted, false); return claim; },
        readReceipt: async (eventHash: string) => { assert.equal(writesStarted, false); return receipts.has(eventHash); },
        readDeletionTombstone: async () => { assert.equal(writesStarted, false); return deleting; },
        updateClaim: async (_hash: string, patch: object) => {
          writesStarted = true;
          assert.ok(claim);
          claim = { ...claim!, ...patch };
          writes.push(patch);
        },
        writeReceipt: async (receipt: { eventIdHash: string }) => {
          writesStarted = true;
          receipts.set(receipt.eventIdHash, receipt);
          writes.push(receipt);
        }
      }, mutation);
    }
  });
  return {
    processor, decoder, receipts, writes, calls: () => calls, claim: () => claim,
    setClaim: (value: Claim | undefined) => { claim = value; }, setDeleting: () => { deleting = true; }
  };
}

test("Apple authenticates both the notification and nested transaction before deriving the stable purchase hash", async () => {
  const { decode, verificationCalls } = appleDecoder();
  const event = await decode({ signedPayload: JWS });
  assert.equal(verificationCalls(), 2);
  assert.equal(event?.provider, "apple");
  assert.equal(event?.storeReferenceHash, hashStoreReference(ORIGINAL));
  assert.equal(event?.action, "reverify");
});

test("Apple signature rejection cannot be bypassed with decoded unsigned JSON", async () => {
  const { decode } = appleDecoder(appleFixture(), true);
  await assert.rejects(decode({ signedPayload: JWS }), /rejected/);
  await assert.rejects(decode({ ...appleFixture().notification, signedPayload: JWS }), /rejected/);
});

test("verified Apple data still rejects wrong app, environment, product, or transaction lineage", async () => {
  for (const fixture of [
    appleFixture({ data: { ...appleFixture().notification.data, bundleId: "wrong.app" } }),
    appleFixture({ data: { ...appleFixture().notification.data, appAppleId: 9999999999 } }),
    appleFixture({ data: { ...appleFixture().notification.data, environment: "Sandbox" } }),
    { ...appleFixture(), transaction: { ...appleFixture().transaction, productId: "wrong-product" } },
    { ...appleFixture(), transaction: { ...appleFixture().transaction, originalTransactionId: "not-a-transaction" } }
  ]) await assert.rejects(appleDecoder(fixture).decode({ signedPayload: JWS }), /rejected/);
});

test("Google payloads require the configured Pub/Sub transport, exact app, and bounded subscription product", () => {
  const event = api.decodeGoogleNotification(googleEnvelope(), SOURCE, NOW);
  assert.equal(event?.storeReferenceHash, hashStoreReference(TOKEN));
  for (const envelope of [
    { ...googleEnvelope(), source: "//pubsub.googleapis.com/projects/attacker/topics/other" },
    { ...googleEnvelope(), type: "http.request" },
    googleEnvelope(2, { packageName: "wrong.app" }),
    googleEnvelope(2, { subscriptionNotification: { version: "1.0", notificationType: 2, purchaseToken: TOKEN, subscriptionId: "wrong-product" } }),
    { ...googleEnvelope(), data: "x".repeat(100_000) }
  ]) assert.throws(() => api.decodeGoogleNotification(envelope, SOURCE, NOW), /rejected/);
});

test("renewed Apple purchases are reverified with the existing owner and update only lifecycle fields", async () => {
  const harness = lifecycleHarness("apple");
  assert.deepEqual(await harness.processor.processApple({ signedPayload: JWS }), { status: "processed" });
  assert.equal(harness.calls(), 1);
  assert.equal(harness.claim()?.status, "verified");
  assert.deepEqual(Object.keys(harness.writes[0]!).sort(), ["entitlementExpiresAt", "status", "verifiedAt"]);
  const persisted = JSON.stringify(harness.writes);
  assert.doesNotMatch(persisted, /signedPayload|purchaseToken|transactionId/);
  for (const rawValue of [ORIGINAL, TOKEN, JWS]) assert.equal(persisted.includes(rawValue), false);
});

test("unknown owners and deleted accounts receive no provider access or lifecycle writes", async () => {
  for (const kind of ["unknown", "deleting"]) {
    const harness = lifecycleHarness("google-play");
    if (kind === "unknown") harness.setClaim(undefined); else harness.setDeleting();
    assert.equal((await harness.processor.processGoogle(googleEnvelope())).status, kind === "unknown" ? "unknown-owner" : "account-deleting");
    assert.equal(harness.calls(), 0);
    assert.equal(harness.writes.length, 0);
  }
});

test("duplicate lifecycle events are idempotent and do not repeat provider verification", async () => {
  const harness = lifecycleHarness("google-play");
  assert.equal((await harness.processor.processGoogle(googleEnvelope())).status, "processed");
  assert.equal((await harness.processor.processGoogle(googleEnvelope())).status, "duplicate");
  assert.equal(harness.calls(), 1);
  assert.equal(harness.receipts.size, 1);
});

test("out-of-order expiry events cannot remove an entitlement established by a newer event", async () => {
  const harness = lifecycleHarness("google-play");
  await harness.processor.processGoogle(googleEnvelope());
  const stale = { ...googleEnvelope(13, { eventTimeMillis: String(NOW - 500) }), messageId: "1234567890124" };
  assert.equal((await harness.processor.processGoogle(stale)).status, "stale");
  assert.equal(harness.claim()?.status, "verified");
  assert.equal(harness.calls(), 1);
});

test("authoritative Google revocation, expiry, payment hold, and pause remove access", async () => {
  for (const [notificationType, status] of [[12, "revoked"], [13, "expired"], [5, "on-hold"], [10, "paused"]] as const) {
    const harness = lifecycleHarness("google-play", { providerError: new PurchaseProviderError("rejected") });
    assert.equal((await harness.processor.processGoogle(googleEnvelope(notificationType))).status, "processed");
    assert.equal(harness.calls(), 1);
    assert.equal(harness.claim()?.status, status);
    assert.ok(harness.claim()!.entitlementExpiresAt! <= NOW);
  }
});

test("Google cancellation preserves authoritatively verified future paid access", async () => {
  const harness = lifecycleHarness("google-play");
  assert.equal((await harness.processor.processGoogle(googleEnvelope(3))).status, "processed");
  assert.equal(harness.claim()?.status, "verified");
  assert.equal(harness.claim()?.entitlementExpiresAt, FUTURE);
});

test("signed Apple refund and expiry remove access without trusting arbitrary provider copy", async () => {
  for (const notificationType of ["REFUND", "REVOKE", "EXPIRED"]) {
    const fixture = appleFixture({ notificationType });
    if (notificationType === "EXPIRED") fixture.transaction.expiresDate = NOW - 1;
    const harness = lifecycleHarness("apple", { appleNotification: fixture });
    assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
    assert.equal(harness.claim()?.status, notificationType === "EXPIRED" ? "expired" : "revoked");
    assert.equal(harness.calls(), 0);
  }
});

test("a refund for a prior Apple transaction records a receipt without revoking the newer paid period", async () => {
  const fixture = appleFixture({ notificationType: "REFUND" });
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  const current = { ...harness.claim()!, orderReferenceHash: CURRENT_ORDER_HASH };
  harness.setClaim(current);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "stale");
  assert.deepEqual(harness.claim(), current);
  assert.equal(harness.receipts.size, 1);
  assert.equal(harness.writes.length, 1);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "duplicate");
});

test("a current Apple transaction refund still revokes the latest paid period", async () => {
  const fixture = appleFixture({ notificationType: "REFUND" });
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  harness.setClaim({ ...harness.claim()!, orderReferenceHash: OLD_ORDER_HASH } as Claim);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.claim()?.status, "revoked");
  assert.ok(harness.claim()!.entitlementExpiresAt! <= NOW);
});

test("an expiry for a prior Apple transaction preserves the newer paid period and its verification time", async () => {
  const fixture = appleFixture({ notificationType: "EXPIRED" });
  fixture.transaction.expiresDate = NOW - 1;
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  const current = { ...harness.claim()!, orderReferenceHash: CURRENT_ORDER_HASH };
  harness.setClaim(current);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "stale");
  assert.deepEqual(harness.claim(), current);
  assert.equal(harness.receipts.size, 1);
});

test("a failed requery of a prior Apple transaction cannot inactivate a newer paid period", async () => {
  const fixture = appleFixture({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_DISABLED" });
  const harness = lifecycleHarness("apple", { appleNotification: fixture, providerError: new PurchaseProviderError("rejected") });
  const current = { ...harness.claim()!, orderReferenceHash: CURRENT_ORDER_HASH };
  harness.setClaim(current);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "stale");
  assert.deepEqual(harness.claim(), current);
  assert.equal(harness.receipts.size, 1);
});

test("a verified Apple renewal replaces the stored latest transaction hash", async () => {
  const fixture = appleFixture();
  fixture.transaction.transactionId = CURRENT_TRANSACTION;
  const harness = lifecycleHarness("apple", { appleNotification: fixture, verified: {
    platform: "ios", productId: PRODUCT, storeReference: ORIGINAL, orderReference: CURRENT_TRANSACTION,
    expiresAt: FUTURE, environment: "Production"
  } });
  harness.setClaim({ ...harness.claim()!, orderReferenceHash: OLD_ORDER_HASH } as Claim);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal((harness.claim() as Claim & { orderReferenceHash?: string })?.orderReferenceHash, CURRENT_ORDER_HASH);
  assert.equal(harness.claim()?.status, "verified");
  assert.equal(harness.claim()?.entitlementExpiresAt, FUTURE);
});

test("the final transaction prevents an old Apple terminal from racing a new paid period", async () => {
  const claim = { ...lifecycleHarness("apple").claim()!, orderReferenceHash: CURRENT_ORDER_HASH };
  let updates = 0;
  let receipts = 0;
  const mutation = {
    provider: "apple" as const, uid: UID, productId: claim.productId, storeReferenceHash: claim.storeReferenceHash,
    eventIdHash: "a".repeat(64), occurredAt: NOW, processedAt: NOW, periodOrderReferenceHash: OLD_ORDER_HASH,
    patch: { status: "revoked" as const, verifiedAt: NOW, entitlementExpiresAt: NOW }
  };
  assert.equal(await api.commitSubscriptionMutation({
    readClaim: async () => claim, readReceipt: async () => false, readDeletionTombstone: async () => false,
    updateClaim: async () => { updates += 1; }, writeReceipt: async () => { receipts += 1; }
  }, mutation), "stale");
  assert.equal(updates, 0);
  assert.equal(receipts, 1);
});

function graceFixture() {
  const fixture = appleFixture({ notificationType: "DID_FAIL_TO_RENEW", subtype: "GRACE_PERIOD" });
  fixture.notification.data.signedRenewalInfo = JWS;
  fixture.transaction.expiresDate = NOW - 1;
  return fixture;
}

test("authenticated Apple billing grace retains access after paid expiry only through the signed grace deadline", async () => {
  const harness = lifecycleHarness("apple", { appleNotification: graceFixture(), providerError: new PurchaseProviderError("rejected") });
  harness.setClaim({ ...harness.claim()!, orderReferenceHash: OLD_ORDER_HASH, entitlementExpiresAt: NOW - 1 });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.decoder.verificationCalls(), 3);
  assert.equal(harness.claim()?.status, "verified");
  assert.equal(harness.claim()?.entitlementExpiresAt, FUTURE);
  const claim = harness.claim()!;
  const persisted = { ...claim, verifiedAt: { toMillis: () => claim.verifiedAt }, entitlementExpiresAt: { toMillis: () => claim.entitlementExpiresAt } };
  assert.equal(premiumEntitlementFromClaims(UID, [persisted], FUTURE - 1)?.expiresAt, "2026-10-02T10:00:00.000Z");
  assert.equal(premiumEntitlementFromClaims(UID, [persisted], FUTURE), null);
  assert.doesNotMatch(JSON.stringify(harness.writes), /signedRenewalInfo|gracePeriodExpiresDate|appAccountToken/);
  assert.equal(JSON.stringify(harness.writes).includes(JWS), false);
});

test("Apple grace rejects a missing or unauthenticated nested renewal JWS", async () => {
  const missing = graceFixture();
  missing.notification.data.signedRenewalInfo = undefined;
  for (const options of [
    { appleNotification: missing },
    { appleNotification: graceFixture(), renewalError: new Error("forged-renewal-private-jws") }
  ]) {
    const harness = lifecycleHarness("apple", options);
    assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "rejected");
    assert.equal(harness.writes.length, 0);
  }
});

test("Apple grace binds the authenticated renewal lineage, product, environment, account, and expiry", async () => {
  for (const renewal of [
    { originalTransactionId: "2000000000000000" }, { productId: "freed_premium_yearly" },
    { environment: "Sandbox" }, { appAccountToken: deriveAppleAppAccountToken("anotherOwner") },
    { gracePeriodExpiresDate: Number.NaN }, { gracePeriodExpiresDate: NOW - 2 },
    { signedDate: NOW + 300_001 }, { isInBillingRetryPeriod: false }
  ]) {
    const fixture = graceFixture();
    Object.assign(fixture.renewal, renewal);
    const harness = lifecycleHarness("apple", { appleNotification: fixture });
    assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "rejected");
    assert.equal(harness.writes.length, 0);
  }
});

test("a delayed Apple grace notification cannot grant access after its authenticated deadline", async () => {
  const fixture = graceFixture();
  fixture.transaction.expiresDate = NOW - 1000;
  fixture.renewal.gracePeriodExpiresDate = NOW;
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  harness.setClaim({ ...harness.claim()!, orderReferenceHash: OLD_ORDER_HASH, entitlementExpiresAt: NOW - 1000 });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.claim()?.status, "on-hold");
  assert.ok(harness.claim()!.entitlementExpiresAt! <= NOW);
});

test("an Apple grace period for a prior transaction cannot change a newer paid period", async () => {
  const harness = lifecycleHarness("apple", { appleNotification: graceFixture() });
  const current = { ...harness.claim()!, orderReferenceHash: CURRENT_ORDER_HASH };
  harness.setClaim(current);
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "stale");
  assert.deepEqual(harness.claim(), current);
  assert.equal(harness.receipts.size, 1);
});

test("transient provider failures preserve the existing entitlement and leave the event retryable", async () => {
  for (const provider of ["apple", "google-play"] as const) {
    const harness = lifecycleHarness(provider, { providerError: new PurchaseProviderError("unavailable") });
    const result = provider === "apple"
      ? await harness.processor.processApple({ signedPayload: JWS })
      : await harness.processor.processGoogle(googleEnvelope());
    assert.equal(result.status, "unavailable");
    assert.equal(harness.claim()?.status, "verified");
    assert.equal(harness.claim()?.entitlementExpiresAt, FUTURE);
    assert.equal(harness.writes.length, 0);
  }
});

test("provider identity or product mismatches never grant an entitlement", async () => {
  for (const verified of [
    { platform: "android", productId: PRODUCT, storeReference: "different-purchase-token", expiresAt: FUTURE },
    { platform: "android", productId: "freed_premium_yearly", storeReference: TOKEN, expiresAt: FUTURE },
    { platform: "android", productId: PRODUCT, storeReference: TOKEN, expiresAt: NOW - 1 }
  ]) {
    const harness = lifecycleHarness("google-play", { verified });
    assert.equal((await harness.processor.processGoogle(googleEnvelope())).status, "rejected");
    assert.equal(harness.writes.length, 0);
  }
});

test("the final transaction rechecks ownership and deletion before updating an existing claim", async () => {
  let writes = 0;
  const claim = lifecycleHarness("google-play").claim()!;
  const mutation: SubscriptionMutation = {
    provider: "google-play", uid: UID, productId: PRODUCT, storeReferenceHash: claim.storeReferenceHash,
    eventIdHash: "a".repeat(64), occurredAt: NOW, processedAt: NOW,
    patch: { status: "verified", verifiedAt: NOW, entitlementExpiresAt: FUTURE }
  };
  for (const replacement of [undefined, { ...claim, uid: "other-owner" }]) {
    const result = await api.commitSubscriptionMutation({
      readClaim: async () => replacement, readReceipt: async () => false, readDeletionTombstone: async () => false,
      updateClaim: async () => { writes += 1; }, writeReceipt: async () => { writes += 1; }
    }, mutation);
    assert.ok(["unknown-owner", "rejected"].includes(result));
  }
  assert.equal(await api.commitSubscriptionMutation({
    readClaim: async () => claim, readReceipt: async () => false, readDeletionTombstone: async () => true,
    updateClaim: async () => { writes += 1; }, writeReceipt: async () => { writes += 1; }
  }, mutation), "account-deleting");
  assert.equal(writes, 0);
});

test("the Sandbox decoder verifies Sandbox explicitly while the Production decoder rejects it", async () => {
  const fixture = appleFixture({ data: { ...appleFixture().notification.data, environment: "Sandbox" } });
  fixture.transaction.environment = "Sandbox";
  let selectedEnvironment: string | undefined;
  const decoder = api.createAppleNotificationDecoder({
    appAppleId: String(APP_ID), rootCertificatesBase64: JSON.stringify([Buffer.from("local-test-root").toString("base64")]),
    environment: "Sandbox"
  }, {
    createVerifier: (options) => {
      selectedEnvironment = options.environment;
      assert.equal(options.appAppleId, undefined);
      return {
        verifyAndDecodeNotification: async () => fixture.notification,
        verifyAndDecodeTransaction: async () => fixture.transaction,
        verifyAndDecodeRenewalInfo: async () => fixture.renewal
      };
    }
  }, () => NOW);
  assert.equal((await decoder({ signedPayload: JWS }))?.environment, "Sandbox");
  assert.equal(selectedEnvironment, "Sandbox");
  await assert.rejects(appleDecoder(fixture).decode({ signedPayload: JWS }), /rejected/);
});

test("missing Apple trust configuration cannot authenticate a notification", async () => {
  const decoder = api.createAppleNotificationDecoder({ appAppleId: "", rootCertificatesBase64: "", environment: "Production" });
  await assert.rejects(decoder({ signedPayload: JWS }), /unavailable/);
});

test("an Apple transaction with another account token cannot mutate the original transaction owner", async () => {
  const fixture = appleFixture();
  fixture.transaction.appAccountToken = deriveAppleAppAccountToken("otherOwner123");
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "rejected");
  assert.equal(harness.calls(), 0);
  assert.equal(harness.writes.length, 0);
});

test("Apple auto-renew cancellation retains future paid access after authoritative verification", async () => {
  const fixture = appleFixture({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_DISABLED" });
  const harness = lifecycleHarness("apple", { appleNotification: fixture });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.calls(), 1);
  assert.equal(harness.claim()?.status, "verified");
  assert.equal(harness.claim()?.entitlementExpiresAt, FUTURE);
});

test("an older renewal cannot restore access after a newer revocation", async () => {
  const options: { providerError?: Error } = { providerError: new PurchaseProviderError("rejected") };
  const harness = lifecycleHarness("google-play", options);
  await harness.processor.processGoogle(googleEnvelope(12));
  options.providerError = undefined;
  const earlierRenewal = { ...googleEnvelope(2, { eventTimeMillis: String(NOW - 1) }), messageId: "1234567890124" };
  assert.equal((await harness.processor.processGoogle(earlierRenewal)).status, "stale");
  assert.equal(harness.claim()?.status, "revoked");
  assert.equal(harness.calls(), 1);
});

test("a same-timestamp renewal cannot override revocation during the final transaction", async () => {
  const harness = lifecycleHarness("google-play");
  harness.setClaim({ ...harness.claim()!, status: "revoked", verifiedAt: NOW, entitlementExpiresAt: NOW });
  assert.equal((await harness.processor.processGoogle(googleEnvelope(2))).status, "stale");
  assert.equal(harness.claim()?.status, "revoked");
});

test("transient errors cannot turn an already inactive claim into a granted entitlement", async () => {
  const harness = lifecycleHarness("google-play", { providerError: new PurchaseProviderError("unavailable") });
  harness.setClaim({ ...harness.claim()!, status: "expired", entitlementExpiresAt: NOW - 1 });
  assert.equal((await harness.processor.processGoogle(googleEnvelope(2))).status, "unavailable");
  assert.equal(harness.claim()?.status, "expired");
  assert.equal(harness.writes.length, 0);
});

test("provider requery has a hard deadline and cannot grant on a stalled request", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const claim = lifecycleHarness("google-play").claim()!;
  const processor = api.createSubscriptionEventProcessor({
    now: () => NOW, decodeApple: async () => null, googleTopicSource: SOURCE,
    apple: { verify: () => new Promise(() => undefined) }, google: { verify: () => new Promise(() => undefined) },
    inspect: async () => ({ claim, processed: false, deleting: false }),
    commit: async () => { assert.fail("A timed-out provider cannot commit"); }, timeoutMs: 5
  });
  const pending = processor.processGoogle(googleEnvelope());
  await new Promise<void>((resolve) => setImmediate(resolve));
  context.mock.timers.tick(5);
  assert.deepEqual(await pending, { status: "unavailable" });
});


test("Apple renewals after guest transfer retain the original verified store binding", async () => {
  const hash = hashStoreReference(deriveAppleAppAccountToken(UID));
  const harness = lifecycleHarness("apple", { verified: { platform: "ios", productId: PRODUCT, storeReference: ORIGINAL,
    expiresAt: FUTURE, environment: "Production", storeAccountTokenHash: hash } });
  harness.setClaim({ ...harness.claim()!, uid: "newPermanentOwner", storeAccountTokenHash: hash });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.claim()?.uid, "newPermanentOwner");
  assert.equal(harness.claim()?.status, "verified");
});

test("Apple monthly and annual changes from store settings update the same verified lineage", async () => {
  const fixture = appleFixture(); fixture.transaction.productId = "freed_premium_yearly";
  const harness = lifecycleHarness("apple", { appleNotification: fixture, verified: { platform: "ios",
    productId: "freed_premium_yearly", storeReference: ORIGINAL, expiresAt: FUTURE, environment: "Production" } });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "processed");
  assert.equal(harness.claim()?.productId, "freed_premium_yearly");
  assert.equal(harness.claim()?.uid, UID);
});

test("Apple transferred renewals reject a different provider-confirmed account binding", async () => {
  const hash = hashStoreReference(deriveAppleAppAccountToken(UID));
  const harness = lifecycleHarness("apple", { verified: { platform: "ios", productId: PRODUCT, storeReference: ORIGINAL,
    expiresAt: FUTURE, environment: "Production", storeAccountTokenHash: "a".repeat(64) } });
  harness.setClaim({ ...harness.claim()!, uid: "newPermanentOwner", storeAccountTokenHash: hash });
  assert.equal((await harness.processor.processApple({ signedPayload: JWS })).status, "rejected");
  assert.equal(harness.writes.length, 0);
});
