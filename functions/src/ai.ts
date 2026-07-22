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

export type ClaraInput = {
  clientEventId: string;
  input: string;
  context: {
    streakDays: number | null;
    attemptsToday: number | null;
    premium: boolean | null;
    slipsThisWeek: number | null;
    slipWindow: string | null;
    slipTrigger: string | null;
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
    slipWindow: string | null;
    slipTrigger: string | null;
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
      currentWindow: string | null;
      drivers: string[];
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
    riskWindow: string | null;
    slipWindow: string | null;
    slipTrigger: string | null;
    bestIntervention: string | null;
    momentum: string;
    urgeRiskForecast: {
      level: "low" | "elevated" | "high";
      score: number;
      confidence: "low" | "medium" | "high";
      currentWindow: string | null;
      drivers: string[];
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
const INTENSITIES = ["calm", "medium", "strong"] as const;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;
const CLIENT_EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RAW_LINK = /https?:\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/i;
const UNSAFE_CHALLENGE = /\b(?:drive|driving|fasting|starve|doctor|medicine|medication|medical|sexual|sex|porn|shame|punish|scald|boiling)\b|(?:hot|warm)\s+(?:bath|shower|water)[^.!?]{0,30}(?:4[2-9]|[5-9]\d)\s*°?c|until\s+(?:you\s+)?(?:collapse|exhausted)|\b[1-9]\d{2,}\s*(?:push[- ]?ups?|sit[- ]?ups?|squats?|burpees?|repetitions?|reps?)\b|hold\s+(?:your\s+)?breath[^.!?]{0,30}(?:minutes?|until)/i;
const CRISIS_PATTERN = /\b(?:kill myself|end my life|ending it all|suicide|suicidal|hurt myself|harm myself|self[- ]harm|going to die|immediate danger|(?:do not|don't) want to live|no reason to live)\b/i;

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
      slipWindow: nullableSignal(context.slipWindow, 64),
      slipTrigger: nullableSignal(context.slipTrigger, 64)
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
      slipWindow: nullableSignal(profile.slipWindow, 64),
      slipTrigger: nullableSignal(profile.slipTrigger, 64),
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
      riskWindow: nullableSignal(profile.riskWindow, 72),
      slipWindow: nullableSignal(profile.slipWindow, 72),
      slipTrigger: nullableSignal(profile.slipTrigger, 64),
      bestIntervention: nullableSignal(profile.bestIntervention, 96),
      momentum: signal(profile.momentum, 72),
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
      const authorization = await authorize(dependencies, uid, "clara", input.clientEventId, 30);
      if (authorization === "duplicate") return claraFallback(dependencies, uid, input, "duplicate-request");
      if (CRISIS_PATTERN.test(input.input)) {
        return claraFallback(dependencies, uid, input, "crisis-support", true);
      }
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
        const plan = parseRetentionOutput(remote);
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
  return { profile: input.profile, recentChallengeHistory: input.recentChallengeHistory };
}

function retentionProviderInput(input: RetentionInput) {
  return { profile: input.profile };
}

const SYSTEM_INSTRUCTIONS: Record<AiRoute, string> = {
  clara: "You are CLARA, a concise adult recovery coach. Give one immediate safe action first. Be calm, nonjudgmental, nonsexualized, and non-shaming. Never include links, domains, browsing details, medical directions, or crisis improvisation. Return only the required JSON.",
  challenges: "Generate exactly three immediately doable recovery challenges. Be calm and non-shaming. Never prescribe driving, unsafe exercise, fasting, medical intervention, sexual content, punishment, or water hotter than 41°C. Set premium false. Return only the required JSON.",
  retention: "Generate one practical retention plan from aggregate recovery signals only. Never request or include notes, contacts, browsing history, links, domains, transcripts, sexual detail, shame, or medical directions. Return only the required JSON."
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
  const record = exactOutputRecord(value, ["text"] as const);
  const text = outputText(record.text, 1_000);
  if (!text) throw new ProviderFailure("invalid");
  return { text };
}

function parseChallengeOutput(value: unknown): RecoveryChallenge[] {
  const root = exactOutputRecord(value, ["challenges"] as const);
  if (!Array.isArray(root.challenges) || root.challenges.length !== 3) throw new ProviderFailure("invalid");
  const challenges = root.challenges.map((value) => {
    const item = exactOutputRecord(value, ["id", "title", "category", "durationSec", "intensity", "premium", "icon", "steps", "why"] as const);
    if (item.premium !== false || !Array.isArray(item.steps) || item.steps.length < 2 || item.steps.length > 4) throw new ProviderFailure("invalid");
    const challenge: RecoveryChallenge = {
      id: outputIdentifier(item.id),
      title: requiredOutputText(item.title, 64),
      category: outputEnum(item.category, CATEGORIES),
      durationSec: outputInteger(item.durationSec, 30, 900),
      intensity: outputEnum(item.intensity, INTENSITIES),
      premium: false,
      icon: outputIcon(item.icon),
      steps: item.steps.map((step) => requiredOutputText(step, 120)),
      why: requiredOutputText(item.why, 160)
    };
    if ([challenge.title, challenge.why, ...challenge.steps].some((text) => UNSAFE_CHALLENGE.test(text))) {
      throw new ProviderFailure("invalid");
    }
    return challenge;
  });
  if (new Set(challenges.map((challenge) => challenge.id)).size !== 3) throw new ProviderFailure("invalid");
  return challenges;
}

function parseRetentionOutput(value: unknown) {
  const item = exactOutputRecord(value, ["headline", "nextBestAction", "checkInPrompt", "suggestedGuardTime", "focusTags"] as const);
  if (!Array.isArray(item.focusTags) || item.focusTags.length < 1 || item.focusTags.length > 4) throw new ProviderFailure("invalid");
  if (item.suggestedGuardTime !== null && (typeof item.suggestedGuardTime !== "string" || !TIME.test(item.suggestedGuardTime))) {
    throw new ProviderFailure("invalid");
  }
  const focusTags = item.focusTags.map((tag) => requiredOutputText(tag, 32));
  if (new Set(focusTags.map((tag) => tag.toLowerCase())).size !== focusTags.length) throw new ProviderFailure("invalid");
  return {
    headline: requiredOutputText(item.headline, 90),
    nextBestAction: requiredOutputText(item.nextBestAction, 180),
    checkInPrompt: requiredOutputText(item.checkInPrompt, 140),
    suggestedGuardTime: item.suggestedGuardTime as string | null,
    focusTags
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
  return [
    {
      id: "local-breath-reset", title: "Take three slow breaths", category: "breathing", durationSec: 60, intensity: "calm",
      premium: false, icon: "Waves", steps: ["Put the phone down.", "Breathe in slowly, then exhale longer."],
      why: "Slower breathing creates a short pause before the next action."
    },
    {
      id: "local-room-reset", title: "Change your environment", category: "reset", durationSec: 120, intensity: "medium",
      premium: false, icon: "Footprints", steps: ["Stand up and leave the current room.", "Keep the phone out of reach for two minutes."],
      why: "Changing place interrupts the cue and gives the urge time to settle."
    },
    {
      id: "local-reflect-reset", title: "Name the next safe step", category: "reflection", durationSec: 90, intensity: "calm",
      premium: false, icon: "Notebook", steps: ["Name what you need for the next ten minutes.", "Choose one small action that supports it."],
      why: "A specific next step makes the automatic loop less powerful."
    }
  ];
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
  type: "object", additionalProperties: false, required: ["text"],
  properties: { text: { type: "string", minLength: 1, maxLength: 1_000 } }
};

const CHALLENGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["challenges"],
  properties: {
    challenges: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "category", "durationSec", "intensity", "premium", "icon", "steps", "why"],
        properties: {
          id: { type: "string", minLength: 3, maxLength: 80 }, title: { type: "string", minLength: 1, maxLength: 64 },
          category: { type: "string", enum: CATEGORIES }, durationSec: { type: "integer", minimum: 30, maximum: 900 },
          intensity: { type: "string", enum: INTENSITIES }, premium: { type: "boolean", enum: [false] },
          icon: { type: "string", minLength: 1, maxLength: 40 },
          steps: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 120 } },
          why: { type: "string", minLength: 1, maxLength: 160 }
        }
      }
    }
  }
};

const RETENTION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["headline", "nextBestAction", "checkInPrompt", "suggestedGuardTime", "focusTags"],
  properties: {
    headline: { type: "string", minLength: 1, maxLength: 90 },
    nextBestAction: { type: "string", minLength: 1, maxLength: 180 },
    checkInPrompt: { type: "string", minLength: 1, maxLength: 140 },
    suggestedGuardTime: { type: ["string", "null"] },
    focusTags: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 32 } }
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
    currentWindow: nullableSignal(item.currentWindow, 72),
    drivers: signalArray(item.drivers, 4, 56)
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

function signal(value: unknown, max: number) {
  if (typeof value !== "string") invalid();
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > max || RAW_LINK.test(cleaned)) invalid();
  return cleaned;
}

function nullableSignal(value: unknown, max: number) {
  return value === null ? null : signal(value, max);
}

function signalArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) invalid();
  return value.map((item) => signal(item, maxLength));
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

function outputText(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ProviderFailure("invalid");
  return redactText(value, max);
}

function requiredOutputText(value: unknown, max: number) {
  const text = outputText(value, max);
  if (!text) throw new ProviderFailure("invalid");
  return text;
}

function outputIdentifier(value: unknown) {
  if (typeof value !== "string" || !SAFE_ID.test(value) || RAW_LINK.test(value)) throw new ProviderFailure("invalid");
  return value;
}

function outputIcon(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(value)) throw new ProviderFailure("invalid");
  return value;
}

function outputInteger(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new ProviderFailure("invalid");
  return value;
}

function outputEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ProviderFailure("invalid");
  return value as T[number];
}
