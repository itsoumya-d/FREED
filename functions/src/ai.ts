export const AI_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
export const AI_MODEL = "gpt-5.6-terra";
export const AI_TIMEOUT_MS = 11_000;
export const AI_RESPONSE_MAX_BYTES = 256 * 1024;
export const AI_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export const CRISIS_REPLY =
  "I'm really sorry you're facing this. Please contact your local emergency or crisis service now, and tell a trusted person who can stay with you. Move away from anything you could use to hurt yourself and stay with another person if you can.";

export type AiRoute = "clara" | "challenges" | "retention";
export type AiFeatureGate = "enabled" | "disabled" | "unavailable";
export type AiAuthorization = "allowed" | "duplicate" | "rate-limited" | "account-deleting";
export type AiFallbackReason =
  | "provider-disabled"
  | "configuration-unavailable"
  | "crisis-support"
  | "duplicate-request"
  | "provider-unavailable"
  | "invalid-provider-response";

export type RecoveryWindowSignal = "late-night" | "morning" | "afternoon" | "evening";
export type CurrentRiskWindowSignal = RecoveryWindowSignal | "sleep-mode" | "focus-protection";
export type RecoveryTriggerSignal =
  | "stress"
  | "night-low-sleep"
  | "scrolling"
  | "boredom-isolation"
  | "connection-stress"
  | "urge"
  | "logged";
export type RecoveryRiskDriverSignal =
  | "high-urge"
  | "moderate-urge"
  | "low-sleep"
  | "mood-support"
  | "no-check-in"
  | "protected-risk-today"
  | "weekly-risk-cluster"
  | "recent-risk"
  | "recent-slip"
  | "matches-slip-window"
  | "matches-risk-window"
  | "sleep-mode"
  | "risk-rising"
  | "reset-needed"
  | "no-elevated-risk";

export type ClaraInput = {
  clientEventId: string;
  input: string;
  context: {
    streakDays: number | null;
    attemptsToday: number | null;
    premium: boolean | null;
    slipsThisWeek: number | null;
    slipWindow: RecoveryWindowSignal | null;
    slipTrigger: RecoveryTriggerSignal | null;
  };
};

export type ChallengeCategory = "physical" | "breathing" | "reflection" | "connection" | "reset";
export type ChallengeIntensity = "calm" | "medium" | "strong";
export type RecoveryChallenge = {
  id: string;
  title: string;
  category: ChallengeCategory;
  durationSec: number;
  intensity: ChallengeIntensity;
  premium: false;
  icon: string;
  steps: string[];
  why: string;
};

export type ChallengeInput = {
  clientEventId: string;
  profile: {
    streakDays: number;
    premium: boolean;
    attemptsToday: number;
    mood: "low" | "steady" | "energized" | "stressed";
    hour: number;
    dayPart: "morning" | "afternoon" | "evening" | "late-night";
    isWeekend: boolean | null;
    timezoneOffsetMinutes: number | null;
    slipsThisWeek: number | null;
    slipWindow: RecoveryWindowSignal | null;
    slipTrigger: RecoveryTriggerSignal | null;
    interventionContext: {
      source: "browser" | "search" | "manual-check" | "panic-button" | "app";
      category: "adult" | "adult-search-intent" | "known-safe" | "unknown" | "self-reported";
      surface: "adult-site" | "adult-search" | "search" | "social" | "video" | "forum" | "self-urge" | "unknown";
      ruleFamily: string | null;
      sessionDurationBucket: "under-1m" | "1-5m" | "5-15m" | "15-30m" | "30m-plus" | null;
    } | null;
    disciplinePreferences: {
      challengeIntensity: "gentle" | "balanced" | "strong";
      outdoorFrequency: "low" | "balanced" | "high";
      exercisePreference: "low" | "balanced" | "high";
      socialFrequency: "off" | "low" | "balanced" | "high";
      emergencyStrictMode: boolean;
      sleepModeActive: boolean;
      deepFocusModeActive: boolean;
      weekendModeEnabled: boolean;
      unlockDurationMinutes: number;
      dailyLimitMinutes: number;
    } | null;
    contextSignals: {
      energyLevel: "low" | "steady" | "high" | null;
      urgeLevel: number | null;
      sleepQuality: number | null;
      locationPermission: "granted" | "denied" | "undetermined" | "unavailable" | "unknown" | null;
      weatherCondition: "clear" | "cloudy" | "rain" | "snow" | "storm" | "hot" | "cold" | "unknown" | null;
      temperatureC: number | null;
    } | null;
    riskForecast: {
      level: "low" | "elevated" | "high";
      score: number;
      confidence: "low" | "medium" | "high";
      currentWindow: CurrentRiskWindowSignal | null;
      drivers: RecoveryRiskDriverSignal[];
    } | null;
    recentFailureCount: number;
    preferredCategories: ChallengeCategory[];
  };
  recentChallengeHistory: Array<{
    id: string;
    category: ChallengeCategory;
    outcome: "helped" | "still-urging";
    completedAt: string;
  }>;
};

export type RetentionInput = {
  clientEventId: string;
  profile: {
    premium: boolean;
    streakDays: number;
    bestStreakDays: number;
    attemptsThisWeek: number;
    slipsThisWeek: number;
    checkInsThisWeek: number;
    completedChallengesThisWeek: number;
    averageUrge: number;
    averageSleep: number;
    steadyDays: number;
    riskWindow: RecoveryWindowSignal | null;
    slipWindow: RecoveryWindowSignal | null;
    slipTrigger: RecoveryTriggerSignal | null;
    bestIntervention: ChallengeCategory | null;
    momentum: "needs-more-signal" | "risk-rising" | "risk-easing" | "stable";
    urgeRiskForecast: {
      level: "low" | "elevated" | "high";
      score: number;
      confidence: "low" | "medium" | "high";
      currentWindow: CurrentRiskWindowSignal | null;
      drivers: RecoveryRiskDriverSignal[];
    };
    enabledReminderKeys: Array<"morning" | "evening" | "guard">;
    smartGuardTime: string;
    smartGuardSource: "risk-window" | "slip-window" | "default";
    localDateKey: string;
    timezoneOffsetMinutes: number;
  };
};

export type ClaraResult =
  | { text: string; provider: "remote"; status: "ok" }
  | { text: string; provider: "fallback"; status: "fallback"; reason: AiFallbackReason };
export type ChallengeResult =
  | { challenges: RecoveryChallenge[]; provider: "remote"; status: "ok" }
  | { challenges: RecoveryChallenge[]; provider: "fallback"; status: "fallback"; reason: AiFallbackReason };
export type RetentionResult =
  | {
      headline: string;
      nextBestAction: string;
      checkInPrompt: string;
      suggestedGuardTime: string | null;
      focusTags: string[];
      provider: "remote";
      status: "ok";
    }
  | {
      headline: string;
      nextBestAction: string;
      checkInPrompt: string;
      suggestedGuardTime: string | null;
      focusTags: string[];
      provider: "fallback";
      status: "fallback";
      reason: AiFallbackReason;
    };

export type AiAuditEvent = {
  uid: string;
  eventType: AiRoute;
  outcome: "remote" | "fallback";
  provider: "openai" | "local";
  model: typeof AI_MODEL;
  crisisFallback: boolean;
  inputCharacterCount: number;
  outputCharacterCount: number | undefined;
  generatedItemCount: number | undefined;
  createdAt: number;
  expiresAt: number;
};

export type AiServiceDependencies = {
  fetch: (input: string | URL, init: RequestInit) => Promise<Response>;
  now: () => number;
  getFeatureGate: (route: AiRoute) => Promise<AiFeatureGate>;
  getApiKey: () => string;
  authorize: (input: { uid: string; route: AiRoute; clientEventId: string; perMinute: number }) => Promise<AiAuthorization>;
  persistEvent: (event: AiAuditEvent) => Promise<void>;
  /** Test-only dependency override; production always uses the 11-second bound. */
  timeoutMs?: number;
};

export class AiInputError extends Error {}
export class AiAccessError extends Error {
  constructor(readonly reason: "rate-limited" | "account-deleting") {
    super(reason);
  }
}

const CLARA_KEYS = ["clientEventId", "input", "context"] as const;
const CLARA_CONTEXT_KEYS = ["streakDays", "attemptsToday", "premium", "slipsThisWeek", "slipWindow", "slipTrigger"] as const;
const CHALLENGE_KEYS = ["clientEventId", "profile", "recentChallengeHistory"] as const;
const CHALLENGE_PROFILE_KEYS = [
  "streakDays", "premium", "attemptsToday", "mood", "hour", "dayPart", "isWeekend", "timezoneOffsetMinutes",
  "slipsThisWeek", "slipWindow", "slipTrigger", "interventionContext", "disciplinePreferences", "contextSignals",
  "riskForecast", "recentFailureCount", "preferredCategories"
] as const;
const INTERVENTION_KEYS = ["source", "category", "surface", "ruleFamily", "sessionDurationBucket"] as const;
const DISCIPLINE_KEYS = [
  "challengeIntensity", "outdoorFrequency", "exercisePreference", "socialFrequency", "emergencyStrictMode", "sleepModeActive",
  "deepFocusModeActive", "weekendModeEnabled", "unlockDurationMinutes", "dailyLimitMinutes"
] as const;
const CONTEXT_SIGNAL_KEYS = ["energyLevel", "urgeLevel", "sleepQuality", "locationPermission", "weatherCondition", "temperatureC"] as const;
const RISK_KEYS = ["level", "score", "confidence", "currentWindow", "drivers"] as const;
const HISTORY_KEYS = ["id", "category", "outcome", "completedAt"] as const;
const RETENTION_KEYS = ["clientEventId", "profile"] as const;
const RETENTION_PROFILE_KEYS = [
  "premium", "streakDays", "bestStreakDays", "attemptsThisWeek", "slipsThisWeek", "checkInsThisWeek",
  "completedChallengesThisWeek", "averageUrge", "averageSleep", "steadyDays", "riskWindow", "slipWindow", "slipTrigger",
  "bestIntervention", "momentum", "urgeRiskForecast", "enabledReminderKeys", "smartGuardTime", "smartGuardSource",
  "localDateKey", "timezoneOffsetMinutes"
] as const;

const CATEGORIES = ["physical", "breathing", "reflection", "connection", "reset"] as const;
const RECOVERY_WINDOWS = ["late-night", "morning", "afternoon", "evening"] as const;
const CURRENT_RISK_WINDOWS = [...RECOVERY_WINDOWS, "sleep-mode", "focus-protection"] as const;
const RECOVERY_TRIGGERS = ["stress", "night-low-sleep", "scrolling", "boredom-isolation", "connection-stress", "urge", "logged"] as const;
const RECOVERY_RISK_DRIVERS = [
  "high-urge", "moderate-urge", "low-sleep", "mood-support", "no-check-in", "protected-risk-today",
  "weekly-risk-cluster", "recent-risk", "recent-slip", "matches-slip-window", "matches-risk-window",
  "sleep-mode", "risk-rising", "reset-needed", "no-elevated-risk"
] as const;
const RECOVERY_MOMENTUM = ["needs-more-signal", "risk-rising", "risk-easing", "stable"] as const;
const CLARA_REPLY_IDS = ["breathing-pause", "change-room", "urge-wave", "stress-reset", "low-sleep-reset", "trusted-support"] as const;
const CLARA_REPLY_CATALOG: Record<(typeof CLARA_REPLY_IDS)[number], string> = {
  "breathing-pause": "Put the phone down and take three slow breaths. A brief pause gives you room to choose the next action.",
  "change-room": "Put the phone down and move to another room for two minutes. Changing place interrupts the automatic loop.",
  "urge-wave": "Keep the phone out of reach and let the urge rise and fall for two minutes. You only need to protect the next choice.",
  "stress-reset": "Unclench your hands, exhale slowly, and choose one small task for the next five minutes. A simple action can lower the pressure.",
  "low-sleep-reset": "Lower stimulation and move the phone away from where you rest. Tired moments need a gentler boundary, not more pressure.",
  "trusted-support": "Move the phone out of reach and contact a trusted person for a brief check-in. Support can make the next safe action easier."
};
const APPROVED_CHALLENGE_IDS = [
  "breathing-reset", "change-room", "next-safe-step", "cool-water-pause", "phone-boundary", "trusted-check-in"
] as const;
const APPROVED_CHALLENGE_CATALOG: Record<(typeof APPROVED_CHALLENGE_IDS)[number], RecoveryChallenge> = {
  "breathing-reset": {
    id: "breathing-reset", title: "Take three slow breaths", category: "breathing", durationSec: 60, intensity: "calm",
    premium: false, icon: "Waves", steps: ["Put the phone down.", "Breathe in slowly, then exhale longer."],
    why: "Slower breathing creates a short pause before the next action."
  },
  "change-room": {
    id: "change-room", title: "Change your environment", category: "reset", durationSec: 120, intensity: "medium",
    premium: false, icon: "Footprints", steps: ["Stand up and leave the current room.", "Keep the phone out of reach for two minutes."],
    why: "Changing place interrupts the cue and gives the urge time to settle."
  },
  "next-safe-step": {
    id: "next-safe-step", title: "Name the next safe step", category: "reflection", durationSec: 90, intensity: "calm",
    premium: false, icon: "Notebook", steps: ["Name what you need for the next ten minutes.", "Choose one small action that supports it."],
    why: "A specific next step makes the automatic loop less powerful."
  },
  "cool-water-pause": {
    id: "cool-water-pause", title: "Take a cool water pause", category: "reset", durationSec: 90, intensity: "calm",
    premium: false, icon: "GlassWater", steps: ["Put the phone down.", "Drink a glass of cool water slowly."],
    why: "A simple physical pause creates distance from the automatic tap."
  },
  "phone-boundary": {
    id: "phone-boundary", title: "Move the phone out of reach", category: "reset", durationSec: 120, intensity: "medium",
    premium: false, icon: "Shield", steps: ["Place the phone across the room.", "Stay where you are for two quiet minutes."],
    why: "Physical distance adds enough friction to make the next choice deliberate."
  },
  "trusted-check-in": {
    id: "trusted-check-in", title: "Make a trusted check-in", category: "connection", durationSec: 180, intensity: "calm",
    premium: false, icon: "Users", steps: ["Choose one trusted person.", "Send a brief message asking for a check-in."],
    why: "A small connection can make the next safe step easier."
  }
};
const RETENTION_HEADLINE_IDS = ["protect-progress", "start-next-hour", "use-pattern-kindly", "add-friction", "protect-sleep"] as const;
const RETENTION_HEADLINE_CATALOG: Record<(typeof RETENTION_HEADLINE_IDS)[number], string> = {
  "protect-progress": "Protect today's progress and the next clean day.",
  "start-next-hour": "Start with the next clean hour.",
  "use-pattern-kindly": "Use the pattern without judging yourself.",
  "add-friction": "Add friction before the pattern builds.",
  "protect-sleep": "Protect sleep and lower stimulation tonight."
};
const RETENTION_ACTION_IDS = ["guard-and-boundary", "honest-check-in", "body-reset", "bedroom-boundary", "repeat-safe-reset"] as const;
const RETENTION_ACTION_CATALOG: Record<(typeof RETENTION_ACTION_IDS)[number], string> = {
  "guard-and-boundary": "Set the guard reminder, then keep the phone outside the highest-risk room tonight.",
  "honest-check-in": "Complete one honest check-in, then choose one small action for the next hour.",
  "body-reset": "Start one short breathing or environment reset now, then keep the phone out of reach.",
  "bedroom-boundary": "Put the phone outside the bedroom before the evening wind-down begins.",
  "repeat-safe-reset": "Repeat one previously helpful reset before the next risk window."
};
const RETENTION_CHECK_IN_IDS = ["make-hour-easier", "smallest-action", "first-safer-move", "barrier-before-tap"] as const;
const RETENTION_CHECK_IN_CATALOG: Record<(typeof RETENTION_CHECK_IN_IDS)[number], string> = {
  "make-hour-easier": "What is the smallest change that would make the next hour easier?",
  "smallest-action": "What is one small action you can complete now?",
  "first-safer-move": "What is the first safer move when the pattern appears?",
  "barrier-before-tap": "What small barrier would make the next risky tap less automatic?"
};
const RETENTION_FOCUS_TAG_IDS = ["guard-time", "phone-boundary", "reset", "check-in", "sleep", "early-friction", "body-reset", "support"] as const;
const RETENTION_FOCUS_TAG_CATALOG: Record<(typeof RETENTION_FOCUS_TAG_IDS)[number], string> = {
  "guard-time": "guard time",
  "phone-boundary": "phone boundary",
  reset: "reset",
  "check-in": "check-in",
  sleep: "sleep",
  "early-friction": "early friction",
  "body-reset": "body reset",
  support: "support"
};
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;
const CLIENT_EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RAW_LINK = /https?:\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/i;
const CRISIS_PATTERN = /\b(?:kill myself|end my life|ending it all|suicide|suicidal|hurt myself|harm myself|self[- ]harm|going to die|want to die|immediate danger|(?:do not|don't) want to live|no reason to live|(?:cannot|can't) stay safe)\b/i;

export function parseClaraRequest(value: unknown): ClaraInput {
  const input = exactRecord(value, CLARA_KEYS);
  const context = exactRecord(input.context, CLARA_CONTEXT_KEYS);
  const parsed: ClaraInput = {
    clientEventId: eventId(input.clientEventId),
    input: userText(input.input, 1_200),
    context: {
      streakDays: nullableInteger(context.streakDays, 0, 10_000),
      attemptsToday: nullableInteger(context.attemptsToday, 0, 100),
      premium: nullableBoolean(context.premium),
      slipsThisWeek: nullableInteger(context.slipsThisWeek, 0, 100),
      slipWindow: nullableEnum(context.slipWindow, RECOVERY_WINDOWS),
      slipTrigger: nullableEnum(context.slipTrigger, RECOVERY_TRIGGERS)
    }
  };
  boundedPayload(parsed, 8 * 1024);
  return parsed;
}

export function parseChallengeRequest(value: unknown): ChallengeInput {
  const input = exactRecord(value, CHALLENGE_KEYS);
  const profile = exactRecord(input.profile, CHALLENGE_PROFILE_KEYS);
  const intervention = parseNullableIntervention(profile.interventionContext);
  const discipline = parseNullableDiscipline(profile.disciplinePreferences);
  const contextSignals = parseNullableContextSignals(profile.contextSignals);
  const risk = parseNullableRisk(profile.riskForecast);
  const categories = enumArray(profile.preferredCategories, CATEGORIES, 5);
  if (!Array.isArray(input.recentChallengeHistory) || input.recentChallengeHistory.length > 10) invalid();
  const recentChallengeHistory = input.recentChallengeHistory.map((entry) => {
    const history = exactRecord(entry, HISTORY_KEYS);
    const completedAt = canonicalIso(history.completedAt);
    return {
      id: identifier(history.id),
      category: enumValue(history.category, CATEGORIES),
      outcome: enumValue(history.outcome, ["helped", "still-urging"] as const),
      completedAt
    };
  });
  const parsed: ChallengeInput = {
    clientEventId: eventId(input.clientEventId),
    profile: {
      streakDays: integer(profile.streakDays, 0, 10_000),
      premium: booleanValue(profile.premium),
      attemptsToday: integer(profile.attemptsToday, 0, 100),
      mood: enumValue(profile.mood, ["low", "steady", "energized", "stressed"] as const),
      hour: integer(profile.hour, 0, 23),
      dayPart: enumValue(profile.dayPart, ["morning", "afternoon", "evening", "late-night"] as const),
      isWeekend: nullableBoolean(profile.isWeekend),
      timezoneOffsetMinutes: nullableInteger(profile.timezoneOffsetMinutes, -840, 840),
      slipsThisWeek: nullableInteger(profile.slipsThisWeek, 0, 100),
      slipWindow: nullableEnum(profile.slipWindow, RECOVERY_WINDOWS),
      slipTrigger: nullableEnum(profile.slipTrigger, RECOVERY_TRIGGERS),
      interventionContext: intervention,
      disciplinePreferences: discipline,
      contextSignals,
      riskForecast: risk,
      recentFailureCount: integer(profile.recentFailureCount, 0, 10),
      preferredCategories: categories
    },
    recentChallengeHistory
  };
  boundedPayload(parsed, 24 * 1024);
  return parsed;
}

export function parseRetentionRequest(value: unknown): RetentionInput {
  const input = exactRecord(value, RETENTION_KEYS);
  const profile = exactRecord(input.profile, RETENTION_PROFILE_KEYS);
  const risk = parseRequiredRisk(profile.urgeRiskForecast);
  const reminders = enumArray(profile.enabledReminderKeys, ["morning", "evening", "guard"] as const, 3);
  if (new Set(reminders).size !== reminders.length) invalid();
  const parsed: RetentionInput = {
    clientEventId: eventId(input.clientEventId),
    profile: {
      premium: booleanValue(profile.premium),
      streakDays: integer(profile.streakDays, 0, 10_000),
      bestStreakDays: integer(profile.bestStreakDays, 0, 10_000),
      attemptsThisWeek: integer(profile.attemptsThisWeek, 0, 100),
      slipsThisWeek: integer(profile.slipsThisWeek, 0, 100),
      checkInsThisWeek: integer(profile.checkInsThisWeek, 0, 7),
      completedChallengesThisWeek: integer(profile.completedChallengesThisWeek, 0, 100),
      averageUrge: decimal(profile.averageUrge, 0, 5),
      averageSleep: decimal(profile.averageSleep, 0, 5),
      steadyDays: integer(profile.steadyDays, 0, 7),
      riskWindow: nullableEnum(profile.riskWindow, RECOVERY_WINDOWS),
      slipWindow: nullableEnum(profile.slipWindow, RECOVERY_WINDOWS),
      slipTrigger: nullableEnum(profile.slipTrigger, RECOVERY_TRIGGERS),
      bestIntervention: nullableEnum(profile.bestIntervention, CATEGORIES),
      momentum: enumValue(profile.momentum, RECOVERY_MOMENTUM),
      urgeRiskForecast: risk,
      enabledReminderKeys: reminders,
      smartGuardTime: timeValue(profile.smartGuardTime),
      smartGuardSource: enumValue(profile.smartGuardSource, ["risk-window", "slip-window", "default"] as const),
      localDateKey: dateValue(profile.localDateKey),
      timezoneOffsetMinutes: integer(profile.timezoneOffsetMinutes, -840, 840)
    }
  };
  boundedPayload(parsed, 16 * 1024);
  return parsed;
}

export function createAiService(dependencies: AiServiceDependencies) {
  return {
    async generateClara(uid: string, value: unknown): Promise<ClaraResult> {
      const input = parseClaraRequest(value);
      if (CRISIS_PATTERN.test(input.input)) {
        return claraFallback(dependencies, uid, input, "crisis-support", true);
      }
      const authorization = await authorize(dependencies, uid, "clara", input.clientEventId, 30);
      if (authorization === "duplicate") return claraFallback(dependencies, uid, input, "duplicate-request");
      const gateReason = await featureGateReason(dependencies, "clara");
      if (gateReason) return claraFallback(dependencies, uid, input, gateReason);
      try {
        const remote = await callOpenAi(dependencies, "clara", claraProviderInput(input), CLARA_SCHEMA, "freed_clara");
        const output = parseClaraOutput(remote);
        await audit(dependencies, event(dependencies, uid, "clara", "remote", input.input.length, output.text.length, undefined, false));
        return { ...output, provider: "remote", status: "ok" };
      } catch (error) {
        return claraFallback(dependencies, uid, input, providerReason(error));
      }
    },

    async generateChallenges(uid: string, value: unknown): Promise<ChallengeResult> {
      const input = parseChallengeRequest(value);
      const authorization = await authorize(dependencies, uid, "challenges", input.clientEventId, 20);
      if (authorization === "duplicate") return challengeFallback(dependencies, uid, input, "duplicate-request");
      const gateReason = await featureGateReason(dependencies, "challenges");
      if (gateReason) return challengeFallback(dependencies, uid, input, gateReason);
      try {
        const remote = await callOpenAi(dependencies, "challenges", challengeProviderInput(input), CHALLENGE_SCHEMA, "freed_challenges");
        const challenges = parseChallengeOutput(remote);
        await audit(dependencies, event(dependencies, uid, "challenges", "remote", JSON.stringify(challengeProviderInput(input)).length, undefined, challenges.length, false));
        return { challenges, provider: "remote", status: "ok" };
      } catch (error) {
        return challengeFallback(dependencies, uid, input, providerReason(error));
      }
    },

    async generateRetentionPlan(uid: string, value: unknown): Promise<RetentionResult> {
      const input = parseRetentionRequest(value);
      const authorization = await authorize(dependencies, uid, "retention", input.clientEventId, 10);
      if (authorization === "duplicate") return retentionFallback(dependencies, uid, input, "duplicate-request");
      const gateReason = await featureGateReason(dependencies, "retention");
      if (gateReason) return retentionFallback(dependencies, uid, input, gateReason);
      try {
        const remote = await callOpenAi(dependencies, "retention", retentionProviderInput(input), RETENTION_SCHEMA, "freed_retention");
        const plan = parseRetentionOutput(remote, input);
        const outputLength = plan.headline.length + plan.nextBestAction.length + plan.checkInPrompt.length + plan.focusTags.join("").length;
        await audit(dependencies, event(dependencies, uid, "retention", "remote", JSON.stringify(input.profile).length, outputLength, undefined, false));
        return { ...plan, provider: "remote", status: "ok" };
      } catch (error) {
        return retentionFallback(dependencies, uid, input, providerReason(error));
      }
    }
  };
}

async function authorize(deps: AiServiceDependencies, uid: string, route: AiRoute, clientEventId: string, perMinute: number) {
  const result = await deps.authorize({ uid, route, clientEventId, perMinute });
  if (result === "rate-limited" || result === "account-deleting") throw new AiAccessError(result);
  return result;
}

async function featureGateReason(deps: AiServiceDependencies, route: AiRoute): Promise<AiFallbackReason | null> {
  try {
    const gate = await deps.getFeatureGate(route);
    if (gate === "enabled") return null;
    return gate === "disabled" ? "provider-disabled" : "configuration-unavailable";
  } catch {
    return "configuration-unavailable";
  }
}

function claraProviderInput(input: ClaraInput) {
  return { input: redactText(input.input, 1_200), context: input.context };
}

function challengeProviderInput(input: ChallengeInput) {
  const categoryCounts = Object.fromEntries(CATEGORIES.map((category) => [
    category,
    input.recentChallengeHistory.filter((item) => item.category === category).length
  ]));
  return {
    profile: input.profile,
    recentChallengeSummary: {
      attempted: input.recentChallengeHistory.length,
      helped: input.recentChallengeHistory.filter((item) => item.outcome === "helped").length,
      stillUrging: input.recentChallengeHistory.filter((item) => item.outcome === "still-urging").length,
      categoryCounts
    }
  };
}

function retentionProviderInput(input: RetentionInput) {
  return { profile: input.profile };
}

const SYSTEM_INSTRUCTIONS: Record<AiRoute, string> = {
  clara: "Select exactly one approved CLARA reply ID from the provided JSON schema. Do not write user-facing copy. Return only the required JSON.",
  challenges: "Select exactly three distinct approved recovery-challenge IDs from the provided JSON schema. Do not write user-facing copy. Return only the required JSON.",
  retention: "Select approved retention headline, action, check-in, guard-time decision, and focus-tag IDs from the provided JSON schema. Do not write user-facing copy. Return only the required JSON."
};

class ProviderFailure extends Error {
  constructor(readonly kind: "unavailable" | "invalid") {
    super(kind);
  }
}

async function callOpenAi(
  deps: AiServiceDependencies,
  route: AiRoute,
  aggregateInput: unknown,
  schema: Record<string, unknown>,
  schemaName: string
): Promise<unknown> {
  const apiKey = deps.getApiKey().trim();
  if (!apiKey) throw new ProviderFailure("unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependenciesTimeout(deps));
  timeout.unref?.();
  const body = {
    model: AI_MODEL,
    reasoning: { effort: "none" },
    store: false,
    max_output_tokens: route === "clara" ? 450 : route === "challenges" ? 1_200 : 650,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_INSTRUCTIONS[route] }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(aggregateInput) }] }
    ],
    text: {
      format: { type: "json_schema", name: schemaName, strict: true, schema }
    }
  };
  try {
    const response = await deps.fetch(AI_OPENAI_ENDPOINT, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new ProviderFailure("unavailable");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") throw new ProviderFailure("invalid");
    const encoded = await readBoundedBody(response, AI_RESPONSE_MAX_BYTES);
    let envelope: unknown;
    try {
      envelope = JSON.parse(new TextDecoder().decode(encoded));
    } catch {
      throw new ProviderFailure("invalid");
    }
    return parseResponseEnvelope(envelope);
  } catch (error) {
    if (error instanceof ProviderFailure) throw error;
    throw new ProviderFailure("unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new ProviderFailure("invalid");
  if (!response.body) throw new ProviderFailure("invalid");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ProviderFailure("invalid");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ProviderFailure) throw error;
    throw new ProviderFailure("unavailable");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function parseResponseEnvelope(value: unknown): unknown {
  if (!isRecord(value) || value.status !== "completed" || !Array.isArray(value.output)) throw new ProviderFailure("invalid");
  let text: string | null = null;
  for (const item of value.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") throw new ProviderFailure("invalid");
      if (content.type === "output_text" && typeof content.text === "string") {
        if (text !== null) throw new ProviderFailure("invalid");
        text = content.text;
      }
    }
  }
  if (!text || text.length > AI_RESPONSE_MAX_BYTES) throw new ProviderFailure("invalid");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderFailure("invalid");
  }
}

function parseClaraOutput(value: unknown): { text: string } {
  const record = exactOutputRecord(value, ["replyId"] as const);
  const replyId = outputEnum(record.replyId, CLARA_REPLY_IDS);
  return { text: CLARA_REPLY_CATALOG[replyId] };
}

function parseChallengeOutput(value: unknown): RecoveryChallenge[] {
  const root = exactOutputRecord(value, ["challengeIds"] as const);
  if (!Array.isArray(root.challengeIds) || root.challengeIds.length !== 3) throw new ProviderFailure("invalid");
  const challengeIds = root.challengeIds.map((id) => outputEnum(id, APPROVED_CHALLENGE_IDS));
  if (new Set(challengeIds).size !== 3) throw new ProviderFailure("invalid");
  return challengeIds.map((id) => cloneChallenge(APPROVED_CHALLENGE_CATALOG[id]));
}

function parseRetentionOutput(value: unknown, input: RetentionInput) {
  const item = exactOutputRecord(value, ["headlineId", "actionId", "checkInId", "guardTimeDecision", "focusTagIds"] as const);
  const headlineId = outputEnum(item.headlineId, RETENTION_HEADLINE_IDS);
  const actionId = outputEnum(item.actionId, RETENTION_ACTION_IDS);
  const checkInId = outputEnum(item.checkInId, RETENTION_CHECK_IN_IDS);
  const guardTimeDecision = outputEnum(item.guardTimeDecision, ["keep", "none"] as const);
  if (!Array.isArray(item.focusTagIds) || item.focusTagIds.length < 1 || item.focusTagIds.length > 4) throw new ProviderFailure("invalid");
  const focusTagIds = item.focusTagIds.map((id) => outputEnum(id, RETENTION_FOCUS_TAG_IDS));
  if (new Set(focusTagIds).size !== focusTagIds.length) throw new ProviderFailure("invalid");
  return {
    headline: RETENTION_HEADLINE_CATALOG[headlineId],
    nextBestAction: RETENTION_ACTION_CATALOG[actionId],
    checkInPrompt: RETENTION_CHECK_IN_CATALOG[checkInId],
    suggestedGuardTime: guardTimeDecision === "keep" && input.profile.smartGuardSource !== "default"
      ? input.profile.smartGuardTime
      : null,
    focusTags: focusTagIds.map((id) => RETENTION_FOCUS_TAG_CATALOG[id])
  };
}

async function claraFallback(
  deps: AiServiceDependencies,
  uid: string,
  input: ClaraInput,
  reason: AiFallbackReason,
  crisis = false
): Promise<ClaraResult> {
  const text = crisis
    ? CRISIS_REPLY
    : "Put the phone down, take three slow breaths, and move to a different room. A small change in body and place can interrupt the automatic loop.";
  await audit(deps, event(deps, uid, "clara", "fallback", input.input.length, text.length, undefined, crisis));
  return { text, provider: "fallback", status: "fallback", reason };
}

async function challengeFallback(deps: AiServiceDependencies, uid: string, input: ChallengeInput, reason: AiFallbackReason): Promise<ChallengeResult> {
  const challenges = localChallenges();
  await audit(deps, event(deps, uid, "challenges", "fallback", JSON.stringify(challengeProviderInput(input)).length, undefined, 3, false));
  return { challenges, provider: "fallback", status: "fallback", reason };
}

async function retentionFallback(deps: AiServiceDependencies, uid: string, input: RetentionInput, reason: AiFallbackReason): Promise<RetentionResult> {
  const plan = localRetention(input);
  const outputLength = plan.headline.length + plan.nextBestAction.length + plan.checkInPrompt.length + plan.focusTags.join("").length;
  await audit(deps, event(deps, uid, "retention", "fallback", JSON.stringify(input.profile).length, outputLength, undefined, false));
  return { ...plan, provider: "fallback", status: "fallback", reason };
}

function localChallenges(): RecoveryChallenge[] {
  return APPROVED_CHALLENGE_IDS.slice(0, 3).map((id) => cloneChallenge(APPROVED_CHALLENGE_CATALOG[id]));
}

function cloneChallenge(challenge: RecoveryChallenge): RecoveryChallenge {
  return { ...challenge, steps: [...challenge.steps] };
}

function localRetention(input: RetentionInput) {
  const atRisk = input.profile.slipsThisWeek > 0 || input.profile.urgeRiskForecast.level !== "low";
  return {
    headline: input.profile.streakDays > 0 ? `${input.profile.streakDays} clean days. Protect the next one.` : "Start with the next clean hour.",
    nextBestAction: atRisk
      ? "Set your guard reminder and keep the phone outside the highest-risk room tonight."
      : "Complete one honest check-in and keep the phone out of reach during your usual risk window.",
    checkInPrompt: "What is the smallest action that would make the next hour easier?",
    suggestedGuardTime: input.profile.smartGuardSource === "default" ? null : input.profile.smartGuardTime,
    focusTags: atRisk ? ["guard-time", "phone-boundary", "reset"] : ["check-in", "phone-boundary"]
  };
}

function event(
  deps: AiServiceDependencies,
  uid: string,
  eventType: AiRoute,
  outcome: "remote" | "fallback",
  inputCharacterCount: number,
  outputCharacterCount: number | undefined,
  generatedItemCount: number | undefined,
  crisisFallback: boolean
): AiAuditEvent {
  const createdAt = deps.now();
  return {
    uid,
    eventType,
    outcome,
    provider: outcome === "remote" ? "openai" : "local",
    model: AI_MODEL,
    crisisFallback,
    inputCharacterCount,
    outputCharacterCount,
    generatedItemCount,
    createdAt,
    expiresAt: createdAt + AI_EVENT_TTL_MS
  };
}

async function audit(deps: AiServiceDependencies, value: AiAuditEvent) {
  try {
    await deps.persistEvent(value);
  } catch {
    // Operational audit is best effort and never changes a safe user response.
  }
}

function providerReason(error: unknown): AiFallbackReason {
  return error instanceof ProviderFailure && error.kind === "invalid" ? "invalid-provider-response" : "provider-unavailable";
}

const CLARA_SCHEMA = {
  type: "object", additionalProperties: false, required: ["replyId"],
  properties: { replyId: { type: "string", enum: CLARA_REPLY_IDS } }
};

const CHALLENGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["challengeIds"],
  properties: {
    challengeIds: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", enum: APPROVED_CHALLENGE_IDS } }
  }
};

const RETENTION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["headlineId", "actionId", "checkInId", "guardTimeDecision", "focusTagIds"],
  properties: {
    headlineId: { type: "string", enum: RETENTION_HEADLINE_IDS },
    actionId: { type: "string", enum: RETENTION_ACTION_IDS },
    checkInId: { type: "string", enum: RETENTION_CHECK_IN_IDS },
    guardTimeDecision: { type: "string", enum: ["keep", "none"] },
    focusTagIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", enum: RETENTION_FOCUS_TAG_IDS } }
  }
};

function parseNullableIntervention(value: unknown): ChallengeInput["profile"]["interventionContext"] {
  if (value === null) return null;
  const item = exactRecord(value, INTERVENTION_KEYS);
  return {
    source: enumValue(item.source, ["browser", "search", "manual-check", "panic-button", "app"] as const),
    category: enumValue(item.category, ["adult", "adult-search-intent", "known-safe", "unknown", "self-reported"] as const),
    surface: enumValue(item.surface, ["adult-site", "adult-search", "search", "social", "video", "forum", "self-urge", "unknown"] as const),
    ruleFamily: nullableIdentifier(item.ruleFamily),
    sessionDurationBucket: nullableEnum(item.sessionDurationBucket, ["under-1m", "1-5m", "5-15m", "15-30m", "30m-plus"] as const)
  };
}

function parseNullableDiscipline(value: unknown): ChallengeInput["profile"]["disciplinePreferences"] {
  if (value === null) return null;
  const item = exactRecord(value, DISCIPLINE_KEYS);
  return {
    challengeIntensity: enumValue(item.challengeIntensity, ["gentle", "balanced", "strong"] as const),
    outdoorFrequency: enumValue(item.outdoorFrequency, ["low", "balanced", "high"] as const),
    exercisePreference: enumValue(item.exercisePreference, ["low", "balanced", "high"] as const),
    socialFrequency: enumValue(item.socialFrequency, ["off", "low", "balanced", "high"] as const),
    emergencyStrictMode: booleanValue(item.emergencyStrictMode),
    sleepModeActive: booleanValue(item.sleepModeActive),
    deepFocusModeActive: booleanValue(item.deepFocusModeActive),
    weekendModeEnabled: booleanValue(item.weekendModeEnabled),
    unlockDurationMinutes: integer(item.unlockDurationMinutes, 5, 60),
    dailyLimitMinutes: integer(item.dailyLimitMinutes, 5, 240)
  };
}

function parseNullableContextSignals(value: unknown): ChallengeInput["profile"]["contextSignals"] {
  if (value === null) return null;
  const item = exactRecord(value, CONTEXT_SIGNAL_KEYS);
  return {
    energyLevel: nullableEnum(item.energyLevel, ["low", "steady", "high"] as const),
    urgeLevel: nullableInteger(item.urgeLevel, 0, 5),
    sleepQuality: nullableInteger(item.sleepQuality, 1, 5),
    locationPermission: nullableEnum(item.locationPermission, ["granted", "denied", "undetermined", "unavailable", "unknown"] as const),
    weatherCondition: nullableEnum(item.weatherCondition, ["clear", "cloudy", "rain", "snow", "storm", "hot", "cold", "unknown"] as const),
    temperatureC: nullableInteger(item.temperatureC, -60, 60)
  };
}

function parseNullableRisk(value: unknown): ChallengeInput["profile"]["riskForecast"] {
  return value === null ? null : parseRequiredRisk(value);
}

function parseRequiredRisk(value: unknown) {
  const item = exactRecord(value, RISK_KEYS);
  return {
    level: enumValue(item.level, ["low", "elevated", "high"] as const),
    score: integer(item.score, 0, 100),
    confidence: enumValue(item.confidence, ["low", "medium", "high"] as const),
    currentWindow: nullableEnum(item.currentWindow, CURRENT_RISK_WINDOWS),
    drivers: enumArray(item.drivers, RECOVERY_RISK_DRIVERS, 4)
  };
}

function exactRecord<const K extends readonly string[]>(value: unknown, keys: K): Record<K[number], unknown> {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) invalid();
  return value as Record<K[number], unknown>;
}

function exactOutputRecord<const K extends readonly string[]>(value: unknown, keys: K): Record<K[number], unknown> {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new ProviderFailure("invalid");
  }
  return value as Record<K[number], unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new AiInputError("The callable payload is not permitted.");
}

function eventId(value: unknown) {
  if (typeof value !== "string" || !CLIENT_EVENT_ID.test(value)) invalid();
  return value;
}

function identifier(value: unknown) {
  if (typeof value !== "string" || !SAFE_ID.test(value) || RAW_LINK.test(value)) invalid();
  return value;
}

function nullableIdentifier(value: unknown) {
  return value === null ? null : identifier(value);
}

function userText(value: unknown, max: number) {
  if (typeof value !== "string") invalid();
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > max) invalid();
  return cleaned;
}

function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) invalid();
  return value;
}

function decimal(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) invalid();
  return value;
}

function nullableInteger(value: unknown, min: number, max: number) {
  return value === null ? null : integer(value, min, max);
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") invalid();
  return value;
}

function nullableBoolean(value: unknown) {
  return value === null ? null : booleanValue(value);
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) invalid();
  return value as T[number];
}

function nullableEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return value === null ? null : enumValue(value, allowed);
}

function enumArray<const T extends readonly string[]>(value: unknown, allowed: T, max: number): T[number][] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value.map((item) => enumValue(item, allowed));
}

function canonicalIso(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid();
  return value;
}

function timeValue(value: unknown) {
  if (typeof value !== "string" || !TIME.test(value)) invalid();
  return value;
}

function dateValue(value: unknown) {
  if (
    typeof value !== "string" || !DATE.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) invalid();
  return value;
}

function dependenciesTimeout(deps: AiServiceDependencies) {
  return deps.timeoutMs ?? AI_TIMEOUT_MS;
}

function boundedPayload(value: unknown, maxBytes: number) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxBytes) invalid();
}

function redactText(value: string, max: number) {
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function outputEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ProviderFailure("invalid");
  return value as T[number];
}
