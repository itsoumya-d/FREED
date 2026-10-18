import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLLECTIONS, parseReviewAccessRequest, validateServerDocument } from "./contracts.js";
import { readReviewAccess, ReviewAccessError } from "./review-access.js";
import type { TransactionalStore } from "./transactional.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const OPTIONS = { region: "asia-south1", maxInstances: 5, enforceAppCheck: true } as const;

export const getReviewAccess = onCall(OPTIONS, async request => {
  const uid = requireConnectedUid(request.auth?.uid, request.auth?.token.firebase?.sign_in_provider);
  try { parseReviewAccessRequest(request.data); }
  catch { throw new HttpsError("invalid-argument", "Unsupported review access request."); }
  try { return await db.runTransaction(transaction => readReviewAccess(transactionStore(transaction), uid, Date.now())); }
  catch (error) { throw publicError(error); }
});

function transactionStore(transaction: Transaction): TransactionalStore {
  return {
    async get<T extends object>(path: string) {
      const snapshot = await transaction.get(db.doc(path));
      const value = snapshot.exists ? { ...snapshot.data() } : undefined;
      if (value && path.startsWith(`${COLLECTIONS.backendJobs}/`)) {
        // Raw numbers/strings are not durable TTL timestamps and cannot confer access.
        value.createdAt = value.createdAt instanceof Timestamp ? value.createdAt.toMillis() : undefined;
        value.expiresAt = value.expiresAt instanceof Timestamp ? value.expiresAt.toMillis() : undefined;
      } else if (value?.expiresAt instanceof Timestamp) value.expiresAt = value.expiresAt.toMillis();
      return { value: value as T | undefined };
    },
    async set(path, value) {
      const [collection] = path.split("/");
      const document = { ...value } as Record<string, unknown>;
      if (typeof document.expiresAt === "number") document.expiresAt = Timestamp.fromMillis(document.expiresAt);
      transaction.set(db.doc(path), validateServerDocument(collection ?? "", document));
    }
  };
}

function requireConnectedUid(uid: string | undefined, provider: unknown): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  if (provider !== "password" && provider !== "google.com" && provider !== "apple.com") {
    throw new HttpsError("failed-precondition", "Connect an account before checking review access.");
  }
  return uid;
}

function publicError(error: unknown): HttpsError {
  if (error instanceof ReviewAccessError && error.reason === "account-deleting") return new HttpsError("failed-precondition", "This account is being deleted.");
  if (error instanceof ReviewAccessError && error.reason === "rate-limited") return new HttpsError("resource-exhausted", "Try again shortly.");
  return new HttpsError("unavailable", "Review access is temporarily unavailable.");
}
