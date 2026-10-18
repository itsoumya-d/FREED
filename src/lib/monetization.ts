import { getRewardedProviderDiagnostic } from './rewarded-ad-diagnostics';
import type { RewardedDiagnosticInput, RewardedDiagnosticReceipt } from './rewarded-ad-diagnostics';
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { safeUserFacingMessage } from "@/lib/user-facing-error";
import { readClientEnvironmentValue } from "@/lib/public-client-env";
import type { StoreProductPrice } from "@/lib/store-pricing";
import type { VerifiedPremiumEntitlement } from "@/lib/premium-entitlement";

export type PremiumPlanId = "yearly" | "monthly" | "lifetime" | "family" | "accountability" | "ai-coach";
export const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "monthly"] as const satisfies readonly PremiumPlanId[];
export type LaunchPremiumPlanId = (typeof LAUNCH_PREMIUM_PLAN_IDS)[number];
export type PremiumPlanAudience = "individual" | "family" | "accountability" | "coaching";
export type MonetizationMode = "mock" | "native";
export type MonetizationPlatform = "ios" | "android" | "web" | "unknown";
export type MonetizationProvider = "mock" | "native" | "fallback";

export type PremiumCapabilitySet = {
  noAds: boolean;
  premiumChallenges: boolean;
  advancedAnalytics: boolean;
  advancedAiCoach: boolean;
  customChallenges: boolean;
  sponsorAccountability: boolean;
  familySupport: boolean;
  relapsePrediction: boolean;
  deepRecoveryReports: boolean;
};

export type PremiumPlan = {
  id: PremiumPlanId;
  label: string;
  price: string;
  sub: string;
  badge: string;
  productId: string;
  audience: PremiumPlanAudience;
};

export type LaunchPremiumPlanEconomics = {
  planId: LaunchPremiumPlanId;
  grossUsd: number;
  estimatedNetUsdAt30PercentStoreFee: number;
  estimatedNetUsdAt15PercentStoreFee: number;
  monthlyEquivalentGrossUsd: number | null;
  annualizedGrossUsd: number | null;
  discountVsMonthlyPercent: number | null;
  breakevenMonthsVsMonthly?: number;
  breakevenYearsVsYearly?: number;
  profitabilityRole: "entry-recurring" | "primary-value" | "cashflow-anchor";
};

export type PurchaseResult = {
  status: "purchased" | "cancelled" | "unavailable" | "failed";
  premium: boolean;
  provider: MonetizationProvider;
  message: string;
  planId: PremiumPlanId | null;
  verifiedEntitlement?: VerifiedPremiumEntitlement;
  purchaseStatus?: "purchased" | "pending" | "cancelled" | "failed" | "unavailable";
};

export type RewardedResetSession = {
  diagnostic?: RewardedDiagnosticReceipt;
  id: string;
  provider: MonetizationProvider;
  status: "ready" | "fallback";
  durationSeconds: number;
  message: string;
  placementId?: string;
  metadata?: Record<string, boolean | number | string>;
};

export type RewardedPresentationLifecycle = {
  onPresenting: () => void;
  onDismissed: () => void;
  /** Consent preparation never authorizes loading. Recheck fresh authority afterwards. */
  beforeLoad?: () => Promise<boolean>;
  isPreparationCurrent?: () => boolean;
  onConsentForm?: (presenting: boolean) => void;
  afterConsentForm?: () => Promise<boolean>;
  onDiagnostic?: (event: RewardedDiagnosticInput) => void;
};

export type RewardedResetResult = {
  diagnostic?: RewardedDiagnosticReceipt;
  status: "completed" | "fallback" | "failed";
  rewardGranted: boolean;
  provider: MonetizationProvider;
  message: string;
};

export type StoreProvider = "native-iap" | "revenuecat";

export type MonetizationConfig = {
  mode: MonetizationMode;
  platform: MonetizationPlatform;
  storeProvider: StoreProvider;
  /** Legacy name. With `storeProvider=native-iap` this can stay null. */
  revenueCatApiKey: string | null;
  /** Premium entitlement identifier used by both RevenueCat and the server verify endpoint. */
  revenueCatEntitlementId: string;
  purchaseVerifyEndpoint: string | null;
  admobAppId: string | null;
  rewardedResetPlacementId: string | null;
  adRequestCountryCode: string | null;
  allowTestAds: boolean;
  /** Bundled build input; internal-testflight permits real SDK sample ads only. */
  buildChannel?: string;
  productIds: Record<PremiumPlanId, string>;
  launchProductIds: Record<LaunchPremiumPlanId, string>;
};

export type MonetizationReadiness = {
  status: "mock" | "ready" | "missing-provider" | "missing-config";
  mode: MonetizationMode;
  platform: MonetizationPlatform;
  missing: string[];
  revenueCatApiKeyConfigured: boolean;
  revenueCatEntitlementId: string;
  purchaseVerifyEndpointConfigured: boolean;
  admobAppIdConfigured: boolean;
  rewardedResetPlacementId: string | null;
  adRequestCountryCode: string | null;
  allowTestAds: boolean;
  productIds: Record<PremiumPlanId, string>;
  launchProductIds: Record<LaunchPremiumPlanId, string>;
};

export type NativeMonetizationProvider = {
  fetchStorePrices?: (config: MonetizationConfig) => Promise<StoreProductPrice[]>;
  purchasePremiumPlan?: (plan: PremiumPlan, config: MonetizationConfig) => Promise<PurchaseResult>;
  restorePremiumPurchases?: (plans: PremiumPlan[], config: MonetizationConfig) => Promise<PurchaseResult>;
  getAdPrivacyOptionsRequired?: () => Promise<boolean | null>;
  showAdPrivacyOptions?: (isCurrent?: () => boolean) => Promise<boolean>;
  createRewardedResetSession?: (config: MonetizationConfig) => RewardedResetSession | null;
  completeRewardedResetSession?: (session: RewardedResetSession, config: MonetizationConfig, isEligible?: () => boolean, lifecycle?: RewardedPresentationLifecycle) => Promise<RewardedResetResult>;
};

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: "yearly",
    label: "Annual",
    price: "$3.33/mo",
    sub: "$39.99 billed yearly",
    badge: "Save 67%",
    productId: "freed_premium_yearly",
    audience: "individual"
  },
  {
    id: "monthly",
    label: "Monthly",
    price: "$9.99/mo",
    sub: "Flexible monthly plan",
    badge: "Popular",
    productId: "freed_premium_monthly",
    audience: "individual"
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: "$79.99",
    sub: "One-time recovery access",
    badge: "Best trust",
    productId: "freed_premium_lifetime",
    audience: "individual"
  },
  {
    id: "family",
    label: "Family",
    price: "$7.49/mo",
    sub: "$89.99 billed yearly for household recovery support",
    badge: "Family",
    productId: "freed_family_yearly",
    audience: "family"
  },
  {
    id: "accountability",
    label: "Accountability",
    price: "$14.99/mo",
    sub: "Premium plus sponsor and partner workflows",
    badge: "Partner",
    productId: "freed_accountability_monthly",
    audience: "accountability"
  },
  {
    id: "ai-coach",
    label: "AI Coach",
    price: "$19.99/mo",
    sub: "Advanced CLARA coaching and deep recovery reports",
    badge: "Coach",
    productId: "freed_ai_coach_monthly",
    audience: "coaching"
  }
];

export const LAUNCH_PREMIUM_PLAN_ECONOMICS = {
  schemaVersion: "freed-launch-economics-v1",
  conservativeStoreFeePercent: 30,
  optimizedStoreFeePercent: 15,
  monthlyReferenceGrossUsd: 9.99,
  plans: [
    {
      planId: "monthly",
      grossUsd: 9.99,
      estimatedNetUsdAt30PercentStoreFee: 6.99,
      estimatedNetUsdAt15PercentStoreFee: 8.49,
      monthlyEquivalentGrossUsd: 9.99,
      annualizedGrossUsd: 119.88,
      discountVsMonthlyPercent: 0,
      profitabilityRole: "entry-recurring"
    },
    {
      planId: "yearly",
      grossUsd: 39.99,
      estimatedNetUsdAt30PercentStoreFee: 27.99,
      estimatedNetUsdAt15PercentStoreFee: 33.99,
      monthlyEquivalentGrossUsd: 3.33,
      annualizedGrossUsd: 39.99,
      discountVsMonthlyPercent: 67,
      profitabilityRole: "primary-value"
    }
  ] satisfies LaunchPremiumPlanEconomics[]
} as const;

export function isLaunchPremiumPlanId(planId: PremiumPlanId | string | null | undefined): planId is LaunchPremiumPlanId {
  return LAUNCH_PREMIUM_PLAN_IDS.includes(planId as LaunchPremiumPlanId);
}

export function getLaunchPremiumPlanEconomics(planId: PremiumPlanId | string | null | undefined): LaunchPremiumPlanEconomics | null {
  if (!isLaunchPremiumPlanId(planId)) return null;
  return LAUNCH_PREMIUM_PLAN_ECONOMICS.plans.find((plan) => plan.planId === planId) ?? null;
}

const FREE_CAPABILITIES: PremiumCapabilitySet = {
  noAds: false,
  premiumChallenges: false,
  advancedAnalytics: false,
  advancedAiCoach: false,
  customChallenges: false,
  sponsorAccountability: false,
  familySupport: false,
  relapsePrediction: false,
  deepRecoveryReports: false
};

const BASE_PREMIUM_CAPABILITIES: PremiumCapabilitySet = {
  noAds: true,
  premiumChallenges: true,
  advancedAnalytics: true,
  advancedAiCoach: true,
  customChallenges: true,
  sponsorAccountability: false,
  familySupport: false,
  relapsePrediction: false,
  deepRecoveryReports: false
};

export function getPremiumCapabilities(options: { premium: boolean; planId?: PremiumPlanId | null }): PremiumCapabilitySet {
  if (!options.premium) return { ...FREE_CAPABILITIES };

  const capabilities: PremiumCapabilitySet = { ...BASE_PREMIUM_CAPABILITIES };
  if (options.planId === "monthly" || options.planId === "yearly") {
    capabilities.familySupport = true;
    capabilities.sponsorAccountability = true;
    capabilities.relapsePrediction = true;
    capabilities.deepRecoveryReports = true;
  } else if (options.planId === "family") {
    capabilities.familySupport = true;
    capabilities.sponsorAccountability = true;
  } else if (options.planId === "accountability") {
    capabilities.sponsorAccountability = true;
  } else if (options.planId === "ai-coach") {
    capabilities.relapsePrediction = true;
    capabilities.deepRecoveryReports = true;
  }

  return capabilities;
}

let nativeProvider: NativeMonetizationProvider | null = null;
const rewardedProviderListeners = new Set<() => void>();
export function subscribeRewardedProvider(listener: () => void): () => void {
  rewardedProviderListeners.add(listener);
  return () => { rewardedProviderListeners.delete(listener); };
}
let nativeProviderPending: Promise<unknown> | null = null;
let nativeDebugBuild: boolean | null = null;
let retryRewardedProvider: (() => Promise<unknown>) | null = null;
let rewardedProviderRetryPending: Promise<unknown> | null = null;
export function configureRewardedProviderRetry(retry: () => Promise<unknown>) { retryRewardedProvider = retry; }

/** Native build truth, supplied at startup; optimized JS alone does not make a Debug binary a Release binary. */
export function configureNativeMonetizationBuild(debugBuild: boolean | null) {
  nativeDebugBuild = debugBuild;
}

export function configureNativeMonetizationPending(pending: Promise<unknown>) {
  nativeProviderPending = pending;
}


/** Explicit Watch waits for the lazily imported provider, with no SDK request on mount. */
export async function awaitRewardedProvider(): Promise<void> {
  if (nativeProviderPending) await nativeProviderPending.catch(() => undefined);
  if (!nativeProvider?.completeRewardedResetSession && retryRewardedProvider) {
    if (!rewardedProviderRetryPending) {
      const pending = retryRewardedProvider();
      rewardedProviderRetryPending = pending;
      void pending.finally(() => { if (rewardedProviderRetryPending === pending) rewardedProviderRetryPending = null; }).catch(() => {});
    }
    await rewardedProviderRetryPending.catch(() => undefined);
  }
}
export async function getAdPrivacyOptionsRequired(): Promise<boolean | null> {
  if (nativeProviderPending) await nativeProviderPending.catch(() => undefined);
  return await nativeProvider?.getAdPrivacyOptionsRequired?.() ?? null;
}
export async function showAdPrivacyOptions(isCurrent: () => boolean = () => true): Promise<boolean> {
  await awaitRewardedProvider();
  return await nativeProvider?.showAdPrivacyOptions?.(isCurrent) ?? false;
}

export async function fetchLaunchStorePrices(options: { platform?: MonetizationPlatform } = {}): Promise<StoreProductPrice[]> {
  if (nativeProviderPending) await nativeProviderPending.catch(() => undefined);
  const config = getMonetizationConfig(options);
  if (config.mode !== "native" || !nativeProvider?.fetchStorePrices) return [];
  const prices = await nativeProvider.fetchStorePrices(config);
  const allowed = new Set(Object.values(config.launchProductIds));
  return prices.filter(price => allowed.has(price.productId)).map(price => ({ ...price, freeTrialDays: null }));
}

const ISO_3166_ALPHA2_COUNTRY_CODES = new Set(
  [
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ",
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR",
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP",
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ",
    "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW",
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ",
    "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ].join(" ").split(" ")
);

export function configureNativeMonetizationProvider(provider: NativeMonetizationProvider | null) {
  nativeProvider = provider;
  rewardedProviderListeners.forEach(listener => listener());
}

function readEnv(key: string): string | null {
  const value = readClientEnvironmentValue(key);
  if (!value || !value.trim()) return null;
  return value.trim();
}

function readBooleanEnv(key: string): boolean {
  const value = readEnv(key)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function isProductionRuntime(): boolean {
  if (nativeDebugBuild !== null) return !nativeDebugBuild;
  const nodeEnv = readEnv("NODE_ENV")?.toLowerCase();
  if (nodeEnv === "production") return true;
  return typeof __DEV__ !== "undefined" ? !__DEV__ : false;
}

function resolveMode(mode?: MonetizationMode): MonetizationMode {
  const requestedMode = mode ?? (process.env.EXPO_PUBLIC_MONETIZATION_MODE === "mock" ? "mock" : "native");
  if (requestedMode === "mock" && (isProductionRuntime() || ["production", "internal-testflight"].includes(readEnv("EXPO_PUBLIC_BUILD_CHANNEL") ?? ""))) return "native";
  return requestedMode;
}

function resolvePlatform(platform?: MonetizationPlatform): MonetizationPlatform {
  if (platform) return platform;
  const expoOS = readEnv("EXPO_OS");
  if (expoOS === "ios" || expoOS === "android" || expoOS === "web") return expoOS;
  return "unknown";
}

function readPlatformEnv(baseName: string, platform: MonetizationPlatform): string | null {
  const suffix = platform === "ios" ? "IOS" : platform === "android" ? "ANDROID" : platform === "web" ? "WEB" : null;
  if (suffix) {
    const platformValue = readEnv(`${baseName}_${suffix}`);
    if (platformValue) return platformValue;
  }
  return readEnv(baseName);
}

function normalizeCountryCode(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return ISO_3166_ALPHA2_COUNTRY_CODES.has(normalized) ? normalized : null;
}

function isPlaceholderConfigValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    normalized === "test" ||
    normalized === "test-key" ||
    normalized === "sample"
  );
}

function isUsableRevenueCatKey(value: string | null): boolean {
  return Boolean(value && !isPlaceholderConfigValue(value));
}

function isGoogleSampleAdMobValue(value: string): boolean {
  return value.includes("ca-app-pub-3940256099942544");
}

function isValidAdMobAppId(value: string | null): boolean {
  return Boolean(
    value &&
      !isPlaceholderConfigValue(value) &&
      !isGoogleSampleAdMobValue(value) &&
      /^ca-app-pub-\d{16}~\d{10}$/.test(value)
  );
}

function isValidAdMobRewardedUnitId(value: string | null): boolean {
  return Boolean(
    value &&
      !isPlaceholderConfigValue(value) &&
      !isGoogleSampleAdMobValue(value) &&
      /^ca-app-pub-\d{16}\/\d{10}$/.test(value)
  );
}

/** A Release TestFlight binary can request Google sample ads only on its explicit internal channel. */
function isNativeTestAdRuntimeAllowed(config: MonetizationConfig): boolean {
  const channel = readEnv("EXPO_PUBLIC_BUILD_CHANNEL");
  if (channel === "production") return false;
  if (channel === "internal-testflight") return config.mode === "native" && nativeDebugBuild === false && readBooleanEnv("EXPO_PUBLIC_ADMOB_USE_TEST_ADS");
  return !isProductionRuntime();
}

/** Never load a native ad SDK on web or without the configured native app ID. */
export function isRewardedAdSdkConfigured(config: MonetizationConfig): boolean {
  return config.mode === "native" &&
    (config.platform === "ios" || config.platform === "android") &&
    isValidAdMobAppId(config.admobAppId) &&
    ((config.allowTestAds && isNativeTestAdRuntimeAllowed(config) && Boolean(config.rewardedResetPlacementId)) ||
      (!config.allowTestAds && isValidAdMobRewardedUnitId(config.rewardedResetPlacementId)));
}

function resolveStoreProvider(): StoreProvider {
  const explicit = readEnv("EXPO_PUBLIC_STORE_PROVIDER")?.toLowerCase();
  if (explicit === "revenuecat") return "revenuecat";
  if (explicit === "native-iap" || explicit === "native" || explicit === "expo-iap") return "native-iap";
  // Default to native-iap (StoreKit 2 / Google Play Billing) — the cheapest
  // and most direct path, no third-party vendor in the loop.
  return "native-iap";
}

function isPurchaseVerifyEndpointReady(config: MonetizationConfig): boolean {
  return (
    Boolean(config.purchaseVerifyEndpoint) &&
    getProductionEndpointIssues(config.purchaseVerifyEndpoint, "purchase verify endpoint").length === 0
  );
}

function productionPurchaseVerificationIssue(config: MonetizationConfig): string | null {
  if (config.mode !== "native" || !isProductionRuntime()) return null;
  // Native checkout first obtains an Auth/App Check-protected server identity;
  // the purchase adapter then requires the injected Firebase verifier to grant.
  if (config.storeProvider === "native-iap" && (readEnv("EXPO_PUBLIC_BACKEND_PROVIDER")?.toLowerCase() ?? "firebase") === "firebase") return null;
  if (isPurchaseVerifyEndpointReady(config)) return null;
  return "Premium purchase is unavailable until FREED's server purchase verification endpoint is configured.";
}

export function getMonetizationConfig(options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): MonetizationConfig {
  const mode = resolveMode(options.mode);
  const platform = resolvePlatform(options.platform);
  const productIds: Record<PremiumPlanId, string> = {
    yearly: readEnv("EXPO_PUBLIC_IAP_PRODUCT_YEARLY") ?? "freed_premium_yearly",
    monthly: readEnv("EXPO_PUBLIC_IAP_PRODUCT_MONTHLY") ?? "freed_premium_monthly",
    lifetime: readEnv("EXPO_PUBLIC_IAP_PRODUCT_LIFETIME") ?? "freed_premium_lifetime",
    family: readEnv("EXPO_PUBLIC_IAP_PRODUCT_FAMILY") ?? "freed_family_yearly",
    accountability: readEnv("EXPO_PUBLIC_IAP_PRODUCT_ACCOUNTABILITY") ?? "freed_accountability_monthly",
    "ai-coach": readEnv("EXPO_PUBLIC_IAP_PRODUCT_AI_COACH") ?? "freed_ai_coach_monthly"
  };
  const allowTestAds = readBooleanEnv("EXPO_PUBLIC_ADMOB_USE_TEST_ADS");

  return {
    mode,
    platform,
    storeProvider: resolveStoreProvider(),
    revenueCatApiKey: readPlatformEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", platform),
    revenueCatEntitlementId:
      readEnv("EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID") ??
      readEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ??
      "premium",
    purchaseVerifyEndpoint: readEnv("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"),
    admobAppId: readPlatformEnv("EXPO_PUBLIC_ADMOB_APP_ID", platform),
    // Rewarded units are production-gated by scripts/release-env-preflight.js:
    // real EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS/_ANDROID plus
    // EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false are required before release env passes.
    // With test ads enabled, builds intentionally use Google's sample rewarded unit.
    rewardedResetPlacementId: allowTestAds
      ? "google-mobile-ads-test-rewarded"
      : readPlatformEnv("EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID", platform),
    adRequestCountryCode: normalizeCountryCode(readPlatformEnv("EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY", platform)),
    allowTestAds,
    buildChannel: readEnv("EXPO_PUBLIC_BUILD_CHANNEL") ?? undefined,
    productIds,
    launchProductIds: {
      yearly: productIds.yearly,
      monthly: productIds.monthly
    }
  };
}

export function getMonetizationReadiness(options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): MonetizationReadiness {
  const config = getMonetizationConfig(options);
  const missing: string[] = [];
  const revenueCatKeyReady = isUsableRevenueCatKey(config.revenueCatApiKey);
  const purchaseVerifyEndpointReady = isPurchaseVerifyEndpointReady(config);
  const admobAppIdReady = isValidAdMobAppId(config.admobAppId);
  const rewardedResetPlacementReady = config.allowTestAds ? Boolean(config.rewardedResetPlacementId) : isValidAdMobRewardedUnitId(config.rewardedResetPlacementId);

  if (config.mode === "native") {
    if (!nativeProvider) {
      missing.push("native monetization provider");
    } else {
      if (!nativeProvider.purchasePremiumPlan || !nativeProvider.restorePremiumPurchases) {
        missing.push("native purchase and restore handlers");
      }
      if (!nativeProvider.createRewardedResetSession || !nativeProvider.completeRewardedResetSession) {
        missing.push("native rewarded-ad handlers");
      }
    }

    // Native-IAP (expo-iap / StoreKit 2 / Google Play Billing) talks to the
    // store directly and does not need a third-party API key. RevenueCat-mode
    // still requires the platform SDK key.
    if (config.storeProvider === "revenuecat") {
      if (!config.revenueCatApiKey) missing.push("RevenueCat API key");
      else if (!revenueCatKeyReady) missing.push("non-placeholder RevenueCat API key");
    }
    if (!config.purchaseVerifyEndpoint) missing.push("purchase verify endpoint");
    else if (!purchaseVerifyEndpointReady) missing.push("production-safe purchase verify endpoint");
    if (!config.rewardedResetPlacementId) missing.push("rewarded reset ad unit");
    else if (!rewardedResetPlacementReady) missing.push("valid rewarded reset ad unit");
    if (!config.admobAppId) missing.push("AdMob app ID");
    else if (!admobAppIdReady) missing.push("valid AdMob app ID");
    if (config.allowTestAds) missing.push("disable AdMob test ads for production");
  }

  return {
    status: config.mode === "mock" ? "mock" : !nativeProvider ? "missing-provider" : missing.length > 0 ? "missing-config" : "ready",
    mode: config.mode,
    platform: config.platform,
    missing,
    revenueCatApiKeyConfigured: revenueCatKeyReady,
    revenueCatEntitlementId: config.revenueCatEntitlementId,
    purchaseVerifyEndpointConfigured: purchaseVerifyEndpointReady,
    admobAppIdConfigured: admobAppIdReady,
    rewardedResetPlacementId: config.rewardedResetPlacementId,
    adRequestCountryCode: config.adRequestCountryCode,
    allowTestAds: config.allowTestAds,
    productIds: config.productIds,
    launchProductIds: config.launchProductIds
  };
}

export function getPremiumPlans(options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): PremiumPlan[] {
  const config = getMonetizationConfig(options);
  return PREMIUM_PLANS.map((plan) => ({
    ...plan,
    productId: config.productIds[plan.id]
  }));
}

export function getLaunchPremiumPlans(options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): PremiumPlan[] {
  return getPremiumPlans(options).filter((plan) => isLaunchPremiumPlanId(plan.id));
}

export function getPremiumPlan(planId: string, options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): PremiumPlan | null {
  return getPremiumPlans(options).find((plan) => plan.id === planId) ?? null;
}

export function getLaunchPremiumPlan(planId: string, options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}): PremiumPlan | null {
  return getLaunchPremiumPlans(options).find((plan) => plan.id === planId) ?? null;
}

function launchPlanIdFromProviderResult(planId: PremiumPlanId | null | undefined): LaunchPremiumPlanId | null {
  return isLaunchPremiumPlanId(planId) ? planId : null;
}

function rejectPostLaunchProviderResult(message: string): PurchaseResult {
  return {
    status: "failed",
    premium: false,
    provider: "native",
    message,
    planId: null
  };
}

export async function purchasePremiumPlan(
  planId: PremiumPlanId,
  options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}
): Promise<PurchaseResult> {
  const config = getMonetizationConfig(options);
  const plan = getLaunchPremiumPlan(planId, options);
  if (!plan) {
    return {
      status: "failed",
      premium: false,
      provider: "fallback",
      message: "This premium plan is reserved for a future FREED release.",
      planId: null
    };
  }

  if (config.mode === "mock") {
    return {
      status: "purchased",
      premium: true,
      provider: "mock",
      message: `${plan.label} premium is active in local test mode.`,
      planId: plan.id
    };
  }

  const verificationIssue = productionPurchaseVerificationIssue(config);
  if (verificationIssue) {
    return {
      status: "failed",
      premium: false,
      provider: "native",
      message: verificationIssue,
      planId: plan.id
    };
  }

  if (nativeProvider?.purchasePremiumPlan) {
    try {
      const result = await nativeProvider.purchasePremiumPlan(plan, config);
      const providerPlanId = launchPlanIdFromProviderResult(result.planId ?? plan.id);
      if (result.premium && !providerPlanId) {
        return rejectPostLaunchProviderResult("Native purchase returned a product reserved for a future FREED release.");
      }
      return {
        ...result,
        provider: "native",
        message: safeUserFacingMessage(result.message, "Native purchase failed before completion."),
        planId: providerPlanId ?? plan.id
      };
    } catch (error) {
      return {
        status: "failed",
        premium: false,
        provider: "native",
        message: safeUserFacingMessage(error, "Native purchase failed before completion."),
        planId: plan.id
      };
    }
  }

  return {
    status: "unavailable",
    premium: false,
    provider: "native",
    message: "Native purchase SDK is not configured yet.",
    planId: plan.id
  };
}

export async function restorePremiumPurchases(
  options: { mode?: MonetizationMode; platform?: MonetizationPlatform } = {}
): Promise<PurchaseResult> {
  const config = getMonetizationConfig(options);
  if (config.mode === "mock") {
    return {
      status: "purchased",
      premium: true,
      provider: "mock",
      message: "Premium restore succeeded in local test mode.",
      planId: "yearly"
    };
  }

  const verificationIssue = productionPurchaseVerificationIssue(config);
  if (verificationIssue) {
    return {
      status: "failed",
      premium: false,
      provider: "native",
      message: verificationIssue,
      planId: null
    };
  }

  if (nativeProvider?.restorePremiumPurchases) {
    try {
      const result = await nativeProvider.restorePremiumPurchases(getLaunchPremiumPlans(options), config);
      const providerPlanId = launchPlanIdFromProviderResult(result.planId);
      if (result.premium && !providerPlanId) {
        return rejectPostLaunchProviderResult("Native restore returned a product reserved for a future FREED release.");
      }
      return {
        ...result,
        provider: "native",
        message: safeUserFacingMessage(result.message, "Native restore failed before completion."),
        planId: providerPlanId
      };
    } catch (error) {
      return {
        status: "failed",
        premium: false,
        provider: "native",
        message: safeUserFacingMessage(error, "Native restore failed before completion."),
        planId: null
      };
    }
  }

  return {
    status: "unavailable",
    premium: false,
    provider: "native",
    message: "Native purchase restore is not configured yet.",
    planId: null
  };
}

export function createRewardedResetSession(options: { mode?: MonetizationMode; platform?: MonetizationPlatform; premium?: boolean } = {}): RewardedResetSession {
  if (options.premium === true) return createFallbackRewardedResetSession("Premium recovery does not request ads.");
  const config = getMonetizationConfig(options);
  if (config.mode === "mock") {
    return {
      id: `mock-reset-${Date.now()}`,
      provider: "mock",
      status: "ready",
      durationSeconds: 5,
      message: "Free users complete a short sponsored reset before the challenge.",
      metadata: {
        testMode: true
      }
    };
  }

  if (nativeProvider?.createRewardedResetSession) {
    try {
      const session = nativeProvider.createRewardedResetSession(config);
      if (session) return { ...session, provider: "native" };
    } catch {
      return createFallbackRewardedResetSession("Native rewarded-ad provider failed before a session was created.");
    }
  }

  return createFallbackRewardedResetSession("Rewarded ads are not configured on this build.");
}

function createFallbackRewardedResetSession(reason: string): RewardedResetSession {
  return {
    diagnostic: getRewardedProviderDiagnostic(),
    id: `fallback-reset-${Date.now()}`,
    provider: "fallback",
    status: "fallback",
    durationSeconds: 3,
    message: "Rewarded ads are unavailable. Retry later or open Basic help.",
    metadata: {
      fallbackReason: reason
    }
  };
}

export async function completeRewardedResetSession(
  session: RewardedResetSession,
  options: { mode?: MonetizationMode; platform?: MonetizationPlatform; isEligible?: () => boolean; lifecycle?: RewardedPresentationLifecycle } = {}
): Promise<RewardedResetResult> {
  if (session.status === "fallback") {
    return {
      status: "fallback",
      rewardGranted: false,
      provider: "fallback",
      message: "Rewarded ads are unavailable. Retry later or open Basic help."
    };
  }

  if (session.provider === "native" && nativeProvider?.completeRewardedResetSession) {
    try {
      const result = await nativeProvider.completeRewardedResetSession(session, getMonetizationConfig(options), options.isEligible, options.lifecycle);
      return {
        ...result,
        provider: "native"
      };
    } catch {
      return {
        status: "fallback",
        rewardGranted: false,
        provider: "fallback",
        message: "Rewarded ads are unavailable. Retry later or open Basic help."
      };
    }
  }

  return {
    status: "completed",
    rewardGranted: true,
    provider: session.provider,
    message: "Rewarded reset complete."
  };
}
