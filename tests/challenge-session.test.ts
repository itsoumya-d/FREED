import assert from "node:assert/strict";
import test from "node:test";
import { createChallengeSessionController } from "../src/lib/challenge-session";
import type { RecoveryChallenge } from "../src/lib/recovery-engine";

const breathing: RecoveryChallenge = { id: "breathe", title: "Breathe slowly", category: "breathing", durationSec: 10,
  intensity: "calm", premium: false, icon: "Waves", steps: ["Inhale slowly.", "Exhale slowly."], why: "A brief pause.", verification: { version: 1, kind: 'timer' } };
function harness(ownerId = "guest:device-a") {
  let mono = 0;
  let wall = 1_800_000_000_000;
  let raw: string | null = null;
  let fail = false;
  let nextId = 0;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw new Error("disk full"); raw = value; },
    removeItem: () => { if (fail) throw new Error("disk full"); raw = null; } };
  const create = (owner = ownerId) => createChallengeSessionController({ ownerId: owner, storage,
    monotonicNow: () => mono, wallNow: () => wall, createId: () => `session-${++nextId}` });
  return { create, raw: () => raw, setRaw: (value: string) => { raw = value; }, fail: (value: boolean) => { fail = value; },
    advance: (ms: number) => { mono += ms; wall += ms; }, shiftMono: (ms: number) => { mono += ms; }, shiftWall: (ms: number) => { wall += ms; } };
}

test("foreground activity accrues once, paused background time never accrues", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  h.advance(1200); c.tick(); h.advance(800); c.pause();
  assert.equal(c.read().elapsedSec, 2); assert.equal(c.read().running, false);
  h.advance(60_000); c.tick(); assert.equal(c.read().elapsedSec, 2);
  c.resume(); h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 3);
  c.tick(); assert.equal(c.read().elapsedSec, 3);
});

test("kill and restart restore the last durable progress paused and never count offline time", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  h.advance(3000); c.tick(); h.advance(60_000);
  const restored = h.create(); restored.hydrate();
  assert.equal(restored.read().session?.id, "session-1"); assert.equal(restored.read().elapsedSec, 3);
  assert.equal(restored.read().running, false); restored.tick(); assert.equal(restored.read().elapsedSec, 3);
  restored.resume(); h.advance(1000); restored.tick(); assert.equal(restored.read().elapsedSec, 4);
});

test("wall clock changes, monotonic rollback and long unobserved gaps cannot award elapsed time", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  h.shiftWall(24 * 60 * 60_000); h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 1);
  h.shiftMono(-500); c.tick(); h.advance(500); c.tick(); assert.equal(c.read().elapsedSec, 1);
  h.shiftMono(60_000); c.tick(); assert.equal(c.read().elapsedSec, 1);
  h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 2);
});

test("completion requires actual elapsed and verification then survives restart as a duplicate guard", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  assert.equal(c.claimCompletion({ elapsedSec: 9999 }), false);
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  assert.equal(c.claimCompletion(), true); assert.equal(c.claimCompletion(), false);
  const restored = h.create(); restored.hydrate(); assert.equal(restored.claimCompletion(), false);
  assert.equal(restored.read().session?.phase, "completed"); assert.equal(restored.read().running, false);
});

test("session ownership, expiry and corrupt persisted records cannot restore progress or grants", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  const other = h.create("account:b"); other.hydrate(); assert.equal(other.read().session, null);
  h.shiftWall(8 * 24 * 60 * 60_000); const stale = h.create(); stale.hydrate(); assert.equal(stale.read().session, null);
  h.setRaw('{"version":1,"ownerId":"guest:device-a","earnedUnlockUntil":"2099-01-01","session":{"elapsedMs":9999}}');
  const corrupt = h.create(); corrupt.hydrate(); assert.equal(corrupt.read().session, null);
});

test("failed durable completion does not credit and stopped/disposed callbacks cannot advance a session", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  h.fail(true); assert.throws(() => c.claimCompletion(), /disk full/);
  assert.equal(c.read().session?.phase, "paused"); h.fail(false); assert.equal(c.claimCompletion(), true);
  c.start(breathing); c.dispose(); h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 0);
  assert.equal(c.resume(), false); assert.equal(c.claimCompletion({ elapsedSec: 1000 }), false);
});

test("connection handoff requires return followed by explicit confirmation, ignores caller boolean", () => {
  const h = harness(); const c = h.create(); c.hydrate();
  c.start({ ...breathing, id: "contact", category: "connection", verification: { version: 1, kind: 'connection' } });
  const token = c.beginConnectionAction(); assert.ok(token);
  assert.equal(c.confirmConnectionAction(token!), false);
  assert.equal(c.markConnectionReturned("stale-token"), false); assert.equal(c.markConnectionReturned(token!), true);
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  assert.equal(c.claimCompletion({ elapsedSec: 10, connectionActionComplete: true }), false);
  assert.equal(c.confirmConnectionAction(token!), true); assert.equal(c.claimCompletion(), true);
});

test("persist only bounded aggregate proof and never camera files, coordinates or external contact state", () => {
  const h = harness(); const c = h.create(); c.hydrate();
  c.start({ ...breathing, id: "motion", category: "physical", verification: { version: 1, kind: 'motion', minMotionSamples: 6 } });
  c.recordEvidence({ elapsedSec: 9999, motionSamples: 6, steps: Number.POSITIVE_INFINITY, distanceMeters: Number.NaN,
    photoMatched: true, photoLabels: ["private-photo-label"], connectionActionComplete: true, photoUri: "file://private.jpg", latitude: 50 } as never);
  const raw = h.raw()!;
  assert.ok(!raw.includes("private")); assert.ok(!raw.includes("latitude")); assert.ok(!raw.includes("photo"));
  assert.equal(c.read().evidence.motionSamples, 6); assert.equal(c.read().evidence.steps, 0); assert.equal(c.read().elapsedSec, 0);
  c.pause(); c.recordEvidence({ elapsedSec: 0, motionSamples: 999 }); assert.equal(c.read().evidence.motionSamples, 6);
});

test("photo proof must be reacquired after process restart", () => {
  const h = harness(); const c = h.create(); c.hydrate();
  c.start({ ...breathing, id: "flower", category: "reset", verification: { version: 1, kind: "photo", targetId: "flower" }, title: "Take a photo of a flower", steps: ["Find a flower.", "Take a fresh camera photo."] });
  c.recordEvidence({ elapsedSec: 0, photoMatched: true, photoLabels: ["flower"], photoConfidence: 0.8 });
  const restored = h.create(); restored.hydrate(); restored.resume();
  for (let i = 0; i < 10; i++) { h.advance(1000); restored.tick(); }
  assert.equal(restored.claimCompletion(), false);
  restored.recordEvidence({ elapsedSec: 0, photoMatched: true, photoLabels: ["flower"], photoConfidence: 0.8 });
  assert.equal(restored.claimCompletion(), true);
});

test("durable completion receipt preserves the selected outcome for crash reconciliation", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  assert.equal(c.claimCompletion({}, "still-urging", "session-1"), true);
  const restored = h.create(); restored.hydrate();
  assert.equal(restored.read().session?.completion?.outcome, "still-urging");
  assert.equal(restored.read().session?.completion?.completedAtMs, 1_800_000_010_000);
});

test("callbacks from a previous challenge cannot attach evidence or completion to the next session", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing); const previous = c.read().session!.id;
  c.start({ ...breathing, id: "physical", category: "physical" });
  c.recordEvidence({ motionSamples: 999 }, previous);
  assert.equal(c.read().evidence.motionSamples, 0);
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  assert.equal(c.claimCompletion({ motionSamples: 999 }, "helped", previous), false);
});

test("inactive then background lifecycle events preserve auto-resume without counting background time", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing);
  assert.equal(typeof c.setForeground, "function");
  h.advance(1000); c.setForeground(false); c.setForeground(false); h.advance(60_000);
  assert.equal(c.read().elapsedSec, 1); c.setForeground(true);
  assert.equal(c.read().running, true); h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 2);
  c.setForeground(false); c.pause(); c.setForeground(true); assert.equal(c.read().running, false);
});

test("failed abandon preserves the resumable record and stops counting", () => {
  const h = harness(); const c = h.create(); c.hydrate(); c.start(breathing); h.advance(1000); c.tick();
  h.fail(true); assert.throws(() => c.abandon(), /disk full/); assert.equal(c.read().running, false);
  h.fail(false); h.advance(1000); c.tick(); assert.equal(c.read().elapsedSec, 1);
  assert.equal(c.read().session?.id, "session-1");
});

test("out-of-range photo confidence cannot be normalized into accepted photo proof", () => {
  const h = harness(); const c = h.create(); c.hydrate();
  c.start({ ...breathing, id: "flower", category: "reset", verification: { version: 1, kind: "photo", targetId: "flower" }, title: "Take a photo of a flower", steps: ["Find a flower.", "Take a fresh camera photo."] });
  for (let i = 0; i < 10; i++) { h.advance(1000); c.tick(); }
  assert.equal(c.claimCompletion({ photoMatched: true, photoLabels: ["flower"], photoConfidence: 1.5 }), false);
});
