import assert from "node:assert/strict";
import { test } from "node:test";

import * as recovery from "../src/lib/recovery-state";
import { buildRecoveryAnalyticsSnapshot } from "../src/lib/recovery-analytics";
import { calculateRecoveryScore, challengeLibrary, generateChallengeSet, type RecoveryProfile } from "../src/lib/recovery-engine";
import { createBlockingAttempt, createPanicInterventionAttempt } from "../src/lib/blocking-engine";
import { getActiveNativeEarnedUnlock } from "../src/lib/native-intervention";
import { configureFirebaseFeatureProviders } from "../src/lib/firebase-feature-runtime";
import { createFirebaseCallableContracts, type FirebaseChallengeRequest } from "../src/lib/firebase-client";
import { configureChallengeGenerationProvider, generateAdaptiveChallengeSet, getChallengeGenerationReadiness } from "../src/lib/challenge-generator";
import { createEncryptedRecoveryBackup, restoreEncryptedRecoveryBackup } from "../src/lib/recovery-backup";

const at = "2026-10-08T12:00:00.000Z";
const challenge = challengeLibrary.find(item => item.id === "breathing-478")!;
const browser = { ...createBlockingAttempt("https://pornhub.com/", "browser"), detectedAt: at };
function completion(index: number, outcome: "helped" | "still-urging" | "unknown" = "helped") {
  return { ...challenge, completedAt: new Date(Date.parse(at) - index * 60_000).toISOString(), outcome };
}

test("a new completion increases cumulative XP after detailed history reaches its cap", () => {
  const current = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    challengeHistory: Array.from({ length: 200 }, (_, index) => completion(index, index >= 90 ? "helped" : "still-urging"))
  });
  const next = recovery.recordChallengeCompletion(current, challenge, at, undefined, "still-urging");
  assert.equal(current.completedChallenges, 200);
  assert.equal(next.completedChallenges, 201);
  assert.equal(next.challengeHistory.length, 200);
  assert.equal(recovery.calculateRecoveryXp(current), 11_200);
  assert.equal(recovery.calculateRecoveryXp(next), 11_245);
  assert.equal(recovery.calculateRecoveryLevel(next).level, 11);
  assert.deepEqual(recovery.hydrateRecoveryState(recovery.hydrateRecoveryState(next)), next);
});

test("legacy cumulative count survives without inventing missing helpful outcomes", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(), completedChallenges: 500,
    challengeHistory: Array.from({ length: 200 }, (_, index) => completion(index, "unknown"))
  });
  assert.equal(saved.completedChallenges, 500);
  assert.equal(recovery.recordChallengeCompletion(saved, challenge, at).completedChallenges, 501);
  assert.equal(recovery.generateAchievementBadges(saved).find(item => item.id === "urge-surfer")?.earned, false);
  assert.deepEqual(recovery.hydrateRecoveryState(JSON.parse(JSON.stringify(saved))), saved);
});

test("manual diagnostics and panic support remain recorded without earning protection credit", () => {
  let saved = recovery.recordBlockingAttempt(recovery.createDefaultRecoveryState(), { ...browser, source: "manual-check" });
  saved = recovery.recordBlockingAttempt(saved, createPanicInterventionAttempt(at));
  const snapshot = buildRecoveryAnalyticsSnapshot(saved, at);
  assert.equal(saved.attempts.length, 2);
  assert.equal(snapshot.productionMetrics.blockedAttempts, 0);
  assert.equal(snapshot.productionMetrics.blockedAttemptSourceBreakdown.reduce((sum, item) => sum + item.count, 0), 0);
  assert.equal(snapshot.behavior.protectedRiskMoments, 0);
  assert.equal(snapshot.behavior.manualCheckInterceptions, 1);
  assert.equal(snapshot.behavior.selfReportedUrges, 1);
  assert.equal(recovery.generateMonthlyGrowthReport(saved, at).protectedMoments, 0);
  assert.equal(recovery.generateAchievementBadges(saved).find(item => item.id === "protected-moment")?.earned, false);
  assert.equal(recovery.calculateRecoveryXp(saved), 0);
});

test("archive normalization rejects alias minute keys without duplicating totals", () => {
  assert.equal(typeof recovery.getLifetimeProtectedAttemptCount, "function");
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    activityArchive: { attemptMinutes: { "0": { browser: 1 }, "00": { browser: 99 } } }
  });
  assert.equal(recovery.getLifetimeProtectedAttemptCount(saved), 1);
  // Minute zero is the Unix epoch instant. In negative-offset zones its local
  // calendar date is December 31; querying that same instant preserves the oracle.
  assert.equal(recovery.countProtectedAttemptsForDay(saved, "1970-01-01T00:00:00.000Z"), 1);
});

test("challenge generation stays local with a remote hint and preserves every feedback outcome", async () => {
  let contractReads = 0, callableCalls = 0, providerCalls = 0, fetchCalls = 0;
  const contracts = createFirebaseCallableContracts({ call: async () => {
    callableCalls += 1;
    throw new Error("Unexpected challenge callable transport.");
  } });
  const cleanup = configureFirebaseFeatureProviders(async () => { contractReads += 1; return contracts; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("Unexpected challenge fetch transport."); };
  configureChallengeGenerationProvider(async () => { providerCalls += 1; return challengeLibrary.slice(0, 3); });
  const profile: RecoveryProfile = {
    streakDays: 0, mood: "steady", premium: false, attemptsToday: 0, hour: 12,
    exportState: recovery.createDefaultRecoveryState(), exportDay: at,
    challengeHistory: [
      { id: "legacy_unknown", category: "breathing", outcome: "unknown", completedAt: at },
      { id: "breathing-478", category: "breathing", outcome: "helped", completedAt: at },
      { id: "walk-outside", category: "reset", outcome: "still-urging", completedAt: at }
    ]
  };
  const before = structuredClone(profile);
  try {
    const generated = await generateAdaptiveChallengeSet(profile, { mode: "remote" });
    assert.deepEqual(getChallengeGenerationReadiness({ mode: "remote" }), { status: "local", mode: "local", missing: [] });
    assert.deepEqual(generated, generateChallengeSet(profile));
    assert.equal(generated.length, 3);
    assert.deepEqual({ contractReads, callableCalls, providerCalls, fetchCalls },
      { contractReads: 0, callableCalls: 0, providerCalls: 0, fetchCalls: 0 });
    assert.deepEqual(profile, before);
    assert.deepEqual(profile.challengeHistory!.map(item => ({ id: item.id, outcome: item.outcome })), [
      { id: "legacy_unknown", outcome: "unknown" },
      { id: "breathing-478", outcome: "helped" }, { id: "walk-outside", outcome: "still-urging" }
    ]);
  } finally { globalThis.fetch = originalFetch; cleanup(); }
});

// Explicit legacy callable input, not a test-side substitute for a removed DTO adapter.
function knownAnswerChallengeDto(): FirebaseChallengeRequest {
  return {
    clientEventId: "evt_accuracy123",
    profile: {
      streakDays: 0, premium: false, attemptsToday: 0, mood: "steady", hour: 12, dayPart: "afternoon",
      isWeekend: null, timezoneOffsetMinutes: null, slipsThisWeek: 0, slipWindow: null, slipTrigger: null,
      interventionContext: null, disciplinePreferences: null, contextSignals: null, riskForecast: null,
      recentFailureCount: 0, preferredCategories: []
    },
    recentChallengeHistory: [
      { id: "breathing-478", category: "breathing", outcome: "helped", completedAt: at },
      { id: "walk-outside", category: "reset", outcome: "still-urging", completedAt: at }
    ]
  };
}

test("Firebase answered-feedback DTO rejects unknown history before transport without relabeling it", async () => {
  let callableCalls = 0;
  const contracts = createFirebaseCallableContracts({ call: async () => {
    callableCalls += 1;
    throw new Error("Invalid feedback must never reach transport.");
  } });
  const payload = {
    ...knownAnswerChallengeDto(),
    recentChallengeHistory: [
      { id: "legacy_unknown", category: "breathing", outcome: "unknown", completedAt: at },
      ...knownAnswerChallengeDto().recentChallengeHistory
    ]
  };
  const before = structuredClone(payload);
  await assert.rejects(contracts.generateChallenges(payload as FirebaseChallengeRequest), /not permitted in Firebase AI callable payloads/i);
  assert.equal(callableCalls, 0);
  assert.deepEqual(payload, before);
  assert.equal(payload.recentChallengeHistory[0].outcome, "unknown");
});

test("Firebase answered-feedback DTO preserves explicit helped and still-urging answers through the real callable contract", async () => {
  let transmitted: FirebaseChallengeRequest | undefined;
  let callableCalls = 0;
  const contracts = createFirebaseCallableContracts({ call: async (name, payload) => {
    callableCalls += 1;
    assert.equal(name, "generateChallenges");
    transmitted = payload as FirebaseChallengeRequest;
    throw new Error("Recorded validated DTO without a live provider.");
  } });
  const payload = knownAnswerChallengeDto();
  const before = structuredClone(payload);
  await assert.rejects(contracts.generateChallenges(payload), /Recorded validated DTO without a live provider/);
  assert.equal(callableCalls, 1);
  assert.notEqual(transmitted, undefined);
  assert.deepEqual(transmitted, before);
  assert.deepEqual(transmitted!.recentChallengeHistory.map(item => ({ id: item.id, outcome: item.outcome })), [
    { id: "breathing-478", outcome: "helped" }, { id: "walk-outside", outcome: "still-urging" }
  ]);
  assert.deepEqual(payload, before);
});

test("archived interceptions remain in current day, week and lifetime totals", () => {
  assert.equal(typeof recovery.countProtectedAttemptsForDay, "function");
  assert.equal(typeof recovery.getLifetimeProtectedAttemptCount, "function");
  let saved = recovery.createDefaultRecoveryState();
  for (let index = 0; index < 101; index += 1) {
    saved = recovery.recordBlockingAttempt(saved, { ...browser, detectedAt: new Date(Date.parse(at) + index * 1_000).toISOString() });
  }
  assert.equal(saved.attempts.length, 100);
  assert.equal(recovery.countProtectedAttemptsForDay(saved, at), 101);
  assert.equal(recovery.getLifetimeProtectedAttemptCount(saved), 101);
  assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).productionMetrics.blockedAttempts, 101);
  assert.equal(recovery.generateMonthlyGrowthReport(saved, at).protectedMoments, 101);
  assert.equal(recovery.calculateRecoveryXp(saved), 808);
  assert.equal(JSON.stringify(saved.activityArchive).includes("pornhub"), false);
  assert.deepEqual(recovery.hydrateRecoveryState(recovery.hydrateRecoveryState(saved)), saved);
});

test("UTC minute archives follow the current local timezone and retain repeated DST hours", () => {
  assert.equal(typeof recovery.countProtectedAttemptsForDay, "function");
  const previousZone = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const saved = recovery.hydrateRecoveryState({
      ...recovery.createDefaultRecoveryState(),
      attempts: [
        ...Array.from({ length: 100 }, () => ({ ...browser, detectedAt: "2026-11-02T12:00:00.000Z" })),
        { ...browser, detectedAt: "2026-10-08T20:00:00.000Z" },
        { ...browser, detectedAt: "2026-11-01T05:30:00.000Z" },
        { ...browser, detectedAt: "2026-11-01T06:30:00.000Z" }
      ]
    });
    process.env.TZ = "Asia/Kolkata";
    assert.equal(recovery.countProtectedAttemptsForDay(saved, "2026-10-09T06:00:00.000Z"), 1);
    process.env.TZ = "Pacific/Honolulu";
    assert.equal(recovery.countProtectedAttemptsForDay(saved, "2026-10-08T20:00:00.000Z"), 1);
    process.env.TZ = "America/New_York";
    const snapshot = buildRecoveryAnalyticsSnapshot(saved, "2026-11-01T18:00:00.000Z");
    assert.equal(snapshot.productionMetrics.blockedAttempts, 2);
    assert.equal(snapshot.productionMetrics.hourlyUrgePattern.find(item => item.hour === 1)?.count, 2);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test("analytics recovery score uses current-day risk and respects the persisted rollback clamp", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(), recoveryStartedAt: "2026-09-28T12:00:00.000Z", streakDays: 10,
    challengeHistory: Array.from({ length: 7 }, (_, index) => completion(index)),
    attempts: [{ ...browser, detectedAt: "2026-10-04T12:00:00.000Z" }]
  });
  assert.equal(calculateRecoveryScore(10, 7, 0), 68);
  assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).summary.recoveryScore, 68);
  const rollback = recovery.touchRecoveryState({
    ...recovery.createDefaultRecoveryState(), recoveryStartedAt: "2026-01-01T09:00:00.000Z",
    streakDays: 30, bestStreakDays: 34, lastOpenedAt: "2026-01-31T20:00:00.000Z"
  }, "2026-01-20T08:00:00.000Z");
  assert.equal(rollback.streakDays, 30);
  assert.equal(buildRecoveryAnalyticsSnapshot(rollback, "2026-01-20T08:00:00.000Z").summary.streakDays, 30);
});

test("foreground intervals contribute only minutes overlapping the report window", () => {
  // The report includes seven LOCAL calendar days, not seven UTC days or 168 hours.
  // Build the oracle from calendar fields independently of the production helpers.
  // March/November also exercise New York's shortened/lengthened DST report weeks.
  for (const [year, month, day] of [[2026, 10, 8], [2026, 3, 8], [2026, 11, 1]]) {
    const reportAt = new Date(year, month - 1, day, 12).toISOString();
    const start = new Date(year, month - 1, day - 6).getTime();
    const end = new Date(year, month - 1, day + 1).getTime();
    const minute = 60_000;
    for (const [id, opened, closed, expectedMinutes, expectedOpens] of [
      ["cross-start", start - 10 * minute, start + 10 * minute, 10, 0],
      ["cross-end", end - 10 * minute, end + 10 * minute, 10, 1],
      ["ends-at-start", start - 20 * minute, start, 0, 0],
      ["opens-at-end", end, end + 20 * minute, 0, 0],
      ["inside-start", start, start + 20 * minute, 20, 1]
    ] as const) {
      const session = { id, openedAt: new Date(opened).toISOString(), closedAt: new Date(closed).toISOString(), durationSec: 1200 };
      const saved = recovery.hydrateRecoveryState({ ...recovery.createDefaultRecoveryState(), appSessions: [session] });
      const snapshot = buildRecoveryAnalyticsSnapshot(saved, reportAt);
      assert.equal(snapshot.productionMetrics.appForegroundMinutes, expectedMinutes, `${reportAt}: ${id}`);
      assert.equal(snapshot.productionMetrics.appOpens, expectedOpens, `${reportAt}: ${id} opens`);
    }
  }
});

test("unknown feedback stays unknown and helpfulness denominator includes only answers", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    challengeHistory: [
      { id: challenge.id, title: challenge.title, category: challenge.category, completedAt: at },
      completion(1, "helped"), completion(2, "still-urging")
    ]
  });
  assert.equal(saved.challengeHistory[0].outcome, "unknown");
  const snapshot = buildRecoveryAnalyticsSnapshot(saved, at);
  assert.equal(snapshot.interventions.completedChallenges, 3);
  assert.equal(snapshot.interventions.helpfulChallenges, 1);
  assert.equal(snapshot.interventions.stillUrgingChallenges, 1);
  assert.equal(snapshot.interventions.challengeHelpRate, 50);
  assert.equal(snapshot.productionMetrics.challengeSuccessByCategory.find(item => item.category === "breathing")?.successRate, 50);
});

test("hydration never extends an original earned-unlock deadline", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    earnedUnlocks: [{ id: "short", sourceChallengeId: challenge.id, startedAt: at, expiresAt: "2026-10-08T12:00:07.000Z", durationMinutes: 1 }]
  });
  assert.equal(saved.earnedUnlocks[0].expiresAt, "2026-10-08T12:00:07.000Z");
  assert.equal(recovery.getActiveEarnedUnlock(saved, "2026-10-08T12:00:30.000Z"), null);
});

test("portable projection seals source sessions and preserves historical grants without live authority", () => {
  assert.equal(typeof recovery.buildPortableRecoverySessionState, "function");
  let saved = recovery.recordAppSessionStart(recovery.createDefaultRecoveryState(), "2026-10-08T11:00:00.000Z");
  saved = recovery.recordEarnedUnlock(saved, challenge, {
    startedAt: at, durationMinutes: 10, sourceAttemptHost: "com.google.android.youtube",
    nativeInterventionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  });
  const projected = recovery.buildPortableRecoverySessionState(saved, at);
  const portable = recovery.hydrateRecoveryState({ ...saved, ...projected });
  assert.equal(portable.appSessions[0].closedAt, at);
  assert.equal(portable.appSessions[0].durationSec, 3600);
  assert.equal(portable.earnedUnlocks[0].durationMinutes, 10);
  assert.equal(portable.earnedUnlocks[0].nativeInterventionId, undefined);
  assert.equal(recovery.getActiveEarnedUnlock(portable, "2026-10-08T12:05:00.000Z"), null);
  assert.equal(getActiveNativeEarnedUnlock(portable.earnedUnlocks, "android", "2026-10-08T12:05:00.000Z"), null);
  assert.deepEqual(recovery.buildPortableRecoverySessionState(portable, at), projected);
  assert.equal(buildRecoveryAnalyticsSnapshot(portable, at).productionMetrics.unlockMinutesGranted, 10);
});

test("a backwards clock closes the foreground session without inventing elapsed time", () => {
  const opened = recovery.recordAppSessionStart(recovery.createDefaultRecoveryState(), at);
  const closed = recovery.recordAppSessionEnd(opened, "2026-10-08T11:59:00.000Z");
  assert.equal(closed.appSessions[0].closedAt, at);
  assert.equal(closed.appSessions[0].durationSec, 0);
  const reopened = recovery.recordAppSessionStart(closed, "2026-10-08T11:59:30.000Z");
  assert.equal(reopened.appSessions.length, 2);
});

test("own-action archives survive encryption while local device history remains intact", async () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(), automaticBackupEnabled: true,
    attempts: Array.from({ length: 101 }, (_, index) => ({ ...browser, detectedAt: new Date(Date.parse(at) - index * 1_000).toISOString() })),
    challengeHistory: Array.from({ length: 201 }, (_, index) => completion(index)),
    appSessions: Array.from({ length: 121 }, (_, index) => ({
      id: `session-${index}`, openedAt: new Date(Date.parse(at) - index * 120_000 - 60_000).toISOString(),
      closedAt: new Date(Date.parse(at) - index * 120_000).toISOString(), durationSec: 60
    })),
    earnedUnlocks: Array.from({ length: 41 }, (_, index) => ({
      id: `grant-${index}`, sourceChallengeId: challenge.id, durationMinutes: 10,
      startedAt: new Date(Date.parse(at) - index * 60_000).toISOString(),
      expiresAt: new Date(Date.parse(at) - index * 60_000 + 600_000).toISOString()
    }))
  });
  assert.equal(recovery.getLifetimeProtectedAttemptCount(saved), 101);
  assert.equal(saved.completedChallenges, 201);
  assert.equal(recovery.hydrateRecoveryState(saved).automaticBackupEnabled, true);
  const sourceBeforeExport = JSON.stringify(saved);
  const envelope = await createEncryptedRecoveryBackup(saved, "accuracy backup passphrase", at);
  const restored = await restoreEncryptedRecoveryBackup(envelope, "accuracy backup passphrase");
  assert.deepEqual(restored.activityArchive, { ...saved.activityArchive, attemptMinutes: {}, attemptTotals: {}, unlockMinutes: {}, unlockTotals: { count: 0, seconds: 0 } });
  assert.equal(recovery.getLifetimeProtectedAttemptCount(restored), 0);
  assert.equal(JSON.stringify(saved), sourceBeforeExport);
  assert.equal(recovery.getLifetimeProtectedAttemptCount(saved), 101);
  assert.equal(restored.completedChallenges, 201);
  assert.equal(buildRecoveryAnalyticsSnapshot(restored, at).interventions.helpfulChallenges, 201);
  assert.equal(buildRecoveryAnalyticsSnapshot(restored, at).productionMetrics.appOpens, 121);
  assert.equal(buildRecoveryAnalyticsSnapshot(restored, at).productionMetrics.appForegroundMinutes, 121);
  assert.equal(buildRecoveryAnalyticsSnapshot(restored, at).productionMetrics.earnedUnlocks, 0);
  assert.equal(buildRecoveryAnalyticsSnapshot(restored, at).productionMetrics.unlockMinutesGranted, 0);
  assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).productionMetrics.earnedUnlocks, 41);
  assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).productionMetrics.unlockMinutesGranted, 410);
  assert.equal(restored.automaticBackupEnabled, false);
  assert.deepEqual(await restoreEncryptedRecoveryBackup(envelope, "accuracy backup passphrase"), restored);
});

test("121 same-week sessions retain every open and foreground minute after the detail cap", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    appSessions: Array.from({ length: 121 }, (_, index) => ({
      id: `session-${index}`, openedAt: new Date(Date.parse(at) - index * 120_000 - 60_000).toISOString(),
      closedAt: new Date(Date.parse(at) - index * 120_000).toISOString(), durationSec: 60
    }))
  });
  assert.equal(saved.appSessions.length, 120);
  const snapshot = buildRecoveryAnalyticsSnapshot(saved, at);
  assert.equal(snapshot.productionMetrics.appOpens, 121);
  assert.equal(snapshot.productionMetrics.appForegroundMinutes, 121);
  assert.deepEqual(recovery.hydrateRecoveryState(recovery.hydrateRecoveryState(saved)), saved);
});

test("41 same-week grants retain accurate counts and minutes after the detail cap", () => {
  const saved = recovery.hydrateRecoveryState({
    ...recovery.createDefaultRecoveryState(),
    earnedUnlocks: Array.from({ length: 41 }, (_, index) => ({
      id: `grant-${index}`, sourceChallengeId: challenge.id, durationMinutes: 10,
      startedAt: new Date(Date.parse(at) - index * 60_000).toISOString(),
      expiresAt: new Date(Date.parse(at) - index * 60_000 + 600_000).toISOString()
    }))
  });
  assert.equal(saved.earnedUnlocks.length, 40);
  const snapshot = buildRecoveryAnalyticsSnapshot(saved, at);
  assert.equal(snapshot.productionMetrics.earnedUnlocks, 41);
  assert.equal(snapshot.productionMetrics.unlockMinutesGranted, 410);
  assert.equal(snapshot.productionMetrics.unlockFrequencyPerWeek, 41);
  assert.deepEqual(recovery.hydrateRecoveryState(recovery.hydrateRecoveryState(saved)), saved);
});

test("archived session spans retain overlap precision across UTC and local-day boundaries", () => {
  const previousZone = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const saved = recovery.hydrateRecoveryState({
      ...recovery.createDefaultRecoveryState(),
      appSessions: [
        ...Array.from({ length: 120 }, (_, index) => ({ id: `recent-${index}`, openedAt: "2026-10-20T12:00:00.000Z", closedAt: "2026-10-20T12:01:00.000Z", durationSec: 60 })),
        { id: "older-overlap", openedAt: "2026-10-01T23:50:00.000Z", closedAt: "2026-10-02T00:10:00.000Z", durationSec: 1200 }
      ]
    });
    assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).productionMetrics.appForegroundMinutes, 10);
    process.env.TZ = "Asia/Kolkata";
    assert.equal(buildRecoveryAnalyticsSnapshot(saved, at).productionMetrics.appForegroundMinutes, 20);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test("record paths archive real session and grant actions before trimming detail", () => {
  let sessions = recovery.createDefaultRecoveryState();
  for (let index = 0; index < 121; index += 1) {
    const opened = Date.parse(at) + index * 120_000;
    sessions = recovery.recordAppSessionEnd(recovery.recordAppSessionStart(sessions, new Date(opened).toISOString()), new Date(opened + 60_000).toISOString());
  }
  const sessionSnapshot = buildRecoveryAnalyticsSnapshot(sessions, "2026-10-08T20:00:00.000Z");
  assert.equal(sessionSnapshot.productionMetrics.appOpens, 121);
  assert.equal(sessionSnapshot.productionMetrics.appForegroundMinutes, 121);
  let grants = recovery.createDefaultRecoveryState();
  for (let index = 0; index < 41; index += 1) {
    grants = recovery.recordEarnedUnlock(grants, challenge, { startedAt: new Date(Date.parse(at) + index * 300_000).toISOString(), durationMinutes: 10 });
  }
  const grantSnapshot = buildRecoveryAnalyticsSnapshot(grants, "2026-10-08T20:00:00.000Z");
  assert.equal(grantSnapshot.productionMetrics.earnedUnlocks, 41);
  assert.equal(grantSnapshot.productionMetrics.unlockMinutesGranted, 410);
});
