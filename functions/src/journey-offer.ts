import {
  COLLECTIONS, JOURNEY_OFFER_VERSION, validateServerDocument,
  type JourneyOfferAcknowledgementInput, type JourneyOfferState
} from "./contracts.js";
import { consumeRateLimit, runProtectedMutation, type TransactionalStore } from "./transactional.js";

const MINUTE_MS = 60_000;
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * MINUTE_MS;
export const JOURNEY_OFFER_KIND = "journey-offer-v1" as const;

export class JourneyOfferError extends Error {
  constructor(readonly reason: "account-deleting" | "rate-limited" | "unavailable") {
    super("Journey offer metadata is unavailable.");
  }
}

export function journeyOfferPath(uid: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new JourneyOfferError("unavailable");
  return `${COLLECTIONS.backendJobs}/${uid}_${JOURNEY_OFFER_KIND}`;
}

/** Read and acknowledge use the same verified UID; this record confers no premium authority. */
export async function readJourneyOfferState(store: TransactionalStore, uid: string, now: number): Promise<JourneyOfferState> {
  const path = journeyOfferPath(uid);
  const [tombstone, offer] = await Promise.all([
    store.get(`${COLLECTIONS.deletionTombstones}/${uid}`), store.get(path)
  ]);
  if (tombstone.value) throw new JourneyOfferError("account-deleting");
  if (offer.value) validateAcknowledgement(offer.value, uid);
  if (!await consumeRateLimit(store, `${COLLECTIONS.rateLimits}/${uid}_journey-offer-read`, now, MINUTE_MS, 10)) {
    throw new JourneyOfferError("rate-limited");
  }
  return { offerVersion: JOURNEY_OFFER_VERSION, acknowledged: offer.value !== undefined };
}

/** The first decision is durable; callbacks and later purchase outcomes never rewrite it. */
export async function acknowledgeJourneyOfferMetadata(
  store: TransactionalStore, uid: string, input: JourneyOfferAcknowledgementInput, now: number
): Promise<JourneyOfferState> {
  const path = journeyOfferPath(uid);
  const [tombstone, offer] = await Promise.all([
    store.get(`${COLLECTIONS.deletionTombstones}/${uid}`), store.get(path)
  ]);
  if (tombstone.value) throw new JourneyOfferError("account-deleting");
  if (offer.value) {
    validateAcknowledgement(offer.value, uid);
    if (!await consumeRateLimit(store, `${COLLECTIONS.rateLimits}/${uid}_journey-offer`, now, MINUTE_MS, 10)) {
      throw new JourneyOfferError("rate-limited");
    }
    return { offerVersion: JOURNEY_OFFER_VERSION, acknowledged: true };
  }
  const result = await runProtectedMutation(store, {
    rateLimitPath: `${COLLECTIONS.rateLimits}/${uid}_journey-offer`,
    idempotencyPath: `${COLLECTIONS.idempotency}/${uid}_journey-offer_v${JOURNEY_OFFER_VERSION}_${input.eventId}`,
    accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${uid}`,
    now, windowMs: MINUTE_MS, limit: 10, idempotencyTtlMs: IDEMPOTENCY_TTL_MS
  }, () => store.set(path, validateServerDocument(COLLECTIONS.backendJobs, {
    uid, kind: JOURNEY_OFFER_KIND, status: input.decision, createdAt: now
  })));
  if (result === "account-deleting") throw new JourneyOfferError("account-deleting");
  if (result === "rate-limited") throw new JourneyOfferError("rate-limited");
  // A control receipt without its permanent marker is inconsistent; do not invent acknowledgement.
  if (result !== "applied") throw new JourneyOfferError("unavailable");
  return { offerVersion: JOURNEY_OFFER_VERSION, acknowledged: true };
}

function validateAcknowledgement(value: object, uid: string): void {
  const record = value as Record<string, unknown>;
  try { validateServerDocument(COLLECTIONS.backendJobs, record); }
  catch { throw new JourneyOfferError("unavailable"); }
  if (Object.keys(record).length !== 4 || record.uid !== uid || record.kind !== JOURNEY_OFFER_KIND ||
      (record.status !== "free" && record.status !== "purchased") ||
      typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) || record.createdAt < 0) {
    throw new JourneyOfferError("unavailable");
  }
}
