import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { redactOperationalText } from "@/lib/operational-redaction";
import { calculateRecoveryScore } from "@/lib/recovery-engine";
import { coarseRecoveryTriggerLabel, redactRecoverySignalText, projectRecoveryStateForOffDevice } from "@/lib/recovery-signal-privacy";
import {
  calculateStreakDaysFrom,
  countRecoveryRiskMomentsForDay,
  getCurrentRecoveryStreakDays,
  getProtectedAttemptCount,
  getRecoveryAttemptSourceCounts,
  getRecoveryChallengeCounts,
  getRecoveryRiskHourCounts,
  getRecoverySessionCounts,
  getRecoveryUnlockCounts,
  getRecoveryUtcAnalyticsDayCounts,
  updateAnalyticsSharingSettings,
  type AnalyticsUtcDayCounts,
  type AnalyticsPendingSnapshot,
  generateWeeklyRecoveryReport,
  getLocalDateKey,
  localDateKeyDiffDays,
  localDateKeyToUtcMs,
  type RecoveryState
} from "@/lib/recovery-state";

export const REMOTE_ANALYTICS_ENABLED_DEFAULT = false;
export const ANALYTICS_SCHEMA_VERSION = "aggregate-v5";
export const ANALYTICS_CONSENT_VERSION = "analytics-consent-v1";
export const ANALYTICS_SNAPSHOT_SCHEMA_VERSION = "aggregate-snapshot-v1";
export const ANALYTICS_SNAPSHOT_RETENTION_DAYS = 14;
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
  snapshotReceipt?: AnalyticsSnapshotReceipt;
  snapshotRecovery?: AnalyticsSnapshotRecovery;
};

export type AnalyticsSnapshotReceipt = {
  schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION;
  lineageId: string;
  baseRevision: number;
  acceptedRevision: number;
  snapshotId: string;
  days: AnalyticsUtcDayCounts[];
};

export type AnalyticsSnapshotRecovery = {
  ok: false;
  schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION;
  lineageId: string;
  baseRevision: number;
  snapshotId: string;
  recovery: "refresh-window" | "new-lineage";
};

/** Only a typed server response tied to the exact pending request can authorize recovery. */
export function parseAnalyticsSnapshotRecovery(value: unknown, pending: AnalyticsPendingSnapshot): AnalyticsSnapshotRecovery | null {
  if (!value || typeof value !== "object" || !("recovery" in value)) return null;
  const response = value as Record<string, unknown>;
  const fields = ["ok", "schemaVersion", "lineageId", "baseRevision", "snapshotId", "recovery"];
  if (Object.keys(response).length !== fields.length || Object.keys(response).some(key => !fields.includes(key)) ||
      response.ok !== false || response.schemaVersion !== ANALYTICS_SNAPSHOT_SCHEMA_VERSION ||
      response.lineageId !== pending.lineageId || response.baseRevision !== pending.baseRevision || response.snapshotId !== pending.snapshotId ||
      (response.recovery !== "refresh-window" && response.recovery !== "new-lineage")) {
    throw new Error("Analytics recovery response does not match the saved request.");
  }
  return { ok: false, schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: pending.lineageId,
    baseRevision: pending.baseRevision, snapshotId: pending.snapshotId, recovery: response.recovery };
}

/** Use inside strict persistence; local activity is preserved and stale responses cannot change its baseline. */
export function applyAnalyticsSnapshotRecovery(current: RecoveryState, captured: RecoveryState, instruction: AnalyticsSnapshotRecovery): RecoveryState {
  const pending = getPersistedAnalyticsPendingSnapshot(captured);
  const validated = parseAnalyticsSnapshotRecovery(instruction, pending);
  if (!validated) throw new Error("Analytics recovery instruction is unavailable.");
  if (JSON.stringify(current.analyticsSharing.pendingSnapshot) !== JSON.stringify(captured.analyticsSharing.pendingSnapshot) ||
      JSON.stringify(current.analyticsSharing.snapshotCheckpoint) !== JSON.stringify(captured.analyticsSharing.snapshotCheckpoint)) {
    throw new Error("Analytics recovery conflicts with a changed local snapshot.");
  }
  const cleared = updateAnalyticsSharingSettings(current, { pendingSnapshot: null });
  return validated.recovery === "refresh-window" ? cleared : prepareAnalyticsSnapshotState(updateAnalyticsSharingSettings(cleared, {
    snapshotCheckpoint: { lineageId: null, revision: 0, snapshotId: null, days: [] }
  }));
}

/** Persist this state before the first request so retries and backups retain the lineage. */
export function prepareAnalyticsSnapshotState(state: RecoveryState): RecoveryState {
  if (state.analyticsSharing.snapshotCheckpoint.lineageId) return state;
  if (typeof globalThis.crypto?.getRandomValues !== "function") throw new Error("Secure analytics snapshot identity is unavailable.");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const lineageId = `lin_${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
  return updateAnalyticsSharingSettings(state, { snapshotCheckpoint: { lineageId, revision: 0, snapshotId: null, days: [] } });
}

export function buildRecoveryAggregateAnalyticsSnapshot(state: RecoveryState, controls: AnalyticsSharingControls, day: Date | string = new Date()) {
  const checkpoint = state.analyticsSharing.snapshotCheckpoint;
  if (!checkpoint.lineageId) throw new Error("Persist the analytics snapshot identity before sending.");
  if (controls.consentVersion !== ANALYTICS_CONSENT_VERSION || !controls.userOptedInAt || !Number.isFinite(Date.parse(controls.userOptedInAt))) throw new Error("Explicit analytics consent is required.");
  if (controls.dataRetentionDays !== ANALYTICS_SNAPSHOT_RETENTION_DAYS) throw new Error("Firebase aggregate analytics requires the 14-day sharing retention setting.");
  return { schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION as typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: checkpoint.lineageId, baseRevision: checkpoint.revision,
    days: getRecoveryUtcAnalyticsDayCounts(state, day), consentVersion: ANALYTICS_CONSENT_VERSION as typeof ANALYTICS_CONSENT_VERSION, userOptedInAt: controls.userOptedInAt,
    dataRetentionDays: ANALYTICS_SNAPSHOT_RETENTION_DAYS };
}

/** Hash the captured counters once. An existing pending request always wins over newer activity. */
export async function prepareAnalyticsPendingSnapshot(
  captured: RecoveryState,
  controls: AnalyticsSharingControls = captured.analyticsSharing,
  day: Date | string = new Date()
): Promise<AnalyticsPendingSnapshot> {
  if (captured.analyticsSharing.pendingSnapshot) return cloneAnalyticsPendingSnapshot(captured.analyticsSharing.pendingSnapshot);
  const snapshot = buildRecoveryAggregateAnalyticsSnapshot(captured, controls, day);
  const serialized = JSON.stringify(snapshot);
  let hash: string;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
    hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } else {
    const crypto = await import("expo-crypto");
    hash = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, serialized);
  }
  return cloneAnalyticsPendingSnapshot({ ...snapshot, dataRetentionDays: 14, snapshotId: `snap_${hash}` });
}

function cloneAnalyticsPendingSnapshot(snapshot: AnalyticsPendingSnapshot): AnalyticsPendingSnapshot {
  return { schemaVersion: snapshot.schemaVersion, lineageId: snapshot.lineageId, baseRevision: snapshot.baseRevision,
    snapshotId: snapshot.snapshotId, days: snapshot.days.map(day => ({ ...day })), consentVersion: snapshot.consentVersion,
    userOptedInAt: snapshot.userOptedInAt, dataRetentionDays: snapshot.dataRetentionDays };
}

/** Strictly merge the request into the latest state, preserving actions added while hashing. */
export function stageAnalyticsPendingSnapshot(current: RecoveryState, captured: RecoveryState, pending: AnalyticsPendingSnapshot): RecoveryState {
  const baseline = captured.analyticsSharing.snapshotCheckpoint;
  const checkpoint = current.analyticsSharing.snapshotCheckpoint;
  if (JSON.stringify(checkpoint) !== JSON.stringify(baseline) || pending.lineageId !== baseline.lineageId || pending.baseRevision !== baseline.revision) {
    throw new Error("Analytics snapshot baseline changed before it could be saved. Retry from the current recovery state.");
  }
  const existing = current.analyticsSharing.pendingSnapshot;
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(pending)) return current;
    throw new Error("A different analytics snapshot is awaiting acknowledgement. Retry that saved snapshot first.");
  }
  const lastDay = pending.days[pending.days.length - 1]?.day;
  if (!lastDay || pending.days.length !== 14) throw new Error("Pending analytics snapshot is invalid.");
  const expected = captured.analyticsSharing.pendingSnapshot?.days ?? getRecoveryUtcAnalyticsDayCounts(captured, `${lastDay}T12:00:00.000Z`);
  if (JSON.stringify(expected) !== JSON.stringify(pending.days)) throw new Error("Pending analytics counters do not match the captured recovery snapshot.");
  const currentDays = getRecoveryUtcAnalyticsDayCounts(current, `${lastDay}T12:00:00.000Z`);
  if (currentDays.some((day, index) => day.checkIns < pending.days[index].checkIns || day.completedChallenges < pending.days[index].completedChallenges)) {
    throw new Error("Recovery history changed while saving analytics. Choose the recovery backup to continue.");
  }
  return updateAnalyticsSharingSettings(current, { pendingSnapshot: cloneAnalyticsPendingSnapshot(pending) });
}

/** Send only the request already persisted in the captured state, including across UTC midnight. */
export function getPersistedAnalyticsPendingSnapshot(state: RecoveryState): AnalyticsPendingSnapshot {
  const pending = state.analyticsSharing.pendingSnapshot;
  const checkpoint = state.analyticsSharing.snapshotCheckpoint;
  if (!pending || pending.lineageId !== checkpoint.lineageId || pending.baseRevision !== checkpoint.revision) {
    throw new Error("Save the exact pending analytics snapshot before sending.");
  }
  return cloneAnalyticsPendingSnapshot(pending);
}

/** Advances only the captured baseline; intervening local activity remains unsent. */
export function applyAnalyticsSnapshotReceipt(current: RecoveryState, captured: RecoveryState, receipt: AnalyticsSnapshotReceipt): RecoveryState {
  const before = captured.analyticsSharing.snapshotCheckpoint;
  const checkpoint = current.analyticsSharing.snapshotCheckpoint;
  if (receipt.schemaVersion !== ANALYTICS_SNAPSHOT_SCHEMA_VERSION || before.lineageId !== receipt.lineageId ||
      checkpoint.lineageId !== receipt.lineageId || before.revision !== receipt.baseRevision ||
      checkpoint.revision !== before.revision || checkpoint.snapshotId !== before.snapshotId ||
      JSON.stringify(checkpoint.days) !== JSON.stringify(before.days) ||
      receipt.acceptedRevision !== receipt.baseRevision + 1 || !/^snap_[a-f0-9]{64}$/.test(receipt.snapshotId) || receipt.days.length !== 14) return current;
  const lastDay = receipt.days[receipt.days.length - 1].day;
  const pending = captured.analyticsSharing.pendingSnapshot;
  if (pending && (pending.snapshotId !== receipt.snapshotId || pending.lineageId !== receipt.lineageId || pending.baseRevision !== receipt.baseRevision ||
      JSON.stringify(current.analyticsSharing.pendingSnapshot) !== JSON.stringify(pending))) return current;
  const expected = pending?.days ?? getRecoveryUtcAnalyticsDayCounts(captured, `${lastDay}T12:00:00.000Z`);
  if (JSON.stringify(expected) !== JSON.stringify(receipt.days)) return current;
  const currentDays = getRecoveryUtcAnalyticsDayCounts(current, `${lastDay}T12:00:00.000Z`);
  if (currentDays.some((day, index) => day.checkIns < expected[index].checkIns || day.completedChallenges < expected[index].completedChallenges)) return current;
  return updateAnalyticsSharingSettings(current, { pendingSnapshot: null, snapshotCheckpoint: { lineageId: receipt.lineageId, revision: receipt.acceptedRevision,
    snapshotId: receipt.snapshotId, days: receipt.days.map(day => ({ ...day })) } });
}

/** Use inside the strict storage seam so failed receipt persistence leaves the request retryable. */
export function applyPendingAnalyticsSnapshotReceipt(current: RecoveryState, captured: RecoveryState, receipt: AnalyticsSnapshotReceipt): RecoveryState {
  const next = applyAnalyticsSnapshotReceipt(current, captured, receipt);
  if (next !== current) return next;
  const checkpoint = current.analyticsSharing.snapshotCheckpoint;
  if (checkpoint.lineageId === receipt.lineageId && checkpoint.revision === receipt.acceptedRevision && checkpoint.snapshotId === receipt.snapshotId && !current.analyticsSharing.pendingSnapshot) return current;
  throw new Error("Analytics receipt conflicts with the current recovery snapshot. The pending request remains saved.");
}

export type RemoteAnalyticsProvider = {
  endpointUrl: string;
  requiredRetentionDays?: number;
  send: (snapshot: OffDeviceRecoveryAnalyticsSnapshot, state: RecoveryState, controls: AnalyticsSharingControls, day: Date | string) => Promise<{ accepted: boolean; status: "ok" | "error"; provider: string; reason?: string; snapshotReceipt?: AnalyticsSnapshotReceipt; snapshotRecovery?: AnalyticsSnapshotRecovery }>;
};
let remoteAnalyticsProvider: RemoteAnalyticsProvider | null = null;

export function configureRemoteAnalyticsProvider(provider: RemoteAnalyticsProvider | null) {
  remoteAnalyticsProvider = provider;
}

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
  return normalizeAnalyticsEndpoint(remoteAnalyticsProvider?.endpointUrl ?? process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT);
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
    if (pathname !== "/api/analytics" && !pathname.endsWith("/api/analytics") &&
        !(remoteAnalyticsProvider && sameAnalyticsEndpoint(endpointUrl, remoteAnalyticsProvider.endpointUrl))) {
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

function inDateRange(value: string, startKey: string, endKey: string) {
  const key = getLocalDateKey(value);
  return key >= startKey && key <= endKey;
}

function localDateKeyToDate(dateKey: string) {
  const utcMs = localDateKeyToUtcMs(dateKey);
  if (!Number.isFinite(utcMs)) return null;
  const parts = new Date(utcMs);
  return new Date(parts.getUTCFullYear(), parts.getUTCMonth(), parts.getUTCDate());
}

function dateKeysForRange(startKey: string, endKey: string) {
  const start = localDateKeyToDate(startKey);
  const end = localDateKeyToDate(endKey);
  if (!start || !end || end.getTime() < start.getTime()) return [];

  // Step with setDate, never with a fixed 86,400,000 ms day: a local day is 23, 24 or 25 hours
  // around a DST transition, and fixed stepping duplicates one label and drops the last day.
  const keys: string[] = [];
  const cursor = new Date(start.getTime());
  while (getLocalDateKey(cursor) <= endKey && keys.length < 36_600) {
    keys.push(getLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function dayDifference(leftDateKey: string, rightDateKey: string) {
  return localDateKeyDiffDays(leftDateKey, rightDateKey);
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
  attemptHours: HourlyUrgePatternBucket[],
  relapses: RecoveryState["relapseRecords"],
  checkIns: RecoveryState["dailyCheckIns"]
): HourlyUrgePatternBucket[] {
  const buckets = attemptHours.map(bucket => ({ ...bucket }));

  const increment = (value: string) => {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return;
    const hour = new Date(timestamp).getHours();
    if (hour >= 0 && hour <= 23) buckets[hour].count += 1;
  };

  for (const relapse of relapses) {
    increment(relapse.occurredAt);
  }
  for (const checkIn of checkIns) {
    if (checkIn.urgeLevel === null || checkIn.urgeLevel < 4) continue;
    increment(checkIn.createdAt);
  }

  return buckets;
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

  return Math.max(
    0,
    localDateKeyDiffDays(getLocalDateKey(new Date(latestRelapseTime)), getLocalDateKey(new Date(targetTime)))
  );
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
  if (remoteAnalyticsProvider?.requiredRetentionDays && endpointUrl && sameAnalyticsEndpoint(endpointUrl, remoteAnalyticsProvider.endpointUrl) &&
      controls.dataRetentionDays !== remoteAnalyticsProvider.requiredRetentionDays) gaps.push("firebase-analytics-requires-14-day-retention");

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
  const attemptCounts = getRecoveryAttemptSourceCounts(state, startKey, endKey);
  const protectedAttempts = getProtectedAttemptCount(attemptCounts);
  const challenges = getRecoveryChallengeCounts(state, startKey, endKey);
  const helpfulChallenges = challenges.helpful;
  const stillUrgingChallenges = challenges.stillUrging;
  const appSessions = getRecoverySessionCounts(state, startKey, endKey, targetDate);
  const earnedUnlocks = getRecoveryUnlockCounts(state, startKey, endKey);
  const relapses = state.relapseRecords.filter((record) => inDateRange(record.occurredAt, startKey, endKey));
  const highUrgeCheckIns = state.dailyCheckIns.filter(
    (checkIn) => checkIn.urgeLevel !== null && checkIn.urgeLevel >= 4 && checkIn.dateKey >= startKey && checkIn.dateKey <= endKey
  );
  const hourlyUrgePattern = buildHourlyUrgePattern(getRecoveryRiskHourCounts(state, startKey, endKey), relapses, highUrgeCheckIns);
  const peak = peakUrgeHour(hourlyUrgePattern);
  const currentStreakDays = getCurrentRecoveryStreakDays(state, targetDate);
  const bestStreakDays = Math.max(safeCount(state.bestStreakDays), currentStreakDays);
  const recoveryScore = calculateRecoveryScore(currentStreakDays, state.completedChallenges, countRecoveryRiskMomentsForDay(state, targetDate));
  const challengeSuccessRate = percent(helpfulChallenges, challenges.answered);
  const challengeSuccessByCategoryMetrics = challenges.byCategory.map(category => ({ category: category.category, completed: category.completed, helpful: category.helpful, successRate: percent(category.helpful, category.answered) }));
  const blockedAttemptSourceBreakdown = ANALYTICS_BLOCKED_ATTEMPT_SOURCES.map(source => ({ source, count: getProtectedAttemptCount({ [source]: attemptCounts[source] ?? 0 }) }));
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
      protectedRiskMoments: protectedAttempts,
      selfReportedUrges: attemptCounts["panic-button"] ?? 0,
      browserInterceptions: attemptCounts.browser ?? 0,
      appInterceptions: attemptCounts.app ?? 0,
      searchInterceptions: attemptCounts.search ?? 0,
      manualCheckInterceptions: attemptCounts["manual-check"] ?? 0
    },
    emotion: {
      checkIns: report.checkIns,
      averageUrge: report.averageUrge,
      averageSleep: report.averageSleep,
      steadyDays: report.steadyDays
    },
    interventions: {
      completedChallenges: challenges.completed,
      helpfulChallenges,
      stillUrgingChallenges,
      challengeHelpRate: challengeSuccessRate
    },
    productionMetrics: {
      appOpens: appSessions.opens,
      appForegroundMinutes: safeCount(appSessions.foregroundSeconds / 60),
      blockedAttempts: protectedAttempts,
      blockedAttemptSourceBreakdown,
      challengeCompletions: challenges.completed,
      earnedUnlocks: earnedUnlocks.count,
      unlockMinutesGranted: safeCount(earnedUnlocks.seconds / 60),
      unlockFrequencyPerWeek: earnedUnlocks.count,
      currentStreakDays,
      bestStreakDays,
      streakHistory,
      relapseResets: relapses.length,
      relapseResetRate: percent(relapses.length, protectedAttempts + (attemptCounts["panic-button"] ?? 0) + relapses.length),
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

export const OFF_DEVICE_ANALYTICS_SCHEMA_VERSION = "freed-own-data-analytics-v1";
export type OffDeviceRecoveryAnalyticsSnapshot = Omit<RecoveryAnalyticsSnapshot, "schemaVersion" | "behavior" | "productionMetrics" | "privacy"> & {
  schemaVersion: typeof OFF_DEVICE_ANALYTICS_SCHEMA_VERSION;
  behavior: Pick<RecoveryAnalyticsSnapshot["behavior"], "selfReportedUrges" | "manualCheckInterceptions">;
  productionMetrics: Omit<RecoveryAnalyticsSnapshot["productionMetrics"], "blockedAttempts" | "blockedAttemptSourceBreakdown" | "earnedUnlocks" | "unlockMinutesGranted" | "unlockFrequencyPerWeek">;
  privacy: RecoveryAnalyticsSnapshot["privacy"] & { dataset: "freed-user-recorded-actions"; excludesDeviceProtectionHistory: true };
};

/** An outbound dataset is distinct from the full local dashboard snapshot. */
export function buildOffDeviceAnalyticsSnapshot(state: RecoveryState, day: Date | string = new Date()): OffDeviceRecoveryAnalyticsSnapshot {
  const snapshot = buildRecoveryAnalyticsSnapshot(projectRecoveryStateForOffDevice(state), day);
  const { blockedAttempts: _blocks, blockedAttemptSourceBreakdown: _sources, earnedUnlocks: _windows,
    unlockMinutesGranted: _minutes, unlockFrequencyPerWeek: _frequency, ...ownMetrics } = snapshot.productionMetrics;
  return { ...snapshot, schemaVersion: OFF_DEVICE_ANALYTICS_SCHEMA_VERSION,
    behavior: { selfReportedUrges: snapshot.behavior.selfReportedUrges, manualCheckInterceptions: snapshot.behavior.manualCheckInterceptions },
    productionMetrics: ownMetrics,
    privacy: { ...snapshot.privacy, dataset: "freed-user-recorded-actions", excludesDeviceProtectionHistory: true }
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
    payload: readiness.ready ? buildOffDeviceAnalyticsSnapshot(state, day) : null
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
    if (remoteAnalyticsProvider && sameAnalyticsEndpoint(controls.endpointUrl, remoteAnalyticsProvider.endpointUrl)) {
      const result = await remoteAnalyticsProvider.send(gated.payload, projectRecoveryStateForOffDevice(state), controls, day);
      return {
        readiness: gated.readiness, sent: true, accepted: result.accepted === true,
        status: result.status, provider: cleanAnalyticsProvider(result.provider), responseStatus: null,
        reason: sanitizeAnalyticsReason(result.reason), ...(result.snapshotReceipt ? { snapshotReceipt: result.snapshotReceipt } : {}),
        ...(result.snapshotRecovery ? { snapshotRecovery: result.snapshotRecovery } : {})
      };
    }
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
