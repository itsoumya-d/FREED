import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveResetRewardGrantIntent, getResetRewardCapSeconds, RESET_REWARD_POLICY_V1, type ResetRewardPolicyInput } from '../src/lib/reset-reward-policy';
import { hydrateRecoveryState, recordEarnedUnlock, createDefaultRecoveryState } from '../src/lib/recovery-state';

const interventionId = '10101010-1010-4010-8010-101010101010';
const groupId = '20202020-2020-4020-8020-202020202020';
const completedAtMs = Date.parse('2026-10-08T10:00:00.000Z');
function input(category: 'breathe' | 'move' | 'find' = 'breathe'): ResetRewardPolicyInput {
  const ownerFenceReference = { ownerId: 'account-a', token: {} };
  const target = { kind: 'ios-app-group' as const, groupId, groupRevision: 2, configurationGeneration: 3, scopeEpoch: 4, tokenType: 'application' as const };
  return {
    policyVersion: 1,
    completionStatus: 'live-verified',
    session: { id: 'session-1', ownerId: 'account-a', phase: 'completed', elapsedMs: 60_000, createdAtMs: completedAtMs - 60_000,
      completion: { outcome: 'unknown', completedAtMs }, evidence: { motionSamples: 0, steps: 0, distanceMeters: 0, locationSamples: 0 },
      challenge: { id: 'template-1', title: 'একটি বিরতি', category: 'reset', choiceGroup: category, durationSec: 60, intensity: 'calm', premium: false,
        icon: 'Waves', why: 'A pause.', steps: ['Pause.', 'Finish.'], verification: category === 'find' ? { version: 1, kind: 'photo', targetId: 'flower' } : { version: 1, kind: 'timer' } } },
    templateReference: { templateId: 'template-1', templateVersion: 1 },
    durableCompletionSessionId: 'session-1',
    action: { kind: 'use-app', completionSessionId: 'session-1' },
    origin: { completionSessionId: 'session-1', nativeInterventionId: interventionId, target, ownerFenceReference },
    current: { nativeInterventionId: interventionId, target: { ...target }, ownerFenceReference,
      consumedCompletionSessionIds: [], consumedInterventionIds: [], hasActiveWindow: false },
    photoProof: category === 'find' ? { version: 1, completionSessionId: 'session-1', templateId: 'template-1', templateVersion: 1,
      targetId: 'flower', verificationRuleVersion: 1, status: 'matched', confidence: .8, verifiedAtMs: completedAtMs,
      evaluationRevision: 'held-out-v1', providerModelRevision: 'vision-v1', confidenceThreshold: .75, thresholdRevision: 'flower-threshold-v1' } : null,
    evaluatedFindTargets: [{ targetId: 'flower', enabled: true, evaluationRevision: 'held-out-v1', providerModelRevision: 'vision-v1',
      verificationRuleVersion: 1, confidenceThreshold: .75, thresholdRevision: 'flower-threshold-v1', heldOutPrecision: .95, heldOutRecall: .85 }],
  };
}
function denied(value: ResetRewardPolicyInput, reason: string) {
  assert.deepEqual(deriveResetRewardGrantIntent(value), { eligible: false, reason });
}

test('v1 derives category caps from the completed explicit category independent of task duration or title', () => {
  for (const [category, seconds] of [['breathe', 120], ['move', 300], ['find', 300]] as const) {
    const result = deriveResetRewardGrantIntent(input(category));
    assert.equal(result.eligible, true);
    if (!result.eligible) return;
    assert.equal(result.intent.seconds, seconds);
    assert.equal(result.intent.category, category);
    assert.equal(result.intent.policyVersion, 1);
    assert.equal(result.intent.completionSessionId, 'session-1');
    assert.equal(result.intent.templateId, 'template-1');
    assert.equal(result.intent.templateVersion, 1);
    assert.equal(result.intent.nativeInterventionId, interventionId);
    assert.equal('expiresAt' in result.intent, false);
    assert.equal('granted' in result.intent, false);
  }
});

test('v1 cap table remains immutable and unsupported categories or policy versions cannot derive a cap', () => {
  assert.ok(Object.isFrozen(RESET_REWARD_POLICY_V1));
  assert.ok(Object.isFrozen(RESET_REWARD_POLICY_V1.seconds));
  assert.throws(() => { (RESET_REWARD_POLICY_V1.seconds as any).breathe = 7200; }, TypeError);
  assert.equal(getResetRewardCapSeconds('breathe', 1), 120);
  assert.equal(getResetRewardCapSeconds('move', 1), 300);
  assert.equal(getResetRewardCapSeconds('find', 1), 300);
  for (const value of [undefined, 'breathing', 'physical', 'Find', 'Notice five nearby objects', 'toString']) assert.equal(getResetRewardCapSeconds(value, 1), null);
  for (const value of [undefined, 0, 2, '1', NaN, Infinity]) assert.equal(getResetRewardCapSeconds('breathe', value), null);
});

test('English titles, translated instructions and legacy physical categories never supply missing choice metadata', () => {
  for (const title of ['Breathe slowly', 'Move around', 'Find a flower', 'শ্বাস নিন']) {
    const value = input(); value.session!.challenge = { ...value.session!.challenge, choiceGroup: undefined, category: 'physical', title };
    denied(value, 'unsupported-category');
  }
});

test('intent is available only for explicit Use app after this exact completion was durably saved', () => {
  const value = input();
  value.action = null; denied(value, 'use-app-required');
  value.action = { kind: 'use-app', completionSessionId: 'session-1' };
  value.durableCompletionSessionId = null; denied(value, 'completion-not-saved');
  value.durableCompletionSessionId = 'session-elsewhere'; denied(value, 'completion-not-saved');
  value.durableCompletionSessionId = 'session-1';
  value.action.completionSessionId = 'session-elsewhere'; denied(value, 'completion-mismatch');
});

test('cancelled, failed, unverified and restored completions never earn a new intent', () => {
  for (const status of ['cancelled', 'failed', 'unverified', 'restored'] as const) {
    const value = input(); value.completionStatus = status; denied(value, 'completion-not-live-verified');
  }
  const value = input(); value.session!.phase = 'paused'; denied(value, 'completion-not-live-verified');
  value.session!.phase = 'completed'; value.session!.completion = undefined; denied(value, 'completion-not-live-verified');
});

test('unfinished elapsed time and unsatisfied movement rules cannot be promoted by a completed phase', () => {
  const value = input(); value.session!.elapsedMs = 59_999; denied(value, 'verification-not-satisfied');
  for (const elapsedMs of [NaN, Infinity, -1]) { value.session!.elapsedMs = elapsedMs; denied(value, 'verification-not-satisfied'); }
  const move = input('move'); move.session!.challenge.verification = { version: 1, kind: 'steps', minSteps: 12 };
  move.session!.evidence.steps = 11; denied(move, 'verification-not-satisfied');
  move.session!.evidence.steps = 12; assert.equal(deriveResetRewardGrantIntent(move).eligible, true);
  move.session!.challenge.verification = undefined; denied(move, 'verification-not-satisfied');
});

test('honest still-urging and no-feedback completions retain the full category cap', () => {
  for (const outcome of ['helped', 'still-urging', 'unknown'] as const) {
    const value = input(); value.session!.completion!.outcome = outcome;
    const result = deriveResetRewardGrantIntent(value); assert.equal(result.eligible, true);
    if (result.eligible) assert.equal(result.intent.seconds, 120);
  }
});

test('a Find replacement uses the actually completed Breathe category and cannot retain Find seconds', () => {
  const value = input('find'); value.session!.challenge.choiceGroup = 'breathe'; value.session!.challenge.verification = { version: 1, kind: 'timer' };
  const result = deriveResetRewardGrantIntent(value); assert.equal(result.eligible, true);
  if (result.eligible) { assert.equal(result.intent.category, 'breathe'); assert.equal(result.intent.seconds, 120); }
});

test('timer-only Find and absent or failed durable matched-photo proof are denied', () => {
  const timer = input('find'); timer.session!.challenge.verification = { version: 1, kind: 'timer' }; denied(timer, 'find-photo-required');
  const value = input('find'); value.photoProof = null; denied(value, 'find-photo-proof-invalid');
  for (const status of ['uncertain', 'failed', 'cancelled'] as const) { const other = input('find'); other.photoProof!.status = status; denied(other, 'find-photo-proof-invalid'); }
});

test('Find photo proof must bind the exact completion, template version, target rule and model evaluation', () => {
  for (const patch of [
    { completionSessionId: 'session-2' }, { templateId: 'template-2' }, { templateVersion: 2 }, { targetId: 'plant' },
    { verificationRuleVersion: 2 }, { confidence: .64 }, { confidence: 1.1 }, { confidence: NaN },
    { verifiedAtMs: completedAtMs + 1 }, { verifiedAtMs: completedAtMs - 60_001 },
    { evaluationRevision: '' }, { providerModelRevision: '' },
  ]) {
    const value = input('find'); Object.assign(value.photoProof!, patch); denied(value, 'find-photo-proof-invalid');
  }
});

test('Find requires an enabled held-out target evaluation at the approved precision and recall floors', () => {
  for (const patch of [{ enabled: false }, { heldOutPrecision: .949 }, { heldOutRecall: .849 }, { heldOutPrecision: NaN }, { heldOutRecall: 1.1 }]) {
    const value = input('find'); Object.assign(value.evaluatedFindTargets[0], patch); denied(value, 'find-target-not-evaluated');
  }
  const value = input('find'); value.evaluatedFindTargets = []; denied(value, 'find-target-not-evaluated');
  for (const patch of [{ evaluationRevision: 'unknown' }, { providerModelRevision: 'different' }]) {
    const other = input('find'); Object.assign(other.photoProof!, patch); denied(other, 'find-target-not-evaluated');
  }
});

test('Find confidence above the global floor still fails below the exact evaluated target calibration', () => {
  const value = input('find');
  Object.assign(value.evaluatedFindTargets[0], { confidenceThreshold: .9, thresholdRevision: 'flower-threshold-v2' });
  Object.assign(value.photoProof!, { confidence: .8, confidenceThreshold: .9, thresholdRevision: 'flower-threshold-v2' });
  denied(value, 'find-photo-proof-invalid');
});

test('Find cannot mix provider, rule, or threshold revisions from different held-out calibrations', () => {
  for (const patch of [{ thresholdRevision: 'other-threshold' }, { confidenceThreshold: .7 }, { verificationRuleVersion: 2 }]) {
    const value = input('find'); Object.assign(value.evaluatedFindTargets[0], patch); denied(value, 'find-target-not-evaluated');
  }
});

test('a malformed calibration cannot enable a target or bypass its confidence threshold', () => {
  for (const confidenceThreshold of [NaN, Infinity, 1.1, -.1]) {
    const value = input('find'); Object.assign(value.photoProof!, { confidenceThreshold }); denied(value, 'find-photo-proof-invalid');
  }
});

test('template version and template identity are explicit and never guessed from a legacy challenge', () => {
  for (const templateVersion of [0, NaN, Infinity, 1.1]) { const value = input(); value.templateReference.templateVersion = templateVersion; denied(value, 'template-reference-invalid'); }
  const value = input(); value.templateReference.templateId = 'other'; denied(value, 'template-reference-invalid');
  value.templateReference.templateId = 'template-1'; value.policyVersion = 2; denied(value, 'unsupported-policy');
});

test('ownership or live owner fence change rejects the original completion even for the same account name', () => {
  const value = input(); value.current.ownerFenceReference = { ownerId: 'account-a', token: {} }; denied(value, 'owner-fence-changed');
  const other = input(); other.current.ownerFenceReference = { ownerId: 'account-b', token: other.origin.ownerFenceReference.token }; denied(other, 'owner-fence-changed');
  const sessionOwner = input(); sessionOwner.session!.ownerId = 'account-b'; denied(sessionOwner, 'owner-fence-changed');
});

test('native intervention, target group revision, configuration generation and scope epoch cannot drift', () => {
  for (const patch of [{ groupId: '30303030-3030-4030-8030-303030303030' }, { groupRevision: 3 }, { configurationGeneration: 4 }, { scopeEpoch: 5 }, { tokenType: 'category' }]) {
    const value = input(); Object.assign(value.current.target, patch); denied(value, 'native-target-changed');
  }
  const value = input(); value.current.nativeInterventionId = '30303030-3030-4030-8030-303030303030'; denied(value, 'native-target-changed');
  const origin = input(); origin.origin.completionSessionId = 'previous-session'; denied(origin, 'completion-mismatch');
});

test('non-group legacy scopes cannot gain group authority and malformed native IDs are denied', () => {
  const value = input(); value.origin.target = { kind: 'browser-domain', domain: 'adult.example' } as never; denied(value, 'native-target-changed');
  const other = input(); other.origin.nativeInterventionId = 'not-native-authority'; denied(other, 'native-target-changed');
});

test('an Android app-group intent retains the exact installed package as its target', () => {
  const value = input('move'); value.origin.target = { kind: 'android-app-group', packageName: 'com.example.reader', groupId, groupRevision: 2, configurationGeneration: 3, scopeEpoch: 4 };
  value.current.target = { ...value.origin.target };
  const result = deriveResetRewardGrantIntent(value); assert.equal(result.eligible, true);
  if (result.eligible) assert.deepEqual(result.intent.target, value.origin.target);
  value.current.target = { ...value.origin.target, packageName: 'com.example.other' }; denied(value, 'native-target-changed');
});

test('consumed completion or intervention and an active native window prevent duplicates and stacking', () => {
  const completion = input(); completion.current.consumedCompletionSessionIds = ['session-1']; denied(completion, 'already-consumed');
  const intervention = input(); intervention.current.consumedInterventionIds = [interventionId]; denied(intervention, 'already-consumed');
  const active = input(); active.current.hasActiveWindow = true; denied(active, 'active-window');
  const value = input(); const before = JSON.stringify(value); deriveResetRewardGrantIntent(value); assert.equal(JSON.stringify(value), before);
  assert.deepEqual(value.current.consumedCompletionSessionIds, []);
});

test('pure v1 derivation does not repurpose legacy duration settings or rewrite historical records', () => {
  const state = createDefaultRecoveryState();
  assert.equal(state.disciplineSettings.unlockDurationMinutes, 10);
  for (const durationMinutes of [5, 10, 60]) {
    const legacy = hydrateRecoveryState({ ...state, disciplineSettings: { ...state.disciplineSettings, unlockDurationMinutes: durationMinutes } });
    const recorded = recordEarnedUnlock(legacy, input().session!.challenge, { startedAt: '2026-10-08T09:00:00.000Z' });
    const before = JSON.stringify(recorded); assert.equal(recorded.earnedUnlocks[0].durationMinutes, durationMinutes);
    const value = Object.assign(input(), { disciplineSettings: recorded.disciplineSettings, earnedUnlocks: recorded.earnedUnlocks });
    const result = deriveResetRewardGrantIntent(value); assert.equal(result.eligible, true);
    if (result.eligible) assert.equal(result.intent.seconds, 120);
    assert.equal(JSON.stringify(recorded), before);
  }
});
