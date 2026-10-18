import { setRewardedProviderDiagnostic, rewardedNativeCode } from './rewarded-ad-diagnostics';
import type { RewardedDiagnosticReceipt } from './rewarded-ad-diagnostics';
import {
  MonetizationConfig,
  NativeMonetizationProvider,
  PremiumPlan,
  PurchaseResult,
  RewardedResetResult,
  RewardedPresentationLifecycle,
  RewardedResetSession
} from "@/lib/monetization";
import type { StoreProductPrice } from "@/lib/store-pricing";
import type { VerifiedPremiumEntitlement } from "@/lib/premium-entitlement";

export type NativeEntitlementInfo = {
  activeEntitlementIds: string[];
  purchaseStatus?: "purchased" | "pending" | "cancelled" | "failed" | "unavailable";
  message?: string;
  verifiedEntitlement?: VerifiedPremiumEntitlement;
  raw?: unknown;
};

export type NativeStoreAdapter = {
  dispose?: () => void;
  fetchStorePrices?: (config: MonetizationConfig) => Promise<StoreProductPrice[]>;
  purchaseProduct: (productId: string, config: MonetizationConfig) => Promise<NativeEntitlementInfo>;
  restorePurchases: (config: MonetizationConfig) => Promise<NativeEntitlementInfo>;
};

export type NativeRewardedAdAdapter = {
  getAdPrivacyOptionsRequired?: () => Promise<boolean | null>;
  showAdPrivacyOptions?: (isCurrent?: () => boolean) => Promise<boolean>;
  createSession: (config: MonetizationConfig) => RewardedResetSession | null;
  completeSession: (session: RewardedResetSession, config: MonetizationConfig, isEligible?: () => boolean, lifecycle?: RewardedPresentationLifecycle) => Promise<RewardedResetResult>;
};

export type NativeMonetizationAdapters = {
  store?: NativeStoreAdapter;
  rewardedAds?: NativeRewardedAdAdapter;
};

export type RevenueCatLikeSdk = {
  configure?: (options: { apiKey: string }) => void | Promise<void>;
  purchaseProduct: (productId: string) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
};

export type AdMobRewardedBridge = {
  getAdPrivacyOptionsRequired?: () => Promise<boolean | null>;
  showAdPrivacyOptions?: (isCurrent?: () => boolean) => Promise<boolean>;
  createRewardedAd: (adUnitId: string, config: MonetizationConfig) => unknown;
  loadRewardedAd?: (ad: unknown, config: MonetizationConfig, isEligible?: () => boolean) => void;
  showRewardedAd: (
    ad: unknown,
    session: RewardedResetSession,
    config: MonetizationConfig,
    isEligible?: () => boolean,
    lifecycle?: RewardedPresentationLifecycle
  ) => Promise<boolean | { rewardGranted: boolean; message?: string; diagnostic?: RewardedDiagnosticReceipt }>;
  disposeRewardedAd?: (ad: unknown, session: RewardedResetSession, config: MonetizationConfig) => void;
};

export function activeEntitlementIdsFromRevenueCat(customerInfo: unknown): string[] {
  if (!customerInfo || typeof customerInfo !== "object") return [];
  const entitlements = (customerInfo as { entitlements?: unknown }).entitlements;
  if (!entitlements || typeof entitlements !== "object") return [];
  const active = (entitlements as { active?: unknown }).active;
  if (!active || typeof active !== "object" || Array.isArray(active)) return [];

  return Object.keys(active);
}

function customerInfoFromRevenueCatResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const customerInfo = (result as { customerInfo?: unknown }).customerInfo;
  return customerInfo ?? result;
}

export function createRevenueCatStoreAdapter(sdk: RevenueCatLikeSdk): NativeStoreAdapter {
  let configuredApiKey: string | null = null;

  async function ensureConfigured(config: MonetizationConfig) {
    if (!config.revenueCatApiKey) {
      throw new Error("RevenueCat API key is required for native purchases.");
    }

    if (sdk.configure && configuredApiKey !== config.revenueCatApiKey) {
      await sdk.configure({ apiKey: config.revenueCatApiKey });
      configuredApiKey = config.revenueCatApiKey;
    }
  }

  return {
    purchaseProduct: async (productId, config) => {
      await ensureConfigured(config);
      const result = await sdk.purchaseProduct(productId);
      const customerInfo = customerInfoFromRevenueCatResult(result);
      return {
        activeEntitlementIds: activeEntitlementIdsFromRevenueCat(customerInfo),
        raw: result
      };
    },
    restorePurchases: async (config) => {
      await ensureConfigured(config);
      const result = await sdk.restorePurchases();
      const customerInfo = customerInfoFromRevenueCatResult(result);
      return {
        activeEntitlementIds: activeEntitlementIdsFromRevenueCat(customerInfo),
        raw: result
      };
    }
  };
}

export function hasPremiumEntitlement(info: NativeEntitlementInfo, config: MonetizationConfig) {
  return (!info.purchaseStatus || info.purchaseStatus === "purchased") && info.activeEntitlementIds.includes(config.revenueCatEntitlementId);
}

function collectProductIds(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectProductIds(item, depth + 1));
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const productIds: string[] = [];
  for (const key of ["productIdentifier", "productId", "productID", "sku"]) {
    const productId = record[key];
    if (typeof productId === "string" && productId.trim()) productIds.push(productId.trim());
  }
  if (Array.isArray(record.productIds)) {
    productIds.push(...record.productIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") productIds.push(...collectProductIds(child, depth + 1));
  }

  return productIds;
}

function restoredPlanId(plans: PremiumPlan[], info: NativeEntitlementInfo) {
  const restoredProductIds = new Set(collectProductIds(info.raw));
  if (restoredProductIds.size > 0) {
    return plans.find((plan) => restoredProductIds.has(plan.productId))?.id ?? null;
  }
  return plans[0]?.id ?? null;
}

function purchasedResult(plan: PremiumPlan, config: MonetizationConfig, info: NativeEntitlementInfo): PurchaseResult {
  if (!hasPremiumEntitlement(info, config) || (info.purchaseStatus && info.purchaseStatus !== "purchased")) {
    return {
      status: info.purchaseStatus === "cancelled" ? "cancelled" : info.purchaseStatus === "pending" || info.purchaseStatus === "unavailable" ? "unavailable" : "failed",
      purchaseStatus: info.purchaseStatus ?? "failed",
      premium: false,
      provider: "native",
      message: info.message ?? (info.purchaseStatus === "pending" ? "The store purchase is pending. Premium activates after confirmation." : info.purchaseStatus === "cancelled" ? "Purchase cancelled." : "Premium could not be verified. Restore purchases or try again."),
      planId: plan.id
    };
  }

  return {
    status: "purchased",
    purchaseStatus: "purchased",
    premium: true,
    provider: "native",
    message: info.message ?? `${plan.label} premium is active.`,
    planId: plan.id,
    verifiedEntitlement: info.verifiedEntitlement
  };
}

function restoredResult(plans: PremiumPlan[], config: MonetizationConfig, info: NativeEntitlementInfo): PurchaseResult {
  if (!hasPremiumEntitlement(info, config) || (info.purchaseStatus && info.purchaseStatus !== "purchased")) {
    return {
      status: info.purchaseStatus === "cancelled" ? "cancelled" : info.purchaseStatus === "failed" ? "failed" : "unavailable",
      purchaseStatus: info.purchaseStatus ?? "unavailable",
      premium: false,
      provider: "native",
      message: info.message ?? "No active FREED premium entitlement was found.",
      planId: null
    };
  }

  const planId = restoredPlanId(plans, info);
  if (!planId) {
    return {
      status: "failed",
      premium: false,
      provider: "native",
      message: "Restored premium entitlement did not match a FREED launch product.",
      planId: null
    };
  }

  return {
    status: "purchased",
    purchaseStatus: "purchased",
    premium: true,
    provider: "native",
    message: "Premium entitlement restored.",
    planId,
    verifiedEntitlement: info.verifiedEntitlement
  };
}

export function createNativeMonetizationAdapter(adapters: NativeMonetizationAdapters): NativeMonetizationProvider {
  return {
    fetchStorePrices: adapters.store?.fetchStorePrices,
    getAdPrivacyOptionsRequired: adapters.rewardedAds?.getAdPrivacyOptionsRequired,
    showAdPrivacyOptions: adapters.rewardedAds?.showAdPrivacyOptions,
    purchasePremiumPlan: adapters.store
      ? async (plan, config) => purchasedResult(plan, config, await adapters.store!.purchaseProduct(plan.productId, config))
      : undefined,
    restorePremiumPurchases: adapters.store
      ? async (plans, config) => restoredResult(plans, config, await adapters.store!.restorePurchases(config))
      : undefined,
    createRewardedResetSession: adapters.rewardedAds
      ? (config) => adapters.rewardedAds?.createSession(config) ?? null
      : undefined,
    completeRewardedResetSession: adapters.rewardedAds
      ? async (session, config, isEligible, lifecycle) => {
          try {
            return await adapters.rewardedAds!.completeSession(session, config, isEligible, lifecycle);
          } catch {
            return {
              status: "fallback",
              rewardGranted: false,
              provider: "fallback",
              message: "Rewarded ads are unavailable. Retry later or open Basic help."
            };
          }
        }
      : undefined
  };
}

export function createAdMobRewardedAdapter(bridge: AdMobRewardedBridge): NativeRewardedAdAdapter {
  const activeAds = new Map<string, unknown>();

  return {
    getAdPrivacyOptionsRequired: bridge.getAdPrivacyOptionsRequired,
    showAdPrivacyOptions: bridge.showAdPrivacyOptions,
    createSession: (config) => {
      const adUnitId = config.rewardedResetPlacementId;
      if (!adUnitId) return null;

      try {
        setRewardedProviderDiagnostic(null);
        const ad = bridge.createRewardedAd(adUnitId, config);
        const id = `admob-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const session: RewardedResetSession = {
          id,
          provider: "native",
          status: "ready",
          durationSeconds: 1,
          placementId: adUnitId,
          message: "Rewarded reset ad is ready.",
          metadata: {
            adMob: true,
            testMode: config.allowTestAds,
            adRequestCountryCode: config.adRequestCountryCode ?? "auto"
          }
        };
        activeAds.set(id, ad);
        return session;
      } catch (error) {
        setRewardedProviderDiagnostic({ stage: 'factory', failure: 'native-error', nativeCode: rewardedNativeCode(error) });
        return null;
      }
    },
    completeSession: async (session, config, isEligible, lifecycle) => {
      const ad = activeAds.get(session.id);
      if (!ad) {
        return {
          status: "fallback",
          rewardGranted: false,
          provider: "fallback",
          message: "Rewarded ads are unavailable. Retry later or open Basic help."
        };
      }

      try {
        bridge.loadRewardedAd?.(ad, config, isEligible);
        const result = await bridge.showRewardedAd(ad, session, config, isEligible, lifecycle);
        const rewardGranted = typeof result === "boolean" ? result : result.rewardGranted;
        return {
          diagnostic: typeof result === "object" ? result.diagnostic : undefined,
          status: rewardGranted ? "completed" : "failed",
          rewardGranted,
          provider: "native",
          message:
            typeof result === "object" && result.message
              ? result.message
              : rewardGranted
                ? "Rewarded reset completed."
                : "Rewarded ad closed before completion."
        };
      } finally {
        activeAds.delete(session.id);
        bridge.disposeRewardedAd?.(ad, session, config);
      }
    }
  };
}
