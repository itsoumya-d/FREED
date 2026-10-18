import { COLLECTIONS, REVIEW_ACCESS_VERSION, validateServerDocument, type ReviewAccessState } from "./contracts.js";
import { consumeRateLimit, type TransactionalStore } from "./transactional.js";

export const REVIEW_ACCESS_KIND = "review-access-v1" as const;
export const REVIEW_ACCESS_MAX_LIFETIME_MS = 14 * 86_400_000;
const MINUTE_MS = 60_000;

export class ReviewAccessError extends Error {
  constructor(readonly reason: "account-deleting" | "rate-limited" | "unavailable") {
    super("Review access is unavailable.");
  }
}

export function reviewAccessPath(uid: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new ReviewAccessError("unavailable");
  return `${COLLECTIONS.backendJobs}/${uid}_${REVIEW_ACCESS_KIND}`;
}

/** Separate review capability; a read never creates, extends or verifies a purchase. */
export async function readReviewAccess(store: TransactionalStore, uid: string, now: number): Promise<ReviewAccessState> {
  const path = reviewAccessPath(uid);
  if (!Number.isSafeInteger(now) || now < 0) throw new ReviewAccessError("unavailable");
  const [tombstone, marker] = await Promise.all([
    store.get(`${COLLECTIONS.deletionTombstones}/${uid}`), store.get(path)
  ]);
  if (tombstone.value) throw new ReviewAccessError("account-deleting");
  if (!await consumeRateLimit(store, `${COLLECTIONS.rateLimits}/${uid}_review-access-read`, now, MINUTE_MS, 10)) {
    throw new ReviewAccessError("rate-limited");
  }
  const none: ReviewAccessState = { reviewAccessVersion: REVIEW_ACCESS_VERSION, ownerUid: uid, access: "none", expiresAt: null, capabilities: [] };
  if (!marker.value) return none;
  const record = marker.value as Record<string, unknown>;
  try { validateServerDocument(COLLECTIONS.backendJobs, record); }
  catch { return none; }
  const { createdAt, expiresAt } = record;
  if (Object.keys(record).length !== 5 || record.uid !== uid || record.kind !== REVIEW_ACCESS_KIND || record.status !== "active" ||
      typeof createdAt !== "number" || !Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > now ||
      typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= createdAt || expiresAt <= now ||
      expiresAt - createdAt > REVIEW_ACCESS_MAX_LIFETIME_MS) return none;
  try {
    return { reviewAccessVersion: REVIEW_ACCESS_VERSION, ownerUid: uid, access: "review", expiresAt: new Date(expiresAt).toISOString(), capabilities: ["ad-free", "premium-features"] };
  } catch { return none; }
}
