import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { configureRemoteCoachProvider, getCoachConfig, replyWithCoach } from "../src/lib/ai-coach";
import { configureChallengeGenerationProvider, generateAdaptiveChallengeSet, getChallengeGenerationConfig } from "../src/lib/challenge-generator";
import { configureRemoteRetentionProvider, generateRetentionPlan, getRetentionConfig } from "../src/lib/retention-orchestrator";
import { createDefaultRecoveryState, recordDailyCheckIn } from "../src/lib/recovery-state";

const MODE_KEYS = ["EXPO_PUBLIC_AI_COACH_MODE", "EXPO_PUBLIC_AI_CHALLENGE_MODE", "EXPO_PUBLIC_RETENTION_MODE"] as const;
const ENDPOINT_KEYS = ["EXPO_PUBLIC_AI_COACH_ENDPOINT", "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT", "EXPO_PUBLIC_RETENTION_ENDPOINT"] as const;

function fixture(t: TestContext, mode?: "local" | "remote") {
  const original = Object.fromEntries([...MODE_KEYS, ...ENDPOINT_KEYS].map(key => [key, process.env[key]]));
  for (const key of MODE_KEYS) {
    if (mode) process.env[key] = mode;
    else delete process.env[key];
  }
  for (const key of ENDPOINT_KEYS) process.env[key] = "https://never-dispatch.example/ai";
  const calls = { coach: 0, challenges: 0, retention: 0, http: 0 };
  configureRemoteCoachProvider(async () => { calls.coach += 1; throw new Error("Sensitive remote coach dispatch"); });
  configureChallengeGenerationProvider(async () => { calls.challenges += 1; throw new Error("Sensitive remote challenge dispatch"); });
  configureRemoteRetentionProvider(async () => { calls.retention += 1; throw new Error("Sensitive remote retention dispatch"); });
  t.mock.method(globalThis, "fetch", async () => { calls.http += 1; throw new Error("Unexpected HTTP dispatch"); });
  t.after(() => {
    configureRemoteCoachProvider(null);
    configureChallengeGenerationProvider(null);
    configureRemoteRetentionProvider(null);
    for (const key of [...MODE_KEYS, ...ENDPOINT_KEYS]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: "steady", urgeLevel: 2, sleepQuality: 4, reflection: "Private local reflection" });
  const context = { exportState: state, attempts: state.attempts, streakDays: 2, premium: false };
  const profile = { exportState: state, streakDays: 2, premium: false, attemptsToday: 0, mood: "steady" as const, hour: 12 };
  return { calls, state, context, profile };
}

test("registered providers and configured endpoints cannot silently enable remote AI", async t => {
  const f = fixture(t);
  const reply = await replyWithCoach("Help me choose a reset", f.context);
  const challenges = await generateAdaptiveChallengeSet(f.profile);
  const retention = await generateRetentionPlan(f.state);
  assert.deepEqual(f.calls, { coach: 0, challenges: 0, retention: 0, http: 0 });
  assert.equal(reply.provider, "local");
  assert.equal(challenges.length, 3);
  assert.equal(retention.provider, "local");
  assert.deepEqual([getCoachConfig().mode, getChallengeGenerationConfig().mode, getRetentionConfig().mode], ["local", "local", "local"]);
});

test("explicit local deployment modes override registered AI providers for every entrypoint", async t => {
  const f = fixture(t, "local");
  const reply = await replyWithCoach("Help me choose a reset", f.context);
  const challenges = await generateAdaptiveChallengeSet(f.profile);
  const retention = await generateRetentionPlan(f.state);
  assert.deepEqual(f.calls, { coach: 0, challenges: 0, retention: 0, http: 0 });
  assert.equal(reply.provider, "local");
  assert.equal(challenges.length, 3);
  assert.equal(retention.provider, "local");
});

test("explicit local call options override remote deployment modes without transmitting a payload", async t => {
  const f = fixture(t, "remote");
  assert.equal((await replyWithCoach("Help me choose a reset", f.context, { mode: "local" })).provider, "local");
  assert.equal((await generateAdaptiveChallengeSet(f.profile, { mode: "local" })).length, 3);
  assert.equal((await generateRetentionPlan(f.state, { mode: "local" })).provider, "local");
  assert.deepEqual(f.calls, { coach: 0, challenges: 0, retention: 0, http: 0 });
});
