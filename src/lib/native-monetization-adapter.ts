import {
  MonetizationConfig,
  NativeMonetizationProvider,
  PremiumPlan,
  PurchaseResult,
  RewardedResetResult,
  RewardedResetSession
} from "@/lib/monetization";

export type NativeEntitlementInfo = {
  activeEntitlementIds: string[];
  raw?: unknown;
};

export type NativeStoreAdapter = {
  purchaseProduct: (productId: string, config: MonetizationConfig) => Promise<NativeEntitlementInfo>;
  restorePurchases: (config: MonetizationConfig) => Promise<NativeEntitlementInfo>;
};

export type NativeRewardedAdAdapter = {
  createSession: (config: MonetizationConfig) => RewardedResetSession | null;
  completeSession: (session: RewardedResetSession, config: MonetizationConfig) => Promise<RewardedResetResult>;
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
  createRewardedAd: (adUnitId: string, config: MonetizationConfig) => unknown;
  loadRewardedAd?: (ad: unknown, config: MonetizationConfig) => void;
  showRewardedAd: (
    ad: unknown,
    session: RewardedResetSession,
    config: MonetizationConfig
  ) => Promise<boolean | { rewardGranted: boolean; message?: string }>;
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
  return info.activeEntitlementIds.includes(config.revenueCatEntitlementId);
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
  if (!hasPremiumEntitlement(info, config)) {
    return {
      status: "failed",
      premium: false,
      provider: "native",
      message: "Purchase completed, but the premium entitlement was not active.",
      planId: plan.id
    };
  }

  return {
    status: "purchased",
    premium: true,
    provider: "native",
    message: `${plan.label} premium is active.`,
    planId: plan.id
  };
}

function restoredResult(plans: PremiumPlan[], config: MonetizationConfig, info: NativeEntitlementInfo): PurchaseResult {
  if (!hasPremiumEntitlement(info, config)) {
    return {
      status: "unavailable",
      premium: false,
      provider: "native",
      message: "No active FREED premium entitlement was found.",
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
    premium: true,
    provider: "native",
    message: "Premium entitlement restored.",
    planId
  };
}

export function createNativeMonetizationAdapter(adapters: NativeMonetizationAdapters): NativeMonetizationProvider {
  return {
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
      ? async (session, config) => {
          try {
            return await adapters.rewardedAds!.completeSession(session, config);
          } catch {
            return {
              status: "fallback",
              rewardGranted: true,
              provider: "fallback",
              message: "Rewarded ad provider failed. Recovery challenge unlocked without an ad."
            };
          }
        }
      : undefined
  };
}

export function createAdMobRewardedAdapter(bridge: AdMobRewardedBridge): NativeRewardedAdAdapter {
  const activeAds = new Map<string, unknown>();

  return {
    createSession: (config) => {
      const adUnitId = config.rewardedResetPlacementId;
      if (!adUnitId) return null;

      try {
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
        bridge.loadRewardedAd?.(ad, config);
        return session;
      } catch {
        return null;
      }
    },
    completeSession: async (session, config) => {
      const ad = activeAds.get(session.id);
      if (!ad) {
        return {
          status: "fallback",
          rewardGranted: true,
          provider: "fallback",
          message: "Rewarded ad session was unavailable. Recovery challenge unlocked without an ad."
        };
      }

      try {
        const result = await bridge.showRewardedAd(ad, session, config);
        const rewardGranted = typeof result === "boolean" ? result : result.rewardGranted;
        return {
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
