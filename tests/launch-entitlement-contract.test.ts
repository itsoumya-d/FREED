import assert from 'node:assert/strict';
import { createFirebaseCallableContracts } from '../src/lib/firebase-client';

async function main() {
  let response: unknown = { entitlement: null };
  const calls: Array<{ name: string; data: unknown }> = [];
  const contracts = createFirebaseCallableContracts({ call: async (name, data) => { calls.push({ name, data }); return response; } });
  assert.deepEqual(await contracts.getPremiumEntitlement(), { entitlement: null });
  const proof = { productId: 'freed_premium_monthly', platform: 'ios', expiresAt: '2026-11-01T00:00:00Z', verifiedAt: '2026-10-01T00:00:00Z', status: 'verified' };
  response = { entitlement: proof };
  assert.deepEqual(await contracts.getPremiumEntitlement(), response);
  for (const invalid of [undefined, { active: true }, { entitlement: { ...proof, transactionId: '2000001234567890' } }, { entitlement: { ...proof, expiresAt: null } }, { entitlement: { ...proof, verifiedAt: 'invalid' } }]) {
    response = invalid;
    await assert.rejects(() => contracts.getPremiumEntitlement(), /Invalid membership response/);
  }
  response = { ok: true };
  assert.deepEqual(await contracts.fencePurchaseAccountLink(), { ok: true });
  response = { ok: true, uid: 'secret-owner' };
  await assert.rejects(() => contracts.fencePurchaseAccountLink(), /safety check/);
  response = { active: true, entitlementId: 'premium', productId: 'freed_premium_monthly', platform: 'ios', status: 'verified', expiresAt: '2099-11-01T00:00:00.000Z' };
  const request = { platform: 'ios', productId: 'freed_premium_monthly', transactionId: '2000001234567890', restore: true, clientEventId: 'purchase_contract_123', signedTransactionInfo: 'YWJj.ZGVm.Z2hp' } as const;
  await contracts.verifyStorePurchase(request);
  assert.deepEqual(calls.at(-1)?.data, request);
  for (const signedTransactionInfo of ['unsigned', 'a.b.' , 'a'.repeat(65536) + '.b.c']) {
    await assert.rejects(() => contracts.verifyStorePurchase({ ...request, signedTransactionInfo }), /not permitted/);
  }
  console.log('PASS: protected entitlement responses and bounded signed purchase witness');
}
void main();
