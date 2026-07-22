import { createHash } from "node:crypto";

import {
  APIError,
  APIException,
  AppStoreServerAPIClient,
  Environment,
  InAppOwnershipType,
  SignedDataVerifier,
  Type,
  VerificationException,
  VerificationStatus
} from "@apple/app-store-server-library";
import { GoogleAuth } from "google-auth-library";

export const APPLE_BUNDLE_ID = "app.freed.recovery";
export const GOOGLE_PACKAGE_NAME = "app.freed.recovery";
export const GOOGLE_ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
export const CORE_PRODUCT_IDS = [
  "freed_premium_monthly",
  "freed_premium_yearly",
  "freed_premium_lifetime"
] as const;

export type CoreProductId = typeof CORE_PRODUCT_IDS[number];
export type PurchasePlatform = "ios" | "android";
export type PurchaseResultStatus = "verified" | "inactive" | "rejected" | "unavailable";

export type VerifyStorePurchaseRequest =
  | { platform: "ios"; productId: CoreProductId; transactionId: string; clientEventId: string; restore: boolean }
  | { platform: "android"; productId: CoreProductId; purchaseToken: string; clientEventId: string; restore: boolean };

export type VerifyStorePurchaseResult = {
  active: boolean;
  entitlementId: "premium";
  productId: CoreProductId;
  platform: PurchasePlatform;
  status: PurchaseResultStatus;
  expiresAt: string | null;
};

export type VerifiedStorePurchase = {
  platform: PurchasePlatform;
  productId: CoreProductId;
  storeReference: string;
  orderReference?: string;
  expiresAt: number | null;
  environment?: "Production" | "Sandbox";
};

export type PurchaseClaimInput = {
  uid: string;
  provider: "apple" | "google-play";
  productId: CoreProductId;
  storeReferenceHash: string;
  orderReferenceHash?: string;
  verifiedAt: number;
  expiresAt: number | null;
};

export type PurchaseAuthorizationResult = "allowed" | "duplicate" | "rate-limited" | "account-deleting";
export type PurchaseClaimResult = "claimed" | "owned" | "conflict" | "account-deleting" | "unavailable";

export class PurchaseInputError extends Error {
  constructor() {
    super("The purchase payload is not permitted.");
    this.name = "PurchaseInputError";
  }
}

export class PurchaseAccessError extends Error {
  constructor(readonly reason: "rate-limited" | "account-deleting") {
    super("Purchase verification is not available.");
    this.name = "PurchaseAccessError";
  }
}

export class PurchaseProviderError extends Error {
  constructor(readonly status: "rejected" | "unavailable") {
    super("Store verification could not establish an entitlement.");
    this.name = "PurchaseProviderError";
  }
}

export function parseVerifyStorePurchaseRequest(value: unknown): VerifyStorePurchaseRequest {
  if (serializedBytes(value) > 16 * 1024 || !isRecord(value)) invalidInput();
  if (value.platform === "ios") {
    if (!hasExactKeys(value, ["platform", "productId", "transactionId", "clientEventId", "restore"])) invalidInput();
    if (!isCoreProductId(value.productId) || !isAppleTransactionId(value.transactionId) ||
      !isClientEventId(value.clientEventId) || typeof value.restore !== "boolean") invalidInput();
    return {
      platform: "ios",
      productId: value.productId,
      transactionId: value.transactionId,
      clientEventId: value.clientEventId,
      restore: value.restore
    };
  }
  if (value.platform === "android") {
    if (!hasExactKeys(value, ["platform", "productId", "purchaseToken", "clientEventId", "restore"])) invalidInput();
    if (!isCoreProductId(value.productId) || !isGooglePurchaseToken(value.purchaseToken) ||
      !isClientEventId(value.clientEventId) || typeof value.restore !== "boolean") invalidInput();
    return {
      platform: "android",
      productId: value.productId,
      purchaseToken: value.purchaseToken,
      clientEventId: value.clientEventId,
      restore: value.restore
    };
  }
  invalidInput();
}

export function hashStoreReference(reference: string): string {
  if (typeof reference !== "string" || reference.length < 8 || reference.length > 4096) {
    throw new Error("Invalid server-owned store reference.");
  }
  return createHash("sha256").update(reference, "utf8").digest("hex");
}

/** Stable UUID used only to bind an Apple appAccountToken to the Firebase UID. */
export function deriveAppleAppAccountToken(uid: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Invalid account identity.");
  const bytes = createHash("sha256").update(`freed:apple-app-account:${uid}`, "utf8").digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type PurchaseProvider = {
  verify(input: Record<string, unknown>): Promise<VerifiedStorePurchase>;
};

export function createPurchaseVerificationService(dependencies: {
  now: () => number;
  authorize: (input: { uid: string; clientEventId: string }) => Promise<PurchaseAuthorizationResult>;
  apple: PurchaseProvider;
  google: PurchaseProvider;
  claimVerifiedPurchase: (input: PurchaseClaimInput) => Promise<PurchaseClaimResult>;
}) {
  return {
    async verify(uid: string, value: unknown): Promise<VerifyStorePurchaseResult> {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new PurchaseAccessError("account-deleting");
      const input = parseVerifyStorePurchaseRequest(value);
      const fallback = (status: PurchaseResultStatus): VerifyStorePurchaseResult => ({
        active: false,
        entitlementId: "premium",
        productId: input.productId,
        platform: input.platform,
        status,
        expiresAt: null
      });

      const authorization = await dependencies.authorize({ uid, clientEventId: input.clientEventId });
      if (authorization === "duplicate") return fallback("unavailable");
      if (authorization !== "allowed") throw new PurchaseAccessError(authorization);

      let verified: VerifiedStorePurchase;
      try {
        verified = input.platform === "ios"
          ? await dependencies.apple.verify({
              transactionId: input.transactionId,
              productId: input.productId,
              expectedAppAccountToken: deriveAppleAppAccountToken(uid)
            })
          : await dependencies.google.verify({ productId: input.productId, purchaseToken: input.purchaseToken });
      } catch (error) {
        return fallback(error instanceof PurchaseProviderError ? error.status : "unavailable");
      }

      if (verified.platform !== input.platform || verified.productId !== input.productId ||
        (verified.expiresAt !== null && (!Number.isFinite(verified.expiresAt) || verified.expiresAt <= dependencies.now()))) {
        return fallback("rejected");
      }

      let claim: PurchaseClaimResult;
      try {
        claim = await dependencies.claimVerifiedPurchase({
          uid,
          provider: input.platform === "ios" ? "apple" : "google-play",
          productId: input.productId,
          storeReferenceHash: hashStoreReference(verified.storeReference),
          ...(verified.orderReference ? { orderReferenceHash: hashStoreReference(verified.orderReference) } : {}),
          verifiedAt: dependencies.now(),
          expiresAt: verified.expiresAt
        });
      } catch {
        claim = "unavailable";
      }
      if (claim !== "claimed" && claim !== "owned") return fallback(claim === "conflict" ? "rejected" : "unavailable");

      return {
        active: true,
        entitlementId: "premium",
        productId: input.productId,
        platform: input.platform,
        status: "verified",
        expiresAt: verified.expiresAt === null ? null : new Date(verified.expiresAt).toISOString()
      };
    }
  };
}

export type AppleEnvironmentName = "Production" | "Sandbox";
export type AppleLibraryBoundary = {
  createClient(input: {
    privateKey: string;
    keyId: string;
    issuerId: string;
    bundleId: string;
    environment: AppleEnvironmentName;
  }): { getTransactionInfo(transactionId: string): Promise<{ signedTransactionInfo?: string }> };
  createVerifier(input: {
    rootCertificates: Buffer[];
    enableOnlineChecks: true;
    environment: AppleEnvironmentName;
    bundleId: string;
    appAppleId?: number;
  }): { verifyAndDecodeTransaction(signed: string): Promise<Record<string, unknown>> };
  isNotFoundOrEnvironmentMismatch(error: unknown): boolean;
};

const officialAppleBoundary: AppleLibraryBoundary = {
  createClient(input) {
    return new AppStoreServerAPIClient(
      input.privateKey,
      input.keyId,
      input.issuerId,
      input.bundleId,
      input.environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX
    );
  },
  createVerifier(input) {
    return new SignedDataVerifier(
      input.rootCertificates,
      input.enableOnlineChecks,
      input.environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX,
      input.bundleId,
      input.appAppleId
    ) as unknown as { verifyAndDecodeTransaction(signed: string): Promise<Record<string, unknown>> };
  },
  isNotFoundOrEnvironmentMismatch(error) {
    return (error instanceof APIException && error.apiError === APIError.TRANSACTION_ID_NOT_FOUND) ||
      (error instanceof VerificationException && error.status === VerificationStatus.INVALID_ENVIRONMENT);
  }
};

export function createAppleStoreProvider(
  unvalidatedConfig: {
    issuerId: string;
    keyId: string;
    privateKey: string;
    appAppleId: string;
    rootCertificatesBase64: string;
  },
  library: AppleLibraryBoundary = officialAppleBoundary,
  now: () => number = () => Date.now(),
  timeoutMs = 10_000
) {
  return {
    async verify(input: Record<string, unknown>): Promise<VerifiedStorePurchase> {
      const transactionId = input.transactionId;
      const productId = input.productId;
      const expectedAppAccountToken = input.expectedAppAccountToken;
      if (!isAppleTransactionId(transactionId) || !isCoreProductId(productId) ||
        typeof expectedAppAccountToken !== "string" || !isUuid(expectedAppAccountToken)) {
        throw new PurchaseProviderError("rejected");
      }
      let config: ReturnType<typeof parseAppleConfig>;
      try {
        config = parseAppleConfig(unvalidatedConfig);
      } catch {
        throw new PurchaseProviderError("unavailable");
      }
      try {
        return await verifyAppleEnvironment("Production", config, library, {
          transactionId,
          productId,
          expectedAppAccountToken
        }, now(), timeoutMs);
      } catch (error) {
        if (!library.isNotFoundOrEnvironmentMismatch(error)) {
          if (error instanceof PurchaseProviderError) throw error;
          throw new PurchaseProviderError("unavailable");
        }
      }
      try {
        return await verifyAppleEnvironment("Sandbox", config, library, {
          transactionId,
          productId,
          expectedAppAccountToken
        }, now(), timeoutMs);
      } catch (error) {
        if (error instanceof PurchaseProviderError) throw error;
        throw new PurchaseProviderError("unavailable");
      }
    }
  };
}

async function verifyAppleEnvironment(
  environment: AppleEnvironmentName,
  config: ReturnType<typeof parseAppleConfig>,
  library: AppleLibraryBoundary,
  input: { transactionId: string; productId: CoreProductId; expectedAppAccountToken: string },
  now: number,
  timeoutMs: number
): Promise<VerifiedStorePurchase> {
  const client = library.createClient({
    privateKey: config.privateKey,
    keyId: config.keyId,
    issuerId: config.issuerId,
    bundleId: APPLE_BUNDLE_ID,
    environment
  });
  const response = await withTimeout(client.getTransactionInfo(input.transactionId), timeoutMs);
  if (!isCompactJws(response.signedTransactionInfo)) throw new PurchaseProviderError("rejected");
  const verifier = library.createVerifier({
    rootCertificates: config.rootCertificates,
    enableOnlineChecks: true,
    environment,
    bundleId: APPLE_BUNDLE_ID,
    ...(environment === "Production" ? { appAppleId: config.appAppleId } : {})
  });
  let decoded: Record<string, unknown>;
  try {
    decoded = await withTimeout(verifier.verifyAndDecodeTransaction(response.signedTransactionInfo), timeoutMs);
  } catch (error) {
    if (library.isNotFoundOrEnvironmentMismatch(error)) throw error;
    throw new PurchaseProviderError("rejected");
  }
  validateAppleTransaction(decoded, environment, config.appAppleId, input, now);
  return {
    platform: "ios",
    productId: input.productId,
    storeReference: decoded.originalTransactionId as string,
    orderReference: input.transactionId,
    expiresAt: input.productId === "freed_premium_lifetime" ? null : decoded.expiresDate as number,
    environment
  };
}

function validateAppleTransaction(
  decoded: Record<string, unknown>,
  environment: AppleEnvironmentName,
  appAppleId: number,
  input: { transactionId: string; productId: CoreProductId; expectedAppAccountToken: string },
  now: number
): void {
  const subscription = input.productId !== "freed_premium_lifetime";
  const datesValid = validAppleDate(decoded.purchaseDate, now) && validAppleDate(decoded.signedDate, now);
  const appIdValid = decoded.appAppleId === undefined || decoded.appAppleId === appAppleId;
  const accountTokenValid = decoded.appAccountToken === undefined || decoded.appAccountToken === input.expectedAppAccountToken;
  const baseValid = decoded.transactionId === input.transactionId && decoded.productId === input.productId &&
    isAppleTransactionId(decoded.originalTransactionId) &&
    decoded.bundleId === APPLE_BUNDLE_ID && decoded.environment === environment && appIdValid && accountTokenValid && datesValid &&
    decoded.inAppOwnershipType === InAppOwnershipType.PURCHASED && decoded.revocationDate === undefined &&
    decoded.revocationReason === undefined && decoded.isUpgraded !== true &&
    (decoded.quantity === undefined || decoded.quantity === 1);
  const typeValid = subscription
    ? decoded.type === Type.AUTO_RENEWABLE_SUBSCRIPTION && validFutureDate(decoded.expiresDate, now)
    : decoded.type === Type.NON_CONSUMABLE && decoded.expiresDate === undefined;
  if (!baseValid || !typeValid) throw new PurchaseProviderError("rejected");
}

function parseAppleConfig(value: {
  issuerId: string;
  keyId: string;
  privateKey: string;
  appAppleId: string;
  rootCertificatesBase64: string;
}) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(value.issuerId) || !/^[A-Za-z0-9]{8,32}$/.test(value.keyId) ||
    !/^-----BEGIN PRIVATE KEY-----\n[\s\S]{1,16384}\n-----END PRIVATE KEY-----\n?$/.test(value.privateKey) ||
    !/^\d{6,20}$/.test(value.appAppleId)) throw new Error("Invalid Apple store configuration.");
  const appAppleId = Number(value.appAppleId);
  if (!Number.isSafeInteger(appAppleId) || appAppleId <= 0) throw new Error("Invalid Apple store configuration.");
  let encoded: unknown;
  try { encoded = JSON.parse(value.rootCertificatesBase64); } catch { throw new Error("Invalid Apple store configuration."); }
  if (!Array.isArray(encoded) || encoded.length < 1 || encoded.length > 10 || encoded.some((item) => !isCanonicalBase64(item))) {
    throw new Error("Invalid Apple store configuration.");
  }
  return {
    issuerId: value.issuerId,
    keyId: value.keyId,
    privateKey: value.privateKey,
    appAppleId,
    rootCertificates: encoded.map((item) => Buffer.from(item as string, "base64"))
  };
}

export type GooglePlayBoundary = {
  getAuthorizationHeaders: (serviceAccount: Record<string, string>, scopes: string[]) => Promise<Record<string, string>>;
  fetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
};

const officialGoogleBoundary: GooglePlayBoundary = {
  async getAuthorizationHeaders(serviceAccount, scopes) {
    const auth = new GoogleAuth({ credentials: serviceAccount, scopes });
    const headers = await auth.getRequestHeaders();
    return normalizeGoogleAuthorizationHeaders(headers);
  },
  fetch: (url, init) => fetch(url, init)
};

export function normalizeGoogleAuthorizationHeaders(value: unknown): Record<string, string> {
  let authorization: string | undefined;
  const headerLike = value as { forEach?: (callback: (headerValue: string, key: string) => void) => void };
  if (typeof headerLike?.forEach === "function") {
    headerLike.forEach((headerValue, key) => {
      if (key.toLowerCase() === "authorization") authorization = headerValue;
    });
  } else if (isRecord(value)) {
    for (const [key, headerValue] of Object.entries(value)) {
      if (key.toLowerCase() === "authorization" && typeof headerValue === "string") authorization = headerValue;
    }
  }
  return authorization ? { authorization } : {};
}

export function createGooglePlayProvider(
  serviceAccountJson: string,
  boundary: GooglePlayBoundary = officialGoogleBoundary,
  now: () => number = () => Date.now(),
  timeoutMs = 10_000
) {
  return {
    async verify(input: Record<string, unknown>): Promise<VerifiedStorePurchase> {
      if (!isCoreProductId(input.productId) || !isGooglePurchaseToken(input.purchaseToken)) {
        throw new PurchaseProviderError("rejected");
      }
      let serviceAccount: Record<string, string>;
      try { serviceAccount = parseGoogleServiceAccount(serviceAccountJson); }
      catch { throw new PurchaseProviderError("unavailable"); }
      let headers: Record<string, string>;
      try {
        headers = await withTimeout(
          boundary.getAuthorizationHeaders(serviceAccount, [GOOGLE_ANDROID_PUBLISHER_SCOPE]),
          timeoutMs
        );
      } catch {
        throw new PurchaseProviderError("unavailable");
      }
      const authorization = Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization")?.[1];
      if (typeof authorization !== "string" || !/^Bearer \S{8,4096}$/.test(authorization)) {
        throw new PurchaseProviderError("unavailable");
      }
      const resource = input.productId === "freed_premium_lifetime" ? "productsv2" : "subscriptionsv2";
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME)}/purchases/${resource}/tokens/${encodeURIComponent(input.purchaseToken)}`;
      let body: unknown;
      try {
        const response = await fetchWithHardTimeout(boundary.fetch, url, {
          method: "GET",
          redirect: "error",
          headers: { accept: "application/json", authorization }
        }, timeoutMs);
        body = await readBoundedJson(response, 512 * 1024);
      } catch {
        throw new PurchaseProviderError("unavailable");
      }
      if (input.productId === "freed_premium_lifetime") {
        return validateGoogleLifetime(body, input.productId, input.purchaseToken, now());
      }
      return validateGoogleSubscription(body, input.productId, input.purchaseToken, now());
    }
  };
}

function validateGoogleSubscription(
  value: unknown,
  productId: Exclude<CoreProductId, "freed_premium_lifetime">,
  purchaseToken: string,
  now: number
): VerifiedStorePurchase {
  if (!isRecord(value) || !["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(String(value.subscriptionState)) ||
    !["ACKNOWLEDGEMENT_STATE_PENDING", "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"].includes(String(value.acknowledgementState)) ||
    !Array.isArray(value.lineItems) || value.lineItems.length !== 1 || !isRecord(value.lineItems[0]) ||
    value.lineItems[0].productId !== productId || !validFutureTimestamp(value.lineItems[0].expiryTime, now)) {
    throw new PurchaseProviderError("rejected");
  }
  return {
    platform: "android",
    productId,
    storeReference: purchaseToken,
    ...(isBoundedProviderReference(value.latestOrderId) ? { orderReference: value.latestOrderId } : {}),
    expiresAt: Date.parse(value.lineItems[0].expiryTime)
  };
}

function validateGoogleLifetime(
  value: unknown,
  productId: "freed_premium_lifetime",
  purchaseToken: string,
  now: number
): VerifiedStorePurchase {
  const lineItems = isRecord(value) ? value.productLineItem : undefined;
  const line = Array.isArray(lineItems) && lineItems.length === 1 && isRecord(lineItems[0]) ? lineItems[0] : null;
  const offer = line && isRecord(line.productOfferDetails) ? line.productOfferDetails : null;
  if (!isRecord(value) || !isRecord(value.purchaseStateContext) || value.purchaseStateContext.purchaseState !== "PURCHASED" ||
    !["ACKNOWLEDGEMENT_STATE_PENDING", "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"].includes(String(value.acknowledgementState)) ||
    !line || line.productId !== productId || !offer || offer.quantity !== 1 || offer.refundableQuantity !== 1 ||
    offer.consumptionState !== "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" ||
    !validPastOrPresentTimestamp(value.purchaseCompletionTime, now)) {
    throw new PurchaseProviderError("rejected");
  }
  return {
    platform: "android",
    productId,
    storeReference: purchaseToken,
    ...(isBoundedProviderReference(value.orderId) ? { orderReference: value.orderId } : {}),
    expiresAt: null
  };
}

async function fetchWithHardTimeout(
  fetcher: GooglePlayBoundary["fetch"],
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  return withTimeout(fetcher(url, { ...init, signal: controller.signal }), timeoutMs, () => controller.abort());
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error("Provider unavailable."));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.ok || response.redirected || response.type === "opaqueredirect") throw new Error("Provider unavailable.");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("Provider unavailable.");
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new Error("Provider unavailable.");
  if (!response.body) throw new Error("Provider unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Provider unavailable.");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks, total);
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

function parseGoogleServiceAccount(value: string): Record<string, string> {
  if (typeof value !== "string" || value.length < 64 || value.length > 64 * 1024) throw new Error("Invalid Google configuration.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Invalid Google configuration."); }
  if (!isRecord(parsed) || parsed.type !== "service_account") throw new Error("Invalid Google configuration.");
  const required = ["type", "project_id", "private_key_id", "private_key", "client_email", "client_id"] as const;
  for (const key of required) if (typeof parsed[key] !== "string" || parsed[key].length < 2 || parsed[key].length > 16 * 1024) {
    throw new Error("Invalid Google configuration.");
  }
  if (!String(parsed.private_key).startsWith("-----BEGIN PRIVATE KEY-----\n") ||
    !String(parsed.private_key).includes("\n-----END PRIVATE KEY-----") ||
    !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(String(parsed.client_email))) {
    throw new Error("Invalid Google configuration.");
  }
  return Object.fromEntries(required.map((key) => [key, String(parsed[key])]));
}

function serializedBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? Buffer.byteLength(serialized, "utf8") : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function invalidInput(): never { throw new PurchaseInputError(); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
function isCoreProductId(value: unknown): value is CoreProductId {
  return typeof value === "string" && (CORE_PRODUCT_IDS as readonly string[]).includes(value);
}
function isClientEventId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
function isAppleTransactionId(value: unknown): value is string {
  return typeof value === "string" && /^\d{8,32}$/.test(value);
}
function isGooglePurchaseToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 4096 &&
    /^[\x21-\x7E]+$/.test(value) && !value.includes("://");
}
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isCompactJws(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 64 * 1024 && value.split(".").length === 3;
}
function isCanonicalBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 4 || value.length > 32 * 1024 || value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}
function validAppleDate(value: unknown, now: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= now + 5 * 60_000;
}
function validFutureDate(value: unknown, now: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > now;
}
function validFutureTimestamp(value: unknown, now: number): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && milliseconds > now;
}
function validPastOrPresentTimestamp(value: unknown, now: number): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= now + 5 * 60_000;
}
function isBoundedProviderReference(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200 && /^[\x21-\x7E]+$/.test(value);
}
