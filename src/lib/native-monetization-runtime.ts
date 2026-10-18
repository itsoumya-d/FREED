import { consentDiagnostic, createRewardedDiagnosticReceipt, rewardedNativeCode, setRewardedProviderDiagnostic } from './rewarded-ad-diagnostics';
import type { RewardedPresentationLifecycle } from './monetization';
import {
  configureNativeMonetizationProvider,
  configureNativeMonetizationPending,
  configureRewardedProviderRetry,
  getMonetizationConfig,
  isRewardedAdSdkConfigured,
  type MonetizationConfig,
  type MonetizationPlatform
} from "@/lib/monetization";
import { loadNativeMonetizationModule } from "@/lib/native-monetization-loader";
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
  type ExpoIapModule,
  type NativeIapPurchaseVerifier
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
  presented: boolean;
  disposers: Array<() => void>;

};

// Metro resolves native-monetization-loader.native.ts on iOS/Android, where every
// SDK specifier is a literal import(). Web and Node tests get the null loader.
const defaultLoader: ModuleLoader = (specifier) => loadNativeMonetizationModule(specifier);
const nativeIapAdapters = new WeakMap<ExpoIapModule, {
  adapter: NonNullable<ReturnType<typeof createNativeIapStoreAdapter>>;
  verifier: NativeIapPurchaseVerifier | undefined;
  checkoutContext: (() => Promise<{ appAccountToken: string; obfuscatedAccountId: string }>) | undefined;
}>();

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

/** Cached successful consent, retryable failures and one initialization. Privacy changes invalidate consent. */
export function createAdMobPreparation(record: Record<string, unknown> | null) {
  const adsConsent = asRecord(record?.AdsConsent);
  const gatherConsent = asFunction<() => Promise<unknown>>(adsConsent?.gatherConsent);
  const update = asFunction<() => Promise<unknown>>(adsConsent?.requestInfoUpdate);
  const form = asFunction<() => Promise<unknown>>(adsConsent?.loadAndShowConsentFormIfRequired);
  const currentInfo = asFunction<() => Promise<unknown>>(adsConsent?.getConsentInfo);
  const mobileAdsFactory = asFunction<() => unknown>(record?.default) ?? asFunction<() => unknown>(record?.mobileAds);
  let prepared: Promise<boolean> | null = null;
  let initialized = false;
  const prepare = (lifecycle?: RewardedPresentationLifecycle) => {
    if (!prepared) {
      const pending = (async () => {
        const current = () => lifecycle?.isPreparationCurrent?.() !== false;
        let info: unknown;
        let stage: 'consent-update' | 'consent-form' = 'consent-update';
        try {
          if (!current()) return false;
          lifecycle?.onDiagnostic?.({ stage });
          if (update && form) {
            info = await update.call(adsConsent);
            lifecycle?.onDiagnostic?.({ stage, ...consentDiagnostic(info) });
            if (!current()) return false;
            stage = 'consent-form';
            lifecycle?.onDiagnostic?.({ stage });
            lifecycle?.onConsentForm?.(true);
            let returned = true;
            try { info = await form.call(adsConsent); }
            finally {
              returned = await lifecycle?.afterConsentForm?.() ?? true;
              lifecycle?.onConsentForm?.(false);
            }
            if (!returned) { lifecycle?.onDiagnostic?.({ stage, failure: 'cancelled' }); return false; }
          } else if (gatherConsent) info = await gatherConsent.call(adsConsent);
          else { lifecycle?.onDiagnostic?.({ stage, failure: 'unavailable' }); return false; }
          lifecycle?.onDiagnostic?.({ stage, ...consentDiagnostic(info) });
        } catch (error) {
          lifecycle?.onDiagnostic?.({ stage, failure: 'native-error', nativeCode: rewardedNativeCode(error) });
          // Only UMP's current native truth can authorize ads after an update/form error.
          try {
            info = currentInfo ? await currentInfo.call(adsConsent) : null;
            lifecycle?.onDiagnostic?.({ stage: 'consent-current', ...consentDiagnostic(info) });
          } catch (error) {
            lifecycle?.onDiagnostic?.({ stage: 'consent-current', failure: 'native-error', nativeCode: rewardedNativeCode(error) });
            return false;
          }
        }
        if (asRecord(info)?.canRequestAds !== true) {
          lifecycle?.onDiagnostic?.({ stage: 'consent-current', failure: 'not-permitted', ...consentDiagnostic(info) });
          return false;
        }
        if (!current()) return false;
        if (!mobileAdsFactory) { lifecycle?.onDiagnostic?.({ stage: 'sdk-init', failure: 'unavailable' }); return false; }
        if (!initialized) {
          try {
            lifecycle?.onDiagnostic?.({ stage: 'sdk-init' });
            const instance = asRecord(mobileAdsFactory());
            const initialize = asFunction<() => Promise<unknown>>(instance?.initialize);
            if (!initialize) { lifecycle?.onDiagnostic?.({ stage: 'sdk-init', failure: 'unavailable' }); return false; }
            const statuses = await initialize.call(instance);
            initialized = true;
            lifecycle?.onDiagnostic?.({ stage: 'sdk-init', ...(Array.isArray(statuses) ? { adaptersReady: statuses.length > 0 && statuses.every(status => asRecord(status)?.state === 1) } : {}) });
          } catch (error) {
            lifecycle?.onDiagnostic?.({ stage: 'sdk-init', failure: 'native-error', nativeCode: rewardedNativeCode(error) });
            return false;
          }
        }
        return true;
      })();
      prepared = pending;
      void pending.then(allowed => { if (!allowed && prepared === pending) prepared = null; }, () => { if (prepared === pending) prepared = null; });
    }
    return prepared;
  };
  return Object.assign(prepare, { invalidate: () => { prepared = null; } });
}

function adMobBridgeFromModule(moduleValue: unknown): AdMobRewardedBridge | null {
  const record = asRecord(moduleValue);
  // Invertase exports a class with static methods. A function-valued class
  // namespace is valid here; it is never instantiated or invoked as a factory.
  const rewardedAd = typeof record?.RewardedAd === "function"
    ? record.RewardedAd as unknown as Record<string, unknown>
    : asRecord(record?.RewardedAd);
  const createForAdRequest = asFunction<(adUnitId: string, requestOptions?: Record<string, unknown>) => unknown>(
    rewardedAd?.createForAdRequest
  );
  const testIds = asRecord(record?.TestIds);
  if (!createForAdRequest) return null;
  const prepareAds = createAdMobPreparation(record);

  return {
    createRewardedAd: (adUnitId, config) => {
      // Recheck at every request: a cached adapter cannot bypass production gates.
      if (!isRewardedAdSdkConfigured(config)) throw new Error("Rewarded ads are unavailable for this build configuration.");
      if (config.allowTestAds && typeof testIds?.REWARDED !== "string") throw new Error("The native ad SDK did not expose its rewarded test unit.");
      const resolvedAdUnit = config.allowTestAds ? testIds!.REWARDED as string : adUnitId;
      const ad = createForAdRequest(resolvedAdUnit, {
        requestNonPersonalizedAdsOnly: true,
        // Google's creative selector only applies to Google test queries.
        // Derive it per request so a cached internal adapter never adds it to live ads.
        ...(config.allowTestAds ? { networkExtras: { ft_ctype: 'video_app_install' } } : {})
      });
      const adRecord = asRecord(ad);
      if (!adRecord || typeof adRecord.load !== "function" || typeof adRecord.show !== "function") {
        throw new Error("AdMob rewarded ad did not expose load/show methods.");
      }

      return {
        ad: adRecord as RewardedAdRuntime["ad"],
        loaded: Boolean(adRecord.loaded),
        rewardGranted: false,
        presented: false,
        disposers: []
      } satisfies RewardedAdRuntime;
    },
    getAdPrivacyOptionsRequired: async () => {
      const consent = asRecord(record?.AdsConsent);
      const info = asFunction<() => Promise<unknown>>(consent?.getConsentInfo);
      try { const status = asRecord(await info?.call(consent))?.privacyOptionsRequirementStatus; return status === 'REQUIRED' ? true : status === 'NOT_REQUIRED' ? false : null; }
      catch { return null; }
    },
    showAdPrivacyOptions: async (isCurrent = () => true) => {
      const consent = asRecord(record?.AdsConsent);
      const show = asFunction<() => Promise<unknown>>(consent?.showPrivacyOptionsForm);
      const info = asFunction<() => Promise<unknown>>(consent?.getConsentInfo);
      try {
        if (!isCurrent() || !show || asRecord(await info?.call(consent))?.privacyOptionsRequirementStatus !== 'REQUIRED' || !isCurrent()) return false;
        prepareAds.invalidate();
        await show.call(consent);
        return true;
      } catch { return false; }
      finally { prepareAds.invalidate(); }
    },
    showRewardedAd: async (ad, _session, _config, isEligible = () => true, lifecycle) => {
      const entry = ad as RewardedAdRuntime;
      const receipt = createRewardedDiagnosticReceipt();
      const recordEvent: NonNullable<RewardedPresentationLifecycle['onDiagnostic']> = event => {
        receipt.record(event); lifecycle?.onDiagnostic?.(event);
      };
      const fail = (message: string) => ({ rewardGranted: false, message, diagnostic: receipt.read() });
      const preparationCurrent = () => lifecycle?.isPreparationCurrent?.() ?? isEligible();
      if (!preparationCurrent()) { recordEvent({ stage: 'provider', failure: 'cancelled' }); return fail('Ad request cancelled.'); }
      const canRequestAds = await prepareAds({ onPresenting: () => {}, onDismissed: () => {}, ...lifecycle, onDiagnostic: recordEvent, isPreparationCurrent: preparationCurrent });
      if (!canRequestAds) return fail('Ads are unavailable. Retry later or open Basic help.');
      if (!preparationCurrent()) { recordEvent({ stage: 'fresh-access', failure: 'cancelled' }); return fail('Ad request cancelled.'); }
      if (lifecycle?.beforeLoad && !await lifecycle.beforeLoad()) return fail('Access could not be verified.');
      if (!isEligible()) { recordEvent({ stage: 'load', failure: 'cancelled' }); return fail('Ad request cancelled.'); }
      const loaded = await new Promise<boolean>(resolve => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const finish = (ok: boolean) => { if (settled) return; settled = true; if (timeout) clearTimeout(timeout); resolve(ok); };
        const listen = (event: string, callback: (...args: unknown[]) => void) => {
          const dispose = entry.ad.addAdEventListener?.(event, callback);
          if (typeof dispose === 'function') entry.disposers.push(dispose);
        };
        listen('rewarded_loaded', () => { if (settled) return; entry.loaded = true; recordEvent({ stage: 'loaded' }); finish(true); });
        listen('error', error => { if (settled) return; recordEvent({ stage: 'load', failure: 'native-error', nativeCode: rewardedNativeCode(error) }); finish(false); });
        listen('rewarded_earned_reward', () => {
          if (entry.presented && isEligible()) { entry.rewardGranted = true; recordEvent({ stage: 'earned' }); }
        });
        timeout = setTimeout(() => { recordEvent({ stage: 'load', failure: 'timeout' }); finish(false); }, 10_000);
        recordEvent({ stage: 'load', eligible: isEligible() });
        try { entry.ad.load?.(); }
        catch (error) { recordEvent({ stage: 'load', failure: 'native-error', nativeCode: rewardedNativeCode(error) }); finish(false); }
      });
      if (!loaded) return fail('Rewarded ad could not load. Retry later or open Basic help.');
      if (!isEligible()) { recordEvent({ stage: 'show', failure: 'cancelled' }); return fail('Ad request cancelled.'); }
      return new Promise<{ rewardGranted: boolean; message: string; diagnostic: ReturnType<typeof receipt.read> }>(resolve => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const settle = (rewardGranted: boolean, message: string) => {
          if (settled) return;
          settled = true;
          if (timeout !== undefined) clearTimeout(timeout);
          const accepted = rewardGranted && isEligible();
          entry.presented = false;
          lifecycle?.onDismissed();
          resolve({ rewardGranted: accepted, message, diagnostic: receipt.read() });
        };
        const listen = (event: string, callback: (...args: unknown[]) => void) => {
          const dispose = entry.ad.addAdEventListener?.(event, callback);
          if (typeof dispose === 'function') entry.disposers.push(dispose);
        };
        listen('opened', () => { if (!settled) recordEvent({ stage: 'opened' }); });
        listen('closed', () => {
          if (settled) return;
          recordEvent({ stage: 'closed', ...(!entry.rewardGranted ? { failure: 'skipped' as const } : {}) });
          settle(entry.rewardGranted, entry.rewardGranted ? 'Rewarded reset completed.' : 'Rewarded ad closed before completion.');
        });
        const showError = (error: unknown) => {
          if (settled) return;
          recordEvent({ stage: 'show', failure: 'native-error', nativeCode: rewardedNativeCode(error) });
          settle(false, 'Rewarded ad could not be shown.');
        };
        listen('error', showError);
        timeout = setTimeout(() => { recordEvent({ stage: 'show', failure: 'timeout' }); settle(false, 'Rewarded ad timed out.'); }, 120_000);
        if (!isEligible()) { recordEvent({ stage: 'show', failure: 'cancelled' }); settle(false, 'Ad request cancelled.'); return; }
        entry.presented = true;
        lifecycle?.onPresenting();
        recordEvent({ stage: 'show', eligible: isEligible() });
        try { entry.ad.show?.().catch(showError); } catch (error) { showError(error); }
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
  options: {
    loader?: ModuleLoader;
    platform?: MonetizationPlatform;
    verifyStorePurchase?: NativeIapPurchaseVerifier;
    getCheckoutContext?: () => Promise<{ appAccountToken: string; obfuscatedAccountId: string }>;
    config?: MonetizationConfig;
  } = {}
) {
  const platform = getPlatform(options.platform);
  if (platform !== "ios" && platform !== "android") return null;

  const config: MonetizationConfig = options.config ?? getMonetizationConfig({ platform });
  const loader = options.loader ?? defaultLoader;
  // Prefer expo-iap (StoreKit 2 / Google Play Billing) with FREED's server
  // verification. RevenueCat trusts client-side entitlements, so it is only
  // loaded when a build explicitly opts into EXPO_PUBLIC_STORE_PROVIDER=revenuecat.
  // The ads SDK is only loaded when this build has a usable AdMob configuration:
  // the Google Mobile Ads SDK aborts when initialized without a valid app ID.
  const wantsRevenueCat = config.storeProvider === "revenuecat";
  const wantsAds = isRewardedAdSdkConfigured(config);
  let adImportFailed = false;
  setRewardedProviderDiagnostic(wantsAds ? null : { stage: 'configuration', failure: 'unavailable' });
  const [expoIapModule, revenueCatModule, adMobModule] = await Promise.all([
    wantsRevenueCat ? Promise.resolve(null) : loader("expo-iap").catch(() => null),
    wantsRevenueCat ? loader("react-native-purchases").catch(() => null) : Promise.resolve(null),
    wantsAds ? loader("react-native-google-mobile-ads").catch(() => { adImportFailed = true; return null; }) : Promise.resolve(null)
  ]);

  let store = null as ReturnType<typeof createNativeIapStoreAdapter> | ReturnType<typeof createRevenueCatStoreAdapter> | null;
  const expoIap: ExpoIapModule | null = expoIapModuleFromImport(expoIapModule);
  if (expoIap) {
    const cached = nativeIapAdapters.get(expoIap);
    if (cached && cached.verifier === options.verifyStorePurchase && cached.checkoutContext === options.getCheckoutContext) {
      store = cached.adapter;
    } else {
      cached?.adapter.dispose?.();
      store = createNativeIapStoreAdapter(expoIap, options.verifyStorePurchase, { getCheckoutContext: options.getCheckoutContext });
      if (store) nativeIapAdapters.set(expoIap, { adapter: store, verifier: options.verifyStorePurchase, checkoutContext: options.getCheckoutContext });
    }
  }
  if (!store && wantsRevenueCat) {
    const revenueCatSdk = revenueCatSdkFromModule(revenueCatModule);
    if (revenueCatSdk) store = createRevenueCatStoreAdapter(revenueCatSdk);
  }

  const rewardedAds = adMobBridgeFromModule(adMobModule);
  if (wantsAds && !rewardedAds) setRewardedProviderDiagnostic({ stage: adImportFailed ? 'module-import' : 'module-shape', failure: 'unavailable' });

  if (!store && !rewardedAds) return null;
  return createNativeMonetizationAdapter({
    store: store ?? undefined,
    rewardedAds: rewardedAds ? createAdMobRewardedAdapter(rewardedAds) : undefined
  });
}

export async function configureNativeMonetizationRuntime(
  options: {
    loader?: ModuleLoader;
    platform?: MonetizationPlatform;
    verifyStorePurchase?: NativeIapPurchaseVerifier;
    getCheckoutContext?: () => Promise<{ appAccountToken: string; obfuscatedAccountId: string }>;
  } = {}
) {
  const platform = getPlatform(options.platform);
  const config = getMonetizationConfig({ platform });
  if (config.mode !== "native") return false;

  configureRewardedProviderRetry(() => configureNativeMonetizationRuntime(options));
  const pending = createNativeSdkMonetizationProvider({
    loader: options.loader,
    platform,
    verifyStorePurchase: options.verifyStorePurchase,
    getCheckoutContext: options.getCheckoutContext,
    config
  });
  configureNativeMonetizationPending(pending);
  const provider = await pending;
  configureNativeMonetizationProvider(provider);
  return Boolean(provider);
}
