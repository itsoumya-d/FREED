import { createSign } from "node:crypto";
import { recordPurchaseVerificationEvent } from "@/lib/backend-event-audit";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import {
  isAppleIssuerId,
  isAppleKeyId,
  isAppStoreServerEnvironment,
  isBundleId,
  isGoogleAccessToken,
  isGoogleServiceAccountEmail,
  isJwt,
  isPlaceholderValue,
  isPrivateKeyPem
} from "@/lib/server-credential-safety";

export type PurchaseVerificationPlatform = "ios" | "android";

export type SanitizedPurchase = {
  productId: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  purchaseToken: string | null;
  orderId: string | null;
  packageName: string | null;
  environment: string | null;
};

export type PurchaseVerificationRequest = {
  platform: PurchaseVerificationPlatform;
  entitlementId: string;
  purchase: SanitizedPurchase;
};

export type PurchaseVerificationResult = {
  active: boolean;
  entitlementId: string;
  provider: "apple-app-store" | "google-play" | "configured-provider" | "fallback";
  status: "ok" | "invalid" | "unconfigured" | "failed";
  productId?: string;
  transactionId?: string;
  orderId?: string;
  reason?: string;
};

export type PurchaseVerificationProvider = (
  request: PurchaseVerificationRequest
) => Promise<PurchaseVerificationResult>;

type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

const DEFAULT_PURCHASE_PROVIDER_TIMEOUT_MS = 8_000;
const MIN_PURCHASE_PROVIDER_TIMEOUT_MS = 500;
const MAX_PURCHASE_PROVIDER_TIMEOUT_MS = 15_000;
const DEFAULT_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES = 512_000;
const MIN_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES = 1_024;
const MAX_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES = 2_000_000;
const STORE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/;
const PRODUCT_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,179}$/;
const PURCHASE_TOKEN_PATTERN = /^[A-Za-z0-9._~:-]{8,4096}$/;
const SENSITIVE_STORE_TEXT_PATTERN = /\b(?:receipt|secret|password|private|raw|token=|access_token=|refresh_token=)\b/i;

let configuredProvider: PurchaseVerificationProvider | null = null;

export function configurePurchaseVerificationProvider(provider: PurchaseVerificationProvider | null) {
  configuredProvider = provider;
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, maxLength = 512) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function stringFromKeys(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return null;
}

function rejectStoreText(value: string | null) {
  if (!value) return null;
  if (isPlaceholderValue(value)) return null;
  if (/https?:\/\//i.test(value) || /[<>\s@]/.test(value)) return null;
  if (SENSITIVE_STORE_TEXT_PATTERN.test(value)) return null;
  return value;
}

function sanitizeProductId(value: string | null) {
  const normalized = rejectStoreText(value?.trim().slice(0, 180) ?? null);
  return normalized && PRODUCT_IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

function sanitizeStoreIdentifier(value: string | null, maxLength = 512) {
  const normalized = rejectStoreText(value?.trim().slice(0, maxLength) ?? null);
  return normalized && STORE_IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

function sanitizePurchaseToken(value: string | null) {
  const normalized = rejectStoreText(value?.trim().slice(0, 4_096) ?? null);
  return normalized && PURCHASE_TOKEN_PATTERN.test(normalized) ? normalized : null;
}

function sanitizeStoreEnvironment(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "sandbox" || normalized === "production" ? normalized : null;
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  const parts = value.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : atob(padded);
    const parsed = JSON.parse(decoded);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function base64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizePrivateKey(value: string | null) {
  return value?.replace(/\\n/g, "\n") ?? null;
}

function readPrivateKey(env: Env, key: string, base64Key: string) {
  const direct = normalizePrivateKey(readEnv(env, key));
  if (direct) return direct;
  const encoded = readEnv(env, base64Key);
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function derEcdsaToJose(signature: Buffer, partLength = 32) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("Invalid ECDSA signature.");
  const sequenceLength = signature[offset++];
  if (sequenceLength + offset !== signature.length) throw new Error("Invalid ECDSA signature length.");
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA signature R marker.");
  const rLength = signature[offset++];
  let r = signature.subarray(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA signature S marker.");
  const sLength = signature[offset++];
  let s = signature.subarray(offset, offset + sLength);

  while (r.length > partLength && r[0] === 0) r = r.subarray(1);
  while (s.length > partLength && s[0] === 0) s = s.subarray(1);
  if (r.length > partLength || s.length > partLength) throw new Error("Invalid ECDSA signature component length.");

  return Buffer.concat([Buffer.alloc(partLength - r.length), r, Buffer.alloc(partLength - s.length), s]);
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string, algorithm: "ES256" | "RS256") {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  const joseSignature = algorithm === "ES256" ? derEcdsaToJose(signature) : signature;
  return `${signingInput}.${base64Url(joseSignature)}`;
}

function createAppleServerJwt(env: Env) {
  const explicit = readEnv(env, "APP_STORE_SERVER_API_JWT");
  if (isJwt(explicit)) return explicit;

  const issuerId = readEnv(env, "APP_STORE_ISSUER_ID");
  const keyId = readEnv(env, "APP_STORE_KEY_ID");
  const bundleId = readEnv(env, "APP_STORE_BUNDLE_ID");
  const privateKey = readPrivateKey(env, "APP_STORE_PRIVATE_KEY", "APP_STORE_PRIVATE_KEY_BASE64");
  if (
    !issuerId ||
    !keyId ||
    !bundleId ||
    !privateKey ||
    !isAppleIssuerId(issuerId) ||
    !isAppleKeyId(keyId) ||
    !isBundleId(bundleId) ||
    !isPrivateKeyPem(privateKey)
  ) return null;

  const now = Math.floor(Date.now() / 1000);
  try {
    return signJwt(
      { alg: "ES256", kid: keyId, typ: "JWT" },
      {
        iss: issuerId,
        iat: now,
        exp: now + 20 * 60,
        aud: "appstoreconnect-v1",
        bid: bundleId
      },
      privateKey,
      "ES256"
    );
  } catch {
    return null;
  }
}

function readGoogleServiceAccount(env: Env) {
  const raw = readEnv(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  const encoded = readEnv(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64");
  const value = raw ?? (encoded ? Buffer.from(encoded, "base64").toString("utf8") : null);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function createGooglePlayAccessToken(env: Env, fetcher: Fetcher, timeoutMs: number, responseMaxBytes: number) {
  const explicit = readEnv(env, "GOOGLE_PLAY_ACCESS_TOKEN");
  if (isGoogleAccessToken(explicit)) return explicit;

  const serviceAccount = readGoogleServiceAccount(env);
  const clientEmail = serviceAccount ? stringValue(serviceAccount.client_email) : null;
  const privateKey = serviceAccount ? normalizePrivateKey(stringValue(serviceAccount.private_key, 8_000)) : null;
  if (!clientEmail || !privateKey || !isGoogleServiceAccountEmail(clientEmail) || !isPrivateKeyPem(privateKey)) return null;

  const now = Math.floor(Date.now() / 1000);
  let assertion: string;
  try {
    assertion = signJwt(
      { alg: "RS256", typ: "JWT" },
      {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      },
      privateKey,
      "RS256"
    );
  } catch {
    return null;
  }

  const response = await fetchStoreProviderResponse(
    fetcher,
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    },
    timeoutMs,
    "Google Play access-token request"
  );
  if (!response.ok) return null;
  const payload = await readStoreProviderJson(response, timeoutMs, "Google Play access-token response", responseMaxBytes).catch(() => null);
  return isRecord(payload) ? stringValue(payload.access_token, 4_000) : null;
}

export function sanitizePurchasePayload(value: unknown): SanitizedPurchase {
  const record = isRecord(value) ? value : {};
  const productIds = Array.isArray(record.productIds) ? record.productIds.filter((item): item is string => typeof item === "string") : [];
  const productId = stringFromKeys(record, ["productId", "productIdentifier", "sku"]) ?? productIds[0] ?? null;

  return {
    productId: sanitizeProductId(productId),
    transactionId: sanitizeStoreIdentifier(stringFromKeys(record, ["transactionId", "originalTransactionIdentifier", "id"])),
    originalTransactionId: sanitizeStoreIdentifier(stringFromKeys(record, ["originalTransactionId", "originalTransactionIdentifier"])),
    purchaseToken: sanitizePurchaseToken(stringFromKeys(record, ["purchaseToken", "purchaseTokenAndroid", "token"])),
    orderId: sanitizeStoreIdentifier(stringFromKeys(record, ["orderId", "orderID"])),
    packageName: sanitizeStoreIdentifier(stringFromKeys(record, ["packageName", "applicationId"]), 160),
    environment: sanitizeStoreEnvironment(stringFromKeys(record, ["environment", "storeEnvironment"]))
  };
}

function allowedProductIds(env: Env) {
  return new Set(
    [
      readEnv(env, "IAP_PRODUCT_YEARLY") ?? readEnv(env, "EXPO_PUBLIC_IAP_PRODUCT_YEARLY") ?? "freed_premium_yearly",
      readEnv(env, "IAP_PRODUCT_MONTHLY") ?? readEnv(env, "EXPO_PUBLIC_IAP_PRODUCT_MONTHLY") ?? "freed_premium_monthly",
      readEnv(env, "IAP_PRODUCT_LIFETIME") ?? readEnv(env, "EXPO_PUBLIC_IAP_PRODUCT_LIFETIME") ?? "freed_premium_lifetime"
    ].filter(Boolean)
  );
}

function isSubscriptionProduct(productId: string, env: Env) {
  const explicit = readEnv(env, "GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS");
  if (explicit) return explicit.split(",").map((item) => item.trim()).includes(productId);
  return /monthly|yearly|annual|subscription/i.test(productId);
}

function invalid(entitlementId: string, reason: string): PurchaseVerificationResult {
  return {
    active: false,
    entitlementId,
    provider: "fallback",
    status: "invalid",
    reason
  };
}

function unconfigured(entitlementId: string, provider: PurchaseVerificationResult["provider"], reason: string): PurchaseVerificationResult {
  return {
    active: false,
    entitlementId,
    provider,
    status: "unconfigured",
    reason
  };
}

function failed(entitlementId: string, provider: PurchaseVerificationResult["provider"], reason: string): PurchaseVerificationResult {
  return {
    active: false,
    entitlementId,
    provider,
    status: "failed",
    reason: sanitizePurchaseReason(reason) ?? "Purchase verification failed."
  };
}

function sanitizePurchaseReason(value: string | null, maxLength = 240) {
  if (!value) return null;
  return value
    .replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/([?&](?:token|key|secret|receipt|purchaseToken)=)[^"'&\s]+/gi, "$1[redacted]")
    .replace(/\b(?:raw[-_\s]*)?(?:ios|app[-_\s]?store|apple|purchase)?[-_\s]*receipt(?:[-_\s]?(?:data|secret|payload))?\b/gi, "[redacted-receipt]")
    .replace(/\b(?:purchase[-_\s]?token|receipt[-_\s]?data|access[-_\s]?token|refresh[-_\s]?token|secret)[A-Za-z0-9._~:-]*\b/gi, "[redacted-token]")
    .replace(/\bya29\.[A-Za-z0-9._-]{10,}\b/g, "[redacted-google-token]")
    .replace(/\bGPA\.[A-Za-z0-9._-]+\b/g, "[redacted-order-id]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function ok(entitlementId: string, provider: PurchaseVerificationResult["provider"], metadata: Omit<PurchaseVerificationResult, "active" | "entitlementId" | "provider" | "status"> = {}): PurchaseVerificationResult {
  return {
    active: true,
    entitlementId,
    provider,
    status: "ok",
    ...metadata
  };
}

function validateRequest(input: unknown, env: Env): PurchaseVerificationRequest | PurchaseVerificationResult {
  if (!isRecord(input)) return invalid("premium", "Malformed verification request.");
  const platform = input.platform === "ios" || input.platform === "android" ? input.platform : null;
  const entitlementId = sanitizeStoreIdentifier(stringValue(input.entitlementId, 80), 80) ?? "premium";
  if (!platform) return invalid(entitlementId, "Unsupported purchase platform.");

  const purchase = sanitizePurchasePayload(input.purchase);
  if (!purchase.productId) return invalid(entitlementId, "Missing product id.");
  if (!allowedProductIds(env).has(purchase.productId)) return invalid(entitlementId, "Product id is not configured for FREED premium.");
  if (platform === "ios" && !(purchase.transactionId || purchase.originalTransactionId)) {
    return invalid(entitlementId, "Missing or invalid App Store transaction id.");
  }
  if (platform === "android" && !purchase.purchaseToken) {
    return invalid(entitlementId, "Missing or invalid Google Play purchase token.");
  }
  if (platform === "android" && purchase.packageName && !isBundleId(purchase.packageName)) {
    return invalid(entitlementId, "Invalid Google Play package name.");
  }

  return { platform, entitlementId, purchase };
}

async function verifyApplePurchase(request: PurchaseVerificationRequest, env: Env, fetcher: Fetcher): Promise<PurchaseVerificationResult> {
  const timeoutMs = readPurchaseProviderTimeoutMs(env);
  const responseMaxBytes = readPurchaseProviderResponseMaxBytes(env);
  const jwt = createAppleServerJwt(env);
  const bundleId = readEnv(env, "APP_STORE_BUNDLE_ID");
  const transactionId = request.purchase.transactionId ?? request.purchase.originalTransactionId;
  const envName = (readEnv(env, "APP_STORE_SERVER_API_ENV") ?? request.purchase.environment ?? "production").toLowerCase();
  if (!jwt || !isBundleId(bundleId) || !isAppStoreServerEnvironment(envName)) {
    return unconfigured(request.entitlementId, "apple-app-store", "App Store server API credentials are not configured.");
  }
  if (!transactionId) return invalid(request.entitlementId, "Missing App Store transaction id.");

  const baseUrl = envName === "sandbox" ? "https://api.storekit-sandbox.itunes.apple.com" : "https://api.storekit.itunes.apple.com";
  let response: Response;
  try {
    response = await fetchStoreProviderResponse(
      fetcher,
      `${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${jwt}` }
      },
      timeoutMs,
      "App Store transaction verification"
    );
  } catch (error) {
    return failed(request.entitlementId, "apple-app-store", error instanceof Error ? error.message : "App Store verification failed.");
  }
  if (!response.ok) return failed(request.entitlementId, "apple-app-store", `App Store verification returned ${response.status}.`);

  const payload = await readStoreProviderJson(response, timeoutMs, "App Store transaction response", responseMaxBytes).catch(() => null);
  const signedInfo = isRecord(payload) ? stringValue(payload.signedTransactionInfo, 10_000) : null;
  const transaction = signedInfo ? decodeBase64UrlJson(signedInfo) : null;
  const productId = transaction ? stringValue(transaction.productId) : null;
  const responseBundleId = transaction ? stringValue(transaction.bundleId) : null;
  const revoked = transaction ? transaction.revocationDate !== undefined && transaction.revocationDate !== null : false;
  const expiresDate = transaction ? Number(transaction.expiresDate) : null;
  const notExpired = !expiresDate || expiresDate > Date.now();

  if (!productId || productId !== request.purchase.productId) return failed(request.entitlementId, "apple-app-store", "App Store product id mismatch.");
  if (responseBundleId !== bundleId) return failed(request.entitlementId, "apple-app-store", "App Store bundle id mismatch.");
  if (revoked || !notExpired) return failed(request.entitlementId, "apple-app-store", "App Store entitlement is not active.");

  return ok(request.entitlementId, "apple-app-store", { productId, transactionId });
}

async function verifyGooglePurchase(request: PurchaseVerificationRequest, env: Env, fetcher: Fetcher): Promise<PurchaseVerificationResult> {
  const timeoutMs = readPurchaseProviderTimeoutMs(env);
  const responseMaxBytes = readPurchaseProviderResponseMaxBytes(env);
  let accessToken: string | null = null;
  try {
    accessToken = await createGooglePlayAccessToken(env, fetcher, timeoutMs, responseMaxBytes);
  } catch (error) {
    return failed(request.entitlementId, "google-play", error instanceof Error ? error.message : "Google Play access-token request failed.");
  }
  const packageName = readEnv(env, "GOOGLE_PLAY_PACKAGE_NAME");
  const productId = request.purchase.productId;
  const token = request.purchase.purchaseToken;
  if (!accessToken || !isBundleId(packageName)) {
    return unconfigured(request.entitlementId, "google-play", "Google Play verification credentials are not configured.");
  }
  if (request.purchase.packageName && request.purchase.packageName !== packageName) {
    return invalid(request.entitlementId, "Google Play package name does not match FREED configuration.");
  }
  if (!productId || !token) return invalid(request.entitlementId, "Missing Google Play product id or purchase token.");
  const verifiedPackageName = packageName ?? "";

  const encodedPackage = encodeURIComponent(verifiedPackageName);
  const encodedProduct = encodeURIComponent(productId);
  const encodedToken = encodeURIComponent(token);
  const subscription = isSubscriptionProduct(productId, env);
  const url = subscription
    ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackage}/purchases/subscriptionsv2/tokens/${encodedToken}`
    : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackage}/purchases/products/${encodedProduct}/tokens/${encodedToken}`;

  let response: Response;
  try {
    response = await fetchStoreProviderResponse(
      fetcher,
      url,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      timeoutMs,
      "Google Play purchase verification"
    );
  } catch (error) {
    return failed(request.entitlementId, "google-play", error instanceof Error ? error.message : "Google Play verification failed.");
  }
  if (!response.ok) return failed(request.entitlementId, "google-play", `Google Play verification returned ${response.status}.`);

  const payload = await readStoreProviderJson(response, timeoutMs, "Google Play purchase response", responseMaxBytes).catch(() => null);
  if (!isRecord(payload)) return failed(request.entitlementId, "google-play", "Google Play verification returned malformed JSON.");

  if (subscription) {
    const state = stringValue(payload.subscriptionState);
    const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems.filter(isRecord) : [];
    const matchingLine = lineItems.find((item) => stringValue(item.productId) === productId);
    const expiryTime = matchingLine ? Date.parse(stringValue(matchingLine.expiryTime) ?? "") : Number.NaN;
    const activeState = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";
    if (!matchingLine || !activeState || !Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
      return failed(request.entitlementId, "google-play", "Google Play subscription is not active.");
    }
    return ok(request.entitlementId, "google-play", { productId, orderId: stringValue(payload.latestOrderId) ?? undefined });
  }

  const purchaseState = typeof payload.purchaseState === "number" ? payload.purchaseState : null;
  if (purchaseState !== 0) return failed(request.entitlementId, "google-play", "Google Play product is not purchased.");
  return ok(request.entitlementId, "google-play", { productId, orderId: stringValue(payload.orderId) ?? request.purchase.orderId ?? undefined });
}

function safeResult(result: PurchaseVerificationResult, request: PurchaseVerificationRequest): PurchaseVerificationResult {
  return {
    active: Boolean(result.active),
    entitlementId: sanitizeStoreIdentifier(stringValue(result.entitlementId, 80), 80) ?? request.entitlementId,
    provider: result.provider,
    status: result.status,
    productId: sanitizeProductId(stringValue(result.productId ?? request.purchase.productId, 180)) ?? undefined,
    transactionId: sanitizeStoreIdentifier(stringValue(result.transactionId ?? request.purchase.transactionId, 512)) ?? undefined,
    orderId: sanitizeStoreIdentifier(stringValue(result.orderId ?? request.purchase.orderId, 512)) ?? undefined,
    reason: sanitizePurchaseReason(stringValue(result.reason, 240)) ?? undefined
  };
}

export async function verifyPurchasePayload(input: unknown, options: { env?: Env; fetcher?: Fetcher } = {}): Promise<PurchaseVerificationResult> {
  const env = options.env ?? process.env;
  const request = validateRequest(input, env);
  if ("active" in request) return request;

  let result: PurchaseVerificationResult;
  try {
    if (configuredProvider) {
      result = safeResult(await configuredProvider(request), request);
    } else if (request.platform === "ios") {
      result = await verifyApplePurchase(request, env, options.fetcher ?? fetch);
    } else {
      result = await verifyGooglePurchase(request, env, options.fetcher ?? fetch);
    }
  } catch (error) {
    result = failed(request.entitlementId, "fallback", error instanceof Error ? error.message : "Purchase verification failed.");
  }

  await recordPurchaseVerificationAudit(request, result, env);
  return result;
}

async function recordPurchaseVerificationAudit(
  request: PurchaseVerificationRequest,
  result: PurchaseVerificationResult,
  env: Env
) {
  const storeEnvironment = normalizeStoreEnvironment(request.purchase.environment ?? readEnv(env, "APP_STORE_SERVER_API_ENV"));
  const verificationStatus = result.active && result.status === "ok" ? "granted" : result.status === "failed" || result.status === "invalid" ? "rejected" : "error";

  await recordPurchaseVerificationEvent(
    {
      platform: request.platform,
      storeEnvironment,
      productId: request.purchase.productId ?? result.productId ?? "unknown-product",
      entitlementId: result.entitlementId,
      verificationStatus,
      transactionId: request.purchase.transactionId ?? request.purchase.originalTransactionId,
      orderId: request.purchase.orderId ?? result.orderId,
      purchaseToken: request.purchase.purchaseToken,
      failureCode: result.status === "ok" ? null : `${result.provider}:${result.status}`
    },
    { env }
  ).catch(() => null);
}

function normalizeStoreEnvironment(value: string | null): "sandbox" | "production" {
  return value?.toLowerCase() === "sandbox" ? "sandbox" : "production";
}

async function fetchStoreProviderResponse(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(input, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readStoreProviderJson(response: Response, timeoutMs: number, label: string, maxBytes: number) {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}

function readPurchaseProviderTimeoutMs(env: Env) {
  return normalizePurchaseProviderTimeoutMs(readEnv(env, "FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS"));
}

function readPurchaseProviderResponseMaxBytes(env: Env) {
  return normalizePurchaseProviderResponseMaxBytes(readEnv(env, "FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES"));
}

function normalizePurchaseProviderTimeoutMs(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_PURCHASE_PROVIDER_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_PURCHASE_PROVIDER_TIMEOUT_MS;
  return Math.max(MIN_PURCHASE_PROVIDER_TIMEOUT_MS, Math.min(MAX_PURCHASE_PROVIDER_TIMEOUT_MS, Math.round(parsed)));
}

function normalizePurchaseProviderResponseMaxBytes(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES;
  if (!Number.isFinite(parsed)) return DEFAULT_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES,
    Math.min(MAX_PURCHASE_PROVIDER_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}
