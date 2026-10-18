import assert from "node:assert/strict";
import { test } from "node:test";
import { createNativeIapStoreAdapter, type ExpoIapModule } from "../src/lib/native-iap-adapter";
import { getMonetizationConfig } from "../src/lib/monetization";

const config = getMonetizationConfig({ mode: "native", platform: "ios" });
const context = { appAccountToken: "ea8110b0-56d5-5a64-a031-194415ec890a", obfuscatedAccountId: "a".repeat(64) };
const purchase = { platform: "ios", store: "apple", productId: "freed_premium_yearly", transactionId: "123456789012345", purchaseState: "purchased" };
const verify = async (input: any) => ({ active: true, entitlementId: "premium" as const, productId: input.productId, platform: input.platform, status: "verified" as const, expiresAt: "2030-01-01T00:00:00.000Z" });

test("native SDK without both lifecycle listeners cannot open a store charge sheet", async () => {
  for (const missing of ["both", "updates", "errors"] as const) {
    let charged = 0;
    const sdk: ExpoIapModule = {
      initConnection: async () => true, requestPurchase: async () => { charged++; return purchase; },
      ...(missing !== "both" && missing !== "updates" ? { purchaseUpdatedListener: () => ({ remove() {} }) } : {}),
      ...(missing !== "both" && missing !== "errors" ? { purchaseErrorListener: () => ({ remove() {} }) } : {})
    };
    const adapter = createNativeIapStoreAdapter(sdk, verify, { getCheckoutContext: async () => context, purchaseTimeoutMs: 5 })!;
    const result = await adapter.purchaseProduct("freed_premium_yearly", config);
    assert.equal(result.purchaseStatus, "unavailable");
    assert.deepEqual(result.activeEntitlementIds, []);
    assert.equal(charged, 0);
  }
});

test("native SDK requires server checkout readiness even with working listeners", async () => {
  let charged = 0;
  const sdk: ExpoIapModule = {
    initConnection: async () => true, requestPurchase: async () => { charged++; return purchase; },
    purchaseUpdatedListener: () => ({ remove() {} }), purchaseErrorListener: () => ({ remove() {} })
  };
  const adapter = createNativeIapStoreAdapter(sdk, verify, { purchaseTimeoutMs: 5 })!;
  const result = await adapter.purchaseProduct("freed_premium_yearly", config);
  assert.equal(result.purchaseStatus, "unavailable");
  assert.equal(charged, 0);
});

test("pending restore entries cannot hide the purchased entry for the same store token", async () => {
  let verified = 0;
  let finished = 0;
  const purchased = { platform: "android", store: "google", productId: "freed_premium_monthly", purchaseToken: "owned-secret-token-12345678", purchaseState: "purchased" };
  const adapter = createNativeIapStoreAdapter({
    initConnection: async () => true, requestPurchase: async () => null,
    getAvailablePurchases: async () => [{ ...purchased, purchaseState: "pending" }, purchased, purchased],
    finishTransaction: async () => { finished++; }
  }, async input => { verified++; return verify(input); })!;
  const result = await adapter.restorePurchases(getMonetizationConfig({ mode: "native", platform: "android" }));
  assert.deepEqual(result.activeEntitlementIds, ["premium"]);
  assert.equal(verified, 1);
  assert.equal(finished, 1);
});

test("iOS plan change reuses the original verified guest binding after account transfer", async () => {
  for (const source of ["sdk", "witness", "missing", "mismatch"] as const) {
    const originalToken = "0a9c5c97-4110-5f54-8f9c-c0a02e19fc09";
    const payload = Buffer.from(JSON.stringify({ appAccountToken: originalToken })).toString("base64url");
    const previous = { ...purchase, productId: "freed_premium_monthly",
      ...(source === "sdk" ? { appAccountToken: originalToken } : source === "mismatch" ? { appAccountToken: context.appAccountToken } : {}),
      ...(source === "witness" || source === "mismatch" ? { purchaseToken: `eyJhbGciOiJFUzI1NiJ9.${payload}.valid-signed-witness` } : {}) };
    const requests: any[] = [];
    const adapter = createNativeIapStoreAdapter({
      initConnection: async () => true, getAvailablePurchases: async () => [previous],
      fetchProducts: async () => [{ id: "freed_premium_yearly", displayPrice: "$39.99" }],
      requestPurchase: async request => { requests.push(request); return { ...purchase, purchaseToken: `eyJhbGciOiJFUzI1NiJ9.${payload}.valid-signed-witness` }; },
      purchaseUpdatedListener: () => ({ remove() {} }), purchaseErrorListener: () => ({ remove() {} })
    }, verify, { getCheckoutContext: async () => context, purchaseTimeoutMs: 5 })!;
    const result = await adapter.purchaseProduct("freed_premium_yearly", config);
    if (source === "missing" || source === "mismatch") {
      assert.equal(result.purchaseStatus, "unavailable");
      assert.equal(requests.length, 0);
    } else {
      assert.equal(result.purchaseStatus, "purchased");
      assert.equal(requests[0].request.apple.appAccountToken, originalToken);
    }
  }
});

test("a deferred iOS plan change callback reports pending without granting the new plan", async () => {
  const previous = { ...purchase, productId: "freed_premium_monthly", appAccountToken: context.appAccountToken };
  let verifications = 0;
  const adapter = createNativeIapStoreAdapter({
    initConnection: async () => true, getAvailablePurchases: async () => [previous],
    fetchProducts: async () => [{ id: "freed_premium_yearly", displayPrice: "$39.99" }],
    requestPurchase: async () => previous,
    purchaseUpdatedListener: () => ({ remove() {} }), purchaseErrorListener: () => ({ remove() {} })
  }, async input => { verifications++; return verify(input); }, { getCheckoutContext: async () => context, purchaseTimeoutMs: 500 })!;
  let guard: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([adapter.purchaseProduct("freed_premium_yearly", config),
      new Promise<never>((_resolve, reject) => { guard = setTimeout(() => reject(new Error("Deferred store callback did not report pending.")), 50); })]);
    assert.equal(result.purchaseStatus, "pending");
    assert.deepEqual(result.activeEntitlementIds, []);
    assert.equal(verifications, 1, "Only the existing paid membership should be verified.");
  } finally { if (guard) clearTimeout(guard); }
});
