import assert from "node:assert/strict";
import { test } from "node:test";
import { createSocialLoginPressGate, presentSocialLogin } from "../src/lib/social-login-presenter";
import { createAuthIdentityCoordinator } from "../src/lib/social-auth-flow";

test("iOS offers available provider controls and disables both during either sign-in", () => {
  const available = { platform: "ios", googleAvailable: true, appleAvailable: true };
  const idle = presentSocialLogin({ ...available, busyProvider: null });
  assert.equal(idle.google.visible, true);
  assert.equal(idle.apple.visible, true);
  assert.equal(idle.google.disabled, false);
  assert.equal(idle.apple.disabled, false);
  for (const busyProvider of ["google", "apple"] as const) {
    const busy = presentSocialLogin({ ...available, busyProvider });
    assert.equal(busy.google.disabled, true);
    assert.equal(busy.apple.disabled, true);
    assert.equal(busy[busyProvider].busy, true);
    assert.match(busy.busyAnnouncement ?? "", busyProvider === "google" ? /Google/ : /Apple/);
  }
});

test("Android offers its available Firebase Apple OAuth control", () => {
  const presentation = presentSocialLogin({ platform: "android", googleAvailable: true, appleAvailable: true, busyProvider: null });
  assert.equal(presentation.google.visible, true);
  assert.equal(presentation.apple.visible, true);
  assert.equal(presentation.apple.disabled, false);
});

test("unsupported platforms offer no native actions or fake connection status", () => {
  for (const platform of ["web", "unknown"]) {
    const presentation = presentSocialLogin({ platform, googleAvailable: true, appleAvailable: true, busyProvider: "google" });
    assert.equal(presentation.google.visible, false);
    assert.equal(presentation.apple.visible, false);
    assert.equal(presentation.busyAnnouncement, null);
    assert.match(presentation.unavailableMessage ?? "", /iOS|Android/);
  }
});

test("unavailable native Google remains visible with a recoverable explanation and no actionable button", () => {
  const presentation = presentSocialLogin({ platform: "ios", googleAvailable: false, appleAvailable: false, busyProvider: null });
  assert.equal(presentation.google.visible, true);
  assert.equal(presentation.google.disabled, true);
  assert.equal(presentation.apple.visible, false);
  assert.match(presentation.unavailableMessage ?? "", /unavailable/);
});

test("rapid duplicate and cross-provider taps produce only one coordinated credential operation", async () => {
  let user = { uid: "guest-fixture", isAnonymous: true };
  const operations: string[] = [];
  let finishLink!: () => void;
  const heldLink = new Promise<void>(resolve => { finishLink = resolve; });
  let markLinkStarted!: () => void;
  const linkStarted = new Promise<void>(resolve => { markLinkStarted = resolve; });
  const coordinator = createAuthIdentityCoordinator({
    currentUser: () => user,
    signInAnonymously: async () => { throw new Error("Opening sign-in must not create another guest."); },
    signInWithCredential: async (credential: string) => {
      operations.push(`sign-in:${credential}`);
      user = { ...user, isAnonymous: false };
      return { user };
    },
    linkWithCredential: async (_user, credential: string) => {
      operations.push(`link:${credential}`);
      markLinkStarted();
      await heldLink;
      user = { ...user, isAnonymous: false };
      return { user };
    }
  });
  const gate = createSocialLoginPressGate();
  let pending: ReturnType<typeof coordinator.signInWithCredential> | undefined;
  const start = () => { pending = coordinator.signInWithCredential("google-credential"); };
  assert.equal(gate.tryStart("google", { available: true, busyProvider: null }, start), true);
  assert.equal(gate.tryStart("google", { available: true, busyProvider: null }, start), false);
  assert.equal(gate.tryStart("apple", { available: true, busyProvider: null }, () => { pending = coordinator.signInWithCredential("apple-credential"); }), false);
  await linkStarted;
  assert.deepEqual(operations, ["link:google-credential"]);
  finishLink();
  assert.equal((await pending)?.ok, true);
  gate.release();
  assert.equal(gate.tryStart("apple", { available: true, busyProvider: null }, () => { pending = coordinator.linkCurrentCredential("apple-credential"); }), true);
  assert.equal((await pending)?.ok, true);
  assert.deepEqual(operations, ["link:google-credential", "link:apple-credential"]);
});

test("availability and controlled busy state prevent activation before callbacks run", () => {
  const gate = createSocialLoginPressGate();
  let requests = 0;
  assert.equal(gate.tryStart("google", { available: false, busyProvider: null }, () => requests += 1), false);
  assert.equal(gate.tryStart("apple", { available: true, busyProvider: "google" }, () => requests += 1), false);
  assert.equal(requests, 0);
});

test("cancel completion and synchronous startup errors release the next sign-in attempt", () => {
  const gate = createSocialLoginPressGate();
  const state = { available: true, busyProvider: null };
  assert.equal(gate.tryStart("google", state, () => undefined), true);
  gate.release(); // The parent clears busyProvider after a cancelled native sheet.
  assert.throws(() => gate.tryStart("apple", state, () => { throw new Error("Startup failed"); }), /Startup failed/);
  assert.equal(gate.tryStart("google", state, () => undefined), true);
});

test("missing native Google config remains visible even when Apple is available", () => {
  for (const platform of ["ios", "android"]) {
    const presentation = presentSocialLogin({ platform, googleAvailable: false, appleAvailable: true, busyProvider: null });
    assert.equal(presentation.google.visible, true);
    assert.equal(presentation.google.disabled, true);
    assert.equal(presentation.apple.disabled, false);
    assert.match(presentation.unavailableMessage ?? "", /Google.*unavailable/);
  }
});
