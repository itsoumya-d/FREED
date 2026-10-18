import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onMessagePublished } from "firebase-functions/v2/pubsub";

import { COLLECTIONS, validateServerDocument } from "./contracts.js";
import { CORE_PRODUCT_IDS, createAppleStoreProvider, createGooglePlayProvider, type AppleEnvironmentName, type CoreProductId } from "./purchase.js";
import {
  SUBSCRIPTION_NOTIFICATION_MAX_BYTES, SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS,
  SubscriptionNotificationError, commitSubscriptionMutation, createAppleNotificationDecoder,
  createSubscriptionEventProcessor, withSubscriptionTimeout,
  type GoogleSubscriptionEnvelope, type SubscriptionClaim, type SubscriptionClaimStatus,
  type SubscriptionEventResult, type SubscriptionMutation
} from "./subscription-events.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "asia-south1";
const RESPONSE_TIMEOUT_MS = 25_000;

export const SUBSCRIPTION_RECEIPT_COLLECTION = "purchase_notification_receipts";
export const GOOGLE_PLAY_SUBSCRIPTION_TOPIC_DEFAULT = "freed-google-play-subscriptions";
export const SUBSCRIPTION_NOTIFICATION_SECRET_NAMES = [
  "APPLE_STORE_ISSUER_ID", "APPLE_STORE_KEY_ID", "APPLE_STORE_PRIVATE_KEY", "APPLE_STORE_APP_ID",
  "APPLE_STORE_ROOT_CAS_BASE64", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
] as const;

const APPLE_STORE_ISSUER_ID = defineSecret("APPLE_STORE_ISSUER_ID");
const APPLE_STORE_KEY_ID = defineSecret("APPLE_STORE_KEY_ID");
const APPLE_STORE_PRIVATE_KEY = defineSecret("APPLE_STORE_PRIVATE_KEY");
const APPLE_STORE_APP_ID = defineSecret("APPLE_STORE_APP_ID");
const APPLE_STORE_ROOT_CAS_BASE64 = defineSecret("APPLE_STORE_ROOT_CAS_BASE64");
const GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = defineSecret("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
const GOOGLE_PLAY_SUBSCRIPTION_TOPIC = defineString("GOOGLE_PLAY_SUBSCRIPTION_TOPIC", { default: GOOGLE_PLAY_SUBSCRIPTION_TOPIC_DEFAULT });
const APPLE_SECRETS = [APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64];

type AppleHttpRequest = { method: string; headers: Record<string, string | string[] | undefined>; rawBody?: Buffer; body: unknown };
type AppleHttpResponse = { status(code: number): AppleHttpResponse; json(value: unknown): unknown };

/** The real HTTP handler uses this injected boundary; replies never echo notification contents. */
export function createAppleSubscriptionHttpHandler(
  loadProcessor: () => { processApple(body: unknown): Promise<SubscriptionEventResult> },
  responseTimeoutMs = RESPONSE_TIMEOUT_MS
) {
  return async (request: AppleHttpRequest, response: AppleHttpResponse): Promise<void> => {
    if (request.method !== "POST") { response.status(405).json({ status: "rejected" }); return; }
    if (typeof request.headers["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      response.status(415).json({ status: "rejected" }); return;
    }
    let bodyBytes: number;
    try { bodyBytes = Buffer.byteLength(JSON.stringify(request.body)); } catch { bodyBytes = Infinity; }
    if ((request.rawBody?.byteLength ?? bodyBytes) > SUBSCRIPTION_NOTIFICATION_MAX_BYTES || bodyBytes > SUBSCRIPTION_NOTIFICATION_MAX_BYTES) {
      response.status(413).json({ status: "rejected" }); return;
    }
    try {
      const result = await withSubscriptionTimeout(loadProcessor().processApple(request.body), responseTimeoutMs);
      response.status(result.status === "unavailable" ? 503 : result.status === "rejected" ? 400 : 200).json(result);
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  };
}

type GoogleMessageEvent = { source: string; type: string; data: { message: { messageId: string; data: string } } };

export function createGoogleSubscriptionMessageHandler(
  loadProcessor: () => { processGoogle(body: GoogleSubscriptionEnvelope): Promise<SubscriptionEventResult> },
  responseTimeoutMs = RESPONSE_TIMEOUT_MS
) {
  return async (event: GoogleMessageEvent): Promise<void> => {
    try {
      const result = await withSubscriptionTimeout(loadProcessor().processGoogle({
        source: event.source, type: event.type, messageId: event.data.message.messageId, data: event.data.message.data
      }), responseTimeoutMs);
      if (result.status === "unavailable") throw new Error("Retry subscription event.");
    } catch {
      // Eventarc retries a transient failure. No payload or provider error is attached.
      throw new Error("Subscription processing temporarily unavailable.");
    }
  };
}

export const appleSubscriptionNotifications = onRequest({
  region: REGION, invoker: "public", cors: false, timeoutSeconds: 30, maxInstances: 10, concurrency: 10,
  secrets: APPLE_SECRETS
}, createAppleSubscriptionHttpHandler(() => createAppleProcessor("Production")));

export const appleSubscriptionNotificationsSandbox = onRequest({
  region: REGION, invoker: "public", cors: false, timeoutSeconds: 30, maxInstances: 10, concurrency: 10,
  secrets: APPLE_SECRETS
}, createAppleSubscriptionHttpHandler(() => createAppleProcessor("Sandbox")));

function createAppleProcessor(environment: AppleEnvironmentName) {
  const config = {
    issuerId: requireSecret(APPLE_STORE_ISSUER_ID.value()), keyId: requireSecret(APPLE_STORE_KEY_ID.value()),
    privateKey: requireSecret(APPLE_STORE_PRIVATE_KEY.value()), appAppleId: requireSecret(APPLE_STORE_APP_ID.value()),
    rootCertificatesBase64: requireSecret(APPLE_STORE_ROOT_CAS_BASE64.value())
  };
  return createSubscriptionEventProcessor({
    now: () => Date.now(),
    decodeApple: createAppleNotificationDecoder({
      appAppleId: config.appAppleId, rootCertificatesBase64: config.rootCertificatesBase64,
      environment
    }),
    googleTopicSource: "",
    apple: createAppleStoreProvider(config, undefined, () => Date.now(), SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS),
    google: { verify: async () => { throw new SubscriptionNotificationError("unavailable"); } },
    inspect: inspectSubscriptionOwner, commit: commitFirestoreSubscriptionMutation
  });
}

/** Eventarc/Pub/Sub invocation is IAM-protected; this is intentionally not an HTTP endpoint. */
export const googlePlaySubscriptionNotifications = onMessagePublished({
  region: REGION, topic: GOOGLE_PLAY_SUBSCRIPTION_TOPIC, retry: true, timeoutSeconds: 30, maxInstances: 10,
  secrets: [GOOGLE_PLAY_SERVICE_ACCOUNT_JSON]
}, createGoogleSubscriptionMessageHandler(() => {
  const serviceAccount = requireSecret(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.value());
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId || !/^[A-Za-z0-9-]+$/.test(projectId)) throw new SubscriptionNotificationError("unavailable");
  return createSubscriptionEventProcessor({
    now: () => Date.now(),
    decodeApple: async () => { throw new SubscriptionNotificationError("unavailable"); },
    googleTopicSource: `//pubsub.googleapis.com/projects/${projectId}/topics/${GOOGLE_PLAY_SUBSCRIPTION_TOPIC.value()}`,
    apple: { verify: async () => { throw new SubscriptionNotificationError("unavailable"); } },
    google: createGooglePlayProvider(serviceAccount, undefined, () => Date.now(), SUBSCRIPTION_NOTIFICATION_TIMEOUT_MS),
    inspect: inspectSubscriptionOwner, commit: commitFirestoreSubscriptionMutation
  });
}));

async function inspectSubscriptionOwner(storeHash: string, eventHash: string) {
  return db.runTransaction(async (transaction) => {
    const [claimSnapshot, receipt] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.purchaseClaims).doc(storeHash)),
      transaction.get(db.collection(SUBSCRIPTION_RECEIPT_COLLECTION).doc(eventHash))
    ]);
    const claim = claimSnapshot.exists ? normalizeSubscriptionClaim(storeHash, claimSnapshot.data()) : undefined;
    const tombstone = claim ? await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(claim.uid)) : undefined;
    return { claim, processed: receipt.exists, deleting: tombstone?.exists === true };
  });
}

async function commitFirestoreSubscriptionMutation(input: SubscriptionMutation) {
  return db.runTransaction(async (transaction) => {
    let original: Record<string, unknown> | undefined;
    return commitSubscriptionMutation({
      async readClaim(hash) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.purchaseClaims).doc(hash));
        original = snapshot.data();
        return snapshot.exists ? normalizeSubscriptionClaim(hash, original) : undefined;
      },
      async readReceipt(hash) {
        return (await transaction.get(db.collection(SUBSCRIPTION_RECEIPT_COLLECTION).doc(hash))).exists;
      },
      async readDeletionTombstone(uid) {
        return (await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid))).exists;
      },
      async updateClaim(hash, patch) {
        if (!original) throw new SubscriptionNotificationError("unavailable");
        const update = {
          status: patch.status, verifiedAt: Timestamp.fromMillis(patch.verifiedAt),
          ...(patch.productId ? { productId: patch.productId } : {}),
          ...(patch.orderReferenceHash ? { orderReferenceHash: patch.orderReferenceHash } : {}),
          entitlementExpiresAt: patch.entitlementExpiresAt === null ? null : Timestamp.fromMillis(patch.entitlementExpiresAt)
        };
        validateServerDocument(COLLECTIONS.purchaseClaims, { ...original, ...update });
        transaction.update(db.collection(COLLECTIONS.purchaseClaims).doc(hash), update);
      },
      async writeReceipt(receipt) {
        transaction.set(db.collection(SUBSCRIPTION_RECEIPT_COLLECTION).doc(receipt.eventIdHash), validateServerDocument(SUBSCRIPTION_RECEIPT_COLLECTION, {
          eventIdHash: receipt.eventIdHash, provider: receipt.provider,
          processedAt: Timestamp.fromMillis(receipt.processedAt), expiresAt: Timestamp.fromMillis(receipt.expiresAt)
        }));
      }
    }, input);
  });
}

function normalizeSubscriptionClaim(hash: string, value: Record<string, unknown> | undefined): SubscriptionClaim | undefined {
  if (!value || typeof value.uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.uid) ||
      !["apple", "google-play"].includes(String(value.provider)) ||
      !(CORE_PRODUCT_IDS as readonly unknown[]).includes(value.productId) || value.storeReferenceHash !== hash ||
      !["verified", "inactive", "expired", "revoked", "on-hold", "paused"].includes(String(value.status)) ||
      !(value.verifiedAt instanceof Timestamp)) return undefined;
  const verifiedAt = value.verifiedAt.toMillis();
  const entitlementExpiresAt = value.entitlementExpiresAt instanceof Timestamp ? value.entitlementExpiresAt.toMillis() : null;
  if (!Number.isFinite(verifiedAt) || verifiedAt <= 0 ||
      (value.productId !== "freed_premium_lifetime" && entitlementExpiresAt === null)) return undefined;
  return {
    uid: value.uid, provider: value.provider as SubscriptionClaim["provider"], productId: value.productId as CoreProductId,
    storeReferenceHash: hash, status: value.status as SubscriptionClaimStatus, verifiedAt, entitlementExpiresAt,
    ...(typeof value.orderReferenceHash === "string" && /^[a-f0-9]{64}$/.test(value.orderReferenceHash)
      ? { orderReferenceHash: value.orderReferenceHash } : {}),
    ...(typeof value.storeAccountTokenHash === "string" && /^[a-f0-9]{64}$/.test(value.storeAccountTokenHash)
      ? { storeAccountTokenHash: value.storeAccountTokenHash } : {})
  };
}

function requireSecret(value: string): string {
  if (!value || !value.trim()) throw new SubscriptionNotificationError("unavailable");
  return value;
}
