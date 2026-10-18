import assert from 'node:assert/strict';
import { getPresentedEarnedUnlock, nativeGrantConfirmsUnlock, nativeWindowMatchesUnlock } from '../src/lib/native-unlock-confirmation';
import type { EarnedUnlock } from '../src/lib/recovery-state';
const idA = '12345678-1234-4234-8234-123456789abc';
const idB = '87654321-1234-4234-8234-123456789abc';
const now = Date.parse('2026-10-03T10:00:00Z');
const unlock: EarnedUnlock = { id: 'unlock-a', nativeInterventionId: idA, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + 600000).toISOString(), durationMinutes: 10, sourceChallengeId: 'reset', sourceAttemptHost: 'com.google.android.youtube' };
const evidence = { nativeUnlockGrantAccepted: true, nativeUnlockGrantInterventionId: idA, activeUnlockInterventionId: idA, activeUnlockExpiresAt: unlock.expiresAt, activeUnlockSourcePackage: 'com.google.android.youtube' };
assert.equal(nativeGrantConfirmsUnlock(unlock, evidence, 'android', now), true);
for (const bad of [null, {}, { ...evidence, nativeUnlockGrantAccepted: false }, { ...evidence, nativeUnlockGrantAccepted: 'true' }, { ...evidence, nativeUnlockGrantInterventionId: idB }, { ...evidence, activeUnlockInterventionId: idB }, { ...evidence, activeUnlockSourcePackage: 'com.instagram.android' }, { ...evidence, activeUnlockExpiresAt: new Date(now + 900000).toISOString() }]) {
  assert.equal(nativeGrantConfirmsUnlock(unlock, bad as typeof evidence, 'android', now), false);
}
assert.equal(nativeGrantConfirmsUnlock(unlock, evidence, 'android', now + 600000), false);
assert.equal(nativeGrantConfirmsUnlock({ ...unlock, historicalOnly: true }, evidence, 'android', now), false);
assert.equal(getPresentedEarnedUnlock([unlock], null, 'android', now), null);
const newer = { ...unlock, id: 'unlock-b', nativeInterventionId: idB, startedAt: new Date(now + 1000).toISOString(), expiresAt: new Date(now + 120000).toISOString(), sourceAttemptHost: 'com.instagram.android' };
const bEvidence = { ...evidence, nativeUnlockGrantInterventionId: idB, activeUnlockInterventionId: idB, activeUnlockExpiresAt: newer.expiresAt, activeUnlockSourcePackage: newer.sourceAttemptHost };
assert.equal(getPresentedEarnedUnlock([unlock, newer], bEvidence, 'android', now + 1000)?.id, newer.id);
assert.equal(getPresentedEarnedUnlock([unlock, newer], evidence, 'android', now + 1000)?.id, unlock.id);
assert.equal(getPresentedEarnedUnlock([{ ...unlock, nativeInterventionId: undefined, sourceAttemptHost: undefined }], null, 'android', now)?.id, unlock.id);
const surface = { ...unlock, sourceAttemptHost: undefined };
assert.equal(nativeWindowMatchesUnlock(surface, { activeFocusShieldUnlockInterventionId: idA, activeFocusShieldUnlockExpiresAt: unlock.expiresAt }, 'android', now), true);
assert.equal(nativeWindowMatchesUnlock(surface, evidence, 'android', now), false);
console.log('native unlock acknowledgment, expiry, target, restoration and newer-window regressions passed');
