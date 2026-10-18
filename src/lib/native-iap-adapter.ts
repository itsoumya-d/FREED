// ── FREED · Native In-App Purchase Adapter ───────────────────────────────────
// Wraps Expo IAP (`expo-iap`) directly into our `NativeStoreAdapter` contract.
//   • iOS:    StoreKit 2 (Apple-required for new submissions in 2025+).
//   • Android: Google Play Billing v6+ (Play-required for new submissions in 2025+).
//
// This is the preferred path — no third-party entitlement vendor in the loop.
// FREED grants premium only after its authenticated, App Check-protected
// Firebase callable verifies the exact App Store / Play transaction.
// Native purchases fail closed unless FREED's server confirms the transaction.

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
import { normalizeStoreProductPrice, selectAndroidBasePlanOffer, type StoreProductPrice } from "@/lib/store-pricing";

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
  fetchProducts?: (params: { skus: string[]; type: "subs" }) => Promise<unknown[]>;
  requestSubscription?: (params: unknown) => Promise<unknown>;
  requestPurchase?: (params: {
    request: { apple: { sku: string; appAccountToken?: string }; google: { skus: string[]; obfuscatedAccountId?: string; subscriptionOffers?: { sku: string; offerToken: string }[]; purchaseToken?: string; replacementMode?: number; subscriptionProductReplacementParams?: { oldProductId: string; replacementMode: "deferred" } } };
    type: "in-app" | "subs";
  }) => Promise<unknown>;
  getAvailablePurchases?: () => Promise<unknown[]>;
  getPendingTransactionsIOS?: () => Promise<unknown[]>;
  purchaseUpdatedListener?: (listener: (purchase: unknown) => void) => { remove(): void };
  purchaseErrorListener?: (listener: (error: unknown) => void) => { remove(): void };
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
        !/^\d{8,32}$/.test(value.transactionId) || value.revocationDateIOS != null || value.isUpgradedIOS === true) return null;
    const witness = value.purchaseToken;
    if (witness != null && !isSignedWitness(witness)) return null;
    return {
      raw: value,
      request: {
        platform: "ios",
        productId: expectedProductId,
        transactionId: value.transactionId,
        ...(typeof witness === "string" ? { signedTransactionInfo: witness } : {}),
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
    if (!exactVerifiedResult(verified, purchase.request)) return { activeEntitlementIds: [], purchaseStatus: verified.status === "unavailable" ? "unavailable" : "failed" };
    return {
      activeEntitlementIds: ["premium"],
      purchaseStatus: "purchased",
      verifiedEntitlement: {
        productId: verified.productId,
        platform: verified.platform,
        expiresAt: verified.expiresAt,
        verifiedAt: new Date().toISOString(),
        status: "verified"
      },
      raw: { productId: purchase.request.productId }
    };
  } catch {
    return { activeEntitlementIds: [], purchaseStatus: "unavailable", message: "Purchase verification is unavailable. Restore purchases to retry." };
  }
}

/**
 * Builds a `NativeStoreAdapter` from the loaded expo-iap module.
 * Returns null if the module is missing required methods (degrades to fallback).
 */
function isSignedWitness(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 64 * 1024 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/** Called only after the server has verified this exact existing transaction.
 * Reading its token preserves the store's original binding through a guest
 * transfer; local decoding never grants access or verifies a purchase. */
function existingAppleAccountToken(purchase: StrictPurchase): string | null {
  if (purchase.request.platform !== "ios" || !isRecord(purchase.raw)) return null;
  const validToken = (value: unknown): value is string => typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const sdkToken = validToken(purchase.raw.appAccountToken) ? purchase.raw.appAccountToken.toLowerCase() : null;
  let witnessToken: string | null = null;
  if (purchase.request.signedTransactionInfo && typeof globalThis.atob === "function") {
    try {
      const payload = purchase.request.signedTransactionInfo.split(".")[1]!;
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded: unknown = JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
      if (isRecord(decoded) && validToken(decoded.appAccountToken)) witnessToken = decoded.appAccountToken.toLowerCase();
    } catch { return null; }
  }
  if (sdkToken && witnessToken && sdkToken !== witnessToken) return null;
  return witnessToken ?? sdkToken;
}

type CheckoutOutcome = { kind: "purchase"; raw: unknown } | { kind: "pending" | "cancelled" | "failed" | "unavailable" };
const connectionStates = new WeakMap<ExpoIapModule, { initialized: boolean; pending: Promise<boolean> | null }>();

function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([operation, new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Store operation timed out.")), milliseconds);
  })]).finally(() => { if (timeout) clearTimeout(timeout); });
}

function inactive(status: "pending" | "cancelled" | "failed" | "unavailable", message?: string): NativeEntitlementInfo {
  return { activeEntitlementIds: [], purchaseStatus: status, ...(message ? { message } : {}) };
}

export function createNativeIapStoreAdapter(
  iap: ExpoIapModule,
  verifyStorePurchase?: NativeIapPurchaseVerifier,
  options: { getCheckoutContext?: () => Promise<{ appAccountToken: string; obfuscatedAccountId: string }>; purchaseTimeoutMs?: number } = {}
): NativeStoreAdapter | null {
  const requestPurchase = iap.requestPurchase ?? iap.requestSubscription;
  if (!requestPurchase || typeof iap.initConnection !== "function") {
    return null;
  }

  const connection = connectionStates.get(iap) ?? { initialized: false, pending: null };
  connectionStates.set(iap, connection);
  const eventPath = typeof iap.purchaseUpdatedListener === "function" && typeof iap.purchaseErrorListener === "function";
  const purchaseTimeoutMs = Number.isFinite(options.purchaseTimeoutMs) ? Math.max(1, Math.min(180_000, options.purchaseTimeoutMs!)) : 90_000;
  let disposed = false;
  let listenersRegistered = false;
  let checkoutBusy = false;
  let activeWait: { productId: string; consume: (raw: unknown) => void; settle: (outcome: CheckoutOutcome) => void } | null = null;
  let products: unknown[] = [];
  let productPromise: Promise<unknown[]> | null = null;
  const disposers: Array<() => void> = [];
  const unfinished = new Map<string, unknown>();
  const finished = new Set<string>();

  function purchaseKey(raw: unknown): string | null {
    if (!isRecord(raw) || typeof raw.productId !== "string") return null;
    const identity = raw.platform === "ios" ? raw.transactionId : raw.purchaseToken;
    return typeof identity === "string" ? `${raw.platform}:${raw.productId}:${identity}` : null;
  }

  function remember(raw: unknown) {
    if (!isRecord(raw) || typeof raw.productId !== "string" || (raw.platform !== "ios" && raw.platform !== "android")) return;
    if (!extractStrictPurchase(raw, raw.platform, raw.productId, true)) return;
    const key = purchaseKey(raw);
    if (key && !finished.has(key)) unfinished.set(key, raw);
  }

  function errorOutcome(error: unknown): CheckoutOutcome {
    const code = isRecord(error) ? error.code : null;
    if (code === "user-cancelled" || code === "E_USER_CANCELLED" || code === "1") return { kind: "cancelled" };
    if (code === "pending" || code === "deferred-payment") return { kind: "pending" };
    if (["network-error", "service-disconnected", "connection-closed", "billing-unavailable", "already-owned"].includes(String(code))) return { kind: "unavailable" };
    return { kind: "failed" };
  }

  function registerListeners() {
    if (!eventPath || listenersRegistered) return;
    listenersRegistered = true;
    const updates = iap.purchaseUpdatedListener!(raw => { remember(raw); activeWait?.consume(raw); });
    const errors = iap.purchaseErrorListener!(error => {
      if (isRecord(error) && ["connection-closed", "service-disconnected"].includes(String(error.code))) connection.initialized = false;
      if (!activeWait || (isRecord(error) && error.productId && error.productId !== activeWait.productId)) return;
      activeWait.settle(errorOutcome(error));
    });
    disposers.push(() => updates.remove(), () => errors.remove());
  }

  async function ensureInit() {
    if (disposed) return false;
    try { registerListeners(); } catch { return false; }
    if (connection.initialized) return true;
    if (!connection.pending) {
      const pending = bounded(Promise.resolve().then(() => iap.initConnection()), 15_000).catch(() => false).then(result => {
        connection.initialized = result === true;
        return connection.initialized;
      });
      connection.pending = pending;
      void pending.finally(() => { if (connection.pending === pending) connection.pending = null; });
    }
    return connection.pending;
  }

  async function fetchProducts(config: MonetizationConfig, refresh = false) {
    if (products.length && !refresh) return products;
    if (!productPromise) {
      const skus = Object.values(config.launchProductIds);
      productPromise = bounded(iap.fetchProducts ? iap.fetchProducts({ skus, type: "subs" }) : iap.getSubscriptions ? iap.getSubscriptions(skus) : Promise.resolve([]), 20_000)
        .then(value => { products = value; return value; })
        .finally(() => { productPromise = null; });
    }
    return productPromise;
  }

  async function finishIfPossible(purchase: unknown) {
    const key = purchaseKey(purchase);
    if (key && finished.has(key)) return true;
    if (typeof iap.finishTransaction !== "function") return false;
    try {
      await bounded(iap.finishTransaction({ purchase, isConsumable: false }), 10_000);
      if (key) { unfinished.delete(key); finished.add(key); }
      return true;
    } catch { remember(purchase); return false; }
  }

  async function verifyAndFinish(purchase: StrictPurchase) {
    remember(purchase.raw);
    const info = await verifyPurchase(purchase, request => bounded(verifyStorePurchase!(request), 20_000));
    if (info.activeEntitlementIds.length) {
      const finalized = await finishIfPossible(purchase.raw);
      if (!finalized) info.message = "Premium is verified. Restore purchases to retry store finalization.";
    }
    return info;
  }

  return {
    dispose() {
      disposed = true;
      activeWait?.settle({ kind: "unavailable" });
      activeWait = null;
      disposers.splice(0).forEach(dispose => dispose());
      unfinished.clear();
    },
    fetchStorePrices: async config => {
      if (!(await ensureInit())) return [];
      return (await fetchProducts(config, true)).map(normalizeStoreProductPrice).filter((price): price is StoreProductPrice => price !== null);
    },
    purchaseProduct: async (productId, config) => {
      if (checkoutBusy) return inactive("pending", "Another store checkout is already in progress.");
      if (!verifyStorePurchase || !isCoreProductId(productId)) return inactive("unavailable", "Store verification is unavailable. Checkout was not opened.");
      if (!eventPath) return inactive("unavailable", "The store purchase listeners are unavailable. Checkout was not opened.");
      if (!options.getCheckoutContext) return inactive("unavailable", "Server checkout readiness is unavailable. Checkout was not opened.");
      checkoutBusy = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let waiter: typeof activeWait = null;
      try {
        if (!(await ensureInit())) return inactive("unavailable", "The store connection is unavailable. Checkout was not opened.");
        // Every charge sheet needs both a working event lifecycle and the
        // server's verified readiness/account binding, including future SDKs.
        let identity: Awaited<ReturnType<NonNullable<typeof options.getCheckoutContext>>>;
        try { identity = await bounded(options.getCheckoutContext(), 10_000); }
        catch { return inactive("unavailable", "Store verification is not ready. Checkout was not opened."); }
        if (disposed) return inactive("unavailable");
        if (!identity || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.appAccountToken) || !/^[a-f0-9]{64}$/.test(identity.obfuscatedAccountId)) return inactive("unavailable", "Server checkout identity is invalid. Checkout was not opened.");
        await fetchProducts(config, true);
        let previous: StrictPurchase | null = null;
        if (eventPath && iap.getAvailablePurchases && productId !== "freed_premium_lifetime") {
          let available: unknown[];
          try { available = await bounded(iap.getAvailablePurchases(), 15_000); }
          catch { return inactive("unavailable", "Existing store membership could not be checked before checkout."); }
          for (const raw of available) {
            if (!isRecord(raw) || !Object.values(config.launchProductIds).includes(String(raw.productId))) continue;
            if (raw.purchaseState === "pending" || raw.isSuspendedAndroid === true) return inactive("pending", "Resolve the pending membership in your store before starting another checkout.");
            if (config.platform === "ios" && typeof raw.expirationDateIOS === "number" && raw.expirationDateIOS <= Date.now()) continue;
            const candidate = extractStrictPurchase(raw, config.platform, String(raw.productId), true);
            if (!candidate) continue;
            const existing = await verifyAndFinish(candidate);
            if (!existing.activeEntitlementIds.length) return inactive("unavailable", "Current store ownership could not be verified. Sign in to the original recovery account or restore purchases before changing plans.");
            if (candidate.request.productId === productId) return { ...existing, message: "This membership is already active. No new checkout was opened." };
            if (previous) return inactive("unavailable", "More than one store membership was found. Manage subscriptions in your store before changing plans.");
            previous = candidate;
          }
        }
        const appleAccountToken = config.platform === "ios" && previous ? existingAppleAccountToken(previous) : identity.appAccountToken;
        if (!appleAccountToken) return inactive("unavailable", "We couldn’t safely read your current membership. Restore purchases before changing plans.");
        const product = products.find(value => isRecord(value) && (value.id === productId || value.productId === productId));
        // The adapter is callable independently of the paywall. Recheck the
        // exact, freshly fetched billed price before opening any charge sheet.
        if (!normalizeStoreProductPrice(product)) return inactive("unavailable", "The store billed price is unavailable. Checkout was not opened.");
        const offerToken = selectAndroidBasePlanOffer(product)?.offerToken;
        if (config.platform === "android" && productId !== "freed_premium_lifetime" && !offerToken) return inactive("unavailable", "The store base-plan price is unavailable. Checkout was not opened.");
        let settle!: (outcome: CheckoutOutcome) => void;
        let settled = false;
        const outcome = new Promise<CheckoutOutcome>(resolve => {
          settle = value => { if (settled) return; settled = true; resolve(value); };
          timer = setTimeout(() => settle({ kind: "pending" }), purchaseTimeoutMs);
        });
        const consume = (raw: unknown) => {
          if (settled || !isRecord(raw) || raw.platform !== config.platform) return;
          const deferred = isRecord(raw.pendingPurchaseUpdateAndroid) && Array.isArray(raw.pendingPurchaseUpdateAndroid.products) && raw.pendingPurchaseUpdateAndroid.products.includes(productId);
          if (deferred || (raw.productId === productId && raw.purchaseState === "pending")) { settle({ kind: "pending" }); return; }
          if (previous && raw.productId === previous.request.productId && raw.purchaseState === "purchased") { settle({ kind: "pending" }); return; }
          if (extractStrictPurchase(raw, config.platform, productId, false)) settle({ kind: "purchase", raw });
        };
        waiter = { productId, consume, settle };
        activeWait = waiter;
        const oldToken = previous?.request.platform === "android" ? previous.request.purchaseToken : undefined;
        void Promise.resolve().then(() => requestPurchase.call(iap, {
          request: {
            apple: { sku: productId, appAccountToken: appleAccountToken },
            google: { skus: [productId], obfuscatedAccountId: identity.obfuscatedAccountId, ...(offerToken ? { subscriptionOffers: [{ sku: productId, offerToken }] } : {}),
              ...(oldToken && previous ? { purchaseToken: oldToken, subscriptionProductReplacementParams: { oldProductId: previous.request.productId, replacementMode: "deferred" as const } } : {}) }
          }, type: productId === "freed_premium_lifetime" ? "in-app" : "subs"
        })).then(raw => {
          const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
          values.forEach(value => { remember(value); consume(value); });
        }).catch(error => settle(errorOutcome(error)));
        const result = await outcome;
        if (result.kind !== "purchase") return inactive(result.kind, result.kind === "pending" ? "The store purchase or plan change is pending. Restore purchases after the store confirms it." : result.kind === "cancelled" ? "Purchase cancelled." : "The store checkout could not be verified. Restore purchases or try again.");
        const purchase = extractStrictPurchase(result.raw, config.platform, productId, false);
        return purchase ? await verifyAndFinish(purchase) : inactive("failed");
      } catch { return inactive("unavailable", "Store checkout is unavailable. Restore purchases or try again."); }
      finally {
        if (timer) clearTimeout(timer);
        if (activeWait === waiter) activeWait = null;
        checkoutBusy = false;
      }
    },
    restorePurchases: async config => {
      if (checkoutBusy) return inactive("pending", "Wait for the current store checkout before restoring.");
      if (!verifyStorePurchase || !(await ensureInit())) return inactive("unavailable");
      let available: unknown[];
      try {
        const [purchases, pending] = await Promise.all([
          iap.getAvailablePurchases ? bounded(iap.getAvailablePurchases(), 15_000) : Promise.resolve([]),
          config.platform === "ios" && iap.getPendingTransactionsIOS ? bounded(iap.getPendingTransactionsIOS(), 15_000) : Promise.resolve([])
        ]);
        available = [...unfinished.values(), ...pending, ...purchases];
      } catch { return inactive("unavailable", "Store transactions could not be read. Restore purchases to retry."); }
      const seen = new Set<string>();
      let last = inactive("unavailable", "No active verified FREED membership was found.");
      for (const raw of available) {
        if (!isRecord(raw) || typeof raw.productId !== "string") continue;
        const purchase = extractStrictPurchase(raw, config.platform, raw.productId, true);
        if (!purchase) continue;
        const key = purchaseKey(raw);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        last = await verifyAndFinish(purchase);
        if (last.activeEntitlementIds.length) return last;
      }
      return last;
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
