import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLLECTIONS, parseJourneyOfferAcknowledgement, parseJourneyOfferStateRequest, validateServerDocument } from "./contracts.js";
import { acknowledgeJourneyOfferMetadata, JOURNEY_OFFER_KIND, JourneyOfferError, readJourneyOfferState } from "./journey-offer.js";
import type { TransactionalStore } from "./transactional.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const OPTIONS = { region: "asia-south1", maxInstances: 5, enforceAppCheck: true } as const;

export const getJourneyOfferState = onCall(OPTIONS, async request => {
  const uid = requireConnectedUid(request.auth?.uid, request.auth?.token.firebase?.sign_in_provider);
  parseOrReject(() => parseJourneyOfferStateRequest(request.data));
  try { return await db.runTransaction(transaction => readJourneyOfferState(transactionStore(transaction), uid, Date.now())); }
  catch (error) { throw publicError(error); }
});

export const acknowledgeJourneyOffer = onCall(OPTIONS, async request => {
  const uid = requireConnectedUid(request.auth?.uid, request.auth?.token.firebase?.sign_in_provider);
  const input = parseOrReject(() => parseJourneyOfferAcknowledgement(request.data));
  try { return await db.runTransaction(transaction => acknowledgeJourneyOfferMetadata(transactionStore(transaction), uid, input, Date.now())); }
  catch (error) { throw publicError(error); }
});

function transactionStore(transaction: Transaction): TransactionalStore {
  return {
    async get<T extends object>(path: string) {
      const snapshot = await transaction.get(db.doc(path));
      const value = snapshot.exists ? { ...snapshot.data() } : undefined;
      if (value?.expiresAt instanceof Timestamp) value.expiresAt = value.expiresAt.toMillis();
      if (value?.createdAt instanceof Timestamp) value.createdAt = value.createdAt.toMillis();
      return { value: value as T | undefined };
    },
    async set(path, value) {
      const [collection] = path.split("/");
      const document = { ...value } as Record<string, unknown>;
      if (typeof document.expiresAt === "number") document.expiresAt = Timestamp.fromMillis(document.expiresAt);
      if (collection === COLLECTIONS.backendJobs && document.kind === JOURNEY_OFFER_KIND && typeof document.createdAt === "number") {
        document.createdAt = Timestamp.fromMillis(document.createdAt);
      }
      transaction.set(db.doc(path), validateServerDocument(collection ?? "", document));
    }
  };
}

function requireConnectedUid(uid: string | undefined, provider: unknown): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  if (provider !== "password" && provider !== "google.com" && provider !== "apple.com") {
    throw new HttpsError("failed-precondition", "Connect an account before syncing journey offer metadata.");
  }
  return uid;
}

function parseOrReject<T>(parse: () => T): T {
  try { return parse(); }
  catch { throw new HttpsError("invalid-argument", "Unsupported journey offer request."); }
}

function publicError(error: unknown): HttpsError {
  if (error instanceof JourneyOfferError && error.reason === "account-deleting") {
    return new HttpsError("failed-precondition", "This account is being deleted.");
  }
  if (error instanceof JourneyOfferError && error.reason === "rate-limited") {
    return new HttpsError("resource-exhausted", "Try again shortly.");
  }
  return new HttpsError("unavailable", "Journey offer metadata is temporarily unavailable.");
}
