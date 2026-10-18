import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isEarnedAppTimeOfferRequest, isEarnedAppTimeGrantRequest, isAppGroupEarnedTimeUpdateRequest,
  validateEarnedAppTimeBudget, validateEarnedAppTimeOfferReceipt, validateEarnedAppTimeGrantReceipt,
  unavailableEarnedAppTimeOffer, unavailableEarnedAppTimeGrant, isEarnedAppTimeTemplateBinding,
  type EarnedAppTimeOffer, type EarnedAppTimeGrantRequest,
} from '../modules/freed-protection/src/earned-app-time';
import {
  getEarnedChallengeRequirements, getEarnedAppTimeEligibility, createEarnedAppTimeReferenceState,
  updateEarnedAppTimeReferenceCap, advanceEarnedAppTimeReferenceDay, grantEarnedAppTimeReference,
} from '../src/lib/earned-app-time';
import { getResetRewardCapSeconds } from '../src/lib/reset-reward-policy';

const claim = { version: 2 as const, policyVersion: 2 as const, nativeInterventionId: 'a2b4053a-a9e0-4209-9bba-6a6e0fb270ba', groupId: 'focus', groupRevision: 2, configurationGeneration: 1, scopeEpoch: 2, kind: 'ios-app-group' as const, tokenType: 'application' as const, requestedSeconds: 300 as const };
const budget = { version: 2 as const, configuredCapMinutes: 20 as const, effectiveCapMinutes: 20 as const, spentSeconds: 0, remainingSeconds: 1200, dayKey: '2026-10-08', nextResetAt: '2026-10-09T00:00:00Z', pendingCapMinutes: null, pendingEffectiveAt: null, revision: 0, clockState: 'verified' as const };
const offer: EarnedAppTimeOffer = { offerId: 'b2b4053a-a9e0-4209-9bba-6a6e0fb270ba', nativeInterventionId: claim.nativeInterventionId, groupId: 'focus', groupRevision: 2, configurationGeneration: 1, scopeEpoch: 2, kind: 'ios-app-group', requestedSeconds: 300, budgetDay: '2026-10-08', budgetRevision: 0, validUntil: '2026-10-08T10:20:00Z', availableMethods: ['timer'], requiredActiveSeconds: 60, requiredSteps: 30, requiredDistinctPhotoTargets: 1 };
const request: EarnedAppTimeGrantRequest = { version: 2, policyVersion: 2, offerId: offer.offerId, completionSessionId: 'session-1', category: 'breathe', templateId: 'momentum-breathe-soft:earned-v2:300', templateVersion: 2, evidence: { method: 'timer', activeDurationSec: 60, observedSteps: 0, photoProofIds: [] } };
const offerReceipt = { version: 2, policyVersion: 2, supported: true, accepted: true, reason: null, offer, budget };
const grantReceipt = { version: 2, policyVersion: 2, supported: true, accepted: true, reason: null, offerId: offer.offerId, completionSessionId: 'session-1', groupId: 'focus', nativeInterventionId: offer.nativeInterventionId, seconds: 300, expiresAt: '2026-10-08T10:05:00Z', effective: true, remainingRestrictionCount: 0, replayed: false, budget: { ...budget, spentSeconds: 300, remainingSeconds: 900, revision: 1 } };
const state = () => createEarnedAppTimeReferenceState({ ownerScope: '["owner",1]', groupId: 'focus', now: '2026-10-08T10:00:00Z', dayKey: '2026-10-08', nextResetAt: '2026-10-09T00:00:00Z' });
const grantInput = () => ({ request, offer, ownerScope: '["owner",1]', currentClaim: claim, now: '2026-10-08T10:00:00Z', clockVerified: true, nativeV2Available: true, durableLiveCompletionSessionId: 'session-1', explicitStart: true, independentRestrictionCount: 0, nativeCommitSucceeded: true });

test('chosen 5/10 minutes require 60/120 active seconds, 30/60 steps and 1/2 distinct photos', () => {
  assert.deepEqual(getEarnedChallengeRequirements(300), { requiredActiveSeconds: 60, requiredSteps: 30, requiredDistinctPhotoTargets: 1 });
  assert.deepEqual(getEarnedChallengeRequirements(600), { requiredActiveSeconds: 120, requiredSteps: 60, requiredDistinctPhotoTargets: 2 });
  for (const value of [120, 0, -300, 600.1, '300', NaN, null]) assert.equal(getEarnedChallengeRequirements(value), null);
  assert.equal(getResetRewardCapSeconds('breathe', 1), 120);
  assert.equal(getResetRewardCapSeconds('move', 1), 300);
  assert.equal(getResetRewardCapSeconds('breathe', 2), null);
});
test('request validators reject unknown fields, forged scope, unsupported durations and invalid evidence pairs', () => {
  assert.equal(isEarnedAppTimeOfferRequest(claim), true);
  assert.equal(isEarnedAppTimeOfferRequest({ ...claim, kind: 'android-app-group', tokenType: undefined, packageName: 'com.example.app' }), false);
  const { tokenType: _, ...android } = claim;
  assert.equal(isEarnedAppTimeOfferRequest({ ...android, kind: 'android-app-group', packageName: 'com.example.app' }), true);
  for (const invalid of [null, [], { ...claim, requestedSeconds: 120 }, { ...claim, ownerDigest: 'forged' }, { ...claim, applicationToken: 'forged' }, { ...claim, groupRevision: 0 }, { ...claim, scopeEpoch: -1 }, { ...claim, nativeInterventionId: 'url' }]) assert.equal(isEarnedAppTimeOfferRequest(invalid), false);
  assert.equal(isEarnedAppTimeGrantRequest(request), true);
  for (const invalid of [null, { ...request, seconds: 600 }, { ...request, expiresAt: '2026-10-08T12:00:00Z' }, { ...request, templateVersion: 0 }, { ...request, category: 'journal' }, { ...request, evidence: { ...request.evidence, method: 'steps' } }, { ...request, evidence: { ...request.evidence, activeDurationSec: 59.5 } }, { ...request, evidence: { ...request.evidence, backgroundSeconds: 60 } }]) assert.equal(isEarnedAppTimeGrantRequest(invalid), false);
});
test('authored template binding is checked against category, evidence method, version and selected duration', () => {
  for (const seconds of [300, 600] as const) {
    assert.equal(isEarnedAppTimeTemplateBinding(`momentum-breathe-soft:earned-v2:${seconds}`, 2, 'breathe', 'timer', seconds), true);
    assert.equal(isEarnedAppTimeTemplateBinding(`momentum-move-steps:earned-v2:${seconds}`, 2, 'move', 'steps', seconds), true);
    assert.equal(isEarnedAppTimeTemplateBinding(`momentum-move-seated:earned-v2:${seconds}`, 2, 'move', 'timer', seconds), true);
    const photoTemplate=seconds===300?'momentum-find-flower:earned-v2:300':'momentum-find-chair-flower:earned-v2:600';
    assert.equal(isEarnedAppTimeTemplateBinding(photoTemplate, 2, 'find', 'photo', seconds), true);
  }
  for (const args of [['momentum-breathe-soft:earned-v2:300', 1, 'breathe', 'timer', 300], ['momentum-breathe-soft:earned-v2:300', 2, 'breathe', 'timer', 600], ['momentum-move-steps:earned-v2:300', 2, 'move', 'timer', 300], ['momentum-find-five:earned-v2:300', 2, 'find', 'photo', 300], ['translated-title:earned-v2:300', 2, 'breathe', 'timer', 300]] as const) assert.equal(isEarnedAppTimeTemplateBinding(...args), false);
});
test('budget receipts reject malformed accounting rather than defaulting to 20 minutes', () => {
  assert.deepEqual(validateEarnedAppTimeBudget(budget), budget);
  for (const invalid of [undefined, null, { ...budget, configuredCapMinutes: 15 }, { ...budget, spentSeconds: -1 }, { ...budget, remainingSeconds: 1201 }, { ...budget, revision: 0.5 }, { ...budget, nextResetAt: 'tomorrow' }, { ...budget, pendingCapMinutes: 30 }, { ...budget, unexpected: true }]) assert.equal(validateEarnedAppTimeBudget(invalid), null);
  assert.ok(validateEarnedAppTimeBudget({ ...budget, configuredCapMinutes: 5, effectiveCapMinutes: 5, spentSeconds: 600, remainingSeconds: 0 }));
});
test('offer and grant receipts enforce the original request and complete budget contract', () => {
  assert.deepEqual(validateEarnedAppTimeOfferReceipt(offerReceipt, claim), offerReceipt);
  assert.deepEqual(validateEarnedAppTimeGrantReceipt(grantReceipt, request, offer), grantReceipt);
  for (const bad of [{ ...offerReceipt, offer: { ...offer, budgetDay: '2026-10-09' } }, { ...offerReceipt, offer: { ...offer, requiredSteps: 60 } }, { ...offerReceipt, offer: { ...offer, groupRevision: 3 } }, { ...offerReceipt, offer: { ...offer, requestedSeconds: 600 } }, { ...offerReceipt, budget: null }, { ...offerReceipt, extra: 1 }]) assert.equal(validateEarnedAppTimeOfferReceipt(bad, claim), null);
  for (const bad of [{ ...grantReceipt, seconds: 600 }, { ...grantReceipt, nativeInterventionId: 'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba' }, { ...grantReceipt, groupId: 'other' }, { ...grantReceipt, remainingRestrictionCount: 1 }, { ...grantReceipt, effective: false }, { ...grantReceipt, budget: null }, { ...grantReceipt, expiresAt: '2026-02-31T10:00:00Z' }]) assert.equal(validateEarnedAppTimeGrantReceipt(bad, request, offer), null);
  assert.equal(validateEarnedAppTimeGrantReceipt(grantReceipt, request, null as any), null);
  assert.deepEqual(validateEarnedAppTimeOfferReceipt(unavailableEarnedAppTimeOffer('unavailable'), claim), unavailableEarnedAppTimeOffer('unavailable'));
  assert.deepEqual(validateEarnedAppTimeGrantReceipt(unavailableEarnedAppTimeGrant('unavailable'), request, offer), unavailableEarnedAppTimeGrant('unavailable'));
});
test('grant receipt cannot extend beyond the latest possible native grant deadline', () => {
  assert.equal(validateEarnedAppTimeGrantReceipt({ ...grantReceipt, expiresAt: '2026-10-08T10:25:01Z' }, request, offer), null);
});
test('a committed grant may report a newly active independent restriction without losing its spend receipt', () => {
  const restricted = { ...grantReceipt, effective: false, remainingRestrictionCount: 2, replayed: true };
  assert.deepEqual(validateEarnedAppTimeGrantReceipt(restricted, request, offer), restricted);
  assert.equal(validateEarnedAppTimeGrantReceipt({ ...restricted, effective: true }, request, offer), null);
  assert.equal(validateEarnedAppTimeGrantReceipt({ ...restricted, remainingRestrictionCount: -1 }, request, offer), null);
});
test('v2 group update accepts only the defined caps and preserves strict rule validation', () => {
  const update = { version: 2, expectedStoreRevision: 1, id: 'focus', expectedRevision: 2, name: 'Focus', enabled: true, rule: { kind: 'daily-limit', limitMinutes: 30 }, packages: [], extraTimeCapMinutes: 20 };
  for (const cap of [0, 5, 10, 20, 30, 60]) assert.equal(isAppGroupEarnedTimeUpdateRequest({ ...update, extraTimeCapMinutes: cap }, 'ios'), true);
  for (const bad of [{ ...update, version: 1 }, { ...update, extraTimeCapMinutes: 15 }, { ...update, seconds: 600 }, { ...update, rule: { kind: 'daily-limit', limitMinutes: 241 } }, { ...update, packages: ['com.example.app'] }]) assert.equal(isAppGroupEarnedTimeUpdateRequest(bad, 'ios'), false);
});
test('pre-ad eligibility rejects unavailable, exhausted, expired and overlapping offers and all unproved photos', () => {
  const input = { nativeV2Available: true, offerReceipt, category: 'breathe' as const, method: 'timer' as const, now: '2026-10-08T10:00:00Z', independentRestrictionCount: 0, hasActiveWindow: false };
  assert.equal(getEarnedAppTimeEligibility(input).eligible, true);
  for (const changed of [{ nativeV2Available: false }, { offerReceipt: unavailableEarnedAppTimeOffer('exhausted', true) }, { now: '2026-10-08T10:20:00Z' }, { independentRestrictionCount: 1 }, { hasActiveWindow: true }, { category: 'find', method: 'photo', supportedPhotoTargetCount: 2, nativePhotoProofAvailable: true }]) assert.equal(getEarnedAppTimeEligibility({ ...input, ...changed } as any).eligible, false);
});
test('reference grant spends a full window only after durable completion and deliberate start', () => {
  const initial = state();
  assert.equal(initial.budget.remainingSeconds, 1200);
  for (const changed of [{ explicitStart: false }, { durableLiveCompletionSessionId: null }, { durableLiveCompletionSessionId: 'restored-session' }, { nativeCommitSucceeded: false }, { nativeV2Available: false }]) {
    const denied = grantEarnedAppTimeReference(initial, { ...grantInput(), ...changed });
    assert.equal(denied.receipt.accepted, false);
    assert.deepEqual(denied.state, initial);
  }
  const result = grantEarnedAppTimeReference(initial, grantInput());
  assert.equal(result.receipt.accepted, true);
  assert.equal(result.receipt.expiresAt, '2026-10-08T10:05:00.000Z');
  assert.equal(result.state.budget.spentSeconds, 300);
  assert.equal(result.state.budget.remainingSeconds, 900);
  assert.equal(initial.budget.spentSeconds, 0, 'pure model must not mutate its input');
});
test('exact active retry returns the original deadline and spends once; expired or changed-evidence retries cannot grant', () => {
  const first = grantEarnedAppTimeReference(state(), grantInput());
  const retry = grantEarnedAppTimeReference(first.state, { ...grantInput(), now: '2026-10-08T10:01:00Z' });
  assert.equal(retry.receipt.accepted, true);
  assert.equal(retry.receipt.replayed, true);
  assert.equal(retry.receipt.expiresAt, '2026-10-08T10:05:00.000Z');
  assert.equal(retry.state.budget.spentSeconds, 300);
  assert.equal(retry.state.grants.length, 1);
  const expired = grantEarnedAppTimeReference(first.state, { ...grantInput(), now: '2026-10-08T10:05:00Z' });
  assert.equal(expired.receipt.accepted, false);
  assert.equal(expired.receipt.reason, 'earned-time-expired');
  assert.equal(expired.state.grants.length, 1);
  assert.equal(expired.state.grants[0].receipt.expiresAt, '2026-10-08T10:05:00.000Z');
  assert.equal(expired.state.budget.spentSeconds, 300);
  const changed = grantEarnedAppTimeReference(first.state, { ...grantInput(), request: { ...request, evidence: { ...request.evidence, activeDurationSec: 120 } } });
  assert.equal(changed.receipt.accepted, false);
  assert.equal(changed.state.budget.spentSeconds, 300);
});
test('same completion under a different offer and simultaneous app windows are denied', () => {
  const first = grantEarnedAppTimeReference(state(), grantInput());
  const secondOffer = { ...offer, offerId: 'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba', budgetRevision: 1 };
  const duplicate = grantEarnedAppTimeReference(first.state, { ...grantInput(), offer: secondOffer, request: { ...request, offerId: secondOffer.offerId }, now: '2026-10-08T10:06:00Z' });
  assert.equal(duplicate.receipt.accepted, false);
  const stacked = grantEarnedAppTimeReference(first.state, { ...grantInput(), offer: secondOffer, request: { ...request, offerId: secondOffer.offerId, completionSessionId: 'session-2' }, durableLiveCompletionSessionId: 'session-2' });
  assert.equal(stacked.receipt.accepted, false);
  assert.equal(stacked.state.budget.spentSeconds, 300);
});
test('owner, claim, configuration, rule and scope fences reject stale grants including retries', () => {
  const first = grantEarnedAppTimeReference(state(), grantInput());
  for (const changed of [{ ownerScope: '["different-owner",1]' }, { currentClaim: { ...claim, configurationGeneration: 2 } }, { currentClaim: { ...claim, scopeEpoch: 3 } }, { currentClaim: { ...claim, groupRevision: 3 } }, { currentClaim: { ...claim, nativeInterventionId: 'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba' } }]) {
    for (const saved of [state(), first.state]) assert.equal(grantEarnedAppTimeReference(saved, { ...grantInput(), ...changed }).receipt.accepted, false);
  }
});
test('known overlap prevents a fresh spend; a later overlap reports an ineffective replay without extending or spending', () => {
  const denied = grantEarnedAppTimeReference(state(), { ...grantInput(), independentRestrictionCount: 1 });
  assert.equal(denied.receipt.accepted, false);
  assert.equal(denied.state.budget.spentSeconds, 0);
  const first = grantEarnedAppTimeReference(state(), grantInput());
  const replay = grantEarnedAppTimeReference(first.state, { ...grantInput(), now: '2026-10-08T10:01:00Z', independentRestrictionCount: 1 });
  assert.equal(replay.receipt.accepted, true);
  assert.equal(replay.receipt.effective, false);
  assert.equal(replay.receipt.remainingRestrictionCount, 1);
  assert.equal(replay.receipt.replayed, true);
  assert.equal(replay.receipt.expiresAt, '2026-10-08T10:05:00.000Z');
  assert.equal(replay.state.budget.spentSeconds, 300);
  assert.equal(replay.state.grants.length, 1);
});
test('10-minute timer/steps requirements and cap exhaustion are checked before spending', () => {
  const longOffer = { ...offer, requestedSeconds: 600 as const, requiredActiveSeconds: 120 as const, requiredSteps: 60 as const, requiredDistinctPhotoTargets: 2 as const };
  const longRequest = { ...request, templateId: 'momentum-breathe-soft:earned-v2:600', evidence: { ...request.evidence, activeDurationSec: 120 } };
  const input = { ...grantInput(), offer: longOffer, request: longRequest, currentClaim: { ...claim, requestedSeconds: 600 as const } };
  assert.equal(grantEarnedAppTimeReference(state(), input).state.budget.spentSeconds, 600);
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, request: { ...longRequest, evidence: { ...longRequest.evidence, activeDurationSec: 119 } } }).receipt.accepted, false);
  const steps = { ...longRequest, category: 'move' as const, templateId: 'momentum-move-steps:earned-v2:600', evidence: { method: 'steps' as const, activeDurationSec: 0, observedSteps: 60, photoProofIds: [] } };
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, request: steps }).receipt.reason, 'request-invalid');
  const nativeProofShape={...steps,evidence:{...steps.evidence,stepProofId:'d2b4053a-a9e0-4209-9bba-6a6e0fb270ba'}};
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, request: nativeProofShape }).receipt.reason, 'evidence-method-unavailable');
  // Budget projection for a native-verified proof; the reference model does not issue sensor authority.
  const stepsOffer = { ...longOffer, availableMethods: ['timer', 'steps'] as ('timer' | 'steps')[] };
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, offer: stepsOffer, request: steps }).receipt.accepted, false);
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, offer: stepsOffer, request: nativeProofShape }).receipt.accepted, true);
  assert.equal(grantEarnedAppTimeReference(state(), { ...input, offer: stepsOffer, request: { ...nativeProofShape, evidence: { ...nativeProofShape.evidence, observedSteps: 59 } } }).receipt.accepted, false);
  const limited = updateEarnedAppTimeReferenceCap(state(), 5);
  assert.equal(grantEarnedAppTimeReference(limited, { ...input, offer: { ...longOffer, budgetRevision: limited.budget.revision } }).receipt.accepted, false);
});
test('native-advertised methods are required, unique and are not inferred from client steps', () => {
  for (const availableMethods of [undefined, [], ['steps', 'steps'], ['movement'], 'timer']) {
    assert.equal(validateEarnedAppTimeOfferReceipt({ ...offerReceipt, offer: { ...offer, availableMethods } }, claim), null);
  }
  const stepsRequest = { ...request, category: 'move' as const, templateId: 'momentum-move-steps:earned-v2:300', evidence: { method: 'steps' as const, activeDurationSec: 0, observedSteps: 10000, photoProofIds: [] } };
  assert.equal(validateEarnedAppTimeGrantReceipt(grantReceipt, stepsRequest, offer), null);
  const input = { nativeV2Available: true, offerReceipt, category: 'move' as const, method: 'steps' as const, now: '2026-10-08T10:00:00Z', independentRestrictionCount: 0, hasActiveWindow: false };
  assert.equal(getEarnedAppTimeEligibility(input).eligible, false);
});
test('two separate 10-minute starts exhaust the default daily cap and a third grant spends nothing', () => {
  const firstOffer = { ...offer, requestedSeconds: 600 as const, requiredActiveSeconds: 120 as const, requiredSteps: 60 as const, requiredDistinctPhotoTargets: 2 as const };
  const firstRequest = { ...request, templateId: 'momentum-breathe-soft:earned-v2:600', evidence: { ...request.evidence, activeDurationSec: 120 } };
  const first = grantEarnedAppTimeReference(state(), { ...grantInput(), offer: firstOffer, request: firstRequest, currentClaim: { ...claim, requestedSeconds: 600 } });
  assert.equal(first.receipt.accepted, true);
  const secondOffer = { ...firstOffer, offerId: 'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba', nativeInterventionId: 'd2b4053a-a9e0-4209-9bba-6a6e0fb270ba', budgetRevision: 1 };
  const second = grantEarnedAppTimeReference(first.state, { ...grantInput(), now: '2026-10-08T10:10:00Z', offer: secondOffer, request: { ...firstRequest, offerId: secondOffer.offerId, completionSessionId: 'session-2' }, durableLiveCompletionSessionId: 'session-2', currentClaim: { ...claim, requestedSeconds: 600, nativeInterventionId: secondOffer.nativeInterventionId } });
  assert.equal(second.receipt.accepted, true);
  assert.equal(second.state.budget.spentSeconds, 1200);
  assert.equal(second.state.budget.remainingSeconds, 0);
  const thirdOffer = { ...offer, offerId: 'e2b4053a-a9e0-4209-9bba-6a6e0fb270ba', nativeInterventionId: 'f2b4053a-a9e0-4209-9bba-6a6e0fb270ba', budgetRevision: 2, validUntil: '2026-10-08T10:40:00Z' };
  const third = grantEarnedAppTimeReference(second.state, { ...grantInput(), now: '2026-10-08T10:20:00Z', offer: thirdOffer, request: { ...request, offerId: thirdOffer.offerId, completionSessionId: 'session-3' }, durableLiveCompletionSessionId: 'session-3', currentClaim: { ...claim, nativeInterventionId: thirdOffer.nativeInterventionId } });
  assert.equal(third.receipt.reason, 'budget-exhausted');
  assert.deepEqual(third.state, second.state);
});
test('photo target names/counts and opaque proof IDs never stand in for unavailable native proof verification', () => {
  const photo = { ...request, category: 'find' as const, templateId: 'momentum-find-flower:earned-v2:300', evidence: { method: 'photo' as const, activeDurationSec: 0, observedSteps: 0, photoProofIds: ['flower', 'plant'] } };
  assert.equal(grantEarnedAppTimeReference(state(), { ...grantInput(), request: photo }).receipt.reason, 'request-invalid');
  const nativeProofShape={...photo,evidence:{...photo.evidence,photoProofIds:['d2b4053a-a9e0-4209-9bba-6a6e0fb270ba']}};
  assert.equal(grantEarnedAppTimeReference(state(), { ...grantInput(), request: nativeProofShape }).receipt.reason, 'photo-proof-unavailable');
});
test('caps 0/5/10/20/30/60 can be configured; increases wait for next day and decreases preserve active expiry', () => {
  for (const cap of [0, 5, 10, 20, 30, 60] as const) {
    const updated = updateEarnedAppTimeReferenceCap(state(), cap);
    assert.equal(updated.budget.configuredCapMinutes, cap);
    assert.equal(updated.budget.effectiveCapMinutes, cap > 20 ? 20 : cap);
    assert.equal(updated.budget.pendingCapMinutes, cap > 20 ? cap : null);
  }
  assert.throws(() => updateEarnedAppTimeReferenceCap(state(), 15 as any));
  const active = grantEarnedAppTimeReference(state(), grantInput()).state;
  const reduced = updateEarnedAppTimeReferenceCap(active, 0);
  assert.equal(reduced.budget.spentSeconds, 300);
  assert.equal(reduced.budget.remainingSeconds, 0);
  assert.equal(reduced.activeWindow?.expiresAt, '2026-10-08T10:05:00.000Z');
  const pending = updateEarnedAppTimeReferenceCap(reduced, 20);
  assert.equal(pending.budget.effectiveCapMinutes, 0);
  assert.equal(pending.budget.pendingEffectiveAt, '2026-10-09T00:00:00Z');
});
test('verified native day boundary applies pending cap once and retains spent-day tombstones', () => {
  const active = grantEarnedAppTimeReference(state(), grantInput()).state;
  const pending = updateEarnedAppTimeReferenceCap(active, 30);
  const next = advanceEarnedAppTimeReferenceDay(pending, { now: '2026-10-09T00:00:00Z', clockVerified: true, dayKey: '2026-10-09', nextResetAt: '2026-10-10T00:00:00Z' });
  assert.equal(next.budget.effectiveCapMinutes, 30);
  assert.equal(next.budget.remainingSeconds, 1800);
  assert.equal(next.budget.spentSeconds, 0);
  assert.equal(next.previousDays[0].dayKey, '2026-10-08');
  assert.equal(next.previousDays[0].spentSeconds, 300);
  assert.equal(next.grants.length, 1);
  const rolledBack = advanceEarnedAppTimeReferenceDay(next, { now: '2026-10-08T10:00:00Z', clockVerified: true, dayKey: '2026-10-08', nextResetAt: '2026-10-09T00:00:00Z' });
  assert.equal(rolledBack.budget.dayKey, '2026-10-09');
  assert.equal(rolledBack.budget.clockState, 'unverified');
});
test('a replay across midnight returns immutable budget-at-grant while current-day budget advances independently', () => {
  const midnightInput = { ...grantInput(), now: '2026-10-08T23:59:00Z', offer: { ...offer, validUntil: '2026-10-09T00:05:00Z' } };
  const first = grantEarnedAppTimeReference(state(), midnightInput);
  assert.equal(first.receipt.expiresAt, '2026-10-09T00:04:00.000Z');
  const next = advanceEarnedAppTimeReferenceDay(first.state, { now: '2026-10-09T00:00:00Z', clockVerified: true, dayKey: '2026-10-09', nextResetAt: '2026-10-10T00:00:00Z' });
  const retry = grantEarnedAppTimeReference(next, { ...midnightInput, now: '2026-10-09T00:01:00Z' });
  assert.equal(retry.receipt.accepted, true);
  assert.equal(retry.receipt.replayed, true);
  assert.equal(retry.receipt.expiresAt, '2026-10-09T00:04:00.000Z');
  assert.equal(retry.receipt.budget?.dayKey, '2026-10-08');
  assert.equal(retry.receipt.budget?.spentSeconds, 300);
  assert.equal(retry.state.budget.dayKey, '2026-10-09');
  assert.equal(retry.state.budget.spentSeconds, 0);
  assert.equal(retry.state.budget.remainingSeconds, 1200);
  assert.ok(validateEarnedAppTimeGrantReceipt(retry.receipt, request, midnightInput.offer));
});
test('timezone edits, clock jumps and unverified continuity cannot clear spent budget', () => {
  const active = grantEarnedAppTimeReference(state(), grantInput()).state;
  const early = advanceEarnedAppTimeReferenceDay(active, { now: '2026-10-08T14:00:00Z', clockVerified: true, dayKey: '2026-10-09', nextResetAt: '2026-10-09T14:00:00Z' });
  assert.equal(early.budget.dayKey, '2026-10-08');
  assert.equal(early.budget.nextResetAt, '2026-10-09T00:00:00Z');
  assert.equal(early.budget.spentSeconds, 300);
  const unverified = advanceEarnedAppTimeReferenceDay(active, { now: '2026-11-08T00:00:00Z', clockVerified: false, dayKey: '2026-11-08', nextResetAt: '2026-11-09T00:00:00Z' });
  assert.equal(unverified.budget.clockState, 'unverified');
  assert.equal(unverified.budget.spentSeconds, 300);
  assert.equal(unverified.budget.dayKey, '2026-10-08');
  assert.equal(grantEarnedAppTimeReference(active, { ...grantInput(), clockVerified: false }).receipt.accepted, false);
});
