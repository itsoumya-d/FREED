import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';

const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
function bridge(native: unknown, platform = 'ios') {
  const code = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
  const context = { module: { exports: {} as any }, setTimeout, clearTimeout, require: (name: string) => name === 'react-native' ? { Platform: { OS: platform } } : { requireNativeModule: () => native } };
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const protectedStatus = { authorized: true, active: true, adultFilterActive: true, mode: 'screen-time' };

test('both native platforms configure each exact mode without granting or changing adult protection', async () => {
  for (const platform of ['ios', 'android']) {
    const calls: string[] = []; let grants = 0;
    const api = bridge({ configureAppGuardMode: async (mode: string) => {
      calls.push(mode); return { ...protectedStatus, appGuardMode: mode, appGuardModeConfigurationAccepted: true, appGuardReady: false };
    }, applyEarnedUnlockWindow: () => { grants++; } }, platform);
    for (const mode of ['before-use', 'daily-limit', 'scheduled']) {
      const result = await api.configureAppGuardMode(mode);
      assert.equal(result.appGuardMode, mode);
      assert.equal(result.appGuardModeConfigurationAccepted, true);
      assert.equal(result.appGuardReady, false, 'adult protection or saved mode cannot establish app-guard readiness');
      assert.equal(result.adultFilterActive, true);
    }
    assert.deepEqual(calls, ['before-use', 'daily-limit', 'scheduled']); assert.equal(grants, 0);
  }
});

test('legacy and preview binaries cannot acknowledge installation while preserving other status', async () => {
  let writes = 0;
  for (const api of [bridge({ getStatus: async () => protectedStatus }), bridge({ getStatus: async () => protectedStatus, configureAppGuardMode: async () => { writes++; return protectedStatus; } }, 'web'), bridge(null)]) {
    const result = await api.configureAppGuardMode('before-use');
    assert.equal(result.appGuardModeConfigurationAccepted, false);
    assert.equal(result.appGuardReady, false);
    if (result.mode === 'screen-time') assert.equal(result.adultFilterActive, true);
  }
  assert.equal(writes, 0);
});

test('invalid runtime modes never reach native persistence', async () => {
  let writes = 0;
  const api = bridge({ configureAppGuardMode: async () => { writes++; return protectedStatus; } });
  for (const mode of [undefined, null, '', 'off', 'BEFORE-USE', 'before-use ', {}, 1]) {
    await assert.rejects(api.configureAppGuardMode(mode), /Invalid app guard mode/);
  }
  assert.equal(writes, 0);
});

test('stale mode acknowledgments and reset-disabled results fail closed', async () => {
  for (const result of [
    { appGuardMode: 'daily-limit', appGuardModeConfigurationAccepted: true, appGuardReady: true },
    { appGuardMode: 'before-use', appGuardModeConfigurationAccepted: false, appGuardReady: true },
    { appGuardMode: 'before-use', appGuardModeConfigurationAccepted: true, appGuardReady: true, protectionConfigurationResetDisabled: true }
  ]) {
    const api = bridge({ configureAppGuardMode: async () => ({ ...protectedStatus, ...result }) });
    const status = await api.configureAppGuardMode('before-use');
    assert.equal(status.appGuardModeConfigurationAccepted, false);
    assert.equal(status.appGuardReady, false);
    assert.equal(status.adultFilterActive, true);
  }
});

test('native failure cannot be turned into a successful mode install', async () => {
  const api = bridge({ configureAppGuardMode: async () => { throw new Error('native configuration unavailable'); } });
  await assert.rejects(api.configureAppGuardMode('scheduled'), /native configuration unavailable/);
});
