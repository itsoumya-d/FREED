import assert from "node:assert/strict";
import { test } from "node:test";
import { createPaywallNavigationSession, resolvePaywallReturn } from "../src/lib/paywall-navigation";

const defaults = { protectionReady: false, limitedProtectionAcknowledged: false, accountStepDone: false };
test("first-run Free dismissal offers optional account linking before setup", () => {
  assert.equal(resolvePaywallReturn({ ...defaults, origin: "appSelection" }), "account");
  assert.equal(resolvePaywallReturn({ ...defaults, origin: "appSelection", accountStepDone: true }), "protectionSetup");
});
test("an in-app offer returns to the feature that opened it", () => {
  for (const origin of ["main", "library", "customChallenge"]) assert.equal(resolvePaywallReturn({ ...defaults, origin }), origin);
});
test("acknowledged limited setup is preserved when returning from membership", () => {
  assert.equal(resolvePaywallReturn({ ...defaults, origin: "splash", limitedProtectionAcknowledged: true }), "main");
  assert.equal(resolvePaywallReturn({ ...defaults, origin: null, protectionReady: true }), "main");
});

test("a delayed checkout cannot dismiss urgent recovery or a reminder", () => {
  for (const destination of ["intercept", "checkin", "protectionSetup"]) {
    const navigation = createPaywallNavigationSession<string>("main");
    navigation.update("paywall");
    const checkout = navigation.capture();
    assert.equal(checkout?.origin, "main");
    assert.equal(navigation.owns(checkout), true);
    navigation.update(destination);
    assert.equal(navigation.owns(checkout), false);
  }
});

test("reopening an offer cannot reuse the previous checkout's navigation ownership", () => {
  const navigation = createPaywallNavigationSession<string>("library");
  navigation.update("paywall");
  const oldCheckout = navigation.capture();
  navigation.update("main");
  navigation.update("paywall");
  assert.equal(navigation.owns(oldCheckout), false);
  assert.equal(navigation.capture()?.origin, "main");
  const current = navigation.capture();
  navigation.update("paywall");
  assert.equal(navigation.owns(current), true, "ordinary re-renders keep the session");
});

test('the immediate-recovery journey never requires account or protection on Free exit', () => {
  for (const origin of ['welcome','appSelection','splash',null]) assert.equal(resolvePaywallReturn({ ...defaults, origin, immediateRecovery: true }), 'main');
  assert.equal(resolvePaywallReturn({ ...defaults, origin: 'customChallenge', immediateRecovery: true }), 'customChallenge');
});
