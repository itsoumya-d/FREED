import assert from "node:assert/strict";
import test from "node:test";
import { getChallengeSelectionKey } from "../src/lib/challenge-selection-key";
import type { ChallengeCapabilities } from "../src/lib/challenge-capability";
import type { RecoveryProfile, RecoveryChallenge } from "../src/lib/recovery-engine";

const custom: RecoveryChallenge = { id: "custom-reset", title: "Calm reset", category: "breathing", durationSec: 90,
  intensity: "calm", premium: true, icon: "Waves", steps: ["Breathe in.", "Breathe out."], why: "Interrupt the loop." };
const profile: RecoveryProfile = {
  streakDays: 7, premium: false, attemptsToday: 2, mood: "stressed", hour: 14, dayOfWeek: 5, timezoneOffsetMinutes: -330,
  slipsThisWeek: 1, slipWindow: "Evening", slipTrigger: "stress", recentFailureCount: 1, preferredCategories: ["breathing", "reset"],
  challengeHistory: [{ id: "breathing-478", category: "breathing", outcome: "helped", completedAt: "2026-10-01T13:00:00.000Z" }],
  interventionContext: { source: "browser", category: "adult", surface: "adult-site", matchedRule: "domain:example", sessionDurationBucket: "5-15m" },
  disciplinePreferences: { challengeIntensity: "balanced", outdoorFrequency: "balanced", exercisePreference: "balanced", socialFrequency: "low",
    emergencyStrictMode: false, sleepModeActive: false, deepFocusModeActive: false, weekendModeEnabled: false, unlockDurationMinutes: 10, dailyLimitMinutes: 30 },
  contextSignals: { energyLevel: "steady", urgeLevel: 3, sleepQuality: 4, locationPermission: "granted", weatherCondition: "clear", temperatureC: 26 },
  riskForecast: { level: "elevated", score: 52, confidence: "medium", currentWindow: "Evening risk window", drivers: ["Recent risk moments logged"] },
  customChallenges: [custom]
};
const capabilities: ChallengeCapabilities = {
  motion: { available: true, permission: "granted", canAskAgain: true },
  steps: { available: true, permission: "granted", canAskAgain: true },
  location: { available: true, permission: "granted", canAskAgain: true },
  photo: { available: true, permission: "undetermined", canAskAgain: true },
  connection: { available: true, permission: "granted", canAskAgain: false }
};

test("offline selection does not read remote export state or export-day bookkeeping", () => {
  const local = { ...profile };
  Object.defineProperties(local, {
    exportState: { get() { throw new Error("Remote export state must not be read by local selection."); } },
    exportDay: { get() { throw new Error("Remote export date must not be read by local selection."); } }
  });
  assert.equal(getChallengeSelectionKey(local, capabilities), getChallengeSelectionKey(profile, capabilities));
});

test("native intervention and local forecast changes remain meaningful without an export context", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  assert.notEqual(getChallengeSelectionKey({ ...profile, interventionContext: {
    ...profile.interventionContext!, source: "app", category: "unknown", surface: "video",
    matchedRule: "ios-screen-time-shield", sessionDurationBucket: "30m-plus"
  } }, capabilities), original);
  assert.notEqual(getChallengeSelectionKey({ ...profile, riskForecast: {
    ...profile.riskForecast!, level: "high", score: 80, drivers: ["Local protection pattern"]
  } }, capabilities), original);
});

test("a minute of new clock, frame and forecast objects leaves one semantic request key", () => {
  const keys = new Set<string>();
  for (let second = 0; second < 60; second++) {
    const next = { ...profile, elapsedSec: second, frameCount: second,
      generatedAt: `2026-10-02T08:30:${String(second).padStart(2, "0")}.000Z`,
      contextSignals: { ...profile.contextSignals!, measuredAt: second },
      riskForecast: { ...profile.riskForecast!, drivers: [...profile.riskForecast!.drivers], generatedAt: second,
        generatedAtHourBucket: "Afternoon", protectiveFactors: [String(second)], recommendedAction: String(second) },
      challengeHistory: profile.challengeHistory!.map(item => ({ ...item })),
      disciplinePreferences: { ...profile.disciplinePreferences! }
    };
    keys.add(getChallengeSelectionKey(next, structuredClone(capabilities)));
  }
  assert.equal(keys.size, 1);
});

test("equivalent object property order does not cancel a pending generation request", () => {
  const reordered = { ...profile,
    contextSignals: { temperatureC: 26, weatherCondition: "clear" as const, locationPermission: "granted" as const, sleepQuality: 4, urgeLevel: 3, energyLevel: "steady" as const },
    riskForecast: { drivers: ["Recent risk moments logged"], currentWindow: "Evening risk window", confidence: "medium" as const, score: 52, level: "elevated" as const }
  };
  const reorderedCapabilities = Object.fromEntries(Object.entries(capabilities).reverse().map(([kind, value]) => [kind,
    { canAskAgain: value.canAskAgain, permission: value.permission, available: value.available }])) as ChallengeCapabilities;
  assert.equal(getChallengeSelectionKey(reordered, reorderedCapabilities), getChallengeSelectionKey(profile, capabilities));
});

test("recorded recovery inputs and premium status change selection", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  const changes: [string, RecoveryProfile][] = [
    ["streak", { ...profile, streakDays: 8 }], ["protected attempt", { ...profile, attemptsToday: 3 }],
    ["mood", { ...profile, mood: "low" }], ["premium", { ...profile, premium: true }],
    ["slip count", { ...profile, slipsThisWeek: 2 }], ["slip window", { ...profile, slipWindow: "Late night" }],
    ["slip trigger", { ...profile, slipTrigger: "boredom" }], ["failure count", { ...profile, recentFailureCount: 2 }],
    ["preferences", { ...profile, preferredCategories: ["physical"] }],
    ["intervention surface", { ...profile, interventionContext: { ...profile.interventionContext!, surface: "self-urge" } }],
    ["intervention session", { ...profile, interventionContext: { ...profile.interventionContext!, sessionDurationBucket: "30m-plus" } }],
    ["discipline", { ...profile, disciplinePreferences: { ...profile.disciplinePreferences!, socialFrequency: "off" } }],
    ["check-in urge", { ...profile, contextSignals: { ...profile.contextSignals!, urgeLevel: 4 } }],
    ["check-in sleep", { ...profile, contextSignals: { ...profile.contextSignals!, sleepQuality: 2 } }],
    ["check-in energy", { ...profile, contextSignals: { ...profile.contextSignals!, energyLevel: "low" } }]
  ];
  for (const [label, changed] of changes) assert.notEqual(getChallengeSelectionKey(changed, capabilities), original, label);
});

test("local hour, day and timezone changes are meaningful context", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  for (const changed of [{ ...profile, hour: 15 }, { ...profile, dayOfWeek: 4 }, { ...profile, timezoneOffsetMinutes: 0 }]) {
    assert.notEqual(getChallengeSelectionKey(changed, capabilities), original);
  }
});

test("weather and location permission changes refresh the request", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  for (const change of [{ locationPermission: "denied" as const }, { weatherCondition: "rain" as const }, { temperatureC: 35 }]) {
    assert.notEqual(getChallengeSelectionKey({ ...profile, contextSignals: { ...profile.contextSignals!, ...change } }, capabilities), original);
  }
});

test("risk level, drivers and the other prompt-used forecast fields refresh the request", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  for (const change of [{ level: "high" as const }, { drivers: ["Low sleep reported today"] }, { score: 70 },
    { confidence: "high" as const }, { currentWindow: "Sleep mode window" }]) {
    assert.notEqual(getChallengeSelectionKey({ ...profile, riskForecast: { ...profile.riskForecast!, ...change } }, capabilities), original);
  }
});

test("recorded completion timestamps and changed outcomes remain meaningful", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  for (const change of [{ completedAt: "2026-10-02T08:00:00.000Z" }, { outcome: "still-urging" as const }, { id: "walk-room" }, { category: "reset" as const }]) {
    assert.notEqual(getChallengeSelectionKey({ ...profile, challengeHistory: [{ ...profile.challengeHistory![0], ...change }] }, capabilities), original);
  }
});

test("an older recorded outcome still refreshes local fallback selection beyond the remote history limit", () => {
  const histories = Array.from({ length: 12 }, (_, index) => ({ id: `reset-${index}`, category: "reset" as const,
    outcome: "helped" as const, completedAt: `2026-10-01T${String(index).padStart(2, "0")}:00:00.000Z` }));
  const initial = { ...profile, challengeHistory: histories };
  const changed = { ...profile, challengeHistory: histories.map((item, index) => index === 0 ? { ...item, outcome: "still-urging" as const } : item) };
  assert.notEqual(getChallengeSelectionKey(changed, capabilities), getChallengeSelectionKey(initial, capabilities));
});

test("capability availability, permission, asking again and probe completion refresh selection", () => {
  const original = getChallengeSelectionKey(profile, capabilities);
  assert.notEqual(getChallengeSelectionKey(profile, null), original);
  for (const change of [{ available: false }, { permission: "denied" as const }, { canAskAgain: false }]) {
    assert.notEqual(getChallengeSelectionKey(profile, { ...capabilities, photo: { ...capabilities.photo, ...change } }), original);
  }
});

test("eligible custom challenge edits refresh premium selection and have no effect for free accounts", () => {
  const changed = { ...custom, title: "Calm evening reset" };
  assert.notEqual(getChallengeSelectionKey({ ...profile, premium: true, customChallenges: [changed] }, capabilities),
    getChallengeSelectionKey({ ...profile, premium: true }, capabilities));
  assert.equal(getChallengeSelectionKey({ ...profile, customChallenges: [changed] }, capabilities), getChallengeSelectionKey(profile, capabilities));
});
