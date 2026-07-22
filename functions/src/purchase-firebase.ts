import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { COLLECTIONS, validateServerDocument } from "./contracts.js";
import {
  PurchaseAccessError,
  PurchaseInputError,
  createAppleStoreProvider,
  createGooglePlayProvider,
  createPurchaseVerificationService,
  type PurchaseClaimInput,
  type PurchaseClaimResult
} from "./purchase.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = "asia-south1";
const RATE_WINDOW_MS = 60 * 1_000;
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const AUDIT_TTL_MS = 400 * 24 * 60 * 60 * 1_000;

const APPLE_STORE_ISSUER_ID = defineSecret("APPLE_STORE_ISSUER_ID");
const APPLE_STORE_KEY_ID = defineSecret("APPLE_STORE_KEY_ID");
const APPLE_STORE_PRIVATE_KEY = defineSecret("APPLE_STORE_PRIVATE_KEY");
const APPLE_STORE_APP_ID = defineSecret("APPLE_STORE_APP_ID");
const APPLE_STORE_ROOT_CAS_BASE64 = defineSecret("APPLE_STORE_ROOT_CAS_BASE64");
const GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = defineSecret("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");

export const PURCHASE_SECRET_NAMES = [
  "APPLE_STORE_ISSUER_ID",
  "APPLE_STORE_KEY_ID",
  "APPLE_STORE_PRIVATE_KEY",
  "APPLE_STORE_APP_ID",
  "APPLE_STORE_ROOT_CAS_BASE64",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
] as const;

const PURCHASE_SECRETS = [
  APPLE_STORE_ISSUER_ID,
  APPLE_STORE_KEY_ID,
  APPLE_STORE_PRIVATE_KEY,
  APPLE_STORE_APP_ID,
  APPLE_STORE_ROOT_CAS_BASE64,
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
];

export type PurchaseClaimDocument = {
  uid: string;
  provider: "apple" | "google-play";
  productId: PurchaseClaimInput["productId"];
  storeReferenceHash: string;
  status: "verified";
};

export type PurchaseClaimTransactionStore = {
  readDeletionTombstone(uid: string): Promise<boolean>;
  readClaim(storeReferenceHash: string): Promise<PurchaseClaimDocument | undefined>;
  writeClaimAndAudit(input: PurchaseClaimInput): Promise<void>;
};

/** Pure transaction decision; the production adapter executes it inside one Firestore transaction. */
export async function commitVerifiedPurchaseClaim(
  store: PurchaseClaimTransactionStore,
  input: PurchaseClaimInput
): Promise<PurchaseClaimResult> {
  const [deleting, existing] = await Promise.all([
    store.readDeletionTombstone(input.uid),
    store.readClaim(input.storeReferenceHash)
  ]);
  if (deleting) return "account-deleting";
  if (existing) {
    const sameIdentity = existing.uid === input.uid && existing.provider === input.provider &&
      existing.storeReferenceHash === input.storeReferenceHash && existing.status === "verified";
    const existingClass = purchaseOwnershipClass(existing.productId);
    const requestedClass = purchaseOwnershipClass(input.productId);
    const sameOwnershipClass = existingClass !== null && existingClass === requestedClass;
    if (!sameIdentity || !sameOwnershipClass) return "conflict";
  }
  await store.writeClaimAndAudit(input);
  return existing ? "owned" : "claimed";
}

function purchaseOwnershipClass(productId: string): "subscription" | "lifetime" | null {
  if (productId === "freed_premium_lifetime") return "lifetime";
  if (productId === "freed_premium_monthly" || productId === "freed_premium_yearly") return "subscription";
  return null;
}

export const verifyStorePurchase = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    secrets: PURCHASE_SECRETS
  },
  async (request) => {
    const uid = requirePurchaseUid(request.auth?.uid);
    if (process.env.FUNCTIONS_EMULATOR !== "true" && request.app?.alreadyConsumed) {
      throw new HttpsError("permission-denied", "A fresh App Check token is required.");
    }
    const service = createPurchaseVerificationService({
      now: () => Date.now(),
      authorize: authorizePurchase,
      apple: createAppleStoreProvider({
        issuerId: APPLE_STORE_ISSUER_ID.value(),
        keyId: APPLE_STORE_KEY_ID.value(),
        privateKey: APPLE_STORE_PRIVATE_KEY.value(),
        appAppleId: APPLE_STORE_APP_ID.value(),
        rootCertificatesBase64: APPLE_STORE_ROOT_CAS_BASE64.value()
      }),
      google: createGooglePlayProvider(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.value()),
      claimVerifiedPurchase
    });
    try {
      return await service.verify(uid, request.data);
    } catch (error) {
      throw publicPurchaseError(error);
    }
  }
);

async function authorizePurchase(input: { uid: string; clientEventId: string }) {
  return db.runTransaction(async (transaction) => runProtectedMutation(firestoreStore(transaction), {
    rateLimitPath: `${COLLECTIONS.rateLimits}/${input.uid}_purchase-verify`,
    idempotencyPath: `${COLLECTIONS.idempotency}/${input.uid}_purchase-verify_${input.clientEventId}`,
    accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${input.uid}`,
    now: Date.now(),
    windowMs: RATE_WINDOW_MS,
    limit: 12,
    idempotencyTtlMs: IDEMPOTENCY_TTL_MS
  }, () => undefined).then((result) => result === "applied" ? "allowed" : result));
}

async function claimVerifiedPurchase(input: PurchaseClaimInput): Promise<PurchaseClaimResult> {
  try {
    return await db.runTransaction(async (transaction) => commitVerifiedPurchaseClaim({
      async readDeletionTombstone(uid) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid));
        return snapshot.exists;
      },
      async readClaim(storeReferenceHash) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.purchaseClaims).doc(storeReferenceHash));
        return snapshot.exists ? snapshot.data() as PurchaseClaimDocument : undefined;
      },
      async writeClaimAndAudit(claim) {
        const common: Record<string, unknown> = {
          uid: claim.uid,
          provider: claim.provider,
          productId: claim.productId,
          status: "verified",
          storeReferenceHash: claim.storeReferenceHash,
          verifiedAt: Timestamp.fromMillis(claim.verifiedAt)
        };
        if (claim.orderReferenceHash) common.orderReferenceHash = claim.orderReferenceHash;
        if (claim.expiresAt !== null) common.entitlementExpiresAt = Timestamp.fromMillis(claim.expiresAt);
        transaction.set(
          db.collection(COLLECTIONS.purchaseClaims).doc(claim.storeReferenceHash),
          validateServerDocument(COLLECTIONS.purchaseClaims, common)
        );
        transaction.set(
          db.collection(COLLECTIONS.purchaseAudits).doc(claim.storeReferenceHash),
          validateServerDocument(COLLECTIONS.purchaseAudits, {
            ...common,
            expiresAt: Timestamp.fromMillis(claim.verifiedAt + AUDIT_TTL_MS)
          })
        );
      }
    }, input));
  } catch {
    return "unavailable";
  }
}

function firestoreStore(transaction: Transaction): TransactionalStore {
  return {
    async get<T extends object>(path: string) {
      const snapshot = await transaction.get(db.doc(path));
      return { value: snapshot.exists ? snapshot.data() as T : undefined };
    },
    async set(path, value) {
      const [collection] = path.split("/");
      transaction.set(db.doc(path), validateServerDocument(collection ?? "", value));
    }
  };
}

function publicPurchaseError(error: unknown): HttpsError {
  if (error instanceof PurchaseInputError) return new HttpsError("invalid-argument", "The purchase payload is not permitted.");
  if (error instanceof PurchaseAccessError && error.reason === "rate-limited") {
    return new HttpsError("resource-exhausted", "Try again shortly.");
  }
  if (error instanceof PurchaseAccessError && error.reason === "account-deleting") {
    return new HttpsError("failed-precondition", "This account is being deleted.");
  }
  return new HttpsError("internal", "Purchase verification is temporarily unavailable.");
}

function requirePurchaseUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  return uid;
}
