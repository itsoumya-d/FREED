import { createHash } from "node:crypto";
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "@apple/app-store-server-library";
import {
  APPLE_BUNDLE_ID, CORE_PRODUCT_IDS, GOOGLE_PACKAGE_NAME, PurchaseProviderError,
  deriveAppleAppAccountToken, hashStoreReference,
  type AppleEnvironmentName, type CoreProductId, type PurchaseProvider
} from "./purchase.js";

export const SUBSCRIPTION_NOTIFICATION_MAX_BYTES = 64 * 1024;
export const SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS = 8_000;
export const SUBSCRIPTION_RECEIPT_TTL_MS = 400 * 86_400_000;

export type SubscriptionProvider = "apple" | "google-play";
export type SubscriptionClaimStatus = "verified" | "inactive" | "expired" | "revoked" | "on-hold" | "paused";
export type SubscriptionClaim = {
  uid: string;
  provider: SubscriptionProvider;
  productId: CoreProductId;
  storeReferenceHash: string;
  orderReferenceHash?: string;
  storeAccountTokenHash?: string;
  status: SubscriptionClaimStatus;
  verifiedAt: number;
  entitlementExpiresAt: number | null;
};

type SubscriptionEvent = {
  provider: SubscriptionProvider;
  eventIdHash: string;
  storeReferenceHash: string;
  productId: CoreProductId | null;
  occurredAt: number;
  action: "reverify" | "revoke" | "expire" | "hold" | "pause" | "grace";
  gracePeriodExpiresAt?: number;
  // These references remain in memory and are never passed to persistence or public replies.
  reference: string;
  transactionId?: string;
  environment?: AppleEnvironmentName;
  appAccountToken?: string;
  productKind?: "subscription" | "lifetime";
};

export type SubscriptionEventStatus = "processed" | "duplicate" | "stale" | "unknown-owner" | "account-deleting" | "rejected" | "unavailable" | "ignored";
export type SubscriptionEventResult = { status: SubscriptionEventStatus };
export type SubscriptionClaimPatch = Pick<SubscriptionClaim, "status" | "verifiedAt" | "entitlementExpiresAt"> & {
  productId?: CoreProductId;
  orderReferenceHash?: string;
};
export type SubscriptionMutation = {
  provider: SubscriptionProvider;
  eventIdHash: string;
  storeReferenceHash: string;
  uid: string;
  productId: CoreProductId;
  occurredAt: number;
  processedAt: number;
  // Period-specific events may only change the latest verified transaction.
  periodOrderReferenceHash?: string;
  patch: SubscriptionClaimPatch;
};
export type SubscriptionReceipt = { eventIdHash: string; provider: SubscriptionProvider; processedAt: number; expiresAt: number };

export class SubscriptionNotificationError extends Error {
  constructor(readonly reason: "rejected" | "unavailable") {
    super(`Subscription notification ${reason}.`);
  }
}

export type AppleNotificationVerificationLibrary = {
  createVerifier(options: {
    rootCertificates: Buffer[]; enableOnlineChecks: true; environment: AppleEnvironmentName; bundleId: string; appAppleId?: number;
  }): {
    verifyAndDecodeNotification(signed: string): Promise<unknown>;
    verifyAndDecodeTransaction(signed: string): Promise<unknown>;
    verifyAndDecodeRenewalInfo(signed: string): Promise<unknown>;
  };
};

const officialAppleNotificationLibrary: AppleNotificationVerificationLibrary = {
  createVerifier(options) {
    return new SignedDataVerifier(
      options.rootCertificates, options.enableOnlineChecks,
      options.environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX,
      options.bundleId, options.appAppleId
    );
  }
};

export function createAppleNotificationDecoder(
  config: { appAppleId: string; rootCertificatesBase64: string; environment: string },
  library: AppleNotificationVerificationLibrary = officialAppleNotificationLibrary,
  now: () => number = () => Date.now(),
  timeoutMs = SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS
) {
  return async (value: unknown): Promise<SubscriptionEvent | null> => {
    const body = record(value);
    if (!body || Object.keys(body).length !== 1 || !compactJws(body.signedPayload) || bytes(value) > SUBSCRIPTION_NOTIFICATION_MAX_BYTES) rejected();
    const parsed = appleVerifierConfiguration(config);
    let verifier: ReturnType<AppleNotificationVerificationLibrary["createVerifier"]>;
    try {
      verifier = library.createVerifier({
        rootCertificates: parsed.roots, enableOnlineChecks: true, environment: parsed.environment,
        bundleId: APPLE_BUNDLE_ID, ...(parsed.environment === "Production" ? { appAppleId: parsed.appAppleId } : {})
      });
    } catch { unavailable(); }
    try {
      return await withSubscriptionTimeout((async () => {
        const notification = record(await verifier.verifyAndDecodeNotification(body.signedPayload as string));
        if (!notification || notification.version !== "2.0" ||
            !uuid(notification.notificationUUID) || !eventDate(notification.signedDate, now()) ||
            typeof notification.notificationType !== "string") rejected();
        if (notification.notificationType === "TEST") return null;
        const data = record(notification.data);
        if (!data || data.bundleId !== APPLE_BUNDLE_ID || data.environment !== parsed.environment ||
            (parsed.environment === "Production" && data.appAppleId !== parsed.appAppleId) ||
            (data.appAppleId !== undefined && data.appAppleId !== parsed.appAppleId) || !compactJws(data.signedTransactionInfo)) rejected();
        const transaction = record(await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo as string));
        if (!transaction || transaction.bundleId !== APPLE_BUNDLE_ID || transaction.environment !== parsed.environment ||
            !appleTransactionId(transaction.transactionId) || !appleTransactionId(transaction.originalTransactionId) ||
            !product(transaction.productId) || !eventDate(transaction.purchaseDate, now()) || !eventDate(transaction.signedDate, now()) ||
            transaction.inAppOwnershipType !== "PURCHASED" || (transaction.quantity !== undefined && transaction.quantity !== 1) ||
            (transaction.appAppleId !== undefined && transaction.appAppleId !== parsed.appAppleId)) rejected();
        const lifetime = transaction.productId === "freed_premium_lifetime";
        if (lifetime ? transaction.type !== "Non-Consumable" || transaction.expiresDate !== undefined
          : transaction.type !== "Auto-Renewable Subscription" || !positiveDate(transaction.expiresDate)) rejected();
        if (transaction.appAccountToken !== undefined && !uuid(transaction.appAccountToken)) rejected();
        const action = appleAction(notification.notificationType, notification.subtype, transaction);
        if (!action) return null;
        if (action === "expire" && (lifetime || (transaction.expiresDate as number) > now())) rejected();
        let gracePeriodExpiresAt: number | undefined;
        let appAccountToken = transaction.appAccountToken as string | undefined;
        if (action === "grace") {
          if (lifetime || transaction.revocationReason !== undefined || transaction.isUpgraded === true ||
              !compactJws(data.signedRenewalInfo)) rejected();
          const renewal = record(await verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo as string));
          if (!renewal || renewal.originalTransactionId !== transaction.originalTransactionId ||
              renewal.productId !== transaction.productId || renewal.environment !== parsed.environment ||
              !eventDate(renewal.signedDate, now()) || renewal.isInBillingRetryPeriod !== true ||
              !positiveDate(renewal.gracePeriodExpiresDate) || renewal.gracePeriodExpiresDate <= (transaction.expiresDate as number) ||
              (renewal.appAccountToken !== undefined && (!uuid(renewal.appAccountToken) ||
                (appAccountToken !== undefined && renewal.appAccountToken.toLowerCase() !== appAccountToken.toLowerCase())))) rejected();
          gracePeriodExpiresAt = renewal.gracePeriodExpiresDate;
          appAccountToken ??= renewal.appAccountToken as string | undefined;
        }
        return {
          provider: "apple", eventIdHash: eventHash("apple", notification.notificationUUID as string),
          storeReferenceHash: hashStoreReference(transaction.originalTransactionId as string),
          productId: transaction.productId as CoreProductId, occurredAt: notification.signedDate as number,
          action, reference: transaction.originalTransactionId as string, transactionId: transaction.transactionId as string,
          environment: parsed.environment,
          ...(appAccountToken ? { appAccountToken } : {}),
          ...(gracePeriodExpiresAt !== undefined ? { gracePeriodExpiresAt } : {})
        };
      })(), timeoutMs);
    } catch (error) {
      if (error instanceof SubscriptionNotificationError) throw error;
      if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) unavailable();
      rejected();
    }
  };
}

export type GoogleSubscriptionEnvelope = { source: string; type: string; messageId: string; data: string };

export function decodeGoogleNotification(value: GoogleSubscriptionEnvelope, expectedSource: string, now: number): SubscriptionEvent | null {
  if (!expectedSource || value.source !== expectedSource || value.type !== "google.cloud.pubsub.topic.v1.messagePublished" ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(value.messageId) || typeof value.data !== "string" ||
      value.data.length > Math.ceil(SUBSCRIPTION_NOTIFICATION_MAX_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)) rejected();
  const decoded = Buffer.from(value.data, "base64");
  if (decoded.length > SUBSCRIPTION_NOTIFICATION_MAX_BYTES || decoded.toString("base64") !== value.data) rejected();
  let body: Record<string, unknown> | null;
  try { body = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded))); } catch { rejected(); }
  if (!body || body.version !== "1.0" || body.packageName !== GOOGLE_PACKAGE_NAME ||
      typeof body.eventTimeMillis !== "string" || !/^\d{13}$/.test(body.eventTimeMillis) || !eventDate(Number(body.eventTimeMillis), now)) rejected();
  const notificationKeys = ["subscriptionNotification", "oneTimeProductNotification", "voidedPurchaseNotification", "testNotification"];
  if (Object.keys(body).some((key) => !["version", "packageName", "eventTimeMillis", ...notificationKeys].includes(key)) ||
      notificationKeys.filter((key) => body![key] !== undefined).length !== 1) rejected();
  if (body.testNotification !== undefined) return null;
  const subscription = record(body.subscriptionNotification);
  const oneTime = record(body.oneTimeProductNotification);
  const voided = record(body.voidedPurchaseNotification);
  const notification = subscription ?? oneTime ?? voided;
  if (!notification || !googlePurchaseToken(notification.purchaseToken)) rejected();
  let productId: CoreProductId | null = null;
  let action: SubscriptionEvent["action"] = "reverify";
  let productKind: SubscriptionEvent["productKind"];
  if (subscription) {
    if (subscription.version !== "1.0" || !product(subscription.subscriptionId) || subscription.subscriptionId === "freed_premium_lifetime" ||
        ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 22].includes(Number(subscription.notificationType)) ||
        typeof subscription.notificationType !== "number") rejected();
    productId = subscription.subscriptionId;
    productKind = "subscription";
    action = subscription.notificationType === 12 ? "revoke" : subscription.notificationType === 13 || subscription.notificationType === 20
      ? "expire" : subscription.notificationType === 5 ? "hold" : subscription.notificationType === 10 ? "pause" : "reverify";
  } else if (oneTime) {
    if (oneTime.version !== "1.0" || oneTime.sku !== "freed_premium_lifetime" || ![1, 2].includes(Number(oneTime.notificationType)) ||
        typeof oneTime.notificationType !== "number") rejected();
    productId = "freed_premium_lifetime"; productKind = "lifetime";
    action = oneTime.notificationType === 2 ? "revoke" : "reverify";
  } else if (voided) {
    if (![1, 2].includes(Number(voided.productType)) || typeof voided.productType !== "number" ||
        ![1, 2].includes(Number(voided.refundType)) || typeof voided.refundType !== "number") rejected();
    productKind = voided.productType === 1 ? "subscription" : "lifetime";
    action = "revoke";
  }
  return {
    provider: "google-play", eventIdHash: eventHash("google-play", value.messageId),
    storeReferenceHash: hashStoreReference(notification.purchaseToken as string), productId,
    occurredAt: Number(body.eventTimeMillis), action, reference: notification.purchaseToken as string, productKind
  };
}

export type SubscriptionTransactionStore = {
  readClaim(hash: string): Promise<SubscriptionClaim | undefined>;
  readReceipt(eventHash: string): Promise<boolean>;
  readDeletionTombstone(uid: string): Promise<boolean>;
  updateClaim(hash: string, patch: SubscriptionClaimPatch): Promise<void>;
  writeReceipt(receipt: SubscriptionReceipt): Promise<void>;
};

export async function commitSubscriptionMutation(store: SubscriptionTransactionStore, input: SubscriptionMutation): Promise<SubscriptionEventStatus> {
  const [current, processed] = await Promise.all([store.readClaim(input.storeReferenceHash), store.readReceipt(input.eventIdHash)]);
  if (processed) return "duplicate";
  if (!current) return "unknown-owner";
  if (current.uid !== input.uid || current.provider !== input.provider || current.storeReferenceHash !== input.storeReferenceHash ||
      current.productId !== input.productId) return "rejected";
  if (await store.readDeletionTombstone(current.uid)) return "account-deleting";
  const stale = (input.provider === "apple" && input.periodOrderReferenceHash !== undefined &&
    current.orderReferenceHash !== undefined && input.periodOrderReferenceHash !== current.orderReferenceHash) ||
    input.occurredAt < current.verifiedAt ||
    (input.occurredAt === current.verifiedAt && statusPriority(input.patch.status) <= statusPriority(current.status));
  if (!stale) await store.updateClaim(input.storeReferenceHash, input.patch);
  await store.writeReceipt({
    eventIdHash: input.eventIdHash, provider: input.provider, processedAt: input.processedAt,
    expiresAt: input.processedAt + SUBSCRIPTION_RECEIPT_TTL_MS
  });
  return stale ? "stale" : "processed";
}

export function createSubscriptionEventProcessor(dependencies: {
  now: () => number;
  decodeApple: (body: unknown) => Promise<SubscriptionEvent | null>;
  googleTopicSource: string;
  apple: PurchaseProvider;
  google: PurchaseProvider;
  inspect: (storeHash: string, eventHash: string) => Promise<{ claim: SubscriptionClaim | undefined; processed: boolean; deleting: boolean }>;
  commit: (mutation: SubscriptionMutation) => Promise<SubscriptionEventStatus>;
  timeoutMs?: number;
}) {
  async function process(event: SubscriptionEvent | null): Promise<SubscriptionEventResult> {
    if (!event) return { status: "ignored" };
    const inspection = await withSubscriptionTimeout(dependencies.inspect(event.storeReferenceHash, event.eventIdHash), dependencies.timeoutMs);
    if (inspection.processed) return { status: "duplicate" };
    const claim = inspection.claim;
    if (!claim) return { status: "unknown-owner" };
    const subscriptionSwitch = event.provider === "apple" &&
      ["freed_premium_monthly", "freed_premium_yearly"].includes(claim.productId) &&
      event.productId !== null && ["freed_premium_monthly", "freed_premium_yearly"].includes(event.productId);
    if (claim.provider !== event.provider || claim.storeReferenceHash !== event.storeReferenceHash ||
        (event.productId !== null && event.productId !== claim.productId && !subscriptionSwitch) ||
        (event.productKind !== undefined && event.productKind !== (claim.productId === "freed_premium_lifetime" ? "lifetime" : "subscription")) ||
        (event.appAccountToken !== undefined && hashStoreReference(event.appAccountToken.toLowerCase()) !==
          (claim.storeAccountTokenHash ?? hashStoreReference(deriveAppleAppAccountToken(claim.uid))))) return { status: "rejected" };
    if (inspection.deleting) return { status: "account-deleting" };
    const mutation = (patch: SubscriptionClaimPatch): SubscriptionMutation => ({
      provider: event.provider, eventIdHash: event.eventIdHash, storeReferenceHash: event.storeReferenceHash,
      uid: claim.uid, productId: claim.productId, occurredAt: event.occurredAt, processedAt: dependencies.now(), patch,
      ...(event.provider === "apple" && (event.action !== "reverify" || patch.status !== "verified") && event.transactionId
        ? { periodOrderReferenceHash: hashStoreReference(event.transactionId) } : {})
    });
    if (event.occurredAt < claim.verifiedAt) {
      return { status: await withSubscriptionTimeout(dependencies.commit(mutation({
        status: claim.status, verifiedAt: event.occurredAt, entitlementExpiresAt: claim.entitlementExpiresAt
      })), dependencies.timeoutMs) };
    }
    let patch: SubscriptionClaimPatch;
    if (event.provider === "apple" && event.action === "grace") {
      // Both the expired paid transaction and its renewal information are
      // authenticated by Apple; the paid-only purchase verifier cannot grant grace.
      if (!positiveDate(event.gracePeriodExpiresAt)) return { status: "rejected" };
      patch = event.gracePeriodExpiresAt > dependencies.now()
        ? { status: "verified", verifiedAt: event.occurredAt, entitlementExpiresAt: event.gracePeriodExpiresAt }
        : inactivePatch({ ...event, action: "hold" }, claim, dependencies.now());
    } else if (event.provider === "apple" && event.action !== "reverify") {
      patch = inactivePatch(event, claim, dependencies.now());
    } else {
      try {
        const provider = event.provider === "apple" ? dependencies.apple : dependencies.google;
        const verifiedProduct = subscriptionSwitch ? event.productId! : claim.productId;
        const verified = await withSubscriptionTimeout(provider.verify(event.provider === "apple"
          ? { transactionId: event.transactionId, productId: verifiedProduct, expectedAppAccountToken: deriveAppleAppAccountToken(claim.uid), restore: true }
          : { purchaseToken: event.reference, productId: claim.productId }), dependencies.timeoutMs);
        if (verified.platform !== (event.provider === "apple" ? "ios" : "android") || verified.productId !== verifiedProduct ||
            verified.storeReference !== event.reference ||
            (event.provider === "apple" && verified.environment !== event.environment) ||
            (event.provider === "apple" && verified.orderReference !== undefined && verified.orderReference !== event.transactionId) ||
            (event.provider === "apple" && claim.storeAccountTokenHash && verified.storeAccountTokenHash !== claim.storeAccountTokenHash) ||
            (claim.productId === "freed_premium_lifetime" ? verified.expiresAt !== null
              : !positiveDate(verified.expiresAt) || verified.expiresAt <= dependencies.now())) return { status: "rejected" };
        patch = {
          status: "verified", verifiedAt: event.occurredAt, entitlementExpiresAt: verified.expiresAt,
          ...(verifiedProduct !== claim.productId ? { productId: verifiedProduct } : {}),
          ...(verified.orderReference ? { orderReferenceHash: hashStoreReference(verified.orderReference) } : {})
        };
      } catch (error) {
        if (!(error instanceof PurchaseProviderError) || error.status === "unavailable") return { status: "unavailable" };
        patch = inactivePatch(event, claim, dependencies.now());
      }
    }
    return { status: await withSubscriptionTimeout(dependencies.commit(mutation(patch)), dependencies.timeoutMs) };
  }

  async function safe(operation: () => Promise<SubscriptionEventResult>): Promise<SubscriptionEventResult> {
    try { return await operation(); }
    catch (error) { return { status: error instanceof SubscriptionNotificationError ? error.reason : "unavailable" }; }
  }
  return {
    processApple: (body: unknown) => safe(async () => process(await dependencies.decodeApple(body))),
    processGoogle: (body: GoogleSubscriptionEnvelope) => safe(async () => process(decodeGoogleNotification(body, dependencies.googleTopicSource, dependencies.now())))
  };
}

export async function withSubscriptionTimeout<Result>(operation: Promise<Result>, timeoutMs = SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new SubscriptionNotificationError("unavailable")), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

function inactivePatch(event: SubscriptionEvent, claim: SubscriptionClaim, now: number): SubscriptionClaimPatch {
  return {
    status: event.action === "revoke" ? "revoked" : event.action === "expire" ? "expired" : event.action === "hold" ? "on-hold"
      : event.action === "pause" ? "paused" : "inactive",
    verifiedAt: event.occurredAt,
    entitlementExpiresAt: Math.min(claim.entitlementExpiresAt ?? now, event.occurredAt, now)
  };
}

function appleAction(type: string, subtype: unknown, transaction: Record<string, unknown>): SubscriptionEvent["action"] | null {
  if (transaction.revocationDate !== undefined || ["REFUND", "REVOKE"].includes(type)) return "revoke";
  if (["EXPIRED", "GRACE_PERIOD_EXPIRED"].includes(type)) return "expire";
  if (type === "DID_FAIL_TO_RENEW") return subtype === "GRACE_PERIOD" ? "grace" : "hold";
  return ["SUBSCRIBED", "DID_RENEW", "DID_CHANGE_RENEWAL_STATUS", "DID_CHANGE_RENEWAL_PREF", "OFFER_REDEEMED", "REFUND_REVERSED", "RENEWAL_EXTENDED", "ONE_TIME_CHARGE", "DID_FAIL_TO_RENEW"].includes(type) ? "reverify" : null;
}

function appleVerifierConfiguration(config: { appAppleId: string; rootCertificatesBase64: string; environment: string }) {
  if (!/^\d{6,20}$/.test(config.appAppleId) || !Number.isSafeInteger(Number(config.appAppleId)) ||
      !["Production", "Sandbox"].includes(config.environment) || typeof config.rootCertificatesBase64 !== "string" ||
      config.rootCertificatesBase64.length > 256 * 1024) unavailable();
  let roots: unknown;
  try { roots = JSON.parse(config.rootCertificatesBase64); } catch { unavailable(); }
  if (!Array.isArray(roots) || roots.length < 1 || roots.length > 10 || roots.some((item) => typeof item !== "string" ||
      item.length < 4 || item.length > 32 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(item) || Buffer.from(item, "base64").toString("base64") !== item)) unavailable();
  return { appAppleId: Number(config.appAppleId), roots: roots.map((item) => Buffer.from(item, "base64")), environment: config.environment as AppleEnvironmentName };
}

function statusPriority(status: SubscriptionClaimStatus): number {
  return { verified: 0, inactive: 1, "on-hold": 2, paused: 2, expired: 3, revoked: 4 }[status];
}
function eventHash(provider: SubscriptionProvider, id: string): string { return createHash("sha256").update(`${provider}:${id}`).digest("hex"); }
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function product(value: unknown): value is CoreProductId { return typeof value === "string" && (CORE_PRODUCT_IDS as readonly string[]).includes(value); }
function positiveDate(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
function eventDate(value: unknown, now: number): value is number { return positiveDate(value) && value <= now + 300_000; }
function uuid(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value); }
function appleTransactionId(value: unknown): value is string { return typeof value === "string" && /^\d{8,32}$/.test(value); }
function googlePurchaseToken(value: unknown): value is string { return typeof value === "string" && value.length >= 16 && value.length <= 4096 && /^[\x21-\x7e]+$/.test(value) && !value.includes("://"); }
function compactJws(value: unknown): value is string { return typeof value === "string" && value.length >= 16 && value.length <= SUBSCRIPTION_NOTIFICATION_MAX_BYTES && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value); }
function bytes(value: unknown): number { try { return Buffer.byteLength(JSON.stringify(value)); } catch { return Infinity; } }
function rejected(): never { throw new SubscriptionNotificationError("rejected"); }
function unavailable(): never { throw new SubscriptionNotificationError("unavailable"); }
