/** Purchase identity fences and entitlement reads need no provider credentials. */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLLECTIONS, validateServerDocument } from "./contracts.js";
import { PurchaseAccessError } from "./purchase.js";
import { premiumEntitlementFromClaims } from "./premium-state.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "asia-south1";

export type PurchaseAccountFence = { uid: string; status: "linking" | "permanent"; createdAt: number; updatedAt: number };
export type PurchaseAccountFenceStore = {
  readDeletionTombstone(uid: string): Promise<boolean>;
  readAccountFence(uid: string): Promise<PurchaseAccountFence | undefined>;
  writeAccountFence(fence: PurchaseAccountFence): Promise<void>;
};

/** A failed link remains closed; an authenticated permanent session can only advance it. */
export async function commitPurchaseAccountFence(store: PurchaseAccountFenceStore, input: { uid: string; status: "linking" | "permanent"; now: number }): Promise<void> {
  const [deleting, existing] = await Promise.all([store.readDeletionTombstone(input.uid), store.readAccountFence(input.uid)]);
  if (deleting) throw new PurchaseAccessError("account-deleting");
  await store.writeAccountFence({
    uid: input.uid, status: existing?.status === "permanent" ? "permanent" : input.status,
    createdAt: existing?.createdAt ?? input.now, updatedAt: input.now
  });
}

export async function persistAccountFence(uid: string, status: "linking" | "permanent") {
  await db.runTransaction(transaction => commitPurchaseAccountFence({
    async readDeletionTombstone(accountUid) { return (await transaction.get(db.collection(COLLECTIONS.deletionTombstones).doc(accountUid))).exists; },
    async readAccountFence(accountUid) {
      const snapshot = await transaction.get(db.collection(COLLECTIONS.purchaseAccountFences).doc(accountUid));
      if (!snapshot.exists) return undefined;
      const data = snapshot.data()!;
      return { uid: accountUid, status: data.status === "linking" ? "linking" : "permanent", createdAt: data.createdAt?.toMillis?.() ?? Date.now(), updatedAt: data.updatedAt?.toMillis?.() ?? Date.now() };
    },
    async writeAccountFence(fence) {
      transaction.set(db.collection(COLLECTIONS.purchaseAccountFences).doc(fence.uid), validateServerDocument(COLLECTIONS.purchaseAccountFences, {
        ...fence, createdAt: Timestamp.fromMillis(fence.createdAt), updatedAt: Timestamp.fromMillis(fence.updatedAt)
      }));
    }
  }, { uid, status, now: Date.now() }));
}

export const fencePurchaseAccountLink = onCall({ region: REGION, maxInstances: 5, enforceAppCheck: true }, async request => {
  const uid = requirePurchaseUid(request.auth?.uid);
  if (request.data !== undefined && request.data !== null) throw new HttpsError("invalid-argument", "No account fence payload is permitted.");
  try {
    await persistAccountFence(uid, request.auth?.token.firebase?.sign_in_provider === "anonymous" ? "linking" : "permanent");
    return { ok: true as const };
  } catch (error) { throw publicPurchaseError(error); }
});

export const getPremiumEntitlement = onCall({ region: REGION, maxInstances: 5, enforceAppCheck: true }, async (request) => {
  const uid = requirePurchaseUid(request.auth?.uid);
  if (request.data !== undefined && request.data !== null) throw new HttpsError("invalid-argument", "No entitlement payload is permitted.");
  const tombstone = await db.collection(COLLECTIONS.deletionTombstones).doc(uid).get();
  if (tombstone.exists) return { entitlement: null };
  const claims = await db.collection(COLLECTIONS.purchaseClaims).where("uid", "==", uid).limit(100).get();
  return { entitlement: premiumEntitlementFromClaims(uid, claims.docs.map(doc => doc.data()), Date.now()) };
});

function requirePurchaseUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  return uid;
}

function publicPurchaseError(error: unknown): HttpsError {
  if (error instanceof PurchaseAccessError && error.reason === "account-deleting") {
    return new HttpsError("failed-precondition", "This account is being deleted.");
  }
  return new HttpsError("internal", "Purchase verification is temporarily unavailable.");
}
