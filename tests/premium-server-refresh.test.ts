import assert from 'node:assert/strict';
import { premiumEntitlementFromClaims } from '../functions/src/premium-state';
import { hasVerifiedPremium, PREMIUM_OFFLINE_TTL_MS } from '../src/lib/premium-entitlement';
const original = Date.parse('2026-10-01T10:00:00.000Z');
const checkedAt = original + 36 * 3600000;
const expiry = original + 72 * 3600000;
const timestamp = (time: number) => ({ toMillis: () => time });
const claim = { uid: 'owner', provider: 'apple', productId: 'freed_premium_monthly', status: 'verified', verifiedAt: timestamp(original), entitlementExpiresAt: timestamp(expiry) };
const proof = premiumEntitlementFromClaims('owner', [claim], checkedAt);
assert.equal(hasVerifiedPremium(proof, checkedAt), true, 'A current authenticated server refresh must remain usable during verified multi-day grace.');
assert.equal(proof?.expiresAt, new Date(expiry).toISOString());
assert.equal(hasVerifiedPremium(proof, checkedAt + PREMIUM_OFFLINE_TTL_MS), false, 'Refreshed offline evidence is still bounded at 24 hours.');
assert.equal(premiumEntitlementFromClaims('owner', [claim], expiry), null);
console.log('Current server proof issuance and bounded grace cache passed');
for (const status of ['inactive', 'expired', 'revoked', 'on-hold', 'paused']) {
  assert.equal(premiumEntitlementFromClaims('owner', [{ ...claim, status }], checkedAt), null, 'A fresh read must not revive non-verified lifecycle state.');
}
assert.equal(premiumEntitlementFromClaims('other-owner', [claim], checkedAt), null);
assert.equal(premiumEntitlementFromClaims('owner', [{ ...claim, verifiedAt: timestamp(checkedAt + 300001) }], checkedAt), null);
assert.equal(premiumEntitlementFromClaims('owner', [{ ...claim, verifiedAt: timestamp(NaN) }], checkedAt), null);
assert.equal(premiumEntitlementFromClaims('owner', [claim], NaN), null);
const normalPaid = { ...claim, productId: 'freed_premium_yearly', verifiedAt: timestamp(original + 3600000), entitlementExpiresAt: timestamp(original + 365 * 86400000) };
const newest = premiumEntitlementFromClaims('owner', [claim, normalPaid], checkedAt);
assert.equal(newest?.productId, normalPaid.productId);
assert.equal(newest?.verifiedAt, new Date(checkedAt).toISOString());
assert.equal(newest?.expiresAt, new Date(original + 365 * 86400000).toISOString());
