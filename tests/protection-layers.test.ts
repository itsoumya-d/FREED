import test from 'node:test';
import assert from 'node:assert/strict';
import { describeProtectionLayers } from '../src/lib/protection-layers';
const android = { platform: 'android', screenTime: false, managedSettings: false, accessibility: true, dnsFiltering: true, usageStats: true, localVpnFallback: true, notes: [] } as const;
const ios = { platform: 'ios', screenTime: true, managedSettings: true, accessibility: false, dnsFiltering: false, localVpnFallback: false, safariContentBlocker: true, notes: [] } as const;
test('a running VPN cannot claim filtering when coverage is unverified or paused', () => {
  const status = { active: true, authorized: true, adultFilterActive: true, dnsGuardRuntimeReady: true, mode: 'dns', message: '' } as any;
  assert.equal(describeProtectionLayers(android as any, status)[0].state, 'limited');
  assert.equal(describeProtectionLayers(android as any, { ...status, dnsGuardCoverageReady: true })[0].state, 'active');
  assert.equal(describeProtectionLayers(android as any, { ...status, dnsGuardCoverageReady: true, dnsGuardCaptivePaused: true })[0].state, 'paused');
});
test('Screen Time, selected app limits, and Safari have independent states', () => {
  const status = { active: true, authorized: true, adultFilterActive: true, mode: 'screen-time', message: '', selectedScreenTimeTokenCount: 2, appLimitScheduled: true, safariContentBlockerEnabled: false } as any;
  const layers = describeProtectionLayers(ios as any, status);
  assert.equal(layers.find(x => x.id === 'screen-time')?.state, 'active');
  assert.equal(layers.find(x => x.id === 'apps')?.state, 'active');
  assert.equal(layers.find(x => x.id === 'safari')?.state, 'off');
  assert.equal(describeProtectionLayers(ios as any, { ...status, authorized: false })[0].state, 'limited');
});
