import { sanitizeJourneyMetadata, type JourneyMetadata } from './user-journey';
import { BlockingAttempt, normalizeHost, redactUrlForStorage } from "@/lib/blocking-engine";
import {
  DOOMSCROLL_APP_OPTIONS,
  expandDoomscrollAppPackages,
  isShortFormRuleId,
  normalizeDoomscrollAppPackage
} from "@/lib/doomscroll-apps";
import type { PremiumPlanAudience, PremiumPlanId } from "@/lib/monetization";
import { hasVerifiedPremium, sanitizePremiumEntitlement, type VerifiedPremiumEntitlement } from "@/lib/premium-entitlement";
import { ChallengeOutcome, ChallengeFeedbackOutcome, ChallengePreferenceSignal, RecoveryChallenge } from "@/lib/recovery-engine";
import { normalizeChallengeRule } from './challenge-rules';
import { sanitizeCompletionProvenance, type CompletionProvenance } from './completion-provenance';

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

import { createDefaultPersonalPlanPreferences, sanitizePersonalPlanPreferences, sanitizePersonalDailyPlan, markPersonalPlanDate, type PersonalDailyPlan, type PersonalPlanPreferences } from './personal-daily-plan';
import { sanitizeToolCompletionReceipt, sanitizeToolSessionIds, TOOL_COMPLETION_DETAIL_LIMIT, type ToolCompletionReceipt } from './tool-completion';

export const RECOVERY_STATE_VERSION = 1;
export const MAX_EARNED_UNLOCK_MINUTES = 120;

export type ChallengeCompletion = {
  id: string;
  sessionId?: string;
  observedActiveSec?: number;
  provenance?: CompletionProvenance;
  title: string;
  category: RecoveryChallenge["category"];
  outcome: ChallengeFeedbackOutcome;
  completedAt: string;
  durationSec: number;
  premium: boolean;
  sourceAttemptHost?: string;
  source?: 'tool';
  toolId?: string;
  dateKey?: string;
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
  mood: MoodLevel | null;
  urgeLevel: number | null;
  sleepQuality: number | null;
  reflection: string;
  checkInCompleted?: boolean;
  journalSaved?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyCheckInInput = {
  mood: MoodLevel | null;
  urgeLevel: number | null;
  sleepQuality: number | null;
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

export const REMINDER_CONTRACT_VERSION = 2;
export type ReminderPermissionStatus = "authorized" | "provisional" | "ephemeral" | "denied" | "undetermined" | "unsupported";
export type ReminderEffectiveStatus = "off" | "pending" | "active" | "quiet" | "permission-required" | "failed";
export type ReminderPreferenceUpdate = Partial<Pick<ReminderPreferences,
  "enabled" | "morningEnabled" | "eveningEnabled" | "guardEnabled" | "morningTime" | "eveningTime" | "guardTime"
>>;

export type ReminderPreferences = {
  contractVersion: number;
  revision: number;
  effectiveStatus: ReminderEffectiveStatus;
  timezone: string | null;
  /** User intention. Permission and scheduling observations never change this switch. */
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

export type AppGuardMode = 'before-use' | 'daily-limit' | 'scheduled';

export type DisciplineSettings = {
  appGuardMode: AppGuardMode;
  appGuardModeConfiguredAt: string | null;
  strictGuardConfiguredAt: string | null;
  dailyLimitMinutes: number;
  shortFormInterruptionSeconds: number;
  unlockDurationMinutes: number;
  challengeIntensity: ChallengeIntensityPreference;
  outdoorChallengeFrequency: DisciplineFrequencyPreference;
  exercisePreference: DisciplineFrequencyPreference;
  socialChallengeFrequency: SocialChallengeFrequencyPreference;
  blockedAppPackages: string[];
  userAllowedDomains: string[];
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
  nativeInterventionId?: string;
  historicalOnly?: true;
};

export type AppUsageSession = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  durationSec: number;
};

export type RecoveryAttemptSourceCounts = Partial<Record<BlockingAttempt["source"], number>>;
type CompletionOutcomeCounts = Partial<Record<ChallengeFeedbackOutcome, number>>;
type CompletionCategoryCounts = Partial<Record<RecoveryChallenge["category"], CompletionOutcomeCounts>>;
type ArchivedSessionInterval = [openedMs: number, closedMs: number, observedSeconds: number];
type ArchivedUnlockCounts = { count: number; seconds: number };

/** Only evicted events live here. UTC minute keys survive timezone/DST changes. */
export type RecoveryActivityArchive = {
  attemptMinutes: Record<string, RecoveryAttemptSourceCounts>;
  attemptTotals: RecoveryAttemptSourceCounts;
  completionMinutes: Record<string, CompletionCategoryCounts>;
  // Tool receipts retain their authored local date alongside a UTC minute for UTC analytics.
  toolCompletionMinutes: Record<string, Record<string, CompletionCategoryCounts>>;
  completionTotals: CompletionCategoryCounts;
  // Closed numeric intervals retain precise overlap without identities or notes.
  sessionIntervals: ArchivedSessionInterval[];
  unlockMinutes: Record<string, ArchivedUnlockCounts>;
  unlockTotals: ArchivedUnlockCounts;
  // Legacy cumulative totals whose event times/outcomes were already lost.
  legacyCompletedChallenges: number;
};

const recoveryAttemptSources: BlockingAttempt["source"][] = ["browser", "search", "app", "manual-check", "panic-button"];
const protectionAttemptSources: BlockingAttempt["source"][] = ["browser", "search", "app"];
const recoveryChallengeCategories: RecoveryChallenge["category"][] = ["physical", "breathing", "reflection", "connection", "reset"];
const feedbackOutcomes: ChallengeFeedbackOutcome[] = ["helped", "still-urging", "unknown"];

function createDefaultRecoveryActivityArchive(): RecoveryActivityArchive {
  return {
    attemptMinutes: {}, attemptTotals: {}, completionMinutes: {}, toolCompletionMinutes: {}, completionTotals: {},
    sessionIntervals: [], unlockMinutes: {}, unlockTotals: { count: 0, seconds: 0 }, legacyCompletedChallenges: 0
  };
}

function activityCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;
}

function activitySeconds(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value)) : 0;
}

function sanitizeUnlockCounts(value: unknown): ArchivedUnlockCounts {
  if (!isRecord(value)) return { count: 0, seconds: 0 };
  const count = activityCount(value.count);
  return { count, seconds: Math.min(activitySeconds(value.seconds), count * MAX_EARNED_UNLOCK_MINUTES * 60) };
}

function addUnlockCounts(target: ArchivedUnlockCounts, source: ArchivedUnlockCounts) {
  target.count = Math.min(Number.MAX_SAFE_INTEGER, target.count + source.count);
  target.seconds = Math.min(Number.MAX_SAFE_INTEGER, target.seconds + source.seconds);
}

function observedUnlockSeconds(unlock: EarnedUnlock): number {
  return Math.min(unlock.durationMinutes * 60, Math.max(0, (Date.parse(unlock.expiresAt) - Date.parse(unlock.startedAt)) / 1_000));
}

function sessionInterval(session: AppUsageSession): ArchivedSessionInterval {
  const opened = Date.parse(session.openedAt);
  // A dropped unclosed session has no measured foreground duration. Never let
  // its archived form accrue time later, on this device or a restored device.
  return [opened, session.closedAt ? Date.parse(session.closedAt) : opened, session.closedAt ? session.durationSec : 0];
}

function sanitizeSessionInterval(value: unknown): ArchivedSessionInterval | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [opened, closed, seconds] = value;
  if (!Number.isSafeInteger(opened) || !Number.isSafeInteger(closed) || closed < opened ||
      !Number.isFinite(new Date(opened).getTime()) || !Number.isFinite(new Date(closed).getTime())) return null;
  return [opened, closed, Math.min(activitySeconds(seconds), 86_400, (closed - opened) / 1_000)];
}

function addSourceCounts(target: RecoveryAttemptSourceCounts, source: RecoveryAttemptSourceCounts) {
  for (const key of recoveryAttemptSources) {
    const count = activityCount(source[key]);
    if (count) target[key] = Math.min(Number.MAX_SAFE_INTEGER, (target[key] ?? 0) + count);
  }
}

function addCompletionCounts(target: CompletionCategoryCounts, source: CompletionCategoryCounts) {
  for (const category of recoveryChallengeCategories) {
    for (const outcome of feedbackOutcomes) {
      const count = activityCount(source[category]?.[outcome]);
      if (!count) continue;
      target[category] ??= {};
      target[category]![outcome] = Math.min(Number.MAX_SAFE_INTEGER, (target[category]![outcome] ?? 0) + count);
    }
  }
}

function sanitizeSourceCounts(value: unknown): RecoveryAttemptSourceCounts {
  const result: RecoveryAttemptSourceCounts = {};
  if (!isRecord(value)) return result;
  for (const source of recoveryAttemptSources) {
    const count = activityCount(value[source]);
    if (count) result[source] = count;
  }
  return result;
}

function sanitizeCompletionCounts(value: unknown): CompletionCategoryCounts {
  const result: CompletionCategoryCounts = {};
  if (!isRecord(value)) return result;
  for (const category of recoveryChallengeCategories) {
    const counts = value[category];
    if (!isRecord(counts)) continue;
    for (const outcome of feedbackOutcomes) {
      const count = activityCount(counts[outcome]);
      if (!count) continue;
      result[category] ??= {};
      result[category]![outcome] = count;
    }
  }
  return result;
}

function validActivityMinute(key: string) {
  return /^-?\d{1,12}$/.test(key) && key === String(Number(key)) && Number.isSafeInteger(Number(key)) && Number.isFinite(new Date(Number(key) * 60_000).getTime());
}

function sanitizeRecoveryActivityArchive(value: unknown): RecoveryActivityArchive {
  const result = createDefaultRecoveryActivityArchive();
  if (!isRecord(value)) return result;
  result.attemptTotals = sanitizeSourceCounts(value.attemptTotals);
  result.completionTotals = sanitizeCompletionCounts(value.completionTotals);
  result.legacyCompletedChallenges = activityCount(value.legacyCompletedChallenges);
  result.sessionIntervals = Array.isArray(value.sessionIntervals)
    ? value.sessionIntervals.map(sanitizeSessionInterval).filter((interval): interval is ArchivedSessionInterval => interval !== null)
    : [];
  const minuteUnlockTotals: ArchivedUnlockCounts = { count: 0, seconds: 0 };
  if (isRecord(value.unlockMinutes)) {
    for (const [key, counts] of Object.entries(value.unlockMinutes)) {
      if (!validActivityMinute(key)) continue;
      const sanitized = sanitizeUnlockCounts(counts);
      if (sanitized.count) result.unlockMinutes[key] = sanitized;
      addUnlockCounts(minuteUnlockTotals, sanitized);
    }
  }
  const unlockTotals = sanitizeUnlockCounts(value.unlockTotals);
  result.unlockTotals = { count: Math.max(unlockTotals.count, minuteUnlockTotals.count), seconds: Math.max(unlockTotals.seconds, minuteUnlockTotals.seconds) };
  const minuteAttemptTotals: RecoveryAttemptSourceCounts = {};
  if (isRecord(value.attemptMinutes)) {
    for (const [key, counts] of Object.entries(value.attemptMinutes)) {
      if (!validActivityMinute(key)) continue;
      const sanitized = sanitizeSourceCounts(counts);
      if (Object.keys(sanitized).length) result.attemptMinutes[String(Number(key))] = sanitized;
      addSourceCounts(minuteAttemptTotals, sanitized);
    }
  }
  for (const source of recoveryAttemptSources) {
    const count = Math.max(result.attemptTotals[source] ?? 0, minuteAttemptTotals[source] ?? 0);
    if (count) result.attemptTotals[source] = count;
  }
  const minuteCompletionTotals: CompletionCategoryCounts = {};
  if (isRecord(value.completionMinutes)) {
    for (const [key, counts] of Object.entries(value.completionMinutes)) {
      if (!validActivityMinute(key)) continue;
      const sanitized = sanitizeCompletionCounts(counts);
      if (Object.keys(sanitized).length) result.completionMinutes[String(Number(key))] = sanitized;
      addCompletionCounts(minuteCompletionTotals, sanitized);
    }
  }
  if (isRecord(value.toolCompletionMinutes)) {
    for (const [minute, dates] of Object.entries(value.toolCompletionMinutes)) {
      if (!validActivityMinute(minute) || !isRecord(dates)) continue;
      for (const [dateKey, counts] of Object.entries(dates)) {
        if (!Number.isFinite(localDateKeyToUtcMs(dateKey))) continue;
        const sanitized = sanitizeCompletionCounts(counts);
        if (!Object.keys(sanitized).length) continue;
        result.toolCompletionMinutes[minute] ??= {};
        result.toolCompletionMinutes[minute][dateKey] = sanitized;
        addCompletionCounts(minuteCompletionTotals, sanitized);
      }
    }
  }
  for (const category of recoveryChallengeCategories) {
    for (const outcome of feedbackOutcomes) {
      const count = Math.max(result.completionTotals[category]?.[outcome] ?? 0, minuteCompletionTotals[category]?.[outcome] ?? 0);
      if (count) {
        result.completionTotals[category] ??= {};
        result.completionTotals[category]![outcome] = count;
      }
    }
  }
  return result;
}

function archiveAttempt(archive: RecoveryActivityArchive, attempt: BlockingAttempt) {
  if (attempt.result.verdict !== "block") return;
  const counts = { [attempt.source]: 1 };
  const minute = String(Math.floor(Date.parse(attempt.detectedAt) / 60_000));
  addSourceCounts(archive.attemptTotals, counts);
  if (!validActivityMinute(minute)) return;
  archive.attemptMinutes[minute] ??= {};
  addSourceCounts(archive.attemptMinutes[minute], counts);
}

function archiveCompletion(archive: RecoveryActivityArchive, completion: ChallengeCompletion) {
  const counts = { [completion.category]: { [completion.outcome]: 1 } };
  const minute = String(Math.floor(Date.parse(completion.completedAt) / 60_000));
  addCompletionCounts(archive.completionTotals, counts);
  if (!validActivityMinute(minute)) return;
  if (completion.source === 'tool' && completion.dateKey && Number.isFinite(localDateKeyToUtcMs(completion.dateKey))) {
    archive.toolCompletionMinutes[minute] ??= {};
    archive.toolCompletionMinutes[minute][completion.dateKey] ??= {};
    addCompletionCounts(archive.toolCompletionMinutes[minute][completion.dateKey], counts);
    return;
  }
  archive.completionMinutes[minute] ??= {};
  addCompletionCounts(archive.completionMinutes[minute], counts);
}

function archiveSession(archive: RecoveryActivityArchive, session: AppUsageSession) {
  archive.sessionIntervals.push(sessionInterval(session));
}

function archiveUnlock(archive: RecoveryActivityArchive, unlock: EarnedUnlock) {
  const counts = { count: 1, seconds: observedUnlockSeconds(unlock) };
  const minute = String(Math.floor(Date.parse(unlock.startedAt) / 60_000));
  addUnlockCounts(archive.unlockTotals, counts);
  if (!validActivityMinute(minute)) return;
  archive.unlockMinutes[minute] ??= { count: 0, seconds: 0 };
  addUnlockCounts(archive.unlockMinutes[minute], counts);
}

export function isProtectedAttempt(attempt: BlockingAttempt): boolean {
  return attempt.result.verdict === "block" && protectionAttemptSources.includes(attempt.source);
}

function visitRecoveryAttemptCounts(
  state: RecoveryState, startKey: string | undefined, endKey: string | undefined,
  visitor: (timestamp: number, counts: RecoveryAttemptSourceCounts) => void
) {
  const within = (timestamp: number) => {
    const key = getLocalDateKey(new Date(timestamp));
    return (!startKey || key >= startKey) && (!endKey || key <= endKey);
  };
  for (const [minute, counts] of Object.entries(state.activityArchive?.attemptMinutes ?? {})) {
    const timestamp = Number(minute) * 60_000;
    if (within(timestamp)) visitor(timestamp, counts);
  }
  for (const attempt of state.attempts) {
    if (attempt.result.verdict !== "block") continue;
    const timestamp = Date.parse(attempt.detectedAt);
    if (within(timestamp)) visitor(timestamp, { [attempt.source]: 1 });
  }
}

export function getRecoveryAttemptSourceCounts(state: RecoveryState, startKey?: string, endKey?: string): RecoveryAttemptSourceCounts {
  const result: RecoveryAttemptSourceCounts = {};
  if (!startKey && !endKey) {
    addSourceCounts(result, state.activityArchive?.attemptTotals ?? {});
    for (const attempt of state.attempts) if (attempt.result.verdict === "block") addSourceCounts(result, { [attempt.source]: 1 });
  } else {
    visitRecoveryAttemptCounts(state, startKey, endKey, (_, counts) => addSourceCounts(result, counts));
  }
  return result;
}

export function getProtectedAttemptCount(counts: RecoveryAttemptSourceCounts): number {
  return protectionAttemptSources.reduce((sum, source) => sum + (counts[source] ?? 0), 0);
}

export function getLifetimeProtectedAttemptCount(state: RecoveryState): number {
  return getProtectedAttemptCount(getRecoveryAttemptSourceCounts(state));
}

export function countProtectedAttemptsForDay(state: RecoveryState, day: Date | string = new Date()): number {
  const key = getLocalDateKey(day);
  return getProtectedAttemptCount(getRecoveryAttemptSourceCounts(state, key, key));
}

export function countRecoveryRiskMomentsForDay(state: RecoveryState, day: Date | string = new Date()): number {
  const key = getLocalDateKey(day);
  const counts = getRecoveryAttemptSourceCounts(state, key, key);
  return getProtectedAttemptCount(counts) + (counts["panic-button"] ?? 0);
}

export function getRecoveryRiskHourCounts(state: RecoveryState, startKey: string, endKey: string) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  visitRecoveryAttemptCounts(state, startKey, endKey, (timestamp, counts) => {
    hours[new Date(timestamp).getHours()].count += getProtectedAttemptCount(counts) + (counts["panic-button"] ?? 0);
  });
  return hours;
}

export type RecoveryChallengeCounts = {
  completed: number; helpful: number; stillUrging: number; unknown: number; answered: number;
  byCategory: Array<{ category: RecoveryChallenge["category"]; completed: number; helpful: number; answered: number }>;
};

function totalCompletionCounts(counts: CompletionCategoryCounts): RecoveryChallengeCounts {
  const byCategory = recoveryChallengeCategories.map(category => {
    const value = counts[category] ?? {};
    return { category, completed: (value.helped ?? 0) + (value["still-urging"] ?? 0) + (value.unknown ?? 0), helpful: value.helped ?? 0, answered: (value.helped ?? 0) + (value["still-urging"] ?? 0) };
  });
  const helpful = byCategory.reduce((sum, category) => sum + category.helpful, 0);
  const answered = byCategory.reduce((sum, category) => sum + category.answered, 0);
  const completed = byCategory.reduce((sum, category) => sum + category.completed, 0);
  return { completed, helpful, stillUrging: answered - helpful, unknown: completed - answered, answered, byCategory };
}

export function getRecoveryChallengeCounts(state: RecoveryState, startKey?: string, endKey?: string): RecoveryChallengeCounts {
  const counts: CompletionCategoryCounts = {};
  const within = (timestamp: string | number) => {
    const key = getLocalDateKey(typeof timestamp === "number" ? new Date(timestamp) : timestamp);
    return (!startKey || key >= startKey) && (!endKey || key <= endKey);
  };
  if (!startKey && !endKey) addCompletionCounts(counts, state.activityArchive?.completionTotals ?? {});
  else for (const [minute, archived] of Object.entries(state.activityArchive?.completionMinutes ?? {})) if (within(Number(minute) * 60_000)) addCompletionCounts(counts, archived);
  if (startKey || endKey) for (const dates of Object.values(state.activityArchive?.toolCompletionMinutes ?? {})) {
    for (const [dateKey, archived] of Object.entries(dates)) if ((!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey)) addCompletionCounts(counts, archived);
  }
  for (const completion of state.challengeHistory) {
    const inRange = completion.source === 'tool' && completion.dateKey
      ? (!startKey || completion.dateKey >= startKey) && (!endKey || completion.dateKey <= endKey)
      : within(completion.completedAt);
    if (inRange) addCompletionCounts(counts, { [completion.category]: { [completion.outcome]: 1 } });
  }
  const result = totalCompletionCounts(counts);
  if (!startKey && !endKey) {
    const total = Math.max(activityCount(state.completedChallenges), result.completed + (state.activityArchive?.legacyCompletedChallenges ?? 0));
    result.unknown += total - result.completed;
    result.completed = total;
  }
  return result;
}

export function getCurrentRecoveryStreakDays(state: RecoveryState, day: Date | string = new Date()): number {
  const at = typeof day === "string" ? Date.parse(day) : day.getTime();
  const derived = state.recoveryStartedAt ? calculateStreakDaysFrom(state.recoveryStartedAt, day) : activityCount(state.streakDays);
  const watermark = state.lastOpenedAt ? Date.parse(state.lastOpenedAt) : Number.NaN;
  return Number.isFinite(at) && Number.isFinite(watermark) && at < watermark ? Math.max(activityCount(state.streakDays), derived) : derived;
}

export function getRecoverySessionCounts(state: RecoveryState, startKey: string, endKey: string, asOf: Date | string = new Date()): { opens: number; foregroundSeconds: number } {
  const start = new Date(`${startKey}T00:00:00`).getTime();
  const end = new Date(`${endKey}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const endMs = end.getTime();
  const asOfMs = typeof asOf === "string" ? Date.parse(asOf) : asOf.getTime();
  let opens = 0;
  let foregroundSeconds = 0;
  const include = ([opened, closed, measured]: ArchivedSessionInterval) => {
    const key = getLocalDateKey(new Date(opened));
    if (key >= startKey && key <= endKey) opens += 1;
    const span = closed - opened;
    if (!Number.isFinite(span) || span <= 0) return;
    const overlap = Math.max(0, Math.min(closed, endMs) - Math.max(opened, start));
    foregroundSeconds += measured * overlap / span;
  };
  for (const interval of state.activityArchive?.sessionIntervals ?? []) include(interval);
  for (const session of state.appSessions) {
    if (session.closedAt !== null) include(sessionInterval(session));
    else {
      const opened = Date.parse(session.openedAt);
      include([opened, asOfMs, Math.min(86_400, Math.max(0, (asOfMs - opened) / 1_000))]);
    }
  }
  return { opens, foregroundSeconds };
}

export function getRecoveryUnlockCounts(state: RecoveryState, startKey?: string, endKey?: string): ArchivedUnlockCounts {
  const result: ArchivedUnlockCounts = { count: 0, seconds: 0 };
  const within = (timestamp: number) => {
    const key = getLocalDateKey(new Date(timestamp));
    return (!startKey || key >= startKey) && (!endKey || key <= endKey);
  };
  if (!startKey && !endKey) addUnlockCounts(result, state.activityArchive?.unlockTotals ?? { count: 0, seconds: 0 });
  else for (const [minute, counts] of Object.entries(state.activityArchive?.unlockMinutes ?? {})) if (within(Number(minute) * 60_000)) addUnlockCounts(result, counts);
  for (const unlock of state.earnedUnlocks) if (within(Date.parse(unlock.startedAt))) addUnlockCounts(result, { count: 1, seconds: observedUnlockSeconds(unlock) });
  return result;
}

export function buildPortableRecoverySessionState(state: RecoveryState, exportedAt: string): { appSessions: AppUsageSession[]; earnedUnlocks: EarnedUnlock[] } {
  const exportedMs = Date.parse(exportedAt);
  if (!Number.isFinite(exportedMs)) throw new Error("Recovery backup export time is invalid.");
  return {
    appSessions: state.appSessions.map(session => {
      if (session.closedAt !== null) return { ...session };
      const openedMs = Date.parse(session.openedAt);
      const closedMs = Math.max(openedMs, exportedMs);
      return { ...session, closedAt: new Date(closedMs).toISOString(), durationSec: Math.min(86_400, Math.max(0, Math.round((closedMs - openedMs) / 1_000))) };
    }),
    earnedUnlocks: state.earnedUnlocks.map(({ sourceAttemptHost: _source, nativeInterventionId: _nativeId, ...unlock }) => ({ ...unlock, historicalOnly: true as const }))
  };
}

/** Remote analytics uses located UTC days only; legacy undated totals stay local. */
export function getRecoveryUtcAnalyticsDayCounts(state: RecoveryState, end: Date | string = new Date()): AnalyticsUtcDayCounts[] {
  const endMs = typeof end === "string" ? Date.parse(end) : end.getTime();
  if (!Number.isFinite(endMs)) throw new Error("Analytics snapshot date is invalid.");
  const endDayMs = Math.floor(endMs / 86_400_000) * 86_400_000;
  const days = Array.from({ length: 14 }, (_unused, index): AnalyticsUtcDayCounts => ({
    day: new Date(endDayMs - (13 - index) * 86_400_000).toISOString().slice(0, 10), checkIns: 0, completedChallenges: 0
  }));
  const buckets = new Map(days.map(day => [day.day, day]));
  const bucketAt = (timestamp: number) => Number.isFinite(timestamp) ? buckets.get(new Date(timestamp).toISOString().slice(0, 10)) : undefined;
  for (const checkIn of state.dailyCheckIns) {
    if (!isCheckInCompleted(checkIn)) continue;
    const bucket = bucketAt(Date.parse(checkIn.createdAt));
    if (bucket) bucket.checkIns += 1;
  }
  for (const [minute, counts] of Object.entries(state.activityArchive.completionMinutes)) {
    const bucket = bucketAt(Number(minute) * 60_000);
    if (bucket) bucket.completedChallenges += totalCompletionCounts(counts).completed;
  }
  for (const [minute, dates] of Object.entries(state.activityArchive.toolCompletionMinutes ?? {})) {
    const bucket = bucketAt(Number(minute) * 60_000);
    if (bucket) for (const counts of Object.values(dates)) bucket.completedChallenges += totalCompletionCounts(counts).completed;
  }
  for (const completion of state.challengeHistory) {
    const bucket = bucketAt(Date.parse(completion.completedAt));
    if (bucket) bucket.completedChallenges += 1;
  }
  if (days.some(day => !Number.isSafeInteger(day.checkIns) || !Number.isSafeInteger(day.completedChallenges))) {
    throw new Error("Analytics counts exceed the supported exact range.");
  }
  return days;
}

export type AnalyticsUtcDayCounts = { day: string; checkIns: number; completedChallenges: number };
export type AnalyticsSnapshotCheckpoint = {
  lineageId: string | null;
  revision: number;
  snapshotId: string | null;
  // The exact absolute counters acknowledged by the server, never newer local counters.
  days: AnalyticsUtcDayCounts[];
};
export type AnalyticsPendingSnapshot = {
  schemaVersion: "aggregate-snapshot-v1";
  lineageId: string;
  baseRevision: number;
  snapshotId: string;
  days: AnalyticsUtcDayCounts[];
  consentVersion: "analytics-consent-v1";
  userOptedInAt: string;
  dataRetentionDays: 14;
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
  snapshotCheckpoint: AnalyticsSnapshotCheckpoint;
  pendingSnapshot: AnalyticsPendingSnapshot | null;
  updatedAt: string | null;
};

export type ProtectionActivationPlatform = "ios" | "android" | "web-preview";

export type BlockedDomainFeedback = {
  host: string;
  matchedRule: string;
  sourcePackage: string;
  reportedAt: string;
};

export type PledgeRecord = {
  dateKey: string;
  createdAt: string;
};

export type CoachChatEntry = {
  role: "user" | "ai";
  text: string;
  at: string;
};

export const MAX_COACH_CHAT_ENTRIES = 60;

export function sanitizeCoachChatEntries(value: unknown): CoachChatEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): CoachChatEntry | null => {
      if (!isRecord(entry)) return null;
      const role = entry.role === "user" || entry.role === "ai" ? entry.role : null;
      const text = typeof entry.text === "string" ? entry.text.slice(0, 1_000).trim() : "";
      const at = validIso(entry.at);
      if (!role || !text || !at) return null;
      return { role, text, at };
    })
    .filter((entry): entry is CoachChatEntry => Boolean(entry))
    .slice(0, MAX_COACH_CHAT_ENTRIES);
}

export type ProtectionSetupFallbackReason =
  | "reviewed-feed-unavailable"
  | "native-capability-unavailable"
  | "activation-not-ready";

/**
 * Recorded when the user cannot finish the strict protection setup on this
 * device (update service unreachable, capability missing in this build, or a
 * required native step that keeps failing). This is deliberately NOT an
 * activation marker: `hasProtectionActivationForPlatform` keeps failing, and
 * every protection surface must keep saying protection is incomplete.
 */
export type ProtectionSetupFallback = {
  acknowledgedAt: string;
  platform: ProtectionActivationPlatform;
  reason: ProtectionSetupFallbackReason;
};

export type RecoveryState = {
  version: typeof RECOVERY_STATE_VERSION;
  premium: boolean;
  premiumPlanId: PremiumPlanId | null;
  premiumPlanAudience: PremiumPlanAudience | null;
  premiumActivatedAt: string | null;
  premiumEntitlement: VerifiedPremiumEntitlement | null;
  automaticBackupEnabled: boolean;
  recoveryStartedAt: string | null;
  streakDays: number;
  bestStreakDays: number;
  completedChallenges: number;
  activityArchive: RecoveryActivityArchive;
  attempts: BlockingAttempt[];
  challengeHistory: ChallengeCompletion[];
  customChallenges: RecoveryChallenge[];
  dailyCheckIns: DailyCheckIn[];
  dailyHabits: DailyHabitCompletion[];
  personalPlanPreferences: PersonalPlanPreferences;
  personalDailyPlans: PersonalDailyPlan[];
  toolCompletions: ToolCompletionReceipt[];
  toolCompletionSessionIds: string[];
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
  journey: JourneyMetadata;
  onboardingPaywallPresentedAt: string | null;
  vpnDisclosureAcknowledgedAt: string | null;
  accountSkippedAt: string | null;
  signedInEmail: string | null;
  protectionActivatedAt: string | null;
  protectionActivationPlatform: ProtectionActivationPlatform | null;
  protectionSetupFallback: ProtectionSetupFallback | null;
  lastOpenedAt: string | null;
  lastProtectedAt: string | null;
  blockedDomainFeedback: BlockedDomainFeedback[];
  pledges: PledgeRecord[];
  coachMessages: CoachChatEntry[];
};

export function createDefaultReminderPreferences(): ReminderPreferences {
  return {
    contractVersion: REMINDER_CONTRACT_VERSION,
    revision: 0,
    effectiveStatus: "off",
    timezone: null,
    enabled: false,
    morningEnabled: true,
    eveningEnabled: true,
    guardEnabled: true,
    morningTime: "08:30",
    eveningTime: "21:00",
    guardTime: "22:45",
    scheduledIds: [],
    permissionStatus: "undetermined",
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
    appGuardMode: 'before-use',
    appGuardModeConfiguredAt: null,
    strictGuardConfiguredAt: null,
    dailyLimitMinutes: 30,
    shortFormInterruptionSeconds: 90,
    unlockDurationMinutes: 10,
    challengeIntensity: "balanced",
    outdoorChallengeFrequency: "balanced",
    exercisePreference: "balanced",
    socialChallengeFrequency: "low",
    blockedAppPackages: [],
    userAllowedDomains: [],
    emergencyStrictMode: false,
    sleepModeEnabled: false,
    sleepStartTime: "22:30",
    sleepEndTime: "06:30",
    deepFocusModeEnabled: false,
    workHoursEnabled: false,
    workStartTime: "09:00",
    workEndTime: "17:00",
    weekendModeEnabled: false,
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
    snapshotCheckpoint: { lineageId: null, revision: 0, snapshotId: null, days: [] },
    pendingSnapshot: null,
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
    premiumEntitlement: null,
    automaticBackupEnabled: false,
    recoveryStartedAt: null,
    streakDays: 0,
    bestStreakDays: 0,
    completedChallenges: 0,
    activityArchive: createDefaultRecoveryActivityArchive(),
    attempts: [],
    challengeHistory: [],
    customChallenges: [],
    dailyCheckIns: [],
    dailyHabits: [],
    personalPlanPreferences: createDefaultPersonalPlanPreferences(),
    personalDailyPlans: [],
    toolCompletions: [],
    toolCompletionSessionIds: [],
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
    journey: { entry: null, introCompletedAt: null },
    onboardingPaywallPresentedAt: null,
    vpnDisclosureAcknowledgedAt: null,
    accountSkippedAt: null,
    signedInEmail: null,
    protectionActivatedAt: null,
    protectionActivationPlatform: null,
    protectionSetupFallback: null,
    lastOpenedAt: null,
    lastProtectedAt: null,
    blockedDomainFeedback: [],
    pledges: [],
    coachMessages: []
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

const PROTECTION_SETUP_FALLBACK_REASONS: ProtectionSetupFallbackReason[] = [
  "reviewed-feed-unavailable",
  "native-capability-unavailable",
  "activation-not-ready"
];

function sanitizeProtectionSetupFallback(value: unknown): ProtectionSetupFallback | null {
  if (!isRecord(value)) return null;
  const acknowledgedAt = validIso(value.acknowledgedAt);
  const platform = sanitizeProtectionActivationPlatform(value.platform);
  const reason =
    typeof value.reason === "string" &&
    (PROTECTION_SETUP_FALLBACK_REASONS as string[]).includes(value.reason)
      ? (value.reason as ProtectionSetupFallbackReason)
      : null;
  if (!acknowledgedAt || !platform || !reason) return null;
  return { acknowledgedAt, platform, reason };
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

function sanitizeNativeInterventionId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : undefined;
}

function sanitizeCompletion(value: unknown): ChallengeCompletion | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (!["physical", "breathing", "reflection", "connection", "reset"].includes(String(value.category))) return null;

  return {
    id: value.id,
    ...(typeof value.sessionId === "string" && /^[A-Za-z0-9:_-]{1,160}$/.test(value.sessionId) ? { sessionId: value.sessionId } : {}),
    ...(typeof value.observedActiveSec === "number" && Number.isFinite(value.observedActiveSec) && value.observedActiveSec >= 0 ? { observedActiveSec: Math.min(3600, value.observedActiveSec) } : {}),
    ...(sanitizeCompletionProvenance(value.provenance, value.id) ? { provenance: sanitizeCompletionProvenance(value.provenance, value.id) } : {}),
    title: value.title,
    category: value.category as ChallengeCompletion["category"],
    outcome: value.outcome === "still-urging" || value.outcome === "helped" ? value.outcome : "unknown",
    completedAt: validIso(value.completedAt) ?? new Date(0).toISOString(),
    durationSec: Math.max(0, finiteNumber(value.durationSec, 0)),
    premium: Boolean(value.premium),
    sourceAttemptHost: sanitizeSourceAttemptHost(value.sourceAttemptHost),
    ...(value.source === 'tool' ? { source: 'tool' as const, ...(typeof value.dateKey === 'string' && Number.isFinite(localDateKeyToUtcMs(value.dateKey)) ? { dateKey: value.dateKey } : {}), ...(typeof value.toolId === 'string' ? { toolId: value.toolId.slice(0, 160) } : {}) } : {})
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
  const verification = normalizeChallengeRule(value.verification);
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
    ...(verification ? { verification } : {}),
    why:
      typeof value.why === "string" && value.why.trim().length > 0
        ? value.why.trim().replace(/\s+/g, " ").slice(0, 180)
        : "This is a user-created recovery reset for moments when a familiar action works best."
  };
}

/** Legacy records infer purpose from explicit answers; new records carry the intent. */
export function isCheckInCompleted(record: DailyCheckIn | null | undefined): boolean {
  if (!record) return false;
  const answered = record.mood !== null && record.mood !== undefined && typeof record.urgeLevel === 'number' && Number.isFinite(record.urgeLevel);
  return answered && record.checkInCompleted !== false;
}
export function hasSavedJournal(record: DailyCheckIn | null | undefined): boolean {
  return Boolean(record && record.reflection.trim().length > 0 && record.journalSaved !== false);
}
function nullableAnswer(value: unknown, minimum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(minimum, Math.round(value))) : null;
}
function sanitizeCheckIn(value: unknown): DailyCheckIn | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.dateKey !== 'string' || !Number.isFinite(localDateKeyToUtcMs(value.dateKey))) return null;
  const mood = ['low', 'steady', 'energized', 'stressed'].includes(String(value.mood)) ? value.mood as MoodLevel : null;
  const urgeLevel = nullableAnswer(value.urgeLevel, 0);
  const sleepQuality = nullableAnswer(value.sleepQuality, 1);
  const reflection = typeof value.reflection === 'string' ? value.reflection.slice(0, 4000) : '';
  return {
    id: value.id, dateKey: value.dateKey, mood, urgeLevel, sleepQuality, reflection,
    checkInCompleted: mood !== null && urgeLevel !== null && value.checkInCompleted !== false,
    journalSaved: reflection.trim().length > 0 && value.journalSaved !== false,
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
  const legacyPermission = value.permissionStatus === "granted" ? "authorized"
    : value.permissionStatus === "unknown" ? "undetermined"
    : value.permissionStatus === "unavailable" ? "unsupported" : value.permissionStatus;
  const permissionStatus = ["authorized", "provisional", "ephemeral", "denied", "undetermined", "unsupported"].includes(String(legacyPermission))
    ? legacyPermission as ReminderPermissionStatus : fallback.permissionStatus;
  const enabled = value.enabled === true;
  const scheduledIds = Array.isArray(value.scheduledIds) ? [...new Set(value.scheduledIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 16) : [];
  // A persisted legacy 'granted' and a list of IDs are not native readback evidence.
  let effectiveStatus: ReminderEffectiveStatus = enabled ? "pending" : "off";
  if (value.contractVersion === REMINDER_CONTRACT_VERSION && ["off", "pending", "active", "quiet", "permission-required", "failed"].includes(String(value.effectiveStatus))) {
    effectiveStatus = value.effectiveStatus as ReminderEffectiveStatus;
    if ((effectiveStatus === "active" || effectiveStatus === "quiet") && (!enabled || !scheduledIds.length || !["authorized", "provisional", "ephemeral"].includes(permissionStatus))) effectiveStatus = enabled ? "pending" : "off";
    if (enabled && effectiveStatus === "off" && (value.morningEnabled !== false || value.eveningEnabled !== false || value.guardEnabled !== false)) effectiveStatus = "pending";
  }
  return {
    contractVersion: REMINDER_CONTRACT_VERSION,
    revision: Math.max(0, Math.trunc(finiteNumber(value.revision, 0))),
    effectiveStatus,
    timezone: typeof value.timezone === "string" ? value.timezone.slice(0, 100) : null,
    enabled,
    morningEnabled: typeof value.morningEnabled === "boolean" ? value.morningEnabled : fallback.morningEnabled,
    eveningEnabled: typeof value.eveningEnabled === "boolean" ? value.eveningEnabled : fallback.eveningEnabled,
    guardEnabled: typeof value.guardEnabled === "boolean" ? value.guardEnabled : fallback.guardEnabled,
    morningTime: sanitizeClockTime(value.morningTime, fallback.morningTime),
    eveningTime: sanitizeClockTime(value.eveningTime, fallback.eveningTime),
    guardTime: sanitizeClockTime(value.guardTime, fallback.guardTime),
    scheduledIds,
    permissionStatus,
    statusMessage: value.contractVersion !== REMINDER_CONTRACT_VERSION
      ? enabled ? "Checking recovery reminders on this device." : fallback.statusMessage
      : typeof value.statusMessage === "string" ? value.statusMessage.slice(0, 180) : fallback.statusMessage,
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

function sanitizeEmailOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 254 ? normalized : null;
}

// Hosts the user asked FREED to always allow. Mirrors the native/Kotlin
// normalization: lowercase, no scheme/path/port, no leading www., bounded count.
function sanitizeUserAllowedDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const host = item
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .split("@")
      .pop()!
      .split(":")[0]
      .replace(/^www\./, "")
      .replace(/[^a-z0-9.-]/g, "")
      .replace(/^\.+|\.+$/g, "");
    if (!host.includes(".") || host.length < 4 || host.length > 253) continue;
    if (host.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    if (seen.size >= 200) break;
  }

  return [...seen];
}

function sanitizeDisciplineSettings(value: unknown): DisciplineSettings {
  const fallback = createDefaultDisciplineSettings();
  if (!isRecord(value)) return { ...fallback, appGuardMode: 'daily-limit' };
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
    // Stored settings predate mode selection: preserve their daily-limit behavior.
    appGuardMode: value.appGuardMode === 'before-use' || value.appGuardMode === 'scheduled' ? value.appGuardMode : 'daily-limit',
    appGuardModeConfiguredAt: validIso(value.appGuardModeConfiguredAt),
    strictGuardConfiguredAt: validIso(value.strictGuardConfiguredAt),
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
    userAllowedDomains: sanitizeUserAllowedDomains(value.userAllowedDomains),
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
  const boundedExpiresAt = new Date(Math.min(expiresMs, startedMs + durationMinutes * 60_000)).toISOString();
  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim().slice(0, 96)
      : `unlock-${Date.parse(startedAt)}`;
  const sourceChallengeId =
    typeof value.sourceChallengeId === "string" && value.sourceChallengeId.trim().length > 0
      ? value.sourceChallengeId.trim().slice(0, 96)
      : "unknown-challenge";
  const nativeInterventionId = sanitizeNativeInterventionId(value.nativeInterventionId);

  return {
    id,
    startedAt,
    expiresAt: boundedExpiresAt,
    durationMinutes,
    sourceChallengeId,
    sourceAttemptHost: sanitizeSourceAttemptHost(value.sourceAttemptHost),
    ...(nativeInterventionId ? { nativeInterventionId } : {}),
    ...(value.historicalOnly === true ? { historicalOnly: true as const } : {})
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
  const durationSec = Math.max(0, Math.min(86_400, closedMs !== null ? measuredDuration : 0, Math.round(finiteNumber(value.durationSec, measuredDuration))));

  return {
    id: typeof value.id === "string" && value.id.trim().length > 0 ? value.id.trim().slice(0, 96) : `app-session-${openedMs}`,
    openedAt,
    closedAt: closedAt && closedMs !== null && closedMs >= openedMs ? closedAt : null,
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
  const snapshotCheckpoint = sanitizeAnalyticsSnapshotCheckpoint(value.snapshotCheckpoint);

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
    snapshotCheckpoint,
    pendingSnapshot: sanitizeAnalyticsPendingSnapshot(value.pendingSnapshot, snapshotCheckpoint),
    updatedAt: validIso(value.updatedAt)
  };
}

function sanitizeAnalyticsPendingSnapshot(value: unknown, checkpoint: AnalyticsSnapshotCheckpoint): AnalyticsPendingSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== "aggregate-snapshot-v1" || value.consentVersion !== "analytics-consent-v1" ||
      value.dataRetentionDays !== 14 || value.lineageId !== checkpoint.lineageId || value.baseRevision !== checkpoint.revision ||
      typeof value.snapshotId !== "string" || !/^snap_[a-f0-9]{64}$/.test(value.snapshotId) ||
      typeof value.userOptedInAt !== "string" || !Number.isFinite(Date.parse(value.userOptedInAt))) return null;
  const checked = sanitizeAnalyticsSnapshotCheckpoint({ lineageId: value.lineageId, revision: 1, snapshotId: value.snapshotId, days: value.days });
  if (!checked.lineageId || checked.days.length !== 14) return null;
  return { schemaVersion: "aggregate-snapshot-v1", lineageId: checked.lineageId, baseRevision: checkpoint.revision,
    snapshotId: value.snapshotId, days: checked.days, consentVersion: "analytics-consent-v1",
    userOptedInAt: value.userOptedInAt, dataRetentionDays: 14 };
}

function sanitizeAnalyticsSnapshotCheckpoint(value: unknown): AnalyticsSnapshotCheckpoint {
  const fallback: AnalyticsSnapshotCheckpoint = { lineageId: null, revision: 0, snapshotId: null, days: [] };
  if (!isRecord(value) || typeof value.lineageId !== "string" || !/^lin_[a-f0-9]{32}$/.test(value.lineageId)) return fallback;
  const revision = Number.isSafeInteger(value.revision) && (value.revision as number) >= 0 ? value.revision as number : 0;
  if (revision === 0) return { ...fallback, lineageId: value.lineageId };
  if (typeof value.snapshotId !== "string" || !/^snap_[a-f0-9]{64}$/.test(value.snapshotId) || !Array.isArray(value.days) || value.days.length !== 14) return fallback;
  const days: AnalyticsUtcDayCounts[] = [];
  for (const bucket of value.days) {
    if (!isRecord(bucket) || typeof bucket.day !== "string") return fallback;
    const timestamp = Date.parse(`${bucket.day}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket.day) || !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== bucket.day ||
        !Number.isSafeInteger(bucket.checkIns) || (bucket.checkIns as number) < 0 ||
        !Number.isSafeInteger(bucket.completedChallenges) || (bucket.completedChallenges as number) < 0) return fallback;
    if (days.length && Date.parse(`${bucket.day}T00:00:00.000Z`) - Date.parse(`${days[days.length - 1].day}T00:00:00.000Z`) !== 86_400_000) return fallback;
    days.push({ day: bucket.day, checkIns: bucket.checkIns as number, completedChallenges: bucket.completedChallenges as number });
  }
  return { lineageId: value.lineageId, revision, snapshotId: value.snapshotId, days };
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
  const personalDailyPlans = Array.isArray(value.personalDailyPlans) ? value.personalDailyPlans.map(sanitizePersonalDailyPlan).filter((plan): plan is PersonalDailyPlan => Boolean(plan)) : [];
  const toolCompletions = Array.isArray(value.toolCompletions) ? value.toolCompletions.map(sanitizeToolCompletionReceipt).filter((receipt): receipt is ToolCompletionReceipt => Boolean(receipt)) : [];
  const toolCompletionSessionIds = sanitizeToolSessionIds([...(Array.isArray(value.toolCompletionSessionIds) ? value.toolCompletionSessionIds : []), ...toolCompletions.map(receipt => receipt.sessionId), ...challengeHistory.filter(receipt => receipt.source === 'tool').map(receipt => receipt.sessionId)]);
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
  const activityArchive = sanitizeRecoveryActivityArchive(value.activityArchive);
  const orderedUnlocks = earnedUnlocks.sort((left, right) => Date.parse(right.expiresAt) - Date.parse(left.expiresAt));
  // Keep an active session ahead of closed detail even after a clock rollback.
  const orderedSessions = appSessions.sort((left, right) => Number(right.closedAt === null) - Number(left.closedAt === null) || Date.parse(right.openedAt) - Date.parse(left.openedAt));
  for (const attempt of attempts.slice(100)) archiveAttempt(activityArchive, attempt);
  for (const completion of challengeHistory.slice(200)) archiveCompletion(activityArchive, completion);
  for (const session of orderedSessions.slice(120)) archiveSession(activityArchive, session);
  for (const unlock of orderedUnlocks.slice(40)) archiveUnlock(activityArchive, unlock);
  const knownCompletions = totalCompletionCounts(activityArchive.completionTotals).completed + storedChallengeHistory.length;
  activityArchive.legacyCompletedChallenges = Math.max(
    activityArchive.legacyCompletedChallenges,
    Math.max(0, activityCount(value.completedChallenges) - knownCompletions)
  );

  return {
    version: RECOVERY_STATE_VERSION,
    premium: Boolean(value.premium),
    premiumPlanId: Boolean(value.premium) ? sanitizePremiumPlanId(value.premiumPlanId) : null,
    premiumPlanAudience: Boolean(value.premium)
      ? premiumAudienceForPlan(sanitizePremiumPlanId(value.premiumPlanId))
      : null,
    premiumActivatedAt: Boolean(value.premium) ? validIso(value.premiumActivatedAt) : null,
    premiumEntitlement: sanitizePremiumEntitlement(value.premiumEntitlement),
    automaticBackupEnabled: value.automaticBackupEnabled === true,
    recoveryStartedAt,
    streakDays,
    bestStreakDays,
    completedChallenges: knownCompletions + activityArchive.legacyCompletedChallenges,
    activityArchive,
    attempts: attempts.slice(0, 100),
    challengeHistory: storedChallengeHistory,
    customChallenges: customChallenges.slice(0, 12),
    dailyCheckIns: dailyCheckIns.slice(0, 120),
    dailyHabits: dailyHabits.slice(0, 400),
    personalPlanPreferences: sanitizePersonalPlanPreferences(value.personalPlanPreferences),
    personalDailyPlans: personalDailyPlans.filter((plan, index, plans) => plans.findIndex(item => item.dateKey === plan.dateKey) === index).slice(0, 400),
    toolCompletions: toolCompletions.filter((receipt, index, receipts) => receipts.findIndex(item => item.sessionId === receipt.sessionId) === index).slice(0, TOOL_COMPLETION_DETAIL_LIMIT),
    toolCompletionSessionIds,
    relapseRecords: relapseRecords.slice(0, 80),
    reminders: sanitizeReminderPreferences(value.reminders),
    accountability: sanitizeAccountabilityPartner(value.accountability),
    supportCircle: supportCircle.slice(0, 6),
    disciplineSettings: sanitizeDisciplineSettings(value.disciplineSettings),
    earnedUnlocks: orderedUnlocks.slice(0, 40),
    appSessions: orderedSessions.slice(0, 120),
    analyticsSharing: sanitizeAnalyticsSharingSettings(value.analyticsSharing),
    answers,
    hasCompletedOnboarding: Boolean(value.hasCompletedOnboarding),
    journey: sanitizeJourneyMetadata(value.journey),
    onboardingPaywallPresentedAt: validIso(value.onboardingPaywallPresentedAt),
    vpnDisclosureAcknowledgedAt: validIso(value.vpnDisclosureAcknowledgedAt),
    accountSkippedAt: validIso(value.accountSkippedAt),
    signedInEmail: sanitizeEmailOrNull(value.signedInEmail),
    protectionActivatedAt: validIso(value.protectionActivatedAt),
    protectionActivationPlatform: sanitizeProtectionActivationPlatform(value.protectionActivationPlatform),
    protectionSetupFallback: sanitizeProtectionSetupFallback(value.protectionSetupFallback),
    lastOpenedAt: validIso(value.lastOpenedAt),
    lastProtectedAt: validIso(value.lastProtectedAt),
    blockedDomainFeedback: Array.isArray(value.blockedDomainFeedback)
      ? value.blockedDomainFeedback
          .map(sanitizeBlockedDomainFeedback)
          .filter((item): item is BlockedDomainFeedback => Boolean(item))
          .slice(0, 50)
      : [],
    pledges: Array.isArray(value.pledges)
      ? value.pledges
          .map(sanitizePledgeRecord)
          .filter((item): item is PledgeRecord => Boolean(item))
          .slice(0, 400)
      : [],
    coachMessages: sanitizeCoachChatEntries(value.coachMessages)
  };
}

function sanitizePledgeRecord(value: unknown): PledgeRecord | null {
  if (!isRecord(value)) return null;
  const dateKey = typeof value.dateKey === "string" ? value.dateKey.trim().slice(0, 10) : "";
  const createdAt = validIso(value.createdAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !createdAt) return null;
  return { dateKey, createdAt };
}

function sanitizeBlockedDomainFeedback(value: unknown): BlockedDomainFeedback | null {
  if (!isRecord(value)) return null;
  const host = typeof value.host === "string" ? value.host.trim().toLowerCase().slice(0, 253) : "";
  const matchedRule = typeof value.matchedRule === "string" ? value.matchedRule.trim().slice(0, 96) : "";
  const sourcePackage = typeof value.sourcePackage === "string" ? value.sourcePackage.trim().slice(0, 64) : "";
  const reportedAt = validIso(value.reportedAt);
  if (!host || !reportedAt) return null;
  return { host, matchedRule, sourcePackage, reportedAt };
}

export function getLocalDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateKeyToUtcMs(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return Number.NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible keys such as 2026-02-30, which Date.UTC would otherwise roll forward.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return Number.NaN;
  }
  return date.getTime();
}

/**
 * Whole calendar days between two local date keys. UTC arithmetic has no DST transitions, so a
 * local day that runs 23 or 25 hours still counts as exactly one day.
 */
export function localDateKeyDiffDays(fromKey: string, toKey: string) {
  const fromMs = localDateKeyToUtcMs(fromKey);
  const toMs = localDateKeyToUtcMs(toKey);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.round((toMs - fromMs) / 86_400_000);
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

export function isWeekendModeActive(settings: DisciplineSettings, day: Date | string = new Date()) {  if (!settings.weekendModeEnabled) return false;
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

export function calculateStreakDaysFrom(startedAt: string | null, day: Date | string = new Date()) {
  if (!startedAt) return 0;
  const startedKey = getLocalDateKey(startedAt);
  const dayKey = getLocalDateKey(day);
  if (!startedKey || !dayKey) return 0;

  const elapsedDays = localDateKeyDiffDays(startedKey, dayKey);
  return elapsedDays > 0 ? elapsedDays : 0;
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
  const helpfulChallenges = getRecoveryChallengeCounts(state).helpful;
  return Math.max(
    0,
    state.streakDays * 12 +
      state.bestStreakDays * 4 +
      state.completedChallenges * 45 +
      helpfulChallenges * 20 +
      state.dailyCheckIns.filter(isCheckInCompleted).length * 18 +
      getLifetimeProtectedAttemptCount(state) * 8
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
  const helpfulChallenges = getRecoveryChallengeCounts(state).helpful;
  const checkIns = state.dailyCheckIns.filter(isCheckInCompleted).length;
  const protectedAttempts = getLifetimeProtectedAttemptCount(state);
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

function getMomentumLabel(state: RecoveryState, startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Needs more signal";

  const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;
  let early = 0;
  let recent = 0;
  visitRecoveryAttemptCounts(state, startKey, endKey, (timestamp, counts) => {
    const risk = getProtectedAttemptCount(counts) + (counts["panic-button"] ?? 0);
    if (timestamp < midpoint) early += risk;
    else recent += risk;
  });
  if (early + recent < 2) return "Needs more signal";

  if (recent >= early + 2) return "Risk rising";
  if (early >= recent + 2) return "Risk easing";
  return "Stable";
}

function getRiskWindowLabel(state: RecoveryState, startKey: string, endKey: string): string {
  const periods = ["Late night", "Morning", "Afternoon", "Evening"];
  const counts = [0, 0, 0, 0];
  for (const bucket of getRecoveryRiskHourCounts(state, startKey, endKey)) counts[Math.floor(bucket.hour / 6)] += bucket.count;
  const ordered = periods.map((label, index) => ({ label, count: counts[index] })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  return ordered[0].count > 0 ? ordered[0].label : "No clear pattern yet";
}

function getBestInterventionForRange(state: RecoveryState, detailed: ChallengeCompletion[], startKey: string, endKey: string): string {
  const totals = getRecoveryChallengeCounts(state, startKey, endKey);
  const knownHelpful = detailed.filter(completion => completion.outcome === "helped").length;
  if (totals.helpful <= knownHelpful) return getBestInterventionLabel(detailed);
  const best = [...totals.byCategory].sort((left, right) => right.helpful - left.helpful || left.category.localeCompare(right.category))[0];
  const labels = { physical: "Physical resets", breathing: "Breathing resets", reflection: "Reflection resets", connection: "Connection resets", reset: "Practical resets" };
  return best?.helpful > 0 ? labels[best.category] : "More completions needed";
}

function summarizeCheckInRecords(records: DailyCheckIn[]): Omit<CheckInSummary, "latest"> {
  const completed = records.filter(isCheckInCompleted);
  const urges = completed.flatMap(item => item.urgeLevel === null ? [] : [item.urgeLevel]);
  const sleeps = completed.flatMap(item => item.sleepQuality === null ? [] : [item.sleepQuality]);
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
  return { total: completed.length, averageUrge: average(urges), averageSleep: average(sleeps),
    steadyDays: completed.filter(item => item.mood === 'steady' || item.mood === 'energized').length };
}

export function recordDailyCheckIn(
  state: RecoveryState,
  input: DailyCheckInInput,
  checkedAt = new Date().toISOString()
): RecoveryState {
  const dateKey = getLocalDateKey(checkedAt);
  const existing = getDailyCheckInForDay(state, checkedAt);
  if (!dateKey) throw new RangeError('checkin-date-invalid');
  const reflection = input.reflection === undefined ? existing?.reflection ?? '' : input.reflection.slice(0, 4000);
  const mood = ['low', 'steady', 'energized', 'stressed'].includes(String(input.mood)) ? input.mood : null;
  const urgeLevel = nullableAnswer(input.urgeLevel, 0);
  const checkIn: DailyCheckIn = {
    id: existing?.id ?? `checkin-${dateKey}`,
    dateKey,
    mood, urgeLevel, sleepQuality: nullableAnswer(input.sleepQuality, 1), reflection,
    checkInCompleted: mood !== null && urgeLevel !== null, journalSaved: reflection.trim().length > 0,
    createdAt: existing?.createdAt ?? checkedAt,
    updatedAt: checkedAt
  };

  return hydrateRecoveryState({
    ...markPersonalPlanDate(state, checkedAt),
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
    ...markPersonalPlanDate(state, updatedAt),
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
    ...markPersonalPlanDate(state, safeOccurredAt),
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

  if (summary.averageSleep > 0 && summary.averageSleep <= 2.5) {
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
  const attemptCounts = getRecoveryAttemptSourceCounts(state, startKey, endKey);
  const protectedAttempts = getProtectedAttemptCount(attemptCounts);
  const completedChallenges = state.challengeHistory.filter((challenge) => {
    const key = challenge.source === 'tool' && challenge.dateKey ? challenge.dateKey : getLocalDateKey(challenge.completedAt);
    return key >= startKey && key <= endKey;
  });
  const relapses = state.relapseRecords.filter((record) => {
    const key = getLocalDateKey(record.occurredAt);
    return key >= startKey && key <= endKey;
  });
  const challengeCounts = getRecoveryChallengeCounts(state, startKey, endKey);
  const riskWindow = getRiskWindowLabel(state, startKey, endKey);
  const slipWindow = mostCommonLabel(relapses.map((record) => hourBucketLabel(record.occurredAt))) ?? "No slips logged";
  const slipTrigger = mostCommonLabel(relapses.map((record) => record.trigger ?? "Unlabeled")) ?? "No slips logged";
  const bestIntervention = getBestInterventionForRange(state, completedChallenges, startKey, endKey);
  const momentum = getMomentumLabel(state, startKey, endKey);

  const strongestPattern =
    relapses.length > 0 && protectedAttempts === 0
      ? "A slip was logged honestly; use that data to shape the next safer window."
      : relapses.length > 0
      ? "Risk moments and honest reset logs both point to a pattern worth protecting early."
      : protectedAttempts === 0
      ? "No blocked attempts landed in the last seven days."
      : protectedAttempts >= 3
      ? "Risk moments clustered this week; plan friction before the highest-risk window."
      : "FREED interrupted risk early enough for recovery actions to work.";

  const nextFocus =
    relapses.length > 0 && slipTrigger !== "No slips logged"
      ? `Treat ${slipTrigger.toLowerCase()} as the next setup cue. Add one physical barrier before ${slipWindow.toLowerCase()} and start with a short reset instead of willpower.`
      : summary.total < 3
      ? "Build the check-in rhythm so the intervention engine has better signal."
      : summary.averageSleep > 0 && summary.averageSleep <= 2.5
      ? "Protect sleep first; low sleep is the strongest relapse amplifier this week."
      : summary.averageUrge >= 4
      ? "Prepare body-first resets before urge intensity rises."
      : challengeCounts.helpful > 0
      ? "Repeat the interventions that already helped instead of adding complexity."
      : "Keep the routine simple: check in, protect the phone boundary, and act early.";

  const wins = [
    `${challengeCounts.completed} recovery ${challengeCounts.completed === 1 ? "challenge" : "challenges"} completed`,
    `${summary.steadyDays} steady or energized ${summary.steadyDays === 1 ? "day" : "days"} logged`,
    protectedAttempts === 0 ? "No protected risk attempts this week" : `${protectedAttempts} risk ${protectedAttempts === 1 ? "moment was" : "moments were"} interrupted`,
    relapses.length === 0 ? "No slips logged this week" : `${relapses.length} honest ${relapses.length === 1 ? "reset was" : "resets were"} logged`
  ];

  return {
    rangeLabel: `${startKey} to ${endKey}`,
    attempts: protectedAttempts,
    slips: relapses.length,
    completedChallenges: challengeCounts.completed,
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
  const attemptCounts = getRecoveryAttemptSourceCounts(state, startKey, endKey);
  const completedChallenges = state.challengeHistory.filter((challenge) => {
    const key = challenge.source === 'tool' && challenge.dateKey ? challenge.dateKey : getLocalDateKey(challenge.completedAt);
    return key >= startKey && key <= endKey;
  });
  const challengeCounts = getRecoveryChallengeCounts(state, startKey, endKey);
  const relapses = state.relapseRecords.filter((record) => {
    const key = getLocalDateKey(record.occurredAt);
    return key >= startKey && key <= endKey;
  });
  const protectedMoments = getProtectedAttemptCount(attemptCounts);
  const appInterventions = attemptCounts.app ?? 0;
  const selfReportedUrges = attemptCounts["panic-button"] ?? 0;
  const riskWindow = getRiskWindowLabel(state, startKey, endKey);
  const slipWindow = mostCommonLabel(relapses.map((record) => hourBucketLabel(record.occurredAt))) ?? "No slips logged";
  const slipTrigger = mostCommonLabel(relapses.map((record) => record.trigger ?? "Unlabeled")) ?? "No slips logged";
  const bestIntervention = getBestInterventionForRange(state, completedChallenges, startKey, endKey);
  const signalCount = protectedMoments + selfReportedUrges + challengeCounts.completed + checkInSummary.total + relapses.length;
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
                challengeCounts.completed * 5 +
                challengeCounts.helpful * 7 +
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
      : challengeCounts.helpful >= 3
      ? "Helpful resets are becoming repeatable. Keep the same playbook close to the moments where risk shows up."
      : protectedMoments > 0
      ? "FREED interrupted real risk this month. The next gain is turning those interruptions into completed resets."
      : selfReportedUrges > 0
      ? "You asked for urge support this month. Keep practicing the resets that help."
      : "The month is quiet. Keep check-ins steady so early warning signals stay visible.";

  const nextExperiment =
    relapses.length > 0 && slipTrigger !== "No slips logged"
      ? `Before ${slipWindow.toLowerCase()}, treat ${slipTrigger.toLowerCase()} as the setup cue and start one short body reset early.`
      : checkInSummary.averageSleep > 0 && checkInSummary.averageSleep <= 2.5
      ? "Run a seven-night sleep guard experiment: phone away from bed, Night Guard on, and one calm reset before the window."
      : challengeCounts.helpful > 0
      ? `Repeat ${bestIntervention.toLowerCase()} first when the next risk signal appears.`
      : checkInSummary.total < 8
      ? "Make daily check-ins the experiment. More signal means better interventions."
      : "Keep the current routine and add one small friction point before the highest-risk window.";

  return {
    rangeLabel: `${startKey} to ${endKey}`,
    protectedMoments,
    appInterventions,
    selfReportedUrges,
    completedChallenges: challengeCounts.completed,
    helpfulChallenges: challengeCounts.helpful,
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
      `${challengeCounts.helpful} helpful ${challengeCounts.helpful === 1 ? "reset" : "resets"}`,
      `${checkInSummary.total} real ${checkInSummary.total === 1 ? "check-in" : "check-ins"}`,
      relapses.length === 0 ? "No slips logged in the range" : `${relapses.length} honest ${relapses.length === 1 ? "reset" : "resets"} logged`
    ]
  };
}

export function updateReminderPreferences(
  state: RecoveryState,
  update: ReminderPreferenceUpdate,
  updatedAt = new Date().toISOString()
): RecoveryState {
  // Only intent fields may enter through the user-facing update boundary.
  const allowed: ReminderPreferenceUpdate = {};
  for (const key of ["enabled", "morningEnabled", "eveningEnabled", "guardEnabled", "morningTime", "eveningTime", "guardTime"] as const) {
    if (key in update) Object.assign(allowed, { [key]: update[key] });
  }
  return hydrateRecoveryState({
    ...state,
    reminders: {
      ...state.reminders,
      ...allowed,
      revision: state.reminders.revision + 1,
      effectiveStatus: "pending",
      statusMessage: "Checking recovery reminders on this device.",
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
    effectiveStatus?: ReminderEffectiveStatus;
    revision?: number;
    timezone?: string | null;
    stale?: boolean;
    enabled?: boolean;
  },
  syncedAt = new Date().toISOString()
): RecoveryState {
  if (result.stale || (result.revision !== undefined && result.revision !== state.reminders.revision)) return state;
  const effectiveStatus = result.effectiveStatus ?? (state.reminders.enabled ? "pending" : "off");
  return hydrateRecoveryState({
    ...state,
    reminders: {
      ...state.reminders,
      scheduledIds: result.scheduledIds,
      permissionStatus: result.permissionStatus,
      effectiveStatus,
      timezone: result.timezone ?? state.reminders.timezone,
      statusMessage: result.statusMessage,
      lastScheduledAt: ["active", "quiet"].includes(effectiveStatus) ? syncedAt : state.reminders.lastScheduledAt
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
      ...(update.appGuardMode !== undefined ? { appGuardModeConfiguredAt: updatedAt } : {}),
      ...(update.emergencyStrictMode !== undefined || update.deepFocusModeEnabled !== undefined ? { strictGuardConfiguredAt: updatedAt } : {}),
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
      .filter((unlock) => !unlock.historicalOnly && Date.parse(unlock.startedAt) <= atMs && Date.parse(unlock.expiresAt) > atMs)
      .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] ?? null
  );
}

export function recordEarnedUnlock(
  state: RecoveryState,
  challenge: RecoveryChallenge,
  options: { durationMinutes?: number; sourceAttemptHost?: string; nativeInterventionId?: string; startedAt?: string } = {}
): RecoveryState {
  const startedAt = validIso(options.startedAt) ?? new Date().toISOString();
  const durationMinutes = clampInteger(options.durationMinutes, state.disciplineSettings.unlockDurationMinutes, 1, MAX_EARNED_UNLOCK_MINUTES);
  const expiresAt = new Date(Date.parse(startedAt) + durationMinutes * 60_000).toISOString();
  const nativeInterventionId = sanitizeNativeInterventionId(options.nativeInterventionId);
  const unlock: EarnedUnlock = {
    id: `unlock-${Date.parse(startedAt)}-${challenge.id}`,
    startedAt,
    expiresAt,
    durationMinutes,
    sourceChallengeId: challenge.id,
    sourceAttemptHost: sanitizeSourceAttemptHost(options.sourceAttemptHost),
    ...(nativeInterventionId ? { nativeInterventionId } : {})
  };

  return hydrateRecoveryState({
    ...state,
    earnedUnlocks: [unlock, ...state.earnedUnlocks]
  });
}

export function touchRecoveryState(state: RecoveryState, openedAt = new Date().toISOString()): RecoveryState {
  const openedMs = Date.parse(openedAt);
  const lastOpenedMs = state.lastOpenedAt ? Date.parse(state.lastOpenedAt) : Number.NaN;
  const clockMovedBackward =
    Number.isFinite(openedMs) && Number.isFinite(lastOpenedMs) && openedMs < lastOpenedMs;
  const derivedStreak = state.recoveryStartedAt ? calculateStreakDaysFrom(state.recoveryStartedAt, openedAt) : state.streakDays;
  // A device clock that jumped backwards (travel, bad auto-time) must never silently zero a
  // persisted streak; the corrected value still climbs, and the open watermark never moves back.
  const currentStreak = Math.max(0, clockMovedBackward ? Math.max(state.streakDays, derivedStreak) : derivedStreak);
  return hydrateRecoveryState({
    ...state,
    streakDays: currentStreak,
    bestStreakDays: Math.max(state.bestStreakDays, currentStreak),
    lastOpenedAt: clockMovedBackward && state.lastOpenedAt ? state.lastOpenedAt : openedAt
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
      ]
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
  const boundedClosedAt = new Date(Math.max(openedMs, closedMs)).toISOString();

  return touchRecoveryState(
    {
      ...state,
      appSessions: state.appSessions.map((session) =>
        session.id === openSession.id
          ? {
              ...session,
              closedAt: boundedClosedAt,
              durationSec
            }
          : session
      )
    },
    closed
  );
}

export function setVerifiedPremiumEntitlement(
  state: RecoveryState,
  evidence: VerifiedPremiumEntitlement | null,
  checkedAt = new Date().toISOString()
): RecoveryState {
  const entitlement = sanitizePremiumEntitlement(evidence);
  const active = hasVerifiedPremium(entitlement, Date.parse(checkedAt));
  const planId: PremiumPlanId | null = active && entitlement
    ? entitlement.productId === "freed_premium_monthly" ? "monthly" : entitlement.productId === "freed_premium_yearly" ? "yearly" : "lifetime"
    : null;
  return hydrateRecoveryState({
    ...state,
    premium: active,
    premiumPlanId: planId,
    premiumPlanAudience: active ? "individual" : null,
    premiumActivatedAt: active ? state.premiumActivatedAt ?? checkedAt : null,
    premiumEntitlement: entitlement
  });
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

export function markVpnDisclosureAcknowledged(
  state: RecoveryState,
  acknowledgedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    vpnDisclosureAcknowledgedAt: state.vpnDisclosureAcknowledgedAt ?? acknowledgedAt
  });
}

export function markAccountStepCompleted(
  state: RecoveryState,
  input: { skipped?: boolean; email?: string | null } = {}
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    accountSkippedAt:
      input.skipped && !state.accountSkippedAt ? new Date().toISOString() : state.accountSkippedAt,
    signedInEmail: input.email !== undefined ? sanitizeEmailOrNull(input.email) : state.signedInEmail
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
    protectionActivationPlatform: platform,
    // Completing the real activation test clears the limited-protection state.
    protectionSetupFallback: null
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

export function hasProtectionSetupFallback(
  state: RecoveryState,
  platform: ProtectionActivationPlatform
): boolean {
  return Boolean(state.protectionSetupFallback && state.protectionSetupFallback.platform === platform);
}

/**
 * Records the user's explicit acknowledgement that protection setup could not
 * be completed on this device, so FREED stops trapping them on the setup
 * screen. Activation stays incomplete; the Shield/Home surfaces keep showing a
 * limited-protection banner until the real activation test passes.
 */
export function markProtectionSetupFallback(
  state: RecoveryState,
  platform: ProtectionActivationPlatform,
  reason: ProtectionSetupFallbackReason,
  acknowledgedAt = new Date().toISOString()
): RecoveryState {
  return hydrateRecoveryState({
    ...state,
    protectionSetupFallback: {
      acknowledgedAt: validIso(acknowledgedAt) ?? acknowledgedAt,
      platform,
      reason
    }
  });
}

export function clearProtectionSetupFallback(state: RecoveryState): RecoveryState {
  if (!state.protectionSetupFallback) return state;
  return hydrateRecoveryState({ ...state, protectionSetupFallback: null });
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
    ...markPersonalPlanDate(state, attempt.detectedAt),
    attempts: isBlocked ? [sanitizedAttempt, ...state.attempts] : state.attempts,
    bestStreakDays: Math.max(state.bestStreakDays, state.streakDays),
    lastProtectedAt: isProtectedAttempt(sanitizedAttempt) ? sanitizedAttempt.detectedAt : state.lastProtectedAt
  });
}

export function recordBlockedDomainFeedback(
  state: RecoveryState,
  host: string,
  matchedRule: string,
  sourcePackage: string,
  reportedAt = new Date().toISOString()
): RecoveryState {
  const sanitizedHost = host.trim().toLowerCase().slice(0, 253);
  if (!sanitizedHost) return state;

  const entry: BlockedDomainFeedback = {
    host: sanitizedHost,
    matchedRule: matchedRule.trim().slice(0, 96),
    sourcePackage: sourcePackage.trim().slice(0, 64),
    reportedAt
  };

  const deduped = [
    entry,
    ...state.blockedDomainFeedback.filter((item) => item.host !== sanitizedHost)
  ].slice(0, 50);

  return hydrateRecoveryState({ ...state, blockedDomainFeedback: deduped });
}

export function hasPledgedOnDate(state: RecoveryState, dateKey = getLocalDateKey(new Date())): boolean {
  return state.pledges.some((pledge) => pledge.dateKey === dateKey);
}

export function getPledgeStreakDays(state: RecoveryState, today = new Date()): number {
  const pledgedKeys = new Set(state.pledges.map((pledge) => pledge.dateKey));
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!pledgedKeys.has(getLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!pledgedKeys.has(getLocalDateKey(cursor))) return 0;
  }
  while (pledgedKeys.has(getLocalDateKey(cursor)) && streak < 400) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function recordDailyPledge(
  state: RecoveryState,
  now = new Date()
): RecoveryState {
  const dateKey = getLocalDateKey(now);
  if (state.pledges.some((pledge) => pledge.dateKey === dateKey)) return state;

  const entry: PledgeRecord = { dateKey, createdAt: now.toISOString() };
  return hydrateRecoveryState({
    ...markPersonalPlanDate(state, now),
    pledges: [entry, ...state.pledges].slice(0, 400)
  });
}

export function recordCoachMessages(
  state: RecoveryState,
  messages: Array<{ role: "user" | "ai"; text: string }>,
  redactText: (input: string) => string,
  now = new Date()
): RecoveryState {
  const at = now.toISOString();
  const entries = messages
    .slice(-MAX_COACH_CHAT_ENTRIES)
    .map((message) => ({
      role: message.role,
      text: redactText(message.text).slice(0, 1_000),
      at
    }))
    .filter((entry) => entry.text.length > 0);

  return hydrateRecoveryState({ ...state, coachMessages: entries });
}

export function recordChallengeCompletion(
  state: RecoveryState,
  challenge: RecoveryChallenge,
  completedAt = new Date().toISOString(),
  sourceAttemptHost?: string,
  outcome: ChallengeFeedbackOutcome = "helped",
  sessionId?: string,
  observedActiveSec?: number,
  provenance?: CompletionProvenance
): RecoveryState {
  const receiptId = typeof sessionId === "string" && /^[A-Za-z0-9:_-]{1,160}$/.test(sessionId) ? sessionId : undefined;
  if (receiptId && state.challengeHistory.some(completion => completion.sessionId === receiptId)) return state;
  const completion: ChallengeCompletion = {
    id: challenge.id,
    ...(receiptId ? { sessionId: receiptId } : {}),
    ...(typeof observedActiveSec === "number" && Number.isFinite(observedActiveSec) && observedActiveSec >= 0 ? { observedActiveSec: Math.min(3600, observedActiveSec) } : {}),
    ...(sanitizeCompletionProvenance(provenance, challenge.id) ? { provenance: sanitizeCompletionProvenance(provenance, challenge.id) } : {}),
    title: challenge.title,
    category: challenge.category,
    outcome,
    completedAt,
    durationSec: challenge.durationSec,
    premium: challenge.premium,
    sourceAttemptHost: sanitizeSourceAttemptHost(sourceAttemptHost)
  };

  return hydrateRecoveryState({
    ...markPersonalPlanDate(state, completedAt),
    completedChallenges: state.completedChallenges + 1,
    bestStreakDays: Math.max(state.bestStreakDays, state.streakDays),
    challengeHistory: [completion, ...state.challengeHistory],
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
    verification: { version: 1, kind: 'timer' },
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
    verification: { version: 1, kind: 'timer' },
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
