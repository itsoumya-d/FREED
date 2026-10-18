export type PublicPremiumEntitlement = {
  productId: "freed_premium_monthly" | "freed_premium_yearly" | "freed_premium_lifetime";
  platform: "ios" | "android";
  expiresAt: string | null;
  verifiedAt: string;
  status: "verified";
};

function millis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    try { return Number(value.toMillis()); } catch { return NaN; }
  }
  return NaN;
}

/** Admin-only claims are projected into a minimal client entitlement, never raw store data. */
export function premiumEntitlementFromClaims(uid: string, claims: unknown[], now: number): PublicPremiumEntitlement | null {
  if (!Number.isFinite(new Date(now).getTime())) return null;
  const candidates: PublicPremiumEntitlement[] = [];
  for (const value of claims) {
    if (!value || typeof value !== "object") continue;
    const claim = value as Record<string, unknown>;
    if (claim.uid !== uid || claim.status !== "verified" ||
      !["freed_premium_monthly", "freed_premium_yearly", "freed_premium_lifetime"].includes(String(claim.productId)) ||
      !["apple", "google-play"].includes(String(claim.provider))) continue;
    const verifiedAt = millis(claim.verifiedAt);
    const expiresAt = millis(claim.entitlementExpiresAt);
    if (!Number.isFinite(verifiedAt) || verifiedAt > now + 300000 ||
      (claim.productId !== "freed_premium_lifetime" && (!Number.isFinite(expiresAt) || expiresAt <= now))) continue;
    candidates.push({
      productId: claim.productId as PublicPremiumEntitlement["productId"],
      platform: claim.provider === "apple" ? "ios" : "android",
      expiresAt: claim.productId === "freed_premium_lifetime" ? null : new Date(expiresAt).toISOString(),
      verifiedAt: new Date(verifiedAt).toISOString(),
      status: "verified"
    });
  }
  candidates.sort((a,b)=>Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt));
  const current = candidates[0];
  // This authenticated server read issues a new bounded client proof of the
  // current claim. Keep source verification timestamps for claim ordering and
  // never move the provider-authenticated expiry (including signed grace).
  return current ? { ...current, verifiedAt: new Date(now).toISOString() } : null;
}
