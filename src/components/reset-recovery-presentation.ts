import type { TFunction } from 'i18next';
import { translateSource } from '@/i18n/runtime';
import type { RecoveryChallenge } from '@/lib/recovery-engine';
import type { ChallengeChoiceGroup } from '@/lib/challenge-rules';
import { getEarnedResetNativeRequirement } from '@/lib/earned-reset-templates';
import { getChallengeVerificationRequirement } from '@/lib/challenge-verification';

/** Presentation only: the challenge and its evidence rules remain unchanged. */
export function resetRecoveryPresentation(challenge: RecoveryChallenge, group: ChallengeChoiceGroup, t: TFunction) {
  const verification = getChallengeVerificationRequirement(challenge);
  const rule = challenge.verification;
  const title = challenge.id.startsWith('custom-') ? challenge.title : translateSource(challenge.title);
  if (verification.kind === 'timer') return {
    title,
    requirement: t(`resetRecoveryUi.${group}Timer`, { seconds: challenge.durationSec }),
    detail: null,
  };
  if (rule?.kind === 'steps' && verification.kind === 'steps') return {
    title,
    requirement: t('resetChoices.nativeSteps', { steps: rule.minSteps }),
    detail: t('resetRecoveryUi.stepsEvidence'),
  };
  if (rule?.kind === 'photo' && verification.kind === 'photo') {
    const targets = getEarnedResetNativeRequirement(challenge)?.targetIds ?? rule.targetIds ?? [rule.targetId];
    return {
      title,
      requirement: t('resetChoices.nativePhotos', { count: targets.length }),
      detail: t('resetRecoveryUi.photoEvidence', { targets: targets.map(id => t(`earnedProof.targets.${id}`)).join(', ') }),
    };
  }
  return { title, requirement: translateSource(verification.label), detail: translateSource(verification.detail) };
}
