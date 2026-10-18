/** Only store-verified, bounded evidence grants access. Legacy premium flags do not. */
export type VerifiedPremiumEntitlement = {
  productId: "freed_premium_monthly" | "freed_premium_yearly" | "freed_premium_lifetime";
  platform: "ios" | "android";
  expiresAt: string | null;
  /** Latest exact purchase verification or authenticated current-claim read receipt. */
  verifiedAt: string;
  status: "verified" | "inactive" | "revoked";
  ownerUid?: string;
};

export const PREMIUM_OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

export function sanitizePremiumEntitlement(value: unknown): VerifiedPremiumEntitlement | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!["freed_premium_monthly", "freed_premium_yearly", "freed_premium_lifetime"].includes(String(item.productId)) ||
    !["ios", "android"].includes(String(item.platform)) ||
    !["verified", "inactive", "revoked"].includes(String(item.status)) ||
    typeof item.verifiedAt !== "string" || !Number.isFinite(Date.parse(item.verifiedAt)) ||
    (item.expiresAt !== null && (typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.expiresAt)))) ||
    (item.status === "verified" && item.expiresAt === null && item.productId !== "freed_premium_lifetime")) return null;
  return {
    productId: item.productId as VerifiedPremiumEntitlement["productId"],
    platform: item.platform as VerifiedPremiumEntitlement["platform"],
    expiresAt: item.expiresAt as string | null,
    verifiedAt: item.verifiedAt,
    status: item.status as VerifiedPremiumEntitlement["status"],
    ...(typeof item.ownerUid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(item.ownerUid) ? { ownerUid: item.ownerUid } : {})
  };
}

export function hasVerifiedPremium(value: unknown, now = Date.now(), expectedOwner?: string | null): boolean {
  const entitlement = sanitizePremiumEntitlement(value);
  if (!entitlement || entitlement.status !== "verified" || !Number.isFinite(now)) return false;
  if (expectedOwner !== undefined && (!expectedOwner || entitlement.ownerUid !== expectedOwner)) return false;
  const verified = Date.parse(entitlement.verifiedAt);
  if (now < verified - 5 * 60_000 || now >= verified + PREMIUM_OFFLINE_TTL_MS) return false;
  return entitlement.expiresAt === null || now < Date.parse(entitlement.expiresAt);
}

export type MembershipSummary = Readonly<{
  state: "none" | "active" | "expired" | "revoked" | "inactive" | "verification-required";
  planId: "monthly" | "yearly" | "lifetime" | null;
  platform: "ios" | "android" | null;
  /** Verified access boundary, never a next-charge date. */
  accessThrough: string | null;
  /** The current verification contract supplies no renewal/cancellation metadata. */
  renewal: "unknown" | "not-applicable";
  renewsAt: null;
}>;

/** Presentation facts only; copy and locale formatting belong to the screen. */
export function getMembershipSummary(value: unknown, now = Date.now(), expectedOwner?: string | null): MembershipSummary {
  const empty: MembershipSummary = { state: "none", planId: null, platform: null,
    accessThrough: null, renewal: "unknown", renewsAt: null };
  const proof = sanitizePremiumEntitlement(value);
  if (!proof || !Number.isFinite(now) ||
    (expectedOwner !== undefined && (!expectedOwner || proof.ownerUid !== expectedOwner))) return empty;
  const planId = proof.productId === "freed_premium_lifetime" ? "lifetime"
    : proof.productId === "freed_premium_yearly" ? "yearly" : "monthly";
  const expired = proof.expiresAt !== null && now >= Date.parse(proof.expiresAt);
  const state: MembershipSummary["state"] = proof.status === "revoked" ? "revoked"
    : proof.status === "inactive" ? "inactive" : expired ? "expired"
    : hasVerifiedPremium(proof, now, expectedOwner) ? "active" : "verification-required";
  return { state, planId, platform: proof.platform,
    accessThrough: state === "active" || state === "expired" ? proof.expiresAt : null,
    renewal: planId === "lifetime" ? "not-applicable" : "unknown", renewsAt: null };
}
