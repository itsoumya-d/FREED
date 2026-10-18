import assert from "node:assert/strict";
import { presentPaywallPlan, getSubscriptionManagementUrl } from "../src/lib/paywall-presenter";

const yearlyProduct = { productId: "freed_premium_yearly", displayPrice: "₹3,999.00", freeTrialDays: null };
const monthlyProduct = { productId: "freed_premium_monthly", displayPrice: "₹999.00", freeTrialDays: null };
const defaults = {
  planId: "yearly" as const,
  productId: "freed_premium_yearly",
  storePrices: [yearlyProduct, monthlyProduct],
  status: "ready" as const,
  platform: "android" as const,
  isDevelopment: false, verificationStatus: 'ready' as const
};

// A wrong readiness branch would let a native purchase use a missing or stale price.
const native = presentPaywallPlan(defaults);
assert.equal(native.canPurchase, true);
assert.equal(native.headline, "₹3,999.00");
assert.equal(native.pricing?.storeLocalized, true);
assert.equal(native.primaryActionLabel, "Subscribe · ₹3,999.00 per year");

const monthly = presentPaywallPlan({ ...defaults, planId: "monthly", productId: monthlyProduct.productId });
assert.equal(monthly.headline, "₹999.00");
assert.equal(monthly.primaryActionLabel, "Subscribe · ₹999.00 per month");

for (const status of ["loading", "error"] as const) {
  const blocked = presentPaywallPlan({ ...defaults, status });
  assert.equal(blocked.canPurchase, false, `A ${status} catalog must not permit checkout.`);
  assert.equal(blocked.canRetry, status === "error");
}

const missing = presentPaywallPlan({ ...defaults, storePrices: [monthlyProduct] });
assert.equal(missing.canPurchase, false);
assert.equal(missing.pricing, null);
assert.equal(missing.headline, "Price unavailable");
assert.equal(missing.canRetry, true);

const malformed = presentPaywallPlan({ ...defaults, storePrices: [{ ...yearlyProduct, displayPrice: "   " }] });
assert.equal(malformed.canPurchase, false);
assert.equal(malformed.pricing, null);
for (const displayPrice of ['Price unavailable', 'Free', 'NaN']) {
  const invalid = presentPaywallPlan({ ...defaults, storePrices: [{ ...yearlyProduct, displayPrice }] });
  assert.equal(invalid.canPurchase, false, 'non-price store text must never open checkout');
  assert.equal(invalid.pricing, null);
}

// Development fallbacks may be displayed, but cannot become a purchase action.
const preview = presentPaywallPlan({ ...defaults, storePrices: [], platform: "web", isDevelopment: true });
assert.equal(preview.headline, "$39.99");
assert.equal(preview.isPreview, true);
assert.equal(preview.canPurchase, false);
assert.equal(preview.primaryActionLabel, "Preview only · purchases unavailable");
assert.match(preview.detail ?? "", /preview/i);

const productionWeb = presentPaywallPlan({ ...defaults, storePrices: [], platform: "web" });
assert.equal(productionWeb.pricing, null);
assert.equal(productionWeb.canPurchase, false);
assert.equal(productionWeb.isPreview, false);

const webCatalog = presentPaywallPlan({ ...defaults, platform: "web" });
assert.equal(webCatalog.canPurchase, false);

// Introductory metadata must never advertise the unapproved launch trial.
const noTrial = presentPaywallPlan({ ...defaults, storePrices: [{ ...yearlyProduct, freeTrialDays: 7 }] });
assert.equal(noTrial.pricing?.hasFreeTrial, false);
assert.equal(noTrial.pricing?.trialLine, null);
assert.equal(noTrial.primaryActionLabel, "Subscribe · ₹3,999.00 per year");

assert.equal(getSubscriptionManagementUrl("ios"), "https://apps.apple.com/account/subscriptions");
assert.equal(getSubscriptionManagementUrl("android"), "https://play.google.com/store/account/subscriptions");
assert.equal(getSubscriptionManagementUrl("web"), null);
assert.equal(getSubscriptionManagementUrl("unknown"), null);

console.log("paywall presenter tests passed");

for (const verificationStatus of ['loading','unavailable'] as const) {
 const blocked = presentPaywallPlan({ ...defaults, verificationStatus });
 assert.equal(blocked.canPurchase, false, 'Store price alone cannot permit checkout');
 assert.equal(blocked.headline, yearlyProduct.displayPrice);
 assert.match(blocked.primaryActionLabel, /checkout/i);
}
assert.equal(presentPaywallPlan({ ...defaults, verificationStatus: undefined }).canPurchase,false);
assert.equal(presentPaywallPlan({ ...defaults, status: 'empty', storePrices: [] }).canPurchase,false);
