import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import {
  ANALYTICS_BLOCKED_ATTEMPT_SOURCES,
  ANALYTICS_CONSENT_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  sanitizeAnalyticsReason,
  type AnalyticsBlockedAttemptSource,
  type RecoveryAnalyticsSnapshot
} from "@/lib/recovery-analytics";
import { redactRecoverySignalText } from "@/lib/recovery-signal-privacy";
import { isSupabaseServiceRoleKey } from "@/lib/server-credential-safety";

export type AnalyticsIngestionRequest = {
  consentVersion: string;
  userOptedInAt: string;
  dataRetentionDays: number;
  snapshot: RecoveryAnalyticsSnapshot;
};

export type AnalyticsIngestionResult = {
  accepted: boolean;
  provider: "supabase" | "custom" | "unconfigured" | "invalid" | "error";
  status: "ok" | "unconfigured" | "invalid" | "error";
  receivedAt: string;
  schemaVersion?: string;
  generatedForDateKey?: string;
  reason?: string;
};

export type AnalyticsIngestionProvider = (
  request: AnalyticsIngestionRequest,
  receivedAt: string
) => Promise<AnalyticsIngestionResult> | AnalyticsIngestionResult;

const FORBIDDEN_ANALYTICS_KEY_ALIASES = [
  "attempts",
  "attemptHistory",
  "attempt_history",
  "relapseRecords",
  "relapse_records",
  "dailyCheckIns",
  "daily_check_ins",
  "dailyHabits",
  "daily_habits",
  "reflection",
  "reflections",
  "privateReflection",
  "private_reflection",
  "note",
  "notes",
  "privateNotes",
  "private_notes",
  "privateJournal",
  "private_journal",
  "contact",
  "contacts",
  "supportCircle",
  "support_circle",
  "supportContacts",
  "support_contacts",
  "accountability",
  "accountabilityContacts",
  "accountability_contacts",
  "messageTemplate",
  "message_template",
  "phone",
  "phoneNumber",
  "phone_number",
  "email",
  "emailAddress",
  "email_address",
  "userEmail",
  "user_email",
  "url",
  "urls",
  "rawUrl",
  "rawURL",
  "raw_url",
  "rawHost",
  "raw_host",
  "host",
  "hostname",
  "hosts",
  "domain",
  "domains",
  "browsingHistory",
  "browsing_history",
  "browserHistory",
  "browser_history",
  "visitedUrl",
  "visitedURL",
  "visited_url",
  "conversationTranscript",
  "conversation_transcript",
  "transcript",
  "transcripts",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "authToken",
  "auth_token",
  "jwt",
  "apiKey",
  "api_key",
  "secret",
  "serviceRoleKey",
  "service_role_key",
  "purchaseToken",
  "purchase_token",
  "rawPurchaseToken",
  "raw_purchase_token",
  "googlePurchaseToken",
  "google_purchase_token",
  "receipt",
  "receipts",
  "receiptData",
  "receipt_data",
  "rawReceipt",
  "raw_receipt",
  "iosReceipt",
  "ios_receipt",
  "appStoreReceipt",
  "app_store_receipt",
  "transactionReceipt",
  "transaction_receipt"
] as const;

const FORBIDDEN_ANALYTICS_KEYS = new Set(FORBIDDEN_ANALYTICS_KEY_ALIASES.map(normalizeAnalyticsKey));

const ANALYTICS_CHALLENGE_CATEGORIES = ["physical", "breathing", "reflection", "connection", "reset"] as const;
type AnalyticsChallengeCategory = (typeof ANALYTICS_CHALLENGE_CATEGORIES)[number];
const DEFAULT_ANALYTICS_SUPABASE_TIMEOUT_MS = 8_000;
const MIN_ANALYTICS_SUPABASE_TIMEOUT_MS = 250;
const MAX_ANALYTICS_SUPABASE_TIMEOUT_MS = 15_000;
const MAX_ANALYTICS_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_ANALYTICS_SNAPSHOT_FUTURE_DAYS = 1;

let analyticsIngestionProvider: AnalyticsIngestionProvider | null = null;

export function configureAnalyticsIngestionProvider(provider: AnalyticsIngestionProvider | null) {
  analyticsIngestionProvider = provider;
}

export function sanitizeAnalyticsIngestionRequest(value: unknown): AnalyticsIngestionRequest | null {
  if (!isRecord(value)) return null;
  if (findForbiddenAnalyticsFields(value).length > 0) return null;
  if (findUnsafeAnalyticsStrings(value).length > 0) return null;

  const consentVersion = cleanToken(value.consentVersion, 80);
  const userOptedInAt = cleanIsoDate(value.userOptedInAt);
  const dataRetentionDays = cleanRetentionDays(value.dataRetentionDays);
  const snapshot = sanitizeAnalyticsSnapshot(value.snapshot);

  if (
    consentVersion !== ANALYTICS_CONSENT_VERSION ||
    !userOptedInAt ||
    dataRetentionDays === null ||
    !snapshot
  ) {
    return null;
  }

  return {
    consentVersion,
    userOptedInAt,
    dataRetentionDays,
    snapshot
  };
}

export async function ingestRecoveryAnalytics(
  value: unknown,
  receivedAt = new Date().toISOString()
): Promise<AnalyticsIngestionResult> {
  const request = sanitizeAnalyticsIngestionRequest(value);
  if (!request) {
    return {
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt,
      reason: "Analytics payload must be aggregate-only and must not contain private notes, browsing details, support contacts, or raw URLs."
    };
  }
  const timeIssue = analyticsIngestionTimeIssue(request, receivedAt);
  if (timeIssue) {
    return {
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: timeIssue
    };
  }

  if (analyticsIngestionProvider) {
    return sanitizeAnalyticsIngestionResult(
      await analyticsIngestionProvider(request, receivedAt),
      request,
      receivedAt
    );
  }

  return ingestWithSupabase(request, receivedAt);
}

async function ingestWithSupabase(
  request: AnalyticsIngestionRequest,
  receivedAt: string
): Promise<AnalyticsIngestionResult> {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tableName = readEnv("SUPABASE_ANALYTICS_TABLE") ?? "recovery_analytics_events";

  if (!supabaseUrl || !serviceKey) {
    return {
      accepted: false,
      provider: "unconfigured",
      status: "unconfigured",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: "Supabase analytics ingestion is not configured."
    };
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return {
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: "Supabase analytics ingestion service-role key is not production-shaped."
    };
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase analytics base URL");
  if (baseIssues.length > 0) {
    return {
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: baseIssues.map((issue) => issue.issue).join("; ")
    };
  }

  const endpoint = new URL(`/rest/v1/${encodeURIComponent(tableName)}`, supabaseUrl);
  const endpointIssues = getProductionEndpointIssues(endpoint.toString(), "Supabase analytics endpoint");
  if (endpointIssues.length > 0) {
    return {
      accepted: false,
      provider: "invalid",
      status: "invalid",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    };
  }

  try {
    const response = await fetchAnalyticsSupabaseWithTimeout(
      endpoint.toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          schema_version: request.snapshot.schemaVersion,
          generated_for_date_key: request.snapshot.generatedForDateKey,
          consent_version: request.consentVersion,
          user_opted_in_at: request.userOptedInAt,
          data_retention_days: request.dataRetentionDays,
          snapshot: request.snapshot,
          received_at: receivedAt
        })
      },
      normalizeAnalyticsSupabaseTimeoutMs(readAnalyticsSupabaseTimeoutMs())
    );

    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);

    return {
      accepted: true,
      provider: "supabase",
      status: "ok",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey
    };
  } catch (error) {
    return {
      accepted: false,
      provider: "error",
      status: "error",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: sanitizeAnalyticsReason(error instanceof Error ? error.message : "Analytics ingestion failed.") ?? "Analytics ingestion failed."
    };
  }
}

function sanitizeAnalyticsIngestionResult(
  value: unknown,
  request: AnalyticsIngestionRequest,
  receivedAt: string
): AnalyticsIngestionResult {
  if (!isRecord(value)) {
    return {
      accepted: false,
      provider: "error",
      status: "error",
      receivedAt,
      schemaVersion: request.snapshot.schemaVersion,
      generatedForDateKey: request.snapshot.generatedForDateKey,
      reason: "Analytics ingestion provider returned a malformed response."
    };
  }

  const status = cleanAnalyticsIngestionStatus(value.status);
  const reason = sanitizeAnalyticsReason(value.reason);
  return {
    accepted: value.accepted === true && status === "ok",
    provider: cleanAnalyticsIngestionProvider(value.provider),
    status,
    receivedAt,
    schemaVersion: request.snapshot.schemaVersion,
    generatedForDateKey: request.snapshot.generatedForDateKey,
    ...(reason ? { reason } : {})
  };
}

function cleanAnalyticsIngestionProvider(value: unknown): AnalyticsIngestionResult["provider"] {
  return value === "supabase" || value === "custom" || value === "unconfigured" || value === "invalid" || value === "error"
    ? value
    : "error";
}

function cleanAnalyticsIngestionStatus(value: unknown): AnalyticsIngestionResult["status"] {
  return value === "ok" || value === "unconfigured" || value === "invalid" || value === "error" ? value : "error";
}

function sanitizeAnalyticsSnapshot(value: unknown): RecoveryAnalyticsSnapshot | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== ANALYTICS_SCHEMA_VERSION) return null;

  const generatedForDateKey = cleanDateKey(value.generatedForDateKey);
  const rangeLabel = cleanText(value.rangeLabel, 80);
  const summary = isRecord(value.summary) ? value.summary : null;
  const behavior = isRecord(value.behavior) ? value.behavior : null;
  const emotion = isRecord(value.emotion) ? value.emotion : null;
  const interventions = isRecord(value.interventions) ? value.interventions : null;
  const productionMetrics = isRecord(value.productionMetrics) ? value.productionMetrics : null;
  const patterns = isRecord(value.patterns) ? value.patterns : null;
  const privacy = isRecord(value.privacy) ? value.privacy : null;

  if (
    !generatedForDateKey ||
    !rangeLabel ||
    !summary ||
    !behavior ||
    !emotion ||
    !interventions ||
    !productionMetrics ||
    !patterns ||
    !privacy
  ) {
    return null;
  }

  if (
    privacy.aggregateOnly !== true ||
    privacy.excludesPrivateNotes !== true ||
    privacy.excludesBrowsingDetails !== true ||
    privacy.excludesSupportContacts !== true
  ) {
    return null;
  }
  if (
    !hasBooleanField(summary, "premium") ||
    !hasNonNegativeNumberFields(summary, ["streakDays", "bestStreakDays", "recoveryScore"]) ||
    !hasNonNegativeNumberFields(behavior, [
      "protectedRiskMoments",
      "selfReportedUrges",
      "browserInterceptions",
      "appInterceptions",
      "searchInterceptions",
      "manualCheckInterceptions"
    ]) ||
    !hasNonNegativeNumberFields(emotion, ["checkIns", "steadyDays"]) ||
    !hasScaleNumberField(emotion, "averageUrge", 5) ||
    !hasScaleNumberField(emotion, "averageSleep", 5) ||
    !hasNonNegativeNumberFields(interventions, ["completedChallenges", "helpfulChallenges", "stillUrgingChallenges"]) ||
    !hasScaleNumberField(interventions, "challengeHelpRate", 100) ||
    !hasNonNegativeNumberFields(productionMetrics, [
      "appOpens",
      "appForegroundMinutes",
      "blockedAttempts",
      "challengeCompletions",
      "earnedUnlocks",
      "unlockMinutesGranted",
      "unlockFrequencyPerWeek",
      "currentStreakDays",
      "bestStreakDays",
      "relapseResets",
      "peakUrgeCount",
      "recoveryScore"
    ]) ||
    !hasScaleNumberField(productionMetrics, "relapseResetRate", 100) ||
    !hasScaleNumberField(productionMetrics, "challengeSuccessRate", 100) ||
    !hasNullableCountField(productionMetrics, "daysSinceLastRelapse") ||
    !hasNullableHourField(productionMetrics, "peakUrgeHour") ||
    !hasCompleteBlockedAttemptSourceBreakdown(productionMetrics.blockedAttemptSourceBreakdown) ||
    !hasCompleteStreakHistory(productionMetrics.streakHistory, generatedForDateKey) ||
    !hasCompleteHourlyUrgePattern(productionMetrics.hourlyUrgePattern) ||
    !hasCompleteChallengeSuccessByCategory(productionMetrics.challengeSuccessByCategory) ||
    !hasOwn(patterns, "riskWindow") ||
    !hasOwn(patterns, "slipWindow") ||
    !hasOwn(patterns, "slipTrigger") ||
    !hasTextField(patterns, "momentum") ||
    !hasTextField(patterns, "nextFocus")
  ) {
    return null;
  }

  const blockedAttempts = cleanCount(productionMetrics.blockedAttempts);
  const blockedAttemptSourceBreakdown = cleanBlockedAttemptSourceBreakdown(
    productionMetrics.blockedAttemptSourceBreakdown
  );
  const blockedAttemptSourceTotal = blockedAttemptSourceBreakdown.reduce((total, bucket) => total + bucket.count, 0);
  if (blockedAttemptSourceTotal !== blockedAttempts) return null;
  const hourlyUrgePattern = cleanHourlyUrgePattern(productionMetrics.hourlyUrgePattern);
  const peakUrgeCount = cleanCount(productionMetrics.peakUrgeCount);
  const peakUrgeHour = cleanNullableHour(productionMetrics.peakUrgeHour);
  const highestHourlyUrgeCount = Math.max(...hourlyUrgePattern.map((bucket) => bucket.count));
  if (peakUrgeCount !== highestHourlyUrgeCount) return null;
  if (peakUrgeCount === 0 && peakUrgeHour !== null) return null;
  if (peakUrgeCount > 0 && hourlyUrgePattern.find((bucket) => bucket.hour === peakUrgeHour)?.count !== peakUrgeCount) {
    return null;
  }
  if (cleanCount(summary.streakDays) !== cleanCount(productionMetrics.currentStreakDays)) return null;
  if (cleanCount(summary.bestStreakDays) !== cleanCount(productionMetrics.bestStreakDays)) return null;
  if (cleanPercentLike(summary.recoveryScore) !== cleanPercentLike(productionMetrics.recoveryScore)) return null;
  if (cleanCount(behavior.protectedRiskMoments) !== blockedAttempts) return null;
  if (cleanCount(interventions.completedChallenges) !== cleanCount(productionMetrics.challengeCompletions)) return null;
  if (cleanScale(interventions.challengeHelpRate, 100) !== cleanScale(productionMetrics.challengeSuccessRate, 100)) return null;
  const streakHistory = cleanStreakHistory(productionMetrics.streakHistory);
  if (streakHistory[streakHistory.length - 1]?.streakDays !== cleanCount(productionMetrics.currentStreakDays)) return null;
  if (streakHistory.reduce((total, bucket) => total + bucket.relapseResets, 0) !== cleanCount(productionMetrics.relapseResets)) {
    return null;
  }

  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedForDateKey,
    rangeLabel,
    summary: {
      premium: typeof summary.premium === "boolean" ? summary.premium : false,
      streakDays: cleanCount(summary.streakDays),
      bestStreakDays: cleanCount(summary.bestStreakDays),
      recoveryScore: cleanPercentLike(summary.recoveryScore)
    },
    behavior: {
      protectedRiskMoments: cleanCount(behavior.protectedRiskMoments),
      selfReportedUrges: cleanCount(behavior.selfReportedUrges),
      browserInterceptions: cleanCount(behavior.browserInterceptions),
      appInterceptions: cleanCount(behavior.appInterceptions),
      searchInterceptions: cleanCount(behavior.searchInterceptions),
      manualCheckInterceptions: cleanCount(behavior.manualCheckInterceptions)
    },
    emotion: {
      checkIns: cleanCount(emotion.checkIns),
      averageUrge: cleanScale(emotion.averageUrge, 5),
      averageSleep: cleanScale(emotion.averageSleep, 5),
      steadyDays: cleanCount(emotion.steadyDays)
    },
    interventions: {
      completedChallenges: cleanCount(interventions.completedChallenges),
      helpfulChallenges: cleanCount(interventions.helpfulChallenges),
      stillUrgingChallenges: cleanCount(interventions.stillUrgingChallenges),
      challengeHelpRate: cleanScale(interventions.challengeHelpRate, 100)
    },
    productionMetrics: {
      appOpens: cleanCount(productionMetrics.appOpens),
      appForegroundMinutes: cleanCount(productionMetrics.appForegroundMinutes),
      blockedAttempts,
      blockedAttemptSourceBreakdown,
      challengeCompletions: cleanCount(productionMetrics.challengeCompletions),
      earnedUnlocks: cleanCount(productionMetrics.earnedUnlocks),
      unlockMinutesGranted: cleanCount(productionMetrics.unlockMinutesGranted),
      unlockFrequencyPerWeek: cleanCount(productionMetrics.unlockFrequencyPerWeek),
      currentStreakDays: cleanCount(productionMetrics.currentStreakDays),
      bestStreakDays: cleanCount(productionMetrics.bestStreakDays),
      streakHistory,
      relapseResets: cleanCount(productionMetrics.relapseResets),
      relapseResetRate: cleanScale(productionMetrics.relapseResetRate, 100),
      daysSinceLastRelapse: cleanNullableCount(productionMetrics.daysSinceLastRelapse),
      peakUrgeHour,
      peakUrgeCount,
      hourlyUrgePattern,
      challengeSuccessRate: cleanScale(productionMetrics.challengeSuccessRate, 100),
      challengeSuccessByCategory: cleanChallengeSuccessByCategory(productionMetrics.challengeSuccessByCategory),
      recoveryScore: cleanPercentLike(productionMetrics.recoveryScore)
    },
    patterns: {
      riskWindow: cleanNullableText(patterns.riskWindow, 64),
      slipWindow: cleanNullableText(patterns.slipWindow, 64),
      slipTrigger: cleanNullableText(patterns.slipTrigger, 64),
      momentum: cleanText(patterns.momentum, 96) ?? "Needs more signal",
      nextFocus: cleanText(patterns.nextFocus, 240) ?? "Keep check-ins consistent and act early."
    },
    privacy: {
      aggregateOnly: true,
      excludesPrivateNotes: true,
      excludesBrowsingDetails: true,
      excludesSupportContacts: true
    }
  };
}

function findForbiddenAnalyticsFields(value: unknown, path: string[] = []): string[] {
  if (!isRecord(value) && !Array.isArray(value)) return [];
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  const hits: string[] = [];

  for (const [key, child] of entries) {
    const childPath = [...path, key];
    if (FORBIDDEN_ANALYTICS_KEYS.has(normalizeAnalyticsKey(key))) hits.push(childPath.join("."));
    hits.push(...findForbiddenAnalyticsFields(child, childPath));
  }

  return hits;
}

function findUnsafeAnalyticsStrings(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") {
    return containsRawUrlOrDomain(value) ? [path.join(".") || "$"] : [];
  }
  if (!isRecord(value) && !Array.isArray(value)) return [];
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  return entries.flatMap(([key, child]) => findUnsafeAnalyticsStrings(child, [...path, key]));
}

function cleanToken(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength);
  return cleaned || null;
}

function cleanIsoDate(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value.slice(0, 40);
}

function cleanDateKey(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function analyticsIngestionTimeIssue(request: AnalyticsIngestionRequest, receivedAt: string) {
  const receivedAtMs = Date.parse(receivedAt);
  const optedInAtMs = Date.parse(request.userOptedInAt);
  if (!Number.isFinite(receivedAtMs)) return "Analytics receivedAt must be a valid UTC ISO timestamp.";
  if (!Number.isFinite(optedInAtMs)) return "Analytics userOptedInAt must be a valid UTC ISO timestamp.";
  if (optedInAtMs > receivedAtMs + MAX_ANALYTICS_CLOCK_SKEW_MS) {
    return "Analytics userOptedInAt must not be in the future.";
  }

  const snapshotDateMs = Date.parse(`${request.snapshot.generatedForDateKey}T00:00:00.000Z`);
  if (!Number.isFinite(snapshotDateMs)) return "Analytics generatedForDateKey must be a valid date key.";
  const receivedDate = new Date(receivedAtMs);
  const receivedDateStartMs = Date.UTC(
    receivedDate.getUTCFullYear(),
    receivedDate.getUTCMonth(),
    receivedDate.getUTCDate()
  );
  const maxSnapshotDateMs = receivedDateStartMs + MAX_ANALYTICS_SNAPSHOT_FUTURE_DAYS * 24 * 60 * 60 * 1000;
  if (snapshotDateMs > maxSnapshotDateMs) {
    return "Analytics generatedForDateKey must not be in the future.";
  }

  return null;
}

function cleanRetentionDays(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const days = Math.round(value);
  return days >= 1 && days <= 30 ? days : null;
}

function cleanCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100_000, Math.round(value))) : 0;
}

function cleanNullableCount(value: unknown) {
  if (value === null || value === undefined) return null;
  return cleanCount(value);
}

function cleanPercentLike(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1_000, Math.round(value))) : 0;
}

function cleanScale(value: unknown, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
}

function cleanNullableHour(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const hour = Math.round(value);
  return hour >= 0 && hour <= 23 ? hour : null;
}

function cleanNullableText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  return cleanText(value, maxLength);
}

function cleanHourlyUrgePattern(value: unknown) {
  const counts = Array.from({ length: 24 }, () => 0);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const hour = cleanNullableHour(item.hour);
      if (hour === null) continue;
      counts[hour] = cleanCount(item.count);
    }
  }

  return counts.map((count, hour) => ({ hour, count }));
}

function cleanBlockedAttemptSourceBreakdown(value: unknown) {
  const counts = new Map<AnalyticsBlockedAttemptSource, number>(
    ANALYTICS_BLOCKED_ATTEMPT_SOURCES.map((source) => [source, 0])
  );

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const source = cleanBlockedAttemptSource(item.source);
      if (!source) continue;
      counts.set(source, cleanCount(item.count));
    }
  }

  return ANALYTICS_BLOCKED_ATTEMPT_SOURCES.map((source) => ({
    source,
    count: counts.get(source) ?? 0
  }));
}

function cleanBlockedAttemptSource(value: unknown): AnalyticsBlockedAttemptSource | null {
  return typeof value === "string" && ANALYTICS_BLOCKED_ATTEMPT_SOURCES.includes(value as AnalyticsBlockedAttemptSource)
    ? (value as AnalyticsBlockedAttemptSource)
    : null;
}

function cleanStreakHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const dateKey = cleanDateKey(item.dateKey);
      if (!dateKey) return null;
      return {
        dateKey,
        streakDays: cleanCount(item.streakDays),
        relapseResets: cleanCount(item.relapseResets)
      };
    })
    .filter((item): item is { dateKey: string; streakDays: number; relapseResets: number } => Boolean(item));
}

function hasOwn(record: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasBooleanField(record: Record<string, unknown>, field: string) {
  return typeof record[field] === "boolean";
}

function hasTextField(record: Record<string, unknown>, field: string) {
  return typeof record[field] === "string" && record[field].trim().length > 0;
}

function hasNonNegativeNumberField(record: Record<string, unknown>, field: string) {
  return hasOwn(record, field) && finiteNumber(record[field]) && (record[field] as number) >= 0;
}

function hasNonNegativeNumberFields(record: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => hasNonNegativeNumberField(record, field));
}

function hasScaleNumberField(record: Record<string, unknown>, field: string, max: number) {
  return hasNonNegativeNumberField(record, field) && (record[field] as number) <= max;
}

function hasNullableCountField(record: Record<string, unknown>, field: string) {
  return hasOwn(record, field) && (record[field] === null || hasNonNegativeNumberField(record, field));
}

function hasNullableHourField(record: Record<string, unknown>, field: string) {
  if (!hasOwn(record, field)) return false;
  if (record[field] === null) return true;
  return finiteNumber(record[field]) && (record[field] as number) >= 0 && (record[field] as number) <= 23;
}

function hasCompleteBlockedAttemptSourceBreakdown(value: unknown) {
  if (!Array.isArray(value) || value.length !== ANALYTICS_BLOCKED_ATTEMPT_SOURCES.length) return false;
  const seen = new Set<AnalyticsBlockedAttemptSource>();
  for (const item of value) {
    if (!isRecord(item)) return false;
    const source = cleanBlockedAttemptSource(item.source);
    if (!source || seen.has(source) || !hasNonNegativeNumberField(item, "count")) return false;
    seen.add(source);
  }
  return seen.size === ANALYTICS_BLOCKED_ATTEMPT_SOURCES.length;
}

function hasCompleteHourlyUrgePattern(value: unknown) {
  if (!Array.isArray(value) || value.length !== 24) return false;
  const seen = new Set<number>();
  for (const item of value) {
    if (!isRecord(item) || !hasNonNegativeNumberField(item, "count")) return false;
    const hour = cleanNullableHour(item.hour);
    if (hour === null || seen.has(hour)) return false;
    seen.add(hour);
  }
  return seen.size === 24;
}

function hasCompleteStreakHistory(value: unknown, generatedForDateKey: string) {
  if (!Array.isArray(value) || value.length !== 7) return false;
  const seen = new Set<string>();
  let previousDateKey: string | null = null;

  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasTextField(item, "dateKey") ||
      !hasNonNegativeNumberField(item, "streakDays") ||
      !hasNonNegativeNumberField(item, "relapseResets")
    ) {
      return false;
    }

    const dateKey = cleanDateKey(item.dateKey);
    if (!dateKey || seen.has(dateKey)) return false;
    if (previousDateKey && dayDifference(previousDateKey, dateKey) !== 1) return false;
    seen.add(dateKey);
    previousDateKey = dateKey;
  }

  return previousDateKey === generatedForDateKey;
}

function dayDifference(leftDateKey: string, rightDateKey: string) {
  const left = Date.parse(`${leftDateKey}T00:00:00`);
  const right = Date.parse(`${rightDateKey}T00:00:00`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round((right - left) / 86_400_000);
}

function cleanChallengeSuccessByCategory(value: unknown) {
  const results = new Map<AnalyticsChallengeCategory, { completed: number; helpful: number }>(
    ANALYTICS_CHALLENGE_CATEGORIES.map((category) => [category, { completed: 0, helpful: 0 }])
  );

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const category = cleanChallengeCategory(item.category);
      if (!category) continue;
      const completed = cleanCount(item.completed);
      const helpful = Math.min(cleanCount(item.helpful), completed);
      results.set(category, { completed, helpful });
    }
  }

  return ANALYTICS_CHALLENGE_CATEGORIES.map((category) => {
    const counts = results.get(category) ?? { completed: 0, helpful: 0 };
    return {
      category,
      completed: counts.completed,
      helpful: counts.helpful,
      successRate: percent(counts.helpful, counts.completed)
    };
  });
}

function cleanChallengeCategory(value: unknown): AnalyticsChallengeCategory | null {
  return typeof value === "string" && ANALYTICS_CHALLENGE_CATEGORIES.includes(value as AnalyticsChallengeCategory)
    ? (value as AnalyticsChallengeCategory)
    : null;
}

function hasCompleteChallengeSuccessByCategory(value: unknown) {
  if (!Array.isArray(value) || value.length !== ANALYTICS_CHALLENGE_CATEGORIES.length) return false;
  const seen = new Set<AnalyticsChallengeCategory>();
  for (const item of value) {
    if (!isRecord(item)) return false;
    const category = cleanChallengeCategory(item.category);
    if (
      !category ||
      seen.has(category) ||
      !hasNonNegativeNumberField(item, "completed") ||
      !hasNonNegativeNumberField(item, "helpful") ||
      !hasScaleNumberField(item, "successRate", 100)
    ) {
      return false;
    }
    if ((item.helpful as number) > (item.completed as number)) return false;
    if (cleanScale(item.successRate, 100) !== percent(cleanCount(item.helpful), cleanCount(item.completed))) return false;
    seen.add(category);
  }
  return seen.size === ANALYTICS_CHALLENGE_CATEGORIES.length;
}

async function fetchAnalyticsSupabaseWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Analytics Supabase ingestion timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(input, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readAnalyticsSupabaseTimeoutMs() {
  return process.env.FREED_ANALYTICS_SUPABASE_TIMEOUT_MS?.trim() ?? "";
}

function normalizeAnalyticsSupabaseTimeoutMs(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_ANALYTICS_SUPABASE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_ANALYTICS_SUPABASE_TIMEOUT_MS;
  return Math.max(
    MIN_ANALYTICS_SUPABASE_TIMEOUT_MS,
    Math.min(MAX_ANALYTICS_SUPABASE_TIMEOUT_MS, Math.round(parsed))
  );
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = redactRecoverySignalText(value, maxLength) ?? value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!cleaned || containsRawUrlOrDomain(cleaned)) return null;
  return cleaned;
}

function containsRawUrlOrDomain(value: string) {
  return /https?:\/\/[^\s]+/i.test(value) ||
    /\b(?:[\w-]+\.)+[a-z]{2,63}(?:\/[^\s]*)?/i.test(value) ||
    /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/[^\s]*)?/i.test(value) ||
    /\b(?:receipt|purchase[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|secret|authorization|bearer)\s*[:=]\s*\S+/i.test(value) ||
    /\bya29\.[a-z0-9._-]+/i.test(value) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value);
}

function normalizeAnalyticsKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}
