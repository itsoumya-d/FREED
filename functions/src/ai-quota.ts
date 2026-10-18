import { Timestamp } from "firebase-admin/firestore";

import { type AiAuthorization, type AiRoute } from "./ai.js";
import { runProtectedMutation, type ProtectedMutationOptions, type TransactionalStore } from "./transactional.js";

const UTC_DAY_MS = 86_400_000;
const FREE_CLARA_DAILY_LIMIT = 3;
const PREMIUM_CLARA_DAILY_LIMIT = 20;

export type AiUsageOptions = ProtectedMutationOptions & {
  uid: string;
  route: AiRoute;
  dailyUsagePath: string;
  consumeDailyQuota?: boolean;
  /** Backend-validated, expiring review capability. Never read from caller payload. */
  verifiedReviewAccess?: boolean;
};

/** Called inside one Firestore transaction; all quota and membership reads precede control writes. */
export async function authorizeAiUsage(
  store: TransactionalStore,
  options: AiUsageOptions,
  readPurchaseClaims: (uid: string) => Promise<readonly unknown[]>
): Promise<AiAuthorization> {
  if (options.route !== "clara" || options.consumeDailyQuota === false) {
    const result = await runProtectedMutation(store, options, () => undefined);
    return result === "applied" ? "allowed" : result;
  }

  const [dailyUsage, claims] = await Promise.all([
    store.get<{ count: number; windowStartedAt: number; expiresAt: number }>(options.dailyUsagePath),
    readPurchaseClaims(options.uid).catch(() => [])
  ]);
  const limit = claraDailyLimit(options.uid, claims, options.now, options.verifiedReviewAccess);
  const dayStartedAt = Math.floor(options.now / UTC_DAY_MS) * UTC_DAY_MS;
  const dayExpiresAt = dayStartedAt + UTC_DAY_MS;
  const current = dailyUsage.value;
  let count = 0;
  if (current) {
    if (current.windowStartedAt === dayStartedAt && current.expiresAt === dayExpiresAt &&
        Number.isSafeInteger(current.count) && current.count >= 0) {
      count = current.count;
    } else if (!Number.isSafeInteger(current.windowStartedAt) || current.windowStartedAt >= dayStartedAt) {
      // A malformed current-day control must not grant an unbounded allowance.
      count = Number.POSITIVE_INFINITY;
    }
  }
  const exhausted = count >= limit;

  const result = await runProtectedMutation(store, options, async () => {
    // This callback runs only for new requests after the deletion/idempotency/minute fences.
    if (!exhausted) {
      await store.set(options.dailyUsagePath, {
        count: count + 1,
        windowStartedAt: dayStartedAt,
        expiresAt: dayExpiresAt
      });
    }
  });
  if (result !== "applied") return result;
  return exhausted ? "daily-quota-exhausted" : "allowed";
}

export function claraDailyLimit(uid:string,claims:readonly unknown[],now:number,verifiedReviewAccess=false):3|20 {
  return verifiedReviewAccess || hasVerifiedPremium(uid,claims,now) ? PREMIUM_CLARA_DAILY_LIMIT : FREE_CLARA_DAILY_LIMIT;
}

function hasVerifiedPremium(uid: string, claims: readonly unknown[], now: number): boolean {
  if (!Array.isArray(claims)) return false;
  return claims.some((claim) => {
    if (typeof claim !== "object" || claim === null || Array.isArray(claim)) return false;
    const value = claim as Record<string, unknown>;
    if (value.uid !== uid || value.status !== "verified") return false;
    if (value.productId === "freed_premium_lifetime" && value.entitlementExpiresAt == null) return true;
    if (value.productId !== "freed_premium_monthly" && value.productId !== "freed_premium_yearly") return false;
    return value.entitlementExpiresAt instanceof Timestamp && value.entitlementExpiresAt.toMillis() > now;
  });
}
