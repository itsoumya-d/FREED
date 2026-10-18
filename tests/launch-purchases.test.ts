import assert from "node:assert/strict";
import { createNativeIapStoreAdapter } from "../src/lib/native-iap-adapter";
import { getMonetizationConfig } from "../src/lib/monetization";

const expiry = "2030-01-01T00:00:00.000Z";
const appleToken = "ea8110b0-56d5-5a64-a031-194415ec890a";
const requests: unknown[] = [];
const finished: unknown[] = [];
const purchase = { platform: "ios", store: "apple", productId: "freed_premium_yearly", transactionId: "123456789012345", purchaseState: "purchased" };
let purchased = false;
const listeners = { purchaseUpdatedListener: () => ({ remove() {} }), purchaseErrorListener: () => ({ remove() {} }) };
const adapter = createNativeIapStoreAdapter({
  ...listeners,
  initConnection: async () => true,
  fetchProducts: async () => [{ id: "freed_premium_yearly", displayPrice: "₹3,999.00", subscriptionOffers: [] }],
  requestPurchase: async (request) => { purchased = true; requests.push(request); return purchase; },
  finishTransaction: async (value) => { finished.push(value); },
  getAvailablePurchases: async () => purchased ? [purchase] : []
} as never, async (input) => ({active:true,entitlementId:"premium",productId:input.productId,platform:input.platform,status:"verified",expiresAt:expiry}), {
  getCheckoutContext: async () => ({ appAccountToken: appleToken, obfuscatedAccountId: "a".repeat(64) })
} as never)!;

async function run() {
  const config = getMonetizationConfig({mode:"native",platform:"ios"});
  const prices = await adapter.fetchStorePrices!(config);
  assert.equal(prices[0].displayPrice, "₹3,999.00", "checkout must use the store's localized billed amount");
  const result = await adapter.purchaseProduct("freed_premium_yearly", config);
  assert.equal(result.verifiedEntitlement?.expiresAt, expiry, "server expiry must survive the native adapter");
  assert.equal((requests[0] as any).request.apple.appAccountToken, appleToken, "checkout must carry the server-issued account token");
  assert.equal(finished.length, 1, "only a verified transaction is finished");
  const restored = await adapter.restorePurchases(config);
  assert.equal(restored.verifiedEntitlement?.productId, "freed_premium_yearly");

  let androidRequest: any;
  const android = createNativeIapStoreAdapter({
    ...listeners,
    initConnection:async()=>true,
    fetchProducts:async()=>[{id:"freed_premium_monthly",displayPrice:"$9.99",subscriptionOfferDetailsAndroid:[{basePlanId:"monthly",offerToken:"base-plan-token",pricingPhases:{pricingPhaseList:[{formattedPrice:"$9.99",billingPeriod:"P1M",priceAmountMicros:"9990000"}]}}]}],
    requestPurchase:async(request:any)=>{androidRequest=request;return {platform:"android",store:"google",productId:"freed_premium_monthly",purchaseToken:"store-owned-token-12345678",purchaseState:"purchased"};}
  } as never,async(input)=>({active:true,entitlementId:"premium",productId:input.productId,platform:input.platform,status:"verified",expiresAt:expiry}),{getCheckoutContext:async()=>({appAccountToken:appleToken,obfuscatedAccountId:"a".repeat(64)})} as never)!;
  await android.purchaseProduct("freed_premium_monthly",getMonetizationConfig({mode:"native",platform:"android"}));
  assert.deepEqual(androidRequest.request.google.subscriptionOffers,[{sku:"freed_premium_monthly",offerToken:"base-plan-token"}]);
  assert.equal(androidRequest.request.google.obfuscatedAccountId,"a".repeat(64));
  console.log("launch purchase and localized checkout tests passed");
}
void run().catch(error=>{ console.error(error);process.exitCode=1; });
