// ── FREED · Native In-App Purchase Adapter ───────────────────────────────────
// Wraps Expo IAP (`expo-iap`) directly into our `NativeStoreAdapter` contract.
//   • iOS:    StoreKit 2 (Apple-required for new submissions in 2025+).
//   • Android: Google Play Billing v6+ (Play-required for new submissions in 2025+).
//
// This is the preferred path — no third-party entitlement vendor in the loop.
// FREED grants premium only after its authenticated, App Check-protected
// Firebase callable verifies the exact App Store / Play transaction.

import {
  MonetizationConfig
} from "@/lib/monetization";
import {
  createFirebaseClientEventId,
  type FirebaseCoreProductId,
  type FirebaseVerifyStorePurchaseRequest,
  type FirebaseVerifyStorePurchaseResult
} from "@/lib/firebase-client";
import type {
  NativeEntitlementInfo,
  NativeStoreAdapter
} from "@/lib/native-monetization-adapter";

const CORE_PRODUCT_IDS = new Set<FirebaseCoreProductId>([
  "freed_premium_monthly",
  "freed_premium_yearly",
  "freed_premium_lifetime"
]);

export type NativeIapPurchaseVerifier = (
  request: FirebaseVerifyStorePurchaseRequest
) => Promise<FirebaseVerifyStorePurchaseResult>;

/**
 * Subset of the `expo-iap` API that we depend on. Defined here so we can ship
 * adapters that compile even if the dev/prototype build doesn't have expo-iap
 * installed yet. The runtime loader checks for these methods explicitly.
 */
export type ExpoIapModule = {
  initConnection: () => Promise<boolean>;
  endConnection?: () => Promise<void> | void;
  getSubscriptions?: (productIds: string[]) => Promise<unknown[]>;
  getProducts?: (productIds: string[]) => Promise<unknown[]>;
  requestSubscription?: (params: unknown) => Promise<unknown>;
  requestPurchase?: (params: {
    request: { apple: { sku: string }; google: { skus: string[] } };
    type: "in-app" | "subs";
  }) => Promise<unknown>;
  getAvailablePurchases?: () => Promise<unknown[]>;
  finishTransaction?: (params: { purchase: unknown; isConsumable?: boolean } | unknown) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type StrictPurchase = {
  raw: unknown;
  request: FirebaseVerifyStorePurchaseRequest;
};

function isCoreProductId(value: string): value is FirebaseCoreProductId {
  return CORE_PRODUCT_IDS.has(value as FirebaseCoreProductId);
}

function extractStrictPurchase(
  value: unknown,
  platform: MonetizationConfig["platform"],
  expectedProductId: string,
  restore: boolean
): StrictPurchase | null {
  if (!isRecord(value) || !isCoreProductId(expectedProductId) || value.productId !== expectedProductId ||
      value.purchaseState !== "purchased") return null;

  if (platform === "ios") {
    if (value.platform !== "ios" || value.store !== "apple" || typeof value.transactionId !== "string" ||
        !/^\d{8,32}$/.test(value.transactionId)) return null;
    return {
      raw: value,
      request: {
        platform: "ios",
        productId: expectedProductId,
        transactionId: value.transactionId,
        clientEventId: createFirebaseClientEventId("purchase"),
        restore
      }
    };
  }

  if (platform === "android") {
    if (value.platform !== "android" || value.store !== "google" || value.isSuspendedAndroid === true ||
        typeof value.purchaseToken !== "string" || value.purchaseToken.length < 16 || value.purchaseToken.length > 4_096 ||
        !/^[\x21-\x7E]+$/.test(value.purchaseToken) || value.purchaseToken.includes("://")) return null;
    return {
      raw: value,
      request: {
        platform: "android",
        productId: expectedProductId,
        purchaseToken: value.purchaseToken,
        clientEventId: createFirebaseClientEventId("purchase"),
        restore
      }
    };
  }
  return null;
}

function exactVerifiedResult(
  value: FirebaseVerifyStorePurchaseResult,
  request: FirebaseVerifyStorePurchaseRequest
): boolean {
  if (!isRecord(value) || Object.keys(value).length !== 6 || value.active !== true || value.status !== "verified" ||
      value.entitlementId !== "premium" || value.productId !== request.productId || value.platform !== request.platform) return false;
  if (request.productId === "freed_premium_lifetime") return value.expiresAt === null;
  return typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt)) && Date.parse(value.expiresAt) > Date.now();
}

async function verifyPurchase(
  purchase: StrictPurchase,
  verifyStorePurchase: NativeIapPurchaseVerifier
): Promise<NativeEntitlementInfo> {
  try {
    const verified = await verifyStorePurchase(purchase.request);
    if (!exactVerifiedResult(verified, purchase.request)) return { activeEntitlementIds: [] };
    return {
      activeEntitlementIds: ["premium"],
      raw: { productId: purchase.request.productId }
    };
  } catch {
    return { activeEntitlementIds: [] };
  }
}

/**
 * Builds a `NativeStoreAdapter` from the loaded expo-iap module.
 * Returns null if the module is missing required methods (degrades to fallback).
 */
export function createNativeIapStoreAdapter(
  iap: ExpoIapModule,
  verifyStorePurchase?: NativeIapPurchaseVerifier
): NativeStoreAdapter | null {
  const requestPurchase = iap.requestPurchase ?? iap.requestSubscription;
  if (!requestPurchase || typeof iap.initConnection !== "function") {
    return null;
  }

  let initialized = false;
  async function ensureInit() {
    if (initialized) return true;
    initialized = await iap.initConnection().catch(() => false);
    return initialized;
  }

  async function finishIfPossible(purchase: unknown) {
    if (typeof iap.finishTransaction !== "function") return;
    try {
      await iap.finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Non-fatal: store will retry on next launch.
    }
  }

  return {
    purchaseProduct: async (productId, config) => {
      if (!verifyStorePurchase || !(await ensureInit()) || !isCoreProductId(productId)) return { activeEntitlementIds: [] };
      const raw = await requestPurchase({
        request: { apple: { sku: productId }, google: { skus: [productId] } },
        type: productId === "freed_premium_lifetime" ? "in-app" : "subs"
      });
      const candidates = (Array.isArray(raw) ? raw : [raw])
        .map((purchase) => extractStrictPurchase(purchase, config.platform, productId, false))
        .filter((purchase): purchase is StrictPurchase => purchase !== null);
      if (candidates.length !== 1) return { activeEntitlementIds: [] };
      const purchase = candidates[0];
      const entitlement = await verifyPurchase(purchase, verifyStorePurchase);
      if (entitlement.activeEntitlementIds.length > 0) {
        await finishIfPossible(purchase.raw);
      }
      return entitlement;
    },
    restorePurchases: async (config) => {
      if (!verifyStorePurchase || !(await ensureInit())) return { activeEntitlementIds: [] };
      const purchases = typeof iap.getAvailablePurchases === "function"
        ? await iap.getAvailablePurchases().catch(() => [])
        : [];

      // Try each restored purchase against the entitlement map until one matches.
      for (const raw of purchases) {
        if (!isRecord(raw) || typeof raw.productId !== "string") continue;
        const purchase = extractStrictPurchase(raw, config.platform, raw.productId, true);
        if (!purchase) continue;
        const entitlement = await verifyPurchase(purchase, verifyStorePurchase);
        if (entitlement.activeEntitlementIds.length > 0) {
          await finishIfPossible(purchase.raw);
          return entitlement;
        }
      }

      return { activeEntitlementIds: [] };
    }
  };
}

/**
 * Soft-load the expo-iap module shape from an imported namespace.
 * Accepts both ESM (`*.default`) and CJS shapes.
 */
export function expoIapModuleFromImport(moduleValue: unknown): ExpoIapModule | null {
  if (!isRecord(moduleValue)) return null;
  const candidate = isRecord(moduleValue.default) ? moduleValue.default : moduleValue;
  if (typeof candidate.initConnection !== "function") return null;
  return candidate as ExpoIapModule;
}
