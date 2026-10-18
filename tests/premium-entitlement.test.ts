import assert from "node:assert/strict";
import { createDefaultRecoveryState, hydrateRecoveryState, setVerifiedPremiumEntitlement } from "../src/lib/recovery-state";
import { hasVerifiedPremium } from "../src/lib/premium-entitlement";

const now = Date.parse("2026-10-01T10:00:00.000Z");
const evidence = { productId: "freed_premium_monthly" as const, platform: "android" as const, expiresAt: "2026-11-01T10:00:00.000Z", verifiedAt: "2026-10-01T10:00:00.000Z", status: "verified" as const };
assert.equal(hasVerifiedPremium(evidence, now), true);
assert.equal(hasVerifiedPremium(evidence, now + 86_400_000), false, "offline evidence expires after 24 hours even with future store expiry");
assert.equal(hasVerifiedPremium({...evidence,expiresAt:"2026-10-01T10:00:00.000Z"},now),false,"access ends at the exact paid expiry");
assert.equal(hasVerifiedPremium({...evidence,status:"revoked"},now),false);
assert.equal(hasVerifiedPremium({...evidence,expiresAt:null},now),false,"recurring subscriptions require an expiry");
assert.equal(hasVerifiedPremium(evidence,now-3600_000),false,"clock rollback must not stretch cached evidence");

const progress = hydrateRecoveryState({...createDefaultRecoveryState(),streakDays:12,bestStreakDays:20,premium:true,premiumPlanId:"monthly"});
assert.equal(hasVerifiedPremium(progress.premiumEntitlement,now),false,"legacy booleans require store revalidation");
const granted = setVerifiedPremiumEntitlement(progress,evidence,new Date(now).toISOString());
assert.equal(granted.premium,true);
assert.equal(granted.streakDays,12);
assert.equal(granted.bestStreakDays,20);
assert.equal(granted.premiumEntitlement?.expiresAt,evidence.expiresAt);
const revoked = setVerifiedPremiumEntitlement(granted,{...evidence,status:"revoked"},new Date(now).toISOString());
assert.equal(revoked.premium,false);
assert.equal(revoked.bestStreakDays,20,"revocation never deletes recovery progress");
assert.equal(hydrateRecoveryState(granted).premiumEntitlement?.expiresAt,evidence.expiresAt);
console.log("premium expiry, offline bound, revocation and saved-state migration tests passed");

const ownerProof = { productId: "freed_premium_monthly", platform: "ios", status: "verified", expiresAt: new Date(Date.now()+3600000).toISOString(), verifiedAt: new Date().toISOString(), ownerUid: "owner_a" };
assert.equal(hasVerifiedPremium(ownerProof, Date.now(), "owner_a"), true);
assert.equal(hasVerifiedPremium(ownerProof, Date.now(), "owner_b"), false);
assert.equal(hasVerifiedPremium(ownerProof, Date.now(), null), false);
console.log("Account-bound offline Premium cache tests passed");
