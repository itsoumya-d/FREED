import { sanitizeAppGroupInterventionScope, type AppGroupInterventionScope } from './app-group-intervention';
import type { ChallengeSession } from './challenge-session';
import { normalizeChallengeRule, type ChallengeChoiceGroup, type LocalPhotoTargetId } from './challenge-rules';
import { getChallengeVerificationRequirement, isChallengeVerificationSatisfied } from './challenge-verification';

/** Version 1 is frozen. New reward decisions require a new policy version. */
export const RESET_REWARD_POLICY_V1 = Object.freeze({
  version: 1 as const,
  seconds: Object.freeze({ breathe: 120, move: 300, find: 300 }),
  find: Object.freeze({ minConfidence: .65, minHeldOutPrecision: .95, minHeldOutRecall: .85 }),
});

/** An in-memory reference captured by the owner coordinator, never a persisted authority claim. */
export type ResetRewardOwnerFenceReference = { readonly ownerId: string; readonly token: object };
export type ResetRewardTemplateReference = { templateId: string; templateVersion: number };
/** Minimal durable matched-target receipt. No photo, path or classification list belongs here. */
export type ResetRewardPhotoProof = {
  version: 1;
  completionSessionId: string;
  templateId: string;
  templateVersion: number;
  targetId: LocalPhotoTargetId;
  verificationRuleVersion: 1;
  status: 'matched' | 'uncertain' | 'failed' | 'cancelled';
  confidence: number;
  verifiedAtMs: number;
  evaluationRevision: string;
  providerModelRevision: string;
  confidenceThreshold: number;
  thresholdRevision: string;
};
export type ResetRewardFindTargetEvaluation = {
  targetId: LocalPhotoTargetId;
  enabled: boolean;
  evaluationRevision: string;
  providerModelRevision: string;
  verificationRuleVersion: 1;
  confidenceThreshold: number;
  thresholdRevision: string;
  heldOutPrecision: number;
  heldOutRecall: number;
};
type NativeTargetReference = {
  nativeInterventionId: string;
  target: AppGroupInterventionScope;
  ownerFenceReference: ResetRewardOwnerFenceReference;
};
export type ResetRewardPolicyInput = {
  policyVersion: number;
  completionStatus: 'live-verified' | 'restored' | 'unverified' | 'failed' | 'cancelled';
  session: ChallengeSession | null;
  templateReference: ResetRewardTemplateReference;
  durableCompletionSessionId: string | null;
  action: { kind: 'use-app'; completionSessionId: string } | null;
  origin: NativeTargetReference & { completionSessionId: string };
  current: NativeTargetReference & {
    /** Must come from the current native ledger, not recovery history or a UI receipt. */
    consumedCompletionSessionIds: readonly string[];
    consumedInterventionIds: readonly string[];
    hasActiveWindow: boolean;
  };
  photoProof: ResetRewardPhotoProof | null;
  evaluatedFindTargets: readonly ResetRewardFindTargetEvaluation[];
};
/** Inert proposal only. Native target authority, atomic consumption and clock expiry remain native-owned. */
export type ResetRewardGrantIntent = Readonly<{
  kind: 'reset-reward-grant-intent';
  version: 1;
  completionSessionId: string;
  templateId: string;
  templateVersion: number;
  category: ChallengeChoiceGroup;
  policyVersion: 1;
  seconds: 120 | 300;
  nativeInterventionId: string;
  target: Readonly<AppGroupInterventionScope>;
  ownerFenceReference: ResetRewardOwnerFenceReference;
}>;
export type ResetRewardDenialReason =
  | 'unsupported-policy' | 'unsupported-category' | 'completion-not-live-verified' | 'verification-not-satisfied'
  | 'template-reference-invalid' | 'use-app-required' | 'completion-not-saved' | 'completion-mismatch'
  | 'owner-fence-changed' | 'native-target-changed' | 'already-consumed' | 'active-window'
  | 'find-photo-required' | 'find-photo-proof-invalid' | 'find-target-not-evaluated';
export type ResetRewardPolicyDecision = { eligible: false; reason: ResetRewardDenialReason } | { eligible: true; intent: ResetRewardGrantIntent };

export function getResetRewardCapSeconds(category: unknown, policyVersion: unknown): 120 | 300 | null {
  if (policyVersion !== 1 || (category !== 'breathe' && category !== 'move' && category !== 'find')) return null;
  return RESET_REWARD_POLICY_V1.seconds[category];
}
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(value);
const revisionId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const nativeId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const unitNumber = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
const deny = (reason: ResetRewardDenialReason): ResetRewardPolicyDecision => ({ eligible: false, reason });
function sameTarget(a: AppGroupInterventionScope, b: AppGroupInterventionScope): boolean {
  return a.kind === b.kind && a.groupId === b.groupId && a.groupRevision === b.groupRevision &&
    a.configurationGeneration === b.configurationGeneration && a.scopeEpoch === b.scopeEpoch &&
    (a.kind === 'ios-app-group' && b.kind === 'ios-app-group' ? a.tokenType === b.tokenType :
      a.kind === 'android-app-group' && b.kind === 'android-app-group' && a.packageName === b.packageName);
}

/** Pure preflight. Passing this decision does not consume a session, start a timer or confirm a grant.
 * The owner coordinator must retain the original live binding and durable completion provenance;
 * native must revalidate the target/fence and atomically reject replay or stacking at fulfillment.
 */
export function deriveResetRewardGrantIntent(input: ResetRewardPolicyInput): ResetRewardPolicyDecision {
  if (input.policyVersion !== 1) return deny('unsupported-policy');
  const session = input.session;
  if (input.completionStatus !== 'live-verified' || !session || session.phase !== 'completed' || !session.completion ||
    !safeId(session.id) || !Number.isFinite(session.createdAtMs) || !Number.isFinite(session.completion.completedAtMs) ||
    session.completion.completedAtMs < session.createdAtMs || !['helped', 'still-urging', 'unknown'].includes(session.completion.outcome)) return deny('completion-not-live-verified');
  const category = session.challenge.choiceGroup;
  const seconds = getResetRewardCapSeconds(category, input.policyVersion);
  if (seconds === null) return deny('unsupported-category');
  const template = input.templateReference;
  if (!safeId(template.templateId) || template.templateId !== session.challenge.id || !Number.isSafeInteger(template.templateVersion) || template.templateVersion < 1) return deny('template-reference-invalid');
  if (input.action?.kind !== 'use-app') return deny('use-app-required');
  if (input.durableCompletionSessionId !== session.id) return deny('completion-not-saved');
  if (input.action.completionSessionId !== session.id || input.origin.completionSessionId !== session.id) return deny('completion-mismatch');
  const originalFence = input.origin.ownerFenceReference, currentFence = input.current.ownerFenceReference;
  if (!originalFence.token || typeof originalFence.token !== 'object' || originalFence.token !== currentFence.token ||
    !originalFence.ownerId || originalFence.ownerId !== currentFence.ownerId || session.ownerId !== originalFence.ownerId) return deny('owner-fence-changed');
  const target = sanitizeAppGroupInterventionScope(input.origin.target), currentTarget = sanitizeAppGroupInterventionScope(input.current.target);
  if (!nativeId(input.origin.nativeInterventionId) || input.origin.nativeInterventionId !== input.current.nativeInterventionId || !target || !currentTarget || !sameTarget(target, currentTarget)) return deny('native-target-changed');
  if (input.current.consumedCompletionSessionIds.includes(session.id) || input.current.consumedInterventionIds.includes(input.origin.nativeInterventionId)) return deny('already-consumed');
  if (input.current.hasActiveWindow !== false) return deny('active-window');
  const rule = normalizeChallengeRule(session.challenge.verification);
  if (!rule || !Number.isInteger(session.challenge.durationSec) || session.challenge.durationSec < 1 || session.challenge.durationSec > 3600 ||
    !Number.isFinite(session.elapsedMs) || session.elapsedMs < session.challenge.durationSec * 1000 || session.elapsedMs > session.challenge.durationSec * 1000) return deny('verification-not-satisfied');
  if (category === 'find') {
    if (rule.kind !== 'photo') return deny('find-photo-required');
    const proof = input.photoProof;
    if (!proof || proof.version !== 1 || proof.status !== 'matched' || proof.completionSessionId !== session.id ||
      proof.templateId !== template.templateId || proof.templateVersion !== template.templateVersion || proof.targetId !== rule.targetId || proof.verificationRuleVersion !== rule.version ||
      !unitNumber(proof.confidence) || !unitNumber(proof.confidenceThreshold) || proof.confidenceThreshold < RESET_REWARD_POLICY_V1.find.minConfidence ||
      proof.confidence < proof.confidenceThreshold ||
      !Number.isFinite(proof.verifiedAtMs) || proof.verifiedAtMs < session.createdAtMs || proof.verifiedAtMs > session.completion.completedAtMs ||
      !revisionId(proof.evaluationRevision) || !revisionId(proof.providerModelRevision) || !revisionId(proof.thresholdRevision)) return deny('find-photo-proof-invalid');
    const evaluated = input.evaluatedFindTargets.some(value => value.targetId === rule.targetId && value.enabled === true &&
      value.evaluationRevision === proof.evaluationRevision && value.providerModelRevision === proof.providerModelRevision &&
      value.verificationRuleVersion === proof.verificationRuleVersion && value.thresholdRevision === proof.thresholdRevision &&
      value.confidenceThreshold === proof.confidenceThreshold &&
      unitNumber(value.heldOutPrecision) && unitNumber(value.heldOutRecall) &&
      value.heldOutPrecision >= RESET_REWARD_POLICY_V1.find.minHeldOutPrecision && value.heldOutRecall >= RESET_REWARD_POLICY_V1.find.minHeldOutRecall);
    if (!evaluated) return deny('find-target-not-evaluated');
  } else {
    if (category === 'breathe' && rule.kind !== 'timer' || category === 'move' && (rule.kind === 'photo' || rule.kind === 'connection') ||
      !isChallengeVerificationSatisfied(getChallengeVerificationRequirement(session.challenge), { ...session.evidence, elapsedSec: session.elapsedMs / 1000 })) return deny('verification-not-satisfied');
  }
  return { eligible: true, intent: Object.freeze({
    kind: 'reset-reward-grant-intent', version: 1,
    completionSessionId: session.id, templateId: template.templateId, templateVersion: template.templateVersion,
    category: category as ChallengeChoiceGroup, policyVersion: 1, seconds,
    nativeInterventionId: input.origin.nativeInterventionId, target: Object.freeze(target),
    ownerFenceReference: Object.freeze({ ownerId: originalFence.ownerId, token: originalFence.token }),
  }) };
}
