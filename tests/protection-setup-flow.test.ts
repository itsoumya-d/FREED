import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSetupAdvance, hasVpnSetupConflict, presentProtectionSetup, safariSetupAction } from "../src/lib/protection-setup-presenter";
import type { ProtectionPermissionStep } from "../src/lib/protection-permissions";

function step(id: string, status: ProtectionPermissionStep["status"], required = true): ProtectionPermissionStep {
  return { id, status, required, title: id, permissionLabel: id, platform: "ios", reason: "", dataBoundary: "", action: "request-authorization" };
}
const base = { busy: false, native: true, complete: false, ready: false, testPassed: false };
test("denied or unknown permission never advances to the next system prompt", () => {
  for (const status of ["needed", "unavailable"] as const) {
    assert.equal(decideSetupAdvance({ ...base, pending: { fromStepId: "ios-screen-time", returnedFromExternalStep: true }, steps: [step("ios-screen-time", status), step("ios-screen-time-targets", "needed")] }).action, "wait");
  }
});
test("verified permission completion opens the next required step without another Continue", () => {
  const next = step("ios-screen-time-targets", "needed");
  assert.deepEqual(decideSetupAdvance({ ...base, pending: { fromStepId: "ios-screen-time" }, steps: [step("ios-screen-time", "complete"), next] }), { action: "step", step: next });
});
test("returning from an optional settings page permits continuation without granting it", () => {
  const next = step("ios-screen-time-targets", "needed");
  const options = { ...base, pending: { fromStepId: "notification", waitingForAppReturn: true, continueAfterOptional: true }, steps: [step("notification", "optional", false), next] };
  assert.equal(decideSetupAdvance(options).action, "wait");
  assert.equal(decideSetupAdvance({ ...options, pending: { ...options.pending, returnedFromExternalStep: true } }).action, "step");
});
test("the last verified step starts one activation check; readiness never grants completion", () => {
  const options = { ...base, ready: true, pending: { fromStepId: "ios-safari-content-blocker" }, steps: [step("ios-safari-content-blocker", "complete")] };
  assert.equal(decideSetupAdvance(options).action, "test");
  assert.equal(decideSetupAdvance({ ...options, pending: { ...options.pending, testTriggered: true } }).action, "wait");
  assert.equal(decideSetupAdvance({ ...options, complete: true, testPassed: true }).action, "clear");
  assert.equal(decideSetupAdvance({ ...options, busy: true }).action, "wait");
});
test("Safari disabled and unknown states route to settings instead of repeatedly syncing", () => {
  for (const value of [false, undefined, null]) assert.equal(safariSetupAction(value), "settings");
  assert.equal(safariSetupAction(true), "sync");
});
test("iOS automatic configuration doesn't inflate the visible permission count", () => {
  const auth = presentProtectionSetup({ platform: "ios", step: step("ios-screen-time", "needed"), complete: false, ready: false, busy: null });
  const filter = presentProtectionSetup({ platform: "ios", step: step("ios-adult-web-filter", "needed"), complete: false, ready: false, busy: null });
  assert.equal(auth.stage, filter.stage);
  assert.equal(auth.total, 4);
  assert.equal(auth.action, "Allow Screen Time");
});

test('unsupported Screen Time never offers a system permission that cannot be granted', () => {
  const presentation = presentProtectionSetup({ platform: 'ios', step: step('ios-screen-time', 'unavailable'), complete: false, ready: false, busy: null });
  assert.equal(presentation.title, 'Check device support');
  assert.equal(presentation.action, 'Refresh setup');
  assert.match(presentation.instruction, /Help/);
});

test("initial VPN approval can replace a normal VPN; a known blocked connection opens settings", () => {
  assert.equal(hasVpnSetupConflict({ otherVpnActive: true, vpnConsentRequired: true }), false);
  assert.equal(hasVpnSetupConflict({ otherVpnActive: true, vpnConsentRequired: false }), true);
  assert.equal(hasVpnSetupConflict({ alwaysOnVpnPackage: "another.vpn" }), true);
  assert.equal(hasVpnSetupConflict({ alwaysOnVpnPackage: "app.freed.recovery" }), false);
  assert.equal(hasVpnSetupConflict({ otherVpnActive: true, adultFilterActive: true }), false);
});

test("VPN conflict recovery stays actionable instead of showing a startup spinner", () => {
  const presentation = presentProtectionSetup({ platform: "android", step: step("android-dns-guard", "needed"), complete: false, ready: false, busy: null, vpnConflict: true, dnsStarting: true });
  assert.equal(presentation.action, "Open VPN settings");
  assert.match(presentation.instruction, /disconnect the other VPN/);
});

test('configuration presentation never promises an actual browser or network pass', () => {
 const check=presentProtectionSetup({platform:'ios',step:null,complete:false,ready:true,busy:null});
 assert.equal(check.action,'Check configuration');
 assert.match(check.instruction,/does not.*verify real browser or network blocking/);
 const ready=presentProtectionSetup({platform:'android',step:null,complete:true,ready:true,busy:null});
 assert.match(ready.description,/local configuration checks/);
 assert.match(ready.instruction,/Check actual browsing/);
 assert.doesNotMatch(ready.description,/websites.*blocked/);
});
