export const LOCAL_PHOTO_TARGETS = {
  flower: ['flower', 'blossom'], plant: ['plant'], chair: ['chair'], cup: ['cup', 'mug'],
  shoe: ['shoe', 'sneakers'], branch: ['branch'], clock: ['clock'], fruit: ['fruit'],
} as const;
export type LocalPhotoTargetId = keyof typeof LOCAL_PHOTO_TARGETS;
export type ChallengeChoiceGroup = 'breathe' | 'find' | 'move';
export type ChallengeVerificationRule = { version: 1 } & (
  | { kind: 'timer' | 'connection' }
  | { kind: 'motion'; minMotionSamples: number }
  | { kind: 'steps'; minSteps: number }
  | { kind: 'location'; minDistanceMeters: number }
  | { kind: 'photo'; targetId: LocalPhotoTargetId; targetIds?: LocalPhotoTargetId[] }
);

export function normalizeChallengeRule(value: unknown): ChallengeVerificationRule | null {
  if (!value || typeof value !== 'object') return null;
  const rule = value as Record<string, unknown>;
  if (rule.version !== 1) return null;
  if (rule.kind === 'timer' || rule.kind === 'connection') return { version: 1, kind: rule.kind };
  const count = (key: string, max: number) => typeof rule[key] === 'number' && Number.isFinite(rule[key]) && Number.isInteger(rule[key]) && (rule[key] as number) >= 1 && (rule[key] as number) <= max;
  if (rule.kind === 'motion' && count('minMotionSamples', 100)) return { version: 1, kind: 'motion', minMotionSamples: rule.minMotionSamples as number };
  if (rule.kind === 'steps' && count('minSteps', 1000)) return { version: 1, kind: 'steps', minSteps: rule.minSteps as number };
  if (rule.kind === 'location' && count('minDistanceMeters', 1000)) return { version: 1, kind: 'location', minDistanceMeters: rule.minDistanceMeters as number };
  if (rule.kind === 'photo' && typeof rule.targetId === 'string' && Object.hasOwn(LOCAL_PHOTO_TARGETS, rule.targetId)) {
    if (rule.targetIds !== undefined && (!Array.isArray(rule.targetIds) || rule.targetIds.length!==2 || rule.targetIds[0]!==rule.targetId || new Set(rule.targetIds).size!==2 || !rule.targetIds.every(id=>typeof id==='string'&&Object.hasOwn(LOCAL_PHOTO_TARGETS,id)))) return null;
    return { version: 1, kind: 'photo', targetId: rule.targetId as LocalPhotoTargetId, ...(rule.targetIds ? {targetIds:[...rule.targetIds] as LocalPhotoTargetId[]} : {}) };
  }
  return null;
}

/** Explicit authoring defaults. Never infer verification from instructions or a translation. */
export function authoredVerificationRule(category: string): ChallengeVerificationRule {
  if (category === 'connection') return { version: 1, kind: 'connection' };
  if (category === 'physical') return { version: 1, kind: 'motion', minMotionSamples: 6 };
  return { version: 1, kind: 'timer' };
}
