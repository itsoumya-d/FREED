import type { ChallengeGenerationRequest, ChallengeInterventionContextRequest } from "@/lib/challenge-generator";
import { redactCoachText } from "@/lib/ai-coach";
import { recordAiBackendEvent } from "@/lib/backend-event-audit";
import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { generateChallengeSet } from "@/lib/recovery-engine";
import { coarseRecoveryTriggerLabel } from "@/lib/recovery-signal-privacy";
import { readBoundedJsonBody } from "@/lib/server-request-body";
import { safeServerAiFallbackReason } from "@/lib/server-ai-fallback-reason";
import { createServerAiText, readServerAiProviderModel } from "@/lib/server-ai-provider";
import type {
  ChallengeContextSignal,
  ChallengeHistorySignal,
  ChallengePreferenceSignal,
  RecoveryChallenge,
  RecoveryProfile,
  UrgeRiskForecastSignal
} from "@/lib/recovery-engine";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const categories: RecoveryChallenge["category"][] = ["physical", "breathing", "reflection", "connection", "reset"];
const moods: RecoveryProfile["mood"][] = ["low", "steady", "energized", "stressed"];
const interventionSources: ChallengeInterventionContextRequest["source"][] = ["browser", "search", "manual-check", "panic-button", "app"];
const interventionCategories: ChallengeInterventionContextRequest["category"][] = ["adult", "adult-search-intent", "known-safe", "unknown", "self-reported"];
const interventionSurfaces: ChallengeInterventionContextRequest["surface"][] = ["adult-site", "adult-search", "search", "social", "video", "forum", "self-urge", "unknown"];
const sessionDurationBuckets: NonNullable<ChallengeInterventionContextRequest["sessionDurationBucket"]>[] = [
  "under-1m",
  "1-5m",
  "5-15m",
  "15-30m",
  "30m-plus"
];
const intensityPreferences: ChallengePreferenceSignal["challengeIntensity"][] = ["gentle", "balanced", "strong"];
const frequencyPreferences: ChallengePreferenceSignal["outdoorFrequency"][] = ["low", "balanced", "high"];
const socialFrequencyPreferences: ChallengePreferenceSignal["socialFrequency"][] = ["off", "low", "balanced", "high"];
const energyLevels: NonNullable<ChallengeContextSignal["energyLevel"]>[] = ["low", "steady", "high"];
const CHALLENGE_BODY_LIMIT_BYTES = 64 * 1024;
const locationPermissions: NonNullable<ChallengeContextSignal["locationPermission"]>[] = ["granted", "denied", "undetermined", "unavailable", "unknown"];
const weatherConditions: NonNullable<ChallengeContextSignal["weatherCondition"]>[] = ["clear", "cloudy", "rain", "snow", "storm", "hot", "cold", "unknown"];
const riskForecastLevels: UrgeRiskForecastSignal["level"][] = ["low", "elevated", "high"];
const riskForecastConfidence: UrgeRiskForecastSignal["confidence"][] = ["low", "medium", "high"];

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function optionalNumberValue(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
}

function dayPartFromHour(hour: number): ChallengeGenerationRequest["profile"]["dayPart"] {
  if (hour >= 22 || hour <= 5) return "late-night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function signalText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = redactCoachText(value).slice(0, 64);
  return cleaned || null;
}

function sanitizeRuleFamily(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .split(":")[0]
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 48);
  return cleaned || null;
}

function sanitizeInterventionContext(value: unknown): ChallengeInterventionContextRequest | null {
  if (!isRecord(value)) return null;
  const rawSource = value.source === "test-lab" ? "manual-check" : value.source;
  const source = interventionSources.includes(rawSource as ChallengeInterventionContextRequest["source"])
    ? (rawSource as ChallengeInterventionContextRequest["source"])
    : null;
  const category = interventionCategories.includes(value.category as ChallengeInterventionContextRequest["category"])
    ? (value.category as ChallengeInterventionContextRequest["category"])
    : null;
  const surface = interventionSurfaces.includes(value.surface as ChallengeInterventionContextRequest["surface"])
    ? (value.surface as ChallengeInterventionContextRequest["surface"])
    : null;
  if (!source || !category || !surface) return null;

  return {
    source,
    category,
    surface,
    ruleFamily: sanitizeRuleFamily(value.ruleFamily),
    sessionDurationBucket: sessionDurationBuckets.includes(value.sessionDurationBucket as NonNullable<ChallengeInterventionContextRequest["sessionDurationBucket"]>)
      ? (value.sessionDurationBucket as NonNullable<ChallengeInterventionContextRequest["sessionDurationBucket"]>)
      : null
  };
}

function sanitizeDisciplinePreferences(value: unknown): ChallengePreferenceSignal | null {
  if (!isRecord(value)) return null;
  const challengeIntensity = intensityPreferences.includes(value.challengeIntensity as ChallengePreferenceSignal["challengeIntensity"])
    ? (value.challengeIntensity as ChallengePreferenceSignal["challengeIntensity"])
    : "balanced";
  const outdoorFrequency = frequencyPreferences.includes(value.outdoorFrequency as ChallengePreferenceSignal["outdoorFrequency"])
    ? (value.outdoorFrequency as ChallengePreferenceSignal["outdoorFrequency"])
    : "balanced";
  const exercisePreference = frequencyPreferences.includes(value.exercisePreference as ChallengePreferenceSignal["exercisePreference"])
    ? (value.exercisePreference as ChallengePreferenceSignal["exercisePreference"])
    : "balanced";
  const socialFrequency = socialFrequencyPreferences.includes(value.socialFrequency as ChallengePreferenceSignal["socialFrequency"])
    ? (value.socialFrequency as ChallengePreferenceSignal["socialFrequency"])
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
    unlockDurationMinutes: numberValue(value.unlockDurationMinutes, 10, 5, 60),
    dailyLimitMinutes: numberValue(value.dailyLimitMinutes, 30, 5, 240)
  };
}

function sanitizeContextSignals(value: unknown): ChallengeContextSignal | null {
  if (!isRecord(value)) return null;
  const energyLevel = energyLevels.includes(value.energyLevel as NonNullable<ChallengeContextSignal["energyLevel"]>)
    ? (value.energyLevel as NonNullable<ChallengeContextSignal["energyLevel"]>)
    : null;
  const locationPermission = locationPermissions.includes(value.locationPermission as NonNullable<ChallengeContextSignal["locationPermission"]>)
    ? (value.locationPermission as NonNullable<ChallengeContextSignal["locationPermission"]>)
    : null;
  const weatherCondition = weatherConditions.includes(value.weatherCondition as NonNullable<ChallengeContextSignal["weatherCondition"]>)
    ? (value.weatherCondition as NonNullable<ChallengeContextSignal["weatherCondition"]>)
    : null;
  const urgeLevel = optionalNumberValue(value.urgeLevel, 0, 5);
  const sleepQuality = optionalNumberValue(value.sleepQuality, 1, 5);
  const temperatureC = optionalNumberValue(value.temperatureC, -60, 60);
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

function sanitizeRiskForecast(value: unknown): UrgeRiskForecastSignal | null {
  if (!isRecord(value)) return null;
  const level = riskForecastLevels.includes(value.level as UrgeRiskForecastSignal["level"])
    ? (value.level as UrgeRiskForecastSignal["level"])
    : "low";
  const confidence = riskForecastConfidence.includes(value.confidence as UrgeRiskForecastSignal["confidence"])
    ? (value.confidence as UrgeRiskForecastSignal["confidence"])
    : "low";
  const drivers = Array.isArray(value.drivers)
    ? value.drivers.map(signalText).filter((driver): driver is string => Boolean(driver)).slice(0, 4)
    : [];

  return {
    level,
    score: numberValue(value.score, 0, 0, 100),
    confidence,
    currentWindow: signalText(value.currentWindow),
    drivers
  };
}

function sanitizeChallengeHistory(value: unknown): ChallengeHistorySignal[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item): ChallengeHistorySignal => {
      const outcome: ChallengeHistorySignal["outcome"] = item.outcome === "still-urging" ? "still-urging" : "helped";
      return {
        id: typeof item.id === "string" ? item.id.slice(0, 80) : "",
        category: categories.includes(item.category as RecoveryChallenge["category"]) ? (item.category as RecoveryChallenge["category"]) : "reset",
        outcome,
        completedAt: typeof item.completedAt === "string" && Number.isFinite(Date.parse(item.completedAt)) ? item.completedAt : new Date(0).toISOString()
      };
    })
    .filter((item) => item.id.length > 0)
    .slice(0, 10);
}

function sanitizeRequest(value: unknown): { request: ChallengeGenerationRequest; profile: RecoveryProfile } | null {
  if (!isRecord(value) || !isRecord(value.profile)) return null;
  const profile = value.profile;
  const preferredCategories = Array.isArray(profile.preferredCategories)
    ? profile.preferredCategories.filter((category): category is RecoveryChallenge["category"] => categories.includes(category as RecoveryChallenge["category"])).slice(0, 5)
    : [];
  const mood = moods.includes(profile.mood as RecoveryProfile["mood"]) ? (profile.mood as RecoveryProfile["mood"]) : "steady";
  const recentChallengeHistory = sanitizeChallengeHistory(value.recentChallengeHistory);
  const slipsThisWeek = optionalNumberValue(profile.slipsThisWeek, 0, 100);
  const includeSlipSignals = (slipsThisWeek ?? 0) > 0;
  const hour = numberValue(profile.hour, new Date().getHours(), 0, 23);
  const dayOfWeek = optionalNumberValue(profile.dayOfWeek, 0, 6);
  const timezoneOffsetMinutes = optionalNumberValue(profile.timezoneOffsetMinutes, -840, 840);
  const interventionContext = sanitizeInterventionContext(profile.interventionContext);
  const disciplinePreferences = sanitizeDisciplinePreferences(profile.disciplinePreferences);
  const contextSignals = sanitizeContextSignals(profile.contextSignals);
  const riskForecast = sanitizeRiskForecast(profile.riskForecast);
  const recentFailureCount = numberValue(profile.recentFailureCount, 0, 0, 10);

  const safeProfile: RecoveryProfile = {
    streakDays: numberValue(profile.streakDays, 0, 0, 10_000),
    premium: Boolean(profile.premium),
    attemptsToday: numberValue(profile.attemptsToday, 0, 0, 100),
    mood,
    hour,
    dayOfWeek,
    timezoneOffsetMinutes,
    slipsThisWeek: slipsThisWeek ?? undefined,
    slipWindow: includeSlipSignals ? signalText(profile.slipWindow) : null,
    slipTrigger: includeSlipSignals ? coarseRecoveryTriggerLabel(profile.slipTrigger) : null,
    interventionContext: interventionContext
      ? {
          source: interventionContext.source,
          category: interventionContext.category,
          surface: interventionContext.surface,
          matchedRule: interventionContext.ruleFamily,
          sessionDurationBucket: interventionContext.sessionDurationBucket
      }
      : null,
    disciplinePreferences,
    contextSignals,
    riskForecast,
    recentFailureCount,
    preferredCategories,
    challengeHistory: recentChallengeHistory
  };

  return {
    request: {
      profile: {
        streakDays: safeProfile.streakDays,
        premium: safeProfile.premium,
        attemptsToday: safeProfile.attemptsToday,
        mood: safeProfile.mood,
        hour: safeProfile.hour,
        dayPart: dayPartFromHour(safeProfile.hour),
        isWeekend: dayOfWeek === null ? null : dayOfWeek === 0 || dayOfWeek === 6,
        timezoneOffsetMinutes,
        slipsThisWeek,
        slipWindow: safeProfile.slipWindow ?? null,
        slipTrigger: safeProfile.slipTrigger ?? null,
        interventionContext,
        disciplinePreferences,
        contextSignals,
        riskForecast,
        recentFailureCount,
        preferredCategories
      },
      recentChallengeHistory,
      guardrails: [
        "Return exactly three short recovery challenges.",
        "Avoid shame, punishment, sexualized language, or moral judgment.",
        "Prefer immediate physical, breathing, reflection, connection, or environment reset actions.",
        "Use slip summaries only as aggregate recovery pattern signals.",
        "Use intervention context only as coarse surface/category data, never as browsing history.",
        "Use session duration only as a coarse bucket, never as screen content or raw usage logs.",
        "Treat recent failed resets as aggregate count signals and avoid repeating what just failed.",
        "Use context signals only when present; never infer weather or location, and never request precise coordinates.",
        "Use the urge risk forecast only as aggregate local context; never ask for raw notes, browsing details, or location.",
        "Respect discipline settings for challenge intensity, outdoor frequency, exercise, social actions, sleep mode, and unlock duration.",
        "Do not request unsafe exercise, medical intervention, driving, or anything that needs special equipment.",
        "Respect premium=false by not returning premium-only challenges."
      ]
    },
    profile: safeProfile
  };
}

function sanitizeGeneratedText(value: unknown, fallback: string, maxLength: number) {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function sanitizeFallbackReason(error: unknown) {
  return safeServerAiFallbackReason(error, "Challenge backend fallback.");
}

function sanitizeGeneratedId(value: unknown, index: number) {
  const fallback = `server-reset-${index + 1}`;
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

function normalizeGeneratedChallenges(value: unknown, profile: RecoveryProfile): RecoveryChallenge[] {
  if (!isRecord(value) || !Array.isArray(value.challenges)) return [];
  const seen = new Set<string>();

  return value.challenges
    .filter(isRecord)
    .map((candidate, index): RecoveryChallenge | null => {
      const category = categories.includes(candidate.category as RecoveryChallenge["category"]) ? (candidate.category as RecoveryChallenge["category"]) : null;
      const intensity = ["calm", "medium", "strong"].includes(String(candidate.intensity)) ? (candidate.intensity as RecoveryChallenge["intensity"]) : null;
      const premium = Boolean(candidate.premium);
      const steps = Array.isArray(candidate.steps)
        ? candidate.steps.filter((step): step is string => typeof step === "string" && step.trim().length > 0).slice(0, 4)
        : [];

      if (!category || !intensity || steps.length < 2 || (!profile.premium && premium)) return null;

      return {
        id: sanitizeGeneratedId(candidate.id, index),
        title: sanitizeGeneratedText(candidate.title, "Quick recovery reset", 64),
        category,
        durationSec: numberValue(candidate.durationSec, 120, 30, 900),
        intensity,
        premium,
        icon: sanitizeIconName(candidate.icon),
        steps: steps.map((step) => sanitizeGeneratedText(step, "Take one calm step.", 120)),
        why: sanitizeGeneratedText(candidate.why, "This reset interrupts the loop and gives your mind time to settle.", 160)
      };
    })
    .filter((challenge): challenge is RecoveryChallenge => Boolean(challenge))
    .filter((challenge) => {
      if (seen.has(challenge.id)) return false;
      seen.add(challenge.id);
      return true;
    })
    .slice(0, 3);
}

const CHALLENGE_SYSTEM_INSTRUCTION =
  "Generate exactly 3 safe, short, supportive relapse-interruption challenges for FREED. " +
  "Each must be calm, non-shaming, and immediately doable. " +
  "Forbidden: sexualized language, moral judgment, unsafe exercise, fasting, medical claims, driving, hot baths over 41°C, anything requiring equipment beyond a phone/water/clothes. " +
  "Output JSON ONLY. No prose, no Markdown fence, no commentary.";

const CHALLENGE_JSON_SCHEMA = {
  type: "object",
  required: ["challenges"],
  additionalProperties: false,
  properties: {
    challenges: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        required: ["id", "title", "category", "durationSec", "intensity", "premium", "icon", "why", "steps"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: { type: "string", enum: categories },
          durationSec: { type: "number" },
          intensity: { type: "string", enum: ["calm", "medium", "strong"] },
          premium: { type: "boolean" },
          icon: { type: "string" },
          why: { type: "string" },
          steps: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" }
          }
        }
      }
    }
  }
};

async function createRemoteChallenges(request: ChallengeGenerationRequest, profile: RecoveryProfile) {
  const text = await createServerAiText({
    taskName: "challenge generation",
    systemInstruction: CHALLENGE_SYSTEM_INSTRUCTION,
    userPrompt: `Generate 3 challenges for this anonymized profile. Use only the JSON schema. Profile: ${JSON.stringify(request)}`,
    responseFormat: "json",
    responseFormatName: "freed_challenges",
    jsonResponseSchema: CHALLENGE_JSON_SCHEMA,
    geminiResponseSchema: CHALLENGE_JSON_SCHEMA,
    temperature: 0.65,
    topP: 0.9,
    maxOutputTokens: 900
  });
  const parsed = text ? JSON.parse(text) : null;
  const challenges = normalizeGeneratedChallenges(parsed, profile);
  if (challenges.length !== 3) throw new Error("Remote AI returned fewer than three usable challenges.");
  return challenges;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

async function recordChallengeAudit(
  sanitized: { request: ChallengeGenerationRequest; profile: RecoveryProfile },
  event: {
    provider: "remote" | "fallback";
    status: "ok" | "fallback";
    requestKind: string;
    challengeCount: number;
    premiumChallengeCount: number;
    reason?: string;
  }
) {
  await recordAiBackendEvent({
    route: "challenges",
    provider: event.provider,
    model: readServerAiProviderModel(),
    requestKind: event.requestKind,
    safetyEvalPassed: event.status === "ok" || event.provider === "fallback",
    redactionPassed: true,
    payloadSummary: {
      status: event.status,
      reasonCode: event.reason ? event.reason.split(/\s+/).slice(0, 6).join("-") : null,
      challengeCount: event.challengeCount,
      premiumChallengeCount: event.premiumChallengeCount,
      userPremium: sanitized.profile.premium,
      attemptsToday: sanitized.profile.attemptsToday,
      mood: sanitized.profile.mood,
      dayPart: sanitized.request.profile.dayPart,
      preferredCategoryCount: sanitized.request.profile.preferredCategories.length,
      recentChallengeHistoryCount: sanitized.request.recentChallengeHistory.length,
      hasRiskForecast: Boolean(sanitized.request.profile.riskForecast),
      hasContextSignals: Boolean(sanitized.request.profile.contextSignals),
      hasDisciplinePreferences: Boolean(sanitized.request.profile.disciplinePreferences),
      interventionSurface: sanitized.request.profile.interventionContext?.surface ?? null,
      interventionCategory: sanitized.request.profile.interventionContext?.category ?? null
    }
  }).catch(() => null);
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "challenges",
      request,
      limit: 30,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: backendRateLimitError(rateLimit, "Too many challenge requests."),
          status: rateLimit.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: CHALLENGE_BODY_LIMIT_BYTES,
      routeLabel: "Challenge generation"
    });
    if (!body.ok) {
      return json({ error: body.reason }, body.status);
    }

    const sanitized = sanitizeRequest(body.value);
    if (!sanitized) {
      return json({ error: "Invalid challenge generation request." }, 400);
    }

    try {
      const challenges = await createRemoteChallenges(sanitized.request, sanitized.profile);
      await recordChallengeAudit(sanitized, {
        provider: "remote",
        status: "ok",
        requestKind: "challenge-generation",
        challengeCount: challenges.length,
        premiumChallengeCount: challenges.filter((challenge) => challenge.premium).length
      });
      return json({ challenges, provider: "remote", status: "ok" });
    } catch (error) {
      const challenges = generateChallengeSet(sanitized.profile);
      const reason = sanitizeFallbackReason(error);
      await recordChallengeAudit(sanitized, {
        provider: "fallback",
        status: "fallback",
        requestKind: "challenge-fallback",
        challengeCount: challenges.length,
        premiumChallengeCount: challenges.filter((challenge) => challenge.premium).length,
        reason
      });
      return json({
        challenges,
        provider: "fallback",
        status: "fallback",
        reason
      });
    }
  } catch {
    return json({ error: "Malformed JSON body." }, 400);
  }
}
