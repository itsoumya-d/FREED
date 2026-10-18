import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '../src/lib/owner-recovery-store';
import { createDefaultRecoveryState, recordDailyCheckIn, recordAppSessionStart } from '../src/lib/recovery-state';
const legacyKey = 'freed.recovery.state.v1';
function fixture() {
  let owner: string | null = 'owner-a', failed = false;
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (failed) throw new Error('disk'); values.set(key, value); }, removeItem: (key: string) => values.delete(key) };
  const store = createOwnerRecoveryStore({ storage, currentOwnerUid: () => owner });
  return { values, store, storage, owner: (value: string | null) => { owner = value; }, fail: (value: boolean) => { failed = value; } };
}
const privateState = () => recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'Owner-only private words' }, '2026-10-07T12:00:00.000Z');
test('coldstart and owner switches retain exact owner history while old writers cannot publish to the next owner', () => {
  const f = fixture(), a = f.store.activate('owner-a'); a.save(privateState());
  f.owner('owner-b'); const b = f.store.activate('owner-b');
  assert.equal(b.read().dailyCheckIns.length, 0);
  assert.throws(() => a.save(privateState()), /owner.*changed/i);
  b.save({ ...createDefaultRecoveryState(), completedChallenges: 3 });
  f.owner('owner-a'); const cold = createOwnerRecoveryStore({ storage: f.storage, currentOwnerUid: () => 'owner-a' }).activate('owner-a');
  assert.equal(cold.read().dailyCheckIns[0].reflection, 'Owner-only private words');
  assert.equal(cold.read().completedChallenges, 0);
});
test('legacy history remains unclaimed even when an account appears; explicit adoption strips live authority and is atomic', () => {
  const f = fixture(), legacy = JSON.stringify({ ...privateState(), signedInEmail: 'earlier@example.test', premium: true, automaticBackupEnabled: true });
  f.values.set(legacyKey, legacy);
  const a = f.store.activate('owner-a');
  assert.equal(a.read().dailyCheckIns.length, 0); assert.equal(a.hasUnclaimedLegacy(), true);
  assert.throws(() => a.adoptLegacy(false), /confirmation/i);
  f.fail(true); assert.throws(() => a.adoptLegacy(true)); f.fail(false);
  assert.equal(a.read().dailyCheckIns.length, 0); assert.equal(f.values.get(legacyKey), legacy);
  a.adoptLegacy(true);
  assert.equal(a.read().dailyCheckIns[0].reflection, 'Owner-only private words');
  assert.equal(a.read().premium, false); assert.equal(a.read().premiumEntitlement, null); assert.equal(a.read().automaticBackupEnabled, false);
  assert.equal(f.values.get(legacyKey), legacy);
  f.owner('owner-b'); const b = f.store.activate('owner-b'); assert.equal(b.hasUnclaimedLegacy(), false);
  assert.throws(() => b.adoptLegacy(true), /unclaimed/i);
});
test('revoke retains owner data, failure preserves the durable envelope, and purge never erases a different owner', () => {
  const f = fixture(), a = f.store.activate('owner-a'); a.save(privateState());
  const raw = f.values.get(OWNER_RECOVERY_STORAGE_KEY);
  f.fail(true); assert.throws(() => a.save(createDefaultRecoveryState())); f.fail(false); assert.equal(f.values.get(OWNER_RECOVERY_STORAGE_KEY), raw);
  f.store.revoke(); assert.throws(() => a.save(createDefaultRecoveryState()), /owner.*changed/i);
  f.owner('owner-b'); f.store.activate('owner-b').save({ ...createDefaultRecoveryState(), completedChallenges: 7 });
  f.store.purgeOwner('owner-a');
  assert.equal(f.store.activate('owner-b').read().completedChallenges, 7);
  f.owner('owner-a'); assert.equal(f.store.activate('owner-a').read().dailyCheckIns.length, 0);
});
test('an empty account hydration session does not block explicit legacy adoption', () => {
  const f = fixture(); f.values.set(legacyKey, JSON.stringify(privateState()));
  const a = f.store.activate('owner-a'); a.save(recordAppSessionStart(a.read()));
  assert.equal(a.adoptLegacy(true).dailyCheckIns[0].reflection, 'Owner-only private words');
});
