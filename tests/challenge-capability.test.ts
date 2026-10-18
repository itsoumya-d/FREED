import assert from "node:assert/strict";
import test from "node:test";
import { readChallengeCapabilities, getChallengeCapability, selectCapableChallengeSet, type ChallengeCapabilities } from "../src/lib/challenge-capability";
import { generateAdaptiveChallengeSet, configureChallengeGenerationProvider } from "../src/lib/challenge-generator";
import type { RecoveryChallenge } from "../src/lib/recovery-engine";

const denied = { available: false, permission: "unavailable" as const, canAskAgain: false };
const granted = { available: true, permission: "granted" as const, canAskAgain: true };
const caps: ChallengeCapabilities = { motion: denied, steps: denied, location: denied, photo: denied, connection: denied };
const base: RecoveryChallenge = { id: "reset-a", title: "Breathe slowly", category: "breathing", durationSec: 60,
  intensity: "calm", premium: false, icon: "Waves", steps: ["Inhale.", "Exhale."], why: "Pause for a minute.", verification: { version: 1, kind: 'timer' } };
const motion: RecoveryChallenge = { ...base, id: "motion-a", category: "physical", title: "Do controlled pushups", verification: { version: 1, kind: 'motion', minMotionSamples: 6 } };
const photo: RecoveryChallenge = { ...base, id: "flower-a", category: "reset", title: "Take a photo of a flower", steps: ["Find a flower.", "Take a fresh camera photo."], verification: { version: 1, kind: 'photo', targetId: 'flower' } };

test("unavailable or denied evidence capabilities block requirements without downgrading to a timer", () => {
  assert.equal(getChallengeCapability(motion, caps).eligible, false);
  assert.equal(getChallengeCapability(photo, caps).eligible, false);
  assert.equal(getChallengeCapability(base, caps).eligible, true);
  const selected = selectCapableChallengeSet([motion, photo], caps, { premium: false });
  assert.equal(selected.some(item => item.id === motion.id || item.id === photo.id), false);
  assert.equal(selected.length, 3); assert.ok(selected.every(item => !item.premium));
});

test("only granted or askable undetermined permissions on proven hardware are eligible", () => {
  const cases = [
    { available: true, permission: "granted" as const, canAskAgain: false, want: true },
    { available: true, permission: "undetermined" as const, canAskAgain: true, want: true },
    { available: true, permission: "undetermined" as const, canAskAgain: false, want: false },
    { available: true, permission: "denied" as const, canAskAgain: true, want: false },
    { available: true, permission: "unknown" as const, canAskAgain: true, want: false },
    { available: false, permission: "granted" as const, canAskAgain: true, want: false }
  ];
  for (const value of cases) assert.equal(getChallengeCapability(motion, { ...caps, motion: value }).eligible, value.want);
});

test("live capability probe failures are fail-closed and no permission requests occur", async () => {
  const result = await readChallengeCapabilities({ motion: async () => granted, steps: async () => { throw new Error("sensor missing"); },
    location: async () => ({ available: true, permission: "denied", canAskAgain: false }), photo: async () => denied,
    connection: async () => ({ available: true, permission: "granted", canAskAgain: false }) });
  assert.equal(getChallengeCapability(motion, result).eligible, true); assert.equal(result.steps.available, false);
  assert.equal(result.location.permission, "denied"); assert.equal(result.photo.available, false);
});

test("capability-aware remote generation replaces blocked generated and local fallback options", async () => {
  configureChallengeGenerationProvider(async () => [motion, photo, { ...motion, id: "motion-b" }]);
  try {
    const profile = { streakDays: 0, premium: false, attemptsToday: 0, mood: "steady" as const, hour: 14 };
    for (const mode of ["remote", "local"] as const) {
      const selected = await generateAdaptiveChallengeSet(profile, { mode, capabilities: caps });
      assert.equal(selected.length, 3);
      assert.ok(selected.every(item => getChallengeCapability(item, caps).eligible));
    }
  } finally { configureChallengeGenerationProvider(null); }
});
