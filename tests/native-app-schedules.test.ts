import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createDefaultDisciplineSettings } from '../src/lib/recovery-state';
import { buildNativeAppScheduleConfiguration, getPersistentBlockedAppPackages, sanitizeAppScheduleConfiguration } from '../src/lib/app-schedules';
import { SUPPORTED_DOOMSCROLL_APP_PACKAGES } from '../src/lib/doomscroll-apps';

const settings = { ...createDefaultDisciplineSettings(), blockedAppPackages: ['com.instagram.android'], sleepModeEnabled: true, workHoursEnabled: true, weekendModeEnabled: true };
const config = () => buildNativeAppScheduleConfiguration(settings);
const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
function bridge(native: unknown, platform = 'android') {
  const code = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
  const sandbox = { module: { exports: {} as any }, setTimeout, clearTimeout, require: (name: string) => name === 'react-native' ? { Platform: { OS: platform } } : { requireNativeModule: () => native } };
  vm.runInNewContext(code, sandbox); return sandbox.module.exports;
}

test('manual targets never retain a timed guard expansion; static strict selection remains separate', () => {
  assert.deepEqual(getPersistentBlockedAppPackages(settings), ['com.instagram.android']);
  assert.deepEqual(new Set(getPersistentBlockedAppPackages({ ...settings, emergencyStrictMode: true })), new Set(SUPPORTED_DOOMSCROLL_APP_PACKAGES));
  const built = config();
  assert.equal(built.schedules.find(item => item.id === 'sleep')?.startMinute, 22 * 60 + 30);
  assert.equal(built.schedules.find(item => item.id === 'sleep')?.endMinute, 6 * 60 + 30);
  assert.deepEqual(built.schedules.find(item => item.id === 'work')?.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(built.schedules.find(item => item.id === 'weekend')?.days, [0, 6]);
  assert.equal(built.schedules.find(item => item.id === 'weekend')?.allDay, true);
  assert.equal(sanitizeAppScheduleConfiguration(built)?.schedules.length, 3);
});

test('bad schedule updates cannot become a destructive clear or expand to unapproved apps', () => {
  const valid = config();
  const first = valid.schedules[0];
  for (const bad of [null, { ...valid, version: 2 }, { ...valid, schedules: [first, first] },
    { ...valid, schedules: [{ ...first, startMinute: 1.5 }] },
    { ...valid, schedules: [{ ...first, days: [7] }] },
    { ...valid, schedules: [{ ...first, packages: ['app.freed.recovery'] }] },
    { ...valid, schedules: [{ ...first, packages: ['com.unapproved.app'] }] },
    { ...valid, schedules: [{ ...first, allDay: true }] },
    { ...valid, schedules: [{ ...first, id: 'weekend', allDay: false, days: [1], startMinute: 540, endMinute: 1020 }] },
    { ...valid, schedules: [{ ...first, enabled: true, packages: [] }] }]) {
    assert.equal(sanitizeAppScheduleConfiguration(bad), null);
  }
  assert.deepEqual(sanitizeAppScheduleConfiguration({ version: 1, schedules: [] }), { version: 1, schedules: [] });
  const equal = buildNativeAppScheduleConfiguration({ ...settings, sleepEndTime: settings.sleepStartTime });
  assert.equal(equal.schedules.find(item => item.id === 'sleep')?.enabled, false);
  const before = JSON.stringify(valid); sanitizeAppScheduleConfiguration(valid);
  assert.equal(JSON.stringify(valid), before, 'Validation cannot mutate saved UI settings.');
});

test('native configure acknowledgments do not invent connected or active enforcement', async () => {
  const calls: unknown[] = []; let grants = 0;
  const api = bridge({ configureAppSchedules: async (value: unknown) => {
    calls.push(value); return { authorized: false, active: false, mode: 'accessibility', appSchedulesSupported: true, appSchedulesConfigured: true, appSchedulesServiceConnected: false, appSchedulesConfigurationAccepted: true };
  }, applyEarnedUnlockWindow: () => { grants++; } });
  const result = await api.configureAppSchedules(config());
  assert.equal(calls.length, 1); assert.equal(grants, 0);
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(sanitizeAppScheduleConfiguration(config())));
  assert.equal(result.appSchedulesConfigurationAccepted, true);
  assert.equal(result.active, false); assert.equal(result.appSchedulesServiceConnected, false);
});

test('legacy and iOS bridges report unsupported timed guards while preserving existing protection', async () => {
  const status = { authorized: true, active: true, adultFilterActive: true, mode: 'dns' };
  let calls = 0;
  for (const api of [bridge({ getStatus: async () => status }), bridge({ getStatus: async () => status, configureAppSchedules: async () => { calls++; return status; } }, 'ios')]) {
    const result = await api.configureAppSchedules(config());
    assert.equal(result.active, true); assert.equal(result.adultFilterActive, true);
    assert.equal(result.appSchedulesSupported, false); assert.equal(result.appSchedulesConfigurationAccepted, false);
  }
  assert.equal(calls, 0, 'Android schedules cannot masquerade as iOS DeviceActivity configuration.');
});

test('invalid bridge input never reaches native persistence', async () => {
  let writes = 0;
  const api = bridge({ configureAppSchedules: async () => { writes++; return {}; } });
  await assert.rejects(api.configureAppSchedules({ version: 1, schedules: [{ id: 'unknown' }] }), /Invalid app schedule configuration/);
  assert.equal(writes, 0);
});

test('explicit iOS schedules retain timing and strict false without exporting target tokens or packages', async () => {
  let received: any; let grants = 0;
  const input = buildNativeAppScheduleConfiguration({ ...settings, emergencyStrictMode: false,
    deepFocusModeEnabled: false, strictGuardConfiguredAt: '2026-10-05T00:00:00.000Z' }, 'ios');
  const api = bridge({ configureAppSchedules: async (value: unknown) => {
    received = value; return { authorized: false, active: false, adultFilterActive: true,
      mode: 'screen-time', appSchedulesSupported: true, appSchedulesConfigurationAccepted: true,
      appSchedulesServiceConnected: false, appGuardReady: false };
  }, applyEarnedUnlockWindow: () => { grants++; } }, 'ios');
  const result = await api.configureAppSchedules(input);
  assert.equal(received.targetScope, 'selected-applications');
  assert.equal(received.strictGuard, false);
  assert.ok(received.schedules.every((item: any) => item.packages.length === 0));
  assert.equal(JSON.stringify(received), JSON.stringify(sanitizeAppScheduleConfiguration(input)));
  assert.equal(result.appSchedulesConfigurationAccepted, true);
  assert.equal(result.appSchedulesServiceConnected, false);
  assert.equal(result.appGuardReady, false);
  assert.equal(result.adultFilterActive, true); assert.equal(grants, 0);
});

test('iOS opaque-target scope cannot reach Android persistence and package scope cannot reach iOS', async () => {
  let writes = 0;
  const native = { getStatus: async () => ({ authorized: true, active: true, adultFilterActive: true, mode: 'dns' }),
    configureAppSchedules: async () => { writes++; return { appSchedulesConfigurationAccepted: true }; } };
  const iosScope = buildNativeAppScheduleConfiguration(settings, 'ios');
  for (const [platform, input] of [['android', iosScope], ['ios', config()], ['web', config()]] as const) {
    const result = await bridge(native, platform).configureAppSchedules(input);
    assert.equal(result.appSchedulesConfigurationAccepted, false);
    assert.equal(result.adultFilterActive, true);
  }
  assert.equal(writes, 0);
});
