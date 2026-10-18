import {
  getEarnedChallengeRequirements, isEarnedAppTimeCapMinutes, isEarnedAppTimeGrantRequest,
  isEarnedAppTimeIsoDate, isEarnedAppTimeOffer, isEarnedAppTimeOfferRequest, isEarnedAppTimeTemplateBinding,
  unavailableEarnedAppTimeGrant, validateEarnedAppTimeBudget,
  type EarnedAppTimeBudget, type EarnedAppTimeCapMinutes, type EarnedAppTimeCategory,
  type EarnedAppTimeEvidenceMethod, type EarnedAppTimeGrantReceipt, type EarnedAppTimeGrantRequest,
  type EarnedAppTimeOffer, type EarnedAppTimeOfferReceipt, type EarnedAppTimeOfferRequest,
} from '../../modules/freed-protection/src/earned-app-time';

export { getEarnedChallengeRequirements, isEarnedAppTimeTemplateBinding };
export const EARNED_APP_TIME_POLICY_V2 = Object.freeze({
  version: 2 as const, policyVersion: 2 as const, defaultCapMinutes: 20 as const,
  seconds: Object.freeze([300, 600, 1200] as const), capMinutes: Object.freeze([0, 5, 10, 20, 30, 60] as const),
  templateVersion: 2 as const, nativePhotoProofAvailable: false as const,
});
export type EarnedAppTimeEligibility = { eligible: true } | { eligible: false; reason: string };

/** Display/ad preflight only. It creates neither native authority nor a budget reservation. */
export function getEarnedAppTimeEligibility(input: {
  nativeV2Available: boolean; offerReceipt: EarnedAppTimeOfferReceipt; category: EarnedAppTimeCategory;
  method: EarnedAppTimeEvidenceMethod; now: string; independentRestrictionCount: number; hasActiveWindow: boolean;
}): EarnedAppTimeEligibility {
  const deny = (reason: string): EarnedAppTimeEligibility => ({ eligible: false, reason });
  if (!input.nativeV2Available) return deny('earned-time-unavailable');
  const receipt = input.offerReceipt, offer = receipt?.offer;
  if (!receipt || receipt.version !== 2 || receipt.policyVersion !== 2 || receipt.supported !== true || receipt.accepted !== true || receipt.reason !== null || !isEarnedAppTimeOffer(offer)) return deny('offer-unavailable');
  const budget = validateEarnedAppTimeBudget(receipt.budget);
  if (!budget || budget.dayKey !== offer.budgetDay || budget.revision !== offer.budgetRevision || budget.clockState !== 'verified') return deny('budget-unverified');
  if (!isEarnedAppTimeIsoDate(input.now) || Date.parse(input.now) >= Date.parse(offer.validUntil) || Date.parse(input.now) >= Date.parse(budget.nextResetAt)) return deny('offer-expired');
  if (input.independentRestrictionCount !== 0) return deny('independent-restriction');
  if (input.hasActiveWindow !== false) return deny('active-window');
  if (budget.remainingSeconds < offer.requestedSeconds) return deny('budget-exhausted');
  if (input.category === 'find' || input.method === 'photo') return deny('photo-proof-unavailable');
  if (!offer.availableMethods.includes(input.method)) return deny('evidence-method-unavailable');
  if (!(input.category === 'breathe' && input.method === 'timer' || input.category === 'move' && (input.method === 'timer' || input.method === 'steps'))) return deny('evidence-method-invalid');
  return { eligible: true };
}

/** Inert executable specification for native parity tests. NEVER persist this as unlock authority,
 * pass it to an unlock API, or infer trusted time from JavaScript Date. Each clockVerified input
 * represents independently established native wall/monotonic/boot continuity in a test scenario.
 * Native durable ledgers, originating-app scope and expiry installation remain authoritative. */
export type EarnedAppTimeReferenceState = {
  readonly ownerScope: string; readonly groupId: string; readonly lastObservedAt: string;
  readonly budget: EarnedAppTimeBudget; readonly previousDays: readonly EarnedAppTimeBudget[];
  readonly grants: readonly { request: EarnedAppTimeGrantRequest; offer: EarnedAppTimeOffer; receipt: EarnedAppTimeGrantReceipt }[];
  readonly activeWindow: EarnedAppTimeGrantReceipt | null;
};
export function createEarnedAppTimeReferenceState(input: {
  ownerScope: string; groupId: string; now: string; dayKey: string; nextResetAt: string; capMinutes?: EarnedAppTimeCapMinutes;
}): EarnedAppTimeReferenceState {
  const cap = input.capMinutes === undefined ? EARNED_APP_TIME_POLICY_V2.defaultCapMinutes : input.capMinutes;
  const budget: EarnedAppTimeBudget = { version: 2, configuredCapMinutes: cap, effectiveCapMinutes: cap, spentSeconds: 0, remainingSeconds: cap * 60, dayKey: input.dayKey, nextResetAt: input.nextResetAt, pendingCapMinutes: null, pendingEffectiveAt: null, revision: 0, clockState: 'verified' };
  if (!input.ownerScope || !input.groupId || !isEarnedAppTimeIsoDate(input.now) || !validateEarnedAppTimeBudget(budget) || Date.parse(input.now) >= Date.parse(input.nextResetAt)) throw new Error('Invalid reference budget scenario');
  return { ownerScope: input.ownerScope, groupId: input.groupId, lastObservedAt: input.now, budget, previousDays: [], grants: [], activeWindow: null };
}
/** Retain the stable owner's ledger through rule edits/removal. Only a verified day advance resets spend. */
export function updateEarnedAppTimeReferenceCap(state: EarnedAppTimeReferenceState, cap: EarnedAppTimeCapMinutes): EarnedAppTimeReferenceState {
  const budget = validateEarnedAppTimeBudget(state.budget);
  if (!budget || !isEarnedAppTimeCapMinutes(cap)) throw new Error('Invalid reference budget cap');
  if (cap === budget.configuredCapMinutes) return state;
  const increasing = cap > budget.effectiveCapMinutes;
  const effectiveCapMinutes = increasing ? budget.effectiveCapMinutes : cap;
  return { ...state, budget: { ...budget, configuredCapMinutes: cap, effectiveCapMinutes,
    remainingSeconds: Math.max(0, effectiveCapMinutes * 60 - budget.spentSeconds),
    pendingCapMinutes: increasing ? cap : null, pendingEffectiveAt: increasing ? budget.nextResetAt : null,
    revision: budget.revision + 1 } };
}
export function advanceEarnedAppTimeReferenceDay(state: EarnedAppTimeReferenceState, input: {
  now: string; clockVerified: boolean; dayKey: string; nextResetAt: string;
}): EarnedAppTimeReferenceState {
  if (!validateEarnedAppTimeBudget(state.budget)) throw new Error('Invalid reference budget state');
  const unverified = () => ({ ...state, budget: { ...state.budget, clockState: 'unverified' as const } });
  if (!input.clockVerified || !isEarnedAppTimeIsoDate(input.now) || Date.parse(input.now) < Date.parse(state.lastObservedAt)) return unverified();
  // A new timezone's local date cannot move the already-stored reset boundary earlier.
  if (Date.parse(input.now) < Date.parse(state.budget.nextResetAt)) return { ...state, lastObservedAt: input.now, budget: { ...state.budget, clockState: 'verified' } };
  if (!isEarnedAppTimeIsoDate(input.nextResetAt) || Date.parse(input.nextResetAt) <= Date.parse(input.now) || input.dayKey <= state.budget.dayKey || state.previousDays.some(day => day.dayKey === input.dayKey)) return unverified();
  const cap = state.budget.pendingCapMinutes ?? state.budget.effectiveCapMinutes;
  const budget: EarnedAppTimeBudget = { ...state.budget, configuredCapMinutes: cap, effectiveCapMinutes: cap, spentSeconds: 0, remainingSeconds: cap * 60, dayKey: input.dayKey, nextResetAt: input.nextResetAt, pendingCapMinutes: null, pendingEffectiveAt: null, revision: state.budget.revision + 1, clockState: 'verified' };
  if (!validateEarnedAppTimeBudget(budget)) return unverified();
  return { ...state, budget, lastObservedAt: input.now, previousDays: [...state.previousDays, { ...state.budget }] };
}

export type EarnedAppTimeReferenceGrantInput = {
  request: EarnedAppTimeGrantRequest; offer: EarnedAppTimeOffer; ownerScope: string;
  currentClaim: EarnedAppTimeOfferRequest; now: string; clockVerified: boolean; nativeV2Available: boolean;
  /** Null for restored history, unverified completion, or a completion that failed durable saving. */
  durableLiveCompletionSessionId: string | null; explicitStart: boolean;
  independentRestrictionCount: number;
  /** Represents the entire durable native policy/expiry/ledger transaction, including rollback. */
  nativeCommitSucceeded: boolean;
};
const requestFingerprint = (request: EarnedAppTimeGrantRequest) => JSON.stringify([
  request.version, request.policyVersion, request.offerId, request.completionSessionId, request.category,
  request.templateId, request.templateVersion, request.evidence.method, request.evidence.activeDurationSec,
  request.evidence.observedSteps, request.evidence.photoProofIds,
]);
const sameOffer = (a: EarnedAppTimeOffer, b: EarnedAppTimeOffer) => Object.keys(a).every(key => key === 'availableMethods'
  ? a.availableMethods.length === b.availableMethods.length && a.availableMethods.every((method, index) => method === b.availableMethods[index])
  : a[key as keyof EarnedAppTimeOffer] === b[key as keyof EarnedAppTimeOffer]);

/** Pure native-ledger reference transition. It does not start a timer, release an app or save history. */
export function grantEarnedAppTimeReference(state: EarnedAppTimeReferenceState, input: EarnedAppTimeReferenceGrantInput): { state: EarnedAppTimeReferenceState; receipt: EarnedAppTimeGrantReceipt } {
  const denied = (reason: string) => ({ state, receipt: unavailableEarnedAppTimeGrant(reason, input.nativeV2Available, validateEarnedAppTimeBudget(state.budget)) });
  if (!input.nativeV2Available) return denied('earned-time-unavailable');
  if (!isEarnedAppTimeGrantRequest(input.request) || !isEarnedAppTimeOffer(input.offer) || !isEarnedAppTimeOfferRequest(input.currentClaim) || !validateEarnedAppTimeBudget(state.budget) || input.request.offerId !== input.offer.offerId) return denied('request-invalid');
  const { request, offer, currentClaim: claim } = input;
  if (input.ownerScope !== state.ownerScope) return denied('owner-fence-changed');
  if (offer.groupId !== state.groupId || claim.groupId !== offer.groupId || claim.groupRevision !== offer.groupRevision || claim.configurationGeneration !== offer.configurationGeneration || claim.scopeEpoch !== offer.scopeEpoch || claim.nativeInterventionId !== offer.nativeInterventionId || claim.kind !== offer.kind || claim.requestedSeconds !== offer.requestedSeconds) return denied('native-authority-changed');
  if (!input.clockVerified || state.budget.clockState !== 'verified' || !isEarnedAppTimeIsoDate(input.now) || Date.parse(input.now) < Date.parse(state.lastObservedAt)) return denied('clock-unverified');
  if (!Number.isSafeInteger(input.independentRestrictionCount) || input.independentRestrictionCount < 0) return denied('restriction-state-invalid');
  if (!input.explicitStart) return denied('explicit-start-required');
  if (input.durableLiveCompletionSessionId !== request.completionSessionId) return denied('live-durable-completion-required');
  if (!isEarnedAppTimeTemplateBinding(request.templateId, request.templateVersion, request.category, request.evidence.method, offer.requestedSeconds)) return denied('template-binding-invalid');
  const previous = state.grants.find(grant => grant.request.completionSessionId === request.completionSessionId || grant.offer.offerId === offer.offerId);
  if (previous) {
    if (requestFingerprint(previous.request) !== requestFingerprint(request) || !sameOffer(previous.offer, offer)) return denied('already-consumed');
    if (Date.parse(previous.receipt.expiresAt!) <= Date.parse(input.now)) return denied('earned-time-expired');
    // Active retries retain the original deadline and budget-at-grant, even across midnight.
    return { state, receipt: { ...previous.receipt, replayed: true, effective: input.independentRestrictionCount === 0, remainingRestrictionCount: input.independentRestrictionCount } };
  }
  if (input.independentRestrictionCount !== 0) return denied('independent-restriction');
  if (state.grants.some(grant => grant.offer.nativeInterventionId === offer.nativeInterventionId)) return denied('intervention-already-consumed');
  if (state.activeWindow && Date.parse(state.activeWindow.expiresAt!) > Date.parse(input.now)) return denied('active-window');
  if (Date.parse(input.now) >= Date.parse(offer.validUntil)) return denied('offer-expired');
  if (Date.parse(input.now) >= Date.parse(state.budget.nextResetAt) || offer.budgetDay !== state.budget.dayKey || offer.budgetRevision !== state.budget.revision) return denied('budget-changed');
  if (request.evidence.method === 'photo') return denied('photo-proof-unavailable');
  if (!offer.availableMethods.includes(request.evidence.method)) return denied('evidence-method-unavailable');
  if (request.evidence.method === 'timer' && request.evidence.activeDurationSec < offer.requiredActiveSeconds || request.evidence.method === 'steps' && request.evidence.observedSteps < offer.requiredSteps) return denied('challenge-incomplete');
  if (state.budget.remainingSeconds < offer.requestedSeconds) return denied('budget-exhausted');
  if (!input.nativeCommitSucceeded) return denied('native-transaction-failed');
  const budget: EarnedAppTimeBudget = { ...state.budget, spentSeconds: state.budget.spentSeconds + offer.requestedSeconds, remainingSeconds: state.budget.remainingSeconds - offer.requestedSeconds, revision: state.budget.revision + 1 };
  const receipt: EarnedAppTimeGrantReceipt = { version: 2, policyVersion: 2, supported: true, accepted: true, reason: null,
    offerId: offer.offerId, completionSessionId: request.completionSessionId, groupId: offer.groupId,
    nativeInterventionId: offer.nativeInterventionId, seconds: offer.requestedSeconds,
    expiresAt: new Date(Date.parse(input.now) + offer.requestedSeconds * 1000).toISOString(), effective: true,
    remainingRestrictionCount: 0, replayed: false, budget: { ...budget } };
  const savedRequest = { ...request, evidence: { ...request.evidence, photoProofIds: [...request.evidence.photoProofIds] } };
  return { state: { ...state, budget, lastObservedAt: input.now, activeWindow: { ...receipt, budget: { ...budget } }, grants: [...state.grants, { request: savedRequest, offer: { ...offer, availableMethods: [...offer.availableMethods] }, receipt: { ...receipt, budget: { ...budget } } }] }, receipt };
}
