import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirebaseCallableContracts } from '../src/lib/firebase-client';
import { parseReviewAccessSnapshot, hasReviewAccess } from '../src/lib/review-access';
test('getReviewAccess accepts only undefined/null and an exact server DTO, never a client capability payload', async () => {
    const calls: any[] = [];
    let response: any = { reviewAccessVersion: 1, ownerUid: 'valid/firebase.owner', access: 'none', expiresAt: null, capabilities: [] };
    const contracts = createFirebaseCallableContracts({ call: async (name, payload) => { calls.push({ name, payload }); return response; } });
    await contracts.getReviewAccess();
    await contracts.getReviewAccess(null);
    for (const payload of [{}, false, 0, 'review', { access: 'review' }])
        await assert.rejects(() => contracts.getReviewAccess(payload as any));
    assert.deepEqual(calls, [{ name: 'getReviewAccess', payload: undefined }, { name: 'getReviewAccess', payload: null }]);
    response = { ...response, unexpected: 'proof' };
    await assert.rejects(() => contracts.getReviewAccess());
});
test('revoked, expired, malformed, wrong owner and distant expiry cannot license features', () => {
    const now = Date.now();
    const valid = { reviewAccessVersion: 1, ownerUid: 'u', access: 'review', expiresAt: new Date(now + 60000).toISOString(), capabilities: ['ad-free', 'premium-features'] };
    assert.equal(hasReviewAccess(parseReviewAccessSnapshot(valid), 'u'), true);
    assert.equal(hasReviewAccess(parseReviewAccessSnapshot({ ...valid, access: 'none', expiresAt: null, capabilities: [] }), 'u'), false);
    assert.equal(hasReviewAccess(parseReviewAccessSnapshot({ ...valid, expiresAt: new Date(now - 1).toISOString() }), 'u'), false);
    assert.equal(hasReviewAccess(parseReviewAccessSnapshot(valid), 'other'), false);
    for (const proof of [{ ...valid, capabilities: ['premium-features'] }, { ...valid, ownerUid: '' }, { ...valid, expiresAt: new Date(now + 15 * 86400000).toISOString() }, { ...valid, reviewAccessVersion: 2 }])
        assert.throws(() => parseReviewAccessSnapshot(proof));
});
