import { BlockingAttempt, normalizeHost, redactUrlForStorage } from "@/lib/blocking-engine";
import {
  DOOMSCROLL_APP_OPTIONS,
  expandDoomscrollAppPackages,
  isShortFormRuleId,
  normalizeDoomscrollAppPackage
} from "@/lib/doomscroll-apps";
import type { PremiumPlanAudience, PremiumPlanId } from "@/lib/monetization";
import { ChallengeOutcome, ChallengePreferenceSignal, RecoveryChallenge } from "@/lib/recovery-engine";

export {
  DOOMSCROLL_APP_OPTIONS,
  DEFAULT_SHORT_FORM_WEB_URL,
  INSTAGRAM_ANDROID_PACKAGE,
  INSTAGRAM_REELS_RULE,
  SHORT_FORM_RULE_HOSTS,
  SHORT_FORM_RULE_PACKAGES,
  SAFARI_SHORT_FORM_WEB_RULE_FILTERS,
  SUPPORTED_DOOMSCROLL_APP_PACKAGES,
  TIKTOK_FEED_RULE,
  TIKTOK_ANDROID_PACKAGES,
  TIKTOK_PRIMARY_ANDROID_PACKAGE,
  YOUTUBE_ANDROID_PACKAGE,
  YOUTUBE_SHORTS_RULE,
  expandDoomscrollAppPackages,
  hostForShortFormRule,
  packageForShortFormRule,
  surfaceForDoomscrollAppPackage
} from "@/lib/doomscroll-apps";

export const RECOVERY_STATE_VERSION = 1;
export const MAX_EARNED_UNLOCK_MINUTES = 120;

export type ChallengeCompletion = {
  id: string;
  title: string;
  category: RecoveryChallenge["category"];
  outcome: ChallengeOutcome;
  completedAt: string;
  durationSec: number;
  premium: boolean;
  sourceAttemptHost?: string;
};

export type CustomChallengeInput = {
  title: string;
  category: RecoveryChallenge["category"];
  intensity: RecoveryChallenge["intensity"];
  durationSec: number;
  why: string;
  steps: string[];
};

export type MoodLevel = "low" | "steady" | "energized" | "stressed";

export type DailyCheckIn = {
  id: string;
  dateKey: string;
  mood: MoodLevel;
  urgeLevel: number;
  sleepQuality: number;
  reflection: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyCheckInInput = {
  mood: MoodLevel;
  urgeLevel: number;
  sleepQuality: number;
  reflection?: string;
};

export type DailyHabitKey =
  | "adult-content-boundary"
  | "cold-shower"
  | "exercise"
  | "meditation"
  | "journal"
  | "social-media-boundary";

export type DailyHabitCompletion = {
  key: DailyHabitKey;
  label: string;
  dateKey: string;
  completed: boolean;
  updatedAt: string;
};

export type RelapseRecord = {
  id: string;
  occurredAt: string;
  previousStreakDays: number;
  note: string;
  trigger?: string;
};

export type RelapseRecordInput = {
  note?: string;
  trigger?: string;
};

export type CheckInSummary = {
  total: number;
  averageUrge: number;
  averageSleep: number;
  steadyDays: number;
  latest: DailyCheckIn | null;
};

export type WeeklyRecoveryReport = {
  rangeLabel: string;
  attempts: number;
  slips: number;
  completedChallenges: number;
  checkIns: number;
  averageUrge: number;
  averageSleep: number;
  steadyDays: number;
  riskWindow: string;
  slipWindow: string;
  slipTrigger: string;
  bestIntervention: string;
  momentum: string;
  strongestPattern: string;
  nextFocus: string;
  wins: string[];
};

export type MonthlyGrowthReport = {
  rangeLabel: string;
  protectedMoments: number;
  appInterventions: number;
  selfReportedUrges: number;
  completedChallenges: number;
  helpfulChallenges: number;
  slips: number;
  checkIns: number;
  averageUrge: number;
  averageSleep: number;
  steadyDays: number;
  riskWindow: string;
  slipWindow: string;
  slipTrigger: string;
  bestIntervention: string;
  growthScore: number;
  summary: string;
  nextExperiment: string;
  wins: string[];
};

export type RecoveryLevel = {
  xp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
};

export type RecoveryMilestone = {
  title: string;
  detail: string;
  currentDays: number;
  targetDays: number;
  progress: number;
  achieved: boolean;
};

export type AchievementBadge = {
  id: string;
  title: string;
  detail: string;
  earned: boolean;
  progress: number;
  target: number;
};

export type ReminderPermissionStatus = "unknown" | "granted" | "denied" | "unavailable";

export type ReminderPreferences = {
  enabled: boolean;
  morningEnabled: boolean;
  eveningEnabled: boolean;
  guardEnabled: boolean;
  morningTime: string;
  eveningTime: string;
  guardTime: string;
  scheduledIds: string[];
  permissionStatus: ReminderPermissionStatus;
  statusMessage: string;
  updatedAt: string | null;
  lastScheduledAt: string | null;
};

export type AccountabilityMethod = "sms" | "email";

export type AccountabilityPartner = {
  enabled: boolean;
  name: string;
  method: AccountabilityMethod;
  contact: string;
  messageTemplate: string;
  updatedAt: string | null;
  lastContactedAt: string | null;
};

export type SupportCircleRole = "family" | "sponsor" | "friend" | "partner";

export type SupportCircleMember = {
  id: string;
  enabled: boolean;
  name: string;
  role: SupportCircleRole;
  method: AccountabilityMethod;
  contact: string;
  updatedAt: string | null;
  lastContactedAt: string | null;
};

export type ChallengeIntensityPreference = "gentle" | "balanced" | "strong";
export type DisciplineFrequencyPreference = "low" | "balanced" | "high";
export type SocialChallengeFrequencyPreference = "off" | "low" | "balanced" | "high";

export type DisciplineSettings = {
  dailyLimitMinutes: number;
  shortFormInterruptionSeconds: number;
  unlockDurationMinutes: number;
  challengeIntensity: ChallengeIntensityPreference;
  outdoorChallengeFrequency: DisciplineFrequencyPreference;
  exercisePreference: DisciplineFrequencyPreference;
  socialChallengeFrequency: SocialChallengeFrequencyPreference;
  blockedAppPackages: string[];
  emergencyStrictMode: boolean;
  sleepModeEnabled: boolean;
  sleepStartTime: string;
  sleepEndTime: string;
  deepFocusModeEnabled: boolean;
  workHoursEnabled: boolean;
  workStartTime: string;
  workEndTime: string;
  weekendModeEnabled: boolean;
  updatedAt: string | null;
};

export type EarnedUnlock = {
  id: string;
  startedAt: string;
  expiresAt: string;
  durationMinutes: number;
  sourceChallengeId: string;
  sourceAttemptHost?: string;
};

export type AppUsageSession = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  durationSec: number;
};

export type AnalyticsSharingSettings = {
  enabled: boolean;
  userOptedInAt: string | null;
  consentVersion: string | null;
  endpointUrl: string | null;
  aggregateOnlySharing: boolean;
  privateNotesAllowed: boolean;
  browsingDataAllowed: boolean;
  supportContactSharingAllowed: boolean;
  dataRetentionDays: number;
  lastSentAt: string | null;
  lastSendStatus: "never" | "blocked" | "ok" | "unconfigured" | "invalid" | "error";
  lastSendMessage: string | null;
  updatedAt: string | null;
};

export type ProtectionActivationPlatform = "ios" | "android" | "web-preview";

export type RecoveryState = {
  version: typeof RECOVERY_STATE_VERSION;
  premium: boolean;
  premiumPlanId: PremiumPlanId | null;
  premiumPlanAudience: PremiumPlanAudience | null;
  premiumActivatedAt: string | null;
  recoveryStartedAt: string | null;
  streakDays: number;
  bestStreakDays: number;
  completedChallenges: number;
  attempts: BlockingAttempt[];
  challengeHistory: ChallengeCompletion[];
  customChallenges: RecoveryChallenge[];
  dailyCheckIns: DailyCheckIn[];
  dailyHabits: DailyHabitCompletion[];
  relapseRecords: RelapseRecord[];
  reminders: ReminderPreferences;
  accountability: AccountabilityPartner;
  supportCircle: SupportCircleMember[];
  disciplineSettings: DisciplineSettings;
  earnedUnlocks: EarnedUnlock[];
  appSessions: AppUsageSession[];
  analyticsSharing: AnalyticsSharingSettings;
  answers: string[];
  hasCompletedOnboarding: boolean;
  onboardingPaywallPresentedAt: string | null;
  protectionActivatedAt: string | null;
  protectionActivationPlatform: ProtectionActivationPlatform | null;
  lastOpenedAt: string | null;
  lastProtectedAt: string | null;
};

export function createDefaultReminderPreferences(): ReminderPreferences {
  return {
    enabled: false,
    morningEnabled: true,
    eveningEnabled: true,
    guardEnabled: true,
    morningTime: "08:30",
    eveningTime: "21:00",
    guardTime: "22:45",
    scheduledIds: [],
    permissionStatus: "unknown",
    statusMessage: "Recovery reminders are off.",
    updatedAt: null,
    lastScheduledAt: null
  };
}

export function createDefaultAccountabilityPartner(): AccountabilityPartner {
  return {
    enabled: false,
    name: "",
    method: "sms",
    contact: "",
    messageTemplate:
      "I hit a risk moment and need a quick reset. Can you check in with me? My FREED streak is {streak} days.",
    updatedAt: null,
    lastContactedAt: null
  };
}

export function createDefaultDisciplineSettings(): DisciplineSettings {
  return {
    dailyLimitMinutes: 30,
    shortFormInterruptionSeconds: 90,
    unlockDurationMinutes: 10,
    challengeIntensity: "balanced",
    outdoorChallengeFrequency: "balanced",
    exercisePreference: "balanced",
    socialChallengeFrequency: "low",
    blockedAppPackages: [],
    emergencyStrictMode: false,
    sleepModeEnabled: true,
    sleepStartTime: "22:30",
    sleepEndTime: "06:30",
    deepFocusModeEnabled: false,
    workHoursEnabled: false,
    workStartTime: "09:00",
    workEndTime: "17:00",
    weekendModeEnabled: true,
    updatedAt: null
  };
}

export function createDefaultAnalyticsSharingSettings(): AnalyticsSharingSettings {
  return {
    enabled: false,
    userOptedInAt: null,
    consentVersion: null,
    endpointUrl: null,
    aggregateOnlySharing: true,
    privateNotesAllowed: false,
    browsingDataAllowed: false,
    supportContactSharingAllowed: false,
    dataRetentionDays: 0,
    lastSentAt: null,
    lastSendStatus: "never",
    lastSendMessage: null,
    updatedAt: null
  };
}

export function createDefaultRecoveryState(): RecoveryState {
  return {
    version: RECOVERY_STATE_VERSION,
    premium: false,
    premiumPlanId: null,
    premiumPlanAudience: null,
    premiumActivatedAt: null,
    recoveryStartedAt: null,
    streakDays: 0,
    bestStreakDays: 0,
    completedChallenges: 0,
    attempts: [],
    challengeHistory: [],
    customChallenges: [],
    dailyCheckIns: [],
    dailyHabits: [],
    relapseRecords: [],
    reminders: createDefaultReminderPreferences(),
    accountability: createDefaultAccountabilityPartner(),
    supportCircle: [],
    disciplineSettings: createDefaultDisciplineSettings(),
    earnedUnlocks: [],
    appSessions: [],
    analyticsSharing: createDefaultAnalyticsSharingSettings(),
    answers: [],
    hasCompletedOnboarding: false,
    onboardingPaywallPresentedAt: null,
    protectionActivatedAt: null,
    protectionActivationPlatform: null,
    lastOpenedAt: null,
    lastProtectedAt: null
  };
}

const dailyHabitKeys: DailyHabitKey[] = [
  "adult-content-boundary",
  "cold-shower",
  "exercise",
  "meditation",
  "journal",
  "social-media-boundary"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const premiumPlanAudiences: Record<PremiumPlanId, PremiumPlanAudience> = {
  yearly: "individual",
  monthly: "individual",
  lifetime: "individual",
  family: "family",
  accountability: "accountability",
  "ai-coach": "coaching"
};

function sanitizePremiumPlanId(value: unknown): PremiumPlanId | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(premiumPlanAudiences, value) ? (value as PremiumPlanId) : null;
}

function premiumAudienceForPlan(planId: PremiumPlanId | null): PremiumPlanAudience | null {
  return planId ? premiumPlanAudiences[planId] : null;
}

function validIso(value: unknown) {
  if (typeof value !== "string") return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function sanitizeProtectionActivationPlatform(value: unknown): ProtectionActivationPlatform | null {
  return value === "ios" || value === "android" || value === "web-preview" ? value : null;
}

function sanitizeAttempt(value: unknown): BlockingAttempt | null {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  if (typeof value.url !== "string" || typeof value.host !== "string" || typeof value.detectedAt !== "string") return null;
  const source = String(value.source) === "test-lab" ? "manual-check" : String(value.source);
  if (!["browser", "search", "manual-check", "panic-button", "app"].includes(source)) return null;
  if (!["allow", "block", "review"].includes(String(value.result.verdict))) return null;
  const sourcePackage = source === "app" ? sanitizeSourcePackage(value.sourcePackage) : undefined;
  const sessionDurationSec = source === "app" ? sanitizeAttemptSessionDuration(value.sessionDurationSec) : undefined;
  const host = sanitizeStoredAttemptHost(value.host, value.url, value.result.host);
  const category = ["adult", "adult-search-intent", "known-safe", "unknown"].includes(String(value.result.category))
    ? (value.result.category as BlockingAttempt["result"]["category"])
    : "unknown";

  return {
    url: redactUrlForStorage(value.url),
    detectedAt: validIso(value.detectedAt) ?? new Date(0).toISOString(),
    source: source as BlockingAttempt["source"],
    host,
    ...(sourcePackage ? { sourcePackage } : {}),
    ...(sessionDurationSec ? { sessionDurationSec } : {}),
    result: {
      verdict: value.result.verdict as BlockingAttempt["result"]["verdict"],
      confidence: clampUnit(value.result.confidence),
      host,
      category,
      reason: sanitizeAttemptReason(value.result.reason),
      matchedRule: sanitizeAttemptMatchedRule(value.result.matchedRule)
    }
  };
}

function clampUnit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function sanitizeAttemptReason(value: unknown) {
  if (typeof value !== "string") return "Protection recorded this risk moment.";
  const cleaned = value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(
      /\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn|example|test|invalid|local)(?:\/[^\s]*)?/gi,
      "[redacted-domain]"
    )
    .replace(/\b(?:token|secret|password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key)=\S+/gi, "[redacted-secret]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return cleaned || "Protection recorded this risk moment.";
}

function sanitizeAttemptMatchedRule(value: unknown) {
  if (typeof value !== "string") return "unknown-rule";
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(
      /\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn|example|test|invalid|local)(?:\/[^\s]*)?/gi,
      "[redacted-domain]"
    )
    .replace(/\b(?:token|secret|password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key)=\S+/gi, "[redacted-secret]")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9:._[\]-]/g, "")
    .slice(0, 140);

  return cleaned || "unknown-rule";
}

function sanitizeAttemptSessionDuration(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const durationSec = Math.round(value);
  if (durationSec <= 0) return undefined;
  return Math.min(durationSec, 4 * 60 * 60);
}

function sanitizeStoredAttemptHost(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const host = normalizeHost(value);
    if (host) return host;
  }
  return "redacted.freed.local";
}

function sanitizeSourcePackage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");

  return /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(normalized) ? normalized.slice(0, 120) : undefined;
}

function sanitizeSourceAttemptHost(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const rawLower = raw.toLowerCase();
  if (isShortFormRuleId(rawLower)) return rawLower;

  const withoutRulePrefix = raw.replace(/^(configured-app|short-form):/i, "").trim().toLowerCase();
  if (!withoutRulePrefix.startsWith("www.") && !/[/:?#]/.test(withoutRulePrefix) && /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(withoutRulePrefix)) {
    return withoutRulePrefix.slice(0, 120);
  }

  let host = withoutRulePrefix;
  if (/^https?:\/\//i.test(withoutRulePrefix)) {
    try {
      host = new URL(withoutRulePrefix).hostname;
    } catch {
      host = withoutRulePrefix;
    }
  }
  if (host === withoutRulePrefix) {
    host = withoutRulePrefix
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0];
    if (!host.startsWith("[") && host.includes(":")) {
      host = host.split(":")[0] ?? host;
    }
  }

  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);

  if (!normalized.includes(".")) return undefined;
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized)) return undefined;
  if (normalized.split(".").some((part) => !part || part.startsWith("-") || part.endsWith("-"))) return undefined;
  return normalized;
}

function sanitizeCompletion(value: unknown): ChallengeCompletion | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (!["physical", "breathing", "reflection", "connection", "reset"].includes(String(value.category))) return null;

  return {
    id: value.id,
    title: value.title,
    category: value.category as ChallengeCompletion["category"],
    outcome: value.outcome === "still-urging" ? "still-urging" : "helped",
    completedAt: validIso(value.completedAt) ?? new Date(0).toISOString(),
    durationSec: Math.max(0, finiteNumber(value.durationSec, 0)),
    premium: Boolean(value.premium),
    sourceAttemptHost: sanitizeSourceAttemptHost(value.sourceAttemptHost)
  };
}

function sanitizeChallengeCategory(value: unknown, fallback: RecoveryChallenge["category"] = "reset"): RecoveryChallenge["category"] {
  return ["physical", "breathing", "reflection", "connection", "reset"].includes(String(value))
    ? (value as RecoveryChallenge["category"])
    : fallback;
}

function sanitizeChallengeIntensity(value: unknown, fallback: RecoveryChallenge["intensity"] = "medium"): RecoveryChallenge["intensity"] {
  return ["calm", "medium", "strong"].includes(String(value)) ? (value as RecoveryChallenge["intensity"]) : fallback;
}

function iconForChallengeCategory(category: RecoveryChallenge["category"]) {
  if (category === "physical") return "Dumbbell";
  if (category === "breathing") return "Waves";
  if (category === "reflection") return "NotebookPen";
  if (category === "connection") return "MessageCircleHeart";
  return "Footprints";
}

function sanitizeCustomChallenge(value: unknown): RecoveryChallenge | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim().replace(/\s+/g, " ").slice(0, 72) : "";
  if (title.length < 4) return null;
  const category = sanitizeChallengeCategory(value.category);
  const intensity = sanitizeChallengeIntensity(value.intensity);
  const steps = Array.isArray(value.steps)
    ? value.steps
        .filter((step): step is string => typeof step === "string")
        .map((step) => step.trim().replace(/\s+/g, " ").slice(0, 96))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    id:
      typeof value.id === "string" && /^custom-[a-z0-9-]{4,96}$/i.test(value.id)
        ? value.id.toLowerCase()
        : `custom-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "reset"}`,
    title,
    category,
    durationSec: clampInteger(value.durationSec, 120, 30, 900),
    intensity,
    premium: true,
    icon: typeof value.icon === "string" && Object.values({
      physical: "Dumbbell",
      breathing: "Waves",
      reflection: "NotebookPen",
      connection: "MessageCircleHeart",
      reset: "Footprints"
    }).includes(value.icon)
      ? value.icon
      : iconForChallengeCategory(category),
    steps: steps.length > 0 ? steps : ["Start the reset.", "Stay present.", "Finish the action honestly."],
    why:
      typeof value.why === "string" && value.why.trim().length > 0
        ? value.why.trim().replace(/\s+/g, " ").slice(0, 180)
        : "This is a user-created recovery reset for moments when a familiar action works best."
  };
}

function sanitizeCheckIn(value: unknown): DailyCheckIn | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.dateKey !== "string") return null;
  if (!["low", "steady", "energized", "stressed"].includes(String(value.mood))) return null;

  return {
    id: value.id,
    dateKey: value.dateKey,
    mood: value.mood as MoodLevel,
    urgeLevel: Math.min(5, Math.max(0, Math.round(finiteNumber(value.urgeLevel, 0)))),
    sleepQuality: Math.min(5, Math.max(1, Math.round(finiteNumber(value.sleepQuality, 3)))),
    reflection: typeof value.reflection === "string" ? value.reflection.slice(0, 500) : "",
    createdAt: validIso(value.createdAt) ?? new Date(0).toISOString(),
    updatedAt: validIso(value.updatedAt) ?? validIso(value.createdAt) ?? new Date(0).toISOString()
  };
}

function sanitizeHabitCompletion(value: unknown): DailyHabitCompletion | null {
  if (!isRecord(value)) return null;
  if (!dailyHabitKeys.includes(value.key as DailyHabitKey)) return null;
  if (typeof value.dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)) return null;

  return {
    key: value.key as DailyHabitKey,
    label: typeof value.label === "string" && value.label.trim().length > 0 ? value.label.trim().slice(0, 48) : "Recovery habit",
    dateKey: value.dateKey,
    completed: Boolean(value.completed),
    updatedAt: validIso(value.updatedAt) ?? new Date(0).toISOString()
  };
}

function sanitizeRelapseRecord(value: unknown): RelapseRecord | null {
  if (!isRecord(value)) return null;
  const occurredAt = validIso(value.occurredAt);
  if (!occurredAt) return null;
  const parsedAt = Date.parse(occurredAt);
  const id = typeof value.id === "string" && value.id.trim().length > 0 ? value.id.trim().slice(0, 80) : `slip-${parsedAt}`;
  const trigger = typeof value.trigger === "string" ? value.trigger.trim().slice(0, 64) : "";

  return {
    id,
    occurredAt,
    previousStreakDays: Math.max(0, Math.round(finiteNumber(value.previousStreakDays, 0))),
    note: typeof value.note === "string" ? value.note.trim().slice(0, 500) : "",
    trigger: trigger.length > 0 ? trigger : undefined
  };
}

function sanitizeReminderPreferences(value: unknown): ReminderPreferences {
  const fallback = createDefaultReminderPreferences();
  if (!isRecord(value)) return fallback;
  const permissionStatus = ["unknown", "granted", "denied", "unavailable"].includes(String(value.permissionStatus))
    ? (value.permissionStatus as ReminderPermissionStatus)
    : fallback.permissionStatus;

  return {
    enabled: Boolean(value.enabled),
    morningEnabled: typeof value.morningEnabled === "boolean" ? value.morningEnabled : fallback.morningEnabled,
    eveningEnabled: typeof value.eveningEnabled === "boolean" ? value.eveningEnabled : fallback.eveningEnabled,
    guardEnabled: typeof value.guardEnabled === "boolean" ? value.guardEnabled : fallback.guardEnabled,
    morningTime: sanitizeClockTime(value.morningTime, fallback.morningTime),
    eveningTime: sanitizeClockTime(value.eveningTime, fallback.eveningTime),
    guardTime: sanitizeClockTime(value.guardTime, fallback.guardTime),
    scheduledIds: Array.isArray(value.scheduledIds) ? value.scheduledIds.filter((id): id is string => typeof id === "string").slice(0, 8) : [],
    permissionStatus,
    statusMessage: typeof value.statusMessage === "string" ? value.statusMessage.slice(0, 180) : fallback.statusMessage,
    updatedAt: validIso(value.updatedAt),
    lastScheduledAt: validIso(value.lastScheduledAt)
  };
}

function sanitizeAccountabilityPartner(value: unknown): AccountabilityPartner {
  const fallback = createDefaultAccountabilityPartner();
  if (!isRecord(value)) return fallback;
  const method = value.method === "email" || value.method === "sms" ? value.method : fallback.method;
  const messageTemplate =
    typeof value.messageTemplate === "string" && value.messageTemplate.trim().length > 0
      ? value.messageTemplate.trim().slice(0, 260)
      : fallback.messageTemplate;

  return {
    enabled: Boolean(value.enabled),
    name: typeof value.name === "string" ? value.name.trim().slice(0, 48) : fallback.name,
    method,
    contact: typeof value.contact === "string" ? value.contact.trim().slice(0, 120) : fallback.contact,
    messageTemplate,
    updatedAt: validIso(value.updatedAt),
    lastContactedAt: validIso(value.lastContactedAt)
  };
}

function sanitizeSupportCircleMember(value: unknown): SupportCircleMember | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 48) : "";
  const contact = typeof value.contact === "string" ? value.contact.trim().slice(0, 120) : "";
  if (!name && !contact) return null;
  const method = value.method === "email" || value.method === "sms" ? value.method : "sms";
  const role = ["family", "sponsor", "friend", "partner"].includes(String(value.role))
    ? (value.role as SupportCircleRole)
    : "family";
  const fallbackSlug = (name || contact || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  const fallbackIdSlug = fallbackSlug.length >= 4 ? fallbackSlug : `${fallbackSlug || "member"}-member`;
  const id =
    typeof value.id === "string" && /^support-[a-z0-9-]{4,96}$/i.test(value.id)
      ? value.id.toLowerCase()
      : `support-${fallbackIdSlug}`;

  return {
    id,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    name,
    role,
    method,
    contact,
    updatedAt: validIso(value.updatedAt),
    lastContactedAt: validIso(value.lastContactedAt)
  };
}

function sanitizeClockTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(finiteNumber(value, fallback))));
}

function sanitizeBlockedAppPackages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeDoomscrollAppPackage)
    .filter((item): item is string => Boolean(item))
    .filter((primaryPackage) => {
      if (seen.has(primaryPackage)) return false;
      seen.add(primaryPackage);
      return true;
    });
}

function sanitizeDisciplineSettings(value: unknown): DisciplineSettings {
  const fallback = createDefaultDisciplineSettings();
  if (!isRecord(value)) return fallback;
  const challengeIntensity = ["gentle", "balanced", "strong"].includes(String(value.challengeIntensity))
    ? (value.challengeIntensity as ChallengeIntensityPreference)
    : fallback.challengeIntensity;
  const outdoorChallengeFrequency = ["low", "balanced", "high"].includes(String(value.outdoorChallengeFrequency))
    ? (value.outdoorChallengeFrequency as DisciplineFrequencyPreference)
    : fallback.outdoorChallengeFrequency;
  const exercisePreference = ["low", "balanced", "high"].includes(String(value.exercisePreference))
    ? (value.exercisePreference as DisciplineFrequencyPreference)
    : fallback.exercisePreference;
  const socialChallengeFrequency = ["off", "low", "balanced", "high"].includes(String(value.socialChallengeFrequency))
    ? (value.socialChallengeFrequency as SocialChallengeFrequencyPreference)
    : fallback.socialChallengeFrequency;

  return {
    dailyLimitMinutes: clampInteger(value.dailyLimitMinutes, fallback.dailyLimitMinutes, 5, 240),
    shortFormInterruptionSeconds: clampInteger(
      value.shortFormInterruptionSeconds,
      fallback.shortFormInterruptionSeconds,
      30,
      300
    ),
    unlockDurationMinutes: clampInteger(value.unlockDurationMinutes, fallback.unlockDurationMinutes, 5, 60),
    challengeIntensity,
    outdoorChallengeFrequency,
    exercisePreference,
    socialChallengeFrequency,
    blockedAppPackages: sanitizeBlockedAppPackages(value.blockedAppPackages),
    emergencyStrictMode: Boolean(value.emergencyStrictMode),
    sleepModeEnabled: typeof value.sleepModeEnabled === "boolean" ? value.sleepModeEnabled : fallback.sleepModeEnabled,
    sleepStartTime: sanitizeClockTime(value.sleepStartTime, fallback.sleepStartTime),
    sleepEndTime: sanitizeClockTime(value.sleepEndTime, fallback.sleepEndTime),
    deepFocusModeEnabled: Boolean(value.deepFocusModeEnabled),
    workHoursEnabled: Boolean(value.workHoursEnabled),
    workStartTime: sanitizeClockTime(value.workStartTime, fallback.workStartTime),
    workEndTime: sanitizeClockTime(value.workEndTime, fallback.workEndTime),
    weekendModeEnabled: typeof value.weekendModeEnabled === "boolean" ? value.weekendModeEnabled : fallback.weekendModeEnabled,
    updatedAt: validIso(value.updatedAt)
  };
}

function sanitizeEarnedUnlock(value: unknown): EarnedUnlock | null {
  if (!isRecord(value)) return null;
  const startedAt = validIso(value.startedAt);
  const expiresAt = validIso(value.expiresAt);
  const startedMs = startedAt ? Date.parse(startedAt) : NaN;
  const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!startedAt || !expiresAt || !Number.isFinite(startedMs) || !Number.isFinite(expiresMs) || expiresMs <= startedMs) {
    return null;
  }
  const actualDurationMinutes = Math.ceil((expiresMs - startedMs) / 60_000);
  const durationMinutes = Math.min(
    clampInteger(value.durationMinutes, actualDurationMinutes, 1, MAX_EARNED_UNLOCK_MINUTES),
    actualDurationMinutes,
    MAX_EARNED_UNLOCK_MINUTES
  );
  const boundedExpiresAt = new Date(startedMs + durationMinutes * 60_000).toISOString();
  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim().slice(0, 96)
      : `unlock-${Date.parse(startedAt)}`;
  const sourceChallengeId =
    typeof value.sourceChallengeId === "string" && value.sourceChallengeId.trim().length > 0
      ? value.sourceChallengeId.trim().slice(0, 96)
      : "unknown-challenge";

  return {
    id,
    startedAt,
    expiresAt: boundedExpiresAt,
    durationMinutes,
    sourceChallengeId,
    sourceAttemptHost: sanitizeSourceAttemptHost(value.sourceAttemptHost)
  };
}

function sanitizeAppUsageSession(value: unknown): AppUsageSession | null {
  if (!isRecord(value)) return null;
  const openedAt = validIso(value.openedAt);
  if (!openedAt) return null;
  const closedAt = validIso(value.closedAt);
  const openedMs = Date.parse(openedAt);
  const closedMs = closedAt ? Date.parse(closedAt) : null;
  const measuredDuration = closedMs && closedMs > openedMs ? Math.round((closedMs - openedMs) / 1000) : 0;
  const durationSec = Math.max(0, Math.min(86_400, Math.round(finiteNumber(value.durationSec, measuredDuration))));

  return {
    id: typeof value.id === "string" && value.id.trim().length > 0 ? value.id.trim().slice(0, 96) : `app-session-${openedMs}`,
    openedAt,
    closedAt: closedAt && closedMs && closedMs > openedMs ? closedAt : null,
    durationSec
  };
}

function sanitizeAnalyticsSharingSettings(value: unknown): AnalyticsSharingSettings {
  const fallback = createDefaultAnalyticsSharingSettings();
  if (!isRecord(value)) return fallback;
  const lastSendStatus = ["never", "blocked", "ok", "unconfigured", "invalid", "error"].includes(String(value.lastSendStatus))
    ? (value.lastSendStatus as AnalyticsSharingSettings["lastSendStatus"])
    : fallback.lastSendStatus;
  const endpointUrl = typeof value.endpointUrl === "string" && value.endpointUrl.trim().length > 0
    ? value.endpointUrl.trim().slice(0, 240)
    : null;
  const consentVersion = typeof value.consentVersion === "string" && value.consentVersion.trim().length > 0
    ? value.consentVersion.trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80) || null
    : null;

  return {
    enabled: Boolean(value.enabled),
    userOptedInAt: validIso(value.userOptedInAt),
    consentVersion,
    endpointUrl,
    aggregateOnlySharing: true,
    privateNotesAllowed: false,
    browsingDataAllowed: false,
    supportContactSharingAllowed: false,
    dataRetentionDays: clampInteger(value.dataRetentionDays, fallback.dataRetentionDays, 0, 30),
    lastSentAt: validIso(value.lastSentAt),
    lastSendStatus,
    lastSendMessage: typeof value.lastSendMessage === "string" ? value.lastSendMessage.trim().slice(0, 220) || null : null,
    updatedAt: validIso(value.updatedAt)
  };
}

export function hydrateRecoveryState(value: unknown): RecoveryState {
  const fallback = createDefaultRecoveryState();
  if (!isRecord(value)) return fallback;

  const attempts = Array.isArray(value.attempts) ? value.attempts.map(sanitizeAttempt).filter((item): item is BlockingAttempt => Boolean(item)) : [];
  const challengeHistory = Array.isArray(value.challengeHistory)
    ? value.challengeHistory.map(sanitizeCompletion).filter((item): item is ChallengeCompletion => Boolean(item))
    : [];
  const customChallenges = Array.isArray(value.customChallenges)
    ? value.customChallenges.map(sanitizeCustomChallenge).filter((item): item is RecoveryChallenge => Boolean(item))
    : [];
  const dailyCheckIns = Array.isArray(value.dailyCheckIns)
    ? value.dailyCheckIns.map(sanitizeCheckIn).filter((item): item is DailyCheckIn => Boolean(item))
    : [];
  const dailyHabits = Array.isArray(value.dailyHabits)
    ? value.dailyHabits.map(sanitizeHabitCompletion).filter((item): item is DailyHabitCompletion => Boolean(item))
    : [];
  const relapseRecords = Array.isArray(value.relapseRecords)
    ? value.relapseRecords.map(sanitizeRelapseRecord).filter((item): item is RelapseRecord => Boolean(item))
    : [];
  const supportCircle = Array.isArray(value.supportCircle)
    ? value.supportCircle.map(sanitizeSupportCircleMember).filter((item): item is SupportCircleMember => Boolean(item))
    : [];
  const earnedUnlocks = Array.isArray(value.earnedUnlocks)
    ? value.earnedUnlocks.map(sanitizeEarnedUnlock).filter((item): item is EarnedUnlock => Boolean(item))
    : [];
  const appSessions = Array.isArray(value.appSessions)
    ? value.appSessions.map(sanitizeAppUsageSession).filter((item): item is AppUsageSession => Boolean(item))
    : [];
  const answers = Array.isArray(value.answers) ? value.answers.filter((answer): answer is string => typeof answer === "string").slice(0, 12) : [];
  const recoveryStartedAt = validIso(value.recoveryStartedAt);
  const streakDays = Math.max(0, Math.round(finiteNumber(value.streakDays, fallback.streakDays)));
  const bestStreakDays = Math.max(streakDays, Math.round(finiteNumber(value.bestStreakDays, fallback.bestStreakDays)));
  const storedChallengeHistory = challengeHistory.slice(0, 200);

  return {
    version: RECOVERY_STATE_VERSION,
    premium: Boolean(value.premium),
    premiumPlanId: Boolean(value.premium) ? sanitizePremiumPlanId(value.premiumPlanId) : null,
    premiumPlanAudience: Boolean(value.premium)
      ? premiumAudienceForPlan(sanitizePremiumPlanId(value.premiumPlanId))
      : null,
    premiumActivatedAt: Boolean(value.premium) ? validIso(value.premiumActivatedAt) : null,
    recoveryStartedAt,
    streakDays,
    bestStreakDays,
    completedChallenges: storedChallengeHistory.length,
    attempts: attempts.slice(0, 100),
    challengeHistory: storedChallengeHistory,
    customChallenges: customChallenges.slice(0, 12),
    dailyCheckIns: dailyCheckIns.slice(0, 120),
    dailyHabits: dailyHabits.slice(0, 400),
    relapseRecords: relapseRecords.slice(0, 80),
    reminders: sanitizeReminderPreferences(value.reminders),
    accountability: sanitizeAccountabilityPartner(value.accountability),
    supportCircle: supportCircle.slice(0, 6),
    disciplineSettings: sanitizeDisciplineSettings(value.disciplineSettings),
    earnedUnlocks: earnedUnlocks
      .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))
      .slice(0, 40),
    appSessions: appSessions
      .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))
      .slice(0, 120),
    analyticsSharing: sanitizeAnalyticsSharingSettings(value.analyticsSharing),
    answers,
    hasCompletedOnboarding: Boolean(value.hasCompletedOnboarding),
    onboardingPaywallPresentedAt: validIso(value.onboardingPaywallPresentedAt),
    protectionActivatedAt: validIso(value.protectionActivatedAt),
    protectionActivationPlatform: sanitizeProtectionActivationPlatform(value.protectionActivationPlatform),
    lastOpenedAt: validIso(value.lastOpenedAt),
    lastProtectedAt: validIso(value.lastProtectedAt)
  };
}

export function getLocalDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clockMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isClockWindowActive(startTime: string, endTime: string, day: Date | string = new Date()) {
  const start = clockMinutes(startTime);
  const end = clockMinutes(endTime);
  const date = typeof day === "string" ? new Date(day) : day;
  if (start === null || end === null || Number.isNaN(date.getTime())) return false;
  const current = date.getHours() * 60 + date.getMinutes();
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function isSleepModeActive(settings: DisciplineSettings, day: Date | string = new Date()) {
  return settings.sleepModeEnabled && isClockWindowActive(settings.sleepStartTime, settings.sleepEndTime, day);
}

export function isWorkHoursModeActive(settings: DisciplineSettings, day: Date | string = new Date()) {
  return settings.workHoursEnabled && isClockWindowActive(settings.workStartTime, settings.workEndTime, day);
}

export function isWeekendModeActive(settings: DisciplineSettings, day: Date | string = new Date()) {
  if (!settings.weekendModeEnabled) return false;
  const date = typeof day === "string" ? new Date(day) : day;
  if (Number.isNaN(date.getTime())) return false;
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6;
}

export function getActiveBlockedAppPackages(settings: DisciplineSettings, day: Date | string = new Date()) {
  const shouldExpand =
    settings.emergencyStrictMode ||
    settings.deepFocusModeEnabled ||
    isSleepModeActive(settings, day) ||
    isWorkHoursModeActive(settings, day) ||
    isWeekendModeActive(settings, day);
  const packages = shouldExpand
    ? DOOMSCROLL_APP_OPTIONS.map((option) => option.androidPackage)
    : settings.blockedAppPackages;
  return expandDoomscrollAppPackages(packages);
}

export function buildChallengePreferenceSignal(
  settings: DisciplineSettings,
  day: Date | string = new Date()
): ChallengePreferenceSignal {
  return {
    challengeIntensity: settings.challengeIntensity,
    outdoorFrequency: settings.outdoorChallengeFrequency,
    exercisePreference: settings.exercisePreference,
    socialFrequency: settings.socialChallengeFrequency,
    emergencyStrictMode: settings.emergencyStrictMode,
    sleepModeActive: isSleepModeActive(settings, day),
    deepFocusModeActive: settings.deepFocusModeEnabled || isWorkHoursModeActive(settings, day),
    weekendModeEnabled: settings.weekendModeEnabled,
    unlockDurationMinutes: settings.unlockDurationMinutes,
    dailyLimitMinutes: settings.dailyLimitMinutes
  };
}

function localDayStartMs(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.getTime();
}

export function calculateStreakDaysFrom(startedAt: string | null, day: Date | string = new Date()) {
  if (!startedAt) return 0;
  const startedKey = getLocalDateKey(startedAt);
  const dayKey = getLocalDateKey(day);
  if (!startedKey || !dayKey) return 0;

  const startedMs = localDayStartMs(startedKey);
  const dayMs = localDayStartMs(dayKey);
  if (!Number.isFinite(startedMs) || !Number.isFinite(dayMs) || dayMs < startedMs) return 0;
  return Math.floor((dayMs - startedMs) / 86_400_000);
}

export function countAttemptsForDay(attempts: BlockingAttempt[], day: Date | string = new Date()) {
  const target = getLocalDateKey(day);
  return attempts.filter((attempt) => attempt.result.verdict === "block" && getLocalDateKey(attempt.detectedAt) === target).length;
}

export function getDailyHabitCompletionsForDay(state: RecoveryState, day: Date | string = new Date()) {
  const target = getLocalDateKey(day);
  return state.dailyHabits.filter((habit) => habit.dateKey === target);
}

export function calculateRecoveryXp(state: RecoveryState) {
  const helpfulChallenges = state.challengeHistory.filter((challenge) => challenge.outcome === "helped").length;
  return Math.max(
    0,
    state.streakDays * 12 +
      state.bestStreakDays * 4 +
      state.completedChallenges * 45 +
      helpfulChallenges * 20 +
      state.dailyCheckIns.length * 18 +
      state.attempts.length * 8
  );
}

export function calculateRecoveryLevel(state: RecoveryState): RecoveryLevel {
  const thresholds = [0, 250, 600, 1_100, 1_800, 2_700, 3_800, 5_200, 6_900, 8_900, 11_200];
  const xp = calculateRecoveryXp(state);
  const levelIndex = thresholds.reduce((current, threshold, index) => (xp >= threshold ? index : current), 0);
  const currentLevelXp = thresholds[levelIndex] ?? 0;
  const nextLevelXp = thresholds[levelIndex + 1] ?? currentLevelXp + 2_500;
  const progress = nextLevelXp === currentLevelXp ? 1 : Math.min(1, Math.max(0, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)));

  return {
    xp,
    level: levelIndex + 1,
    currentLevelXp,
    nextLevelXp,
    progress
  };
}

const milestoneDays = [1, 3, 7, 14, 30, 60, 90, 180, 365];

export function getRecoveryMilestone(state: RecoveryState): RecoveryMilestone {
  const currentDays = Math.max(0, Math.round(state.streakDays));
  const exactMilestone = milestoneDays.includes(currentDays) ? currentDays : null;
  if (exactMilestone) {
    return {
      title: `${exactMilestone}-day milestone`,
      detail: "Pause for one breath and let this win land. You are training the response you wanted.",
      currentDays,
      targetDays: exactMilestone,
      progress: 1,
      achieved: true
    };
  }

  const targetDays = milestoneDays.find((milestone) => milestone > currentDays) ?? currentDays + 30;
  const daysLeft = Math.max(1, targetDays - currentDays);
  return {
    title: currentDays === 0 ? "First clean day" : `Next milestone: ${targetDays} days`,
    detail:
      currentDays === 0
        ? "Today is the first rep. Keep the next hour clean and simple."
        : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} until the next streak celebration.`,
    currentDays,
    targetDays,
    progress: targetDays <= 0 ? 0 : Math.min(1, Math.max(0, currentDays / targetDays)),
    achieved: false
  };
}

export function generateAchievementBadges(state: RecoveryState): AchievementBadge[] {
  const helpfulChallenges = state.challengeHistory.filter((challenge) => challenge.outcome === "helped").length;
  const checkIns = state.dailyCheckIns.length;
  const protectedAttempts = state.attempts.filter((attempt) => attempt.result.verdict === "block").length;
  const steadyCheckIns = state.dailyCheckIns.filter((checkIn) => checkIn.mood === "steady" || checkIn.mood === "energized").length;
  const badges: Array<Omit<AchievementBadge, "earned">> = [
    {
      id: "first-checkin",
      title: "Honest Check-In",
      detail: "Log the first mood and urge check-in.",
      progress: checkIns,
      target: 1
    },
    {
      id: "week-streak",
      title: "Seven Clean Days",
      detail: "Protect a full week of recovery.",
      progress: state.streakDays,
      target: 7
    },
    {
      id: "reset-practice",
      title: "Reset Practice",
      detail: "Complete three recovery challenges.",
      progress: state.completedChallenges,
      target: 3
    },
    {
      id: "urge-surfer",
      title: "Urge Surfer",
      detail: "Mark five challenges as helpful.",
      progress: helpfulChallenges,
      target: 5
    },
    {
      id: "protected-moment",
      title: "Protected Moment",
      detail: "Let FREED interrupt one risk moment.",
      progress: protectedAttempts,
      target: 1
    },
    {
      id: "steady-rhythm",
      title: "Steady Rhythm",
      detail: "Log five steady or energized days.",
      progress: steadyCheckIns,
      target: 5
    },
    {
      id: "honest-reset",
      title: "Honest Reset",
      detail: "Log a slip without hiding from the pattern.",
      progress: state.relapseRecords.length,
      target: 1
    }
  ];

  return badges
    .map((badge) => ({
      ...badge,
      progress: Math.min(badge.target, Math.max(0, badge.progress)),
      earned: badge.progress >= badge.target
    }))
    .sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress / b.target - a.progress / a.target || a.title.localeCompare(b.title));
}

export function getDailyCheckInForDay(state: RecoveryState, day: Date | string = new Date()) {
  const target = getLocalDateKey(day);
  return state.dailyCheckIns.find((checkIn) => checkIn.dateKey === target) ?? null;
}

function hourBucketLabel(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "No clear pattern yet";
  const hour = date.getHours();

  if (hour >= 0 && hour < 6) return "Late night";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  return "Evening";
}

function mostCommonLabel(labels: string[]) {
  if (labels.length === 0) return null;
  const counts = labels.reduce<Record<string, number>>((accumulator, label) => {
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function getBestInterventionLabel(challenges: ChallengeCompletion[]) {
  const helped = challenges.filter((challenge) => challenge.outcome === "helped");
  if (helped.length === 0) return "More completions needed";

  const byTitle = helped.reduce<Record<string, number>>((accumulator, challenge) => {
    accumulator[challenge.title] = (accumulator[challenge.title] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(byTitle).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "More completions needed";
}

function getMomentumLabel(attempts: BlockingAttempt[], startKey: string, endKey: string) {
  if (attempts.length < 2) return "Needs more signal";

  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Needs more signal";

  const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;
  const early = attempts.filter((attempt) => Date.parse(attempt.detectedAt) < midpoint).length;
  const recent = attempts.length - early;

  if (recent >= early + 2) return "Risk rising";
  if (early >= recent + 2) return "Risk easing";
  return "Stable";
}

function summarizeCheckInRecords(records: DailyCheckIn[]): Omit<CheckInSummary, "latest"> {
  if (records.length === 0) return { total: 0, averageUrge: 0, averageSleep: 0, steadyDays: 0 };

  const averageUrge = Math.round((records.reduce((sum, item) => sum + item.urgeLevel, 0) / records.length) * 10) / 10;
  const averageSleep = Math.round((records.reduce((sum, item) => sum + item.sleepQuality, 0) / records.length) * 10) / 10;
  const steadyDays = records.filter((item) => item.mood === "steady" || item.mood === "energized").length;

  return {
    total: records.length,
    averageUrge,
    averageSleep,
    steadyDays
  };
}

export function recordDailyCheckIn(
  state: RecoveryState,
  input: DailyCheckInInput,
  checkedAt = new Date().toISOString()
): RecoveryState {
  const dateKey = getLocalDateKey(checkedAt);
  const existing = getDailyCheckInForDay(state, checkedAt);
  const checkIn: DailyCheckIn = {
    id: existing?.id ?? `checkin-${dateKey}`,
    dateKey,
    mood: input.mood,
    urgeLevel: Math.min(5, Math.max(0, Math.round(input.urgeLevel))),
    sleepQuality: Math.min(5, Math.max(1, Math.round(input.sleepQuality))),
    reflection: input.reflection?.trim().slice(0, 500) ?? "",
    createdAt: existing?.createdAt ?? checkedAt,
    updatedAt: checkedAt
  };

  return hydrateRecoveryState({
    ...state,
    dailyCheckIns: [checkIn, ...state.dailyCheckIns.filter((item) => item.dateKey !== dateKey)].slice(0, 120)
  });
}

export function recordDailyHabitCompletion(
  state: RecoveryState,
  input: { key: DailyHabitKey; label: string; completed: boolean },
  updatedAt = new Date().toISOString()
): RecoveryState {
  const dateKey = getLocalDateKey(updatedAt);
  const habit: DailyHabitCompletion = {
    key: input.key,
    label: input.label.trim().slice(0, 48) || "Recovery habit",
    completed: input.completed,
    dateKey,
    updatedAt
  };

  return hydrateRecoveryState({
    ...state,
    dailyHabits: [
      habit,
      ...state.dailyHabits.filter((item) => !(item.key === input.key && item.dateKey === dateKey))
    ].slice(0, 400)
  });
}

export function recordRelapse(
  state: RecoveryState,
  input: RelapseRecordInput = {},
  occurredAt = new Date().toISOString()
): RecoveryState {
  const safeOccurredAt = validIso(occurredAt) ?? new Date().toISOString();
  const parsedAt = Date.parse(safeOccurredAt);
  const trigger = input.trigger?.trim().slice(0, 64) ?? "";
  const record: RelapseRecord = {
    id: `slip-${Number.isNaN(parsedAt) ? Date.now() : parsedAt}`,
    occurredAt: safeOccurredAt,
    previousStreakDays: Math.max(0, Math.round(state.streakDays)),
    note: input.note?.trim().slice(0, 500) ?? "",
    trigger: trigger.length > 0 ? trigger : undefined
  };

  return hydrateRecoveryState({
    ...state,
    streakDays: 0,
    bestStreakDays: Math.max(state.bestStreakDays, state.streakDays),
    recoveryStartedAt: safeOccurredAt,
    relapseRecords: [record, ...state.relapseRecords].slice(0, 80)
  });
}

export function summarizeCheckIns(state: RecoveryState, day: Date | string = new Date()): CheckInSummary {
  const targetDate = typeof day === "string" ? new Date(day) : day;
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - 6);
  const startKey = getLocalDateKey(start);
  const endKey = getLocalDateKey(targetDate);
  const recent = state.dailyCheckIns.filter((checkIn) => checkIn.dateKey >= startKey && checkIn.dateKey <= endKey);

  if (recent.length === 0) {
    return { total: 0, averageUrge: 0, averageSleep: 0, steadyDays: 0, latest: null };
  }

  const summary = summarizeCheckInRecords(recent);

  return {
    ...summary,
    latest: recent.sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]
  };
}

export function generateRecoveryInsight(state: RecoveryState, attemptsToday: number, day: Date | string = new Date()) {
  const summary = summarizeCheckIns(state, day);

  if (summary.total === 0) {
    return "Start with one honest check-in today. FREED can guide better interventions once mood, urge, and sleep patterns are visible.";
  }

  if (attemptsToday >= 2) {
    return "Today has multiple risk moments. Keep the evening simple: movement, phone away from bed, and one short reflection before sleep.";
  }

  if (summary.averageSleep <= 2.5) {
    return "Sleep is the main recovery lever this week. Lower stimulation tonight and make the phone physically harder to reach.";
  }

  if (summary.averageUrge >= 4) {
    return "Urges are running high. Stronger body-based resets are likely to work better than willpower-only plans right now.";
  }

  if (summary.steadyDays >= 4) {
    return "Your week is stabilizing. Protect the routine that is working and keep interventions short, repeatable, and early.";
  }

  return "The pattern is still forming. Check in daily and treat each urge as data for the next cleaner intervention.";
}

export function generateWeeklyRecoveryReport(state: RecoveryState, day: Date | string = new Date()): WeeklyRecoveryReport {
  const targetDate = typeof day === "string" ? new Date(day) : day;
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - 6);
  const startKey = getLocalDateKey(start);
  const endKey = getLocalDateKey(targetDate);
  const summary = summarizeCheckIns(state, day);
  const attempts = state.attempts.filter((attempt) => {
    const key = getLocalDateKey(attempt.detectedAt);
    return attempt.result.verdict === "block" && key >= startKey && key <= endKey;
  });
  const completedChallenges = state.challengeHistory.filter((challenge) => {
    const key = getLocalDateKey(challenge.completedAt);
    return key >= startKey && key <= endKey;
  });
  const relapses = state.relapseRecords.filter((record) => {
    const key = getLocalDateKey(record.occurredAt);
    return key >= startKey && key <= endKey;
  });
  const riskWindow = mostCommonLabel(attempts.map((attempt) => hourBucketLabel(attempt.detectedAt))) ?? "No clear pattern yet";
  const slipWindow = mostCommonLabel(relapses.map((record) => hourBucketLabel(record.occurredAt))) ?? "No slips logged";
  const slipTrigger = mostCommonLabel(relapses.map((record) => record.trigger ?? "Unlabeled")) ?? "No slips logged";
  const bestIntervention = getBestInterventionLabel(completedChallenges);
  const momentum = getMomentumLabel(attempts, startKey, endKey);

  const strongestPattern =
    relapses.length > 0 && attempts.length === 0
      ? "A slip was logged honestly; use that data to shape the next safer window."
      : relapses.length > 0
      ? "Risk moments and honest reset logs both point to a pattern worth protecting early."
      : attempts.length === 0
      ? "No blocked attempts landed in the last seven days."
      : attempts.length >= 3
      ? "Risk moments clustered this week; plan friction before the highest-risk window."
      : "FREED interrupted risk early enough for recovery actions to work.";

  const nextFocus =
    relapses.length > 0 && slipTrigger !== "No slips logged"
      ? `Treat ${slipTrigger.toLowerCase()} as the next setup cue. Add one physical barrier before ${slipWindow.toLowerCase()} and start with a short reset instead of willpower.`
      : summary.total < 3
      ? "Build the check-in rhythm so the intervention engine has better signal."
      : summary.averageSleep <= 2.5
      ? "Protect sleep first; low sleep is the strongest relapse amplifier this week."
      : summary.averageUrge >= 4
      ? "Prepare body-first resets before urge intensity rises."
      : completedChallenges.length > 0
      ? "Repeat the interventions that already helped instead of adding complexity."
      : "Keep the routine simple: check in, protect the phone boundary, and act early.";

  const wins = [
    `${completedChallenges.length} recovery ${completedChallenges.length === 1 ? "challenge" : "challenges"} completed`,
    `${summary.steadyDays} steady or energized ${summary.steadyDays === 1 ? "day" : "days"} logged`,
    attempts.length === 0 ? "No protected risk attempts this week" : `${attempts.length} risk ${attempts.length === 1 ? "moment was" : "moments were"} interrupted`,
    relapses.length === 0 ? "No slips logged this week" : `${relapses.length} honest ${relapses.length === 1 ? "reset was" : "resets were"} logged`
  ];

  return {
    rangeLabel: `${startKey} to ${endKey}`,
    attempts: attempts.length,
    slips: relapses.length,
    completedChallenges: completedChallenges.length,
    checkIns: summary.total,
    averageUrge: summary.averageUrge,
    averageSleep: summary.averageSleep,
    steadyDays: summary.steadyDays,
    riskWindow,
    slipWindow,
    slipTrigger,
    bestIntervention,
    momentum,
    strongestPattern,
    nextFocus,
    wins
  };
}

export function generateMonthlyGrowthReport(state: RecoveryState, day: Date | string = new Date()): MonthlyGrowthReport {
  const targetDate = typeof day === "string" ? new Date(day) : day;
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - 29);
  const startKey = getLocalDateKey(start);
  const endKey = getLocalDateKey(targetDate);
  const checkIns = state.dailyCheckIns.filter((checkIn) => checkIn.dateKey >= startKey && checkIn.dateKey <= endKey);
  const checkInSummary = summarizeCheckInRecords(checkIns);
  const attempts = state.attempts.filter((attempt) => {
    const key = getLocalDateKey(attempt.detectedAt);
    return attempt.result.verdict === "block" && key >= startKey && key <= endKey;
  });
  const completedChallenges = state.challengeHistory.filter((challenge) => {
    const key = getLocalDateKey(challenge.completedAt);
    return key >= startKey && key <= endKey;
  });
  const helpfulChallenges = completedChallenges.filter((challenge) => challenge.outcome === "helped");
  const relapses = state.relapseRecords.filter((record) => {
    const key = getLocalDateKey(record.occurredAt);
    return key >= startKey && key <= endKey;
  });
  const protectedMoments = attempts.length;
  const appInterventions = attempts.filter((attempt) => attempt.source === "app").length;
  const selfReportedUrges = attempts.filter((attempt) => attempt.source === "panic-button").length;
  const riskWindow = mostCommonLabel(attempts.map((attempt) => hourBucketLabel(attempt.detectedAt))) ?? "No clear pattern yet";
  const slipWindow = mostCommonLabel(relapses.map((record) => hourBucketLabel(record.occurredAt))) ?? "No slips logged";
  const slipTrigger = mostCommonLabel(relapses.map((record) => record.trigger ?? "Unlabeled")) ?? "No slips logged";
  const bestIntervention = getBestInterventionLabel(completedChallenges);
  const signalCount = protectedMoments + completedChallenges.length + checkInSummary.total + relapses.length;
  const growthScore =
    signalCount === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              checkInSummary.steadyDays * 4 +
                checkInSummary.total * 2 +
                completedChallenges.length * 5 +
                helpfulChallenges.length * 7 +
                protectedMoments * 3 -
                relapses.length * 10 -
                Math.max(0, checkInSummary.averageUrge - 3) * 5
            )
          )
        );

  const summary =
    signalCount === 0
      ? "No monthly pattern yet. FREED needs real check-ins, protected moments, resets, or honest logs before it can summarize growth."
      : relapses.length > 0
      ? "This month has honest reset data. Use the pattern without shame and make the risky window easier to survive."
      : helpfulChallenges.length >= 3
      ? "Helpful resets are becoming repeatable. Keep the same playbook close to the moments where risk shows up."
      : protectedMoments > 0
      ? "FREED interrupted real risk this month. The next gain is turning those interruptions into completed resets."
      : "The month is quiet. Keep check-ins steady so early warning signals stay visible.";

  const nextExperiment =
    relapses.length > 0 && slipTrigger !== "No slips logged"
      ? `Before ${slipWindow.toLowerCase()}, treat ${slipTrigger.toLowerCase()} as the setup cue and start one short body reset early.`
      : checkInSummary.averageSleep > 0 && checkInSummary.averageSleep <= 2.5
      ? "Run a seven-night sleep guard experiment: phone away from bed, Night Guard on, and one calm reset before the window."
      : helpfulChallenges.length > 0
      ? `Repeat ${bestIntervention.toLowerCase()} first when the next risk signal appears.`
      : checkInSummary.total < 8
      ? "Make daily check-ins the experiment. More signal means better interventions."
      : "Keep the current routine and add one small friction point before the highest-risk window.";

  return {
    rangeLabel: `${startKey} to ${endKey}`,
    protectedMoments,
    appInterventions,
    selfReportedUrges,
    completedChallenges: completedChallenges.length,
    helpfulChallenges: helpfulChallenges.length,
    slips: relapses.length,
    checkIns: checkInSummary.total,
    averageUrge: checkInSummary.averageUrge,
    averageSleep: checkInSummary.averageSleep,
    steadyDays: checkInSummary.steadyDays,
    riskWindow,
    slipWindow,
    slipTrigger,
    bestIntervention,
    growthScore,
    summary,
    nextExperiment,
    wins: [
      `${protectedMoments} protected ${protectedMoments === 1 ? "moment" : "moments"}`,
      `${helpfulChallenges.length} helpful ${helpfulChallenges.length === 1 ? "reset" : "resets"}`,
      `${checkInSummary.total} real ${checkInSummary.total === 1 ? "check-in" : "check-ins"}`,
      relapses.length === 0 ? "No slips logged in the range" : `${relapses.length} honest ${relapses.length === 1 ? "reset" : "resets"} logged`
    ]
  };
}

export function updateReminderPreferences(
  state: RecoveryState,
  update: Partial<Omit<ReminderPreferences, "scheduledIds" | "permissionStatus" | "statusMessage" | "updatedAt" | "lastScheduledAt">>,
  updatedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    reminders: {
      ...state.reminders,
      ...update,
      updatedAt
    }
  });
}

export function recordReminderSync(
  state: RecoveryState,
  result: {
    scheduledIds: string[];
    permissionStatus: ReminderPermissionStatus;
    statusMessage: string;
    enabled?: boolean;
  },
  syncedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    reminders: {
      ...state.reminders,
      enabled: result.enabled ?? state.reminders.enabled,
      scheduledIds: result.scheduledIds,
      permissionStatus: result.permissionStatus,
      statusMessage: result.statusMessage,
      updatedAt: syncedAt,
      lastScheduledAt: result.scheduledIds.length > 0 ? syncedAt : state.reminders.lastScheduledAt
    }
  });
}

export function updateAccountabilityPartner(
  state: RecoveryState,
  update: Partial<Omit<AccountabilityPartner, "updatedAt" | "lastContactedAt">>,
  updatedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    accountability: {
      ...state.accountability,
      ...update,
      updatedAt
    }
  });
}

export function updateDisciplineSettings(
  state: RecoveryState,
  update: Partial<Omit<DisciplineSettings, "updatedAt">>,
  updatedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    disciplineSettings: {
      ...state.disciplineSettings,
      ...update,
      updatedAt
    }
  });
}

export function updateAnalyticsSharingSettings(
  state: RecoveryState,
  update: Partial<Omit<AnalyticsSharingSettings, "updatedAt">>,
  updatedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    analyticsSharing: {
      ...state.analyticsSharing,
      ...update,
      updatedAt
    }
  });
}

export function updateSupportCircleMember(
  state: RecoveryState,
  memberId: string,
  update: Partial<Omit<SupportCircleMember, "id" | "updatedAt" | "lastContactedAt">>,
  updatedAt = new Date().toISOString()
): RecoveryState {
  const existing =
    state.supportCircle.find((member) => member.id === memberId) ??
    ({
      id: memberId,
      enabled: true,
      name: "",
      role: "family",
      method: "sms",
      contact: "",
      updatedAt: null,
      lastContactedAt: null
    } satisfies SupportCircleMember);
  const sanitized = sanitizeSupportCircleMember({
    ...existing,
    ...update,
    updatedAt
  });
  if (!sanitized) return state;

  return hydrateRecoveryState({
    ...state,
    supportCircle: [sanitized, ...state.supportCircle.filter((member) => member.id !== sanitized.id)].slice(0, 6)
  });
}

export function removeSupportCircleMember(state: RecoveryState, memberId: string): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    supportCircle: state.supportCircle.filter((member) => member.id !== memberId)
  });
}

export function recordSupportCircleContact(
  state: RecoveryState,
  memberId: string,
  contactedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    supportCircle: state.supportCircle.map((member) =>
      member.id === memberId
        ? {
            ...member,
            lastContactedAt: contactedAt
          }
        : member
    )
  });
}

export function recordAccountabilityContact(state: RecoveryState, contactedAt = new Date().toISOString()): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    accountability: {
      ...state.accountability,
      lastContactedAt: contactedAt,
      updatedAt: contactedAt
    }
  });
}

export function getActiveEarnedUnlock(state: RecoveryState, at: Date | string = new Date()) {
  const atMs = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(atMs)) return null;
  return (
    state.earnedUnlocks
      .filter((unlock) => Date.parse(unlock.startedAt) <= atMs && Date.parse(unlock.expiresAt) > atMs)
      .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] ?? null
  );
}

export function recordEarnedUnlock(
  state: RecoveryState,
  challenge: RecoveryChallenge,
  options: { durationMinutes?: number; sourceAttemptHost?: string; startedAt?: string } = {}
): RecoveryState {
  const startedAt = validIso(options.startedAt) ?? new Date().toISOString();
  const durationMinutes = clampInteger(options.durationMinutes, state.disciplineSettings.unlockDurationMinutes, 1, MAX_EARNED_UNLOCK_MINUTES);
  const expiresAt = new Date(Date.parse(startedAt) + durationMinutes * 60_000).toISOString();
  const unlock: EarnedUnlock = {
    id: `unlock-${Date.parse(startedAt)}-${challenge.id}`,
    startedAt,
    expiresAt,
    durationMinutes,
    sourceChallengeId: challenge.id,
    sourceAttemptHost: sanitizeSourceAttemptHost(options.sourceAttemptHost)
  };

  return hydrateRecoveryState({
    ...state,
    earnedUnlocks: [unlock, ...state.earnedUnlocks].slice(0, 40)
  });
}

export function touchRecoveryState(state: RecoveryState, openedAt = new Date().toISOString()): RecoveryState {
  const currentStreak = state.recoveryStartedAt ? calculateStreakDaysFrom(state.recoveryStartedAt, openedAt) : state.streakDays;
  return hydrateRecoveryState({
    ...state,
    streakDays: currentStreak,
    bestStreakDays: Math.max(state.bestStreakDays, currentStreak),
    lastOpenedAt: openedAt
  });
}

export function recordAppSessionStart(state: RecoveryState, openedAt = new Date().toISOString()): RecoveryState {
  const opened = validIso(openedAt) ?? new Date().toISOString();
  const openedMs = Date.parse(opened);
  const latestOpenSession = state.appSessions
    .filter((session) => session.closedAt === null)
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))[0];

  const sessions = latestOpenSession && openedMs - Date.parse(latestOpenSession.openedAt) > 5 * 60_000
    ? state.appSessions.map((session) =>
        session.id === latestOpenSession.id
          ? {
              ...session,
              closedAt: opened,
              durationSec: 0
            }
          : session
      )
    : state.appSessions;

  if (latestOpenSession && sessions === state.appSessions) return touchRecoveryState(state, opened);

  return touchRecoveryState(
    {
      ...state,
      appSessions: [
        {
          id: `app-session-${openedMs}`,
          openedAt: opened,
          closedAt: null,
          durationSec: 0
        },
        ...sessions
      ].slice(0, 120)
    },
    opened
  );
}

export function recordAppSessionEnd(state: RecoveryState, closedAt = new Date().toISOString()): RecoveryState {
  const closed = validIso(closedAt) ?? new Date().toISOString();
  const openSession = state.appSessions
    .filter((session) => session.closedAt === null)
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))[0];

  if (!openSession) return touchRecoveryState(state, closed);

  const closedMs = Date.parse(closed);
  const openedMs = Date.parse(openSession.openedAt);
  const durationSec = closedMs > openedMs ? Math.round((closedMs - openedMs) / 1000) : 0;

  return touchRecoveryState(
    {
      ...state,
      appSessions: state.appSessions.map((session) =>
        session.id === openSession.id
          ? {
              ...session,
              closedAt: closed,
              durationSec
            }
          : session
      )
    },
    closed
  );
}

export function setPremiumPlan(
  state: RecoveryState,
  premium: boolean,
  planId?: PremiumPlanId | null,
  activatedAt = new Date().toISOString()
): RecoveryState {
  const sanitizedPlanId = premium ? sanitizePremiumPlanId(planId) : null;
  const keepExistingActivation =
    premium &&
    state.premium &&
    state.premiumPlanId === sanitizedPlanId &&
    Boolean(state.premiumActivatedAt);

  return hydrateRecoveryState({
    ...state,
    premium,
    premiumPlanId: sanitizedPlanId,
    premiumPlanAudience: premiumAudienceForPlan(sanitizedPlanId),
    premiumActivatedAt: premium ? (keepExistingActivation ? state.premiumActivatedAt : activatedAt) : null
  });
}

export function completeOnboarding(state: RecoveryState, answers: string[], completedAt = new Date().toISOString()): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    answers,
    hasCompletedOnboarding: true,
    recoveryStartedAt: state.recoveryStartedAt ?? completedAt
  });
}

export function markOnboardingPaywallPresented(
  state: RecoveryState,
  presentedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    onboardingPaywallPresentedAt: state.onboardingPaywallPresentedAt ?? presentedAt
  });
}

export function markProtectionActivated(
  state: RecoveryState,
  platform: ProtectionActivationPlatform,
  activatedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    protectionActivatedAt: activatedAt,
    protectionActivationPlatform: platform
  });
}

export function clearProtectionActivation(state: RecoveryState): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    protectionActivatedAt: null,
    protectionActivationPlatform: null
  });
}

export function hasProtectionActivationForPlatform(
  state: RecoveryState,
  platform: ProtectionActivationPlatform
): boolean {
  return Boolean(state.protectionActivatedAt && state.protectionActivationPlatform === platform);
}

export function recordBlockingAttempt(state: RecoveryState, attempt: BlockingAttempt): RecoveryState {
  const isBlocked = attempt.result.verdict === "block";
  const host = sanitizeStoredAttemptHost(attempt.host, attempt.url, attempt.result.host);
  const sanitizedAttempt = {
    ...attempt,
    host,
    result: {
      ...attempt.result,
      host
    },
    url: redactUrlForStorage(attempt.url)
  };

  return hydrateRecoveryState({
    ...state,
    attempts: isBlocked ? [sanitizedAttempt, ...state.attempts].slice(0, 100) : state.attempts,
    bestStreakDays: Math.max(state.bestStreakDays, state.streakDays),
    lastProtectedAt: isBlocked ? sanitizedAttempt.detectedAt : state.lastProtectedAt
  });
}

export function recordChallengeCompletion(
  state: RecoveryState,
  challenge: RecoveryChallenge,
  completedAt = new Date().toISOString(),
  sourceAttemptHost?: string,
  outcome: ChallengeOutcome = "helped"
): RecoveryState {
  const completion: ChallengeCompletion = {
    id: challenge.id,
    title: challenge.title,
    category: challenge.category,
    outcome,
    completedAt,
    durationSec: challenge.durationSec,
    premium: challenge.premium,
    sourceAttemptHost: sanitizeSourceAttemptHost(sourceAttemptHost)
  };

  return hydrateRecoveryState({
    ...state,
    completedChallenges: state.completedChallenges + 1,
    bestStreakDays: Math.max(state.bestStreakDays, state.streakDays),
    challengeHistory: [completion, ...state.challengeHistory].slice(0, 200),
    lastProtectedAt: completedAt
  });
}

export function createCustomRecoveryChallenge(input: CustomChallengeInput, createdAt = new Date().toISOString()): RecoveryChallenge {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 72);
  const category = sanitizeChallengeCategory(input.category);
  const intensity = sanitizeChallengeIntensity(input.intensity);
  const timestamp = Number.isNaN(Date.parse(createdAt)) ? Date.now() : Date.parse(createdAt);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "reset";
  const challenge = sanitizeCustomChallenge({
    id: `custom-${timestamp}-${slug}`,
    title: title || "Custom recovery reset",
    category,
    durationSec: input.durationSec,
    intensity,
    premium: true,
    icon: iconForChallengeCategory(category),
    steps: input.steps,
    why: input.why
  });

  return challenge ?? {
    id: `custom-${timestamp}-reset`,
    title: "Custom recovery reset",
    category: "reset",
    durationSec: 120,
    intensity: "medium",
    premium: true,
    icon: "Footprints",
    steps: ["Start the reset.", "Stay present.", "Finish the action honestly."],
    why: "This is a user-created recovery reset for moments when a familiar action works best."
  };
}

export function addCustomRecoveryChallenge(
  state: RecoveryState,
  challenge: RecoveryChallenge,
  updatedAt = new Date().toISOString()
): RecoveryState {
  const sanitized = sanitizeCustomChallenge(challenge);
  if (!sanitized) return state;

  return hydrateRecoveryState({
    ...state,
    customChallenges: [sanitized, ...state.customChallenges.filter((item) => item.id !== sanitized.id)].slice(0, 12),
    lastOpenedAt: updatedAt
  });
}
