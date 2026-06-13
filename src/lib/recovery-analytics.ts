import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { redactOperationalText } from "@/lib/operational-redaction";
import { calculateRecoveryScore } from "@/lib/recovery-engine";
import { coarseRecoveryTriggerLabel, redactRecoverySignalText } from "@/lib/recovery-signal-privacy";
import {
  calculateStreakDaysFrom,
  generateWeeklyRecoveryReport,
  getLocalDateKey,
  type RecoveryState
} from "@/lib/recovery-state";

export const REMOTE_ANALYTICS_ENABLED_DEFAULT = false;
export const ANALYTICS_SCHEMA_VERSION = "aggregate-v5";
export const ANALYTICS_CONSENT_VERSION = "analytics-consent-v1";
const DEFAULT_ANALYTICS_SEND_TIMEOUT_MS = 5_000;
const MIN_ANALYTICS_SEND_TIMEOUT_MS = 250;
const MAX_ANALYTICS_SEND_TIMEOUT_MS = 15_000;
const DEFAULT_ANALYTICS_RESPONSE_MAX_BYTES = 256_000;
const MIN_ANALYTICS_RESPONSE_MAX_BYTES = 1_024;
const MAX_ANALYTICS_RESPONSE_MAX_BYTES = 2_000_000;
const MAX_ANALYTICS_CONSENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const ANALYTICS_BLOCKED_ATTEMPT_SOURCES = ["browser", "search", "manual-check", "panic-button", "app"] as const;
export type AnalyticsBlockedAttemptSource = (typeof ANALYTICS_BLOCKED_ATTEMPT_SOURCES)[number];

type HourlyUrgePatternBucket = {
  hour: number;
  count: number;
};

type BlockedAttemptSourceBreakdownBucket = {
  source: AnalyticsBlockedAttemptSource;
  count: number;
};

type ChallengeCategorySuccess = {
  category: RecoveryState["challengeHistory"][number]["category"];
  completed: number;
  helpful: number;
  successRate: number;
};

type StreakHistoryBucket = {
  dateKey: string;
  streakDays: number;
  relapseResets: number;
};

export type AnalyticsAbuseReportChannel = "in-app" | "email" | "none";

export type AnalyticsSharingControls = {
  enabled: boolean;
  userOptedInAt: string | null;
  consentVersion: string | null;
  endpointUrl: string | null;
  aggregateOnlySharing: boolean;
  privateNotesAllowed: boolean;
  browsingDataAllowed: boolean;
  supportContactSharingAllowed: boolean;
  dataRetentionDays: number;
};

export type AnalyticsSharingReadiness = {
  ready: boolean;
  gaps: string[];
};

export type AnalyticsSharingReadinessOptions = {
  configuredEndpoint?: string | null;
};

export type AnalyticsSendResult = {
  readiness: AnalyticsSharingReadiness;
  sent: boolean;
  accepted: boolean;
  status: "blocked" | "ok" | "unconfigured" | "invalid" | "error";
  provider: string | null;
  responseStatus: number | null;
  reason: string | null;
};

export type RecoveryAnalyticsSnapshot = {
  schemaVersion: typeof ANALYTICS_SCHEMA_VERSION;
  generatedForDateKey: string;
  rangeLabel: string;
  summary: {
    premium: boolean;
    streakDays: number;
    bestStreakDays: number;
    recoveryScore: number;
  };
  behavior: {
    protectedRiskMoments: number;
    selfReportedUrges: number;
    browserInterceptions: number;
    appInterceptions: number;
    searchInterceptions: number;
    manualCheckInterceptions: number;
  };
  emotion: {
    checkIns: number;
    averageUrge: number;
    averageSleep: number;
    steadyDays: number;
  };
  interventions: {
    completedChallenges: number;
    helpfulChallenges: number;
    stillUrgingChallenges: number;
    challengeHelpRate: number;
  };
  productionMetrics: {
    appOpens: number;
    appForegroundMinutes: number;
    blockedAttempts: number;
    blockedAttemptSourceBreakdown: BlockedAttemptSourceBreakdownBucket[];
    challengeCompletions: number;
    earnedUnlocks: number;
    unlockMinutesGranted: number;
    unlockFrequencyPerWeek: number;
    currentStreakDays: number;
    bestStreakDays: number;
    streakHistory: StreakHistoryBucket[];
    relapseResets: number;
    relapseResetRate: number;
    daysSinceLastRelapse: number | null;
    peakUrgeHour: number | null;
    peakUrgeCount: number;
    hourlyUrgePattern: HourlyUrgePatternBucket[];
    challengeSuccessRate: number;
    challengeSuccessByCategory: ChallengeCategorySuccess[];
    recoveryScore: number;
  };
  patterns: {
    riskWindow: string | null;
    slipWindow: string | null;
    slipTrigger: string | null;
    momentum: string;
    nextFocus: string;
  };
  privacy: {
    aggregateOnly: true;
    excludesPrivateNotes: true;
    excludesBrowsingDetails: true;
    excludesSupportContacts: true;
  };
};

export function createDefaultAnalyticsSharingControls(): AnalyticsSharingControls {
  return {
    enabled: REMOTE_ANALYTICS_ENABLED_DEFAULT,
    userOptedInAt: null,
    consentVersion: null,
    endpointUrl: null,
    aggregateOnlySharing: true,
    privateNotesAllowed: false,
    browsingDataAllowed: false,
    supportContactSharingAllowed: false,
    dataRetentionDays: 0
  };
}

export function getConfiguredAnalyticsEndpoint() {
  return normalizeAnalyticsEndpoint(process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT);
}

function normalizeAnalyticsEndpoint(endpointUrl: string | null | undefined) {
  const endpoint = endpointUrl?.trim();
  return endpoint && endpoint.length > 0 ? endpoint : null;
}

function analyticsEndpointFingerprint(endpointUrl: string) {
  try {
    const parsed = new URL(endpointUrl);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return endpointUrl.trim();
  }
}

function sameAnalyticsEndpoint(left: string, right: string) {
  return analyticsEndpointFingerprint(left) === analyticsEndpointFingerprint(right);
}

function isValidIsoDate(value: string | null) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function analyticsConsentTimeIssue(value: string | null, nowMs = Date.now()) {
  if (!isValidIsoDate(value)) return null;
  const optedInAtMs = Date.parse(value ?? "");
  if (!Number.isFinite(optedInAtMs)) return null;
  return optedInAtMs > nowMs + MAX_ANALYTICS_CONSENT_CLOCK_SKEW_MS
    ? "analytics-consent-time-in-future"
    : null;
}

export function getAnalyticsEndpointIssues(endpointUrl: string | null) {
  if (!endpointUrl) return ["missing-analytics-endpoint"];

  const issues = getProductionEndpointIssues(endpointUrl, "analytics endpoint").map((issue) => issue.issue);
  try {
    const pathname = new URL(endpointUrl).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/analytics" && !pathname.endsWith("/api/analytics")) {
      issues.push("analytics endpoint must target the aggregate analytics API route (/api/analytics)");
    }
  } catch {
    // getProductionEndpointIssues already reports malformed URLs.
  }
  return issues;
}

function safeCount(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

const CHALLENGE_CATEGORIES: Array<RecoveryState["challengeHistory"][number]["category"]> = [
  "physical",
  "breathing",
  "reflection",
  "connection",
  "reset"
];

function inDateRange(value: string, startKey: string, endKey: string) {
  const key = getLocalDateKey(value);
  return key >= startKey && key <= endKey;
}

function localDayStartMs(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).getTime();
}

function dateKeysForRange(startKey: string, endKey: string) {
  const startMs = localDayStartMs(startKey);
  const endMs = localDayStartMs(endKey);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];

  const keys: string[] = [];
  for (let dayMs = startMs; dayMs <= endMs; dayMs += 86_400_000) {
    keys.push(getLocalDateKey(new Date(dayMs)));
  }
  return keys;
}

function dayDifference(leftDateKey: string, rightDateKey: string) {
  const left = localDayStartMs(leftDateKey);
  const right = localDayStartMs(rightDateKey);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round((right - left) / 86_400_000);
}

function buildStreakHistory(
  state: RecoveryState,
  startKey: string,
  endKey: string
): StreakHistoryBucket[] {
  const recoveryStartedKey = state.recoveryStartedAt ? getLocalDateKey(state.recoveryStartedAt) : null;
  const relapseRecords = state.relapseRecords
    .map((record) => ({
      dateKey: getLocalDateKey(record.occurredAt),
      previousStreakDays: safeCount(record.previousStreakDays)
    }))
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  const relapseCountsByDate = relapseRecords.reduce<Map<string, number>>((counts, record) => {
    counts.set(record.dateKey, (counts.get(record.dateKey) ?? 0) + 1);
    return counts;
  }, new Map());

  return dateKeysForRange(startKey, endKey).map((dateKey) => {
    const relapseResets = relapseCountsByDate.get(dateKey) ?? 0;
    let streakDays = 0;

    if (relapseResets > 0) {
      streakDays = 0;
    } else if (recoveryStartedKey && dateKey >= recoveryStartedKey) {
      streakDays = calculateStreakDaysFrom(state.recoveryStartedAt, `${dateKey}T12:00:00`);
    } else {
      const nextRelapse = relapseRecords.find((record) => record.dateKey > dateKey);
      if (nextRelapse) {
        streakDays = Math.max(0, nextRelapse.previousStreakDays - dayDifference(dateKey, nextRelapse.dateKey));
      }
    }

    return {
      dateKey,
      streakDays: safeCount(streakDays),
      relapseResets
    };
  });
}

function buildHourlyUrgePattern(
  attempts: RecoveryState["attempts"],
  relapses: RecoveryState["relapseRecords"],
  checkIns: RecoveryState["dailyCheckIns"]
): HourlyUrgePatternBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

  const increment = (value: string) => {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return;
    const hour = new Date(timestamp).getHours();
    if (hour >= 0 && hour <= 23) buckets[hour].count += 1;
  };

  for (const attempt of attempts) {
    increment(attempt.detectedAt);
  }
  for (const relapse of relapses) {
    increment(relapse.occurredAt);
  }
  for (const checkIn of checkIns) {
    if (checkIn.urgeLevel < 4) continue;
    increment(checkIn.createdAt);
  }

  return buckets;
}

function buildBlockedAttemptSourceBreakdown(
  attempts: RecoveryState["attempts"]
): BlockedAttemptSourceBreakdownBucket[] {
  const counts = new Map<AnalyticsBlockedAttemptSource, number>(
    ANALYTICS_BLOCKED_ATTEMPT_SOURCES.map((source) => [source, 0])
  );

  for (const attempt of attempts) {
    if (!counts.has(attempt.source)) continue;
    counts.set(attempt.source, (counts.get(attempt.source) ?? 0) + 1);
  }

  return ANALYTICS_BLOCKED_ATTEMPT_SOURCES.map((source) => ({
    source,
    count: counts.get(source) ?? 0
  }));
}

function peakUrgeHour(buckets: HourlyUrgePatternBucket[]) {
  const peakCount = Math.max(...buckets.map((bucket) => bucket.count));
  return {
    hour: peakCount > 0 ? buckets.find((bucket) => bucket.count === peakCount)?.hour ?? null : null,
    count: peakCount
  };
}

function daysSinceLastRelapse(records: RecoveryState["relapseRecords"], targetDate: Date) {
  const targetTime = targetDate.getTime();
  if (!Number.isFinite(targetTime)) return null;

  const latestRelapseTime = records.reduce<number | null>((latest, record) => {
    const occurredAt = Date.parse(record.occurredAt);
    if (Number.isNaN(occurredAt) || occurredAt > targetTime) return latest;
    return latest === null || occurredAt > latest ? occurredAt : latest;
  }, null);

  if (latestRelapseTime === null) return null;

  const targetDay = new Date(targetTime);
  const relapseDay = new Date(latestRelapseTime);
  const targetStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()).getTime();
  const relapseStart = new Date(relapseDay.getFullYear(), relapseDay.getMonth(), relapseDay.getDate()).getTime();
  return safeCount((targetStart - relapseStart) / 86_400_000);
}

function challengeSuccessByCategory(challenges: RecoveryState["challengeHistory"]): ChallengeCategorySuccess[] {
  return CHALLENGE_CATEGORIES.map((category) => {
    const categoryChallenges = challenges.filter((challenge) => challenge.category === category);
    const helpful = categoryChallenges.filter((challenge) => challenge.outcome === "helped").length;
    return {
      category,
      completed: categoryChallenges.length,
      helpful,
      successRate: percent(helpful, categoryChallenges.length)
    };
  });
}

function safeAnalyticsNextFocus(report: ReturnType<typeof generateWeeklyRecoveryReport>) {
  if (report.slips > 0) {
    const slipWindow = redactRecoverySignalText(report.slipWindow, 48)?.toLowerCase();
    return slipWindow
      ? `Use the strongest setup cue as an early-warning signal before ${slipWindow}. Add one physical barrier and start with a short reset instead of willpower.`
      : "Use the strongest setup cue as an early-warning signal. Add one physical barrier and start with a short reset instead of willpower.";
  }

  return redactRecoverySignalText(report.nextFocus, 180) ?? "Keep check-ins consistent and act early.";
}

export function getAnalyticsSharingReadiness(
  controls: AnalyticsSharingControls = createDefaultAnalyticsSharingControls(),
  options: AnalyticsSharingReadinessOptions = {}
): AnalyticsSharingReadiness {
  const gaps: string[] = [];
  const endpointUrl = normalizeAnalyticsEndpoint(controls.endpointUrl);
  const configuredEndpoint = normalizeAnalyticsEndpoint(
    options.configuredEndpoint === undefined ? getConfiguredAnalyticsEndpoint() : options.configuredEndpoint
  );

  if (!controls.enabled) gaps.push("remote-analytics-disabled-by-default");
  if (!isValidIsoDate(controls.userOptedInAt)) {
    gaps.push("missing-explicit-user-consent");
  } else {
    const consentTimeIssue = analyticsConsentTimeIssue(controls.userOptedInAt);
    if (consentTimeIssue) gaps.push(consentTimeIssue);
  }
  if (!controls.consentVersion) {
    gaps.push("missing-consent-version");
  } else if (controls.consentVersion !== ANALYTICS_CONSENT_VERSION) {
    gaps.push("analytics-consent-version-mismatch");
  }
  if (!endpointUrl) {
    gaps.push("missing-analytics-endpoint");
  } else {
    gaps.push(...getAnalyticsEndpointIssues(endpointUrl));
    if (!configuredEndpoint) {
      gaps.push("configured-analytics-endpoint-missing");
    } else {
      const configuredEndpointIssues = getAnalyticsEndpointIssues(configuredEndpoint);
      if (configuredEndpointIssues.length > 0) gaps.push("configured-analytics-endpoint-unsafe");
      if (!sameAnalyticsEndpoint(endpointUrl, configuredEndpoint)) gaps.push("analytics-endpoint-consent-stale");
    }
  }
  if (!controls.aggregateOnlySharing) gaps.push("analytics-sharing-must-stay-aggregate-only");
  if (controls.privateNotesAllowed) gaps.push("private-notes-must-not-be-shared");
  if (controls.browsingDataAllowed) gaps.push("browsing-details-must-not-be-shared");
  if (controls.supportContactSharingAllowed) gaps.push("support-contacts-must-not-be-shared");
  if (!Number.isFinite(controls.dataRetentionDays) || controls.dataRetentionDays < 1 || controls.dataRetentionDays > 30) {
    gaps.push("data-retention-must-be-between-1-and-30-days");
  }

  return {
    ready: gaps.length === 0,
    gaps
  };
}

export function buildRecoveryAnalyticsSnapshot(
  state: RecoveryState,
  day: Date | string = new Date()
): RecoveryAnalyticsSnapshot {
  const targetDate = typeof day === "string" ? new Date(day) : day;
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - 6);
  const startKey = getLocalDateKey(start);
  const endKey = getLocalDateKey(targetDate);
  const report = generateWeeklyRecoveryReport(state, targetDate);
  const attempts = state.attempts.filter(
    (attempt) => attempt.result.verdict === "block" && inDateRange(attempt.detectedAt, startKey, endKey)
  );
  const challenges = state.challengeHistory.filter((challenge) => inDateRange(challenge.completedAt, startKey, endKey));
  const helpfulChallenges = challenges.filter((challenge) => challenge.outcome === "helped").length;
  const stillUrgingChallenges = challenges.filter((challenge) => challenge.outcome === "still-urging").length;
  const appSessions = state.appSessions.filter((session) => inDateRange(session.openedAt, startKey, endKey));
  const earnedUnlocks = state.earnedUnlocks.filter((unlock) => inDateRange(unlock.startedAt, startKey, endKey));
  const relapses = state.relapseRecords.filter((record) => inDateRange(record.occurredAt, startKey, endKey));
  const highUrgeCheckIns = state.dailyCheckIns.filter(
    (checkIn) => checkIn.urgeLevel >= 4 && checkIn.dateKey >= startKey && checkIn.dateKey <= endKey
  );
  const hourlyUrgePattern = buildHourlyUrgePattern(attempts, relapses, highUrgeCheckIns);
  const peak = peakUrgeHour(hourlyUrgePattern);
  const currentStreakDays = state.recoveryStartedAt
    ? calculateStreakDaysFrom(state.recoveryStartedAt, targetDate)
    : safeCount(state.streakDays);
  const bestStreakDays = Math.max(safeCount(state.bestStreakDays), currentStreakDays);
  const recoveryScore = calculateRecoveryScore(currentStreakDays, state.completedChallenges, attempts.length);
  const challengeSuccessRate = percent(helpfulChallenges, challenges.length);
  const challengeSuccessByCategoryMetrics = challengeSuccessByCategory(challenges);
  const blockedAttemptSourceBreakdown = buildBlockedAttemptSourceBreakdown(attempts);
  const streakHistory = buildStreakHistory(state, startKey, endKey);

  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedForDateKey: endKey,
    rangeLabel: report.rangeLabel,
    summary: {
      premium: state.premium,
      streakDays: currentStreakDays,
      bestStreakDays,
      recoveryScore
    },
    behavior: {
      protectedRiskMoments: attempts.length,
      selfReportedUrges: attempts.filter((attempt) => attempt.source === "panic-button").length,
      browserInterceptions: attempts.filter((attempt) => attempt.source === "browser").length,
      appInterceptions: attempts.filter((attempt) => attempt.source === "app").length,
      searchInterceptions: attempts.filter((attempt) => attempt.source === "search").length,
      manualCheckInterceptions: attempts.filter((attempt) => attempt.source === "manual-check").length
    },
    emotion: {
      checkIns: report.checkIns,
      averageUrge: report.averageUrge,
      averageSleep: report.averageSleep,
      steadyDays: report.steadyDays
    },
    interventions: {
      completedChallenges: challenges.length,
      helpfulChallenges,
      stillUrgingChallenges,
      challengeHelpRate: challengeSuccessRate
    },
    productionMetrics: {
      appOpens: appSessions.length,
      appForegroundMinutes: safeCount(appSessions.reduce((total, session) => total + session.durationSec, 0) / 60),
      blockedAttempts: attempts.length,
      blockedAttemptSourceBreakdown,
      challengeCompletions: challenges.length,
      earnedUnlocks: earnedUnlocks.length,
      unlockMinutesGranted: safeCount(earnedUnlocks.reduce((total, unlock) => total + unlock.durationMinutes, 0)),
      unlockFrequencyPerWeek: earnedUnlocks.length,
      currentStreakDays,
      bestStreakDays,
      streakHistory,
      relapseResets: relapses.length,
      relapseResetRate: percent(relapses.length, attempts.length + relapses.length),
      daysSinceLastRelapse: daysSinceLastRelapse(state.relapseRecords, targetDate),
      peakUrgeHour: peak.hour,
      peakUrgeCount: peak.count,
      hourlyUrgePattern,
      challengeSuccessRate,
      challengeSuccessByCategory: challengeSuccessByCategoryMetrics,
      recoveryScore
    },
    patterns: {
      riskWindow: redactRecoverySignalText(report.riskWindow, 48),
      slipWindow: report.slips > 0 ? redactRecoverySignalText(report.slipWindow, 48) : null,
      slipTrigger: report.slips > 0 ? coarseRecoveryTriggerLabel(report.slipTrigger) : null,
      momentum: redactRecoverySignalText(report.momentum, 96) ?? "Needs more signal",
      nextFocus: safeAnalyticsNextFocus(report)
    },
    privacy: {
      aggregateOnly: true,
      excludesPrivateNotes: true,
      excludesBrowsingDetails: true,
      excludesSupportContacts: true
    }
  };
}

export function buildGatedAnalyticsPayload(
  state: RecoveryState,
  controls: AnalyticsSharingControls = createDefaultAnalyticsSharingControls(),
  day: Date | string = new Date()
) {
  const readiness = getAnalyticsSharingReadiness(controls);
  return {
    readiness,
    payload: readiness.ready ? buildRecoveryAnalyticsSnapshot(state, day) : null
  };
}

type AnalyticsFetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status"> & Partial<Pick<Response, "body" | "headers" | "json" | "text">>>;

export type AnalyticsSendOptions = {
  day?: Date | string;
  fetcher?: AnalyticsFetchLike;
  timeoutMs?: number | string | null;
};

export async function sendGatedAnalyticsPayload(
  state: RecoveryState,
  controls: AnalyticsSharingControls = createDefaultAnalyticsSharingControls(),
  options: AnalyticsSendOptions = {}
): Promise<AnalyticsSendResult> {
  const day = options.day ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const gated = buildGatedAnalyticsPayload(state, controls, day);

  if (!gated.readiness.ready || !gated.payload || !controls.endpointUrl) {
    return {
      readiness: gated.readiness,
      sent: false,
      accepted: false,
      status: "blocked",
      provider: null,
      responseStatus: null,
      reason: gated.readiness.gaps.join("; ") || "Remote analytics is not ready."
    };
  }

  try {
    const { response, body } = await postAnalyticsWithTimeout(
      fetcher,
      controls.endpointUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentVersion: controls.consentVersion,
          userOptedInAt: controls.userOptedInAt,
          dataRetentionDays: controls.dataRetentionDays,
          snapshot: gated.payload
        })
      },
      normalizeAnalyticsSendTimeoutMs(options.timeoutMs ?? readAnalyticsSendTimeoutMs())
    );
    const status = normalizeSendStatus(body, response.ok);

    return {
      readiness: gated.readiness,
      sent: true,
      accepted: Boolean((body as { accepted?: unknown }).accepted),
      status,
      provider: cleanAnalyticsProvider((body as { provider?: unknown }).provider),
      responseStatus: response.status,
      reason: sanitizeAnalyticsReason((body as { reason?: unknown }).reason)
    };
  } catch (error) {
    return {
      readiness: gated.readiness,
      sent: true,
      accepted: false,
      status: "error",
      provider: null,
      responseStatus: null,
      reason: sanitizeAnalyticsReason(error instanceof Error ? error.message : "Remote analytics request failed.")
    };
  }
}

function cleanAnalyticsProvider(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return /^[a-z0-9_-]{1,40}$/i.test(cleaned) ? cleaned : null;
}

export function sanitizeAnalyticsReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function normalizeSendStatus(body: unknown, ok: boolean): AnalyticsSendResult["status"] {
  if (body && typeof body === "object" && "status" in body) {
    const status = (body as { status?: unknown }).status;
    if (status === "ok" || status === "unconfigured" || status === "invalid" || status === "error") return status;
  }

  return ok ? "ok" : "error";
}

async function postAnalyticsWithTimeout(
  fetcher: AnalyticsFetchLike,
  endpointUrl: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Remote analytics request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetcher(endpointUrl, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
    const body = await readBoundedResponseJson(response, {
      timeoutMs,
      maxBytes: normalizeAnalyticsResponseMaxBytes(readAnalyticsResponseMaxBytes()),
      label: "Remote analytics response",
      abort: () => controller?.abort()
    });
    return { response, body };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readAnalyticsSendTimeoutMs() {
  return process.env.EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS?.trim() ?? "";
}

function readAnalyticsResponseMaxBytes() {
  return process.env.EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES?.trim() ?? "";
}

function normalizeAnalyticsSendTimeoutMs(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_ANALYTICS_SEND_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_ANALYTICS_SEND_TIMEOUT_MS;
  return Math.max(MIN_ANALYTICS_SEND_TIMEOUT_MS, Math.min(MAX_ANALYTICS_SEND_TIMEOUT_MS, Math.round(parsed)));
}

function normalizeAnalyticsResponseMaxBytes(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_ANALYTICS_RESPONSE_MAX_BYTES;
  if (!Number.isFinite(parsed)) return DEFAULT_ANALYTICS_RESPONSE_MAX_BYTES;
  return Math.max(MIN_ANALYTICS_RESPONSE_MAX_BYTES, Math.min(MAX_ANALYTICS_RESPONSE_MAX_BYTES, Math.round(parsed)));
}
