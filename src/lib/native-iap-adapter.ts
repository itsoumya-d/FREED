// ── FREED · Native In-App Purchase Adapter ───────────────────────────────────
// Wraps Expo IAP (`expo-iap`) directly into our `NativeStoreAdapter` contract.
//   • iOS:    StoreKit 2 (Apple-required for new submissions in 2025+).
//   • Android: Google Play Billing v6+ (Play-required for new submissions in 2025+).
//
// This is the preferred path — no third-party entitlement vendor in the loop,
// transaction data goes Apple ↔ device and Google ↔ device only. A production
// server endpoint (`EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT`) must confirm the
// receipt/purchase token on FREED's backend before activating the entitlement.

import {
  MonetizationConfig
} from "@/lib/monetization";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import type {
  NativeEntitlementInfo,
  NativeStoreAdapter
} from "@/lib/native-monetization-adapter";

const DEFAULT_PURCHASE_VERIFY_TIMEOUT_MS = 8_000;
const MIN_PURCHASE_VERIFY_TIMEOUT_MS = 500;
const MAX_PURCHASE_VERIFY_TIMEOUT_MS = 15_000;
const DEFAULT_PURCHASE_VERIFY_RESPONSE_MAX_BYTES = 256_000;
const MIN_PURCHASE_VERIFY_RESPONSE_MAX_BYTES = 1_024;
const MAX_PURCHASE_VERIFY_RESPONSE_MAX_BYTES = 2_000_000;

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
  requestSubscription?: (params: { sku: string } | { skus: string[] } | string) => Promise<unknown>;
  requestPurchase?: (params: { sku?: string; skus?: string[]; productId?: string } | string) => Promise<unknown>;
  getAvailablePurchases?: () => Promise<unknown[]>;
  finishTransaction?: (params: { purchase: unknown; isConsumable?: boolean } | unknown) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Send the receipt/purchase token to the configured backend for App Store /
 * Play verification. Without this endpoint, native IAP fails closed.
 * The server should return `{ active: true, entitlementId: "premium" }` only
 * after Apple/Google confirm the transaction.
 */
async function verifyWithServer(
  purchase: unknown,
  config: MonetizationConfig
): Promise<{ active: boolean; entitlementId?: string } | null> {
  const endpoint = config.purchaseVerifyEndpoint?.trim();
  if (!endpoint) return null;

  try {
    if (getProductionEndpointIssues(endpoint, "purchase verify endpoint").length > 0) {
      return { active: false };
    }

    const body = isRecord(purchase) ? purchase : { raw: purchase };
    const { response, payload } = await postPurchaseVerificationWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: config.platform,
          entitlementId: config.revenueCatEntitlementId,
          purchase: body
        })
      },
      normalizePurchaseVerifyTimeoutMs(readPurchaseVerifyTimeoutMs())
    );
    if (!response.ok) return { active: false };
    return {
      active: Boolean(payload.active),
      entitlementId: typeof payload.entitlementId === "string" ? payload.entitlementId : undefined
    };
  } catch {
    return { active: false };
  }
}

async function purchaseToEntitlement(
  purchase: unknown,
  config: MonetizationConfig
): Promise<NativeEntitlementInfo> {
  // Server-verified path (highest trust).
  const verified = await verifyWithServer(purchase, config);
  if (verified) {
    return {
      activeEntitlementIds: verified.active ? [verified.entitlementId ?? config.revenueCatEntitlementId] : [],
      raw: purchase
    };
  }

  // Native purchases fail closed unless FREED's server confirms the
  // App Store / Play transaction. Local prototype flows should use explicit
  // mock mode instead of minting premium from client-side product IDs.
  return {
    activeEntitlementIds: [],
    raw: purchase
  };
}

async function postPurchaseVerificationWithTimeout(endpoint: string, init: RequestInit, timeoutMs: number) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Purchase verification request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetch(endpoint, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
    const payload = (await readBoundedResponseJson(response, {
      timeoutMs,
      maxBytes: normalizePurchaseVerifyResponseMaxBytes(readPurchaseVerifyResponseMaxBytes()),
      label: "Purchase verification response",
      abort: () => controller?.abort()
    })) as { active?: unknown; entitlementId?: unknown };
    return { response, payload };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readPurchaseVerifyTimeoutMs() {
  return process.env.EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS?.trim() ?? "";
}

function readPurchaseVerifyResponseMaxBytes() {
  return process.env.EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES?.trim() ?? "";
}

function normalizePurchaseVerifyTimeoutMs(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_PURCHASE_VERIFY_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_PURCHASE_VERIFY_TIMEOUT_MS;
  return Math.max(MIN_PURCHASE_VERIFY_TIMEOUT_MS, Math.min(MAX_PURCHASE_VERIFY_TIMEOUT_MS, Math.round(parsed)));
}

function normalizePurchaseVerifyResponseMaxBytes(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_PURCHASE_VERIFY_RESPONSE_MAX_BYTES;
  if (!Number.isFinite(parsed)) return DEFAULT_PURCHASE_VERIFY_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_PURCHASE_VERIFY_RESPONSE_MAX_BYTES,
    Math.min(MAX_PURCHASE_VERIFY_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

/**
 * Builds a `NativeStoreAdapter` from the loaded expo-iap module.
 * Returns null if the module is missing required methods (degrades to fallback).
 */
export function createNativeIapStoreAdapter(iap: ExpoIapModule): NativeStoreAdapter | null {
  const requestPurchase = iap.requestPurchase ?? iap.requestSubscription;
  if (!requestPurchase || typeof iap.initConnection !== "function") {
    return null;
  }

  let initialized = false;
  async function ensureInit() {
    if (initialized) return;
    initialized = await iap.initConnection().catch(() => false);
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
      await ensureInit();
      // expo-iap accepts a string SKU or { sku } / { skus } depending on version.
      // We pass all common shapes — implementations ignore unknown fields.
      const raw = await requestPurchase({ sku: productId, skus: [productId], productId });
      // expo-iap may return an array or a single purchase.
      const purchase = Array.isArray(raw) ? raw[0] : raw;
      const entitlement = await purchaseToEntitlement(purchase, config);
      if (entitlement.activeEntitlementIds.length > 0) {
        await finishIfPossible(purchase);
      }
      return entitlement;
    },
    restorePurchases: async (config) => {
      await ensureInit();
      const purchases = typeof iap.getAvailablePurchases === "function"
        ? await iap.getAvailablePurchases().catch(() => [])
        : [];

      // Try each restored purchase against the entitlement map until one matches.
      for (const purchase of purchases) {
        const entitlement = await purchaseToEntitlement(purchase, config);
        if (entitlement.activeEntitlementIds.length > 0) {
          return entitlement;
        }
      }

      return { activeEntitlementIds: [], raw: purchases };
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
