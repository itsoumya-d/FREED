import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAutoStartDnsGuard, presentProtectionSetup } from '../src/lib/protection-setup-presenter';
import { getProtectionActivationRecoveryStep, type ProtectionPermissionStep } from '../src/lib/protection-permissions';
import type { ProtectionActivationDiagnostics } from 'freed-protection';

const dnsStep: ProtectionPermissionStep = {
  id: 'android-dns-guard', title: 'Adult-domain DNS Guard', permissionLabel: 'DNS-only VPN permission',
  platform: 'android', required: true, status: 'needed', reason: '', dataBoundary: '', action: 'apply-adult-filter'
};
const privateDnsStep: ProtectionPermissionStep = {
  id: 'android-private-dns-guidance', title: 'Private DNS guidance', permissionLabel: 'Android network settings',
  platform: 'android', required: false, status: 'needed', reason: '', dataBoundary: '', action: 'open-private-dns-settings'
};
const diagnostics: ProtectionActivationDiagnostics = {
  platform: 'android', checkedNativeLayer: true, nativeChecksPassed: false,
  adultBlocked: true, normalAllowed: true, message: 'Private DNS prevents this DNS route from filtering.',
  issues: ['DNS Guard is not running.'], issueCodes: ['android-private-dns-strict-unsupported', 'android-dns-guard-not-running'],
  adultDomainFeedDomainCount: 256, dnsGuardActive: false, dnsGuardRuntimeReady: false,
  privateDnsMode: 'hostname', vpnConsentRequired: false
};

test('automatic starts wait for a clear DNS privacy state even with existing VPN approval', () => {
  const approved = { vpnConsentRequired: false, adultFilterActive: false };
  for (const privateDnsMode of ['hostname', 'opportunistic', 'unknown', 'unexpected']) {
    assert.equal(canAutoStartDnsGuard(true, { ...approved, privateDnsMode }), false, privateDnsMode);
  }
  assert.equal(canAutoStartDnsGuard(true, { ...approved, privateDnsMode: 'off', privateDnsActive: true }), false);
  assert.equal(canAutoStartDnsGuard(true, { ...approved, privateDnsMode: 'off', privateDnsActive: false }), true);
});

test('DNS privacy recovery opens settings instead of retrying a resolver that native policy refuses', () => {
  const presentation = presentProtectionSetup({
    platform: 'android', step: dnsStep, complete: false, ready: false, busy: null,
    privateDnsConflict: true, dnsStarting: true, dnsFailed: true
  });
  assert.equal(presentation.action, 'Open Private DNS settings');
  assert.equal(presentation.stage, 1);
  assert.match(presentation.instruction, /Private DNS/);
  assert.equal(presentProtectionSetup({
    platform: 'android', step: dnsStep, complete: false, ready: false, busy: 'settings', privateDnsConflict: true
  }).action, 'Setting up…');
});

test('Private DNS diagnostics take priority over their resulting not-running status', () => {
  for (const [privateDnsMode, code] of [
    ['hostname', 'android-private-dns-strict-unsupported'],
    ['opportunistic', 'android-private-dns-encrypted-unsupported'],
    ['unknown', 'android-private-dns-state-unknown']
  ]) {
    const result = getProtectionActivationRecoveryStep([dnsStep, privateDnsStep], {
      ...diagnostics, privateDnsMode, issueCodes: [code, 'android-dns-guard-not-running']
    });
    assert.equal(result?.id, 'android-private-dns-guidance', privateDnsMode);
  }
  assert.equal(getProtectionActivationRecoveryStep([dnsStep, privateDnsStep], {
    ...diagnostics, privateDnsMode: 'off', issueCodes: ['android-dns-guard-not-running']
  })?.id, 'android-dns-guard');
});
