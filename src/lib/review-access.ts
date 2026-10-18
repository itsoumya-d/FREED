/** Server-issued review licensing is deliberately independent from store entitlement. */
export type ReviewAccessSnapshot = {
  reviewAccessVersion: 1;
  ownerUid: string;
  access: 'none' | 'review';
  expiresAt: string | null;
  capabilities: [] | ['ad-free', 'premium-features'];
};
export function parseReviewAccessSnapshot(value: unknown, now = Date.now()): ReviewAccessSnapshot {
  const proof = value as ReviewAccessSnapshot;
  if (!proof || typeof proof !== 'object' || Array.isArray(proof) ||
    Object.keys(proof).sort().join(',') !== 'access,capabilities,expiresAt,ownerUid,reviewAccessVersion' ||
    proof.reviewAccessVersion !== 1 || typeof proof.ownerUid !== 'string' || !proof.ownerUid.trim() ||
    proof.ownerUid.length > 128 || !Array.isArray(proof.capabilities)) throw Error('Invalid review access response.');
  if (proof.access === 'none' && proof.expiresAt === null && proof.capabilities.length === 0) return { ...proof, capabilities: [] };
  const expiry = typeof proof.expiresAt === 'string' ? Date.parse(proof.expiresAt) : NaN;
  if (proof.access !== 'review' || !Number.isFinite(expiry) || new Date(expiry).toISOString() !== proof.expiresAt ||
    expiry > now + 14 * 86400000 || proof.capabilities.join(',') !== 'ad-free,premium-features') throw Error('Invalid review access response.');
  return { ...proof, capabilities: ['ad-free', 'premium-features'] };
}
export function hasReviewAccess(proof: ReviewAccessSnapshot | null, ownerUid: string | null, now = Date.now()): boolean {
  return Boolean(ownerUid && proof?.ownerUid === ownerUid && proof.access === 'review' &&
    Date.parse(proof.expiresAt ?? '') > now && Date.parse(proof.expiresAt ?? '') <= now + 14 * 86400000 &&
    proof.capabilities.join(',') === 'ad-free,premium-features');
}
