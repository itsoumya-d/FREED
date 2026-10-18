import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoStartDnsGuard } from '../src/lib/protection-setup-presenter';
test('automatic DNS restarts require disclosure, existing approval and a conflict-free fresh native status', () => {
  const base = { vpnConsentRequired: false, adultFilterActive: false };
  assert.equal(canAutoStartDnsGuard(false, base), false);
  assert.equal(canAutoStartDnsGuard(true, null), false);
  assert.equal(canAutoStartDnsGuard(true, { ...base, vpnConsentRequired: true }), false);
  assert.equal(canAutoStartDnsGuard(true, { ...base, adultFilterActive: true }), false);
  assert.equal(canAutoStartDnsGuard(true, { ...base, otherVpnActive: true }), false);
  assert.equal(canAutoStartDnsGuard(true, { ...base, alwaysOnVpnPackage: 'other.vpn' }), false);
  assert.equal(canAutoStartDnsGuard(true, base), true);
});
