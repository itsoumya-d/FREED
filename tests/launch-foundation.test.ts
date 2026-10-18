import assert from "node:assert/strict";
import * as monetization from "../src/lib/monetization";

for (const planId of ["monthly", "yearly"] as const) {
  const capabilities = monetization.getPremiumCapabilities({ premium: true, planId });
  assert.equal(capabilities.sponsorAccountability, true, `${planId} must unlock accountability reports`);
  assert.equal(capabilities.familySupport, true, `${planId} must unlock support-circle reports`);
  assert.equal(capabilities.relapsePrediction, true, `${planId} must unlock recorded-signal forecasts`);
  assert.equal(capabilities.deepRecoveryReports, true, `${planId} must unlock deep reports`);
}
assert.deepEqual(
  monetization.getPremiumCapabilities({ premium: true, planId: "monthly" }),
  monetization.getPremiumCapabilities({ premium: true, planId: "yearly" })
);
assert.equal(Object.values(monetization.getPremiumCapabilities({ premium: false })).some(Boolean), false);

const configured = (monetization as unknown as {
  isRewardedAdSdkConfigured: (config: monetization.MonetizationConfig) => boolean;
}).isRewardedAdSdkConfigured;
assert.equal(typeof configured, "function", "ad SDK loading must be gated by validated platform configuration");
const base = monetization.getMonetizationConfig({ mode: "native", platform: "android" });
assert.equal(configured({ ...base, admobAppId: null, rewardedResetPlacementId: null }), false);
assert.equal(configured({ ...base, admobAppId: "ca-app-pub-1234567890123456~1234567890", rewardedResetPlacementId: "ca-app-pub-1234567890123456/1234567890", allowTestAds: false }), true);
assert.equal(configured({ ...base, admobAppId: "ca-app-pub-3940256099942544~3347511713", rewardedResetPlacementId: "ca-app-pub-1234567890123456/1234567890", allowTestAds: false }), false);
assert.equal(configured({ ...base, platform: "web", admobAppId: "ca-app-pub-1234567890123456~1234567890", rewardedResetPlacementId: "ca-app-pub-1234567890123456/1234567890", allowTestAds: false }), false);
console.log("launch foundation behavioral checks passed");
