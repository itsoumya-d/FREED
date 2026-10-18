import assert from "node:assert/strict";
import { test } from "node:test";
import { createNativeIapStoreAdapter, type ExpoIapModule } from "../src/lib/native-iap-adapter";
import { createNativeMonetizationAdapter } from "../src/lib/native-monetization-adapter";
import { getMonetizationConfig, getLaunchPremiumPlans } from "../src/lib/monetization";

const expiry = "2030-01-01T00:00:00.000Z";
const checkoutContext = { appAccountToken: "ea8110b0-56d5-5a64-a031-194415ec890a", obfuscatedAccountId: "a".repeat(64) };
const signedTransactionInfo = "eyJhbGciOiJFUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ.fixture-signature-value";
const iosPurchase = { platform: "ios", store: "apple", productId: "freed_premium_yearly", transactionId: "123456789012345", purchaseState: "purchased", purchaseToken: signedTransactionInfo };
const config = getMonetizationConfig({ mode: "native", platform: "ios" });
const verified = async (input: any) => ({ active: true, entitlementId: "premium" as const, productId: input.productId, platform: input.platform, status: "verified" as const, expiresAt: expiry });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function eventSdk(overrides: Partial<ExpoIapModule> = {}) {
  let update: ((value: unknown) => void) | undefined;
  let error: ((value: unknown) => void) | undefined;
  const finished: unknown[] = [];
  const requests: unknown[] = [];
  const sdk: ExpoIapModule = {
    initConnection: async () => true,
    fetchProducts: async () => [{ id: "freed_premium_yearly", displayPrice: "$39.99" }],
    requestPurchase: async request => { requests.push(request); return null; },
    getAvailablePurchases: async () => [],
    finishTransaction: async value => { finished.push(value); },
    purchaseUpdatedListener: (listener: (value: unknown) => void) => { update = listener; return { remove() { update = undefined; } }; },
    purchaseErrorListener: (listener: (value: unknown) => void) => { error = listener; return { remove() { error = undefined; } }; },
    ...overrides
  } as ExpoIapModule;
  return { sdk, requests, finished, update: (value: unknown) => update?.(value), error: (value: unknown) => error?.(value) };
}

test("a null requestPurchase waits for the actual SDK update and sends iOS signed witness", async () => {
  const sdk = eventSdk();
  const verification: any[] = [];
  const store = createNativeIapStoreAdapter(sdk.sdk, async input => { verification.push(input); return verified(input); }, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 100 })!;
  const pending = store.purchaseProduct("freed_premium_yearly", config);
  await tick();
  assert.equal(verification.length, 0);
  sdk.update(iosPurchase);
  const entitlement = await pending;
  assert.equal(entitlement.purchaseStatus, "purchased");
  assert.deepEqual(entitlement.activeEntitlementIds, ["premium"]);
  assert.equal(verification[0].signedTransactionInfo, signedTransactionInfo);
  assert.equal(sdk.finished.length, 1);
  sdk.update(iosPurchase);
  assert.equal(verification.length, 1, "Duplicate SDK events must not verify or finish twice in one checkout.");
});

test("SDK cancellation wins over a late update and never grants or finishes", async () => {
  const sdk = eventSdk();
  let verifies = 0;
  const store = createNativeIapStoreAdapter(sdk.sdk, async input => { verifies += 1; return verified(input); }, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 100 })!;
  const pending = store.purchaseProduct("freed_premium_yearly", config);
  await tick();
  sdk.error({ code: "user-cancelled", productId: "freed_premium_yearly", message: "private-sdk-token" });
  sdk.update(iosPurchase);
  const entitlement = await pending;
  assert.equal(entitlement.purchaseStatus, "cancelled");
  assert.deepEqual(entitlement.activeEntitlementIds, []);
  assert.equal(verifies, 0);
  assert.equal(sdk.finished.length, 0);
  assert.equal(JSON.stringify(entitlement).includes("private-sdk-token"), false);
});

test("pending purchase updates and bounded silent SDK requests remain ungranted", async () => {
  for (const update of [true, false]) {
    const sdk = eventSdk();
    let verifies = 0;
    const store = createNativeIapStoreAdapter(sdk.sdk, async input => { verifies += 1; return verified(input); }, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 15 })!;
    const pending = store.purchaseProduct("freed_premium_yearly", config);
    await tick();
    if (update) sdk.update({ ...iosPurchase, purchaseState: "pending" });
    const result = await pending;
    assert.equal(result.purchaseStatus, "pending");
    assert.deepEqual(result.activeEntitlementIds, []);
    assert.equal(verifies, 0);
  }
});

test("store initialization is single-flight across simultaneous pricing and restore", async () => {
  let initializes = 0;
  let finishInit!: (value: boolean) => void;
  const held = new Promise<boolean>(resolve => { finishInit = resolve; });
  const sdk = eventSdk({ initConnection: async () => { initializes += 1; return held; } });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext })!;
  const operations = [store.fetchStorePrices!(config), store.restorePurchases(config)];
  await tick();
  const callsBeforeInitialization = initializes;
  finishInit(true);
  await Promise.all(operations);
  assert.equal(callsBeforeInitialization, 1);
});

test("simultaneous checkout requests open only one charge sheet while initialization is pending", async () => {
  let finishInit!: (value: boolean) => void;
  const held = new Promise<boolean>(resolve => { finishInit = resolve; });
  const sdk = eventSdk({ initConnection: async () => held });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 60 })!;
  const first = store.purchaseProduct("freed_premium_yearly", config);
  const second = store.purchaseProduct("freed_premium_yearly", config);
  finishInit(true);
  await tick();
  sdk.update(iosPurchase);
  const results = await Promise.all([first, second]);
  assert.equal(sdk.requests.length, 1);
  assert.equal(results[0].purchaseStatus, "purchased");
  assert.equal(results[1].purchaseStatus, "pending");
});

test("unavailable verifier checkout context prevents opening the store charge sheet", async () => {
  const sdk = eventSdk();
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => { throw new Error("private-server-key"); } })!;
  const result = await store.purchaseProduct("freed_premium_yearly", config);
  assert.equal(result.purchaseStatus, "unavailable");
  assert.equal(sdk.requests.length, 0);
  assert.equal(JSON.stringify(result).includes("private-server-key"), false);
});

test("unfinished verified transactions retry finalization during restore", async () => {
  let finishAttempts = 0;
  const sdk = eventSdk({
    requestPurchase: async () => iosPurchase,
    finishTransaction: async () => { finishAttempts += 1; if (finishAttempts === 1) throw new Error("Store temporary failure"); },
    getAvailablePurchases: async () => []
  });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext })!;
  assert.equal((await store.purchaseProduct("freed_premium_yearly", config)).purchaseStatus, "purchased");
  const restored = await store.restorePurchases(config);
  assert.equal(restored.purchaseStatus, "purchased");
  assert.equal(finishAttempts, 2);
});

test("Android same-level monthly/yearly switch carries old token and deferred product replacement", async () => {
  const old = { platform: "android", store: "google", productId: "freed_premium_monthly", purchaseToken: "old-play-owned-secret-token", purchaseState: "purchased" };
  const sdk = eventSdk({
    fetchProducts: async () => [{ id: "freed_premium_yearly", displayPrice: "$39.99", subscriptionOfferDetailsAndroid: [{ basePlanId: "yearly", offerToken: "yearly-base-offer", pricingPhases: { pricingPhaseList: [{ formattedPrice: "$39.99", billingPeriod: "P1Y" }] } }] }],
    getAvailablePurchases: async () => [old],
    requestPurchase: async request => { sdk.requests.push(request); return { ...old, pendingPurchaseUpdateAndroid: { products: ["freed_premium_yearly"], purchaseToken: "new-deferred-owned-token" } }; }
  });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 20 })!;
  const result = await store.purchaseProduct("freed_premium_yearly", getMonetizationConfig({ mode: "native", platform: "android" }));
  const request = sdk.requests[0] as any;
  assert.equal(request.request.google.purchaseToken, old.purchaseToken);
  assert.deepEqual(request.request.google.subscriptionProductReplacementParams, { oldProductId: old.productId, replacementMode: "deferred" });
  assert.equal(result.purchaseStatus, "pending");
  assert.deepEqual(result.activeEntitlementIds, []);
});

test("pending and cancellation status survive the public monetization adapter without granting", async () => {
  for (const purchaseStatus of ["pending", "cancelled"] as const) {
    const provider = createNativeMonetizationAdapter({ store: {
      purchaseProduct: async () => ({ activeEntitlementIds: ["premium"], purchaseStatus }),
      restorePurchases: async () => ({ activeEntitlementIds: [], purchaseStatus })
    } });
    const result = await provider.purchasePremiumPlan!(getLaunchPremiumPlans({ platform: "ios" })[0], config);
    assert.equal(result.purchaseStatus, purchaseStatus);
    assert.equal(result.premium, false);
    assert.notEqual(result.status, "purchased");
  }
});

test("direct checkout rejects missing, wrong-product, or malformed billed-price metadata", async () => {
  for (const products of [[], [{ id: "freed_premium_monthly", displayPrice: "$9.99" }], [{ id: "freed_premium_yearly", displayPrice: "Price unavailable" }], [{ id: "freed_premium_yearly", displayPrice: "$0.00", price: 0 }]]) {
    const sdk = eventSdk({ fetchProducts: async () => products, requestPurchase: async request => { sdk.requests.push(request); return iosPurchase; } });
    const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext })!;
    const result = await store.purchaseProduct("freed_premium_yearly", config);
    assert.equal(result.purchaseStatus, "unavailable", "Only current exact-product billed metadata may open checkout.");
    assert.equal(sdk.requests.length, 0);
    store.dispose?.();
  }
});

test("Android billed display and checkout token use the same validated base offer", async () => {
  for (const unified of [false, true]) {
    const offers = unified ? { subscriptionOffers: [
      { id: '', offerTokenAndroid: 'invalid-first-token', pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '$0.00', priceAmountMicros: '0', billingPeriod: 'P1Y' }] } },
      { id: '', offerTokenAndroid: 'priced-second-token', pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '₹3,999.00', priceAmountMicros: '3999000000', billingPeriod: 'P1Y' }] } }
    ] } : { subscriptionOfferDetailsAndroid: [
      { offerToken: 'invalid-first-token', pricingPhases: { pricingPhaseList: [{ formattedPrice: '$0.00', priceAmountMicros: '0', billingPeriod: 'P1Y' }] } },
      { offerToken: 'priced-second-token', pricingPhases: { pricingPhaseList: [{ formattedPrice: '₹3,999.00', priceAmountMicros: '3999000000', billingPeriod: 'P1Y' }] } }
    ] };
    const product = { id: 'freed_premium_yearly', displayPrice: '$0.00', ...offers };
    const sdk = eventSdk({ fetchProducts: async () => [product], requestPurchase: async request => { sdk.requests.push(request); return { platform: 'android', store: 'google', productId: product.id, purchaseState: 'purchased', purchaseToken: 'owned-purchase-token-123456' }; } });
    const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext })!;
    const android = getMonetizationConfig({ mode: 'native', platform: 'android' });
    assert.equal((await store.fetchStorePrices!(android))[0]?.displayPrice, '₹3,999.00');
    assert.equal((await store.purchaseProduct(product.id, android)).purchaseStatus, 'purchased');
    assert.equal((sdk.requests[0] as any).request.google.subscriptionOffers[0].offerToken, 'priced-second-token');
    store.dispose?.();
  }
});

test("conflicting store product aliases cannot open checkout", async () => {
  const sdk = eventSdk({ fetchProducts: async () => [{ id: 'freed_premium_monthly', productId: 'freed_premium_yearly', displayPrice: '$9.99' }], requestPurchase: async request => { sdk.requests.push(request); return iosPurchase; } });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext })!;
  assert.deepEqual(await store.fetchStorePrices!(config), []);
  assert.equal((await store.purchaseProduct('freed_premium_yearly', config)).purchaseStatus, 'unavailable');
  assert.equal(sdk.requests.length, 0);
  store.dispose?.();
});

test("legacy Android subscription metadata without an explicit validated offer token cannot charge", async () => {
  const sdk = eventSdk({ fetchProducts: undefined, getSubscriptions: async () => [{ id: 'freed_premium_yearly', displayPrice: '$39.99' }], requestPurchase: async request => { sdk.requests.push(request); return null; } });
  const store = createNativeIapStoreAdapter(sdk.sdk, verified, { getCheckoutContext: async () => checkoutContext, purchaseTimeoutMs: 5 })!;
  assert.equal((await store.purchaseProduct('freed_premium_yearly', getMonetizationConfig({ mode: 'native', platform: 'android' }))).purchaseStatus, 'unavailable');
  assert.equal(sdk.requests.length, 0);
  store.dispose?.();
});
