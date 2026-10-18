import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateInterceptionReleaseGate as evaluate } from '../src/lib/interception-release-gate';
import { INTERCEPTION_CAPABILITY_REGISTRY } from '../src/lib/interception-capabilities';

const nowMs = Date.parse('2026-10-12T04:00:00Z');
const evaluateInterceptionReleaseGate = (value: unknown) => evaluate(value, nowMs);
const binding = { platform: 'ios', sourceSnapshot: 'a'.repeat(64), binarySha256: 'b'.repeat(64), deviceId: 'physical-iphone-16', osVersion: '26.6.2' };
const scenarios = ['existing-browser', 'newly-installed-browser', 'private-browsing', 'encrypted-dns-bypass', 'network-change'];
function request(platform = 'ios', capabilityId = 'ios-dns-settings') {
  const candidate = { ...binding, platform };
  const browserIds = ['com.apple.mobilesafari', 'org.mozilla.ios.Firefox'];
  return {
    audience: 'public', contractVersion: 2, capabilityId, candidate, nowMs, browserIds,
    newlyInstalledBrowserIds: ['org.mozilla.ios.Firefox'],
    browserInventory: { kind: 'physical-device', binding: { ...candidate }, capturedAtMs: nowMs - 1_000,
      artifact: { path: '.superpowers/sdd/2026-10-08-interception-commercial-loop/test-inventory-fixture.json', sha256: 'f'.repeat(64) } } as unknown,
    evidence: browserIds.flatMap((browserId) => scenarios.filter((scenario) => scenario !== 'newly-installed-browser' || browserId === 'org.mozilla.ios.Firefox').flatMap((scenario) => ['wifi', 'cellular'].flatMap((network) => ['free', 'premium', 'unknown'].map((membership) => ({
      schemaVersion: 2, registryVersion: 2, contractVersion: 2, capabilityId, binding: { ...candidate }, scenario,
      browserId, network, membership, kind: 'physical-device', outcome: 'passed', capturedAtMs: nowMs - 1_000,
      adultContentBlocked: true, ordinaryBrowsingAllowed: true, attemptDetected: true, openedFreed: true, entryMethod: 'automatic', beforeContentDisplayed: true,
      handoff: { action: 'none', productActionCount: 0, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true },
      artifact: { path: '.superpowers/sdd/2026-10-08-interception-commercial-loop/test-fixture.json', sha256: 'c'.repeat(64) }
    })))))
  };
}
function codes(value: unknown) { return evaluateInterceptionReleaseGate(value).reasons.map((reason) => reason.code); }

// Allowing claimed JSON outcomes to replace registered public APIs is the bug these tests catch.
test('claimed all-passed device JSON cannot promote iOS DNS or Android VPN notification paths to universal release', () => {
  for (const [platform, capabilityId] of [['ios', 'ios-dns-settings'], ['android', 'android-vpn-dns']]) {
    const value = request(platform, capabilityId);
    assert.equal(evaluateInterceptionReleaseGate(value).publicReleaseAllowed, false);
    assert.ok(codes(value).includes('universal-blocking-api-unavailable'));
    assert.ok(codes(value).includes('universal-recovery-handoff-api-unavailable'));
  }
});

test('URL filtering without an app execution callback cannot satisfy automatic handoff', () => {
  const value = request('ios', 'ios-url-filter');
  assert.ok(codes(value).includes('universal-recovery-handoff-api-unavailable'));
  assert.ok(codes(value).includes('candidate-api-path-ineligible'));
});

test('Safari recovery pages and native selected-group paths do not cover every browser', () => {
  for (const capabilityId of ['ios-safari-dnr', 'ios-native-groups']) {
    const value = request('ios', capabilityId);
    assert.equal(evaluateInterceptionReleaseGate(value).publicReleaseAllowed, false);
    assert.ok(codes(value).includes('candidate-api-path-ineligible'));
  }
});

test('a detected and blocked attempt is insufficient when FREED never opened', () => {
  const value = request(); value.evidence[0].openedFreed = false;
  assert.ok(codes(value).includes('freed-not-opened'));
});

test('demonstrated one-action native and extension recovery is accepted without promoting narrow APIs', () => {
  for (const entryMethod of ['notification-tap', 'shield-primary-tap', 'extension-open-freed-action']) {
    const value = request();
    value.evidence[0].entryMethod = entryMethod;
    value.evidence[0].handoff = { action: 'open-freed', productActionCount: 1, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true };
    assert.ok(!codes(value).includes('handoff-method-not-accepted'));
    assert.ok(!codes(value).includes('handoff-action-proof-invalid'));
    assert.ok(!codes(value).includes('evidence-version-mismatch'));
    assert.equal(evaluateInterceptionReleaseGate(value).publicReleaseAllowed, false);
    assert.ok(codes(value).includes('candidate-api-path-ineligible'));
  }
});

test('OS confirmation is distinct from the one product action and is not claimed as automatic', () => {
  const value = request(); value.evidence[0].entryMethod = 'extension-open-freed-action';
  Object.assign(value.evidence[0].handoff, { action: 'open-freed', productActionCount: 1, osConfirmationCount: 1 });
  assert.ok(!codes(value).includes('handoff-action-proof-invalid'));
  value.evidence[0].entryMethod = 'automatic';
  assert.ok(codes(value).includes('handoff-action-proof-invalid'));
});

test('manual opens, rendered pages, attempted launches and unrelated navigation are not accepted recovery entry', () => {
  for (const entryMethod of ['manual', 'browser-recovery-page', 'browser-page', 'attempted-background-launch', 'unrelated-navigation', '']) {
    const value = request(); value.evidence[0].entryMethod = entryMethod;
    assert.ok(codes(value).includes('handoff-method-not-accepted'));
  }
});

test('one-action claims require the actual Open FREED CTA and foreground recovery identity', () => {
  for (const patch of [
    { action: 'none' }, { productActionCount: 0 }, { productActionCount: 2 },
    { osConfirmationCount: -1 }, { osConfirmationCount: 2 },
    { foregroundAppId: 'com.apple.mobilesafari' }, { recoveryEntered: false }
  ]) {
    const value = request(); value.evidence[0].entryMethod = 'notification-tap';
    Object.assign(value.evidence[0].handoff, { action: 'open-freed', productActionCount: 1, osConfirmationCount: 0 }, patch);
    assert.ok(codes(value).includes('handoff-action-proof-invalid'));
  }
  const value = request(); delete (value.evidence[0] as any).handoff;
  assert.ok(codes(value).includes('handoff-action-proof-invalid'));
});

test('content must be blocked and recovery opened before content is displayed', () => {
  const value = request(); value.evidence[0].adultContentBlocked = false;
  assert.ok(codes(value).includes('adult-content-not-blocked'));
  value.evidence[0].adultContentBlocked = true; value.evidence[0].beforeContentDisplayed = false;
  assert.ok(codes(value).includes('content-order-unproven'));
  value.evidence[0].beforeContentDisplayed = true; value.evidence[0].attemptDetected = false;
  assert.ok(codes(value).includes('attempt-not-detected'));
});

test('missing newly installed, other browser, network or membership scenarios fail the proof matrix', () => {
  const newlyInstalled = request(); newlyInstalled.evidence = newlyInstalled.evidence.filter((row) => row.scenario !== 'newly-installed-browser');
  assert.ok(codes(newlyInstalled).includes('scenario-evidence-missing'));
  const otherBrowser = request(); otherBrowser.browserIds.push('com.microsoft.msedge');
  assert.ok(codes(otherBrowser).includes('scenario-evidence-missing'));
  const cellular = request(); cellular.evidence = cellular.evidence.filter((row) => row.network !== 'cellular');
  assert.ok(codes(cellular).includes('scenario-evidence-missing'));
  const membership = request(); membership.evidence = membership.evidence.filter((row) => row.membership !== 'unknown');
  assert.ok(codes(membership).includes('scenario-evidence-missing'));
});

test('proof is bound to this exact source, binary, platform, device and OS', () => {
  for (const patch of [{ sourceSnapshot: 'd'.repeat(64) }, { binarySha256: 'e'.repeat(64) }, { platform: 'android' }, { deviceId: 'another-phone' }, { osVersion: '26.5' }]) {
    const value = request(); Object.assign(value.evidence[0].binding, patch);
    assert.ok(codes(value).includes('evidence-binding-mismatch'));
  }
  const value = request(); value.candidate.sourceSnapshot = '';
  assert.ok(codes(value).includes('candidate-binding-invalid'));
});

test('missing artifacts and source tests cannot be counted as physical phone evidence', () => {
  const value = request(); value.evidence[0].artifact = { path: '', sha256: '' };
  assert.ok(codes(value).includes('evidence-artifact-unbound'));
  const source = request(); source.evidence[0].kind = 'source-test';
  assert.ok(codes(source).includes('physical-device-evidence-required'));
  const missing = request(); missing.evidence = [];
  assert.ok(codes(missing).includes('scenario-evidence-missing'));
});

test('stale, future and invalid capture times cannot satisfy fresh evidence requirements', () => {
  for (const capturedAtMs of [nowMs - 7 * 86_400_000 - 1, nowMs + 1, NaN]) {
    const value = request(); value.evidence[0].capturedAtMs = capturedAtMs;
    assert.ok(codes(value).includes('evidence-time-invalid'));
  }
});

test('the evidence payload cannot rewind the verifier clock to make old observations fresh', () => {
  const value = request(); value.nowMs = nowMs - 10 * 86_400_000;
  for (const row of value.evidence) row.capturedAtMs = value.nowMs;
  assert.ok(codes(value).includes('evidence-time-invalid'));
});

test('an installed browser list without a bound physical inventory or newly installed browser cannot satisfy coverage', () => {
  const value = request(); value.browserInventory = undefined; value.newlyInstalledBrowserIds = [];
  assert.ok(codes(value).includes('browser-inventory-unbound'));
  assert.ok(codes(value).includes('new-browser-inventory-missing'));
});

test('failed, unavailable, unexecuted and older-registry observations remain non-passing evidence', () => {
  for (const outcome of ['failed', 'unavailable', 'unexecuted']) {
    const value = request(); value.evidence[0].outcome = outcome;
    assert.ok(codes(value).includes('evidence-outcome-not-passed'));
  }
  const value = request(); value.evidence[0].registryVersion = 0;
  assert.ok(codes(value).includes('evidence-version-mismatch'));
});

test('internal testing is distinct from public eligibility and cannot upgrade the release promise', () => {
  const value = request(); value.audience = 'internal-testing';
  const result = evaluateInterceptionReleaseGate(value);
  assert.equal(result.internalTestingAllowed, true);
  assert.equal(result.publicReleaseAllowed, false);
  assert.ok(result.reasons.some((reason) => reason.code === 'universal-recovery-handoff-api-unavailable'));
});

test('environment booleans, fabricated registry overrides and malformed requests cannot override the gate', () => {
  const prior = process.env.FREED_UNIVERSAL_INTERCEPTION_APPROVED;
  try {
    process.env.FREED_UNIVERSAL_INTERCEPTION_APPROVED = 'true';
    const value = { ...request(), approved: true, passed: true, universal: true, registry: { version: 99, allBrowsers: true } };
    assert.equal(evaluateInterceptionReleaseGate(value).publicReleaseAllowed, false);
    assert.ok(codes(value).includes('universal-recovery-handoff-api-unavailable'));
    for (const invalid of [null, true, { audience: 'public', candidate: { platform: 'web' } }]) {
      assert.equal(evaluateInterceptionReleaseGate(invalid).publicReleaseAllowed, false);
      assert.ok(codes(invalid).includes('request-invalid'));
    }
  } finally {
    if (prior === undefined) delete process.env.FREED_UNIVERSAL_INTERCEPTION_APPROVED;
    else process.env.FREED_UNIVERSAL_INTERCEPTION_APPROVED = prior;
  }
});

test('a caller cannot mutate registry capabilities into an approved universal automatic path', () => {
  const path = INTERCEPTION_CAPABILITY_REGISTRY.paths.find((value) => value.id === 'ios-dns-settings')!;
  assert.throws(() => { (path as any).coverage = 'all-existing-and-new-browsers'; }, TypeError);
  assert.throws(() => { (path.handoff as any).method = 'automatic-app-entry'; }, TypeError);
  assert.throws(() => { (path.blocking as any).api = 'supported'; }, TypeError);
  assert.equal(evaluateInterceptionReleaseGate(request()).publicReleaseAllowed, false);
  assert.ok(codes(request()).includes('universal-recovery-handoff-api-unavailable'));
});

test('historical automatic-only rows cannot be silently promoted to the revised contract', () => {
  for (const patch of [{ schemaVersion: 1 }, { registryVersion: 1 }, { contractVersion: 1 }]) {
    const value = request(); Object.assign(value.evidence[0], patch);
    assert.ok(codes(value).includes('evidence-version-mismatch'));
  }
  const value = request(); value.contractVersion = 1;
  assert.ok(codes(value).includes('request-contract-version-mismatch'));
  assert.equal(evaluateInterceptionReleaseGate(value).contractVersion, 2);
});

test('a blocked-category pass cannot replace ordinary browsing proof', () => {
  const value = request(); value.evidence[0].ordinaryBrowsingAllowed = false;
  assert.ok(codes(value).includes('ordinary-browsing-not-proved'));
});

test('evidence cannot relabel a registered native handoff mechanism', () => {
  const value = request('ios', 'ios-native-groups');
  value.evidence[0].entryMethod = 'notification-tap';
  Object.assign(value.evidence[0].handoff, { action: 'open-freed', productActionCount: 1 });
  assert.ok(codes(value).includes('evidence-handoff-path-mismatch'));
});

test('matched native tap evidence covers its matrix without establishing universal API or store eligibility', () => {
  for (const [platform, capabilityId, entryMethod] of [['ios', 'ios-native-groups', 'shield-primary-tap'], ['android', 'android-vpn-dns', 'notification-tap']]) {
    const value = request(platform, capabilityId);
    for (const row of value.evidence) { row.entryMethod = entryMethod; Object.assign(row.handoff, { action: 'open-freed', productActionCount: 1 }); }
    assert.ok(!codes(value).includes('handoff-method-not-accepted'));
    assert.ok(!codes(value).includes('handoff-action-proof-invalid'));
    assert.ok(!codes(value).includes('evidence-handoff-path-mismatch'));
    assert.ok(!codes(value).includes('scenario-evidence-missing'));
    assert.equal(evaluateInterceptionReleaseGate(value).publicReleaseAllowed, false);
    assert.ok(codes(value).includes('candidate-api-path-ineligible'));
  }
});
