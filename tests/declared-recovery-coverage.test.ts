import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateDeclaredRecoveryCoverage,
  type DeclaredRecoveryCapabilityRegistry
} from '../src/lib/declared-recovery-coverage';
import { evaluateInterceptionReleaseGate } from '../src/lib/interception-release-gate';

const nowMs = Date.parse('2026-10-13T08:00:00Z');
const artifact = (name: string) => ({ path: `.superpowers/sdd/task-67/${name}.json`, sha256: 'f'.repeat(64) });
const candidates = {
  ios: { platform: 'ios', sourceSnapshot: 'a'.repeat(64), binarySha256: 'b'.repeat(64), deviceId: 'iphone-physical', osVersion: '26.6.2' },
  android: { platform: 'android', sourceSnapshot: 'c'.repeat(64), binarySha256: 'd'.repeat(64), deviceId: 'pixel-physical', osVersion: '16' }
} as const;

const trustedFixtureRegistry: DeclaredRecoveryCapabilityRegistry = {
  version: 3,
  contractVersion: 3,
  maxEvidenceAgeMs: 7 * 86_400_000,
  capabilities: [
    { id: 'ios-safari-dnr', platform: 'ios', target: 'browser-recovery', browserId: 'safari', publicApi: 'supported', storeEligibility: 'eligible', implementation: 'reviewed-implemented', requiredPermissions: ['safari-extension-enabled'], acceptedEntryMethods: ['automatic', 'open-challenge'] },
    { id: 'android-vpn-dns', platform: 'android', target: 'browser-recovery', browserId: 'chrome', publicApi: 'supported', storeEligibility: 'eligible', implementation: 'reviewed-implemented', requiredPermissions: ['vpn-consent', 'notifications-enabled'], acceptedEntryMethods: ['automatic', 'open-challenge'] },
    { id: 'ios-native-groups', platform: 'ios', target: 'app-limit', publicApi: 'supported', storeEligibility: 'eligible', implementation: 'reviewed-implemented', requiredPermissions: ['family-controls', 'app-selection'], acceptedEntryMethods: ['automatic', 'open-challenge'] },
    { id: 'android-native-groups', platform: 'android', target: 'app-limit', publicApi: 'supported', storeEligibility: 'eligible', implementation: 'reviewed-implemented', requiredPermissions: ['accessibility', 'usage-access'], acceptedEntryMethods: ['automatic', 'open-challenge'] }
  ]
};

const appScenarios = [
  'threshold-interruption', 'grant-300', 'grant-600', 'grant-1200',
  'native-relock-300', 'native-relock-600', 'native-relock-1200',
  'daily-cap', 'exact-retry', 'replay-rejected', 'overlap-scope', 'clock-restart'
] as const;

function completeRequest() {
  const claims = [
    { id: 'ios-safari', target: 'browser-recovery', platform: 'ios', browserId: 'safari', capabilityId: 'ios-safari-dnr', status: 'verified-recovery', osVersion: candidates.ios.osVersion, permissions: ['safari-extension-enabled'], networks: ['wifi', 'cellular'] },
    { id: 'android-chrome', target: 'browser-recovery', platform: 'android', browserId: 'chrome', capabilityId: 'android-vpn-dns', status: 'verified-recovery', osVersion: candidates.android.osVersion, permissions: ['notifications-enabled', 'vpn-consent'], networks: ['wifi', 'cellular'] },
    { id: 'ios-apps', target: 'app-limit', platform: 'ios', capabilityId: 'ios-native-groups', status: 'verified-app-journey', osVersion: candidates.ios.osVersion, permissions: ['app-selection', 'family-controls'], networks: ['offline'] },
    { id: 'android-apps', target: 'app-limit', platform: 'android', capabilityId: 'android-native-groups', status: 'verified-app-journey', osVersion: candidates.android.osVersion, permissions: ['accessibility', 'usage-access'], networks: ['offline'] },
    { id: 'ios-firefox', target: 'browser-recovery', platform: 'ios', browserId: 'firefox', capabilityId: 'none', status: 'unsupported', osVersion: candidates.ios.osVersion, permissions: [], networks: ['wifi'] }
  ];
  const browserEvidence = claims.filter((claim) => claim.status === 'verified-recovery').flatMap((claim) => claim.networks.map((network) => ({
    schemaVersion: 3, registryVersion: 3, contractVersion: 3, claimId: claim.id, capabilityId: claim.capabilityId,
    binding: { ...candidates[claim.platform as 'ios' | 'android'] }, kind: 'physical-device', outcome: 'passed', capturedAtMs: nowMs - 1_000,
    artifact: artifact(`${claim.id}-${network}`), scenario: 'browser-recovery', browserId: claim.browserId, network,
    permissions: [...claim.permissions], adultContentBlocked: true, ordinaryBrowsingAllowed: true, attemptDetected: true,
    openedFreed: true, beforeContentDisplayed: true, entryMethod: 'open-challenge',
    handoff: { action: 'open-challenge', productActionCount: 1, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true }
  })));
  const appEvidence = claims.filter((claim) => claim.status === 'verified-app-journey').flatMap((claim) => appScenarios.map((scenario) => ({
    schemaVersion: 3, registryVersion: 3, contractVersion: 3, claimId: claim.id, capabilityId: claim.capabilityId,
    binding: { ...candidates[claim.platform as 'ios' | 'android'] }, kind: 'physical-device', outcome: 'passed', capturedAtMs: nowMs - 1_000,
    artifact: artifact(`${claim.id}-${scenario}`), scenario, network: 'offline', permissions: [...claim.permissions],
    thresholdReached: true, nativeBarrierShown: true, recoveryEntered: true,
    entryMethod: 'open-challenge',
    handoff: { action: 'open-challenge', productActionCount: 1, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true },
    grantSeconds: scenario.endsWith('-300') ? 300 : scenario.endsWith('-600') ? 600 : scenario.endsWith('-1200') ? 1200 : undefined,
    challengeCompleted: true, completionSavedOnce: true, explicitBreakStarted: true, originatingAppOnly: true,
    adultWebRemainedBlocked: true, nativeDeadlineRecorded: true, freedClosedBeforeExpiry: true, nativeExpiryObserved: true,
    originatingAppRelocked: true, dailyCapSeconds: 1200, capEnforced: true, sameDeadlineReturned: true, spentOnce: true,
    replayRejected: true, noAuthorityRestored: true, otherRestrictionsPreserved: true, clockChangeDidNotExtend: true,
    deviceRestartDidNotExtend: true, relockWithoutFreedOpen: true
  })));
  return { audience: 'public', contractVersion: 3, candidates: { ios: { ...candidates.ios }, android: { ...candidates.android } }, claims, evidence: [...browserEvidence, ...appEvidence] };
}

const codes = (value: unknown, registry = trustedFixtureRegistry) => validateDeclaredRecoveryCoverage(value, registry, nowMs).reasons.map((reason) => reason.code);

test('the pure v3 evidence validator accepts exact minimum declared coverage with complete app journeys', () => {
  const result = validateDeclaredRecoveryCoverage(completeRequest(), trustedFixtureRegistry, nowMs);
  assert.equal(result.publicReleaseAllowed, true);
  assert.deepEqual(result.reasons, []);
});

test('the public gate uses the frozen source registry and ignores caller capability overrides', () => {
  const value = { ...completeRequest(), registry: trustedFixtureRegistry, passed: true };
  const result = evaluateInterceptionReleaseGate(value, nowMs);
  assert.equal(result.contractVersion, 3);
  assert.equal(result.publicReleaseAllowed, false);
  assert.ok(result.reasons.some((reason) => reason.code === 'declared-capability-ineligible'));
});

test('v3 requires Safari on iOS, Chrome on Android and complete app-limit claims on both platforms', () => {
  for (const claimId of ['ios-safari', 'android-chrome', 'ios-apps', 'android-apps']) {
    const value = completeRequest();
    value.claims = value.claims.filter((claim) => claim.id !== claimId);
    assert.ok(codes(value).some((code) => code === 'minimum-browser-claim-missing' || code === 'app-journey-claim-missing'));
  }
});

test('unsupported optional browsers do not block, but advertised recovery requires exact evidence', () => {
  const unsupported = completeRequest();
  assert.equal(validateDeclaredRecoveryCoverage(unsupported, trustedFixtureRegistry, nowMs).publicReleaseAllowed, true);

  const advertised = completeRequest();
  const optional = advertised.claims.find((claim) => claim.id === 'ios-firefox')!;
  optional.status = 'verified-recovery';
  optional.capabilityId = 'ios-safari-dnr';
  assert.ok(codes(advertised).includes('claim-capability-mismatch'));
  assert.ok(codes(advertised).includes('browser-recovery-evidence-missing'));

  const stray = completeRequest();
  stray.evidence.push({
    ...stray.evidence[0], claimId: 'ios-firefox', capabilityId: 'none', browserId: 'firefox', network: 'wifi',
    artifact: artifact('unsupported-path-must-not-be-promoted')
  });
  assert.ok(codes(stray).includes('evidence-scope-mismatch'));
});

test('corrupt versions, duplicate declarations and unbound or mismatched evidence fail closed', () => {
  const wrongVersion = completeRequest(); wrongVersion.contractVersion = 2;
  assert.ok(codes(wrongVersion).includes('request-contract-version-mismatch'));

  const duplicate = completeRequest(); duplicate.claims.push({ ...duplicate.claims[0] });
  assert.ok(codes(duplicate).includes('claim-duplicate'));

  const badArtifact = completeRequest(); badArtifact.evidence[0].artifact = { path: '../escape.json', sha256: '' };
  assert.ok(codes(badArtifact).includes('evidence-artifact-unbound'));

  const mismatched = completeRequest(); mismatched.evidence[0].binding.osVersion = 'different';
  assert.ok(codes(mismatched).includes('evidence-binding-mismatch'));
});

test('each advertised network and every app threshold, grant, relock, cap, retry, replay, overlap and clock/restart scenario is required', () => {
  const missingNetwork = completeRequest();
  missingNetwork.evidence = missingNetwork.evidence.filter((row) => !(row.claimId === 'ios-safari' && row.network === 'cellular'));
  assert.ok(codes(missingNetwork).includes('browser-recovery-evidence-missing'));

  for (const scenario of appScenarios) {
    const value = completeRequest();
    value.evidence = value.evidence.filter((row) => !(row.claimId === 'android-apps' && row.scenario === scenario));
    assert.ok(codes(value).includes('app-journey-evidence-missing'), scenario);
  }
});

test('one generic relock cannot stand for all three promised break durations', () => {
  const value = completeRequest();
  const genericRows = new Map(value.evidence.filter(row => row.scenario.startsWith('native-relock')).map(row => [row.claimId + '|' + row.network, { ...row, scenario: 'native-relock', grantSeconds: undefined }]));
  value.evidence = value.evidence.filter(row => !row.scenario.startsWith('native-relock'));
  value.evidence.push(...genericRows.values());
  assert.equal(validateDeclaredRecoveryCoverage(value, trustedFixtureRegistry, nowMs).publicReleaseAllowed, false);
});

test('every duration needs matching native expiry and closed-app relock evidence on both platforms', () => {
  for (const claimId of ['ios-apps', 'android-apps']) for (const seconds of [300, 600, 1200]) {
    const missing = completeRequest();
    missing.evidence = missing.evidence.filter(row => !(row.claimId === claimId && row.scenario === `native-relock-${seconds}`));
    assert.ok(codes(missing).includes('app-journey-evidence-missing'), `${claimId}/${seconds}`);
    for (const patch of [{ grantSeconds: seconds === 300 ? 600 : 300 }, { nativeDeadlineRecorded: false }, { freedClosedBeforeExpiry: false }, { nativeExpiryObserved: false }, { originatingAppRelocked: false }]) {
      const value = completeRequest();
      Object.assign(value.evidence.find(row => row.claimId === claimId && row.scenario === `native-relock-${seconds}`)!, patch);
      assert.ok(codes(value).includes('app-journey-evidence-invalid'), `${claimId}/${seconds}/${JSON.stringify(patch)}`);
    }
  }
});

test('automatic entry or exactly one Open Challenge action is accepted; manual opening is not', () => {
  const automatic = completeRequest();
  const row = automatic.evidence.find((entry) => entry.scenario === 'browser-recovery')!;
  row.entryMethod = 'automatic';
  row.handoff = { action: 'none', productActionCount: 0, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true };
  assert.equal(validateDeclaredRecoveryCoverage(automatic, trustedFixtureRegistry, nowMs).publicReleaseAllowed, true);

  const compatible = completeRequest();
  const compatibleRow = compatible.evidence.find((entry) => entry.scenario === 'browser-recovery')!;
  compatibleRow.entryMethod = 'open-freed';
  compatibleRow.handoff = { action: 'open-freed', productActionCount: 1, osConfirmationCount: 0, foregroundAppId: 'app.freed.recovery', recoveryEntered: true };
  assert.equal(validateDeclaredRecoveryCoverage(compatible, trustedFixtureRegistry, nowMs).publicReleaseAllowed, true);

  const manual = completeRequest();
  const manualRow = manual.evidence.find((entry) => entry.scenario === 'browser-recovery')!;
  manualRow.entryMethod = 'manual-app-icon';
  assert.ok(codes(manual).includes('browser-handoff-invalid'));
});
