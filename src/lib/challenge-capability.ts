import { CHALLENGE_TEMPLATES } from "../data/challenge-templates";
import { challengeLibrary, type RecoveryChallenge } from "./recovery-engine";
import { getChallengeVerificationRequirement, type ChallengeVerificationKind } from "./challenge-verification";
import { MOMENTUM_RESET_TEMPLATES } from '@/data/momentum-resets';
import { normalizeChallengeRule, type LocalPhotoTargetId } from './challenge-rules';
import type { RecoveryProfile } from './recovery-engine';

export type ChallengeCapability = {
  available: boolean;
  permission: "granted" | "undetermined" | "denied" | "unavailable" | "unknown";
  canAskAgain: boolean;
  /** Supplied only by a provider/model-bound held-out evaluation receipt. Hardware is not accuracy evidence. */
  validatedPhotoTargets?: readonly LocalPhotoTargetId[];
};
export type ChallengeCapabilities = Record<Exclude<ChallengeVerificationKind, "timer" | "unavailable">, ChallengeCapability>;
export type ChallengeCapabilityProbes = { [Kind in keyof ChallengeCapabilities]: () => Promise<ChallengeCapability> };
const unavailable = (): ChallengeCapability => ({ available: false, permission: "unavailable", canAskAgain: false });

/** Read-only probes: availability + current permission. Never request permissions while listing challenges.
 * Photo availability must prove both a camera and the on-device classifier. Unknown providers fail closed.
 */
export async function readChallengeCapabilities(probes: ChallengeCapabilityProbes): Promise<ChallengeCapabilities> {
  const kinds = ["motion", "steps", "location", "photo", "connection"] as const;
  const values = await Promise.all(kinds.map(async kind => {
    try {
      const value = await probes[kind]();
      if (!value || !["granted", "undetermined", "denied", "unavailable", "unknown"].includes(value.permission)) return unavailable();
      return { available: value.available === true, permission: value.permission, canAskAgain: value.canAskAgain === true,
        ...(kind === 'photo' && Array.isArray(value.validatedPhotoTargets) ? { validatedPhotoTargets: value.validatedPhotoTargets.filter(id => normalizeChallengeRule({version:1,kind:'photo',targetId:id}) !== null) } : {}) };
    } catch { return unavailable(); }
  }));
  return Object.fromEntries(kinds.map((kind, index) => [kind, values[index]])) as ChallengeCapabilities;
}

export function getChallengeCapability(challenge: RecoveryChallenge, capabilities: ChallengeCapabilities) {
  const requirement = getChallengeVerificationRequirement(challenge);
  if (requirement.kind === 'unavailable') return { eligible: false, requirement, reason: 'This saved reset needs a supported verification rule. Choose a new reset.' };
  if (requirement.kind === "timer") return { eligible: true, requirement, reason: null };
  const rule = normalizeChallengeRule(challenge.verification);
  if (rule?.kind === 'photo' && !capabilities.photo.validatedPhotoTargets?.includes(rule.targetId)) return {
    eligible: false, requirement, reason: 'This photo target is still being validated. Choose a different reset.'
  };
  const capability = capabilities[requirement.kind];
  const eligible = capability?.available === true && (capability.permission === "granted" ||
    (capability.permission === "undetermined" && capability.canAskAgain));
  const names = { motion: "Motion sensor", steps: "Step counter", location: "Foreground location", photo: "Camera and photo classifier", connection: "Connection action" };
  const reason = eligible ? null : `${names[requirement.kind]} ${!capability?.available ? "is unavailable" : capability.permission === "denied" ? "permission is denied" : "permission is unavailable"}. Choose another reset.`;
  return { eligible, requirement, reason };
}

/** Three predictable categories, varied local activities. No remote provider or permission request. */
export function selectResetChoices(profile: RecoveryProfile, capabilities: ChallengeCapabilities, options: {excludeId?:string} = {}) {
  const recent = (profile.challengeHistory ?? []).slice(0, 12).map(item => item.id);
  const quiet = profile.hour >= 22 || profile.hour < 6 || profile.disciplinePreferences?.outdoorFrequency === 'low';
  return (['breathe','find','move'] as const).map(group => {
    const eligible = MOMENTUM_RESET_TEMPLATES.filter(item => item.choiceGroup === group && item.id !== options.excludeId &&
      (!quiet || item.environment !== 'outdoors') && getChallengeCapability(item, capabilities).eligible);
    const sorted = eligible.map((challenge,index) => ({challenge, index, score: recent.includes(challenge.id) ? 100-recent.indexOf(challenge.id) : 0}))
      .sort((a,b) => a.score-b.score || a.index-b.index);
    return { group, challenge: sorted[0].challenge };
  });
}

/** Choose only challenges their real evidence capability can support, then offer reviewed local alternatives.
 * Requirements and exercise instructions are never rewritten to bypass a missing capability.
 */
export function selectCapableChallengeSet(
  candidates: readonly RecoveryChallenge[], capabilities: ChallengeCapabilities,
  options: { premium: boolean; limit?: number }
): RecoveryChallenge[] {
  const limit = Math.max(1, Math.min(3, Math.floor(options.limit ?? 3)));
  const alternatives = [...challengeLibrary.filter(item => getChallengeVerificationRequirement(item).kind === "timer"),
    ...CHALLENGE_TEMPLATES.filter(item => getChallengeVerificationRequirement(item).kind === "timer")];
  const selected: RecoveryChallenge[] = [];
  const seen = new Set<string>();
  for (const item of [...candidates, ...alternatives]) {
    if (seen.has(item.id) || (!options.premium && item.premium) || !getChallengeCapability(item, capabilities).eligible) continue;
    seen.add(item.id); selected.push({ id: item.id, title: item.title, category: item.category, durationSec: item.durationSec,
      intensity: item.intensity, premium: item.premium, icon: item.icon, steps: [...item.steps], why: item.why,
      ...(item.verification ? { verification: { ...item.verification } } : {}),
      ...(item.choiceGroup ? { choiceGroup: item.choiceGroup } : {}),
      ...(item.environment ? { environment: item.environment } : {}),
      ...(item.seatedAlternative !== undefined ? { seatedAlternative: item.seatedAlternative } : {}) });
    if (selected.length === limit) break;
  }
  return selected;
}
