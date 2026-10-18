import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  RecoveryDnsError, enrollRecoveryDnsControl, revokeRecoveryDnsControl, detachRecoveryDnsAccountControl,
  resolveRecoveryDnsCredential, reserveRecoveryDnsRequest, type RecoveryDnsStore,
  type DnsRequestReservationResult
} from "./recovery-dns-control.js";

if (!getApps().length) initializeApp();
const OPTIONS = { region: "asia-south1", maxInstances: 1, memory: "256MiB", serviceAccount: "freed-recovery-dns-pilot@freed-7d5ee.iam.gserviceaccount.com", enforceAppCheck: true } as const;
type RequestOptions = { signal?: AbortSignal };

/** Uses the actual Admin SDK transaction adapter. Deployment identity/IAM remain external gates. */
export function createRecoveryDnsFirestoreAdapter(database: Firestore = getFirestore()) {
  return {
    async enroll(uid: string, input: unknown) {
      const generation = randomUUID(), now = Date.now();
      try {
        return await database.runTransaction(transaction => enrollRecoveryDnsControl(transactionStore(database, transaction), uid, input, now, generation));
      } catch (error) { throw sanitized(error); }
    },
    async revoke(uid: string, input: unknown) {
      const now = Date.now();
      try {
        return await database.runTransaction(transaction => revokeRecoveryDnsControl(transactionStore(database, transaction), uid, input, now));
      } catch (error) { throw sanitized(error); }
    },
    async detachAccount(uid: string) {
      const now = Date.now();
      try {
        return await database.runTransaction(transaction => detachRecoveryDnsAccountControl(transactionStore(database, transaction), uid, now));
      } catch { throw new RecoveryDnsError("deletion-unconfirmed"); }
    },
    async resolveInstallation(hash: string, options: RequestOptions = {}) {
      const now = Date.now();
      try {
        assertNotAborted(options.signal);
        return await database.runTransaction(async transaction => {
          const value = await resolveRecoveryDnsCredential(transactionStore(database, transaction, options.signal), hash, now);
          assertNotAborted(options.signal);
          return value;
        }, { readOnly: true });
      } catch { throw new RecoveryDnsError("pilot-unavailable"); }
    },
    async reserveDnsRequest(input: unknown, options: RequestOptions = {}): Promise<DnsRequestReservationResult> {
      const now = Date.now();
      try {
        assertNotAborted(options.signal);
        return await database.runTransaction(async transaction => {
          const value = await reserveRecoveryDnsRequest(transactionStore(database, transaction, options.signal), input, now);
          assertNotAborted(options.signal);
          return value;
        });
      } catch { return { status: "unavailable" }; }
    }
  };
}

const adapter = createRecoveryDnsFirestoreAdapter();
/** Enrollment means server identity provisioned; it never attests that the device enabled DNS. */
export const enrollRecoveryDns = onCall(OPTIONS, async request => {
  const uid = requireConnectedUid(request.auth?.uid, request.auth?.token.firebase?.sign_in_provider);
  try { return await adapter.enroll(uid, request.data); }
  catch (error) { throw publicError(error); }
});
export const revokeRecoveryDns = onCall(OPTIONS, async request => {
  const uid = requireConnectedUid(request.auth?.uid, request.auth?.token.firebase?.sign_in_provider);
  try { return await adapter.revoke(uid, request.data); }
  catch (error) { throw publicError(error); }
});
/** Admin-only deletion hook. A mismatched/unavailable registry prevents a completion receipt. */
export async function detachRecoveryDnsAccount(uid: string) { return adapter.detachAccount(uid); }

function transactionStore(database: Firestore, transaction: Transaction, signal?: AbortSignal): RecoveryDnsStore {
  return {
    async get<T extends object>(path: string) {
      assertNotAborted(signal);
      const snapshot = await transaction.get(database.doc(path));
      assertNotAborted(signal);
      return snapshot.exists ? decode(snapshot.data() ?? {}) as T : undefined;
    },
    async queryUid(collection, uid, limit) {
      assertNotAborted(signal);
      const snapshot = await transaction.get(database.collection(collection).where("uid", "==", uid).limit(limit));
      assertNotAborted(signal);
      return snapshot.docs.map(document => ({ path: document.ref.path, value: decode(document.data()) }));
    },
    set(path, value) {
      assertNotAborted(signal);
      transaction.set(database.doc(path), encode(value));
    },
    delete(path) {
      assertNotAborted(signal);
      transaction.delete(database.doc(path));
    }
  };
}
function decode(value: Record<string, unknown>): Record<string, unknown> {
  const result = { ...value };
  for (const key of ["createdAt", "updatedAt", "expiresAt"]) if (result[key] instanceof Timestamp) result[key] = (result[key] as Timestamp).toMillis();
  return result;
}
function encode(value: object): Record<string, unknown> {
  const result = { ...value } as Record<string, unknown>;
  for (const key of ["createdAt", "updatedAt", "expiresAt"]) if (typeof result[key] === "number") result[key] = Timestamp.fromMillis(result[key] as number);
  return result;
}
function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RecoveryDnsError("pilot-unavailable");
}
function requireConnectedUid(uid: string | undefined, provider: unknown): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  if (provider !== "password" && provider !== "google.com" && provider !== "apple.com") throw new HttpsError("failed-precondition", "Connect an account before enrolling recovery DNS.");
  return uid;
}
function sanitized(error: unknown): RecoveryDnsError {
  return error instanceof RecoveryDnsError ? error : new RecoveryDnsError("pilot-unavailable");
}
function publicError(error: unknown): HttpsError {
  if (error instanceof RecoveryDnsError) {
    if (error.reason === "invalid-request") return new HttpsError("invalid-argument", "Unsupported recovery DNS request.");
    if (error.reason === "account-deleting") return new HttpsError("failed-precondition", "This account is being deleted.");
    if (error.reason === "recovery-required") return new HttpsError("failed-precondition", "Device recovery is required before changing recovery DNS.", { reason: "recovery-required" });
    if (error.reason === "pilot-full") return new HttpsError("resource-exhausted", "Recovery DNS pilot capacity is full.");
  }
  return new HttpsError("unavailable", "Recovery DNS is temporarily unavailable.");
}
