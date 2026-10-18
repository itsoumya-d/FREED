import assert from "node:assert/strict";
import { test } from "node:test";
import { createNativeInterventionAttempt, type NativePendingInterventionPayload } from "../src/lib/native-intervention";
import { consumePendingInterventionOnce, createPendingInterventionTracker } from "../src/lib/protection-capabilities";

const now = Date.parse("2026-10-03T10:00:00.000Z");
const event: NativePendingInterventionPayload = {
  interventionId: "10101010-1010-4010-8010-101010101010", url: "https://youtube-shorts.app.freed.local",
  host: "youtube-shorts.app.freed.local", sourcePackage: "com.google.android.youtube",
  reason: "Configured surface", matchedRule: "focus-shield:focus-rule-a7f9", detectedAt: new Date(now).toISOString(),
  scope: { kind: "android-surface", ruleId: "focus-rule-a7f9", packageName: "com.google.android.youtube" }
};

test("a surface event cannot widen its authority to a package, iOS token, or browser domain", () => {
  assert.deepEqual(createNativeInterventionAttempt(event).scope, event.scope);
  for (const scope of [
    { kind: "android-package", packageName: "com.google.android.youtube" },
    { kind: "android-package", packageName: "com.instagram.android" },
    { kind: "ios-token", tokenType: "application", token: "opaque-token" },
    { kind: "browser-domain", domain: "example.com" },
    { kind: "android-surface", ruleId: "different-rule", packageName: "com.google.android.youtube" }
  ] as const) {
    assert.equal(createNativeInterventionAttempt({ ...event, scope }).scope, undefined);
  }
});

test("native package and browser scopes must match the specific event", () => {
  const packageEvent = { ...event, matchedRule: "configured-app:com.google.android.youtube" };
  assert.equal(createNativeInterventionAttempt({ ...packageEvent, scope: { kind: "android-package", packageName: event.sourcePackage } }).scope?.kind, "android-package");
  assert.equal(createNativeInterventionAttempt({ ...packageEvent, scope: { kind: "android-package", packageName: "com.instagram.android" } }).scope, undefined);
  const browserEvent = { ...event, host: "example.com", url: "https://example.com", sourcePackage: "", matchedRule: "adult-domain-feed:example.com" };
  assert.equal(createNativeInterventionAttempt({ ...browserEvent, scope: { kind: "browser-domain", domain: "example.com" } }).scope?.kind, "browser-domain");
  assert.equal(createNativeInterventionAttempt({ ...browserEvent, scope: { kind: "browser-domain", domain: "other.com" } }).scope, undefined);
});

test("native event is claimed exactly once and stale payloads cannot open a challenge", async () => {
  const tracker = createPendingInterventionTracker();
  let claims = 0;
  const consume = (pending: NativePendingInterventionPayload, nowMs = now) => consumePendingInterventionOnce({ tracker, nowMs, getPending: async () => pending, clearPending: async () => { claims++; return true; } });
  assert.ok(await consume(event));
  assert.equal(await consume(event), null);
  assert.equal(claims, 1);
  assert.equal(await consume({ ...event, interventionId: "20202020-2020-4020-8020-202020202020", detectedAt: new Date(now - 600_001).toISOString() }), null);
});

test("consumption rejects a surface handoff with missing or mismatched scoped authority", async () => {
  for (const scope of [undefined, { kind: "android-package" as const, packageName: event.sourcePackage }]) {
    const attempt = await consumePendingInterventionOnce({ tracker: createPendingInterventionTracker(), nowMs: now,
      getPending: async () => ({ ...event, scope }), clearPending: async () => true });
    assert.equal(attempt, null, "An invalid surface event must not fall back to a package unlock.");
  }
});

test("encoded app rules reject missing, unsupported, or different actual source packages", async () => {
  for (const [matchedRule, sourcePackage] of [
    ['configured-app:com.google.android.youtube', 'com.instagram.android'],
    ['short-form:youtube-shorts', 'com.instagram.android'],
    ['configured-app:com.google.android.youtube', ''],
    ['short-form:youtube-shorts', ''],
    ['short-form:youtube-shorts', 'com.googl@e.android.youtube'],
    ['configured-app:com.unsupported.app', 'com.google.android.youtube'],
    ['configured-app:com.googl@e.android.youtube', 'com.google.android.youtube'],
    ['short-form:youtube-shor@ts', 'com.google.android.youtube']
  ]) {
    const pending = { ...event, matchedRule, sourcePackage, scope: undefined };
    assert.equal(createNativeInterventionAttempt(pending).sourcePackage, undefined);
    assert.equal(createNativeInterventionAttempt(pending).nativeInterventionId, undefined);
    assert.equal(await consumePendingInterventionOnce({ tracker: createPendingInterventionTracker(), nowMs: now, getPending: async () => pending, clearPending: async () => true }), null);
  }
  const alias = { ...event, matchedRule: 'short-form:tiktok-feed', sourcePackage: 'com.ss.android.ugc.trill', scope: { kind: 'android-package' as const, packageName: 'com.ss.android.ugc.trill' } };
  const accepted = await consumePendingInterventionOnce({ tracker: createPendingInterventionTracker(), nowMs: now, getPending: async () => alias, clearPending: async () => true });
  assert.equal(accepted?.sourcePackage, alias.sourcePackage);
});
