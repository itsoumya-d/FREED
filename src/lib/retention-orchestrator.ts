import { redactCoachText } from "@/lib/ai-coach";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { getSmartReminderSuggestion } from "@/lib/recovery-reminders";
import { coarseRecoveryTriggerLabel } from "@/lib/recovery-signal-privacy";
import { generateWeeklyRecoveryReport, getLocalDateKey, type RecoveryState } from "@/lib/recovery-state";
import { fetchRemoteProviderJson } from "@/lib/remote-provider-timeout";
import { buildLocalUrgeRiskForecast, type UrgeRiskForecastConfidence, type UrgeRiskLevel } from "@/lib/urge-risk-forecast";

export type RetentionMode = "local" | "remote";
export type RetentionProvider = "local" | "remote" | "fallback";
export type RetentionStatus = "ok" | "fallback";

export type RetentionRequest = {
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
      level: UrgeRiskLevel;
      score: number;
      confidence: UrgeRiskForecastConfidence;
      currentWindow: string | null;
      drivers: string[];
    };
    enabledReminderKeys: Array<"morning" | "evening" | "guard">;
    smartGuardTime: string;
    smartGuardSource: "risk-window" | "slip-window" | "default";
    localDateKey: string;
    timezoneOffsetMinutes: number;
  };
  guardrails: string[];
};

export type RetentionPlan = {
  headline: string;
  nextBestAction: string;
  checkInPrompt: string;
  suggestedGuardTime: string | null;
  focusTags: string[];
  provider: RetentionProvider;
  status: RetentionStatus;
};

export type RemoteRetentionProvider = (request: RetentionRequest) => Promise<RetentionPlan>;

export type RetentionConfig = {
  mode: RetentionMode;
  endpointUrl: string | null;
  timeoutMs: number;
};

let remoteProvider: RemoteRetentionProvider | null = null;

export function configureRemoteRetentionProvider(provider: RemoteRetentionProvider | null) {
  remoteProvider = provider;
}

function readEnv(key: string): string | null {
  const value = process.env[key];
  if (!value || !value.trim()) return null;
  return value.trim();
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function clampDecimal(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value * 10) / 10)) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retentionSignalText(value: unknown, maxLength = 72): string | null {
  if (typeof value !== "string") return null;
  const cleaned = redactCoachText(value).slice(0, maxLength);
  if (!cleaned || /^no (clear pattern|slips|completions|protected risk)/i.test(cleaned)) return null;
  return cleaned;
}

function retentionOutputText(value: unknown, fallback: string, maxLength: number) {
  const cleaned = redactCoachText(typeof value === "string" ? value : "").slice(0, maxLength);
  return cleaned || fallback;
}

function retentionFocusTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const tags = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) =>
      redactCoachText(item)
        .replace(/[^a-zA-Z0-9 -]/g, "")
        .trim()
        .slice(0, 28)
    )
    .filter(Boolean)
    .slice(0, 4);

  return tags.length > 0 ? tags : ["check-in"];
}

function retentionDriverSignals(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => retentionSignalText(item, 56))
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

export function getRetentionConfig(options: { mode?: RetentionMode } = {}): RetentionConfig {
  const timeoutValue = Number.parseInt(readEnv("EXPO_PUBLIC_RETENTION_TIMEOUT_MS") ?? "", 10);
  return {
    mode: options.mode ?? (readEnv("EXPO_PUBLIC_RETENTION_MODE") === "remote" ? "remote" : "local"),
    endpointUrl: readEnv("EXPO_PUBLIC_RETENTION_ENDPOINT"),
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue >= 1_000 ? Math.min(timeoutValue, 12_000) : 7_000
  };
}

export function getRetentionReadiness(options: { mode?: RetentionMode } = {}) {
  const config = getRetentionConfig(options);
  const missing: string[] = [];
  if (config.mode === "remote" && !remoteProvider && !config.endpointUrl) {
    missing.push("remote retention provider or endpoint");
  }
  if (config.endpointUrl) {
    missing.push(...getProductionEndpointIssues(config.endpointUrl, "remote retention endpoint").map((issue) => issue.issue));
  }

  return {
    status: config.mode === "local" ? "local" : missing.length > 0 ? "missing-config" : "ready",
    mode: config.mode,
    missing
  };
}

export function buildRetentionRequest(
  state: RecoveryState,
  options: { day?: Date | string; timezoneOffsetMinutes?: number } = {}
): RetentionRequest {
  const day = options.day ?? new Date();
  const report = generateWeeklyRecoveryReport(state, day);
  const forecast = buildLocalUrgeRiskForecast(state, day);
  const smartGuard = getSmartReminderSuggestion(state);
  const enabledReminderKeys: RetentionRequest["profile"]["enabledReminderKeys"] = [];

  if (state.reminders.enabled && state.reminders.morningEnabled) enabledReminderKeys.push("morning");
  if (state.reminders.enabled && state.reminders.eveningEnabled) enabledReminderKeys.push("evening");
  if (state.reminders.enabled && state.reminders.guardEnabled) enabledReminderKeys.push("guard");

  return {
    profile: {
      premium: state.premium,
      streakDays: Math.max(0, Math.round(state.streakDays)),
      bestStreakDays: Math.max(0, Math.round(state.bestStreakDays)),
      attemptsThisWeek: report.attempts,
      slipsThisWeek: report.slips,
      checkInsThisWeek: report.checkIns,
      completedChallengesThisWeek: report.completedChallenges,
      averageUrge: report.averageUrge,
      averageSleep: report.averageSleep,
      steadyDays: report.steadyDays,
      riskWindow: retentionSignalText(report.riskWindow),
      slipWindow: report.slips > 0 ? retentionSignalText(report.slipWindow) : null,
      slipTrigger: report.slips > 0 ? coarseRecoveryTriggerLabel(report.slipTrigger) : null,
      bestIntervention: retentionSignalText(report.bestIntervention, 96),
      momentum: retentionSignalText(report.momentum) ?? "Needs more signal",
      urgeRiskForecast: {
        level: forecast.level,
        score: forecast.score,
        confidence: forecast.confidence,
        currentWindow: retentionSignalText(forecast.currentWindow),
        drivers: forecast.drivers.map((driver) => retentionSignalText(driver, 56)).filter((driver): driver is string => Boolean(driver)).slice(0, 4)
      },
      enabledReminderKeys,
      smartGuardTime: smartGuard.guardTime,
      smartGuardSource: smartGuard.source,
      localDateKey: getLocalDateKey(day),
      timezoneOffsetMinutes: options.timezoneOffsetMinutes ?? new Date().getTimezoneOffset()
    },
    guardrails: [
      "Use only aggregate recovery signals. Do not ask for private notes, browsing history, contacts, or transcripts.",
      "Stay calm, supportive, and non-judgmental.",
      "Return one concrete next best action that can be completed today.",
      "Prefer local reminders and self-directed recovery actions over pressure or guilt.",
      "Do not include raw URLs, domains, provider secrets, or sensitive personal details."
    ]
  };
}

export function sanitizeRetentionRequest(value: unknown): RetentionRequest | null {
  if (!isRecord(value) || !isRecord(value.profile)) return null;
  const profile = value.profile;
  const reminderKeys = Array.isArray(profile.enabledReminderKeys)
    ? profile.enabledReminderKeys.filter((key): key is "morning" | "evening" | "guard" => key === "morning" || key === "evening" || key === "guard").slice(0, 3)
    : [];
  const guardSource =
    profile.smartGuardSource === "risk-window" || profile.smartGuardSource === "slip-window" || profile.smartGuardSource === "default"
      ? profile.smartGuardSource
      : "default";
  const localDateKey = typeof profile.localDateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(profile.localDateKey) ? profile.localDateKey : getLocalDateKey(new Date());
  const smartGuardTime = typeof profile.smartGuardTime === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(profile.smartGuardTime) ? profile.smartGuardTime : "22:45";
  const forecast = isRecord(profile.urgeRiskForecast) ? profile.urgeRiskForecast : {};
  const forecastLevel =
    forecast.level === "high" || forecast.level === "elevated" || forecast.level === "low" ? forecast.level : "low";
  const forecastConfidence =
    forecast.confidence === "high" || forecast.confidence === "medium" || forecast.confidence === "low" ? forecast.confidence : "low";

  return {
    profile: {
      premium: Boolean(profile.premium),
      streakDays: clampNumber(profile.streakDays, 0, 0, 10_000),
      bestStreakDays: clampNumber(profile.bestStreakDays, 0, 0, 10_000),
      attemptsThisWeek: clampNumber(profile.attemptsThisWeek, 0, 0, 100),
      slipsThisWeek: clampNumber(profile.slipsThisWeek, 0, 0, 100),
      checkInsThisWeek: clampNumber(profile.checkInsThisWeek, 0, 0, 7),
      completedChallengesThisWeek: clampNumber(profile.completedChallengesThisWeek, 0, 0, 100),
      averageUrge: clampDecimal(profile.averageUrge, 0, 0, 5),
      averageSleep: clampDecimal(profile.averageSleep, 0, 0, 5),
      steadyDays: clampNumber(profile.steadyDays, 0, 0, 7),
      riskWindow: retentionSignalText(profile.riskWindow),
      slipWindow: clampNumber(profile.slipsThisWeek, 0, 0, 100) > 0 ? retentionSignalText(profile.slipWindow) : null,
      slipTrigger: clampNumber(profile.slipsThisWeek, 0, 0, 100) > 0 ? coarseRecoveryTriggerLabel(profile.slipTrigger) : null,
      bestIntervention: retentionSignalText(profile.bestIntervention, 96),
      momentum: retentionSignalText(profile.momentum) ?? "Needs more signal",
      urgeRiskForecast: {
        level: forecastLevel,
        score: clampNumber(forecast.score, 0, 0, 100),
        confidence: forecastConfidence,
        currentWindow: retentionSignalText(forecast.currentWindow),
        drivers: retentionDriverSignals(forecast.drivers)
      },
      enabledReminderKeys: reminderKeys,
      smartGuardTime,
      smartGuardSource: guardSource,
      localDateKey,
      timezoneOffsetMinutes: clampNumber(profile.timezoneOffsetMinutes, new Date().getTimezoneOffset(), -840, 840)
    },
    guardrails: [
      "Use only aggregate recovery signals. Do not ask for private notes, browsing history, contacts, or transcripts.",
      "Stay calm, supportive, and non-judgmental.",
      "Return one concrete next best action that can be completed today.",
      "Prefer local reminders and self-directed recovery actions over pressure or guilt.",
      "Do not include raw URLs, domains, provider secrets, or sensitive personal details."
    ]
  };
}

export function normalizeRetentionPlan(value: unknown, fallback: RetentionPlan): RetentionPlan {
  if (!isRecord(value)) return fallback;
  const suggestedGuardTime =
    typeof value.suggestedGuardTime === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.suggestedGuardTime)
      ? value.suggestedGuardTime
      : fallback.suggestedGuardTime;

  return {
    headline: retentionOutputText(value.headline, fallback.headline, 90),
    nextBestAction: retentionOutputText(value.nextBestAction, fallback.nextBestAction, 180),
    checkInPrompt: retentionOutputText(value.checkInPrompt, fallback.checkInPrompt, 140),
    suggestedGuardTime,
    focusTags: retentionFocusTags(value.focusTags),
    provider: value.provider === "remote" ? "remote" : fallback.provider,
    status: value.status === "ok" ? "ok" : fallback.status
  };
}

export function createLocalRetentionPlan(request: RetentionRequest): RetentionPlan {
  const profile = request.profile;
  const forecast = profile.urgeRiskForecast;
  const suggestedGuardTime = profile.smartGuardSource === "default" ? null : profile.smartGuardTime;
  const base: RetentionPlan = {
    headline: profile.streakDays > 0 ? `${profile.streakDays} clean days. Protect the next one.` : "Start with the next clean hour.",
    nextBestAction: "Do one honest check-in and keep the phone out of the highest-risk room tonight.",
    checkInPrompt: "What is the smallest action that would make the next hour easier?",
    suggestedGuardTime,
    focusTags: ["check-in", "phone boundary"],
    provider: "local",
    status: "ok"
  };

  if (profile.slipsThisWeek > 0) {
    return {
      ...base,
      headline: "Use the pattern without judging yourself.",
      nextBestAction: `Before ${profile.slipWindow?.toLowerCase() ?? "the next risk window"}, move the phone out of reach and start a two-minute reset.`,
      checkInPrompt: `When ${profile.slipTrigger?.toLowerCase() ?? "the trigger"} shows up, what is the first safer move?`,
      focusTags: ["slip pattern", "early friction", "reset"]
    };
  }

  if (forecast.level === "high") {
    return {
      ...base,
      headline: "Protect the next hour before it gets loud.",
      nextBestAction: `Start a body-first reset now${forecast.currentWindow ? ` during ${forecast.currentWindow.toLowerCase()}` : ""}, then keep the next unlock off until the urge drops.`,
      checkInPrompt: forecast.drivers[0] ? `What is one safer move for "${forecast.drivers[0].toLowerCase()}"?` : "What is one safer move before the urge peaks?",
      focusTags: ["risk forecast", "body reset", "phone boundary"]
    };
  }

  if (forecast.level === "elevated" && forecast.confidence !== "low") {
    return {
      ...base,
      headline: "Add friction before the pattern builds.",
      nextBestAction: `Before ${forecast.currentWindow?.toLowerCase() ?? profile.riskWindow?.toLowerCase() ?? "the next risk window"}, move the phone out of reach and complete one short reset.`,
      checkInPrompt: "What small barrier would make the next risky tap less automatic?",
      focusTags: ["forecast", "early friction", "reset"]
    };
  }

  if (profile.averageSleep > 0 && profile.averageSleep <= 2.5) {
    return {
      ...base,
      headline: "Sleep is the recovery lever today.",
      nextBestAction: "Set a low-stimulation cutoff tonight and put the phone outside arm's reach before bed.",
      checkInPrompt: "What would make sleep 10 percent easier tonight?",
      focusTags: ["sleep", "night guard", "phone boundary"]
    };
  }

  if (profile.attemptsThisWeek >= 3 || profile.averageUrge >= 4) {
    return {
      ...base,
      headline: "Act before the urge peaks.",
      nextBestAction: `Schedule a body-first reset before ${profile.riskWindow?.toLowerCase() ?? "your usual risk window"}.`,
      checkInPrompt: "Where can you add friction before the urge gets loud?",
      focusTags: ["risk window", "movement", "friction"]
    };
  }

  if (profile.checkInsThisWeek < 3) {
    return {
      ...base,
      headline: "More signal makes FREED smarter.",
      nextBestAction: "Complete one mood, urge, and sleep check-in before the day gets busy.",
      checkInPrompt: "Name your mood, urge level, and one thing that would lower stimulation.",
      focusTags: ["check-in", "pattern signal"]
    };
  }

  if (profile.completedChallengesThisWeek > 0 && profile.bestIntervention) {
    return {
      ...base,
      headline: "Repeat what already works.",
      nextBestAction: `Reuse "${profile.bestIntervention}" today instead of inventing a new plan.`,
      checkInPrompt: "What made that reset easier to start last time?",
      focusTags: ["repeat win", "momentum"]
    };
  }

  return base;
}

async function fetchRemoteRetentionPlan(request: RetentionRequest, config: RetentionConfig, fallback: RetentionPlan): Promise<RetentionPlan> {
  if (!config.endpointUrl) {
    throw new Error("Remote retention endpoint is not configured.");
  }
  const endpointIssues = getProductionEndpointIssues(config.endpointUrl, "remote retention endpoint");
  if (endpointIssues.length > 0) {
    throw new Error(endpointIssues.map((issue) => issue.issue).join("; "));
  }

  const payload = await fetchRemoteProviderJson(
    config.endpointUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    config.timeoutMs,
    "Remote retention request"
  );
  return normalizeRetentionPlan(payload, { ...fallback, provider: "remote", status: "ok" });
}

export async function generateRetentionPlan(
  state: RecoveryState,
  options: { mode?: RetentionMode; day?: Date | string; timezoneOffsetMinutes?: number } = {}
): Promise<RetentionPlan> {
  const config = getRetentionConfig({ mode: options.mode });
  const request = buildRetentionRequest(state, options);
  const localPlan = createLocalRetentionPlan(request);

  if (config.mode === "local") return localPlan;

  try {
    if (remoteProvider) {
      return normalizeRetentionPlan(await remoteProvider(request), { ...localPlan, provider: "remote", status: "ok" });
    }

    return await fetchRemoteRetentionPlan(request, config, localPlan);
  } catch {
    return {
      ...localPlan,
      provider: "fallback",
      status: "fallback"
    };
  }
}
