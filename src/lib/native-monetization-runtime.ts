import {
  configureNativeMonetizationProvider,
  getMonetizationConfig,
  type MonetizationPlatform
} from "@/lib/monetization";
import {
  createAdMobRewardedAdapter,
  createNativeMonetizationAdapter,
  createRevenueCatStoreAdapter,
  type AdMobRewardedBridge,
  type RevenueCatLikeSdk
} from "@/lib/native-monetization-adapter";
import {
  createNativeIapStoreAdapter,
  expoIapModuleFromImport,
  type ExpoIapModule
} from "@/lib/native-iap-adapter";

type ModuleLoader = (specifier: string) => Promise<unknown>;

type RewardedAdRuntime = {
  ad: {
    loaded?: boolean;
    load?: () => void;
    show?: () => Promise<void>;
    addAdEventListener?: (type: string, listener: (...args: unknown[]) => void) => (() => void) | void;
    removeAllListeners?: () => void;
  };
  loaded: boolean;
  rewardGranted: boolean;
  disposers: Array<() => void>;
};

const optionalImport: ModuleLoader = (specifier) => new Function("specifier", "return import(specifier)")(
  specifier
) as Promise<unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFunction<T extends (...args: never[]) => unknown>(value: unknown): T | null {
  return typeof value === "function" ? (value as T) : null;
}

function getPlatform(platform?: MonetizationPlatform): MonetizationPlatform {
  if (platform) return platform;
  const expoOS = process.env.EXPO_OS;
  if (expoOS === "ios" || expoOS === "android" || expoOS === "web") return expoOS;
  return "unknown";
}

function revenueCatSdkFromModule(moduleValue: unknown): RevenueCatLikeSdk | null {
  const record = asRecord(moduleValue);
  const candidate = asRecord(record?.default) ?? asRecord(record?.Purchases) ?? record;
  if (!candidate) return null;
  const configure = asFunction<(options: { apiKey: string }) => void | Promise<void>>(candidate.configure);
  const purchaseProduct = asFunction<(productId: string) => Promise<unknown>>(candidate.purchaseProduct);
  const restorePurchases = asFunction<() => Promise<unknown>>(candidate.restorePurchases);
  if (!purchaseProduct || !restorePurchases) return null;

  return {
    configure: configure ? (options) => Promise.resolve(configure(options)) : undefined,
    purchaseProduct: (productId) => Promise.resolve(purchaseProduct(productId)),
    restorePurchases: () => Promise.resolve(restorePurchases())
  };
}

function waitForRewardedLoad(entry: RewardedAdRuntime, timeoutMs = 10_000) {
  if (entry.loaded || entry.ad.loaded) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    const loadedDisposer = entry.ad.addAdEventListener?.("rewarded_loaded", () => {
      entry.loaded = true;
      clearTimeout(timeout);
      resolve(true);
    });
    const errorDisposer = entry.ad.addAdEventListener?.("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });

    if (typeof loadedDisposer === "function") entry.disposers.push(loadedDisposer);
    if (typeof errorDisposer === "function") entry.disposers.push(errorDisposer);
  });
}

function adMobBridgeFromModule(moduleValue: unknown): AdMobRewardedBridge | null {
  const record = asRecord(moduleValue);
  const rewardedAd = asRecord(record?.RewardedAd);
  const createForAdRequest = asFunction<(adUnitId: string, requestOptions?: Record<string, unknown>) => unknown>(
    rewardedAd?.createForAdRequest
  );
  const testIds = asRecord(record?.TestIds);
  if (!createForAdRequest) return null;

  return {
    createRewardedAd: (adUnitId, config) => {
      const resolvedAdUnit = config.allowTestAds && typeof testIds?.REWARDED === "string" ? testIds.REWARDED : adUnitId;
      const ad = createForAdRequest(resolvedAdUnit, {
        requestNonPersonalizedAdsOnly: true
      });
      const adRecord = asRecord(ad);
      if (!adRecord || typeof adRecord.load !== "function" || typeof adRecord.show !== "function") {
        throw new Error("AdMob rewarded ad did not expose load/show methods.");
      }

      return {
        ad: adRecord as RewardedAdRuntime["ad"],
        loaded: Boolean(adRecord.loaded),
        rewardGranted: false,
        disposers: []
      } satisfies RewardedAdRuntime;
    },
    loadRewardedAd: (ad) => {
      const entry = ad as RewardedAdRuntime;
      const loadedDisposer = entry.ad.addAdEventListener?.("rewarded_loaded", () => {
        entry.loaded = true;
      });
      const rewardDisposer = entry.ad.addAdEventListener?.("rewarded_earned_reward", () => {
        entry.rewardGranted = true;
      });
      if (typeof loadedDisposer === "function") entry.disposers.push(loadedDisposer);
      if (typeof rewardDisposer === "function") entry.disposers.push(rewardDisposer);
      entry.ad.load?.();
    },
    showRewardedAd: async (ad) => {
      const entry = ad as RewardedAdRuntime;
      const loaded = await waitForRewardedLoad(entry);
      if (!loaded) return { rewardGranted: false, message: "Rewarded ad did not load in time." };

      return new Promise((resolve) => {
        let settled = false;
        const settle = (rewardGranted: boolean, message: string) => {
          if (settled) return;
          settled = true;
          resolve({ rewardGranted, message });
        };

        const closedDisposer = entry.ad.addAdEventListener?.("closed", () => {
          settle(entry.rewardGranted, entry.rewardGranted ? "Rewarded reset completed." : "Rewarded ad closed before completion.");
        });
        const errorDisposer = entry.ad.addAdEventListener?.("error", () => {
          settle(false, "Rewarded ad failed before completion.");
        });
        if (typeof closedDisposer === "function") entry.disposers.push(closedDisposer);
        if (typeof errorDisposer === "function") entry.disposers.push(errorDisposer);

        entry.ad.show?.().catch(() => settle(false, "Rewarded ad could not be shown."));
        setTimeout(() => settle(entry.rewardGranted, entry.rewardGranted ? "Rewarded reset completed." : "Rewarded ad timed out."), 30_000);
      });
    },
    disposeRewardedAd: (ad) => {
      const entry = ad as RewardedAdRuntime;
      entry.disposers.splice(0).forEach((dispose) => dispose());
      entry.ad.removeAllListeners?.();
    }
  };
}

export async function createNativeSdkMonetizationProvider(
  options: { loader?: ModuleLoader; platform?: MonetizationPlatform } = {}
) {
  const platform = getPlatform(options.platform);
  if (platform !== "ios" && platform !== "android") return null;

  const loader = options.loader ?? optionalImport;
  // Prefer expo-iap (StoreKit 2 / Google Play Billing v6+) — it is the
  // Apple/Google-native path with no third-party entitlement vendor.
  // Fall back to the RevenueCat adapter only if expo-iap is not installed.
  const [expoIapModule, revenueCatModule, adMobModule] = await Promise.all([
    loader("expo-iap").catch(() => null),
    loader("react-native-purchases").catch(() => null),
    loader("react-native-google-mobile-ads").catch(() => null)
  ]);

  let store = null as ReturnType<typeof createNativeIapStoreAdapter> | ReturnType<typeof createRevenueCatStoreAdapter> | null;
  const expoIap: ExpoIapModule | null = expoIapModuleFromImport(expoIapModule);
  if (expoIap) {
    store = createNativeIapStoreAdapter(expoIap);
  }
  if (!store) {
    const revenueCatSdk = revenueCatSdkFromModule(revenueCatModule);
    if (revenueCatSdk) store = createRevenueCatStoreAdapter(revenueCatSdk);
  }

  const rewardedAds = adMobBridgeFromModule(adMobModule);

  if (!store && !rewardedAds) return null;
  return createNativeMonetizationAdapter({
    store: store ?? undefined,
    rewardedAds: rewardedAds ? createAdMobRewardedAdapter(rewardedAds) : undefined
  });
}

export async function configureNativeMonetizationRuntime(
  options: { loader?: ModuleLoader; platform?: MonetizationPlatform } = {}
) {
  const platform = getPlatform(options.platform);
  const config = getMonetizationConfig({ platform });
  if (config.mode !== "native") return false;

  const provider = await createNativeSdkMonetizationProvider({ loader: options.loader, platform });
  configureNativeMonetizationProvider(provider);
  return Boolean(provider);
}
