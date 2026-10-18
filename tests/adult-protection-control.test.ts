import test from 'node:test';
import assert from 'node:assert/strict';
import { disableAdultProtection } from '../src/lib/adult-protection-control';
const off = { authorized: true, active: false, mode: 'screen-time', message: '', adultFilterActive: false, adultFilterRequested: false, adultWebPolicyConfigured: false, nativeConfigurationOperationAccepted: true } as const;
const dns = { supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false } as const;
function fixture() {
  const calls: string[] = [];
  let current = true;
  const input = { isCurrent: () => current,
    stopPolicy: async () => { calls.push('policy'); return off; },
    removeDns: async () => { calls.push('dns'); return { accepted: true, status: dns }; },
    readPolicy: async () => { calls.push('read-policy'); return off; },
    readDns: async () => { calls.push('read-dns'); return dns; } };
  return { calls, input, invalidate: () => { current = false; } };
}
test('manual disable returns Off only after both real acknowledgements and fresh readback', async () => {
  const f = fixture(); assert.equal(await disableAdultProtection(f.input), 'off');
  assert.deepEqual(f.calls, ['policy', 'dns', 'read-policy', 'read-dns']);
});
test('policy rejection retains DNS instead of disabling another layer', async () => {
  const f = fixture(); f.input.stopPolicy = async () => ({ ...off, nativeConfigurationOperationAccepted: false });
  assert.equal(await disableAdultProtection(f.input), 'needs-attention'); assert.deepEqual(f.calls, []);
});
test('owner changes before or between stages suppress remaining operations', async () => {
  const f = fixture(); f.invalidate(); assert.equal(await disableAdultProtection(f.input), 'superseded'); assert.deepEqual(f.calls, []);
  const g = fixture(); g.input.stopPolicy = async () => { g.invalidate(); return off; };
  assert.equal(await disableAdultProtection(g.input), 'superseded'); assert.deepEqual(g.calls, []);
});
test('DNS failure or unobserved native policy cannot report a complete disable', async () => {
  const f = fixture(); f.input.removeDns = async () => ({ accepted: false, status: dns });
  assert.equal(await disableAdultProtection(f.input), 'needs-attention');
  const g = fixture(); g.input.readPolicy = async () => ({ ...off, adultFilterActive: true } as any);
  assert.equal(await disableAdultProtection(g.input), 'needs-attention');
});
test('unavailable DNS readback never becomes an Off confirmation', async () => {
  const f = fixture(); f.input.readDns = async () => ({ ...dns, supported: false, reason: 'native-module-unavailable' } as any);
  assert.equal(await disableAdultProtection(f.input), 'needs-attention');
});

test('an independent web policy still installed is reported as a remaining layer, never Off', async () => {
  const f = fixture(); f.input.readPolicy = async () => ({ ...off, adultWebPolicyConfigured: true } as any);
  assert.equal(await disableAdultProtection(f.input), 'needs-attention');
});
