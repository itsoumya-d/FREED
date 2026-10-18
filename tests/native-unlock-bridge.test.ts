import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
const code = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
function bridge(native: unknown, platform = 'android') {
  const sandbox = { module: { exports: {} as any }, setTimeout, clearTimeout, require: (name: string) => name === 'react-native' ? { Platform: { OS: platform } } : { requireNativeModule: () => native } };
  vm.runInNewContext(code, sandbox); return sandbox.module.exports;
}
async function run() {
  const id = '10101010-1010-4010-8010-101010101010';
  const expiry = '2026-10-03T16:00:00.000Z';
  const scope = { kind: 'android-surface', packageName: 'com.google.android.youtube', ruleId: 'focus-rule-a7f9' };
  const calls: unknown[][] = [];
  const api = bridge({ applyFocusShieldEarnedUnlock: async (...args: unknown[]) => { calls.push(args); return { authorized: true, active: true, mode: 'accessibility', nativeUnlockGrantAccepted: true, nativeUnlockGrantInterventionId: id }; } });
  await api.applyFocusShieldEarnedUnlock(expiry, scope);
  await api.applyFocusShieldEarnedUnlock(expiry, scope, 'invalid-id');
  assert.equal(calls.length, 0, 'A scope alone cannot reach the native surface-grant API.');
  const result = await api.applyFocusShieldEarnedUnlock(expiry, scope, id);
  // 15 October: unscoped legacy grants have no v2 admission transport and must remain unavailable.
  assert.equal(calls.length,0);
  assert.equal(result.nativeUnlockGrantAccepted,false);
  assert.equal(result.nativeUnlockGrantInterventionId,undefined);
  const malformed = api.sanitizeFocusShieldStatusFields({ authorized: true, active: true, mode: 'accessibility', activeUnlockInterventionId: 'private-input-not-a-uuid', activeFocusShieldUnlockInterventionId: 'private-selector-text', nativeUnlockGrantAccepted: true, nativeUnlockGrantInterventionId: 'not-a-uuid' });
  assert.equal(malformed.activeUnlockInterventionId, undefined);
  assert.equal(malformed.activeFocusShieldUnlockInterventionId, undefined);
  assert.notEqual(malformed.nativeUnlockGrantAccepted, true);
  let iosPackageCalls = 0;
  const ios = bridge({ applyEarnedUnlockWindow: async () => { iosPackageCalls++; return { authorized: true }; } }, 'ios');
  await ios.applyFocusShieldEarnedUnlock(expiry, scope, id);
  assert.equal(iosPackageCalls, 0, 'Unsupported iOS surface access never substitutes a package-unlock request.');
  console.log('Native surface grant identity and iOS unsupported bridge cases passed');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
