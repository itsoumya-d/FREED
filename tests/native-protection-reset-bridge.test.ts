import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
function bridge(native: unknown) {
  const code = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
  const sandbox = { module: { exports: {} as any }, setTimeout, clearTimeout, require: (name: string) => name === 'react-native' ? { Platform: { OS: 'ios' } } : { requireNativeModule: () => native } };
  vm.runInNewContext(code, sandbox); return sandbox.module.exports;
}
test('old native APIs never substitute configure-empty or status for reset acknowledgment', async () => {
  let sideEffects = 0;
  const api = bridge({ getStatus: async () => ({ authorized: true, active: true, selectedApplications: 2 }),
    configureBlockedAppPackages: () => { sideEffects++; }, clearEarnedUnlockWindow: () => { sideEffects++; } });
  const result = await api.resetProtectionConfiguration();
  assert.equal(result.protectionConfigurationResetAccepted, false);
  assert.equal(result.selectedApplications, 2); assert.equal(result.active, true);
  assert.equal(sideEffects, 0, 'Legacy configure[] can reuse opaque tokens and is not reset authority.');
});
test('partial cleanup remains a retryable failure with actual native residual status', async () => {
  const api = bridge({ resetProtectionConfiguration: async () => ({ authorized: true, active: true,
    protectionConfigurationResetAccepted: false, protectionConfigurationResetError: 'owned-filter-stop-pending' }) });
  const result = await api.resetProtectionConfiguration();
  assert.equal(result.protectionConfigurationResetAccepted, false);
  assert.equal(result.active, true); assert.equal(result.protectionConfigurationResetError, 'owned-filter-stop-pending');
});
test('confirmed native reset preserves OS authorization and reaches only the reset operation', async () => {
  let resets = 0, grants = 0;
  const api = bridge({ resetProtectionConfiguration: async () => { resets++; return { authorized: true, active: false,
    selectedApplications: 0, scheduled: false, protectionConfigurationResetAccepted: true }; },
    applyEarnedUnlockWindow: () => { grants++; } });
  const result = await api.resetProtectionConfiguration();
  assert.equal(resets, 1); assert.equal(grants, 0);
  assert.equal(result.authorized, true); assert.equal(result.active, false);
  assert.equal(result.protectionConfigurationResetAccepted, true);
});
test('status and background configuration cannot substitute for explicit activation', async () => {
  let writes = 0;
  const api = bridge({ getStatus: async () => ({ authorized: true, active: false, protectionConfigurationResetDisabled: true }),
    configureBlockedAppPackages: () => { writes++; }, configureAppSchedules: () => { writes++; } });
  const result = await api.activateProtectionConfiguration();
  assert.equal(result.protectionConfigurationActivationAccepted, false);
  assert.equal(result.protectionConfigurationResetDisabled, true);
  assert.equal(writes, 0);
});
test('explicit activation acknowledgment preserves actual permission and runtime state', async () => {
  let calls = 0;
  const api = bridge({ activateProtectionConfiguration: async () => { calls++; return { authorized: false, active: false,
    protectionConfigurationResetDisabled: false, protectionConfigurationActivationAccepted: true }; } });
  const result = await api.activateProtectionConfiguration();
  assert.equal(calls, 1);
  assert.equal(result.protectionConfigurationActivationAccepted, true);
  assert.equal(result.authorized, false); assert.equal(result.active, false);
});
