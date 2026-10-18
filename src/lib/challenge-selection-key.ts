import type { RecoveryProfile } from "./recovery-engine";
import type { ChallengeCapabilities } from "./challenge-capability";

/** A local value key for selection effects, never an identifier to log or export.
 * Project named inputs in a fixed order: rebuilt objects and clock/UI bookkeeping
 * cannot restart selection. Remote requests use their own guarded privacy projection.
 */
export function getChallengeSelectionKey(profile: RecoveryProfile, capabilities: ChallengeCapabilities | null): string {
  const intervention = profile.interventionContext;
  const discipline = profile.disciplinePreferences;
  const context = profile.contextSignals;
  const forecast = profile.riskForecast;
  const localProfile = {
    streakDays: profile.streakDays,
    premium: profile.premium,
    attemptsToday: profile.attemptsToday,
    mood: profile.mood,
    hour: profile.hour,
    timezoneOffsetMinutes: profile.timezoneOffsetMinutes ?? null,
    slipsThisWeek: profile.slipsThisWeek ?? 0,
    slipWindow: profile.slipWindow ?? null,
    slipTrigger: profile.slipTrigger ?? null,
    recentFailureCount: profile.recentFailureCount ?? null,
    preferredCategories: profile.preferredCategories ?? [],
    interventionContext: intervention ? {
      source: intervention.source,
      category: intervention.category,
      surface: intervention.surface,
      // The rule family is sufficient context; raw domains/tokens are not selection inputs.
      ruleFamily: intervention.matchedRule?.split(":")[0]?.trim().toLowerCase() || null,
      sessionDurationBucket: intervention.sessionDurationBucket
    } : null,
    disciplinePreferences: discipline ? {
      challengeIntensity: discipline.challengeIntensity,
      outdoorFrequency: discipline.outdoorFrequency,
      exercisePreference: discipline.exercisePreference,
      socialFrequency: discipline.socialFrequency,
      emergencyStrictMode: discipline.emergencyStrictMode,
      sleepModeActive: discipline.sleepModeActive,
      deepFocusModeActive: discipline.deepFocusModeActive,
      weekendModeEnabled: discipline.weekendModeEnabled,
      unlockDurationMinutes: discipline.unlockDurationMinutes,
      dailyLimitMinutes: discipline.dailyLimitMinutes
    } : null,
    contextSignals: context ? {
      energyLevel: context.energyLevel,
      urgeLevel: context.urgeLevel,
      sleepQuality: context.sleepQuality,
      locationPermission: context.locationPermission,
      weatherCondition: context.weatherCondition,
      temperatureC: context.temperatureC
    } : null,
    riskForecast: forecast ? {
      level: forecast.level,
      score: forecast.score,
      confidence: forecast.confidence,
      currentWindow: forecast.currentWindow,
      drivers: forecast.drivers
    } : null
  };
  // Local fallback learns from all history and premium custom challenges, whereas
  // the remote request intentionally includes only ten recent history records.
  const localHistory = (profile.challengeHistory ?? []).map(item => ({
    id: item.id, category: item.category, outcome: item.outcome, completedAt: item.completedAt
  }));
  const customChallenges = profile.premium ? (profile.customChallenges ?? [])
    .filter(challenge => challenge.premium && challenge.id.startsWith("custom-"))
    .map(challenge => ({ id: challenge.id, title: challenge.title, category: challenge.category,
      durationSec: challenge.durationSec, intensity: challenge.intensity, premium: challenge.premium,
      icon: challenge.icon, steps: challenge.steps, why: challenge.why, verification: challenge.verification ?? null })) : [];
  const dayOfWeek = typeof profile.dayOfWeek === "number" && Number.isFinite(profile.dayOfWeek)
    ? Math.max(0, Math.min(6, Math.round(profile.dayOfWeek))) : null;
  const capabilitySnapshot = capabilities ? (["motion", "steps", "location", "photo", "connection"] as const)
    .map(kind => ({ kind, available: capabilities[kind].available,
      permission: capabilities[kind].permission, canAskAgain: capabilities[kind].canAskAgain,
      ...(kind === 'photo' ? { validatedTargets: capabilities.photo.validatedPhotoTargets ?? [] } : {}) })) : null;
  return JSON.stringify({ localProfile, dayOfWeek, localHistory, customChallenges, capabilities: capabilitySnapshot });
}
