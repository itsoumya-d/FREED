import type { ResetRewardGrantIntent, ResetRewardPhotoProof, ResetRewardPolicyInput } from '../src/lib/reset-reward-policy';

declare const intent: ResetRewardGrantIntent;
declare const proof: ResetRewardPhotoProof;
const policyVersion: 1 = intent.policyVersion;
const requestKind: 'reset-reward-grant-intent' = intent.kind;
void policyVersion;
void requestKind;

// @ts-expect-error Constructed proposals cannot exceed the v1 reward caps.
const excessiveDuration: ResetRewardGrantIntent = { ...intent, seconds: 7200 };
void excessiveDuration;

// The proposal cannot be widened after category derivation or treated as native readback.
// @ts-expect-error Intent duration is immutable.
intent.seconds = 7200;
// @ts-expect-error Target revision is immutable.
intent.target.groupRevision = 999;
// @ts-expect-error This proposal carries no native grant acknowledgment.
const accepted: boolean = intent.nativeUnlockGrantAccepted;
// @ts-expect-error Native expiry must be computed at explicit native fulfillment.
const expiry: string = intent.expiresAt;
void accepted;
void expiry;

// Minimal durable Find proof cannot omit template version or evaluated model binding.
const { templateVersion: _version, ...unversionedProof } = proof;
// @ts-expect-error Template version is required.
const incompleteProof: ResetRewardPhotoProof = unversionedProof;
const { providerModelRevision: _model, ...unboundProof } = proof;
// @ts-expect-error Provider/model revision is required.
const missingModel: ResetRewardPhotoProof = unboundProof;
void incompleteProof;
void missingModel;

// Legacy preferences have no role in the new derivation contract.
// @ts-expect-error New policy input does not use legacy minute settings.
type LegacyMinutes = ResetRewardPolicyInput['unlockDurationMinutes'];
// @ts-expect-error Reward category is choiceGroup, not legacy recovery category.
const legacyCategory: ResetRewardGrantIntent['category'] = 'physical';
void legacyCategory;
