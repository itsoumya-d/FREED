import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { createHash } from "node:crypto";
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
  deriveAppleAppAccountToken,
  validateStoreVerifierConfiguration,
  validateAppleStoreVerifierConfiguration,
  PurchaseProviderError,
  type PurchaseClaimInput,
  type PurchaseClaimResult
} from "./purchase.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";
import { persistAccountFence } from "./purchase-foundation.js";
export { commitPurchaseAccountFence, fencePurchaseAccountLink, getPremiumEntitlement } from "./purchase-foundation.js";
export type { PurchaseAccountFence, PurchaseAccountFenceStore } from "./purchase-foundation.js";

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
const APPLE_PURCHASE_SECRETS = PURCHASE_SECRETS.slice(0,5);

function appleConfiguration() {
  return {
    issuerId: APPLE_STORE_ISSUER_ID.value(), keyId: APPLE_STORE_KEY_ID.value(),
    privateKey: APPLE_STORE_PRIVATE_KEY.value(), appAppleId: APPLE_STORE_APP_ID.value(),
    rootCertificatesBase64: APPLE_STORE_ROOT_CAS_BASE64.value()
  };
}

export const getPurchaseCheckoutContext = onCall({ region: REGION, enforceAppCheck: true, secrets: PURCHASE_SECRETS }, async (request) => {
  const uid = requirePurchaseUid(request.auth?.uid);
  if (request.data !== undefined && request.data !== null) throw new HttpsError("invalid-argument", "No checkout identity payload is permitted.");
  const tombstone = await db.collection(COLLECTIONS.deletionTombstones).doc(uid).get();
  if (tombstone.exists) throw new HttpsError("failed-precondition", "This account is being deleted.");
  try {
    validateStoreVerifierConfiguration(appleConfiguration(), GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.value());
    if (request.auth?.token.firebase?.sign_in_provider !== "anonymous") await persistAccountFence(uid, "permanent");
  } catch { throw new HttpsError("unavailable", "Store verification is not ready. Checkout cannot start."); }
  return { appAccountToken: deriveAppleAppAccountToken(uid), obfuscatedAccountId: createHash("sha256").update(`freed:google-account:${uid}`).digest("hex") };
});

/** Platform-scoped readiness: an absent Android verifier cannot disable a valid iOS checkout. */
export const getApplePurchaseCheckoutContext = onCall({region:REGION,maxInstances:5,enforceAppCheck:true,secrets:APPLE_PURCHASE_SECRETS},async request=>{
  const uid=requirePurchaseUid(request.auth?.uid);
  if(request.data!==undefined && request.data!==null)throw new HttpsError('invalid-argument','No checkout identity payload is permitted.');
  requireConnectedPurchaseProvider(request.auth?.token.firebase?.sign_in_provider);
  const tombstone=await db.collection(COLLECTIONS.deletionTombstones).doc(uid).get();
  if(tombstone.exists)throw new HttpsError('failed-precondition','This account is being deleted.');
  try {validateAppleStoreVerifierConfiguration(appleConfiguration());await persistAccountFence(uid,'permanent');}
  catch {throw new HttpsError('unavailable','Store verification is not ready. Checkout cannot start.');}
  return{appAccountToken:deriveAppleAppAccountToken(uid),obfuscatedAccountId:createHash('sha256').update(`freed:google-account:${uid}`).digest('hex')};
});

function requireConnectedPurchaseProvider(provider:unknown){
  if(!['password','google.com','apple.com'].includes(String(provider)))throw new HttpsError('failed-precondition','Connect an account before checkout.');
}

export const verifyAppleStorePurchase = onCall({region:REGION,maxInstances:5,enforceAppCheck:true,consumeAppCheckToken:true,secrets:APPLE_PURCHASE_SECRETS},async request=>{
  const uid=requirePurchaseUid(request.auth?.uid);
  if(process.env.FUNCTIONS_EMULATOR!=='true' && request.app?.alreadyConsumed)throw new HttpsError('permission-denied','A fresh App Check token is required.');
  const provider=request.auth?.token.firebase?.sign_in_provider;requireConnectedPurchaseProvider(provider);
  if(!request.data || request.data.platform!=='ios')throw new HttpsError('invalid-argument','This endpoint verifies Apple purchases only.');
  try {
    validateAppleStoreVerifierConfiguration(appleConfiguration());await persistAccountFence(uid,'permanent');
    const service=createPurchaseVerificationService({now:Date.now,authorize:authorizePurchase,apple:createAppleStoreProvider(appleConfiguration()),
      google:{verify:async()=>{throw new PurchaseProviderError('unavailable');}},claimVerifiedPurchase:input=>claimVerifiedPurchase(input,provider)});
    return await service.verify(uid,request.data);
  } catch(error){throw publicPurchaseError(error);}
});

export type PurchaseClaimDocument = {
  uid: string;
  provider: "apple" | "google-play";
  productId: PurchaseClaimInput["productId"];
  storeReferenceHash: string;
  storeAccountTokenHash?: string;
  status: "verified" | "inactive" | "expired" | "revoked" | "on-hold" | "paused";
};

export type PurchaseClaimTransactionStore = {
  readDeletionTombstone(uid: string): Promise<boolean>;
  readClaim(storeReferenceHash: string): Promise<PurchaseClaimDocument | undefined>;
  readAccountFence?(uid: string): Promise<"linking" | "permanent" | undefined>;
  retireLinkedClaim?(claim: PurchaseClaimDocument, verifiedAt: number): Promise<void>;
  writeClaimAndAudit(input: PurchaseClaimInput): Promise<void>;
};

/** Pure transaction decision; the production adapter executes it inside one Firestore transaction. */
export async function commitVerifiedPurchaseClaim(
  store: PurchaseClaimTransactionStore,
  input: PurchaseClaimInput
): Promise<PurchaseClaimResult> {
  const [deleting, current, linked, targetFence] = await Promise.all([
    store.readDeletionTombstone(input.uid),
    store.readClaim(input.storeReferenceHash),
    input.provider === "google-play" && input.linkedStoreReferenceHash && input.linkedStoreReferenceHash !== input.storeReferenceHash
      ? store.readClaim(input.linkedStoreReferenceHash) : Promise.resolve(undefined),
    store.readAccountFence?.(input.uid)
  ]);
  if (deleting) return "account-deleting";
  const existing = current ?? linked;
  let transferred = false;
  if (existing) {
    const expectedHash = current ? input.storeReferenceHash : input.linkedStoreReferenceHash;
    const sameIdentity = existing.provider === input.provider && existing.storeReferenceHash === expectedHash;
    const existingClass = purchaseOwnershipClass(existing.productId);
    const requestedClass = purchaseOwnershipClass(input.productId);
    const sameOwnershipClass = existingClass !== null && existingClass === requestedClass;
    if (!sameIdentity || !sameOwnershipClass) return "conflict";
    if (existing.storeAccountTokenHash && input.storeAccountTokenHash && existing.storeAccountTokenHash !== input.storeAccountTokenHash) return "conflict";
    if (linked && (linked.provider !== input.provider || purchaseOwnershipClass(linked.productId) !== requestedClass || linked.uid !== existing.uid)) return "conflict";
    if (existing.uid !== input.uid) {
      const context = input.restoreContext;
      if (!input.restore || !input.restoreWitnessVerified || !context || context.expectedOwnerUid !== existing.uid ||
        !context.ownerIsAnonymous || !context.targetAuthenticated || !store.readAccountFence || targetFence === "linking" ||
        (targetFence === "permanent" && context.targetIsAnonymous)) return "conflict";
      const [sourceDeleting, sourceFence] = await Promise.all([
        store.readDeletionTombstone(existing.uid), store.readAccountFence(existing.uid)
      ]);
      if (sourceDeleting) return "account-deleting";
      if (sourceFence) return "conflict";
      transferred = true;
    }
  } else if (input.initialOwnershipVerified === false && !(input.restore && input.restoreWitnessVerified)) {
    return "conflict";
  }
  if (linked && input.linkedStoreReferenceHash !== input.storeReferenceHash && !store.retireLinkedClaim) return "unavailable";
  if (linked) await store.retireLinkedClaim!({ ...linked, uid: input.uid }, input.verifiedAt);
  await store.writeClaimAndAudit({ ...input,
    ...(existing?.storeAccountTokenHash ? { storeAccountTokenHash: existing.storeAccountTokenHash } : {})
  });
  return transferred ? "transferred" : existing ? "owned" : "claimed";
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
    const signInProvider = request.auth?.token.firebase?.sign_in_provider;
    if (signInProvider !== "anonymous") {
      try { await persistAccountFence(uid, "permanent"); }
      catch (error) { throw publicPurchaseError(error); }
    }
    const service = createPurchaseVerificationService({
      now: () => Date.now(),
      authorize: authorizePurchase,
      apple: createAppleStoreProvider(appleConfiguration()),
      google: createGooglePlayProvider(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.value()),
      claimVerifiedPurchase: input => claimVerifiedPurchase(input, signInProvider)
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

/** Admin Auth has no isAnonymous flag; linked providers, identity, custom claims
 * and disabled records all exclude a source. The transaction also requires no
 * monotonic fence, which every permanent checkout/link writes first. */
export function isUnlinkedAnonymousPurchaseOwner(user: Pick<UserRecord, "providerData" | "email" | "phoneNumber" | "customClaims" | "disabled">): boolean {
  return !user.disabled && user.providerData.length === 0 && !user.email && !user.phoneNumber &&
    (!user.customClaims || Object.keys(user.customClaims).length === 0);
}

async function claimVerifiedPurchase(input: PurchaseClaimInput, signInProvider: string | undefined): Promise<PurchaseClaimResult> {
  try {
    let claimInput = input;
    if (input.restore && input.restoreWitnessVerified) {
      const [current, previous, target] = await Promise.all([
        db.collection(COLLECTIONS.purchaseClaims).doc(input.storeReferenceHash).get(),
        input.linkedStoreReferenceHash ? db.collection(COLLECTIONS.purchaseClaims).doc(input.linkedStoreReferenceHash).get() : Promise.resolve(undefined),
        getAuth().getUser(input.uid)
      ]);
      const ownerUid: unknown = current.exists ? current.data()?.uid : previous?.data()?.uid;
      if (typeof ownerUid === "string" && ownerUid !== input.uid) {
        let ownerIsAnonymous = false;
        try { ownerIsAnonymous = isUnlinkedAnonymousPurchaseOwner(await getAuth().getUser(ownerUid)); }
        catch { /* An absent or unreadable owner cannot authorize transfer. */ }
        claimInput = {
          ...input, restoreContext: {
            expectedOwnerUid: ownerUid, ownerIsAnonymous,
            targetAuthenticated: !target.disabled && typeof signInProvider === "string" && signInProvider.length > 0,
            targetIsAnonymous: signInProvider === "anonymous"
          }
        };
      }
    }
    return await db.runTransaction(async (transaction) => commitVerifiedPurchaseClaim({
      async readDeletionTombstone(uid) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(uid));
        return snapshot.exists;
      },
      async readClaim(storeReferenceHash) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.purchaseClaims).doc(storeReferenceHash));
        return snapshot.exists ? snapshot.data() as PurchaseClaimDocument : undefined;
      },
      async readAccountFence(uid) {
        const snapshot = await transaction.get(db.collection(COLLECTIONS.purchaseAccountFences).doc(uid));
        if (!snapshot.exists) return undefined;
        return snapshot.data()?.status === "linking" ? "linking" : "permanent";
      },
      async retireLinkedClaim(previous, verifiedAt) {
        transaction.update(db.collection(COLLECTIONS.purchaseClaims).doc(previous.storeReferenceHash), {
          uid: previous.uid, status: "inactive", verifiedAt: Timestamp.fromMillis(verifiedAt)
        });
        transaction.set(db.collection(COLLECTIONS.purchaseAudits).doc(previous.storeReferenceHash), validateServerDocument(COLLECTIONS.purchaseAudits, {
          ...previous, status: "inactive", verifiedAt: Timestamp.fromMillis(verifiedAt), expiresAt: Timestamp.fromMillis(verifiedAt + AUDIT_TTL_MS)
        }));
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
        if (claim.storeAccountTokenHash) common.storeAccountTokenHash = claim.storeAccountTokenHash;
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
    }, claimInput));
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
