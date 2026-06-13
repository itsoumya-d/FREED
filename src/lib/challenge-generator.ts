import {
  ChallengePreferenceSignal,
  ChallengeContextSignal,
  ChallengeHistorySignal,
  InterventionContextSignal,
  RecoveryChallenge,
  RecoveryProfile,
  UrgeRiskForecastSignal,
  generateChallengeSet
} from "@/lib/recovery-engine";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { coarseRecoveryTriggerLabel } from "@/lib/recovery-signal-privacy";
import { fetchRemoteProviderJson } from "@/lib/remote-provider-timeout";

export type ChallengeInterventionContextRequest = {
  source: InterventionContextSignal["source"];
  category: InterventionContextSignal["category"];
  surface: InterventionContextSignal["surface"];
  ruleFamily: string | null;
  sessionDurationBucket: InterventionContextSignal["sessionDurationBucket"];
};

export type ChallengeGenerationMode = "local" | "remote";

export type ChallengeGenerationRequest = {
  profile: {
    streakDays: number;
    premium: boolean;
    attemptsToday: number;
    mood: RecoveryProfile["mood"];
    hour: number;
    dayPart: "morning" | "afternoon" | "evening" | "late-night";
    isWeekend: boolean | null;
    timezoneOffsetMinutes: number | null;
    slipsThisWeek: number | null;
    slipWindow: string | null;
    slipTrigger: string | null;
    interventionContext: ChallengeInterventionContextRequest | null;
    disciplinePreferences: ChallengePreferenceSignal | null;
    contextSignals: ChallengeContextSignal | null;
    riskForecast: UrgeRiskForecastSignal | null;
    recentFailureCount: number;
    preferredCategories: RecoveryChallenge["category"][];
  };
  recentChallengeHistory: ChallengeHistorySignal[];
  guardrails: string[];
};

export type ChallengeGenerationProvider = (request: ChallengeGenerationRequest) => Promise<RecoveryChallenge[]>;

export type ChallengeGenerationConfig = {
  mode: ChallengeGenerationMode;
  endpointUrl: string | null;
  timeoutMs: number;
};

let remoteChallengeProvider: ChallengeGenerationProvider | null = null;

export function configureChallengeGenerationProvider(provider: ChallengeGenerationProvider | null) {
  remoteChallengeProvider = provider;
}

function readEnv(key: string): string | null {
  const value = process.env[key];
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function getChallengeGenerationConfig(options: { mode?: ChallengeGenerationMode } = {}): ChallengeGenerationConfig {
  const timeoutValue = Number.parseInt(readEnv("EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS") ?? "", 10);
  return {
    mode: options.mode ?? (readEnv("EXPO_PUBLIC_AI_CHALLENGE_MODE") === "remote" ? "remote" : "local"),
    endpointUrl: readEnv("EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT"),
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue >= 1_000 ? Math.min(timeoutValue, 12_000) : 8_000
  };
}

export function getChallengeGenerationReadiness(options: { mode?: ChallengeGenerationMode } = {}) {
  const config = getChallengeGenerationConfig(options);
  const missing: string[] = [];
  if (config.mode === "remote" && !remoteChallengeProvider && !config.endpointUrl) {
    missing.push("remote challenge provider or endpoint");
  }
  if (config.mode === "remote" && config.endpointUrl) {
    missing.push(...getProductionEndpointIssues(config.endpointUrl, "remote challenge endpoint").map((issue) => issue.issue));
  }

  return {
    status: config.mode === "local" ? "local" : missing.length > 0 ? "missing-config" : "ready",
    mode: config.mode,
    missing
  };
}

function profileSignalText(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const cleaned = value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return cleaned || null;
}

function sanitizeGeneratedText(value: string, fallback: string, maxLength: number) {
  const cleaned = value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function sanitizeGeneratedId(value: unknown, index: number) {
  const fallback = `ai-reset-${index + 1}`;
  const raw = typeof value === "string" ? value.trim() : "";
  if (/https?:\/\//i.test(raw) || /\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)\b/i.test(raw)) {
    return fallback;
  }
  const cleaned =
    raw
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  return cleaned || fallback;
}

function sanitizeIconName(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "Activity" : "Activity";
}

function profileSignalCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

function dayPartFromHour(hour: number): ChallengeGenerationRequest["profile"]["dayPart"] {
  if (hour >= 22 || hour <= 5) return "late-night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function sanitizeRuleFamily(value: string | null | undefined): string | null {
  if (!value) return null;
  const family = value.split(":")[0]?.trim().toLowerCase();
  if (!family) return null;
  return family.replace(/[^a-z0-9_-]+/g, "-").slice(0, 48) || null;
}

function sanitizeInterventionContext(value: InterventionContextSignal | null | undefined): ChallengeInterventionContextRequest | null {
  if (!value) return null;
  return {
    source: value.source,
    category: value.category,
    surface: value.surface,
    ruleFamily: sanitizeRuleFamily(value.matchedRule),
    sessionDurationBucket: value.sessionDurationBucket
  };
}

function sanitizeDisciplinePreferences(value: ChallengePreferenceSignal | null | undefined): ChallengePreferenceSignal | null {
  if (!value) return null;
  const challengeIntensity = ["gentle", "balanced", "strong"].includes(value.challengeIntensity)
    ? value.challengeIntensity
    : "balanced";
  const outdoorFrequency = ["low", "balanced", "high"].includes(value.outdoorFrequency)
    ? value.outdoorFrequency
    : "balanced";
  const exercisePreference = ["low", "balanced", "high"].includes(value.exercisePreference)
    ? value.exercisePreference
    : "balanced";
  const socialFrequency = ["off", "low", "balanced", "high"].includes(value.socialFrequency)
    ? value.socialFrequency
    : "balanced";

  return {
    challengeIntensity,
    outdoorFrequency,
    exercisePreference,
    socialFrequency,
    emergencyStrictMode: Boolean(value.emergencyStrictMode),
    sleepModeActive: Boolean(value.sleepModeActive),
    deepFocusModeActive: Boolean(value.deepFocusModeActive),
    weekendModeEnabled: Boolean(value.weekendModeEnabled),
    unlockDurationMinutes: Math.min(60, Math.max(5, Math.round(value.unlockDurationMinutes))),
    dailyLimitMinutes: Math.min(240, Math.max(5, Math.round(value.dailyLimitMinutes)))
  };
}

function sanitizeContextSignals(value: ChallengeContextSignal | null | undefined): ChallengeContextSignal | null {
  if (!value) return null;
  const energyLevel = ["low", "steady", "high"].includes(String(value.energyLevel)) ? value.energyLevel : null;
  const locationPermission = ["granted", "denied", "undetermined", "unavailable", "unknown"].includes(String(value.locationPermission))
    ? value.locationPermission
    : null;
  const weatherCondition = ["clear", "cloudy", "rain", "snow", "storm", "hot", "cold", "unknown"].includes(String(value.weatherCondition))
    ? value.weatherCondition
    : null;
  const urgeLevel = typeof value.urgeLevel === "number" && Number.isFinite(value.urgeLevel)
    ? Math.min(5, Math.max(0, Math.round(value.urgeLevel)))
    : null;
  const sleepQuality = typeof value.sleepQuality === "number" && Number.isFinite(value.sleepQuality)
    ? Math.min(5, Math.max(1, Math.round(value.sleepQuality)))
    : null;
  const temperatureC = typeof value.temperatureC === "number" && Number.isFinite(value.temperatureC)
    ? Math.min(60, Math.max(-60, Math.round(value.temperatureC)))
    : null;
  if (!energyLevel && !locationPermission && !weatherCondition && urgeLevel === null && sleepQuality === null && temperatureC === null) {
    return null;
  }
  return {
    energyLevel,
    urgeLevel,
    sleepQuality,
    locationPermission,
    weatherCondition,
    temperatureC
  };
}

function sanitizeRiskForecast(value: UrgeRiskForecastSignal | null | undefined): UrgeRiskForecastSignal | null {
  if (!value) return null;
  const level = value.level === "high" || value.level === "elevated" || value.level === "low" ? value.level : "low";
  const confidence =
    value.confidence === "high" || value.confidence === "medium" || value.confidence === "low" ? value.confidence : "low";
  const score = typeof value.score === "number" && Number.isFinite(value.score) ? Math.min(100, Math.max(0, Math.round(value.score))) : 0;
  const currentWindow = profileSignalText(value.currentWindow);
  const drivers = Array.isArray(value.drivers)
    ? value.drivers.map((driver) => profileSignalText(driver)).filter((driver): driver is string => Boolean(driver)).slice(0, 4)
    : [];

  return {
    level,
    score,
    confidence,
    currentWindow,
    drivers
  };
}

export function buildChallengeGenerationRequest(profile: RecoveryProfile): ChallengeGenerationRequest {
  const slipsThisWeek = profileSignalCount(profile.slipsThisWeek);
  const includeSlipSignals = (slipsThisWeek ?? 0) > 0;
  const hour = Math.max(0, Math.min(23, Math.round(profile.hour)));
  const dayOfWeek =
    typeof profile.dayOfWeek === "number" && Number.isFinite(profile.dayOfWeek)
      ? Math.max(0, Math.min(6, Math.round(profile.dayOfWeek)))
      : null;
  const timezoneOffsetMinutes =
    typeof profile.timezoneOffsetMinutes === "number" && Number.isFinite(profile.timezoneOffsetMinutes)
      ? Math.max(-840, Math.min(840, Math.round(profile.timezoneOffsetMinutes)))
      : null;

  return {
    profile: {
      streakDays: Math.max(0, Math.round(profile.streakDays)),
      premium: profile.premium,
      attemptsToday: Math.max(0, Math.round(profile.attemptsToday)),
      mood: profile.mood,
      hour,
      dayPart: dayPartFromHour(hour),
      isWeekend: dayOfWeek === null ? null : dayOfWeek === 0 || dayOfWeek === 6,
      timezoneOffsetMinutes,
      slipsThisWeek,
      slipWindow: includeSlipSignals ? profileSignalText(profile.slipWindow) : null,
      slipTrigger: includeSlipSignals ? coarseRecoveryTriggerLabel(profile.slipTrigger) : null,
      interventionContext: sanitizeInterventionContext(profile.interventionContext),
      disciplinePreferences: sanitizeDisciplinePreferences(profile.disciplinePreferences),
      contextSignals: sanitizeContextSignals(profile.contextSignals),
      riskForecast: sanitizeRiskForecast(profile.riskForecast),
      recentFailureCount: profileSignalCount(profile.recentFailureCount) ?? 0,
      preferredCategories: profile.preferredCategories ?? []
    },
    recentChallengeHistory: (profile.challengeHistory ?? [])
      .filter((item) => Number.isFinite(Date.parse(item.completedAt)))
      .slice(-10)
      .map((item) => ({
        id: item.id,
        category: item.category,
        outcome: item.outcome,
        completedAt: item.completedAt
      })),
    guardrails: [
      "Return three short recovery challenges.",
      "Avoid shame, punishment, sexualized language, or moral judgment.",
      "Prefer immediate physical, outdoor, mindfulness, productivity, social, emergency, anti-relapse, late-night, or quick-reset actions.",
      "Use slip summaries only as aggregate recovery signals, never as raw narrative detail.",
      "Use intervention context only as coarse surface/category data, never as browsing history.",
      "Use session duration only as a coarse bucket, never as screen content or raw usage logs.",
      "Treat recent failed resets as aggregate count signals and avoid repeating what just failed.",
      "Use context signals only when present; never infer weather or location, and never request precise coordinates.",
      "Use the urge risk forecast only as aggregate local context; never ask for raw notes, browsing details, or location.",
      "Respect discipline settings for challenge intensity, outdoor frequency, exercise, social actions, sleep mode, and unlock duration.",
      "Do not request unsafe exercise, medical intervention, or anything that requires driving.",
      "Respect premium=false by not returning premium-only challenges."
    ]
  };
}

function normalizeChallenge(candidate: RecoveryChallenge, profile: RecoveryProfile, index: number): RecoveryChallenge | null {
  const categories: RecoveryChallenge["category"][] = ["physical", "breathing", "reflection", "connection", "reset"];
  const intensities: RecoveryChallenge["intensity"][] = ["calm", "medium", "strong"];

  if (!candidate || typeof candidate.title !== "string" || !candidate.title.trim()) return null;
  if (!categories.includes(candidate.category)) return null;
  if (!intensities.includes(candidate.intensity)) return null;
  if (!profile.premium && candidate.premium) return null;

  const steps = Array.isArray(candidate.steps)
    ? candidate.steps.filter((step) => typeof step === "string" && step.trim()).slice(0, 4)
    : [];
  if (steps.length < 2) return null;

  return {
    id: sanitizeGeneratedId(candidate.id, index),
    title: sanitizeGeneratedText(candidate.title, "Quick recovery reset", 64),
    category: candidate.category,
    durationSec: Math.min(900, Math.max(30, Math.round(candidate.durationSec || 120))),
    intensity: candidate.intensity,
    premium: Boolean(candidate.premium),
    icon: sanitizeIconName(candidate.icon),
    steps: steps.map((step) => sanitizeGeneratedText(step, "Take one calm step.", 120)),
    why: sanitizeGeneratedText(candidate.why || "", "This reset interrupts the loop and gives your mind time to settle.", 160)
  };
}

function normalizeChallengeSet(candidates: RecoveryChallenge[], profile: RecoveryProfile): RecoveryChallenge[] {
  const seen = new Set<string>();
  return candidates
    .map((challenge, index) => normalizeChallenge(challenge, profile, index))
    .filter((challenge): challenge is RecoveryChallenge => Boolean(challenge))
    .filter((challenge) => {
      if (seen.has(challenge.id)) return false;
      seen.add(challenge.id);
      return true;
    })
    .slice(0, 3);
}

async function fetchRemoteChallenges(request: ChallengeGenerationRequest, config: ChallengeGenerationConfig): Promise<RecoveryChallenge[]> {
  if (!config.endpointUrl) {
    throw new Error("Remote challenge endpoint is not configured.");
  }
  const endpointIssues = getProductionEndpointIssues(config.endpointUrl, "remote challenge endpoint");
  if (endpointIssues.length > 0) {
    throw new Error(endpointIssues.map((issue) => issue.issue).join("; "));
  }

  const payload = (await fetchRemoteProviderJson(
    config.endpointUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    },
    config.timeoutMs,
    "Remote challenge generator request"
  )) as { challenges?: unknown };
  return Array.isArray(payload.challenges) ? (payload.challenges as RecoveryChallenge[]) : [];
}

export async function generateAdaptiveChallengeSet(
  profile: RecoveryProfile,
  options: { mode?: ChallengeGenerationMode } = {}
): Promise<RecoveryChallenge[]> {
  const fallback = generateChallengeSet(profile);
  const config = getChallengeGenerationConfig(options);
  if (config.mode === "local") return fallback;

  try {
    const request = buildChallengeGenerationRequest(profile);
    const generated = remoteChallengeProvider
      ? await remoteChallengeProvider(request)
      : await fetchRemoteChallenges(request, config);
    const normalized = normalizeChallengeSet(generated, profile);
    const localCustom = fallback.filter((challenge) => challenge.id.startsWith("custom-"));
    const merged = [
      ...localCustom,
      ...normalized.filter((challenge) => !localCustom.some((custom) => custom.id === challenge.id))
    ].slice(0, 3);
    return merged.length === 3 ? merged : fallback;
  } catch {
    return fallback;
  }
}
