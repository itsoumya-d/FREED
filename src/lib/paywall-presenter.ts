import type { LaunchPremiumPlanId, MonetizationPlatform } from "@/lib/monetization";
import {
  describeLaunchPlanPricing,
  getPaywallPrimaryActionLabel,
  isStoreFormattedPrice,
  type PaywallPlanPricing,
  type StoreProductPrice
} from "@/lib/store-pricing";

export type PaywallPriceStatus = "loading" | "ready" | "empty" | "error";
export type PurchaseVerificationStatus = "loading" | "ready" | "unavailable";

export type PaywallPlanPresentation = {
  pricing: PaywallPlanPricing | null;
  headline: string;
  cadence: string;
  detail: string | null;
  primaryActionLabel: string;
  canPurchase: boolean;
  canRetry: boolean;
  isPreview: boolean;
};

export function presentPaywallPlan(options: {
  planId: LaunchPremiumPlanId;
  productId: string;
  storePrices: StoreProductPrice[];
  status: PaywallPriceStatus;
  platform: MonetizationPlatform;
  isDevelopment: boolean;
  verificationStatus?: PurchaseVerificationStatus;
}): PaywallPlanPresentation {
  const nativePlatform = options.platform === "ios" || options.platform === "android";
  const storePrice = options.storePrices.find((price) =>
    price.productId === options.productId &&
    isStoreFormattedPrice(price.displayPrice)
  );
  const isPreview = !storePrice && options.isDevelopment && !nativePlatform;
  const pricing = storePrice
    ? describeLaunchPlanPricing(options.planId, { ...storePrice, freeTrialDays: null })
    : isPreview
    ? describeLaunchPlanPricing(options.planId)
    : null;
  const canPurchase = nativePlatform && options.status === "ready" && Boolean(pricing?.storeLocalized) && options.verificationStatus === "ready";
  const loading = options.status === "loading";

  return {
    pricing,
    headline: pricing?.headline ?? (loading ? "Loading price…" : "Price unavailable"),
    cadence: pricing?.cadence ?? "",
    detail: isPreview ? `Development preview · ${pricing?.detail ?? "No checkout"}` : pricing?.detail ?? null,
    primaryActionLabel: canPurchase && pricing
      ? getPaywallPrimaryActionLabel(pricing)
      : isPreview
      ? "Preview only · purchases unavailable"
      : !nativePlatform
      ? "Subscribe in the iOS or Android app"
      : loading
      ? "Loading store prices…"
      : pricing?.storeLocalized && options.verificationStatus === "loading"
      ? "Checking secure checkout…"
      : pricing?.storeLocalized && options.verificationStatus !== "ready"
      ? "Secure checkout unavailable"
      : "Store price unavailable",
    canPurchase,
    canRetry: nativePlatform && !loading && !canPurchase,
    isPreview
  };
}

export function getSubscriptionManagementUrl(platform: MonetizationPlatform): string | null {
  if (platform === "ios") return "https://apps.apple.com/account/subscriptions";
  if (platform === "android") return "https://play.google.com/store/account/subscriptions";
  return null;
}
